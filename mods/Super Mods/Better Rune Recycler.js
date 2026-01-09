// ==UserScript==
// @name         Better Rune Recycler
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Automates rune recycling in Bestiary Arena - use multiple Recycle Runes automatically
// @author       SuperMod Team
// @match        https://bestiaryarena.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  console.log('[Better Rune Recycler] Mod loaded');

  // =====================================================
  // Constants and Configuration
  // =====================================================
  
  const MOD_NAME = 'Better Rune Recycler';
  const MOD_VERSION = '1.0.0';
  
  // =====================================================
  // Modal Dimensions Configuration
  // =====================================================
  // Adjust these constants to change the modal size:
  // - MODAL_WIDTH: Total width of the modal window
  // - MODAL_HEIGHT: Total height of the modal window
  // - MODAL_PADDING_*: Internal spacing (don't change unless layout breaks)
  // 
  // Example: For a larger modal, try:
  //   MODAL_WIDTH = 800
  //   MODAL_HEIGHT = 900
  // =====================================================
  
  const MODAL_WIDTH = 550;              // Main modal width in pixels
  const MODAL_HEIGHT = 750;             // Main modal height in pixels
  const MODAL_PADDING_WIDTH = 30;       // Padding to subtract from width for content
  const MODAL_PADDING_HEIGHT = 50;      // Padding to subtract from height for content
  
  const RUNE_TYPES = [
    { key: 'runeAvarice', displayName: 'Avarice Rune', icon: '/assets/icons/rune-avarice.png', rarity: '2' },
    { key: 'runeHp', displayName: 'Hitpoints Rune', icon: '/assets/icons/rune-hp.png', rarity: '3' },
    { key: 'runeAp', displayName: 'Ability Power Rune', icon: '/assets/icons/rune-ap.png', rarity: '3' },
    { key: 'runeAd', displayName: 'Attack Damage Rune', icon: '/assets/icons/rune-ad.png', rarity: '3' },
    { key: 'runeAr', displayName: 'Armor Rune', icon: '/assets/icons/rune-ar.png', rarity: '3' },
    { key: 'runeMr', displayName: 'Magic Resist Rune', icon: '/assets/icons/rune-mr.png', rarity: '3' },
    { key: 'runeBlank', displayName: 'Blank Rune', icon: '/assets/icons/rune-blank.png', rarity: '4' },
    { key: 'runeRecycle', displayName: 'Recycle Rune', icon: '/assets/icons/rune-recycle.png', rarity: '4' },
    { key: 'runeRecycleMonster', displayName: 'Kaleidoscopic Rune', icon: '/assets/icons/rune-monster-recycle.png', rarity: '5' },
    { key: 'runeConversionHp', displayName: 'Conversion Rune (hp)', icon: '/assets/icons/rune-conversion-hp.png', rarity: '5' },
    { key: 'runeConversionAd', displayName: 'Conversion Rune (ad)', icon: '/assets/icons/rune-conversion-ad.png', rarity: '5' },
    { key: 'runeConversionAp', displayName: 'Conversion Rune (ap)', icon: '/assets/icons/rune-conversion-ap.png', rarity: '5' },
  ];

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
  };
  
  // Statistics tracking
  let recyclingStats = {
    cyclesCompleted: 0,
    runesConsumed: {},
    runesCreated: {},
    goldSpent: 0,
    errors: 0,
  };
  
  // API rate limiting
  const API_DELAY = 500; // ms between API calls


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
   * Validate if recycling is possible with current resources
   */
  function validateRecycling(config) {
    const inventory = getPlayerInventory();
    if (!inventory) {
      return { valid: false, reason: 'Cannot access inventory' };
    }

    const gold = getPlayerGold();
    const cycles = config.cycles || 1;

    // Check if we have enough gold (5000 per cycle)
    const goldNeeded = cycles * 5000;
    if (gold < goldNeeded) {
      return { valid: false, reason: `Not enough gold (have ${gold}, need ${goldNeeded})` };
    }

    // Check if we have enough runes to sacrifice (including Recycle Runes if used)
    const runesNeeded = {
      runeAvarice: config.runeAvarice * cycles,
      runeHp: config.runeHp * cycles,
      runeAp: config.runeAp * cycles,
      runeAd: config.runeAd * cycles,
      runeAr: config.runeAr * cycles,
      runeMr: config.runeMr * cycles,
      runeRecycle: config.runeRecycle * cycles,
    };

    // Add the Recycle Runes needed to perform the recycling (1 per cycle)
    runesNeeded.runeRecycle += cycles;

    for (const [runeKey, needed] of Object.entries(runesNeeded)) {
      if (needed > 0) {
        const available = inventory[runeKey] || 0;
        if (available < needed) {
          const runeName = RUNE_TYPES.find(r => r.key === runeKey)?.displayName || runeKey;
          const forRecycling = runeKey === 'runeRecycle' ? ` (${cycles} to use + ${config.runeRecycle * cycles} to sacrifice)` : '';
          return { valid: false, reason: `Not enough ${runeName}${forRecycling} (have ${available}, need ${needed})` };
        }
      }
    }

    // Check if exactly 3 runes are selected per cycle
    const totalRunesPerCycle = config.runeAvarice + config.runeHp + config.runeAp + config.runeAd + config.runeAr + config.runeMr + config.runeRecycle;
    if (totalRunesPerCycle !== 3) {
      return { valid: false, reason: `Must select exactly 3 runes per cycle (currently ${totalRunesPerCycle})` };
    }

    return { valid: true };
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
      
      // Track consumed runes
      sacrifice.forEach(runeKey => {
        if (!recyclingStats.runesConsumed[runeKey]) {
          recyclingStats.runesConsumed[runeKey] = 0;
        }
        recyclingStats.runesConsumed[runeKey]++;
      });
      
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
    
    const sacrifice = buildSacrificeArray(recyclingConfig);
    const totalCycles = recyclingConfig.cycles;

    console.log('[Better Rune Recycler] Starting recycling process:', {
      cycles: totalCycles,
      sacrifice: sacrifice,
    });

    updateStatusMessage(`Starting recycling... (0/${totalCycles})`, 'info');
    updateStartStopButton(true);

    for (let i = 0; i < totalCycles; i++) {
      if (!recycleInProgress) {
        updateStatusMessage(`Stopped at cycle ${i}/${totalCycles}`, 'warning');
        break;
      }

      updateStatusMessage(`Recycling... (${i + 1}/${totalCycles})`, 'info');
      
      const result = await performRuneRecycle(sacrifice[0], sacrifice[1], sacrifice[2]);
      updateStats(result, sacrifice);

      if (!result.success) {
        updateStatusMessage(`Error at cycle ${i + 1}: ${result.error}`, 'error');
        recycleInProgress = false;
        break;
      }

      // Update displays after each recycle
      updateStatsDisplay();
      updateInventoryDisplay();

      // Wait before next cycle (rate limiting)
      if (i < totalCycles - 1) {
        await new Promise(resolve => setTimeout(resolve, API_DELAY));
      }
    }

    if (recycleInProgress) {
      recycleInProgress = false;
      updateStatusMessage(`✅ Completed ${recyclingStats.cyclesCompleted}/${totalCycles} cycles!`, 'success');
      updateStartStopButton(false);
      
      // Final inventory update
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
    updateStatusMessage('Stopping...', 'warning');
    console.log('[Better Rune Recycler] Recycling stopped by user');
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
    
    // Look for the Recycle Rune icon in the inventory
    // The recycle rune icon is at /assets/icons/rune-recycle.png
    let runeRecycleElement = inventoryContainer.querySelector('img[src="/assets/icons/rune-recycle.png"]');
    let targetButton = null;
    
    if (runeRecycleElement) {
      targetButton = runeRecycleElement.closest('button') || runeRecycleElement.closest('.focus-style-visible') || runeRecycleElement.parentElement;
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
          <div class="revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5" style="z-index: 3;"><span class="relative" style="line-height: 1; font-size: 12px; color: #fff; font-family: 'Yalla', 'Trebuchet MS', Arial, sans-serif; letter-spacing: 0; font-weight: 600; text-shadow: -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000; text-align: left; display: inline-block; width: 100%;" translate="no">Auto</span></div>
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
          contentDiv.style.flexDirection = 'column';
          contentDiv.style.gap = '0';
          contentDiv.style.flex = '1 1 0';
          
          // Single column: Configuration with Statistics
          const configBox = createBox({
            title: 'Configuration',
            content: getConfigContent()
          });
          configBox.style.flex = '1 1 0';
          configBox.style.minWidth = '0';
          configBox.style.height = '100%';
          
          contentDiv.appendChild(configBox);
          
          const modalInstance = api.ui.components.createModal({
            title: 'Better Rune Recycler',
            width: MODAL_WIDTH,
            height: MODAL_HEIGHT,
            content: contentDiv,
            buttons: [{ text: 'Close', primary: true }]
          });
          
          if (modalInstance && typeof modalInstance.onClose === 'function') {
            modalInstance.onClose(() => {
              // Stop recycling if in progress
              if (recyclerState.isRecycling) {
                stopRecycling();
              }
              console.log('[Better Rune Recycler] Modal closed');
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
    const nonSacrificableRunes = ['runeBlank', 'runeRecycleMonster', 'runeConversionHp', 'runeConversionAd', 'runeConversionAp'];
    const recyclableRunes = RUNE_TYPES.filter(r => !nonSacrificableRunes.includes(r.key));
    
    const container = document.createElement('div');
    container.style.cssText = 'padding: 12px; display: flex; flex-direction: column; gap: 8px; width: 100%; box-sizing: border-box;';
    
    // Info text
    const infoText = document.createElement('div');
    infoText.style.cssText = 'color: rgba(255,255,255,0.8); font-size: 15px; text-align: center; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 3px;';
    infoText.textContent = 'Select exactly 3 runes to sacrifice per cycle. Each recycle costs 5,000 gold.';
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
      img.style.cssText = 'width: 20px; height: 20px;';
      
      const name = document.createElement('span');
      name.style.cssText = 'font-size: 15px; color: rgb(255,255,255);';
      name.textContent = rune.displayName.replace(' Rune', '');
      
      const count = document.createElement('span');
      count.style.cssText = 'font-size: 14px; color: #808080;';
      count.textContent = `(${runeCounts[rune.key] || 0})`;
      count.className = 'rune-count-display';
      count.dataset.runeKey = rune.key;
      
      left.appendChild(img);
      left.appendChild(name);
      left.appendChild(count);
      
      const input = document.createElement('input');
      input.type = 'number';
      input.id = `config-${rune.key}`;
      input.min = '0';
      input.max = '3';
      input.value = '0';
      input.dataset.runeKey = rune.key;
      input.style.cssText = 'width: 55px; padding: 5px 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: rgb(255,255,255); font-size: 16px; text-align: center; font-weight: bold;';
      
      item.appendChild(left);
      item.appendChild(input);
      runeGrid.appendChild(item);
    });
    
    container.appendChild(runeGrid);
    
    // Cycles input
    const cyclesRow = document.createElement('div');
    cyclesRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px 8px;';
    
    const cyclesLabel = document.createElement('span');
    cyclesLabel.style.cssText = 'font-size: 16px; color: rgb(255,255,255); font-weight: bold;';
    cyclesLabel.textContent = '🔁 Number of Cycles:';
    
    const cyclesInput = document.createElement('input');
    cyclesInput.type = 'number';
    cyclesInput.id = 'config-cycles';
    cyclesInput.min = '1';
    cyclesInput.max = '999';
    cyclesInput.value = '1';
    cyclesInput.style.cssText = 'width: 80px; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 3px; color: rgb(255,255,255); font-size: 18px; text-align: center; font-weight: bold;';
    
    cyclesRow.appendChild(cyclesLabel);
    cyclesRow.appendChild(cyclesInput);
    container.appendChild(cyclesRow);
    
    // Start button
    const startBtn = document.createElement('button');
    startBtn.id = 'start-stop-btn';
    startBtn.style.cssText = 'width: 100%; padding: 12px; background: linear-gradient(180deg, rgba(60,150,100,0.8) 0%, rgba(40,120,80,0.8) 100%); border: 2px solid rgba(80,180,120,0.6); border-radius: 4px; color: rgb(255,255,255); font-size: 17px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);';
    startBtn.textContent = '▶️ Start Recycling';
    container.appendChild(startBtn);
    
    // Status message
    const statusMsg = document.createElement('div');
    statusMsg.id = 'status-message';
    statusMsg.style.cssText = 'display: none; padding: 10px; border-radius: 3px; font-size: 15px; text-align: center; font-weight: bold;';
    container.appendChild(statusMsg);
    
    // Add statistics section
    const statsTitle = document.createElement('div');
    statsTitle.style.cssText = 'font-size: 16px; color: rgba(255,255,255,0.9); margin-top: 12px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid rgba(255,255,255,0.1); font-weight: bold; text-align: center;';
    statsTitle.textContent = '📊 Statistics';
    container.appendChild(statsTitle);
    
    // Stats grid
    const statsGrid = document.createElement('div');
    statsGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex: 1;';
    
    // Consumed box
    const consumedBox = document.createElement('div');
    consumedBox.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px;';
    const consumedTitle = document.createElement('div');
    consumedTitle.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 6px; text-transform: uppercase; font-weight: bold;';
    consumedTitle.textContent = 'Consumed';
    consumedBox.appendChild(consumedTitle);
    const consumedStats = document.createElement('div');
    consumedStats.id = 'consumed-stats';
    consumedStats.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-size: 15px; max-height: 150px; overflow-y: auto; overflow-x: hidden;';
    consumedStats.innerHTML = '<div style="color: rgba(255,255,255,0.5);">No data yet</div>';
    consumedBox.appendChild(consumedStats);
    statsGrid.appendChild(consumedBox);
    
    // Created box
    const createdBox = document.createElement('div');
    createdBox.style.cssText = 'background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px;';
    const createdTitle = document.createElement('div');
    createdTitle.style.cssText = 'font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 6px; text-transform: uppercase; font-weight: bold;';
    createdTitle.textContent = 'Created';
    createdBox.appendChild(createdTitle);
    const createdStats = document.createElement('div');
    createdStats.id = 'created-stats';
    createdStats.style.cssText = 'display: flex; flex-direction: column; gap: 4px; font-size: 15px; max-height: 150px; overflow-y: auto; overflow-x: hidden;';
    createdStats.innerHTML = '<div style="color: rgba(255,255,255,0.5);">No data yet</div>';
    createdBox.appendChild(createdStats);
    statsGrid.appendChild(createdBox);
    
    container.appendChild(statsGrid);
    
    // Summary stats
    const summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'display: flex; flex-direction: column; gap: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 3px; padding: 6px;';
    summaryDiv.innerHTML = `
      <div style="display: flex; justify-content: space-between; font-size: 15px;">
        <span style="color: rgba(255,255,255,0.8);">💰 Gold Spent:</span>
        <span id="gold-spent-stat" style="color: rgb(255,255,255); font-weight: bold;">0</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 15px;">
        <span style="color: rgba(255,255,255,0.8);">🔄 Cycles:</span>
        <span id="cycles-completed-stat" style="color: rgb(255,255,255); font-weight: bold;">0</span>
      </div>
    `;
    container.appendChild(summaryDiv);
    
    return container;
  }

  /**
   * Get statistics column content (deprecated - now integrated into config)
   */
  function getStatsContent() {
    // This function is no longer used - stats are now in getConfigContent()
    return document.createElement('div');
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

      // Cycles input validation
      const cyclesInput = document.getElementById('config-cycles');
      if (cyclesInput) {
        cyclesInput.addEventListener('input', () => {
          const value = parseInt(cyclesInput.value) || 1;
          cyclesInput.value = Math.max(1, Math.min(999, value));
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
    }, 100);
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

    if (total === 0) {
      statusMsg.style.display = 'none';
    } else if (total !== 3) {
      statusMsg.style.display = 'block';
      statusMsg.style.cssText = 'padding: 10px; border-radius: 3px; font-size: 15px; text-align: center; font-weight: bold; background: rgba(220,160,60,0.4); border: 1px solid rgba(240,180,80,0.6); color: rgb(255,240,200);';
      statusMsg.textContent = `⚠️ Must select exactly 3 runes (currently ${total})`;
    } else {
      statusMsg.style.display = 'block';
      statusMsg.style.cssText = 'padding: 10px; border-radius: 3px; font-size: 15px; text-align: center; font-weight: bold; background: rgba(70,120,200,0.4); border: 1px solid rgba(90,150,230,0.6); color: rgb(200,220,255);';
      const cycles = recyclingConfig.cycles;
      const goldCost = cycles * 5000;
      statusMsg.textContent = `✓ Ready: ${cycles} cycle${cycles > 1 ? 's' : ''} (${cycles * 3} runes, ${goldCost.toLocaleString()} gold)`;
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
      btn.textContent = '⏹️ Stop Recycling';
    } else {
      btn.style.cssText = 'width: 100%; padding: 12px; background: linear-gradient(180deg, rgba(60,150,100,0.8) 0%, rgba(40,120,80,0.8) 100%); border: 2px solid rgba(80,180,120,0.6); border-radius: 4px; color: rgb(255,255,255); font-size: 17px; font-weight: bold; cursor: pointer; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);';
      btn.textContent = '▶️ Start Recycling';
    }
  }

  /**
   * Update the inventory display in the modal
   */
  function updateInventoryDisplay() {
    const runeCounts = getAllRuneCounts();

    // Update rune counts in config section
    RUNE_TYPES.forEach(rune => {
      if (rune.key !== 'runeBlank') {
        const countDisplay = document.querySelector(`.rune-count-display[data-rune-key="${rune.key}"]`);
        if (countDisplay) {
          countDisplay.textContent = `(${runeCounts[rune.key] || 0})`;
        }
      }
    });
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
                  <img src="${iconPath}" style="width: 20px; height: 20px;" onerror="this.style.display='none'" />
                  <span style="color: rgba(255,255,255,0.9); font-size: 15px;">${displayName}</span>
                </div>
                <span style="color: rgb(255,150,150); font-weight: bold; font-size: 15px;">-${count}</span>
              </div>
            `;
          }).join('');
      } else {
        consumedStats.innerHTML = '<div style="color: rgba(255,255,255,0.5);">No data yet</div>';
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
                  <img src="${iconPath}" style="width: 20px; height: 20px;" onerror="this.style.display='none'" />
                  <span style="color: rgba(255,255,255,0.9); font-size: 15px;">${displayName}</span>
                </div>
                <span style="color: rgb(150,255,150); font-weight: bold; font-size: 15px;">+${count}</span>
              </div>
            `;
          }).join('');
      } else {
        createdStats.innerHTML = '<div style="color: rgba(255,255,255,0.5);">No data yet</div>';
      }
    }

    // Update gold spent
    const goldSpentStat = document.getElementById('gold-spent-stat');
    if (goldSpentStat) {
      goldSpentStat.textContent = recyclingStats.goldSpent.toLocaleString();
    }

    // Update cycles completed
    const cyclesCompletedStat = document.getElementById('cycles-completed-stat');
    if (cyclesCompletedStat) {
      cyclesCompletedStat.textContent = `${recyclingStats.cyclesCompleted} / ${recyclingConfig.cycles}`;
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
    console.log(`[${MOD_NAME}] v${MOD_VERSION} initializing...`);

    // Observe inventory and add button
    observeInventory();

    console.log(`[${MOD_NAME}] v${MOD_VERSION} initialized successfully!`);
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
    version: MOD_VERSION,
    getAllRuneCounts,
    logInventoryState,
    openRuneRecyclerModal,
    cleanup,
  };

})();

