// =======================
// 0. Version & Metadata
// =======================
(function() {
  console.log('[Better Yasir] initializing...');
  
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
    ERROR_DISPLAY_DURATION: 2000,
    MAX_INPUT_WIDTH: 50
  };
  
  // DOM selectors cache
  const SELECTORS = {
    YASIR_MODAL: '.widget-bottom',
    SHOP_TABLE: 'table',
    SHOP_ROW: 'tbody tr',
    ITEM_SLOT: '.container-slot',
    BUY_BUTTON: 'button',
    SELL_BUTTON: 'button',
    SECTION_HEADER: '.widget-top',
    SECTION_CONTENT: '.widget-bottom',
    SECTIONS: '.w-full',
    DICE_MANIPULATOR_SPRITE: '.sprite.item',
    RARITY_ELEMENT: '[data-rarity]',
    EXALTATION_CHEST_IMG: 'img[src*="exaltation-chest"]',
    DUST_IMG: 'img[src*="dust-large"]',
    STONE_OF_INSIGHT_SPRITE: '.sprite.item'
  };
  
  // Outside click handler reference for confirmation reset
  let confirmationOutsideHandler = null;
  
  // CSS styles for the quantity input and action buttons
  const QUANTITY_INPUT_STYLES = `
    .better-yasir-quantity-input {
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
      position: relative;
    }
    
    .better-yasir-quantity-input::before {
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
    .better-yasir-quantity-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(106, 106, 106, 0.5);
    }
    .better-yasir-quantity-input::-webkit-inner-spin-button,
    .better-yasir-quantity-input::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .better-yasir-action-button {
      /* Only override specific behaviors, let original classes handle styling */
      transition: all 0.1s ease !important;
    }
    
    /* Confirmation highlight */
    .better-yasir-action-button.confirm {
      background-image:
        url('https://bestiaryarena.com/_next/static/media/1-frame-green.fe32d59c.png'),
        url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') !important;
    }

  `;
  
// =======================
// 2. Utility Functions
// =======================

  // Centralized error handling
  function handleError(error, context = '') {
    const prefix = '[Better Yasir]';
    const message = context ? `${prefix} ${context}:` : prefix;
    console.error(message, error);
  }

  // Safe game state access
  function getGameState() {
    try {
      const playerState = globalThis.state?.player?.getSnapshot()?.context;
      const dailyState = globalThis.state?.daily?.getSnapshot()?.context;
      const globalState = globalThis.state?.global?.getSnapshot()?.context;
      
      console.log('[Better Yasir] Player state:', playerState);
      console.log('[Better Yasir] Daily state:', dailyState);
      console.log('[Better Yasir] Global state:', globalState);
      
      return playerState;
    } catch (error) {
      handleError(error, 'Error accessing game state');
      return null;
    }
  }
  
  // Get Yasir's shop data from daily state
  function getYasirShopData() {
    console.log('[Better Yasir] getYasirShopData called');
    try {
      console.log('[Better Yasir] Accessing globalThis.state:', !!globalThis.state);
      console.log('[Better Yasir] Accessing daily state:', !!globalThis.state?.daily);
      
      const dailyContext = globalThis.state?.daily?.getSnapshot()?.context;
      const yasirData = dailyContext?.yasir || {};
      
      // Log the complete Yasir API data
      console.log('[Better Yasir] ===== COMPLETE YASIR DAILY API DATA =====');
      console.log('[Better Yasir] Yasir shop data:', JSON.stringify(yasirData, null, 2));
      console.log('[Better Yasir] Full daily context:', JSON.stringify(dailyContext, null, 2));
      console.log('[Better Yasir] Full state structure:', Object.keys(globalThis.state || {}));
      
      // Also log the raw state objects for debugging
      console.log('[Better Yasir] Raw daily state:', globalThis.state?.daily?.getSnapshot());
      console.log('[Better Yasir] Raw global state:', globalThis.state?.global?.getSnapshot());
      console.log('[Better Yasir] Raw player state:', globalThis.state?.player?.getSnapshot());
      console.log('[Better Yasir] ===== END YASIR API DATA =====');
      
      return yasirData;
    } catch (error) {
      handleError(error, 'Error accessing Yasir shop data');
      return {};
    }
  }
  
  // Get inventory specifically
  function getInventoryState() {
    try {
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const inventory = playerContext?.inventory || {};
      
      // Debug: Log inventory to see what items are available
      console.log('[Better Yasir] Player inventory:', inventory);
      console.log('[Better Yasir] Looking for insightStone1:', inventory.insightStone1);
      
      return inventory;
    } catch (error) {
      handleError(error, 'Error accessing inventory state');
      return {};
    }
  }

  // Get player's dust amount
  function getPlayerDust() {
    try {
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      return playerContext?.dust || 0;
    } catch (error) {
      handleError(error, 'Error accessing player dust');
      return 0;
    }
  }
  
  // Update local inventory based on API response (write into playerContext.inventory)
  function updateLocalInventory(inventoryDiff) {
    try {
      const player = globalThis.state?.player;
      if (!player) {
        console.warn('[Better Yasir] Player state not available for inventory update');
        return;
      }
      
      console.log('[Better Yasir] Updating local inventory with diff:', inventoryDiff);
      
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
          
          // Update dust if it's in the diff
          if (inventoryDiff.dust !== undefined) {
            newState.dust = Math.max(0, (newState.dust || 0) + inventoryDiff.dust);
          }
          
          return newState;
        }
      });
      console.log('[Better Yasir] Local inventory updated successfully');
    } catch (error) {
      handleError(error, 'Failed to update local inventory');
    }
  }
  
  // Inject CSS styles
  function injectStyles() {
    if (!document.getElementById('better-yasir-styles')) {
      const style = document.createElement('style');
      style.id = 'better-yasir-styles';
      style.textContent = QUANTITY_INPUT_STYLES;
      document.head.appendChild(style);
    }
  }
  
  // Get the quantity from an item slot using game state only
  function getItemQuantity(itemSlot) {
    // Check if itemSlot is null or undefined
    if (!itemSlot) {
      console.log('[Better Yasir] getItemQuantity called with null/undefined itemSlot');
      return 0;
    }
    
    const inventory = getInventoryState();
    
    const itemKey = getItemKeyFromSlot(itemSlot);
    if (!itemKey) {
      return 0;
    }
    
    return inventory[itemKey] || 0;
  }
  
  // Determine item key from the slot
  function getItemKeyFromSlot(itemSlot) {
    try {
      // Check if itemSlot is null or undefined
      if (!itemSlot) {
        console.log('[Better Yasir] getItemKeyFromSlot called with null/undefined itemSlot');
        return null;
      }
      
      // Fast path – return cached value if we already resolved this slot
      if (itemSlot.dataset.itemKey) {
        return itemSlot.dataset.itemKey;
      }

      // Cache commonly used elements
      const diceManipulatorSprite = itemSlot.querySelector(SELECTORS.DICE_MANIPULATOR_SPRITE);
      const rarityElement = itemSlot.querySelector(SELECTORS.RARITY_ELEMENT);
      const exaltationChestImg = itemSlot.querySelector(SELECTORS.EXALTATION_CHEST_IMG);
      const dustImg = itemSlot.querySelector(SELECTORS.DUST_IMG);
      const spriteItem = itemSlot.querySelector(SELECTORS.STONE_OF_INSIGHT_SPRITE);

      let detectedKey = null;

      // Check for Exaltation Chest
      if (exaltationChestImg) {
        detectedKey = 'exaltationChest';
      }
      
      // Check for Dust (exchange section)
      else if (dustImg) {
        detectedKey = 'dust';
      }
      
      // Check for any sprite item (dynamic detection)
      else if (spriteItem) {
        // Try to get the sprite ID from the class name (e.g., "sprite item relative id-21383")
        const classMatch = spriteItem.className.match(/id-(\d+)/);
        let spriteId = classMatch ? classMatch[1] : null;
        
        console.log(`[Better Yasir] Sprite class: ${spriteItem.className}, extracted ID: ${spriteId}`);
        
        if (spriteId) {
          // Use the same mapping as Cyclopedia.js
          const spriteMapping = {
            '35909': 'diceManipulator', // Will be combined with rarity
            '21383': 'insightStone', // Will be combined with tier
            '653': 'outfitBag1',
            '43672': 'monsterCauldron',
            '42363': 'hygenie'
          };
          
          const baseKey = spriteMapping[spriteId];
          if (baseKey) {
            if (baseKey === 'diceManipulator' && rarityElement) {
              // For dice manipulator, combine with rarity
              const rarity = rarityElement.getAttribute('data-rarity');
              detectedKey = `${baseKey}${rarity}`;
              console.log(`[Better Yasir] Detected dice manipulator with rarity: ${detectedKey}`);
            } else if (baseKey === 'insightStone' && rarityElement) {
              // For insight stone, combine with tier (rarity)
              const tier = rarityElement.getAttribute('data-rarity');
              detectedKey = `${baseKey}${tier}`;
              console.log(`[Better Yasir] Detected insight stone with tier: ${detectedKey}`);
            } else {
              // For other items, use the base key
              detectedKey = baseKey;
              console.log(`[Better Yasir] Detected sprite item: ${detectedKey}`);
            }
          } else {
            // Fallback for unknown sprite IDs
            detectedKey = `sprite_${spriteId}`;
            console.log(`[Better Yasir] Unknown sprite ID, using fallback: ${detectedKey}`);
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
  
  // Get item price from the shop row
  function getItemPrice(shopRow) {
    try {
      const priceButton = shopRow.querySelector('button');
      if (priceButton) {
        const priceText = priceButton.textContent.trim();
        const priceMatch = priceText.match(/(\d+)/);
        if (priceMatch) {
          return parseInt(priceMatch[1]);
        }
      }
      return 0;
    } catch (error) {
      handleError(error, 'Error getting item price');
      return 0;
    }
  }

  // Get item price from the original button in the next cell
  function getItemPriceFromNextCell(container) {
    try {
      const currentCell = container.closest('td');
      if (currentCell) {
        const nextCell = currentCell.nextElementSibling;
        if (nextCell) {
          const originalButton = nextCell.querySelector('button');
          if (originalButton) {
            const priceText = originalButton.textContent.trim();
            console.log('[Better Yasir] Original button text:', priceText);
            
            // Check if button shows "Out of stock" or is disabled
            if (priceText === '' || priceText.includes('Out of stock') || originalButton.disabled) {
              console.log('[Better Yasir] Item is out of stock or disabled');
              return 0;
            }
            
            const priceMatch = priceText.match(/(\d+)/);
            if (priceMatch) {
              const price = parseInt(priceMatch[1]);
              console.log('[Better Yasir] Extracted price:', price);
              return price;
            }
          }
        }
      }
      console.log('[Better Yasir] No price found, returning 0');
      return 0;
    } catch (error) {
      handleError(error, 'Error getting item price from next cell');
      return 0;
    }
  }
  
  // Check if item is out of stock
  function isItemOutOfStock(shopRow) {
    try {
      const outOfStockText = shopRow.textContent.includes('Out of stock');
      return outOfStockText;
    } catch (error) {
      handleError(error, 'Error checking if item is out of stock');
      return false;
    }
  }
  
  // Create custom action button
  function createCustomActionButton(actionType) {
    const button = document.createElement('button');
    // Use the same classes as the original buttons for consistent sizing and styling
    button.className = 'focus-style-visible flex items-center justify-center tracking-wide disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-16 [_svg]:size-[11px] [_svg]:mb-[2px] [_svg]:mt-[3px] w-full text-whiteHighlight better-yasir-action-button';
    // Don't set text content here - it will be set by updateActionButtonText
    return button;
  }

  // Create quantity input element
  function createQuantityInput(maxQuantity, defaultValue = 1) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'better-yasir-quantity-input';
    input.placeholder = '1';
    input.value = defaultValue.toString();
    
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
  
  // Update action button text based on quantity and price
  function updateActionButtonText(button, quantity, actionType, itemPrice = 0) {
    let actionText;
    
    // Create the button content similar to original buttons
    if (actionType === 'buy') {
      // For buy buttons, we'll show the total price (price per item * quantity)
      const totalPrice = itemPrice * quantity;
      button.innerHTML = `<img alt="gold" src="/assets/icons/dust.png" class="pixelated" width="11" height="12">${totalPrice}`;
    } else if (actionType === 'sell') {
      // For sell buttons (exchange section), show dust icon and quantity
      const dustAmount = itemPrice * quantity;
      button.innerHTML = `<img alt="dust" src="/assets/icons/dust.png" class="pixelated" width="11" height="12">${dustAmount}`;
    } else {
      // For other trade buttons, show dust icon and quantity
      const dustAmount = itemPrice * quantity;
      button.innerHTML = `<img alt="dust" src="/assets/icons/dust.png" class="pixelated" width="11" height="12">${dustAmount}`;
    }
  }
  
  // Show confirmation prompt inside Yasir tooltip
  function getItemDisplayName(itemKey) {
    if (itemKey === 'exaltationChest') {
      return 'Exaltation Chest';
    }
    if (itemKey === 'dust') {
      return 'Dust';
    }
    if (itemKey === 'stoneOfInsight') {
      return 'Stone of Insight';
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

  function showConfirmationPrompt(quantity, itemKey, actionButton, actionType) {
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
      document.querySelectorAll('.better-yasir-action-button.confirm').forEach(btn=>{
        btn.classList.remove('confirm');
        delete btn.dataset.confirm;
      });

      const itemName = getItemDisplayName(itemKey);
      const actionText = actionType === 'buy' ? 'buy' : 'trade for';
      msgElem.textContent = `Are you sure you want to ${actionText} ${quantity} ${itemName}?`;
      msgElem.style.color = '#ff4d4d';
      actionButton.dataset.confirm = 'pending';
      actionButton.classList.add('confirm');
      // Attach outside click handler to reset confirmation when clicking elsewhere
      if (!confirmationOutsideHandler) {
        confirmationOutsideHandler = (ev) => {
          if (!ev.target.closest('.better-yasir-action-button.confirm')) {
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
      // Remove pending confirmation from all action buttons
      document.querySelectorAll('.better-yasir-action-button').forEach(b=>{
        b.classList.remove('confirm');
        delete b.dataset.confirm;
      });
      if (confirmationOutsideHandler) {
        document.removeEventListener('click', confirmationOutsideHandler, true);
        confirmationOutsideHandler = null;
      }
    } catch (e) {}
  }
  
  // Helper function to convert rarity number to name
  function getRarityName(rarity) {
    const rarityNames = {
      '1': 'Common',
      '2': 'Uncommon', 
      '3': 'Rare',
      '4': 'Mythic',
      '5': 'Legendary'
    };
    return rarityNames[rarity] || 'Unknown';
  }
  
  // Create a proper Stone of Insight sprite with complete container structure
  function createStoneOfInsightSprite(quantity = 1) {
    console.log(`[Better Yasir] ===== STARTING VIEWPORT CREATION =====`);
    console.log(`[Better Yasir] Input quantity: ${quantity}`);
    
    // Create the main container slot with proper attributes
    console.log(`[Better Yasir] Step 1: Creating main container slot`);
    const containerSlot = document.createElement('div');
    containerSlot.className = 'container-slot surface-darker data-[disabled=\'true\']:dithered data-[highlighted=\'true\']:unset-border-image data-[hoverable=\'true\']:hover:unset-border-image';
    containerSlot.setAttribute('data-hoverable', 'false');
    containerSlot.setAttribute('data-highlighted', 'false');
    containerSlot.setAttribute('data-disabled', 'false');
    console.log(`[Better Yasir] Container slot created with classes: "${containerSlot.className}"`);
    console.log(`[Better Yasir] Container slot attributes:`, {
      'data-hoverable': containerSlot.getAttribute('data-hoverable'),
      'data-highlighted': containerSlot.getAttribute('data-highlighted'),
      'data-disabled': containerSlot.getAttribute('data-disabled')
    });
    
    // Create the has-rarity container
    console.log(`[Better Yasir] Step 2: Creating has-rarity container`);
    const hasRarityContainer = document.createElement('div');
    hasRarityContainer.className = 'has-rarity relative grid h-full place-items-center';
    hasRarityContainer.setAttribute('data-rarity', '5');
    console.log(`[Better Yasir] Has-rarity container created with classes: "${hasRarityContainer.className}"`);
    console.log(`[Better Yasir] Has-rarity container data-rarity: "${hasRarityContainer.getAttribute('data-rarity')}"`);
    
    // Create the sprite container with proper positioning
    console.log(`[Better Yasir] Step 3: Creating sprite container`);
    const spriteContainer = document.createElement('div');
    spriteContainer.className = 'sprite item relative id-21383';
    console.log(`[Better Yasir] Sprite container created with classes: "${spriteContainer.className}"`);
    
    // Create the viewport
    console.log(`[Better Yasir] Step 4: Creating viewport`);
    const viewport = document.createElement('div');
    viewport.className = 'viewport';
    console.log(`[Better Yasir] Viewport created with class: "${viewport.className}"`);
    
    // Create the spritesheet image
    console.log(`[Better Yasir] Step 5: Creating spritesheet image`);
    const img = document.createElement('img');
    img.alt = 'Stone of Insight';
    img.setAttribute('data-cropped', 'false');
    img.className = 'spritesheet';
    img.src = 'https://bestiaryarena.com/assets/ITEM/21383.png'; // Add the spritesheet source
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
    console.log(`[Better Yasir] Spritesheet image created with:`, {
      alt: img.alt,
      'data-cropped': img.getAttribute('data-cropped'),
      className: img.className,
      src: img.src,
      '--cropX': img.style.getPropertyValue('--cropX'),
      '--cropY': img.style.getPropertyValue('--cropY')
    });
    
    // Create the quantity indicator
    console.log(`[Better Yasir] Step 6: Creating quantity indicator`);
    const quantityIndicator = document.createElement('div');
    quantityIndicator.className = 'revert-pixel-font-spacing pointer-events-none absolute bottom-[3px] right-px flex h-2.5';
    console.log(`[Better Yasir] Quantity indicator created with classes: "${quantityIndicator.className}"`);
    
    const quantitySpan = document.createElement('span');
    quantitySpan.className = 'relative font-outlined-fill text-white';
    quantitySpan.style.cssText = 'line-height: 1; font-size: 12px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: 1px 1px 0px #000, -1px -1px 0px #000, 1px -1px 0px #000, -1px 1px 0px #000;';
    quantitySpan.setAttribute('translate', 'no');
    quantitySpan.textContent = `${quantity}x`;
    console.log(`[Better Yasir] Quantity span created with:`, {
      className: quantitySpan.className,
      style: quantitySpan.style.cssText,
      translate: quantitySpan.getAttribute('translate'),
      textContent: quantitySpan.textContent
    });
    
    // Assemble the structure
    console.log(`[Better Yasir] Step 7: Assembling DOM structure`);
    console.log(`[Better Yasir] Quantity span is ready (no canvas needed)`);
    console.log(`[Better Yasir] Appending quantitySpan to quantityIndicator`);
    quantityIndicator.appendChild(quantitySpan);
    console.log(`[Better Yasir] Appending img to viewport`);
    viewport.appendChild(img);
    console.log(`[Better Yasir] Appending viewport to spriteContainer`);
    spriteContainer.appendChild(viewport);
    console.log(`[Better Yasir] Appending spriteContainer to hasRarityContainer`);
    hasRarityContainer.appendChild(spriteContainer);
    console.log(`[Better Yasir] Appending quantityIndicator to hasRarityContainer`);
    hasRarityContainer.appendChild(quantityIndicator);
    console.log(`[Better Yasir] Appending hasRarityContainer to containerSlot`);
    containerSlot.appendChild(hasRarityContainer);
    
    // Final verification
    console.log(`[Better Yasir] Step 8: Final structure verification`);
    console.log(`[Better Yasir] Final container slot HTML:`, containerSlot.outerHTML);
    console.log(`[Better Yasir] Container slot children count:`, containerSlot.children.length);
    console.log(`[Better Yasir] Has-rarity container children count:`, hasRarityContainer.children.length);
    console.log(`[Better Yasir] Sprite container children count:`, spriteContainer.children.length);
    console.log(`[Better Yasir] Viewport children count:`, viewport.children.length);
    console.log(`[Better Yasir] Quantity indicator children count:`, quantityIndicator.children.length);
    
    // Check for specific elements
    const finalViewport = containerSlot.querySelector('.viewport');
    const finalSprite = containerSlot.querySelector('.sprite.item.id-21383');
    const finalQuantity = containerSlot.querySelector('.revert-pixel-font-spacing');
    const finalImg = containerSlot.querySelector('img.spritesheet');
    
    console.log(`[Better Yasir] Final element verification:`, {
      viewportFound: !!finalViewport,
      spriteFound: !!finalSprite,
      quantityFound: !!finalQuantity,
      imgFound: !!finalImg,
      imgAlt: finalImg?.alt,
      imgDataCropped: finalImg?.getAttribute('data-cropped'),
      imgCropX: finalImg?.style.getPropertyValue('--cropX'),
      imgCropY: finalImg?.style.getPropertyValue('--cropY')
    });
    
    console.log(`[Better Yasir] ===== VIEWPORT CREATION COMPLETE =====`);
    
    return containerSlot;
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
  
  // Refresh UI after action to show updated inventory counts
  function refreshUIAfterAction() {
    try {
      const modal = document.querySelector(`${SELECTORS.YASIR_MODAL}[data-better-yasir-enhanced]`);
      if (!modal) return;
      
      // Force a fresh read of the game state (no caching)
      const playerContext = globalThis.state?.player?.getSnapshot()?.context;
      const inventory = playerContext?.inventory || {};
      const playerDust = playerContext?.dust || 0;
      
      console.log('[Better Yasir] Refreshing UI with fresh inventory:', inventory);
      console.log('[Better Yasir] Player dust:', playerDust);
      
      if (!inventory) {
        console.warn('[Better Yasir] No inventory state available for UI refresh');
        return;
      }
      
      // Find all quantity inputs and update their max values
      const quantityInputs = modal.querySelectorAll('.better-yasir-quantity-input');
      quantityInputs.forEach(input => {
        const container = input.closest('div.flex.items-center.gap-1\\.5');
        if (!container) return;
        
        const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
        if (!itemSlot) return;
        
        const itemKey = getItemKeyFromSlot(itemSlot);
        const currentQuantity = inventory[itemKey] || 0;
        
        console.log(`[Better Yasir] Refreshing UI for ${itemKey}: ${currentQuantity} items`);
        
        // Update max value and current value based on action type
        const actionButton = container.parentNode.querySelector('.better-yasir-action-button');
        if (actionButton) {
          const isBuyAction = actionButton.textContent.includes('Buy') || actionButton.textContent.includes('dust');
          
          if (isBuyAction) {
            // For buy actions, recalculate max based on available dust
            const itemPrice = getItemPriceFromNextCell(container);
            const maxQuantity = itemPrice > 0 ? Math.floor(playerDust / itemPrice) : 0;
            input.max = maxQuantity;
            input.value = Math.min(parseInt(input.value) || 1, Math.max(1, maxQuantity));
          } else {
            // For sell actions, use available quantity
            input.max = currentQuantity;
            input.value = Math.min(parseInt(input.value) || 1, Math.max(1, currentQuantity));
          }
          
          // Update button text
          updateActionButtonText(actionButton, parseInt(input.value) || 1, isBuyAction ? 'buy' : 'sell', itemPrice);
        }
      });
      
      console.log('[Better Yasir] UI refreshed after action');
    } catch (error) {
      handleError(error, 'Error refreshing UI after action');
    }
  }
  
  // Perform the actual purchase/trade via API call
  async function performAction(itemKey, quantity, actionType) {
    try {
      if (!itemKey || quantity <= 0) {
        handleError(new Error('Invalid action parameters'), { itemKey, quantity, actionType });
        return;
      }
      
      // Re-validate current inventory before proceeding
      const gameState = getGameState();
      if (gameState && gameState.inventory) {
        const currentQuantity = gameState.inventory[itemKey] || 0;
        if (actionType === 'sell' && currentQuantity < quantity) {
          handleError(new Error('Insufficient items for trade'), { requested: quantity, available: currentQuantity });
          return;
        }
      }
      
      // Re-validate player dust for buy actions
      if (actionType === 'buy') {
        const playerDust = getPlayerDust();
        const itemPrice = getItemPriceFromNextCell(document.querySelector(`[data-item-key="${itemKey}"]`));
        const totalCost = itemPrice * quantity;
        
        if (playerDust < totalCost) {
          handleError(new Error('Insufficient dust for purchase'), { requested: totalCost, available: playerDust });
          return;
        }
      }
      
      // Determine the endpoint and payload based on action type and item
      let endpoint = '';
      let payload = {};
      
      if (actionType === 'buy') {
        // Based on HAR analysis, the buy API endpoint is:
        endpoint = '/api/trpc/store.yasirDailyStock?batch=1';
        
        // Try to include quantity in the payload like Better_Hygenie.js does
        // The original HAR showed "json": null, but let's try including quantity
        payload = {
          "0": {
            "json": {
              "itemKey": itemKey,
              "quantity": quantity
            }
          }
        };
        
        console.log(`[Better Yasir] Buy API call for ${quantity} ${itemKey}:`, { endpoint, payload });
        
      } else if (actionType === 'sell') {
        // Test: Try using the same API endpoint as buying to see if it works
        endpoint = '/api/trpc/store.yasirDailyStock?batch=1';
        payload = {
          "0": {
            "json": {
              "itemKey": itemKey,
              "quantity": quantity
            }
          }
        };
        console.log(`[Better Yasir] Testing sell API with same endpoint for ${quantity} ${itemKey}:`, { endpoint, payload });
      }
      
      // Make the actual API call
      console.log(`[Better Yasir] Making API call to ${endpoint}`);
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
      
      // Handle API response
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Better Yasir] Server response:`, errorText);
        
        // Handle specific error cases
        if (response.status === 403) {
          try {
            const errorData = JSON.parse(errorText);
            if (errorData[0]?.error?.json?.message) {
              throw new Error(errorData[0].error.json.message);
            }
          } catch (parseError) {
            // If we can't parse the error, use the generic message
          }
        }
        
        // Log the full error for debugging
        console.error(`[Better Yasir] Full error response:`, {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText
        });
        
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[Better Yasir] ${actionType} successful:`, result);
      
      // Update local inventory based on API response
      if (result && Array.isArray(result) && result[0]?.result?.data?.json) {
        const responseData = result[0].result.data.json;
        
        // Create inventory diff from the response
        const inventoryDiff = {};
        
        // Handle inventory changes
        if (responseData.inventoryDiff) {
          Object.assign(inventoryDiff, responseData.inventoryDiff);
        }
        
        // Handle dust changes
        if (responseData.dustDiff !== undefined) {
          inventoryDiff.dust = responseData.dustDiff;
        }
        
        if (Object.keys(inventoryDiff).length > 0) {
          updateLocalInventory(inventoryDiff);
          
          // Refresh UI to show updated counts (with longer delay to ensure state updates)
          setTimeout(() => {
            refreshUIAfterAction();
          }, 300);
        }
      }
      
      // Show success message
      removeConfirmationPrompt();
      const actionText = actionType === 'buy' ? 'purchased' : 'traded for';
      showTooltipMessage(`Successfully ${actionText} ${quantity} ${getItemDisplayName(itemKey)}!`, '#32cd32', 1500);
      
    } catch (error) {
      handleError(error, `${actionType} action failed`);
      
      // Show user-friendly error message
      let errorMessage = `${actionType} failed. Please try again.`;
      if (error.message.includes('Insufficient')) {
        errorMessage = error.message;
      } else if (error.message.includes('HTTP error! Status: 403')) {
        errorMessage = 'Not enough resources for this action.';
      }
      
      // Show error state briefly
      showTooltipMessage(errorMessage);
      throw error; // Re-throw to be handled by the calling function
    }
  }
  
// =======================
// 3. UI Component Creation
// =======================
  
  // Add quantity inputs to shop rows
  function addQuantityInputsToShopRows(shopTable) {
    // Check if this table has already been processed
    if (shopTable.dataset.betterYasirTableProcessed) {
      return;
    }
    
    // Mark table as being processed to prevent duplicates
    shopTable.dataset.betterYasirTableProcessed = 'processing';
    
    // Find all shop rows
    const shopRows = shopTable.querySelectorAll(SELECTORS.SHOP_ROW);
    
    let processedCount = 0;
    
    shopRows.forEach((shopRow, index) => {
      const itemSlot = shopRow.querySelector(SELECTORS.ITEM_SLOT);
      const originalButton = shopRow.querySelector(SELECTORS.BUY_BUTTON);
      
      if (!itemSlot || !originalButton) {
        return;
      }
      
      // Check if we've already added our custom UI to this row
      if (shopRow.querySelector('.better-yasir-quantity-input')) {
        return;
      }
      
      const itemKey = getItemKeyFromSlot(itemSlot);
      if (!itemKey) {
        return;
      }
      
      // Check if item is out of stock
      if (isItemOutOfStock(shopRow)) {
        return;
      }
      
      // Determine action type based on table context
      const tableHeader = shopTable.querySelector('thead th');
      const isExchangeTable = tableHeader && tableHeader.textContent.includes('Exchange');
      const actionType = isExchangeTable ? 'trade' : 'buy';
      
      // Get item price and available quantity
      const itemPrice = getItemPrice(shopRow);
      const availableQuantity = getItemQuantity(itemSlot);
      
      // For buying, use a reasonable default max quantity
      // For trading, use the available quantity
      const maxQuantity = actionType === 'buy' ? Math.min(100, Math.floor(10000 / itemPrice)) : availableQuantity;
      
      // Create quantity input
      const quantityInput = createQuantityInput(maxQuantity);
      
      // Create our custom action button
      const customActionButton = createCustomActionButton(actionType);
      
      // Insert our custom UI before the original button
      originalButton.parentNode.insertBefore(quantityInput, originalButton);
      originalButton.parentNode.insertBefore(customActionButton, originalButton);
      
      // Hide the original button now that we have our custom UI
      originalButton.style.display = 'none';
      
      // Set initial value
      const initialQuantity = Math.min(1, maxQuantity);
      quantityInput.value = initialQuantity.toString();
      
      // Update button text with price
      updateActionButtonText(customActionButton, initialQuantity, actionType, itemPrice);
      
      // Add event listeners
      addEventListenersToInput(quantityInput, customActionButton, itemKey, maxQuantity, index, itemSlot, actionType, itemPrice);
      
      processedCount++;
    });
    
    // Mark table as processed if we successfully processed any rows
    if (processedCount > 0) {
      shopTable.dataset.betterYasirTableProcessed = 'true';
    } else {
      // If no rows were processed, remove the processing marker
      delete shopTable.dataset.betterYasirTableProcessed;
    }
  }

  // Add quantity inputs to flex container divs (new function for the specific div structure)
  function addQuantityInputsToFlexContainers() {
    // Find all flex containers that match the pattern from the user's example
    const flexContainers = document.querySelectorAll('div.flex.items-center.gap-1\\.5.dithered.px-1, div.flex.items-center.gap-1\\.5');
    
    flexContainers.forEach((container, index) => {
      // Log Yasir API data on first container found (to ensure we get the data)
      if (index === 0) {
        getYasirShopData();
      }
      
      // Check if we've already added our custom UI to this container
      if (container.querySelector('.better-yasir-quantity-input')) {
        return;
      }
      
      // Check if this container is part of an exchange row that's already been processed
      const tableRow = container.closest('tr');
      if (tableRow && tableRow.dataset.betterYasirProcessed) {
        return;
      }
      
      // Skip if this is a wrapper container we created
      if (container.dataset.betterYasirWrapper) {
        return;
      }
      
      // Find the item slot within this container
      const itemSlot = container.querySelector(SELECTORS.ITEM_SLOT);
      if (!itemSlot) {
        return;
      }
      
      const itemKey = getItemKeyFromSlot(itemSlot);
      if (!itemKey) {
        return;
      }
      
      // Check if item is out of stock by looking for "Out of stock" text
      const containerText = container.textContent || '';
      if (containerText.includes('Out of stock')) {
        return;
      }
      
      // For exchange section, we need to find the actual item being exchanged (not the dust)
      // Look for the second container in the same row that contains the item being sold
      let targetContainer = container;
      let targetItemSlot = itemSlot; // Initialize targetItemSlot early
      
      // Check if this is in the exchange section by looking at the table header
      const tableHeader = tableRow?.closest('table')?.querySelector('thead th');
      const isExchangeSection = tableHeader?.textContent?.includes('Exchange') || false;
      
      console.log(`[Better Yasir] Table header text: "${tableHeader?.textContent}"`);
      console.log(`[Better Yasir] Is exchange section: ${isExchangeSection}`);
      
      if (isExchangeSection) {
        console.log(`[Better Yasir] Processing exchange section...`);
        
        // In exchange section, the items are in separate table cells
        // First cell contains dust (what you're giving), second cell contains the item (what you're getting)
        const tableCells = tableRow.querySelectorAll('td');
        console.log(`[Better Yasir] Exchange section: found ${tableCells.length} table cells`);
        
        if (tableCells.length >= 2) {
          const secondCell = tableCells[1];
          
          // Look for the Stone of Insight in the second cell
          let insightStoneSlot = secondCell.querySelector('.sprite.item.id-21383');
          
          if (insightStoneSlot) {
            console.log(`[Better Yasir] Found Stone of Insight in second cell`);
            
            // For exchange section, we want to add the input to the first cell (dust) and button to second cell
            // So we keep the original container (first cell) as targetContainer for the input
            // The button will be handled separately in the button placement logic
            
            // Set the targetItemSlot to the insight stone slot for proper quantity lookup
            targetItemSlot = insightStoneSlot.closest('.container-slot');
            console.log(`[Better Yasir] Exchange section: using insight stone slot for quantity lookup`);
            
            // Overhaul the first cell to show the daily item instead of dust
            const firstCell = tableCells[0];
            const firstCellContainer = firstCell.querySelector('div.flex.items-center.gap-1\\.5');
            
            if (firstCellContainer) {
              // Find the dust container slot
              const dustSlot = firstCellContainer.querySelector('.container-slot[data-item-key="dust"]');
              if (dustSlot) {
                // Find the daily item slot in the second cell (whatever it is, not hardcoded)
                const dailyItemSlot = secondCell.querySelector('.container-slot');
                
                if (dailyItemSlot) {
                  // Debug: Log the structure before moving
                  console.log(`[Better Yasir] Daily item slot before move:`, dailyItemSlot.outerHTML);
                  
                  // Instead of moving the entire slot, copy the content inside it
                  const dailyItemContent = dailyItemSlot.querySelector('.has-rarity');
                  const dustItemContent = dustSlot.querySelector('.has-rarity');
                  
                  if (dailyItemContent && dustItemContent) {
                    console.log(`[Better Yasir] ===== STARTING STONE OF INSIGHT REPLACEMENT =====`);
                    
                    // Get the quantity from inventory state
                    console.log(`[Better Yasir] Getting inventory state for quantity lookup`);
                    const inventory = getInventoryState();
                    console.log(`[Better Yasir] Full inventory state:`, inventory);
                    console.log(`[Better Yasir] Looking for insightStone5 in inventory:`, inventory.insightStone5);
                    const insightStoneQuantity = inventory.insightStone5 || 1;
                    console.log(`[Better Yasir] Final quantity to use: ${insightStoneQuantity}`);
                    
                    // Create a proper Stone of Insight sprite with complete container structure
                    console.log(`[Better Yasir] Calling createStoneOfInsightSprite with quantity: ${insightStoneQuantity}`);
                    const stoneOfInsightContainer = createStoneOfInsightSprite(insightStoneQuantity);
                    
                    // Replace the entire dust slot with the new container
                    console.log(`[Better Yasir] Replacing dust slot with new Stone of Insight container`);
                    console.log(`[Better Yasir] Dust slot before replacement:`, dustSlot.outerHTML);
                    dustSlot.parentNode.replaceChild(stoneOfInsightContainer, dustSlot);
                    console.log(`[Better Yasir] Replacement completed`);
                    
                    // Update the item key on the new container
                    stoneOfInsightContainer.setAttribute('data-item-key', 'insightStone5');
                    console.log(`[Better Yasir] Set data-item-key to 'insightStone5'`);
                    console.log(`[Better Yasir] Created complete Stone of Insight container with quantity: ${insightStoneQuantity}`);
                    
                    // Remove the original daily item slot from second cell
                    console.log(`[Better Yasir] Removing original daily item slot from second cell`);
                    dailyItemSlot.remove();
                    console.log(`[Better Yasir] ===== STONE OF INSIGHT REPLACEMENT COMPLETE =====`);
                  } else {
                    // Fallback: move the entire slot if content copying fails
                    dustSlot.parentNode.replaceChild(dailyItemSlot, dustSlot);
                    console.log(`[Better Yasir] Fallback: moved entire daily item slot`);
                  }
                  
                  // Update the text content to show the daily item name
                  // Find text divs that are separate from the container slot (not inside it)
                  const textDivs = firstCellContainer.querySelectorAll('div:not(.container-slot):not(.better-yasir-right-side-wrapper):not(.has-rarity):not(.revert-pixel-font-spacing)');
                  
                  if (textDivs.length > 0) {
                    // Get the rarity from the daily item
                    const rarityElement = dailyItemSlot.querySelector('[data-rarity]');
                    const rarity = rarityElement ? rarityElement.getAttribute('data-rarity') : '';
                    
                    // Get the item name from the daily item's alt text or determine from item key
                    let itemName = 'Daily Item';
                    const spriteImg = dailyItemSlot.querySelector('.sprite.item img');
                    if (spriteImg && spriteImg.alt) {
                      itemName = spriteImg.alt;
                    } else if (dailyItemKey) {
                      // Fallback: generate name from item key
                      if (dailyItemKey.startsWith('insightStone')) {
                        itemName = 'Stone of Insight';
                      } else if (dailyItemKey.startsWith('diceManipulator')) {
                        itemName = 'Dice Manipulator';
                      } else {
                        itemName = dailyItemKey.charAt(0).toUpperCase() + dailyItemKey.slice(1);
                      }
                    }
                    
                    // Generate rarity class
                    const rarityClass = rarity ? `text-rarity-${rarity}` : 'text-whiteRegular';
                    
                    // Update only the text divs that are separate from the sprite structure
                    textDivs.forEach((textDiv, index) => {
                      // Check if this div is actually a text element and not part of the sprite structure
                      if (!textDiv.querySelector('.sprite, .viewport, .spritesheet') && !textDiv.classList.contains('revert-pixel-font-spacing')) {
                        textDiv.innerHTML = `${itemName}<p class="pixel-font-14 -mt-0.5 ${rarityClass}">${getRarityName(rarity)}</p>`;
                        console.log(`[Better Yasir] Updated text div ${index} to show ${itemName} (${getRarityName(rarity)})`);
                      } else {
                        console.log(`[Better Yasir] Skipping text div ${index} as it contains sprite elements or is a quantity indicator`);
                      }
                    });
                  }
                }
              }
            }
          } else {
            console.log(`[Better Yasir] No Stone of Insight found in second cell`);
          }
        }
      }
      
      // Determine action type based on context
      // Look for price button or trade button in the container
      const priceButton = container.querySelector('button');
      
      // Also check if the button text is "Trade"
      const buttonText = priceButton?.textContent?.trim() || '';
      const isTradeButton = buttonText === 'Trade';
      
      const actionType = (isExchangeSection || isTradeButton) ? 'sell' : 'buy';
      
      console.log(`[Better Yasir] Container text: "${containerText}"`);
      console.log(`[Better Yasir] Button text: "${buttonText}"`);
      console.log(`[Better Yasir] Is exchange section: ${isExchangeSection}, Is trade button: ${isTradeButton}, Action type: ${actionType}`);
      
      // Get item price and handle exchange section logic
      let itemPrice = 0;
      let targetItemKey = itemKey;
      
      if (isExchangeSection) {
        // For exchange section, hardcode dust amount to 10 per item
        itemPrice = 10;
        console.log(`[Better Yasir] Exchange section: using hardcoded dust amount: ${itemPrice} per item`);
        
        // For exchange, we need to find the Stone of Insight
        const tableCells = tableRow.querySelectorAll('td');
        if (tableCells.length >= 2) {
          const secondCell = tableCells[1];
          const insightStoneSlot = secondCell.querySelector('.sprite.item.id-21383');
          if (insightStoneSlot) {
            targetItemKey = 'insightStone5'; // Hardcode the correct tier based on data-rarity="5"
            targetItemSlot = insightStoneSlot.closest('.container-slot'); // Use the container slot for quantity lookup
            console.log(`[Better Yasir] Exchange section: using insightStone5 for Stone of Insight`);
          }
        }
      } else {
        // For regular sections, get price from the next cell
        itemPrice = getItemPriceFromNextCell(container);
        
        // Use targetContainer for getting item info if we're in exchange section
        targetItemSlot = targetContainer.querySelector(SELECTORS.ITEM_SLOT);
        targetItemKey = targetContainer !== container ? (targetItemSlot ? getItemKeyFromSlot(targetItemSlot) : null) : itemKey;
      }
      
      // If targetItemSlot is null, try to find it in the original container
      if (!targetItemSlot) {
        targetItemSlot = itemSlot;
      }
      
      // If we still don't have a valid item slot or item key, skip this container
      if (!targetItemSlot || !targetItemKey) {
        console.log(`[Better Yasir] No valid item slot (${!!targetItemSlot}) or item key (${targetItemKey}), skipping container`);
        return;
      }
      
      const availableQuantity = getItemQuantity(targetItemSlot || itemSlot);
      
      console.log(`[Better Yasir] Target item key: ${targetItemKey}, Available quantity: ${availableQuantity}`);
      
      // Calculate max quantity based on available resources
      let maxQuantity;
      if (actionType === 'buy') {
        // For buying items: player's dust / item price, rounded down
        const playerDust = getPlayerDust();
        maxQuantity = itemPrice > 0 ? Math.floor(playerDust / itemPrice) : 0;
        console.log(`[Better Yasir] BUY - Player dust: ${playerDust}, Item price: ${itemPrice}, Max quantity: ${maxQuantity}`);
      } else if (actionType === 'sell') {
        // For selling items: use the available quantity of the item being sold
        maxQuantity = availableQuantity;
        console.log(`[Better Yasir] SELL - Available quantity: ${availableQuantity}, Max quantity: ${maxQuantity}`);
      } else {
        // For other trading: use the available quantity
        maxQuantity = availableQuantity;
        console.log(`[Better Yasir] TRADE - Available quantity: ${availableQuantity}, Max quantity: ${maxQuantity}`);
      }
      
      // Create quantity input only (no button here)
      const quantityInput = createQuantityInput(maxQuantity);
      
      // Create a wrapper div to position the input on the right side
      const rightSideWrapper = document.createElement('div');
      rightSideWrapper.className = 'better-yasir-right-side-wrapper';
      rightSideWrapper.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        margin-left: auto;
        min-width: 60px;
      `;
      
      // Add only the input to the wrapper
      rightSideWrapper.appendChild(quantityInput);
      
      // Append the wrapper to the target container (this will push it to the right)
      targetContainer.appendChild(rightSideWrapper);
      
      // Find the correct table cell for the button
      let targetCell = null;
      
      if (isExchangeSection) {
        // For exchange section, use the second cell (where the trade button is)
        const tableCells = tableRow.querySelectorAll('td');
        if (tableCells.length >= 2) {
          targetCell = tableCells[1];
        }
      } else {
        // For regular sections, use the next cell
        const currentCell = container.closest('td');
        if (currentCell) {
          targetCell = currentCell.nextElementSibling;
        }
      }
      
      if (targetCell) {
        // Create our custom action button
        const customActionButton = createCustomActionButton(actionType);
        
        // Set initial value
        const initialQuantity = Math.min(1, maxQuantity);
        quantityInput.value = initialQuantity.toString();
        
        // Update button text with price
        updateActionButtonText(customActionButton, initialQuantity, actionType, itemPrice);
        
        // Add the button to the target cell
        targetCell.appendChild(customActionButton);
        
        // Hide any existing price/trade buttons in the target cell
        const existingButton = targetCell.querySelector('button');
        if (existingButton) {
          existingButton.style.display = 'none';
        }
        
        // Add event listeners
        addEventListenersToInput(quantityInput, customActionButton, targetItemKey, maxQuantity, index, targetItemSlot || itemSlot, actionType, itemPrice);
        
        // Mark this row as processed to prevent duplicate processing
        if (tableRow) {
          tableRow.dataset.betterYasirProcessed = 'true';
        }
        
        // If price is 0 and not in exchange section, try again after a short delay (DOM might not be ready)
        if (itemPrice === 0 && !isExchangeSection) {
          setTimeout(() => {
            const retryPrice = getItemPriceFromNextCell(container);
            if (retryPrice > 0) {
              console.log('[Better Yasir] Retry got price:', retryPrice);
              // Update the button text with the correct price
              updateActionButtonText(customActionButton, parseInt(quantityInput.value) || 1, actionType, retryPrice);
            }
          }, 100);
        }
      }
    });
  }
  
  // Add event listeners to input and button
  function addEventListenersToInput(quantityInput, actionButton, itemKey, maxQuantity, index, itemSlot, actionType, itemPrice = 0) {
    // Add event listener to update button text
    quantityInput.addEventListener('input', function() {
      const value = this.value.trim();
      let quantity;
      
      if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        // Ensure quantity doesn't exceed the maximum
        if (quantity > maxQuantity) {
          quantity = maxQuantity;
        }
      }
      
      updateActionButtonText(actionButton, quantity, actionType, itemPrice);
    });
    
    // Add event listener to the action button
    actionButton.addEventListener('click', async function(e) {
      e.stopPropagation();
      // Prevent multiple simultaneous clicks
      if (actionButton.disabled) {
        return;
      }
      
      const value = quantityInput.value.trim();
      let quantity;
      
      if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        // Ensure quantity doesn't exceed the maximum
        if (quantity > maxQuantity) {
          quantity = maxQuantity;
        }
      }
      
      console.log(`[Better Yasir] ${actionType} ${quantity} items from slot ${index + 1}`);
      
      // Confirmation after validations pass
      if (actionButton.dataset.confirm !== 'pending') {
        showConfirmationPrompt(quantity, itemKey, actionButton, actionType);
        return; // wait for second click
      } else {
        removeConfirmationPrompt();
        delete actionButton.dataset.confirm;
      }
      
      // Show loading state and disable button
      const originalText = actionButton.innerHTML;
      actionButton.innerHTML = actionType === 'buy' ? 'Buying...' : 'Exchanging...';
      removeConfirmationPrompt();
      actionButton.disabled = true;
      
      try {
        // Implement actual action logic
        await performAction(itemKey, quantity, actionType);
      } catch (error) {
        handleError(error, `${itemKey} ${actionType} failed`);
        
        // Show error state briefly
        actionButton.innerHTML = 'Error!';
        showTooltipMessage(`${actionType} failed. Please try again.`);
        setTimeout(() => {
          actionButton.innerHTML = originalText;
          actionButton.disabled = false;
        }, CONSTANTS.ERROR_DISPLAY_DURATION);
        return;
      } finally {
        // Restore button state
        actionButton.innerHTML = originalText;
        actionButton.disabled = false;
      }
    });
  }
  
// =======================
// 4. Core UI Functions
// =======================
  
  // Main function to enhance the Yasir modal
  function enhanceYasirModal() {
    // Log the complete Yasir API data when modal is detected
    getYasirShopData();
    
    // Try multiple ways to find the Yasir modal
    let yasirTitle = null;
    let modal = null;
    
    // Method 1: Look for h2 with p containing "Yasir" and find the correct widget-bottom
    yasirTitle = document.querySelector('h2 p');
    if (yasirTitle && yasirTitle.textContent.includes('Yasir')) {
      // Replace title with activation message in green
      yasirTitle.textContent = "Better Yasir activated!";
      yasirTitle.style.color = '#32cd32';
      // Look for the widget-bottom that contains both the title and the tables
      const widgetBottom = yasirTitle.closest('.widget-bottom');
      if (widgetBottom && widgetBottom.textContent.includes('Current stock')) {
        modal = widgetBottom;
      }
    }
    
    // Method 2: Look for any widget-bottom containing both "Yasir" and the tables
    if (!modal) {
      const widgetBottoms = document.querySelectorAll('.widget-bottom');
      for (const widget of widgetBottoms) {
        const text = widget.textContent || '';
        if (text.includes('Yasir') && text.includes('Current stock') && text.includes('Exchange items for dust')) {
          modal = widget;
          break;
        }
      }
    }
    
    if (!modal) {
      return false;
    }
    
    // Check if we've already enhanced this modal
    if (modal.dataset.betterYasirEnhanced) {
      return true;
    }
    
    // Check if modal is currently being processed
    if (modal.dataset.betterYasirProcessing) {
      return false;
    }
    
    // Mark modal as being processed
    modal.dataset.betterYasirProcessing = 'true';
    
    // Process flex containers (for the new div structure) - this handles everything now
    addQuantityInputsToFlexContainers();
    
    // Mark as enhanced
    modal.dataset.betterYasirEnhanced = 'true';
    
    // Remove processing marker
    delete modal.dataset.betterYasirProcessing;
    
    return true;
  }
  
// =======================
// 5. Main Logic
// =======================
  
  // Observer to watch for modal changes
  let observer = null;
  let observerTimeout = null;
  
  // Utility to transform Yasir tooltip title to activation text
  function transformYasirTooltip() {
    try {
      const tooltip = document.querySelector('.tooltip-prose');
      if (!tooltip) return;
      const titleElem = tooltip.querySelector('p'); // first <p> is title
      if (titleElem && titleElem.textContent.includes("Yasir") && titleElem.textContent !== "Better Yasir activated!") {
        titleElem.textContent = "Better Yasir activated!";
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
      transformYasirTooltip();
      
      // Check for flex containers that might need enhancement
      const flexContainers = document.querySelectorAll('div.flex.items-center.gap-1\\.5.dithered.px-1, div.flex.items-center.gap-1\\.5');
      if (flexContainers.length > 0) {
        addQuantityInputsToFlexContainers();
      }
      
      // Check if already processing to avoid duplicate work
      const existingModal = document.querySelector(`${SELECTORS.YASIR_MODAL}[data-better-yasir-enhanced]`);
      if (existingModal) {
        return;
      }
      
      // Early exit if no relevant mutations
      const hasRelevantMutation = mutations.some(mutation => 
        mutation.type === 'childList' && 
        Array.from(mutation.addedNodes).some(node => 
          node.nodeType === Node.ELEMENT_NODE && 
          (node.textContent?.includes('Yasir') || 
           node.querySelector?.('*') && 
           Array.from(node.querySelectorAll('*')).some(el => 
             el.textContent?.includes('Yasir')
           ))
        )
      );
      
      if (!hasRelevantMutation) {
        return;
      }
      
      // Find and process the modal
      const widgetBottoms = document.querySelectorAll(SELECTORS.YASIR_MODAL);
      for (const widget of widgetBottoms) {
        if (widget.querySelector('table') && 
            !widget.dataset.betterYasirProcessing && 
            !widget.dataset.betterYasirEnhanced) {
          widget.dataset.betterYasirProcessing = 'true';
          enhanceYasirModal();
          if (widget.dataset.betterYasirProcessing) {
            delete widget.dataset.betterYasirProcessing;
          }
          break; // Only process one modal at a time
        }
      }
    }, CONSTANTS.DEBOUNCE_DELAY);
  }
  
  // Retry mechanism for modal enhancement
  function retryEnhanceYasirModal(maxAttempts = CONSTANTS.RETRY_MAX_ATTEMPTS, baseDelay = CONSTANTS.RETRY_BASE_DELAY) {
    let attempts = 0;
    
    const tryEnhance = () => {
      attempts++;
      if (enhanceYasirModal()) {
        return; // Success, stop retrying
      }
      
      if (attempts < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempts - 1); // Exponential backoff
        setTimeout(tryEnhance, delay);
      } else {
        console.warn('[Better Yasir] Failed to enhance modal after maximum retry attempts');
      }
    };
    
    tryEnhance();
  }
  
  function initializeBetterYasir() {
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
    transformYasirTooltip();

    // Check for flex containers on startup
    addQuantityInputsToFlexContainers();

    // Use retry mechanism instead of multiple timeouts
    retryEnhanceYasirModal();
  }
  
  function cleanup() {
    // Disconnect observer
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    // Remove styles
    const styleElement = document.getElementById('better-yasir-styles');
    if (styleElement) {
      styleElement.remove();
    }
    
    // Remove enhanced markers
    document.querySelectorAll('[data-better-yasir-enhanced]').forEach(element => {
      delete element.dataset.betterYasirEnhanced;
    });
    
    // Remove table processing markers
    document.querySelectorAll('[data-better-yasir-table-processed]').forEach(element => {
      delete element.dataset.betterYasirTableProcessed;
    });
    
    // Remove modal processing markers
    document.querySelectorAll('[data-better-yasir-processing]').forEach(element => {
      delete element.dataset.betterYasirProcessing;
    });
    
    // Remove quantity inputs and custom buttons
    document.querySelectorAll('.better-yasir-quantity-input, .better-yasir-action-button').forEach(element => {
      // Remove event listeners by cloning and replacing
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
      newElement.remove();
    });
    
    // Show original buttons that were hidden
    document.querySelectorAll('button[style*="display: none"]').forEach(button => {
      if (button.parentNode.querySelector('.better-yasir-action-button')) {
        button.style.display = '';
      }
    });
  }
  
  // Initialize the mod
  initializeBetterYasir();
  
  // Export cleanup function for the mod loader
  if (typeof context !== 'undefined') {
    context.exports = {
      cleanup: cleanup
    };
  }
  
})(); 