// =======================
// Better Forge - Super Mod
// =======================

(function() {
  // ============================================================================
  // 1. CONFIGURATION AND CONSTANTS
  // ============================================================================
  
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  const FORGE_CONFIG = {
    BUTTON_CHECK_INTERVAL: 1000,
    BUTTON_CHECK_TIMEOUT: 10000,
    LOG_AFTER_ATTEMPTS: 3,
    DISENCHANT_INTERVAL: 1000,
    DUST_PER_EQUIPMENT: 10,
    FORGE_DELAY_MS: 500,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 500
  };
  
  const forgeState = {
    isDisenchanting: false,
    isDisenchantingInProgress: false,
    isConfirmationMode: false,
    escKeyHandler: null,
    disenchantInterval: null,
    progressInterval: null,
    rateLimitedEquipment: new Set(),
    rateLimitedEquipmentRetryCount: new Map(),
    // Forge state management
    isForging: false,
    isForgingInProgress: false,
    isForgeConfirmationMode: false,
    isRefreshingInventory: false, // New state for inventory refresh
    forgeInterval: null,
    forgeQueue: [],
    currentForgeStep: null,
    forgeRateLimit: {
      lastRequest: 0,
      requestCount: 0,
      maxRequests: 30,
      timeWindow: 10000 // 10 seconds
    },
    // Track highlighted equipment for forging
    highlightedEquipment: new Set(),
    // Track intermediate results during forging
    intermediateResults: new Map(),
    // Track total steps for progress bar
    totalSteps: 0,
    completedSteps: 0,
    // Track if we're on the final step
    isFinalStep: false
  };
  
  // Auto-upgrade tab state management
  const autoUpgradeState = {
    selectedEquipment: null,
    selectedTier: null,
    selectedStat: null,
    equipmentMap: null,
    lastEquipmentMapUpdate: 0
  };
  
  const SMITH_ICON_URL = 'https://bestiaryarena.com/assets/spells/smith.png';
  
  // ============================================================================
  // 2. UTILITY FUNCTIONS
  // ============================================================================
  
  // Fallback Strategy:
  // 1. Equipment List: Hardcoded list if game API unavailable
  // 2. Equipment Icons: Text fallback if sprite creation fails
  // 3. Error Modals: Alert fallback if modal creation fails
  // 4. Network Errors: Retry logic with exponential backoff
  // 5. State Recovery: Reset state when errors occur
  


  // Clear inventory cache to force fresh data fetch
  const clearInventoryCache = () => {
    try {
      // Clear any cached inventory data
      if (globalThis.state?.inventory?.equipment) {
        delete globalThis.state.inventory.equipment;
      }
      if (globalThis.state?.inventory?.equipmentMap) {
        delete globalThis.state.inventory.equipmentMap;
      }
      console.log(`[Better Forge] 🧹 Inventory cache cleared`);
    } catch (error) {
      console.error(`[Better Forge] 💥 Error clearing inventory cache:`, error);
    }
  };

  // Build equipment name to game ID mapping with caching
  const buildEquipmentMap = () => {
    const now = Date.now();
    const cacheTimeout = 30000; // 30 seconds
    
    // Return cached map if still valid
    if (autoUpgradeState.equipmentMap && 
        (now - autoUpgradeState.lastEquipmentMapUpdate) < cacheTimeout) {
      return autoUpgradeState.equipmentMap;
    }
    
    const map = new Map();
    const utils = globalThis.state?.utils;
    
    if (utils) {
      for (let i = 1; ; i++) {
        try { 
          const equipData = utils.getEquipment(i);
          if (equipData && equipData.metadata && equipData.metadata.name) {
            map.set(equipData.metadata.name.toLowerCase(), i);
          } else {
            break;
          }
        } catch {
          break;
        }
      }
    }
    
    // Cache the result
    autoUpgradeState.equipmentMap = map;
    autoUpgradeState.lastEquipmentMapUpdate = now;
    
    return map;
  };

  const handleError = (error, context, showUserMessage = false) => {
    console.error(`[Better Forge] Error in ${context}:`, error);
    
    if (context.includes('disenchant')) {
      forgeState.isDisenchanting = false;
      forgeState.isDisenchantingInProgress = false;
      clearAllIntervals();
    }
     
    if (context.includes('modal') || context.includes('UI')) {
      clearDomCache();
    }
    
    if (showUserMessage && api?.ui?.components?.createModal) {
      try {
        api.ui.components.createModal({
          title: 'Better Forge Error',
          content: `<p>An error occurred in ${context}. The system has been reset.</p>`,
          buttons: [{ text: 'OK', primary: true }]
        });
      } catch (modalError) {
        console.error('[Better Forge] Failed to show error modal:', modalError);
        // Fallback: show alert if modal fails
        alert(`Better Forge Error: An error occurred in ${context}. The system has been reset.`);
      }
    }
  };

  // ============================================================================
  // 3. DISENCHANTING CORE FUNCTIONS
  // ============================================================================
  
  function updateDisenchantButtonState(button, state) {
    const states = {
      normal: {
        text: 'Disenchant',
        borderColor: '#ffe066',
        color: '#e6d7b0'
      },
      confirmation: {
        text: 'Confirm Disenchant',
        borderColor: '#ff8800',
        color: '#ffcc88'
      },
      disenchanting: {
        text: 'Stop',
        borderColor: '#ff4444',
        color: '#ffcccc'
      }
    };
    
    const buttonState = states[state];
    if (button && buttonState) {
      button.textContent = buttonState.text;
      button.style.borderColor = buttonState.borderColor;
      button.style.color = buttonState.color;
    }
  }
  
     const domCache = {
    disenchantButton: null,
    disenchantCol2: null,
    progressFill: null,
    progressText: null,
    statusText: null,
    lastUpdate: 0
  };

  function getDisenchantButton() {
    const now = Date.now();
    if (domCache.disenchantButton && now - domCache.lastUpdate < 1000) {
      return domCache.disenchantButton;
    }
    
    domCache.disenchantButton = document.querySelector('button[textContent="Disenchant"]') ||
                                document.querySelector('button[textContent="Confirm Disenchant"]') ||
                                document.querySelector('button[textContent="Stop"]') ||
                                document.querySelector('button[style*="border-color: #ffe066"]') ||
                                document.querySelector('button[style*="border-color: #ff8800"]') ||
                                document.querySelector('button[style*="border-color: #ff4444"]');
    domCache.lastUpdate = now;
    return domCache.disenchantButton;
  }

  function clearDomCache() {
    domCache.disenchantButton = null;
    domCache.disenchantCol2 = null;
    domCache.progressFill = null;
    domCache.progressText = null;
    domCache.statusText = null;
    domCache.lastUpdate = 0;
  }
  
  function resetConfirmationMode() {
    forgeState.isConfirmationMode = false;
    
    const buttons = document.querySelectorAll('button');
    for (const button of buttons) {
      if (button.textContent === 'Confirm Disenchant' || 
          button.style.borderColor === '#ff8800' ||
          button.style.color === '#ffcc88') {
        updateDisenchantButtonState(button, 'normal');
        break;
      }
    }
    
    removeEscKeyHandler();
    updateDisenchantStatus();
  }

  function resetForgeConfirmationMode() {
    console.log('[Better Forge] 🔄 Forge confirmation mode exited');
    forgeState.isForgeConfirmationMode = false;
    
    const forgeBtn = document.getElementById('auto-upgrade-forge-btn');
    if (forgeBtn) {
      updateForgeButtonState('normal');
    }
    
    removeEscKeyHandler();
    updateAutoUpgradeStatus();
  }

  function resetForgeConfirmationModeIfActive() {
    // Only reset if confirmation mode is active
    if (forgeState.isForgeConfirmationMode) {
      console.log('[Better Forge] 🔄 Forge confirmation mode reset due to selection change');
      resetForgeConfirmationMode();
    }
  }
  
  function startDisenchanting(button) {
    try {
      if (!forgeState.isConfirmationMode) {
        forgeState.isConfirmationMode = true;
        updateDisenchantButtonState(button, 'confirmation');
        updateDisenchantStatus('Click "Confirm Disenchant" to start disenchanting process');
        addEscKeyHandler(button);
        return;
      }
      
      forgeState.isConfirmationMode = false;
      forgeState.isDisenchanting = true;
      updateDisenchantButtonState(button, 'disenchanting');
      updateDisenchantStatus('Starting disenchanting process...');
      

      
      forgeState.disenchantInterval = setInterval(() => {
        performDisenchantStep();
      }, FORGE_CONFIG.DISENCHANT_INTERVAL);
      
    } catch (error) {
      handleError(error, 'startDisenchanting', false);
    }
  }
  
  function stopDisenchanting(button) {
    try {
      if (forgeState.isConfirmationMode) {
        resetConfirmationMode();
        return;
      }
      
      forgeState.isDisenchanting = false;
      forgeState.isDisenchantingInProgress = false;
      updateDisenchantButtonState(button, 'normal');
      

      
      if (forgeState.disenchantInterval) {
        clearInterval(forgeState.disenchantInterval);
        forgeState.disenchantInterval = null;
      }
      
      if (forgeState.progressInterval) {
        clearInterval(forgeState.progressInterval);
        forgeState.progressInterval = null;
      }
      
             forgeState.rateLimitedEquipment.clear();
       forgeState.rateLimitedEquipmentRetryCount.clear();
       
       const progressFill = document.getElementById('disenchant-progress-fill');
      const progressText = document.getElementById('disenchant-progress-text');
      if (progressFill) {
        progressFill.style.width = '0%';
        progressFill.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
      }
      if (progressText) {
        progressText.textContent = '0%';
      }
      
      updateDisenchantStatus('Disenchanting stopped');
      
    } catch (error) {
      handleError(error, 'stopDisenchanting', false);
    }
  }
  
  function addEscKeyHandler(button) {
    try {
      removeEscKeyHandler();
      
      forgeState.escKeyHandler = (event) => {
        if (event.key === 'Escape' && forgeState.isConfirmationMode) {
          resetConfirmationMode();
        }
        if (event.key === 'Escape' && forgeState.isForgeConfirmationMode) {
          console.log('[Better Forge] 🔄 Forge confirmation mode exited via ESC key');
          resetForgeConfirmationMode();
        }
      };
      
      document.addEventListener('keydown', forgeState.escKeyHandler);
      
    } catch (error) {
      handleError(error, 'addEscKeyHandler', false);
    }
  }
  
  function removeEscKeyHandler() {
    try {
      if (forgeState.escKeyHandler) {
        document.removeEventListener('keydown', forgeState.escKeyHandler);
        forgeState.escKeyHandler = null;
      }
    } catch (error) {
      handleError(error, 'removeEscKeyHandler', false);
    }
  }

  function clearAllIntervals() {
    try {
      if (forgeState.disenchantInterval) {
        clearInterval(forgeState.disenchantInterval);
        forgeState.disenchantInterval = null;
      }
      
      if (forgeState.progressInterval) {
        clearInterval(forgeState.progressInterval);
        forgeState.progressInterval = null;
      }
      
      if (forgeState.forgeInterval) {
        clearInterval(forgeState.forgeInterval);
        forgeState.forgeInterval = null;
      }
    } catch (error) {
      handleError(error, 'clearAllIntervals', false);
    }
  }

  // ============================================================================
  // FORGING PROCESS FUNCTIONS
  // ============================================================================

  function checkIfCanForgeForButton(equipment, stat, targetTier) {
    try {
      console.log(`[Better Forge] 🔍 checkIfCanForgeForButton called with:`, { equipment, stat, targetTier });
      
      // Check if we have enough items
      const matchingItems = getMatchingInventoryItems(equipment, stat, targetTier);
      const itemsByTier = groupItemsByTier(matchingItems);
      
      // Convert to count-based format for compatibility
      const itemsByTierCount = {};
      Object.keys(itemsByTier).forEach(tierKey => {
        itemsByTierCount[tierKey] = itemsByTier[tierKey].length;
      });
      
      // Check if we can forge the target tier
      const canForge = checkIfCanForge(itemsByTierCount, targetTier);
      
      if (!canForge.canForge) {
        console.log(`[Better Forge] ❌ Cannot forge:`, canForge.missing);
        return false;
      }
      
      // Check if we have enough dust
      const dustCost = calculateDustCost(equipment, stat, targetTier);
      const userDust = getUserCurrentDust();
      console.log(`[Better Forge] 💰 Dust check: Need ${dustCost}, Have ${userDust}`);
      
      return userDust >= dustCost;
    } catch (error) {
      console.error('[Better Forge] Error in checkIfCanForgeForButton:', error);
      return false;
    }
  }

  function startForging(equipment, stat, targetTier) {
    try {
      if (forgeState.isForging || forgeState.isForgingInProgress) {
        console.warn('[Better Forge] ⚠️ Forging already in progress');
        return;
      }

      // Skip pre-validation - let the forge plan creation handle it
      console.log(`[Better Forge] 🚀 Attempting to create forge plan for ${equipment} ${stat} T${targetTier}`);

      if (!forgeState.isForgeConfirmationMode) {
        forgeState.isForgeConfirmationMode = true;
        updateForgeButtonState('confirmation');
        updateAutoUpgradeStatus('Click "Confirm Forge" to start forging process');
        addEscKeyHandler();
        return;
      }

      forgeState.isForgeConfirmationMode = false;

      const { canForge, steps, error } = calculateForgeSteps(equipment, stat, targetTier);
      
      if (!canForge || steps.length === 0) {
        console.error(`[Better Forge] ❌ Cannot forge: ${error || 'Insufficient materials'}`);
        updateAutoUpgradeStatus(error || 'Cannot forge - insufficient materials');
        return;
      }

      console.log(`[Better Forge] 📋 Forge plan created: ${steps.length} steps`);
      console.log(`[Better Forge] 📊 Steps breakdown:`, steps.map(s => `T${s.fromTier}→T${s.toTier}`));

      // Check dust cost
      const dustCost = calculateDustCost(equipment, stat, targetTier);
      const userDust = getUserCurrentDust();
      
      console.log(`[Better Forge] 💰 Dust check: Need ${dustCost}, Have ${userDust}`);
      
      if (userDust < dustCost) {
        console.error(`[Better Forge] ❌ Insufficient dust: Need ${dustCost}, Have ${userDust}`);
        updateAutoUpgradeStatus('Not enough dust for forging');
        return;
      }

      console.log(`[Better Forge] 🚀 Starting forging process for ${equipment} ${stat} T${targetTier}`);
      
      forgeState.isForging = true;
      forgeState.isForgingInProgress = false; // Start as false, will be set to true when executing a step
      forgeState.forgeQueue = [...steps];
      forgeState.currentForgeStep = null;
      
      // Track intermediate results as they're created
      forgeState.intermediateResults = new Map(); // tier -> array of equipment IDs

      // Initialize progress tracking
      forgeState.totalSteps = steps.length;
      forgeState.completedSteps = 0;
      forgeState.isFinalStep = false;
      
      // Initialize progress bar to 0% for first step
      resetForgeProgressBar();

      console.log(`[Better Forge] ✅ Forge state initialized`);
      console.log(`[Better Forge] 🔄 Queue created with ${forgeState.forgeQueue.length} steps`);
      console.log(`[Better Forge] 📋 Queue contents:`, forgeState.forgeQueue);

      updateForgeButtonState('forging');
      updateAutoUpgradeStatus('Starting forging process...');

      // Start forging process with faster interval
              forgeState.forgeInterval = setInterval(() => {
          console.log(`[Better Forge] ⏰ Interval triggered, calling performForgeStep...`);
          performForgeStep();
        }, 500); // 500ms between steps for faster operation

              console.log(`[Better Forge] ⏱️ Forge interval started (500ms intervals)`);

    } catch (error) {
      console.error('[Better Forge] 💥 Error in startForging:', error);
      handleError(error, 'startForging', false);
      stopForging();
    }
  }

  function stopForging() {
    try {
      console.log('[Better Forge] ⏹️ Forging process stopped by user');
      console.log('[Better Forge] 🧹 Cleaning up forge state...');
      
      forgeState.isForging = false;
      forgeState.isForgingInProgress = false;
      forgeState.isForgeConfirmationMode = false;
      forgeState.isRefreshingInventory = false; // Reset refreshing state
      forgeState.forgeQueue = [];
      forgeState.currentForgeStep = null;
      forgeState.intermediateResults.clear();
      forgeState.totalSteps = 0;
      forgeState.completedSteps = 0;
      forgeState.isFinalStep = false;

      if (forgeState.forgeInterval) {
        clearInterval(forgeState.forgeInterval);
        forgeState.forgeInterval = null;
        console.log('[Better Forge] ⏱️ Forge interval cleared');
      }

      updateForgeButtonState('normal');
      updateAutoUpgradeStatus('Forging stopped');
      
      // Reset progress bar to 0%
      resetForgeProgressBar();
      
      console.log('[Better Forge] ✅ Forge state cleanup completed');

    } catch (error) {
      console.error('[Better Forge] 💥 Error in stopForging:', error);
      handleError(error, 'stopForging', false);
    }
  }

  function performForgeStep() {
    try {
      console.log(`[Better Forge] 🔍 performForgeStep called`);
      console.log(`[Better Forge] 📊 Current state: isForging=${forgeState.isForging}, isForgingInProgress=${forgeState.isForgingInProgress}, isRefreshingInventory=${forgeState.isRefreshingInventory}, queueLength=${forgeState.forgeQueue.length}`);
      
      // Check if we're refreshing inventory - if so, wait
      if (forgeState.isRefreshingInventory) {
        console.log(`[Better Forge] ⏳ Inventory refresh in progress, waiting...`);
        return;
      }
      
      if (forgeState.isForgingInProgress || forgeState.forgeQueue.length === 0) {
        console.log(`[Better Forge] ⚠️ Early return: isForgingInProgress=${forgeState.isForgingInProgress}, queueLength=${forgeState.forgeQueue.length}`);
        
        if (forgeState.forgeQueue.length === 0 && forgeState.isForging) {
          // Check if we have enough items to create more steps
          const canCreateMoreSteps = checkIfCanCreateMoreSteps();
          
          if (canCreateMoreSteps) {
            console.log(`[Better Forge] 🔄 Can create more steps, creating them now...`);
            
            // Find which tier we can create steps for and create them
            const { selectedEquipment, selectedTier, selectedStat } = getCurrentSelection();
            if (selectedEquipment && selectedTier && selectedStat) {
              // Check if we've already reached the target tier
              const currentMaxTier = Math.max(...Array.from(forgeState.intermediateResults.keys()), 1);
              if (currentMaxTier >= selectedTier) {
                console.log(`[Better Forge] 🎯 Already reached target tier T${selectedTier}, completing forging`);
                completeForging();
                return;
              }
              
              // Additional safety check: if we have a T5 item, we're definitely done
              if (forgeState.intermediateResults.has(5)) {
                console.log(`[Better Forge] 🎯 T5 item detected, completing forging immediately`);
                completeForging();
                return;
              }
              
              for (let tier = 1; tier < selectedTier; tier++) {
                const availableItems = forgeState.intermediateResults.get(tier) || [];
                const itemsNeeded = Math.pow(2, selectedTier - tier - 1);
                const itemsRequired = itemsNeeded * 2;
                
                if (availableItems.length >= itemsRequired) {
                  console.log(`[Better Forge] ➕ Creating steps for T${tier} → T${tier + 1}`);
                  createNextTierSteps(tier, selectedEquipment, selectedStat, selectedTier);
                  break; // Only create steps for one tier at a time
                }
              }
            }
            
            // Continue with the next interval
            forgeState.isForgingInProgress = false;
            return;
          } else {
            console.log('[Better Forge] 🎉 All forge steps completed!');
            // Clear the interval immediately to stop spam
            if (forgeState.forgeInterval) {
              clearInterval(forgeState.forgeInterval);
              forgeState.forgeInterval = null;
              console.log('[Better Forge] ⏱️ Forge interval cleared to prevent spam');
            }
            // Mark as final step - completion will be handled after API call
            forgeState.isFinalStep = true;
          }
        }
        return;
      }

      forgeState.isForgingInProgress = true;
      const step = forgeState.forgeQueue.shift();
      forgeState.currentForgeStep = step;

      // If this step needs dynamic items, find available items now
      if (step.needsDynamicItems) {
        const availableItems = findAvailableItemsForStep(step);
        if (!availableItems) {
          console.error(`[Better Forge] ❌ No available items found for T${step.fromTier}→T${step.toTier}`);
          forgeState.isForgingInProgress = false;
          return;
        }
        step.equipA = availableItems.item1.id;
        step.equipB = availableItems.item2.id;
        console.log(`[Better Forge] 🔄 Dynamic items assigned: ${step.equipA} + ${step.equipB}`);
      }
      
      // Log retry information if this is a retry attempt
      if (step.retryCount && step.retryCount > 0) {
        console.log(`[Better Forge] 🔄 Retry attempt ${step.retryCount}/${FORGE_CONFIG.MAX_RETRIES} for T${step.fromTier}→T${step.toTier}`);
      }

      console.log(`[Better Forge] 🔨 Executing forge step: T${step.fromTier} → T${step.toTier}`);
      console.log(`[Better Forge] 📦 Equipment: ${step.equipment} ${step.stat}`);
      console.log(`[Better Forge] 🆔 IDs: ${step.equipA} + ${step.equipB}`);
      console.log(`[Better Forge] 📊 Queue remaining: ${forgeState.forgeQueue.length} steps`);

      // Start progress bar animation from 0-100 for this step
      updateForgeProgressBar(0, 1);
      animateProgressBar(0, 100, 500); // 500ms animation

      // Execute the forge step after animation completes
      setTimeout(() => {
        console.log(`[Better Forge] 🌐 Making API call to forge equipment...`);
        forgeEquipment(step.equipA, step.equipB)
        .then(result => {
          if (!forgeState.isForging) {
            console.log('[Better Forge] ⏹️ Forging stopped, ignoring result');
            return;
          }

          console.log(`[Better Forge] 📡 API response received:`, result);

          if (result.success) {
            console.log(`[Better Forge] ✅ Forge successful!`);
            
            // Update local inventory
            removeEquipmentFromLocalInventory(step.equipA);
            removeEquipmentFromLocalInventory(step.equipB);
            console.log(`[Better Forge] 🗑️ Removed consumed items: ${step.equipA}, ${step.equipB}`);
            
            // Update visual Arsenal display
            removeEquipmentFromArsenal(step.equipA);
            removeEquipmentFromArsenal(step.equipB);
            console.log(`[Better Forge] 🖥️ Removed consumed items from Arsenal display`);
            
            // Store the forged equipment ID for use in subsequent steps
            if (result.nextEquip) {
              const newTier = result.nextEquip.tier;
              console.log(`[Better Forge] 🆕 New equipment created: T${newTier} ${result.nextEquip.id}`);
              
              if (!forgeState.intermediateResults.has(newTier)) {
                forgeState.intermediateResults.set(newTier, []);
              }
              forgeState.intermediateResults.get(newTier).push(result.nextEquip.id);
              
              console.log(`[Better Forge] 📝 Intermediate results for T${newTier}:`, 
                forgeState.intermediateResults.get(newTier));
              
              // Create proper equipment object with all required properties
              const newEquipment = {
                id: result.nextEquip.id,
                gameId: result.nextEquip.gameId || 29, // Default to 29 if not provided
                name: step.equipment, // Use the step equipment name
                tier: result.nextEquip.tier,
                stat: result.nextEquip.stat,
                count: 1
              };
              
              // Add to local inventory
              addEquipmentToLocalInventory(newEquipment);
              
              // Add to visual Arsenal display
              addEquipmentToArsenal(newEquipment);
              console.log(`[Better Forge] 🖥️ Added new equipment to Arsenal display`);
              
              // Update progress tracking
              forgeState.completedSteps++;
              
              // Check if we've reached the target tier and clear queue if needed
              if (result.nextEquip && result.nextEquip.tier >= step.targetTier) {
                console.log(`[Better Forge] 🎯 Target tier ${step.targetTier} reached! Clearing remaining queue (${forgeState.forgeQueue.length} steps)`);
                forgeState.forgeQueue = [];
                forgeState.isFinalStep = true;
              }
              
              // Update highlighting to reflect new state
              setTimeout(() => {
                const { selectedEquipment, selectedTier, selectedStat } = getCurrentSelection();
                if (selectedEquipment && selectedTier && selectedStat) {
                  highlightEquipmentForForging(selectedEquipment, selectedStat, selectedTier);
                  console.log(`[Better Forge] 🎨 Updated equipment highlighting`);
                }
              }, 100);
              
              // Fresh inventory fetch and delay to ensure inventory is properly updated before checking next tier steps
              setTimeout(async () => {
                // Set refreshing state to prevent premature step creation
                forgeState.isRefreshingInventory = true;
                console.log(`[Better Forge] 🔄 Starting inventory refresh after successful forge...`);
                
                try {
                  // Force refresh of user inventory to get the latest state
                  console.log(`[Better Forge] 🔄 Refreshing inventory after successful forge...`);
                  
                  // Use the enhanced state refresh function
                  await forceRefreshPlayerState();
                  
                  // Verify inventory was updated
                  const freshInventory = getUserOwnedEquipment();
                  console.log(`[Better Forge] 🔄 Fresh inventory check:`, freshInventory.length, 'items');
                  
                  // Check if we need to create additional forging steps for the next tier
                  const nextTier = step.toTier;
                  if (nextTier < step.targetTier && nextTier < 5) {
                    console.log(`[Better Forge] 🔄 Checking if we can create next tier steps for T${nextTier} → T${nextTier + 1}`);
                    
                    // Check if we have enough items at the current tier (including newly forged ones)
                    const intermediateItems = forgeState.intermediateResults.get(nextTier) || [];
                    const existingItems = getUserOwnedEquipment().filter(item => 
                      item.name === step.equipment && 
                      item.stat.toLowerCase() === step.stat.toLowerCase() &&
                      item.tier === nextTier
                    );
                    const totalAvailable = intermediateItems.length + existingItems.length;
                    const itemsNeeded = Math.pow(2, step.targetTier - nextTier - 1);
                    const itemsRequired = itemsNeeded * 2; // Need 2 items per pair
                    
                    console.log(`[Better Forge] 📊 T${nextTier}: Have ${totalAvailable} (${intermediateItems.length} intermediate + ${existingItems.length} existing), Need ${itemsRequired} for ${itemsNeeded} pairs`);
                    
                    if (totalAvailable >= itemsRequired) {
                      console.log(`[Better Forge] ✅ Sufficient items available, creating next tier steps`);
                      createNextTierSteps(nextTier, step.equipment, step.stat, step.targetTier);
                      
                      // If new steps were added, let the interval handle the next step
                      if (forgeState.forgeQueue.length > 0) {
                        console.log(`[Better Forge] 🔄 New steps added, waiting for next interval...`);
                        console.log(`[Better Forge] �� Queue now contains:`, forgeState.forgeQueue.map(s => `T${s.fromTier}→T${s.toTier}`));
                        
                        // Reset the flag so the next interval can handle the next step
                        forgeState.isForgingInProgress = false;
                      }
                    } else {
                      console.log(`[Better Forge] ⏳ Waiting for more T${nextTier} items (need ${itemsRequired}, have ${totalAvailable})`);
                      console.log(`[Better Forge] 🔄 Will check again when more items are available`);
                    }
                  } else {
                    console.log(`[Better Forge] 🎯 Reached target tier or max tier (${nextTier})`);
                    
                    // Clear the queue since we've reached the target tier
                    if (forgeState.forgeQueue.length > 0) {
                      console.log(`[Better Forge] 🧹 Clearing forge queue (${forgeState.forgeQueue.length} steps) - target tier reached`);
                      forgeState.forgeQueue = [];
                      forgeState.isFinalStep = true;
                    }
                  }
                } catch (error) {
                  console.error(`[Better Forge] 💥 Error refreshing inventory:`, error);
                } finally {
                  // Clear refreshing state
                  forgeState.isRefreshingInventory = false;
                  console.log(`[Better Forge] ✅ Inventory refresh completed`);
                }
              }, 200); // Reduced delay for faster operation
            }
            
            // Next tier step creation is now handled in the setTimeout above to ensure inventory is properly updated
            // Also schedule a periodic check to see if we can create more steps
            if (step.toTier < step.targetTier && step.toTier < 5) {
              setTimeout(() => {
                const canCreateMoreSteps = checkIfCanCreateMoreSteps();
                if (canCreateMoreSteps) {
                  console.log(`[Better Forge] 🔄 Periodic check: Can create more steps, creating them now...`);
                  const { selectedEquipment, selectedTier, selectedStat } = getCurrentSelection();
                  if (selectedEquipment && selectedTier && selectedStat) {
                          for (let tier = 1; tier < selectedTier; tier++) {
        const intermediateItems = forgeState.intermediateResults.get(tier) || [];
        const existingItems = getUserOwnedEquipment().filter(item => 
          item.name === selectedEquipment && 
          item.stat.toLowerCase() === selectedStat.toLowerCase() &&
          item.tier === tier
        );
        const totalAvailable = intermediateItems.length + existingItems.length;
        const itemsNeeded = Math.pow(2, selectedTier - tier - 1);
        const itemsRequired = itemsNeeded * 2;
        
        if (totalAvailable >= itemsRequired) {
          console.log(`[Better Forge] ➕ Periodic check: Creating steps for T${tier} → T${tier + 1}`);
          createNextTierSteps(tier, selectedEquipment, selectedStat, selectedTier);
          break;
        }
      }
                  }
                }
              }, 200); // Check again after 200ms
            }

            // Update dust
            if (result.dustDiff) {
              console.log(`[Better Forge] 💰 Dust change: ${result.dustDiff}, type: ${typeof result.dustDiff}`);
              const dustChange = Number(result.dustDiff) || 0;
              console.log(`[Better Forge] 💰 Converted dust change: ${dustChange}`);
              updateLocalInventoryGoldDust(0, dustChange);
              updateDustDisplayWithAnimation(dustChange);
            }

            updateAutoUpgradeStatus(`Forged ${step.equipment} T${step.fromTier} → T${step.toTier}`);
            
            // Reset progress bar to 0% after animation completes
            setTimeout(() => {
              resetForgeProgressBar();
              console.log(`[Better Forge] 🔄 Progress bar reset to 0% after animation completed`);
            }, 500); // Wait for animation to complete
            
                  // Check if this was the final step and complete forging
      if (forgeState.isFinalStep) {
        console.log('[Better Forge] 🎯 Final step completed, calling completeForging...');
        completeForging();
        return; // Exit early to prevent further processing
      }
      
      // Additional safety check: if queue is empty and we're not forging, stop
      if (forgeState.forgeQueue.length === 0 && !forgeState.isForgingInProgress) {
        console.log('[Better Forge] 🧹 Queue is empty, stopping forge process');
        completeForging();
        return;
      }
            
            // Add configurable sleep after successful forge to prevent API rate limiting
            if (forgeState.forgeQueue.length > 0) {
              const sleepDuration = FORGE_CONFIG.FORGE_DELAY_MS;
              console.log(`[Better Forge] 😴 ${sleepDuration}ms sleep before next step to prevent rate limiting...`);
            }
            
          } else if (result.status === 429) {
            console.warn(`[Better Forge] ⏰ Rate limited (${result.status}): ${result.message}`);
            // Rate limited - put step back in queue
            forgeState.forgeQueue.unshift(step);
            updateAutoUpgradeStatus('Rate limited - waiting...');
            // Reset progress bar to 0% for rate limited operations
            resetForgeProgressBar();
          } else if (result.status === 404) {
            // Handle 404 errors with retry logic and inventory refresh
            if (!step.retryCount) {
              step.retryCount = 0;
            }
            
            // Clear inventory cache and wait longer for 404 errors
            console.log(`[Better Forge] 🔄 404 error, retry ${step.retryCount + 1}/${FORGE_CONFIG.MAX_RETRIES}: ${result.message}`);
            if (typeof clearInventoryCache === 'function') {
              clearInventoryCache();
            }
            
            if (step.retryCount < FORGE_CONFIG.MAX_RETRIES) {
              step.retryCount++;
              console.warn(`[Better Forge] 🔄 404 error, retry ${step.retryCount}/${FORGE_CONFIG.MAX_RETRIES}: ${result.message}`);
              updateAutoUpgradeStatus(`404 error - retrying ${step.retryCount}/${FORGE_CONFIG.MAX_RETRIES}...`);
              
              // Put step back in queue with delay
              setTimeout(() => {
                forgeState.forgeQueue.unshift(step);
                forgeState.isForgingInProgress = false;
              }, FORGE_CONFIG.RETRY_DELAY_MS);
              return;
            } else {
              console.error(`[Better Forge] ❌ 404 error after ${FORGE_CONFIG.MAX_RETRIES} retries: ${result.message}`);
              updateAutoUpgradeStatus(`Forge failed after ${FORGE_CONFIG.MAX_RETRIES} retries: ${result.message}`);
            }
                      } else {
              console.error(`[Better Forge] ❌ Forge failed: ${result.message || 'Unknown error'}`);
              updateAutoUpgradeStatus(`Forge failed: ${result.message || 'Unknown error'}`);
              // Reset progress bar to 0% for failed operations
              resetForgeProgressBar();
            }

          forgeState.isForgingInProgress = false;
          console.log(`[Better Forge] 🔓 Forge step completed, ready for next step`);

        })
        .catch(error => {
          console.error('[Better Forge] 💥 Forge step error:', error);
          forgeState.isForgingInProgress = false;
          
          if (forgeState.isForging) {
            updateAutoUpgradeStatus('Forge error - retrying...');
          }
          
          // Reset progress bar to 0% on errors
          resetForgeProgressBar();
        });
      }, 500); // Wait for animation to complete before making API call

    } catch (error) {
      console.error('[Better Forge] 💥 Error in performForgeStep:', error);
      handleError(error, 'performForgeStep', false);
      forgeState.isForgingInProgress = false;
    }
  }

  function completeForging() {
    try {
      console.log('[Better Forge] 🎉 Forging process completed successfully!');
      console.log('[Better Forge] 🧹 Cleaning up forge state...');
      
      forgeState.isForging = false;
      forgeState.isForgingInProgress = false;
      forgeState.isForgeConfirmationMode = false;
      forgeState.isRefreshingInventory = false; // Reset refreshing state
      forgeState.forgeQueue = [];
      forgeState.currentForgeStep = null;
      forgeState.intermediateResults.clear();
      forgeState.totalSteps = 0;
      forgeState.completedSteps = 0;
      forgeState.isFinalStep = false;

      if (forgeState.forgeInterval) {
        clearInterval(forgeState.forgeInterval);
        forgeState.forgeInterval = null;
        console.log('[Better Forge] ⏱️ Forge interval cleared');
      }

      updateForgeButtonState('normal');
      updateAutoUpgradeStatus('Forging completed successfully!');
      
      // Reset progress bar to 0% completion
      resetForgeProgressBar();

      console.log('[Better Forge] 🔄 Refreshing UI...');

              // Set completion status - UI will be refreshed after final API call completes
        setTimeout(() => {
          updateAutoUpgradeStatus('🎉 Forging completed successfully! Select new equipment to forge again.');
          console.log('[Better Forge] ✅ Completion status set');
        }, 1000);

    } catch (error) {
      console.error('[Better Forge] 💥 Error in completeForging:', error);
      handleError(error, 'completeForging', false);
    }
  }

  function updateForgeButtonState(state) {
    try {
      const forgeBtn = document.getElementById('auto-upgrade-forge-btn');
      if (!forgeBtn) return;

      const states = {
        normal: {
          text: 'Forge',
          color: '#888888'
        },
        confirmation: {
          text: 'Confirm Forge',
          color: '#ff8800'
        },
        forging: {
          text: 'Stop',
          color: '#ff4444'
        }
      };

      const buttonState = states[state];
      if (buttonState) {
        forgeBtn.textContent = buttonState.text;
        forgeBtn.style.color = buttonState.color;
      }
    } catch (error) {
      handleError(error, 'updateForgeButtonState', false);
    }
  }



  // Track the current animation frame ID to stop animations
  let currentAnimationFrame = null;

  function animateProgressBar(fromProgress, toProgress, duration) {
    try {
      const progressFill = document.getElementById('auto-upgrade-progress-fill');
      const progressText = document.getElementById('auto-upgrade-progress-text');
      
      if (!progressFill || !progressText) return;
      
      // Cancel any existing animation
      if (currentAnimationFrame) {
        cancelAnimationFrame(currentAnimationFrame);
        currentAnimationFrame = null;
      }
      
      const startTime = Date.now();
      const progressDiff = toProgress - fromProgress;
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentProgress = fromProgress + (progressDiff * progress);
        progressFill.style.width = `${currentProgress}%`;
        progressText.textContent = `${Math.round(currentProgress)}%`;
        
        // Update colors based on progress
        if (currentProgress >= 100) {
          progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
        } else if (currentProgress > 50) {
          progressFill.style.background = 'linear-gradient(90deg, #FF9800, #F57C00)';
        } else {
          progressFill.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
        }
        
        if (progress < 1) {
          currentAnimationFrame = requestAnimationFrame(animate);
        } else {
          currentAnimationFrame = null;
        }
      };
      
      animate();
      
    } catch (error) {
      handleError(error, 'animateProgressBar', false);
    }
  }

  function resetForgeProgressBar() {
    try {
      // Cancel any ongoing animation
      if (currentAnimationFrame) {
        cancelAnimationFrame(currentAnimationFrame);
        currentAnimationFrame = null;
      }
      
      const progressFill = document.getElementById('auto-upgrade-progress-fill');
      const progressText = document.getElementById('auto-upgrade-progress-text');
      
      if (progressFill && progressText) {
        // Immediately reset to 0% with blue color
        progressFill.style.width = '0%';
        progressText.textContent = '0%';
        progressFill.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
      }
    } catch (error) {
      handleError(error, 'resetForgeProgressBar', false);
    }
  }

  function updateForgeProgressBar(completedSteps, totalSteps) {
    try {
      const progressFill = document.getElementById('auto-upgrade-progress-fill');
      const progressText = document.getElementById('auto-upgrade-progress-text');
      
      if (progressFill && progressText) {
        const progress = totalSteps > 0 ? Math.min(100, (completedSteps / totalSteps) * 100) : 0;
        
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${Math.round(progress)}%`;
        
        if (progress >= 100) {
          progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
        } else if (progress > 50) {
          progressFill.style.background = 'linear-gradient(90deg, #FF9800, #F57C00)';
        } else {
          progressFill.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
        }
      }
    } catch (error) {
      handleError(error, 'updateForgeProgressBar', false);
    }
  }

  function addEquipmentToLocalInventory(equipment) {
    try {
      if (!globalThis.state?.player) return;

      globalThis.state.player.send({
        type: "setState",
        fn: (prev) => {
          if (prev?.context?.equips) {
            return {
              ...prev,
              context: {
                ...prev.context,
                equips: [...prev.context.equips, equipment]
              }
            };
          }
          return prev;
        },
      });
    } catch (e) {
      console.warn('[Better Forge] Failed to add equipment to local inventory:', e);
    }
  }

  function addEquipmentToArsenal(equipment) {
    try {
      console.log(`[Better Forge] 🖥️ Adding equipment to Arsenal: ${equipment.id} (${equipment.tier})`);
      
      // Find the Arsenal scroll area
      const arsenalScrollArea = document.querySelector('div[style*="grid-template-columns: repeat(6, 34px)"]');
      if (!arsenalScrollArea) {
        console.warn('[Better Forge] Arsenal scroll area not found');
        return;
      }
      
      // Create a new equipment button
      const newButton = createEquipmentButton({
        id: equipment.id,
        gameId: equipment.gameId || 29, // Default to 29 if not provided
        name: equipment.name || 'White Skull', // Default name if not provided
        tier: equipment.tier,
        stat: equipment.stat,
        count: 1
      }, transferToDisenchant);
      
      // Find the correct position to insert the new equipment based on sorting
      const existingButtons = Array.from(arsenalScrollArea.querySelectorAll('button[data-equipment-id]'));
      let insertIndex = 0;
      
      // Sort by tier (descending), then by name, then by stat
      for (let i = 0; i < existingButtons.length; i++) {
        const existingBtn = existingButtons[i];
        
        // Try to get tier from data attribute, fallback to parsing from button content
        let existingTier = parseInt(existingBtn.getAttribute('data-tier') || '1');
        if (isNaN(existingTier)) {
          // Fallback: try to parse tier from button content or classes
          const tierMatch = existingBtn.innerHTML.match(/T(\d+)/);
          existingTier = tierMatch ? parseInt(tierMatch[1]) : 1;
        }
        
        const existingEquipment = {
          tier: existingTier,
          name: existingBtn.getAttribute('data-equipment') || '',
          stat: existingBtn.getAttribute('data-stat') || ''
        };
        
        console.log(`[Better Forge] 🔍 Comparing new T${equipment.tier} ${equipment.name} ${equipment.stat} with existing T${existingEquipment.tier} ${existingEquipment.name} ${existingEquipment.stat}`);
        
        // Compare tiers first (higher tiers first)
        if (equipment.tier > existingEquipment.tier) {
          insertIndex = i;
          console.log(`[Better Forge] 📍 Inserting at position ${i} (higher tier)`);
          break;
        } else if (equipment.tier === existingEquipment.tier) {
          // Same tier, compare names
          if (equipment.name < existingEquipment.name) {
            insertIndex = i;
            console.log(`[Better Forge] 📍 Inserting at position ${i} (same tier, name comes first)`);
            break;
          } else if (equipment.name === existingEquipment.name) {
            // Same name, compare stats
            if (equipment.stat < existingEquipment.stat) {
              insertIndex = i;
              console.log(`[Better Forge] 📍 Inserting at position ${i} (same tier/name, stat comes first)`);
              break;
            }
          }
        }
        insertIndex = i + 1;
      }
      
      // Insert the new button at the correct position
      if (insertIndex === 0) {
        arsenalScrollArea.insertBefore(newButton, arsenalScrollArea.firstChild);
      } else if (insertIndex >= existingButtons.length) {
        arsenalScrollArea.appendChild(newButton);
      } else {
        arsenalScrollArea.insertBefore(newButton, existingButtons[insertIndex]);
      }
      
      console.log(`[Better Forge] ✅ Equipment added to Arsenal display at position ${insertIndex}`);
      
    } catch (error) {
      console.error('[Better Forge] Error adding equipment to Arsenal:', error);
    }
  }

  function checkIfCanCreateMoreSteps() {
    try {
      // Don't create steps if we're refreshing inventory
      if (forgeState.isRefreshingInventory) {
        console.log(`[Better Forge] ⏳ Skipping step creation - inventory refresh in progress`);
        return false;
      }
      
      // Get the current selection to know what we're forging
      const { selectedEquipment, selectedTier, selectedStat } = getCurrentSelection();
      if (!selectedEquipment || !selectedTier || !selectedStat) {
        return false;
      }
      
      console.log(`[Better Forge] 🔍 Checking if can create more steps for ${selectedEquipment} ${selectedStat} T${selectedTier}`);
      
      // Check if we've already reached the target tier
      const currentMaxTier = Math.max(...Array.from(forgeState.intermediateResults.keys()), 1);
      if (currentMaxTier >= selectedTier) {
        console.log(`[Better Forge] 🎯 Already reached target tier T${selectedTier}, no more steps needed`);
        return false;
      }
      
      // Check each tier to see if we can create more steps
      for (let tier = 1; tier < selectedTier; tier++) {
        const availableItems = forgeState.intermediateResults.get(tier) || [];
        const itemsNeeded = Math.pow(2, selectedTier - tier - 1);
        const itemsRequired = itemsNeeded * 2; // Need 2 items per pair
        
        console.log(`[Better Forge] 🔍 T${tier}: Have ${availableItems.length}, Need ${itemsRequired} for ${itemsNeeded} pairs`);
        
        if (availableItems.length >= itemsRequired) {
          console.log(`[Better Forge] ✅ T${tier}: Can create ${itemsNeeded} pairs (have ${availableItems.length}, need ${itemsRequired})`);
          return true;
        }
      }
      
      console.log(`[Better Forge] 🔍 No more steps can be created at this time`);
      return false;
      
    } catch (error) {
      console.error('[Better Forge] 💥 Error checking if can create more steps:', error);
      return false;
    }
  }

  function findAvailableItemsForStep(step) {
    try {
      const { fromTier, equipment, stat } = step;
      
      // First, check intermediate results (newly created items)
      const intermediateItemIds = forgeState.intermediateResults.get(fromTier) || [];
      console.log(`[Better Forge] 🔍 Looking for T${fromTier} items: Intermediate IDs:`, intermediateItemIds);
      
      // Then, check user inventory for existing items
      const userInventory = getUserOwnedEquipment();
      const existingItems = userInventory.filter(item => 
        item.name === equipment && 
        item.stat.toLowerCase() === stat.toLowerCase() &&
        item.tier === fromTier
      );
      console.log(`[Better Forge] 🔍 Found ${existingItems.length} existing T${fromTier} items in user inventory`);
      
      // Use intermediate items directly - they were just created by the API, so we can trust them
      const intermediateItems = intermediateItemIds.map(id => {
        // Check if we have the item details from the API response
        const apiItem = forgeState.intermediateResults.get(fromTier)?.find(itemId => itemId === id);
        if (apiItem) {
          console.log(`[Better Forge] ✅ Using newly forged intermediate item ${id} directly from API response`);
          // Create item object from the intermediate results (we know it exists since API succeeded)
          return {
            id: id,
            gameId: 29, // Default game ID
            name: equipment,
            tier: fromTier,
            stat: stat,
            count: 1
          };
        } else {
          console.log(`[Better Forge] ⚠️ Intermediate item ${id} not found in intermediate results, skipping`);
          return null;
        }
      }).filter(Boolean); // Remove null items
      
      // Combine both sources
      const allAvailableItems = [...intermediateItems, ...existingItems];
      console.log(`[Better Forge] 📊 Total available T${fromTier} items: ${allAvailableItems.length} (${intermediateItems.length} intermediate + ${existingItems.length} existing)`);
      
      if (allAvailableItems.length < 2) {
        console.log(`[Better Forge] ⚠️ Insufficient T${fromTier} items: ${allAvailableItems.length} available, need 2`);
        // If we have intermediate items but they're not in inventory yet, wait a bit longer
        if (intermediateItemIds.length > 0 && intermediateItems.length === 0) {
          console.log(`[Better Forge] ⏳ Intermediate items exist but not yet in inventory, will retry later`);
        }
        return null;
      }
      
      // Take the first two available items
      const item1 = allAvailableItems[0];
      const item2 = allAvailableItems[1];
      
      console.log(`[Better Forge] 🔍 Found items for T${fromTier}→T${fromTier + 1}: ${item1.id} + ${item2.id}`);
      
      // Remove these items from their sources
      if (intermediateItemIds.includes(item1.id)) {
        const updatedIntermediate = intermediateItemIds.filter(id => id !== item1.id);
        forgeState.intermediateResults.set(fromTier, updatedIntermediate);
        console.log(`[Better Forge] 🗑️ Removed ${item1.id} from intermediate results for T${fromTier}`);
      }
      if (intermediateItemIds.includes(item2.id)) {
        const updatedIntermediate = intermediateItemIds.filter(id => id !== item2.id);
        forgeState.intermediateResults.set(fromTier, updatedIntermediate);
        console.log(`[Better Forge] 🗑️ Removed ${item2.id} from intermediate results for T${fromTier}`);
      }
      
      // Note: Items are consumed by the forge operation, no need to manually remove from local inventory
      console.log(`[Better Forge] ✅ Items ${item1.id} and ${item2.id} will be consumed by forge operation`);
      
      return { item1, item2 };
      
    } catch (error) {
      console.error('[Better Forge] 💥 Error finding available items for step:', error);
      return null;
    }
  }

  function createNextTierSteps(currentTier, equipment, stat, targetTier) {
    try {
      console.log(`[Better Forge] 🔄 Creating next tier steps for T${currentTier} → T${currentTier + 1}`);
      
      // Get available items at the current tier (including newly forged ones)
      const availableItems = forgeState.intermediateResults.get(currentTier) || [];
      console.log(`[Better Forge] 📦 Available T${currentTier} items:`, availableItems);
      
      if (availableItems.length >= 2) {
        const pairsToForge = Math.floor(availableItems.length / 2);
        const itemsNeeded = Math.pow(2, targetTier - currentTier - 1);
        const actualPairs = Math.min(pairsToForge, itemsNeeded);
        
        console.log(`[Better Forge] 📊 Pairs calculation: Available=${pairsToForge}, Needed=${itemsNeeded}, Actual=${actualPairs}`);
        console.log(`[Better Forge] 🎯 Target tier: ${targetTier}, Current tier: ${currentTier}`);
        
        if (actualPairs > 0) {
          console.log(`[Better Forge] ➕ Creating ${actualPairs} new forging steps`);
          
          // Create new forging steps for this tier
          for (let i = 0; i < actualPairs; i++) {
            const item1Id = availableItems[i * 2];
            const item2Id = availableItems[i * 2 + 1];
            
            const newStep = {
              type: 'forge',
              equipA: item1Id,
              equipB: item2Id,
              fromTier: currentTier,
              toTier: currentTier + 1,
              equipment: equipment,
              stat: stat,
              targetTier: targetTier,
              stepOrder: currentTier
            };
            
            console.log(`[Better Forge] 📝 New step ${i + 1}: T${currentTier} → T${currentTier + 1} using ${item1Id} + ${item2Id}`);
            
            // Add to the front of the queue (higher priority)
            forgeState.forgeQueue.unshift(newStep);
          }
          
          // Remove the consumed items from intermediate results
          const remainingItems = availableItems.slice(actualPairs * 2);
          forgeState.intermediateResults.set(currentTier, remainingItems);
          
          console.log(`[Better Forge] 🔄 Updated intermediate results for T${currentTier}:`, remainingItems);
          console.log(`[Better Forge] 📊 Queue now has ${forgeState.forgeQueue.length} steps`);
          
          // Update progress tracking for new steps
          forgeState.totalSteps = forgeState.forgeQueue.length;
          
          updateAutoUpgradeStatus(`Created ${actualPairs} T${currentTier} → T${currentTier + 1} forging steps`);
        } else {
          console.log(`[Better Forge] ⚠️ No new steps needed for T${currentTier} (${actualPairs} pairs calculated)`);
        }
      } else {
        console.log(`[Better Forge] ⚠️ Insufficient T${currentTier} items (${availableItems.length}) to create new steps`);
        console.log(`[Better Forge] 💡 Need at least 2 items to forge, have ${availableItems.length}`);
      }
    } catch (error) {
      console.error('[Better Forge] 💥 Error creating next tier steps:', error);
    }
  }
  
  // ============================================================================
  // 4. DISENCHANTING PROCESS FUNCTIONS
  // ============================================================================
  
  function performDisenchantStep() {
    try {
      if (forgeState.isDisenchantingInProgress) {
        return;
      }
      
      const col2 = document.getElementById('disenchant-col2');
      if (!col2) return;
      
      const selectedEquipment = col2.querySelectorAll('button[data-equipment-id]');
      if (selectedEquipment.length === 0) {
        const disenchantBtn = getDisenchantButton();
        if (disenchantBtn) {
          stopDisenchanting(disenchantBtn);
        }
        return;
      }
      
      forgeState.isDisenchantingInProgress = true;
      
      const equipmentToProcess = Array.from(selectedEquipment).map(btn => ({
        element: btn,
        id: btn.getAttribute('data-equipment-id')
      }));
      
      processEquipmentWithProgress(equipmentToProcess, 0);
      
      if (forgeState.rateLimitedEquipment.size > 0 && forgeState.isDisenchanting) {
        setTimeout(() => {
          retryFailedDisenchants();
        }, 1000);
      }
      
    } catch (error) {
      handleError(error, 'performDisenchantStep', false);
      forgeState.isDisenchantingInProgress = false;
    }
  }
  
  function processEquipmentWithProgress(equipmentToProcess, currentIndex) {
    if (!forgeState.isDisenchanting || currentIndex >= equipmentToProcess.length) {
      forgeState.isDisenchantingInProgress = false;
      
      if (currentIndex >= equipmentToProcess.length && forgeState.isDisenchanting) {
        const totalDustGained = equipmentToProcess.length * FORGE_CONFIG.DUST_PER_EQUIPMENT;
        showDisenchantCompletionInColumn(totalDustGained);
        
        const disenchantBtn = getDisenchantButton();
        if (disenchantBtn) {
          updateDisenchantButtonState(disenchantBtn, 'normal');
        }
        
        forgeState.isDisenchanting = false;
        forgeState.isDisenchantingInProgress = false;
      }
      return;
    }
    
    const equipment = equipmentToProcess[currentIndex];
    let progressStep = 0;
    const totalSteps = 10;
    
    updateDisenchantProgress(0, totalSteps, currentIndex + 1, equipmentToProcess.length, (currentIndex + 1) * 10);
    
    const progressInterval = setInterval(() => {
      if (!forgeState.isDisenchanting) {
        clearInterval(progressInterval);
        forgeState.isDisenchantingInProgress = false;
        return;
      }
      
      progressStep++;
      updateDisenchantProgress(progressStep, totalSteps, currentIndex + 1, equipmentToProcess.length, (currentIndex + 1) * 10);
      
      if (progressStep >= totalSteps) {
        clearInterval(progressInterval);
        
        executeSingleDisenchant(equipment, () => {
          processEquipmentWithProgress(equipmentToProcess, currentIndex + 1);
        });
      }
    }, 50);
  }
  
  function executeSingleDisenchant(equipment, onComplete) {
    try {
      disenchantEquipment(equipment.id)
        .then(result => {
          if (!forgeState.isDisenchanting) {
            onComplete();
            return;
          }
          
          if (result.success) {
                       equipment.element.remove();
           removeEquipmentFromArsenal(equipment.id);
           removeEquipmentFromLocalInventory(equipment.id);
            const dustGained = FORGE_CONFIG.DUST_PER_EQUIPMENT;
            console.log(`[Better Forge] 💰 Disenchant successful, dust gained:`, dustGained);
            updateLocalInventoryGoldDust(0, dustGained);
            updateDustDisplayWithAnimation(dustGained);
          } else if (result.status === 404) {
            equipment.element.remove();
            removeEquipmentFromArsenal(equipment.id);
            removeEquipmentFromLocalInventory(equipment.id);
          } else if (result.status === 429) {
            const retryCount = forgeState.rateLimitedEquipmentRetryCount.get(equipment.id) || 0;
            if (retryCount < 3) {
              forgeState.rateLimitedEquipment.add(equipment.id);
              forgeState.rateLimitedEquipmentRetryCount.set(equipment.id, retryCount + 1);
            } else {
              equipment.element.remove();
            }
                     } else {
           }
          
          const progressFill = document.getElementById('disenchant-progress-fill');
          const progressText = document.getElementById('disenchant-progress-text');
          if (progressFill) {
            progressFill.style.width = '0%';
            progressFill.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
          }
          if (progressText) {
            progressText.textContent = '0%';
          }
          
          setTimeout(() => {
            onComplete();
          }, 200);
        })
                 .catch(error => {
           console.error(`[Better Forge] Error disenchanting equipment ${equipment.id}:`, error);
           onComplete();
         });
      
    } catch (error) {
      handleError(error, 'executeSingleDisenchant', false);
      onComplete();
    }
  }
  

  

  
  function updateDisenchantProgress(progressStep, totalSteps, itemsCompleted, totalItems, dustGained = 0) {
    try {
      const progressFill = document.getElementById('disenchant-progress-fill');
      const progressText = document.getElementById('disenchant-progress-text');
      const statusText = document.getElementById('disenchant-status');
      
      if (progressFill && progressText && statusText) {
        const progress = totalSteps > 0 ? Math.min(100, (progressStep / totalSteps) * 100) : 0;
        progressFill.style.width = `${progress}%`;
        
        progressText.textContent = `${Math.round(progress)}%`;
        
        let statusMessage;
        if (itemsCompleted === 0) {
          statusMessage = 'Preparing to disenchant...';
        } else if (itemsCompleted < totalItems) {
          statusMessage = `Disenchanting... ${itemsCompleted}/${totalItems} items`;
        } else {
          statusMessage = `Disenchanting... ${itemsCompleted}/${totalItems} items`;
        }
        
        statusText.textContent = statusMessage;
        
        if (progress >= 100) {
          progressFill.style.background = 'linear-gradient(90deg, #4CAF50, #45a049)';
        } else if (progress > 50) {
          progressFill.style.background = 'linear-gradient(90deg, #FF9800, #F57C00)';
        } else {
          progressFill.style.background = 'linear-gradient(90deg, #2196F3, #1976D2)';
        }
      }
    } catch (error) {
      handleError(error, 'updateDisenchantProgress', false);
    }
  }
  
  // ============================================================================
  // 5. API AND NETWORK FUNCTIONS
  // ============================================================================
  
  function disenchantEquipment(equipmentId) {
    return new Promise((resolve, reject) => {
      try {
               const payload = {
          "0": {
            "json": equipmentId
          }
        };
        
               fetch('https://bestiaryarena.com/api/trpc/game.equipToDust?batch=1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Game-Version': '1'
          },
          body: JSON.stringify(payload)
        })
        .then(response => {
          if (!response.ok) {
            if (response.status === 404) {
              return { success: false, status: 404, message: 'Equipment not found' };
            }
            if (response.status === 429) {
              return { success: false, status: 429, message: 'Rate limited' };
            }
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
                 .then(data => {
           try {
             if (data && data.success === false) {
               resolve(data);
               return;
             }
             
             const result = data[0]?.result?.data?.json;
            if (result && result.dustDiff !== undefined) {
              resolve({
                success: true,
                dustGained: result.dustDiff
              });
            } else {
              resolve({
                success: false,
                error: 'Invalid response format'
              });
            }
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse response: ${parseError.message}`
            });
          }
        })
        .catch(error => {
          reject(error);
        });
        
      } catch (error) {
        reject(error);
      }
    });
  }

  // ============================================================================
  // FORGE API FUNCTIONS
  // ============================================================================

  function forgeEquipment(equipA, equipB) {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[Better Forge] 🌐 Forge API call: ${equipA} + ${equipB}`);
        
        // Check rate limit
        if (!checkForgeRateLimit()) {
          console.warn('[Better Forge] ⏰ Rate limit exceeded, request blocked');
          resolve({ success: false, status: 429, message: 'Rate limited' });
          return;
        }

        const payload = {
          "0": {
            "json": {
              "equipA": equipA,
              "equipB": equipB
            }
          }
        };
        
        console.log(`[Better Forge] 📤 Sending payload:`, payload);
        
        fetch('https://bestiaryarena.com/api/trpc/inventory.forgeEquips?batch=1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Game-Version': '1'
          },
          body: JSON.stringify(payload)
        })
        .then(response => {
          console.log(`[Better Forge] 📡 HTTP response status: ${response.status}`);
          
          if (!response.ok) {
            if (response.status === 404) {
              console.error('[Better Forge] ❌ Equipment not found (404)');
              return { success: false, status: 404, message: 'Equipment not found' };
            }
            if (response.status === 429) {
              console.warn('[Better Forge] ⏰ Rate limited (429)');
              return { success: false, status: 429, message: 'Rate limited' };
            }
            console.error(`[Better Forge] ❌ HTTP error: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log(`[Better Forge] 📥 Raw API response:`, data);
          
          try {
            if (data && data.success === false) {
              console.error('[Better Forge] ❌ API returned success: false');
              resolve(data);
              return;
            }
            
            const result = data[0]?.result?.data?.json;
            if (result && result.nextEquip && result.dustDiff !== undefined) {
              console.log(`[Better Forge] ✅ API response parsed successfully:`, result);
              resolve({
                success: true,
                nextEquip: result.nextEquip,
                dustDiff: result.dustDiff
              });
            } else {
              console.error('[Better Forge] ❌ Invalid response format:', result);
              resolve({
                success: false,
                error: 'Invalid response format'
              });
            }
          } catch (parseError) {
            console.error('[Better Forge] 💥 Response parsing error:', parseError);
            resolve({
              success: false,
              error: `Failed to parse response: ${parseError.message}`
            });
          }
        })
        .catch(error => {
          console.error('[Better Forge] 💥 Fetch error:', error);
          reject(error);
        });
        
      } catch (error) {
        console.error('[Better Forge] 💥 Forge equipment error:', error);
        reject(error);
      }
    });
  }

  function checkForgeRateLimit() {
    const now = Date.now();
    const { lastRequest, requestCount, maxRequests, timeWindow } = forgeState.forgeRateLimit;
    
    // Reset counter if time window has passed
    if (now - lastRequest > timeWindow) {
      forgeState.forgeRateLimit.requestCount = 0;
      forgeState.forgeRateLimit.lastRequest = now;
    }
    
    // Check if we're within rate limits
    if (requestCount >= maxRequests) {
      return false;
    }
    
    // Increment counter
    forgeState.forgeRateLimit.requestCount++;
    forgeState.forgeRateLimit.lastRequest = now;
    
    return true;
  }

  function calculateForgeSteps(equipment, stat, targetTier) {
    // Use only the highlighted equipment IDs for forging
    if (forgeState.highlightedEquipment.size === 0) {
      return { canForge: false, steps: [], error: 'No equipment highlighted for forging' };
    }
    
    // Get the actual equipment items from the highlighted IDs
    const userInventory = getUserOwnedEquipment();
    const highlightedItems = Array.from(forgeState.highlightedEquipment)
      .map(id => userInventory.find(item => item.id === id))
      .filter(Boolean);
    
    if (highlightedItems.length === 0) {
      return { canForge: false, steps: [], error: 'Highlighted equipment not found in inventory' };
    }
    
    console.log(`[Better Forge] 🔍 calculateForgeSteps - highlighted items:`, highlightedItems);
    
    // Validate that highlighted items match the expected equipment, stat, and can reach target tier
    const validation = validateHighlightedEquipment(highlightedItems, equipment, stat, targetTier);
    if (!validation.valid) {
      return { canForge: false, steps: [], error: validation.error };
    }
    
    // Group highlighted items by tier
    const itemsByTier = {};
    highlightedItems.forEach(item => {
      if (!itemsByTier[item.tier]) {
        itemsByTier[item.tier] = [];
      }
      itemsByTier[item.tier].push(item);
    });
    
    console.log(`[Better Forge] 📊 User selected items by tier:`, itemsByTier);
    
    // Check if we can directly forge to target tier
    const directTier = targetTier - 1; // We need items from the tier below target
    const directItems = itemsByTier[directTier] || [];
    
    console.log(`[Better Forge] 🔍 Direct forging check: Need T${directTier} items, have ${directItems.length}`);
    
    if (directItems.length >= 2) {
      // We can directly forge from the tier below target
      console.log(`[Better Forge] ✅ Direct forging possible: T${directTier} → T${targetTier}`);
      
      const forgePlan = [];
      for (let i = 0; i < Math.floor(directItems.length / 2); i++) {
        const item1 = directItems[i * 2];
        const item2 = directItems[i * 2 + 1];
        
        forgePlan.push({
          type: 'forge',
          equipA: item1.id,
          equipB: item2.id,
          fromTier: directTier,
          toTier: targetTier,
          equipment: equipment,
          stat: stat,
          stepOrder: 1,
          targetTier: targetTier
        });
      }
      
      console.log(`[Better Forge] 📋 Direct forge plan created: ${forgePlan.length} steps`);
      return { canForge: true, steps: forgePlan };
    }
    
    // Skip T1-equivalent validation - create plan based on what we have
    console.log(`[Better Forge] 📊 Creating forge plan based on available items:`, itemsByTier);
    
    // Create a complete forging plan that accounts for intermediate results
    const forgePlan = [];
    const itemsNeededByTier = {};
    
    // Calculate what we need at each tier
    for (let tier = 1; tier <= targetTier; tier++) {
      itemsNeededByTier[tier] = Math.pow(2, targetTier - tier);
    }
    
    console.log(`[Better Forge] 📊 Items needed by tier:`, itemsNeededByTier);
    
    // Step 1: Create T2 items from T1 items
    const t1Items = (itemsByTier[1] || []).length;
    const t2Needed = itemsNeededByTier[2] || 0; // 8 for T5
    const t2ToCreate = Math.min(Math.floor(t1Items / 2), t2Needed);
    
    console.log(`[Better Forge] 🔍 T1: Have ${t1Items}, Need ${t2Needed * 2} (${t2Needed} pairs)`);
    
    if (t2ToCreate > 0) {
      console.log(`[Better Forge] ➕ Creating ${t2ToCreate} T1→T2 steps`);
      for (let i = 0; i < t2ToCreate; i++) {
        const item1 = itemsByTier[1][i * 2];
        const item2 = itemsByTier[1][i * 2 + 1];
        
        forgePlan.push({
          type: 'forge',
          equipA: item1.id,
          equipB: item2.id,
          fromTier: 1,
          toTier: 2,
          equipment: equipment,
          stat: stat,
          stepOrder: 1,
          targetTier: targetTier
        });
      }
    }
    
    // Step 2: Create T3 items from T2 items (both existing and newly created)
    const t2Items = (itemsByTier[2] || []).length;
    const t3Needed = itemsNeededByTier[3] || 0; // 4 for T5
    const totalT2Available = t2Items + t2ToCreate; // Include newly created T2s
    const t3ToCreate = Math.min(Math.floor(totalT2Available / 2), t3Needed);
    
    console.log(`[Better Forge] 🔍 T2: Have ${t2Items}, Need ${t3Needed * 2} (${t3Needed} pairs), Will create ${t2ToCreate} new`);
    
    if (t3ToCreate > 0) {
      console.log(`[Better Forge] ➕ Creating ${t3ToCreate} T2→T3 steps`);
      // We'll need to create these steps dynamically as T2 items become available
      for (let i = 0; i < t3ToCreate; i++) {
        forgePlan.push({
          type: 'forge',
          equipA: null, // Will be filled dynamically
          equipB: null, // Will be filled dynamically
          fromTier: 2,
          toTier: 3,
          equipment: equipment,
          stat: stat,
          stepOrder: 2,
          targetTier: targetTier,
          needsDynamicItems: true
        });
      }
    }
    
    // Step 3: Create T4 items from T3 items (both existing and newly created)
    const t3Items = (itemsByTier[3] || []).length;
    const t4Needed = itemsNeededByTier[4] || 0; // 2 for T5
    const totalT3Available = t3Items + t3ToCreate; // Include newly created T3s
    const t4ToCreate = Math.min(Math.floor(totalT3Available / 2), t4Needed);
    
    console.log(`[Better Forge] 🔍 T3: Have ${t3Items}, Need ${t4Needed * 2} (${t4Needed} pairs), Will create ${t3ToCreate} new`);
    
    if (t4ToCreate > 0) {
      console.log(`[Better Forge] ➕ Creating ${t4ToCreate} T3→T4 steps`);
      for (let i = 0; i < t4ToCreate; i++) {
        forgePlan.push({
          type: 'forge',
          equipA: null, // Will be filled dynamically
          equipB: null, // Will be filled dynamically
          fromTier: 3,
          toTier: 4,
          equipment: equipment,
          stat: stat,
          stepOrder: 3,
          targetTier: targetTier,
          needsDynamicItems: true
        });
      }
    }
    
    // Step 4: Create T5 from T4 items (both existing and newly created)
    const t4Items = (itemsByTier[4] || []).length;
    const t5Needed = 1; // We only need 1 T5
    const totalT4Available = t4Items + t4ToCreate; // Include newly created T4s
    
    console.log(`[Better Forge] 🔍 T4: Have ${t4Items}, Need 2 (1 pair), Will create ${t4ToCreate} new`);
    
    if (totalT4Available >= 2) {
      console.log(`[Better Forge] ➕ Creating 1 T4→T5 step`);
      forgePlan.push({
        type: 'forge',
        equipA: null, // Will be filled dynamically
        equipB: null, // Will be filled dynamically
        fromTier: 4,
        toTier: 5,
        equipment: equipment,
        stat: stat,
        stepOrder: 4,
        targetTier: targetTier,
        needsDynamicItems: true
      });
    }
    
    // Sort by tier (T1 first, then T2, then T3, etc.)
    forgePlan.sort((a, b) => a.stepOrder - b.stepOrder);
    
    console.log(`[Better Forge] 📋 Complete forge plan: ${forgePlan.length} steps`);
    forgePlan.forEach((step, index) => {
      if (step.needsDynamicItems) {
        console.log(`[Better Forge]   Step ${index + 1}: T${step.fromTier}→T${step.toTier} (dynamic - will be filled later)`);
      } else {
        console.log(`[Better Forge]   Step ${index + 1}: T${step.fromTier}→T${step.toTier} (${step.equipA} + ${step.equipB})`);
      }
    });
    
    return { canForge: true, steps: forgePlan };
  }

  function validateHighlightedEquipment(highlightedItems, expectedEquipment, expectedStat, targetTier) {
    try {
      if (highlightedItems.length === 0) {
        return { valid: false, error: 'No equipment highlighted' };
      }
      
      // Check that all items have the same equipment name and stat
      for (const item of highlightedItems) {
        if (item.name !== expectedEquipment) {
          return { 
            valid: false, 
            error: `Equipment mismatch. Expected: ${expectedEquipment}, Got: ${item.name}` 
          };
        }
        
        if (item.stat.toLowerCase() !== expectedStat.toLowerCase()) {
          return { 
            valid: false, 
            error: `Stat mismatch. Expected: ${expectedStat}, Got: ${item.stat}` 
          };
        }
        
        if (item.tier >= targetTier) {
          return { 
            valid: false, 
            error: `Cannot use T${item.tier} items to forge T${targetTier}` 
          };
        }
      }
      
      // Check that we have enough items to reach the target tier
      const itemsByTier = {};
      highlightedItems.forEach(item => {
        if (!itemsByTier[item.tier]) {
          itemsByTier[item.tier] = [];
        }
        itemsByTier[item.tier].push(item);
      });
      
      const totalT1Equivalent = calculateT1Equivalents(itemsByTier);
      const totalT1Needed = Math.pow(2, targetTier - 1);
      
      if (totalT1Equivalent < totalT1Needed) {
        return { 
          valid: false, 
          error: `Insufficient materials. Need ${totalT1Needed} T1 equivalents, have ${totalT1Equivalent}` 
        };
      }
      
      return { valid: true };
      
    } catch (error) {
      return { valid: false, error: `Validation error: ${error.message}` };
    }
  }
  
  // ============================================================================
  // 6. UI UPDATE AND DISPLAY FUNCTIONS
  // ============================================================================
  
  function showDisenchantCompletionInColumn(totalDustGained) {
    try {
      const col2 = document.getElementById('disenchant-col2');
      if (!col2) return;
      
      col2.innerHTML = '<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 7;">Click equipment in Arsenal to select for disenchant</div>';
      
      const disenchantBtn = getDisenchantButton();
      if (disenchantBtn) {
        updateDisenchantButtonState(disenchantBtn, 'normal');
      }
      
      forgeState.isDisenchanting = false;
      forgeState.isDisenchantingInProgress = false;
      
      updateDisenchantStatus(`Disenchanting completed! Gained ${totalDustGained} dust`);
      
    } catch (error) {
      handleError(error, 'showDisenchantCompletionInColumn', false);
    }
  }
  
  function removeEquipmentFromArsenal(equipmentId) {
    try {
      const arsenalButtons = document.querySelectorAll('button[data-equipment-id]');
      for (const btn of arsenalButtons) {
        if (btn.getAttribute('data-equipment-id') === equipmentId) {
          btn.remove();
          break;
        }
      }
    } catch (error) {
      handleError(error, 'removeEquipmentFromArsenal', false);
    }
  }
  
  function restoreEquipmentToArsenalById(equipmentId) {
    try {
      const arsenalButtons = document.querySelectorAll('button[data-equipment-id]');
      for (const btn of arsenalButtons) {
        if (btn.getAttribute('data-equipment-id') === equipmentId) {
          btn.style.display = 'flex';
          break;
        }
      }
    } catch (error) {
      handleError(error, 'restoreEquipmentToArsenalById', false);
    }
  }
  
  async function retryFailedDisenchants() {
    if (forgeState.rateLimitedEquipment.size === 0) return;
    
    const equipmentToRetry = Array.from(forgeState.rateLimitedEquipment);
    
    for (const equipmentId of equipmentToRetry) {
      const retryCount = forgeState.rateLimitedEquipmentRetryCount.get(equipmentId) || 0;
      if (retryCount >= 3) {
        forgeState.rateLimitedEquipment.delete(equipmentId);
        forgeState.rateLimitedEquipmentRetryCount.delete(equipmentId);
        continue;
      }
      
      try {
        const result = await disenchantEquipment(equipmentId);
        if (result.success) {
          forgeState.rateLimitedEquipment.delete(equipmentId);
          forgeState.rateLimitedEquipmentRetryCount.delete(equipmentId);
          removeEquipmentFromArsenal(equipmentId);
          removeEquipmentFromLocalInventory(equipmentId);
        } else if (result.status === 429) {
          forgeState.rateLimitedEquipmentRetryCount.set(equipmentId, retryCount + 1);
        } else {
          forgeState.rateLimitedEquipment.delete(equipmentId);
          forgeState.rateLimitedEquipmentRetryCount.delete(equipmentId);
        }
      } catch (error) {
        forgeState.rateLimitedEquipment.delete(equipmentId);
        forgeState.rateLimitedEquipmentRetryCount.delete(equipmentId);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // ============================================================================
  // 7. UI COMPONENT CREATION FUNCTIONS
  // ============================================================================
  
  // Helper function to create fallback equipment icon
  function createEquipmentFallbackIcon(container, equipment) {
    const fallbackDiv = document.createElement('div');
    fallbackDiv.style.cssText = 'width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: #e6d7b0; font-size: 10px; text-align: center; border: 1px solid #666; background: rgba(255,255,255,0.05);';
    fallbackDiv.textContent = equipment.substring(0, 3);
    container.appendChild(fallbackDiv);
  }
  
  // Generate equipment list dynamically from game data
  function generateEquipmentList() {
    const equipmentList = [];
    const utils = globalThis.state?.utils;
    
    if (!utils) {
      // Fallback to hardcoded list if game data is unavailable
      return ['Amazon Armor', 'Amazon Helmet', 'Amazon Shield', 'Amulet of Loss', 'Bear Skin', 'Bloody Edge', 'Blue Robe', 'Bonelord Helmet', 'Boots of Haste', 'Chain Bolter', 'Cranial Basher', 'Dwarven Helmet', 'Dwarven Legs', 'Ectoplasmic Shield', 'Epee', 'Fire Axe', 'Giant Sword', 'Glacial Rod', 'Glass of Goo', 'Hailstorm Rod', 'Ice Rapier', 'Jester Hat', 'Medusa Shield', 'Ratana', 'Royal Scale Robe', 'Rubber Cap', 'Skull Helmet', 'Skullcracker Armor', 'Springsprout Rod', 'Steel Boots', 'Stealth Ring', 'Vampire Shield', 'Wand of Decay', 'White Skull'];
    }
    
    // Iterate through all equipment IDs in the game
    for (let i = 1; ; i++) {
      try {
        const equipData = utils.getEquipment(i);
        if (equipData && equipData.metadata && equipData.metadata.name) {
          equipmentList.push(equipData.metadata.name);
        } else {
          break; // No more equipment
        }
      } catch {
        break; // Error or end of equipment
      }
    }
    
    // If no equipment found, fall back to hardcoded list
    if (equipmentList.length === 0) {
      return ['Amazon Armor', 'Amazon Helmet', 'Amazon Shield', 'Amulet of Loss', 'Bear Skin', 'Bloody Edge', 'Blue Robe', 'Bonelord Helmet', 'Boots of Haste', 'Chain Bolter', 'Cranial Basher', 'Dwarven Helmet', 'Dwarven Legs', 'Ectoplasmic Shield', 'Epee', 'Fire Axe', 'Giant Sword', 'Glacial Rod', 'Glass of Goo', 'Hailstorm Rod', 'Ice Rapier', 'Jester Hat', 'Medusa Shield', 'Ratana', 'Royal Scale Robe', 'Rubber Cap', 'Skull Helmet', 'Skullcracker Armor', 'Springsprout Rod', 'Steel Boots', 'Stealth Ring', 'Vampire Shield', 'Wand of Decay', 'White Skull'];
    }
    
    return equipmentList.sort(); // Alphabetical order
  }
  
  // Generic selection handler factory
  function createSelectionHandler(type, value, updateFunction) {
    return (event) => {
      console.log(`[Better Forge] 🔍 Selection handler called:`, { type, value });
      
      // Clear previous selection based on type
      const container = document.getElementById(`auto-upgrade-${type}-col`);
      if (container) {
        container.querySelectorAll('div').forEach(div => {
          div.classList.remove('selected');
        });
      }
      
      // Apply selection styling to clicked element
      let clickedElement = event.target.closest('div');
      
      // For equipment items, we need to find the parent div with the title attribute
      if (type === 'equipment' && clickedElement) {
        // Look for the div that has the title attribute (the equipment container)
        while (clickedElement && !clickedElement.title) {
          clickedElement = clickedElement.parentElement;
        }
      }
      
      if (clickedElement) {
        clickedElement.classList.add('selected');
      }
      
      // Update centralized state
      const currentState = getCurrentSelection();
      const newState = { ...currentState };
      
      if (type === 'equipment') {
        newState.selectedEquipment = value;
      } else if (type === 'tiers') {
        newState.selectedTier = value;
      } else if (type === 'stats') {
        newState.selectedStat = value;
      }
      
      console.log(`[Better Forge] 🔄 Selection state updated:`, { from: currentState, to: newState });
      
      updateAutoUpgradeSelection(newState.selectedEquipment, newState.selectedTier, newState.selectedStat);
      
      // Call custom update function if provided
      if (updateFunction) {
        updateFunction(value);
      }
    };
  }
  
  function createBox({title, content}) {
    const box = document.createElement('div');
    box.style.flex = '1 1 0';
    box.style.display = 'flex';
    box.style.flexDirection = 'column';
    box.style.margin = '0';
    box.style.padding = '0';
    box.style.minHeight = '0';
    box.style.height = '100%';
    box.style.background = "url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat";
    box.style.border = '4px solid transparent';
    box.style.borderImage = `url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch`;
    box.style.borderRadius = '6px';
    box.style.overflow = 'hidden';
    
    const titleEl = document.createElement('h2');
    titleEl.className = 'widget-top widget-top-text pixel-font-16';
    titleEl.style.margin = '0';
    titleEl.style.padding = '2px 8px';
    titleEl.style.textAlign = 'center';
    titleEl.style.color = 'rgb(255, 255, 255)';
    
    const p = document.createElement('p');
    p.textContent = title;
    p.className = 'pixel-font-16';
    p.style.margin = '0';
    p.style.padding = '0';
    p.style.textAlign = 'center';
    p.style.color = 'rgb(255, 255, 255)';
    titleEl.appendChild(p);
    box.appendChild(titleEl);
    
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'column-content-wrapper';
    contentWrapper.style.flex = '1 1 0';
    contentWrapper.style.height = '100%';
    contentWrapper.style.minHeight = '0';
    contentWrapper.style.overflowY = 'auto';
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.alignItems = 'center';
    contentWrapper.style.justifyContent = 'center';
    contentWrapper.style.padding = '0';
    
    if (typeof content === 'string') {
      contentWrapper.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentWrapper.appendChild(content);
    }
    box.appendChild(contentWrapper);
    return box;
  }

  // ============================================================================
  // 8. FORGE CALCULATION FUNCTIONS
  // ============================================================================
  
  function calculateForgeRequirements(targetTier, currentTier = 1) {
    console.log(`[Better Forge] 🔍 calculateForgeRequirements called with:`, { targetTier, currentTier });
    
    if (targetTier <= currentTier) {
      console.log(`[Better Forge] ⚠️ Invalid tier: target ${targetTier} <= current ${currentTier}`);
      return { items: 0, tiers: [] };
    }
    
    // Calculate total T1 items needed: 2^(targetTier - 1)
    const requirements = {
      items: Math.pow(2, targetTier - 1),
      tiers: []
    };
    
    console.log(`[Better Forge] 📊 Total T1 items needed: ${requirements.items} (2^${targetTier - 1})`);
    
    // Calculate the forging steps needed
    for (let tier = 1; tier < targetTier; tier++) {
      const itemsNeeded = Math.pow(2, targetTier - tier - 1);
      requirements.tiers.push({
        tier: tier + 1,
        items: itemsNeeded
      });
      console.log(`[Better Forge] 📋 T${tier + 1}: Need ${itemsNeeded} items (2^${targetTier - tier - 1})`);
    }
    
    console.log(`[Better Forge] 📋 Complete requirements:`, requirements);
    return requirements;
  }
  
    function updateDetailsDisplay(equipment, tier, stat) {
    try {
      console.log(`[Better Forge] 🔍 updateDetailsDisplay called with:`, { equipment, tier, stat });
      
      const detailsContent = document.getElementById('auto-upgrade-details-col');
      if (!detailsContent) return;
      
      // Only skip inventory analysis if we're actively forging
      if (forgeState.isForging === true) {
        console.log(`[Better Forge] ⏸️ Forging in progress, skipping inventory analysis`);
        return;
      }
      
      if (!equipment || !tier || !stat) {
        console.log(`[Better Forge] ⚠️ Missing selection: equipment=${equipment}, tier=${tier}, stat=${stat}`);
        detailsContent.innerHTML = '<div style="color: #888888; font-size: 11px; text-align: center;">Select equipment, tier, and stat to see result</div>';
        updateForgeButtonColor(null); // Reset to default (grey)
        updateAutoUpgradeStatus('Select equipment, tier, and stat to upgrade');
        return;
      }
      
      const requirements = calculateForgeRequirements(tier, 1);
      console.log(`[Better Forge] 📊 Forge requirements:`, requirements);
      
      if (requirements.items === 0) {
        detailsContent.innerHTML = '<div style="color: #888888; font-size: 11px; text-align: center;">Invalid tier selection</div>';
        updateForgeButtonColor(null); // Reset to default (grey)
        updateAutoUpgradeStatus('Invalid tier selection');
        return;
      }
      
      // Create equipment icon container
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = 'display: flex; justify-content: center; margin-bottom: 6px; margin-top: 4px;';
      
      // Get equipment game ID and create icon
      const equipmentMap = buildEquipmentMap();
      const gameId = equipmentMap.get(equipment.toLowerCase());
      
      if (gameId && globalThis.state?.utils?.getEquipment) {
        try {
          const equipData = globalThis.state.utils.getEquipment(gameId);
          if (equipData && equipData.metadata && equipData.metadata.spriteId && api?.ui?.components?.createItemPortrait) {
            const itemPortrait = api.ui.components.createItemPortrait({
              itemId: equipData.metadata.spriteId,
              stat: stat,
              tier: tier,
              onClick: () => {} // No action needed for display
            });
            
            iconContainer.appendChild(itemPortrait);
          } else {
            createEquipmentFallbackIcon(iconContainer, equipment);
          }
        } catch (e) {
          console.warn(`[Better Forge] Error creating equipment icon for ${equipment}:`, e);
          createEquipmentFallbackIcon(iconContainer, equipment);
        }
      } else {
        // Fallback to text if no game ID found
        createEquipmentFallbackIcon(iconContainer, equipment);
      }
      
      // Check if forging is possible
      const userInventory = getUserOwnedEquipment();
      console.log(`[Better Forge] 📦 User inventory for forging check:`, userInventory);
      
      const matchingItems = userInventory.filter(item => 
        item.name === equipment && 
        item.stat && 
        item.stat.toLowerCase() === stat.toLowerCase() &&
        item.tier < 5 && // Exclude T5 items completely
        item.tier < tier // Exclude target tier items
      );
      
      console.log(`[Better Forge] 🔍 Matching items for forging:`, matchingItems);
      
      const itemsByTier = {};
      matchingItems.forEach(item => {
        if (!itemsByTier[item.tier]) {
          itemsByTier[item.tier] = 0;
        }
        itemsByTier[item.tier]++;
      });
      
      const canForge = checkIfCanForge(itemsByTier, tier);
      
      // Create status message
      const statusDiv = document.createElement('div');
      statusDiv.style.cssText = 'font-size: 11px; text-align: center; font-weight: bold; margin-top: 4px;';
      
      if (canForge.canForge) {
        const dustCost = calculateDustCost(equipment, stat, tier);
        const userDust = getUserCurrentDust();
        
        if (userDust >= dustCost) {
          statusDiv.style.color = '#4CAF50'; // Green
          statusDiv.textContent = `Cost: ${dustCost} dust`;
          // Update forge button color - can forge
          updateForgeButtonColor(true);
        } else {
          statusDiv.style.color = '#ff4444'; // Red
          statusDiv.textContent = 'Not enough dust';
          // Update forge button color - cannot forge
          updateForgeButtonColor(false);
        }
        
        // Calculate and display forge plan
        const { steps, error } = calculateForgeSteps(equipment, stat, tier);
        
        if (steps && steps.length > 0) {
          // Create forge plan display
          const planDiv = document.createElement('div');
          planDiv.style.cssText = 'margin-top: 8px; padding: 8px; background: rgba(0,0,0,0.1); border-radius: 4px; font-size: 10px;';
          
          const planTitle = document.createElement('div');
          planTitle.style.cssText = 'font-weight: bold; margin-bottom: 4px; color: #4CAF50;';
          planTitle.textContent = 'Forge Plan:';
          planDiv.appendChild(planTitle);
          
          steps.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.style.cssText = 'margin: 2px 0; color: #888;';
            
            // Handle dynamic steps that haven't been populated yet
            if (step.equipA && step.equipB && step.result) {
              stepDiv.textContent = `Step ${index + 1}: T${step.equipA.tier} → T${step.equipB.tier} = T${step.result.tier}`;
            } else {
              // Show the planned tier progression
              const fromTier = step.fromTier || '?';
              const toTier = step.toTier || '?';
              const resultTier = step.resultTier || '?';
              stepDiv.textContent = `Step ${index + 1}: T${fromTier} → T${toTier} = T${resultTier}`;
            }
            
            planDiv.appendChild(stepDiv);
          });
          
          detailsContent.appendChild(planDiv);
        }
      } else {
        statusDiv.style.color = '#ff4444'; // Red
        statusDiv.textContent = 'Not enough items';
        // Update forge button color - cannot forge
        updateForgeButtonColor(false);
      }
        
        // Clear and populate content
      detailsContent.innerHTML = '';
      detailsContent.appendChild(iconContainer);
      detailsContent.appendChild(statusDiv);
      
      // Update status based on inventory
      updateAutoUpgradeStatusBasedOnInventory(equipment, tier, stat);
      
      // Highlight equipment that will be consumed
      highlightEquipmentForForging(equipment, stat, tier);
      
    } catch (error) {
      console.error('[Better Forge] Error updating details display:', error);
      const detailsContent = document.getElementById('auto-upgrade-details-col');
      if (detailsContent) {
        detailsContent.innerHTML = '<div style="color: #ff4444; font-size: 11px; text-align: center;">Error calculating requirements</div>';
      }
    }
  }

  // ============================================================================
  // 9. INVENTORY CHECKING AND STATUS FUNCTIONS
  // ============================================================================
  
  function getUserCurrentDust() {
    try {
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      return playerContext?.dust || 0;
    } catch (error) {
      console.error('[Better Forge] Error getting user dust:', error);
      return 0;
    }
  }
  
  // Shared forge calculation utilities
  function getMatchingInventoryItems(equipment, stat, targetTier = null) {
    const userInventory = getUserOwnedEquipment();
    
    // Get newly forged items from intermediate results
    const intermediateItems = [];
    for (let tier = 1; tier <= 4; tier++) {
      const intermediateIds = forgeState.intermediateResults.get(tier) || [];
      intermediateIds.forEach(id => {
        // Create placeholder item for intermediate results
        intermediateItems.push({
          id: id,
          gameId: 29, // Default game ID
          name: equipment,
          tier: tier,
          stat: stat,
          count: 1
        });
      });
    }

    
    // Combine user inventory with newly forged items
    const allItems = [...userInventory, ...intermediateItems];
    
    const filteredItems = allItems.filter(item => 
      item.name === equipment && 
      item.stat && 
      item.stat.toLowerCase() === stat.toLowerCase() &&
      item.tier < 5 && // Exclude T5 items
      (targetTier === null || item.tier < targetTier) // Exclude target tier items
    );
    
    return filteredItems;
  }
  
  function groupItemsByTier(items) {
    const itemsByTier = {};
    items.forEach(item => {
      if (!itemsByTier[item.tier]) {
        itemsByTier[item.tier] = [];
      }
      itemsByTier[item.tier].push(item);
    });
    
    return itemsByTier;
  }
  
  function calculateT1Equivalents(itemsByTier) {
    let total = 0;
    Object.keys(itemsByTier).forEach(tier => {
      const tierNum = parseInt(tier);
      const count = Array.isArray(itemsByTier[tierNum]) ? itemsByTier[tierNum].length : (itemsByTier[tierNum] || 0);
      const t1Value = Math.pow(2, tierNum - 1);
      const tierContribution = (count || 0) * t1Value;
      
      total += tierContribution;
    });
    
    return total;
  }
  
  function calculateItemsToConsume(equipment, stat, targetTier) {
    const matchingItems = getMatchingInventoryItems(equipment, stat, targetTier);
    const itemsByTier = groupItemsByTier(matchingItems);
    
    // Calculate total T1 equivalents needed
    const totalT1Needed = Math.pow(2, targetTier - 1);
    const existingT1Equivalent = calculateT1Equivalents(itemsByTier);
    
    // If we don't have enough items, return empty array
    if (existingT1Equivalent < totalT1Needed) {
      return [];
    }
    
    // Calculate which items to consume, prioritizing higher tiers
    const itemsToConsume = [];
    let remainingT1Needed = totalT1Needed;
    
    // Start from highest tier and work down (excluding T5)
    for (let tier = Math.min(targetTier - 1, 4); tier >= 1; tier--) {
      const availableItems = itemsByTier[tier] || [];
      if (availableItems.length > 0 && remainingT1Needed > 0) {
        const t1Value = Math.pow(2, tier - 1);
        const maxCanUse = Math.min(availableItems.length, Math.floor(remainingT1Needed / t1Value));
        
        if (maxCanUse > 0) {
          // Add the items that will be consumed
          for (let i = 0; i < maxCanUse; i++) {
            itemsToConsume.push(availableItems[i]);
          }
          remainingT1Needed -= maxCanUse * t1Value;
        }
      }
    }
    
    return itemsToConsume;
  }
  
  function calculateDustCost(equipment, stat, targetTier) {
    // Calculate dust cost based on actual forging steps needed
    // 2x T1 to 1x T2 = 50 dust
    // 2x T2 to 1x T3 = 100 dust
    // 2x T3 to 1x T4 = 150 dust
    // 2x T4 to 1x T5 = 200 dust
    
    const matchingItems = getMatchingInventoryItems(equipment, stat, targetTier);
    const itemsByTier = groupItemsByTier(matchingItems);
    
    // Convert to count-based format for dust calculation
    const itemsByTierCount = {};
    Object.keys(itemsByTier).forEach(tier => {
      itemsByTierCount[tier] = itemsByTier[tier].length;
    });
    
    // Calculate total T1 equivalents needed
    const totalT1Needed = Math.pow(2, targetTier - 1);
    const existingT1Equivalent = calculateT1Equivalents(itemsByTier);
    
    // If we don't have enough items, return 0 (can't forge)
    if (existingT1Equivalent < totalT1Needed) {
      return 0;
    }
    
    // Calculate cost for each forging step, accounting for existing inventory
    let totalCost = 0;
    let itemsNeeded = {};
    let itemsAvailable = {};
    
    // Initialize what we need and what we have
    for (let tier = 1; tier <= targetTier; tier++) {
      itemsNeeded[tier] = Math.pow(2, targetTier - tier);
      itemsAvailable[tier] = itemsByTierCount[tier] || 0;
    }
    
    // Calculate actual forging operations needed, accounting for higher tier contributions
    for (let tier = 1; tier < targetTier; tier++) {
      const nextTier = tier + 1;
      
      // How many items we need at the next tier
      let neededAtNextTier = itemsNeeded[nextTier];
      
      // How many we already have at the next tier
      let haveAtNextTier = itemsAvailable[nextTier];
      
      // Account for higher tier items that can contribute to this tier's needs
      for (let higherTier = nextTier + 1; higherTier <= targetTier; higherTier++) {
        const higherTierItems = itemsAvailable[higherTier] || 0;
        const contribution = higherTierItems * Math.pow(2, higherTier - nextTier);
        neededAtNextTier = Math.max(0, neededAtNextTier - contribution);
      }
      
      // How many we need to forge at this tier
      const needToForge = Math.max(0, neededAtNextTier - haveAtNextTier);
      
      // Each forging operation consumes 2 items and produces 1
      const forgingOperations = needToForge;
      
      // Add cost for this tier's forging operations
      const costPerOperation = 50 * tier; // T1->T2=50, T2->T3=100, etc.
      totalCost += forgingOperations * costPerOperation;
    }
    
    return totalCost;
  }
  
  function updateAutoUpgradeStatus(message) {
    try {
      const statusText = document.getElementById('auto-upgrade-status');
      if (statusText) {
        statusText.textContent = message;
      }
    } catch (error) {
      console.error('[Better Forge] Error updating auto-upgrade status:', error);
    }
  }

  function updateAutoUpgradeStatusElement(element) {
    try {
      const statusText = document.getElementById('auto-upgrade-status');
      if (statusText) {
        statusText.innerHTML = '';
        statusText.appendChild(element);
      }
    } catch (error) {
      console.error('[Better Forge] Error updating auto-upgrade status element:', error);
    }
  }

  function updateForgeButtonColor(canForge) {
    try {
      const forgeBtn = document.getElementById('auto-upgrade-forge-btn');
      if (!forgeBtn) return;
      
      if (canForge === true) {
        forgeBtn.style.color = '#4CAF50'; // Green
      } else if (canForge === false) {
        forgeBtn.style.color = '#ff4444'; // Red
      } else {
        forgeBtn.style.color = '#888888'; // Grey (default)
      }
    } catch (error) {
      console.error('[Better Forge] Error updating forge button color:', error);
    }
  }
  
  function highlightEquipmentForForging(equipment, stat, targetTier) {
    try {
      // Clear previous highlights and tracked equipment
      forgeState.highlightedEquipment.clear();
      const allEquipmentButtons = document.querySelectorAll('button[data-equipment-id]');
      allEquipmentButtons.forEach(btn => {
        btn.style.background = 'none';
        btn.style.border = 'none';
        btn.style.position = 'static';
        btn.style.zIndex = 'auto';
        
        // Also reset the inner equipment portrait
        const equipmentPortrait = btn.querySelector('.equipment-portrait');
        if (equipmentPortrait) {
          equipmentPortrait.style.background = '';
          equipmentPortrait.style.position = '';
          equipmentPortrait.style.zIndex = '';
          
          // Remove stripe overlay
          const stripeOverlay = equipmentPortrait.querySelector('.stripe-overlay');
          if (stripeOverlay) {
            stripeOverlay.remove();
          }
        }
      });
      
      // If no equipment, tier, or stat selected, don't highlight anything
      if (!equipment || !stat || !targetTier) {
        return;
      }
      
      // Calculate which items will be consumed (excludes target tier items)
      const itemsToConsume = calculateItemsToConsume(equipment, stat, targetTier);
      
      // Highlight the items that will be consumed and track their IDs
      itemsToConsume.forEach(item => {
        const equipmentButton = document.querySelector(`button[data-equipment-id="${item.id}"]`);
        if (equipmentButton) {
          // Track this equipment ID for forging
          forgeState.highlightedEquipment.add(item.id);
          
          // Find the inner equipment portrait element
          const equipmentPortrait = equipmentButton.querySelector('.equipment-portrait');
          if (equipmentPortrait) {
            // Create an overlay div for the stripes
            let stripeOverlay = equipmentPortrait.querySelector('.stripe-overlay');
            if (!stripeOverlay) {
              stripeOverlay = document.createElement('div');
              stripeOverlay.className = 'stripe-overlay';
              stripeOverlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 4px,
                  rgba(255, 0, 0, 0.3) 4px,
                  rgba(255, 0, 0, 0.3) 8px
                );
                z-index: 100;
                pointer-events: none;
              `;
              equipmentPortrait.appendChild(stripeOverlay);
            }
          }
          
          equipmentButton.style.border = '2px solid #ff4444';
          equipmentButton.style.position = 'relative';
          equipmentButton.style.zIndex = '10';
        }
      });
      
    } catch (error) {
      console.error('[Better Forge] Error highlighting equipment for forging:', error);
    }
  }
  
  // Centralized state management functions
  function updateAutoUpgradeSelection(equipment, tier, stat) {
    console.log(`[Better Forge] 🔍 updateAutoUpgradeSelection called with:`, { equipment, tier, stat });
    
    // Reset forge confirmation mode if user changes selection
    if (forgeState.isForgeConfirmationMode) {
      console.log(`[Better Forge] 🔄 Forge confirmation mode reset due to equipment selection change: ${equipment} ${stat} T${tier}`);
    }
    resetForgeConfirmationModeIfActive();
    
    autoUpgradeState.selectedEquipment = equipment;
    autoUpgradeState.selectedTier = tier;
    autoUpgradeState.selectedStat = stat;
    
    console.log(`[Better Forge] 📝 Auto-upgrade state updated:`, autoUpgradeState);
    
    // Update details display with new selection
    updateDetailsDisplay(equipment, tier, stat);
  }
  
  function getCurrentSelection() {
    return {
      selectedEquipment: autoUpgradeState.selectedEquipment,
      selectedTier: autoUpgradeState.selectedTier,
      selectedStat: autoUpgradeState.selectedStat
    };
  }
  
  function clearAutoUpgradeSelection() {
    // Reset forge confirmation mode if clearing selection
    if (forgeState.isForgeConfirmationMode) {
      console.log('[Better Forge] 🔄 Forge confirmation mode reset due to selection cleared');
    }
    resetForgeConfirmationModeIfActive();
    
    autoUpgradeState.selectedEquipment = null;
    autoUpgradeState.selectedTier = null;
    autoUpgradeState.selectedStat = null;
    forgeState.highlightedEquipment.clear();
  }
  
  function reapplyHighlighting() {
    // Re-apply highlighting based on current selection
    const { selectedEquipment, selectedTier, selectedStat } = getCurrentSelection();
    if (selectedEquipment && selectedTier && selectedStat) {
      highlightEquipmentForForging(selectedEquipment, selectedStat, selectedTier);
    }
  }

    function createEquipmentIcon(equipmentName, stat, tier, count = 1, gameId = null) {
    
    const container = document.createElement('div');
    container.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin: 0 1px;
    `;

    // Create equipment portrait
    const portrait = document.createElement('div');
    portrait.style.cssText = `
      position: relative;
      width: 34px;
      height: 34px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.3);
      margin-top: 4px;
    `;

    // Add rarity background using the game's rarity system
    const rarityBg = document.createElement('div');
    rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
    rarityBg.setAttribute('data-rarity', Math.min(5, tier));
    portrait.appendChild(rarityBg);

    // Simplified sprite creation using the game's existing system
    let spriteAdded = false;
    try {
      // Get the correct gameId - try to find any item with the same equipment name, regardless of stat
      let targetGameId = gameId;
      if (!targetGameId) {
        const userInventory = getUserOwnedEquipment();
        // First try to find exact match (name + stat)
        let matchingItem = userInventory.find(item => 
          item.name === equipmentName && item.stat && item.stat.toLowerCase() === stat.toLowerCase()
        );
        
        // If no exact match, try to find any item with the same equipment name
        if (!matchingItem) {
          matchingItem = userInventory.find(item => item.name === equipmentName);
        }
        
        targetGameId = matchingItem ? matchingItem.gameId : null;
      }

      if (targetGameId && globalThis.state?.utils?.getEquipment) {
        const equipData = globalThis.state.utils.getEquipment(targetGameId);
        if (equipData?.metadata?.spriteId) {
          // Use the game's sprite system directly
          const spriteContainer = document.createElement('div');
          spriteContainer.className = `sprite item id-${equipData.metadata.spriteId}`;
          
          const viewport = document.createElement('div');
          viewport.className = 'viewport';
          
          const img = document.createElement('img');
          img.alt = equipmentName;
          img.className = 'spritesheet';
          img.setAttribute('data-cropped', 'false');
          img.style.cssText = '--cropX: 0; --cropY: 0';
          
          viewport.appendChild(img);
          spriteContainer.appendChild(viewport);
          spriteContainer.style.cssText = `
            width: 30px;
            height: 30px;
          `;
          portrait.appendChild(spriteContainer);
          spriteAdded = true;
        }
      }
    } catch (e) {
      // Silently handle sprite creation errors
    }
    
    // Fallback to text if no sprite was added
    if (!spriteAdded) {
      const text = document.createElement('span');
      text.textContent = equipmentName.charAt(0).toUpperCase();
      text.style.cssText = `
        color: white;
        font-size: 12px;
        font-weight: bold;
      `;
      portrait.appendChild(text);
    }

    // Add stat icon
    const statIcon = document.createElement('img');
    statIcon.style.cssText = `
      position: absolute;
      bottom: -2px;
      left: -2px;
      width: 12px;
      height: 12px;
      image-rendering: pixelated;
    `;
    
    const statType = stat.toLowerCase();
    if (statType === 'ad' || statType === 'attackdamage') {
      statIcon.src = '/assets/icons/attackdamage.png';
    } else if (statType === 'ap' || statType === 'abilitypower') {
      statIcon.src = '/assets/icons/abilitypower.png';
    } else if (statType === 'hp' || statType === 'health') {
      statIcon.src = '/assets/icons/heal.png';
    } else if (statType === 'armor') {
      statIcon.src = '/assets/icons/armor.png';
    } else if (statType === 'mr' || statType === 'magicresist') {
      statIcon.src = '/assets/icons/magicresist.png';
    } else {
      statIcon.src = '/assets/icons/attackdamage.png';
    }
    portrait.appendChild(statIcon);

    // Add quantity label (replacing tier label)
    const quantityLabel = document.createElement('div');
    quantityLabel.textContent = `x${count}`;
    quantityLabel.style.cssText = `
      position: absolute;
      top: -8px;
      right: -8px;
      color: white;
      font-size: 12px;
      font-weight: bold;
      padding: 1px 3px;
      border-radius: 2px;
      min-width: 12px;
      text-align: center;
      z-index: 10;
      margin-top: 8px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
    `;
    
    // Set quantity label background color based on tier
    const tierColors = {
      1: '#999999', // Gray
      2: '#2ecc71', // Green
      3: '#3498db', // Blue
      4: '#9b59b6', // Purple
      5: '#f39c12'  // Orange
    };
    quantityLabel.style.background = tierColors[tier] || '#999999';
    portrait.appendChild(quantityLabel);

    container.appendChild(portrait);

    return container;
  }

  // Unified forge path visualization function
  function createForgePathVisualization(equipment, stat, targetTier, forgeSteps, isMissing = false) {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      align-items: center;
      gap: 2px;
      flex-wrap: wrap;
      color: white;
      font-size: 12px;
    `;

    // Get gameId from existing inventory data
    const userInventory = getUserOwnedEquipment();
    let matchingItem = userInventory.find(item => 
      item.name === equipment && item.stat && item.stat.toLowerCase() === stat.toLowerCase()
    );
    
    // If no exact match, try to find any item with the same equipment name
    if (!matchingItem) {
      matchingItem = userInventory.find(item => item.name === equipment);
    }
    
    const gameId = matchingItem ? matchingItem.gameId : null;

    if (isMissing) {
      // Show missing items display
      const missingLabel = document.createElement('span');
      missingLabel.textContent = 'Need: ';
      missingLabel.style.cssText = `
        color: #ff4444;
        font-weight: bold;
      `;
      container.appendChild(missingLabel);

      // Calculate total T1 items needed for the target tier
      const totalT1Needed = Math.pow(2, targetTier - 1);
      
      // Convert user's existing items to T1 equivalents and subtract (excluding T5 items)
      const matchingItems = userInventory.filter(item => 
        item.name === equipment && 
        item.stat && 
        item.stat.toLowerCase() === stat.toLowerCase() &&
        item.tier < 5 // Exclude T5 items completely
      );
      
      let existingT1Equivalent = 0;
      matchingItems.forEach(item => {
        existingT1Equivalent += item.count * Math.pow(2, item.tier - 1);
      });
      
      const actualT1Needed = Math.max(0, totalT1Needed - existingT1Equivalent);
      
      // Show T1 → target tier
      const t1Item = createEquipmentIcon(equipment, stat, 1, actualT1Needed, gameId);
      container.appendChild(t1Item);
      
      // Add arrow
      const arrow = document.createElement('span');
      arrow.textContent = '→';
      arrow.style.cssText = `
        color: #f39c12;
        font-weight: bold;
        margin: 0 1px;
        font-size: 14px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      `;
      container.appendChild(arrow);
      
      // Add target tier item
      const targetItem = createEquipmentIcon(equipment, stat, targetTier, 1, gameId);
      container.appendChild(targetItem);
    } else {
      // Show forge path - only show what will be consumed from inventory
      const pathElements = [];
      
      // Get consumption steps (items that will be consumed)
      const consumeSteps = forgeSteps.filter(step => step.action === 'consume');
      
      if (consumeSteps.length > 0) {
        // Add all items that will be consumed
        consumeSteps.forEach((step, index) => {
          if (index > 0) {
            // Add plus sign between multiple items
            const plusSign = document.createElement('span');
            plusSign.textContent = '+';
            plusSign.style.cssText = `
              color: #f39c12;
              font-weight: bold;
              margin: 0 1px;
              font-size: 14px;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
            `;
            pathElements.push(plusSign);
          }
          
          pathElements.push(createEquipmentIcon(equipment, stat, step.tier, step.count, gameId));
        });
      }

      // Add arrow to target
      if (pathElements.length > 0) {
        const arrow = document.createElement('span');
        arrow.textContent = '→';
        arrow.style.cssText = `
          color: #f39c12;
          font-weight: bold;
          margin: 0 1px;
          font-size: 14px;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        `;
        pathElements.push(arrow);
      }

      // Add target item
      pathElements.push(createEquipmentIcon(equipment, stat, targetTier, 1, gameId));

      // Add all elements to container
      pathElements.forEach(element => container.appendChild(element));
    }

    return container;
  }
  
  function updateAutoUpgradeStatusBasedOnInventory(equipment, tier, stat) {
    try {
      const requirements = calculateForgeRequirements(tier, 1);
      
      if (requirements.items === 0) {
        updateAutoUpgradeStatus('Invalid tier selection');
        return;
      }
      
      // Use shared utilities for inventory filtering and grouping
      const matchingItems = getMatchingInventoryItems(equipment, stat, tier);
      const itemsByTier = groupItemsByTier(matchingItems);
      
      // Convert to count-based format for compatibility
      const itemsByTierCount = {};
      Object.keys(itemsByTier).forEach(tierKey => {
        itemsByTierCount[tierKey] = itemsByTier[tierKey].length;
      });
      
      // Check if we can forge the target tier
      const canForge = checkIfCanForge(itemsByTierCount, tier);
      
      if (canForge.canForge) {
        const forgeSteps = canForge.forgeSteps;
        const statusElement = createForgePathVisualization(equipment, stat, tier, forgeSteps, false);
        updateAutoUpgradeStatusElement(statusElement);
      } else {
        const missing = canForge.missing;
        const statusElement = createForgePathVisualization(equipment, stat, tier, [], true);
        updateAutoUpgradeStatusElement(statusElement);
      }
      
    } catch (error) {
      console.error('[Better Forge] Error checking inventory for auto-upgrade:', error);
      updateAutoUpgradeStatus('Error checking inventory');
    }
  }
  
  function generateForgingSteps(itemsToConsume, targetTier) {
    const steps = [];
    const availableItems = { ...itemsToConsume };
    
    console.log(`[Better Forge] 🔨 Smart queue creation for T${targetTier}:`, availableItems);
    
    // Calculate what we actually need to reach the target tier
    let currentTier = 1;
    let remainingT1Needed = Math.pow(2, targetTier - 1);
    
    // Start from highest available tier and work down to find the most efficient path
    for (let tier = Math.min(targetTier - 1, 4); tier >= 1; tier--) {
      const available = availableItems[tier] || 0;
      if (available > 0) {
        const t1Value = Math.pow(2, tier - 1);
        const maxCanUse = Math.min(available, Math.floor(remainingT1Needed / t1Value));
        
        if (maxCanUse > 0) {
          console.log(`[Better Forge] 🔍 T${tier}: Available ${available}, T1 value ${t1Value}, Can use ${maxCanUse}`);
          
          // Consume these items
          availableItems[tier] = available - maxCanUse;
          remainingT1Needed -= maxCanUse * t1Value;
          
          // If we consumed items, we might need to create steps to bridge gaps
          if (tier < targetTier - 1) {
            // We need to create items at tier+1 to reach target
            const itemsNeededAtNextTier = Math.pow(2, targetTier - tier - 2);
            if (itemsNeededAtNextTier > 0) {
              steps.push({
                action: 'forge',
                fromTier: tier,
                toTier: tier + 1,
                count: Math.min(maxCanUse, itemsNeededAtNextTier * 2),
                itemsNeeded: Math.min(maxCanUse, itemsNeededAtNextTier * 2)
              });
            }
          }
        }
      }
    }
    
    // If we still need items, create steps to bridge the remaining gap
    if (remainingT1Needed > 0) {
      console.log(`[Better Forge] ⚠️ Still need ${remainingT1Needed} T1 equivalents, creating bridging steps`);
      
      // Find the highest tier where we can create items
      for (let tier = 1; tier < targetTier - 1; tier++) {
        const available = availableItems[tier] || 0;
        if (available >= 2) {
          const canForge = Math.floor(available / 2);
          steps.push({
            action: 'forge',
            fromTier: tier,
            toTier: tier + 1,
            count: canForge,
            itemsNeeded: canForge * 2
          });
          
          // Update available items
          availableItems[tier] = available - (canForge * 2);
          availableItems[tier + 1] = (availableItems[tier + 1] || 0) + canForge;
        }
      }
    }
    
    console.log(`[Better Forge] 🔨 Smart forging steps created:`, steps);
    return steps;
  }
  
  function checkIfCanForge(itemsByTier, targetTier) {
    console.log(`[Better Forge] 🔍 checkIfCanForge called with:`, { itemsByTier, targetTier });
    
    const result = {
      canForge: false,
      forgeSteps: [],
      missing: []
    };
    
    // Calculate total T1 equivalents needed
    const totalT1Needed = Math.pow(2, targetTier - 1);
    const existingT1Equivalent = calculateT1Equivalents(itemsByTier);
    
    console.log(`[Better Forge] 📊 T1 equivalents calculation:`, {
      totalT1Needed,
      existingT1Equivalent,
      itemsByTier
    });
    
    if (existingT1Equivalent >= totalT1Needed) {
      // We can forge!
      result.canForge = true;
      console.log(`[Better Forge] ✅ Can forge! Have ${existingT1Equivalent} T1 equivalents, need ${totalT1Needed}`);
      
      // Prioritize using higher tier items first
      let remainingT1Needed = totalT1Needed;
      const itemsToConsume = {};
      
      // Start from highest tier and work down (excluding T5)
      for (let tier = Math.min(targetTier - 1, 4); tier >= 1; tier--) {
        const available = Array.isArray(itemsByTier[tier]) ? itemsByTier[tier].length : (itemsByTier[tier] || 0);
        if (available > 0 && remainingT1Needed > 0) {
          const t1Value = Math.pow(2, tier - 1);
          const maxCanUse = Math.min(available, Math.floor(remainingT1Needed / t1Value));
          
          console.log(`[Better Forge] 🔍 T${tier}: Available ${available}, T1 value ${t1Value}, Max can use ${maxCanUse}, Remaining T1 equivalents needed: ${remainingT1Needed}`);
          
          if (maxCanUse > 0) {
            itemsToConsume[tier] = maxCanUse;
            remainingT1Needed -= maxCanUse * t1Value;
            console.log(`[Better Forge] 📝 T${tier}: Will consume ${maxCanUse} items, remaining T1 equivalents needed: ${remainingT1Needed}`);
          }
        }
      }
      
      // Add consumption steps
      Object.keys(itemsToConsume).forEach(tier => {
        const tierNum = parseInt(tier);
        result.forgeSteps.push({
          action: 'consume',
          count: itemsToConsume[tierNum],
          tier: tierNum
        });
      });
      
      // Generate forging steps to reach target tier
      const forgingSteps = generateForgingSteps(itemsToConsume, targetTier);
      result.forgeSteps.push(...forgingSteps);
      
      console.log(`[Better Forge] 📋 Forge steps created:`, result.forgeSteps);
      
      // Validate the smart queue creation
      const totalSteps = result.forgeSteps.length;
      const consumptionStepsCount = result.forgeSteps.filter(step => step.action === 'consume').length;
      const forgingStepsCount = result.forgeSteps.filter(step => step.action === 'forge').length;
      
      console.log(`[Better Forge] 📊 Queue Summary: Total=${totalSteps}, Consumption=${consumptionStepsCount}, Forging=${forgingStepsCount}`);
      
      if (totalSteps <= 3) {
        console.log(`[Better Forge] ✅ Smart queue created efficiently - only ${totalSteps} steps needed`);
      } else {
        console.log(`[Better Forge] ⚠️ Queue might be larger than expected: ${totalSteps} steps`);
      }
      
      // Log complete forge plan summary
      const consumptionStepsSummary = result.forgeSteps.filter(step => step.action === 'consume');
      const forgingStepsSummary = result.forgeSteps.filter(step => step.action === 'forge');
      
      console.log(`[Better Forge] 📋 Complete Forge Plan Summary:`);
      console.log(`[Better Forge]   Consumption Steps: ${consumptionStepsSummary.length}`);
      consumptionStepsSummary.forEach(step => {
        console.log(`[Better Forge]     - Consume ${step.count} T${step.tier} items`);
      });
      console.log(`[Better Forge]   Forging Steps: ${forgingStepsSummary.length}`);
      forgingStepsSummary.forEach(step => {
        console.log(`[Better Forge]     - Forge ${step.count} T${step.fromTier} → T${step.toTier} items`);
      });
      
      // Add clear summary of what was consumed and what's needed
      if (remainingT1Needed === 0) {
        console.log(`[Better Forge] ✅ All T1 equivalents covered by existing items! No additional items needed.`);
      } else {
        console.log(`[Better Forge] ⚠️ Still need ${remainingT1Needed} T1 equivalents after consuming higher tier items.`);
      }
      
    } else {
      // We can't forge, calculate what's missing
      const missingT1 = totalT1Needed - existingT1Equivalent;
      result.missing.push({
        count: missingT1,
        tier: 1
      });
      console.log(`[Better Forge] ❌ Cannot forge: Missing ${missingT1} T1 equivalents`);
    }
    
    console.log(`[Better Forge] 🔍 checkIfCanForge result:`, result);
    return result;
  }

  // ============================================================================
  // 10. DUST DISPLAY AND ANIMATION FUNCTIONS
  // ============================================================================
  
  function injectDustDisplayIntoModal() {
    try {
             const playerContext = globalThis.state?.player?.getSnapshot()?.context;
       const currentDust = playerContext?.dust || 0;
       
       const buttonContainer = document.querySelector('div[role="dialog"][data-state="open"] .flex.justify-end.gap-2');
       if (!buttonContainer) return;
       
       const dustDisplay = document.createElement('div');
      dustDisplay.className = 'pixel-font-16 frame-pressed-1 surface-darker flex items-center justify-end gap-1 px-1.5 pb-px text-right text-whiteRegular mr-auto';
      dustDisplay.id = 'better-forge-dust-display';
      
      const dustIcon = document.createElement('img');
      dustIcon.src = '/assets/icons/dust.png';
      dustIcon.alt = 'Dust';
      
             const dustAmount = document.createElement('span');
       dustAmount.id = 'better-forge-dust-amount';
       dustAmount.textContent = currentDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
       
       dustDisplay.appendChild(dustIcon);
       dustDisplay.appendChild(dustAmount);
       
       buttonContainer.insertBefore(dustDisplay, buttonContainer.firstChild);
      
              if (globalThis.state?.player?.subscribe) {
          let previousDust = currentDust;
          const unsubscribe = globalThis.state.player.subscribe((state) => {
            const newDust = state.context?.dust || 0;
            const dustChange = newDust - previousDust;
            
            if (dustChange > 0) {
              updateDustDisplayWithAnimation(dustChange);
            } else {
              const dustAmountElement = document.getElementById('better-forge-dust-amount');
              if (dustAmountElement) {
                dustAmountElement.textContent = newDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              }
            }
            
            previousDust = newDust;
          });
          
          dustDisplay._unsubscribe = unsubscribe;
        }
      
    } catch (error) {
      console.warn('[Better Forge] Error injecting dust display:', error);
    }
  }

  function updateDustDisplay() {
    try {
      const dustAmountElement = document.getElementById('better-forge-dust-amount');
      if (dustAmountElement) {
        const playerContext = globalThis.state?.player?.getSnapshot()?.context;
        const currentDust = playerContext?.dust || 0;
        dustAmountElement.textContent = currentDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
    } catch (error) {
      console.warn('[Better Forge] Error updating dust display:', error);
    }
  }

  function animateDustCount(startValue, endValue, duration = 500) {
    try {
      const dustAmountElement = document.getElementById('better-forge-dust-amount');
      if (!dustAmountElement) return;
      
      const startTime = Date.now();
      const difference = endValue - startValue;
      
      function updateCount() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.floor(startValue + (difference * easeProgress));
        
        dustAmountElement.textContent = currentValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          dustAmountElement.style.transition = 'color 0.2s ease';
          dustAmountElement.style.color = '#4ade80';
          setTimeout(() => {
            dustAmountElement.style.color = '';
          }, 300);
        }
      }
      
      updateCount();
      
    } catch (error) {
      console.warn('[Better Forge] Error animating dust count:', error);
      updateDustDisplay();
    }
  }

  function updateDustDisplayWithAnimation(dustChange = 0) {
    try {
      console.log(`[Better Forge] 🔍 updateDustDisplayWithAnimation called with:`, dustChange, `type:`, typeof dustChange);
      
      // Ensure dustChange is a number
      const numericDustChange = Number(dustChange) || 0;
      console.log(`[Better Forge] 📊 Converted dustChange to number:`, numericDustChange);
      
      const dustAmountElement = document.getElementById('better-forge-dust-amount');
      if (!dustAmountElement) {
        console.log(`[Better Forge] ⚠️ Dust amount element not found, calling updateDustDisplay`);
        updateDustDisplay();
        return;
      }
      
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const currentDust = playerContext?.dust || 0;
      console.log(`[Better Forge] 📊 Current dust:`, currentDust);
      
      if (numericDustChange > 0) {
        const startValue = currentDust - numericDustChange;
        const endValue = currentDust;
        console.log(`[Better Forge] 🎬 Animating dust from ${startValue} to ${endValue}`);
        animateDustCount(startValue, endValue, 800);
      } else {
        console.log(`[Better Forge] 📝 Setting dust display to:`, currentDust);
        dustAmountElement.textContent = currentDust.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
      
    } catch (error) {
      console.warn('[Better Forge] Error updating dust display with animation:', error);
      updateDustDisplay();
    }
  }

  function cleanupDustDisplay() {
    try {
      const dustDisplay = document.getElementById('better-forge-dust-display');
      if (dustDisplay && dustDisplay._unsubscribe) {
        dustDisplay._unsubscribe();
        dustDisplay._unsubscribe = null;
      }
    } catch (error) {
      console.warn('[Better Forge] Error cleaning up dust display:', error);
    }
  }

  // ============================================================================
  // 11. MODAL AND UI MANAGEMENT FUNCTIONS
  // ============================================================================
  
     function showBetterForgeModal() {
       try {
         // Reset forge confirmation mode when opening modal
         if (forgeState.isForgeConfirmationMode) {
           console.log('[Better Forge] 🔄 Forge confirmation mode reset due to opening modal');
         }
         resetForgeConfirmationModeIfActive();
         
         if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress || forgeState.isConfirmationMode) {
           const disenchantBtn = getDisenchantButton();
           if (disenchantBtn) {
             stopDisenchanting(disenchantBtn);
           } else {
             forgeState.isDisenchanting = false;
             forgeState.isDisenchantingInProgress = false;
             forgeState.isConfirmationMode = false;
             clearAllIntervals();
             removeEscKeyHandler();
           }
         }
         
         // Stop forging if in progress
         if (forgeState.isForging || forgeState.isForgingInProgress) {
           stopForging();
         }
         
         injectBetterForgeButtonStyles();
         
         for (let i = 0; i < 2; i++) {
           document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
         }
         
         setTimeout(() => {
           try {
             const contentDiv = document.createElement('div');
             contentDiv.style.width = '100%';
             contentDiv.style.height = '100%';
             contentDiv.style.minWidth = '600px';
             contentDiv.style.maxWidth = '600px';
             contentDiv.style.minHeight = '400px';
             contentDiv.style.maxHeight = '400px';
             contentDiv.style.boxSizing = 'border-box';
             contentDiv.style.overflow = 'hidden';
             contentDiv.style.display = 'flex';
             contentDiv.style.flexDirection = 'row';
             contentDiv.style.gap = '8px';
             contentDiv.style.flex = '1 1 0';
             
             const arsenalBox = createBox({
               title: 'Arsenal',
               content: getArsenalContent()
             });
             arsenalBox.style.width = '250px';
             arsenalBox.style.minWidth = '250px';
             arsenalBox.style.maxWidth = '250px';
             arsenalBox.style.height = '100%';
             arsenalBox.style.flex = '0 0 250px';
             
             const forgeBox = createBox({
               title: 'Forge',
               content: getForgeContent()
             });
             forgeBox.style.width = '310px';
             forgeBox.style.minWidth = '310px';
             forgeBox.style.maxWidth = '310px';
             forgeBox.style.height = '100%';
             forgeBox.style.flex = '0 0 310px';
             
             contentDiv.appendChild(arsenalBox);
             contentDiv.appendChild(forgeBox);
             
             const modalInstance = api.ui.components.createModal({
               title: 'Better Forge',
               width: 600,
               height: 400,
               content: contentDiv,
               buttons: [{ text: 'Close', primary: true }]
             });
             
             if (modalInstance && typeof modalInstance.onClose === 'function') {
               modalInstance.onClose(() => {
                 // Reset forge confirmation mode when closing modal
                 if (forgeState.isForgeConfirmationMode) {
                   console.log('[Better Forge] 🔄 Forge confirmation mode reset due to closing modal');
                 }
                 resetForgeConfirmationModeIfActive();
                 
                 if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress || forgeState.isConfirmationMode) {
                   const disenchantBtn = getDisenchantButton();
                   if (disenchantBtn) {
                     stopDisenchanting(disenchantBtn);
                   } else {
                     forgeState.isDisenchanting = false;
                     forgeState.isDisenchantingInProgress = false;
                     forgeState.isConfirmationMode = false;
                     clearAllIntervals();
                     removeEscKeyHandler();
                   }
                 }
                 
                 // Stop forging if in progress
                 if (forgeState.isForging || forgeState.isForgingInProgress) {
                   stopForging();
                 }
                 
                 cleanupDustDisplay();
               });
             }
             
             setTimeout(() => {
               injectDustDisplayIntoModal();
             }, 100);
             
             setTimeout(() => {
               try {
                 const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
                 if (dialog) {
                   dialog.style.width = '600px';
                   dialog.style.minWidth = '600px';
                   dialog.style.maxWidth = '600px';
                   dialog.style.height = '400px';
                   dialog.style.minHeight = '400px';
                   dialog.style.maxHeight = '400px';
                   dialog.classList.remove('max-w-[300px]');
                   
                   let contentWrapper = null;
                   const children = Array.from(dialog.children);
                   for (const child of children) {
                     if (child !== dialog.firstChild && child.tagName === 'DIV') {
                       contentWrapper = child;
                       break;
                     }
                   }
                   if (!contentWrapper) {
                     contentWrapper = dialog.querySelector(':scope > div');
                   }
                   if (contentWrapper) {
                     contentWrapper.style.height = '100%';
                     contentWrapper.style.display = 'flex';
                     contentWrapper.style.flexDirection = 'column';
                     contentWrapper.style.flex = '1 1 0';
                   }
                   
                 }
               } catch (dialogError) {
                 handleError(dialogError, 'dialog styling', false);
               }
             }, 50);
           } catch (contentError) {
             handleError(contentError, 'modal content creation', true);
           }
         }, 50);
       } catch (error) {
         handleError(error, 'showBetterForgeModal', true);
       }
     }
   
               function getArsenalContent() {
                 try {
                   const div = document.createElement('div');
                   div.style.cssText = 'padding: 10px; display: flex; flex-direction: column; gap: 0; height: 100%;';
                   
                   const availableEquipment = getUserOwnedEquipment();
                   
                   const { searchContainer, searchInput, filterBtn } = createEquipmentSearchBar();
                   div.appendChild(searchContainer);
                   
                   const scrollArea = document.createElement('div');
                   scrollArea.style.cssText = 'flex: 1 1 0; height: calc(100% - 40px); min-height: 0; width: 100%; max-width: 100%; overflow-y: auto; display: grid; grid-template-columns: repeat(6, 34px); grid-auto-rows: 34px; gap: 0; padding: 5px; background: rgba(40,40,40,0.96); box-sizing: border-box; justify-content: center;';
                   
                   let currentFilter = 'all';
                   let filteredEquipment = availableEquipment;
                   let currentSearchTerm = '';
                   
                   renderEquipmentList(scrollArea, filteredEquipment, transferToDisenchant);
                   
                   let searchTimeout = null;
                   const debouncedSearch = (value) => {
                     if (searchTimeout) clearTimeout(searchTimeout);
                     searchTimeout = setTimeout(() => {
                       currentSearchTerm = value;
                       const freshEquipment = getUserOwnedEquipment();
                       applyEquipmentSearch(scrollArea, value, freshEquipment, transferToDisenchant);
                       
                       setTimeout(() => {
                         hideSelectedEquipmentFromArsenal();
                       }, 50);
                     }, 150);
                   };
                   
                   searchInput.addEventListener('input', (e) => {
                     debouncedSearch(e.target.value);
                   });
                   
                   let currentFilterIndex = 0;
                   const filterOptions = ['All', 'T1', 'T2', 'T3', 'T4', 'T5'];
                   
                   filterBtn.addEventListener('click', () => {
                     currentFilterIndex = (currentFilterIndex + 1) % filterOptions.length;
                     const selectedFilter = filterOptions[currentFilterIndex];
                     
                     filterBtn.textContent = selectedFilter;
                     
                     const freshEquipment = getUserOwnedEquipment();
                     
                     if (selectedFilter === 'All') {
                       filteredEquipment = freshEquipment;
                     } else {
                       const tierNum = parseInt(selectedFilter.substring(1));
                       filteredEquipment = freshEquipment.filter(equip => equip.tier === tierNum);
                     }
                     
                     scrollArea.innerHTML = '';
                     
                     if (currentSearchTerm && currentSearchTerm.trim()) {
                       applyEquipmentSearch(scrollArea, currentSearchTerm, filteredEquipment, transferToDisenchant);
                     } else {
                       renderEquipmentList(scrollArea, filteredEquipment, transferToDisenchant);
                     }
                     
                     setTimeout(() => {
                       hideSelectedEquipmentFromArsenal();
                       reapplyHighlighting();
                     }, 50);
                   });
                   
                   scrollArea.addEventListener('searchCleared', () => {
                     if (!filteredEquipment.length) {
                       scrollArea.innerHTML = '<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 6;max-width:100%;word-wrap:break-word;overflow-wrap:break-word;">No equipment found.</div>';
                       return;
                     }
                     
                     scrollArea.innerHTML = '';
                     scrollArea.style.cssText = 'flex: 1 1 0; height: calc(100% - 40px); min-height: 0; width: 100%; max-width: 100%; overflow-y: auto; display: grid; grid-template-columns: repeat(6, 34px); grid-auto-rows: 34px; gap: 0; padding: 5px; background: rgba(40,40,40,0.96); box-sizing: border-box; justify-content: center;';
                     renderEquipmentList(scrollArea, filteredEquipment, transferToDisenchant);
                     
                     setTimeout(() => {
                       hideSelectedEquipmentFromArsenal();
                       reapplyHighlighting();
                     }, 50);
                   });
                   
                   div.appendChild(scrollArea);
                   
                   return div;
                 } catch (error) {
                   handleError(error, 'getArsenalContent', false);
                   return document.createElement('div');
                 }
               }
    

    

    

     
     function getUserOwnedEquipment() {
       try {
         // Force a fresh snapshot to ensure we have the latest data
         const playerSnapshot = globalThis.state?.player?.getSnapshot();
         if (!playerSnapshot) {
           console.warn('[Better Forge] ⚠️ Player snapshot not available');
           return [];
         }
         
         const playerContext = playerSnapshot.context;
         if (!playerContext) {
           console.warn('[Better Forge] ⚠️ Player context not available');
           return [];
         }
         
         const userEquips = playerContext.equips || [];
         console.log(`[Better Forge] 📦 Raw player equips from state:`, userEquips.length, 'items');
         
         if (!userEquips || userEquips.length === 0) {
           console.log('[Better Forge] 📦 No equipment found in player state');
           return [];
         }
         
         const individualEquipment = userEquips
           .filter(equip => equip && equip.gameId)
           .map((equip, index) => {
             try {
               const equipData = globalThis.state?.utils?.getEquipment(equip.gameId);
               const equipmentName = equipData?.metadata?.name || `Equipment ID ${equip.gameId}`;
               
               return {
                 id: equip.id || `equip_${index}`,
                 gameId: equip.gameId,
                 name: equipmentName,
                 tier: equip.tier || 1,
                 stat: equip.stat || 'unknown',
                 count: 1
               };
             } catch (e) {
               console.warn(`[Better Forge] ⚠️ Error processing equipment ${equip.gameId}:`, e);
               return null;
             }
           })
           .filter(Boolean);
         
         const sortedEquipment = individualEquipment.sort((a, b) => {
           if (a.tier !== b.tier) return b.tier - a.tier;
           if (a.name !== b.name) return a.name.localeCompare(b.name);
           return a.stat.localeCompare(b.stat);
         });
         
         console.log(`[Better Forge] 📦 Processed equipment:`, sortedEquipment.length, 'items');
         return sortedEquipment;
         
       } catch (error) {
         console.error('[Better Forge] 💥 Error getting user owned equipment:', error);
         return [];
       }
     }
     
     function createEquipmentSearchBar() {
       try {
         const searchContainer = document.createElement('div');
         searchContainer.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 6px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 3px; margin: 0; width: 100%; margin-left: 0; margin-right: 0; box-sizing: border-box;';
       
         const searchInput = document.createElement('input');
         searchInput.id = 'better-forge-search';
         searchInput.placeholder = 'Search equipment...';
         searchInput.style.cssText = 'background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 6px; border-radius: 2px; font-size: 12px; flex: 1; font-family: inherit; outline: none; box-sizing: border-box;';
         
         searchInput.addEventListener('focus', () => {
           searchInput.style.borderColor = 'rgba(255, 255, 255, 0.4)';
         });
         
         searchInput.addEventListener('blur', () => {
           searchInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
         });
         
         const filterBtn = document.createElement('button');
         filterBtn.id = 'better-forge-filter';
         filterBtn.textContent = 'All';
         filterBtn.style.cssText = 'background: rgba(255, 255, 255, 0.1); color: #fff; border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 8px; border-radius: 2px; font-size: 12px; cursor: pointer; font-family: inherit; outline: none; white-space: nowrap; min-width: 50px;';
         
         filterBtn.addEventListener('mouseenter', () => {
           filterBtn.style.background = 'rgba(255, 255, 255, 0.2)';
           filterBtn.style.borderColor = 'rgba(255, 255, 255, 0.4)';
         });
         
         filterBtn.addEventListener('mouseleave', () => {
           filterBtn.style.background = 'rgba(255, 255, 255, 0.1)';
           filterBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
         });
         
         searchContainer.appendChild(searchInput);
         searchContainer.appendChild(filterBtn);
         
         return { searchContainer, searchInput, filterBtn };
       } catch (error) {
         handleError(error, 'createEquipmentSearchBar', false);
         return { searchContainer: document.createElement('div'), searchInput: document.createElement('input'), filterBtn: document.createElement('button') };
       }
     }

     function createEquipmentButton(equipment, onSelect) {
       const btn = document.createElement('button');
       btn.className = 'focus-style-visible active:opacity-70';
       btn.setAttribute('data-state', 'closed');
       btn.setAttribute('data-equipment', equipment.name);
       btn.setAttribute('data-equipment-id', equipment.id);
       btn.setAttribute('data-tier', equipment.tier);
       btn.setAttribute('data-stat', equipment.stat);
       
       btn.style.width = '34px';
       btn.style.height = '34px';
       btn.style.minWidth = '34px';
       btn.style.minHeight = '34px';
       btn.style.maxWidth = '34px';
       btn.style.maxHeight = '34px';
       btn.style.display = 'flex';
       btn.style.alignItems = 'center';
       btn.style.justifyContent = 'center';
       btn.style.padding = '0';
       btn.style.margin = '0';
       btn.style.border = 'none';
       btn.style.background = 'none';
       btn.style.cursor = 'pointer';
       
       let spriteId = '';
       let equipName = equipment.name;
       try {
         const equipData = globalThis.state?.utils?.getEquipment(equipment.gameId);
         if (equipData && equipData.metadata) {
           spriteId = equipData.metadata.spriteId;
           equipName = equipData.metadata.name;
         }
       } catch (e) {
         console.warn(`[Better Forge] Error getting equipment data for ${equipment.name}:`, e);
       }
       
       if (spriteId && typeof api?.ui?.components?.createItemPortrait === 'function') {
         try {
           const itemPortrait = api.ui.components.createItemPortrait({
             itemId: spriteId,
             stat: equipment.stat,
             tier: equipment.tier,
             onClick: () => {
               if (onSelect) onSelect(equipment);
             }
           });
           
           btn.innerHTML = '';
           btn.appendChild(itemPortrait);
         } catch (e) {
           createFallbackEquipmentSprite(btn, spriteId);
         }
       } else {
         createFallbackEquipmentSprite(btn, spriteId);
       }
       
       btn.title = '';
       
       return btn;
     }
     
     function createFallbackEquipmentSprite(container, spriteId) {
       try {
         if (spriteId) {
           const sizeSprite = document.createElement('div');
           sizeSprite.className = 'relative size-sprite';
           sizeSprite.style.overflow = 'visible';
           
           const spriteDiv = document.createElement('div');
           spriteDiv.className = `sprite item relative id-${spriteId}`;
           
           const viewportDiv = document.createElement('div');
           viewportDiv.className = 'viewport';
           viewportDiv.style.width = '32px';
           viewportDiv.style.height = '32px';
           
           const img = document.createElement('img');
           img.alt = spriteId;
           img.setAttribute('data-cropped', 'false');
           img.className = 'spritesheet';
           img.style.setProperty('--cropX', '0');
           img.style.setProperty('--cropY', '0');
           
           viewportDiv.appendChild(img);
           spriteDiv.appendChild(viewportDiv);
           sizeSprite.appendChild(spriteDiv);
           container.appendChild(sizeSprite);
         } else {
           const img = document.createElement('img');
           img.className = 'pixelated ml-auto';
           img.alt = 'equipment';
           img.width = 34;
           img.height = 34;
           img.style.width = '34px';
           img.style.height = '34px';
           img.style.minWidth = '34px';
           img.style.minHeight = '34px';
           img.style.maxWidth = '34px';
           img.style.maxHeight = '34px';
           img.style.objectFit = 'contain';
           img.src = '/assets/spells/smith.png';
           container.appendChild(img);
         }
       } catch (error) {
         const fallbackDiv = document.createElement('div');
         fallbackDiv.style.cssText = 'width: 32px; height: 32px; background: #666; border: 1px solid #999; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px;';
         fallbackDiv.textContent = '?';
         container.appendChild(fallbackDiv);
       }
     }



     function renderEquipmentList(scrollArea, equipmentItems, onSelect) {
       if (!equipmentItems.length) {
         scrollArea.innerHTML = '<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 6;max-width:100%;word-wrap:break-word;overflow-wrap:break-word;">No equipment found.</div>';
         return;
       }
       
                if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress) {
           scrollArea.innerHTML = '<div style="color:#ffcc88;text-align:center;padding:16px;grid-column: span 6;max-width:100%;word-wrap:break-word;overflow-wrap:break-word;">Disenchanting in progress... Please wait.</div>';
           return;
         }
       
       for (const equipment of equipmentItems) {
         const btn = createEquipmentButton(equipment, onSelect);
         scrollArea.appendChild(btn);
       }
     }

     function applyEquipmentSearch(scrollArea, searchValue, equipmentItems, onSelect) {
       try {
         if (!scrollArea || !(scrollArea instanceof HTMLElement)) {
           console.error('[Better Forge] Invalid scrollArea parameter');
           return;
         }
         
         if (typeof searchValue !== 'string') {
           console.error('[Better Forge] Search value must be a string');
           return;
         }
         
         const searchTerm = searchValue.toLowerCase().trim();
         
         if (searchTerm && searchTerm.length > 0) {
           const matchingEquipment = equipmentItems.filter(equipment => 
             equipment.name.toLowerCase().includes(searchTerm)
           );
           
           if (matchingEquipment.length > 0) {
             matchingEquipment.sort((a, b) => {
               if (a.tier !== b.tier) return b.tier - a.tier;
               if (a.name !== b.name) return a.name.localeCompare(b.name);
               return a.stat.localeCompare(b.stat);
             });
           }
           
           requestAnimationFrame(() => {
             try {
               scrollArea.innerHTML = '';
               
               if (matchingEquipment.length === 0) {
                 const noResultsMsg = document.createElement('div');
                 noResultsMsg.style.cssText = `
                   color: #bbb;
                   text-align: center;
                   padding: 16px;
                   grid-column: span 6;
                   max-width: 100%;
                   word-wrap: break-word;
                   overflow-wrap: break-word;
                 `;
                 noResultsMsg.textContent = `No equipment found matching "${searchValue}"`;
                 scrollArea.appendChild(noResultsMsg);
               } else {
                 const fragment = document.createDocumentFragment();
                 matchingEquipment.forEach(equipment => {
                   const btn = createEquipmentButton(equipment, onSelect);
                   fragment.appendChild(btn);
                 });
                 scrollArea.appendChild(fragment);
                 
                 // Re-apply highlighting after search results are rendered
                 setTimeout(() => {
                   reapplyHighlighting();
                 }, 100);
               }
               
                            } catch (e) {
                 console.error('[Better Forge] Error in equipment search:', e);
                 const equipmentButtons = scrollArea.querySelectorAll('button[data-equipment]');
               equipmentButtons.forEach(btn => {
                 const equipmentName = btn.title || '';
                 const isMatch = equipmentName.toLowerCase().includes(searchTerm.toLowerCase());
                 btn.style.display = isMatch ? 'block' : 'none';
               });
             }
           });
         } else {
           const event = new CustomEvent('searchCleared');
           scrollArea.dispatchEvent(event);
         }
       } catch (error) {
         console.error('[Better Forge] Error in applyEquipmentSearch:', error);
       }
     }


   
   function getForgeContent() {
     try {
       const div = document.createElement('div');
       div.style.cssText = 'padding: 10px; display: flex; flex-direction: column; gap: 12px; height: 100%;';
       
       const tabContainer = document.createElement('div');
       tabContainer.style.cssText = 'display: flex; gap: 0; margin: 0; padding: 0; height: auto;';
       
       const disenchantBtn = document.createElement('button');
       disenchantBtn.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
       disenchantBtn.textContent = 'Disenchant';
       disenchantBtn.style.cssText = 'margin: 0; padding: 2px 8px; text-align: center; color: rgb(255, 255, 255); cursor: pointer; height: auto; font-size: 14px; font-weight: bold;';
       
       const upgradeBtn = document.createElement('button');
       upgradeBtn.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
       upgradeBtn.textContent = 'Auto-upgrade';
       upgradeBtn.style.cssText = 'margin: 0; padding: 2px 8px; text-align: center; color: rgb(255, 255, 255); cursor: pointer; height: auto; font-size: 14px; font-weight: bold;';
       
       const contentArea = document.createElement('div');
       contentArea.style.cssText = 'flex: 1; display: flex; flex-direction: column; max-width: 280px;';
       contentArea.id = 'forge-content-area';
       
       const disenchantContent = getDisenchantContent();
       contentArea.innerHTML = '';
       contentArea.appendChild(disenchantContent);
       
       disenchantBtn.addEventListener('click', () => {
         disenchantBtn.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
         upgradeBtn.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
         
         if (forgeState.isConfirmationMode) {
           resetConfirmationMode();
         }
         
         // Reset forge confirmation mode when switching tabs
         if (forgeState.isForgeConfirmationMode) {
           console.log('[Better Forge] 🔄 Forge confirmation mode reset due to switching to disenchant tab');
         }
         resetForgeConfirmationModeIfActive();
         
         // Stop forging if in progress
         if (forgeState.isForging || forgeState.isForgingInProgress) {
           stopForging();
         }
         
         // Clear equipment highlights when switching to disenchant tab
         highlightEquipmentForForging(null, null, null);
         
         const disenchantContent = getDisenchantContent();
         contentArea.innerHTML = '';
         contentArea.appendChild(disenchantContent);
         
         // No special handling needed for disenchant tab
         
                  setTimeout(() => {
                    loadDisenchantEquipment();
                  }, 150);
       });
       
       upgradeBtn.addEventListener('click', () => {
         upgradeBtn.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
         disenchantBtn.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
         
         if (forgeState.isConfirmationMode) {
           resetConfirmationMode();
         }
         
         // Reset forge confirmation mode when switching tabs
         if (forgeState.isForgeConfirmationMode) {
           console.log('[Better Forge] 🔄 Forge confirmation mode reset due to switching to upgrade tab');
         }
         resetForgeConfirmationModeIfActive();
         
         // Stop forging if in progress
         if (forgeState.isForging || forgeState.isForgingInProgress) {
           stopForging();
         }
         
         restoreEquipmentToArsenal();
         
         const autoUpgradeContent = getAutoUpgradeContent();
         contentArea.innerHTML = '';
         contentArea.appendChild(autoUpgradeContent);
         
         // Clear equipment highlights when switching to auto-upgrade tab
         setTimeout(() => {
           clearAutoUpgradeSelection();
           highlightEquipmentForForging(null, null, null);
         }, 100);
       });
       
                tabContainer.appendChild(disenchantBtn);
         tabContainer.appendChild(upgradeBtn);
         div.appendChild(tabContainer);
       div.appendChild(contentArea);
       
       return div;
     } catch (error) {
       handleError(error, 'getForgeContent', false);
                return document.createElement('div');
     }
   }
   
   function getDisenchantContent() {
     try {
       const div = document.createElement('div');
       div.style.cssText = 'padding: 10px; display: flex; flex-direction: column; gap: 12px; height: 100%;';
       
       const title = document.createElement('h3');
       title.style.cssText = 'margin: 0 0 10px 0; padding: 0; font-size: 16px; font-weight: bold; color: rgb(255, 255, 255); text-align: center;';
       title.textContent = 'Disenchant Equipment';
       
       const columnContainer = document.createElement('div');
       columnContainer.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-height: 0;';
       
       const equipmentBox = document.createElement('div');
       equipmentBox.style.cssText = 'display: flex; flex-direction: column; background: rgba(40,40,40,0.96); border: 2px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px; min-width: 260px; width: 260px; height: 140px; max-height: 140px; min-height: 0;';
       
       const colTitle = document.createElement('h4');
       colTitle.style.cssText = 'margin: 0 0 4px 0; padding: 0; font-size: 14px; font-weight: bold; color: rgb(255, 255, 255); text-align: center;';
       colTitle.textContent = 'Selected for Disenchant';
       
       const colContent = document.createElement('div');
       colContent.style.cssText = 'height: 124px; max-height: 124px; overflow-y: auto; display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: 34px; gap: 0; padding: 2px; background: rgba(40,40,40,0.96); width: 100%; box-sizing: border-box;';
       colContent.id = 'disenchant-col2';
       
       if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress) {
         colContent.innerHTML = '<div style="color:#ffcc88;text-align:center;padding:16px;grid-column: span 7;">Disenchanting in progress... Equipment cannot be removed.</div>';
       } else {
         colContent.innerHTML = '<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 7;">Click equipment in Arsenal to select for disenchant</div>';
       }
       
       const disenchantControls = document.createElement('div');
       disenchantControls.style.cssText = 'display: flex; align-items: center; gap: 8px; height: 40px; min-width: 260px; width: 260px;';
       
       const disenchantBtn = document.createElement('button');
       
       disenchantBtn.style.cssText = 'background: url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png") repeat; border: 6px solid transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch; font-weight: 700; border-radius: 0; padding: 4px 12px; cursor: pointer; font-family: "Trebuchet MS", "Arial Black", Arial, sans-serif; font-size: 14px; outline: none; flex: 0.6;';
       
       if (forgeState.isConfirmationMode) {
         updateDisenchantButtonState(disenchantBtn, 'confirmation');
       } else if (forgeState.isDisenchanting) {
         updateDisenchantButtonState(disenchantBtn, 'disenchanting');
       } else {
         updateDisenchantButtonState(disenchantBtn, 'normal');
       }
       
       disenchantBtn.addEventListener('mousedown', () => {
         disenchantBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 6 fill stretch';
       });
       disenchantBtn.addEventListener('mouseup', () => {
         disenchantBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
       });
       disenchantBtn.addEventListener('mouseleave', () => {
         disenchantBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
       });
       disenchantBtn.addEventListener('keydown', e => {
         if (e.key === ' ' || e.key === 'Enter') {
           disenchantBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 6 fill stretch';
         }
       });
       disenchantBtn.addEventListener('keyup', e => {
         if (e.key === ' ' || e.key === 'Enter') {
           disenchantBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
         }
       });
       
       disenchantBtn.addEventListener('click', () => {
         if (!forgeState.isDisenchanting) {
           startDisenchanting(disenchantBtn);
         } else {
           stopDisenchanting(disenchantBtn);
         }
       });
       
       if (forgeState.isConfirmationMode) {
         addEscKeyHandler(disenchantBtn);
       }
       
       const progressBar = document.createElement('div');
       progressBar.style.cssText = 'height: 20px; background: rgba(40,40,40,0.96); border: 2px solid rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; position: relative; flex: 0.4;';
       progressBar.id = 'disenchant-progress';
       
       const progressFill = document.createElement('div');
       progressFill.style.cssText = 'width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease;';
       progressFill.id = 'disenchant-progress-fill';
       
       const progressText = document.createElement('div');
       progressText.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; font-family: Arial, sans-serif; z-index: 1;';
       progressText.textContent = '0%';
       progressText.id = 'disenchant-progress-text';
       
       progressBar.appendChild(progressFill);
       progressBar.appendChild(progressText);
       
       disenchantControls.appendChild(disenchantBtn);
       disenchantControls.appendChild(progressBar);
       
       const statusSeparator = document.createElement('div');
       statusSeparator.className = 'separator my-2.5';
       statusSeparator.setAttribute('role', 'none');
       
       const statusRow = document.createElement('div');
       statusRow.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 20px; min-width: 260px; width: 260px;';
       
       const statusText = document.createElement('div');
       statusText.style.cssText = 'color: #e6d7b0; font-size: 12px; font-weight: bold; text-align: center;';
       
       if (forgeState.isConfirmationMode) {
         statusText.textContent = 'Click "Confirm Disenchant" to start disenchanting process';
       } else if (forgeState.isDisenchanting) {
         statusText.textContent = 'Disenchanting in progress...';
       } else {
         statusText.textContent = 'No equipment selected';
       }
       
       statusText.id = 'disenchant-status';
       
       statusRow.appendChild(statusText);
       
       const separator = document.createElement('div');
       separator.className = 'separator my-2.5';
       separator.setAttribute('role', 'none');
       
       equipmentBox.appendChild(colTitle);
       equipmentBox.appendChild(colContent);
       columnContainer.appendChild(equipmentBox);
       columnContainer.appendChild(separator);
       columnContainer.appendChild(disenchantControls);
       columnContainer.appendChild(statusSeparator);
       columnContainer.appendChild(statusRow);
       
       div.appendChild(title);
       div.appendChild(columnContainer);
       
       return div;
     } catch (error) {
       handleError(error, 'getDisenchantContent', false);
       return document.createElement('div');
     }
   }
   
   function getAutoUpgradeContent() {
    try {
      const div = document.createElement('div');
      div.style.cssText = 'padding: 10px; display: flex; flex-direction: column; gap: 12px; height: 100%;';
      
      const title = document.createElement('h3');
      title.style.cssText = 'margin: 0 0 10px 0; padding: 0; font-size: 16px; font-weight: bold; color: rgb(255, 255, 255); text-align: center;';
      title.textContent = 'Auto-upgrade Equipment';
      
      const columnContainer = document.createElement('div');
      columnContainer.style.cssText = 'display: flex; flex-direction: column; flex: 1; min-height: 0;';
      
             // Three column boxes container
       const threeColumnContainer = document.createElement('div');
       threeColumnContainer.style.cssText = 'display: flex; gap: 8px; height: 140px; justify-content: center; align-items: center;';
      
      // First box - Equipment list
      const equipmentBox = document.createElement('div');
      equipmentBox.style.cssText = 'display: flex; flex-direction: column; background: rgba(40,40,40,0.96); border: 2px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px; width: 80px; min-width: 80px; max-width: 80px; height: 140px; max-height: 140px; min-height: 0;';
      
      const equipmentTitle = document.createElement('h4');
      equipmentTitle.style.cssText = 'margin: 0 0 4px 0; padding: 0; font-size: 14px; font-weight: bold; color: rgb(255, 255, 255); text-align: center;';
      equipmentTitle.textContent = 'Equipment';
      
             const equipmentContent = document.createElement('div');
       equipmentContent.style.cssText = 'height: 124px; max-height: 124px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding: 2px; background: rgba(40,40,40,0.96); width: 100%; box-sizing: border-box;';
       equipmentContent.id = 'auto-upgrade-equipment-col';
      
             // Generate equipment list dynamically
       const equipmentList = generateEquipmentList();
       
       const equipmentMap = buildEquipmentMap();
       
       // Selection state is now managed centrally in autoUpgradeState
       
       equipmentList.forEach(equipmentName => {
         const item = document.createElement('div');
         item.className = 'auto-upgrade-item';
         item.title = equipmentName;
         
         // Try to get equipment icon
         const gameId = equipmentMap.get(equipmentName.toLowerCase());
         if (gameId && globalThis.state?.utils?.getEquipment) {
           try {
             const equipData = globalThis.state.utils.getEquipment(gameId);
             if (equipData && equipData.metadata && equipData.metadata.spriteId && api?.ui?.components?.createItemPortrait) {
               const itemPortrait = api.ui.components.createItemPortrait({
                 itemId: equipData.metadata.spriteId,
                 stat: null,
                 tier: null,
                 onClick: () => {
                   // Handle equipment selection
                 }
               });
               
               item.appendChild(itemPortrait);
             } else {
               // Fallback to text
               item.textContent = equipmentName;
             }
           } catch (e) {
             console.warn(`[Better Forge] Error creating equipment icon for ${equipmentName}:`, e);
             // Fallback to text
             item.textContent = equipmentName;
           }
                    } else {
             // Fallback to text if no game ID found
             item.textContent = equipmentName;
           }
        
                 item.addEventListener('click', createSelectionHandler('equipment', equipmentName));
         
         // Mouse events are now handled by CSS classes
        
        equipmentContent.appendChild(item);
      });
      
             // Second box - Tiers and Stats (split into two rows)
       const tiersBox = document.createElement('div');
       tiersBox.style.cssText = 'display: flex; flex-direction: column; background: rgba(40,40,40,0.96); border: 2px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px; width: 100px; min-width: 100px; max-width: 100px; height: 140px; max-height: 140px; min-height: 0;';
       
       // Tiers row
       const tiersRow = document.createElement('div');
       tiersRow.style.cssText = 'display: flex; flex-direction: column; height: 60%; min-height: 0;';
       
       const tiersTitle = document.createElement('h4');
       tiersTitle.style.cssText = 'margin: 0 0 4px 0; padding: 0; font-size: 14px; font-weight: bold; color: rgb(255, 255, 255); text-align: center;';
       tiersTitle.textContent = 'Tiers';
       
       const tiersContent = document.createElement('div');
       tiersContent.style.cssText = 'height: calc(100% - 20px); max-height: calc(100% - 20px); overflow-y: auto; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 2px; padding: 2px; background: rgba(40,40,40,0.96); width: 100%; box-sizing: border-box; align-items: center; justify-items: center;';
       tiersContent.id = 'auto-upgrade-tiers-col';
       
       // Tier color function
       const getRarityBorderColor = (tierLevel) => {
         switch (tierLevel) {
           case 1: return "#ABB2BF"; // Grey
           case 2: return "#98C379"; // Green
           case 3: return "#61AFEF"; // Blue
           case 4: return "#C678DD"; // Purple
           case 5: return "#E5C07B"; // Yellow
           default: return "#3A404A";
         }
       };
       
       const tiers = [
         { name: 'T2', level: 2 },
         { name: 'T3', level: 3 },
         { name: 'T4', level: 4 },
         { name: 'T5', level: 5 }
       ];
       tiers.forEach(tier => {
         const tierItem = document.createElement('div');
         tierItem.className = 'auto-upgrade-tier';
         tierItem.style.borderColor = getRarityBorderColor(tier.level);
         tierItem.textContent = tier.name;
         tierItem.title = `Tier ${tier.level}`;
         
         tierItem.addEventListener('click', createSelectionHandler('tiers', tier.level));
         
         // Mouse events are now handled by CSS classes
         
         tiersContent.appendChild(tierItem);
       });
       
       // Stats row
       const statsRow = document.createElement('div');
       statsRow.style.cssText = 'display: flex; flex-direction: column; height: 40%; min-height: 0; margin-top: 4px;';
       
       const statsTitle = document.createElement('h4');
       statsTitle.style.cssText = 'margin: 0 0 4px 0; padding: 0; font-size: 14px; font-weight: bold; color: rgb(255, 255, 255); text-align: center;';
       statsTitle.textContent = 'Stats';
       
       const statsContent = document.createElement('div');
       statsContent.style.cssText = 'height: calc(100% - 20px); max-height: calc(100% - 20px); overflow-y: auto; display: flex; flex-direction: row; gap: 4px; padding: 2px; background: rgba(40,40,40,0.96); width: 100%; box-sizing: border-box;';
       statsContent.id = 'auto-upgrade-stats-col';
       
       const stats = [
         { name: 'AD', icon: '/assets/icons/attackdamage.png' },
         { name: 'AP', icon: '/assets/icons/abilitypower.png' },
         { name: 'HP', icon: '/assets/icons/heal.png' }
       ];
       stats.forEach(stat => {
         const statItem = document.createElement('div');
         statItem.className = 'auto-upgrade-stat';
         statItem.title = stat.name;
         
         const statIcon = document.createElement('img');
         statIcon.src = stat.icon;
         statIcon.style.cssText = 'width: 12px; height: 12px; object-fit: contain;';
         statIcon.alt = stat.name;
         
         statItem.appendChild(statIcon);
         
         statItem.addEventListener('click', createSelectionHandler('stats', stat.name));
         
         // Mouse events are now handled by CSS classes
         
         statsContent.appendChild(statItem);
       });
      
      // Third box - Details
      const detailsBox = document.createElement('div');
      detailsBox.style.cssText = 'display: flex; flex-direction: column; background: rgba(40,40,40,0.96); border: 2px solid rgba(255,255,255,0.1); border-radius: 4px; padding: 4px; width: 80px; min-width: 80px; max-width: 80px; height: 140px; max-height: 140px; min-height: 0;';
      
      const detailsTitle = document.createElement('h4');
      detailsTitle.style.cssText = 'margin: 0 0 4px 0; padding: 0; font-size: 14px; font-weight: bold; color: rgb(255, 255, 255); text-align: center;';
      detailsTitle.textContent = 'Result';
      
      const detailsContent = document.createElement('div');
      detailsContent.style.cssText = 'height: 124px; max-height: 124px; overflow-y: auto; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; color: #888888; font-size: 11px; text-align: center; padding: 8px; background: rgba(40,40,40,0.96); width: 100%; box-sizing: border-box; gap: 4px;';
      detailsContent.textContent = 'Select equipment, tier, and stat to see result';
      detailsContent.id = 'auto-upgrade-details-col';
      
             // Assemble the three columns
       equipmentBox.appendChild(equipmentTitle);
       equipmentBox.appendChild(equipmentContent);
       
       // Assemble tiers box with both rows
       tiersRow.appendChild(tiersTitle);
       tiersRow.appendChild(tiersContent);
       statsRow.appendChild(statsTitle);
       statsRow.appendChild(statsContent);
       tiersBox.appendChild(tiersRow);
       tiersBox.appendChild(statsRow);
       
       detailsBox.appendChild(detailsTitle);
       detailsBox.appendChild(detailsContent);
      
      threeColumnContainer.appendChild(equipmentBox);
      threeColumnContainer.appendChild(tiersBox);
      threeColumnContainer.appendChild(detailsBox);
      
      // Separator after three columns
      const separator1 = document.createElement('div');
      separator1.className = 'separator my-2.5';
      separator1.setAttribute('role', 'none');
      
      // Forge button and progress bar
      const forgeControls = document.createElement('div');
      forgeControls.style.cssText = 'display: flex; align-items: center; gap: 8px; height: 40px;';
      
      const forgeBtn = document.createElement('button');
      forgeBtn.id = 'auto-upgrade-forge-btn';
      forgeBtn.style.cssText = 'background: url("https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png") repeat; border: 6px solid transparent; border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch; font-weight: 700; border-radius: 0; padding: 4px 12px; cursor: pointer; font-family: "Trebuchet MS", "Arial Black", Arial, sans-serif; font-size: 14px; outline: none; flex: 0.6; color: #888888;';
      forgeBtn.textContent = 'Forge';
      
      forgeBtn.addEventListener('mousedown', () => {
        forgeBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png") 6 fill stretch';
      });
      forgeBtn.addEventListener('mouseup', () => {
        forgeBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
      });
      forgeBtn.addEventListener('mouseleave', () => {
        forgeBtn.style.borderImage = 'url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch';
      });
      
      forgeBtn.addEventListener('click', () => {
        if (forgeState.isForging) {
          stopForging();
          return;
        }
        
        const { selectedEquipment, selectedTier, selectedStat } = getCurrentSelection();
        if (!selectedEquipment || !selectedTier || !selectedStat) {
          updateAutoUpgradeStatus('Please select equipment, tier, and stat first');
          return;
        }
        
        startForging(selectedEquipment, selectedStat, selectedTier);
      });
      
      const progressBar = document.createElement('div');
      progressBar.style.cssText = 'height: 20px; background: rgba(40,40,40,0.96); border: 2px solid rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; position: relative; flex: 0.4;';
      progressBar.id = 'auto-upgrade-progress';
      
      const progressFill = document.createElement('div');
      progressFill.style.cssText = 'width: 0%; height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease;';
      progressFill.id = 'auto-upgrade-progress-fill';
      
      const progressText = document.createElement('div');
      progressText.style.cssText = 'position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; color: white; font-size: 10px; font-weight: bold; font-family: Arial, sans-serif; z-index: 1;';
      progressText.textContent = '0%';
      progressText.id = 'auto-upgrade-progress-text';
      
      progressBar.appendChild(progressFill);
      progressBar.appendChild(progressText);
      
      forgeControls.appendChild(forgeBtn);
      forgeControls.appendChild(progressBar);
      
      // Separator after forge controls
      const separator2 = document.createElement('div');
      separator2.className = 'separator my-2.5';
      separator2.setAttribute('role', 'none');
      
      // Status message
      const statusRow = document.createElement('div');
      statusRow.style.cssText = 'display: flex; align-items: center; justify-content: center; height: 20px;';
      
      const statusText = document.createElement('div');
      statusText.style.cssText = 'color: #e6d7b0; font-size: 12px; font-weight: bold; text-align: center;';
      statusText.textContent = 'Select equipment and tier to upgrade';
      statusText.id = 'auto-upgrade-status';
      
      statusRow.appendChild(statusText);
      
      // Assemble everything
      columnContainer.appendChild(threeColumnContainer);
      columnContainer.appendChild(separator1);
      columnContainer.appendChild(forgeControls);
      columnContainer.appendChild(separator2);
      columnContainer.appendChild(statusRow);
      
      div.appendChild(title);
      div.appendChild(columnContainer);
      
      return div;
    } catch (error) {
      handleError(error, 'getAutoUpgradeContent', false);
      return document.createElement('div');
    }
   }

   function loadDisenchantEquipment() {
     try {
       const col2 = document.getElementById('disenchant-col2');
       
       if (!col2) {
         return;
       }
       
       col2.innerHTML = '';
       
       if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress) {
         col2.innerHTML = '<div style="color:#ffcc88;text-align:center;padding:16px;grid-column: span 7;">Disenchanting in progress... Equipment cannot be removed.</div>';
       } else {
         col2.innerHTML = '<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 7;">Click equipment in Arsenal to select for disenchant</div>';
       }
       
       updateDisenchantStatus();
       
     } catch (error) {
       handleError(error, 'loadDisenchantEquipment', false);
     }
   }
   
   function createDisenchantEquipmentButton(equipment, sourceColumn) {
     const btn = document.createElement('button');
     btn.className = 'focus-style-visible active:opacity-70';
     btn.setAttribute('data-equipment-id', equipment.id);
     btn.setAttribute('data-source-column', sourceColumn);
     
     btn.style.width = '34px';
     btn.style.height = '34px';
     btn.style.minWidth = '34px';
     btn.style.minHeight = '34px';
     btn.style.maxWidth = '34px';
     btn.style.maxHeight = '34px';
     btn.style.display = 'flex';
     btn.style.alignItems = 'center';
     btn.style.justifyContent = 'center';
     btn.style.padding = '0';
     btn.style.margin = '0';
     btn.style.border = 'none';
     btn.style.background = 'none';
     btn.style.cursor = 'pointer';
     
            if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress) {
         btn.style.opacity = '0.5';
         btn.style.cursor = 'not-allowed';
         btn.disabled = true;
       }
     
     let spriteId = '';
     try {
       const equipData = globalThis.state?.utils?.getEquipment(equipment.gameId);
       if (equipData && equipData.metadata) {
         spriteId = equipData.metadata.spriteId;
       }
     } catch (e) {
       console.warn(`[Better Forge] Error getting equipment data for ${equipment.name}:`, e);
     }
     
     if (spriteId && api?.ui?.components?.createItemPortrait) {
       try {
         const itemPortrait = api.ui.components.createItemPortrait({
           itemId: spriteId,
           stat: equipment.stat,
           tier: equipment.tier,
           onClick: () => {
             transferEquipment(equipment, sourceColumn);
           }
         });
         
         btn.innerHTML = '';
         btn.appendChild(itemPortrait);
       } catch (e) {
         console.warn(`[Better Forge] Error creating item portrait for ${equipment.name}:`, e);
         createFallbackEquipmentSprite(btn, spriteId);
       }
     } else {
       createFallbackEquipmentSprite(btn, spriteId);
     }
     
     btn.addEventListener('click', () => {
       transferEquipment(equipment, sourceColumn);
     });
     
     return btn;
   }
   
     function updateDisenchantStatus(customMessage = null) {
    try {
      const col2 = document.getElementById('disenchant-col2');
      const statusText = document.getElementById('disenchant-status');
      
      if (!col2 || !statusText) return;
      
      if (customMessage) {
        statusText.textContent = customMessage;
        if (customMessage.includes('Disenchanting completed')) {
          statusText.style.color = '#4ade80';
        } else {
          statusText.style.color = '';
        }
        return;
      }
      
      const equipmentItems = col2.querySelectorAll('button[data-equipment-id]');
      const totalItems = equipmentItems.length;
      
             equipmentItems.forEach(btn => {
        if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress) {
          btn.style.opacity = '0.5';
          btn.style.cursor = 'not-allowed';
          btn.disabled = true;
        } else {
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
          btn.disabled = false;
        }
      });
      
      if (totalItems === 0) {
        statusText.textContent = 'No equipment selected';
      } else if (totalItems === 1) {
        statusText.textContent = `1 item selected for disenchant`;
      } else {
        statusText.textContent = `${totalItems} items selected for disenchant`;
      }
    } catch (error) {
      handleError(error, 'updateDisenchantStatus', false);
    }
  }

   function transferToDisenchant(equipment) {
     try {
       if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress) {
         console.warn('[Better Forge] Cannot select equipment while disenchanting is in progress');
         return;
       }
       
       const col2 = document.getElementById('disenchant-col2');
       
       if (!col2) return;
       
       const existingBtn = col2.querySelector(`[data-equipment-id="${equipment.id}"]`);
       if (existingBtn) {
         return;
       }
       
       const instructionText = col2.querySelector('div[style*="grid-column: span 7"]');
       if (instructionText) {
         instructionText.remove();
       }
       
       const btn = createDisenchantEquipmentButton(equipment, 'col2');
       col2.appendChild(btn);
       
       hideEquipmentFromArsenal(equipment);
       
       if (forgeState.isConfirmationMode) {
         resetConfirmationMode();
       }
       
       updateDisenchantStatus();
       
     } catch (error) {
       handleError(error, 'transferToDisenchant', false);
     }
   }

   function transferEquipment(equipment, sourceColumn) {
     try {
       if (forgeState.isDisenchanting || forgeState.isDisenchantingInProgress) {
         console.warn('[Better Forge] Cannot remove equipment while disenchanting is in progress');
         return;
       }
       
       const col2 = document.getElementById('disenchant-col2');
       
       if (!col2) return;
       
       const sourceBtn = document.querySelector(`[data-equipment-id="${equipment.id}"][data-source-column="${sourceColumn}"]`);
       if (sourceBtn) {
         sourceBtn.remove();
         
         showEquipmentInArsenal(equipment);
         
         if (col2.children.length === 0) {
           col2.innerHTML = '<div style="color:#bbb;text-align:center;padding:16px;grid-column: span 7;">Click equipment in Arsenal to select for disenchant</div>';
         }
         
         if (forgeState.isConfirmationMode) {
           resetConfirmationMode();
         }
         
         updateDisenchantStatus();
       }
       
     } catch (error) {
       handleError(error, 'transferEquipment', false);
     }
   }

   function hideEquipmentFromArsenal(equipment) {
     try {
       const arsenalButtons = document.querySelectorAll('button[data-equipment]');
       for (const btn of arsenalButtons) {
         if (btn.getAttribute('data-equipment') === equipment.name && 
             btn.getAttribute('data-equipment-id') === equipment.id) {
           btn.style.display = 'none';
           break;
         }
       }
     } catch (error) {
       handleError(error, 'hideEquipmentFromArsenal', false);
     }
   }

   function showEquipmentInArsenal(equipment) {
     try {
       const arsenalButtons = document.querySelectorAll('button[data-equipment]');
       for (const btn of arsenalButtons) {
         if (btn.getAttribute('data-equipment') === equipment.name && 
             btn.getAttribute('data-equipment-id') === equipment.id) {
           btn.style.display = 'flex';
           break;
         }
       }
     } catch (error) {
       handleError(error, 'showEquipmentInArsenal', false);
     }
   }

  function hideSelectedEquipmentFromArsenal() {
    try {
      const col2 = document.getElementById('disenchant-col2');
      if (!col2) return;
      
      const selectedEquipmentIds = Array.from(col2.querySelectorAll('button[data-equipment-id]'))
        .map(btn => btn.getAttribute('data-equipment-id'));
      
      const arsenalScrollArea = document.querySelector('div[style*="grid-template-columns: repeat(6, 34px)"]');
      if (!arsenalScrollArea) return;
      
      selectedEquipmentIds.forEach(equipmentId => {
        const arsenalBtn = arsenalScrollArea.querySelector(`button[data-equipment-id="${equipmentId}"]`);
        if (arsenalBtn) {
          arsenalBtn.style.display = 'none';
        }
      });
    } catch (error) {
      console.warn('[Better Forge] Error hiding selected equipment:', error);
    }
  }
  
  function removeEquipmentFromLocalInventory(equipmentId) {
    try {
      if (!globalThis.state) {
        return;
      }
      
      const player = globalThis.state.player;
      if (!player) {
        return;
      }
      
      if (typeof player.send !== 'function') {
        return;
      }
      
      const currentState = player.getSnapshot?.();
      
      if (!currentState?.context?.equips) {
        return;
      }
      
              player.send({
          type: "setState",
          fn: (prev) => {
            if (prev?.equips) {
              const filteredEquips = prev.equips.filter(e => e.id !== equipmentId);
              return {
                ...prev,
                equips: filteredEquips
              };
            }
            
            if (prev?.context?.equips) {
              const filteredEquips = prev.context.equips.filter(e => e.id !== equipmentId);
              return {
                ...prev,
                context: {
                  ...prev.context,
                  equips: filteredEquips
                }
              };
            }
            
            return prev;
          },
        });
      
    } catch (e) {
      console.warn('[Better Forge] Failed to update local inventory for equipment:', e);
    }
  }

  function updateLocalInventoryGoldDust(goldChange = 0, dustChange = 0) {
    try {
      const player = globalThis.state?.player;
      if (!player) return;
      
      player.send({
        type: "setState",
        fn: (prev) => {
          const newState = { ...prev };
          newState.inventory = { ...prev.inventory };
          
          const currentGold = prev.inventory?.gold ?? prev.gold ?? 0;
          const currentDust = prev.inventory?.dust ?? prev.dust ?? 0;
          
          if (goldChange !== 0) {
            newState.inventory.gold = currentGold + goldChange;
            newState.gold = newState.inventory.gold;
          }
          
          if (dustChange !== 0) {
            newState.inventory.dust = currentDust + dustChange;
            newState.dust = newState.inventory.dust;
          }
          
          return newState;
        },
      });
      
    } catch (e) {
      console.warn('[Better Forge] Failed to update local inventory gold/dust:', e);
    }
  }
  

  
  function restoreEquipmentToArsenal() {
    try {
      const col2 = document.getElementById('disenchant-col2');
      
      if (!col2) return;
      
      const disenchantButtons = col2.querySelectorAll('button[data-equipment-id]');
      
      disenchantButtons.forEach(btn => {
        const equipmentId = btn.getAttribute('data-equipment-id');
        const equipmentName = btn.getAttribute('data-equipment');
        
        const arsenalButtons = document.querySelectorAll('button[data-equipment]');
        for (const arsenalBtn of arsenalButtons) {
          if (arsenalBtn.getAttribute('data-equipment') === equipmentName && 
              arsenalBtn.getAttribute('data-equipment-id') === equipmentId) {
            arsenalBtn.style.display = 'flex';
            break;
          }
        }
      });
      
      setTimeout(() => {
        try {
          const hiddenArsenalButtons = document.querySelectorAll('button[data-equipment][style*="display: none"]');
          hiddenArsenalButtons.forEach(btn => {
            btn.style.display = 'flex';
          });
          
          const arsenalScrollArea = document.querySelector('div[style*="grid-template-columns: repeat(6, 34px)"]');
          if (arsenalScrollArea) {
            arsenalScrollArea.style.opacity = '0.99';
            setTimeout(() => {
              arsenalScrollArea.style.opacity = '1';
            }, 10);
          }
        } catch (refreshError) {
          console.warn('[Better Forge] Could not refresh Arsenal display:', refreshError);
        }
      }, 100);
      
    } catch (error) {
      handleError(error, 'restoreEquipmentToArsenal', false);
    }
  }

   // ============================================================================
  // 12. INITIALIZATION AND CLEANUP FUNCTIONS
  // ============================================================================
  
  function injectBetterForgeButtonStyles() {
    if (!document.getElementById('betterforge-btn-css')) {
      const style = document.createElement('style');
      style.id = 'betterforge-btn-css';
      style.textContent = `
        .betterforge-btn {
          background: url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat !important;
          border: 6px solid transparent !important;
          border-color: #ffe066 !important;
          border-image: url('https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png') 6 fill stretch !important;
          color: var(--theme-text, #e6d7b0) !important;
          font-weight: 700 !important;
          border-radius: 0 !important;
          box-sizing: border-box !important;
          transition: color 0.2s, border-image 0.1s !important;
          font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif !important;
          outline: none !important;
          position: relative !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 16px !important;
          padding: 7px 24px !important;
          cursor: pointer !important;
          flex: 1 1 0 !important;
          min-width: 0 !important;
          margin: 0 !important;
        }
        .betterforge-btn.pressed,
        .betterforge-btn:active {
          border-image: url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png') 6 fill stretch !important;
        }
        
        .auto-upgrade-item {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          cursor: pointer;
          border: 1px solid transparent;
          height: 34px;
          min-height: 34px;
        }
        
        .auto-upgrade-item:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
        }
        
        .auto-upgrade-item.selected {
          border-color: #4CAF50 !important;
        }
        
        .auto-upgrade-tier {
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e6d7b0;
          font-size: 8px;
          font-weight: bold;
          text-align: center;
          padding: 1px;
          cursor: pointer;
          border: 2px solid;
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
          width: 35px;
          height: 15px;
          min-width: 35px;
          min-height: 15px;
          max-width: 35px;
          max-height: 15px;
        }
        
        .auto-upgrade-tier:hover {
          background: rgba(255,255,255,0.15);
        }
        
        .auto-upgrade-tier.selected {
          outline: 2px solid #4CAF50 !important;
          outline-offset: 2px !important;
        }
        
        .auto-upgrade-stat {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          cursor: pointer;
          border: 1px solid transparent;
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
          flex: 1;
        }
        
        .auto-upgrade-stat:hover {
          background: rgba(255,255,255,0.15);
          border-color: rgba(255,255,255,0.3);
        }
        
        .auto-upgrade-stat.selected {
          border-color: #4CAF50 !important;
        }
      `;
      document.head.appendChild(style);
    }
  }

  let inventoryObserver = null;
  let buttonCheckInterval = null;
  let lastButtonCheck = 0;
  let failedAttempts = 0;
  let hasLoggedInventoryNotFound = false;
  
  function observeInventory() {
    try {
      if (inventoryObserver) {
        try { 
          inventoryObserver.disconnect(); 
        } catch (e) {
          console.warn('[Better Forge] Error disconnecting observer:', e);
        }
        inventoryObserver = null;
      }
      
      if (buttonCheckInterval) {
        clearInterval(buttonCheckInterval);
        buttonCheckInterval = null;
      }
      
      failedAttempts = 0;
      hasLoggedInventoryNotFound = false;
      
      lastButtonCheck = Date.now();
      buttonCheckInterval = setInterval(() => {
        try {
          const now = Date.now();
          if (now - lastButtonCheck > FORGE_CONFIG.BUTTON_CHECK_TIMEOUT) {
            clearInterval(buttonCheckInterval);
            buttonCheckInterval = null;
            return;
          }
          
          addBetterForgeButton();
        } catch (error) {
          handleError(error, 'button check interval', false);
        }
      }, FORGE_CONFIG.BUTTON_CHECK_INTERVAL);
      
      inventoryObserver = new MutationObserver((mutations) => {
        try {
          let shouldCheck = false;
          
          for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList?.contains('container-inventory-4') ||
                    node.querySelector?.('.container-inventory-4') ||
                    node.querySelector?.('button.focus-style-visible')) {
                  shouldCheck = true;
                  break;
                }
              }
            }
            
            if (shouldCheck) break;
          }
          
          if (shouldCheck) {
            addBetterForgeButton();
          }
        } catch (error) {
          handleError(error, 'mutation observer', false);
        }
      });
      
      inventoryObserver.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: false,
        characterData: false
      });
      
      addBetterForgeButton();
    } catch (error) {
      handleError(error, 'observeInventory', false);
    }
  }
  
  function addBetterForgeButton() {
    try {
      if (document.querySelector('.better-forge-inventory-button')) {
        failedAttempts = 0;
        hasLoggedInventoryNotFound = false;
        return;
      }
      
      const isOnInventoryPage = document.querySelector('.container-inventory-4') || 
                               document.querySelector('[data-page="inventory"]') ||
                               window.location.pathname.includes('inventory');
      
      if (!isOnInventoryPage) {
        return;
      }
      
      let inventoryContainer = document.querySelector('.container-inventory-4');
      
      if (!inventoryContainer) {
        failedAttempts++;
        if (failedAttempts >= FORGE_CONFIG.LOG_AFTER_ATTEMPTS && !hasLoggedInventoryNotFound) {
          console.log('[Better Forge] Inventory container not found, will retry...');
          hasLoggedInventoryNotFound = true;
        }
        return;
      }
      
      const forgeMiniElement = inventoryContainer.querySelector('img[src="/assets/misc/forge-mini.png"]');
      let targetButton = null;
      
      if (forgeMiniElement) {
        targetButton = forgeMiniElement.closest('button') || forgeMiniElement.closest('.focus-style-visible') || forgeMiniElement.parentElement;
      } else {
        const inventoryButtons = inventoryContainer.querySelectorAll('button.focus-style-visible');
        if (inventoryButtons.length > 0) {
          targetButton = inventoryButtons[inventoryButtons.length - 1];
        }
      }
      
      if (!targetButton) {
        failedAttempts++;
        if (failedAttempts >= FORGE_CONFIG.LOG_AFTER_ATTEMPTS && !hasLoggedInventoryNotFound) {
          console.log('[Better Forge] Target button not found, will retry...');
          hasLoggedInventoryNotFound = true;
        }
        return;
      }
      
      const forgeButton = document.createElement('button');
      forgeButton.className = 'focus-style-visible active:opacity-70 better-forge-inventory-button';
      forgeButton.innerHTML = `
        <div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image">
          <div class="has-rarity relative grid h-full place-items-center">
                       <img src="${SMITH_ICON_URL}" alt="Better Forge" style="width: 32px; height: 32px; object-fit: contain;">
          </div>
        </div>
      `;
      forgeButton.addEventListener('click', () => { 
        try {
          showBetterForgeModal(); 
        } catch (error) {
          handleError(error, 'forge button click', true);
        }
      });
      
      targetButton.insertAdjacentElement('afterend', forgeButton);
      failedAttempts = 0;
      hasLoggedInventoryNotFound = false;
      
      if (buttonCheckInterval) {
        clearInterval(buttonCheckInterval);
        buttonCheckInterval = null;
      }
    } catch (error) {
      handleError(error, 'addBetterForgeButton', false);
    }
  }
  
  function cleanup() {
    try {
             clearAllIntervals();
       
       if (buttonCheckInterval) {
         clearInterval(buttonCheckInterval);
         buttonCheckInterval = null;
       }
       
       forgeState.isDisenchanting = false;
       forgeState.isDisenchantingInProgress = false;
       forgeState.isConfirmationMode = false;
       forgeState.rateLimitedEquipment.clear();
       forgeState.rateLimitedEquipmentRetryCount.clear();
       
       // Clean up forging state
       forgeState.isForging = false;
       forgeState.isForgingInProgress = false;
       forgeState.isForgeConfirmationMode = false;
       forgeState.forgeQueue = [];
       forgeState.currentForgeStep = null;
       forgeState.forgeRateLimit = {
         lastRequest: 0,
         requestCount: 0,
         maxRequests: 30,
         timeWindow: 10000
       };
       forgeState.highlightedEquipment.clear();
       forgeState.intermediateResults.clear();
       
       removeEscKeyHandler();
       
       failedAttempts = 0;
       hasLoggedInventoryNotFound = false;
       
       clearDomCache();
       
       if (inventoryObserver) {
        try { 
          inventoryObserver.disconnect(); 
        } catch (e) {
          console.warn('[Better Forge] Error disconnecting observer:', e);
        }
        inventoryObserver = null;
      }
      
      // Remove UI elements
             try {
         const forgeButtons = document.querySelectorAll('.better-forge-inventory-button');
         forgeButtons.forEach(btn => {
           try {
             btn.remove();
           } catch (e) {
             console.warn('[Better Forge] Error removing button:', e);
           }
         });
       } catch (e) {
         console.warn('[Better Forge] Error removing forge buttons:', e);
       }
       
       try {
         const injectedStyle = document.getElementById('betterforge-btn-css');
         if (injectedStyle) {
           injectedStyle.remove();
         }
       } catch (e) {
         console.warn('[Better Forge] Error removing injected styles:', e);
       }
       
       if (typeof window !== 'undefined') {
        try {
          if (window.BetterForge) {
            delete window.BetterForge.cleanup;
            delete window.BetterForge;
          }
        } catch (e) {
          console.warn('[Better Forge] Error cleaning global state:', e);
        }
      }
      
    } catch (error) {
      console.error('[Better Forge] Error during cleanup:', error);
    }
  }
  
  if (config.enabled) {
    try {
      observeInventory();
    } catch (error) {
      handleError(error, 'initialization', false);
    }
  }
  
  if (typeof exports !== 'undefined') {
    exports.cleanup = cleanup;
    exports.showModal = showBetterForgeModal;
  }
  
  if (typeof window !== 'undefined') {
    window.BetterForge = window.BetterForge || {};
    window.BetterForge.cleanup = cleanup;
    window.BetterForge.showModal = showBetterForgeModal;
  }
  
  // Force refresh player state to ensure latest inventory data
  const forceRefreshPlayerState = async () => {
    try {
      console.log(`[Better Forge] 🔄 Forcing player state refresh...`);
      
      // Clear any cached data
      if (typeof clearInventoryCache === 'function') {
        clearInventoryCache();
      }
      
      // Force multiple state snapshots to ensure fresh data
      if (globalThis.state?.player?.getSnapshot) {
        for (let i = 0; i < 5; i++) {
          globalThis.state.player.getSnapshot();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Additional delay to ensure state is fully updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`[Better Forge] ✅ Player state refresh completed`);
      return true;
    } catch (error) {
      console.error(`[Better Forge] 💥 Error forcing player state refresh:`, error);
      return false;
    }
  };
  
})();
