// Guilds Mod
console.log('Guilds Mod initializing...');

// Global cache for guilds and portraits
let cachedGuilds = null;
let cachedPortraits = null;

async function fetchGuildsFromWiki() {
  const apiUrl = 'https://bestiaryarena.wiki.gg/api.php?action=query&prop=revisions&titles=Guilds&rvslots=*&rvprop=content&formatversion=2&format=json&origin=*';
  const response = await fetch(apiUrl);
  const data = await response.json();
  const wikitext = data.query.pages[0].revisions[0].slots.main.content;

  // Extract the first wikitable
  const tableMatch = wikitext.match(/\{\|[\s\S]*?\|\}/);
  if (!tableMatch) return [];
  const table = tableMatch[0];
  const rows = table.split('|-').slice(1); // skip header row

  const guilds = rows.map(row => {
    const cols = row.split('|').map(s => s.trim()).filter(Boolean);
    if (cols.length < 3) return null;
    return {
      name: cols[0],
      leader: cols[1],
      members: isNaN(parseInt(cols[2], 10)) ? 0 : parseInt(cols[2], 10)
    };
  }).filter(Boolean);
  return guilds;
}

async function showGuildsModal(selectedGuild = null, guildPortraits = null) {
  // Wait for guilds to be loaded if not already
  if (!cachedGuilds) {
    cachedGuilds = await fetchGuildsFromWiki();
    // Assign random portraits (1-61) for each guild
    cachedPortraits = cachedGuilds.map(() => Math.floor(Math.random() * 61) + 1);
  }
  const guilds = cachedGuilds;
  guildPortraits = cachedPortraits;

  // If a guild is selected, show its details
  if (selectedGuild) {
    // Find the portrait number for this guild
    const idx = guilds.findIndex(g => g.name === selectedGuild.name);
    const portraitNum = guildPortraits[idx];
    const container = document.createElement('div');
    container.style.padding = '24px';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.boxSizing = 'border-box';

    // Prepare member list HTML
    let membersListHtml = '';
    if (Array.isArray(selectedGuild.members)) {
      membersListHtml = selectedGuild.members.map(x => `<li>${x}</li>`).join('');
    } else {
      membersListHtml = '<li>No member list available</li>';
    }
    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:16px;">
        <div class="container-slot surface-darker" style="width:64px; height:64px; display:grid; place-items:center; margin-bottom:8px;">
          <div class="has-rarity relative grid h-full place-items-center" style="width:64px; height:64px;">
            <img class="pixelated ml-auto" alt="creature" width="64" height="64" src="/assets/portraits/${portraitNum}.png" />
          </div>
        </div>
        <div style="font-size:22px; font-weight:bold; margin-bottom:16px;">${selectedGuild.name}</div>
      </div>
      <div style="margin-bottom:8px;"><b>Leader:</b> ${selectedGuild.leader}</div>
      <div style="margin-bottom:8px;"><b>Members:</b> ${selectedGuild.members}</div>
      <div style="font-weight:bold; margin-top:16px;">Members List:</div>
      <ul style="margin: 8px 0 0 16px; padding: 0;">
        ${membersListHtml}
      </ul>
    `;
    api.ui.components.createModal({
      title: 'Guild Details',
      width: 600,
      height: 600,
      content: container,
      buttons: [
        { text: 'Close', primary: true }
      ]
    });
    setTimeout(() => {
      const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
      if (dialog) {
        dialog.classList.remove('max-w-[300px]');
        dialog.style.width = '600px';
        dialog.style.minWidth = '600px';
        dialog.style.maxWidth = '600px';
        dialog.style.height = '600px';
        dialog.style.minHeight = '600px';
        dialog.style.maxHeight = '600px';
      }
    }, 10);
    return;
  }

  // Otherwise, show the list of guilds
  // Use a scroll container for the list
  const listContent = document.createElement('div');
  listContent.style.width = '100%';
  listContent.style.boxSizing = 'border-box';
  listContent.style.fontFamily = 'inherit';

  // Add custom styles for better UI
  const style = document.createElement('style');
  style.textContent = `
    .guilds-table-header {
      display: flex;
      font-weight: bold;
      background: #444;
      color: #fff;
      border-bottom: 2px solid #fff;
      padding: 12px 0 10px 0;
      font-size: 16px;
      font-family: 'Satoshi', 'Consolas', 'Arial', sans-serif;
      letter-spacing: 0.5px;
    }
    .guilds-table-row {
      display: flex;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid #888;
      font-size: 14px;
      font-family: 'Satoshi', 'Consolas', 'Arial', sans-serif;
      transition: background 0.2s;
    }
    .guilds-table-row:nth-child(even) {
      background: #353535;
    }
    .guilds-table-row:hover {
      background: #222;
    }
    .guilds-table-cell {
      font-family: 'Satoshi', 'Consolas', 'Arial', sans-serif;
    }
    .guilds-table-cell.members {
      flex: 1.3;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-family: 'Satoshi', 'Consolas', 'Arial', sans-serif;
    }
    .guilds-details-btn {
      margin-left: 16px;
      padding: 2px 8px;
      font-size: 12px;
      background: #222;
      color: #fff;
      border: 1px solid #888;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      font-family: 'Satoshi', 'Consolas', 'Arial', sans-serif;
    }
    .guilds-details-btn:hover {
      background: #fff;
      color: #222;
      border-color: #fff;
    }
    .guilds-table-cell.logo-col {
      padding: 0;
    }
    /* Modal title font fix */
    .guilds-modal-title {
      font-family: 'Satoshi', 'Consolas', 'Arial', sans-serif !important;
      font-size: 22px !important;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
  `;
  listContent.appendChild(style);

  // Header
  const header = document.createElement('div');
  header.className = 'guilds-table-header';
  header.innerHTML = `
    <div class="guilds-table-cell logo-col" style="flex:0 0 48px; display:flex; justify-content:center; align-items:center;">Logo</div>
    <div class="guilds-table-cell" style="flex:2.2; padding-left:16px;">Guild Name</div>
    <div class="guilds-table-cell" style="flex:1.2;">Leader</div>
    <div class="guilds-table-cell members" style="flex:1.3; justify-content:center; text-align:center;">Members</div>
    <div class="guilds-table-cell details-header" style="flex:0 0 80px;"></div>
  `;
  listContent.appendChild(header);

  // Guild rows
  guilds.forEach((guild, i) => {
    const row = document.createElement('div');
    row.className = 'guilds-table-row';
    // Use the assigned portrait number for this guild
    const portraitNum = guildPortraits[i];
    row.innerHTML = `
      <div class="guilds-table-cell logo-col" style="flex:0 0 48px; display:flex; justify-content:center; align-items:center;">
        <div class="container-slot surface-darker" style="width:32px; height:32px; display:grid; place-items:center;">
          <div class="has-rarity relative grid h-full place-items-center" style="width:32px; height:32px;">
            <img class="pixelated ml-auto" alt="creature" width="32" height="32" src="/assets/portraits/${portraitNum}.png" />
          </div>
        </div>
      </div>
      <div class="guilds-table-cell" style="flex:2.2; padding-left:16px;">${guild.name}</div>
      <div class="guilds-table-cell" style="flex:1.2; font-weight:bold;">${guild.leader}</div>
      <div class="guilds-table-cell members" style="flex:1.3; justify-content:center; text-align:center;">${guild.members.length}</div>
      <div class="guilds-table-cell" style="flex:0 0 80px; display:flex; justify-content:flex-end;"></div>
    `;
    const detailsBtn = document.createElement('button');
    detailsBtn.textContent = 'Details';
    detailsBtn.className = 'guilds-details-btn';
    detailsBtn.onclick = () => showGuildsModal(guild, guildPortraits);
    // Append the button to the last cell
    row.lastElementChild.appendChild(detailsBtn);
    listContent.appendChild(row);
  });

  // Use the game's scroll container for the list
  const scrollContainer = api.ui.components.createScrollContainer({
    height: 480,
    padding: false,
    content: listContent
  });

  // Always show the vertical scrollbar track, but only allow scrolling if needed
  scrollContainer.element.style.overflowY = 'auto';
  scrollContainer.element.style.scrollbarGutter = 'stable'; // Keeps space for scrollbar always
  scrollContainer.element.style.minHeight = '480px'; // Ensures track is always visible

  // Custom CSS to always show scrollbar track (Webkit/Blink/Edge/Chrome/Opera/modern Firefox)
  const alwaysShowScrollbarStyle = document.createElement('style');
  alwaysShowScrollbarStyle.textContent = `
    .guilds-scroll-container {
      scrollbar-gutter: stable;
      min-height: 480px;
    }
    .guilds-scroll-container::-webkit-scrollbar {
      width: 12px;
      background: #222;
    }
    .guilds-scroll-container::-webkit-scrollbar-thumb {
      background: #555;
      border-radius: 6px;
    }
    .guilds-scroll-container {
      scrollbar-width: thin;
      scrollbar-color: #555 #222;
    }
  `;
  scrollContainer.element.classList.add('guilds-scroll-container');
  scrollContainer.element.appendChild(alwaysShowScrollbarStyle);

  // Modal content container
  const container = document.createElement('div');
  container.style.padding = '24px';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.boxSizing = 'border-box';
  container.appendChild(scrollContainer.element);

  api.ui.components.createModal({
    title: 'Guilds',
    width: 600,
    height: 600,
    content: container,
    buttons: [
      { text: 'Close', primary: true }
    ]
  });
  setTimeout(() => {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (dialog) {
      dialog.classList.remove('max-w-[300px]');
      dialog.style.width = '600px';
      dialog.style.minWidth = '600px';
      dialog.style.maxWidth = '600px';
      dialog.style.height = '600px';
      dialog.style.minHeight = '600px';
      dialog.style.maxHeight = '600px';
    }
  }, 10);
}

function openGuildsSystem() {
  showGuildsModal();
}

function addGuildsHeaderButton() {
  const tryInsert = () => {
    // Find the header <ul> by its class
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      setTimeout(tryInsert, 500);
      return;
    }
    // Prevent duplicate button
    if (headerUl.querySelector('.guilds-header-btn')) return;

    // Create the <li> and <button>
    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';
    const btn = document.createElement('button');
    btn.textContent = 'Guilds';
    btn.className = 'guilds-header-btn';
    btn.onclick = () => showGuildsModal();
    li.appendChild(btn);

    // Insert after the Wiki <li>
    const wikiLi = Array.from(headerUl.children).find(
      el => el.querySelector('a') && el.textContent.includes('Wiki')
    );
    if (wikiLi && wikiLi.nextSibling) {
      headerUl.insertBefore(li, wikiLi.nextSibling);
    } else {
      headerUl.appendChild(li);
    }
  };
  tryInsert();
}

// Call this on mod load
addGuildsHeaderButton();

// Pre-fetch guilds on mod load
fetchGuildsFromWiki().then(guilds => {
  cachedGuilds = guilds;
  cachedPortraits = guilds.map(() => Math.floor(Math.random() * 61) + 1);
});