// =======================
// 0. Version & Metadata
// =======================

(function() {
    if (window.__betterAnalyticsLoaded) return;
    window.__betterAnalyticsLoaded = true;

    // =======================
    // 1. Configuration & Constants
    // =======================
    const modName = "Better Analytics";
    const modDescription = "Adds damage per tick (DPT) tracking to the damage analyzer.";
    
    const BETTER_ANALYTICS_VERSION = "1.0.0";
    const ANALYZER_PANEL_SELECTOR = 'div[data-state="open"]';
    const DAMAGE_ENTRIES_SELECTOR = 'div[data-state="open"] ul li';
    const DAMAGE_VALUE_SELECTOR = 'span.font-outlined-fill';
    
    const TICK_TO_SECONDS_RATIO = 1 / 16;
    const TICKS_PER_SECOND = 16;
    
    const TIMING = {
        AUTO_OPEN_DELAY: 100,
        TRACKING_DELAY: 100,
        RESTORE_DELAY: 100,
        FINAL_UPDATE_DELAY: 100,
        IMMEDIATE_CHECK_DELAY: 25,
        RETRY_DELAY: 100,
        DPS_UPDATE_INTERVAL: 1000,
        TAB_SWITCH_DELAY: 25
    };
    
    // =======================
    // 2. Logging & Debugging
    // =======================
    
    const logger = {
        error: (functionName, message, error = null) => {
            if (error) {
                console.error(`[${modName}][ERROR][${functionName}] ${message}`, error);
            } else {
                console.error(`[${modName}][ERROR][${functionName}] ${message}`);
            }
        },
        warn: (functionName, message, error = null) => {
            if (error) {
                console.warn(`[${modName}][WARN][${functionName}] ${message}`, error);
            } else {
                console.warn(`[${modName}][WARN][${functionName}] ${message}`);
            }
        },
        info: (functionName, message) => {
            if (window.__betterAnalyticsDebug) {
                console.info(`[${modName}][INFO][${functionName}] ${message}`);
            }
        },
        debug: (functionName, message) => {
            if (window.__betterAnalyticsDebug) {
                console.log(`[${modName}][DEBUG][${functionName}] ${message}`);
            }
        }
    };
    
    // =======================
    // 3. Global Variables
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
    
    // =======================
    // 4. Core Functions
    // =======================
    
    function initializeBetterAnalytics() {
        logger.info('initializeBetterAnalytics', 'Initializing Better Analytics mod...');
        
        const checkGameState = () => {
            if (globalThis.state && globalThis.state.board && globalThis.state.gameTimer) {
                logger.info('initializeBetterAnalytics', 'Game state available, setting up monitoring...');
                
                setupBoardStateMonitoring();
                setupServerResultsMonitoring();
                setupAnalyzerObserver();
                setupAutoOpenImpactAnalyzer();
                
                logger.info('initializeBetterAnalytics', 'Better Analytics mod initialized successfully');
            } else {
                logger.debug('initializeBetterAnalytics', 'Game state not yet available, retrying...');
                setTimeout(checkGameState, TIMING.RETRY_DELAY);
            }
        };
        
        checkGameState();
    }
    
    function setupServerResultsMonitoring() {
        logger.info('setupServerResultsMonitoring', 'Setting up server results monitoring...');
        
        if (serverResultsSubscription) {
            logger.debug('setupServerResultsMonitoring', 'Unsubscribing from existing server results');
            serverResultsSubscription.unsubscribe();
        }
        
        serverResultsSubscription = globalThis.state.board.subscribe((state) => {
            const { serverResults, mode } = state.context;
            currentGameMode = mode;
            
            if (serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                const gameTicks = serverResults.rewardScreen.gameTicks;
                
                logger.info('setupServerResultsMonitoring', `Server results received: gameTicks=${gameTicks}, mode=${mode}`);
                
                if (isTracking) {
                    logger.info('setupServerResultsMonitoring', 'Game completed, updating final DPS with server ticks');
                    updateFinalDPSWithGameTicks(gameTicks);
                }
            }
        });
        
        logger.info('setupServerResultsMonitoring', 'Server results monitoring set up successfully');
    }
    
    function updateFinalDPSWithGameTicks(gameTicks) {
        logger.info('updateFinalDPSWithGameTicks', `Updating final DPS with game ticks: ${gameTicks}`);
        
        logger.info('updateFinalDPSWithGameTicks', 'Forcing fresh damage update with delay to get latest values');
        
        setTimeout(() => {
            updateDamageData();
            
            const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
            if (!analyzerPanel) {
                logger.warn('updateFinalDPSWithGameTicks', 'No analyzer panel found for final DPS update');
                return;
            }
            
            const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
            
            damageValueElements.forEach((damageValueElement, index) => {
                const damageText = damageValueElement.textContent.trim();
                const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
                
                const portraitContainer = damageValueElement.closest('.container-slot');
                if (portraitContainer) {
                    return;
                }
                
                const parentContainer = damageValueElement.closest('li');
                const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
                const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
                
                const finalDPS = calculateDPS(creatureId, damageValue, gameTicks);
                
                let dpsDisplay = damageValueElement.parentNode.querySelector('.better-analytics-dps');
                
                if (!dpsDisplay) {
                    dpsDisplay = createDPSDisplayElement();
                    damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
                }
                
                dpsDisplay.textContent = `(${finalDPS}/s)`;
                logger.debug('updateFinalDPSWithGameTicks', `Final DPS for ${creatureId}: ${finalDPS}/s (game ticks: ${gameTicks}, damage: ${damageValue})`);
            });
            
            const dpsDisplays = document.querySelectorAll('.better-analytics-dps');
            dpsDisplays.forEach(display => {
                display.style.opacity = '0.7';
                display.style.fontStyle = 'italic';
                display.removeAttribute('title');
            });
            
            logger.info('updateFinalDPSWithGameTicks', 'Final DPS calculation completed with latest damage values');
        }, TIMING.FINAL_UPDATE_DELAY);
    }
    
    function getCurrentGameTicks() {
        try {
            const boardState = globalThis.state.board.getSnapshot();
            const { serverResults } = boardState.context;
            
            if (serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                const serverGameTicks = serverResults.rewardScreen.gameTicks;
                logger.debug('getCurrentGameTicks', `Using server game ticks: ${serverGameTicks}`);
                return serverGameTicks;
            }
            
            if (gameStartTick !== null && gameStartTick !== undefined) {
                const timerSnapshot = globalThis.state.gameTimer.getSnapshot();
                const currentTick = timerSnapshot.context.currentTick;
                const localGameTicks = currentTick - gameStartTick;
                
                if (localGameTicks > 0) {
                    logger.debug('getCurrentGameTicks', `Using local game ticks: ${localGameTicks} (currentTick: ${currentTick}, gameStartTick: ${gameStartTick})`);
                    return localGameTicks;
                }
            }
            
            logger.debug('getCurrentGameTicks', 'No valid game ticks available');
            return null;
        } catch (error) {
            logger.error('getCurrentGameTicks', 'Error getting current game ticks', error);
            return null;
        }
    }
    

    
    function setupBoardStateMonitoring() {
        logger.info('setupBoardStateMonitoring', 'Setting up board state monitoring...');
        
        if (boardSubscription) {
            logger.debug('setupBoardStateMonitoring', 'Unsubscribing from existing board state');
            boardSubscription.unsubscribe();
        }
        
        boardSubscription = globalThis.state.board.subscribe((state) => {
            const context = state.context;
            currentGameMode = context.mode;
            logger.debug('setupBoardStateMonitoring', `Board state changed: gameStarted=${context.gameStarted}, isTracking=${isTracking}, mode=${context.mode}`);
            
            if (context.gameStarted && !isTracking) {
                logger.info('setupBoardStateMonitoring', `Game started in ${context.mode} mode, resetting tracking session`);
                resetTrackingSession();
            }
            
            if (!context.gameStarted && isTracking) {
                logger.info('setupBoardStateMonitoring', `Game ended in ${context.mode} mode, stopping tracking`);
                stopDamageTracking();
            }
        });
        
        gameTimerSubscription = globalThis.state.gameTimer.subscribe((timerState) => {
            const { state: gameState, currentTick } = timerState.context;
            logger.debug('setupBoardStateMonitoring', `Game timer state changed: ${gameState}, currentTick: ${currentTick}, isTracking: ${isTracking}`);
            
            if ((gameState === 'victory' || gameState === 'defeat') && isTracking) {
                logger.info('setupBoardStateMonitoring', `Game ended with ${gameState} at tick ${currentTick}, stopping tracking`);
                stopDamageTracking();
            }
        });
        
        globalThis.state.board.on('newGame', (event) => {
            logger.info('setupBoardStateMonitoring', 'New game event detected, resetting tracking session');
            gameStartTick = 0;
            resetTrackingSession();
        });
        
        globalThis.state.board.on('emitNewGame', (event) => {
            logger.info('setupBoardStateMonitoring', 'New game emitted, resetting tracking session');
            gameStartTick = 0;
            resetTrackingSession();
        });
        
        globalThis.state.board.on('emitEndGame', (event) => {
            logger.info('setupBoardStateMonitoring', 'Game end event detected, stopping tracking');
            stopDamageTracking();
        });
        
        logger.info('setupBoardStateMonitoring', 'Board state monitoring set up successfully');
    }
    
    function resetTrackingSession() {
        logger.info('resetTrackingSession', 'Resetting tracking session for new game');
        
        damageTrackingData.clear();
        
        if (gameStartTick !== 0) {
            gameStartTick = 0;
        }
        
        logger.info('resetTrackingSession', `Tracking session reset successfully at tick ${gameStartTick}`);
    }
    
    function setupAnalyzerObserver() {
        logger.info('setupAnalyzerObserver', 'Setting up MutationObserver for analyzer detection...');
        
        if (analyzerObserver) {
            logger.debug('setupAnalyzerObserver', 'Disconnecting existing observer');
            analyzerObserver.disconnect();
        }
        
        analyzerObserver = new MutationObserver((mutations) => {
            const boardState = globalThis.state.board.getSnapshot();
            const isAutoplay = boardState.context.mode === 'autoplay';
            
            mutations.forEach((mutation, index) => {
                
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-state') {
                    const target = mutation.target;
                    const newState = target.getAttribute('data-state');
                    logger.debug(`setupAnalyzerObserver`, `Data-state attribute changed to: "${newState}" on:`, target);
                    
                    const hasAnalyzerStructure = target.querySelector && (
                        target.querySelector('button[aria-controls*="ally"]') && 
                        target.querySelector('button[aria-controls*="villain"]') &&
                        target.querySelector('img[alt="damage"]')
                    );
                    
                    if (newState === 'open' && hasAnalyzerStructure) {
                        logger.info('setupAnalyzerObserver', 'Impact analyzer panel opened, starting tracking');
                        startDamageTracking();
                    } else if (newState === 'closed' && hasAnalyzerStructure) {
                        logger.info('setupAnalyzerObserver', 'Impact analyzer panel closed, stopping tracking');
                        stopDamageTracking();
                    }
                } else if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node, nodeIndex) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && node.matches(ANALYZER_PANEL_SELECTOR)) {
                                const hasAnalyzerStructure = node.querySelector && (
                                    node.querySelector('button[aria-controls*="ally"]') && 
                                    node.querySelector('button[aria-controls*="villain"]') &&
                                    node.querySelector('img[alt="damage"]')
                                );
                                if (hasAnalyzerStructure) {
                                    logger.info('setupAnalyzerObserver', 'Impact analyzer panel detected in added node, starting tracking');
                                    startDamageTracking();
                                }
                            }
                            const analyzerPanel = node.querySelector && node.querySelector(ANALYZER_PANEL_SELECTOR);
                            if (analyzerPanel) {
                                const hasAnalyzerStructure = analyzerPanel.querySelector && (
                                    analyzerPanel.querySelector('button[aria-controls*="ally"]') && 
                                    analyzerPanel.querySelector('button[aria-controls*="villain"]') &&
                                    analyzerPanel.querySelector('img[alt="damage"]')
                                );
                                if (hasAnalyzerStructure) {
                                    logger.info('setupAnalyzerObserver', 'Impact analyzer panel detected in child of added node, starting tracking');
                                    startDamageTracking();
                                }
                            }
                        }
                    });
                    
                    mutation.removedNodes.forEach((node, nodeIndex) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && node.matches(ANALYZER_PANEL_SELECTOR)) {
                                const hasAnalyzerStructure = node.querySelector && (
                                    node.querySelector('button[aria-controls*="ally"]') && 
                                    node.querySelector('button[aria-controls*="villain"]') &&
                                    node.querySelector('img[alt="damage"]')
                                );
                                if (hasAnalyzerStructure) {
                                    logger.info('setupAnalyzerObserver', 'Impact analyzer panel removed, stopping tracking');
                                    stopDamageTracking();
                                }
                            }
                            const analyzerPanel = node.querySelector && node.querySelector(ANALYZER_PANEL_SELECTOR);
                            if (analyzerPanel) {
                                const hasAnalyzerStructure = analyzerPanel.querySelector && (
                                    analyzerPanel.querySelector('button[aria-controls*="ally"]') && 
                                    analyzerPanel.querySelector('button[aria-controls*="villain"]') &&
                                    analyzerPanel.querySelector('img[alt="damage"]')
                                );
                                if (hasAnalyzerStructure) {
                                    logger.info('setupAnalyzerObserver', 'Impact analyzer panel removed from child, stopping tracking');
                                    stopDamageTracking();
                                }
                            }
                        }
                    });
                }
            });
        });
        
        logger.info('setupAnalyzerObserver', 'Starting to observe document.body for changes');
        analyzerObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-state']
        });
        
        const existingAnalyzer = document.querySelector(ANALYZER_PANEL_SELECTOR);
        if (existingAnalyzer) {
            const hasAnalyzerStructure = existingAnalyzer.querySelector && (
                existingAnalyzer.querySelector('button[aria-controls*="ally"]') && 
                existingAnalyzer.querySelector('button[aria-controls*="villain"]') &&
                existingAnalyzer.querySelector('img[alt="damage"]')
            );
            if (hasAnalyzerStructure) {
                logger.info('setupAnalyzerObserver', 'Impact analyzer panel already open, starting tracking');
                startDamageTracking();
            }
        }
    }
    
    function setupAutoOpenImpactAnalyzer() {
        logger.info('setupAutoOpenImpactAnalyzer', 'Setting up auto-open functionality for impact analyzer...');
        
        if (autoOpenObserver) {
            logger.debug('setupAutoOpenImpactAnalyzer', 'Disconnecting existing auto-open observer');
            autoOpenObserver.disconnect();
        }
        
        autoOpenObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const impactAnalyzerButton = node.querySelector && node.querySelector('button img[alt="impact analyser"]');
                            if (impactAnalyzerButton) {
                                logger.info('setupAutoOpenImpactAnalyzer', 'Impact analyzer button found, setting up auto-open...');
                                
                                const button = impactAnalyzerButton.closest('button');
                                if (button) {
                                    const boardState = globalThis.state.board.getSnapshot();
                                    if (boardState.context.gameStarted) {
                                        logger.info('setupAutoOpenImpactAnalyzer', `Game started in ${boardState.context.mode} mode, auto-opening impact analyzer in 100ms...`);
                                        
                                        const delay = TIMING.AUTO_OPEN_DELAY;
                                        logger.debug('setupAutoOpenImpactAnalyzer', `Using delay of ${delay}ms`);
                                        
                                        setTimeout(() => {
                                            if (button && !button.disabled) {
                                                logger.info('setupAutoOpenImpactAnalyzer', 'Clicking impact analyzer button...');
                                                button.click();
                                                
                                                if (boardState.context.mode === 'autoplay') {
                                                    logger.info('setupAutoOpenImpactAnalyzer', 'Autoplay mode detected, immediately checking for analyzer panel...');
                                                    setTimeout(() => {
                                                        const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
                                                        if (analyzerPanel) {
                                                            logger.info('setupAutoOpenImpactAnalyzer', 'Analyzer panel found immediately, starting tracking...');
                                                            startDamageTracking();
                                                        } else {
                                                            logger.info('setupAutoOpenImpactAnalyzer', 'Analyzer panel not found immediately, using fallback...');
                                                            waitForAnalyzerPanelAndStartTracking();
                                                        }
                                                    }, TIMING.IMMEDIATE_CHECK_DELAY);
                                                } else {
                                                    const trackingDelay = TIMING.TRACKING_DELAY;
                                                    setTimeout(() => {
                                                        logger.info('setupAutoOpenImpactAnalyzer', 'Auto-triggering DPS tracking after auto-open...');
                                                        waitForAnalyzerPanelAndStartTracking();
                                                    }, trackingDelay);
                                                }
                                            }
                                        }, delay);
                                    }
                                }
                            }
                        }
                    });
                }
            });
        });
        
        logger.info('setupAutoOpenImpactAnalyzer', 'Starting to observe document.body for impact analyzer button');
        autoOpenObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        const existingButton = document.querySelector('button img[alt="impact analyser"]');
        if (existingButton) {
            logger.debug('setupAutoOpenImpactAnalyzer', 'Impact analyzer button already exists');
            const button = existingButton.closest('button');
            if (button) {
                const boardState = globalThis.state.board.getSnapshot();
                if (boardState.context.gameStarted) {
                    logger.info('setupAutoOpenImpactAnalyzer', `Game already started in ${boardState.context.mode} mode, auto-opening impact analyzer in 100ms...`);
                    const delay = TIMING.AUTO_OPEN_DELAY;
                    logger.debug('setupAutoOpenImpactAnalyzer', `Using delay of ${delay}ms for existing button in ${boardState.context.mode} mode`);
                    
                    setTimeout(() => {
                        if (button && !button.disabled) {
                            logger.info('setupAutoOpenImpactAnalyzer', 'Clicking existing impact analyzer button...');
                            button.click();
                            
                            if (boardState.context.mode === 'autoplay') {
                                logger.info('setupAutoOpenImpactAnalyzer', 'Autoplay mode detected (existing button), immediately checking for analyzer panel...');
                                setTimeout(() => {
                                    const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
                                    if (analyzerPanel) {
                                        logger.info('setupAutoOpenImpactAnalyzer', 'Analyzer panel found immediately (existing button), starting tracking...');
                                        startDamageTracking();
                                    } else {
                                        logger.info('setupAutoOpenImpactAnalyzer', 'Analyzer panel not found immediately (existing button), using fallback...');
                                        waitForAnalyzerPanelAndStartTracking();
                                    }
                                }, TIMING.IMMEDIATE_CHECK_DELAY);
                            } else {
                                const trackingDelay = TIMING.TRACKING_DELAY;
                                setTimeout(() => {
                                    logger.info('setupAutoOpenImpactAnalyzer', 'Auto-triggering DPS tracking after auto-open (existing button)...');
                                    waitForAnalyzerPanelAndStartTracking();
                                }, trackingDelay);
                            }
                        }
                    }, delay);
                }
            }
        }
        
        logger.info('setupAutoOpenImpactAnalyzer', 'Auto-open functionality set up successfully');
    }
    
    function waitForAnalyzerPanelAndStartTracking() {
        logger.info('waitForAnalyzerPanelAndStartTracking', 'Waiting for analyzer panel to be fully loaded...');
        
        const boardState = globalThis.state.board.getSnapshot();
        const isAutoplay = boardState.context.mode === 'autoplay';
        const isManual = boardState.context.mode === 'manual';
        
        let attempts = 0;
        const maxAttempts = isAutoplay || isManual ? 20 : 50;
        const checkInterval = isAutoplay || isManual ? 50 : 100;
        
        logger.debug('waitForAnalyzerPanelAndStartTracking', `Using ${maxAttempts} attempts with ${checkInterval}ms intervals for ${boardState.context.mode} mode`);
        
        const checkAndStart = () => {
            attempts++;
            
            const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
            if (analyzerPanel) {
                const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
                logger.debug('waitForAnalyzerPanelAndStartTracking', `Attempt ${attempts}: Found ${damageValueElements.length} damage value elements`);
                
                if (damageValueElements.length > 0 || attempts >= maxAttempts) {
                    logger.info('waitForAnalyzerPanelAndStartTracking', `Starting damage tracking after ${attempts} attempts`);
                    
                    const boardState = globalThis.state.board.getSnapshot();
                    const timerState = globalThis.state.gameTimer.getSnapshot();
                    
                    if (boardState.context.gameStarted && timerState.context.state !== 'victory' && timerState.context.state !== 'defeat') {
                        startDamageTracking();
                    } else {
                        logger.warn('waitForAnalyzerPanelAndStartTracking', 'Game ended while waiting for panel, not starting tracking');
                        
                        if (boardState.context.mode === 'manual' && damageValueElements.length > 0) {
                            logger.info('waitForAnalyzerPanelAndStartTracking', 'Manual mode game ended, checking for server results to show final DPS');
                            
                            const { serverResults } = boardState.context;
                            if (serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                                const gameTicks = serverResults.rewardScreen.gameTicks;
                                logger.info('waitForAnalyzerPanelAndStartTracking', `Manual mode: Server results available with ${gameTicks} ticks, calculating final DPS`);
                                updateFinalDPSWithGameTicks(gameTicks);
                            } else {
                                logger.warn('waitForAnalyzerPanelAndStartTracking', 'Manual mode: No server results available for final DPS calculation');
                            }
                        } else if (boardState.context.mode === 'sandbox' && damageValueElements.length > 0) {
                            logger.info('waitForAnalyzerPanelAndStartTracking', 'Sandbox mode game ended, restoring frozen DPS displays');
                            setTimeout(() => {
                                restoreFrozenDPSDisplays();
                                setupTabButtonListeners();
                            }, 100);
                        } else if (boardState.context.mode === 'autoplay' && damageValueElements.length > 0) {
                            logger.info('waitForAnalyzerPanelAndStartTracking', 'Autoplay mode game ended, restoring frozen DPS displays');
                            setTimeout(() => {
                                restoreFrozenDPSDisplays();
                                setupTabButtonListeners();
                            }, 200);
                        }
                    }
                    return;
                }
            }
            
            if (attempts < maxAttempts) {
                setTimeout(checkAndStart, checkInterval);
            } else {
                logger.warn('waitForAnalyzerPanelAndStartTracking', 'Max attempts reached, checking game state before starting tracking');
                
                const boardState = globalThis.state.board.getSnapshot();
                const timerState = globalThis.state.gameTimer.getSnapshot();
                
                if (boardState.context.gameStarted && timerState.context.state !== 'victory' && timerState.context.state !== 'defeat') {
                    startDamageTracking();
                } else {
                    logger.warn('waitForAnalyzerPanelAndStartTracking', 'Game ended, not starting tracking');
                    
                    if (boardState.context.mode === 'manual') {
                        logger.info('waitForAnalyzerPanelAndStartTracking', 'Manual mode game ended (fallback), checking for server results to show final DPS');
                        
                        const { serverResults } = boardState.context;
                        if (serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
                            const gameTicks = serverResults.rewardScreen.gameTicks;
                            logger.info('waitForAnalyzerPanelAndStartTracking', `Manual mode fallback: Server results available with ${gameTicks} ticks, calculating final DPS`);
                            updateFinalDPSWithGameTicks(gameTicks);
                        } else {
                            logger.warn('waitForAnalyzerPanelAndStartTracking', 'Manual mode fallback: No server results available for final DPS calculation');
                        }
                    } else if (boardState.context.mode === 'sandbox') {
                        logger.info('waitForAnalyzerPanelAndStartTracking', 'Sandbox mode game ended (fallback), restoring frozen DPS displays');
                        setTimeout(() => {
                            restoreFrozenDPSDisplays();
                            setupTabButtonListeners();
                        }, 100);
                    } else if (boardState.context.mode === 'autoplay') {
                        logger.info('waitForAnalyzerPanelAndStartTracking', 'Autoplay mode game ended (fallback), restoring frozen DPS displays');
                        setTimeout(() => {
                            restoreFrozenDPSDisplays();
                            setupTabButtonListeners();
                        }, 200);
                    }
                }
            }
        };
        
        checkAndStart();
    }
    
    function handleTabSwitch() {
        if (!window.__updatingDPS) {
            const gameEnded = !isTracking;
            
            if (isTracking) {
                window.__updatingDPS = true;
                createPlaceholderDPSDisplays();
                setTimeout(() => {
                    updateDamageData();
                    updateDPSDisplay();
                    window.__updatingDPS = false;
                }, TIMING.TAB_SWITCH_DELAY);
            } else if (gameEnded) {
                window.__updatingDPS = true;
                setTimeout(() => {
                    restoreFrozenDPSDisplays();
                    window.__updatingDPS = false;
                }, TIMING.TAB_SWITCH_DELAY);
            }
        }
    }
    
    function setupTabButtonListeners() {
        const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
        if (analyzerPanel) {
            const allyButton = analyzerPanel.querySelector('button[aria-controls*="ally"]');
            const villainButton = analyzerPanel.querySelector('button[aria-controls*="villain"]');
            
            if (allyButton && !allyButton.hasAttribute('data-dps-listener')) {
                allyButton.setAttribute('data-dps-listener', 'true');
                allyButton.addEventListener('click', handleTabSwitch);
            }
            
            if (villainButton && !villainButton.hasAttribute('data-dps-listener')) {
                villainButton.setAttribute('data-dps-listener', 'true');
                villainButton.addEventListener('click', handleTabSwitch);
            }
        }
    }
    
    function restoreFrozenDPSDisplays() {
        const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
        if (!analyzerPanel) {
            return;
        }
        
        const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
        
        const boardState = globalThis.state.board.getSnapshot();
        const isAutoplay = boardState.context.mode === 'autoplay';
        const { serverResults } = boardState.context;
        
        let gameTicks = null;
        if (isAutoplay && serverResults && serverResults.rewardScreen && typeof serverResults.rewardScreen.gameTicks === 'number') {
            gameTicks = serverResults.rewardScreen.gameTicks;
            logger.debug('restoreFrozenDPSDisplays', `Autoplay mode: Using server game ticks: ${gameTicks}`);
        }
        
        damageValueElements.forEach((damageValueElement, index) => {
            const damageText = damageValueElement.textContent.trim();
            const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
            
            const portraitContainer = damageValueElement.closest('.container-slot');
            if (portraitContainer) {
                return;
            }
            
            const parentContainer = damageValueElement.closest('li');
            const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
            const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
            
            let finalDPS;
            if (isAutoplay && gameTicks !== null) {
                finalDPS = calculateDPS(creatureId, damageValue, gameTicks);
            } else {
                finalDPS = calculateDPS(creatureId, damageValue);
            }
            
            let dpsDisplay = damageValueElement.parentNode.querySelector('.better-analytics-dps');
            
            if (!dpsDisplay) {
                dpsDisplay = createDPSDisplayElement();
                damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
            }
            
            dpsDisplay.textContent = `(${finalDPS}/s)`;
            
            dpsDisplay.style.opacity = '0.7';
            dpsDisplay.style.fontStyle = 'italic';
            dpsDisplay.removeAttribute('title');
        });
        
        if (isAutoplay && gameTicks === null) {
            logger.debug('restoreFrozenDPSDisplays', 'Autoplay mode: Server results not available immediately, retrying in 100ms...');
            setTimeout(() => {
                const retryBoardState = globalThis.state.board.getSnapshot();
                const retryServerResults = retryBoardState.context.serverResults;
                if (retryServerResults && retryServerResults.rewardScreen && typeof retryServerResults.rewardScreen.gameTicks === 'number') {
                    const retryGameTicks = retryServerResults.rewardScreen.gameTicks;
                    logger.debug('restoreFrozenDPSDisplays', `Autoplay mode: Retry successful, using server game ticks: ${retryGameTicks}`);
                    
                    damageValueElements.forEach((damageValueElement, index) => {
                        const damageText = damageValueElement.textContent.trim();
                        const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
                        
                        const portraitContainer = damageValueElement.closest('.container-slot');
                        if (portraitContainer) {
                            return;
                        }
                        
                        const parentContainer = damageValueElement.closest('li');
                        const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
                        const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
                        
                        const finalDPS = calculateDPS(creatureId, damageValue, retryGameTicks);
                        
                        const dpsDisplay = damageValueElement.parentNode.querySelector('.better-analytics-dps');
                        if (dpsDisplay) {
                            dpsDisplay.textContent = `(${finalDPS}/s)`;
                        }
                    });
                } else {
                    logger.warn('restoreFrozenDPSDisplays', 'Autoplay mode: Server results still not available after retry');
                }
            }, 100);
        }
    }
    
    function startDamageTracking() {
        logger.debug('startDamageTracking', `Function called - isTracking: ${isTracking}`);
        
        if (isTracking) {
            logger.debug('startDamageTracking', 'Already tracking, returning early');
            return;
        }
        
        const boardState = globalThis.state.board.getSnapshot();
        const timerState = globalThis.state.gameTimer.getSnapshot();
        
        logger.debug('startDamageTracking', `Validating game state: mode=${boardState.context.mode}, gameStarted=${boardState.context.gameStarted}, timerState=${timerState.context.state}`);
        
        if (!boardState.context.gameStarted) {
            logger.warn('startDamageTracking', 'Game not started yet, skipping tracking');
            return;
        }
        
        if (timerState.context.state === 'victory' || timerState.context.state === 'defeat') {
            logger.info('startDamageTracking', 'Game already ended, restoring frozen DPS displays');
            
            const delay = TIMING.RESTORE_DELAY;
            logger.debug('startDamageTracking', `Using delay of ${delay}ms`);
            
            setTimeout(() => {
                restoreFrozenDPSDisplays();
                setupTabButtonListeners();
            }, delay);
            return;
        }
        
        if (gameStartTick === null || gameStartTick === undefined) {
            logger.warn('startDamageTracking', 'Game start tick not set, this should not happen');
            return;
        }
        
        logger.debug('startDamageTracking', 'Setting isTracking to true');
        isTracking = true;
        
        const dpsDisplays = document.querySelectorAll('.better-analytics-dps');
        dpsDisplays.forEach(display => display.remove());
        
        logger.debug('startDamageTracking', 'About to set up periodic updates');
        
        dpsUpdateInterval = setInterval(() => {
            logger.debug('startDamageTracking', 'Interval triggered - calling updateDPSDisplay');
            updateDPSDisplay();
        }, TIMING.DPS_UPDATE_INTERVAL);
        logger.debug('startDamageTracking', 'DPS update interval set up');
        
        logger.debug('startDamageTracking', `Interval ID: ${dpsUpdateInterval}`);
        
        logger.debug('startDamageTracking', 'Triggering immediate DPS update');
        setTimeout(() => {
            logger.debug('startDamageTracking', 'Immediate DPS update timeout triggered');
            updateDPSDisplay();
        }, 100);
        
        createPlaceholderDPSDisplays();
        
        setupTabButtonListeners();
        
        logger.info('startDamageTracking', 'Damage tracking started');
    }
    
    function stopDamageTracking() {
        logger.debug('stopDamageTracking', `Called - isTracking: ${isTracking}`);
        
        if (!isTracking) return;
        
        logger.debug('stopDamageTracking', 'Stopping damage tracking...');
        isTracking = false;
        
        if (dpsUpdateInterval) {
            logger.debug('stopDamageTracking', `Clearing interval ID: ${dpsUpdateInterval}`);
            clearInterval(dpsUpdateInterval);
            dpsUpdateInterval = null;
        }
        
        logger.info('stopDamageTracking', 'Executing final damage data update before stopping');
        updateDamageData();
        
        if (currentGameMode === 'sandbox') {
            logger.info('stopDamageTracking', 'Sandbox mode detected, calculating final DPS with local timer');
            
            const timerSnapshot = globalThis.state.gameTimer.getSnapshot();
            const finalTick = timerSnapshot.context.currentTick;
            const localGameTicks = finalTick - gameStartTick;
            
            logger.info('stopDamageTracking', `Sandbox final calculation - finalTick: ${finalTick}, gameStartTick: ${gameStartTick}, localGameTicks: ${localGameTicks}`);
            
            if (localGameTicks > 0) {
                updateFinalDPSWithGameTicks(localGameTicks);
            } else {
                logger.warn('stopDamageTracking', 'Invalid local game ticks for sandbox mode');
            }
        } else {
            logger.info('stopDamageTracking', `Game mode is ${currentGameMode}, waiting for server results for accurate DPS calculation`);
        }
    }
    
    function updateDamageData() {
        try {
            const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
            if (!analyzerPanel) {
                return;
            }
            
            let damageEntries = analyzerPanel.querySelectorAll('li');
            
            if (damageEntries.length === 0) {
                const alternativeSelectors = [
                    'ul.frame-2 li',
                    'ul[class*="frame-2"] li',
                    'ul li',
                    'button'
                ];
                
                for (const selector of alternativeSelectors) {
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
                
                if (damageValue === 0) {
                    return;
                }
                
                const portraitImg = entry.querySelector('img[alt="creature"]');
                const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
                
                if (!damageTrackingData.has(creatureId)) {
                    damageTrackingData.set(creatureId, {
                        totalDamage: 0,
                        damageHistory: [],
                        firstSeen: currentTick,
                        lastUpdate: currentTick
                    });
                }
                
                const creatureData = damageTrackingData.get(creatureId);
                
                if (damageValue !== creatureData.totalDamage) {
                    const damageDiff = damageValue - creatureData.totalDamage;
                    
                    if (damageDiff > 0) {
                        creatureData.damageHistory.push({
                            damage: damageDiff,
                            tick: currentTick,
                            timestamp: Date.now()
                        });
                    }
                    
                    creatureData.totalDamage = damageValue;
                    creatureData.lastUpdate = currentTick;
                } else {
                    creatureData.totalDamage = damageValue;
                }
            });
        } catch (error) {
            logger.error('updateDamageData', 'Error updating damage data', error);
        }
    }
    
    function calculateDPS(creatureId, currentDamage, gameTicks = null) {
        if (!currentDamage || currentDamage === 0) {
            logger.debug('calculateDPS', `No damage for ${creatureId}, returning 0`);
            return 0;
        }
        
        const ticks = gameTicks !== null ? gameTicks : getCurrentGameTicks();
        
        if (ticks === null || ticks <= 0) {
            logger.debug('calculateDPS', `No valid game ticks available for ${creatureId}, returning 0`);
            return 0;
        }
        
        logger.debug('calculateDPS', `${creatureId}: damage=${currentDamage}, gameTicks=${ticks}, mode=${currentGameMode}`);
        
        const dpt = currentDamage / ticks;
        const dps = dpt * TICKS_PER_SECOND;
        
        const result = Math.round(dps * 100) / 100;
        logger.debug('calculateDPS', `${creatureId}: DPT=${dpt}, DPS=${result}`);
        
        return result;
    }
    
    function calculateRecentDPS(creatureId) {
        const creatureData = damageTrackingData.get(creatureId);
        if (!creatureData) return 0;
        
        const currentTick = globalThis.state.gameTimer.getSnapshot().context.currentTick;
        const recentTicks = TICKS_PER_SECOND;
        const recentTicksAgo = currentTick - recentTicks;
        
        const recentDamage = creatureData.damageHistory
            .filter(event => event.tick >= recentTicksAgo)
            .reduce((sum, event) => sum + event.damage, 0);
        
        const recentDPS = (recentDamage / recentTicks) * TICKS_PER_SECOND;
        
        return Math.round(recentDPS * 100) / 100;
    }
    
    function updateDPSDisplay() {
        try {
            if (!isTracking || window.__updatingDPS) {
                return;
            }
        
        updateDamageData();
        
        const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
        if (!analyzerPanel) {
            return;
        }
        
        const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
        
        damageValueElements.forEach((damageValueElement, index) => {
            const damageText = damageValueElement.textContent.trim();
            const damageValue = parseInt(damageText.replace(/[^\d]/g, '')) || 0;
            
            const portraitContainer = damageValueElement.closest('.container-slot');
            if (portraitContainer) {
                return;
            }
            
            const parentContainer = damageValueElement.closest('li');
            const portraitImg = parentContainer ? parentContainer.querySelector('img[alt="creature"]') : null;
            const creatureId = portraitImg ? portraitImg.src.split('/').pop().replace('.png', '') : `creature_${index}`;
            
            const totalDPS = calculateDPS(creatureId, damageValue);
            
            let dpsDisplay = damageValueElement.parentNode.querySelector('.better-analytics-dps');
            
            if (!dpsDisplay) {
                dpsDisplay = createDPSDisplayElement();
                damageValueElement.parentNode.insertBefore(dpsDisplay, damageValueElement.nextSibling);
            }
            
            dpsDisplay.textContent = `(${totalDPS}/s)`;
            
            dpsDisplay.style.opacity = '1';
            dpsDisplay.style.fontStyle = 'normal';
        });
        } catch (error) {
            logger.error('updateDPSDisplay', 'Error updating DPS display', error);
        }
    }
    
    function createDPSDisplayElement() {
        const dpsDisplay = document.createElement('span');
        dpsDisplay.className = 'better-analytics-dps';
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
        const analyzerPanel = document.querySelector(ANALYZER_PANEL_SELECTOR);
        if (!analyzerPanel) {
            return;
        }

        const damageValueElements = analyzerPanel.querySelectorAll('span.font-outlined-fill');
        damageValueElements.forEach((damageValueElement, index) => {
            const portraitContainer = damageValueElement.closest('.container-slot');
            if (portraitContainer) {
                return;
            }

            let dpsDisplay = damageValueElement.parentNode.querySelector('.better-analytics-dps');
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
    }
    
    // =======================
    // 5. Utility Functions
    // =======================
    
    function getDamageData() {
        return damageTrackingData;
    }
    
    function resetTracking() {
        damageTrackingData.clear();
        const currentTick = globalThis.state.gameTimer.getSnapshot().context.currentTick;
        gameStartTick = currentTick;
        logger.info('resetTracking', `Tracking data reset at tick ${gameStartTick}`);
    }
    
    function getSessionStats() {
        const currentTick = globalThis.state.gameTimer.getSnapshot().context.currentTick;
        const gameDurationTicks = gameStartTick ? (currentTick - gameStartTick) : 0;
        const gameDurationSeconds = gameDurationTicks * TICK_TO_SECONDS_RATIO;
        
        return {
            gameDuration: gameDurationSeconds,
            gameDurationTicks: gameDurationTicks,
            trackedCreatures: damageTrackingData.size,
            totalDamageEvents: Array.from(damageTrackingData.values())
                .reduce((sum, data) => sum + data.damageHistory.length, 0)
        };
    }
    
    function cleanup() {
        stopDamageTracking();
        
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
        
        damageTrackingData.clear();
        gameStartTick = null;
        isTracking = false;
        currentGameMode = null;
        
        logger.info('cleanup', 'Cleanup completed');
    }
    
    // =======================
    // 6. Initialization & Exports
    // =======================
    
    function initBetterAnalytics() {
        logger.info('initBetterAnalytics', 'Initializing Better Analytics mod...');
        initializeBetterAnalytics();
    }
    
    if (typeof window !== 'undefined' && window.registerMod) {
        window.registerMod({
            name: modName,
            description: modDescription,
            init: initBetterAnalytics
        });
    } else {
        initBetterAnalytics();
    }
    
    if (typeof exports !== 'undefined') {
        exports = {
            initialize: initializeBetterAnalytics,
            getDamageData: getDamageData,
            calculateDPS: calculateDPS,
            calculateRecentDPS: calculateRecentDPS,
            resetTracking: resetTracking,
            getSessionStats: getSessionStats,
            cleanup: cleanup
        };
    }

})();
