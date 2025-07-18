// UI Components Showcase Mod for Bestiary Arena
console.log('UI Components Showcase Mod initializing...');

// Create the showcase button using the API
if (api) {
  console.log('BestiaryModAPI available in UI Components Showcase Mod');
  
  // Create button to show the showcase
  api.ui.addButton({
    id: 'ui-components-showcase-button',
    text: 'UI Showcase',
    tooltip: 'Show UI components showcase',
    primary: false,
    onClick: showUIComponentsShowcase
  });
  
  console.log('UI Components Showcase button added');
} else {
  console.error('BestiaryModAPI not available in UI Components Showcase Mod');
}

// Function to show the UI components showcase
function showUIComponentsShowcase() {
  console.log('Showing UI components showcase...');
  
  // Create the main container
  const mainContainer = document.createElement('div');
  
  // Create navigation breadcrumb
  const navBreadcrumb = api.ui.components.createNavBreadcrumb({
    paths: ['Home', 'UI Components', 'Showcase'],
    onBack: () => {
      console.log('Back button clicked');
    }
  });
  mainContainer.appendChild(navBreadcrumb);
  
  // Create a scrollable container for the showcase
  const showcaseScroll = api.ui.components.createScrollContainer({
    height: 400,
    padding: true,
    content: ''
  });
  
  // Section: Monster Portraits
  const monsterHeader = document.createElement('h3');
  monsterHeader.textContent = 'Monster Portraits';
  monsterHeader.style.cssText = 'margin: 16px 0 8px; font-size: 1.2rem; border-bottom: 1px solid #444; padding-bottom: 4px; color: white;';
  
  const monsterContainer = document.createElement('div');
  monsterContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;';
  
  // Add different monsters with different tiers
  for (let i = 1; i <= 5; i++) {
    // Use monsters with IDs 1-5 (rat, minotaur, etc.) with different tiers
    const monsterPortrait = api.ui.components.createMonsterPortrait({
      monsterId: i,
      level: 10 * i,
      tier: i,
      onClick: () => showMonsterInfo(i)
    });
    
    monsterContainer.appendChild(monsterPortrait);
  }
  
  // Section: Item Portraits
  const itemHeader = document.createElement('h3');
  itemHeader.textContent = 'Item Portraits';
  itemHeader.style.cssText = 'margin: 16px 0 8px; font-size: 1.2rem; border-bottom: 1px solid #444; padding-bottom: 4px; color: white;';
  
  const itemContainer = document.createElement('div');
  itemContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;';
  
  // Common item sprite IDs
  const itemSprites = [3079, 3567, 3320, 3436, 3434];
  const statTypes = ['ad', 'ap', 'hp'];
  
  // Add different items with different stats and tiers
  for (let i = 0; i < 5; i++) {
    const itemPortrait = api.ui.components.createItemPortrait({
      itemId: itemSprites[i],
      stat: statTypes[i % 3],
      tier: (i % 5) + 1,
      onClick: () => showItemInfo(itemSprites[i], statTypes[i % 3])
    });
    
    itemContainer.appendChild(itemPortrait);
  }
  
  // Section: Room List Items
  const roomHeader = document.createElement('h3');
  roomHeader.textContent = 'Room List Items';
  roomHeader.style.cssText = 'margin: 16px 0 8px; font-size: 1.2rem; border-bottom: 1px solid #444; padding-bottom: 4px; color: white;';
  
  // Sample room data
  const rooms = [
    { id: 'rkswrs', name: 'Sewers', rank: 'S+', points: 10, time: '0:08', ticks: 130 },
    { id: 'rkwht', name: 'Wheat Field', rank: 'A', points: 7, time: '0:15', ticks: 225 },
    { id: 'molst', name: 'Teleporter Trap', rank: 'B', points: 5, time: '0:20', ticks: 300 }
  ];
  
  // Add all sections to the scroll container
  showcaseScroll.addContent(monsterHeader);
  showcaseScroll.addContent(monsterContainer);
  showcaseScroll.addContent(itemHeader);
  showcaseScroll.addContent(itemContainer);
  showcaseScroll.addContent(roomHeader);
  
  // Add room list items
  for (const room of rooms) {
    const roomItem = api.ui.components.createRoomListItem({
      roomId: room.id,
      name: room.name,
      rank: { grade: room.rank, points: room.points },
      personalTime: { display: room.time, ticks: room.ticks },
      worldTime: { display: room.time, ticks: room.ticks },
      onClick: () => showRoomInfo(room)
    });
    
    showcaseScroll.addContent(roomItem);
  }
  
  // Add the scroll container to the main container
  mainContainer.appendChild(showcaseScroll.element);
  
  // Create a section for buttons
  const buttonsHeader = document.createElement('h3');
  buttonsHeader.textContent = 'Modal Dialog Test';
  buttonsHeader.style.cssText = 'margin: 16px 0 8px; font-size: 1.2rem; color: white;';
  
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = 'display: flex; gap: 8px; margin: 8px 0;';
  
  // Create test buttons
  const primaryButton = document.createElement('button');
  primaryButton.textContent = 'Show Test Modal';
  primaryButton.className = 'focus-style-visible frame-1 active:frame-pressed-1 surface-regular pixel-font-14';
  primaryButton.style.cssText = 'padding: 4px 8px; color: white; cursor: pointer; background-color: #4CAF50;';
  primaryButton.addEventListener('click', showTestModal);
  
  const secondaryButton = document.createElement('button');
  secondaryButton.textContent = 'Close';
  secondaryButton.className = 'focus-style-visible frame-1 active:frame-pressed-1 surface-regular pixel-font-14';
  secondaryButton.style.cssText = 'padding: 4px 8px; color: white; cursor: pointer;';
  
  buttonsContainer.appendChild(primaryButton);
  buttonsContainer.appendChild(secondaryButton);
  
  mainContainer.appendChild(buttonsHeader);
  mainContainer.appendChild(buttonsContainer);
  
  // Show the main showcase modal
  api.ui.components.createModal({
    title: 'UI Components Showcase',
    width: 500,
    content: mainContainer,
    buttons: [
      {
        text: 'Close',
        primary: true
      }
    ]
  });
  
  console.log('UI components showcase displayed successfully');
}

// Show information about a monster
function showMonsterInfo(monsterId) {
  try {
    const monsterData = globalThis.state.utils.getMonster(monsterId);
    const name = monsterData?.metadata?.name || `Monster #${monsterId}`;
    
    // Create a container for the modal content
    const contentContainer = document.createElement('div');
    
    // Create a wrapper for the monster portrait with better dimensions
    const portraitContainer = document.createElement('div');
    portraitContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin-bottom: 15px;';
    
    // Get sprite ID and portrait translate from metadata
    const spriteId = monsterData?.metadata?.spriteId || monsterId;
    const portraitTranslate = monsterData?.metadata?.portraitTranslate || '-3px -8px';
    
    // Use createFullMonster with small size for better fit
    const fullMonster = api.ui.components.createFullMonster({
      monsterId: monsterId,
      tier: 3,
      starTier: 2,
      level: 50,
      size: 'small', // Use small size to fit better in the modal
      spriteId: spriteId
    });
    
    // Find and update the sprite outfit element with the correct translation
    try {
      const spriteOutfit = fullMonster.querySelector('.sprite.outfit');
      if (spriteOutfit) {
        spriteOutfit.style.translate = portraitTranslate;
      }
    } catch (e) {
      console.error('Error updating sprite translation:', e);
    }
    
    // Add a wrapper to fix the centering issue
    const centeringWrapper = document.createElement('div');
    centeringWrapper.style.cssText = 'display: flex; justify-content: center; align-items: center; width: 100%;';
    centeringWrapper.appendChild(fullMonster);
    
    portraitContainer.appendChild(centeringWrapper);
    contentContainer.appendChild(portraitContainer);
    
    // Add monster stats section
    const statsContainer = document.createElement('div');
    statsContainer.innerHTML = `
      <h3>Monster Statistics</h3>
      <p>Base HP: ${monsterData?.metadata?.baseStats?.hp || 'Unknown'}</p>
      <p>Base AD: ${monsterData?.metadata?.baseStats?.ad || 'Unknown'}</p>
      <p>Base AP: ${monsterData?.metadata?.baseStats?.ap || 'Unknown'}</p>
      <p>Roles: ${monsterData?.metadata?.roles?.join(', ') || 'Unknown'}</p>
    `;
    contentContainer.appendChild(statsContainer);
    
    api.ui.components.createModal({
      title: name,
      width: 300,
      content: contentContainer,
      buttons: [
        {
          text: 'Close',
          primary: true
        }
      ]
    });
  } catch (error) {
    console.error('Error showing monster info:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to load monster information.</p>',
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  }
}

// Show information about an item
function showItemInfo(itemId, stat) {
  // Create a container for the modal content
  const contentContainer = document.createElement('div');
  
  // Create a wrapper for the item portrait with better dimensions
  const portraitContainer = document.createElement('div');
  portraitContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin-bottom: 15px;';
  
  // Use createFullItem with small size for better fit
  const fullItem = api.ui.components.createFullItem({
    itemId: itemId,
    stat: stat,
    tier: 3,
    animated: false,
    size: 'small' // Use small size to fit better in the modal
  });
  
  portraitContainer.appendChild(fullItem);
  contentContainer.appendChild(portraitContainer);
  
  // Add item details section
  const detailsContainer = document.createElement('div');
  detailsContainer.innerHTML = `
    <h3>Item Details</h3>
    <p>Item ID: ${itemId}</p>
    <p>Stat Type: ${stat.toUpperCase()}</p>
    <p>This is a showcase item used to demonstrate the UI components.</p>
  `;
  contentContainer.appendChild(detailsContainer);
  
  api.ui.components.createModal({
    title: 'Item Information',
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

// Show information about a room
function showRoomInfo(room) {
  api.ui.components.createModal({
    title: room.name,
    width: 350,
    content: `
      <div style="text-align: center; margin-bottom: 10px;">
        <img src="/assets/room-thumbnails/${room.id}.png" alt="${room.name}" style="width: 200px; height: 150px; object-fit: cover;"/>
      </div>
      <div>
        <h3>Room Details</h3>
        <p>ID: ${room.id}</p>
        <p>Rank: ${room.rank} (${room.points} points)</p>
        <p>Best Time: ${room.time} (${room.ticks} ticks)</p>
        <p>This is a showcase room used to demonstrate the UI components.</p>
      </div>
    `,
    buttons: [
      {
        text: 'Close',
        primary: true
      }
    ]
  });
}

// Show a test modal with multiple buttons
function showTestModal() {
  api.ui.components.createModal({
    title: 'Test Modal',
    width: 350,
    content: `
      <p>This is a test modal to demonstrate the modal component.</p>
      <p>It has multiple buttons with different actions.</p>
      <p>Try clicking the buttons to see what they do!</p>
    `,
    buttons: [
      {
        text: 'OK',
        primary: true,
        onClick: () => console.log('OK clicked')
      },
      {
        text: 'Cancel',
        primary: false,
        onClick: () => console.log('Cancel clicked')
      },
      {
        text: 'Don\'t Close',
        primary: false,
        onClick: () => {
          console.log('Don\'t Close clicked');
          api.ui.components.createModal({
            title: 'Still Open',
            content: '<p>The previous modal is still open!</p>',
            buttons: [
              {
                text: 'Got it',
                primary: true
              }
            ]
          });
        },
        closeOnClick: false
      }
    ]
  });
}

console.log('UI Components Showcase Mod initialization complete');

// Export functionality
exports = {
  showShowcase: showUIComponentsShowcase
}; 