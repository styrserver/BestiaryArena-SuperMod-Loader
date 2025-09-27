// =======================
// 0. Version & Metadata
// =======================
(function() {
  console.log('[Better Hy\'genie] initializing...');
  console.log('[Better Hy\'genie] DEBUG: Mod is loading and console.log is working!');
  
// =======================
// 1. Configuration & Constants
// =======================
  const defaultConfig = { enabled: true };
  const config = Object.assign({}, defaultConfig, context?.config);
  
  const CONSTANTS = {
    DEBOUNCE_DELAY: 100,
    RETRY_MAX_ATTEMPTS: 5,
    RETRY_BASE_DELAY: 100,
    RETRY_DELAY: 500,
    LARGE_QUANTITY_THRESHOLD: 10,
    ERROR_DISPLAY_DURATION: 2000,
    MAX_INPUT_WIDTH: 50
  };
  
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
  
  let confirmationOutsideHandler = null;
  
  const QUANTITY_INPUT_STYLES = `
    .better-hygenie-quantity-input {
      width: 100%;
      max-width: ${CONSTANTS.MAX_INPUT_WIDTH}px;
      height: 20px;
      background-image: url('https://bestiaryarena.com/_next/static/media/background-darker.2679c837.png');
      background-size: auto;
      background-repeat: repeat;
      background-position: center;
      border: none;
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
      position: relative;
    }
    
    .better-hygenie-quantity-input::before {
      content: '';
      position: absolute;
      top: -2px;
      left: -2px;
      right: -2px;
      bottom: -2px;
      background-image: url('https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png');
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-position: center;
      z-index: -1;
      border-radius: 4px;
    }
    .better-hygenie-quantity-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(106, 106, 106, 0.5);
    }
    .better-hygenie-quantity-input::-webkit-inner-spin-button,
    .better-hygenie-quantity-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .better-hygenie-fuse-button {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      
      font-family: inherit !important;
      font-size: 14px !important;
      line-height: 1 !important;
      letter-spacing: 0.025em !important;
      
      color: #ffffff !important;
      
      gap: 0.25rem !important;
      padding: 0.05rem 0 !important;
      padding-bottom: 1px !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      margin: 0 !important;
      
      background-image: 
        url('https://bestiaryarena.com/_next/static/media/1-frame-blue.cf300a6a.png'),
        url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') !important;
      background-size: 100% 100%, cover !important;
      background-repeat: no-repeat, no-repeat !important;
      background-position: center, center !important;
      border: none !important;
      border-radius: 0 !important;
      
      cursor: pointer !important;
      transition: all 0.1s ease !important;
      
      outline: 2px solid transparent !important;
      outline-offset: 2px !important;
    }
    
    .better-hygenie-fuse-button:focus-visible {
      outline: 2px solid rgba(59, 130, 246, 0.5) !important;
    }
    
    .better-hygenie-fuse-button:disabled {
      cursor: not-allowed !important;
      color: rgba(255, 255, 255, 0.6) !important;
      filter: grayscale(50%) !important;
    }
    
    .better-hygenie-fuse-button:active {
      background-image: 
        url('https://bestiaryarena.com/_next/static/media/1-frame-pressed.e3fabbc5.png'),
        url('https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png') !important;
      background-size: 100% 100%, cover !important;
      background-repeat: no-repeat, no-repeat !important;
      background-position: center, center !important;
      transform: translateY(1px) !important;
    }
    
    .better-hygenie-fuse-button.confirm {
      background-image:
        url('https://bestiaryarena.com/_next/static/media/1-frame-green.fe32d59c.png'),
        url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') !important;
    }

    .better-hygenie-fuse-button svg {
      width: 11px !important;
      height: 11px !important;
      margin-bottom: 1px !important;
      margin-top: 2px !important;
    }

  `;
  
// =======================
// 2. Utility Functions
// =======================

  function handleError(error, context = '') {
    const prefix = '[Better Hy\'genie]';
    const message = context ? `${prefix} ${context}:` : prefix;
    console.error(message, error);
  }

  function getGameState() {
    try {
      return globalThis.state?.player?.getSnapshot()?.context;
    } catch (error) {
      handleError(error, 'Error accessing game state');
      return null;
    }
  }
  
  function getInventoryState() {
    try {
      console.log('[Better Hy\'genie] getInventoryState called');
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      console.log('[Better Hy\'genie] Player context:', playerContext);
      const inventory = playerContext?.inventory || {};
      console.log('[Better Hy\'genie] Inventory keys:', Object.keys(inventory));
      
      if (Object.keys(inventory).length === 0) {
        console.log('[Better Hy\'genie] Inventory is empty, returning null');
        return null;
      }
      
      const hasSummonScrolls = Object.keys(inventory).some(key => key.startsWith('summonScroll'));
      const hasDiceManipulators = Object.keys(inventory).some(key => key.startsWith('diceManipulator'));
      console.log('[Better Hy\'genie] hasSummonScrolls:', hasSummonScrolls, 'hasDiceManipulators:', hasDiceManipulators);
      
      if (!hasSummonScrolls && !hasDiceManipulators) {
        console.log('[Better Hy\'genie] No relevant items found, returning null');
        return null;
      }
      console.log('[Better Hy\'genie] Returning inventory:', inventory);
      return inventory;
    } catch (error) {
      handleError(error, 'Error accessing inventory state');
      return null;
    }
  }
  
  function injectStyles() {
    if (!document.getElementById('better-hygenie-styles')) {
      const style = document.createElement('style');
      style.id = 'better-hygenie-styles';
      style.textContent = QUANTITY_INPUT_STYLES;
      document.head.appendChild(style);
    }
  }
  
  function getItemQuantity(itemSlot) {
    const inventory = getInventoryState();
    if (!inventory) return 0;
    
    const itemKey = getItemKeyFromSlot(itemSlot);
    return itemKey ? (inventory[itemKey] || 0) : 0;
  }
  
  
  function getFusionRatio(itemKey) {
    try {
      if (!itemKey) {
        console.warn('[Better Hy\'genie] No itemKey provided to getFusionRatio');
        return 1;
      }
      
      if (itemKey.startsWith('diceManipulator')) {
        const tier = parseInt(itemKey.replace('diceManipulator', ''));
        switch (tier) {
          case 1: return 20;
          case 2: return 10;
          case 3: return 5;
          case 4: return 3;
          case 5: return 0;
          default: return 1;
        }
      }
      
      if (itemKey.startsWith('summonScroll')) {
        const tier = parseInt(itemKey.replace('summonScroll', ''));
        switch (tier) {
          case 1: return 4;
          case 2: return 3;
          case 3: return 2;
          case 4: return 2;
          case 5: return 0;
          default: return 1;
        }
      }
      
      console.warn(`[Better Hy\'genie] Unknown itemKey: ${itemKey}, using default ratio 1`);
      return 1;
    } catch (error) {
      handleError(error, 'Error getting fusion ratio');
      return 1;
    }
  }
  
  function calculateFusableAmount(itemKey, availableQuantity) {
    const ratio = getFusionRatio(itemKey);
    if (ratio === 0) return 0;
    return Math.floor(availableQuantity / ratio);
  }
  
  async function performFusion(itemKey, inputQuantity) {
    try {
      if (!itemKey || inputQuantity <= 0) {
        handleError(new Error('Invalid fusion parameters'), { itemKey, inputQuantity });
        return;
      }
      
      const gameState = getGameState();
      if (gameState && gameState.inventory) {
        const currentQuantity = gameState.inventory[itemKey] || 0;
        if (currentQuantity < inputQuantity) {
          handleError(new Error('Insufficient items for fusion'), { requested: inputQuantity, available: currentQuantity });
          return;
        }
      }
      
      const fusionRatio = getFusionRatio(itemKey);
      const outputQuantity = Math.floor(inputQuantity / fusionRatio);
      
      if (outputQuantity <= 0) {
        handleError(new Error('Invalid fusion: input quantity too low for fusion ratio'), { inputQuantity, fusionRatio, outputQuantity });
        return;
      }
      
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
      
      const itemType = itemKey.startsWith('summonScroll') ? 'summon scroll' : 'dice manipulator';
      
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
        
      } catch (error) {
        handleError(error, `${itemType} fusion failed`);
        return;
      }
      
      if (result && Array.isArray(result) && result[0]?.result?.data?.json?.inventoryDiff) {
        updateLocalInventory(result[0].result.data.json.inventoryDiff);
        
        setTimeout(() => {
          refreshUIAfterFusion();
        }, 300);
      }
      
    } catch (error) {
      handleError(error, 'Fusion failed');
    }
  }
  
  function updateLocalInventory(inventoryDiff) {
    try {
      const player = globalThis.state?.player;
      if (!player) {
        console.warn('[Better Hy\'genie] Player state not available for inventory update');
        return;
      }
      
      player.send({
        type: 'setState',
        fn: (prev) => {
          const newState = { ...prev };
          newState.inventory = { ...prev.inventory };
          
          Object.entries(inventoryDiff).forEach(([itemKey, change]) => {
            if (change === 0) return;
            if (!newState.inventory[itemKey]) newState.inventory[itemKey] = 0;
            newState.inventory[itemKey] = Math.max(0, newState.inventory[itemKey] + change);
            newState[itemKey] = newState.inventory[itemKey];
          });
          return newState;
        }
      });
    } catch (error) {
      handleError(error, 'Failed to update local inventory');
    }
  }
  
  function getItemKeyFromSlot(itemSlot) {
    try {
      if (itemSlot.dataset.itemKey) {
        return itemSlot.dataset.itemKey;
      }

      const summonScrollImg = itemSlot.querySelector(SELECTORS.SUMMON_SCROLL_IMG);
      const diceManipulatorSprite = itemSlot.querySelector(SELECTORS.DICE_MANIPULATOR_SPRITE);
      const rarityElement = itemSlot.querySelector(SELECTORS.RARITY_ELEMENT);

      let detectedKey = null;

      if (summonScrollImg) {
        const match = summonScrollImg.src.match(/summonscroll(\d+)\.png/);
        if (match) {
          detectedKey = `summonScroll${match[1]}`;
        }
      }

      if (!detectedKey && diceManipulatorSprite) {
        const spriteId = diceManipulatorSprite.getAttribute('data-sprite-id') ||
                         diceManipulatorSprite.querySelector('img')?.alt;
        if (spriteId === '35909' && rarityElement) {
          const rarity = rarityElement.getAttribute('data-rarity');
          detectedKey = `diceManipulator${rarity}`;
        }
      }

      if (!detectedKey) {
        const parentSection = itemSlot.closest(SELECTORS.SECTIONS);
        // Check for both English and Portuguese variants
        if (parentSection?.textContent.includes('Dice Manipulators') || 
            parentSection?.textContent.includes('Dados Manipuladores')) {
          if (rarityElement) {
            const rarity = rarityElement.getAttribute('data-rarity');
            detectedKey = `diceManipulator${rarity}`;
          } else {
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
        itemSlot.dataset.itemKey = detectedKey;
        return detectedKey;
      }

      return null;
    } catch (error) {
      handleError(error, 'Error getting item key from slot');
      return null;
    }
  }
  
  function createCustomFuseButton() {
    const button = document.createElement('button');
    button.className = 'better-hygenie-fuse-button';
    return button;
  }

  function createQuantityInput(maxQuantity) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'better-hygenie-quantity-input';
    input.placeholder = '1';
    
    input.addEventListener('input', function() {
      const value = this.value.trim();
      
      if (value === '') {
        return;
      }
      
      const numValue = parseInt(value);
      if (isNaN(numValue) || numValue < 1) {
        this.value = '1';
      } else if (numValue > maxQuantity) {
        this.value = maxQuantity.toString();
      }
    });
    
    input.addEventListener('blur', function() {
      const value = this.value.trim();
      
      if (value === '') {
        this.value = '1';
      }
    });
    
    return input;
  }
  
  function updateFuseButtonText(button, quantity) {
    if (quantity > 1) {
      button.innerHTML = `Fuse<br>${quantity}`;
    } else {
      button.innerHTML = `Fuse<br>1`;
    }
  }
  
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
      
      document.querySelectorAll('.better-hygenie-fuse-button.confirm').forEach(btn=>{
        btn.classList.remove('confirm');
        delete btn.dataset.confirm;
      });

      const itemName = getItemDisplayName(itemKey);
      msgElem.textContent = `Are you sure you want to fuse ${quantity} ${itemName}?`;
      msgElem.style.color = '#ff4d4d';
      fuseButton.dataset.confirm = 'pending';
      fuseButton.classList.add('confirm');
      
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
  
  function refreshUIAfterFusion() {
    try {
      const modal = document.querySelector(`${SELECTORS.HYGENIE_MODAL}[data-better-hygenie-enhanced]`);
      if (!modal) return;
      
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const inventory = playerContext?.inventory || {};
      
      if (!inventory) {
        console.warn('[Better Hy\'genie] No inventory state available for UI refresh');
        return;
      }
      
      console.log('[Better Hy\'genie] Refreshing all input boxes with updated inventory');
      
      const quantityInputs = modal.querySelectorAll('.better-hygenie-quantity-input');
      quantityInputs.forEach(input => {
        const gridContainer = input.closest(SELECTORS.GRID_CONTAINERS);
        if (!gridContainer) return;
        
        const itemSlot = gridContainer.querySelector(SELECTORS.ITEM_SLOT);
        if (!itemSlot) return;
        
        const itemKey = getItemKeyFromSlot(itemSlot);
        if (!itemKey) return;
        
        const currentQuantity = inventory[itemKey] || 0;
        console.log(`[Better Hy\'genie] Updating ${itemKey}: ${currentQuantity} items`);
        
        input.style.display = 'block';
        const fuseButton = gridContainer.querySelector('.better-hygenie-fuse-button');
        if (fuseButton) fuseButton.style.display = 'flex';
        
        const fusableAmount = calculateFusableAmount(itemKey, currentQuantity);
        const fusionRatio = getFusionRatio(itemKey);
        const maxInputQuantity = fusableAmount > 0 ? fusableAmount * fusionRatio : currentQuantity;
        const maxInputForDisplay = currentQuantity > 0 ? Math.min(maxInputQuantity, currentQuantity) : 1;
        
        // Update input value to the maximum fusable amount
        const newValue = Math.max(1, maxInputForDisplay);
        input.value = newValue.toString();
        
        // Update button text
        if (fuseButton) {
          updateFuseButtonText(fuseButton, newValue);
        }
        
        // Enable/disable button based on available quantity
        if (fuseButton) {
          fuseButton.disabled = currentQuantity < fusionRatio;
          
          // Update the stored quantity in the event listener
          if (fuseButton._updateQuantity) {
            fuseButton._updateQuantity(currentQuantity);
          }
        }
      });
      
      console.log('[Better Hy\'genie] All input boxes refreshed successfully');
      
    } catch (error) {
      handleError(error, 'Error refreshing UI after fusion');
    }
  }
  
// =======================
// 3. UI Component Creation
// =======================
  
  function addQuantityInputsToSection(section) {
    console.log('[Better Hy\'genie] addQuantityInputsToSection called for section:', section);
    
    if (section.dataset.betterHygenieSectionProcessed) {
      console.log('[Better Hy\'genie] Section already processed, skipping');
      return;
    }
    
    console.log('[Better Hy\'genie] Starting to process section');
    section.dataset.betterHygenieSectionProcessed = 'processing';
    
    const gridContainers = section.querySelectorAll(SELECTORS.GRID_CONTAINERS);
    console.log('[Better Hy\'genie] Found grid containers:', gridContainers.length);
    
    // Get inventory once for the entire section
    const inventory = getInventoryState();
    if (!inventory) {
      console.log('[Better Hy\'genie] No inventory available, skipping section');
      delete section.dataset.betterHygenieSectionProcessed;
      return;
    }
    
    let processedCount = 0;
    
    gridContainers.forEach((gridContainer, index) => {
      console.log(`[Better Hy\'genie] Processing grid container ${index}:`, gridContainer);
      
      const itemSlot = gridContainer.querySelector(SELECTORS.ITEM_SLOT);
      const originalFuseButton = gridContainer.querySelector(SELECTORS.FUSE_BUTTON);
      
      console.log(`[Better Hy\'genie] Grid ${index} - itemSlot:`, !!itemSlot, 'originalFuseButton:', !!originalFuseButton);
      
      if (!itemSlot || !originalFuseButton) {
        console.log(`[Better Hy\'genie] Grid ${index} - Missing required elements, skipping`);
        return;
      }
      
      if (gridContainer.querySelector('.better-hygenie-quantity-input')) {
        console.log(`[Better Hy\'genie] Grid ${index} - Already has input, skipping`);
        return;
      }
      
      const itemKey = getItemKeyFromSlot(itemSlot);
      console.log(`[Better Hy\'genie] Grid ${index} - itemKey:`, itemKey);
      
      if (!itemKey) {
        console.log(`[Better Hy\'genie] Grid ${index} - No item key found, skipping`);
        return;
      }
      
      // Get quantity directly from inventory
      const totalQuantity = inventory[itemKey] || 0;
      console.log(`[Better Hy\'genie] Grid ${index} - Got quantity:`, totalQuantity);
      
      const fusableAmount = calculateFusableAmount(itemKey, totalQuantity);
      
      console.log(`[Better Hy\'genie] Grid ${index} - Creating input and button`);
      const quantityInput = createQuantityInput(totalQuantity || 1);
      const customFuseButton = createCustomFuseButton();
      
      originalFuseButton.parentNode.insertBefore(quantityInput, originalFuseButton);
      originalFuseButton.parentNode.insertBefore(customFuseButton, originalFuseButton);
      
      originalFuseButton.style.display = 'none';
      console.log(`[Better Hy\'genie] Grid ${index} - Successfully added input and button`);
      
      const fusionRatio = getFusionRatio(itemKey);
      const maxInputQuantity = fusableAmount > 0 ? fusableAmount * fusionRatio : totalQuantity;
      const maxInputForDisplay = totalQuantity > 0 ? Math.min(maxInputQuantity, totalQuantity) : 1;
      
      quantityInput.value = maxInputForDisplay.toString();
      
      updateFuseButtonText(customFuseButton, maxInputForDisplay);
      
      addEventListenersToInput(quantityInput, customFuseButton, itemKey, totalQuantity, index, itemSlot);
      
      processedCount++;
    });
    
    if (processedCount > 0) {
      console.log(`[Better Hy\'genie] Section processing completed successfully`);
      section.dataset.betterHygenieSectionProcessed = 'true';
    } else {
      console.log(`[Better Hy\'genie] Section processing completed but no items were processed`);
      delete section.dataset.betterHygenieSectionProcessed;
    }
  }
  
  function addEventListenersToInput(quantityInput, fuseButton, itemKey, availableQuantity, index, itemSlot) {
    // Store the available quantity to avoid repeated inventory calls
    let currentQuantity = availableQuantity;
    
    quantityInput.addEventListener('input', function() {
      const value = this.value.trim();
      let quantity;
      
      if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        if (quantity > currentQuantity) {
          quantity = currentQuantity;
        }
      }
      
      updateFuseButtonText(fuseButton, quantity);
    });
    
    fuseButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      if (fuseButton.disabled) {
        return;
      }
      
      const value = quantityInput.value.trim();
      let quantity;
      
      if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        if (quantity > currentQuantity) {
          quantity = currentQuantity;
        }
      }
      
      if (currentQuantity < quantity) {
        handleError(new Error(`Insufficient items for fusion. Requested: ${quantity}, Available: ${currentQuantity}`), { requested: quantity, available: currentQuantity });
        removeConfirmationPrompt();
        showTooltipMessage(`Not enough items! You only have ${currentQuantity} items available.`);
        return;
      }
      
      const fusionRatio = getFusionRatio(itemKey);
      if (quantity < fusionRatio) {
        removeConfirmationPrompt();
        showTooltipMessage(`You need at least ${fusionRatio} items to perform a fusion.`);
        return;
      }
      
      if (fuseButton.dataset.confirm !== 'pending') {
        showConfirmationPrompt(quantity, itemKey, fuseButton);
        return;
      } else {
        removeConfirmationPrompt();
        delete fuseButton.dataset.confirm;
      }
      
      const originalText = fuseButton.innerHTML;
      fuseButton.innerHTML = 'Fusing...';
      removeConfirmationPrompt();
      fuseButton.disabled = true;
      
      try {
        await performFusion(itemKey, quantity);
        removeConfirmationPrompt();
        showTooltipMessage(`Successfully fused ${quantity} items!`, '#32cd32', 1500);
      } catch (error) {
        handleError(error, `${itemKey} fusion failed`);
        
        let errorMessage = 'Fusion failed. Please try again.';
        if (error.message.includes('Not enough items')) {
          errorMessage = error.message;
        } else if (error.message.includes('HTTP error! Status: 403')) {
          errorMessage = 'Not enough items in inventory for this fusion.';
        }
        
        fuseButton.innerHTML = 'Error!';
        removeConfirmationPrompt();
        showTooltipMessage(errorMessage);
        setTimeout(() => {
          fuseButton.innerHTML = originalText;
          fuseButton.disabled = false;
        }, CONSTANTS.ERROR_DISPLAY_DURATION);
        return;
      } finally {
        fuseButton.innerHTML = originalText;
        fuseButton.disabled = false;
      }
    });
    
    // Store reference to update quantity after fusion
    fuseButton._updateQuantity = (newQuantity) => {
      currentQuantity = newQuantity;
    };
  }
  
// =======================
// 4. Core UI Functions
// =======================
  
  function enhanceHygenieModal() {
    console.log('[Better Hy\'genie] enhanceHygenieModal called');
    const inventory = getInventoryState();
    console.log('[Better Hy\'genie] Inventory state:', inventory);
    if (!inventory) {
      console.log('[Better Hy\'genie] No inventory state available, returning false');
      return false;
    }
    
    let hygenieTitle = null;
    let modal = null;
    
         hygenieTitle = document.querySelector('h2 p');
     // Check for both English and Portuguese variants
     if (hygenieTitle && (hygenieTitle.textContent.includes('Hy\'genie') || hygenieTitle.textContent.includes('Hi\'giênio'))) {
       hygenieTitle.textContent = "Better Hy'genie activated!";
       hygenieTitle.style.color = '#32cd32';
       const widgetBottom = hygenieTitle.closest('.widget-bottom');
       // Check for both English and Portuguese section text
       if (widgetBottom && (widgetBottom.textContent.includes('Summon Scrolls') || widgetBottom.textContent.includes('Pergaminhos de Invocação'))) {
         modal = widgetBottom;
       }
     }
    
         if (!modal) {
       const widgetBottoms = document.querySelectorAll('.widget-bottom');
       for (const widget of widgetBottoms) {
         const text = widget.textContent || '';
         // Check for both English and Portuguese variants
         if ((text.includes('Hy\'genie') || text.includes('Hi\'giênio')) && 
             (text.includes('Summon Scrolls') || text.includes('Pergaminhos de Invocação')) && 
             (text.includes('Dice Manipulators') || text.includes('Dados Manipuladores'))) {
           modal = widget;
           break;
         }
       }
     }
    
         if (!modal) {
       const hygenieElements = document.querySelectorAll('*');
       for (const element of hygenieElements) {
         // Check for both English and Portuguese variants
         if (element.textContent && (element.textContent.includes('Hy\'genie') || element.textContent.includes('Hi\'giênio'))) {
           const widgetBottom = element.closest('.widget-bottom');
           if (widgetBottom && 
               (widgetBottom.textContent.includes('Summon Scrolls') || widgetBottom.textContent.includes('Pergaminhos de Invocação')) && 
               (widgetBottom.textContent.includes('Dice Manipulators') || widgetBottom.textContent.includes('Dados Manipuladores'))) {
             modal = widgetBottom;
             break;
           }
         }
       }
     }
    
    if (!modal) {
      console.log('[Better Hy\'genie] No modal found, returning false');
      return false;
    }
    
    console.log('[Better Hy\'genie] Found modal:', modal);
    
    if (modal.dataset.betterHygenieEnhanced) {
      console.log('[Better Hy\'genie] Modal already enhanced, returning true');
      return true;
    }
    
    if (modal.dataset.betterHygenieProcessing) {
      console.log('[Better Hy\'genie] Modal already processing, returning false');
      return false;
    }
    
    modal.dataset.betterHygenieProcessing = 'true';
    console.log('[Better Hy\'genie] Starting modal processing');
    
    const sections = modal.querySelectorAll('.w-full');
    console.log('[Better Hy\'genie] Found sections:', sections.length);
    
    let sectionsProcessed = 0;
    
    sections.forEach((sectionContainer, index) => {
      console.log(`[Better Hy\'genie] Processing section ${index}:`, sectionContainer);
      const sectionHeader = sectionContainer.querySelector('.widget-top');
      if (!sectionHeader) {
        console.log(`[Better Hy\'genie] Section ${index} - No header found, skipping`);
        return;
      }
      
      const sectionText = sectionHeader.textContent || '';
      console.log(`[Better Hy\'genie] Section ${index} - Text:`, sectionText);
      
      // Check for both English and Portuguese variants
      if (sectionText.includes('Summon Scrolls') || sectionText.includes('Dice Manipulators') ||
          sectionText.includes('Pergaminhos de Invocação') || sectionText.includes('Dados Manipuladores')) {
        console.log(`[Better Hy\'genie] Section ${index} - Matches target sections, processing`);
        const sectionContent = sectionContainer.querySelector('.widget-bottom');
        
        if (sectionContent) {
          console.log(`[Better Hy\'genie] Section ${index} - Found content, adding inputs`);
          addQuantityInputsToSection(sectionContent);
          sectionsProcessed++;
        } else {
          console.log(`[Better Hy\'genie] Section ${index} - No content found`);
        }
      } else {
        console.log(`[Better Hy\'genie] Section ${index} - Does not match target sections, skipping`);
      }
    });
    
    modal.dataset.betterHygenieEnhanced = 'true';
    console.log(`[Better Hy\'genie] Modal enhancement completed. Sections processed: ${sectionsProcessed}`);
    
    delete modal.dataset.betterHygenieProcessing;
    
    return true;
  }
  
// =======================
// 5. Main Logic
// =======================
  
  let observer = null;
  let observerTimeout = null;
  let lastProcessTime = 0;
  const MIN_PROCESS_INTERVAL = 500; // Minimum 500ms between processing attempts
  
     function transformHygenieTooltip() {
     try {
       const tooltip = document.querySelector('.tooltip-prose');
       if (!tooltip) return;
       const titleElem = tooltip.querySelector('p');
       // Check for both English and Portuguese variants
       if (titleElem && (titleElem.textContent.includes("Hy'genie") || titleElem.textContent.includes("Hi'giênio")) && titleElem.textContent !== "Better Hy'genie activated!") {
         titleElem.textContent = "Better Hy'genie activated!";
         titleElem.style.color = '#32cd32';
       }
     } catch (e) { /* silent */ }
   }

  function debouncedProcessMutations(mutations) {
    // Early exit if no mutations or already processing
    if (!mutations || mutations.length === 0) return;
    
    // Check if we already have an enhanced modal - if so, skip processing
    const existingModal = document.querySelector(`${SELECTORS.HYGENIE_MODAL}[data-better-hygenie-enhanced]`);
    if (existingModal) {
      return;
    }
    
    // Quick filter for potentially relevant mutations before debouncing
    const hasRelevantMutation = mutations.some(mutation => {
      if (mutation.type !== 'childList') return false;
      
      return Array.from(mutation.addedNodes).some(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        
        // Quick text content check
        const textContent = node.textContent || '';
        if (textContent.includes('Hy\'genie') || textContent.includes('Hi\'giênio')) {
          return true;
        }
        
        // Check child elements only if node has children
        if (node.querySelector) {
          return Array.from(node.querySelectorAll('*')).some(el => {
            const elText = el.textContent || '';
            return elText.includes('Hy\'genie') || elText.includes('Hi\'giênio');
          });
        }
        
        return false;
      });
    });
    
    if (!hasRelevantMutation) {
      return;
    }
    
    // Clear existing timeout
    if (observerTimeout) {
      clearTimeout(observerTimeout);
    }
    
    // Set new timeout with longer delay for better performance
    observerTimeout = setTimeout(() => {
      // Throttle processing to prevent excessive calls
      const now = Date.now();
      if (now - lastProcessTime < MIN_PROCESS_INTERVAL) {
        return;
      }
      lastProcessTime = now;
      
      // Double-check that no modal was enhanced during the delay
      const currentModal = document.querySelector(`${SELECTORS.HYGENIE_MODAL}[data-better-hygenie-enhanced]`);
      if (currentModal) {
        return;
      }
      
      console.log('[Better Hy\'genie] Processing mutations after debounce delay');
      transformHygenieTooltip();
      
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
          break;
        }
      }
    }, CONSTANTS.DEBOUNCE_DELAY); // Reduced delay for faster input box creation
  }
  
  function retryEnhanceHygenieModal(maxAttempts = CONSTANTS.RETRY_MAX_ATTEMPTS, baseDelay = CONSTANTS.RETRY_BASE_DELAY) {
    let attempts = 0;
    
    const tryEnhance = () => {
      attempts++;
      
      const inventory = getInventoryState();
      if (!inventory) {
        if (attempts < maxAttempts) {
          const delay = baseDelay * Math.pow(2, attempts - 1);
          setTimeout(tryEnhance, delay);
        }
        return;
      }
      
      if (enhanceHygenieModal()) {
        return;
      }
      
      if (attempts < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempts - 1);
        setTimeout(tryEnhance, delay);
      }
    };
    
    tryEnhance();
  }
  
  function initializeBetterHygenie() {
    injectStyles();
    
    observer = new MutationObserver(debouncedProcessMutations);
    
    // More selective observation - only watch for child additions in main content areas
    observer.observe(document.body, {
      childList: true,
      subtree: false  // Only direct children of body, not deep subtree
    });
    
    // Also observe the main game container if it exists
    const gameContainer = document.querySelector('#__next') || document.querySelector('.game-container');
    if (gameContainer) {
      observer.observe(gameContainer, {
        childList: true,
        subtree: true
      });
    }
    
    transformHygenieTooltip();
  }
  
  function cleanup() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    const styleElement = document.getElementById('better-hygenie-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    document.querySelectorAll('[data-better-hygenie-enhanced]').forEach(element => {
      delete element.dataset.betterHygenieEnhanced;
    });
    
    document.querySelectorAll('[data-better-hygenie-section-processed]').forEach(element => {
      delete element.dataset.betterHygenieSectionProcessed;
    });
    
    document.querySelectorAll('[data-better-hygenie-processing]').forEach(element => {
      delete element.dataset.betterHygenieProcessing;
    });
    
    document.querySelectorAll('.better-hygenie-quantity-input, .better-hygenie-fuse-button').forEach(element => {
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
      newElement.remove();
    });
    
    document.querySelectorAll('button[style*="display: none"]').forEach(button => {
      if (button.parentNode.querySelector('.better-hygenie-fuse-button')) {
        button.style.display = '';
      }
    });
  }
  
  initializeBetterHygenie();
  console.log('[Better Hy\'genie] DEBUG: Initialization completed successfully!');
  
  if (typeof context !== 'undefined') {
    context.exports = {
      cleanup: cleanup
    };
  }
  
})();

// Expose cleanup function globally for the mod loader
window.cleanupSuperModsBetterHygeniejs = function() {
  console.log('[Better Hy\'genie] Running global cleanup...');
  
  // Call the internal cleanup function if available
  if (window.betterHygenie && window.betterHygenie.cleanup) {
    window.betterHygenie.cleanup();
  }
  
  // Additional global cleanup
  if (typeof window.betterHygenieState !== 'undefined') {
    delete window.betterHygenieState;
  }
  
  console.log('[Better Hy\'genie] Global cleanup completed');
}; 
