// =======================
// Custom Battle System
// =======================
// Generic system for managing custom battles with configurable villains, restrictions, and cleanup
'use strict';

// Prevent multiple initializations
if (window.CustomBattles) {
    // Already initialized, skip
} else {
    try {
        (function() {
            'use strict';
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
                    victoryDefeat: null
                };
                this.setupUnsubscribe = null;
                this.setupUnsubscribeHandler = null;
                this.tileRestrictionActive = false;
                this.preventVillainMovementActive = false;
                this.lastVillainAddTime = 0;
                this.isAddingVillains = false;
                
                // Stop button state
                this.stopButtonObserver = null;
                this.stopButtonDisabled = false;
                this.startButtonClickHandler = null;
                this.gameStartEventUnsubscribes = [];
                
                // Victory/defeat state
                this.lastGameState = 'initial';
                this.victoryDefeatModal = null;
                
                // Validate config
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
             * Add custom villains to the board
             */
            addVillains() {
                try {
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
                            // Generate key: if prefix includes tile, append timestamp, otherwise include tile in key
                            let key;
                            if (prefix.includes(`-${villainConfig.tileIndex}-`) || prefix.endsWith(`-${villainConfig.tileIndex}-`)) {
                                key = prefix + Date.now() + Math.random();
                            } else {
                                key = `${prefix}${villainConfig.tileIndex}-${Date.now()}-${Math.random()}`;
                            }
                            
                            const villain = {
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
                                genes: villainConfig.genes || {
                                    hp: 1,
                                    ad: 1,
                                    ap: 1,
                                    armor: 1,
                                    magicResist: 1
                                }
                            };

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
             * Remove original villains from board (keep custom ones)
             */
            removeOriginalVillains() {
                try {
                    console.log(`[Custom Battles][${this.config.name || 'Battle'}] Removing original villains from board`);

                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const boardConfig = boardContext.boardConfig || [];

                    // Filter out original villains (keep custom ones)
                    const configWithoutVillains = boardConfig.filter(entity => {
                        // Keep custom villains (they have our key prefixes)
                        if (entity.key) {
                            const isCustomVillain = this.villainKeyPrefixes.some(({ prefix }) =>
                                entity.key.startsWith(prefix)
                            );
                            if (isCustomVillain) return true;
                        }
                        
                        // Remove original villains
                        if (entity.villain) return false;
                        
                        // Keep everything else (allies, etc.)
                        return true;
                    });

                    if (configWithoutVillains.length < boardConfig.length) {
                        globalThis.state.board.send({
                            type: 'setState',
                            fn: (prev) => ({
                                ...prev,
                                boardConfig: configWithoutVillains
                            })
                        });

                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Original villains removed from board`);

                        // Hide villain sprites if needed
                        if (this.config.hideVillainSprites) {
                            const allSprites = document.querySelectorAll('.sprite.item.relative');
                            let hidden = 0;
                            allSprites.forEach((sprite) => {
                                const spriteClasses = Array.from(sprite.classList);
                                const idClass = spriteClasses.find(cls => cls.startsWith('id-'));
                                if (idClass) {
                                    const spriteId = idClass.replace('id-', '');
                                    const wasVillain = boardConfig.some(entity =>
                                        entity.gameId?.toString() === spriteId && entity.villain &&
                                        !this.villainKeyPrefixes.some(({ prefix }) => entity.key?.startsWith(prefix))
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

                    // After removing villains, add custom ones back
                    this.addVillains();
                    
                    // Set floor after board setup completes
                    if (this.config.floor !== undefined) {
                        setTimeout(() => {
                            this.setFloor(this.config.floor);
                        }, 300);
                    }
                } catch (error) {
                    console.error('[Custom Battles] Error removing villains:', error);
                }
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
             * Prevent villain movement (keep them on their assigned tiles)
             * Runs when tileRestrictionActive is true (from tile restrictions or from preventVillainMovement-only subscription).
             */
            preventVillainMovement() {
                if (!this.tileRestrictionActive && !this.preventVillainMovementActive) return;
                
                try {
                    const boardContext = globalThis.state.board.getSnapshot().context;
                    const boardConfig = boardContext.boardConfig || [];
                    
                    let needsRestore = false;
                    const restoredConfig = boardConfig.map(entity => {
                        if (entity.key && entity.villain) {
                            // Check each villain's expected tile
                            for (const { prefix, tileIndex, hasTileInPrefix } of this.villainKeyPrefixes) {
                                let matches = false;
                                if (hasTileInPrefix) {
                                    // Prefix includes tile, simple startsWith check
                                    matches = entity.key.startsWith(prefix);
                                } else {
                                    // Prefix doesn't include tile, check prefix and tile separately
                                    matches = entity.key.startsWith(prefix) && entity.tileIndex === tileIndex;
                                }
                                
                                if (matches) {
                                    if (entity.tileIndex !== tileIndex) {
                                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Villain moved from tile ${tileIndex} to ${entity.tileIndex} - restoring`);
                                        needsRestore = true;
                                        return { ...entity, tileIndex: tileIndex };
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
                    const filteredSetup = event.setup.filter(piece => {
                        if (piece.villain) return true;
                        return allowedTiles.includes(piece.tileIndex);
                    });

                    if (filteredSetup.length !== event.setup.length) {
                        console.log(`[Custom Battles][${this.config.name || 'Battle'}] Blocked ${event.setup.length - filteredSetup.length} ally placements outside allowed tiles`);

                        if (showToastCallback) {
                            showToastCallback({
                                message: this.config.tileRestrictions.message || `Ally creatures can only be placed on specific tiles!`,
                                type: 'warning',
                                duration: 3000
                            });
                        }

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
                    if (shouldBeActive) {
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
                
                // Create content element
                const content = document.createElement('div');
                content.style.cssText = 'text-align: center; padding: 20px;';
                
                // Title
                const titleEl = document.createElement('h2');
                titleEl.textContent = title;
                titleEl.style.cssText = `color: ${titleColor}; margin-bottom: 15px; font-size: 24px; font-weight: bold;`;
                content.appendChild(titleEl);
                
                // Victory/defeat message
                const message = isVictory ? 
                    (victoryDefeatConfig.victoryMessage || 'You have achieved victory!') :
                    (victoryDefeatConfig.defeatMessage || 'You have been defeated.');
                
                if (message) {
                    const msgEl = document.createElement('div');
                    msgEl.textContent = message;
                    msgEl.style.cssText = `color: ${titleColor}; margin-bottom: 15px; font-weight: bold;`;
                    content.appendChild(msgEl);
                }
                
                // Items awarded (if victory and configured)
                if (isVictory && victoryDefeatConfig.showItems && victoryDefeatConfig.items && victoryDefeatConfig.items.length > 0) {
                    const itemsEl = document.createElement('div');
                    itemsEl.style.cssText = 'margin-top: 15px;';
                    itemsEl.textContent = 'Items received: ' + victoryDefeatConfig.items.map(item => `${item.name} x${item.amount}`).join(', ');
                    itemsEl.style.color = '#4CAF50';
                    content.appendChild(itemsEl);
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

                if (typeof globalThis === 'undefined' || !globalThis.state || !globalThis.state.gameTimer) {
                    console.warn('[Custom Battles] GameTimer not available');
                    return;
                }

                // Initialize last state
                try {
                    const currentState = globalThis.state.gameTimer.getSnapshot();
                    this.lastGameState = currentState?.context?.state || 'initial';
                } catch (e) {
                    this.lastGameState = 'initial';
                }

                // Monitor game timer for victory/defeat
                this.subscriptions.victoryDefeat = globalThis.state.gameTimer.subscribe(async (timerState) => {
                    try {
                        const { state, currentTick, readableGrade, rankPoints } = timerState.context;
                        
                        // Show victory/defeat modals when game ends
                        if ((state === 'victory' || state === 'defeat') && 
                            (this.lastGameState === 'initial' || this.lastGameState === 'playing')) {
                            
                            const isVictory = state === 'victory';
                            const gameData = {
                                ticks: currentTick,
                                grade: readableGrade,
                                rankPoints: rankPoints,
                                completed: isVictory
                            };
                            
                            console.log(`[Custom Battles][${this.config.name || 'Battle'}] Game ended: ${state}`, gameData);
                            
                            // Show modal
                            setTimeout(() => {
                                this.showVictoryDefeatModal(isVictory, gameData);
                            }, 100);
                        }
                        
                        // Update last state
                        this.lastGameState = state;
                    } catch (error) {
                        console.error('[Custom Battles] Error in game timer subscription:', error);
                    }
                });

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Victory/Defeat detection set up`);
            }

            /**
             * Setup the battle system
             */
            setup(activationCallback, showToastCallback) {
                if (this.isActive) {
                    console.warn(`[Custom Battles][${this.config.name || 'Battle'}] Already set up`);
                    return;
                }

                this.isActive = true;
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Setting up battle system`);

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

                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Cleaning up battle system`);

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

                // Show overlays if callback provided
                if (showOverlaysCallback) {
                    showOverlaysCallback();
                }

                this.tileRestrictionActive = false;
                this.isActive = false;
                this.lastGameState = 'initial';
                console.log(`[Custom Battles][${this.config.name || 'Battle'}] Cleanup completed`);
            }
        }

        // Battle configs (e.g. Mornenion, Banshee's Last Room) live in Quests.js. This file only provides
        // CustomBattle and create(config). Same flow for all: create(config) → setup(activationCallback, showToast)
        // → onClose does cleanup(restoreBoardSetup, showQuestOverlays) + navigate.

        // Expose globally
            try {
                window.CustomBattles = {
                    create: (config) => new CustomBattle(config)
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

