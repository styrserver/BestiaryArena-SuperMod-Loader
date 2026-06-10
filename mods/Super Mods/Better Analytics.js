// =======================
// 0. Metadata
// =======================

(function() {
    if (window.__betterAnalyticsLoaded) return;
    window.__betterAnalyticsLoaded = true;

    // =======================
    // 1. Configuration & Constants
    // =======================
    const modName = "Better Analytics";
    const modDescription = "DPS tracking for the impact analyzer plus an advanced analytics panel.";
    
    // DOM Selectors
    const ANALYZER_PANEL_SELECTOR = 'div[data-state="open"]';
    const DAMAGE_ENTRIES_SELECTOR = 'div[data-state="open"] ul li';
    const DAMAGE_VALUE_SELECTOR = 'span.font-outlined-fill';
    
    // More specific selectors for damage values
    const STATS_CONTAINER_SELECTOR = '.revert-pixel-font-spacing';
    const PORTRAIT_CONTAINER_SELECTOR = '.container-slot';
    
    // Game Mechanics Constants
    const TICK_TO_SECONDS_RATIO = 1 / 16;
    const TICKS_PER_SECOND = 16;
    
    // Timing Configuration
    const TIMING = {
        RESTORE_DELAY: 100,
        FINAL_UPDATE_DELAY: 100,
        TAB_SWITCH_DELAY: 25,
        DPS_UPDATE_INTERVAL: 1000
    };
    
    // Alternative Selectors for Damage Detection
    const ALTERNATIVE_DAMAGE_SELECTORS = [
        'ul.frame-2 li',
        'ul[class*="frame-2"] li',
        'ul li',
        'button'
    ];
    
    // CSS Classes and Attributes
    const CSS_CLASSES = {
        DPS_DISPLAY: 'better-analytics-dps',
        PORTRAIT_CONTAINER: 'container-slot'
    };
    
    const ATTRIBUTES = {
        DPS_LISTENER: 'data-dps-listener'
    };
    
    // =======================
    // 2. Global Variables
    // =======================
    let damageTrackingData = new Map();
    let gameStartTick = null;
    let isTracking = false;
    let analyzerObserver = null;
    let dpsUpdateInterval = null;
    let boardSubscription = null;
    let gameTimerSubscription = null;
    let autoOpenObserver = null;
    let serverResultsSubscription = null;
    let currentGameMode = null;
    let worldEventSubscriptions = [];
    
    // Simplified conflict prevention
    let isProcessing = false;
    let processingTimeout = null;
    
    // Prevent multiple simultaneous calls
    let isWaitingForPanel = false;
    
    // DOM element cache
    let cachedAnalyzerPanel = null;
    let cacheTimestamp = 0;
    const CACHE_DURATION = 1000; // 1 second cache
    
    // Event listener references for cleanup
    let pageUnloadHandler = null;
    let visibilityChangeHandler = null;
    let modDisableMessageHandler = null;

    // Board Analyzer / Manual Runner coordination
    let isPausedForBlockingMod = false;
    let modCoordinationSetup = false;
    let modCoordinationUnsubscribe = null;
    let modLifecycleHandlersSetup = false;
    const BLOCKING_ANALYSIS_MODS = ['Board Analyzer', 'Manual Runner'];
    
    // =======================
    // 3. Conflict Prevention Functions
    // =======================
    
    function startProcessing() {
        if (isProcessing) {
            clearTimeout(processingTimeout);
        }
        isProcessing = true;
        processingTimeout = setTimeout(() => {
            isProcessing = false;
        }, 2500);
    }
    
    function isCurrentlyProcessing() {
        return isProcessing;
    }

    function isBlockingAnalysisModActive() {
        if (!window.ModCoordination) return false;
        return BLOCKING_ANALYSIS_MODS.some(name => window.ModCoordination.isModActive(name));
    }

    function shouldBetterAnalyticsRun() {
        return !isPausedForBlockingMod && !isBlockingAnalysisModActive();
    }

    function cleanupRuntime() {
        try {
            cleanupSandboxPanel();
            stopDamageTracking();

            if (processingTimeout) {
                clearTimeout(processingTimeout);
                processingTimeout = null;
            }
            isProcessing = false;
            isWaitingForPanel = false;

            cleanupTabButtonListeners();

            if (analyzerObserver) {
                analyzerObserver.disconnect();
                analyzerObserver = null;
            }

            if (autoOpenObserver) {
                autoOpenObserver.disconnect();
                autoOpenObserver = null;
            }

            if (boardSubscription) {
                boardSubscription.unsubscribe();
                boardSubscription = null;
            }

            if (gameTimerSubscription) {
                gameTimerSubscription.unsubscribe();
                gameTimerSubscription = null;
            }

            if (serverResultsSubscription) {
                serverResultsSubscription.unsubscribe();
                serverResultsSubscription = null;
            }

            worldEventSubscriptions.forEach(sub => {
                if (sub && typeof sub.unsubscribe === 'function') {
                    sub.unsubscribe();
                }
            });
            worldEventSubscriptions = [];

            cleanupAllDPSDisplays();
            damageTrackingData.clear();

            cachedAnalyzerPanel = null;
            cacheTimestamp = 0;

            currentGameMode = null;
            isTracking = false;
            gameStartTick = null;
        } catch (error) {
            console.error(`[${modName}][ERROR][cleanupRuntime] Error during runtime cleanup:`, error);
        }
    }

    function handleBlockingModCoordination() {
        try {
            const blocking = isBlockingAnalysisModActive();
            if (blocking && !isPausedForBlockingMod) {
                isPausedForBlockingMod = true;
                console.log(`[${modName}] Board Analyzer/Manual Runner active - shutting down completely`);
                cleanupRuntime();
            } else if (!blocking && isPausedForBlockingMod) {
                isPausedForBlockingMod = false;
                console.log(`[${modName}] Board analysis finished - resuming`);
                startBetterAnalyticsRuntime();
            }
        } catch (error) {
            console.error(`[${modName}] Error in Board Analyzer coordination:`, error);
        }
    }

    function setupModCoordination() {
        if (modCoordinationSetup) return;
        if (!window.ModCoordination) {
            setTimeout(setupModCoordination, 500);
            return;
        }
        modCoordinationSetup = true;

        try {
            window.ModCoordination.registerMod(modName, {
                priority: 5,
                metadata: { description: modDescription }
            });

            if (modCoordinationUnsubscribe) {
                modCoordinationUnsubscribe();
            }

            modCoordinationUnsubscribe = window.ModCoordination.on('modActiveChanged', (data) => {
                if (BLOCKING_ANALYSIS_MODS.includes(data.modName)) {
                    handleBlockingModCoordination();
                }
            });

            handleBlockingModCoordination();
        } catch (error) {
            console.error(`[${modName}] Mod coordination setup failed:`, error);
        }
    }

    function teardownModCoordination() {
        if (modCoordinationUnsubscribe) {
            try {
                modCoordinationUnsubscribe();
            } catch (error) {
                console.error(`[${modName}] Error unsubscribing from mod coordination:`, error);
            }
            modCoordinationUnsubscribe = null;
        }

        if (window.ModCoordination) {
            try {
                window.ModCoordination.unregisterMod(modName);
            } catch (error) {
                console.error(`[${modName}] Error unregistering from mod coordination:`, error);
            }
        }

        modCoordinationSetup = false;
    }

    function startBetterAnalyticsRuntime() {
        if (!shouldBetterAnalyticsRun()) return;
        initializeBetterAnalytics();
        initSandboxPanel();
    }

    function setupModLifecycleHandlers() {
        if (modLifecycleHandlersSetup) return;
        modLifecycleHandlersSetup = true;

        modDisableMessageHandler = (event) => {
            const msg = event.data?.message;
            if (msg?.action === 'updateLocalModState' &&
                msg.name === 'Super Mods/Better Analytics.js' &&
                msg.enabled === false) {
                cleanup();
            }
        };
        window.addEventListener('message', modDisableMessageHandler);

        pageUnloadHandler = () => {
            cleanup();
        };
        window.addEventListener('beforeunload', pageUnloadHandler);
        window.addEventListener('unload', pageUnloadHandler);

        visibilityChangeHandler = () => {
            if (document.hidden) {
                if (isTracking) {
                    stopDamageTracking();
                }
            }
        };
        document.addEventListener('visibilitychange', visibilityChangeHandler);
    }
    
    // =======================
    // 4. Core Functions
    // =======================
    
    // Helper function to validate if an element should receive DPS
    function isValidDamageElement(element) {
        // Must be a font-outlined-fill element
        if (!element?.classList?.contains('font-outlined-fill')) {
            return false;
        }
        
        // Must NOT be inside a portrait container
        if (element.closest(PORTRAIT_CONTAINER_SELECTOR)) {
            return false;
        }
        
        // Must be inside a stats container (right side)
        if (!element.closest(STATS_CONTAINER_SELECTOR)) {
            return false;
        }
        
        // Must have a nearby damage or healing icon
        const parentContainer = element.closest('li');
        if (!parentContainer) {
            return false;
        }
        
        const hasDamageIcon = parentContainer.querySelector('img[alt="damage"]');
        const hasHealingIcon = parentContainer.querySelector('img[alt="healing"]') || parentContainer.querySelector('img[alt="heal"]');
        
        return hasDamageIcon || hasHealingIcon;
    }
    
    function initializeBetterAnalytics() {
        if (!shouldBetterAnalyticsRun()) return;

        const checkGameState = () => {
            if (!shouldBetterAnalyticsRun()) return;

            if (globalThis.state && globalThis.state.board && globalThis.state.gameTimer) {
                setupBoardStateMonitoring();
                setupServerResultsMonitoring();
                setupWorldEventTracking();
                setupAnalyzerObserver();
                setupAutoOpenImpactAnalyzer();
                
                // Check if we already have server results available on initialization
                const boardState = globalThis.state.board.getSnapshot();
                const { serverResults, mode } = boardState.context;
                
                if ((mode === 'autoplay' || mode === 'manual') && 
                    serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                    // If server results are already available, trigger an initial DPS update
                    setTimeout(() => {
                        const analyzerPanel = getAnalyzerPanel();
                        if (analyzerPanel) {
                            restoreFrozenDPSDisplays();
                        }
                    }, 200);
                }
            } else {
                setTimeout(checkGameState, 100);
            }
        };
        
        checkGameState();
    }
    
    function setupServerResultsMonitoring() {
        if (serverResultsSubscription) {
            serverResultsSubscription.unsubscribe();
        }
        
        serverResultsSubscription = globalThis.state.board.subscribe((state) => {
            if (!shouldBetterAnalyticsRun()) return;
            if (!state.context) return; // Skip if context not initialized yet
            
            const { serverResults, mode } = state.context;
            currentGameMode = mode;
            
            if (serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                const gameTicks = serverResults.rewardScreen.gameTicks;
                
                if (isTracking) {
                    updateFinalDPSWithGameTicks(gameTicks);
                } else if (mode === 'autoplay' || mode === 'manual') {
                    // For autoplay and manual modes, update DPS even if tracking has stopped
                    updateFinalDPSWithGameTicks(gameTicks);
                    
                    // Set up continuous DPS updates for these modes
                    if (!dpsUpdateInterval) {
                        dpsUpdateInterval = setInterval(() => {
                            updateDPSDisplay();
                        }, TIMING.DPS_UPDATE_INTERVAL);
                    }
                }
                
                // Also trigger a restoration of frozen DPS displays when server results become available
                // This helps with the initial load issue
                setTimeout(() => {
                    const analyzerPanel = getAnalyzerPanel();
                    if (analyzerPanel) {
                        restoreFrozenDPSDisplays();
                    }
                }, 50);
            }
        });
    }
    
    function updateFinalDPSWithGameTicks(gameTicks) {
        setTimeout(() => {
            updateDamageData();
            
            const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
            if (!analyzerPanel) {
                console.log(`[${modName}][DEBUG][updateFinalDPSWithGameTicks] No analyzer panel found for final DPS update`);
                return;
            }
            
            const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
            
            damageValueElements.forEach((damageValueElement, index) => {
                // Use the new validation helper
                if (!isValidDamageElement(damageValueElement)) {
                    return;
                }
                
                            const damageText = damageValueElement.textContent.trim();
            const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
            
            const parentContainer = damageValueElement.closest('li');
            const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
            const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
            
            // Always create DPS display for all creatures during restoration
            let dpsDisplay = damageValueElement.parentNode.querySelector(`.${CSS_CLASSES.DPS_DISPLAY}`);
            if (!dpsDisplay) {
                dpsDisplay = createDPSDisplayElement();
                damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
            }
            
            // If healing creature, show 0/s; if damage creature, calculate actual DPS
            if (damageText.includes('+')) {
                dpsDisplay.textContent = '(0/s)';
                dpsDisplay.style.opacity = '0.7';
                dpsDisplay.style.fontStyle = 'italic';
                return; // Skip DPS calculation for healing creatures
            }
            
            const finalDPS = calculateDPS(creatureId, damageValue, gameTicks);
            dpsDisplay.textContent = `(${finalDPS}/s)`;
        });
            
            const dpsDisplays = document.querySelectorAll(`.${CSS_CLASSES.DPS_DISPLAY}`);
            dpsDisplays.forEach(display => {
                display.style.opacity = '0.7';
                display.style.fontStyle = 'italic';
                display.removeAttribute('title');
            });
            

        }, TIMING.FINAL_UPDATE_DELAY);
    }
    
    function getCurrentGameTicks() {
        try {
            const boardState = globalThis.state.board.getSnapshot();
            const { serverResults } = boardState.context;
            
            if (serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                const serverGameTicks = serverResults.rewardScreen.gameTicks;
                return serverGameTicks;
            }
            
            if (gameStartTick !== null && gameStartTick !== undefined) {
                const timerSnapshot = globalThis.state.gameTimer.getSnapshot();
                const currentTick = timerSnapshot.context.currentTick;
                const localGameTicks = currentTick - gameStartTick;
                
                if (localGameTicks > 0) {
                    return localGameTicks;
                }
            }
            
            return null;
        } catch (error) {
            console.log(`[${modName}][DEBUG][getCurrentGameTicks] Error getting current game ticks`, error);
            return null;
        }
    }
    

    
    function setupBoardStateMonitoring() {
        if (boardSubscription) {
            boardSubscription.unsubscribe();
        }
        
        const boardState = globalThis.state.board.select((state) => ({
            gameStarted: state.context?.gameStarted,
            mode: state.context?.mode
        }));
        
        boardSubscription = boardState.subscribe((data) => {
            if (!data.mode) return; // Skip if context not initialized yet
            currentGameMode = data.mode;
            
            if (isProcessing) return;
            
            // Only reset tracking session if we don't have a gameStartTick (truly new game)
            if (data.gameStarted && !isTracking && (gameStartTick === null || gameStartTick === 0)) {
                resetTrackingSession();
            }
            
            if (!data.gameStarted && isTracking) {
                stopDamageTracking();
            }
        });
        
        gameTimerSubscription = globalThis.state.gameTimer.subscribe((timerState) => {
            const { state: gameState } = timerState.context;
            
            if ((gameState === 'victory' || gameState === 'defeat') && isTracking) {
                stopDamageTracking();
            }
        });
        
        globalThis.state.board.on('newGame', (event) => {
            if (isProcessing) return;
            resetTrackingSession();
        });
        
        globalThis.state.board.on('emitNewGame', (event) => {
            if (isProcessing) return;
            resetTrackingSession();
        });
        
        globalThis.state.board.on('emitEndGame', (event) => {
            if (isProcessing) return;
            stopDamageTracking();
        });
    }
    
    function setupWorldEventTracking() {
        // Clean up previous world subscriptions
        worldEventSubscriptions.forEach(sub => {
            if (sub && typeof sub.unsubscribe === 'function') {
                sub.unsubscribe();
            }
        });
        worldEventSubscriptions = [];
        
        const listener = globalThis.state.board.on('newGame', (event) => {
            const world = event.world;
            
            if (!world) return;
            
            // Track actor deaths for more accurate damage tracking (only when actively tracking)
            const deathSub = world.grid.onActorDeath.subscribe((deathEvent) => {
                // Only update if we're actively tracking and analyzer panel is available
                if (isTracking && getAnalyzerPanel()) {
                    updateDamageData();
                }
            });
            
            worldEventSubscriptions.push(deathSub);
            
            // Clean up when game ends
            const endSub = world.onGameEnd.once(() => {
                // Final damage update on actual game end
                const boardState = globalThis.state.board.getSnapshot();
                const gameMode = boardState.context?.mode;
                
                // Only update for sandbox mode; autoplay/manual rely on server results
                if (gameMode === 'sandbox') {
                    setTimeout(() => {
                        updateDamageData();
                        restoreFrozenDPSDisplays();
                    }, 100);
                }
            });
            
            worldEventSubscriptions.push(endSub);
        });
        
        worldEventSubscriptions.push(listener);
    }
    
    function resetTrackingSession() {

        damageTrackingData.clear();
        gameStartTick = 0;
    }
    
    function getAnalyzerPanel() {
        const now = Date.now();
        if (cachedAnalyzerPanel && (now - cacheTimestamp) < CACHE_DURATION) {
            return cachedAnalyzerPanel;
        }
        
        cachedAnalyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
        cacheTimestamp = now;
        return cachedAnalyzerPanel;
    }
    
    function hasAnalyzerStructure(element) {
        return element?.querySelector && (
            element.querySelector('button[aria-controls*="ally"]') && 
            element.querySelector('button[aria-controls*="villain"]') &&
            element.querySelector('img[alt="damage"]')
        );
    }
    
    function setupAnalyzerObserver() {
        if (analyzerObserver) {
            analyzerObserver.disconnect();
        }
        
        analyzerObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
                    const target = mutation.target;
                    const newState = target.getAttribute('data-state');
                    
                    if (hasAnalyzerStructure(target)) {
                        if (newState === 'open') {
                            startDamageTracking();
                        } else if (newState === 'closed') {
                            stopDamageTracking();
                        }
                    }
                } else if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches?.(ANALYZER_PANEL_SELECTOR) && hasAnalyzerStructure(node)) {
                                startDamageTracking();
                            }
                            const analyzerPanel = node.querySelector?.(ANALYZER_PANEL_SELECTOR);
                            if (analyzerPanel && hasAnalyzerStructure(analyzerPanel)) {
                                startDamageTracking();
                            }
                        }
                    });
                    
                    mutation.removedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches?.(ANALYZER_PANEL_SELECTOR) && hasAnalyzerStructure(node)) {
                                cleanupTabButtonListeners();
                                stopDamageTracking();
                            }
                            const analyzerPanel = node.querySelector?.(ANALYZER_PANEL_SELECTOR);
                            if (analyzerPanel && hasAnalyzerStructure(analyzerPanel)) {
                                cleanupTabButtonListeners();
                                stopDamageTracking();
                            }
                        }
                    });
                }
                
                // Clear cache on any DOM changes to ensure fresh queries
                if (mutation.type === 'childList' || mutation.type === 'attributes') {
                    cachedAnalyzerPanel = null;
                    cacheTimestamp = 0;
                }
            });
        });
        
        analyzerObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-state']
        });
        
        const existingAnalyzer = getAnalyzerPanel();
        if (existingAnalyzer && hasAnalyzerStructure(existingAnalyzer)) {
            startDamageTracking();
        }
    }
    
    function setupAutoOpenImpactAnalyzer() {
        if (autoOpenObserver) {
            autoOpenObserver.disconnect();
        }
        
        // Helper function to handle button auto-open logic
        function handleButtonAutoOpen(button) {
            if (!button || button.disabled || isProcessing) {
                return;
            }
            
            const boardState = globalThis.state.board.getSnapshot();
            if (!boardState.context.gameStarted) {
                return;
            }
            
            const delay = 100;
            
            setTimeout(() => {
                if (button && !button.disabled) {
                    button.click();
                    
                    if (boardState.context.mode === 'autoplay') {
                        setTimeout(() => {
                            const analyzerPanel = getAnalyzerPanel();
                            if (analyzerPanel) {
                                startDamageTracking();
                            } else {
                                waitForAnalyzerPanelAndStartTracking();
                            }
                        }, 25);
                    } else {
                        const trackingDelay = 100;
                        setTimeout(() => {
                            waitForAnalyzerPanelAndStartTracking();
                        }, trackingDelay);
                    }
                }
            }, delay);
        }
        
        autoOpenObserver = new MutationObserver((mutations) => {
            if (isProcessing) {
                return;
            }
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const impactAnalyzerButton = node.querySelector && node.querySelector('button img[alt="impact analyser"]');
                            if (impactAnalyzerButton) {
                                const button = impactAnalyzerButton.closest('button');
                                if (button) {
                                    handleButtonAutoOpen(button);
                                }
                            }
                        }
                    });
                }
            });
        });
        
        autoOpenObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Handle existing button
        const existingButton = document.querySelector('button img[alt="impact analyser"]');
        if (existingButton) {
            const button = existingButton.closest('button');
            if (button) {
                handleButtonAutoOpen(button);
            }
        }
    }
    
        function waitForAnalyzerPanelAndStartTracking() {
        if (isWaitingForPanel || isProcessing) return;
        
        isWaitingForPanel = true;
        
        const boardState = globalThis.state.board.getSnapshot();
        const gameMode = boardState.context.mode;
        const maxAttempts = gameMode === 'sandbox' ? 50 : 20;
        const retryInterval = gameMode === 'sandbox' ? 100 : 50;
        
        let retryAttempts = 0;
        
        const checkAndStart = () => {
            retryAttempts++;
            
            const analyzerPanel = getAnalyzerPanel();
            if (analyzerPanel) {
                const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
                
                if (damageValueElements.length > 0 || retryAttempts >= maxAttempts) {
                    isWaitingForPanel = false;
                    
                    const boardState = globalThis.state.board.getSnapshot();
                    const timerState = globalThis.state.gameTimer.getSnapshot();
                    
                    if (boardState.context.gameStarted && timerState.context.state !== 'victory' && timerState.context.state !== 'defeat') {
                        startDamageTracking();
                    } else {
                        handleGameEndedWhileWaiting(damageValueElements, gameMode);
                    }
                    return;
                }
            }
            
            if (retryAttempts < maxAttempts) {
                setTimeout(checkAndStart, retryInterval);
            } else {
                isWaitingForPanel = false;
                handleMaxAttemptsReached();
            }
        };
        
        checkAndStart();
    }
    
    function handleGameEndedWhileWaiting(damageValueElements, gameMode) {
        if (damageValueElements.length === 0) return;
        
        if (gameMode === 'manual') {
            const { serverResults } = globalThis.state.board.getSnapshot().context;
            if (serverResults?.rewardScreen?.gameTicks) {
                updateFinalDPSWithGameTicks(serverResults.rewardScreen.gameTicks);
            }
        } else {
            const delay = gameMode === 'sandbox' ? 100 : 200;
            setTimeout(() => {
                restoreFrozenDPSDisplays();
                setupTabButtonListeners();
            }, delay);
        }
    }
    
    function handleMaxAttemptsReached() {
        const boardState = globalThis.state.board.getSnapshot();
        const timerState = globalThis.state.gameTimer.getSnapshot();
        
        if (boardState.context.gameStarted && timerState.context.state !== 'victory' && timerState.context.state !== 'defeat') {
            startDamageTracking();
            return;
        }
        
        if (boardState.context.mode === 'manual') {
            const { serverResults } = boardState.context;
            if (serverResults?.rewardScreen?.gameTicks) {
                updateFinalDPSWithGameTicks(serverResults.rewardScreen.gameTicks);
            }
            return;
        }
        
        const delay = boardState.context.mode === 'sandbox' ? 100 : 200;
        setTimeout(() => {
            restoreFrozenDPSDisplays();
            setupTabButtonListeners();
        }, delay);
    }
    
    function handleTabSwitch() {
        // Clear cache to force fresh DOM query
        cachedAnalyzerPanel = null;
        cacheTimestamp = 0;
        
        // Always restore DPS displays on tab switch to ensure they exist for all creatures
        setTimeout(() => {
            restoreFrozenDPSDisplays();
        }, TIMING.TAB_SWITCH_DELAY * 2);
        
        // If actively tracking, also update with current data
        if (isTracking) {
            // Create placeholders immediately
            createPlaceholderDPSDisplays();
            
            // Update DPS with a longer delay to ensure DOM is fully updated
            setTimeout(() => {
                updateDamageData();
                updateDPSDisplay();
            }, TIMING.TAB_SWITCH_DELAY * 2);
        } else {
            // If not tracking, check if we have server results and update DPS accordingly
            const boardState = globalThis.state.board.getSnapshot();
            const { serverResults, mode } = boardState.context;
            
            if ((mode === 'autoplay' || mode === 'manual') && 
                serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                setTimeout(() => {
                    updateFinalDPSWithGameTicks(serverResults.rewardScreen.gameTicks);
                }, TIMING.TAB_SWITCH_DELAY * 2);
            }
        }
    }
    
    function setupTabButtonListeners() {
        const analyzerPanel = getAnalyzerPanel();
        if (analyzerPanel) {
            const allyButton = analyzerPanel.querySelector('button[aria-controls*="ally"]');
            const villainButton = analyzerPanel.querySelector('button[aria-controls*="villain"]');
            
            if (allyButton && !allyButton.hasAttribute(ATTRIBUTES.DPS_LISTENER)) {
                allyButton.setAttribute(ATTRIBUTES.DPS_LISTENER, 'true');
                allyButton.addEventListener('click', handleTabSwitch);
            }
            
            if (villainButton && !villainButton.hasAttribute(ATTRIBUTES.DPS_LISTENER)) {
                villainButton.setAttribute(ATTRIBUTES.DPS_LISTENER, 'true');
                villainButton.addEventListener('click', handleTabSwitch);
            }
        }
    }
    
    function restoreFrozenDPSDisplays() {
        const analyzerPanel = getAnalyzerPanel();
        if (!analyzerPanel) {
            return;
        }
        
        const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
        
        const boardState = globalThis.state.board.getSnapshot();
        const gameMode = boardState.context.mode;
        const { serverResults } = boardState.context;
        
        let gameTicks = null;
        // Check for server results in both autoplay and manual modes
        if ((gameMode === 'autoplay' || gameMode === 'manual') && 
            serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
            gameTicks = serverResults.rewardScreen.gameTicks;
        }
        
        damageValueElements.forEach((damageValueElement, index) => {
            // Use the new validation helper
            if (!isValidDamageElement(damageValueElement)) {
                return;
            }
            
            const damageText = damageValueElement.textContent.trim();
            const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
            
            const parentContainer = damageValueElement.closest('li');
            
            const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
            const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
            
            // Always create DPS display for all creatures during restoration
            let dpsDisplay = damageValueElement.parentNode.querySelector(`.${CSS_CLASSES.DPS_DISPLAY}`);
            if (!dpsDisplay) {
                dpsDisplay = createDPSDisplayElement();
                damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
            }
            
            // If healing creature, show 0/s; if damage creature, calculate actual DPS
            if (damageText.includes('+')) {
                dpsDisplay.textContent = '(0/s)';
                dpsDisplay.style.opacity = '0.7';
                dpsDisplay.style.fontStyle = 'italic';
                return; // Skip DPS calculation for healing creatures
            }
            
            let finalDPS;
            if (gameTicks !== null) {
                finalDPS = calculateDPS(creatureId, damageValue, gameTicks);
            } else {
                finalDPS = calculateDPS(creatureId, damageValue);
            }
            
            dpsDisplay.textContent = `(${finalDPS}/s)`;
            
            dpsDisplay.style.opacity = '0.7';
            dpsDisplay.style.fontStyle = 'italic';
            dpsDisplay.removeAttribute('title');
        });
        
        // Enhanced retry mechanism for both autoplay and manual modes when server results aren't available
        if ((gameMode === 'autoplay' || gameMode === 'manual') && gameTicks === null) {
            let retryAttempts = 0;
            const maxRetries = 20;
            const baseInterval = 100;
            
            const retryWithServerResults = () => {
                retryAttempts++;
                const retryBoardState = globalThis.state.board.getSnapshot();
                const retryServerResults = retryBoardState.context.serverResults;
                
                if (retryServerResults && retryServerResults.rewardScreen && typeof retryServerResults.rewardScreen.gameTicks === 'number') {
                    const retryGameTicks = retryServerResults.rewardScreen.gameTicks;
                    
                    damageValueElements.forEach((damageValueElement, index) => {
                        // Use the new validation helper
                        if (!isValidDamageElement(damageValueElement)) {
                            return;
                        }
                        
                        const damageText = damageValueElement.textContent.trim();
                        const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
                        
                        const parentContainer = damageValueElement.closest('li');
                        
                        const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
                        const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
                        
                        // Always create DPS display for all creatures during restoration
                        let dpsDisplay = damageValueElement.parentNode.querySelector(`.${CSS_CLASSES.DPS_DISPLAY}`);
                        if (!dpsDisplay) {
                            dpsDisplay = createDPSDisplayElement();
                            damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
                        }
                        
                        // If healing creature, show 0/s; if damage creature, calculate actual DPS
                        if (damageText.includes('+')) {
                            dpsDisplay.textContent = '(0/s)';
                            dpsDisplay.style.opacity = '0.7';
                            dpsDisplay.style.fontStyle = 'italic';
                            return; // Skip DPS calculation for healing creatures
                        }
                        
                        const finalDPS = calculateDPS(creatureId, damageValue, retryGameTicks);
                        dpsDisplay.textContent = `(${finalDPS}/s)`;
                    });
                } else if (retryAttempts < maxRetries) {
                    // Progressive backoff: increase interval with each retry
                    const retryInterval = baseInterval + (retryAttempts * 50);
                    setTimeout(retryWithServerResults, retryInterval);
                } else {
                    // Only warn every 5th occurrence to reduce spam
                    if (!window._betterAnalyticsWarningCount) {
                        window._betterAnalyticsWarningCount = 0;
                    }
                    window._betterAnalyticsWarningCount++;
                    
                    if (window._betterAnalyticsWarningCount % 5 === 0) {
                        console.log(`[${modName}][DEBUG][restoreFrozenDPSDisplays] ${gameMode} mode: Server results still not available after ${maxRetries} retries (warning ${window._betterAnalyticsWarningCount})`);
                    }
                }
            };
            
            setTimeout(retryWithServerResults, baseInterval);
        }
    }
    
    function startDamageTracking() {
        if (isTracking) return;
        
        const boardState = globalThis.state.board.getSnapshot();
        const timerState = globalThis.state.gameTimer.getSnapshot();
        
        if (!boardState.context.gameStarted) {
            console.log(`[${modName}][DEBUG][startDamageTracking] Game not started yet, skipping tracking`);
            return;
        }
        
        if (timerState.context.state === 'victory' || timerState.context.state === 'defeat') {
            setTimeout(() => {
                restoreFrozenDPSDisplays();
                setupTabButtonListeners();
            }, TIMING.RESTORE_DELAY);
            return;
        }
        
        if (gameStartTick === null || gameStartTick === undefined) {
            // For sandbox mode, auto-set game start tick
            if (boardState.context.mode === 'sandbox') {
                const timerSnapshot = globalThis.state.gameTimer.getSnapshot();
                const currentTick = timerSnapshot.context.currentTick;
                gameStartTick = currentTick > 0 ? currentTick : 1;
                resetTracking();
            } else if (boardState.context.mode === 'manual') {
                // Manual mode relies on server results, don't auto-set gameStartTick
                console.log(`[${modName}][INFO][startDamageTracking] Manual mode detected, waiting for server results`);
                return;
            } else {
                console.log(`[${modName}][DEBUG][startDamageTracking] Game start tick not set, this should not happen`);
                return;
            }
        }
        
        isTracking = true;
        cleanupAllDPSDisplays();
        
        // If game is over, immediately show final DPS values
        if (!globalThis.state.board.getSnapshot().context.gameStarted) {
            setTimeout(() => {
                updateDPSDisplay();
            }, 100);
        }
        
        dpsUpdateInterval = setInterval(() => {
            updateDPSDisplay();
        }, TIMING.DPS_UPDATE_INTERVAL);
        
        setTimeout(() => {
            updateDPSDisplay();
        }, 100);
        
        createPlaceholderDPSDisplays();
        setupTabButtonListeners();
    }
    
    function stopDamageTracking() {
        if (!isTracking) return;
        
        isTracking = false;
        
        // Clear the DPS update interval
        if (dpsUpdateInterval) {
            clearInterval(dpsUpdateInterval);
            dpsUpdateInterval = null;
        }
        
        // Update damage data one final time
        try {
            updateDamageData();
        } catch (error) {
            console.error(`[${modName}][ERROR][stopDamageTracking] Error updating damage data:`, error);
        }
        
        if (currentGameMode === 'sandbox') {
            try {
                const timerSnapshot = globalThis.state.gameTimer.getSnapshot();
                const finalTick = timerSnapshot.context.currentTick;
                const localGameTicks = finalTick - gameStartTick;
                
                if (localGameTicks > 0) {
                    updateFinalDPSWithGameTicks(localGameTicks);
                }
            } catch (error) {
                console.error(`[${modName}][ERROR][stopDamageTracking] Error in sandbox mode:`, error);
            }
        } else if (currentGameMode === 'autoplay' || currentGameMode === 'manual') {
            // For autoplay and manual modes, ensure DPS displays are maintained
            // Server results will trigger the final DPS update
            setTimeout(() => {
                try {
                    restoreFrozenDPSDisplays();
                } catch (error) {
                    console.error(`[${modName}][ERROR][stopDamageTracking] Error restoring frozen DPS displays:`, error);
                }
            }, 100);
        }
    }
    
    function updateDamageData() {
        const analyzerPanel = getAnalyzerPanel();
        if (!analyzerPanel) {
            return;
        }
        
        let damageEntries = analyzerPanel.querySelectorAll('li');
        
        if (damageEntries.length === 0) {
            for (const selector of ALTERNATIVE_DAMAGE_SELECTORS) {
                damageEntries = analyzerPanel.querySelectorAll(selector);
                if (damageEntries.length > 0) {
                    break;
                }
            }
        }
        
        const currentTick = globalThis.state.gameTimer.getSnapshot().context.currentTick;
        
        damageEntries.forEach((entry, index) => {
            const damageValueElement = entry.querySelector(DAMAGE_VALUE_SELECTOR);
            if (!damageValueElement) {
                return;
            }
            
            const damageText = damageValueElement.textContent.trim();
            const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
            
            const portraitImg = entry.querySelector('img[alt="creature"]');
            const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
            
            if (!damageTrackingData.has(creatureId)) {
                damageTrackingData.set(creatureId, {
                    totalDamage: 0
                });
            }
            
            const creatureData = damageTrackingData.get(creatureId);
            creatureData.totalDamage = damageValue;
        });
    }
    
    function calculateDPS(creatureId, currentDamage, gameTicks = null) {
        if (!currentDamage || currentDamage === 0) {
            return 0;
        }
        
        const ticks = gameTicks !== null ? gameTicks : getCurrentGameTicks();
        if (!ticks || ticks <= 0) {
            return 0;
        }
        
        const dpt = currentDamage / ticks;
        const dps = dpt * TICKS_PER_SECOND;
        
        return Math.round(dps * 100) / 100;
    }
    

    
    function updateDPSDisplay() {
        // Allow autoplay and manual modes to update DPS even when not actively tracking
        const boardState = globalThis.state.board.getSnapshot();
        const gameMode = boardState.context.mode;
        
        if (!isTracking && gameMode !== 'autoplay' && gameMode !== 'manual') {
            return;
        }
    
        updateDamageData();
        
        const analyzerPanel = getAnalyzerPanel();
        if (!analyzerPanel) {
            return;
        }
        
        const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
        
        damageValueElements.forEach((damageValueElement, index) => {
            // Use the new validation helper
            if (!isValidDamageElement(damageValueElement)) {
                return;
            }
            
            const damageText = damageValueElement.textContent.trim();
            const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
            
            const parentContainer = damageValueElement.closest('li');
            const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
            const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
            
            // Always create DPS display for all creatures during restoration
            let dpsDisplay = damageValueElement.parentNode.querySelector(`.${CSS_CLASSES.DPS_DISPLAY}`);
            if (!dpsDisplay) {
                dpsDisplay = createDPSDisplayElement();
                damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
            }
            
            // If healing creature, show 0/s; if damage creature, calculate actual DPS
            if (damageText.includes('+')) {
                dpsDisplay.textContent = '(0/s)';
                dpsDisplay.style.opacity = '0.7';
                dpsDisplay.style.fontStyle = 'italic';
                return; // Skip DPS calculation for healing creatures
            }
            
            const totalDPS = calculateDPS(creatureId, damageValue);
            dpsDisplay.textContent = `(${totalDPS}/s)`;
            
            dpsDisplay.style.opacity = '1';
            dpsDisplay.style.fontStyle = 'normal';
        });
    }
    
    function createDPSDisplayElement() {
        const dpsDisplay = document.createElement('span');
        dpsDisplay.className = CSS_CLASSES.DPS_DISPLAY;
        dpsDisplay.style.cssText = `
            font-size: 11px;
            color: #ffffff;
            margin-left: 2px;
            font-family: inherit;
            display: inline;
            font-weight: inherit;
            line-height: inherit;
            vertical-align: top;
            position: relative;
            top: -2px;
        `;
        dpsDisplay.removeAttribute('title');
        return dpsDisplay;
    }
    
    function createPlaceholderDPSDisplays() {
        const analyzerPanel = getAnalyzerPanel();
        if (!analyzerPanel) {
            return;
        }

        const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
        damageValueElements.forEach((damageValueElement, index) => {
            // Use the new validation helper
            if (!isValidDamageElement(damageValueElement)) {
                return;
            }

            let dpsDisplay = damageValueElement.parentNode.querySelector(`.${CSS_CLASSES.DPS_DISPLAY}`);
            if (!dpsDisplay) {
                dpsDisplay = createDPSDisplayElement();
                dpsDisplay.textContent = '(0/s)';
                dpsDisplay.style.opacity = '0.7';
                dpsDisplay.style.fontStyle = 'italic';
                damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
            } else {
                dpsDisplay.textContent = '(0/s)';
            }
        });
        
        // Force a refresh of the cache after creating placeholders
        setTimeout(() => {
            cachedAnalyzerPanel = null;
            cacheTimestamp = 0;
        }, 50);
    }
    
    // =======================
    // 5. Utility Functions
    // =======================
    
    function resetTracking() {
        damageTrackingData.clear();
        // Only set gameStartTick if it hasn't been set yet
        if (gameStartTick === null) {
            const currentTick = globalThis.state.gameTimer.getSnapshot().context.currentTick;
            gameStartTick = currentTick;
        }
    }
    
    function cleanup() {
        try {
            cleanupRuntime();
            isPausedForBlockingMod = false;

            if (pageUnloadHandler) {
                window.removeEventListener('beforeunload', pageUnloadHandler);
                window.removeEventListener('unload', pageUnloadHandler);
                pageUnloadHandler = null;
            }

            if (visibilityChangeHandler) {
                document.removeEventListener('visibilitychange', visibilityChangeHandler);
                visibilityChangeHandler = null;
            }

            if (modDisableMessageHandler) {
                window.removeEventListener('message', modDisableMessageHandler);
                modDisableMessageHandler = null;
            }

            modLifecycleHandlersSetup = false;
            teardownModCoordination();

            console.log(`[${modName}][DEBUG][cleanup] Cleanup completed successfully`);
        } catch (error) {
            console.error(`[${modName}][ERROR][cleanup] Error during cleanup:`, error);
        }
    }
    function cleanupAllDPSDisplays() {
        try {
            // Remove all DPS displays, including those in wrong locations
            const dpsDisplays = document.querySelectorAll(`.${CSS_CLASSES.DPS_DISPLAY}`);
            dpsDisplays.forEach(display => {
                // Only remove DPS displays that are not in the correct stats area
                const statsContainer = display.closest(STATS_CONTAINER_SELECTOR);
                if (!statsContainer) {
                    display.remove();
                }
            });
            
            // Also remove any DPS displays that might be inside portrait containers
            const portraitDPSDisplays = document.querySelectorAll(`${PORTRAIT_CONTAINER_SELECTOR} .${CSS_CLASSES.DPS_DISPLAY}`);
            portraitDPSDisplays.forEach(display => display.remove());
            

        } catch (error) {
            console.log(`[${modName}][DEBUG][cleanupAllDPSDisplays] Error cleaning up DPS displays`, error);
        }
    }
    
    function cleanupTabButtonListeners() {
        const analyzerPanel = getAnalyzerPanel();
        if (analyzerPanel) {
            const allyButton = analyzerPanel.querySelector('button[aria-controls*="ally"]');
            const villainButton = analyzerPanel.querySelector('button[aria-controls*="villain"]');
            
            if (allyButton && allyButton.hasAttribute(ATTRIBUTES.DPS_LISTENER)) {
                allyButton.removeEventListener('click', handleTabSwitch);
                allyButton.removeAttribute(ATTRIBUTES.DPS_LISTENER);
            }
            
            if (villainButton && villainButton.hasAttribute(ATTRIBUTES.DPS_LISTENER)) {
                villainButton.removeEventListener('click', handleTabSwitch);
                villainButton.removeAttribute(ATTRIBUTES.DPS_LISTENER);
            }
        }
    }
    
    // =======================
    // 5b. Sandbox Analytics Panel
    // =======================

    const PANEL_ID = 'mod-better-sandbox-panel';
    const BUTTON_ID = 'mod-better-sandbox-button';
    const ADVANCED_BUTTON_LABEL = 'Advanced Analytics';
    const UNITS_BODY_ID = 'mod-better-sandbox-units-body';
    const LOG_BODY_ID = 'mod-better-sandbox-log-body';
    const LOG_LIST_ID = 'mod-better-sandbox-log-list';
    const TITLE_ID = 'mod-better-sandbox-title';
    const STATUS_ID = 'mod-better-sandbox-status';
    const SPEED_SLIDER_ID = 'mod-better-sandbox-speed-slider';
    const SPEED_VALUE_ID = 'mod-better-sandbox-speed-value';
    const SLOW_MOTION_TOGGLE_ID = 'mod-better-sandbox-slow-motion-toggle';
    const STYLE_ID = 'better-sandbox-styles';
    const STORAGE_KEY = 'betterSandboxPanel';

    const BATTLE_LOG_MAX = 500;
    const PANEL_TICK_POLL_MS = 50;
    const DEFAULT_TICK_INTERVAL_MS = 62.5;
    const MIN_TICK_INTERVAL_MS = 16;
    const SPEED_MIN_PERCENT = 5;
    const SPEED_MAX_PERCENT = 100;
    const SPEED_STEP_PERCENT = 5;
    const LOG_FILTER_DEFAULTS = {
        allyDmg: true,
        allyHeal: true,
        villainDmg: true,
        villainHeal: true
    };
    const LOG_FILTER_LABELS = {
        allyDmg: 'Ally dmg',
        allyHeal: 'Ally heal',
        villainDmg: 'Villain dmg',
        villainHeal: 'Villain heal'
    };
    const PANEL_DEFAULTS = {
        left: 120, top: 80, width: 400, height: 520, isOpen: false,
        activeTab: 'units', gameSpeedPercent: 100, slowMotionEnabled: false,
        logFilters: { ...LOG_FILTER_DEFAULTS }
    };
    const PANEL_LAYOUT = { minWidth: 300, maxWidth: 900, minHeight: 280, maxHeight: 900 };
    const RESIZE_EDGE_PX = 8;

    const STAT_KEYS = [
        { key: 'hp', label: 'HP' },
        { key: 'ad', label: 'AD' },
        { key: 'ap', label: 'AP' },
        { key: 'armor', label: 'ARM' },
        { key: 'magicResist', label: 'MR' },
        { key: 'speed', label: 'SPD' }
    ];

    let activeWorld = null;
    let panelGameTimerSub = null;
    let panelTickPollTimer = null;
    let panelFightTick = null;
    let panelFightTickFrozen = null;
    let panelFightEndState = null;
    let boardUnsubs = [];
    const boardTrack = { roomId: null, floor: null, gameStarted: false, mode: null, configSig: '' };
    let worldEventSubs = [];
    let battleLog = [];
    let battleLogRevision = 0;
    let lastRenderedBattleLogRevision = 0;
    let lastScrolledBattleLogRevision = 0;
    let lastRenderedLogSignature = '';
    let logFilters = { ...LOG_FILTER_DEFAULTS };
    let activeTab = 'units';
    let gameSpeedPercent = 100;
    let slowMotionEnabled = false;
    let tickSpeedSubscription = null;
    let turboSuspendedForSlowMotion = false;
    let gameIdByNameCache = null;
    let collapsedOverrides = new Map();
    let unitsInteractUntil = 0;
    let lastUnitsRenderKey = '';
    const UNITS_INTERACT_FREEZE_MS = 10;
    let pendingUnitsForceRefresh = false;
    const fightActorCollapseKeys = new WeakMap();
    let fightActorInstanceSeq = 0;
    let cachedSpawnTileKeyLookup = null;
    let panelResizeMouseMoveHandler = null;
    let panelResizeMouseUpHandler = null;
    let panelViewportListenerAttached = false;
    let unitsBodyClickHandler = null;

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

    function loadPanelSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...PANEL_DEFAULTS, logFilters: { ...LOG_FILTER_DEFAULTS } };
            const parsed = JSON.parse(raw);
            return {
                ...PANEL_DEFAULTS,
                ...parsed,
                logFilters: { ...LOG_FILTER_DEFAULTS, ...(parsed.logFilters || {}) }
            };
        } catch {
            return { ...PANEL_DEFAULTS, logFilters: { ...LOG_FILTER_DEFAULTS } };
        }
    }

    function loadLogFilters() {
        logFilters = { ...LOG_FILTER_DEFAULTS, ...loadPanelSettings().logFilters };
    }

    function saveLogFilters() {
        savePanelSettings({ logFilters: { ...logFilters } });
    }

    function loadCollapsedOverrides() {
        collapsedOverrides = new Map();
        try {
            const stored = loadPanelSettings().collapsedOverrides;
            if (Array.isArray(stored)) {
                for (const [key, value] of stored) {
                    if (typeof key === 'string') {
                        collapsedOverrides.set(normalizeCollapseKey(key), value === true);
                    }
                }
            }
        } catch { /* ignore */ }
    }

    function saveCollapsedOverrides() {
        savePanelSettings({ collapsedOverrides: Array.from(collapsedOverrides.entries()) });
    }

    function savePanelSettings(patch) {
        try {
            const next = { ...loadPanelSettings(), ...patch };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    }

    function clamp(n, min, max) {
        return Math.max(min, Math.min(max, n));
    }

    function clampPanelSize(val, min, max) {
        return clamp(val, min, max);
    }

    function isSandboxMode() {
        try {
            const mode = getBoardContext()?.mode;
            return typeof mode === 'string' && mode.toLowerCase() === 'sandbox';
        } catch {
            return false;
        }
    }

    function getPlayModeLabel() {
        try {
            const mode = getBoardContext()?.mode;
            if (typeof mode !== 'string' || !mode) return null;
            return mode.charAt(0).toUpperCase() + mode.slice(1);
        } catch {
            return null;
        }
    }

    function ensureFightTracking(world) {
        const w = world ?? getActiveWorld();
        if (!w?.grid) return;
        if (activeWorld === w && worldEventSubs.length) {
            if (slowMotionEnabled && isSandboxMode()) applyTickIntervalToWorld(activeWorld);
            return;
        }
        teardownWorldSubscriptions();
        activeWorld = w;
        registerFightActorCollapseKeys(activeWorld);
        setupWorldSubscriptions(activeWorld);
        if (slowMotionEnabled && isSandboxMode()) applyTickIntervalToWorld(activeWorld);
    }

    function getBoardContext() {
        try {
            return globalThis.state?.board?.getSnapshot?.()?.context ?? null;
        } catch {
            return null;
        }
    }

    function resolveCurrentFloor() {
        const floor = getBoardContext()?.floor;
        return typeof floor === 'number' && Number.isFinite(floor) ? floor : 0;
    }

    const ASCENSION_GENE_KEYS = ['hp', 'ad', 'ap', 'armor', 'magicResist'];
    const ASCENSION_VILLAIN_BASE_GENES = 20;
    const ASCENSION_VILLAIN_GENE_PER_FLOOR = 4;
    const ASCENSION_AWAKEN_FLOOR = 11;
    const ASCENSION_FLOOR_MAX = 15;

    function resolveAscensionDisplayMult(floor) {
        const f = Math.max(0, Math.min(ASCENSION_FLOOR_MAX, Number(floor) || 0));
        return (100 + 20 * f) / 100;
    }

    function buildAscensionVillainGenes(floor) {
        const f = Math.max(0, Math.min(ASCENSION_FLOOR_MAX, Number(floor) || 0));
        const geneValue = ASCENSION_VILLAIN_BASE_GENES + ASCENSION_VILLAIN_GENE_PER_FLOOR * f;
        return Object.fromEntries(ASCENSION_GENE_KEYS.map((key) => [key, geneValue]));
    }

    function resolveAscensionVillainCombatStats(metadata, floor, resolved) {
        const f = Math.max(0, Math.min(ASCENSION_FLOOR_MAX, Number(floor) || 0));
        const genes = buildAscensionVillainGenes(f);
        const level = resolved?.level;
        const statKeys = ['hp', 'ad', 'ap', 'armor', 'magicResist', 'speed'];
        const stats = {};
        const catalog = metadata?.baseStats ?? {};

        for (const key of statKeys) {
            if (key === 'speed') {
                stats[key] = catalog[key] ?? null;
                continue;
            }
            stats[key] = scaleCatalogStatValue(metadata, key, level, genes[key], false);
        }

        return {
            stats,
            mode: 'scaleStat(Fc+B$*floor)'
        };
    }

    function scaleCatalogStatValue(metadata, statKey, level, geneValue, awaken) {
        const scaleStat = globalThis.state?.utils?.scaleStat;
        const base = metadata?.baseStats?.[statKey];
        if (typeof scaleStat !== 'function' || base == null || level == null) return null;
        try {
            const args = { stat: base, level, awaken: awaken === true };
            if (geneValue != null) args.geneValue = geneValue;
            const scaled = Number(scaleStat(args));
            return Number.isFinite(scaled) ? Math.round(scaled) : null;
        } catch {
            return null;
        }
    }

    function resolveVillainAwakenForFloor(resolved, floor) {
        if (resolved?.awaken === true) return true;
        const f = Number(floor);
        return resolved?.villain === true && Number.isFinite(f) && f >= ASCENSION_AWAKEN_FLOOR;
    }

    function resolveCurrentRoomId() {
        const boardCtx = getBoardContext() || {};
        const playerCtx = globalThis.state?.player?.getSnapshot?.()?.context || {};
        return (boardCtx.selectedMap && boardCtx.selectedMap.selectedRoom && boardCtx.selectedMap.selectedRoom.id)
            || (boardCtx.selectedMap && boardCtx.selectedMap.id)
            || (boardCtx.area && boardCtx.area.id)
            || playerCtx.currentRoomId
            || null;
    }

    function getRoomDisplayName(roomId) {
        if (!roomId) return null;
        try {
            const ROOM_NAME = globalThis.state?.utils?.ROOM_NAME;
            if (ROOM_NAME && ROOM_NAME[roomId]) return ROOM_NAME[roomId];
        } catch { /* ignore */ }
        return String(roomId);
    }

    function getBoardConfigSignature(config) {
        if (!Array.isArray(config)) return '';
        return config.map((p) => {
            const tile = p?.tileIndex ?? p?.tile ?? '';
            const id = p?.databaseId ?? p?.monsterId ?? p?.gameId ?? '';
            return `${p?.type ?? ''}:${id}:${p?.villain === true}:${tile}:${p?.level ?? ''}:${p?.key ?? ''}`;
        }).join('|');
    }

    function getActiveWorld() {
        const ctx = getBoardContext();
        if (ctx?.gameStarted && ctx?.world) return ctx.world;
        return activeWorld;
    }

    function syncBoardTrackFromContext() {
        const ctx = getBoardContext();
        boardTrack.roomId = resolveCurrentRoomId();
        boardTrack.floor = resolveCurrentFloor();
        boardTrack.gameStarted = ctx?.gameStarted === true;
        boardTrack.mode = ctx?.mode ?? null;
        boardTrack.configSig = getBoardConfigSignature(ctx?.boardConfig);
    }

    function handleBoardContextChange() {
        const ctx = getBoardContext();
        if (!ctx) return false;

        let changed = false;
        const roomId = resolveCurrentRoomId();
        const floor = resolveCurrentFloor();
        const gameStarted = ctx.gameStarted === true;
        const mode = ctx.mode ?? null;
        const configSig = getBoardConfigSignature(ctx.boardConfig);

        if (floor !== boardTrack.floor) {
            boardTrack.floor = floor;
            cachedSpawnTileKeyLookup = null;
            lastUnitsRenderKey = '';
            changed = true;
        }

        if (roomId !== boardTrack.roomId) {
            boardTrack.roomId = roomId;
            teardownWorldSubscriptions();
            activeWorld = null;
            resetBattleLogState();
            cachedSpawnTileKeyLookup = null;
            lastUnitsRenderKey = '';
            changed = true;
        }

        if (gameStarted !== boardTrack.gameStarted) {
            boardTrack.gameStarted = gameStarted;
            changed = true;
            if (!gameStarted) {
                syncPanelFightTickFromSnapshot();
                if (!slowMotionEnabled) restoreTurboIfSuspended();
                if (ctx.world?.tickEngine?.setTickInterval) {
                    ctx.world.tickEngine.setTickInterval(getBaselineTickIntervalMs());
                }
                teardownWorldSubscriptions();
                activeWorld = null;
                clearFightActorCollapseRegistry();
            } else {
                resetPanelFightTickState();
                teardownPanelGameTimerSub();
                if (ctx.world) {
                    ensureFightTracking(ctx.world);
                    resetBattleLogState();
                }
            }
            syncPanelTickTracking();
        } else if (gameStarted && ctx.world && ctx.world !== activeWorld) {
            ensureFightTracking(ctx.world);
            changed = true;
        }

        if (mode !== boardTrack.mode) {
            boardTrack.mode = mode;
            changed = true;
            if (!isSandboxMode()) {
                if (!slowMotionEnabled) restoreTurboIfSuspended();
                if (ctx.world?.tickEngine?.setTickInterval) {
                    ctx.world.tickEngine.setTickInterval(getBaselineTickIntervalMs());
                }
            } else if (isFightActive()) {
                applyTickIntervalToCurrentGame();
            }
            if (gameStarted && ctx.world) ensureFightTracking(ctx.world);
        }

        if (configSig !== boardTrack.configSig) {
            boardTrack.configSig = configSig;
            lastUnitsRenderKey = '';
            changed = true;
        }

        if (changed) {
            lastUnitsRenderKey = '';
            pendingUnitsForceRefresh = true;
        }

        return changed;
    }

    function isFightActive() {
        const ctx = getBoardContext();
        if (ctx?.gameStarted !== true) return false;
        const world = getActiveWorld();
        return !!(world && Array.isArray(world.grid?.actors));
    }

    function syncTurboBlockFlag() {
        window.__betterAnalyticsTurboBlock = slowMotionEnabled === true;
        try { window.turboMode?.refreshButton?.(); } catch { /* ignore */ }
    }

    function getBaselineTickIntervalMs() {
        if (turboSuspendedForSlowMotion) return DEFAULT_TICK_INTERVAL_MS;
        try {
            if (window.__turboState?.active) {
                const factor = Math.max(Number(window.__turboState.speedupFactor) || 1, 1);
                if (factor > 1) {
                    return Math.max(DEFAULT_TICK_INTERVAL_MS / factor, MIN_TICK_INTERVAL_MS);
                }
            }
        } catch { /* ignore */ }
        return DEFAULT_TICK_INTERVAL_MS;
    }

    function suspendTurboForSlowMotion() {
        if (!slowMotionEnabled) return;
        try {
            if (!window.turboMode?.disable) return;
            if (window.__turboState?.active) {
                turboSuspendedForSlowMotion = true;
                window.turboMode.disable();
            }
        } catch { /* ignore */ }
    }

    function restoreTurboIfSuspended() {
        if (!turboSuspendedForSlowMotion) return;
        turboSuspendedForSlowMotion = false;
        try {
            window.turboMode?.enable?.();
        } catch { /* ignore */ }
    }

    function applySlowMotionTurboBlock() {
        syncTurboBlockFlag();
        if (slowMotionEnabled) suspendTurboForSlowMotion();
        else restoreTurboIfSuspended();
    }

    function setSlowMotionEnabled(enabled) {
        slowMotionEnabled = enabled === true;
        savePanelSettings({ slowMotionEnabled });
        applySlowMotionTurboBlock();
        updateSpeedSliderUi();
        if (isSandboxMode() && isFightActive()) applyTickIntervalToCurrentGame();
        else if (!slowMotionEnabled) {
            const world = getActiveWorld();
            if (world?.tickEngine?.setTickInterval) {
                world.tickEngine.setTickInterval(getBaselineTickIntervalMs());
            }
        }
        renderStatusBar();
    }

    function normalizeSpeedPercent(percent) {
        const n = Math.round(Number(percent) || SPEED_MAX_PERCENT);
        const stepped = Math.round(n / SPEED_STEP_PERCENT) * SPEED_STEP_PERCENT;
        return clamp(stepped, SPEED_MIN_PERCENT, SPEED_MAX_PERCENT);
    }

    function getSandboxSpeedFactor() {
        return gameSpeedPercent / 100;
    }

    function getTickIntervalMs() {
        const factor = getSandboxSpeedFactor();
        if (Math.abs(factor - 1) < 0.001) return getBaselineTickIntervalMs();
        return Math.max(DEFAULT_TICK_INTERVAL_MS / factor, MIN_TICK_INTERVAL_MS);
    }

    function getEffectiveSpeedFactor() {
        return DEFAULT_TICK_INTERVAL_MS / getTickIntervalMs();
    }

    function applyTickIntervalToWorld(world) {
        if (!world?.tickEngine?.setTickInterval) return;
        if (!slowMotionEnabled || !isSandboxMode()) {
            if (!slowMotionEnabled) restoreTurboIfSuspended();
            world.tickEngine.setTickInterval(getBaselineTickIntervalMs());
            return;
        }
        if (!isFightActive()) return;

        suspendTurboForSlowMotion();

        const factor = getSandboxSpeedFactor();
        if (Math.abs(factor - 1) < 0.001) {
            world.tickEngine.setTickInterval(DEFAULT_TICK_INTERVAL_MS);
            return;
        }
        world.tickEngine.setTickInterval(Math.max(DEFAULT_TICK_INTERVAL_MS / factor, MIN_TICK_INTERVAL_MS));
    }

    function applyTickIntervalToCurrentGame() {
        applyTickIntervalToWorld(getActiveWorld());
    }

    function teardownTickSpeedControl() {
        if (tickSpeedSubscription && typeof tickSpeedSubscription.unsubscribe === 'function') {
            try { tickSpeedSubscription.unsubscribe(); } catch { /* ignore */ }
        }
        tickSpeedSubscription = null;
    }

    function resetTickSpeedToDefault() {
        teardownTickSpeedControl();
        slowMotionEnabled = false;
        window.__betterAnalyticsTurboBlock = false;
        restoreTurboIfSuspended();
        try { window.turboMode?.refreshButton?.(); } catch { /* ignore */ }
        const world = getActiveWorld();
        if (world?.tickEngine?.setTickInterval) {
            world.tickEngine.setTickInterval(getBaselineTickIntervalMs());
        }
    }

    function setupTickSpeedControl() {
        teardownTickSpeedControl();
        const board = globalThis.state?.board;
        if (!board || typeof board.on !== 'function') return;

        tickSpeedSubscription = board.on('newGame', (event) => {
            if (!isSandboxMode() || !slowMotionEnabled) return;
            applyTickIntervalToWorld(event?.world);
        });

        if (isSandboxMode() && slowMotionEnabled && isFightActive()) applyTickIntervalToCurrentGame();
    }

    function updateSpeedSliderUi() {
        const slider = document.getElementById(SPEED_SLIDER_ID);
        const valueEl = document.getElementById(SPEED_VALUE_ID);
        const hintEl = document.getElementById('mod-better-sandbox-speed-hint');
        const toggle = document.getElementById(SLOW_MOTION_TOGGLE_ID);
        const sandbox = isSandboxMode();
        const sliderActive = slowMotionEnabled && sandbox;

        if (toggle) toggle.checked = slowMotionEnabled;
        if (slider) slider.value = String(gameSpeedPercent);
        const sliderWrap = document.getElementById('mod-better-sandbox-speed-slider-wrap');
        if (sliderWrap) sliderWrap.classList.toggle('disabled', !sliderActive);
        if (valueEl) {
            const factor = getSandboxSpeedFactor();
            valueEl.textContent = slowMotionEnabled
                ? `${gameSpeedPercent}% (${factor.toFixed(2)}×)`
                : 'Turbo Mode';
        }
        if (hintEl) {
            hintEl.textContent = slowMotionEnabled
                ? `Slow motion on — Turbo blocked. 100% = normal speed. Steps of ${SPEED_STEP_PERCENT}% (${SPEED_MIN_PERCENT}% = 0.05×). Sandbox fights only.`
                : 'Slow motion off — use Turbo Mode to speed up. Turn on Slow motion to slow sandbox fights (blocks Turbo).';
        }
    }

    function setGameSpeedPercent(percent) {
        if (!slowMotionEnabled) return;
        gameSpeedPercent = normalizeSpeedPercent(percent);
        savePanelSettings({ gameSpeedPercent });
        updateSpeedSliderUi();
        if (isSandboxMode() && isFightActive()) applyTickIntervalToCurrentGame();
        renderStatusBar();
    }

    function resetPanelFightTickState() {
        panelFightTick = null;
        panelFightTickFrozen = null;
        panelFightEndState = null;
    }

    function readTickFromEngine(world) {
        const w = world ?? getActiveWorld();
        if (!w?.tickEngine?.getCurrentTick) return null;
        try {
            const tick = w.tickEngine.getCurrentTick();
            return typeof tick === 'number' && Number.isFinite(tick) ? tick : null;
        } catch {
            return null;
        }
    }

    function syncPanelFightTickFromSnapshot() {
        try {
            const ctx = globalThis.state?.gameTimer?.getSnapshot?.()?.context;
            if (!ctx) return;
            const engineTick = readTickFromEngine();
            if (ctx.state === 'victory' || ctx.state === 'defeat') {
                const timerTick = typeof ctx.currentTick === 'number' ? ctx.currentTick : null;
                const finalTick = timerTick != null && engineTick != null
                    ? Math.max(timerTick, engineTick)
                    : (timerTick ?? engineTick ?? panelFightTick);
                if (finalTick != null) {
                    panelFightTick = finalTick;
                    panelFightTickFrozen = finalTick;
                }
                panelFightEndState = ctx.state;
            } else if (typeof ctx.currentTick === 'number' && ctx.currentTick > 0 && !isFightActive()) {
                panelFightTick = ctx.currentTick;
            }
        } catch { /* ignore */ }
    }

    function freezePanelFightTickFromEngine(world) {
        const engineTick = readTickFromEngine(world);
        if (engineTick != null) {
            panelFightTick = engineTick;
            panelFightTickFrozen = engineTick;
        }
        syncPanelFightTickFromSnapshot();
        stopPanelTickPoll();
    }

    function teardownPanelGameTimerSub() {
        if (panelGameTimerSub) {
            try { panelGameTimerSub.unsubscribe(); } catch { /* ignore */ }
            panelGameTimerSub = null;
        }
    }

    function stopPanelTickPoll() {
        if (panelTickPollTimer) {
            clearInterval(panelTickPollTimer);
            panelTickPollTimer = null;
        }
    }

    function pollPanelFightTick() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') {
            stopPanelTickPoll();
            return;
        }
        if (panelFightTickFrozen != null) {
            renderStatusBar();
            return;
        }
        if (!isFightActive()) {
            stopPanelTickPoll();
            return;
        }

        const engineTick = readTickFromEngine();
        if (engineTick != null && engineTick !== panelFightTick) {
            panelFightTick = engineTick;
            renderStatusBar();
            renderLiveFight();
        }
    }

    function startPanelTickPoll() {
        stopPanelTickPoll();
        pollPanelFightTick();
        panelTickPollTimer = setInterval(pollPanelFightTick, PANEL_TICK_POLL_MS);
    }

    function onPanelGameTimerUpdate({ context }) {
        if (!context) return;

        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;

        const gameState = context.state;

        if (panelFightTickFrozen == null) {
            if (gameState === 'victory' || gameState === 'defeat') {
                freezePanelFightTickFromEngine();
            } else if (typeof context.currentTick === 'number' && context.currentTick > 0 && !isFightActive()) {
                panelFightTick = context.currentTick;
            }
        }

        renderStatusBar();
        if (isFightActive()) {
            renderLiveFight();
        }
    }

    function setupPanelGameTimerSub() {
        const gameTimer = globalThis.state?.gameTimer;
        if (!gameTimer || typeof gameTimer.subscribe !== 'function') return;
        if (panelGameTimerSub) return;

        syncPanelFightTickFromSnapshot();
        panelGameTimerSub = gameTimer.subscribe(onPanelGameTimerUpdate);
    }

    function getCurrentTick() {
        if (panelFightTickFrozen != null) return panelFightTickFrozen;
        try {
            if (isFightActive()) {
                const engineTick = readTickFromEngine();
                if (engineTick != null) return engineTick;
            }
            const ctx = globalThis.state?.gameTimer?.getSnapshot?.()?.context;
            if (ctx) {
                if (ctx.state === 'victory' || ctx.state === 'defeat') {
                    const timerTick = typeof ctx.currentTick === 'number' ? ctx.currentTick : null;
                    const engineTick = readTickFromEngine();
                    if (timerTick != null && engineTick != null) return Math.max(timerTick, engineTick);
                    return timerTick ?? engineTick ?? panelFightTick;
                }
                if (typeof ctx.currentTick === 'number' && ctx.currentTick > 0) {
                    return ctx.currentTick;
                }
            }
            if (panelFightTick != null) return panelFightTick;
            const engineTick = readTickFromEngine();
            if (engineTick != null) return engineTick;
        } catch { /* ignore */ }
        return null;
    }

    function entityToActor(entity) {
        if (!entity) return null;
        try {
            if (typeof entity.maybeActor === 'function') {
                const actor = entity.maybeActor();
                if (actor) return actor;
            }
        } catch { /* ignore */ }
        if (entity.name && entity.hp) return entity;
        return null;
    }

    function actorLabel(actor, fallback = 'Unknown') {
        if (!actor) return fallback;
        return actor.name || actor.nickname || (actor.id != null ? `#${actor.id}` : fallback);
    }

    function teamClass(villain) {
        return villain === true ? 'enemy' : 'ally';
    }

    function clearFightActorCollapseRegistry() {
        clearUnitsStatDebugLog();
        cachedSpawnTileKeyLookup = null;
        fightActorInstanceSeq = 0;
    }

    function buildSpawnTileKeyLookup() {
        if (cachedSpawnTileKeyLookup) return cachedSpawnTileKeyLookup;
        const byTileGame = new Map();
        const addPiece = (piece) => {
            const resolved = resolveBoardPiece(piece);
            if (!resolved) return;
            const collapseKey = buildStablePreviewKey(resolved, resolveCurrentRoomId());
            const tile = resolved.tileIndex;
            const gameId = resolved.gameId;
            if (!collapseKey || gameId == null || tile == null) return;
            const tileKey = `${gameId}:${tile}`;
            if (!byTileGame.has(tileKey)) byTileGame.set(tileKey, collapseKey);
        };

        const config = getBoardContext()?.boardConfig;
        if (Array.isArray(config)) {
            for (const piece of config) addPiece(piece);
        }

        const roomId = resolveCurrentRoomId();
        const getBoardMonsters = globalThis.state?.utils?.getBoardMonstersFromRoomId;
        if (roomId && typeof getBoardMonsters === 'function') {
            try {
                for (const piece of getBoardMonsters(roomId) || []) addPiece(piece);
            } catch { /* ignore */ }
        }

        cachedSpawnTileKeyLookup = byTileGame;
        return byTileGame;
    }

    function registerFightActorCollapseKeys(world) {
        clearFightActorCollapseRegistry();
        const actors = world?.grid?.actors;
        if (!Array.isArray(actors)) return;

        const byTileGame = buildSpawnTileKeyLookup();
        const usedKeys = new Set();

        for (const actor of actors) {
            const gameId = resolveGameId(actor);
            const tile = actor.position?.tile?.index ?? actor.position?.tileIndex ?? null;
            const databaseId = actor.databaseId ?? actor.monsterDatabaseId ?? actor.monsterId ?? null;
            let key = null;

            if (actor.villain !== true && gameId != null && tile != null) {
                key = `preview:ally:${gameId}:${tile}`;
            } else if (actor.villain !== true && databaseId != null) {
                key = actor.key ?? `player:${databaseId}`;
            } else if (actor.villain === true && gameId != null && tile != null) {
                const roomId = resolveCurrentRoomId() ?? 'x';
                key = `fight:enemy:${roomId}:${gameId}:${tile}:${actor.key ?? 'spawn'}`;
            } else if (actor.key) {
                key = actor.key;
            } else if (gameId != null && tile != null) {
                key = byTileGame.get(`${gameId}:${tile}`) ?? null;
            }

            if (!key) {
                key = `fight:inst:${actor.villain === true ? 'v' : 'a'}:${gameId ?? 'x'}:${++fightActorInstanceSeq}`;
            }

            let finalKey = key;
            let suffix = 0;
            while (usedKeys.has(finalKey)) {
                finalKey = `${key}#${++suffix}`;
            }
            usedKeys.add(finalKey);
            fightActorCollapseKeys.set(actor, finalKey);
        }
    }

    function resolveFightCollapseKey(actor) {
        if (!actor) return 'fight:unknown';
        if (fightActorCollapseKeys.has(actor)) {
            return fightActorCollapseKeys.get(actor);
        }

        const gameId = resolveGameId(actor);
        const tile = actor.position?.tile?.index ?? actor.position?.tileIndex ?? null;
        const databaseId = actor.databaseId ?? actor.monsterDatabaseId ?? actor.monsterId ?? null;
        const byTileGame = buildSpawnTileKeyLookup();
        let key = null;

        if (actor.villain !== true && gameId != null && tile != null) {
            key = `preview:ally:${gameId}:${tile}`;
        } else if (actor.villain !== true && databaseId != null) {
            key = actor.key ?? `player:${databaseId}`;
        } else if (actor.villain === true && gameId != null && tile != null) {
            const roomId = resolveCurrentRoomId() ?? 'x';
            key = `fight:enemy:${roomId}:${gameId}:${tile}:${actor.key ?? 'spawn'}`;
        } else if (actor.key) {
            key = actor.key;
        } else if (gameId != null && tile != null) {
            key = byTileGame.get(`${gameId}:${tile}`) ?? null;
        }
        if (!key) {
            key = `fight:inst:${actor.villain === true ? 'v' : 'a'}:${gameId ?? 'x'}:${++fightActorInstanceSeq}`;
        }

        fightActorCollapseKeys.set(actor, key);
        return key;
    }

    function resetBattleLogState() {
        battleLog = [];
        battleLogRevision = 0;
        lastRenderedBattleLogRevision = 0;
        lastScrolledBattleLogRevision = 0;
        lastRenderedLogSignature = '';
    }

    function pickLogString(...values) {
        for (const value of values) {
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
        return null;
    }

    function normalizeActionSourceLabel(value) {
        const v = String(value).toLowerCase();
        if (/ability|skill|spell|ultimate|special/.test(v)) return 'ability';
        if (/auto|basic|melee|weapon|attack|hit/.test(v)) return 'auto attack';
        if (/heal|regen/.test(v)) return 'heal';
        if (/poison|burn|bleed|dot|thorn|reflect|environment|effect/.test(v)) return 'effect';
        return null;
    }

    function resolveActionSource(opts = {}, result = null, fromActor = null, isHeal = false) {
        const direct = pickLogString(
            opts.source,
            opts.sourceType,
            opts.attackType,
            opts.damageSource,
            opts.kind,
            opts.hitType,
            opts.actionType,
            opts.healSource,
            result?.source,
            result?.sourceType,
            result?.attackType,
            result?.damageSource
        );
        if (direct) {
            const normalized = normalizeActionSourceLabel(direct);
            if (normalized) return normalized;
        }

        if (opts.ability || opts.skill || opts.fromAbility === true || opts.isAbility === true ||
            opts.isSkill === true || opts.spell === true) {
            return 'ability';
        }
        if (opts.autoAttack === true || opts.isAutoAttack === true || opts.basicAttack === true ||
            opts.isBasicAttack === true) {
            return 'auto attack';
        }

        if (isHeal) return 'heal';

        const damageType = String(opts.damageType || result?.damageType || '').toLowerCase();
        if (/ability|skill|spell|ultimate|special/.test(damageType)) return 'ability';
        if (/poison|burn|bleed|dot|thorn|reflect|environment/.test(damageType)) return 'effect';
        if (damageType === 'physical' || damageType === 'magic' || damageType === 'true') {
            return 'auto attack';
        }

        if (fromActor?.abilityCooldown?.isOnCooldown === true) return 'ability';

        return 'unknown';
    }

    function getLogEntryFilter(entry) {
        if (entry.kind === 'heal') {
            return entry.fromVillain === true ? 'villainHeal' : 'allyHeal';
        }
        if (entry.fromVillain === true) return 'villainDmg';
        if (entry.from === 'Environment' || entry.from === '—') {
            return entry.toVillain ? 'villainDmg' : 'allyDmg';
        }
        return 'allyDmg';
    }

    function isLogFilterShowAll() {
        return Object.keys(LOG_FILTER_DEFAULTS).every((k) => logFilters[k] !== false);
    }

    function isLogEntryVisible(entry) {
        const key = getLogEntryFilter(entry);
        if (isLogFilterShowAll()) return true;
        return logFilters[key] === true;
    }

    function getLogFiltersSignature() {
        return Object.keys(LOG_FILTER_DEFAULTS).map((k) => (logFilters[k] ? '1' : '0')).join('');
    }

    function toggleLogFilter(filterKey) {
        if (!(filterKey in LOG_FILTER_DEFAULTS)) return;

        const onlyThisFilter = Object.keys(LOG_FILTER_DEFAULTS).every(
            (k) => logFilters[k] === (k === filterKey)
        );

        if (onlyThisFilter) {
            Object.assign(logFilters, LOG_FILTER_DEFAULTS);
        } else {
            for (const k of Object.keys(LOG_FILTER_DEFAULTS)) {
                logFilters[k] = k === filterKey;
            }
        }

        saveLogFilters();
        lastRenderedLogSignature = '';
        updateLogFilterUi();
        renderBattleLog(true);
    }

    function updateLogFilterUi() {
        const showAll = isLogFilterShowAll();
        for (const key of Object.keys(LOG_FILTER_DEFAULTS)) {
            const btn = document.getElementById(`mod-better-sandbox-log-filter-${key}`);
            if (btn) btn.classList.toggle('active', showAll || logFilters[key] === true);
        }
    }

    function clearBattleLog() {
        resetBattleLogState();
        renderBattleLog();
    }

    function recordBattleLogEntry(event) {
        if (!event || !isFightActive()) return;
        const points = Number(event.points);
        if (!Number.isFinite(points) || points === 0) return;

        const fromActor = entityToActor(event.from);
        const toActor = entityToActor(event.to)
            || entityToActor(event.entity)
            || entityToActor(event.actor)
            || entityToActor(event.target)
            || entityToActor(event.owner);

        const isHeal = points > 0;
        const tick = getCurrentTick();

        battleLog.push({
            tick: tick != null ? tick : '?',
            kind: isHeal ? 'heal' : 'damage',
            from: actorLabel(fromActor, isHeal ? '—' : 'Environment'),
            to: actorLabel(toActor, '—'),
            fromVillain: fromActor?.villain === true,
            toVillain: toActor?.villain === true,
            amount: Math.abs(Math.round(points)),
            damageType: event.damageType || (isHeal ? 'heal' : 'physical'),
            actionSource: event.actionSource || (isHeal ? 'heal' : 'unknown'),
            crit: event.crit === true
        });

        if (battleLog.length > BATTLE_LOG_MAX) {
            battleLog = battleLog.slice(-BATTLE_LOG_MAX);
        }

        battleLogRevision++;
        if (activeTab === 'log') renderBattleLog();
    }

    function unpatchActorBattleLog(actor) {
        if (!actor?.hp || !actor.__bsLogPatched) return;
        if (actor.__bsOrigApplyDamage) actor.hp.applyDamage = actor.__bsOrigApplyDamage;
        if (actor.__bsOrigHealHp) actor.hp.healHp = actor.__bsOrigHealHp;
        delete actor.__bsLogPatched;
        delete actor.__bsOrigApplyDamage;
        delete actor.__bsOrigHealHp;
    }

    function patchActorBattleLog(actor) {
        if (!actor?.hp || actor.__bsLogPatched) return;

        const hp = actor.hp;
        if (typeof hp.applyDamage === 'function') {
            actor.__bsOrigApplyDamage = hp.applyDamage.bind(hp);
            hp.applyDamage = (opts = {}) => {
                const result = actor.__bsOrigApplyDamage(opts);
                const raw = opts.points ?? result?.damageToApply ?? result?.calculatedDamage;
                const amount = Number(raw);
                if (Number.isFinite(amount) && amount > 0) {
                    const fromActor = entityToActor(opts.from);
                    recordBattleLogEntry({
                        from: opts.from,
                        to: actor,
                        points: -amount,
                        damageType: opts.damageType || result?.damageType || 'physical',
                        crit: opts.crit === true || result?.crit === true,
                        actionSource: resolveActionSource(opts, result, fromActor, false)
                    });
                }
                return result;
            };
        }

        if (typeof hp.healHp === 'function') {
            actor.__bsOrigHealHp = hp.healHp.bind(hp);
            hp.healHp = (opts = {}) => {
                const result = actor.__bsOrigHealHp(opts);
                const amount = Number(opts.points);
                if (Number.isFinite(amount) && amount > 0) {
                    const fromActor = entityToActor(opts.from);
                    recordBattleLogEntry({
                        from: opts.from,
                        to: actor,
                        points: amount,
                        damageType: opts.damageType || 'heal',
                        crit: opts.crit === true || result?.crit === true,
                        actionSource: resolveActionSource(opts, result, fromActor, true)
                    });
                }
                return result;
            };
        }

        actor.__bsLogPatched = true;
    }

    function unpatchAllActors(world) {
        const actors = world?.grid?.actors;
        if (!Array.isArray(actors)) return;
        for (const actor of actors) unpatchActorBattleLog(actor);
    }

    function patchAllActors(world) {
        const actors = world?.grid?.actors;
        if (!Array.isArray(actors)) return;
        for (const actor of actors) patchActorBattleLog(actor);
    }

    function teardownWorldSubscriptions() {
        for (const sub of worldEventSubs) {
            try {
                if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
            } catch { /* ignore */ }
        }
        worldEventSubs = [];
        const world = getActiveWorld();
        if (world) unpatchAllActors(world);
    }

    function setupWorldSubscriptions(world) {
        if (!world?.grid) return;

        patchAllActors(world);

        const repatch = () => patchAllActors(world);
        if (typeof world.grid.onActorEnter?.subscribe === 'function') {
            worldEventSubs.push(world.grid.onActorEnter.subscribe(repatch));
        }
        if (typeof world.grid.onActorSummon?.subscribe === 'function') {
            worldEventSubs.push(world.grid.onActorSummon.subscribe(repatch));
        }
        if (typeof world.onGameEnd?.subscribe === 'function') {
            worldEventSubs.push(world.onGameEnd.subscribe(() => {
                freezePanelFightTickFromEngine(world);
                renderStatusBar();
                render();
            }));
        }
    }

    function getSeed() {
        try {
            return getActiveWorld()?.RNG?.seed ?? null;
        } catch {
            return null;
        }
    }

    function buildGameIdByNameMap() {
        if (gameIdByNameCache) return gameIdByNameCache;
        const map = new Map();
        const getMonster = globalThis.state?.utils?.getMonster;
        if (typeof getMonster !== 'function') {
            gameIdByNameCache = map;
            return map;
        }
        for (let i = 1; i < 600; i++) {
            try {
                const m = getMonster(i);
                if (!m?.metadata?.name) break;
                map.set(m.metadata.name.toLowerCase(), i);
            } catch {
                break;
            }
        }
        gameIdByNameCache = map;
        return map;
    }

    function resolveGameId(actor) {
        if (!actor) return null;
        const direct = actor.gameId ?? actor.monsterId ?? actor.metadata?.id;
        if (direct != null && Number.isFinite(Number(direct))) return Number(direct);
        const name = actor.name || actor.metadata?.name;
        if (!name) return null;
        return buildGameIdByNameMap().get(String(name).toLowerCase()) ?? null;
    }

    function getMonsterMetadata(gameId) {
        if (gameId == null) return null;
        try {
            return globalThis.state?.utils?.getMonster?.(gameId)?.metadata ?? null;
        } catch {
            return null;
        }
    }

    function formatPct(ratio) {
        if (ratio == null || !Number.isFinite(ratio)) return '—';
        return `${Math.round(ratio * 100)}%`;
    }

    function formatTicks(ticks) {
        if (ticks == null || !Number.isFinite(ticks)) return '—';
        const rounded = Math.round(ticks * 10) / 10;
        const label = Math.abs(rounded) === 1 ? 'tick' : 'ticks';
        return `${rounded} ${label}`;
    }

    function msToTicks(ms) {
        if (ms == null || !Number.isFinite(ms)) return null;
        return ms / DEFAULT_TICK_INTERVAL_MS;
    }

    function resolveUnitAttackDelayTicks(unit) {
        if (unit?.attackDelayTicks != null && Number.isFinite(unit.attackDelayTicks)) {
            return unit.attackDelayTicks;
        }
        if (unit?.attackSpeed != null && unit.attackSpeed > 0) {
            return TICKS_PER_SECOND / unit.attackSpeed;
        }
        return null;
    }

    function resolveUnitCooldownTicks(unit) {
        if (unit?.cooldownTicks != null && Number.isFinite(unit.cooldownTicks)) {
            return unit.cooldownTicks;
        }
        return msToTicks(unit?.cooldownMs);
    }

    function resolveUnitCooldownRemainingTicks(unit) {
        if (unit?.cooldownRemainingTicks != null && Number.isFinite(unit.cooldownRemainingTicks)) {
            return unit.cooldownRemainingTicks;
        }
        return msToTicks(unit?.cooldownRemainingMs);
    }

    let unitsStatDebugLogged = new Set();
    let unitsStatResolveLogged = new Set();

    function clearUnitsStatDebugLog() {
        unitsStatDebugLogged.clear();
        unitsStatResolveLogged.clear();
    }

    const LIVE_STAT_ALIASES = {
        ad: ['ad', 'attackDamage', 'attack'],
        ap: ['ap', 'abilityPower', 'spellPower'],
        armor: [
            'armor', 'armour', 'arm', 'def', 'defense', 'defence',
            'physicalDefense', 'physicalDefence', 'physicalArmor', 'physicalMitigation'
        ],
        magicResist: [
            'magicResist', 'magicResistance', 'magicRes', 'mr',
            'magicDefense', 'magicDefence', 'magicMitigation', 'magicArmor', 'resist'
        ],
        speed: ['speed', 'movementSpeed', 'moveSpeed', 'spd', 'ms', 'movement'],
        level: ['level', 'lvl']
    };

    const STAT_BAG_PATH_PATTERNS = {
        ad: /\b(ad|attackdamage|attack)\b/i,
        ap: /\b(ap|abilitypower|spellpower)\b/i,
        armor: /\b(armor|armour|arm|physicaldef(?:en[cs]e)?|physicalarmor|physicalmitigation)\b/i,
        magicResist: /\b(magicresist(?:ance)?|magicdef(?:en[cs]e)?|magicmitigation|magicarmor|^mr$)\b/i,
        speed: /\b(speed|movementspeed|movespeed|spd|ms|movement)\b/i,
        attackSpeed: /\b(attackspeed|attackinterval|autospeed|atkspd|basicattackspeed)\b/i
    };

    function pickFirstNumber(obj, keys) {
        if (!obj) return null;
        for (const key of keys) {
            if (key in obj) {
                const v = Number(obj[key]);
                if (Number.isFinite(v)) return v;
            }
        }
        return null;
    }

    function readStatBagNumber(bag) {
        if (bag == null) return null;
        if (typeof bag === 'number' && Number.isFinite(bag)) return bag;
        if (typeof bag !== 'object') return null;

        for (const key of [
            'currentValue', 'value', 'current', 'amount', 'total',
            'modifiedValue', 'effectiveValue', 'finalValue', 'result', 'computedValue'
        ]) {
            if (key in bag) {
                const v = Number(bag[key]);
                if (Number.isFinite(v)) return v;
            }
        }

        for (const key of ['currentValue', 'value', 'modifiedValue']) {
            try {
                let proto = bag;
                while (proto) {
                    const desc = Object.getOwnPropertyDescriptor(proto, key);
                    if (desc?.get) {
                        const v = Number(desc.get.call(bag));
                        if (Number.isFinite(v)) return v;
                    }
                    proto = Object.getPrototypeOf(proto);
                }
            } catch { /* ignore */ }
        }

        for (const fn of [
            'getValue', 'getCurrentValue', 'getCurrent', 'get',
            'getModifiedValue', 'getEffectiveValue', 'getTotalValue', 'getResult', 'valueOf'
        ]) {
            if (typeof bag[fn] === 'function') {
                try {
                    const v = Number(bag[fn]());
                    if (Number.isFinite(v)) return v;
                } catch { /* ignore */ }
            }
        }

        return null;
    }

    function readStatBagBonus(bag) {
        if (!bag || typeof bag !== 'object') return null;
        for (const key of ['bonus', 'modifier', 'additiveBonus', 'extra', 'delta', 'bonusValue']) {
            if (key in bag) {
                const v = Number(bag[key]);
                if (Number.isFinite(v)) return v;
            }
        }
        for (const fn of ['getBonus', 'getModifier', 'getAdditiveBonus', 'getExtra', 'getDelta', 'getBonusValue']) {
            if (typeof bag[fn] === 'function') {
                try {
                    const v = Number(bag[fn]());
                    if (Number.isFinite(v)) return v;
                } catch { /* ignore */ }
            }
        }
        return null;
    }

    function readStatBagLive(bag) {
        if (bag == null) return null;
        const direct = readStatBagNumber(bag);
        if (direct != null) return direct;

        const base = readStatBagBase(bag);
        if (base == null) return null;

        const bonus = readStatBagBonus(bag);
        if (bonus != null) return base + bonus;

        // Fight actors often expose armor/mr/speed bags with base only (no separate currentValue).
        if (typeof bag.getBaseValue === 'function' || 'baseValue' in bag || 'base' in bag) {
            return base;
        }
        return null;
    }

    function readStatBagBase(bag) {
        if (!bag || typeof bag !== 'object') return null;
        for (const key of ['baseValue', 'base', 'originalValue', 'defaultValue']) {
            if (key in bag) {
                const v = Number(bag[key]);
                if (Number.isFinite(v)) return v;
            }
        }
        if (typeof bag.getBaseValue === 'function') {
            try {
                const v = Number(bag.getBaseValue());
                if (Number.isFinite(v)) return v;
            } catch { /* ignore */ }
        }
        return null;
    }

    function summarizeBagShape(bag) {
        if (!bag || typeof bag !== 'object') return null;
        const keys = Object.keys(bag).slice(0, 20);
        const fns = Object.keys(bag).filter((k) => typeof bag[k] === 'function').slice(0, 16);
        return { keys, fns };
    }

    const ACTOR_CONTAINER_LABELS = [
        ['actor', (a) => a],
        ['actor.scaledBaseStats', (a) => a?.scaledBaseStats],
        ['actor.baseStats', (a) => a?.baseStats],
        ['actor.movement', (a) => a?.movement],
        ['actor.stats', (a) => a?.stats],
        ['actor.attributes', (a) => a?.attributes],
        ['actor.combatStats', (a) => a?.combatStats],
        ['actor.combat', (a) => a?.combat],
        ['actor.modifiers', (a) => a?.modifiers],
        ['actor.buffs', (a) => a?.buffs],
        ['actor.defenses', (a) => a?.defenses],
        ['actor.resistances', (a) => a?.resistances],
        ['actor.genes', (a) => a?.genes],
        ['actor.monster', (a) => a?.monster]
    ];

    function isHpSubtreePath(path) {
        return path === 'hp' || path.startsWith('hp.');
    }

    function isHpBagContainer(actor, container) {
        const hpBag = actor?.hp;
        return !!(hpBag && container === hpBag);
    }

    function labelActorContainer(actor, container) {
        if (!container) return 'unknown';
        for (const [label, getter] of ACTOR_CONTAINER_LABELS) {
            if (getter(actor) === container) return label;
        }
        for (const [label, getter] of ACTOR_CONTAINER_LABELS) {
            const root = getter(actor);
            if (!root || typeof root !== 'object') continue;
            for (const key of Object.keys(root)) {
                if (root[key] === container) return `${label}.${key}`;
            }
        }
        return 'nested-object';
    }

    function collectActorStatContainers(actor) {
        const hpBag = actor?.hp;
        const roots = ACTOR_CONTAINER_LABELS
            .map(([, getter]) => getter(actor))
            .filter((v) => v && typeof v === 'object');

        const containers = [...roots];
        for (const root of roots) {
            for (const key of Object.keys(root)) {
                if (root === actor && key === 'hp') continue;
                const val = root[key];
                if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
                if (hpBag && val === hpBag) continue;
                containers.push(val);
            }
        }
        return containers;
    }

    function readActorPlainStat(actor, statKey) {
        const keys = LIVE_STAT_ALIASES[statKey] || [statKey];
        const plainContainers = [
            ['actor.scaledBaseStats', actor?.scaledBaseStats],
            ['actor.baseStats', actor?.baseStats]
        ];
        for (const [label, container] of plainContainers) {
            if (!container || typeof container !== 'object') continue;
            for (const key of keys) {
                const v = Number(container[key]);
                if (Number.isFinite(v)) return { value: v, source: `${label}.${key}` };
            }
        }
        return null;
    }

    function finishStatBagResolution(detail, containerLabel, key, bagInfo) {
        if (bagInfo.readLive == null) return false;
        detail.value = bagInfo.readLive;
        detail.source = `${containerLabel}.${key}`;
        if (bagInfo.readNumber != null) {
            detail.source += ' (currentValue/getValue)';
        } else if (bagInfo.readBase != null && bagInfo.readBonus != null) {
            detail.source += ' (base+bonus)';
        } else if (bagInfo.readBase != null) {
            detail.source += ' (base-only-bag)';
        }
        return true;
    }

    function describeStatBag(bag) {
        if (bag == null) return { bagType: 'missing' };
        if (typeof bag === 'number') return { bagType: 'number', value: bag };
        if (typeof bag !== 'object') return { bagType: typeof bag };
        return {
            bagType: 'object',
            shape: summarizeBagShape(bag),
            readNumber: readStatBagNumber(bag),
            readBase: readStatBagBase(bag),
            readBonus: readStatBagBonus(bag),
            readLive: readStatBagLive(bag)
        };
    }

    function discoverActorStatLikeBags(root, maxDepth = 4) {
        const found = [];
        const seen = new Set();
        const walk = (obj, path, depth) => {
            if (!obj || typeof obj !== 'object' || depth > maxDepth) return;
            if (seen.has(obj)) return;
            seen.add(obj);
            const keys = [...Object.keys(obj)];
            try {
                for (const sym of Object.getOwnPropertySymbols(obj)) keys.push(sym);
            } catch { /* ignore */ }
            for (const key of keys) {
                let val;
                try { val = obj[key]; } catch { continue; }
                const keyLabel = typeof key === 'symbol' ? key.toString() : String(key);
                const childPath = path ? `${path}.${keyLabel}` : keyLabel;
                if (!val || typeof val !== 'object' || Array.isArray(val)) continue;
                const live = readStatBagLive(val);
                const base = readStatBagBase(val);
                const isHpLike = typeof val.getPercent === 'function' || typeof val.getMaxValue === 'function';
                if (live != null || base != null || isHpLike) {
                    found.push({ path: childPath, live, base, shape: summarizeBagShape(val) });
                } else if (depth < maxDepth) {
                    walk(val, childPath, depth + 1);
                }
            }
        };
        walk(root, '', 0);
        return found;
    }

    function getActorPathValue(actor, path) {
        let node = actor;
        for (const part of path.split('.')) {
            node = node?.[part];
        }
        return node;
    }

    function readActorStatByDiscovery(actor, statKey) {
        const pattern = STAT_BAG_PATH_PATTERNS[statKey];
        if (!pattern) return null;
        for (const entry of discoverActorStatLikeBags(actor)) {
            if (statKey !== 'hp' && isHpSubtreePath(entry.path)) continue;
            const leaf = entry.path.split('.').pop() || entry.path;
            if (!pattern.test(leaf) && !pattern.test(entry.path)) continue;
            if (entry.live != null) return entry.live;
            const bag = getActorPathValue(actor, entry.path);
            const v = readStatBagLive(bag);
            if (v != null) return v;
        }
        return null;
    }

    function readActorGeneStat(actor, statKey) {
        if (!actor) return null;
        const keys = LIVE_STAT_ALIASES[statKey] || [statKey];
        const containers = [
            actor,
            actor.genes,
            actor.stats,
            actor.attributes,
            actor.monster,
            actor.scaledBaseStats,
            actor.baseStats
        ];
        for (const container of containers) {
            if (!container || typeof container !== 'object') continue;
            for (const key of keys) {
                const v = Number(container[key]);
                if (Number.isFinite(v)) return v;
            }
        }
        return null;
    }

    function readPreviewGeneValue(actor, statKey) {
        const genes = actor.genes;
        if (genes && typeof genes === 'object' && genes[statKey] != null) {
            const n = Number(genes[statKey]);
            if (Number.isFinite(n)) return n;
        }
        return readActorGeneStat(actor, statKey);
    }

    function scaleActorCatalogStatDetailed(actor, metadata, statKey) {
        const detail = {
            catalogBase: metadata?.baseStats?.[statKey] ?? null,
            level: actor.level ?? readActorGeneStat(actor, 'level'),
            geneValue: readPreviewGeneValue(actor, statKey),
            awaken: actor.awaken === true,
            attempts: [],
            value: null,
            source: null
        };
        const base = detail.catalogBase;
        if (base == null || !Number.isFinite(Number(base))) {
            detail.source = 'catalog-missing';
            return detail;
        }

        const scaleStat = globalThis.state?.utils?.scaleStat;
        if (typeof scaleStat !== 'function' || detail.level == null) {
            detail.value = Number(base);
            detail.source = 'catalog-unscaled-no-level-or-scaleStat';
            detail.attempts.push({ note: 'scaleStat unavailable or level missing', level: detail.level });
            return detail;
        }

        const argSets = [];
        if (detail.geneValue != null) {
            argSets.push({ stat: base, level: detail.level, geneValue: detail.geneValue, awaken: detail.awaken });
        }
        argSets.push(
            { stat: base, level: detail.level, awaken: detail.awaken },
            { stat: base, level: detail.level, geneValue: 0, awaken: detail.awaken },
            { stat: base, level: detail.level }
        );
        for (const args of argSets) {
            const callArgs = { ...args };
            if (callArgs.geneValue == null) delete callArgs.geneValue;
            try {
                const scaled = Number(scaleStat(callArgs));
                const attempt = { args: callArgs, scaled, ok: Number.isFinite(scaled) };
                detail.attempts.push(attempt);
                if (attempt.ok) {
                    detail.value = scaled;
                    detail.source = `scaleStat(${JSON.stringify(callArgs)})`;
                    return detail;
                }
            } catch (error) {
                detail.attempts.push({ args: callArgs, error: String(error) });
            }
        }

        detail.value = Number(base);
        detail.source = 'catalog-unscaled-fallback';
        return detail;
    }

    function scaleActorCatalogStat(actor, metadata, statKey) {
        return scaleActorCatalogStatDetailed(actor, metadata, statKey).value;
    }

    function resolveActorLiveStatDetailed(actor, metadata, statKey) {
        const detail = {
            statKey,
            value: null,
            source: 'unresolved',
            attempts: [],
            discoveryMatches: [],
            scale: null,
            fuzzyMatches: []
        };
        if (!actor) return detail;

        const keys = LIVE_STAT_ALIASES[statKey] || [statKey];

        for (const key of keys) {
            const bag = actor[key];
            const bagInfo = describeStatBag(bag);
            const attempt = { phase: 'actor-direct', key, ...bagInfo };
            detail.attempts.push(attempt);
            if (finishStatBagResolution(detail, 'actor', key, bagInfo)) {
                return detail;
            }
        }

        const plainStat = readActorPlainStat(actor, statKey);
        detail.attempts.push({ phase: 'plain-stats', ...plainStat });
        if (plainStat?.value != null) {
            detail.value = plainStat.value;
            detail.source = plainStat.source;
            return detail;
        }

        for (const container of collectActorStatContainers(actor)) {
            if (statKey !== 'hp' && isHpBagContainer(actor, container)) continue;
            const containerLabel = labelActorContainer(actor, container);
            for (const key of keys) {
                const bag = container[key];
                const bagInfo = describeStatBag(bag);
                const attempt = {
                    phase: 'container-key',
                    container: containerLabel,
                    key,
                    ...bagInfo
                };
                detail.attempts.push(attempt);
                if (finishStatBagResolution(detail, containerLabel, key, bagInfo)) {
                    return detail;
                }
            }
        }

        for (const prop of Object.keys(actor)) {
            if (prop === 'hp') continue;
            const lower = prop.toLowerCase();
            if (!keys.some((k) => lower.includes(String(k).toLowerCase()))) continue;
            const bag = actor[prop];
            const bagInfo = describeStatBag(bag);
            const attempt = {
                phase: 'actor-fuzzy-key',
                key: prop,
                ...bagInfo
            };
            detail.fuzzyMatches.push(attempt);
            detail.attempts.push(attempt);
            if (bagInfo.readLive != null) {
                detail.value = bagInfo.readLive;
                detail.source = `actor.${prop} (fuzzy)`;
                return detail;
            }
        }

        const pattern = STAT_BAG_PATH_PATTERNS[statKey];
        if (pattern) {
            for (const entry of discoverActorStatLikeBags(actor)) {
                if (statKey !== 'hp' && isHpSubtreePath(entry.path)) continue;
                const leaf = entry.path.split('.').pop() || entry.path;
                if (!pattern.test(leaf) && !pattern.test(entry.path)) continue;
                detail.discoveryMatches.push(entry);
                const bag = getActorPathValue(actor, entry.path);
                const bagInfo = describeStatBag(bag);
                detail.attempts.push({
                    phase: 'discovery',
                    path: entry.path,
                    ...bagInfo
                });
                const live = entry.live ?? bagInfo.readLive;
                if (live != null) {
                    detail.value = live;
                    detail.source = `discovery:${entry.path}`;
                    return detail;
                }
            }
        }

        const geneValue = readActorGeneStat(actor, statKey);
        detail.attempts.push({ phase: 'gene', value: geneValue });
        if (geneValue != null) {
            detail.value = geneValue;
            detail.source = 'actor-gene-flat';
            return detail;
        }

        detail.scale = scaleActorCatalogStatDetailed(actor, metadata, statKey);
        detail.attempts.push({
            phase: 'catalog-scale',
            scale: detail.scale
        });
        if (detail.scale.value != null) {
            detail.value = detail.scale.value;
            detail.source = detail.scale.source || 'catalog-scale';
        }
        return detail;
    }

    function resolveActorBaseStatDetailed(actor, metadata, statKey, catalogBase) {
        const detail = {
            statKey,
            value: null,
            source: 'unresolved',
            attempts: []
        };
        const keys = LIVE_STAT_ALIASES[statKey] || [statKey];

        for (const key of keys) {
            const bag = actor[key];
            const base = bag != null ? readStatBagBase(bag) : null;
            detail.attempts.push({
                phase: 'actor-direct-base',
                key,
                base,
                bag: describeStatBag(bag)
            });
            if (base != null) {
                detail.value = base;
                detail.source = `actor.${key} (getBaseValue)`;
                return detail;
            }
        }

        const plainStat = readActorPlainStat(actor, statKey);
        detail.attempts.push({ phase: 'plain-stats-base', ...plainStat });
        if (plainStat?.value != null) {
            detail.value = plainStat.value;
            detail.source = `${plainStat.source} (plain)`;
            return detail;
        }

        for (const container of collectActorStatContainers(actor)) {
            if (statKey !== 'hp' && isHpBagContainer(actor, container)) continue;
            const containerLabel = labelActorContainer(actor, container);
            for (const key of keys) {
                const bag = container[key];
                const base = bag != null ? readStatBagBase(bag) : null;
                detail.attempts.push({
                    phase: 'container-key-base',
                    container: containerLabel,
                    key,
                    base,
                    bag: describeStatBag(bag)
                });
                if (base != null) {
                    detail.value = base;
                    detail.source = `${containerLabel}.${key} (getBaseValue)`;
                    return detail;
                }
            }
        }

        const pattern = STAT_BAG_PATH_PATTERNS[statKey];
        const discovered = pattern
            ? discoverActorStatLikeBags(actor).find((entry) => {
                if (statKey !== 'hp' && isHpSubtreePath(entry.path)) return false;
                const leaf = entry.path.split('.').pop() || entry.path;
                return pattern.test(leaf) || pattern.test(entry.path);
            })
            : null;
        if (discovered?.base != null) {
            detail.value = discovered.base;
            detail.source = `discovery:${discovered.path} (base)`;
            detail.attempts.push({ phase: 'discovery-base', entry: discovered });
            return detail;
        }

        const catalog = catalogBase?.[statKey];
        if (catalog != null) {
            detail.value = catalog;
            detail.source = 'metadata.baseStats (template)';
            detail.attempts.push({ phase: 'catalog-template', catalog });
        }
        return detail;
    }

    function logStatResolutionTrace(actor, unit, metadata, statResolutions, baseResolutions) {
        const logKey = `${unit.collapseKey || unit.name}:resolve`;
        if (unitsStatResolveLogged.has(logKey)) return;
        unitsStatResolveLogged.add(logKey);

        const prefix = `[${modName}][StatResolve]`;
        const header = `${unit.name} gameId=${unit.gameId ?? '?'} Lv${unit.level ?? '?'} awaken=${unit.awaken === true}`;
        const lines = ['ad', 'ap', 'armor', 'magicResist', 'speed'].map((key) => {
            const live = statResolutions[key];
            const base = baseResolutions[key];
            return `  ${key}: live=${live?.value ?? '—'} [${live?.source ?? '?'}] | base=${base?.value ?? '—'} [${base?.source ?? '?'}]`;
        });
        console.log(`${prefix} ${header}\n${lines.join('\n')}`);

        console.group(`${prefix} trace ${unit.name}`);
        console.log('actor keys:', Object.keys(actor));
        console.log('metadata.baseStats:', metadata?.baseStats ?? null);
        console.log('catalog gameId resolve:', {
            gameId: unit.gameId,
            actorGameId: actor.gameId,
            actorMonsterId: actor.monsterId,
            actorName: actor.name
        });
        for (const key of ['ad', 'ap', 'armor', 'magicResist', 'speed']) {
            console.group(`${key} resolution`);
            console.log('live:', statResolutions[key]);
            console.table(statResolutions[key]?.attempts ?? []);
            if (statResolutions[key]?.discoveryMatches?.length) {
                console.log('discovery matches:', statResolutions[key].discoveryMatches);
            }
            if (statResolutions[key]?.scale) {
                console.log('scaleStat:', statResolutions[key].scale);
            }
            console.log('base:', baseResolutions[key]);
            console.table(baseResolutions[key]?.attempts ?? []);
            console.groupEnd();
        }
        console.log('all stat-like bags on actor:', discoverActorStatLikeBags(actor));
        for (const key of ['ad', 'ap', 'armor', 'magicResist', 'speed']) {
            const bag = actor[key];
            if (!bag) continue;
            console.log(`actor.${key} direct:`, describeStatBag(bag));
        }
        console.groupEnd();
    }

    function readActorStat(actor, statKey) {
        return resolveActorLiveStatDetailed(actor, getMonsterMetadata(resolveGameId(actor)), statKey).value;
    }

    function readActorStatBase(actor, statKey) {
        const metadata = getMonsterMetadata(resolveGameId(actor));
        return resolveActorBaseStatDetailed(actor, metadata, statKey, metadata?.baseStats ?? null).value;
    }

    function resolveActorLiveStat(actor, metadata, statKey) {
        return resolveActorLiveStatDetailed(actor, metadata, statKey).value;
    }

    function readActorHp(hpBag) {
        if (!hpBag) {
            return { hp: null, hpMax: null, hpPct: null, alive: true };
        }

        let hp = readStatBagNumber(hpBag);
        let hpMax = null;

        for (const key of ['maxValue', 'max', 'maximum', 'maxHp']) {
            if (key in hpBag) {
                const v = Number(hpBag[key]);
                if (Number.isFinite(v)) {
                    hpMax = v;
                    break;
                }
            }
        }

        for (const fn of ['getMaxValue', 'getMax', 'getMaximum', 'getMaxHp']) {
            if (hpMax == null && typeof hpBag[fn] === 'function') {
                try {
                    const v = Number(hpBag[fn]());
                    if (Number.isFinite(v)) hpMax = v;
                } catch { /* ignore */ }
            }
        }

        let hpPct = null;
        if (typeof hpBag.getPercent === 'function') {
            try {
                const pct = Number(hpBag.getPercent());
                if (Number.isFinite(pct)) hpPct = pct;
            } catch { /* ignore */ }
        }

        if (hp == null && hpPct != null && hpMax != null) {
            hp = Math.round(hpPct * hpMax);
        } else if (hpMax == null && hp != null && hpPct != null && hpPct > 0) {
            hpMax = Math.round(hp / hpPct);
        }

        return {
            hp,
            hpMax,
            hpPct,
            alive: hpBag.isAlive !== false
        };
    }

    function readComponentNumber(component, keys) {
        if (!component) return null;
        for (const key of keys) {
            try {
                if (key in component || component[key] != null) {
                    const v = Number(component[key]);
                    if (Number.isFinite(v)) return v;
                }
            } catch { /* ignore */ }
        }
        return null;
    }

    function ticksToMs(ticks) {
        if (ticks == null || !Number.isFinite(ticks)) return null;
        return ticks * DEFAULT_TICK_INTERVAL_MS;
    }

    function findActorCooldownComponent(actor, metadata) {
        const direct = actor.abilityCooldown
            ?? actor.skillCooldown
            ?? actor.ability?.cooldown
            ?? actor.skill?.cooldown;
        if (direct) return direct;

        const list = actor.cooldownList;
        if (!Array.isArray(list) || !list.length) return null;

        const skillSrc = metadata?.skill?.src;
        if (skillSrc) {
            const skillNeedle = String(skillSrc).toLowerCase();
            const bySrc = list.find((cd) => {
                const src = String(cd?.src ?? '').toLowerCase();
                return src && (src === skillNeedle || src.includes(skillNeedle) || src.endsWith(`/${skillNeedle}.png`));
            });
            if (bySrc) return bySrc;
        }

        const abilityLike = list.find((cd) => cd && cd.src && cd.benign !== true);
        if (abilityLike) return abilityLike;

        return list.find((cd) => cd?.src) ?? list[0] ?? null;
    }

    function readActorCooldown(actor, metadata) {
        const cd = findActorCooldownComponent(actor, metadata);
        if (!cd) {
            return {
                cooldownMs: null,
                cooldownTicks: null,
                cooldownRemainingMs: null,
                cooldownRemainingTicks: null,
                cooldownReady: null,
                abilitySrc: metadata?.skill?.src ?? null,
                raw: null
            };
        }

        const baseTicks = readComponentNumber(cd, [
            '_baseCooldown', 'baseCooldown', 'baseCooldownTicks', 'cooldownTicks'
        ]);
        let cooldownMs = pickFirstNumber(cd, [
            'cooldownMilliseconds', 'baseCooldownMilliseconds', 'cooldownMs', 'baseCooldownMs',
            'duration', 'baseDuration', 'cooldown', 'maxCooldown', 'totalCooldown'
        ]);
        if (cooldownMs == null && baseTicks != null) {
            cooldownMs = ticksToMs(baseTicks);
        }

        const remainingTicks = readComponentNumber(cd, [
            '_currentCooldown', 'currentCooldown', 'remainingTicks', 'cooldownRemainingTicks'
        ]);
        let cooldownRemainingMs = null;
        try {
            if (typeof cd.getRemainingMs === 'function') {
                cooldownRemainingMs = cd.getRemainingMs();
            } else if (Number.isFinite(cd.remainingMilliseconds)) {
                cooldownRemainingMs = cd.remainingMilliseconds;
            } else if (Number.isFinite(cd.remainingMs)) {
                cooldownRemainingMs = cd.remainingMs;
            } else if (remainingTicks != null) {
                cooldownRemainingMs = ticksToMs(remainingTicks);
            }
        } catch { /* ignore */ }

        let cooldownReady = null;
        try {
            if (cd.isOnCooldown === false) cooldownReady = true;
            else if (cd.isOnCooldown === true) cooldownReady = false;
            else if (remainingTicks != null) cooldownReady = remainingTicks <= 0;
        } catch { /* ignore */ }

        const abilitySrc = cd.src ?? cd.abilitySrc ?? cd.skillSrc ?? metadata?.skill?.src ?? null;
        return {
            cooldownMs,
            cooldownTicks: baseTicks,
            cooldownRemainingMs,
            cooldownRemainingTicks: remainingTicks,
            cooldownReady,
            abilitySrc,
            raw: cd
        };
    }

    function readActorAttackSpeed(actor, metadata) {
        const delayTicks = readStatBagLive(actor.attackDelay);
        if (delayTicks != null && delayTicks > 0) {
            const attacksPerSecond = TICKS_PER_SECOND / delayTicks;
            return {
                value: Math.round(attacksPerSecond * 100) / 100,
                source: `actor.attackDelay (${delayTicks} ticks)`,
                delayTicks
            };
        }

        const direct = pickFirstNumber(actor, [
            'attackSpeed', 'attack_speed', 'autoAttackSpeed', 'basicAttackSpeed', 'attackInterval'
        ]);
        if (direct != null) return { value: direct, source: 'actor' };

        const discovered = readActorStatByDiscovery(actor, 'attackSpeed');
        if (discovered != null) return { value: discovered, source: 'discovery' };

        const metaCandidates = [
            metadata?.attackSpeed,
            metadata?.attack_speed,
            metadata?.baseStats?.attackSpeed,
            metadata?.baseStats?.attack_speed,
            metadata?.skill?.attackSpeed,
            metadata?.skill?.attack_speed
        ];
        for (const candidate of metaCandidates) {
            if (typeof candidate === 'number' && Number.isFinite(candidate)) {
                return { value: candidate, source: 'metadata' };
            }
        }
        return { value: null, source: null };
    }

    function logUnitsStatProbe(actor, unit, metadata, cooldownInfo, attackSpeedInfo) {
        const logKey = unit.collapseKey || `${unit.name}:${unit.tileIndex ?? 'x'}`;
        if (unitsStatDebugLogged.has(logKey)) return;
        unitsStatDebugLogged.add(logKey);

        const missingStats = ['armor', 'magicResist', 'speed'].filter((k) => unit[k] == null);
        const missingMechanics = [];
        if (cooldownInfo.cooldownMs == null && metadata?.skill?.src) {
            missingMechanics.push('abilityCooldown');
        }
        if (attackSpeedInfo.value == null) missingMechanics.push('attackSpeed');

        const prefix = `[${modName}][UnitsStat]`;
        if (missingStats.length) {
            console.log(`${prefix} ${unit.name}: missing stats ${missingStats.join(', ')}`);
        }
        if (missingMechanics.length) {
            console.log(`${prefix} ${unit.name}: missing mechanics ${missingMechanics.join(', ')}`);
        }

        console.log(`${prefix} ${unit.name} top-level keys:`, Object.keys(actor));
        console.log(`${prefix} ${unit.name} resolved stats:`, {
            ad: unit.ad, ap: unit.ap, armor: unit.armor, magicResist: unit.magicResist, speed: unit.speed,
            attackSpeed: attackSpeedInfo.value, attackSpeedSource: attackSpeedInfo.source,
            cooldownMs: cooldownInfo.cooldownMs,
            cooldownTicks: cooldownInfo.cooldownTicks,
            cooldownRemainingMs: cooldownInfo.cooldownRemainingMs,
            cooldownRemainingTicks: cooldownInfo.cooldownRemainingTicks,
            cooldownReady: cooldownInfo.cooldownReady
        });
        console.log(`${prefix} ${unit.name} stat-like bags:`, discoverActorStatLikeBags(actor));
        console.log(`${prefix} ${unit.name} abilityCooldown raw:`, cooldownInfo.raw);
        for (const statKey of ['ad', 'ap', 'armor', 'magicResist', 'speed']) {
            const keys = LIVE_STAT_ALIASES[statKey] || [statKey];
            for (const key of keys) {
                const bag = actor[key];
                if (!bag) continue;
                console.log(`${prefix} ${unit.name} actor.${key}:`, {
                    shape: summarizeBagShape(bag),
                    live: readStatBagLive(bag),
                    base: readStatBagBase(bag)
                });
            }
        }
    }

    function probeActor(actor) {
        if (!actor) return null;

        const hpBag = actor.hp;
        const hpSnapshot = readActorHp(hpBag);

        const gameId = resolveGameId(actor);
        const metadata = getMonsterMetadata(gameId);
        const cooldownInfo = readActorCooldown(actor, metadata);
        const attackSpeedInfo = readActorAttackSpeed(actor, metadata);
        const catalogBase = metadata?.baseStats ?? null;
        const statKeys = ['ad', 'ap', 'armor', 'magicResist', 'speed'];
        const statResolutions = {};
        const baseResolutions = {};
        for (const statKey of statKeys) {
            statResolutions[statKey] = resolveActorLiveStatDetailed(actor, metadata, statKey);
            baseResolutions[statKey] = resolveActorBaseStatDetailed(actor, metadata, statKey, catalogBase);
        }

        const liveBase = {
            hp: readActorStatBase(actor, 'hp') ?? readStatBagBase(hpBag),
            ad: baseResolutions.ad.value,
            ap: baseResolutions.ap.value,
            armor: baseResolutions.armor.value,
            magicResist: baseResolutions.magicResist.value,
            speed: baseResolutions.speed.value
        };
        const fightBaseStats = catalogBase ? { ...catalogBase } : {};
        for (const [key, value] of Object.entries(liveBase)) {
            if (value != null) fightBaseStats[key] = value;
        }

        const unit = {
            gameId,
            name: actor.name || actor.nickname || metadata?.name || 'Unknown',
            villain: actor.villain === true,
            awaken: actor.awaken === true,
            level: readActorStat(actor, 'level') ?? actor.level,
            alive: hpSnapshot.alive,
            hp: hpSnapshot.hp,
            hpMax: hpSnapshot.hpMax,
            hpPct: hpSnapshot.hpPct,
            ad: statResolutions.ad.value,
            ap: statResolutions.ap.value,
            armor: statResolutions.armor.value,
            magicResist: statResolutions.magicResist.value,
            speed: statResolutions.speed.value,
            statSources: Object.fromEntries(statKeys.map((k) => [k, statResolutions[k].source])),
            attackSpeed: attackSpeedInfo.value,
            attackSpeedSource: attackSpeedInfo.source,
            attackDelayTicks: attackSpeedInfo.delayTicks ?? null,
            cooldownMs: cooldownInfo.cooldownMs,
            cooldownTicks: cooldownInfo.cooldownTicks,
            cooldownReady: cooldownInfo.cooldownReady,
            cooldownRemainingMs: cooldownInfo.cooldownRemainingMs,
            cooldownRemainingTicks: cooldownInfo.cooldownRemainingTicks,
            abilitySrc: cooldownInfo.abilitySrc,
            silenced: actor.silenceComponent?.isSilenced === true,
            buffedCount: Array.isArray(actor.buffed) ? actor.buffed.length : null,
            roles: Array.isArray(metadata?.roles) ? metadata.roles : [],
            baseStats: Object.keys(fightBaseStats).length ? fightBaseStats : null,
            tileIndex: actor.position?.tile?.index ?? actor.position?.tileIndex ?? null,
            equipment: resolveEquipmentFromActor(actor),
            source: 'fight',
            collapseKey: resolveFightCollapseKey(actor)
        };

        logStatResolutionTrace(actor, unit, metadata, statResolutions, baseResolutions);
        logUnitsStatProbe(actor, unit, metadata, cooldownInfo, attackSpeedInfo);
        return unit;
    }

    const EQUIP_STAT_ICONS = {
        hp: '/assets/icons/heal.png',
        ad: '/assets/icons/attackdamage.png',
        ap: '/assets/icons/abilitypower.png'
    };

    function getEquipmentCatalogMeta(gameId) {
        if (gameId == null) return null;
        try {
            const data = globalThis.state?.utils?.getEquipment?.(Number(gameId));
            if (!data?.metadata) return null;
            return {
                gameId: Number(gameId),
                name: data.metadata.name || null,
                spriteId: data.metadata.spriteId ?? null,
                defaultStat: data.metadata.stat ?? null
            };
        } catch {
            return null;
        }
    }

    function resolvePlayerEquipRecord(equipDatabaseId) {
        if (equipDatabaseId == null) return null;
        try {
            const equips = globalThis.state?.player?.getSnapshot?.()?.context?.equips;
            if (!Array.isArray(equips)) return null;
            return equips.find((e) => String(e.id) === String(equipDatabaseId)) ?? null;
        } catch {
            return null;
        }
    }

    function normalizeEquipmentInfo(bag) {
        if (!bag) return null;
        const meta = bag.metadata;
        const gameId = bag.gameId != null ? Number(bag.gameId) : null;
        if (!Number.isFinite(gameId)) {
            const name = meta?.name ?? bag.name ?? null;
            const spriteId = meta?.spriteId ?? bag.spriteId ?? null;
            if (name || spriteId != null) {
                return {
                    gameId: null,
                    name: name || 'Unknown equipment',
                    tier: bag.tier ?? null,
                    stat: bag.stat ?? meta?.stat ?? null,
                    spriteId
                };
            }
            return null;
        }
        const catalog = getEquipmentCatalogMeta(gameId);
        return {
            gameId,
            name: catalog?.name || meta?.name || bag.name || `#${gameId}`,
            tier: bag.tier ?? null,
            stat: bag.stat ?? catalog?.defaultStat ?? null,
            spriteId: catalog?.spriteId ?? meta?.spriteId ?? bag.spriteId ?? null
        };
    }

    function resolveEquipmentFromBoardActor(actor) {
        const tile = actor.position?.tile?.index ?? actor.position?.tileIndex ?? null;
        if (tile == null) return null;
        const databaseId = actor.databaseId ?? actor.monsterDatabaseId ?? actor.monsterId ?? null;
        const gameId = resolveGameId(actor);

        const config = getBoardContext()?.boardConfig;
        if (Array.isArray(config)) {
            for (const piece of config) {
                const pieceTile = resolveBoardPieceTileIndex(piece);
                if (pieceTile !== tile) continue;
                if (actor.villain === true) {
                    const pieceGameId = piece.gameId != null ? Number(piece.gameId) : null;
                    if (Number.isFinite(pieceGameId) && pieceGameId === gameId) {
                        return resolveEquipmentFromPiece(piece);
                    }
                } else if (databaseId != null) {
                    const pieceDb = piece.databaseId ?? piece.monsterId;
                    if (pieceDb != null && String(pieceDb) === String(databaseId)) {
                        return resolveEquipmentFromPiece(piece);
                    }
                }
            }
        }

        const roomId = resolveCurrentRoomId();
        const getBoardMonsters = globalThis.state?.utils?.getBoardMonstersFromRoomId;
        if (actor.villain === true && roomId && typeof getBoardMonsters === 'function') {
            try {
                for (const piece of getBoardMonsters(roomId) || []) {
                    const pieceTile = resolveBoardPieceTileIndex(piece);
                    if (pieceTile !== tile) continue;
                    const pieceGameId = piece.gameId != null ? Number(piece.gameId) : null;
                    if (Number.isFinite(pieceGameId) && pieceGameId === gameId) {
                        return resolveEquipmentFromPiece(piece);
                    }
                }
            } catch { /* ignore */ }
        }

        return null;
    }

    function resolveEquipmentFromActor(actor) {
        if (!actor) return null;
        if (Array.isArray(actor.equipments)) {
            if (!actor.equipments.length) return null;
            return normalizeEquipmentInfo(actor.equipments[0]);
        }
        if (actor.equip) return normalizeEquipmentInfo(actor.equip);
        return resolveEquipmentFromBoardActor(actor);
    }

    function resolveEquipmentFromEquipId(equipId) {
        const record = resolvePlayerEquipRecord(equipId);
        if (!record) return null;
        return normalizeEquipmentInfo(record);
    }

    function resolveEquipmentFromPiece(piece) {
        if (!piece) return null;
        if (piece.equip) return normalizeEquipmentInfo(piece.equip);
        if (piece.equipment) return normalizeEquipmentInfo(piece.equipment);
        if (piece.equipId != null) return resolveEquipmentFromEquipId(piece.equipId);
        if (piece.equipmentName) {
            return {
                gameId: null,
                name: piece.equipmentName,
                tier: piece.equipmentTier ?? null,
                stat: piece.equipmentStat ?? null,
                spriteId: null
            };
        }
        return null;
    }

    function formatEquipmentSummary(equipment) {
        if (!equipment) return null;
        const parts = [equipment.name || 'Unknown equipment'];
        if (equipment.tier != null) parts.push(`T${equipment.tier}`);
        if (equipment.stat) parts.push(String(equipment.stat).toUpperCase());
        return parts.join(' · ');
    }

    function renderEquipmentHtml(equipment) {
        if (!equipment) return '';
        const summary = formatEquipmentSummary(equipment);
        if (!summary) return '';
        const stat = String(equipment.stat || '').toLowerCase();
        const statIcon = EQUIP_STAT_ICONS[stat];
        let iconHtml = '';
        if (equipment.spriteId != null) {
            iconHtml = `<span class="bs-equip-icon sprite item relative id-${equipment.spriteId}">` +
                `<span class="bs-equip-viewport viewport"><img alt="" data-cropped="false" class="spritesheet"></span>` +
                (statIcon ? `<img class="bs-equip-stat" src="${statIcon}" alt="${escapeHtml(stat)}">` : '') +
                `</span>`;
        }
        return `<div class="bs-row bs-equip-row"><span class="bs-label">Equip:</span>` +
            `<span class="bs-equip-content">${iconHtml}<span>${escapeHtml(summary)}</span></span></div>`;
    }

    function resolvePlayerMonsterByDatabaseId(databaseId) {
        if (databaseId == null) return null;
        try {
            const monsters = globalThis.state?.player?.getSnapshot?.()?.context?.monsters;
            if (!Array.isArray(monsters)) return null;
            return monsters.find((m) => m.id === databaseId) ?? null;
        } catch {
            return null;
        }
    }

    function extractBoardGeneStats(source) {
        if (!source || typeof source !== 'object') {
            return { hp: null, ad: null, ap: null, armor: null, magicResist: null };
        }
        const genes = source.genes || source.stats || source;
        const read = (key, altKey) => {
            const raw = source[key] ?? genes[key] ?? (altKey != null ? genes[altKey] : undefined);
            const n = Number(raw);
            return Number.isFinite(n) ? n : null;
        };
        return {
            hp: read('hp'),
            ad: read('ad'),
            ap: read('ap'),
            armor: read('armor'),
            magicResist: read('magicResist', 'mr')
        };
    }

    function resolveBoardPieceLevel(piece, monster) {
        if (piece?.level != null) return piece.level;
        if (monster?.exp != null && globalThis.state?.utils?.expToCurrentLevel) {
            try { return globalThis.state.utils.expToCurrentLevel(monster.exp); } catch { /* ignore */ }
        }
        return 50;
    }

    function buildBoardPreviewStatActor(resolved, previewFloor) {
        const isVillain = resolved.villain === true;
        const floor = isVillain ? (previewFloor ?? 0) : 0;
        const genes = isVillain
            ? buildAscensionVillainGenes(floor)
            : (resolved.genes || {});
        const awaken = isVillain
            ? resolveVillainAwakenForFloor(resolved, floor)
            : resolved.awaken === true;
        return {
            gameId: resolved.gameId,
            level: resolved.level,
            awaken,
            villain: isVillain,
            previewFloor: floor,
            genes,
            hp: genes.hp,
            ad: genes.ad,
            ap: genes.ap,
            armor: genes.armor,
            magicResist: genes.magicResist
        };
    }

    function resolveBoardPreviewStats(resolved) {
        const metadata = getMonsterMetadata(resolved.gameId);
        const previewFloor = resolved.villain ? resolveCurrentFloor() : 0;

        const actor = buildBoardPreviewStatActor(resolved, previewFloor);
        const floor0Actor = buildBoardPreviewStatActor(
            { ...resolved, awaken: resolved.villain ? false : resolved.awaken },
            0
        );
        const catalogBase = metadata?.baseStats ?? null;
        const statKeys = ['hp', 'ad', 'ap', 'armor', 'magicResist', 'speed'];
        const stats = {};
        const baseStats = {};
        const statSources = {};

        if (resolved.villain) {
            const ascension = resolveAscensionVillainCombatStats(metadata, previewFloor, resolved);
            for (const statKey of statKeys) {
                stats[statKey] = ascension.stats[statKey] ?? null;
                statSources[statKey] = ascension.mode;
            }
        } else {
            for (const statKey of statKeys) {
                const scaled = scaleActorCatalogStatDetailed(actor, metadata, statKey);
                stats[statKey] = scaled.value;
                statSources[statKey] = scaled.source;
            }
        }

        for (const statKey of statKeys) {
            if (resolved.villain) {
                baseStats[statKey] = catalogBase?.[statKey] ?? null;
            } else {
                const floor0 = scaleActorCatalogStatDetailed(floor0Actor, metadata, statKey);
                baseStats[statKey] = floor0.value;
            }
        }

        const maxHp = stats.hp;
        return { stats, baseStats, statSources, hp: maxHp, hpMax: maxHp };
    }

    function resolveBoardPieceTileIndex(piece) {
        return piece?.tileIndex ?? piece?.tile ?? null;
    }

    function buildStablePreviewKey(resolved, roomId) {
        const tile = resolved.tileIndex ?? 'x';
        if (resolved.villain) {
            const rid = roomId ?? resolveCurrentRoomId() ?? 'x';
            return `preview:enemy:${rid}:${resolved.gameId}:${tile}`;
        }
        return `preview:ally:${resolved.gameId}:${tile}`;
    }

    function buildPreviewUnitKey(source, resolved, roomId) {
        return buildStablePreviewKey(resolved, roomId);
    }

    function normalizeCollapseKey(key) {
        if (typeof key !== 'string' || !key) return key;
        const roomEnemy = key.match(/^preview:enemy:([^:]+):(\d+):([^:]+)$/);
        if (roomEnemy) return key;
        const legacy = key.match(/^preview:(?:board|map|fight):(ally|enemy):(\d+):([^:]+)(?::.+)?$/);
        if (legacy) {
            if (legacy[1] === 'enemy') {
                const rid = resolveCurrentRoomId() ?? 'x';
                return `preview:enemy:${rid}:${legacy[2]}:${legacy[3]}`;
            }
            return `preview:ally:${legacy[2]}:${legacy[3]}`;
        }
        const legacyEnemy = key.match(/^preview:enemy:(\d+):([^:]+)$/);
        if (legacyEnemy) {
            const rid = resolveCurrentRoomId() ?? 'x';
            return `preview:enemy:${rid}:${legacyEnemy[1]}:${legacyEnemy[2]}`;
        }
        const fightEnemy = key.match(/^fight:enemy:([^:]+):([^:]+):([^:#]+)/);
        if (fightEnemy) {
            const [, a, b, c] = fightEnemy;
            if (/^\d+$/.test(a) && /^\d+$/.test(b)) {
                const rid = resolveCurrentRoomId() ?? 'x';
                return `preview:enemy:${rid}:${a}:${b}`;
            }
            return `preview:enemy:${a}:${b}:${c}`;
        }
        return key;
    }

    function readCollapsedOverride(key) {
        const normalized = normalizeCollapseKey(key);
        if (collapsedOverrides.has(normalized)) return collapsedOverrides.get(normalized);
        if (normalized !== key && collapsedOverrides.has(key)) return collapsedOverrides.get(key);
        return undefined;
    }

    function writeCollapsedOverride(key, collapsed) {
        const normalized = normalizeCollapseKey(key);
        collapsedOverrides.set(normalized, collapsed === true);
        if (normalized !== key) collapsedOverrides.delete(key);
        saveCollapsedOverrides();
    }

    function isPanelElementVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function isPointInPanelScrollContent(clientX, clientY) {
        for (const id of [UNITS_BODY_ID, LOG_BODY_ID]) {
            const el = document.getElementById(id);
            if (!isPanelElementVisible(el)) continue;
            const rect = el.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom) {
                return true;
            }
        }
        return false;
    }

    function applyUnitCardCollapsedState(card, collapsed) {
        if (!card) return;
        card.classList.toggle('collapsed', collapsed);
        card.classList.toggle('expanded', !collapsed);
        const toggleEl = card.querySelector('.bs-toggle');
        if (toggleEl) {
            toggleEl.textContent = collapsed ? '▶' : '▼';
            toggleEl.title = collapsed ? 'Expand' : 'Collapse';
        }
    }

    function markUnitsInteraction() {
        unitsInteractUntil = Date.now() + UNITS_INTERACT_FREEZE_MS;
        lastUnitsRenderKey = '';
    }

    function canRefreshUnitsDom(force) {
        if (force) return true;
        if (!isFightActive()) return true;
        return Date.now() >= unitsInteractUntil;
    }

    function isPanelResizePointer(e, panel) {
        if (!panel) return false;
        if (e.target.closest('.resize-handle')) return true;
        return !!getResizeDirFromPanelPoint(panel, e.clientX, e.clientY);
    }

    function handleUnitsBodyPointerDown(e) {
        if (e.button !== 0) return;
        const panel = document.getElementById(PANEL_ID);
        if (isPanelResizePointer(e, panel)) return;
        if (e.target.closest('details, summary, a, button, input, label, .bs-switch')) return;
        const card = e.target.closest('.bs-card');
        if (!card) return;
        const key = card.getAttribute('data-unit-key');
        if (!key) return;
        const currentlyCollapsed = readCollapsedOverride(key);
        const nextCollapsed = currentlyCollapsed === undefined ? false : !currentlyCollapsed;
        writeCollapsedOverride(key, nextCollapsed);
        applyUnitCardCollapsedState(card, nextCollapsed);
        markUnitsInteraction();
    }

    function ensureUnitsBodyListener() {
        const body = document.getElementById(UNITS_BODY_ID);
        if (!body) return;
        if (unitsBodyClickHandler) return;
        unitsBodyClickHandler = handleUnitsBodyPointerDown;
        body.addEventListener('pointerdown', unitsBodyClickHandler, true);
    }

    function teardownUnitsBodyListener() {
        const body = document.getElementById(UNITS_BODY_ID);
        if (body && unitsBodyClickHandler) {
            body.removeEventListener('pointerdown', unitsBodyClickHandler, true);
        }
        unitsBodyClickHandler = null;
    }

    function resolveBoardPiece(piece) {
        if (!piece) return null;

        const tileIndex = resolveBoardPieceTileIndex(piece);

        if (piece.type === 'player') {
            const databaseId = piece.databaseId ?? piece.monsterId;
            const monster = resolvePlayerMonsterByDatabaseId(databaseId);
            if (!monster) return null;
            const gameId = Number(monster.gameId);
            if (!Number.isFinite(gameId)) return null;
            const metadata = getMonsterMetadata(gameId);
            let level = resolveBoardPieceLevel(piece, monster);
            return {
                gameId,
                name: metadata?.name || `#${gameId}`,
                villain: piece.villain === true,
                awaken: monster.awaken === true || monster.awakened === true || monster.isAwakened === true,
                level,
                genes: extractBoardGeneStats(monster),
                tileIndex,
                equipment: resolveEquipmentFromPiece(piece),
                identity: String(databaseId)
            };
        }

        const gameId = piece.gameId != null ? Number(piece.gameId) : null;
        if (!Number.isFinite(gameId)) return null;
        const metadata = getMonsterMetadata(gameId);
        return {
            gameId,
            name: piece.nickname || metadata?.name || `#${gameId}`,
            villain: piece.villain === true,
            awaken: piece.awaken === true || piece.awakened === true || piece.isAwakened === true,
            level: resolveBoardPieceLevel(piece, null),
            genes: extractBoardGeneStats(piece),
            tileIndex,
            equipment: resolveEquipmentFromPiece(piece),
            identity: String(piece.key ?? piece.type ?? 'spawn')
        };
    }

    function pieceToPreviewUnit(resolved, source, roomId) {
        const metadata = getMonsterMetadata(resolved.gameId);
        const previewFloor = resolved.villain ? resolveCurrentFloor() : 0;
        const previewStats = resolveBoardPreviewStats(resolved);
        const { stats, baseStats, statSources } = previewStats;
        const unitKey = buildStablePreviewKey(resolved, roomId);
        const awaken = resolved.villain
            ? resolveVillainAwakenForFloor(resolved, previewFloor)
            : resolved.awaken === true;
        return {
            gameId: resolved.gameId,
            name: resolved.name,
            villain: resolved.villain,
            awaken,
            level: resolved.level,
            hp: previewStats.hp,
            hpMax: previewStats.hpMax,
            ad: stats.ad,
            ap: stats.ap,
            armor: stats.armor,
            magicResist: stats.magicResist,
            speed: stats.speed,
            statSources,
            roles: Array.isArray(metadata?.roles) ? metadata.roles : [],
            baseStats: Object.keys(baseStats).some((k) => baseStats[k] != null) ? baseStats : null,
            abilitySrc: metadata?.skill?.src ?? null,
            source,
            roomId: roomId ?? null,
            tileIndex: resolved.tileIndex,
            equipment: resolved.equipment ?? null,
            mergeKey: unitKey,
            collapseKey: unitKey,
            alive: true
        };
    }

    function getBoardPreviewUnits() {
        const merged = new Map();
        const roomId = resolveCurrentRoomId();

        const addResolved = (resolved, source) => {
            if (!resolved) return;
            const unitKey = buildStablePreviewKey(resolved, roomId);
            if (merged.has(unitKey)) return;
            const unit = pieceToPreviewUnit(resolved, source, roomId);
            merged.set(unitKey, unit);
        };
        const addPiece = (p, source) => {
            addResolved(resolveBoardPiece(p), source);
        };

        const config = getBoardContext()?.boardConfig;
        if (Array.isArray(config)) {
            for (const p of config) addPiece(p, 'board');
        }

        const getBoardMonsters = globalThis.state?.utils?.getBoardMonstersFromRoomId;
        if (roomId && typeof getBoardMonsters === 'function') {
            try {
                for (const p of getBoardMonsters(roomId) || []) addPiece(p, 'map');
            } catch { /* ignore */ }
        }

        return Array.from(merged.values());
    }

    function collectActorSnapshots() {
        if (!isFightActive()) return null;
        const world = getActiveWorld();
        if (!world?.grid) return null;
        const actors = world.grid.actors || [];
        return actors.map((a) => probeActor(a)).filter(Boolean);
    }

    function splitByTeam(units) {
        const allies = [];
        const enemies = [];
        for (const u of units) {
            if (u.villain) enemies.push(u);
            else allies.push(u);
        }
        const byName = (a, b) => String(a.name).localeCompare(String(b.name));
        allies.sort(byName);
        enemies.sort(byName);
        return { allies, enemies };
    }

    function getAbilityText(gameId, awaken, options = {}) {
        const truncate = options.truncate ?? null;
        const skill = getMonsterMetadata(gameId)?.skill;
        const TooltipContent = skill?.TooltipContent;
        const createUIComponent = globalThis.state?.utils?.createUIComponent;
        if (!TooltipContent || typeof createUIComponent !== 'function') return '';

        try {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:-99999px;top:0;width:400px;opacity:0;pointer-events:none;';
            const root = document.createElement('div');
            root.className = 'tooltip-prose';
            root.style.fontSize = '11px';
            host.appendChild(root);
            document.body.appendChild(host);

            const component = awaken
                ? createUIComponent(root, TooltipContent, { awaken: true })
                : createUIComponent(root, TooltipContent);
            if (component?.mount) component.mount();

            const text = (root.textContent || '').replace(/\s+/g, ' ').trim();
            if (component?.unmount) component.unmount();
            host.remove();
            if (truncate != null && text.length > truncate) {
                return `${text.slice(0, truncate - 3)}…`;
            }
            return text;
        } catch {
            return '';
        }
    }

    function tryRenderAbilitySnippet(gameId, awaken) {
        return getAbilityText(gameId, awaken, { truncate: 220 });
    }

    function formatStatLineForExport(label, live, base) {
        if (live == null && base == null) return '';
        let line = `  ${label}: ${live != null ? live : '—'}`;
        if (base != null && base !== live) line += ` (base ${base})`;
        return line;
    }

    function formatUnitForExport(unit) {
        const lines = [];
        const team = unit.villain ? 'Enemy' : 'Ally';
        const srcTag = unit.source === 'board'
            ? 'Board setup · scaled preview'
            : unit.source === 'map'
                ? 'Map spawn · scaled preview'
                : 'In fight';

        lines.push(`${unit.name} [${team}]`);
        lines.push(`  ${srcTag}${unit.awaken ? ' · Awakened' : ''}`);
        if (unit.level != null) lines.push(`  Level: ${unit.level}`);
        if (unit.tileIndex != null) lines.push(`  Tile: ${unit.tileIndex}`);
        if (unit.gameId) lines.push(`  Game ID: ${unit.gameId}`);
        if (unit.roles?.length) lines.push(`  Roles: ${unit.roles.join(', ')}`);

        const equip = formatEquipmentSummary(unit.equipment);
        if (equip) lines.push(`  Equipment: ${equip}`);

        if (unit.source === 'fight' && unit.hp != null) {
            const hpBase = unit.baseStats?.hp;
            let hpLine = `  HP: ${unit.hp}/${unit.hpMax ?? '?'}`;
            if (hpBase != null && hpBase !== unit.hp) hpLine += ` (base ${hpBase})`;
            lines.push(hpLine);
        } else if (unit.hp != null && unit.source !== 'fight') {
            const hpBase = unit.baseStats?.hp;
            let hpLine = `  HP: ${unit.hp}`;
            if (hpBase != null && hpBase !== unit.hp) hpLine += ` (base ${hpBase})`;
            lines.push(hpLine);
        }

        for (const { key, label } of STAT_KEYS) {
            if (key === 'hp') continue;
            const statLine = formatStatLineForExport(label, unit[key], unit.baseStats?.[key]);
            if (statLine) lines.push(statLine);
        }

        const attackDelayTicks = resolveUnitAttackDelayTicks(unit);
        if (attackDelayTicks != null) {
            lines.push(`  Atk delay: ${formatTicks(attackDelayTicks)}`);
        }

        const cooldownTicks = resolveUnitCooldownTicks(unit);
        if (cooldownTicks != null) {
            const cdReady = unit.cooldownReady === true;
            const cdRemainingTicks = resolveUnitCooldownRemainingTicks(unit);
            let cdState = cdReady
                ? 'ready'
                : cdRemainingTicks != null && cdRemainingTicks > 0
                    ? `${formatTicks(cdRemainingTicks)} left`
                    : 'on cooldown';
            lines.push(`  Ability CD: ${formatTicks(cooldownTicks)} · ${cdState}`);
        }

        if (unit.abilitySrc) lines.push(`  Ability: ${unit.abilitySrc}`);
        if (unit.silenced) lines.push('  Silenced');
        if (unit.buffedCount != null && unit.buffedCount > 0) {
            lines.push(`  Active buffs on others: ${unit.buffedCount}`);
        }
        if (unit.alive === false) lines.push('  Defeated');

        const abilityText = unit.gameId ? getAbilityText(unit.gameId, unit.awaken) : '';
        if (abilityText) lines.push(`  Ability description: ${abilityText}`);

        return lines.join('\n');
    }

    function buildStatusTextForExport() {
        const lines = [];
        const sandbox = isSandboxMode();
        const fighting = isFightActive();
        const tick = getCurrentTick();
        const seed = getSeed();
        const modeLabel = getPlayModeLabel();
        const fightEnded = panelFightEndState != null && panelFightTickFrozen != null;
        const roomName = getRoomDisplayName(resolveCurrentRoomId());

        if (roomName) lines.push(`Map: ${roomName}`);
        if (modeLabel) lines.push(`Mode: ${modeLabel}`);

        if (fighting) {
            const parts = ['Fight active'];
            if (tick != null) parts.push(`tick ${tick}`);
            if (seed != null) parts.push(`seed ${seed}`);
            parts.push(`${battleLog.length} log entries`);
            if (sandbox && slowMotionEnabled) {
                parts.push(`slow ${gameSpeedPercent}%`);
                parts.push(`${getTickIntervalMs().toFixed(1)}ms/tick`);
            } else if (!slowMotionEnabled && window.__turboState?.active) {
                parts.push('turbo on');
            }
            lines.push(parts.join(' · '));
        } else if (fightEnded) {
            const endLabel = panelFightEndState === 'victory' ? 'Victory' : 'Defeat';
            const parts = [`${endLabel} · final tick ${panelFightTickFrozen}`];
            if (seed != null) parts.push(`seed ${seed}`);
            parts.push(`${battleLog.length} log entries`);
            lines.push(parts.join(' · '));
        } else {
            lines.push('Enemy preview uses scaleStat(catalog, level, eb genes) (allies use scaleStat).');
            const floor = resolveCurrentFloor();
            if (floor > 0) {
                const genes = buildAscensionVillainGenes(floor);
                const awakenNote = floor >= ASCENSION_AWAKEN_FLOOR ? ' · villains awakened' : '';
                lines.push(
                    `Ascension floor ${floor} (${Math.round(resolveAscensionDisplayMult(floor) * 100)}% display · genes ${genes.hp}${awakenNote}).`
                );
            }
            const preview = getBoardPreviewUnits();
            if (preview.length) lines.push(`Setup preview: ${preview.length} unit(s) (board + map spawns).`);
            if (!sandbox) lines.push('Slow motion slider is available in Sandbox only.');
        }

        return lines;
    }

    function formatBattleLogEntryForExport(entry) {
        const source = entry.actionSource && entry.actionSource !== 'unknown'
            ? ` [${entry.actionSource}]`
            : '';
        const type = `${entry.damageType}${entry.crit ? ' crit' : ''}`;
        if (entry.kind === 'heal') {
            return `[tick ${entry.tick}] ${entry.from} → ${entry.to}: +${entry.amount}${source} (${type})`;
        }
        return `[tick ${entry.tick}] ${entry.from} → ${entry.to}: ${entry.amount}${source} (${type})`;
    }

    function buildPanelExportText() {
        const lines = [];
        lines.push('Better Analytics Export');
        lines.push(`Exported: ${new Date().toISOString()}`);
        lines.push('');
        lines.push('=== Status ===');
        lines.push(...buildStatusTextForExport());
        lines.push('');
        lines.push('=== Units ===');

        const fighting = isFightActive();
        const units = fighting ? (collectActorSnapshots() || []) : getBoardPreviewUnits();
        const { allies, enemies } = splitByTeam(units);

        lines.push(`Allies (${allies.length})`);
        if (!allies.length) {
            lines.push('  No allies in this fight.');
        } else {
            for (const unit of allies) {
                lines.push('');
                lines.push(formatUnitForExport(unit));
            }
        }

        lines.push('');
        lines.push(`Enemies (${enemies.length})`);
        if (!enemies.length) {
            lines.push('  No enemies in this fight.');
        } else {
            for (const unit of enemies) {
                lines.push('');
                lines.push(formatUnitForExport(unit));
            }
        }

        lines.push('');
        lines.push('=== Battle Log ===');
        lines.push(`Total entries: ${battleLog.length}`);
        const activeFilters = Object.entries(LOG_FILTER_LABELS)
            .filter(([key]) => logFilters[key] === true)
            .map(([, label]) => label);
        lines.push(`Panel filters (export includes all entries): ${activeFilters.length ? activeFilters.join(', ') : 'none'}`);

        if (!battleLog.length) {
            lines.push('No battle events yet. Start a fight.');
        } else {
            for (const entry of battleLog) {
                lines.push(formatBattleLogEntryForExport(entry));
            }
        }

        return lines.join('\n');
    }

    function downloadPanelExport() {
        try {
            const text = buildPanelExportText();
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const roomName = getRoomDisplayName(resolveCurrentRoomId()) || 'export';
            const safeRoom = String(roomName).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
            a.download = `better-analytics-${safeRoom}-${Date.now()}.txt`;
            a.href = url;
            document.body.appendChild(a);
            a.click();
            if (a.parentNode) a.parentNode.removeChild(a);
            URL.revokeObjectURL(url);
            console.log(`[${modName}] Exported panel to .txt`);
        } catch (error) {
            console.error(`[${modName}] Export failed:`, error);
        }
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID} {
                --bs-frame-3: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
                --bs-frame-4: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
                --bs-frame-1: url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill;
                --bs-bg: url(/_next/static/media/background-dark.95edca67.png);
                --bs-panel-bg: #282C34;
                --bs-text: #ABB2BF;
                --bs-gold: #E5C07B;
                --bs-ally: #98C379;
                --bs-enemy: #E06C75;
                --bs-info: #61AFEF;
                position: fixed;
                z-index: 10050;
                display: flex;
                flex-direction: column;
                padding: 0;
                overflow: hidden;
                color: var(--bs-text);
                background-image: var(--bs-bg);
                background-color: var(--bs-panel-bg);
                border: 6px solid transparent;
                border-image: var(--bs-frame-3);
                box-shadow: 0 0 15px rgba(0,0,0,0.7);
                font-family: Inter, sans-serif;
            }
            #${PANEL_ID} .bs-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 8px;
                cursor: move;
                user-select: none;
                border: 6px solid transparent;
                border-image: var(--bs-frame-4);
                margin: 2px;
            }
            #${PANEL_ID} .bs-title {
                font-weight: bold;
                color: var(--bs-gold);
                font-size: 14px;
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #${PANEL_ID} .bs-header-actions {
                display: flex;
                gap: 4px;
                flex-shrink: 0;
            }
            #${PANEL_ID} .bs-icon-btn {
                border: 4px solid transparent;
                border-image: var(--bs-frame-1);
                background: transparent;
                color: var(--bs-text);
                cursor: pointer;
                min-width: 22px;
                min-height: 20px;
                font-size: 16px;
                line-height: 1;
            }
            #${PANEL_ID} .bs-status {
                margin: 0 8px 4px;
                padding: 4px 8px;
                font-size: 11px;
                line-height: 1.35;
                color: #888;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
            }
            #${PANEL_ID} .bs-speed-row {
                margin: 0 8px 6px;
                padding: 6px 8px;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
                font-size: 11px;
                color: var(--bs-text);
            }
            #${PANEL_ID} .bs-speed-head {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
                gap: 8px;
            }
            #${PANEL_ID} .bs-speed-head span:first-child {
                color: var(--bs-gold);
                font-weight: 700;
            }
            #${PANEL_ID} .bs-speed-hint {
                font-size: 10px;
                color: #777;
                margin-top: 4px;
            }
            #${PANEL_ID} .bs-speed-row input[type="range"] {
                width: 100%;
                margin: 0;
                cursor: pointer;
            }
            #${PANEL_ID} .bs-speed-row.disabled {
                opacity: 0.45;
                pointer-events: none;
            }
            #${PANEL_ID} .bs-speed-toggle-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
            }
            #${PANEL_ID} .bs-speed-toggle-row span {
                color: var(--bs-gold);
                font-weight: 700;
            }
            #${PANEL_ID} .bs-switch {
                position: relative;
                display: inline-block;
                width: 36px;
                height: 20px;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .bs-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            #${PANEL_ID} .bs-switch-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background: #444;
                border: 2px solid transparent;
                border-image: var(--bs-frame-1);
                transition: background 0.15s;
            }
            #${PANEL_ID} .bs-switch-slider::before {
                content: '';
                position: absolute;
                height: 12px;
                width: 12px;
                left: 2px;
                top: 2px;
                background: #aaa;
                transition: transform 0.15s;
            }
            #${PANEL_ID} .bs-switch input:checked + .bs-switch-slider {
                background: #3d5a34;
            }
            #${PANEL_ID} .bs-switch input:checked + .bs-switch-slider::before {
                transform: translateX(16px);
                background: var(--bs-ally);
            }
            #${PANEL_ID} .bs-speed-slider-wrap.disabled {
                opacity: 0.45;
            }
            #${PANEL_ID} .bs-speed-slider-wrap.disabled input[type="range"] {
                pointer-events: none;
            }
            #${PANEL_ID} .bs-tab-bar {
                display: flex;
                margin: 0 2px;
                flex: 0 0 auto;
                gap: 2px;
            }
            #${PANEL_ID} .bs-tab-btn {
                flex: 1;
                padding: 5px 0;
                border: 4px solid transparent;
                border-image: var(--bs-frame-1);
                background-image: var(--bs-bg);
                background-color: var(--bs-panel-bg);
                color: #888;
                font-size: 12px;
                font-weight: bold;
                font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
                cursor: pointer;
            }
            #${PANEL_ID} .bs-tab-btn.active {
                color: var(--bs-gold);
            }
            #${PANEL_ID} .bs-body {
                flex: 1 1 auto;
                overflow-y: auto;
                margin: 0 2px 2px;
                padding: 6px 6px 12px;
                border: 6px solid transparent;
                border-image: var(--bs-frame-4);
                position: relative;
            }
            #${PANEL_ID} .bs-log-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 6px;
                font-size: 10px;
                color: #888;
            }
            #${PANEL_ID} .bs-log-clear {
                border: 3px solid transparent;
                border-image: var(--bs-frame-1);
                background: transparent;
                color: var(--bs-text);
                font-size: 10px;
                padding: 2px 8px;
                cursor: pointer;
            }
            #${PANEL_ID} .bs-log-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-bottom: 6px;
            }
            #${PANEL_ID} .bs-log-filter {
                border: 3px solid transparent;
                border-image: var(--bs-frame-1);
                background: transparent;
                color: #666;
                font-size: 9px;
                padding: 2px 6px;
                cursor: pointer;
                line-height: 1.2;
            }
            #${PANEL_ID} .bs-log-filter.active {
                color: var(--bs-gold);
            }
            #${PANEL_ID} .bs-log-filter.filter-ally.active { color: var(--bs-ally); }
            #${PANEL_ID} .bs-log-filter.filter-enemy.active { color: var(--bs-enemy); }
            #${PANEL_ID} .bs-log-source {
                color: #b8a0d0;
                font-size: 9px;
                text-transform: lowercase;
            }
            #${PANEL_ID} .bs-log-line {
                font-family: ui-monospace, Consolas, monospace;
                font-size: 10px;
                line-height: 1.45;
                padding: 2px 0;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            #${PANEL_ID} .bs-log-tick { color: #777; }
            #${PANEL_ID} .bs-log-name.ally { color: var(--bs-ally); }
            #${PANEL_ID} .bs-log-name.enemy { color: var(--bs-enemy); }
            #${PANEL_ID} .bs-log-dmg { color: #E5C07B; }
            #${PANEL_ID} .bs-log-heal { color: #98C379; }
            #${PANEL_ID} .bs-log-type { color: #61AFEF; }
            #${PANEL_ID} .bs-units-columns {
                display: flex;
                gap: 8px;
                align-items: flex-start;
                position: relative;
                z-index: 1;
            }
            #${PANEL_ID} .bs-units-column {
                flex: 1 1 0;
                min-width: 0;
                position: relative;
                z-index: 1;
            }
            #${PANEL_ID} .bs-section-title {
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                padding: 6px 8px;
                margin: 0 0 4px;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
            }
            #${PANEL_ID} .bs-section-title.ally { color: var(--bs-ally); }
            #${PANEL_ID} .bs-section-title.enemy { color: var(--bs-enemy); }
            #${PANEL_ID} .bs-card {
                margin-bottom: 6px;
                padding: 8px 10px;
                font-size: 11px;
                line-height: 1.45;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
                background: rgba(40,44,52,0.55);
                cursor: pointer;
            }
            #${PANEL_ID} .bs-card.dead { opacity: 0.55; }
            #${PANEL_ID} .bs-card.collapsed {
                padding: 4px 8px;
            }
            #${PANEL_ID} .bs-card.collapsed .bs-card-body {
                display: none;
            }
            #${PANEL_ID} .bs-card-header-row {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
                cursor: pointer;
                user-select: none;
            }
            #${PANEL_ID} .bs-toggle {
                cursor: pointer;
                color: #aaa;
                font-size: 9px;
                padding: 0 2px;
                user-select: none;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .bs-toggle:hover { color: #ddd; }
            #${PANEL_ID} .bs-portrait {
                width: 22px;
                height: 22px;
                image-rendering: pixelated;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .bs-card.expanded .bs-portrait {
                width: 28px;
                height: 28px;
            }
            #${PANEL_ID} .bs-equip-row .bs-equip-content {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }
            #${PANEL_ID} .bs-equip-icon {
                display: inline-block;
                width: 32px;
                height: 32px;
                flex: 0 0 auto;
                position: relative;
            }
            #${PANEL_ID} .bs-equip-viewport {
                display: block;
                width: 100%;
                height: 100%;
            }
            #${PANEL_ID} .bs-equip-stat {
                position: absolute;
                right: 0;
                bottom: 0;
                width: 12px;
                height: 12px;
                image-rendering: pixelated;
                pointer-events: none;
            }
            #${PANEL_ID} .bs-compact-meta {
                flex: 1 1 auto;
                min-width: 0;
                overflow: hidden;
            }
            #${PANEL_ID} .bs-card-name {
                font-weight: 700;
                color: #fff;
                font-size: 12px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #${PANEL_ID} .bs-card.collapsed .bs-card-name {
                font-size: 11px;
            }
            #${PANEL_ID} .bs-card-name.ally { color: var(--bs-ally); }
            #${PANEL_ID} .bs-card-name.enemy { color: var(--bs-enemy); }
            #${PANEL_ID} .bs-card-compact {
                color: #888;
                font-size: 10px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #${PANEL_ID} .bs-card-body {
                margin-top: 6px;
                padding-top: 4px;
                border-top: 1px dashed rgba(255,255,255,0.08);
            }
            #${PANEL_ID} .bs-card-meta {
                color: #888;
                font-size: 10px;
                margin-bottom: 4px;
            }
            #${PANEL_ID} .bs-row { margin: 2px 0; }
            #${PANEL_ID} .bs-label { color: #777; }
            #${PANEL_ID} .bs-tag {
                display: inline-block;
                padding: 1px 5px;
                margin: 0 4px 2px 0;
                font-size: 9px;
                font-weight: 700;
                text-transform: uppercase;
                border: 2px solid #555;
                color: var(--bs-gold);
            }
            #${PANEL_ID} .bs-empty {
                padding: 12px;
                text-align: center;
                color: #888;
                font-size: 12px;
            }
            #${PANEL_ID} details.bs-details summary {
                cursor: pointer;
                color: var(--bs-info);
                font-size: 10px;
                margin-top: 4px;
            }
            #${PANEL_ID}.resizing {
                user-select: none;
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
            handle.style.zIndex = '10001';
            handle.style.background = 'transparent';
            handle.style.userSelect = 'none';
            handle.style.pointerEvents = 'auto';
            handle.setAttribute('aria-label', 'Resize ' + dir);
            if (dir.length === 1) {
                if (dir === 'n' || dir === 's') {
                    handle.style.height = '8px';
                    handle.style.width = '100%';
                    handle.style.cursor = dir + '-resize';
                    handle.style[dir === 'n' ? 'top' : 'bottom'] = '0';
                    handle.style.left = '0';
                } else {
                    handle.style.width = '8px';
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

    function getResizeDirFromPanelPoint(panel, clientX, clientY) {
        const rect = panel.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const m = RESIZE_EDGE_PX;
        const onN = y <= m;
        const onS = y >= rect.height - m;
        const onW = x <= m;
        const onE = x >= rect.width - m;
        if (onN && onW) return 'nw';
        if (onN && onE) return 'ne';
        if (onS && onW) return 'sw';
        if (onS && onE) return 'se';
        if (onN) return 'n';
        if (onS) return 's';
        if (onW) return 'w';
        if (onE) return 'e';
        return '';
    }

    function startPanelResize(panel, dir, e) {
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
    }

    function onPanelPointerDownCapture(e) {
        if (e.button !== 0) return;
        const panel = e.currentTarget;
        if (!panel || panel.id !== PANEL_ID) return;

        const handle = e.target.closest('.resize-handle');
        if (handle) {
            const dir = handle.getAttribute('data-dir');
            if (dir) {
                startPanelResize(panel, dir, e);
                e.preventDefault();
                e.stopPropagation();
            }
            return;
        }

        const dir = getResizeDirFromPanelPoint(panel, e.clientX, e.clientY);
        if (dir) {
            startPanelResize(panel, dir, e);
            e.preventDefault();
            e.stopPropagation();
            return;
        }

        if (isPointInPanelScrollContent(e.clientX, e.clientY)) return;
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
        document.addEventListener('pointermove', panelResizeMouseMoveHandler);
        document.addEventListener('pointerup', panelResizeMouseUpHandler);
    }

    function teardownPanelResizeListeners() {
        if (panelResizeMouseMoveHandler) {
            document.removeEventListener('mousemove', panelResizeMouseMoveHandler);
            document.removeEventListener('pointermove', panelResizeMouseMoveHandler);
            panelResizeMouseMoveHandler = null;
        }
        if (panelResizeMouseUpHandler) {
            document.removeEventListener('mouseup', panelResizeMouseUpHandler);
            document.removeEventListener('pointerup', panelResizeMouseUpHandler);
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

    const STAT_COLOR_GOOD = '#98C379';
    const STAT_COLOR_BAD = '#E06C75';

    function coloredStatSpan(text, good) {
        const color = good ? STAT_COLOR_GOOD : STAT_COLOR_BAD;
        return `<span style="color:${color}">${text}</span>`;
    }

    function renderStatLine(label, live, base) {
        if (live == null && base == null) return '';
        const liveStr = live != null ? live : '—';
        const baseStr = base != null && base !== live ? ` (base ${base})` : '';
        return `<div class="bs-row"><span class="bs-label">${label}:</span> ${liveStr}${baseStr}</div>`;
    }

    function escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function getUnitCollapseKey(unit) {
        if (unit?.collapseKey) return unit.collapseKey;
        return `${unit.gameId ?? 'x'}:${unit.villain ? 1 : 0}:${unit.tileIndex ?? 'x'}:${unit.source}`;
    }

    function isUnitCollapsed(unit) {
        const key = getUnitCollapseKey(unit);
        const stored = readCollapsedOverride(key);
        if (stored !== undefined) return stored;
        return true;
    }

    function toggleUnitCollapsed(unitKey) {
        const stored = readCollapsedOverride(unitKey);
        const currently = stored === undefined ? true : stored;
        writeCollapsedOverride(unitKey, !currently);
        markUnitsInteraction();
    }

    function renderCompactSummary(unit) {
        const bits = [];
        if (unit.level != null) bits.push(escapeHtml(`Lv ${unit.level}`));
        if (unit.equipment) {
            const equipSummary = formatEquipmentSummary(unit.equipment);
            if (equipSummary) bits.push(escapeHtml(equipSummary));
        }
        if (unit.hp != null) {
            const hpText = unit.source === 'fight'
                ? `HP ${unit.hp}/${unit.hpMax ?? '?'}`
                : `HP ${unit.hp}`;
            bits.push(coloredStatSpan(hpText, unit.alive !== false));
        }
        if (unit.cooldownReady === true) {
            bits.push(coloredStatSpan('CD ready', true));
        } else {
            const cdRemainingTicks = resolveUnitCooldownRemainingTicks(unit);
            if (cdRemainingTicks != null && cdRemainingTicks > 0) {
                bits.push(coloredStatSpan(`CD ${formatTicks(cdRemainingTicks)}`, false));
            } else if (unit.cooldownReady === false) {
                bits.push(coloredStatSpan('CD on cooldown', false));
            }
        }
        if (unit.alive === false) bits.push('<span style="color:#888">Defeated</span>');
        return bits.join(' · ');
    }

    function renderUnitCard(unit) {
        const unitKey = getUnitCollapseKey(unit);
        const collapsed = isUnitCollapsed(unit);
        const displayKey = normalizeCollapseKey(unitKey);
        const deadClass = unit.alive === false ? ' dead' : '';
        const collapseClass = collapsed ? ' collapsed' : ' expanded';
        const teamTag = unit.villain ? 'Enemy' : 'Ally';
        const srcTag = unit.source === 'board'
            ? 'Board setup · scaled preview'
            : unit.source === 'map'
                ? 'Map spawn · scaled preview'
                : 'In fight';
        const awakenTag = unit.awaken ? ' · Awakened' : '';
        const levelStr = unit.level != null ? `Lv ${unit.level}` : '';
        const tileStr = unit.tileIndex != null ? ` · Tile ${unit.tileIndex}` : '';
        const nameClass = teamClass(unit.villain);
        const compact = renderCompactSummary(unit);
        const portrait = unit.gameId
            ? `<img class="bs-portrait" draggable="false" src="/assets/portraits/${unit.gameId}.png" alt="">`
            : '';

        let statsHtml = '';
        if (unit.source === 'fight' && unit.hp != null) {
            const hpText = `${unit.hp}/${unit.hpMax ?? '?'}`;
            const hpBase = unit.baseStats?.hp;
            const hpBaseStr = hpBase != null && hpBase !== unit.hp ? ` (base ${hpBase})` : '';
            statsHtml += `<div class="bs-row"><span class="bs-label">HP:</span> ` +
                `${coloredStatSpan(hpText, unit.alive !== false)}${hpBaseStr}</div>`;
        } else if (unit.hp != null && unit.source !== 'fight') {
            const hpBase = unit.baseStats?.hp;
            const hpBaseStr = hpBase != null && hpBase !== unit.hp ? ` (base ${hpBase})` : '';
            statsHtml += `<div class="bs-row"><span class="bs-label">HP:</span> ` +
                `${coloredStatSpan(String(unit.hp), true)}${hpBaseStr}</div>`;
        }
        for (const { key, label } of STAT_KEYS) {
            if (key === 'hp') continue;
            const live = unit[key];
            const base = unit.baseStats?.[key];
            if (live != null || base != null) statsHtml += renderStatLine(label, live, base);
        }

        let mechanicsHtml = '';
        const attackDelayTicks = resolveUnitAttackDelayTicks(unit);
        if (attackDelayTicks != null) {
            mechanicsHtml += `<div class="bs-row"><span class="bs-label">Atk delay:</span> ${formatTicks(attackDelayTicks)}</div>`;
        }
        const cooldownTicks = resolveUnitCooldownTicks(unit);
        if (cooldownTicks != null) {
            const cdReady = unit.cooldownReady === true;
            const cdRemainingTicks = resolveUnitCooldownRemainingTicks(unit);
            const cdState = cdReady
                ? coloredStatSpan('ready', true)
                : cdRemainingTicks != null && cdRemainingTicks > 0
                    ? coloredStatSpan(`${formatTicks(cdRemainingTicks)} left`, false)
                    : coloredStatSpan('on cooldown', false);
            mechanicsHtml += `<div class="bs-row"><span class="bs-label">Ability CD:</span> ${formatTicks(cooldownTicks)} · ${cdState}</div>`;
        }
        if (unit.abilitySrc) {
            mechanicsHtml += `<div class="bs-row"><span class="bs-label">Ability:</span> ${unit.abilitySrc}</div>`;
        }
        if (unit.silenced) {
            mechanicsHtml += `<div class="bs-row" style="color:#E06C75">Silenced</div>`;
        }
        if (unit.buffedCount != null && unit.buffedCount > 0) {
            mechanicsHtml += `<div class="bs-row"><span class="bs-label">Active buffs on others:</span> ${unit.buffedCount}</div>`;
        }
        if (unit.alive === false) {
            mechanicsHtml += `<div class="bs-row" style="color:#888">Defeated</div>`;
        }

        const rolesHtml = (unit.roles || []).map((r) => `<span class="bs-tag">${escapeHtml(r)}</span>`).join('');

        const abilityText = unit.gameId ? tryRenderAbilitySnippet(unit.gameId, unit.awaken) : '';
        const abilityBlock = abilityText
            ? `<details class="bs-details"><summary>Ability description</summary><div style="margin-top:4px;color:#ccc;font-size:10px;line-height:1.35;">${abilityText}</div></details>`
            : '';

        const header = `<div class="bs-card-header-row">` +
            `<span class="bs-toggle" title="${collapsed ? 'Expand' : 'Collapse'}">${collapsed ? '▶' : '▼'}</span>` +
            portrait +
            `<div class="bs-compact-meta">` +
                `<div class="bs-card-name ${nameClass}">${escapeHtml(unit.name)}</div>` +
                (compact ? `<div class="bs-card-compact">${compact}</div>` : '') +
            `</div>` +
        `</div>`;

        const equipmentHtml = renderEquipmentHtml(unit.equipment);

        const body = `<div class="bs-card-body">` +
            `<div class="bs-card-meta">${teamTag} · ${srcTag}${awakenTag} ${levelStr}${tileStr}</div>` +
            (rolesHtml ? `<div class="bs-row">${rolesHtml}</div>` : '') +
            equipmentHtml +
            statsHtml +
            mechanicsHtml +
            abilityBlock +
        `</div>`;

        return `<div class="bs-card${deadClass}${collapseClass}" data-unit-key="${escapeHtml(displayKey)}">` +
            header +
            body +
        `</div>`;
    }

    function renderSection(title, cssClass, units) {
        const count = units.length;
        let inner = `<div class="bs-section-title ${cssClass}">${title} (${count})</div>`;
        if (count === 0) {
            inner += `<div class="bs-empty">No ${title.toLowerCase()} in this fight.</div>`;
        } else {
            inner += units.map(renderUnitCard).join('');
        }
        return `<div class="bs-units-column bs-units-column-${cssClass}">${inner}</div>`;
    }

    function renderStatusBar() {
        const title = document.getElementById(TITLE_ID);
        const status = document.getElementById(STATUS_ID);
        const panel = document.getElementById(PANEL_ID);
        if (!title || !status || !panel) return;
        if (panel.style.display === 'none') return;

        const sandbox = isSandboxMode();
        const fighting = isFightActive();
        const tick = getCurrentTick();
        const seed = getSeed();
        const modeLabel = getPlayModeLabel();
        const fightEnded = panelFightEndState != null && panelFightTickFrozen != null;

        const roomName = getRoomDisplayName(resolveCurrentRoomId());
        title.textContent = modName;

        const statusLines = [];
        if (roomName) statusLines.push(`Map: <b>${roomName}</b>`);
        if (modeLabel) statusLines.push(`Mode: <b>${modeLabel}</b>`);
        if (fighting) {
            const parts = ['Fight active'];
            if (tick != null) parts.push(`tick ${tick}`);
            if (seed != null) parts.push(`seed ${seed}`);
            parts.push(`${battleLog.length} log entries`);
            if (sandbox && slowMotionEnabled) {
                parts.push(`slow ${gameSpeedPercent}%`);
                parts.push(`${getTickIntervalMs().toFixed(1)}ms/tick`);
            } else if (!slowMotionEnabled && window.__turboState?.active) {
                parts.push('turbo on');
            }
            statusLines.push(parts.join(' · '));
        } else if (fightEnded) {
            const endLabel = panelFightEndState === 'victory' ? 'Victory' : 'Defeat';
            const parts = [`${endLabel} · final tick ${panelFightTickFrozen}`];
            if (seed != null) parts.push(`seed ${seed}`);
            parts.push(`${battleLog.length} log entries`);
            statusLines.push(parts.join(' · '));
        } else {
            const floor = resolveCurrentFloor();
            statusLines.push('Enemy preview uses scaleStat(catalog, level, eb genes) (allies use scaleStat).');
            if (floor > 0) {
                const genes = buildAscensionVillainGenes(floor);
                const awakenNote = floor >= ASCENSION_AWAKEN_FLOOR ? ' · villains awakened' : '';
                statusLines.push(`Ascension floor <b>${floor}</b> (${Math.round(resolveAscensionDisplayMult(floor) * 100)}% display · genes ${genes.hp}${awakenNote}).`);
            }
            const preview = getBoardPreviewUnits();
            if (preview.length) statusLines.push(`Setup preview: ${preview.length} unit(s) (board + map spawns).`);
            if (!sandbox) {
                statusLines.push('Slow motion slider is available in <b>Sandbox</b> only.');
            }
        }
        status.innerHTML = statusLines.join('<br>');

        const sliderWrap = document.getElementById('mod-better-sandbox-speed-slider-wrap');
        if (sliderWrap) sliderWrap.classList.toggle('disabled', !slowMotionEnabled || !sandbox);
    }

    function buildUnitsRenderKey(units) {
        const scope = isFightActive()
            ? 'fight'
            : `preview:${boardTrack.roomId ?? resolveCurrentRoomId() ?? 'x'}:f${boardTrack.floor ?? resolveCurrentFloor()}`;
        return scope + '|' + units.map((u) => [
            getUnitCollapseKey(u),
            isUnitCollapsed(u) ? 'c' : 'e',
            u.hp,
            u.hpMax,
            resolveUnitCooldownRemainingTicks(u),
            u.cooldownReady,
            u.alive,
            u.tileIndex,
            u.level,
            u.silenced,
            u.buffedCount
        ].join(':')).join('|');
    }

    function renderUnits(force) {
        const body = document.getElementById(UNITS_BODY_ID);
        const panel = document.getElementById(PANEL_ID);
        if (!body || !panel || panel.style.display === 'none') return;
        if (!canRefreshUnitsDom(force)) return;

        const fighting = isFightActive();
        const units = fighting ? (collectActorSnapshots() || []) : getBoardPreviewUnits();

        const renderKey = buildUnitsRenderKey(units);
        if (!force && renderKey === lastUnitsRenderKey) return;
        lastUnitsRenderKey = renderKey;

        const { allies, enemies } = splitByTeam(units);
        body.innerHTML =
            `<div class="bs-units-columns">` +
            renderSection('Allies', 'ally', allies) +
            renderSection('Enemies', 'enemy', enemies) +
            `</div>`;
    }

    function renderLogName(name, villain) {
        const cls = teamClass(villain);
        return `<span class="bs-log-name ${cls}">${name}</span>`;
    }

    function renderActionSourceLabel(entry) {
        const src = entry.actionSource || 'unknown';
        if (!src || src === 'unknown') return '';
        return `<span class="bs-log-source">[${escapeHtml(src)}]</span> `;
    }

    function renderBattleLog(force) {
        const list = document.getElementById(LOG_LIST_ID);
        const body = document.getElementById(LOG_BODY_ID);
        const panel = document.getElementById(PANEL_ID);
        if (!list || !body || !panel || panel.style.display === 'none') return;

        updateLogFilterUi();

        const signature = `${battleLogRevision}:${getLogFiltersSignature()}:${battleLog.length}`;
        const shouldScroll = battleLogRevision > lastScrolledBattleLogRevision;
        if (!force && signature === lastRenderedLogSignature) return;

        if (!battleLog.length) {
            list.innerHTML = '<div class="bs-empty">No battle events yet. Start a fight.</div>';
            lastRenderedLogSignature = signature;
            lastRenderedBattleLogRevision = battleLogRevision;
            return;
        }

        const visible = battleLog.filter(isLogEntryVisible);
        if (!visible.length) {
            list.innerHTML = '<div class="bs-empty">No events match the current filters.</div>';
            lastRenderedLogSignature = signature;
            lastRenderedBattleLogRevision = battleLogRevision;
            return;
        }

        const lines = visible.map((entry) => {
            const tickLabel = `<span class="bs-log-tick">[tick ${entry.tick}]</span>`;
            const sourceLabel = renderActionSourceLabel(entry);
            const typeLabel = `<span class="bs-log-type">${escapeHtml(entry.damageType)}${entry.crit ? ' crit' : ''}</span>`;
            if (entry.kind === 'heal') {
                return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.from, entry.fromVillain)} → ` +
                    `${renderLogName(entry.to, entry.toVillain)}: ` +
                    `<span class="bs-log-heal">+${entry.amount}</span> ${sourceLabel}${typeLabel}</div>`;
            }
            return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.from, entry.fromVillain)} → ` +
                `${renderLogName(entry.to, entry.toVillain)}: ` +
                `<span class="bs-log-dmg">${entry.amount}</span> ${sourceLabel}${typeLabel}</div>`;
        }).join('');

        list.innerHTML = lines;
        lastRenderedLogSignature = signature;
        lastRenderedBattleLogRevision = battleLogRevision;
        if (shouldScroll) {
            body.scrollTop = body.scrollHeight;
            lastScrolledBattleLogRevision = battleLogRevision;
        }
    }

    function switchTab(tab) {
        activeTab = tab === 'log' ? 'log' : 'units';
        savePanelSettings({ activeTab });

        const unitsBody = document.getElementById(UNITS_BODY_ID);
        const logBody = document.getElementById(LOG_BODY_ID);
        const tabUnits = document.getElementById('mod-better-sandbox-tab-units');
        const tabLog = document.getElementById('mod-better-sandbox-tab-log');

        if (unitsBody) unitsBody.style.display = activeTab === 'units' ? 'block' : 'none';
        if (logBody) logBody.style.display = activeTab === 'log' ? 'block' : 'none';
        if (tabUnits) tabUnits.classList.toggle('active', activeTab === 'units');
        if (tabLog) tabLog.classList.toggle('active', activeTab === 'log');

        if (activeTab === 'units') renderUnits();
        else renderBattleLog();
    }

    function renderLiveFight() {
        if (!shouldBetterAnalyticsRun()) return;
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none' || !isFightActive()) return;
        if (activeTab === 'units') renderUnits();
        else renderBattleLog();
    }

    function render() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;
        renderStatusBar();
        if (activeTab === 'units') {
            const forceUnits = pendingUnitsForceRefresh;
            pendingUnitsForceRefresh = false;
            renderUnits(forceUnits);
        } else {
            renderBattleLog();
        }
    }

    function syncPanelTickTracking() {
        const panel = document.getElementById(PANEL_ID);
        const panelOpen = panel && panel.style.display !== 'none';
        if (panelOpen && (isFightActive() || panelFightTickFrozen != null)) {
            setupPanelGameTimerSub();
            if (isFightActive()) startPanelTickPoll();
            else stopPanelTickPoll();
        } else {
            teardownPanelGameTimerSub();
            stopPanelTickPoll();
        }
    }

    function teardownBoardListeners() {
        for (const sub of boardUnsubs) {
            try {
                if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
            } catch { /* ignore */ }
        }
        boardUnsubs = [];
    }

    function setupBoardListeners() {
        teardownBoardListeners();
        const board = globalThis.state?.board;
        if (!board || typeof board.on !== 'function') return;

        syncBoardTrackFromContext();

        const onNewGame = (event) => {
            teardownWorldSubscriptions();
            activeWorld = event?.world ?? getBoardContext()?.world ?? null;
            resetBattleLogState();
            resetPanelFightTickState();
            if (activeWorld) ensureFightTracking(activeWorld);
            boardTrack.gameStarted = true;
            boardTrack.roomId = resolveCurrentRoomId();
            syncBoardTrackFromContext();
            teardownPanelGameTimerSub();
            syncPanelTickTracking();
            render();
        };

        const onEnd = () => {
            if (!slowMotionEnabled) restoreTurboIfSuspended();
            const world = getActiveWorld() || getBoardContext()?.world;
            if (world?.tickEngine?.setTickInterval) {
                world.tickEngine.setTickInterval(getBaselineTickIntervalMs());
            }
            teardownWorldSubscriptions();
            activeWorld = null;
            clearFightActorCollapseRegistry();
            boardTrack.gameStarted = false;
            syncPanelFightTickFromSnapshot();
            syncPanelTickTracking();
            render();
        };

        boardUnsubs.push(board.on('newGame', onNewGame));
        boardUnsubs.push(board.on('emitNewGame', onNewGame));
        boardUnsubs.push(board.on('emitEndGame', onEnd));

        try {
            const autoSetupSub = board.on('autoSetupBoard', () => {
                cachedSpawnTileKeyLookup = null;
                lastUnitsRenderKey = '';
                pendingUnitsForceRefresh = true;
                render();
            });
            if (autoSetupSub) boardUnsubs.push(autoSetupSub);
        } catch { /* ignore */ }

        if (typeof board.select === 'function') {
            try {
                const boardConfigSel = board.select((state) =>
                    getBoardConfigSignature(state?.context?.boardConfig));
                const configSub = boardConfigSel.subscribe(() => {
                    lastUnitsRenderKey = '';
                    pendingUnitsForceRefresh = true;
                    render();
                });
                if (configSub) boardUnsubs.push(configSub);

                const roomSel = board.select((state) => {
                    const ctx = state?.context ?? {};
                    return (ctx.selectedMap?.selectedRoom?.id)
                        || ctx.selectedMap?.id
                        || ctx.area?.id
                        || null;
                });
                const roomSub = roomSel.subscribe(() => {
                    cachedSpawnTileKeyLookup = null;
                    if (handleBoardContextChange()) render();
                });
                if (roomSub) boardUnsubs.push(roomSub);

                const floorSel = board.select((state) => state?.context?.floor ?? 0);
                const floorSub = floorSel.subscribe(() => {
                    cachedSpawnTileKeyLookup = null;
                    if (handleBoardContextChange()) render();
                });
                if (floorSub) boardUnsubs.push(floorSub);
            } catch { /* ignore */ }
        }

        const player = globalThis.state?.player;
        if (player && typeof player.select === 'function') {
            try {
                const playerRoomSel = player.select((state) => state?.context?.currentRoomId ?? null);
                const playerRoomSub = playerRoomSel.subscribe(() => {
                    if (handleBoardContextChange()) render();
                });
                if (playerRoomSub) boardUnsubs.push(playerRoomSub);
            } catch { /* ignore */ }
        }

        const modeSub = board.subscribe?.(() => {
            if (handleBoardContextChange()) render();
            if (isSandboxMode() && boardTrack.gameStarted) {
                applyTickIntervalToCurrentGame();
            }
        });
        if (modeSub) boardUnsubs.push(modeSub);
    }

    function createPanel() {
        injectStyles();
        const s = loadPanelSettings();
        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.style.cssText =
            `left:${s.left}px;top:${s.top}px;` +
            `width:${clamp(s.width, PANEL_LAYOUT.minWidth, PANEL_LAYOUT.maxWidth)}px;` +
            `height:${clamp(s.height, PANEL_LAYOUT.minHeight, PANEL_LAYOUT.maxHeight)}px;` +
            `min-width:${PANEL_LAYOUT.minWidth}px;max-width:${PANEL_LAYOUT.maxWidth}px;` +
            `min-height:${PANEL_LAYOUT.minHeight}px;max-height:${PANEL_LAYOUT.maxHeight}px;`;

        const header = document.createElement('div');
        header.className = 'bs-header';
        const titleEl = document.createElement('div');
        titleEl.id = TITLE_ID;
        titleEl.className = 'bs-title';
        titleEl.textContent = modName;
        const headerActions = document.createElement('div');
        headerActions.className = 'bs-header-actions';

        const exportBtn = document.createElement('button');
        exportBtn.className = 'bs-icon-btn';
        exportBtn.textContent = '⤓';
        exportBtn.title = 'Export everything to .txt';
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadPanelExport();
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'bs-icon-btn';
        closeBtn.textContent = '×';
        closeBtn.title = 'Close';
        closeBtn.addEventListener('click', closePanel);

        headerActions.appendChild(exportBtn);
        headerActions.appendChild(closeBtn);
        header.appendChild(titleEl);
        header.appendChild(headerActions);

        const statusEl = document.createElement('div');
        statusEl.id = STATUS_ID;
        statusEl.className = 'bs-status';

        const speedRow = document.createElement('div');
        speedRow.id = 'mod-better-sandbox-speed-row';
        speedRow.className = 'bs-speed-row';

        const slowMotionRow = document.createElement('div');
        slowMotionRow.className = 'bs-speed-toggle-row';
        const slowMotionLabel = document.createElement('span');
        slowMotionLabel.textContent = 'Slow motion';
        const slowMotionSwitch = document.createElement('label');
        slowMotionSwitch.className = 'bs-switch';
        slowMotionSwitch.title = 'On = slow fights (blocks Turbo). Off = use Turbo Mode to speed up.';
        const slowMotionInput = document.createElement('input');
        slowMotionInput.type = 'checkbox';
        slowMotionInput.id = SLOW_MOTION_TOGGLE_ID;
        slowMotionInput.checked = slowMotionEnabled;
        slowMotionInput.addEventListener('change', (e) => {
            e.stopPropagation();
            setSlowMotionEnabled(e.target.checked);
        });
        slowMotionInput.addEventListener('mousedown', (e) => e.stopPropagation());
        const slowMotionSlider = document.createElement('span');
        slowMotionSlider.className = 'bs-switch-slider';
        slowMotionSwitch.appendChild(slowMotionInput);
        slowMotionSwitch.appendChild(slowMotionSlider);
        slowMotionRow.appendChild(slowMotionLabel);
        slowMotionRow.appendChild(slowMotionSwitch);

        const speedSliderWrap = document.createElement('div');
        speedSliderWrap.id = 'mod-better-sandbox-speed-slider-wrap';
        speedSliderWrap.className = 'bs-speed-slider-wrap';
        const speedHead = document.createElement('div');
        speedHead.className = 'bs-speed-head';
        const speedLabel = document.createElement('span');
        speedLabel.textContent = 'Game speed';
        const speedValue = document.createElement('span');
        speedValue.id = SPEED_VALUE_ID;
        speedHead.appendChild(speedLabel);
        speedHead.appendChild(speedValue);
        const speedSlider = document.createElement('input');
        speedSlider.type = 'range';
        speedSlider.id = SPEED_SLIDER_ID;
        speedSlider.min = String(SPEED_MIN_PERCENT);
        speedSlider.max = String(SPEED_MAX_PERCENT);
        speedSlider.step = String(SPEED_STEP_PERCENT);
        speedSlider.value = String(gameSpeedPercent);
        speedSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            setGameSpeedPercent(e.target.value);
        });
        speedSlider.addEventListener('mousedown', (e) => e.stopPropagation());
        speedSliderWrap.appendChild(speedHead);
        speedSliderWrap.appendChild(speedSlider);

        const speedHint = document.createElement('div');
        speedHint.className = 'bs-speed-hint';
        speedHint.id = 'mod-better-sandbox-speed-hint';
        speedRow.appendChild(slowMotionRow);
        speedRow.appendChild(speedSliderWrap);
        speedRow.appendChild(speedHint);

        const tabBar = document.createElement('div');
        tabBar.className = 'bs-tab-bar';

        const tabUnitsBtn = document.createElement('button');
        tabUnitsBtn.type = 'button';
        tabUnitsBtn.id = 'mod-better-sandbox-tab-units';
        tabUnitsBtn.className = 'bs-tab-btn';
        tabUnitsBtn.textContent = 'Units';
        tabUnitsBtn.addEventListener('click', () => switchTab('units'));

        const tabLogBtn = document.createElement('button');
        tabLogBtn.type = 'button';
        tabLogBtn.id = 'mod-better-sandbox-tab-log';
        tabLogBtn.className = 'bs-tab-btn';
        tabLogBtn.textContent = 'Battle Log';
        tabLogBtn.addEventListener('click', () => switchTab('log'));

        tabBar.appendChild(tabUnitsBtn);
        tabBar.appendChild(tabLogBtn);

        const unitsBody = document.createElement('div');
        unitsBody.id = UNITS_BODY_ID;
        unitsBody.className = 'bs-body';

        const logBody = document.createElement('div');
        logBody.id = LOG_BODY_ID;
        logBody.className = 'bs-body';
        logBody.style.display = 'none';

        const logToolbar = document.createElement('div');
        logToolbar.className = 'bs-log-toolbar';
        logToolbar.innerHTML = '<span>Damage and healing events</span>';
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'bs-log-clear';
        clearBtn.textContent = 'Clear';
        clearBtn.addEventListener('click', clearBattleLog);
        logToolbar.appendChild(clearBtn);
        logBody.appendChild(logToolbar);

        const logFiltersRow = document.createElement('div');
        logFiltersRow.className = 'bs-log-filters';
        for (const [key, label] of Object.entries(LOG_FILTER_LABELS)) {
            const filterBtn = document.createElement('button');
            filterBtn.type = 'button';
            filterBtn.id = `mod-better-sandbox-log-filter-${key}`;
            filterBtn.className = `bs-log-filter ${key.includes('villain') ? 'filter-enemy' : 'filter-ally'}`;
            filterBtn.textContent = label;
            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleLogFilter(key);
            });
            logFiltersRow.appendChild(filterBtn);
        }
        logBody.appendChild(logFiltersRow);

        const logList = document.createElement('div');
        logList.id = LOG_LIST_ID;
        logBody.appendChild(logList);

        panel.appendChild(header);
        panel.appendChild(statusEl);
        panel.appendChild(speedRow);
        panel.appendChild(tabBar);
        panel.appendChild(unitsBody);
        panel.appendChild(logBody);

        gameSpeedPercent = normalizeSpeedPercent(s.gameSpeedPercent);
        slowMotionEnabled = s.slowMotionEnabled === true;
        syncTurboBlockFlag();
        if (slowMotionEnabled) suspendTurboForSlowMotion();
        updateSpeedSliderUi();
        switchTab('units');

        let dragging = false;
        let dragX = 0;
        let dragY = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            if (e.target.closest('.resize-handle')) return;
            dragging = true;
            const rect = panel.getBoundingClientRect();
            dragX = e.clientX - rect.left;
            dragY = e.clientY - rect.top;
            document.body.style.userSelect = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const nl = clamp(e.clientX - dragX, 0, window.innerWidth - panel.offsetWidth);
            const nt = clamp(e.clientY - dragY, 0, window.innerHeight - panel.offsetHeight);
            panel.style.left = `${nl}px`;
            panel.style.top = `${nt}px`;
        });
        document.addEventListener('mouseup', () => {
            if (!dragging) return;
            dragging = false;
            document.body.style.userSelect = '';
            savePanelSettings({
                left: parseInt(panel.style.left, 10) || 0,
                top: parseInt(panel.style.top, 10) || 0
            });
        });

        addResizeHandles(panel);
        ensurePanelResizeListeners();
        ensureUnitsBodyListener();
        panel.addEventListener('pointerdown', onPanelPointerDownCapture, true);
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
            updatePanelPosition();
            attachPanelViewportListener();
        }
        panel.style.display = 'flex';
        savePanelSettings({ isOpen: true });
        ensureUnitsBodyListener();
        updateSpeedSliderUi();
        switchTab('units');
        if (isFightActive()) ensureFightTracking();
        if (slowMotionEnabled && isSandboxMode() && isFightActive()) applyTickIntervalToCurrentGame();
        syncPanelFightTickFromSnapshot();
        syncPanelTickTracking();
        renderStatusBar();
        renderUnits(true);
    }

    function closePanel() {
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.style.display = 'none';
        savePanelSettings({ isOpen: false });
        teardownPanelGameTimerSub();
        stopPanelTickPoll();
    }

    function togglePanel() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') openPanel();
        else closePanel();
    }

    function createToolbarButton() {
        if (typeof api !== 'undefined' && api?.ui?.addButton) {
            api.ui.addButton({
                id: BUTTON_ID,
                text: ADVANCED_BUTTON_LABEL,
                tooltip: 'Advanced Analytics panel (units, battle log; speed in Sandbox)',
                primary: false,
                onClick: togglePanel
            });
        }
    }

    function cleanupSandboxPanel() {
        if (typeof api !== 'undefined' && api?.ui?.removeButton) {
            api.ui.removeButton(BUTTON_ID);
        }
        teardownPanelGameTimerSub();
        stopPanelTickPoll();
        resetPanelFightTickState();
        resetTickSpeedToDefault();
        teardownBoardListeners();
        teardownWorldSubscriptions();
        teardownPanelResizeListeners();
        teardownUnitsBodyListener();
        detachPanelViewportListener();
        activeWorld = null;
        resetBattleLogState();
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.remove();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
    }


    function initSandboxPanel() {
        if (!shouldBetterAnalyticsRun()) return;

        const wait = () => {
            if (!shouldBetterAnalyticsRun()) return;
            if (!globalThis.state?.board) {
                setTimeout(wait, 300);
                return;
            }
            const saved = loadPanelSettings();
            gameSpeedPercent = normalizeSpeedPercent(saved.gameSpeedPercent);
            slowMotionEnabled = saved.slowMotionEnabled === true;
            syncTurboBlockFlag();
            if (slowMotionEnabled) suspendTurboForSlowMotion();
            loadCollapsedOverrides();
            loadLogFilters();
            setupBoardListeners();
            setupTickSpeedControl();
            createToolbarButton();
            if (saved.isOpen) openPanel();
            else updateSpeedSliderUi();
            console.log(`[${modName}] Advanced Analytics panel ready`);
        };
        wait();
    }


    // =======================
    // 6. Initialization & Exports
    // =======================
    
    function initBetterAnalytics() {
        setupModCoordination();
        handleBlockingModCoordination();
        setupModLifecycleHandlers();

        if (isPausedForBlockingMod) {
            console.log(`[${modName}] Skipping init - Board Analyzer/Manual Runner is active`);
            return;
        }

        startBetterAnalyticsRuntime();
    }
    
    if (typeof window !== 'undefined' && window.registerMod) {
        window.registerMod({
            name: modName,
            description: modDescription,
            init: initBetterAnalytics,
            cleanup: cleanup
        });
    } else {
        initBetterAnalytics();
    }
    
    if (typeof exports !== 'undefined') {
        exports = {
            initialize: initializeBetterAnalytics,
            calculateDPS: calculateDPS,
            resetTracking: resetTracking,
            cleanup: cleanup,
            startProcessing: startProcessing,
            isCurrentlyProcessing: isCurrentlyProcessing,
            initSandboxPanel: initSandboxPanel,
            cleanupSandboxPanel: cleanupSandboxPanel
        };
    }

})();

