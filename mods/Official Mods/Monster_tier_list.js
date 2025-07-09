// DOM Tier List Pretty mod for Bestiary Arena
console.log('Tier List Pretty Mod initializing...');

// Create the Tier List button using the API
if (api) {
  console.log('BestiaryModAPI available in Tier List Pretty Mod');
  
  // Create button to show tier list modal
  window.tierListButton = api.ui.addButton({
    id: 'tier-list-button',
    text: 'Monster Tier List',
    tooltip: 'Show monster usage tier list',
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
    
    // Create scrollable container for tier list
    const tierListScroll = api.ui.components.createScrollContainer({
      height: 350,
      padding: true,
      content: ''
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
              
              api.ui.components.createModal({
                title: monsterData.metadata.name || `Monster #${gameId}`,
                width: 300,
                content: contentContainer,
                buttons: [
                  {
                    text: 'Close',
                    primary: true
                  }
                ]
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
    
    // Show the modal with the tier list
    api.ui.components.createModal({
      title: 'Monster Usage Tier List',
      width: 450,
      content: contentContainer,
      buttons: [
        {
          text: 'Close',
          primary: true
        }
      ]
    });
    
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