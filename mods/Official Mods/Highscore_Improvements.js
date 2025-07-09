// DOM Improved Highscore mod for Bestiary Arena
console.log('Improved Highscore Mod initializing...');

// Create the Highscore button using the API
if (api) {
  console.log('BestiaryModAPI available in Improved Highscore Mod');
  
  // Create button to show highscore modal
  window.highscoreButton = api.ui.addButton({
    id: 'highscore-button',
    text: 'Highscore Improvements',
    tooltip: 'Show potential tick and rank improvements',
    primary: false,
    onClick: showImprovementsModal
  });
  
  console.log('Highscore improvement button added');
} else {
  console.error('BestiaryModAPI not available in Improved Highscore Mod');
}

// Map of room codes to names
let ROOM_NAMES;

// Helper function to fetch data from TRPC API
async function fetchTRPC(method) {
  try {
    const inp = encodeURIComponent(JSON.stringify({ 0: { json: null, meta: { values: ["undefined"] } } }));
    const res = await fetch(`/pt/api/trpc/${method}?batch=1&input=${inp}`, {
      headers: { 
        'Accept': '*/*', 
        'Content-Type': 'application/json', 
        'X-Game-Version': '1' 
      }
    });
    
    if (!res.ok) {
      throw new Error(`${method} → ${res.status}`);
    }
    
    const json = await res.json();
    return json[0].result.data.json;
  } catch (error) {
    console.error('Error fetching from TRPC:', error);
    throw error;
  }
}

// Helper function to create an item sprite element
function createItemSprite(itemId) {
  // Create the sprite container
  const spriteContainer = document.createElement('div');
  spriteContainer.className = `sprite item relative id-${itemId}`;
  
  // Create the viewport
  const viewport = document.createElement('div');
  viewport.className = 'viewport';
  
  // Create the image
  const img = document.createElement('img');
  img.alt = itemId;
  img.setAttribute('data-cropped', 'false');
  img.className = 'spritesheet';
  img.style.cssText = '--cropX: 0; --cropY: 0';
  
  // Assemble the structure
  viewport.appendChild(img);
  spriteContainer.appendChild(viewport);
  
  return spriteContainer;
}

// Helper function to create HTML content for tick improvements
function createTickContent(opportunities, total, minTheo, gain) {
  // Create scrollable container using the API
  const scrollContainer = api.ui.components.createScrollContainer({
    height: 264,
    padding: true,
    content: ''
  });
  
  // Add opportunities list
  if (opportunities.length > 0) {
    opportunities.forEach(o => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      itemEl.innerHTML = `
        <div class="frame-pressed-1 shrink-0" style="width: 48px; height: 48px;">
          <img alt="${o.name}" class="pixelated size-full object-cover" src="/assets/room-thumbnails/${o.code}.png" />
        </div>
        <div class="grid w-full gap-1">
          <div class="text-whiteExp">${o.name}</div>
          <div class="pixel-font-14">Your ${o.yours} → Top ${o.best}</div>
          <div class="pixel-font-14" style="color: #8f8;">+${o.diff} ticks (${o.pct}%)</div>
          <div class="pixel-font-14" style="font-size: 11px; color: #ccc;">by ${o.player}</div>
        </div>
      `;
      scrollContainer.addContent(itemEl);
    });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
    emptyEl.textContent = 'You are already at the top in all rooms!';
    scrollContainer.addContent(emptyEl);
  }
  
  // Add stats footer
  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  statsContainer.innerHTML = `
    <div>Total: ${total}</div>
    <div>Theoretical minimum: ${minTheo}</div>
    <div>Possible gain: ${gain} ticks</div>
  `;
  
  return {
    scrollContainer,
    statsContainer
  };
}

// Helper function to create HTML content for rank improvements
function createRankContent(opportunities) {
  // Create scrollable container using the API
  const scrollContainer = api.ui.components.createScrollContainer({
    height: 264,
    padding: true,
    content: ''
  });
  
  // Add opportunities list
  if (opportunities.length > 0) {
    opportunities.forEach(o => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      itemEl.innerHTML = `
        <div class="frame-pressed-1 shrink-0" style="width: 48px; height: 48px;">
          <img alt="${o.name}" class="pixelated size-full object-cover" src="/assets/room-thumbnails/${o.code}.png" />
        </div>
        <div class="grid w-full gap-1">
          <div class="text-whiteExp">${o.name}</div>
          <div class="pixel-font-14">Your score ${o.yourScore} → Top ${o.bestScore}</div>
          <div class="pixel-font-14" style="color: #8f8;">+${o.diff} rank points</div>
          <div class="pixel-font-14" style="font-size: 11px; color: #ccc;">by ${o.player}</div>
        </div>
      `;
      scrollContainer.addContent(itemEl);
    });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
    emptyEl.textContent = 'You already have the maximum rank score in all rooms!';
    scrollContainer.addContent(emptyEl);
  }
  
  // Add stats footer
  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  statsContainer.innerHTML = `
    <div>Rooms with score improvement: ${opportunities.length}</div>
    <div>Total rank points to gain: ${opportunities.reduce((sum, o) => sum + o.diff, 0)}</div>
  `;
  
  return {
    scrollContainer,
    statsContainer
  };
}

// Function to create tabs
function createTabs(tickContent, rankContent) {
  const container = document.createElement('div');
  container.className = 'flex flex-col';
  
  // Create tab buttons
  const tabButtons = document.createElement('div');
  tabButtons.className = 'flex mb-2';
  
  const tickTabButton = document.createElement('button');
  tickTabButton.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
  tickTabButton.textContent = 'Tick Improvements';
  
  const rankTabButton = document.createElement('button');
  rankTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
  rankTabButton.textContent = 'Rank Improvements';
  
  tabButtons.appendChild(tickTabButton);
  tabButtons.appendChild(rankTabButton);
  
  // Create content containers
  const tickTab = document.createElement('div');
  tickTab.style.display = 'flex';
  tickTab.style.flexDirection = 'column';
  tickTab.appendChild(tickContent.scrollContainer.element);
  
  const separator1 = document.createElement('div');
  separator1.setAttribute('role', 'none');
  separator1.className = 'separator my-2.5';
  tickTab.appendChild(separator1);
  tickTab.appendChild(tickContent.statsContainer);
  
  const rankTab = document.createElement('div');
  rankTab.style.display = 'none';
  rankTab.style.flexDirection = 'column';
  rankTab.appendChild(rankContent.scrollContainer.element);
  
  const separator2 = document.createElement('div');
  separator2.setAttribute('role', 'none');
  separator2.className = 'separator my-2.5';
  rankTab.appendChild(separator2);
  rankTab.appendChild(rankContent.statsContainer);
  
  // Add event listeners to tab buttons
  tickTabButton.addEventListener('click', () => {
    tickTabButton.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
    rankTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    tickTab.style.display = 'flex';
    rankTab.style.display = 'none';
  });
  
  rankTabButton.addEventListener('click', () => {
    tickTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    rankTabButton.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
    tickTab.style.display = 'none';
    rankTab.style.display = 'flex';
  });
  
  // Add everything to the container
  container.appendChild(tabButtons);
  container.appendChild(tickTab);
  container.appendChild(rankTab);
  
  return container;
}

// Function to show improvement opportunities modal
async function showImprovementsModal() {
  console.log('Showing improvement opportunities modal...');
  
  try {
    ROOM_NAMES = globalThis.state.utils.ROOM_NAME;
    
    // Show loading modal
    const loadingModal = api.showModal({
      title: '🏆 Improvement Opportunities',
      content: '<div style="text-align: center; padding: 20px;">Loading data...</div>',
      buttons: []
    });
    
    // Get player context and fetch highscores data
    const ctx = globalThis.state.player.getSnapshot().context;
    const rooms = ctx.rooms;
    const you = ctx.userId;
    
    // Fetch data from API
    const [best, lbs, roomsHighscores] = await Promise.all([
      fetchTRPC('game.getTickHighscores'),
      fetchTRPC('game.getTickLeaderboards'),
      fetchTRPC('game.getRoomsHighscores')
    ]);
    
    // Process tick opportunities
    const tickOpportunities = Object.entries(rooms).flatMap(([code, r]) => {
      const b = best[code];
      if (!b) return [];
      const d = r.ticks - b.ticks;
      if (d <= 0 || b.userId === you) return [];
      return [{
        code, 
        name: ROOM_NAMES[code] || code, 
        yours: r.ticks, 
        best: b.ticks, 
        diff: d, 
        pct: ((d / r.ticks) * 100).toFixed(1), 
        player: b.userName
      }];
    }).sort((a, b) => b.diff - a.diff);
    
    // Calculate tick totals
    const total = Object.values(rooms).reduce((s, r) => s + r.ticks, 0);
    const minTheo = Object.entries(rooms).reduce((s, [c, r]) => 
      s + (best[c] ? Math.min(r.ticks, best[c].ticks) : r.ticks), 0);
    const gain = total - minTheo;
    
    // Process rank opportunities
    const rankOpportunities = Object.entries(rooms).flatMap(([code, r]) => {
      // Skip if no rank data for this room or room has no rank property
      if (!r.rank) return [];
      
      // Get top rank for this room
      const topRank = roomsHighscores?.rank?.[code];
      if (!topRank || topRank.userId === you || topRank.rank <= r.rank) return [];
      
      return [{
        code,
        name: ROOM_NAMES[code] || code,
        yourScore: r.rank,
        bestScore: topRank.rank,
        diff: topRank.rank - r.rank,
        player: topRank.userName
      }];
    }).sort((a, b) => b.diff - a.diff);
    
    // Close loading modal
    loadingModal();
    
    // Create content for both tabs
    const tickContent = createTickContent(tickOpportunities, total, minTheo, gain);
    const rankContent = createRankContent(rankOpportunities);
    
    // Create tabbed interface
    const tabbedContent = createTabs(tickContent, rankContent);
    
    // Show the new modal
    api.showModal({
      title: '🏆 Improvement Opportunities',
      content: tabbedContent,
      buttons: [
        {
          text: 'Close',
          primary: true
        }
      ]
    });
    
    console.log('Improvement opportunities modal displayed successfully');
  } catch (error) {
    console.error('Error showing improvement opportunities:', error);
    
    // Show error modal
    api.showModal({
      title: 'Error',
      content: '<p>Failed to load improvement opportunities. Please try again later.</p><p style="color: #999; font-size: 12px;">Error: ' + error.message + '</p>',
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  }
}

console.log('Improved Highscore Mod initialization complete');

// Export control functions
exports = {
  showImprovements: showImprovementsModal
}; 