// Hero Editor Mod for Bestiary Arena
console.log('Hero Editor Mod initializing...');

// Use shared translation system via API
const t = (key) => api.i18n.t(key);

// Configuration
const defaultConfig = {
  enabled: true
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Map from equipment names to game IDs (will be populated from API if available)
let equipmentMap = null;

// Wait for the utility functions to be available from the API
document.addEventListener('utility-api-ready', () => {
      console.log('Hero Editor: Utility API is ready');
  
  // Get the equipment map from the API
  if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.maps) {
    // Convert the Map to a regular object for easier use in this mod
    equipmentMap = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds;
    console.log('Hero Editor: Equipment map loaded from API');
  }
});

// Create UI button using the API
const HERO_EDITOR_BUTTON_ID = 'hero-editor-button';
let heroEditorButton = null;
let heroEditorBoardUnsubscribe = null;

heroEditorButton = api.ui.addButton({
  id: HERO_EDITOR_BUTTON_ID,
  text: t('mods.heroEditor.buttonText'),
  tooltip: t('mods.heroEditor.buttonTooltip'),
  primary: false,
  onClick: () => showHeroEditorModal()
});

// Get player and board snapshots
const getPlayerSnapshot = () => globalThis.state.player.getSnapshot().context;
const getBoardSnapshot = () => globalThis.state.board.getSnapshot().context;

// Properly capitalize names (title case with connecting words lowercase)
function toTitleCase(str) {
  if (!str) return '';
  
  // Words that should remain lowercase (unless they're the first word)
  const lowerCaseWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'as', 'at', 
                         'by', 'for', 'from', 'in', 'into', 'near', 'of', 'on', 'onto', 
                         'to', 'with'];
  
  return str.toLowerCase().split(' ').map((word, index) => {
    // Always capitalize the first word or if not in lowerCaseWords list
    if (index === 0 || !lowerCaseWords.includes(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
    return word;
  }).join(' ');
}

// Build a map of equipment names to game IDs - use the API if available
const buildEquipmentMap = () => {
  // If the equipment map is already loaded from the API, use it
  if (equipmentMap) {
    return equipmentMap;
  }
  
  // Otherwise build the map manually
  const map = new Map();
  const utils = globalThis.state.utils;
  for (let i = 1; ; i++) {
    try { 
      map.set(utils.getEquipment(i).metadata.name.toLowerCase(), i); 
    }
    catch { break; }
  }
  return map;
};

// Build a map of monster names to game IDs
const buildMonsterMap = () => {
  if (window.monsterNamesToGameIds) {
    return window.monsterNamesToGameIds;
  }
  
  const map = new Map();
  const utils = globalThis.state.utils;
  for (let i = 1; ; i++) {
    try { 
      const monster = utils.getMonster(i);
      if (monster && monster.metadata && monster.metadata.name) {
        map.set(monster.metadata.name.toLowerCase(), i);
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return map;
};

// Get original cased equipment name from game ID
function getEquipmentNameFromId(gameId) {
  try {
    const equipData = globalThis.state.utils.getEquipment(gameId);
    return equipData && equipData.metadata ? equipData.metadata.name : null;
  } catch (e) {
    console.error('Error getting equipment name:', e);
    return null;
  }
}

// Get original cased monster name from game ID
function getMonsterNameFromId(gameId) {
  try {
    const monsterData = globalThis.state.utils.getMonster(gameId);
    return monsterData && monsterData.metadata ? monsterData.metadata.name : null;
  } catch (e) {
    console.error('Error getting monster name:', e);
    return null;
  }
}

// Get monster gameId from databaseId (player piece)
function getMonsterGameIdFromDatabaseId(databaseId) {
  try {
    const playerContext = getPlayerSnapshot();
    const monster = playerContext.monsters.find(m => m.id === databaseId);
    return monster ? monster.gameId : null;
  } catch (e) {
    console.error('Error getting monster gameId from databaseId:', e);
    return null;
  }
}

function createHeroEditorScrollContainer() {
  const scrollContainer = api.ui.components.createScrollContainer({
    height: '100%',
    padding: true,
    content: ''
  });
  Object.assign(scrollContainer.element.style, {
    flex: '1 1 0',
    minHeight: '0',
    height: 'auto'
  });
  return scrollContainer;
}

const HERO_EDITOR_MODAL_CONFIG = {
  width: 420,
  height: 420,
  leftColumnWidth: 100,
  contentInset: 35,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 280
};

let activeHeroEditorModal = null;
let heroEditorModalLayoutCleanup = null;

function getHeroEditorModalDimensions() {
  const pad = HERO_EDITOR_MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      HERO_EDITOR_MODAL_CONFIG.minWidth,
      Math.min(HERO_EDITOR_MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      HERO_EDITOR_MODAL_CONFIG.minHeight,
      Math.min(HERO_EDITOR_MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}

function getHeroEditorColumnWidths(modalWidth) {
  const contentWidth = modalWidth - HERO_EDITOR_MODAL_CONFIG.contentInset;
  if (modalWidth >= HERO_EDITOR_MODAL_CONFIG.width) {
    return {
      contentWidth: HERO_EDITOR_MODAL_CONFIG.width - HERO_EDITOR_MODAL_CONFIG.contentInset,
      leftWidth: HERO_EDITOR_MODAL_CONFIG.leftColumnWidth
    };
  }
  const leftWidth = Math.min(
    HERO_EDITOR_MODAL_CONFIG.leftColumnWidth,
    Math.max(70, Math.floor(contentWidth * 0.24))
  );
  return { contentWidth, leftWidth };
}

function getHeroEditorDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearHeroEditorModalLayoutCleanup() {
  if (heroEditorModalLayoutCleanup) {
    heroEditorModalLayoutCleanup();
    heroEditorModalLayoutCleanup = null;
  }
}

function injectHeroEditorModalAutosaveFooter(dialog) {
  if (!dialog) return;

  const footer = dialog.querySelector('.flex.justify-end.gap-2');
  if (!footer || footer.querySelector('.hero-editor-auto-save-indicator')) return;

  const autoSaveIndicator = document.createElement('div');
  autoSaveIndicator.className = 'hero-editor-auto-save-indicator pixel-font-16';
  autoSaveIndicator.style.cssText = `
    font-size: 11px;
    color: rgb(74, 222, 128);
    font-style: italic;
    margin-right: auto;
  `;
  autoSaveIndicator.textContent = t('mods.heroEditor.settingsAutoSave');

  footer.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  `;
  footer.insertBefore(autoSaveIndicator, footer.firstChild);

  const closeButton = footer.querySelector('button');
  if (closeButton) {
    closeButton.className = 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50 frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14 [&_svg]:size-[11px] [&_svg]:mb-[1px] [&_svg]:mt-[2px]';
    closeButton.style.cssText = '';
  }
}

function applyHeroEditorModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getHeroEditorDialog(modalRef);
  if (!dialog) return;

  const { width, height } = dimensions;
  const { contentWidth, leftWidth } = getHeroEditorColumnWidths(width);

  dialog.style.width = `${width}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${width}px`;
  dialog.style.height = `${height}px`;
  dialog.style.minHeight = '0';
  dialog.style.maxHeight = `${height}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.classList.remove('max-w-[300px]');

  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0'
    });
  }

  const widgetBottom = dialog.querySelector('.widget-bottom');
  if (widgetBottom) {
    Object.assign(widgetBottom.style, {
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 auto',
      minHeight: '0',
      overflowY: 'hidden',
      overflowX: 'hidden'
    });
  }

  injectHeroEditorModalAutosaveFooter(dialog);

  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 auto',
      minHeight: '0',
      height: '100%',
      maxHeight: 'none',
      minWidth: `${contentWidth}px`,
      maxWidth: `${contentWidth}px`,
      width: '100%',
      boxSizing: 'border-box',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });

    const columnsContainer = contentRoot.querySelector('.hero-editor-modal-columns');
    if (columnsContainer) {
      Object.assign(columnsContainer.style, {
        flex: '1 1 0',
        minHeight: '0',
        width: '100%',
        display: 'flex',
        overflow: 'hidden'
      });
    }

    const leftColumn = contentRoot.querySelector('.hero-editor-modal-left');
    if (leftColumn) {
      Object.assign(leftColumn.style, {
        width: `${leftWidth}px`,
        minWidth: `${leftWidth}px`,
        maxWidth: `${leftWidth}px`,
        flex: `0 0 ${leftWidth}px`,
        minHeight: '0'
      });
    }

    const rightColumn = contentRoot.querySelector('.hero-editor-modal-right');
    if (rightColumn) {
      Object.assign(rightColumn.style, {
        flex: '1 1 0',
        minWidth: '0',
        minHeight: '0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      });
    }

    const detailHost = contentRoot.querySelector('.hero-editor-detail-host');
    if (detailHost) {
      Object.assign(detailHost.style, {
        flex: '1 1 0',
        minHeight: '0',
        overflowX: 'hidden',
        overflowY: 'auto'
      });
    }

    const listScroll = contentRoot.querySelector('.hero-editor-list-scroll');
    if (listScroll) {
      Object.assign(listScroll.style, {
        flex: '1 1 0',
        minHeight: '0',
        width: '100%'
      });
    }
  }
}

function setupHeroEditorModalResponsiveLayout(modalRef, contentRoot) {
  clearHeroEditorModalLayoutCleanup();
  activeHeroEditorModal = modalRef;
  const apply = () => applyHeroEditorModalLayout(modalRef, contentRoot, getHeroEditorModalDimensions());
  setTimeout(apply, 50);
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  heroEditorModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (activeHeroEditorModal === modalRef) {
      activeHeroEditorModal = null;
    }
  };
}

// Icon mapping for stats
const iconMap = {
  ap: "/assets/icons/abilitypower.png",
  ad: "/assets/icons/attackdamage.png",
  hp: "/assets/icons/heal.png",
  magicResist: "/assets/icons/magicresist.png",
  armor: "/assets/icons/armor.png",
  speed: "/assets/icons/speed.png",
  level: "/assets/icons/achievement.png"
};

const HERO_EDITOR_DROPDOWN_CLASS = 'hero-editor-select';

const HERO_EDITOR_FLOATING_UI = {
  fontSize: '10px',
  titleFontSize: '11px',
  statIconSize: 12,
  portraitSize: '24px',
  topButtonSize: '18px'
};

const HERO_EDITOR_EQUIPMENT_PORTRAIT_SIZE = 34;

function applyEquipmentPortraitSize(element, sizePx = HERO_EDITOR_EQUIPMENT_PORTRAIT_SIZE) {
  if (!element) return element;

  const size = `${sizePx}px`;
  element.style.width = size;
  element.style.height = size;
  element.style.maxWidth = size;
  element.style.maxHeight = size;
  element.style.flexShrink = '0';

  const innerPortrait = element.querySelector('.equipment-portrait');
  if (innerPortrait) {
    innerPortrait.style.width = size;
    innerPortrait.style.height = size;
    innerPortrait.style.maxWidth = size;
    innerPortrait.style.maxHeight = size;
  }

  return element;
}

function createHeroEditorItemPortrait(options) {
  return applyEquipmentPortraitSize(api.ui.components.createItemPortrait(options));
}

function applyHeroEditorFloatingFont(element, fontSize = HERO_EDITOR_FLOATING_UI.fontSize) {
  element.style.fontSize = fontSize;
}

function clampEquipTier(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(5, Math.max(1, parsed));
}

function injectHeroEditorDropdownStyles() {
  if (document.getElementById('hero-editor-dropdown-styles')) return;

  const style = document.createElement('style');
  style.id = 'hero-editor-dropdown-styles';
  style.textContent = `
    select.${HERO_EDITOR_DROPDOWN_CLASS},
    select.${HERO_EDITOR_DROPDOWN_CLASS} option {
      background-color: #000000 !important;
      color: #ffffff !important;
    }
    .hero-editor-floating-panel select.${HERO_EDITOR_DROPDOWN_CLASS},
    .hero-editor-floating-panel select.${HERO_EDITOR_DROPDOWN_CLASS} option {
      font-size: ${HERO_EDITOR_FLOATING_UI.fontSize} !important;
    }
  `;
  document.head.appendChild(style);
}

function styleHeroEditorSelect(select) {
  select.classList.add(HERO_EDITOR_DROPDOWN_CLASS);
  select.style.backgroundColor = '#000000';
  select.style.color = '#ffffff';
}

injectHeroEditorDropdownStyles();

// Update equipment stats
function updateEquip(equipMap, name, stat, tier) {
  const gameId = equipMap.get(name.toLowerCase());
  if (!gameId) throw `Equipment "${name}" not found`;
  
  const playerContext = getPlayerSnapshot();
  const equips = playerContext.equips;
  const equip = equips.find(e => e.gameId === gameId);
  
  if (!equip) throw `Equipment "${name}" not found in player inventory`;
  
  equip.stat = stat; 
  equip.tier = tier;
  
  globalThis.state.player.send({
    type: "setState",
    fn: p => ({ ...p, equips: [...equips] })
  });
  
  return equip.id;
}

// Update item portrait with new equipment data
function updateItemPortrait(portrait, equipName, stat, tier, equipMap) {
  if (!portrait || !equipName || !stat || !tier || !equipMap) return null;
  
  const gameId = equipMap.get(equipName.toLowerCase());
  if (!gameId) return null;
  
  const equipData = globalThis.state.utils.getEquipment(gameId);
  if (!equipData || !equipData.metadata) return null;
  
  // Create a new portrait with updated data
  const newPortrait = createHeroEditorItemPortrait({
    itemId: equipData.metadata.spriteId,
    stat: stat,
    tier: clampEquipTier(tier)
  });
  
  // Replace the old portrait with the new one
  if (portrait && portrait.parentNode) {
    portrait.parentNode.replaceChild(newPortrait, portrait);
  }
  
  return newPortrait;
}

// Get serialized board data
function getSerializedBoard() {
  try {
    let boardData;
    
    // Method 1: Use the raw function directly from window if available
    if (typeof window.$serializeBoard === 'function') {
      boardData = JSON.parse(window.$serializeBoard());
    } 
    // Method 2: Use the function from the API if available
    else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.serializeBoard) {
      boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
    }
    else {
      console.error('No serialization method available');
      return null;
    }
    
    return boardData;
  } catch (error) {
    console.error('Error serializing board:', error);
    return null;
  }
}

// Configure board with updated data
function configureBoard(boardData) {
  try {
    // Method 1: Use the raw function directly from window if available
    if (typeof window.$configureBoard === 'function') {
      window.$configureBoard(boardData);
      console.log('Used window.$configureBoard directly for board configuration');
      return true;
    } 
    // Method 2: Use the function from the API if available
    else if (window.BestiaryModAPI && window.BestiaryModAPI.utility && window.BestiaryModAPI.utility.configureBoard) {
      window.BestiaryModAPI.utility.configureBoard(boardData);
              console.log('Used BestiaryModAPI.utility.configureBoard for board configuration');
      return true;
    }
    else {
      console.error('No configuration method available');
      return false;
    }
  } catch (error) {
    console.error('Error configuring board:', error);
    return false;
  }
}

function getHeroEditorButton() {
  return heroEditorButton || document.getElementById(HERO_EDITOR_BUTTON_ID);
}

function prepareHeroBoardData() {
  const playerContext = getPlayerSnapshot();
  const boardContext = getBoardSnapshot();
  const originalBoardData = getSerializedBoard();

  if (!originalBoardData) {
    return null;
  }

  if (!originalBoardData.board) {
    originalBoardData.board = [];
  }

  if (originalBoardData.board.length === 0 && boardContext.boardConfig) {
    boardContext.boardConfig.forEach(piece => {
      if (piece.type === 'player' && piece.databaseId) {
        const monster = playerContext.monsters.find(m => m.id === piece.databaseId);
        if (monster) {
          let monsterName = null;
          try {
            const monsterData = globalThis.state.utils.getMonster(monster.gameId);
            monsterName = monsterData.metadata.name.toLowerCase();
          } catch (e) {
            console.warn('Could not get monster name, using default', e);
            monsterName = 'unknown monster';
          }

          originalBoardData.board.push({
            tile: piece.tileIndex,
            monster: {
              name: monsterName,
              hp: monster.hp,
              ad: monster.ad,
              ap: monster.ap,
              armor: monster.armor,
              magicResist: monster.magicResist,
              level: monster.exp ? globalThis.state.utils.expToCurrentLevel(monster.exp) : 1
            }
          });
        }
      }
    });
  }

  const heroEntries = originalBoardData.board.filter(hero => hero.monster);
  if (heroEntries.length === 0) {
    return null;
  }

  return { originalBoardData, boardContext, playerContext };
}

function hasHeroesOnBoard() {
  try {
    return prepareHeroBoardData() !== null;
  } catch (error) {
    console.warn('[Hero Editor] Failed to check board heroes:', error);
    return false;
  }
}

function updateHeroEditorButtonState() {
  if (
    window.ModCoordination?.isModActive('Board Analyzer') ||
    window.ModCoordination?.isModActive('Manual Runner')
  ) {
    return;
  }

  const button = getHeroEditorButton();
  if (!button || button.style.display === 'none') return;

  const hasHeroes = hasHeroesOnBoard();
  if (hasHeroes) {
    button.style.opacity = '';
    button.style.filter = '';
    button.style.cursor = '';
    button.style.pointerEvents = '';
    button.removeAttribute('aria-disabled');
    api.ui.updateButton(HERO_EDITOR_BUTTON_ID, {
      tooltip: t('mods.heroEditor.buttonTooltip')
    });
  } else {
    button.style.opacity = '0.5';
    button.style.filter = 'grayscale(50%)';
    button.style.cursor = 'not-allowed';
    button.setAttribute('aria-disabled', 'true');
    const disabledTooltip = t('mods.heroEditor.buttonTooltipNoHeroes');
    api.ui.updateButton(HERO_EDITOR_BUTTON_ID, {
      tooltip: disabledTooltip
    });
    button.title = disabledTooltip;
  }
}

function subscribeHeroEditorBoardUpdates() {
  if (heroEditorBoardUnsubscribe || !globalThis.state?.board?.subscribe) return;

  heroEditorBoardUnsubscribe = globalThis.state.board.subscribe(() => {
    if (
      window.ModCoordination?.isModActive('Board Analyzer') ||
      window.ModCoordination?.isModActive('Manual Runner')
    ) {
      return;
    }
    updateHeroEditorButtonState();
  });
}

function unsubscribeHeroEditorBoardUpdates() {
  if (typeof heroEditorBoardUnsubscribe === 'function') {
    heroEditorBoardUnsubscribe();
    heroEditorBoardUnsubscribe = null;
  }
}

const HERO_EDITOR_CONTEXT_MENU_COLORS = {
  accent: '#e5c07b',
  white: '#ffffff'
};

let heroEditorOpenContextMenu = null;

function isSandboxModeEnabled() {
  try {
    const flags = new globalThis.state.utils.Flags(getPlayerSnapshot().flags);
    return flags.isSet('sandbox');
  } catch (error) {
    console.warn('[Hero Editor] Failed to check sandbox mode:', error);
    return false;
  }
}

function isBoardAllyCreatureButton(button) {
  if (!button) return false;
  if (button.closest('[role="menu"]') || button.closest('[role="dialog"]')) return false;
  if (
    button.closest('#monster-scroll') ||
    button.closest('.tab-picker-scroll') ||
    button.closest('[id*="monster-scroll"]')
  ) {
    return false;
  }

  // Inventory creatures use img[alt="creature"]; board pieces use outfit sprites.
  if (button.querySelector('img[alt="creature"]')) return false;
  if (!button.querySelector('.sprite.outfit')) return false;

  const isDraggable =
    button.getAttribute('aria-roledescription') === 'draggable' ||
    [...button.classList].some(className => className.includes('draggable'));
  if (!isDraggable) return false;

  return Boolean(
    button.closest('#viewport') ||
    button.closest('#tiles') ||
    button.closest('#background-scene')
  );
}

function getOutfitSpriteIdFromBoardButton(button) {
  const outfit = button?.querySelector?.('.sprite.outfit');
  if (!outfit) return null;
  const idClass = [...outfit.classList].find(className => className.startsWith('id-'));
  return idClass ? parseInt(idClass.replace('id-', ''), 10) : null;
}

function getAllySpriteId(piece) {
  if (!piece) return null;

  try {
    let gameId = piece.gameId;
    if (piece.type === 'player' && piece.databaseId) {
      const monster = getPlayerSnapshot().monsters?.find(m => m.id === piece.databaseId);
      gameId = monster?.gameId ?? gameId;
    }
    if (gameId == null) return null;

    const monsterData = globalThis.state.utils.getMonster(gameId);
    return monsterData?.metadata?.spriteId ?? gameId;
  } catch {
    return piece.gameId ?? null;
  }
}

function findAllyTileIndexByOutfitSprite(button) {
  const spriteId = getOutfitSpriteIdFromBoardButton(button);
  if (spriteId == null) return null;

  const allies = (getBoardSnapshot().boardConfig || []).filter(isAllyBoardPiece);
  const matches = allies.filter(piece => getAllySpriteId(piece) === spriteId);
  if (matches.length === 1) {
    return matches[0].tileIndex;
  }

  return null;
}

function getTileIndexFromBoardPosition(element) {
  const style = element?.getAttribute?.('style') || '';
  const rightMatch = /right:\s*calc\(\s*([\d.]+)px\s*\*\s*var\(--zoomFactor\)\s*\)/.exec(style);
  const bottomMatch = /bottom:\s*calc\(\s*([\d.]+)px\s*\*\s*var\(--zoomFactor\)\s*\)/.exec(style);
  if (!rightMatch || !bottomMatch) return null;

  const right = parseFloat(rightMatch[1]);
  const bottom = parseFloat(bottomMatch[1]);

  const tiles = document.querySelectorAll('[id^="tile-index-"]');
  for (const tile of tiles) {
    const tileStyle = tile.getAttribute('style') || '';
    const tileRightMatch = /right:\s*calc\(\s*([\d.]+)px\s*\*\s*var\(--zoomFactor\)\s*\)/.exec(tileStyle);
    const tileBottomMatch = /bottom:\s*calc\(\s*([\d.]+)px\s*\*\s*var\(--zoomFactor\)\s*\)/.exec(tileStyle);
    if (!tileRightMatch || !tileBottomMatch) continue;

    if (parseFloat(tileRightMatch[1]) === right && parseFloat(tileBottomMatch[1]) === bottom) {
      return parseInt(tile.id.replace('tile-index-', ''), 10);
    }
  }

  return null;
}

function getTileIndexFromElementBounds(element) {
  const buttonRect = element?.getBoundingClientRect?.();
  if (!buttonRect?.width) return null;

  const cx = buttonRect.left + buttonRect.width / 2;
  const cy = buttonRect.top + buttonRect.height / 2;
  const tiles = document.querySelectorAll('[id^="tile-index-"]');

  for (const tile of tiles) {
    const tileRect = tile.getBoundingClientRect();
    if (cx >= tileRect.left && cx <= tileRect.right && cy >= tileRect.top && cy <= tileRect.bottom) {
      return parseInt(tile.id.replace('tile-index-', ''), 10);
    }
  }

  let bestTile = null;
  let bestDist = Infinity;
  for (const tile of tiles) {
    const tileRect = tile.getBoundingClientRect();
    const tileCx = tileRect.left + tileRect.width / 2;
    const tileCy = tileRect.top + tileRect.height / 2;
    const dist = ((cx - tileCx) ** 2) + ((cy - tileCy) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestTile = tile;
    }
  }

  if (bestTile) {
    const tileRect = bestTile.getBoundingClientRect();
    const threshold = Math.max(tileRect.width, tileRect.height) * 0.6;
    if (bestDist <= threshold ** 2) {
      return parseInt(bestTile.id.replace('tile-index-', ''), 10);
    }
  }

  return null;
}

function getTileIndexFromBoardButton(button) {
  const tileEl = button?.closest?.('[id^="tile-index-"]');
  if (tileEl?.id) {
    const match = tileEl.id.match(/^tile-index-(\d+)$/);
    if (match) return parseInt(match[1], 10);
  }

  return (
    getTileIndexFromBoardPosition(button) ??
    getTileIndexFromElementBounds(button) ??
    findAllyTileIndexByOutfitSprite(button)
  );
}

function isAllyBoardPiece(piece) {
  return Boolean(
    piece &&
    (piece.type === 'player' || (piece.type === 'custom' && piece.villain === false))
  );
}

function getAllyPieceAtTile(tileIndex) {
  if (tileIndex == null) return null;
  try {
    const piece = getBoardSnapshot().boardConfig?.find(p => p.tileIndex === tileIndex);
    return isAllyBoardPiece(piece) ? piece : null;
  } catch {
    return null;
  }
}

function getAllyDisplayNameAtTile(tileIndex) {
  const piece = getAllyPieceAtTile(tileIndex);
  if (!piece) return null;

  try {
    if (piece.type === 'player' && piece.databaseId) {
      const monster = getPlayerSnapshot().monsters?.find(m => m.id === piece.databaseId);
      if (monster?.gameId) {
        return globalThis.state.utils.getMonster(monster.gameId).metadata.name;
      }
    } else if (piece.type === 'custom' && piece.gameId) {
      return globalThis.state.utils.getMonster(piece.gameId).metadata.name;
    }
  } catch (error) {
    console.warn('[Hero Editor] Could not resolve ally name:', error);
  }

  return null;
}

function closeHeroEditorBoardContextMenu() {
  if (heroEditorOpenContextMenu?.closeMenu) {
    heroEditorOpenContextMenu.closeMenu();
  }
}

function positionHeroEditorContextMenu(menu, clientX, clientY) {
  const padding = 8;
  const rect = menu.getBoundingClientRect();
  let left = clientX;
  let top = clientY;
  left = Math.max(padding, Math.min(left, window.innerWidth - rect.width - padding));
  top = Math.max(padding, Math.min(top, window.innerHeight - rect.height - padding));
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function createHeroEditorBoardContextMenu(anchorEl, tileIndex, clientX, clientY) {
  showHeroEditorModal({
    selectTileIndex: tileIndex,
    floating: true,
    floatingPosition: { x: clientX, y: clientY }
  });
}

function handleHeroEditorBoardContextMenu(event) {
  if (!config.enabled) return;

  const button = event.target.closest?.('button');
  if (!isBoardAllyCreatureButton(button)) return;
  if (!isSandboxModeEnabled() || !hasHeroesOnBoard()) return;

  let tileIndex = getTileIndexFromBoardButton(button);
  if (tileIndex != null && !getAllyPieceAtTile(tileIndex)) {
    tileIndex = findAllyTileIndexByOutfitSprite(button);
  }
  if (tileIndex == null || !getAllyPieceAtTile(tileIndex)) return;

  event.preventDefault();
  event.stopPropagation();
  createHeroEditorBoardContextMenu(button, tileIndex, event.clientX, event.clientY);
}

document.addEventListener('contextmenu', handleHeroEditorBoardContextMenu, true);

function buildBoardPayloadFromControls(originalBoardData, controls, equipMap) {
  const updatedBoardData = JSON.parse(JSON.stringify(originalBoardData));

  controls.forEach(control => {
    if (control.type === 'stat' && control.input) {
      const boardIndex = control.index;
      if (updatedBoardData.board[boardIndex]?.monster) {
        const rawValue = parseInt(control.input.value, 10);
        if (!Number.isFinite(rawValue)) return;

        if (control.stat === 'level') {
          updatedBoardData.board[boardIndex].monster[control.stat] = rawValue || 1;
        } else {
          updatedBoardData.board[boardIndex].monster[control.stat] = rawValue;
        }
      }
    } else if (control.type === 'equipName') {
      const hero = control.hero;
      const boardIndex = control.index;
      const statControl = controls.find(c => c.hero === hero && c.type === 'equipStat');
      const tierControl = controls.find(c => c.hero === hero && c.type === 'equipTier');

      if (statControl && tierControl && updatedBoardData.board[boardIndex]) {
        const equipName = control.select.value;

        if (!equipName || equipName === '') {
          delete updatedBoardData.board[boardIndex].equipment;
        } else {
          const equipId = equipMap.get(equipName.toLowerCase());
          if (equipId) {
            const equipData = globalThis.state.utils.getEquipment(equipId);
            if (equipData?.metadata) {
              updatedBoardData.board[boardIndex].equipment = {
                name: equipData.metadata.name.toLowerCase(),
                stat: statControl.select.value,
                tier: clampEquipTier(tierControl.input.value)
              };
            }
          }
        }
      }
    }
  });

  updatedBoardData.board.forEach((piece, pieceIndex) => {
    if (piece.monster?.name) {
      piece.monster.name = piece.monster.name.toLowerCase();
    }

    if (piece.monster) {
      const awakenControl = controls.find(c => c.type === 'awaken' && c.index === pieceIndex);
      const awakenEnabled = awakenControl?.getValue ? awakenControl.getValue() : false;

      piece.monster.awaken = awakenEnabled;
      piece.monster.awakened = awakenEnabled;
      piece.monster.isAwakened = awakenEnabled;
      piece.tier = awakenEnabled ? 5 : 4;

      if (piece.monster.level) {
        piece.monster.level = Number(piece.monster.level);
        piece.monster.exp = globalThis.state.utils.expAtLevel(piece.monster.level);
      }
    }
  });

  let currentFloor = updatedBoardData.floor;
  if (currentFloor === undefined || currentFloor === null) {
    try {
      currentFloor = getBoardSnapshot().floor ?? 0;
    } catch (e) {
      currentFloor = 0;
    }
  }

  return {
    region: updatedBoardData.region,
    map: updatedBoardData.map,
    floor: currentFloor,
    board: updatedBoardData.board.map(piece => {
      if (piece.monster?.level) {
        piece.monster.level = Number(piece.monster.level);
      }
      return piece;
    })
  };
}

function applyHeroChangesFromControls(originalBoardData, controls, equipMap, options = {}) {
  const { silent = true } = options;

  try {
    const payload = buildBoardPayloadFromControls(originalBoardData, controls, equipMap);
    const success = configureBoard(payload);

    if (!success) {
      throw new Error('Failed to apply changes');
    }

    if (window.DEBUG) {
      console.log('[Hero Editor] Live board update applied:', payload);
    }

    return true;
  } catch (error) {
    console.error('[Hero Editor] Error applying hero changes:', error);
    if (!silent) {
      api.ui.components.createModal({
        title: 'Error',
        content: `Failed to update heroes: ${error.message || error}`,
        buttons: [{ text: 'OK', primary: true }]
      });
    }
    return false;
  }
}

function buildPortraitLevelIndicator(level) {
  const levelContainer = document.createElement('div');
  levelContainer.className = 'pixel-font-16 absolute bottom-0 left-0 z-1 flex size-full items-end pl-0.5 text-whiteExp';
  levelContainer.style.cssText = 'line-height: 0.8; background: radial-gradient(circle at left bottom, rgba(0, 0, 0, 0.5) 6px, transparent 24px);';

  const levelText = document.createElement('span');
  levelText.className = 'relative font-outlined-fill text-transparent revert-pixel-font-spacing -translate-x-px';
  levelText.style.cssText = 'line-height: 0.9; font-size: 16px';
  levelText.setAttribute('translate', 'no');
  levelText.textContent = String(level);

  const levelCanvas = document.createElement('canvas');
  levelCanvas.className = 'font-outlined pixelated pointer-events-none absolute top-0 transition-opacity';
  levelCanvas.width = 17;
  levelCanvas.height = 16;
  levelCanvas.style.left = '-1px';

  levelText.appendChild(levelCanvas);
  levelContainer.appendChild(levelText);
  return levelContainer;
}

function buildVisiblePortraitLevelIndicator(level) {
  const levelBadge = document.createElement('span');
  levelBadge.setAttribute('translate', 'no');
  levelBadge.textContent = String(level);
  levelBadge.style.cssText = 'position: absolute; bottom: 0; left: 2px; color: white; font-size: 12px; background: rgba(0, 0, 0, 0.7); padding: 0 2px; z-index: 2;';
  return levelBadge;
}

function ensurePortraitLevelOutline(portraitRoot) {
  if (!portraitRoot) return;

  requestAnimationFrame(() => {
    portraitRoot.querySelectorAll('canvas.font-outlined').forEach((canvas) => {
      canvas.removeAttribute('data-loaded');
    });
  });
}

function findPortraitLevelSpan(portraitRoot) {
  if (!portraitRoot) return null;
  return (
    portraitRoot.querySelector('span[translate="no"]') ||
    portraitRoot.querySelector('img[alt="creature"] + span') ||
    portraitRoot.querySelector('img[alt="Monster"] + span') ||
    portraitRoot.querySelector(':scope > span')
  );
}

function stripPortraitLevelIndicators(portraitRoot) {
  if (!portraitRoot) return;
  portraitRoot.querySelectorAll('.pixel-font-16').forEach((element) => element.remove());
  const levelSpan = findPortraitLevelSpan(portraitRoot);
  if (levelSpan) levelSpan.remove();
}

function updateHeroPortraitLevel(portraitRoot, level) {
  if (!portraitRoot) return;
  const parsedLevel = parseInt(level, 10);
  if (!Number.isFinite(parsedLevel)) return;
  const levelSpan = findPortraitLevelSpan(portraitRoot);
  if (levelSpan) {
    levelSpan.textContent = String(parsedLevel);
    ensurePortraitLevelOutline(portraitRoot);
  }
}

function calculateTierFromStats(monster) {
  if (!monster) return 1;

  const statSum = (Number(monster.hp) || 0) +
    (Number(monster.ad) || 0) +
    (Number(monster.ap) || 0) +
    (Number(monster.armor) || 0) +
    (Number(monster.magicResist) || 0);

  if (statSum >= 80) return 5;
  if (statSum >= 70) return 4;
  if (statSum >= 60) return 3;
  if (statSum >= 50) return 2;
  return 1;
}

function isHeroMaxGenes(monster, level) {
  const parsedLevel = Number(level);
  if (parsedLevel !== 99) return false;

  return Number(monster.hp ?? 1) === 20 &&
    Number(monster.ad ?? 1) === 20 &&
    Number(monster.ap ?? 1) === 20 &&
    Number(monster.armor ?? 1) === 20 &&
    Number(monster.magicResist ?? 1) === 20;
}

function isHeroAwakened(monster, level) {
  return monster.awaken === true ||
    monster.awakened === true ||
    monster.isAwakened === true ||
    Number(level) > 50;
}

function applyHeroMonsterPortraitBorder(slot, monster, level) {
  const statTier = calculateTierFromStats(monster);
  const maxGenes = isHeroMaxGenes(monster, level);
  const awakened = isHeroAwakened(monster, level);
  const shiny = monster.shiny === true;

  let rarityBg = slot.querySelector('.has-rarity, .rarity-awaken, .rarity-shiny, .rarity-hundo');
  if (!rarityBg) {
    rarityBg = document.createElement('div');
    slot.insertBefore(rarityBg, slot.firstChild);
  }

  if (maxGenes && shiny) {
    rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-shiny';
    rarityBg.removeAttribute('data-rarity');
  } else if (maxGenes) {
    rarityBg.className = 'absolute inset-0 z-1 opacity-80 rarity-hundo';
    rarityBg.removeAttribute('data-rarity');
  } else if (awakened) {
    rarityBg.className = 'absolute inset-0 z-2 opacity-80 rarity-awaken';
    rarityBg.removeAttribute('data-rarity');
  } else {
    rarityBg.className = 'has-rarity absolute inset-0 z-1 opacity-80';
    rarityBg.setAttribute('data-rarity', Math.min(5, statTier));
  }

  let starIcon = slot.querySelector('img.tier-stars, img[alt="star tier"], img[alt="shiny-tier"], img[alt="hundo-tier"]');
  if (maxGenes) {
    const iconSrc = shiny ? '/assets/icons/star-tier-shiny.png' : '/assets/icons/star-tier-hundo.png';
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      slot.appendChild(starIcon);
    }
    starIcon.src = iconSrc;
    starIcon.alt = shiny ? 'shiny-tier' : 'hundo-tier';
  } else if (awakened) {
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      starIcon.alt = 'star tier';
      slot.appendChild(starIcon);
    }
    starIcon.src = '/assets/icons/star-tier-awaken.png';
    starIcon.alt = 'star tier';
  } else if (statTier > 1) {
    if (!starIcon) {
      starIcon = document.createElement('img');
      starIcon.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
      starIcon.alt = 'star tier';
      slot.appendChild(starIcon);
    }
    starIcon.src = `/assets/icons/star-tier-${Math.min(4, statTier)}.png`;
  } else if (starIcon) {
    starIcon.remove();
  }
}

function createHeroMonsterPortraitSlot({ monsterId, level, monster, size = 32, hideLevel = false }) {
  const statTier = calculateTierFromStats(monster);
  const parsedLevel = Number(level) || 1;

  if (window.BestiaryUIComponents?.createMonsterPortrait) {
    const root = window.BestiaryUIComponents.createMonsterPortrait({
      monsterId,
      level: parsedLevel,
      tier: statTier
    });
    const slot = root.querySelector('.container-slot');
    if (slot) {
      slot.remove();
      slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden shrink-0';
      slot.style.width = `${size}px`;
      slot.style.height = `${size}px`;

      const img = slot.querySelector('img[alt="creature"]');
      if (img) {
        img.width = size;
        img.height = size;
      }

      applyHeroMonsterPortraitBorder(slot, monster, parsedLevel);
      if (hideLevel) {
        stripPortraitLevelIndicators(slot);
      } else {
        ensurePortraitLevelOutline(slot);
      }
      return slot;
    }
  }

  const slot = document.createElement('div');
  slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden shrink-0';
  slot.style.width = `${size}px`;
  slot.style.height = `${size}px`;

  if (!hideLevel) {
    slot.appendChild(buildPortraitLevelIndicator(parsedLevel));
  }

  const monsterImg = document.createElement('img');
  monsterImg.className = 'pixelated ml-auto';
  monsterImg.alt = 'creature';
  monsterImg.width = size;
  monsterImg.height = size;
  monsterImg.src = `/assets/portraits/${monsterId}.png`;

  slot.appendChild(monsterImg);
  applyHeroMonsterPortraitBorder(slot, monster, parsedLevel);

  if (!hideLevel) {
    if (!window.BestiaryUIComponents) {
      slot.querySelector('.pixel-font-16')?.remove();
      slot.appendChild(buildVisiblePortraitLevelIndicator(parsedLevel));
    } else {
      ensurePortraitLevelOutline(slot);
    }
  }

  return slot;
}

function refreshHeroMonsterPortraitSlot(slot, options) {
  if (!slot) return null;

  const nextSlot = createHeroMonsterPortraitSlot(options);
  slot.replaceWith(nextSlot);
  if (!options.hideLevel) {
    ensurePortraitLevelOutline(nextSlot);
  }
  return nextSlot;
}

function resolveHeroMonsterInfo(hero, boardContext, monsterMap) {
  let monsterName = hero.monster.name || 'Unknown Monster';
  let monsterGameId = null;

  if (boardContext.boardConfig) {
    const boardPiece = boardContext.boardConfig.find(p =>
      p.tileIndex === hero.tile && (p.type === 'player' || p.type === 'custom'));

    if (boardPiece) {
      if (boardPiece.type === 'player') {
        monsterGameId = getMonsterGameIdFromDatabaseId(boardPiece.databaseId);
      } else if (boardPiece.type === 'custom') {
        monsterGameId = boardPiece.gameId;
      }
    }
  }

  if (!monsterGameId) {
    monsterGameId = monsterMap.get(monsterName.toLowerCase());
  }

  if (monsterGameId) {
    const originalName = getMonsterNameFromId(monsterGameId);
    if (originalName) monsterName = originalName;
  }

  let monsterLevel = hero.monster.level || 1;

  if (hero.monster.exp && (!hero.monster.level || hero.monster.level === 1)) {
    try {
      monsterLevel = globalThis.state.utils.expToCurrentLevel(hero.monster.exp);
      hero.monster.level = monsterLevel;
    } catch (e) {
      console.warn('Error calculating level from exp:', e);
    }
  }

  if (!hero.monster.exp && boardContext.boardConfig) {
    const boardPiece = boardContext.boardConfig.find(p =>
      p.tileIndex === hero.tile && p.type === 'player' && p.databaseId);

    if (boardPiece) {
      const playerContext = getPlayerSnapshot();
      const monster = playerContext.monsters.find(m => m.id === boardPiece.databaseId);

      if (monster && monster.exp) {
        try {
          monsterLevel = globalThis.state.utils.expToCurrentLevel(monster.exp);
          hero.monster.level = monsterLevel;
          hero.monster.exp = monster.exp;
        } catch (e) {
          console.warn('Error calculating level from player context exp:', e);
        }
      }
    }
  }

  if (monsterLevel === 1 && !hero.monster.exp) {
    monsterLevel = 50;
    hero.monster.level = 50;
  }

  return { monsterName, monsterGameId, monsterLevel };
}

function createEmptyEquipmentPlaceholder(sizePx = HERO_EDITOR_EQUIPMENT_PORTRAIT_SIZE) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'focus-style-visible container-slot surface-darker size-[34px] active:opacity-70 disabled:opacity-100';
  button.style.width = `${sizePx}px`;
  button.style.height = `${sizePx}px`;
  button.style.maxWidth = `${sizePx}px`;
  button.style.maxHeight = `${sizePx}px`;
  button.style.flexShrink = '0';
  button.disabled = true;
  button.tabIndex = -1;

  const grid = document.createElement('div');
  grid.className = 'grid size-full place-items-center';
  grid.setAttribute('data-state', 'closed');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'lucide lucide-circle-plus size-4 text-whiteDarker');
  svg.setAttribute('aria-hidden', 'true');

  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '12');
  circle.setAttribute('cy', '12');
  circle.setAttribute('r', '10');
  svg.appendChild(circle);

  const horizontalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  horizontalPath.setAttribute('d', 'M8 12h8');
  svg.appendChild(horizontalPath);

  const verticalPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  verticalPath.setAttribute('d', 'M12 8v8');
  svg.appendChild(verticalPath);

  grid.appendChild(svg);
  button.appendChild(grid);
  return button;
}

function resolveHeroEquipmentInfo(hero, equipMap) {
  let equipName = '';
  let equipStat = 'ad';
  let equipTier = 1;
  let equipGameId = null;
  const hasEquipment = !!(hero.equipment && hero.equipment.name);

  if (hasEquipment) {
    equipName = hero.equipment.name || 'Unknown Item';
    equipStat = hero.equipment.stat || 'ad';
    equipTier = clampEquipTier(hero.equipment.tier || 1);

    if (window.equipmentNamesToGameIds) {
      equipGameId = window.equipmentNamesToGameIds.get(equipName.toLowerCase());
    }

    if (!equipGameId && equipMap) {
      equipGameId = equipMap.get(equipName.toLowerCase());
    }

    if (equipGameId) {
      const originalName = getEquipmentNameFromId(equipGameId);
      if (originalName) equipName = originalName;
    }
  }

  return { equipName, equipStat, equipTier, equipGameId, hasEquipment };
}

function updateListEquipPortrait(wrap, equipMap, equipName, equipStat, equipTier) {
  while (wrap.firstChild) {
    wrap.removeChild(wrap.firstChild);
  }

  if (!equipName) {
    wrap.appendChild(createEmptyEquipmentPlaceholder());
    return;
  }

  let equipGameId = window.equipmentNamesToGameIds?.get(equipName.toLowerCase());
  if (!equipGameId && equipMap) {
    equipGameId = equipMap.get(equipName.toLowerCase());
  }
  if (!equipGameId) return;

  try {
    const equipData = globalThis.state.utils.getEquipment(equipGameId);
    if (equipData?.metadata) {
      wrap.appendChild(createHeroEditorItemPortrait({
        itemId: equipData.metadata.spriteId,
        stat: equipStat,
        tier: clampEquipTier(equipTier)
      }));
    }
  } catch (e) {
    console.error('Error updating list equip portrait:', e);
  }
}

function createHeroEditorLiveApplyContext(preparedBoard) {
  const { originalBoardData, boardContext } = preparedBoard;
  const equipMap = buildEquipmentMap();
  const monsterMap = buildMonsterMap();
  const controls = [];
  let liveApplyTimer = null;
  const LIVE_APPLY_DELAY_MS = 250;

  const scheduleLiveApply = (immediate = false) => {
    if (liveApplyTimer) {
      clearTimeout(liveApplyTimer);
      liveApplyTimer = null;
    }

    const runApply = () => {
      applyHeroChangesFromControls(originalBoardData, controls, equipMap, { silent: true });
    };

    if (immediate) {
      runApply();
    } else {
      liveApplyTimer = setTimeout(runApply, LIVE_APPLY_DELAY_MS);
    }
  };

  const clearLiveApplyTimer = () => {
    if (liveApplyTimer) {
      clearTimeout(liveApplyTimer);
      liveApplyTimer = null;
    }
  };

  return { originalBoardData, boardContext, equipMap, monsterMap, controls, scheduleLiveApply, clearLiveApplyTimer };
}

function mountHeroEditorFloatingPanel(detailContent, clientX, clientY, clearLiveApplyTimer) {
  closeHeroEditorBoardContextMenu();

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position: fixed; inset: 0; z-index: 10000000; background: transparent; pointer-events: auto;';

  const menu = document.createElement('div');
  menu.className = 'hero-editor-floating-panel';
  menu.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    z-index: 10000001;
    width: min(250px, calc(100vw - 16px));
    height: auto;
    max-height: calc(100vh - 16px);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: url('https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png') repeat;
    border: 4px solid transparent;
    border-image: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
    border-radius: 6px;
    padding: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    box-sizing: border-box;
  `;

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'frame-pressed-1 surface-dark box-border overflow-x-hidden';
  scrollWrap.style.cssText = 'padding: 4px; flex: 0 1 auto; overflow-y: auto; max-height: calc(100vh - 56px);';
  scrollWrap.appendChild(detailContent);
  menu.appendChild(scrollWrap);

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'pixel-font-12 shrink-0';
  closeButton.textContent = t('mods.heroEditor.contextMenuClose');
  closeButton.style.cssText = `
    width: 100%;
    height: 22px;
    margin-top: 6px;
    padding: 0 6px;
    background: #1a1a1a;
    color: #888888;
    border: 1px solid #555;
    border-radius: 3px;
    cursor: pointer;
    font-size: ${HERO_EDITOR_FLOATING_UI.fontSize};
    font-weight: bold;
    flex: 0 0 auto;
  `;
  menu.appendChild(closeButton);

  function closeMenu() {
    clearLiveApplyTimer?.();
    overlay.removeEventListener('mousedown', overlayClickHandler);
    overlay.removeEventListener('click', overlayClickHandler);
    document.removeEventListener('keydown', escHandler);
    overlay.remove();
    menu.remove();
    if (heroEditorOpenContextMenu?.overlay === overlay) {
      heroEditorOpenContextMenu = null;
    }
  }

  const overlayClickHandler = (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  };
  const escHandler = (event) => {
    if (event.key === 'Escape') closeMenu();
  };

  closeButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeMenu();
  });

  menu.addEventListener('mousedown', (event) => event.stopPropagation());
  menu.addEventListener('click', (event) => event.stopPropagation());
  menu.addEventListener('contextmenu', (event) => event.preventDefault());

  document.body.appendChild(overlay);
  document.body.appendChild(menu);
  overlay.addEventListener('mousedown', overlayClickHandler);
  overlay.addEventListener('click', overlayClickHandler);
  document.addEventListener('keydown', escHandler);

  positionHeroEditorContextMenu(menu, clientX, clientY);
  requestAnimationFrame(() => {
    positionHeroEditorContextMenu(menu, clientX, clientY);
  });

  heroEditorOpenContextMenu = { overlay, menu, closeMenu };
}

updateHeroEditorButtonState();
subscribeHeroEditorBoardUpdates();

// Main function to show the hero editor modal
function showHeroEditorModal(options) {
  const modalOptions = options && !(options instanceof Event) ? options : {};
  const selectTileIndex = modalOptions.selectTileIndex;
  const isFloating = modalOptions.floating === true;
  const floatingPosition = modalOptions.floatingPosition || { x: 0, y: 0 };

  try {
    if (!isFloating) {
      closeHeroEditorBoardContextMenu();
    }

    if (!hasHeroesOnBoard()) {
      return;
    }

    // Check if sandbox mode is enabled
    const playerContext = getPlayerSnapshot();
    const playerFlags = playerContext.flags;
    
    // Create Flags object to check sandbox mode
    const flags = new globalThis.state.utils.Flags(playerFlags);
    if (!flags.isSet("sandbox")) {
      api.ui.components.createModal({
        title: 'Sandbox Mode Required',
        content: 'Hero Editor requires Sandbox Mode to be enabled.',
        buttons: [{ text: 'OK', primary: true }]
      });
      return;
    }
    
    const preparedBoard = prepareHeroBoardData();
    if (!preparedBoard) {
      updateHeroEditorButtonState();
      return;
    }

    const { originalBoardData, boardContext } = preparedBoard;
    
    console.log('Original board data:', originalBoardData);
    
    // Create a deep copy for editing
    const editableBoardData = JSON.parse(JSON.stringify(originalBoardData));
    
    // Build equipment map
    const equipMap = buildEquipmentMap();
    
    // Build monster map
    const monsterMap = buildMonsterMap();
    
    // Keep track of controls for reset/live-apply functionality
    const controls = [];
    let liveApplyTimer = null;
    const LIVE_APPLY_DELAY_MS = 250;

    const scheduleLiveApply = (immediate = false) => {
      if (liveApplyTimer) {
        clearTimeout(liveApplyTimer);
        liveApplyTimer = null;
      }

      const runApply = () => {
        applyHeroChangesFromControls(originalBoardData, controls, equipMap, { silent: true });
      };

      if (immediate) {
        runApply();
      } else {
        liveApplyTimer = setTimeout(runApply, LIVE_APPLY_DELAY_MS);
      }
    };
    
    const contentContainer = document.createElement('div');
    contentContainer.className = 'flex min-h-0 flex-1 flex-col';
    contentContainer.style.height = '100%';

    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'hero-editor-modal-columns flex min-h-0 w-full flex-1 gap-2';
    columnsContainer.style.flex = '1 1 0';

    const col1 = document.createElement('div');
    col1.className = 'hero-editor-modal-left flex min-h-0 shrink-0 flex-col';
    col1.style.width = '100px';
    col1.style.flex = '0 0 100px';

    const col1Header = document.createElement('div');
    col1Header.className = 'pixel-font-12 text-whiteRegular mb-1 shrink-0';
    col1Header.textContent = 'Allies';

    const listScrollContainer = createHeroEditorScrollContainer();
    listScrollContainer.element.classList.add('hero-editor-list-scroll');
    listScrollContainer.element.style.width = '100%';
    Object.assign(listScrollContainer.contentContainer.style, {
      width: '100%',
      gridTemplateColumns: 'minmax(0, 1fr)'
    });
    listScrollContainer.contentContainer.classList.remove('items-start');
    listScrollContainer.contentContainer.classList.add('items-stretch');
    const listScrollWrapper = listScrollContainer.contentContainer.parentElement;
    if (listScrollWrapper) {
      listScrollWrapper.style.width = '100%';
    }

    const col2 = document.createElement('div');
    col2.className = 'hero-editor-modal-right flex min-h-0 min-w-0 flex-1 flex-col';
    col2.style.flex = '1 1 0';

    const col2Header = document.createElement('div');
    col2Header.className = 'pixel-font-12 text-whiteRegular mb-1 shrink-0';
    col2Header.textContent = 'Details';

    const detailHost = document.createElement('div');
    detailHost.className = 'hero-editor-detail-host frame-pressed-1 surface-dark relative box-border min-h-0 flex-1 overflow-hidden';
    detailHost.style.padding = '5px';
    detailHost.style.flex = '1 1 0';

    const listItems = [];
    const detailPanels = [];
    let selectedHeroIndex = null;
    let floatingDetailPanel = null;

    const getListItemClass = (isActive) => (
      isActive
        ? 'frame-pressed-1 surface-regular box-border flex w-full min-w-0 cursor-pointer items-center justify-center gap-1 p-1 tab-active'
        : 'frame-1 surface-dark box-border flex w-full min-w-0 cursor-pointer items-center justify-center gap-1 p-1'
    );

    const refreshListEquipPortrait = (boardIndex, equipName, equipStat, equipTier) => {
      const listEntry = listItems.find(item => item.index === boardIndex);
      if (listEntry?.listEquipPortraitWrap) {
        updateListEquipPortrait(listEntry.listEquipPortraitWrap, equipMap, equipName, equipStat, equipTier);
      }
    };

    const selectHero = (boardIndex) => {
      selectedHeroIndex = boardIndex;
      detailPanels.forEach(({ index, element }) => {
        element.style.display = index === boardIndex ? 'flex' : 'none';
      });
      listItems.forEach(({ index, element }) => {
        element.className = getListItemClass(index === boardIndex);
      });
    };

    const findPortraitLevelSpan = (portraitRoot) => {
      if (!portraitRoot) return null;
      return (
        portraitRoot.querySelector('span[translate="no"]') ||
        portraitRoot.querySelector('img[alt="Monster"] + span') ||
        portraitRoot.querySelector(':scope > span')
      );
    };

    const updateHeroPortraitLevelLocal = (portraitRoot, level) => {
      updateHeroPortraitLevel(portraitRoot, level);
    };

    const updateHeroPortraitLevels = (boardIndex, level) => {
      const listEntry = listItems.find(item => item.index === boardIndex);
      updateHeroPortraitLevelLocal(listEntry?.listPortrait, level);
      const detailEntry = detailPanels.find(panel => panel.index === boardIndex);
      updateHeroPortraitLevelLocal(detailEntry?.headerPortrait, level);
    };

    const refreshHeroMonsterPortraits = (boardIndex, monsterGameId, level, monster) => {
      if (!monsterGameId || !monster) return;

      const listEntry = listItems.find(item => item.index === boardIndex);
      if (listEntry?.listPortrait) {
        listEntry.listPortrait = refreshHeroMonsterPortraitSlot(listEntry.listPortrait, {
          monsterId: monsterGameId,
          level,
          monster,
          size: 32,
          hideLevel: isFloating
        });
      }

      const detailEntry = detailPanels.find(panel => panel.index === boardIndex);
      if (detailEntry?.headerPortrait) {
        detailEntry.headerPortrait = refreshHeroMonsterPortraitSlot(detailEntry.headerPortrait, {
          monsterId: monsterGameId,
          level,
          monster,
          size: isFloating ? parseInt(HERO_EDITOR_FLOATING_UI.portraitSize, 10) || 24 : 36,
          hideLevel: isFloating
        });
      }
    };
    
    // Create detail panels and list entries for each hero
    editableBoardData.board.forEach((hero, index) => {
      // Only process pieces with monsters
      if (!hero.monster) return;

      if (isFloating && selectTileIndex != null && hero.tile !== selectTileIndex) return;
      
      // Get the properly cased monster name
      const { monsterName, monsterGameId, monsterLevel } = resolveHeroMonsterInfo(hero, boardContext, monsterMap);
      const { equipName, equipStat, equipTier, equipGameId, hasEquipment } = resolveHeroEquipmentInfo(hero, equipMap);

      const initialAwakenEnabled = hero.monster.awaken === true ||
        hero.monster.awakened === true ||
        hero.monster.isAwakened === true;
      const initialMaxGenesEnabled = monsterLevel === 99 &&
        Number(hero.monster.hp || 1) === 20 &&
        Number(hero.monster.ad || 1) === 20 &&
        Number(hero.monster.ap || 1) === 20 &&
        Number(hero.monster.armor || 1) === 20 &&
        Number(hero.monster.magicResist || 1) === 20;
      const initialPortraitMonster = {
        ...hero.monster,
        awaken: initialAwakenEnabled || initialMaxGenesEnabled,
        awakened: initialAwakenEnabled || initialMaxGenesEnabled,
        isAwakened: initialAwakenEnabled || initialMaxGenesEnabled
      };
      
      const detailPanel = document.createElement('div');
      detailPanel.className = isFloating ? 'flex w-full flex-col gap-1' : 'flex w-full flex-col gap-2';
      detailPanel.style.display = isFloating ? 'flex' : 'none';
      if (isFloating) {
        floatingDetailPanel = detailPanel;
      }

      if (!isFloating) {
      const listItem = document.createElement('button');
      listItem.type = 'button';
      listItem.className = getListItemClass(false);
      listItem.style.width = '100%';
      listItem.style.boxSizing = 'border-box';

      let listPortrait = null;
      if (monsterGameId) {
        try {
          listPortrait = createHeroMonsterPortraitSlot({
            monsterId: monsterGameId,
            level: monsterLevel,
            monster: initialPortraitMonster,
            size: 32
          });
          listItem.appendChild(listPortrait);
        } catch (e) {
          console.error('Error creating list portrait:', e);
        }
      }

      const listEquipPortraitWrap = document.createElement('div');
      listEquipPortraitWrap.className = 'frame-pressed-1 shrink-0 flex items-center justify-center overflow-hidden';
      listEquipPortraitWrap.style.cssText = `width: ${HERO_EDITOR_EQUIPMENT_PORTRAIT_SIZE}px; height: ${HERO_EDITOR_EQUIPMENT_PORTRAIT_SIZE}px;`;
      updateListEquipPortrait(listEquipPortraitWrap, equipMap, equipName, equipStat, equipTier);
      listItem.appendChild(listEquipPortraitWrap);

      listItem.addEventListener('click', () => selectHero(index));

      listItems.push({ index, element: listItem, listPortrait, listEquipPortraitWrap });
      if (selectedHeroIndex === null) {
        selectedHeroIndex = index;
      }
      listScrollContainer.addContent(listItem);
      }

      detailPanels.push({ index, element: detailPanel, headerPortrait: null });
      if (isFloating) {
        selectedHeroIndex = index;
      }

      const headerContainer = document.createElement('div');
      headerContainer.className = isFloating
        ? 'flex w-full items-center justify-between gap-1'
        : 'flex w-full items-center justify-between gap-2';

      const headerLeftContainer = document.createElement('div');
      headerLeftContainer.className = 'flex min-w-0 flex-1 items-center gap-2';
      
      // Create monster portrait if we have the ID
      let headerPortrait = null;
      if (monsterGameId) {
        try {
          headerPortrait = createHeroMonsterPortraitSlot({
            monsterId: monsterGameId,
            level: monsterLevel,
            monster: initialPortraitMonster,
            size: isFloating ? parseInt(HERO_EDITOR_FLOATING_UI.portraitSize, 10) || 24 : 36,
            hideLevel: isFloating
          });
          headerLeftContainer.appendChild(headerPortrait);
        } catch (e) {
          console.error('Error creating monster portrait:', e);
        }
      }

      const detailPanelEntry = detailPanels.find(panel => panel.index === index);
      if (detailPanelEntry) {
        detailPanelEntry.headerPortrait = headerPortrait;
      }
      
      const nameElement = document.createElement('h3');
      nameElement.textContent = toTitleCase(monsterName);
      nameElement.className = isFloating
        ? 'text-whiteExp min-w-0 truncate'
        : 'text-whiteExp pixel-font-16 min-w-0 truncate';
      if (isFloating) {
        applyHeroEditorFloatingFont(nameElement, HERO_EDITOR_FLOATING_UI.titleFontSize);
      }
      
      headerLeftContainer.appendChild(nameElement);
      
      // Per-creature awakened toggle
      let awakenEnabled = initialAwakenEnabled;
      let activeTopMode = initialMaxGenesEnabled ? 'maxGenes' : (initialAwakenEnabled ? 'awaken' : 'normal');
      if (initialMaxGenesEnabled) awakenEnabled = true;
      const statInputs = {};

      const getPortraitMonster = () => ({
        ...hero.monster,
        hp: Number(statInputs.hp?.value ?? hero.monster.hp ?? 1),
        ad: Number(statInputs.ad?.value ?? hero.monster.ad ?? 1),
        ap: Number(statInputs.ap?.value ?? hero.monster.ap ?? 1),
        armor: Number(statInputs.armor?.value ?? hero.monster.armor ?? 1),
        magicResist: Number(statInputs.magicResist?.value ?? hero.monster.magicResist ?? 1),
        level: Number(statInputs.level?.value ?? monsterLevel),
        awaken: awakenEnabled,
        awakened: awakenEnabled,
        isAwakened: awakenEnabled
      });

      const refreshPortraitAppearance = () => {
        refreshHeroMonsterPortraits(
          index,
          monsterGameId,
          Number(statInputs.level?.value || monsterLevel),
          getPortraitMonster()
        );
      };
      
      const awakenButton = document.createElement('button');
      const TOP_BUTTON_SIZE = isFloating ? HERO_EDITOR_FLOATING_UI.topButtonSize : '23px';
      awakenButton.className = 'widget-top widget-top-text pixel-font-16';
      awakenButton.type = 'button';
      awakenButton.style.margin = '0';
      awakenButton.style.padding = '2px 8px';
      awakenButton.style.textAlign = 'center';
      awakenButton.style.color = '#fff';
      awakenButton.style.cursor = 'pointer';
      awakenButton.style.width = TOP_BUTTON_SIZE;
      awakenButton.style.flex = `0 0 ${TOP_BUTTON_SIZE}`;
      awakenButton.style.display = 'flex';
      awakenButton.style.alignItems = 'center';
      awakenButton.style.justifyContent = 'center';
      awakenButton.style.height = TOP_BUTTON_SIZE;
      awakenButton.style.outline = 'none';
      awakenButton.style.flexShrink = '0';
      const GREEN_BUTTON_BG = "url('https://bestiaryarena.com/_next/static/media/background-green.be515334.png') repeat";
      const REGULAR_BUTTON_BG = "url('https://bestiaryarena.com/_next/static/media/background-regular.b0337118.png') repeat";

      const awakenIcon = document.createElement('img');
      awakenIcon.src = '/assets/icons/star-tier-awaken.png';
      awakenIcon.alt = 'Awakened Ability';
      awakenIcon.style.width = '10px';
      awakenIcon.style.height = '10px';
      awakenButton.appendChild(awakenIcon);
      
      const refreshTopButtons = () => {
        const awakenActive = activeTopMode === 'awaken';
        const maxGenesActive = activeTopMode === 'maxGenes';
        awakenButton.title = awakenEnabled ? 'Awakened Mode' : 'Normal Mode';
        awakenButton.style.background = awakenActive ? GREEN_BUTTON_BG : REGULAR_BUTTON_BG;
        awakenButton.style.backgroundSize = 'auto';
        awakenButton.style.border = awakenActive ? '1px solid #4CAF50' : '1px solid #666';
        awakenButton.style.filter = awakenActive ? 'none' : 'grayscale(100%) brightness(0.9)';
        maxGenesButton.style.background = maxGenesActive ? GREEN_BUTTON_BG : REGULAR_BUTTON_BG;
        maxGenesButton.style.backgroundSize = 'auto';
        maxGenesButton.style.border = maxGenesActive ? '1px solid #4CAF50' : '1px solid #666';
        maxGenesButton.style.filter = maxGenesActive ? 'none' : 'grayscale(100%) brightness(0.9)';
      };

      const isMaxGenesPreset = () => {
        return Number(statInputs.level?.value || 0) === 99 &&
          Number(statInputs.hp?.value || 0) === 20 &&
          Number(statInputs.ad?.value || 0) === 20 &&
          Number(statInputs.ap?.value || 0) === 20 &&
          Number(statInputs.armor?.value || 0) === 20 &&
          Number(statInputs.magicResist?.value || 0) === 20;
      };

      const syncTopModeFromStats = () => {
        if (isMaxGenesPreset()) {
          activeTopMode = 'maxGenes';
        } else {
          activeTopMode = 'awaken';
        }
        awakenEnabled = true;
        refreshTopButtons();
      };
      
      awakenButton.addEventListener('click', () => {
        const willActivate = activeTopMode !== 'awaken';
        activeTopMode = willActivate ? 'awaken' : 'normal';
        awakenEnabled = willActivate;
        refreshTopButtons();
        refreshPortraitAppearance();
        scheduleLiveApply(true);
      });

      const maxGenesButton = document.createElement('button');
      maxGenesButton.className = 'widget-top widget-top-text pixel-font-16';
      maxGenesButton.type = 'button';
      maxGenesButton.style.margin = '0';
      maxGenesButton.style.padding = '2px 8px';
      maxGenesButton.style.textAlign = 'center';
      maxGenesButton.style.color = '#fff';
      maxGenesButton.style.cursor = 'pointer';
      maxGenesButton.style.width = TOP_BUTTON_SIZE;
      maxGenesButton.style.flex = `0 0 ${TOP_BUTTON_SIZE}`;
      maxGenesButton.style.display = 'flex';
      maxGenesButton.style.alignItems = 'center';
      maxGenesButton.style.justifyContent = 'center';
      maxGenesButton.style.height = TOP_BUTTON_SIZE;
      maxGenesButton.style.outline = 'none';
      maxGenesButton.style.flexShrink = '0';
      maxGenesButton.title = 'Max Awakened Mode';

      const maxGenesIcon = document.createElement('img');
      maxGenesIcon.src = '/assets/icons/star-tier-shiny.png';
      maxGenesIcon.alt = 'Max Genes Preset';
      maxGenesIcon.style.width = '10px';
      maxGenesIcon.style.height = '10px';
      maxGenesButton.appendChild(maxGenesIcon);

      maxGenesButton.addEventListener('click', () => {
        const willActivate = activeTopMode !== 'maxGenes';
        activeTopMode = willActivate ? 'maxGenes' : 'normal';
        awakenEnabled = willActivate;

        if (willActivate) {
          if (statInputs.level) statInputs.level.value = '99';
          ['hp', 'ad', 'ap', 'armor', 'magicResist'].forEach((statKey) => {
            if (statInputs[statKey]) statInputs[statKey].value = '20';
          });
        }
        syncTopModeFromStats();
        refreshPortraitAppearance();
        scheduleLiveApply(true);
      });

      refreshTopButtons();
      headerContainer.appendChild(headerLeftContainer);
      const headerRightContainer = document.createElement('div');
      headerRightContainer.className = 'flex shrink-0 items-center gap-1.5';
      headerRightContainer.appendChild(maxGenesButton);
      headerRightContainer.appendChild(awakenButton);
      headerContainer.appendChild(headerRightContainer);
      detailPanel.appendChild(headerContainer);
      
      controls.push({
        index,
        hero,
        type: 'awaken',
        button: awakenButton,
        getValue: () => awakenEnabled,
        setValue: (value) => {
          awakenEnabled = Boolean(value);
          if (awakenEnabled) {
            syncTopModeFromStats();
          } else {
            activeTopMode = 'normal';
            refreshTopButtons();
          }
        },
        initial: initialAwakenEnabled
      });
      
      const statsPanel = document.createElement('div');
      statsPanel.className = isFloating
        ? 'frame-pressed-1 surface-darker w-full p-1'
        : 'frame-pressed-1 surface-darker w-full p-2';

      const statsContainer = document.createElement('div');
      statsContainer.className = isFloating
        ? 'grid w-full grid-cols-3 gap-1'
        : 'grid w-full grid-cols-3 gap-2';
      
      // Stats to display
      const stats = [
        { key: 'hp', label: 'HP' },
        { key: 'ad', label: 'AD' },
        { key: 'ap', label: 'AP' },
        { key: 'armor', label: 'ARM' },
        { key: 'magicResist', label: 'MR' },
        { key: 'level', label: 'LVL' }  // Added level stat
      ];
      
      // Create stat inputs
      stats.forEach(stat => {
        const statContainer = document.createElement('div');
        statContainer.className = 'flex flex-col items-center gap-0.5';

        const labelContainer = document.createElement('div');
        labelContainer.className = 'flex items-center justify-center gap-1';
        
        // Only add icon for stats that have one
        if (iconMap[stat.key]) {
          const iconElement = document.createElement('img');
          iconElement.src = iconMap[stat.key];
          iconElement.alt = stat.label;
          const iconSize = isFloating ? HERO_EDITOR_FLOATING_UI.statIconSize : 16;
          iconElement.width = iconElement.height = iconSize;
          iconElement.className = 'pixelated';
          labelContainer.appendChild(iconElement);
        }
        
        const labelElement = document.createElement('span');
        labelElement.textContent = stat.label;
        labelElement.className = isFloating
          ? 'text-whiteRegular'
          : 'pixel-font-12 text-whiteRegular';
        if (isFloating) {
          applyHeroEditorFloatingFont(labelElement);
        }
        
        labelContainer.appendChild(labelElement);
        statContainer.appendChild(labelContainer);
        
        // Input for stat value
        const inputElement = document.createElement('input');
        inputElement.type = 'number';
        inputElement.min = 1;
        
        // Set max values based on stat type
        if (stat.key === 'level') {
          inputElement.max = 100;  // Max level
          inputElement.value = monsterLevel;
        } else {
          inputElement.max = 20;  // Max for other stats
          inputElement.value = hero.monster[stat.key] || 1;
        }
        
        inputElement.className = isFloating
          ? 'frame-pressed-1 surface-dark box-border w-full px-1 py-0 text-center text-whiteRegular'
          : 'frame-pressed-1 surface-dark box-border w-full px-2 py-1 text-center pixel-font-14 text-whiteRegular';
        inputElement.style.backgroundColor = 'var(--surface-dark)';
        inputElement.style.color = 'var(--text-whiteRegular)';
        if (isFloating) {
          applyHeroEditorFloatingFont(inputElement);
        }
        
        statContainer.appendChild(inputElement);
        
        // Track this input for later updates
        controls.push({ 
          index,
          hero, 
          type: 'stat', 
          stat: stat.key, 
          input: inputElement, 
          initial: inputElement.value 
        });
        statInputs[stat.key] = inputElement;
        inputElement.addEventListener('input', () => {
          refreshPortraitAppearance();
          syncTopModeFromStats();
          scheduleLiveApply();
        });
        inputElement.addEventListener('change', () => {
          refreshPortraitAppearance();
          scheduleLiveApply(true);
        });
        
        statsContainer.appendChild(statContainer);
      });
      
      statsPanel.appendChild(statsContainer);
      detailPanel.appendChild(statsPanel);
      
      const equipContainer = document.createElement('div');
      equipContainer.className = isFloating
        ? 'frame-pressed-1 surface-darker box-border w-full p-1'
        : 'frame-pressed-1 surface-darker box-border w-full p-2';
      
      if (!hasEquipment) {
        // If no equipment, add a message at the top
        const noEquipMsg = document.createElement('div');
        noEquipMsg.textContent = 'No equipment - select one below:';
        noEquipMsg.className = isFloating ? 'text-whiteRegular mb-1' : 'pixel-font-12 text-whiteRegular mb-2';
        if (isFloating) {
          applyHeroEditorFloatingFont(noEquipMsg);
        }
        equipContainer.appendChild(noEquipMsg);
        
        // Initialize hero.equipment object if it doesn't exist
        if (!hero.equipment) {
          hero.equipment = { name: '', stat: 'ad', tier: 1 };
        }
      }
      
      const equipContent = document.createElement('div');
      equipContent.className = isFloating
        ? 'flex w-full flex-row gap-1.5'
        : 'flex w-full flex-row gap-2.5';

      const portraitContainer = document.createElement('div');
      portraitContainer.className = 'shrink-0';

      const equipControls = document.createElement('div');
      equipControls.className = 'flex min-w-0 flex-1 flex-col gap-1.5';
      equipControls.style.flex = '1 1 0%';
      
      // Create item portrait if we have the ID
      let itemPortrait = null;
      if (equipGameId) {
        try {
          const equipData = globalThis.state.utils.getEquipment(equipGameId);
          if (equipData && equipData.metadata) {
            itemPortrait = createHeroEditorItemPortrait({
              itemId: equipData.metadata.spriteId,
              stat: equipStat,
              tier: equipTier
            });
            
            portraitContainer.appendChild(itemPortrait);
          }
        } catch (e) {
          console.error('Error creating item portrait:', e);
        }
      } else {
        portraitContainer.appendChild(createEmptyEquipmentPlaceholder());
      }
      
      // Equipment name dropdown
      const nameSelect = document.createElement('select');
      nameSelect.className = isFloating
        ? 'frame-pressed-1 surface-dark box-border w-full px-1 py-0 text-whiteRegular'
        : 'frame-pressed-1 surface-dark box-border w-full px-2 py-1 pixel-font-14 text-whiteRegular';
      styleHeroEditorSelect(nameSelect);
      if (isFloating) {
        applyHeroEditorFloatingFont(nameSelect);
      }
      
      // Get all equipment data with proper casing
      const equipmentOptions = [];
      
      equipMap.forEach((id, name) => {
        const originalName = getEquipmentNameFromId(id) || toTitleCase(name);
        equipmentOptions.push({ id, name: name, displayName: originalName });
      });
      
      // Sort options alphabetically
      equipmentOptions.sort((a, b) => a.displayName.localeCompare(b.displayName));
      
      // Add "No Equipment" option at the top
      const noEquipOption = document.createElement('option');
      noEquipOption.value = '';
      noEquipOption.textContent = '-- No Equipment --';
      // If hero has no equipment, select this option
      if (!hasEquipment) {
        noEquipOption.selected = true;
      }
      nameSelect.appendChild(noEquipOption);
      
      // Add options to select
      equipmentOptions.forEach(option => {
        const selectOption = document.createElement('option');
        selectOption.value = option.name;
        selectOption.textContent = option.displayName;
        if (hasEquipment && option.name.toLowerCase() === equipName.toLowerCase()) {
          selectOption.selected = true;
        }
        nameSelect.appendChild(selectOption);
      });
      
      controls.push({ 
        index,
        hero, 
        type: 'equipName', 
        select: nameSelect, 
        initial: nameSelect.value,
        portrait: itemPortrait,
        portraitContainer: portraitContainer
      });
      
      const statTierContainer = document.createElement('div');
      statTierContainer.className = 'flex w-full gap-1.5';
      
      const statSelect = document.createElement('select');
      statSelect.className = isFloating
        ? 'frame-pressed-1 surface-dark box-border min-w-0 flex-1 px-1 py-0 text-whiteRegular'
        : 'frame-pressed-1 surface-dark box-border min-w-0 flex-1 px-2 py-1 pixel-font-14 text-whiteRegular';
      styleHeroEditorSelect(statSelect);
      if (isFloating) {
        applyHeroEditorFloatingFont(statSelect);
      }
      statSelect.style.flex = '1 1 0%';
      
      ['ad', 'ap', 'hp'].forEach(stat => {
        const option = document.createElement('option');
        option.value = stat;
        option.textContent = stat.toUpperCase();
        if (equipStat === stat) option.selected = true;
        statSelect.appendChild(option);
      });
      
      controls.push({ 
        index,
        hero, 
        type: 'equipStat', 
        select: statSelect, 
        initial: statSelect.value,
        portrait: itemPortrait,
        portraitContainer: portraitContainer
      });
      
      // Tier input
      const tierInput = document.createElement('input');
      tierInput.type = 'number';
      tierInput.min = 1;
      tierInput.max = 5;
      tierInput.value = clampEquipTier(equipTier);
      tierInput.className = isFloating
        ? 'frame-pressed-1 surface-dark box-border px-1 py-0 text-center text-whiteRegular'
        : 'frame-pressed-1 surface-dark box-border px-2 py-1 text-center pixel-font-14 text-whiteRegular';
      tierInput.style.width = isFloating ? '32px' : '40px';
      tierInput.style.backgroundColor = 'var(--surface-dark)';
      tierInput.style.color = 'var(--text-whiteRegular)';
      if (isFloating) {
        applyHeroEditorFloatingFont(tierInput);
      }
      
      // Label for tier
      const tierLabel = document.createElement('span');
      tierLabel.textContent = 'Tier:';
      tierLabel.className = isFloating
        ? 'text-whiteRegular flex items-center'
        : 'pixel-font-12 text-whiteRegular flex items-center';
      if (isFloating) {
        applyHeroEditorFloatingFont(tierLabel);
      }

      const tierWrapper = document.createElement('div');
      tierWrapper.className = 'flex items-center gap-1';
      
      tierWrapper.appendChild(tierLabel);
      tierWrapper.appendChild(tierInput);

      const clampTierInputValue = () => {
        const clamped = clampEquipTier(tierInput.value);
        if (String(clamped) !== tierInput.value) {
          tierInput.value = String(clamped);
        }
        return clamped;
      };

      tierInput.addEventListener('input', () => {
        clampTierInputValue();
        scheduleLiveApply();
      });
      
      controls.push({
        index,
        hero, 
        type: 'equipTier', 
        input: tierInput, 
        initial: tierInput.value,
        portrait: itemPortrait,
        portraitContainer: portraitContainer
      });
      
      // Add event handlers for equipment change
      nameSelect.addEventListener('change', () => {
        // Find the related controls
        const nameControl = controls.find(c => c.hero === hero && c.type === 'equipName');
        const statControl = controls.find(c => c.hero === hero && c.type === 'equipStat');
        const tierControl = controls.find(c => c.hero === hero && c.type === 'equipTier');
        
        if (nameControl && statControl && tierControl && nameControl.portraitContainer) {
          // Get new equipment game ID
          const newEquipName = nameSelect.value;
          
          // Handle "No Equipment" selection
          if (!newEquipName || newEquipName === '') {
            while (nameControl.portraitContainer.firstChild) {
              nameControl.portraitContainer.removeChild(nameControl.portraitContainer.firstChild);
            }
            nameControl.portraitContainer.appendChild(createEmptyEquipmentPlaceholder());
            nameControl.portrait = statControl.portrait = tierControl.portrait = null;

            if (!nameControl.portraitContainer.parentElement) {
              equipContent.insertBefore(nameControl.portraitContainer, equipContent.firstChild);
            }

            refreshListEquipPortrait(index, '', statControl.select.value, tierControl.input.value);
            
            // Disable stat and tier controls when no equipment is selected
            statControl.select.disabled = true;
            tierControl.input.disabled = true;
            scheduleLiveApply(true);
            return;
          }
          
          // Re-enable controls in case they were disabled
          statControl.select.disabled = false;
          tierControl.input.disabled = false;
          
          const equipId = equipMap.get(newEquipName.toLowerCase());
          
          if (equipId) {
            const equipData = globalThis.state.utils.getEquipment(equipId);
            if (equipData && equipData.metadata) {
              // Create new portrait
              const newPortrait = createHeroEditorItemPortrait({
                itemId: equipData.metadata.spriteId,
                stat: statControl.select.value,
                tier: clampTierInputValue()
              });
              
              // Clear and append new portrait
              while (nameControl.portraitContainer.firstChild) {
                nameControl.portraitContainer.removeChild(nameControl.portraitContainer.firstChild);
              }
              
              nameControl.portraitContainer.appendChild(newPortrait);
              
              // Update portrait reference for all related controls
              nameControl.portrait = statControl.portrait = tierControl.portrait = newPortrait;
              
              // Make sure portrait container is added to equipContent if it wasn't already
              if (!nameControl.portraitContainer.parentElement) {
                equipContent.insertBefore(nameControl.portraitContainer, equipContent.firstChild);
              }

              refreshListEquipPortrait(
                index,
                newEquipName,
                statControl.select.value,
                clampTierInputValue()
              );
            }
          }
        }
        scheduleLiveApply(true);
      });
      
      statSelect.addEventListener('change', () => {
        // Find the related controls
        const nameControl = controls.find(c => c.hero === hero && c.type === 'equipName');
        const statControl = controls.find(c => c.hero === hero && c.type === 'equipStat');
        const tierControl = controls.find(c => c.hero === hero && c.type === 'equipTier');
        
        if (nameControl && statControl && tierControl && nameControl.portraitContainer) {
          // Get equipment game ID
          const equipName = nameControl.select.value;
          
          // Skip if no equipment or portrait is selected
          if (!equipName || equipName === '') return;
          
          const equipId = equipMap.get(equipName.toLowerCase());
          
          if (equipId) {
            const equipData = globalThis.state.utils.getEquipment(equipId);
            if (equipData && equipData.metadata) {
              // Create new portrait
              const newPortrait = createHeroEditorItemPortrait({
                itemId: equipData.metadata.spriteId,
                stat: statSelect.value,
                tier: clampTierInputValue()
              });
              
              // Clear and append new portrait
              while (nameControl.portraitContainer.firstChild) {
                nameControl.portraitContainer.removeChild(nameControl.portraitContainer.firstChild);
              }
              
              nameControl.portraitContainer.appendChild(newPortrait);
              
              // Update portrait reference for all related controls
              nameControl.portrait = statControl.portrait = tierControl.portrait = newPortrait;
              
              // Make sure portrait container is added to equipContent if it wasn't already
              if (!nameControl.portraitContainer.parentElement) {
                equipContent.insertBefore(nameControl.portraitContainer, equipContent.firstChild);
              }

              refreshListEquipPortrait(
                index,
                equipName,
                statSelect.value,
                clampTierInputValue()
              );
            }
          }
        }
        scheduleLiveApply(true);
      });
      
      tierInput.addEventListener('change', () => {
        clampTierInputValue();
        // Find the related controls
        const nameControl = controls.find(c => c.hero === hero && c.type === 'equipName');
        const statControl = controls.find(c => c.hero === hero && c.type === 'equipStat');
        const tierControl = controls.find(c => c.hero === hero && c.type === 'equipTier');
        
        if (nameControl && statControl && tierControl && nameControl.portraitContainer) {
          // Get equipment game ID
          const equipName = nameControl.select.value;
          
          // Skip if no equipment or portrait is selected
          if (!equipName || equipName === '') return;
          
          const equipId = equipMap.get(equipName.toLowerCase());
          
          if (equipId) {
            const equipData = globalThis.state.utils.getEquipment(equipId);
            if (equipData && equipData.metadata) {
              // Create new portrait
              const newPortrait = createHeroEditorItemPortrait({
                itemId: equipData.metadata.spriteId,
                stat: statControl.select.value,
                tier: clampTierInputValue()
              });
              
              // Clear and append new portrait
              while (nameControl.portraitContainer.firstChild) {
                nameControl.portraitContainer.removeChild(nameControl.portraitContainer.firstChild);
              }
              
              nameControl.portraitContainer.appendChild(newPortrait);
              
              // Update portrait reference for all related controls
              nameControl.portrait = statControl.portrait = tierControl.portrait = newPortrait;
              
              // Make sure portrait container is added to equipContent if it wasn't already
              if (!nameControl.portraitContainer.parentElement) {
                equipContent.insertBefore(nameControl.portraitContainer, equipContent.firstChild);
              }

              refreshListEquipPortrait(
                index,
                equipName,
                statControl.select.value,
                clampTierInputValue()
              );
            }
          }
        }
        scheduleLiveApply(true);
      });
      
      // Trigger a change event if there is a selected equipment to initialize the portrait
      if (!hasEquipment && nameSelect.value) {
        const event = new Event('change');
        nameSelect.dispatchEvent(event);
      }
      
      // Initialize stat/tier controls disabled state based on equipment selection
      if (!hasEquipment || !equipName) {
        statSelect.disabled = true;
        tierInput.disabled = true;
      }
      
      statTierContainer.appendChild(statSelect);
      statTierContainer.appendChild(tierWrapper);
      
      equipControls.appendChild(nameSelect);
      equipControls.appendChild(statTierContainer);
      
      equipContent.appendChild(portraitContainer);
      equipContent.appendChild(equipControls);
      equipContainer.appendChild(equipContent);
      detailPanel.appendChild(equipContainer);
      
      if (!isFloating) {
        detailHost.appendChild(detailPanel);
      }
    });

    if (isFloating) {
      if (!floatingDetailPanel) {
        return;
      }

      const clearTimer = () => {
        if (liveApplyTimer) {
          clearTimeout(liveApplyTimer);
          liveApplyTimer = null;
        }
      };

      mountHeroEditorFloatingPanel(
        floatingDetailPanel,
        floatingPosition.x,
        floatingPosition.y,
        clearTimer
      );
      return;
    }

    if (selectTileIndex != null) {
      const matchedIndex = editableBoardData.board.findIndex(
        hero => hero.monster && hero.tile === selectTileIndex
      );
      if (matchedIndex >= 0) {
        selectedHeroIndex = matchedIndex;
      }
    }

    if (selectedHeroIndex !== null) {
      selectHero(selectedHeroIndex);
    }

    col1.appendChild(col1Header);
    col1.appendChild(listScrollContainer.element);
    col2.appendChild(col2Header);
    col2.appendChild(detailHost);
    columnsContainer.appendChild(col1);
    columnsContainer.appendChild(col2);
    contentContainer.appendChild(columnsContainer);
    
    const modalRef = api.ui.components.createModal({
      title: 'Edit Heroes',
      width: HERO_EDITOR_MODAL_CONFIG.width,
      content: contentContainer,
      buttons: [
        {
          text: 'Close',
          primary: true,
          onClick: () => {
            clearHeroEditorModalLayoutCleanup();
            if (liveApplyTimer) {
              clearTimeout(liveApplyTimer);
              liveApplyTimer = null;
            }
          },
          closeOnClick: true
        }
      ]
    });

    setupHeroEditorModalResponsiveLayout(modalRef, contentContainer);

  } catch (error) {
    console.error('Error showing hero editor:', error);
    
    // Show error message
    api.ui.components.createModal({
      title: 'Error',
      content: `Failed to open hero editor: ${error.message}`,
      buttons: [{ text: 'OK', primary: true }]
    });
  }
}

// Hide Hero Editor button
function hideButton() {
  try {
    if (heroEditorButton) {
      heroEditorButton.style.display = 'none';
      console.log('[Hero Editor] Button hidden');
    } else {
      // Fallback: try to find by ID
      const button = document.getElementById(HERO_EDITOR_BUTTON_ID);
      if (button) {
        button.style.display = 'none';
        console.log('[Hero Editor] Button hidden (fallback)');
      }
    }
  } catch (error) {
    console.error('[Hero Editor] Error hiding button:', error);
  }
}

// Show Hero Editor button
function showButton() {
  try {
    if (heroEditorButton) {
      heroEditorButton.style.display = '';
      console.log('[Hero Editor] Button shown');
    } else {
      // Fallback: try to find by ID
      const button = document.getElementById(HERO_EDITOR_BUTTON_ID);
      if (button) {
        button.style.display = '';
        console.log('[Hero Editor] Button shown (fallback)');
      }
    }
    updateHeroEditorButtonState();
  } catch (error) {
    console.error('[Hero Editor] Error showing button:', error);
  }
}

// Export functionality
context.exports = {
  showEditor: showHeroEditorModal,
  hideButton: hideButton,
  showButton: showButton
};

// Expose to window for inter-mod communication
if (typeof window !== 'undefined') {
  window.heroEditor = {
    hideButton: hideButton,
    showButton: showButton,
    showEditor: showHeroEditorModal
  };
}

// Cleanup function for Hero Editor mod (exposed for mod system)
context.exports.cleanup = function() {
  console.log('[Hero Editor] Running cleanup...');
  
  clearHeroEditorModalLayoutCleanup();
  closeHeroEditorBoardContextMenu();
  document.removeEventListener('contextmenu', handleHeroEditorBoardContextMenu, true);
  unsubscribeHeroEditorBoardUpdates();
  
  // Clear equipment map
  if (typeof equipmentMap !== 'undefined') {
    equipmentMap = null;
  }
  
  // Remove any existing modals
  const existingModal = document.querySelector('#hero-editor-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Clear any cached data
  if (typeof window.heroEditorState !== 'undefined') {
    delete window.heroEditorState;
  }
  
  console.log('[Hero Editor] Cleanup completed');
}; 
