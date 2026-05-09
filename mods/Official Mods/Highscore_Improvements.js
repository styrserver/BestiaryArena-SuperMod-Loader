// DOM Improved Highscore mod for Bestiary Arena
if (window.DEBUG) console.log('Improved Highscore Mod initializing...');

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Create the Highscore button using the API
if (api) {
  if (window.DEBUG) console.log('BestiaryModAPI available in Improved Highscore Mod');
  
  // Create button to show highscore modal
  window.highscoreButton = api.ui.addButton({
    id: 'highscore-button',
    text: t('mods.highscore.buttonText'),
    tooltip: t('mods.highscore.buttonTooltip'),
    primary: false,
    onClick: showImprovementsModal
  });
  
  if (window.DEBUG) console.log('Highscore improvement button added');
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

// Event maps (dynamic raids) should not count in time/rank improvement stats.
function isCountedRoomForImprovements(roomCode) {
  try {
    const isDynamicEventMap = globalThis.mapsDatabase?.isDynamicEventMap;
    if (typeof isDynamicEventMap === 'function' && isDynamicEventMap(roomCode)) {
      return false;
    }
  } catch (error) {
    console.warn('[Highscore Improvements] Failed to classify room:', roomCode, error);
  }
  return true;
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
          <img 
            alt="${o.name}" 
            class="pixelated size-full object-cover cursor-pointer" 
            src="/assets/room-thumbnails/${o.code}.png" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" />
        </div>
        <div class="grid w-full gap-1">
          <div 
            class="text-whiteExp 
            cursor-pointer" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });">
              ${o.name}
            </div>
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
        <div class="frame-pressed-1 shrink-0 cursor-pointer" style="width: 48px; height: 48px;">
          <img 
            alt="${o.name}" 
            class="pixelated size-full object-cover" 
            src="/assets/room-thumbnails/${o.code}.png" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" />
        </div>
        <div class="grid w-full gap-1">
          <div 
            class="text-whiteExp cursor-pointer"
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" >
              ${o.name}
            </div>
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
    <div style="visibility: hidden;">.</div>
  `;
  
  return {
    scrollContainer,
    statsContainer
  };
}

// Helper function to create HTML content for floor improvements
function createFloorContent(opportunities) {
  const scrollContainer = api.ui.components.createScrollContainer({
    height: 264,
    padding: true,
    content: ''
  });
  
  if (opportunities.length > 0) {
    opportunities.forEach(o => {
      const itemEl = document.createElement('div');
      itemEl.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
      itemEl.innerHTML = `
        <div class="frame-pressed-1 shrink-0 cursor-pointer" style="width: 48px; height: 48px;">
          <img 
            alt="${o.name}" 
            class="pixelated size-full object-cover" 
            src="/assets/room-thumbnails/${o.code}.png" 
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" />
        </div>
        <div class="grid w-full gap-1">
          <div 
            class="text-whiteExp cursor-pointer"
            onclick="globalThis.state.board.send({ type: 'selectRoomById', roomId: '${o.code}' });" >
              ${o.name}
            </div>
          <div class="pixel-font-14">Your ${o.yourFloor}${o.yourFloorTicks !== null ? ` (${o.yourFloorTicks})` : ''} → Top ${o.bestFloor}${o.bestFloorTicks !== null ? ` (${o.bestFloorTicks})` : ''}</div>
          <div class="pixel-font-14" style="color: #8f8;">${o.improvementText}</div>
          <div class="pixel-font-14" style="font-size: 11px; color: #ccc;">by ${o.player}</div>
        </div>
      `;
      scrollContainer.addContent(itemEl);
    });
  } else {
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align: center; color: #eee; padding: 20px;';
    emptyEl.textContent = 'You already have the best floor clear in all rooms!';
    scrollContainer.addContent(emptyEl);
  }
  
  const statsContainer = document.createElement('div');
  statsContainer.className = 'frame-pressed-1 surface-dark p-2 pixel-font-14';
  const floorGain = opportunities.reduce((sum, o) => sum + o.floorDiff, 0);
  const tickGain = opportunities.reduce((sum, o) => sum + Math.max(0, Number(o.tickDiff) || 0), 0);
  statsContainer.innerHTML = `
    <div>Rooms with floor improvement: ${opportunities.length}</div>
    <div>Total floor gain: +${floorGain}</div>
    <div>Same-floor tick gain: ${tickGain} ticks</div>
  `;
  
  return {
    scrollContainer,
    statsContainer
  };
}

// Function to create tabs
function createTabs(tickContent, rankContent, floorContent) {
  const container = document.createElement('div');
  container.className = 'flex flex-col';
  container.style.height = '100%';
  container.style.minHeight = '0';
  
  // Create tab buttons
  const tabButtons = document.createElement('div');
  tabButtons.className = 'flex mb-2';
  
  const tickTabButton = document.createElement('button');
  tickTabButton.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
  tickTabButton.textContent = 'Tick Improvements';
  
  const rankTabButton = document.createElement('button');
  rankTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
  rankTabButton.textContent = 'Rank Improvements';
  
  const floorTabButton = document.createElement('button');
  floorTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
  floorTabButton.textContent = 'Floor Improvements';
  
  tabButtons.appendChild(tickTabButton);
  tabButtons.appendChild(rankTabButton);
  tabButtons.appendChild(floorTabButton);
  
  // Create content containers
  const tickTab = document.createElement('div');
  tickTab.style.display = 'flex';
  tickTab.style.flexDirection = 'column';
  tickTab.style.flex = '1 1 0';
  tickTab.style.minHeight = '0';
  tickTab.appendChild(tickContent.scrollContainer.element);
  
  const separator1 = document.createElement('div');
  separator1.setAttribute('role', 'none');
  separator1.className = 'separator my-2.5';
  tickTab.appendChild(separator1);
  tickTab.appendChild(tickContent.statsContainer);
  
  const rankTab = document.createElement('div');
  rankTab.style.display = 'none';
  rankTab.style.flexDirection = 'column';
  rankTab.style.flex = '1 1 0';
  rankTab.style.minHeight = '0';
  rankTab.appendChild(rankContent.scrollContainer.element);
  
  const separator2 = document.createElement('div');
  separator2.setAttribute('role', 'none');
  separator2.className = 'separator my-2.5';
  rankTab.appendChild(separator2);
  rankTab.appendChild(rankContent.statsContainer);
  
  const floorTab = document.createElement('div');
  floorTab.style.display = 'none';
  floorTab.style.flexDirection = 'column';
  floorTab.style.flex = '1 1 0';
  floorTab.style.minHeight = '0';
  floorTab.appendChild(floorContent.scrollContainer.element);
  
  const separator3 = document.createElement('div');
  separator3.setAttribute('role', 'none');
  separator3.className = 'separator my-2.5';
  floorTab.appendChild(separator3);
  floorTab.appendChild(floorContent.statsContainer);
  
  // Add event listeners to tab buttons
  tickTabButton.addEventListener('click', () => {
    tickTabButton.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
    rankTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    floorTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    tickTab.style.display = 'flex';
    rankTab.style.display = 'none';
    floorTab.style.display = 'none';
  });
  
  rankTabButton.addEventListener('click', () => {
    tickTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    rankTabButton.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
    floorTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    tickTab.style.display = 'none';
    rankTab.style.display = 'flex';
    floorTab.style.display = 'none';
  });
  
  floorTabButton.addEventListener('click', () => {
    tickTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    rankTabButton.className = 'frame-pressed-1 surface-dark px-4 py-1 flex-1';
    floorTabButton.className = 'frame-pressed-1 surface-regular px-4 py-1 flex-1 tab-active';
    tickTab.style.display = 'none';
    rankTab.style.display = 'none';
    floorTab.style.display = 'flex';
  });
  
  // Add everything to the container
  container.appendChild(tabButtons);
  container.appendChild(tickTab);
  container.appendChild(rankTab);
  container.appendChild(floorTab);
  
  return container;
}

// Expand the improvements modal size to fit 3 tabs comfortably.
function expandImprovementsModal(widthPx = 500, heightPx = 500) {
  setTimeout(() => {
    try {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (!dialog) return;
      
      const width = `${widthPx}px`;
      const height = `${heightPx}px`;
      dialog.style.width = width;
      dialog.style.minWidth = width;
      dialog.style.maxWidth = width;
      dialog.style.height = height;
      dialog.style.minHeight = height;
      dialog.style.maxHeight = height;
      dialog.classList.remove('max-w-[300px]');
      
      // Keep inner modal wrappers at full height so tab changes do not resize visual layout.
      const rootWrapper = dialog.querySelector(':scope > div');
      if (rootWrapper) {
        rootWrapper.style.height = '100%';
        rootWrapper.style.display = 'flex';
        rootWrapper.style.flexDirection = 'column';
      }
      
      const widgetBottom = dialog.querySelector('.widget-bottom');
      if (widgetBottom) {
        widgetBottom.style.display = 'flex';
        widgetBottom.style.flexDirection = 'column';
        widgetBottom.style.flex = '1 1 0';
        widgetBottom.style.minHeight = '0';
      }
    } catch (error) {
      console.warn('[Highscore Improvements] Failed to expand modal width:', error);
    }
  }, 50);
}

// Function to show improvement opportunities modal
async function showImprovementsModal() {
  if (window.DEBUG) console.log('Showing improvement opportunities modal...');
  
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
    const yourName = (ctx.name || '').trim().toLowerCase();
    
    // Fetch data from API
    const [best, lbs, roomsHighscores] = await Promise.all([
      fetchTRPC('game.getTickHighscores'),
      fetchTRPC('game.getTickLeaderboards'),
      fetchTRPC('game.getRoomsHighscores')
    ]);
    
    const countedRoomsEntries = Object.entries(rooms).filter(([code]) => isCountedRoomForImprovements(code));

    // Process tick opportunities
    const tickOpportunities = countedRoomsEntries.flatMap(([code, r]) => {
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
    const total = countedRoomsEntries.reduce((s, [, r]) => s + r.ticks, 0);
    const minTheo = countedRoomsEntries.reduce((s, [c, r]) =>
      s + (best[c] ? Math.min(r.ticks, best[c].ticks) : r.ticks), 0);
    const gain = total - minTheo;
    
    // Process rank opportunities
    const rankOpportunities = countedRoomsEntries.flatMap(([code, r]) => {
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
    
    console.log('[Highscore Improvements][Floor Debug] Starting floor opportunity processing');
    console.log('[Highscore Improvements][Floor Debug] roomsHighscores.floor keys:', Object.keys(roomsHighscores?.floor || {}).length);
    
    // Process floor opportunities (higher floor is better; same-floor entries are always shown)
    const floorOpportunities = countedRoomsEntries.flatMap(([code, r]) => {
      const topFloor = roomsHighscores?.floor?.[code];
      if (!topFloor) {
        console.log('[Highscore Improvements][Floor Debug] Skipping room (no public floor WR):', code);
        return [];
      }
      const topFloorName = (topFloor.userName || '').trim().toLowerCase();
      const isOwnFloorWR =
        (topFloor.userId !== undefined && topFloor.userId !== null && topFloor.userId === you) ||
        (topFloorName && yourName && topFloorName === yourName);
      if (isOwnFloorWR) {
        console.log('[Highscore Improvements][Floor Debug] Skipping room (you own floor WR):', code, {
          yourUserId: you,
          topFloorUserId: topFloor.userId,
          yourName: ctx.name,
          topFloorUserName: topFloor.userName
        });
        return [];
      }
      
      const yourFloor = Number.isFinite(Number(r.floor)) ? Number(r.floor) : 0;
      const bestFloor = Number.isFinite(Number(topFloor.floor)) ? Number(topFloor.floor) : 0;
      
      // Match Cyclopedia normalization: floorTicks first, then ticks.
      const yourFloorTicks = Number.isFinite(Number(r.floorTicks))
        ? Number(r.floorTicks)
        : (Number.isFinite(Number(r.ticks)) ? Number(r.ticks) : null);
      const bestFloorTicks = Number.isFinite(Number(topFloor.floorTicks))
        ? Number(topFloor.floorTicks)
        : (Number.isFinite(Number(topFloor.ticks)) ? Number(topFloor.ticks) : null);
      
      const floorDiff = bestFloor - yourFloor;
      const sameFloorTickDelta = (
        floorDiff === 0 &&
        bestFloorTicks !== null &&
        yourFloorTicks !== null
      ) ? (yourFloorTicks - bestFloorTicks) : null;
      const sameFloorTickGain = sameFloorTickDelta !== null && sameFloorTickDelta > 0
        ? sameFloorTickDelta
        : 0;
      
      if (floorDiff < 0) {
        console.log('[Highscore Improvements][Floor Debug] Skipping room (your floor higher than WR floor):', code, {
          yourFloor,
          bestFloor
        });
        return [];
      }
      
      if (floorDiff === 0) {
        console.log('[Highscore Improvements][Floor Debug] Same-floor room:', code, {
          yourFloor,
          bestFloor,
          yourFloorTicks,
          bestFloorTicks,
          sameFloorTickDelta,
          userRoomRaw: {
            floor: r.floor,
            floorTicks: r.floorTicks,
            ticks: r.ticks
          },
          topFloorRaw: {
            floor: topFloor.floor,
            floorTicks: topFloor.floorTicks
          },
          tickWRRaw: best[code] ? {
            ticks: best[code].ticks,
            userName: best[code].userName
          } : null
        });
      }
      
      let improvementText;
      if (floorDiff > 0) {
        improvementText = `+${floorDiff} floor${floorDiff > 1 ? 's' : ''}`;
      } else if (sameFloorTickDelta === null) {
        improvementText = 'Ticks unavailable';
      } else if (sameFloorTickDelta > 0) {
        improvementText = `${sameFloorTickDelta} ticks`;
      } else if (sameFloorTickDelta < 0) {
        improvementText = `${Math.abs(sameFloorTickDelta)} ticks ahead`;
      } else {
        improvementText = 'Tied ticks';
      }
      
      return [{
        code,
        name: ROOM_NAMES[code] || code,
        yourFloor,
        yourFloorTicks,
        bestFloor,
        bestFloorTicks,
        floorDiff,
        tickDiff: sameFloorTickGain,
        improvementText,
        player: topFloor.userName
      }];
    }).sort((a, b) => {
      if (b.floorDiff !== a.floorDiff) return b.floorDiff - a.floorDiff;
      return b.tickDiff - a.tickDiff;
    });
    
    console.log('[Highscore Improvements][Floor Debug] Final floor opportunities:', floorOpportunities.length);
    console.log(
      '[Highscore Improvements][Floor Debug] Same-floor entries:',
      floorOpportunities.filter(o => o.floorDiff === 0).length
    );
    
    // Close loading modal
    loadingModal();
    
    // Create content for all tabs
    const tickContent = createTickContent(tickOpportunities, total, minTheo, gain);
    const rankContent = createRankContent(rankOpportunities);
    const floorContent = createFloorContent(floorOpportunities);
    
    // Create tabbed interface
    const tabbedContent = createTabs(tickContent, rankContent, floorContent);
    
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
    
    expandImprovementsModal(500, 500);
    
    if (window.DEBUG) console.log('Improvement opportunities modal displayed successfully');
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

if (window.DEBUG) console.log('Improved Highscore Mod initialization complete');

// Export control functions
exports = {
  showImprovements: showImprovementsModal
};

// Cleanup function for Highscore Improvements mod (exposed for mod system)
exports.cleanup = function() {
  console.log('[Highscore Improvements] Running cleanup...');
  
  // Clear any cached data
  if (typeof ROOM_NAMES !== 'undefined') {
    ROOM_NAMES = null;
  }
  
  // Remove any existing modals
  const existingModal = document.querySelector('#highscore-improvements-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Clear any global state
  if (typeof window.highscoreImprovementsState !== 'undefined') {
    delete window.highscoreImprovementsState;
  }
  
  console.log('[Highscore Improvements] Cleanup completed');
}; 