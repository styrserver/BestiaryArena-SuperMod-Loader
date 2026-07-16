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

        function enforceAllyVillainSeparationForActiveBattles(showToastCallback) {
            for (const battle of activeCustomBattles) {
                if (!battle.isActive) continue;
                try {
                    if (!battle.shouldRestrictionsBeActive(battle.activationCallback)) continue;
                    if (battle.isBoardBattleActive()) continue;
                    const toast = showToastCallback || battle._overlapToastCallback || null;
                    if (battle.removeAlliesOverlappingVillains(toast)) {
                        break;
                    }
                } catch (_) {}
            }
        }

        function filterAutoSetupForActiveBattles(event) {
            if (!event?.setup?.length) return;

            for (const battle of activeCustomBattles) {
                if (!battle.isActive) continue;
                try {
                    if (!battle.shouldRestrictionsBeActive(battle.activationCallback)) continue;
                    const filteredSetup = battle.filterSetupPreventAllyOnVillainTiles(event.setup, battle._overlapToastCallback || null);
                    if (filteredSetup.length !== event.setup.length) {
                        event.setup = filteredSetup;
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

            event.preventDefault();
            event.stopImmediatePropagation();
            event.stopPropagation();
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
                this.allyDeathsThisGame = 0;
                this.allyDeathTrackingUnsubs = [];
                this.newGameUnsub = null;
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
                this.entryVillainSetupDone = false;
                this.resetSceneSpriteReplacements();
                this.markCustomVillainPlacementReady(false);
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
                this.removeOriginalVillains();
                this.entryVillainSetupDone = true;

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
                    genes: villainConfig.genes || {
                        hp: 1,
                        ad: 1,
                        ap: 1,
                        armor: 1,
                        magicResist: 1
                    }
                }, villainConfig);
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
                        const configWithoutVillains = boardConfig.filter((entity) => !entity.villain);
                        const customVillains = this.config.villains.map((villainConfig) => {
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Adding ${villainConfig.nickname || 'villain'} to tile ${villainConfig.tileIndex}`);
                            return this.createCustomVillainEntity(villainConfig);
                        });
                        const updatedBoardConfig = [...configWithoutVillains, ...customVillains];

                        if (updatedBoardConfig.length !== boardConfig.length || boardConfig.some((entity) => entity.villain)) {
                            globalThis.state.board.send({
                                type: 'setState',
                                fn: (prev) => ({
                                    ...prev,
                                    boardConfig: updatedBoardConfig
                                })
                            });

                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Original villains removed from board`);
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Board configuration updated with new villains`);

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
                    const allyCount = allies.length;
                    
                    if (allyCount > this.config.allyLimit) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Ally limit exceeded: ${allyCount} > ${this.config.allyLimit}, removing excess`);
                        
                        const alliesToKeep = allies.slice(0, this.config.allyLimit);
                        const keysToKeep = new Set(alliesToKeep.map(ally => ally.key));
                        
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

            filterSetupPreventAllyOnVillainTiles(setup, showToastCallback) {
                if (!Array.isArray(setup)) return setup;

                const villainTiles = this.getVillainOccupiedTiles();
                if (!villainTiles.size) return setup;

                let blocked = 0;
                const filtered = setup.filter((piece) => {
                    if (piece?.villain) return true;
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

                    const allowedTiles = this.config.tileRestrictions.allowedTiles || [];
                    event.setup = this.filterSetupPreventAllyOnVillainTiles(event.setup, showToastCallback);

                    const beforeAllowedFilter = event.setup.length;
                    const filteredSetup = event.setup.filter(piece => {
                        if (piece.villain) return true;
                        return allowedTiles.includes(piece.tileIndex);
                    });

                    if (filteredSetup.length !== beforeAllowedFilter) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Blocked ${beforeAllowedFilter - filteredSetup.length} ally placements outside allowed tiles`);

                        if (showToastCallback) {
                            showToastCallback({
                                message: this.config.tileRestrictions.message || `Ally creatures can only be placed on specific tiles!`,
                                type: 'warning',
                                duration: 3000
                            });
                        }
                    }

                    if (filteredSetup.length !== beforeAllowedFilter) {
                        event.setup = filteredSetup;
                    }
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
                    
                    const emitNewGameHandler = () => {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Game started - disabling stop button`);
                        setTimeout(() => this.disableStopButton(), 0);
                        
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

            /**
             * Show victory/defeat modal
             */
            showVictoryDefeatModal(isVictory, gameData) {
                const victoryDefeatConfig = this.config.victoryDefeat;
                if (!victoryDefeatConfig) return;

                // Close any existing modal first
                if (this.victoryDefeatModal) {
                    try {
                        if (typeof this.victoryDefeatModal.close === 'function') {
                            this.victoryDefeatModal.close();
                        } else if (this.victoryDefeatModal.element && typeof this.victoryDefeatModal.element.remove === 'function') {
                            this.victoryDefeatModal.element.remove();
                        }
                    } catch (e) {
                        console.warn('[Custom Battles] Error closing existing modal:', e);
                    }
                    this.victoryDefeatModal = null;
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

                const title = isVictory ? (victoryDefeatConfig.victoryTitle || 'Victory!') : (victoryDefeatConfig.defeatTitle || 'Defeat');
                const titleColor = isVictory ? '#4CAF50' : '#e74c3c';

                let content;
                if (isVictory && typeof victoryDefeatConfig.victoryContent === 'function') {
                    const customContent = victoryDefeatConfig.victoryContent(gameData);
                    if (customContent instanceof Node) {
                        content = customContent;
                    } else if (typeof customContent === 'string') {
                        content = document.createElement('div');
                        content.innerHTML = customContent;
                    } else {
                        content = document.createElement('div');
                    }
                }
                if (!content) {
                    // Default content element
                    content = document.createElement('div');
                    content.style.cssText = 'text-align: center; padding: 20px;';

                    const titleEl = document.createElement('h2');
                    titleEl.textContent = title;
                    titleEl.style.cssText = `color: ${titleColor}; margin-bottom: 15px; font-size: 24px; font-weight: bold;`;
                    content.appendChild(titleEl);

                    const message = isVictory ?
                        (victoryDefeatConfig.victoryMessage || 'You have achieved victory!') :
                        (victoryDefeatConfig.defeatMessage || 'You have been defeated.');

                    if (message) {
                        const msgEl = document.createElement('div');
                        msgEl.textContent = message;
                        msgEl.style.cssText = `color: ${titleColor}; margin-bottom: 15px; font-weight: bold;`;
                        content.appendChild(msgEl);
                    }

                    if (isVictory && victoryDefeatConfig.showItems && victoryDefeatConfig.items && victoryDefeatConfig.items.length > 0) {
                        const itemsEl = document.createElement('div');
                        itemsEl.style.cssText = 'margin-top: 15px;';
                        itemsEl.textContent = 'Items received: ' + victoryDefeatConfig.items.map(item => `${item.name} x${item.amount}`).join(', ');
                        itemsEl.style.color = '#4CAF50';
                        content.appendChild(itemsEl);
                    }
                }

                // Create modal using window.BestiaryModAPI.showModal
                if (typeof window !== 'undefined' && window.BestiaryModAPI && typeof window.BestiaryModAPI.showModal === 'function') {
                    this.victoryDefeatModal = window.BestiaryModAPI.showModal({
                        title: title,
                        content: content,
                        buttons: [
                            {
                                text: 'OK',
                                primary: true,
                                onClick: () => {
                                    this.victoryDefeatModal = null;
                                    if (victoryDefeatConfig.onClose) {
                                        try {
                                            victoryDefeatConfig.onClose(isVictory, gameData);
                                        } catch (error) {
                                            console.error('[Custom Battles] Error in close callback:', error);
                                        }
                                    }
                                }
                            }
                        ]
                    });
                    
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] ${title} modal shown`);
                } else {
                    console.error('[Custom Battles] window.BestiaryModAPI.showModal not available');
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

                    this.removeAlliesOverlappingVillains(this._overlapToastCallback || null);

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
                
                // Set floor if configured (with delay to ensure board is ready)
                if (this.config.floor !== undefined) {
                    setTimeout(() => {
                        this.setFloor(this.config.floor);
                    }, 100);
                }
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
                if (this.victoryDefeatModal) {
                    try {
                        if (typeof this.victoryDefeatModal.close === 'function') {
                            this.victoryDefeatModal.close();
                        } else if (this.victoryDefeatModal.element && typeof this.victoryDefeatModal.element.remove === 'function') {
                            this.victoryDefeatModal.element.remove();
                        }
                    } catch (e) {
                        console.warn('[Custom Battles] Error closing victory/defeat modal:', e);
                    }
                    this.victoryDefeatModal = null;
                }

                // Restore board setup
                if (restoreBoardCallback) {
                    restoreBoardCallback();
                } else {
                    this.restoreBoardSetup();
                }

                this.resetSandboxBattleState();

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
        // Same flow for all: create(config) → setup(activationCallback, showToast)
        // → scheduleEntryVillainSetup / runEntryVillainSetupIfNeeded → onClose cleanup + navigate.

        // Expose globally
            try {
                window.CustomBattles = {
                    create: (config) => new CustomBattle(config),
                    isAllyContextMenuBlocked: shouldBlockAllyContextMenu
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

