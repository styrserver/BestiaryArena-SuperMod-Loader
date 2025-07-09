// Cyclopedia Mod
console.log('Cyclopedia initializing...');

// --- Observer Reference for Cleanup ---
let observer = null;

// --- Insert Cyclopedia Button in Header (like Guilds.js) ---
function addCyclopediaHeaderButton() {
  const tryInsert = () => {
    // Find the header <ul> by its class
    const headerUl = document.querySelector('header ul.pixel-font-16.flex.items-center');
    if (!headerUl) {
      console.debug('[Cyclopedia] Header <ul> not found, retrying...');
      setTimeout(tryInsert, 500);
      return;
    }
    // Prevent duplicate button
    if (headerUl.querySelector('.cyclopedia-header-btn')) {
      console.debug('[Cyclopedia] Cyclopedia header button already exists, skipping insert.');
      return;
    }

    // Create the <li> and <button>
    const li = document.createElement('li');
    li.className = 'hover:text-whiteExp';
    const btn = document.createElement('button');
    btn.textContent = 'Cyclopedia';
    btn.className = 'cyclopedia-header-btn';
    btn.onclick = () => {
      console.debug('[Cyclopedia] Cyclopedia header button clicked, opening modal.');
      openCyclopediaModal();
    };
    li.appendChild(btn);

    // Insert after the Wiki <li>
    const wikiLi = Array.from(headerUl.children).find(
      el => el.querySelector('a') && el.textContent.includes('Wiki')
    );
    if (wikiLi && wikiLi.nextSibling) {
      headerUl.insertBefore(li, wikiLi.nextSibling);
      console.debug('[Cyclopedia] Cyclopedia header button inserted after Wiki.');
    } else {
      headerUl.appendChild(li);
      console.debug('[Cyclopedia] Cyclopedia header button appended to header.');
    }
  };
  tryInsert();
}

// Call this on mod load
addCyclopediaHeaderButton();

// --- Helper: Find the monster name from the context menu ---
function getMonsterNameFromMenu(menuElem) {
  const group = menuElem.querySelector('div[role="group"]');
  if (!group) return null;
  const firstItem = group.querySelector('.dropdown-menu-item');
  if (!firstItem) return null;
  const match = firstItem.textContent.trim().match(/^(.*?)\s*\(/);
  return match ? match[1] : firstItem.textContent.trim();
}

// --- Utility: Robust Monster Name Lookup ---
function getWikiName(monsterName) {
  // Use utility API if available for mapping
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
    const maps = window.BestiaryModAPI.utility.maps;
    // Try to get the canonical name from the game ID
    let gameId = maps.monsterNamesToGameIds.get(monsterName.toLowerCase());
    if (gameId !== undefined) {
      let canonicalName = maps.monsterGameIdsToNames.get(gameId);
      if (canonicalName) return canonicalName;
    }
  }
  // Fallback: use the name as-is
  return monsterName;
}

// --- Context Menu Observer Management ---
function startObserver() {
  if (observer) return;
  console.debug('[Cyclopedia] Starting MutationObserver for context menu popper wrappers.');
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Debug: log added nodes
        if (node.nodeType === 1) {
          if (node.matches && node.matches('div[data-radix-popper-content-wrapper]')) {
            console.debug('[Cyclopedia] Detected data-radix-popper-content-wrapper node:', node);
            const menu = node.querySelector('[role="menu"]');
            if (menu) {
              console.debug('[Cyclopedia] Found menu inside wrapper, injecting Cyclopedia button.');
              injectCyclopediaButton(menu);
            } else {
              console.debug('[Cyclopedia] No menu found inside wrapper.');
            }
          } else if (node.querySelector) {
            const wrapper = node.querySelector('div[data-radix-popper-content-wrapper]');
            if (wrapper) {
              console.debug('[Cyclopedia] Detected wrapper inside added node:', wrapper);
              const menu = wrapper.querySelector('[role="menu"]');
              if (menu) {
                console.debug('[Cyclopedia] Found menu inside nested wrapper, injecting Cyclopedia button.');
                injectCyclopediaButton(menu);
              } else {
                console.debug('[Cyclopedia] No menu found inside nested wrapper.');
              }
            }
          }
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    console.debug('[Cyclopedia] Stopping MutationObserver.');
    observer.disconnect();
    observer = null;
  }
}

// Start observer on load (mod is always enabled)
startObserver();

function showCyclopediaInfoWhenReady(name) {
  if (api.ui && api.ui.components && typeof api.ui.components.createModal === 'function') {
    showCyclopediaInfo(name);
  } else {
    setTimeout(() => showCyclopediaInfoWhenReady(name), 100);
  }
}

function ensureModalWidth(dialog, width, height) {
  if (!dialog) return;
  // Remove restrictive width/height classes
  dialog.classList.remove('max-w-[300px]');
  // Remove any Tailwind max-h-* classes
  Array.from(dialog.classList).forEach(cls => {
    if (/^max-h(-|\[)/.test(cls)) dialog.classList.remove(cls);
  });
  dialog.style.setProperty('width', width + 'px', 'important');
  dialog.style.setProperty('minWidth', width + 'px', 'important');
  dialog.style.setProperty('maxWidth', width + 'px', 'important');
  dialog.style.setProperty('height', height + 'px', 'important');
  dialog.style.setProperty('minHeight', height + 'px', 'important');
  dialog.style.setProperty('maxHeight', height + 'px', 'important');
  const contentArea = dialog.querySelector('.widget-bottom, .modal-content, [data-content], .content, .modal-body');
  if (contentArea) {
    contentArea.style.setProperty('height', height + 'px', 'important');
    contentArea.style.setProperty('minHeight', height + 'px', 'important');
    contentArea.style.setProperty('maxHeight', height + 'px', 'important');
    contentArea.style.setProperty('display', 'flex', 'important');
    contentArea.style.setProperty('flexDirection', 'column', 'important');
    contentArea.style.setProperty('width', '100%', 'important');
    // Make all direct children fill height
    Array.from(contentArea.children).forEach(child => {
      child.style.setProperty('flex', '1 1 0', 'important');
      child.style.setProperty('minHeight', '0', 'important');
      child.style.setProperty('height', '100%', 'important');
    });
    // If there's an iframe, force it to fill as well
    const iframe = contentArea.querySelector('iframe');
    if (iframe) {
      iframe.style.setProperty('height', '100%', 'important');
      iframe.style.setProperty('minHeight', '100%', 'important');
      iframe.style.setProperty('maxHeight', '100%', 'important');
    }
  }
  const observer = new MutationObserver(() => {
    dialog.classList.remove('max-w-[300px]');
    Array.from(dialog.classList).forEach(cls => {
      if (/^max-h(-|\[)/.test(cls)) dialog.classList.remove(cls);
    });
    dialog.style.setProperty('width', width + 'px', 'important');
    dialog.style.setProperty('minWidth', width + 'px', 'important');
    dialog.style.setProperty('maxWidth', width + 'px', 'important');
    dialog.style.setProperty('height', height + 'px', 'important');
    dialog.style.setProperty('minHeight', height + 'px', 'important');
    dialog.style.setProperty('maxHeight', height + 'px', 'important');
    const contentArea = dialog.querySelector('.widget-bottom, .modal-content, [data-content], .content, .modal-body');
    if (contentArea) {
      contentArea.style.setProperty('height', height + 'px', 'important');
      contentArea.style.setProperty('minHeight', height + 'px', 'important');
      contentArea.style.setProperty('maxHeight', height + 'px', 'important');
      contentArea.style.setProperty('display', 'flex', 'important');
      contentArea.style.setProperty('flexDirection', 'column', 'important');
      contentArea.style.setProperty('width', '100%', 'important');
      Array.from(contentArea.children).forEach(child => {
        child.style.setProperty('flex', '1 1 0', 'important');
        child.style.setProperty('minHeight', '0', 'important');
        child.style.setProperty('height', '100%', 'important');
      });
      const iframe = contentArea.querySelector('iframe');
      if (iframe) {
        iframe.style.setProperty('height', '100%', 'important');
        iframe.style.setProperty('minHeight', '100%', 'important');
        iframe.style.setProperty('maxHeight', '100%', 'important');
      }
    }
  });
  observer.observe(dialog, { attributes: true, attributeFilter: ['class'] });
  setTimeout(() => observer.disconnect(), 2000);
}

function showCyclopediaModal(wikiUrl, title = 'Cyclopedia') {
  const CONTENT_WIDTH = 980;
  const CONTENT_HEIGHT = 600;
  const CHROME_HEIGHT = 0;
  const MODAL_HEIGHT = CONTENT_HEIGHT + CHROME_HEIGHT;

  // Create a container for the iframe
  const container = document.createElement('div');
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.padding = '0';
  container.style.margin = '0';
  container.style.boxSizing = 'border-box';

  const iframe = document.createElement('iframe');
  iframe.src = wikiUrl;
  iframe.style.flex = '1 1 auto';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = '#181818';
  iframe.style.display = 'block';
  iframe.style.padding = '0';
  iframe.style.margin = '0';
  iframe.allowFullscreen = true;
  
  // Add sandbox attributes to handle CORS issues
  iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
  
  // Add error handling
  iframe.onerror = () => {
    console.warn('[Cyclopedia] Failed to load iframe content');
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;">
        <div style="font-size:24px;margin-bottom:16px;">⚠️</div>
        <div style="font-size:16px;margin-bottom:12px;color:#e5e5e5;">Unable to load Cyclopedia content</div>
        <div style="font-size:14px;color:#999;margin-bottom:20px;">This may be due to browser security restrictions.</div>
        <a href="${wikiUrl}" target="_blank" style="color:#4a9eff;text-decoration:none;padding:8px 16px;border:1px solid #4a9eff;border-radius:4px;">
          Open in New Tab
        </a>
      </div>
    `;
  };

  container.appendChild(iframe);

  api.ui.components.createModal({
    title: title,
    width: CONTENT_WIDTH,
    height: MODAL_HEIGHT,
    content: container,
    buttons: [{ text: 'Close', primary: true }]
  });

  setTimeout(() => {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    ensureModalWidth(dialog, CONTENT_WIDTH, MODAL_HEIGHT);
    const contentArea = dialog && dialog.querySelector('.widget-bottom, .modal-content, [data-content], .content, .modal-body');
    if (contentArea) {
      contentArea.style.setProperty('height', CONTENT_HEIGHT + 'px', 'important');
      contentArea.style.setProperty('minHeight', CONTENT_HEIGHT + 'px', 'important');
      contentArea.style.setProperty('maxHeight', CONTENT_HEIGHT + 'px', 'important');
      contentArea.style.display = 'flex';
      contentArea.style.flexDirection = 'column';
      contentArea.style.padding = '0';
    }
  }, 10);
}

function injectCyclopediaButton(menuElem) {
  if (menuElem.querySelector('.cyclopedia-menu-item')) {
    console.debug('[Cyclopedia] Cyclopedia button already injected, skipping.');
    return;
  }
  const monsterName = getMonsterNameFromMenu(menuElem);
  if (!monsterName) {
    console.debug('[Cyclopedia] Could not determine monster name from menu.');
    return;
  }
  const wikiName = getWikiName(monsterName);
  const wikiUrl = `https://bestiaryarena.wiki.gg/wiki/${encodeURIComponent(wikiName.replace(/ /g, '_'))}`;

  const cyclopediaItem = document.createElement('div');
  cyclopediaItem.className = 'dropdown-menu-item cyclopedia-menu-item relative flex cursor-default select-none items-center gap-2 outline-none';
  cyclopediaItem.setAttribute('role', 'menuitem');
  cyclopediaItem.setAttribute('tabindex', '-1');
  cyclopediaItem.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open"><path d="M2 19V6a2 2 0 0 1 2-2h7"></path><path d="M22 19V6a2 2 0 0 0-2-2h-7"></path><path d="M2 19a2 2 0 0 0 2 2h7"></path><path d="M22 19a2 2 0 0 1-2 2h-7"></path></svg>Cyclopedia`;
  cyclopediaItem.addEventListener('click', (e) => {
    e.stopPropagation();
    showCyclopediaModal(wikiUrl, `Cyclopedia: ${wikiName}`);
    if (menuElem.parentElement) menuElem.parentElement.removeChild(menuElem);
  });

  const separator = menuElem.querySelector('.separator');
  if (separator) {
    separator.parentNode.insertBefore(cyclopediaItem, separator);
    console.debug('[Cyclopedia] Cyclopedia button injected before separator.');
  } else {
    menuElem.appendChild(cyclopediaItem);
    console.debug('[Cyclopedia] Cyclopedia button appended to menu.');
  }
}

function injectCyclopediaCss() {
  if (!document.getElementById('cyclopedia-css')) {
    const link = document.createElement('link');
    link.id = 'cyclopedia-css';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'https://bestiaryarena.wiki.gg/load.php?modules=mediawiki.skinning.interface|site.styles&only=styles&skin=monobook';
    document.head.appendChild(link);
    console.debug('[Cyclopedia] Injected cyclopedia CSS.');
  }
}

async function showCyclopediaInfo(name) {
  const wikiName = getWikiName(name);
  const wikiUrl = `https://bestiaryarena.wiki.gg/wiki/${encodeURIComponent(wikiName.replace(/ /g, '_'))}`;
  const CONTENT_WIDTH = 980;
  const CONTENT_HEIGHT = 600;

  // Step 1: Open the modal with a loading message
  const modal = api.ui.components.createModal({
    title: `Cyclopedia: ${wikiName}`,
    width: CONTENT_WIDTH,
    height: CONTENT_HEIGHT,
    content: '<div id="cyclopedia-loading" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;">Loading cyclopedia page...</div>',
    buttons: [{ text: 'Close', primary: true }]
  });

  // Step 2: Enforce modal size as in Guilds.js, then inject the iframe after a short timeout
  setTimeout(() => {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    ensureModalWidth(dialog, CONTENT_WIDTH, CONTENT_HEIGHT);
    const contentElem = dialog && dialog.querySelector('.modal-content, [data-content], .content, .modal-body');
    if (contentElem) {
      // Step 3: Inject the iframe, replacing the loading message
      contentElem.innerHTML = '';
      const iframe = document.createElement('iframe');
      iframe.src = wikiUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      iframe.style.display = 'block';
      iframe.style.padding = '0';
      iframe.style.margin = '0';
      iframe.allowFullscreen = true;
      
      // Add sandbox attributes to handle CORS issues
      iframe.sandbox = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
      
      // Add error handling
      iframe.onerror = () => {
        console.warn('[Cyclopedia] Failed to load iframe content');
        contentElem.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:20px;text-align:center;">
            <div style="font-size:24px;margin-bottom:16px;">⚠️</div>
            <div style="font-size:16px;margin-bottom:12px;color:#e5e5e5;">Unable to load Cyclopedia content</div>
            <div style="font-size:14px;color:#999;margin-bottom:20px;">This may be due to browser security restrictions.</div>
            <a href="${wikiUrl}" target="_blank" style="color:#4a9eff;text-decoration:none;padding:8px 16px;border:1px solid #4a9eff;border-radius:4px;">
              Open in New Tab
            </a>
          </div>
        `;
      };
      
      contentElem.appendChild(iframe);
    }
  }, 100); // Slightly longer timeout to ensure modal is fully rendered
}

// --- Cyclopedia Modal Prototype ---
function openCyclopediaModal() {
  const CONTENT_WIDTH = 980;
  const CONTENT_HEIGHT = 600;

  api.ui.components.createModal({
    title: 'Cyclopedia',
    width: CONTENT_WIDTH,
    height: CONTENT_HEIGHT,
    content: '<div id="cyclopedia-mod-container-placeholder"></div>',
    buttons: []
  });

  setTimeout(() => {
    const dialog = document.querySelector('div[role="dialog"][data-state="open"]');
    if (!dialog) return;
    ensureModalWidth(dialog, CONTENT_WIDTH, CONTENT_HEIGHT);
    const titleElement = dialog.querySelector('.widget-top-text, h2');
    if (titleElement) {
      titleElement.style.textAlign = 'center';
      titleElement.style.justifyContent = 'center';
    }
    const widgetBottom = dialog.querySelector('.widget-bottom');
    if (!widgetBottom) {
      console.error('[Cyclopedia] Modal .widget-bottom not found!');
      return;
    }
    widgetBottom.innerHTML = '';
    widgetBottom.className = 'widget-bottom pixel-font-16 p-3 text-whiteRegular auto-centered fixed z-modals w-full shadow-lg outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]';
    widgetBottom.style.background = 'url(../../assets/originalassets/background-regular.b0337118.png) repeat';
    widgetBottom.style.display = '';
    widgetBottom.style.flexDirection = '';
    widgetBottom.style.padding = '';
    widgetBottom.style.height = '';

    // CyclopediaModal main container
    const cyclopediaContainer = document.createElement('div');
    cyclopediaContainer.className = 'CyclopediaModal CyclopediaModal-container flex flex-col h-full w-full';
    cyclopediaContainer.style.background = 'url(../../assets/originalassets/background-regular.b0337118.png) repeat';

    // Tabs header
    const tabsHeader = document.createElement('div');
    tabsHeader.className = 'CyclopediaModal-tabs-header flex gap-2 px-2 pt-2';
    tabsHeader.style.borderBottom = 'none';
    // Add separator below tabs header
    const headerSeparator = document.createElement('div');
    headerSeparator.style.height = '8px';
    headerSeparator.style.background = 'url(../../assets/originalassets/context-menu-separator.8d6160af.png) repeat-x';
    headerSeparator.style.margin = '0 0 4px 0';

    // Tab content containers
    const tabNames = ['Cyclopedia', 'Mods', 'Settings'];
    const tabContents = {};
    const tabButtons = {};

    tabNames.forEach(name => {
      // Tab button
      const tabBtn = document.createElement('button');
      tabBtn.className = 'CyclopediaModal-tab px-4 py-2';
      tabBtn.textContent = name;
      tabBtn.style.border = '4px solid transparent';
      tabBtn.style.borderImage = `url(../../assets/originalassets/4-frame.a58d0c39.png) 4 stretch`;
      tabBtn.style.background = 'url(../../assets/originalassets/background-regular.b0337118.png) repeat';
      tabBtn.style.transition = 'border-image 0.1s';
      tabBtn.onmousedown = () => {
        tabBtn.style.borderImage = `url(../../assets/originalassets/1-frame-pressed.e3fabbc5.png) 4 stretch`;
      };
      tabBtn.onmouseup = tabBtn.onmouseleave = () => {
        if (tabBtn.classList.contains('active')) {
          tabBtn.style.borderImage = `url(../../assets/originalassets/console-frame-active-full.b0e0cfca.png) 6 stretch`;
        } else {
          tabBtn.style.borderImage = `url(../../assets/originalassets/console-frame-inactive.0f709d08.png) 6 stretch`;
        }
      };
      tabBtn.onmouseover = () => {
        if (!tabBtn.classList.contains('active')) {
          tabBtn.style.borderImage = `url(../../assets/originalassets/1-frame.f1ab7b00.png) 4 stretch`;
        }
      };
      tabBtn.onmouseout = () => {
        if (tabBtn.classList.contains('active')) {
          tabBtn.style.borderImage = `url(../../assets/originalassets/console-frame-active-full.b0e0cfca.png) 6 stretch`;
        } else {
          tabBtn.style.borderImage = `url(../../assets/originalassets/console-frame-inactive.0f709d08.png) 6 stretch`;
        }
      };
      tabsHeader.appendChild(tabBtn);
      tabButtons[name] = tabBtn;

      // Tab content
      const tabContent = document.createElement('div');
      tabContent.className = 'CyclopediaModal-tab-content h-full w-full';
      tabContent.style.display = 'none';
      tabContent.style.flex = '1 1 0%';
      tabContent.style.overflow = 'auto';
      // Custom scrollbar for Cyclopedia tab
      tabContent.style.scrollbarColor = '#888 transparent';
      tabContent.style.scrollbarWidth = 'thin';
      tabContent.style.position = 'relative';
      tabContent.onscroll = function(){};
      // Custom scrollbar handle (for webkit browsers)
      tabContent.innerHTML = '';
      if (name === 'Cyclopedia') {
        tabContent.innerHTML = `<div style="display:flex;flex:1 1 auto;overflow:hidden;height:100%;font-family:Tahoma, Arial, sans-serif;color:#e5e5e5;">
          <div style="width:210px;background:#2a2a2a;border-right:2px solid #111;padding:8px 6px 8px 8px;display:flex;flex-direction:column;">
            <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">Categories:</div>
            <div style="font-size:12px;margin-bottom:8px;"><div>Armors</div><div>Amulets</div><div>Boots</div><div>Containers</div></div>
            <div style="display:flex;gap:4px;margin-bottom:6px;"><button style="flex:1;font-size:11px;padding:2px 0;background:#232323;color:#e5e5e5;border:1px solid #444;border-radius:2px;">Level</button><button style="flex:1;font-size:11px;padding:2px 0;background:#232323;color:#e5e5e5;border:1px solid #444;border-radius:2px;">Voc.</button><button style="flex:1;font-size:11px;padding:2px 0;background:#232323;color:#e5e5e5;border:1px solid #444;border-radius:2px;">1H</button><button style="flex:1;font-size:11px;padding:2px 0;background:#232323;color:#e5e5e5;border:1px solid #444;border-radius:2px;">2H</button></div>
            <div style="font-size:13px;font-weight:bold;margin-bottom:4px;">Items:</div>
            <div style="flex:1 1 auto;overflow-y:auto;background:#232323;border:1px solid #222;padding:2px 0 2px 0;margin-bottom:6px;scrollbar-width:thin;scrollbar-color:#888 transparent;">
              <div style="display:flex;align-items:center;padding:2px 0 2px 2px;gap:4px;"><img src="https://static.tibia.com/images/global/items/strong_health_potion.gif" style="width:20px;height:20px;"> strong health potion</div>
              <div style="display:flex;align-items:center;padding:2px 0 2px 2px;gap:4px;"><img src="https://static.tibia.com/images/global/items/strong_mana_potion.gif" style="width:20px;height:20px;"> strong mana potion</div>
              <div style="display:flex;align-items:center;padding:2px 0 2px 2px;gap:4px;"><img src="https://static.tibia.com/images/global/items/supreme_health_potion.gif" style="width:20px;height:20px;"> supreme health potion</div>
              <div style="display:flex;align-items:center;padding:2px 0 2px 2px;gap:4px;"><img src="https://static.tibia.com/images/global/items/ultimate_health_potion.gif" style="width:20px;height:20px;"> ultimate health potion</div>
              <div style="display:flex;align-items:center;padding:2px 0 2px 2px;gap:4px;"><img src="https://static.tibia.com/images/global/items/ultimate_mana_potion.gif" style="width:20px;height:20px;"> ultimate mana potion</div>
            </div>
            <input type="text" placeholder="Search:" style="width:100%;margin-bottom:6px;font-size:12px;padding:2px 4px;background:#181818;color:#e5e5e5;border:1px solid #444;border-radius:2px;">
            <div style="font-size:12px;margin-bottom:4px;">Loot Value Source:</div>
            <div style="font-size:12px;margin-bottom:8px;"><label><input type="radio" name="lootval" checked> NPC Buy Value</label><br><label><input type="radio" name="lootval"> Market Average Value</label></div>
            <button style="width:100%;font-size:12px;padding:4px 0;background:#232323;color:#e5e5e5;border:1px solid #444;border-radius:2px;margin-bottom:4px;">Manage Loot Containers</button>
          </div>
          <div style="flex:1 1 auto;padding:10px 12px 10px 12px;display:flex;flex-direction:column;">
            <div style="font-size:14px;font-weight:bold;margin-bottom:4px;">Basic Item Details:</div>
            <div style="background:#232323;border:1px solid #222;padding:6px 8px;margin-bottom:8px;min-height:60px;"><div><b>Description:</b> This potion can only be consumed by knights of level 200 or higher</div><div><b>Weight:</b> 3.50 oz</div><div><b>Tradeable In Market:</b> yes</div></div>
            <div style="display:flex;gap:12px;margin-bottom:8px;"><div style="flex:1 1 0;"><div style="font-size:13px;font-weight:bold;margin-bottom:2px;">Sell To:</div><div style="background:#232323;border:1px solid #222;min-height:60px;padding:4px 6px;"></div></div><div style="flex:1 1 0;"><div style="font-size:13px;font-weight:bold;margin-bottom:2px;">Buy From:</div><div style="background:#232323;border:1px solid #222;min-height:60px;padding:4px 6px;">500 gp, Mehkes<br>Residence: Ankrahmun City<br>500 gp, Asima<br>Residence: Darashia City<br>500 gp, Sandra<br>Residence: Edron Castle<br>500 gp, Talila</div></div></div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><div style="font-size:13px;font-weight:bold;">Average Market Price:</div><div style="background:#232323;border:1px solid #222;padding:2px 8px;">508</div><div style="font-size:13px;font-weight:bold;">Prefer Own Loot Value:</div><input type="text" value="500" style="width:60px;font-size:12px;padding:2px 4px;background:#181818;color:#e5e5e5;border:1px solid #444;border-radius:2px;"><button style="font-size:12px;padding:2px 10px;background:#232323;color:#e5e5e5;border:1px solid #444;border-radius:2px;">Apply</button><div style="font-size:13px;font-weight:bold;">Resulting Value:</div><div style="background:#232323;border:1px solid #222;padding:2px 8px;">500</div></div>
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;"><label style="font-size:12px;"><input type="checkbox"> Track drops of this item</label><label style="font-size:12px;"><input type="checkbox"> Skip when Quick Looting</label></div>
          </div>
        </div>`;
      } else if (name === 'Mods') {
        tabContent.textContent = 'Mods Page Content';
        tabContent.style.display = 'none';
      } else if (name === 'Settings') {
        tabContent.textContent = 'Settings Page Content';
        tabContent.style.display = 'none';
      }
      cyclopediaContainer.appendChild(tabContent);
      tabContents[name] = tabContent;
    });

    // Tab switching logic
    function switchTab(activeName) {
      tabNames.forEach(name => {
        if (name === activeName) {
          tabButtons[name].classList.add('active');
          tabButtons[name].style.borderImage = `url(../../assets/originalassets/console-frame-active-full.b0e0cfca.png) 6 stretch`;
          tabContents[name].style.display = 'block';
        } else {
          tabButtons[name].classList.remove('active');
          tabButtons[name].style.borderImage = `url(../../assets/originalassets/console-frame-inactive.0f709d08.png) 6 stretch`;
          tabContents[name].style.display = 'none';
        }
      });
    }
    tabNames.forEach(name => {
      tabButtons[name].onclick = () => switchTab(name);
    });
    switchTab('Cyclopedia');

    // Assemble modal structure (restore to working backup logic)
    cyclopediaContainer.appendChild(tabsHeader);
    cyclopediaContainer.appendChild(headerSeparator);
    // Main content wrapper (fills available space)
    const mainContentWrapper = document.createElement('div');
    mainContentWrapper.style.flex = '1 1 auto';
    mainContentWrapper.style.display = 'flex';
    mainContentWrapper.style.flexDirection = 'column';
    mainContentWrapper.style.overflow = 'hidden';
    tabNames.forEach(name => mainContentWrapper.appendChild(tabContents[name]));
    cyclopediaContainer.appendChild(mainContentWrapper);
    // Footer (at the bottom, no flex/height set)
    const footer = document.createElement('div');
    footer.className = 'CyclopediaModal-footer flex justify-end gap-2 pt-2';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.alignItems = 'center';
    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
    closeButton.onclick = () => dialog.remove();
    footer.appendChild(closeButton);
    cyclopediaContainer.appendChild(footer);
    widgetBottom.appendChild(cyclopediaContainer);
  }, 10);
}

// --- Cleanup on Disable ---
exports = {
  disable: () => {
    stopObserver();
    api.ui.removeButton('cyclopedia');
  }
};