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
                        preserveCrop: !!rule.preserveCrop,
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

        // Custom-PNG sprites placeable as a piece's visual (like Quests.js's Weakened
        // Ghazbaran, generalized). Add an entry here to make it selectable in the Map
        // Editor's creature picker under the "Custom sprites" separator — no other
        // wiring needed. Files live under /assets/quests/.
        //
        // The native game renders outfit/item art via CSS `content: url(...)` on the
        // .spritesheet element, sized/positioned entirely through --size/--sWidth/--sHeight
        // custom properties and a shared `homogeneous-transition` keyframe (just
        // `transform: translateY(-100%)`, which — because percentages are relative to the
        // element's OWN box, not the viewport — lands exactly on each row once combined
        // with steps(N)). We don't reimplement any of that: we only override which image
        // `content: url()` loads, reusing 100% of the native sizing/facing/animation
        // machinery untouched. That means idleUrl/movingUrl MUST be laid out exactly like
        // the base creature's own OUTFIT/ITEM asset (same column count = facings, same row
        // count = movingFrameRows) or the reused native CSS will crop/step it wrong.
        let cachedCustomSpriteExtensionBaseUrl = null;
        const CUSTOM_MAP_SPRITES = [
            {
                key: 'weakened-ghazbaran',
                name: 'Weakened Ghazbaran',
                baseGameId: 65, // Dragon — same base creature Quests.js uses for this fight
                idleUrl: 'ghaz-idle.png',
                portraitUrl: 'ghaz-icon.gif', // dedicated single-frame icon for portraits/picker cards
                movingUrl: 'ghaz-moving.png',
                // Sheet geometry (see cellSize note on ensureCustomSpriteStyles). ghaz-idle.png
                // is 256x64 (4 facings x 1 frame @ 64px); ghaz-moving.png is 256x512 (4 x 8 @ 64px).
                // Dragon id-65 renders idle at 32px natively, so without these the idle pose
                // squashes the instant the actor stops moving mid-battle.
                cellSize: 64,
                facings: 4,
                idleFrameRows: 1,
                movingFrameRows: 8,
                movingFrameDurationMs: 2400 // matches Dragon's own native .outfit.id-34.moving timing
            },
            {
                key: 'kraknaknorks-demon',
                name: "Kraknaknork's Demon",
                baseGameId: 92, // Beer Barrel
                idleUrl: "Kraknaknork's Demon.png"
            }
        ];

        function getCustomSpriteAssetUrl(filename) {
            const imagePath = '/assets/quests/' + filename;
            const constructUrl = (base, path) => {
                const normalizedBase = base.endsWith('/') ? base : base + '/';
                const normalizedPath = path.startsWith('/') ? path.substring(1) : path;
                return normalizedBase + normalizedPath;
            };
            if (cachedCustomSpriteExtensionBaseUrl) {
                return constructUrl(cachedCustomSpriteExtensionBaseUrl, imagePath);
            }
            try {
                const api = window.browserAPI || window.chrome || window.browser;
                if (api?.runtime?.id && api.runtime.id !== 'invalid' && api.runtime.getURL) {
                    const url = api.runtime.getURL(imagePath);
                    if (url?.includes('://') && !url.includes('://invalid')) {
                        const baseUrlMatch = url.match(/^(chrome-extension|moz-extension):\/\/[^/]+\//);
                        if (baseUrlMatch) cachedCustomSpriteExtensionBaseUrl = baseUrlMatch[0];
                        return url;
                    }
                }
            } catch (error) {
                console.warn('[Custom Battles] Error getting URL from browser API:', error);
            }
            if (typeof window !== 'undefined' && window.BESTIARY_EXTENSION_BASE_URL) {
                cachedCustomSpriteExtensionBaseUrl = window.BESTIARY_EXTENSION_BASE_URL;
                return constructUrl(cachedCustomSpriteExtensionBaseUrl, imagePath);
            }
            return imagePath;
        }

        function getCustomSpriteDef(key) {
            if (key == null) return null;
            return CUSTOM_MAP_SPRITES.find((def) => def.key === key) || null;
        }

        function getCustomSpriteOverlayClass(key) {
            return `custom-battles-sprite-${key}`;
        }

        const customSpriteStylesInjected = new Set();

        // Overrides ONLY which image `content: url()` loads for this piece's real .spritesheet
        // element — everything else (--size/--sWidth/--sHeight, facing translate, the
        // homogeneous-transition keyframe that drives steps()) is the base creature's own
        // native CSS, completely untouched. idleUrl/movingUrl must match that creature's own
        // asset layout (see the big comment on CUSTOM_MAP_SPRITES above).
        function ensureCustomSpriteStyles(spriteDef) {
            if (!spriteDef || customSpriteStylesInjected.has(spriteDef.key)) return;
            const styleId = `custom-battles-sprite-style-${spriteDef.key}`;
            let style = document.getElementById(styleId);
            if (!style) {
                style = document.createElement('style');
                style.id = styleId;
                document.head.appendChild(style);
            }
            const overlayClass = getCustomSpriteOverlayClass(spriteDef.key);
            const idleUrl = getCustomSpriteAssetUrl(spriteDef.idleUrl).replace(/"/g, '\\"');
            const movingRows = Number(spriteDef.movingFrameRows) || 1;

            // When the registry entry declares its sheet geometry (cellSize), pin the native
            // sizing custom properties (--size / --sWidth / --sHeight) for this sprite so it
            // no longer inherits the base creature's own idle/moving cell-size split. Dragon
            // id-65, for instance, renders idle at 32px but moving at 64px — a 64px custom
            // idle sheet squashes into the 32px box the moment the actor stops moving in a
            // real battle (the Map Editor only ever shows the moving-size state, which is why
            // it looks fine there). Native still drives facing translate + the
            // homogeneous-transition row stepping; we only feed it geometry that matches the
            // custom art. Selectors are `.outfit.<overlayClass>.<state>` (0-3-0 specificity,
            // injected after the bundle) so they win over `.outfit.id-N.<state>`.
            const cellSize = Number(spriteDef.cellSize) || 0;
            const facings = Number(spriteDef.facings) || 4;
            const idleRows = Number(spriteDef.idleFrameRows) || 1;
            let sizingRule = '';
            if (cellSize > 0) {
                sizingRule = `
      .outfit.${overlayClass} { --size: ${cellSize}px !important; }
      .outfit.${overlayClass}.idle {
        --size: ${cellSize}px !important;
        --sWidth: ${cellSize * facings}px !important;
        --sHeight: ${cellSize * idleRows}px !important;
      }`;
                if (spriteDef.movingUrl) {
                    sizingRule += `
      .outfit.${overlayClass}.moving {
        --size: ${cellSize}px !important;
        --sWidth: ${cellSize * facings}px !important;
        --sHeight: ${cellSize * movingRows}px !important;
      }`;
                }
            }

            let movingRule = '';
            if (spriteDef.movingUrl) {
                const movingUrl = getCustomSpriteAssetUrl(spriteDef.movingUrl).replace(/"/g, '\\"');
                const durationMs = Number(spriteDef.movingFrameDurationMs) || 900;
                movingRule = movingRows > 1
                    ? `
      .${overlayClass}.moving .spritesheet {
        content: url("${movingUrl}") !important;
        animation: homogeneous-transition ${durationMs}ms steps(${movingRows}) infinite !important;
      }`
                    : `
      .${overlayClass}.moving .spritesheet {
        content: url("${movingUrl}") !important;
      }`;
            }

            style.textContent = `
      .${overlayClass} .spritesheet {
        content: url("${idleUrl}") !important;
      }
      ${movingRule}
      ${sizingRule}
    `;
            customSpriteStylesInjected.add(spriteDef.key);
        }

        const activeCustomBattles = new Set();
        let customBattleSetupSeq = 0;
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
                    if (!battle.ownsBoardRestrictions(battle.activationCallback)) continue;
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
                    if (!battle.ownsBoardRestrictions(battle.activationCallback)) continue;
                    if (battle.isBoardBattleActive()) continue;
                    const toast = showToastCallback || battle._overlapToastCallback || null;
                    if (battle.removeDuplicateAlliesFromBoard(toast)) {
                        battle.syncCustomVillainsIfNeeded?.();
                        break;
                    }
                    if (battle.removeAlliesOverlappingVillains(toast)) {
                        break;
                    }
                    if (battle.removeAlliesOverlappingForcedAllies(toast)) {
                        battle.syncCustomVillainsIfNeeded?.();
                        break;
                    }
                    if (battle.removeAlliesOutsideAllowedTiles(toast)) {
                        break;
                    }
                    // Even without ally removals, restore missing custom villains
                    // (e.g. game replaced a villain when dropping an ally on its tile).
                    battle.syncCustomVillainsIfNeeded?.();
                } catch (_) {}
            }
        }

        let globalBoardConfigSanitizeLock = false;

        function sendBoardSetState(fn) {
            if (!globalThis.state?.board) return false;
            const run = (prev) => {
                const next = typeof fn === 'function' ? fn(prev) : fn;
                if (!next || next === prev) return next;
                if ('boardConfig' in next) {
                    return {
                        ...next,
                        boardConfig: compactBoardConfigEntries(next.boardConfig)
                    };
                }
                return next;
            };
            try {
                if (globalThis.state.board.trigger?.setState) {
                    globalThis.state.board.trigger.setState({ fn: run });
                    return true;
                }
                if (globalThis.state.board.send) {
                    globalThis.state.board.send({ type: 'setState', fn: run });
                    return true;
                }
            } catch (_) {}
            return false;
        }

        function compactBoardConfigEntries(boardConfig) {
            if (!Array.isArray(boardConfig)) return [];
            return boardConfig.filter((entity) => {
                return entity != null
                    && typeof entity === 'object'
                    && Number.isFinite(Number(entity.tileIndex));
            });
        }

        function sanitizeBoardConfigNullEntries() {
            if (globalBoardConfigSanitizeLock || !globalThis.state?.board) return false;
            let raw = null;
            try {
                raw = globalThis.state.board.getSnapshot()?.context?.boardConfig;
            } catch (_) {
                return false;
            }
            if (!Array.isArray(raw) || !raw.some((entity) => entity == null)) return false;
            globalBoardConfigSanitizeLock = true;
            try {
                sendBoardSetState((prev) => ({
                    ...prev,
                    boardConfig: compactBoardConfigEntries(prev?.boardConfig)
                }));
                return true;
            } catch (_) {
                return false;
            } finally {
                globalBoardConfigSanitizeLock = false;
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
                    sanitizeBoardConfigNullEntries();
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
                this.outfitSpriteOverrideIntervalStopTimer = null;
                this._outfitOverrideMissLogCount = 0;
                this._outfitOverrideMissLogByKey = new Map();
                this._namedPieceMissLogByKey = new Map();
                this.geneIntegrityTimerIds = [];
                this.preBattleGeneTamperCount = 0;
                this.lastPreBattleGeneIntegrityCheckAt = 0;
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
                this._setupSeq = 0;
                this._placementHitboxSnapshot = null;
                this._placementHitboxMaskActive = false;
                this._placementHitboxHooks = null;
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
                this.removeItemSpriteTileOverlays();
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
             * Rebuild board villains/allies immediately, bypassing in-battle-area gating.
             * Useful for quests that need custom villains present before delayed entry checks.
             */
            forceImmediateBoardRewrite() {
                try {
                    if (this.isBoardBattleActive()) return false;
                    this.removeOriginalVillains();
                    return true;
                } catch (error) {
                    console.error('[Custom Battles] Error in forceImmediateBoardRewrite:', error);
                    return false;
                }
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
             * Priority when multiple CustomBattles are active on the same room
             * (e.g. Map Editor test + Quests Sewers). Higher wins board authority.
             */
            getRestrictionPriority() {
                let score = Number(this._setupSeq) || 0;
                if (this.config.victoryDefeat) score += 1000;
                if (this.config.tileRestrictions?.allowedTiles?.length) score += 100;
                if (this.config.tileRestrictions?.blockedTiles?.length) score += 50;
                const name = String(this.config.name || '');
                if (/map editor test/i.test(name)) score -= 500;
                return score;
            }

            /**
             * Only one active battle per room should enforce ally limits / placement masks.
             */
            ownsBoardRestrictions(activationCallback) {
                if (!this.isActive) return false;
                if (!this.shouldRestrictionsBeActive(activationCallback ?? this.activationCallback)) return false;
                const roomId = this.config.roomId;
                let best = this;
                let bestScore = this.getRestrictionPriority();
                for (const battle of activeCustomBattles) {
                    if (battle === this || !battle.isActive) continue;
                    if (battle.config?.roomId !== roomId) continue;
                    if (!battle.shouldRestrictionsBeActive(battle.activationCallback)) continue;
                    const score = battle.getRestrictionPriority();
                    if (score > bestScore) {
                        best = battle;
                        bestScore = score;
                    }
                }
                return best === this;
            }

            getRoomHitboxesArray() {
                try {
                    const roomId = this.config?.roomId;
                    // Prefer this battle's room graph — selectedRoom may still be the entry
                    // map (e.g. Wyda) when restrictions are set up before navigation.
                    if (roomId) {
                        try {
                            const utils = globalThis.state?.utils;
                            if (Array.isArray(utils?.ROOMS)) {
                                const fromRooms = utils.ROOMS.find((room) => room?.id === roomId);
                                if (fromRooms?.file?.data) {
                                    if (!Array.isArray(fromRooms.file.data.hitboxes)) {
                                        fromRooms.file.data.hitboxes = [];
                                    }
                                    return fromRooms.file.data.hitboxes;
                                }
                            }
                            if (Array.isArray(utils?.REGIONS)) {
                                for (const region of utils.REGIONS) {
                                    const match = (region?.rooms || []).find((room) => room?.id === roomId);
                                    if (match?.file?.data) {
                                        if (!Array.isArray(match.file.data.hitboxes)) {
                                            match.file.data.hitboxes = [];
                                        }
                                        return match.file.data.hitboxes;
                                    }
                                }
                            }
                        } catch (_) {}
                    }
                    const room = globalThis.state?.board?.getSnapshot?.()?.context?.selectedMap?.selectedRoom
                        || globalThis.state?.selectedMap?.selectedRoom;
                    if (roomId && room?.id && room.id !== roomId) return null;
                    const data = room?.file?.data;
                    if (!data) return null;
                    if (!Array.isArray(data.hitboxes)) data.hitboxes = [];
                    return data.hitboxes;
                } catch (_) {
                    return null;
                }
            }

            /**
             * selectedRoom + utils.ROOMS/REGIONS can be different object graphs — patch all.
             */
            forEachRoomDataWithHitboxes(callback) {
                if (typeof callback !== 'function' || !this.config?.roomId) return;
                const seen = new Set();
                const visit = (data) => {
                    if (!data || typeof data !== 'object' || seen.has(data)) return;
                    seen.add(data);
                    if (!Array.isArray(data.hitboxes)) data.hitboxes = [];
                    callback(data);
                };
                try {
                    const selected = globalThis.state?.board?.getSnapshot?.()?.context?.selectedMap?.selectedRoom
                        || globalThis.state?.selectedMap?.selectedRoom;
                    if (selected?.id === this.config.roomId) visit(selected.file?.data);
                } catch (_) {}
                try {
                    const utils = globalThis.state?.utils;
                    if (Array.isArray(utils?.ROOMS)) {
                        utils.ROOMS.forEach((room) => {
                            if (room?.id === this.config.roomId) visit(room.file?.data);
                        });
                    }
                    if (Array.isArray(utils?.REGIONS)) {
                        utils.REGIONS.forEach((region) => {
                            (region?.rooms || []).forEach((room) => {
                                if (room?.id === this.config.roomId) visit(room.file?.data);
                            });
                        });
                    }
                } catch (_) {}
            }

            /**
             * Mutate hitboxes in place. Replacing the array orphans any game/React refs
             * captured at room load — drag-placement highlights keep the old walkable set.
             * @param {unknown[]} nextHitboxes
             * @param {{ bump?: boolean }} [options] bump=false skips board setState (ally-drag remasks)
             */
            writeHitboxesInPlace(nextHitboxes, options = {}) {
                if (!Array.isArray(nextHitboxes)) return false;
                let changed = false;
                this.forEachRoomDataWithHitboxes((data) => {
                    let target = data.hitboxes;
                    if (!Array.isArray(target)) {
                        data.hitboxes = nextHitboxes.slice();
                        changed = true;
                        return;
                    }
                    for (let i = 0; i < nextHitboxes.length; i += 1) {
                        if (target[i] !== nextHitboxes[i]) {
                            target[i] = nextHitboxes[i];
                            changed = true;
                        }
                    }
                    if (target.length > nextHitboxes.length) {
                        target.length = nextHitboxes.length;
                        changed = true;
                    }
                });
                if (changed && options.bump !== false) this.bumpSelectedRoomFileIdentity();
                return true;
            }

            /**
             * Nudge board/React to re-read room.file.data while keeping the same hitboxes array.
             */
            bumpSelectedRoomFileIdentity() {
                try {
                    const room = globalThis.state?.board?.getSnapshot?.()?.context?.selectedMap?.selectedRoom
                        || globalThis.state?.selectedMap?.selectedRoom;
                    if (!room?.file?.data || room.id !== this.config?.roomId) return false;
                    const data = room.file.data;
                    room.file = { ...room.file, data: { ...data, hitboxes: data.hitboxes } };
                    const board = globalThis.state?.board;
                    if (board?.trigger?.setState) {
                        board.trigger.setState({
                            fn: (prev) => {
                                const selected = prev?.selectedMap?.selectedRoom;
                                if (!selected || selected.id !== this.config.roomId) return prev;
                                const fileData = selected.file?.data;
                                if (!fileData) return prev;
                                return {
                                    ...prev,
                                    selectedMap: {
                                        ...prev.selectedMap,
                                        selectedRoom: {
                                            ...selected,
                                            file: {
                                                ...selected.file,
                                                data: { ...fileData, hitboxes: fileData.hitboxes }
                                            }
                                        }
                                    }
                                };
                            }
                        });
                    }
                    return true;
                } catch (_) {
                    return false;
                }
            }

            /**
             * Walkable tiles for the pre-battle hitbox mask.
             * - Default: allow-spawn ∪ villain (and forced-ally) tiles — villains stay
             *   unblocked so the fight can start.
             * - allyDrag: allow-spawn only — villain tiles stay blocked so ally drag
             *   highlights do not light them up. Ally drops still use allowedTiles filters.
             */
            getPlacementMaskWalkableTiles(options = {}) {
                const allowed = this.getAllowedPlayerTiles?.();
                if (!allowed?.size) return null;
                const walkable = new Set(allowed);
                if (options.allyDrag === true) return walkable;
                this.getVillainOccupiedTiles?.()?.forEach((tileIndex) => {
                    const index = Number(tileIndex);
                    if (Number.isFinite(index)) walkable.add(index);
                });
                this.getForcedAllyOccupiedTiles?.()?.forEach((tileIndex) => {
                    const index = Number(tileIndex);
                    if (Number.isFinite(index)) walkable.add(index);
                });
                return walkable;
            }

            /**
             * Pre-battle placement mask. Combat hitboxes restore when the fight starts.
             * @param {{ allyDrag?: boolean }} [options]
             */
            applyPlacementHitboxMask(options = {}) {
                // Opt-out (config.tileRestrictions.noHitboxMask: true): allowedTiles still
                // drives the setup-time filter (reject/toast on invalid drops via
                // filterSetupPreventAllyOutsideAllowedTiles etc.) and getAllowedPlayerTiles(),
                // but this function — the ONLY place that ever writes to
                // room.file.data.hitboxes for placement purposes — becomes a hard no-op. Single
                // choke point so no caller (drag hooks, syncPlacementHitboxMask, etc.) can ever
                // touch hitboxes for this battle, regardless of how it got invoked.
                if (this.config.tileRestrictions?.noHitboxMask === true) return false;
                const walkable = this.getPlacementMaskWalkableTiles?.(options);
                if (!walkable?.size) return false;
                if (this.isBoardBattleActive()) return false;

                if (!this._placementHitboxMaskActive) {
                    const hitboxes = this.getRoomHitboxesArray();
                    if (!hitboxes) return false;
                    this._placementHitboxSnapshot = hitboxes.slice();
                }
                const snapshot = this._placementHitboxSnapshot;
                if (!Array.isArray(snapshot)) return false;

                let maxIndex = Math.max(snapshot.length - 1, 0);
                walkable.forEach((tileIndex) => {
                    if (tileIndex > maxIndex) maxIndex = tileIndex;
                });

                const masked = snapshot.slice();
                while (masked.length <= maxIndex) masked.push(null);
                for (let i = 0; i < masked.length; i += 1) {
                    masked[i] = walkable.has(i) ? false : true;
                }

                this.writeHitboxesInPlace(masked, {
                    // Avoid board setState during ally-drag remasks — subscribe would
                    // race and re-apply the idle (villain-walkable) mask.
                    bump: options.allyDrag !== true
                });
                this._placementHitboxMaskActive = true;
                this._placementHitboxAllyDrag = options.allyDrag === true;

                // Generic, opt-in diagnostic (config.debugPlacementMask: true) — logs the
                // COMPLETE allowed/blocked tile list for every tile actually present in the
                // live `masked` array (the exact thing just written to room.file.data.hitboxes),
                // as plain joined strings rather than console object previews, so pasting the
                // log elsewhere carries the full list instead of a collapsed "Array(N)". Also
                // logs which villain/forced-ally tiles fed into the walkable set. Available to
                // any battle, not just one.
                if (this.config.debugPlacementMask === true) {
                    const villainTiles = [...(this.getVillainOccupiedTiles?.() || [])].sort((a, b) => a - b);
                    const forcedAllyTiles = [...(this.getForcedAllyOccupiedTiles?.() || [])].sort((a, b) => a - b);
                    const allowedList = [];
                    const blockedList = [];
                    for (let i = 0; i < masked.length; i += 1) {
                        if (masked[i] === true) blockedList.push(i);
                        else allowedList.push(i);
                    }
                    const battleName = this.config.name || 'Battle';
                    console.log(`[Custom Battles][${battleName}][debug-mask] applyPlacementHitboxMask (allyDrag: ${options.allyDrag === true}) — tileCount: ${masked.length}`);
                    console.log(`[Custom Battles][${battleName}][debug-mask] ALLOWED (${allowedList.length}): ${allowedList.join(', ')}`);
                    console.log(`[Custom Battles][${battleName}][debug-mask] BLOCKED (${blockedList.length}): ${blockedList.join(', ')}`);
                    console.log(`[Custom Battles][${battleName}][debug-mask] configAllowedTiles: ${(this.config.tileRestrictions?.allowedTiles || []).join(', ')} | villainOccupiedTiles: ${villainTiles.join(', ')} | forcedAllyOccupiedTiles: ${forcedAllyTiles.join(', ')}`);
                    // allyDrag passes deliberately exclude villain tiles from walkable (see
                    // getPlacementMaskWalkableTiles above) so ally-drop highlights don't light
                    // them up — that's correct, expected behavior, not a bug. Only warn when
                    // villain tiles are missing OUTSIDE that intentional window, since that's
                    // the only case that would actually mean something's wrong.
                    if (options.allyDrag !== true) {
                        const missingVillain = villainTiles.filter((t) => masked[t] === true);
                        if (missingVillain.length) {
                            console.warn(`[Custom Battles][${battleName}][debug-mask] villain tile(s) reading BLOCKED: ${missingVillain.join(', ')}`);
                        }
                    }
                }
                return true;
            }

            restorePlacementHitboxes() {
                // Gating purely on _placementHitboxMaskActive is unsafe: that flag has been
                // observed to flip false (e.g. mid drag-start/drag-end/sync churn) without the
                // hitbox array actually being written back yet, leaving the board stuck on the
                // narrow masked set. If a snapshot is still sitting here, restore it regardless
                // of what the flag currently says — a redundant write is harmless, a skipped
                // one leaves real gameplay hitboxes corrupted.
                const snapshot = this._placementHitboxSnapshot;
                if (!this._placementHitboxMaskActive && !Array.isArray(snapshot)) {
                    this._placementHitboxAllyDrag = false;
                    return false;
                }
                if (Array.isArray(snapshot)) {
                    this.writeHitboxesInPlace(snapshot);
                }
                this._placementHitboxMaskActive = false;
                this._placementHitboxSnapshot = null;
                this._placementHitboxAllyDrag = false;
                return true;
            }

            syncPlacementHitboxMask(activationCallback = this.activationCallback, options = {}) {
                if (!this.config.tileRestrictions?.allowedTiles?.length) {
                    this.restorePlacementHitboxes();
                    return false;
                }
                const shouldMask = this.ownsBoardRestrictions(activationCallback) && !this.isBoardBattleActive();
                if (shouldMask) return this.applyPlacementHitboxMask(options);
                this.restorePlacementHitboxes();
                return false;
            }

            /**
             * Drop any active mask, then remask from current live combat hitboxes.
             * Use after quest tile/hitbox mutations so the combat snapshot includes them.
             */
            refreshPlacementHitboxMaskFromLive(activationCallback = this.activationCallback, options = {}) {
                this.restorePlacementHitboxes();
                return this.syncPlacementHitboxMask(activationCallback, options);
            }

            /**
             * Single source of truth for "keep re-applying quest tile mutations / re-syncing
             * the placement hitbox mask for as long as this battle is active." Every quest
             * used to hand-roll its own copy of this (a fixed short retry burst after entry,
             * e.g. scheduleSewersBattlefieldVisuals/scheduleHellgateBattlefieldVisuals) plus,
             * separately, its own persistent board subscription to keep it going afterward
             * (e.g. setupSewersPortalObserver). Hellgate Part 1 shipped with only the retry
             * burst and no persistent subscription — nothing re-synced the hitbox mask after
             * the initial ~2s window closed, so any later ally placement/drag could leave
             * allowed/blocked tiles stuck wrong for the rest of the battle with no way to
             * self-correct. Centralizing both halves here means every quest (present and
             * future, including anything wired from a Map Editor export) gets the same
             * battle-tested behavior for free instead of re-deriving it per quest.
             *
             * @param {() => void} applyFn - Quest-specific: writes this room's tile-mutation
             *   sprites/hitboxes, then typically calls this.refreshPlacementHitboxMaskFromLive
             *   (or syncPlacementHitboxMask) to fold them into the live mask.
             * @param {{ isActiveCheck?: () => boolean, retryDelaysMs?: number[] }} [options]
             *   isActiveCheck: quest-specific "is the player actually in this quest right now"
             *   flag (e.g. playerFollowedElathrielToHellgate) — checked alongside this.isActive
             *   before every call, including ones from the persistent subscription.
             */
            startPersistentVisualSync(applyFn, options = {}) {
                if (typeof applyFn !== 'function') return;
                this.stopPersistentVisualSync();

                const isActiveCheck = typeof options.isActiveCheck === 'function' ? options.isActiveCheck : () => true;
                const retryDelaysMs = Array.isArray(options.retryDelaysMs)
                    ? options.retryDelaysMs
                    : [0, 50, 150, 300, 500, 800, 1200, 2000];

                const guardedApply = () => {
                    if (!this.isActive || !isActiveCheck()) return;
                    try {
                        applyFn();
                    } catch (error) {
                        console.error(`[Custom Battles][${this.config.name || 'Battle'}] Error in persistent visual sync:`, error);
                    }
                };

                this._visualSyncRetryTimers = [];
                guardedApply();
                retryDelaysMs.forEach((delay) => {
                    if (delay <= 0) return;
                    this._visualSyncRetryTimers.push(setTimeout(guardedApply, delay));
                });

                if (globalThis.state?.board?.subscribe) {
                    this._visualSyncSubscription = globalThis.state.board.subscribe(guardedApply);
                }
            }

            /**
             * Torn down automatically by cleanup() — quest code does not need to call this
             * itself unless it wants to stop the sync early while the battle stays active.
             */
            stopPersistentVisualSync() {
                if (this._visualSyncRetryTimers?.length) {
                    this._visualSyncRetryTimers.forEach((id) => clearTimeout(id));
                }
                this._visualSyncRetryTimers = [];
                if (this._visualSyncSubscription) {
                    try {
                        this._visualSyncSubscription.unsubscribe();
                    } catch (error) {
                        console.warn(`[Custom Battles][${this.config.name || 'Battle'}] Error unsubscribing persistent visual sync:`, error);
                    }
                    this._visualSyncSubscription = null;
                }
            }

            /**
             * Drag-time spawn-tile overlay for noHitboxMask battles (config.tileRestrictions.
             * noHitboxMask === true). applyPlacementHitboxMask() is a hard no-op under that
             * flag — room.file.data.hitboxes is never touched — so the native walkable-tile
             * highlight can't be used to show spawn tiles.
             *
             * Same technique/styling as Map Editor's own updatePlacementOverlay() (Map_Editor.
             * js) for its allowed tiles: a CSS <div> painted directly onto each spawn tile
             * (blue, non-destructive DOM overlay) rather than real hitbox mutation — Map
             * Editor's own code does the same thing for the same reason (see its "Visual
             * fallback... even if the native game ignores live hitbox mutations" comment).
             * Unlike Map Editor's persistent toggle, this only paints spawn tiles (no dimming
             * of blocked ones) and only while actively dragging an ally — see the
             * onDragStart/onDragEnd wiring in setupPlacementHitboxMaskHooks() below.
             */
            getAllTileElementsWithIndex() {
                const nodes = document.querySelectorAll('[id^="tile-index-"]');
                const out = [];
                nodes.forEach((element) => {
                    const match = /^tile-index-(\d+)$/.exec(element.id || '');
                    if (!match) return;
                    out.push({ tileIndex: Number(match[1]), element });
                });
                return out;
            }

            showSpawnTileHighlights() {
                if (this.isBoardBattleActive()) return false;
                if (!this.ownsBoardRestrictions(this.activationCallback)) return false;
                const allowedTiles = this.config.tileRestrictions?.allowedTiles;
                if (!Array.isArray(allowedTiles) || !allowedTiles.length) return false;
                const allowed = new Set(allowedTiles.map((tileIndex) => Number(tileIndex)));
                const tiles = this.getAllTileElementsWithIndex();
                if (!tiles.length) return false;
                const marker = `data-custom-battle-spawn-overlay-${this._setupSeq}`;
                tiles.forEach(({ tileIndex, element }) => {
                    if (!allowed.has(tileIndex)) return;
                    // Per-tile dedup, not a whole-battle flag — safe (and necessary) to call
                    // this repeatedly to top up any overlay tiles a native re-render wiped out.
                    if (element.querySelector(`[${marker}]`)) return;
                    const overlay = document.createElement('div');
                    overlay.setAttribute(marker, '1');
                    overlay.style.cssText = 'position:absolute;right:0;bottom:0;'
                        + 'width:calc(32px * var(--zoomFactor));height:calc(32px * var(--zoomFactor));'
                        + 'pointer-events:none;z-index:9999;background:rgba(64,160,255,.45);'
                        + 'box-shadow:inset 0 0 0 1px rgba(120,200,255,.8);';
                    element.appendChild(overlay);
                });
                this._spawnTileHighlightActive = true;
                return true;
            }

            hideSpawnTileHighlights() {
                if (!this._spawnTileHighlightActive) return;
                document.querySelectorAll(`[data-custom-battle-spawn-overlay-${this._setupSeq}]`).forEach((el) => el.remove());
                this._spawnTileHighlightActive = false;
            }

            isLikelyAllyDragSource(target) {
                if (!target || typeof target.closest !== 'function') return false;
                if (target.closest('button[aria-roledescription="draggable"]')) return true;
                if (target.closest('[class*="bestiary"]')) return true;
                if (target.closest('#bestiary, .bestiary, [data-bestiary]')) return true;
                if (target.closest('.outfit') && !target.closest('#viewport, #board, #background-scene, [id^="tile-index-"]')) {
                    return true;
                }
                return false;
            }

            setupPlacementHitboxMaskHooks() {
                if (this._placementHitboxHooks || !this.config.tileRestrictions?.allowedTiles?.length) return;
                if (!globalThis.state?.board?.on) return;

                const noHitboxMask = this.config.tileRestrictions?.noHitboxMask === true;

                if (noHitboxMask) {
                    // Nothing in room.file.data.hitboxes ever changes for this battle, so battle
                    // start/end has no combat-hitbox restore/remask to do — just make sure a
                    // leftover drag overlay never survives into combat. autoSetupBoard only tops
                    // the overlay up (doesn't turn it on) so a native re-render mid-drag can't
                    // wipe its <div>s out from under an in-progress drag without this noticing —
                    // it stays a no-op while idle, since showSpawnTileHighlights() is drag-scoped.
                    this._placementHitboxHooks = [
                        globalThis.state.board.on('before-game-start', () => this.hideSpawnTileHighlights()),
                        globalThis.state.board.on('emitNewGame', () => this.hideSpawnTileHighlights()),
                        globalThis.state.board.on('autoSetupBoard', () => {
                            if (this._spawnTileHighlightActive) this.showSpawnTileHighlights();
                        })
                    ].filter((unsub) => typeof unsub === 'function');
                } else {
                    const onBattleStart = () => {
                        if (this._placementHitboxMaskActive) {
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Restoring combat hitboxes for battle start`);
                        }
                        this.restorePlacementHitboxes();
                    };
                    const onBattleEnd = () => {
                        setTimeout(() => this.syncPlacementHitboxMask(this.activationCallback), 0);
                    };

                    this._placementHitboxHooks = [
                        globalThis.state.board.on('before-game-start', onBattleStart),
                        globalThis.state.board.on('emitNewGame', onBattleStart),
                        globalThis.state.board.on('emitEndGame', onBattleEnd)
                    ].filter((unsub) => typeof unsub === 'function');
                }

                // While dragging allies: hide villain tiles from walkable highlights (hitbox-mask
                // battles), or paint the spawn-tile overlay (noHitboxMask battles).
                // Idle / ready-to-start: keep villain tiles walkable / hide the overlay.
                if (!this._allyDragMaskHandlers) {
                    const onDragStart = (event) => {
                        if (this.isBoardBattleActive()) return;
                        if (!this.ownsBoardRestrictions(this.activationCallback)) return;
                        if (!this.isLikelyAllyDragSource(event.target)) return;
                        if (this._allyDragEndTimer) {
                            clearTimeout(this._allyDragEndTimer);
                            this._allyDragEndTimer = null;
                        }
                        if (noHitboxMask) {
                            this.showSpawnTileHighlights();
                            return;
                        }
                        if (!this._placementHitboxMaskActive && !this.config.tileRestrictions?.allowedTiles?.length) return;
                        this.applyPlacementHitboxMask({ allyDrag: true });
                    };
                    const onDragEnd = () => {
                        if (noHitboxMask) {
                            if (!this._spawnTileHighlightActive) return;
                            // Same settle delay as the hitbox-mask path below, so a drop isn't
                            // still resolving when the overlay disappears out from under it.
                            if (this._allyDragEndTimer) clearTimeout(this._allyDragEndTimer);
                            this._allyDragEndTimer = setTimeout(() => {
                                this._allyDragEndTimer = null;
                                this.hideSpawnTileHighlights();
                            }, 120);
                            return;
                        }
                        if (!this._placementHitboxAllyDrag) return;
                        if (this.isBoardBattleActive()) return;
                        if (!this.config.tileRestrictions?.allowedTiles?.length) return;
                        // Delay remasking villains walkable until after drop/autoSetupBoard settles,
                        // otherwise the game can accept a drop onto a villain tile mid-release.
                        if (this._allyDragEndTimer) clearTimeout(this._allyDragEndTimer);
                        this._allyDragEndTimer = setTimeout(() => {
                            this._allyDragEndTimer = null;
                            if (!this._placementHitboxAllyDrag) return;
                            if (this.isBoardBattleActive()) return;
                            this.syncPlacementHitboxMask(this.activationCallback, { allyDrag: false });
                        }, 120);
                    };
                    this._allyDragMaskHandlers = { onDragStart, onDragEnd };
                    document.addEventListener('dragstart', onDragStart, true);
                    document.addEventListener('pointerdown', onDragStart, true);
                    document.addEventListener('dragend', onDragEnd, true);
                    document.addEventListener('pointerup', onDragEnd, true);
                }
            }

            cleanupPlacementHitboxMaskHooks() {
                if (this._placementHitboxHooks?.length) {
                    this._placementHitboxHooks.forEach((unsub) => {
                        try { unsub(); } catch (_) {}
                    });
                }
                this._placementHitboxHooks = null;
                if (this._allyDragEndTimer) {
                    clearTimeout(this._allyDragEndTimer);
                    this._allyDragEndTimer = null;
                }
                if (this._allyDragMaskHandlers) {
                    const { onDragStart, onDragEnd } = this._allyDragMaskHandlers;
                    document.removeEventListener('dragstart', onDragStart, true);
                    document.removeEventListener('pointerdown', onDragStart, true);
                    document.removeEventListener('dragend', onDragEnd, true);
                    document.removeEventListener('pointerup', onDragEnd, true);
                    this._allyDragMaskHandlers = null;
                }
                this.restorePlacementHitboxes();
                this.hideSpawnTileHighlights();
            }

            /**
             * Count ally creatures on board (includes forced custom allies).
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
             * Count player-placed allies only (excludes forced custom allies).
             * Matches allyLimit / max-creature enforcement.
             */
            countPlayerAllyCreatures() {
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot()?.context;
                    const boardConfig = boardContext?.boardConfig || [];
                    return boardConfig.filter((piece) => {
                        if (!this.isAllyPiece(piece)) return false;
                        return !this.isForcedAllyEntity(piece);
                    }).length;
                } catch (error) {
                    console.error('[Custom Battles] Error counting player allies:', error);
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
                    ...(villainConfig.itemSpriteId != null ? { itemSpriteId: villainConfig.itemSpriteId } : {}),
                    ...(villainConfig.customSpriteKey != null ? { customSpriteKey: villainConfig.customSpriteKey } : {}),
                    genes: villainConfig.genes || {
                        hp: 20,
                        ad: 20,
                        ap: 20,
                        armor: 20,
                        magicResist: 20
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
                    ...(allyConfig.itemSpriteId != null ? { itemSpriteId: allyConfig.itemSpriteId } : {}),
                    ...(allyConfig.customSpriteKey != null ? { customSpriteKey: allyConfig.customSpriteKey } : {}),
                    genes: allyConfig.genes || {
                        hp: 20,
                        ad: 20,
                        ap: 20,
                        armor: 20,
                        magicResist: 20
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
                        // Same eviction as removeOriginalVillains(): don't let a player piece
                        // that landed on a forced ally's tile coexist with the forced ally there.
                        const reservedTiles = new Set(this.getConfiguredCustomPieceTiles());
                        const withoutForced = boardConfig.filter((entity) =>
                            !this.isForcedAllyEntity(entity) && !reservedTiles.has(Number(entity.tileIndex))
                        );
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

            getConfiguredGeneIntegrityPieces() {
                const normalize = (piece, isVillain) => {
                    if (!piece?.genes || typeof piece.genes !== 'object') return null;
                    return {
                        isVillain,
                        tileIndex: Number(piece.tileIndex),
                        nickname: String(piece.nickname || piece.name || ''),
                        gameId: Number(piece.gameId),
                        genes: piece.genes
                    };
                };
                const villains = (this.config.villains || [])
                    .map((v) => normalize(v, true))
                    .filter(Boolean);
                const allies = (this.config.allies || [])
                    .map((a) => normalize(a, false))
                    .filter(Boolean);
                return [...villains, ...allies];
            }

            clearGeneIntegrityTimers() {
                while (this.geneIntegrityTimerIds.length > 0) {
                    const timerId = this.geneIntegrityTimerIds.pop();
                    clearTimeout(timerId);
                }
            }

            maybeRunPreBattleGeneIntegrityCheck() {
                if (!this.isActive) return false;
                if (this.isBoardBattleActive()) return false;
                const now = Date.now();
                if (now - this.lastPreBattleGeneIntegrityCheckAt < 400) return false;
                this.lastPreBattleGeneIntegrityCheckAt = now;
                const changed = this.enforceConfiguredGenesIntegrity(null, 'pre-battle-watch');
                if (changed) {
                    this.preBattleGeneTamperCount += 1;
                    console.warn(
                        `[Custom Battles][${this.config.name || 'Battle'}] Pre-battle gene tamper detected and corrected (#${this.preBattleGeneTamperCount})`
                    );
                }
                return changed;
            }

            getActorTileIndex(actor) {
                const raw = actor?.position?.tile?.index
                    ?? actor?.position?.tileIndex
                    ?? actor?.tileIndex
                    ?? actor?.spawnTileIndex
                    ?? actor?.initialTileIndex;
                const tile = Number(raw);
                return Number.isFinite(tile) ? tile : null;
            }

            applyGenesToContainer(container, genes) {
                if (!container || typeof container !== 'object' || !genes || typeof genes !== 'object') return false;
                let changed = false;
                const setNumeric = (key, value) => {
                    const n = Number(value);
                    if (!Number.isFinite(n)) return;
                    if (Number(container[key]) === n) return;
                    container[key] = n;
                    changed = true;
                };
                setNumeric('hp', genes.hp);
                setNumeric('ad', genes.ad);
                setNumeric('ap', genes.ap);
                setNumeric('armor', genes.armor);
                if ('magicResist' in container || !('mr' in container)) {
                    setNumeric('magicResist', genes.magicResist);
                }
                if ('mr' in container) {
                    setNumeric('mr', genes.magicResist);
                }
                return changed;
            }

            boardEntityMatchesGenePiece(entity, piece) {
                if (!entity || !!entity.villain !== !!piece.isVillain) return false;
                if (Number.isFinite(piece.tileIndex) && Number(entity.tileIndex) !== piece.tileIndex) return false;
                if (Number.isFinite(piece.gameId)) {
                    const entityGameId = Number(entity.gameId ?? entity.monsterId ?? entity.databaseId);
                    if (Number.isFinite(entityGameId) && entityGameId !== piece.gameId) return false;
                }
                if (piece.nickname) {
                    const entityName = String(entity.nickname || entity.name || '');
                    if (entityName && entityName !== piece.nickname) return false;
                }
                return true;
            }

            actorMatchesGenePiece(actor, piece) {
                if (!actor || !!actor.villain !== !!piece.isVillain) return false;
                if (Number.isFinite(piece.tileIndex)) {
                    const actorTile = this.getActorTileIndex(actor);
                    if (Number.isFinite(actorTile) && actorTile !== piece.tileIndex) return false;
                }
                if (Number.isFinite(piece.gameId)) {
                    const actorGameId = Number(actor.gameId ?? actor.monsterId ?? actor.metadata?.id ?? actor.metadata?.gameId);
                    if (Number.isFinite(actorGameId) && actorGameId !== piece.gameId) return false;
                }
                if (piece.nickname) {
                    const actorName = String(actor.name || actor.metadata?.name || actor.nickname || '');
                    if (actorName && actorName !== piece.nickname) return false;
                }
                return true;
            }

            enforceConfiguredGenesIntegrity(world = null, reason = 'runtime') {
                const pieces = this.getConfiguredGeneIntegrityPieces();
                if (!pieces.length) return false;
                let changed = false;

                // Keep board config pieces aligned to configured genes.
                try {
                    const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
                    const boardConfig = Array.isArray(boardContext?.boardConfig) ? boardContext.boardConfig : [];
                    const patchedBoard = boardConfig.map((entity) => {
                        const piece = pieces.find((p) => this.boardEntityMatchesGenePiece(entity, p));
                        if (!piece) return entity;
                        if (!entity?.genes || typeof entity.genes !== 'object') {
                            changed = true;
                            return { ...entity, genes: { ...piece.genes } };
                        }
                        if (!this.applyGenesToContainer(entity.genes, piece.genes)) return entity;
                        changed = true;
                        return entity;
                    });
                    if (changed) {
                        globalThis.state.board.send({
                            type: 'setState',
                            fn: (prev) => ({ ...prev, boardConfig: patchedBoard })
                        });
                    }
                } catch (_) {
                    // no-op
                }

                // Keep runtime actor copies aligned as well.
                try {
                    const activeWorld = world || globalThis.state?.board?.getSnapshot?.()?.context?.world || null;
                    const entries = activeWorld?.grid?.childrenById?.entries?.();
                    const actors = [];
                    if (entries && typeof entries[Symbol.iterator] === 'function') {
                        for (const [, actor] of entries) actors.push(actor);
                    } else if (Array.isArray(activeWorld?.grid?.actors)) {
                        actors.push(...activeWorld.grid.actors);
                    }
                    actors.forEach((actor) => {
                        const piece = pieces.find((p) => this.actorMatchesGenePiece(actor, p));
                        if (!piece) return;
                        const containers = [
                            actor.genes,
                            actor.metadata?.genes,
                            actor.stats?.genes,
                            actor.baseGenes
                        ];
                        containers.forEach((container) => {
                            if (this.applyGenesToContainer(container, piece.genes)) changed = true;
                        });
                    });
                } catch (_) {
                    // no-op
                }

                if (changed) {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Enforced configured genes integrity (${reason})`);
                }
                return changed;
            }

            scheduleConfiguredGenesIntegrityChecks(world = null, reason = 'newGame') {
                const pieces = this.getConfiguredGeneIntegrityPieces();
                if (!pieces.length) return;
                this.clearGeneIntegrityTimers();
                this.enforceConfiguredGenesIntegrity(world, `${reason}-immediate`);
                [150, 600, 1200].forEach((delay) => {
                    const timerId = setTimeout(() => {
                        if (!this.isActive) return;
                        this.enforceConfiguredGenesIntegrity(world, `${reason}+${delay}ms`);
                    }, delay);
                    this.geneIntegrityTimerIds.push(timerId);
                });
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

            unlockCustomPieceButton(button) {
                if (!button || button.dataset.customBattleLocked !== '1') return false;
                button.disabled = false;
                button.removeAttribute('disabled');
                button.removeAttribute('aria-disabled');
                button.removeAttribute('tabindex');
                button.style.pointerEvents = '';
                button.style.cursor = '';
                delete button.dataset.customBattleLocked;
                if (button._customBattleLockHandler) {
                    const blockEvent = button._customBattleLockHandler;
                    ['pointerdown', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'dragstart', 'click', 'contextmenu', 'keydown'].forEach((eventName) => {
                        button.removeEventListener(eventName, blockEvent, true);
                    });
                    delete button._customBattleLockHandler;
                }
                return true;
            }

            /**
             * Undo accidental locks / opacity hides when a player ally lands on a
             * custom villain spawn tile (Oracle statues, etc.).
             */
            restoreForeignPiecesOnCustomTiles() {
                if (this.isBoardBattleActive()) return 0;
                const pieces = this.getConfiguredCustomPieces();
                if (!pieces.length) return 0;

                let restored = 0;
                pieces.forEach((piece) => {
                    const tileIndex = Number(piece.tileIndex);
                    if (!Number.isFinite(tileIndex)) return;
                    if (!this.tileHasForeignPlayerPiece(tileIndex, piece)) return;

                    this.removeItemSpriteTileOverlays(tileIndex);

                    this.findBoardPieceButtonsForTile(tileIndex).forEach((button) => {
                        if (this.buttonBelongsToCustomPiece(button, piece)) return;
                        if (this.unlockCustomPieceButton(button)) restored++;

                        button.querySelectorAll?.('.sprite.outfit, .sprite.item').forEach((sprite) => {
                            if (sprite.dataset.customBattleItemOverlay === '1') return;
                            if (this.spriteBelongsToCustomPiece(sprite, piece)) return;

                            if (sprite.dataset.customBattlePiece === '1'
                                && sprite.dataset.customBattleCombatId === String(piece.gameId)) {
                                delete sprite.dataset.customBattlePiece;
                                delete sprite.dataset.customBattleCombatId;
                                delete sprite.dataset.customBattleItemId;
                                delete sprite.dataset.customBattleOutfitId;
                                delete sprite.dataset.customBattleNickname;
                                restored++;
                            }
                            if (sprite.style.opacity === '0') {
                                sprite.style.opacity = '';
                                sprite.style.pointerEvents = '';
                                restored++;
                            }
                            sprite.querySelectorAll('img.actor, .actor.spritesheet, .quests-custom-outfit-sheet').forEach((node) => {
                                if (node.style.visibility === 'hidden' || node.style.opacity === '0') {
                                    node.style.visibility = '';
                                    node.style.opacity = '';
                                    restored++;
                                }
                            });
                        });
                    });
                });
                return restored;
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
                if (piece.itemSpriteId != null) {
                    sprite.dataset.customBattleItemId = String(piece.itemSpriteId);
                    sprite.dataset.customBattleOutfitId = String(piece.itemSpriteId);
                } else if (piece.outfitSpriteId != null) {
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
                if (piece?.itemSpriteId != null) return false;
                if (piece?.outfitSpriteId != null && Number(piece.outfitSpriteId) >= 1000) return false;
                // Short species-like names (e.g. "Minotaur") can collide with player creatures.
                return piece?.outfitSpriteId != null
                    && String(piece.outfitSpriteId) !== String(piece.gameId);
            }

            spriteBelongsToCustomPiece(sprite, piece) {
                if (!sprite?.classList || !piece || piece.gameId == null) return false;
                // Tile statue overlays are display-only; never treat them as the outfit shell.
                if (sprite.dataset.customBattleItemOverlay === '1') return false;

                // Only trust our own tagging as authoritative when it actually matches this
                // piece. A tag for a DIFFERENT combat id is not proof this sprite belongs to
                // someone else right now — React can reuse the same DOM node across different
                // creatures (e.g. piece A dies on a tile, piece B steps onto that same tile
                // next tick and gets the same node), leaving a stale tag behind. Falling
                // through to the live nickname/data-name check below — instead of vetoing on
                // the stale tag — is what lets a piece reclaim a node after a tile handoff
                // like that.
                //
                // Still require the sprite to currently sit on THIS piece's configured tile,
                // though: without that, a same-gameId player creature (e.g. a real Thalas,
                // sharing Rookstayer's fallback gameId) that happens to land on a DOM node the
                // game previously used for the custom ally elsewhere would inherit its stale
                // tag and get skinned as the ally purely by coincidence of gameId, never having
                // been anywhere near the ally's actual tile.
                //
                // CSS translate/position matching alone isn't enough mid-battle: creatures walk,
                // so a player's own same-species unit can transiently pass through the exact
                // screen coordinates of the ally's tile. Cross-check against the live boardConfig
                // — the authoritative source of who actually occupies that tile right now — so a
                // passer-by never gets claimed just for being in the right place for one tick.
                if (sprite.dataset.customBattlePiece === '1'
                    && sprite.dataset.customBattleCombatId === String(piece.gameId)
                    && this.spriteIsOnConfiguredTile(sprite, piece.tileIndex)
                    && this.tileConfigMatchesPiece(piece.tileIndex, piece)) {
                    if (piece.itemSpriteId != null
                        && sprite.dataset.customBattleItemId
                        && sprite.dataset.customBattleItemId !== String(piece.itemSpriteId)) {
                        return false;
                    }
                    if (piece.outfitSpriteId != null
                        && !piece.itemSpriteId
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

                // Empty name during setup: spawn tiles are reserved for configured pieces.
                // (Outfit visual id often differs from combat gameId — do not require id-class.)
                if (this.isBoardBattleActive()) return false;
                return true;
            }

            // Authoritative alternative to DOM/CSS position matching: is the entity the game
            // actually has assigned to this tile (per boardConfig) really this configured piece?
            // A player's own same-species creature walking through the tile's screen position
            // still won't have this piece's nickname in boardConfig, so it can't pass this check.
            tileConfigMatchesPiece(tileIndex, piece) {
                try {
                    const tile = Number(tileIndex);
                    if (!Number.isFinite(tile)) return false;
                    const nickname = piece?.nickname && String(piece.nickname).trim();
                    if (!nickname) return false;
                    const boardConfig = globalThis.state?.board?.getSnapshot?.()?.context?.boardConfig || [];
                    const entity = boardConfig.find((e) => Number(e?.tileIndex) === tile);
                    return !!entity && String(entity.nickname || '').trim() === nickname;
                } catch (_) {
                    return false;
                }
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

            getButtonDisplayName(button) {
                if (!button) return '';
                const root = button.closest?.('[data-name]') || button;
                return (root.getAttribute?.('data-name') || button.getAttribute?.('data-name') || '').trim();
            }

            /**
             * True when a differently-named player piece sits on this spawn tile.
             * Do not use outfit id-class vs combat gameId — those often differ (e.g. Stalker).
             */
            tileHasForeignPlayerPiece(tileIndex, piece) {
                const nickname = piece?.nickname && String(piece.nickname).trim();
                if (!nickname) return false;
                const buttons = this.findBoardPieceButtonsForTile(tileIndex);
                for (const button of buttons) {
                    const name = this.getButtonDisplayName(button);
                    if (name && name !== nickname) return true;
                }
                return false;
            }

            buttonBelongsToCustomPiece(button, piece) {
                if (!button || !piece) return false;

                const name = this.getButtonDisplayName(button);
                const nickname = piece.nickname && String(piece.nickname).trim();
                // Never lock a differently-named player ally that shares the spawn tile.
                if (name && nickname && name !== nickname) return false;

                const outfits = [...(button.querySelectorAll?.('.sprite.outfit') || [])];
                if (outfits.some((sprite) => this.spriteBelongsToCustomPiece(sprite, piece))) {
                    return true;
                }

                // Spawn tiles are reserved for configured pieces — lock by tile during setup
                // unless a foreign-named ally is present (handled above).
                if (this.spriteIsOnConfiguredTile(button, piece.tileIndex)
                    || outfits.some((sprite) => this.spriteIsOnConfiguredTile(sprite, piece.tileIndex))) {
                    return true;
                }

                return false;
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

                // actor.key is the custom identity string we stamp on boardConfig entries
                // in createCustomAllyEntity/createCustomVillainEntity. Only trust it as a
                // real string here — actor.entityTag on a LIVE combat actor is a Set (an
                // internal ECS tag set, not our identity string), and String(aSet) silently
                // stringifies to "[object Set]", a non-empty value that used to force a
                // false "no match" (villains) or get treated as a genuine miss (allies).
                const expectedPrefix = String(pieceConfig.keyPrefix || '').trim();
                const actorKey = typeof actor?.key === 'string' ? actor.key.trim() : '';
                if (expectedPrefix && actorKey) {
                    return actorKey.startsWith(expectedPrefix);
                }

                if (!isVillain && this.isForcedAllyEntity(actor)) return true;

                // The native engine doesn't carry actor.key forward onto the live actors it
                // builds once `newGame` fires — actorKey above is always empty mid-battle —
                // so keyPrefix/isForcedAllyEntity can only ever match during setup. Fall back
                // to spawn tileIndex, which is what actually disambiguates multiple pieces
                // sharing a gameId (e.g. 4 Minotaurs, 2 Rookstayers) once combat starts. This
                // is safe because gameId + the villain/ally flag already narrowed the
                // candidates above; it only risks mis-tagging if another same-species,
                // same-role actor has since moved onto this piece's now-vacated spawn tile.
                const expectedTile = Number(pieceConfig.tileIndex);
                const actorTile = this.getActorTileIndex(actor);
                if (Number.isFinite(expectedTile) && Number.isFinite(actorTile)) {
                    return actorTile === expectedTile;
                }

                // No tile to bind to. Allies stay unclaimed rather than risk renaming an
                // unrelated same-species player actor; villains default to matching since
                // gameId (and keyPrefix, when present) already narrowed the field.
                return isVillain;
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
                    const expectedGameId = Number(piece.gameId);

                    // Strict identity pass first (keyPrefix / forced-ally tag / setup tile
                    // binding). If it finds our actor, that's the only one eligible — the
                    // species fallback below never runs, so a player's own same-species
                    // creature standing right next to our ally is never touched by it.
                    let targets = actors.filter((actor) => this.actorMatchesNamedPiece(actor, piece, isVillain));

                    if (!targets.length && !isVillain && this.isBoardBattleActive()) {
                        // Resurrection can hand the revived actor a brand-new key/entityTag
                        // that no longer matches our tagging, so the strict pass above misses
                        // it — the nickname would otherwise never reapply and it reverts to
                        // showing its raw species. Recover by species, but only when exactly
                        // ONE actor of that species exists on the whole board right now: if a
                        // player's own same-species creature (e.g. a real Thalas sharing this
                        // ally's fallback gameId) is also present, this is ambiguous and must
                        // be left alone rather than guessed.
                        const sameSpeciesActors = actors.filter((a) =>
                            a.villain !== true && this.getActorGameId(a) === expectedGameId
                        );
                        if (sameSpeciesActors.length === 1) {
                            targets = sameSpeciesActors;
                        }
                    }

                    let matchedAny = false;
                    targets.forEach((actor) => {
                        matchedAny = true;
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

                    // Auto-diagnostic (no manual console command needed): if this named piece
                    // couldn't be matched to ANY actor despite same-species actors existing on
                    // the board, it's the exact "resurrection dropped our identity tags"
                    // failure mode — log everything needed to see why, throttled per piece.
                    if (!matchedAny) {
                        const sameSpecies = actors.filter((a) => this.getActorGameId(a) === Number(piece.gameId));
                        if (sameSpecies.length) {
                            const missKey = `${piece.gameId}|${piece.tileIndex}|${displayName}`;
                            const now = Date.now();
                            const lastAt = this._namedPieceMissLogByKey.get(missKey) || 0;
                            if (now - lastAt > 3000) {
                                this._namedPieceMissLogByKey.set(missKey, now);
                                const battleNameForLog = this.config.name || 'Battle';
                                console.warn(
                                    `[Custom Battles][${battleNameForLog}] Named ${isVillain ? 'villain' : 'ally'} "${displayName}" has no matching actor right now — it will show its raw species instead until re-matched`,
                                    {
                                        gameId: piece.gameId,
                                        keyPrefix: piece.keyPrefix,
                                        isBoardBattleActive: this.isBoardBattleActive(),
                                        candidateActors: sameSpecies.map((a) => ({
                                            key: a?.key,
                                            entityTag: a?.entityTag,
                                            name: a?.name,
                                            nickname: a?.nickname,
                                            villain: a?.villain,
                                            tileIndex: this.getActorTileIndex(a)
                                        }))
                                    }
                                );
                                // Same console-collapse problem as the hitbox diagnostic: the
                                // object preview above shows "Array(N)" and doesn't survive
                                // copy-paste unless manually expanded. Print each candidate as
                                // plain text too so a pasted log carries the actual key/entityTag
                                // that failed to match `keyPrefix`.
                                sameSpecies.forEach((a, idx) => {
                                    console.warn(`[Custom Battles][${battleNameForLog}] candidate[${idx}] key="${a?.key ?? ''}" entityTag="${a?.entityTag ?? ''}" name="${a?.name ?? ''}" nickname="${a?.nickname ?? ''}" villain=${a?.villain === true} tileIndex=${this.getActorTileIndex(a)} — expectedKeyPrefix="${piece.keyPrefix || ''}"`);
                                });
                            }
                        }
                    }
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
                this.restoreForeignPiecesOnCustomTiles();
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
                const hasVisualOverride = (pieceConfig) => {
                    if (!pieceConfig) return false;
                    if (pieceConfig.customSpriteKey != null) return true;
                    if (pieceConfig.itemSpriteId != null) return true;
                    const outfitSpriteId = pieceConfig.outfitSpriteId;
                    return outfitSpriteId != null && String(outfitSpriteId) !== String(pieceConfig.gameId);
                };
                const villains = (this.config.villains || []).filter(hasVisualOverride);
                const allies = (this.config.allies || []).filter(hasVisualOverride);
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
                    String(piece?.itemSpriteId ?? ''),
                    String(piece?.customSpriteKey ?? ''),
                    piece?.shiny === true ? '1' : '0'
                ].join('|');
            }

            shouldLogOutfitOverrideMiss(key) {
                const now = Date.now();
                const lastAt = this._outfitOverrideMissLogByKey.get(key) || 0;
                const underGlobalCap = this._outfitOverrideMissLogCount < 6;
                const perKeyWindowPassed = now - lastAt > 5000;
                if (!underGlobalCap || !perKeyWindowPassed) return false;
                this._outfitOverrideMissLogByKey.set(key, now);
                this._outfitOverrideMissLogCount += 1;
                return true;
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
                if (!piece || piece.gameId == null) return matched;
                if (piece.outfitSpriteId == null && piece.itemSpriteId == null && piece.customSpriteKey == null) {
                    return matched;
                }

                const combatGameId = String(piece.gameId);
                const visualId = String(piece.itemSpriteId ?? piece.outfitSpriteId ?? '');
                const useItemVisual = piece.itemSpriteId != null;
                const useCustomVisual = piece.customSpriteKey != null;

                document.querySelectorAll(
                    `.sprite[data-custom-battle-piece="1"][data-custom-battle-combat-id="${combatGameId}"]`
                ).forEach((sprite) => {
                    if (useCustomVisual) {
                        if (sprite.classList.contains(getCustomSpriteOverlayClass(piece.customSpriteKey))) {
                            matched.add(sprite);
                        }
                        return;
                    }
                    if (useItemVisual) {
                        if (sprite.dataset.customBattleItemId === visualId
                            || sprite.classList.contains(`id-${visualId}`)) {
                            matched.add(sprite);
                        }
                        return;
                    }
                    if (sprite.classList.contains('outfit')
                        && sprite.dataset.customBattleOutfitId === visualId) {
                        matched.add(sprite);
                    }
                });

                // Most creatures render on a .sprite.outfit shell. A few (Beer Barrel, Obelisk,
                // Dead Tree, ...) render as a plain .sprite.item instead — matching ANY
                // .sprite.item would also catch an unrelated native tile-decoration sprite
                // sharing the same tile (e.g. the floor texture), so only widen the selector
                // to the SPECIFIC native item-sprite id this creature is known to render as
                // (looked up from the game's own monster metadata), never a blanket .sprite.item.
                let customVisualNativeItemId = null;
                if (useCustomVisual) {
                    try {
                        const spriteId = globalThis.state?.utils?.getMonster?.(piece.gameId)?.metadata?.spriteId;
                        if (spriteId != null) customVisualNativeItemId = String(spriteId);
                    } catch (_) {
                        // noop
                    }
                }
                const genericSelector = customVisualNativeItemId
                    ? `.sprite.outfit, .sprite.item.id-${customVisualNativeItemId}:not([data-custom-battle-item-overlay="1"])`
                    : '.sprite.outfit';

                const nickname = piece.nickname && String(piece.nickname).trim();
                if (nickname) {
                    const safeName = this.escapeCssAttrValue(nickname);
                    const nameSelector = useItemVisual
                        ? `[data-name="${safeName}"] .sprite.outfit, [data-name="${safeName}"] .sprite.item.id-${visualId}`
                        : `[data-name="${safeName}"] ${genericSelector}`;
                    document.querySelectorAll(nameSelector).forEach((sprite) => {
                        matched.add(sprite);
                    });
                }

                const tileIndex = Number(piece.tileIndex);
                if (!Number.isFinite(tileIndex)) return matched;

                const tile = document.getElementById(`tile-index-${tileIndex}`);
                if (tile) {
                    tile.querySelectorAll(genericSelector).forEach((sprite) => matched.add(sprite));
                    if (useItemVisual) {
                        tile.querySelectorAll(
                            `.sprite.item.id-${visualId}[data-custom-battle-piece="1"], ` +
                            `.sprite.item[data-custom-battle-item-id="${visualId}"]`
                        ).forEach((sprite) => {
                            if (sprite.dataset.customBattleItemOverlay === '1') return;
                            matched.add(sprite);
                        });
                    }
                }

                const col = tileIndex % 15;
                const row = Math.floor(tileIndex / 15);
                const expectedTranslate = `calc(${col * 32}px * var(--zoomFactor)) calc(${row * 32}px * var(--zoomFactor))`;

                const tileBottom = tile?.style?.bottom || '';
                const tileRight = tile?.style?.right || '';
                document.querySelectorAll('button[aria-roledescription="draggable"]').forEach((button) => {
                    const positionMatches = (tileBottom && tileRight
                        && button.style.bottom === tileBottom && button.style.right === tileRight)
                        || (button.style.translate || '').startsWith(expectedTranslate);
                    if (!positionMatches) return;
                    button.querySelectorAll(genericSelector).forEach((sprite) => matched.add(sprite));
                });

                document.querySelectorAll('.size-scaled-sprite').forEach((node) => {
                    if (node.id && node.id.startsWith('tile-index-') && node.id !== `tile-index-${tileIndex}`) {
                        return;
                    }
                    const translate = node.style.translate || '';
                    if (translate !== expectedTranslate && !translate.startsWith(expectedTranslate)) return;
                    node.querySelectorAll(genericSelector).forEach((sprite) => matched.add(sprite));
                });

                return matched;
            }

            /**
             * Apply outfit id + shiny only. Never sets moving sheet URLs — the game
             * picks idle/moving from classes. Facing/idle locked only during setup.
             * When piece.itemSpriteId is set, use map-item visuals (statue look).
             */
            applyOutfitVisualToSprite(sprite, piece) {
                if (!sprite?.classList || !piece) return false;
                if (piece.customSpriteKey != null) {
                    return this.applyCustomSpriteVisualToSprite(sprite, piece);
                }
                if (piece.itemSpriteId != null) {
                    return this.applyItemSpriteVisualToSprite(sprite, piece);
                }
                if (piece.outfitSpriteId == null) return false;

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

            ensureItemSpriteTileOverlay(piece) {
                if (!piece || piece.itemSpriteId == null) return false;
                const tileIndex = Number(piece.tileIndex);
                if (!Number.isFinite(tileIndex)) return false;

                // Player ally on this tile: keep their outfit/name/level visible.
                if (this.tileHasForeignPlayerPiece(tileIndex, piece)) {
                    this.removeItemSpriteTileOverlays(tileIndex);
                    return false;
                }

                const tile = document.getElementById(`tile-index-${tileIndex}`);
                if (!tile) return false;

                const toId = String(piece.itemSpriteId);
                const selector = `.sprite.item.id-${toId}[data-custom-battle-item-overlay="1"][data-custom-battle-combat-id="${piece.gameId}"]`;
                let item = tile.querySelector(selector);
                if (item) return false;

                item = document.createElement('div');
                item.className = `sprite item relative id-${toId}`;
                item.style.zIndex = '1000';
                item.dataset.customBattleItemOverlay = '1';
                item.dataset.customBattlePiece = '1';
                item.dataset.customBattleCombatId = String(piece.gameId);
                item.dataset.customBattleItemId = toId;
                if (piece.nickname) {
                    item.dataset.customBattleNickname = String(piece.nickname).trim();
                }
                item.innerHTML = `<div class="viewport"><img alt="${toId}" data-cropped="false" class="spritesheet" style="--cropX: 0; --cropY: 0;"></div>`;
                tile.appendChild(item);
                tile.style.overflow = 'visible';
                return true;
            }

            removeItemSpriteTileOverlays(tileIndex = null) {
                const root = tileIndex == null
                    ? document
                    : document.getElementById(`tile-index-${tileIndex}`);
                if (!root) return 0;
                const nodes = root.querySelectorAll?.('[data-custom-battle-item-overlay="1"]')
                    || [];
                let removed = 0;
                nodes.forEach((node) => {
                    node.remove();
                    removed++;
                });
                return removed;
            }

            /**
             * Reverts any custom-sprite overlay (class + injected sheet div) whose piece is
             * no longer configured — e.g. the creature was removed from the tile, or its
             * customSpriteKey changed. Without this, an overlay tagged onto a sprite element
             * stays there forever once added.
             */
            removeStaleCustomSpriteOverlays(activeOverrides) {
                const activePieces = activeOverrides || this.getOutfitSpriteOverrides();
                CUSTOM_MAP_SPRITES.forEach((spriteDef) => {
                    const overlayClass = getCustomSpriteOverlayClass(spriteDef.key);
                    document.querySelectorAll(`.${overlayClass}`).forEach((sprite) => {
                        const combatId = sprite.dataset.customBattleCombatId;
                        const stillConfigured = activePieces.some((piece) => piece.customSpriteKey === spriteDef.key
                            && String(piece.gameId) === combatId);
                        if (stillConfigured) return;
                        sprite.classList.remove(overlayClass);
                    });
                });
            }

            /**
             * Swaps a registry custom-PNG sprite (CUSTOM_MAP_SPRITES) in for the native outfit
             * image. Adds a scoped class that makes the injected CSS override `content: url()`
             * on the piece's own .spritesheet element — sizing, facing, and the idle/moving
             * animation are all still driven by the base creature's own native CSS, untouched.
             */
            applyCustomSpriteVisualToSprite(sprite, piece) {
                if (!sprite?.classList || !piece || piece.customSpriteKey == null) return false;
                const spriteDef = getCustomSpriteDef(piece.customSpriteKey);
                if (!spriteDef) return false;

                ensureCustomSpriteStyles(spriteDef);
                this.tagCustomPieceSprite(sprite, piece);

                // classList.add() re-serializes and re-sets the whole class attribute even when
                // the token is already present (per spec, its "update steps" always run) — that
                // fires a 'class' mutation record on every call, which is exactly the attribute
                // the loop-causing MutationObserver watches. Only call it when actually needed.
                const overlayClass = getCustomSpriteOverlayClass(spriteDef.key);
                if (sprite.classList.contains(overlayClass)) return false;
                sprite.classList.add(overlayClass);
                return true;
            }

            applyItemSpriteVisualToSprite(sprite, piece) {
                if (!sprite?.classList || !piece || piece.itemSpriteId == null) return false;
                if (sprite.dataset.customBattleItemOverlay === '1') return false;

                let changed = false;
                const toId = String(piece.itemSpriteId);
                this.tagCustomPieceSprite(sprite, piece);
                if (sprite.dataset.customBattleItemId !== toId) {
                    sprite.dataset.customBattleItemId = toId;
                    changed = true;
                }

                // Setup: hide the creature outfit and place a map-item statue on the tile
                // (same structure as the native Oracle on tile 115). Converting the outfit
                // shell in-place looks wrong before battle because button/outfit CSS differs.
                if (!this.isBoardBattleActive()) {
                    if (this.tileHasForeignPlayerPiece(piece.tileIndex, piece)) {
                        if (sprite.style.opacity === '0') {
                            sprite.style.opacity = '';
                            sprite.style.pointerEvents = '';
                            changed = true;
                        }
                        this.removeItemSpriteTileOverlays(piece.tileIndex);
                        return changed;
                    }
                    sprite.querySelectorAll('img.actor, .actor.spritesheet, .quests-custom-outfit-sheet').forEach((node) => {
                        if (node.style.visibility !== 'hidden' || node.style.opacity !== '0') {
                            node.style.visibility = 'hidden';
                            node.style.opacity = '0';
                            changed = true;
                        }
                    });
                    if (sprite.style.opacity !== '0') {
                        sprite.style.opacity = '0';
                        sprite.style.pointerEvents = 'none';
                        changed = true;
                    }
                    if (this.ensureItemSpriteTileOverlay(piece)) changed = true;
                    return changed;
                }

                // Battle: convert the moving outfit shell into an item sprite (works in combat).
                if (sprite.style.opacity === '0') {
                    sprite.style.opacity = '';
                    changed = true;
                }
                if (sprite.style.pointerEvents === 'none') {
                    sprite.style.pointerEvents = '';
                    changed = true;
                }

                ['outfit', 'idle', 'moving', 'north', 'south', 'east', 'west'].forEach((cls) => {
                    if (sprite.classList.contains(cls)) {
                        sprite.classList.remove(cls);
                        changed = true;
                    }
                });
                if (!sprite.classList.contains('item')) {
                    sprite.classList.add('item');
                    changed = true;
                }
                if (!sprite.classList.contains('relative')) {
                    sprite.classList.add('relative');
                    changed = true;
                }

                const previousIdClass = Array.from(sprite.classList).find((cls) => /^id-\d+$/.test(cls));
                if (!sprite.classList.contains(`id-${toId}`)) {
                    if (previousIdClass) sprite.classList.remove(previousIdClass);
                    sprite.classList.add(`id-${toId}`);
                    changed = true;
                }

                let viewport = sprite.querySelector(':scope > .viewport') || sprite.querySelector('.viewport');
                if (!viewport) {
                    viewport = document.createElement('div');
                    viewport.className = 'viewport';
                    sprite.appendChild(viewport);
                    changed = true;
                }

                viewport.querySelectorAll('.actor, .quests-custom-outfit-sheet').forEach((node) => {
                    node.remove();
                    changed = true;
                });

                let img = viewport.querySelector(':scope > img.spritesheet') || viewport.querySelector('img.spritesheet');
                if (!img) {
                    img = document.createElement('img');
                    img.className = 'spritesheet';
                    viewport.appendChild(img);
                    changed = true;
                }
                if (img.classList.contains('actor')) {
                    img.classList.remove('actor');
                    changed = true;
                }
                if (img.getAttribute('alt') !== toId) {
                    img.alt = toId;
                    changed = true;
                }
                if (img.getAttribute('data-cropped') !== 'false') {
                    img.setAttribute('data-cropped', 'false');
                    changed = true;
                }
                if (img.getAttribute('data-shiny') != null) {
                    img.removeAttribute('data-shiny');
                    changed = true;
                }
                if (img.style.getPropertyValue('--cropX') !== '0') {
                    img.style.setProperty('--cropX', '0');
                    changed = true;
                }
                if (img.style.getPropertyValue('--cropY') !== '0') {
                    img.style.setProperty('--cropY', '0');
                    changed = true;
                }

                return changed;
            }

            applyVillainOutfitSpriteOverrides() {
                const overrides = this.getOutfitSpriteOverrides();
                this.removeStaleCustomSpriteOverlays(overrides);
                if (!overrides.length) return 0;

                // Same combat+outfit+shiny group (e.g. 4 Minotaurs) → patch once.
                const groups = new Map();
                overrides.forEach((piece) => {
                    const key = this.getOutfitOverrideDedupeKey(piece);
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(piece);
                });

                let patched = 0;
                const battleActive = this.isBoardBattleActive();
                if (battleActive) {
                    this.removeItemSpriteTileOverlays();
                }
                groups.forEach((group) => {
                    const primary = group[0];
                    const combatGameId = String(primary.gameId);
                    const toId = String(primary.customSpriteKey ?? primary.itemSpriteId ?? primary.outfitSpriteId);
                    const matched = new Set();
                    group.forEach((piece) => {
                        this.findOutfitSpritesForPiece(piece).forEach((sprite) => matched.add(sprite));
                    });

                    // Setup + itemSpriteId: place map-item statues on tiles even before the
                    // outfit shell exists (setup villains live on draggable buttons).
                    if (!battleActive && primary.itemSpriteId != null) {
                        group.forEach((piece) => {
                            if (this.tileHasForeignPlayerPiece(piece.tileIndex, piece)) {
                                this.removeItemSpriteTileOverlays(piece.tileIndex);
                                return;
                            }
                            if (this.ensureItemSpriteTileOverlay(piece)) patched++;
                        });
                    }

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
                                    to: owner.customSpriteKey != null
                                        ? `custom.${toId}`
                                        : owner.itemSpriteId != null ? `item.id-${toId}` : `id-${toId}`,
                                    itemSprite: owner.itemSpriteId != null,
                                    customSprite: owner.customSpriteKey != null,
                                    shiny: owner.shiny === true
                                }
                            );
                        }
                    });

                    if (!claimed && !(primary.itemSpriteId != null && !battleActive)) {
                        const key = `${primary.tileIndex}|${combatGameId}|${toId}`;
                        if (this.shouldLogOutfitOverrideMiss(key)) {
                            console.log(
                                `[Custom Battles][${this.config.name || 'Battle'}] Outfit override: no sprite found yet`,
                                {
                                    tileIndex: primary.tileIndex,
                                    combatGameId,
                                    outfitSpriteId: primary.outfitSpriteId,
                                    itemSpriteId: primary.itemSpriteId,
                                    customSpriteKey: primary.customSpriteKey,
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
                if (this.outfitSpriteOverrideIntervalStopTimer) {
                    clearTimeout(this.outfitSpriteOverrideIntervalStopTimer);
                    this.outfitSpriteOverrideIntervalStopTimer = null;
                }
                if (this.outfitSpriteOverrideObserver) {
                    try {
                        this.outfitSpriteOverrideObserver.disconnect();
                    } catch (_) {
                        // no-op
                    }
                    this.outfitSpriteOverrideObserver = null;
                }
                this._outfitOverrideMissLogByKey.clear();
                this._outfitOverrideMissLogCount = 0;
                this._namedPieceMissLogByKey.clear();
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
                            outfitSpriteId: v.outfitSpriteId,
                            itemSpriteId: v.itemSpriteId
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

                // Keep a light periodic sync for short-lived DOM churn, then rely on MutationObserver.
                this.outfitSpriteOverrideInterval = setInterval(() => {
                    this.syncCustomPieceDom();
                }, 250);
                this.outfitSpriteOverrideIntervalStopTimer = setTimeout(() => {
                    if (this.outfitSpriteOverrideInterval) {
                        clearInterval(this.outfitSpriteOverrideInterval);
                        this.outfitSpriteOverrideInterval = null;
                    }
                    this.outfitSpriteOverrideIntervalStopTimer = null;
                }, 6000);

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
                    const currentBoardConfig = (boardContext.boardConfig || [])
                        .filter((entity) => entity != null);

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

                    let updatedBoardConfig = currentBoardConfig.filter((entity) => entity != null);
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
                        sendBoardSetState((prev) => ({
                            ...prev,
                            boardConfig: updatedBoardConfig
                        }));
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
                        const boardConfig = compactBoardConfigEntries(boardContext.boardConfig);
                        // Also evict any player-placed piece already squatting on a tile reserved
                        // for a configured villain/ally (e.g. tile restrictions failed to stop a
                        // drop there before setup ran, or the piece was there from an earlier
                        // board). Without this, both entities end up in boardConfig on the same
                        // tile — the player's own creature and the forced piece coexisting there —
                        // and the outfit-override system then paints the forced piece's look over
                        // whichever DOM node wins, making the player's creature appear to "become"
                        // the ally/villain even though it's still their own piece underneath.
                        const reservedTiles = new Set(this.getConfiguredCustomPieceTiles());
                        const configWithoutVillains = boardConfig.filter((entity) =>
                            !entity.villain
                            && !this.isForcedAllyEntity(entity)
                            && !reservedTiles.has(Number(entity.tileIndex))
                        );
                        const customVillains = this.config.villains.map((villainConfig) => {
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Adding ${villainConfig.nickname || 'villain'} to tile ${villainConfig.tileIndex}`);
                            return this.createCustomVillainEntity(villainConfig);
                        });
                        const forcedAllies = this.buildForcedAllyEntities();
                        const updatedBoardConfig = compactBoardConfigEntries([
                            ...configWithoutVillains,
                            ...customVillains,
                            ...forcedAllies
                        ]);

                        if (
                            updatedBoardConfig.length !== boardConfig.length
                            || boardConfig.some((entity) => entity.villain)
                            || !this.hasAllForcedAlliesOnBoard(boardConfig)
                        ) {
                            sendBoardSetState((prev) => ({
                                ...prev,
                                boardConfig: updatedBoardConfig
                            }));

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

                    const restoredConfig = boardConfig.filter(entity => {
                        if (!entity || typeof entity !== 'object') return false;
                        if (entity.key) {
                            const isCustomVillain = this.villainKeyPrefixes.some(({ prefix }) =>
                                entity.key.startsWith(prefix)
                            );
                            if (isCustomVillain) {
                                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removing custom villain:`, entity.key);
                                return false;
                            }
                        }
                        return Number.isFinite(Number(entity.tileIndex));
                    });

                    if (restoredConfig.length !== boardConfig.length
                        || boardConfig.some((entity) => entity == null)) {
                        sendBoardSetState((prev) => ({
                            ...prev,
                            boardConfig: restoredConfig
                        }));
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
                if (!this.ownsBoardRestrictions(activationCallback)) return;
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
                    // Forced allies (quest NPCs / scripted helpers) do not count toward max creatures.
                    const allyCount = playerAllies.length;
                    
                    if (allyCount > this.config.allyLimit) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Ally limit exceeded: ${allyCount} > ${this.config.allyLimit}, removing excess`);
                        
                        const playerAlliesToKeep = playerAllies.slice(0, this.config.allyLimit);
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
                    if (this.ownsBoardRestrictions(activationCallback)) {
                        this.enforceAllyLimit(activationCallback, showToastCallback);
                    }
                });
                
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Ally limit monitoring set up`);
            }

            /**
             * Restore one displaced villain/forced-ally entity to its assigned tile + equip,
             * given the key-prefix table and piece configs for its kind. Shared by
             * preventVillainMovement() so villains and forced allies (e.g. Rookstayer) get
             * identical pinning instead of only villains being protected from drag-swaps.
             */
            restorePinnedEntityIfMoved(entity, keyPrefixes, pieceConfigs, kindLabel) {
                if (!entity.key) return { entity, changed: false };
                for (let i = 0; i < keyPrefixes.length; i++) {
                    const { prefix, tileIndex, hasTileInPrefix } = keyPrefixes[i];
                    const matches = hasTileInPrefix
                        ? entity.key.startsWith(prefix)
                        : entity.key.startsWith(prefix) && entity.tileIndex === tileIndex;
                    if (!matches) continue;

                    const pieceConfig = pieceConfigs[i];
                    const expectedEquip = pieceConfig.equip || null;
                    const currentEquip = entity.equip !== undefined ? entity.equip : null;
                    const equipRemovedOrChanged = (expectedEquip != null && currentEquip === null) ||
                        (expectedEquip != null && (currentEquip?.gameId !== expectedEquip?.gameId || currentEquip?.tier !== expectedEquip?.tier || currentEquip?.stat !== expectedEquip?.stat));

                    if (entity.tileIndex !== tileIndex) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] ${kindLabel} moved from tile ${tileIndex} to ${entity.tileIndex} - restoring`);
                        return { entity: { ...entity, tileIndex: tileIndex, equip: expectedEquip }, changed: true };
                    }
                    if (equipRemovedOrChanged) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] ${kindLabel} equipment removed or changed - restoring`);
                        return { entity: { ...entity, equip: expectedEquip }, changed: true };
                    }
                    break;
                }
                return { entity, changed: false };
            }

            /**
             * Prevent villain (and forced-ally) movement — keep them on their assigned tiles.
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
                        if (entity.villain) {
                            const result = this.restorePinnedEntityIfMoved(entity, this.villainKeyPrefixes, this.config.villains, 'Villain');
                            if (result.changed) needsRestore = true;
                            return result.entity;
                        }
                        if (this.isForcedAllyEntity(entity)) {
                            const result = this.restorePinnedEntityIfMoved(entity, this.allyKeyPrefixes, this.config.allies || [], 'Forced ally');
                            if (result.changed) needsRestore = true;
                            return result.entity;
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

            getBlockedPlayerTiles() {
                const blocked = this.config.tileRestrictions?.blockedTiles;
                if (!Array.isArray(blocked) || !blocked.length) return null;
                return new Set(blocked.map((tileIndex) => Number(tileIndex)).filter((tileIndex) => Number.isFinite(tileIndex)));
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

            filterSetupPreventAllyOnBlockedTiles(setup, showToastCallback) {
                if (!Array.isArray(setup)) return setup;
                const blockedTiles = this.getBlockedPlayerTiles();
                if (!blockedTiles) return setup;

                let blocked = 0;
                const filtered = setup.filter((piece) => {
                    if (piece?.villain) return true;
                    if (this.isForcedAllyEntity(piece)) return true;
                    if (!this.isAllyPiece(piece)) return true;
                    if (!blockedTiles.has(Number(piece.tileIndex))) return true;
                    blocked++;
                    return false;
                });

                if (blocked > 0) {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Blocked ${blocked} ally placement(s) on blocked tiles`);
                    if (showToastCallback) {
                        showToastCallback({
                            message: this.config.tileRestrictions.blockedMessage
                                || this.config.tileRestrictions.message
                                || 'Ally creatures cannot be placed on those tiles!',
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
                        // Game may have replaced the villain with the ally — restore custom villains.
                        this.syncCustomVillainsIfNeeded();
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

            removeAlliesOnBlockedTiles(showToastCallback) {
                if (this.isBoardBattleActive()) return false;
                const blockedTiles = this.getBlockedPlayerTiles();
                if (!blockedTiles) return false;

                try {
                    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
                    let removed = 0;
                    const newBoardConfig = boardConfig.filter((piece) => {
                        if (this.isForcedAllyEntity(piece)) return true;
                        if (!this.isAllyPiece(piece)) return true;
                        if (!blockedTiles.has(Number(piece.tileIndex))) return true;
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
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removed ${removed} ally creature(s) on blocked tiles`);
                        if (showToastCallback) {
                            showToastCallback({
                                message: this.config.tileRestrictions.blockedMessage
                                    || this.config.tileRestrictions.message
                                    || 'Ally creatures cannot be placed on those tiles!',
                                type: 'warning',
                                duration: 3000
                            });
                        }
                        return true;
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error removing allies on blocked tiles:', error);
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
                    if (!this.ownsBoardRestrictions(activationCallback)) return;

                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Intercepting board setup for tile restrictions`);

                    event.setup = this.filterSetupPreventAllyOnVillainTiles(event.setup, showToastCallback);
                    event.setup = this.filterSetupPreventAllyOnForcedAllyTiles(event.setup, showToastCallback);
                    event.setup = this.filterSetupPreventAllyOutsideAllowedTiles(event.setup, showToastCallback);
                    event.setup = this.filterSetupPreventAllyOnBlockedTiles(event.setup, showToastCallback);
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
                    const ownsBoard = this.ownsBoardRestrictions(activationCallback);

                    this.tileRestrictionActive = shouldBeActive;

                    if (this.tileRestrictionActive && !wasActive) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Tile restrictions activated`);
                    } else if (!this.tileRestrictionActive && wasActive) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Tile restrictions deactivated`);
                    }
                    
                    if (ownsBoard) {
                        this.preventVillainMovement();
                        this.removeAlliesOutsideAllowedTiles(showToastCallback);
                        this.removeAlliesOnBlockedTiles(showToastCallback);
                        // Preserve ally-drag mode so board setState bumps don't re-light villain tiles mid-drag.
                        this.syncPlacementHitboxMask(activationCallback, {
                            allyDrag: this._placementHitboxAllyDrag === true
                        });
                    } else if (this._placementHitboxMaskActive) {
                        this.restorePlacementHitboxes();
                    }
                });

                this.setupPlacementHitboxMaskHooks();
                this.syncPlacementHitboxMask(activationCallback);

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
                if (this.config.allowStopButton === true) return;
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
                        this.scheduleConfiguredGenesIntegrityChecks(world || null, 'newGame');
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

                const { replacementId, makeRelative, preserveCrop } = rule;
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
                    if (!preserveCrop) {
                        img.setAttribute('data-cropped', 'false');
                        img.style.setProperty('--cropX', '0');
                        img.style.setProperty('--cropY', '0');
                    }
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
                if (!this.customVillainPlacementReady || this.isBoardBattleActive()) return;
                if (this.isCustomVillainBoardStateValid()) return;
                if (this.pendingVillainSyncTimer) return;

                const delayMs = this.boardSetupLock ? 120 : 150;
                this.pendingVillainSyncTimer = setTimeout(() => {
                    this.pendingVillainSyncTimer = null;
                    if (!this.customVillainPlacementReady || this.boardSetupLock || this.isBoardBattleActive()) {
                        // Lock still held — try once more shortly.
                        if (this.customVillainPlacementReady && !this.isBoardBattleActive()) {
                            this.syncCustomVillainsIfNeeded();
                        }
                        return;
                    }
                    if (this.isCustomVillainBoardStateValid()) return;
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Board villain state invalid - re-running villain swap`);
                    this.removeOriginalVillains();
                }, delayMs);
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

                // Enforce single ownership per room. Native rooms get reused across many
                // quests (e.g. "rkswrs" backs five separate quest battles plus every Map
                // Editor test session for that room), and only one CustomBattle should ever
                // govern a room's placement-hitbox mask / allowedTiles at a time. Previously
                // that was left to ownsBoardRestrictions()'s score heuristic, which only
                // resolves correctly if every battle's cleanup() reliably fires — but nothing
                // calls cleanup() when a player abandons a battle mid-fight (navigates away,
                // reloads into another room, etc.), so that instance's isActive flag never
                // resets and it lingers in activeCustomBattles indefinitely, silently
                // contending for (and sometimes winning) board ownership of a room it no
                // longer represents. Retiring any other still-active claimant on this exact
                // roomId up front removes the race outright instead of hoping the score wins.
                const roomId = this.config?.roomId;
                if (roomId) {
                    Array.from(activeCustomBattles).forEach((battle) => {
                        if (battle === this || !battle.isActive) return;
                        if (battle.config?.roomId !== roomId) return;
                        console.warn(`[Custom Battles][${this.config.name || 'Battle'}] Evicting stale battle "${battle.config?.name || 'Battle'}" still active on room ${roomId} before taking over`);
                        try {
                            battle.cleanup();
                        } catch (error) {
                            console.error(`[Custom Battles][${this.config.name || 'Battle'}] Error evicting stale battle on room ${roomId}:`, error);
                        }
                    });
                }

                this.isActive = true;
                this._setupSeq = ++customBattleSetupSeq;
                activeCustomBattles.add(this);
                hideBetterHighscoresForCustomBattle();
                hideRoomInfoOverlayForCustomBattle();
                installGlobalAllyVillainOverlapGuard();
                this.activationCallback = activationCallback || null;
                this._overlapToastCallback = showToastCallback || null;
                console.log('[Custom Battles][' + (this.config.name || 'Battle') + '] Setting up battle system');

                // Setup stop button disabler (unless battle config allows Stop)
                if (this.config.allowStopButton !== true) {
                    this.setupStopButtonDisabler();
                }

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
                    this.maybeRunPreBattleGeneIntegrityCheck();
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

                this.stopPersistentVisualSync();
                this.cleanupPlacementHitboxMaskHooks();

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
                this.removeItemSpriteTileOverlays();
                this.clearGeneIntegrityTimers();
                this.preBattleGeneTamperCount = 0;
                this.lastPreBattleGeneIntegrityCheckAt = 0;
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
        // Optional villain.itemSpriteId / allies[].itemSpriteId converts the outfit shell into a map item sprite look (e.g. statue id-2031).
        // Optional config.allies places non-removable custom allies (customForcedAlly) during entry setup.
        // Forced allies are excluded from allyLimit / max-creature counts and from creature-duplicate checks;
        // their tiles still block player ally placement.
        // Custom villain + forced-ally board buttons are interaction-locked (disabled / no pointer events).
        // While active, room info overlay (monster count / map name) and Better Highscores are suppressed.
        // Optional victoryDefeat.reloadRoomOnClose reloads config.roomId after Close (same-room bounce
        // when needed). Set reapplyAfterReload: true only if CustomBattles should force entry setup;
        // otherwise room-enter / board load re-applies customizations natively.
        // Same flow for all: create(config) → setup(activationCallback, showToast)
        // → scheduleEntryVillainSetup / runEntryVillainSetupIfNeeded → onClose cleanup + navigate.

        function ensureDynamicStyle(styleId, cssText) {
            if (!styleId || !cssText || typeof document === 'undefined') return false;
            if (document.getElementById(styleId)) return true;
            try {
                const style = document.createElement('style');
                style.id = styleId;
                style.textContent = cssText;
                document.head.appendChild(style);
                return true;
            } catch (error) {
                console.warn('[Custom Battles] Failed to inject dynamic style:', error);
                return false;
            }
        }

        const effectFrameCountCache = new Map();
        function getCachedEffectFrameCount(effectUrl, tileSizePx, fallbackFrameCount = 1) {
            if (!effectUrl) return Math.max(1, Number(fallbackFrameCount) || 1);
            if (effectFrameCountCache.has(effectUrl)) {
                return Math.max(1, Number(effectFrameCountCache.get(effectUrl)) || 1);
            }
            const fallback = Math.max(1, Number(fallbackFrameCount) || 1);
            try {
                const probe = new Image();
                probe.decoding = 'async';
                probe.onload = () => {
                    try {
                        const frameWidth = probe.naturalWidth || Number(tileSizePx) || 32;
                        const frameCount = Math.max(1, Math.round((probe.naturalHeight || frameWidth) / frameWidth));
                        effectFrameCountCache.set(effectUrl, frameCount);
                    } catch (_) {
                        effectFrameCountCache.set(effectUrl, fallback);
                    }
                };
                probe.onerror = () => {
                    effectFrameCountCache.set(effectUrl, fallback);
                };
                probe.src = effectUrl;
            } catch (_) {
                effectFrameCountCache.set(effectUrl, fallback);
            }
            return fallback;
        }

        function playEffectOnWalkableTiles(options = {}) {
            const {
                effectUrl,
                effectClass = 'custom-battle-tile-effect',
                frameMs = 70,
                zIndex = 350,
                tileSizePx = 32,
                frameCount: configuredFrameCount = null,
                mountToParent = false,
                mountToBody = false,
                keyframesName = `${effectClass}-play`,
                styleId = `${effectClass}-styles`
            } = options || {};

            if (!effectUrl || !effectClass) return false;
            const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
            const hitboxes = boardContext?.selectedMap?.selectedRoom?.file?.data?.hitboxes;
            const tileElements = document.querySelectorAll('[id^="tile-index-"]');
            if (!tileElements.length) return false;

            const escapedClass = String(effectClass).replace(/"/g, '\\"');
            ensureDynamicStyle(
                styleId,
                `
                .${escapedClass} {
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: calc(${Number(tileSizePx) || 32}px * var(--zoomFactor, 1));
                    height: calc(${Number(tileSizePx) || 32}px * var(--zoomFactor, 1));
                    pointer-events: none;
                    z-index: ${Number(zIndex) || 350};
                    overflow: hidden;
                    background-repeat: no-repeat;
                    image-rendering: pixelated;
                }
                @keyframes ${keyframesName} {
                    from { transform: translateY(0); }
                    to { transform: translateY(-100%); }
                }
                `
            );
            const fallbackFrameCount = Math.max(1, Number(configuredFrameCount) || 1);
            const frameCount = getCachedEffectFrameCount(effectUrl, tileSizePx, fallbackFrameCount);
            const durationMs = frameCount * (Number(frameMs) || 70);

            tileElements.forEach((tileEl) => {
                const tileId = parseInt(tileEl.id.replace('tile-index-', ''), 10);
                if (hitboxes && tileId < hitboxes.length && hitboxes[tileId] !== false) return;
                if (tileEl.querySelector(`.${effectClass}`)) return;

                const viewport = document.createElement('div');
                viewport.className = effectClass;
                viewport.style.backgroundImage = `url("${effectUrl}")`;
                viewport.style.backgroundSize = `100% ${Math.max(1, frameCount) * 100}%`;
                viewport.style.animation = `${keyframesName} ${durationMs}ms steps(${Math.max(1, frameCount)}, end) 1 forwards`;
                if (mountToBody) {
                    const tileRect = tileEl.getBoundingClientRect?.();
                    if (!tileRect || tileRect.width <= 0 || tileRect.height <= 0) return;
                    viewport.style.position = 'fixed';
                    viewport.style.left = `${Math.round(tileRect.left)}px`;
                    viewport.style.top = `${Math.round(tileRect.top)}px`;
                    viewport.style.width = `${Math.round(tileRect.width)}px`;
                    viewport.style.height = `${Math.round(tileRect.height)}px`;
                    viewport.style.right = 'auto';
                    viewport.style.bottom = 'auto';
                    const body = document.body || document.documentElement;
                    body.appendChild(viewport);
                } else if (mountToParent) {
                    const parentEl = tileEl.parentElement || tileEl;
                    const parentStyle = window.getComputedStyle(parentEl);
                    if (parentStyle?.position === 'static') {
                        parentEl.style.position = 'relative';
                    }
                    // Use board-grid coordinates from the tile itself (right/bottom) instead of
                    // viewport rect math; this stays correct under board transforms/zoom.
                    viewport.style.right = tileEl.style.right || '0px';
                    viewport.style.bottom = tileEl.style.bottom || '0px';
                    viewport.style.left = 'auto';
                    viewport.style.top = 'auto';
                    viewport.style.width = `calc(${Number(tileSizePx) || 32}px * var(--zoomFactor, 1))`;
                    viewport.style.height = `calc(${Number(tileSizePx) || 32}px * var(--zoomFactor, 1))`;
                    parentEl.appendChild(viewport);
                } else {
                    tileEl.appendChild(viewport);
                }
                setTimeout(() => {
                    if (viewport.parentNode) viewport.remove();
                }, durationMs + 100);
            });
            return true;
        }

        // Debug helper: inspect how the native game itself animates a creature's outfit
        // sprite (background-image/size/position, @keyframes, --cropX/--cropY) so a custom
        // sprite can reuse that exact mechanism instead of a hand-rolled one.
        function logNativeOutfitSpriteDebugInfo(img, source) {
            const outfitIdClass = [...img.classList].find((c) => /^id-\d+$/.test(c));
            const outfitId = outfitIdClass ? outfitIdClass.replace('id-', '') : null;
            const sprite = img.closest('.sprite.outfit') || img.closest('.sprite');
            const cs = getComputedStyle(img);
            const info = {
                source,
                outfitId,
                backgroundImage: cs.backgroundImage,
                backgroundSize: cs.backgroundSize,
                backgroundPosition: cs.backgroundPosition,
                animationName: cs.animationName,
                animationDuration: cs.animationDuration,
                animationTimingFunction: cs.animationTimingFunction,
                cropXVar: img.style.getPropertyValue('--cropX'),
                cropYVar: img.style.getPropertyValue('--cropY'),
                dataCropped: img.getAttribute('data-cropped'),
                spriteClasses: sprite ? sprite.className : null,
                imgOuterHTML: img.outerHTML
            };
            console.log('[Custom Battles][AUTO-DEBUG] native outfit sprite info', info);

            const matchedRules = [];
            for (const sheet of document.styleSheets) {
                let rules;
                try {
                    rules = sheet.cssRules;
                } catch (e) {
                    continue;
                }
                for (const rule of rules) {
                    if (outfitId && rule.selectorText && rule.selectorText.includes(`id-${outfitId}`)) {
                        matchedRules.push(rule.cssText);
                    }
                    if (rule.cssText && rule.cssText.startsWith('@keyframes') && cs.animationName !== 'none'
                        && rule.cssText.includes(cs.animationName)) {
                        matchedRules.push(rule.cssText);
                    }
                }
            }
            console.log('[Custom Battles][AUTO-DEBUG] matched CSS rules:', matchedRules);
            return info;
        }

        function debugNativeOutfitSprite(outfitId) {
            const selector = `img.spritesheet.id-${outfitId}`;
            const img = document.querySelector(selector);
            if (!img) {
                console.log(`[Custom Battles] No element matched "${selector}" — is a creature with outfit id ${outfitId} currently rendered on screen?`);
                return null;
            }
            return logNativeOutfitSpriteDebugInfo(img, 'manual');
        }

        // Fires automatically the first time ANY native creature is actually animating its
        // walk cycle (.moving on the outfit shell) — no console command needed. Logs once,
        // then stops watching. Only looks at NATIVE sprites (skips our own custom-sprite
        // overlays, which hide the real img and wouldn't show a real running animation).
        let autoNativeAnimDebugDone = false;
        function tryAutoDebugNativeAnimation() {
            if (autoNativeAnimDebugDone) return true;
            const candidates = document.querySelectorAll('.sprite.outfit.moving img.spritesheet, img.spritesheet.moving');
            for (const img of candidates) {
                if (img.closest('[class*="custom-battles-sprite-"]')) continue;
                // Skip effects that merely happen to carry a .moving class (loot pickups,
                // despawn animations, etc.) — a real creature outfit always has an id-N class.
                if (![...img.classList].some((c) => /^id-\d+$/.test(c))) continue;
                autoNativeAnimDebugDone = true;
                logNativeOutfitSpriteDebugInfo(img, 'auto');
                return true;
            }
            return false;
        }
        (function startAutoNativeAnimDebugWatch() {
            // Sprite-dev instrumentation only. A body-wide subtree+class MutationObserver is
            // expensive during battles, so don't arm it unless verbose logging is on — the
            // level this debug output is gated to anyway.
            const verbose = (() => {
                try { return globalThis.BestiaryLogger?.getLevel?.() === 'verbose' || window.BESTIARY_DEBUG === true; }
                catch (_) { return false; }
            })();
            if (!verbose) return;
            if (tryAutoDebugNativeAnimation()) return;
            const observer = new MutationObserver(() => {
                if (tryAutoDebugNativeAnimation()) observer.disconnect();
            });
            const root = document.body || document.documentElement;
            if (!root) return;
            observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            setTimeout(() => observer.disconnect(), 10 * 60 * 1000);
        })();

        // Expose globally
            try {
                window.CustomBattles = {
                    create: (config) => new CustomBattle(config),
                    getActiveBattles: () => [...activeCustomBattles],
                    isAllyContextMenuBlocked: shouldBlockAllyContextMenu,
                    playEffectOnWalkableTiles,
                    CUSTOM_SPRITES: CUSTOM_MAP_SPRITES,
                    getCustomSpriteDef,
                    getCustomSpriteAssetUrl,
                    debugNativeOutfitSprite,
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

