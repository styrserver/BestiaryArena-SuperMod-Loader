// =======================
// Map Editor Mod for Bestiary Arena
// =======================

// =======================
// 1. Configuration
// =======================
'use strict';

console.log('[Map Editor] Initializing...');

// =======================
// 2. Constants
// =======================

const MOD_ID = 'map-editor';
const BUTTON_ID = 'map-editor-button';
const PANEL_ID = 'map-editor-panel';
const STYLE_ID = 'map-editor-styles';
const BODY_ID = 'map-editor-body';
const STORAGE_KEY = 'mapEditorPanel';
const SESSION_STORAGE_PREFIX = 'mapEditorSession:';
const SESSION_VERSION = 2;
const HITBOX_OVERLAY_ID = 'map-editor-hitbox-overlay';
const PICK_OVERLAY_CLASS = 'map-editor-pick-overlay';
const HITBOX_OVERLAY_TILE_CLASS = 'map-editor-hitbox-tile-overlay';
const TILE_SELECT_ATTR = 'data-map-editor-selected';
const HIDDEN_ATTR = 'data-map-editor-hidden';
const EDITOR_ADDED_ATTR = 'data-map-editor-added';
const TILE_BOX_SIZE = 'calc(32px * var(--zoomFactor))';
const TILE_SELECT_BORDER = '2px solid #ffe066';
const SPRITE_PREVIEW_SIZE = 32;

const PANEL_DEFAULTS = {
  left: 80,
  top: 72,
  width: 380,
  height: 520,
  activeTab: 'edit'
};

const PANEL_LAYOUT = {
  minWidth: 300,
  maxWidth: 640,
  minHeight: 280,
  maxHeight: 900
};

const RESIZE_EDGE_PX = 8;

// =======================
// 3. State
// =======================

const editorState = {
  open: false,
  selectedTileIndex: null,
  hitboxOverlay: false,
  inspectorRoot: null,
  activeTab: 'edit',
  assetFilter: '',
  editingSprite: null,
  selectedSaveId: null
};

const editorEdits = {
  addedSprites: [],
  hiddenSprites: [],
  replacements: []
};

let boardUnsubscribe = null;
let trackedBoardKey = null; // room id only — floor changes are ignored
let boardToolsRefreshTimer = null;
let scopeHandlingSuspended = false;
const ROOM_RELOAD_BOUNCE_MS = 16;
const ROOM_RELOAD_SETTLE_MS = 200;
const ASSET_LIST_CHUNK_SIZE = 36;
const ASSET_LIST_PAGE_SIZE = 500;
const ASSET_LIST_SEARCH_DEBOUNCE_MS = 200;
const ASSET_LIST_SKELETON_COUNT = 12;
let tilePickRefreshTimer = null;
let tilePickObserver = null;
let panelDragMouseMoveHandler = null;
let panelDragMouseUpHandler = null;
let panelResizeMouseMoveHandler = null;
let panelResizeMouseUpHandler = null;
let panelViewportListenerAttached = false;
let assetListLoadId = 0;
let assetListRenderRaf = null;
let assetListSearchTimer = null;
let assetPreviewObserver = null;
let assetListLoadMoreObserver = null;
let assetListFilteredCache = null;
let assetListLoadingMore = false;

const panelDragState = {
  dragging: false,
  dragX: 0,
  dragY: 0,
  panel: null,
  reset() {
    this.dragging = false;
    this.panel = null;
  }
};

const panelResizeState = {
  isResizing: false,
  resizeDir: '',
  resizeStartX: 0,
  resizeStartY: 0,
  startWidth: 0,
  startHeight: 0,
  startLeft: 0,
  startTop: 0,
  reset() {
    this.isResizing = false;
    this.resizeDir = '';
    this.resizeStartX = 0;
    this.resizeStartY = 0;
    this.startWidth = 0;
    this.startHeight = 0;
    this.startLeft = 0;
    this.startTop = 0;
  }
};

// =======================
// 4. Utilities
// =======================

function t(key, fallback) {
  if (typeof api !== 'undefined' && api.i18n && typeof api.i18n.t === 'function') {
    const value = api.i18n.t(key);
    if (value && value !== key) return value;
  }
  return fallback;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clampPanelSize(val, min, max) {
  return clamp(val, min, max);
}

function loadPanelSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...PANEL_DEFAULTS };
    return { ...PANEL_DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...PANEL_DEFAULTS };
  }
}

function savePanelSettings(patch) {
  try {
    const next = { ...loadPanelSettings(), ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {}
}

function logMapEditor(...args) {
  console.log('[Map Editor]', ...args);
}

// =======================
// 5. Room & board helpers
// =======================

function getBoardContext() {
  try {
    return globalThis.state?.board?.getSnapshot?.()?.context || null;
  } catch (e) {
    return null;
  }
}

function getCurrentRoom() {
  return getBoardContext()?.selectedMap?.selectedRoom || null;
}

function getBoardFloor() {
  const sources = [
    () => globalThis.state?.board?.getSnapshot?.()?.context?.floor,
    () => globalThis.state?.board?.get?.()?.context?.floor
  ];
  for (const read of sources) {
    try {
      const floor = Number(read());
      if (Number.isFinite(floor)) {
        return Math.max(0, Math.min(15, Math.floor(floor)));
      }
    } catch (e) {
      // try next source
    }
  }
  return 0;
}

function getAllGameRooms() {
  const rooms = globalThis.state?.utils?.ROOMS;
  return Array.isArray(rooms) ? rooms : [];
}

function getBoardRoomKey() {
  return getCurrentRoom()?.id ?? null;
}

function adoptTrackedBoardKey() {
  trackedBoardKey = getBoardRoomKey();
}

function hasPendingEditorEdits() {
  return editorEdits.addedSprites.length > 0
    || editorEdits.hiddenSprites.length > 0
    || editorEdits.replacements.length > 0;
}

function removeOrphanedEditorAddedSprites() {
  let removed = 0;
  document.querySelectorAll(`[${EDITOR_ADDED_ATTR}="1"]`).forEach((el) => {
    try {
      el.remove();
      removed += 1;
    } catch (e) {
      // ignore
    }
  });
  if (removed) logMapEditor('removeOrphanedAddedSprites', { removed });
  return removed;
}

function resetEditorEdits() {
  editorEdits.addedSprites = [];
  editorEdits.hiddenSprites = [];
  editorEdits.replacements = [];
}

function trackAddedSprite(tileIndex, spriteEl) {
  if (tileIndex == null || !spriteEl) return;
  editorEdits.addedSprites.push({ tileIndex, sprite: spriteEl });
}

function trackHiddenSprite(tileIndex, spriteEl) {
  if (tileIndex == null || !spriteEl) return;
  editorEdits.hiddenSprites.push({ tileIndex, sprite: spriteEl });
}

function trackReplacement(tileIndex, spriteEl, fromId, toId) {
  if (tileIndex == null || !spriteEl) return;
  editorEdits.replacements.push({ tileIndex, sprite: spriteEl, fromId, toId });
}

function isEditorAddedSprite(spriteEl) {
  return spriteEl?.hasAttribute(EDITOR_ADDED_ATTR) ?? false;
}

function untrackAddedSprite(spriteEl) {
  if (!spriteEl) return;
  editorEdits.addedSprites = editorEdits.addedSprites.filter((entry) => entry.sprite !== spriteEl);
}

function removeEditorAddedSprite(spriteEl) {
  if (!spriteEl?.hasAttribute(EDITOR_ADDED_ATTR)) return false;
  untrackAddedSprite(spriteEl);
  try {
    spriteEl.remove();
    return true;
  } catch (e) {
    return false;
  }
}

function removeAddedSprite(spriteEl, tileIndex = null) {
  if (!isEditorAddedSprite(spriteEl)) return false;

  const ids = getSpriteIdsFromElement(spriteEl);
  const resolvedTileIndex = tileIndex ?? getTileIndexFromElement(spriteEl);
  if (editorState.editingSprite?.tileIndex === resolvedTileIndex
    && ids.includes(editorState.editingSprite.fromId)) {
    editorState.editingSprite = null;
  }

  const ok = removeEditorAddedSprite(spriteEl);
  if (ok) {
    logMapEditor('removeAddedSprite', { tileIndex: resolvedTileIndex, spriteIds: ids });
  }
  return ok;
}

function isLikelyAddedSprite(config, tileIndex, sessionSprites, spriteIndex) {
  if (!config?.id) return false;
  const original = getConfiguredTileLayer(tileIndex) || [];
  const idCountInOriginal = original.filter((entry) => entry?.id === config.id).length;
  const instanceNumber = (sessionSprites || [])
    .slice(0, spriteIndex + 1)
    .filter((entry) => entry?.id === config.id).length;
  return instanceNumber > idCountInOriginal;
}

function revertSpriteReplacement(entry) {
  const { sprite, fromId, toId } = entry;
  if (!sprite?.isConnected || fromId == null || toId == null) return false;
  if (!sprite.classList.contains(`id-${toId}`)) return false;

  sprite.classList.remove(`id-${toId}`);
  sprite.classList.add(`id-${fromId}`);
  const img = sprite.querySelector('img');
  if (img) {
    img.alt = String(fromId);
    const config = (getConfiguredTileLayer(entry.tileIndex) || []).find((item) => item?.id === fromId);
    if (config) applySpriteConfigToElement(sprite, config);
    else {
      img.setAttribute('data-cropped', 'false');
      img.style.setProperty('--cropX', '0');
      img.style.setProperty('--cropY', '0');
    }
  }
  return true;
}

function revertAllEditorEdits() {
  let reverted = 0;

  for (const entry of [...editorEdits.replacements].reverse()) {
    if (revertSpriteReplacement(entry)) reverted += 1;
  }
  for (const entry of [...editorEdits.hiddenSprites].reverse()) {
    if (restoreSpriteElement(entry.sprite)) reverted += 1;
  }
  for (const entry of [...editorEdits.addedSprites].reverse()) {
    if (removeEditorAddedSprite(entry.sprite)) reverted += 1;
  }

  removeOrphanedEditorAddedSprites();
  resetEditorEdits();
  logMapEditor('revertEditorEdits', { reverted });
  return reverted;
}

function getActiveBoardRoot() {
  const scene = document.getElementById('background-scene');
  if (scene?.isConnected) return scene;
  const tiles = getTilesContainer();
  if (tiles?.isConnected) return tiles;
  return getBoardPickRoot();
}

function getActiveTileElements() {
  const root = getActiveBoardRoot();
  if (root) return Array.from(root.querySelectorAll('[id^="tile-index-"]'));
  return Array.from(document.querySelectorAll('[id^="tile-index-"]'));
}

function findBounceRoomId(excludeRoomId) {
  const excluded = String(excludeRoomId || '');
  try {
    const roomNames = globalThis.state?.utils?.ROOM_NAME;
    if (roomNames && typeof roomNames === 'object') {
      for (const [roomId, name] of Object.entries(roomNames)) {
        if (String(roomId) === excluded) continue;
        if (String(name) === 'Sewers') return roomId;
      }
      for (const roomId of Object.keys(roomNames)) {
        if (String(roomId) !== excluded) return roomId;
      }
    }

    const regionRooms = getBoardContext()?.selectedMap?.selectedRegion?.rooms;
    if (Array.isArray(regionRooms)) {
      for (const room of regionRooms) {
        const id = room?.id || room?.roomId || room;
        if (id && String(id) !== excluded) return id;
      }
    }
  } catch (e) {
    // ignore
  }
  return null;
}

function navigateToRoomById(roomId) {
  if (!roomId || !globalThis.state?.board?.send) return false;
  globalThis.state.board.send({ type: 'selectRoomById', roomId });
  return true;
}

function setBoardFloor(floor) {
  try {
    globalThis.state?.board?.trigger?.setState?.({
      fn: (prev) => ({ ...prev, floor })
    });
    return true;
  } catch (e) {
    return false;
  }
}

function getRoomDisplayName(room) {
  if (!room) return 'Unknown room';
  const utils = globalThis.state?.utils;
  if (utils?.ROOM_NAME && room.id && utils.ROOM_NAME[room.id]) {
    return utils.ROOM_NAME[room.id];
  }
  return room.file?.name || room.id || 'Unknown room';
}

function getHitboxes() {
  return getCurrentRoom()?.file?.data?.hitboxes || null;
}

function getConfiguredTileLayer(tileIndex) {
  const layer = getCurrentRoom()?.file?.data?.tiles?.[tileIndex];
  return Array.isArray(layer) ? layer : null;
}

function formatSpriteConfigHint(entry) {
  if (!entry || typeof entry !== 'object') return '';
  const parts = [];
  if (entry.cropX != null) parts.push(`cropX ${entry.cropX}`);
  if (entry.cropY != null) parts.push(`cropY ${entry.cropY}`);
  if (entry.bank != null) parts.push(`bank ${entry.bank}`);
  if (entry.cropped) parts.push('cropped');
  return parts.length ? parts.join(', ') : '';
}

// =======================
// 6. Tile DOM helpers
// =======================

function getTileElement(tileIndex) {
  if (tileIndex == null) return null;
  const id = `tile-index-${tileIndex}`;
  const root = getActiveBoardRoot();
  if (root) {
    const inRoot = root.querySelector(`#${id}, [id="${id}"]`);
    if (inRoot) return inRoot;
  }
  return document.getElementById(id) || document.querySelector(`[id="${id}"]`);
}

function getTileIndexFromElement(el) {
  if (!el) return null;
  const tile = el.closest?.('[id^="tile-index-"]');
  if (!tile?.id) return null;
  const match = tile.id.match(/^tile-index-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function getSpriteIdsFromElement(spriteEl) {
  if (!spriteEl?.classList) return [];
  const ids = [];
  for (const className of spriteEl.classList) {
    if (className.startsWith('id-')) {
      const id = Number(className.slice(3));
      if (Number.isFinite(id)) ids.push(id);
    } else if (/^\d+\.png$/.test(className)) {
      const id = Number(className.slice(0, -4));
      if (Number.isFinite(id)) ids.push(id);
    }
  }
  return ids;
}

function getSpritesOnTile(tileEl) {
  if (!tileEl) return [];
  return Array.from(tileEl.querySelectorAll('.sprite')).filter((el) => !el.hasAttribute(HIDDEN_ATTR));
}

function getAllSpritesOnTile(tileEl) {
  if (!tileEl) return [];
  return Array.from(tileEl.querySelectorAll('.sprite'));
}

function isSpriteHidden(spriteEl) {
  return spriteEl?.hasAttribute(HIDDEN_ATTR) ?? false;
}

function getSpriteInnerHTML(spriteId) {
  return `<div class="sprite item relative id-${spriteId}" style="z-index:1000;"><div class="viewport"><img alt="${spriteId}" data-cropped="false" class="spritesheet" style="--cropX:0;--cropY:0;"></div></div>`;
}

function applySpriteConfigToElement(spriteEl, configEntry) {
  if (!spriteEl || !configEntry) return;
  const img = spriteEl.querySelector('img');
  if (!img) return;
  if (configEntry.cropX != null) img.style.setProperty('--cropX', String(configEntry.cropX));
  if (configEntry.cropY != null) img.style.setProperty('--cropY', String(configEntry.cropY));
  if (configEntry.cropped || configEntry.cropX > 0 || configEntry.cropY > 0) {
    img.setAttribute('data-cropped', 'true');
  }
  if (configEntry.bank != null) {
    spriteEl.setAttribute('data-bank', String(configEntry.bank));
    spriteEl.style.setProperty('--bank', String(configEntry.bank));
  }
}

function findSpriteReference(spriteId, configEntry) {
  if (spriteId == null) return null;
  const selector = `.sprite.item.id-${spriteId}, .sprite.relative.id-${spriteId}`;
  const nodes = document.querySelectorAll(`#viewport ${selector}, ${selector}`);
  if (!nodes.length) return null;

  const wantsBank = configEntry?.bank != null;
  const wantsCropX = configEntry?.cropX != null;
  const wantsCropY = configEntry?.cropY != null;
  if (!wantsBank && !wantsCropX && !wantsCropY) return nodes[0];

  for (const node of nodes) {
    const img = node.querySelector('img.spritesheet');
    const bank = node.getAttribute('data-bank') || node.style.getPropertyValue('--bank');
    const cropX = img?.style.getPropertyValue('--cropX');
    const cropY = img?.style.getPropertyValue('--cropY');
    if (wantsBank && String(bank) !== String(configEntry.bank)) continue;
    if (wantsCropX && cropX && Number(cropX) !== Number(configEntry.cropX)) continue;
    if (wantsCropY && cropY && Number(cropY) !== Number(configEntry.cropY)) continue;
    return node;
  }

  return nodes[0];
}

function isSimpleItemSprite(configEntry, spriteEl) {
  if (configEntry?.bank != null) return false;
  if (configEntry?.cropped) return false;
  if (Number(configEntry?.cropX) > 0 || Number(configEntry?.cropY) > 0) return false;
  const img = spriteEl?.querySelector?.('img.spritesheet');
  if (!img) return !configEntry?.bank;
  if (img.getAttribute('data-cropped') === 'true') return false;
  const cropX = Number(img.style.getPropertyValue('--cropX') || 0);
  const cropY = Number(img.style.getPropertyValue('--cropY') || 0);
  if (cropX > 0 || cropY > 0) return false;
  const bank = spriteEl.getAttribute('data-bank') || spriteEl.style.getPropertyValue('--bank');
  return !bank;
}

const PREVIEW_COPY_PROPS = [
  'background-image', 'background-position', 'background-size', 'background-repeat',
  'mask-image', '-webkit-mask-image', 'mask-position', '-webkit-mask-position',
  'mask-size', '-webkit-mask-size', 'mask-repeat', '-webkit-mask-repeat',
  'image-rendering'
];

function copySpritePreviewVisual(sourceEl, targetEl) {
  if (!sourceEl || !targetEl) return;
  const computed = getComputedStyle(sourceEl);
  targetEl.style.transform = '';
  targetEl.style.transformOrigin = '';
  targetEl.style.objectFit = '';
  targetEl.style.objectPosition = '';
  PREVIEW_COPY_PROPS.forEach((prop) => {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'initial') {
      targetEl.style.setProperty(prop, value);
    }
  });
  if (sourceEl.className) targetEl.className = sourceEl.className;
  const cropped = sourceEl.getAttribute('data-cropped');
  if (cropped) targetEl.setAttribute('data-cropped', cropped);
  for (const prop of ['--cropX', '--cropY', '--bank']) {
    const value = sourceEl.style.getPropertyValue(prop) || computed.getPropertyValue(prop);
    if (value) targetEl.style.setProperty(prop, value);
  }
  if (sourceEl.tagName === 'IMG' && sourceEl.src && !sourceEl.src.endsWith('/') && sourceEl.src !== window.location.href) {
    targetEl.src = sourceEl.src;
    targetEl.style.display = '';
  }
}

function sanitizePreviewSpriteLayout(spriteNode) {
  if (!spriteNode) return;
  spriteNode.style.transform = '';
  spriteNode.style.transformOrigin = '';
  const img = spriteNode.querySelector('img.spritesheet');
  const viewport = spriteNode.querySelector('.viewport');
  if (img) {
    img.style.transform = '';
    img.style.transformOrigin = '';
    if (img.style.display === 'none') img.style.display = '';
  }
  if (viewport) {
    viewport.style.transform = '';
    viewport.style.transformOrigin = '';
    viewport.style.width = `${SPRITE_PREVIEW_SIZE}px`;
    viewport.style.height = `${SPRITE_PREVIEW_SIZE}px`;
    viewport.style.overflow = 'hidden';
  }
}

function copySpriteSheetVisual(sourceEl, targetEl) {
  copySpritePreviewVisual(sourceEl, targetEl);
}

function hasVisibleSpritePreview(spriteNode) {
  if (!spriteNode) return false;
  const img = spriteNode.querySelector('img.spritesheet');
  const viewport = spriteNode.querySelector('.viewport');
  if (img?.src && img.src !== window.location.href && img.style.display !== 'none') return true;
  const imgStyle = img ? getComputedStyle(img) : null;
  const viewportStyle = viewport ? getComputedStyle(viewport) : null;
  const hasBg = (style) => style && style.backgroundImage && style.backgroundImage !== 'none';
  const hasMask = (style) => style && style.maskImage && style.maskImage !== 'none';
  return hasMask(imgStyle) || hasBg(imgStyle) || hasBg(viewportStyle);
}

function applyItemSpriteFallback(spriteNode, spriteId) {
  const id = Number(spriteId);
  if (!spriteNode || !Number.isFinite(id)) return;
  const viewport = spriteNode.querySelector('.viewport');
  const img = spriteNode.querySelector('img.spritesheet');
  const url = `/assets/ITEM/${id}.png`;

  sanitizePreviewSpriteLayout(spriteNode);
  if (viewport) viewport.style.backgroundImage = '';

  if (img) {
    img.style.display = 'block';
    img.src = url;
    img.alt = String(id);
    img.className = 'spritesheet';
    img.setAttribute('data-cropped', 'false');
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'none';
    img.style.objectPosition = '0 0';
    img.style.imageRendering = 'pixelated';
    img.style.backgroundImage = '';
    img.style.maskImage = '';
    img.style.webkitMaskImage = '';
  }
}

function hydrateFromViewportProbe(targetSprite, probeSource) {
  const viewportRoot = document.getElementById('viewport');
  if (!viewportRoot || !targetSprite || !probeSource) return false;

  const holder = document.createElement('div');
  holder.className = 'map-editor-sprite-probe';
  holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:32px;height:32px;overflow:hidden;opacity:0;pointer-events:none;';
  const probe = probeSource.cloneNode(true);
  holder.appendChild(probe);
  viewportRoot.appendChild(holder);

  const probeImg = probe.querySelector('img.spritesheet');
  const probeViewport = probe.querySelector('.viewport');
  const targetImg = targetSprite.querySelector('img.spritesheet');
  const targetViewport = targetSprite.querySelector('.viewport');

  const bank = probe.getAttribute('data-bank');
  if (bank) targetSprite.setAttribute('data-bank', bank);
  const bankVar = probe.style.getPropertyValue('--bank') || getComputedStyle(probe).getPropertyValue('--bank');
  if (bankVar) targetSprite.style.setProperty('--bank', bankVar);

  copySpritePreviewVisual(probeImg, targetImg);
  copySpritePreviewVisual(probeViewport, targetViewport);
  sanitizePreviewSpriteLayout(targetSprite);

  holder.remove();
  return hasVisibleSpritePreview(targetSprite);
}

function hydrateSpritePreviewVisual(spriteNode, configEntry, sourceSpriteEl) {
  if (!spriteNode) return;

  const spriteId = configEntry?.id
    ?? getSpriteIdsFromElement(sourceSpriteEl)[0]
    ?? getSpriteIdsFromElement(spriteNode)[0];
  const reference = sourceSpriteEl || findSpriteReference(spriteId, configEntry);

  if (isSimpleItemSprite(configEntry, reference || spriteNode)) {
    applyItemSpriteFallback(spriteNode, spriteId);
    return;
  }

  const probeSource = reference || buildSpriteElementFromConfig(configEntry);

  if (probeSource && hydrateFromViewportProbe(spriteNode, probeSource)) return;
  if (reference) {
    copySpritePreviewVisual(reference.querySelector('img.spritesheet'), spriteNode.querySelector('img.spritesheet'));
    copySpritePreviewVisual(reference.querySelector('.viewport'), spriteNode.querySelector('.viewport'));
    sanitizePreviewSpriteLayout(spriteNode);
    if (hasVisibleSpritePreview(spriteNode)) return;
  }
  if (spriteId != null) applyItemSpriteFallback(spriteNode, spriteId);
}

function buildSpriteElementFromConfig(configEntry) {
  if (!configEntry?.id) return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = getSpriteInnerHTML(configEntry.id);
  const sprite = wrap.firstElementChild;
  if (!sprite) return null;
  applySpriteConfigToElement(sprite, configEntry);
  return sprite;
}

function normalizeSpritePreviewNode(spriteEl) {
  if (!spriteEl) return null;
  const clone = spriteEl.cloneNode(true);
  clone.style.visibility = '';
  clone.style.display = '';
  clone.style.pointerEvents = 'none';
  clone.removeAttribute(HIDDEN_ATTR);
  clone.querySelectorAll(`.${PICK_OVERLAY_CLASS}`).forEach((el) => el.remove());

  const sourceImg = spriteEl.querySelector('img.spritesheet');
  const cloneImg = clone.querySelector('img.spritesheet');
  if (sourceImg && cloneImg) {
    if (sourceImg.src) cloneImg.src = sourceImg.src;
    if (sourceImg.currentSrc) cloneImg.src = sourceImg.currentSrc;
    cloneImg.className = sourceImg.className;
    for (const prop of ['--cropX', '--cropY', '--bank']) {
      const value = sourceImg.style.getPropertyValue(prop);
      if (value) cloneImg.style.setProperty(prop, value);
    }
    const cropped = sourceImg.getAttribute('data-cropped');
    if (cropped) cloneImg.setAttribute('data-cropped', cropped);
  }

  return clone;
}

function createSpritePreviewBox(spriteEl, configEntry) {
  const box = document.createElement('div');
  box.className = 'me-sprite-preview';
  const spriteId = spriteEl
    ? getSpriteIdsFromElement(spriteEl)[0]
    : configEntry?.id;
  box.title = spriteId != null ? `Sprite ID ${spriteId}` : 'Sprite preview';

  let spriteNode = spriteEl ? normalizeSpritePreviewNode(spriteEl) : null;
  if (!spriteNode && configEntry) {
    spriteNode = buildSpriteElementFromConfig(configEntry);
  }
  if (!spriteNode) {
    box.classList.add('me-sprite-preview-empty');
    box.textContent = '?';
    return box;
  }

  hydrateSpritePreviewVisual(spriteNode, configEntry, spriteEl || null);
  box.appendChild(spriteNode);
  return box;
}

function refreshTilePreview(container, tileEl, sprites, configuredLayer) {
  if (!container) return;
  container.replaceChildren();

  const sources = sprites.length
    ? sprites.map((sprite, index) => ({ sprite, configEntry: configuredLayer?.[index] || null }))
    : (configuredLayer || []).map((configEntry) => ({ sprite: null, configEntry }));

  if (!tileEl || !sources.length) {
    container.classList.add('me-tile-preview-empty');
    const empty = document.createElement('span');
    empty.className = 'me-preview-placeholder';
    empty.textContent = '—';
    container.appendChild(empty);
    return;
  }

  container.classList.remove('me-tile-preview-empty');
  const stage = document.createElement('div');
  stage.className = 'me-tile-preview-stage';

  sources.forEach(({ sprite, configEntry }, index) => {
    const layer = document.createElement('div');
    layer.className = 'me-tile-preview-layer';
    layer.style.zIndex = String(index + 1);
    let spriteNode = sprite ? normalizeSpritePreviewNode(sprite) : buildSpriteElementFromConfig(configEntry);
    if (!spriteNode && configEntry) spriteNode = buildSpriteElementFromConfig(configEntry);
    if (spriteNode) {
      hydrateSpritePreviewVisual(spriteNode, configEntry, sprite || null);
      layer.appendChild(spriteNode);
    }
    stage.appendChild(layer);
  });

  container.appendChild(stage);
}

// =======================
// 7. Sprite editing
// =======================

function replaceSpriteOnTile(tileEl, fromId, toId, tileIndex = null) {
  const sprite = tileEl?.querySelector(`.sprite.id-${fromId}, .sprite.relative.id-${fromId}, .sprite.item.id-${fromId}`);
  if (!sprite) return false;
  sprite.classList.remove(`id-${fromId}`);
  sprite.classList.add(`id-${toId}`);
  const img = sprite.querySelector('img');
  if (img) {
    img.alt = String(toId);
    img.setAttribute('data-cropped', 'false');
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
  }
  const resolvedTileIndex = tileIndex ?? getTileIndexFromElement(tileEl);
  trackReplacement(resolvedTileIndex, sprite, fromId, toId);
  return true;
}

function addSpriteToTile(tileEl, spriteId, tileIndex = null, configEntry = null) {
  if (!tileEl || tileEl.querySelector(`.id-${spriteId}`)) return false;
  const wrap = document.createElement('div');
  wrap.innerHTML = getSpriteInnerHTML(spriteId);
  if (!wrap.firstElementChild) return false;
  const sprite = wrap.firstElementChild;
  if (configEntry) applySpriteConfigToElement(sprite, configEntry);
  sprite.setAttribute(EDITOR_ADDED_ATTR, '1');
  tileEl.appendChild(sprite);
  trackAddedSprite(tileIndex ?? getTileIndexFromElement(tileEl), sprite);
  return true;
}

function hideSpriteElement(spriteEl, tileIndex = null) {
  if (!spriteEl || spriteEl.hasAttribute(HIDDEN_ATTR)) return false;
  spriteEl.style.visibility = 'hidden';
  spriteEl.style.display = 'none';
  spriteEl.style.pointerEvents = 'none';
  spriteEl.setAttribute(HIDDEN_ATTR, '1');
  trackHiddenSprite(tileIndex ?? getTileIndexFromElement(spriteEl), spriteEl);
  logMapEditor('hideSprite', { spriteIds: getSpriteIdsFromElement(spriteEl) });
  return true;
}

function restoreSpriteElement(spriteEl) {
  if (!spriteEl || !spriteEl.hasAttribute(HIDDEN_ATTR)) return false;
  spriteEl.style.visibility = '';
  spriteEl.style.display = '';
  spriteEl.style.pointerEvents = '';
  spriteEl.removeAttribute(HIDDEN_ATTR);
  editorEdits.hiddenSprites = editorEdits.hiddenSprites.filter((entry) => entry.sprite !== spriteEl);
  logMapEditor('restoreSprite', { spriteIds: getSpriteIdsFromElement(spriteEl) });
  return true;
}

function clearTileSelection() {
  document.querySelectorAll(`[${TILE_SELECT_ATTR}="1"]`).forEach((tile) => {
    tile.removeAttribute(TILE_SELECT_ATTR);
    tile.style.outline = '';
    tile.style.outlineOffset = '';
  });
  syncTileSelectionVisuals();
}

function syncTileSelectionVisuals() {
  document.querySelectorAll(`.${PICK_OVERLAY_CLASS}`).forEach((overlay) => {
    const tileIndex = Number(overlay.dataset.tileIndex)
      ?? getTileIndexFromElement(overlay.parentElement);
    const selected = editorState.selectedTileIndex === tileIndex;
    overlay.style.border = selected ? TILE_SELECT_BORDER : '';
    overlay.style.boxSizing = selected ? 'border-box' : '';
  });
}

function selectTile(tileIndex) {
  if (!editorState.open || tileIndex == null) return;
  if (editorState.editingSprite && editorState.editingSprite.tileIndex !== tileIndex) {
    editorState.editingSprite = null;
  }
  logMapEditor('tileClick', { tileIndex, roomId: getCurrentRoom()?.id || null });
  editorState.selectedTileIndex = tileIndex;
  markTileSelected(tileIndex);
  refreshInspector();
}

function startSpriteEdit(tileIndex, fromId) {
  if (tileIndex == null || fromId == null) return;
  editorState.editingSprite = { tileIndex, fromId };
  refreshInspector();
}

function cancelSpriteEdit() {
  editorState.editingSprite = null;
  refreshInspector();
}

function applySpriteEdit(tileIndex, fromId, toId) {
  if (tileIndex == null || !Number.isFinite(fromId) || !Number.isFinite(toId)) {
    setStatusMessage(t('mods.mapEditor.editNeedId', 'Enter a valid new sprite ID.'), true);
    return;
  }
  if (toId === fromId) {
    cancelSpriteEdit();
    return;
  }
  const ok = replaceSpriteOnTile(getTileElement(tileIndex), fromId, toId, tileIndex);
  logMapEditor('spriteEditApply', { tileIndex, fromId, toId, ok });
  editorState.editingSprite = null;
  setStatusMessage(
    ok
      ? t('mods.mapEditor.replaceOk', 'Replaced id-{from} → id-{to}.')
          .replace('{from}', String(fromId))
          .replace('{to}', String(toId))
      : t('mods.mapEditor.replaceFail', 'Sprite id-{from} not found on tile.').replace('{from}', String(fromId)),
    !ok
  );
  refreshInspector();
}

// =======================
// 8. Battlefield overlays
// =======================

function getTileOverlayBoxStyle(extra) {
  return [
    'position:absolute',
    'right:0',
    'bottom:0',
    `width:${TILE_BOX_SIZE}`,
    `height:${TILE_BOX_SIZE}`,
    ...(extra || [])
  ].join(';');
}

function getTilesContainer() {
  return document.getElementById('tiles');
}

function getZoomFactor() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--zoomFactor');
  const zoom = parseFloat(raw);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}

function parseTileCalcPx(expression, zoom) {
  if (!expression) return null;
  const pxMatch = /(\d+(?:\.\d+)?)\s*px/.exec(expression);
  if (!pxMatch) return null;
  const base = parseFloat(pxMatch[1]);
  if (!Number.isFinite(base)) return null;
  return expression.includes('zoomFactor') ? base * zoom : base;
}

function getElementAnchorCalcs(element) {
  const style = element?.getAttribute?.('style') || '';
  const rightMatch = /\bright:\s*calc\(([^;]+)\)/i.exec(style);
  const bottomMatch = /\bbottom:\s*calc\(([^;]+)\)/i.exec(style);
  if (!rightMatch || !bottomMatch) return null;
  return {
    right: rightMatch[1].trim(),
    bottom: bottomMatch[1].trim()
  };
}

function getTileAnchorCalcs(tileElement) {
  return getElementAnchorCalcs(tileElement);
}

function normalizeAnchorCalc(value) {
  return String(value || '').replace(/\s+/g, '');
}

function findTileIndexByAnchorCalcs(right, bottom) {
  const wantRight = normalizeAnchorCalc(right);
  const wantBottom = normalizeAnchorCalc(bottom);
  let match = null;
  getActiveTileElements().forEach((tileElement) => {
    const calcs = getTileAnchorCalcs(tileElement);
    if (!calcs) return;
    if (normalizeAnchorCalc(calcs.right) === wantRight
      && normalizeAnchorCalc(calcs.bottom) === wantBottom) {
      match = getTileIndexFromElement(tileElement);
    }
  });
  return match;
}

function resolveTileIndexFromBoardElement(el) {
  const button = el?.closest?.('button[aria-roledescription="draggable"]');
  if (!button || button.closest('#monster-scroll') || button.closest('[role="dialog"]')) {
    return null;
  }
  const calcs = getElementAnchorCalcs(button);
  if (!calcs) return null;
  return findTileIndexByAnchorCalcs(calcs.right, calcs.bottom);
}

function getBoardPickRoot() {
  return document.getElementById('background-scene')
    || document.getElementById('board')
    || document.getElementById('viewport')
    || getTilesContainer();
}

function isBoardPickPoint(clientX, clientY) {
  const root = getBoardPickRoot();
  if (!root) return false;
  const rect = root.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right
    && clientY >= rect.top && clientY <= rect.bottom;
}

function getTilePickBoxOnScreen(tileElement) {
  const overlay = tileElement.querySelector?.(`.${PICK_OVERLAY_CLASS}`);
  if (overlay) {
    const rect = overlay.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
  }

  const tiles = getTilesContainer();
  if (!tiles) return null;
  const tilesRect = tiles.getBoundingClientRect();
  const box = getTilePickBoxInTilesCoords(tileElement, tilesRect);
  if (!box) return null;
  return {
    left: tilesRect.left + box.left,
    top: tilesRect.top + box.top,
    width: box.width,
    height: box.height
  };
}

function getTilePickBoxInTilesCoords(tileElement, tilesRect) {
  const calcs = getTileAnchorCalcs(tileElement);
  if (!calcs) return null;
  const zoom = getZoomFactor();
  const rightPx = parseTileCalcPx(calcs.right, zoom);
  const bottomPx = parseTileCalcPx(calcs.bottom, zoom);
  if (rightPx == null || bottomPx == null) return null;
  const size = 32 * zoom;
  const left = tilesRect.width - rightPx - size;
  const top = tilesRect.height - bottomPx - size;
  return { left, top, width: size, height: size };
}

function resolveTileIndexAtPoint(clientX, clientY) {
  let bestIndex = null;
  let bestDist = Infinity;
  getActiveTileElements().forEach((tileElement) => {
    const tileIndex = getTileIndexFromElement(tileElement);
    const box = getTilePickBoxOnScreen(tileElement);
    if (tileIndex == null || !box) return;

    const inside = clientX >= box.left && clientX <= box.left + box.width
      && clientY >= box.top && clientY <= box.top + box.height;
    if (!inside) return;

    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const dist = (clientX - centerX) ** 2 + (clientY - centerY) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = tileIndex;
    }
  });

  return bestIndex;
}

function refreshTilePickOverlays() {
  removeTilePickOverlays();
  if (!editorState.open) return;

  getActiveTileElements().forEach((tileElement) => {
    const tileIndex = getTileIndexFromElement(tileElement);
    if (tileIndex == null) return;

    const overlay = document.createElement('div');
    overlay.className = PICK_OVERLAY_CLASS;
    overlay.title = `Tile ${tileIndex}`;
    overlay.style.cssText = getTileOverlayBoxStyle([
      'pointer-events:auto',
      'cursor:crosshair',
      'z-index:10002',
      'background:transparent'
    ]);
    bindPickOverlay(overlay, tileIndex);
    if (editorState.selectedTileIndex === tileIndex) {
      overlay.style.border = TILE_SELECT_BORDER;
      overlay.style.boxSizing = 'border-box';
    }
    tileElement.appendChild(overlay);
  });

  applyBoardPiecePassThrough(true);
  syncTileSelectionVisuals();
}

function applyBoardPiecePassThrough(enable) {
  const selector = [
    '#viewport button[aria-roledescription="draggable"]',
    '#background-scene button[aria-roledescription="draggable"]',
    '#board button[aria-roledescription="draggable"]',
    '#actors > *'
  ].join(',');

  document.querySelectorAll(selector).forEach((el) => {
    if (el.closest('#monster-scroll') || el.closest('.tab-picker-scroll') || el.closest('[role="dialog"]')) {
      return;
    }
    if (enable) {
      if (el.dataset.mapEditorPassThrough === '1') return;
      el.dataset.mapEditorPassThrough = '1';
      el.dataset.mapEditorPrevPointerEvents = el.style.pointerEvents || '';
      el.style.pointerEvents = 'none';
      return;
    }
    if (el.dataset.mapEditorPassThrough !== '1') return;
    delete el.dataset.mapEditorPassThrough;
    el.style.pointerEvents = el.dataset.mapEditorPrevPointerEvents || '';
    delete el.dataset.mapEditorPrevPointerEvents;
  });
}

function bindPickOverlay(overlay, tileIndex) {
  overlay.dataset.tileIndex = String(tileIndex);
  const onPick = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    logMapEditor('pickOverlayClick', { tileIndex });
    selectTile(tileIndex);
  };
  overlay.addEventListener('pointerdown', onPick);
  overlay.addEventListener('click', onPick);
}

function removeTilePickOverlays() {
  document.querySelectorAll(`.${PICK_OVERLAY_CLASS}`).forEach((el) => el.remove());
}

function scheduleTilePickRefresh() {
  if (tilePickRefreshTimer) clearTimeout(tilePickRefreshTimer);
  tilePickRefreshTimer = setTimeout(() => {
    tilePickRefreshTimer = null;
    if (!editorState.open) return;
    refreshTilePickOverlays();
    updateHitboxOverlay();
  }, 150);
}

function isMapEditorOverlayNode(node) {
  if (node.nodeType !== 1) return true;
  return node.classList?.contains(PICK_OVERLAY_CLASS)
    || node.classList?.contains(HITBOX_OVERLAY_TILE_CLASS);
}

function attachTilePickObserver() {
  if (tilePickObserver || typeof MutationObserver === 'undefined') return;
  const root = getBoardPickRoot();
  if (!root) return;
  tilePickObserver = new MutationObserver((records) => {
    const onlyEditorOverlay = records.every((record) => {
      const nodes = [...(record.addedNodes || []), ...(record.removedNodes || [])];
      return nodes.length === 0 || nodes.every((node) => isMapEditorOverlayNode(node));
    });
    if (onlyEditorOverlay) return;
    scheduleTilePickRefresh();
  });
  tilePickObserver.observe(root, { childList: true, subtree: true });
}

function detachTilePickObserver() {
  if (tilePickRefreshTimer) {
    clearTimeout(tilePickRefreshTimer);
    tilePickRefreshTimer = null;
  }
  if (tilePickObserver) {
    try { tilePickObserver.disconnect(); } catch (e) {}
    tilePickObserver = null;
  }
}

function markTileSelected(tileIndex) {
  clearTileSelection();
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return;
  tileEl.setAttribute(TILE_SELECT_ATTR, '1');
  syncTileSelectionVisuals();
}

function removeHitboxOverlay() {
  document.getElementById(HITBOX_OVERLAY_ID)?.remove();
  document.querySelectorAll(`.${HITBOX_OVERLAY_TILE_CLASS}`).forEach((el) => el.remove());
}

function updateHitboxOverlay() {
  removeHitboxOverlay();
  if (!editorState.open || !editorState.hitboxOverlay) return;

  const hitboxes = getHitboxes();
  if (!hitboxes?.length) {
    setStatusMessage('No hitbox data for this room.', true);
    editorState.hitboxOverlay = false;
    const toggle = document.getElementById('map-editor-hitbox-toggle');
    if (toggle) toggle.checked = false;
    return;
  }

  let overlayCount = 0;
  getActiveTileElements().forEach((tileElement) => {
    const tileId = getTileIndexFromElement(tileElement);
    if (tileId == null || tileId >= hitboxes.length) return;

    const blocked = hitboxes[tileId] === true;
    const walkable = hitboxes[tileId] === false;
    if (!blocked && !walkable) return;

    const overlay = document.createElement('div');
    overlay.className = HITBOX_OVERLAY_TILE_CLASS;
    overlay.title = blocked ? `Tile ${tileId}: blocked` : `Tile ${tileId}: walkable`;
    const bg = blocked ? 'rgba(255,80,80,0.45)' : 'rgba(80,200,120,0.35)';
    overlay.style.cssText = getTileOverlayBoxStyle([
      'pointer-events:none',
      `background:${bg}`,
      'z-index:10000'
    ]);
    tileElement.appendChild(overlay);
    overlayCount += 1;
  });

  if (!overlayCount) {
    setStatusMessage('Hitbox data found but no battlefield tiles matched.', true);
    editorState.hitboxOverlay = false;
    const toggle = document.getElementById('map-editor-hitbox-toggle');
    if (toggle) toggle.checked = false;
    return;
  }

  setStatusMessage(`Hitbox overlay enabled (${overlayCount} tiles).`);
}

// =======================
// 9. Export
// =======================

function compactSpriteConfig(entry) {
  if (!entry?.id) return null;
  const compact = { id: entry.id };
  if (entry.cropX != null && entry.cropX !== 0) compact.cropX = entry.cropX;
  if (entry.cropY != null && entry.cropY !== 0) compact.cropY = entry.cropY;
  if (entry.cropped) compact.cropped = true;
  if (entry.bank != null) compact.bank = entry.bank;
  return compact;
}

function compactTileLayer(layer) {
  if (!Array.isArray(layer)) return [];
  return layer.map(compactSpriteConfig).filter(Boolean);
}

function buildTileExportEntry(tileIndex, sourceData) {
  const tileEl = getTileElement(tileIndex);
  const liveLayer = buildLiveTileLayer(tileEl);
  const originalLayer = sourceData.tiles?.[tileIndex];
  let sprites;
  if (liveLayer.length) {
    sprites = compactTileLayer(liveLayer);
  } else if (Array.isArray(originalLayer) && originalLayer.length) {
    sprites = compactTileLayer(originalLayer);
  }

  const entry = {};
  if (sprites?.length) entry.sprites = sprites;

  const hitboxes = sourceData.hitboxes;
  if (Array.isArray(hitboxes) && tileIndex < hitboxes.length && hitboxes[tileIndex] != null) {
    entry.hitbox = hitboxes[tileIndex];
  }

  const actors = sourceData.actors;
  if (Array.isArray(actors) && actors[tileIndex] != null) {
    entry.actor = cloneJson(actors[tileIndex]);
  }

  const floorBelow = sourceData.floorBelowTiles;
  if (Array.isArray(floorBelow) && floorBelow[tileIndex] != null) {
    entry.floorBelow = cloneJson(floorBelow[tileIndex]);
  }

  const blocked = sourceData.blocked;
  if (Array.isArray(blocked) && blocked[tileIndex] != null) {
    entry.blocked = cloneJson(blocked[tileIndex]);
  }

  const hasContent = entry.sprites?.length
    || entry.actor
    || entry.floorBelow != null
    || entry.blocked != null
    || entry.hitbox === true;

  return hasContent ? entry : null;
}

function buildTileBasedMapData(sourceData, tileCount) {
  const entriesByIndex = [];
  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const entry = buildTileExportEntry(tileIndex, sourceData);
    if (!entry) continue;
    entriesByIndex.push({ tileIndex, entry });
  }

  const usageCount = new Map();
  entriesByIndex.forEach(({ entry }) => {
    const key = JSON.stringify(entry);
    usageCount.set(key, (usageCount.get(key) || 0) + 1);
  });

  const templates = {};
  const templateKeyToId = new Map();
  let templateCounter = 0;
  const tiles = [];
  let actorCount = 0;

  entriesByIndex.forEach(({ tileIndex, entry }) => {
    if (entry.actor) actorCount += 1;
    const key = JSON.stringify(entry);
    const tileRef = { i: tileIndex };

    if (usageCount.get(key) >= 2) {
      let templateId = templateKeyToId.get(key);
      if (!templateId) {
        templateCounter += 1;
        templateId = `t${templateCounter}`;
        templateKeyToId.set(key, templateId);
        templates[templateId] = entry;
      }
      tileRef.template = templateId;
    } else {
      Object.assign(tileRef, entry);
    }

    tiles.push(tileRef);
  });

  tiles.sort((a, b) => a.i - b.i);

  return {
    tiles,
    templates,
    populatedCount: tiles.length,
    actorCount,
    templateCount: templateCounter
  };
}

function buildTileExport(tileIndex) {
  const sourceData = getCurrentRoom()?.file?.data || {};
  const entry = buildTileExportEntry(tileIndex, sourceData) || {};
  return {
    tileIndex,
    ...entry
  };
}

function cloneJson(value) {
  if (value == null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return null;
  }
}

function getMapTileCount() {
  const sourceData = getCurrentRoom()?.file?.data;
  if (Array.isArray(sourceData?.hitboxes) && sourceData.hitboxes.length) {
    return sourceData.hitboxes.length;
  }
  if (Array.isArray(sourceData?.tiles) && sourceData.tiles.length) {
    return sourceData.tiles.length;
  }
  let maxIndex = -1;
  getActiveTileElements().forEach((el) => {
    const index = getTileIndexFromElement(el);
    if (index != null && index > maxIndex) maxIndex = index;
  });
  return maxIndex >= 0 ? maxIndex + 1 : 0;
}

function buildLiveTileLayer(tileEl) {
  if (!tileEl) return [];
  return getSpritesOnTile(tileEl).map((sprite) => extractSpriteConfig(sprite)).filter(Boolean);
}

function extractSpriteConfig(sprite) {
  const ids = getSpriteIdsFromElement(sprite);
  const id = ids[0];
  if (id == null) return null;
  const entry = { id };
  const img = sprite.querySelector('img');
  if (img) {
    const cropX = img.style.getPropertyValue('--cropX');
    const cropY = img.style.getPropertyValue('--cropY');
    if (cropX && cropX !== '0') entry.cropX = Number(cropX) || cropX;
    if (cropY && cropY !== '0') entry.cropY = Number(cropY) || cropY;
    if (img.getAttribute('data-cropped') === 'true') entry.cropped = true;
  }
  const bank = sprite.getAttribute('data-bank');
  if (bank) entry.bank = Number(bank) || bank;
  return entry;
}

function spriteConfigEquals(a, b) {
  if (!a || !b) return false;
  if (a.id !== b.id) return false;
  if ((a.cropX ?? 0) !== (b.cropX ?? 0)) return false;
  if ((a.cropY ?? 0) !== (b.cropY ?? 0)) return false;
  if (!!a.cropped !== !!b.cropped) return false;
  if ((a.bank ?? null) !== (b.bank ?? null)) return false;
  return true;
}

function tileSessionDiffersFromOriginal(tileIndex, sprites) {
  const original = getConfiguredTileLayer(tileIndex) || [];
  const visible = sprites.filter((sprite) => !sprite.hidden);
  const hidden = sprites.filter((sprite) => sprite.hidden);

  if (visible.length !== original.length) return true;

  for (const hiddenSprite of hidden) {
    if (original.some((entry) => entry?.id === hiddenSprite.id)) return true;
  }

  for (const entry of original) {
    const live = visible.find((sprite) => sprite.id === entry.id);
    if (!live) return true;
    if (!spriteConfigEquals(live, entry)) return true;
  }

  for (const live of visible) {
    if (!original.some((entry) => entry?.id === live.id)) return true;
  }

  return false;
}

function buildTileSessionEntry(tileIndex) {
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return null;

  const sprites = getAllSpritesOnTile(tileEl)
    .map((sprite) => {
      const config = extractSpriteConfig(sprite);
      if (!config) return null;
      return { ...config, hidden: isSpriteHidden(sprite) };
    })
    .filter(Boolean);

  const original = getConfiguredTileLayer(tileIndex) || [];
  if (!sprites.length && !original.length) return null;
  if (!tileSessionDiffersFromOriginal(tileIndex, sprites)) return null;

  return { tileIndex, sprites };
}

function buildMapSessionSave() {
  const room = getCurrentRoom();
  if (!room?.id) return null;

  const tileCount = getMapTileCount();
  const tiles = [];
  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const entry = buildTileSessionEntry(tileIndex);
    if (entry) tiles.push(entry);
  }

  return {
    version: SESSION_VERSION,
    roomId: room.id,
    roomName: getRoomDisplayName(room),
    savedAt: new Date().toISOString(),
    selectedTileIndex: editorState.selectedTileIndex,
    tiles
  };
}

function getMapSessionStorageKey(roomId) {
  if (!roomId) return null;
  return `${SESSION_STORAGE_PREFIX}${roomId}`;
}

function createSaveId() {
  return `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeSaveName(name) {
  const trimmed = String(name || '').trim();
  return trimmed || t('mods.mapEditor.defaultSaveName', 'Untitled');
}

function normalizeSessionStore(raw, roomId) {
  if (!raw || raw.roomId !== roomId) return null;
  if (raw.version === SESSION_VERSION && Array.isArray(raw.saves)) {
    return raw;
  }
  if (raw.version === 1 && Array.isArray(raw.tiles)) {
    return {
      version: SESSION_VERSION,
      roomId: raw.roomId,
      roomName: raw.roomName || null,
      saves: [{
        id: createSaveId(),
        name: t('mods.mapEditor.defaultSaveName', 'Untitled'),
        savedAt: raw.savedAt || new Date().toISOString(),
        selectedTileIndex: raw.selectedTileIndex ?? null,
        tiles: raw.tiles
      }]
    };
  }
  return null;
}

function getMapSessionStore(roomId) {
  const key = getMapSessionStorageKey(roomId);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return normalizeSessionStore(JSON.parse(raw), roomId);
  } catch (e) {
    return null;
  }
}

function writeMapSessionStore(store) {
  if (!store?.roomId) return false;
  const key = getMapSessionStorageKey(store.roomId);
  try {
    localStorage.setItem(key, JSON.stringify(store));
    return true;
  } catch (e) {
    return false;
  }
}

function getMapSession(roomId, saveId = null) {
  const store = getMapSessionStore(roomId);
  if (!store?.saves?.length) return null;
  if (saveId) return store.saves.find((save) => save.id === saveId) || null;
  return store.saves[0];
}

function hasMapSession(roomId) {
  return (getMapSessionStore(roomId)?.saves?.length || 0) > 0;
}

function saveMapSession() {
  const room = getCurrentRoom();
  if (!room?.id) {
    setStatusMessage(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), true);
    return false;
  }

  const payload = buildMapSessionSave();
  if (!payload) {
    setStatusMessage(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), true);
    return false;
  }

  const nameInput = editorState.inspectorRoot?.querySelector('#map-editor-save-name');
  const saveName = sanitizeSaveName(nameInput?.value);
  const store = getMapSessionStore(room.id) || {
    version: SESSION_VERSION,
    roomId: room.id,
    roomName: payload.roomName,
    saves: []
  };

  const existing = store.saves.find((save) => save.name.toLowerCase() === saveName.toLowerCase());
  const saveEntry = {
    id: existing?.id || createSaveId(),
    name: saveName,
    savedAt: payload.savedAt,
    selectedTileIndex: payload.selectedTileIndex,
    tiles: payload.tiles
  };

  if (existing) {
    Object.assign(existing, saveEntry);
  } else {
    store.saves.unshift(saveEntry);
  }

  store.roomName = payload.roomName;
  store.saves.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  if (!writeMapSessionStore(store)) {
    setStatusMessage(t('mods.mapEditor.saveFailed', 'Save failed — storage may be full.'), true);
    return false;
  }

  editorState.selectedSaveId = saveEntry.id;
  if (nameInput) nameInput.value = saveName;
  updateSessionControls();

  const tileLabel = payload.tiles.length === 1 ? 'tile' : 'tiles';
  const message = payload.tiles.length
    ? t('mods.mapEditor.saveSuccess', 'Saved "{name}" on {map} ({count} changed {tileLabel}).')
        .replace('{name}', saveName)
        .replace('{map}', payload.roomName)
        .replace('{count}', String(payload.tiles.length))
        .replace('{tileLabel}', tileLabel)
    : t('mods.mapEditor.saveEmpty', 'Saved "{name}" on {map} (no tile changes yet).')
        .replace('{name}', saveName)
        .replace('{map}', payload.roomName);
  setStatusMessage(message);
  logMapEditor('saveSession', { roomId: room.id, saveId: saveEntry.id, name: saveName, tileCount: payload.tiles.length });
  return true;
}

function applyTileSessionEntry(tileState) {
  const tileEl = getTileElement(tileState.tileIndex);
  if (!tileEl) return false;

  const pickOverlay = tileEl.querySelector(`.${PICK_OVERLAY_CLASS}`);
  getAllSpritesOnTile(tileEl).forEach((sprite) => sprite.remove());

  const sessionSprites = tileState.sprites || [];
  sessionSprites.forEach((spriteState, spriteIndex) => {
    const { hidden, ...config } = spriteState;
    const sprite = buildSpriteElementFromConfig(config);
    if (!sprite) return;
    if (pickOverlay) tileEl.insertBefore(sprite, pickOverlay);
    else tileEl.appendChild(sprite);
    if (hidden) {
      hideSpriteElement(sprite, tileState.tileIndex);
    } else if (isLikelyAddedSprite(config, tileState.tileIndex, sessionSprites, spriteIndex)) {
      sprite.setAttribute(EDITOR_ADDED_ATTR, '1');
      trackAddedSprite(tileState.tileIndex, sprite);
    }
  });

  return true;
}

function applyMapSessionSave(session, room) {
  if (!session?.tiles || !Array.isArray(session.tiles)) return false;

  const currentRoom = room || getCurrentRoom();
  if (!currentRoom || currentRoom.id !== session.roomId) {
    setStatusMessage(t('mods.mapEditor.loadMismatch', 'Saved data does not match the current map.'), true);
    return false;
  }

  resetEditorEdits();

  let applied = 0;
  session.tiles.forEach((tileState) => {
    if (applyTileSessionEntry(tileState)) applied += 1;
  });

  if (session.selectedTileIndex != null && getTileElement(session.selectedTileIndex)) {
    editorState.selectedTileIndex = session.selectedTileIndex;
    markTileSelected(session.selectedTileIndex);
  } else {
    editorState.selectedTileIndex = null;
    clearTileSelection();
  }

  if (editorState.open) {
    refreshTilePickOverlays();
    if (editorState.hitboxOverlay) updateHitboxOverlay();
  }

  refreshInspector();
  updateSessionControls();

  const savedAt = session.savedAt
    ? new Date(session.savedAt).toLocaleString()
    : t('mods.mapEditor.unknownTime', 'unknown time');
  const saveLabel = session.name || t('mods.mapEditor.defaultSaveName', 'Untitled');
  setStatusMessage(
    t('mods.mapEditor.loadSuccess', 'Loaded "{name}" on {map} ({count} tiles, saved {savedAt}).')
      .replace('{name}', saveLabel)
      .replace('{map}', session.roomName || currentRoom.id)
      .replace('{count}', String(applied))
      .replace('{savedAt}', savedAt)
  );
  logMapEditor('loadSession', { roomId: session.roomId, saveId: session.id, name: saveLabel, applied });
  return true;
}

function loadMapSession() {
  const room = getCurrentRoom();
  if (!room?.id) {
    setStatusMessage(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), true);
    return false;
  }

  const store = getMapSessionStore(room.id);
  if (!store?.saves?.length) {
    setStatusMessage(t('mods.mapEditor.noSave', 'No saved progress for this map.'), true);
    return false;
  }

  const saveId = editorState.selectedSaveId || store.saves[0]?.id;
  const save = store.saves.find((entry) => entry.id === saveId);
  if (!save) {
    setStatusMessage(t('mods.mapEditor.noSaveSelected', 'Select a save to load.'), true);
    return false;
  }

  editorState.selectedSaveId = save.id;
  return applyMapSessionSave({
    ...save,
    roomId: room.id,
    roomName: store.roomName || getRoomDisplayName(room)
  }, room);
}

function clearMapSession(roomId, saveId = null) {
  const store = getMapSessionStore(roomId);
  if (!store?.saves?.length) return;

  if (saveId) {
    store.saves = store.saves.filter((save) => save.id !== saveId);
    if (editorState.selectedSaveId === saveId) {
      editorState.selectedSaveId = store.saves[0]?.id || null;
    }
    if (store.saves.length) {
      writeMapSessionStore(store);
    } else {
      try {
        localStorage.removeItem(getMapSessionStorageKey(roomId));
      } catch (e) {}
      editorState.selectedSaveId = null;
    }
  } else {
    try {
      localStorage.removeItem(getMapSessionStorageKey(roomId));
    } catch (e) {}
    editorState.selectedSaveId = null;
  }
  updateSessionControls();
}

function reloadRoomFromGame(roomId, floor, options = {}) {
  const { showStatus = false, reason = 'unknown' } = options;

  if (!roomId || !globalThis.state?.board?.send) return false;

  const bounceRoomId = findBounceRoomId(roomId);
  revertAllEditorEdits();

  scopeHandlingSuspended = true;
  if (boardToolsRefreshTimer) {
    clearTimeout(boardToolsRefreshTimer);
    boardToolsRefreshTimer = null;
  }

  if (showStatus) {
    setStatusMessage(t('mods.mapEditor.restoreMapPending', 'Restoring map…'));
  }

  const finishReload = () => {
    setBoardFloor(floor);
    boardToolsRefreshTimer = setTimeout(() => {
      scopeHandlingSuspended = false;
      trackedBoardKey = getBoardRoomKey();
      resetEditorEdits();
      removeOrphanedEditorAddedSprites();

      if (editorState.open) {
        enableMapEditorBoardTools();
        refreshInspector();
      }

      if (showStatus) {
        const room = getCurrentRoom();
        setStatusMessage(
          t('mods.mapEditor.restoreMapOk', 'Map restored — reloaded {map} from game data.')
            .replace('{map}', getRoomDisplayName(room))
        );
      }

      logMapEditor('reloadRoomFromGame', { roomId, floor, bounced: !!bounceRoomId, reason });
    }, ROOM_RELOAD_SETTLE_MS);
  };

  try {
    if (bounceRoomId) {
      logMapEditor('reloadRoomBounce', { target: roomId, bounce: bounceRoomId, reason });
      navigateToRoomById(bounceRoomId);
      setTimeout(() => {
        navigateToRoomById(roomId);
        setTimeout(finishReload, ROOM_RELOAD_BOUNCE_MS);
      }, ROOM_RELOAD_BOUNCE_MS);
      return true;
    }

    navigateToRoomById(roomId);
    setTimeout(finishReload, ROOM_RELOAD_SETTLE_MS);
    return true;
  } catch (e) {
    scopeHandlingSuspended = false;
    logMapEditor('reloadRoomFailed', { roomId, floor, error: String(e), reason });
    if (showStatus) {
      setStatusMessage(t('mods.mapEditor.restoreMapFail', 'Could not restore map.'), true);
    }
    return false;
  }
}

function restoreMapFromGame() {
  const room = getCurrentRoom();
  if (!room?.id) {
    setStatusMessage(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), true);
    return false;
  }

  editorState.editingSprite = null;
  editorState.selectedTileIndex = null;
  clearTileSelection();

  return reloadRoomFromGame(room.id, getBoardFloor(), {
    showStatus: true,
    reason: 'manual-restore'
  });
}

function refreshSaveList() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  const room = getCurrentRoom();
  const list = root.querySelector('#map-editor-save-list');
  const nameInput = root.querySelector('#map-editor-save-name');
  if (!list) return;

  list.replaceChildren();
  const store = room?.id ? getMapSessionStore(room.id) : null;
  const saves = store?.saves || [];

  if (!saves.length) {
    list.hidden = true;
    if (nameInput && !nameInput.value.trim()) {
      nameInput.placeholder = t('mods.mapEditor.saveNamePlaceholder', 'Save name…');
    }
    return;
  }

  list.hidden = false;

  if (!editorState.selectedSaveId || !saves.some((save) => save.id === editorState.selectedSaveId)) {
    editorState.selectedSaveId = saves[0].id;
  }

  const selected = saves.find((save) => save.id === editorState.selectedSaveId);
  if (nameInput && selected && document.activeElement !== nameInput) {
    nameInput.value = selected.name;
  }

  saves.forEach((save) => {
    const tileLabel = save.tiles?.length === 1 ? 'tile' : 'tiles';
    const tileCount = save.tiles?.length || 0;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'me-save-item' + (save.id === editorState.selectedSaveId ? ' active' : '');
    btn.title = t('mods.mapEditor.loadSaveTooltip', 'Load "{name}"').replace('{name}', save.name);
    btn.textContent = t('mods.mapEditor.saveListEntry', '{name} · {time} · {count} {tileLabel}')
      .replace('{name}', save.name)
      .replace('{time}', new Date(save.savedAt).toLocaleString())
      .replace('{count}', String(tileCount))
      .replace('{tileLabel}', tileLabel);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      editorState.selectedSaveId = save.id;
      if (nameInput) nameInput.value = save.name;
      refreshSaveList();
      updateSessionControls();
    });
    btn.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      editorState.selectedSaveId = save.id;
      loadMapSession();
    });
    list.appendChild(btn);
  });
}

function updateSessionControls() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  const room = getCurrentRoom();
  const sessionRow = root.querySelector('#map-editor-session-row');
  const nameRow = root.querySelector('#map-editor-save-name-row');
  const loadBtn = root.querySelector('#map-editor-load-btn');
  const clearBtn = root.querySelector('#map-editor-clear-save-btn');
  const sessionHint = root.querySelector('#map-editor-session-hint');

  const hasRoom = !!room?.id;
  if (sessionRow) sessionRow.style.display = hasRoom ? '' : 'none';
  if (nameRow) nameRow.style.display = hasRoom ? '' : 'none';

  const store = hasRoom ? getMapSessionStore(room.id) : null;
  const saves = store?.saves || [];
  const selected = saves.find((save) => save.id === editorState.selectedSaveId) || saves[0] || null;

  if (loadBtn) {
    loadBtn.style.display = selected ? '' : 'none';
    loadBtn.title = selected?.savedAt
      ? t('mods.mapEditor.loadTooltip', 'Load "{name}" from {time}')
          .replace('{name}', selected.name)
          .replace('{time}', new Date(selected.savedAt).toLocaleString())
      : t('mods.mapEditor.load', 'Load');
  }
  if (clearBtn) {
    clearBtn.style.display = saves.length ? '' : 'none';
    clearBtn.textContent = selected
      ? t('mods.mapEditor.clearSaveNamed', 'Delete save')
      : t('mods.mapEditor.clearSave', 'Clear saves');
  }
  if (sessionHint) {
    if (!selected?.savedAt) {
      sessionHint.textContent = saves.length
        ? t('mods.mapEditor.saveListHint', 'Click a save to select it. Double-click to load.')
        : t('mods.mapEditor.saveNameHint', 'Name your save, then click Save.');
    } else {
      sessionHint.textContent = t('mods.mapEditor.savedAtNamed', 'Selected: {name} · {time}')
        .replace('{name}', selected.name)
        .replace('{time}', new Date(selected.savedAt).toLocaleString());
    }
  }

  refreshSaveList();
}

function buildWholeMapExport() {
  const room = getCurrentRoom();
  if (!room) return null;

  const sourceData = room.file?.data || {};
  const tileCount = getMapTileCount();
  const { tiles, templates, populatedCount, actorCount, templateCount } = buildTileBasedMapData(sourceData, tileCount);

  const data = {
    tileCount,
    tiles
  };
  if (templateCount > 0) data.templates = templates;

  const exportPayload = {
    format: 'map-editor-v2',
    id: room.id || null,
    roomName: getRoomDisplayName(room),
    file: {
      name: room.file?.name || null,
      data
    },
    exportedAt: new Date().toISOString(),
    stats: {
      populatedTiles: populatedCount,
      actorTiles: actorCount,
      templates: templateCount
    }
  };

  if (room.difficulty != null) exportPayload.difficulty = room.difficulty;
  if (room.maxTeamSize != null) exportPayload.maxTeamSize = room.maxTeamSize;
  if (room.staminaCost != null) exportPayload.staminaCost = room.staminaCost;

  const rules = buildSceneReplacementRules();
  if (rules.length) {
    exportPayload.sceneSpriteReplacements = {
      rootId: 'background-scene',
      rules
    };
  }

  return exportPayload;
}

function buildSceneReplacementRules() {
  const rules = [];
  const room = getCurrentRoom();
  const originalTiles = room?.file?.data?.tiles;
  if (!Array.isArray(originalTiles)) return rules;

  for (let tileIndex = 0; tileIndex < originalTiles.length; tileIndex++) {
    const tileEl = getTileElement(tileIndex);
    if (!tileEl) continue;
    const liveIds = getSpritesOnTile(tileEl).flatMap((sprite) => getSpriteIdsFromElement(sprite));
    const originalLayer = originalTiles[tileIndex];
    const originalIds = Array.isArray(originalLayer)
      ? originalLayer.map((item) => item?.id).filter((id) => id != null)
      : [];

    for (const fromId of originalIds) {
      if (!liveIds.includes(fromId)) continue;
      const toId = liveIds.find((id) => id !== fromId && !originalIds.includes(id));
      if (toId != null) {
        rules.push({ sourceIds: [fromId], replacementId: toId, scope: 'tile' });
      }
    }
  }
  return rules;
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.warn('[Map Editor] Clipboard write failed:', e);
    return false;
  }
}

function setStatusMessage(message, isError) {
  const status = editorState.inspectorRoot?.querySelector('#map-editor-status');
  if (!status) return;
  status.textContent = message || '';
  status.style.color = isError ? '#E06C75' : '#888';
}

function switchInspectorTab(tabId) {
  if (!tabId) return;
  editorState.activeTab = tabId;
  savePanelSettings({ activeTab: tabId });

  const root = editorState.inspectorRoot;
  const panel = document.getElementById(PANEL_ID);
  if (!root && !panel) return;

  root?.querySelectorAll('.me-tab-panel').forEach((panelEl) => {
    panelEl.hidden = panelEl.dataset.tabPanel !== tabId;
  });
  panel?.querySelectorAll('.me-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  if (tabId === 'assets') refreshAssetList();
  if (tabId === 'edit') refreshEditTab();
}

function buildTabBar() {
  const tabBar = document.createElement('div');
  tabBar.className = 'me-tab-bar';
  tabBar.append(
    createTabButton('edit', t('mods.mapEditor.tabEdit', 'Edit tiles')),
    createTabButton('assets', t('mods.mapEditor.tabAssets', 'Asset list')),
    createTabButton('options', t('mods.mapEditor.tabOptions', 'Options'))
  );
  return tabBar;
}

let allRoomsAssetsCache = null;

function getConfiguredAssetsFromAllRooms() {
  const rooms = getAllGameRooms();
  if (allRoomsAssetsCache && allRoomsAssetsCache.roomCount === rooms.length) {
    return allRoomsAssetsCache.byId;
  }

  const byId = new Map();
  const addEntry = (entry, room) => {
    if (!entry?.id || !room) return;
    const roomLabel = getRoomDisplayName(room);
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, {
        ...entry,
        usageCount: 1,
        roomLabels: new Set([roomLabel])
      });
      return;
    }
    existing.usageCount += 1;
    existing.roomLabels.add(roomLabel);
    if (formatSpriteConfigHint(entry) && !formatSpriteConfigHint(existing)) {
      const { usageCount, roomLabels } = existing;
      Object.assign(existing, entry, { usageCount, roomLabels });
    }
  };

  if (rooms.length) {
    rooms.forEach((room) => {
      const tiles = room?.file?.data?.tiles;
      if (!Array.isArray(tiles)) return;
      tiles.forEach((layer) => {
        if (!Array.isArray(layer)) return;
        layer.forEach((entry) => addEntry(entry, room));
      });
    });
  } else {
    const room = getCurrentRoom();
    const tiles = room?.file?.data?.tiles;
    if (room && Array.isArray(tiles)) {
      tiles.forEach((layer) => {
        if (!Array.isArray(layer)) return;
        layer.forEach((entry) => addEntry(entry, room));
      });
    }
  }

  allRoomsAssetsCache = {
    byId,
    roomCount: rooms.length,
    list: Array.from(byId.values())
      .map(({ roomLabels, ...asset }) => {
        const hint = formatSpriteConfigHint(asset);
        const labels = roomLabels ? Array.from(roomLabels) : [];
        return {
          ...asset,
          mapCount: roomLabels?.size || 0,
          searchLabels: labels,
          searchBlob: [String(asset.id), hint, ...labels].join(' ').toLowerCase()
        };
      })
      .sort((a, b) => a.id - b.id)
  };
  return byId;
}

function collectMapTileAssets() {
  getConfiguredAssetsFromAllRooms();
  return allRoomsAssetsCache?.list || [];
}

function filterAssetList(assets, filter) {
  const query = String(filter || '').trim().toLowerCase();
  if (!query) return assets;
  return assets.filter((asset) => asset.searchBlob?.includes(query) || String(asset.id).includes(query));
}

function buildAssetListDisplay(filtered, grandTotal, filter, visibleCount) {
  const shown = Math.min(visibleCount, filtered.length);
  const hasFilter = !!String(filter || '').trim();
  return {
    items: filtered.slice(0, shown),
    shownCount: shown,
    total: filtered.length,
    capped: filtered.length > shown,
    hasFilter,
    grandTotal
  };
}

function selectAssetsForDisplay(assets, filter, visibleCount = ASSET_LIST_PAGE_SIZE) {
  const filtered = filterAssetList(assets, filter);
  return buildAssetListDisplay(filtered, assets.length, filter, visibleCount);
}

function cancelAssetListRender() {
  assetListLoadId += 1;
  assetListLoadingMore = false;
  if (assetListRenderRaf != null) {
    cancelAnimationFrame(assetListRenderRaf);
    assetListRenderRaf = null;
  }
  if (assetPreviewObserver) {
    assetPreviewObserver.disconnect();
    assetPreviewObserver = null;
  }
  if (assetListLoadMoreObserver) {
    assetListLoadMoreObserver.disconnect();
    assetListLoadMoreObserver = null;
  }
}

function ensureAssetListLoadMoreObserver() {
  if (assetListLoadMoreObserver) return assetListLoadMoreObserver;
  const body = document.getElementById(BODY_ID);
  assetListLoadMoreObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadMoreAssetList();
    });
  }, { root: body, rootMargin: '200px' });
  return assetListLoadMoreObserver;
}

function removeAssetListSentinel(grid) {
  const sentinel = grid?.querySelector('.me-asset-load-sentinel');
  if (!sentinel) return;
  assetListLoadMoreObserver?.unobserve(sentinel);
  sentinel.remove();
}

function updateAssetListSentinel(grid, hasMore) {
  removeAssetListSentinel(grid);
  if (!hasMore || !grid) return;
  const sentinel = document.createElement('div');
  sentinel.className = 'me-asset-load-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  grid.appendChild(sentinel);
  ensureAssetListLoadMoreObserver().observe(sentinel);
}

function hydrateAssetCardPreview(preview, asset) {
  if (!preview || preview.dataset.hydrated === '1' || !asset?.id) return;
  preview.dataset.hydrated = '1';
  preview.classList.remove('me-sprite-preview-id', 'me-sprite-preview-pending');
  preview.textContent = '';

  const reference = findSpriteReference(asset.id, asset);
  const spriteNode = reference
    ? normalizeSpritePreviewNode(reference)
    : buildSpriteElementFromConfig(asset);
  if (!spriteNode) {
    preview.classList.add('me-sprite-preview-empty');
    preview.textContent = '?';
    return;
  }

  hydrateSpritePreviewVisual(spriteNode, asset, reference);
  preview.appendChild(spriteNode);
}

function ensureAssetPreviewObserver() {
  if (assetPreviewObserver) return assetPreviewObserver;
  assetPreviewObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const preview = entry.target;
      assetPreviewObserver.unobserve(preview);
      hydrateAssetCardPreview(preview, preview.__assetRef);
    });
  }, { rootMargin: '64px' });
  return assetPreviewObserver;
}

function queueAssetCardPreview(preview, asset) {
  preview.__assetRef = asset;
  ensureAssetPreviewObserver().observe(preview);
}

function hydrateVisibleAssetPreviews() {
  const grid = editorState.inspectorRoot?.querySelector('#map-editor-asset-grid');
  if (!grid || grid.classList.contains('is-loading')) return;
  grid.querySelectorAll('.me-sprite-preview-pending').forEach((preview) => {
    const rect = preview.getBoundingClientRect();
    if (!rect.width && !rect.height) return;
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    hydrateAssetCardPreview(preview, preview.__assetRef);
  });
}

function cancelAssetListWork() {
  cancelAssetListRender();
  if (assetListSearchTimer != null) {
    clearTimeout(assetListSearchTimer);
    assetListSearchTimer = null;
  }
}

function showAssetListSkeleton(grid) {
  grid.replaceChildren();
  grid.classList.add('is-loading');
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < ASSET_LIST_SKELETON_COUNT; i += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = 'me-asset-card me-asset-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    fragment.appendChild(skeleton);
  }
  grid.appendChild(fragment);
}

function updateAssetListSummary(summary, display, allRooms, room, loading) {
  if (!summary) return;
  if (loading) {
    summary.textContent = t('mods.mapEditor.assetsLoading', 'Loading asset index…');
    return;
  }

  const shown = display.shownCount ?? display.items.length;
  if (display.capped) {
    summary.textContent = display.hasFilter
      ? t('mods.mapEditor.assetsSummaryFiltered', 'Showing {shown} of {total} matches — scroll for more')
          .replace('{shown}', String(shown))
          .replace('{total}', String(display.total))
      : t('mods.mapEditor.assetsSummaryCapped', 'Showing {shown} of {total} assets — scroll for more')
          .replace('{shown}', String(shown))
          .replace('{total}', String(display.grandTotal));
    return;
  }

  if (allRooms.length) {
    summary.textContent = t('mods.mapEditor.assetsSummaryAll', '{count} unique assets from {maps} maps')
      .replace('{count}', String(display.hasFilter ? display.total : display.grandTotal))
      .replace('{maps}', String(allRooms.length));
    return;
  }

  if (room) {
    summary.textContent = t('mods.mapEditor.assetsSummary', '{count} assets on {map}')
      .replace('{count}', String(display.total))
      .replace('{map}', getRoomDisplayName(room));
    return;
  }

  summary.textContent = t('mods.mapEditor.assetsUnavailable', 'Map data not loaded yet — open any map first.');
}

function formatAssetUsageLine(asset) {
  if (asset.mapCount > 1) {
    return t('mods.mapEditor.assetUsedOnMaps', 'Used {count}× on {maps} maps')
      .replace('{count}', String(asset.usageCount))
      .replace('{maps}', String(asset.mapCount));
  }
  if (asset.usageCount > 1) {
    return t('mods.mapEditor.assetUsedTimes', 'Used {count}×').replace('{count}', String(asset.usageCount));
  }
  return t('mods.mapEditor.assetUsedOnce', 'Used 1×');
}

function createAssetCard(asset) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'me-asset-card';
  card.title = t('mods.mapEditor.assetUse', 'Use sprite {id}').replace('{id}', String(asset.id));

  const preview = document.createElement('div');
  preview.className = 'me-sprite-preview me-sprite-preview-pending';
  preview.textContent = String(asset.id);
  queueAssetCardPreview(preview, asset);
  card.appendChild(preview);

  const meta = document.createElement('div');
  meta.className = 'me-asset-meta';

  const idLine = document.createElement('div');
  idLine.className = 'me-asset-id';
  idLine.textContent = `#${asset.id}`;

  const usageLine = document.createElement('div');
  usageLine.className = 'me-asset-usage';
  usageLine.textContent = formatAssetUsageLine(asset);

  const hint = formatSpriteConfigHint(asset);
  if (hint) {
    const hintLine = document.createElement('div');
    hintLine.className = 'me-asset-hint';
    hintLine.textContent = hint;
    meta.append(idLine, usageLine, hintLine);
  } else {
    meta.append(idLine, usageLine);
  }

  card.appendChild(meta);
  card.addEventListener('click', (e) => {
    e.stopPropagation();
    applyAssetToSelection(asset);
  });
  return card;
}

function appendAssetCardFragment(grid, fragment) {
  const sentinel = grid.querySelector('.me-asset-load-sentinel');
  if (sentinel) grid.insertBefore(fragment, sentinel);
  else grid.appendChild(fragment);
}

function renderAssetCardsChunked(grid, assets, loadId, options = {}) {
  const { allRooms, room, filter, display, append = false, onComplete } = options;
  grid.classList.remove('is-loading');
  if (!append) {
    grid.replaceChildren();
    delete grid.dataset.renderedCount;
  }

  if (!assets.length && !append) {
    const empty = document.createElement('div');
    empty.className = 'me-muted me-asset-empty';
    empty.textContent = filter
      ? t('mods.mapEditor.assetsNoMatch', 'No assets match your search.')
      : allRooms.length || room
        ? t('mods.mapEditor.assetsEmpty', 'No tile assets found.')
        : t('mods.mapEditor.assetsUnavailable', 'Map data not loaded yet — open any map first.');
    grid.appendChild(empty);
    onComplete?.();
    return;
  }

  if (!assets.length) {
    onComplete?.();
    return;
  }

  let index = 0;
  const finish = () => {
    assetListRenderRaf = null;
    requestAnimationFrame(() => hydrateVisibleAssetPreviews());
    onComplete?.();
  };

  const renderChunk = () => {
    if (loadId !== assetListLoadId) return;

    const fragment = document.createDocumentFragment();
    const end = Math.min(index + ASSET_LIST_CHUNK_SIZE, assets.length);
    for (; index < end; index += 1) {
      fragment.appendChild(createAssetCard(assets[index]));
    }
    appendAssetCardFragment(grid, fragment);
    requestAnimationFrame(() => hydrateVisibleAssetPreviews());

    if (index < assets.length) {
      assetListRenderRaf = requestAnimationFrame(renderChunk);
    } else {
      finish();
    }
  };

  assetListRenderRaf = requestAnimationFrame(renderChunk);
}

function loadMoreAssetList() {
  if (assetListLoadingMore || !assetListFilteredCache) return;

  const root = editorState.inspectorRoot;
  const grid = root?.querySelector('#map-editor-asset-grid');
  const summary = root?.querySelector('#map-editor-asset-summary');
  if (!grid || grid.classList.contains('is-loading')) return;

  const currentCount = Number(grid.dataset.renderedCount || 0);
  const { filtered, grandTotal, filter } = assetListFilteredCache;
  if (currentCount >= filtered.length) {
    removeAssetListSentinel(grid);
    return;
  }

  const nextCount = Math.min(currentCount + ASSET_LIST_PAGE_SIZE, filtered.length);
  const newItems = filtered.slice(currentCount, nextCount);
  if (!newItems.length) return;

  assetListLoadingMore = true;
  const loadId = assetListLoadId;
  const allRooms = getAllGameRooms();
  const room = getCurrentRoom();

  renderAssetCardsChunked(grid, newItems, loadId, {
    append: true,
    onComplete: () => {
      if (loadId !== assetListLoadId) return;
      assetListLoadingMore = false;
      grid.dataset.renderedCount = String(nextCount);
      const display = buildAssetListDisplay(filtered, grandTotal, filter, nextCount);
      updateAssetListSummary(summary, display, allRooms, room, false);
      updateAssetListSentinel(grid, nextCount < filtered.length);
    }
  });
}

function scheduleAssetListRefresh() {
  if (assetListSearchTimer != null) {
    clearTimeout(assetListSearchTimer);
    assetListSearchTimer = null;
  }

  const root = editorState.inspectorRoot;
  const grid = root?.querySelector('#map-editor-asset-grid');
  const summary = root?.querySelector('#map-editor-asset-summary');
  cancelAssetListRender();
  if (grid) showAssetListSkeleton(grid);
  if (summary) {
    updateAssetListSummary(
      summary,
      { items: [], total: 0, capped: false, hasFilter: false, grandTotal: 0 },
      getAllGameRooms(),
      getCurrentRoom(),
      true
    );
  }

  assetListSearchTimer = setTimeout(() => {
    assetListSearchTimer = null;
    refreshAssetList();
  }, ASSET_LIST_SEARCH_DEBOUNCE_MS);
}

function applyAssetToSelection(asset) {
  if (!asset?.id) return;
  const tileIndex = editorState.selectedTileIndex;
  if (tileIndex != null) {
    const ok = addSpriteToTile(getTileElement(tileIndex), asset.id, tileIndex, asset);
    setStatusMessage(
      ok
        ? t('mods.mapEditor.assetAdded', 'Added sprite {id} to tile {tile}.')
            .replace('{id}', String(asset.id))
            .replace('{tile}', String(tileIndex))
        : t('mods.mapEditor.assetAddFailed', 'Could not add sprite {id}.')
            .replace('{id}', String(asset.id)),
      !ok
    );
    refreshInspector();
    switchInspectorTab('edit');
    return;
  }

  const addInput = editorState.inspectorRoot?.querySelector('#map-editor-add-input');
  if (addInput) addInput.value = String(asset.id);
  setStatusMessage(
    t('mods.mapEditor.assetSelected', 'Sprite {id} ready — select a tile on Edit, then Add sprite.')
      .replace('{id}', String(asset.id))
  );
  switchInspectorTab('edit');
}

function refreshAssetList() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  const grid = root.querySelector('#map-editor-asset-grid');
  const summary = root.querySelector('#map-editor-asset-summary');
  if (!grid) return;

  cancelAssetListWork();
  const loadId = assetListLoadId;
  const filter = editorState.assetFilter;
  const allRooms = getAllGameRooms();
  const room = getCurrentRoom();

  showAssetListSkeleton(grid);
  updateAssetListSummary(summary, { items: [], total: 0, capped: false, hasFilter: false, grandTotal: 0 }, allRooms, room, true);

  setTimeout(() => {
    if (loadId !== assetListLoadId) return;

    const allAssets = collectMapTileAssets();
    if (loadId !== assetListLoadId) return;

    const filterText = String(filter || '').trim();
    const filtered = filterAssetList(allAssets, filterText);
    assetListFilteredCache = { filter: filterText, filtered, grandTotal: allAssets.length };
    assetListLoadingMore = false;

    const display = buildAssetListDisplay(filtered, allAssets.length, filterText, ASSET_LIST_PAGE_SIZE);
    updateAssetListSummary(summary, display, allRooms, room, false);
    renderAssetCardsChunked(grid, display.items, loadId, {
      allRooms,
      room,
      filter: filterText,
      display,
      onComplete: () => {
        if (loadId !== assetListLoadId) return;
        grid.dataset.renderedCount = String(display.items.length);
        updateAssetListSentinel(grid, display.capped);
      }
    });
  }, 0);
}

function refreshEditTab() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  const room = getCurrentRoom();
  const contextPrimary = root.querySelector('#map-editor-context-primary');
  const contextSecondary = root.querySelector('#map-editor-context-secondary');
  const tilePreview = root.querySelector('#map-editor-tile-preview');
  const spriteList = root.querySelector('#map-editor-sprite-list');

  const tileIndex = editorState.selectedTileIndex;
  const configuredLayer = tileIndex == null ? null : getConfiguredTileLayer(tileIndex);
  const hitboxes = getHitboxes();

  if (contextPrimary) {
    if (!room) {
      contextPrimary.textContent = 'No room loaded';
    } else if (tileIndex == null) {
      contextPrimary.textContent = `${room.id || 'no-id'} · ${getRoomDisplayName(room)}`;
    } else {
      contextPrimary.textContent = `${room.id || 'no-id'} · ${getRoomDisplayName(room)} · Tile ${tileIndex}`;
    }
  }

  if (contextSecondary) {
    const parts = [];
    if (!room) {
      parts.push('Open a map in the game first.');
    } else if (tileIndex == null) {
      parts.push('Click a battlefield tile.');
    } else if (hitboxes) {
      const hitbox = hitboxes[tileIndex] === true ? 'blocked' : hitboxes[tileIndex] === false ? 'walkable' : 'unknown hitbox';
      parts.push(hitbox);
    }
    if (tileIndex != null && configuredLayer?.length) {
      const summary = configuredLayer.map((entry) => {
        if (!entry?.id) return '?';
        const hint = formatSpriteConfigHint(entry);
        return hint ? `${entry.id} (${hint})` : String(entry.id);
      }).join(', ');
      parts.push(`config: ${summary}`);
    } else if (tileIndex != null) {
      parts.push('config: (empty)');
    }
    if (!tileIndex) {
      parts.push('Live edits only — Export for JSON.');
    }
    contextSecondary.textContent = parts.join(' · ');
  }

  if (spriteList) {
    spriteList.textContent = '';
    const tileEl = tileIndex == null ? null : getTileElement(tileIndex);
    const sprites = tileEl ? getAllSpritesOnTile(tileEl) : [];
    refreshTilePreview(tilePreview, tileEl, sprites, configuredLayer);
    if (tileIndex == null) {
      const empty = document.createElement('div');
      empty.className = 'me-muted me-sprite-empty';
      empty.textContent = t('mods.mapEditor.selectTile', 'Select a battlefield tile to edit sprites.');
      spriteList.appendChild(empty);
      return;
    }
    const appendSpriteRow = (sprite, index, configEntry, options = {}) => {
      const { configOnly = false, hidden = false } = options;
      const ids = sprite ? getSpriteIdsFromElement(sprite) : [];
      const isAdded = sprite ? isEditorAddedSprite(sprite) : false;
      const row = document.createElement('div');
      row.className = 'me-sprite-row';
      if (hidden) row.classList.add('me-sprite-row-hidden');
      if (isAdded) row.classList.add('me-sprite-row-added');
      if (configOnly) row.classList.add('me-sprite-row-config-only');

      row.appendChild(createSpritePreviewBox(sprite, configEntry));

      const meta = document.createElement('span');
      meta.className = 'me-sprite-meta';

      const layerSpan = document.createElement('span');
      layerSpan.className = 'me-sprite-layer';
      layerSpan.textContent = `#${index + 1}`;

      const idSpan = document.createElement('span');
      idSpan.className = 'me-sprite-id';
      const liveId = ids[0];
      const configId = configEntry?.id;
      if (configOnly) {
        idSpan.textContent = `ID ${configId} (config)`;
      } else if (liveId != null) {
        idSpan.textContent = configId != null && configId !== liveId
          ? `ID ${liveId} (cfg ${configId})`
          : `ID ${liveId}`;
      } else if (configId != null) {
        idSpan.textContent = `ID ${configId} (config)`;
      } else {
        idSpan.textContent = 'ID ?';
      }

      meta.append(layerSpan, idSpan);

      const configHint = formatSpriteConfigHint(configEntry);
      if (configHint) {
        const hintSpan = document.createElement('span');
        hintSpan.className = 'me-sprite-hint';
        hintSpan.textContent = configHint;
        meta.appendChild(hintSpan);
      }

      if (hidden) {
        const hiddenSpan = document.createElement('span');
        hiddenSpan.className = 'me-sprite-hidden-tag';
        hiddenSpan.textContent = 'hidden';
        meta.appendChild(hiddenSpan);
      }

      if (isAdded) {
        const addedSpan = document.createElement('span');
        addedSpan.className = 'me-sprite-added-tag';
        addedSpan.textContent = t('mods.mapEditor.addedTag', 'added');
        meta.appendChild(addedSpan);
      }

      row.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'me-sprite-actions';

      if (!configOnly && sprite && liveId != null) {
        const isEditing = editorState.editingSprite?.tileIndex === tileIndex
          && editorState.editingSprite?.fromId === liveId;

        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'me-btn me-btn-compact';
        editBtn.textContent = isEditing
          ? t('mods.mapEditor.editing', 'Editing')
          : t('mods.mapEditor.edit', 'Edit');
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (isEditing) {
            cancelSpriteEdit();
          } else {
            startSpriteEdit(tileIndex, liveId);
          }
        });
        actions.appendChild(editBtn);
      }

      if (!configOnly && sprite) {
        if (isAdded) {
          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'me-btn me-btn-compact me-btn-danger';
          removeBtn.textContent = t('mods.mapEditor.remove', 'Remove');
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ok = removeAddedSprite(sprite, tileIndex);
            setStatusMessage(
              ok
                ? t('mods.mapEditor.removeOk', 'Custom sprite removed.')
                : t('mods.mapEditor.removeFail', 'Could not remove sprite.'),
              !ok
            );
            refreshInspector();
          });
          actions.appendChild(removeBtn);
        } else {
          const actionBtn = document.createElement('button');
          actionBtn.type = 'button';
          actionBtn.className = 'me-btn me-btn-compact';
          actionBtn.textContent = hidden
            ? t('mods.mapEditor.restore', 'Restore')
            : t('mods.mapEditor.hide', 'Hide');
          actionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (hidden) {
              const ok = restoreSpriteElement(sprite);
              logMapEditor('restoreButtonClick', { tileIndex, spriteIds: ids, ok });
              setStatusMessage(
                ok ? t('mods.mapEditor.restoreOk', 'Sprite restored.') : t('mods.mapEditor.restoreFail', 'Could not restore sprite.'),
                !ok
              );
            } else {
              const ok = hideSpriteElement(sprite, tileIndex);
              logMapEditor('hideButtonClick', { tileIndex, spriteIds: ids, ok });
              setStatusMessage(
                ok ? t('mods.mapEditor.hideOk', 'Sprite hidden (visual only).') : t('mods.mapEditor.hideFail', 'Sprite already hidden.'),
                !ok
              );
            }
            refreshInspector();
          });
          actions.appendChild(actionBtn);
        }
      }

      if (actions.childElementCount) row.appendChild(actions);

      if (!configOnly && sprite && liveId != null
        && editorState.editingSprite?.tileIndex === tileIndex
        && editorState.editingSprite?.fromId === liveId) {
        const editRow = document.createElement('div');
        editRow.className = 'me-sprite-edit';

        const toInput = document.createElement('input');
        toInput.type = 'number';
        toInput.className = 'me-input me-input-wide';
        toInput.placeholder = t('mods.mapEditor.newSpriteId', 'New sprite ID');
        toInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applySpriteEdit(tileIndex, liveId, Number(toInput.value));
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancelSpriteEdit();
          }
        });

        const applyBtn = document.createElement('button');
        applyBtn.type = 'button';
        applyBtn.className = 'me-btn me-btn-compact';
        applyBtn.textContent = t('mods.mapEditor.apply', 'Apply');
        applyBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          applySpriteEdit(tileIndex, liveId, Number(toInput.value));
        });

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'me-btn me-btn-compact me-btn-muted';
        cancelBtn.textContent = t('mods.mapEditor.cancel', 'Cancel');
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          cancelSpriteEdit();
        });

        editRow.append(toInput, applyBtn, cancelBtn);
        row.appendChild(editRow);
        requestAnimationFrame(() => toInput.focus());
      }

      spriteList.appendChild(row);
    };

    sprites.forEach((sprite, index) => {
      appendSpriteRow(sprite, index, configuredLayer?.[index] || null, {
        hidden: isSpriteHidden(sprite)
      });
    });

    if (configuredLayer?.length > sprites.length) {
      for (let index = sprites.length; index < configuredLayer.length; index++) {
        const configEntry = configuredLayer[index];
        if (!configEntry?.id) continue;
        appendSpriteRow(null, index, configEntry, { configOnly: true });
      }
    }

    if (!sprites.length && !configuredLayer?.length) {
      const empty = document.createElement('div');
      empty.className = 'me-muted me-sprite-empty';
      empty.textContent = t('mods.mapEditor.noSprites', 'No sprites on this tile.');
      spriteList.appendChild(empty);
    }
  }
}

function refreshInspector() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  refreshEditTab();

  const hitboxToggle = root.querySelector('#map-editor-hitbox-toggle');
  if (hitboxToggle) hitboxToggle.checked = editorState.hitboxOverlay;

  updateSessionControls();
}

// =======================
// 10. Inspector UI
// =======================

function createTabButton(tabId, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'me-tab-btn';
  btn.dataset.tab = tabId;
  btn.textContent = label;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    switchInspectorTab(tabId);
  });
  return btn;
}

function buildInspectorContent() {
  const root = document.createElement('div');
  root.className = 'me-inspector';

  const tabPanels = document.createElement('div');
  tabPanels.className = 'me-tab-panels';

  const editPanel = document.createElement('div');
  editPanel.className = 'me-tab-panel';
  editPanel.dataset.tabPanel = 'edit';

  const contextCard = document.createElement('div');
  contextCard.className = 'me-context-card';

  const tilePreview = document.createElement('div');
  tilePreview.id = 'map-editor-tile-preview';
  tilePreview.className = 'me-tile-preview me-context-preview me-tile-preview-empty';
  contextCard.appendChild(tilePreview);

  const contextLines = document.createElement('div');
  contextLines.className = 'me-context-lines';

  const contextPrimary = document.createElement('div');
  contextPrimary.id = 'map-editor-context-primary';
  contextPrimary.className = 'me-context-primary';
  contextLines.appendChild(contextPrimary);

  const contextSecondary = document.createElement('div');
  contextSecondary.id = 'map-editor-context-secondary';
  contextSecondary.className = 'me-context-secondary';
  contextLines.appendChild(contextSecondary);

  contextCard.appendChild(contextLines);
  editPanel.appendChild(contextCard);

  const spriteList = document.createElement('div');
  spriteList.id = 'map-editor-sprite-list';
  spriteList.className = 'me-sprite-list';
  editPanel.appendChild(spriteList);

  const addRow = document.createElement('div');
  addRow.className = 'me-row';
  const addInput = document.createElement('input');
  addInput.id = 'map-editor-add-input';
  addInput.type = 'number';
  addInput.placeholder = t('mods.mapEditor.addSprite', 'Sprite ID to add');
  addInput.className = 'me-input me-input-wide';
  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'me-btn';
  addBtn.textContent = t('mods.mapEditor.add', 'Add sprite');
  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const tileIndex = editorState.selectedTileIndex;
    const spriteId = Number(addInput.value);
    logMapEditor('addSpriteClick', { tileIndex, spriteId });
    if (tileIndex == null || !Number.isFinite(spriteId)) {
      setStatusMessage(t('mods.mapEditor.addNeedTile', 'Select a tile and enter a valid sprite ID.'), true);
      return;
    }
    const ok = addSpriteToTile(getTileElement(tileIndex), spriteId, tileIndex);
    logMapEditor('addSpriteResult', { tileIndex, spriteId, ok });
    setStatusMessage(
      ok
        ? t('mods.mapEditor.addOk', 'Added sprite id-{id}.').replace('{id}', String(spriteId))
        : t('mods.mapEditor.addFail', 'Could not add id-{id} (missing tile or duplicate).').replace('{id}', String(spriteId)),
      !ok
    );
    refreshInspector();
  });
  addRow.append(addInput, addBtn);
  editPanel.appendChild(addRow);

  const assetsPanel = document.createElement('div');
  assetsPanel.className = 'me-tab-panel';
  assetsPanel.dataset.tabPanel = 'assets';
  assetsPanel.hidden = true;

  const assetSummary = document.createElement('div');
  assetSummary.id = 'map-editor-asset-summary';
  assetSummary.className = 'me-asset-summary';
  assetsPanel.appendChild(assetSummary);

  const assetSearch = document.createElement('input');
  assetSearch.type = 'search';
  assetSearch.id = 'map-editor-asset-search';
  assetSearch.className = 'me-input me-input-full';
  assetSearch.placeholder = t('mods.mapEditor.assetSearch', 'Search by sprite ID or map name…');
  assetSearch.addEventListener('input', (e) => {
    e.stopPropagation();
    editorState.assetFilter = assetSearch.value;
    scheduleAssetListRefresh();
  });
  assetsPanel.appendChild(assetSearch);

  const assetHint = document.createElement('div');
  assetHint.className = 'me-muted me-asset-hint-line';
  assetHint.textContent = t(
    'mods.mapEditor.assetHint',
    'Sprites from all maps. Click to add to the selected tile (crop/bank settings apply when available).'
  );
  assetsPanel.appendChild(assetHint);

  const assetGrid = document.createElement('div');
  assetGrid.id = 'map-editor-asset-grid';
  assetGrid.className = 'me-asset-grid';
  assetsPanel.appendChild(assetGrid);

  const optionsPanel = document.createElement('div');
  optionsPanel.className = 'me-tab-panel me-options-panel';
  optionsPanel.dataset.tabPanel = 'options';
  optionsPanel.hidden = true;

  const overlayRow = document.createElement('label');
  overlayRow.className = 'me-check-row';
  const overlayCheckbox = document.createElement('input');
  overlayCheckbox.type = 'checkbox';
  overlayCheckbox.id = 'map-editor-hitbox-toggle';
  overlayCheckbox.checked = editorState.hitboxOverlay;
  overlayCheckbox.addEventListener('change', (e) => {
    e.stopPropagation();
    editorState.hitboxOverlay = overlayCheckbox.checked;
    logMapEditor('hitboxOverlayToggle', { enabled: overlayCheckbox.checked });
    if (overlayCheckbox.checked) {
      updateHitboxOverlay();
    } else {
      removeHitboxOverlay();
      setStatusMessage(t('mods.mapEditor.hitboxHidden', 'Hitbox overlay hidden.'));
    }
  });
  overlayRow.append(
    overlayCheckbox,
    document.createTextNode(t('mods.mapEditor.hitboxOverlay', 'Show hitbox overlay (red = blocked, green = walkable)'))
  );
  optionsPanel.appendChild(overlayRow);

  const mapSection = document.createElement('div');
  mapSection.className = 'me-section';

  const mapTitle = document.createElement('div');
  mapTitle.className = 'me-section-title';
  mapTitle.textContent = t('mods.mapEditor.mapTitle', 'Map');
  mapSection.appendChild(mapTitle);

  const restoreMapRow = document.createElement('div');
  restoreMapRow.className = 'me-row';

  const restoreMapBtn = document.createElement('button');
  restoreMapBtn.type = 'button';
  restoreMapBtn.id = 'map-editor-restore-map-btn';
  restoreMapBtn.className = 'me-btn me-btn-wide';
  restoreMapBtn.textContent = t('mods.mapEditor.restoreMap', 'Restore map');
  restoreMapBtn.title = t('mods.mapEditor.restoreMapTooltip', 'Reload the current map from game data (discards live edits)');
  restoreMapBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    restoreMapFromGame();
  });
  restoreMapRow.appendChild(restoreMapBtn);
  mapSection.appendChild(restoreMapRow);

  const restoreMapHint = document.createElement('div');
  restoreMapHint.className = 'me-muted me-section-hint';
  restoreMapHint.textContent = t(
    'mods.mapEditor.restoreMapHint',
    'Undoes your edits, then reloads the room. Map changes also auto-restore while you have edits.'
  );
  mapSection.appendChild(restoreMapHint);
  optionsPanel.appendChild(mapSection);

  const sessionSection = document.createElement('div');
  sessionSection.className = 'me-section';

  const sessionTitle = document.createElement('div');
  sessionTitle.className = 'me-section-title';
  sessionTitle.textContent = t('mods.mapEditor.sessionTitle', 'Save / load');
  sessionSection.appendChild(sessionTitle);

  const nameRow = document.createElement('div');
  nameRow.id = 'map-editor-save-name-row';
  nameRow.className = 'me-row';
  nameRow.style.display = 'none';

  const saveNameInput = document.createElement('input');
  saveNameInput.type = 'text';
  saveNameInput.id = 'map-editor-save-name';
  saveNameInput.className = 'me-input me-input-full';
  saveNameInput.maxLength = 64;
  saveNameInput.placeholder = t('mods.mapEditor.saveNamePlaceholder', 'Save name…');
  saveNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      saveMapSession();
    }
  });
  nameRow.appendChild(saveNameInput);
  sessionSection.appendChild(nameRow);

  const sessionRow = document.createElement('div');
  sessionRow.id = 'map-editor-session-row';
  sessionRow.className = 'me-row me-session-row';
  sessionRow.style.display = 'none';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.id = 'map-editor-save-btn';
  saveBtn.className = 'me-btn';
  saveBtn.textContent = t('mods.mapEditor.save', 'Save');
  saveBtn.title = t('mods.mapEditor.saveTooltip', 'Save edits for this map');
  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    saveMapSession();
  });

  const loadBtn = document.createElement('button');
  loadBtn.type = 'button';
  loadBtn.id = 'map-editor-load-btn';
  loadBtn.className = 'me-btn';
  loadBtn.textContent = t('mods.mapEditor.load', 'Load');
  loadBtn.style.display = 'none';
  loadBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    loadMapSession();
  });

  const clearSaveBtn = document.createElement('button');
  clearSaveBtn.type = 'button';
  clearSaveBtn.id = 'map-editor-clear-save-btn';
  clearSaveBtn.className = 'me-btn me-btn-muted';
  clearSaveBtn.textContent = t('mods.mapEditor.clearSave', 'Clear save');
  clearSaveBtn.style.display = 'none';
  clearSaveBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const room = getCurrentRoom();
    if (!room?.id) return;
    const store = getMapSessionStore(room.id);
    const selected = store?.saves?.find((save) => save.id === editorState.selectedSaveId);
    if (selected) {
      clearMapSession(room.id, selected.id);
      setStatusMessage(
        t('mods.mapEditor.clearSaveNamedSuccess', 'Deleted save "{name}".').replace('{name}', selected.name)
      );
    } else {
      clearMapSession(room.id);
      setStatusMessage(t('mods.mapEditor.clearSaveSuccess', 'Cleared all saves for this map.'));
    }
  });

  sessionRow.append(saveBtn, loadBtn, clearSaveBtn);
  sessionSection.appendChild(sessionRow);

  const saveList = document.createElement('div');
  saveList.id = 'map-editor-save-list';
  saveList.className = 'me-save-list';
  saveList.hidden = true;
  sessionSection.appendChild(saveList);

  const sessionHint = document.createElement('div');
  sessionHint.id = 'map-editor-session-hint';
  sessionHint.className = 'me-session-hint';
  sessionSection.appendChild(sessionHint);
  optionsPanel.appendChild(sessionSection);

  const exportSection = document.createElement('div');
  exportSection.className = 'me-section';

  const exportTitle = document.createElement('div');
  exportTitle.className = 'me-section-title';
  exportTitle.textContent = t('mods.mapEditor.exportTitle', 'Export JSON');
  exportSection.appendChild(exportTitle);

  const exportRow = document.createElement('div');
  exportRow.className = 'me-row';
  const exportTileBtn = document.createElement('button');
  exportTileBtn.type = 'button';
  exportTileBtn.className = 'me-btn';
  exportTileBtn.textContent = t('mods.mapEditor.exportTile', 'Copy tile JSON');
  exportTileBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    logMapEditor('exportTileClick', { tileIndex: editorState.selectedTileIndex });
    if (editorState.selectedTileIndex == null) {
      setStatusMessage(t('mods.mapEditor.exportNeedTile', 'Select a tile first.'), true);
      return;
    }
    const payload = buildTileExport(editorState.selectedTileIndex);
    const ok = await copyTextToClipboard(JSON.stringify(payload, null, 2));
    logMapEditor('exportTileResult', { ok, payload });
    setStatusMessage(
      ok ? t('mods.mapEditor.exportTileOk', 'Tile JSON copied.') : t('mods.mapEditor.clipboardFail', 'Clipboard failed.'),
      !ok
    );
  });
  const exportRulesBtn = document.createElement('button');
  exportRulesBtn.type = 'button';
  exportRulesBtn.className = 'me-btn';
  exportRulesBtn.textContent = t('mods.mapEditor.exportRules', 'Copy sprite rules');
  exportRulesBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const payload = { rootId: 'background-scene', rules: buildSceneReplacementRules() };
    logMapEditor('exportRulesClick', { ruleCount: payload.rules.length });
    const ok = await copyTextToClipboard(JSON.stringify(payload, null, 2));
    logMapEditor('exportRulesResult', { ok, ruleCount: payload.rules.length });
    setStatusMessage(
      ok ? t('mods.mapEditor.exportRulesOk', 'sceneSpriteReplacements JSON copied.') : t('mods.mapEditor.clipboardFail', 'Clipboard failed.'),
      !ok
    );
  });
  exportRow.append(exportTileBtn, exportRulesBtn);
  exportSection.appendChild(exportRow);

  const exportMapRow = document.createElement('div');
  exportMapRow.className = 'me-row';
  const exportMapBtn = document.createElement('button');
  exportMapBtn.type = 'button';
  exportMapBtn.className = 'me-btn me-btn-wide';
  exportMapBtn.textContent = t('mods.mapEditor.exportMap', 'Copy whole map JSON');
  exportMapBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const payload = buildWholeMapExport();
    logMapEditor('exportWholeMapClick', {
      roomId: payload?.id || null,
      tileCount: payload?.file?.data?.tileCount || 0,
      populatedTiles: payload?.stats?.populatedTiles || 0
    });
    if (!payload) {
      setStatusMessage(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), true);
      return;
    }
    const ok = await copyTextToClipboard(JSON.stringify(payload, null, 2));
    logMapEditor('exportWholeMapResult', {
      ok,
      roomId: payload.id,
      stats: payload.stats
    });
    const stats = payload.stats || {};
    setStatusMessage(
      ok
        ? t('mods.mapEditor.exportMapOk', 'Map copied ({populated}/{total} tiles, {templates} templates).')
            .replace('{populated}', String(stats.populatedTiles || 0))
            .replace('{total}', String(payload.file?.data?.tileCount || 0))
            .replace('{templates}', String(stats.templates || 0))
        : t('mods.mapEditor.clipboardFail', 'Clipboard failed.'),
      !ok
    );
  });
  exportMapRow.appendChild(exportMapBtn);
  exportSection.appendChild(exportMapRow);
  optionsPanel.appendChild(exportSection);

  tabPanels.append(editPanel, assetsPanel, optionsPanel);
  root.appendChild(tabPanels);

  const status = document.createElement('div');
  status.id = 'map-editor-status';
  status.className = 'me-status';
  root.appendChild(status);

  editorState.inspectorRoot = root;
  editorState.activeTab = loadPanelSettings().activeTab || 'edit';
  switchInspectorTab(editorState.activeTab);
  refreshInspector();
  return root;
}

// =======================
// 11. Board listeners
// =======================

let battlefieldPickHandler = null;

function attachBattlefieldPickListener() {
  if (battlefieldPickHandler) return;
  battlefieldPickHandler = (e) => {
    if (!editorState.open || e.button !== 0) return;
    if (e.target.closest(`#${PANEL_ID}`)) return;
    if (e.target.closest('#monster-scroll') || e.target.closest('[role="dialog"]')) return;

    const pickOverlay = e.target.closest?.(`.${PICK_OVERLAY_CLASS}`);
    if (pickOverlay) {
      const tileIndex = Number(pickOverlay.dataset.tileIndex);
      if (Number.isFinite(tileIndex)) {
        e.preventDefault();
        e.stopPropagation();
        logMapEditor('battlefieldPickClick', { tileIndex, via: 'overlay' });
        selectTile(tileIndex);
      }
      return;
    }

    let tileIndex = resolveTileIndexFromBoardElement(e.target);
    if (tileIndex == null && isBoardPickPoint(e.clientX, e.clientY)) {
      tileIndex = resolveTileIndexAtPoint(e.clientX, e.clientY);
    }
    if (tileIndex == null) return;

    e.preventDefault();
    e.stopPropagation();
    logMapEditor('battlefieldPickClick', { tileIndex, via: 'coords' });
    selectTile(tileIndex);
  };
  document.addEventListener('pointerdown', battlefieldPickHandler, true);
  window.addEventListener('resize', scheduleTilePickRefresh);
  window.addEventListener('scroll', scheduleTilePickRefresh, true);
}

function detachBattlefieldPickListener() {
  if (!battlefieldPickHandler) return;
  document.removeEventListener('pointerdown', battlefieldPickHandler, true);
  window.removeEventListener('resize', scheduleTilePickRefresh);
  window.removeEventListener('scroll', scheduleTilePickRefresh, true);
  battlefieldPickHandler = null;
}

function enableMapEditorBoardTools() {
  document.body.classList.add('map-editor-board-active');
  refreshTilePickOverlays();
  attachTilePickObserver();
  attachBattlefieldPickListener();
  updateHitboxOverlay();
}

function disableMapEditorBoardTools() {
  document.body.classList.remove('map-editor-board-active');
  removeTilePickOverlays();
  applyBoardPiecePassThrough(false);
  detachBattlefieldPickListener();
  detachTilePickObserver();
  removeHitboxOverlay();
}

function scheduleBoardToolsRefresh() {
  if (boardToolsRefreshTimer) clearTimeout(boardToolsRefreshTimer);
  boardToolsRefreshTimer = setTimeout(() => {
    boardToolsRefreshTimer = null;
    if (!editorState.open || scopeHandlingSuspended) return;
    enableMapEditorBoardTools();
    if (editorState.selectedTileIndex != null) {
      markTileSelected(editorState.selectedTileIndex);
    }
  }, 150);
}

function handleBoardScopeChange() {
  if (scopeHandlingSuspended) return false;

  const roomKey = getBoardRoomKey();
  if (!roomKey) return false;

  const previousKey = trackedBoardKey;
  if (previousKey === roomKey) return false;

  const shouldRestore = previousKey != null
    && (editorState.open || hasPendingEditorEdits());

  if (previousKey != null) {
    editorState.selectedSaveId = null;
  }

  editorState.editingSprite = null;
  editorState.selectedTileIndex = null;
  clearTileSelection();
  removeTilePickOverlays();
  removeHitboxOverlay();

  if (shouldRestore) {
    logMapEditor('boardScopeChanged', { from: previousKey, to: roomKey });
    reloadRoomFromGame(roomKey, getBoardFloor(), { reason: 'scope-change' });
    return true;
  }

  if (previousKey != null) {
    revertAllEditorEdits();
    logMapEditor('boardScopeChanged', { from: previousKey, to: roomKey });
  }

  trackedBoardKey = roomKey;
  return false;
}

function attachBoardListener() {
  if (boardUnsubscribe || !globalThis.state?.board?.subscribe) return;
  boardUnsubscribe = globalThis.state.board.subscribe(() => {
    const scopeChanged = handleBoardScopeChange();
    if (!editorState.open) return;
    if (!scopeHandlingSuspended) {
      if (scopeChanged) scheduleBoardToolsRefresh();
      else {
        enableMapEditorBoardTools();
        if (editorState.selectedTileIndex != null) {
          markTileSelected(editorState.selectedTileIndex);
        }
      }
    }
    refreshInspector();
  });
}

function detachBoardListener() {
  if (boardUnsubscribe) {
    try { boardUnsubscribe(); } catch (e) {}
    boardUnsubscribe = null;
  }
}


// =======================
// 12. Panel styles
// =======================

function injectStyles() {
  let style = document.getElementById(STYLE_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = `
    body.map-editor-board-active #tiles [id^="tile-index-"] .sprite,
    body.map-editor-board-active #background-scene [id^="tile-index-"] .sprite {
      pointer-events: none !important;
    }
    body.map-editor-board-active #viewport button[aria-roledescription="draggable"],
    body.map-editor-board-active #background-scene button[aria-roledescription="draggable"],
    body.map-editor-board-active #board button[aria-roledescription="draggable"],
    body.map-editor-board-active #actors > * {
      pointer-events: none !important;
    }
    body.map-editor-board-active .${PICK_OVERLAY_CLASS} {
      pointer-events: auto !important;
      cursor: crosshair !important;
    }
    #${PANEL_ID} {
      --me-frame-3: url("https://bestiaryarena.com/_next/static/media/3-frame.87c349c1.png") 6 fill;
      --me-frame-4: url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;
      --me-frame-1: url("https://bestiaryarena.com/_next/static/media/1-frame.f1ab7b00.png") 4 fill;
      --me-bg: url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png");
      --me-panel-bg: #282C34;
      --me-inset: 8px;
      --me-gap: 4px;
      --me-text: #ABB2BF;
      --me-gold: #E5C07B;
      position: fixed;
      z-index: 10050;
      display: none;
      overflow: visible;
      box-sizing: border-box;
      padding: 0;
      margin: 0;
    }
    #${PANEL_ID} *,
    #${PANEL_ID} *::before,
    #${PANEL_ID} *::after {
      box-sizing: border-box;
    }
    #${PANEL_ID} > .me-panel-frame {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: var(--me-text);
      background-image: var(--me-bg);
      background-color: var(--me-panel-bg);
      border: 6px solid transparent;
      border-image: var(--me-frame-3);
      box-shadow: 0 0 15px rgba(0,0,0,0.7);
      font-family: Inter, sans-serif;
    }
    #${PANEL_ID} .me-header {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: var(--me-gap) var(--me-inset) 0;
      padding: 6px 8px 8px;
      cursor: move;
      user-select: none;
      border: 4px solid transparent;
      border-image: var(--me-frame-4);
      flex: 0 0 auto;
    }
    #${PANEL_ID} .me-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
    }
    #${PANEL_ID} .me-title {
      font-weight: bold;
      color: var(--me-gold);
      font-size: 14px;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    #${PANEL_ID} .me-header-actions {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    #${PANEL_ID} .me-icon-btn,
    #${PANEL_ID} .me-btn {
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background: transparent;
      color: var(--me-text);
      cursor: pointer;
      min-width: 22px;
      min-height: 20px;
      font-size: 12px;
      line-height: 1.2;
      padding: 2px 8px;
    }
    #${PANEL_ID} .me-icon-btn {
      font-size: 16px;
      padding: 0;
    }
    #${PANEL_ID} #${BODY_ID} {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      margin: 0 var(--me-inset) var(--me-inset);
      padding: 8px;
      border: 4px solid transparent;
      border-image: var(--me-frame-4);
    }
    #${PANEL_ID} .me-inspector {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 12px;
      line-height: 1.35;
      min-height: 0;
    }
    #${PANEL_ID} .me-tab-bar {
      display: flex;
      gap: 2px;
      flex: 0 0 auto;
      width: 100%;
      cursor: default;
    }
    #${PANEL_ID} .me-tab-btn {
      flex: 1;
      padding: 5px 4px;
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background-image: var(--me-bg);
      background-color: var(--me-panel-bg);
      color: #888;
      font-size: 11px;
      font-weight: bold;
      font-family: 'Trebuchet MS', 'Arial Black', Arial, sans-serif;
      cursor: pointer;
    }
    #${PANEL_ID} .me-tab-btn.active {
      color: var(--me-gold);
    }
    #${PANEL_ID} .me-tab-panels {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1 1 auto;
      min-height: 0;
    }
    #${PANEL_ID} .me-tab-panel {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
    }
    #${PANEL_ID} .me-tab-panel[hidden] {
      display: none !important;
    }
    #${PANEL_ID} .me-section {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    #${PANEL_ID} .me-section-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--me-gold);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    #${PANEL_ID} .me-input-full {
      width: 100%;
      box-sizing: border-box;
    }
    #${PANEL_ID} .me-asset-summary {
      font-size: 11px;
      color: var(--me-gold);
      font-weight: 700;
    }
    #${PANEL_ID} .me-asset-hint-line {
      font-size: 11px;
    }
    #${PANEL_ID} .me-asset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
      gap: 6px;
      max-height: none;
      overflow: visible;
      padding-right: 2px;
    }
    #${PANEL_ID} .me-asset-grid.is-loading {
      pointer-events: none;
    }
    #${PANEL_ID} .me-asset-skeleton {
      min-height: 72px;
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.04) 75%);
      background-size: 200% 100%;
      animation: me-asset-shimmer 1.2s ease-in-out infinite;
      cursor: default;
    }
    @keyframes me-asset-shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    #${PANEL_ID} .me-sprite-preview-id,
    #${PANEL_ID} .me-sprite-preview-pending {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      font-size: 11px;
      font-weight: 700;
      color: #aaa;
    }
    #${PANEL_ID} .me-asset-load-sentinel {
      grid-column: 1 / -1;
      height: 1px;
      pointer-events: none;
    }
    #${PANEL_ID} .me-asset-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 6px 4px;
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background: rgba(0,0,0,0.25);
      color: var(--me-text);
      cursor: pointer;
      text-align: center;
    }
    #${PANEL_ID} .me-asset-card:hover {
      color: var(--me-gold);
    }
    #${PANEL_ID} .me-asset-meta {
      width: 100%;
      min-width: 0;
    }
    #${PANEL_ID} .me-asset-id {
      font-weight: 700;
      font-size: 11px;
      color: var(--me-gold);
    }
    #${PANEL_ID} .me-asset-usage,
    #${PANEL_ID} .me-asset-hint {
      font-size: 10px;
      color: #888;
      line-height: 1.2;
      word-break: break-word;
    }
    #${PANEL_ID} .me-asset-empty {
      grid-column: 1 / -1;
      padding: 8px 0;
    }
    #${PANEL_ID} .me-options-panel {
      padding-top: 2px;
    }
    #${PANEL_ID} .me-context-card {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 8px;
      border: 4px solid transparent;
      border-image: var(--me-frame-4);
      background: rgba(0,0,0,0.2);
    }
    #${PANEL_ID} .me-context-lines {
      flex: 1 1 auto;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    #${PANEL_ID} .me-context-primary {
      font-weight: 700;
      color: var(--me-gold);
      font-size: 13px;
      line-height: 1.3;
      word-break: break-word;
    }
    #${PANEL_ID} .me-context-secondary {
      font-size: 11px;
      color: #888;
      line-height: 1.35;
      word-break: break-word;
    }
    #${PANEL_ID} .me-context-preview {
      flex: 0 0 auto;
      min-height: 0;
      min-width: ${SPRITE_PREVIEW_SIZE + 8}px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(0,0,0,0.25);
    }
    #${PANEL_ID} .me-context-preview.me-tile-preview-empty {
      width: ${SPRITE_PREVIEW_SIZE + 8}px;
      height: ${SPRITE_PREVIEW_SIZE + 8}px;
    }
    #${PANEL_ID} .me-preview-placeholder {
      color: #555;
      font-size: 14px;
      line-height: 1;
    }
    #${PANEL_ID} .me-tile-preview {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #${PANEL_ID} .me-tile-preview-stage {
      position: relative;
      width: ${SPRITE_PREVIEW_SIZE}px;
      height: ${SPRITE_PREVIEW_SIZE}px;
      overflow: visible;
      image-rendering: pixelated;
    }
    #${PANEL_ID} .me-tile-preview-layer {
      position: absolute;
      right: 0;
      bottom: 0;
      width: ${SPRITE_PREVIEW_SIZE}px;
      height: ${SPRITE_PREVIEW_SIZE}px;
      overflow: visible;
      pointer-events: none;
    }
    #${PANEL_ID} .me-tile-preview-layer .sprite,
    #${PANEL_ID} .me-sprite-preview .sprite {
      position: absolute;
      right: 0;
      bottom: 0;
      pointer-events: none;
    }
    #${PANEL_ID} .me-sprite-preview .viewport,
    #${PANEL_ID} .me-tile-preview-layer .viewport {
      width: ${SPRITE_PREVIEW_SIZE}px;
      height: ${SPRITE_PREVIEW_SIZE}px;
      overflow: hidden;
      image-rendering: pixelated;
    }
    #${PANEL_ID} .me-sprite-preview img.spritesheet,
    #${PANEL_ID} .me-tile-preview-layer img.spritesheet {
      width: 100%;
      height: 100%;
      max-width: ${SPRITE_PREVIEW_SIZE}px;
      max-height: ${SPRITE_PREVIEW_SIZE}px;
      image-rendering: pixelated;
      pointer-events: none;
      display: block;
    }
    #${PANEL_ID} .me-sprite-preview {
      width: ${SPRITE_PREVIEW_SIZE}px;
      height: ${SPRITE_PREVIEW_SIZE}px;
      position: relative;
      flex-shrink: 0;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(0,0,0,0.35);
      image-rendering: pixelated;
    }
    #${PANEL_ID} .me-sprite-preview-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      font-size: 11px;
    }
    #${PANEL_ID} .me-muted {
      margin: 0;
      font-size: 11px;
      color: #888;
    }
    #${PANEL_ID} .me-sprite-list {
      overflow: visible;
      padding: 6px 8px;
      border: 4px solid transparent;
      border-image: var(--me-frame-4);
      background: rgba(0,0,0,0.2);
    }
    #${PANEL_ID} .me-sprite-empty {
      padding: 2px 0;
    }
    #${PANEL_ID} .me-sprite-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }
    #${PANEL_ID} .me-sprite-actions {
      display: flex;
      gap: 4px;
      flex: 0 0 auto;
    }
    #${PANEL_ID} .me-sprite-edit {
      flex: 1 1 100%;
      display: flex;
      gap: 6px;
      align-items: center;
      flex-wrap: wrap;
      padding: 4px 0 2px 38px;
    }
    #${PANEL_ID} .me-sprite-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px 10px;
      flex: 1 1 auto;
      min-width: 0;
      font-size: 12px;
    }
    #${PANEL_ID} .me-sprite-tile,
    #${PANEL_ID} .me-sprite-layer {
      color: #aaa;
    }
    #${PANEL_ID} .me-sprite-id {
      font-weight: 700;
      color: var(--me-gold);
    }
    #${PANEL_ID} .me-sprite-hint {
      font-size: 11px;
      color: #888;
    }
    #${PANEL_ID} .me-sprite-hidden-tag {
      font-size: 11px;
      color: #E06C75;
    }
    #${PANEL_ID} .me-sprite-added-tag {
      font-size: 11px;
      color: #7EC699;
    }
    #${PANEL_ID} .me-btn-danger {
      color: #E06C75;
    }
    #${PANEL_ID} .me-btn-compact {
      padding: 2px 6px;
      min-width: 0;
    }
    #${PANEL_ID} .me-sprite-row-hidden {
      opacity: 0.65;
    }
    #${PANEL_ID} .me-sprite-row-config-only {
      opacity: 0.75;
      font-style: italic;
    }
    #${PANEL_ID} .me-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    #${PANEL_ID} .me-check-row {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 12px;
    }
    #${PANEL_ID} .me-input {
      width: 110px;
      padding: 4px 6px;
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background: rgba(0,0,0,0.35);
      color: var(--me-text);
      font-size: 12px;
    }
    #${PANEL_ID} .me-input-wide {
      width: 150px;
    }
    #${PANEL_ID} .me-btn-wide {
      flex: 1 1 100%;
      text-align: center;
    }
    #${PANEL_ID} .me-btn-muted {
      opacity: 0.85;
    }
    #${PANEL_ID} .me-session-hint {
      font-size: 11px;
      color: #888;
      margin-top: -2px;
      margin-bottom: 4px;
    }
    #${PANEL_ID} .me-save-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 120px;
      overflow-y: auto;
      margin-bottom: 4px;
    }
    #${PANEL_ID} .me-save-item {
      width: 100%;
      text-align: left;
      padding: 6px 8px;
      border: 1px solid #3a3a3a;
      border-radius: 4px;
      background: #1e1e1e;
      color: #ccc;
      font-size: 11px;
      cursor: pointer;
    }
    #${PANEL_ID} .me-save-item:hover {
      border-color: #5a5a5a;
      background: #262626;
    }
    #${PANEL_ID} .me-save-item.active {
      border-color: #6a8f3a;
      background: #2a331f;
      color: #e8e8e8;
    }
    #${PANEL_ID} .me-section-hint {
      font-size: 11px;
      color: #888;
      line-height: 1.35;
    }
    #${PANEL_ID} .me-status {
      min-height: 18px;
      font-size: 11px;
      color: #888;
    }
    #${PANEL_ID}.resizing {
      user-select: none;
    }
    #${PANEL_ID}.resizing > .me-panel-frame {
      pointer-events: none;
    }
    #${PANEL_ID}.resizing .me-resize-handle {
      pointer-events: auto;
    }
    #${PANEL_ID}.resizing #${BODY_ID} {
      overflow: hidden;
    }
    #${PANEL_ID} .me-resize-handle {
      position: absolute;
      z-index: 10001;
      background: transparent;
      user-select: none;
      pointer-events: auto;
    }
  `;
}

// =======================
// 13. Panel layout, drag & resize
// =======================

function updatePanelPosition() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel || panel.style.display === 'none') return;

  const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
  const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
  const rect = panel.getBoundingClientRect();
  let changed = false;

  if (rect.left < 0) {
    panel.style.left = '0px';
    changed = true;
  } else if (rect.left > maxLeft) {
    panel.style.left = maxLeft + 'px';
    changed = true;
  }
  if (rect.top < 0) {
    panel.style.top = '0px';
    changed = true;
  } else if (rect.top > maxTop) {
    panel.style.top = maxTop + 'px';
    changed = true;
  }

  if (changed) {
    savePanelSettings({
      left: parseInt(panel.style.left, 10) || 0,
      top: parseInt(panel.style.top, 10) || 0
    });
  }
}

function attachPanelViewportListener() {
  if (panelViewportListenerAttached) return;
  window.addEventListener('resize', updatePanelPosition);
  panelViewportListenerAttached = true;
}

function detachPanelViewportListener() {
  if (!panelViewportListenerAttached) return;
  window.removeEventListener('resize', updatePanelPosition);
  panelViewportListenerAttached = false;
}

function onPanelHeaderMouseDown(e) {
  if (e.button !== 0) return;
  if (e.target.tagName === 'BUTTON') return;
  if (e.target.closest('.me-tab-bar')) return;
  if (e.target.closest('.me-resize-handle')) return;
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panelDragState.panel = panel;
  panelDragState.dragging = true;
  const rect = panel.getBoundingClientRect();
  panelDragState.dragX = e.clientX - rect.left;
  panelDragState.dragY = e.clientY - rect.top;
  document.body.style.userSelect = 'none';
}

function addResizeHandles(panel) {
  const directions = ['n', 'e', 's', 'w', 'ne', 'se', 'sw', 'nw'];
  for (const dir of directions) {
    const handle = document.createElement('div');
    handle.className = `me-resize-handle me-resize-handle-${dir}`;
    handle.setAttribute('data-dir', dir);
    handle.style.position = 'absolute';
    handle.style.zIndex = '10001';
    handle.style.background = 'transparent';
    handle.style.userSelect = 'none';
    handle.style.pointerEvents = 'auto';
    handle.setAttribute('aria-label', `Resize ${dir}`);
    if (dir.length === 1) {
      if (dir === 'n' || dir === 's') {
        handle.style.height = '8px';
        handle.style.width = '100%';
        handle.style.cursor = `${dir}-resize`;
        handle.style[dir === 'n' ? 'top' : 'bottom'] = '0';
        handle.style.left = '0';
      } else {
        handle.style.width = '8px';
        handle.style.height = '100%';
        handle.style.cursor = `${dir}-resize`;
        handle.style[dir === 'w' ? 'left' : 'right'] = '0';
        handle.style.top = '0';
      }
    } else {
      handle.style.width = '12px';
      handle.style.height = '12px';
      handle.style.cursor = `${dir}-resize`;
      handle.style[dir.includes('n') ? 'top' : 'bottom'] = '0';
      handle.style[dir.includes('w') ? 'left' : 'right'] = '0';
    }
    panel.appendChild(handle);
  }
}

function getResizeDirFromPanelPoint(panel, clientX, clientY) {
  const rect = panel.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const m = RESIZE_EDGE_PX;
  const onN = y <= m;
  const onS = y >= rect.height - m;
  const onW = x <= m;
  const onE = x >= rect.width - m;
  if (onN && onW) return 'nw';
  if (onN && onE) return 'ne';
  if (onS && onW) return 'sw';
  if (onS && onE) return 'se';
  if (onN) return 'n';
  if (onS) return 's';
  if (onW) return 'w';
  if (onE) return 'e';
  return '';
}

function startPanelResize(panel, dir, e) {
  const rect = panel.getBoundingClientRect();
  Object.assign(panelResizeState, {
    isResizing: true,
    resizeDir: dir,
    resizeStartX: e.clientX,
    resizeStartY: e.clientY,
    startWidth: rect.width,
    startHeight: rect.height,
    startLeft: rect.left,
    startTop: rect.top
  });
  panel.classList.add('resizing');
  document.body.style.userSelect = 'none';
  e.preventDefault();
}

function ensurePanelDragListeners() {
  if (panelDragMouseMoveHandler) return;
  panelDragMouseMoveHandler = (e) => {
    if (!panelDragState.dragging || !panelDragState.panel) return;
    const panel = panelDragState.panel;
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);
    panel.style.left = `${clamp(e.clientX - panelDragState.dragX, 0, maxLeft)}px`;
    panel.style.top = `${clamp(e.clientY - panelDragState.dragY, 0, maxTop)}px`;
  };
  panelDragMouseUpHandler = () => {
    if (!panelDragState.dragging || !panelDragState.panel) return;
    savePanelSettings({
      left: parseInt(panelDragState.panel.style.left, 10) || 0,
      top: parseInt(panelDragState.panel.style.top, 10) || 0
    });
    panelDragState.reset();
    document.body.style.userSelect = '';
  };
  document.addEventListener('mousemove', panelDragMouseMoveHandler);
  document.addEventListener('mouseup', panelDragMouseUpHandler);
}

function ensurePanelResizeListeners() {
  if (panelResizeMouseMoveHandler) return;
  panelResizeMouseMoveHandler = (e) => {
    if (!panelResizeState.isResizing) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const dx = e.clientX - panelResizeState.resizeStartX;
    const dy = e.clientY - panelResizeState.resizeStartY;
    let newWidth = panelResizeState.startWidth;
    let newHeight = panelResizeState.startHeight;
    let newLeft = panelResizeState.startLeft;
    let newTop = panelResizeState.startTop;
    const { minWidth, maxWidth, minHeight, maxHeight } = PANEL_LAYOUT;

    if (panelResizeState.resizeDir.includes('e')) {
      newWidth = clampPanelSize(panelResizeState.startWidth + dx, minWidth, maxWidth);
    }
    if (panelResizeState.resizeDir.includes('w')) {
      const rightEdge = panelResizeState.startLeft + panelResizeState.startWidth;
      newWidth = clampPanelSize(panelResizeState.startWidth - dx, minWidth, maxWidth);
      newLeft = rightEdge - newWidth;
    }
    if (panelResizeState.resizeDir.includes('s')) {
      newHeight = clampPanelSize(panelResizeState.startHeight + dy, minHeight, maxHeight);
    }
    if (panelResizeState.resizeDir.includes('n')) {
      const bottomEdge = panelResizeState.startTop + panelResizeState.startHeight;
      newHeight = clampPanelSize(panelResizeState.startHeight - dy, minHeight, maxHeight);
      newTop = bottomEdge - newHeight;
    }

    panel.style.width = `${newWidth}px`;
    panel.style.height = `${newHeight}px`;
    panel.style.left = `${newLeft}px`;
    panel.style.top = `${newTop}px`;
  };
  panelResizeMouseUpHandler = () => {
    if (!panelResizeState.isResizing) return;
    const panel = document.getElementById(PANEL_ID);
    if (panel) {
      panel.classList.remove('resizing');
      savePanelSettings({
        left: parseInt(panel.style.left, 10) || 0,
        top: parseInt(panel.style.top, 10) || 0,
        width: parseInt(panel.style.width, 10) || PANEL_DEFAULTS.width,
        height: parseInt(panel.style.height, 10) || PANEL_DEFAULTS.height
      });
    }
    document.body.style.userSelect = '';
    panelResizeState.reset();
  };
  document.addEventListener('mousemove', panelResizeMouseMoveHandler);
  document.addEventListener('mouseup', panelResizeMouseUpHandler);
  document.addEventListener('pointermove', panelResizeMouseMoveHandler);
  document.addEventListener('pointerup', panelResizeMouseUpHandler);
}

function teardownPanelDragListeners() {
  if (panelDragMouseMoveHandler) {
    document.removeEventListener('mousemove', panelDragMouseMoveHandler);
    panelDragMouseMoveHandler = null;
  }
  if (panelDragMouseUpHandler) {
    document.removeEventListener('mouseup', panelDragMouseUpHandler);
    panelDragMouseUpHandler = null;
  }
  panelDragState.reset();
}

function teardownPanelResizeListeners() {
  if (panelResizeMouseMoveHandler) {
    document.removeEventListener('mousemove', panelResizeMouseMoveHandler);
    document.removeEventListener('pointermove', panelResizeMouseMoveHandler);
    panelResizeMouseMoveHandler = null;
  }
  if (panelResizeMouseUpHandler) {
    document.removeEventListener('mouseup', panelResizeMouseUpHandler);
    document.removeEventListener('pointerup', panelResizeMouseUpHandler);
    panelResizeMouseUpHandler = null;
  }
  panelResizeState.reset();
  document.body.style.userSelect = '';
  document.getElementById(PANEL_ID)?.classList.remove('resizing');
}

function isPointInPanelScrollContent(clientX, clientY) {
  const body = document.getElementById(BODY_ID);
  if (!body) return false;
  const rect = body.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right
    && clientY >= rect.top && clientY <= rect.bottom;
}

function onPanelPointerDownCapture(e) {
  if (e.button !== 0) return;
  const panel = e.currentTarget;
  if (!panel || panel.id !== PANEL_ID) return;

  const handle = e.target.closest('.me-resize-handle');
  if (handle) {
    const dir = handle.getAttribute('data-dir');
    if (dir) {
      startPanelResize(panel, dir, e);
      e.preventDefault();
      e.stopPropagation();
    }
    return;
  }

  const dir = getResizeDirFromPanelPoint(panel, e.clientX, e.clientY);
  if (dir) {
    startPanelResize(panel, dir, e);
    e.preventDefault();
    e.stopPropagation();
    return;
  }

  if (isPointInPanelScrollContent(e.clientX, e.clientY)) return;
}

// =======================
// 14. Panel lifecycle
// =======================

function createPanel() {
  injectStyles();
  const s = loadPanelSettings();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    `left:${s.left}px`,
    `top:${s.top}px`,
    `width:${clamp(s.width, PANEL_LAYOUT.minWidth, PANEL_LAYOUT.maxWidth)}px`,
    `height:${clamp(s.height, PANEL_LAYOUT.minHeight, PANEL_LAYOUT.maxHeight)}px`,
    `min-width:${PANEL_LAYOUT.minWidth}px`,
    `max-width:${PANEL_LAYOUT.maxWidth}px`,
    `min-height:${PANEL_LAYOUT.minHeight}px`,
    `max-height:${PANEL_LAYOUT.maxHeight}px`
  ].join(';');

  const frame = document.createElement('div');
  frame.className = 'me-panel-frame';
  panel.appendChild(frame);

  const header = document.createElement('div');
  header.className = 'me-header';

  const headerRow = document.createElement('div');
  headerRow.className = 'me-header-row';

  const titleEl = document.createElement('div');
  titleEl.className = 'me-title';
  titleEl.textContent = t('mods.mapEditor.title', 'Map Editor');

  const headerActions = document.createElement('div');
  headerActions.className = 'me-header-actions';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'me-icon-btn';
  closeBtn.textContent = '×';
  closeBtn.title = t('mods.mapEditor.close', 'Close');
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    logMapEditor('panelCloseClick');
    closeMapEditor();
  });

  headerActions.appendChild(closeBtn);
  headerRow.append(titleEl, headerActions);
  header.append(headerRow, buildTabBar());

  const body = document.createElement('div');
  body.id = BODY_ID;
  body.appendChild(buildInspectorContent());

  frame.appendChild(header);
  frame.appendChild(body);
  addResizeHandles(panel);

  header.addEventListener('mousedown', onPanelHeaderMouseDown);
  ensurePanelDragListeners();
  ensurePanelResizeListeners();
  panel.addEventListener('pointerdown', onPanelPointerDownCapture, true);
  updatePanelPosition();
  attachPanelViewportListener();

  return panel;
}

function openMapEditor() {
  logMapEditor('openPanel');
  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = createPanel();
    document.body.appendChild(panel);
  } else {
    const body = panel.querySelector(`#${BODY_ID}`);
    if (body && !editorState.inspectorRoot) {
      body.textContent = '';
      body.appendChild(buildInspectorContent());
    }
    updatePanelPosition();
    attachPanelViewportListener();
  }

  editorState.open = true;
  adoptTrackedBoardKey();
  panel.style.display = 'flex';
  enableMapEditorBoardTools();
  refreshInspector();
}

function closeMapEditor() {
  logMapEditor('closePanel');
  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.style.display = 'none';

  editorState.open = false;
  cancelAssetListWork();
  trackedBoardKey = null;
  scopeHandlingSuspended = false;
  if (boardToolsRefreshTimer) {
    clearTimeout(boardToolsRefreshTimer);
    boardToolsRefreshTimer = null;
  }
  disableMapEditorBoardTools();
  detachPanelViewportListener();
  clearTileSelection();
  editorState.selectedTileIndex = null;
  editorState.editingSprite = null;
}

function toggleMapEditor() {
  const panel = document.getElementById(PANEL_ID);
  const opening = !panel || panel.style.display === 'none';
  logMapEditor('modButtonClick', { opening });
  if (opening) openMapEditor();
  else closeMapEditor();
}

// =======================
// 15. Initialization & exports
// =======================

function initMapEditorButton() {
  if (!api?.ui?.addButton) {
    console.error('[Map Editor] api.ui.addButton not available');
    return;
  }

  attachBoardListener();

  api.ui.addButton({
    id: BUTTON_ID,
    text: t('mods.mapEditor.buttonText', 'Map Editor'),
    tooltip: t('mods.mapEditor.buttonTooltip', 'Map editor — inspect and edit battlefield tiles'),
    modId: MOD_ID,
    primary: false,
    onClick: toggleMapEditor
  });
}

function cleanupMapEditor() {
  closeMapEditor();
  detachBoardListener();
  disableMapEditorBoardTools();
  teardownPanelDragListeners();
  teardownPanelResizeListeners();
  detachPanelViewportListener();
  document.getElementById(PANEL_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();
  editorState.inspectorRoot = null;
  if (api?.ui?.removeButton) {
    api.ui.removeButton(BUTTON_ID);
  } else {
    document.getElementById(BUTTON_ID)?.remove();
  }
}

function refreshMapEditorPublicApi() {
  if (typeof window === 'undefined') return;
  window.MapEditor = {
    openMapEditor,
    closeMapEditor,
    toggleMapEditor
  };
}

refreshMapEditorPublicApi();

if (typeof context !== 'undefined' && context.api) {
  initMapEditorButton();
} else {
  console.error('[Map Editor] context.api not available');
}

exports = {
  openMapEditor,
  toggleMapEditor,
  cleanup: cleanupMapEditor
};
