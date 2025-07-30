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
  
  // CSS styles for the quantity input and fuse buttons
  const QUANTITY_INPUT_STYLES = `
    .better-hygenie-quantity-input {
      width: 100%;
      max-width: 50px;
      height: 20px;
      background: #2a2a2a;
      border: 1px solid #4a4a4a;
      color: white;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      text-align: center;
      padding: 2px;
      margin-bottom: 4px;
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
      width: 50px !important;
      height: 35px !important;
      min-width: 50px !important;
      min-height: 35px !important;
      max-width: 50px !important;
      max-height: 35px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      text-align: center !important;
      white-space: normal !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      flex-direction: column !important;
      line-height: 1 !important;
      font-size: 12px !important;
    }
  `;
  
// =======================
// 2. Utility Functions
// =======================
  
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
    try {
      const gameState = globalThis.state?.player?.getSnapshot()?.context;
      if (gameState && gameState.inventory) {
        // Determine item type and tier from the slot
        const itemKey = getItemKeyFromSlot(itemSlot);
        if (itemKey) {
          const inventory = gameState.inventory;
          const count = inventory[itemKey] || 0;
          console.log(`[Better Hy\'genie] Got quantity from game state: ${itemKey} = ${count}`);
          return count;
        }
      }
      
      console.log('[Better Hy\'genie] No game state data available');
      return 0;
    } catch (error) {
      console.error('[Better Hy\'genie] Error getting item quantity:', error);
      return 0;
    }
  }
  
  // Retry getting item quantity with a delay to allow game state to load
  function getItemQuantityWithRetry(itemSlot, maxRetries = 3) {
    return new Promise((resolve) => {
      let attempts = 0;
      
      const tryGetQuantity = () => {
        attempts++;
        const itemKey = getItemKeyFromSlot(itemSlot);
        const gameState = globalThis.state?.player?.getSnapshot()?.context;
        
        if (gameState && gameState.inventory && itemKey) {
          const inventory = gameState.inventory;
          const count = inventory[itemKey] || 0;
          console.log(`[Better Hy\'genie] Got quantity from game state (attempt ${attempts}): ${itemKey} = ${count}`);
          resolve(count);
          return;
        }
        
        if (attempts < maxRetries) {
          console.log(`[Better Hy\'genie] Retrying quantity fetch (attempt ${attempts + 1}/${maxRetries})`);
          setTimeout(tryGetQuantity, 500);
        } else {
          console.log(`[Better Hy\'genie] Failed to get quantity after ${maxRetries} attempts`);
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
      console.error('[Better Hy\'genie] Error getting fusion ratio:', error);
      return 1;
    }
  }
  
  // Round down to nearest valid fusion amount
  function roundDownToValidFusionAmount(itemKey, quantity) {
    const ratio = getFusionRatio(itemKey);
    if (ratio === 0) return 0; // No fusion possible
    return Math.floor(quantity / ratio) * ratio;
  }
  
  // Determine item key from the slot
  function getItemKeyFromSlot(itemSlot) {
    try {
      // Check for summon scroll
      const summonScrollImg = itemSlot.querySelector('img[src*="summonscroll"]');
      if (summonScrollImg) {
        const src = summonScrollImg.src;
        const match = src.match(/summonscroll(\d+)\.png/);
        if (match) {
          const tier = match[1];
          return `summonScroll${tier}`;
        }
      }
      
      // Check for dice manipulator - look for any sprite with id 35909
      const diceManipulatorSprite = itemSlot.querySelector('.sprite.item');
      if (diceManipulatorSprite) {
        const spriteId = diceManipulatorSprite.getAttribute('data-sprite-id') || 
                        diceManipulatorSprite.querySelector('img')?.alt;
        console.log(`[Better Hy\'genie] Found sprite with ID: ${spriteId}`);
        
        if (spriteId === '35909') {
          // Determine tier from rarity
          const rarityElement = itemSlot.querySelector('[data-rarity]');
          if (rarityElement) {
            const rarity = rarityElement.getAttribute('data-rarity');
            console.log(`[Better Hy\'genie] Found rarity: ${rarity}`);
            return `diceManipulator${rarity}`;
          }
        }
      }
      
      // Fallback: try to determine from the slot position or other attributes
      console.log(`[Better Hy\'genie] Could not determine item key from slot, checking fallback methods`);
      
      // Check if this is in the dice manipulator section by looking at parent containers
      const parentSection = itemSlot.closest('.w-full');
      if (parentSection && parentSection.textContent.includes('Dice Manipulators')) {
        // Try to determine tier from position or other attributes
        const rarityElement = itemSlot.querySelector('[data-rarity]');
        if (rarityElement) {
          const rarity = rarityElement.getAttribute('data-rarity');
          console.log(`[Better Hy\'genie] Fallback: using rarity ${rarity} for dice manipulator`);
          return `diceManipulator${rarity}`;
        }
        
        // If no rarity found, try to determine from position in the grid
        const gridContainer = itemSlot.closest('.grid');
        if (gridContainer) {
          const gridIndex = Array.from(gridContainer.parentNode.children).indexOf(gridContainer);
          if (gridIndex >= 0 && gridIndex < 4) {
            const tier = gridIndex + 1;
            console.log(`[Better Hy\'genie] Fallback: using grid position ${gridIndex} for dice manipulator tier ${tier}`);
            return `diceManipulator${tier}`;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('[Better Hy\'genie] Error getting item key from slot:', error);
      return null;
    }
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
      
      // Allow "All" or "all" (case insensitive)
      if (value.toLowerCase() === 'all') {
        return;
      }
      
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
  
// =======================
// 3. UI Component Creation
// =======================
  
  // Add quantity inputs to a section (Summon Scrolls or Dice Manipulators)
  function addQuantityInputsToSection(section) {
    console.log('[Better Hy\'genie] Adding quantity inputs to section:', section);
    
    // Check if this section has already been processed
    if (section.dataset.betterHygenieSectionProcessed) {
      console.log('[Better Hy\'genie] Section already processed, skipping');
      return;
    }
    
    // Find all grid containers that contain item slots and fuse buttons
    const gridContainers = section.querySelectorAll('.grid.w-\\[53px\\]');
    console.log('[Better Hy\'genie] Found grid containers:', gridContainers.length);
    
    let processedCount = 0;
    
    gridContainers.forEach((gridContainer, index) => {
      const itemSlot = gridContainer.querySelector('.container-slot');
      const fuseButton = gridContainer.querySelector('button');
      
      if (!itemSlot || !fuseButton) {
        console.log('[Better Hy\'genie] Skipping grid container', index, '- missing item slot or button');
        return;
      }
      
      // Check if we've already added an input to this container
      if (gridContainer.querySelector('.better-hygenie-quantity-input')) {
        console.log(`[Better Hy\'genie] Grid ${index} already has quantity input, skipping`);
        return;
      }
      
      const itemKey = getItemKeyFromSlot(itemSlot);
      
      // Use retry mechanism for dice manipulators to ensure we get correct game state data
      const isDiceManipulator = itemKey && itemKey.startsWith('diceManipulator');
      
      if (isDiceManipulator) {
        // Use async retry for dice manipulators
        getItemQuantityWithRetry(itemSlot).then(totalQuantity => {
          const validFusionAmount = roundDownToValidFusionAmount(itemKey, totalQuantity);
          
          console.log(`[Better Hy\'genie] Grid ${index}: total quantity = ${totalQuantity}, valid fusion = ${validFusionAmount} (${itemKey})`);
          
          if (totalQuantity === 0) {
            console.log(`[Better Hy\'genie] Skipping grid ${index} - no items available`);
            return;
          }
          
          // Create quantity input with valid fusion amount as max
          const quantityInput = createQuantityInput(validFusionAmount);
          
          // Insert input before the button (above it)
          fuseButton.parentNode.insertBefore(quantityInput, fuseButton);
          
          // Set the initial value to the valid fusion amount
          quantityInput.value = validFusionAmount.toString();
          console.log(`[Better Hy\'genie] Set input value to: ${validFusionAmount.toString()} (valid fusion: ${validFusionAmount})`);
          
          // Apply fixed size styling to the fuse button
          fuseButton.classList.add('better-hygenie-fuse-button');
          
          // Force update the button text immediately
          updateFuseButtonText(fuseButton, validFusionAmount);
          
          // Add event listeners
          addEventListenersToInput(quantityInput, fuseButton, itemKey, validFusionAmount, index);
          
          console.log(`[Better Hy\'genie] Added quantity input to grid ${index}`);
          processedCount++;
        });
        return;
      }
      
      // For summon scrolls, use immediate method
      const totalQuantity = getItemQuantity(itemSlot);
      const validFusionAmount = roundDownToValidFusionAmount(itemKey, totalQuantity);
      
      console.log(`[Better Hy\'genie] Grid ${index}: total quantity = ${totalQuantity}, valid fusion = ${validFusionAmount} (${itemKey})`);
      
      if (totalQuantity === 0) {
        console.log(`[Better Hy\'genie] Skipping grid ${index} - no items available`);
        return;
      }
      
      // Create quantity input with valid fusion amount as max
      const quantityInput = createQuantityInput(validFusionAmount);
      
      // Insert input before the button (above it)
      fuseButton.parentNode.insertBefore(quantityInput, fuseButton);
      
      // Set the initial value to the valid fusion amount
      quantityInput.value = validFusionAmount.toString();
      console.log(`[Better Hy\'genie] Set input value to: ${validFusionAmount.toString()} (valid fusion: ${validFusionAmount})`);
      
      // Apply fixed size styling to the fuse button
      fuseButton.classList.add('better-hygenie-fuse-button');
      
      // Force update the button text immediately
      updateFuseButtonText(fuseButton, validFusionAmount);
      
      // Add event listeners
      addEventListenersToInput(quantityInput, fuseButton, itemKey, validFusionAmount, index);
      
      console.log(`[Better Hy\'genie] Added quantity input to grid ${index}`);
      processedCount++;
    });
    
    // Mark section as processed if we successfully processed any grids
    if (processedCount > 0) {
      section.dataset.betterHygenieSectionProcessed = 'true';
      console.log(`[Better Hy\'genie] Marked section as processed (${processedCount} grids processed)`);
    }
  }
  
  // Add event listeners to input and button
  function addEventListenersToInput(quantityInput, fuseButton, itemKey, validFusionAmount, index) {
    // Add event listener to update button text
    quantityInput.addEventListener('input', function() {
      const value = this.value.trim();
      let quantity;
      
      if (value.toLowerCase() === 'all') {
        quantity = validFusionAmount;
      } else if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        // Round down to valid fusion amount
        quantity = roundDownToValidFusionAmount(itemKey, quantity);
      }
      
      updateFuseButtonText(fuseButton, quantity);
    });
    
    // Add event listener to the fuse button
    fuseButton.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const value = quantityInput.value.trim();
      let quantity;
      
      if (value.toLowerCase() === 'all') {
        quantity = validFusionAmount;
      } else if (value === '') {
        quantity = 1;
      } else {
        quantity = parseInt(value) || 1;
        // Round down to valid fusion amount
        quantity = roundDownToValidFusionAmount(itemKey, quantity);
      }
      
      console.log(`[Better Hy\'genie] Fusing ${quantity} items from slot ${index + 1}`);
      
      // TODO: Implement actual fusion logic here
      // For now, just log the action
    });
  }
  
// =======================
// 4. Core UI Functions
// =======================
  
  // Main function to enhance the Hy'genie modal
  function enhanceHygenieModal() {
    console.log('[Better Hy\'genie] Attempting to enhance modal...');
    
    // Try multiple ways to find the Hy'genie modal
    let hygenieTitle = null;
    let modal = null;
    
    // Method 1: Look for h2 with p containing "Hy'genie" and find the correct widget-bottom
    hygenieTitle = document.querySelector('h2 p');
    if (hygenieTitle && hygenieTitle.textContent.includes('Hy\'genie')) {
      // Look for the widget-bottom that contains both the title and the sections
      const widgetBottom = hygenieTitle.closest('.widget-bottom');
      if (widgetBottom && widgetBottom.textContent.includes('Summon Scrolls')) {
        modal = widgetBottom;
        console.log('[Better Hy\'genie] Found modal via method 1');
      }
    }
    
    // Method 2: Look for any widget-bottom containing both "Hy'genie" and the sections
    if (!modal) {
      const widgetBottoms = document.querySelectorAll('.widget-bottom');
      for (const widget of widgetBottoms) {
        const text = widget.textContent || '';
        if (text.includes('Hy\'genie') && text.includes('Summon Scrolls') && text.includes('Dice Manipulators')) {
          modal = widget;
          console.log('[Better Hy\'genie] Found modal via method 2');
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
            console.log('[Better Hy\'genie] Found modal via method 3');
            break;
          }
        }
      }
    }
    
    if (!modal) {
      console.log('[Better Hy\'genie] Modal not found');
      return false;
    }
    
    console.log('[Better Hy\'genie] Modal found, checking if already enhanced...');
    
    // Check if we've already enhanced this modal
    if (modal.dataset.betterHygenieEnhanced) {
      console.log('[Better Hy\'genie] Modal already enhanced');
      return true;
    }
    
    console.log('[Better Hy\'genie] Enhancing modal...');
    
    // Find the sections by looking for the specific structure
    // Based on the HTML, sections are div elements with widget-top and widget-bottom children
    const sections = modal.querySelectorAll('div > div > .widget-top');
    console.log('[Better Hy\'genie] Found potential sections:', sections.length);
    
    let sectionsProcessed = 0;
    
    sections.forEach((sectionHeader, index) => {
      const sectionText = sectionHeader.textContent || '';
      console.log(`[Better Hy\'genie] Section ${index} text:`, sectionText.substring(0, 50) + '...');
      
      if (sectionText.includes('Summon Scrolls') || sectionText.includes('Dice Manipulators')) {
        console.log(`[Better Hy\'genie] Processing section ${index}: ${sectionText.includes('Summon Scrolls') ? 'Summon Scrolls' : 'Dice Manipulators'}`);
        
        // Find the corresponding widget-bottom that contains the actual content
        const sectionContainer = sectionHeader.closest('div');
        const sectionContent = sectionContainer.querySelector('.widget-bottom');
        
        if (sectionContent) {
          addQuantityInputsToSection(sectionContent);
          sectionsProcessed++;
        } else {
          console.log(`[Better Hy\'genie] Could not find content for section ${index}`);
        }
      }
    });
    
    console.log(`[Better Hy\'genie] Processed ${sectionsProcessed} sections`);
    
    // Mark as enhanced
    modal.dataset.betterHygenieEnhanced = 'true';
    
    console.log('[Better Hy\'genie] Modal enhanced successfully');
    return true;
  }
  
// =======================
// 5. Main Logic
// =======================
  
  // Observer to watch for modal changes
  let observer = null;
  
  function initializeBetterHygenie() {
    console.log('[Better Hy\'genie] Mod initialized successfully');
    
    // Inject styles
    injectStyles();
    
    // Set up observer to watch for DOM changes
    observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Check if this node or any of its children contains "Hy'genie"
              const hasHygenie = node.textContent && node.textContent.includes('Hy\'genie');
              const hasHygenieChild = node.querySelector && node.querySelector('*') && 
                Array.from(node.querySelectorAll('*')).some(el => 
                  el.textContent && el.textContent.includes('Hy\'genie')
                );
              
              if (hasHygenie || hasHygenieChild) {
                console.log('[Better Hy\'genie] MutationObserver detected Hy\'genie content');
                
                // Wait a bit for the DOM to be fully constructed
                setTimeout(() => {
                  // Check if we're already processing this modal
                  const existingModal = document.querySelector('.widget-bottom[data-better-hygenie-enhanced]');
                  if (existingModal) {
                    console.log('[Better Hy\'genie] Modal already enhanced, skipping');
                    return;
                  }
                  
                  // Try to find the modal
                  let modal = node.closest('.widget-bottom');
                  if (!modal) {
                    // Look for any widget-bottom that contains elements with data-rarity
                    const widgetBottoms = document.querySelectorAll('.widget-bottom');
                    for (const widget of widgetBottoms) {
                      if (widget.querySelector('[data-rarity]')) {
                        modal = widget;
                        break;
                      }
                    }
                  }
                  
                  if (modal && !modal.dataset.betterHygenieProcessing) {
                    console.log('[Better Hy\'genie] Detected Hy\'genie modal, enhancing...');
                    modal.dataset.betterHygenieProcessing = 'true';
                    setTimeout(() => {
                      enhanceHygenieModal();
                      if (modal.dataset.betterHygenieProcessing) {
                        delete modal.dataset.betterHygenieProcessing;
                      }
                    }, 100);
                  } else if (modal && modal.dataset.betterHygenieProcessing) {
                    console.log('[Better Hy\'genie] Modal already being processed, skipping');
                  } else {
                    console.log('[Better Hy\'genie] No modal found or modal not ready');
                  }
                }, 200);
              }
            }
          });
        }
      });
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Also check if modal is already present
    setTimeout(() => enhanceHygenieModal(), 500);
    
    // Check again after a longer delay in case the modal loads slowly
    setTimeout(() => enhanceHygenieModal(), 2000);
    

  }
  
  function cleanup() {
    console.log('[Better Hy\'genie] Cleaning up...');
    
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
    
    // Remove quantity inputs
    document.querySelectorAll('.better-hygenie-quantity-input').forEach(input => {
      input.remove();
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