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
    
    // More specific selectors for damage values
    const STATS_CONTAINER_SELECTOR = '.revert-pixel-font-spacing';
    const PORTRAIT_CONTAINER_SELECTOR = '.container-slot';
    
    // Game Mechanics Constants
    const TICKS_PER_SECOND = 16;
    
    // Timing Configuration
    const TIMING = {
        RESTORE_DELAY: 100,
        FINAL_UPDATE_DELAY: 100,
        TAB_SWITCH_DELAY: 25,
        DPS_UPDATE_INTERVAL: 1000
    };
    
    // CSS Classes and Attributes
    const CSS_CLASSES = {
        DPS_DISPLAY: 'better-analytics-dps'
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
    let modCoordinationSetupTimer = null;
    let modCoordinationUnsubscribe = null;
    let modLifecycleHandlersSetup = false;
    let sandboxPanelInitToken = 0;
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

            clearWorldEventSubscriptions();

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
            if (modCoordinationSetupTimer) clearTimeout(modCoordinationSetupTimer);
            modCoordinationSetupTimer = setTimeout(setupModCoordination, 500);
            return;
        }
        modCoordinationSetupTimer = null;
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
        if (modCoordinationSetupTimer) {
            clearTimeout(modCoordinationSetupTimer);
            modCoordinationSetupTimer = null;
        }
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
            const ticks = resolveFightDurationTicks(gameTicks);
            if (!ticks) return;
            refreshAnalyzerDpsDisplays({ frozen: true, fightTicks: ticks });
        }, TIMING.FINAL_UPDATE_DELAY);
    }
    
    function getServerResultFightTicks() {
        try {
            const { serverResults } = globalThis.state.board.getSnapshot().context;
            const ticks = serverResults?.rewardScreen?.gameTicks;
            return typeof ticks === 'number' && ticks > 0 ? ticks : null;
        } catch {
            return null;
        }
    }

    function resolveFightDurationTicks(explicitTicks = null) {
        if (typeof explicitTicks === 'number' && explicitTicks > 0) return explicitTicks;

        const serverTicks = getServerResultFightTicks();
        if (serverTicks != null) return serverTicks;

        const sharedTick = getCurrentTick();
        if (sharedTick != null && sharedTick > 0) return sharedTick;

        try {
            if (gameStartTick != null) {
                const currentTick = globalThis.state.gameTimer.getSnapshot().context.currentTick;
                const elapsed = currentTick - gameStartTick;
                if (elapsed > 0) return elapsed;
            }
        } catch { /* ignore */ }

        return null;
    }

    function getCurrentGameTicks() {
        return resolveFightDurationTicks();
    }

    function parseAnalyzerEntry(damageValueElement, index) {
        if (!isValidDamageElement(damageValueElement)) return null;

        const damageText = damageValueElement.textContent.trim();
        const damageValue = parseInt(damageText.replace(/[^\d]/g, ''), 10) || 0;
        const parentContainer = damageValueElement.closest('li');
        const portraitImg = parentContainer?.querySelector('img[alt="creature"]');
        const creatureKey = portraitImg
            ? portraitImg.src.split('/').pop().replace('.png', '')
            : `creature_${index}`;

        return {
            damageText,
            damageValue,
            creatureKey,
            isHeal: damageText.includes('+')
        };
    }

    function calculateDPSFromDamage(damage, fightTicks) {
        if (!damage || damage <= 0) return 0;
        const ticks = resolveFightDurationTicks(fightTicks);
        if (!ticks || ticks <= 0) return 0;
        return Math.round((damage / ticks) * TICKS_PER_SECOND * 100) / 100;
    }

    function ensureAnalyzerDpsDisplay(damageValueElement) {
        let dpsDisplay = damageValueElement.parentNode.querySelector(`.${CSS_CLASSES.DPS_DISPLAY}`);
        if (!dpsDisplay) {
            dpsDisplay = createDPSDisplayElement();
            damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
        }
        return dpsDisplay;
    }

    function renderAnalyzerDpsDisplay(damageValueElement, index, options = {}) {
        const entry = parseAnalyzerEntry(damageValueElement, index);
        if (!entry) return;

        const dpsDisplay = ensureAnalyzerDpsDisplay(damageValueElement);
        const frozen = options.frozen === true;

        if (entry.isHeal) {
            dpsDisplay.textContent = '(0/s)';
            dpsDisplay.style.opacity = '0.7';
            dpsDisplay.style.fontStyle = 'italic';
            dpsDisplay.removeAttribute('title');
            return;
        }

        const dps = calculateDPSFromDamage(entry.damageValue, options.fightTicks);
        dpsDisplay.textContent = `(${dps}/s)`;
        dpsDisplay.style.opacity = frozen ? '0.7' : '1';
        dpsDisplay.style.fontStyle = frozen ? 'italic' : 'normal';
        dpsDisplay.removeAttribute('title');

        if (!damageTrackingData.has(entry.creatureKey)) {
            damageTrackingData.set(entry.creatureKey, { totalDamage: 0 });
        }
        damageTrackingData.get(entry.creatureKey).totalDamage = entry.damageValue;
    }

    function refreshAnalyzerDpsDisplays(options = {}) {
        const analyzerPanel = getAnalyzerPanel();
        if (!analyzerPanel) return;

        const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
        damageValueElements.forEach((el, index) => {
            renderAnalyzerDpsDisplay(el, index, options);
        });
    }

    function scheduleServerResultDpsRetry() {
        const boardState = globalThis.state.board.getSnapshot();
        const mode = boardState.context?.mode;
        if (mode !== 'autoplay' && mode !== 'manual') return;
        if (getServerResultFightTicks() != null) return;

        let retryAttempts = 0;
        const maxRetries = 20;
        const baseInterval = 100;

        const retry = () => {
            retryAttempts++;
            const serverTicks = getServerResultFightTicks();
            if (serverTicks != null) {
                refreshAnalyzerDpsDisplays({ frozen: true, fightTicks: serverTicks });
                return;
            }
            if (retryAttempts < maxRetries) {
                setTimeout(retry, baseInterval + (retryAttempts * 50));
            }
        };

        setTimeout(retry, baseInterval);
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
        clearWorldEventSubscriptions();
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
        const fightTicks = resolveFightDurationTicks();
        refreshAnalyzerDpsDisplays({
            frozen: true,
            fightTicks: fightTicks ?? undefined
        });
        scheduleServerResultDpsRetry();
    }
    
    function startDamageTracking() {
        if (isTracking) return;
        
        const boardState = globalThis.state.board.getSnapshot();
        const timerState = globalThis.state.gameTimer.getSnapshot();
        
        if (!boardState.context.gameStarted) {
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
            resetTracking();
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
        
        const finalTicks = resolveFightDurationTicks();
        if (finalTicks != null) {
            updateFinalDPSWithGameTicks(finalTicks);
        } else {
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
        refreshAnalyzerDpsDisplays({ frozen: false });
    }

    function calculateDPS(creatureId, currentDamage, gameTicks = null) {
        return calculateDPSFromDamage(currentDamage, gameTicks);
    }

    function updateDPSDisplay() {
        const boardState = globalThis.state.board.getSnapshot();
        const gameMode = boardState.context?.mode;
        const fightEnded = !boardState.context?.gameStarted;
        const serverTicks = getServerResultFightTicks();

        if (!isTracking && !fightEnded && gameMode !== 'autoplay' && gameMode !== 'manual') {
            return;
        }

        refreshAnalyzerDpsDisplays({
            frozen: fightEnded || serverTicks != null,
            fightTicks: serverTicks ?? undefined
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
        if (!analyzerPanel) return;

        analyzerPanel.querySelectorAll('span.font-outlined-fill').forEach((damageValueElement, index) => {
            if (!parseAnalyzerEntry(damageValueElement, index)) return;
            const dpsDisplay = ensureAnalyzerDpsDisplay(damageValueElement);
            dpsDisplay.textContent = '(0/s)';
            dpsDisplay.style.opacity = '0.7';
            dpsDisplay.style.fontStyle = 'italic';
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

    function unsubscribeAll(subs) {
        for (const sub of subs || []) {
            try {
                if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
            } catch { /* ignore */ }
        }
    }

    function clearWorldEventSubscriptions() {
        unsubscribeAll(worldEventSubscriptions);
        worldEventSubscriptions = [];
    }
    
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
            console.error(`[${modName}] Error cleaning up DPS displays:`, error);
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

    const t = (key) => {
        if (typeof api !== 'undefined' && api.i18n && api.i18n.t) {
            return api.i18n.t(key);
        }
        return key;
    };

    const tReplace = (key, replacements) => {
        let text = t(key);
        if (typeof text !== 'string') return key;
        for (const [placeholder, value] of Object.entries(replacements)) {
            text = text.split(`{${placeholder}}`).join(String(value));
        }
        return text;
    };

    function getModDisplayName() {
        return t('mods.betterAnalytics.modName');
    }

    function getLogFilterLabel(key) {
        return t(`mods.betterAnalytics.logFilters.${key}`);
    }

    function getLogMarkerText(entry) {
        if (entry.marker === 'start') return t('mods.betterAnalytics.logMarkerStart');
        if (entry.endState === 'victory') return t('mods.betterAnalytics.logMarkerVictory');
        if (entry.endState === 'defeat') return t('mods.betterAnalytics.logMarkerDefeat');
        return t('mods.betterAnalytics.logMarkerEnd');
    }
    const UNITS_BODY_ID = 'mod-better-sandbox-units-body';
    const SUMMARY_BODY_ID = 'mod-better-sandbox-summary-body';
    const SUMMARY_CONTENT_ID = 'mod-better-sandbox-summary-content';
    const LOG_BODY_ID = 'mod-better-sandbox-log-body';
    const LOG_LIST_ID = 'mod-better-sandbox-log-list';
    const LOG_SUBTITLE_ID = 'mod-better-sandbox-log-subtitle';
    const LOG_SEARCH_INPUT_ID = 'mod-better-sandbox-log-search-input';
    const TITLE_ID = 'mod-better-sandbox-title';
    const STATUS_ID = 'mod-better-sandbox-status';
    const SPEED_SLIDER_ID = 'mod-better-sandbox-speed-slider';
    const SPEED_VALUE_ID = 'mod-better-sandbox-speed-value';
    const SPEED_SANDBOX_ONLY_ID = 'mod-better-sandbox-speed-sandbox-only';
    const SLOW_MOTION_TOGGLE_ID = 'mod-better-sandbox-slow-motion-toggle';
    const STYLE_ID = 'better-sandbox-styles';
    const STORAGE_KEY = 'betterSandboxPanel';

    const PANEL_TICK_POLL_MS = 50;
    const LIVE_PANEL_UPDATE_MS = 50;
    const LIVE_PANEL_UPDATE_MS_TURBO = 125;
    const UNITS_LIVE_UPDATE_MS = 100;
    const UNITS_LIVE_UPDATE_MS_TURBO = 175;
    const UNITS_BOARD_UPDATE_MS = 300;
    const UNITS_LAG_SLOW_MS = 8;
    const UNITS_LAG_REPORT_MS = 2000;
    const ABILITY_TOOLTIP_REFRESH_MS = 100;
    const SUMMARY_UPDATE_MS = 100;
    const DEFAULT_TICK_INTERVAL_MS = 62.5;
    const DEFAULT_PREVIEW_ATTACK_DELAY_MS = 2000;
    const EQUIPMENT_TIER_BONUSES = {
        1: { hp: 20, ad: 1, ap: 2 },
        2: { hp: 40, ad: 2, ap: 5 },
        3: { hp: 60, ad: 4, ap: 10 },
        4: { hp: 90, ad: 6, ap: 15 },
        5: { hp: 120, ad: 8, ap: 20 }
    };
    const MIN_TICK_INTERVAL_MS = 16;
    const SPEED_MIN_PERCENT = 5;
    const SPEED_MAX_PERCENT = 100;
    const SPEED_STEP_PERCENT = 5;
    const LOG_FILTER_ORDER = [
        'allyDmg',
        'allyHeal',
        'allyStats',
        'allyStatus',
        'allyPathing',
        'villainDmg',
        'villainHeal',
        'villainStats',
        'villainStatus',
        'villainPathing'
    ];
    const LOG_FILTER_GROUPS = [
        {
            keys: ['allyDmg', 'allyHeal', 'allyStats', 'allyStatus', 'allyPathing'],
            teamClass: 'filter-ally'
        },
        {
            keys: ['villainDmg', 'villainHeal', 'villainStats', 'villainStatus', 'villainPathing'],
            teamClass: 'filter-enemy'
        }
    ];
    const LOG_FILTER_DEFAULTS = Object.fromEntries(LOG_FILTER_ORDER.map((k) => [k, true]));
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
    const STAT_ICONS = (() => {
        const fallback = {
            hp: '/assets/icons/heal.png',
            ad: '/assets/icons/attackdamage.png',
            ap: '/assets/icons/abilitypower.png',
            armor: '/assets/icons/armor.png',
            magicResist: '/assets/icons/magicresist.png',
            speed: '/assets/icons/speed.png'
        };
        const config = window.creatureDatabase?.MONSTER_STAT_DISPLAY_CONFIG;
        if (!Array.isArray(config) || !config.length) return fallback;
        const icons = { ...fallback };
        for (const entry of config) {
            if (entry?.key && entry?.icon) icons[entry.key] = entry.icon;
        }
        return icons;
    })();
    const STAT_GRID_ROWS = [
        ['hp', 'armor'],
        ['ad', 'magicResist'],
        ['ap', 'speed']
    ];
    const STAT_CHANGE_TRACK_KEYS = [
        ...STAT_KEYS,
        { key: 'hpMax', label: 'HP max' },
        { key: 'level', label: 'Lvl' },
        { key: 'attackDelayTicks', label: 'Atk delay' },
        { key: 'abilityCdTicks', label: 'Ability CD' }
    ];
    const TICK_STAT_TRACK_KEYS = new Set(['attackDelayTicks', 'abilityCdTicks']);
    const STAT_LOWER_IS_BETTER = new Set(['attackDelayTicks', 'abilityCdTicks']);

    let activeWorld = null;
    let panelGameTimerSub = null;
    let panelTickPollTimer = null;
    let panelFightTick = null;
    let panelFightTickFrozen = null;
    let panelFightEndState = null;
    let panelFightSeedFrozen = null;
    let panelTickRevision = 0;
    let lastPanelSyncedEngineTick = null;
    let lastGameTimerFightState = null;
    let boardUnsubs = [];
    const boardTrack = { roomId: null, floor: null, gameStarted: false, mode: null, configSig: '' };
    const previewMechanicsLogSig = new Map();
    const previewMechanicsResultCache = new Map();
    const metadataUntimedCooldownCache = new Map();
    const unitsLagStats = { counts: new Map(), ms: new Map(), lastReport: 0 };
    let cachedBoardPreviewUnits = null;
    let cachedBoardPreviewSig = '';
    let cachedRefreshedBoardPreviewUnits = null;
    let cachedRefreshedBoardPreviewSig = '';
    const cachedEquipStatBonusBySig = new Map();
    let lastBoardAbilityPollMs = 0;
    const BOARD_ABILITY_POLL_PENDING_MS = 150;
    let worldEventSubs = [];
    let battleLog = [];
    let battleLogRevision = 0;
    let lastRenderedBattleLogRevision = 0;
    let lastScrolledBattleLogRevision = 0;
    let lastRenderedLogSignature = '';
    let lastRenderedVisibleCount = 0;
    let lastRenderedFilterSig = '';
    let battleLogRenderScheduled = false;
    let lastSummaryUpdateMs = 0;
    let summaryUpdateTimer = null;
    let cachedPreparedBattleLogSummary = null;
    let cachedPreparedBattleLogSummaryKey = '';
    let cachedVisibleBattleLog = null;
    let cachedVisibleBattleLogRevision = -1;
    let cachedVisibleBattleLogFilterSig = '';
    let cachedActorSnapshots = null;
    let cachedActorSnapshotsTick = null;
    let actorSnapshotCacheGen = 0;
    const actorSnapshotCache = new WeakMap();
    let lastLivePanelUpdateMs = 0;
    let lastStatusBarSignature = '';
    let lastUnitStatusByKey = new Map();
    let battleLogTracking = false;
    let battleLogSessionEnded = false;
    let lastStatusPollTick = -1;
    let lastStatTrackMs = 0;
    const statusLogDedupe = new Set();
    const statLogDedupe = new Set();
    const lastActorStatsByActor = new WeakMap();
    const damageLogDedupe = new Set();
    const abilityCastLogDedupe = new Set();
    const deathLogDedupe = new Set();
    const pathLogDedupe = new Set();
    const lastActorTileByActor = new WeakMap();
    let logFilters = { ...LOG_FILTER_DEFAULTS };
    let logSearchQuery = '';
    let activeTab = 'units';
    let gameSpeedPercent = 100;
    let slowMotionEnabled = false;
    let tickSpeedSubscription = null;
    let turboSuspendedForSlowMotion = false;
    let gameIdByNameCache = null;
    let collapsedOverrides = new Map();
    let openAbilityOverrides = new Map();
    const abilityTooltipRefreshTimers = new WeakMap();
    const abilityScalingSubs = new WeakMap();
    const ABILITY_SCALING_STAT_KEYS = ['ap', 'ad', 'hp'];
    const UNITS_LIVE_STAT_INVALIDATE_KEYS = new Set([
        'hp', 'hpMax', 'ad', 'ap', 'armor', 'magicResist', 'speed',
        'attackDelayTicks', 'abilityCdTicks'
    ]);
    let unitsInteractUntil = 0;
    let lastUnitsRenderKey = '';
    let lastUnitsLiveUpdateMs = 0;
    let lastUnitsMechanicsPollSig = '';
    let lastUnitsMechanicsProbeTick = null;
    let actorUnitsMechanicsSubs = new Map();
    let unitsMechanicsPatchTimer = null;
    let unitsStatsPatchTimer = null;
    const UNITS_INTERACT_FREEZE_MS = 10;
    let pendingUnitsForceRefresh = false;
    const fightActorCollapseKeys = new WeakMap();
    let fightActorInstanceSeq = 0;
    let cachedSpawnTileKeyLookup = null;
    let panelResizeMouseMoveHandler = null;
    let panelResizeMouseUpHandler = null;
    let panelDragMouseMoveHandler = null;
    let panelDragMouseUpHandler = null;
    let panelViewportListenerAttached = false;
    let unitsBodyClickHandler = null;
    let unitsBodyAbilityToggleHandler = null;

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

    const panelDragState = {
        dragging: false,
        dragX: 0,
        dragY: 0,
        panel: null,
        reset() {
            this.dragging = false;
            this.dragX = 0;
            this.dragY = 0;
            this.panel = null;
        }
    };

    function normalizeLogFilters(saved) {
        const merged = { ...LOG_FILTER_DEFAULTS };
        if (!saved || typeof saved !== 'object') return merged;

        if ('statChanges' in saved) {
            merged.allyStats = saved.statChanges !== false;
            merged.villainStats = saved.statChanges !== false;
        }
        if ('statusFx' in saved) {
            merged.allyStatus = saved.statusFx !== false;
            merged.villainStatus = saved.statusFx !== false;
        }
        if ('pathing' in saved) {
            merged.allyPathing = saved.pathing !== false;
            merged.villainPathing = saved.pathing !== false;
        }

        for (const key of LOG_FILTER_ORDER) {
            if (key in saved) merged[key] = saved[key] !== false;
        }
        return merged;
    }

    function normalizeActiveTab(tab) {
        if (tab === 'summary' || tab === 'units' || tab === 'log') return tab;
        return 'units';
    }

    function loadPanelSettings() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return { ...PANEL_DEFAULTS, logFilters: { ...LOG_FILTER_DEFAULTS } };
            const parsed = JSON.parse(raw);
            return {
                ...PANEL_DEFAULTS,
                ...parsed,
                activeTab: normalizeActiveTab(parsed.activeTab),
                logFilters: normalizeLogFilters(parsed.logFilters)
            };
        } catch {
            return { ...PANEL_DEFAULTS, logFilters: { ...LOG_FILTER_DEFAULTS } };
        }
    }

    function loadLogFilters() {
        logFilters = normalizeLogFilters(loadPanelSettings().logFilters);
    }

    function saveLogFilters() {
        savePanelSettings({ logFilters: { ...logFilters } });
    }

    function loadCollapsedOverrides() {
        collapsedOverrides = new Map();
    }

    function clearCollapsedOverrides() {
        if (!collapsedOverrides.size) return;
        collapsedOverrides.clear();
        lastUnitsRenderKey = '';
        pendingUnitsForceRefresh = true;
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
            if (isPanelOpen()) resumeBattleLogActorPatches();
            if (slowMotionEnabled && isSandboxMode()) applyTickIntervalToWorld(activeWorld);
            return;
        }
        teardownWorldSubscriptions();
        activeWorld = w;
        registerFightActorCollapseKeys(activeWorld);
        setupWorldSubscriptions(activeWorld);
        setupUnitsMechanicsSubscriptions(activeWorld);
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

    function hasCreatureAwakenFlags(source) {
        if (!source || typeof source !== 'object') return false;
        return source.awaken === true || source.awakened === true || source.isAwakened === true;
    }

    function isInventoryMonsterAwakened(monster) {
        if (!monster) return false;
        if (hasCreatureAwakenFlags(monster)) return true;
        const tier = Number(monster.tier ?? monster.tierLevel ?? monster.starTier);
        return Number.isFinite(tier) && tier >= 6;
    }

    function isBoardPlayerPieceAwakened(piece, inventoryMonster) {
        if (hasCreatureAwakenFlags(piece, piece?.monster, inventoryMonster)) return true;
        const pieceTier = Number(piece?.tier);
        if (piece?.type === 'player' && Number.isFinite(pieceTier) && pieceTier === 5) return true;
        return isInventoryMonsterAwakened(inventoryMonster);
    }

    function findBoardPlayerPieceForActor(actor) {
        if (!actor || actor.villain === true) return null;
        const tile = actor.position?.tile?.index ?? actor.position?.tileIndex ?? null;
        const databaseId = actor.databaseId ?? actor.monsterDatabaseId ?? actor.monsterId ?? null;
        const config = getBoardContext()?.boardConfig;
        if (!Array.isArray(config)) return null;

        for (const piece of config) {
            if (piece?.type !== 'player') continue;
            const pieceTile = resolveBoardPieceTileIndex(piece);
            const pieceDb = piece.databaseId ?? piece.monsterId;
            const tileMatch = tile != null && pieceTile === tile;
            const dbMatch = databaseId != null && pieceDb != null && String(pieceDb) === String(databaseId);
            if (tileMatch || dbMatch) return piece;
        }
        return null;
    }

    function resolveActorAwakened(actor) {
        if (!actor) return false;
        if (hasCreatureAwakenFlags(actor)) return true;
        const tier = Number(actor.tier ?? actor.tierLevel ?? actor.starTier);
        if (Number.isFinite(tier) && tier >= 6) return true;

        if (actor.villain !== true) {
            const boardPiece = findBoardPlayerPieceForActor(actor);
            if (boardPiece) {
                const inventoryMonster = resolvePlayerMonsterByDatabaseId(
                    boardPiece.databaseId ?? boardPiece.monsterId
                );
                if (isBoardPlayerPieceAwakened(boardPiece, inventoryMonster)) return true;
            }
            const databaseId = actor.databaseId ?? actor.monsterDatabaseId ?? actor.monsterId ?? null;
            if (databaseId != null && isInventoryMonsterAwakened(resolvePlayerMonsterByDatabaseId(databaseId))) {
                return true;
            }
        }

        return actor.awaken === true;
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
            const equipId = p?.equipId
                ?? p?.equip?.id
                ?? p?.equip?.gameId
                ?? p?.equipment?.id
                ?? p?.equipment?.gameId
                ?? '';
            const equipTier = p?.equip?.tier ?? p?.equipmentTier ?? p?.equipment?.tier ?? '';
            const equipStat = p?.equip?.stat ?? p?.equipmentStat ?? p?.equipment?.stat ?? '';
            return `${p?.type ?? ''}:${id}:${p?.villain === true}:${tile}:${p?.level ?? ''}:${p?.key ?? ''}:${equipId}:${equipTier}:${equipStat}`;
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
        let needsUnitsRebuild = false;
        const roomId = resolveCurrentRoomId();
        const floor = resolveCurrentFloor();
        const gameStarted = ctx.gameStarted === true;
        const mode = ctx.mode ?? null;
        const configSig = getBoardConfigSignature(ctx.boardConfig);

        if (floor !== boardTrack.floor) {
            boardTrack.floor = floor;
            cachedSpawnTileKeyLookup = null;
            invalidateBoardPreviewCache();
            lastUnitsRenderKey = '';
            changed = true;
            needsUnitsRebuild = true;
        }

        if (roomId !== boardTrack.roomId) {
            boardTrack.roomId = roomId;
            teardownWorldSubscriptions();
            activeWorld = null;
            resetBattleLogState();
            clearCollapsedOverrides();
            cachedSpawnTileKeyLookup = null;
            invalidateBoardPreviewCache();
            lastUnitsRenderKey = '';
            changed = true;
            needsUnitsRebuild = true;
        }

        if (gameStarted !== boardTrack.gameStarted) {
            boardTrack.gameStarted = gameStarted;
            changed = true;
            if (!gameStarted) {
                const endWorld = getActiveWorld() || ctx.world;
                if (isBattleLogTracking() && panelFightTickFrozen == null) {
                    freezePanelFightTickFromEngine(endWorld);
                } else {
                    syncPanelFightTickFromSnapshot();
                }
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
                resetBattleLogState();
                if (ctx.world) {
                    ensureFightTracking(ctx.world);
                }
            }
            syncPanelTickTracking();
        } else if (gameStarted && ctx.world && ctx.world !== activeWorld) {
            resetPanelFightTickState();
            resetBattleLogState();
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
            invalidateBoardPreviewCache({ clearMechanicsLog: true });
            lastUnitsRenderKey = '';
            changed = true;
            needsUnitsRebuild = true;
        }

        if (changed) {
            invalidateBoardPreviewCache();
            lastUnitsRenderKey = '';
            if (needsUnitsRebuild) pendingUnitsForceRefresh = true;
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
        const sandboxOnlyEl = document.getElementById(SPEED_SANDBOX_ONLY_ID);
        const toggle = document.getElementById(SLOW_MOTION_TOGGLE_ID);
        const sandbox = isSandboxMode();
        const sliderActive = slowMotionEnabled && sandbox;

        if (toggle) toggle.checked = slowMotionEnabled;
        if (slider) slider.value = String(gameSpeedPercent);
        const sliderWrap = document.getElementById('mod-better-sandbox-speed-slider-wrap');
        if (sliderWrap) sliderWrap.classList.toggle('disabled', !sliderActive);
        if (valueEl) {
            if (slowMotionEnabled) {
                const factor = getSandboxSpeedFactor();
                valueEl.textContent = `${gameSpeedPercent}% (${factor.toFixed(2)}×)`;
                valueEl.style.display = '';
            } else {
                valueEl.textContent = '';
                valueEl.style.display = 'none';
            }
        }
        if (sandboxOnlyEl) sandboxOnlyEl.style.display = sandbox ? 'none' : 'block';
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
        panelFightSeedFrozen = null;
        panelTickRevision = 0;
        lastPanelSyncedEngineTick = null;
        lastUnitsMechanicsProbeTick = null;
        invalidateActorSnapshotsCache();
        invalidateActorProbeCache();
        lastGameTimerFightState = getGameTimerFightState();
        lastStatusBarSignature = '';
    }

    function isGameTimerEndState(state) {
        return state === 'victory' || state === 'defeat';
    }

    function syncGameTimerFightStateTracking(state) {
        lastGameTimerFightState = state ?? getGameTimerFightState();
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

    /** Engine tick for live fight probes — never use gameTimer.currentTick (stays 0 in manual fights). */
    function resolveLiveEngineTick(world) {
        return readTickFromEngine(world ?? getActiveWorld());
    }

    function resolveEngineTick(context, world) {
        const engineTick = readTickFromEngine(world);
        if (isLiveFightTracking()) {
            if (engineTick != null) return engineTick;
        }
        const fromTimer = context?.currentTick;
        if (typeof fromTimer === 'number' && Number.isFinite(fromTimer)) {
            // Manual/autoplay: gameTimer.currentTick stays 0 for the whole fight.
            if (fromTimer > 0 || engineTick == null) return fromTimer;
        }
        return engineTick;
    }

    function resolveFightEndTick(world) {
        const serverTicks = getServerResultFightTicks();
        if (serverTicks != null) return serverTicks;
        const engineTick = readTickFromEngine(world);
        if (engineTick != null) return engineTick;
        const fromTimer = globalThis.state?.gameTimer?.getSnapshot?.()?.context?.currentTick;
        if (typeof fromTimer === 'number' && Number.isFinite(fromTimer) && fromTimer > 0) {
            return fromTimer;
        }
        return null;
    }

    function resolvePanelFightEndState(options = {}) {
        if (options.endState === 'victory' || options.endState === 'defeat') {
            return options.endState;
        }
        const timerState = options.gameTimerState ?? getGameTimerFightState();
        if (timerState === 'victory' || timerState === 'defeat') {
            return timerState;
        }
        try {
            const victory = getBoardContext()?.serverResults?.rewardScreen?.victory;
            if (typeof victory === 'boolean') {
                return victory ? 'victory' : 'defeat';
            }
        } catch { /* ignore */ }
        const winner = options.winner;
        if (winner === 'nonVillains') return 'victory';
        if (typeof winner === 'string' && winner !== 'nonVillains' && /villain/i.test(winner)) {
            return 'defeat';
        }
        return null;
    }

    function getGameTimerFightState() {
        try {
            return globalThis.state?.gameTimer?.getSnapshot?.()?.context?.state ?? null;
        } catch {
            return null;
        }
    }

    function getPanelTickRenderKey() {
        return `${panelTickRevision}|${panelFightTickFrozen ?? panelFightTick ?? 'x'}|${panelFightEndState ?? ''}`;
    }

    function getPreparedBattleLogSummaryCacheKey() {
        return `${battleLogRevision}:${getPanelTickRenderKey()}`;
    }

    function isPanelFightResolved() {
        return panelFightEndState === 'victory' || panelFightEndState === 'defeat';
    }

    function isLiveFightTracking() {
        return isFightActive() && panelFightEndState == null && panelFightTickFrozen == null;
    }

    function readFightTickEnginePlaying(world) {
        const w = world ?? getActiveWorld();
        try {
            const store = w?.tickEngine?.isPlayingStore;
            if (!store) return true;
            if (typeof store.getSnapshot === 'function') return store.getSnapshot() === true;
            if (typeof store.get === 'function') return store.get() === true;
        } catch { /* ignore */ }
        return true;
    }

    /** Buff/debuff chips are transient combat UI — only while ticks are actively advancing. */
    function shouldShowLiveStatusEffects() {
        return isLiveFightTracking() && readFightTickEnginePlaying();
    }

    function refreshUnitsAfterStatusVisibilityChange() {
        invalidateActorSnapshotsCache();
        invalidateActorProbeCache();
        lastUnitsRenderKey = '';
        if (activeTab === 'units' && isPanelOpen()) renderUnits(true);
    }

    /** Cached panel tick — updated only via syncPanelTick / freezePanelFightTickFromEngine. */
    function getFightTick() {
        if (panelFightTickFrozen != null) return panelFightTickFrozen;
        return panelFightTick;
    }

    function syncPanelTick(context, options = {}) {
        if (panelFightTickFrozen != null) return false;
        const engineTick = resolveEngineTick(context);
        if (engineTick == null) return false;
        if (!options.force && engineTick === lastPanelSyncedEngineTick) return false;
        lastPanelSyncedEngineTick = engineTick;
        if (isLiveFightTracking()) panelFightTick = engineTick;
        panelTickRevision++;
        invalidatePreparedBattleLogSummaryCache();
        return true;
    }

    function syncPanelFightTickFromSnapshot() {
        try {
            const state = getGameTimerFightState();
            syncGameTimerFightStateTracking(state);
            if (!isGameTimerEndState(state) && isFightActive()) return;
            if (panelFightTickFrozen != null && isPanelFightResolved()) return;
            // Ignore stale victory/defeat on the timer during an active log session.
            if (isBattleLogTracking() && isFightActive()) return;
            freezePanelFightTickFromEngine();
        } catch { /* ignore */ }
    }

    function freezePanelFightTickFromEngine(world, options = {}) {
        if (panelFightEndState == null) {
            const resolved = resolvePanelFightEndState(options);
            if (resolved) panelFightEndState = resolved;
        }
        if (panelFightTickFrozen == null) {
            const finalTick = resolveFightEndTick(world) ?? panelFightTick;
            if (finalTick != null) {
                panelFightTick = finalTick;
                panelFightTickFrozen = finalTick;
                lastPanelSyncedEngineTick = finalTick;
            }
        }
        if (panelFightSeedFrozen == null) {
            panelFightSeedFrozen = getSeed();
        }
        panelTickRevision++;
        invalidatePreparedBattleLogSummaryCache();
        tryEndBattleLogSession();
        syncPanelTickTracking();
        refreshUnitsAfterStatusVisibilityChange();
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
        if (panelFightTickFrozen != null || !isLiveFightTracking()) {
            stopPanelTickPoll();
            return;
        }
        const ctx = globalThis.state?.gameTimer?.getSnapshot?.()?.context;
        const tickChanged = syncPanelTick(ctx);
        if (tickChanged) {
            if (activeTab === 'units' && isFightActive()) {
                patchUnitsLiveMechanicsIfNeeded();
            }
            notifyPanelTickConsumers();
        }
    }

    function startPanelTickPoll() {
        stopPanelTickPoll();
        pollPanelFightTick();
        panelTickPollTimer = setInterval(pollPanelFightTick, PANEL_TICK_POLL_MS);
    }

    function isTurboAccelerated() {
        return window.__turboState?.active === true && !slowMotionEnabled;
    }

    function getLivePanelUpdateIntervalMs() {
        return isTurboAccelerated() ? LIVE_PANEL_UPDATE_MS_TURBO : LIVE_PANEL_UPDATE_MS;
    }

    function getUnitsLiveUpdateIntervalMs() {
        return isTurboAccelerated() ? UNITS_LIVE_UPDATE_MS_TURBO : UNITS_LIVE_UPDATE_MS;
    }

    function getUnitsRenderIntervalMs() {
        return isFightActive() ? getUnitsLiveUpdateIntervalMs() : UNITS_BOARD_UPDATE_MS;
    }

    function recordUnitsLag(label, elapsedMs) {
        if (activeTab !== 'units') return;
        unitsLagStats.counts.set(label, (unitsLagStats.counts.get(label) || 0) + 1);
        unitsLagStats.ms.set(label, (unitsLagStats.ms.get(label) || 0) + elapsedMs);
        if (elapsedMs >= UNITS_LAG_SLOW_MS) {
            console.log(`[${modName}][UnitsLag] slow ${label}: ${elapsedMs.toFixed(1)}ms`);
        }
        reportUnitsLagSummary();
    }

    function reportUnitsLagSummary() {
        const now = performance.now();
        if (now - unitsLagStats.lastReport < UNITS_LAG_REPORT_MS) return;
        unitsLagStats.lastReport = now;
        const rows = [...unitsLagStats.ms.entries()]
            .map(([label, ms]) => ({
                label,
                ms,
                count: unitsLagStats.counts.get(label) || 0
            }))
            .filter((row) => row.count > 0)
            .sort((a, b) => b.ms - a.ms);
        if (!rows.length) return;
        const summary = rows
            .map((row) => `${row.label}: ${row.count}x ${row.ms.toFixed(0)}ms`)
            .join(' | ');
        console.log(`[${modName}][UnitsLag] summary: ${summary}`);
        unitsLagStats.counts.clear();
        unitsLagStats.ms.clear();
    }

    function profileUnitsLag(label, fn) {
        const start = performance.now();
        try {
            return fn();
        } finally {
            recordUnitsLag(label, performance.now() - start);
        }
    }

    function shouldThrottleUnitsRender(force) {
        if (force || activeTab !== 'units') return false;
        const now = performance.now();
        const minMs = getUnitsRenderIntervalMs();
        if (now - lastUnitsLiveUpdateMs < minMs) return true;
        lastUnitsLiveUpdateMs = now;
        return false;
    }

    function shouldThrottleUnitsLiveRender(force) {
        return shouldThrottleUnitsRender(force);
    }

    function patchUnitsLiveMechanicsIfNeeded(force = false) {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;
        const body = document.getElementById(UNITS_BODY_ID);
        if (!body?.querySelector('.bs-units-columns')) return;

        const world = getActiveWorld();
        const probeTick = resolveLiveEngineTick(world);
        if (!force && probeTick != null && probeTick === lastUnitsMechanicsProbeTick) return;
        lastUnitsMechanicsProbeTick = probeTick;

        const units = collectActorMechanicsSnapshots() || [];
        if (!units.length) return;

        profileUnitsLag('patchUnitsMechanics', () => {
            patchUnitCardsMechanicsOnly(body, units);
        });
    }

    function scheduleUnitsMechanicsPatch() {
        if (activeTab !== 'units' || !isFightActive()) return;
        if (unitsMechanicsPatchTimer != null) return;
        unitsMechanicsPatchTimer = setTimeout(() => {
            unitsMechanicsPatchTimer = null;
            patchUnitsLiveMechanicsIfNeeded(true);
        }, 0);
    }

    function subscribeCooldownComponentUpdates(cd, callback, subs) {
        if (cd && typeof cd.subscribe === 'function') {
            subs.push(cd.subscribe(callback));
        }
    }

    function scheduleUnitsLiveStatsPatch() {
        if (activeTab !== 'units' || !isFightActive()) return;
        if (unitsStatsPatchTimer != null) return;
        unitsStatsPatchTimer = setTimeout(() => {
            unitsStatsPatchTimer = null;
            patchUnitsLiveStatsIfNeeded();
        }, 0);
    }

    function patchUnitsLiveStatsIfNeeded() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;
        const body = document.getElementById(UNITS_BODY_ID);
        if (!body?.querySelector('.bs-units-columns')) return;
        invalidateActorSnapshotsCache();
        const units = collectActorSnapshots() || [];
        if (!units.length) return;
        profileUnitsLag('patchUnitCardsLiveStats', () => {
            patchUnitCardsLiveStats(body, units);
        });
    }

    function subscribeActorUnitsMechanics(actor) {
        if (!actor || actorUnitsMechanicsSubs.has(actor)) return;
        const subs = [];
        const onChange = () => {
            delete actor.__bsCooldownComp;
            delete actor.__bsCooldownCompSig;
            scheduleUnitsMechanicsPatch();
        };
        const onResourcesChange = () => syncActorResourceRevision(actor);
        actor.__bsResourcesSig = getActorResourcesSignature(actor);
        subscribeCooldownComponentUpdates(actor.abilityCooldown, onChange, subs);
        subscribeCooldownComponentUpdates(resolveActorAutoAttackCooldown(actor), onChange, subs);
        for (const cd of collectActorAbilityCooldownComponents(actor)) {
            subscribeCooldownComponentUpdates(cd, onChange, subs);
        }
        for (const collection of [actor.renderResources, actor.renderPassives]) {
            subscribeCooldownComponentUpdates(collection, onResourcesChange, subs);
        }
        subscribeCooldownComponentUpdates(actor.onDebuff, () => {
            onResourcesChange();
            scheduleUnitsLiveStatsPatch();
        }, subs);
        subscribeCooldownComponentUpdates(actor.onBuff, () => {
            onResourcesChange();
            scheduleUnitsLiveStatsPatch();
        }, subs);
        if (subs.length) actorUnitsMechanicsSubs.set(actor, subs);
    }

    function teardownActorUnitsMechanicsSubs() {
        for (const subs of actorUnitsMechanicsSubs.values()) {
            unsubscribeAll(subs);
        }
        actorUnitsMechanicsSubs.clear();
        if (unitsMechanicsPatchTimer != null) {
            clearTimeout(unitsMechanicsPatchTimer);
            unitsMechanicsPatchTimer = null;
        }
        if (unitsStatsPatchTimer != null) {
            clearTimeout(unitsStatsPatchTimer);
            unitsStatsPatchTimer = null;
        }
    }

    function setupUnitsMechanicsSubscriptions(world) {
        teardownActorUnitsMechanicsSubs();
        const actors = world?.grid?.actors;
        if (!Array.isArray(actors)) return;
        seedActorStatSnapshots(actors);
        for (const actor of actors) subscribeActorUnitsMechanics(actor);
    }

    function notifyPanelTickConsumers(options = {}) {
        if (isLiveFightTracking()) {
            pollStatusEffectTracking(options.force === true);
        }

        const now = performance.now();
        if (!options.force) {
            const minMs = getLivePanelUpdateIntervalMs();
            if (now - lastLivePanelUpdateMs < minMs) {
                if (activeTab === 'summary') scheduleSummaryTabRender();
                return;
            }
        }

        lastLivePanelUpdateMs = now;
        renderStatusBar();
        const unitsThrottled = shouldThrottleUnitsLiveRender(options.force);
        if (isLiveFightTracking() && getFightTick() != null) {
            if (activeTab !== 'units' || !unitsThrottled) {
                renderLiveFight();
            }
        }
        if (activeTab === 'units' && !unitsThrottled) {
            pollOpenAbilityScalingRefresh();
        }
    }

    function onPanelGameTimerUpdate({ context }) {
        if (!context) return;

        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;

        const gameState = context.state;
        const timerJustEnded = isGameTimerEndState(gameState)
            && !isGameTimerEndState(lastGameTimerFightState);

        if (panelFightTickFrozen == null) {
            if (isBattleLogTracking()) {
                if (timerJustEnded) {
                    freezePanelFightTickFromEngine(undefined, { gameTimerState: gameState });
                }
            } else if (isGameTimerEndState(gameState)) {
                freezePanelFightTickFromEngine(undefined, { gameTimerState: gameState });
            }
        }

        syncGameTimerFightStateTracking(gameState);

        if (isLiveFightTracking()) {
            const tickChanged = syncPanelTick(context, { force: timerJustEnded });
            if (tickChanged || timerJustEnded) {
                if (activeTab === 'units' && isFightActive()) {
                    patchUnitsLiveMechanicsIfNeeded();
                }
                notifyPanelTickConsumers({ force: timerJustEnded });
            }
        } else if (timerJustEnded && panelFightTickFrozen == null) {
            renderStatusBar(true);
        }
    }

    function setupPanelGameTimerSub() {
        const gameTimer = globalThis.state?.gameTimer;
        if (!gameTimer || typeof gameTimer.subscribe !== 'function') return;
        if (panelGameTimerSub) return;

        if (isBattleLogTracking()) {
            syncGameTimerFightStateTracking();
        } else {
            syncPanelFightTickFromSnapshot();
        }
        panelGameTimerSub = gameTimer.subscribe(onPanelGameTimerUpdate);
        const snapshotCtx = gameTimer.getSnapshot?.()?.context;
        if (snapshotCtx && isLiveFightTracking()) {
            syncPanelTick(snapshotCtx, { force: true });
            notifyPanelTickConsumers({ force: true });
        }
    }

    function getBattleLogTick() {
        const tick = getFightTick();
        return tick != null ? tick : 0;
    }

    function getCurrentTick() {
        return getFightTick();
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

    function resolveLogActorIdentity(actor) {
        if (!actor) return null;
        return {
            key: resolveFightCollapseKey(actor),
            name: actorLabel(actor),
            villain: actor.villain === true,
            tile: readActorTileIndex(actor)
        };
    }

    function teamClass(villain) {
        return villain === true ? 'enemy' : 'ally';
    }

    function clearFightActorCollapseRegistry() {
        clearUnitsStatWarnings();
        cachedSpawnTileKeyLookup = null;
        fightActorInstanceSeq = 0;
        invalidateActorProbeCache();
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

    function invalidateActorSnapshotsCache() {
        cachedActorSnapshots = null;
        cachedActorSnapshotsTick = null;
        lastUnitsLiveUpdateMs = 0;
        lastUnitsMechanicsPollSig = '';
        lastUnitsMechanicsProbeTick = null;
    }

    function invalidateActorProbeCache() {
        actorSnapshotCacheGen++;
    }

    function getCachedActorProbe(actor) {
        const entry = actorSnapshotCache.get(actor);
        if (entry && entry.gen === actorSnapshotCacheGen) return entry.snapshot;
        return null;
    }

    function setCachedActorProbe(actor, snapshot) {
        if (!actor || !snapshot) return;
        actorSnapshotCache.set(actor, { gen: actorSnapshotCacheGen, snapshot });
    }

    function bumpActorResourceRevision(actor) {
        if (!actor) return;
        actor.__bsResourceRev = (actor.__bsResourceRev ?? 0) + 1;
    }

    function getActorResourcesSignature(actor) {
        if (!actor) return '';
        const parts = [];
        for (const collection of [actor.renderResources, actor.renderPassives]) {
            for (const resource of readRenderCollectionItems(collection)) {
                if (!isRenderResourceActive(actor, resource)) continue;
                parts.push(resourceEffectId(resource));
            }
        }
        parts.sort();
        return parts.join('|');
    }

    function syncActorResourceRevision(actor) {
        const sig = getActorResourcesSignature(actor);
        if (actor.__bsResourcesSig === sig) return;
        actor.__bsResourcesSig = sig;
        bumpActorResourceRevision(actor);
    }

    function actorSnapshotNeedsStatusRefresh(actor, prev) {
        if (!prev) return true;
        if ((actor.__bsResourceRev ?? 0) !== (prev._resourceRev ?? 0)) return true;
        const stun = actor.stun?.isStunned === true;
        const silenced = actor.silenceComponent?.isSilenced === true;
        const mindControlled = isActorMindControlled(actor);
        if (stun !== (prev._stun === true)) return true;
        if (silenced !== (prev._silenced === true)) return true;
        if (mindControlled !== (prev._mindControlled === true)) return true;
        return false;
    }

    function attachActorSnapshotMeta(snapshot, actor) {
        if (!snapshot || !actor) return snapshot;
        snapshot._resourceRev = actor.__bsResourceRev ?? 0;
        snapshot._stun = actor.stun?.isStunned === true;
        snapshot._silenced = actor.silenceComponent?.isSilenced === true;
        snapshot._mindControlled = isActorMindControlled(actor);
        return snapshot;
    }

    function invalidateVisibleBattleLogCache() {
        cachedVisibleBattleLog = null;
        cachedVisibleBattleLogRevision = -1;
        cachedVisibleBattleLogFilterSig = '';
    }

    function resetBattleLogState() {
        battleLog = [];
        battleLogRevision = 0;
        lastRenderedBattleLogRevision = 0;
        lastScrolledBattleLogRevision = 0;
        lastRenderedLogSignature = '';
        lastRenderedVisibleCount = 0;
        lastRenderedFilterSig = '';
        invalidateVisibleBattleLogCache();
        invalidatePreparedBattleLogSummaryCache();
        invalidateActorSnapshotsCache();
        invalidateActorProbeCache();
        lastUnitStatusByKey.clear();
        lastLivePanelUpdateMs = 0;
        clearSummaryUpdateTimer();
        lastSummaryUpdateMs = 0;
        lastStatusBarSignature = '';
        battleLogTracking = false;
        battleLogSessionEnded = false;
        lastStatusPollTick = -1;
        statusLogDedupe.clear();
        damageLogDedupe.clear();
        abilityCastLogDedupe.clear();
        deathLogDedupe.clear();
        pathLogDedupe.clear();
        statLogDedupe.clear();
    }

    function isBattleLogTracking() {
        return battleLogTracking === true && battleLogSessionEnded !== true;
    }

    function isPanelOpen() {
        const panel = document.getElementById(PANEL_ID);
        return Boolean(panel && panel.style.display !== 'none');
    }

    function shouldPatchBattleLogActors() {
        return isBattleLogTracking() && isPanelOpen();
    }

    function recordBattleMarker(marker, options = {}) {
        const tick = options.tick ?? getCurrentTick() ?? 0;
        battleLog.push({
            tick,
            kind: 'marker',
            marker,
            endState: options.endState || null
        });
        battleLogRevision++;
        scheduleBattleLogRender();
    }

    function startBattleLogSession() {
        if (battleLogTracking) return;
        battleLogTracking = true;
        battleLogSessionEnded = false;
        lastStatusPollTick = -1;
        statusLogDedupe.clear();
        damageLogDedupe.clear();
        abilityCastLogDedupe.clear();
        deathLogDedupe.clear();
        pathLogDedupe.clear();
        statLogDedupe.clear();
        syncGameTimerFightStateTracking();
        recordBattleMarker('start', { tick: getCurrentTick() ?? 0 });
        seedBattleLogStatusSnapshots();
        seedActorStatSnapshots(getActiveWorld()?.grid?.actors);
    }

    function endBattleLogSession(endState) {
        if (!battleLogTracking || battleLogSessionEnded) return;
        battleLogSessionEnded = true;
        battleLogTracking = false;
        const tick = getFightTick() ?? '?';
        recordBattleMarker('end', { tick, endState: endState || null });
        const world = getActiveWorld();
        if (world) unpatchAllActors(world);
        lastUnitStatusByKey.clear();
        lastStatusPollTick = -1;
        statusLogDedupe.clear();
        damageLogDedupe.clear();
        abilityCastLogDedupe.clear();
        deathLogDedupe.clear();
        pathLogDedupe.clear();
        statLogDedupe.clear();
    }

    function tryEndBattleLogSession() {
        if (!battleLogTracking || battleLogSessionEnded) return;
        if (panelFightTickFrozen == null && panelFightEndState == null) return;
        endBattleLogSession(panelFightEndState);
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

    function damageTagsInclude(opts, result, tag) {
        const tags = opts?.tags ?? result?.tags;
        if (!tags) return false;
        if (Array.isArray(tags)) return tags.includes(tag);
        if (typeof tags.has === 'function') return tags.has(tag);
        return false;
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

        if (damageTagsInclude(opts, result, 'autoAttack')) return 'auto attack';
        if (damageTagsInclude(opts, result, 'selfDamage')) return 'effect';

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

        if (damageTagsInclude(opts, result, 'aoe')) return 'ability';
        if (damageTagsInclude(opts, result, 'singleTarget') &&
            !damageTagsInclude(opts, result, 'autoAttack')) {
            return 'ability';
        }

        if (fromActor?.abilityCooldown?.isOnCooldown === true) return 'ability';

        return 'unknown';
    }

    function resolveAbilityNameForLog(fromActor, opts = {}, result = null) {
        const named = pickLogString(
            opts.abilityName,
            opts.skillName,
            opts.ability?.name,
            opts.skill?.name,
            result?.abilityName,
            result?.skillName
        );
        if (named) return named;

        const gameId = resolveGameId(fromActor);
        if (gameId != null) {
            const abilityInfo = getAbilityInfo(gameId);
            if (abilityInfo?.name) return abilityInfo.name;
        }

        const src = pickLogString(
            opts.abilitySrc,
            opts.skillSrc,
            opts.ability?.src,
            opts.skill?.src,
            fromActor?.abilityCooldown?.src,
            result?.abilitySrc,
            result?.skillSrc
        );
        return src || null;
    }

    function resolveActionSourceDisplay(opts = {}, result = null, fromActor = null, isHeal = false) {
        const source = resolveActionSource(opts, result, fromActor, isHeal);
        if (!source || source === 'unknown') return 'unknown';
        if (source !== 'ability') return source;
        return resolveAbilityNameForLog(fromActor, opts, result) || 'ability';
    }

    function getLogEntryFilter(entry) {
        if (entry.kind === 'marker') return 'marker';
        if (entry.kind === 'status') {
            return entry.toVillain === true ? 'villainStatus' : 'allyStatus';
        }
        if (entry.kind === 'pathing') {
            return entry.unitVillain === true ? 'villainPathing' : 'allyPathing';
        }
        if (entry.kind === 'statChange') {
            return entry.unitVillain === true ? 'villainStats' : 'allyStats';
        }
        if (entry.kind === 'abilityCast') {
            return entry.fromVillain ? 'villainDmg' : 'allyDmg';
        }
        if (entry.kind === 'death') {
            return entry.unitVillain ? 'allyDmg' : 'villainDmg';
        }
        if (entry.kind === 'heal') {
            return entry.fromVillain === true ? 'villainHeal' : 'allyHeal';
        }
        if (entry.fromVillain === true) return 'villainDmg';
        if (entry.from === 'Environment' || entry.from === '—') {
            return entry.toVillain ? 'villainDmg' : 'allyDmg';
        }
        return 'allyDmg';
    }

    const LOG_FILTER_ALL_KEY = 'all';

    function isLogFilterShowAll() {
        return LOG_FILTER_ORDER.every((k) => logFilters[k] === true);
    }

    function areAllLogFiltersOff() {
        return LOG_FILTER_ORDER.every((k) => logFilters[k] === false);
    }

    function toggleAllLogFilters() {
        if (isLogFilterShowAll()) {
            for (const k of LOG_FILTER_ORDER) {
                logFilters[k] = false;
            }
        } else {
            Object.assign(logFilters, LOG_FILTER_DEFAULTS);
        }
        saveLogFilters();
        invalidateBattleLogView();
        updateLogFilterUi();
        renderBattleLog(true);
    }

    function debounce(fn, wait) {
        let timer = null;
        return (...args) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                fn(...args);
            }, wait);
        };
    }

    function extractLogSearchQuotedString(condition) {
        const trimmed = String(condition ?? '').trim();
        if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
            return { isExact: true, value: trimmed.slice(1, -1).toLowerCase() };
        }
        return { isExact: false, value: trimmed.toLowerCase() };
    }

    function matchesLogSearchSingleCondition(text, condition) {
        if (!condition) return true;
        const blob = String(text ?? '').toLowerCase();
        const { isExact, value } = extractLogSearchQuotedString(condition);
        if (!value) return true;
        if (isExact) {
            if (value.includes(' ')) return blob.includes(value);
            return blob.split(/[^a-z0-9]+/).includes(value);
        }
        return blob.includes(value);
    }

    function battleLogTextMatchesSearch(text, searchTerm) {
        const term = String(searchTerm ?? '').trim();
        if (!term) return true;
        if (/\s+or\s+/i.test(term)) {
            return term.split(/\s+or\s+/i).some((part) => battleLogTextMatchesSearch(text, part.trim()));
        }
        if (/\s+and\s+/i.test(term)) {
            return term.split(/\s+and\s+/i).every((part) => battleLogTextMatchesSearch(text, part.trim()));
        }
        return matchesLogSearchSingleCondition(text, term);
    }

    function battleLogEntryMatchesSearch(entry, query) {
        const q = (query || '').trim();
        if (!q) return true;
        return battleLogTextMatchesSearch(formatBattleLogEntryForExport(entry), q);
    }

    function isLogEntryFilterVisible(entry) {
        if (entry.kind === 'marker') return true;
        const key = getLogEntryFilter(entry);
        if (isLogFilterShowAll()) return true;
        return logFilters[key] === true;
    }

    function isLogEntryVisible(entry) {
        if (!isLogEntryFilterVisible(entry)) return false;
        return battleLogEntryMatchesSearch(entry, logSearchQuery);
    }

    function getLogFiltersSignature() {
        return LOG_FILTER_ORDER.map((k) => (logFilters[k] ? '1' : '0')).join('');
    }

    function getLogViewSignature() {
        const q = (logSearchQuery || '').trim().toLowerCase();
        return `${getLogFiltersSignature()}:${q}`;
    }

    function invalidateBattleLogView() {
        lastRenderedLogSignature = '';
        lastRenderedVisibleCount = 0;
        lastRenderedFilterSig = '';
        invalidateVisibleBattleLogCache();
    }

    function applyLogSearch() {
        const input = document.getElementById(LOG_SEARCH_INPUT_ID);
        logSearchQuery = (input?.value || '').trim();
        invalidateBattleLogView();
        updateLogToolbarTitle();
        renderBattleLog(true);
    }

    function createBattleLogSearchBar() {
        const searchContainer = document.createElement('div');
        searchContainer.className = 'bs-log-search';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = LOG_SEARCH_INPUT_ID;
        searchInput.placeholder = t('mods.betterAnalytics.searchPlaceholder');
        searchInput.title = t('mods.betterAnalytics.searchTitle');
        searchInput.className = 'bs-log-search-input';
        searchInput.autocomplete = 'off';
        searchInput.autocapitalize = 'off';
        searchInput.spellcheck = false;

        const debouncedApply = debounce(applyLogSearch, 150);
        searchInput.addEventListener('input', debouncedApply);
        searchInput.addEventListener('focus', () => {
            searchInput.classList.add('focused');
        });
        searchInput.addEventListener('blur', () => {
            searchInput.classList.remove('focused');
        });
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                searchInput.value = '';
                applyLogSearch();
            }
        });

        searchContainer.appendChild(searchInput);
        return searchContainer;
    }

    function ensureBattleLogSearchBar() {
        if (document.getElementById(LOG_SEARCH_INPUT_ID)) return;
        const filtersWrap = document.querySelector(`#${PANEL_ID} .bs-log-filters`);
        if (!filtersWrap?.parentNode) return;
        filtersWrap.parentNode.insertBefore(createBattleLogSearchBar(), filtersWrap.nextSibling);
    }

    function ensurePanelTabs() {
        const tabBar = document.querySelector(`#${PANEL_ID} .bs-tab-bar`);
        if (!tabBar) return;

        document.getElementById('mod-better-sandbox-log-summary')?.remove();

        if (!document.getElementById('mod-better-sandbox-tab-summary')) {
            const tabSummaryBtn = document.createElement('button');
            tabSummaryBtn.type = 'button';
            tabSummaryBtn.id = 'mod-better-sandbox-tab-summary';
            tabSummaryBtn.className = 'bs-tab-btn';
            tabSummaryBtn.textContent = t('mods.betterAnalytics.tabSummary');
            tabSummaryBtn.addEventListener('click', () => switchTab('summary'));
            tabBar.appendChild(tabSummaryBtn);
        } else {
            const tabSummary = document.getElementById('mod-better-sandbox-tab-summary');
            if (tabSummary) tabBar.appendChild(tabSummary);
        }

        if (!document.getElementById(SUMMARY_BODY_ID)) {
            const summaryBody = document.createElement('div');
            summaryBody.id = SUMMARY_BODY_ID;
            summaryBody.className = 'bs-body';
            summaryBody.style.display = 'none';
            const content = document.createElement('div');
            content.id = SUMMARY_CONTENT_ID;
            content.className = 'bs-summary-content';
            summaryBody.appendChild(content);
            const logBody = document.getElementById(LOG_BODY_ID);
            if (logBody?.parentNode) logBody.parentNode.appendChild(summaryBody);
        } else {
            const summaryBody = document.getElementById(SUMMARY_BODY_ID);
            const logBody = document.getElementById(LOG_BODY_ID);
            if (summaryBody && logBody?.parentNode) logBody.parentNode.appendChild(summaryBody);
        }
    }

    function ensureSpeedRowUi() {
        const speedRow = document.getElementById('mod-better-sandbox-speed-row');
        if (!speedRow) return;

        document.getElementById('mod-better-sandbox-speed-hint')?.remove();
        speedRow.querySelector('.bs-speed-head')?.remove();

        const toggleRow = speedRow.querySelector('.bs-speed-toggle-row');
        const sliderWrap = document.getElementById('mod-better-sandbox-speed-slider-wrap');
        const valueEl = document.getElementById(SPEED_VALUE_ID);
        if (toggleRow && valueEl) {
            let titleWrap = toggleRow.querySelector('.bs-speed-toggle-text');
            if (!titleWrap) {
                titleWrap = document.createElement('div');
                titleWrap.className = 'bs-speed-toggle-text';
                const label = toggleRow.querySelector('span');
                if (label) {
                    toggleRow.insertBefore(titleWrap, toggleRow.firstChild);
                    titleWrap.appendChild(label);
                }
            }
            if (valueEl.parentNode !== titleWrap) {
                valueEl.className = 'bs-speed-value';
                titleWrap.appendChild(valueEl);
            }
        }

        if (!document.getElementById(SPEED_SANDBOX_ONLY_ID)) {
            const sandboxOnlyNote = document.createElement('span');
            sandboxOnlyNote.className = 'bs-speed-sandbox-only';
            sandboxOnlyNote.id = SPEED_SANDBOX_ONLY_ID;
            sandboxOnlyNote.textContent = t('mods.betterAnalytics.sandboxOnly');
            const titleWrap = toggleRow?.querySelector('.bs-speed-toggle-text');
            const label = titleWrap?.querySelector('span');
            if (titleWrap && label) titleWrap.insertBefore(sandboxOnlyNote, label.nextSibling);
            else if (sliderWrap) speedRow.insertBefore(sandboxOnlyNote, sliderWrap);
            else speedRow.appendChild(sandboxOnlyNote);
        } else {
            const sandboxOnlyNote = document.getElementById(SPEED_SANDBOX_ONLY_ID);
            const titleWrap = toggleRow?.querySelector('.bs-speed-toggle-text');
            const label = titleWrap?.querySelector('span');
            if (sandboxOnlyNote && titleWrap && label && sandboxOnlyNote.parentNode !== titleWrap) {
                titleWrap.insertBefore(sandboxOnlyNote, label.nextSibling);
            }
            if (sandboxOnlyNote?.tagName === 'DIV') {
                const span = document.createElement('span');
                span.className = sandboxOnlyNote.className;
                span.id = sandboxOnlyNote.id;
                span.textContent = sandboxOnlyNote.textContent;
                sandboxOnlyNote.replaceWith(span);
            }
        }
    }

    function toggleLogFilter(filterKey) {
        if (!LOG_FILTER_ORDER.includes(filterKey)) return;

        const allOn = isLogFilterShowAll();
        const onlyThisFilter = LOG_FILTER_ORDER.every(
            (k) => logFilters[k] === (k === filterKey)
        );

        if (allOn) {
            // From show-all, first click isolates one filter.
            for (const k of LOG_FILTER_ORDER) {
                logFilters[k] = k === filterKey;
            }
        } else if (onlyThisFilter) {
            // Clicking the sole active filter restores show-all.
            Object.assign(logFilters, LOG_FILTER_DEFAULTS);
        } else {
            // Multi-select: toggle this filter on/off.
            logFilters[filterKey] = !logFilters[filterKey];
            if (!LOG_FILTER_ORDER.some((k) => logFilters[k])) {
                Object.assign(logFilters, LOG_FILTER_DEFAULTS);
            }
        }

        saveLogFilters();
        invalidateBattleLogView();
        updateLogFilterUi();
        renderBattleLog(true);
    }

    function getBattleLogSubtitleText() {
        const total = battleLog.length;
        const visible = battleLog.filter(isLogEntryVisible).length;
        const showAll = isLogFilterShowAll();
        const parts = [];

        if (!total) {
            parts.push(t('mods.betterAnalytics.subtitleNoEvents'));
        } else if (showAll && !logSearchQuery) {
            parts.push(tReplace('mods.betterAnalytics.subtitleEventsCount', {
                count: total,
                plural: total === 1 ? '' : 's'
            }));
            parts.push(t('mods.betterAnalytics.subtitleAllEventTypes'));
        } else {
            parts.push(tReplace('mods.betterAnalytics.subtitleShown', { visible, total }));
            if (!showAll) {
                const activeCount = LOG_FILTER_ORDER.filter((key) => logFilters[key] === true).length;
                const active = LOG_FILTER_ORDER
                    .filter((key) => logFilters[key] === true)
                    .map((key) => getLogFilterLabel(key));
                parts.push(tReplace('mods.betterAnalytics.subtitleFilters', {
                    activeCount,
                    total: LOG_FILTER_ORDER.length
                }));
                if (active.length) parts.push(active.join(', '));
            }
            if (logSearchQuery) {
                parts.push(tReplace('mods.betterAnalytics.subtitleSearch', { query: logSearchQuery }));
            }
        }

        return parts.join(' · ');
    }

    function updateLogToolbarTitle() {
        const subtitle = document.getElementById(LOG_SUBTITLE_ID);
        if (subtitle) subtitle.textContent = getBattleLogSubtitleText();
    }

    function updateLogFilterUi() {
        const showAll = isLogFilterShowAll();
        const allOff = areAllLogFiltersOff();
        const allBtn = document.getElementById(`mod-better-sandbox-log-filter-${LOG_FILTER_ALL_KEY}`);
        if (allBtn) {
            allBtn.classList.toggle('active', showAll);
            allBtn.title = showAll
                ? t('mods.betterAnalytics.filterAllTitleHideAll')
                : allOff
                    ? t('mods.betterAnalytics.filterAllTitleShowAll')
                    : t('mods.betterAnalytics.filterAllTitleShowAll');
        }
        for (const key of LOG_FILTER_ORDER) {
            const btn = document.getElementById(`mod-better-sandbox-log-filter-${key}`);
            if (btn) {
                btn.classList.toggle('active', logFilters[key] === true);
                btn.title = showAll
                    ? t('mods.betterAnalytics.filterTitleIsolate')
                    : logFilters[key]
                        ? t('mods.betterAnalytics.filterTitleHide')
                        : t('mods.betterAnalytics.filterTitleInclude');
            }
        }
        updateLogToolbarTitle();
    }

    function clearBattleLog() {
        resetBattleLogState();
        renderBattleLog();
    }

    function formatLogDamageAmount(amount, rawAmount) {
        const { applied, showRaw, raw } = resolveLogDamageDisplay(amount, rawAmount, { roundRaw: true });
        if (showRaw) return `${applied} (${raw})`;
        return String(applied);
    }

    function resolveLogDamageDisplay(amount, rawAmount, { roundRaw = true } = {}) {
        const applied = Math.abs(Math.round(amount));
        let raw = rawAmount;
        if (raw != null) {
            const numericRaw = roundRaw ? Math.abs(Math.round(raw)) : Math.abs(raw);
            raw = Number.isFinite(numericRaw) ? numericRaw : null;
        }
        const showRaw = raw != null && raw !== applied;
        return { applied, raw: showRaw ? raw : null, showRaw };
    }

    function recordBattleLogEntry(event) {
        if (!event || !shouldPatchBattleLogActors()) return;
        const points = Number(event.points);
        if (!Number.isFinite(points) || points === 0) return;

        const fromActor = entityToActor(event.from);
        const toActor = entityToActor(event.to)
            || entityToActor(event.entity)
            || entityToActor(event.actor)
            || entityToActor(event.target)
            || entityToActor(event.owner);

        const isHeal = points > 0;
        const tick = getBattleLogTick();
        const from = actorLabel(fromActor, isHeal ? '—' : 'Environment');
        const to = actorLabel(toActor, '—');
        const amount = Math.abs(Math.round(points));
        const rawAmount = !isHeal && event.rawAmount != null
            ? Math.abs(Math.round(Number(event.rawAmount)))
            : null;
        const damageType = event.damageType || (isHeal ? 'heal' : 'physical');
        const dedupeKey = `${tick ?? '?'}|${from}|${to}|${amount}|${rawAmount ?? ''}|${damageType}|${isHeal ? 'heal' : 'dmg'}`;
        if (damageLogDedupe.has(dedupeKey)) return;
        damageLogDedupe.add(dedupeKey);

        battleLog.push({
            tick: tick != null ? tick : '?',
            kind: isHeal ? 'heal' : 'damage',
            from,
            to,
            fromKey: fromActor ? resolveFightCollapseKey(fromActor) : null,
            toKey: toActor ? resolveFightCollapseKey(toActor) : null,
            fromTile: fromActor ? readActorTileIndex(fromActor) : null,
            toTile: toActor ? readActorTileIndex(toActor) : null,
            fromVillain: fromActor?.villain === true,
            toVillain: toActor?.villain === true,
            amount,
            rawAmount: rawAmount != null && rawAmount !== amount ? rawAmount : null,
            overkill: !isHeal && event.overkill > 0 ? Math.abs(Math.round(Number(event.overkill))) : 0,
            damageType,
            actionSource: event.actionSource || (isHeal ? 'heal' : 'unknown'),
            crit: event.crit === true
        });

        battleLogRevision++;
        scheduleBattleLogRender();
    }

    function recordAbilityCastLogEntry(actor) {
        if (!actor || !shouldPatchBattleLogActors()) return;
        const tick = getBattleLogTick();
        const from = actorLabel(actor);
        const abilityName = resolveAbilityNameForLog(actor, {}, null) || 'Ability';
        const dedupeKey = `${tick ?? '?'}|${actor.id ?? from}|${abilityName}|cast`;
        if (abilityCastLogDedupe.has(dedupeKey)) return;
        abilityCastLogDedupe.add(dedupeKey);

        battleLog.push({
            tick: tick != null ? tick : '?',
            kind: 'abilityCast',
            from,
            fromKey: resolveFightCollapseKey(actor),
            fromTile: readActorTileIndex(actor),
            fromVillain: actor.villain === true,
            abilityName
        });

        battleLogRevision++;
        scheduleBattleLogRender();
    }

    function collectActorAbilityCooldownComponents(actor) {
        const components = new Set();
        if (actor?.abilityCooldown) components.add(actor.abilityCooldown);
        const metadata = getMonsterMetadata(resolveGameId(actor));
        const found = findActorCooldownComponent(actor, metadata);
        if (found) components.add(found);
        return components;
    }

    function unpatchActorAbilityCooldownLog(actor) {
        const patches = actor?.__bsAbilityCdPatches;
        if (!patches) return;
        for (const [cd, orig] of patches) {
            if (cd && typeof cd.setCooldown === 'function') {
                cd.setCooldown = orig;
            }
        }
        patches.clear();
        delete actor.__bsAbilityCdPatches;
    }

    function patchActorAbilityCooldownLog(actor) {
        if (!actor) return;
        unpatchActorAbilityCooldownLog(actor);
        const patches = new Map();
        for (const cd of collectActorAbilityCooldownComponents(actor)) {
            if (!cd || typeof cd.setCooldown !== 'function' || patches.has(cd)) continue;
            const orig = cd.setCooldown.bind(cd);
            cd.setCooldown = (...args) => {
                const result = orig(...args);
                const isReset = args.length > 0 && Number(args[0]) === 0;
                if (!isReset) recordAbilityCastLogEntry(actor);
                return result;
            };
            patches.set(cd, orig);
        }
        if (patches.size) actor.__bsAbilityCdPatches = patches;
    }

    function recordDeathLogEntry(deathEvent) {
        if (!deathEvent || !shouldPatchBattleLogActors()) return;
        const actor = deathEvent.killedActor ?? deathEvent.actor ?? entityToActor(deathEvent);
        if (!actor) return;

        const tick = getBattleLogTick();
        const unit = actorLabel(actor);
        const killerActor = entityToActor(deathEvent.killedBy);
        const killedBy = killerActor ? actorLabel(killerActor) : null;
        const dedupeKey = `${tick ?? '?'}|${actor.id ?? unit}|death`;
        if (deathLogDedupe.has(dedupeKey)) return;
        deathLogDedupe.add(dedupeKey);

        battleLog.push({
            tick: tick != null ? tick : '?',
            kind: 'death',
            unit,
            unitKey: resolveFightCollapseKey(actor),
            unitTile: readActorTileIndex(actor),
            unitVillain: actor.villain === true,
            killedBy,
            killedByKey: killerActor ? resolveFightCollapseKey(killerActor) : null,
            killedByVillain: killerActor?.villain === true
        });

        battleLogRevision++;
        scheduleBattleLogRender();
    }

    const STATUS_EFFECT_LABELS = {
        stun: 'Stunned',
        silence: 'Silenced',
        'mind-control': 'Mind controlled',
        envenom: 'Poisoned',
        poison: 'Poisoned',
        'snowman-debuff': 'Slowed',
        slow: 'Slowed',
        jar: 'Jarred',
        ultimatehealing: 'Ultimate Healing',
        disarmed: 'Disarmed',
        'vicious-knife': 'Bleeding',
        'amazon-bleed': 'Bleeding',
        bleed: 'Bleeding',
        haste: 'Haste',
        attackspeedbuff: 'Attack speed',
        skeleton: 'Skeleton',
        gooshell: 'Gooshell',
        'crystalenergy': 'Crystal energy'
    };

    const SLOW_SRC_PATTERNS = ['slow', 'snowman', 'snowstorm', 'nunu', 'slowmud', 'icearrow'];
    const POISON_SRC_PATTERNS = ['poison', 'envenom', 'venom'];
    const JAR_SRC_PATTERNS = ['jar'];
    const DISARMED_SRC_PATTERNS = ['disarm'];

    // Merge rules collapse variant spell srcs into one chip/log id; everything else uses renderPassives dynamically.
    const STATUS_EFFECT_MERGE_RULES = [
        { id: 'slow', patterns: SLOW_SRC_PATTERNS, skipBenign: true },
        { id: 'poison', patterns: POISON_SRC_PATTERNS },
        { id: 'jar', patterns: JAR_SRC_PATTERNS },
        { id: 'disarmed', patterns: DISARMED_SRC_PATTERNS }
    ];

    const STATUS_EFFECT_DEFS = {
        stun: { shortLabel: 'Stun', type: 'debuff' },
        silence: { shortLabel: 'Silence', type: 'debuff' },
        'mind-control': { shortLabel: 'MC', type: 'debuff' },
        slow: { shortLabel: 'Slow', type: 'debuff' },
        poison: { shortLabel: 'Poison', type: 'debuff' },
        jar: { shortLabel: 'Jar', type: 'buff' },
        disarmed: { shortLabel: 'Disarm', type: 'debuff' }
    };

    const EVENT_LOGGED_STATUS_IDS = new Set(Object.keys(STATUS_EFFECT_DEFS));

    const STATUS_LOG_BUILT_EFFECTS = [
        { getEmitter: (actor) => actor.stun?.onStun, effectId: 'stun' },
        { getEmitter: (actor) => actor.silenceComponent?.onSilenced, effectId: 'silence' },
        { getEmitter: (actor) => actor.onSlow, effectId: 'slow', beforeLog: (actor) => { actor.__bsHasSlow = true; } },
        { getEmitter: (actor) => actor.onPoison, effectId: 'poison' },
        { getEmitter: (actor) => actor.onDisarmed, effectId: 'disarmed', beforeLog: (actor) => { actor.__bsHasDisarmed = true; } }
    ];

    function cloneStatusEffect(effect) {
        return effect ? { ...effect } : null;
    }

    function normalizeSpellSrc(src) {
        if (src == null) return null;
        let key = String(src).trim();
        if (!key) return null;

        const urlMatch = key.match(/\/assets\/spells\/([^/?#]+)\.png/i);
        if (urlMatch) return urlMatch[1].toLowerCase();

        if (/[\\/]/.test(key)) {
            const filename = key.replace(/^.*[\\/]/, '');
            const base = filename.replace(/\.[^.]+$/i, '');
            return base ? base.toLowerCase() : null;
        }

        return key.toLowerCase();
    }

    function isSpellAssetKey(key) {
        if (!key) return false;
        // Numeric src values are internal spell IDs, not /assets/spells/*.png filenames.
        return !/^\d+$/.test(String(key));
    }

    function resolveSpellIconUrl(src) {
        const key = normalizeSpellSrc(src);
        if (!key || !isSpellAssetKey(key)) return null;
        return `/assets/spells/${encodeURIComponent(key)}.png`;
    }

    function resolveSkillIcon(skill) {
        if (!skill) return null;
        const icon = skill.icon;
        if (typeof icon === 'string' && icon.trim()) return icon;
        return resolveSpellIconUrl(skill.src);
    }

    function resolveResourceSpellSrc(resource) {
        if (!resource || typeof resource !== 'object') return null;
        for (const candidate of [resource.src, resource.name, resource.spriteId]) {
            const normalized = normalizeSpellSrc(candidate);
            if (normalized) return normalized;
        }
        return null;
    }

    function humanizeEffectSrc(src) {
        if (!src) return 'Effect';
        const key = normalizeSpellSrc(src) || String(src).trim().toLowerCase();
        if (STATUS_EFFECT_LABELS[key]) return STATUS_EFFECT_LABELS[key];
        return key
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
    }

    function buildStatusEffect(effectId) {
        const def = STATUS_EFFECT_DEFS[effectId];
        if (!def) return null;
        const label = STATUS_EFFECT_LABELS[effectId] || humanizeEffectSrc(effectId);
        return {
            id: effectId,
            label,
            shortLabel: def.shortLabel,
            type: def.type,
            src: effectId
        };
    }

    function resourceSrcMatchesPatterns(resource, patterns) {
        const src = resolveResourceSpellSrc(resource)
            || String(resource?.src || resource?.name || '').toLowerCase();
        return patterns.some((pattern) => src.includes(pattern));
    }

    function resolveActorAbilitySpellSrc(actor) {
        const gameId = resolveGameId(actor);
        const metadata = gameId != null ? getMonsterMetadata(gameId) : null;
        return normalizeSpellSrc(
            actor?.abilityCooldown?.src
            ?? metadata?.skill?.src
            ?? null
        );
    }

    function isActorOwnAbilityResource(actor, resource) {
        // Benign passives (e.g. Ultimate Healing on self) are real buffs, not ability-cooldown UI.
        if (resource?.benign === true) return false;
        const spellSrc = resolveResourceSpellSrc(resource);
        const abilitySrc = resolveActorAbilitySpellSrc(actor);
        return Boolean(spellSrc && abilitySrc && spellSrc === abilitySrc);
    }

    function hasActiveDurationTicks(resource) {
        const ticksLeft = resource?.ticksLeft;
        return ticksLeft != null && Number(ticksLeft) > 0;
    }

    function hasActiveResourceState(resource) {
        const counter = resource?.counter?.current;
        if (counter != null && Number(counter) > 0) return true;
        const readable = resource?.readableCurrent;
        if (readable != null) {
            const text = String(readable).trim();
            if (text && text !== '0') return true;
        }
        try {
            if (resource?.isOnCooldown?.() === true) return true;
            if (resource?.cooldownClock?.isOnCooldown?.() === true) return true;
        } catch { /* ignore */ }
        return false;
    }

    function isSlowDebuffResource(actor, resource) {
        if (isActorOwnAbilityResource(actor, resource)) return false;
        if (resource?.benign === true) return false;
        return resourceSrcMatchesPatterns(resource, SLOW_SRC_PATTERNS);
    }

    function isRenderResourceActive(actor, resource) {
        if (!resource || typeof resource !== 'object') return false;
        if (isActorOwnAbilityResource(actor, resource)) return false;

        // Duration debuffs (slow, poison, etc.) are active while listed on the actor.
        if (resource.benign === false) return true;
        if (isSlowDebuffResource(actor, resource)) return true;

        if (resource.activePassive === true) {
            if (resource.UI === 'bar' && resource.color === 'transparent') {
                return hasActiveResourceState(resource);
            }
            return true;
        }

        // E.v duration passives (jar, ultimatehealing, etc.) track time via ticksLeft, not counter.
        if (hasActiveDurationTicks(resource)) return true;

        return hasActiveResourceState(resource);
    }

    function getMergedEffectFromResource(actor, resource) {
        if (isActorOwnAbilityResource(actor, resource)) return null;
        for (const rule of STATUS_EFFECT_MERGE_RULES) {
            if (rule.skipBenign && resource?.benign === true) continue;
            if (!resourceSrcMatchesPatterns(resource, rule.patterns)) continue;
            return buildStatusEffect(rule.id);
        }
        return null;
    }

    function readRenderCollectionItems(collection) {
        if (!collection) return [];

        if (typeof collection.getSnapshot === 'function') {
            try {
                const snapshot = collection.getSnapshot();
                if (Array.isArray(snapshot)) return snapshot;
            } catch { /* ignore */ }
        }

        const raw = collection.current ?? collection.value ?? collection;
        if (Array.isArray(raw)) return raw;
        if (raw && Array.isArray(raw.items)) return raw.items;
        if (Array.isArray(collection.items)) return collection.items;
        if (typeof collection[Symbol.iterator] === 'function') {
            try { return [...collection]; } catch { /* ignore */ }
        }
        return [];
    }

    function actorHasSlowFromResources(actor) {
        const collections = [actor?.renderResources, actor?.renderPassives];
        for (const collection of collections) {
            for (const resource of readRenderCollectionItems(collection)) {
                if (isSlowDebuffResource(actor, resource)) return true;
            }
        }
        return false;
    }

    function seedBattleLogStatusSnapshots() {
        const units = collectActorSnapshots();
        if (!Array.isArray(units)) return;
        for (const unit of units) {
            const key = normalizeCollapseKey(getUnitCollapseKey(unit));
            lastUnitStatusByKey.set(key, snapshotStatusEffects(unit.statusEffects));
        }
    }

    function readResourceEffectLabel(resource) {
        const spellSrc = resolveResourceSpellSrc(resource);
        const baseLabel = humanizeEffectSrc(spellSrc || resource?.src || resource?.name);
        const readable = resource?.readableCurrent
            ?? resource?.counter?.readableCurrent
            ?? (resource?.counter?.current != null && resource?.UI === 'discrete'
                ? String(resource.counter.current)
                : null);
        if (readable && !baseLabel.includes(String(readable))) {
            return `${baseLabel} ${readable}`.trim();
        }
        return baseLabel;
    }

    function resourceEffectId(resource) {
        if (resource?.uuid) return `fx:${resource.uuid}`;
        const src = resolveResourceSpellSrc(resource) || resource?.src || resource?.name || resource?.spriteId || 'effect';
        const counter = resource?.counter?.current ?? resource?.readableCurrent ?? '';
        return `fx:${src}:${counter}`;
    }

    function collectResourceStatusEffect(actor, resource) {
        if (!resource || typeof resource !== 'object') return null;
        if (!isRenderResourceActive(actor, resource)) return null;
        const spellSrc = resolveResourceSpellSrc(resource);
        const src = spellSrc || resource.src || resource.name || null;
        const type = resource.benign === true ? 'buff' : 'debuff';
        const baseLabel = humanizeEffectSrc(spellSrc || src);
        const label = readResourceEffectLabel(resource);
        return {
            id: resourceEffectId(resource),
            label,
            shortLabel: baseLabel.length > 14 ? `${baseLabel.slice(0, 12)}…` : baseLabel,
            type,
            src: spellSrc || src
        };
    }

    function isActorMindControlled(actor) {
        const mc = actor?.mindControl;
        if (!mc) return false;
        if (mc.current?.by) return true;
        return mc.isControlled === true;
    }

    function collectActorStatusEffects(actor) {
        if (!actor) return [];
        const effects = [];
        const seen = new Set();

        const add = (effect) => {
            if (!effect?.id || seen.has(effect.id)) return;
            seen.add(effect.id);
            effects.push(effect);
        };

        if (actor.stun?.isStunned === true) add(buildStatusEffect('stun'));
        if (actor.silenceComponent?.isSilenced === true) add(buildStatusEffect('silence'));
        if (isActorMindControlled(actor)) add(buildStatusEffect('mind-control'));

        const collections = [
            { key: 'resources', collection: actor.renderResources },
            { key: 'passives', collection: actor.renderPassives }
        ];
        for (const { collection } of collections) {
            const items = readRenderCollectionItems(collection);
            for (const resource of items) {
                if (!isRenderResourceActive(actor, resource)) continue;
                const merged = getMergedEffectFromResource(actor, resource);
                if (merged) {
                    add(cloneStatusEffect(merged));
                    continue;
                }
                const effect = collectResourceStatusEffect(actor, resource);
                if (effect) add(effect);
            }
        }

        const slowFromResources = actorHasSlowFromResources(actor);
        if (!seen.has('slow') && (slowFromResources || actor.__bsHasSlow === true)) {
            add(cloneStatusEffect(buildStatusEffect('slow')));
        }
        if (!seen.has('disarmed') && actor.__bsHasDisarmed === true) {
            add(cloneStatusEffect(buildStatusEffect('disarmed')));
        }

        if (slowFromResources) actor.__bsHasSlow = true;
        else if (!effects.some((e) => e.id === 'slow')) actor.__bsHasSlow = false;

        if (!effects.some((e) => e.id === 'disarmed' || e.id === 'jar')) actor.__bsHasDisarmed = false;

        return effects;
    }

    function snapshotStatusEffects(effects) {
        return (effects || []).map((e) => ({
            id: e.id,
            label: e.label,
            type: e.type
        }));
    }

    function recordStatusEffectLogEntry(unit, effect, applied) {
        if (!unit || !effect || !shouldPatchBattleLogActors()) return;
        const tick = getBattleLogTick();
        const label = effect.label || humanizeEffectSrc(effect.id);
        const dedupeKey = `${tick ?? '?'}|${unit.name}|${effect.id || label}|${applied ? 'a' : 'r'}`;
        if (statusLogDedupe.has(dedupeKey)) return;
        statusLogDedupe.add(dedupeKey);

        battleLog.push({
            tick: tick != null ? tick : '?',
            kind: 'status',
            to: unit.name || 'Unknown',
            toVillain: unit.villain === true,
            effectLabel: label,
            effectType: effect.type || 'debuff',
            applied: applied === true
        });
        battleLogRevision++;
        scheduleBattleLogRender();
    }

    function readActorAbilityCdTicks(actor, metadata) {
        const info = readActorCooldown(actor, metadata, { skipCalculator: true });
        if (info.cooldownTicks != null && Number.isFinite(info.cooldownTicks) && info.cooldownTicks > 0) {
            return info.cooldownTicks;
        }
        const live = readStatBagLive(info.raw);
        if (live != null && Number.isFinite(live) && live > 0) return live;
        if (info.cooldownMs != null && Number.isFinite(info.cooldownMs) && info.cooldownMs > 0) {
            const ticks = msToTicks(info.cooldownMs);
            if (ticks != null && ticks > 0) return ticks;
        }
        return null;
    }

    function readActorStatsForTracking(actor) {
        if (!actor) return null;
        const metadata = getMonsterMetadata(resolveGameId(actor));
        const hpSnap = readActorHp(actor.hp);
        const stats = {};
        for (const { key } of STAT_KEYS) {
            const v = readActorLiveStatFast(actor, key);
            stats[key] = roundTrackValue(v, key);
        }
        stats.hpMax = roundTrackValue(hpSnap.hpMax, 'hpMax');
        const level = readActorStat(actor, 'level') ?? actor.level;
        stats.level = roundTrackValue(level != null ? Number(level) : null, 'level');

        const attackDelayTicks = readActorAttackDelay(actor).delayTicks;
        stats.attackDelayTicks = roundTrackValue(attackDelayTicks, 'attackDelayTicks');

        const abilityCdTicks = readActorAbilityCdTicks(actor, metadata);
        stats.abilityCdTicks = roundTrackValue(abilityCdTicks, 'abilityCdTicks');

        return stats;
    }

    function seedActorStatSnapshots(actors) {
        if (!Array.isArray(actors)) return;
        for (const actor of actors) {
            if (!actor) continue;
            const snapshot = readActorStatsForTracking(actor);
            if (snapshot) lastActorStatsByActor.set(actor, snapshot);
        }
    }

    function recordStatChangeLogEntry(actor, statKey, statLabel, fromVal, toVal) {
        if (!actor || !shouldPatchBattleLogActors()) return;
        if (fromVal === toVal || fromVal == null || toVal == null) return;

        const tick = getBattleLogTick();
        const unit = actorLabel(actor);
        const dedupeKey = `${tick ?? '?'}|${unit}|${statKey}|${fromVal}|${toVal}`;
        if (statLogDedupe.has(dedupeKey)) return;
        statLogDedupe.add(dedupeKey);

        battleLog.push({
            tick: tick != null ? tick : '?',
            kind: 'statChange',
            unit,
            unitVillain: actor.villain === true,
            statKey,
            statLabel,
            from: fromVal,
            to: toVal,
            delta: toVal - fromVal
        });
        battleLogRevision++;
        scheduleBattleLogRender();
    }

    function trackStatChanges(actors, options = {}) {
        const log = options.log === true && shouldPatchBattleLogActors();
        if (!Array.isArray(actors)) return false;
        let changed = false;
        for (const actor of actors) {
            if (!actor) continue;
            const next = readActorStatsForTracking(actor);
            if (!next) continue;

            const prev = lastActorStatsByActor.get(actor);
            if (!prev) {
                lastActorStatsByActor.set(actor, next);
                continue;
            }

            const suppressHp = actor.__bsSuppressHpStatLog === true;
            if (suppressHp) actor.__bsSuppressHpStatLog = false;

            for (const { key, label } of STAT_CHANGE_TRACK_KEYS) {
                const oldVal = prev[key];
                const newVal = next[key];
                if (oldVal === newVal || oldVal == null || newVal == null) continue;
                if (key === 'hp' && suppressHp) continue;
                changed = true;
                if (log) recordStatChangeLogEntry(actor, key, label, oldVal, newVal);
                if (UNITS_LIVE_STAT_INVALIDATE_KEYS.has(key)) {
                    invalidateActorSnapshotsCache();
                }
                if (ABILITY_SCALING_STAT_KEYS.includes(key) || key === 'hpMax') {
                    queueAbilityTooltipRefreshForActor(actor);
                }
            }

            lastActorStatsByActor.set(actor, next);
        }
        return changed;
    }

    function collectActorStatusUnitsForTracking() {
        const world = getActiveWorld();
        const actors = world?.grid?.actors;
        if (!Array.isArray(actors)) return [];
        const units = [];
        for (const actor of actors) {
            if (!actor) continue;
            units.push({
                name: actor.name || actor.nickname || 'Unknown',
                villain: actor.villain === true,
                tileIndex: readActorTileIndex(actor),
                source: 'fight',
                collapseKey: resolveFightCollapseKey(actor),
                statusEffects: collectActorStatusEffects(actor)
            });
        }
        return units;
    }

    function pollStatusEffectTracking(force) {
        if (!isLiveFightTracking() || panelFightTickFrozen != null) return;
        const onUnitsTab = activeTab === 'units';
        const onLogTab = activeTab === 'log';
        if (!force && !onLogTab && !onUnitsTab) return;

        const engineTick = lastPanelSyncedEngineTick
            ?? resolveEngineTick(globalThis.state?.gameTimer?.getSnapshot?.()?.context);
        if (engineTick == null) return;
        if (!force && engineTick === lastStatusPollTick) return;
        lastStatusPollTick = engineTick;

        if (shouldPatchBattleLogActors() && (force || onLogTab)) {
            profileUnitsLag('trackStatusEffects', () => {
                trackStatusEffectChanges(collectActorStatusUnitsForTracking());
            });
        }

        let statsChanged = false;
        profileUnitsLag('trackStatChanges', () => {
            statsChanged = trackStatChanges(getActiveWorld()?.grid?.actors, {
                log: shouldPatchBattleLogActors() && (force || onLogTab)
            });
        });
        if (onUnitsTab && statsChanged) {
            scheduleUnitsLiveStatsPatch();
        }
    }

    function trackStatusEffectChanges(units) {
        if (!shouldPatchBattleLogActors() || !Array.isArray(units)) return;
        for (const unit of units) {
            const key = normalizeCollapseKey(getUnitCollapseKey(unit));
            const nextEffects = snapshotStatusEffects(unit.statusEffects);
            if (!lastUnitStatusByKey.has(key)) {
                lastUnitStatusByKey.set(key, nextEffects);
                continue;
            }

            const prevEffects = lastUnitStatusByKey.get(key) || [];
            const prevById = new Map(prevEffects.map((e) => [e.id, e]));
            const nextById = new Map(nextEffects.map((e) => [e.id, e]));

            for (const [, effect] of nextById) {
                if (!prevById.has(effect.id) && !EVENT_LOGGED_STATUS_IDS.has(effect.id)) {
                    recordStatusEffectLogEntry(unit, effect, true);
                }
            }
            for (const [, effect] of prevById) {
                if (!nextById.has(effect.id)) {
                    recordStatusEffectLogEntry(unit, effect, false);
                }
            }

            lastUnitStatusByKey.set(key, nextEffects);
        }
    }

    function unpatchActorEmitterSubs(actor, { patchedKey, subsKey, onCleanup }) {
        if (!actor?.[patchedKey]) return;
        unsubscribeAll(actor[subsKey]);
        delete actor[patchedKey];
        delete actor[subsKey];
        if (typeof onCleanup === 'function') onCleanup();
    }

    function unpatchActorStatusLog(actor) {
        unpatchActorEmitterSubs(actor, {
            patchedKey: '__bsStatusLogPatched',
            subsKey: '__bsStatusLogSubs'
        });
    }

    function subscribeActorStatusEvent(actor, emitter, handler) {
        if (typeof emitter?.subscribe !== 'function') return;
        const sub = emitter.subscribe(handler);
        if (!actor.__bsStatusLogSubs) actor.__bsStatusLogSubs = [];
        actor.__bsStatusLogSubs.push(sub);
    }

    function actorStatusUnitSnapshot(actor) {
        return {
            name: actor.name || actor.nickname || 'Unknown',
            villain: actor.villain === true
        };
    }

    function syncActorStatusSnapshot(actor) {
        const unit = probeActorFast(actor);
        if (!unit) return;
        const key = normalizeCollapseKey(getUnitCollapseKey(unit));
        let effects = snapshotStatusEffects(unit.statusEffects);
        const slowFromResources = actorHasSlowFromResources(actor);
        const needsTransientSlow = actor.__bsHasSlow === true
            && !slowFromResources
            && !effects.some((e) => e.id === 'slow');
        if (needsTransientSlow) {
            effects = effects.concat(snapshotStatusEffects([buildStatusEffect('slow')]));
        }
        lastUnitStatusByKey.set(key, effects);
    }

    function logActorStatusEvent(actor, effect, applied) {
        recordStatusEffectLogEntry(actorStatusUnitSnapshot(actor), effect, applied);
        syncActorStatusSnapshot(actor);
    }

    function readActorTileIndex(actor) {
        return actor?.position?.tile?.index ?? actor?.position?.tileIndex ?? null;
    }

    function recordPathingLogEntry(actor, fromTile, toTile) {
        if (!actor || fromTile == null || toTile == null || fromTile === toTile) return;
        if (!shouldPatchBattleLogActors()) return;
        const unit = actorStatusUnitSnapshot(actor);
        const tick = getBattleLogTick();
        const dedupeKey = `${tick ?? '?'}|${unit.name}|${fromTile}|${toTile}`;
        if (pathLogDedupe.has(dedupeKey)) return;
        pathLogDedupe.add(dedupeKey);

        battleLog.push({
            tick: tick != null ? tick : '?',
            kind: 'pathing',
            unit: unit.name,
            unitVillain: unit.villain === true,
            fromTile,
            toTile
        });
        battleLogRevision++;
        scheduleBattleLogRender();
    }

    function unpatchActorPathingLog(actor) {
        unpatchActorEmitterSubs(actor, {
            patchedKey: '__bsPathLogPatched',
            subsKey: '__bsPathLogSubs',
            onCleanup: () => lastActorTileByActor.delete(actor)
        });
    }

    function patchActorPathingLog(actor) {
        if (!actor?.position?.onChange?.subscribe || actor.__bsPathLogPatched) return;
        actor.__bsPathLogPatched = true;
        actor.__bsPathLogSubs = [];

        const initialTile = readActorTileIndex(actor);
        if (initialTile != null) lastActorTileByActor.set(actor, initialTile);

        const sub = actor.position.onChange.subscribe((event) => {
            const toTile = event?.tile?.index ?? readActorTileIndex(actor);
            if (toTile == null) return;
            const fromTile = lastActorTileByActor.get(actor);
            lastActorTileByActor.set(actor, toTile);
            if (fromTile == null || fromTile === toTile) return;
            recordPathingLogEntry(actor, fromTile, toTile);
        });
        actor.__bsPathLogSubs.push(sub);
    }

    function patchActorStatusLog(actor) {
        if (!actor || actor.__bsStatusLogPatched) return;
        actor.__bsStatusLogPatched = true;
        actor.__bsStatusLogSubs = [];

        const logBuiltStatusEvent = (effectId, beforeLog) => {
            if (typeof beforeLog === 'function') beforeLog();
            const effect = buildStatusEffect(effectId);
            if (effect) logActorStatusEvent(actor, effect, true);
        };

        for (const { getEmitter, effectId, beforeLog } of STATUS_LOG_BUILT_EFFECTS) {
            subscribeActorStatusEvent(actor, getEmitter(actor), () => {
                logBuiltStatusEvent(effectId, beforeLog ? () => beforeLog(actor) : undefined);
            });
        }
        subscribeActorStatusEvent(actor, actor.onDebuff, () => {
            pollStatusEffectTracking(true);
        });
        subscribeActorStatusEvent(actor, actor.onBuff, () => {
            pollStatusEffectTracking(true);
        });
    }

    function resolveApplyDamagePoints(hp, opts) {
        let points = Number(opts.points);
        if (!Number.isFinite(points)) return points;
        const hooks = hp._onBeforeApplyingDamage;
        if (!Array.isArray(hooks)) return points;
        for (const { fn } of hooks) {
            if (typeof fn !== 'function') continue;
            points = fn({
                points,
                damageType: opts.damageType,
                from: opts.from,
                tags: opts.tags
            }).modifiedDamage;
        }
        return points;
    }

    function peekAppliedDamageBreakdown(hp, opts) {
        if (typeof hp.calculateAppliedDamage !== 'function') return null;
        const damageType = opts.damageType || 'physical';
        const points = resolveApplyDamagePoints(hp, opts);
        return hp.calculateAppliedDamage({ points, damageType });
    }

    function unpatchActorBattleLog(actor) {
        unpatchActorPathingLog(actor);
        unpatchActorStatusLog(actor);
        unpatchActorAbilityCooldownLog(actor);
        if (!actor?.hp || !actor.__bsLogPatched) return;
        if (actor.__bsOrigApplyDamage) actor.hp.applyDamage = actor.__bsOrigApplyDamage;
        if (actor.__bsOrigHealHp) actor.hp.healHp = actor.__bsOrigHealHp;
        delete actor.__bsLogPatched;
        delete actor.__bsOrigApplyDamage;
        delete actor.__bsOrigHealHp;
        delete actor.__bsHasSlow;
        delete actor.__bsHasDisarmed;
    }

    function patchActorBattleLog(actor) {
        patchActorPathingLog(actor);
        patchActorStatusLog(actor);
        if (!actor?.hp || actor.__bsLogPatched) return;

        const hp = actor.hp;
        if (typeof hp.applyDamage === 'function') {
            actor.__bsOrigApplyDamage = hp.applyDamage.bind(hp);
            hp.applyDamage = (opts = {}) => {
                actor.__bsSuppressHpStatLog = true;
                const preCalc = peekAppliedDamageBreakdown(hp, opts);
                const result = actor.__bsOrigApplyDamage(opts);
                const rawAmount = Number(opts.points);
                const appliedAmount = Number(result);
                if (Number.isFinite(appliedAmount) && appliedAmount > 0) {
                    const fromActor = entityToActor(opts.from);
                    const overkill = preCalc
                        ? Math.max(0, Math.round(preCalc.damageToApply - preCalc.calculatedDamage))
                        : 0;
                    recordBattleLogEntry({
                        from: opts.from,
                        to: actor,
                        points: -appliedAmount,
                        rawAmount: Number.isFinite(rawAmount) ? rawAmount : null,
                        overkill: overkill > 0 ? overkill : null,
                        damageType: opts.damageType || result?.damageType || 'physical',
                        crit: opts.crit === true || result?.crit === true,
                        actionSource: resolveActionSourceDisplay(opts, result, fromActor, false)
                    });
                }
                return result;
            };
        }

        if (typeof hp.healHp === 'function') {
            actor.__bsOrigHealHp = hp.healHp.bind(hp);
            hp.healHp = (opts = {}) => {
                actor.__bsSuppressHpStatLog = true;
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
                        actionSource: resolveActionSourceDisplay(opts, result, fromActor, true)
                    });
                }
                return result;
            };
        }

        patchActorAbilityCooldownLog(actor);
        const statSnapshot = readActorStatsForTracking(actor);
        if (statSnapshot) lastActorStatsByActor.set(actor, statSnapshot);
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

    function pauseBattleLogActorPatches() {
        const world = getActiveWorld() || activeWorld;
        if (world) unpatchAllActors(world);
    }

    function resumeBattleLogActorPatches() {
        if (!shouldPatchBattleLogActors()) return;
        const world = getActiveWorld() || activeWorld;
        if (world) {
            patchAllActors(world);
            seedBattleLogStatusSnapshots();
            seedActorStatSnapshots(world.grid?.actors);
        }
    }

    function teardownWorldSubscriptions() {
        unsubscribeAll(worldEventSubs);
        worldEventSubs = [];
        teardownActorUnitsMechanicsSubs();
        const world = getActiveWorld();
        if (world) unpatchAllActors(world);
    }

    function setupWorldSubscriptions(world) {
        if (!world?.grid) return;

        if (isPanelOpen()) {
            startBattleLogSession();
            patchAllActors(world);
        }

        const onActorEnter = (actor) => {
            if (shouldPatchBattleLogActors()) patchActorBattleLog(actor);
            subscribeActorUnitsMechanics(actor);
        };
        if (typeof world.grid.onActorEnter?.subscribe === 'function') {
            worldEventSubs.push(world.grid.onActorEnter.subscribe(onActorEnter));
        }
        if (typeof world.grid.onActorSummon?.subscribe === 'function') {
            worldEventSubs.push(world.grid.onActorSummon.subscribe(onActorEnter));
        }
        if (typeof world.grid.onActorDeath?.subscribe === 'function') {
            worldEventSubs.push(world.grid.onActorDeath.subscribe(recordDeathLogEntry));
        }
        if (typeof world.onGameEnd?.subscribe === 'function') {
            worldEventSubs.push(world.onGameEnd.subscribe((winner) => {
                freezePanelFightTickFromEngine(world, { winner });
                renderStatusBar(true);
                render();
            }));
        }
        const playingStore = world.tickEngine?.isPlayingStore;
        if (playingStore && typeof playingStore.subscribe === 'function') {
            worldEventSubs.push(playingStore.subscribe(() => {
                refreshUnitsAfterStatusVisibilityChange();
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

    function resolveGameIdFromName(name) {
        if (!name) return null;
        const fromDb = window.creatureDatabase?.findMonsterByName?.(name);
        const dbId = fromDb?.gameId;
        if (dbId != null && Number.isFinite(Number(dbId))) return Number(dbId);
        return buildGameIdByNameMap().get(String(name).toLowerCase()) ?? null;
    }

    function resolveGameId(actor) {
        if (!actor) return null;
        const direct = actor.gameId ?? actor.monsterId ?? actor.metadata?.id;
        if (direct != null && Number.isFinite(Number(direct))) return Number(direct);
        const name = actor.name || actor.metadata?.name;
        if (!name) return null;
        return resolveGameIdFromName(name);
    }

    function getMonsterMetadata(gameId) {
        if (gameId == null) return null;
        const fromDb = window.creatureDatabase?.findMonsterByGameId?.(gameId);
        if (fromDb?.metadata) return fromDb.metadata;
        try {
            return globalThis.state?.utils?.getMonster?.(gameId)?.metadata ?? null;
        } catch {
            return null;
        }
    }

    function getMonsterPortraitSrc(gameId) {
        if (gameId == null) return null;
        const fromDb = window.creatureDatabase?.getMonsterPortraitUrl?.(gameId);
        if (fromDb) return fromDb;
        return `/assets/portraits/${gameId}.png`;
    }

    function formatTicksParts(ticks) {
        if (ticks == null || !Number.isFinite(ticks)) return { value: '—', suffix: '' };
        const rounded = Math.round(ticks * 10) / 10;
        const label = Math.abs(rounded) === 1 ? 'tick' : 'ticks';
        return { value: String(rounded), suffix: ` ${label}` };
    }

    function formatTicks(ticks) {
        const { value, suffix } = formatTicksParts(ticks);
        return suffix ? `${value}${suffix}` : value;
    }

    function isTickStatTrackKey(statKey) {
        return TICK_STAT_TRACK_KEYS.has(statKey);
    }

    function roundTrackValue(value, statKey) {
        if (value == null || !Number.isFinite(value)) return null;
        if (isTickStatTrackKey(statKey)) return Math.round(value * 10) / 10;
        return Math.round(value);
    }

    const FRACTIONAL_UNIT_STAT_KEYS = new Set(['ad', 'ap', 'armor', 'magicResist']);

    function normalizeUnitStatValue(statKey, value) {
        if (value == null || !Number.isFinite(value)) return value;
        if (FRACTIONAL_UNIT_STAT_KEYS.has(statKey)) return Math.round(value * 10) / 10;
        return Math.round(value);
    }

    function formatUnitStatDisplay(statKey, value) {
        if (value == null || !Number.isFinite(value)) return '—';
        return String(normalizeUnitStatValue(statKey, value));
    }

    function formatStatChangeValue(statKey, value) {
        if (value == null) return '?';
        if (isTickStatTrackKey(statKey)) return formatTicks(value);
        return formatUnitStatDisplay(statKey, value);
    }

    function formatStatChangeDelta(statKey, delta) {
        if (isTickStatTrackKey(statKey)) {
            const rounded = Math.round(delta * 10) / 10;
            const sign = rounded > 0 ? '+' : '';
            return `${sign}${rounded}`;
        }
        const sign = delta > 0 ? '+' : '';
        return `${sign}${delta}`;
    }

    function isStatChangeBeneficial(statKey, delta) {
        if (delta === 0) return false;
        if (STAT_LOWER_IS_BETTER.has(statKey)) return delta < 0;
        return delta > 0;
    }

    function statChangeDeltaClass(statKey, delta) {
        if (delta === 0) return '';
        return isStatChangeBeneficial(statKey, delta) ? 'positive' : 'negative';
    }

    function msToTicks(ms) {
        if (ms == null || !Number.isFinite(ms)) return null;
        return ms / DEFAULT_TICK_INTERVAL_MS;
    }

    function msToGameCooldownTicks(ms) {
        if (ms == null || !Number.isFinite(ms)) return null;
        return Math.round(ms / DEFAULT_TICK_INTERVAL_MS);
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
        if (unit?.cooldownTicks != null && Number.isFinite(unit.cooldownTicks) && unit.cooldownTicks > 0) {
            return unit.cooldownTicks;
        }
        const fromMs = msToTicks(unit?.cooldownMs);
        return fromMs != null && fromMs > 0 ? fromMs : null;
    }

    function resolveUnitCooldownRemainingTicks(unit) {
        if (unit?.cooldownRemainingTicks != null && Number.isFinite(unit.cooldownRemainingTicks)) {
            return unit.cooldownRemainingTicks;
        }
        return msToTicks(unit?.cooldownRemainingMs);
    }

    function resolveUnitAttackDelayRemainingTicks(unit) {
        if (unit?.attackDelayRemainingTicks != null && Number.isFinite(unit.attackDelayRemainingTicks)) {
            return unit.attackDelayRemainingTicks;
        }
        return null;
    }

    function unitShowsLiveMechanics(unit) {
        return unit?.source === 'fight' && isFightActive();
    }

    function renderCooldownStateHtml(ready, remainingTicks) {
        if (ready === true) return coloredStatSpan('ready', true);
        if (remainingTicks != null && remainingTicks > 0) {
            return coloredStatSpan(`${formatTicks(remainingTicks)} left`, false);
        }
        if (ready === false) return coloredStatSpan('on cooldown', false);
        return null;
    }

    let unitsStatWarned = new Set();

    function clearUnitsStatWarnings() {
        unitsStatWarned.clear();
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

    function isHpDefensiveStatKey(statKey) {
        return statKey === 'armor' || statKey === 'magicResist';
    }

    function readDefensiveStatFromHpBag(actor, statKey) {
        if (!actor?.hp || !isHpDefensiveStatKey(statKey)) return null;
        const hpBag = actor.hp;
        const keys = LIVE_STAT_ALIASES[statKey] || [statKey];

        for (const key of keys) {
            const bag = hpBag[key];
            const bagInfo = describeStatBag(bag);
            if (bagInfo.readLive != null) {
                return { value: bagInfo.readLive, source: `actor.hp.${key}` };
            }
        }

        const pattern = STAT_BAG_PATH_PATTERNS[statKey];
        if (!pattern) return null;
        for (const entry of discoverActorStatLikeBags(hpBag, 3)) {
            const leaf = entry.path.split('.').pop() || entry.path;
            if (!pattern.test(leaf) && !pattern.test(entry.path)) continue;
            if (entry.live != null) {
                return { value: entry.live, source: `actor.hp.${entry.path}` };
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

    function readActorLiveStatFast(actor, statKey) {
        if (!actor) return null;

        if (isHpDefensiveStatKey(statKey)) {
            const hpDefensive = readDefensiveStatFromHpBag(actor, statKey);
            if (hpDefensive?.value != null) {
                return normalizeUnitStatValue(statKey, hpDefensive.value);
            }
        }

        const keys = LIVE_STAT_ALIASES[statKey] || [statKey];
        for (const key of keys) {
            const v = readStatBagLive(actor[key]);
            if (v != null) return normalizeUnitStatValue(statKey, v);
        }

        if (statKey === 'speed') {
            const speedCandidates = [
                actor.movement?.speed,
                actor.movement?.moveSpeed,
                actor.moveSpeed
            ];
            for (const bag of speedCandidates) {
                const v = readStatBagLive(bag);
                if (v != null) return normalizeUnitStatValue(statKey, v);
            }
        }

        const plain = readActorPlainStat(actor, statKey);
        const value = plain?.value ?? null;
        return value != null ? normalizeUnitStatValue(statKey, value) : null;
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

        // Armor/MR bags live on actor.hp and include flat modifiers (e.g. Goblin Scavenger helmet).
        if (isHpDefensiveStatKey(statKey)) {
            const hpDefensive = readDefensiveStatFromHpBag(actor, statKey);
            detail.attempts.push({ phase: 'hp-defensive-primary', result: hpDefensive });
            if (hpDefensive?.value != null) {
                detail.value = hpDefensive.value;
                detail.source = hpDefensive.source;
                return detail;
            }
        }

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

        const hpDefensive = readDefensiveStatFromHpBag(actor, statKey);
        detail.attempts.push({ phase: 'hp-defensive-fallback', result: hpDefensive });
        if (hpDefensive?.value != null) {
            detail.value = hpDefensive.value;
            detail.source = hpDefensive.source;
            return detail;
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
            hp: normalizeUnitStatValue('hp', hp),
            hpMax: normalizeUnitStatValue('hpMax', hpMax),
            hpPct,
            alive: hpBag.isAlive !== false
        };
    }

    function readComponentNumber(component, keys) {
        if (!component) return null;
        for (const key of keys) {
            try {
                const raw = component[key];
                if (raw == null && raw !== 0) continue;
                const v = Number(raw);
                if (Number.isFinite(v)) return v;
            } catch { /* ignore */ }
        }
        return null;
    }

    function readCooldownComponentState(cd) {
        const empty = { remainingTicks: null, remainingMs: null, ready: null };
        if (!cd) return empty;

        let remainingTicks = null;
        let remainingMs = null;
        let ready = null;

        try {
            if (cd.isOnCooldown === true) ready = false;
            else if (cd.isOnCooldown === false) ready = true;
        } catch { /* ignore */ }

        try {
            const current = cd.currentCooldown;
            if (typeof current === 'number' && Number.isFinite(current)) {
                remainingTicks = Math.max(0, current);
            }
        } catch { /* ignore */ }

        try {
            if (typeof cd.getRemainingMs === 'function') {
                const ms = cd.getRemainingMs();
                if (Number.isFinite(ms)) remainingMs = ms;
            }
        } catch { /* ignore */ }

        if (remainingMs == null) {
            try {
                if (Number.isFinite(cd.remainingMilliseconds)) remainingMs = cd.remainingMilliseconds;
                else if (Number.isFinite(cd.remainingMs)) remainingMs = cd.remainingMs;
            } catch { /* ignore */ }
        }

        if (remainingTicks == null) {
            remainingTicks = readComponentNumber(cd, [
                '_currentCooldown', 'remainingTicks', 'cooldownRemainingTicks', 'ticksLeft'
            ]);
        }
        if (remainingTicks == null && remainingMs != null) {
            remainingTicks = msToGameCooldownTicks(remainingMs);
        }
        if (ready == null && remainingTicks != null) {
            ready = remainingTicks <= 0;
        }

        return { remainingTicks, remainingMs, ready };
    }

    function ticksToMs(ticks) {
        if (ticks == null || !Number.isFinite(ticks)) return null;
        return ticks * DEFAULT_TICK_INTERVAL_MS;
    }

    function isActorAutoAttackCooldown(actor, cd) {
        return cd != null && actor?.cooldown?.autoAttack === cd;
    }

    function isUntimedSkillCooldownComponent(cd) {
        if (!cd) return false;
        const ms = pickFirstNumber(cd, [
            'cooldownMilliseconds', 'baseCooldownMilliseconds', 'cooldownMs', 'baseCooldownMs',
            'duration', 'baseDuration', 'cooldown', 'maxCooldown', 'totalCooldown'
        ]);
        const baseTicks = readComponentNumber(cd, [
            '_baseCooldown', 'baseCooldown', 'baseCooldownTicks', 'cooldownTicks'
        ]);
        if (ms === 0 && (baseTicks == null || baseTicks <= 0)) return true;
        if (ms == null && (baseTicks == null || baseTicks <= 0)) return true;
        return false;
    }

    function metadataHasNoTimedAbilityCooldown(metadata) {
        if (!metadata?.skill?.src || !cachedGameChunk661Text) return false;
        const cacheKey = `${metadata.name ?? ''}|${metadata.skill.src}`;
        if (metadataUntimedCooldownCache.has(cacheKey)) {
            return metadataUntimedCooldownCache.get(cacheKey);
        }
        const monsterName = metadata?.name;
        const anchor = findMonsterMetadataAnchor(
            cachedGameChunk661Text, metadata.skill.src, monsterName);
        if (!anchor) {
            metadataUntimedCooldownCache.set(cacheKey, false);
            return false;
        }
        const classSlice = findMonsterClassSlice(
            cachedGameChunk661Text, anchor.varName, anchor.index);
        if (!classSlice) {
            metadataUntimedCooldownCache.set(cacheKey, false);
            return false;
        }
        const result = !!resolvePreviewUntimedAbilityReason(classSlice, anchor.varName);
        metadataUntimedCooldownCache.set(cacheKey, result);
        return result;
    }

    function isAbilityCooldownCandidate(actor, cd, metadata) {
        if (metadataHasNoTimedAbilityCooldown(metadata)) return false;
        return cd != null
            && !isActorAutoAttackCooldown(actor, cd)
            && !isUntimedSkillCooldownComponent(cd);
    }

    function findActorCooldownComponentUncached(actor, metadata) {
        if (metadataHasNoTimedAbilityCooldown(metadata)) return null;

        if (actor?.isMeditating === true && actor.meditateCooldownClock) {
            const channel = actor.meditateCooldownClock;
            if (!isActorAutoAttackCooldown(actor, channel) && !isUntimedSkillCooldownComponent(channel)) {
                return channel;
            }
        }

        const direct = actor.abilityCooldown
            ?? actor.skillCooldown
            ?? actor.ability?.cooldown
            ?? actor.skill?.cooldown;
        if (isAbilityCooldownCandidate(actor, direct, metadata)) return direct;

        for (const key of Object.keys(actor)) {
            if (!/Cooldown$/.test(key) || key === 'autoAttackCooldown') continue;
            if (key === 'meditateCooldownClock') continue;
            const cd = actor[key];
            if (isAbilityCooldownCandidate(actor, cd, metadata)) return cd;
        }

        const list = actor.cooldownList;
        if (!Array.isArray(list) || !list.length) return null;

        const skillSrc = metadata?.skill?.src;
        if (skillSrc) {
            const skillNeedle = String(skillSrc).toLowerCase();
            const bySrc = list.find((cd) => {
                if (!isAbilityCooldownCandidate(actor, cd, metadata)) return false;
                const src = String(cd?.src ?? '').toLowerCase();
                return src && (src === skillNeedle || src.includes(skillNeedle) || src.endsWith(`/${skillNeedle}.png`));
            });
            if (bySrc) return bySrc;
        }

        const abilityLike = list.find((cd) =>
            isAbilityCooldownCandidate(actor, cd, metadata) && cd.src && cd.benign !== true);
        if (abilityLike) return abilityLike;

        return null;
    }

    function findActorCooldownComponent(actor, metadata) {
        if (!actor) return null;
        const meditate = actor.isMeditating === true;
        const skillSrc = metadata?.skill?.src ?? '';
        const cacheSig = `${skillSrc}|${meditate ? 1 : 0}`;
        if (actor.__bsCooldownCompSig === cacheSig && actor.__bsCooldownComp !== undefined) {
            return actor.__bsCooldownComp;
        }
        const result = findActorCooldownComponentUncached(actor, metadata);
        actor.__bsCooldownComp = result;
        actor.__bsCooldownCompSig = cacheSig;
        return result;
    }

    function readActorCooldown(actor, metadata, options = {}) {
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

        let baseTicks = readComponentNumber(cd, [
            '_baseCooldown', 'baseCooldown', 'baseCooldownTicks', 'cooldownTicks'
        ]);
        let cooldownMs = pickFirstNumber(cd, [
            'cooldownMilliseconds', 'baseCooldownMilliseconds', 'cooldownMs', 'baseCooldownMs',
            'duration', 'baseDuration', 'cooldown', 'maxCooldown', 'totalCooldown'
        ]);
        if (baseTicks == null && cooldownMs != null) {
            baseTicks = msToGameCooldownTicks(cooldownMs);
        }
        if (cooldownMs == null && baseTicks != null) {
            cooldownMs = ticksToMs(baseTicks);
        }

        if (!options.skipCalculator && (baseTicks == null || cooldownMs == null)) {
            const calculator = invokeActorCooldownCalculator(actor);
            if (calculator?.effectiveMs != null && Number.isFinite(calculator.effectiveMs) && calculator.effectiveMs > 0) {
                cooldownMs = calculator.effectiveMs;
                baseTicks = msToGameCooldownTicks(calculator.effectiveMs);
            } else if (calculator?.effectiveTicks != null && Number.isFinite(calculator.effectiveTicks) && calculator.effectiveTicks > 0) {
                baseTicks = calculator.effectiveTicks;
                cooldownMs = ticksToMs(calculator.effectiveTicks);
            }
        }

        const cdState = readCooldownComponentState(cd);
        const remainingTicks = cdState.remainingTicks;
        const cooldownRemainingMs = cdState.remainingMs;
        let cooldownReady = cdState.ready;
        if (cooldownReady == null) {
            try {
                if (cd.isOnCooldown === false) cooldownReady = true;
                else if (cd.isOnCooldown === true) cooldownReady = false;
            } catch { /* ignore */ }
        }

        const abilitySrc = cd.src ?? cd.abilitySrc ?? cd.skillSrc ?? metadata?.skill?.src ?? null;
        if ((baseTicks == null || baseTicks <= 0) && (cooldownMs == null || cooldownMs <= 0)) {
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

    function readActorAttackDelay(actor) {
        if (!actorHasAutoAttack(actor)) {
            return {
                delayTicks: null,
                delayRemainingTicks: null,
                delayReady: null
            };
        }

        if (actor?.isMeditating === true) {
            return {
                delayTicks: null,
                delayRemainingTicks: null,
                delayReady: null
            };
        }

        const autoCd = resolveActorAutoAttackCooldown(actor);
        let delayTicks = readStatBagLive(actor?.attackDelay);
        if (delayTicks == null || delayTicks <= 0) {
            delayTicks = readComponentNumber(autoCd, [
                '_baseCooldown', 'baseCooldown', 'baseCooldownTicks', 'cooldownTicks'
            ]);
        }

        if (!autoCd) {
            return {
                delayTicks: delayTicks != null && delayTicks > 0 ? delayTicks : null,
                delayRemainingTicks: null,
                delayReady: null
            };
        }

        const cdState = readCooldownComponentState(autoCd);
        const remainingTicks = cdState.remainingTicks;
        let delayReady = cdState.ready;
        if (delayReady == null) {
            try {
                if (autoCd.isOnCooldown === false) delayReady = true;
                else if (autoCd.isOnCooldown === true) delayReady = false;
            } catch { /* ignore */ }
        }

        if (delayTicks == null || delayTicks <= 0) {
            const fromCd = readComponentNumber(autoCd, [
                '_baseCooldown', 'baseCooldown', 'baseCooldownTicks', 'cooldownTicks'
            ]);
            if (fromCd != null && fromCd > 0) delayTicks = fromCd;
        }

        return {
            delayTicks: delayTicks != null && delayTicks > 0 ? delayTicks : null,
            delayRemainingTicks: remainingTicks,
            delayReady
        };
    }

    function readActorAttackSpeed(actor, metadata) {
        const attackDelayInfo = readActorAttackDelay(actor);
        const delayTicks = attackDelayInfo.delayTicks;
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

    function expectsTimedAbilityCooldown(actor, metadata) {
        if (!metadata?.skill?.src || !actor) return false;
        if (metadataHasNoTimedAbilityCooldown(metadata)) return false;
        if (findActorCooldownComponent(actor, metadata)) return true;
        const direct = actor.abilityCooldown ?? actor.skillCooldown;
        return direct != null && isAbilityCooldownCandidate(actor, direct, metadata);
    }

    function warnUnitsStatGaps(unit, metadata, cooldownInfo, attackSpeedInfo, actor) {
        const missingStats = ['armor', 'magicResist', 'speed'].filter((k) => unit[k] == null);
        const missingMechanics = [];
        if (cooldownInfo.cooldownMs == null && expectsTimedAbilityCooldown(actor, metadata)) {
            missingMechanics.push('abilityCooldown');
        }
        if (attackSpeedInfo.value == null && actorHasAutoAttack(actor)) {
            missingMechanics.push('attackSpeed');
        }
        if (!missingStats.length && !missingMechanics.length) return;

        const logKey = unit.collapseKey || `${unit.name}:${unit.tileIndex ?? 'x'}`;
        if (unitsStatWarned.has(logKey)) return;
        unitsStatWarned.add(logKey);

        const prefix = `[${modName}][UnitsStat]`;
        if (missingStats.length) {
            console.warn(`${prefix} ${unit.name}: missing stats ${missingStats.join(', ')}`);
        }
        if (missingMechanics.length) {
            console.warn(`${prefix} ${unit.name}: missing mechanics ${missingMechanics.join(', ')}`);
        }
    }

    function probeActorFast(actor, options = {}) {
        if (!actor) return null;

        const light = options.light === true;
        if (!options.bypassCache && !light) {
            const prev = getCachedActorProbe(actor);
            if (prev) return refreshActorSnapshotFast(prev, actor, options);
        }

        const hpBag = actor.hp;
        const hpSnapshot = readActorHp(hpBag);

        const gameId = resolveGameId(actor);
        const metadata = getMonsterMetadata(gameId);
        const cooldownInfo = readActorCooldown(actor, metadata, { skipCalculator: true });
        const attackDelayInfo = readActorAttackDelay(actor);
        const statKeys = ['ad', 'ap', 'armor', 'magicResist', 'speed'];
        const stats = {};
        for (const statKey of statKeys) {
            stats[statKey] = readActorLiveStatFast(actor, statKey);
        }

        const snapshot = {
            gameId,
            name: actor.name || actor.nickname || metadata?.name || 'Unknown',
            villain: actor.villain === true,
            awaken: resolveActorAwakened(actor),
            level: actor.level ?? readActorGeneStat(actor, 'level'),
            alive: hpSnapshot.alive,
            hp: hpSnapshot.hp,
            hpMax: hpSnapshot.hpMax,
            hpPct: hpSnapshot.hpPct,
            ad: stats.ad,
            ap: stats.ap,
            armor: stats.armor,
            magicResist: stats.magicResist,
            speed: stats.speed,
            attackDelayTicks: attackDelayInfo.delayTicks ?? null,
            attackDelayRemainingTicks: attackDelayInfo.delayRemainingTicks,
            attackDelayReady: attackDelayInfo.delayReady,
            cooldownMs: cooldownInfo.cooldownMs,
            cooldownTicks: cooldownInfo.cooldownTicks,
            cooldownReady: cooldownInfo.cooldownReady,
            cooldownRemainingMs: cooldownInfo.cooldownRemainingMs,
            cooldownRemainingTicks: cooldownInfo.cooldownRemainingTicks,
            abilitySrc: cooldownInfo.abilitySrc,
            isMeditating: actor.isMeditating === true,
            silenced: actor.silenceComponent?.isSilenced === true,
            buffedCount: Array.isArray(actor.buffed) ? actor.buffed.length : null,
            statusEffects: light || !shouldShowLiveStatusEffects() ? [] : collectActorStatusEffects(actor),
            roles: Array.isArray(metadata?.roles) ? metadata.roles : [],
            baseStats: metadata?.baseStats ?? null,
            tileIndex: actor.position?.tile?.index ?? actor.position?.tileIndex ?? null,
            equipment: resolveEquipmentFromActor(actor),
            genes: light ? null : extractBoardGeneStats(actor),
            shiny: actor.shiny === true,
            source: 'fight',
            collapseKey: resolveFightCollapseKey(actor)
        };
        attachActorSnapshotMeta(snapshot, actor);
        if (!light && !options.bypassCache) setCachedActorProbe(actor, snapshot);
        return snapshot;
    }

    function refreshActorSnapshotFast(prev, actor, options = {}) {
        const light = options.light === true;
        const hpSnapshot = readActorHp(actor.hp);
        const gameId = prev.gameId ?? resolveGameId(actor);
        const metadata = getMonsterMetadata(gameId);
        const cooldownInfo = readActorCooldown(actor, metadata, { skipCalculator: true });
        const attackDelayInfo = readActorAttackDelay(actor);
        const statKeys = ['ad', 'ap', 'armor', 'magicResist', 'speed'];
        const stats = {};
        for (const statKey of statKeys) {
            stats[statKey] = readActorLiveStatFast(actor, statKey);
        }

        let statusEffects = prev.statusEffects;
        if (!shouldShowLiveStatusEffects() || light) {
            statusEffects = [];
        } else if (actorSnapshotNeedsStatusRefresh(actor, prev)) {
            statusEffects = collectActorStatusEffects(actor);
        }

        const snapshot = {
            ...prev,
            name: actor.name || actor.nickname || prev.name,
            villain: actor.villain === true,
            alive: hpSnapshot.alive,
            hp: hpSnapshot.hp,
            hpMax: hpSnapshot.hpMax,
            hpPct: hpSnapshot.hpPct,
            ad: stats.ad,
            ap: stats.ap,
            armor: stats.armor,
            magicResist: stats.magicResist,
            speed: stats.speed,
            attackDelayTicks: attackDelayInfo.delayTicks ?? null,
            attackDelayRemainingTicks: attackDelayInfo.delayRemainingTicks,
            attackDelayReady: attackDelayInfo.delayReady,
            cooldownMs: cooldownInfo.cooldownMs,
            cooldownTicks: cooldownInfo.cooldownTicks,
            cooldownReady: cooldownInfo.cooldownReady,
            cooldownRemainingMs: cooldownInfo.cooldownRemainingMs,
            cooldownRemainingTicks: cooldownInfo.cooldownRemainingTicks,
            abilitySrc: cooldownInfo.abilitySrc,
            isMeditating: actor.isMeditating === true,
            silenced: actor.silenceComponent?.isSilenced === true,
            buffedCount: Array.isArray(actor.buffed) ? actor.buffed.length : null,
            statusEffects,
            tileIndex: actor.position?.tile?.index ?? actor.position?.tileIndex ?? prev.tileIndex ?? null,
            collapseKey: prev.collapseKey ?? resolveFightCollapseKey(actor)
        };
        attachActorSnapshotMeta(snapshot, actor);
        if (!options.bypassCache) setCachedActorProbe(actor, snapshot);
        return snapshot;
    }

    function probeActor(actor) {
        if (!actor) return null;

        const hpBag = actor.hp;
        const hpSnapshot = readActorHp(hpBag);

        const gameId = resolveGameId(actor);
        const metadata = getMonsterMetadata(gameId);
        const cooldownInfo = readActorCooldown(actor, metadata, { skipCalculator: true });
        const attackDelayInfo = readActorAttackDelay(actor);
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
            hp: normalizeUnitStatValue('hp', readActorStatBase(actor, 'hp') ?? readStatBagBase(hpBag)),
            ad: normalizeUnitStatValue('ad', baseResolutions.ad.value),
            ap: normalizeUnitStatValue('ap', baseResolutions.ap.value),
            armor: normalizeUnitStatValue('armor', baseResolutions.armor.value),
            magicResist: normalizeUnitStatValue('magicResist', baseResolutions.magicResist.value),
            speed: normalizeUnitStatValue('speed', baseResolutions.speed.value)
        };
        const fightBaseStats = catalogBase ? { ...catalogBase } : {};
        for (const [key, value] of Object.entries(liveBase)) {
            if (value != null) fightBaseStats[key] = value;
        }

        const unit = {
            gameId,
            name: actor.name || actor.nickname || metadata?.name || 'Unknown',
            villain: actor.villain === true,
            awaken: resolveActorAwakened(actor),
            level: readActorStat(actor, 'level') ?? actor.level,
            alive: hpSnapshot.alive,
            hp: hpSnapshot.hp,
            hpMax: hpSnapshot.hpMax,
            hpPct: hpSnapshot.hpPct,
            ad: normalizeUnitStatValue('ad', statResolutions.ad.value),
            ap: normalizeUnitStatValue('ap', statResolutions.ap.value),
            armor: normalizeUnitStatValue('armor', statResolutions.armor.value),
            magicResist: normalizeUnitStatValue('magicResist', statResolutions.magicResist.value),
            speed: normalizeUnitStatValue('speed', statResolutions.speed.value),
            statSources: Object.fromEntries(statKeys.map((k) => [k, statResolutions[k].source])),
            attackSpeed: attackSpeedInfo.value,
            attackSpeedSource: attackSpeedInfo.source,
            attackDelayTicks: attackDelayInfo.delayTicks ?? attackSpeedInfo.delayTicks ?? null,
            attackDelayRemainingTicks: attackDelayInfo.delayRemainingTicks,
            attackDelayReady: attackDelayInfo.delayReady,
            cooldownMs: cooldownInfo.cooldownMs,
            cooldownTicks: cooldownInfo.cooldownTicks,
            cooldownReady: cooldownInfo.cooldownReady,
            cooldownRemainingMs: cooldownInfo.cooldownRemainingMs,
            cooldownRemainingTicks: cooldownInfo.cooldownRemainingTicks,
            abilitySrc: cooldownInfo.abilitySrc,
            silenced: actor.silenceComponent?.isSilenced === true,
            buffedCount: Array.isArray(actor.buffed) ? actor.buffed.length : null,
            statusEffects: shouldShowLiveStatusEffects() ? collectActorStatusEffects(actor) : [],
            roles: Array.isArray(metadata?.roles) ? metadata.roles : [],
            baseStats: Object.keys(fightBaseStats).length ? fightBaseStats : null,
            tileIndex: actor.position?.tile?.index ?? actor.position?.tileIndex ?? null,
            equipment: resolveEquipmentFromActor(actor),
            genes: extractBoardGeneStats(actor),
            shiny: actor.shiny === true,
            source: 'fight',
            collapseKey: resolveFightCollapseKey(actor)
        };

        warnUnitsStatGaps(unit, metadata, cooldownInfo, attackSpeedInfo, actor);
        return unit;
    }

    const EQUIP_STAT_ICONS = {
        hp: STAT_ICONS.hp,
        ad: STAT_ICONS.ad,
        ap: STAT_ICONS.ap,
        armor: STAT_ICONS.armor,
        mr: STAT_ICONS.magicResist,
        magicresist: STAT_ICONS.magicResist
    };

    const ABILITY_DAMAGE_TYPE_PRESENTATION = {
        physical: {
            color: '#f97316',
            icon: EQUIP_STAT_ICONS.ad,
            iconClass: 'pixelated inline -translate-x-px -translate-y-px',
            alt: 'attack damage'
        },
        magic: {
            color: '#c084fc',
            icon: EQUIP_STAT_ICONS.ap,
            iconClass: 'pixelated inline -translate-x-0.5 -translate-y-px',
            alt: 'ability power'
        },
        heal: {
            color: '#6699ff',
            icon: EQUIP_STAT_ICONS.hp,
            iconClass: 'pixelated inline -translate-x-0.5 -translate-y-px',
            alt: 'hitpoints'
        },
        trueDamage: {
            color: '#ffffff',
            icon: EQUIP_STAT_ICONS.ad,
            iconClass: 'pixelated inline -translate-x-px -translate-y-px bs-true-damage-icon',
            alt: 'true damage'
        }
    };

    const UNIT_PORTRAIT_SIZE = 34;

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

    function getUnitEquipmentPatchSig(unit) {
        const equipment = unit?.equipment;
        if (!equipment) return '';
        return [
            equipment.gameId ?? '',
            equipment.tier ?? '',
            equipment.stat ?? '',
            equipment.spriteId ?? ''
        ].join('/');
    }

    function ensureUnitCardEquipMount(card) {
        const group = card.querySelector('.bs-portrait-group');
        if (!group || group.querySelector('.bs-equip-mount')) return;
        const mount = document.createElement('div');
        mount.className = 'bs-equip-mount frame-pressed-1 shrink-0 flex items-center justify-center overflow-hidden';
        group.appendChild(mount);
    }

    function clampEquipTier(value) {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed)) return 1;
        return Math.min(5, Math.max(1, parsed));
    }

    function resolveEquipmentTierForEffectScale(equipment) {
        const raw = equipment?.tier ?? equipment?.metadata?.tier;
        const parsed = parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return null;
        return Math.min(5, Math.max(1, parsed));
    }

    /** Max-tier effect constants from chunk 235 scale linearly by equipment tier (T5 = full value). */
    function scaleEquipmentEffectForTier(maxValue, tierOrEquipment) {
        if (maxValue == null || !Number.isFinite(maxValue)) return 0;

        let tier = null;
        if (tierOrEquipment != null && typeof tierOrEquipment === 'object') {
            tier = resolveEquipmentTierForEffectScale(tierOrEquipment);
        } else {
            const parsed = parseInt(tierOrEquipment, 10);
            if (Number.isFinite(parsed)) tier = Math.min(5, Math.max(1, parsed));
        }
        if (tier == null) return maxValue;

        try {
            const utils = globalThis.state?.utils;
            if (typeof utils?.scaleEquipmentEffect === 'function') {
                const scaled = Number(utils.scaleEquipmentEffect({ value: maxValue, tier }));
                if (Number.isFinite(scaled)) return scaled;
            }
            if (typeof utils?.getEquipmentEffectForTier === 'function') {
                const scaled = Number(utils.getEquipmentEffectForTier(maxValue, tier));
                if (Number.isFinite(scaled)) return scaled;
            }
        } catch { /* ignore */ }

        return maxValue * tier / 5;
    }

    function normalizeEquipmentStatKey(stat) {
        const key = String(stat || '').toLowerCase();
        if (key === 'mr' || key === 'magicresist') return 'magicResist';
        if (key === 'hp' || key === 'ad' || key === 'ap' || key === 'armor' || key === 'magicresist' || key === 'speed') {
            return key === 'magicresist' ? 'magicResist' : key;
        }
        return stat || null;
    }

    function enrichEquipmentForStatBonus(equipment) {
        if (!equipment || equipment.gameId != null) return equipment;
        try {
            const equips = globalThis.state?.player?.getSnapshot?.()?.context?.equips;
            if (!Array.isArray(equips)) return equipment;
            for (const bag of equips) {
                const norm = normalizeEquipmentInfo(bag);
                if (!norm?.gameId) continue;
                if (equipment.spriteId != null && norm.spriteId === equipment.spriteId) {
                    return { ...equipment, gameId: norm.gameId, name: equipment.name || norm.name };
                }
                if (equipment.name && norm.name
                    && String(equipment.name).toLowerCase() === String(norm.name).toLowerCase()) {
                    return {
                        ...equipment,
                        gameId: norm.gameId,
                        spriteId: equipment.spriteId ?? norm.spriteId
                    };
                }
            }
        } catch { /* ignore */ }
        return equipment;
    }

    function getEquipStatBonusCacheSig(equipment) {
        if (!equipment) return null;
        const statKey = normalizeEquipmentStatKey(equipment.stat);
        const tier = clampEquipTier(equipment.tier);
        if (!statKey || !tier) return null;
        return [
            equipment.spriteId ?? '',
            equipment.gameId ?? '',
            statKey,
            tier
        ].join(':');
    }

    function resolveEquipmentTierStatBonus(equipment) {
        const enriched = enrichEquipmentForStatBonus(equipment);
        if (!enriched) return { statKey: null, value: null };
        const statKey = normalizeEquipmentStatKey(enriched.stat);
        const tier = clampEquipTier(enriched.tier);
        if (!statKey || !tier) return { statKey: null, value: null };

        const cacheSig = getEquipStatBonusCacheSig(enriched);
        let bestValue = null;

        try {
            const getTierBonus = globalThis.state?.utils?.getEquipmentTierBonus;
            if (typeof getTierBonus === 'function') {
                const raw = Number(getTierBonus({
                    stat: statKey,
                    tier,
                    gameId: enriched.gameId,
                    equipment: enriched
                }));
                if (Number.isFinite(raw)) bestValue = raw;
            }
        } catch { /* ignore */ }

        if (bestValue == null) {
            const tierRow = EQUIPMENT_TIER_BONUSES[tier];
            const fallback = tierRow?.[statKey];
            if (fallback != null && Number.isFinite(fallback)) bestValue = fallback;
        }

        if (cacheSig) {
            const cached = cachedEquipStatBonusBySig.get(cacheSig);
            if (bestValue == null && cached?.statKey === statKey) {
                bestValue = cached.value;
            }
        }

        const tableBonus = EQUIPMENT_TIER_BONUSES[tier]?.[statKey];
        if (bestValue != null && tableBonus != null && Number.isFinite(tableBonus) && bestValue > tableBonus) {
            bestValue = tableBonus;
        }

        if (cacheSig) {
            if (bestValue != null) {
                cachedEquipStatBonusBySig.set(cacheSig, { statKey, value: bestValue });
            } else {
                const cached = cachedEquipStatBonusBySig.get(cacheSig);
                if (cached?.statKey === statKey) return cached;
            }
        }

        if (bestValue == null) return { statKey: null, value: null };
        return { statKey, value: bestValue };
    }

    function applyEquipmentStatBonus(stats, equipment, statSources) {
        const { statKey, value } = resolveEquipmentTierStatBonus(equipment);
        if (!statKey || value == null || stats[statKey] == null || !Number.isFinite(stats[statKey])) {
            return;
        }
        stats[statKey] = Math.round(stats[statKey] + value);
        if (statSources) {
            const prev = statSources[statKey] || 'preview';
            statSources[statKey] = `${prev}+equip(+${value} ${statKey})`;
        }
    }

    function calculateTierFromStats(monster) {
        if (!monster) return 1;
        const statSum = (Number(monster.hp) || 0) +
            (Number(monster.ad) || 0) +
            (Number(monster.ap) || 0) +
            (Number(monster.armor) || 0) +
            (Number(monster.magicResist) || 0);
        if (statSum >= 80) return 5;
        if (statSum >= 70) return 4;
        if (statSum >= 60) return 3;
        if (statSum >= 50) return 2;
        return 1;
    }

    function toUnitPortraitMonster(unit) {
        const genes = unit.genes || {};
        return {
            hp: genes.hp ?? 1,
            ad: genes.ad ?? 1,
            ap: genes.ap ?? 1,
            armor: genes.armor ?? 1,
            magicResist: genes.magicResist ?? 1,
            shiny: unit.shiny === true,
            awaken: unit.awaken === true,
            awakened: unit.awaken === true,
            isAwakened: unit.awaken === true
        };
    }

    function isUnitMaxGenes(unit) {
        const level = Number(unit.level);
        if (level !== 99) return false;
        const monster = toUnitPortraitMonster(unit);
        return monster.hp === 20 &&
            monster.ad === 20 &&
            monster.ap === 20 &&
            monster.armor === 20 &&
            monster.magicResist === 20;
    }

    function isUnitAwakened(unit) {
        return unit.awaken === true;
    }

    function stripUnitPortraitLevelIndicators(slot) {
        if (!slot) return;
        slot.querySelectorAll('.pixel-font-16').forEach((element) => element.remove());
        const levelSpan = slot.querySelector('span[translate="no"]') ||
            slot.querySelector('img[alt="creature"] + span') ||
            slot.querySelector('img[alt="Monster"] + span');
        if (levelSpan) levelSpan.remove();
    }

    function applyUnitPortraitBorder(slot, unit) {
        if (!slot || !unit) return;
        const monster = toUnitPortraitMonster(unit);
        const statTier = calculateTierFromStats(monster);
        const maxGenes = isUnitMaxGenes(unit);
        const awakened = isUnitAwakened(unit);
        const shiny = monster.shiny === true;

        let rarityBg = slot.querySelector('.has-rarity, .rarity-awaken, .rarity-shiny, .rarity-hundo');
        if (!rarityBg) {
            rarityBg = document.createElement('div');
            slot.insertBefore(rarityBg, slot.firstChild);
        }

        if (maxGenes && shiny) {
            rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-shiny';
            rarityBg.removeAttribute('data-rarity');
        } else if (maxGenes) {
            rarityBg.className = 'absolute inset-0 z-1 opacity-80 rarity-hundo';
            rarityBg.removeAttribute('data-rarity');
        } else if (awakened) {
            rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-awaken';
            rarityBg.removeAttribute('data-rarity');
        } else {
            rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
            rarityBg.setAttribute('data-rarity', String(Math.min(5, statTier)));
        }

        let starIcon = slot.querySelector('img.tier-stars, img[alt="star tier"], img[alt="shiny-tier"], img[alt="hundo-tier"]');
        if (maxGenes) {
            const iconSrc = shiny ? '/assets/icons/star-tier-shiny.png' : '/assets/icons/star-tier-hundo.png';
            if (!starIcon) {
                starIcon = document.createElement('img');
                starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
                slot.appendChild(starIcon);
            }
            starIcon.src = iconSrc;
            starIcon.alt = shiny ? 'shiny-tier' : 'hundo-tier';
        } else if (awakened) {
            if (!starIcon) {
                starIcon = document.createElement('img');
                starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
                starIcon.alt = 'star tier';
                slot.appendChild(starIcon);
            }
            starIcon.src = '/assets/icons/star-tier-awaken.png';
            starIcon.alt = 'star tier';
        } else if (statTier > 1) {
            if (!starIcon) {
                starIcon = document.createElement('img');
                starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
                starIcon.alt = 'star tier';
                slot.appendChild(starIcon);
            }
            starIcon.src = `/assets/icons/star-tier-${Math.min(4, statTier)}.png`;
        } else if (starIcon) {
            starIcon.remove();
        }
    }

    function scaleUnitPortraitElement(element, size) {
        if (!element) return;
        const sizePx = `${size}px`;
        element.style.width = sizePx;
        element.style.height = sizePx;
        element.style.maxWidth = sizePx;
        element.style.maxHeight = sizePx;
        element.style.flexShrink = '0';

        const creatureImg = element.querySelector?.('img[alt="creature"]');
        if (creatureImg) {
            creatureImg.width = size;
            creatureImg.height = size;
        }
    }

    function scaleUnitEquipmentPortrait(element) {
        if (!element) return element;
        const portrait = element.classList?.contains('equipment-portrait')
            ? element
            : element.querySelector('.equipment-portrait');
        const target = portrait || element;
        scaleUnitPortraitElement(target, UNIT_PORTRAIT_SIZE);
        return target;
    }

    function extractUnitEquipmentPortrait(itemPortrait) {
        if (!itemPortrait) return null;

        let portrait = itemPortrait;
        if (itemPortrait.tagName === 'BUTTON') {
            portrait = itemPortrait.querySelector('.equipment-portrait') ||
                Array.from(itemPortrait.children).find((child) => child.tagName === 'DIV');
            if (!portrait) return null;
            portrait = portrait.cloneNode(true);
        }

        portrait.classList.add('pointer-events-none');
        return scaleUnitEquipmentPortrait(portrait);
    }

    function getEquipStatIconSrc(stat) {
        const statType = String(stat || 'ad').toLowerCase();
        return EQUIP_STAT_ICONS[statType] || EQUIP_STAT_ICONS.ad;
    }

    function createUnitEquipmentPortraitFallback(spriteId, stat, tier) {
        if (spriteId == null) return null;

        const portrait = document.createElement('div');
        portrait.className = 'equipment-portrait surface-darker relative';
        portrait.style.position = 'relative';
        portrait.style.overflow = 'hidden';

        const rarityBg = document.createElement('div');
        rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
        rarityBg.setAttribute('data-rarity', String(clampEquipTier(tier)));
        portrait.appendChild(rarityBg);

        const spriteContainer = document.createElement('div');
        spriteContainer.className = `sprite item relative id-${spriteId}`;
        const viewport = document.createElement('div');
        viewport.className = 'viewport';
        const img = document.createElement('img');
        img.alt = String(spriteId);
        img.className = 'spritesheet';
        img.style.cssText = '--cropX: 0; --cropY: 0;';
        viewport.appendChild(img);
        spriteContainer.appendChild(viewport);
        portrait.appendChild(spriteContainer);

        const statIconContainer = document.createElement('div');
        statIconContainer.className = 'absolute bottom-0 left-0 z-2 flex size-full items-end pb-px pl-0.5';
        statIconContainer.style.cssText = 'background: radial-gradient(circle at left bottom, rgba(0, 0, 0, 0.5) 6px, transparent 24px)';
        const statIcon = document.createElement('img');
        statIcon.className = 'pixelated size-[calc(11px*var(--zoomFactor))]';
        statIcon.alt = 'stat type';
        statIcon.src = getEquipStatIconSrc(stat);
        statIconContainer.appendChild(statIcon);
        portrait.appendChild(statIconContainer);

        return scaleUnitEquipmentPortrait(portrait);
    }

    function createUnitEquipmentPortrait(equipment) {
        if (!equipment || equipment.spriteId == null) return null;
        const options = {
            itemId: equipment.spriteId,
            stat: equipment.stat || 'ad',
            tier: clampEquipTier(equipment.tier)
        };

        // Use BestiaryUIComponents directly (like Hero_Editor monster portraits).
        // api.ui.components.createItemPortrait warns on every call when UI isn't loaded.
        if (window.BestiaryUIComponents?.createItemPortrait) {
            try {
                return extractUnitEquipmentPortrait(window.BestiaryUIComponents.createItemPortrait(options));
            } catch { /* fall through */ }
        }

        return createUnitEquipmentPortraitFallback(options.itemId, options.stat, options.tier);
    }

    function createUnitEmptyEquipmentPortrait() {
        const slot = document.createElement('div');
        slot.className = 'container-slot surface-dark flex items-center justify-center overflow-hidden shrink-0';
        const img = document.createElement('img');
        img.alt = 'empty equipment';
        img.src = '/assets/icons/empty-equip.png';
        img.width = 32;
        img.height = 32;
        img.className = 'pixelated opacity-60';
        slot.appendChild(img);
        scaleUnitPortraitElement(slot, UNIT_PORTRAIT_SIZE);
        return slot;
    }

    function finalizeUnitMonsterSlot(slot, unit) {
        if (!slot) return null;
        slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden shrink-0';
        slot.style.position = 'relative';
        scaleUnitPortraitElement(slot, UNIT_PORTRAIT_SIZE);
        applyUnitPortraitBorder(slot, unit);
        stripUnitPortraitLevelIndicators(slot);
        return slot;
    }

    function createUnitMonsterPortraitFallback(unit) {
        if (!unit?.gameId) return null;
        const slot = document.createElement('div');
        slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden shrink-0';
        slot.style.position = 'relative';

        const monsterImg = document.createElement('img');
        monsterImg.className = 'pixelated';
        monsterImg.alt = 'creature';
        monsterImg.src = getMonsterPortraitSrc(unit.gameId);
        slot.appendChild(monsterImg);

        return finalizeUnitMonsterSlot(slot, unit);
    }

    function createUnitMonsterPortrait(unit) {
        if (!unit?.gameId) return null;
        const monster = toUnitPortraitMonster(unit);
        const tier = calculateTierFromStats(monster);

        if (window.BestiaryUIComponents?.createMonsterPortrait) {
            try {
                const root = window.BestiaryUIComponents.createMonsterPortrait({
                    monsterId: unit.gameId,
                    level: unit.level || 1,
                    tier
                });
                const slot = root.querySelector('.container-slot');
                if (slot) {
                    slot.remove();
                    return finalizeUnitMonsterSlot(slot, unit);
                }
                return finalizeUnitMonsterSlot(root, unit);
            } catch { /* fall through */ }
        }

        return createUnitMonsterPortraitFallback(unit);
    }

    function hydrateUnitCardPortraits(card, unit) {
        if (!card || !unit) return;
        ensureUnitCardEquipMount(card);
        const equipSummary = unit.equipment ? formatEquipmentSummary(unit.equipment) : '';

        const portraitMount = card.querySelector('.bs-portrait-mount');
        if (portraitMount) {
            if (unit.gameId) {
                const portrait = createUnitMonsterPortrait(unit);
                if (portrait) portraitMount.replaceWith(portrait);
                else portraitMount.remove();
            } else {
                portraitMount.remove();
            }
        }

        const equipMount = card.querySelector('.bs-equip-mount');
        if (equipMount) {
            equipMount.innerHTML = '';
            equipMount.removeAttribute('title');
            scaleUnitPortraitElement(equipMount, UNIT_PORTRAIT_SIZE);
            if (unit.equipment?.spriteId != null) {
                const equipPortrait = createUnitEquipmentPortrait(unit.equipment);
                if (equipPortrait) {
                    if (equipSummary) equipMount.title = equipSummary;
                    equipMount.appendChild(equipPortrait);
                } else {
                    equipMount.appendChild(createUnitEmptyEquipmentPortrait());
                }
            } else {
                equipMount.appendChild(createUnitEmptyEquipmentPortrait());
            }
        }
    }

    function hydrateUnitCard(card, unit) {
        if (!card || !unit) return;
        hydrateUnitCardPortraits(card, unit);
        hydrateUnitCardAbility(card, unit);
    }

    function hydrateAllUnitPortraits(body, units) {
        if (!body || !Array.isArray(units)) return;
        const unitByKey = new Map();
        for (const unit of units) {
            unitByKey.set(normalizeCollapseKey(getUnitCollapseKey(unit)), unit);
        }
        for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
            const unit = unitByKey.get(card.dataset.unitKey);
            if (unit) hydrateUnitCard(card, unit);
        }
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
        if (resolved.equipment) {
            applyEquipmentStatBonus(stats, resolved.equipment, statSources);
        }
        const hpAfterEquip = stats.hp;
        return {
            stats,
            baseStats,
            statSources,
            hp: hpAfterEquip,
            hpMax: hpAfterEquip ?? maxHp
        };
    }

    function resolveActorAutoAttackCooldown(actor) {
        return actor?.cooldown?.autoAttack ?? actor?.autoAttackCooldown ?? null;
    }

    function actorHasAutoAttack(actor) {
        if (typeof actor?.autoAttack === 'function') {
            return !!(actor?.autoAttackCooldown ?? actor?.cooldown?.autoAttack);
        }
        if (actor?.autoAttack) return true;
        if (typeof actor?.regularAttack === 'function') {
            return !!(actor?.autoAttackCooldown ?? actor?.cooldown?.autoAttack);
        }
        return false;
    }

    function classSliceHasAutoAttackComponent(classSlice) {
        if (!classSlice) return false;
        if (/\bthis\.autoAttack\s*=\s*this\.addComponent\(\s*new\s+\w+\.A\s*\(/.test(classSlice)) {
            return true;
        }
        if (/\bregularAttack\s*=/.test(classSlice) && /\bautoAttackCooldown\b/.test(classSlice)) {
            return true;
        }
        if (/attack:this\.regularAttack/.test(classSlice)) {
            return true;
        }
        if (/\bautoAttackCooldown\b/.test(classSlice)
            && /\bthis\.autoAttack\s*=/.test(classSlice)
            && /attack:this\.autoAttack/.test(classSlice)) {
            return true;
        }
        return false;
    }

    function creatureHasAutoAttackFrom661Script(gameId, metadata) {
        const scriptText = cachedGameChunk661Text;
        if (!scriptText || gameId == null) return null;

        const skillSrc = metadata?.skill?.src;
        const monsterName = metadata?.name;
        const anchor = findMonsterMetadataAnchor(scriptText, skillSrc, monsterName);
        if (!anchor) return null;

        const classSlice = findMonsterClassSlice(scriptText, anchor.varName, anchor.index);
        if (!classSlice) return null;

        return classSliceHasAutoAttackComponent(classSlice);
    }

    function creatureHasAutoAttack(gameId, metadata, actor = null) {
        if (actor) return actorHasAutoAttack(actor);

        const fromScript = creatureHasAutoAttackFrom661Script(gameId, metadata);
        if (fromScript === true) return true;

        const catalogBase = metadata?.baseStats?.attackDelayTicks;
        const hasCatalogAttackDelay = catalogBase != null && Number.isFinite(Number(catalogBase));
        if (fromScript === false) return hasCatalogAttackDelay;

        return hasCatalogAttackDelay;
    }

    function resolvePreviewAttackDelayTicks(resolved, metadata) {
        return resolvePreviewAttackDelayDetailed(resolved, metadata).ticks;
    }

    function resolvePreviewAttackDelayDetailed(resolved, metadata) {
        if (!creatureHasAutoAttack(resolved?.gameId, metadata)) {
            return {
                ticks: null,
                reason: 'no auto-attack',
                catalogBase: null
            };
        }

        const catalogBase = metadata?.baseStats?.attackDelayTicks;
        if (catalogBase == null || !Number.isFinite(Number(catalogBase))) {
            const defaultTicks = msToGameCooldownTicks(DEFAULT_PREVIEW_ATTACK_DELAY_MS);
            return {
                ticks: roundTrackValue(defaultTicks, 'attackDelayTicks'),
                reason: null,
                catalogBase: null,
                usedDefault: true,
                scaleSource: `default ${DEFAULT_PREVIEW_ATTACK_DELAY_MS}ms (game mL)`
            };
        }

        if (resolved.villain) {
            return {
                ticks: roundTrackValue(Number(catalogBase), 'attackDelayTicks'),
                reason: null,
                catalogBase: Number(catalogBase)
            };
        }

        const actor = buildBoardPreviewStatActor(resolved, 0);
        const scaled = scaleActorCatalogStatDetailed(actor, metadata, 'attackDelayTicks');
        const ticks = scaled.value ?? Number(catalogBase);
        return {
            ticks: roundTrackValue(ticks, 'attackDelayTicks'),
            reason: null,
            catalogBase: Number(catalogBase),
            scaleSource: scaled.source
        };
    }

    function logPreviewPlacementMechanics(resolved, source, metadata, mechanics, attackDelayDetail, cdDetail) {
        const unitKey = buildStablePreviewKey(resolved, resolveCurrentRoomId());
        const sig = [
            unitKey,
            source,
            mechanics.attackDelayTicks,
            mechanics.cooldownTicks,
            cdDetail?.reason,
            attackDelayDetail?.reason
        ].join('|');
        if (previewMechanicsLogSig.get(unitKey) === sig) return;
        previewMechanicsLogSig.set(unitKey, sig);

        const prefix = `[${modName}][PreviewMechanics]`;
        const team = resolved.villain ? 'enemy' : 'ally';
        const label = `${resolved.name} (#${resolved.gameId}, ${team}, tile ${resolved.tileIndex ?? '?'}, source=${source})`;

        if (mechanics.attackDelayTicks != null) {
            let atkLine = `${prefix} ${label} atk delay: ${formatTicks(mechanics.attackDelayTicks)}`;
            if (attackDelayDetail?.usedDefault) {
                atkLine += ` (${attackDelayDetail.scaleSource})`;
            } else if (attackDelayDetail?.catalogBase != null) {
                atkLine += ` (catalog ${attackDelayDetail.catalogBase}`;
                if (attackDelayDetail.scaleSource) atkLine += `, ${attackDelayDetail.scaleSource}`;
                atkLine += ')';
            }
            console.log(atkLine);
        } else if (attackDelayDetail?.reason === 'no auto-attack') {
            console.log(`${prefix} ${label} atk delay: n/a — ${attackDelayDetail.reason}`);
        } else {
            console.log(`${prefix} ${label} atk delay: missing — ${attackDelayDetail?.reason ?? 'unknown'}`);
        }

        if (mechanics.cooldownTicks != null) {
            let cdLine = `${prefix} ${label} ability CD: ${formatTicks(mechanics.cooldownTicks)}`;
            if (mechanics.cooldownMs != null) cdLine += ` (${mechanics.cooldownMs}ms)`;
            cdLine += ` via ${cdDetail?.source ?? 'unknown'}`;
            console.log(cdLine);
        } else if (cdDetail?.reason === 'passive ability (no timed CD)') {
            console.log(`${prefix} ${label} ability CD: n/a — ${cdDetail.reason}`);
        } else {
            console.log(`${prefix} ${label} ability CD: missing — ${cdDetail?.reason ?? 'unknown'}`);
        }
    }

    function resolvePreviewInitialAbilityCooldownTicks(metadata) {
        const scriptText = cachedGameChunk661Text;
        const skillSrc = metadata?.skill?.src;
        if (!scriptText || !skillSrc) return null;

        const anchor = findMonsterMetadataAnchor(scriptText, skillSrc, metadata?.name);
        if (!anchor) return null;
        const classSlice = findMonsterClassSlice(scriptText, anchor.varName, anchor.index);
        if (!classSlice) return null;

        for (const { component, body } of iteratePreviewCooldownClockInits(classSlice)) {
            if (component !== 'abilityCooldown') continue;
            const initMatch = body.match(/initialCooldownTicks:([\w$.]+)/);
            if (!initMatch) continue;
            const ref = initMatch[1];
            const hxInline = ref.match(/\(0,\w+\.HX\)\(([\d.e]+)\)/);
            if (hxInline) {
                const ms = Number(hxInline[1]);
                if (Number.isFinite(ms) && ms > 0) {
                    return roundTrackValue(msToGameCooldownTicks(ms), 'abilityCdTicks');
                }
            }
            const constMatch = ref.match(/(\w+)\.INITIAL_COOLDOWN_TICKS/);
            if (constMatch) {
                const defs = findScriptConstDefinitions(scriptText, constMatch[1], anchor.index);
                const fields = defs[0]?.fields;
                const raw = fields?.INITIAL_COOLDOWN_TICKS;
                if (raw != null && Number.isFinite(raw) && raw > 0) {
                    return roundTrackValue(msToGameCooldownTicks(raw), 'abilityCdTicks');
                }
            }
        }
        return null;
    }

    function resolvePreviewMechanics(resolved, metadata, previewStats, source) {
        const cacheKey = [
            buildStablePreviewKey(resolved, resolveCurrentRoomId()),
            source,
            getBoardPreviewCacheSig(),
            previewStats.stats.ap,
            previewStats.stats.ad,
            previewEquipmentSig(resolved.equipment)
        ].join('|');
        const cached = previewMechanicsResultCache.get(cacheKey);
        if (cached) return cached;

        const equipment = resolved.equipment ?? null;
        const partialUnit = {
            gameId: resolved.gameId,
            name: resolved.name,
            villain: resolved.villain,
            tileIndex: resolved.tileIndex,
            ap: previewStats.stats.ap,
            equipment,
            collapseKey: buildStablePreviewKey(resolved, resolveCurrentRoomId())
        };
        const attackDelayDetail = resolvePreviewAttackDelayDetailed(resolved, metadata);
        const cdDetail = resolvePreviewAbilityCooldownDetailed(partialUnit, metadata);
        const abilityCooldown = cdDetail.result;
        const mechanics = {
            attackDelayTicks: attackDelayDetail.ticks,
            attackDelayReady: attackDelayDetail.ticks != null ? true : null,
            attackDelayRemainingTicks: null,
            cooldownTicks: abilityCooldown?.cooldownTicks ?? null,
            cooldownMs: abilityCooldown?.cooldownMs ?? null,
            cooldownReady: abilityCooldown ? true : null,
            cooldownRemainingTicks: null,
            previewInitialCooldownTicks: resolvePreviewInitialAbilityCooldownTicks(metadata)
        };
        logPreviewPlacementMechanics(resolved, source, metadata, mechanics, attackDelayDetail, cdDetail);
        previewMechanicsResultCache.set(cacheKey, mechanics);
        return mechanics;
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
            const [, roomId, gameId, tile] = fightEnemy;
            const rid = resolveCurrentRoomId() ?? roomId ?? 'x';
            if (/^\d+$/.test(gameId)) {
                return `preview:enemy:${rid}:${gameId}:${tile}`;
            }
            return `preview:enemy:${roomId}:${gameId}:${tile}`;
        }
        return key;
    }

    function readMapOverride(map, key) {
        const normalized = normalizeCollapseKey(key);
        if (map.has(normalized)) return map.get(normalized);
        if (normalized !== key && map.has(key)) return map.get(key);
        return undefined;
    }

    function writeMapOverride(map, key, value) {
        const normalized = normalizeCollapseKey(key);
        map.set(normalized, value);
        if (normalized !== key) map.delete(key);
    }

    function readCollapsedOverride(key) {
        return readMapOverride(collapsedOverrides, key);
    }

    function writeCollapsedOverride(key, collapsed) {
        writeMapOverride(collapsedOverrides, key, collapsed === true);
    }

    function readOpenAbilityOverride(key) {
        return readMapOverride(openAbilityOverrides, key);
    }

    function rememberOpenAbilityOverride(key, open) {
        writeMapOverride(openAbilityOverrides, key, open === true);
    }

    function writeOpenAbilityOverride(key, open) {
        rememberOpenAbilityOverride(key, open);
        markUnitsInteraction();
    }

    function snapshotOpenAbilityKeysFromDom(body) {
        if (!body) return;
        for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
            const details = card.querySelector('.bs-ability-details');
            if (!details || !card.dataset.unitKey) continue;
            rememberOpenAbilityOverride(card.dataset.unitKey, details.open);
        }
    }

    function clearOpenAbilityOverrides() {
        openAbilityOverrides.clear();
    }

    function defaultUnitAbilityOpen() {
        return false;
    }

    function isUnitAbilityOpen(unit) {
        const key = normalizeCollapseKey(getUnitCollapseKey(unit));
        const stored = readOpenAbilityOverride(key);
        if (stored !== undefined) return stored;
        return defaultUnitAbilityOpen();
    }

    function isPanelElementVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function isPointInPanelScrollContent(clientX, clientY) {
        for (const id of [SUMMARY_BODY_ID, UNITS_BODY_ID, LOG_BODY_ID]) {
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
        if (e.target.closest('.bs-ability-details, .bs-ability-summary, details, summary, a, button, input, label, .bs-switch')) return;
        const card = e.target.closest('.bs-card');
        if (!card) return;
        const key = card.getAttribute('data-unit-key');
        if (!key) return;
        const currentlyCollapsed = readCollapsedOverride(key) ?? defaultUnitCollapsed();
        const nextCollapsed = !currentlyCollapsed;
        writeCollapsedOverride(key, nextCollapsed);
        applyUnitCardCollapsedState(card, nextCollapsed);
        markUnitsInteraction();
    }

    function ensureUnitsBodyListener() {
        const body = document.getElementById(UNITS_BODY_ID);
        if (!body) return;
        if (!unitsBodyClickHandler) {
            unitsBodyClickHandler = handleUnitsBodyPointerDown;
            body.addEventListener('pointerdown', unitsBodyClickHandler, true);
        }
        ensureUnitsBodyAbilityListener();
    }

    function teardownUnitsBodyListener() {
        const body = document.getElementById(UNITS_BODY_ID);
        if (body && unitsBodyClickHandler) {
            body.removeEventListener('pointerdown', unitsBodyClickHandler, true);
        }
        unitsBodyClickHandler = null;
        teardownUnitsBodyAbilityListener();
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
                awaken: isBoardPlayerPieceAwakened(piece, monster),
                level,
                genes: extractBoardGeneStats(monster),
                shiny: monster.shiny === true,
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
            awaken: hasCreatureAwakenFlags(piece, piece.monster) ||
                (Number(piece.tier) === 5 && piece.type === 'player'),
            level: resolveBoardPieceLevel(piece, null),
            genes: extractBoardGeneStats(piece),
            shiny: piece.shiny === true,
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
        const mechanics = resolvePreviewMechanics(resolved, metadata, previewStats, source);
        return {
            gameId: resolved.gameId,
            name: resolved.name,
            villain: resolved.villain,
            awaken,
            level: resolved.level,
            hp: normalizeUnitStatValue('hp', previewStats.hp),
            hpMax: normalizeUnitStatValue('hpMax', previewStats.hpMax),
            ad: normalizeUnitStatValue('ad', stats.ad),
            ap: normalizeUnitStatValue('ap', stats.ap),
            armor: normalizeUnitStatValue('armor', stats.armor),
            magicResist: normalizeUnitStatValue('magicResist', stats.magicResist),
            speed: normalizeUnitStatValue('speed', stats.speed),
            statSources,
            roles: Array.isArray(metadata?.roles) ? metadata.roles : [],
            baseStats: Object.keys(baseStats).some((k) => baseStats[k] != null) ? baseStats : null,
            abilitySrc: metadata?.skill?.src ?? null,
            attackDelayTicks: mechanics.attackDelayTicks,
            attackDelayReady: mechanics.attackDelayReady,
            attackDelayRemainingTicks: mechanics.attackDelayRemainingTicks,
            cooldownTicks: mechanics.cooldownTicks,
            cooldownMs: mechanics.cooldownMs,
            cooldownReady: mechanics.cooldownReady,
            cooldownRemainingTicks: mechanics.cooldownRemainingTicks,
            previewInitialCooldownTicks: mechanics.previewInitialCooldownTicks,
            source,
            roomId: roomId ?? null,
            tileIndex: resolved.tileIndex,
            equipment: resolved.equipment ?? null,
            genes: resolved.genes ?? null,
            shiny: resolved.shiny === true,
            mergeKey: unitKey,
            collapseKey: unitKey,
            alive: true
        };
    }

    function hasEquipmentTierBonusUtils() {
        const utils = globalThis.state?.utils;
        return typeof utils?.getEquipmentTierBonus === 'function'
            || typeof utils?.getEquipmentStatValue === 'function'
            || typeof utils?.scaleEquipmentStat === 'function';
    }

    function findBoardResolvedForPreviewUnit(unit) {
        if (!unit?.gameId) return null;

        const roomId = unit.roomId ?? resolveCurrentRoomId();
        const matchResolved = (resolved) => {
            if (!resolved || resolved.gameId !== unit.gameId) return false;
            if (unit.villain != null && resolved.villain !== unit.villain) return false;
            if (unit.tileIndex != null && resolved.tileIndex != null && resolved.tileIndex !== unit.tileIndex) {
                return false;
            }
            if (unit.identity && resolved.identity && unit.identity !== resolved.identity) return false;
            return true;
        };

        const config = getBoardContext()?.boardConfig;
        if (Array.isArray(config)) {
            for (const piece of config) {
                const resolved = resolveBoardPiece(piece);
                if (matchResolved(resolved)) return { resolved, source: 'board' };
            }
        }

        const getBoardMonsters = globalThis.state?.utils?.getBoardMonstersFromRoomId;
        if (roomId && typeof getBoardMonsters === 'function') {
            try {
                for (const piece of getBoardMonsters(roomId) || []) {
                    const resolved = resolveBoardPiece(piece);
                    if (matchResolved(resolved)) return { resolved, source: 'map' };
                }
            } catch { /* ignore */ }
        }

        return null;
    }

    function previewEquipmentSig(equipment) {
        if (!equipment) return '';
        const name = equipment?.name ?? equipment?.metadata?.name ?? '';
        const tier = equipment?.tier ?? equipment?.metadata?.tier ?? '';
        const stat = equipment?.stat ?? equipment?.metadata?.stat ?? '';
        return `${name}|${tier}|${stat}`;
    }

    function applyPreviewStatsToUnit(unit, resolved, previewStats, metadata, source) {
        const previewFloor = resolved.villain ? resolveCurrentFloor() : 0;
        const awaken = resolved.villain
            ? resolveVillainAwakenForFloor(resolved, previewFloor)
            : resolved.awaken === true;
        const { stats, baseStats, statSources } = previewStats;
        const equipmentSig = previewEquipmentSig(resolved.equipment);
        const prevEquipmentSig = previewEquipmentSig(unit.equipment);
        const mechanicsChanged = equipmentSig !== prevEquipmentSig
            || stats.ap !== unit.ap
            || stats.ad !== unit.ad;

        const next = {
            ...unit,
            awaken,
            level: resolved.level,
            hp: normalizeUnitStatValue('hp', previewStats.hp),
            hpMax: normalizeUnitStatValue('hpMax', previewStats.hpMax),
            ad: normalizeUnitStatValue('ad', stats.ad),
            ap: normalizeUnitStatValue('ap', stats.ap),
            armor: normalizeUnitStatValue('armor', stats.armor),
            magicResist: normalizeUnitStatValue('magicResist', stats.magicResist),
            speed: normalizeUnitStatValue('speed', stats.speed),
            statSources,
            baseStats: Object.keys(baseStats).some((k) => baseStats[k] != null) ? baseStats : null,
            equipment: resolved.equipment ?? null,
            genes: resolved.genes ?? unit.genes ?? null,
            tileIndex: resolved.tileIndex ?? unit.tileIndex
        };

        if (mechanicsChanged) {
            const mechanics = resolvePreviewMechanics(resolved, metadata, previewStats, source);
            next.attackDelayTicks = mechanics.attackDelayTicks;
            next.attackDelayReady = mechanics.attackDelayReady;
            next.attackDelayRemainingTicks = mechanics.attackDelayRemainingTicks;
            next.cooldownTicks = mechanics.cooldownTicks;
            next.cooldownMs = mechanics.cooldownMs;
            next.cooldownReady = mechanics.cooldownReady;
            next.cooldownRemainingTicks = mechanics.cooldownRemainingTicks;
            next.previewInitialCooldownTicks = mechanics.previewInitialCooldownTicks;
        }

        return next;
    }

    function refreshBoardPreviewUnitStats(unit) {
        if (!unit || isFightActive()) return unit;
        if (unit.source !== 'board' && unit.source !== 'map') return unit;

        const found = findBoardResolvedForPreviewUnit(unit);
        if (!found) return unit;

        const metadata = getMonsterMetadata(found.resolved.gameId);
        const previewStats = resolveBoardPreviewStats(found.resolved);
        return applyPreviewStatsToUnit(
            unit,
            found.resolved,
            previewStats,
            metadata,
            found.source
        );
    }

    function getBoardPreviewCacheSig() {
        return [
            resolveCurrentRoomId() ?? '',
            resolveCurrentFloor(),
            boardTrack.configSig || getBoardConfigSignature(getBoardContext()?.boardConfig),
            cachedGameChunk661Text ? '1' : '0',
            cachedGameChunk235Text ? '1' : '0',
            hasEquipmentTierBonusUtils() ? '1' : '0'
        ].join('|');
    }

    function invalidateBoardPreviewCache(options = {}) {
        cachedBoardPreviewUnits = null;
        cachedBoardPreviewSig = '';
        cachedRefreshedBoardPreviewUnits = null;
        cachedRefreshedBoardPreviewSig = '';
        previewMechanicsResultCache.clear();
        cachedCdrScriptBounds.clear();
        lastBoardAbilityPollMs = 0;
        if (options.clearMechanicsLog) {
            previewMechanicsLogSig.clear();
        }
    }

    function clearScalingRuntimeCaches() {
        cachedEquipStatBonusBySig.clear();
    }

    function getRefreshedBoardPreviewUnits() {
        return profileUnitsLag('getRefreshedBoardPreviewUnits', () => {
            const cacheSig = getBoardPreviewCacheSig();
            if (cachedRefreshedBoardPreviewUnits && cachedRefreshedBoardPreviewSig === cacheSig) {
                return cachedRefreshedBoardPreviewUnits;
            }
            const boardCacheHit = cachedBoardPreviewUnits != null && cachedBoardPreviewSig === cacheSig;
            const units = getBoardPreviewUnits();
            cachedRefreshedBoardPreviewUnits = boardCacheHit
                ? units.map((unit) => refreshBoardPreviewUnitStats(unit))
                : units;
            cachedRefreshedBoardPreviewSig = cacheSig;
            return cachedRefreshedBoardPreviewUnits;
        });
    }

    function getBoardPreviewUnits() {
        return profileUnitsLag('getBoardPreviewUnits', () => {
            if (!cachedGameChunk661Text || !cachedGameChunk235Text) {
                prefetchGameChunk661ForCdr();
            }
            const cacheSig = getBoardPreviewCacheSig();
            if (cachedBoardPreviewUnits && cachedBoardPreviewSig === cacheSig) {
                return cachedBoardPreviewUnits;
            }

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

            cachedBoardPreviewUnits = Array.from(merged.values());
            cachedBoardPreviewSig = cacheSig;
            return cachedBoardPreviewUnits;
        });
    }

    function collectActorMechanicsSnapshots() {
        if (!isFightActive()) return null;
        const world = getActiveWorld();
        const actors = world?.grid?.actors;
        if (!Array.isArray(actors) || !actors.length) return null;

        const snapshots = [];
        for (const actor of actors) {
            if (!actor) continue;
            const gameId = resolveGameId(actor);
            const metadata = getMonsterMetadata(gameId);
            const hpSnapshot = readActorHp(actor.hp);
            const cooldownInfo = readActorCooldown(actor, metadata, { skipCalculator: true });
            const attackDelayInfo = readActorAttackDelay(actor);
            snapshots.push({
                gameId,
                name: actor.name || actor.nickname || metadata?.name || 'Unknown',
                villain: actor.villain === true,
                level: actor.level ?? readActorGeneStat(actor, 'level'),
                alive: hpSnapshot.alive,
                hp: hpSnapshot.hp,
                hpMax: hpSnapshot.hpMax,
                attackDelayTicks: attackDelayInfo.delayTicks ?? null,
                attackDelayRemainingTicks: attackDelayInfo.delayRemainingTicks,
                attackDelayReady: attackDelayInfo.delayReady,
                cooldownTicks: cooldownInfo.cooldownTicks,
                cooldownReady: cooldownInfo.cooldownReady,
                cooldownRemainingTicks: cooldownInfo.cooldownRemainingTicks,
                isMeditating: actor.isMeditating === true,
                tileIndex: actor.position?.tile?.index ?? actor.position?.tileIndex ?? null,
                source: 'fight',
                collapseKey: resolveFightCollapseKey(actor)
            });
        }
        return snapshots;
    }

    function collectActorSnapshots(options = {}) {
        return profileUnitsLag('collectActorSnapshots', () => {
        if (!isFightActive()) {
            invalidateActorSnapshotsCache();
            return null;
        }
        const world = getActiveWorld();
        const cacheTick = resolveLiveEngineTick(world);
        const light = options.light === true;
        if (!options.bypassCache
            && !light
            && cacheTick != null
            && cachedActorSnapshots
            && cachedActorSnapshotsTick === cacheTick) {
            return cachedActorSnapshots;
        }
        if (!world?.grid) return null;
        const actors = world.grid.actors || [];
        let snapshots = actors.map((a) => probeActorFast(a, { light })).filter(Boolean);
        if (light && cachedActorSnapshots?.length) {
            const fullByKey = new Map(
                cachedActorSnapshots.map((u) => [normalizeCollapseKey(getUnitCollapseKey(u)), u])
            );
            snapshots = snapshots.map((unit) => {
                const full = fullByKey.get(normalizeCollapseKey(getUnitCollapseKey(unit)));
                if (!full) return unit;
                return {
                    ...unit,
                    statusEffects: shouldShowLiveStatusEffects() ? full.statusEffects : [],
                    genes: full.genes
                };
            });
        }
        if (!light && cacheTick != null) {
            cachedActorSnapshots = snapshots;
            cachedActorSnapshotsTick = cacheTick;
        }
        return snapshots;
        });
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

    function getAbilityInfo(gameId) {
        if (gameId == null) return null;
        const skill = getMonsterMetadata(gameId)?.skill;
        if (!skill) return null;
        const src = normalizeSpellSrc(skill.src) || skill.src || null;
        return {
            name: skill.name || humanizeEffectSrc(src) || 'Ability',
            src,
            icon: resolveSkillIcon(skill),
            TooltipContent: skill.TooltipContent || null
        };
    }

    function logAbilityScaling() {
        // intentionally empty — no runtime debug logging
    }

    function resolveBoardAbilityScalingUnit(_details, unit) {
        return resolveUnitAbilityScalingStats(unit) || unit;
    }

    function getAbilityTooltipDisplaySnapshot(root) {
        if (!root) return null;
        const scaled = root.querySelector('.bs-scaled-value');
        return {
            scaledText: scaled?.textContent?.trim() || null,
            scaledTitle: scaled?.title || null,
            wrapCount: root.querySelectorAll('span.whitespace-nowrap').length
        };
    }

    function abilityTooltipHasScalableWraps(root) {
        if (!root) return false;
        for (const wrap of root.querySelectorAll('span.whitespace-nowrap')) {
            if (getTooltipWrapSpans(wrap).length >= 2) return true;
        }
        return false;
    }

    function abilityTooltipCanRescale(root) {
        if (!root) return false;
        if (abilityTooltipHasScalableWraps(root)) return true;
        if (root.querySelector('.text-cooldown')) return true;
        if (root.querySelector('.text-abilityPower, .text-villain')) return true;
        return false;
    }

    function abilityTooltipCanRescaleFromHtml(html) {
        if (!html || !String(html).trim()) return false;
        const probe = document.createElement('div');
        probe.innerHTML = html;
        return abilityTooltipCanRescale(probe);
    }

    function abilityTooltipCanRescaleFromTemplate(details) {
        const template = getAbilityTooltipTemplate(details);
        return template ? abilityTooltipCanRescaleFromHtml(template) : false;
    }

    function markAbilityTooltipScalingApplied(details, unit, scalingKey) {
        if (!details) return;
        syncAbilityDetailsDataset(details, unit);
        if (scalingKey) {
            details.dataset.abilityAppliedScalingKey = scalingKey;
            details.dataset.abilityMountKey = scalingKey;
        }
    }

    function getTooltipWrapSpans(wrap) {
        if (!wrap) return [];
        if (typeof wrap.querySelectorAll === 'function') {
            try {
                const scoped = wrap.querySelectorAll(':scope > span');
                if (scoped.length >= 2) return [...scoped];
            } catch { /* ignore */ }
        }
        return [...wrap.children].filter((node) => node.tagName === 'SPAN');
    }

    function freezeAbilityTooltipContent(details, root, component, scalingKey) {
        if (!root) return;
        const html = root.innerHTML;
        if (component?.unmount) {
            try { component.unmount(); } catch (error) {
                logAbilityScaling('unmount failed', error);
            }
        }
        if (details) details._abilityComponent = null;
        root.innerHTML = html;
        root.dataset.abilityScaled = '1';
        if (details && scalingKey) {
            details.dataset.abilityAppliedScalingKey = scalingKey;
            details.dataset.abilityMountKey = scalingKey;
        }
        logAbilityScaling('frozen tooltip html', {
            scaled: root.querySelectorAll('.bs-scaled-value').length,
            wraps: root.querySelectorAll('span.whitespace-nowrap').length
        });
    }

    function parseTooltipPercentText(text) {
        const match = String(text || '').trim().match(/^([+-]?[\d.]+)%$/);
        return match ? parseFloat(match[1]) : null;
    }

    function parseTooltipLabeledPercentText(text) {
        const trimmed = String(text || '').trim();
        const plain = parseTooltipPercentText(trimmed);
        if (plain != null) {
            const sign = trimmed.startsWith('-') ? '-' : (trimmed.startsWith('+') ? '+' : '');
            return { percent: plain, sign, label: '' };
        }
        const match = trimmed.match(/^([+-]?)([\d.]+)%\s*(.*)$/i);
        if (!match) return null;
        const percent = parseFloat(match[2]);
        if (!Number.isFinite(percent)) return null;
        const sign = match[1] || (percent < 0 ? '-' : '+');
        const label = match[3] ? ` ${match[3]}` : '';
        return { percent, sign, label };
    }

    function parseTooltipFlatText(text) {
        const match = String(text || '').trim().match(/^([+-]?[\d.]+)$/);
        return match ? parseFloat(match[1]) : null;
    }

    function parseTooltipHealAmountText(text) {
        const match = String(text || '').trim().match(/^([+-]?[\d.]+)\s*HP$/i);
        return match ? parseFloat(match[1]) : null;
    }

    function isHealPerStatChunkMarkerSpan(span) {
        const container = span?.closest?.('p, li');
        if (!container) return false;
        const ctx = container.textContent || '';
        if (!/\bper\b/i.test(ctx)) return false;
        if (!/\b(heal|heals|self-heals?|restores|regenerates)\b/i.test(ctx)) return false;
        for (const candidate of container.querySelectorAll('.text-healing')) {
            if (candidate === span || candidate.classList.contains('bs-scaled-value')) continue;
            if (parseTooltipHealAmountText(candidate.textContent?.trim()) != null) return true;
        }
        return false;
    }

    function trimTooltipPerLabelAfterNode(node) {
        if (!node?.parentNode) return;
        let next = node.nextSibling;
        while (next) {
            if (next.nodeType !== Node.TEXT_NODE) break;
            const text = next.textContent || '';
            if (!/\bper\b/i.test(text)) break;
            const trimmed = text.replace(/\s*per\s*/i, ' ').replace(/^\s+/, '');
            if (!trimmed.trim()) {
                const remove = next;
                next = next.nextSibling;
                remove.remove();
                continue;
            }
            next.textContent = trimmed;
            break;
        }
        normalizeTooltipPunctuationSpacing(node);
    }

    function normalizeTooltipPunctuationSpacing(node) {
        if (!node?.parentNode) return;
        const next = node.nextSibling;
        if (next?.nodeType === Node.TEXT_NODE) {
            const text = next.textContent || '';
            const fixed = text.replace(/^\s+([,.;:!?])/g, '$1');
            if (fixed !== text) next.textContent = fixed;
        }
    }

    function resolveAbilityScalingStatInfo(wrap, unit) {
        const img = wrap?.querySelector?.('img[alt]');
        const alt = String(img?.getAttribute('alt') || '').toLowerCase();
        if (alt.includes('ability power') || alt.includes('abilitypower')) {
            return { value: unit?.ap, label: 'AP' };
        }
        if (alt.includes('attack damage') || alt.includes('attackdamage')) {
            return { value: unit?.ad, label: 'AD' };
        }
        if (alt.includes('hp') || alt.includes('heal')) {
            return { value: unit?.hp, label: 'HP' };
        }
        if (unit?.ap != null) return { value: unit.ap, label: 'AP' };
        if (unit?.ad != null) return { value: unit.ad, label: 'AD' };
        return { value: null, label: 'stat' };
    }

    function resolveAbilityScalingStat(wrap, unit) {
        return resolveAbilityScalingStatInfo(wrap, unit).value;
    }

    function parseTooltipPerChunkRatio(text) {
        const trimmed = String(text || '').trim();
        const durationMatch = trimmed.match(/^([+-]?[\d.]+)s\s*(?:per|for\s+every)\s*([\d.]+)$/i);
        if (durationMatch) {
            const amount = parseFloat(durationMatch[1]);
            const chunkSize = parseFloat(durationMatch[2]);
            if (!Number.isFinite(amount) || !Number.isFinite(chunkSize) || chunkSize <= 0) return null;
            return { amount, isPercent: false, chunkSize, isDuration: true };
        }

        const match = trimmed.match(/^([+-]?[\d.]+)(%?)\s*(?:per|for\s+every)\s*([\d.]+)$/i);
        if (match) {
            const amount = parseFloat(match[1]);
            const chunkSize = parseFloat(match[3]);
            if (!Number.isFinite(amount) || !Number.isFinite(chunkSize) || chunkSize <= 0) return null;
            return { amount, isPercent: match[2] === '%', chunkSize, isDuration: false };
        }

        // Game x tooltip: ratio ends with "per" and the stat icon is a sibling (e.g. Monk "+2 per" + AP).
        const implicitMatch = trimmed.match(/^([+-]?[\d.]+)(%?)\s*(?:per|for\s+every)\s*$/i);
        if (implicitMatch) {
            const amount = parseFloat(implicitMatch[1]);
            if (!Number.isFinite(amount)) return null;
            return { amount, isPercent: implicitMatch[2] === '%', chunkSize: 1, isDuration: false };
        }

        return null;
    }

    function parseTooltipPerStatPercentRatio(text) {
        const trimmed = String(text || '').trim();
        const match = trimmed.match(/^([+-]?[\d.]+)%\s*(?:per|for\s+every)\s*([\d.]+)/i);
        if (!match) return null;
        const amount = parseFloat(match[1]);
        const chunkSize = parseFloat(match[2]);
        if (!Number.isFinite(amount) || !Number.isFinite(chunkSize) || chunkSize <= 0) return null;
        return { amount, chunkSize };
    }

    function stripTooltipScalingParenthetical(label) {
        const trimmed = String(label || '');
        const match = trimmed.match(/^(\s*)\(([^)]+)\)([\s\S]*)$/);
        if (!match) return trimmed;
        const inner = match[2].trim();
        if (parseTooltipPerStatPercentRatio(inner) || parseTooltipPerChunkRatio(inner)) {
            return match[3] || '';
        }
        return trimmed;
    }

    function isStandaloneDurationSpanText(text) {
        return parseTooltipDurationText(String(text || '').trim()) != null;
    }

    function isAttackSpeedScalingContext(contextText) {
        return /bonus\s+attack\s+speed|attack\s+speed\s+buff/i.test(String(contextText || ''));
    }

    function formatScalingExpression(inner, rawTotal, displayTotal, suffix = '') {
        const floored = Math.floor(rawTotal);
        if (floored === displayTotal && Math.abs(rawTotal - displayTotal) > 1e-9) {
            return `floor(${inner}) = ${displayTotal}${suffix}`;
        }
        return `${inner} = ${displayTotal}${suffix}`;
    }

    function buildScalingMathTitle(parts) {
        const {
            base,
            statValue,
            statLabel,
            total,
            suffix = '',
            cap,
            capped
        } = parts;
        let title = parts.expression;
        if (!title) return `Scaled for current stats (base ${base}${suffix})`;
        if (capped && cap != null && Number.isFinite(cap)) {
            title += ` (cap: ${cap}${suffix})`;
        }
        return title;
    }

    function buildScaledDurationResult(baseText, perChunk, statValue, statLabel) {
        const baseDurationMs = parseTooltipDurationText(baseText);
        if (baseDurationMs == null) return null;

        const amountMs = Math.round(perChunk.amount * 1000);
        const rawTotalMs = baseDurationMs + (statValue / perChunk.chunkSize) * amountMs;
        const baseTicks = msToGameCooldownTicks(baseDurationMs);
        const totalTicks = msToGameCooldownTicks(rawTotalMs);
        if (baseTicks == null || totalTicks == null) return null;

        const baseLabel = formatTicks(baseTicks);
        const totalLabel = formatTicks(totalTicks);
        const { value, suffix } = formatTicksParts(totalTicks);
        const amountTicks = msToGameCooldownTicks(amountMs);
        const amountLabel = amountTicks != null ? formatTicks(amountTicks) : `${perChunk.amount}s`;
        const inner = `${baseLabel} + (${statValue} ${statLabel} ÷ ${perChunk.chunkSize}) × ${amountLabel}`;
        const expression = `${inner} = ${totalLabel}`;
        return {
            value,
            suffix,
            title: buildScalingMathTitle({
                base: baseLabel,
                statValue,
                statLabel,
                total: totalLabel,
                suffix: '',
                expression
            })
        };
    }

    function computeScaledTooltipTotal(baseText, ratioText, statInfo, contextText) {
        const statValue = statInfo?.value;
        const statLabel = statInfo?.label || 'stat';
        if (statValue == null || !Number.isFinite(statValue)) return null;

        const perChunk = parseTooltipPerChunkRatio(ratioText);
        if (perChunk) {
            if (perChunk.isDuration) {
                const durationScaled = buildScaledDurationResult(baseText, perChunk, statValue, statLabel);
                if (durationScaled) return durationScaled;
            }

            const basePercent = parseTooltipPercentText(baseText);
            const baseFlat = parseTooltipFlatText(baseText);

            if (perChunk.isPercent || basePercent != null) {
                const base = basePercent ?? 0;
                const attackSpeed = isAttackSpeedScalingContext(contextText);
                const extra = (statValue / perChunk.chunkSize) * perChunk.amount;
                let totalPercent = base + extra;
                let capped = false;
                const capMatch = String(contextText || '').match(/capped at\s*([+-]?[\d.]+)\s*%/i);
                let cap = null;
                if (capMatch) {
                    cap = parseFloat(capMatch[1]);
                    if (Number.isFinite(cap)) {
                        const beforeCap = totalPercent;
                        totalPercent = extra < 0 || base < 0
                            ? Math.max(totalPercent, cap)
                            : Math.min(totalPercent, cap);
                        capped = beforeCap !== totalPercent;
                    }
                }
                const total = Math.floor(totalPercent);
                const amountSuffix = '%';
                const inner = `${base}${amountSuffix} + (${statValue} ${statLabel} ÷ ${perChunk.chunkSize}) × ${perChunk.amount}${amountSuffix}`;
                const expression = formatScalingExpression(inner, totalPercent, total, amountSuffix);
                return {
                    value: total,
                    suffix: amountSuffix,
                    title: buildScalingMathTitle({
                        base,
                        statValue,
                        statLabel,
                        total,
                        suffix: amountSuffix,
                        expression,
                        cap,
                        capped
                    })
                };
            }

            const base = baseFlat ?? 0;
            const rawTotal = base + (statValue / perChunk.chunkSize) * perChunk.amount;
            const total = Math.floor(rawTotal);
            const inner = `${base} + (${statValue} ${statLabel} ÷ ${perChunk.chunkSize}) × ${perChunk.amount}`;
            const expression = formatScalingExpression(inner, rawTotal, total);
            return {
                value: total,
                suffix: '',
                title: buildScalingMathTitle({
                    base,
                    statValue,
                    statLabel,
                    total,
                    expression
                })
            };
        }

        const baseFlat = parseTooltipFlatText(baseText);
        if (baseFlat == null) return null;
        if (/\bper\b/i.test(ratioText)) return null;

        const ratioMatch = String(ratioText || '').trim().match(/^([+-]?[\d.]+)/);
        const ratioFlat = ratioMatch ? parseFloat(ratioMatch[1]) : NaN;
        if (!Number.isFinite(ratioFlat)) return null;
        const rawTotal = baseFlat + statValue * ratioFlat;
        const total = Math.floor(rawTotal);
        const inner = `${baseFlat} + ${statValue} ${statLabel} × ${ratioFlat}`;
        const expression = formatScalingExpression(inner, rawTotal, total);
        return {
            value: total,
            suffix: '',
            title: buildScalingMathTitle({
                base: baseFlat,
                statValue,
                statLabel,
                total,
                expression
            })
        };
    }

    function applyScaledTooltipValue(targetSpan, baseText, scaled, originalBaseText) {
        if (!targetSpan || !scaled) return;
        const prev = targetSpan.textContent?.trim() ?? '';
        const next = `${scaled.value}${scaled.suffix}`;
        targetSpan.textContent = next;
        targetSpan.classList.add('bs-scaled-value');
        targetSpan.title = scaled.title
            || `Scaled for current stats (base ${originalBaseText ?? baseText})`;
        if (prev !== next) {
            logAbilityScaling('change:apply', {
                from: prev || (originalBaseText ?? baseText),
                to: next,
                math: scaled.title
            });
        }
    }

    function wrapHasScalingStatIcon(wrap) {
        return [...(wrap?.querySelectorAll?.('img[alt]') || [])].some((img) => {
            const alt = String(img.getAttribute('alt') || '').toLowerCase();
            return alt.includes('ability power')
                || alt.includes('attack damage')
                || alt.includes('hitpoint')
                || alt === 'hp';
        });
    }

    function shouldAppendScaledDamageIcon(wrap, baseText, scaled, contextText, statInfo) {
        if (!scaled) return false;
        if (scaled.suffix === '%' || scaled.suffix === 's' || String(scaled.suffix || '').includes('tick')) return false;
        if (parseTooltipPercentText(baseText) != null) return false;
        if (parseTooltipFlatText(baseText) == null && parseTooltipDurationText(baseText) == null) return false;

        const hasStatScaling = statInfo?.label === 'AD'
            || statInfo?.label === 'AP'
            || statInfo?.label === 'HP'
            || wrapHasScalingStatIcon(wrap);
        if (hasStatScaling) return true;

        const ctx = String(contextText || '').toLowerCase();
        if (/\bcooldown\b/.test(ctx) && /\breduced\s+by\b/.test(ctx)) return false;
        if (/\b(range|attack\s+speed|bonus\s+attack\s+speed)\b/.test(ctx)
            && !/\b(damage|deals|damaging|explosion|heal|heals|self-heal|true\s+damage)\b/.test(ctx)) {
            return false;
        }

        const hasDamageContext = /\b(damage|deals|damaging|explosion|detonates|hit|hits|strikes|burns|incinerates)\b/.test(ctx);
        const hasHealContext = /\b(heal|heals|self-heals?|restores|regenerates)\b/.test(ctx);
        const hasTrueDamageContext = /\btrue\s+damage\b/.test(ctx);
        const hasRatioIcon = wrapHasScalingStatIcon(wrap);

        return hasTrueDamageContext
            || hasHealContext
            || hasDamageContext
            || (hasRatioIcon && /\b(for|deals|damaging|explosion|heal|heals|self-heal)\b/.test(ctx));
    }

    function detectTooltipScalingDamageType(wrap, contextText, statInfo) {
        const ctx = String(contextText || '').toLowerCase();
        if (/\btrue\s+damage\b/.test(ctx)) return 'trueDamage';
        if (/\b(heal|heals|self-heals?|restores|regenerates)\b/.test(ctx)) return 'heal';

        for (const img of wrap?.querySelectorAll?.('img[alt]') || []) {
            const alt = String(img.getAttribute('alt') || '').toLowerCase();
            if (alt.includes('attack damage')) return 'physical';
            if (alt.includes('ability power')) return 'magic';
            if (alt.includes('hitpoint') || alt === 'hp') return 'heal';
        }

        if (statInfo?.label === 'AD') return 'physical';
        if (statInfo?.label === 'AP') return 'magic';
        if (statInfo?.label === 'HP') return 'heal';

        if (/\b(damage|deals|damaging|explosion|detonates)\b/.test(ctx)) return 'magic';
        return null;
    }

    function createTooltipDamageTypeIcon(damageType) {
        const spec = ABILITY_DAMAGE_TYPE_PRESENTATION[damageType];
        if (!spec) return null;
        const img = document.createElement('img');
        img.src = spec.icon;
        img.alt = spec.alt;
        img.width = 11;
        img.height = 11;
        img.className = 'pixelated inline -translate-y-px bs-scaled-damage-icon';
        img.setAttribute('aria-hidden', 'true');
        return img;
    }

    function trimTooltipWrapTrailingContent(wrap) {
        if (!wrap) return;
        let node = wrap.lastChild;
        while (node) {
            if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
                const prev = node.previousSibling;
                wrap.removeChild(node);
                node = prev;
                continue;
            }
            break;
        }
    }

    function applyScaledDamageTypePresentation(wrap, valueSpan, damageType) {
        const spec = ABILITY_DAMAGE_TYPE_PRESENTATION[damageType];
        if (!spec || !wrap || !valueSpan) return;
        valueSpan.style.color = spec.color;
        const existingIcon = wrap.querySelector('.bs-scaled-damage-icon');
        if (existingIcon) {
            existingIcon.className = 'pixelated inline -translate-y-px bs-scaled-damage-icon';
            trimTooltipWrapTrailingContent(wrap);
            return;
        }
        const icon = createTooltipDamageTypeIcon(damageType);
        if (!icon) return;
        wrap.appendChild(document.createTextNode(' '));
        wrap.appendChild(icon);
        trimTooltipWrapTrailingContent(wrap);
    }

    function formatAbilityDurationMs(ms) {
        if (ms == null || !Number.isFinite(ms)) return null;
        return formatTicks(msToGameCooldownTicks(ms));
    }

    function parseTooltipDurationText(text) {
        const match = String(text || '').trim().match(/^([+-]?[\d.]+)s$/i);
        if (!match) return null;
        const seconds = parseFloat(match[1]);
        if (!Number.isFinite(seconds)) return null;
        return Math.round(seconds * 1000);
    }

    function getWorldsForUnitProbe() {
        const worlds = [];
        const boardWorld = getBoardContext()?.world;
        if (boardWorld) worlds.push(boardWorld);
        if (activeWorld && activeWorld !== boardWorld) worlds.push(activeWorld);
        return worlds;
    }

    function findActorForPanelUnit(unit) {
        if (!unit) return null;

        const unitKey = normalizeCollapseKey(getUnitCollapseKey(unit));
        for (const world of getWorldsForUnitProbe()) {
            const actors = world?.grid?.actors;
            if (!Array.isArray(actors) || !actors.length) continue;

            for (const actor of actors) {
                if (resolveFightCollapseKey(actor) === unitKey) return actor;
            }
            for (const actor of actors) {
                if (resolveGameId(actor) !== unit.gameId) continue;
                const tile = readActorTileIndex(actor);
                if (unit.tileIndex != null && tile != null && tile !== unit.tileIndex) continue;
                if (unit.villain != null && (actor.villain === true) !== unit.villain) continue;
                return actor;
            }
        }
        return null;
    }

    function resolveUnitAbilityScalingStats(unit) {
        if (!unit) return null;

        if (unit.source === 'fight') {
            return unit;
        }

        if (unit.source === 'board' || unit.source === 'map') {
            return refreshBoardPreviewUnitStats(unit);
        }

        const actor = findActorForPanelUnit(unit);
        if (actor) {
            const metadata = getMonsterMetadata(unit.gameId);
            const hpSnapshot = readActorHp(actor.hp);
            const preferUnit = (key, actorValue) => {
                const unitValue = unit[key];
                if (unitValue != null && Number.isFinite(unitValue)) return unitValue;
                return actorValue ?? unitValue;
            };
            return {
                ...unit,
                ap: preferUnit('ap', resolveActorLiveStatDetailed(actor, metadata, 'ap').value),
                ad: preferUnit('ad', resolveActorLiveStatDetailed(actor, metadata, 'ad').value),
                hp: hpSnapshot.hp ?? unit.hp,
                hpMax: hpSnapshot.hpMax ?? unit.hpMax ?? unit.hp,
                armor: preferUnit('armor', resolveActorLiveStatDetailed(actor, metadata, 'armor').value),
                magicResist: preferUnit('magicResist', resolveActorLiveStatDetailed(actor, metadata, 'magicResist').value),
                speed: preferUnit('speed', resolveActorLiveStatDetailed(actor, metadata, 'speed').value)
            };
        }

        return unit;
    }

    function collectActorCooldownCalculatorTargets(actor) {
        if (!actor) return [];
        const targets = [actor, actor.skill, actor.ability];
        for (const cd of collectActorAbilityCooldownComponents(actor)) {
            targets.push(cd);
        }
        for (const listKey of ['componentList', 'components']) {
            const list = actor[listKey];
            if (Array.isArray(list)) targets.push(...list);
        }
        return [...new Set(targets.filter(Boolean))];
    }

    function invokeActorCooldownCalculator(actor, ap) {
        if (!actor) return null;
        const apValue = Number.isFinite(ap) ? ap : (actor.ap?.currentValue ?? actor.ap);
        for (const target of collectActorCooldownCalculatorTargets(actor)) {
            if (typeof target.calculateSpellCooldownTicks === 'function') {
                try {
                    const fn = target.calculateSpellCooldownTicks;
                    const ticks = fn.length > 0 && apValue != null
                        ? fn.call(target, apValue)
                        : fn.call(target);
                    if (Number.isFinite(ticks)) {
                        return { effectiveTicks: ticks, kind: 'ticks' };
                    }
                } catch { /* ignore */ }
            }
            if (typeof target.calculateSpellCooldownMs === 'function') {
                try {
                    const ms = target.calculateSpellCooldownMs.call(target);
                    if (Number.isFinite(ms)) {
                        return { effectiveMs: ms, kind: 'ms' };
                    }
                } catch { /* ignore */ }
            }
        }
        return null;
    }

    function readActorCdrFormulaBounds(actor) {
        if (!actor) return { baseMs: null, minMs: null };
        return {
            baseMs: pickFirstNumber(actor, ['_baseCdrMs', 'CD_BASE_MS']),
            minMs: pickFirstNumber(actor, ['MIN_COOLDOWN_MS'])
        };
    }

    function computeCdrEffectiveMs(ap, reductionPerApMs, baseMs, minMs) {
        if (baseMs == null || !Number.isFinite(baseMs)) return null;
        return Math.max(Math.round(baseMs - reductionPerApMs * ap), minMs ?? 0);
    }

    function findTemplateActorForCdr(unit) {
        const direct = findActorForPanelUnit(unit);
        if (direct) return direct;

        if (!unit?.gameId) return null;
        for (const world of getWorldsForUnitProbe()) {
            const actors = world?.grid?.actors;
            if (!Array.isArray(actors)) continue;
            for (const actor of actors) {
                if (resolveGameId(actor) !== unit.gameId) continue;
                if (unit.villain != null && (actor.villain === true) !== unit.villain) continue;
                return actor;
            }
        }
        return null;
    }

    function resolveCdrBaseMsForTitle(actor, bounds) {
        if (bounds?.baseMs != null) return bounds.baseMs;
        if (!actor) return null;
        const atZero = invokeActorCooldownCalculator(actor, 0);
        if (atZero?.effectiveMs != null) return atZero.effectiveMs;
        if (atZero?.effectiveTicks != null) return ticksToMs(atZero.effectiveTicks);
        return null;
    }

    function buildScaledCooldownDisplay(effectiveMs, ap, reductionPerApMs, baseMs, minMs, options = {}) {
        const effectiveTicks = options.effectiveTicks ?? msToGameCooldownTicks(effectiveMs);
        if (effectiveTicks == null) return null;
        const { value, suffix } = formatTicksParts(effectiveTicks);
        const effectiveLabel = formatTicks(effectiveTicks);
        const equipCdr = options.equipCdr;
        const equipPctLabel = formatEquipCdrPercentLabel(equipCdr?.percent);
        const scaleEquipBase = options.scaleEquipBase !== false && equipCdr?.basis != null && equipCdr.basis !== 1;

        let title = `Effective cooldown at ${ap} AP = ${effectiveLabel}`;
        if (baseMs != null && Number.isFinite(baseMs)) {
            const formulaBaseMs = scaleEquipBase ? Math.round(baseMs * equipCdr.basis) : baseMs;
            const baseTicks = msToGameCooldownTicks(formulaBaseMs);
            const reductionTicks = msToGameCooldownTicks(reductionPerApMs);
            const minTicks = minMs != null && Number.isFinite(minMs) ? msToGameCooldownTicks(minMs) : null;
            const inner = `${formatTicks(baseTicks)} - ${ap} AP × ${formatTicks(reductionTicks)}`;
            const rawMs = formulaBaseMs - reductionPerApMs * ap;
            if (minTicks != null && Math.round(rawMs) < minMs) {
                title = `max(round(${inner}), ${formatTicks(minTicks)}) = ${effectiveLabel}`;
            } else {
                title = `round(${inner}) = ${effectiveLabel}`;
            }
            if (equipPctLabel != null) {
                title += scaleEquipBase
                    ? ` (base CD −${equipPctLabel}% equip)`
                    : ` (includes equip −${equipPctLabel}% CD)`;
            }
        } else if (equipPctLabel != null) {
            title += ` (includes equip −${equipPctLabel}% CD)`;
        }
        return { value, suffix, title };
    }

    const CDR_SCRIPT_BASE_MS_KEYS = ['BASE_COOLDOWN_MS', 'COOLDOWN_BASE_MS', 'REVIVE_COOLDOWN_MS', 'CD_BASE_MS'];
    const CDR_SCRIPT_PER_AP_KEYS = ['CDR_PER_AP', 'CDR_MS_PER_AP', 'COOLDOWN_MS_REDUCTION_PER_AP'];
    const CDR_SCRIPT_MIN_MS_KEYS = ['MIN_COOLDOWN_MS'];

    const WEBPACK_CHUNK_URL_RE = /\/\d+-[\w-]+\.js(?:\?|$)/;

    const GAME_SCRIPT_CHUNK_PROFILES = {
        monsters: {
            key: 'monsters',
            preferredChunkIds: [876, 661],
            markers: ['calculateSpellCooldownTicks', 'abilityCooldown']
        },
        equipment: {
            key: 'equipment',
            preferredChunkIds: [876, 277, 235],
            markers: ['extends p.V', 'COOLDOWN_REDUCTION_PERCENT', 'addPercentageModifier']
        }
    };

    let cachedGameChunk661Text = null;
    let cachedGameChunk661Promise = null;
    const cachedCdrScriptBounds = new Map();
    const discoveredGameChunkUrlByProfile = new Map();
    const gameScriptTextCacheByUrl = new Map();
    let gameChunkScriptPreviewRefreshTimer = null;

    function prefetchGameChunk661ForCdr() {
        ensureGameChunk661Text().catch(() => { /* ignore */ });
        ensureGameChunk235Text().catch(() => { /* ignore */ });
    }

    function collectWebpackChunkUrls() {
        const urls = new Set();
        for (const script of document.scripts) {
            if (script.src && WEBPACK_CHUNK_URL_RE.test(script.src)) urls.add(script.src);
        }
        if (typeof performance?.getEntriesByType === 'function') {
            for (const entry of performance.getEntriesByType('resource')) {
                const name = entry?.name;
                if (name && WEBPACK_CHUNK_URL_RE.test(name)) urls.add(name);
            }
        }
        return [...urls];
    }

    function findWebpackChunkUrlById(chunkId) {
        const pattern = new RegExp(`\\/${chunkId}-[\\w-]+\\.js(?:\\?|$)`);
        for (const script of document.scripts) {
            if (script.src && pattern.test(script.src)) return script.src;
        }
        if (typeof performance?.getEntriesByType === 'function') {
            const entries = performance.getEntriesByType('resource');
            for (let i = entries.length - 1; i >= 0; i--) {
                const name = entries[i]?.name;
                if (name && pattern.test(name)) return name;
            }
        }
        return null;
    }

    function findGameChunkScriptUrl(chunkId) {
        return findWebpackChunkUrlById(chunkId);
    }

    function scriptTextMatchesProfile(text, profile) {
        if (!text || !profile) return false;
        if (profile.key === 'equipment') {
            // Minified aliases differ between builds; match CDR equip structure, not exact tokens.
            return /COOLDOWN_REDUCTION_PERCENT/.test(text)
                && /addPercentageModifier\(-\w+\.COOLDOWN_REDUCTION_PERCENT\)/.test(text)
                && /class \w+ extends \w+\.V\{constructor\(e\)\{super\(e,\w+\)/.test(text);
        }
        return profile.markers.every((marker) => text.includes(marker));
    }

    async function fetchScriptTextFromUrl(url) {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const text = await res.text();
        return text || null;
    }

    async function fetchScriptTextCached(url) {
        if (gameScriptTextCacheByUrl.has(url)) return gameScriptTextCacheByUrl.get(url);
        const text = await fetchScriptTextFromUrl(url);
        if (text) gameScriptTextCacheByUrl.set(url, text);
        return text;
    }

    function scheduleGameChunkScriptPreviewRefresh() {
        if (isFightActive()) return;
        if (gameChunkScriptPreviewRefreshTimer != null) {
            clearTimeout(gameChunkScriptPreviewRefreshTimer);
        }
        gameChunkScriptPreviewRefreshTimer = setTimeout(() => {
            gameChunkScriptPreviewRefreshTimer = null;
            invalidateBoardPreviewCache({ clearMechanicsLog: true });
            lastUnitsRenderKey = '';
            renderUnits(true);
        }, 16);
    }

    async function resolveGameScriptChunkUrl(profile, options = {}) {
        const cachedUrl = discoveredGameChunkUrlByProfile.get(profile.key);
        if (cachedUrl) return cachedUrl;

        const tried = new Set();
        const tryUrl = async (url) => {
            if (!url || tried.has(url)) return null;
            tried.add(url);
            const text = await fetchScriptTextCached(url);
            if (text && scriptTextMatchesProfile(text, profile)) {
                discoveredGameChunkUrlByProfile.set(profile.key, url);
                return url;
            }
            return null;
        };

        for (const chunkId of profile.preferredChunkIds) {
            const hit = await tryUrl(findWebpackChunkUrlById(chunkId));
            if (hit) return hit;
        }

        if (options.scanAllChunks !== false) {
            for (const url of options.chunkUrls ?? collectWebpackChunkUrls()) {
                const hit = await tryUrl(url);
                if (hit) return hit;
            }
        }
        return null;
    }

    function findGameChunk661ScriptUrl() {
        return discoveredGameChunkUrlByProfile.get('monsters')
            ?? findWebpackChunkUrlById(876)
            ?? findWebpackChunkUrlById(661);
    }

    function onGameChunkScriptLoadedForPreview() {
        scheduleGameChunkScriptPreviewRefresh();
    }

    async function fetchGameScriptChunkText(profile, options = {}) {
        const maxAttempts = options.maxAttempts ?? 50;
        const delayMs = options.delayMs ?? 200;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const url = await resolveGameScriptChunkUrl(profile, {
                chunkUrls: collectWebpackChunkUrls(),
                scanAllChunks: attempt === 0 || attempt >= 4
            });
            if (url) {
                const text = gameScriptTextCacheByUrl.get(url) ?? await fetchScriptTextCached(url);
                if (text) return text;
            }
            if (attempt < maxAttempts - 1) {
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
        }
        return null;
    }

    function ensureGameChunk661Text() {
        if (cachedGameChunk661Text) return Promise.resolve(cachedGameChunk661Text);
        if (!cachedGameChunk661Promise) {
            cachedGameChunk661Promise = (async () => {
                const text = await fetchGameScriptChunkText(GAME_SCRIPT_CHUNK_PROFILES.monsters);
                if (!text) {
                    cachedGameChunk661Promise = null;
                    return null;
                }
                cachedGameChunk661Text = text;
                onGameChunkScriptLoadedForPreview();
                return cachedGameChunk661Text;
            })();
        }
        return cachedGameChunk661Promise;
    }

    let cachedGameChunk235Text = null;
    let cachedGameChunk235Promise = null;
    const runtimeEquipmentCdrPercentCache = new Map();
    const pendingRuntimeEquipmentCdr = new Set();

    function findGameChunk235ScriptUrl() {
        return discoveredGameChunkUrlByProfile.get('equipment')
            ?? findWebpackChunkUrlById(876)
            ?? findWebpackChunkUrlById(277)
            ?? findWebpackChunkUrlById(235);
    }

    function ensureGameChunk235Text() {
        if (cachedGameChunk235Text
            && !scriptTextMatchesProfile(cachedGameChunk235Text, GAME_SCRIPT_CHUNK_PROFILES.equipment)) {
            cachedGameChunk235Text = null;
        }
        if (cachedGameChunk235Text) return Promise.resolve(cachedGameChunk235Text);
        if (!cachedGameChunk235Promise) {
            cachedGameChunk235Promise = (async () => {
                const text = await fetchGameScriptChunkText(GAME_SCRIPT_CHUNK_PROFILES.equipment);
                if (!text) {
                    cachedGameChunk235Promise = null;
                    return null;
                }
                cachedGameChunk235Text = text;
                onGameChunkScriptLoadedForPreview();
                return cachedGameChunk235Text;
            })();
        }
        return cachedGameChunk235Promise;
    }

    function parseRuntimeCooldownPercentFromText(text) {
        const raw = String(text || '');
        if (!raw) return null;
        const matches = [...raw.matchAll(/([+-]?\d+(?:\.\d+)?)\s*%/g)];
        if (!matches.length) return null;
        let best = null;
        for (const m of matches) {
            const value = Number(m[1]);
            if (!Number.isFinite(value)) continue;
            const normalized = Math.abs(value) / 100;
            if (best == null || normalized > best) best = normalized;
        }
        return best;
    }

    function getEquipmentCdrCacheKey(equipment) {
        if (!equipment) return '';
        return [
            equipment.gameId ?? '',
            equipment.spriteId ?? '',
            String(equipment.name ?? ''),
            equipment.tier ?? equipment.metadata?.tier ?? ''
        ].join('|');
    }

    function scheduleRuntimeEquipmentCooldownResolution(equipment) {
        const key = getEquipmentCdrCacheKey(equipment);
        if (!key || pendingRuntimeEquipmentCdr.has(key)) return;
        pendingRuntimeEquipmentCdr.add(key);

        const gameId = Number(equipment?.gameId);
        const tier = Math.min(5, Math.max(1, Number.parseInt(equipment?.tier ?? equipment?.metadata?.tier, 10) || 5));
        const getEquipment = globalThis.state?.utils?.getEquipment;
        const createUIComponent = globalThis.state?.utils?.createUIComponent;
        if (!Number.isFinite(gameId) || typeof getEquipment !== 'function' || typeof createUIComponent !== 'function' || !document?.createElement) {
            pendingRuntimeEquipmentCdr.delete(key);
            return;
        }

        let item;
        try { item = getEquipment(gameId); } catch { item = null; }
        const effectComponent = item?.metadata?.EffectComponent;
        if (!effectComponent) {
            pendingRuntimeEquipmentCdr.delete(key);
            return;
        }

        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-99999px;top:0;width:520px;max-width:520px;height:auto;overflow:visible;opacity:0;pointer-events:none;z-index:-1;';
        const root = document.createElement('div');
        root.className = 'tooltip-prose';
        host.appendChild(root);
        document.body?.appendChild(host);

        let component = null;
        try {
            component = createUIComponent(root, effectComponent, { tier });
            if (component && typeof component.mount === 'function') component.mount();
        } catch {
            try { component?.unmount?.(); } catch { /* ignore */ }
            host.remove();
            pendingRuntimeEquipmentCdr.delete(key);
            return;
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                let parsed = null;
                try {
                    for (const node of root.querySelectorAll('.text-cooldown')) {
                        parsed = parseRuntimeCooldownPercentFromText(node.textContent);
                        if (parsed != null) break;
                    }
                    if (parsed == null) parsed = parseRuntimeCooldownPercentFromText(root.textContent);
                } catch { /* ignore */ }

                if (parsed != null && Number.isFinite(parsed) && parsed > 0) {
                    runtimeEquipmentCdrPercentCache.set(key, parsed);
                    invalidateBoardPreviewCache({ clearMechanicsLog: false });
                    lastUnitsRenderKey = '';
                    renderUnits(true);
                }
                try { component?.unmount?.(); } catch { /* ignore */ }
                host.remove();
                pendingRuntimeEquipmentCdr.delete(key);
            });
        });
    }


    function resolveEquipmentCooldownReductionPercent(equipment) {
        if (!equipment) return 0;

        const key = getEquipmentCdrCacheKey(equipment);
        const cached = key ? runtimeEquipmentCdrPercentCache.get(key) : null;
        if (cached != null && Number.isFinite(cached) && cached > 0) return cached;

        const fromDatabase = globalThis.equipmentDatabase?.getEquipmentCooldownReductionPercent;
        if (typeof fromDatabase === 'function') {
            const resolved = Number(fromDatabase(equipment));
            if (Number.isFinite(resolved) && resolved > 0) return resolved;
        }

        // Fallback 3 (async): EffectComponent runtime parse, then cache + re-render.
        scheduleRuntimeEquipmentCooldownResolution(equipment);
        return 0;
    }

    function resolvePreviewEquipmentPercentageBasis(equipment) {
        const reduction = resolveEquipmentCooldownReductionPercent(equipment);
        if (!reduction || !Number.isFinite(reduction)) return 1;
        return Math.max(0, 1 - reduction);
    }

    function resolveAbilityScalingEquipCdr(unit) {
        const percent = resolveEquipmentCooldownReductionPercent(unit?.equipment);
        if (!percent || !Number.isFinite(percent)) {
            return { percent: 0, basis: 1 };
        }
        return { percent, basis: Math.max(0, 1 - percent) };
    }

    function formatEquipCdrPercentLabel(percent) {
        if (!percent || !Number.isFinite(percent)) return null;
        return Math.round(percent * 100);
    }

    function applyPreviewPercentageBasisToCooldownMs(ms, percentageBasis, minMs) {
        if (ms == null || !Number.isFinite(ms) || percentageBasis === 1) return ms;
        const scaled = Math.round(ms * percentageBasis);
        if (minMs != null && Number.isFinite(minMs)) return Math.max(scaled, minMs);
        return scaled;
    }

    function extractPreviewPercentageBasisSyncFrom661(scriptText, classSlice, metadataIndex) {
        if (!scriptText) return null;
        const syncRe = /onCooldownReductionUpdateSync:e=>\{let t=\(0,\w+\.HX\)\((\w+)\.(\w+)\);t\*=e\.percentageBasis,t\+=e\.flatTicks,t=Math\.max\(t,\1\.(\w+)\)/;
        const haystacks = [];
        if (classSlice) haystacks.push(classSlice);
        if (metadataIndex != null && metadataIndex >= 0) {
            haystacks.push(scriptText.slice(metadataIndex, metadataIndex + 15000));
        }
        for (const haystack of haystacks) {
            const m = haystack.match(syncRe);
            if (!m) continue;
            const minMs = readScriptConstMinMs(scriptText, m[1], metadataIndex ?? 0);
            return { constName: m[1], minMs };
        }
        return null;
    }

    function parseScriptConstNumericValue(raw) {
        if (raw == null) return null;
        const trimmed = String(raw).trim();
        if (/^[\d.]+(?:e\d+)?$/i.test(trimmed)) return Number(trimmed);
        const hxMatch = trimmed.match(/\(0,\w+\.HX\)\(([\d.e]+)\)/);
        if (hxMatch) return Number(hxMatch[1]);
        return null;
    }

    function parseScriptConstMapValue(scriptText, constName, mapField, key, nearIndex = 0) {
        if (!scriptText || !constName || !mapField || !key) return null;
        const anchor = scriptText.indexOf(`${constName}=`, nearIndex >= 0 ? nearIndex : 0);
        if (anchor < 0) return null;
        const window = scriptText.slice(anchor, anchor + 4000);
        const mapRe = new RegExp(`${escapeCdrRegexLiteral(mapField)}:\\{([^}]+)\\}`);
        const mapMatch = window.match(mapRe);
        if (!mapMatch) return null;
        const keyRe = new RegExp(
            `\\b${escapeCdrRegexLiteral(key)}:((?:\\(0,\\w+\\.HX\\)\\([\\d.e]+\\))|(?:\\d+(?:\\.\\d+)?(?:e\\d+)?))`
        );
        const km = mapMatch[1].match(keyRe);
        if (!km) return null;
        return parseScriptConstNumericValue(km[1]);
    }

    function resolvePreviewWeaponVariant(classSlice, unit) {
        const rules = [
            ['Giant Sword', 'SWORD'],
            ['Cranial Basher', 'CLUB'],
            ['Fire Axe', 'AXE']
        ];
        const names = [];
        const eq = unit?.equipment;
        if (eq && typeof eq === 'object') {
            names.push(eq.name, eq.metadata?.name);
        }
        for (const [weaponName, variant] of rules) {
            if (names.some((n) => n && String(n).includes(weaponName))) return variant;
        }
        if (!classSlice) return 'NONE';
        for (const [weaponName, variant] of rules) {
            if (classSlice.includes(`"${weaponName}"`) && names.length === 0) continue;
        }
        return 'NONE';
    }

    function previewCooldownBodyHasTimedInit(body) {
        const msRef = body.match(/cooldownMilliseconds:(\w+\.\w+|\d+)/);
        if (msRef && msRef[1] !== '0') return true;
        if (/cooldownTicks:this\.\w+\(\)/.test(body)) return true;
        if (/cooldownTicks:\(0,\w+\.HX\)/.test(body)) return true;
        return false;
    }

    function evaluatePreviewCooldownCalculateTicks(classSlice, scriptText, methodName, unit, metadataIndex, percentageBasis = 1) {
        if (!classSlice || !methodName) return null;
        const methodBody = classSlice.match(
            new RegExp(`${escapeCdrRegexLiteral(methodName)}=\\(\\)=>\\{([^}]+)\\}`)
        );
        if (!methodBody) return null;
        const body = methodBody[1];

        const baseMatch = body.match(/\(0,\w+\.HX\)\((\w+)\.(\w+)\[this\.getVariant\(\)\]\)/);
        if (!baseMatch) return null;

        const variant = resolvePreviewWeaponVariant(classSlice, unit);
        const baseMs = parseScriptConstMapValue(
            scriptText, baseMatch[1], baseMatch[2], variant, metadataIndex);
        if (baseMs == null || !Number.isFinite(baseMs)) return null;

        let ticks = msToGameCooldownTicks(baseMs);
        if (percentageBasis !== 1) ticks = Math.round(ticks * percentageBasis);

        const minMatch = body.match(/Math\.max\(e,(\w+)\.(\w+)\[this\.getVariant\(\)\]\)/);
        if (minMatch) {
            const minRaw = parseScriptConstMapValue(
                scriptText, minMatch[1], minMatch[2], variant, metadataIndex);
            if (minRaw != null && Number.isFinite(minRaw)) {
                ticks = Math.max(ticks, msToGameCooldownTicks(minRaw));
            }
        }
        return ticks > 0 ? ticks : null;
    }

    function resolvePreviewCooldownTicksInitMs(scriptText, classSlice, body, unit, metadataIndex, percentageBasis = 1) {
        const calcRef = body.match(/cooldownTicks:this\.(\w+)\(\)/);
        if (calcRef) {
            const ticks = evaluatePreviewCooldownCalculateTicks(
                classSlice, scriptText, calcRef[1], unit, metadataIndex, percentageBasis);
            if (ticks != null && ticks > 0) return ticksToMs(ticks);
        }

        const hxRef = body.match(/cooldownTicks:\(0,\w+\.HX\)\(([\d.e]+)\)/);
        if (hxRef) {
            const ms = Number(hxRef[1]);
            if (Number.isFinite(ms) && ms > 0) return ms;
        }

        const ticksRef = body.match(/cooldownTicks:(\d+)/);
        if (ticksRef) {
            const ticks = Number(ticksRef[1]);
            if (Number.isFinite(ticks) && ticks > 0) return ticksToMs(ticks);
        }
        return null;
    }

    function parseCdrConstObjectBody(body) {
        const out = {};
        const re = /([A-Z_]+):((?:\(0,\w+\.HX\)\([\d.e]+\))|(?:[\d.]+(?:e\d+)?))/g;
        let match;
        while ((match = re.exec(body))) {
            const value = parseScriptConstNumericValue(match[2]);
            if (value != null && Number.isFinite(value)) out[match[1]] = value;
        }
        return out;
    }

    const SCRIPT_COOLDOWN_CONST_FIELD_HINTS = [
        'COOLDOWN_MS', 'BASE_COOLDOWN_MS', 'MIN_COOLDOWN_MS', 'MIN_COOLDOWN_TICKS',
        'INITIAL_COOLDOWN_TICKS', 'CDR_PER_AP', 'CDR_MS_PER_AP'
    ];

    function findScriptConstDefinitions(scriptText, constName, fromIndex = 0) {
        if (!scriptText || !constName) return [];
        const re = new RegExp(`\\b${escapeCdrRegexLiteral(constName)}=\\{([^}]+)\\}`, 'g');
        re.lastIndex = Math.max(0, fromIndex);
        const defs = [];
        let match;
        while ((match = re.exec(scriptText))) {
            defs.push({
                index: match.index,
                fields: parseCdrConstObjectBody(match[1])
            });
        }
        return defs;
    }

    function mapCdrScriptFields(fields) {
        const pick = (keys) => {
            for (const key of keys) {
                if (fields[key] != null && Number.isFinite(fields[key])) return fields[key];
            }
            return null;
        };
        return {
            baseMs: pick(CDR_SCRIPT_BASE_MS_KEYS),
            reductionPerApMs: pick(CDR_SCRIPT_PER_AP_KEYS),
            minMs: pick(CDR_SCRIPT_MIN_MS_KEYS)
        };
    }

    function escapeCdrRegexLiteral(str) {
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function findCdrConstObjectInScript(scriptText, constName) {
        if (!constName) return null;
        const constPattern = new RegExp(`${escapeCdrRegexLiteral(constName)}=\\{[^}]*\\}`);
        return constPattern.exec(scriptText);
    }

    function mapCdrBoundsFromConstMatch(scriptText, match, nearIndex = 0) {
        const bodyMatch = match[0].match(/\{([^}]+)\}/);
        if (!bodyMatch) return null;

        const mapped = mapCdrScriptFields(parseCdrConstObjectBody(bodyMatch[1]));
        if (mapped.baseMs == null || mapped.reductionPerApMs == null) return null;

        if (mapped.minMs == null) {
            const minTickMatch = bodyMatch[1].match(/MIN_COOLDOWN_TICKS:\(0,\w+\.HX\)\(([\d.e]+)\)/);
            if (minTickMatch) mapped.minMs = Number(minTickMatch[1]);
        }
        if (mapped.minMs == null) {
            const constName = match[0].match(/^([\w$]+)=/)?.[1];
            if (constName) mapped.minMs = readScriptConstMinMs(scriptText, constName, nearIndex);
        }
        if (mapped.minMs == null) return null;
        return mapped;
    }

    function findCdrConstMatchNearSlice(scriptText, searchSlice) {
        if (!scriptText || !searchSlice) return null;
        const refMatch = searchSlice.match(/([\w$]+)\.(CDR_PER_AP|CDR_MS_PER_AP|COOLDOWN_MS_REDUCTION_PER_AP)/);
        if (refMatch) {
            return findCdrConstObjectInScript(scriptText, refMatch[1]);
        }
        return null;
    }

    function extractCdrBoundsFrom661Script(scriptText, unit, reductionPerApMs) {
        if (!scriptText || !unit?.gameId || reductionPerApMs == null) return null;

        const name = getMonsterMetadata(unit.gameId)?.name;
        if (!name) return null;

        const nameIdx = scriptText.indexOf(`name:"${name}"`);
        const searchSlice = nameIdx >= 0
            ? scriptText.slice(nameIdx, nameIdx + 40000)
            : scriptText;

        let match = findCdrConstMatchNearSlice(scriptText, searchSlice);

        if (!match) {
            const constPattern = new RegExp(
                `\\w+=\\{[^}]*(?:CDR_PER_AP|CDR_MS_PER_AP|COOLDOWN_MS_REDUCTION_PER_AP):${reductionPerApMs}[^}]*\\}`
            );
            match = constPattern.exec(searchSlice) || constPattern.exec(scriptText);
        }
        if (!match) return null;

        const mapped = mapCdrBoundsFromConstMatch(scriptText, match, nameIdx >= 0 ? nameIdx : 0);
        if (!mapped || mapped.reductionPerApMs !== reductionPerApMs) return null;
        return mapped;
    }

    function resolveCdrBoundsFromGameScript(unit, reductionPerApMs) {
        if (!cachedGameChunk661Text || !unit?.gameId || reductionPerApMs == null) return null;

        const cacheKey = `${unit.gameId}:${reductionPerApMs}`;
        if (cachedCdrScriptBounds.has(cacheKey)) {
            return cachedCdrScriptBounds.get(cacheKey);
        }

        const parsed = extractCdrBoundsFrom661Script(cachedGameChunk661Text, unit, reductionPerApMs);
        cachedCdrScriptBounds.set(cacheKey, parsed);
        return parsed;
    }

    function findMonsterMetadataAnchor(scriptText, skillSrc, monsterName) {
        if (!scriptText) return null;

        if (monsterName) {
            const namePattern = new RegExp(
                `([\\w$]+)=\\{name:"${escapeCdrRegexLiteral(String(monsterName))}"`
            );
            let nameMatch;
            while ((nameMatch = namePattern.exec(scriptText))) {
                const varName = nameMatch[1];
                if (!skillSrc) return { varName, index: nameMatch.index };
                const metaChunk = scriptText.slice(nameMatch.index, nameMatch.index + 12000);
                if (metaChunk.includes(`skill:{src:"${String(skillSrc)}"`)) {
                    return { varName, index: nameMatch.index };
                }
            }
        }

        if (skillSrc) {
            const skillNeedle = `skill:{src:"${String(skillSrc)}"`;
            let idx = 0;
            while ((idx = scriptText.indexOf(skillNeedle, idx)) >= 0) {
                const windowStart = Math.max(0, idx - 12000);
                const chunk = scriptText.slice(windowStart, idx);
                const metaMatch = /([\w$]+)=\{name:"[^"]*"/g;
                let last = null;
                let m;
                while ((m = metaMatch.exec(chunk))) last = m;
                if (last) {
                    return {
                        varName: last[1],
                        index: windowStart + last.index
                    };
                }
                idx++;
            }
        }

        return null;
    }

    function findMonsterMetadataVarName(scriptText, skillSrc, monsterName) {
        return findMonsterMetadataAnchor(scriptText, skillSrc, monsterName)?.varName ?? null;
    }

    function classSliceUsesIndirectMetadataParam(classSlice, metadataVarName) {
        if (!classSlice || !metadataVarName) return false;
        return new RegExp(`constructor\\(e,t=${escapeCdrRegexLiteral(metadataVarName)}\\)`).test(classSlice);
    }

    function getPreviewSkillSpreads(metadataVarName, classSlice) {
        const spreads = [`...${metadataVarName}.skill`];
        if (classSliceUsesIndirectMetadataParam(classSlice, metadataVarName)) {
            spreads.push('...t.skill');
        }
        return spreads;
    }

    function bodyIncludesPreviewSkillSpread(body, spreads) {
        return spreads.some((spread) => body.includes(spread));
    }

    function findMonsterClassSlice(scriptText, metadataVarName, metadataIndex) {
        if (!scriptText || !metadataVarName) return null;
        const searchFrom = metadataIndex != null && metadataIndex >= 0 ? metadataIndex : 0;
        const needles = [
            `super({...e,...${metadataVarName},`,
            `super({...e,...${metadataVarName}}`,
            `super({...${metadataVarName},`,
            `super({...${metadataVarName},...e}`,
            `super({...e,...${metadataVarName}},`,
            `constructor(e,t=${metadataVarName}){super({...e,...t}`
        ];
        let start = -1;
        for (const needle of needles) {
            const idx = scriptText.indexOf(needle, searchFrom);
            if (idx >= 0) {
                start = idx;
                break;
            }
        }
        if (start < 0) return null;

        const classEnd = scriptText.indexOf('class ', start + 20);
        const end = classEnd >= 0 ? classEnd : start + 12000;
        return scriptText.slice(start, end);
    }

    function readScriptConstMinMs(scriptText, constName, nearIndex = 0) {
        const fields = readScriptConstObject(scriptText, constName, {
            nearIndex,
            fieldHint: 'MIN_COOLDOWN_MS'
        });
        const minMs = pickFirstScriptConstField(fields, CDR_SCRIPT_MIN_MS_KEYS);
        if (minMs != null) return minMs;

        const tickFields = readScriptConstObject(scriptText, constName, {
            nearIndex,
            fieldHint: 'MIN_COOLDOWN_TICKS'
        });
        const minTicks = tickFields?.MIN_COOLDOWN_TICKS;
        if (minTicks != null && Number.isFinite(minTicks)) return minTicks;
        return null;
    }

    function extractPreviewComputedCooldownsFrom661(scriptText, classSlice, ap, metadataIndex = 0, percentageBasis = 1) {
        if (!scriptText || !classSlice || ap == null || !Number.isFinite(ap)) return [];

        const hits = [];
        const readConst = (constName, fieldHint = null) =>
            readScriptConstObject(scriptText, constName, { nearIndex: metadataIndex, fieldHint });
        const scaleBaseMs = (baseMs) => {
            if (baseMs == null || !Number.isFinite(baseMs) || percentageBasis === 1) return baseMs;
            return Math.round(baseMs * percentageBasis);
        };

        const cdrSpellFormula = classSlice.match(
            /calculateSpellCooldownTicks=\(\)=>\(0,\w+\.HX\)\(Math\.max\(Math\.round\(this\._baseCdrMs-(\w+)\.CDR_PER_AP\*this\.ap\.currentValue\),(\w+)\.MIN_COOLDOWN_MS\)\)/
        );
        if (cdrSpellFormula && cdrSpellFormula[1] === cdrSpellFormula[2]) {
            const cdrConst = readConst(cdrSpellFormula[1]);
            const baseMs = scaleBaseMs(pickFirstScriptConstField(cdrConst, [...CDR_SCRIPT_BASE_MS_KEYS, 'COOLDOWN_MS']));
            const cdrPerAp = pickFirstScriptConstField(cdrConst, CDR_SCRIPT_PER_AP_KEYS);
            const minMs = pickFirstScriptConstField(cdrConst, CDR_SCRIPT_MIN_MS_KEYS);
            const ms = computeCdrEffectiveMs(ap, cdrPerAp, baseMs, minMs);
            if (ms != null && ms > 0) hits.push({ component: 'abilityCooldown', ms, source: 'script-cdr' });
        }

        const cdrMsFormula = classSlice.match(
            /calculateSpellCooldownMs=\(\)=>Math\.max\(Math\.round\(this\.CD_BASE_MS-(\w+)\.COOLDOWN_MS_REDUCTION_PER_AP\*this\.ap\.currentValue\),\1\.MIN_COOLDOWN_MS\)/
        );
        if (cdrMsFormula) {
            const cdrConst = readConst(cdrMsFormula[1]);
            const baseMs = scaleBaseMs(pickFirstScriptConstField(cdrConst, CDR_SCRIPT_BASE_MS_KEYS));
            const cdrPerAp = pickFirstScriptConstField(cdrConst, CDR_SCRIPT_PER_AP_KEYS);
            const minMs = pickFirstScriptConstField(cdrConst, CDR_SCRIPT_MIN_MS_KEYS);
            const ms = computeCdrEffectiveMs(ap, cdrPerAp, baseMs, minMs);
            if (ms != null && ms > 0) hits.push({ component: 'abilityCooldown', ms, source: 'script-cdr' });
        }

        const reviveFormula = classSlice.match(
            /calculateReviveCooldownTicks=\(\)=>\(0,\w+\.HX\)\(Math\.max\(Math\.round\((\w+)\.(\w+)-\1\.(\w+)\*this\.ap\.currentValue\),\1\.(\w+)\)\)/
        );
        if (reviveFormula) {
            const constName = reviveFormula[1];
            const cdrConst = readConst(constName);
            const baseMs = cdrConst?.[reviveFormula[2]];
            const cdrPerAp = cdrConst?.[reviveFormula[3]];
            const minMs = cdrConst?.[reviveFormula[4]];
            const ms = computeCdrEffectiveMs(ap, cdrPerAp, baseMs, minMs);
            if (ms != null && ms > 0) {
                hits.push({ component: 'chargingReviveCooldown', ms, source: 'script-cdr' });
            }
        }

        if (/calculateSpellCooldownTicks=\w+=>/.test(classSlice) && /BASE_COOLDOWN_MS/.test(classSlice)) {
            const constMatch = classSlice.match(/([\w$]+)\.BASE_COOLDOWN_MS/);
            if (constMatch) {
                const cdrConst = readConst(constMatch[1]);
                const baseMs = scaleBaseMs(cdrConst?.BASE_COOLDOWN_MS ?? cdrConst?.COOLDOWN_MS);
                const cdrPerAp = pickFirstScriptConstField(cdrConst, CDR_SCRIPT_PER_AP_KEYS);
                const minMs = readScriptConstMinMs(scriptText, constMatch[1], metadataIndex);
                const ms = computeCdrEffectiveMs(ap, cdrPerAp, baseMs, minMs);
                if (ms != null && ms > 0) hits.push({ component: 'spellCooldown', ms, source: 'script-cdr' });
            }
        }

        return hits;
    }

    function pickPreviewCooldownHit(inits, computed) {
        const abilityInit = inits.find((h) =>
            h.component === 'abilityCooldown' && h.ms != null && h.ms > 0);
        if (abilityInit && Number.isFinite(abilityInit.ms)) {
            return { component: abilityInit.component, ms: abilityInit.ms, source: 'script-init' };
        }

        const skillInit = inits.find((h) =>
            h.component !== 'abilityCooldown'
            && isPreviewSkillAbilityCooldownComponent(h.component)
            && h.ms != null && h.ms > 0);
        if (skillInit && Number.isFinite(skillInit.ms)) {
            return { component: skillInit.component, ms: skillInit.ms, source: 'script-init' };
        }

        const abilityCdr = computed.find((h) =>
            h.component === 'abilityCooldown' && h.ms != null && h.ms > 0);
        if (abilityCdr && Number.isFinite(abilityCdr.ms)) {
            return abilityCdr;
        }

        const spellCdr = computed.find((h) =>
            h.component === 'spellCooldown' && h.ms != null && h.ms > 0);
        if (spellCdr && Number.isFinite(spellCdr.ms)) {
            return { component: 'abilityCooldown', ms: spellCdr.ms, source: spellCdr.source };
        }

        return null;
    }

    function extractPreviewCdrBoundsFromClassSlice(scriptText, classSlice, metadataIndex) {
        if (!scriptText || !classSlice) return null;

        let constName = classSlice.match(
            /([\w$]+)\.(CDR_PER_AP|CDR_MS_PER_AP|COOLDOWN_MS_REDUCTION_PER_AP)/
        )?.[1];

        if (!constName) {
            constName = classSlice.match(/([\w$]+)\.BASE_COOLDOWN_MS/)?.[1];
        }
        if (!constName) {
            constName = classSlice.match(
                /calculateSpellCooldownMs=\(\)=>Math\.max\(Math\.round\(this\.CD_BASE_MS-(\w+)\./
            )?.[1];
        }
        if (!constName) {
            constName = classSlice.match(
                /calculateSpellCooldownTicks=\(\)=>\(0,\w+\.HX\)\(Math\.max\(Math\.round\(this\._baseCdrMs-(\w+)\./
            )?.[1];
        }
        if (!constName) return null;

        const fields = readScriptConstObject(scriptText, constName, { nearIndex: metadataIndex ?? 0 });
        const mapped = mapCdrScriptFields(fields);
        if (mapped.baseMs == null || mapped.reductionPerApMs == null) return null;

        if (mapped.minMs == null) {
            mapped.minMs = readScriptConstMinMs(scriptText, constName, metadataIndex ?? 0);
        }
        if (mapped.minMs == null) return null;

        return mapped;
    }

    function extractPreviewCdrBoundsFrom661Script(scriptText, unit, metadataVarName, metadataIndex) {
        if (!scriptText || !unit?.gameId) return null;

        const region = findMonsterScriptRegion(scriptText, metadataVarName, metadataIndex);
        const near = metadataIndex != null && metadataIndex >= 0 ? metadataIndex : 0;
        const match = findCdrConstMatchNearSlice(scriptText, region);
        if (!match) return null;
        return mapCdrBoundsFromConstMatch(scriptText, match, near);
    }

    function resolvePreviewCdrBounds(scriptText, classSlice, unit, metadataIndex, metadataVarName) {
        const fromClass = extractPreviewCdrBoundsFromClassSlice(scriptText, classSlice, metadataIndex);
        if (fromClass) return fromClass;

        const region = findMonsterScriptRegion(scriptText, metadataVarName, metadataIndex);
        if (!findCdrConstMatchNearSlice(scriptText, region)) return null;

        return extractPreviewCdrBoundsFrom661Script(scriptText, unit, metadataVarName, metadataIndex);
    }

    function resolvePreviewCdrCooldownMsFromBounds(unit, cdrBounds, percentageBasis = 1) {
        if (!cdrBounds || unit?.ap == null || !Number.isFinite(unit.ap)) return null;
        const scaledBaseMs = percentageBasis !== 1
            ? Math.round(cdrBounds.baseMs * percentageBasis)
            : cdrBounds.baseMs;
        const ms = computeCdrEffectiveMs(unit.ap, cdrBounds.reductionPerApMs, scaledBaseMs, cdrBounds.minMs);
        if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;
        return ms;
    }

    const PREVIEW_PASSIVE_SKILL_CLOCKS = new Set(['rageCooldownClock', 'passiveCooldownClock']);
    const PREVIEW_NON_ABILITY_COOLDOWN_CLOCKS = new Set(['autoAttackCooldown']);

    function isPreviewSkillAbilityCooldownComponent(componentName) {
        if (!componentName || PREVIEW_PASSIVE_SKILL_CLOCKS.has(componentName)) return false;
        if (PREVIEW_NON_ABILITY_COOLDOWN_CLOCKS.has(componentName)) return false;
        if (componentName === 'abilityCooldown') return true;
        return /Cooldown$/.test(componentName);
    }

    function* iteratePreviewCooldownClockInits(classSlice) {
        if (!classSlice) return;
        const patterns = [
            /this\.(\w+)=new \w+\.e\(\{([^}]{0,800})\}/g,
            /this\.(\w+)=this\.addCooldown\(new \w+\.e\(\{([^}]{0,800})\}\)\)/g
        ];
        for (const re of patterns) {
            for (const m of classSlice.matchAll(re)) {
                yield { component: m[1], body: m[2] };
            }
        }
    }

    function classSliceUsesAbilityCooldownGameplay(classSlice) {
        if (!classSlice || !/abilityCooldown/.test(classSlice)) return false;
        return /abilityCooldown\.setCooldown|abilityCooldown\.isOnCooldown|abilityCooldown\.setBaseCooldown|addCooldown\(this\.abilityCooldown\)|this\.abilityCooldown=this\.addCooldown|renderCooldownBars\.add\(this\.abilityCooldown\)|isOnCooldown:\(\)=>this\.abilityCooldown/.test(classSlice);
    }

    function previewCooldownInitUsesSkill(body, component, skillSpreads) {
        if (component === 'abilityCooldown') return true;
        return bodyIncludesPreviewSkillSpread(body, skillSpreads);
    }

    function extractPreviewCooldownInitsFrom661(scriptText, classSlice, metadataVarName, metadataIndex, unit, percentageBasis = 1) {
        if (!scriptText || !classSlice || !metadataVarName) return [];
        const skillSpreads = getPreviewSkillSpreads(metadataVarName, classSlice);
        const hits = [];
        for (const { component, body } of iteratePreviewCooldownClockInits(classSlice)) {
            if (!isPreviewSkillAbilityCooldownComponent(component)) continue;
            if (component === 'abilityCooldown' && !classSliceUsesAbilityCooldownGameplay(classSlice)) continue;
            if (!previewCooldownInitUsesSkill(body, component, skillSpreads)) continue;
            if (/disabledPassive:!0/.test(body) && /cooldownMilliseconds:0/.test(body)) continue;

            const msRef = body.match(/cooldownMilliseconds:([\w$]+\.\w+|\d+)/);
            if (msRef) {
                const ms = resolveScriptMsReference(scriptText, msRef[1], { nearIndex: metadataIndex ?? 0 });
                if (ms != null && Number.isFinite(ms) && ms > 0) {
                    hits.push({ component, ms, body });
                    continue;
                }
            }

            const ticksMs = resolvePreviewCooldownTicksInitMs(
                scriptText, classSlice, body, unit, metadataIndex, percentageBasis);
            if (ticksMs != null && Number.isFinite(ticksMs) && ticksMs > 0) {
                hits.push({ component, ms: ticksMs, body });
            }
        }
        return hits;
    }

    function resolvePreviewUntimedAbilityReason(classSlice, metadataVarName) {
        if (!classSlice || !metadataVarName) return null;
        const skillSpreads = getPreviewSkillSpreads(metadataVarName, classSlice);
        let hasTimedAbilityCd = false;
        let hasUntimedSkillClock = false;
        for (const { component, body } of iteratePreviewCooldownClockInits(classSlice)) {
            if (component === 'abilityCooldown') {
                if (!classSliceUsesAbilityCooldownGameplay(classSlice)) {
                    hasUntimedSkillClock = true;
                    continue;
                }
                const msRef = body.match(/cooldownMilliseconds:([\w$]+\.\w+|\d+)/);
                if (msRef && msRef[1] !== '0') hasTimedAbilityCd = true;
                continue;
            }
            if (!bodyIncludesPreviewSkillSpread(body, skillSpreads)) continue;
            if (isPreviewSkillAbilityCooldownComponent(component)) {
                if (previewCooldownBodyHasTimedInit(body)) hasTimedAbilityCd = true;
            }
            if (PREVIEW_PASSIVE_SKILL_CLOCKS.has(component) && /cooldownMilliseconds:0/.test(body)) {
                hasUntimedSkillClock = true;
            }
        }
        if (!hasTimedAbilityCd && hasUntimedSkillClock) {
            return 'passive ability (no timed CD)';
        }
        return null;
    }

    function findMonsterScriptRegion(scriptText, metadataVarName, metadataIndex) {
        if (!scriptText) return '';
        const start = metadataIndex != null && metadataIndex >= 0 ? metadataIndex : 0;
        const classSlice = findMonsterClassSlice(scriptText, metadataVarName, metadataIndex);
        if (classSlice && metadataVarName) {
            const needles = [
                `super({...e,...${metadataVarName},`,
                `super({...e,...${metadataVarName}}`,
                `super({...${metadataVarName},`,
                `constructor(e,t=${metadataVarName}){super({...e,...t}`
            ];
            for (const needle of needles) {
                const classStart = scriptText.indexOf(needle, start);
                if (classStart >= 0) {
                    return scriptText.slice(start, classStart + classSlice.length);
                }
            }
        }

        const tail = scriptText.slice(start + 1);
        const nextMeta = tail.search(/[\w$]+=\{name:"/);
        const end = nextMeta >= 0 ? start + 1 + nextMeta : start + 12000;
        return scriptText.slice(start, end);
    }

    function extractPreviewCdrCooldownMsFrom661(scriptText, metadataVarName, unit, metadataIndex) {
        const ap = unit?.ap;
        const classSlice = findMonsterClassSlice(scriptText, metadataVarName, metadataIndex);
        const computed = extractPreviewComputedCooldownsFrom661(
            scriptText, classSlice, ap, metadataIndex);
        const pick = pickPreviewCooldownHit([], computed);
        if (pick?.ms != null) return pick.ms;

        const cdrBounds = resolvePreviewCdrBounds(scriptText, classSlice, unit, metadataIndex, metadataVarName);
        if (cdrBounds && ap != null && Number.isFinite(ap)) {
            const ms = computeCdrEffectiveMs(ap, cdrBounds.reductionPerApMs, cdrBounds.baseMs, cdrBounds.minMs);
            if (ms != null && ms > 0) return ms;
        }
        return null;
    }

    function readScriptConstObject(scriptText, constName, opts = {}) {
        if (!scriptText || !constName) return null;
        const { nearIndex = 0, fieldHint = null } = opts;
        const defs = findScriptConstDefinitions(scriptText, constName, 0);
        if (!defs.length) return null;

        if (fieldHint) {
            const withField = defs.find((d) =>
                d.fields[fieldHint] != null && Number.isFinite(d.fields[fieldHint]));
            if (withField) return withField.fields;
        }

        const cooldownDefs = defs.filter((d) =>
            SCRIPT_COOLDOWN_CONST_FIELD_HINTS.some((key) =>
                d.fields[key] != null && Number.isFinite(d.fields[key])));
        if (cooldownDefs.length) {
            const after = nearIndex > 0
                ? cooldownDefs.filter((d) => d.index >= nearIndex)
                : cooldownDefs;
            const pool = after.length ? after : cooldownDefs;
            return pool[pool.length - 1].fields;
        }

        if (nearIndex > 0) {
            const after = defs.filter((d) => d.index >= nearIndex);
            if (after.length) return after[0].fields;
        }
        return null;
    }

    function resolveScriptMsReference(scriptText, ref, opts = {}) {
        if (ref == null) return null;
        const raw = String(ref).trim();
        if (/^\d+(?:\.\d+)?(?:e\d+)?$/i.test(raw)) return Number(raw);
        const m = raw.match(/^([\w$]+)\.(\w+)$/);
        if (!m) return null;
        const fields = readScriptConstObject(scriptText, m[1], {
            ...opts,
            fieldHint: m[2]
        });
        if (!fields || fields[m[2]] == null || !Number.isFinite(fields[m[2]])) return null;
        return fields[m[2]];
    }

    function pickFirstScriptConstField(fields, keys) {
        if (!fields) return null;
        for (const key of keys) {
            if (fields[key] != null && Number.isFinite(fields[key])) return fields[key];
        }
        return null;
    }

    function resolvePreviewAbilityCooldownFromActor(unit) {
        const actor = findActorForPanelUnit(unit);
        if (!actor) return null;
        const metadata = getMonsterMetadata(unit?.gameId ?? resolveGameId(actor));
        if (metadataHasNoTimedAbilityCooldown(metadata)) return null;
        const calculator = invokeActorCooldownCalculator(actor, unit.ap);
        if (calculator?.effectiveTicks != null && Number.isFinite(calculator.effectiveTicks) && calculator.effectiveTicks > 0) {
            return {
                cooldownTicks: roundTrackValue(calculator.effectiveTicks, 'abilityCdTicks'),
                cooldownMs: ticksToMs(calculator.effectiveTicks),
                cooldownReady: true,
                source: 'board-actor-calculator'
            };
        }
        if (calculator?.effectiveMs != null && Number.isFinite(calculator.effectiveMs) && calculator.effectiveMs > 0) {
            return {
                cooldownTicks: roundTrackValue(msToGameCooldownTicks(calculator.effectiveMs), 'abilityCdTicks'),
                cooldownMs: calculator.effectiveMs,
                cooldownReady: true,
                source: 'board-actor-calculator'
            };
        }
        return null;
    }

    function resolvePreviewAbilityCooldownFrom661Script(unit, metadata) {
        const scriptText = cachedGameChunk661Text;
        const skillSrc = metadata?.skill?.src;
        if (!scriptText || !skillSrc) return null;

        const monsterName = metadata?.name ?? unit?.name;
        const anchor = findMonsterMetadataAnchor(scriptText, skillSrc, monsterName);
        if (!anchor) return null;

        const { varName: metadataVarName, index: metadataIndex } = anchor;
        const classSlice = findMonsterClassSlice(scriptText, metadataVarName, metadataIndex);
        const percentageBasis = resolvePreviewEquipmentPercentageBasis(unit?.equipment);
        const percentageSync = extractPreviewPercentageBasisSyncFrom661(scriptText, classSlice, metadataIndex);
        const computed = extractPreviewComputedCooldownsFrom661(
            scriptText, classSlice, unit.ap, metadataIndex, percentageBasis);
        const inits = extractPreviewCooldownInitsFrom661(
            scriptText, classSlice, metadataVarName, metadataIndex, unit, percentageBasis);
        const pick = pickPreviewCooldownHit(inits, computed);

        let ms = null;
        let source = null;
        if (pick?.ms != null && Number.isFinite(pick.ms) && pick.ms > 0) {
            ms = pick.ms;
            source = pick.source;
            if (percentageBasis !== 1 && pick.source === 'script-init') {
                ms = applyPreviewPercentageBasisToCooldownMs(
                    ms, percentageBasis, percentageSync?.minMs ?? null);
                source = 'script-init+equip-cdr';
            } else if (percentageBasis !== 1 && pick.source === 'script-cdr') {
                source = 'script-cdr+equip-cdr';
            }
        } else if (!resolvePreviewUntimedAbilityReason(classSlice, metadataVarName)) {
            const cdrBounds = resolvePreviewCdrBounds(scriptText, classSlice, unit, metadataIndex, metadataVarName);
            ms = resolvePreviewCdrCooldownMsFromBounds(unit, cdrBounds, percentageBasis);
            if (ms != null) {
                source = percentageBasis !== 1 ? 'script-cdr+equip-cdr' : 'script-cdr';
            }
        }

        if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;

        return {
            cooldownTicks: roundTrackValue(msToGameCooldownTicks(ms), 'abilityCdTicks'),
            cooldownMs: ms,
            cooldownReady: true,
            source
        };
    }

    function resolvePreviewAbilityCooldown(unit, metadata) {
        return resolvePreviewAbilityCooldownDetailed(unit, metadata).result;
    }

    function resolvePreviewAbilityCooldownDetailed(unit, metadata) {
        if (!unit) {
            return { result: null, source: null, reason: 'no-unit' };
        }
        if (!metadata?.skill?.src) {
            return {
                result: null,
                source: null,
                reason: `metadata.skill.src missing (gameId ${unit.gameId})`
            };
        }

        if (cachedGameChunk661Text) {
            const skillSrc = metadata.skill.src;
            const monsterName = metadata?.name ?? unit?.name;
            const anchor = findMonsterMetadataAnchor(cachedGameChunk661Text, skillSrc, monsterName);
            if (anchor) {
                const classSlice = findMonsterClassSlice(
                    cachedGameChunk661Text, anchor.varName, anchor.index);
                const passiveReason = resolvePreviewUntimedAbilityReason(classSlice, anchor.varName);
                if (passiveReason) {
                    return { result: null, source: null, reason: passiveReason };
                }
            }
        }

        const fromActor = resolvePreviewAbilityCooldownFromActor(unit);
        if (fromActor?.cooldownTicks != null && fromActor.cooldownTicks > 0) {
            return { result: fromActor, source: fromActor.source, reason: null };
        }

        const fromScript = cachedGameChunk661Text
            ? resolvePreviewAbilityCooldownFrom661Script(unit, metadata)
            : null;
        if (fromScript?.cooldownTicks != null && fromScript.cooldownTicks > 0) {
            return { result: fromScript, source: fromScript.source, reason: null };
        }

        const boardActor = findActorForPanelUnit(unit);
        if (boardActor) {
            return {
                result: null,
                source: null,
                reason: 'board actor found but no readable ability cooldown'
            };
        }

        const scriptText = cachedGameChunk661Text;
        if (!scriptText) {
            return {
                result: null,
                source: null,
                reason: 'monster game script not loaded yet'
            };
        }

        const skillSrc = metadata.skill.src;
        const monsterName = metadata?.name ?? unit?.name;
        const anchor = findMonsterMetadataAnchor(scriptText, skillSrc, monsterName);
        if (!anchor) {
            return {
                result: null,
                source: null,
                reason: `661 script metadata var not found for skill "${skillSrc}"`
            };
        }

        const { varName: metadataVarName, index: metadataIndex } = anchor;
        const classSlice = findMonsterClassSlice(scriptText, metadataVarName, metadataIndex);
        const cdrMs = extractPreviewCdrCooldownMsFrom661(scriptText, metadataVarName, unit, metadataIndex);
        const inits = extractPreviewCooldownInitsFrom661(
            scriptText, classSlice, metadataVarName, metadataIndex, unit);
        const passiveReason = resolvePreviewUntimedAbilityReason(classSlice, metadataVarName);
        if (passiveReason) {
            return { result: null, source: null, reason: passiveReason };
        }

        const initSummary = inits.length
            ? inits.map((h) => `${h.component}=${h.ms}ms`).join(', ')
            : 'none';

        return {
            result: null,
            source: null,
            reason: `661 script has no preview CD (var=${metadataVarName}, cdrMs=${cdrMs ?? 'none'}, inits=${initSummary})`
        };
    }

    function computeCappedReductionMs(ap, reductionPerApMs, baseMs, minMs) {
        const rawMs = reductionPerApMs * ap;
        if (baseMs == null || !Number.isFinite(baseMs) || minMs == null || !Number.isFinite(minMs)) {
            return rawMs;
        }
        return Math.min(rawMs, Math.max(0, baseMs - minMs));
    }

    function probeActorFormulaMinMs(actor) {
        if (!actor) return null;
        const calc = invokeActorCooldownCalculator(actor, 999999);
        if (calc?.effectiveTicks != null) return ticksToMs(calc.effectiveTicks);
        return null;
    }

    function resolveCdrBoundsForUnit(unit, reductionPerApMs) {
        const actor = findTemplateActorForCdr(unit);
        const scriptBounds = resolveCdrBoundsFromGameScript(unit, reductionPerApMs);
        const bounds = readActorCdrFormulaBounds(actor);

        let baseMs = bounds.baseMs ?? resolveCdrBaseMsForTitle(actor, bounds);
        if (baseMs == null && scriptBounds) baseMs = scriptBounds.baseMs;

        // Script/constants first — live calculateSpellCooldownMs() is current effective CD, not the floor.
        let minMs = scriptBounds?.minMs ?? bounds.minMs ?? probeActorFormulaMinMs(actor);

        return { actor, baseMs, minMs };
    }

    function buildScaledCooldownReductionTotalDisplay(ap, reductionPerApMs, bounds = {}, equipCdr = null) {
        if (ap == null || !Number.isFinite(ap) || !reductionPerApMs) return null;

        const { baseMs, minMs } = bounds;
        const equipBasis = equipCdr?.basis ?? 1;
        const equipPctLabel = formatEquipCdrPercentLabel(equipCdr?.percent);
        const scaledBaseMs = (baseMs != null && equipBasis !== 1)
            ? Math.round(baseMs * equipBasis)
            : baseMs;
        const equipReductionMs = (scaledBaseMs != null && baseMs != null && equipBasis !== 1)
            ? baseMs - scaledBaseMs
            : 0;

        const rawMs = reductionPerApMs * ap;
        const apReductionMs = computeCappedReductionMs(ap, reductionPerApMs, baseMs, minMs);
        const capped = baseMs != null && minMs != null && rawMs > apReductionMs + 0.5;

        const effectiveMs = (baseMs != null && minMs != null)
            ? computeCdrEffectiveMs(ap, reductionPerApMs, scaledBaseMs, minMs)
            : null;
        const totalReductionMs = (effectiveMs != null && baseMs != null)
            ? baseMs - effectiveMs
            : apReductionMs;
        const displayMs = equipReductionMs > 0 ? totalReductionMs : apReductionMs;

        const reductionTicks = msToGameCooldownTicks(displayMs);
        if (reductionTicks == null) return null;

        const perApTicks = msToGameCooldownTicks(reductionPerApMs);
        const apReductionTicks = msToGameCooldownTicks(apReductionMs);
        const { value, suffix } = formatTicksParts(reductionTicks);
        const perLabel = perApTicks != null ? formatTicks(perApTicks) : null;
        const apReductionLabel = apReductionTicks != null ? formatTicks(apReductionTicks) : null;
        const totalLabel = formatTicks(reductionTicks);

        let title = perLabel && apReductionLabel
            ? `${ap} AP × ${perLabel} = ${apReductionLabel}`
            : `${ap} AP × ${reductionPerApMs}ms = ${totalLabel}`;

        if (equipPctLabel != null && equipReductionMs > 0) {
            const equipReductionTicks = msToGameCooldownTicks(equipReductionMs);
            const equipLabel = equipReductionTicks != null ? formatTicks(equipReductionTicks) : null;
            if (equipLabel) {
                title += ` + equip −${equipPctLabel}% base (${equipLabel})`;
            }
            const combinedMs = apReductionMs + equipReductionMs;
            if (Math.abs(totalReductionMs - combinedMs) > 0.5) {
                title += ` = ${totalLabel} total`;
            }
        }

        if (capped && baseMs != null && minMs != null) {
            const maxReductionTicks = msToGameCooldownTicks(baseMs - minMs);
            if (maxReductionTicks != null) {
                title += ` (capped at ${formatTicks(maxReductionTicks)} max AP reduction)`;
            }
        }

        if (baseMs != null && minMs != null && effectiveMs != null) {
            const withoutEquipMs = computeCdrEffectiveMs(ap, reductionPerApMs, baseMs, minMs);
            const withoutEquipTicks = msToGameCooldownTicks(withoutEquipMs);
            const effectiveTicks = msToGameCooldownTicks(effectiveMs);
            if (effectiveTicks != null) {
                if (equipPctLabel != null && equipReductionMs > 0) {
                    if (withoutEquipTicks != null && withoutEquipTicks !== effectiveTicks) {
                        title += `; effective CD ${formatTicks(effectiveTicks)} (was ${formatTicks(withoutEquipTicks)} without equip)`;
                    } else {
                        title += `; effective CD ${formatTicks(effectiveTicks)}`;
                    }
                } else {
                    title += `; effective CD ${formatTicks(effectiveTicks)}`;
                }
            }
        }

        if (minMs != null) {
            const minTicks = msToGameCooldownTicks(minMs);
            if (minTicks != null) {
                title += `; minimum CD ${formatTicks(minTicks)}`;
            }
        }

        return { value, suffix, title, minMs, capped };
    }

    function resolveScaledAbilityCooldownDetails(unit, reductionPerApMs, equipCdr = null) {
        const ap = unit?.ap;
        if (ap == null || !Number.isFinite(ap) || !reductionPerApMs) return null;

        equipCdr = equipCdr ?? resolveAbilityScalingEquipCdr(unit);
        const displayOpts = { equipCdr, scaleEquipBase: false };
        const formulaOpts = { equipCdr, scaleEquipBase: true };

        const actor = findTemplateActorForCdr(unit);
        const bounds = readActorCdrFormulaBounds(actor);
        const baseMsForTitle = resolveCdrBaseMsForTitle(actor, bounds);
        const calculator = actor ? invokeActorCooldownCalculator(actor, ap) : null;

        if (calculator) {
            const effectiveMs = calculator.effectiveMs ?? ticksToMs(calculator.effectiveTicks);
            return buildScaledCooldownDisplay(
                effectiveMs,
                ap,
                reductionPerApMs,
                baseMsForTitle,
                bounds.minMs,
                calculator.effectiveTicks != null
                    ? { ...displayOpts, effectiveTicks: calculator.effectiveTicks }
                    : displayOpts
            );
        }

        if (unit.cooldownTicks != null && Number.isFinite(unit.cooldownTicks)) {
            return buildScaledCooldownDisplay(
                ticksToMs(unit.cooldownTicks),
                ap,
                reductionPerApMs,
                baseMsForTitle,
                bounds.minMs,
                { ...displayOpts, effectiveTicks: unit.cooldownTicks }
            );
        }
        if (unit.cooldownMs != null && Number.isFinite(unit.cooldownMs)) {
            return buildScaledCooldownDisplay(
                unit.cooldownMs,
                ap,
                reductionPerApMs,
                baseMsForTitle,
                bounds.minMs,
                displayOpts
            );
        }

        if (actor) {
            const cdInfo = readActorCooldown(actor, getMonsterMetadata(unit.gameId));
            if (cdInfo.cooldownTicks != null) {
                return buildScaledCooldownDisplay(
                    ticksToMs(cdInfo.cooldownTicks),
                    ap,
                    reductionPerApMs,
                    baseMsForTitle,
                    bounds.minMs,
                    { ...displayOpts, effectiveTicks: cdInfo.cooldownTicks }
                );
            }
            if (cdInfo.cooldownMs != null) {
                return buildScaledCooldownDisplay(
                    cdInfo.cooldownMs,
                    ap,
                    reductionPerApMs,
                    baseMsForTitle,
                    bounds.minMs,
                    displayOpts
                );
            }
        }

        if (baseMsForTitle != null) {
            const scaledBaseMs = equipCdr.basis !== 1
                ? Math.round(baseMsForTitle * equipCdr.basis)
                : baseMsForTitle;
            const effectiveMs = computeCdrEffectiveMs(ap, reductionPerApMs, scaledBaseMs, bounds.minMs);
            return buildScaledCooldownDisplay(
                effectiveMs,
                ap,
                reductionPerApMs,
                baseMsForTitle,
                bounds.minMs,
                formulaOpts
            );
        }

        return null;
    }

    function isCooldownApReductionParagraph(paragraph) {
        return /cooldown.*is\s+reduced\s+by/i.test(paragraph?.textContent || '');
    }

    function isSpanBeforeReducedByClause(span, paragraph) {
        if (!paragraph) return true;
        const fullText = paragraph.textContent || '';
        const reducedMatch = fullText.match(/reduced\s+by/i);
        if (!reducedMatch || reducedMatch.index == null) return true;

        const spanText = span.textContent?.trim() ?? '';
        if (!spanText) return false;
        const spanIdx = fullText.indexOf(spanText);
        if (spanIdx < 0) return true;
        return spanIdx < reducedMatch.index;
    }

    function findCooldownParagraphBaseDurationSpan(paragraph) {
        if (!paragraph) return null;

        for (const span of paragraph.querySelectorAll('.text-cooldown')) {
            if (span.classList.contains('bs-scaled-min-cd')) continue;
            const text = span.textContent?.trim() ?? '';
            if (parseTooltipDurationText(text) == null) continue;
            if (isSpanBeforeReducedByClause(span, paragraph)) return span;
        }
        return null;
    }

    function isCooldownPerApMarkerSpan(span) {
        const paragraph = span?.closest?.('p');
        if (!paragraph || !isCooldownApReductionParagraph(paragraph)) return false;
        if (!span?.querySelector?.('img[alt]')) return false;
        return /^1\s*$/.test(String(span.textContent || '').trim());
    }

    function findCooldownReductionDurationSpan(paragraph) {
        if (!paragraph) return null;
        const candidates = [...paragraph.querySelectorAll('.text-cooldown')]
            .filter((span) => parseTooltipDurationText(span.textContent?.trim()) != null);
        if (!candidates.length) return null;
        return candidates.length === 1 ? candidates[0] : candidates[candidates.length - 1];
    }

    function appendCooldownReductionMinDisplay(paragraph, minMs) {
        if (minMs == null || !Number.isFinite(minMs) || paragraph.querySelector('.bs-scaled-min-cd')) return;

        const minTicks = msToGameCooldownTicks(minMs);
        if (minTicks == null) return;
        const { value, suffix } = formatTicksParts(minTicks);

        paragraph.appendChild(document.createTextNode(', minimum '));
        const minSpan = document.createElement('span');
        minSpan.className = 'text-cooldown bs-scaled-min-cd';
        minSpan.textContent = `${value}${suffix}`;
        minSpan.title = `Minimum ability cooldown (${formatTicks(minTicks)})`;
        paragraph.appendChild(minSpan);
        paragraph.appendChild(document.createTextNode('.'));
    }

    function rewriteCooldownReductionClause(paragraph, durationSpan, scaled, originalText, minMs) {
        applyScaledTooltipValue(durationSpan, originalText, scaled, originalText);
        collapseTooltipScalingSuffix(paragraph, durationSpan);
        normalizeScaledInlineSpacing(durationSpan);
        appendCooldownReductionMinDisplay(paragraph, minMs);
        if (!paragraph.textContent?.trim().endsWith('.')) {
            paragraph.appendChild(document.createTextNode('.'));
        }
    }

    function enhanceStaticCooldownDurationSpans(root) {
        if (!root) return 0;

        let applied = 0;
        for (const span of root.querySelectorAll('.text-cooldown, .text-stun, .text-silence')) {
            if (span.classList.contains('bs-scaled-value') || span.classList.contains('bs-scaled-min-cd')) continue;

            const paragraph = span.closest('p');
            if (paragraph && isCooldownApReductionParagraph(paragraph) && !isSpanBeforeReducedByClause(span, paragraph)) {
                continue;
            }
            if (span.closest('span.whitespace-nowrap')) continue;

            const originalText = span.textContent?.trim() ?? '';
            if (!isStandaloneDurationSpanText(originalText)) continue;

            const durationMs = parseTooltipDurationText(originalText);
            if (durationMs == null) continue;

            const ticks = msToGameCooldownTicks(durationMs);
            if (ticks == null) continue;

            const { value, suffix } = formatTicksParts(ticks);
            applyScaledTooltipValue(span, originalText, {
                value,
                suffix,
                title: `${originalText} = ${formatTicks(ticks)}`
            }, originalText);
            applied += 1;
        }
        return applied;
    }

    function enhanceCooldownReductionParagraphs(root, unit) {
        if (!root || !unit || unit.ap == null || !Number.isFinite(unit.ap)) return 0;

        let applied = 0;
        for (const paragraph of root.querySelectorAll('p')) {
            if (!isCooldownApReductionParagraph(paragraph)) continue;

            const durationSpan = findCooldownReductionDurationSpan(paragraph);
            if (!durationSpan || durationSpan.classList.contains('bs-scaled-value')) continue;

            const originalText = durationSpan.textContent?.trim() ?? '';
            const reductionPerApMs = parseTooltipDurationText(originalText);
            if (!reductionPerApMs) continue;

            const { baseMs, minMs } = resolveCdrBoundsForUnit(unit, reductionPerApMs);
            const equipCdr = resolveAbilityScalingEquipCdr(unit);
            let scaled = buildScaledCooldownReductionTotalDisplay(
                unit.ap, reductionPerApMs, { baseMs, minMs }, equipCdr);
            if (!scaled) continue;

            logAbilityScaling('cooldown reduction', {
                originalText,
                reductionPerApMs,
                ap: unit.ap,
                baseMs,
                minMs,
                equipCdr,
                scaled,
                abilitySrc: unit.abilitySrc,
                gameId: unit.gameId,
                name: unit.name
            });

            rewriteCooldownReductionClause(paragraph, durationSpan, scaled, originalText, minMs);
            applied += 1;

            const baseSpan = findCooldownParagraphBaseDurationSpan(paragraph);
            if (baseSpan && !baseSpan.classList.contains('bs-scaled-value')) {
                const baseOriginal = baseSpan.textContent?.trim() ?? '';
                let baseScaled = resolveScaledAbilityCooldownDetails(unit, reductionPerApMs, equipCdr);
                if (!baseScaled) {
                    const baseMs = parseTooltipDurationText(baseOriginal);
                    const baseTicks = baseMs != null ? msToGameCooldownTicks(baseMs) : null;
                    if (baseTicks != null) {
                        const { value, suffix } = formatTicksParts(baseTicks);
                        baseScaled = {
                            value,
                            suffix,
                            title: `${baseOriginal} = ${formatTicks(baseTicks)}`
                        };
                    }
                }
                if (baseScaled) {
                    applyScaledTooltipValue(baseSpan, baseOriginal, baseScaled, baseOriginal);
                    applied += 1;
                }
            }
        }
        return applied;
    }

    function collapseTooltipScalingSuffix(wrap, baseSpan) {
        if (!wrap || !baseSpan) return;
        let node = baseSpan.nextSibling;
        while (node) {
            const next = node.nextSibling;
            wrap.removeChild(node);
            node = next;
        }
    }

    function ensureAdjacentTooltipSpace(node, sides = {}) {
        if (!node?.parentNode) return;
        if (sides.before) {
            const prev = node.previousSibling;
            if (prev?.nodeType === Node.TEXT_NODE) {
                if (!/\s$/.test(prev.textContent)) {
                    prev.textContent += ' ';
                }
            } else {
                node.parentNode.insertBefore(document.createTextNode(' '), node);
            }
        }
        if (sides.after) {
            const next = node.nextSibling;
            if (next?.nodeType === Node.TEXT_NODE) {
                const text = next.textContent || '';
                const trimmedStart = text.replace(/^\s+/, '');
                if (/^[,.;:!?]/.test(trimmedStart)) {
                    if (text !== trimmedStart) next.textContent = trimmedStart;
                } else if (!/^\s/.test(text)) {
                    next.textContent = ` ${text}`;
                }
            } else if (next) {
                node.parentNode.insertBefore(document.createTextNode(' '), next);
            }
        }
    }

    function trimParenthesisAroundNode(node) {
        if (!node?.parentNode) return;
        let prev = node.previousSibling;
        while (prev) {
            if (prev.nodeType !== Node.TEXT_NODE) break;
            const text = prev.textContent;
            if (!text.includes('(')) break;
            if (/^\s*\(\s*$/.test(text)) {
                prev.remove();
            } else {
                prev.textContent = text.replace(/\s*\(\s*$/, '');
            }
            break;
        }
        let next = node.nextSibling;
        while (next) {
            if (next.nodeType !== Node.TEXT_NODE) break;
            const text = next.textContent;
            if (!text.includes(')')) break;
            if (/^\s*\)\s*$/.test(text)) {
                next.remove();
            } else {
                next.textContent = text.replace(/^\s*\)\s*/, '');
            }
            break;
        }
    }

    function normalizeScaledInlineSpacing(node) {
        ensureAdjacentTooltipSpace(node, { before: true, after: true });
        normalizeTooltipPunctuationSpacing(node);
    }

    function collapseTooltipRatioSpan(ratioSpan, valueNode) {
        if (!ratioSpan) return;
        trimParenthesisAroundNode(ratioSpan);
        ratioSpan.remove();
        normalizeScaledInlineSpacing(valueNode);
    }

    function parseTooltipStatMultiplierSpan(span) {
        const text = span.textContent?.trim() ?? '';
        if (/\bper\b/i.test(text) || /%/.test(text) || /\ba cada\b/i.test(text)) return null;

        const match = text.match(/^([\d.]+)/);
        if (!match) return null;
        const ratio = parseFloat(match[1]);
        if (!Number.isFinite(ratio) || ratio < 0) return null;

        const img = span.querySelector('img[alt]');
        const alt = String(img?.getAttribute('alt') || '').toLowerCase();
        const isAp = alt.includes('ability power') || alt.includes('abilitypower');
        const isAd = alt.includes('attack damage') || alt.includes('attackdamage');
        if (!isAp && !isAd) return null;

        return { ratio };
    }

    function buildScaledStatMultiplierResult(statInfo, ratio) {
        const statValue = statInfo?.value;
        const statLabel = statInfo?.label || 'stat';
        if (statValue == null || !Number.isFinite(statValue)) return null;

        const rawTotal = statValue * ratio;
        const total = Math.floor(rawTotal);
        const inner = `${statValue} ${statLabel} × ${ratio}`;
        const expression = formatScalingExpression(inner, rawTotal, total);
        return {
            value: total,
            suffix: '',
            title: buildScalingMathTitle({
                base: 0,
                statValue,
                statLabel,
                total,
                expression
            })
        };
    }

    function detectInlineStatMultiplierDamageType(span, contextText, statInfo) {
        if (span.classList.contains('text-healing')) return 'heal';
        const ctx = String(contextText || '').toLowerCase();
        if (/\b(heal|heals|self-heals?|restores|regenerates)\b/.test(ctx)) return 'heal';
        return detectTooltipScalingDamageType(span, contextText, statInfo) || 'magic';
    }

    function enhanceInlineHealPerApChunkSpan(span, unit) {
        if (!span || span.classList.contains('bs-scaled-value')) return false;
        if (span.closest('span.whitespace-nowrap')) return false;
        if (span.style.display === 'none') return false;
        if (!isHealPerStatChunkMarkerSpan(span)) return false;

        const text = span.textContent?.trim() ?? '';
        const chunkMatch = text.match(/^([\d.]+)/);
        if (!chunkMatch) return false;
        const chunkSize = parseFloat(chunkMatch[1]);
        if (!Number.isFinite(chunkSize) || chunkSize <= 0) return false;

        const img = span.querySelector('img[alt]');
        const alt = String(img?.getAttribute('alt') || '').toLowerCase();
        if (!alt.includes('ability power') && !alt.includes('abilitypower')) return false;

        const container = span.closest('p, li');
        if (!container) return false;

        let baseSpan = null;
        let baseAmount = null;
        for (const candidate of container.querySelectorAll('.text-healing')) {
            if (candidate === span || candidate.classList.contains('bs-scaled-value')) continue;
            const amount = parseTooltipHealAmountText(candidate.textContent?.trim());
            if (amount != null) {
                baseSpan = candidate;
                baseAmount = amount;
                break;
            }
        }
        if (!baseSpan || baseAmount == null) return false;

        const statInfo = resolveAbilityScalingStatInfo(span, unit);
        const statValue = statInfo.value;
        if (statValue == null || !Number.isFinite(statValue)) return false;

        const rawTotal = (statValue / chunkSize) * baseAmount;
        const total = Math.floor(rawTotal);
        const inner = `(${statValue} ${statInfo.label} ÷ ${chunkSize}) × ${baseAmount}`;
        const expression = formatScalingExpression(inner, rawTotal, total, ' HP');
        collapseTooltipRatioSpan(span, baseSpan);
        trimTooltipPerLabelAfterNode(baseSpan);
        applyScaledTooltipValue(baseSpan, `${baseAmount} HP`, {
            value: total,
            suffix: ' HP',
            title: buildScalingMathTitle({
                base: baseAmount,
                statValue,
                statLabel: statInfo.label,
                total,
                suffix: ' HP',
                expression
            })
        }, `${baseAmount} HP`);
        baseSpan.textContent = `${total} HP`;
        normalizeScaledInlineSpacing(baseSpan);

        logAbilityScaling('inline heal per ap chunk', {
            baseAmount,
            chunkSize,
            statValue,
            total,
            gameId: unit.gameId,
            name: unit.name
        });
        return true;
    }

    function enhanceInlineStatMultiplierSpan(span, unit) {
        if (!span || span.classList.contains('bs-scaled-value')) return false;
        if (span.closest('span.whitespace-nowrap')) return false;
        if (span.style.display === 'none') return false;
        if (isCooldownPerApMarkerSpan(span)) return false;
        if (isHealPerStatChunkMarkerSpan(span)) return false;

        const parsed = parseTooltipStatMultiplierSpan(span);
        if (!parsed) return false;

        const statInfo = resolveAbilityScalingStatInfo(span, unit);
        const scaled = buildScaledStatMultiplierResult(statInfo, parsed.ratio);
        if (!scaled) return false;

        const container = span.closest('p, li');
        const contextText = container?.textContent || '';
        const damageType = detectInlineStatMultiplierDamageType(span, contextText, statInfo);

        trimParenthesisAroundNode(span);

        const wrap = document.createElement('span');
        wrap.className = 'whitespace-nowrap';
        const valueSpan = document.createElement('span');
        wrap.appendChild(valueSpan);

        applyScaledTooltipValue(valueSpan, '0', scaled, String(parsed.ratio));
        if (damageType) applyScaledDamageTypePresentation(wrap, valueSpan, damageType);

        span.replaceWith(wrap);
        normalizeScaledInlineSpacing(wrap);

        logAbilityScaling('inline stat multiplier', {
            ratio: parsed.ratio,
            statValue: statInfo.value,
            scaled,
            damageType,
            gameId: unit.gameId,
            name: unit.name
        });
        return true;
    }

    function enhanceInlineFlatSpeedScalingSpan(span, unit) {
        if (!span || span.classList.contains('bs-scaled-value')) return false;
        if (span.closest('span.whitespace-nowrap')) return false;
        if (span.style.display === 'none') return false;

        const ratioText = span.textContent?.trim() ?? '';
        const perChunk = parseTooltipPerChunkRatio(ratioText);
        if (!perChunk || perChunk.isPercent || perChunk.isDuration) return false;

        const container = span.closest('p, li');
        if (!container || !/\bspeed\b/i.test(container.textContent)) return false;

        let baseSpan = null;
        for (const candidate of container.querySelectorAll('.text-speed')) {
            if (candidate === span || candidate.classList.contains('bs-scaled-value')) continue;
            if (parseTooltipFlatText(candidate.textContent?.trim()) != null) {
                baseSpan = candidate;
                break;
            }
        }
        if (!baseSpan) return false;

        const statInfo = resolveAbilityScalingStatInfo(span, unit);
        const baseText = baseSpan.textContent?.trim() ?? '';
        const scaled = computeScaledTooltipTotal(baseText, ratioText, statInfo, container.textContent);
        if (!scaled) return false;

        const sign = baseText.startsWith('+') ? '+' : (baseText.startsWith('-') ? '-' : '');
        applyScaledTooltipValue(baseSpan, baseText, scaled, baseText);
        if (sign) baseSpan.textContent = `${sign}${scaled.value}${scaled.suffix}`;

        logAbilityScaling('inline speed boost', {
            baseText,
            ratioText,
            statValue: statInfo.value,
            scaled,
            gameId: unit.gameId,
            name: unit.name
        });
        collapseTooltipRatioSpan(span, baseSpan);
        return true;
    }

    function enhanceInlinePercentScalingSpan(span, unit) {
        if (!span || span.classList.contains('bs-scaled-value')) return false;
        const text = span.textContent?.trim() ?? '';
        const ratio = parseTooltipPerStatPercentRatio(text);
        if (!ratio) return false;

        const statInfo = resolveAbilityScalingStatInfo(span, unit);
        const statValue = statInfo.value;
        if (statValue == null || !Number.isFinite(statValue)) return false;

        const { amount: ratioAmount, chunkSize } = ratio;

        const container = span.closest('p, li');
        if (!container) return false;

        let baseSpan = container.querySelector('.text-lifesteal, .text-attackSpeed');
        if (!baseSpan || baseSpan === span || baseSpan.classList.contains('bs-scaled-value')) {
            baseSpan = null;
            for (const candidate of container.querySelectorAll('span')) {
                if (candidate === span || candidate.classList.contains('bs-scaled-value')) continue;
                if (parseTooltipLabeledPercentText(candidate.textContent?.trim()) != null) {
                    baseSpan = candidate;
                    break;
                }
            }
        }
        if (!baseSpan) return false;

        const labeled = parseTooltipLabeledPercentText(baseSpan.textContent?.trim());
        if (!labeled) return false;
        const signedBase = labeled.sign === '-'
            ? -Math.abs(labeled.percent)
            : (labeled.sign === '+' ? Math.abs(labeled.percent) : labeled.percent);
        const rawTotal = signedBase + (statValue / chunkSize) * ratioAmount;
        const total = Math.floor(rawTotal);
        const inner = `${signedBase}% + (${statValue} ${statInfo.label} ÷ ${chunkSize}) × ${ratioAmount}%`;
        const expression = formatScalingExpression(inner, rawTotal, total, '%');
        const cleanLabel = stripTooltipScalingParenthetical(labeled.label);
        collapseTooltipRatioSpan(span, baseSpan);
        applyScaledTooltipValue(baseSpan, `${signedBase}%`, {
            value: total,
            suffix: '%',
            title: buildScalingMathTitle({
                base: signedBase,
                statValue,
                statLabel: statInfo.label,
                total,
                suffix: '%',
                expression
            })
        }, `${signedBase}%`);
        if (cleanLabel) {
            baseSpan.textContent = `${total}%${cleanLabel}`;
        }
        return true;
    }

    function enhanceAbilityTooltipScaledValues(root, unit, options = {}) {
        return profileUnitsLag('enhanceAbilityTooltip', () => {
        if (!root || !unit) return 0;
        const force = options.force === true;
        const scalingUnit = resolveUnitAbilityScalingStats(unit) || unit;
        if (scalingUnit.ap == null && scalingUnit.ad == null && scalingUnit.hp == null) return 0;

        let applied = enhanceCooldownReductionParagraphs(root, scalingUnit);
        applied += enhanceStaticCooldownDurationSpans(root);

        for (const wrap of root.querySelectorAll('span.whitespace-nowrap')) {
            const spans = getTooltipWrapSpans(wrap);
            if (spans.length < 2) {
                if (wrap.querySelector('.bs-scaled-value')) {
                    const icon = wrap.querySelector('.bs-scaled-damage-icon');
                    if (icon) {
                        icon.className = 'pixelated inline -translate-y-px bs-scaled-damage-icon';
                        trimTooltipWrapTrailingContent(wrap);
                    }
                } else {
                    logAbilityScaling('skip wrap: not enough spans', {
                        spanCount: spans.length,
                        html: wrap.innerHTML.slice(0, 120)
                    });
                }
                continue;
            }
            if (!force && spans[0].classList.contains('bs-scaled-value')) continue;

            const baseText = spans[0].textContent?.trim() ?? '';
            const ratioText = spans[1].textContent?.trim() ?? '';
            const statInfo = resolveAbilityScalingStatInfo(wrap, scalingUnit);
            const statValue = statInfo.value;
            const contextText = wrap.closest('p')?.textContent || '';
            if (isCooldownApReductionParagraph(wrap.closest('p'))) continue;
            const scaled = computeScaledTooltipTotal(baseText, ratioText, statInfo, contextText);
            logAbilityScaling('nowrap block', {
                baseText,
                ratioText,
                statValue,
                scaled,
                gameId: scalingUnit.gameId,
                name: scalingUnit.name
            });
            if (!scaled) continue;
            const damageType = shouldAppendScaledDamageIcon(wrap, baseText, scaled, contextText, statInfo)
                ? detectTooltipScalingDamageType(wrap, contextText, statInfo)
                : null;
            applyScaledTooltipValue(spans[0], baseText, scaled, baseText);
            collapseTooltipScalingSuffix(wrap, spans[0]);
            if (damageType) applyScaledDamageTypePresentation(wrap, spans[0], damageType);
            applied += 1;
        }

        for (const span of root.querySelectorAll('.text-abilityPower, .text-villain')) {
            if (enhanceInlineFlatSpeedScalingSpan(span, scalingUnit)) applied += 1;
            else if (enhanceInlineHealPerApChunkSpan(span, scalingUnit)) applied += 1;
            else if (enhanceInlineStatMultiplierSpan(span, scalingUnit)) applied += 1;
            else if (enhanceInlinePercentScalingSpan(span, scalingUnit)) applied += 1;
        }

        for (const scaled of root.querySelectorAll('.bs-scaled-value')) {
            normalizeTooltipPunctuationSpacing(scaled);
        }

        return applied;
        });
    }

    function bumpAbilityEnhanceGeneration(details) {
        if (!details) return 0;
        const next = (Number(details._abilityEnhanceGeneration) || 0) + 1;
        details._abilityEnhanceGeneration = next;
        return next;
    }

    function scheduleAbilityTooltipEnhance(root, unit, details, component, attempt = 0, generation = null) {
        if (!root || !unit) return;
        if (attempt === 0) {
            generation = details ? bumpAbilityEnhanceGeneration(details) : 0;
            delete root.dataset.abilityEnhancePending;
        } else if (generation == null) {
            generation = details?._abilityEnhanceGeneration ?? 0;
        }
        const maxAttempts = 16;
        const run = () => {
            if (details && generation !== details._abilityEnhanceGeneration) return;
            if (root.dataset.abilityScaled === '1' && attempt === 0) {
                delete root.dataset.abilityEnhancePending;
                return;
            }
            const wraps = root.querySelectorAll('span.whitespace-nowrap');
            const hasContent = Boolean(root.textContent?.trim());
            const hasStats = unit.ap != null || unit.ad != null || unit.hp != null;
            if (details && hasContent && !getAbilityTooltipTemplate(details) && root.querySelectorAll('.bs-scaled-value').length === 0) {
                setAbilityTooltipTemplate(details, root.innerHTML);
            }
            const applied = enhanceAbilityTooltipScaledValues(root, unit);
            const scaled = root.querySelectorAll('.bs-scaled-value').length;

            logAbilityScaling('enhance attempt', {
                attempt,
                applied,
                wraps: wraps.length,
                scaled,
                hasContent,
                hasStats,
                ap: unit.ap,
                ad: unit.ad,
                gameId: unit.gameId,
                name: unit.name
            });

            if (!hasContent && attempt < maxAttempts) {
                scheduleAbilityTooltipEnhance(root, unit, details, component, attempt + 1, generation);
                return;
            }

            const pendingScale = hasStats && wraps.length > 0 && scaled === 0;
            if (pendingScale && attempt < maxAttempts) {
                scheduleAbilityTooltipEnhance(root, unit, details, component, attempt + 1, generation);
                return;
            }

            if (pendingScale) {
                logAbilityScaling('scaling incomplete after retries', {
                    gameId: unit.gameId,
                    name: unit.name,
                    ap: unit.ap,
                    ad: unit.ad,
                    wraps: wraps.length,
                    html: root.innerHTML.slice(0, 240)
                });
            }

            if (details && generation !== details._abilityEnhanceGeneration) return;

            const shouldFreeze = !pendingScale
                && (scaled > 0 || !hasStats || attempt >= maxAttempts);
            if (details && root.dataset.abilityScaled !== '1' && shouldFreeze) {
                const scalingUnit = resolveBoardAbilityScalingUnit(
                    details,
                    resolveUnitAbilityScalingStats(unit) || unit
                );
                const scalingKey = abilityScalingMountKey(scalingUnit);
                logAbilityScaling('change:freeze', {
                    name: scalingUnit.name,
                    ap: scalingUnit.ap,
                    scalingKey,
                    display: getAbilityTooltipDisplaySnapshot(root)
                });
                enhanceAbilityTooltipScaledValues(root, scalingUnit, { force: true });
                freezeAbilityTooltipContent(details, root, component, scalingKey);
                root.style.visibility = '';
            }
            delete root.dataset.abilityEnhancePending;
        };

        if (attempt === 0) {
            root.dataset.abilityEnhancePending = '1';
            requestAnimationFrame(() => requestAnimationFrame(run));
        } else if (attempt < 5) {
            requestAnimationFrame(run);
        } else {
            setTimeout(run, 20 * Math.max(1, attempt - 3));
        }
    }

    function syncAbilityDetailsDataset(details, unit) {
        if (!details || !unit) return;
        if (unit.gameId != null) details.dataset.unitGameId = String(unit.gameId);
        details.dataset.unitAwaken = unit.awaken ? '1' : '0';
        if (unit.ap != null) details.dataset.unitAp = String(Math.round(unit.ap));
        else delete details.dataset.unitAp;
        if (unit.ad != null) details.dataset.unitAd = String(Math.round(unit.ad));
        else delete details.dataset.unitAd;
    }

    function getAbilityText(gameId, awaken, options = {}) {
        const truncate = options.truncate ?? null;
        const unit = options.unit ?? null;
        const abilityInfo = getAbilityInfo(gameId);
        const TooltipContent = abilityInfo?.TooltipContent;
        const createUIComponent = globalThis.state?.utils?.createUIComponent;
        if (!TooltipContent || typeof createUIComponent !== 'function') return '';

        try {
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:-99999px;top:0;width:520px;max-width:520px;height:auto;overflow:visible;opacity:0;pointer-events:none;z-index:-1;';
            const root = document.createElement('div');
            root.className = 'tooltip-prose';
            root.style.cssText = 'width:100%;font-size:11px;line-height:1.1;';
            host.appendChild(root);
            document.body.appendChild(host);

            const component = awaken
                ? createUIComponent(root, TooltipContent, { awaken: true })
                : createUIComponent(root, TooltipContent);
            if (component?.mount) component.mount();
            if (unit) {
                enhanceAbilityTooltipScaledValues(root, unit);
                scheduleAbilityTooltipEnhance(root, unit, null, component);
            }

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

    function teardownAllAbilityTooltipsInBody(body) {
        if (!body) return;
        for (const details of body.querySelectorAll('.bs-ability-details')) {
            unmountUnitAbilityDetails(details);
        }
    }

    function unmountUnitAbilityDetails(details) {
        if (!details) return;
        clearAbilityTooltipRefreshTimer(details);
        teardownAbilityScalingSubs(details);
        if (details._abilityComponent?.unmount) {
            try { details._abilityComponent.unmount(); } catch { /* ignore */ }
        }
        details._abilityComponent = null;
        delete details.dataset.abilityMountKey;
        delete details.dataset.abilityAppliedScalingKey;
        delete details.dataset.abilityScaled;
        clearAbilityTooltipTemplate(details);
        const mount = details.querySelector('.bs-ability-mount');
        if (mount) mount.innerHTML = '';
    }

    function buildAbilityScalingEquipSig(equipment) {
        if (!equipment) return '';
        if (equipment.spriteId != null) {
            return `${equipment.spriteId}:${equipment.stat || 'x'}:${equipment.tier || 'x'}`;
        }
        if (equipment.gameId != null) {
            return `${equipment.gameId}:${equipment.stat || 'x'}:${equipment.tier || 'x'}`;
        }
        return `${equipment.stat || 'x'}:${equipment.tier || 'x'}`;
    }

    function abilityMountKey(unit) {
        if (!unit?.gameId) return null;
        const ap = unit.ap != null ? Math.round(unit.ap) : 'x';
        const ad = unit.ad != null ? Math.round(unit.ad) : 'x';
        const equipSig = buildAbilityScalingEquipSig(unit.equipment);
        return `${unit.gameId}:${unit.awaken ? 1 : 0}:${ap}:${ad}:${equipSig}`;
    }

    function abilityScalingMountKey(unit) {
        const scaling = resolveUnitAbilityScalingStats(unit) || unit;
        if (!scaling?.gameId) return null;
        const ap = scaling.ap != null ? Math.round(scaling.ap) : 'x';
        const ad = scaling.ad != null ? Math.round(scaling.ad) : 'x';
        const equipSig = buildAbilityScalingEquipSig(scaling.equipment);
        return `${scaling.gameId}:${scaling.awaken ? 1 : 0}:${ap}:${ad}:${equipSig}`;
    }

    function abilityTooltipScalingDisplayMatchesUnit(root, unit) {
        if (!root || !unit) return false;
        const ap = unit.ap != null ? Math.round(unit.ap) : null;
        const ad = unit.ad != null ? Math.round(unit.ad) : null;
        if (ap == null && ad == null) return false;

        const equipCdr = resolveAbilityScalingEquipCdr(unit);
        const unitHasEquipCdr = equipCdr?.basis != null && equipCdr.basis !== 1;
        const equipPctLabel = formatEquipCdrPercentLabel(equipCdr?.percent);

        let matchedStat = false;
        for (const span of root.querySelectorAll('.bs-scaled-value')) {
            const title = span.title || '';
            if (!title) continue;

            if (title.includes('minimum CD') || title.includes('effective CD')) {
                const titleHasEquip = title.includes('equip');
                if (unitHasEquipCdr !== titleHasEquip) return false;
                if (unitHasEquipCdr && equipPctLabel != null
                    && !title.includes(`−${equipPctLabel}%`)) {
                    return false;
                }
            }

            if (ap != null && title.includes(`${ap} AP`)) matchedStat = true;
            if (ad != null && title.includes(`${ad} AD`)) matchedStat = true;
        }
        return matchedStat;
    }

    function isAbilityTooltipEnhancePending(details) {
        if (!details) return false;
        const root = getAbilityTooltipRoot(details);
        if (root?.dataset?.abilityEnhancePending === '1') return true;
        return Boolean(details._abilityComponent && root?.dataset?.abilityScaled !== '1');
    }

    function subscribeAbilityScalingEmitter(emitter, handler, subs) {
        if (typeof emitter?.subscribe !== 'function') return;
        subs.push(emitter.subscribe(handler));
    }

    function teardownAbilityScalingSubs(details) {
        const entry = abilityScalingSubs.get(details);
        if (!entry) return;
        unsubscribeAll(entry.subs);
        abilityScalingSubs.delete(details);
    }

    function subscribeAbilityScalingRefresh(details, unit) {
        teardownAbilityScalingSubs(details);
        if (!details?.open || !unit) return;

        // Pre-fight board preview uses recomputed panel stats; live actors can report
        // stale AP (before equip) and spam onChange while the tooltip is frozen.
        if (!isFightActive() && (unit.source === 'board' || unit.source === 'map')) {
            return;
        }

        const unitKey = normalizeCollapseKey(getUnitCollapseKey(unit));
        const actor = findActorForPanelUnit(unit);
        if (!actor) return;

        const subs = [];
        const refresh = () => {
            if (!details.open || isAbilityTooltipEnhancePending(details)) return;
            if (activeTab !== 'units') return;
            const panel = document.getElementById(PANEL_ID);
            if (!panel || panel.style.display === 'none') return;
            queueAbilityTooltipRefresh(details, unitKey);
        };
        for (const key of ABILITY_SCALING_STAT_KEYS) {
            subscribeAbilityScalingEmitter(actor[key]?.onChange, refresh, subs);
        }
        subscribeAbilityScalingEmitter(actor.onBuff, refresh, subs);
        subscribeAbilityScalingEmitter(actor.onDebuff, refresh, subs);
        if (subs.length) abilityScalingSubs.set(details, { subs, unitKey });
    }

    function getAbilityTooltipTemplate(details) {
        const stored = details?._abilityTooltipTemplate;
        if (typeof stored === 'string' && stored.trim()) return stored;
        const legacy = details?.dataset?.abilityTooltipTemplate;
        return typeof legacy === 'string' && legacy.trim() ? legacy : '';
    }

    function setAbilityTooltipTemplate(details, html) {
        if (!details || typeof html !== 'string' || !html.trim()) return;
        details._abilityTooltipTemplate = html;
    }

    function clearAbilityTooltipTemplate(details) {
        if (!details) return;
        delete details._abilityTooltipTemplate;
        delete details.dataset.abilityTooltipTemplate;
    }

    function getAbilityTooltipRoot(details) {
        return details?.querySelector('.bs-ability-mount .bs-ability-tooltip') || null;
    }

    function resetAbilityTooltipForRescale(details) {
        const root = getAbilityTooltipRoot(details);
        if (!root) return null;
        const template = getAbilityTooltipTemplate(details);
        if (!template || !abilityTooltipCanRescaleFromHtml(template)) return null;
        root.style.visibility = 'hidden';
        root.innerHTML = template;
        delete root.dataset.abilityScaled;
        delete root.dataset.abilityEnhancePending;
        return root;
    }

    function remountAndScaleAbilityTooltip(details, unit, reason = 'unknown') {
        if (!details?.open || !unit?.gameId) return false;

        clearAbilityTooltipRefreshTimer(details);
        bumpAbilityEnhanceGeneration(details);

        const resolvedUnit = unit.ap != null || unit.ad != null || unit.name
            ? unit
            : resolveUnitForAbilityDetails(details) || unit;
        const scalingUnit = resolveUnitAbilityScalingStats(resolvedUnit) || resolvedUnit;
        const mount = details.querySelector('.bs-ability-mount');
        if (!mount) return false;

        logAbilityScaling('change:remount', {
            reason,
            name: resolvedUnit.name,
            gameId: resolvedUnit.gameId,
            ap: scalingUnit.ap,
            ad: scalingUnit.ad
        });

        if (details._abilityComponent?.unmount) {
            try { details._abilityComponent.unmount(); } catch { /* ignore */ }
        }
        details._abilityComponent = null;
        mount.innerHTML = '';

        const abilityInfo = getAbilityInfo(resolvedUnit.gameId);
        const createUIComponent = globalThis.state?.utils?.createUIComponent;
        if (!abilityInfo?.TooltipContent || typeof createUIComponent !== 'function') return false;

        const root = document.createElement('div');
        root.className = 'tooltip-prose bs-ability-tooltip';
        root.style.cssText = 'width:100%;color:#ccc;font-size:10px;line-height:1.35;';
        mount.appendChild(root);

        try {
            const component = resolvedUnit.awaken
                ? createUIComponent(root, abilityInfo.TooltipContent, { awaken: true })
                : createUIComponent(root, abilityInfo.TooltipContent);
            if (component?.mount) component.mount();
            details._abilityComponent = component;
            syncAbilityDetailsDataset(details, scalingUnit);
            scheduleAbilityTooltipEnhance(root, scalingUnit, details, component);
            subscribeAbilityScalingRefresh(details, resolvedUnit);
            return true;
        } catch {
            mount.textContent = t('mods.betterAnalytics.abilityDetailsUnavailable');
            return false;
        }
    }

    function resolveFreshPanelUnit(unit) {
        if (!unit) return null;
        const unitKey = normalizeCollapseKey(getUnitCollapseKey(unit));
        return findPanelUnitByCollapseKey(unitKey, { fresh: true }) || unit;
    }

    function refreshAbilityTooltipScaling(details, unit, reason = 'unknown') {
        if (!details?.open || !unit?.gameId) return false;
        if (isAbilityTooltipEnhancePending(details)) return false;

        clearAbilityTooltipRefreshTimer(details);
        bumpAbilityEnhanceGeneration(details);

        const resolvedUnit = resolveFreshPanelUnit(
            unit.ap != null || unit.ad != null || unit.name
                ? unit
                : resolveUnitForAbilityDetails(details) || unit
        );
        const scalingUnit = resolveBoardAbilityScalingUnit(
            details,
            resolveUnitAbilityScalingStats(resolvedUnit) || resolvedUnit
        );
        const scalingKey = abilityScalingMountKey(scalingUnit);
        const rootBefore = getAbilityTooltipRoot(details);
        if (rootBefore?.dataset?.abilityScaled === '1'
            && details.dataset.abilityAppliedScalingKey === scalingKey) {
            return false;
        }
        const before = getAbilityTooltipDisplaySnapshot(rootBefore);

        logAbilityScaling('change:refresh-start', {
            reason,
            name: scalingUnit.name,
            gameId: scalingUnit.gameId,
            ap: scalingUnit.ap,
            ad: scalingUnit.ad,
            prevKey: details.dataset.abilityAppliedScalingKey || null,
            nextKey: scalingKey,
            hasTemplate: Boolean(getAbilityTooltipTemplate(details)),
            before
        });

        const template = getAbilityTooltipTemplate(details);
        if (!template || !rootBefore) {
            return remountAndScaleAbilityTooltip(details, resolvedUnit, 'no-template-or-root');
        }

        if (!abilityTooltipCanRescaleFromHtml(template)) {
            markAbilityTooltipScalingApplied(details, scalingUnit, scalingKey);
            return false;
        }

        const root = resetAbilityTooltipForRescale(details);
        if (!root) {
            return remountAndScaleAbilityTooltip(details, resolvedUnit, 'template-not-scalable');
        }

        syncAbilityDetailsDataset(details, scalingUnit);
        const applied = enhanceAbilityTooltipScaledValues(root, scalingUnit, { force: true });
        if (applied === 0) {
            markAbilityTooltipScalingApplied(details, scalingUnit, scalingKey);
            root.style.visibility = '';
            logAbilityScaling('change:refresh-skip', {
                reason: 'zero-applied',
                ap: scalingUnit.ap,
                ad: scalingUnit.ad
            });
            return false;
        }

        freezeAbilityTooltipContent(details, root, null, scalingKey);
        root.style.visibility = '';
        subscribeAbilityScalingRefresh(details, resolvedUnit);
        clearAbilityTooltipRefreshLogSig(details);

        const after = getAbilityTooltipDisplaySnapshot(root);
        logAbilityScaling('change:refresh-done', {
            reason,
            ap: scalingUnit.ap,
            applied,
            prevKey: before?.scaledText,
            nextKey: scalingKey,
            after
        });
        return true;
    }

    function queueAbilityTooltipRefreshForActor(actor) {
        if (!actor) return;
        const unitKey = normalizeCollapseKey(resolveFightCollapseKey(actor));
        const body = document.getElementById(UNITS_BODY_ID);
        if (!body) return;
        for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
            if (card.dataset.unitKey !== unitKey) continue;
            const details = card.querySelector('.bs-ability-details');
            if (details?.open) queueAbilityTooltipRefresh(details, unitKey);
        }
    }

    function patchOpenAbilityTooltips(body, units) {
        return profileUnitsLag('patchOpenAbilityTooltips', () => {
            if (!body?.querySelector('.bs-ability-details[open]')) return;
            const unitByKey = new Map();
            for (const unit of units) {
                unitByKey.set(normalizeCollapseKey(getUnitCollapseKey(unit)), unit);
            }
            for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
                const abilityDetails = card.querySelector('.bs-ability-details');
                if (!abilityDetails?.open) continue;
                const unit = unitByKey.get(card.dataset.unitKey);
                if (!unit) continue;
                const scalingUnit = resolveBoardAbilityScalingUnit(abilityDetails, unit);
                syncAbilityDetailsDataset(abilityDetails, scalingUnit);
                if (needsAbilityTooltipRefresh(abilityDetails, scalingUnit)) {
                    requestAbilityTooltipRefresh(abilityDetails, card.dataset.unitKey, scalingUnit);
                }
            }
        });
    }

    function abilityTooltipNeedsPoll(body, units) {
        if (!body?.querySelector('.bs-ability-details[open]')) return false;
        const unitByKey = new Map();
        for (const unit of units) {
            unitByKey.set(normalizeCollapseKey(getUnitCollapseKey(unit)), unit);
        }
        for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
            const details = card.querySelector('.bs-ability-details');
            if (!details?.open) continue;
            if (isAbilityTooltipRefreshQueued(details)) return false;
            const unit = unitByKey.get(card.dataset.unitKey);
            if (!unit) continue;
            const scalingUnit = resolveBoardAbilityScalingUnit(details, unit);
            if (needsAbilityTooltipRefresh(details, scalingUnit)) return true;
        }
        return false;
    }

    function boardAbilityTooltipNeedsPoll(body) {
        return abilityTooltipNeedsPoll(body, getRefreshedBoardPreviewUnits());
    }

    function pollOpenAbilityScalingRefresh() {
        if (activeTab !== 'units') return;
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;
        const body = document.getElementById(UNITS_BODY_ID);
        if (!body?.querySelector('.bs-ability-details[open]')) return;

        if (!isFightActive()) {
            if (!boardAbilityTooltipNeedsPoll(body)) return;
            const now = performance.now();
            if (now - lastBoardAbilityPollMs < BOARD_ABILITY_POLL_PENDING_MS) return;
            lastBoardAbilityPollMs = now;
            patchOpenAbilityTooltips(body, getRefreshedBoardPreviewUnits());
            return;
        }

        const units = collectActorSnapshots() || [];
        if (!abilityTooltipNeedsPoll(body, units)) return;
        patchOpenAbilityTooltips(body, units);
    }

    function findPanelUnitByCollapseKey(unitKey, options = {}) {
        const normalized = normalizeCollapseKey(unitKey);
        if (!normalized) return null;
        const units = options.fresh && isFightActive()
            ? (collectActorSnapshots() || [])
            : getCurrentPanelUnits();
        for (const unit of units) {
            if (normalizeCollapseKey(getUnitCollapseKey(unit)) === normalized) {
                return unit;
            }
        }
        return null;
    }

    function isAbilityTooltipRefreshQueued(details) {
        return Boolean(details && abilityTooltipRefreshTimers.has(details));
    }

    function buildAbilityTooltipRefreshLogSig(scalingKey, reasons) {
        return `${scalingKey || ''}|${(reasons || []).join('+')}`;
    }

    function logAbilityTooltipRefreshNeeded(details, payload) {
        if (!details || !payload) return;
        const logSig = buildAbilityTooltipRefreshLogSig(payload.scalingKey, payload.reasons);
        if (details._abilityRefreshLogSig === logSig) return;
        details._abilityRefreshLogSig = logSig;
        logAbilityScaling('change:needs-refresh', payload);
    }

    function clearAbilityTooltipRefreshLogSig(details) {
        if (details) delete details._abilityRefreshLogSig;
    }

    function clearAbilityTooltipRefreshTimer(details) {
        const prev = abilityTooltipRefreshTimers.get(details);
        if (prev) clearTimeout(prev);
        abilityTooltipRefreshTimers.delete(details);
    }

    function queueAbilityTooltipRefresh(details, unitKey, logPayload = null) {
        if (!details?.open || !unitKey) return;
        if (isAbilityTooltipRefreshQueued(details)) return;
        if (logPayload) logAbilityTooltipRefreshNeeded(details, logPayload);
        const timer = setTimeout(() => {
            abilityTooltipRefreshTimers.delete(details);
            const unit = findPanelUnitByCollapseKey(unitKey, { fresh: true });
            if (!unit) return;
            const scalingUnit = resolveBoardAbilityScalingUnit(details, unit);
            const refreshState = getAbilityTooltipRefreshState(details, scalingUnit);
            if (!refreshState.needed) return;
            refreshAbilityTooltipScaling(details, scalingUnit, 'queued');
        }, ABILITY_TOOLTIP_REFRESH_MS);
        abilityTooltipRefreshTimers.set(details, timer);
    }

    function requestAbilityTooltipRefresh(details, unitKey, unit) {
        if (!details?.open || !unitKey || !unit) return;
        if (isAbilityTooltipRefreshQueued(details)) return;
        const refreshState = getAbilityTooltipRefreshState(details, unit);
        if (refreshState.needed) {
            queueAbilityTooltipRefresh(details, unitKey, refreshState.log);
        }
    }

    function getAbilityTooltipRefreshState(details, unit) {
        if (!details?.open || !unit?.gameId) return { needed: false, log: null };
        if (isAbilityTooltipEnhancePending(details)) return { needed: false, log: null };
        if (isAbilityTooltipRefreshQueued(details)) return { needed: false, log: null };

        unit = resolveBoardAbilityScalingUnit(details, unit);
        const scalingKey = abilityScalingMountKey(unit);
        if (!scalingKey) return { needed: false, log: null };

        const root = getAbilityTooltipRoot(details);
        if (root?.dataset?.abilityScaled === '1'
            && details.dataset.abilityAppliedScalingKey === scalingKey) {
            return { needed: false, log: null };
        }
        if (root?.dataset?.abilityScaled === '1' && !abilityTooltipCanRescaleFromTemplate(details)) {
            if (details.dataset.abilityAppliedScalingKey !== scalingKey) {
                markAbilityTooltipScalingApplied(details, unit, scalingKey);
            }
            return { needed: false, log: null };
        }

        const display = getAbilityTooltipDisplaySnapshot(root);
        const reasons = [];
        if (details.dataset.abilityAppliedScalingKey !== scalingKey) {
            reasons.push('scaling-key');
        }
        if (unit.ap != null && details.dataset.unitAp !== String(Math.round(unit.ap))) {
            reasons.push('unit-ap');
        }
        if (unit.ad != null && details.dataset.unitAd !== String(Math.round(unit.ad))) {
            reasons.push('unit-ad');
        }
        if (root?.dataset?.abilityScaled !== '1' && getAbilityTooltipTemplate(details)) {
            reasons.push('not-frozen');
        }
        if (root && !display?.scaledText && abilityTooltipCanRescale(root)) {
            reasons.push('unscaled-display');
        }
        if (!reasons.length) return { needed: false, log: null };

        return {
            needed: true,
            log: {
                name: unit.name,
                gameId: unit.gameId,
                ap: unit.ap,
                ad: unit.ad,
                reasons,
                appliedKey: details.dataset.abilityAppliedScalingKey || null,
                scalingKey,
                display
            }
        };
    }

    function needsAbilityTooltipRefresh(details, unit) {
        return getAbilityTooltipRefreshState(details, unit).needed;
    }

    function mountUnitAbilityDetails(details, unit) {
        if (!details || !unit?.gameId) return;
        clearAbilityTooltipRefreshTimer(details);
        const resolvedUnit = unit.ap != null || unit.ad != null || unit.name
            ? unit
            : resolveUnitForAbilityDetails(details) || unit;
        const scalingUnit = resolveBoardAbilityScalingUnit(
            details,
            resolveUnitAbilityScalingStats(resolvedUnit) || resolvedUnit
        );
        syncAbilityDetailsDataset(details, scalingUnit);
        const scalingKey = abilityScalingMountKey(scalingUnit);
        const mount = details.querySelector('.bs-ability-mount');
        const existingRoot = getAbilityTooltipRoot(details);
        if (scalingKey && details.dataset.abilityAppliedScalingKey === scalingKey) {
            if (existingRoot?.dataset?.abilityScaled === '1') {
                subscribeAbilityScalingRefresh(details, resolvedUnit);
                return;
            }
            if (details._abilityComponent && existingRoot) {
                scheduleAbilityTooltipEnhance(existingRoot, scalingUnit, details, details._abilityComponent);
                subscribeAbilityScalingRefresh(details, resolvedUnit);
                return;
            }
        }
        if (scalingKey
            && details.dataset.abilityAppliedScalingKey !== scalingKey
            && existingRoot) {
            if (isAbilityTooltipEnhancePending(details)) {
                subscribeAbilityScalingRefresh(details, resolvedUnit);
            } else {
                requestAbilityTooltipRefresh(
                    details,
                    normalizeCollapseKey(getUnitCollapseKey(resolvedUnit)),
                    scalingUnit
                );
            }
            return;
        }
        if (!mount) return;

        unmountUnitAbilityDetails(details);
        const abilityInfo = getAbilityInfo(resolvedUnit.gameId);
        if (!abilityInfo?.TooltipContent) {
            mount.textContent = t('mods.betterAnalytics.abilityDetailsUnavailable');
            return;
        }

        const createUIComponent = globalThis.state?.utils?.createUIComponent;
        if (typeof createUIComponent !== 'function') {
            mount.textContent = t('mods.betterAnalytics.abilityDetailsUnavailable');
            return;
        }

        const root = document.createElement('div');
        root.className = 'tooltip-prose bs-ability-tooltip';
        root.style.cssText = 'width:100%;color:#ccc;font-size:10px;line-height:1.35;';
        mount.appendChild(root);

        try {
            const component = resolvedUnit.awaken
                ? createUIComponent(root, abilityInfo.TooltipContent, { awaken: true })
                : createUIComponent(root, abilityInfo.TooltipContent);
            if (component?.mount) component.mount();
            details._abilityComponent = component;
            if (scalingKey) details.dataset.abilityMountKey = scalingKey;
            root.querySelectorAll('blockquote').forEach((bq) => {
                bq.style.setProperty('font-size', '10px', 'important');
            });
            scheduleAbilityTooltipEnhance(root, scalingUnit, details, component);
            subscribeAbilityScalingRefresh(details, resolvedUnit);
        } catch {
            mount.textContent = t('mods.betterAnalytics.abilityDetailsUnavailable');
        }
    }

    function renderAbilityBlockHtml(unit) {
        const abilityInfo = unit.gameId ? getAbilityInfo(unit.gameId) : null;
        if (!abilityInfo) {
            if (!unit.abilitySrc) return '';
            return `<div class="bs-row"><span class="bs-label">Ability:</span> ${escapeHtml(unit.abilitySrc)}</div>`;
        }

        const summaryParts = [];
        if (abilityInfo.icon) {
            summaryParts.push(`<img class="bs-ability-icon pixelated" src="${escapeHtml(abilityInfo.icon)}" alt=""` +
                ` onerror="this.style.display='none'">`);
        }
        summaryParts.push(`<span class="bs-ability-name">${escapeHtml(abilityInfo.name)}</span>`);
        const summary = summaryParts.join('');

        const openAttr = isUnitAbilityOpen(unit) ? ' open' : '';
        const gameIdAttr = unit.gameId != null ? ` data-unit-game-id="${escapeHtml(String(unit.gameId))}"` : '';
        const awakenAttr = ` data-unit-awaken="${unit.awaken ? '1' : '0'}"`;
        const apAttr = unit.ap != null ? ` data-unit-ap="${escapeHtml(String(Math.round(unit.ap)))}"` : '';
        const adAttr = unit.ad != null ? ` data-unit-ad="${escapeHtml(String(Math.round(unit.ad)))}"` : '';

        return `<details class="bs-details bs-ability-details"${openAttr}${gameIdAttr}${awakenAttr}${apAttr}${adAttr}>` +
            `<summary class="bs-ability-summary" title="Click to expand ability details">` +
                `<span class="bs-ability-chevron" aria-hidden="true">▶</span>` +
                `<span class="bs-label">Ability</span>` +
                summary +
            `</summary>` +
            `<div class="bs-ability-mount"></div>` +
        `</details>`;
    }

    function hydrateUnitCardAbility(card, unit) {
        const details = card?.querySelector('.bs-ability-details');
        if (!details) return;
        syncAbilityDetailsDataset(details, unit);
        if (!details.open) return;
        if (isAbilityTooltipEnhancePending(details)) return;
        const root = getAbilityTooltipRoot(details);
        if (!root) {
            mountUnitAbilityDetails(details, unit);
            return;
        }
        requestAbilityTooltipRefresh(details, normalizeCollapseKey(getUnitCollapseKey(unit)), unit);
    }

    function getCurrentPanelUnits() {
        if (isFightActive()) return collectActorSnapshots() || [];
        return getRefreshedBoardPreviewUnits();
    }

    function readAbilityDetailsStat(dataset, key) {
        const raw = dataset?.[key];
        if (raw === undefined || raw === '') return null;
        const value = Number(raw);
        return Number.isFinite(value) ? value : null;
    }

    function resolveUnitFromAbilityDetails(details) {
        if (!details) return null;
        return {
            gameId: readAbilityDetailsStat(details.dataset, 'unitGameId'),
            awaken: details.dataset.unitAwaken === '1',
            ap: readAbilityDetailsStat(details.dataset, 'unitAp'),
            ad: readAbilityDetailsStat(details.dataset, 'unitAd')
        };
    }

    function resolveUnitForAbilityDetails(details) {
        if (!details) return null;
        const card = details.closest('.bs-card');
        const unitKey = card?.dataset?.unitKey;
        if (unitKey) {
            for (const unit of getCurrentPanelUnits()) {
                if (normalizeCollapseKey(getUnitCollapseKey(unit)) === unitKey) {
                    return unit;
                }
            }
        }
        const partial = resolveUnitFromAbilityDetails(details);
        if (partial?.gameId == null) return null;
        return partial;
    }

    function handleUnitsBodyAbilityToggle(e) {
        const details = e.target;
        if (!details?.classList?.contains('bs-ability-details')) return;
        const card = details.closest('.bs-card');
        const key = card?.dataset?.unitKey;
        if (key) writeOpenAbilityOverride(key, details.open);
        if (details.open) mountUnitAbilityDetails(details, resolveUnitForAbilityDetails(details));
        else unmountUnitAbilityDetails(details);
    }

    function ensureUnitsBodyAbilityListener() {
        const body = document.getElementById(UNITS_BODY_ID);
        if (!body) return;
        if (unitsBodyAbilityToggleHandler) return;
        unitsBodyAbilityToggleHandler = handleUnitsBodyAbilityToggle;
        body.addEventListener('toggle', unitsBodyAbilityToggleHandler, true);
    }

    function teardownUnitsBodyAbilityListener() {
        const body = document.getElementById(UNITS_BODY_ID);
        if (body && unitsBodyAbilityToggleHandler) {
            body.removeEventListener('toggle', unitsBodyAbilityToggleHandler, true);
        }
        unitsBodyAbilityToggleHandler = null;
    }

    function formatStatLineForExport(label, live, base, statKey) {
        if (live == null && base == null) return '';
        let line = `  ${label}: ${live != null ? formatUnitStatDisplay(statKey, live) : '—'}`;
        const liveNorm = live != null ? normalizeUnitStatValue(statKey, live) : null;
        const baseNorm = base != null ? normalizeUnitStatValue(statKey, base) : null;
        if (baseNorm != null && baseNorm !== liveNorm) {
            line += ` (base ${formatUnitStatDisplay(statKey, base)})`;
        }
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
            const statLine = formatStatLineForExport(label, unit[key], unit.baseStats?.[key], key);
            if (statLine) lines.push(statLine);
        }

        const attackDelayTicks = resolveUnitAttackDelayTicks(unit);
        if (attackDelayTicks != null) {
            const atkRemainingTicks = resolveUnitAttackDelayRemainingTicks(unit);
            let atkState = unit.attackDelayReady === true
                ? 'ready'
                : atkRemainingTicks != null && atkRemainingTicks > 0
                    ? `${formatTicks(atkRemainingTicks)} left`
                    : unit.attackDelayReady === false
                        ? 'on cooldown'
                        : null;
            lines.push(`  Atk delay: ${formatTicks(attackDelayTicks)}` +
                (atkState ? ` · ${atkState}` : ''));
        }

        const cooldownTicks = resolveUnitCooldownTicks(unit);
        if (cooldownTicks != null) {
            const cdRemainingTicks = resolveUnitCooldownRemainingTicks(unit);
            let cdState = unit.cooldownReady === true
                ? 'ready'
                : cdRemainingTicks != null && cdRemainingTicks > 0
                    ? `${formatTicks(cdRemainingTicks)} left`
                    : unit.cooldownReady === false
                        ? 'on cooldown'
                        : null;
            lines.push(`  Ability CD: ${formatTicks(cooldownTicks)}` +
                (cdState ? ` · ${cdState}` : ''));
        }

        const exportAbilityInfo = unit.gameId ? getAbilityInfo(unit.gameId) : null;
        if (exportAbilityInfo?.name) lines.push(`  Ability: ${exportAbilityInfo.name}`);
        else if (unit.abilitySrc) lines.push(`  Ability: ${unit.abilitySrc}`);
        if (unit.silenced) lines.push('  Silenced');
        if (unit.statusEffects?.length) {
            lines.push(`  Status: ${unit.statusEffects.map((e) => e.label).join(', ')}`);
        }
        if (unit.buffedCount != null && unit.buffedCount > 0) {
            lines.push(`  Active buffs on others: ${unit.buffedCount}`);
        }
        if (unit.alive === false) lines.push(`  ${t('mods.betterAnalytics.defeated')}`);

        const abilityText = unit.gameId ? getAbilityText(unit.gameId, unit.awaken, { unit }) : '';
        if (abilityText) lines.push(`  Ability description: ${abilityText}`);

        return lines.join('\n');
    }

    function buildStatusTextForExport() {
        const lines = [];
        const sandbox = isSandboxMode();
        const fightEnded = isPanelFightResolved() && panelFightTickFrozen != null;
        const fighting = isLiveFightTracking();
        const tick = getFightTick();
        const seed = panelFightSeedFrozen ?? getSeed();
        const modeLabel = getPlayModeLabel();
        const roomName = getRoomDisplayName(resolveCurrentRoomId());

        if (roomName) lines.push(`Map: ${roomName}`);
        if (modeLabel) lines.push(`Mode: ${modeLabel}`);

        if (fightEnded) {
            const endLabel = panelFightEndState === 'victory'
                ? t('mods.betterAnalytics.statusVictory')
                : t('mods.betterAnalytics.statusDefeat');
            const parts = [`${endLabel} · final tick ${getFightTick() ?? panelFightTickFrozen}`];
            if (seed != null) parts.push(`seed ${seed}`);
            parts.push(`${battleLog.length} log entries`);
            lines.push(parts.join(' · '));
        } else if (fighting) {
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
            if (!sandbox) lines.push(t('mods.betterAnalytics.exportSlowMotionSandboxOnly'));
        }

        return lines;
    }

    function isCrossUnitHealEntry(entry) {
        return Boolean(entry.from && entry.from !== '—' && entry.from !== entry.to);
    }

    function formatBattleLogEntryForExport(entry) {
        if (entry.kind === 'marker') {
            if (entry.marker === 'start') {
                return `[tick ${entry.tick}] ${getLogMarkerText({ marker: 'start' })}`;
            }
            return `[tick ${entry.tick}] ${getLogMarkerText(entry)}`;
        }
        if (entry.kind === 'status') {
            const sign = entry.applied ? '+' : '-';
            return `[tick ${entry.tick}] ${entry.to}: ${sign}${entry.effectLabel}`;
        }
        if (entry.kind === 'pathing') {
            return `[tick ${entry.tick}] ${entry.unit}: tile ${entry.fromTile} → tile ${entry.toTile}`;
        }
        if (entry.kind === 'statChange') {
            const from = formatStatChangeValue(entry.statKey, entry.from);
            const to = formatStatChangeValue(entry.statKey, entry.to);
            const delta = formatStatChangeDelta(entry.statKey, entry.delta);
            return `[tick ${entry.tick}] ${entry.unit}: ${entry.statLabel} ${from} → ${to} (${delta})`;
        }
        if (entry.kind === 'abilityCast') {
            return `[tick ${entry.tick}] ${entry.from}: ${t('mods.betterAnalytics.logCast')} ${entry.abilityName}`;
        }
        if (entry.kind === 'death') {
            const defeated = t('mods.betterAnalytics.logDefeated');
            if (entry.killedBy) {
                return `[tick ${entry.tick}] ${entry.killedBy} → ${entry.unit}: ${defeated}`;
            }
            return `[tick ${entry.tick}] ${entry.unit}: ${defeated}`;
        }
        const source = entry.actionSource && entry.actionSource !== 'unknown'
            ? ` [${entry.actionSource}]`
            : '';
        const type = `${entry.damageType}${entry.crit ? t('mods.betterAnalytics.logCritSuffix') : ''}`;
        if (entry.kind === 'heal') {
            const who = isCrossUnitHealEntry(entry) ? `${entry.from} → ${entry.to}` : entry.to;
            return `[tick ${entry.tick}] ${who}: +${entry.amount}${source} (${type})`;
        }
        const dmg = formatLogDamageAmount(entry.amount, entry.rawAmount);
        return `[tick ${entry.tick}] ${entry.from} → ${entry.to}: ${dmg}${source} (${type})`;
    }

    function isNamedLogCreature(name) {
        return Boolean(name && name !== '—' && name !== 'Environment' && name !== 'Unknown');
    }

    function createEmptyBattleLogCreatureStats(name, villain) {
        return {
            key: null,
            name,
            displayName: name,
            villain: villain === true,
            isRoster: false,
            isSummon: false,
            spawnTile: null,
            firstSeenTick: Infinity,
            damageDealt: 0,
            rawDamageDealt: 0,
            overkill: 0,
            damageTaken: 0,
            healingDone: 0,
            healingReceived: 0,
            crits: 0,
            abilityCasts: 0,
            kills: 0,
            deaths: 0
        };
    }

    function resolveBattleLogStatsKey(key, name, villain) {
        if (key) return key;
        return `legacy:${villain ? 'e' : 'a'}:${name}`;
    }

    function touchBattleLogStatsSeen(stats, tick, tile) {
        const t = Number(tick);
        if (Number.isFinite(t) && t < stats.firstSeenTick) {
            stats.firstSeenTick = t;
            if (tile != null) stats.spawnTile = tile;
        }
    }

    function getOrCreateBattleLogCreatureStats(statsMap, key, name, villain) {
        if (!statsMap.has(key)) {
            const stats = createEmptyBattleLogCreatureStats(name, villain);
            stats.key = key;
            statsMap.set(key, stats);
        } else if (villain === true) {
            statsMap.get(key).villain = true;
        }
        return statsMap.get(key);
    }

    function aggregateBattleLogCreatureStats() {
        const statsMap = new Map();

        for (const entry of battleLog) {
            if (entry.kind === 'damage') {
                if (isNamedLogCreature(entry.from)) {
                    const key = resolveBattleLogStatsKey(entry.fromKey, entry.from, entry.fromVillain);
                    const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.from, entry.fromVillain);
                    touchBattleLogStatsSeen(stats, entry.tick, entry.fromTile);
                    stats.damageDealt += entry.amount;
                    const raw = entry.rawAmount != null ? entry.rawAmount : entry.amount;
                    stats.rawDamageDealt += raw;
                    if (entry.overkill > 0) {
                        stats.overkill += entry.overkill;
                    }
                    if (entry.crit) stats.crits++;
                }
                if (isNamedLogCreature(entry.to)) {
                    const key = resolveBattleLogStatsKey(entry.toKey, entry.to, entry.toVillain);
                    const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.to, entry.toVillain);
                    touchBattleLogStatsSeen(stats, entry.tick, entry.toTile);
                    stats.damageTaken += entry.amount;
                }
            } else if (entry.kind === 'heal') {
                if (isCrossUnitHealEntry(entry)) {
                    if (isNamedLogCreature(entry.from)) {
                        const key = resolveBattleLogStatsKey(entry.fromKey, entry.from, entry.fromVillain);
                        const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.from, entry.fromVillain);
                        touchBattleLogStatsSeen(stats, entry.tick, entry.fromTile);
                        stats.healingDone += entry.amount;
                    }
                    if (isNamedLogCreature(entry.to)) {
                        const key = resolveBattleLogStatsKey(entry.toKey, entry.to, entry.toVillain);
                        const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.to, entry.toVillain);
                        touchBattleLogStatsSeen(stats, entry.tick, entry.toTile);
                        stats.healingReceived += entry.amount;
                    }
                } else if (isNamedLogCreature(entry.to)) {
                    const key = resolveBattleLogStatsKey(entry.toKey, entry.to, entry.toVillain);
                    const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.to, entry.toVillain);
                    touchBattleLogStatsSeen(stats, entry.tick, entry.toTile);
                    stats.healingDone += entry.amount;
                    stats.healingReceived += entry.amount;
                }
            } else if (entry.kind === 'abilityCast') {
                if (isNamedLogCreature(entry.from)) {
                    const key = resolveBattleLogStatsKey(entry.fromKey, entry.from, entry.fromVillain);
                    const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.from, entry.fromVillain);
                    touchBattleLogStatsSeen(stats, entry.tick, entry.fromTile);
                    stats.abilityCasts++;
                }
            } else if (entry.kind === 'death') {
                if (isNamedLogCreature(entry.unit)) {
                    const key = resolveBattleLogStatsKey(entry.unitKey, entry.unit, entry.unitVillain);
                    const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.unit, entry.unitVillain);
                    touchBattleLogStatsSeen(stats, entry.tick, entry.unitTile);
                    stats.deaths++;
                }
                if (isNamedLogCreature(entry.killedBy)) {
                    const key = resolveBattleLogStatsKey(entry.killedByKey, entry.killedBy, entry.killedByVillain);
                    const stats = getOrCreateBattleLogCreatureStats(statsMap, key, entry.killedBy, entry.killedByVillain);
                    touchBattleLogStatsSeen(stats, entry.tick, null);
                    stats.kills++;
                }
            }
        }

        return statsMap;
    }

    function buildBattleLogRosterRegistry() {
        const units = getBoardPreviewUnits();
        const allyNames = new Set();
        const enemyNames = new Set();
        const rosterKeys = new Set();
        const rosterUnits = [];
        for (const unit of units) {
            if (!unit?.name) continue;
            const key = unit.collapseKey || getUnitCollapseKey(unit);
            rosterKeys.add(key);
            rosterUnits.push({
                key,
                name: unit.name,
                villain: unit.villain === true,
                tile: unit.tileIndex ?? null
            });
            if (unit.villain) enemyNames.add(unit.name);
            else allyNames.add(unit.name);
        }
        return { allyNames, enemyNames, rosterKeys, rosterUnits };
    }

    function findBattleLogStatsByRosterName(statsMap, name, villain) {
        for (const stats of statsMap.values()) {
            if (stats.name === name && stats.villain === villain) return stats;
        }
        return null;
    }

    function assignBattleLogSummonDisplayNames(statsMap) {
        const summonGroups = new Map();
        for (const stats of statsMap.values()) {
            if (stats.isRoster) {
                stats.displayName = stats.name;
                continue;
            }
            const groupKey = `${stats.villain ? 'e' : 'a'}:${stats.name}`;
            if (!summonGroups.has(groupKey)) summonGroups.set(groupKey, []);
            summonGroups.get(groupKey).push(stats);
        }

        for (const group of summonGroups.values()) {
            group.sort((a, b) => {
                const ta = Number.isFinite(a.firstSeenTick) ? a.firstSeenTick : Infinity;
                const tb = Number.isFinite(b.firstSeenTick) ? b.firstSeenTick : Infinity;
                if (ta !== tb) return ta - tb;
                return String(a.key).localeCompare(String(b.key));
            });
            const multi = group.length > 1;
            group.forEach((stats, index) => {
                if (!multi) {
                    stats.displayName = stats.name;
                    return;
                }
                stats.displayName = tReplace('mods.betterAnalytics.exportSummarySummonInstance', {
                    name: stats.name,
                    index: index + 1
                });
                if (stats.spawnTile != null) {
                    stats.displayName += tReplace('mods.betterAnalytics.exportSummarySummonTile', {
                        tile: stats.spawnTile
                    });
                }
            });
        }
    }

    function prepareBattleLogSummaryStats(statsMap) {
        const roster = buildBattleLogRosterRegistry();

        for (const stats of statsMap.values()) {
            const names = stats.villain ? roster.enemyNames : roster.allyNames;
            stats.isRoster = names.has(stats.name);
            stats.isSummon = !stats.isRoster;
        }

        for (const unit of roster.rosterUnits) {
            if (findBattleLogStatsByRosterName(statsMap, unit.name, unit.villain)) continue;
            const stats = createEmptyBattleLogCreatureStats(unit.name, unit.villain);
            stats.key = unit.key;
            stats.spawnTile = unit.tile;
            stats.isRoster = true;
            stats.isSummon = false;
            stats.displayName = unit.name;
            statsMap.set(unit.key, stats);
        }

        assignBattleLogSummonDisplayNames(statsMap);

        for (const stats of statsMap.values()) {
            if (stats.isRoster && !stats.displayName) stats.displayName = stats.name;
        }

        return statsMap;
    }

    function formatBattleLogDeathsLabel(deaths) {
        if (!deaths) return '';
        return ` ${tReplace('mods.betterAnalytics.exportSummaryDied', { count: deaths })}`;
    }

    function formatBattleLogDamageDealtLine(stats, fightTicks) {
        if (stats.damageDealt) {
            let line = formatBattleLogStatWithRate(
                t('mods.betterAnalytics.exportSummaryDamageDealt'),
                stats.damageDealt,
                fightTicks,
                'DPS'
            );
            if (stats.overkill > 0) {
                line += tReplace('mods.betterAnalytics.exportSummaryOverkillSuffix', {
                    raw: stats.rawDamageDealt,
                    overkill: stats.overkill
                });
            }
            return line;
        }
        if (stats.isRoster) {
            return `  ${t('mods.betterAnalytics.exportSummaryDamageDealt')}: 0`;
        }
        return null;
    }

    function computeStatRate(total, fightTicks) {
        if (!total) return 0;
        return fightTicks > 0 ? calculateDPSFromDamage(total, fightTicks) : 0;
    }

    function formatBattleLogStatWithRate(label, total, fightTicks, rateLabel) {
        if (!total) return null;
        const rate = computeStatRate(total, fightTicks);
        const rateStr = rate > 0 ? ` (${rate} ${rateLabel})` : '';
        return `  ${label}: ${total}${rateStr}`;
    }

    function summarizeBattleLogTeamStats(creatures) {
        return creatures.reduce((acc, stats) => {
            acc.damageDealt += stats.damageDealt;
            acc.damageTaken += stats.damageTaken;
            acc.healingDone += stats.healingDone;
            acc.kills += stats.kills;
            acc.deaths += stats.deaths;
            return acc;
        }, { damageDealt: 0, damageTaken: 0, healingDone: 0, kills: 0, deaths: 0 });
    }

    function formatBattleLogTeamSummaryLine(sectionLabel, teamStats, fightTicks) {
        const parts = [];
        if (teamStats.damageDealt) {
            const dps = fightTicks > 0 ? calculateDPSFromDamage(teamStats.damageDealt, fightTicks) : 0;
            const dpsStr = dps > 0 ? ` · ${dps} DPS` : '';
            parts.push(`${teamStats.damageDealt} ${t('mods.betterAnalytics.exportSummaryDamageShort')}${dpsStr}`);
        }
        if (teamStats.healingDone) {
            const hps = fightTicks > 0 ? calculateDPSFromDamage(teamStats.healingDone, fightTicks) : 0;
            const hpsStr = hps > 0 ? ` · ${hps} HPS` : '';
            parts.push(`${teamStats.healingDone} ${t('mods.betterAnalytics.exportSummaryHealingShort')}${hpsStr}`);
        }
        if (teamStats.kills || teamStats.deaths) {
            parts.push(`${teamStats.kills}K/${teamStats.deaths}D`);
        }
        if (!parts.length) return null;
        return `${sectionLabel} — ${parts.join(' · ')}`;
    }

    function formatBattleLogDamageShare(amount, teamTotal) {
        if (!amount || !teamTotal) return '';
        const pct = Math.round((amount / teamTotal) * 1000) / 10;
        return tReplace('mods.betterAnalytics.exportSummaryDamageShare', { percent: pct });
    }

    function splitBattleLogCreatureStats(statsMap) {
        const allies = [];
        const enemies = [];
        for (const stats of statsMap.values()) {
            if (stats.villain) enemies.push(stats);
            else allies.push(stats);
        }
        allies.sort(sortBattleLogCreatureStats);
        enemies.sort(sortBattleLogCreatureStats);
        return { allies, enemies };
    }

    function buildBattleLogCreatureSummaryModel(stats, fightTicks, teamDamageTotal) {
        const extras = [];
        if (stats.crits) extras.push({ key: 'crits', value: stats.crits });
        if (stats.abilityCasts) extras.push({ key: 'abilityCasts', value: stats.abilityCasts });
        if (stats.kills) extras.push({ key: 'kills', value: stats.kills });
        return {
            label: stats.displayName || stats.name,
            villain: stats.villain === true,
            isSummon: stats.isSummon === true,
            deaths: stats.deaths,
            share: formatBattleLogDamageShare(stats.damageDealt, teamDamageTotal),
            damageDealt: stats.damageDealt,
            overkill: stats.overkill,
            rawDamageDealt: stats.rawDamageDealt,
            isRoster: stats.isRoster === true,
            damageTaken: stats.damageTaken,
            healingDone: stats.healingDone,
            healingReceived: stats.healingReceived,
            healingCombined: stats.healingDone === stats.healingReceived,
            extras,
            fightTicks
        };
    }

    function formatBattleLogCreatureSummaryForExport(stats, fightTicks, teamDamageTotal) {
        const model = buildBattleLogCreatureSummaryModel(stats, fightTicks, teamDamageTotal);
        const team = model.villain
            ? t('mods.betterAnalytics.exportSummaryTeamEnemy')
            : t('mods.betterAnalytics.exportSummaryTeamAlly');
        const summon = model.isSummon ? ` ${t('mods.betterAnalytics.exportSummarySummon')}` : '';
        const died = formatBattleLogDeathsLabel(model.deaths);
        const lines = [`${model.label} [${team}]${summon}${died}${model.share}`];

        const damageDealt = formatBattleLogDamageDealtLine(stats, fightTicks);
        if (damageDealt) lines.push(damageDealt);

        if (model.damageTaken) {
            lines.push(`  ${t('mods.betterAnalytics.exportSummaryDamageTaken')}: ${model.damageTaken}`);
        }

        if (model.healingDone || model.healingReceived) {
            if (model.healingCombined) {
                const healing = formatBattleLogStatWithRate(
                    t('mods.betterAnalytics.exportSummaryHealing'),
                    model.healingDone,
                    fightTicks,
                    'HPS'
                );
                if (healing) lines.push(healing);
            } else {
                const healingDone = formatBattleLogStatWithRate(
                    t('mods.betterAnalytics.exportSummaryHealingDone'),
                    model.healingDone,
                    fightTicks,
                    'HPS'
                );
                if (healingDone) lines.push(healingDone);
                if (model.healingReceived) {
                    lines.push(`  ${t('mods.betterAnalytics.exportSummaryHealingReceived')}: ${model.healingReceived}`);
                }
            }
        }

        const extraParts = [];
        for (const extra of model.extras) {
            if (extra.key === 'crits') {
                extraParts.push(`${t('mods.betterAnalytics.exportSummaryCrits')}: ${extra.value}`);
            } else if (extra.key === 'abilityCasts') {
                extraParts.push(`${t('mods.betterAnalytics.exportSummaryAbilityCasts')}: ${extra.value}`);
            } else if (extra.key === 'kills') {
                extraParts.push(`${t('mods.betterAnalytics.exportSummaryKills')}: ${extra.value}`);
            }
        }
        if (extraParts.length) lines.push(`  ${extraParts.join(' · ')}`);

        return lines;
    }

    function sortBattleLogCreatureStats(a, b) {
        if (a.isSummon !== b.isSummon) return a.isSummon ? 1 : -1;
        if (a.damageDealt !== b.damageDealt) return b.damageDealt - a.damageDealt;
        if (a.healingDone !== b.healingDone) return b.healingDone - a.healingDone;
        const fa = Number.isFinite(a.firstSeenTick) ? a.firstSeenTick : Infinity;
        const fb = Number.isFinite(b.firstSeenTick) ? b.firstSeenTick : Infinity;
        if (fa !== fb) return fa - fb;
        return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name));
    }

    function appendBattleLogTeamSummaryExportLines(lines, sectionLabel, creatures, fightTicks) {
        if (!creatures.length) return;
        const teamStats = summarizeBattleLogTeamStats(creatures);
        const header = formatBattleLogTeamSummaryLine(sectionLabel, teamStats, fightTicks);
        lines.push('');
        lines.push(header || sectionLabel);

        for (const stats of creatures) {
            lines.push('');
            lines.push(...formatBattleLogCreatureSummaryForExport(stats, fightTicks, teamStats.damageDealt));
        }
    }

    function buildBattleLogSummaryExportLines() {
        const lines = [];
        lines.push(t('mods.betterAnalytics.exportBattleLogSummarySection'));

        const fightTicks = getFightTick();
        if (fightTicks != null && fightTicks > 0) {
            lines.push(tReplace('mods.betterAnalytics.exportSummaryFightDuration', { ticks: fightTicks }));
        }

        const statsMap = prepareBattleLogSummaryStats(aggregateBattleLogCreatureStats());
        if (!statsMap.size) {
            lines.push(t('mods.betterAnalytics.exportSummaryNoCombat'));
            return lines;
        }

        const { allies, enemies } = splitBattleLogCreatureStats(statsMap);

        appendBattleLogTeamSummaryExportLines(
            lines,
            t('mods.betterAnalytics.exportSummaryAlliesHeader'),
            allies,
            fightTicks
        );
        appendBattleLogTeamSummaryExportLines(
            lines,
            t('mods.betterAnalytics.exportSummaryEnemiesHeader'),
            enemies,
            fightTicks
        );

        return lines;
    }

    function invalidatePreparedBattleLogSummaryCache() {
        cachedPreparedBattleLogSummary = null;
        cachedPreparedBattleLogSummaryKey = '';
    }

    function getPreparedBattleLogSummary() {
        const cacheKey = getPreparedBattleLogSummaryCacheKey();
        if (cachedPreparedBattleLogSummary && cachedPreparedBattleLogSummaryKey === cacheKey) {
            return cachedPreparedBattleLogSummary;
        }
        const fightTicks = getFightTick();
        const statsMap = prepareBattleLogSummaryStats(aggregateBattleLogCreatureStats());
        const { allies, enemies } = splitBattleLogCreatureStats(statsMap);
        cachedPreparedBattleLogSummary = { statsMap, allies, enemies, fightTicks };
        cachedPreparedBattleLogSummaryKey = cacheKey;
        return cachedPreparedBattleLogSummary;
    }

    function lookupBattleLogStatsForUnit(unit, statsMap) {
        if (!unit || !statsMap?.size) return null;
        const rawKey = unit.collapseKey || getUnitCollapseKey(unit);
        const normKey = normalizeCollapseKey(rawKey);
        if (statsMap.has(normKey)) return statsMap.get(normKey);
        if (rawKey !== normKey && statsMap.has(rawKey)) return statsMap.get(rawKey);
        for (const [key, stats] of statsMap) {
            if (normalizeCollapseKey(key) === normKey) return stats;
        }
        const matches = [];
        for (const stats of statsMap.values()) {
            if (stats.name === unit.name && stats.villain === (unit.villain === true)) {
                matches.push(stats);
            }
        }
        if (matches.length === 1) return matches[0];
        if (matches.length > 1 && unit.tileIndex != null) {
            const tileMatch = matches.find((s) => s.spawnTile === unit.tileIndex);
            if (tileMatch) return tileMatch;
        }
        return null;
    }

    function getUnitDisplayName(unit) {
        if (!battleLog.length) return unit.name;
        const stats = lookupBattleLogStatsForUnit(unit, getPreparedBattleLogSummary().statsMap);
        return stats?.displayName || unit.name;
    }

    function formatBattleLogStatRowHtml(label, total, fightTicks, rateLabel) {
        if (!total) return '';
        const rate = computeStatRate(total, fightTicks);
        const rateStr = rate > 0
            ? ` <span class="bs-log-summary-rate">(${rate} ${rateLabel})</span>`
            : '';
        return `<div class="bs-log-summary-stat"><span class="bs-label">${escapeHtml(label)}:</span> ${total}${rateStr}</div>`;
    }

    function formatBattleLogCreatureSummaryHtml(stats, fightTicks, teamDamageTotal) {
        const model = buildBattleLogCreatureSummaryModel(stats, fightTicks, teamDamageTotal);
        const teamCls = model.villain ? 'enemy' : 'ally';
        const summonTag = model.isSummon
            ? `<span class="bs-log-summary-tag">${escapeHtml(t('mods.betterAnalytics.exportSummarySummon').trim())}</span>`
            : '';
        const diedTag = model.deaths
            ? `<span class="bs-log-summary-died">${escapeHtml(formatBattleLogDeathsLabel(model.deaths).trim())}</span>`
            : '';
        const shareTag = model.share
            ? `<span class="bs-log-summary-share">${escapeHtml(model.share.trim())}</span>`
            : '';
        const label = escapeHtml(model.label);
        let body = '';

        if (model.damageDealt) {
            body += formatBattleLogStatRowHtml(
                t('mods.betterAnalytics.exportSummaryDamageDealt'),
                model.damageDealt,
                fightTicks,
                'DPS'
            );
            if (model.overkill > 0) {
                body += `<div class="bs-log-summary-stat bs-log-summary-overkill">${escapeHtml(tReplace('mods.betterAnalytics.exportSummaryOverkillSuffix', {
                    raw: model.rawDamageDealt,
                    overkill: model.overkill
                }).trim())}</div>`;
            }
        } else if (model.isRoster) {
            body += `<div class="bs-log-summary-stat"><span class="bs-label">${escapeHtml(t('mods.betterAnalytics.exportSummaryDamageDealt'))}:</span> 0</div>`;
        }

        if (model.damageTaken) {
            body += `<div class="bs-log-summary-stat"><span class="bs-label">${escapeHtml(t('mods.betterAnalytics.exportSummaryDamageTaken'))}:</span> ${model.damageTaken}</div>`;
        }

        if (model.healingDone || model.healingReceived) {
            if (model.healingCombined) {
                body += formatBattleLogStatRowHtml(
                    t('mods.betterAnalytics.exportSummaryHealing'),
                    model.healingDone,
                    fightTicks,
                    'HPS'
                );
            } else {
                body += formatBattleLogStatRowHtml(
                    t('mods.betterAnalytics.exportSummaryHealingDone'),
                    model.healingDone,
                    fightTicks,
                    'HPS'
                );
                if (model.healingReceived) {
                    body += `<div class="bs-log-summary-stat"><span class="bs-label">${escapeHtml(t('mods.betterAnalytics.exportSummaryHealingReceived'))}:</span> ${model.healingReceived}</div>`;
                }
            }
        }

        const extras = [];
        for (const extra of model.extras) {
            if (extra.key === 'crits') extras.push(`${escapeHtml(t('mods.betterAnalytics.exportSummaryCrits'))}: ${extra.value}`);
            else if (extra.key === 'abilityCasts') extras.push(`${escapeHtml(t('mods.betterAnalytics.exportSummaryAbilityCasts'))}: ${extra.value}`);
            else if (extra.key === 'kills') extras.push(`${escapeHtml(t('mods.betterAnalytics.exportSummaryKills'))}: ${extra.value}`);
        }
        const extrasHtml = extras.length
            ? `<div class="bs-log-summary-extras">${extras.join(' · ')}</div>`
            : '';

        return `<div class="bs-log-summary-creature">` +
            `<div class="bs-log-summary-creature-head ${teamCls}">${label}${summonTag}${diedTag}${shareTag}</div>` +
            (body || extrasHtml
                ? `<div class="bs-log-summary-creature-body">${body}${extrasHtml}</div>`
                : '') +
        `</div>`;
    }

    function buildBattleLogSummaryTeamHtml(sectionLabel, creatures, fightTicks, teamClass) {
        const teamStats = summarizeBattleLogTeamStats(creatures);
        const headerLine = formatBattleLogTeamSummaryLine(sectionLabel, teamStats, fightTicks);
        const header = `<div class="bs-log-summary-team-head ${teamClass}">${escapeHtml(headerLine || sectionLabel)}</div>`;
        if (!creatures.length) {
            const emptyText = teamClass === 'enemy'
                ? t('mods.betterAnalytics.sectionEmptyEnemies')
                : t('mods.betterAnalytics.sectionEmptyAllies');
            return `<div class="bs-log-summary-team">${header}<div class="bs-empty">${escapeHtml(emptyText)}</div></div>`;
        }
        const rows = creatures.map((stats) =>
            formatBattleLogCreatureSummaryHtml(stats, fightTicks, teamStats.damageDealt)
        ).join('');
        return `<div class="bs-log-summary-team">${header}${rows}</div>`;
    }

    function buildBattleLogSummaryPanelHtml() {
        const { allies, enemies, fightTicks } = getPreparedBattleLogSummary();
        const title = escapeHtml(t('mods.betterAnalytics.panelBattleLogSummaryTitle'));
        let duration = '';
        if (fightTicks != null && fightTicks > 0) {
            duration = `<div class="bs-log-summary-duration">${escapeHtml(tReplace('mods.betterAnalytics.exportSummaryFightDuration', { ticks: fightTicks }))}</div>`;
        }
        if (!allies.length && !enemies.length) {
            return `<div class="bs-log-summary-inner">` +
                `<div class="bs-log-summary-title">${title}</div>` +
                duration +
                `<div class="bs-empty">${escapeHtml(t('mods.betterAnalytics.exportSummaryNoCombat'))}</div>` +
            `</div>`;
        }
        const alliesHtml = buildBattleLogSummaryTeamHtml(
            t('mods.betterAnalytics.exportSummaryAlliesHeader'),
            allies,
            fightTicks,
            'ally'
        );
        const enemiesHtml = buildBattleLogSummaryTeamHtml(
            t('mods.betterAnalytics.exportSummaryEnemiesHeader'),
            enemies,
            fightTicks,
            'enemy'
        );
        return `<div class="bs-log-summary-inner">` +
            `<div class="bs-log-summary-title">${title}</div>` +
            duration +
            `<div class="bs-log-summary-columns">` +
                `<div class="bs-log-summary-column bs-log-summary-column-ally">${alliesHtml}</div>` +
                `<div class="bs-log-summary-column bs-log-summary-column-enemy">${enemiesHtml}</div>` +
            `</div>` +
        `</div>`;
    }

    function clearSummaryUpdateTimer() {
        if (summaryUpdateTimer) {
            clearTimeout(summaryUpdateTimer);
            summaryUpdateTimer = null;
        }
    }

    function scheduleSummaryTabRender() {
        if (activeTab !== 'summary') return;
        if (summaryUpdateTimer) return;
        const now = performance.now();
        const delay = Math.max(0, SUMMARY_UPDATE_MS - (now - lastSummaryUpdateMs));
        summaryUpdateTimer = setTimeout(() => {
            summaryUpdateTimer = null;
            if (activeTab !== 'summary') return;
            renderSummaryTab();
        }, delay);
    }

    function renderSummaryTab(force) {
        const content = document.getElementById(SUMMARY_CONTENT_ID);
        if (!content) return;
        if (!force) {
            const now = performance.now();
            if (now - lastSummaryUpdateMs < SUMMARY_UPDATE_MS) {
                scheduleSummaryTabRender();
                return;
            }
        }
        clearSummaryUpdateTimer();
        lastSummaryUpdateMs = performance.now();
        if (!battleLog.length) {
            content.innerHTML = `<div class="bs-empty">${escapeHtml(t('mods.betterAnalytics.emptySummaryNoFight'))}</div>`;
            content.dataset.renderSig = '';
            return;
        }
        const sig = `${battleLogRevision}:${getPanelTickRenderKey()}`;
        if (content.dataset.renderSig === sig) return;
        content.dataset.renderSig = sig;
        content.innerHTML = buildBattleLogSummaryPanelHtml();
    }

    function renderLogDamageAmount(entry) {
        const { applied, showRaw, raw } = resolveLogDamageDisplay(entry.amount, entry.rawAmount, { roundRaw: false });
        if (showRaw) {
            return `<span class="bs-log-dmg">${applied} <span class="bs-log-dmg-raw">(${raw})</span></span>`;
        }
        return `<span class="bs-log-dmg">${applied}</span>`;
    }

    function buildPanelExportText() {
        const lines = [];
        lines.push(t('mods.betterAnalytics.exportHeader'));
        lines.push(tReplace('mods.betterAnalytics.exportExported', { timestamp: new Date().toISOString() }));
        lines.push('');
        lines.push(t('mods.betterAnalytics.exportStatusSection'));
        lines.push(...buildStatusTextForExport());
        lines.push('');
        lines.push(t('mods.betterAnalytics.exportUnitsSection'));

        const fighting = isFightActive();
        const units = fighting ? (collectActorSnapshots() || []) : getBoardPreviewUnits();
        const { allies, enemies } = splitByTeam(units);

        lines.push(`${t('mods.betterAnalytics.sectionAllies')} (${allies.length})`);
        if (!allies.length) {
            lines.push(`  ${t('mods.betterAnalytics.exportNoAllies')}`);
        } else {
            for (const unit of allies) {
                lines.push('');
                lines.push(formatUnitForExport(unit));
            }
        }

        lines.push('');
        lines.push(`${t('mods.betterAnalytics.sectionEnemies')} (${enemies.length})`);
        if (!enemies.length) {
            lines.push(`  ${t('mods.betterAnalytics.exportNoEnemies')}`);
        } else {
            for (const unit of enemies) {
                lines.push('');
                lines.push(formatUnitForExport(unit));
            }
        }

        lines.push('');
        lines.push(t('mods.betterAnalytics.exportBattleLogSection'));
        lines.push(tReplace('mods.betterAnalytics.exportTotalEntries', { count: battleLog.length }));
        const activeFilters = LOG_FILTER_ORDER
            .filter((key) => logFilters[key] === true)
            .map((key) => getLogFilterLabel(key));
        lines.push(tReplace('mods.betterAnalytics.exportPanelFilters', {
            filters: activeFilters.length ? activeFilters.join(', ') : t('mods.betterAnalytics.exportNoFilters')
        }));

        if (!battleLog.length) {
            lines.push(t('mods.betterAnalytics.emptyNoBattleEvents'));
        } else {
            for (const entry of battleLog) {
                lines.push(formatBattleLogEntryForExport(entry));
            }
            lines.push('');
            lines.push(...buildBattleLogSummaryExportLines());
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
                --bs-panel-inset: 8px;
                --bs-panel-gap: 4px;
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
                box-sizing: border-box;
            }
            #${PANEL_ID} *,
            #${PANEL_ID} *::before,
            #${PANEL_ID} *::after {
                box-sizing: border-box;
            }
            #${PANEL_ID} .bs-header,
            #${PANEL_ID} .bs-status,
            #${PANEL_ID} .bs-speed-row,
            #${PANEL_ID} .bs-tab-bar,
            #${PANEL_ID} .bs-body {
                width: calc(100% - (2 * var(--bs-panel-inset)));
                margin-left: var(--bs-panel-inset);
                margin-right: var(--bs-panel-inset);
            }
            #${PANEL_ID} .bs-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 6px 8px;
                cursor: move;
                user-select: none;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
                margin-top: var(--bs-panel-gap);
                margin-bottom: var(--bs-panel-gap);
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
                flex: 0 0 auto;
                display: flex;
                align-items: center;
                margin-bottom: var(--bs-panel-gap);
                padding: 0 8px;
                min-height: 32px;
                font-size: 11px;
                line-height: 1.35;
                color: #888;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
                overflow: hidden;
            }
            #${PANEL_ID} .bs-status-line {
                flex: 1 1 auto;
                min-width: 0;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${PANEL_ID} .bs-status b {
                font-weight: 700;
                color: var(--bs-text);
            }
            #${PANEL_ID} .bs-status-sep {
                color: #555;
                padding: 0 2px;
            }
            #${PANEL_ID} .bs-speed-row {
                margin-bottom: var(--bs-panel-gap);
                padding: 6px 8px;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
                font-size: 11px;
                color: var(--bs-text);
            }
            #${PANEL_ID} .bs-speed-toggle-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                margin-bottom: 6px;
            }
            #${PANEL_ID} .bs-speed-toggle-text {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }
            #${PANEL_ID} .bs-speed-toggle-text > span:first-child {
                color: var(--bs-gold);
                font-weight: 700;
            }
            #${PANEL_ID} .bs-speed-value {
                color: var(--bs-text);
                font-weight: 400;
                font-size: 10px;
                white-space: nowrap;
            }
            #${PANEL_ID} .bs-speed-sandbox-only {
                font-size: 9px;
                font-weight: 600;
                color: #d4a24a;
                white-space: nowrap;
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
                margin-bottom: var(--bs-panel-gap);
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
                min-height: 0;
                overflow-y: auto;
                margin-bottom: var(--bs-panel-inset);
                padding: 6px 6px 12px;
                border: 4px solid transparent;
                border-image: var(--bs-frame-4);
                position: relative;
            }
            #${PANEL_ID} #${LOG_BODY_ID} {
                padding-top: 0;
            }
            #${PANEL_ID} .bs-log-sticky-header {
                position: sticky;
                top: 0;
                z-index: 2;
                margin: 0 -6px 0;
                padding: 6px 6px 0;
                background-color: var(--bs-panel-bg);
                background-image: var(--bs-bg);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.35);
            }
            #${PANEL_ID} .bs-log-toolbar {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 8px;
                margin-bottom: 6px;
            }
            #${PANEL_ID} .bs-log-toolbar-text {
                flex: 1 1 auto;
                min-width: 0;
            }
            #${PANEL_ID} .bs-log-title {
                font-size: 12px;
                font-weight: 800;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--bs-gold);
                line-height: 1.2;
            }
            #${PANEL_ID} .bs-log-subtitle {
                margin-top: 3px;
                font-size: 10px;
                line-height: 1.35;
                color: #888;
            }
            #${PANEL_ID} .bs-log-toolbar-actions {
                display: flex;
                flex-shrink: 0;
                gap: 4px;
                align-items: flex-start;
            }
            #${PANEL_ID} .bs-log-clear,
            #${PANEL_ID} .bs-log-toolbar-actions .bs-log-filter {
                border: 3px solid transparent;
                border-image: var(--bs-frame-1);
                background: transparent;
                color: var(--bs-text);
                font-size: 10px;
                padding: 2px 8px;
                cursor: pointer;
                line-height: 1.2;
                white-space: nowrap;
            }
            #${PANEL_ID} .bs-log-filters {
                display: flex;
                flex-direction: column;
                gap: 4px;
                margin-bottom: 6px;
                padding-bottom: 2px;
            }
            #${PANEL_ID} .bs-log-filters-row {
                display: grid;
                grid-template-columns: repeat(5, minmax(0, 1fr));
                gap: 4px;
            }
            #${PANEL_ID} .bs-log-search {
                display: flex;
                align-items: center;
                gap: 4px;
                margin-bottom: 6px;
                width: 100%;
                box-sizing: border-box;
                padding: 4px 6px;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 3px;
            }
            #${PANEL_ID} .bs-log-search-input {
                flex: 1 1 0%;
                min-width: 0;
                width: 100%;
                box-sizing: border-box;
                background: rgba(255, 255, 255, 0.1);
                color: var(--bs-text);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 2px;
                padding: 3px 6px;
                font-size: 10px;
                font-family: inherit;
                outline: none;
            }
            #${PANEL_ID} .bs-log-search-input.focused,
            #${PANEL_ID} .bs-log-search-input:focus {
                color: #fff;
                border-color: rgba(255, 255, 255, 0.4);
            }
            #${PANEL_ID} .bs-log-search-input::placeholder {
                color: #666;
            }
            #${PANEL_ID} .bs-log-filter {
                border: 3px solid transparent;
                border-image: var(--bs-frame-1);
                background: transparent;
                color: #666;
                font-size: 9px;
                padding: 3px 4px;
                cursor: pointer;
                line-height: 1.2;
                width: 100%;
                min-width: 0;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #${PANEL_ID} .bs-log-filter.active {
                color: var(--bs-gold);
            }
            #${PANEL_ID} .bs-log-filter.filter-ally.active { color: var(--bs-ally); }
            #${PANEL_ID} .bs-log-filter.filter-enemy.active { color: var(--bs-enemy); }
            #${PANEL_ID} .bs-log-filter.filter-neutral.active { color: var(--bs-gold); }
            #${PANEL_ID} .bs-log-toolbar-actions .bs-log-filter.filter-all {
                font-weight: bold;
            }
            #${PANEL_ID} .bs-log-pathing { color: #9db4d8; }
            #${PANEL_ID} .bs-log-stat { color: #d4b896; }
            #${PANEL_ID} .bs-log-stat-delta.positive { color: #9fd49f; }
            #${PANEL_ID} .bs-log-stat-delta.negative { color: #f0a0a0; }
            #${PANEL_ID} .bs-log-ability { color: #C678DD; font-weight: 600; }
            #${PANEL_ID} .bs-log-death { color: #E06C75; font-weight: 600; }
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
            #${PANEL_ID} .bs-log-dmg-raw { color: #ABB2BF; font-size: 0.92em; }
            #${PANEL_ID} .bs-log-heal { color: #98C379; }
            #${PANEL_ID} .bs-log-type { color: #61AFEF; }
            #${PANEL_ID} .bs-summary-content {
                padding: 2px 0;
            }
            #${PANEL_ID} .bs-log-summary-inner {
                padding: 8px 6px 4px;
                background: rgba(0, 0, 0, 0.22);
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            #${PANEL_ID} .bs-log-summary-title {
                font-size: 11px;
                font-weight: 800;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: var(--bs-gold);
                margin-bottom: 4px;
            }
            #${PANEL_ID} .bs-log-summary-duration {
                font-size: 10px;
                color: #888;
                margin-bottom: 8px;
            }
            #${PANEL_ID} .bs-log-summary-columns {
                display: flex;
                gap: 8px;
                align-items: flex-start;
            }
            #${PANEL_ID} .bs-log-summary-column {
                flex: 1 1 0;
                min-width: 0;
            }
            #${PANEL_ID} .bs-log-summary-team-head {
                font-size: 10px;
                font-weight: 700;
                color: #ccc;
                margin-bottom: 4px;
                padding-bottom: 2px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            }
            #${PANEL_ID} .bs-log-summary-team-head.ally { color: var(--bs-ally); }
            #${PANEL_ID} .bs-log-summary-team-head.enemy { color: var(--bs-enemy); }
            #${PANEL_ID} .bs-log-summary-creature {
                margin: 6px 0 0;
                padding: 4px 0 2px;
                border-bottom: 1px solid rgba(255, 255, 255, 0.04);
            }
            #${PANEL_ID} .bs-log-summary-creature:last-child {
                border-bottom: none;
            }
            #${PANEL_ID} .bs-log-summary-creature-head {
                font-size: 10px;
                font-weight: 700;
                margin-bottom: 2px;
            }
            #${PANEL_ID} .bs-log-summary-creature-head.ally { color: var(--bs-ally); }
            #${PANEL_ID} .bs-log-summary-creature-head.enemy { color: var(--bs-enemy); }
            #${PANEL_ID} .bs-log-summary-tag,
            #${PANEL_ID} .bs-log-summary-died,
            #${PANEL_ID} .bs-log-summary-share {
                font-weight: 600;
                color: #888;
            }
            #${PANEL_ID} .bs-log-summary-died { color: #E06C75; }
            #${PANEL_ID} .bs-log-summary-share { color: #d4b896; }
            #${PANEL_ID} .bs-log-summary-creature-body {
                padding-left: 8px;
            }
            #${PANEL_ID} .bs-log-summary-stat {
                font-size: 10px;
                line-height: 1.4;
                color: #bbb;
            }
            #${PANEL_ID} .bs-log-summary-rate { color: #888; }
            #${PANEL_ID} .bs-log-summary-extras {
                font-size: 10px;
                color: #999;
                margin-top: 1px;
            }
            #${PANEL_ID} .bs-log-summary-overkill {
                color: #ABB2BF;
                font-size: 9px;
            }
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
            #${PANEL_ID} .bs-portrait-group {
                display: flex;
                align-items: center;
                gap: 3px;
                flex: 0 0 auto;
            }
            #${PANEL_ID} .bs-portrait-group .container-slot,
            #${PANEL_ID} .bs-portrait-group .equipment-portrait,
            #${PANEL_ID} .bs-equip-mount {
                width: 34px;
                height: 34px;
                max-width: 34px;
                max-height: 34px;
                flex: 0 0 auto;
                overflow: hidden;
            }
            #${PANEL_ID} .bs-portrait-group img[alt="creature"] {
                width: 34px;
                height: 34px;
                image-rendering: pixelated;
            }
            #${PANEL_ID} .bs-equip-mount img[alt="empty equipment"] {
                width: 32px;
                height: 32px;
                opacity: 0.6;
                image-rendering: pixelated;
            }
            #${PANEL_ID} .bs-compact-meta {
                flex: 1 1 auto;
                min-width: 0;
                overflow: hidden;
            }
            #${PANEL_ID} .bs-card-name-row {
                display: flex;
                align-items: center;
                gap: 6px;
                min-width: 0;
            }
            #${PANEL_ID} .bs-card-name {
                flex: 1 1 auto;
                min-width: 0;
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
            #${PANEL_ID} .bs-status-effects {
                display: flex;
                flex: 0 1 auto;
                flex-wrap: wrap;
                align-items: center;
                justify-content: flex-end;
                gap: 3px;
                min-width: 0;
                min-height: 0;
            }
            #${PANEL_ID} .bs-status-chip {
                display: inline-flex;
                align-items: center;
                gap: 2px;
                padding: 1px 4px;
                border-radius: 2px;
                font-size: 9px;
                line-height: 1.2;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(0,0,0,0.25);
                max-width: 100%;
                overflow: hidden;
            }
            #${PANEL_ID} .bs-status-chip.buff {
                color: #9fd49f;
                border-color: rgba(96,192,96,0.35);
            }
            #${PANEL_ID} .bs-status-chip.debuff {
                color: #f0a0a0;
                border-color: rgba(255,102,102,0.35);
            }
            #${PANEL_ID} .bs-status-chip.more {
                color: #bbb;
            }
            #${PANEL_ID} .bs-log-status.applied { color: #9fd49f; }
            #${PANEL_ID} .bs-log-status.removed { color: #c0c0c0; }
            #${PANEL_ID} .bs-log-status.buff.applied { color: #9fd49f; }
            #${PANEL_ID} .bs-log-status.debuff.applied { color: #f0a0a0; }
            #${PANEL_ID} .bs-log-marker {
                color: #d4af37;
                font-weight: 600;
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
            #${PANEL_ID} .bs-stat-grid {
                display: grid;
                grid-template-columns: max-content max-content;
                column-gap: 16px;
                row-gap: 2px;
                width: fit-content;
                max-width: 100%;
                margin: 2px 0;
            }
            #${PANEL_ID} .bs-stat-row {
                display: contents;
            }
            #${PANEL_ID} .bs-stat-cell {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 4px;
                min-height: 14px;
            }
            #${PANEL_ID} .bs-stat-icon {
                width: 11px;
                height: 11px;
                flex-shrink: 0;
            }
            #${PANEL_ID} .bs-stat-base {
                color: #777;
                font-size: 9px;
            }
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
                font-size: 10px;
            }
            #${PANEL_ID} .bs-ability-details {
                margin-top: 6px;
            }
            #${PANEL_ID} .bs-ability-summary {
                display: flex;
                align-items: center;
                gap: 6px;
                width: 100%;
                margin: 0;
                padding: 5px 8px;
                list-style: none;
                border: 2px solid #555;
                background: rgba(0, 0, 0, 0.25);
                user-select: none;
            }
            #${PANEL_ID} .bs-ability-summary::-webkit-details-marker {
                display: none;
            }
            #${PANEL_ID} .bs-ability-summary::marker {
                content: '';
            }
            #${PANEL_ID} .bs-ability-summary:hover {
                border-color: #777;
                background: rgba(255, 255, 255, 0.05);
            }
            #${PANEL_ID} .bs-ability-details[open] .bs-ability-summary {
                border-color: var(--bs-info);
                background: rgba(97, 175, 239, 0.08);
            }
            #${PANEL_ID} .bs-ability-chevron {
                flex: 0 0 auto;
                width: 10px;
                color: #aaa;
                font-size: 9px;
                line-height: 1;
                text-align: center;
                transition: transform 0.12s ease, color 0.12s ease;
            }
            #${PANEL_ID} .bs-ability-summary:hover .bs-ability-chevron {
                color: #ddd;
            }
            #${PANEL_ID} .bs-ability-details[open] .bs-ability-chevron {
                color: var(--bs-info);
                transform: rotate(90deg);
            }
            #${PANEL_ID} .bs-ability-summary .bs-label {
                flex: 0 0 auto;
                font-weight: 700;
            }
            #${PANEL_ID} .bs-ability-icon {
                width: 14px;
                height: 14px;
                flex: 0 0 auto;
                image-rendering: pixelated;
            }
            #${PANEL_ID} .bs-ability-name {
                color: var(--bs-gold);
                font-weight: 700;
                flex: 1 1 auto;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            #${PANEL_ID} .bs-ability-mount {
                margin-top: 4px;
                padding: 4px 8px 2px 18px;
                border-left: 2px solid rgba(97, 175, 239, 0.35);
            }
            #${PANEL_ID} .bs-ability-mount .tooltip-prose {
                color: #ccc;
                font-size: 10px;
                line-height: 1.35;
            }
            #${PANEL_ID} .bs-ability-mount .bs-scaled-value {
                text-decoration: underline solid rgba(192, 132, 252, 0.55);
                text-underline-offset: 2px;
                cursor: help;
            }
            #${PANEL_ID} .bs-ability-mount .bs-scaled-damage-icon {
                vertical-align: middle;
                margin-right: -1px;
            }
            #${PANEL_ID} .bs-ability-mount .bs-true-damage-icon {
                filter: brightness(0) invert(1);
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

    function ensurePanelDragListeners(panel) {
        if (!panel || panelDragMouseMoveHandler) return;
        panelDragState.panel = panel;
        panelDragMouseMoveHandler = (e) => {
            if (!panelDragState.dragging || !panelDragState.panel) return;
            const p = panelDragState.panel;
            const nl = clamp(e.clientX - panelDragState.dragX, 0, window.innerWidth - p.offsetWidth);
            const nt = clamp(e.clientY - panelDragState.dragY, 0, window.innerHeight - p.offsetHeight);
            p.style.left = `${nl}px`;
            p.style.top = `${nt}px`;
        };
        panelDragMouseUpHandler = () => {
            if (!panelDragState.dragging || !panelDragState.panel) return;
            panelDragState.dragging = false;
            document.body.style.userSelect = '';
            savePanelSettings({
                left: parseInt(panelDragState.panel.style.left, 10) || 0,
                top: parseInt(panelDragState.panel.style.top, 10) || 0
            });
        };
        document.addEventListener('mousemove', panelDragMouseMoveHandler);
        document.addEventListener('mouseup', panelDragMouseUpHandler);
    }

    function teardownPanelDragListeners() {
        if (panelDragMouseMoveHandler) {
            document.removeEventListener('mousemove', panelDragMouseMoveHandler);
            panelDragMouseMoveHandler = null;
        }
        if (panelDragMouseUpHandler) {
            document.removeEventListener('mouseup', panelDragMouseUpHandler);
            panelDragMouseUpHandler = null;
        }
        panelDragState.reset();
        if (!panelResizeState.isResizing) {
            document.body.style.userSelect = '';
        }
    }

    function onPanelHeaderMouseDown(e) {
        if (e.button !== 0) return;
        if (e.target.tagName === 'BUTTON') return;
        if (e.target.closest('.resize-handle')) return;
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        panelDragState.panel = panel;
        panelDragState.dragging = true;
        const rect = panel.getBoundingClientRect();
        panelDragState.dragX = e.clientX - rect.left;
        panelDragState.dragY = e.clientY - rect.top;
        document.body.style.userSelect = 'none';
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

    function getStatLabel(key) {
        return STAT_KEYS.find((stat) => stat.key === key)?.label || key;
    }

    function renderStatIconHtml(key) {
        const label = getStatLabel(key);
        const src = STAT_ICONS[key];
        if (!src) return '';
        return `<img class="bs-stat-icon pixelated" src="${src}" alt="${escapeHtml(label)}" title="${escapeHtml(label)}">`;
    }

    function renderGridStatCell(unit, key) {
        const live = key === 'hp' ? unit.hp : unit[key];
        const base = unit.baseStats?.[key];
        if (live == null && base == null) return '<div class="bs-stat-cell"></div>';

        const liveNorm = live != null ? normalizeUnitStatValue(key, live) : null;
        const baseNorm = base != null ? normalizeUnitStatValue(key, base) : null;

        let valueHtml;
        if (key === 'hp' && live != null) {
            const hpMaxText = unit.hpMax != null ? formatUnitStatDisplay('hpMax', unit.hpMax) : '?';
            const hpText = unit.source === 'fight'
                ? `${formatUnitStatDisplay('hp', live)}/${hpMaxText}`
                : formatUnitStatDisplay(key, live);
            valueHtml = coloredStatSpan(hpText, unit.alive !== false);
        } else {
            valueHtml = live != null ? formatUnitStatDisplay(key, live) : '—';
        }
        const baseStr = baseNorm != null && baseNorm !== liveNorm
            ? ` <span class="bs-stat-base">(${formatUnitStatDisplay(key, base)})</span>`
            : '';
        return `<div class="bs-stat-cell">${renderStatIconHtml(key)}<span class="bs-stat-value">${valueHtml}${baseStr}</span></div>`;
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

    function defaultUnitCollapsed() {
        return true;
    }

    function isUnitCollapsed(unit) {
        const key = getUnitCollapseKey(unit);
        const stored = readCollapsedOverride(key);
        if (stored !== undefined) return stored;
        return defaultUnitCollapsed();
    }

    function toggleUnitCollapsed(unitKey) {
        const stored = readCollapsedOverride(unitKey);
        const currently = stored === undefined ? defaultUnitCollapsed() : stored;
        writeCollapsedOverride(unitKey, !currently);
        markUnitsInteraction();
    }

    function formatStatusChipText(effect) {
        if (effect?.src) return String(effect.src).toLowerCase();
        if (effect?.id && !String(effect.id).startsWith('fx:')) return String(effect.id).toLowerCase();
        return String(effect?.shortLabel || effect?.label || 'effect').toLowerCase();
    }

    function renderStatusEffectsRowHtml(unit) {
        if (unit?.source === 'fight' && !shouldShowLiveStatusEffects()) return '';
        const effects = unit.statusEffects;
        if (!effects?.length) return '';
        const maxShow = 6;
        const chips = effects.slice(0, maxShow).map((effect) => {
            const cls = effect.type === 'buff' ? 'buff' : 'debuff';
            const text = escapeHtml(formatStatusChipText(effect));
            return `<span class="bs-status-chip ${cls}" title="${escapeHtml(effect.label)}">${text}</span>`;
        }).join('');
        const more = effects.length > maxShow
            ? `<span class="bs-status-chip more" title="${escapeHtml(effects.slice(maxShow).map((e) => e.label).join(', '))}">+${effects.length - maxShow}</span>`
            : '';
        return `<div class="bs-status-effects">${chips}${more}</div>`;
    }

    function renderCompactSummary(unit) {
        const bits = [];
        if (unit.level != null) bits.push(escapeHtml(`Lv ${unit.level}`));
        if (unit.hp != null) {
            const hpText = unit.source === 'fight'
                ? `HP ${unit.hp}/${unit.hpMax ?? '?'}`
                : `HP ${unit.hp}`;
            bits.push(coloredStatSpan(hpText, unit.alive !== false));
        }
        if (unitShowsLiveMechanics(unit)) {
            if (unit.attackDelayReady === true) {
                bits.push(coloredStatSpan('Atk ready', true));
            } else {
                const atkRemainingTicks = resolveUnitAttackDelayRemainingTicks(unit);
                if (atkRemainingTicks != null && atkRemainingTicks > 0) {
                    bits.push(coloredStatSpan(`Atk ${formatTicks(atkRemainingTicks)}`, false));
                } else if (unit.attackDelayReady === false) {
                    bits.push(coloredStatSpan('Atk waiting', false));
                }
            }
        } else {
            const attackDelayTicks = resolveUnitAttackDelayTicks(unit);
            if (attackDelayTicks != null) {
                bits.push(coloredStatSpan(`Atk ${formatTicks(attackDelayTicks)}`, true));
            }
        }
        if (unit.cooldownReady === true && unitShowsLiveMechanics(unit)) {
            bits.push(coloredStatSpan('CD ready', true));
        } else if (!unitShowsLiveMechanics(unit)) {
            const cdTicks = resolveUnitCooldownTicks(unit);
            if (cdTicks != null) {
                bits.push(coloredStatSpan(`CD ${formatTicks(cdTicks)}`, true));
            } else if (unit.cooldownReady === true) {
                bits.push(coloredStatSpan('CD ready', true));
            }
        } else if (unit.cooldownReady === true) {
            bits.push(coloredStatSpan('CD ready', true));
        } else {
            const cdRemainingTicks = resolveUnitCooldownRemainingTicks(unit);
            if (cdRemainingTicks != null && cdRemainingTicks > 0) {
                bits.push(coloredStatSpan(`CD ${formatTicks(cdRemainingTicks)}`, false));
            } else if (unit.cooldownReady === false) {
                bits.push(coloredStatSpan('CD on cooldown', false));
            }
        }
        if (unit.alive === false) bits.push(`<span style="color:#888">${escapeHtml(t('mods.betterAnalytics.defeated'))}</span>`);
        return bits.join(' · ');
    }

    function buildUnitCardStatsHtml(unit) {
        const hasAnyStat = STAT_GRID_ROWS.flat().some((key) => {
            const live = key === 'hp' ? unit.hp : unit[key];
            return live != null || unit.baseStats?.[key] != null;
        });
        if (!hasAnyStat) return '';

        let rowsHtml = '';
        for (const [leftKey, rightKey] of STAT_GRID_ROWS) {
            rowsHtml += `<div class="bs-stat-row">${renderGridStatCell(unit, leftKey)}${renderGridStatCell(unit, rightKey)}</div>`;
        }
        return `<div class="bs-stat-grid">${rowsHtml}</div>`;
    }

    function buildUnitCardTickMechanicsHtml(unit) {
        let mechanicsHtml = '';
        const liveMechanics = unitShowsLiveMechanics(unit);
        const attackDelayTicks = resolveUnitAttackDelayTicks(unit);
        if (attackDelayTicks != null) {
            const atkState = liveMechanics
                ? renderCooldownStateHtml(
                    unit.attackDelayReady,
                    resolveUnitAttackDelayRemainingTicks(unit)
                )
                : null;
            mechanicsHtml += `<div class="bs-row" data-bs-mech="atk-delay"><span class="bs-label">Atk delay:</span> ${formatTicks(attackDelayTicks)}` +
                (atkState ? ` · ${atkState}` : '') +
                `</div>`;
        }
        const cooldownTicks = resolveUnitCooldownTicks(unit);
        if (cooldownTicks != null) {
            const cdState = liveMechanics
                ? renderCooldownStateHtml(
                    unit.cooldownReady,
                    resolveUnitCooldownRemainingTicks(unit)
                )
                : null;
            const initialCd = !liveMechanics && unit.previewInitialCooldownTicks != null
                ? ` · starts ${formatTicks(unit.previewInitialCooldownTicks)}`
                : '';
            const meditatingLabel = unit.isMeditating ? ' <span style="color:#888">(meditating)</span>' : '';
            mechanicsHtml += `<div class="bs-row" data-bs-mech="ability-cd"><span class="bs-label">Ability CD:</span> ${formatTicks(cooldownTicks)}` +
                (cdState ? ` · ${cdState}` : initialCd) +
                `${meditatingLabel}</div>`;
        }
        return mechanicsHtml;
    }

    function buildUnitCardStatusMechanicsHtml(unit) {
        let mechanicsHtml = '';
        if (unit.silenced) {
            mechanicsHtml += `<div class="bs-row" style="color:#E06C75">Silenced</div>`;
        }
        if (unit.buffedCount != null && unit.buffedCount > 0) {
            mechanicsHtml += `<div class="bs-row"><span class="bs-label">Active buffs on others:</span> ${unit.buffedCount}</div>`;
        }
        if (unit.alive === false) {
            mechanicsHtml += `<div class="bs-row" style="color:#888">${escapeHtml(t('mods.betterAnalytics.defeated'))}</div>`;
        }
        return mechanicsHtml;
    }

    function buildUnitCardMechanicsHtml(unit) {
        return buildUnitCardTickMechanicsHtml(unit) + buildUnitCardStatusMechanicsHtml(unit);
    }

    function buildUnitCardLiveInnerHtml(unit) {
        return buildUnitCardStatsHtml(unit) + buildUnitCardMechanicsHtml(unit);
    }

    function buildUnitCardStatPatchKey(unit) {
        return [
            normalizeUnitStatValue('hp', unit.hp),
            normalizeUnitStatValue('hpMax', unit.hpMax),
            normalizeUnitStatValue('ap', unit.ap),
            normalizeUnitStatValue('ad', unit.ad),
            normalizeUnitStatValue('armor', unit.armor),
            normalizeUnitStatValue('magicResist', unit.magicResist),
            normalizeUnitStatValue('speed', unit.speed),
            unit.alive,
            unit.silenced,
            unit.buffedCount,
            getUnitEquipmentPatchSig(unit),
            (unit.statusEffects || []).map((e) => e.id).join('+')
        ].join(':');
    }

    function buildUnitCardMechanicsPatchKey(unit) {
        return [
            resolveUnitAttackDelayTicks(unit),
            resolveUnitCooldownTicks(unit),
            resolveUnitAttackDelayRemainingTicks(unit),
            unit.attackDelayReady,
            resolveUnitCooldownRemainingTicks(unit),
            unit.cooldownReady,
            unit.isMeditating === true
        ].join(':');
    }

    function buildUnitCardPatchKey(unit) {
        return `${buildUnitCardStatPatchKey(unit)}|${buildUnitCardMechanicsPatchKey(unit)}`;
    }

    function patchUnitCardCompactSummary(card, unit) {
        const compact = renderCompactSummary(unit);
        const compactEl = card.querySelector('.bs-card-compact');
        if (compactEl) {
            if (compact) compactEl.innerHTML = compact;
            else compactEl.remove();
        } else if (compact) {
            const meta = card.querySelector('.bs-compact-meta');
            if (meta) {
                const div = document.createElement('div');
                div.className = 'bs-card-compact';
                div.innerHTML = compact;
                meta.appendChild(div);
            }
        }
    }

    function patchUnitCardCompactSummaries(body, units) {
        const unitByKey = new Map();
        for (const unit of units) {
            unitByKey.set(normalizeCollapseKey(getUnitCollapseKey(unit)), unit);
        }
        for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
            const unit = unitByKey.get(normalizeCollapseKey(card.dataset.unitKey));
            if (unit) patchUnitCardCompactSummary(card, unit);
        }
    }

    function patchUnitCardTickMechanics(card, unit) {
        const live = card.querySelector('.bs-card-live');
        if (!live) return;
        live.querySelector('[data-bs-mech="atk-delay"]')?.remove();
        live.querySelector('[data-bs-mech="ability-cd"]')?.remove();
        const tickHtml = buildUnitCardTickMechanicsHtml(unit);
        if (!tickHtml) return;
        const anchor = live.querySelector('.bs-stat-grid');
        if (anchor) anchor.insertAdjacentHTML('afterend', tickHtml);
        else live.insertAdjacentHTML('afterbegin', tickHtml);
    }

    function patchUnitCardsMechanicsOnly(body, units) {
        const unitByKey = new Map();
        for (const unit of units) {
            unitByKey.set(normalizeCollapseKey(getUnitCollapseKey(unit)), unit);
        }
        for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
            const cardKey = normalizeCollapseKey(card.dataset.unitKey);
            const unit = unitByKey.get(cardKey);
            if (!unit) continue;
            const mechPatchKey = buildUnitCardMechanicsPatchKey(unit);
            if (card.dataset.unitMechPatchKey === mechPatchKey) continue;
            const statPatchKey = card.dataset.unitStatPatchKey || buildUnitCardStatPatchKey(unit);
            card.dataset.unitMechPatchKey = mechPatchKey;
            card.dataset.unitPatchKey = `${statPatchKey}|${mechPatchKey}`;
            patchUnitCardTickMechanics(card, unit);
            patchUnitCardCompactSummary(card, unit);
        }
    }

    function patchUnitCardsLiveStats(body, units) {
        return profileUnitsLag('patchUnitCardsLiveStats', () => {
        const unitByKey = new Map();
        for (const unit of units) {
            unitByKey.set(normalizeCollapseKey(getUnitCollapseKey(unit)), unit);
        }
        for (const card of body.querySelectorAll('.bs-card[data-unit-key]')) {
            const unit = unitByKey.get(normalizeCollapseKey(card.dataset.unitKey));
            if (!unit) continue;
            const patchKey = buildUnitCardPatchKey(unit);
            const statPatchKey = buildUnitCardStatPatchKey(unit);
            const mechPatchKey = buildUnitCardMechanicsPatchKey(unit);
            const abilityDetails = card.querySelector('.bs-ability-details');
            if (card.dataset.unitPatchKey === patchKey) {
                if (abilityDetails?.open && needsAbilityTooltipRefresh(abilityDetails, unit)) {
                    syncAbilityDetailsDataset(abilityDetails, unit);
                    requestAbilityTooltipRefresh(abilityDetails, card.dataset.unitKey, unit);
                }
                continue;
            }

            const mechanicsOnly = card.dataset.unitStatPatchKey === statPatchKey
                && card.dataset.unitMechPatchKey !== mechPatchKey;

            card.dataset.unitPatchKey = patchKey;
            card.dataset.unitStatPatchKey = statPatchKey;
            card.dataset.unitMechPatchKey = mechPatchKey;
            card.classList.toggle('dead', unit.alive === false);

            if (mechanicsOnly) {
                patchUnitCardTickMechanics(card, unit);
                patchUnitCardCompactSummary(card, unit);
                continue;
            }

            patchUnitCardCompactSummary(card, unit);
            const statusRow = card.querySelector('.bs-status-effects');
            const statusHtml = renderStatusEffectsRowHtml(unit);
            if (statusRow) {
                if (statusHtml) statusRow.outerHTML = statusHtml;
                else statusRow.remove();
            } else if (statusHtml) {
                const nameEl = card.querySelector('.bs-card-name');
                if (nameEl) {
                    nameEl.insertAdjacentHTML('afterend', statusHtml);
                }
            }
            const live = card.querySelector('.bs-card-live');
            if (live) live.innerHTML = buildUnitCardLiveInnerHtml(unit);
            hydrateUnitCardPortraits(card, unit);
            if (abilityDetails) {
                syncAbilityDetailsDataset(abilityDetails, unit);
                if (abilityDetails.open && needsAbilityTooltipRefresh(abilityDetails, unit)) {
                    requestAbilityTooltipRefresh(abilityDetails, card.dataset.unitKey, unit);
                }
            }
            const nameEl = card.querySelector('.bs-card-name');
            if (nameEl) nameEl.textContent = getUnitDisplayName(unit);
        }
        });
    }

    function renderUnitCard(unit) {
        const unitKey = getUnitCollapseKey(unit);
        const collapsed = isUnitCollapsed(unit);
        const displayKey = normalizeCollapseKey(unitKey);
        const deadClass = unit.alive === false ? ' dead' : '';
        const collapseClass = collapsed ? ' collapsed' : ' expanded';
        const metaParts = [unit.villain ? 'Enemy' : 'Ally'];
        if (unit.awaken) metaParts.push('Awakened');
        if (unit.level != null) metaParts.push(`Lv ${unit.level}`);
        if (unit.tileIndex != null) metaParts.push(`Tile ${unit.tileIndex}`);
        const metaLine = metaParts.join(' · ');
        const nameClass = teamClass(unit.villain);
        const displayName = getUnitDisplayName(unit);
        const compact = renderCompactSummary(unit);
        const hasPortrait = unit.gameId != null;
        const portrait = hasPortrait
            ? `<div class="bs-portrait-group">` +
                `<div class="bs-portrait-mount"></div>` +
                `<div class="bs-equip-mount frame-pressed-1 shrink-0 flex items-center justify-center overflow-hidden"></div>` +
              `</div>`
            : '';

        const liveInner = buildUnitCardLiveInnerHtml(unit);
        const rolesHtml = (unit.roles || []).map((r) => `<span class="bs-tag">${escapeHtml(r)}</span>`).join('');
        const abilityBlock = renderAbilityBlockHtml(unit);
        const statusRow = renderStatusEffectsRowHtml(unit);

        const header = `<div class="bs-card-header-row">` +
            `<span class="bs-toggle" title="${collapsed ? 'Expand' : 'Collapse'}">${collapsed ? '▶' : '▼'}</span>` +
            portrait +
            `<div class="bs-compact-meta">` +
                `<div class="bs-card-name-row">` +
                    `<div class="bs-card-name ${nameClass}">${escapeHtml(displayName)}</div>` +
                    statusRow +
                `</div>` +
                (compact ? `<div class="bs-card-compact">${compact}</div>` : '') +
            `</div>` +
        `</div>`;

        const body = `<div class="bs-card-body">` +
            `<div class="bs-card-meta">${metaLine}</div>` +
            (rolesHtml ? `<div class="bs-row">${rolesHtml}</div>` : '') +
            `<div class="bs-card-live">${liveInner}</div>` +
            abilityBlock +
        `</div>`;

        return `<div class="bs-card${deadClass}${collapseClass}" data-unit-key="${escapeHtml(displayKey)}">` +
            header +
            body +
        `</div>`;
    }

    function renderSection(title, cssClass, units) {
        const count = units.length;
        let inner = `<div class="bs-section-title ${cssClass}">${escapeHtml(title)} (${count})</div>`;
        if (count === 0) {
            const emptyText = cssClass === 'ally'
                ? t('mods.betterAnalytics.sectionEmptyAllies')
                : t('mods.betterAnalytics.sectionEmptyEnemies');
            inner += `<div class="bs-empty">${escapeHtml(emptyText)}</div>`;
        } else {
            inner += units.map(renderUnitCard).join('');
        }
        return `<div class="bs-units-column bs-units-column-${cssClass}">${inner}</div>`;
    }

    function buildStatusBarSignature() {
        const fightEnded = isPanelFightResolved() && panelFightTickFrozen != null;
        const fighting = isLiveFightTracking();
        const seed = fightEnded ? panelFightSeedFrozen : getSeed();
        return [
            resolveCurrentRoomId(),
            getPlayModeLabel(),
            fightEnded ? 'end' : fighting ? 'fight' : 'idle',
            getPanelTickRenderKey(),
            seed,
            isSandboxMode(),
            slowMotionEnabled,
            gameSpeedPercent,
            window.__turboState?.active === true,
            fightEnded ? 'frozen' : resolveCurrentFloor()
        ].join('|');
    }

    function renderStatusBar(force) {
        const title = document.getElementById(TITLE_ID);
        const status = document.getElementById(STATUS_ID);
        const panel = document.getElementById(PANEL_ID);
        if (!title || !status || !panel) return;
        if (panel.style.display === 'none') return;

        const signature = buildStatusBarSignature();
        if (!force && signature === lastStatusBarSignature) return;
        lastStatusBarSignature = signature;

        const sandbox = isSandboxMode();
        const fightEnded = isPanelFightResolved() && panelFightTickFrozen != null;
        const fighting = isLiveFightTracking();
        const tick = getFightTick();
        const seed = panelFightSeedFrozen ?? getSeed();
        const modeLabel = getPlayModeLabel();

        const roomName = getRoomDisplayName(resolveCurrentRoomId());
        title.textContent = getModDisplayName();

        const statusParts = [];
        if (roomName) {
            statusParts.push(`${t('mods.betterAnalytics.statusMap')} <b>${escapeHtml(roomName)}</b>`);
        }
        if (modeLabel) {
            statusParts.push(`${t('mods.betterAnalytics.statusMode')} <b>${escapeHtml(modeLabel)}</b>`);
        }

        if (fightEnded) {
            const endLabel = panelFightEndState === 'victory'
                ? t('mods.betterAnalytics.statusVictory')
                : t('mods.betterAnalytics.statusDefeat');
            const endParts = [endLabel, tReplace('mods.betterAnalytics.statusTick', { tick: tick ?? panelFightTickFrozen })];
            if (seed != null) endParts.push(tReplace('mods.betterAnalytics.statusSeed', { seed }));
            statusParts.push(endParts.join(' '));
        } else if (fighting) {
            const fightParts = [t('mods.betterAnalytics.statusFight')];
            if (tick != null) fightParts.push(tReplace('mods.betterAnalytics.statusTick', { tick }));
            if (seed != null) fightParts.push(tReplace('mods.betterAnalytics.statusSeed', { seed }));
            if (sandbox && slowMotionEnabled) {
                fightParts.push(tReplace('mods.betterAnalytics.statusSlow', { percent: gameSpeedPercent }));
            } else if (!slowMotionEnabled && window.__turboState?.active) {
                fightParts.push(t('mods.betterAnalytics.statusTurbo'));
            }
            statusParts.push(fightParts.join(' '));
        } else {
            const floor = resolveCurrentFloor();
            if (floor > 0) {
                statusParts.push(`${t('mods.betterAnalytics.statusFloor')} <b>${floor}</b> (${Math.round(resolveAscensionDisplayMult(floor) * 100)}%)`);
            }
        }

        status.innerHTML = `<span class="bs-status-line">` +
            statusParts
                .map((part, index) => (index === 0 ? part : `<span class="bs-status-sep">·</span>${part}`))
                .join('') +
        `</span>`;

        updateSpeedSliderUi();
    }

    function buildUnitsStructureKey(units) {
        return units.map((u) => [
            normalizeCollapseKey(getUnitCollapseKey(u)),
            isUnitCollapsed(u) ? 'c' : 'e'
        ].join(':')).sort().join('|');
    }

    function buildUnitsRenderKey(units) {
        const liveParts = units.map((u) => [
            normalizeCollapseKey(getUnitCollapseKey(u)),
            u.hp,
            u.hpMax,
            u.ap,
            u.ad,
            resolveUnitAttackDelayTicks(u),
            resolveUnitAttackDelayRemainingTicks(u),
            u.attackDelayReady,
            resolveUnitCooldownTicks(u),
            resolveUnitCooldownRemainingTicks(u),
            u.cooldownReady,
            u.isMeditating === true,
            u.alive,
            u.tileIndex,
            u.level,
            u.silenced,
            u.buffedCount,
            (u.statusEffects || []).map((e) => e.id).join('+')
        ].join(':')).sort();
        return buildUnitsStructureKey(units) + '|live:' + liveParts.join('|');
    }

    function renderUnits(force) {
        if (shouldThrottleUnitsRender(force)) {
            recordUnitsLag('renderUnits:throttled', 0);
            return;
        }
        return profileUnitsLag('renderUnits', () => {
        const body = document.getElementById(UNITS_BODY_ID);
        const panel = document.getElementById(PANEL_ID);
        if (!body || !panel || panel.style.display === 'none') return;
        if (!canRefreshUnitsDom(force)) return;

        snapshotOpenAbilityKeysFromDom(body);

        const fighting = isFightActive();
        const units = fighting ? (collectActorSnapshots() || []) : getRefreshedBoardPreviewUnits();

        if (fighting && !units.length && body.querySelector('.bs-card')) {
            return;
        }

        const structureKey = buildUnitsStructureKey(units);
        const renderKey = buildUnitsRenderKey(units);

        if (body.querySelector('.bs-units-columns')) {
            const prevStructure = body.dataset.unitsStructureKey || '';
            if (structureKey === prevStructure) {
                if (renderKey === lastUnitsRenderKey) {
                    patchOpenAbilityTooltips(body, units);
                    return;
                }
                patchUnitCardsLiveStats(body, units);
                patchOpenAbilityTooltips(body, units);
                lastUnitsRenderKey = renderKey;
                return;
            }
        }

        if (!force && renderKey === lastUnitsRenderKey) {
            patchOpenAbilityTooltips(body, units);
            return;
        }
        lastUnitsRenderKey = renderKey;
        body.dataset.unitsStructureKey = structureKey;

        teardownAllAbilityTooltipsInBody(body);

        const { allies, enemies } = splitByTeam(units);
        body.innerHTML =
            `<div class="bs-units-columns">` +
            renderSection(t('mods.betterAnalytics.sectionAllies'), 'ally', allies) +
            renderSection(t('mods.betterAnalytics.sectionEnemies'), 'enemy', enemies) +
            `</div>`;
        hydrateAllUnitPortraits(body, units);
        });
    }

    function renderLogName(name, villain) {
        const cls = teamClass(villain);
        return `<span class="bs-log-name ${cls}">${name}</span>`;
    }

    function renderHealLogSubject(entry) {
        if (isCrossUnitHealEntry(entry)) {
            return `${renderLogName(entry.from, entry.fromVillain)} → ${renderLogName(entry.to, entry.toVillain)}`;
        }
        return renderLogName(entry.to, entry.toVillain);
    }

    function renderActionSourceLabel(entry) {
        const src = entry.actionSource || 'unknown';
        if (!src || src === 'unknown') return '';
        return `<span class="bs-log-source">[${escapeHtml(src)}]</span> `;
    }

    function getVisibleBattleLogEntries() {
        const filterSig = getLogViewSignature();
        if (cachedVisibleBattleLogRevision === battleLogRevision
            && cachedVisibleBattleLogFilterSig === filterSig
            && cachedVisibleBattleLog) {
            return cachedVisibleBattleLog;
        }
        cachedVisibleBattleLog = battleLog.filter(isLogEntryVisible);
        cachedVisibleBattleLogRevision = battleLogRevision;
        cachedVisibleBattleLogFilterSig = filterSig;
        return cachedVisibleBattleLog;
    }

    function buildBattleLogEntryHtml(entry) {
        const tickLabel = `<span class="bs-log-tick">[tick ${entry.tick}]</span>`;
        const sourceLabel = renderActionSourceLabel(entry);
        const typeLabel = `<span class="bs-log-type">${escapeHtml(entry.damageType)}${entry.crit ? escapeHtml(t('mods.betterAnalytics.logCritSuffix')) : ''}</span>`;
        if (entry.kind === 'marker') {
            const markerText = getLogMarkerText(entry);
            return `<div class="bs-log-line bs-log-marker">${tickLabel} ${escapeHtml(markerText)}</div>`;
        }
        if (entry.kind === 'status') {
            const statusCls = `${entry.applied ? 'applied' : 'removed'} ${entry.effectType || 'debuff'}`;
            const sign = entry.applied ? '+' : '−';
            return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.to, entry.toVillain)}: ` +
                `<span class="bs-log-status ${statusCls}">${sign}${escapeHtml(entry.effectLabel)}</span></div>`;
        }
        if (entry.kind === 'pathing') {
            return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.unit, entry.unitVillain)}: ` +
                `<span class="bs-log-pathing">tile ${entry.fromTile} → tile ${entry.toTile}</span></div>`;
        }
        if (entry.kind === 'statChange') {
            const deltaCls = statChangeDeltaClass(entry.statKey, entry.delta);
            const from = escapeHtml(formatStatChangeValue(entry.statKey, entry.from));
            const to = escapeHtml(formatStatChangeValue(entry.statKey, entry.to));
            const delta = escapeHtml(formatStatChangeDelta(entry.statKey, entry.delta));
            return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.unit, entry.unitVillain)}: ` +
                `<span class="bs-log-stat">${escapeHtml(entry.statLabel)} ${from} → ${to} ` +
                `<span class="bs-log-stat-delta ${deltaCls}">(${delta})</span></span></div>`;
        }
        if (entry.kind === 'abilityCast') {
            return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.from, entry.fromVillain)}: ` +
                `<span class="bs-log-ability">${escapeHtml(t('mods.betterAnalytics.logCast'))} ${escapeHtml(entry.abilityName)}</span></div>`;
        }
        if (entry.kind === 'death') {
            const defeated = escapeHtml(t('mods.betterAnalytics.logDefeated'));
            if (entry.killedBy) {
                return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.killedBy, entry.killedByVillain)} → ` +
                    `${renderLogName(entry.unit, entry.unitVillain)}: ` +
                    `<span class="bs-log-death">${defeated}</span></div>`;
            }
            return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.unit, entry.unitVillain)}: ` +
                `<span class="bs-log-death">${defeated}</span></div>`;
        }
        if (entry.kind === 'heal') {
            return `<div class="bs-log-line">${tickLabel} ${renderHealLogSubject(entry)}: ` +
                `<span class="bs-log-heal">+${entry.amount}</span> ${sourceLabel}${typeLabel}</div>`;
        }
        return `<div class="bs-log-line">${tickLabel} ${renderLogName(entry.from, entry.fromVillain)} → ` +
            `${renderLogName(entry.to, entry.toVillain)}: ` +
            `${renderLogDamageAmount(entry)} ${sourceLabel}${typeLabel}</div>`;
    }

    function scheduleBattleLogRender() {
        if (activeTab === 'log') {
            if (battleLogRenderScheduled) return;
            battleLogRenderScheduled = true;
            requestAnimationFrame(() => {
                battleLogRenderScheduled = false;
                renderBattleLog();
            });
        } else if (activeTab === 'summary') {
            scheduleSummaryTabRender();
        }
    }

    function renderActiveTab(forceUnits, forceSummary) {
        if (activeTab === 'units') {
            renderUnits(forceUnits);
        } else if (activeTab === 'log') {
            renderBattleLog();
        } else if (forceSummary) {
            renderSummaryTab(true);
        } else {
            scheduleSummaryTabRender();
        }
    }

    function scrollBattleLogToEnd(body) {
        if (!body) return;
        body.scrollTop = body.scrollHeight;
        lastScrolledBattleLogRevision = battleLogRevision;
    }

    function renderBattleLog(force) {
        const list = document.getElementById(LOG_LIST_ID);
        const body = document.getElementById(LOG_BODY_ID);
        const panel = document.getElementById(PANEL_ID);
        if (!list || !body || !panel || panel.style.display === 'none') return;

        const filterSig = getLogViewSignature();
        const shouldScroll = battleLogRevision > lastScrolledBattleLogRevision;
        const visible = getVisibleBattleLogEntries();
        const signature = `${battleLogRevision}:${filterSig}:${battleLog.length}`;

        if (!force
            && filterSig === lastRenderedFilterSig
            && list.querySelector('.bs-log-line')
            && visible.length === lastRenderedVisibleCount) {
            if (shouldScroll) scrollBattleLogToEnd(body);
            return;
        }

        if (!force
            && filterSig === lastRenderedFilterSig
            && list.querySelector('.bs-log-line')
            && visible.length > lastRenderedVisibleCount) {
            const newHtml = visible.slice(lastRenderedVisibleCount).map(buildBattleLogEntryHtml).join('');
            list.insertAdjacentHTML('beforeend', newHtml);
            lastRenderedVisibleCount = visible.length;
            lastRenderedLogSignature = signature;
            lastRenderedBattleLogRevision = battleLogRevision;
            updateLogToolbarTitle();
            if (shouldScroll) scrollBattleLogToEnd(body);
            return;
        }

        updateLogFilterUi();

        if (!battleLog.length) {
            list.innerHTML = `<div class="bs-empty">${escapeHtml(t('mods.betterAnalytics.emptyNoBattleEvents'))}</div>`;
            lastRenderedVisibleCount = 0;
            lastRenderedFilterSig = filterSig;
            lastRenderedLogSignature = signature;
            lastRenderedBattleLogRevision = battleLogRevision;
            return;
        }

        if (!visible.length) {
            const emptyMsg = logSearchQuery
                ? tReplace('mods.betterAnalytics.emptyNoSearchMatch', { query: logSearchQuery })
                : t('mods.betterAnalytics.emptyNoFilterMatch');
            list.innerHTML = `<div class="bs-empty">${escapeHtml(emptyMsg)}</div>`;
            lastRenderedVisibleCount = 0;
            lastRenderedFilterSig = filterSig;
            lastRenderedLogSignature = signature;
            lastRenderedBattleLogRevision = battleLogRevision;
            return;
        }

        list.innerHTML = visible.map(buildBattleLogEntryHtml).join('');
        lastRenderedVisibleCount = visible.length;
        lastRenderedFilterSig = filterSig;
        lastRenderedLogSignature = signature;
        lastRenderedBattleLogRevision = battleLogRevision;
        if (shouldScroll) scrollBattleLogToEnd(body);
    }

    function switchTab(tab) {
        activeTab = normalizeActiveTab(tab);
        savePanelSettings({ activeTab });

        const summaryBody = document.getElementById(SUMMARY_BODY_ID);
        const unitsBody = document.getElementById(UNITS_BODY_ID);
        const logBody = document.getElementById(LOG_BODY_ID);
        const tabSummary = document.getElementById('mod-better-sandbox-tab-summary');
        const tabUnits = document.getElementById('mod-better-sandbox-tab-units');
        const tabLog = document.getElementById('mod-better-sandbox-tab-log');

        if (summaryBody) summaryBody.style.display = activeTab === 'summary' ? 'block' : 'none';
        if (unitsBody) unitsBody.style.display = activeTab === 'units' ? 'block' : 'none';
        if (logBody) logBody.style.display = activeTab === 'log' ? 'block' : 'none';
        if (tabSummary) tabSummary.classList.toggle('active', activeTab === 'summary');
        if (tabUnits) tabUnits.classList.toggle('active', activeTab === 'units');
        if (tabLog) tabLog.classList.toggle('active', activeTab === 'log');

        if (activeTab !== 'summary') clearSummaryUpdateTimer();
        if (activeTab === 'units') lastUnitsLiveUpdateMs = 0;
        renderActiveTab(false, true);
    }

    function renderLiveFight() {
        if (!shouldBetterAnalyticsRun()) return;
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none' || !isLiveFightTracking()) return;
        renderActiveTab();
    }

    function render() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.style.display === 'none') return;
        renderStatusBar();
        const forceUnits = pendingUnitsForceRefresh;
        pendingUnitsForceRefresh = false;
        const forceSummary = activeTab === 'summary' && panelFightTickFrozen != null;
        renderActiveTab(activeTab === 'units' ? forceUnits : false, forceSummary);
    }

    function syncPanelTickTracking() {
        const panel = document.getElementById(PANEL_ID);
        const panelOpen = panel && panel.style.display !== 'none';
        if (panelOpen && isLiveFightTracking()) {
            setupPanelGameTimerSub();
            startPanelTickPoll();
        } else {
            teardownPanelGameTimerSub();
            stopPanelTickPoll();
        }
    }

    function teardownBoardListeners() {
        unsubscribeAll(boardUnsubs);
        boardUnsubs = [];
    }

    function setupBoardListeners() {
        teardownBoardListeners();
        const board = globalThis.state?.board;
        if (!board || typeof board.on !== 'function') return;

        syncBoardTrackFromContext();

        const onNewGame = (event) => {
            snapshotOpenAbilityKeysFromDom(document.getElementById(UNITS_BODY_ID));
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
            lastUnitsRenderKey = '';
            render();
        };

        const onEnd = () => {
            if (!slowMotionEnabled) restoreTurboIfSuspended();
            const world = getActiveWorld() || getBoardContext()?.world;
            if (world?.tickEngine?.setTickInterval) {
                world.tickEngine.setTickInterval(getBaselineTickIntervalMs());
            }
            if (isBattleLogTracking() && panelFightTickFrozen == null) {
                freezePanelFightTickFromEngine(world);
            }
            teardownWorldSubscriptions();
            activeWorld = null;
            clearFightActorCollapseRegistry();
            boardTrack.gameStarted = false;
            invalidateActorSnapshotsCache();
            invalidateActorProbeCache();
            invalidateBoardPreviewCache();
            clearScalingRuntimeCaches();
            lastUnitsRenderKey = '';
            pendingUnitsForceRefresh = true;
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
                invalidateBoardPreviewCache();
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
                    const configSig = getBoardConfigSignature(getBoardContext()?.boardConfig);
                    if (configSig === boardTrack.configSig) return;
                    boardTrack.configSig = configSig;
                    invalidateBoardPreviewCache();
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
        titleEl.textContent = getModDisplayName();
        const headerActions = document.createElement('div');
        headerActions.className = 'bs-header-actions';

        const exportBtn = document.createElement('button');
        exportBtn.className = 'bs-icon-btn';
        exportBtn.textContent = '⤓';
        exportBtn.title = t('mods.betterAnalytics.exportTitle');
        exportBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadPanelExport();
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'bs-icon-btn';
        closeBtn.textContent = '×';
        closeBtn.title = t('mods.betterAnalytics.close');
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
        const slowMotionTitleWrap = document.createElement('div');
        slowMotionTitleWrap.className = 'bs-speed-toggle-text';
        const slowMotionLabel = document.createElement('span');
        slowMotionLabel.textContent = t('mods.betterAnalytics.slowMotion');
        const sandboxOnlyNote = document.createElement('span');
        sandboxOnlyNote.className = 'bs-speed-sandbox-only';
        sandboxOnlyNote.id = SPEED_SANDBOX_ONLY_ID;
        sandboxOnlyNote.textContent = t('mods.betterAnalytics.sandboxOnly');
        const speedValue = document.createElement('span');
        speedValue.id = SPEED_VALUE_ID;
        speedValue.className = 'bs-speed-value';
        slowMotionTitleWrap.appendChild(slowMotionLabel);
        slowMotionTitleWrap.appendChild(sandboxOnlyNote);
        slowMotionTitleWrap.appendChild(speedValue);
        const slowMotionSwitch = document.createElement('label');
        slowMotionSwitch.className = 'bs-switch';
        slowMotionSwitch.title = t('mods.betterAnalytics.slowMotionToggleTitle');
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
        slowMotionRow.appendChild(slowMotionTitleWrap);
        slowMotionRow.appendChild(slowMotionSwitch);

        const speedSliderWrap = document.createElement('div');
        speedSliderWrap.id = 'mod-better-sandbox-speed-slider-wrap';
        speedSliderWrap.className = 'bs-speed-slider-wrap';
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
        speedSliderWrap.appendChild(speedSlider);

        speedRow.appendChild(slowMotionRow);
        speedRow.appendChild(speedSliderWrap);

        const tabBar = document.createElement('div');
        tabBar.className = 'bs-tab-bar';

        const tabSummaryBtn = document.createElement('button');
        tabSummaryBtn.type = 'button';
        tabSummaryBtn.id = 'mod-better-sandbox-tab-summary';
        tabSummaryBtn.className = 'bs-tab-btn';
        tabSummaryBtn.textContent = t('mods.betterAnalytics.tabSummary');
        tabSummaryBtn.addEventListener('click', () => switchTab('summary'));

        const tabUnitsBtn = document.createElement('button');
        tabUnitsBtn.type = 'button';
        tabUnitsBtn.id = 'mod-better-sandbox-tab-units';
        tabUnitsBtn.className = 'bs-tab-btn';
        tabUnitsBtn.textContent = t('mods.betterAnalytics.tabUnits');
        tabUnitsBtn.addEventListener('click', () => switchTab('units'));

        const tabLogBtn = document.createElement('button');
        tabLogBtn.type = 'button';
        tabLogBtn.id = 'mod-better-sandbox-tab-log';
        tabLogBtn.className = 'bs-tab-btn';
        tabLogBtn.textContent = t('mods.betterAnalytics.tabBattleLog');
        tabLogBtn.addEventListener('click', () => switchTab('log'));

        tabBar.appendChild(tabUnitsBtn);
        tabBar.appendChild(tabLogBtn);
        tabBar.appendChild(tabSummaryBtn);

        const unitsBody = document.createElement('div');
        unitsBody.id = UNITS_BODY_ID;
        unitsBody.className = 'bs-body';

        const logBody = document.createElement('div');
        logBody.id = LOG_BODY_ID;
        logBody.className = 'bs-body';
        logBody.style.display = 'none';

        const summaryBody = document.createElement('div');
        summaryBody.id = SUMMARY_BODY_ID;
        summaryBody.className = 'bs-body';
        summaryBody.style.display = 'none';
        const summaryContent = document.createElement('div');
        summaryContent.id = SUMMARY_CONTENT_ID;
        summaryContent.className = 'bs-summary-content';
        summaryBody.appendChild(summaryContent);

        const logStickyHeader = document.createElement('div');
        logStickyHeader.className = 'bs-log-sticky-header';

        const logToolbar = document.createElement('div');
        logToolbar.className = 'bs-log-toolbar';
        const logToolbarText = document.createElement('div');
        logToolbarText.className = 'bs-log-toolbar-text';
        const logTitle = document.createElement('div');
        logTitle.className = 'bs-log-title';
        logTitle.textContent = t('mods.betterAnalytics.battleLogTitle');
        const logSubtitle = document.createElement('div');
        logSubtitle.id = LOG_SUBTITLE_ID;
        logSubtitle.className = 'bs-log-subtitle';
        logToolbarText.appendChild(logTitle);
        logToolbarText.appendChild(logSubtitle);
        logToolbar.appendChild(logToolbarText);
        const toolbarActions = document.createElement('div');
        toolbarActions.className = 'bs-log-toolbar-actions';
        const allFilterBtn = document.createElement('button');
        allFilterBtn.type = 'button';
        allFilterBtn.id = `mod-better-sandbox-log-filter-${LOG_FILTER_ALL_KEY}`;
        allFilterBtn.className = 'bs-log-filter filter-all filter-neutral';
        allFilterBtn.textContent = t('mods.betterAnalytics.allFilters');
        allFilterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleAllLogFilters();
        });
        toolbarActions.appendChild(allFilterBtn);
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'bs-log-clear';
        clearBtn.textContent = t('mods.betterAnalytics.clearLog');
        clearBtn.addEventListener('click', clearBattleLog);
        toolbarActions.appendChild(clearBtn);
        logToolbar.appendChild(toolbarActions);
        logStickyHeader.appendChild(logToolbar);

        const logFiltersWrap = document.createElement('div');
        logFiltersWrap.className = 'bs-log-filters';
        for (const group of LOG_FILTER_GROUPS) {
            const row = document.createElement('div');
            row.className = 'bs-log-filters-row';
            for (const key of group.keys) {
                const label = getLogFilterLabel(key);
                if (!label) continue;
                const filterBtn = document.createElement('button');
                filterBtn.type = 'button';
                filterBtn.id = `mod-better-sandbox-log-filter-${key}`;
                filterBtn.className = `bs-log-filter ${group.teamClass}`;
                filterBtn.textContent = label;
                filterBtn.title = label;
                filterBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleLogFilter(key);
                });
                row.appendChild(filterBtn);
            }
            logFiltersWrap.appendChild(row);
        }
        logStickyHeader.appendChild(logFiltersWrap);
        logStickyHeader.appendChild(createBattleLogSearchBar());
        logBody.appendChild(logStickyHeader);

        const logList = document.createElement('div');
        logList.id = LOG_LIST_ID;
        logBody.appendChild(logList);

        panel.appendChild(header);
        panel.appendChild(statusEl);
        panel.appendChild(speedRow);
        panel.appendChild(tabBar);
        panel.appendChild(unitsBody);
        panel.appendChild(logBody);
        panel.appendChild(summaryBody);

        gameSpeedPercent = normalizeSpeedPercent(s.gameSpeedPercent);
        slowMotionEnabled = s.slowMotionEnabled === true;
        syncTurboBlockFlag();
        if (slowMotionEnabled) suspendTurboForSlowMotion();
        updateSpeedSliderUi();
        activeTab = normalizeActiveTab(s.activeTab);
        switchTab(activeTab);

        header.addEventListener('mousedown', onPanelHeaderMouseDown);
        ensurePanelDragListeners(panel);

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
            ensureBattleLogSearchBar();
            ensurePanelTabs();
            ensureSpeedRowUi();
            updatePanelPosition();
            attachPanelViewportListener();
        }
        panel.style.display = 'flex';
        savePanelSettings({ isOpen: true });
        prefetchGameChunk661ForCdr();
        ensureUnitsBodyListener();
        updateSpeedSliderUi();
        activeTab = normalizeActiveTab(loadPanelSettings().activeTab);
        switchTab(activeTab);
        if (isFightActive()) {
            ensureFightTracking();
            if (!battleLogTracking && !battleLogSessionEnded) startBattleLogSession();
            resumeBattleLogActorPatches();
        }
        if (slowMotionEnabled && isSandboxMode() && isFightActive()) applyTickIntervalToCurrentGame();
        syncPanelFightTickFromSnapshot();
        syncPanelTickTracking();
        renderStatusBar(true);
        renderActiveTab(true, activeTab === 'summary');
    }

    function closePanel() {
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.style.display = 'none';
        savePanelSettings({ isOpen: false });
        pauseBattleLogActorPatches();
        teardownAllAbilityTooltipsInBody(document.getElementById(UNITS_BODY_ID));
        clearSummaryUpdateTimer();
        teardownPanelGameTimerSub();
        stopPanelTickPoll();
        teardownUnitsBodyListener();
        detachPanelViewportListener();
        panelDragState.reset();
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
                text: getModDisplayName(),
                tooltip: 'Better Analytics panel (units, battle log; speed in Sandbox)',
                primary: false,
                onClick: togglePanel
            });
        }
    }

    function cleanupSandboxPanel() {
        sandboxPanelInitToken++;
        if (typeof api !== 'undefined' && api?.ui?.removeButton) {
            api.ui.removeButton(BUTTON_ID);
        }
        teardownAllAbilityTooltipsInBody(document.getElementById(UNITS_BODY_ID));
        clearSummaryUpdateTimer();
        teardownPanelGameTimerSub();
        stopPanelTickPoll();
        resetPanelFightTickState();
        resetTickSpeedToDefault();
        teardownBoardListeners();
        teardownWorldSubscriptions();
        teardownPanelResizeListeners();
        teardownPanelDragListeners();
        teardownUnitsBodyListener();
        detachPanelViewportListener();
        activeWorld = null;
        resetBattleLogState();
        clearCollapsedOverrides();
        clearOpenAbilityOverrides();
        clearFightActorCollapseRegistry();
        invalidateBoardPreviewCache({ clearMechanicsLog: true });
        clearScalingRuntimeCaches();
        cachedSpawnTileKeyLookup = null;
        gameIdByNameCache = null;
        lastUnitsRenderKey = '';
        pendingUnitsForceRefresh = false;
        const panel = document.getElementById(PANEL_ID);
        if (panel) panel.remove();
        const style = document.getElementById(STYLE_ID);
        if (style) style.remove();
    }


    function initSandboxPanel() {
        if (!shouldBetterAnalyticsRun()) return;

        const initToken = ++sandboxPanelInitToken;
        const wait = () => {
            if (initToken !== sandboxPanelInitToken || !shouldBetterAnalyticsRun()) return;
            if (!globalThis.state?.board) {
                setTimeout(wait, 300);
                return;
            }
            if (initToken !== sandboxPanelInitToken) return;
            const saved = loadPanelSettings();
            gameSpeedPercent = normalizeSpeedPercent(saved.gameSpeedPercent);
            slowMotionEnabled = saved.slowMotionEnabled === true;
            syncTurboBlockFlag();
            if (slowMotionEnabled) suspendTurboForSlowMotion();
            loadCollapsedOverrides();
            loadLogFilters();
            setupBoardListeners();
            setupTickSpeedControl();
            prefetchGameChunk661ForCdr();
            createToolbarButton();
            if (saved.isOpen) openPanel();
            else updateSpeedSliderUi();
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
