// =======================
// Custom Battle System
// =======================
// Generic system for managing custom battles with configurable villains, restrictions, and cleanup
'use strict';

function applyVillainAwakenFromConfig(villain, villainConfig) {
    if (!villain || !villainConfig) return villain;
    const awakened = villainConfig.awakened === true || villainConfig.awaken === true || villainConfig.isAwakened === true;
    if (!awakened) return villain;
    villain.awaken = true;
    villain.awakened = true;
    villain.isAwakened = true;
    villain.starTier = villainConfig.starTier != null ? villainConfig.starTier : 6;
    return villain;
}

// Prevent multiple initializations
if (window.CustomBattles) {
    // Already initialized, skip
} else {
    try {
        (function() {
            'use strict';

        function buildSceneSpriteReplacementState(sceneSpriteReplacements) {
            if (!sceneSpriteReplacements?.rules?.length) return null;

            const replacements = new Map();
            for (const rule of sceneSpriteReplacements.rules) {
                const sourceIds = [];
                if (Array.isArray(rule.sourceIds)) {
                    sourceIds.push(...rule.sourceIds);
                }
                if (rule.sourceIdRange) {
                    const from = rule.sourceIdRange.from;
                    const to = rule.sourceIdRange.to;
                    for (let sourceId = from; sourceId <= to; sourceId++) {
                        sourceIds.push(sourceId);
                    }
                }
                for (const sourceId of sourceIds) {
                    replacements.set(sourceId, {
                        replacementId: rule.replacementId,
                        makeRelative: !!rule.makeRelative,
                        scope: rule.scope || 'any'
                    });
                }
            }

            if (replacements.size === 0) return null;

            return {
                rootId: sceneSpriteReplacements.rootId || 'background-scene',
                excludeRootIds: Array.isArray(sceneSpriteReplacements.excludeRootIds)
                    ? sceneSpriteReplacements.excludeRootIds
                    : ['actors'],
                datasetKey: sceneSpriteReplacements.datasetKey || 'customBattleSceneReplaced',
                replacements,
                selector: [...replacements.keys()].map((sourceId) => `.sprite.item.id-${sourceId}`).join(', '),
                complete: false
            };
        }

        const activeCustomBattles = new Set();
        let globalAllyVillainGuardInstalled = false;
        let globalAllyVillainBoardTimer = null;
        let roomInfoOverlayObserver = null;
        let roomInfoOverlayHideTimer = null;

        function isRoomInfoOverlayElement(el) {
            if (!el || el.nodeType !== 1) return false;
            if (!el.classList?.contains('pointer-events-none')) return false;
            if (!el.classList.contains('absolute')) return false;
            if (!el.classList.contains('right-0') || !el.classList.contains('top-0')) return false;
            const text = el.textContent || '';
            return text.includes('Monsters');
        }

        function setRoomInfoOverlaySuppressed(suppressed) {
            try {
                document.querySelectorAll('.pointer-events-none.absolute.right-0.top-0').forEach((el) => {
                    if (!isRoomInfoOverlayElement(el)) return;
                    if (suppressed) {
                        if (el.dataset.customBattlePrevDisplay == null) {
                            el.dataset.customBattlePrevDisplay = el.style.display || '';
                        }
                        el.dataset.customBattleRoomOverlayHidden = '1';
                        el.style.display = 'none';
                    } else if (el.dataset.customBattleRoomOverlayHidden === '1') {
                        el.style.display = el.dataset.customBattlePrevDisplay || '';
                        delete el.dataset.customBattlePrevDisplay;
                        delete el.dataset.customBattleRoomOverlayHidden;
                    }
                });
            } catch (error) {
                console.warn('[Custom Battles] Error toggling room info overlay visibility:', error);
            }
        }

        function stopRoomInfoOverlayWatch() {
            if (roomInfoOverlayHideTimer) {
                clearTimeout(roomInfoOverlayHideTimer);
                roomInfoOverlayHideTimer = null;
            }
            if (roomInfoOverlayObserver) {
                try {
                    roomInfoOverlayObserver.disconnect();
                } catch (_) {
                    // no-op
                }
                roomInfoOverlayObserver = null;
            }
        }

        function startRoomInfoOverlayWatch() {
            setRoomInfoOverlaySuppressed(true);
            if (roomInfoOverlayObserver || typeof MutationObserver === 'undefined') return;

            const observeRoot = document.body || document.documentElement;
            if (!observeRoot) return;

            roomInfoOverlayObserver = new MutationObserver(() => {
                if (roomInfoOverlayHideTimer) clearTimeout(roomInfoOverlayHideTimer);
                roomInfoOverlayHideTimer = setTimeout(() => {
                    roomInfoOverlayHideTimer = null;
                    if (activeCustomBattles.size > 0) {
                        setRoomInfoOverlaySuppressed(true);
                    }
                }, 50);
            });
            roomInfoOverlayObserver.observe(observeRoot, {
                childList: true,
                subtree: true
            });
        }

        function hideRoomInfoOverlayForCustomBattle() {
            startRoomInfoOverlayWatch();
        }

        function showRoomInfoOverlayAfterCustomBattle() {
            stopRoomInfoOverlayWatch();
            setRoomInfoOverlaySuppressed(false);
        }

        function setBetterHighscoresSuppressed(suppressed) {
            try {
                if (typeof window !== 'undefined' && window.BetterHighscores
                    && typeof window.BetterHighscores.setCustomBattleSuppressed === 'function') {
                    window.BetterHighscores.setCustomBattleSuppressed(suppressed);
                    return;
                }
                const selector = '.better-highscores-container, .better-highscores-restore-btn';
                document.querySelectorAll(selector).forEach((el) => {
                    if (suppressed) {
                        if (el.dataset.customBattlePrevDisplay == null) {
                            el.dataset.customBattlePrevDisplay = el.style.display || '';
                        }
                        el.style.display = 'none';
                    } else {
                        el.style.display = el.dataset.customBattlePrevDisplay || '';
                        delete el.dataset.customBattlePrevDisplay;
                    }
                });
            } catch (error) {
                console.warn('[Custom Battles] Error toggling Better Highscores visibility:', error);
            }
        }

        function hideBetterHighscoresForCustomBattle() {
            setBetterHighscoresSuppressed(true);
        }

        function showBetterHighscoresAfterCustomBattle() {
            setBetterHighscoresSuppressed(false);
        }

        function filterAutoSetupForActiveBattles(event) {
            if (!event?.setup?.length) return;

            let boardConfig = [];
            try {
                boardConfig = globalThis.state?.board?.getSnapshot()?.context?.boardConfig || [];
            } catch (_) {}

            let setup = event.setup;
            for (const battle of activeCustomBattles) {
                if (!battle.isActive) continue;
                try {
                    if (!battle.shouldRestrictionsBeActive(battle.activationCallback)) continue;
                    const toast = battle._overlapToastCallback || null;
                    setup = battle.filterSetupPreventAllyOnVillainTiles(setup, toast);
                    setup = battle.filterSetupPreventAllyOnForcedAllyTiles(setup, toast);
                    setup = battle.filterSetupPreventAllyOutsideAllowedTiles(setup, toast);
                    setup = filterSetupPreventDuplicateAllies(setup, boardConfig, battle, toast);
                } catch (_) {}
            }
            event.setup = setup;
        }

        function enforceAllyVillainSeparationForActiveBattles(showToastCallback) {
            for (const battle of activeCustomBattles) {
                if (!battle.isActive) continue;
                try {
                    if (!battle.shouldRestrictionsBeActive(battle.activationCallback)) continue;
                    if (battle.isBoardBattleActive()) continue;
                    const toast = showToastCallback || battle._overlapToastCallback || null;
                    if (battle.removeDuplicateAlliesFromBoard(toast)) {
                        break;
                    }
                    if (battle.removeAlliesOverlappingVillains(toast)) {
                        break;
                    }
                    if (battle.removeAlliesOverlappingForcedAllies(toast)) {
                        break;
                    }
                    if (battle.removeAlliesOutsideAllowedTiles(toast)) {
                        break;
                    }
                } catch (_) {}
            }
        }

        function installGlobalAllyVillainOverlapGuard() {
            if (globalAllyVillainGuardInstalled || !globalThis.state?.board) return;
            globalAllyVillainGuardInstalled = true;

            try {
                globalThis.state.board.on('autoSetupBoard', filterAutoSetupForActiveBattles);
            } catch (error) {
                console.error('[Custom Battles] Failed to install autoSetupBoard overlap guard:', error);
            }

            try {
                globalThis.state.board.subscribe(() => {
                    if (globalAllyVillainBoardTimer) {
                        clearTimeout(globalAllyVillainBoardTimer);
                    }
                    globalAllyVillainBoardTimer = setTimeout(() => {
                        globalAllyVillainBoardTimer = null;
                        enforceAllyVillainSeparationForActiveBattles(null);
                    }, 0);
                });
            } catch (error) {
                console.error('[Custom Battles] Failed to install board overlap guard:', error);
            }

            console.log('[Custom Battles] Global ally/villain overlap guard installed');
        }

        function getAllyCreatureDedupKey(piece, battle) {
            if (!piece || piece.villain === true) return null;
            // Forced custom allies may intentionally share gameId (e.g. two Rookstayers).
            if (battle && typeof battle.isForcedAllyEntity === 'function' && battle.isForcedAllyEntity(piece)) {
                return null;
            }
            if (battle && typeof battle.isAllyPiece === 'function' && !battle.isAllyPiece(piece)) return null;
            if (!battle) {
                if (piece.type !== 'player' && piece.monsterId == null && piece.databaseId == null && piece.type !== 'custom') {
                    return null;
                }
            }

            const keys = [];
            const monsterId = piece.monsterId ?? piece.databaseId;
            if (monsterId != null && monsterId !== '') {
                keys.push('mid:' + monsterId);
            } else if (piece.gameId != null) {
                keys.push('gid:' + piece.gameId);
            } else if (piece.key) {
                keys.push('key:' + piece.key);
            }
            return keys.length ? keys : null;
        }

        function filterSetupPreventDuplicateAllies(setup, existingBoardConfig, battle, showToastCallback) {
            if (!Array.isArray(setup)) return setup;

            const seen = new Set();
            const markPiece = (piece) => {
                const keys = getAllyCreatureDedupKey(piece, battle);
                if (!keys) return;
                for (const key of keys) seen.add(key);
            };

            if (Array.isArray(existingBoardConfig)) {
                for (const entity of existingBoardConfig) {
                    markPiece(entity);
                }
            }

            let blocked = 0;
            const filtered = setup.filter((piece) => {
                if (piece?.villain) return true;
                const keys = getAllyCreatureDedupKey(piece, battle);
                if (!keys) return true;
                for (const key of keys) {
                    if (seen.has(key)) {
                        blocked++;
                        return false;
                    }
                }
                for (const key of keys) seen.add(key);
                return true;
            });

            if (blocked > 0) {
                const battleName = battle?.config?.name || 'Battle';
                console.log(`[Custom Battles][${battleName}] Blocked ${blocked} duplicate ally creature placement(s)`);
                if (showToastCallback) {
                    showToastCallback({
                        message: 'Each creature can only be on the board once.',
                        type: 'warning',
                        duration: 3000
                    });
                }
            }

            return filtered;
        }

        installGlobalAllyVillainOverlapGuard();

        function isBoardAllyCreatureButton(button) {
            if (!button) return false;
            if (button.closest('[role="menu"]') || button.closest('[role="dialog"]')) return false;
            if (
                button.closest('#monster-scroll') ||
                button.closest('.tab-picker-scroll') ||
                button.closest('[id*="monster-scroll"]')
            ) {
                return false;
            }

            if (button.querySelector('img[alt="creature"]')) return false;
            if (!button.querySelector('.sprite.outfit')) return false;

            const isDraggable =
                button.getAttribute('aria-roledescription') === 'draggable' ||
                [...button.classList].some((className) => className.includes('draggable'));
            if (!isDraggable) return false;

            return Boolean(
                button.closest('#viewport') ||
                button.closest('#tiles') ||
                button.closest('#background-scene')
            );
        }

        function shouldBlockAllyContextMenu() {
            for (const battle of activeCustomBattles) {
                if (!battle.isActive || !battle.isInBattleArea()) continue;
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
                    if (boardContext?.mode === 'sandbox') return true;
                } catch {
                    // ignore snapshot failures
                }
            }
            return false;
        }

        function blockAllyContextMenuDuringCustomBattle(event) {
            if (!shouldBlockAllyContextMenu()) return;

            const button = event.target.closest?.('button');
            if (!isBoardAllyCreatureButton(button)) return;

            // Only block configured custom villains / forced allies — never natural player creatures.
            if (button.dataset.customBattleLocked !== '1') return;

            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        }

        document.addEventListener('contextmenu', blockAllyContextMenuDuringCustomBattle, true);

        /**
         * CustomBattle class for managing custom battle configurations
         */
        class CustomBattle {
            constructor(config) {
                this.config = config;
                this.isActive = false;
                this.subscriptions = {
                    board: null,
                    allyLimit: null,
                    tileRestriction: null,
                    preventVillainMovement: null,
                    allyVillainOverlap: null,
                    victoryDefeat: null
                };
                this.setupUnsubscribe = null;
                this.setupUnsubscribeHandler = null;
                this.tileRestrictionActive = false;
                this.preventVillainMovementActive = false;
                this.lastVillainAddTime = 0;
                this.isAddingVillains = false;
                this.boardSetupLock = false;
                this.customVillainPlacementReady = false;
                this.sceneSpriteState = buildSceneSpriteReplacementState(config.sceneSpriteReplacements);
                this.activationCallback = null;
                this.sceneSpriteGameEventUnsubscribes = [];
                
                // Stop button state
                this.stopButtonObserver = null;
                this.stopButtonDisabled = false;
                this.startButtonClickHandler = null;
                this.gameStartEventUnsubscribes = [];
                
                // Victory/defeat state
                this.lastGameState = 'initial';
                this.victoryDefeatModal = null;
                this.victoryDefeatAutoCloseTimer = null;
                this.allyDeathsThisGame = 0;
                this.allyDeathTrackingUnsubs = [];
                this.newGameUnsub = null;
                this._roomReloadInProgress = false;
                this._roomReloadClearTimer = null;
                this.autoSetupVillainSyncUnsub = null;
                this.autoSetupVillainSyncHandler = null;
                this.autoSetupVillainSyncTimer = null;
                this.allyVillainOverlapUnsub = null;
                this.allyVillainOverlapHandler = null;
                this.allyVillainOverlapTimer = null;
                this.pendingVillainSyncTimer = null;
                this.entryVillainSetupDone = false;
                this.entryVillainSetupTimer = null;
                this.sceneSpriteReplacementTimer = null;
                this.outfitSpriteOverrideObserver = null;
                this.outfitSpriteOverrideTimer = null;
                this.outfitSpriteOverrideInterval = null;
                if (!config.roomId) {
                    throw new Error('CustomBattle config must include roomId');
                }
                if (!config.villains || !Array.isArray(config.villains)) {
                    throw new Error('CustomBattle config must include villains array');
                }
                
                // Generate key prefixes for villains
                this.villainKeyPrefixes = config.villains.map(v => {
                    // If keyPrefix is provided, use it as-is (may include tile index)
                    // Otherwise generate one with tile index
                    const prefix = v.keyPrefix || `${v.nickname?.toLowerCase() || 'villain'}-tile-${v.tileIndex}-`;
                    // For prefixes that don't include tile index, we need to match differently
                    const hasTileInPrefix = prefix.includes(`${v.tileIndex}-`);
                    return { 
                        prefix, 
                        tileIndex: v.tileIndex, 
                        nickname: v.nickname,
                        hasTileInPrefix: hasTileInPrefix || prefix.endsWith(`-${v.tileIndex}-`) || prefix.includes(`tile-${v.tileIndex}-`)
                    };
                });

                this.allyKeyPrefixes = (config.allies || []).map((ally) => {
                    const prefix = ally.keyPrefix || `${ally.nickname?.toLowerCase() || 'ally'}-tile-${ally.tileIndex}-`;
                    const hasTileInPrefix = prefix.includes(`${ally.tileIndex}-`);
                    return {
                        prefix,
                        tileIndex: ally.tileIndex,
                        nickname: ally.nickname,
                        hasTileInPrefix: hasTileInPrefix || prefix.endsWith(`-${ally.tileIndex}-`) || prefix.includes(`tile-${ally.tileIndex}-`)
                    };
                });
                this.forcedAllyWatchUnsub = null;
            }

            /**
             * Check if currently in the battle area
             */
            isInBattleArea() {
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                    if (!boardContext?.selectedMap) return false;

                    const currentRoomId = boardContext.selectedMap.roomId || boardContext.selectedMap.selectedRoom?.id;
                    return currentRoomId === this.config.roomId;
                } catch (error) {
                    console.error('[Custom Battles] Error checking battle area:', error);
                    return false;
                }
            }

            /**
             * True while a fight is running — boardConfig is owned by the game, not sandbox setup.
             */
            isBoardBattleActive() {
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
                    return boardContext?.gameStarted === true;
                } catch (error) {
                    return false;
                }
            }

            isBoardSetupLocked() {
                return this.boardSetupLock === true;
            }

            markCustomVillainPlacementReady(ready = true) {
                this.customVillainPlacementReady = ready === true;
            }

            isEntryVillainSetupDone() {
                return this.entryVillainSetupDone === true;
            }

            cancelEntryVillainSetupTimer() {
                if (this.entryVillainSetupTimer) {
                    clearTimeout(this.entryVillainSetupTimer);
                    this.entryVillainSetupTimer = null;
                }
            }

            resetEntryVillainSetup() {
                this.cancelEntryVillainSetupTimer();
                this.cancelSceneSpriteReplacementTimer();
                this.cancelOutfitSpriteOverrideWatch();
                this.entryVillainSetupDone = false;
                this.resetSceneSpriteReplacements();
                this.markCustomVillainPlacementReady(false);
            }

            isRoomReloadInProgress() {
                return this._roomReloadInProgress === true;
            }

            beginRoomReload() {
                this._roomReloadInProgress = true;
                if (this._roomReloadClearTimer) {
                    clearTimeout(this._roomReloadClearTimer);
                    this._roomReloadClearTimer = null;
                }
            }

            endRoomReload(delayMs = 750) {
                if (this._roomReloadClearTimer) {
                    clearTimeout(this._roomReloadClearTimer);
                }
                this._roomReloadClearTimer = setTimeout(() => {
                    this._roomReloadClearTimer = null;
                    this._roomReloadInProgress = false;
                }, delayMs);
            }

            getCurrentRoomId() {
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                    return boardContext?.selectedMap?.roomId
                        || boardContext?.selectedMap?.selectedRoom?.id
                        || null;
                } catch (_) {
                    return null;
                }
            }

            navigateToRoom(roomId) {
                if (!roomId || !globalThis.state?.board?.send) return false;
                try {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Navigating to roomId:`, roomId);
                    globalThis.state.board.send({ type: 'selectRoomById', roomId });
                    return true;
                } catch (error) {
                    console.error('[Custom Battles] Error navigating to room:', error);
                    return false;
                }
            }

            findBounceRoomId(excludeRoomId) {
                const excluded = String(excludeRoomId || '');
                try {
                    const roomNames = globalThis.state?.utils?.ROOM_NAME;
                    // Prefer Sewers so same-map win/loss refresh is consistent and fast.
                    if (roomNames && typeof roomNames === 'object') {
                        for (const [roomId, name] of Object.entries(roomNames)) {
                            if (String(roomId) === excluded) continue;
                            if (String(name) === 'Sewers' || String(roomId) === 'sewers') {
                                return roomId;
                            }
                        }
                    }
                    if (excluded !== 'sewers') return 'sewers';

                    const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                    const regionRooms = boardContext?.selectedMap?.selectedRegion?.rooms;
                    if (Array.isArray(regionRooms)) {
                        for (const room of regionRooms) {
                            const id = room?.id || room?.roomId || room;
                            if (id && String(id) !== excluded) return id;
                        }
                    }

                    if (roomNames && typeof roomNames === 'object') {
                        for (const roomId of Object.keys(roomNames)) {
                            if (String(roomId) !== excluded) return roomId;
                        }
                    }
                } catch (_) {
                    // ignore
                }
                return excluded !== 'sewers' ? 'sewers' : null;
            }

            /** @deprecated Use findBounceRoomId */
            findSameRegionBounceRoomId(excludeRoomId) {
                return this.findBounceRoomId(excludeRoomId);
            }

            /**
             * Force-select a room. If already there, briefly bounce via Sewers (or another room)
             * then return so the board DOM rebuilds.
             */
            reloadConfiguredRoom({
                roomId = null,
                forceSameRoomRefresh = true,
                bounceDelayMs = 16,
                onArrived = null
            } = {}) {
                const targetRoomId = roomId || this.config.roomId;
                if (!targetRoomId) return false;

                const currentRoomId = this.getCurrentRoomId();
                const needsBounce = forceSameRoomRefresh && String(currentRoomId) === String(targetRoomId);
                const bounceRoomId = needsBounce ? this.findBounceRoomId(targetRoomId) : null;
                const outDelay = Math.max(0, Number(bounceDelayMs) || 0);
                const backDelay = Math.max(0, outDelay);

                this.beginRoomReload();

                const finish = () => {
                    this.endRoomReload();
                    if (typeof onArrived === 'function') {
                        try {
                            onArrived(targetRoomId);
                        } catch (error) {
                            console.error('[Custom Battles] Error in reloadConfiguredRoom onArrived:', error);
                        }
                    }
                };

                if (bounceRoomId) {
                    console.log(
                        `[Custom Battles][${this.config.name || 'Battle'}] Same-room refresh via bounce`,
                        { from: targetRoomId, bounce: bounceRoomId, outDelay, backDelay }
                    );
                    this.navigateToRoom(bounceRoomId);
                    setTimeout(() => {
                        this.navigateToRoom(targetRoomId);
                        setTimeout(finish, backDelay);
                    }, outDelay);
                    return true;
                }

                this.navigateToRoom(targetRoomId);
                setTimeout(finish, Math.max(16, backDelay));
                return true;
            }

            /**
             * After a room reload, re-run entry villain/ally setup and DOM locks/outfits.
             */
            reapplyCustomizationsAfterRoomReload({ isActiveCheck, onComplete, attemptDelays } = {}) {
                this.resetSandboxBattleState();
                this.resetEntryVillainSetup();
                this.scheduleEntryVillainSetup({
                    attemptDelays: attemptDelays || [50, 100, 200, 400, 800, 1600],
                    isActiveCheck: isActiveCheck || this.activationCallback,
                    onComplete: () => {
                        this.rescheduleCustomPieceDomSync('room reload reapply');
                        if (typeof onComplete === 'function') onComplete();
                    }
                });
            }

            reloadConfiguredRoomAndReapply(options = {}) {
                const {
                    roomId = null,
                    forceSameRoomRefresh = true,
                    bounceDelayMs = 16,
                    isActiveCheck,
                    onComplete,
                    attemptDelays
                } = options;

                return this.reloadConfiguredRoom({
                    roomId,
                    forceSameRoomRefresh,
                    bounceDelayMs,
                    onArrived: () => {
                        this.reapplyCustomizationsAfterRoomReload({
                            isActiveCheck,
                            onComplete,
                            attemptDelays
                        });
                    }
                });
            }

            cancelSceneSpriteReplacementTimer() {
                if (this.sceneSpriteReplacementTimer) {
                    clearTimeout(this.sceneSpriteReplacementTimer);
                    this.sceneSpriteReplacementTimer = null;
                }
            }

            /**
             * One-shot villain swap when entering a quest room (Banshee / Putrid / Spider Lair pattern).
             * Returns true when setup ran.
             */
            performEntryVillainSetup({ isActiveCheck } = {}) {
                if (this.entryVillainSetupDone || this.isBoardBattleActive()) {
                    return false;
                }
                if (typeof isActiveCheck === 'function' && !isActiveCheck()) {
                    return false;
                }
                if (!this.isInBattleArea()) {
                    return false;
                }

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] One-shot entry villain setup`);
                hideBetterHighscoresForCustomBattle();
                hideRoomInfoOverlayForCustomBattle();
                this.removeOriginalVillains();
                this.entryVillainSetupDone = true;
                this.scheduleVillainOutfitSpriteOverrides({ force: true });

                const deferReady = this.config.entrySetup?.deferPlacementReady !== false;
                if (deferReady) {
                    this.markCustomVillainPlacementReady(true);
                }

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Entry villain setup complete`);
                return true;
            }

            /**
             * Immediate entry setup if not done yet (overlay / room-enter path).
             */
            runEntryVillainSetupIfNeeded({ isActiveCheck, onComplete } = {}) {
                if (this.performEntryVillainSetup({ isActiveCheck })) {
                    if (typeof onComplete === 'function') {
                        onComplete();
                    }
                    return true;
                }
                return false;
            }

            /**
             * Delayed entry setup — tries immediately, then retries until the room is ready.
             */
            scheduleEntryVillainSetup({ delayMs, attemptDelays, isActiveCheck, onComplete } = {}) {
                this.cancelEntryVillainSetupTimer();
                this.markCustomVillainPlacementReady(false);

                const delays = attemptDelays
                    ?? this.config.entrySetup?.attemptDelays
                    ?? [delayMs ?? this.config.entrySetup?.delayMs ?? 0];

                let attemptIndex = 0;
                const scheduleAttempt = () => {
                    if (this.entryVillainSetupDone) return;
                    if (attemptIndex >= delays.length) return;

                    const delay = delays[attemptIndex++];
                    const fire = () => {
                        this.entryVillainSetupTimer = null;
                        if (this.entryVillainSetupDone) return;
                        if (this.runEntryVillainSetupIfNeeded({ isActiveCheck, onComplete })) return;
                        scheduleAttempt();
                    };

                    if (delay > 0) {
                        this.entryVillainSetupTimer = setTimeout(fire, delay);
                    } else {
                        queueMicrotask(fire);
                    }
                };

                scheduleAttempt();
            }

            /**
             * Re-add custom villains when missing after battle (Banshee / Spider Lair fallback).
             */
            ensureCustomVillainsPresent() {
                if (this.isBoardBattleActive() || this.hasCustomVillainsOnBoard()) {
                    return false;
                }
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Custom villains missing - re-adding`);
                this.addVillains();
                return true;
            }

            hasOriginalVillainsOnBoard() {
                try {
                    const boardConfig = globalThis.state.board.getSnapshot().context.boardConfig || [];
                    return boardConfig.some((entity) => {
                        if (!entity?.villain) return false;
                        if (!entity.key) return true;
                        return !this.villainKeyPrefixes.some(({ prefix }) => entity.key.startsWith(prefix));
                    });
                } catch (error) {
                    return false;
                }
            }

            runLockedBoardSetup(callback) {
                this.boardSetupLock = true;
                try {
                    callback();
                } finally {
                    setTimeout(() => {
                        this.boardSetupLock = false;
                    }, 50);
                }
            }

            /**
             * Check if restrictions should be active
             */
            shouldRestrictionsBeActive(activationCallback) {
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
                    const isSandbox = boardContext?.mode === 'sandbox';
                    const inBattleArea = this.isInBattleArea();
                    
                    if (this.config.activationCheck) {
                        return this.config.activationCheck(isSandbox, inBattleArea);
                    }
                    
                    // Default: require sandbox mode and in battle area
                    return isSandbox && inBattleArea && (activationCallback ? activationCallback() : true);
                } catch (error) {
                    console.error('[Custom Battles] Error checking restriction activation:', error);
                    return false;
                }
            }

            /**
             * Count ally creatures on board
             */
            countAllyCreatures() {
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
                    const boardConfig = boardContext?.boardConfig || [];
                    
                    const isAlly = (piece) => 
                        piece?.type === 'player' || 
                        (piece?.type === 'custom' && piece?.villain === false);
                    
                    return boardConfig.filter(isAlly).length;
                } catch (error) {
                    console.error('[Custom Battles] Error counting allies:', error);
                    return 0;
                }
            }

            /**
             * Build one custom villain entity for the board (fresh key each call).
             */
            createCustomVillainEntity(villainConfig) {
                const prefix = villainConfig.keyPrefix || `${villainConfig.nickname?.toLowerCase() || 'villain'}-tile-${villainConfig.tileIndex}-`;
                let key;
                if (prefix.includes(`-${villainConfig.tileIndex}-`) || prefix.endsWith(`-${villainConfig.tileIndex}-`)) {
                    key = prefix + Date.now() + Math.random();
                } else {
                    key = `${prefix}${villainConfig.tileIndex}-${Date.now()}-${Math.random()}`;
                }

                return applyVillainAwakenFromConfig({
                    type: "custom",
                    key: key,
                    nickname: villainConfig.nickname,
                    name: villainConfig.nickname || undefined,
                    tileIndex: villainConfig.tileIndex,
                    villain: true,
                    gameId: villainConfig.gameId,
                    direction: villainConfig.direction || "south",
                    level: villainConfig.level || 1,
                    tier: villainConfig.tier || 0,
                    equip: villainConfig.equip || null,
                    ...(villainConfig.shiny === true ? { shiny: true } : {}),
                    ...(villainConfig.outfitSpriteId != null ? { outfitSpriteId: villainConfig.outfitSpriteId } : {}),
                    genes: villainConfig.genes || {
                        hp: 1,
                        ad: 1,
                        ap: 1,
                        armor: 1,
                        magicResist: 1
                    }
                }, villainConfig);
            }

            createCustomAllyEntity(allyConfig) {
                const prefix = allyConfig.keyPrefix || `${allyConfig.nickname?.toLowerCase() || 'ally'}-tile-${allyConfig.tileIndex}-`;
                let key;
                if (prefix.includes(`-${allyConfig.tileIndex}-`) || prefix.endsWith(`-${allyConfig.tileIndex}-`)) {
                    key = prefix + Date.now() + Math.random();
                } else {
                    key = `${prefix}${allyConfig.tileIndex}-${Date.now()}-${Math.random()}`;
                }

                return {
                    type: 'custom',
                    key,
                    nickname: allyConfig.nickname,
                    name: allyConfig.nickname || undefined,
                    tileIndex: allyConfig.tileIndex,
                    villain: false,
                    customForcedAlly: true,
                    removable: false,
                    gameId: allyConfig.gameId,
                    direction: allyConfig.direction || 'south',
                    level: allyConfig.level || 1,
                    tier: allyConfig.tier || 0,
                    equip: allyConfig.equip || null,
                    ...(allyConfig.shiny === true ? { shiny: true } : {}),
                    ...(allyConfig.outfitSpriteId != null ? { outfitSpriteId: allyConfig.outfitSpriteId } : {}),
                    genes: allyConfig.genes || {
                        hp: 1,
                        ad: 1,
                        ap: 1,
                        armor: 1,
                        magicResist: 1
                    }
                };
            }

            isForcedAllyEntity(entity) {
                if (!entity?.key || entity.villain) return false;
                return this.allyKeyPrefixes.some(({ prefix, tileIndex, hasTileInPrefix }) => {
                    if (hasTileInPrefix) return entity.key.startsWith(prefix);
                    return entity.key.startsWith(prefix) && entity.tileIndex === tileIndex;
                });
            }

            buildForcedAllyEntities() {
                return (this.config.allies || []).map((allyConfig) => {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Adding forced ally ${allyConfig.nickname || 'ally'} to tile ${allyConfig.tileIndex}`);
                    return this.createCustomAllyEntity(allyConfig);
                });
            }

            hasAllForcedAlliesOnBoard(boardConfig = null) {
                const config = boardConfig || globalThis.state?.board?.getSnapshot?.()?.context?.boardConfig || [];
                if (!this.allyKeyPrefixes.length) return true;
                return this.allyKeyPrefixes.every(({ prefix, tileIndex, hasTileInPrefix }) => {
                    return config.some((entity) => {
                        if (!entity?.key || entity.villain) return false;
                        if (hasTileInPrefix) return entity.key.startsWith(prefix);
                        return entity.key.startsWith(prefix) && entity.tileIndex === tileIndex;
                    });
                });
            }

            ensureForcedAlliesPresent() {
                if (this.isBoardBattleActive() || !this.allyKeyPrefixes.length) return false;
                if (this.hasAllForcedAlliesOnBoard()) return false;
                if (this.boardSetupLock) return false;

                this.runLockedBoardSetup(() => {
                    try {
                        const boardContext = globalThis.state.board.getSnapshot().context;
                        const boardConfig = boardContext.boardConfig || [];
                        const withoutForced = boardConfig.filter((entity) => !this.isForcedAllyEntity(entity));
                        const forcedAllies = this.buildForcedAllyEntities();
                        globalThis.state.board.send({
                            type: 'setState',
                            fn: (prev) => ({
                                ...prev,
                                boardConfig: [...withoutForced, ...forcedAllies]
                            })
                        });
                        this.scheduleVillainOutfitSpriteOverrides({ force: true });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Restored forced allies`);
                    } catch (error) {
                        console.error('[Custom Battles] Error restoring forced allies:', error);
                    }
                });
                return true;
            }

            getConfiguredCustomPieceTiles() {
                const tiles = [];
                (this.config.villains || []).forEach((villain) => {
                    if (villain?.tileIndex != null) tiles.push(Number(villain.tileIndex));
                });
                (this.config.allies || []).forEach((ally) => {
                    if (ally?.tileIndex != null) tiles.push(Number(ally.tileIndex));
                });
                return [...new Set(tiles.filter((tileIndex) => Number.isFinite(tileIndex)))];
            }

            findBoardPieceButtonsForTile(tileIndex) {
                const matched = new Set();
                const tile = document.getElementById(`tile-index-${tileIndex}`);
                const tileBottom = tile?.style?.bottom || '';
                const tileRight = tile?.style?.right || '';
                const col = Number(tileIndex) % 15;
                const row = Math.floor(Number(tileIndex) / 15);
                const expectedTranslate = `calc(${col * 32}px * var(--zoomFactor)) calc(${row * 32}px * var(--zoomFactor))`;

                document.querySelectorAll('button[aria-roledescription="draggable"]').forEach((button) => {
                    if (tileBottom && tileRight
                        && button.style.bottom === tileBottom
                        && button.style.right === tileRight) {
                        matched.add(button);
                        return;
                    }
                    const translate = button.style.translate || '';
                    if (translate === expectedTranslate || translate.startsWith(expectedTranslate)) {
                        matched.add(button);
                    }
                });

                return [...matched];
            }

            findBoardPieceButtonForTile(tileIndex) {
                const buttons = this.findBoardPieceButtonsForTile(tileIndex);
                return buttons[0] || null;
            }

            lockCustomPieceButton(button) {
                if (!button) return false;

                const alreadyLocked = button.dataset.customBattleLocked === '1'
                    && button.disabled
                    && button.getAttribute('aria-disabled') === 'true'
                    && button.style.pointerEvents === 'none';

                if (!alreadyLocked) {
                    button.disabled = true;
                    button.setAttribute('disabled', '');
                    button.setAttribute('aria-disabled', 'true');
                    button.setAttribute('tabindex', '-1');
                    button.style.pointerEvents = 'none';
                    button.style.cursor = 'default';
                    button.dataset.customBattleLocked = '1';
                }

                if (!button._customBattleLockHandler) {
                    const blockEvent = (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        if (typeof event.stopImmediatePropagation === 'function') {
                            event.stopImmediatePropagation();
                        }
                        return false;
                    };
                    button._customBattleLockHandler = blockEvent;
                    ['pointerdown', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dragstart', 'click', 'contextmenu', 'keydown'].forEach((eventName) => {
                        button.addEventListener(eventName, blockEvent, true);
                    });
                }
                return true;
            }

            getConfiguredCustomPieces() {
                return [...(this.config.villains || []), ...(this.config.allies || [])]
                    .filter((piece) => piece && piece.gameId != null && Number.isFinite(Number(piece.tileIndex)));
            }

            /**
             * Board/DOM outfit class often differs from combat gameId (e.g. Dharalion
             * gameId 79 renders as id-63). Never require combat id on the sprite.
             * Identify custom pieces by spawn tile, unique nickname, or our patch tag.
             */
            tagCustomPieceSprite(sprite, piece) {
                if (!sprite || !piece || piece.gameId == null) return;
                sprite.dataset.customBattlePiece = '1';
                sprite.dataset.customBattleCombatId = String(piece.gameId);
                if (piece.outfitSpriteId != null) {
                    sprite.dataset.customBattleOutfitId = String(piece.outfitSpriteId);
                }
                if (piece.nickname) {
                    sprite.dataset.customBattleNickname = String(piece.nickname).trim();
                }
            }

            isAmbiguousCustomNickname(nickname, piece) {
                const nick = nickname && String(nickname).trim();
                if (!nick) return true;
                // Multi-word or custom high sprite ids are unique enough (Sheng, Rookstayer).
                if (/\s/.test(nick)) return false;
                if (piece?.outfitSpriteId != null && Number(piece.outfitSpriteId) >= 1000) return false;
                // Short species-like names (e.g. "Minotaur") can collide with player creatures.
                return piece?.outfitSpriteId != null
                    && String(piece.outfitSpriteId) !== String(piece.gameId);
            }

            spriteBelongsToCustomPiece(sprite, piece) {
                if (!sprite?.classList || !piece || piece.gameId == null) return false;

                if (sprite.dataset.customBattlePiece === '1') {
                    if (sprite.dataset.customBattleCombatId !== String(piece.gameId)) {
                        return false;
                    }
                    if (piece.outfitSpriteId != null
                        && sprite.dataset.customBattleOutfitId
                        && sprite.dataset.customBattleOutfitId !== String(piece.outfitSpriteId)) {
                        return false;
                    }
                    return true;
                }

                const nickname = piece.nickname && String(piece.nickname).trim();
                const root = sprite.closest?.('[data-name]') || sprite.parentElement?.closest?.('[data-name]');
                const name = (root?.getAttribute('data-name') || '').trim();

                // Mid-battle: resurrect/rebuild drops our dataset tags and often leaves the
                // spawn tile. Reclaim by display name so outfit overrides re-apply immediately.
                if (this.isBoardBattleActive() && nickname && name === nickname) {
                    return true;
                }

                if (!this.spriteIsOnConfiguredTile(sprite, piece.tileIndex)) return false;

                // Named actors must match the configured nickname. Otherwise a player
                // unit stepping onto a dead villain spawn tile would be claimed.
                if (name) {
                    return !!nickname && name === nickname;
                }

                // Empty name is only valid during setup (spawn tiles are reserved).
                if (this.isBoardBattleActive()) return false;

                return true;
            }

            spriteIsOnConfiguredTile(sprite, tileIndex) {
                const tile = Number(tileIndex);
                if (!Number.isFinite(tile)) return false;

                const boardTile = document.getElementById(`tile-index-${tile}`);
                if (boardTile?.contains?.(sprite)) return true;

                const tileBottom = boardTile?.style?.bottom || '';
                const tileRight = boardTile?.style?.right || '';
                const hostButton = sprite.closest?.('button[aria-roledescription="draggable"]');
                if (hostButton && tileBottom && tileRight
                    && hostButton.style.bottom === tileBottom
                    && hostButton.style.right === tileRight) {
                    return true;
                }

                const col = tile % 15;
                const row = Math.floor(tile / 15);
                const expectedTranslate = `calc(${col * 32}px * var(--zoomFactor)) calc(${row * 32}px * var(--zoomFactor))`;
                const host = sprite.closest?.('.size-scaled-sprite') || sprite.parentElement;
                const translate = host?.style?.translate || sprite.style?.translate || '';
                return translate === expectedTranslate || translate.startsWith(expectedTranslate);
            }

            buttonBelongsToCustomPiece(button, piece) {
                if (!button || !piece) return false;
                // Spawn tiles are reserved for configured pieces — lock by tile during setup.
                if (this.spriteIsOnConfiguredTile(button, piece.tileIndex)
                    || (button.querySelector?.('.sprite.outfit')
                        && [...button.querySelectorAll('.sprite.outfit')]
                            .some((sprite) => this.spriteIsOnConfiguredTile(sprite, piece.tileIndex)))) {
                    return true;
                }
                return [...button.querySelectorAll('.sprite.outfit')]
                    .some((sprite) => this.spriteBelongsToCustomPiece(sprite, piece));
            }

            applyCustomPieceInteractionLocks() {
                const pieces = this.getConfiguredCustomPieces();
                if (!pieces.length) return 0;

                let locked = 0;
                pieces.forEach((piece) => {
                    this.findBoardPieceButtonsForTile(piece.tileIndex).forEach((button) => {
                        if (!this.buttonBelongsToCustomPiece(button, piece)) return;
                        if (this.lockCustomPieceButton(button)) locked++;
                    });
                });
                return locked;
            }

            getCustomPieceIdentitySets() {
                const pieces = this.getConfiguredCustomPieces();
                const uniqueNicknames = new Set();
                const spawnTranslates = new Set();

                pieces.forEach((piece) => {
                    const nickname = piece?.nickname && String(piece.nickname).trim();
                    if (nickname && !this.isAmbiguousCustomNickname(nickname, piece)) {
                        uniqueNicknames.add(nickname);
                    }

                    const tileIndex = Number(piece?.tileIndex);
                    if (!Number.isFinite(tileIndex)) return;
                    const col = tileIndex % 15;
                    const row = Math.floor(tileIndex / 15);
                    spawnTranslates.add(
                        `calc(${col * 32}px * var(--zoomFactor)) calc(${row * 32}px * var(--zoomFactor))`
                    );
                });

                return { uniqueNicknames, spawnTranslates };
            }

            isCustomPieceActorRoot(root) {
                if (!root) return false;

                if (root.querySelector?.('.sprite.outfit[data-custom-battle-piece="1"]')) {
                    return true;
                }

                const name = (root.getAttribute('data-name') || '').trim();
                const sets = this.getCustomPieceIdentitySets();
                if (name && sets.uniqueNicknames.has(name)) return true;

                // Ambiguous nicknames (Minotaur): only while still on a configured spawn tile,
                // or after we've tagged the outfit sprite.
                for (const piece of this.getConfiguredCustomPieces()) {
                    const nickname = piece?.nickname && String(piece.nickname).trim();
                    if (!nickname || name !== nickname) continue;
                    if (!this.isAmbiguousCustomNickname(nickname, piece)) return true;
                    if (this.spriteIsOnConfiguredTile(root, piece.tileIndex)) return true;
                    const outfit = root.querySelector?.('.sprite.outfit');
                    if (outfit && this.spriteBelongsToCustomPiece(outfit, piece)) return true;
                }
                return false;
            }

            hideBattleControlElement(el) {
                if (!el || el.dataset.customBattleControlHidden === '1') return false;
                el.dataset.customBattleControlHidden = '1';
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                if (el.tagName === 'BUTTON') {
                    el.disabled = true;
                    el.setAttribute('aria-disabled', 'true');
                    el.setAttribute('tabindex', '-1');
                }
                return true;
            }

            /**
             * During combat the game adds clickable actor-button hitboxes and item
             * overlays (id-23483). Hide those on custom villains + forced allies.
             */
            hideCustomPieceBattleControls() {
                const pieces = this.getConfiguredCustomPieces();
                if (!pieces.length) return 0;

                const identitySets = this.getCustomPieceIdentitySets();
                const customTranslates = new Set(identitySets.spawnTranslates);
                let hidden = 0;

                document.querySelectorAll('[data-name]').forEach((root) => {
                    if (!this.isCustomPieceActorRoot(root)) return;

                    root.querySelectorAll('button.actor-button').forEach((button) => {
                        if (this.hideBattleControlElement(button)) hidden++;
                    });

                    root.querySelectorAll('.size-scaled-sprite').forEach((node) => {
                        const translate = node.style.translate || '';
                        if (translate) customTranslates.add(translate);
                    });

                    const rootTranslate = root.style.translate || '';
                    if (rootTranslate) customTranslates.add(rootTranslate);
                });

                document.querySelectorAll('.sprite.item.id-23483').forEach((sprite) => {
                    const host = sprite.closest('.size-scaled-sprite') || sprite.parentElement;
                    const translate = host?.style?.translate || sprite.style.translate || '';
                    const matchesTranslate = translate && [...customTranslates].some(
                        (expected) => translate === expected || translate.startsWith(expected)
                    );
                    if (!matchesTranslate) return;

                    // Only hide item overlays that sit on a configured custom piece.
                    const outfitHost = host?.querySelector?.('.sprite.outfit') || host?.closest?.('[data-name]');
                    const root = outfitHost?.closest?.('[data-name]') || host?.closest?.('[data-name]');
                    if (root && !this.isCustomPieceActorRoot(root)) return;
                    if (!root) {
                        const outfit = (host || sprite.parentElement)?.querySelector?.('.sprite.outfit');
                        const belongs = outfit && pieces.some((piece) => this.spriteBelongsToCustomPiece(outfit, piece));
                        if (!belongs) return;
                    }

                    if (this.hideBattleControlElement(host || sprite)) hidden++;
                });

                return hidden;
            }

            getConfiguredNamedPieces() {
                const villains = (this.config.villains || [])
                    .filter((piece) => piece?.nickname && String(piece.nickname).trim())
                    .map((piece) => ({ piece, isVillain: true }));
                const allies = (this.config.allies || [])
                    .filter((piece) => piece?.nickname && String(piece.nickname).trim())
                    .map((piece) => ({ piece, isVillain: false }));
                return [...villains, ...allies];
            }

            getActiveBattleWorld(world = null) {
                if (world?.grid?.actors) return world;
                try {
                    const ctx = globalThis.state?.board?.getSnapshot?.()?.context;
                    if (ctx?.world?.grid?.actors) return ctx.world;
                } catch (_) { /* ignore */ }
                return null;
            }

            getActorGameId(actor) {
                const raw = actor?.gameId ?? actor?.monsterId ?? actor?.metadata?.id ?? actor?.metadata?.gameId;
                const gameId = Number(raw);
                return Number.isFinite(gameId) ? gameId : null;
            }

            getActorTileIndex(actor) {
                const raw = actor?.position?.tile?.index
                    ?? actor?.position?.tileIndex
                    ?? actor?.tileIndex
                    ?? actor?.spawnTileIndex
                    ?? actor?.initialTileIndex;
                const tileIndex = Number(raw);
                return Number.isFinite(tileIndex) ? tileIndex : null;
            }

            actorMatchesNamedPiece(actor, pieceConfig, isVillain) {
                if (!actor || !pieceConfig) return false;
                if ((actor.villain === true) !== !!isVillain) return false;

                const expectedGameId = Number(pieceConfig.gameId);
                const actorGameId = this.getActorGameId(actor);
                if (Number.isFinite(expectedGameId) && actorGameId !== expectedGameId) return false;

                // Setup: bind each piece to its spawn tile. Mid-battle actors move / revive
                // off-tile — match by combat identity only so nicknames stay applied.
                if (!this.isBoardBattleActive()) {
                    const expectedTile = Number(pieceConfig.tileIndex);
                    const actorTile = this.getActorTileIndex(actor);
                    if (Number.isFinite(expectedTile)
                        && Number.isFinite(actorTile)
                        && actorTile !== expectedTile) {
                        return false;
                    }
                }

                return true;
            }

            /**
             * Custom villains already get nickname → outlined HUD names from the game.
             * Custom allies keep the species name (e.g. Orc Warrior). Force actor.name so
             * React renders nicknames through the same outlined-font path as Sheng/Minotaur.
             */
            applyConfiguredActorDisplayNames(world = null) {
                const namedPieces = this.getConfiguredNamedPieces();
                if (!namedPieces.length) return 0;

                const battleWorld = this.getActiveBattleWorld(world);
                const actors = battleWorld?.grid?.actors;
                if (!Array.isArray(actors) || !actors.length) return 0;

                let patched = 0;
                namedPieces.forEach(({ piece, isVillain }) => {
                    const displayName = String(piece.nickname).trim();
                    actors.forEach((actor) => {
                        if (!this.actorMatchesNamedPiece(actor, piece, isVillain)) return;
                        const current = String(actor.name || actor.nickname || '').trim();
                        if (current === displayName) return;

                        try {
                            actor.name = displayName;
                            actor.nickname = displayName;
                            if (actor.metadata && typeof actor.metadata === 'object') {
                                actor.metadata.name = displayName;
                            }
                            patched++;
                        } catch (error) {
                            console.warn(
                                `[Custom Battles][${this.config.name || 'Battle'}] Failed to set actor display name`,
                                error
                            );
                        }
                    });
                });

                if (patched) {
                    console.log(
                        `[Custom Battles][${this.config.name || 'Battle'}] Applied ${patched} actor display name(s)`
                    );
                }
                return patched;
            }

            scheduleConfiguredActorDisplayNames(world = null, reason = '') {
                if (!this.getConfiguredNamedPieces().length) return;
                if (reason) {
                    console.log(
                        `[Custom Battles][${this.config.name || 'Battle'}] Scheduling actor display names (${reason})`
                    );
                }
                const delays = [0, 16, 50, 100, 200, 400];
                delays.forEach((delay) => {
                    setTimeout(() => this.applyConfiguredActorDisplayNames(world), delay);
                });
            }

            syncCustomPieceDom() {
                // Keep forced nicknames on world actors so resurrected DOM nodes still
                // expose data-name for outfit reclaim (e.g. Minotaur after Fiendish revive).
                if (this.isBoardBattleActive()) {
                    this.applyConfiguredActorDisplayNames();
                }
                this.applyVillainOutfitSpriteOverrides();
                this.applyCustomPieceInteractionLocks();
                this.hideCustomPieceBattleControls();
            }

            rescheduleCustomPieceDomSync(reason = '') {
                const hasOutfitOverrides = this.getOutfitSpriteOverrides().length > 0;
                const hasCustomPieces = this.getConfiguredCustomPieceTiles().length > 0;
                if (!hasOutfitOverrides && !hasCustomPieces) return;
                if (reason) {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Re-applying custom piece DOM sync (${reason})`);
                }
                this.scheduleVillainOutfitSpriteOverrides({ force: true });
            }

            getOutfitSpriteOverrides() {
                const villains = (this.config.villains || []).filter((villainConfig) => {
                    const outfitSpriteId = villainConfig.outfitSpriteId;
                    return outfitSpriteId != null && String(outfitSpriteId) !== String(villainConfig.gameId);
                });
                const allies = (this.config.allies || []).filter((allyConfig) => {
                    const outfitSpriteId = allyConfig.outfitSpriteId;
                    return outfitSpriteId != null && String(outfitSpriteId) !== String(allyConfig.gameId);
                });
                return [...villains, ...allies];
            }

            /** @deprecated Use getOutfitSpriteOverrides */
            getVillainOutfitSpriteOverrides() {
                return this.getOutfitSpriteOverrides();
            }

            getOutfitOverrideDedupeKey(piece) {
                return [
                    String(piece?.gameId ?? ''),
                    String(piece?.outfitSpriteId ?? ''),
                    piece?.shiny === true ? '1' : '0'
                ].join('|');
            }

            escapeCssAttrValue(value) {
                const raw = String(value ?? '');
                if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
                    return CSS.escape(raw);
                }
                return raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            }

            /**
             * Collect outfit sprites for one custom piece.
             * Order: already tagged → display-name reclaim → spawn tile/translate.
             * Callers still filter with spriteBelongsToCustomPiece.
             */
            findOutfitSpritesForPiece(piece) {
                const matched = new Set();
                if (!piece || piece.gameId == null || piece.outfitSpriteId == null) return matched;

                const combatGameId = String(piece.gameId);
                const toId = String(piece.outfitSpriteId);

                document.querySelectorAll(
                    `.sprite.outfit[data-custom-battle-piece="1"][data-custom-battle-combat-id="${combatGameId}"][data-custom-battle-outfit-id="${toId}"]`
                ).forEach((sprite) => matched.add(sprite));

                const nickname = piece.nickname && String(piece.nickname).trim();
                if (nickname) {
                    const safeName = this.escapeCssAttrValue(nickname);
                    document.querySelectorAll(`[data-name="${safeName}"] .sprite.outfit`).forEach((sprite) => {
                        matched.add(sprite);
                    });
                }

                const tileIndex = Number(piece.tileIndex);
                if (!Number.isFinite(tileIndex)) return matched;

                const tile = document.getElementById(`tile-index-${tileIndex}`);
                if (tile) {
                    tile.querySelectorAll('.sprite.outfit').forEach((sprite) => matched.add(sprite));
                }

                const tileBottom = tile?.style?.bottom || '';
                const tileRight = tile?.style?.right || '';
                if (tileBottom && tileRight) {
                    document.querySelectorAll('button[aria-roledescription="draggable"]').forEach((button) => {
                        if (button.style.bottom !== tileBottom || button.style.right !== tileRight) return;
                        button.querySelectorAll('.sprite.outfit').forEach((sprite) => matched.add(sprite));
                    });
                }

                const col = tileIndex % 15;
                const row = Math.floor(tileIndex / 15);
                const expectedTranslate = `calc(${col * 32}px * var(--zoomFactor)) calc(${row * 32}px * var(--zoomFactor))`;
                document.querySelectorAll('.size-scaled-sprite').forEach((node) => {
                    if (node.id && node.id.startsWith('tile-index-') && node.id !== `tile-index-${tileIndex}`) {
                        return;
                    }
                    const translate = node.style.translate || '';
                    if (translate !== expectedTranslate && !translate.startsWith(expectedTranslate)) return;
                    node.querySelectorAll('.sprite.outfit').forEach((sprite) => matched.add(sprite));
                });

                return matched;
            }

            /**
             * Apply outfit id + shiny only. Never sets moving sheet URLs — the game
             * picks idle/moving from classes. Facing/idle locked only during setup.
             */
            applyOutfitVisualToSprite(sprite, piece) {
                if (!sprite?.classList || !piece || piece.outfitSpriteId == null) return false;

                let changed = false;
                const toId = String(piece.outfitSpriteId);
                this.tagCustomPieceSprite(sprite, piece);

                const previousIdClass = Array.from(sprite.classList).find((cls) => /^id-\d+$/.test(cls));
                if (!sprite.classList.contains(`id-${toId}`)) {
                    if (previousIdClass) {
                        sprite.classList.remove(previousIdClass);
                        piece._lastRenderedOutfitId = previousIdClass.replace(/^id-/, '');
                    }
                    sprite.classList.add(`id-${toId}`);
                    changed = true;
                }

                const facing = String(piece.direction || '').toLowerCase();
                const lockFacing = !this.isBoardBattleActive()
                    && (facing === 'north' || facing === 'south' || facing === 'east' || facing === 'west');
                if (lockFacing) {
                    ['north', 'south', 'east', 'west'].forEach((dir) => {
                        if (sprite.classList.contains(dir) && dir !== facing) {
                            sprite.classList.remove(dir);
                            changed = true;
                        }
                    });
                    if (!sprite.classList.contains(facing)) {
                        sprite.classList.add(facing);
                        changed = true;
                    }
                    if (!sprite.classList.contains('idle')) {
                        sprite.classList.add('idle');
                        changed = true;
                    }
                }

                if (piece.shiny === true) {
                    const img = sprite.querySelector('img.spritesheet, img.actor, .viewport img');
                    if (img) {
                        if (!img.classList.contains('actor')) {
                            img.classList.add('actor');
                            changed = true;
                        }
                        if (!img.classList.contains('spritesheet')) {
                            img.classList.add('spritesheet');
                            changed = true;
                        }
                        if (img.getAttribute('data-shiny') !== 'true') {
                            img.setAttribute('data-shiny', 'true');
                            changed = true;
                        }
                        if (lockFacing && facing && img.getAttribute('alt') !== facing) {
                            img.setAttribute('alt', facing);
                            changed = true;
                        }
                    }
                }

                return changed;
            }

            applyVillainOutfitSpriteOverrides() {
                const overrides = this.getOutfitSpriteOverrides();
                if (!overrides.length) return 0;

                // Same combat+outfit+shiny group (e.g. 4 Minotaurs) → patch once.
                const groups = new Map();
                overrides.forEach((piece) => {
                    const key = this.getOutfitOverrideDedupeKey(piece);
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(piece);
                });

                let patched = 0;
                groups.forEach((group) => {
                    const primary = group[0];
                    const combatGameId = String(primary.gameId);
                    const toId = String(primary.outfitSpriteId);
                    const matched = new Set();
                    group.forEach((piece) => {
                        this.findOutfitSpritesForPiece(piece).forEach((sprite) => matched.add(sprite));
                    });

                    let claimed = 0;
                    matched.forEach((sprite) => {
                        if (!sprite?.classList) return;
                        const owner = group.find((piece) => this.spriteBelongsToCustomPiece(sprite, piece));
                        if (!owner) return;
                        claimed++;
                        if (this.applyOutfitVisualToSprite(sprite, owner)) {
                            patched++;
                            console.log(
                                `[Custom Battles][${this.config.name || 'Battle'}] Outfit override applied:`,
                                {
                                    tileIndex: owner.tileIndex,
                                    combatGameId,
                                    to: `id-${toId}`,
                                    shiny: owner.shiny === true
                                }
                            );
                        }
                    });

                    if (!claimed) {
                        if (!this._outfitOverrideMissLogAt || Date.now() - this._outfitOverrideMissLogAt > 1000) {
                            this._outfitOverrideMissLogAt = Date.now();
                            console.log(
                                `[Custom Battles][${this.config.name || 'Battle'}] Outfit override: no sprite found yet`,
                                {
                                    tileIndex: primary.tileIndex,
                                    combatGameId,
                                    outfitSpriteId: toId,
                                    groupSize: group.length
                                }
                            );
                        }
                    }
                });
                return patched;
            }

            cancelOutfitSpriteOverrideWatch() {
                if (this.outfitSpriteOverrideTimer) {
                    clearTimeout(this.outfitSpriteOverrideTimer);
                    this.outfitSpriteOverrideTimer = null;
                }
                if (this.outfitSpriteOverrideInterval) {
                    clearInterval(this.outfitSpriteOverrideInterval);
                    this.outfitSpriteOverrideInterval = null;
                }
                if (this.outfitSpriteOverrideObserver) {
                    try {
                        this.outfitSpriteOverrideObserver.disconnect();
                    } catch (_) {
                        // no-op
                    }
                    this.outfitSpriteOverrideObserver = null;
                }
            }

            scheduleVillainOutfitSpriteOverrides({ force = false } = {}) {
                const hasOutfitOverrides = this.getOutfitSpriteOverrides().length > 0;
                const hasCustomPieces = this.getConfiguredCustomPieceTiles().length > 0;
                if (!hasOutfitOverrides && !hasCustomPieces) return;

                if (hasOutfitOverrides) {
                    console.log(
                        `[Custom Battles][${this.config.name || 'Battle'}] Scheduling outfit sprite overrides`,
                        this.getOutfitSpriteOverrides().map((v) => ({
                            tileIndex: v.tileIndex,
                            gameId: v.gameId,
                            outfitSpriteId: v.outfitSpriteId
                        }))
                    );
                }
                if (hasCustomPieces) {
                    console.log(
                        `[Custom Battles][${this.config.name || 'Battle'}] Scheduling custom piece interaction locks`,
                        this.getConfiguredCustomPieceTiles()
                    );
                }

                if (!force && this.outfitSpriteOverrideObserver) {
                    this.syncCustomPieceDom();
                    return;
                }

                this.cancelOutfitSpriteOverrideWatch();
                const delays = [0, 16, 50, 100, 200, 400, 800, 1600, 3000];
                let attempt = 0;
                const fire = () => {
                    this.outfitSpriteOverrideTimer = null;
                    this.syncCustomPieceDom();
                    if (attempt < delays.length) {
                        const delay = delays[attempt++];
                        this.outfitSpriteOverrideTimer = setTimeout(fire, delay);
                    }
                };
                fire();

                this.outfitSpriteOverrideInterval = setInterval(() => {
                    this.syncCustomPieceDom();
                }, 100);

                const observeRoot = document.body || document.documentElement;
                if (!observeRoot) return;

                this.outfitSpriteOverrideObserver = new MutationObserver(() => {
                    this.syncCustomPieceDom();
                });
                this.outfitSpriteOverrideObserver.observe(observeRoot, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['class', 'disabled', 'aria-disabled', 'style']
                });
            }

            isCustomVillainEntity(entity) {
                if (!entity?.key) return false;
                return this.villainKeyPrefixes.some(({ prefix, tileIndex, hasTileInPrefix }) => {
                    if (hasTileInPrefix) {
                        return entity.key.startsWith(prefix);
                    }
                    return entity.key.startsWith(prefix) && entity.tileIndex === tileIndex;
                });
            }

            /**
             * Add custom villains to the board
             */
            addVillains(options = {}) {
                try {
                    if (this.isBoardBattleActive()) {
                        return;
                    }
                    if (!options.force && this.boardSetupLock) {
                        return;
                    }

                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const currentBoardConfig = boardContext.boardConfig || [];

                    // Check if all villains already exist (check each villain individually)
                    const allVillainsExist = this.config.villains.every(villainConfig => {
                        const prefix = villainConfig.keyPrefix || `${villainConfig.nickname?.toLowerCase() || 'villain'}-tile-${villainConfig.tileIndex}-`;
                        // For prefixes like "elf-tile-" we need to check for the specific tile
                        if (prefix.includes(`-${villainConfig.tileIndex}-`) || prefix.endsWith(`-${villainConfig.tileIndex}-`)) {
                            return currentBoardConfig.some(entity =>
                                entity.key && entity.key.startsWith(prefix)
                            );
                        } else {
                            // Prefix doesn't include tile, check prefix and tile separately
                            return currentBoardConfig.some(entity =>
                                entity.key && entity.key.startsWith(prefix) && entity.tileIndex === villainConfig.tileIndex
                            );
                        }
                    });

                    if (allVillainsExist) {
                        return; // Skip silently to prevent refresh loop
                    }

                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Adding custom villains to board`);

                    let updatedBoardConfig = [...currentBoardConfig];
                    let addedAny = false;

                    // Add each villain if not present
                    this.config.villains.forEach(villainConfig => {
                        const prefix = villainConfig.keyPrefix || `${villainConfig.nickname?.toLowerCase() || 'villain'}-tile-${villainConfig.tileIndex}-`;
                        // Check if this villain already exists
                        // For prefixes like "elf-tile-" we need to check for the specific tile
                        const exists = currentBoardConfig.some(entity => {
                            if (!entity.key) return false;
                            // If prefix includes tile index, simple startsWith check
                            if (prefix.includes(`-${villainConfig.tileIndex}-`) || prefix.endsWith(`-${villainConfig.tileIndex}-`)) {
                                return entity.key.startsWith(prefix);
                            }
                            // Otherwise check if key matches pattern and tile index matches
                            return entity.key.startsWith(prefix) && entity.tileIndex === villainConfig.tileIndex;
                        });

                        if (!exists) {
                            const villain = this.createCustomVillainEntity(villainConfig);
                            updatedBoardConfig.push(villain);
                            addedAny = true;
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Adding ${villainConfig.nickname || 'villain'} to tile ${villainConfig.tileIndex}`);
                        }
                    });

                    // Update board if any villains were added
                    if (addedAny) {
                        globalThis.state.board.send({
                            type: 'setState',
                            fn: (prev) => ({
                                ...prev,
                                boardConfig: updatedBoardConfig
                            })
                        });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Board configuration updated with new villains`);
                        this.scheduleVillainOutfitSpriteOverrides({ force: true });
                        
                        // Set floor after board update completes
                        if (this.config.floor !== undefined) {
                            setTimeout(() => {
                                this.setFloor(this.config.floor);
                            }, 200);
                        }
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error adding villains:', error);
                }
            }

            /**
             * Replace every villain on the board with custom ones in a single atomic update.
             */
            removeOriginalVillains() {
                if (this.isBoardBattleActive()) {
                    return;
                }

                this.runLockedBoardSetup(() => {
                    try {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removing original villains from board`);

                        const boardContext = globalThis.state.board.getSnapshot().context;
                        const boardConfig = boardContext.boardConfig || [];
                        const configWithoutVillains = boardConfig.filter((entity) => !entity.villain && !this.isForcedAllyEntity(entity));
                        const customVillains = this.config.villains.map((villainConfig) => {
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Adding ${villainConfig.nickname || 'villain'} to tile ${villainConfig.tileIndex}`);
                            return this.createCustomVillainEntity(villainConfig);
                        });
                        const forcedAllies = this.buildForcedAllyEntities();
                        const updatedBoardConfig = [...configWithoutVillains, ...customVillains, ...forcedAllies];

                        if (
                            updatedBoardConfig.length !== boardConfig.length
                            || boardConfig.some((entity) => entity.villain)
                            || !this.hasAllForcedAlliesOnBoard(boardConfig)
                        ) {
                            globalThis.state.board.send({
                                type: 'setState',
                                fn: (prev) => ({
                                    ...prev,
                                    boardConfig: updatedBoardConfig
                                })
                            });

                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Original villains removed from board`);
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Board configuration updated with new villains` + (forcedAllies.length ? ` and ${forcedAllies.length} forced allies` : ''));

                            if (this.config.hideVillainSprites) {
                                const allSprites = document.querySelectorAll('[id^="tile-index-"] .sprite.item.relative');
                                let hidden = 0;
                                allSprites.forEach((sprite) => {
                                    if (sprite.closest('#actors')) return;
                                    const spriteClasses = Array.from(sprite.classList);
                                    const idClass = spriteClasses.find(cls => cls.startsWith('id-'));
                                    if (idClass) {
                                        const spriteId = idClass.replace('id-', '');
                                        const wasVillain = boardConfig.some(entity =>
                                            entity.gameId?.toString() === spriteId && entity.villain &&
                                            !this.isCustomVillainEntity(entity)
                                        );
                                        if (wasVillain) {
                                            sprite.style.display = 'none';
                                            hidden++;
                                        }
                                    }
                                });
                                if (hidden > 0) {
                                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Hidden ${hidden} villain sprites`);
                                }
                            }
                        }

                        if (this.config.floor !== undefined) {
                            setTimeout(() => {
                                this.setFloor(this.config.floor);
                            }, 300);
                        }
                    } catch (error) {
                        console.error('[Custom Battles] Error removing villains:', error);
                    }
                });
            }
            
            /**
             * Set floor level for the battle area
             */
            setFloor(floorLevel) {
                try {
                    if (floorLevel === undefined || floorLevel === null) return;
                    
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Setting floor to ${floorLevel}`);
                    globalThis.state.board.trigger.setState({
                        fn: (prev) => ({ ...prev, floor: floorLevel })
                    });
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Floor set to ${floorLevel}`);
                } catch (error) {
                    console.error('[Custom Battles] Error setting floor:', error);
                }
            }

            /**
             * Restore original board setup (remove custom villains)
             */
            restoreBoardSetup() {
                try {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Restoring original board setup`);

                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const boardConfig = boardContext.boardConfig || [];

                    // Remove custom villains
                    const restoredConfig = boardConfig.filter(entity => {
                        if (entity.key) {
                            const isCustomVillain = this.villainKeyPrefixes.some(({ prefix }) =>
                                entity.key.startsWith(prefix)
                            );
                            if (isCustomVillain) {
                                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removing custom villain:`, entity.key);
                                return false;
                            }
                        }
                        return true;
                    });

                    if (restoredConfig.length !== boardConfig.length) {
                        globalThis.state.board.send({
                            type: 'setState',
                            fn: (prev) => ({
                                ...prev,
                                boardConfig: restoredConfig
                            })
                        });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Original board setup restored`);
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error restoring board setup:', error);
                }
            }

            /**
             * Enforce ally limit if configured
             */
            enforceAllyLimit(activationCallback, showToastCallback) {
                if (!this.config.allyLimit) return;
                if (!this.shouldRestrictionsBeActive(activationCallback)) return;
                if (this.boardSetupLock || this.isBoardBattleActive()) return;
                
                try {
                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const boardConfig = boardContext.boardConfig || [];
                    
                    const isAlly = (piece) => 
                        piece?.type === 'player' || 
                        (piece?.type === 'custom' && piece?.villain === false);
                    
                    const allies = boardConfig.filter(isAlly);
                    const forcedAllies = allies.filter((piece) => this.isForcedAllyEntity(piece));
                    const playerAllies = allies.filter((piece) => !this.isForcedAllyEntity(piece));
                    const allyCount = allies.length;
                    
                    if (allyCount > this.config.allyLimit) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Ally limit exceeded: ${allyCount} > ${this.config.allyLimit}, removing excess`);
                        
                        const playerSlots = Math.max(0, this.config.allyLimit - forcedAllies.length);
                        const playerAlliesToKeep = playerAllies.slice(0, playerSlots);
                        const keysToKeep = new Set([
                            ...forcedAllies.map((ally) => ally.key),
                            ...playerAlliesToKeep.map((ally) => ally.key)
                        ]);
                        
                        const newBoardConfig = boardConfig.filter(piece => {
                            if (piece?.villain) return true;
                            if (isAlly(piece)) {
                                return keysToKeep.has(piece.key);
                            }
                            return true;
                        });
                        
                        globalThis.state.board.send({
                            type: 'setState',
                            fn: (prev) => ({
                                ...prev,
                                boardConfig: newBoardConfig
                            })
                        });
                        
                        if (showToastCallback) {
                            showToastCallback({
                                message: `Max ${this.config.allyLimit} creatures allowed`,
                                duration: 3000
                            });
                        }
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error enforcing ally limit:', error);
                }
            }

            /**
             * Setup ally limit monitoring
             */
            setupAllyLimit(activationCallback, showToastCallback) {
                if (!this.config.allyLimit) return;
                
                if (this.subscriptions.allyLimit) {
                    this.subscriptions.allyLimit.unsubscribe();
                }
                
                this.subscriptions.allyLimit = globalThis.state.board.subscribe((state) => {
                    if (this.shouldRestrictionsBeActive(activationCallback)) {
                        this.enforceAllyLimit(activationCallback, showToastCallback);
                    }
                });
                
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Ally limit monitoring set up`);
            }

            /**
             * Prevent villain movement (keep them on their assigned tiles).
             * If the board has vanilla or duplicate villains, run a full villain swap instead of stacking extras.
             */
            preventVillainMovement() {
                if (!this.tileRestrictionActive && !this.preventVillainMovementActive) return;
                if (!this.customVillainPlacementReady || this.boardSetupLock || this.isBoardBattleActive()) return;

                if (!this.isCustomVillainBoardStateValid()) {
                    this.syncCustomVillainsIfNeeded();
                    return;
                }
                
                try {
                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const boardConfig = boardContext.boardConfig || [];
                    
                    let needsRestore = false;
                    let restoredConfig = boardConfig.map(entity => {
                        if (entity.key && entity.villain) {
                            // Check each villain's expected tile and equipment
                            for (let i = 0; i < this.villainKeyPrefixes.length; i++) {
                                const { prefix, tileIndex, hasTileInPrefix } = this.villainKeyPrefixes[i];
                                let matches = false;
                                if (hasTileInPrefix) {
                                    matches = entity.key.startsWith(prefix);
                                } else {
                                    matches = entity.key.startsWith(prefix) && entity.tileIndex === tileIndex;
                                }
                                
                                if (matches) {
                                    const villainConfig = this.config.villains[i];
                                    const expectedEquip = villainConfig.equip || null;
                                    const currentEquip = entity.equip !== undefined ? entity.equip : null;
                                    const equipRemovedOrChanged = (expectedEquip != null && currentEquip === null) ||
                                        (expectedEquip != null && (currentEquip?.gameId !== expectedEquip?.gameId || currentEquip?.tier !== expectedEquip?.tier || currentEquip?.stat !== expectedEquip?.stat));
                                    if (entity.tileIndex !== tileIndex) {
                                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Villain moved from tile ${tileIndex} to ${entity.tileIndex} - restoring`);
                                        needsRestore = true;
                                        return { ...entity, tileIndex: tileIndex, equip: expectedEquip };
                                    }
                                    if (equipRemovedOrChanged) {
                                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Villain equipment removed or changed - restoring`);
                                        needsRestore = true;
                                        return { ...entity, equip: expectedEquip };
                                    }
                                    break;
                                }
                            }
                        }
                        return entity;
                    });
                    
                    if (needsRestore) {
                        globalThis.state.board.send({
                            type: 'setState',
                            fn: (prev) => ({
                                ...prev,
                                boardConfig: restoredConfig
                            })
                        });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Villain positions restored`);
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error preventing villain movement:', error);
                }
            }

            isAllyPiece(piece) {
                if (!piece || piece.villain === true) return false;
                if (piece.type === 'player') return true;
                if (piece.monsterId != null || piece.databaseId != null) return true;
                if (piece.type === 'custom' && piece.villain !== true) {
                    return !this.isCustomVillainEntity(piece);
                }
                return false;
            }

            isVillainPiece(piece) {
                if (!piece) return false;
                if (piece.villain === true) return true;
                return this.isCustomVillainEntity(piece);
            }

            getVillainOccupiedTiles() {
                const tiles = new Set();
                for (const villain of this.config.villains || []) {
                    if (villain?.tileIndex != null) {
                        tiles.add(villain.tileIndex);
                    }
                }

                try {
                    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
                    for (const entity of boardConfig) {
                        if (this.isVillainPiece(entity) && entity.tileIndex != null) {
                            tiles.add(entity.tileIndex);
                        }
                    }
                } catch (_) {}

                return tiles;
            }

            getForcedAllyOccupiedTiles() {
                const tiles = new Set();
                for (const ally of this.config.allies || []) {
                    if (ally?.tileIndex != null) {
                        tiles.add(Number(ally.tileIndex));
                    }
                }

                try {
                    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
                    for (const entity of boardConfig) {
                        if (this.isForcedAllyEntity(entity) && entity.tileIndex != null) {
                            tiles.add(Number(entity.tileIndex));
                        }
                    }
                } catch (_) {}

                return tiles;
            }

            filterSetupPreventAllyOnVillainTiles(setup, showToastCallback) {
                if (!Array.isArray(setup)) return setup;

                const villainTiles = this.getVillainOccupiedTiles();
                if (!villainTiles.size) return setup;

                let blocked = 0;
                const filtered = setup.filter((piece) => {
                    if (piece?.villain) return true;
                    if (this.isForcedAllyEntity(piece)) return true;
                    if (this.isAllyPiece(piece) && villainTiles.has(piece.tileIndex)) {
                        blocked++;
                        return false;
                    }
                    return true;
                });

                if (blocked > 0) {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Blocked ${blocked} ally placement(s) on villain tiles`);
                    if (showToastCallback) {
                        showToastCallback({
                            message: 'Ally creatures cannot be placed on villain tiles!',
                            type: 'warning',
                            duration: 3000
                        });
                    }
                }

                return filtered;
            }

            filterSetupPreventAllyOnForcedAllyTiles(setup, showToastCallback) {
                if (!Array.isArray(setup) || !(this.config.allies || []).length) return setup;

                const forcedAllyTiles = this.getForcedAllyOccupiedTiles();
                if (!forcedAllyTiles.size) return setup;

                let blocked = 0;
                const filtered = setup.filter((piece) => {
                    if (piece?.villain) return true;
                    if (this.isForcedAllyEntity(piece)) return true;
                    if (this.isAllyPiece(piece) && forcedAllyTiles.has(Number(piece.tileIndex))) {
                        blocked++;
                        return false;
                    }
                    return true;
                });

                if (blocked > 0) {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Blocked ${blocked} ally placement(s) on locked ally tiles`);
                    if (showToastCallback) {
                        showToastCallback({
                            message: 'Ally creatures cannot be placed on locked ally tiles!',
                            type: 'warning',
                            duration: 3000
                        });
                    }
                }

                return filtered;
            }

            getAllowedPlayerTiles() {
                const allowed = this.config.tileRestrictions?.allowedTiles;
                if (!Array.isArray(allowed) || !allowed.length) return null;
                return new Set(allowed.map((tileIndex) => Number(tileIndex)).filter((tileIndex) => Number.isFinite(tileIndex)));
            }

            filterSetupPreventAllyOutsideAllowedTiles(setup, showToastCallback) {
                if (!Array.isArray(setup)) return setup;
                const allowedTiles = this.getAllowedPlayerTiles();
                if (!allowedTiles) return setup;

                let blocked = 0;
                const filtered = setup.filter((piece) => {
                    if (piece?.villain) return true;
                    if (this.isForcedAllyEntity(piece)) return true;
                    if (!this.isAllyPiece(piece)) return true;
                    if (allowedTiles.has(Number(piece.tileIndex))) return true;
                    blocked++;
                    return false;
                });

                if (blocked > 0) {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Blocked ${blocked} ally placement(s) outside allowed tiles`);
                    if (showToastCallback) {
                        showToastCallback({
                            message: this.config.tileRestrictions.message || 'Ally creatures can only be placed on specific tiles!',
                            type: 'warning',
                            duration: 3000
                        });
                    }
                }

                return filtered;
            }

            removeDuplicateAlliesFromBoard(showToastCallback) {
                if (this.isBoardBattleActive()) return false;

                try {
                    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
                    const seen = new Set();
                    let removed = 0;

                    const newBoardConfig = boardConfig.filter((piece) => {
                        if (!this.isAllyPiece(piece)) return true;
                        if (this.isForcedAllyEntity(piece)) return true;
                        const keys = getAllyCreatureDedupKey(piece, this);
                        if (!keys) return true;
                        for (const key of keys) {
                            if (seen.has(key)) {
                                removed++;
                                return false;
                            }
                        }
                        for (const key of keys) seen.add(key);
                        return true;
                    });

                    if (removed > 0) {
                        this.runLockedBoardSetup(() => {
                            globalThis.state.board.send({
                                type: 'setState',
                                fn: (prev) => ({
                                    ...prev,
                                    boardConfig: newBoardConfig
                                })
                            });
                        });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removed ${removed} duplicate ally creature(s) from board`);
                        if (showToastCallback) {
                            showToastCallback({
                                message: 'Each creature can only be on the board once.',
                                type: 'warning',
                                duration: 3000
                            });
                        }
                        return true;
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error removing duplicate allies from board:', error);
                }

                return false;
            }

            removeAlliesOverlappingVillains(showToastCallback) {
                if (this.isBoardBattleActive()) return false;

                try {
                    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
                    const villainTiles = new Set(
                        boardConfig
                            .filter((entity) => this.isVillainPiece(entity) && entity.tileIndex != null)
                            .map((entity) => entity.tileIndex)
                    );

                    for (const villain of this.config.villains || []) {
                        if (villain?.tileIndex != null) {
                            villainTiles.add(villain.tileIndex);
                        }
                    }

                    if (!villainTiles.size) return false;

                    let removed = 0;
                    const newBoardConfig = boardConfig.filter((piece) => {
                        if (this.isForcedAllyEntity(piece)) return true;
                        if (this.isAllyPiece(piece) && villainTiles.has(piece.tileIndex)) {
                            removed++;
                            return false;
                        }
                        return true;
                    });

                    if (removed > 0) {
                        this.runLockedBoardSetup(() => {
                            globalThis.state.board.send({
                                type: 'setState',
                                fn: (prev) => ({
                                    ...prev,
                                    boardConfig: newBoardConfig
                                })
                            });
                        });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removed ${removed} ally creature(s) overlapping villain tiles`);
                        if (showToastCallback) {
                            showToastCallback({
                                message: 'Ally creatures cannot be placed on villain tiles!',
                                type: 'warning',
                                duration: 3000
                            });
                        }
                        return true;
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error removing allies on villain tiles:', error);
                }

                return false;
            }

            removeAlliesOverlappingForcedAllies(showToastCallback) {
                if (this.isBoardBattleActive()) return false;
                if (!(this.config.allies || []).length) return false;

                try {
                    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
                    const forcedAllyTiles = this.getForcedAllyOccupiedTiles();
                    if (!forcedAllyTiles.size) return false;

                    let removed = 0;
                    const newBoardConfig = boardConfig.filter((piece) => {
                        if (this.isForcedAllyEntity(piece)) return true;
                        if (this.isAllyPiece(piece) && forcedAllyTiles.has(Number(piece.tileIndex))) {
                            removed++;
                            return false;
                        }
                        return true;
                    });

                    if (removed > 0) {
                        this.runLockedBoardSetup(() => {
                            globalThis.state.board.send({
                                type: 'setState',
                                fn: (prev) => ({
                                    ...prev,
                                    boardConfig: newBoardConfig
                                })
                            });
                        });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removed ${removed} ally creature(s) overlapping locked ally tiles`);
                        if (showToastCallback) {
                            showToastCallback({
                                message: 'Ally creatures cannot be placed on locked ally tiles!',
                                type: 'warning',
                                duration: 3000
                            });
                        }
                        return true;
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error removing allies on locked ally tiles:', error);
                }

                return false;
            }

            removeAlliesOutsideAllowedTiles(showToastCallback) {
                if (this.isBoardBattleActive()) return false;
                const allowedTiles = this.getAllowedPlayerTiles();
                if (!allowedTiles) return false;

                try {
                    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
                    let removed = 0;
                    const newBoardConfig = boardConfig.filter((piece) => {
                        if (this.isForcedAllyEntity(piece)) return true;
                        if (!this.isAllyPiece(piece)) return true;
                        if (allowedTiles.has(Number(piece.tileIndex))) return true;
                        removed++;
                        return false;
                    });

                    if (removed > 0) {
                        this.runLockedBoardSetup(() => {
                            globalThis.state.board.send({
                                type: 'setState',
                                fn: (prev) => ({
                                    ...prev,
                                    boardConfig: newBoardConfig
                                })
                            });
                        });
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removed ${removed} ally creature(s) outside allowed tiles`);
                        if (showToastCallback) {
                            showToastCallback({
                                message: this.config.tileRestrictions.message || 'Ally creatures can only be placed on specific tiles!',
                                type: 'warning',
                                duration: 3000
                            });
                        }
                        return true;
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error removing allies outside allowed tiles:', error);
                }

                return false;
            }

            setupAllyVillainOverlapPrevention(activationCallback, showToastCallback) {
                if (!this.config.villains?.length) return;

                this._overlapToastCallback = showToastCallback || null;
                this._overlapActivationCallback = activationCallback || null;
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Ally/villain overlap prevention enabled`);
            }

            /**
             * Setup tile restrictions
             */
            setupTileRestrictions(activationCallback, showToastCallback) {
                if (!this.config.tileRestrictions) return;
                
                // Clean up existing subscriptions
                if (this.setupUnsubscribe) {
                    try {
                        if (typeof this.setupUnsubscribe === 'function') {
                            this.setupUnsubscribe();
                        } else if (globalThis.state.board && typeof globalThis.state.board.off === 'function') {
                            globalThis.state.board.off('autoSetupBoard', this.setupUnsubscribe);
                        }
                    } catch (e) {
                        console.error('[Custom Battles] Error unsubscribing from autoSetupBoard:', e);
                    }
                    this.setupUnsubscribe = null;
                }
                
                if (this.subscriptions.tileRestriction) {
                    if (typeof this.subscriptions.tileRestriction === 'function') {
                        this.subscriptions.tileRestriction();
                    }
                    this.subscriptions.tileRestriction = null;
                }
                
                // Listen for autoSetupBoard events to filter placements
                const autoSetupBoardHandler = (event) => {
                    if (!this.tileRestrictionActive) return;

                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Intercepting board setup for tile restrictions`);

                    event.setup = this.filterSetupPreventAllyOnVillainTiles(event.setup, showToastCallback);
                    event.setup = this.filterSetupPreventAllyOnForcedAllyTiles(event.setup, showToastCallback);
                    event.setup = this.filterSetupPreventAllyOutsideAllowedTiles(event.setup, showToastCallback);
                    event.setup = filterSetupPreventDuplicateAllies(
                        event.setup,
                        globalThis.state.board.getSnapshot()?.context?.boardConfig || [],
                        this,
                        showToastCallback
                    );

                    setTimeout(() => this.ensureForcedAlliesPresent(), 0);
                };
                
                // Store the handler so we can remove it later
                this.setupUnsubscribeHandler = autoSetupBoardHandler;
                const unsubscribeResult = globalThis.state.board.on('autoSetupBoard', autoSetupBoardHandler);
                if (typeof unsubscribeResult === 'function') {
                    this.setupUnsubscribe = unsubscribeResult;
                } else {
                    // If no unsubscribe function returned, we'll need to use off() method
                    this.setupUnsubscribe = null;
                }

                // Listen for board state changes to activate/deactivate restrictions
                this.subscriptions.tileRestriction = globalThis.state.board.subscribe((state) => {
                    const shouldBeActive = this.shouldRestrictionsBeActive(activationCallback);
                    const wasActive = this.tileRestrictionActive;

                    this.tileRestrictionActive = shouldBeActive;

                    if (this.tileRestrictionActive && !wasActive) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Tile restrictions activated`);
                    } else if (!this.tileRestrictionActive && wasActive) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Tile restrictions deactivated`);
                    }
                    
                    if (this.tileRestrictionActive) {
                        this.preventVillainMovement();
                        this.removeAlliesOutsideAllowedTiles(showToastCallback);
                    }
                });

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Tile restriction system set up`);
            }

            /**
             * Setup villain movement prevention only (no tile restrictions).
             * When config.preventVillainMovement is true, villains are kept on their assigned tiles.
             */
            setupPreventVillainMovement(activationCallback) {
                if (this.subscriptions.preventVillainMovement) {
                    this.subscriptions.preventVillainMovement.unsubscribe();
                    this.subscriptions.preventVillainMovement = null;
                }
                this.subscriptions.preventVillainMovement = globalThis.state.board.subscribe(() => {
                    const shouldBeActive = this.shouldRestrictionsBeActive(activationCallback);
                    this.preventVillainMovementActive = shouldBeActive;
                    if (shouldBeActive && this.customVillainPlacementReady) {
                        this.preventVillainMovement();
                    }
                });
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Villain movement prevention set up`);
            }

            /**
             * Hide game timer in sandbox mode
             */
            hideGameTimer() {
                try {
                    const gameTimer = document.getElementById('game-timer');
                    const mbGameTimer = document.getElementById('mb-game-timer');
                    
                    if (gameTimer) {
                        gameTimer.style.display = 'none';
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Hidden game timer`);
                    }
                    if (mbGameTimer) {
                        mbGameTimer.style.display = 'none';
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Hidden mobile game timer`);
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error hiding game timer:', error);
                }
            }

            /**
             * Disable and grey out stop button
             */
            disableStopButton() {
                try {
                    const selectors = [
                        'button.frame-1-red.surface-red[data-state="closed"]',
                        'button.frame-1-red[data-state="closed"]',
                        'button.surface-red[data-state="closed"]',
                        'button[aria-label="Stop"]'
                    ];

                    let stopButton = null;
                    for (const selector of selectors) {
                        stopButton = document.querySelector(selector);
                        if (stopButton && stopButton.textContent.trim() === 'Stop') {
                            break;
                        }
                        if (stopButton) break;
                    }

                    // Fallback: find by text content
                    if (!stopButton) {
                        const buttons = document.querySelectorAll('button.frame-1-red, button.surface-red');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === 'Stop' && btn.getAttribute('data-state') === 'closed') {
                                stopButton = btn;
                                break;
                            }
                        }
                    }

                    if (stopButton && !this.stopButtonDisabled) {
                        stopButton.disabled = true;
                        stopButton.style.opacity = '0.5';
                        stopButton.style.cursor = 'not-allowed';
                        stopButton.style.pointerEvents = 'none';
                        this.stopButtonDisabled = true;
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Stop button disabled and greyed out`);
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error disabling stop button:', error);
                }
            }

            /**
             * Re-enable stop button
             */
            enableStopButton() {
                try {
                    const selectors = [
                        'button.frame-1-red.surface-red[data-state="closed"]',
                        'button.frame-1-red[data-state="closed"]',
                        'button.surface-red[data-state="closed"]',
                        'button[aria-label="Stop"]'
                    ];

                    let stopButton = null;
                    for (const selector of selectors) {
                        stopButton = document.querySelector(selector);
                        if (stopButton && stopButton.textContent.trim() === 'Stop') {
                            break;
                        }
                        if (stopButton) break;
                    }

                    // Fallback: find by text content
                    if (!stopButton) {
                        const buttons = document.querySelectorAll('button.frame-1-red, button.surface-red');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === 'Stop' && btn.getAttribute('data-state') === 'closed') {
                                stopButton = btn;
                                break;
                            }
                        }
                    }

                    if (stopButton && this.stopButtonDisabled) {
                        stopButton.disabled = false;
                        stopButton.style.opacity = '';
                        stopButton.style.cursor = '';
                        stopButton.style.pointerEvents = '';
                        this.stopButtonDisabled = false;
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Stop button re-enabled`);
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error enabling stop button:', error);
                }
            }

            /**
             * Setup stop button disabler
             */
            setupStopButtonDisabler() {
                // Use event delegation on document to catch start button clicks immediately
                this.startButtonClickHandler = (e) => {
                    const target = e.target;
                    const button = target.closest('button');
                    if (!button) return;

                    const text = button.textContent.trim();
                    if (text === 'Start' || text === 'Iniciar' || text === 'Play' || text === 'Jogar') {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Start button clicked - immediately disabling stop button`);

                        if (this.sceneSpriteState && this.isInBattleArea()) {
                            this.resetSceneSpriteReplacements();
                        }
                        this.rescheduleCustomPieceDomSync('Start click');
                        
                        // Check if we're in sandbox mode and hide game timer
                        try {
                            const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                            if (boardContext?.mode === 'sandbox') {
                                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Sandbox mode detected - hiding game timer`);
                                this.hideGameTimer();
                                // Also check again after a short delay in case timer appears later
                                setTimeout(() => this.hideGameTimer(), 100);
                            }
                        } catch (error) {
                            console.error('[Custom Battles] Error checking sandbox mode:', error);
                        }
                        
                        // Disable stop button immediately, before it transforms
                        setTimeout(() => {
                            this.disableStopButton();
                            // Also check again after a short delay to catch the transformed button
                            setTimeout(() => this.disableStopButton(), 50);
                        }, 0);
                    }
                };

                // Add click listener with capture phase to catch it early
                document.addEventListener('click', this.startButtonClickHandler, true);

                // Listen for game start events as backup
                if (typeof globalThis !== 'undefined' && globalThis.state && globalThis.state.board) {
                    // Listen for before-game-start event
                    const beforeGameStartHandler = () => {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Game about to start - disabling stop button`);
                        setTimeout(() => this.disableStopButton(), 0);
                        this.rescheduleCustomPieceDomSync('before-game-start');
                        this.scheduleConfiguredActorDisplayNames(null, 'before-game-start');
                        
                        // Hide game timer in sandbox mode
                        try {
                            const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                            if (boardContext?.mode === 'sandbox') {
                                this.hideGameTimer();
                            }
                        } catch (error) {
                            console.error('[Custom Battles] Error checking sandbox mode:', error);
                        }
                    };
                    
                    const emitNewGameHandler = (event) => {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Game started - disabling stop button`);
                        setTimeout(() => this.disableStopButton(), 0);
                        this.rescheduleCustomPieceDomSync('emitNewGame');
                        this.scheduleConfiguredActorDisplayNames(event?.world || null, 'emitNewGame');
                        
                        // Hide game timer in sandbox mode
                        try {
                            const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                            if (boardContext?.mode === 'sandbox') {
                                this.hideGameTimer();
                                // Also check again after a short delay
                                setTimeout(() => this.hideGameTimer(), 100);
                            }
                        } catch (error) {
                            console.error('[Custom Battles] Error checking sandbox mode:', error);
                        }
                    };
                    
                    const emitEndGameHandler = () => {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Game ended - re-enabling stop button`);
                        this.stopButtonDisabled = false; // Reset flag so button can be disabled again on next start
                        // Board pieces rebuild after combat — re-lock custom villains/allies and outfits.
                        this.rescheduleCustomPieceDomSync('emitEndGame');
                        setTimeout(() => this.rescheduleCustomPieceDomSync('emitEndGame delayed'), 100);
                        setTimeout(() => this.rescheduleCustomPieceDomSync('emitEndGame delayed 400'), 400);
                    };

                    // Store unsubscribe functions returned by .on()
                    this.gameStartEventUnsubscribes = [
                        globalThis.state.board.on('before-game-start', beforeGameStartHandler),
                        globalThis.state.board.on('emitNewGame', emitNewGameHandler),
                        globalThis.state.board.on('emitEndGame', emitEndGameHandler)
                    ];
                }

                // Also watch for stop button appearance using MutationObserver
                if (this.stopButtonObserver) {
                    this.stopButtonObserver.disconnect();
                }

                this.stopButtonObserver = new MutationObserver(() => {
                    if (this.stopButtonDisabled) {
                        // Re-disable if button reappears
                        this.disableStopButton();
                    }
                });

                // Watch for changes in the game area
                const gameArea = document.querySelector('#game');
                if (gameArea) {
                    this.stopButtonObserver.observe(gameArea, {
                        childList: true,
                        subtree: true,
                        attributes: true
                    });
                } else {
                    // Fallback to document body
                    this.stopButtonObserver.observe(document.body, {
                        childList: true,
                        subtree: true,
                        attributes: true
                    });
                }

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Stop button disabler set up`);
            }

            clearVictoryDefeatAutoCloseTimer() {
                if (this.victoryDefeatAutoCloseTimer) {
                    clearTimeout(this.victoryDefeatAutoCloseTimer);
                    this.victoryDefeatAutoCloseTimer = null;
                }
            }

            closeVictoryDefeatModalElement() {
                const modal = this.victoryDefeatModal;
                if (!modal) return;
                try {
                    if (typeof modal.close === 'function') {
                        modal.close();
                    } else if (modal.element && typeof modal.element.remove === 'function') {
                        modal.element.remove();
                    }
                } catch (e) {
                    console.warn('[Custom Battles] Error closing victory/defeat modal:', e);
                }
                this.victoryDefeatModal = null;
            }

            /**
             * Show victory/defeat modal — same createModal pattern as Super Mods
             * (title + string/HTML content + Close; no custom width/layout hacks).
             */
            showVictoryDefeatModal(isVictory, gameData) {
                const victoryDefeatConfig = this.config.victoryDefeat;
                if (!victoryDefeatConfig) return;

                this.clearVictoryDefeatAutoCloseTimer();

                // Close any existing modal first
                if (this.victoryDefeatModal) {
                    this.closeVictoryDefeatModalElement();
                }

                // Call victory/defeat callback
                if (isVictory && victoryDefeatConfig.onVictory) {
                    try {
                        victoryDefeatConfig.onVictory(gameData);
                    } catch (error) {
                        console.error('[Custom Battles] Error in victory callback:', error);
                    }
                } else if (!isVictory && victoryDefeatConfig.onDefeat) {
                    try {
                        victoryDefeatConfig.onDefeat(gameData);
                    } catch (error) {
                        console.error('[Custom Battles] Error in defeat callback:', error);
                    }
                }

                const title = isVictory
                    ? (victoryDefeatConfig.victoryTitle || 'Victory!')
                    : (victoryDefeatConfig.defeatTitle || 'Defeat');

                let content;
                if (isVictory && typeof victoryDefeatConfig.victoryContent === 'function') {
                    const customContent = victoryDefeatConfig.victoryContent(gameData);
                    if (customContent instanceof Node || typeof customContent === 'string') {
                        content = customContent;
                    }
                }
                if (content == null) {
                    const message = isVictory
                        ? (victoryDefeatConfig.victoryMessage || 'You have achieved victory!')
                        : (victoryDefeatConfig.defeatMessage || 'You have been defeated.');
                    const messageColor = isVictory ? '#4CAF50' : '#f44336';
                    const contentRoot = document.createElement('div');
                    contentRoot.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:0;width:100%;box-sizing:border-box;';

                    const messageEl = document.createElement('p');
                    messageEl.style.cssText = `text-align:center;margin:0;color:${messageColor};`;
                    messageEl.textContent = String(message);
                    contentRoot.appendChild(messageEl);

                    if (isVictory && victoryDefeatConfig.showItems && victoryDefeatConfig.items && victoryDefeatConfig.items.length > 0) {
                        const itemsEl = document.createElement('p');
                        itemsEl.style.cssText = 'text-align:center;margin:10px 0 0;color:#4CAF50;';
                        itemsEl.textContent = victoryDefeatConfig.items
                            .map((item) => `${item.name} x${item.amount}`)
                            .join(', ');
                        contentRoot.appendChild(itemsEl);
                    }
                    content = contentRoot;
                }

                const closeModalAndNotify = () => {
                    this.victoryDefeatModal = null;
                    if (victoryDefeatConfig.onClose) {
                        try {
                            victoryDefeatConfig.onClose(isVictory, gameData);
                        } catch (error) {
                            console.error('[Custom Battles] Error in close callback:', error);
                        }
                    }
                };

                const resolveReloadRoomId = () => {
                    const reload = victoryDefeatConfig.reloadRoomOnClose;
                    if (reload === false || reload == null) return null;
                    if (typeof reload === 'string' && reload && reload !== 'self') return reload;
                    return this.config.roomId || null;
                };

                let closeHandled = false;
                const handleClose = () => {
                    if (closeHandled) return;
                    closeHandled = true;
                    this.clearVictoryDefeatAutoCloseTimer();
                    this.closeVictoryDefeatModalElement();

                    const reloadRoomId = resolveReloadRoomId();
                    const shouldReapply = victoryDefeatConfig.reapplyAfterReload === true
                        && !isVictory
                        && !!reloadRoomId;
                    const navigateDelayMs = victoryDefeatConfig.navigateDelayMs ?? 100;

                    closeModalAndNotify();

                    if (!reloadRoomId) return;

                    setTimeout(() => {
                        if (shouldReapply && this.isActive) {
                            console.log(
                                `[Custom Battles][${this.config.name || 'Battle'}] Reloading battle room and re-applying customizations`,
                                reloadRoomId
                            );
                            this.reloadConfiguredRoomAndReapply({
                                roomId: reloadRoomId,
                                forceSameRoomRefresh: victoryDefeatConfig.forceSameRoomRefresh !== false,
                                bounceDelayMs: victoryDefeatConfig.bounceDelayMs ?? 16,
                                isActiveCheck: this.activationCallback,
                                onComplete: () => {
                                    if (typeof victoryDefeatConfig.onRoomReloaded === 'function') {
                                        try {
                                            victoryDefeatConfig.onRoomReloaded(isVictory, gameData);
                                        } catch (error) {
                                            console.error('[Custom Battles] Error in onRoomReloaded:', error);
                                        }
                                    }
                                }
                            });
                            return;
                        }

                        this.reloadConfiguredRoom({
                            roomId: reloadRoomId,
                            forceSameRoomRefresh: victoryDefeatConfig.forceSameRoomRefresh !== false,
                            bounceDelayMs: victoryDefeatConfig.bounceDelayMs ?? 16
                        });
                    }, navigateDelayMs);
                };

                // Prefer BestiaryUIComponents (explicit width px). Fallback showModal uses
                // w-full max-w-[300px] which stretches unless width is a number.
                const modalWidth = Number(victoryDefeatConfig.modalWidth) > 0
                    ? Number(victoryDefeatConfig.modalWidth)
                    : 300;
                const createModal =
                    (typeof window !== 'undefined' && window.BestiaryUIComponents?.createModal)
                    || (typeof window !== 'undefined' && window.BestiaryModAPI?.ui?.components?.createModal)
                    || null;

                const modalOptions = {
                    title,
                    width: modalWidth,
                    content,
                    buttons: [
                        {
                            text: victoryDefeatConfig.closeButtonText || 'Close',
                            primary: true,
                            onClick: handleClose
                        }
                    ]
                };

                if (createModal) {
                    this.victoryDefeatModal = createModal(modalOptions);
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] ${title} modal shown`);
                } else if (typeof window !== 'undefined' && window.BestiaryModAPI && typeof window.BestiaryModAPI.showModal === 'function') {
                    this.victoryDefeatModal = window.BestiaryModAPI.showModal(modalOptions);
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] ${title} modal shown`);
                } else {
                    console.error('[Custom Battles] Modal API not available');
                }

                // Normalize shell: Super Mods compact dialogs use fixed width, content-sized height.
                // Fallback/game paths can leave w-full / flex stretch that warps the box.
                const modalEl = this.victoryDefeatModal?.element;
                if (modalEl) {
                    modalEl.classList.remove('w-full');
                    modalEl.style.width = `${modalWidth}px`;
                    modalEl.style.minWidth = `${modalWidth}px`;
                    modalEl.style.maxWidth = `min(${modalWidth}px, 95vw)`;
                    modalEl.style.height = 'auto';
                    modalEl.style.minHeight = '0';
                    modalEl.style.maxHeight = '95vh';
                    modalEl.style.boxSizing = 'border-box';

                    const inner = modalEl.firstElementChild;
                    if (inner) {
                        inner.style.height = 'auto';
                        inner.style.minHeight = '0';
                        inner.style.flex = '0 0 auto';
                    }
                    const widgetBottom = modalEl.querySelector('.widget-bottom');
                    if (widgetBottom) {
                        widgetBottom.style.height = 'auto';
                        widgetBottom.style.minHeight = '0';
                        widgetBottom.style.flex = '0 0 auto';
                        widgetBottom.style.overflow = 'visible';
                    }

                    const overlay = modalEl.previousElementSibling;
                    const looksLikeOverlay = overlay
                        && overlay.parentNode === document.body
                        && overlay !== modalEl
                        && !overlay.getAttribute?.('role');
                    if (looksLikeOverlay) {
                        // createModal backdrop only removes DOM — run same Close path.
                        overlay.addEventListener('click', () => {
                            handleClose();
                        });
                    }
                }

                // Failsafe: auto-proceed after max 5s if Close / outside click never fires.
                const autoCloseMs = victoryDefeatConfig.autoCloseMs === 0
                    ? 0
                    : (Number(victoryDefeatConfig.autoCloseMs) > 0
                        ? Number(victoryDefeatConfig.autoCloseMs)
                        : 5000);
                if (autoCloseMs > 0) {
                    this.victoryDefeatAutoCloseTimer = setTimeout(() => {
                        this.victoryDefeatAutoCloseTimer = null;
                        console.log(
                            `[Custom Battles][${this.config.name || 'Battle'}] Win/loss modal auto-closing after ${autoCloseMs}ms`
                        );
                        handleClose();
                    }, autoCloseMs);
                }
            }

            /**
             * Setup victory/defeat detection
             */
            setupVictoryDefeatDetection() {
                if (!this.config.victoryDefeat) return;

                if (this.subscriptions.victoryDefeat) {
                    this.subscriptions.victoryDefeat.unsubscribe();
                    this.subscriptions.victoryDefeat = null;
                }
                this.unsubscribeAllyDeathTracking();

                if (typeof globalThis === 'undefined' || !globalThis.state || !globalThis.state.gameTimer) {
                    console.warn('[Custom Battles] GameTimer not available');
                    return;
                }

                // Track ally deaths per game (boardConfig may not remove dead pieces, so count deaths instead)
                const board = globalThis.state.board;
                if (board && typeof board.on === 'function') {
                    if (this.newGameUnsub) {
                        try { this.newGameUnsub(); } catch (e) {}
                        this.newGameUnsub = null;
                    }
                    this.newGameUnsub = board.on('newGame', (event) => {
                        const world = event && event.world;
                        this.scheduleConfiguredActorDisplayNames(world || null, 'newGame');
                        if (!world || !world.grid || !world.grid.onActorDeath) return;
                        this.allyDeathsThisGame = 0;
                        this.unsubscribeAllyDeathTracking();
                        const deathSub = world.grid.onActorDeath.subscribe((deathEvent) => {
                            const killed = deathEvent && deathEvent.killedActor;
                            if (killed && killed.villain === false) {
                                this.allyDeathsThisGame += 1;
                            }
                        });
                        this.allyDeathTrackingUnsubs.push(deathSub);
                        var onGameEnd = world.onGameEnd;
                        var endSub = onGameEnd && typeof onGameEnd.once === 'function' ? onGameEnd.once(() => {
                            this.unsubscribeAllyDeathTracking();
                        }) : undefined;
                        if (endSub) this.allyDeathTrackingUnsubs.push(endSub);
                    });
                }

                // Initialize last state
                try {
                    const currentState = globalThis.state.gameTimer.getSnapshot();
                    const ctx = currentState && currentState.context;
                    this.lastGameState = (ctx && ctx.state) || 'initial';
                } catch (e) {
                    this.lastGameState = 'initial';
                }

                // Monitor game timer for victory/defeat
                this.subscriptions.victoryDefeat = globalThis.state.gameTimer.subscribe(async (timerState) => {
                    try {
                        const ctx = timerState.context || {};
                        const { state, currentTick, readableGrade, rankPoints } = ctx;
                        if (state === 'victory' || state === 'defeat') {
                            console.log('[Custom Battles] timerState.context (grade debug):', JSON.stringify({ state, currentTick, readableGrade, rankPoints, keys: Object.keys(ctx) }));
                        }
                        if ((state === 'victory' || state === 'defeat') && 
                            (this.lastGameState === 'initial' || this.lastGameState === 'playing')) {
                            
                            const isVictory = state === 'victory';
                            const allyLimit = (this.config.allyLimit != null && typeof this.config.allyLimit === 'number') ? this.config.allyLimit : 0;
                            const creaturesAlive = isVictory ? Math.max(0, allyLimit - this.allyDeathsThisGame) : 0;
                            const currentTeamSize = allyLimit > 0 ? allyLimit : undefined;
                            const gameData = {
                                ticks: currentTick,
                                grade: readableGrade,
                                rankPoints: rankPoints,
                                completed: isVictory,
                                creaturesAlive: creaturesAlive,
                                currentTeamSize: currentTeamSize
                            };
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Game ended: ${state}`, gameData);
                            setTimeout(() => {
                                this.showVictoryDefeatModal(isVictory, gameData);
                            }, 100);
                        }
                        this.lastGameState = state;
                    } catch (error) {
                        console.error('[Custom Battles] Error in game timer subscription:', error);
                    }
                });

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Victory/Defeat detection set up`);
            }

            unsubscribeAllyDeathTracking() {
                while (this.allyDeathTrackingUnsubs && this.allyDeathTrackingUnsubs.length > 0) {
                    const unsub = this.allyDeathTrackingUnsubs.pop();
                    try {
                        if (typeof unsub === 'function') unsub();
                        else if (unsub && typeof unsub.unsubscribe === 'function') unsub.unsubscribe();
                    } catch (e) {}
                }
            }

            /**
             * Setup the battle system
             */
            getSceneSpriteReplacementRoot() {
                if (!this.sceneSpriteState) return null;
                return document.getElementById(this.sceneSpriteState.rootId);
            }

            getSceneSpriteSourceId(sprite) {
                if (!this.sceneSpriteState || !sprite) return null;
                for (const className of sprite.classList) {
                    if (className.startsWith('id-')) {
                        const sourceId = Number(className.slice(3));
                        if (this.sceneSpriteState.replacements.has(sourceId)) return sourceId;
                    } else if (className.endsWith('.png')) {
                        const sourceId = Number(className.slice(0, -4));
                        if (this.sceneSpriteState.replacements.has(sourceId)) return sourceId;
                    }
                }
                return null;
            }

            isSceneSpriteBackgroundLayer(sprite) {
                return sprite.classList.contains('absolute')
                    && sprite.classList.contains('size-scaled-sprite')
                    && sprite.classList.contains('pointer-events-none')
                    && !sprite.closest('[id^="tile-index-"]');
            }

            isSceneSpriteFloorBelowSprite(sprite) {
                return sprite.closest('#floor-below') && sprite.classList.contains('relative');
            }

            isSceneSpriteTileDecoration(sprite) {
                return sprite.closest('[id^="tile-index-"]') && sprite.classList.contains('relative');
            }

            isSceneSpriteReplacementTarget(sprite) {
                if (!sprite) return false;
                if (!sprite.classList.contains('item')) return false;
                if (sprite.classList.contains('outfit')) return false;
                if (sprite.closest('#actors')) return false;
                if (sprite.closest('[data-gameid]')) return false;
                const excludeRootIds = this.sceneSpriteState?.excludeRootIds || ['actors'];
                for (const excludeRootId of excludeRootIds) {
                    if (sprite.closest(`#${excludeRootId}`)) {
                        return false;
                    }
                }
                const root = this.getSceneSpriteReplacementRoot();
                if (root && !root.contains(sprite)) return false;

                const sourceId = this.getSceneSpriteSourceId(sprite);
                if (sourceId == null) return false;

                const scope = this.sceneSpriteState.replacements.get(sourceId)?.scope || 'any';
                const isBackground = this.isSceneSpriteBackgroundLayer(sprite);
                const isFloorBelow = this.isSceneSpriteFloorBelowSprite(sprite);
                const isTileDecoration = this.isSceneSpriteTileDecoration(sprite);

                switch (scope) {
                    case 'background':
                        return isBackground || isFloorBelow;
                    case 'tile':
                        return isTileDecoration;
                    default:
                        return isBackground || isFloorBelow || isTileDecoration;
                }
            }

            applySceneSpriteReplacement(sprite, sourceId) {
                const state = this.sceneSpriteState;
                const rule = state?.replacements.get(sourceId);
                if (!rule || !sprite || sprite.dataset[state.datasetKey] === '1') return false;

                const { replacementId, makeRelative } = rule;
                if (sprite.classList.contains(`id-${replacementId}`)) {
                    sprite.dataset[state.datasetKey] = '1';
                    return false;
                }

                sprite.classList.remove(`id-${sourceId}`, `${sourceId}.png`, `id-${sourceId}.png`);
                if (makeRelative) {
                    sprite.classList.remove('pointer-events-none', 'absolute', 'size-scaled-sprite');
                    sprite.classList.add('relative');
                    sprite.style.setProperty('animation-composition', 'accumulate');
                    sprite.style.setProperty('transform-origin', '100% 100%');
                    sprite.style.zIndex = '1000';
                    sprite.style.removeProperty('right');
                    sprite.style.removeProperty('bottom');
                }
                sprite.classList.add(`id-${replacementId}`);

                const img = sprite.querySelector('img');
                if (img) {
                    img.alt = String(replacementId);
                    img.setAttribute('data-cropped', 'false');
                    img.style.setProperty('--cropX', '0');
                    img.style.setProperty('--cropY', '0');
                }

                sprite.dataset[state.datasetKey] = '1';
                return true;
            }

            applySceneSpriteReplacements() {
                const state = this.sceneSpriteState;
                if (!state) return 0;

                const root = this.getSceneSpriteReplacementRoot();
                if (!root?.isConnected) return 0;

                let replacedCount = 0;
                let foundReplacementTargets = false;
                let hasUnreplacedTargets = false;
                const pendingSprites = root.querySelectorAll(state.selector);
                for (let i = 0; i < pendingSprites.length; i++) {
                    const sprite = pendingSprites[i];
                    if (!this.isSceneSpriteReplacementTarget(sprite)) continue;
                    foundReplacementTargets = true;
                    const sourceId = this.getSceneSpriteSourceId(sprite);
                    if (sourceId == null) continue;
                    const rule = state.replacements.get(sourceId);
                    if (sprite.dataset[state.datasetKey] === '1' || (rule && sprite.classList.contains(`id-${rule.replacementId}`))) {
                        if (sprite.dataset[state.datasetKey] !== '1') {
                            sprite.dataset[state.datasetKey] = '1';
                        }
                        continue;
                    }
                    hasUnreplacedTargets = true;
                    if (this.applySceneSpriteReplacement(sprite, sourceId)) replacedCount++;
                }

                if (foundReplacementTargets && !hasUnreplacedTargets) {
                    state.complete = true;
                }

                return replacedCount;
            }

            burstApplySceneSpriteReplacements() {
                if (!this.sceneSpriteState) return;
                this.applySceneSpriteReplacements();
                requestAnimationFrame(() => {
                    this.applySceneSpriteReplacements();
                    requestAnimationFrame(() => {
                        this.applySceneSpriteReplacements();
                    });
                });
            }

            /**
             * Retry scene sprite swaps until the background DOM is ready (room re-entry / fast villain setup).
             */
            scheduleSceneSpriteReplacementsForEntry({ attemptDelays, force = false } = {}) {
                if (!this.sceneSpriteState || !this.isActive) return;
                if (!force && this.isSceneSpriteReplacementsComplete()) return;
                if (!force && this.sceneSpriteReplacementTimer != null) return;

                this.cancelSceneSpriteReplacementTimer();

                const delays = attemptDelays
                    ?? this.config.entrySetup?.sceneSpriteAttemptDelays
                    ?? [0, 50, 150, 300, 500, 800, 1200];

                let attemptIndex = 0;
                const scheduleAttempt = () => {
                    if (!this.sceneSpriteState || !this.isActive) return;
                    if (this.isSceneSpriteReplacementsComplete()) return;
                    if (attemptIndex >= delays.length) return;

                    const delay = delays[attemptIndex++];
                    const fire = () => {
                        this.sceneSpriteReplacementTimer = null;
                        if (!this.sceneSpriteState || !this.isActive) return;
                        if (!this.isInBattleArea()) {
                            scheduleAttempt();
                            return;
                        }
                        this.clearSceneSpriteReplacementMarkers();
                        this.resetSceneSpriteReplacements();
                        this.burstApplySceneSpriteReplacements();
                        if (!this.isSceneSpriteReplacementsComplete()) {
                            scheduleAttempt();
                        }
                    };

                    if (delay > 0) {
                        this.sceneSpriteReplacementTimer = setTimeout(fire, delay);
                    } else {
                        queueMicrotask(fire);
                    }
                };

                scheduleAttempt();
            }

            isSceneSpriteReplacementsComplete() {
                return !this.sceneSpriteState || this.sceneSpriteState.complete;
            }

            resetSceneSpriteReplacements() {
                if (this.sceneSpriteState) {
                    this.sceneSpriteState.complete = false;
                }
            }

            clearSceneSpriteReplacementMarkers() {
                const state = this.sceneSpriteState;
                if (!state) return;

                const root = this.getSceneSpriteReplacementRoot();
                if (!root?.isConnected) return;

                root.querySelectorAll('.sprite.item').forEach((sprite) => {
                    if (!this.isSceneSpriteReplacementTarget(sprite)) return;
                    if (this.getSceneSpriteSourceId(sprite) == null) return;
                    delete sprite.dataset[state.datasetKey];
                });
            }

            shouldApplySceneSpriteReplacements() {
                if (!this.sceneSpriteState || !this.isActive) return false;
                return this.shouldRestrictionsBeActive(this.activationCallback);
            }

            scheduleSceneSpriteReplacementsForGameStart() {
                if (!this.shouldApplySceneSpriteReplacements()) return;

                this.resetSceneSpriteReplacements();
                this.burstApplySceneSpriteReplacements();
                setTimeout(() => {
                    if (this.shouldApplySceneSpriteReplacements()) {
                        this.burstApplySceneSpriteReplacements();
                    }
                }, 50);
                setTimeout(() => {
                    if (this.shouldApplySceneSpriteReplacements()) {
                        this.burstApplySceneSpriteReplacements();
                    }
                }, 150);
            }

            setupSceneSpriteReplacements() {
                if (!this.sceneSpriteState) return;
                if (typeof globalThis === 'undefined' || !globalThis.state?.board) return;

                if (this.sceneSpriteGameEventUnsubscribes.length > 0) {
                    this.sceneSpriteGameEventUnsubscribes.forEach((listener) => {
                        try {
                            if (listener && typeof listener === 'object' && typeof listener.unsubscribe === 'function') {
                                listener.unsubscribe();
                            } else if (listener && typeof listener === 'function') {
                                listener();
                            }
                        } catch (e) {
                            console.error('[Custom Battles] Error unsubscribing from scene sprite game events:', e);
                        }
                    });
                    this.sceneSpriteGameEventUnsubscribes = [];
                }

                const board = globalThis.state.board;
                this.sceneSpriteGameEventUnsubscribes = [
                    board.on('before-game-start', () => {
                        if (!this.shouldApplySceneSpriteReplacements()) return;
                        this.resetSceneSpriteReplacements();
                    }),
                    board.on('emitNewGame', () => {
                        this.scheduleSceneSpriteReplacementsForGameStart();
                    }),
                    board.on('newGame', () => {
                        this.scheduleSceneSpriteReplacementsForGameStart();
                    })
                ];

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Scene sprite replacement game-start hooks set up`);
            }

            isCustomVillainBoardStateValid() {
                try {
                    const boardConfig = globalThis.state.board.getSnapshot().context.boardConfig || [];
                    const villainsOnBoard = boardConfig.filter((entity) => entity?.villain);
                    if (villainsOnBoard.length !== this.config.villains.length) {
                        return false;
                    }
                    return this.hasCustomVillainsOnBoard() && !this.hasOriginalVillainsOnBoard();
                } catch (error) {
                    return false;
                }
            }

            syncCustomVillainsIfNeeded() {
                if (!this.customVillainPlacementReady || this.boardSetupLock || this.isBoardBattleActive()) return;
                if (this.isCustomVillainBoardStateValid()) return;
                if (this.pendingVillainSyncTimer) return;

                this.pendingVillainSyncTimer = setTimeout(() => {
                    this.pendingVillainSyncTimer = null;
                    if (!this.customVillainPlacementReady || this.boardSetupLock || this.isBoardBattleActive()) return;
                    if (this.isCustomVillainBoardStateValid()) return;
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Board villain state invalid - re-running villain swap`);
                    this.removeOriginalVillains();
                }, 150);
            }

            hasCustomVillainsOnBoard() {
                try {
                    const boardConfig = globalThis.state.board.getSnapshot().context.boardConfig || [];
                    return this.config.villains.every((villainConfig) => {
                        const prefix = villainConfig.keyPrefix || `${villainConfig.nickname?.toLowerCase() || 'villain'}-tile-${villainConfig.tileIndex}-`;
                        if (prefix.includes(`-${villainConfig.tileIndex}-`) || prefix.endsWith(`-${villainConfig.tileIndex}-`)) {
                            return boardConfig.some((entity) => entity.key && entity.key.startsWith(prefix));
                        }
                        return boardConfig.some((entity) =>
                            entity.key && entity.key.startsWith(prefix) && entity.tileIndex === villainConfig.tileIndex
                        );
                    });
                } catch (error) {
                    return false;
                }
            }

            resetSandboxBattleState() {
                try {
                    globalThis.state.board.send({
                        type: 'setState',
                        fn: (prev) => ({
                            ...prev,
                            gameStarted: false,
                            serverResults: null
                        })
                    });
                } catch (error) {
                    console.error('[Custom Battles] Error resetting sandbox battle state:', error);
                }
            }

            setupAutoSetupVillainSync(activationCallback) {
                if (this.autoSetupVillainSyncUnsub) {
                    try {
                        if (typeof this.autoSetupVillainSyncUnsub === 'function') {
                            this.autoSetupVillainSyncUnsub();
                        } else if (this.autoSetupVillainSyncUnsub.unsubscribe) {
                            this.autoSetupVillainSyncUnsub.unsubscribe();
                        } else if (globalThis.state.board?.off && this.autoSetupVillainSyncHandler) {
                            globalThis.state.board.off('autoSetupBoard', this.autoSetupVillainSyncHandler);
                        }
                    } catch (e) {}
                    this.autoSetupVillainSyncUnsub = null;
                }

                this.autoSetupVillainSyncHandler = () => {
                    if (!this.isActive || !this.shouldRestrictionsBeActive(activationCallback)) return;
                    if (this.isBoardBattleActive()) return;

                    this.removeDuplicateAlliesFromBoard(this._overlapToastCallback || null);
                    this.removeAlliesOverlappingVillains(this._overlapToastCallback || null);
                    this.removeAlliesOverlappingForcedAllies(this._overlapToastCallback || null);
                    this.removeAlliesOutsideAllowedTiles(this._overlapToastCallback || null);

                    if (!this.customVillainPlacementReady || this.boardSetupLock) return;
                    if (this.autoSetupVillainSyncTimer) {
                        clearTimeout(this.autoSetupVillainSyncTimer);
                    }
                    this.autoSetupVillainSyncTimer = setTimeout(() => {
                        if (!this.isActive || !this.shouldRestrictionsBeActive(activationCallback)) return;
                        if (!this.customVillainPlacementReady || this.boardSetupLock || this.isBoardBattleActive()) return;
                        this.syncCustomVillainsIfNeeded();
                    }, 75);
                };

                this.autoSetupVillainSyncUnsub = globalThis.state.board.on('autoSetupBoard', this.autoSetupVillainSyncHandler);
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] autoSetupBoard villain sync set up`);
            }

            setup(activationCallback, showToastCallback) {
                if (this.isActive) {
                    console.warn('[Custom Battles][' + (this.config.name || 'Battle') + '] Already set up');
                    return;
                }

                this.isActive = true;
                activeCustomBattles.add(this);
                hideBetterHighscoresForCustomBattle();
                hideRoomInfoOverlayForCustomBattle();
                installGlobalAllyVillainOverlapGuard();
                this.activationCallback = activationCallback || null;
                this._overlapToastCallback = showToastCallback || null;
                console.log('[Custom Battles][' + (this.config.name || 'Battle') + '] Setting up battle system');

                // Setup stop button disabler (always enabled)
                this.setupStopButtonDisabler();

                // Setup ally limit if configured
                if (this.config.allyLimit) {
                    this.setupAllyLimit(activationCallback, showToastCallback);
                }

                // Setup tile restrictions if configured
                if (this.config.tileRestrictions) {
                    this.setupTileRestrictions(activationCallback, showToastCallback);
                }

                // Setup villain movement prevention only (if not already via tile restrictions)
                if (this.config.preventVillainMovement && !this.config.tileRestrictions) {
                    this.setupPreventVillainMovement(activationCallback);
                }

                // Setup victory/defeat detection if configured
                if (this.config.victoryDefeat) {
                    this.setupVictoryDefeatDetection();
                }

                if (this.sceneSpriteState) {
                    this.setupSceneSpriteReplacements();
                }

                if (this.config.villains?.length) {
                    this.setupAllyVillainOverlapPrevention(activationCallback, showToastCallback);
                    this.setupAutoSetupVillainSync(activationCallback);
                }

                this.setupForcedAllyWatch(activationCallback);
                
                // Set floor if configured (with delay to ensure board is ready)
                if (this.config.floor !== undefined) {
                    setTimeout(() => {
                        this.setFloor(this.config.floor);
                    }, 100);
                }
            }

            setupForcedAllyWatch(activationCallback) {
                if (!this.allyKeyPrefixes.length) return;
                if (this.forcedAllyWatchUnsub) {
                    try {
                        if (typeof this.forcedAllyWatchUnsub === 'function') this.forcedAllyWatchUnsub();
                        else if (this.forcedAllyWatchUnsub.unsubscribe) this.forcedAllyWatchUnsub.unsubscribe();
                    } catch (_) {
                        // no-op
                    }
                    this.forcedAllyWatchUnsub = null;
                }

                this.forcedAllyWatchUnsub = globalThis.state.board.subscribe(() => {
                    if (!this.isActive) return;
                    if (typeof activationCallback === 'function' && !activationCallback()) return;
                    if (!this.shouldRestrictionsBeActive(activationCallback)) return;
                    this.ensureForcedAlliesPresent();
                });
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Forced ally watch enabled`);
            }

            /**
             * Cleanup and teardown
             */
            cleanup(restoreBoardCallback, showOverlaysCallback) {
                if (!this.isActive) return;

                console.log('[Custom Battles][' + (this.config.name || 'Battle') + '] Cleaning up battle system');

                // Unsubscribe from all subscriptions
                if (this.subscriptions.allyLimit) {
                    this.subscriptions.allyLimit.unsubscribe();
                    this.subscriptions.allyLimit = null;
                }

                if (this.subscriptions.tileRestriction) {
                    if (typeof this.subscriptions.tileRestriction === 'function') {
                        this.subscriptions.tileRestriction();
                    }
                    this.subscriptions.tileRestriction = null;
                }

                if (this.subscriptions.preventVillainMovement) {
                    this.subscriptions.preventVillainMovement.unsubscribe();
                    this.subscriptions.preventVillainMovement = null;
                }

                if (this.subscriptions.allyVillainOverlap) {
                    if (typeof this.subscriptions.allyVillainOverlap === 'function') {
                        this.subscriptions.allyVillainOverlap();
                    } else if (this.subscriptions.allyVillainOverlap.unsubscribe) {
                        this.subscriptions.allyVillainOverlap.unsubscribe();
                    }
                    this.subscriptions.allyVillainOverlap = null;
                }

                if (this.allyVillainOverlapTimer) {
                    clearTimeout(this.allyVillainOverlapTimer);
                    this.allyVillainOverlapTimer = null;
                }
                if (this.allyVillainOverlapUnsub) {
                    try {
                        if (typeof this.allyVillainOverlapUnsub === 'function') {
                            this.allyVillainOverlapUnsub();
                        } else if (globalThis.state.board?.off && this.allyVillainOverlapHandler) {
                            globalThis.state.board.off('autoSetupBoard', this.allyVillainOverlapHandler);
                        }
                    } catch (e) {
                        console.error('[Custom Battles] Error unsubscribing from ally/villain overlap prevention:', e);
                    }
                    this.allyVillainOverlapUnsub = null;
                    this.allyVillainOverlapHandler = null;
                }

                // Unsubscribe from autoSetupBoard event
                if (this.setupUnsubscribeHandler) {
                    try {
                        if (this.setupUnsubscribe && typeof this.setupUnsubscribe === 'function') {
                            // Use the unsubscribe function if available
                            this.setupUnsubscribe();
                        } else if (globalThis.state.board && typeof globalThis.state.board.off === 'function') {
                            // Use off() method to remove the handler
                            globalThis.state.board.off('autoSetupBoard', this.setupUnsubscribeHandler);
                        }
                    } catch (e) {
                        console.error('[Custom Battles] Error unsubscribing from autoSetupBoard:', e);
                    }
                    this.setupUnsubscribe = null;
                    this.setupUnsubscribeHandler = null;
                }

                // Cleanup victory/defeat subscription
                if (this.subscriptions.victoryDefeat) {
                    this.subscriptions.victoryDefeat.unsubscribe();
                    this.subscriptions.victoryDefeat = null;
                }
                this.unsubscribeAllyDeathTracking();
                if (this.newGameUnsub) {
                    try { this.newGameUnsub(); } catch (e) {}
                    this.newGameUnsub = null;
                }

                if (this.autoSetupVillainSyncTimer) {
                    clearTimeout(this.autoSetupVillainSyncTimer);
                    this.autoSetupVillainSyncTimer = null;
                }
                if (this.pendingVillainSyncTimer) {
                    clearTimeout(this.pendingVillainSyncTimer);
                    this.pendingVillainSyncTimer = null;
                }
                this.cancelEntryVillainSetupTimer();
                this.entryVillainSetupDone = false;
                this.cancelSceneSpriteReplacementTimer();
                this.cancelOutfitSpriteOverrideWatch();
                if (this.forcedAllyWatchUnsub) {
                    try {
                        if (typeof this.forcedAllyWatchUnsub === 'function') this.forcedAllyWatchUnsub();
                        else if (this.forcedAllyWatchUnsub.unsubscribe) this.forcedAllyWatchUnsub.unsubscribe();
                    } catch (_) {
                        // no-op
                    }
                    this.forcedAllyWatchUnsub = null;
                }
                if (this.autoSetupVillainSyncUnsub) {
                    try {
                        if (typeof this.autoSetupVillainSyncUnsub === 'function') {
                            this.autoSetupVillainSyncUnsub();
                        } else if (this.autoSetupVillainSyncUnsub.unsubscribe) {
                            this.autoSetupVillainSyncUnsub.unsubscribe();
                        } else if (globalThis.state.board?.off && this.autoSetupVillainSyncHandler) {
                            globalThis.state.board.off('autoSetupBoard', this.autoSetupVillainSyncHandler);
                        }
                    } catch (e) {
                        console.error('[Custom Battles] Error unsubscribing from autoSetupBoard villain sync:', e);
                    }
                    this.autoSetupVillainSyncUnsub = null;
                    this.autoSetupVillainSyncHandler = null;
                }

                // Cleanup stop button disabler
                if (this.startButtonClickHandler) {
                    document.removeEventListener('click', this.startButtonClickHandler, true);
                    this.startButtonClickHandler = null;
                }

                // Cleanup game start event listeners
                if (this.gameStartEventUnsubscribes && this.gameStartEventUnsubscribes.length > 0) {
                    this.gameStartEventUnsubscribes.forEach(listener => {
                        try {
                            // .on() returns an object with unsubscribe() method or a function
                            if (listener && typeof listener === 'object' && typeof listener.unsubscribe === 'function') {
                                listener.unsubscribe();
                            } else if (listener && typeof listener === 'function') {
                                listener();
                            }
                        } catch (e) {
                            console.error('[Custom Battles] Error unsubscribing from game events:', e);
                        }
                    });
                    this.gameStartEventUnsubscribes = [];
                }

                if (this.sceneSpriteGameEventUnsubscribes.length > 0) {
                    this.sceneSpriteGameEventUnsubscribes.forEach((listener) => {
                        try {
                            if (listener && typeof listener === 'object' && typeof listener.unsubscribe === 'function') {
                                listener.unsubscribe();
                            } else if (listener && typeof listener === 'function') {
                                listener();
                            }
                        } catch (e) {
                            console.error('[Custom Battles] Error unsubscribing from scene sprite game events:', e);
                        }
                    });
                    this.sceneSpriteGameEventUnsubscribes = [];
                }

                // Disconnect stop button observer
                if (this.stopButtonObserver) {
                    this.stopButtonObserver.disconnect();
                    this.stopButtonObserver = null;
                }

                // Re-enable stop button if it was disabled
                if (this.stopButtonDisabled) {
                    this.enableStopButton();
                    this.stopButtonDisabled = false;
                }

                // Close victory/defeat modal if open
                this.clearVictoryDefeatAutoCloseTimer();
                if (this.victoryDefeatModal) {
                    this.closeVictoryDefeatModalElement();
                }

                // Restore board setup
                if (restoreBoardCallback) {
                    restoreBoardCallback();
                } else {
                    this.restoreBoardSetup();
                }

                this.resetSandboxBattleState();

                if (activeCustomBattles.size <= 1) {
                    showBetterHighscoresAfterCustomBattle();
                    showRoomInfoOverlayAfterCustomBattle();
                }

                // Show overlays if callback provided
                if (showOverlaysCallback) {
                    showOverlaysCallback();
                }

                this.tileRestrictionActive = false;
                this.boardSetupLock = false;
                this.customVillainPlacementReady = false;
                this.resetSceneSpriteReplacements();
                this.activationCallback = null;
                this._overlapToastCallback = null;
                this.isActive = false;
                activeCustomBattles.delete(this);
                this.lastGameState = 'initial';
                console.log('[Custom Battles][' + (this.config.name || 'Battle') + '] Cleanup completed');
            }
        }

        // Battle configs (e.g. Mornenion, Putrid Chamber) live in Quests.js. This file provides
        // CustomBattle and create(config). Optional config.sceneSpriteReplacements swaps background
        // sprite ids inside a DOM root (default #background-scene) for quest map visuals.
        // Sprites inside #actors (board creatures) are always excluded.
        // Optional rule.scope: "background" (absolute floor layers / #floor-below) or "tile" (tile-index decorations).
        // Optional villain.outfitSpriteId / allies[].outfitSpriteId overrides the rendered outfit sprite class while keeping gameId combat identity.
        // Optional config.allies places non-removable custom allies (customForcedAlly) during entry setup.
        // Forced allies are excluded from creature-duplicate checks and their tiles block player ally placement.
        // Custom villain + forced-ally board buttons are interaction-locked (disabled / no pointer events).
        // While active, room info overlay (monster count / map name) and Better Highscores are suppressed.
        // Optional victoryDefeat.reloadRoomOnClose reloads config.roomId after Close (same-room bounce
        // when needed). Set reapplyAfterReload: true only if CustomBattles should force entry setup;
        // otherwise room-enter / board load re-applies customizations natively.
        // Same flow for all: create(config) → setup(activationCallback, showToast)
        // → scheduleEntryVillainSetup / runEntryVillainSetupIfNeeded → onClose cleanup + navigate.

        // Expose globally
            try {
                window.CustomBattles = {
                    create: (config) => new CustomBattle(config),
                    isAllyContextMenuBlocked: shouldBlockAllyContextMenu,
                    navigateToRoom: (roomId) => {
                        if (!roomId || !globalThis.state?.board?.send) return false;
                        try {
                            globalThis.state.board.send({ type: 'selectRoomById', roomId });
                            return true;
                        } catch (error) {
                            console.error('[Custom Battles] navigateToRoom failed:', error);
                            return false;
                        }
                    }
                };
            } catch (error) {
                console.error('[Custom Battles] ✗ ERROR setting window.CustomBattles:', error);
                console.error('[Custom Battles] Error stack:', error?.stack);
                throw error; // Re-throw to be caught by outer try-catch
            }
        })();
    } catch (error) {
        console.error('[Custom Battles] ✗ CRITICAL ERROR during initialization:', error);
        console.error('[Custom Battles] Error message:', error?.message);
        console.error('[Custom Battles] Error stack:', error?.stack);
        // Still try to set a minimal object so the system knows something went wrong
        try {
            window.CustomBattles = {
                create: () => {
                    throw new Error('CustomBattles initialization failed - check console for errors');
                },
                _error: error?.message || 'Unknown error'
            };
        } catch (e) {
            console.error('[Custom Battles] Could not set error object:', e);
        }
    }
}

