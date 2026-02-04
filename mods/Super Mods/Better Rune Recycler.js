(function () {
  'use strict';

  console.log('[Better Rune Recycler] Mod loaded');

  // Translation helper (use api from loader, context, or BestiaryModAPI)
  const t = (key) => {
    const a = (typeof api !== 'undefined' && api) ? api : (typeof context !== 'undefined' && context && context.api) ? context.api : window.BestiaryModAPI;
    return (a && a.i18n && typeof a.i18n.t === 'function') ? a.i18n.t(key) : key;
  };

  // =====================================================
  // Constants and Configuration
  // =====================================================
  
  const MOD_NAME = 'Better Rune Recycler';
  
  const MODAL_WIDTH = 750;              // Main modal width in pixels (wide layout: col1 + col2)
  const MODAL_HEIGHT = 500;             // Main modal height in pixels
  const MODAL_PADDING_WIDTH = 30;       // Padding to subtract from width for content
  const MODAL_PADDING_HEIGHT = 50;      // Padding to subtract from height for content
  
  // Rune list from inventory database (single source of truth); fallback if DB not loaded yet
  const RUNE_KEYS_ORDER = ['runeAvarice', 'runeHp', 'runeAp', 'runeAd', 'runeAr', 'runeMr', 'runeBlank', 'runeRecycle', 'runeKaleidoscopic', 'runeRecycleMonster', 'runeConversionHp', 'runeConversionAd', 'runeConversionAp'];
  const RUNE_DB_ALIAS = { runeRecycleMonster: 'runeKaleidoscopic' }; // game API may return runeRecycleMonster
  const RUNE_TYPES = (function () {
    const db = (typeof window !== 'undefined' && window.inventoryDatabase?.tooltips) ? window.inventoryDatabase.tooltips : null;
    return RUNE_KEYS_ORDER.map(key => {
      const dbKey = RUNE_DB_ALIAS[key] || key;
      const entry = db && db[dbKey] ? db[dbKey] : null;
      return {
        key: key,
        displayName: entry?.displayName || (key.replace(/^rune/, '').replace(/([A-Z])/g, ' $1').trim() + ' Rune'),
        icon: entry?.icon || '/assets/icons/rune-blank.png',
        rarity: entry?.rarity || '3'
      };
    });
  })();

  // =====================================================
  // State Management
  // =====================================================
  
  let isRuneRecyclerActive = false;
  let recycleInProgress = false;
  
  // Recycling configuration
  let recyclingConfig = {
    runeAvarice: 0,
    runeHp: 0,
    runeAp: 0,
    runeAd: 0,
    runeAr: 0,
    runeMr: 0,
    runeRecycle: 0,
    cycles: 1,
    useBlankRune: false, // if true, use blank rune after each recycle when available
    useMaxCycles: false, // if true, run until no runes/gold left instead of fixed cycles
  };
  
  // Statistics tracking
  let recyclingStats = {
    cyclesCompleted: 0,
    totalCyclesTarget: null, // set at start of each run so "X / Y" keeps Y fixed
    runesConsumed: {},
    runesCreated: {},
    goldSpent: 0,
    errors: 0,
  };
  
  // API rate limiting
  const API_DELAY = 500; // ms between API calls
  const BLANK_RUNE_GOLD_COST = 3000; // gold cost per blank rune use
  const RECYCLE_GOLD_COST = 5000; // gold cost per recycle


  // =====================================================
  // Game State API Access
  // =====================================================

  /**
   * Get player's inventory from game state
   */
  function getPlayerInventory() {
    try {
      const inventory = globalThis.state?.player?.getSnapshot?.()?.context?.inventory;
      return inventory || null;
    } catch (error) {
      console.error('[Better Rune Recycler] Error getting inventory:', error);
      return null;
    }
  }

  /**
   * Get count of a specific rune type in inventory
   */
  function getRuneCount(runeKey) {
    const inventory = getPlayerInventory();
    if (!inventory) return 0;
    return inventory[runeKey] || 0;
  }

  /**
   * Get all rune counts
   */
  function getAllRuneCounts() {
    const inventory = getPlayerInventory();
    if (!inventory) return {};
    
    const counts = {};
    RUNE_TYPES.forEach(rune => {
      counts[rune.key] = inventory[rune.key] || 0;
    });
    
    return counts;
  }

  /**
   * Log current inventory state
   */
  function logInventoryState() {
    const runeCounts = getAllRuneCounts();
    console.log('[Better Rune Recycler] Current rune inventory:', runeCounts);
  }

  /**
   * Get player's current gold
   */
  function getPlayerGold() {
    try {
      const gold = globalThis.state?.player?.getSnapshot?.()?.context?.gold;
      return gold || 0;
    } catch (error) {
      console.error('[Better Rune Recycler] Error getting gold:', error);
      return 0;
    }
  }

  // =====================================================
  // Rune Recycling Logic
  // =====================================================

  /**
   * Update local inventory based on API response
   */
  function updateLocalInventory(inventoryDiff, goldDiff) {
    try {
      // Update via globalThis.state if available
      if (globalThis.state?.player?.send) {
        globalThis.state.player.send({
          type: 'setState',
          fn: (prev) => {
            const newInventory = { ...prev.inventory };
            const newGold = prev.gold + (goldDiff || 0);
            
            // Apply inventory differences
            if (inventoryDiff) {
              Object.keys(inventoryDiff).forEach(key => {
                const currentAmount = newInventory[key] || 0;
                const change = inventoryDiff[key];
                newInventory[key] = Math.max(0, currentAmount + change);
              });
            }
            
            return { 
              ...prev, 
              inventory: newInventory,
              gold: newGold
            };
          }
        });
        console.log('[Better Rune Recycler] Local inventory updated via state.player.send');
      } else {
        console.warn('[Better Rune Recycler] Cannot update local inventory - state.player.send not available');
      }
    } catch (error) {
      console.error('[Better Rune Recycler] Error updating local inventory:', error);
    }
  }

  /**
   * Perform a single rune recycle via API
   */
  async function performRuneRecycle(rune1, rune2, rune3) {
    try {
      const url = 'https://bestiaryarena.com/api/trpc/inventory.useRecycleRune?batch=1';
      const payload = {
        "0": {
          "json": [rune1, rune2, rune3]
        }
      };

      console.log('[Better Rune Recycler] Performing recycle with:', [rune1, rune2, rune3]);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
          'x-game-version': '1'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      console.log('[Better Rune Recycler] Recycle response:', data);

      // Parse the response
      const result = data[0]?.result?.data?.json;
      if (!result) {
        throw new Error('Invalid response format');
      }

      // Update local inventory immediately
      updateLocalInventory(result.inventoryDiff, result.goldDiff);

      return {
        success: true,
        inventoryDiff: result.inventoryDiff,
        goldDiff: result.goldDiff,
        runeCreated: result.rune,
        achievementUnlocked: result.achiev
      };

    } catch (error) {
      console.error('[Better Rune Recycler] Error performing recycle:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Use one Blank Rune via API (e.g. to convert to another rune).
   */
  async function performUseBlankRune() {
    try {
      const url = 'https://bestiaryarena.com/api/trpc/inventory.useBlankRune?batch=1';
      const payload = { "0": { "json": null, "meta": { "values": ["undefined"] } } };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'content-type': 'application/json',
          'x-game-version': '1'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const data = await response.json();
      const result = data[0]?.result?.data?.json;
      if (result && result.inventoryDiff != null) {
        updateLocalInventory(result.inventoryDiff, result.goldDiff || 0);
        return { success: true, inventoryDiff: result.inventoryDiff };
      } else {
        updateLocalInventory({ runeBlank: -1 }, 0);
        return { success: true, inventoryDiff: { runeBlank: -1 } };
      }
    } catch (error) {
      console.error('[Better Rune Recycler] Error using blank rune:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Returns true if we can perform at least one more cycle (either blank or recycle).
   */
  function canDoOneMoreCycle() {
    const config = recyclingConfig;
    const inv = getPlayerInventory();
    if (!inv) return false;
    const gold = getPlayerGold();
    const sacrifice = buildSacrificeArray(config);
    const useBlank = config.useBlankRune && (inv.runeBlank || 0) > 0 && gold >= BLANK_RUNE_GOLD_COST;
    if (useBlank) return true;
    if (gold < RECYCLE_GOLD_COST) return false;
    const needRecycle = 1 + sacrifice.filter(k => k === 'runeRecycle').length;
    if ((inv.runeRecycle || 0) < needRecycle) return false;
    for (const key of sacrifice) {
      const count = inv[key] || 0;
      const need = (key === 'runeRecycle' ? needRecycle : 1);
      if (count < need) return false;
    }
    return true;
  }

  /**
   * Validate if recycling is possible with current resources.
   * When useBlankRune is on, blank cycles cost 3000 gold each, recycle cycles cost 5000 each.
   * When useMaxCycles is on, we only need to be able to do at least one cycle.
   */
  function validateRecycling(config) {
    const inventory = getPlayerInventory();
    if (!inventory) {
      return { valid: false, reason: 'Cannot access inventory' };
    }

    const gold = getPlayerGold();
    const cycles = config.useMaxCycles ? 1 : (config.cycles || 1);
    const blankCount = (inventory.runeBlank || 0);
    const useBlank = !!config.useBlankRune;
    const blankCycles = useBlank ? Math.min(blankCount, cycles) : 0;
    const recycleCycles = cycles - blankCycles;

    if (config.useMaxCycles && !canDoOneMoreCycle()) {
      return { valid: false, reason: t('mods.betterRuneRecycler.cannotPerformOneCycle') };
    }

    // Gold: 3000 per blank cycle, 5000 per recycle cycle
    const goldNeeded = blankCycles * BLANK_RUNE_GOLD_COST + recycleCycles * RECYCLE_GOLD_COST;
    if (gold < goldNeeded) {
      return { valid: false, reason: `Not enough gold (have ${gold}, need ${goldNeeded})` };
    }

    // Check if we have enough runes to sacrifice for recycle cycles (including Recycle Runes if used)
    const runesNeeded = {
      runeAvarice: config.runeAvarice * recycleCycles,
      runeHp: config.runeHp * recycleCycles,
      runeAp: config.runeAp * recycleCycles,
      runeAd: config.runeAd * recycleCycles,
      runeAr: config.runeAr * recycleCycles,
      runeMr: config.runeMr * recycleCycles,
      runeRecycle: config.runeRecycle * recycleCycles,
    };
    runesNeeded.runeRecycle += recycleCycles;

    for (const [runeKey, needed] of Object.entries(runesNeeded)) {
      if (needed > 0) {
        const available = inventory[runeKey] || 0;
        if (available < needed) {
          const runeName = RUNE_TYPES.find(r => r.key === runeKey)?.displayName || runeKey;
          const forRecycling = runeKey === 'runeRecycle' ? ` (${recycleCycles} to use + ${config.runeRecycle * recycleCycles} to sacrifice)` : '';
          return { valid: false, reason: `Not enough ${runeName}${forRecycling} (have ${available}, need ${needed})` };
        }
      }
    }

    // Check if exactly 3 runes are selected per cycle (needed when we do any recycle)
    const totalRunesPerCycle = config.runeAvarice + config.runeHp + config.runeAp + config.runeAd + config.runeAr + config.runeMr + config.runeRecycle;
    if (totalRunesPerCycle !== 3) {
      return { valid: false, reason: `Must select exactly 3 runes per cycle (currently ${totalRunesPerCycle})` };
    }

    return { valid: true };
  }

  /**
   * Get maximum cycles possible with current rune selection, inventory, and gold.
   * When useBlankRune is on: blank cycles cost 3000 gold each, recycle cycles 5000 each.
   */
  function getMaxCycles() {
    const totalRunesPerCycle = recyclingConfig.runeAvarice + recyclingConfig.runeHp + recyclingConfig.runeAp +
      recyclingConfig.runeAd + recyclingConfig.runeAr + recyclingConfig.runeMr + recyclingConfig.runeRecycle;
    if (totalRunesPerCycle !== 3) return 999;

    const inventory = getPlayerInventory();
    if (!inventory) return 999;

    const gold = getPlayerGold();

    const perCycle = {
      runeAvarice: recyclingConfig.runeAvarice,
      runeHp: recyclingConfig.runeHp,
      runeAp: recyclingConfig.runeAp,
      runeAd: recyclingConfig.runeAd,
      runeAr: recyclingConfig.runeAr,
      runeMr: recyclingConfig.runeMr,
      runeRecycle: recyclingConfig.runeRecycle + 1, // +1 for the 1 Recycle Rune cost per cycle
    };

    let maxRecycleCyclesFromRunes = 999;
    for (const [runeKey, needPerCycle] of Object.entries(perCycle)) {
      if (needPerCycle > 0) {
        const available = inventory[runeKey] || 0;
        maxRecycleCyclesFromRunes = Math.min(maxRecycleCyclesFromRunes, Math.floor(available / needPerCycle));
      }
    }
    maxRecycleCyclesFromRunes = Math.max(0, maxRecycleCyclesFromRunes);

    if (recyclingConfig.useBlankRune) {
      const blankCount = inventory.runeBlank || 0;
      const maxBlankFromGold = Math.floor(gold / BLANK_RUNE_GOLD_COST);
      const maxBlankCycles = Math.min(blankCount, maxBlankFromGold);
      const goldAfterBlanks = gold - maxBlankCycles * BLANK_RUNE_GOLD_COST;
      const maxRecycleFromGold = Math.floor(goldAfterBlanks / RECYCLE_GOLD_COST);
      const maxRecycleCycles = Math.min(maxRecycleCyclesFromRunes, maxRecycleFromGold);
      return Math.max(1, maxBlankCycles + maxRecycleCycles);
    }

    const maxFromGold = Math.floor(gold / RECYCLE_GOLD_COST);
    const maxRecycleCycles = Math.min(maxRecycleCyclesFromRunes, maxFromGold);
    return Math.max(1, maxRecycleCycles);
  }

  /**
   * Build the sacrifice array for one cycle based on config
   */
  function buildSacrificeArray(config) {
    const sacrifice = [];
    
    // Add runes based on configuration
    for (let i = 0; i < config.runeAvarice; i++) sacrifice.push('runeAvarice');
    for (let i = 0; i < config.runeHp; i++) sacrifice.push('runeHp');
    for (let i = 0; i < config.runeAp; i++) sacrifice.push('runeAp');
    for (let i = 0; i < config.runeAd; i++) sacrifice.push('runeAd');
    for (let i = 0; i < config.runeAr; i++) sacrifice.push('runeAr');
    for (let i = 0; i < config.runeMr; i++) sacrifice.push('runeMr');
    for (let i = 0; i < config.runeRecycle; i++) sacrifice.push('runeRecycle');
    
    return sacrifice;
  }

  /**
   * Reset statistics
   */
  function resetStats() {
    recyclingStats = {
      cyclesCompleted: 0,
      totalCyclesTarget: null,
      runesConsumed: {},
      runesCreated: {},
      goldSpent: 0,
      errors: 0,
    };
  }

  /**
   * Update statistics after a recycle
   */
  function updateStats(result, sacrifice) {
    if (result.success) {
      recyclingStats.cyclesCompleted++;
      
      // Track consumed runes (the 3 sacrificed)
      sacrifice.forEach(runeKey => {
        if (!recyclingStats.runesConsumed[runeKey]) {
          recyclingStats.runesConsumed[runeKey] = 0;
        }
        recyclingStats.runesConsumed[runeKey]++;
      });
      // Each recycle also consumes 1 Recycle Rune as the cost to use the recycler
      recyclingStats.runesConsumed['runeRecycle'] = (recyclingStats.runesConsumed['runeRecycle'] || 0) + 1;
      
      // Track created rune
      const createdRune = result.runeCreated;
      if (createdRune) {
        recyclingStats.runesCreated[createdRune] = (recyclingStats.runesCreated[createdRune] || 0) + 1;
      }
      
      // Track gold spent
      recyclingStats.goldSpent += Math.abs(result.goldDiff || 0);
    } else {
      recyclingStats.errors++;
    }
  }

  /**
   * Update statistics after using a Blank Rune (instead of recycling for that cycle).
   * Blank rune use costs BLANK_RUNE_GOLD_COST gold.
   */
  function updateStatsForBlankRune(blankResult) {
    if (!blankResult.success) return;
    recyclingStats.cyclesCompleted++;
    recyclingStats.runesConsumed['runeBlank'] = (recyclingStats.runesConsumed['runeBlank'] || 0) + 1;
    recyclingStats.goldSpent += BLANK_RUNE_GOLD_COST;
    const diff = blankResult.inventoryDiff;
    if (diff && typeof diff === 'object') {
      const runeKeys = ['runeAvarice', 'runeHp', 'runeAp', 'runeAd', 'runeAr', 'runeMr', 'runeBlank', 'runeRecycle', 'runeKaleidoscopic', 'runeRecycleMonster', 'runeConversionHp', 'runeConversionAd', 'runeConversionAp'];
      for (const runeKey of runeKeys) {
        const delta = diff[runeKey];
        if (typeof delta === 'number' && delta > 0) {
          recyclingStats.runesCreated[runeKey] = (recyclingStats.runesCreated[runeKey] || 0) + delta;
        }
      }
    }
  }

  /**
   * Start automated recycling process
   */
  async function startRecycling() {
    if (recycleInProgress) {
      console.log('[Better Rune Recycler] Recycling already in progress');
      return;
    }

    // Validate configuration
    const validation = validateRecycling(recyclingConfig);
    if (!validation.valid) {
      updateStatusMessage(validation.reason, 'error');
      return;
    }

    recycleInProgress = true;
    resetStats();
    const useMaxCycles = !!recyclingConfig.useMaxCycles;
    const totalCycles = useMaxCycles ? null : recyclingConfig.cycles;
    recyclingStats.totalCyclesTarget = totalCycles; // null = "Max" mode, show "X / Max"
    
    const sacrifice = buildSacrificeArray(recyclingConfig);

    const statusTotal = useMaxCycles ? t('mods.betterRuneRecycler.maxCheckboxLabel') : String(totalCycles);
    updateStatusMessage(useMaxCycles ? t('mods.betterRuneRecycler.startingRecyclingMax') : t('mods.betterRuneRecycler.startingRecycling').replace('{total}', statusTotal), 'info');
    updateStartStopButton(true);

    let i = 0;
    const runCycle = async () => {
      if (!recycleInProgress) return false;
      if (!isRuneRecyclerModalOpen()) {
        recycleInProgress = false;
        updateStatusMessage(t('mods.betterRuneRecycler.stoppedAtCycle').replace('{current}', String(i)).replace('{total}', statusTotal), 'warning');
        return false;
      }
      if (useMaxCycles && !canDoOneMoreCycle()) return false;

      updateStatusMessage(t('mods.betterRuneRecycler.recyclingProgress').replace('{current}', String(i + 1)).replace('{total}', statusTotal), 'info');

      const useBlankThisCycle = recyclingConfig.useBlankRune && getRuneCount('runeBlank') > 0 && getPlayerGold() >= BLANK_RUNE_GOLD_COST;

      if (useBlankThisCycle) {
        const blankResult = await performUseBlankRune();
        updateStatsForBlankRune(blankResult);
        if (!blankResult.success) {
          updateStatusMessage(t('mods.betterRuneRecycler.errorAtCycle').replace('{current}', String(i + 1)).replace('{error}', blankResult.error || ''), 'error');
          recycleInProgress = false;
          return false;
        }
      } else {
        const result = await performRuneRecycle(sacrifice[0], sacrifice[1], sacrifice[2]);
        updateStats(result, sacrifice);
        if (!result.success) {
          updateStatusMessage(t('mods.betterRuneRecycler.errorAtCycle').replace('{current}', String(i + 1)).replace('{error}', result.error || ''), 'error');
          recycleInProgress = false;
          return false;
        }
      }

      updateStatsDisplay();
      updateInventoryDisplay();
      i++;
      return true;
    };

    if (useMaxCycles) {
      while (recycleInProgress && isRuneRecyclerModalOpen() && canDoOneMoreCycle()) {
        const ok = await runCycle();
        if (!ok) break;
        const chunk = 100;
        for (let waited = 0; waited < API_DELAY && recycleInProgress && isRuneRecyclerModalOpen(); waited += chunk) {
          await new Promise(resolve => setTimeout(resolve, chunk));
        }
      }
      recyclingStats.totalCyclesTarget = recyclingStats.cyclesCompleted; // final "X / X" after max run
    } else {
      for (; i < totalCycles; ) {
        const ok = await runCycle();
        if (!ok) break;
        if (i < totalCycles) {
          const chunk = 100;
          for (let waited = 0; waited < API_DELAY && recycleInProgress && isRuneRecyclerModalOpen(); waited += chunk) {
            await new Promise(resolve => setTimeout(resolve, chunk));
          }
        }
      }
    }

    if (recycleInProgress) {
      recycleInProgress = false;
      const completed = recyclingStats.cyclesCompleted;
      const totalDisplay = recyclingStats.totalCyclesTarget != null ? String(recyclingStats.totalCyclesTarget) : statusTotal;
      updateStatusMessage(t('mods.betterRuneRecycler.completedCycles').replace('{completed}', String(completed)).replace('{total}', totalDisplay), 'success');
      updateStartStopButton(false);
      updateInventoryDisplay();
    } else {
      updateStartStopButton(false);
    }
  }

  /**
   * Stop the recycling process
   */
  function stopRecycling() {
    if (!recycleInProgress) return;
    
    recycleInProgress = false;
    updateStatusMessage(t('mods.betterRuneRecycler.stopping'), 'warning');
    console.log('[Better Rune Recycler] Recycling stopped by user');
  }

  /**
   * Check if the Better Rune Recycler modal is still open (like Autoscroller's isModalOpen).
   * When the user closes the modal (button, overlay, Escape), content is unmounted so our button is gone.
   */
  function isRuneRecyclerModalOpen() {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (!dialog) return false;
    return !!dialog.querySelector('#start-stop-btn');
  }

  // =====================================================
  // UI Components
  // =====================================================


  /**
   * Add Better Rune Recycler button inside the inventory grid (like Better Forge)
   */
  let buttonCheckInterval = null;
  let inventoryObserver = null;
  let failedAttempts = 0;
  let hasLoggedInventoryNotFound = false;
  const LOG_AFTER_ATTEMPTS = 5;

  function addRuneRecyclerButton() {
    // Check if button already exists
    if (document.querySelector('.better-rune-recycler-inventory-button')) {
      failedAttempts = 0;
      hasLoggedInventoryNotFound = false;
      return;
    }
    
    // Check if we're on the inventory page
    const isOnInventoryPage = document.querySelector('.container-inventory-4') || 
                             document.querySelector('[data-page="inventory"]') ||
                             window.location.pathname.includes('inventory');
    
    if (!isOnInventoryPage) {
      return; // Don't try to add button if not on inventory page
    }
    
    let inventoryContainer = document.querySelector('.container-inventory-4');
    
    if (!inventoryContainer) {
      failedAttempts++;
      if (failedAttempts >= LOG_AFTER_ATTEMPTS && !hasLoggedInventoryNotFound) {
        console.log('[Better Rune Recycler] Inventory container not found, will retry...');
        hasLoggedInventoryNotFound = true;
      }
      return;
    }
    
    // Look for the runes backpack (item ID 21445) in the inventory
    // The runes backpack has class "id-21445"
    let runesBackpackElement = inventoryContainer.querySelector('.id-21445, [class*="id-21445"]');
    let targetButton = null;
    
    if (runesBackpackElement) {
      // Find the button containing the runes backpack
      targetButton = runesBackpackElement.closest('button.focus-style-visible');
      if (!targetButton) {
        // Fallback: try to find parent button
        targetButton = runesBackpackElement.closest('button');
      }
    } else {
      // Fallback: use last button in inventory
      const inventoryButtons = inventoryContainer.querySelectorAll('button.focus-style-visible');
      if (inventoryButtons.length > 0) {
        targetButton = inventoryButtons[inventoryButtons.length - 1];
      }
    }
    
    if (!targetButton) {
      failedAttempts++;
      if (failedAttempts >= LOG_AFTER_ATTEMPTS && !hasLoggedInventoryNotFound) {
        console.log('[Better Rune Recycler] Target button not found, will retry...');
        hasLoggedInventoryNotFound = true;
      }
      return;
    }
    
    // Create the Better Rune Recycler button (following Better Forge pattern)
    const betterRuneRecyclerButton = document.createElement('button');
    betterRuneRecyclerButton.className = 'focus-style-visible active:opacity-70 better-rune-recycler-inventory-button';
    
    // Get inventory border style (same as Better Forge)
    const inventoryBorderStyle = window.betterUIConfig?.inventoryBorderStyle || 'Original';
    const borderDiv = window.getInventoryBorderStyle ? window.getInventoryBorderStyle(inventoryBorderStyle) : '';
    
    betterRuneRecyclerButton.innerHTML = `
      <div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image">
        <div class="relative grid h-full place-items-center">
          ${borderDiv}
          <img src="/assets/icons/rune-recycle.png" alt="Better Rune Recycler" style="width: 32px; height: 32px; object-fit: contain; position: relative; z-index: 2;">
          <div class="revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5" style="z-index: 3;"><span class="relative" style="line-height: 1; font-size: 12px; color: #fff; font-family: 'Yalla', 'Trebuchet MS', Arial, sans-serif; letter-spacing: 0; font-weight: 600; text-shadow: -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000; text-align: left; display: inline-block; width: 100%;" translate="no">${t('mods.betterRuneRecycler.buttonLabelAuto')}</span></div>
        </div>
      </div>
    `;
    
    betterRuneRecyclerButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[Better Rune Recycler] Button clicked');
      openRuneRecyclerModal();
    });
    
    // Insert after the target button
    if (targetButton.nextSibling) {
      targetButton.parentNode.insertBefore(betterRuneRecyclerButton, targetButton.nextSibling);
    } else {
      targetButton.parentNode.appendChild(betterRuneRecyclerButton);
    }
    
    failedAttempts = 0;
    hasLoggedInventoryNotFound = false;
    console.log('[Better Rune Recycler] Button added to inventory grid');
  }
  
  function observeInventory() {
    // Check periodically for button
    buttonCheckInterval = setInterval(() => {
      addRuneRecyclerButton();
    }, 1000);
    
    // Also observe DOM changes
    inventoryObserver = new MutationObserver((mutations) => {
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
        addRuneRecyclerButton();
      }
    });
    
    inventoryObserver.observe(document.body, { 
      childList: true, 
      subtree: true,
      attributes: false,
      characterData: false
    });
    
    addRuneRecyclerButton();
  }

  /**
   * Create a box component (matching Better Forge style)
   */
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
    contentWrapper.style.overflowX = 'hidden';
    contentWrapper.style.display = 'flex';
    contentWrapper.style.flexDirection = 'column';
    contentWrapper.style.alignItems = 'stretch';
    contentWrapper.style.justifyContent = 'flex-start';
    contentWrapper.style.padding = '0';
    
    if (typeof content === 'string') {
      contentWrapper.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      contentWrapper.appendChild(content);
    }
    box.appendChild(contentWrapper);
    return box;
  }

  /**
   * Open the Better Rune Recycler modal
   */
  function openRuneRecyclerModal() {
    try {
      // Check if API is available
      const api = window.BestiaryModAPI;
      if (!api || !api.ui || !api.ui.components || !api.ui.components.createModal) {
        console.error('[Better Rune Recycler] BestiaryModAPI not ready yet, retrying...');
        setTimeout(openRuneRecyclerModal, 500);
        return;
      }
      
      // Close existing modal if open (send ESC keys)
      for (let i = 0; i < 2; i++) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      }
      
      setTimeout(() => {
        try {
          // Calculate content dimensions based on modal size and padding
          const CONTENT_WIDTH = MODAL_WIDTH - MODAL_PADDING_WIDTH;
          const CONTENT_HEIGHT = MODAL_HEIGHT - MODAL_PADDING_HEIGHT;
          
          const contentDiv = document.createElement('div');
          contentDiv.style.width = '100%';
          contentDiv.style.height = '100%';
          contentDiv.style.minWidth = `${CONTENT_WIDTH}px`;
          contentDiv.style.maxWidth = `${CONTENT_WIDTH}px`;
          contentDiv.style.minHeight = `${CONTENT_HEIGHT}px`;
          contentDiv.style.maxHeight = `${CONTENT_HEIGHT}px`;
          contentDiv.style.boxSizing = 'border-box';
          contentDiv.style.overflow = 'hidden';
          contentDiv.style.display = 'flex';
          contentDiv.style.flexDirection = 'row';
          contentDiv.style.gap = '8px';
          contentDiv.style.flex = '1 1 0';
          
          // Col1: Configuration
          const configBox = createBox({
            title: t('mods.betterRuneRecycler.configuration'),
            content: getConfigContent()
          });
          configBox.style.flex = '1 1 0';
          configBox.style.minWidth = '0';
          configBox.style.height = '100%';
          
          // Col2: Statistics
          const statsBox = createBox({
            title: t('mods.betterRuneRecycler.statistics'),
            content: getStatsContent()
          });
          statsBox.style.flex = '1 1 0';
          statsBox.style.minWidth = '0';
          statsBox.style.height = '100%';
          
          contentDiv.appendChild(configBox);
          contentDiv.appendChild(statsBox);
          
          const modalInstance = api.ui.components.createModal({
            title: t('mods.betterRuneRecycler.modalTitle'),
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            content: contentDiv,
            buttons: [{ text: t('controls.close'), primary: true }],
            onClose: () => {
              // Force-stop recycling when modal is closed (by button, overlay, or Escape)
              if (recycleInProgress) {
                stopRecycling();
              }
              console.log('[Better Rune Recycler] Modal closed');
            }
          });
          
          if (modalInstance && typeof modalInstance.onClose === 'function') {
            modalInstance.onClose(() => {
              if (recycleInProgress) {
                stopRecycling();
              }
            });
          }
          
          setTimeout(() => {
            try {
              const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
              if (dialog) {
                dialog.style.width = `${MODAL_WIDTH}px`;
                dialog.style.minWidth = `${MODAL_WIDTH}px`;
                dialog.style.maxWidth = `${MODAL_WIDTH}px`;
                dialog.style.height = `${MODAL_HEIGHT}px`;
                dialog.style.minHeight = `${MODAL_HEIGHT}px`;
                dialog.style.maxHeight = `${MODAL_HEIGHT}px`;
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
              console.error('[Better Rune Recycler] Error styling dialog:', dialogError);
            }
          }, 50);
          
          // Setup event listeners after modal is created
          setTimeout(() => {
            setupModalEventListeners();
          }, 100);
          
          // Inject "Created by" footer into the modal footer
          setTimeout(() => {
            const modalElement = document.querySelector('div[role="dialog"][data-state="open"]');
            if (modalElement) {
              const footer = modalElement.querySelector('.flex.justify-end.gap-2');
              if (footer) {
                // Create "Created by" element
                const createdBy = document.createElement('div');
                createdBy.className = 'pixel-font-16';
                createdBy.style.cssText = `
                  font-size: 11px;
                  color: rgba(255, 255, 255, 0.6);
                  font-style: italic;
                  margin-right: auto;
                `;
                
                const createdByText = document.createTextNode(t('mods.betterRuneRecycler.createdBy'));
                const btlucasLink = document.createElement('a');
                btlucasLink.href = 'https://bestiaryarena.com/profile/btlucas';
                btlucasLink.target = '_blank';
                btlucasLink.rel = 'noopener noreferrer';
                btlucasLink.textContent = 'btlucas';
                btlucasLink.style.cssText = `
                  color: #61AFEF;
                  text-decoration: none;
                `;
                btlucasLink.addEventListener('mouseenter', () => {
                  btlucasLink.style.textDecoration = 'underline';
                });
                btlucasLink.addEventListener('mouseleave', () => {
                  btlucasLink.style.textDecoration = 'none';
                });
                
                createdBy.appendChild(createdByText);
                createdBy.appendChild(btlucasLink);
                
                // Modify footer to use space-between layout
                footer.style.cssText = `
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  gap: 2px;
                `;
                
                // Insert "Created by" at the beginning
                footer.insertBefore(createdBy, footer.firstChild);
              }
            }
          }, 100);
          
        } catch (contentError) {
          console.error('[Better Rune Recycler] Error creating modal content:', contentError);
        }
      }, 50);
    } catch (error) {
      console.error('[Better Rune Recycler] Error in openRuneRecyclerModal:', error);
    }
  }

  /**
   * Get configuration column content
   */
  function getConfigContent() {
    const runeCounts = getAllRuneCounts();
    
    // Only show common/sacrificable runes (exclude Blank, Kaleidoscopic, and Conversion runes)
    const nonSacrificableRunes = ['runeBlank', 'runeKaleidoscopic', 'runeRecycleMonster', 'runeConversionHp', 'runeConversionAd', 'runeConversionAp'];
    const recyclableRunes = RUNE_TYPES.filter(r => !nonSacrificableRunes.includes(r.key));
    
    const container = document.createElement('div');
    container.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;';
    
    // Info text
    const infoText = document.createElement('div');
    infoText.style.cssText = 'color: rgba(255,255,255,0.8); font-size: 15px; text-align: center; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 3px;';
    infoText.textContent = t('mods.betterRuneRecycler.infoText');
    container.appendChild(infoText);
    
    // Rune config grid
    const runeGrid = document.createElement('div');
    runeGrid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;';
    
    recyclableRunes.forEach(rune => {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 4px 6px;';
      
      const left = document.createElement('div');
      left.style.cssText = 'display: flex; align-items: center; gap: 4px;';
      
      const img = document.createElement('img');
      img.src = rune.icon;
      img.alt = rune.displayName;
      img.title = rune.displayName;
      img.style.cssText = 'width: 30px; height: 30px; cursor: help;';
      
      const count = document.createElement('span');
      count.style.cssText = 'font-size: 14px; color: #808080;';
      count.textContent = `(${runeCounts[rune.key] || 0})`;
      count.className = 'rune-count-display';
      count.dataset.runeKey = rune.key;
      
      left.appendChild(img);
      left.appendChild(count);
      
      const input = document.createElement('input');
      input.type = 'number';
      input.id = `config-${rune.key}`;
      input.min = '0';
      input.max = '3';
      input.value = String(recyclingConfig[rune.key] ?? 0);
      input.dataset.runeKey = rune.key;
      input.style.cssText = 'width: 55px; padding: 5px 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: rgb(255,255,255); font-size: 16px; text-align: center; font-weight: bold;';
      
      item.appendChild(left);
      item.appendChild(input);
      runeGrid.appendChild(item);
    });
    
    // Blank Rune cell inside same grid: icon + count, checkbox (Use when available)
    const blankRune = RUNE_TYPES.find(r => r.key === 'runeBlank');
    if (blankRune) {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 4px 6px;';
      const left = document.createElement('div');
      left.style.cssText = 'display: flex; align-items: center; gap: 4px;';
      const img = document.createElement('img');
      img.src = blankRune.icon;
      img.alt = blankRune.displayName;
      img.title = blankRune.displayName;
      img.style.cssText = 'width: 30px; height: 30px; cursor: help;';
      const count = document.createElement('span');
      count.style.cssText = 'font-size: 14px; color: #808080;';
      count.textContent = `(${runeCounts.runeBlank || 0})`;
      count.className = 'rune-count-display';
      count.dataset.runeKey = 'runeBlank';
      left.appendChild(img);
      left.appendChild(count);
      item.appendChild(left);
      const right = document.createElement('div');
      right.style.cssText = 'display: flex; align-items: center; gap: 4px;';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = 'config-useBlankRune';
      checkbox.checked = !!recyclingConfig.useBlankRune;
      checkbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer; margin: 0;';
      right.appendChild(checkbox);
      const help = document.createElement('span');
      help.textContent = '(?)';
      help.title = t('mods.betterRuneRecycler.useBlankRuneHelp');
      help.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.7); cursor: help; font-weight: bold;';
      right.appendChild(help);
      item.appendChild(right);
      runeGrid.appendChild(item);
    }
    
    container.appendChild(runeGrid);
    
    // Cycles input + Max checkbox
    const cyclesRow = document.createElement('div');
    cyclesRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px 8px;';
    
    const cyclesLabel = document.createElement('span');
    cyclesLabel.style.cssText = 'font-size: 16px; color: rgb(255,255,255); font-weight: bold;';
    cyclesLabel.textContent = t('mods.betterRuneRecycler.numberOfCycles');
    
    const cyclesRight = document.createElement('div');
    cyclesRight.style.cssText = 'display: flex; align-items: center; gap: 8px;';
    
    const cyclesInput = document.createElement('input');
    cyclesInput.type = 'number';
    cyclesInput.id = 'config-cycles';
    cyclesInput.min = '1';
    const initialMax = getMaxCycles();
    cyclesInput.max = String(initialMax);
    const initialCycles = Math.min(recyclingConfig.cycles ?? 1, initialMax);
    cyclesInput.value = String(initialCycles);
    recyclingConfig.cycles = initialCycles;
    const cyclesInputStyleNormal = 'width: 80px; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: rgb(255,255,255); font-size: 18px; text-align: center; font-weight: bold; cursor: text; opacity: 1;';
    const cyclesInputStyleDisabled = 'width: 80px; padding: 8px 12px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.5); font-size: 18px; text-align: center; font-weight: bold; cursor: not-allowed; opacity: 0.7;';
    cyclesInput.style.cssText = cyclesInputStyleNormal;
    
    const maxCheckbox = document.createElement('input');
    maxCheckbox.type = 'checkbox';
    maxCheckbox.id = 'config-useMaxCycles';
    maxCheckbox.checked = !!recyclingConfig.useMaxCycles;
    maxCheckbox.style.cssText = 'width: 18px; height: 18px; cursor: pointer; margin: 0;';
    maxCheckbox.title = t('mods.betterRuneRecycler.maxCheckboxTitle');
    const maxLabel = document.createElement('label');
    maxLabel.htmlFor = 'config-useMaxCycles';
    maxLabel.style.cssText = 'font-size: 14px; color: rgb(255,255,255); cursor: pointer; font-weight: bold; user-select: none;';
    maxLabel.textContent = t('mods.betterRuneRecycler.maxCheckboxLabel');
    
    cyclesRight.appendChild(cyclesInput);
    cyclesRight.appendChild(maxCheckbox);
    cyclesRight.appendChild(maxLabel);
    cyclesRow.appendChild(cyclesLabel);
    cyclesRow.appendChild(cyclesRight);
    container.appendChild(cyclesRow);
    
    if (recyclingConfig.useMaxCycles) {
      cyclesInput.disabled = true;
      cyclesInput.style.cssText = cyclesInputStyleDisabled;
    }
    
    // Status message (above button) - always visible
    const statusMsg = document.createElement('div');
    statusMsg.id = 'status-message';
    statusMsg.style.cssText = 'padding: 10px; border-radius: 3px; font-size: 15px; text-align: center; font-weight: bold; background: rgba(100,100,100,0.4); border: 1px solid rgba(140,140,140,0.6); color: rgba(255,255,255,0.9);';
    statusMsg.textContent = t('mods.betterRuneRecycler.noRunesSelected');
    container.appendChild(statusMsg);
    
    // Start button
    const startBtn = document.createElement('button');
    startBtn.id = 'start-stop-btn';
    startBtn.style.cssText = 'width: 100%; padding: 12px; background: linear-gradient(180deg, rgba(60,150,100,0.8) 0%, rgba(40,120,80,0.8) 100%); border: 2px solid rgba(80,180,120,0.6); border-radius: 4px; color: rgb(255,255,255); font-size: 17px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);';
    startBtn.textContent = t('mods.betterRuneRecycler.startRecycling');
    container.appendChild(startBtn);
    
    return container;
  }

  /**
   * Get statistics column content (col2)
   */
  function getStatsContent() {
    const container = document.createElement('div');
    container.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box; height: 100%;';
    
    // Stats grid
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex: 1; min-height: 0;';
    
    // Consumed box
    const consumedBox = document.createElement('div');
    consumedBox.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px; display: flex; flex-direction: column; min-height: 0;';
    const consumedTitle = document.createElement('div');
    consumedTitle.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 6px; text-transform: uppercase; font-weight: bold; text-align: center;';
    consumedTitle.textContent = t('mods.betterRuneRecycler.consumed');
    consumedBox.appendChild(consumedTitle);
    const consumedStats = document.createElement('div');
    consumedStats.id = 'consumed-stats';
    consumedStats.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-size: 15px; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;';
    consumedStats.innerHTML = `<div style="color: rgba(255,255,255,0.5);">${t('mods.betterRuneRecycler.noDataYet')}</div>`;
    consumedBox.appendChild(consumedStats);
    statsGrid.appendChild(consumedBox);
    
    // Created box
    const createdBox = document.createElement('div');
    createdBox.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px; display: flex; flex-direction: column; min-height: 0;';
    const createdTitle = document.createElement('div');
    createdTitle.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 6px; text-transform: uppercase; font-weight: bold; text-align: center;';
    createdTitle.textContent = t('mods.betterRuneRecycler.created');
    createdBox.appendChild(createdTitle);
    const createdStats = document.createElement('div');
    createdStats.id = 'created-stats';
    createdStats.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-size: 15px; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;';
    createdStats.innerHTML = `<div style="color: rgba(255,255,255,0.5);">${t('mods.betterRuneRecycler.noDataYet')}</div>`;
    createdBox.appendChild(createdStats);
    statsGrid.appendChild(createdBox);
    
    container.appendChild(statsGrid);
    
    // Summary stats
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px; flex-shrink: 0;';
    const goldLabel = t('mods.betterRuneRecycler.goldSpent');
    const cyclesLabelStat = t('mods.betterRuneRecycler.cycles');
    summaryDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 15px;">
        <span style="color: rgba(255,255,255,0.8);">💰 ${goldLabel}</span>
        <span id="gold-spent-stat" style="color: rgb(255,255,255); font-weight: bold;">0</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 15px;">
        <span style="color: rgba(255,255,255,0.8);">🔄 ${cyclesLabelStat}</span>
        <span id="cycles-completed-stat" style="color: rgb(255,255,255); font-weight: bold;">0</span>
      </div>
    `;
    container.appendChild(summaryDiv);
    
    return container;
  }

  /**
   * Close modal (not needed anymore - API handles it)
   */
  function closeRuneRecyclerModal() {
    // The API modal handles closing automatically
  }

  /**
   * Setup event listeners for modal interactions
   */
  function setupModalEventListeners() {
    // Wait a bit for DOM to be ready
    setTimeout(() => {
      // Input validation for rune configuration
      const runeInputs = document.querySelectorAll('input[id^="config-rune"]');
      runeInputs.forEach(input => {
        input.addEventListener('input', () => {
          // Ensure value is between 0 and 3
          const value = parseInt(input.value) || 0;
          input.value = Math.max(0, Math.min(3, value));
          
          // Update config
          const runeKey = input.dataset.runeKey;
          if (runeKey) {
            recyclingConfig[runeKey] = parseInt(input.value) || 0;
          }
          
          // Validate total is 3
          validateRuneSelection();
        });
      });

      // Cycles input validation (max is dynamic from getMaxCycles())
      const cyclesInput = document.getElementById('config-cycles');
      if (cyclesInput) {
        cyclesInput.addEventListener('input', () => {
          const maxC = getMaxCycles();
          cyclesInput.max = String(maxC);
          const value = parseInt(cyclesInput.value) || 1;
          cyclesInput.value = Math.max(1, Math.min(maxC, value));
          recyclingConfig.cycles = parseInt(cyclesInput.value) || 1;
          validateRuneSelection();
        });
      }

      // Start/Stop button
      const startStopBtn = document.getElementById('start-stop-btn');
      if (startStopBtn) {
        startStopBtn.addEventListener('click', () => {
          if (recycleInProgress) {
            stopRecycling();
          } else {
            startRecycling();
          }
        });
      }

      // Use Blank Rune checkbox
      const useBlankRuneCheckbox = document.getElementById('config-useBlankRune');
      if (useBlankRuneCheckbox) {
        useBlankRuneCheckbox.addEventListener('change', () => {
          recyclingConfig.useBlankRune = useBlankRuneCheckbox.checked;
          validateRuneSelection();
        });
      }

      // Max cycles checkbox: disable cycles input and grey it out when checked
      const maxCheckbox = document.getElementById('config-useMaxCycles');
      const cyclesInputForMax = document.getElementById('config-cycles');
      if (maxCheckbox && cyclesInputForMax) {
        const styleNormal = 'width: 80px; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: rgb(255,255,255); font-size: 18px; text-align: center; font-weight: bold; cursor: text; opacity: 1;';
        const styleDisabled = 'width: 80px; padding: 8px 12px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; color: rgba(255,255,255,0.5); font-size: 18px; text-align: center; font-weight: bold; cursor: not-allowed; opacity: 0.7;';
        maxCheckbox.addEventListener('change', () => {
          recyclingConfig.useMaxCycles = maxCheckbox.checked;
          cyclesInputForMax.disabled = maxCheckbox.checked;
          cyclesInputForMax.style.cssText = maxCheckbox.checked ? styleDisabled : styleNormal;
          validateRuneSelection();
        });
      }

      // Sync status message to current selection (e.g. after reopening modal)
      validateRuneSelection();
    }, 100);
  }

  /**
   * Update the cycles input max from getMaxCycles() and clamp value to [1, max].
   * No-op when useMaxCycles is checked (input is disabled).
   */
  function updateCyclesInputLimit() {
    if (recyclingConfig.useMaxCycles) return;
    const cyclesInput = document.getElementById('config-cycles');
    if (!cyclesInput) return;
    const maxC = getMaxCycles();
    cyclesInput.max = String(maxC);
    const current = parseInt(cyclesInput.value, 10) || 1;
    const clamped = Math.max(1, Math.min(maxC, current));
    if (clamped !== current) {
      cyclesInput.value = String(clamped);
      recyclingConfig.cycles = clamped;
    }
  }

  /**
   * Validate that exactly 3 runes are selected
   */
  function validateRuneSelection() {
    const total = recyclingConfig.runeAvarice + recyclingConfig.runeHp + recyclingConfig.runeAp + 
                  recyclingConfig.runeAd + recyclingConfig.runeAr + 
                  recyclingConfig.runeMr + recyclingConfig.runeRecycle;
    
    const statusMsg = document.getElementById('status-message');
    if (!statusMsg) return;

    // Update cycles input max from inventory (limited by lowest rune count)
    updateCyclesInputLimit();

    const baseStyle = 'padding: 10px; border-radius: 3px; font-size: 15px; text-align: center; font-weight: bold;';
    if (total === 0) {
      statusMsg.style.cssText = baseStyle + ' background: rgba(100,100,100,0.4); border: 1px solid rgba(140,140,140,0.6); color: rgba(255,255,255,0.9);';
      statusMsg.textContent = t('mods.betterRuneRecycler.noRunesSelected');
    } else if (total !== 3) {
      statusMsg.style.cssText = baseStyle + ' background: rgba(220,160,60,0.4); border: 1px solid rgba(240,180,80,0.6); color: rgb(255,240,200);';
      statusMsg.textContent = t('mods.betterRuneRecycler.mustSelectThree').replace('{total}', String(total));
    } else {
      statusMsg.style.cssText = baseStyle + ' background: rgba(70,120,200,0.4); border: 1px solid rgba(90,150,230,0.6); color: rgb(200,220,255);';
      if (recyclingConfig.useMaxCycles) {
        statusMsg.textContent = t('mods.betterRuneRecycler.readyMax');
      } else {
        const cycles = recyclingConfig.cycles;
        const goldCost = cycles * 5000;
        statusMsg.textContent = t('mods.betterRuneRecycler.readyCycles')
          .replace('{cycles}', String(cycles))
          .replace('{runes}', String(cycles * 3))
          .replace('{gold}', goldCost.toLocaleString());
      }
    }
  }

  /**
   * Update the status message
   */
  function updateStatusMessage(message, type = 'info') {
    const statusMsg = document.getElementById('status-message');
    if (!statusMsg) return;

    statusMsg.style.display = 'block';
    
    // Apply styles based on type
    const styles = {
      info: 'background: rgba(70,120,200,0.4); border: 1px solid rgba(90,150,230,0.6); color: rgb(200,220,255);',
      success: 'background: rgba(70,170,120,0.4); border: 1px solid rgba(90,210,150,0.6); color: rgb(200,255,220);',
      error: 'background: rgba(200,80,80,0.4); border: 1px solid rgba(220,100,100,0.6); color: rgb(255,200,200);',
      warning: 'background: rgba(220,160,60,0.4); border: 1px solid rgba(240,180,80,0.6); color: rgb(255,240,200);'
    };
    
    statusMsg.style.cssText = `padding: 10px; border-radius: 3px; font-size: 15px; text-align: center; font-weight: bold; ${styles[type] || styles.info}`;
    statusMsg.textContent = message;
  }

  /**
   * Update the start/stop button state
   */
  function updateStartStopButton(isRunning) {
    const btn = document.getElementById('start-stop-btn');
    if (!btn) return;

    if (isRunning) {
      btn.style.cssText = 'width: 100%; padding: 12px; background: linear-gradient(180deg, rgba(180,80,80,0.8) 0%, rgba(140,50,50,0.8) 100%); border: 2px solid rgba(200,100,100,0.6); border-radius: 4px; color: rgb(255,255,255); font-size: 17px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);';
      btn.textContent = t('mods.betterRuneRecycler.stopRecycling');
    } else {
      btn.style.cssText = 'width: 100%; padding: 12px; background: linear-gradient(180deg, rgba(60,150,100,0.8) 0%, rgba(40,120,80,0.8) 100%); border: 2px solid rgba(80,180,120,0.6); border-radius: 4px; color: rgb(255,255,255); font-size: 17px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);';
      btn.textContent = t('mods.betterRuneRecycler.startRecycling');
    }
  }

  /**
   * Update the inventory display in the modal
   */
  function updateInventoryDisplay() {
    const runeCounts = getAllRuneCounts();

    // Update rune counts in config section (including Blank Rune row)
    RUNE_TYPES.forEach(rune => {
      const countDisplay = document.querySelector(`.rune-count-display[data-rune-key="${rune.key}"]`);
      if (countDisplay) {
        countDisplay.textContent = `(${runeCounts[rune.key] || 0})`;
      }
    });

    // Cycles max may have changed (e.g. after recycling)
    updateCyclesInputLimit();
  }

  /**
   * Update the statistics display
   */
  function updateStatsDisplay() {
    // Update consumed stats
    const consumedStats = document.getElementById('consumed-stats');
    if (consumedStats) {
      const hasConsumed = Object.values(recyclingStats.runesConsumed).some(v => v > 0);
      
      if (hasConsumed) {
        consumedStats.innerHTML = Object.entries(recyclingStats.runesConsumed)
          .filter(([_, count]) => count > 0)
          .map(([runeKey, count]) => {
            const rune = RUNE_TYPES.find(r => r.key === runeKey);
            const displayName = rune ? rune.displayName.replace(' Rune', '') : runeKey.replace('rune', '');
            const iconPath = rune ? rune.icon : '/assets/icons/rune-blank.png';
            
            return `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <img src="${iconPath}" style="width: 30px; height: 30px;" onerror="this.style.display='none'" />
                  <span style="color: rgba(255,255,255,0.9); font-size: 15px;">${displayName}</span>
                </div>
                <span style="color: rgb(255,150,150); font-weight: bold; font-size: 15px;">-${count}</span>
              </div>
            `;
          }).join('');
      } else {
        consumedStats.innerHTML = `<div style="color: rgba(255,255,255,0.5);">${t('mods.betterRuneRecycler.noDataYet')}</div>`;
      }
    }

    // Update created stats
    const createdStats = document.getElementById('created-stats');
    if (createdStats) {
      const hasCreated = Object.values(recyclingStats.runesCreated).some(v => v > 0);
      
      if (hasCreated) {
        createdStats.innerHTML = Object.entries(recyclingStats.runesCreated)
          .filter(([_, count]) => count > 0)
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .map(([runeKey, count]) => {
            const rune = RUNE_TYPES.find(r => r.key === runeKey);
            const displayName = rune ? rune.displayName.replace(' Rune', '') : runeKey.replace('rune', '');
            const iconPath = rune ? rune.icon : '/assets/icons/rune-blank.png';
            
            return `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <img src="${iconPath}" style="width: 30px; height: 30px;" onerror="this.style.display='none'" />
                  <span style="color: rgba(255,255,255,0.9); font-size: 15px;">${displayName}</span>
                </div>
                <span style="color: rgb(150,255,150); font-weight: bold; font-size: 15px;">+${count}</span>
              </div>
            `;
          }).join('');
      } else {
        createdStats.innerHTML = `<div style="color: rgba(255,255,255,0.5);">${t('mods.betterRuneRecycler.noDataYet')}</div>`;
      }
    }

    // Update gold spent
    const goldSpentStat = document.getElementById('gold-spent-stat');
    if (goldSpentStat) {
      goldSpentStat.textContent = recyclingStats.goldSpent.toLocaleString();
    }

    // Update cycles completed (show count only)
    const cyclesCompletedStat = document.getElementById('cycles-completed-stat');
    if (cyclesCompletedStat) {
      cyclesCompletedStat.textContent = recyclingStats.cyclesCompleted.toLocaleString();
    }
  }

  /**
   * Close the Better Rune Recycler modal
   */
  // =====================================================
  // Initialization
  // =====================================================

  /**
   * Initialize the Better Rune Recycler mod
   */
  function init() {
    // Observe inventory and add button
    observeInventory();
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    // Clear intervals
    if (buttonCheckInterval) {
      clearInterval(buttonCheckInterval);
      buttonCheckInterval = null;
    }
    
    // Disconnect observer
    if (inventoryObserver) {
      inventoryObserver.disconnect();
      inventoryObserver = null;
    }
    
    // Remove button
    const button = document.querySelector('.better-rune-recycler-inventory-button');
    if (button) button.remove();
    
    // Close modal
    closeRuneRecyclerModal();
    
    console.log('[Better Rune Recycler] Cleanup complete');
  }

  // Start the mod
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Export for debugging
  window.BetterRuneRecycler = {
    version: '1.0.0',
    getAllRuneCounts,
    logInventoryState,
    openRuneRecyclerModal,
    cleanup,
  };

})();

