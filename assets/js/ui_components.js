/**
 * Bestiary Arena Mod Loader - UI Components
 * 
 * This file contains standardized UI components that match the game's UI style.
 * These components can be used by mods to create consistent UIs.
 */

// Polyfill for Chrome and Firefox WebExtensions
if (typeof window.browser === 'undefined') {
  window.browser = window.chrome;
}

window.browserAPI = window.browserAPI || (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

// Simple HTML sanitizer (removes script/style tags and event handlers)
function sanitizeHTML(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  template.content.querySelectorAll('script, style, [onload], [onclick], [onerror], [onmouseover], [onfocus], [onblur]').forEach(el => el.remove());
  return template.innerHTML;
}

const DEBUG = false; // Set to true for development

(function() {
  const STYLES = {
    fonts: `
      @font-face {
        font-family: 'PixelFont';
        src: url('/assets/fonts/pixel.ttf') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    `,
    baseClasses: `
      .pixel-font {
        font-family: 'PixelFont', monospace;
        image-rendering: pixelated;
        font-smooth: never;
        -webkit-font-smoothing: none;
      }
      .pixel-font-14 { font-size: 14px; }
      .pixel-font-16 { font-size: 16px; }
      .pixelated {
        image-rendering: pixelated;
      }
      .widget-top {
        background: linear-gradient(to bottom, #444, #222);
        padding: 8px 12px;
        border-top-left-radius: 4px;
        border-top-right-radius: 4px;
        border-bottom: 1px solid #555;
      }
      .widget-top-text {
        color: white;
        font-size: 18px;
        margin: 0;
        font-weight: bold;
      }
      .widget-bottom {
        background: #2a2a2a;
        border-bottom-left-radius: 4px;
        border-bottom-right-radius: 4px;
      }
      .separator {
        height: 1px;
        background: #444;
        margin: 8px 0;
      }
      .surface-regular {
        background-color: #555;
      }
      .surface-dark {
        background-color: #333;
      }
      .surface-darker {
        background-color: #222;
      }
      .frame-1 {
        border-width: 4px;
        border-style: solid;
        border-image: url('/assets/icons/border-1.png') 4 stretch;
        border-image-outset: 0;
      }
      .frame-pressed-1 {
        border-width: 4px;
        border-style: solid;
        border-image: url('/assets/icons/border-pressed-1.png') 4 stretch;
        border-image-outset: 0;
      }
      .focus-style-visible:focus-visible {
        outline: 2px solid rgba(255, 255, 255, 0.5);
        outline-offset: 1px;
      }
      .has-rarity[data-rarity="1"] { background: rgba(120, 120, 120, 0.3); }
      .has-rarity[data-rarity="2"] { background: rgba(0, 128, 0, 0.3); }
      .has-rarity[data-rarity="3"] { background: rgba(0, 0, 255, 0.3); }
      .has-rarity[data-rarity="4"] { background: rgba(128, 0, 128, 0.3); }
      .has-rarity[data-rarity="5"] { background: rgba(255, 165, 0, 0.3); }
    `,
    scroll: `
      .scroll-container {
        position: relative;
        overflow: hidden;
      }
      .scroll-view {
        height: 100%;
        width: calc(100% - 12px);
        overflow-x: hidden;
        overflow-y: scroll;
        scrollbar-width: none;
      }
      .scroll-view::-webkit-scrollbar {
        display: none;
      }
      .scrollbar {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        width: 12px;
        background: #333;
      }
      .scrollbar-thumb {
        position: absolute;
        width: 12px;
        background-color: #555;
        border: 2px solid #666;
        border-radius: 2px;
      }
    `
  };

  // Add style element to head
  function ensureStyles() {
    if (document.getElementById('bestiary-mod-ui-styles')) return;
    
    const styleEl = document.createElement('style');
    styleEl.id = 'bestiary-mod-ui-styles';
    styleEl.textContent = `
      ${STYLES.fonts}
      ${STYLES.baseClasses}
      ${STYLES.scroll}
    `;
    
    document.head.appendChild(styleEl);
  }

  // Create a modal dialog that matches the game's style
  function createModal({ title, width = 300, height = 'auto', content, buttons = [] }) {
    ensureStyles();
    
    // Create overlay to capture clicks outside the modal
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 9998;
    `;
    document.body.appendChild(overlay);
    
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.className = 'auto-centered fixed shadow-lg outline-none pixel-font';
    modal.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 9999;
      width: ${typeof width === 'number' ? width + 'px' : width};
      max-width: 95vw;
      max-height: 95vh;
      background: transparent;
      color: white;
      pointer-events: auto;
    `;

    // Create modal structure
    const innerContent = document.createElement('div');
    
    // Create header
    const header = document.createElement('h2');
    header.className = 'widget-top widget-top-text';
    
    const headerText = document.createElement('p');
    headerText.textContent = sanitizeHTML(title);
    header.appendChild(headerText);
    
    // Create content area
    const contentContainer = document.createElement('div');
    contentContainer.className = 'widget-bottom pixel-font-16 p-3 text-whiteRegular';
    
    // Add content
    if (typeof content === 'string') {
      contentContainer.innerHTML = sanitizeHTML(content);
    } else if (content instanceof HTMLElement) {
      contentContainer.appendChild(content);
    }
    
    // Add buttons if provided
    if (buttons.length > 0) {
      const separator = document.createElement('div');
      separator.className = 'separator';
      separator.setAttribute('role', 'none');
      contentContainer.appendChild(separator);
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'flex justify-end gap-2';
      buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;';
      
      buttons.forEach(btn => {
        const button = document.createElement('button');
        button.className = 'focus-style-visible frame-1 active:frame-pressed-1 surface-regular pixel-font-14';
        button.textContent = btn.text || 'OK';
        button.style.cssText = `
          padding: 4px 8px;
          color: white;
          cursor: pointer;
        `;
        
        if (btn.primary) {
          button.style.backgroundColor = '#4CAF50';
        }
        
        button.addEventListener('click', (e) => {
          if (btn.onClick) btn.onClick(e, modalObject);
          if (btn.closeOnClick !== false) {
            document.body.removeChild(modal);
          }
        });
        
        buttonContainer.appendChild(button);
      });
      
      contentContainer.appendChild(buttonContainer);
    }
    
    // Assemble modal
    innerContent.appendChild(header);
    innerContent.appendChild(contentContainer);
    modal.appendChild(innerContent);
    
    // Add to document
    document.body.appendChild(modal);
    
    const modalObject = {
      element: modal,
      close: () => {
        if (modal.parentNode) {
          document.body.removeChild(modal);
        }
        if (overlay.parentNode) {
          document.body.removeChild(overlay);
        }
      }
    };
    
    // Add click event to overlay to close the modal
    overlay.addEventListener('click', () => {
      modalObject.close();
    });
    
    return modalObject;
  }

  // Create a scrollable container that matches the game's style
  function createScrollContainer({ height = 264, padding = true, content }) {
    ensureStyles();
    
    const container = document.createElement('div');
    container.className = 'relative overflow-hidden frame-pressed-1 surface-dark';
    container.dataset.nopadding = !padding;
    container.style.cssText = `
      height: ${typeof height === 'number' ? height + 'px' : height};
      padding: ${padding ? '0 4px' : '0'};
    `;
    
    // Create scroll view
    const scrollView = document.createElement('div');
    scrollView.className = 'scroll-view';
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.style.cssText = 'min-width: 100%; display: table;';
    
    // Create content container with padding option
    const contentContainer = document.createElement('div');
    contentContainer.className = padding ? 'my-1 grid items-start gap-1' : 'grid items-start gap-1';
    contentContainer.dataset.nopadding = !padding;
    contentContainer.style.cssText = 'grid-template-rows: max-content;';
    
    // Add initial content if provided
    if (content) {
      if (typeof content === 'string') {
        contentContainer.innerHTML = sanitizeHTML(content);
      } else if (content instanceof HTMLElement) {
        contentContainer.appendChild(content);
      }
    }
    
    // Add scrollbar
    const scrollbar = document.createElement('div');
    scrollbar.className = 'frame-1 surface-dark flex';
    scrollbar.style.cssText = `
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 3px;
      touch-action: none;
    `;
    
    const scrollThumb = document.createElement('div');
    scrollThumb.className = 'relative flex-1 scrollbar-vertical';
    scrollbar.appendChild(scrollThumb);
    
    // Assemble container
    contentWrapper.appendChild(contentContainer);
    scrollView.appendChild(contentWrapper);
    container.appendChild(scrollView);
    container.appendChild(scrollbar);
    
    // Update scrollbar thumb position based on scroll
    let requestId;
    function updateScrollThumb() {
      const scrollPercentage = scrollView.scrollTop / (scrollView.scrollHeight - scrollView.clientHeight);
      const thumbHeight = Math.max(30, (scrollView.clientHeight / scrollView.scrollHeight) * scrollView.clientHeight);
      const maxTop = scrollView.clientHeight - thumbHeight;
      
      scrollThumb.style.height = `${thumbHeight}px`;
      scrollThumb.style.top = `${scrollPercentage * maxTop}px`;
      
      requestId = null;
    }
    
    function handleScroll() {
      if (!requestId) {
        requestId = requestAnimationFrame(updateScrollThumb);
      }
    }
    
    scrollView.addEventListener('scroll', handleScroll);
    updateScrollThumb();
    
    // Return object with methods
    return {
      element: container,
      scrollView,
      contentContainer,
      
      addContent(content) {
        if (typeof content === 'string') {
          const div = document.createElement('div');
          div.innerHTML = sanitizeHTML(content);
          while (div.firstChild) {
            contentContainer.appendChild(div.firstChild);
          }
        } else if (content instanceof HTMLElement) {
          contentContainer.appendChild(content);
        }
        
        // Update scrollbar
        updateScrollThumb();
      },
      
      clearContent() {
        while (contentContainer.firstChild) {
          contentContainer.removeChild(contentContainer.firstChild);
        }
        
        // Update scrollbar
        updateScrollThumb();
      },
      
      scrollTo(options) {
        scrollView.scrollTo(options);
      }
    };
  }

  // Create a monster portrait component that matches the game's style
  function createMonsterPortrait({ monsterId, level = 1, tier = 1, onClick }) {
    ensureStyles();
    
    const container = document.createElement('div');
    container.className = 'flex';
    
    const button = document.createElement('button');
    button.setAttribute('role', 'button');
    button.className = 'data-[picked=false]:group focus-style-visible draggable relative touch-none select-none';
    button.setAttribute('aria-disabled', 'false');
    button.setAttribute('data-picked', 'false');
    
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    
    const slot = document.createElement('div');
    slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden pointer-events-none';
    slot.setAttribute('data-dragging', 'false');
    slot.setAttribute('data-open', 'false');
    
    // Add rarity background based on tier
    const rarityBg = document.createElement('div');
    rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
    rarityBg.setAttribute('data-rarity', Math.min(5, tier));
    
    // Add tier stars for tier > 1
    if (tier > 1) {
      const tierStars = document.createElement('img');
      tierStars.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      tierStars.alt = 'star tier';
      tierStars.src = `/assets/icons/star-tier-${Math.min(4, tier)}.png`;
      slot.appendChild(tierStars);
    }
    
    // Add level indicator
    const levelContainer = document.createElement('div');
    levelContainer.className = 'pixel-font-16 absolute bottom-0 left-0 z-1 flex size-full items-end pl-0.5 text-whiteExp';
    levelContainer.style.cssText = `
      line-height: 0.8;
      background: radial-gradient(circle at left bottom, rgba(0, 0, 0, 0.5) 6px, transparent 24px);
    `;
    
    const levelText = document.createElement('span');
    levelText.className = 'relative font-outlined-fill text-transparent revert-pixel-font-spacing -translate-x-px';
    levelText.style.cssText = 'line-height: 0.9; font-size: 16px';
    levelText.setAttribute('translate', 'no');
    levelText.textContent = level;
    
    const levelCanvas = document.createElement('canvas');
    levelCanvas.className = 'font-outlined pixelated pointer-events-none absolute top-0 transition-opacity';
    levelCanvas.setAttribute('data-loaded', 'true');
    levelCanvas.width = 17;
    levelCanvas.height = 16;
    levelCanvas.style.left = '-1px';
    
    levelText.appendChild(levelCanvas);
    levelContainer.appendChild(levelText);
    
    // Add monster image
    const monsterImg = document.createElement('img');
    monsterImg.className = 'pixelated ml-auto';
    monsterImg.alt = 'creature';
    monsterImg.width = 32;
    monsterImg.height = 32;
    monsterImg.src = `/assets/portraits/${monsterId}.png`;
    
    // Assemble component
    slot.appendChild(rarityBg);
    slot.appendChild(levelContainer);
    slot.appendChild(monsterImg);
    button.appendChild(slot);
    container.appendChild(button);
    
    return container;
  }

  // Create an item portrait component that matches the game's style
  function createItemPortrait({ itemId, stat = 'ad', tier = 1, onClick }) {
    ensureStyles();
    
    const button = document.createElement('button');
    button.className = 'focus-style-visible active:opacity-70';
    button.setAttribute('data-state', 'closed');
    
    if (onClick) {
      button.addEventListener('click', onClick);
    }
    
    const portrait = document.createElement('div');
    portrait.className = 'equipment-portrait surface-darker relative data-[alive=false]:dithered data-[noframes=false]:frame-pressed-1 hover:unset-border-image';
    portrait.setAttribute('data-noframes', 'false');
    portrait.setAttribute('data-alive', 'false');
    portrait.setAttribute('data-highlighted', 'true');
    
    // Add rarity background based on tier
    const rarityBg = document.createElement('div');
    rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
    rarityBg.setAttribute('data-rarity', Math.min(5, tier));
    
    // Add item sprite
    const spriteContainer = document.createElement('div');
    spriteContainer.className = `sprite item relative id-${itemId}`;
    
    const viewport = document.createElement('div');
    viewport.className = 'viewport';
    
    const img = document.createElement('img');
    img.alt = itemId;
    img.className = 'spritesheet';
    img.setAttribute('data-cropped', 'false');
    img.style.cssText = '--cropX: 0; --cropY: 0';
    
    viewport.appendChild(img);
    spriteContainer.appendChild(viewport);
    
    // Add stat icon
    const statIconContainer = document.createElement('div');
    statIconContainer.className = 'absolute bottom-0 left-0 z-2 flex size-full items-end pb-px pl-0.5';
    statIconContainer.style.cssText = 'background: radial-gradient(circle at left bottom, rgba(0, 0, 0, 0.5) 6px, transparent 24px)';
    
    const statIcon = document.createElement('img');
    statIcon.className = 'pixelated size-[calc(11px*var(--zoomFactor))]';
    statIcon.alt = 'stat type';
    
    // Set icon based on stat type
    switch (stat.toLowerCase()) {
      case 'ad':
        statIcon.src = '/assets/icons/attackdamage.png';
        break;
      case 'ap':
        statIcon.src = '/assets/icons/abilitypower.png';
        break;
      case 'hp':
        statIcon.src = '/assets/icons/heal.png';
        break;
      case 'armor':
        statIcon.src = '/assets/icons/armor.png';
        break;
      case 'mr':
      case 'magicresist':
        statIcon.src = '/assets/icons/magicresist.png';
        break;
      default:
        statIcon.src = '/assets/icons/attackdamage.png';
    }
    
    statIconContainer.appendChild(statIcon);
    
    // Assemble component
    portrait.appendChild(rarityBg);
    portrait.appendChild(spriteContainer);
    portrait.appendChild(statIconContainer);
    button.appendChild(portrait);
    
    return button;
  }

  // Create a room list item component that matches the game's style
  function createRoomListItem({ roomId, name, rank, personalTime, worldTime, onClick }) {
    ensureStyles();
    
    const itemContainer = document.createElement('div');
    itemContainer.className = 'frame-1 surface-regular flex items-center gap-2 p-1';
    
    // Create thumbnail container
    const thumbContainer = document.createElement('div');
    thumbContainer.className = 'frame-pressed-1 size-[72px] shrink-0';
    
    const thumbImg = document.createElement('img');
    thumbImg.className = 'pixelated size-full object-cover';
    thumbImg.alt = 'room';
    thumbImg.src = `/assets/room-thumbnails/${roomId}.png`;
    
    thumbContainer.appendChild(thumbImg);
    
    // Create info container
    const infoContainer = document.createElement('div');
    infoContainer.className = 'grid w-full gap-1';
    
    // Room name button
    const nameButton = document.createElement('button');
    nameButton.className = 'focus-style-visible line-clamp-1 text-left text-whiteExp';
    nameButton.textContent = sanitizeHTML(name);
    
    if (onClick) {
      nameButton.addEventListener('click', onClick);
    }
    
    infoContainer.appendChild(nameButton);
    
    // Stats table
    const statsTable = document.createElement('div');
    statsTable.className = 'pixel-font-14 table';
    
    // Add rank if provided
    if (rank) {
      const rankRow = document.createElement('div');
      rankRow.className = 'table-row';
      
      const rankLabel = document.createElement('div');
      rankLabel.className = 'table-cell pr-1';
      
      const rankIcon = document.createElement('img');
      rankIcon.className = 'pixelated mr-1.5 inline-block -translate-y-px';
      rankIcon.alt = 'Achievement';
      rankIcon.width = 11;
      rankIcon.height = 11;
      rankIcon.src = '/assets/icons/achievement.png';
      
      rankLabel.appendChild(rankIcon);
      rankLabel.appendChild(document.createTextNode('Rank:'));
      
      const rankValue = document.createElement('span');
      rankValue.className = 'relative font-outlined-fill text-transparent revert-pixel-font-spacing';
      rankValue.setAttribute('translate', 'no');
      rankValue.title = `Rank points: ${rank.points || 1}`;
      rankValue.style.cssText = 'line-height: 1; font-size: 16px';
      rankValue.textContent = rank.label || 'S+';
      
      const rankCanvas = document.createElement('canvas');
      rankCanvas.className = 'font-outlined pixelated pointer-events-none absolute top-0 transition-opacity';
      rankCanvas.setAttribute('data-loaded', 'true');
      rankCanvas.width = 18;
      rankCanvas.height = 16;
      rankCanvas.style.left = '-1px';
      
      rankValue.appendChild(rankCanvas);
      
      rankRow.appendChild(rankLabel);
      rankRow.appendChild(rankValue);
      statsTable.appendChild(rankRow);
    }
    
    // Add personal time if provided
    if (personalTime) {
      const personalRow = document.createElement('div');
      personalRow.className = 'table-row';
      
      const personalLabel = document.createElement('div');
      personalLabel.className = 'table-cell pr-1';
      
      const personalIcon = document.createElement('img');
      personalIcon.className = 'pixelated mr-1.5 inline-block -translate-y-px';
      personalIcon.alt = 'Achievement';
      personalIcon.width = 11;
      personalIcon.height = 11;
      personalIcon.src = '/assets/icons/achievement.png';
      
      personalLabel.appendChild(personalIcon);
      personalLabel.appendChild(document.createTextNode('Recorde pessoal:'));
      
      const personalValue = document.createElement('span');
      personalValue.className = 'relative font-outlined-fill text-transparent revert-pixel-font-spacing';
      personalValue.setAttribute('translate', 'no');
      personalValue.title = `Ticks: ${personalTime.ticks || 0}`;
      personalValue.style.cssText = 'line-height: 1; font-size: 16px';
      personalValue.textContent = personalTime.display || '0:00';
      
      const personalCanvas = document.createElement('canvas');
      personalCanvas.className = 'font-outlined pixelated pointer-events-none absolute top-0 transition-opacity';
      personalCanvas.setAttribute('data-loaded', 'true');
      personalCanvas.width = 29;
      personalCanvas.height = 16;
      personalCanvas.style.left = '-1px';
      
      personalValue.appendChild(personalCanvas);
      
      personalRow.appendChild(personalLabel);
      personalRow.appendChild(personalValue);
      statsTable.appendChild(personalRow);
    }
    
    // Add world time if provided
    if (worldTime) {
      const worldRow = document.createElement('div');
      worldRow.className = 'table-row';
      worldRow.setAttribute('data-state', 'closed');
      
      const worldLabel = document.createElement('div');
      worldLabel.className = 'table-cell pr-1';
      
      const worldIcon = document.createElement('img');
      worldIcon.className = 'pixelated mr-1.5 inline-block -translate-y-px';
      worldIcon.alt = 'highscore';
      worldIcon.width = 11;
      worldIcon.height = 11;
      worldIcon.src = '/assets/icons/highscore.png';
      
      worldLabel.appendChild(worldIcon);
      worldLabel.appendChild(document.createTextNode('Recorde mundial:'));
      
      const worldValue = document.createElement('span');
      worldValue.className = 'relative font-outlined-fill text-transparent revert-pixel-font-spacing';
      worldValue.setAttribute('translate', 'no');
      worldValue.title = `Ticks: ${worldTime.ticks || 0}`;
      worldValue.style.cssText = 'line-height: 1; font-size: 16px';
      worldValue.textContent = worldTime.display || '0:00';
      
      const worldCanvas = document.createElement('canvas');
      worldCanvas.className = 'font-outlined pixelated pointer-events-none absolute top-0 transition-opacity';
      worldCanvas.setAttribute('data-loaded', 'true');
      worldCanvas.width = 29;
      worldCanvas.height = 16;
      worldCanvas.style.left = '-1px';
      
      worldValue.appendChild(worldCanvas);
      
      worldRow.appendChild(worldLabel);
      worldRow.appendChild(worldValue);
      statsTable.appendChild(worldRow);
    }
    
    infoContainer.appendChild(statsTable);
    
    // Assemble component
    itemContainer.appendChild(thumbContainer);
    itemContainer.appendChild(infoContainer);
    
    return {
      element: itemContainer,
      nameButton
    };
  }

  // Create a navigation breadcrumb component that matches the game's style
  function createNavBreadcrumb({ paths = [], onBack }) {
    ensureStyles();
    
    const container = document.createElement('div');
    container.className = 'pixel-font-14 mb-2 flex h-[18px] items-center gap-2';
    
    // Back button
    if (onBack) {
      const backButton = document.createElement('button');
      backButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14';
      
      const backIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      backIcon.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      backIcon.setAttribute('width', '24');
      backIcon.setAttribute('height', '24');
      backIcon.setAttribute('viewBox', '0 0 24 24');
      backIcon.setAttribute('fill', 'none');
      backIcon.setAttribute('stroke', 'currentColor');
      backIcon.setAttribute('stroke-width', '2');
      backIcon.setAttribute('stroke-linecap', 'round');
      backIcon.setAttribute('stroke-linejoin', 'round');
      backIcon.setAttribute('class', 'lucide lucide-arrow-left');
      
      const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path1.setAttribute('d', 'm12 19-7-7 7-7');
      
      const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path2.setAttribute('d', 'M19 12H5');
      
      backIcon.appendChild(path1);
      backIcon.appendChild(path2);
      
      backButton.appendChild(backIcon);
      backButton.addEventListener('click', onBack);
      
      container.appendChild(backButton);
    }
    
    // Paths
    const pathContainer = document.createElement('div');
    pathContainer.className = 'mb-0.5 line-clamp-1';
    
    paths.forEach((path, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'mx-px text-whiteDark';
        separator.textContent = '>';
        pathContainer.appendChild(separator);
      }
      
      pathContainer.appendChild(document.createTextNode(path));
    });
    
    container.appendChild(pathContainer);
    
    return container;
  }

  // Export UI components to global
  window.BestiaryUIComponents = {
    createModal,
    createScrollContainer,
    createMonsterPortrait,
    createItemPortrait,
    createRoomListItem,
    createNavBreadcrumb
  };
})(); 