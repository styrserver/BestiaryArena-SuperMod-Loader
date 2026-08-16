// DOM Item Tier List mod for Bestiary Arena
console.log('Item Tier List Pretty Mod initializing...');

const ITEM_TIER_LIST_MODAL_CONFIG = {
  width: 450,
  height: 450,
  detailWidth: 300,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 240
};

let itemTierListModalLayoutCleanup = null;

function getItemTierListModalDimensions(maxWidth, maxHeight, minHeight = ITEM_TIER_LIST_MODAL_CONFIG.minHeight) {
  const pad = ITEM_TIER_LIST_MODAL_CONFIG.viewportPadding * 2;
  const dims = {
    width: Math.max(
      ITEM_TIER_LIST_MODAL_CONFIG.minWidth,
      Math.min(maxWidth, window.innerWidth - pad)
    )
  };
  if (maxHeight !== null && maxHeight !== undefined) {
    dims.height = Math.max(
      minHeight,
      Math.min(maxHeight, window.innerHeight - pad)
    );
  }
  return dims;
}

function getItemTierListDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearItemTierListModalLayoutCleanup() {
  if (itemTierListModalLayoutCleanup) {
    itemTierListModalLayoutCleanup();
    itemTierListModalLayoutCleanup = null;
  }
}

function applyItemTierListModalLayout(modalRef, contentRoot, scrollContainer, maxWidth, maxHeight) {
  const dialog = getItemTierListDialog(modalRef);
  if (!dialog) return;

  const hasFixedHeight = maxHeight !== null && maxHeight !== undefined;
  const dims = getItemTierListModalDimensions(maxWidth, hasFixedHeight ? maxHeight : null);

  dialog.style.width = `${dims.width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${dims.width}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]', 'w-full');

  if (hasFixedHeight) {
    dialog.style.height = `${dims.height}px`;
    dialog.style.minHeight = '0';
    dialog.style.maxHeight = `${dims.height}px`;
  }

  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper && hasFixedHeight) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0'
    });
  }

  const widgetBottom = dialog.querySelector('.widget-bottom');
  if (widgetBottom && hasFixedHeight) {
    Object.assign(widgetBottom.style, {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: '0',
      overflow: 'hidden'
    });
  }

  if (contentRoot && hasFixedHeight) {
    Object.assign(contentRoot.style, {
      flex: '1 1 auto',
      minHeight: '0',
      minWidth: '0',
      height: '100%',
      width: '100%',
      maxWidth: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'hidden'
    });
  }

  if (scrollContainer?.element && hasFixedHeight) {
    Object.assign(scrollContainer.element.style, {
      flex: '1 1 0',
      minHeight: '0',
      height: 'auto',
      width: '100%',
      position: 'relative',
      overflow: 'hidden'
    });
    const viewport = scrollContainer.scrollView ||
      scrollContainer.element.querySelector('[data-radix-scroll-area-viewport]');
    if (viewport) {
      viewport.style.height = '100%';
    }
  }
}

function setupItemTierListModalResponsiveLayout(modalRef, contentRoot, scrollContainer, maxWidth, maxHeight) {
  clearItemTierListModalLayoutCleanup();

  const apply = () => applyItemTierListModalLayout(modalRef, contentRoot, scrollContainer, maxWidth, maxHeight);
  requestAnimationFrame(() => apply());

  const onResize = () => apply();
  window.addEventListener('resize', onResize);

  let modalCloseObserver = null;
  const dialog = getItemTierListDialog(modalRef);
  if (dialog) {
    modalCloseObserver = new MutationObserver(() => {
      if (!document.contains(dialog) || dialog.getAttribute('data-state') === 'closed') {
        clearItemTierListModalLayoutCleanup();
      }
    });
    modalCloseObserver.observe(dialog, { attributes: true, attributeFilter: ['data-state'] });
    modalCloseObserver.observe(document.body, { childList: true, subtree: true });
  }

  itemTierListModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (modalCloseObserver) {
      modalCloseObserver.disconnect();
      modalCloseObserver = null;
    }
  };
}

function openItemTierListDetailModal({ title, content }) {
  const { width } = getItemTierListModalDimensions(ITEM_TIER_LIST_MODAL_CONFIG.detailWidth, null);
  api.ui.components.createModal({
    title,
    width,
    content,
    buttons: [{ text: 'Close', primary: true }]
  });
}

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Create the Tier List button using the API
if (api) {
  console.log('BestiaryModAPI available in Item Tier List Pretty Mod');
  
  // Create button to show tier list modal
  window.tierListButton = api.ui.addButton({
    id: 'item-tier-list-button',
    text: t('mods.itemTierList.buttonText'),
    tooltip: t('mods.itemTierList.buttonTooltip'),
    primary: false,
    onClick: showItemTierListModal
  });
  
  console.log('Item Tier List button added');
} else {
  console.error('BestiaryModAPI not available in Item Tier List Pretty Mod');
}

// Function to show tier list modal
function showItemTierListModal() {
  console.log('Showing item tier list modal...');
  clearItemTierListModalLayoutCleanup();

  try {
    const { equips, boardConfigs } = globalThis.state.player.getSnapshot().context;
    const equipLookup = new Map(equips.map(m => [m.id, m.gameId]));
    
    // Track both total usage count and stat-specific usage count
    const countMap = new Map();
    const statUsageMap = new Map();
    
    // Initialize stat usage tracking for each item
    equips.forEach(equip => {
      if (!statUsageMap.has(equip.gameId)) {
        statUsageMap.set(equip.gameId, { ad: 0, ap: 0, hp: 0 });
      }
    });
    
    // Count item usage in board configurations and track stat usage
    Object.values(boardConfigs).forEach(cfgs => {
      cfgs.forEach(({ equipId }) => {
        if (equipId != null) {
          // Get the game ID for this equipment
          const gameId = equipLookup.get(equipId);
          
          if (gameId != null) {
            // Increment total usage count
            countMap.set(gameId, (countMap.get(gameId) || 0) + 1);
            
            // Track stat usage - find the equip in the player's inventory to get its stat
            const equip = equips.find(e => e.id === equipId);
            if (equip && equip.stat) {
              const statCounts = statUsageMap.get(gameId) || { ad: 0, ap: 0, hp: 0 };
              statCounts[equip.stat]++;
              statUsageMap.set(gameId, statCounts);
            }
          }
        }
      });
    });

    const total = Array.from(countMap.values()).reduce((a, b) => a + b, 0);
    const list = Array.from(countMap.entries())
      .map(([gameId, cnt]) => ({
        gameId,
        count: cnt,
        pct: Math.floor((cnt / total) * 100),
        statUsage: statUsageMap.get(gameId) || { ad: 0, ap: 0, hp: 0 }
      }))
      .sort((a, b) => b.count - a.count);

    const tiers = [
      list.filter(item => item.count >= 10),  // Tier S: 10+
      list.filter(item => item.count >= 6 && item.count <= 9),  // Tier A: 6-9
      list.filter(item => item.count >= 2 && item.count <= 5),  // Tier B: 2-5
      list.filter(item => item.count >= 1 && item.count <= 1),  // Tier C: 1-1
    ];

    const labels = ['S', 'A', 'B', 'C'];
    
  // Create content container for the modal
    const contentContainer = document.createElement('div');
    
    // Scrollable tier list fills remaining modal height
    const tierListScroll = api.ui.components.createScrollContainer({
      height: '100%',
      padding: true,
      content: ''
    });
    Object.assign(tierListScroll.element.style, {
      flex: '1 1 0',
      minHeight: '0',
      height: 'auto',
      width: '100%',
      position: 'relative',
      overflow: 'hidden'
    });
    
    // Add tiers to the scroll container
    tiers.forEach((chunk, idx) => {
      if (chunk.length === 0) return;
      
      // Create tier header
      const tierHeader = document.createElement('h3');
      tierHeader.textContent = `Tier ${labels[idx] || idx + 1}`;
      tierHeader.style.cssText = 'margin: 8px 0 4px; font-size: 1.2rem; border-bottom: 1px solid #444; padding-bottom: 2px; color: white;';
      
      // Create item container
      const itemContainer = document.createElement('div');
      itemContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;';
      
      // Add item portraits for this tier
      chunk.forEach((item) => {
        // Get sprite ID from equipment metadata
        let spriteId;
        let equipName = 'Unknown Item';
        try {
          const equipData = globalThis.state.utils.getEquipment(item.gameId);
          spriteId = equipData.metadata.spriteId;
          equipName = equipData.metadata.name;
        } catch (e) {
          spriteId = '';
        }
        
        const itemWrapper = document.createElement('div');
        itemWrapper.style.cssText = 'position: relative; width: 32px; height: 32px;';
        
        // Find most common stat used for this item in board configurations
        const { ad, ap, hp } = item.statUsage;
        const mostUsedStat = [
          { stat: 'ad', count: ad },
          { stat: 'ap', count: ap },
          { stat: 'hp', count: hp }
        ].sort((a, b) => b.count - a.count)[0].stat;
        
        // Use the item portrait component with the most used stat
        const itemPortrait = api.ui.components.createItemPortrait({
          itemId: spriteId,
          stat: mostUsedStat,
          tier: Math.min(5, Math.max(1, Math.ceil(item.count / 3))), // Scale tier from 1-5 based on count
          onClick: () => {
            // Show item details when clicked
            const contentContainer = document.createElement('div');
            
            // Create wrapper for centering and proper sizing
            const centerContainer = document.createElement('div');
            centerContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin-bottom: 20px;';
            
            // Use createFullItem for the item display in modal with small size
            const fullItem = api.ui.components.createFullItem({
              itemId: spriteId,
              stat: mostUsedStat,
              tier: Math.min(5, Math.max(1, Math.ceil(item.count / 3))),
              animated: false, // Set to true for animated items
              size: 'small' // Use small size for the modal
            });
            
            centerContainer.appendChild(fullItem);
            contentContainer.appendChild(centerContainer);
            
            // Add usage stats
            const statsContainer = document.createElement('div');
            statsContainer.innerHTML = `
              <p>Used ${item.count} times in your saved configurations.</p>
              <p>Usage percentage: ${Math.floor((item.count / total) * 100)}%</p>
              <p>Stats distribution:</p>
              <ul>
                <li>Attack Damage (AD): ${item.statUsage.ad} times</li>
                <li>Ability Power (AP): ${item.statUsage.ap} times</li>
                <li>Health Points (HP): ${item.statUsage.hp} times</li>
              </ul>
            `;
            contentContainer.appendChild(statsContainer);
            
            openItemTierListDetailModal({
              title: equipName || `Item #${item.gameId}`,
              content: contentContainer
            });
          }
        });
        
        // Add count badge
        const countBadge = document.createElement('div');
        countBadge.textContent = item.count;
        countBadge.style.cssText = 'position: absolute; bottom: 0; right: 0; background: rgba(0,0,0,0.7); color: white; font-size: 10px; padding: 1px 2px; z-index: 3; border-radius: 2px; line-height: 1;';
        
        itemWrapper.appendChild(itemPortrait);
        itemWrapper.appendChild(countBadge);
        itemContainer.appendChild(itemWrapper);
      });
      
      // Add tier content to the scroll container
      tierListScroll.addContent(tierHeader);
      tierListScroll.addContent(itemContainer);
    });
    
    // Add scroll container to content container
    contentContainer.appendChild(tierListScroll.element);
    
    const modalDims = getItemTierListModalDimensions(
      ITEM_TIER_LIST_MODAL_CONFIG.width,
      ITEM_TIER_LIST_MODAL_CONFIG.height
    );

    const modal = api.ui.components.createModal({
      title: 'Item Usage Tier List',
      width: modalDims.width,
      height: modalDims.height,
      content: contentContainer,
      buttons: [
        {
          text: 'Close',
          primary: true,
          onClick: () => clearItemTierListModalLayoutCleanup()
        }
      ]
    });

    setupItemTierListModalResponsiveLayout(
      modal,
      contentContainer,
      tierListScroll,
      ITEM_TIER_LIST_MODAL_CONFIG.width,
      ITEM_TIER_LIST_MODAL_CONFIG.height
    );
    
    console.log('Item tier list modal displayed successfully');
  } catch (error) {
    console.error('Error showing item tier list:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to generate item tier list. Make sure you are in the game and have access to item data.</p>',
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  }
}

console.log('Item Tier List Mod initialization complete');

// Export control functions
exports = {
  showItemTierList: showItemTierListModal
};

// Cleanup function for Item Tier List mod (exposed for mod system)
exports.cleanup = function() {
  console.log('[Item Tier List] Running cleanup...');
  clearItemTierListModalLayoutCleanup();
  
  // Remove any existing modals
  const existingModal = document.querySelector('#item-tier-list-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Clear any cached data
  if (typeof window.itemTierListState !== 'undefined') {
    delete window.itemTierListState;
  }
  
  console.log('[Item Tier List] Cleanup completed');
}; 
