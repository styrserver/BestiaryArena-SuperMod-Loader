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
    const modDescription = "Adds damage per second (DPS) tracking to the impact analyzer.";
    
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
        warn: (functionName, message) => {
            console.warn(`[${modName}][WARN][${functionName}] ${message}`);
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
    
    // Simplified conflict prevention
    let isProcessing = false;
    let processingTimeout = null;
    
    // Prevent multiple simultaneous calls
    let isWaitingForPanel = false;
    
    // DOM element cache
    let cachedAnalyzerPanel = null;
    let cacheTimestamp = 0;
    const CACHE_DURATION = 1000; // 1 second cache
    
    // =======================
    // 4. Conflict Prevention Functions
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
    
    // =======================
    // 5. Core Functions
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
        const checkGameState = () => {
            if (globalThis.state && globalThis.state.board && globalThis.state.gameTimer) {
                setupBoardStateMonitoring();
                setupServerResultsMonitoring();
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
                logger.warn('updateFinalDPSWithGameTicks', 'No analyzer panel found for final DPS update');
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
            logger.error('getCurrentGameTicks', 'Error getting current game ticks', error);
            return null;
        }
    }
    

    
    function setupBoardStateMonitoring() {
        if (boardSubscription) {
            boardSubscription.unsubscribe();
        }
        
        boardSubscription = globalThis.state.board.subscribe((state) => {
            const context = state.context;
            currentGameMode = context.mode;
            
            if (isProcessing) return;
            
            // Only reset tracking session if we don't have a gameStartTick (truly new game)
            if (context.gameStarted && !isTracking && (gameStartTick === null || gameStartTick === 0)) {
                resetTrackingSession();
            }
            
            if (!context.gameStarted && isTracking) {
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
            const maxRetries = 10;
            const retryInterval = 100;
            
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
                    setTimeout(retryWithServerResults, retryInterval);
                } else {
                    logger.warn('restoreFrozenDPSDisplays', `${gameMode} mode: Server results still not available after ${maxRetries} retries`);
                }
            };
            
            setTimeout(retryWithServerResults, retryInterval);
        }
    }
    
    function startDamageTracking() {
        if (isTracking) return;
        
        const boardState = globalThis.state.board.getSnapshot();
        const timerState = globalThis.state.gameTimer.getSnapshot();
        
        if (!boardState.context.gameStarted) {
            logger.warn('startDamageTracking', 'Game not started yet, skipping tracking');
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
                logger.info('startDamageTracking', 'Manual mode detected, waiting for server results');
                return;
            } else {
                logger.warn('startDamageTracking', 'Game start tick not set, this should not happen');
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
        
        if (dpsUpdateInterval) {
            clearInterval(dpsUpdateInterval);
            dpsUpdateInterval = null;
        }
        
        // Update damage data one final time
        updateDamageData();
        
        if (currentGameMode === 'sandbox') {
            const timerSnapshot = globalThis.state.gameTimer.getSnapshot();
            const finalTick = timerSnapshot.context.currentTick;
            const localGameTicks = finalTick - gameStartTick;
            
            if (localGameTicks > 0) {
                updateFinalDPSWithGameTicks(localGameTicks);
            }
        } else if (currentGameMode === 'autoplay' || currentGameMode === 'manual') {
            // For autoplay and manual modes, ensure DPS displays are maintained
            // Server results will trigger the final DPS update
            setTimeout(() => {
                restoreFrozenDPSDisplays();
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

        stopDamageTracking();
        
        // Clear processing timeout
        if (processingTimeout) {
            clearTimeout(processingTimeout);
            processingTimeout = null;
        }
        isProcessing = false;
        
        // Reset panel waiting flag
        isWaitingForPanel = false;
        
        // Clean up tab button event listeners
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
        
        damageTrackingData.clear();
        // Don't reset gameStartTick - preserve it for post-game analysis
        currentGameMode = null;
        isTracking = false;
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
            logger.error('cleanupAllDPSDisplays', 'Error cleaning up DPS displays', error);
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
    // 6. Initialization & Exports
    // =======================
    
    function initBetterAnalytics() {
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
            calculateDPS: calculateDPS,
            resetTracking: resetTracking,
            cleanup: cleanup,
            startProcessing: startProcessing,
            isCurrentlyProcessing: isCurrentlyProcessing
        };
    }

})();
