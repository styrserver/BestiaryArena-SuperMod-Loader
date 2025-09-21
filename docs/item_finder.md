// =======================
// 0.5. Item Discovery Console Commands
// =======================
// Run these in the browser console to discover item data:
// 1. Check for item APIs
console.log('=== ITEM API DISCOVERY ===');
console.log('getItem function:', typeof globalThis.state?.utils?.getItem);
console.log('getInventoryItem function:', typeof globalThis.state?.utils?.getInventoryItem);
console.log('getConsumable function:', typeof globalThis.state?.utils?.getConsumable);

// 2. Try to get specific items by ID (from your inventory)
const itemIds = [653, 21383, 35909, 35572, 42363, 43672, 10327];
itemIds.forEach(id => {
  if (globalThis.state?.utils?.getItem) {
    console.log(`Item ${id}:`, globalThis.state.utils.getItem(id));
  }
});

// 3. Check for item data in utils
console.log('Utils keys:', Object.keys(globalThis.state?.utils || {}));
console.log('State keys:', Object.keys(globalThis.state || {}));

// 4. Look for item databases
console.log('Item database:', globalThis.state?.utils?.items);
console.log('Consumable database:', globalThis.state?.utils?.consumables);
console.log('Equipment database:', globalThis.state?.utils?.equipment);

// 5. Check for item metadata
if (globalThis.state?.utils?.getItemMetadata) {
  itemIds.forEach(id => {
    console.log(`Item ${id} metadata:`, globalThis.state.utils.getItemMetadata(id));
  });
}

// 6. Look for item descriptions
if (globalThis.state?.utils?.getItemDescription) {
  itemIds.forEach(id => {
    console.log(`Item ${id} description:`, globalThis.state.utils.getItemDescription(id));
  });
}

// 7. Check for item names
if (globalThis.state?.utils?.getItemName) {
  itemIds.forEach(id => {
    console.log(`Item ${id} name:`, globalThis.state.utils.getItemName(id));
  });
}

// 8. Explore the entire utils object for item-related functions
const utils = globalThis.state?.utils;
if (utils) {
  Object.keys(utils).forEach(key => {
    if (typeof utils[key] === 'function' && key.toLowerCase().includes('item')) {
      console.log(`Found item function: ${key}`);
    }
  });
}

// NEW COMMANDS BASED ON DISCOVERIES:
// 9. Check player inventory structure
console.log('=== PLAYER INVENTORY EXPLORATION ===');
console.log('Player state:', globalThis.state?.player);
console.log('Player snapshot:', globalThis.state?.player?.getSnapshot());
console.log('Player context:', globalThis.state?.player?.getSnapshot()?.context);
console.log('Player inventory:', globalThis.state?.player?.getSnapshot()?.context?.inventory);

// 10. Try getEquipment with different IDs
console.log('=== EQUIPMENT EXPLORATION ===');
const equipmentIds = [653, 21383, 35909, 35572, 42363, 43672, 10327];
equipmentIds.forEach(id => {
  try {
    const equipment = globalThis.state?.utils?.getEquipment(id);
    if (equipment) {
      console.log(`Equipment ${id}:`, equipment);
    }
  } catch (e) {
    // Silently fail for non-equipment items
  }
});

// 11. Check for global item data
console.log('=== GLOBAL ITEM DATA ===');
console.log('Global items:', globalThis.items);
console.log('Global consumables:', globalThis.consumables);
console.log('Global equipment:', globalThis.equipment);
console.log('Global inventory:', globalThis.inventory);

// 12. Check for item data in other state objects
console.log('=== OTHER STATE EXPLORATION ===');
console.log('Menu state:', globalThis.state?.menu);
console.log('Board state:', globalThis.state?.board);
console.log('Daily state:', globalThis.state?.daily);

// 13. Look for item-related properties in utils
const utils = globalThis.state?.utils;
if (utils) {
  Object.keys(utils).forEach(key => {
    const value = utils[key];
    if (typeof value === 'object' && value !== null) {
      console.log(`Utils.${key}:`, value);
    }
  });
}

// 14. Check for item data in the DOM
console.log('=== DOM ITEM DATA ===');
const itemElements = document.querySelectorAll('[class*="item"]');
console.log('Item elements found:', itemElements.length);
itemElements.forEach((el, i) => {
  if (i < 5) { // Only log first 5
    console.log(`Item element ${i}:`, el.className, el.getAttribute('data-amount'), el.alt);
  }
});

// NEW COMMANDS FOR RARITY DISCOVERY:
// 15. Look for rarity-related elements and data
console.log('=== RARITY DISCOVERY ===');
const rarityElements = document.querySelectorAll('[data-rarity]');
console.log('Elements with data-rarity:', rarityElements.length);
rarityElements.forEach((el, i) => {
  if (i < 10) { // Only log first 10
    console.log(`Rarity element ${i}:`, {
      rarity: el.getAttribute('data-rarity'),
      className: el.className,
      textContent: el.textContent?.trim(),
      parent: el.parentElement?.className,
      alt: el.querySelector('img')?.alt,
      src: el.querySelector('img')?.src
    });
  }
});

// 16. Look for rarity text elements
const rarityTextElements = document.querySelectorAll('.has-rarity-text');
console.log('Rarity text elements found:', rarityTextElements.length);
rarityTextElements.forEach((el, i) => {
  if (i < 10) { // Only log first 10
    console.log(`Rarity text ${i}:`, {
      text: el.textContent?.trim(),
      rarity: el.getAttribute('data-rarity'),
      className: el.className,
      parent: el.parentElement?.className
    });
  }
});

// 17. Look for item name elements
const itemNameElements = document.querySelectorAll('[alt*="stamina"], [alt*="scroll"], [alt*="insight"], [alt*="dice"], [alt*="cube"]');
console.log('Item name elements found:', itemNameElements.length);
itemNameElements.forEach((el, i) => {
  if (i < 10) { // Only log first 10
    console.log(`Item name ${i}:`, {
      alt: el.alt,
      src: el.src,
      className: el.className,
      parent: el.parentElement?.className,
      rarity: el.closest('[data-rarity]')?.getAttribute('data-rarity')
    });
  }
});

// 18. Check for global rarity mappings
console.log('=== GLOBAL RARITY MAPPINGS ===');
console.log('Global rarity:', globalThis.rarity);
console.log('Global itemRarity:', globalThis.itemRarity);
console.log('Global rarityMap:', globalThis.rarityMap);
console.log('Global rarityText:', globalThis.rarityText);

// 19. Check for rarity functions
const utils = globalThis.state?.utils;
if (utils) {
  Object.keys(utils).forEach(key => {
    const value = utils[key];
    if (typeof value === 'function' && (key.toLowerCase().includes('rarity') || key.toLowerCase().includes('item'))) {
      console.log(`Found function: ${key}`);
    }
  });
}

// 20. Look for rarity in CSS classes
const rarityClasses = document.querySelectorAll('[class*="rarity"], [class*="common"], [class*="uncommon"], [class*="rare"], [class*="epic"], [class*="legendary"]');
console.log('Elements with rarity classes:', rarityClasses.length);
rarityClasses.forEach((el, i) => {
  if (i < 5) { // Only log first 5
    console.log(`Rarity class element ${i}:`, {
      className: el.className,
      textContent: el.textContent?.trim(),
      rarity: el.getAttribute('data-rarity')
    });
  }
});

// 21. Check for item tooltips or hover data
const tooltipElements = document.querySelectorAll('[title], [data-tooltip], [data-title]');
console.log('Tooltip elements found:', tooltipElements.length);
tooltipElements.forEach((el, i) => {
  if (i < 5) { // Only log first 5
    const title = el.getAttribute('title') || el.getAttribute('data-tooltip') || el.getAttribute('data-title');
    if (title && (title.includes('stamina') || title.includes('scroll') || title.includes('insight') || title.includes('dice') || title.includes('cube'))) {
      console.log(`Tooltip ${i}:`, {
        title: title,
        className: el.className,
        rarity: el.getAttribute('data-rarity')
      });
    }
  }
});