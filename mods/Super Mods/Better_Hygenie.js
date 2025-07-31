// =======================
// 0. Version & Metadata
// =======================
(function() {
  console.log('[Better Hy\'genie] initializing...');
  
// =======================
// 1. Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  // Performance constants
  const CONSTANTS = {
    DEBOUNCE_DELAY: 100,
    RETRY_MAX_ATTEMPTS: 5,
    RETRY_BASE_DELAY: 100,
    RETRY_DELAY: 500,
    LARGE_QUANTITY_THRESHOLD: 10,
    ERROR_DISPLAY_DURATION: 2000,
    MAX_INPUT_WIDTH: 50
  };
  
  // DOM selectors cache
  const SELECTORS = {
    HYGENIE_MODAL: '.widget-bottom',
    GRID_CONTAINERS: '.grid.w-\\[53px\\]',
    ITEM_SLOT: '.container-slot',
    FUSE_BUTTON: 'button',
    SECTION_HEADER: '.widget-top',
    SECTION_CONTENT: '.widget-bottom',
    SECTIONS: '.w-full',
    SUMMON_SCROLL_IMG: 'img[src*="summonscroll"]',
    DICE_MANIPULATOR_SPRITE: '.sprite.item',
    RARITY_ELEMENT: '[data-rarity]'
  };
  
  // Outside click handler reference for confirmation reset
  let confirmationOutsideHandler = null;
  
  // CSS styles for the quantity input and fuse buttons
  const QUANTITY_INPUT_STYLES = `
    .better-hygenie-quantity-input {
      width: 100%;
      max-width: ${CONSTANTS.MAX_INPUT_WIDTH}px;
      height: 20px;
      background: #2a2a2a;
      border: 1px solid #4a4a4a;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      text-align: center;
      padding: 2px;
      margin-bottom: 1px;
      border-radius: 2px;
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
    .better-hygenie-quantity-input:focus {
      outline: none;
      border-color: #6a6a6a;
    }
    .better-hygenie-quantity-input::-webkit-inner-spin-button,
    .better-hygenie-quantity-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .better-hygenie-fuse-button {
      /* Base layout and styling */
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      
      /* Typography */
      font-family: inherit !important; /* Use game's pixel font */
      font-size: 14px !important; /* pixel-font-14 */
      line-height: 1 !important;
      letter-spacing: 0.025em !important; /* tracking-wide */
      
      /* Colors */
      color: #ffffff !important; /* text-whiteRegular */
      
      /* Spacing */
      gap: 0.25rem !important; /* gap-1 */
      padding: 0.05rem 0 !important; /* reduced vertical padding */
      padding-bottom: 1px !important; /* reduced bottom padding */
      padding-left: 0 !important; /* px-0 */
      padding-right: 0 !important; /* px-0 */
      margin: 0 !important; /* no margins */
      
      /* Frame styling - background + border frame */
      background-image: 
        url('https://bestiaryarena.com/_next/static/media/1-frame-blue.cf300a6a.png'),
        url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') !important;
      background-size: 100% 100%, cover !important;
      background-repeat: no-repeat, no-repeat !important;
      background-position: center, center !important;
      border: none !important;
      border-radius: 0 !important;
      
      /* Interaction */
      cursor: pointer !important;
      transition: all 0.1s ease !important;
      
      /* Focus styles */
      outline: 2px solid transparent !important;
      outline-offset: 2px !important;
    }
    
    .better-hygenie-fuse-button:focus-visible {
      outline: 2px solid rgba(59, 130, 246, 0.5) !important; /* focus-style-visible */
    }
    
    .better-hygenie-fuse-button:disabled {
      cursor: not-allowed !important; /* disabled:cursor-not-allowed */
      color: rgba(255, 255, 255, 0.6) !important; /* disabled:text-whiteDark/60 */
      filter: grayscale(50%) !important; /* disabled:grayscale-50 */
    }
    
    .better-hygenie-fuse-button:active {
      /* Pressed state - using pressed frame + background */
      background-image: 
        url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png'),
        url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') !important;
      background-size: 100% 100%, cover !important;
      background-repeat: no-repeat, no-repeat !important;
      background-position: center, center !important;
      transform: translateY(1px) !important;
    }
    
    /* SVG icon styling within button */
    /* Confirmation highlight */
    .better-hygenie-fuse-button.confirm {
      background-image:
        url('https://bestiaryarena.com/_next/static/media/1-frame-green.fe32d59c.png'),
        url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') !important;
    }

    .better-hygenie-fuse-button svg {
      width: 11px !important; /* [&_svg]:size-[11px] */
      height: 11px !important; /* [&_svg]:size-[11px] */
      margin-bottom: 1px !important; /* [&_svg]:mb-[1px] */
      margin-top: 2px !important; /* [&_svg]:mt-[2px] */
    }

  `;
  
// =======================
// 2. Utility Functions
// =======================

  // Centralized error handling
  function handleError(error, context = '') {
    const prefix = '[Better Hy\'genie]';
    const message = context ? `${prefix} ${context}:` : prefix;
    console.error(message, error);
  }

  // Safe game state access (matches Autoscroller pattern)
  function getGameState() {
    try {
      return globalThis.state?.player?.getSnapshot()?.context;
    } catch (error) {
      handleError(error, 'Error accessing game state');
      return null;
    }
  }
  
  // Get inventory specifically (using Autoscroller pattern)
  function getInventoryState() {
    try {
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const inventory = playerContext?.inventory || {};
      return inventory;
    } catch (error) {
      handleError(error, 'Error accessing inventory state');
      return {};
    }
  }
  
  // Inject CSS styles
  function injectStyles() {
    if (!document.getElementById('better-hygenie-styles')) {
      const style = document.createElement('style');
      style.id = 'better-hygenie-styles';
      style.textContent = QUANTITY_INPUT_STYLES;
      document.head.appendChild(style);
    }
  }
  
  // Get the quantity from an item slot using game state only
  function getItemQuantity(itemSlot) {
    const inventory = getInventoryState();
    
    const itemKey = getItemKeyFromSlot(itemSlot);
    if (!itemKey) {
      return 0;
    }
    
    return inventory[itemKey] || 0;
  }
  
  // Retry getting item quantity with a delay to allow game state to load
  function getItemQuantityWithRetry(itemSlot, maxRetries = CONSTANTS.RETRY_MAX_ATTEMPTS) {
    return new Promise((resolve) => {
      let attempts = 0;
      
      const tryGetQuantity = () => {
        attempts++;
        const itemKey = getItemKeyFromSlot(itemSlot);
        const inventory = getInventoryState();
        
        if (inventory && itemKey) {
          const count = inventory[itemKey] || 0;
          resolve(count);
          return;
        }
        
        if (attempts < maxRetries) {
          setTimeout(tryGetQuantity, CONSTANTS.RETRY_DELAY);
        } else {
          resolve(0);
        }
      };
      
      tryGetQuantity();
    });
  }
  
  // Get the fusion ratio for an item
  function getFusionRatio(itemKey) {
    try {
      if (!itemKey) {
        console.log('[Better Hy\'genie] No itemKey provided to getFusionRatio');
        return 1;
      }
      
      // Dice Manipulator fusion ratios
      if (itemKey.startsWith('diceManipulator')) {
        const tier = parseInt(itemKey.replace('diceManipulator', ''));
        switch (tier) {
          case 1: return 20; // Common -> Uncommon (20:1)
          case 2: return 10; // Uncommon -> Rare (10:1)
          case 3: return 5;  // Rare -> Mythic (5:1)
          case 4: return 3;  // Mythic -> Legendary (3:1)
          case 5: return 0;  // Legendary (no fusion)
          default: return 1;
        }
      }
      
      // Summon Scroll fusion ratios
      if (itemKey.startsWith('summonScroll')) {
        const tier = parseInt(itemKey.replace('summonScroll', ''));
        switch (tier) {
          case 1: return 4;  // Crude -> Ordinary (4:1)
          case 2: return 3;  // Ordinary -> Refined (3:1)
          case 3: return 2;  // Refined -> Special (2:1)
          case 4: return 2;  // Special -> Exceptional (2:1)
          case 5: return 0;  // Exceptional (no fusion)
          default: return 1;
        }
      }
      
      console.log(`[Better Hy\'genie] Unknown itemKey: ${itemKey}, using default ratio 1`);
      return 1;
    } catch (error) {
      handleError(error, 'Error getting fusion ratio');
      return 1;
    }
  }
  
  // Calculate how many items can be fused (output amount)
  function calculateFusableAmount(itemKey, availableQuantity) {
    const ratio = getFusionRatio(itemKey);
    if (ratio === 0) return 0; // No fusion possible
    return Math.floor(availableQuantity / ratio);
  }
  
  // Perform the actual fusion via API call
  async function performFusion(itemKey, inputQuantity) {
    try {
      if (!itemKey || inputQuantity <= 0) {
        handleError(new Error('Invalid fusion parameters'), { itemKey, inputQuantity });
        return;
      }
      
      // Re-validate current inventory before proceeding
      const gameState = getGameState();
      if (gameState && gameState.inventory) {
        const currentQuantity = gameState.inventory[itemKey] || 0;
        if (currentQuantity < inputQuantity) {
          handleError(new Error('Insufficient items for fusion'), { requested: inputQuantity, available: currentQuantity });
          return;
        }
      }
      
      // Calculate how many output items will be created from the input quantity
      const fusionRatio = getFusionRatio(itemKey);
      const outputQuantity = Math.floor(inputQuantity / fusionRatio);
      
      if (outputQuantity <= 0) {
        handleError(new Error('Invalid fusion: input quantity too low for fusion ratio'), { inputQuantity, fusionRatio, outputQuantity });
        return;
      }
      
      // Determine the rarity/tier for the API call and endpoint
      let endpoint = '/api/trpc/inventory.useGenie?batch=1';
      let payload = {};
      
      if (itemKey.startsWith('summonScroll')) {
        const tier = parseInt(itemKey.replace('summonScroll', ''));
        payload = {
          "0": {
            "json": {
              "type": "summonScroll",
              "rarityLevel": tier,
              "fusedAmount": outputQuantity
            }
          }
        };
      } else if (itemKey.startsWith('diceManipulator')) {
        const tier = parseInt(itemKey.replace('diceManipulator', ''));
        payload = {
          "0": {
            "json": {
              "type": "diceManipulator",
              "rarityLevel": tier,
              "fusedAmount": outputQuantity
            }
          }
        };
      } else {
        handleError(new Error('Invalid item key'), { itemKey });
        return;
      }
      
      // Both summon scrolls and dice manipulators use the same single API call approach
      const itemType = itemKey.startsWith('summonScroll') ? 'summon scroll' : 'dice manipulator';
      console.log(`[Better Hy\'genie] Performing ${itemType} fusion: consuming ${inputQuantity} items to create ${outputQuantity} items`);
      console.log(`[Better Hy\'genie] Payload:`, JSON.stringify(payload, null, 2));
      
      let result = null;
      
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Accept': '*/*',
            'Accept-Language': 'en-US',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Content-Type': 'application/json',
            'X-Game-Version': '1',
            'Origin': 'https://bestiaryarena.com',
            'Referer': 'https://bestiaryarena.com/game',
            'Sec-GPC': '1',
            'Connection': 'keep-alive',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'same-origin'
          },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Better Hy\'genie] Server response:`, errorText);
          
          // Handle specific error cases
          if (response.status === 403) {
            try {
              const errorData = JSON.parse(errorText);
              if (errorData[0]?.error?.json?.message === "Not enough inventory count") {
                throw new Error("Not enough items in inventory for this fusion. Please check your inventory and try again.");
              }
            } catch (parseError) {
              // If we can't parse the error, use the generic message
            }
          }
          
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        result = await response.json();
        console.log(`[Better Hy\'genie] ${itemType} fusion successful:`, result);
        
      } catch (error) {
        handleError(error, `${itemType} fusion failed`);
        return; // Exit early on error
      }
      
      // Update local inventory based on the API response
      if (result && Array.isArray(result) && result[0]?.result?.data?.json?.inventoryDiff) {
        updateLocalInventory(result[0].result.data.json.inventoryDiff);
        
        // Refresh UI to show updated counts (with longer delay to ensure state updates)
        setTimeout(() => {
          refreshUIAfterFusion();
        }, 300);
      }
      
    } catch (error) {
      handleError(error, 'Fusion failed');
      // You could add user notification here if needed
    }
  }
  
  // Update local inventory based on API response (write into playerContext.inventory)
  function updateLocalInventory(inventoryDiff) {
    try {
      const player = globalThis.state?.player;
      if (!player) {
        console.warn('[Better Hy\'genie] Player state not available for inventory update');
        return;
      }
      
      console.log('[Better Hy\'genie] Updating local inventory with diff:', inventoryDiff);
      
      player.send({
        type: 'setState',
        fn: (prev) => {
          const newState = { ...prev };
          // Ensure nested inventory exists
          newState.inventory = { ...prev.inventory };
          
          Object.entries(inventoryDiff).forEach(([itemKey, change]) => {
            if (change === 0) return;
            if (!newState.inventory[itemKey]) newState.inventory[itemKey] = 0;
            newState.inventory[itemKey] = Math.max(0, newState.inventory[itemKey] + change);
            // Mirror on root for compatibility
            newState[itemKey] = newState.inventory[itemKey];
          });
          return newState;
        }
      });
      console.log('[Better Hy\'genie] Local inventory updated successfully');
    } catch (error) {
      handleError(error, 'Failed to update local inventory');
    }
  }
  
  // Determine item key from the slot (optimized with cached selectors + per-slot caching)
  function getItemKeyFromSlot(itemSlot) {
    try {
      // Fast path – return cached value if we already resolved this slot
      if (itemSlot.dataset.itemKey) {
        return itemSlot.dataset.itemKey;
      }

      // Cache commonly used elements
      const summonScrollImg = itemSlot.querySelector(SELECTORS.SUMMON_SCROLL_IMG);
      const diceManipulatorSprite = itemSlot.querySelector(SELECTORS.DICE_MANIPULATOR_SPRITE);
      const rarityElement = itemSlot.querySelector(SELECTORS.RARITY_ELEMENT);

      let detectedKey = null;

      // Check for summon scroll first (faster path)
      if (summonScrollImg) {
        const match = summonScrollImg.src.match(/summonscroll(\d+)\.png/);
        if (match) {
          detectedKey = `summonScroll${match[1]}`;
        }
      }

      // Check for dice manipulator
      if (!detectedKey && diceManipulatorSprite) {
        const spriteId = diceManipulatorSprite.getAttribute('data-sprite-id') ||
                         diceManipulatorSprite.querySelector('img')?.alt;
        if (spriteId === '35909' && rarityElement) {
          const rarity = rarityElement.getAttribute('data-rarity');
          detectedKey = `diceManipulator${rarity}`;
        }
      }

      // Fallback for dice manipulators in dice manipulator sections
      if (!detectedKey) {
        const parentSection = itemSlot.closest(SELECTORS.SECTIONS);
        if (parentSection?.textContent.includes('Dice Manipulators')) {
          if (rarityElement) {
            const rarity = rarityElement.getAttribute('data-rarity');
            detectedKey = `diceManipulator${rarity}`;
          } else {
            // Position-based fallback
            const gridContainer = itemSlot.closest('.grid');
            if (gridContainer?.parentNode) {
              const gridIndex = Array.from(gridContainer.parentNode.children).indexOf(gridContainer);
              if (gridIndex >= 0 && gridIndex < 4) {
                detectedKey = `diceManipulator${gridIndex + 1}`;
              }
            }
          }
        }
      }

      if (detectedKey) {
        itemSlot.dataset.itemKey = detectedKey; // cache for future calls
        return detectedKey;
      }

      return null;
    } catch (error) {
      handleError(error, 'Error getting item key from slot');
      return null;
    }
  }
  
  // Create custom fuse button
  function createCustomFuseButton() {
    const button = document.createElement('button');
    button.className = 'better-hygenie-fuse-button';
    return button;
  }

  // Create quantity input element
  function createQuantityInput(maxQuantity) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'better-hygenie-quantity-input';
    input.placeholder = '1';
    
    // Handle input validation
    input.addEventListener('input', function() {
      const value = this.value.trim();
      
      // Allow empty input (user can delete all numbers)
      if (value === '') {
        return;
      }
      
      // Check if it's a valid number
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 1) {
        this.value = '1';
      } else if (numValue > maxQuantity) {
        this.value = maxQuantity.toString();
      }
    });
    
    // Handle blur event to set default value when input loses focus
    input.addEventListener('blur', function() {
      const value = this.value.trim();
      
      // If empty, set to 1
      if (value === '') {
        this.value = '1';
      }
    });
    
    return input;
  }
  
  // Update fuse button text based on quantity
  function updateFuseButtonText(button, quantity) {
    if (quantity > 1) {
      button.innerHTML = `Fuse<br>${quantity}`;
    } else {
      button.innerHTML = `Fuse<br>1`;
    }
  }
  
  // Show confirmation prompt inside Hy'genie tooltip
  // Friendly name for items
  function getItemDisplayName(itemKey) {
    if (itemKey.startsWith('summonScroll')) {
      const tier = parseInt(itemKey.replace('summonScroll',''));
      const names = {
        1: 'Crude summon scrolls',
        2: 'Ordinary summon scrolls',
        3: 'Refined summon scrolls',
        4: 'Special summon scrolls',
        5: 'Exceptional summon scrolls'
      };
      return names[tier] || 'summon scrolls';
    }
    if (itemKey.startsWith('diceManipulator')) {
      const tier = parseInt(itemKey.replace('diceManipulator',''));
      const names = {
        1: 'Common dice manipulators',
        2: 'Uncommon dice manipulators',
        3: 'Rare dice manipulators',
        4: 'Mythic dice manipulators',
        5: 'Legendary dice manipulators'
      };
      return names[tier] || 'dice manipulators';
    }
    return 'items';
  }

  function showConfirmationPrompt(quantity, itemKey, fuseButton) {
    try {
      const tooltip = document.querySelector('.tooltip-prose');
      if (!tooltip) return;
      const paragraphs = tooltip.querySelectorAll('p');
      if (paragraphs.length < 2) return;
      const msgElem = paragraphs[1];
      if (!tooltip.dataset.originalText) {
        tooltip.dataset.originalText = msgElem.textContent;
      }
      // remove any previous confirmation
      document.querySelectorAll('.better-hygenie-fuse-button.confirm').forEach(btn=>{
        btn.classList.remove('confirm');
        delete btn.dataset.confirm;
      });

      const itemName = getItemDisplayName(itemKey);
      msgElem.textContent = `Are you sure you want to fuse ${quantity} ${itemName}?`;
      msgElem.style.color = '#ff4d4d';
      fuseButton.dataset.confirm = 'pending';
      fuseButton.classList.add('confirm');
      // Attach outside click handler to reset confirmation when clicking elsewhere
      if (!confirmationOutsideHandler) {
        confirmationOutsideHandler = (ev) => {
          if (!ev.target.closest('.better-hygenie-fuse-button.confirm')) {
            removeConfirmationPrompt();
          }
        };
        document.addEventListener('click', confirmationOutsideHandler, true);
      }
    } catch (e) {}
  }
  function removeConfirmationPrompt() {
    try {
      const tooltip = document.querySelector('.tooltip-prose');
      if (!tooltip || !tooltip.dataset.originalText) return;
      const paragraphs = tooltip.querySelectorAll('p');
      if (paragraphs.length < 2) return;
      const msgElem = paragraphs[1];
      msgElem.textContent = tooltip.dataset.originalText;
      msgElem.style.color = '';
      delete tooltip.dataset.originalText;
      // remove confirm class from any button
      // Remove pending confirmation from all fuse buttons
      document.querySelectorAll('.better-hygenie-fuse-button').forEach(b=>{
        b.classList.remove('confirm');
        delete b.dataset.confirm;
      });
      if (confirmationOutsideHandler) {
        document.removeEventListener('click', confirmationOutsideHandler, true);
        confirmationOutsideHandler = null;
      }
    } catch (e) {}
    }
  
  // Show a temporary tooltip message (error/info)
  function showTooltipMessage(message, color = '#ff4d4d', duration = CONSTANTS.ERROR_DISPLAY_DURATION) {
    try {
      const tooltip = document.querySelector('.tooltip-prose');
      if (!tooltip) return;
      const paragraphs = tooltip.querySelectorAll('p');
      if (paragraphs.length < 2) return;
      const msgElem = paragraphs[1];
      if (!tooltip.dataset.originalText) {
        tooltip.dataset.originalText = msgElem.textContent;
      }
      msgElem.textContent = message;
      msgElem.style.color = color;
      setTimeout(() => {
        if (!tooltip.dataset.originalText) return;
        msgElem.textContent = tooltip.dataset.originalText;
        msgElem.style.color = '';
        delete tooltip.dataset.originalText;
      }, duration);
    } catch (e) {}
  }
  
  // Refresh UI after fusion to show updated inventory counts
  function refreshUIAfterFusion() {
    try {
      const modal = document.querySelector(`${SELECTORS.HYGENIE_MODAL}[data-better-hygenie-enhanced]`);
      if (!modal) return;
      
      // Force a fresh read of the game state (no caching)
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const inventory = playerContext?.inventory || {};
      
      console.log('[Better Hy\'genie] Refreshing UI with fresh inventory:', inventory);
      
      if (!inventory) {
        console.warn('[Better Hy\'genie] No inventory state available for UI refresh');
        return;
      }
      
      // Find all quantity inputs and update their max values
      const quantityInputs = modal.querySelectorAll('.better-hygenie-quantity-input');
      quantityInputs.forEach(input => {
        const gridContainer = input.closest(SELECTORS.GRID_CONTAINERS);
        if (!gridContainer) return;
        
        const itemSlot = gridContainer.querySelector(SELECTORS.ITEM_SLOT);
        if (!itemSlot) return;
        
        const itemKey = getItemKeyFromSlot(itemSlot);
        const currentQuantity = inventory[itemKey] || 0;
        
        console.log(`[Better Hy\'genie] Refreshing UI for ${itemKey}: ${currentQuantity} items`);
        
        // Always keep controls visible, just update their values
        input.style.display = 'block';
        const fuseButton = gridContainer.querySelector('.better-hygenie-fuse-button');
        if (fuseButton) fuseButton.style.display = 'flex';
        
        // Update max value and current value
        const fusableAmount = calculateFusableAmount(itemKey, currentQuantity);
        const maxInputQuantity = fusableAmount > 0 ? fusableAmount * getFusionRatio(itemKey) : 1;
        const maxInputForDisplay = Math.min(maxInputQuantity, currentQuantity);
        
        input.max = currentQuantity;
        input.value = Math.min(parseInt(input.value) || 1, Math.max(1, maxInputForDisplay));
        
        // Update button text
        if (fuseButton) {
          updateFuseButtonText(fuseButton, parseInt(input.value) || 1);
        }
      });
      
      // The game should automatically re-render based on the state update
      
      console.log('[Better Hy\'genie] UI refreshed after fusion');
    } catch (error) {
      handleError(error, 'Error refreshing UI after fusion');
    }
  }
  
// =======================
// 3. UI Component Creation
// =======================
  
  // Add quantity inputs to a section (Summon Scrolls or Dice Manipulators)
  function addQuantityInputsToSection(section) {
    // Check if this section has already been processed
    if (section.dataset.betterHygenieSectionProcessed) {
      return;
    }
    
    // Mark section as being processed to prevent duplicates
    section.dataset.betterHygenieSectionProcessed = 'processing';
    
    // Find all grid containers that contain item slots and fuse buttons
    const gridContainers = section.querySelectorAll(SELECTORS.GRID_CONTAINERS);
    
    let processedCount = 0;
    let pendingAsyncCount = 0;
    
    gridContainers.forEach((gridContainer, index) => {
      const itemSlot = gridContainer.querySelector(SELECTORS.ITEM_SLOT);
      const originalFuseButton = gridContainer.querySelector(SELECTORS.FUSE_BUTTON);
      
      if (!itemSlot || !originalFuseButton) {
        return;
      }
      
      // Check if we've already added our custom UI to this container
      if (gridContainer.querySelector('.better-hygenie-quantity-input')) {
        return;
      }
      
      const itemKey = getItemKeyFromSlot(itemSlot);
      
      // Use retry mechanism for dice manipulators to ensure we get correct game state data
      const isDiceManipulator = itemKey && itemKey.startsWith('diceManipulator');
      
      if (isDiceManipulator) {
        // Use async retry for dice manipulators
        pendingAsyncCount++;
        getItemQuantityWithRetry(itemSlot).then(totalQuantity => {
          const fusableAmount = calculateFusableAmount(itemKey, totalQuantity);
          
          // Double-check that we haven't already added an input (race condition protection)
          if (gridContainer.querySelector('.better-hygenie-quantity-input')) {
            pendingAsyncCount--;
            checkCompletion();
            return;
          }
          
          // Create quantity input with available amount as max
          const quantityInput = createQuantityInput(totalQuantity || 1);
          
          // Create our custom fuse button
          const customFuseButton = createCustomFuseButton();
          
          // Insert our custom UI before the original button
          originalFuseButton.parentNode.insertBefore(quantityInput, originalFuseButton);
          originalFuseButton.parentNode.insertBefore(customFuseButton, originalFuseButton);
          
          // Hide the original button now that we have our custom UI
          originalFuseButton.style.display = 'none';
          
          // Calculate maximum input quantity for maximum output (use real totalQuantity)
          const fusionRatio = getFusionRatio(itemKey);
          const maxInputQuantity = fusableAmount > 0 ? fusableAmount * fusionRatio : totalQuantity;
          const maxInputForDisplay = totalQuantity > 0 ? Math.min(maxInputQuantity, totalQuantity) : 1;
          
          console.log(`[Better Hy\'genie] ${itemKey}: totalQuantity=${totalQuantity}, fusableAmount=${fusableAmount}, fusionRatio=${fusionRatio}, maxInputQuantity=${maxInputQuantity}, maxInputForDisplay=${maxInputForDisplay}`);
          
          // Set the initial value to maximum allowed conversion
          quantityInput.value = maxInputForDisplay.toString();
          
          // Force update the button text immediately
          updateFuseButtonText(customFuseButton, maxInputForDisplay);
          
          // Add event listeners to our custom button
          addEventListenersToInput(quantityInput, customFuseButton, itemKey, totalQuantity, index, itemSlot);
          
          processedCount++;
          pendingAsyncCount--;
          checkCompletion();
        });
        return;
      }
      
            // For summon scrolls, use immediate method
      const totalQuantity = getItemQuantity(itemSlot);
      const fusableAmount = calculateFusableAmount(itemKey, totalQuantity);
      
      // Create quantity input with available amount as max
      const quantityInput = createQuantityInput(totalQuantity || 1);
      
      // Create our custom fuse button
      const customFuseButton = createCustomFuseButton();
      
      // Insert our custom UI before the original button
      originalFuseButton.parentNode.insertBefore(quantityInput, originalFuseButton);
      originalFuseButton.parentNode.insertBefore(customFuseButton, originalFuseButton);
      
      // Hide the original button now that we have our custom UI
      originalFuseButton.style.display = 'none';
      
      // Calculate maximum input quantity for maximum output (use real totalQuantity)
      const fusionRatio = getFusionRatio(itemKey);
      const maxInputQuantity = fusableAmount > 0 ? fusableAmount * fusionRatio : totalQuantity;
      const maxInputForDisplay = totalQuantity > 0 ? Math.min(maxInputQuantity, totalQuantity) : 1;
      
      console.log(`[Better Hy\'genie] ${itemKey}: totalQuantity=${totalQuantity}, fusableAmount=${fusableAmount}, fusionRatio=${fusionRatio}, maxInputQuantity=${maxInputQuantity}, maxInputForDisplay=${maxInputForDisplay}`);
      
      // Set the initial value to maximum allowed conversion
      quantityInput.value = maxInputForDisplay.toString();
      
      // Force update the button text immediately
          updateFuseButtonText(customFuseButton, maxInputForDisplay);
      
      // Add event listeners to our custom button
      addEventListenersToInput(quantityInput, customFuseButton, itemKey, totalQuantity, index, itemSlot);
      
      processedCount++;
    });
    
    // Function to check if all async operations are complete
    function checkCompletion() {
      if (pendingAsyncCount === 0) {
        // Mark section as processed if we successfully processed any grids
        if (processedCount > 0) {
          section.dataset.betterHygenieSectionProcessed = 'true';
        } else {
          // If no grids were processed, remove the processing marker
          delete section.dataset.betterHygenieSectionProcessed;
        }
      }
    }
    
    // If no async operations, check completion immediately
    if (pendingAsyncCount === 0) {
      checkCompletion();
    }
  }
  
  // Add event listeners to input and button
  function addEventListenersToInput(quantityInput, fuseButton, itemKey, validFusionAmount, index, itemSlot) {
    // Add event listener to update button text
    quantityInput.addEventListener('input', function() {
      const value = this.value.trim();
      let quantity;
      
      if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        // Ensure quantity doesn't exceed the available amount
        const availableQuantity = getItemQuantity(itemSlot);
        if (quantity > availableQuantity) {
          quantity = availableQuantity;
        }
      }
      
      updateFuseButtonText(fuseButton, quantity);
    });
    
    // Add event listener to the fuse button
    fuseButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      // Prevent multiple simultaneous clicks
      if (fuseButton.disabled) {
        return;
      }
      
      const value = quantityInput.value.trim();
      let quantity;
      
      if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        // Ensure quantity doesn't exceed the available amount
        const availableQuantity = getItemQuantity(itemSlot);
        if (quantity > availableQuantity) {
          quantity = availableQuantity;
        }
      }
      

      
      console.log(`[Better Hy\'genie] Fusing ${quantity} items from slot ${index + 1}`);
      
      // Final validation: Check current inventory before proceeding
      const currentQuantity = getItemQuantity(itemSlot);
      
      if (currentQuantity < quantity) {
        handleError(new Error(`Insufficient items for fusion. Requested: ${quantity}, Available: ${currentQuantity}`), { requested: quantity, available: currentQuantity });
        removeConfirmationPrompt();
        showTooltipMessage(`Not enough items! You only have ${currentQuantity} items available.`);
        return;
      }
      
      // Validate that quantity meets minimum fusion ratio
      const fusionRatio = getFusionRatio(itemKey);
      if (quantity < fusionRatio) {
        removeConfirmationPrompt();
        showTooltipMessage(`You need at least ${fusionRatio} items to perform a fusion.`);
        return;
      }
      
      // Confirmation after validations pass
      if (fuseButton.dataset.confirm !== 'pending') {
        showConfirmationPrompt(quantity, itemKey, fuseButton);
        return; // wait for second click
      } else {
        removeConfirmationPrompt();
        delete fuseButton.dataset.confirm;
      }
      
      // Show loading state and disable button
      const originalText = fuseButton.innerHTML;
              fuseButton.innerHTML = 'Fusing...';
        removeConfirmationPrompt();
      fuseButton.disabled = true;
      
      try {
        // Implement actual fusion logic
        await performFusion(itemKey, quantity);
        // Show success message inside tooltip
        removeConfirmationPrompt();
        showTooltipMessage(`Successfully fused ${quantity} items!`, '#32cd32', 1500);
      } catch (error) {
        handleError(error, `${itemKey} fusion failed`);
        
        // Show user-friendly error message
        let errorMessage = 'Fusion failed. Please try again.';
        if (error.message.includes('Not enough items')) {
          errorMessage = error.message;
        } else if (error.message.includes('HTTP error! Status: 403')) {
          errorMessage = 'Not enough items in inventory for this fusion.';
        }
        
        // Show error state briefly
        fuseButton.innerHTML = 'Error!';
          removeConfirmationPrompt();
          showTooltipMessage(errorMessage);
        setTimeout(() => {
          fuseButton.innerHTML = originalText;
          fuseButton.disabled = false;
        }, CONSTANTS.ERROR_DISPLAY_DURATION);
        return;
      } finally {
        // Restore button state
        fuseButton.innerHTML = originalText;
        fuseButton.disabled = false;
      }
    });
  }
  
// =======================
// 4. Core UI Functions
// =======================
  
  // Main function to enhance the Hy'genie modal
  function enhanceHygenieModal() {
    // Try multiple ways to find the Hy'genie modal
    let hygenieTitle = null;
    let modal = null;
    
    // Method 1: Look for h2 with p containing "Hy'genie" and find the correct widget-bottom
    hygenieTitle = document.querySelector('h2 p');
    if (hygenieTitle && hygenieTitle.textContent.includes('Hy\'genie')) {
      // Replace title with activation message in green
      hygenieTitle.textContent = "Better Hy'genie activated!";
      hygenieTitle.style.color = '#32cd32';
      // Look for the widget-bottom that contains both the title and the sections
      const widgetBottom = hygenieTitle.closest('.widget-bottom');
      if (widgetBottom && widgetBottom.textContent.includes('Summon Scrolls')) {
        modal = widgetBottom;
      }
    }
    
    // Method 2: Look for any widget-bottom containing both "Hy'genie" and the sections
    if (!modal) {
      const widgetBottoms = document.querySelectorAll('.widget-bottom');
      for (const widget of widgetBottoms) {
        const text = widget.textContent || '';
        if (text.includes('Hy\'genie') && text.includes('Summon Scrolls') && text.includes('Dice Manipulators')) {
          modal = widget;
          break;
        }
      }
    }
    
    // Method 3: Look for the specific structure with the correct class hierarchy
    if (!modal) {
      const hygenieElements = document.querySelectorAll('*');
      for (const element of hygenieElements) {
        if (element.textContent && element.textContent.includes('Hy\'genie')) {
          // Find the widget-bottom that contains this element and also has the sections
          const widgetBottom = element.closest('.widget-bottom');
          if (widgetBottom && widgetBottom.textContent.includes('Summon Scrolls') && widgetBottom.textContent.includes('Dice Manipulators')) {
            modal = widgetBottom;
            break;
          }
        }
      }
    }
    
    if (!modal) {
      return false;
    }
    
    // Check if we've already enhanced this modal
    if (modal.dataset.betterHygenieEnhanced) {
      return true;
    }
    
    // Check if modal is currently being processed
    if (modal.dataset.betterHygenieProcessing) {
      return false;
    }
    
    // Mark modal as being processed
    modal.dataset.betterHygenieProcessing = 'true';
    
    // Find the sections by looking for the specific structure
    // Based on the HTML, sections are div elements with widget-top and widget-bottom children
    const sections = modal.querySelectorAll('.w-full');
    
    let sectionsProcessed = 0;
    
    sections.forEach((sectionContainer, index) => {
      const sectionHeader = sectionContainer.querySelector('.widget-top');
      if (!sectionHeader) return;
      
      const sectionText = sectionHeader.textContent || '';
      
      if (sectionText.includes('Summon Scrolls') || sectionText.includes('Dice Manipulators')) {
        // Find the corresponding widget-bottom that contains the actual content
        const sectionContent = sectionContainer.querySelector('.widget-bottom');
        
        if (sectionContent) {
          addQuantityInputsToSection(sectionContent);
          sectionsProcessed++;
        }
      }
    });
    
    // Mark as enhanced
    modal.dataset.betterHygenieEnhanced = 'true';
    
    // Remove processing marker
    delete modal.dataset.betterHygenieProcessing;
    
    return true;
  }
  
// =======================
// 5. Main Logic
// =======================
  
  // Observer to watch for modal changes
  let observer = null;
  let observerTimeout = null;
  
  // Utility to transform Hy'genie tooltip title to activation text
  function transformHygenieTooltip() {
    try {
      const tooltip = document.querySelector('.tooltip-prose');
      if (!tooltip) return;
      const titleElem = tooltip.querySelector('p'); // first <p> is title
      if (titleElem && titleElem.textContent.includes("Hy'genie") && titleElem.textContent !== "Better Hy'genie activated!") {
        titleElem.textContent = "Better Hy'genie activated!";
        titleElem.style.color = '#32cd32';
      }
    } catch (e) { /* silent */ }
  }

  // Debounced function for processing mutations
  function debouncedProcessMutations(mutations) {
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }
    
    observerTimeout = setTimeout(() => {
      // Always attempt tooltip transform
      transformHygenieTooltip();
      // Check if already processing to avoid duplicate work
      const existingModal = document.querySelector(`${SELECTORS.HYGENIE_MODAL}[data-better-hygenie-enhanced]`);
      if (existingModal) {
        return;
      }
      
      // Early exit if no relevant mutations
      const hasRelevantMutation = mutations.some(mutation => 
        mutation.type === 'childList' && 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (node.textContent?.includes('Hy\'genie') || 
           node.querySelector?.('*') && 
           Array.from(node.querySelectorAll('*')).some(el => 
             el.textContent?.includes('Hy\'genie')
           ))
        )
      );
      
      if (!hasRelevantMutation) {
        return;
      }
      
      // Find and process the modal
      const widgetBottoms = document.querySelectorAll(SELECTORS.HYGENIE_MODAL);
      for (const widget of widgetBottoms) {
        if (widget.querySelector(SELECTORS.RARITY_ELEMENT) && 
            !widget.dataset.betterHygenieProcessing && 
            !widget.dataset.betterHygenieEnhanced) {
          widget.dataset.betterHygenieProcessing = 'true';
          enhanceHygenieModal();
          if (widget.dataset.betterHygenieProcessing) {
            delete widget.dataset.betterHygenieProcessing;
          }
          break; // Only process one modal at a time
        }
      }
    }, CONSTANTS.DEBOUNCE_DELAY);
  }
  
  // Retry mechanism for modal enhancement
  function retryEnhanceHygenieModal(maxAttempts = CONSTANTS.RETRY_MAX_ATTEMPTS, baseDelay = CONSTANTS.RETRY_BASE_DELAY) {
    let attempts = 0;
    
    const tryEnhance = () => {
      attempts++;
      if (enhanceHygenieModal()) {
        return; // Success, stop retrying
      }
      
      if (attempts < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
        setTimeout(tryEnhance, delay);
      } else {
        console.warn('[Better Hy\'genie] Failed to enhance modal after maximum retry attempts');
      }
    };
    
    tryEnhance();
  }
  
  function initializeBetterHygenie() {
    // Inject styles
    injectStyles();
    
    // Set up observer to watch for DOM changes
    observer = new MutationObserver(debouncedProcessMutations);
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Run initial tooltip transform
    transformHygenieTooltip();

    // Use retry mechanism instead of multiple timeouts
    retryEnhanceHygenieModal();
  }
  
  function cleanup() {
    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    // Remove styles
    const styleElement = document.getElementById('better-hygenie-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    // Remove enhanced markers
    document.querySelectorAll('[data-better-hygenie-enhanced]').forEach(element => {
      delete element.dataset.betterHygenieEnhanced;
    });
    
    // Remove section processing markers
    document.querySelectorAll('[data-better-hygenie-section-processed]').forEach(element => {
      delete element.dataset.betterHygenieSectionProcessed;
    });
    
    // Remove modal processing markers
    document.querySelectorAll('[data-better-hygenie-processing]').forEach(element => {
      delete element.dataset.betterHygenieProcessing;
    });
    
    // Remove quantity inputs and custom buttons
    document.querySelectorAll('.better-hygenie-quantity-input, .better-hygenie-fuse-button').forEach(element => {
      // Remove event listeners by cloning and replacing
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
      newElement.remove();
    });
    
    // Show original buttons that were hidden
    document.querySelectorAll('button[style*="display: none"]').forEach(button => {
      if (button.parentNode.querySelector('.better-hygenie-fuse-button')) {
        button.style.display = '';
      }
    });
  }
  
  // Initialize the mod
  initializeBetterHygenie();
  
  // Export cleanup function for the mod loader
  if (typeof context !== 'undefined') {
    context.exports = {
      cleanup: cleanup
    };
  }
  
})(); 