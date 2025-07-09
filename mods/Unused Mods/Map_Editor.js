// Map Editor Mod for Bestiary Arena
// --- Modern, full-featured, maintainable version ---

const DEBUG = false;

// --- Configuration ---
const defaultConfig = {
  currentLocale: 'en',
  walkablePathsEnabled: false,
  gridEnabled: false,
  tileSpriteEditorEnabled: false,
  customTileEdits: {},
};
const config = Object.assign({}, defaultConfig, context.config);

// --- Constants ---
const MOD_ID = 'map-editor';
const EDITOR_TOGGLE_ID = `${MOD_ID}-editor-toggle`;
const CONFIG_BUTTON_ID = `${MOD_ID}-config-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;
const GRID_OVERLAY_ID = `${MOD_ID}-grid-overlay`;
const HITBOX_OVERLAY_ID = `${MOD_ID}-hitbox-overlay`;
const TILE_COLOR = '#333333';
const HITBOX_COLOR = 'rgba(255, 0, 0, 0.3)';
const WALKABLE_COLOR = 'rgba(0, 255, 0, 0.3)';
const GRID_LABEL_COLOR = '#00ff99';
const GRID_COLOR = 'rgba(0, 255, 170, 0.7)';

// --- State ---
let gridOverlay = null;
let isInitialized = false;
let selectionOverlay = null;
let lastSelectedTileIndex = null;
let customTileEdits = (config.customTileEdits && typeof config.customTileEdits === 'object') ? config.customTileEdits : {};
let originalTileClasses = {};
let gameStateSubscription = null;
let boardStateSubscription = null;
let lastGameStarted = false;
let lastOverlayApplication = 0;
let overlayApplicationCooldown = 5000;
let isOverlayApplicationInProgress = false;

// --- Translations ---
const TRANSLATIONS = {
  en: {
    modName: 'Map Editor Tools',
    configButtonTooltip: 'Map Editor Tools Settings',
    configTitle: 'Map Editor Tools Settings',
    walkablePaths: 'Show Walkable Paths',
    grid: 'Show Map Grid',
    tileSpriteEditor: 'Enable Tile Sprite ID Editor',
    saveButton: 'Save',
    cancelButton: 'Cancel',
    reapplyButton: 'Reapply Tiles',
    resetButton: 'Reset Tiles',
    blankButton: 'Blank Map',
    closeButton: 'Close',
  }
};
function t(key) {
  const locale = config.currentLocale;
  const translations = TRANSLATIONS[locale] || TRANSLATIONS.en;
  return translations[key] || key;
}

// --- Utility Functions ---
function safeAccess(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}
function getTileIndex(tile) {
  return tile && tile.id ? tile.id.replace('tile-index-', '') : null;
}
function getZIndexFromStyle(sprite) {
  let z = sprite.style.zIndex;
  if (z && !isNaN(parseInt(z, 10))) return parseInt(z, 10);
  const styleAttr = sprite.getAttribute('style') || '';
  const match = styleAttr.match(/z-index\s*:\s*(-?\d+)/i);
  if (match) return parseInt(match[1], 10);
  const computed = window.getComputedStyle(sprite).zIndex;
  if (computed && !isNaN(parseInt(computed, 10))) return parseInt(computed, 10);
  return 0;
}
function saveOriginalTileClasses() {
  document.querySelectorAll('[id^="tile-index-"]').forEach(tile => {
    originalTileClasses[tile.id] = {
      className: tile.className,
      innerHTML: tile.innerHTML
    };
  });
}
function restoreOriginalTiles() {
  document.querySelectorAll('[id^="tile-index-"]').forEach(tile => {
    if (originalTileClasses[tile.id]) {
      tile.className = originalTileClasses[tile.id].className;
      tile.innerHTML = originalTileClasses[tile.id].innerHTML;
    }
  });
}

// --- Selection Overlay Management ---
function createSelectionOverlay() {
  if (selectionOverlay) {
    selectionOverlay.remove();
  }
  selectionOverlay = document.createElement('div');
  selectionOverlay.id = `${MOD_ID}-selection-overlay`;
  selectionOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 20000;
  `;
  const container = document.getElementById('background-scene') || document.getElementById('game-container') || document.body;
  container.appendChild(selectionOverlay);
  return selectionOverlay;
}
function cleanupSelectionOverlay() {
  if (selectionOverlay) {
    selectionOverlay.remove();
    selectionOverlay = null;
  }
}

// --- Tile ID Editing ---
function enableTileIdEditing() {
  document.querySelectorAll('[id^="tile-index-"]').forEach(tile => {
    tile.classList.remove('pointer-events-none');
    tile.onclick = (e) => {
      if (!config.tileSpriteEditorEnabled) return;
      console.log('Tile clicked:', tile.id);
      e.stopPropagation();
      if (e.target.classList.contains('tile-zindex-editor')) return;
      
      const sprites = tile.querySelectorAll('.sprite.item.relative');
      sprites.forEach(sprite => {
        console.log('Sprite:', sprite, 'Style:', sprite.getAttribute('style'), 'Parsed z:', getZIndexFromStyle(sprite));
      });
      
      const tileIndex = getTileIndex(tile);
      lastSelectedTileIndex = tileIndex;
      
      if (customTileEdits[tileIndex]) {
        const { id0, id1000 } = customTileEdits[tileIndex];
        if (id0) {
          sprites.forEach(sprite => {
            const z = getZIndexFromStyle(sprite);
            if (z === 0) sprite.className = sprite.className.replace(/id-\d+/, `id-${id0}`);
          });
        }
        if (id1000) {
          let found = false;
          sprites.forEach(sprite => {
            const z = getZIndexFromStyle(sprite);
            if (z === 1000) {
              sprite.className = sprite.className.replace(/id-\d+/, `id-${id1000}`);
              found = true;
            }
          });
          if (!found) {
            const newDiv = document.createElement('div');
            newDiv.className = `sprite item relative id-${id1000}`;
            newDiv.setAttribute('style', 'z-index:1000');
            let inserted = false;
            sprites.forEach(sprite => {
              const z = getZIndexFromStyle(sprite);
              if (!inserted && z === 0) {
                sprite.parentNode.insertBefore(newDiv, sprite.nextSibling);
                inserted = true;
              }
            });
            if (!inserted && tile.firstChild) {
              tile.insertBefore(newDiv, tile.firstChild.nextSibling);
            } else if (!inserted) {
              tile.appendChild(newDiv);
            }
          }
        }
      }
      
      if (config.tileSpriteEditorEnabled) {
        if (!selectionOverlay) {
          createSelectionOverlay();
        }
        if (selectionOverlay) {
          selectionOverlay.innerHTML = '';
        }
        
        const selectionIndicator = document.createElement('div');
        selectionIndicator.style.cssText = `
          position: absolute;
          width: calc(32px * var(--zoomFactor));
          height: calc(32px * var(--zoomFactor));
          outline: 6px solid #00ff00;
          outline-offset: -3px;
          box-shadow: 0 0 16px 4px #00ff00aa;
          pointer-events: none;
          z-index: 20001;
        `;

        const computedStyle = window.getComputedStyle(tile);
        const right = computedStyle.right;
        const bottom = computedStyle.bottom;
        const rightValue = parseFloat(right);
        const bottomValue = parseFloat(bottom);

        selectionIndicator.style.right = `${rightValue}px`;
        selectionIndicator.style.bottom = `${bottomValue}px`;

        if (selectionOverlay) {
          selectionOverlay.appendChild(selectionIndicator);
        }

        let id0 = '', id1000 = '';
        let sprite0 = null, sprite1000 = null;
        
        const sortedSprites = Array.from(sprites).sort((a, b) => {
          const zA = getZIndexFromStyle(a);
          const zB = getZIndexFromStyle(b);
          return zA - zB;
        });
        
        if (sortedSprites.length > 0) {
          const floorSprite = sortedSprites[0];
          const idMatch0 = /id-(\d+)/.exec(floorSprite.className);
          id0 = idMatch0 ? idMatch0[1] : 'NaN';
          sprite0 = floorSprite;
          
          if (sortedSprites.length > 1) {
            const trashSprite = sortedSprites[sortedSprites.length - 1];
            const idMatch1000 = /id-(\d+)/.exec(trashSprite.className);
            id1000 = idMatch1000 ? idMatch1000[1] : 'NaN';
            sprite1000 = trashSprite;
          } else {
            id1000 = 'NaN';
          }
        }
        
        const id0Input = document.getElementById('tile-id-editor-input-0');
        const id1000Input = document.getElementById('tile-id-editor-input-1000');
        if (id0Input && id1000Input) {
          id0Input.value = id0;
          id1000Input.value = id1000;
          id0Input.removeAttribute('readonly');
          id0Input.removeAttribute('disabled');
          id0Input.style.pointerEvents = 'auto';
          id1000Input.removeAttribute('readonly');
          id1000Input.removeAttribute('disabled');
          id1000Input.style.pointerEvents = 'auto';
          id1000Input.style.color = '#000';
        }
        
        if (window.tileIdDisplay) window.tileIdDisplay.textContent = `Selected tile: ${tile.id}`;
      }
    };
  });

  const id0Input = document.getElementById('tile-id-editor-input-0');
  const id1000Input = document.getElementById('tile-id-editor-input-1000');
  if (id0Input && id1000Input) {
    if (config.tileSpriteEditorEnabled) {
      id0Input.removeAttribute('readonly');
      id0Input.removeAttribute('disabled');
      id0Input.style.pointerEvents = 'auto';
      id1000Input.removeAttribute('readonly');
      id1000Input.removeAttribute('disabled');
      id1000Input.style.pointerEvents = 'auto';
    } else {
      id0Input.setAttribute('readonly', 'readonly');
      id0Input.setAttribute('disabled', 'disabled');
      id0Input.style.pointerEvents = 'none';
      id1000Input.setAttribute('readonly', 'readonly');
      id1000Input.setAttribute('disabled', 'disabled');
      id1000Input.style.pointerEvents = 'none';
    }
  }

  if (!config.tileSpriteEditorEnabled) {
    cleanupSelectionOverlay();
    if (window.tileIdDisplay) window.tileIdDisplay.textContent = 'Selected tile: (none)';
  }
}

// --- Grid Overlay ---
function createGridOverlay() {
  cleanupGrid();
  const overlay = document.createElement('div');
  overlay.id = GRID_OVERLAY_ID;
  overlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9999;
  `;

  const style = document.createElement('style');
  style.id = `${GRID_OVERLAY_ID}-style`;
  style.textContent = `
    .tile-label {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      width: calc(32px * var(--zoomFactor));
      height: calc(32px * var(--zoomFactor));
      color: ${GRID_LABEL_COLOR};
      text-shadow: 0 0 5px ${GRID_LABEL_COLOR}, 0 0 10px ${GRID_LABEL_COLOR}99;
      font-family: "Press Start 2P", "VT323", monospace;
      font-size: calc(12px * var(--zoomFactor));
      z-index: 10000;
      pointer-events: none;
      text-align: center;
      transform: translate(-50%, -50%);
      overflow: hidden;
    }
  `;
  document.head.appendChild(style);

  const tiles = document.querySelectorAll('[id^="tile-index-"]');
  tiles.forEach(tile => {
    const tileId = tile.id.replace('tile-index-', '');
    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = tileId;

    const computedStyle = window.getComputedStyle(tile);
    const right = computedStyle.right;
    const bottom = computedStyle.bottom;
    const rightValue = parseFloat(right);
    const bottomValue = parseFloat(bottom);

    label.style.right = `calc(${rightValue}px - (16px * var(--zoomFactor)))`;
    label.style.bottom = `calc(${bottomValue}px - (16px * var(--zoomFactor)))`;

    overlay.appendChild(label);
  });

  const container = document.getElementById('background-scene') || document.getElementById('game-container') || document.body;
  container.appendChild(overlay);
  gridOverlay = overlay;
  return overlay;
}
function cleanupGrid() {
  if (gridOverlay) {
    gridOverlay.remove();
    gridOverlay = null;
  }
  const gridStyle = document.getElementById(`${GRID_OVERLAY_ID}-style`);
  if (gridStyle) gridStyle.remove();
}

// --- Walkable Paths Overlay ---
function createHitboxOverlay() {
  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    if (!boardContext || !boardContext.selectedMap || !boardContext.selectedMap.selectedRoom) {
      console.error('Unable to access room data for hitbox overlay');
      return;
    }
    
    const roomData = boardContext.selectedMap.selectedRoom;
    
    if (!roomData.file || !roomData.file.data || !roomData.file.data.hitboxes) {
      console.warn('No hitbox data found for current room');
      return;
    }
    
    const hitboxes = roomData.file.data.hitboxes;
    const tilesContainer = document.getElementById('tiles');
    if (!tilesContainer) {
      console.error('Could not find #tiles container');
      return;
    }
    
    const overlayContainer = document.createElement('div');
    overlayContainer.id = HITBOX_OVERLAY_ID;
    overlayContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
    `;
    
    const tileElements = document.querySelectorAll('[id^="tile-index-"]');
    tileElements.forEach(tileElement => {
      const tileId = parseInt(tileElement.id.replace('tile-index-', ''), 10);
      
      if (tileId >= hitboxes.length) return;
      
      if (document.querySelector(`.custom-display-tile-overlay[data-tile-index="${tileId}"]`)) {
        return;
      }
      
      const style = tileElement.getAttribute('style');
      let rightValue = '';
      let bottomValue = '';
      
      const rightMatch = /right:\s*calc\(([^)]+)\)/.exec(style);
      if (rightMatch) rightValue = rightMatch[1];
      
      const bottomMatch = /bottom:\s*calc\(([^)]+)\)/.exec(style);
      if (bottomMatch) bottomValue = bottomMatch[1];
      
      if (!rightValue || !bottomValue) return;
      
      if (hitboxes[tileId] === false && config.walkablePathsEnabled) {
        const walkableOverlay = document.createElement('div');
        walkableOverlay.classList.add('custom-display-tile-overlay', 'custom-display-walkable');
        walkableOverlay.setAttribute('data-tile-index', tileId);
        
        walkableOverlay.style.position = 'absolute';
        walkableOverlay.style.right = `calc(${rightValue})`;
        walkableOverlay.style.bottom = `calc(${bottomValue})`;
        walkableOverlay.style.width = `calc(32px * var(--zoomFactor))`;
        walkableOverlay.style.height = `calc(32px * var(--zoomFactor))`;
        walkableOverlay.style.zIndex = '110';
        
        overlayContainer.appendChild(walkableOverlay);
      }
      
      if (hitboxes[tileId] === true && config.walkablePathsEnabled) {
        const hitboxOverlay = document.createElement('div');
        hitboxOverlay.classList.add('custom-display-tile-overlay', 'custom-display-hitbox');
        hitboxOverlay.setAttribute('data-tile-index', tileId);
        
        hitboxOverlay.style.position = 'absolute';
        hitboxOverlay.style.right = `calc(${rightValue})`;
        hitboxOverlay.style.bottom = `calc(${bottomValue})`;
        hitboxOverlay.style.width = `calc(32px * var(--zoomFactor))`;
        hitboxOverlay.style.height = `calc(32px * var(--zoomFactor))`;
        hitboxOverlay.style.zIndex = '120';
        
        overlayContainer.appendChild(hitboxOverlay);
      }
    });
    
    tilesContainer.appendChild(overlayContainer);
    setTimeout(enableTileIdEditing, 0);
    
  } catch (error) {
    console.error('Error creating hitbox overlay:', error);
  }
}

function cleanupOverlayElements() {
  const overlayContainer = document.getElementById(HITBOX_OVERLAY_ID);
  if (overlayContainer) {
    overlayContainer.remove();
  }
  
  const overlayElements = document.querySelectorAll('.custom-display-tile-overlay');
  overlayElements.forEach(el => el.remove());
}

// --- Game State Monitoring ---
function monitorGameState() {
  if (gameStateSubscription) {
    gameStateSubscription.unsubscribe();
    gameStateSubscription = null;
  }
  
  if (boardStateSubscription) {
    boardStateSubscription.unsubscribe();
    boardStateSubscription = null;
  }

  try {
    if (globalThis.state && globalThis.state.board) {
      boardStateSubscription = globalThis.state.board.subscribe((state) => {
        if (!config.walkablePathsEnabled) return;
        
        const currentGameStarted = state.context.gameStarted;
        
        if (currentGameStarted !== lastGameStarted) {
          console.log(`[Map Editor] Game state changed: ${lastGameStarted} -> ${currentGameStarted}`);
          lastGameStarted = currentGameStarted;
          
          setTimeout(() => {
            reapplyPerformanceMode();
          }, 100);
        }
      });
      
      globalThis.state.board.on('newGame', (event) => {
        if (!config.walkablePathsEnabled) return;
        console.log('[Map Editor] New game detected, reapplying performance mode');
        
        setTimeout(() => {
          reapplyPerformanceMode();
        }, 100);
      });
    }
    
    let lastDomChangeTime = 0;
    const DOM_CHANGE_THROTTLE = 2000;
    
    const viewportObserver = new MutationObserver((mutations) => {
      if (!config.walkablePathsEnabled) return;
      
      let needsReapply = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) {
              if (node.id && node.id.startsWith('tile-index-')) {
                needsReapply = true;
                break;
              }
              
              if (node.querySelector && node.querySelector('.sprite')) {
                needsReapply = true;
                break;
              }
            }
          }
        }
        
        if (needsReapply) break;
      }
      
      if (needsReapply) {
        const now = Date.now();
        if (now - lastDomChangeTime > DOM_CHANGE_THROTTLE) {
          console.log('[Map Editor] DOM changes detected, reapplying performance mode');
          lastDomChangeTime = now;
        }
        reapplyPerformanceMode();
      }
    });
    
    const viewport = document.getElementById('viewport');
    if (viewport) {
      viewportObserver.observe(viewport, {
        childList: true,
        subtree: true
      });
      
      window._performanceModeDomObserver = viewportObserver;
    }
    
  } catch (error) {
    console.error('Error setting up game state monitoring:', error);
  }
}

function reapplyPerformanceMode() {
  if (!config.walkablePathsEnabled) return;
  
  cleanupOverlayElements();
  applyBaseStyles();
  
  if (config.walkablePathsEnabled) {
    createHitboxOverlay();
  }
  
  afterTilesReady();
}

function applyBaseStyles() {
  const existingStyle = document.getElementById(`${MOD_ID}-perf-styles`);
  if (existingStyle) {
    existingStyle.remove();
  }
  
  const styleElement = document.createElement('style');
  styleElement.id = `${MOD_ID}-perf-styles`;
  
  let css = `
    #viewport .sprite img.spritesheet {
      opacity: 0 !important;
    }
    
    #viewport #tiles .sprite.item {
      background-color: ${TILE_COLOR} !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
    }
    
    #viewport button .sprite.item {
      background-color: transparent !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
    }
    
    .custom-display-tile-overlay {
      position: absolute;
      width: calc(32px * var(--zoomFactor));
      height: calc(32px * var(--zoomFactor));
      pointer-events: none;
    }
    
    .custom-display-hitbox {
      background-color: ${HITBOX_COLOR};
    }
    
    .custom-display-walkable {
      background-color: ${WALKABLE_COLOR};
    }
  `;
  
  styleElement.textContent = css;
  document.head.appendChild(styleElement);
}

function afterTilesReady() {
  addTileZIndexEditors();
  enableTileIdEditing();
}

function addTileZIndexEditors() {
  document.querySelectorAll('[id^="tile-index-"]').forEach(tile => {
    if (tile.querySelector('.tile-zindex-editor')) return;

    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'tile-zindex-editor';
    input.style.position = 'absolute';
    input.style.top = '2px';
    input.style.left = '2px';
    input.style.width = '40px';
    input.style.zIndex = 2000;
    input.style.fontSize = '10px';
    input.style.background = 'rgba(255,255,255,0.8)';
    input.style.border = '1px solid #888';
    input.style.borderRadius = '3px';
    input.style.padding = '0 2px';

    const sprite = tile.querySelector('.sprite.item');
    if (sprite) {
      const currentZ = getZIndexFromStyle(sprite);
      input.value = currentZ;
    }

    input.addEventListener('input', (e) => {
      const newZ = parseInt(e.target.value, 10) || 0;
      tile.querySelectorAll('.sprite.item').forEach(sprite => {
        sprite.style.zIndex = newZ;
      });
    });

    tile.appendChild(input);
  });
}

// --- Overlay Reapplication Logic ---
function reapplyOverlaysWithRetry(attempt = 1, maxAttempts = 15) {
  const now = Date.now();
  
  if (isOverlayApplicationInProgress) {
    console.log('[Map Editor] Overlay application already in progress, skipping...');
    return;
  }
  
  if (now - lastOverlayApplication < overlayApplicationCooldown) {
    console.log('[Map Editor] Overlay application throttled, skipping...');
    return;
  }
  
  isOverlayApplicationInProgress = true;
  lastOverlayApplication = now;
  
  setTimeout(() => {
    const tiles = document.querySelectorAll('[id^="tile-index-"]');
    
    if (tiles.length === 0) {
      if (attempt < maxAttempts) {
        isOverlayApplicationInProgress = false;
        reapplyOverlaysWithRetry(attempt + 1, maxAttempts);
      } else {
        console.warn('[Map Editor] Failed to find tiles after all attempts');
        isOverlayApplicationInProgress = false;
      }
      return;
    }
    
    const firstTile = tiles[0];
    const hasValidStructure = firstTile.querySelector('.sprite.item.relative');
    
    if (!hasValidStructure) {
      if (attempt < maxAttempts) {
        isOverlayApplicationInProgress = false;
        reapplyOverlaysWithRetry(attempt + 1, maxAttempts);
      } else {
        console.warn('[Map Editor] Failed to find valid tile structure after all attempts');
        isOverlayApplicationInProgress = false;
      }
      return;
    }
    
    console.log('[Map Editor] Reapplying tile editing functionality to', tiles.length, 'tiles...');
    
    if (typeof recreateTileEditingFunctionality === 'function') {
      recreateTileEditingFunctionality();
    }
    
    isOverlayApplicationInProgress = false;
  }, 200 * attempt);
}

function recreateTileEditingFunctionality(retries = 10) {
  if (!config.gridEnabled) return;

  const tiles = document.querySelectorAll('[id^="tile-index-"]');
  if (tiles.length === 0 && retries > 0) {
    setTimeout(() => recreateTileEditingFunctionality(retries - 1), 150);
    return;
  }

  console.log('Recreating tile editing functionality...');

  if (selectionOverlay) {
    cleanupSelectionOverlay();
  }
  if (lastSelectedTileIndex !== null) {
    createSelectionOverlay();
  }

  addTileZIndexEditors();
  enableTileIdEditing();

  if (lastSelectedTileIndex !== null) {
    const tile = document.getElementById(`tile-index-${lastSelectedTileIndex}`);
    if (tile) {
      tile.click();
    }
  }
}

// --- Tile Management Functions ---
function wipeAllTiles() {
  for (let i = 0; i < 165; i++) {
    const tile = document.getElementById(`tile-index-${i}`);
    if (tile) {
      const sprites = tile.querySelectorAll('.sprite.item.relative');
      sprites.forEach(sprite => {
        sprite.className = 'sprite item relative id-0';
        const img = sprite.querySelector('img.spritesheet');
        if (img) {
          img.setAttribute('alt', '0');
        }
      });
    }
  }
  if (DEBUG) console.log('[MapEditor] All 165 tiles wiped.');
}

function blankMap() {
  // Implement blank map logic as needed
  console.log('[Map Editor] Blank map function called');
}

function saveCustomTileEdits() {
  console.log('Saving edits:', customTileEdits);
  api.service.updateScriptConfig(context.hash, { ...config, customTileEdits });
}

// --- Config Panel ---
function createConfigPanel() {
  const content = document.createElement('div');
  content.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

  // Walkable Paths toggle
  const walkableRow = document.createElement('div');
  walkableRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const walkableInput = document.createElement('input');
  walkableInput.type = 'checkbox';
  walkableInput.id = 'walkable-paths-checkbox';
  walkableInput.checked = config.walkablePathsEnabled;
  const walkableLabel = document.createElement('label');
  walkableLabel.htmlFor = 'walkable-paths-checkbox';
  walkableLabel.textContent = t('walkablePaths');
  walkableRow.appendChild(walkableInput);
  walkableRow.appendChild(walkableLabel);
  content.appendChild(walkableRow);

  // Grid toggle
  const gridRow = document.createElement('div');
  gridRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const gridInput = document.createElement('input');
  gridInput.type = 'checkbox';
  gridInput.id = 'map-grid-checkbox';
  gridInput.checked = config.gridEnabled;
  const gridLabel = document.createElement('label');
  gridLabel.htmlFor = 'map-grid-checkbox';
  gridLabel.textContent = t('grid');
  gridRow.appendChild(gridInput);
  gridRow.appendChild(gridLabel);
  content.appendChild(gridRow);

  // Tile Sprite Editor toggle
  const tileEditorRow = document.createElement('div');
  tileEditorRow.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const tileEditorInput = document.createElement('input');
  tileEditorInput.type = 'checkbox';
  tileEditorInput.id = 'tile-sprite-editor-checkbox';
  tileEditorInput.checked = config.tileSpriteEditorEnabled;
  const tileEditorLabel = document.createElement('label');
  tileEditorLabel.htmlFor = 'tile-sprite-editor-checkbox';
  tileEditorLabel.textContent = t('tileSpriteEditor');
  tileEditorRow.appendChild(tileEditorInput);
  tileEditorRow.appendChild(tileEditorLabel);
  content.appendChild(tileEditorRow);

  // Selected tile display
  window.tileIdDisplay = document.createElement('div');
  window.tileIdDisplay.style.cssText = 'margin-bottom: 4px; color: #0c6; font-weight: bold;';
  window.tileIdDisplay.textContent = 'Selected tile: (none)';
  content.appendChild(window.tileIdDisplay);

  // Floor input
  const id0Row = document.createElement('div');
  id0Row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
  const id0Label = document.createElement('label');
  id0Label.textContent = 'Floor:';
  id0Label.htmlFor = 'tile-id-editor-input-0';
  const id0Input = document.createElement('input');
  id0Input.type = 'number';
  id0Input.id = 'tile-id-editor-input-0';
  id0Input.style.width = '60px';
  id0Input.style.color = '#000';
  id0Input.disabled = true;
  id0Row.appendChild(id0Label);
  id0Row.appendChild(id0Input);
  content.appendChild(id0Row);

  // Trash input
  const id1000Row = document.createElement('div');
  id1000Row.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const id1000Label = document.createElement('label');
  id1000Label.textContent = 'Trash:';
  id1000Label.htmlFor = 'tile-id-editor-input-1000';
  const id1000Input = document.createElement('input');
  id1000Input.type = 'number';
  id1000Input.id = 'tile-id-editor-input-1000';
  id1000Input.style.width = '60px';
  id1000Input.disabled = true;
  id1000Row.appendChild(id1000Label);
  id1000Row.appendChild(id1000Input);
  content.appendChild(id1000Row);

  // --- Panel Buttons ---
  const buttons = [
    {
      text: t('saveButton'),
      primary: true,
      onClick: () => {
        config.walkablePathsEnabled = walkableInput.checked;
        config.gridEnabled = gridInput.checked;
        config.tileSpriteEditorEnabled = tileEditorInput.checked;
        api.service.updateScriptConfig(context.hash, config);
        
        if (config.gridEnabled) {
          if (!gridOverlay) gridOverlay = createGridOverlay();
        } else {
          cleanupGrid();
        }
        
        if (config.walkablePathsEnabled) {
          monitorGameState();
          reapplyPerformanceMode();
        } else {
          cleanupOverlayElements();
        }
        
        if (config.tileSpriteEditorEnabled) {
          enableTileIdEditing();
        } else {
          cleanupSelectionOverlay();
        }
      }
    },
    {
      text: t('reapplyButton'),
      primary: false,
      onClick: () => reapplyOverlaysWithRetry()
    },
    {
      text: t('resetButton'),
      primary: false,
      onClick: () => wipeAllTiles()
    },
    {
      text: t('blankButton'),
      primary: false,
      onClick: () => blankMap()
    },
    {
      text: t('closeButton'),
      primary: false,
      onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID, false)
    }
  ];

  api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: t('configTitle'),
    modId: MOD_ID,
    content: content,
    buttons: buttons
  });
}

// --- UI: Initialization ---
function init() {
  if (isInitialized) return;
  
  try {
    api.ui.removeButton(EDITOR_TOGGLE_ID);
  } catch (error) {
    // Button doesn't exist, which is fine
  }

  api.ui.addButton({
    id: EDITOR_TOGGLE_ID,
    text: t('modName'),
    modId: MOD_ID,
    tooltip: t('configButtonTooltip'),
    primary: false,
    onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID, true)
  });
  
  api.ui.addButton({
    id: CONFIG_BUTTON_ID,
    icon: '⚙️',
    modId: MOD_ID,
    tooltip: t('configButtonTooltip'),
    onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID, true)
  });
  
  createConfigPanel();
  
  if (config.gridEnabled) {
    gridOverlay = createGridOverlay();
  }
  
  if (config.walkablePathsEnabled) {
    monitorGameState();
    reapplyPerformanceMode();
  }
  
  if (config.tileSpriteEditorEnabled) {
    enableTileIdEditing();
  }
  
  saveOriginalTileClasses();
  
  isInitialized = true;
  console.log('Map Editor Tools UI initialized');
}

// --- Start the mod ---
init();

// --- Exports ---
context.exports = {
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
    api.service.updateScriptConfig(context.hash, config);
    if (config.gridEnabled) {
      if (!gridOverlay) gridOverlay = createGridOverlay();
    } else {
      cleanupGrid();
    }
  },
  cleanup: () => {
    cleanupGrid();
    cleanupOverlayElements();
    cleanupSelectionOverlay();
    if (window._performanceModeDomObserver) {
      window._performanceModeDomObserver.disconnect();
      window._performanceModeDomObserver = null;
    }
  }
};