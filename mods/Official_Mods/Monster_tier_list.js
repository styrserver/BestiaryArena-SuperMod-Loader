// DOM Tier List Pretty mod for Bestiary Arena
console.log('Tier List Pretty Mod initializing...');

const MONSTER_TIER_LIST_MODAL_CONFIG = {
  width: 450,
  height: 450,
  detailWidth: 300,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 240
};

let monsterTierListModalLayoutCleanup = null;

function getMonsterTierListModalDimensions(maxWidth, maxHeight, minHeight = MONSTER_TIER_LIST_MODAL_CONFIG.minHeight) {
  const pad = MONSTER_TIER_LIST_MODAL_CONFIG.viewportPadding * 2;
  const dims = {
    width: Math.max(
      MONSTER_TIER_LIST_MODAL_CONFIG.minWidth,
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

function getMonsterTierListDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearMonsterTierListModalLayoutCleanup() {
  if (monsterTierListModalLayoutCleanup) {
    monsterTierListModalLayoutCleanup();
    monsterTierListModalLayoutCleanup = null;
  }
}

function applyMonsterTierListModalLayout(modalRef, contentRoot, scrollContainer, maxWidth, maxHeight) {
  const dialog = getMonsterTierListDialog(modalRef);
  if (!dialog) return;

  const hasFixedHeight = maxHeight !== null && maxHeight !== undefined;
  const dims = getMonsterTierListModalDimensions(maxWidth, hasFixedHeight ? maxHeight : null);

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

function setupMonsterTierListModalResponsiveLayout(modalRef, contentRoot, scrollContainer, maxWidth, maxHeight) {
  clearMonsterTierListModalLayoutCleanup();

  const apply = () => applyMonsterTierListModalLayout(modalRef, contentRoot, scrollContainer, maxWidth, maxHeight);
  requestAnimationFrame(() => apply());

  const onResize = () => apply();
  window.addEventListener('resize', onResize);

  let modalCloseObserver = null;
  const dialog = getMonsterTierListDialog(modalRef);
  if (dialog) {
    modalCloseObserver = new MutationObserver(() => {
      if (!document.contains(dialog) || dialog.getAttribute('data-state') === 'closed') {
        clearMonsterTierListModalLayoutCleanup();
      }
    });
    modalCloseObserver.observe(dialog, { attributes: true, attributeFilter: ['data-state'] });
    modalCloseObserver.observe(document.body, { childList: true, subtree: true });
  }

  monsterTierListModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (modalCloseObserver) {
      modalCloseObserver.disconnect();
      modalCloseObserver = null;
    }
  };
}

function openMonsterTierListDetailModal({ title, content }) {
  const { width } = getMonsterTierListModalDimensions(MONSTER_TIER_LIST_MODAL_CONFIG.detailWidth, null);
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
  console.log('BestiaryModAPI available in Tier List Pretty Mod');
  
  // Create button to show tier list modal
  window.tierListButton = api.ui.addButton({
    id: 'tier-list-button',
    text: t('mods.tierList.buttonText'),
    tooltip: t('mods.tierList.buttonTooltip'),
    primary: false,
    onClick: showTierListModal
  });
  
  console.log('Tier List button added');
} else {
  console.error('BestiaryModAPI not available in Tier List Pretty Mod');
}

// Function to show tier list modal
function showTierListModal() {
  console.log('Showing tier list modal...');
  clearMonsterTierListModalLayoutCleanup();

  try {
    const { monsters, boardConfigs } = globalThis.state.player.getSnapshot().context;
    const monsterLookup = new Map(monsters.map(m => [m.id, m.gameId]));
    const countMap = new Map();

    Object.values(boardConfigs).forEach(cfgs =>
      cfgs.forEach(({ monsterId }) => {
        if (monsterId != null) {
          const gid = monsterLookup.get(monsterId);
          if (gid != null) countMap.set(gid, (countMap.get(gid) || 0) + 1);
        }
      })
    );

    const total = Array.from(countMap.values()).reduce((a, b) => a + b, 0);
    const list = Array.from(countMap.entries())
      .map(([gameId, cnt]) => ({
        gameId,
        count: cnt,
        pct: Math.floor((cnt / total) * 100)
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
      
      // Create monster container
      const monsterContainer = document.createElement('div');
      monsterContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px;';
      
      // Add monster portraits for this tier
      chunk.forEach(({ gameId, count }) => {
        const monsterWrapper = document.createElement('div');
        monsterWrapper.style.cssText = 'position: relative; width: 34px; height: 34px;';
        
        // Use the monster portrait component
        const monsterPortrait = api.ui.components.createMonsterPortrait({
          monsterId: gameId,
          level: count, // Use count as the "level" to display
          tier: Math.min(5, Math.max(1, Math.ceil(count / 3))), // Scale tier from 1-5 based on count
          onClick: () => {
            // Show monster details when clicked
            const monsterData = globalThis.state.utils.getMonster(gameId);
            if (monsterData && monsterData.metadata) {
              const contentContainer = document.createElement('div');
              
              // Create wrapper for centering and proper sizing
              const centerContainer = document.createElement('div');
              centerContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin-bottom: 20px;';
              
              // Use createFullMonster for the monster display in modal
              const fullMonster = api.ui.components.createFullMonster({
                monsterId: gameId,
                tier: Math.min(5, Math.max(1, Math.ceil(count / 3))),
                starTier: Math.min(4, Math.ceil(count / 3)), // Scale star tier from 1-4
                level: count,
                size: 'small' // Use small size for the modal
              });
              
              centerContainer.appendChild(fullMonster);
              contentContainer.appendChild(centerContainer);
              
              // Add usage stats
              const statsContainer = document.createElement('div');
              statsContainer.innerHTML = `
                <p>Used ${count} times in your saved configurations.</p>
                <p>Usage percentage: ${Math.floor((count / total) * 100)}%</p>
              `;
              contentContainer.appendChild(statsContainer);
              
              openMonsterTierListDetailModal({
                title: monsterData.metadata.name || `Monster #${gameId}`,
                content: contentContainer
              });
            }
          }
        });
        
        monsterWrapper.appendChild(monsterPortrait);
        monsterContainer.appendChild(monsterWrapper);
      });
      
      // Add tier content to the scroll container
      tierListScroll.addContent(tierHeader);
      tierListScroll.addContent(monsterContainer);
    });
    
    // Add scroll container to content container
    contentContainer.appendChild(tierListScroll.element);
    
    const modalDims = getMonsterTierListModalDimensions(
      MONSTER_TIER_LIST_MODAL_CONFIG.width,
      MONSTER_TIER_LIST_MODAL_CONFIG.height
    );

    const modal = api.ui.components.createModal({
      title: 'Monster Usage Tier List',
      width: modalDims.width,
      height: modalDims.height,
      content: contentContainer,
      buttons: [
        {
          text: 'Close',
          primary: true,
          onClick: () => clearMonsterTierListModalLayoutCleanup()
        }
      ]
    });

    setupMonsterTierListModalResponsiveLayout(
      modal,
      contentContainer,
      tierListScroll,
      MONSTER_TIER_LIST_MODAL_CONFIG.width,
      MONSTER_TIER_LIST_MODAL_CONFIG.height
    );
    
    console.log('Tier list modal displayed successfully');
  } catch (error) {
    console.error('Error showing tier list:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to generate tier list. Make sure you are in the game and have access to monster data.</p>',
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  }
}

console.log('Tier List Mod initialization complete');

// Export control functions
exports = {
  showTierList: showTierListModal
};

// Cleanup function for Monster Tier List mod (exposed for mod system)
exports.cleanup = function() {
  console.log('[Monster Tier List] Running cleanup...');
  clearMonsterTierListModalLayoutCleanup();
  
  // Remove any existing modals
  const existingModal = document.querySelector('#tier-list-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Clear any cached data
  if (typeof window.monsterTierListState !== 'undefined') {
    delete window.monsterTierListState;
  }
  
  console.log('[Monster Tier List] Cleanup completed');
}; 
