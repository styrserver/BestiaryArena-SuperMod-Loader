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
const AUTO_SAVE_SESSION_FLAG = 'isAutoSave';
const WORKSHOP_FIREBASE_URL = 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app';
const WORKSHOP_BASE_PATH = `${WORKSHOP_FIREBASE_URL}/map-workshop`;
const WORKSHOP_SCHEMA_VERSION = 1;
const WORKSHOP_MAX_UPLOADS_PER_PLAYER = 3;
const WORKSHOP_TITLE_MAX_LENGTH = 48;
const WORKSHOP_DESCRIPTION_MAX_LENGTH = 240;
const HITBOX_OVERLAY_ID = 'map-editor-hitbox-overlay';
const PICK_OVERLAY_CLASS = 'map-editor-pick-overlay';
const HITBOX_OVERLAY_TILE_CLASS = 'map-editor-hitbox-tile-overlay';
const PLACEMENT_OVERLAY_TILE_CLASS = 'map-editor-placement-tile-overlay';
const TILE_SELECT_ATTR = 'data-map-editor-selected';
const HIDDEN_ATTR = 'data-map-editor-hidden';
const EDITOR_ADDED_ATTR = 'data-map-editor-added';
/** Set on editor-injected `#floor-below` sprite nodes; value is the owning tileIndex. */
const EDITOR_FB_TILE_ATTR = 'data-map-editor-fb-tile';
const TILE_BOX_SIZE = 'calc(32px * var(--zoomFactor))';
const TILE_SELECT_BORDER = '2px solid #ffe066';
/**
 * The selection highlight is a standalone frame appended to the tiles container (a
 * sibling of the tile elements, not a child) so it can float above neighbouring
 * tiles' sprites via z-index without touching any tile's own z-index. Kept below
 * the actor HUD (20000).
 */
const TILE_SELECT_FRAME_CLASS = 'map-editor-select-frame';
const TILE_SELECT_FRAME_Z = 9000;
/** Legacy: older builds stashed the tile's z-index here before forcing it high. */
const TILE_SELECT_PREV_Z_ATTR = 'meSelPrevZ';
const SPRITE_PREVIEW_SIZE = 32;
const ASSET_CARD_PREVIEW_SIZE = 48;
const WORKSHOP_CARD_PREVIEW_SIZE = 96;
const MAP_TILE_COLUMN_COUNT = 15;

const PANEL_DEFAULTS = {
  left: 80,
  top: 72,
  width: 380,
  height: 520,
  activeTab: 'map'
};

const PANEL_LAYOUT_KEYS = ['left', 'top', 'width', 'height'];

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
  placementOverlay: false,
  inspectorRoot: null,
  activeTab: 'map',
  assetIncludedMaps: null,
  assetExpandedRegions: new Set(),
  creatureSearchQuery: '',
  assetListStale: true,
  creatureListStale: true,
  assetTabScrollTop: 0,
  creatureTabScrollTop: 0,
  editingSprite: null,
  editingCreatureTileIndex: null,
  creatureEditFocusPending: false,
  selectedSaveId: null,
  selectedSaveRoomId: null,
  sandboxTestActive: false,
  workshopCatalog: null,
  workshopCatalogLoading: false,
  workshopCatalogFetchedAt: 0,
  selectedWorkshopMapId: null,
  workshopTabScrollTop: 0,
  workshopUploadTitle: '',
  workshopUploadDescription: ''
};

const editorBattleRules = {
  allyLimit: null,
  /** @type {number[]} tiles where allies may be placed initially (Custom Battles tileRestrictions.allowedTiles) */
  allowedPlacementTiles: []
};

const editorEdits = {
  addedSprites: [],
  /** @type {Record<number, object[]>} tileIndex → compact sprite configs added this session */
  addedSpriteConfigs: {},
  /**
   * @type {Record<number, object[]>} tileIndex → compact sprite configs the editor added
   * to the tile's *floor-below* layer this session (rendered into `#floor-below`, exported
   * as `room.file.data.floorBelowTiles`). Kept separate from `addedSpriteConfigs` so the
   * tile-child DOM machinery (dedupe / prune / drag-drop / layer-order) never sees them.
   */
  addedFloorBelowConfigs: {},
  hiddenSprites: [],
  replacements: [],
  hitboxOverrides: {},
  mapCleaned: false
};

let boardUnsubscribe = null;
let boardConfigSanitizeLock = false;

/**
 * React-safe board updates: boardConfig-only setState with null entries stripped.
 * Never patch selectedMap here — mutate live room refs via applyMergedRoomDataToLiveRefs().
 */
function summarizeBoardConfig(raw) {
  if (!Array.isArray(raw)) {
    return { length: 0, nullCount: 0, nullIndices: [], villainCount: 0, tiles: [], compactCount: 0 };
  }
  const nullIndices = [];
  const tiles = [];
  let villainCount = 0;
  raw.forEach((entity, index) => {
    if (entity == null) {
      nullIndices.push(index);
      return;
    }
    if (entity.villain) villainCount += 1;
    const tileIndex = Number(entity.tileIndex);
    if (Number.isFinite(tileIndex)) tiles.push(tileIndex);
  });
  return {
    length: raw.length,
    nullCount: nullIndices.length,
    nullIndices: nullIndices.slice(0, 8),
    villainCount,
    tiles: tiles.slice(0, 16),
    compactCount: compactBoardConfigEntries(raw).length
  };
}

function summarizeRoomBoardData() {
  const room = getCurrentRoom();
  const data = room?.file?.data;
  const actors = Array.isArray(data?.actors) ? data.actors : null;
  const tiles = Array.isArray(data?.tiles) ? data.tiles : null;
  const actorTiles = [];
  if (actors) {
    actors.forEach((actor, tileIndex) => {
      if (actor != null) actorTiles.push(tileIndex);
    });
  }
  return {
    roomId: room?.id || null,
    actorCount: actors?.length ?? null,
    actorNulls: actors ? actors.filter((actor) => actor == null).length : null,
    actorTiles: actorTiles.slice(0, 16),
    tileLayerCount: tiles?.length ?? null
  };
}

function logBoardStateSnapshot(tag, extra = {}) {
  try {
    const ctx = globalThis.state?.board?.getSnapshot()?.context || {};
    logMapEditor('boardSnapshot', {
      tag,
      restoreInProgress: restoreMapInProgress,
      sandboxActive: editorState.sandboxTestActive,
      board: summarizeBoardConfig(ctx.boardConfig),
      room: summarizeRoomBoardData(),
      mode: ctx.mode ?? null,
      gameStarted: ctx.gameStarted ?? null,
      ...extra
    });
  } catch (e) {
    logMapEditor('boardSnapshotFailed', { tag, error: String(e), ...extra });
  }
}

function sendBoardSetState(updater) {
  if (!globalThis.state?.board) return false;
  const run = (prev) => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (!next || next === prev) return next;
    if (next.selectedMap != null && next.selectedMap !== prev?.selectedMap) {
      logMapEditor('sendBoardSetStateDropSelectedMapPatch', {
        roomId: next.selectedMap?.selectedRoom?.id || null
      });
      const patched = { ...next };
      delete patched.selectedMap;
      if ('boardConfig' in patched) {
        patched.boardConfig = compactBoardConfigEntries(patched.boardConfig);
      }
      return patched;
    }
    if ('boardConfig' in next) {
      if (restoreMapInProgress) {
        logMapEditor('sendBoardSetStateBlocked', { reason: 'restore-in-progress' });
        return prev;
      }
      const compacted = compactBoardConfigEntries(next.boardConfig);
      if (restoreMapInProgress || editorState.sandboxTestActive) {
        logMapEditor('sendBoardSetState', {
          before: summarizeBoardConfig(prev?.boardConfig),
          after: summarizeBoardConfig(compacted)
        });
      }
      return {
        ...next,
        boardConfig: compacted
      };
    }
    return next;
  };
  try {
    if (globalThis.state.board.trigger?.setState) {
      globalThis.state.board.trigger.setState({ fn: run });
      return true;
    }
    if (globalThis.state.board.send) {
      globalThis.state.board.send({ type: 'setState', fn: run });
      return true;
    }
  } catch (e) {
    logMapEditor('sendBoardSetStateFailed', e);
  }
  return false;
}


/** Bypass restore guard — only for compacting/clearing boardConfig during native reload. */
function patchBoardStateDirect(updater) {
  if (!globalThis.state?.board) return false;
  const run = (prev) => {
    const next = typeof updater === 'function' ? updater(prev) : updater;
    if (!next || next === prev) return next;
    if ('boardConfig' in next) {
      return {
        ...next,
        boardConfig: compactBoardConfigEntries(next.boardConfig)
      };
    }
    return next;
  };
  try {
    if (globalThis.state.board.trigger?.setState) {
      globalThis.state.board.trigger.setState({ fn: run });
      return true;
    }
    if (globalThis.state.board.send) {
      globalThis.state.board.send({ type: 'setState', fn: run });
      return true;
    }
  } catch (e) {
    logMapEditor('patchBoardStateDirectFailed', e);
  }
  return false;
}

function forceCompactBoardConfigInGameState() {
  return patchBoardStateDirect((prev) => {
    const raw = prev?.boardConfig;
    const boardConfig = compactBoardConfigEntries(raw);
    const hadNulls = Array.isArray(raw) && raw.some((entity) => entity == null);
    if (!hadNulls && Array.isArray(raw) && boardConfig.length === raw.length) return prev;
    logMapEditor('forceCompactBoardConfig', {
      before: summarizeBoardConfig(raw),
      after: summarizeBoardConfig(boardConfig)
    });
    return { ...prev, boardConfig };
  });
}

function clearBoardConfigForNativeRoomSelect() {
  return patchBoardStateDirect((prev) => {
    const raw = prev?.boardConfig;
    const compacted = compactBoardConfigEntries(raw);
    if (!compacted.length) return prev;
    logMapEditor('clearBoardConfigForNativeRoomSelect', {
      before: summarizeBoardConfig(raw)
    });
    return { ...prev, boardConfig: [] };
  });
}

let trackedBoardKey = null; // room id only — floor changes are ignored
let boardToolsRefreshTimer = null;
let reloadRoomGeneration = 0;
let reloadRoomTimers = [];
let scopeHandlingSuspended = false;
const ROOM_RELOAD_BOUNCE_MS = 16;
const ROOM_RELOAD_SETTLE_MS = 200;
const RESTORE_MAP_SETTLE_COOLDOWN_MS = 1200;
const ASSET_LIST_CHUNK_SIZE = 36;
const ASSET_LIST_PAGE_SIZE = 500;
const ASSET_LIST_SEARCH_DEBOUNCE_MS = 200;
const ASSET_LIST_SKELETON_COUNT = 12;
let tilePickRefreshTimer = null;
let tilePickObserver = null;
/** @type {Map<string, Record<string, string>>} */
const nativeSpritePlacementCache = new Map();
let panelDragMouseMoveHandler = null;
let panelDragMouseUpHandler = null;
let panelResizeMouseMoveHandler = null;
let panelResizeMouseUpHandler = null;
let panelViewportListenerAttached = false;
let assetListLoadId = 0;
let assetListRenderRaf = null;
let assetListSearchTimer = null;
let assetPreviewObserver = null;
let assetPreviewHostCounter = 0;
let assetListLoadMoreObserver = null;
let assetListLoadMoreRoot = null;
let assetListFilteredCache = null;
let assetListFilterKey = null;
let allRoomsCreaturesCache = null;
let creatureListLoadId = 0;
let creatureLiveApplyTimer = null;
let creatureListRenderRaf = null;
let creatureListSearchTimer = null;
let creatureListLoadMoreObserver = null;
let creatureListLoadMoreRoot = null;
let creatureListFilteredCache = null;
let creatureListFilterKey = null;
let creatureListLoadingMore = false;
let mapEditorTestBattle = null;
let mapEditorTestRoomSnapshot = null;
let mapEditorTestNativeRoom = null;
/** @type {'workshop' | 'local-save' | null} */
let mapEditorDomSessionSource = null;
let mapEditorDomSessionRoomId = null;
let workshopMapReturnInProgress = false;
let mapSelectorLockActive = false;
let mapSelectorLockObserver = null;
let domSessionLoadGeneration = 0;
let sandboxTestReapplyTimer = null;
let sandboxTestAutoSetupHandler = null;
let sandboxTestNewGameUnsubscribe = null;
let sandboxTestEndGameUnsubscribe = null;
let sandboxTestEmitNewGameUnsubscribe = null;
let sandboxTestBoardStateUnsubscribe = null;
let sandboxTestLastGameStarted = false;
let sandboxTestApplying = false;
let mapEditorEditSessionRefreshTimer = null;
let workshopCatalogRenderToken = 0;
let workshopUploadInFlight = false;
let suppressSandboxAutoSetupReapplyUntil = 0;
/** Skip the board-subscription's full refreshInspector() right after our own sendBoardSetState
 *  writes (e.g. live creature-field edits) — it just rebuilds the panel and steals focus/scroll
 *  back to the top of the form; the live-apply path already keeps the visible summary in sync. */
let suppressBoardListenerRefreshUntil = 0;
/** Count of edit notifications since the last save/load — gates auto-save so merely opening
 *  a map that already has creatures/hitboxes (nothing new touched) doesn't silently write a
 *  save. Reset on load, on save (auto or manual), and when the tracked room/session changes. */
let editorSessionChangeCount = 0;
const AUTO_SAVE_MIN_CHANGES = 5;
let restoreMapInProgress = false;
let restoreMapSettleUntil = 0;
let restoreBoardGuardHandler = null;
const MAP_EDITOR_MANIPULATOR_COOLDOWN_MS = 500;
let mapEditorManipulatorCooldownUntil = 0;

function guardMapEditorManipulator(actionKey, options = {}) {
  if (options.skipThrottle === true) return true;
  if (restoreMapInProgress) {
    logMapEditor('manipulatorThrottled', { action: actionKey, reason: 'restore-in-progress' });
    return false;
  }
  const now = Date.now();
  if (now < restoreMapSettleUntil) {
    logMapEditor('manipulatorThrottled', {
      action: actionKey,
      reason: 'restore-settle',
      remainingMs: restoreMapSettleUntil - now
    });
    return false;
  }
  if (now < mapEditorManipulatorCooldownUntil) {
    logMapEditor('manipulatorThrottled', {
      action: actionKey,
      reason: 'cooldown',
      remainingMs: mapEditorManipulatorCooldownUntil - now
    });
    return false;
  }
  mapEditorManipulatorCooldownUntil = now + MAP_EDITOR_MANIPULATOR_COOLDOWN_MS;
  return true;
}
let mapEditorSavedPlayMode = null;
let playModeLockActive = false;
let playModeSelectorLockObserver = null;
let playModeEnforceUnsubscribe = null;
let playModeLockDeferTimer = null;
let playModeUnlockRetryTimers = [];
const PLAY_MODE_LOCK_ATTR = 'data-map-editor-play-mode-locked';
const PLAY_MODE_LOCK_OVERLAY_CLASS = 'map-editor-play-mode-lock-overlay';
const PLAY_MODE_LOCKED_BTN_CLASS = 'map-editor-play-mode-locked-btn';
const MAP_EDITOR_VILLAIN_KEY_PREFIX = 'map-editor-villain-tile-';
const MAP_EDITOR_ALLY_KEY_PREFIX = 'map-editor-ally-tile-';
const CREATURE_GENE_KEYS = [
  { key: 'hp', label: 'HP' },
  { key: 'ad', label: 'AD' },
  { key: 'ap', label: 'AP' },
  { key: 'armor', label: 'ARM' },
  { key: 'magicResist', label: 'MR' }
];
const CREATURE_GENE_UI_MIN = 0;
const CREATURE_GENE_UI_MAX = 100;
const CREATURE_GENE_ENGINE_MIN = 1;
const CREATURE_GENE_ENGINE_MAX = 20;
// UI-scale (0-100 by 5), not engine-scale — 100 here maps to engine gene 20 (max),
// matching the board's own default genes for a freshly placed villain/ally.
const CREATURE_GENE_UI_DEFAULT = 100;
const CREATURE_DIRECTIONS = ['south', 'north', 'east', 'west'];
const CREATURE_EQUIP_STATS = ['hp', 'ad', 'ap', 'armor', 'magicResist'];
const CREATURE_EQUIP_TIER_DEFAULT = 5;
const CREATURE_EQUIP_TIER_MIN = 1;
const CREATURE_EQUIP_TIER_MAX = 5;
const CREATURE_COMBAT_STAT_KEYS = [
  { key: 'hp', label: 'HP' },
  { key: 'ad', label: 'AD' },
  { key: 'ap', label: 'AP' },
  { key: 'armor', label: 'ARM' },
  { key: 'magicResist', label: 'MR' },
  { key: 'speed', label: 'SPD' }
];
const CREATURE_LIVE_APPLY_MS = 500;

/** @type {Map<number, object>} tileIndex → Custom Battles villain config */
const editorPlacedVillains = new Map();
/** @type {Set<number>} tileIndexes among editorPlacedVillains that fight as forced allies, not villains */
let editorAlliedTiles = new Set();

/** Split a list of placed-creature configs into { villains, allies } by editorAlliedTiles membership. */
function splitVillainsAndAllies(list) {
  const villains = [];
  const allies = [];
  (list || []).forEach((entry) => {
    if (editorAlliedTiles.has(Number(entry?.tileIndex))) allies.push(entry);
    else villains.push(entry);
  });
  return { villains, allies };
}

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

function tReplace(key, vars, fallback) {
  let text = t(key, fallback);
  if (vars && typeof vars === 'object') {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replace(`{${name}}`, String(value));
    }
  }
  return text;
}

// Map Editor toasts (Quests/Challenges-style game widgets)
const MAP_EDITOR_TOAST_DURATION = 5000;
const MAP_EDITOR_TOAST_CONTAINER_ID = 'map-editor-toast-container';
const MAP_EDITOR_TOAST_RED_BG = 'https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png';
const MAP_EDITOR_TOAST_FRAME = 'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png';
const MAP_EDITOR_TOAST_VARIANT_COLORS = {
  info: '#c8c8ff',
  success: '#6ee07a',
  warning: '#ffb070',
  error: '#E06C75'
};
const MAP_SELECTOR_LOCK_ATTR = 'data-map-editor-map-selector-locked';

let mapEditorPersistentToastHandle = null;

function getMapEditorToastContainer() {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(MAP_EDITOR_TOAST_CONTAINER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = MAP_EDITOR_TOAST_CONTAINER_ID;
    el.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
    document.body.appendChild(el);
  }
  return el;
}

function updateMapEditorToastPositions(container) {
  if (!container) return;
  container.querySelectorAll('.map-editor-toast-item').forEach((toast, index) => {
    toast.style.transform = `translateY(-${index * 46}px)`;
  });
}

function removeMapEditorPersistentToast() {
  if (mapEditorPersistentToastHandle?.remove) {
    mapEditorPersistentToastHandle.remove();
  }
  mapEditorPersistentToastHandle = null;
}

function showMapEditorToast(message, options = {}) {
  const safeMsg = message != null && message !== '' ? String(message) : '';
  try {
    const container = getMapEditorToastContainer();
    if (!container || !safeMsg) return null;

    const isTransient = typeof options.duration === 'number' && options.duration > 0;
    const isPersistent = options.persistent === true;
    const hasAction = typeof options.onAction === 'function';

    if (isPersistent) removeMapEditorPersistentToast();

    const existingToasts = container.querySelectorAll('.map-editor-toast-item');
    const stackOffset = existingToasts.length * 46;
    const flexContainer = document.createElement('div');
    flexContainer.className = 'map-editor-toast-item';
    flexContainer.style.cssText = `display:flex;position:absolute;transition:230ms cubic-bezier(0.21,1.02,0.73,1);transform:translateY(-${stackOffset}px);bottom:0;right:0;justify-content:flex-end;pointer-events:none;width:max-content;max-width:100%;`;

    const toast = document.createElement(isTransient && !hasAction ? 'button' : 'div');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    if (!isTransient) toast.setAttribute('role', 'presentation');
    if (isTransient || hasAction) toast.style.pointerEvents = 'auto';
    if (hasAction) toast.style.cursor = 'default';

    const widgetTop = document.createElement('div');
    widgetTop.className = 'widget-top h-2.5';
    const widgetBottom = document.createElement('div');
    widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    if (safeMsg.includes('\n')) messageDiv.style.whiteSpace = 'pre-line';
    const variant = options.variant || 'info';
    messageDiv.style.color = MAP_EDITOR_TOAST_VARIANT_COLORS[variant] || MAP_EDITOR_TOAST_VARIANT_COLORS.info;
    messageDiv.textContent = safeMsg;
    widgetBottom.appendChild(messageDiv);

    if (hasAction) {
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'me-btn';
      actionBtn.textContent = options.actionLabel || t('mods.mapEditor.workshopLeave', 'Leave');
      actionBtn.style.cssText = `flex-shrink:0;padding:4px 10px;font-size:12px;cursor:pointer;background:url("${MAP_EDITOR_TOAST_RED_BG}") repeat !important;border:3px solid transparent !important;border-image:url("${MAP_EDITOR_TOAST_FRAME}") 4 fill stretch !important;color:#fff !important;font-weight:bold;`;
      actionBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        options.onAction();
      });
      widgetBottom.appendChild(actionBtn);
    }

    toast.appendChild(widgetTop);
    toast.appendChild(widgetBottom);
    flexContainer.appendChild(toast);
    container.appendChild(flexContainer);
    updateMapEditorToastPositions(container);

    const removeToast = () => {
      if (flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateMapEditorToastPositions(container);
      }
      if (mapEditorPersistentToastHandle?.remove === removeToast) {
        mapEditorPersistentToastHandle = null;
      }
    };

    if (isTransient) {
      toast.addEventListener('click', (e) => {
        if (hasAction && e.target?.closest?.('button')) return;
        e.stopPropagation();
        removeToast();
      });
      setTimeout(removeToast, options.duration);
      return null;
    }

    const handle = {
      updateMessage(text) {
        const next = text != null && text !== '' ? String(text) : '';
        messageDiv.textContent = next;
        messageDiv.style.whiteSpace = next.includes('\n') ? 'pre-line' : '';
      },
      remove: removeToast
    };

    if (isPersistent) mapEditorPersistentToastHandle = handle;
    return handle;
  } catch (e) {
    console.warn('[Map Editor] showMapEditorToast:', e);
    return null;
  }
}

function setMapEditorFeedback(message, options = {}) {
  const {
    isError = false,
    pending = false,
    toast = true,
    variant = null,
    toastMessage = null
  } = options;

  setStatusMessage(message, isError);

  if (isWorkshopMapSessionActive() && !pending) {
    return;
  }

  const toastText = toastMessage ?? message;
  if (!toast || !toastText) {
    if (!pending) removeMapEditorPersistentToast();
    return;
  }

  const resolvedVariant = variant || (isError ? 'error' : pending ? 'info' : 'success');

  if (pending) {
    if (mapEditorPersistentToastHandle?.updateMessage) {
      mapEditorPersistentToastHandle.updateMessage(toastText);
      return;
    }
    showMapEditorToast(toastText, { persistent: true, variant: resolvedVariant });
    return;
  }

  removeMapEditorPersistentToast();
  showMapEditorToast(toastText, {
    duration: MAP_EDITOR_TOAST_DURATION,
    variant: resolvedVariant
  });
}

function isWorkshopMapSessionActive() {
  return mapEditorDomSessionSource === 'workshop' && !!mapEditorDomSessionRoomId;
}

function leaveWorkshopMapSession() {
  if (!isWorkshopMapSessionActive() || restoreMapInProgress) return;
  logMapEditor('workshopMapLeave');
  restoreMapFromGame();
}

function showWorkshopMapSessionToast(label) {
  const name = label || t('mods.mapEditor.defaultSaveName', 'Untitled');
  showMapEditorToast(
    t('mods.mapEditor.toastWorkshopLoaded', 'Workshop map loaded. Leave before changing maps.')
      .replace('{name}', name),
    {
      persistent: true,
      variant: 'warning',
      actionLabel: t('mods.mapEditor.workshopLeave', 'Leave'),
      onAction: leaveWorkshopMapSession
    }
  );
}

function beginWorkshopMapSession(roomId, label) {
  mapEditorDomSessionRoomId = roomId || getCurrentRoom()?.id || null;
  if (!mapEditorDomSessionRoomId) return;
  lockMapSelector();
  attachMapSelectorLockObserver();
  showWorkshopMapSessionToast(label);
  logMapEditor('workshopMapSessionStarted', { roomId: mapEditorDomSessionRoomId });
}

function endWorkshopMapSession() {
  const hadSession = !!mapEditorDomSessionRoomId || mapSelectorLockActive;
  mapEditorDomSessionRoomId = null;
  workshopMapReturnInProgress = false;
  unlockMapSelector();
  detachMapSelectorLockObserver();
  if (hadSession) logMapEditor('workshopMapSessionEnded');
}

function returnToWorkshopMap(attemptedRoomId) {
  if (!mapEditorDomSessionRoomId || workshopMapReturnInProgress || restoreMapInProgress) return;
  workshopMapReturnInProgress = true;
  scopeHandlingSuspended = true;
  logMapEditor('workshopMapBlockedNavigate', {
    roomId: mapEditorDomSessionRoomId,
    attempted: attemptedRoomId
  });
  navigateToRoomById(mapEditorDomSessionRoomId);
  scheduleReloadRoomTimer(() => {
    trackedBoardKey = mapEditorDomSessionRoomId;
    workshopMapReturnInProgress = false;
    scopeHandlingSuspended = false;
  }, ROOM_RELOAD_SETTLE_MS);
}

function queryInspector(selector) {
  return editorState.inspectorRoot?.querySelector(selector) ?? null;
}

function createPanelButton(text, onClick, className = 'me-btn') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = text;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick(e, btn);
  });
  return btn;
}

/**
 * Two-click inline "arm then confirm" pattern for destructive buttons — first click swaps the
 * button to a red confirm state (auto-reverts after timeoutMs, or on any click elsewhere);
 * clicking it again while armed actually runs onConfirm(). baseText/confirmText may be plain
 * strings or functions (resolved fresh each time) so the label can reflect current selection.
 */
function attachInlineConfirm(button, { baseText, confirmText, onConfirm, timeoutMs = 4000 }) {
  if (!button || typeof onConfirm !== 'function') return;
  let confirmTimeoutId = null;
  let outsideClickHandler = null;
  const resolveText = (value) => (typeof value === 'function' ? value() : value);
  const originalBackgroundColor = button.style.backgroundColor || '';
  const originalColor = button.style.color || '';

  const resetState = () => {
    button.dataset.confirmArmed = 'false';
    button.textContent = resolveText(baseText);
    button.style.backgroundColor = originalBackgroundColor;
    button.style.color = originalColor;
    if (confirmTimeoutId) {
      clearTimeout(confirmTimeoutId);
      confirmTimeoutId = null;
    }
    if (outsideClickHandler) {
      document.removeEventListener('mousedown', outsideClickHandler, true);
      outsideClickHandler = null;
    }
  };

  button.textContent = resolveText(baseText);
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    if (button.dataset.confirmArmed !== 'true') {
      button.dataset.confirmArmed = 'true';
      button.textContent = resolveText(confirmText);
      button.style.backgroundColor = '#8b0000';
      button.style.color = '#ffffff';
      if (confirmTimeoutId) clearTimeout(confirmTimeoutId);
      confirmTimeoutId = setTimeout(resetState, timeoutMs);

      outsideClickHandler = (event) => {
        if (event.target !== button) resetState();
      };
      document.addEventListener('mousedown', outsideClickHandler, true);
      return;
    }

    resetState();
    onConfirm();
  });
}

function setCollapsibleExpanded(target, trigger, expanded, options = {}) {
  const { expandedClass } = options;
  target.hidden = !expanded;
  if (!trigger) return;
  trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  if (expandedClass) trigger.classList.toggle(expandedClass, expanded);
  if (trigger.classList.contains('me-asset-region-toggle')) {
    trigger.textContent = expanded ? '▾' : '▸';
  }
}

function toggleCollapsible(target, trigger, options = {}) {
  const willExpand = target.hidden;
  setCollapsibleExpanded(target, trigger, willExpand, options);
  return willExpand;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function loadPanelLayout() {
  const layout = { ...PANEL_DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return layout;
    const stored = JSON.parse(raw);
    for (const key of PANEL_LAYOUT_KEYS) {
      const value = Number(stored[key]);
      if (Number.isFinite(value)) layout[key] = value;
    }
  } catch (e) {
    // use defaults
  }
  return layout;
}

function savePanelLayout(patch) {
  try {
    const layout = loadPanelLayout();
    for (const key of PANEL_LAYOUT_KEYS) {
      if (patch[key] != null) layout[key] = patch[key];
    }
    const stored = {};
    for (const key of PANEL_LAYOUT_KEYS) stored[key] = layout[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch (e) {}
}

function applyPanelLayoutToPanel(panel = document.getElementById(PANEL_ID)) {
  if (!panel) return;
  const layout = loadPanelLayout();
  const width = clamp(layout.width, PANEL_LAYOUT.minWidth, PANEL_LAYOUT.maxWidth);
  const height = clamp(layout.height, PANEL_LAYOUT.minHeight, PANEL_LAYOUT.maxHeight);
  // Keep the stored position inside the current viewport — the window may have
  // been resized since it was saved. updatePanelPosition() re-checks once the
  // panel is visible and measurable; this guards the pre-display assignment.
  const panelW = panel.offsetWidth || width;
  const panelH = panel.offsetHeight || height;
  const maxLeft = Math.max(0, window.innerWidth - panelW);
  const maxTop = Math.max(0, window.innerHeight - panelH);
  panel.style.left = `${clamp(layout.left, 0, maxLeft)}px`;
  panel.style.top = `${clamp(layout.top, 0, maxTop)}px`;
  panel.style.width = `${width}px`;
  panel.style.height = `${height}px`;
}

function clearReloadRoomTimers() {
  reloadRoomGeneration += 1;
  reloadRoomTimers.forEach(clearTimeout);
  reloadRoomTimers = [];
}

function scheduleReloadRoomTimer(fn, delay) {
  const generation = reloadRoomGeneration;
  const id = setTimeout(() => {
    reloadRoomTimers = reloadRoomTimers.filter((timerId) => timerId !== id);
    if (generation !== reloadRoomGeneration) return;
    fn();
  }, delay);
  reloadRoomTimers.push(id);
  return id;
}

function clearMapEditorCaches() {
  allRoomsAssetsCache = null;
  assetFilterRegionTreeCache = null;
  assetListFilteredCache = null;
  assetListFilterKey = null;
  allRoomsCreaturesCache = null;
  creatureListFilteredCache = null;
  creatureListFilterKey = null;
  editorState.assetListStale = true;
  editorState.creatureListStale = true;
}

function resetMapEditorAssetFilterUi() {
  const filterToggle = queryInspector('.me-asset-filter-toggle');
  const filterList = queryInspector('#map-editor-asset-map-filters');
  if (filterList && filterToggle) {
    setCollapsibleExpanded(filterList, filterToggle, false, { expandedClass: 'is-expanded' });
  }
  refreshAssetMapFilterPanel();
}

function resetMapEditorUiState() {
  editorState.activeTab = PANEL_DEFAULTS.activeTab;
  editorState.hitboxOverlay = false;
  editorState.placementOverlay = false;
  editorState.assetIncludedMaps = null;
  editorState.assetExpandedRegions.clear();
  editorState.assetListStale = true;
  editorState.creatureListStale = true;
  editorState.assetTabScrollTop = 0;
  editorState.creatureTabScrollTop = 0;
  editorState.selectedTileIndex = null;
  editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;
  editorState.selectedSaveId = null;
  editorState.selectedSaveRoomId = null;
  editorState.workshopCatalog = null;
  editorState.workshopCatalogLoading = false;
  editorState.workshopCatalogFetchedAt = 0;
  editorState.selectedWorkshopMapId = null;
  editorState.workshopUploadTitle = '';
  editorState.workshopUploadDescription = '';
  // Keep allyLimit / allowedPlacementTiles across panel open/close — the edit
  // session (and live CustomBattle) stays active in sandbox.
  cancelAssetListWork();
  cancelCreatureListWork();
  removeHitboxOverlay();
  clearTileSelection();
}

function logMapEditor(...args) {
  console.log('[Map Editor]', ...args);
}

function detachRestoreBoardGuard() {
  if (restoreBoardGuardHandler && globalThis.state?.board?.off) {
    try { globalThis.state.board.off('autoSetupBoard', restoreBoardGuardHandler); } catch (e) {}
  }
  restoreBoardGuardHandler = null;
}

function attachRestoreBoardGuard() {
  detachRestoreBoardGuard();
  if (!globalThis.state?.board?.on) return;
  restoreBoardGuardHandler = () => {
    if (!restoreMapInProgress) return;
    scheduleBoardConfigSanitize();
  };
  globalThis.state.board.on('autoSetupBoard', restoreBoardGuardHandler);
}

function buildEditorRestorePlan() {
  const wasMapCleaned = editorEdits.mapCleaned;
  const hadHitboxEdits = Object.keys(editorEdits.hitboxOverrides).length > 0;
  const hadVillainEdits = editorPlacedVillains.size > 0;
  const hadActorEdits = hasActorEditsFromSnapshot();
  const hadHiddenSprites = editorEdits.hiddenSprites.length > 0;
  const hadSpriteEdits = editorEdits.addedSprites.length > 0
    || hadHiddenSprites
    || editorEdits.replacements.length > 0
    || Object.keys(editorEdits.addedSpriteConfigs).length > 0
    || Object.keys(editorEdits.addedFloorBelowConfigs).length > 0;
  const hadNativeRoomPatch = !!mapEditorTestNativeRoom;
  const hadEdits = hasPendingEditorEdits() || wasMapCleaned || hadActorEdits;

  if (!hadEdits) {
    return { mode: 'none', hadEdits: false };
  }

  const needsFullRestore = wasMapCleaned || hadHitboxEdits || hadVillainEdits;

  return {
    mode: needsFullRestore ? 'full' : 'dom',
    hadEdits: true,
    wasMapCleaned,
    hadHitboxEdits,
    hadVillainEdits,
    hadActorEdits,
    hadHiddenSprites,
    hadSpriteEdits,
    hadNativeRoomPatch,
    needRoomFileRevert: needsFullRestore || hadNativeRoomPatch || hadSpriteEdits || hadActorEdits
  };
}

function cancelPendingMapEditorRefreshTimers() {
  if (sandboxTestReapplyTimer) {
    clearTimeout(sandboxTestReapplyTimer);
    sandboxTestReapplyTimer = null;
  }
  if (mapEditorEditSessionRefreshTimer) {
    clearTimeout(mapEditorEditSessionRefreshTimer);
    mapEditorEditSessionRefreshTimer = null;
  }
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

function hasActorEditsFromSnapshot() {
  const tileCount = getMapTileCount();
  if (!tileCount) return false;
  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    if (!actorConfigsEqual(getActorOnTile(tileIndex), getOriginalActorOnTile(tileIndex))) {
      return true;
    }
  }
  return false;
}

function hasPendingEditorEdits() {
  const hasCustomAllyLimit = editorBattleRules.allyLimit != null
    && Number(editorBattleRules.allyLimit) > 0;
  return editorEdits.addedSprites.length > 0
    || Object.keys(editorEdits.addedSpriteConfigs).length > 0
    || Object.keys(editorEdits.addedFloorBelowConfigs).length > 0
    || editorEdits.hiddenSprites.length > 0
    || editorEdits.replacements.length > 0
    || Object.keys(editorEdits.hitboxOverrides).length > 0
    || editorPlacedVillains.size > 0
    || hasActorEditsFromSnapshot()
    || getAllowedPlacementTiles().length > 0
    || hasCustomAllyLimit;
}

function scheduleBoardConfigSanitize() {
  if (restoreMapInProgress) {
    requestAnimationFrame(() => forceCompactBoardConfigInGameState());
    return;
  }
  sanitizeBoardConfigIfNeeded();
}

function notifySpriteDomEditsChanged() {
  notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
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
  removeSyntheticFloorBelowContainer();
  if (removed) logMapEditor('removeOrphanedAddedSprites', { removed });
  return removed;
}

function refreshEditorAddedSpritesFromDom() {
  for (const tileEl of getActiveTileElements()) {
    const tileIndex = getTileIndexFromElement(tileEl);
    if (tileIndex == null) continue;
    for (const sprite of getAllSpritesOnTile(tileEl)) {
      if (!isEditorAddedSprite(sprite)) continue;
      if (!editorEdits.addedSprites.some((entry) => entry.sprite === sprite)) {
        editorEdits.addedSprites.push({ tileIndex, sprite });
      }
    }
  }
}

function purgeAllEditorDomEdits(options = {}) {
  refreshEditorAddedSpritesFromDom();

  let reverted = 0;
  for (const entry of [...editorEdits.replacements].reverse()) {
    if (!entry.sprite?.isConnected || isEphemeralBattleSprite(entry.sprite)) continue;
    if (revertSpriteReplacement(entry)) reverted += 1;
  }
  if (options.skipDomRestore !== true) {
    for (const entry of [...editorEdits.hiddenSprites].reverse()) {
      if (!entry.sprite?.isConnected || isEphemeralBattleSprite(entry.sprite)) continue;
      if (restoreSpriteElement(entry.sprite, { skipThrottle: true, silent: true })) reverted += 1;
    }
  }
  for (const entry of [...editorEdits.addedSprites].reverse()) {
    if (removeEditorAddedSprite(entry.sprite)) reverted += 1;
  }
  reverted += removeOrphanedEditorAddedSprites();
  reverted += removeAllEditorFloorBelowDom();
  removeAllMapEditorVillainsFromBoard();
  if (options.restoreHitboxes !== false) {
    restoreLiveHitboxesFromSnapshot();
  } else {
    clearHitboxSnapshot();
  }
  resetEditorEdits();
  clearBaseTilesSnapshot();
  mapEditorTestNativeRoom = null;
  mapEditorDomSessionSource = null;
  endWorkshopMapSession();
  logMapEditor('purgeEditorDomEdits', { reverted });
  return reverted;
}

function resetEditorEditsTracking() {
  editorEdits.addedSprites = [];
  editorEdits.addedSpriteConfigs = {};
  editorEdits.addedFloorBelowConfigs = {};
  editorEdits.hiddenSprites = [];
  editorEdits.replacements = [];
  editorEdits.hitboxOverrides = {};
  editorEdits.mapCleaned = false;
  editorPlacedVillains.clear();
  editorAlliedTiles.clear();
  // Do not clear allyLimit / allowedPlacementTiles here — those are workshop
  // battle rules and survive DOM edit resets while the sandbox session lives.
  clearEditorTileDomCache();
  if (typeof removePlacementOverlay === 'function') removePlacementOverlay();
}

/** Revert DOM edits recorded in editorEdits; never patches boardConfig (villains use selectRoomById). */
function restoreDomEditsFromTrace(restorePlan) {
  refreshEditorAddedSpritesFromDom();
  let reverted = 0;

  for (const entry of [...editorEdits.replacements].reverse()) {
    if (!entry.sprite?.isConnected || isEphemeralBattleSprite(entry.sprite)) continue;
    if (revertSpriteReplacement(entry)) reverted += 1;
  }
  for (const entry of [...editorEdits.hiddenSprites].reverse()) {
    let sprite = entry.sprite;
    if (!sprite?.isConnected) {
      sprite = findSpriteOnTileByIds(entry.tileIndex, entry.spriteIds, { onlyHidden: true })
        || findSpriteOnTileByIds(entry.tileIndex, entry.spriteIds);
    }
    if (!sprite || isEphemeralBattleSprite(sprite)) continue;
    if (restoreSpriteElement(sprite, { skipThrottle: true, silent: true })) reverted += 1;
  }
  for (const entry of [...editorEdits.addedSprites].reverse()) {
    if (removeEditorAddedSprite(entry.sprite)) reverted += 1;
  }
  reverted += removeOrphanedEditorAddedSprites();
  reverted += removeAllEditorFloorBelowDom();

  let tilesRestored = false;
  if ((restorePlan?.hadSpriteEdits || restorePlan?.wasMapCleaned) && baseTilesSnapshot) {
    const data = getCurrentRoom()?.file?.data;
    if (data) {
      data.tiles = cloneJson(baseTilesSnapshot);
      tilesRestored = true;
    }
  }

  if (restorePlan?.hadHitboxEdits || restorePlan?.wasMapCleaned) {
    restoreLiveHitboxesFromSnapshot();
  } else {
    clearHitboxSnapshot();
  }

  const data = getCurrentRoom()?.file?.data;
  let actorsRestored = false;
  if (data) {
    const shouldRestoreActors = restorePlan?.wasMapCleaned
      || restorePlan?.hadVillainEdits
      || restorePlan?.hadActorEdits;
    if (shouldRestoreActors && baseActorsSnapshot) {
      const tileCount = getRoomDataTileCount(data) || getMapTileCount();
      const normalized = normalizeRoomActorsForGame(baseActorsSnapshot, tileCount);
      const runtime = serializeActorsForGameRuntime(normalized);
      if (runtime !== undefined) data.actors = runtime;
      else delete data.actors;
      actorsRestored = true;
    }
    applySparseActorsToRoomData(data);
    applyActorsSparseToAllRoomRefs(getCurrentRoom()?.id);
  }

  nativeSpritePlacementCache.clear();
  mapEditorTestNativeRoom = null;
  clearBaseTilesSnapshot();
  resetEditorEditsTracking();

  logMapEditor('restoreDomEditsBulk', {
    reverted,
    tilesRestored,
    actorsRestored,
    wasMapCleaned: restorePlan?.wasMapCleaned === true,
    bulkDomUnhide: restorePlan?.wasMapCleaned === true,
    mode: restorePlan?.mode || 'none',
    hadEdits: restorePlan?.hadEdits === true
  });
  return reverted;
}

function resetEditorEdits(options = {}) {
  resetEditorEditsTracking();
  if (options.skipVillainBoardPatch !== true) {
    removeAllMapEditorVillainsFromBoard();
  }
}

function trackAddedSpriteConfig(tileIndex, config) {
  const compact = compactSpriteConfig(config);
  if (tileIndex == null || !compact) return;
  if (tileHasTrackedAddedSpriteConfig(tileIndex, compact)) return;
  if (!editorEdits.addedSpriteConfigs[tileIndex]) {
    editorEdits.addedSpriteConfigs[tileIndex] = [];
  }
  editorEdits.addedSpriteConfigs[tileIndex].push(cloneJson(compact));
}

function untrackAddedSpriteConfig(tileIndex, spriteEl, spritesOnTile = null) {
  if (tileIndex == null || !spriteEl) return;
  const tileEl = getTileElement(tileIndex);
  const list = spritesOnTile || (tileEl ? getAllSpritesOnTile(tileEl) : []);
  const index = list.indexOf(spriteEl);
  if (index < 0) return;

  const addedIndexes = getAddedSpriteInstanceIndexes(tileIndex, list);
  if (!addedIndexes.has(index)) return;

  const orderedAdded = [...addedIndexes].sort((a, b) => a - b);
  const slotAmongAdded = orderedAdded.indexOf(index);
  const configs = editorEdits.addedSpriteConfigs[tileIndex];
  if (!configs || slotAmongAdded < 0 || slotAmongAdded >= configs.length) return;

  configs.splice(slotAmongAdded, 1);
  if (!configs.length) delete editorEdits.addedSpriteConfigs[tileIndex];
}

function clearAddedSpriteConfigsForTile(tileIndex) {
  if (tileIndex == null) return;
  delete editorEdits.addedSpriteConfigs[tileIndex];
}

function getAddedSpriteInstanceIndexes(tileIndex, spritesOnTile = null) {
  const tileEl = getTileElement(tileIndex);
  const list = spritesOnTile || (tileEl ? getAllSpritesOnTile(tileEl) : []);
  const tracked = editorEdits.addedSpriteConfigs[tileIndex] || [];
  const addedIndexes = new Set();

  list.forEach((sprite, index) => {
    if (isEditorAddedSprite(sprite)) addedIndexes.add(index);
  });

  if (!tracked.length) return addedIndexes;

  const unmatchedTracked = tracked.map((entry) => cloneJson(entry));
  list.forEach((sprite, index) => {
    if (addedIndexes.has(index)) return;
    const compact = compactSpriteConfig(extractSpriteConfig(sprite));
    if (!compact) return;
    const matchIdx = unmatchedTracked.findIndex((entry) => spriteConfigEquals(entry, compact));
    if (matchIdx >= 0) {
      addedIndexes.add(index);
      unmatchedTracked.splice(matchIdx, 1);
    }
  });

  return addedIndexes;
}

function isSpriteAddedOnTile(tileIndex, spriteEl, spritesOnTile = null) {
  const tileEl = getTileElement(tileIndex);
  const list = spritesOnTile || (tileEl ? getAllSpritesOnTile(tileEl) : []);
  const index = list.indexOf(spriteEl);
  if (index < 0) return false;
  if (isEditorAddedSprite(spriteEl)) return true;
  const tracked = editorEdits.addedSpriteConfigs[tileIndex] || [];
  if (!tracked.length) return false;
  return getAddedSpriteInstanceIndexes(tileIndex, list).has(index);
}

function buildNativeVisibleConfigs(tileIndex, original) {
  const hiddenById = new Map();
  for (const entry of editorEdits.hiddenSprites) {
    if (entry.tileIndex !== tileIndex) continue;
    const id = entry.spriteIds?.[0];
    if (id == null) continue;
    hiddenById.set(id, (hiddenById.get(id) || 0) + 1);
  }

  const replacementByFromId = new Map();
  for (const entry of editorEdits.replacements) {
    if (entry.tileIndex !== tileIndex) continue;
    if (entry.fromId != null && entry.toId != null) {
      replacementByFromId.set(entry.fromId, entry.toId);
    }
  }

  const result = [];
  for (const config of original) {
    const id = config.id;
    const hiddenLeft = hiddenById.get(id) || 0;
    if (hiddenLeft > 0) {
      hiddenById.set(id, hiddenLeft - 1);
      continue;
    }
    let out = cloneJson(compactSpriteConfig(config));
    if (!out) continue;
    if (replacementByFromId.has(id)) {
      out.id = replacementByFromId.get(id);
    }
    result.push(out);
  }
  return result;
}

function buildNativeOnlyTilesPatch(tileCount) {
  const tiles = [];
  if (editorEdits.mapCleaned) {
    for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
      tiles[tileIndex] = [];
    }
    return tiles;
  }
  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const layer = compactTileLayer(
      buildNativeVisibleConfigs(tileIndex, getOriginalTileLayer(tileIndex) || [])
    );
    tiles[tileIndex] = layer.length ? layer : [];
  }
  return tiles;
}

function buildEditedTileLayerForRoom(tileIndex) {
  const original = getOriginalTileLayer(tileIndex) || [];
  const nativeConfigs = buildNativeVisibleConfigs(tileIndex, original);
  const addedConfigs = (editorEdits.addedSpriteConfigs[tileIndex] || []).map((entry) => cloneJson(entry));
  return compactTileLayer([...nativeConfigs, ...addedConfigs]);
}

function tileHasTrackedAddedSpriteConfig(tileIndex, config) {
  const compact = compactSpriteConfig(config);
  if (tileIndex == null || !compact) return false;
  const tracked = editorEdits.addedSpriteConfigs[tileIndex] || [];
  return tracked.some((entry) => spriteConfigEquals(entry, compact));
}

function tileHasSpriteConfig(tileIndex, config) {
  return tileHasTrackedAddedSpriteConfig(tileIndex, config);
}

function dedupeAddedSpriteConfigsForTile(tileIndex) {
  const configs = editorEdits.addedSpriteConfigs[tileIndex];
  if (!configs?.length) return 0;
  const unique = [];
  let removed = 0;
  configs.forEach((config) => {
    const compact = compactSpriteConfig(config);
    if (!compact) {
      removed += 1;
      return;
    }
    if (unique.some((entry) => spriteConfigEquals(entry, compact))) {
      removed += 1;
      return;
    }
    unique.push(cloneJson(compact));
  });
  if (unique.length) editorEdits.addedSpriteConfigs[tileIndex] = unique;
  else delete editorEdits.addedSpriteConfigs[tileIndex];
  return removed;
}

function dedupeAllAddedSpriteConfigs() {
  let removed = 0;
  for (const tileIndexKey of Object.keys(editorEdits.addedSpriteConfigs)) {
    removed += dedupeAddedSpriteConfigsForTile(Number(tileIndexKey));
  }
  return removed;
}

function countAddedSpritesMatchingConfigOnTile(tileEl, tileIndex, config) {
  const compact = compactSpriteConfig(config);
  if (!tileEl || !compact) return 0;
  const sprites = getAllSpritesOnTile(tileEl);
  return sprites.filter((sprite) => {
    if (!isEditorAddedSprite(sprite)) return false;
    const spriteConfig = compactSpriteConfig(extractSpriteConfig(sprite));
    return spriteConfig && spriteConfigEquals(spriteConfig, compact);
  }).length;
}

function pruneDuplicateSpritesOnTile(tileIndex) {
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return 0;

  const sprites = getAllSpritesOnTile(tileEl);
  const keptAddedKeys = new Set();
  let removed = 0;

  sprites.forEach((sprite) => {
    if (!isEditorAddedSprite(sprite)) return;

    const compact = compactSpriteConfig(extractSpriteConfig(sprite));
    if (!compact) return;
    const key = JSON.stringify(compact);
    if (!keptAddedKeys.has(key)) {
      keptAddedKeys.add(key);
      return;
    }

    untrackAddedSpriteConfig(tileIndex, sprite, sprites);
    if (safeRemoveSpriteElement(sprite)) removed += 1;
    untrackAddedSprite(sprite);
  });

  if (removed) {
    rebuildAddedSpriteConfigsFromDom(tileIndex);
    dedupeAddedSpriteConfigsForTile(tileIndex);
    logMapEditor('pruneDuplicateSpritesOnTile', { tileIndex, removed });
  }
  return removed;
}

function pruneDuplicateSpritesOnAllTiles() {
  const tileIndexes = new Set([
    ...Object.keys(editorEdits.addedSpriteConfigs).map(Number),
    ...editorEdits.addedSprites.map((entry) => entry.tileIndex).filter((index) => index != null)
  ]);
  let removed = 0;
  tileIndexes.forEach((tileIndex) => {
    removed += pruneDuplicateSpritesOnTile(tileIndex);
  });
  return removed;
}

function isAddedTileSprite(tileIndex, sprite, spritesOnTile = null) {
  return isEditorAddedSprite(sprite) || isSpriteAddedOnTile(tileIndex, sprite, spritesOnTile);
}

function partitionTileSprites(tileIndex, sprites) {
  const natives = [];
  const added = [];
  (sprites || []).forEach((sprite) => {
    if (isAddedTileSprite(tileIndex, sprite, sprites)) added.push(sprite);
    else natives.push(sprite);
  });
  return { natives, added };
}

function getTileSpritesInLayerOrder(tileEl, tileIndex = null) {
  if (!tileEl) return [];
  const resolvedTileIndex = tileIndex ?? getTileIndexFromElement(tileEl);
  const sprites = getAllSpritesOnTile(tileEl);
  const { natives, added } = partitionTileSprites(resolvedTileIndex, sprites);
  return [...natives, ...added];
}

function getEditableTileSprites(tileIndex, tileEl = null) {
  const el = tileEl || getTileElement(tileIndex);
  if (!el || tileIndex == null) return [];
  return getTileSpritesInLayerOrder(el, tileIndex).filter((sprite) => {
    if (isEphemeralBattleSprite(sprite)) return false;
    if (editorEdits.mapCleaned && isSpriteHidden(sprite)) return false;
    return true;
  });
}

function applyTileSpriteLayerOrder(tileIndex, orderedSprites = null) {
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return;
  const sprites = getAllSpritesOnTile(tileEl);
  if (!sprites.length) return;

  const natives = sprites.filter((sprite) => !isEditorAddedSprite(sprite));
  let added = sprites.filter((sprite) => isEditorAddedSprite(sprite));
  if (Array.isArray(orderedSprites) && orderedSprites.length) {
    const orderedAdded = orderedSprites.filter((sprite) => isEditorAddedSprite(sprite));
    if (orderedAdded.length) added = orderedAdded;
  }

  natives.forEach((sprite, index) => {
    const wantZ = String(index + 1);
    if (sprite.style.zIndex !== wantZ) sprite.style.zIndex = wantZ;
  });

  const pickOverlay = tileEl.querySelector(`.${PICK_OVERLAY_CLASS}`);
  let insertAnchor = pickOverlay || null;
  for (let index = added.length - 1; index >= 0; index -= 1) {
    const sprite = added[index];
    const wantZ = String(natives.length + index + 1);
    if (sprite.style.zIndex !== wantZ) sprite.style.zIndex = wantZ;
    if (sprite.parentNode !== tileEl) continue;
    if (sprite.nextElementSibling !== insertAnchor) {
      try {
        tileEl.insertBefore(sprite, insertAnchor);
      } catch (e) {
        // ignore
      }
    }
    insertAnchor = sprite;
  }
}

function applyTileSpriteStackOrder(tileEl, _sprites, tileIndex = null) {
  const resolvedTileIndex = tileIndex ?? getTileIndexFromElement(tileEl);
  if (resolvedTileIndex == null || !tileEl) return;
  applyTileSpriteLayerOrder(resolvedTileIndex);
}

function reapplyAllTileSpriteStackOrders() {
  getActiveTileElements().forEach((tileEl) => {
    const tileIndex = getTileIndexFromElement(tileEl);
    if (tileIndex == null) return;
    if (!getAllSpritesOnTile(tileEl).length) return;
    applyTileSpriteLayerOrder(tileIndex);
  });
  reapplyAllAddedSpritePlacements();
}

function rebuildAddedSpriteConfigsFromDom(tileIndex, sprites = null) {
  if (tileIndex == null) return;
  const list = sprites || getAllSpritesOnTile(getTileElement(tileIndex));
  const configs = [];
  list.forEach((sprite) => {
    if (!isEditorAddedSprite(sprite)) return;
    const config = compactSpriteConfig(extractSpriteConfig(sprite));
    if (!config) return;
    if (configs.some((entry) => spriteConfigEquals(entry, config))) return;
    configs.push(cloneJson(config));
  });
  if (configs.length) editorEdits.addedSpriteConfigs[tileIndex] = configs;
  else delete editorEdits.addedSpriteConfigs[tileIndex];
}

function reorderTileSprites(tileIndex, fromIndex, toIndex) {
  if (tileIndex == null || fromIndex === toIndex) return false;
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return false;

  const editableList = getEditableTileSprites(tileIndex, tileEl);
  const fullList = getTileSpritesInLayerOrder(tileEl, tileIndex);
  if (fromIndex < 0 || fromIndex >= editableList.length) return false;
  if (toIndex < 0 || toIndex >= editableList.length) return false;

  const moved = editableList[fromIndex];
  const dropTarget = editableList[toIndex];
  const fullFromIndex = fullList.indexOf(moved);
  const fullToIndex = fullList.indexOf(dropTarget);
  if (fullFromIndex < 0 || fullToIndex < 0) return false;

  if (!isAddedTileSprite(tileIndex, moved, fullList)) return false;

  const { natives, added } = partitionTileSprites(tileIndex, fullList);
  const fromAdded = added.indexOf(moved);
  if (fromAdded < 0) return false;

  let toAdded = fullToIndex < natives.length ? 0 : fullToIndex - natives.length;
  toAdded = Math.max(0, Math.min(toAdded, added.length - 1));

  const [item] = added.splice(fromAdded, 1);
  added.splice(toAdded, 0, item);

  const ordered = [...natives, ...added];
  applyTileSpriteLayerOrder(tileIndex, ordered);
  rebuildAddedSpriteConfigsFromDom(tileIndex, ordered);
  syncLiveTileLayerToRoom(tileIndex);
  refreshAddedSpritesTrackingForTile(tileIndex);

  const entry = buildTileSessionEntry(tileIndex);
  if (entry) editorTileDomCache.set(tileIndex, entry);
  else editorTileDomCache.delete(tileIndex);

  notifySpriteDomEditsChanged();
  logMapEditor('reorderTileSprites', { tileIndex, fromIndex, toIndex, fullFromIndex, fullToIndex });
  return true;
}

function trackAddedSprite(tileIndex, spriteEl) {
  if (tileIndex == null || !spriteEl) return;
  editorEdits.addedSprites.push({ tileIndex, sprite: spriteEl });
}

function trackHiddenSprite(tileIndex, spriteEl) {
  if (tileIndex == null || !spriteEl) return;
  const spriteIds = getSpriteIdsFromElement(spriteEl);
  editorEdits.hiddenSprites = editorEdits.hiddenSprites.filter((entry) => entry.sprite !== spriteEl);
  editorEdits.hiddenSprites.push({ tileIndex, sprite: spriteEl, spriteIds });
}

function findSpriteOnTileByIds(tileIndex, spriteIds, options = {}) {
  const { excludeHidden = false, onlyHidden = false } = options;
  const tileEl = getTileElement(tileIndex);
  if (!tileEl || !spriteIds?.length) return null;
  const sprites = getAllSpritesOnTile(tileEl);
  for (const id of spriteIds) {
    const match = sprites.find((sprite) => {
      const hidden = isSpriteHidden(sprite);
      if (excludeHidden && hidden) return false;
      if (onlyHidden && !hidden) return false;
      return getSpriteIdsFromElement(sprite).includes(id);
    });
    if (match) return match;
  }
  return findFloorBelowSpriteOnTile(tileIndex, spriteIds, options);
}

function applyHiddenSpriteVisual(spriteEl) {
  if (!spriteEl || spriteEl.hasAttribute(HIDDEN_ATTR)) return false;
  spriteEl.style.visibility = 'hidden';
  spriteEl.style.display = 'none';
  spriteEl.style.pointerEvents = 'none';
  spriteEl.setAttribute(HIDDEN_ATTR, '1');
  return true;
}

function reapplyHiddenSpritesToDom() {
  if (!editorEdits.hiddenSprites.length) return 0;

  let applied = 0;
  const nextEntries = [];
  for (const entry of editorEdits.hiddenSprites) {
    // Prefer a still-visible duplicate so each hidden entry claims its own node.
    let sprite = findSpriteOnTileByIds(entry.tileIndex, entry.spriteIds, { excludeHidden: true });
    if (!sprite && entry.sprite?.isConnected) sprite = entry.sprite;
    if (!sprite) sprite = findSpriteOnTileByIds(entry.tileIndex, entry.spriteIds);
    if (!sprite || isEphemeralBattleSprite(sprite)) continue;

    const refreshed = {
      tileIndex: entry.tileIndex,
      sprite,
      spriteIds: entry.spriteIds?.length ? entry.spriteIds : getSpriteIdsFromElement(sprite)
    };
    nextEntries.push(refreshed);
    if (applyHiddenSpriteVisual(sprite)) applied += 1;
  }

  editorEdits.hiddenSprites = nextEntries;
  if (applied) logMapEditor('reapplyHiddenSprites', { applied });
  return applied;
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

function safeRemoveSpriteElement(spriteEl) {
  const parent = spriteEl?.parentNode;
  if (!parent?.contains(spriteEl)) return false;
  try {
    spriteEl.remove();
    return true;
  } catch (e) {
    return false;
  }
}

function removeEditorAddedSprite(spriteEl) {
  if (!spriteEl) return false;
  untrackAddedSprite(spriteEl);
  if (!isEditorAddedSprite(spriteEl)) return false;
  return safeRemoveSpriteElement(spriteEl);
}

function removeAddedSprite(spriteEl, tileIndex = null) {
  if (!guardMapEditorManipulator('remove-sprite')) return false;
  const ids = getSpriteIdsFromElement(spriteEl);
  const resolvedTileIndex = tileIndex ?? getTileIndexFromElement(spriteEl);
  if (!isSpriteAddedOnTile(resolvedTileIndex, spriteEl)) return false;

  if (editorState.editingSprite?.tileIndex === resolvedTileIndex
    && ids.includes(editorState.editingSprite.fromId)) {
    editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;
  }

  untrackAddedSpriteConfig(resolvedTileIndex, spriteEl);
  safeRemoveSpriteElement(spriteEl);
  untrackAddedSprite(spriteEl);

  syncLiveTileLayerToRoom(resolvedTileIndex);
  refreshAddedSpritesTrackingForTile(resolvedTileIndex);
  const entry = buildTileSessionEntry(resolvedTileIndex);
  if (entry) editorTileDomCache.set(resolvedTileIndex, entry);
  else editorTileDomCache.delete(resolvedTileIndex);
    logMapEditor('removeAddedSprite', { tileIndex: resolvedTileIndex, spriteIds: ids });
  notifySpriteDomEditsChanged();
  return true;
}

function isLikelyAddedSprite(config, tileIndex, sessionSprites, spriteIndex) {
  if (!config?.id) return false;
  const original = getOriginalTileLayer(tileIndex) || [];
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
  if (editorState.sandboxTestActive) return 0;
  return purgeAllEditorDomEdits();
}

function discardEphemeralEditorDomState(options = {}) {
  if (options.keepHiddenSprites !== true) {
    editorEdits.hiddenSprites = [];
  }
  editorEdits.replacements = [];
  editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;
}

function getActiveBoardRoot() {
  const scene = document.getElementById('background-scene');
  if (scene?.isConnected) return scene;
  const tiles = getTilesContainer();
  if (tiles?.isConnected) return tiles;
  return getBoardPickRoot();
}

function isRealMapTileElement(el) {
  return /^tile-index-\d+$/.test(el?.id || '');
}

function getActiveTileElements() {
  const root = getActiveBoardRoot();
  const nodes = root
    ? root.querySelectorAll('[id^="tile-index-"]')
    : document.querySelectorAll('[id^="tile-index-"]');
  return Array.from(nodes).filter(isRealMapTileElement);
}

function findBounceRoomId(excludeRoomId) {
  const excluded = String(excludeRoomId || '');
  try {
    const roomNames = globalThis.state?.utils?.ROOM_NAME;
    // Prefer Sewers so same-map refresh is consistent and fast (matches custom-battles.js).
    if (roomNames && typeof roomNames === 'object') {
      for (const [roomId, name] of Object.entries(roomNames)) {
        if (String(roomId) === excluded) continue;
        if (String(name) === 'Sewers' || String(roomId) === 'sewers') {
          return roomId;
      }
      }
    }
    if (excluded !== 'sewers') return 'sewers';

    const regionRooms = getBoardContext()?.selectedMap?.selectedRegion?.rooms;
    if (Array.isArray(regionRooms)) {
      for (const room of regionRooms) {
        const id = room?.id || room?.roomId || room;
        if (id && String(id) !== excluded) return id;
      }
    }

    if (roomNames && typeof roomNames === 'object') {
      for (const roomId of Object.keys(roomNames)) {
        if (String(roomId) !== excluded) return roomId;
      }
    }
  } catch (e) {
    // ignore
  }
  return excluded !== 'sewers' ? 'sewers' : null;
}

function navigateToRoomById(roomId) {
  if (!roomId || !globalThis.state?.board?.send) return false;
  if (restoreMapInProgress) {
    forceCompactBoardConfigInGameState();
  } else if (editorState.open || editorState.sandboxTestActive) {
    compactBoardConfigInGameState();
  }
  globalThis.state.board.send({ type: 'selectRoomById', roomId });
  return true;
}

/** Rebuild boardConfig from room.file.data via game API (no sendBoardSetState). */
function refreshBoardFromRoomFile(options = {}) {
  const roomId = getCurrentRoom()?.id;
  if (!roomId) return false;
  if (restoreMapInProgress && options.allowDuringRestore !== true) return false;
  const floor = options.preserveFloor !== false ? getBoardFloor() : null;
  logMapEditor('refreshBoardFromRoomFile', { roomId, floor });
  navigateToRoomById(roomId);
  if (floor != null) {
    scheduleReloadRoomTimer(() => setBoardFloor(floor), ROOM_RELOAD_SETTLE_MS);
  }
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

let mapEditorSavedFloor = null;
let mapEditorFloorEnforceUnsubscribe = null;
let mapEditorFloorUiObserver = null;
let mapEditorFloorUiHideTimers = [];
const MAP_EDITOR_FLOOR_UI_HIDDEN_ATTR = 'data-map-editor-floor-ui-hidden';

function shouldKeepMapEditorFloorLocked() {
  return editorState.open === true || editorState.sandboxTestActive === true;
}

function forceMapEditorFloorZero() {
  if (!shouldKeepMapEditorFloorLocked()) return false;
  if (getBoardFloor() === 0) return true;
  return setBoardFloor(0);
}

function findMapEditorFloorUiHosts() {
  const hosts = [];
  document.querySelectorAll('[data-maxfloorenabled], [data-floor]').forEach((el) => {
    const host = el.closest('.absolute') || el.parentElement || el;
    if (host && !hosts.includes(host)) hosts.push(host);
  });
  return hosts;
}

function hideMapEditorFloorUi() {
  findMapEditorFloorUiHosts().forEach((host) => {
    if (!host.hasAttribute(MAP_EDITOR_FLOOR_UI_HIDDEN_ATTR)) {
      host.setAttribute(MAP_EDITOR_FLOOR_UI_HIDDEN_ATTR, '1');
      host.dataset.mapEditorPrevDisplay = host.style.display || '';
    }
    host.style.display = 'none';
  });
}

function showMapEditorFloorUi() {
  document.querySelectorAll(`[${MAP_EDITOR_FLOOR_UI_HIDDEN_ATTR}="1"]`).forEach((host) => {
    host.style.display = host.dataset.mapEditorPrevDisplay || '';
    host.removeAttribute(MAP_EDITOR_FLOOR_UI_HIDDEN_ATTR);
    delete host.dataset.mapEditorPrevDisplay;
  });
}

function clearMapEditorFloorUiHideTimers() {
  mapEditorFloorUiHideTimers.forEach((id) => clearTimeout(id));
  mapEditorFloorUiHideTimers = [];
}

function scheduleMapEditorFloorUiHideRetries() {
  clearMapEditorFloorUiHideTimers();
  [0, 50, 150, 400, 900].forEach((delay) => {
    const id = setTimeout(() => {
      mapEditorFloorUiHideTimers = mapEditorFloorUiHideTimers.filter((timerId) => timerId !== id);
      if (!shouldKeepMapEditorFloorLocked()) return;
      hideMapEditorFloorUi();
      forceMapEditorFloorZero();
    }, delay);
    mapEditorFloorUiHideTimers.push(id);
  });
}

function attachMapEditorFloorUiObserver() {
  if (mapEditorFloorUiObserver || typeof MutationObserver === 'undefined') return;
  mapEditorFloorUiObserver = new MutationObserver(() => {
    if (!shouldKeepMapEditorFloorLocked()) return;
    hideMapEditorFloorUi();
  });
  mapEditorFloorUiObserver.observe(document.body, { childList: true, subtree: true });
}

function detachMapEditorFloorUiObserver() {
  if (!mapEditorFloorUiObserver) return;
  try { mapEditorFloorUiObserver.disconnect(); } catch (_) {}
  mapEditorFloorUiObserver = null;
}

function attachMapEditorFloorEnforceListener() {
  if (mapEditorFloorEnforceUnsubscribe || !globalThis.state?.board?.subscribe) return;
  mapEditorFloorEnforceUnsubscribe = globalThis.state.board.subscribe((state) => {
    if (!shouldKeepMapEditorFloorLocked()) return;
    if (Number(state?.context?.floor) !== 0) setBoardFloor(0);
  });
}

function detachMapEditorFloorEnforceListener() {
  if (!mapEditorFloorEnforceUnsubscribe) return;
  try { mapEditorFloorEnforceUnsubscribe(); } catch (_) {}
  mapEditorFloorEnforceUnsubscribe = null;
}

function enterMapEditorFloorLock() {
  // enableMapEditorBoardTools() calls this on every board-state notification while
  // the panel is open, and a single tile action can fire several in a row — the
  // enforce listener/UI observer already keep the lock correct reactively, so once
  // attached, re-doing the force-zero/hide-UI/log work here is pure redundant cost.
  const alreadyLocked = mapEditorFloorEnforceUnsubscribe != null;
  if (mapEditorSavedFloor == null) {
    mapEditorSavedFloor = getBoardFloor();
  }
  attachMapEditorFloorEnforceListener();
  attachMapEditorFloorUiObserver();
  if (alreadyLocked) return;
  forceMapEditorFloorZero();
  hideMapEditorFloorUi();
  scheduleMapEditorFloorUiHideRetries();
  logMapEditor('floorLocked', { savedFloor: mapEditorSavedFloor });
}

function exitMapEditorFloorLock() {
  clearMapEditorFloorUiHideTimers();
  detachMapEditorFloorUiObserver();
  detachMapEditorFloorEnforceListener();
  showMapEditorFloorUi();

  const restoreFloor = mapEditorSavedFloor;
  mapEditorSavedFloor = null;
  if (restoreFloor != null && getBoardFloor() !== restoreFloor) {
    setBoardFloor(restoreFloor);
  }
  logMapEditor('floorUnlocked', { restoredFloor: restoreFloor });
}

function getRoomDisplayName(room) {
  if (!room) return 'Unknown room';
  const utils = globalThis.state?.utils;
  if (utils?.ROOM_NAME && room.id && utils.ROOM_NAME[room.id]) {
    return utils.ROOM_NAME[room.id];
  }
  return room.file?.name || room.id || 'Unknown room';
}

let baseHitboxesSnapshot = null;
let baseTilesSnapshot = null;
let baseActorsSnapshot = null;
let baseFloorBelowSnapshot = null;
const editorTileDomCache = new Map();

function clearHitboxSnapshot() {
  baseHitboxesSnapshot = null;
}

function clearBaseTilesSnapshot() {
  baseTilesSnapshot = null;
  baseActorsSnapshot = null;
  baseFloorBelowSnapshot = null;
}

function captureBaseTilesSnapshot() {
  const snapshotData = mapEditorTestRoomSnapshot?.entries?.[0]?.saved?.file?.data;
  const tileCount = getRoomDataTileCount(snapshotData) || getMapTileCount();
  if (snapshotData?.tiles) {
    baseTilesSnapshot = cloneJson(snapshotData.tiles);
  } else {
    const tiles = getCurrentRoom()?.file?.data?.tiles;
    baseTilesSnapshot = Array.isArray(tiles) ? cloneJson(tiles) : null;
  }
  if (snapshotData?.actors) {
    baseActorsSnapshot = cloneJson(snapshotData.actors);
  } else {
    const actors = getCurrentRoom()?.file?.data?.actors;
    baseActorsSnapshot = Array.isArray(actors) ? cloneJson(actors) : null;
  }
  const hitboxes = snapshotData?.hitboxes ?? getCurrentRoom()?.file?.data?.hitboxes;
  baseHitboxesSnapshot = Array.isArray(hitboxes) ? hitboxes.slice() : [];
  const floorBelow = snapshotData?.floorBelowTiles ?? getCurrentRoom()?.file?.data?.floorBelowTiles;
  baseFloorBelowSnapshot = normalizeIndexedRoomLayer(floorBelow, tileCount);
}

function getOriginalTileLayer(tileIndex) {
  const layer = baseTilesSnapshot?.[tileIndex];
  return Array.isArray(layer) ? layer : null;
}

function normalizeSpriteLayerConfig(entry) {
  if (entry == null) return [];
  if (Array.isArray(entry)) {
    return entry.map((item) => compactSpriteConfig(item) || item).filter((item) => item?.id != null);
  }
  const compact = compactSpriteConfig(entry);
  return compact?.id != null ? [compact] : [];
}

function getFloorBelowSpriteLayerForTile(tileIndex) {
  if (tileIndex == null) return [];
  const sourceData = getCurrentRoom()?.file?.data || {};
  const tileCount = getRoomDataTileCount(sourceData) || getMapTileCount();
  const floorBelowLayer = normalizeIndexedRoomLayer(
    baseFloorBelowSnapshot ?? sourceData.floorBelowTiles,
    tileCount
  );
  return normalizeSpriteLayerConfig(floorBelowLayer?.[tileIndex]);
}

function clearEditorTileDomCache() {
  editorTileDomCache.clear();
}

function refreshEditorTileDomCache() {
  editorTileDomCache.clear();
  const tileCount = getMapTileCount();
  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const entry = buildTileSessionEntry(tileIndex);
    if (entry) editorTileDomCache.set(tileIndex, entry);
  }
}

function refreshAddedSpritesTrackingForTile(tileIndex) {
  if (tileIndex == null) return;
  editorEdits.addedSprites = editorEdits.addedSprites.filter(
    (entry) => entry.tileIndex !== tileIndex || entry.sprite?.isConnected
  );
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return;
  getAllSpritesOnTile(tileEl).forEach((sprite) => {
    if (!isEditorAddedSprite(sprite)) return;
    if (!editorEdits.addedSprites.some((entry) => entry.sprite === sprite)) {
      trackAddedSprite(tileIndex, sprite);
    }
  });
}

function syncLiveTileLayerToRoom(tileIndex) {
  if (tileIndex == null) return false;
  const data = getCurrentRoom()?.file?.data;
  if (!data) return false;

  const tileCount = getMapTileCount();
  if (!Array.isArray(data.tiles)) {
    data.tiles = new Array(tileCount).fill(null).map(() => []);
  }
  while (data.tiles.length < tileCount) data.tiles.push([]);

  const visible = compactTileLayer(
    buildNativeVisibleConfigs(tileIndex, getOriginalTileLayer(tileIndex) || [])
  );
  data.tiles[tileIndex] = visible.length ? visible : [];
  return true;
}

function finalizeSandboxRoomDomState(reason = 'unknown') {
  // Room data patch lets React own native tile sprites — only reapply editor-only state.
  editorEdits.addedSprites = editorEdits.addedSprites.filter((entry) => entry.sprite?.isConnected);
  dedupeAllAddedSpriteConfigs();
  pruneGhostAddedSprites();
  reapplyAddedSpriteDomFromConfigs();
  pruneDuplicateSpritesOnAllTiles();
  reapplyHiddenSpritesToDom();
  reapplyAddedSpriteMarkersFromConfigs();
  reapplyAllTileSpriteStackOrders();
  reapplyAllAddedSpritePlacements();
  reapplyAddedFloorBelowDomFromConfigs();
}

function pruneGhostAddedSprites() {
  // Never remove React-owned native sprites. Duplicate editor clones are
  // handled by pruneDuplicateSpritesOnTile.
}

function reapplyAddedSpriteDomFromConfigs() {
  let created = 0;
  dedupeAllAddedSpriteConfigs();
  for (const [tileIndexKey, configs] of Object.entries(editorEdits.addedSpriteConfigs)) {
    const tileIndex = Number(tileIndexKey);
    if (!configs?.length) continue;
    const tileEl = getTileElement(tileIndex);
    if (!tileEl) continue;

    const pickOverlay = tileEl.querySelector(`.${PICK_OVERLAY_CLASS}`);
    for (const config of configs) {
      const compact = compactSpriteConfig(config);
      if (!compact) continue;
      if (countAddedSpritesMatchingConfigOnTile(tileEl, tileIndex, compact) > 0) continue;

      const sprite = buildSpriteElementFromConfig(compact);
      if (!sprite) continue;
      sprite.setAttribute(EDITOR_ADDED_ATTR, '1');
      applyEditorAddedSpritePlacement(sprite, compact);
      if (pickOverlay) tileEl.insertBefore(sprite, pickOverlay);
      else tileEl.appendChild(sprite);
      trackAddedSprite(tileIndex, sprite);
      created += 1;
    }
    applyTileSpriteStackOrder(tileEl, getAllSpritesOnTile(tileEl));
  }
  if (created) logMapEditor('reapplyAddedSpriteDom', { created });
}

function reapplyAddedSpriteMarkersFromConfigs() {
  let marked = 0;
  for (const [tileIndexKey, configs] of Object.entries(editorEdits.addedSpriteConfigs)) {
    const tileIndex = Number(tileIndexKey);
    if (!configs?.length) continue;
    const tileEl = getTileElement(tileIndex);
    if (!tileEl) continue;

    const sprites = getAllSpritesOnTile(tileEl);
    const usedIndexes = new Set();
    for (const config of configs) {
      const index = sprites.findIndex((sprite, spriteIndex) => {
        if (usedIndexes.has(spriteIndex)) return false;
        if (!isEditorAddedSprite(sprite)) return false;
        const spriteConfig = extractSpriteConfig(sprite);
        return spriteConfig && spriteConfigEquals(compactSpriteConfig(spriteConfig), config);
      });
      if (index < 0) continue;
      usedIndexes.add(index);
      const sprite = sprites[index];
      if (!editorEdits.addedSprites.some((entry) => entry.sprite === sprite)) {
        trackAddedSprite(tileIndex, sprite);
        marked += 1;
      }
    }
  }
  if (marked) logMapEditor('reapplyAddedSpriteMarkers', { marked });
}

function getBaseHitboxSnapshot() {
  if (baseHitboxesSnapshot) return baseHitboxesSnapshot;
  const source = getCurrentRoom()?.file?.data?.hitboxes;
  baseHitboxesSnapshot = Array.isArray(source) ? source.slice() : [];
  return baseHitboxesSnapshot;
}

function getOriginalHitbox(tileIndex) {
  const snapshot = getBaseHitboxSnapshot();
  if (tileIndex == null || tileIndex >= snapshot.length) return null;
  return snapshot[tileIndex];
}

function getOriginalActorOnTile(tileIndex) {
  const actors = baseActorsSnapshot
    ?? mapEditorTestRoomSnapshot?.entries?.[0]?.saved?.file?.data?.actors;
  if (!Array.isArray(actors) || tileIndex == null || tileIndex < 0 || tileIndex >= actors.length) {
    return null;
  }
  const actor = actors[tileIndex];
  return actor != null ? cloneJson(actor) : null;
}

function actorConfigsEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (e) {
    return false;
  }
}

function tileHasPendingEdits(tileIndex) {
  if (tileIndex == null) return false;
  if (editorEdits.hitboxOverrides[tileIndex] === true
    || editorEdits.hitboxOverrides[tileIndex] === false) {
    return true;
  }
  if ((editorEdits.addedSpriteConfigs[tileIndex] || []).length) return true;
  if ((editorEdits.addedFloorBelowConfigs[tileIndex] || []).length) return true;
  if (editorEdits.addedSprites.some((entry) => entry.tileIndex === tileIndex)) return true;
  if (editorEdits.hiddenSprites.some((entry) => entry.tileIndex === tileIndex)) return true;
  if (editorEdits.replacements.some((entry) => entry.tileIndex === tileIndex)) return true;
  if (editorPlacedVillains.has(tileIndex)) return true;
  const currentActor = getActorOnTile(tileIndex);
  const originalActor = getOriginalActorOnTile(tileIndex);
  return !actorConfigsEqual(currentActor, originalActor);
}

/** Bulk in-place DOM revert — default for restore (workshop, local save, clean map, sandbox).
 *  Per-tile resetTileEdits is only for the Reset Tile button.
 *  DOM session pipeline (never selectRoomById / reloadRoomFromGame for editor state):
 *    Load:        buildDomSessionPayload → ensureDomSessionRoom → loadDomSession
 *    Revert bulk: restoreDomEditsViaResetTiles → completeDomRestoreInPlace
 *    Per-tile:    applyTileSessionEntry / resetTileEdits
 *    Clean:       cleanMapFromEditor
 */
function restoreDomEditsViaResetTiles(restorePlan) {
  if (restorePlan?.wasMapCleaned) {
    refreshEditorAddedSpritesFromDom();
    editorState.editingSprite = null;
    editorState.editingCreatureTileIndex = null;
    clearEditorHiddenSpritesFromDom();
  }

  return restoreDomEditsFromTrace({
    ...restorePlan,
    hadSpriteEdits: restorePlan?.hadSpriteEdits || restorePlan?.wasMapCleaned === true,
    hadHitboxEdits: restorePlan?.hadHitboxEdits || restorePlan?.wasMapCleaned === true
  });
}

function resetTileEdits(tileIndex, options = {}) {
  if (tileIndex == null || !tileHasPendingEdits(tileIndex)) return false;
  if (!guardMapEditorManipulator('reset-tile', options)) return false;

  flushCreatureEditIfOpen();
  if (editorState.editingSprite?.tileIndex === tileIndex) {
    editorState.editingSprite = null;
  }
  if (editorState.editingCreatureTileIndex === tileIndex) {
    editorState.editingCreatureTileIndex = null;
  }

  let changed = false;

  for (const entry of [...editorEdits.replacements].reverse()) {
    if (entry.tileIndex !== tileIndex) continue;
    if (entry.sprite?.isConnected && !isEphemeralBattleSprite(entry.sprite)) {
      if (revertSpriteReplacement(entry)) changed = true;
    } else {
      changed = true;
    }
  }
  editorEdits.replacements = editorEdits.replacements.filter((entry) => entry.tileIndex !== tileIndex);

  for (const entry of [...editorEdits.hiddenSprites]) {
    if (entry.tileIndex !== tileIndex) continue;
    let sprite = entry.sprite;
    if (!sprite?.isConnected) {
      sprite = findSpriteOnTileByIds(tileIndex, entry.spriteIds, { onlyHidden: true })
        || findSpriteOnTileByIds(tileIndex, entry.spriteIds);
    }
    if (sprite && restoreSpriteElement(sprite, { skipThrottle: true })) changed = true;
  }
  editorEdits.hiddenSprites = editorEdits.hiddenSprites.filter((entry) => entry.tileIndex !== tileIndex);

  const tileEl = getTileElement(tileIndex);
  if (tileEl) {
    const sprites = getAllSpritesOnTile(tileEl);
    sprites.forEach((sprite) => {
      if (!isEditorAddedSprite(sprite) && !isSpriteAddedOnTile(tileIndex, sprite, sprites)) return;
      untrackAddedSpriteConfig(tileIndex, sprite, sprites);
      if (safeRemoveSpriteElement(sprite)) changed = true;
      untrackAddedSprite(sprite);
    });
  }
  editorEdits.addedSprites = editorEdits.addedSprites.filter((entry) => entry.tileIndex !== tileIndex);
  if (editorEdits.addedSpriteConfigs[tileIndex]) {
    delete editorEdits.addedSpriteConfigs[tileIndex];
    changed = true;
  }

  if (editorEdits.hitboxOverrides[tileIndex] === true
    || editorEdits.hitboxOverrides[tileIndex] === false) {
    delete editorEdits.hitboxOverrides[tileIndex];
    syncLiveRoomHitbox(tileIndex);
    changed = true;
  }

  const originalActor = getOriginalActorOnTile(tileIndex);
  const currentActor = getActorOnTile(tileIndex);
  if (originalActor) {
    if (!actorConfigsEqual(currentActor, originalActor) || editorPlacedVillains.has(tileIndex)) {
      setActorOnTile(tileIndex, originalActor, { skipNotify: true, skipBoardSync: true, skipThrottle: true });
      changed = true;
    }
  } else if (currentActor != null || editorPlacedVillains.has(tileIndex)) {
    clearActorOnTile(tileIndex, { skipNotify: true, skipBoardSync: true, skipThrottle: true });
    changed = true;
  }

  if (!changed) return false;

  syncLiveTileLayerToRoom(tileIndex);
  editorTileDomCache.delete(tileIndex);

  if (editorState.sandboxTestActive && !options.deferSandboxSync) {
    applyEditorVillainsToBoard();
    finalizeSandboxRoomDomState('tile-reset');
    syncMapEditorTestNativeRoomSnapshot();
  } else if (editorState.hitboxOverlay) {
    updateHitboxOverlay();
  }

  if (!options.silent) {
    notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
    refreshInspector();
    logMapEditor('resetTileEdits', { tileIndex });
  }
  return true;
}

function cleanMapFromEditor() {
  const room = getCurrentRoom();
  if (!room?.id) {
    setMapEditorFeedback(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), { isError: true });
    return false;
  }
  if (!guardMapEditorManipulator('clean-map')) return false;

  flushCreatureEditIfOpen();
  editorState.editingSprite = null;

  const tileCount = getMapTileCount();
  let hiddenSprites = 0;
  let removedAdded = 0;
  let hitboxesSet = 0;

  for (const entry of [...editorEdits.replacements].reverse()) {
    if (entry.sprite?.isConnected && !isEphemeralBattleSprite(entry.sprite)) {
      revertSpriteReplacement(entry);
    }
  }
  editorEdits.replacements = [];

  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const tileEl = getTileElement(tileIndex);
    if (tileEl) {
      const sprites = getAllSpritesOnTile(tileEl);
      sprites.forEach((sprite) => {
        if (isEphemeralBattleSprite(sprite)) return;
        if (isEditorAddedSprite(sprite) || isSpriteAddedOnTile(tileIndex, sprite, sprites)) {
          untrackAddedSpriteConfig(tileIndex, sprite, sprites);
          if (safeRemoveSpriteElement(sprite)) removedAdded += 1;
          untrackAddedSprite(sprite);
          return;
        }
        if (!isSpriteHidden(sprite) && hideSpriteElement(sprite, tileIndex, { silent: true })) {
          hiddenSprites += 1;
        }
      });
      applyTileSpriteStackOrder(tileEl, getAllSpritesOnTile(tileEl));
    }

    delete editorEdits.addedSpriteConfigs[tileIndex];

    if (getHitboxValue(tileIndex) !== false) {
      editorEdits.hitboxOverrides[tileIndex] = false;
      hitboxesSet += 1;
    } else {
      delete editorEdits.hitboxOverrides[tileIndex];
    }
    syncLiveRoomHitbox(tileIndex);
    syncLiveTileLayerToRoom(tileIndex);
    editorTileDomCache.delete(tileIndex);
  }

  editorEdits.addedSprites = [];

  let hiddenFloorBelow = 0;
  for (const sprite of getFloorBelowSprites()) {
    if (isSpriteHidden(sprite)) continue;
    const floorTileIndex = resolveTileIndexFromPositionedSprite(sprite);
    if (!applyHiddenSpriteVisual(sprite)) continue;
    if (floorTileIndex != null) trackHiddenSprite(floorTileIndex, sprite);
    hiddenFloorBelow += 1;
  }

  const actorsCleared = clearAllActorsFromMap({ skipNotify: true, skipBoardSync: true });
  removeAllVillainsFromBoard();
  editorEdits.mapCleaned = true;

  if (editorState.sandboxTestActive) {
    finalizeSandboxRoomDomState('clean-map');
    syncMapEditorTestNativeRoomSnapshot();
    syncMapEditorPlacementAllowSpawnMask();
  } else if (editorState.hitboxOverlay) {
    updateHitboxOverlay();
  }

  notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
  refreshInspector();
  logMapEditor('cleanMap', {
    tileCount,
    hiddenSprites,
    hiddenFloorBelow,
    removedAdded,
    hitboxesSet,
    actorsCleared
  });
  setMapEditorFeedback(
    tReplace(
      'mods.mapEditor.cleanMapOk',
      { hidden: hiddenSprites + hiddenFloorBelow, removed: removedAdded, actors: actorsCleared },
      'Map cleaned — {hidden} sprites hidden, {removed} added sprites removed, {actors} creatures removed; all tiles walkable.'
    ),
    { toastMessage: t('mods.mapEditor.toastCleanMapOk', 'Map cleaned.') }
  );
  return true;
}

/** True while the "Hide map sprites" bulk toggle is active. */
function isNativeSpritesBulkHidden() {
  return editorEdits.hiddenSprites.some((entry) => entry.bulk === true);
}

/**
 * Toggle: hide every native (non editor-added) sprite on the map — tile layer and
 * floor-below — while leaving custom/added sprites, hitboxes and creatures untouched.
 * Pressing again restores exactly the sprites this action hid.
 */
function toggleHideNativeMapSprites() {
  if (!getCurrentRoom()?.id) {
    setMapEditorFeedback(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), { isError: true });
    return false;
  }
  if (!guardMapEditorManipulator('hide-native-sprites')) return false;

  if (isNativeSpritesBulkHidden()) {
    let restored = 0;
    for (const entry of [...editorEdits.hiddenSprites].reverse()) {
      if (entry.bulk !== true) continue;
      const sprite = entry.sprite?.isConnected
        ? entry.sprite
        : (findSpriteOnTileByIds(entry.tileIndex, entry.spriteIds, { onlyHidden: true })
          || findSpriteOnTileByIds(entry.tileIndex, entry.spriteIds));
      if (sprite && restoreSpriteElement(sprite, { skipThrottle: true, silent: true })) restored += 1;
    }
    editorEdits.hiddenSprites = editorEdits.hiddenSprites.filter((entry) => entry.bulk !== true);
    notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
    refreshInspector();
    logMapEditor('showNativeMapSprites', { restored });
    setMapEditorFeedback(
      tReplace('mods.mapEditor.showNativeSpritesOk', { count: restored }, 'Restored {count} map sprites.'),
      { toastMessage: t('mods.mapEditor.toastShowNativeSpritesOk', 'Map sprites restored.') }
    );
    return true;
  }

  const markBulk = (sprite) => {
    const entry = editorEdits.hiddenSprites.find((e) => e.sprite === sprite);
    if (entry) entry.bulk = true;
  };

  let hidden = 0;
  const tileCount = getMapTileCount();
  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const tileEl = getTileElement(tileIndex);
    if (!tileEl) continue;
    const sprites = getAllSpritesOnTile(tileEl);
    sprites.forEach((sprite) => {
      if (isEphemeralBattleSprite(sprite) || isSpriteHidden(sprite)) return;
      if (isEditorAddedSprite(sprite) || isSpriteAddedOnTile(tileIndex, sprite, sprites)) return;
      if (hideSpriteElement(sprite, tileIndex, { silent: true })) {
        markBulk(sprite);
        hidden += 1;
      }
    });
  }
  for (const sprite of getFloorBelowSprites()) {
    if (isEphemeralBattleSprite(sprite) || isSpriteHidden(sprite)) continue;
    if (sprite.hasAttribute(EDITOR_FB_TILE_ATTR)) continue;
    const floorTileIndex = resolveTileIndexFromPositionedSprite(sprite);
    if (!applyHiddenSpriteVisual(sprite)) continue;
    if (floorTileIndex != null) trackHiddenSprite(floorTileIndex, sprite);
    markBulk(sprite);
    hidden += 1;
  }

  if (editorState.sandboxTestActive) {
    finalizeSandboxRoomDomState('hide-native-sprites');
    syncMapEditorTestNativeRoomSnapshot();
  }
  notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
  refreshInspector();
  logMapEditor('hideNativeMapSprites', { hidden });
  setMapEditorFeedback(
    tReplace('mods.mapEditor.hideNativeSpritesOk', { count: hidden }, 'Hid {count} map sprites (custom sprites kept).'),
    { toastMessage: t('mods.mapEditor.toastHideNativeSpritesOk', 'Map sprites hidden.') }
  );
  return true;
}

function syncLiveRoomHitbox(tileIndex) {
  if (tileIndex == null) return;
  const data = getCurrentRoom()?.file?.data;
  if (!data) return;
  const tileCount = getMapTileCount();
  if (!Array.isArray(data.hitboxes)) data.hitboxes = new Array(tileCount).fill(null);
  while (data.hitboxes.length < tileCount) data.hitboxes.push(null);
  data.hitboxes[tileIndex] = getHitboxValue(tileIndex);
}

function restoreLiveHitboxesFromSnapshot() {
  const data = getCurrentRoom()?.file?.data;
  if (!data || !baseHitboxesSnapshot) return;
  data.hitboxes = baseHitboxesSnapshot.slice();
  clearHitboxSnapshot();
}

function getHitboxValue(tileIndex) {
  if (tileIndex == null) return null;
  if (editorEdits.hitboxOverrides[tileIndex] === true || editorEdits.hitboxOverrides[tileIndex] === false) {
    return editorEdits.hitboxOverrides[tileIndex];
  }
  return getOriginalHitbox(tileIndex);
}

function setHitboxValue(tileIndex, value) {
  if (tileIndex == null || (value !== true && value !== false)) return;
  if (!guardMapEditorManipulator('set-hitbox')) return;
  const original = getOriginalHitbox(tileIndex);
  if (value === original) {
    delete editorEdits.hitboxOverrides[tileIndex];
  } else {
    editorEdits.hitboxOverrides[tileIndex] = value;
  }
  syncLiveRoomHitbox(tileIndex);
  logMapEditor('setHitbox', { tileIndex, value, overridden: value !== original });
  if (editorState.hitboxOverlay) updateHitboxOverlay();
  refreshInspector();
  notifyMapEditorEditsChanged();
  syncMapEditorPlacementAllowSpawnMask();
}

function getHitboxes() {
  // While the allow-spawn mask is active, live room.hitboxes are placement-only.
  // Prefer the combat snapshot / base so editor pushes and overlays don't bake the mask in.
  let source = null;
  if (mapEditorTestBattle?._placementHitboxMaskActive
    && Array.isArray(mapEditorTestBattle._placementHitboxSnapshot)) {
    source = mapEditorTestBattle._placementHitboxSnapshot;
  } else if (baseHitboxesSnapshot) {
    source = baseHitboxesSnapshot;
  } else {
    source = getCurrentRoom()?.file?.data?.hitboxes;
  }
  const tileCount = getMapTileCount();
  const overrideKeys = Object.keys(editorEdits.hitboxOverrides);
  if (!source && !overrideKeys.length) return null;

  const hitboxes = Array.isArray(source) ? source.slice() : new Array(tileCount).fill(null);
  while (hitboxes.length < tileCount) hitboxes.push(null);
  for (const key of overrideKeys) {
    const tileIndex = Number(key);
    const value = editorEdits.hitboxOverrides[key];
    if (Number.isFinite(tileIndex) && tileIndex >= 0 && tileIndex < tileCount) {
      hitboxes[tileIndex] = value;
    }
  }
  return hitboxes;
}

/** Mutate hitboxes in place so game drag UI refs stay in sync. */
function writeLiveRoomHitboxesInPlace(nextHitboxes) {
  if (!Array.isArray(nextHitboxes)) return false;
  const roomId = getCurrentRoom()?.id;
  const seen = new Set();
  let changed = false;
  const visit = (data) => {
    if (!data || typeof data !== 'object' || seen.has(data)) return;
    seen.add(data);
    let target = data.hitboxes;
    if (!Array.isArray(target)) {
      data.hitboxes = nextHitboxes.slice();
      changed = true;
      return;
    }
    for (let i = 0; i < nextHitboxes.length; i += 1) {
      if (target[i] !== nextHitboxes[i]) {
        target[i] = nextHitboxes[i];
        changed = true;
      }
    }
    if (target.length > nextHitboxes.length) {
      target.length = nextHitboxes.length;
      changed = true;
    }
  };
  visit(getCurrentRoom()?.file?.data);
  if (roomId) {
    for (const ref of collectRoomReferences(roomId)) {
      visit(ref?.file?.data);
    }
  }
  if (changed) mapEditorTestBattle?.bumpSelectedRoomFileIdentity?.();
  return seen.size > 0;
}

function normalizeAllowedPlacementTiles(tiles) {
  if (!Array.isArray(tiles) || !tiles.length) return [];
  const seen = new Set();
  const out = [];
  tiles.forEach((raw) => {
    const tileIndex = Math.floor(Number(raw));
    if (!Number.isFinite(tileIndex) || tileIndex < 0 || seen.has(tileIndex)) return;
    seen.add(tileIndex);
    out.push(tileIndex);
  });
  out.sort((a, b) => a - b);
  return out;
}

function getAllowedPlacementTiles() {
  return normalizeAllowedPlacementTiles(editorBattleRules.allowedPlacementTiles);
}

function setAllowedPlacementTiles(tiles, options = {}) {
  const next = normalizeAllowedPlacementTiles(tiles);
  editorBattleRules.allowedPlacementTiles = next;
  // Keep allow-spawn overlay on while tiles are marked so placement intent is visible
  // even if the native drag UI still caches walkable tiles.
  if (next.length && editorState.sandboxTestActive && !editorState.placementOverlay) {
    editorState.placementOverlay = true;
    const toggle = document.getElementById('map-editor-placement-toggle');
    if (toggle) toggle.checked = true;
  }
  if (editorState.placementOverlay) {
    const updatedInPlace = options.singleTileIndex != null
      && updatePlacementOverlayTile(options.singleTileIndex);
    if (!updatedInPlace) updatePlacementOverlay();
  }
  if (options.skipNotify !== true) {
    updateWorkshopBattleRulesControls();
    refreshInspector();
    // Deliberately not calling notifyMapEditorEditsChanged() here: allowedPlacementTiles
    // is separate from editorEdits (sprites/actors/tiles) and syncMapEditorPlacementAllowSpawnMask()
    // below already applies the mask synchronously. notifyMapEditorEditsChanged's deferred
    // rAF (completeSandboxReapplyTail) unconditionally re-runs a full-map sprite reapply
    // AND this exact mask sync a second time regardless of its skipVillainBoardResync flag —
    // measured at ~400ms of pure duplicate work per tile toggle for zero behavioral benefit.
  }
  syncMapEditorPlacementAllowSpawnMask();
  return next;
}

function isTileAllowedForPlacement(tileIndex) {
  if (tileIndex == null) return false;
  return getAllowedPlacementTiles().includes(Math.floor(tileIndex));
}

function toggleTileAllowedPlacement(tileIndex) {
  if (tileIndex == null || !Number.isFinite(tileIndex)) return false;
  if (!guardMapEditorManipulator('set-placement-tile')) return false;
  const index = Math.floor(tileIndex);
  const current = new Set(getAllowedPlacementTiles());
  const adding = !current.has(index);
  if (adding) current.add(index);
  else current.delete(index);
  setAllowedPlacementTiles([...current], { singleTileIndex: index });
  logMapEditor('togglePlacementTile', { tileIndex: index, allowed: adding });
  setStatusMessage(
    adding
      ? t('mods.mapEditor.placementTileAllowed', 'Tile {tile} allowed for ally placement.')
          .replace('{tile}', String(index))
      : t('mods.mapEditor.placementTileCleared', 'Tile {tile} removed from ally placement.')
          .replace('{tile}', String(index))
  );
  return adding;
}

function setTileAllowedPlacement(tileIndex, allowed) {
  if (tileIndex == null || !Number.isFinite(tileIndex)) return false;
  if (!guardMapEditorManipulator('set-placement-tile')) return false;
  const index = Math.floor(tileIndex);
  const current = new Set(getAllowedPlacementTiles());
  if (allowed) current.add(index);
  else current.delete(index);
  setAllowedPlacementTiles([...current], { singleTileIndex: index });
  logMapEditor('setPlacementTile', { tileIndex: index, allowed: !!allowed });
  return true;
}

function buildTileRestrictionsForExport() {
  const allowedTiles = getAllowedPlacementTiles();
  if (!allowedTiles.length) return null;
  return {
    allowedTiles,
    message: t(
      'mods.mapEditor.placementRestrictionMessage',
      'Ally creatures can only be placed on the marked tiles!'
    )
  };
}

/**
 * Same pre-battle placement mask as Custom Battles / Quests:
 * idle = allow-spawn ∪ villain tiles (battle can start);
 * ally drag = allow-spawn only (no villain highlights).
 */
function pushCombatHitboxesToLiveRoom() {
  const hitboxes = getHitboxes();
  if (!Array.isArray(hitboxes)) return false;
  return writeLiveRoomHitboxesInPlace(hitboxes);
}

function logMapEditorPlacementMaskDiagnostics(reason = 'sync') {
  try {
    const allowed = getAllowedPlacementTiles();
    const live = getCurrentRoom()?.file?.data?.hitboxes;
    const walkable = Array.isArray(live)
      ? live.reduce((count, value, index) => (value === false ? count + 1 : count), 0)
      : 0;
    const battle = mapEditorTestBattle;
    console.log('[Map Editor][PlacementMask]', {
      reason,
      sandboxActive: editorState.sandboxTestActive,
      allowedCount: allowed.length,
      allowedTiles: allowed.slice(0, 40),
      liveWalkableCount: walkable,
      allyDragMask: battle?._placementHitboxAllyDrag === true,
      battleMaskActive: battle?._placementHitboxMaskActive === true,
      ownsBoard: battle?.ownsBoardRestrictions?.(() => editorState.sandboxTestActive) === true,
      hasTileRestrictions: !!battle?.config?.tileRestrictions?.allowedTiles?.length,
      gameStarted: globalThis.state?.board?.getSnapshot?.()?.context?.gameStarted === true
    });
  } catch (error) {
    console.warn('[Map Editor][PlacementMask] diagnostics failed', error);
  }
}

function syncMapEditorPlacementAllowSpawnMask(options = {}) {
  const { reason = 'sync', log = false, allyDrag = false } = options;
  if (!editorState.sandboxTestActive || !mapEditorTestBattle) {
    if (log) logMapEditorPlacementMaskDiagnostics(`${reason}:inactive`);
    return false;
  }

  const battle = mapEditorTestBattle;
  let gameStarted = false;
  try {
    gameStarted = globalThis.state?.board?.getSnapshot?.()?.context?.gameStarted === true;
  } catch (_) {}

  if (gameStarted) {
    battle.restorePlacementHitboxes?.();
    if (log) logMapEditorPlacementMaskDiagnostics(`${reason}:game-started`);
    return false;
  }

  const restrictions = buildTileRestrictionsForExport();
  const activationCb = () => editorState.sandboxTestActive;
  const toastCb = (toastData) => {
    if (toastData?.message) setStatusMessage(toastData.message, !!toastData.isError);
  };

  if (!restrictions) {
    if (battle.config) delete battle.config.tileRestrictions;
    battle.restorePlacementHitboxes?.();
    if (log) logMapEditorPlacementMaskDiagnostics(`${reason}:no-allowed-tiles`);
    return false;
  }

  battle.config.tileRestrictions = cloneJson(restrictions);

  // Fast path while dragging: remask in place (keep combat snapshot) so villain tiles
  // drop out of walkable highlights without a full restore cycle.
  if (allyDrag === true && battle._placementHitboxMaskActive === true) {
    battle.applyPlacementHitboxMask?.({ allyDrag: true });
    if (log || reason === 'ally-drag') logMapEditorPlacementMaskDiagnostics(reason);
    return battle._placementHitboxAllyDrag === true;
  }

  // Restore any active mask, push current combat hitboxes to all room refs, then remask.
  battle.restorePlacementHitboxes?.();
  pushCombatHitboxesToLiveRoom();

  if (!battle.subscriptions?.tileRestriction) {
    battle.setupTileRestrictions?.(activationCb, toastCb);
  } else {
    battle.setupPlacementHitboxMaskHooks?.();
    battle.syncPlacementHitboxMask?.(activationCb, { allyDrag });
  }

  // Always re-apply with the requested mode — setupTileRestrictions defaults to idle
  // (villains walkable) and would otherwise leave villain highlights during ally drag.
  battle.config.tileRestrictions = cloneJson(restrictions);
  const applied = battle.applyPlacementHitboxMask?.({ allyDrag });
  if (!applied) {
    const walkable = battle.getPlacementMaskWalkableTiles?.({ allyDrag })
      || new Set(restrictions.allowedTiles);
    const combat = getHitboxes()?.slice() || [];
    let maxIndex = Math.max(combat.length - 1, 0);
    walkable.forEach((tileIndex) => {
      if (tileIndex > maxIndex) maxIndex = tileIndex;
    });
    const masked = combat.slice();
    while (masked.length <= maxIndex) masked.push(null);
    for (let i = 0; i < masked.length; i += 1) {
      masked[i] = walkable.has(i) ? false : true;
    }
    writeLiveRoomHitboxesInPlace(masked);
    battle._placementHitboxSnapshot = combat.slice();
    battle._placementHitboxMaskActive = true;
    battle._placementHitboxAllyDrag = allyDrag === true;
  }

  if (log || reason === 'ally-drag' || reason === 'ally-drag-end') {
    logMapEditorPlacementMaskDiagnostics(reason);
  }
  return battle._placementHitboxMaskActive === true
    || getAllowedPlacementTiles().every((tileIndex) => getCurrentRoom()?.file?.data?.hitboxes?.[tileIndex] === false);
}

let mapEditorAllyDragHooksAttached = false;
let mapEditorAllyDragPlacementOverlayWasOn = false;
let mapEditorAllyDragMaskLogAt = 0;
let mapEditorAllyDragEndTimer = null;

function isLikelyAllyDragSource(target) {
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest('button[aria-roledescription="draggable"]')) return true;
  if (target.closest('[class*="bestiary"]')) return true;
  if (target.closest('#bestiary, .bestiary, [data-bestiary]')) return true;
  // Creature portrait / slot in side panel (not board viewport)
  if (target.closest('.outfit') && !target.closest('#viewport, #board, #background-scene, #tile-index-')) {
    return true;
  }
  return false;
}

function handleMapEditorAllyDragStart(event) {
  if (!editorState.sandboxTestActive) return;
  if (!isLikelyAllyDragSource(event.target)) return;

  if (mapEditorAllyDragEndTimer) {
    clearTimeout(mapEditorAllyDragEndTimer);
    mapEditorAllyDragEndTimer = null;
  }

  const allowed = getAllowedPlacementTiles();
  const now = Date.now();
  const shouldLog = now - mapEditorAllyDragMaskLogAt > 400;
  if (shouldLog) {
    mapEditorAllyDragMaskLogAt = now;
    console.log('[Map Editor] Ally drag/pointer — remasking allow-spawn only (hide villain highlights)', {
      type: event.type,
      allowedCount: allowed.length,
      allowedTiles: allowed.slice()
    });
  }

  syncMapEditorPlacementAllowSpawnMask({ reason: 'ally-drag', allyDrag: true, log: shouldLog });

  // Visual fallback: show allow-spawn overlay while dragging so placement intent is obvious
  // even if the native game ignores live hitbox mutations.
  if (event.type === 'dragstart' || event.type === 'pointerdown') {
    mapEditorAllyDragPlacementOverlayWasOn = editorState.placementOverlay === true;
    if (allowed.length && !editorState.placementOverlay) {
      editorState.placementOverlay = true;
      updatePlacementOverlay();
    } else if (editorState.placementOverlay) {
      updatePlacementOverlay();
    }
  }
}

function handleMapEditorAllyDragEnd() {
  if (!editorState.sandboxTestActive) return;
  // Restore villain tiles as walkable only after drop settles (avoid accepting villain tiles).
  if (mapEditorTestBattle?._placementHitboxAllyDrag) {
    if (mapEditorAllyDragEndTimer) clearTimeout(mapEditorAllyDragEndTimer);
    mapEditorAllyDragEndTimer = setTimeout(() => {
      mapEditorAllyDragEndTimer = null;
      if (!editorState.sandboxTestActive) return;
      if (!mapEditorTestBattle?._placementHitboxAllyDrag) return;
      syncMapEditorPlacementAllowSpawnMask({ reason: 'ally-drag-end', allyDrag: false });
    }, 120);
  }
  if (!mapEditorAllyDragPlacementOverlayWasOn && editorState.placementOverlay) {
    // Only auto-hide if we turned it on for this drag.
    const toggle = document.getElementById('map-editor-placement-toggle');
    if (!toggle?.checked) {
      editorState.placementOverlay = false;
      removePlacementOverlay();
    }
  }
  mapEditorAllyDragPlacementOverlayWasOn = false;
}

function attachMapEditorAllyDragHooks() {
  if (mapEditorAllyDragHooksAttached) return;
  mapEditorAllyDragHooksAttached = true;
  // Never call preventDefault() here — passive avoids Chrome's non-passive-listener
  // violation warning for these scroll/touch-blocking-capable event types.
  document.addEventListener('dragstart', handleMapEditorAllyDragStart, { capture: true, passive: true });
  document.addEventListener('pointerdown', handleMapEditorAllyDragStart, { capture: true, passive: true });
  document.addEventListener('dragend', handleMapEditorAllyDragEnd, { capture: true, passive: true });
  document.addEventListener('pointerup', handleMapEditorAllyDragEnd, { capture: true, passive: true });
  console.log('[Map Editor] Ally drag placement-mask hooks attached');
}

function detachMapEditorAllyDragHooks() {
  if (!mapEditorAllyDragHooksAttached) return;
  mapEditorAllyDragHooksAttached = false;
  document.removeEventListener('dragstart', handleMapEditorAllyDragStart, true);
  document.removeEventListener('pointerdown', handleMapEditorAllyDragStart, true);
  document.removeEventListener('dragend', handleMapEditorAllyDragEnd, true);
  document.removeEventListener('pointerup', handleMapEditorAllyDragEnd, true);
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
  if (entry.offsetX) parts.push(`offsetX ${entry.offsetX}`);
  if (entry.offsetY) parts.push(`offsetY ${entry.offsetY}`);
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

function isEphemeralBattleSprite(spriteEl) {
  if (!spriteEl?.classList?.contains('sprite')) return false;
  if (isEditorAddedSprite(spriteEl)) return false;
  if (spriteEl.closest('#actors')) return true;
  if (spriteEl.closest('button[aria-roledescription="draggable"]')) return true;

  const pointerEvents = spriteEl.style.pointerEvents
    || spriteEl.style.getPropertyValue?.('pointer-events');
  if (pointerEvents !== 'none') return false;

  const opacityRaw = spriteEl.style.opacity || spriteEl.style.getPropertyValue?.('opacity');
  if (opacityRaw !== '') {
    const opacity = Number(opacityRaw);
    if (Number.isFinite(opacity) && opacity < 1) return true;
  }

  const animationComposition = spriteEl.style.animationComposition
    || spriteEl.style.getPropertyValue?.('animation-composition');
  return animationComposition === 'accumulate';
}

function removeEphemeralSpritesFromTiles() {
  let removed = 0;
  for (const tileEl of getActiveTileElements()) {
    for (const sprite of tileEl.querySelectorAll('.sprite')) {
      if (!isEphemeralBattleSprite(sprite)) continue;
      try {
        sprite.remove();
        removed += 1;
      } catch (e) {
        // ignore
      }
    }
  }
  if (removed) logMapEditor('removeEphemeralSprites', { removed });
  return removed;
}

function getSpritesOnTile(tileEl) {
  if (!tileEl) return [];
  return Array.from(tileEl.querySelectorAll('.sprite')).filter((el) => {
    if (el.hasAttribute(HIDDEN_ATTR)) return false;
    if (isEphemeralBattleSprite(el)) return false;
    return true;
  });
}

function getAllSpritesOnTile(tileEl) {
  if (!tileEl) return [];
  return Array.from(tileEl.querySelectorAll('.sprite')).filter((el) => !isEphemeralBattleSprite(el));
}

function isSpriteHidden(spriteEl) {
  return spriteEl?.hasAttribute(HIDDEN_ATTR) ?? false;
}

function parseSpriteOffsetPx(expression) {
  if (!expression) return 0;
  const trimmed = String(expression).trim();
  const calcMatch = /calc\(\s*(-?\d+(?:\.\d+)?)px\s*\*\s*var\(--zoomFactor\)\s*\)/i.exec(trimmed);
  if (calcMatch) return Number(calcMatch[1]) || 0;
  const pxMatch = /^(-?\d+(?:\.\d+)?)px$/i.exec(trimmed);
  if (pxMatch) return Number(pxMatch[1]) || 0;
  return 0;
}

function formatSpriteOffsetCalc(px) {
  const value = Number(px);
  if (!Number.isFinite(value) || value === 0) return '';
  const sign = value < 0 ? '-' : '';
  return `calc(${sign}${Math.abs(value)}px * var(--zoomFactor))`;
}

function applySpritePlacementToElement(spriteEl, configEntry) {
  if (!spriteEl) return;
  const offsetX = Number(configEntry?.offsetX);
  const offsetY = Number(configEntry?.offsetY);
  const right = Number.isFinite(offsetX) ? formatSpriteOffsetCalc(offsetX) : '';
  const bottom = Number.isFinite(offsetY) ? formatSpriteOffsetCalc(offsetY) : '';
  if (right) spriteEl.style.setProperty('right', right);
  else spriteEl.style.removeProperty('right');
  if (bottom) spriteEl.style.setProperty('bottom', bottom);
  else spriteEl.style.removeProperty('bottom');
}

function applyEditorAddedSpritePlacement(spriteEl, configEntry = null) {
  if (!spriteEl || !isEditorAddedSprite(spriteEl)) return;
  ['top', 'left', 'inset', 'margin-top', 'margin-left', 'transform'].forEach((prop) => {
    spriteEl.style.removeProperty(prop);
  });
  const config = configEntry || compactSpriteConfig(extractSpriteConfig(sprite));
  applySpritePlacementToElement(spriteEl, config);
}

function reapplyAllAddedSpritePlacements() {
  for (const [tileIndexKey, configs] of Object.entries(editorEdits.addedSpriteConfigs)) {
    const tileIndex = Number(tileIndexKey);
    if (!configs?.length) continue;
    const tileEl = getTileElement(tileIndex);
    if (!tileEl) continue;
    const sprites = getTileSpritesInLayerOrder(tileEl, tileIndex);
    const addedIndexes = [...getAddedSpriteInstanceIndexes(tileIndex, sprites)].sort((a, b) => a - b);
    configs.forEach((config, configIndex) => {
      const spriteIndex = addedIndexes[configIndex];
      const sprite = spriteIndex == null ? null : sprites[spriteIndex];
      if (!sprite) return;
      applyEditorAddedSpritePlacement(sprite, config);
    });
  }
}

const NATIVE_SPRITE_PLACEMENT_PROPS = ['right', 'bottom', 'top', 'left', 'inset', 'transform'];

function getNativeSpritePlacementKey(sprite) {
  const id = getSpriteIdsFromElement(sprite)[0];
  if (id == null) return null;
  const config = compactSpriteConfig(extractSpriteConfig(sprite));
  return `${id}|${config?.cropX ?? 0}|${config?.cropY ?? 0}|${config?.bank ?? ''}`;
}

function isNativeMapSprite(tileIndex, sprite, spritesOnTile = null) {
  if (!sprite || isEditorAddedSprite(sprite)) return false;
  if (isSpriteAddedOnTile(tileIndex, sprite, spritesOnTile)) return false;
  return true;
}

function clearNativeSpritePlacementCacheForTile(tileIndex) {
  const prefix = `${tileIndex}:`;
  for (const key of [...nativeSpritePlacementCache.keys()]) {
    if (String(key).startsWith(prefix)) nativeSpritePlacementCache.delete(key);
  }
}

function readNativeSpritePlacement(sprite) {
  const placement = {};
  NATIVE_SPRITE_PLACEMENT_PROPS.forEach((prop) => {
    const value = sprite.style.getPropertyValue(prop);
    if (value) placement[prop] = value;
  });
  return placement;
}

function applyNativeSpritePlacement(sprite, placement = {}) {
  for (const prop of NATIVE_SPRITE_PLACEMENT_PROPS) {
    const value = placement[prop];
    if (value) sprite.style.setProperty(prop, value);
  }
}

function captureNativeSpritePlacements(tileIndex) {
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return;
  clearNativeSpritePlacementCacheForTile(tileIndex);

  const sprites = getTileSpritesInLayerOrder(tileEl, tileIndex);
  const instanceCounts = new Map();

  sprites.forEach((sprite) => {
    if (!isNativeMapSprite(tileIndex, sprite, sprites)) return;
    const placementKey = getNativeSpritePlacementKey(sprite);
    if (placementKey == null) return;
    const instance = instanceCounts.get(placementKey) || 0;
    instanceCounts.set(placementKey, instance + 1);
    const key = `${tileIndex}:${placementKey}:${instance}`;
    nativeSpritePlacementCache.set(key, readNativeSpritePlacement(sprite));
  });
}

function captureAllNativeSpritePlacements() {
  getActiveTileElements().forEach((tileEl) => {
    const tileIndex = getTileIndexFromElement(tileEl);
    if (tileIndex != null) captureNativeSpritePlacements(tileIndex);
  });
}

function restoreNativeSpritePlacements(tileIndex) {
  const tileEl = getTileElement(tileIndex);
  if (!tileEl) return;
  const sprites = getTileSpritesInLayerOrder(tileEl, tileIndex);
  const instanceCounts = new Map();

  sprites.forEach((sprite) => {
    if (!isNativeMapSprite(tileIndex, sprite, sprites)) return;
    const placementKey = getNativeSpritePlacementKey(sprite);
    if (placementKey == null) return;
    const instance = instanceCounts.get(placementKey) || 0;
    instanceCounts.set(placementKey, instance + 1);
    const key = `${tileIndex}:${placementKey}:${instance}`;
    if (!nativeSpritePlacementCache.has(key)) return;
    applyNativeSpritePlacement(sprite, nativeSpritePlacementCache.get(key));
  });
}

function restoreAllNativeSpritePlacements() {
  getActiveTileElements().forEach((tileEl) => {
    const tileIndex = getTileIndexFromElement(tileEl);
    if (tileIndex != null) restoreNativeSpritePlacements(tileIndex);
  });
}

function getSpriteInnerHTML(spriteId) {
  return `<div class="sprite item relative id-${spriteId}"><div class="viewport"><img alt="${spriteId}" data-cropped="false" class="spritesheet" style="--cropX:0;--cropY:0"></div></div>`;
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
  if (isEditorAddedSprite(spriteEl) && !spriteEl.hasAttribute(EDITOR_FB_TILE_ATTR)) {
    // Floor-below nodes are positioned by applyEditorFloorBelowSpritePlacement()
    // (anchor calc + offset), not by the tile-relative offset scheme.
    applySpritePlacementToElement(spriteEl, configEntry);
  }
}

function isInsideMapEditorPanel(node) {
  const panel = document.getElementById(PANEL_ID);
  return Boolean(panel && node && panel.contains(node));
}

function usesPanelSpritePreview(node, options = {}) {
  if (options.panelPreview) return true;
  return isInsideMapEditorPanel(node);
}

function findSpriteReference(spriteId, configEntry, options = {}) {
  const { excludePanel = false } = options;
  if (spriteId == null) return null;
  const selector = `.sprite.item.id-${spriteId}, .sprite.relative.id-${spriteId}`;
  const collectNodes = (root) => {
    if (!root?.querySelectorAll) return [];
    return [...root.querySelectorAll(selector)].filter((node) => {
      if (excludePanel && isInsideMapEditorPanel(node)) return false;
      if (isViewportSpriteProbe(node)) return false;
      return true;
    });
  };

  let nodes = collectNodes(document.getElementById('viewport'));
  if (!nodes.length) nodes = collectNodes(document);
  if (!nodes.length) return null;

  const wantsBank = configEntry?.bank != null;
  const wantsCropX = configEntry?.cropX != null;
  const wantsCropY = configEntry?.cropY != null;
  if (wantsBank || wantsCropX || wantsCropY) {
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
  }

  return pickBestSpriteReference(nodes);
}

function isViewportSpriteProbe(node) {
  if (!node) return false;
  if (node.classList?.contains('map-editor-sprite-probe-node')) return true;
  return Boolean(node.closest?.('.map-editor-sprite-probe'));
}

function scoreSpriteReference(node) {
  if (!node || isViewportSpriteProbe(node)) return -1000;
  let score = 0;
  if (node.hasAttribute(EDITOR_ADDED_ATTR)) score += 200;
  if (node.closest?.('[id^="tile-index-"]')) score += 50;
  if (hasVisibleSpritePreview(node, true)) score += 100;
  else if (hasVisibleSpritePreview(node, false)) score += 10;
  const img = node.querySelector('img.spritesheet');
  if (getImgSourceUrl(img)) score += 80;
  const computed = getComputedStyle(node);
  if (computed.visibility === 'hidden') score -= 100;
  if (computed.opacity === '0') score -= 50;
  if (computed.left === '-9999px' || node.style.left === '-9999px') score -= 80;
  return score;
}

function pickBestSpriteReference(nodes) {
  if (!nodes?.length) return null;
  return [...nodes].sort((a, b) => scoreSpriteReference(b) - scoreSpriteReference(a))[0];
}

// Only copy static paint props. Never copy *-position — the game animates those with steps().
const PREVIEW_COPY_PROPS = [
  'background-image', 'background-size', 'background-repeat',
  'mask-image', '-webkit-mask-image',
  'mask-size', '-webkit-mask-size', 'mask-repeat', '-webkit-mask-repeat',
  'image-rendering'
];

const PREVIEW_ANIMATED_STYLE_PROPS = [
  'background-position', 'background-position-x', 'background-position-y',
  'mask-position', '-webkit-mask-position',
  'object-fit', 'object-position',
  'width', 'height', 'max-width', 'max-height',
  'animation', 'animation-name', 'animation-duration', 'animation-timing-function',
  'animation-delay', 'animation-iteration-count', 'animation-direction',
  'animation-fill-mode', 'animation-play-state'
];

function clearPreviewAnimatedInline(el) {
  if (!el?.style) return;
  PREVIEW_ANIMATED_STYLE_PROPS.forEach((prop) => el.style.removeProperty(prop));
  el.style.removeProperty('display');
  el.style.removeProperty('overflow');
  el.style.removeProperty('transform');
  el.style.removeProperty('transform-origin');
}

function clearPreviewInlinePaint(el) {
  if (!el?.style) return;
  PREVIEW_COPY_PROPS.forEach((prop) => el.style.removeProperty(prop));
  clearPreviewAnimatedInline(el);
}

function copySpritePreviewVisual(sourceEl, targetEl, options = {}) {
  const { preserveImgSrc = false, allowAnimation = false } = options;
  if (!sourceEl || !targetEl) return;
  const computed = getComputedStyle(sourceEl);
  if (allowAnimation) releaseAnimatedSpriteCascade(targetEl);
  else clearPreviewAnimatedInline(targetEl);

  const bgImage = computed.getPropertyValue('background-image');
  const hasBgImage = bgImage && bgImage !== 'none';
  const maskImage = computed.getPropertyValue('mask-image')
    || computed.getPropertyValue('-webkit-mask-image');
  const hasMask = maskImage && maskImage !== 'none';

  PREVIEW_COPY_PROPS.forEach((prop) => {
    // Skip orphan size/repeat when there is no image to paint — those freeze cascade defaults.
    if (!hasBgImage && (prop === 'background-size' || prop === 'background-repeat')) return;
    if (!hasMask && (prop === 'mask-size' || prop === '-webkit-mask-size'
      || prop === 'mask-repeat' || prop === '-webkit-mask-repeat')) return;
    if ((prop === 'mask-image' || prop === '-webkit-mask-image') && !hasMask) return;
    if (prop === 'background-image' && !hasBgImage) return;

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
  if (targetEl.tagName === 'IMG') {
    if (preserveImgSrc) {
      const src = getImgSourceUrl(sourceEl);
      if (src) targetEl.src = src;
    } else if (!getImgSourceUrl(sourceEl)) {
    targetEl.removeAttribute('src');
    }
    targetEl.style.display = '';
  }
}

const PREVIEW_STATIC_FRAME_PROPS = [
  'background-position', 'background-position-x', 'background-position-y',
  'mask-position', '-webkit-mask-position'
];

const PANEL_ANIMATION_RELEASE_PROPS = [
  ...PREVIEW_STATIC_FRAME_PROPS,
  'animation', 'animation-name', 'animation-duration', 'animation-timing-function',
  'animation-delay', 'animation-iteration-count', 'animation-direction',
  'animation-fill-mode', 'animation-play-state'
];

function releaseAnimatedSpriteCascade(el) {
  if (!el?.style) return;
  PANEL_ANIMATION_RELEASE_PROPS.forEach((prop) => el.style.removeProperty(prop));
}

function releaseAnimatedSpriteTree(spriteNode) {
  if (!spriteNode) return;
  releaseAnimatedSpriteCascade(spriteNode);
  spriteNode.querySelectorAll('*').forEach(releaseAnimatedSpriteCascade);
}

const SPRITE_PREVIEW_LAYOUT_PROPS = [
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'object-fit', 'object-position', 'transform', 'transform-origin',
  'margin-top', 'margin-left', 'top', 'left', 'right', 'bottom', 'position',
  'display', 'overflow', 'image-rendering'
];

function copyStaticSpriteFrameVisual(sourceEl, targetEl, options = {}) {
  copySpritePreviewVisual(sourceEl, targetEl, options);
  if (!sourceEl || !targetEl) return;
  const computed = getComputedStyle(sourceEl);
  PREVIEW_STATIC_FRAME_PROPS.forEach((prop) => {
    const value = computed.getPropertyValue(prop);
    if (value) targetEl.style.setProperty(prop, value);
  });
}

const SPRITE_COMPUTED_SNAPSHOT_PROPS = [
  ...PREVIEW_COPY_PROPS,
  ...PREVIEW_STATIC_FRAME_PROPS,
  ...SPRITE_PREVIEW_LAYOUT_PROPS,
  'opacity', 'filter'
];

function inlineComputedPaintSnapshot(sourceRoot, targetRoot) {
  if (!sourceRoot || !targetRoot) return;
  const sourceNodes = [sourceRoot, ...sourceRoot.querySelectorAll('*')];
  const targetNodes = [targetRoot, ...targetRoot.querySelectorAll('*')];
  const limit = Math.min(sourceNodes.length, targetNodes.length);
  for (let i = 0; i < limit; i += 1) {
    const sourceEl = sourceNodes[i];
    const targetEl = targetNodes[i];
    const computed = getComputedStyle(sourceEl);
    SPRITE_COMPUTED_SNAPSHOT_PROPS.forEach((prop) => {
      const value = computed.getPropertyValue(prop);
      if (!value || value === 'none' || value === 'initial' || value === 'auto' || value === 'normal') return;
      targetEl.style.setProperty(prop, value);
    });
    if (sourceEl.tagName === 'IMG' && targetEl.tagName === 'IMG') {
      const src = getImgSourceUrl(sourceEl);
      if (src) targetEl.src = src;
    }
  }
}

const SPRITE_CSS_SCOPE_PREFIXES = [
  '#viewport ',
  '#background-scene ',
  '#tiles ',
  '#board ',
  '[id^="tile-index-"] ',
  '.size-scaled-sprite '
];

function getImgSourceUrl(img) {
  if (!img) return null;
  const src = img.currentSrc || img.getAttribute('src');
  if (!src || src === window.location.href || src === `${window.location.href.split('#')[0]}`) return null;
  return src;
}

function hasImgSourcePaint(img) {
  if (!img) return false;
  if (!getImgSourceUrl(img)) return false;
  return img.naturalWidth > 0 || img.complete;
}

function walkSpriteCssRules(rules, spriteNeedle, out, seen) {
  if (!rules) return;
  for (const rule of rules) {
    if (rule.type === CSSRule.STYLE_RULE) {
      const selector = rule.selectorText;
      if (!selector || !selector.includes(spriteNeedle)) continue;
      const key = `${selector}|${rule.style.cssText}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ selector, cssText: rule.style.cssText });
      continue;
    }
    if (rule.cssRules) walkSpriteCssRules(rule.cssRules, spriteNeedle, out, seen);
  }
}

function collectSpriteCssRules(spriteId) {
  const needle = `id-${spriteId}`;
  const out = [];
  const seen = new Set();
  for (const sheet of [...document.styleSheets]) {
    try {
      walkSpriteCssRules(sheet.cssRules, needle, out, seen);
    } catch (e) {
      // Cross-origin stylesheets are not readable.
    }
  }
  return out;
}

function extractAnimationNames(cssText) {
  const names = new Set();
  if (!cssText) return names;
  const decls = cssText.match(/animation(?:-name)?\s*:\s*([^;]+)/gi) || [];
  decls.forEach((decl) => {
    const value = decl.replace(/^animation(?:-name)?\s*:\s*/i, '').trim();
    value.split(',').forEach((chunk) => {
      const trimmed = chunk.trim();
      if (!trimmed || trimmed === 'none' || trimmed === 'initial') return;
      const first = trimmed.split(/\s+/)[0];
      if (first) names.add(first);
    });
  });
  return names;
}

function collectKeyframeRules(animationNames) {
  const out = [];
  const seen = new Set();
  if (!animationNames?.size) return out;
  const walk = (rules) => {
    if (!rules) return;
    for (const rule of rules) {
      if (rule.type === CSSRule.KEYFRAMES_RULE) {
        if (animationNames.has(rule.name) && !seen.has(rule.name)) {
          seen.add(rule.name);
          out.push(rule.cssText);
        }
      } else if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch (e) {
      // Cross-origin stylesheets are not readable.
    }
  }
  return out;
}

function scopeSpriteSelectorForPanel(selector, panelScope) {
  return selector
    .split(',')
    .map((part) => {
      let scoped = part.trim();
      for (const prefix of SPRITE_CSS_SCOPE_PREFIXES) {
        scoped = scoped.split(prefix).join('');
      }
      scoped = scoped.replace(/\s+/g, ' ').trim();
      if (!scoped) return null;
      return `${panelScope} ${scoped}`;
    })
    .filter(Boolean)
    .join(', ');
}

function ensureSpritePreviewCssMirror(spriteId) {
  if (spriteId == null) return 0;
  const cacheKey = `map-editor-sprite-css-v2-${spriteId}`;
  if (document.getElementById(cacheKey)) {
    return Number(document.getElementById(cacheKey).dataset.ruleCount || 0);
  }

  const rules = collectSpriteCssRules(spriteId);
  if (!rules.length) return 0;

  const animationNames = new Set();
  rules.forEach(({ cssText }) => {
    extractAnimationNames(cssText).forEach((name) => animationNames.add(name));
  });
  const keyframes = collectKeyframeRules(animationNames);

  const panelScope = `#${PANEL_ID} .me-sprite-preview`;
  const style = document.createElement('style');
  style.id = cacheKey;
  style.dataset.ruleCount = String(rules.length + keyframes.length);
  const scopedRules = rules.map(({ selector, cssText }) => {
    const scoped = scopeSpriteSelectorForPanel(selector, panelScope);
    return scoped ? `${scoped} { ${cssText} }` : '';
  }).filter(Boolean);
  style.textContent = [...scopedRules, ...keyframes].join('\n');
  document.head.appendChild(style);
  return rules.length + keyframes.length;
}

function copyElementLayoutFromReference(sourceEl, targetEl, extraProps = []) {
  if (!sourceEl || !targetEl) return;
  const computed = getComputedStyle(sourceEl);
  [...SPRITE_PREVIEW_LAYOUT_PROPS, ...extraProps].forEach((prop) => {
    const value = sourceEl.style.getPropertyValue(prop) || computed.getPropertyValue(prop);
    if (!value || value === 'none' || value === 'auto' || value === 'normal') return;
    targetEl.style.setProperty(prop, value);
  });
}

function copySpriteCropFromReference(sourceImg, targetImg) {
  if (!sourceImg || !targetImg) return;
  targetImg.className = sourceImg.className || 'spritesheet';
  const computed = getComputedStyle(sourceImg);
  for (const prop of ['--cropX', '--cropY', '--bank']) {
    const value = sourceImg.style.getPropertyValue(prop) || computed.getPropertyValue(prop);
    if (value) targetImg.style.setProperty(prop, value);
  }
  const cropped = sourceImg.getAttribute('data-cropped');
  if (cropped) targetImg.setAttribute('data-cropped', cropped);
  targetImg.style.display = '';
}

function copyInitialPaintFromHost(sourceEl, targetEl) {
  if (!sourceEl || !targetEl) return;
  const computed = getComputedStyle(sourceEl);
  PREVIEW_COPY_PROPS.forEach((prop) => {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'none' && value !== 'initial') {
      targetEl.style.setProperty(prop, value);
    }
  });
  ['width', 'height', 'image-rendering'].forEach((prop) => {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'auto' && value !== '0px') {
      targetEl.style.setProperty(prop, value);
    }
  });
}

function initPanelSpritePreviewShell(panelSprite) {
  const viewport = panelSprite.querySelector('.viewport');
  const img = panelSprite.querySelector('img.spritesheet');
  if (viewport) {
    viewport.style.overflow = 'hidden';
    delete viewport.dataset.hostPaintReady;
  }
  if (img) {
    img.removeAttribute('src');
    releaseAnimatedSpriteCascade(img);
    delete img.dataset.hostPaintReady;
  }
}

function getSpritePreviewDisplaySize(previewEl) {
  return previewEl?.closest('.me-asset-card') ? ASSET_CARD_PREVIEW_SIZE : SPRITE_PREVIEW_SIZE;
}

function syncViewportHostSpriteToPanel(hostSprite, panelSprite, previewEl) {
  if (!hostSprite || !panelSprite) return;
  const hostImg = hostSprite.querySelector('img.spritesheet');
  const panelImg = panelSprite.querySelector('img.spritesheet');
  const hostViewport = hostSprite.querySelector('.viewport');
  const panelViewport = panelSprite.querySelector('.viewport');

  panelSprite.className = stripProbeClassName(hostSprite.className);

  if (hostImg && panelImg) {
    const hostImgComputed = getComputedStyle(hostImg);
    if (!panelImg.dataset.hostPaintReady) {
      copyInitialPaintFromHost(hostImg, panelImg);
      panelImg.dataset.hostPaintReady = '1';
    }
    ['width', 'height', 'max-width', 'max-height'].forEach((prop) => {
      const value = hostImgComputed.getPropertyValue(prop);
      if (value && value !== 'auto' && value !== '0px') {
        panelImg.style.setProperty(prop, value);
      }
    });
    PREVIEW_STATIC_FRAME_PROPS.forEach((prop) => {
      const value = hostImgComputed.getPropertyValue(prop);
      if (value) panelImg.style.setProperty(prop, value);
    });
    for (const prop of ['--cropX', '--cropY', '--bank']) {
      const value = hostImg.style.getPropertyValue(prop) || hostImgComputed.getPropertyValue(prop);
      if (value) panelImg.style.setProperty(prop, value);
    }
  }

  if (hostViewport && panelViewport) {
    const hostVpComputed = getComputedStyle(hostViewport);
    if (!panelViewport.dataset.hostPaintReady) {
      copyInitialPaintFromHost(hostViewport, panelViewport);
      panelViewport.dataset.hostPaintReady = '1';
    }
    ['width', 'height', 'overflow'].forEach((prop) => {
      const value = hostVpComputed.getPropertyValue(prop);
      if (value && value !== 'auto' && value !== '0px') {
        panelViewport.style.setProperty(prop, value);
      }
    });
    PREVIEW_STATIC_FRAME_PROPS.forEach((prop) => {
      const value = hostVpComputed.getPropertyValue(prop);
      if (value) panelViewport.style.setProperty(prop, value);
    });
  }

  const hostVpHeight = hostViewport
    ? parseFloat(getComputedStyle(hostViewport).height)
    : SPRITE_PREVIEW_SIZE;
  const displaySize = getSpritePreviewDisplaySize(previewEl);
  const scale = displaySize / (hostVpHeight || SPRITE_PREVIEW_SIZE);
  panelSprite.style.transform = `scale(${scale})`;
  panelSprite.style.transformOrigin = 'bottom right';
}

function createSpritePreviewHostTile(preview) {
  const root = getActiveBoardRoot();
  const tilesRoot = root?.querySelector('#tiles') || document.getElementById('tiles');
  if (!tilesRoot) return null;
  pauseSpritePreviewHostSync(preview);
  const tile = document.createElement('div');
  assetPreviewHostCounter += 1;
  tile.id = `map-editor-preview-host-${assetPreviewHostCounter}`;
  tile.className = 'map-editor-asset-preview-host';
  tile.style.cssText = 'position:absolute;left:-9999px;top:0;width:32px;height:32px;overflow:visible;pointer-events:none;opacity:0;';
  tilesRoot.appendChild(tile);
  preview.__assetPreviewHostTile = tile;
  return tile;
}

function mountSpritePreviewHost(previewEl, config) {
  const hostTile = createSpritePreviewHostTile(previewEl);
  if (!hostTile) return null;
  hostTile.replaceChildren();
  const compact = compactSpriteConfig(config) || { id: config.id };
  const wrap = document.createElement('div');
  wrap.innerHTML = getSpriteInnerHTML(config.id);
  const sprite = wrap.firstElementChild;
  if (!sprite) return null;
  applySpriteConfigToElement(sprite, compact);

  const tileHost = document.createElement('div');
  tileHost.className = 'pointer-events-none absolute size-scaled-sprite';
  tileHost.style.cssText = 'position:relative;width:32px;height:32px;';
  tileHost.appendChild(sprite);
  hostTile.appendChild(tileHost);
  return sprite;
}

function pauseSpritePreviewHostSync(preview) {
  if (!preview) return;
  if (preview.__assetPreviewRaf != null) {
    cancelAnimationFrame(preview.__assetPreviewRaf);
    preview.__assetPreviewRaf = null;
  }
  const tile = preview.__assetPreviewHostTile;
  if (tile) {
    tile.remove();
    preview.__assetPreviewHostTile = null;
  }
}

function stopSpritePreviewHostSync(preview) {
  pauseSpritePreviewHostSync(preview);
  if (!preview) return;
  delete preview.__spritePreviewConfig;
  delete preview.__assetPreviewHostPaused;
}

function stopAllSpritePreviewHostSync() {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  panel.querySelectorAll('.me-sprite-preview').forEach((preview) => stopSpritePreviewHostSync(preview));
}

function resumeSpritePreviewHostSync(preview) {
  if (!preview?.isConnected || !preview.__spritePreviewConfig) return;
  const panelSprite = preview.querySelector('.sprite');
  if (!panelSprite) return;
  const hostSprite = mountSpritePreviewHost(preview, preview.__spritePreviewConfig);
  if (!hostSprite) return;
  preview.__assetPreviewHostPaused = false;
  startSpritePreviewHostSync(preview, panelSprite, hostSprite);
}

function startSpritePreviewHostSync(preview, panelSprite, hostSprite) {
  pauseSpritePreviewHostSync(preview);
  const tick = () => {
    if (!preview.isConnected || !hostSprite.isConnected) {
      stopSpritePreviewHostSync(preview);
      return;
    }
    syncViewportHostSpriteToPanel(hostSprite, panelSprite, preview);
    preview.__assetPreviewRaf = requestAnimationFrame(tick);
  };
  preview.__assetPreviewRaf = requestAnimationFrame(tick);
}

function hydratePanelSpritePreview(previewEl, config, options = {}) {
  const { sourceSprite = null, emptyLabel = '?' } = options;
  if (!previewEl || !config?.id) return false;

  stopSpritePreviewHostSync(previewEl);
  previewEl.__spritePreviewConfig = compactSpriteConfig(config) || { id: config.id };
  previewEl.classList.remove('me-sprite-preview-id', 'me-sprite-preview-pending', 'me-sprite-preview-empty');
  previewEl.textContent = '';

  const panelSprite = buildSpriteElementFromConfig(previewEl.__spritePreviewConfig);
  if (!panelSprite) {
    previewEl.classList.add('me-sprite-preview-empty');
    previewEl.textContent = emptyLabel;
    return false;
  }

  applySpriteConfigToElement(panelSprite, previewEl.__spritePreviewConfig);
  initPanelSpritePreviewShell(panelSprite);
  previewEl.classList.add('me-sprite-preview-host-sync');
  previewEl.appendChild(panelSprite);

  const hostSprite = mountSpritePreviewHost(previewEl, previewEl.__spritePreviewConfig);
  if (hostSprite) {
    previewEl.__assetPreviewHostPaused = false;
    startSpritePreviewHostSync(previewEl, panelSprite, hostSprite);
    return true;
  }

  previewEl.classList.remove('me-sprite-preview-host-sync');
  ensureSpritePreviewCssMirror(config.id);
  hydrateSpritePreviewVisual(panelSprite, previewEl.__spritePreviewConfig, sourceSprite, { panelPreview: true });
  return hasVisibleSpritePreview(panelSprite);
}

function preparePanelSpritePreviewLayout(spriteNode) {
  if (!spriteNode) return;
  const img = spriteNode.querySelector('img.spritesheet');
  const viewport = spriteNode.querySelector('.viewport');
  releaseAnimatedSpriteTree(spriteNode);
  SPRITE_PREVIEW_LAYOUT_PROPS.forEach((prop) => spriteNode.style.removeProperty(prop));
  spriteNode.style.removeProperty('inset');
  spriteNode.style.removeProperty('z-index');
  // Editor floor-below nodes carry the game's own layout classes — neutralise them
  // so the preview lays them out like any other panel sprite.
  spriteNode.classList.remove('absolute', 'size-scaled-sprite', 'pointer-events-none');
  spriteNode.classList.add('relative');
  if (img) {
    SPRITE_PREVIEW_LAYOUT_PROPS.forEach((prop) => img.style.removeProperty(prop));
    img.removeAttribute('src');
    if (img.style.display === 'none') img.style.display = '';
  }
  if (viewport) {
    ['width', 'height', 'max-width', 'max-height', 'top', 'left', 'transform', 'inset'].forEach((prop) => {
      viewport.style.removeProperty(prop);
    });
    viewport.style.width = `${SPRITE_PREVIEW_SIZE}px`;
    viewport.style.height = `${SPRITE_PREVIEW_SIZE}px`;
    viewport.style.overflow = 'hidden';
  }
  spriteNode.style.transform = '';
  spriteNode.style.transformOrigin = '';
}

function copyImgLayoutFromReference(sourceImg, targetImg) {
  if (!sourceImg || !targetImg) return;
  const src = getImgSourceUrl(sourceImg);
  if (src) targetImg.src = src;
  targetImg.className = sourceImg.className || 'spritesheet';
  copyElementLayoutFromReference(sourceImg, targetImg);
  for (const prop of ['--cropX', '--cropY', '--bank']) {
    const value = sourceImg.style.getPropertyValue(prop) || getComputedStyle(sourceImg).getPropertyValue(prop);
    if (value) targetImg.style.setProperty(prop, value);
  }
  const cropped = sourceImg.getAttribute('data-cropped');
  if (cropped) targetImg.setAttribute('data-cropped', cropped);
  targetImg.style.display = '';
}

function copyViewportLayoutFromReference(sourceViewport, targetViewport) {
  if (!sourceViewport || !targetViewport) return;
  copyElementLayoutFromReference(sourceViewport, targetViewport);
  if (!targetViewport.style.overflow) targetViewport.style.overflow = 'hidden';
}

function sanitizePreviewSpriteLayout(spriteNode, options = {}) {
  const { fromLiveReference = false, preserveAnimation = false } = options;
  if (!spriteNode) return;
  if (!preserveAnimation) {
    spriteNode.style.transform = '';
    spriteNode.style.transformOrigin = '';
  }
  const img = spriteNode.querySelector('img.spritesheet');
  const viewport = spriteNode.querySelector('.viewport');
  if (img && !fromLiveReference) {
    clearPreviewAnimatedInline(img);
    img.removeAttribute('src');
    if (img.style.display === 'none') img.style.display = '';
  } else if (img && img.style.display === 'none') {
    img.style.display = '';
  }
  if (viewport) {
    if (!fromLiveReference) {
    clearPreviewAnimatedInline(viewport);
    viewport.style.width = `${SPRITE_PREVIEW_SIZE}px`;
    viewport.style.height = `${SPRITE_PREVIEW_SIZE}px`;
    }
    if (!viewport.style.overflow) viewport.style.overflow = 'hidden';
  }
}

function hasVisibleSpritePreview(spriteNode, requirePaint = false) {
  if (!spriteNode) return false;
  const img = spriteNode.querySelector('img.spritesheet');
  const viewport = spriteNode.querySelector('.viewport');
  if (hasImgSourcePaint(img)) return true;
  const paintTargets = [img, viewport, spriteNode];
  for (const el of paintTargets) {
    if (!el) continue;
    const style = getComputedStyle(el);
    const hasBg = style.backgroundImage && style.backgroundImage !== 'none';
    const hasMask = style.maskImage && style.maskImage !== 'none';
    if (hasBg || hasMask) return true;
  }
  if (requirePaint) return false;
  return Boolean(spriteNode.className && /\bid-\d+\b/.test(spriteNode.className));
}

function buildSpritePreviewProbeSource(spriteId, configEntry, reference) {
  if (reference) return reference;
  if (configEntry?.id) return buildSpriteElementFromConfig(configEntry);
  if (spriteId != null) return buildSpriteElementFromConfig({ id: spriteId });
  return null;
}

function applyNativeItemSpriteMarkup(spriteNode, spriteId) {
  const id = Number(spriteId);
  if (!spriteNode || !Number.isFinite(id)) return;
  const viewport = spriteNode.querySelector('.viewport');
  const img = spriteNode.querySelector('img.spritesheet');

  spriteNode.className = `sprite item relative id-${id}`;
  if (img) clearPreviewInlinePaint(img);
  if (viewport) clearPreviewInlinePaint(viewport);
  sanitizePreviewSpriteLayout(spriteNode);

  if (img) {
    img.alt = String(id);
    img.className = 'spritesheet';
    img.setAttribute('data-cropped', 'false');
    img.removeAttribute('src');
    img.style.setProperty('--cropX', '0');
    img.style.setProperty('--cropY', '0');
  }
  if (viewport) {
    viewport.className = 'viewport';
  }
}

function getViewportProbeTile() {
  const root = getActiveBoardRoot();
  const tilesRoot = root?.querySelector('#tiles') || document.getElementById('tiles');
  if (!tilesRoot) return null;
  return Array.from(tilesRoot.querySelectorAll('[id^="tile-index-"]')).find(isRealMapTileElement) || null;
}

function mountViewportSpriteProbe(probeSource, configEntry = null) {
  if (!probeSource) return null;

  const probe = probeSource.cloneNode(true);
  if (configEntry) applySpriteConfigToElement(probe, configEntry);
  probe.classList.add('map-editor-sprite-probe-node');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;opacity:0;pointer-events:none;visibility:hidden;z-index:-1;';

  const tileEl = getViewportProbeTile();
  if (tileEl) {
    tileEl.appendChild(probe);
    return {
      probeSprite: probe,
      mountContext: 'tile',
      cleanup: () => probe.remove()
    };
  }

  const viewportRoot = document.getElementById('viewport');
  if (!viewportRoot) return null;

  const holder = document.createElement('div');
  holder.className = 'map-editor-sprite-probe';
  holder.style.cssText = 'position:absolute;left:-9999px;top:0;width:64px;height:64px;overflow:visible;opacity:0;pointer-events:none;';

  const tileHost = document.createElement('div');
  tileHost.className = 'pointer-events-none absolute size-scaled-sprite';
  tileHost.style.cssText = 'position:relative;width:32px;height:32px;';

  tileHost.appendChild(probe);
  holder.appendChild(tileHost);
  viewportRoot.appendChild(holder);

  return {
    probeSprite: probe,
    mountContext: 'offscreen',
    cleanup: () => holder.remove()
  };
}

function stripProbeClassName(className) {
  return (className || '')
    .replace(/\bmap-editor-sprite-probe-node\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function copySpritePaintState(sourceSprite, targetSprite, configEntry = null, options = {}) {
  const { fromLiveReference = false, allowAnimation = false } = options;
  if (!sourceSprite || !targetSprite) return;

  const animatedPanel = allowAnimation || isInsideMapEditorPanel(targetSprite);

  const bank = sourceSprite.getAttribute('data-bank');
  if (bank) targetSprite.setAttribute('data-bank', bank);
  const bankVar = sourceSprite.style.getPropertyValue('--bank')
    || getComputedStyle(sourceSprite).getPropertyValue('--bank');
  if (bankVar) targetSprite.style.setProperty('--bank', bankVar);

  const className = stripProbeClassName(sourceSprite.className);
  if (className) targetSprite.className = className;

  const sourceImg = sourceSprite.querySelector('img.spritesheet');
  const targetImg = targetSprite.querySelector('img.spritesheet');
  const sourceViewport = sourceSprite.querySelector('.viewport');
  const targetViewport = targetSprite.querySelector('.viewport');

  if (animatedPanel) {
    if (fromLiveReference && sourceImg && targetImg) {
      copySpriteCropFromReference(sourceImg, targetImg);
    }
    preparePanelSpritePreviewLayout(targetSprite);
    if (configEntry) applySpriteConfigToElement(targetSprite, configEntry);
    return;
  }

  const visualOpts = fromLiveReference ? { preserveImgSrc: true } : {};

  copyStaticSpriteFrameVisual(sourceSprite, targetSprite, visualOpts);

  if (sourceImg && targetImg) {
    if (fromLiveReference) copyImgLayoutFromReference(sourceImg, targetImg);
    copyStaticSpriteFrameVisual(sourceImg, targetImg, visualOpts);
  }

  if (sourceViewport && targetViewport) {
    if (fromLiveReference) copyViewportLayoutFromReference(sourceViewport, targetViewport);
    copyStaticSpriteFrameVisual(sourceViewport, targetViewport, visualOpts);
  }

  if (fromLiveReference) inlineComputedPaintSnapshot(sourceSprite, targetSprite);

  sanitizePreviewSpriteLayout(targetSprite, { fromLiveReference });
  if (configEntry) applySpriteConfigToElement(targetSprite, configEntry);
}

function hydrateFromViewportProbe(targetSprite, probeSource, options = {}) {
  if (!targetSprite || !probeSource) return false;
  const panelPreview = usesPanelSpritePreview(targetSprite, options);

  if (probeSource.isConnected && !isViewportSpriteProbe(probeSource)) {
    copySpritePaintState(probeSource, targetSprite, null, {
      fromLiveReference: true,
      allowAnimation: panelPreview
    });
  return hasVisibleSpritePreview(targetSprite);
}

  const mounted = mountViewportSpriteProbe(probeSource);
  if (!mounted) return false;

  const { probeSprite, cleanup } = mounted;
  copySpritePaintState(probeSprite, targetSprite, null, {
    allowAnimation: panelPreview
  });
  cleanup();
  return hasVisibleSpritePreview(targetSprite);
}

function hydrateSpritePreviewVisual(spriteNode, configEntry, sourceSpriteEl, options = {}) {
  if (!spriteNode) return;
  const panelPreview = usesPanelSpritePreview(spriteNode, options);

  const spriteId = configEntry?.id
    ?? getSpriteIdsFromElement(sourceSpriteEl)[0]
    ?? getSpriteIdsFromElement(spriteNode)[0];
  const reference = sourceSpriteEl || findSpriteReference(spriteId, configEntry);

  const probeSource = buildSpritePreviewProbeSource(spriteId, configEntry, reference);
  if (probeSource && hydrateFromViewportProbe(spriteNode, probeSource, options)) {
    if (configEntry) applySpriteConfigToElement(spriteNode, configEntry);
    if (panelPreview) preparePanelSpritePreviewLayout(spriteNode);
    if (hasVisibleSpritePreview(spriteNode)) return;
  }

  if (spriteId != null) {
    applyNativeItemSpriteMarkup(spriteNode, spriteId);
    if (configEntry) applySpriteConfigToElement(spriteNode, configEntry);
    else if (reference) {
      const refImg = reference.querySelector('img.spritesheet');
      const img = spriteNode.querySelector('img.spritesheet');
      if (img && refImg) {
        for (const prop of ['--cropX', '--cropY']) {
          const value = refImg.style.getPropertyValue(prop);
          if (value) img.style.setProperty(prop, value);
        }
        const cropped = refImg.getAttribute('data-cropped');
        if (cropped) img.setAttribute('data-cropped', cropped);
      }
      const bank = reference.getAttribute('data-bank') || reference.style.getPropertyValue('--bank');
      if (bank) {
        spriteNode.setAttribute('data-bank', bank);
        spriteNode.style.setProperty('--bank', bank);
      }
  }

    const retryProbe = buildSpritePreviewProbeSource(spriteId, configEntry, reference);
    if (retryProbe && hydrateFromViewportProbe(spriteNode, retryProbe, options)) {
    if (configEntry) applySpriteConfigToElement(spriteNode, configEntry);
      if (panelPreview) preparePanelSpritePreviewLayout(spriteNode);
      if (hasVisibleSpritePreview(spriteNode)) return;
  }
  }

  if (reference) {
    copySpritePaintState(reference, spriteNode, configEntry, {
      fromLiveReference: true,
      allowAnimation: panelPreview
    });
  }
  if (panelPreview) {
    preparePanelSpritePreviewLayout(spriteNode);
  }
}

function buildSpriteElementFromConfig(configEntry) {
  if (!configEntry?.id) return null;
  const wrap = document.createElement('div');
  wrap.innerHTML = getSpriteInnerHTML(configEntry.id);
  const sprite = wrap.firstElementChild;
  if (!sprite) return null;
  applySpriteConfigToElement(sprite, configEntry);
  applySpritePlacementToElement(sprite, configEntry);
  return sprite;
}

function normalizeSpritePreviewNode(spriteEl) {
  if (!spriteEl) return null;
  const clone = spriteEl.cloneNode(true);
  clone.style.visibility = '';
  clone.style.display = '';
  clone.style.pointerEvents = 'none';
  clone.removeAttribute(HIDDEN_ATTR);
  clone.classList.remove('map-editor-sprite-probe-node');
  clone.querySelectorAll(`.${PICK_OVERLAY_CLASS}`).forEach((el) => el.remove());

  const sourceImg = spriteEl.querySelector('img.spritesheet');
  const cloneImg = clone.querySelector('img.spritesheet');
  if (sourceImg && cloneImg) copySpriteCropFromReference(sourceImg, cloneImg);
  preparePanelSpritePreviewLayout(clone);
  return clone;
}

function createSpritePreviewBox(spriteEl, configEntry) {
  const box = document.createElement('div');
  box.className = 'me-sprite-preview';
  const spriteId = spriteEl
    ? getSpriteIdsFromElement(spriteEl)[0]
    : configEntry?.id;
  box.title = spriteId != null ? `Sprite ID ${spriteId}` : 'Sprite preview';

  const domConfig = spriteEl ? compactSpriteConfig(extractSpriteConfig(spriteEl)) : null;
  const config = domConfig
    || compactSpriteConfig(configEntry)
    || (spriteId != null ? { id: spriteId } : null);
  if (!config?.id) {
    box.classList.add('me-sprite-preview-empty');
    box.textContent = '?';
    return box;
  }

  hydratePanelSpritePreview(box, config, { sourceSprite: spriteEl });
  return box;
}

function refreshTilePreview(container, tileEl, sprites, configuredLayer, floorBelowSprites = null) {
  if (!container) return;
  container.querySelectorAll('.me-sprite-preview').forEach((preview) => stopSpritePreviewHostSync(preview));
  container.replaceChildren();

  // Mirror what is actually visible on the tile: floor-below layer first (painted
  // under), then the tile sprites, with hidden sprites left out.
  const visibleFloorBelow = (floorBelowSprites || []).filter((sprite) => !isSpriteHidden(sprite));
  const visibleSprites = (sprites || []).filter((sprite) => !isSpriteHidden(sprite));

  let sources = visibleFloorBelow.map((sprite) => ({ sprite, configEntry: null }));

  if (visibleSprites.length) {
    sources = sources.concat(visibleSprites.map((sprite) => ({ sprite, configEntry: null })));
  } else if (!sources.length) {
    sources = (configuredLayer || []).map((configEntry) => ({ sprite: null, configEntry }));
  }

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

  // Reuse the same host-synced preview boxes the sprite list uses — reliable paint
  // for added, native and floor-below sprites alike — stacked into the tile preview.
  sources.forEach(({ sprite, configEntry }, index) => {
    const box = createSpritePreviewBox(sprite, configEntry);
    box.classList.add('me-tile-preview-layer');
    box.style.zIndex = String(index + 1);
    stage.appendChild(box);
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
  notifySpriteDomEditsChanged();
  return true;
}

function addSpriteToTile(tileEl, spriteId, tileIndex = null, configEntry = null) {
  if (!tileEl) return false;
  const resolvedTileIndex = tileIndex ?? getTileIndexFromElement(tileEl);
  const config = compactSpriteConfig(configEntry) || { id: spriteId };
  if (tileHasSpriteConfig(resolvedTileIndex, config)) return false;

  const wrap = document.createElement('div');
  wrap.innerHTML = getSpriteInnerHTML(spriteId);
  if (!wrap.firstElementChild) return false;
  const sprite = wrap.firstElementChild;
  applySpriteConfigToElement(sprite, config);
  sprite.setAttribute(EDITOR_ADDED_ATTR, '1');
  applyEditorAddedSpritePlacement(sprite, config);

  const pickOverlay = tileEl.querySelector(`.${PICK_OVERLAY_CLASS}`);
  if (pickOverlay) tileEl.insertBefore(sprite, pickOverlay);
  else tileEl.appendChild(sprite);

  captureNativeSpritePlacements(resolvedTileIndex);
  applyTileSpriteStackOrder(tileEl, getAllSpritesOnTile(tileEl));
  restoreNativeSpritePlacements(resolvedTileIndex);
  applyEditorAddedSpritePlacement(sprite, config);
  trackAddedSprite(resolvedTileIndex, sprite);
  trackAddedSpriteConfig(resolvedTileIndex, config);
  syncLiveTileLayerToRoom(resolvedTileIndex);
  notifySpriteDomEditsChanged();
  refreshAssetCardPreviewForSprite(spriteId);
  return true;
}

function hideSpriteElement(spriteEl, tileIndex = null, options = {}) {
  if (!options.silent && !guardMapEditorManipulator('hide-sprite')) return false;
  if (!spriteEl || spriteEl.hasAttribute(HIDDEN_ATTR)) return false;
  if (isEphemeralBattleSprite(spriteEl)) return false;
  const resolvedTileIndex = tileIndex
    ?? getTileIndexFromElement(spriteEl)
    ?? resolveTileIndexFromPositionedSprite(spriteEl);
  applyHiddenSpriteVisual(spriteEl);
  trackHiddenSprite(resolvedTileIndex, spriteEl);
  if (!options.silent) {
  logMapEditor('hideSprite', { spriteIds: getSpriteIdsFromElement(spriteEl) });
  }
  return true;
}

function restoreSpriteElement(spriteEl, options = {}) {
  if (!options.skipThrottle && !guardMapEditorManipulator('restore-sprite')) return false;
  const resolvedTileIndex = getTileIndexFromElement(spriteEl)
    ?? resolveTileIndexFromPositionedSprite(spriteEl);
  const tracked = editorEdits.hiddenSprites.find((entry) => entry.sprite === spriteEl);
  let target = spriteEl?.isConnected ? spriteEl : null;
  if (!target) {
    const tileIndex = tracked?.tileIndex ?? resolvedTileIndex;
    const spriteIds = tracked?.spriteIds || getSpriteIdsFromElement(spriteEl);
    target = findSpriteOnTileByIds(tileIndex, spriteIds, { onlyHidden: true })
      || findSpriteOnTileByIds(tileIndex, spriteIds);
  }
  if (!target || !target.hasAttribute(HIDDEN_ATTR)) return false;
  target.style.visibility = '';
  target.style.display = '';
  target.style.pointerEvents = '';
  target.removeAttribute(HIDDEN_ATTR);
  editorEdits.hiddenSprites = editorEdits.hiddenSprites.filter((entry) => entry.sprite !== target);
  if (!options.silent) {
    logMapEditor('restoreSprite', { spriteIds: getSpriteIdsFromElement(target) });
  }
  return true;
}

function clearTileSelection() {
  document.querySelectorAll(`[${TILE_SELECT_ATTR}="1"]`).forEach((tile) => {
    tile.removeAttribute(TILE_SELECT_ATTR);
    tile.style.outline = '';
    tile.style.outlineOffset = '';
    // Undo any z-index a previous build forced onto the tile itself.
    if (tile.dataset[TILE_SELECT_PREV_Z_ATTR] !== undefined) {
      tile.style.zIndex = tile.dataset[TILE_SELECT_PREV_Z_ATTR];
      delete tile.dataset[TILE_SELECT_PREV_Z_ATTR];
    }
  });
  document.querySelectorAll(`.${TILE_SELECT_FRAME_CLASS}`).forEach((el) => el.remove());
  syncTileSelectionVisuals();
}

function getTileSelectFrameHost() {
  return getTilesContainer() || getActiveBoardRoot();
}

/**
 * Position (or remove) the single standalone selection frame over the selected
 * tile. The frame is a sibling of the tile elements so its z-index alone lifts it
 * above neighbouring tiles' sprites — no tile z-index is touched.
 */
function updateTileSelectFrame() {
  let frame = document.querySelector(`.${TILE_SELECT_FRAME_CLASS}`);
  const tileIndex = editorState.selectedTileIndex;
  const tileEl = tileIndex == null ? null : getTileElement(tileIndex);
  const host = getTileSelectFrameHost();
  const calcs = tileEl ? getElementAnchorCalcs(tileEl) : null;

  if (!host || !calcs) {
    frame?.remove();
    return;
  }

  if (!frame) {
    frame = document.createElement('div');
    frame.className = TILE_SELECT_FRAME_CLASS;
    frame.style.cssText = [
      'position:absolute',
      `width:${TILE_BOX_SIZE}`,
      `height:${TILE_BOX_SIZE}`,
      `border:${TILE_SELECT_BORDER}`,
      'box-sizing:border-box',
      'pointer-events:none',
      `z-index:${TILE_SELECT_FRAME_Z}`
    ].join(';');
  }
  frame.style.right = `calc(${calcs.right})`;
  frame.style.bottom = `calc(${calcs.bottom})`;
  if (frame.parentElement !== host) host.appendChild(frame);
}

function syncTileSelectionVisuals() {
  // Legacy cleanup: earlier builds drew the border on the pick overlay itself.
  document.querySelectorAll(`.${PICK_OVERLAY_CLASS}`).forEach((overlay) => {
    if (overlay.style.border) overlay.style.border = '';
  });
  updateTileSelectFrame();
}

function selectTile(tileIndex, options = {}) {
  if (!editorState.open || tileIndex == null) return;
  if (editorState.editingSprite && editorState.editingSprite.tileIndex !== tileIndex) {
    editorState.editingSprite = null;
  }
  if (editorState.editingCreatureTileIndex != null && editorState.editingCreatureTileIndex !== tileIndex) {
    flushCreatureEditIfOpen();
  }
  logMapEditor('tileClick', { tileIndex, roomId: getCurrentRoom()?.id || null });
  editorState.selectedTileIndex = tileIndex;
  markTileSelected(tileIndex);
  if (options.togglePlacement === true && editorState.placementOverlay) {
    toggleTileAllowedPlacement(tileIndex);
  }
  refreshInspector();
}

function isMapEditorKeyboardInputTarget(element) {
  if (!element) return false;
  const tag = element.tagName?.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (element.isContentEditable) return true;
  return Boolean(element.closest?.(`#${PANEL_ID} input, #${PANEL_ID} textarea, #${PANEL_ID} select, #${PANEL_ID} [contenteditable="true"]`));
}

function getTileIndexGridOffset(tileIndex, dCol, dRow) {
  if (tileIndex == null || !Number.isFinite(tileIndex)) return null;
  const col = tileIndex % MAP_TILE_COLUMN_COUNT;
  const row = Math.floor(tileIndex / MAP_TILE_COLUMN_COUNT);
  const nextCol = col + dCol;
  const nextRow = row + dRow;
  if (nextCol < 0 || nextCol >= MAP_TILE_COLUMN_COUNT || nextRow < 0) return null;
  const nextIndex = nextRow * MAP_TILE_COLUMN_COUNT + nextCol;
  const tileCount = getMapTileCount();
  if (tileCount > 0 && nextIndex >= tileCount) return null;
  return getTileElement(nextIndex) ? nextIndex : null;
}

function startSpriteEdit(tileIndex, fromId, layerIndex = null) {
  if (tileIndex == null || fromId == null) return;
  flushCreatureEditIfOpen();
  editorState.editingSprite = { tileIndex, fromId, layerIndex };
  refreshInspector();
}

function cancelSpriteEdit() {
  editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;
  refreshInspector();
}

function resolveSpriteAtEditableLayer(tileIndex, editableLayerIndex) {
  const tileEl = getTileElement(tileIndex);
  if (!tileEl || editableLayerIndex == null) return null;
  const editableList = getEditableTileSprites(tileIndex, tileEl);
  const sprite = editableList[editableLayerIndex];
  if (!sprite) return null;
  const fullList = getTileSpritesInLayerOrder(tileEl, tileIndex);
  const fullLayerIndex = fullList.indexOf(sprite);
  if (fullLayerIndex < 0) return null;
  return { sprite, fullLayerIndex, fullList, editableList };
}

function resolveAddedSpriteAtLayer(tileIndex, layerIndex) {
  const resolved = resolveSpriteAtEditableLayer(tileIndex, layerIndex);
  if (!resolved) return null;
  const { sprite, fullLayerIndex, fullList } = resolved;
  if (!isSpriteAddedOnTile(tileIndex, sprite, fullList)) return null;

  const addedIndexes = [...getAddedSpriteInstanceIndexes(tileIndex, fullList)].sort((a, b) => a - b);
  const slotAmongAdded = addedIndexes.indexOf(fullLayerIndex);
  if (slotAmongAdded < 0) return null;

  const configs = editorEdits.addedSpriteConfigs[tileIndex];
  if (!configs || slotAmongAdded >= configs.length) return null;
  return { sprite, configIndex: slotAmongAdded, config: configs[slotAmongAdded], fullLayerIndex };
}

const SPRITE_OFFSET_STEP_PX = 8;

function createCombinedSpriteOffsetStepper(initialX, initialY, onStep) {
  const group = document.createElement('div');
  group.className = 'me-sprite-offset-group';

  let offsetX = initialX || 0;
  let offsetY = initialY || 0;

  const labelSpan = document.createElement('span');
  labelSpan.className = 'me-sprite-offset-value';
  labelSpan.textContent = t('mods.mapEditor.spriteOffset', 'Offset');

  const minusBtn = document.createElement('button');
  minusBtn.type = 'button';
  minusBtn.className = 'me-btn me-btn-compact';
  minusBtn.textContent = '−';
  minusBtn.title = t('mods.mapEditor.spriteOffsetDecrease', 'Decrease X and Y offset by 8px');

  const plusBtn = document.createElement('button');
  plusBtn.type = 'button';
  plusBtn.className = 'me-btn me-btn-compact';
  plusBtn.textContent = '+';
  plusBtn.title = t('mods.mapEditor.spriteOffsetIncrease', 'Increase X and Y offset by 8px');

  const applyStep = (delta) => {
    offsetX += delta;
    offsetY += delta;
    onStep(offsetX, offsetY);
  };

  minusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyStep(-SPRITE_OFFSET_STEP_PX);
  });
  plusBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    applyStep(SPRITE_OFFSET_STEP_PX);
  });

  group.append(minusBtn, labelSpan, plusBtn);
  return group;
}

/**
 * Floor picker for an editor-added sprite: "Floor 0 (main)" plus "Floor -1" … "Floor -9".
 * `currentDepth` is 0 for a main-layer sprite, or the floor-below depth (1..9). `onChange`
 * receives the new depth (0 = main layer).
 */
function createFloorLevelSelect(currentDepth, onChange) {
  const group = document.createElement('div');
  group.className = 'me-sprite-offset-group me-floor-level-group';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'me-sprite-offset-value';
  labelSpan.textContent = t('mods.mapEditor.floorLevel', 'Floor');

  const select = document.createElement('select');
  select.className = 'me-input me-floor-level-select';
  select.title = t(
    'mods.mapEditor.floorLevelHint',
    'Floor 0 is the tile’s main sprite layer. −1 to −9 render under the walkable floor, deeper each step.'
  );
  for (let depth = 0; depth <= 9; depth += 1) {
    const opt = document.createElement('option');
    opt.value = String(depth);
    opt.textContent = depth === 0
      ? t('mods.mapEditor.floorLevelMain', 'Floor 0 (main)')
      : t('mods.mapEditor.floorLevelBelow', 'Floor -{n}').replace('{n}', String(depth));
    if (depth === currentDepth) opt.selected = true;
    select.appendChild(opt);
  }
  select.addEventListener('click', (e) => e.stopPropagation());
  select.addEventListener('change', (e) => {
    e.stopPropagation();
    onChange(Number(select.value));
  });

  group.append(labelSpan, select);
  return group;
}

function applyAddedSpriteEdit(tileIndex, layerIndex, patch = {}, options = {}) {
  const { keepEditing = false } = options;
  const resolved = resolveAddedSpriteAtLayer(tileIndex, layerIndex);
  if (!resolved) return false;

  const { sprite, configIndex } = resolved;
  const configs = editorEdits.addedSpriteConfigs[tileIndex];
  const current = configs[configIndex];
  const currentId = getSpriteIdsFromElement(sprite)[0];

  const nextPatch = { ...current };
  if (patch.id != null && Number.isFinite(patch.id)) {
    nextPatch.id = Math.floor(patch.id);
  }
  if (patch.offsetX != null && Number.isFinite(patch.offsetX)) {
    const offsetX = Math.floor(patch.offsetX);
    if (offsetX !== 0) nextPatch.offsetX = offsetX;
    else delete nextPatch.offsetX;
  }
  if (patch.offsetY != null && Number.isFinite(patch.offsetY)) {
    const offsetY = Math.floor(patch.offsetY);
    if (offsetY !== 0) nextPatch.offsetY = offsetY;
    else delete nextPatch.offsetY;
  }

  const nextConfig = compactSpriteConfig(nextPatch);
  if (!nextConfig) return false;

  const nextId = nextConfig.id;
  if (nextId != null && nextId !== currentId) {
    sprite.classList.remove(`id-${currentId}`);
    sprite.classList.add(`id-${nextId}`);
    const img = sprite.querySelector('img');
    if (img) {
      img.alt = String(nextId);
      if (nextConfig.cropX == null && nextConfig.cropY == null && !nextConfig.cropped) {
        img.setAttribute('data-cropped', 'false');
        img.style.setProperty('--cropX', '0');
        img.style.setProperty('--cropY', '0');
      }
    }
  }

  configs[configIndex] = nextConfig;
  applySpriteConfigToElement(sprite, nextConfig);
  applyEditorAddedSpritePlacement(sprite, nextConfig);
  syncLiveTileLayerToRoom(tileIndex);
  notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
  if (!keepEditing) {
    editorState.editingSprite = null;
    editorState.editingCreatureTileIndex = null;
  }
  return true;
}

function applySpriteEdit(tileIndex, fromId, toId, layerIndex = null, offsetPatch = {}) {
  const resolvedLayerIndex = layerIndex ?? editorState.editingSprite?.layerIndex;
  const isAddedEdit = resolvedLayerIndex != null
    && resolveAddedSpriteAtLayer(tileIndex, resolvedLayerIndex);

  if (isAddedEdit) {
    const patch = { ...offsetPatch };
    if (Number.isFinite(toId)) patch.id = toId;
    const ok = applyAddedSpriteEdit(tileIndex, resolvedLayerIndex, patch);
    logMapEditor('addedSpriteEditApply', { tileIndex, layerIndex: resolvedLayerIndex, patch, ok });
    setStatusMessage(
      ok
        ? t('mods.mapEditor.addedSpriteEditOk', 'Updated custom sprite.')
        : t('mods.mapEditor.addedSpriteEditFail', 'Could not update custom sprite.'),
      !ok
    );
    refreshInspector();
    return;
  }

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
  editorState.editingCreatureTileIndex = null;
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

// ---------------------------------------------------------------------------
// Move editor-added sprites between a tile's main layer and its floor-below layer
// ---------------------------------------------------------------------------

function getAddedFloorBelowConfigs(tileIndex) {
  return editorEdits.addedFloorBelowConfigs[tileIndex] || null;
}

function refreshFloorBelowTileCaches(tileIndex) {
  refreshAddedSpritesTrackingForTile(tileIndex);
  const entry = buildTileSessionEntry(tileIndex);
  if (entry) editorTileDomCache.set(tileIndex, entry);
  else editorTileDomCache.delete(tileIndex);
}

function startFloorBelowSpriteEdit(tileIndex, fromId, fbIndex) {
  if (tileIndex == null || fbIndex == null) return;
  flushCreatureEditIfOpen();
  editorState.editingSprite = { tileIndex, fromId, fbIndex, floorBelow: true };
  refreshInspector();
}

/** Main layer → floor-below. `layerIndex` is the editable-layer index of the added sprite. */
/** Drop every editor floor-below node for a tile and rebuild from configs (1:1, ordered). */
function rebuildEditorFloorBelowNodesForTile(tileIndex) {
  getEditorFloorBelowNodesForTile(tileIndex).forEach((node) => safeRemoveSpriteElement(node));
  const configs = getAddedFloorBelowConfigs(tileIndex) || [];
  configs.forEach((config, i) => buildEditorFloorBelowSpriteNode(tileIndex, config, i));
}

function moveAddedSpriteToFloorBelow(tileIndex, layerIndex, floorDepth = 1) {
  const resolved = resolveAddedSpriteAtLayer(tileIndex, layerIndex);
  if (!resolved) return false;

  const { sprite, configIndex } = resolved;
  const configs = editorEdits.addedSpriteConfigs[tileIndex];
  if (!configs || configIndex < 0 || configIndex >= configs.length) return false;

  const [config] = configs.splice(configIndex, 1);
  if (!configs.length) delete editorEdits.addedSpriteConfigs[tileIndex];

  const compact = compactSpriteConfig(config)
    || (getSpriteIdsFromElement(sprite)[0] != null ? { id: getSpriteIdsFromElement(sprite)[0] } : null);
  safeRemoveSpriteElement(sprite);
  untrackAddedSprite(sprite);
  if (!compact) {
    syncLiveTileLayerToRoom(tileIndex);
    return false;
  }

  if (!editorEdits.addedFloorBelowConfigs[tileIndex]) {
    editorEdits.addedFloorBelowConfigs[tileIndex] = [];
  }
  const placed = cloneJson(compact);
  const depth = clampFloorDepth(floorDepth);
  if (depth > 1) placed.floor = depth;
  editorEdits.addedFloorBelowConfigs[tileIndex].push(placed);
  rebuildEditorFloorBelowNodesForTile(tileIndex);

  editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;

  syncLiveTileLayerToRoom(tileIndex);
  refreshFloorBelowTileCaches(tileIndex);
  logMapEditor('moveAddedSpriteToFloorBelow', { tileIndex, spriteId: compact.id, floor: depth });
  notifySpriteDomEditsChanged();
  return true;
}

/** Floor-below → main layer. `fbIndex` indexes editorEdits.addedFloorBelowConfigs[tileIndex]. */
function moveFloorBelowSpriteToMain(tileIndex, fbIndex) {
  const configs = getAddedFloorBelowConfigs(tileIndex);
  if (!configs || fbIndex < 0 || fbIndex >= configs.length) return false;

  const [config] = configs.splice(fbIndex, 1);
  if (!configs.length) delete editorEdits.addedFloorBelowConfigs[tileIndex];
  rebuildEditorFloorBelowNodesForTile(tileIndex);

  const compact = compactSpriteConfig(config);
  editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;

  if (compact) {
    const tileEl = getTileElement(tileIndex);
    const added = tileEl ? addSpriteToTile(tileEl, compact.id, tileIndex, compact) : false;
    if (!added) {
      trackAddedSpriteConfig(tileIndex, compact);
      reapplyAddedSpriteDomFromConfigs();
    }
  }

  syncLiveTileLayerToRoom(tileIndex);
  refreshFloorBelowTileCaches(tileIndex);
  logMapEditor('moveFloorBelowSpriteToMain', { tileIndex, spriteId: compact?.id });
  notifySpriteDomEditsChanged();
  return true;
}

/**
 * Reorder within the tile's floor-below stack. Same (tileIndex, fromIndex, toIndex)
 * contract as reorderTileSprites() so the shared row drag/drop can call it directly;
 * the ▲/▼ buttons pass fbIndex ± 1.
 */
function reorderFloorBelowSprite(tileIndex, fromIndex, toIndex) {
  const configs = getAddedFloorBelowConfigs(tileIndex);
  if (!configs || fromIndex === toIndex) return false;
  if (fromIndex < 0 || fromIndex >= configs.length) return false;
  const target = Math.max(0, Math.min(toIndex, configs.length - 1));
  if (target === fromIndex) return false;

  const [moved] = configs.splice(fromIndex, 1);
  configs.splice(target, 0, moved);
  rebuildEditorFloorBelowNodesForTile(tileIndex);

  if (editorState.editingSprite?.floorBelow && editorState.editingSprite.tileIndex === tileIndex) {
    editorState.editingSprite.fbIndex = target;
  }

  refreshFloorBelowTileCaches(tileIndex);
  logMapEditor('reorderFloorBelowSprite', { tileIndex, fromIndex, target });
  notifySpriteDomEditsChanged();
  return true;
}

function applyAddedFloorBelowSpriteEdit(tileIndex, fbIndex, patch = {}, options = {}) {
  const { keepEditing = false } = options;
  const configs = getAddedFloorBelowConfigs(tileIndex);
  if (!configs || fbIndex < 0 || fbIndex >= configs.length) return false;

  const current = configs[fbIndex] || {};
  const nextPatch = { ...current };
  if (patch.id != null && Number.isFinite(patch.id)) nextPatch.id = Math.floor(patch.id);
  if (patch.offsetX != null && Number.isFinite(patch.offsetX)) {
    const offsetX = Math.floor(patch.offsetX);
    if (offsetX !== 0) nextPatch.offsetX = offsetX;
    else delete nextPatch.offsetX;
  }
  if (patch.offsetY != null && Number.isFinite(patch.offsetY)) {
    const offsetY = Math.floor(patch.offsetY);
    if (offsetY !== 0) nextPatch.offsetY = offsetY;
    else delete nextPatch.offsetY;
  }

  const nextConfig = compactSpriteConfig(nextPatch);
  if (!nextConfig) return false;
  configs[fbIndex] = nextConfig;

  const node = getEditorFloorBelowNodesForTile(tileIndex)[fbIndex];
  if (node) {
    applySpriteConfigToElement(node, nextConfig);
    applyEditorFloorBelowSpritePlacement(node, tileIndex, nextConfig, fbIndex);
  }

  refreshFloorBelowTileCaches(tileIndex);
  notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
  if (!keepEditing) {
    editorState.editingSprite = null;
    editorState.editingCreatureTileIndex = null;
  }
  return true;
}

/**
 * Set the floor-below depth (1..9) of an editor-added floor-below sprite. Depth 0 is
 * handled by the caller (→ moveFloorBelowSpriteToMain). Rebuilds the node so its
 * z-index lands on the new level.
 */
function setFloorBelowSpriteDepth(tileIndex, fbIndex, floorDepth) {
  const configs = getAddedFloorBelowConfigs(tileIndex);
  if (!configs || fbIndex < 0 || fbIndex >= configs.length) return false;

  const depth = clampFloorDepth(floorDepth);
  const next = { ...configs[fbIndex] };
  if (depth > 1) next.floor = depth;
  else delete next.floor;
  configs[fbIndex] = compactSpriteConfig(next) || next;
  rebuildEditorFloorBelowNodesForTile(tileIndex);

  refreshFloorBelowTileCaches(tileIndex);
  notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
  logMapEditor('setFloorBelowSpriteDepth', { tileIndex, fbIndex, depth });
  notifySpriteDomEditsChanged();
  return true;
}

function removeAddedFloorBelowSprite(tileIndex, fbIndex) {
  const configs = getAddedFloorBelowConfigs(tileIndex);
  if (!configs || fbIndex < 0 || fbIndex >= configs.length) return false;

  const removedId = configs[fbIndex]?.id;
  configs.splice(fbIndex, 1);
  if (!configs.length) delete editorEdits.addedFloorBelowConfigs[tileIndex];
  rebuildEditorFloorBelowNodesForTile(tileIndex);

  if (editorState.editingSprite?.floorBelow
    && editorState.editingSprite.tileIndex === tileIndex) {
    editorState.editingSprite = null;
    editorState.editingCreatureTileIndex = null;
  }

  refreshFloorBelowTileCaches(tileIndex);
  logMapEditor('removeAddedFloorBelowSprite', { tileIndex, spriteId: removedId });
  notifySpriteDomEditsChanged();
  return true;
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

function getFloorBelowContainer() {
  const root = getActiveBoardRoot();
  if (root) {
    const inRoot = root.querySelector('#floor-below, [id="floor-below"]');
    if (inRoot) return inRoot;
  }
  return document.getElementById('floor-below');
}

const EDITOR_FB_CONTAINER_ATTR = 'data-map-editor-fb-container';

/**
 * Like getFloorBelowContainer(), but if the game never rendered a `#floor-below`
 * layer (room has no native floor-below sprites) create a lightweight stand-in so
 * editor-added floor-below sprites still preview. Cleaned up by revert/purge paths.
 */
function ensureFloorBelowContainer() {
  const existing = getFloorBelowContainer();
  if (existing) return existing;
  const tiles = getTilesContainer();
  const parent = tiles?.parentElement || getActiveBoardRoot();
  if (!parent) return null;
  const container = document.createElement('div');
  container.id = 'floor-below';
  container.setAttribute(EDITOR_FB_CONTAINER_ATTR, '1');
  if (tiles && tiles.parentElement === parent) parent.insertBefore(container, tiles);
  else parent.appendChild(container);
  return container;
}

function removeSyntheticFloorBelowContainer() {
  document.querySelectorAll(`[${EDITOR_FB_CONTAINER_ATTR}]`).forEach((el) => {
    if (!el.querySelector('.sprite')) {
      try { el.remove(); } catch (e) { /* ignore */ }
    }
  });
}

function resolveTileIndexFromPositionedSprite(spriteEl) {
  const calcs = getElementAnchorCalcs(spriteEl);
  if (!calcs) return null;
  return findTileIndexByAnchorCalcs(calcs.right, calcs.bottom);
}

function getFloorBelowSprites() {
  const container = getFloorBelowContainer();
  if (!container) return [];
  return Array.from(container.querySelectorAll('.sprite')).filter((el) => !isEphemeralBattleSprite(el));
}

function isEditorFloorBelowSpriteForTile(sprite, tileIndex) {
  if (!sprite?.getAttribute) return false;
  const owner = sprite.getAttribute(EDITOR_FB_TILE_ATTR);
  return owner != null && Number(owner) === Number(tileIndex);
}

function getFloorBelowSpritesForTile(tileIndex) {
  const editorOwned = getEditorFloorBelowNodesForTile(tileIndex);
  const tileEl = getTileElement(tileIndex);
  const tileCalcs = tileEl ? getTileAnchorCalcs(tileEl) : null;
  if (!tileCalcs) return editorOwned;
  const wantRight = normalizeAnchorCalc(tileCalcs.right);
  const wantBottom = normalizeAnchorCalc(tileCalcs.bottom);
  const nativeMatched = getFloorBelowSprites().filter((sprite) => {
    if (sprite.hasAttribute(EDITOR_FB_TILE_ATTR)) return false;
    const calcs = getElementAnchorCalcs(sprite);
    if (!calcs) return false;
    return normalizeAnchorCalc(calcs.right) === wantRight
      && normalizeAnchorCalc(calcs.bottom) === wantBottom;
  });
  return [...nativeMatched, ...editorOwned];
}

function getEditableFloorBelowSprites(tileIndex) {
  if (tileIndex == null) return [];
  const sprites = getFloorBelowSpritesForTile(tileIndex)
    .filter((sprite) => {
      if (isEphemeralBattleSprite(sprite)) return false;
      if (editorEdits.mapCleaned && isSpriteHidden(sprite)) return false;
      return true;
    });
  return sprites.sort((a, b) => {
    const za = Number(a.style.zIndex) || 0;
    const zb = Number(b.style.zIndex) || 0;
    if (za !== zb) return za - zb;
    return sprites.indexOf(a) - sprites.indexOf(b);
  });
}

function findFloorBelowSpriteOnTile(tileIndex, spriteIds, options = {}) {
  const { excludeHidden = false, onlyHidden = false } = options;
  if (!spriteIds?.length) return null;
  for (const sprite of getFloorBelowSpritesForTile(tileIndex)) {
    const hidden = isSpriteHidden(sprite);
    if (excludeHidden && hidden) continue;
    if (onlyHidden && !hidden) continue;
    const ids = getSpriteIdsFromElement(sprite);
    if (spriteIds.some((id) => ids.includes(id))) return sprite;
  }
  return null;
}

function resolveFloorBelowConfigForSprite(sprite, configLayer, usedIndices = null) {
  if (!sprite || !configLayer?.length) return null;
  const ids = getSpriteIdsFromElement(sprite);
  for (let index = 0; index < configLayer.length; index += 1) {
    if (usedIndices?.has(index)) continue;
    const entry = configLayer[index];
    if (entry?.id != null && ids.includes(entry.id)) {
      usedIndices?.add(index);
      return entry;
    }
  }
  const domConfig = compactSpriteConfig(extractSpriteConfig(sprite));
  if (domConfig) {
    for (let index = 0; index < configLayer.length; index += 1) {
      if (usedIndices?.has(index)) continue;
      if (spriteConfigEquals(domConfig, configLayer[index])) {
        usedIndices?.add(index);
        return configLayer[index];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Editor-added floor-below sprites. Kept only in editorEdits.addedFloorBelowConfigs
// and as #floor-below DOM nodes during a session — never written to live room data;
// merged onto the native floorBelowTiles layer only at the export boundary
// (buildTileExportEntry) and into saved sessions (buildTileSessionEntry).
// ---------------------------------------------------------------------------

/** Wrap an anchor-calc inner expression back in calc(), shifting its px term by deltaPx. */
function bumpAnchorCalcPx(inner, deltaPx) {
  const delta = Number(deltaPx) || 0;
  const raw = String(inner || '').trim();
  if (!raw) return delta ? `calc(${delta}px)` : '';
  if (!delta) return `calc(${raw})`;
  const match = /(-?\d+(?:\.\d+)?)\s*px/.exec(raw);
  if (match) {
    const next = parseFloat(match[1]) + delta;
    return `calc(${raw.slice(0, match.index)}${next}px${raw.slice(match.index + match[0].length)})`;
  }
  return `calc((${raw}) + ${delta}px)`;
}

// The game stacks floor-below sprites at zIndex = z + 10*tileIndex + floor*(-30000)
// (see the #floor-below map() in the background-scene chunk). `floor` is a positive
// depth: 1 = one level under the main floor, 9 = deepest. `stackIndex` fills the role
// of the game's per-sprite `z` for ordering within one tile+floor.
const EDITOR_FLOOR_BELOW_Z_BASE = -30000;

function editorFloorBelowZIndex(tileIndex, stackIndex, floorDepth = 1) {
  return clampFloorDepth(floorDepth) * EDITOR_FLOOR_BELOW_Z_BASE
    + 10 * (Number(tileIndex) || 0)
    + (Number(stackIndex) || 0);
}

/**
 * Position an editor floor-below sprite node exactly like the game does: a bare
 * `.sprite` in #floor-below, `absolute size-scaled-sprite`, anchored by right/bottom
 * calc copied from the owning tile (offset folded into the px term), negative zIndex.
 */
function applyEditorFloorBelowSpritePlacement(spriteEl, tileIndex, config, stackIndex = 0) {
  if (!spriteEl) return;
  spriteEl.classList.add('sprite', 'item', 'pointer-events-none', 'absolute', 'size-scaled-sprite');
  spriteEl.classList.remove('relative');
  spriteEl.style.setProperty('z-index', String(editorFloorBelowZIndex(tileIndex, stackIndex, config?.floor)));
  spriteEl.style.removeProperty('position');
  spriteEl.style.removeProperty('top');
  spriteEl.style.removeProperty('left');
  spriteEl.style.removeProperty('inset');
  spriteEl.style.removeProperty('transform');

  const tileEl = getTileElement(tileIndex);
  const calcs = tileEl ? getElementAnchorCalcs(tileEl) : null;
  if (!calcs) {
    logMapEditor('floorBelowPlacementNoAnchor', { tileIndex, hasTileEl: !!tileEl });
    return;
  }
  spriteEl.style.setProperty('right', bumpAnchorCalcPx(calcs.right, Number(config?.offsetX) || 0));
  spriteEl.style.setProperty('bottom', bumpAnchorCalcPx(calcs.bottom, Number(config?.offsetY) || 0));
}

function buildEditorFloorBelowSpriteNode(tileIndex, config, stackIndex = 0) {
  const compact = compactSpriteConfig(config);
  if (!compact) return null;
  const container = ensureFloorBelowContainer();
  if (!container) return null;
  const sprite = buildSpriteElementFromConfig(compact);
  if (!sprite) return null;
  sprite.setAttribute(EDITOR_ADDED_ATTR, '1');
  sprite.setAttribute(EDITOR_FB_TILE_ATTR, String(tileIndex));
  applyEditorFloorBelowSpritePlacement(sprite, tileIndex, compact, stackIndex);
  container.appendChild(sprite);
  return sprite;
}

function getAllEditorFloorBelowNodes() {
  return Array.from(document.querySelectorAll(`[${EDITOR_FB_TILE_ATTR}]`));
}

function getEditorFloorBelowNodesForTile(tileIndex) {
  return getAllEditorFloorBelowNodes()
    .filter((sprite) => isEditorFloorBelowSpriteForTile(sprite, tileIndex));
}

/** Re-inject editor floor-below sprite nodes after React has re-owned #floor-below. */
function reapplyAddedFloorBelowDomFromConfigs() {
  let created = 0;
  for (const [key, configs] of Object.entries(editorEdits.addedFloorBelowConfigs)) {
    const tileIndex = Number(key);
    if (!Number.isFinite(tileIndex) || !configs?.length) continue;
    const existing = getEditorFloorBelowNodesForTile(tileIndex);
    if (existing.length === configs.length) {
      existing.forEach((node, i) => applyEditorFloorBelowSpritePlacement(node, tileIndex, configs[i], i));
      continue;
    }
    existing.forEach((node) => safeRemoveSpriteElement(node));
    configs.forEach((config, i) => {
      if (buildEditorFloorBelowSpriteNode(tileIndex, config, i)) created += 1;
    });
  }
  if (created) logMapEditor('reapplyAddedFloorBelowDom', { created });
  return created;
}

function removeAllEditorFloorBelowDom() {
  let removed = 0;
  document.querySelectorAll(`[${EDITOR_FB_TILE_ATTR}]`).forEach((node) => {
    if (safeRemoveSpriteElement(node)) removed += 1;
  });
  removeSyntheticFloorBelowContainer();
  return removed;
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
  if (!editorState.open) {
  removeTilePickOverlays();
    return;
  }

  const activeTiles = new Set();
  getActiveTileElements().forEach((tileElement) => {
    const tileIndex = getTileIndexFromElement(tileElement);
    if (tileIndex == null) return;
    activeTiles.add(tileIndex);

    let overlay = tileElement.querySelector(`.${PICK_OVERLAY_CLASS}`);
    if (!overlay) {
      overlay = document.createElement('div');
    overlay.className = PICK_OVERLAY_CLASS;
    overlay.style.cssText = getTileOverlayBoxStyle([
      'pointer-events:auto',
      'cursor:crosshair',
      'z-index:10002',
      'background:transparent'
    ]);
      tileElement.appendChild(overlay);
    }
    bindPickOverlay(overlay, tileIndex);
  });

  document.querySelectorAll(`.${PICK_OVERLAY_CLASS}`).forEach((overlay) => {
    const tileIndex = Number(overlay.dataset.tileIndex);
    if (!Number.isFinite(tileIndex) || !activeTiles.has(tileIndex)) {
      overlay.remove();
    }
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
    updatePlacementOverlay();
  }, 150);
}

function isMapEditorOverlayNode(node) {
  if (node.nodeType !== 1) return true;
  return node.classList?.contains(PICK_OVERLAY_CLASS)
    || node.classList?.contains(TILE_SELECT_FRAME_CLASS)
    || node.classList?.contains(HITBOX_OVERLAY_TILE_CLASS)
    || node.classList?.contains(PLACEMENT_OVERLAY_TILE_CLASS)
    || node.classList?.contains('map-editor-asset-preview-host')
    || node.classList?.contains('map-editor-sprite-probe-node')
    || node.closest?.('.map-editor-sprite-probe');
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

function removePlacementOverlay() {
  document.querySelectorAll(`.${PLACEMENT_OVERLAY_TILE_CLASS}`).forEach((el) => el.remove());
}

function updatePlacementOverlay() {
  removePlacementOverlay();
  if (!editorState.open || !editorState.placementOverlay) return;

  const allowed = new Set(getAllowedPlacementTiles());
  let overlayCount = 0;
  getActiveTileElements().forEach((tileElement) => {
    const tileId = getTileIndexFromElement(tileElement);
    if (tileId == null) return;

    const isAllowed = allowed.has(tileId);
    const overlay = document.createElement('div');
    overlay.className = PLACEMENT_OVERLAY_TILE_CLASS;
    overlay.title = isAllowed
      ? `Tile ${tileId}: ally placement allowed`
      : `Tile ${tileId}: click to allow ally placement`;
    const bg = isAllowed ? 'rgba(64,160,255,0.45)' : 'rgba(20,20,30,0.18)';
    overlay.style.cssText = getTileOverlayBoxStyle([
      'pointer-events:none',
      `background:${bg}`,
      'z-index:9999',
      isAllowed ? 'box-shadow:inset 0 0 0 1px rgba(120,200,255,0.8)' : ''
    ].filter(Boolean));
    tileElement.appendChild(overlay);
    overlayCount += 1;
  });

  if (!overlayCount) {
    setStatusMessage(t('mods.mapEditor.placementOverlayNoTiles', 'No battlefield tiles found for placement overlay.'), true);
    editorState.placementOverlay = false;
    const toggle = document.getElementById('map-editor-placement-toggle');
    if (toggle) toggle.checked = false;
    return;
  }

  const allowedCount = allowed.size;
  setStatusMessage(
    tReplace(
      'mods.mapEditor.placementOverlayEnabled',
      { count: allowedCount },
      'Ally placement overlay on — {count} allowed tile(s). Click tiles to toggle.'
    )
  );
}

/**
 * Incremental version of updatePlacementOverlay() for a single tile toggle — the
 * full rebuild tears down and recreates an overlay <div> for every tile on the map
 * (100+ DOM nodes) when only one tile's allowed state actually changed, which was
 * a meaningful chunk of the ~300ms per-click cost. Falls back (returns false) if
 * the overlay isn't already built for this tile, e.g. it was just turned on.
 */
function updatePlacementOverlayTile(tileIndex) {
  if (!editorState.open || !editorState.placementOverlay) return false;
  const tileElement = getTileElement(tileIndex);
  const overlay = tileElement?.querySelector(`.${PLACEMENT_OVERLAY_TILE_CLASS}`);
  if (!overlay) return false;

  const allowed = new Set(getAllowedPlacementTiles());
  const isAllowed = allowed.has(tileIndex);
  overlay.title = isAllowed
    ? `Tile ${tileIndex}: ally placement allowed`
    : `Tile ${tileIndex}: click to allow ally placement`;
  const bg = isAllowed ? 'rgba(64,160,255,0.45)' : 'rgba(20,20,30,0.18)';
  overlay.style.cssText = getTileOverlayBoxStyle([
    'pointer-events:none',
    `background:${bg}`,
    'z-index:9999',
    isAllowed ? 'box-shadow:inset 0 0 0 1px rgba(120,200,255,0.8)' : ''
  ].filter(Boolean));

  setStatusMessage(
    tReplace(
      'mods.mapEditor.placementOverlayEnabled',
      { count: allowed.size },
      'Ally placement overlay on — {count} allowed tile(s). Click tiles to toggle.'
    )
  );
  return true;
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
  const offsetX = Number(entry.offsetX);
  const offsetY = Number(entry.offsetY);
  if (Number.isFinite(offsetX) && offsetX !== 0) compact.offsetX = Math.floor(offsetX);
  if (Number.isFinite(offsetY) && offsetY !== 0) compact.offsetY = Math.floor(offsetY);
  // Floor-below depth (1 = one level under the main floor, matching the game's
  // `zIndex = z + 10*tileIndex + floor*-30000`). Omitted for depth 1 / main-layer sprites.
  const floor = Math.floor(Number(entry.floor));
  if (Number.isFinite(floor) && floor > 1) compact.floor = Math.min(9, floor);
  return compact;
}

/** Clamp a floor-below depth to the editable 1..9 range. */
function clampFloorDepth(depth) {
  const d = Math.floor(Number(depth) || 1);
  return Math.max(1, Math.min(9, d));
}

function compactTileLayer(layer) {
  if (!Array.isArray(layer)) return [];
  return layer.map(compactSpriteConfig).filter(Boolean);
}

function buildTileExportEntry(tileIndex, sourceData) {
  const tileCount = getRoomDataTileCount(sourceData) || getMapTileCount();
  let sprites;
  if (baseTilesSnapshot != null) {
    sprites = buildEditedTileLayerForRoom(tileIndex);
  } else {
  const tileEl = getTileElement(tileIndex);
  const liveLayer = buildLiveTileLayer(tileEl);
  if (liveLayer.length) {
    sprites = compactTileLayer(liveLayer);
    } else if (Array.isArray(sourceData.tiles?.[tileIndex]) && sourceData.tiles[tileIndex].length) {
      sprites = compactTileLayer(sourceData.tiles[tileIndex]);
    }
  }

  const entry = {};
  if (sprites?.length) entry.sprites = sprites;

  const hitbox = getHitboxValue(tileIndex);
  if (hitbox === true || hitbox === false) entry.hitbox = hitbox;

  const actors = sourceData.actors;
  if (Array.isArray(actors) && actors[tileIndex] != null) {
    entry.actor = cloneJson(actors[tileIndex]);
  }

  const floorBelow = normalizeIndexedRoomLayer(sourceData.floorBelowTiles, tileCount);
  const addedFloorBelow = (editorEdits.addedFloorBelowConfigs[tileIndex] || [])
    .map((config) => compactSpriteConfig(config))
    .filter(Boolean);
  if (addedFloorBelow.length) {
    // Editor-added floor-below sprites are never written to live room data (kept in
    // editorEdits + DOM); merge them onto the native layer only at the export boundary.
    entry.floorBelow = [
      ...normalizeSpriteLayerConfig(floorBelow?.[tileIndex]),
      ...addedFloorBelow
    ];
  } else if (floorBelow?.[tileIndex] != null) {
    entry.floorBelow = cloneJson(floorBelow[tileIndex]);
  }

  const blockedLayer = normalizeIndexedRoomLayer(sourceData.blocked, tileCount);
  if (blockedLayer?.[tileIndex] != null) {
    entry.blocked = cloneJson(blockedLayer[tileIndex]);
  }

  const hasContent = entry.sprites?.length
    || entry.actor
    || entry.floorBelow != null
    || entry.blocked != null
    || entry.hitbox === true
    || entry.hitbox === false;

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

function getRoomDataTileCount(data) {
  if (!data) return 0;
  const fromCount = Number(data.tileCount);
  if (Number.isFinite(fromCount) && fromCount > 0) return Math.floor(fromCount);
  if (Array.isArray(data.hitboxes) && data.hitboxes.length) return data.hitboxes.length;
  if (Array.isArray(data.tiles) && data.tiles.length) return data.tiles.length;
  return 0;
}

function normalizeIndexedRoomLayer(layer, tileCount) {
  const count = Number(tileCount) || 0;
  if (!count || layer == null) return null;

  const toIndex = (key) => {
    const idx = Number(key);
    return Number.isFinite(idx) && idx >= 0 && idx < count ? Math.floor(idx) : null;
  };

  if (Array.isArray(layer)) {
    const normalized = layer.map((entry) => (entry != null ? cloneJson(entry) : null));
    while (normalized.length < count) normalized.push(null);
    if (normalized.length > count) normalized.length = count;
    return normalized;
  }

  if (layer instanceof Map) {
    const normalized = new Array(count).fill(null);
    layer.forEach((value, key) => {
      const idx = toIndex(key);
      if (idx != null && value != null) normalized[idx] = cloneJson(value);
    });
    return normalized;
  }

  if (typeof layer === 'object') {
    const normalized = new Array(count).fill(null);
    for (const [key, value] of Object.entries(layer)) {
      const idx = toIndex(key);
      if (idx != null && value != null) normalized[idx] = cloneJson(value);
    }
    return normalized;
  }

  return null;
}

function normalizeRoomActorsForGame(actors, tileCount) {
  const count = Number(tileCount) || 0;
  if (!count) return null;

  const toIndex = (key) => {
    const idx = Number(key);
    return Number.isFinite(idx) && idx >= 0 && idx < count ? Math.floor(idx) : null;
  };

  if (Array.isArray(actors)) {
    const normalized = actors.map((entry) => (entry != null ? cloneJson(entry) : null));
    while (normalized.length < count) normalized.push(null);
    if (normalized.length > count) normalized.length = count;
    return normalized;
  }

  if (actors instanceof Map) {
    const normalized = new Array(count).fill(null);
    actors.forEach((value, key) => {
      const idx = toIndex(key);
      if (idx != null && value != null) normalized[idx] = cloneJson(value);
    });
    return normalized;
  }

  if (actors && typeof actors === 'object') {
    const normalized = new Array(count).fill(null);
    for (const [key, value] of Object.entries(actors)) {
      const idx = toIndex(key);
      if (idx != null && value != null) normalized[idx] = cloneJson(value);
    }
    return normalized;
  }

  return new Array(count).fill(null);
}

function roomActorsHaveEntries(actors, tileCount) {
  const normalized = normalizeRoomActorsForGame(actors, tileCount);
  return !!normalized?.some((entry) => entry != null);
}

function serializeActorsForGameRuntime(normalizedArray) {
  return serializeIndexedLayerForGameRuntime(normalizedArray);
}

/**
 * Any tileIndex-keyed room layer (actors, floorBelowTiles, blocked, ...) must reach
 * the live game state as a sparse array (holes), never dense with literal nulls —
 * native rendering code does `layer.map(entry => ... entry.tileIndex ...)` with no
 * null guard (confirmed against the game's own "floor-below" sprite layer, which
 * crashes exactly this way when floorBelowTiles is dense-null-padded).
 */
function serializeIndexedLayerForGameRuntime(normalizedArray) {
  if (!Array.isArray(normalizedArray)) return undefined;
  if (!normalizedArray.some((entry) => entry != null)) return undefined;
  const sparse = [];
  normalizedArray.forEach((entry, tileIndex) => {
    if (entry != null) sparse[tileIndex] = cloneJson(entry);
  });
  return sparse;
}

function applySparseActorsToRoomData(data) {
  if (!data) return;
  // A room with zero actors must still end up with actors: [] here, never left
  // missing/deleted — native code (e.g. the loot-drop-rate tooltip) does an
  // unconditional `for (const a of room.file.data.actors)` and throws "not
  // iterable" the instant it renders for a room where this property is absent.
  if (data.actors == null) {
    data.actors = [];
    return;
  }
  const tileCount = getRoomDataTileCount(data);
  const normalized = normalizeRoomActorsForGame(data.actors, tileCount);
  const runtime = serializeActorsForGameRuntime(normalized);
  data.actors = runtime !== undefined ? runtime : [];
}

function applyActorsSparseToAllRoomRefs(roomId) {
  if (!roomId) return false;
  const refs = collectRoomReferences(roomId);
  if (!refs.length) return false;
  for (const room of refs) {
    if (room?.file?.data) applySparseActorsToRoomData(room.file.data);
  }
  return true;
}

function mergeIndexedRoomLayers(sourceLayer, patchLayer, tileCount, options = {}) {
  const { emptyDefault = null } = options;
  if (!tileCount) return patchLayer ?? sourceLayer;

  const merged = new Array(tileCount);
  for (let i = 0; i < tileCount; i += 1) {
    const patchEntry = Array.isArray(patchLayer) ? patchLayer[i] : undefined;
    const sourceEntry = Array.isArray(sourceLayer) ? sourceLayer[i] : undefined;

    if (patchEntry === null || patchEntry === undefined) {
      if (sourceEntry === null || sourceEntry === undefined) {
        merged[i] = emptyDefault;
      } else {
        merged[i] = cloneJson(sourceEntry);
      }
    } else {
      merged[i] = cloneJson(patchEntry);
    }
  }
  return merged;
}

function mergeNativeRoomDataPatch(sourceData, patch, tileCount) {
  const count = tileCount
    || getRoomDataTileCount(patch)
    || getRoomDataTileCount(sourceData);
  const merged = { ...cloneJson(sourceData), ...patch };

  if (!count) return merged;

  merged.tiles = mergeIndexedRoomLayers(sourceData?.tiles, patch?.tiles, count, { emptyDefault: [] });
  merged.hitboxes = mergeIndexedRoomLayers(sourceData?.hitboxes, patch?.hitboxes, count);
  merged.floorBelowTiles = mergeIndexedRoomLayers(
    sourceData?.floorBelowTiles,
    patch?.floorBelowTiles,
    count
  );
  merged.blocked = mergeIndexedRoomLayers(sourceData?.blocked, patch?.blocked, count);
  merged.tileCount = patch?.tileCount ?? count;
  return merged;
}

function getPreservedNativeRoomLayer(layerName, tileCount) {
  const snapshotData = mapEditorTestRoomSnapshot?.entries?.[0]?.saved?.file?.data;
  const candidates = [
    layerName === 'floorBelowTiles' ? baseFloorBelowSnapshot : null,
    snapshotData?.[layerName],
    getCurrentRoom()?.file?.data?.[layerName]
  ];
  for (const candidate of candidates) {
    const normalized = normalizeIndexedRoomLayer(candidate, tileCount);
    if (normalized?.some((entry) => entry != null)) return normalized;
  }
  return null;
}

function preserveNativeRoomLayersInExport(roomData, tileCount) {
  if (!roomData || !tileCount) return roomData;

  const floorBelow = getPreservedNativeRoomLayer('floorBelowTiles', tileCount);
  if (floorBelow) {
    roomData.floorBelowTiles = mergeIndexedRoomLayers(
      floorBelow,
      roomData.floorBelowTiles,
      tileCount
    );
  }

  const blocked = getPreservedNativeRoomLayer('blocked', tileCount);
  if (blocked) {
    roomData.blocked = mergeIndexedRoomLayers(blocked, roomData.blocked, tileCount);
  }

  return roomData;
}

function sanitizeRoomFileDataForRuntime(fileData, liveData = null) {
  if (!fileData || typeof fileData !== 'object') return fileData;
  const data = cloneJson(fileData);
  const tileCount = getRoomDataTileCount(liveData || data);
  if (!tileCount) return data;

  data.tileCount = tileCount;

  if (!Array.isArray(data.tiles)) {
    data.tiles = new Array(tileCount).fill(null).map(() => []);
  } else {
    while (data.tiles.length < tileCount) data.tiles.push([]);
    if (data.tiles.length > tileCount) data.tiles.length = tileCount;
  }

  if (!Array.isArray(data.hitboxes)) {
    data.hitboxes = new Array(tileCount).fill(null);
  } else {
    while (data.hitboxes.length < tileCount) data.hitboxes.push(null);
    if (data.hitboxes.length > tileCount) data.hitboxes.length = tileCount;
  }

  let normalizedFloorBelow = null;
  if (!Array.isArray(data.floorBelowTiles)) {
    const liveFloorBelow = liveData
      ? normalizeIndexedRoomLayer(liveData.floorBelowTiles, tileCount)
      : null;
    if (liveFloorBelow?.some((entry) => entry != null)) {
      normalizedFloorBelow = liveFloorBelow;
    }
  } else {
    normalizedFloorBelow = normalizeIndexedRoomLayer(data.floorBelowTiles, tileCount);
  }
  const runtimeFloorBelow = serializeIndexedLayerForGameRuntime(normalizedFloorBelow);
  // Always present as an array — never delete. Native code reads this both via
  // .map() (needs sparse, not dense-null — see serializeIndexedLayerForGameRuntime)
  // and via for-of (needs *something* iterable; a missing property throws
  // "not iterable", same failure class as the null-entry crash, opposite cause).
  data.floorBelowTiles = runtimeFloorBelow !== undefined ? runtimeFloorBelow : [];

  let normalizedBlocked = null;
  if (!Array.isArray(data.blocked)) {
    const liveBlocked = liveData
      ? normalizeIndexedRoomLayer(liveData.blocked, tileCount)
      : null;
    if (liveBlocked?.some((entry) => entry != null)) {
      normalizedBlocked = liveBlocked;
    }
  } else {
    normalizedBlocked = normalizeIndexedRoomLayer(data.blocked, tileCount);
  }
  const runtimeBlocked = serializeIndexedLayerForGameRuntime(normalizedBlocked);
  data.blocked = runtimeBlocked !== undefined ? runtimeBlocked : [];

  const fromFile = normalizeRoomActorsForGame(data.actors, tileCount);
  const fromLive = liveData ? normalizeRoomActorsForGame(liveData.actors, tileCount) : null;
  let normalizedActors = null;
  if (roomActorsHaveEntries(data.actors, tileCount)) {
    normalizedActors = fromFile;
  } else if (liveData && roomActorsHaveEntries(liveData.actors, tileCount)) {
    normalizedActors = fromLive;
  } else {
    normalizedActors = fromFile || fromLive || new Array(tileCount).fill(null);
  }

  const runtimeActors = serializeActorsForGameRuntime(normalizedActors);
  // Same rule as floorBelowTiles/blocked above: room.file.data.actors must always
  // be an array. Native code (e.g. the loot-rate tooltip) does `for (e of
  // room.file.data.actors)` unconditionally — deleting the property when a room
  // has no actors throws "actors is not iterable" the moment that component reads it.
  data.actors = runtimeActors !== undefined ? runtimeActors : [];

  return data;
}

/** Export/runtime helper: drop indexed layers that are entirely empty. */
function compactRoomFileDataForExport(fileData) {
  if (!fileData || typeof fileData !== 'object') return fileData;
  const data = cloneJson(fileData);
  const tileCount = getRoomDataTileCount(data);
  if (!tileCount) return data;

  if (!roomActorsHaveEntries(data.actors, tileCount)) delete data.actors;
  if (!normalizeIndexedRoomLayer(data.floorBelowTiles, tileCount)?.some((entry) => entry != null)) {
    delete data.floorBelowTiles;
  }
  if (!normalizeIndexedRoomLayer(data.blocked, tileCount)?.some((entry) => entry != null)) {
    delete data.blocked;
  }

  return data;
}

function cloneRoomFileForSnapshot(roomFile) {
  if (!roomFile) return null;
  const liveData = roomFile.data;
  const file = cloneJson(roomFile) || {};
  if (liveData) {
    file.data = sanitizeRoomFileDataForRuntime(file.data || {}, liveData);
  }
  if (roomFile.name != null) file.name = roomFile.name;
  return file;
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
  return getAllSpritesOnTile(tileEl).map((sprite) => extractSpriteConfig(sprite)).filter(Boolean);
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
    if (img.getAttribute('data-cropped') === 'true'
      || Number(cropX) > 0
      || Number(cropY) > 0) {
      entry.cropped = true;
    }
  }
  const bank = sprite.getAttribute('data-bank')
    || sprite.style.getPropertyValue('--bank');
  if (bank !== '' && bank != null) entry.bank = Number(bank) || bank;
  if (isEditorAddedSprite(sprite) && !sprite.hasAttribute(EDITOR_FB_TILE_ATTR)) {
    // Floor-below nodes carry a full anchor calc in right/bottom, not an offset —
    // their offset lives only in editorEdits.addedFloorBelowConfigs.
    const offsetX = parseSpriteOffsetPx(sprite.style.getPropertyValue('right'));
    const offsetY = parseSpriteOffsetPx(sprite.style.getPropertyValue('bottom'));
    if (offsetX !== 0) entry.offsetX = offsetX;
    if (offsetY !== 0) entry.offsetY = offsetY;
  }
  return entry;
}

function spriteConfigEquals(a, b) {
  if (!a || !b) return false;
  if (a.id !== b.id) return false;
  if ((a.cropX ?? 0) !== (b.cropX ?? 0)) return false;
  if ((a.cropY ?? 0) !== (b.cropY ?? 0)) return false;
  if (!!a.cropped !== !!b.cropped) return false;
  if ((a.bank ?? null) !== (b.bank ?? null)) return false;
  if ((a.offsetX ?? 0) !== (b.offsetX ?? 0)) return false;
  if ((a.offsetY ?? 0) !== (b.offsetY ?? 0)) return false;
  if ((a.floor ?? 1) !== (b.floor ?? 1)) return false;
  return true;
}

function tileSessionDiffersFromOriginal(tileIndex, sprites) {
  const original = getOriginalTileLayer(tileIndex) || [];
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

  const liveSprites = getAllSpritesOnTile(tileEl);
  const sprites = liveSprites
    .map((sprite, spriteIndex) => {
      const config = extractSpriteConfig(sprite);
      if (!config) return null;
      return {
        ...config,
        hidden: isSpriteHidden(sprite),
        added: isSpriteAddedOnTile(tileIndex, sprite, liveSprites)
      };
    })
    .filter(Boolean);

  const floorBelowAdded = (editorEdits.addedFloorBelowConfigs[tileIndex] || [])
    .map((entry) => compactSpriteConfig(entry))
    .filter(Boolean);

  const original = getOriginalTileLayer(tileIndex) || [];
  const spritesDiffer = (sprites.length || original.length)
    && tileSessionDiffersFromOriginal(tileIndex, sprites);
  if (!spritesDiffer && !floorBelowAdded.length) return null;

  const entry = { tileIndex, sprites };
  if (floorBelowAdded.length) {
    entry.floorBelow = floorBelowAdded.map((config) => cloneJson(config));
  }
  return entry;
}

function buildMapSessionActorsEntries() {
  const tileCount = getMapTileCount();
  if (!tileCount) return [];
  const normalized = normalizeRoomActorsForGame(getCurrentRoom()?.file?.data?.actors, tileCount);
  if (!normalized) return [];
  const entries = [];
  normalized.forEach((actor, tileIndex) => {
    if (actor == null) return;
    entries.push({ tileIndex, actor: cloneJson(actor) });
  });
  return entries;
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

  const battleRules = getMapEditorBattleRules();
  return {
    version: SESSION_VERSION,
    roomId: room.id,
    roomName: getRoomDisplayName(room),
    savedAt: new Date().toISOString(),
    selectedTileIndex: editorState.selectedTileIndex,
    tiles,
    hitboxOverrides: Object.keys(editorEdits.hitboxOverrides).length
      ? { ...editorEdits.hitboxOverrides }
      : undefined,
    // Full actor layer (includes removals of native creatures).
    actors: buildMapSessionActorsEntries(),
    villains: getEditorPlacedVillainsList().map((entry) => cloneJson(entry)),
    // tileIndexes among `villains` above that fight as forced allies instead of villains.
    allyTiles: Array.from(editorAlliedTiles),
    allyLimit: battleRules.allyLimit,
    allowedPlacementTiles: battleRules.allowedPlacementTiles
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

function getAutoSaveName() {
  return t('mods.mapEditor.autoSaveName', 'Auto save');
}

function isAutoSaveSessionEntry(save) {
  if (!save) return false;
  if (save[AUTO_SAVE_SESSION_FLAG] === true || save.isAutoSave === true) return true;
  return String(save.name || '').trim().toLowerCase() === getAutoSaveName().toLowerCase();
}

function buildMapSessionSaveEntry(payload, saveName, options = {}) {
  const { isAutoSave = false, existingId = null } = options;
  return {
    id: existingId || createSaveId(),
    name: saveName,
    [AUTO_SAVE_SESSION_FLAG]: isAutoSave,
    savedAt: payload.savedAt,
    selectedTileIndex: payload.selectedTileIndex,
    tiles: payload.tiles,
    hitboxOverrides: payload.hitboxOverrides,
    actors: Array.isArray(payload.actors)
      ? payload.actors.map((entry) => cloneJson(entry)).filter(Boolean)
      : [],
    villains: Array.isArray(payload.villains) ? payload.villains.map((entry) => cloneJson(entry)) : [],
    // tileIndexes among `villains` above that fight as forced allies instead of villains.
    allyTiles: Array.isArray(payload.allyTiles) ? payload.allyTiles.slice() : [],
    allyLimit: payload.allyLimit ?? null,
    allowedPlacementTiles: Array.isArray(payload.allowedPlacementTiles)
      ? normalizeAllowedPlacementTiles(payload.allowedPlacementTiles)
      : []
  };
}

function upsertMapSessionSave(payload, saveName, options = {}) {
  const { isAutoSave = false } = options;
  if (!payload?.roomId) return null;

  const store = getMapSessionStore(payload.roomId) || {
    version: SESSION_VERSION,
    roomId: payload.roomId,
    roomName: payload.roomName,
    saves: []
  };

  let existing = store.saves.find((save) => save.name.toLowerCase() === saveName.toLowerCase());
  if (isAutoSave) {
    existing = store.saves.find((save) => isAutoSaveSessionEntry(save)) || existing;
    store.saves = store.saves.filter((save) => !isAutoSaveSessionEntry(save));
  }

  const saveEntry = buildMapSessionSaveEntry(payload, saveName, {
    isAutoSave,
    existingId: existing?.id
  });

  if (existing && !isAutoSave) {
    Object.assign(existing, saveEntry);
  } else {
    store.saves.unshift(saveEntry);
  }

  store.roomName = payload.roomName;
  if (!isAutoSave) {
  store.saves.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  } else {
    const autoSave = store.saves.find((save) => save.id === saveEntry.id);
    const manualSaves = store.saves.filter((save) => !isAutoSaveSessionEntry(save));
    store.saves = autoSave ? [autoSave, ...manualSaves] : manualSaves;
  }

  if (!writeMapSessionStore(store)) return null;
  return saveEntry;
}

function autoSaveMapSessionOnClose() {
  if (!hasPendingEditorEdits()) return false;
  // Merely opening a map that already has creatures/hitboxes (nothing new touched this
  // session) satisfies hasPendingEditorEdits() too — require a handful of actual edits
  // before auto-saving so closing the panel right after opening it doesn't write a save.
  if (editorSessionChangeCount < AUTO_SAVE_MIN_CHANGES) {
    logMapEditor('autoSaveSessionSkipped', {
      reason: 'too-few-changes',
      changeCount: editorSessionChangeCount,
      required: AUTO_SAVE_MIN_CHANGES
    });
    return false;
  }

  const room = getCurrentRoom();
  if (!room?.id) return false;

  const payload = buildMapSessionSave();
  if (!payload) return false;

  const saveName = getAutoSaveName();
  const saveEntry = upsertMapSessionSave(
    { ...payload, roomId: room.id },
    saveName,
    { isAutoSave: true }
  );
  if (!saveEntry) {
    logMapEditor('autoSaveSessionFailed', { roomId: room.id });
    return false;
  }
  // Do NOT reset editorSessionChangeCount here. Auto-save fires on every panel
  // close once the session has crossed the threshold; resetting it would require
  // a fresh batch of AUTO_SAVE_MIN_CHANGES edits before the *next* close would
  // auto-save again, silently dropping small trailing edits (e.g. toggling a
  // creature's ally status right before closing) that never get persisted.

  logMapEditor('autoSaveSession', {
    roomId: room.id,
    saveId: saveEntry.id,
    tileCount: payload.tiles.length,
    hitboxOverrides: Object.keys(payload.hitboxOverrides || {}).length
  });
  return true;
}

function saveMapSession() {
  const room = getCurrentRoom();
  if (!room?.id) {
    setMapEditorFeedback(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), { isError: true });
    return false;
  }

  const payload = buildMapSessionSave();
  if (!payload) {
    setMapEditorFeedback(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), { isError: true });
    return false;
  }

  const nameInput = editorState.inspectorRoot?.querySelector('#map-editor-save-name');
  const saveName = sanitizeSaveName(nameInput?.value);
  const saveEntry = upsertMapSessionSave(
    { ...payload, roomId: room.id },
    saveName,
    { isAutoSave: false }
  );
  if (!saveEntry) {
    setMapEditorFeedback(t('mods.mapEditor.saveFailed', 'Save failed — storage may be full.'), { isError: true });
    return false;
  }
  editorSessionChangeCount = 0;

  editorState.selectedSaveId = saveEntry.id;
  editorState.selectedSaveRoomId = room.id;
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
  setMapEditorFeedback(message, {
    toastMessage: t('mods.mapEditor.toastSaveOk', 'Map saved.')
  });
  logMapEditor('saveSession', { roomId: room.id, saveId: saveEntry.id, name: saveName, tileCount: payload.tiles.length });
  return true;
}

function applyTileSessionEntry(tileState, options = {}) {
  const { fromCache = false } = options;
  const tileEl = getTileElement(tileState.tileIndex);
  if (!tileEl) return false;

  editorEdits.hiddenSprites = editorEdits.hiddenSprites.filter(
    (entry) => entry.tileIndex !== tileState.tileIndex
  );
  editorEdits.addedSprites = editorEdits.addedSprites.filter(
    (entry) => entry.tileIndex !== tileState.tileIndex
  );
  clearAddedSpriteConfigsForTile(tileState.tileIndex);
  delete editorEdits.addedFloorBelowConfigs[tileState.tileIndex];

  const pickOverlay = tileEl.querySelector(`.${PICK_OVERLAY_CLASS}`);
  getAllSpritesOnTile(tileEl).forEach((sprite) => {
    if (isEditorAddedSprite(sprite)) safeRemoveSpriteElement(sprite);
  });
  getEditorFloorBelowNodesForTile(tileState.tileIndex).forEach((node) => safeRemoveSpriteElement(node));

  const sessionSprites = tileState.sprites || [];
  sessionSprites.forEach((spriteState, spriteIndex) => {
    const { hidden, added, ...config } = spriteState;
    const isAdded = added === true
      || isLikelyAddedSprite(config, tileState.tileIndex, sessionSprites, spriteIndex);

    if (isAdded) {
    const sprite = buildSpriteElementFromConfig(config);
    if (!sprite) return;
    if (pickOverlay) tileEl.insertBefore(sprite, pickOverlay);
    else tileEl.appendChild(sprite);
      sprite.setAttribute(EDITOR_ADDED_ATTR, '1');
      trackAddedSprite(tileState.tileIndex, sprite);
      trackAddedSpriteConfig(tileState.tileIndex, config);
      if (hidden) hideSpriteElement(sprite, tileState.tileIndex, { silent: true });
      return;
    }

    if (hidden) {
      const nativeSprite = findSpriteOnTileByIds(tileState.tileIndex, [config.id], { excludeHidden: true });
      if (nativeSprite && !isEditorAddedSprite(nativeSprite)) {
        hideSpriteElement(nativeSprite, tileState.tileIndex, { silent: true });
      }
    }
  });

  const floorBelowStates = Array.isArray(tileState.floorBelow) ? tileState.floorBelow : [];
  floorBelowStates.forEach((rawConfig) => {
    const config = compactSpriteConfig(rawConfig);
    if (!config) return;
    if (!editorEdits.addedFloorBelowConfigs[tileState.tileIndex]) {
      editorEdits.addedFloorBelowConfigs[tileState.tileIndex] = [];
    }
    editorEdits.addedFloorBelowConfigs[tileState.tileIndex].push(cloneJson(config));
  });
  if (floorBelowStates.length) rebuildEditorFloorBelowNodesForTile(tileState.tileIndex);

  syncLiveTileLayerToRoom(tileState.tileIndex);
  refreshAddedSpritesTrackingForTile(tileState.tileIndex);
  applyTileSpriteStackOrder(tileEl, getAllSpritesOnTile(tileEl));
  if (!fromCache) {
    const entry = buildTileSessionEntry(tileState.tileIndex);
    if (entry) editorTileDomCache.set(tileState.tileIndex, entry);
    else editorTileDomCache.delete(tileState.tileIndex);
  }
  return true;
}

function beginDomSessionLoad(options = {}) {
  const {
    room = null,
    source = null,
    snapshotBeforeApply = false,
    resetBeforeApply = true
  } = options;
  const currentRoom = room || getCurrentRoom();
  if (!currentRoom?.id) return null;

  if (snapshotBeforeApply) {
    // Keep the editor-open original snapshot; do not overwrite it with edited actors/tiles.
    if (mapEditorTestRoomSnapshot?.roomId !== currentRoom.id
      || !mapEditorTestRoomSnapshot?.entries?.length) {
      snapshotRoomDataForTest(currentRoom.id);
    }
    captureBaseTilesSnapshot();
  }
  if (resetBeforeApply) {
  resetEditorEdits();
    clearEditorTileDomCache();
  }
  if (source) {
    mapEditorDomSessionSource = source;
    if (source === 'workshop') mapEditorDomSessionRoomId = currentRoom.id;
  }
  return currentRoom;
}

function applyDomSessionVillains(villains, options = {}) {
  const { replaceActors = false } = options;
  if (!Array.isArray(villains)) {
    editorPlacedVillains.clear();
    return;
  }

  const data = getCurrentRoom()?.file?.data;
  const tileCount = getRoomDataTileCount(data) || getMapTileCount();

  if (data) {
    if (replaceActors) {
      // Workshop / full creature lists — only saved creatures remain.
      const next = new Array(tileCount).fill(null);
      villains.forEach((villain) => {
        const tileIndex = villain?.tileIndex ?? villain?.tile;
        if (!Number.isFinite(tileIndex)) return;
        const index = Math.floor(tileIndex);
        if (index < 0 || index >= tileCount) return;
        const actorConfig = buildActorConfigFromVillainConfig(villain);
        if (actorConfig) next[index] = cloneJson(actorConfig);
      });
      const runtime = serializeActorsForGameRuntime(next);
      if (runtime !== undefined) data.actors = cloneJson(runtime);
      else delete data.actors;
    } else if (baseActorsSnapshot) {
      // Legacy overlay: start from original map actors, then apply placed creatures.
      const normalized = normalizeRoomActorsForGame(baseActorsSnapshot, tileCount);
      const runtime = serializeActorsForGameRuntime(normalized);
      if (runtime !== undefined) data.actors = cloneJson(runtime);
      else delete data.actors;
    }
  }

  editorPlacedVillains.clear();
  villains.forEach((villain) => {
    const tileIndex = villain?.tileIndex ?? villain?.tile;
    if (!Number.isFinite(tileIndex)) return;
    const index = Math.floor(tileIndex);
    const villainConfig = cloneJson(villain);
    villainConfig.tileIndex = index;
    editorPlacedVillains.set(index, villainConfig);

    if (replaceActors || !data) return;
    const actorConfig = buildActorConfigFromVillainConfig(villainConfig);
    if (!actorConfig) return;
    if (!Array.isArray(data.actors)) data.actors = [];
    data.actors[index] = cloneJson(actorConfig);
  });

  if (data) applySparseActorsToRoomData(data);
}

function applyDomSessionActors(actors, villains) {
  const data = getCurrentRoom()?.file?.data;
  if (!data) {
    applyDomSessionVillains(Array.isArray(villains) ? villains : []);
    return;
  }

  const tileCount = getRoomDataTileCount(data) || getMapTileCount();
  const next = new Array(tileCount).fill(null);
  (actors || []).forEach((entry) => {
    const tileIndex = entry?.tileIndex ?? entry?.tile;
    if (!Number.isFinite(tileIndex) || entry?.actor == null) return;
    const index = Math.floor(tileIndex);
    if (index < 0 || index >= tileCount) return;
    next[index] = cloneJson(entry.actor);
  });
  const runtime = serializeActorsForGameRuntime(next);
  if (runtime !== undefined) data.actors = cloneJson(runtime);
  else delete data.actors;
  applySparseActorsToRoomData(data);

  editorPlacedVillains.clear();
  if (!Array.isArray(villains)) return;
  villains.forEach((villain) => {
    const tileIndex = villain?.tileIndex ?? villain?.tile;
    if (!Number.isFinite(tileIndex)) return;
    const index = Math.floor(tileIndex);
    const villainConfig = cloneJson(villain);
    villainConfig.tileIndex = index;
    editorPlacedVillains.set(index, villainConfig);
  });
}

function applyDomSessionEdits(options = {}) {
  const {
    hitboxOverrides = null,
    tiles = null,
    mapEditorV2 = null,
    actors = null,
    villains = null,
    allyTileIndexes = null,
    allyLimit = null,
    allowedPlacementTiles = null,
    selectedTileIndex = null,
    source = null,
    replaceActors = false
  } = options;

  if (hitboxOverrides && typeof hitboxOverrides === 'object') {
    editorEdits.hitboxOverrides = { ...hitboxOverrides };
    for (const key of Object.keys(editorEdits.hitboxOverrides)) {
      syncLiveRoomHitbox(Number(key));
    }
  }

  let applied = 0;
  if (mapEditorV2) {
    applied = applyMapEditorV2Export(mapEditorV2);
  } else if (Array.isArray(tiles)) {
    tiles.forEach((tileState) => {
    if (applyTileSessionEntry(tileState)) applied += 1;
  });
    if (applied) refreshEditorTileDomCache();
  }

  if (Array.isArray(actors)) {
    applyDomSessionActors(actors, Array.isArray(villains) ? villains : []);
  } else if (villains != null) {
    applyDomSessionVillains(villains, {
      replaceActors: replaceActors === true || source === 'workshop'
    });
  }
  if (Array.isArray(actors) || villains != null) {
    editorAlliedTiles = new Set(
      (Array.isArray(allyTileIndexes) ? allyTileIndexes : [])
        .map((tileIndex) => Number(tileIndex))
        .filter((tileIndex) => Number.isFinite(tileIndex))
    );
  }
  if (allyLimit != null) editorBattleRules.allyLimit = allyLimit;
  if (allowedPlacementTiles != null) {
    setAllowedPlacementTiles(allowedPlacementTiles, { skipNotify: true });
  }
  syncMapEditorTestBattleConfigFromRules();

  if ((Array.isArray(actors) || villains != null) && editorState.sandboxTestActive) {
    applyEditorVillainsToBoard({ allowDuringRestore: true });
  }

  if (selectedTileIndex != null && getTileElement(selectedTileIndex)) {
    editorState.selectedTileIndex = selectedTileIndex;
    markTileSelected(selectedTileIndex);
  } else {
    editorState.selectedTileIndex = null;
    clearTileSelection();
  }

  return { applied, villainCount: editorPlacedVillains.size };
}

function finalizeDomSessionAfterApply(roomId) {
  refreshEditorTileDomCache();
  if (editorState.open) {
    refreshTilePickOverlays();
    if (editorState.hitboxOverlay) updateHitboxOverlay();
  }
  forceCompactBoardConfigInGameState();
  if (roomId) applyActorsSparseToAllRoomRefs(roomId);
}

function clearDomSessionInspectorState() {
  editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;
  editorState.selectedTileIndex = null;
  clearTileSelection();
  removeTilePickOverlays();
  if (editorState.inspectorRoot) {
    const spriteList = editorState.inspectorRoot.querySelector('#map-editor-sprite-list');
    spriteList?.querySelectorAll('.me-sprite-preview').forEach((preview) => {
      stopSpritePreviewHostSync(preview);
    });
  refreshInspector();
  }
}

function finalizeDomSessionBoardScope(roomId) {
  if (!roomId) return;
  trackedBoardKey = roomId;
  if (!editorState.open) return;
  enableMapEditorBoardTools();
  if (editorState.hitboxOverlay) updateHitboxOverlay();
}

function buildDomSessionPayload(fields = {}) {
  const tiles = Array.isArray(fields.tiles) ? fields.tiles : [];
  return {
    source: fields.source || null,
    roomId: fields.roomId,
    roomName: fields.roomName,
    snapshotBeforeApply: fields.snapshotBeforeApply !== false,
    hitboxOverrides: fields.hitboxOverrides && typeof fields.hitboxOverrides === 'object'
      ? { ...fields.hitboxOverrides }
      : {},
    tiles,
    actors: fields.actors ?? null,
    villains: fields.villains ?? null,
    // tileIndexes among `villains` above that fight as forced allies instead of villains.
    allyTileIndexes: Array.isArray(fields.allyTileIndexes) ? fields.allyTileIndexes.slice() : [],
    allyLimit: fields.allyLimit ?? null,
    allowedPlacementTiles: fields.allowedPlacementTiles ?? null,
    selectedTileIndex: fields.selectedTileIndex ?? null,
    label: fields.label || null,
    savedAt: fields.savedAt ?? null,
    externalId: fields.externalId ?? null
  };
}

function convertMapEditorV2ToDomSessionData(exportPayload) {
  const data = exportPayload?.file?.data;
  if (!data || !Array.isArray(data.tiles)) return null;

  const templates = data.templates || {};
  const tiles = [];
  const hitboxOverrides = {};

  for (const tileRef of data.tiles) {
    const tileIndex = tileRef?.i;
    if (!Number.isFinite(tileIndex)) continue;
    const resolved = resolveMapEditorTileEntry(tileRef, templates);
    if (!resolved) continue;

    if (resolved.hitbox === true || resolved.hitbox === false) {
      hitboxOverrides[tileIndex] = resolved.hitbox;
    }

    const sessionEntry = mapEditorV2TileToSessionEntry(tileIndex, resolved);
    if (sessionEntry) tiles.push(sessionEntry);
  }

  return { tiles, hitboxOverrides };
}

function domSessionPayloadFromLocalSave(session) {
  if (!session?.tiles || !Array.isArray(session.tiles)) return null;
  return buildDomSessionPayload({
    source: 'local-save',
    roomId: session.roomId,
    roomName: session.roomName,
    hitboxOverrides: session.hitboxOverrides,
    tiles: session.tiles,
    // Authoritative actor layer when present (empty array = all creatures removed).
    actors: Array.isArray(session.actors) ? session.actors : null,
    // null = legacy save without creature tracking
    villains: Array.isArray(session.villains) ? session.villains : null,
    allyTileIndexes: Array.isArray(session.allyTiles) ? session.allyTiles : [],
    allyLimit: session.allyLimit ?? null,
    allowedPlacementTiles: Array.isArray(session.allowedPlacementTiles)
      ? session.allowedPlacementTiles
      : null,
    selectedTileIndex: session.selectedTileIndex,
    label: session.name,
    savedAt: session.savedAt,
    externalId: session.id
  });
}

function domSessionPayloadFromWorkshopBundle(bundle, catalogEntry) {
  const sessionData = convertMapEditorV2ToDomSessionData(bundle?.mapEditorV2);
  if (!sessionData) return null;

  const battleRules = catalogEntry?.battleRules || bundle?.customBattle;
  const forcedAllies = Array.isArray(bundle?.customBattle?.allies) ? bundle.customBattle.allies : [];
  const hasVillainData = bundle?.customBattle?.villains != null || forcedAllies.length > 0;
  return buildDomSessionPayload({
    source: 'workshop',
    roomId: catalogEntry?.baseRoomId || bundle?.roomId,
    roomName: catalogEntry?.baseRoomName || bundle?.roomName,
    hitboxOverrides: sessionData.hitboxOverrides,
    tiles: sessionData.tiles,
    villains: hasVillainData
      ? [...(Array.isArray(bundle?.customBattle?.villains) ? bundle.customBattle.villains : []), ...forcedAllies]
      : null,
    allyTileIndexes: forcedAllies.map((a) => Number(a?.tileIndex)).filter(Number.isFinite),
    allyLimit: battleRules?.allyLimit ?? null,
    allowedPlacementTiles: bundle?.customBattle?.tileRestrictions?.allowedTiles
      ?? battleRules?.tileRestrictions?.allowedTiles
      ?? null,
    label: catalogEntry?.title || bundle?.roomName,
    externalId: catalogEntry?.id
  });
}

/**
 * Converts a quest-room-export-v1 payload (buildQuestRoomExport's "Copy export JSON" output —
 * a tile-diff format meant for hand-merging into assets/quests/*.json) into a loadable DOM
 * session, so pasting that same export back into Import works too. Unlike the full
 * map-editor-bundle-v1 format, this one only stores tileMutations (remove/add diffs against
 * the room's native tiles), so the final per-tile sprite list has to be rebuilt here from the
 * room's live native data (globalThis.state.utils.ROOMS) plus those diffs.
 */
function domSessionPayloadFromQuestRoomExport(exportPayload) {
  const roomKey = exportPayload?.roomKey;
  const roomEntry = roomKey ? exportPayload?.rooms?.[roomKey] : null;
  const roomId = roomEntry?.roomId;
  if (!roomId) return null;

  const roomsList = globalThis.state?.utils?.ROOMS;
  const nativeRoom = Array.isArray(roomsList) ? roomsList.find((r) => r?.id === roomId) : null;
  const nativeTiles = nativeRoom?.file?.data?.tiles;
  if (!Array.isArray(nativeTiles)) return null;

  const battleId = exportPayload?.battleId || roomEntry.battleId;
  const customBattle = exportPayload?.customBattle || (battleId ? exportPayload?.battles?.[battleId] : null);
  const tileMutations = roomEntry.tileMutations || {};
  const hitboxOverrides = {};
  const tiles = [];

  Object.keys(tileMutations).forEach((key) => {
    const tileIndex = Number(key);
    const mutation = tileMutations[key] || {};
    const originalLayer = Array.isArray(nativeTiles[tileIndex]) ? nativeTiles[tileIndex] : [];
    const sprites = [];

    (mutation.remove || []).forEach((spriteId) => {
      const stillNative = originalLayer.some((entry) => entry && entry.id === spriteId);
      if (stillNative) sprites.push({ id: spriteId, hidden: true, added: false });
    });

    (mutation.add || []).forEach((entry) => {
      const config = { id: entry.spriteId, added: true, hidden: false };
      if (entry.cropX != null) config.cropX = entry.cropX;
      if (entry.cropY != null) config.cropY = entry.cropY;
      if (entry.cropped) config.cropped = true;
      if (entry.bank != null) config.bank = entry.bank;
      if (entry.offsetX != null) config.offsetX = entry.offsetX;
      if (entry.offsetY != null) config.offsetY = entry.offsetY;
      sprites.push(config);
    });

    if (sprites.length) tiles.push({ tileIndex, sprites });
    if (mutation.hitbox === true || mutation.hitbox === false) {
      hitboxOverrides[tileIndex] = mutation.hitbox;
    }
  });

  const villains = Array.isArray(customBattle?.villains) ? customBattle.villains : [];
  const allowedPlacementTiles = customBattle?.tileRestrictions?.allowedTiles
    ?? exportPayload?.battles?.[battleId]?.allowedTiles
    ?? null;

  return buildDomSessionPayload({
    source: 'workshop',
    roomId,
    roomName: roomEntry.roomName || nativeRoom?.name || roomId,
    hitboxOverrides,
    tiles,
    villains: villains.length ? villains : null,
    allyLimit: customBattle?.allyLimit ?? null,
    allowedPlacementTiles,
    label: roomEntry.roomName || roomId
  });
}

/** Tries every map-export format Import understands; returns a loadDomSession-ready payload or null. */
function resolveMapImportPayload(bundle) {
  if (!bundle || typeof bundle !== 'object') return null;
  if (bundle.format === 'map-editor-bundle-v1') {
    return domSessionPayloadFromWorkshopBundle(bundle, null);
  }
  if (bundle.format === 'quest-room-export-v1') {
    return domSessionPayloadFromQuestRoomExport(bundle);
  }
  return null;
}

function isOnDomSessionRoom(roomId) {
  const room = getCurrentRoom();
  return !!(roomId && room?.id && room.id === roomId);
}

function waitForDomSessionRoom(roomId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (isOnDomSessionRoom(roomId)) {
        resolve(getCurrentRoom());
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

function waitForMapBoardReady(roomId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const check = () => {
      if (isOnDomSessionRoom(roomId) && getMapTileCount() > 0 && getTileElement(0)) {
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}

async function ensureDomSessionRoom(payload) {
  const roomId = payload?.roomId;
  if (!roomId) return null;

  const mapLabel = payload?.roomName || getRoomDisplayName({ id: roomId });

  // Map loads always run in sandbox so allies can be placed immediately after navigate.
  if (editorState.open) {
    enterMapEditorPlayModeLock();
  } else {
    ensureMapEditorSandboxPlayMode();
  }

  if (isOnDomSessionRoom(roomId)) {
    return getCurrentRoom();
  }

  setMapEditorFeedback(
    tReplace(
      'mods.mapEditor.navigatingToMap',
      { map: mapLabel },
      'Opening {map}…'
    ),
    {
      pending: true,
      toastMessage: t('mods.mapEditor.toastOpeningMap', 'Opening map…')
    }
  );
  logMapEditor('loadDomSessionNavigate', { roomId, source: payload?.source });

  if (!navigateToRoomById(roomId)) {
    setMapEditorFeedback(
      tReplace(
        'mods.mapEditor.workshopOpenMapFirst',
        { map: mapLabel },
        'Open {map} first, then load this map.'
      ),
      {
        isError: true,
        toastMessage: t('mods.mapEditor.toastOpenMapFirst', 'Open the target map first.')
      }
    );
    return null;
  }

  await new Promise((resolve) => {
    scheduleReloadRoomTimer(resolve, ROOM_RELOAD_SETTLE_MS);
  });

  const room = await waitForDomSessionRoom(roomId);
  if (!room) {
    setMapEditorFeedback(
      tReplace(
        'mods.mapEditor.navigateToMapFailed',
        { map: mapLabel },
        'Could not open {map}.'
      ),
      {
        isError: true,
        toastMessage: t('mods.mapEditor.toastNavigateFailed', 'Could not open map.')
      }
    );
    return null;
  }

  await waitForMapBoardReady(roomId);

  // Room changes can reset play mode — lock sandbox again after arrival.
  if (editorState.open) {
    enterMapEditorPlayModeLock();
  } else {
    ensureMapEditorSandboxPlayMode();
  }

  return room;
}

function domSessionPayloadHasTileData(payload) {
  return Array.isArray(payload?.tiles);
}

async function loadDomSession(payload) {
  if (!payload || !domSessionPayloadHasTileData(payload)) {
    if (payload?.source === 'workshop') {
      setMapEditorFeedback(t('mods.mapEditor.workshopBundleMissing', 'Could not load workshop map data.'), { isError: true });
    } else {
      setMapEditorFeedback(t('mods.mapEditor.loadMismatch', 'Saved data does not match the current map.'), { isError: true });
    }
    return false;
  }

  const loadGen = ++domSessionLoadGeneration;
  scopeHandlingSuspended = true;
  clearDomSessionInspectorState();
  setMapEditorFeedback(
    t('mods.mapEditor.loadMapPending', 'Loading map…'),
    { pending: true }
  );

  try {
    const room = await ensureDomSessionRoom(payload);
    if (loadGen !== domSessionLoadGeneration) {
      removeMapEditorPersistentToast();
    return false;
  }
    if (!room) return false;

    beginDomSessionLoad({
      room,
      source: payload.source,
      snapshotBeforeApply: payload.snapshotBeforeApply !== false
    });

    const { applied, villainCount } = applyDomSessionEdits({
      source: payload.source,
      hitboxOverrides: payload.hitboxOverrides,
      tiles: payload.tiles,
      actors: payload.actors,
      villains: payload.villains,
      allyTileIndexes: payload.allyTileIndexes,
      allyLimit: payload.allyLimit,
      allowedPlacementTiles: payload.allowedPlacementTiles,
      selectedTileIndex: payload.selectedTileIndex
    });

    // A freshly loaded local-save/workshop map should never inherit the Hitbox or Spawn
    // Tiles overlays from whatever was on screen before — including the allow-spawn mask
    // auto-enabling placementOverlay for maps that ship their own allowedPlacementTiles.
    editorState.hitboxOverlay = false;
    editorState.placementOverlay = false;
    removeHitboxOverlay();
    removePlacementOverlay();

    finalizeDomSessionAfterApply(room.id);
    finalizeDomSessionBoardScope(room.id);
    refreshInspector();
    updateSessionControls();
    notifyMapEditorEditsChanged();
    // Loading a save/workshop map isn't a user edit — don't count it toward the auto-save threshold.
    editorSessionChangeCount = 0;
    notifyMapEditorOpenChanged();

    const label = payload.label || t('mods.mapEditor.defaultSaveName', 'Untitled');
    const savedAt = payload.savedAt
      ? new Date(payload.savedAt).toLocaleString()
      : null;
    const status = savedAt
      ? t('mods.mapEditor.loadSuccess', 'Loaded "{name}" on {map} ({count} tiles, saved {savedAt}).')
          .replace('{name}', label)
          .replace('{map}', payload.roomName || room.id)
          .replace('{count}', String(applied))
          .replace('{savedAt}', savedAt)
      : t('mods.mapEditor.loadSuccessNoDate', 'Loaded "{name}" on {map} ({count} tiles).')
          .replace('{name}', label)
          .replace('{map}', payload.roomName || room.id)
          .replace('{count}', String(applied));
    if (payload.source === 'workshop') {
      setStatusMessage(status);
      beginWorkshopMapSession(room.id, label);
    } else {
      setMapEditorFeedback(status, {
        toastMessage: t('mods.mapEditor.toastLoadOk', 'Map loaded.')
      });
    }

    logMapEditor('loadDomSession', {
      source: payload.source,
      roomId: payload.roomId,
      externalId: payload.externalId,
      name: label,
      applied,
      villainCount,
      playMode: getBoardPlayMode()
    });

    // Keep sandbox locked and edit session alive so placement/test works right after load.
    if (editorState.open) {
      enterMapEditorPlayModeLock();
      void ensureMapEditorEditSession({ skipInitialVillainSync: false });
    } else {
      ensureMapEditorSandboxPlayMode();
    }

    return true;
  } finally {
    scopeHandlingSuspended = false;
  }
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
      editorState.selectedSaveRoomId = null;
    }
  } else {
    try {
      localStorage.removeItem(getMapSessionStorageKey(roomId));
    } catch (e) {}
    editorState.selectedSaveId = null;
    editorState.selectedSaveRoomId = null;
  }
  updateSessionControls();
}

// =======================
// 8b. Workshop (Firebase + local saves)
// =======================

function getCurrentPlayerName() {
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.name) return String(playerState.name).trim();
    if (window.gameState?.player?.name) return String(window.gameState.player.name).trim();
  } catch (_) { /* ignore */ }
  return '';
}

async function hashPlayerName(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(username || '').toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createWorkshopMapId() {
  return `mw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const MapWorkshopFirebase = {
  async handleResponse(response, errorContext, defaultReturn = null) {
    if (!response.ok) {
      if (response.status === 404) return defaultReturn;
      throw new Error(`Failed to ${errorContext}: ${response.status}`);
    }
    return await response.json();
  },

  async get(path, errorContext, defaultReturn = null) {
    try {
      const response = await fetch(`${path}.json`);
      return await this.handleResponse(response, errorContext, defaultReturn);
    } catch (error) {
      console.warn(`[Map Editor][Workshop] ${errorContext}:`, error);
      return defaultReturn;
    }
  },

  async put(path, data, errorContext) {
    const response = await fetch(`${path}.json`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await this.handleResponse(response, errorContext);
  },

  async delete(path, errorContext) {
    const response = await fetch(`${path}.json`, { method: 'DELETE' });
    return await this.handleResponse(response, errorContext, null);
  }
};

function sanitizeWorkshopText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function getMapEditorBattleRules() {
  const room = getCurrentRoom();
  const parsedLimit = Number(editorBattleRules.allyLimit);
  const allyLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(20, Math.floor(parsedLimit))
    : (room?.maxTeamSize ?? 6);
  const { villains, allies } = splitVillainsAndAllies(
    collectMapVillainConfigs().map((entry) => cloneJson(entry))
  );
  const allowedPlacementTiles = getAllowedPlacementTiles();
  const tileRestrictions = buildTileRestrictionsForExport();
  return {
    allyLimit,
    villains,
    allies,
    allowedPlacementTiles,
    tileRestrictions
  };
}

/** Push current workshop battle rules onto the live Map Editor test CustomBattle. */
function syncMapEditorTestBattleConfigFromRules() {
  if (!mapEditorTestBattle?.config || !editorState.sandboxTestActive) return false;
  const rules = getMapEditorBattleRules();
  const prevLimit = mapEditorTestBattle.config.allyLimit;
  mapEditorTestBattle.config.allyLimit = rules.allyLimit;
  if (rules.tileRestrictions) {
    mapEditorTestBattle.config.tileRestrictions = cloneJson(rules.tileRestrictions);
  } else if (mapEditorTestBattle.config.tileRestrictions) {
    delete mapEditorTestBattle.config.tileRestrictions;
  }
  if (prevLimit !== rules.allyLimit) {
    logMapEditor('syncTestBattleAllyLimit', { from: prevLimit, to: rules.allyLimit });
  }
  return true;
}

function listAllLocalMapSaves() {
  const results = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(SESSION_STORAGE_PREFIX)) continue;
      const roomId = key.slice(SESSION_STORAGE_PREFIX.length);
      const store = getMapSessionStore(roomId);
      if (!store?.saves?.length) continue;
      const roomName = store.roomName || getRoomDisplayName({ id: roomId });
      store.saves.forEach((save) => {
        results.push({ roomId, roomName, save });
      });
    }
  } catch (e) {
    logMapEditor('listLocalSavesFailed', e);
  }
  return results.sort((a, b) => new Date(b.save.savedAt) - new Date(a.save.savedAt));
}

function getSelectedLocalSaveEntry() {
  const entries = listAllLocalMapSaves();
  if (!entries.length) return null;
  const roomId = editorState.selectedSaveRoomId || getCurrentRoom()?.id;
  const saveId = editorState.selectedSaveId;
  if (roomId && saveId) {
    const match = entries.find((entry) => entry.roomId === roomId && entry.save.id === saveId);
    if (match) return match;
  }
  return entries[0];
}

function normalizeWorkshopCatalogEntry(mapId, raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    id: mapId,
    schemaVersion: raw.schemaVersion || WORKSHOP_SCHEMA_VERSION,
    title: String(raw.title || 'Untitled').trim(),
    description: String(raw.description || '').trim(),
    authorName: String(raw.authorName || '').trim(),
    authorHash: String(raw.authorHash || '').trim(),
    baseRoomId: String(raw.baseRoomId || raw.roomId || '').trim(),
    baseRoomName: String(raw.baseRoomName || '').trim(),
    createdAt: Number(raw.createdAt) || 0,
    updatedAt: Number(raw.updatedAt) || Number(raw.createdAt) || 0,
    battleRules: raw.battleRules && typeof raw.battleRules === 'object'
      ? cloneJson(raw.battleRules)
      : null,
    stats: raw.stats && typeof raw.stats === 'object' ? cloneJson(raw.stats) : null
  };
}

async function fetchWorkshopCatalog(force = false) {
  if (editorState.workshopCatalogLoading) return editorState.workshopCatalog;
  const staleMs = 60 * 1000;
  if (!force
    && editorState.workshopCatalog
    && Date.now() - editorState.workshopCatalogFetchedAt < staleMs) {
    return editorState.workshopCatalog;
  }

  editorState.workshopCatalogLoading = true;
  refreshWorkshopCatalogList();
  try {
    const raw = await MapWorkshopFirebase.get(
      `${WORKSHOP_BASE_PATH}/catalog`,
      'fetch workshop catalog',
      {}
    );
    const entries = [];
    const seenIds = new Set();
    for (const [mapId, value] of Object.entries(raw || {})) {
      const entry = normalizeWorkshopCatalogEntry(mapId, value);
      if (!entry || seenIds.has(entry.id)) continue;
      seenIds.add(entry.id);
      entries.push(entry);
    }
    entries.sort((a, b) => b.updatedAt - a.updatedAt);
    editorState.workshopCatalog = entries;
    editorState.workshopCatalogFetchedAt = Date.now();
    return entries;
  } finally {
    editorState.workshopCatalogLoading = false;
    refreshWorkshopCatalogList();
  }
}

async function fetchWorkshopBundle(mapId) {
  if (!mapId) return null;
  const bundle = await MapWorkshopFirebase.get(
    `${WORKSHOP_BASE_PATH}/maps/${mapId}/bundle`,
    'fetch workshop bundle'
  );
  if (!bundle || typeof bundle !== 'object') return null;
  if (bundle.format !== 'map-editor-bundle-v1') return null;
  return bundle;
}

async function countAuthorWorkshopUploads(authorHash) {
  if (!authorHash) return 0;
  const index = await MapWorkshopFirebase.get(
    `${WORKSHOP_BASE_PATH}/authors/${authorHash}/mapIds`,
    'fetch author workshop uploads',
    {}
  );
  return Object.keys(index || {}).length;
}

function validateWorkshopUploadReadiness() {
  const room = getCurrentRoom();
  if (!room?.id) {
    return { ok: false, reason: 'noRoom' };
  }

  const title = sanitizeWorkshopText(editorState.workshopUploadTitle, WORKSHOP_TITLE_MAX_LENGTH);
  if (!title) {
    return { ok: false, reason: 'noTitle' };
  }

  const rules = getMapEditorBattleRules();
  if (!rules.villains.length) {
    return { ok: false, reason: 'noVillains' };
  }

  const bundle = buildUnifiedMapExport();
  if (!bundle) {
    return { ok: false, reason: 'noBundle' };
  }

  return {
    ok: true,
    title,
    description: sanitizeWorkshopText(editorState.workshopUploadDescription, WORKSHOP_DESCRIPTION_MAX_LENGTH),
    rules,
    bundle
  };
}

async function uploadMapToWorkshop() {
  if (workshopUploadInFlight) return false;
  const playerName = getCurrentPlayerName();
  if (!playerName) {
    setStatusMessage(t('mods.mapEditor.workshopNoPlayer', 'Could not read your player name — log in first.'), true);
    return false;
  }

  const readiness = validateWorkshopUploadReadiness();
  if (!readiness.ok) {
    const reasonKey = {
      noRoom: 'mods.mapEditor.noRoom',
      noTitle: 'mods.mapEditor.workshopNoTitle',
      noVillains: 'mods.mapEditor.workshopNoVillains',
      noBundle: 'mods.mapEditor.workshopNoBundle'
    }[readiness.reason] || 'mods.mapEditor.workshopUploadFailed';
    setStatusMessage(t(reasonKey, 'Could not upload map.'), true);
    return false;
  }

  const authorHash = await hashPlayerName(playerName);
  const uploadCount = await countAuthorWorkshopUploads(authorHash);
  if (uploadCount >= WORKSHOP_MAX_UPLOADS_PER_PLAYER) {
    setStatusMessage(
      tReplace(
        'mods.mapEditor.workshopUploadLimit',
        { max: WORKSHOP_MAX_UPLOADS_PER_PLAYER },
        'You can only upload {max} workshop maps. Delete one of yours first.'
      ),
      true
    );
    return false;
  }

  const room = getCurrentRoom();
  const mapId = createWorkshopMapId();
  const now = Date.now();
  const { title, description, rules, bundle } = readiness;

  workshopUploadInFlight = true;
  const uploadBtn = editorState.inspectorRoot?.querySelector('#map-editor-workshop-upload-btn');
  if (uploadBtn) uploadBtn.disabled = true;

  bundle.workshopMeta = {
    mapId,
    title,
    description,
    authorName: playerName,
    authorHash,
    uploadedAt: now
  };

  const catalogEntry = {
    schemaVersion: WORKSHOP_SCHEMA_VERSION,
    title,
    description,
    authorName: playerName,
    authorHash,
    baseRoomId: room.id,
    baseRoomName: getRoomDisplayName(room),
    createdAt: now,
    updatedAt: now,
    battleRules: {
      allyLimit: rules.allyLimit,
      villainCount: rules.villains.length,
      forcedAllyCount: rules.allies.length || undefined,
      allowedPlacementTiles: rules.allowedPlacementTiles.length
        ? rules.allowedPlacementTiles.slice()
        : undefined
    },
    stats: bundle.stats || null
  };

  try {
    await MapWorkshopFirebase.put(
      `${WORKSHOP_BASE_PATH}/catalog/${mapId}`,
      catalogEntry,
      'upload workshop catalog entry'
    );
    await MapWorkshopFirebase.put(
      `${WORKSHOP_BASE_PATH}/maps/${mapId}/bundle`,
      bundle,
      'upload workshop bundle'
    );
    await MapWorkshopFirebase.put(
      `${WORKSHOP_BASE_PATH}/authors/${authorHash}/mapIds/${mapId}`,
      true,
      'index workshop upload'
    );
  } catch (error) {
    logMapEditor('workshopUploadFailed', error);
    setStatusMessage(t('mods.mapEditor.workshopUploadFailed', 'Workshop upload failed.'), true);
    return false;
  } finally {
    workshopUploadInFlight = false;
    const uploadBtnDone = editorState.inspectorRoot?.querySelector('#map-editor-workshop-upload-btn');
    if (uploadBtnDone) uploadBtnDone.disabled = false;
  }

  editorState.workshopCatalog = null;
  editorState.workshopCatalogFetchedAt = 0;
  await fetchWorkshopCatalog(true);
  editorState.selectedWorkshopMapId = mapId;
  refreshWorkshopTab();
  setStatusMessage(
    tReplace('mods.mapEditor.workshopUploadOk', { title }, 'Uploaded "{title}" to the workshop.')
  );
  logMapEditor('workshopUpload', { mapId, roomId: room.id, authorHash });
  return true;
}

async function deleteOwnWorkshopMap(mapId, catalogEntry = null) {
  const entry = catalogEntry || editorState.workshopCatalog?.find((item) => item.id === mapId);
  if (!entry) return false;

  const playerName = getCurrentPlayerName();
  const authorHash = playerName ? await hashPlayerName(playerName) : '';
  if (!authorHash || entry.authorHash !== authorHash) {
    setStatusMessage(t('mods.mapEditor.workshopDeleteDenied', 'You can only delete your own workshop maps.'), true);
    return false;
  }

  try {
    await MapWorkshopFirebase.delete(`${WORKSHOP_BASE_PATH}/catalog/${mapId}`, 'delete workshop catalog entry');
    await MapWorkshopFirebase.delete(`${WORKSHOP_BASE_PATH}/maps/${mapId}/bundle`, 'delete workshop bundle');
    await MapWorkshopFirebase.delete(
      `${WORKSHOP_BASE_PATH}/authors/${authorHash}/mapIds/${mapId}`,
      'delete workshop author index'
    );
  } catch (error) {
    logMapEditor('workshopDeleteFailed', error);
    setStatusMessage(t('mods.mapEditor.workshopDeleteFailed', 'Could not delete workshop map.'), true);
    return false;
  }

  editorState.workshopCatalog = editorState.workshopCatalog?.filter((item) => item.id !== mapId) || [];
  if (editorState.selectedWorkshopMapId === mapId) {
    editorState.selectedWorkshopMapId = editorState.workshopCatalog[0]?.id || null;
  }
  refreshWorkshopCatalogList();
  setStatusMessage(
    tReplace('mods.mapEditor.workshopDeleteOk', { title: entry.title }, 'Deleted "{title}" from the workshop.')
  );
  return true;
}

async function testWorkshopMap(catalogEntry) {
  if (!catalogEntry?.id) return false;
  const bundle = await fetchWorkshopBundle(catalogEntry.id);
  if (!bundle) {
    setStatusMessage(t('mods.mapEditor.workshopBundleMissing', 'Could not load workshop map data.'), true);
    return false;
  }

  const payload = domSessionPayloadFromWorkshopBundle(bundle, catalogEntry);
  if (!payload) {
    setStatusMessage(t('mods.mapEditor.workshopBundleMissing', 'Could not load workshop map data.'), true);
    return false;
  }
  return loadDomSession(payload);
}

function loadSelectedLocalSave() {
  const entry = getSelectedLocalSaveEntry();
  if (!entry) {
    setStatusMessage(t('mods.mapEditor.noSaveSelected', 'Select a save to load.'), true);
    return false;
  }

  editorState.selectedSaveId = entry.save.id;
  editorState.selectedSaveRoomId = entry.roomId;
  return loadDomSession(domSessionPayloadFromLocalSave({
    ...entry.save,
    roomId: entry.roomId,
    roomName: entry.roomName
  }));
}

function reloadRoomFromGame(roomId, floor, options = {}) {
  const sandboxActive = editorState.sandboxTestActive;
  const resolvedOptions = sandboxActive
    ? { ...options, skipRevertEdits: true }
    : options;
  const {
    showStatus = false,
    reason = 'unknown',
    skipRevertEdits = false,
    allowBounce = true,
    skipNavigation = false,
    forceFinish = false,
    onComplete = null
  } = resolvedOptions;

  if (!roomId || !globalThis.state?.board?.send) {
    if (typeof onComplete === 'function') onComplete();
    return false;
  }

  compactBoardConfigInGameState();

  const currentRoomId = getBoardRoomKey();
  const onTargetRoom = currentRoomId && String(currentRoomId) === String(roomId);
  const bounceRoomId = allowBounce && onTargetRoom && !skipNavigation
    ? findBounceRoomId(roomId)
    : null;
  if (!skipRevertEdits) {
  revertAllEditorEdits();
  }

  clearReloadRoomTimers();
  scopeHandlingSuspended = true;
  if (boardToolsRefreshTimer) {
    clearTimeout(boardToolsRefreshTimer);
    boardToolsRefreshTimer = null;
  }

  if (showStatus) {
    setMapEditorFeedback(t('mods.mapEditor.restoreMapPending', 'Restoring map…'), { pending: true });
  }

  const finishReload = () => {
    setBoardFloor(floor);
    scheduleReloadRoomTimer(() => {
      if (!editorState.open && !showStatus && !forceFinish) {
      scopeHandlingSuspended = false;
        return;
      }

      scopeHandlingSuspended = false;
      trackedBoardKey = getBoardRoomKey() || (sandboxActive ? roomId : null);
      if (!skipRevertEdits) {
        purgeAllEditorDomEdits();
      }

      const restoredData = getCurrentRoom()?.file?.data;
      if (restoredData) {
        applyMergedRoomDataToLiveRefs(roomId, sanitizeRoomFileDataForRuntime(restoredData));
      }

      compactBoardConfigInGameState();

      if (sandboxActive) {
        ensureSandboxTestRoomApplied('reload-finish');
      }

      if (editorState.open && !sandboxActive) {
        enableMapEditorBoardTools();
        refreshInspector();
      } else if (editorState.open) {
        refreshInspector();
      }

      if (showStatus) {
        const room = getCurrentRoom();
        setMapEditorFeedback(
          tReplace('mods.mapEditor.restoreMapOk', { map: getRoomDisplayName(room) },
            'Map restored — reloaded {map} from game data.'),
          { toastMessage: t('mods.mapEditor.toastRestoreOk', 'Map restored.') }
        );
      }

      logMapEditor('reloadRoomFromGame', {
        roomId,
        floor,
        bounced: !!bounceRoomId,
        onTargetRoom,
        skipNavigation: skipNavigation && onTargetRoom,
        reason
      });
      if (typeof onComplete === 'function') onComplete();

      if (reason === 'editor-close') {
        unlockPlayModeSelector();
        schedulePlayModeUnlockRetries();
        scheduleReloadRoomTimer(() => {
          unlockPlayModeSelector();
          schedulePlayModeUnlockRetries();
        }, ROOM_RELOAD_SETTLE_MS);
      }
    }, ROOM_RELOAD_SETTLE_MS);
  };

  try {
    if (bounceRoomId) {
      logMapEditor('reloadRoomBounce', { target: roomId, bounce: bounceRoomId, reason });
      navigateToRoomById(bounceRoomId);
      scheduleReloadRoomTimer(() => {
        navigateToRoomById(roomId);
        scheduleReloadRoomTimer(finishReload, ROOM_RELOAD_BOUNCE_MS);
      }, ROOM_RELOAD_BOUNCE_MS);
      return true;
    }

    if (skipNavigation && onTargetRoom) {
      scheduleReloadRoomTimer(finishReload, ROOM_RELOAD_SETTLE_MS);
      return true;
    }

    navigateToRoomById(roomId);
    scheduleReloadRoomTimer(finishReload, ROOM_RELOAD_SETTLE_MS);
    return true;
  } catch (e) {
    clearReloadRoomTimers();
    scopeHandlingSuspended = false;
    logMapEditor('reloadRoomFailed', { roomId, floor, error: String(e), reason });
    if (showStatus) {
      setMapEditorFeedback(t('mods.mapEditor.restoreMapFail', 'Could not restore map.'), { isError: true });
    }
    if (typeof onComplete === 'function') onComplete();
    return false;
  }
}

/**
 * Native restore reload: always bounce Sewers → target (backup Map Editor pattern),
 * then selectRoomById rebuilds boardConfig from room.file.data.
 */
function finishMapRestoreSession(roomId, floor, options = {}) {
  const {
    showStatus = false,
    onComplete = null,
    logTag = 'nativeReloadComplete',
    logExtra = null,
    statusMessageKey = 'mods.mapEditor.restoreMapOk',
    statusMessageDefault = 'Map restored — reloaded {map} from game data.'
  } = options;

  setBoardFloor(floor);
  scheduleReloadRoomTimer(() => {
    scopeHandlingSuspended = false;
    trackedBoardKey = roomId || getBoardRoomKey();

    clearEditorHiddenSpritesFromDom();
    const restoredRoom = getCurrentRoom();
    if (restoredRoom?.id) {
      snapshotRoomDataForTest(restoredRoom.id);
      captureBaseTilesSnapshot();
      captureAllNativeSpritePlacements();
      scheduleDeferredNativeSpritePlacementRestore();
    }
    restoreAllNativeSpritePlacements();
    if (editorState.hitboxOverlay) updateHitboxOverlay();

    if (editorState.open) {
      enableMapEditorBoardTools();
      refreshInspector();
    }

    if (showStatus) {
      setMapEditorFeedback(
        tReplace(statusMessageKey, { map: getRoomDisplayName(restoredRoom) }, statusMessageDefault),
        { toastMessage: t('mods.mapEditor.toastRestoreOk', 'Map restored.') }
      );
    }

    const completeRestore = () => {
      restoreMapSettleUntil = Date.now() + RESTORE_MAP_SETTLE_COOLDOWN_MS;
      logMapEditor(logTag, { roomId, floor, ...(logExtra || {}) });
      if (typeof onComplete === 'function') onComplete();
    };

    if (editorState.open) {
      suppressSandboxAutoSetupReapplyUntil = Date.now() + 2500;
      void ensureMapEditorEditSession({ skipInitialVillainSync: true })
        .then(() => {
          if (logTag === 'nativeReloadComplete') {
            logMapEditor('nativeRestoreKeepBoardVillains', {
              roomId,
              note: 'villains from selectRoomById only — no Custom Battles board patch'
            });
          }
        })
        .finally(completeRestore);
    } else {
      completeRestore();
    }
  }, ROOM_RELOAD_SETTLE_MS);
}

function nativeReloadRoomForRestore(roomId, floor, options = {}) {
  const {
    showStatus = false,
    onComplete = null,
    beforeTargetNavigation = null,
    bounceSettleMs = ROOM_RELOAD_BOUNCE_MS,
    logTag = 'nativeReloadComplete',
    logExtra = null
  } = options;

  if (!roomId || !globalThis.state?.board?.send) {
    if (typeof onComplete === 'function') onComplete();
    return false;
  }

  clearReloadRoomTimers();
  scopeHandlingSuspended = true;
  if (boardToolsRefreshTimer) {
    clearTimeout(boardToolsRefreshTimer);
    boardToolsRefreshTimer = null;
  }

  const bounceRoomId = findBounceRoomId(roomId);

  const runFinish = () => {
    finishMapRestoreSession(roomId, floor, {
      showStatus,
      logTag,
      logExtra: logExtra ?? { bounced: !!bounceRoomId },
      onComplete
    });
  };

  const startTargetRoomReload = () => {
    if (typeof beforeTargetNavigation === 'function') {
      try {
        beforeTargetNavigation();
      } catch (e) {
        logMapEditor('nativeRestoreBeforeNavigateFailed', { roomId, error: String(e) });
      }
    }
    if (restoreMapInProgress) {
      clearBoardConfigForNativeRoomSelect();
    }
    logMapEditor('nativeReloadSelectRoom', { roomId, floor, bounced: !!bounceRoomId });
    navigateToRoomById(roomId);
    scheduleReloadRoomTimer(runFinish, ROOM_RELOAD_SETTLE_MS);
  };

  if (bounceRoomId) {
    logMapEditor('nativeReloadBounce', { target: roomId, bounce: bounceRoomId });
    navigateToRoomById(bounceRoomId);
    scheduleReloadRoomTimer(() => {
      startTargetRoomReload();
    }, bounceSettleMs);
  } else {
    startTargetRoomReload();
  }

  return true;
}

/** Finish DOM-only restore without navigation — mirrors Reset Tile's sandbox tail. */
function completeDomRestoreInPlace(roomId, options = {}) {
  const { strategy = 'reset-tiles-in-place' } = options;

  const runSandboxVillainSync = () => {
    forceCompactBoardConfigInGameState();
    applyActorsSparseToAllRoomRefs(roomId);
    applyEditorVillainsToBoard();
    finalizeSandboxRoomDomState('map-restore');
    syncMapEditorTestNativeRoomSnapshot();
  };

  const finishRestore = () => {
    forceCompactBoardConfigInGameState();
    logBoardStateSnapshot('beforeDomRestoreFinish');

    restoreMapInProgress = false;
    detachRestoreBoardGuard();

    const restoredRoom = getCurrentRoom();
    if (restoredRoom?.id) {
      snapshotRoomDataForTest(restoredRoom.id);
      captureBaseTilesSnapshot();
      captureAllNativeSpritePlacements();
      scheduleDeferredNativeSpritePlacementRestore();
      restoreAllNativeSpritePlacements();
    }

    if (editorState.sandboxTestActive) {
      // Bulk DOM/sprite restore runs first — defer villain board patch until it settles,
      // otherwise the native board re-render can race a mid-restore boardConfig write.
      scheduleReloadRoomTimer(() => {
        runSandboxVillainSync();
        restoreMapSettleUntil = Date.now() + RESTORE_MAP_SETTLE_COOLDOWN_MS;
      }, ROOM_RELOAD_SETTLE_MS);
    } else if (editorState.hitboxOverlay) {
      updateHitboxOverlay();
    }

    if (editorState.open) {
      enableMapEditorBoardTools();
      refreshInspector();
    }

    scopeHandlingSuspended = false;
    restoreMapSettleUntil = Date.now() + RESTORE_MAP_SETTLE_COOLDOWN_MS
      + (editorState.sandboxTestActive ? ROOM_RELOAD_SETTLE_MS : 0);

    mapEditorDomSessionSource = null;
    endWorkshopMapSession();
    notifyMapEditorOpenChanged();
    setMapEditorFeedback(
      tReplace(
        'mods.mapEditor.restoreMapOk',
        { map: getRoomDisplayName(restoredRoom) },
        'Map restored — reloaded {map} from game data.'
      ),
      { toastMessage: t('mods.mapEditor.toastRestoreOk', 'Map restored.') }
    );

    forceCompactBoardConfigInGameState();
    logMapEditor('inPlaceRestoreComplete', { roomId, strategy });
    logBoardStateSnapshot('afterInPlaceRestore');
  };

  finishRestore();
}

function restoreMapFromGame() {
  const room = getCurrentRoom();
  if (!room?.id) {
    setMapEditorFeedback(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), { isError: true });
    return false;
  }
  if (!guardMapEditorManipulator('restore-map')) return false;

  const roomId = room.id;
  const floor = getBoardFloor();
  const restorePlan = buildEditorRestorePlan();
  if (!restorePlan.hadEdits && mapEditorDomSessionSource == null) {
    logMapEditor('restoreMapSkip', { roomId, reason: 'no-edits' });
    return false;
  }
  const hasOpenSessionSnapshot = mapEditorTestRoomSnapshot?.roomId === roomId
    && !!mapEditorTestRoomSnapshot.entries?.length;
  const roomRestoreBackup = restorePlan.hadEdits || hasOpenSessionSnapshot
    ? backupEditorRoomRestoreState(roomId)
    : null;
  const useInPlaceRestore = restorePlan.wasMapCleaned === true
    || restorePlan.mode === 'dom'
    || mapEditorDomSessionSource != null
    || (editorState.sandboxTestActive && hasOpenSessionSnapshot);

  const restoreStrategy = restorePlan.wasMapCleaned
    ? 'clean-map-in-place'
    : mapEditorDomSessionSource === 'workshop'
      ? 'workshop-in-place'
      : mapEditorDomSessionSource === 'local-save'
        ? 'local-save-in-place'
        : restorePlan.mode === 'dom'
          ? 'reset-tiles-in-place'
          : useInPlaceRestore
            ? 'sandbox-in-place'
            : 'trace-bounce-selectRoomById';
  logMapEditor('restoreMapPlan', {
    roomId,
    floor,
    strategy: restoreStrategy,
    domSessionSource: mapEditorDomSessionSource,
    ...restorePlan,
    hasSnapshot: !!roomRestoreBackup?.savedFile
  });
  logBoardStateSnapshot('restore-start');
  restoreMapInProgress = true;
  attachRestoreBoardGuard();

  editorState.selectedTileIndex = null;
  clearTileSelection();
  discardEphemeralEditorDomState({ keepHiddenSprites: useInPlaceRestore });

  setMapEditorFeedback(t('mods.mapEditor.restoreMapPending', 'Restoring map…'), { pending: true });
  clearReloadRoomTimers();
  cancelPendingMapEditorRefreshTimers();
  scopeHandlingSuspended = true;
  if (boardToolsRefreshTimer) {
    clearTimeout(boardToolsRefreshTimer);
    boardToolsRefreshTimer = null;
  }

  // DOM / clean-map / workshop / sandbox: bulk in-place revert (no selectRoomById).
  if (useInPlaceRestore) {
    logBoardStateSnapshot('beforeDomRestore');
    // Clean-map restore already bulk-unhides and resets tiles; skip snapshot rewind.
    if (hasOpenSessionSnapshot && !restorePlan.wasMapCleaned) {
      applyEditorOpenSnapshotToLiveRefs(roomId);
      if (roomRestoreBackup) restoreLayerSnapshotsFromBackup(roomRestoreBackup);
    }
    restoreDomEditsViaResetTiles(restorePlan);
    logMapEditor('restoreMapFromGame', {
      roomId,
      floor,
      hadEdits: restorePlan.hadEdits,
      mode: restorePlan.mode,
      wasMapCleaned: restorePlan.wasMapCleaned === true,
      strategy: restoreStrategy,
      domSessionSource: mapEditorDomSessionSource,
      sandboxKept: editorState.sandboxTestActive === true
    });
    completeDomRestoreInPlace(roomId, {
      strategy: restoreStrategy
    });
    return true;
  }

  // Full restore: stop sandbox, then native reload.
  if (editorState.sandboxTestActive || mapEditorTestBattle) {
    logMapEditor('restoreMapStopSandbox', { roomId });
    stopMapEditorSandboxTest({
      reloadRoom: false,
      silent: true,
      skipSnapshotRestore: true,
      skipBoardRestore: true
    });
  }
  logBoardStateSnapshot('after-sandbox-stop');
  forceCompactBoardConfigInGameState();

  // 2b. Full restore: bulk DOM revert, then native reload for villains/hitboxes/clean-map.
  restoreDomEditsFromTrace(restorePlan);

  const applyRoomDataBeforeTargetNavigate = restorePlan.hadEdits
    ? () => applyNativeRestoreRoomData(roomId, restorePlan, roomRestoreBackup)
    : null;

  logMapEditor('restoreMapFromGame', {
    roomId,
    floor,
    hadEdits: restorePlan.hadEdits,
    mode: restorePlan.mode || 'none',
    deferRoomRestore: !!applyRoomDataBeforeTargetNavigate
  });
  logBoardStateSnapshot('beforeNativeReload');

  // 3. Bounce → restore room.file.data on bounce map → selectRoomById target.
  const reloaded = nativeReloadRoomForRestore(roomId, floor, {
    showStatus: true,
    beforeTargetNavigation: applyRoomDataBeforeTargetNavigate,
    bounceSettleMs: restorePlan.hadEdits ? ROOM_RELOAD_SETTLE_MS : ROOM_RELOAD_BOUNCE_MS,
    onComplete: () => {
      restoreMapInProgress = false;
      detachRestoreBoardGuard();
      mapEditorDomSessionSource = null;
      endWorkshopMapSession();
      notifyMapEditorOpenChanged();
      logBoardStateSnapshot('afterNativeRestore');
    }
  });

  if (!reloaded) {
    restoreMapInProgress = false;
    detachRestoreBoardGuard();
    scopeHandlingSuspended = false;
    setMapEditorFeedback(t('mods.mapEditor.restoreMapFail', 'Could not restore map.'), { isError: true });
  }

  return reloaded;
}

function refreshWorkshopLocalSavesList() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  const list = root.querySelector('#map-editor-workshop-local-list');
  const nameInput = root.querySelector('#map-editor-save-name');
  if (!list) return;

  list.replaceChildren();
  const entries = listAllLocalMapSaves();

  if (!entries.length) {
    list.hidden = true;
    if (nameInput && !nameInput.value.trim()) {
      nameInput.placeholder = t('mods.mapEditor.saveNamePlaceholder', 'Save name…');
    }
    return;
  }

  list.hidden = false;
  const selected = getSelectedLocalSaveEntry();
  if (selected) {
    editorState.selectedSaveId = selected.save.id;
    editorState.selectedSaveRoomId = selected.roomId;
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = selected.save.name;
    }
  }

  const fragment = document.createDocumentFragment();
  entries.forEach((entry) => {
    fragment.appendChild(createWorkshopLocalSaveCard(entry, nameInput));
  });
  list.appendChild(fragment);
}

function getMapsDatabase() {
  if (typeof window !== 'undefined' && window.mapsDatabase) return window.mapsDatabase;
  if (globalThis.mapsDatabase) return globalThis.mapsDatabase;
  return null;
}

function getWorkshopMapIconUrl(roomId) {
  const id = String(roomId || '').trim();
  if (!id) return '/assets/icons/map.png';
  return `/assets/room-thumbnails/${id}.png`;
}

function getWorkshopMapLabel(entry) {
  const roomId = entry?.baseRoomId;
  if (!roomId) return entry?.baseRoomName || '?';
  const db = getMapsDatabase();
  const room = db?.getMapById?.(roomId);
  if (entry?.baseRoomName) return entry.baseRoomName;
  if (room) return getRoomDisplayName(room);
  return getRoomDisplayName({ id: roomId }) || roomId;
}

function createWorkshopMapPreview(roomId) {
  const preview = document.createElement('div');
  preview.className = 'me-workshop-map-preview';

  const img = document.createElement('img');
  img.className = 'me-workshop-map-icon pixelated';
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.draggable = false;
  img.src = getWorkshopMapIconUrl(roomId);
  img.addEventListener('error', () => {
    img.src = '/assets/icons/map.png';
    img.onerror = () => {
      preview.classList.add('me-workshop-map-preview-fallback');
      preview.textContent = '?';
      img.remove();
    };
  }, { once: true });
  preview.appendChild(img);
  return preview;
}

function createWorkshopCatalogCard(entry, authorHash) {
  const isOwn = entry.authorHash === authorHash;
  const isActive = entry.id === editorState.selectedWorkshopMapId;
  const mapLabel = getWorkshopMapLabel(entry);
  const title = entry.title || entry.id;

  const card = document.createElement('div');
  card.className = 'me-asset-card me-workshop-card' + (isActive ? ' me-workshop-card-active' : '');
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.title = tReplace(
    'mods.mapEditor.workshopBattleTooltip',
    { title, map: mapLabel },
    'Battle "{title}" on {map}'
  );

  if (isOwn) {
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'me-workshop-card-delete';
    deleteBtn.title = t('mods.mapEditor.workshopDelete', 'Delete');
    deleteBtn.setAttribute('aria-label', t('mods.mapEditor.workshopDelete', 'Delete'));
    attachInlineConfirm(deleteBtn, {
      baseText: '×',
      confirmText: '✓',
      timeoutMs: 3000,
      onConfirm: () => {
        deleteOwnWorkshopMap(entry.id, entry);
      }
    });
    card.appendChild(deleteBtn);
  }

  card.appendChild(createWorkshopMapPreview(entry.baseRoomId));

  const meta = document.createElement('div');
  meta.className = 'me-asset-meta';

  const titleLine = document.createElement('div');
  titleLine.className = 'me-workshop-card-title';
  titleLine.textContent = title;

  const subLine = document.createElement('div');
  subLine.className = 'me-workshop-card-sub';
  subLine.textContent = t('mods.mapEditor.workshopCatalogEntry', '{author} · {map} · {villains} villains')
    .replace('{author}', entry.authorName || t('mods.mapEditor.workshopUnknownAuthor', 'Unknown'))
    .replace('{map}', mapLabel)
    .replace('{villains}', String(entry.battleRules?.villainCount ?? 0));

  meta.append(titleLine, subLine);
  card.appendChild(meta);

  const activateCard = (e) => {
    e?.stopPropagation?.();
    editorState.selectedWorkshopMapId = entry.id;
    refreshWorkshopCatalogList();
    testWorkshopMap(entry);
  };

  card.addEventListener('click', activateCard);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      activateCard(e);
    }
  });

  return card;
}

function createWorkshopLocalSaveCard(entry, nameInput = null) {
  const { roomId, roomName, save } = entry;
  const isActive = save.id === editorState.selectedSaveId && roomId === editorState.selectedSaveRoomId;
  const mapLabel = roomName || getWorkshopMapLabel({ baseRoomId: roomId, baseRoomName: roomName });
  const displayName = isAutoSaveSessionEntry(save)
    ? t('mods.mapEditor.autoSaveListLabel', '{name} (auto)').replace('{name}', save.name)
    : save.name;
    const tileLabel = save.tiles?.length === 1 ? 'tile' : 'tiles';
    const tileCount = save.tiles?.length || 0;

  const card = document.createElement('div');
  card.className = 'me-asset-card me-workshop-card me-workshop-save-card' + (isActive ? ' me-workshop-card-active' : '');
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.title = t('mods.mapEditor.selectSaveTooltip', 'Select "{name}" — then Load or Save')
    .replace('{name}', displayName);

  card.appendChild(createWorkshopMapPreview(roomId));

  const meta = document.createElement('div');
  meta.className = 'me-asset-meta';

  const titleLine = document.createElement('div');
  titleLine.className = 'me-workshop-card-title';
  titleLine.textContent = displayName;

  const subLine = document.createElement('div');
  subLine.className = 'me-workshop-card-sub';
  subLine.textContent = t('mods.mapEditor.workshopSaveCardEntry', '{map} · {count} {tileLabel}')
    .replace('{map}', mapLabel)
      .replace('{count}', String(tileCount))
      .replace('{tileLabel}', tileLabel);

  meta.append(titleLine, subLine);
  card.appendChild(meta);

  const selectSave = (e) => {
    e?.stopPropagation?.();
    editorState.selectedSaveId = save.id;
    editorState.selectedSaveRoomId = roomId;
    if (nameInput) nameInput.value = save.name;
    updateSessionControls();
  };

  const loadSave = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    editorState.selectedSaveId = save.id;
    editorState.selectedSaveRoomId = roomId;
    if (nameInput) nameInput.value = save.name;
    void loadSelectedLocalSave();
  };

  // Click selects; Load/Save buttons apply the action. Double-click still loads.
  card.addEventListener('click', selectSave);
  card.addEventListener('dblclick', loadSave);
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectSave(e);
    }
  });

  return card;
}

function showWorkshopCatalogSkeleton(grid) {
  grid.replaceChildren();
  grid.classList.add('is-loading');
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < ASSET_LIST_SKELETON_COUNT; i += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = 'me-asset-card me-asset-skeleton me-workshop-skeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    fragment.appendChild(skeleton);
  }
  grid.appendChild(fragment);
}

function refreshWorkshopCatalogList() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  const list = root.querySelector('#map-editor-workshop-catalog-list');
  const uploadHint = root.querySelector('#map-editor-workshop-upload-hint');
  if (!list) return;

  const renderToken = workshopCatalogRenderToken + 1;
  workshopCatalogRenderToken = renderToken;

  list.replaceChildren();
  list.classList.remove('is-loading');

  if (editorState.workshopCatalogLoading) {
    showWorkshopCatalogSkeleton(list);
    return;
  }

  const catalog = editorState.workshopCatalog || [];
  if (!catalog.length) {
    const empty = document.createElement('div');
    empty.className = 'me-muted me-asset-empty';
    empty.textContent = t('mods.mapEditor.workshopEmpty', 'No workshop maps yet.');
    list.appendChild(empty);
    return;
  }

  const playerName = getCurrentPlayerName();
  hashPlayerName(playerName).then((authorHash) => {
    if (!list.isConnected || renderToken !== workshopCatalogRenderToken) return;
    list.replaceChildren();
    list.classList.remove('is-loading');

    let ownCount = 0;
    catalog.forEach((entry) => {
      if (entry.authorHash === authorHash) ownCount += 1;
    });
    if (uploadHint) {
      uploadHint.textContent = tReplace(
        'mods.mapEditor.workshopUploadCount',
        { count: ownCount, max: WORKSHOP_MAX_UPLOADS_PER_PLAYER },
        '{count}/{max} of your uploads used'
      );
    }

    const fragment = document.createDocumentFragment();
    catalog.forEach((entry) => {
      fragment.appendChild(createWorkshopCatalogCard(entry, authorHash));
    });
    list.appendChild(fragment);
  });
}

function updateWorkshopBattleRulesControls() {
  const root = editorState.inspectorRoot;
  if (!root) return;

  const allyInput = root.querySelector('#map-editor-ally-limit');
  const rulesHint = root.querySelector('#map-editor-battle-rules-hint');
  const rules = getMapEditorBattleRules();
  syncMapEditorTestBattleConfigFromRules();

  if (allyInput && document.activeElement !== allyInput) {
    allyInput.value = String(rules.allyLimit);
  }
  if (rulesHint) {
    const placementCount = rules.allowedPlacementTiles.length;
    let hint = placementCount
      ? tReplace(
        'mods.mapEditor.battleRulesHintWithPlacement',
        {
          villains: rules.villains.length,
          allies: rules.allyLimit,
          tiles: placementCount
        },
        '{villains} villains · ally limit {allies} · {tiles} ally spawn tiles'
      )
      : tReplace(
        'mods.mapEditor.battleRulesHint',
        {
          villains: rules.villains.length,
          allies: rules.allyLimit
        },
        '{villains} villains on map · ally limit {allies}'
      );
    if (rules.allies.length) {
      hint += ' · ' + tReplace(
        'mods.mapEditor.battleRulesHintForcedAllies',
        { count: rules.allies.length },
        '{count} forced ally creatures'
      );
    }
    rulesHint.textContent = hint;
  }
}

function refreshWorkshopTab() {
  refreshWorkshopLocalSavesList();
  updateSessionControls();
  updateWorkshopBattleRulesControls();
  refreshWorkshopCatalogList();
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

  const selectedEntry = getSelectedLocalSaveEntry();
  const selected = selectedEntry?.save || null;
  const onSelectedMap = Boolean(
    selected
    && room?.id
    && selectedEntry.roomId === room.id
  );

  if (loadBtn) {
    loadBtn.style.display = selected ? '' : 'none';
    loadBtn.disabled = !selected;
    loadBtn.title = selected?.savedAt
      ? t('mods.mapEditor.loadTooltip', 'Load "{name}" from {time}')
          .replace('{name}', selected.name)
          .replace('{time}', new Date(selected.savedAt).toLocaleString())
      : t('mods.mapEditor.load', 'Load');
  }
  if (clearBtn) {
    clearBtn.style.display = listAllLocalMapSaves().length ? '' : 'none';
    clearBtn.textContent = selected
      ? t('mods.mapEditor.clearSaveNamed', 'Delete save')
      : t('mods.mapEditor.clearSave', 'Clear saves');
  }
  if (sessionHint) {
    sessionHint.replaceChildren();
    sessionHint.className = 'me-session-hint';

    if (!selected?.savedAt) {
      sessionHint.textContent = listAllLocalMapSaves().length
        ? t(
          'mods.mapEditor.saveListHint',
          'Click a save to select it, then Load or Save. Double-click to load.'
        )
        : t('mods.mapEditor.saveNameHint', 'Name your save, then click Save.');
    } else if (!onSelectedMap) {
      sessionHint.classList.add('me-session-hint-warning');
      sessionHint.textContent = tReplace(
        'mods.mapEditor.workshopSaveLoadWillOpenMap',
        { map: selectedEntry.roomName || selectedEntry.roomId },
        'Selected save is on {map}. Click Load to open that map and apply it.'
      );
    } else {
      sessionHint.classList.add('me-session-hint-selected');

      const label = document.createElement('div');
      label.className = 'me-session-selected-label';
      label.textContent = t('mods.mapEditor.selectedSaveLabel', 'Selected save');

      const name = document.createElement('div');
      name.className = 'me-session-selected-name';
      name.textContent = selected.name;

      const time = document.createElement('div');
      time.className = 'me-session-selected-time';
      time.textContent = new Date(selected.savedAt).toLocaleString();

      sessionHint.append(label, name, time);
    }
  }

  refreshWorkshopLocalSavesList();
  updateWorkshopBattleRulesControls();
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
  const sceneSpriteReplacements = buildSceneSpriteReplacementsPayload(rules);
  if (sceneSpriteReplacements) {
    exportPayload.sceneSpriteReplacements = sceneSpriteReplacements;
  }

  return exportPayload;
}

function resolveMapEditorTileEntry(tileRef, templates) {
  if (!tileRef || typeof tileRef !== 'object') return null;
  if (tileRef.template) {
    const template = templates?.[tileRef.template];
    return template ? cloneJson(template) : null;
  }
  const resolved = cloneJson(tileRef);
  if (!resolved) return null;
  delete resolved.i;
  delete resolved.template;
  return resolved;
}

function mapEditorV2TileToSessionEntry(tileIndex, resolved) {
  if (!resolved) return null;

  const original = getOriginalTileLayer(tileIndex) || [];
  const exportSprites = (resolved.sprites || [])
    .map((config) => compactSpriteConfig(config))
    .filter(Boolean);

  const originalCounts = new Map();
  original.forEach((entry) => {
    if (entry?.id == null) return;
    originalCounts.set(entry.id, (originalCounts.get(entry.id) || 0) + 1);
  });

  const exportCounts = new Map();
  exportSprites.forEach((entry) => {
    exportCounts.set(entry.id, (exportCounts.get(entry.id) || 0) + 1);
  });

  const sessionSprites = [];
  for (const [id, count] of originalCounts) {
    const exportCount = exportCounts.get(id) || 0;
    for (let i = exportCount; i < count; i += 1) {
      sessionSprites.push({ id, hidden: true });
    }
  }

  const consumedOriginal = new Map();
  exportSprites.forEach((config) => {
    const id = config.id;
    const originalCount = originalCounts.get(id) || 0;
    const consumed = consumedOriginal.get(id) || 0;
    const isAdded = consumed >= originalCount;
    consumedOriginal.set(id, consumed + 1);
    sessionSprites.push({
      ...cloneJson(config),
      ...(isAdded ? { added: true } : {})
    });
  });

  // Floor-below: keep only entries not already in the tile's base floor-below layer —
  // those are the editor-added ones applyTileSessionEntry() should re-track.
  const baseFloorBelow = normalizeSpriteLayerConfig(getFloorBelowSpriteLayerForTile(tileIndex));
  const baseFloorBelowKeys = new Map();
  baseFloorBelow.forEach((config) => {
    const key = JSON.stringify(config);
    baseFloorBelowKeys.set(key, (baseFloorBelowKeys.get(key) || 0) + 1);
  });
  const addedFloorBelow = [];
  normalizeSpriteLayerConfig(resolved.floorBelow).forEach((config) => {
    const key = JSON.stringify(config);
    const remaining = baseFloorBelowKeys.get(key) || 0;
    if (remaining > 0) {
      baseFloorBelowKeys.set(key, remaining - 1);
      return;
    }
    addedFloorBelow.push(cloneJson(config));
  });

  if (!sessionSprites.length && !addedFloorBelow.length) return null;
  const entry = { tileIndex, sprites: sessionSprites };
  if (addedFloorBelow.length) entry.floorBelow = addedFloorBelow;
  return entry;
}

function applyMapEditorV2Export(exportPayload) {
  const data = exportPayload?.file?.data;
  if (!data || !Array.isArray(data.tiles)) return 0;

  const templates = data.templates || {};
  let applied = 0;

  for (const tileRef of data.tiles) {
    const tileIndex = tileRef?.i;
    if (!Number.isFinite(tileIndex)) continue;
    const resolved = resolveMapEditorTileEntry(tileRef, templates);
    if (!resolved) continue;

    if (resolved.hitbox === true || resolved.hitbox === false) {
      editorEdits.hitboxOverrides[tileIndex] = resolved.hitbox;
      syncLiveRoomHitbox(tileIndex);
    }

    const sessionEntry = mapEditorV2TileToSessionEntry(tileIndex, resolved);
    if (sessionEntry && applyTileSessionEntry(sessionEntry)) applied += 1;
  }

  if (applied) refreshEditorTileDomCache();
  return applied;
}

function convertMapEditorV2ToNativeRoom(exportPayload) {
  const data = exportPayload?.file?.data;
  if (!data || !Array.isArray(data.tiles)) return null;

  const tileCount = Number(data.tileCount) || 0;
  if (!tileCount) return null;

  const templates = data.templates || {};
  const tiles = new Array(tileCount).fill(null);
  const hitboxes = new Array(tileCount).fill(null);
  const actors = new Array(tileCount).fill(null);
  const floorBelowTiles = new Array(tileCount).fill(null);
  const blocked = new Array(tileCount).fill(null);

  for (const tileRef of data.tiles) {
    const tileIndex = tileRef?.i;
    if (!Number.isFinite(tileIndex) || tileIndex < 0 || tileIndex >= tileCount) continue;
    const resolved = resolveMapEditorTileEntry(tileRef, templates);
    if (!resolved) continue;
    if (resolved.sprites?.length) tiles[tileIndex] = compactTileLayer(resolved.sprites);
    if (resolved.hitbox === true || resolved.hitbox === false) hitboxes[tileIndex] = resolved.hitbox;
    if (resolved.actor != null) actors[tileIndex] = cloneJson(resolved.actor);
    if (resolved.floorBelow != null) floorBelowTiles[tileIndex] = cloneJson(resolved.floorBelow);
    if (resolved.blocked != null) blocked[tileIndex] = cloneJson(resolved.blocked);
  }

  const nativeData = { tiles, hitboxes };
  if (actors.some((entry) => entry != null)) nativeData.actors = actors;
  if (floorBelowTiles.some((entry) => entry != null)) nativeData.floorBelowTiles = floorBelowTiles;
  if (blocked.some((entry) => entry != null)) nativeData.blocked = blocked;

  const room = {
    id: exportPayload.id || null,
    file: {
      name: exportPayload.file?.name || null,
      data: nativeData
    }
  };
  if (exportPayload.difficulty != null) room.difficulty = exportPayload.difficulty;
  if (exportPayload.maxTeamSize != null) room.maxTeamSize = exportPayload.maxTeamSize;
  if (exportPayload.staminaCost != null) room.staminaCost = exportPayload.staminaCost;
  return room;
}

function buildNativeRoomExport(options = {}) {
  const { sandboxPatch = false } = options;
  removeEphemeralSpritesFromTiles();
  const exportPayload = buildWholeMapExport();
  if (!exportPayload) return null;
  const room = convertMapEditorV2ToNativeRoom(exportPayload);
  if (!room) return null;

  const sourceData = getCurrentRoom()?.file?.data || {};
  const tileCount = getMapTileCount();
  const hitboxes = getHitboxes();
  const patch = { ...room.file.data };

  if (hitboxes?.length) patch.hitboxes = hitboxes.slice();
  if (tileCount) patch.tileCount = tileCount;
  if (sandboxPatch && baseTilesSnapshot != null && tileCount) {
    patch.tiles = buildNativeOnlyTilesPatch(tileCount);
  }
  if (sandboxPatch && !editorPlacedVillains.size) {
    delete patch.actors;
  }

  const builtData = compactRoomFileDataForExport(
    preserveNativeRoomLayersInExport(
      sanitizeRoomFileDataForRuntime(
        mergeNativeRoomDataPatch(sourceData, patch, tileCount),
        sourceData
      ),
      tileCount
    )
  );

  // Sandbox: keep floor-below native-only in the room React renders — editor-added
  // floor-below sprites are re-injected into #floor-below by
  // reapplyAddedFloorBelowDomFromConfigs(), so baking them into the patch too would
  // render each one twice.
  if (sandboxPatch && tileCount && Object.keys(editorEdits.addedFloorBelowConfigs).length) {
    const nativeFloorBelow = serializeIndexedLayerForGameRuntime(
      normalizeIndexedRoomLayer(baseFloorBelowSnapshot, tileCount)
    );
    if (nativeFloorBelow !== undefined) builtData.floorBelowTiles = nativeFloorBelow;
    else delete builtData.floorBelowTiles;
  }

  room.file.data = builtData;
  return room;
}

function getCustomBattleVillainTileIndexes(villains) {
  const indexes = new Set();
  (villains || []).forEach((villain) => {
    const tileIndex = villain?.tileIndex ?? villain?.tile;
    if (Number.isFinite(tileIndex)) indexes.add(Math.floor(tileIndex));
  });
  return indexes;
}

function sanitizeVillainConfigForExport(villain) {
  if (!villain || typeof villain !== 'object') return null;
  const clean = cloneJson(villain);
  delete clean.keyPrefix;
  delete clean.key;
  return clean;
}

function sanitizeVillainListForExport(villains) {
  return (villains || [])
    .map((villain) => sanitizeVillainConfigForExport(villain))
    .filter(Boolean);
}

function resolveMapEditorV2TileSprites(tileRef, templates) {
  if (!tileRef || typeof tileRef !== 'object') return null;
  if (Array.isArray(tileRef.sprites)) return cloneJson(tileRef.sprites);
  const templateId = tileRef.template;
  if (!templateId || !templates || typeof templates !== 'object') return null;
  const template = templates[templateId];
  if (!Array.isArray(template?.sprites)) return null;
  return cloneJson(template.sprites);
}

/** Drop actors on templates no tile still references (after villain tiles were inlined). */
function pruneOrphanedMapEditorV2TemplateActors(mapEditorV2) {
  const templates = mapEditorV2?.file?.data?.templates;
  const tiles = mapEditorV2?.file?.data?.tiles;
  if (!templates || typeof templates !== 'object' || !Array.isArray(tiles)) return 0;

  const referenced = new Set();
  tiles.forEach((tileRef) => {
    if (tileRef?.template) referenced.add(tileRef.template);
  });

  let pruned = 0;
  Object.keys(templates).forEach((templateId) => {
    const template = templates[templateId];
    if (!template?.actor) return;
    if (referenced.has(templateId)) return;
    delete template.actor;
    pruned += 1;
  });

  if (pruned && mapEditorV2?.stats) {
    mapEditorV2.stats.actorTiles = tiles.filter((tileRef) => {
      if (tileRef?.actor) return true;
      const templateId = tileRef?.template;
      return !!(templateId && templates?.[templateId]?.actor);
    }).length;
  }
  return pruned;
}

/**
 * Collapse duplicate/conflicting scene sprite rules.
 * Same sourceId → last replacement wins; identical mappings are merged.
 */
function normalizeSceneSpriteReplacementRules(rules) {
  if (!Array.isArray(rules) || !rules.length) return [];

  const bySource = new Map();
  rules.forEach((rule) => {
    if (!rule || rule.replacementId == null) return;
    const scope = rule.scope || 'tile';
    const sourceIds = Array.isArray(rule.sourceIds) ? rule.sourceIds : [];
    sourceIds.forEach((rawId) => {
      if (rawId == null) return;
      const sourceId = Number(rawId);
      bySource.set(Number.isFinite(sourceId) ? sourceId : rawId, {
        replacementId: rule.replacementId,
        scope
      });
    });
  });

  const groups = new Map();
  bySource.forEach((meta, sourceId) => {
    const key = `${meta.scope}::${meta.replacementId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        sourceIds: [],
        replacementId: meta.replacementId,
        scope: meta.scope
      });
    }
    groups.get(key).sourceIds.push(sourceId);
  });

  return Array.from(groups.values()).map((group) => ({
    sourceIds: group.sourceIds.slice().sort((a, b) => Number(a) - Number(b)),
    replacementId: group.replacementId,
    scope: group.scope
  }));
}

function buildSceneSpriteReplacementsPayload(rules) {
  const normalized = normalizeSceneSpriteReplacementRules(rules);
  if (!normalized.length) return null;
  return {
    rootId: 'background-scene',
    rules: normalized
  };
}

function stripMapEditorV2ActorsForVillainTiles(mapEditorV2, villainTileIndexes) {
  if (!villainTileIndexes?.size) return 0;

  let stripped = 0;
  const v2Data = mapEditorV2?.file?.data;
  const v2Tiles = v2Data?.tiles;
  const templates = v2Data?.templates;
  if (!Array.isArray(v2Tiles)) return 0;

  v2Tiles.forEach((tileRef) => {
    const tileIndex = tileRef?.i;
    if (!Number.isFinite(tileIndex) || !villainTileIndexes.has(tileIndex)) return;

    if (tileRef.actor) {
      delete tileRef.actor;
      stripped += 1;
    }

    // Template-backed villain tiles can still carry actors via the template.
    // Inline sprites (without actor) so CustomBattles owns those tiles alone.
    const templateId = tileRef.template;
    if (!templateId || !templates?.[templateId]) return;
    const template = templates[templateId];
    if (!template?.actor) return;
    const sprites = resolveMapEditorV2TileSprites(tileRef, templates);
    const hitbox = tileRef.hitbox != null ? !!tileRef.hitbox : !!template.hitbox;
    delete tileRef.template;
    if (sprites) tileRef.sprites = sprites;
    tileRef.hitbox = hitbox;
    delete tileRef.actor;
    stripped += 1;
  });

  stripped += pruneOrphanedMapEditorV2TemplateActors(mapEditorV2);

  if (mapEditorV2?.stats) {
    mapEditorV2.stats.actorTiles = v2Tiles.filter((tileRef) => {
      if (tileRef?.actor) return true;
      const templateId = tileRef?.template;
      return !!(templateId && templates?.[templateId]?.actor);
    }).length;
  }

  return stripped;
}

function buildCustomBattleStubFromExport(exportPayload, options = {}) {
  const payload = exportPayload || buildWholeMapExport();
  if (!payload?.id) return null;

  const stub = {
    name: options.name || payload.roomName || payload.id,
    roomId: options.roomId || payload.id,
    villains: sanitizeVillainListForExport(options.villains),
    allies: sanitizeVillainListForExport(options.allies),
    allyLimit: options.allyLimit ?? payload.maxTeamSize ?? 6,
    preventVillainMovement: options.preventVillainMovement ?? false,
    victoryDefeat: {
      reloadRoomOnClose: true
    },
    _note: 'Add activationCheck, victoryDefeat handlers, tileRestrictions, and villains before CustomBattles.create().'
  };

  if (payload.sceneSpriteReplacements?.rules?.length) {
    stub.sceneSpriteReplacements = cloneJson(payload.sceneSpriteReplacements);
  }
  if (options.tileRestrictions) stub.tileRestrictions = cloneJson(options.tileRestrictions);
  if (options.entrySetup) stub.entrySetup = cloneJson(options.entrySetup);
  return stub;
}

function slugifyQuestRoomKey(roomName, roomId) {
  const fromName = String(roomName || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (fromName) return fromName;
  const fromId = String(roomId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return fromId || 'custom_room';
}

function convertEditorEquipToQuestBattleEquip(equip) {
  if (!equip || typeof equip !== 'object') return null;
  const gameId = Number(equip.gameId ?? equip.id);
  const hasGameId = Number.isFinite(gameId) && gameId > 0;
  const name = equip.name || (hasGameId ? getEquipmentDisplayName(gameId) : '');
  const entry = {
    stat: equip.stat || 'ad',
    tier: equip.tier != null ? equip.tier : 1
  };
  // battles.json accepts either name or gameId (Quests resolveBattleUnitEquip).
  if (name) entry.name = name;
  if (hasGameId) entry.gameId = gameId;
  if (!entry.name && entry.gameId == null) return null;
  return entry;
}

function resolveEditorVillainGameId(villain) {
  if (!villain || typeof villain !== 'object') return null;
  const fromFields = resolveCreatureGameId(villain);
  if (fromFields != null) return fromFields;
  const fallback = Number(villain.fallbackGameId);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}

function convertEditorVillainToQuestBattleVillain(villain) {
  if (!villain || typeof villain !== 'object') return null;
  const tileIndex = Number(villain.tileIndex);
  if (!Number.isFinite(tileIndex)) return null;

  const gameId = resolveEditorVillainGameId(villain);
  const nickname = String(villain.nickname || (gameId != null ? getCreatureDisplayName(gameId) : 'Villain')).trim() || 'Villain';
  const slug = nickname.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'villain';
  const entry = {
    nickname,
    tileIndex,
    keyPrefix: `${slug}-tile-${tileIndex}-`,
    fallbackGameId: gameId != null ? gameId : 1,
    level: villain.level != null ? villain.level : 1,
    direction: villain.direction || 'south'
  };

  const creatureName = villain.creatureName || (gameId != null ? getCreatureDisplayName(gameId) : null);
  if (creatureName) entry.creatureName = creatureName;
  if (villain.tier != null) entry.tier = villain.tier;
  if (villain.shiny != null) entry.shiny = !!villain.shiny;
  if (villain.awakened != null) entry.awakened = !!villain.awakened;
  if (villain.outfitSpriteId != null) entry.outfitSpriteId = villain.outfitSpriteId;
  if (villain.itemSpriteId != null) entry.itemSpriteId = villain.itemSpriteId;
  if (villain.customSpriteKey != null) entry.customSpriteKey = villain.customSpriteKey;
  if (villain.genes && typeof villain.genes === 'object') entry.genes = cloneJson(villain.genes);
  const equip = convertEditorEquipToQuestBattleEquip(villain.equip);
  if (equip) entry.equip = equip;
  return entry;
}

/**
 * Hydrated CustomBattles.create() villain shape (gameId required), matching
 * Quests getHydratedQuestBattleSpawn() output for spider_lair / putrid_chamber.
 */
function convertEditorVillainToCustomBattleVillain(villain) {
  const questVillain = convertEditorVillainToQuestBattleVillain(villain);
  if (!questVillain) return null;
  const gameId = resolveEditorVillainGameId(villain) ?? questVillain.fallbackGameId ?? 1;
  const entry = {
    nickname: questVillain.nickname,
    keyPrefix: questVillain.keyPrefix,
    tileIndex: questVillain.tileIndex,
    gameId,
    level: questVillain.level,
    tier: questVillain.tier != null ? questVillain.tier : 0,
    direction: questVillain.direction
  };
  if (questVillain.genes) entry.genes = cloneJson(questVillain.genes);
  if (questVillain.outfitSpriteId != null) entry.outfitSpriteId = questVillain.outfitSpriteId;
  if (questVillain.itemSpriteId != null) entry.itemSpriteId = questVillain.itemSpriteId;
  if (questVillain.customSpriteKey != null) entry.customSpriteKey = questVillain.customSpriteKey;
  if (questVillain.shiny != null) entry.shiny = !!questVillain.shiny;
  if (questVillain.awakened != null) entry.awakened = !!questVillain.awakened;
  if (questVillain.equip?.gameId != null) {
    entry.equip = {
      gameId: questVillain.equip.gameId,
      stat: questVillain.equip.stat || 'ad',
      tier: questVillain.equip.tier != null ? questVillain.equip.tier : 1
    };
  } else if (questVillain.equip?.name) {
    // Hydrated create() configs use gameId; keep name-only equip for Quests resolveBattleUnitEquip.
    entry.equip = cloneJson(questVillain.equip);
  }
  return entry;
}

function buildQuestBattleFromEditorRules(battleRules, roomMeta = {}) {
  // Match assets/quests/battles.json entries like spider_lair / putrid_chamber.
  const battle = {
    allyLimit: battleRules?.allyLimit ?? roomMeta.maxTeamSize ?? 6,
    preventVillainMovement: battleRules?.preventVillainMovement !== false,
    hideVillainSprites: battleRules?.hideVillainSprites !== false,
    villains: (battleRules?.villains || [])
      .map((villain) => convertEditorVillainToQuestBattleVillain(villain))
      .filter(Boolean)
  };

  const allowedTiles = battleRules?.tileRestrictions?.allowedTiles
    || battleRules?.allowedPlacementTiles
    || null;
  if (Array.isArray(allowedTiles) && allowedTiles.length) {
    battle.allowedTiles = allowedTiles.slice();
    battle.allowedTilesMessage = battleRules?.tileRestrictions?.message
      || 'Ally creatures can only be placed on the marked tiles!';
  }
  if (Array.isArray(battleRules?.tileRestrictions?.blockedTiles)
    && battleRules.tileRestrictions.blockedTiles.length) {
    battle.blockedTiles = battleRules.tileRestrictions.blockedTiles.slice();
    if (battleRules.tileRestrictions.blockedMessage) {
      battle.blockedTilesMessage = battleRules.tileRestrictions.blockedMessage;
    }
  }
  return battle;
}

/**
 * Exact CustomBattles.create() payload Quests builds for battles like Spider Lair
 * (after getHydratedQuestBattleSpawn). Functions cannot be JSON-serialized — see _wireInQuests.
 */
function buildQuestCustomBattleCreateConfig({
  roomName,
  roomId,
  battleId,
  battleJson,
  editorVillains = null,
  sceneSpriteReplacements = null
} = {}) {
  const tileRestrictions = {};
  if (Array.isArray(battleJson?.allowedTiles) && battleJson.allowedTiles.length) {
    tileRestrictions.allowedTiles = battleJson.allowedTiles.slice();
    tileRestrictions.message = battleJson.allowedTilesMessage
      || 'Ally creatures can only be placed on the marked tiles!';
  }
  if (Array.isArray(battleJson?.blockedTiles) && battleJson.blockedTiles.length) {
    tileRestrictions.blockedTiles = battleJson.blockedTiles.slice();
    tileRestrictions.blockedMessage = battleJson.blockedTilesMessage
      || 'That tile is blocked!';
    if (!tileRestrictions.message) {
      tileRestrictions.message = tileRestrictions.blockedMessage;
    }
  }

  const villainSource = Array.isArray(editorVillains) && editorVillains.length
    ? editorVillains
    : (battleJson?.villains || []);

  const config = {
    name: roomName || battleId || roomId,
    roomId,
    villains: villainSource
      .map((villain) => convertEditorVillainToCustomBattleVillain(villain))
      .filter(Boolean),
    allyLimit: battleJson?.allyLimit ?? 6,
    preventVillainMovement: battleJson?.preventVillainMovement !== false,
    hideVillainSprites: battleJson?.hideVillainSprites !== false,
    victoryDefeat: {
      reloadRoomOnClose: true,
      victoryTitle: 'Victory!',
      defeatTitle: 'Defeat',
      victoryMessage: '',
      defeatMessage: '',
      showItems: false,
      items: []
    },
    _wireInQuests: {
      pattern: 'spider_lair',
      battleId,
      battlesJsonKey: battleId,
      hydrate: `const spawn = getHydratedQuestBattleSpawn('${battleId}');`,
      create: 'window.CustomBattles.create({ name, roomId, villains: spawn.villains, allyLimit: spawn.allyLimit, preventVillainMovement, hideVillainSprites, tileRestrictions, sceneSpriteReplacements, activationCheck, victoryDefeat })',
      activationCheck: '(isSandbox, inBattleArea) => isSandbox && inBattleArea && <questEntryFlag>',
      // If this room has any rooms.tileMutations (decorative sprites and/or per-tile hitbox
      // overrides), call battle.startPersistentVisualSync(applyYourTileMutations, { isActiveCheck })
      // ONCE, right inside scheduleEntryVillainSetup's onComplete callback — see
      // setupHellgateBattleInstance() in Quests.js for the reference implementation. Do NOT
      // hand-roll your own fixed retry-timer burst or your own board.subscribe() for this;
      // CustomBattle now owns that lifecycle (including automatic teardown in cleanup()) as a
      // single shared implementation. Skipping this was exactly the bug Hellgate Part 1 shipped
      // with: it only had a fixed ~2s retry burst after entry, so nothing ever re-applied tile
      // mutations or re-synced the placement hitbox mask again after that — any ally placed
      // later in the fight could leave allowed/blocked tiles stuck wrong for good.
      visualSync: 'battle.startPersistentVisualSync(applyYourTileMutations, { isActiveCheck: () => <questEntryFlag> })',
      note: 'Copy battles.<battleId> into assets/quests/battles.json, then mirror createHellgateBattleInstance in Quests.js using customBattle fields + spawn.villains + the visualSync call above (skip it only if this quest has no rooms.tileMutations at all).'
    }
  };

  if (Object.keys(tileRestrictions).length) {
    config.tileRestrictions = tileRestrictions;
  }
  if (sceneSpriteReplacements?.rules?.length) {
    config.sceneSpriteReplacements = cloneJson(sceneSpriteReplacements);
  }
  return config;
}

/**
 * Diff live Map Editor tiles vs the base room snapshot into rooms.json-style mutations.
 * Tile-keyed: { "<tileIndex>": { add?: [...], remove?: [spriteId], hitbox?: boolean } }
 */
function buildQuestTileMutationsFromEditor() {
  const tileCount = getMapTileCount();
  if (!tileCount) return null;

  const byTile = new Map();

  const ensureTile = (tileIndex) => {
    const key = String(tileIndex);
    if (!byTile.has(key)) byTile.set(key, {});
    return byTile.get(key);
  };

  const pushAdd = (tileIndex, compact) => {
    if (!compact?.id) return;
    const entry = { spriteId: compact.id };
    if (compact.cropX != null) entry.cropX = compact.cropX;
    if (compact.cropY != null) entry.cropY = compact.cropY;
    if (compact.cropped) entry.cropped = true;
    if (compact.bank != null) entry.bank = compact.bank;
    if (compact.offsetX != null) entry.offsetX = compact.offsetX;
    if (compact.offsetY != null) entry.offsetY = compact.offsetY;
    const tile = ensureTile(tileIndex);
    if (!tile.add) tile.add = [];
    tile.add.push(entry);
  };

  const pushRemove = (tileIndex, spriteId) => {
    if (spriteId == null) return;
    const id = Number(spriteId);
    const tile = ensureTile(tileIndex);
    if (!tile.remove) tile.remove = [];
    if (!tile.remove.includes(id)) tile.remove.push(id);
  };

  for (let tileIndex = 0; tileIndex < tileCount; tileIndex += 1) {
    const session = buildTileSessionEntry(tileIndex);
    const original = getOriginalTileLayer(tileIndex) || [];

    if (session?.sprites?.length) {
      const visible = session.sprites.filter((sprite) => sprite && !sprite.hidden && sprite.id != null);
      const hidden = session.sprites.filter((sprite) => sprite?.hidden && sprite.id != null);

      hidden.forEach((sprite) => pushRemove(tileIndex, sprite.id));

      visible.forEach((sprite) => {
        const compact = compactSpriteConfig(sprite);
        if (!compact) return;
        if (sprite.added) {
          pushAdd(tileIndex, compact);
          return;
        }
        const originalMatch = original.find((entry) => entry?.id === compact.id);
        if (!originalMatch) {
          pushAdd(tileIndex, compact);
          return;
        }
        if (!spriteConfigEquals(compact, compactSpriteConfig(originalMatch) || originalMatch)) {
          // Same id still present but crop/bank/etc changed — remove old visual, add new config.
          pushRemove(tileIndex, compact.id);
          pushAdd(tileIndex, compact);
        }
      });

      original.forEach((entry) => {
        if (entry?.id == null) return;
        const stillVisible = visible.some((sprite) => sprite.id === entry.id);
        const markedHidden = hidden.some((sprite) => sprite.id === entry.id);
        if (!stillVisible && !markedHidden) pushRemove(tileIndex, entry.id);
      });
    }

    if (Object.prototype.hasOwnProperty.call(editorEdits.hitboxOverrides, tileIndex)) {
      ensureTile(tileIndex).hitbox = !!editorEdits.hitboxOverrides[tileIndex];
    }
  }

  // Editor-added floor-below sprites (editorEdits.addedFloorBelowConfigs) — the export
  // used to drop these entirely, so quest reskins that relied on a painted floor-below
  // layer came through empty. Emit them per tile as `floorBelow: [{spriteId, ...floor}]`.
  for (const [key, configs] of Object.entries(editorEdits.addedFloorBelowConfigs || {})) {
    if (!Array.isArray(configs) || !configs.length) continue;
    const tileIndex = Number(key);
    if (!Number.isFinite(tileIndex)) continue;
    const list = [];
    configs.forEach((cfg) => {
      const compact = compactSpriteConfig(cfg);
      if (!compact?.id) return;
      const entry = { spriteId: compact.id };
      if (compact.cropX != null) entry.cropX = compact.cropX;
      if (compact.cropY != null) entry.cropY = compact.cropY;
      if (compact.cropped) entry.cropped = true;
      if (compact.bank != null) entry.bank = compact.bank;
      if (compact.offsetX != null) entry.offsetX = compact.offsetX;
      if (compact.offsetY != null) entry.offsetY = compact.offsetY;
      const floor = clampFloorDepth(cfg.floor ?? compact.floor ?? 1);
      if (floor > 1) entry.floor = floor;
      list.push(entry);
    });
    if (list.length) ensureTile(tileIndex).floorBelow = list;
  }

  if (!byTile.size) return null;

  const mutations = {};
  for (const key of [...byTile.keys()].sort((a, b) => Number(a) - Number(b))) {
    const tile = byTile.get(key);
    if (tile.remove?.length) tile.remove.sort((a, b) => a - b);
    else delete tile.remove;
    if (!tile.add?.length) delete tile.add;
    if (!tile.floorBelow?.length) delete tile.floorBelow;
    mutations[key] = tile;
  }
  return Object.keys(mutations).length ? mutations : null;
}

/**
 * Quest-compatible export for pasting into assets/quests + wiring CustomBattles in Quests.js.
 * Same split as Mother of All Spiders / Spider Lair — no separate map JSON:
 * - battles[battleId] → assets/quests/battles.json
 * - rooms[roomKey] → assets/quests/rooms.json (room meta + tileMutations / sceneSpriteReplacements)
 * - customBattle → exact CustomBattles.create() fields for Quests.js (not an asset file)
 */
function buildQuestRoomExport(options = {}) {
  const bundle = buildUnifiedMapExport({ includeNativeRoom: !!options.includeNativeRoom });
  if (!bundle?.roomId) return null;

  const roomKey = options.roomKey || slugifyQuestRoomKey(bundle.roomName, bundle.roomId);
  const battleId = options.battleId || roomKey;
  const battleRules = getMapEditorBattleRules();
  const battle = buildQuestBattleFromEditorRules(battleRules, {
    maxTeamSize: bundle.mapEditorV2?.maxTeamSize
  });
  const sceneSpriteReplacements = bundle.sceneSpriteReplacements?.rules?.length
    ? cloneJson(bundle.sceneSpriteReplacements)
    : null;
  const tileMutations = buildQuestTileMutationsFromEditor();

  const roomsEntry = {
    roomName: bundle.roomName || roomKey,
    roomId: bundle.roomId,
    battleId
  };
  if (tileMutations) {
    roomsEntry.tileMutations = tileMutations;
  }
  if (sceneSpriteReplacements) {
    roomsEntry.sceneSpriteReplacements = sceneSpriteReplacements;
  }

  const customBattle = buildQuestCustomBattleCreateConfig({
    roomName: roomsEntry.roomName,
    roomId: bundle.roomId,
    battleId,
    battleJson: battle,
    editorVillains: battleRules.villains,
    sceneSpriteReplacements
  });

  const howto = [
    `1. Merge battles.${battleId} into assets/quests/battles.json (same shape as spider_lair).`,
    `2. Merge rooms.${roomKey} into assets/quests/rooms.json (roomName/roomId/battleId[+tileMutations][+sceneSpriteReplacements]).`,
    '3. In Quests.js, apply rooms.tileMutations (tile-keyed add/remove/hitbox), then mirror createSpiderLairBattleInstance with customBattle + spawn.villains.',
    '4. Wire activationCheck / victoryDefeat (mission flags, rewards, navigate-on-close). customBattle._wireInQuests has the stubs.',
    '5. If this room has tileMutations, call battle.startPersistentVisualSync(applyYourTileMutations, { isActiveCheck }) once in scheduleEntryVillainSetup\'s onComplete — see customBattle._wireInQuests.visualSync and createHellgateBattleInstance in Quests.js. Do not hand-roll a fixed retry burst or your own board.subscribe() for this.'
  ];
  if (battleRules.allies.length) {
    howto.push(
      `NOTE: ${battleRules.allies.length} tile(s) marked "Fights as ally" in Map Editor were NOT `
      + 'included — this quest-JSON format has no forced-ally field yet. Add them manually if needed.'
    );
  }

  return {
    format: 'quest-room-export-v1',
    exportedAt: bundle.exportedAt || new Date().toISOString(),
    roomKey,
    battleId,
    _howto: howto,
    rooms: {
      [roomKey]: roomsEntry
    },
    battles: {
      [battleId]: battle
    },
    customBattle
  };
}

/**
 * The single "Export Map (JSON)" payload — a full map-editor-bundle-v1 (everything Import
 * needs to round-trip the map) with a `questExport` side-car carrying the same paste-ready
 * fields buildQuestRoomExport() produces (rooms.json/battles.json shapes, tileMutations,
 * _wireInQuests stub) for hand-merging the room into this mod's own quest content. Import
 * only reads mapEditorV2/customBattle/roomId/roomName, so questExport is inert baggage to it.
 */
function buildFullMapExport(options = {}) {
  const bundle = buildUnifiedMapExport({ includeNativeRoom: !!options.includeNativeRoom });
  if (!bundle?.roomId) return null;

  const roomKey = options.roomKey || slugifyQuestRoomKey(bundle.roomName, bundle.roomId);
  const battleId = options.battleId || roomKey;
  const battleRules = getMapEditorBattleRules();
  const battle = buildQuestBattleFromEditorRules(battleRules, {
    maxTeamSize: bundle.mapEditorV2?.maxTeamSize
  });
  const sceneSpriteReplacements = bundle.sceneSpriteReplacements?.rules?.length
    ? cloneJson(bundle.sceneSpriteReplacements)
    : null;
  const tileMutations = buildQuestTileMutationsFromEditor();

  const roomsEntry = {
    roomName: bundle.roomName || roomKey,
    roomId: bundle.roomId,
    battleId
  };
  if (tileMutations) roomsEntry.tileMutations = tileMutations;
  if (sceneSpriteReplacements) roomsEntry.sceneSpriteReplacements = sceneSpriteReplacements;

  const questCustomBattle = buildQuestCustomBattleCreateConfig({
    roomName: roomsEntry.roomName,
    roomId: bundle.roomId,
    battleId,
    battleJson: battle,
    editorVillains: battleRules.villains,
    sceneSpriteReplacements
  });

  const howto = [
    `1. Merge battles.${battleId} into assets/quests/battles.json (same shape as spider_lair).`,
    `2. Merge rooms.${roomKey} into assets/quests/rooms.json (roomName/roomId/battleId[+tileMutations][+sceneSpriteReplacements]).`,
    '3. In Quests.js, apply rooms.tileMutations (tile-keyed add/remove/hitbox), then mirror createSpiderLairBattleInstance with customBattle + spawn.villains.',
    '4. Wire activationCheck / victoryDefeat (mission flags, rewards, navigate-on-close). customBattle._wireInQuests has the stubs.',
    '5. If this room has tileMutations, call battle.startPersistentVisualSync(applyYourTileMutations, { isActiveCheck }) once in scheduleEntryVillainSetup\'s onComplete — see customBattle._wireInQuests.visualSync and createHellgateBattleInstance in Quests.js. Do not hand-roll a fixed retry burst or your own board.subscribe() for this.'
  ];
  if (battleRules.allies.length) {
    howto.push(
      `NOTE: ${battleRules.allies.length} tile(s) marked "Fights as ally" in Map Editor were NOT `
      + 'included — this quest-JSON format has no forced-ally field yet. Add them manually if needed.'
    );
  }

  bundle.questExport = {
    roomKey,
    battleId,
    _howto: howto,
    rooms: { [roomKey]: roomsEntry },
    battles: { [battleId]: battle },
    customBattle: questCustomBattle
  };

  return bundle;
}

function buildUnifiedMapExport(options = {}) {
  const { includeNativeRoom = false } = options;
  removeEphemeralSpritesFromTiles();
  const mapEditorV2 = buildWholeMapExport();
  if (!mapEditorV2) return null;

  const battleRules = getMapEditorBattleRules();
  const battleBase = buildCustomBattleStubFromExport(mapEditorV2, {
    villains: battleRules.villains,
    allies: battleRules.allies,
    allyLimit: battleRules.allyLimit,
    tileRestrictions: battleRules.tileRestrictions
  });
  const customBattle = battleBase ? {
    name: battleBase.name,
    roomId: battleBase.roomId,
    villains: battleBase.villains || [],
    allies: battleBase.allies || [],
    allyLimit: battleBase.allyLimit,
    tileRestrictions: battleBase.tileRestrictions,
    sceneSpriteReplacements: battleBase.sceneSpriteReplacements,
    activationCheck: '(isSandbox, inBattleArea) => isSandbox && inBattleArea',
    victoryDefeat: battleBase.victoryDefeat
  } : null;

  const villainTileIndexes = getCustomBattleVillainTileIndexes(customBattle?.villains);
  const allyTileIndexes = getCustomBattleVillainTileIndexes(customBattle?.allies);
  allyTileIndexes.forEach((tileIndex) => villainTileIndexes.add(tileIndex));
  if (villainTileIndexes.size) {
    const strippedActors = stripMapEditorV2ActorsForVillainTiles(mapEditorV2, villainTileIndexes);
    if (strippedActors) {
      logMapEditor('exportUnifiedStripRoomActors', {
        roomId: mapEditorV2.id,
        villainTiles: villainTileIndexes.size,
        strippedActors
      });
    }
  } else {
    pruneOrphanedMapEditorV2TemplateActors(mapEditorV2);
  }

  const payload = {
    format: 'map-editor-bundle-v1',
    exportedAt: mapEditorV2.exportedAt,
    roomId: mapEditorV2.id,
    roomName: mapEditorV2.roomName,
    stats: mapEditorV2.stats,
    mapEditorV2,
    customBattle
  };

  if (includeNativeRoom) {
    payload.nativeRoom = buildNativeRoomExport();
    if (villainTileIndexes.size && payload.nativeRoom?.file?.data) {
      const nativeData = payload.nativeRoom.file.data;
      const tileCount = getRoomDataTileCount(nativeData);
      const actors = normalizeRoomActorsForGame(nativeData.actors, tileCount);
      if (actors) {
        villainTileIndexes.forEach((tileIndex) => {
          if (tileIndex >= 0 && tileIndex < actors.length) actors[tileIndex] = null;
        });
        const runtimeActors = serializeActorsForGameRuntime(actors);
        if (runtimeActors !== undefined) nativeData.actors = runtimeActors;
        else delete nativeData.actors;
      }
    }
  }

  const rules = buildSceneReplacementRules();
  const sceneSpriteReplacements = buildSceneSpriteReplacementsPayload(rules);
  if (sceneSpriteReplacements) {
    payload.sceneSpriteReplacements = sceneSpriteReplacements;
  } else if (mapEditorV2.sceneSpriteReplacements) {
    payload.sceneSpriteReplacements = buildSceneSpriteReplacementsPayload(
      mapEditorV2.sceneSpriteReplacements.rules
    ) || cloneJson(mapEditorV2.sceneSpriteReplacements);
  }

  if (editorState.selectedTileIndex != null) {
    payload.selectedTile = buildTileExport(editorState.selectedTileIndex);
  }

  return payload;
}

function waitForCustomBattles(options = {}) {
  const { maxRetries = 40, intervalMs = 250 } = options;
  if (typeof window !== 'undefined' && window.CustomBattles?.create) {
    return Promise.resolve(window.CustomBattles);
  }
  return new Promise((resolve) => {
    let retries = 0;
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.CustomBattles?.create) {
        clearInterval(timer);
        resolve(window.CustomBattles);
        return;
      }
      retries += 1;
      if (retries >= maxRetries) {
        clearInterval(timer);
        resolve(null);
      }
    }, intervalMs);
  });
}

function collectRoomReferences(roomId) {
  if (!roomId) return [];
  const refs = [];
  const utils = globalThis.state?.utils;
  if (Array.isArray(utils?.ROOMS)) {
    const room = utils.ROOMS.find((entry) => entry?.id === roomId);
    if (room) refs.push(room);
  }
  if (Array.isArray(utils?.REGIONS)) {
    for (const region of utils.REGIONS) {
      for (const room of region.rooms || []) {
        if (room?.id === roomId) refs.push(room);
      }
    }
  }
  return [...new Set(refs)];
}

function snapshotRoomDataForTest(roomId) {
  const refs = collectRoomReferences(roomId);
  if (!refs.length) return false;
  mapEditorTestRoomSnapshot = {
    roomId,
    entries: refs.map((room) => ({
      room,
      saved: {
        file: cloneRoomFileForSnapshot(room.file),
        difficulty: room.difficulty,
        maxTeamSize: room.maxTeamSize,
        staminaCost: room.staminaCost
      }
    }))
  };
  return true;
}

function applyMergedRoomDataToLiveRefs(roomId, mergedData, meta = {}) {
  if (!roomId || !mergedData) return false;
  const refs = collectRoomReferences(roomId);
  if (!refs.length) return false;
  const nextData = cloneJson(mergedData);
  applySparseActorsToRoomData(nextData);
  for (const room of refs) {
    room.file = room.file || {};
    const data = cloneJson(nextData);
    applySparseActorsToRoomData(data);
    room.file.data = data;
    if (meta.difficulty != null) room.difficulty = meta.difficulty;
    if (meta.maxTeamSize != null) room.maxTeamSize = meta.maxTeamSize;
    if (meta.staminaCost != null) room.staminaCost = meta.staminaCost;
  }
  return true;
}

function restoreRoomDataFromTestSnapshot() {
  const roomId = mapEditorTestRoomSnapshot?.roomId;
  if (!applyEditorOpenSnapshotToLiveRefs(roomId)) return false;
  scheduleReloadRoomTimer(() => {
    clearEditorTileDomCache();
  }, ROOM_RELOAD_SETTLE_MS);
  mapEditorTestRoomSnapshot = null;
  clearHitboxSnapshot();
  clearBaseTilesSnapshot();
  return true;
}

function applyEditorOpenSnapshotToLiveRefs(roomId) {
  if (!mapEditorTestRoomSnapshot?.entries?.length) return false;
  if (roomId && mapEditorTestRoomSnapshot.roomId !== roomId) return false;

  for (const { room, saved } of mapEditorTestRoomSnapshot.entries) {
    const sanitizedData = sanitizeRoomFileDataForRuntime(saved.file?.data);
    room.file = { ...cloneJson(saved.file), data: sanitizedData };
    if (saved.difficulty != null) room.difficulty = saved.difficulty;
    if (saved.maxTeamSize != null) room.maxTeamSize = saved.maxTeamSize;
    if (saved.staminaCost != null) room.staminaCost = saved.staminaCost;
  }
  return true;
}

function applyNativeRestoreRoomData(roomId, restorePlan, roomRestoreBackup) {
  let applied = false;
  if (roomRestoreBackup) {
    const built = buildRestoredFileDataFromBackup(roomRestoreBackup);
    if (built?.fileData?.data) {
      applyMergedRoomDataToLiveRefs(roomId, built.fileData.data, built.meta);
      restoreLayerSnapshotsFromBackup(roomRestoreBackup);
      applied = true;
      logMapEditor('nativeRestoreRoomData', {
        roomId,
        fromBackup: true,
        wasMapCleaned: restorePlan?.wasMapCleaned === true
      });
    }
  } else if (applyEditorOpenSnapshotToLiveRefs(roomId)) {
    applied = true;
    logMapEditor('nativeRestoreRoomData', { roomId, fromSnapshot: true });
  }
  if (applied) clearEditorTileDomCache();
  return applied;
}

function backupEditorRoomRestoreState(roomId) {
  const testSaved = mapEditorTestRoomSnapshot?.roomId === roomId
    ? mapEditorTestRoomSnapshot.entries?.[0]?.saved
    : null;
  return {
    roomId,
    savedFile: testSaved?.file ? cloneJson(testSaved.file) : null,
    savedRoomMeta: testSaved ? {
      difficulty: testSaved.difficulty,
      maxTeamSize: testSaved.maxTeamSize,
      staminaCost: testSaved.staminaCost
    } : null,
    tiles: baseTilesSnapshot ? cloneJson(baseTilesSnapshot) : null,
    hitboxes: baseHitboxesSnapshot ? [...baseHitboxesSnapshot] : null,
    actors: baseActorsSnapshot ? cloneJson(baseActorsSnapshot) : null,
    floorBelowTiles: baseFloorBelowSnapshot ? cloneJson(baseFloorBelowSnapshot) : null
  };
}

function buildRestoredFileDataFromBackup(backup) {
  if (!backup?.roomId) return null;
  const refs = collectRoomReferences(backup.roomId);
  if (!refs.length) return null;
  const liveData = refs[0]?.file?.data;

  let fileData = null;
  if (backup.savedFile) {
    const restoredFile = cloneJson(backup.savedFile) || {};
    const tileCount = getRoomDataTileCount(restoredFile.data);
    if (backup.actors && tileCount && !roomActorsHaveEntries(restoredFile.data?.actors, tileCount)) {
      restoredFile.data = restoredFile.data || {};
      restoredFile.data.actors = normalizeRoomActorsForGame(backup.actors, tileCount);
    }
    const restoredFloorBelow = normalizeIndexedRoomLayer(restoredFile.data?.floorBelowTiles, tileCount);
    if (backup.floorBelowTiles && tileCount && !restoredFloorBelow?.some((entry) => entry != null)) {
      restoredFile.data = restoredFile.data || {};
      restoredFile.data.floorBelowTiles = cloneJson(backup.floorBelowTiles);
    }
    restoredFile.data = sanitizeRoomFileDataForRuntime(restoredFile.data, liveData);
    fileData = restoredFile;
  } else {
    const current = liveData;
    if (!current) return null;
    fileData = { data: cloneJson(current) };
    let hasPatch = false;
    if (backup.tiles) {
      fileData.data.tiles = cloneJson(backup.tiles);
      hasPatch = true;
    }
    if (backup.hitboxes) {
      fileData.data.hitboxes = backup.hitboxes.slice();
      hasPatch = true;
    }
    if (backup.actors) {
      fileData.data.actors = cloneJson(backup.actors);
      hasPatch = true;
    }
    if (backup.floorBelowTiles) {
      fileData.data.floorBelowTiles = cloneJson(backup.floorBelowTiles);
      hasPatch = true;
    }
    if (!hasPatch) return null;
    fileData.data = sanitizeRoomFileDataForRuntime(fileData.data, liveData);
  }

  return {
    fileData,
    meta: backup.savedRoomMeta || {}
  };
}

function restoreLayerSnapshotsFromBackup(backup) {
  if (backup.tiles) baseTilesSnapshot = cloneJson(backup.tiles);
  if (backup.hitboxes) baseHitboxesSnapshot = backup.hitboxes.slice();
  if (backup.actors) baseActorsSnapshot = cloneJson(backup.actors);
  if (backup.floorBelowTiles) baseFloorBelowSnapshot = cloneJson(backup.floorBelowTiles);
}

function clearEditorHiddenSpritesFromDom() {
  let cleared = 0;
  for (const tileEl of getActiveTileElements()) {
    for (const sprite of getAllSpritesOnTile(tileEl)) {
      if (!sprite.hasAttribute(HIDDEN_ATTR)) continue;
      sprite.style.visibility = '';
      sprite.style.display = '';
      sprite.style.pointerEvents = '';
      sprite.removeAttribute(HIDDEN_ATTR);
      cleared += 1;
    }
  }
  for (const sprite of getFloorBelowSprites()) {
    if (!sprite.hasAttribute(HIDDEN_ATTR)) continue;
    sprite.style.visibility = '';
    sprite.style.display = '';
    sprite.style.pointerEvents = '';
    sprite.removeAttribute(HIDDEN_ATTR);
    cleared += 1;
  }
  if (cleared) logMapEditor('clearHiddenSpriteDom', { cleared });
  return cleared;
}

function detachSandboxTestBoardHook() {
  if (sandboxTestAutoSetupHandler && globalThis.state?.board?.off) {
    try { globalThis.state.board.off('autoSetupBoard', sandboxTestAutoSetupHandler); } catch (e) {}
    sandboxTestAutoSetupHandler = null;
  }
  if (sandboxTestNewGameUnsubscribe) {
    try {
      if (typeof sandboxTestNewGameUnsubscribe === 'function') sandboxTestNewGameUnsubscribe();
    } catch (e) {}
    sandboxTestNewGameUnsubscribe = null;
  }
  if (sandboxTestEndGameUnsubscribe) {
    try {
      if (typeof sandboxTestEndGameUnsubscribe === 'function') sandboxTestEndGameUnsubscribe();
    } catch (e) {}
    sandboxTestEndGameUnsubscribe = null;
  }
  if (sandboxTestEmitNewGameUnsubscribe) {
    try {
      if (typeof sandboxTestEmitNewGameUnsubscribe === 'function') sandboxTestEmitNewGameUnsubscribe();
    } catch (e) {}
    sandboxTestEmitNewGameUnsubscribe = null;
  }
  if (sandboxTestBoardStateUnsubscribe) {
    try {
      if (typeof sandboxTestBoardStateUnsubscribe === 'function') sandboxTestBoardStateUnsubscribe();
      else if (sandboxTestBoardStateUnsubscribe?.unsubscribe) sandboxTestBoardStateUnsubscribe.unsubscribe();
    } catch (e) {}
    sandboxTestBoardStateUnsubscribe = null;
  }
  sandboxTestLastGameStarted = false;
  if (sandboxTestReapplyTimer) {
    clearTimeout(sandboxTestReapplyTimer);
    sandboxTestReapplyTimer = null;
  }
  detachMapEditorAllyDragHooks();
}

function clearSandboxTestPersistence() {
  detachSandboxTestBoardHook();
  mapEditorTestNativeRoom = null;
  nativeSpritePlacementCache.clear();
  if (mapEditorEditSessionRefreshTimer) {
    clearTimeout(mapEditorEditSessionRefreshTimer);
    mapEditorEditSessionRefreshTimer = null;
  }
}

function syncMapEditorTestNativeRoomSnapshot() {
  if (!editorState.sandboxTestActive) return false;
  const nativeRoom = buildNativeRoomExport({ sandboxPatch: true });
  if (!nativeRoom?.file?.data) return false;
  mapEditorTestNativeRoom = cloneJson(nativeRoom);
  return true;
}

function scheduleDeferredNativeSpritePlacementRestore() {
  requestAnimationFrame(() => requestAnimationFrame(() => restoreAllNativeSpritePlacements()));
  setTimeout(() => restoreAllNativeSpritePlacements(), 120);
}

function completeSandboxReapplyTail(reason = 'unknown', options = {}) {
  if (hasPendingEditorEdits() || reason !== 'edit-session-start') {
    finalizeSandboxRoomDomState(reason);
  }
  restoreAllNativeSpritePlacements();
  scheduleDeferredNativeSpritePlacementRestore();
  if (options.skipVillainBoardResync === true) {
    logMapEditor('villainApplySkipped', { reason, skip: 'skipVillainBoardResync' });
    syncMapEditorPlacementAllowSpawnMask();
    return;
  }
  if (restoreMapInProgress) {
    logMapEditor('villainApplySkipped', { reason, skip: 'restore-in-progress' });
    syncMapEditorPlacementAllowSpawnMask();
    return;
  }
  logBoardStateSnapshot('beforeVillainApply', { reason });
  applyEditorVillainsToBoard();
  logBoardStateSnapshot('afterVillainApply', { reason });
  syncMapEditorPlacementAllowSpawnMask();
}

function reapplySandboxEditorState(reason = 'unknown', options = {}) {
  if (!editorState.sandboxTestActive) return false;
  if (mapEditorTestBattle?.isRoomReloadInProgress?.()) return false;
  if (sandboxTestApplying) return false;

  const currentRoomId = getCurrentRoom()?.id;
  if (mapEditorTestNativeRoom?.id && currentRoomId && currentRoomId !== mapEditorTestNativeRoom.id) {
    return false;
  }

  if (hasPendingEditorEdits() && !editorEdits.mapCleaned) {
    syncMapEditorTestNativeRoomSnapshot();
  }

  completeSandboxReapplyTail(reason, options);
  return true;
}

function ensureSandboxTestRoomApplied(reason = 'unknown', options = {}) {
  return reapplySandboxEditorState(reason, options);
}

function scheduleSandboxBattleRestoreBurst(reason = 'battle-end') {
  if (!editorState.sandboxTestActive) return;
  removeEphemeralSpritesFromTiles();
  logMapEditor('sandboxBattleRestoreBurst', { reason });
  scheduleSandboxTestReapplyBurst([50, 150, 400, 800, 1500, 2500]);
  // Remask allow-spawn tiles after combat ends (CustomBattle also remasks; this covers editor hitbox reapply).
  setTimeout(() => syncMapEditorPlacementAllowSpawnMask(), 100);
  setTimeout(() => syncMapEditorPlacementAllowSpawnMask(), 500);
  if (editorState.open) refreshInspector();
}

function scheduleSandboxTestReapply(delayMs = 200) {
  if (!editorState.sandboxTestActive) return;
  if (sandboxTestReapplyTimer) clearTimeout(sandboxTestReapplyTimer);
  sandboxTestReapplyTimer = setTimeout(() => {
    sandboxTestReapplyTimer = null;
    reapplySandboxEditorState('scheduled');
  }, Math.max(100, Number(delayMs) || 0));
}

function scheduleSandboxTestReapplyBurst(delays = [100, 400, 800]) {
  if (!editorState.sandboxTestActive) return;
  delays.forEach((delayMs) => {
    const delay = Math.max(50, Number(delayMs) || 0);
    setTimeout(() => {
      if (!editorState.sandboxTestActive) return;
      reapplySandboxEditorState('burst');
    }, delay);
  });
}

function refreshMapEditorEditSession(options = {}) {
  const { refreshSnapshot = false, skipVillainBoardResync = false } = options;
  if (!editorState.sandboxTestActive) return false;
  if (refreshSnapshot && !editorEdits.mapCleaned && hasPendingEditorEdits()) {
    if (!syncMapEditorTestNativeRoomSnapshot()) return false;
  }
  return reapplySandboxEditorState('edit-refresh', { skipVillainBoardResync });
}

function notifyMapEditorEditsChanged(options = {}) {
  editorSessionChangeCount += 1;
  refreshEditorTileDomCache();
  if (!editorEdits.mapCleaned) {
    syncMapEditorTestNativeRoomSnapshot();
  }
  if (!editorState.sandboxTestActive) return;
  const skipVillainBoardResync = options.skipVillainBoardResync === true;
  requestAnimationFrame(() => {
    if (!editorState.sandboxTestActive) return;
    completeSandboxReapplyTail('edit-notify', { skipVillainBoardResync });
  });
}

function attachSandboxTestBoardHook() {
  detachSandboxTestBoardHook();
  if (!globalThis.state?.board?.on) return;

  attachMapEditorAllyDragHooks();

  sandboxTestAutoSetupHandler = () => {
    if (!editorState.sandboxTestActive) return;
    if (Date.now() < suppressSandboxAutoSetupReapplyUntil) return;
    scheduleSandboxTestReapply(250);
  };
  globalThis.state.board.on('autoSetupBoard', sandboxTestAutoSetupHandler);

  try {
    sandboxTestLastGameStarted = globalThis.state.board.getSnapshot()?.context?.gameStarted === true;
  } catch (e) {
    sandboxTestLastGameStarted = false;
  }

  const newGameResult = globalThis.state.board.on('newGame', () => {
    if (!editorState.sandboxTestActive) return;
    scheduleSandboxBattleRestoreBurst('newGame');
  });
  if (typeof newGameResult === 'function') {
    sandboxTestNewGameUnsubscribe = newGameResult;
  }

  const emitNewGameResult = globalThis.state.board.on('emitNewGame', () => {
    if (!editorState.sandboxTestActive) return;
    scheduleSandboxBattleRestoreBurst('emitNewGame');
  });
  if (typeof emitNewGameResult === 'function') {
    sandboxTestEmitNewGameUnsubscribe = emitNewGameResult;
  }

  const endGameResult = globalThis.state.board.on('emitEndGame', () => {
    if (!editorState.sandboxTestActive) return;
    scheduleSandboxBattleRestoreBurst('emitEndGame');
  });
  if (typeof endGameResult === 'function') {
    sandboxTestEndGameUnsubscribe = endGameResult;
  }

  sandboxTestBoardStateUnsubscribe = globalThis.state.board.subscribe((state) => {
    if (!editorState.sandboxTestActive) return;
    const gameStarted = state?.context?.gameStarted === true;
    if (sandboxTestLastGameStarted && !gameStarted) {
      scheduleSandboxBattleRestoreBurst('gameStarted-false');
    }
    sandboxTestLastGameStarted = gameStarted;
  });
}

function buildMapEditorTestBattleConfig(room) {
  const rules = getMapEditorBattleRules();
  const config = {
    name: t('mods.mapEditor.sandboxTestBattleName', 'Map Editor test'),
    roomId: room.id,
    villains: rules.villains,
    // keyPrefix corrected here (villain config default) so this matches what
    // applyEditorVillainsToBoard() writes once the sandbox test's first apply runs.
    allies: rules.allies.map((entry) => ({
      ...entry,
      keyPrefix: `${MAP_EDITOR_ALLY_KEY_PREFIX}${entry.tileIndex}-`
    })),
    allyLimit: rules.allyLimit,
    allowStopButton: true,
    // Yield board authority to quest/custom battles on the same room (ally limit, placement).
    activationCheck: (isSandbox, inBattleArea) => {
      if (!editorState.sandboxTestActive || !isSandbox || !inBattleArea) return false;
      try {
        const battles = window.CustomBattles?.getActiveBattles?.();
        if (Array.isArray(battles)) {
          const self = mapEditorTestBattle;
          const contested = battles.some((battle) => {
            if (!battle || battle === self || !battle.isActive) return false;
            if (battle.config?.roomId !== room.id) return false;
            if (typeof battle.getRestrictionPriority !== 'function') return false;
            if (typeof battle.shouldRestrictionsBeActive !== 'function') return false;
            // Other battle is "trying" to be active if its activationCallback/check passes
            // without Map Editor — prefer any battle that has victoryDefeat / higher priority.
            const otherPriority = battle.getRestrictionPriority();
            const selfPriority = self?.getRestrictionPriority?.() ?? -999;
            if (otherPriority <= selfPriority) return false;
            const boardContext = globalThis.state?.board?.getSnapshot?.()?.context;
            const otherSandbox = boardContext?.mode === 'sandbox';
            const otherInArea = battle.isInBattleArea?.() === true;
            if (battle.config.activationCheck) {
              return battle.config.activationCheck(otherSandbox, otherInArea);
            }
            return otherSandbox && otherInArea && (battle.activationCallback ? battle.activationCallback() : true);
          });
          if (contested) return false;
        }
      } catch (_) {}
      return true;
    }
  };
  if (rules.tileRestrictions) {
    config.tileRestrictions = cloneJson(rules.tileRestrictions);
  }
  return config;
}

function updateMapEditorSessionControls() {
  const hideNativeBtn = document.getElementById('map-editor-hide-native-btn');
  if (hideNativeBtn) {
    const active = isNativeSpritesBulkHidden();
    hideNativeBtn.textContent = active
      ? t('mods.mapEditor.showNativeSprites', 'Show map sprites')
      : t('mods.mapEditor.hideNativeSprites', 'Hide map sprites');
    hideNativeBtn.classList.toggle('me-btn-active', active);
  }
  const restoreBtn = document.getElementById('map-editor-restore-map-btn');
  if (!restoreBtn) return;
  restoreBtn.disabled = false;
}

function stopMapEditorSandboxTest(options = {}) {
  const {
    reloadRoom = true,
    silent = false,
    skipPlayModeChanges = false,
    skipSnapshotRestore = false,
    skipBoardRestore = false
  } = options;
  if (!editorState.sandboxTestActive && !mapEditorTestBattle) {
    mapEditorTestRoomSnapshot = null;
    clearSandboxTestPersistence();
    return false;
  }

  editorState.sandboxTestActive = false;
  notifyMapEditorOpenChanged();
  if (!shouldKeepMapEditorFloorLocked()) exitMapEditorFloorLock();
  clearSandboxTestPersistence();
  clearEditorPlacedVillains({ skipBoardPatch: skipBoardRestore === true });
  const room = getCurrentRoom();
  const roomId = mapEditorTestRoomSnapshot?.roomId || room?.id;
  const floor = getBoardFloor();

  if (mapEditorTestBattle) {
    try {
      mapEditorTestBattle.cleanup(
        skipBoardRestore
          ? () => {
            logMapEditor('skipCustomBattleBoardRestore', { reason: 'restore-in-progress' });
          }
          : undefined
      );
    } catch (e) {
      logMapEditor('sandboxTestCleanupFailed', e);
    }
    mapEditorTestBattle = null;
    if (!skipBoardRestore) {
      compactBoardConfigInGameState();
    }
  }

  if (!skipSnapshotRestore) {
    restoreRoomDataFromTestSnapshot();
  } else {
    mapEditorTestNativeRoom = null;
    clearEditorTileDomCache();
  }

  if (!skipPlayModeChanges) {
    try {
      // Always remain in sandbox after Map Editor sessions — never snap back to manual/normal.
      ensureMapEditorSandboxPlayMode();
      mapEditorSavedPlayMode = null;
    } catch (e) {
      // ignore
    }
  }

  if (reloadRoom && roomId) {
    reloadRoomFromGame(roomId, floor, { skipRevertEdits: true, reason: 'edit-session-end' });
  }

  if (editorState.open) {
    enableMapEditorBoardTools();
    refreshInspector();
  }

  if (!silent) {
    setStatusMessage(t('mods.mapEditor.editSessionEnded', 'Map edits restored to game data.'));
  }
  mapEditorDomSessionSource = null;
  logMapEditor('editSessionStopped', { roomId });
  return true;
}

async function ensureMapEditorEditSession(options = {}) {
  const {
    battleConfig = null,
    skipInitialVillainSync = false
  } = options;
  if (editorState.sandboxTestActive) {
    refreshMapEditorEditSession({ refreshSnapshot: true });
    return true;
  }

  const room = getCurrentRoom();
  if (!room?.id) return false;

  if (!mapEditorTestRoomSnapshot?.roomId || mapEditorTestRoomSnapshot.roomId !== room.id) {
    if (!snapshotRoomDataForTest(room.id)) {
      logMapEditor('editSessionNoRoomRef', { roomId: room.id });
      return false;
    }
  }
  if (!baseTilesSnapshot) captureBaseTilesSnapshot();

  const CustomBattles = await waitForCustomBattles();
  if (!CustomBattles?.create) {
    mapEditorTestRoomSnapshot = null;
    logMapEditor('editSessionUnavailable', { roomId: room.id });
    return false;
  }

  if (hasPendingEditorEdits()) {
    captureAllNativeSpritePlacements();
    const nativeRoom = buildNativeRoomExport();
    if (!nativeRoom?.file?.data) {
      mapEditorTestRoomSnapshot = null;
      logMapEditor('editSessionNoData', { roomId: room.id });
      return false;
    }
    mapEditorTestNativeRoom = cloneJson(nativeRoom);
  } else {
    mapEditorTestNativeRoom = null;
    captureAllNativeSpritePlacements();
  }

  try {
    const config = battleConfig || buildMapEditorTestBattleConfig(room);
    mapEditorTestBattle = CustomBattles.create(config);
    editorState.sandboxTestActive = true;
    notifyMapEditorOpenChanged();
    mapEditorTestBattle.setup(
      () => editorState.sandboxTestActive,
      (toastData) => {
        if (toastData?.message) setStatusMessage(toastData.message, !!toastData.isError);
      }
    );
  } catch (e) {
    editorState.sandboxTestActive = false;
    mapEditorTestBattle = null;
    clearSandboxTestPersistence();
    restoreRoomDataFromTestSnapshot();
    notifyMapEditorOpenChanged();
    logMapEditor('editSessionCreateFailed', e);
    return false;
  }

  attachSandboxTestBoardHook();
  ensureSandboxTestRoomApplied('edit-session-start', {
    skipVillainBoardResync: skipInitialVillainSync
  });
  syncMapEditorTestBattleConfigFromRules();
  syncMapEditorPlacementAllowSpawnMask({ reason: 'edit-session-start', log: true });
  enterMapEditorFloorLock();
  updateMapEditorSessionControls();
  logMapEditor('editSessionStarted', { roomId: room.id, skipInitialVillainSync });
  return true;
}

/** @deprecated Use ensureMapEditorEditSession */
async function startMapEditorSandboxTest() {
  return ensureMapEditorEditSession();
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
  return normalizeSceneSpriteReplacementRules(rules);
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

function downloadJsonFile(filename, data) {
  try {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (e) {
    console.warn('[Map Editor] JSON file download failed:', e);
    return false;
  }
}

/** Paste-JSON import dialog for map-editor-bundle-v1 exports — mirrors Better Setups' "Load setup". */
function setStatusMessage(message, isError) {
  const status = queryInspector('#map-editor-status');
  if (!status) return;
  status.textContent = message || '';
  status.style.color = isError ? '#E06C75' : '#888';
}

function getAssetListCacheKey() {
  const included = getIncludedAssetMapIds();
  if (!(included instanceof Set)) return 'all';
  return [...included].sort().join(',');
}

function getCreatureListCacheKey() {
  const mapKey = getAssetListCacheKey();
  const query = (editorState.creatureSearchQuery || '').trim().toLowerCase();
  return `${mapKey}|${query}`;
}

function saveTabScrollPosition(tabId) {
  if (tabId === 'assets') {
    const body = queryInspector('.me-asset-grid-body');
    if (body) editorState.assetTabScrollTop = body.scrollTop;
  } else if (tabId === 'creatures') {
    const body = queryInspector('.me-creature-grid-body');
    if (body) editorState.creatureTabScrollTop = body.scrollTop;
  }
}

function restoreTabScrollPosition(tabId) {
  if (tabId === 'assets') {
    const body = queryInspector('.me-asset-grid-body');
    if (body) body.scrollTop = editorState.assetTabScrollTop || 0;
  } else if (tabId === 'creatures') {
    const body = queryInspector('.me-creature-grid-body');
    if (body) body.scrollTop = editorState.creatureTabScrollTop || 0;
  }
}

function shouldRefreshAssetList() {
  return editorState.assetListStale
    || !assetListFilteredCache
    || assetListFilterKey !== getAssetListCacheKey();
}

function shouldRefreshCreatureList() {
  return editorState.creatureListStale
    || !creatureListFilteredCache
    || creatureListFilterKey !== getCreatureListCacheKey();
}

function switchInspectorTab(tabId) {
  if (!tabId) return;
  const previousTab = editorState.activeTab;
  if (previousTab && previousTab !== tabId) saveTabScrollPosition(previousTab);
  editorState.activeTab = tabId;

  const root = editorState.inspectorRoot;
  const panel = document.getElementById(PANEL_ID);
  if (!root && !panel) return;

  root?.querySelectorAll('.me-tab-panel').forEach((panelEl) => {
    panelEl.hidden = panelEl.dataset.tabPanel !== tabId;
  });
  panel?.querySelectorAll('.me-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  if (tabId === 'assets') {
    if (shouldRefreshAssetList()) refreshAssetList();
    else {
      restoreTabScrollPosition('assets');
      requestAnimationFrame(() => hydrateVisibleAssetPreviews());
    }
  }
  if (tabId === 'creatures') {
    if (shouldRefreshCreatureList()) refreshCreatureList();
    else restoreTabScrollPosition('creatures');
  }
  if (tabId === 'map') refreshEditTab();
  if (tabId === 'workshop') {
    refreshWorkshopTab();
    void fetchWorkshopCatalog();
  }
}

function buildTabBar() {
  const tabBar = document.createElement('div');
  tabBar.className = 'me-tab-bar';
  tabBar.append(
    createTabButton('map', t('mods.mapEditor.tabMap', 'Map')),
    createTabButton('assets', t('mods.mapEditor.tabAssets', 'Asset list')),
    createTabButton('creatures', t('mods.mapEditor.tabCreatures', 'Creature list')),
    createTabButton('workshop', t('mods.mapEditor.tabWorkshop', 'Workshop'))
  );
  return tabBar;
}

let allRoomsAssetsCache = null;
let assetFilterRegionTreeCache = null;

function getAssetFilterRegionTree() {
  if (assetFilterRegionTreeCache) return assetFilterRegionTreeCache;

  const regions = globalThis.state?.utils?.REGIONS;
  const mapsDb = globalThis.mapsDatabase;
  const getRegionName = (region) => {
    if (mapsDb?.getRegionDisplayNameFromRegion) {
      return mapsDb.getRegionDisplayNameFromRegion(region);
    }
    if (region?.id && mapsDb?.getRegionDisplayName) {
      return mapsDb.getRegionDisplayName(region.id);
    }
    return region?.name || region?.id || 'Unknown region';
  };

  const tree = [];
  const placedMaps = new Set();

  if (Array.isArray(regions)) {
    for (const region of regions) {
      const regionId = region?.id;
      if (!regionId) continue;
      const maps = [];
      if (Array.isArray(region.rooms)) {
        for (const room of region.rooms) {
          const mapId = room?.id;
          if (!mapId || placedMaps.has(mapId)) continue;
          placedMaps.add(mapId);
          maps.push({ id: mapId, name: getRoomDisplayName({ id: mapId }) });
        }
      }
      if (maps.length) {
        tree.push({ id: regionId, name: getRegionName(region), maps });
      }
    }
  }

  const orphanMaps = [];
  for (const room of getAllGameRooms()) {
    const mapId = room?.id;
    if (!mapId || placedMaps.has(mapId)) continue;
    placedMaps.add(mapId);
    orphanMaps.push({ id: mapId, name: getRoomDisplayName(room) });
  }
  if (orphanMaps.length) {
    tree.push({
      id: '__other__',
      name: t('mods.mapEditor.assetFilterOtherRegion', 'Other maps'),
      maps: orphanMaps
    });
  }

  assetFilterRegionTreeCache = tree;
  return tree;
}

function getAllAssetFilterMapIds() {
  const ids = [];
  for (const region of getAssetFilterRegionTree()) {
    for (const map of region.maps) ids.push(map.id);
  }
  return ids;
}

function isAssetMapFilterActive() {
  return editorState.assetIncludedMaps instanceof Set;
}

function isMapIncludedInAssetFilter(mapId) {
  if (!mapId) return false;
  if (!isAssetMapFilterActive()) return true;
  return editorState.assetIncludedMaps.has(mapId);
}

function getIncludedAssetMapIds() {
  return isAssetMapFilterActive() ? editorState.assetIncludedMaps : null;
}

function setMapIncludedInAssetFilter(mapId, included) {
  if (!mapId) return;
  const allMapIds = getAllAssetFilterMapIds();
  if (!allMapIds.length) return;

  let includedMaps = editorState.assetIncludedMaps;
  if (!(includedMaps instanceof Set)) {
    includedMaps = new Set(allMapIds);
    editorState.assetIncludedMaps = includedMaps;
  }

  if (included) includedMaps.add(mapId);
  else includedMaps.delete(mapId);

  if (includedMaps.size >= allMapIds.length) {
    editorState.assetIncludedMaps = null;
  } else if (!includedMaps.size) {
    editorState.assetIncludedMaps = new Set();
  }
}

function setRegionMapsIncludedInAssetFilter(regionId, included) {
  const region = getAssetFilterRegionTree().find((entry) => entry.id === regionId);
  if (!region) return;
  for (const map of region.maps) {
    setMapIncludedInAssetFilter(map.id, included);
  }
}

function syncAssetRegionCheckbox(regionEl) {
  const regionCheckbox = regionEl?.querySelector('.me-asset-region-checkbox');
  const mapCheckboxes = regionEl?.querySelectorAll('.me-asset-map-checkbox');
  if (!regionCheckbox || !mapCheckboxes?.length) return;

  let checkedCount = 0;
  mapCheckboxes.forEach((input) => {
    if (input.checked) checkedCount += 1;
  });

  regionCheckbox.checked = checkedCount === mapCheckboxes.length;
  regionCheckbox.indeterminate = checkedCount > 0 && checkedCount < mapCheckboxes.length;
}

function refreshAssetMapFilterPanel() {
  const container = queryInspector('#map-editor-asset-map-filters');
  if (!container) return;

  const tree = getAssetFilterRegionTree();
  container.replaceChildren();

  if (!tree.length) {
    const empty = document.createElement('div');
    empty.className = 'me-section-hint';
    empty.textContent = t(
      'mods.mapEditor.assetFilterUnavailable',
      'Open a map first to filter assets by region.'
    );
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const region of tree) {
    const regionEl = document.createElement('div');
    regionEl.className = 'me-asset-region';
    regionEl.dataset.regionId = region.id;

    const head = document.createElement('div');
    head.className = 'me-row me-asset-region-head';

    const mapsId = `map-editor-region-maps-${region.id}`;
    const expanded = editorState.assetExpandedRegions.has(region.id);

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'me-btn me-btn-compact me-asset-region-toggle';
    toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    toggleBtn.setAttribute('aria-controls', mapsId);
    toggleBtn.title = t('mods.mapEditor.assetFilterToggleMaps', 'Show maps in this region');
    toggleBtn.textContent = expanded ? '▾' : '▸';

    const regionLabel = document.createElement('label');
    regionLabel.className = 'me-check-row me-asset-region-check';

    const regionCheckbox = document.createElement('input');
    regionCheckbox.type = 'checkbox';
    regionCheckbox.className = 'me-asset-region-checkbox';
    regionCheckbox.checked = region.maps.every((map) => isMapIncludedInAssetFilter(map.id));
    regionCheckbox.addEventListener('change', () => {
      const included = regionCheckbox.checked;
      setRegionMapsIncludedInAssetFilter(region.id, included);
      regionEl.querySelectorAll('.me-asset-map-checkbox').forEach((mapCheckbox) => {
        mapCheckbox.checked = included;
      });
      syncAssetRegionCheckbox(regionEl);
      scheduleAssetListRefresh();
      scheduleCreatureListRefresh();
    });

    const regionName = document.createElement('span');
    regionName.textContent = region.name;
    regionLabel.append(regionCheckbox, regionName);

    const mapList = document.createElement('div');
    mapList.id = mapsId;
    mapList.className = 'me-asset-map-list';
    mapList.hidden = !expanded;

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willExpand = toggleCollapsible(mapList, toggleBtn);
      if (willExpand) editorState.assetExpandedRegions.add(region.id);
      else editorState.assetExpandedRegions.delete(region.id);
    });

    head.append(toggleBtn, regionLabel);
    regionEl.append(head, mapList);

    for (const map of region.maps) {
      const mapLabel = document.createElement('label');
      mapLabel.className = 'me-check-row me-asset-map-check';

      const mapCheckbox = document.createElement('input');
      mapCheckbox.type = 'checkbox';
      mapCheckbox.className = 'me-asset-map-checkbox';
      mapCheckbox.dataset.mapId = map.id;
      mapCheckbox.checked = isMapIncludedInAssetFilter(map.id);
      mapCheckbox.addEventListener('change', (e) => {
        e.stopPropagation();
        setMapIncludedInAssetFilter(map.id, mapCheckbox.checked);
        syncAssetRegionCheckbox(regionEl);
        scheduleAssetListRefresh();
        scheduleCreatureListRefresh();
      });

      const mapName = document.createElement('span');
      mapName.textContent = map.name;
      mapLabel.append(mapCheckbox, mapName);
      mapList.appendChild(mapLabel);
    }

    syncAssetRegionCheckbox(regionEl);
    fragment.appendChild(regionEl);
  }

  container.appendChild(fragment);
}

function getConfiguredAssetsFromAllRooms() {
  const rooms = getAllGameRooms();
  if (allRoomsAssetsCache && allRoomsAssetsCache.roomCount === rooms.length) {
    return allRoomsAssetsCache.byId;
  }

  assetFilterRegionTreeCache = null;

  const byId = new Map();
  const addEntry = (entry, room) => {
    if (!entry?.id || !room) return;
    const roomLabel = getRoomDisplayName(room);
    const existing = byId.get(entry.id);
    if (!existing) {
      byId.set(entry.id, {
        ...entry,
        usageCount: 1,
        roomLabels: new Set([roomLabel]),
        roomIds: new Set([room.id])
      });
      return;
    }
    existing.usageCount += 1;
    existing.roomLabels.add(roomLabel);
    if (room.id) existing.roomIds.add(room.id);
    if (formatSpriteConfigHint(entry) && !formatSpriteConfigHint(existing)) {
      const { usageCount, roomLabels, roomIds } = existing;
      Object.assign(existing, entry, { usageCount, roomLabels, roomIds });
    }
  };

  // Scan BOTH the main tile layers and the floor-below layer. floorBelowTiles is a
  // tile-indexed layer of sprite configs (array-or-single per tile, same shape as a
  // tiles[] entry once normalized) — skipping it dropped every sprite that only
  // appears beneath the floor, which on bridge/water maps is most of the art.
  const scanRoom = (room) => {
    const data = room?.file?.data;
    if (!data) return;
    if (Array.isArray(data.tiles)) {
      data.tiles.forEach((layer) => {
        if (!Array.isArray(layer)) return;
        layer.forEach((entry) => addEntry(entry, room));
      });
    }
    if (data.floorBelowTiles != null) {
      const tileCount = getRoomDataTileCount(data) || getMapTileCount();
      const floorBelow = normalizeIndexedRoomLayer(data.floorBelowTiles, tileCount);
      floorBelow?.forEach((slot) => {
        const layer = slot && !Array.isArray(slot) && Array.isArray(slot.sprites) ? slot.sprites : slot;
        normalizeSpriteLayerConfig(layer).forEach((config) => addEntry(config, room));
      });
    }
  };

  (rooms.length ? rooms : [getCurrentRoom()].filter(Boolean)).forEach(scanRoom);

  allRoomsAssetsCache = {
    byId,
    roomCount: rooms.length,
    list: Array.from(byId.values())
      .map(({ roomLabels, roomIds, ...asset }) => {
        const hint = formatSpriteConfigHint(asset);
        const labels = roomLabels ? Array.from(roomLabels) : [];
        const ids = roomIds ? Array.from(roomIds) : [];
        return {
          ...asset,
          mapCount: roomLabels?.size || 0,
          roomIds: ids,
          searchLabels: labels
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

function filterAssetList(assets, includedMapIds = null) {
  if (!(includedMapIds instanceof Set)) return assets;
  return assets.filter((asset) => {
    const ids = asset.roomIds;
    if (!ids?.length) return true;
    return ids.some((id) => includedMapIds.has(id));
  });
}

function buildAssetListDisplay(filtered, grandTotal, visibleCount, mapFilterActive = false) {
  const shown = Math.min(visibleCount, filtered.length);
  return {
    items: filtered.slice(0, shown),
    shownCount: shown,
    total: filtered.length,
    capped: filtered.length > shown,
    hasFilter: mapFilterActive,
    grandTotal
  };
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
  stopAllSpritePreviewHostSync();
  if (assetListLoadMoreObserver) {
    assetListLoadMoreObserver.disconnect();
    assetListLoadMoreObserver = null;
    assetListLoadMoreRoot = null;
  }
}

function ensureAssetListLoadMoreObserver() {
  const root = queryInspector('.me-asset-grid-body') || document.getElementById(BODY_ID);
  if (assetListLoadMoreObserver && assetListLoadMoreRoot === root) {
    return assetListLoadMoreObserver;
  }
  if (assetListLoadMoreObserver) {
    assetListLoadMoreObserver.disconnect();
    assetListLoadMoreObserver = null;
  }
  assetListLoadMoreRoot = root;
  assetListLoadMoreObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadMoreAssetList();
    });
  }, { root, rootMargin: '200px' });
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

function refreshAssetCardPreviewForSprite(spriteId) {
  const grid = queryInspector('#map-editor-asset-grid');
  if (!grid || spriteId == null) return;
  grid.querySelectorAll('.me-sprite-preview').forEach((preview) => {
    if (preview.__assetRef?.id !== spriteId) return;
    stopSpritePreviewHostSync(preview);
    delete preview.dataset.hydrated;
    preview.classList.remove('me-sprite-preview-host-sync');
    preview.classList.add('me-sprite-preview-pending');
    preview.textContent = String(spriteId);
    preview.replaceChildren();
    hydrateAssetCardPreview(preview, preview.__assetRef);
  });
}

function hydrateAssetCardPreview(preview, asset) {
  if (!preview || preview.dataset.hydrated === '1' || !asset?.id) return;
  preview.dataset.hydrated = '1';
  preview.__assetRef = asset;
  hydratePanelSpritePreview(preview, asset);
}

function ensureAssetPreviewObserver() {
  if (assetPreviewObserver) return assetPreviewObserver;
  assetPreviewObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const preview = entry.target;
      if (entry.isIntersecting) {
        if (preview.dataset.hydrated === '1') {
          if (preview.__assetPreviewHostPaused) resumeSpritePreviewHostSync(preview);
        } else {
      hydrateAssetCardPreview(preview, preview.__assetRef);
        }
      } else if (preview.dataset.hydrated === '1') {
        pauseSpritePreviewHostSync(preview);
        preview.__assetPreviewHostPaused = true;
      }
    });
  }, { rootMargin: '64px' });
  return assetPreviewObserver;
}

function queueAssetCardPreview(preview, asset) {
  preview.__assetRef = asset;
  ensureAssetPreviewObserver().observe(preview);
}

function hydrateVisibleAssetPreviews() {
  const grid = queryInspector('#map-editor-asset-grid');
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
      ? tReplace('mods.mapEditor.assetsSummaryFiltered',
        { shown: String(shown), total: String(display.total) },
        'Showing {shown} of {total} matches — scroll for more')
      : tReplace('mods.mapEditor.assetsSummaryCapped',
        { shown: String(shown), total: String(display.grandTotal) },
        'Showing {shown} of {total} assets — scroll for more');
    return;
  }

  if (allRooms.length) {
    summary.textContent = tReplace('mods.mapEditor.assetsSummaryAll',
      {
        count: String(display.hasFilter ? display.total : display.grandTotal),
        maps: String(allRooms.length)
      },
      '{count} unique assets from {maps} maps');
    return;
  }

  if (room) {
    summary.textContent = tReplace('mods.mapEditor.assetsSummary',
      { count: String(display.total), map: getRoomDisplayName(room) },
      '{count} assets on {map}');
    return;
  }

  summary.textContent = t('mods.mapEditor.assetsUnavailable', 'Map data not loaded yet — open any map first.');
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

  meta.append(idLine);
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
  const { allRooms, room, display, append = false, onComplete } = options;
  grid.classList.remove('is-loading');
  if (!append) {
    grid.replaceChildren();
    delete grid.dataset.renderedCount;
  }

  if (!assets.length && !append) {
    const empty = document.createElement('div');
    empty.className = 'me-muted me-asset-empty';
    empty.textContent = display?.hasFilter
      ? t('mods.mapEditor.assetsNoMatch', 'No assets match the selected maps.')
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

  const grid = queryInspector('#map-editor-asset-grid');
  const summary = queryInspector('#map-editor-asset-summary');
  if (!grid || grid.classList.contains('is-loading')) return;

  const currentCount = Number(grid.dataset.renderedCount || 0);
  const { filtered, grandTotal, includedMapIds } = assetListFilteredCache;
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
      const display = buildAssetListDisplay(
        filtered,
        grandTotal,
        nextCount,
        includedMapIds instanceof Set
      );
      updateAssetListSummary(summary, display, allRooms, room, false);
      updateAssetListSentinel(grid, nextCount < filtered.length);
    }
  });
}

function scheduleAssetListRefresh() {
  editorState.assetListStale = true;
  if (editorState.activeTab !== 'assets') return;

  if (assetListSearchTimer != null) {
    clearTimeout(assetListSearchTimer);
    assetListSearchTimer = null;
  }

  const grid = queryInspector('#map-editor-asset-grid');
  const summary = queryInspector('#map-editor-asset-summary');
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
    if (tileHasSpriteConfig(tileIndex, asset)) {
      setStatusMessage(
        t('mods.mapEditor.assetDuplicate', 'Sprite already on tile {tile}.')
          .replace('{tile}', String(tileIndex)),
        true
      );
      return;
    }
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
    return;
  }

  setStatusMessage(
    t('mods.mapEditor.assetSelectTileFirst', 'Select a tile on the board, then click a sprite in the Assets list.')
  );
}

function refreshAssetList() {
  const grid = queryInspector('#map-editor-asset-grid');
  const summary = queryInspector('#map-editor-asset-summary');
  if (!grid) return;

  cancelAssetListWork();
  const loadId = assetListLoadId;
  const includedMapIds = getIncludedAssetMapIds();
  const allRooms = getAllGameRooms();
  const room = getCurrentRoom();

  showAssetListSkeleton(grid);
  refreshAssetMapFilterPanel();
  updateAssetListSummary(summary, { items: [], total: 0, capped: false, hasFilter: false, grandTotal: 0 }, allRooms, room, true);

  setTimeout(() => {
    if (loadId !== assetListLoadId) return;

    const allAssets = collectMapTileAssets();
    if (loadId !== assetListLoadId) return;

    const filtered = filterAssetList(allAssets, includedMapIds);
    assetListFilteredCache = {
      includedMapIds,
      filtered,
      grandTotal: allAssets.length
    };
    assetListFilterKey = getAssetListCacheKey();
    editorState.assetListStale = false;
    assetListLoadingMore = false;

    const display = buildAssetListDisplay(
      filtered,
      allAssets.length,
      ASSET_LIST_PAGE_SIZE,
      includedMapIds instanceof Set
    );
    updateAssetListSummary(summary, display, allRooms, room, false);
    renderAssetCardsChunked(grid, display.items, loadId, {
      allRooms,
      room,
      display,
      onComplete: () => {
        if (loadId !== assetListLoadId) return;
        grid.dataset.renderedCount = String(display.items.length);
        updateAssetListSentinel(grid, display.capped);
        const body = queryInspector('.me-asset-grid-body');
        if (body) body.scrollTop = 0;
        editorState.assetTabScrollTop = 0;
      }
    });
  }, 0);
}

// =======================
// Creature list (creature-database.js + map actors)
// =======================

function getCreatureDatabase() {
  if (typeof window !== 'undefined' && window.creatureDatabase) return window.creatureDatabase;
  if (globalThis.creatureDatabase) return globalThis.creatureDatabase;
  return null;
}

function resolveCreatureGameId(source) {
  if (source == null) return null;
  if (typeof source === 'number') return Number.isFinite(source) ? source : null;
  if (typeof source === 'object') {
    const raw = source.id ?? source.gameId ?? source.monsterId;
    const gameId = Number(raw);
    return Number.isFinite(gameId) ? gameId : null;
  }
  const gameId = Number(source);
  return Number.isFinite(gameId) ? gameId : null;
}

function getCreatureDisplayName(gameId) {
  const db = getCreatureDatabase();
  const fromDb = db?.findMonsterByGameId?.(gameId);
  if (fromDb?.metadata?.name) return fromDb.metadata.name;
  try {
    const monster = globalThis.state?.utils?.getMonster?.(gameId);
    if (monster?.metadata?.name) return monster.metadata.name;
  } catch (e) {
    // ignore
  }
  return `Creature #${gameId}`;
}

// A placed custom-sprite creature carries its display name as a nickname (see
// applyCustomSpriteToSelection), so prefer the nickname over the base species name
// wherever an actor's name is shown — otherwise "Kraknaknork's Demon" would read as
// "Orc Shaman" everywhere despite the custom art actually rendering correctly.
function getActorDisplayName(actor, actorId) {
  const nickname = String(actor?.nickname || '').trim();
  if (nickname) return nickname;
  return actorId != null ? getCreatureDisplayName(actorId) : 'actor';
}

// Custom-sprite pieces should show their own art in inspector rows/portraits instead of
// the base creature's portrait. A registry entry can supply a dedicated portraitUrl (a
// single icon-sized image, e.g. Weakened Ghazbaran's ghaz-icon.gif) for exactly this; absent
// that, fall back to the idle sheet only when it has no movingUrl (a decent signal it's a
// single static pose) — a multi-frame directional sheet would otherwise show the whole
// strip squished into the box.
function getActorPortraitUrl(actor, actorId, shiny = false) {
  const spriteDef = actor?.customSpriteKey != null
    ? window.CustomBattles?.getCustomSpriteDef?.(actor.customSpriteKey)
    : null;
  if (spriteDef?.portraitUrl) {
    const url = window.CustomBattles?.getCustomSpriteAssetUrl?.(spriteDef.portraitUrl);
    if (url) return url;
  }
  if (spriteDef && !spriteDef.movingUrl) {
    const url = window.CustomBattles?.getCustomSpriteAssetUrl?.(spriteDef.idleUrl);
    if (url) return url;
  }
  return actorId != null ? getCreaturePortraitUrl(actorId, shiny) : null;
}

function getCreaturePortraitUrl(gameId, shiny = false) {
  const db = getCreatureDatabase();
  if (db?.getMonsterPortraitUrl) return db.getMonsterPortraitUrl(gameId, shiny);
  return shiny ? `/assets/portraits/${gameId}-shiny.png` : `/assets/portraits/${gameId}.png`;
}

/**
 * The rendered outfit/sprite ID for a creature's gameId — usually identical to gameId itself
 * (the native game falls back to gameId when a monster has no explicit metadata.spriteId
 * override), so typing a normal creature ID into the Outfit sprite field works for almost
 * every creature. This resolves the rare exceptions correctly, same lookup the native board
 * uses (globalThis.state.utils.getMonster(gameId)?.metadata?.spriteId ?? gameId).
 */
function resolveOutfitSpriteIdForCreature(gameId) {
  const id = Number(gameId);
  if (!Number.isFinite(id)) return null;
  const db = getCreatureDatabase();
  const fromDb = db?.findMonsterByGameId?.(id);
  if (fromDb?.metadata?.spriteId != null) return Number(fromDb.metadata.spriteId);
  try {
    const monster = globalThis.state?.utils?.getMonster?.(id);
    if (monster?.metadata?.spriteId != null) return Number(monster.metadata.spriteId);
  } catch (e) {
    // ignore
  }
  return id;
}

/**
 * Resolves a creature gameId from either a numeric ID or a creature name (e.g. "Druid"),
 * case-insensitive. Exact name matches win; an ambiguous partial match (multiple creatures
 * contain the text) is rejected rather than guessing.
 */
function resolveCreatureIdByGameIdOrName(input) {
  const trimmed = String(input ?? '').trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const id = Number(trimmed);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
  const db = getCreatureDatabase();
  const monsters = db?.getAllMonstersWithPortraits?.() || [];
  if (!monsters.length) return null;
  const lower = trimmed.toLowerCase();
  const exact = monsters.find((m) => (m.metadata?.name || '').toLowerCase() === lower);
  if (exact) return exact.gameId;
  const partialMatches = monsters.filter((m) => (m.metadata?.name || '').toLowerCase().includes(lower));
  return partialMatches.length === 1 ? partialMatches[0].gameId : null;
}

/** Outfit sprite field accepts a creature name or ID — resolve straight through to the sprite ID. */
function resolveOutfitSpriteIdFromInput(input) {
  const gameId = resolveCreatureIdByGameIdOrName(input);
  return gameId == null ? null : resolveOutfitSpriteIdForCreature(gameId);
}

/**
 * Reverse of resolveOutfitSpriteIdForCreature: given a resolved outfit sprite ID, find the
 * creature whose own sprite ID resolves to it, so the field can display a name (e.g. "Orc
 * Shaman") instead of a bare number. Returns null when no unique creature matches, in which
 * case callers should fall back to showing the numeric ID.
 */
function resolveCreatureNameFromOutfitSpriteId(spriteId) {
  const id = Number(spriteId);
  if (!Number.isFinite(id)) return null;
  const db = getCreatureDatabase();
  const monsters = db?.getAllMonstersWithPortraits?.() || [];
  const match = monsters.find((m) => resolveOutfitSpriteIdForCreature(m.gameId) === id);
  return match?.metadata?.name || null;
}

function getEquipmentDatabase() {
  if (typeof window !== 'undefined' && window.equipmentDatabase) return window.equipmentDatabase;
  if (globalThis.equipmentDatabase) return globalThis.equipmentDatabase;
  return null;
}

function getEquipmentDisplayName(gameId) {
  const id = Number(gameId);
  if (!Number.isFinite(id) || id <= 0) return '';
  const nameMap = getEquipmentDatabase()?.getEquipmentNameMap?.();
  if (nameMap) {
    for (const entry of nameMap.values()) {
      if (Number(entry?.gameId) === id) {
        return entry.item?.metadata?.name || `Equipment #${id}`;
      }
    }
  }
  try {
    const item = globalThis.state?.utils?.getEquipment?.(id);
    if (item?.metadata?.name) return item.metadata.name;
  } catch (e) {
    // ignore
  }
  return `Equipment #${id}`;
}

function getEquipmentSelectOptions() {
  const db = getEquipmentDatabase();
  const nameMap = db?.getEquipmentNameMap?.();
  if (nameMap?.size) {
    const options = [];
    nameMap.forEach((entry) => {
      const gameId = Number(entry?.gameId);
      const label = entry?.item?.metadata?.name;
      if (Number.isFinite(gameId) && gameId > 0 && label) {
        options.push({ value: gameId, label });
      }
    });
    options.sort((a, b) => a.label.localeCompare(b.label));
    return options;
  }

  const names = db?.ALL_EQUIPMENT;
  if (!Array.isArray(names) || names.length === 0) return [];

  return names
    .map((name) => {
      const key = String(name).trim().toLowerCase();
      const fromApi = globalThis.BestiaryModAPI?.utility?.maps?.equipmentNamesToGameIds?.get?.(key);
      const gameId = fromApi ?? db?.getEquipmentNameMap?.()?.get?.(key)?.gameId;
      const id = Number(gameId);
      return Number.isFinite(id) && id > 0 ? { value: id, label: name } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function createEquipmentSelect(selectedGameId, className = 'me-input') {
  const select = document.createElement('select');
  select.className = className;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  select.appendChild(placeholder);

  const options = getEquipmentSelectOptions();
  const knownIds = new Set();
  options.forEach((opt) => {
    knownIds.add(Number(opt.value));
    const option = document.createElement('option');
    option.value = String(opt.value);
    option.textContent = opt.label;
    select.appendChild(option);
  });

  const selectedId = Number(selectedGameId);
  if (Number.isFinite(selectedId) && selectedId > 0 && !knownIds.has(selectedId)) {
    const option = document.createElement('option');
    option.value = String(selectedId);
    option.textContent = getEquipmentDisplayName(selectedId);
    select.appendChild(option);
  }

  if (!options.length) {
    placeholder.textContent = t(
      'mods.mapEditor.creatureEquipUnavailable',
      'Equipment list unavailable — wait for equipment-database.js'
    );
    select.disabled = true;
  } else {
    placeholder.textContent = t('mods.mapEditor.creatureEquipSelect', 'No equipment');
    select.value = Number.isFinite(selectedId) && selectedId > 0 ? String(selectedId) : '';
  }

  return select;
}

function getActorOnTile(tileIndex) {
  if (tileIndex == null) return null;
  const actors = getCurrentRoom()?.file?.data?.actors;
  if (!Array.isArray(actors) || actors[tileIndex] == null) return null;
  return cloneJson(actors[tileIndex]);
}

function buildMapEditorVillainConfig(tileIndex, gameId, actorConfig = null) {
  const resolvedId = resolveCreatureGameId(gameId) ?? resolveCreatureGameId(actorConfig);
  if (resolvedId == null || tileIndex == null) return null;
  const level = Number(actorConfig?.level);
  const name = getCreatureDisplayName(resolvedId);
  const config = {
    tileIndex,
    gameId: resolvedId,
    nickname: actorConfig?.nickname || name,
    level: Number.isFinite(level) && level > 0 ? Math.floor(level) : 1,
    direction: actorConfig?.direction || 'south',
    // keyPrefix intentionally omitted here — assigned per villain/ally board-entity builder in
    // applyEditorVillainsToBoard() so ally status doesn't leak into actor-config equality checks
    // (e.g. isUserPlacedEditorVillain()), which compare this object verbatim via JSON.stringify.
    keyPrefix: `${MAP_EDITOR_VILLAIN_KEY_PREFIX}${tileIndex}-`
  };

  if (actorConfig?.equip != null) config.equip = cloneJson(actorConfig.equip);
  if (actorConfig?.shiny === true) config.shiny = true;
  if (actorConfig?.outfitSpriteId != null) config.outfitSpriteId = actorConfig.outfitSpriteId;
  if (actorConfig?.itemSpriteId != null) config.itemSpriteId = actorConfig.itemSpriteId;
  if (actorConfig?.customSpriteKey != null) config.customSpriteKey = actorConfig.customSpriteKey;
  if (actorConfig?.genes && typeof actorConfig.genes === 'object') {
    config.genes = cloneJson(actorConfig.genes);
  }
  if (actorConfig?.awakened === true || actorConfig?.awaken === true || actorConfig?.isAwakened === true) {
    config.awakened = true;
  }

  return config;
}

function buildActorConfigFromVillainConfig(villain) {
  if (!villain || typeof villain !== 'object') return null;
  return normalizeActorConfig({
    id: villain.gameId ?? villain.id,
    level: villain.level,
    direction: villain.direction,
    nickname: villain.nickname,
    shiny: villain.shiny,
    awakened: villain.awakened,
    genes: villain.genes,
    equip: villain.equip,
    outfitSpriteId: villain.outfitSpriteId,
    itemSpriteId: villain.itemSpriteId,
    customSpriteKey: villain.customSpriteKey,
    abilityCooldownTicks: villain.abilityCooldownTicks
  });
}

function normalizeActorConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = resolveCreatureGameId(raw);
  if (id == null) return null;
  const normalized = cloneJson(raw);
  normalized.id = id;
  const level = Number(normalized.level);
  normalized.level = Number.isFinite(level) && level > 0 ? Math.floor(level) : 1;
  if (!normalized.direction) normalized.direction = 'south';
  if (normalized.shiny !== true) delete normalized.shiny;

  const awakened = normalized.awakened === true
    || normalized.awaken === true
    || normalized.isAwakened === true;
  if (awakened) {
    normalized.awakened = true;
    delete normalized.awaken;
    delete normalized.isAwakened;
  } else {
    delete normalized.awakened;
    delete normalized.awaken;
    delete normalized.isAwakened;
  }

  delete normalized.starTier;
  delete normalized.tier;

  if (normalized.genes && typeof normalized.genes === 'object') {
    const genes = {};
    CREATURE_GENE_KEYS.forEach(({ key }) => {
      const val = readEngineGeneValueFromContainer(normalized.genes, key);
      if (val != null) genes[key] = val;
    });
    if (Object.keys(genes).length) normalized.genes = genes;
    else delete normalized.genes;
  } else {
    delete normalized.genes;
  }

  if (normalized.equip && typeof normalized.equip === 'object') {
    const equipGameId = Number(normalized.equip.gameId);
    if (!Number.isFinite(equipGameId) || equipGameId <= 0) {
      delete normalized.equip;
    } else {
      normalized.equip = {
        gameId: equipGameId,
        stat: normalized.equip.stat || 'ap',
        tier: Math.min(
          CREATURE_EQUIP_TIER_MAX,
          Math.max(
            CREATURE_EQUIP_TIER_MIN,
            Math.floor(Number(normalized.equip.tier)) || CREATURE_EQUIP_TIER_DEFAULT
          )
        )
      };
    }
  } else {
    delete normalized.equip;
  }

  const outfitSpriteId = Number(normalized.outfitSpriteId);
  if (Number.isFinite(outfitSpriteId) && outfitSpriteId > 0) normalized.outfitSpriteId = outfitSpriteId;
  else delete normalized.outfitSpriteId;

  const itemSpriteId = Number(normalized.itemSpriteId);
  if (Number.isFinite(itemSpriteId) && itemSpriteId > 0) normalized.itemSpriteId = itemSpriteId;
  else delete normalized.itemSpriteId;

  const nickname = String(normalized.nickname || '').trim();
  if (nickname) normalized.nickname = nickname;
  else delete normalized.nickname;

  const cooldownTicks = Number(
    normalized.abilityCooldown?.cooldownTicks
    ?? normalized.ability?.cooldown?.cooldownTicks
  );
  if (Number.isFinite(cooldownTicks) && cooldownTicks >= 0) {
    normalized.abilityCooldown = { cooldownTicks: Math.floor(cooldownTicks) };
    if (normalized.ability?.cooldown) delete normalized.ability.cooldown;
  } else {
    delete normalized.abilityCooldown;
  }

  return normalized;
}

function clampCreatureUiGene(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return CREATURE_GENE_UI_MIN;
  return Math.min(CREATURE_GENE_UI_MAX, Math.max(CREATURE_GENE_UI_MIN, Math.round(num)));
}

function clampCreatureEngineGene(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return CREATURE_GENE_ENGINE_MIN;
  return Math.min(CREATURE_GENE_ENGINE_MAX, Math.max(CREATURE_GENE_ENGINE_MIN, Math.round(num)));
}

function uiGeneToEngineGene(uiValue) {
  return clampCreatureEngineGene(Math.round(clampCreatureUiGene(uiValue) / 5));
}

function engineGeneToUiGene(engineValue) {
  return clampCreatureUiGene(clampCreatureEngineGene(engineValue) * 5);
}

function readEngineGeneValueFromContainer(container, key) {
  if (!container || typeof container !== 'object') return null;
  const val = Number(container[key]);
  if (Number.isFinite(val)) return clampCreatureEngineGene(val);
  if (key === 'magicResist') {
    const mr = Number(container.mr);
    if (Number.isFinite(mr)) return clampCreatureEngineGene(mr);
  }
  return null;
}

function engineGenesToUiGenes(engineGenes) {
  const genes = {};
  CREATURE_GENE_KEYS.forEach(({ key }) => {
    const val = readEngineGeneValueFromContainer(engineGenes, key);
    if (val != null) genes[key] = engineGeneToUiGene(val);
  });
  return genes;
}

function uiGenesToEngineGenes(uiGenes) {
  const genes = {};
  CREATURE_GENE_KEYS.forEach(({ key }) => {
    genes[key] = uiGeneToEngineGene(uiGenes?.[key]);
  });
  return genes;
}

function scaleCreatureCombatStat(baseValue, level, engineGeneValue, awakened) {
  const scaleStat = globalThis.state?.utils?.scaleStat;
  if (typeof scaleStat !== 'function' || !Number.isFinite(baseValue)) return null;
  try {
    const scaled = Number(scaleStat({
      stat: baseValue,
      level: Math.max(1, Math.floor(Number(level)) || 1),
      geneValue: clampCreatureEngineGene(engineGeneValue),
      awaken: awakened === true
    }));
    return Number.isFinite(scaled) ? Math.round(scaled) : null;
  } catch (e) {
    return null;
  }
}

function computeCreatureEditorCombatStats(gameId, formState) {
  const monster = globalThis.state?.utils?.getMonster?.(gameId);
  const baseStats = monster?.metadata?.baseStats;
  if (!baseStats || typeof baseStats !== 'object') return null;

  const level = Math.max(1, Math.floor(Number(formState.level)) || 1);
  const awakened = !!formState.awakened;
  const engineGenes = uiGenesToEngineGenes(formState.genes);

  const stats = {};
  CREATURE_COMBAT_STAT_KEYS.forEach(({ key }) => {
    const baseValue = baseStats[key];
    if (typeof baseValue !== 'number' || !Number.isFinite(baseValue)) return;
    if (key === 'speed') {
      stats[key] = baseValue;
      return;
    }
    const geneValue = engineGenes[key] ?? CREATURE_GENE_ENGINE_MIN;
    const scaled = scaleCreatureCombatStat(baseValue, level, geneValue, awakened);
    if (scaled != null) stats[key] = scaled;
  });
  return Object.keys(stats).length ? stats : null;
}

function refreshCreatureEditorStatsPreview(formRoot, gameId) {
  if (!formRoot) return;
  const formState = readCreatureEditorFormState(formRoot);
  const stats = gameId != null ? computeCreatureEditorCombatStats(gameId, formState) : null;

  const statsPanel = formRoot.querySelector('[data-creature-stats-panel="1"]');
  if (!statsPanel) return;
  statsPanel.hidden = !stats;
  if (!stats) return;
  statsPanel.querySelectorAll('[data-creature-stat]').forEach((cell) => {
    const key = cell.dataset.creatureStat;
    const val = stats[key];
    cell.textContent = val != null ? String(val) : '—';
  });
}

function readStoredActorGenes(actor) {
  const genes = {};
  let any = false;
  CREATURE_GENE_KEYS.forEach(({ key }) => {
    const val = readEngineGeneValueFromContainer(actor?.genes, key);
    if (val != null) {
      genes[key] = val;
      any = true;
    }
  });
  return any ? genes : null;
}

function readStoredActorUiGenes(actor) {
  const stored = readStoredActorGenes(actor);
  return stored ? engineGenesToUiGenes(stored) : null;
}

function getBoardVillainGenesForTile(tileIndex) {
  if (tileIndex == null || !globalThis.state?.board?.getSnapshot) return null;
  try {
    const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
    const piece = boardConfig.find((entity) => entity?.tileIndex === tileIndex && entity?.villain);
    if (!piece?.genes || typeof piece.genes !== 'object') return null;
    const genes = {};
    let any = false;
    CREATURE_GENE_KEYS.forEach(({ key }) => {
      const val = readEngineGeneValueFromContainer(piece.genes, key);
      if (val != null) {
        genes[key] = engineGeneToUiGene(val);
        any = true;
      }
    });
    return any ? genes : null;
  } catch (e) {
    return null;
  }
}

function buildDefaultCustomUiGenes() {
  return Object.fromEntries(
    CREATURE_GENE_KEYS.map(({ key }) => [key, CREATURE_GENE_UI_DEFAULT])
  );
}

function getActorUiGenes(actor, tileIndex = null) {
  const stored = readStoredActorUiGenes(actor);
  if (stored) return stored;
  const boardGenes = tileIndex != null ? getBoardVillainGenesForTile(tileIndex) : null;
  if (boardGenes) return boardGenes;
  return buildDefaultCustomUiGenes();
}

function isActorAwakened(actor) {
  return actor?.awakened === true || actor?.awaken === true || actor?.isAwakened === true;
}

function buildCreatureEditorFormState(actor, tileIndex = null) {
  const equip = actor?.equip && typeof actor.equip === 'object' ? actor.equip : null;
  const cooldownTicks = actor?.abilityCooldown?.cooldownTicks ?? actor?.ability?.cooldown?.cooldownTicks;
  return {
    level: Number.isFinite(Number(actor?.level)) && Number(actor.level) > 0
      ? Math.floor(Number(actor.level))
      : 1,
    direction: CREATURE_DIRECTIONS.includes(actor?.direction) ? actor.direction : 'south',
    shiny: actor?.shiny === true,
    awakened: isActorAwakened(actor),
    genes: getActorUiGenes(actor, tileIndex),
    nickname: actor?.nickname || '',
    equipGameId: equip?.gameId ?? '',
    equipStat: CREATURE_EQUIP_STATS.includes(equip?.stat) ? equip.stat : 'ap',
    equipTier: Math.min(
      CREATURE_EQUIP_TIER_MAX,
      Math.max(
        CREATURE_EQUIP_TIER_MIN,
        Math.floor(Number(equip?.tier)) || CREATURE_EQUIP_TIER_DEFAULT
      )
    ),
    outfitSpriteId: actor?.outfitSpriteId ?? '',
    itemSpriteId: actor?.itemSpriteId ?? '',
    abilityCooldownTicks: Number.isFinite(Number(cooldownTicks)) && Number(cooldownTicks) >= 0
      ? Math.floor(Number(cooldownTicks))
      : ''
  };
}

function buildActorConfigFromCreatureForm(baseActor, formState) {
  if (!baseActor || !formState) return null;
  const merged = cloneJson(baseActor);
  merged.id = resolveCreatureGameId(baseActor);
  merged.level = Math.max(1, Math.floor(Number(formState.level)) || 1);
  merged.direction = CREATURE_DIRECTIONS.includes(formState.direction) ? formState.direction : 'south';

  if (formState.shiny) merged.shiny = true;
  else delete merged.shiny;

  if (formState.awakened) {
    merged.awakened = true;
    delete merged.awaken;
    delete merged.isAwakened;
  } else {
    delete merged.awakened;
    delete merged.awaken;
    delete merged.isAwakened;
  }

  delete merged.starTier;
  delete merged.tier;

  merged.genes = uiGenesToEngineGenes(formState.genes);

  const nickname = String(formState.nickname || '').trim();
  if (nickname) merged.nickname = nickname;
  else delete merged.nickname;

  const equipGameId = Number(formState.equipGameId);
  const equipTier = Math.min(
    CREATURE_EQUIP_TIER_MAX,
    Math.max(
      CREATURE_EQUIP_TIER_MIN,
      Math.floor(Number(formState.equipTier)) || CREATURE_EQUIP_TIER_DEFAULT
    )
  );
  const equipStat = CREATURE_EQUIP_STATS.includes(formState.equipStat) ? formState.equipStat : 'ap';
  if (Number.isFinite(equipGameId) && equipGameId > 0) {
    merged.equip = { gameId: equipGameId, stat: equipStat, tier: equipTier };
  } else {
    delete merged.equip;
  }

  const outfitSpriteId = resolveOutfitSpriteIdFromInput(formState.outfitSpriteId);
  if (Number.isFinite(outfitSpriteId) && outfitSpriteId > 0) merged.outfitSpriteId = outfitSpriteId;
  else delete merged.outfitSpriteId;

  const itemSpriteId = Number(formState.itemSpriteId);
  if (Number.isFinite(itemSpriteId) && itemSpriteId > 0) merged.itemSpriteId = itemSpriteId;
  else delete merged.itemSpriteId;

  const cooldownTicks = Number(formState.abilityCooldownTicks);
  if (Number.isFinite(cooldownTicks) && cooldownTicks >= 0) {
    merged.abilityCooldown = { cooldownTicks: Math.floor(cooldownTicks) };
  } else {
    delete merged.abilityCooldown;
  }

  return normalizeActorConfig(merged);
}

function appendCreatureFormRow(parent, labelText, control) {
  const row = document.createElement('div');
  row.className = 'me-creature-form-row';
  const label = document.createElement('label');
  label.className = 'me-creature-form-label';
  label.textContent = labelText;
  row.append(label, control);
  parent.appendChild(row);
  return row;
}

function createCreatureNumberInput(value, { min = 0, max = null, step = 1, className = 'me-input' } = {}) {
  const input = document.createElement('input');
  input.type = 'number';
  input.className = className;
  input.value = value === '' || value == null ? '' : String(value);
  input.min = String(min);
  input.step = String(step);
  if (max != null) input.max = String(max);
  return input;
}

function createCreatureSelect(options, value, className = 'me-input') {
  const select = document.createElement('select');
  select.className = className;
  options.forEach((opt) => {
    const option = document.createElement('option');
    option.value = String(opt.value ?? opt);
    option.textContent = opt.label ?? String(opt.value ?? opt);
    select.appendChild(option);
  });
  select.value = String(value);
  return select;
}

function readCreatureEditorFormState(formRoot) {
  const genes = {};
  CREATURE_GENE_KEYS.forEach(({ key }) => {
    const slider = formRoot.querySelector(`[data-creature-gene="${key}"]`);
    genes[key] = clampCreatureUiGene(slider?.value);
  });
  return {
    level: formRoot.querySelector('[data-creature-level]')?.value,
    direction: formRoot.querySelector('[data-creature-direction]')?.value,
    shiny: !!formRoot.querySelector('[data-creature-shiny]')?.checked,
    awakened: !!formRoot.querySelector('[data-creature-awakened]')?.checked,
    genes,
    nickname: formRoot.querySelector('[data-creature-nickname]')?.value || '',
    equipGameId: formRoot.querySelector('[data-creature-equip-game-id]')?.value,
    equipStat: formRoot.querySelector('[data-creature-equip-stat]')?.value,
    equipTier: formRoot.querySelector('[data-creature-equip-tier]')?.value,
    outfitSpriteId: formRoot.querySelector('[data-creature-outfit-id]')?.value,
    itemSpriteId: formRoot.querySelector('[data-creature-item-id]')?.value,
    abilityCooldownTicks: formRoot.querySelector('[data-creature-ability-cd]')?.value
  };
}

function clearCreatureLiveApplyTimer() {
  if (creatureLiveApplyTimer) {
    clearTimeout(creatureLiveApplyTimer);
    creatureLiveApplyTimer = null;
  }
}

function updateCreatureActorRowSummary(tileIndex, actor) {
  const spriteList = editorState.inspectorRoot?.querySelector('#map-editor-sprite-list');
  const actorRow = spriteList?.querySelector('.me-actor-row');
  if (!actorRow) return;

  const actorId = resolveCreatureGameId(actor);
  const actorName = getActorDisplayName(actor, actorId);
  const level = actor.level != null ? ` · Lv.${actor.level}` : '';
  const portrait = actorRow.querySelector('.me-actor-portrait');
  const portraitUrl = getActorPortraitUrl(actor, actorId, !!actor.shiny);
  if (portrait && portraitUrl) {
    portrait.src = portraitUrl;
  }
  const nameSpan = actorRow.querySelector('.me-sprite-id');
  if (nameSpan) nameSpan.textContent = `${actorName}${level}`;
}

function scheduleCreatureLiveApply(tileIndex, getActorBase, formRoot) {
  clearCreatureLiveApplyTimer();
  creatureLiveApplyTimer = setTimeout(() => {
    creatureLiveApplyTimer = null;
    applyCreatureEditorForm(tileIndex, getActorBase(), formRoot, { live: true });
  }, CREATURE_LIVE_APPLY_MS);
}

function flushCreatureLiveApply(tileIndex, getActorBase, formRoot) {
  clearCreatureLiveApplyTimer();
  return applyCreatureEditorForm(tileIndex, getActorBase(), formRoot, { live: true });
}

function attachCreatureFormLiveApply(formRoot, tileIndex, getActorBase, gameId) {
  const refreshStats = () => refreshCreatureEditorStatsPreview(formRoot, gameId);
  const schedule = () => {
    refreshStats();
    scheduleCreatureLiveApply(tileIndex, getActorBase, formRoot);
  };
  formRoot.querySelectorAll('input, select, textarea').forEach((el) => {
    const type = String(el.type || '').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      el.addEventListener('change', schedule);
      return;
    }
    // Outfit sprite resolves free text (a creature name) to a sprite ID. Live-applying
    // on every keystroke can transiently match the WRONG creature mid-typing (e.g. a
    // paused prefix that happens to uniquely match some other name) and briefly flash
    // it on the board before the full name resolves. Only apply once the value settles
    // (blur normalizes it and dispatches 'change' below), not on every 'input'.
    if (el.dataset.creatureOutfitId) {
      el.addEventListener('change', schedule);
      return;
    }
    el.addEventListener('input', schedule);
    el.addEventListener('change', schedule);
  });
  refreshStats();
}

function applyCreatureEditorForm(tileIndex, baseActor, formRoot, options = {}) {
  const { live = false } = options;
  const actorConfig = buildActorConfigFromCreatureForm(baseActor, readCreatureEditorFormState(formRoot));
  if (!actorConfig) {
    if (!live) {
      setStatusMessage(t('mods.mapEditor.creatureJsonMissingId', 'Creature must have a valid game id.'), true);
    }
    return false;
  }
  const ok = setActorOnTile(tileIndex, actorConfig);
  if (!ok) {
    if (!live) {
      setStatusMessage(t('mods.mapEditor.creatureUpdateFailed', 'Could not update creature.'), true);
    }
    return false;
  }
  if (live) {
    updateCreatureActorRowSummary(tileIndex, actorConfig);
    logMapEditor('creatureLiveApply', { tileIndex, gameId: actorConfig.id });
    return true;
  }
  editorState.editingCreatureTileIndex = null;
  setStatusMessage(t('mods.mapEditor.creatureUpdated', 'Creature updated on tile {tile}.').replace('{tile}', String(tileIndex)));
  refreshInspector();
  return true;
}

function flushCreatureEditIfOpen() {
  const tileIndex = editorState.editingCreatureTileIndex;
  if (tileIndex == null) return false;
  const formRoot = editorState.inspectorRoot?.querySelector('[data-creature-form="1"]');
  if (formRoot) {
    flushCreatureLiveApply(tileIndex, () => getActorOnTile(tileIndex), formRoot);
  } else {
    clearCreatureLiveApplyTimer();
  }
  editorState.editingCreatureTileIndex = null;
  return true;
}

function finishCreatureEdit() {
  flushCreatureEditIfOpen();
  refreshInspector();
}

function startCreatureEdit(tileIndex) {
  if (tileIndex == null) return;
  clearCreatureLiveApplyTimer();
  editorState.editingCreatureTileIndex = tileIndex;
  editorState.editingSprite = null;
  // Only steal focus to the Level field on this very first render — later re-renders of
  // the same edit session (live-apply commits, board updates) must not yank focus/scroll
  // away from whatever field the user is actually typing in.
  editorState.creatureEditFocusPending = true;
  refreshInspector();
}

function cancelCreatureEdit() {
  finishCreatureEdit();
}

function createCreatureEditorPanel(tileIndex, actor) {
  const panel = document.createElement('div');
  panel.className = 'me-sprite-edit me-creature-edit';
  panel.dataset.creatureForm = '1';

  const hint = document.createElement('div');
  hint.className = 'me-muted me-creature-edit-hint';
  hint.textContent = t(
    'mods.mapEditor.creatureEditHint',
    'Changes apply automatically while you edit. Ability cooldown is saved for native maps/quests only.'
  );
  panel.appendChild(hint);

  const allyRow = document.createElement('label');
  allyRow.className = 'me-check-row';
  const allyCheckbox = document.createElement('input');
  allyCheckbox.type = 'checkbox';
  allyCheckbox.checked = editorAlliedTiles.has(tileIndex);
  allyCheckbox.addEventListener('change', (e) => {
    e.stopPropagation();
    const isAlly = allyCheckbox.checked;
    const ok = setCreatureAllyOnTile(tileIndex, isAlly);
    if (ok) {
      setStatusMessage(
        isAlly
          ? t('mods.mapEditor.creatureMadeAlly', 'Tile {tile} creature will fight as a forced ally.').replace('{tile}', String(tileIndex))
          : t('mods.mapEditor.creatureMadeVillain', 'Tile {tile} creature will fight as a villain.').replace('{tile}', String(tileIndex))
      );
      refreshInspector();
    } else {
      allyCheckbox.checked = !isAlly;
    }
  });
  allyRow.append(
    allyCheckbox,
    document.createTextNode(t('mods.mapEditor.creatureAllyToggle', 'Fights as ally (forced teammate, not a villain)'))
  );
  panel.appendChild(allyRow);

  const form = document.createElement('div');
  form.className = 'me-creature-form-grid';
  const formState = buildCreatureEditorFormState(actor, tileIndex);

  const levelInput = createCreatureNumberInput(formState.level, { min: 1, max: 999 });
  levelInput.dataset.creatureLevel = '1';
  levelInput.classList.add('me-creature-input-compact');
  appendCreatureFormRow(form, t('mods.mapEditor.creatureLevel', 'Level'), levelInput);

  const directionSelect = createCreatureSelect(
    CREATURE_DIRECTIONS.map((dir) => ({
      value: dir,
      label: t(`mods.mapEditor.creatureDirections.${dir}`, dir)
    })),
    formState.direction,
    'me-input me-creature-input-compact'
  );
  directionSelect.dataset.creatureDirection = '1';
  appendCreatureFormRow(form, t('mods.mapEditor.creatureDirection', 'Facing'), directionSelect);

  const flagsRow = document.createElement('div');
  flagsRow.className = 'me-creature-form-row me-creature-check-row';
  const shinyCheck = document.createElement('input');
  shinyCheck.type = 'checkbox';
  shinyCheck.dataset.creatureShiny = '1';
  shinyCheck.checked = formState.shiny;
  const shinyLabel = document.createElement('label');
  shinyLabel.className = 'me-check-row';
  shinyLabel.append(shinyCheck, document.createTextNode(t('mods.mapEditor.creatureShiny', 'Shiny')));

  const awakenedCheck = document.createElement('input');
  awakenedCheck.type = 'checkbox';
  awakenedCheck.dataset.creatureAwakened = '1';
  awakenedCheck.checked = formState.awakened;
  const awakenedLabel = document.createElement('label');
  awakenedLabel.className = 'me-check-row';
  awakenedLabel.append(awakenedCheck, document.createTextNode(t('mods.mapEditor.creatureAwakened', 'Awakened')));

  flagsRow.append(shinyLabel, awakenedLabel);
  form.appendChild(flagsRow);

  const genesTitle = document.createElement('div');
  genesTitle.className = 'me-creature-section-title';
  genesTitle.textContent = t('mods.mapEditor.creatureGenes', 'Genes');
  form.appendChild(genesTitle);

  const genesWrap = document.createElement('div');
  genesWrap.className = 'me-creature-genes';
  genesWrap.dataset.creatureGenesPanel = '1';
  CREATURE_GENE_KEYS.forEach(({ key, label }) => {
    const geneRow = document.createElement('div');
    geneRow.className = 'me-creature-gene-row';

    const geneLabel = document.createElement('span');
    geneLabel.className = 'me-creature-gene-label';
    geneLabel.textContent = label;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(CREATURE_GENE_UI_MIN);
    slider.max = String(CREATURE_GENE_UI_MAX);
    slider.step = '5';
    slider.value = String(formState.genes[key]);
    slider.dataset.creatureGene = key;
    slider.className = 'me-creature-gene-slider';

    const valueLabel = document.createElement('span');
    valueLabel.className = 'me-creature-gene-value';
    valueLabel.textContent = slider.value;
    slider.addEventListener('input', () => {
      valueLabel.textContent = slider.value;
    });

    geneRow.append(geneLabel, slider, valueLabel);
    genesWrap.appendChild(geneRow);
  });
  form.appendChild(genesWrap);

  const statsTitle = document.createElement('div');
  statsTitle.className = 'me-creature-section-title';
  statsTitle.textContent = t('mods.mapEditor.creatureCombatStats', 'Combat stats');
  form.appendChild(statsTitle);

  const statsPanel = document.createElement('div');
  statsPanel.className = 'me-creature-stats';
  statsPanel.dataset.creatureStatsPanel = '1';
  CREATURE_COMBAT_STAT_KEYS.forEach(({ key, label }) => {
    const statRow = document.createElement('div');
    statRow.className = 'me-creature-stat-row';
    const statLabel = document.createElement('span');
    statLabel.className = 'me-creature-stat-label';
    statLabel.textContent = label;
    const statValue = document.createElement('span');
    statValue.className = 'me-creature-stat-value';
    statValue.dataset.creatureStat = key;
    statValue.textContent = '—';
    statRow.append(statLabel, statValue);
    statsPanel.appendChild(statRow);
  });
  form.appendChild(statsPanel);

  const equipTitle = document.createElement('div');
  equipTitle.className = 'me-creature-section-title';
  equipTitle.textContent = t('mods.mapEditor.creatureEquip', 'Equipment');
  form.appendChild(equipTitle);

  const equipFields = document.createElement('div');
  equipFields.className = 'me-creature-equip-fields';
  const equipGameIdSelect = createEquipmentSelect(
    formState.equipGameId,
    'me-input me-creature-input-compact me-creature-equip-select'
  );
  equipGameIdSelect.dataset.creatureEquipGameId = '1';
  const equipStatSelect = createCreatureSelect(
    CREATURE_EQUIP_STATS.map((stat) => ({ value: stat, label: stat.toUpperCase() })),
    formState.equipStat,
    'me-input me-creature-input-compact'
  );
  equipStatSelect.dataset.creatureEquipStat = '1';
  const equipTierInput = createCreatureNumberInput(formState.equipTier, {
    min: CREATURE_EQUIP_TIER_MIN,
    max: CREATURE_EQUIP_TIER_MAX
  });
  equipTierInput.dataset.creatureEquipTier = '1';
  equipTierInput.classList.add('me-creature-input-compact');
  equipGameIdSelect.addEventListener('change', () => {
    if (!equipGameIdSelect.value) return;
    // Default to max tier when picking equipment.
    equipTierInput.value = String(CREATURE_EQUIP_TIER_DEFAULT);
  });
  appendCreatureFormRow(equipFields, t('mods.mapEditor.creatureEquipItem', 'Item'), equipGameIdSelect);
  appendCreatureFormRow(equipFields, t('mods.mapEditor.creatureEquipStat', 'Stat'), equipStatSelect);
  appendCreatureFormRow(equipFields, t('mods.mapEditor.creatureEquipTier', 'Equip tier'), equipTierInput);
  form.appendChild(equipFields);

  const visualsTitle = document.createElement('div');
  visualsTitle.className = 'me-creature-section-title';
  visualsTitle.textContent = t('mods.mapEditor.creatureVisuals', 'Visuals');
  form.appendChild(visualsTitle);

  const nicknameInput = document.createElement('input');
  nicknameInput.type = 'text';
  nicknameInput.className = 'me-input me-input-wide';
  nicknameInput.dataset.creatureNickname = '1';
  nicknameInput.value = formState.nickname;
  nicknameInput.placeholder = t('mods.mapEditor.creatureNicknamePlaceholder', 'Nickname (optional)');
  appendCreatureFormRow(form, t('mods.mapEditor.creatureNickname', 'Nickname'), nicknameInput);

  const outfitInput = document.createElement('input');
  outfitInput.type = 'text';
  outfitInput.className = 'me-input me-creature-input-compact';
  outfitInput.value = formState.outfitSpriteId === '' || formState.outfitSpriteId == null
    ? ''
    : (resolveCreatureNameFromOutfitSpriteId(formState.outfitSpriteId) || String(formState.outfitSpriteId));
  outfitInput.dataset.creatureOutfitId = '1';
  outfitInput.placeholder = t('mods.mapEditor.creatureOutfitIdPlaceholder', 'Name or ID (e.g. Druid)');
  outfitInput.title = t(
    'mods.mapEditor.creatureOutfitIdHint',
    'Overrides how this creature looks while keeping its own combat stats. Type another creature\'s name (e.g. "Druid") or its ID — resolved to that creature\'s sprite automatically.'
  );
  // Normalize the field to the creature's canonical display name once it settles (e.g.
  // typing "orc shaman" becomes "Orc Shaman", and a typed numeric ID becomes that
  // creature's name too), instead of collapsing free text down to a bare sprite ID. The
  // resolved numeric ID is still what actually gets stored — see mergeActorConfigFromForm,
  // which re-resolves this field's text at save time regardless of what it displays.
  outfitInput.addEventListener('blur', () => {
    const resolved = resolveOutfitSpriteIdFromInput(outfitInput.value);
    if (resolved != null) {
      const display = resolveCreatureNameFromOutfitSpriteId(resolved) || String(resolved);
      if (display !== outfitInput.value.trim()) {
        outfitInput.value = display;
      }
    }
    outfitInput.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const outfitRow = document.createElement('div');
  outfitRow.className = 'me-row';
  outfitRow.appendChild(outfitInput);
  const outfitOwnIdBtn = createPanelButton(
    t('mods.mapEditor.creatureOutfitUseOwnId', 'Use this creature’s ID'),
    () => {
      const ownGameId = resolveCreatureGameId(actor);
      const resolved = resolveOutfitSpriteIdForCreature(ownGameId);
      if (resolved == null) return;
      outfitInput.value = resolveCreatureNameFromOutfitSpriteId(resolved) || String(resolved);
      outfitInput.dispatchEvent(new Event('change', { bubbles: true }));
    },
    'me-btn me-btn-compact'
  );
  outfitRow.appendChild(outfitOwnIdBtn);
  appendCreatureFormRow(form, t('mods.mapEditor.creatureOutfitId', 'Outfit sprite'), outfitRow);

  const itemInput = createCreatureNumberInput(formState.itemSpriteId, { min: 1 });
  itemInput.dataset.creatureItemId = '1';
  itemInput.classList.add('me-creature-input-compact');
  itemInput.placeholder = t('mods.mapEditor.creatureSpriteIdPlaceholder', 'Sprite ID');
  appendCreatureFormRow(form, t('mods.mapEditor.creatureItemId', 'Item sprite'), itemInput);

  const advancedTitle = document.createElement('div');
  advancedTitle.className = 'me-creature-section-title';
  advancedTitle.textContent = t('mods.mapEditor.creatureAdvanced', 'Map export');
  form.appendChild(advancedTitle);

  const abilityCdInput = createCreatureNumberInput(formState.abilityCooldownTicks, { min: 0 });
  abilityCdInput.dataset.creatureAbilityCd = '1';
  abilityCdInput.classList.add('me-creature-input-compact');
  abilityCdInput.placeholder = t('mods.mapEditor.creatureAbilityCdPlaceholder', 'Ticks (optional)');
  appendCreatureFormRow(
    form,
    t('mods.mapEditor.creatureAbilityCd', 'Ability CD'),
    abilityCdInput
  );

  panel.appendChild(form);

  const gameId = resolveCreatureGameId(actor);
  const getActorBase = () => getActorOnTile(tileIndex) || actor;
  attachCreatureFormLiveApply(panel, tileIndex, getActorBase, gameId);

  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      finishCreatureEdit();
    }
  });

  if (editorState.creatureEditFocusPending) {
    editorState.creatureEditFocusPending = false;
    requestAnimationFrame(() => levelInput.focus());
  }
  return panel;
}

function getEditorPlacedVillainsList() {
  return Array.from(editorPlacedVillains.values())
    .sort((a, b) => a.tileIndex - b.tileIndex);
}

function collectRoomNativeVillainConfigs() {
  const room = getCurrentRoom();
  if (!room?.file?.data) return [];

  const tileCount = getRoomDataTileCount(room.file.data) || getMapTileCount();
  if (!tileCount) return [];

  const normalized = normalizeRoomActorsForGame(room.file.data.actors, tileCount);
  if (!normalized) return [];

  const villains = [];
  normalized.forEach((actor, tileIndex) => {
    if (actor == null) return;
    const config = buildMapEditorVillainConfig(tileIndex, actor.id, actor);
    if (config) villains.push(config);
  });
  return villains;
}

/** Editor-placed villains override native room actors on the same tile. */
function collectMapVillainConfigs() {
  const byTile = new Map();
  collectRoomNativeVillainConfigs().forEach((villain) => {
    byTile.set(villain.tileIndex, villain);
  });
  getEditorPlacedVillainsList().forEach((villain) => {
    byTile.set(villain.tileIndex, cloneJson(villain));
  });
  return Array.from(byTile.values()).sort((a, b) => a.tileIndex - b.tileIndex);
}

function isMapEditorVillainEntity(entity) {
  return typeof entity?.key === 'string' && entity.key.startsWith(MAP_EDITOR_VILLAIN_KEY_PREFIX);
}

function isMapEditorAllyEntity(entity) {
  return typeof entity?.key === 'string' && entity.key.startsWith(MAP_EDITOR_ALLY_KEY_PREFIX);
}

function removeAllMapEditorVillainsFromBoard() {
  if (!globalThis.state?.board) return false;
  try {
    const raw = globalThis.state.board.getSnapshot()?.context?.boardConfig;
    const boardConfig = compactBoardConfigEntries(raw);
    const filtered = boardConfig.filter((entity) => !isMapEditorVillainEntity(entity) && !isMapEditorAllyEntity(entity));
    const hadNulls = Array.isArray(raw) && raw.some((entity) => entity == null);
    if (!hadNulls && filtered.length === boardConfig.length) return false;
    sendBoardSetState((prev) => ({ ...prev, boardConfig: filtered }));
    return true;
  } catch (e) {
    logMapEditor('removeMapEditorVillainsFailed', e);
    return false;
  }
}

function removeAllVillainsFromBoard() {
  if (!globalThis.state?.board) return false;
  try {
    const raw = globalThis.state.board.getSnapshot()?.context?.boardConfig;
    const boardConfig = compactBoardConfigEntries(raw);
    const filtered = boardConfig.filter((entity) => entity && !entity.villain && !isMapEditorAllyEntity(entity));
    const hadNulls = Array.isArray(raw) && raw.some((entity) => entity == null);
    if (!hadNulls && filtered.length === boardConfig.length) return false;
    sendBoardSetState((prev) => ({ ...prev, boardConfig: filtered }));
    return true;
  } catch (e) {
    logMapEditor('removeAllVillainsFailed', e);
    return false;
  }
}

function clearAllActorsFromMap(options = {}) {
  const { skipNotify = false, skipBoardSync = false } = options;
  const data = getCurrentRoom()?.file?.data;
  if (!data) return 0;

  let cleared = 0;
  const tileCount = getMapTileCount();
  if (Array.isArray(data.actors)) {
    for (let tileIndex = 0; tileIndex < data.actors.length; tileIndex += 1) {
      if (data.actors[tileIndex] != null) cleared += 1;
    }
  }
  data.actors = [];
  editorPlacedVillains.clear();
  editorAlliedTiles.clear();
  if (!skipBoardSync) removeAllVillainsFromBoard();
  if (!skipNotify) {
    notifyMapEditorEditsChanged({ skipVillainBoardResync: !skipBoardSync });
  }
  return cleared;
}

function buildEntityKeyPrefixes(entities, fallbackNoun) {
  return (entities || []).map((entry) => {
    const prefix = entry.keyPrefix || `${entry.nickname?.toLowerCase() || fallbackNoun}-tile-${entry.tileIndex}-`;
    const hasTileInPrefix = prefix.includes(`${entry.tileIndex}-`);
    return {
      prefix,
      tileIndex: entry.tileIndex,
      nickname: entry.nickname,
      hasTileInPrefix: hasTileInPrefix
        || prefix.endsWith(`-${entry.tileIndex}-`)
        || prefix.includes(`tile-${entry.tileIndex}-`)
    };
  });
}

function syncMapEditorVillainKeyPrefixes() {
  if (!mapEditorTestBattle?.config) return;
  mapEditorTestBattle.villainKeyPrefixes = buildEntityKeyPrefixes(mapEditorTestBattle.config.villains, 'villain');
}

function syncMapEditorAllyKeyPrefixes() {
  if (!mapEditorTestBattle?.config) return;
  mapEditorTestBattle.allyKeyPrefixes = buildEntityKeyPrefixes(mapEditorTestBattle.config.allies, 'ally');
}

function isUserPlacedEditorVillain(tileIndex, villainConfig = null) {
  const placed = villainConfig ?? editorPlacedVillains.get(tileIndex);
  if (!placed) return false;
  const originalActor = getOriginalActorOnTile(tileIndex);
  if (!originalActor) return true;
  const nativeConfig = buildMapEditorVillainConfig(tileIndex, originalActor.id, originalActor);
  if (!nativeConfig) return true;
  return !actorConfigsEqual(nativeConfig, placed);
}

function hydrateEditorPlacedVillainsFromRoom() {
  if (!globalThis.state?.board?.getSnapshot) return;

  editorPlacedVillains.clear();
  editorAlliedTiles.clear();
  const boardConfig = globalThis.state.board.getSnapshot()?.context?.boardConfig || [];
  boardConfig.forEach((entity) => {
    if (!entity) return;
    const isAllyEntity = isMapEditorAllyEntity(entity);
    if (!isAllyEntity && !isMapEditorVillainEntity(entity)) return;
    const tileIndex = Number(entity.tileIndex);
    if (!Number.isFinite(tileIndex)) return;
    if (isAllyEntity) editorAlliedTiles.add(tileIndex);
    const villainConfig = buildMapEditorVillainConfig(
      tileIndex,
      entity.gameId ?? entity.id,
      entity
    );
    if (villainConfig && (isAllyEntity || isUserPlacedEditorVillain(tileIndex, villainConfig))) {
      editorPlacedVillains.set(tileIndex, villainConfig);
    }
  });
}

function compactBoardConfigEntries(boardConfig) {
  if (!Array.isArray(boardConfig)) return [];
  return boardConfig.filter((entity) => {
    if (entity == null || typeof entity !== 'object') return false;
    return Number.isFinite(Number(entity.tileIndex));
  });
}

function sanitizeBoardConfigIfNeeded() {
  if (boardConfigSanitizeLock || !globalThis.state?.board) return false;
  let raw = null;
  try {
    raw = globalThis.state.board.getSnapshot()?.context?.boardConfig;
  } catch (e) {
    return false;
  }
  if (!Array.isArray(raw)) return false;
  const compacted = compactBoardConfigEntries(raw);
  const hadNulls = raw.some((entity) => entity == null);
  if (!hadNulls && compacted.length === raw.length) return false;

  boardConfigSanitizeLock = true;
  try {
    sendBoardSetState((prev) => ({
      ...prev,
      boardConfig: compactBoardConfigEntries(prev?.boardConfig)
    }));
    return true;
  } catch (e) {
    logMapEditor('sanitizeBoardConfigFailed', e);
    return false;
  } finally {
    boardConfigSanitizeLock = false;
  }
}

function compactBoardConfigInGameState() {
  if (!globalThis.state?.board) return false;
  try {
    sendBoardSetState((prev) => {
      const raw = prev?.boardConfig;
      const boardConfig = compactBoardConfigEntries(raw);
      const hadNulls = Array.isArray(raw) && raw.some((entity) => entity == null);
      if (!hadNulls && (!Array.isArray(raw) || boardConfig.length === raw.length)) {
        return prev;
      }
      return { ...prev, boardConfig };
    });
    return true;
  } catch (e) {
    logMapEditor('compactBoardConfigFailed', e);
    return false;
  }
}

function clearEditorPlacedVillains(options = {}) {
  editorPlacedVillains.clear();
  editorAlliedTiles.clear();
  if (options.skipBoardPatch !== true) {
    removeAllMapEditorVillainsFromBoard();
  }
}

function summarizeEditorVillainEntities(boardConfig) {
  return compactBoardConfigEntries(boardConfig)
    .filter((entity) => entity
      && (entity.villain || isMapEditorVillainEntity(entity) || isMapEditorAllyEntity(entity)))
    .map((entity) => ({
      tileIndex: Number(entity.tileIndex),
      gameId: resolveCreatureGameId(entity),
      level: entity.level ?? null,
      direction: entity.direction || 'south',
      shiny: entity.shiny === true,
      awakened: entity.awakened === true || entity.awaken === true || entity.isAwakened === true,
      nickname: entity.nickname || '',
      outfitSpriteId: entity.outfitSpriteId ?? null,
      itemSpriteId: entity.itemSpriteId ?? null,
      customSpriteKey: entity.customSpriteKey ?? null,
      equip: entity.equip ?? null,
      genes: entity.genes ?? null,
      villain: entity.villain === true
    }))
    .sort((a, b) => a.tileIndex - b.tileIndex);
}

function editorVillainBoardStatesEqual(a, b) {
  try {
    return JSON.stringify(summarizeEditorVillainEntities(a))
      === JSON.stringify(summarizeEditorVillainEntities(b));
  } catch (_) {
    return false;
  }
}

function applyEditorVillainsToBoard(options = {}) {
  if (!mapEditorTestBattle?.config || !editorState.sandboxTestActive) return false;
  if (!globalThis.state?.board) return false;
  if (restoreMapInProgress && options.allowDuringRestore !== true) {
    logMapEditor('applyEditorVillainsSkipped', { reason: 'restore-in-progress' });
    return false;
  }

  const { villains, allies } = splitVillainsAndAllies(collectMapVillainConfigs());
  mapEditorTestBattle.config.villains = villains.map((entry) => cloneJson(entry));
  mapEditorTestBattle.config.allies = allies.map((entry) => ({
    ...cloneJson(entry),
    keyPrefix: `${MAP_EDITOR_ALLY_KEY_PREFIX}${entry.tileIndex}-`
  }));
  syncMapEditorVillainKeyPrefixes();
  syncMapEditorAllyKeyPrefixes();

  try {
    const boardContext = globalThis.state.board.getSnapshot().context;
    const currentBoardConfig = compactBoardConfigEntries(boardContext.boardConfig);
    let updatedBoardConfig = currentBoardConfig.filter((entity) => {
      if (!entity) return false;
      if (isMapEditorVillainEntity(entity)) return false;
      if (isMapEditorAllyEntity(entity)) return false;
      if (entity.villain) return false;
      return true;
    });

    const appendBoardEntities = (configs, createFn, badEntityLogTag) => {
      const tiles = [];
      configs.forEach((config) => {
        const entity = createFn(config);
        if (!entity || !Number.isFinite(Number(entity.tileIndex))) {
          logMapEditor(badEntityLogTag, { tileIndex: config?.tileIndex ?? null, hasEntity: !!entity });
          return;
        }
        updatedBoardConfig.push(entity);
        tiles.push(entity.tileIndex);
      });
      return tiles;
    };

    const villainTiles = appendBoardEntities(
      mapEditorTestBattle.config.villains,
      (config) => mapEditorTestBattle.createCustomVillainEntity(config),
      'applyEditorVillainsBadEntity'
    );
    const allyTiles = appendBoardEntities(
      mapEditorTestBattle.config.allies,
      (config) => mapEditorTestBattle.createCustomAllyEntity(config),
      'applyEditorAlliesBadEntity'
    );

    updatedBoardConfig = compactBoardConfigEntries(updatedBoardConfig);
    // Compare content (level/dir/shiny/side/etc), not just counts — live edits keep count stable.
    if (options.force !== true
      && updatedBoardConfig.length === currentBoardConfig.length
      && editorVillainBoardStatesEqual(currentBoardConfig, updatedBoardConfig)) {
      logMapEditor('applyEditorVillainsSkipped', { reason: 'no-change', count: villains.length + allies.length });
      return true;
    }

    logMapEditor('applyEditorVillainsPending', {
      count: villainTiles.length,
      allyCount: allyTiles.length,
      tiles: villainTiles,
      allyTiles,
      boardBefore: summarizeBoardConfig(boardContext.boardConfig)
    });
    sendBoardSetState((prev) => ({ ...prev, boardConfig: updatedBoardConfig }));
    suppressSandboxAutoSetupReapplyUntil = Date.now() + 800;
    suppressBoardListenerRefreshUntil = Date.now() + 800;
    if (typeof mapEditorTestBattle.scheduleVillainOutfitSpriteOverrides === 'function') {
      mapEditorTestBattle.scheduleVillainOutfitSpriteOverrides({ force: true });
    }
    logMapEditor('applyEditorVillains', { count: villains.length, allyCount: allies.length });
    return true;
  } catch (e) {
    logMapEditor('applyEditorVillainsFailed', e);
  }
  return false;
}

function buildDefaultActorConfig(gameId, sampleActor = null) {
  const id = resolveCreatureGameId(sampleActor) ?? resolveCreatureGameId(gameId);
  if (id == null) return null;
  const level = Number(sampleActor?.level);
  return {
    id,
    direction: sampleActor?.direction || 'south',
    level: Number.isFinite(level) && level > 0 ? Math.floor(level) : 1
  };
}

function clearActorOnTile(tileIndex, options = {}) {
  const { skipNotify = false, skipBoardSync = false, skipThrottle = false } = options;
  if (!skipThrottle && !guardMapEditorManipulator('clear-actor')) return false;
  if (tileIndex == null) return false;
  const data = getCurrentRoom()?.file?.data;
  if (!data) return false;
  if (!Array.isArray(data.actors)) data.actors = [];

  const hadActor = data.actors[tileIndex] != null;
  const hadEditorVillain = editorPlacedVillains.has(tileIndex);
  if (!hadActor && !hadEditorVillain) return false;

  delete data.actors[tileIndex];
  applySparseActorsToRoomData(data);
  editorPlacedVillains.delete(tileIndex);
  editorAlliedTiles.delete(tileIndex);

  if (!skipBoardSync) {
    if (editorState.sandboxTestActive) {
      applyEditorVillainsToBoard();
    } else {
      refreshBoardFromRoomFile();
    }
  }

  if (!skipNotify) {
    notifyMapEditorEditsChanged({ skipVillainBoardResync: true });
  }
  logMapEditor('clearActor', { tileIndex, hadEditorVillain });
  return true;
}

function setActorOnTile(tileIndex, actorConfig, options = {}) {
  const { skipNotify = false, skipBoardSync = false, skipThrottle = false } = options;
  if (!skipThrottle && !guardMapEditorManipulator('set-actor')) return false;
  if (tileIndex == null || !actorConfig) return false;
  const data = getCurrentRoom()?.file?.data;
  if (!data) return false;
  if (!Array.isArray(data.actors)) data.actors = [];
  data.actors[tileIndex] = cloneJson(actorConfig);
  applySparseActorsToRoomData(data);

  const villainConfig = buildMapEditorVillainConfig(tileIndex, actorConfig.id, actorConfig);
  if (villainConfig) {
    editorPlacedVillains.set(tileIndex, villainConfig);
    if (!skipBoardSync) applyEditorVillainsToBoard();
  }

  if (!skipNotify) {
    notifyMapEditorEditsChanged({ skipVillainBoardResync: !skipBoardSync });
  }
  logMapEditor('setActor', { tileIndex, gameId: actorConfig.id, onBoard: !skipBoardSync });
  return true;
}

/** Flip a placed creature between fighting as a villain (default) or a forced ally teammate. */
function setCreatureAllyOnTile(tileIndex, isAlly, options = {}) {
  const { skipNotify = false, skipBoardSync = false } = options;
  if (tileIndex == null) return false;

  if (!editorPlacedVillains.has(tileIndex)) {
    // Claim this tile's still-native (unedited) actor as editor-placed, same as setActorOnTile.
    const actorConfig = getActorOnTile(tileIndex);
    const villainConfig = actorConfig
      ? buildMapEditorVillainConfig(tileIndex, actorConfig.id, actorConfig)
      : null;
    if (!villainConfig) return false;
    editorPlacedVillains.set(tileIndex, villainConfig);
  }

  if (isAlly) editorAlliedTiles.add(tileIndex);
  else editorAlliedTiles.delete(tileIndex);

  if (!skipBoardSync) applyEditorVillainsToBoard();
  if (!skipNotify) {
    notifyMapEditorEditsChanged({ skipVillainBoardResync: !skipBoardSync });
  }
  logMapEditor('setCreatureAlly', { tileIndex, isAlly: !!isAlly });
  return true;
}

function collectMapUsedCreatures() {
  const rooms = getAllGameRooms();
  if (allRoomsCreaturesCache && allRoomsCreaturesCache.roomCount === rooms.length) {
    return allRoomsCreaturesCache.list;
  }

  const byId = new Map();
  const addActor = (actor, room) => {
    const gameId = resolveCreatureGameId(actor);
    if (gameId == null || !room) return;
    const roomLabel = getRoomDisplayName(room);
    let entry = byId.get(gameId);
    if (!entry) {
      entry = {
        gameId,
        name: getCreatureDisplayName(gameId),
        usageCount: 0,
        mapCount: 0,
        roomLabels: new Set(),
        roomIds: new Set(),
        sampleActor: null,
        onMaps: true
      };
      byId.set(gameId, entry);
    }
    entry.usageCount += 1;
    entry.roomLabels.add(roomLabel);
    if (room.id) entry.roomIds.add(room.id);
    if (!entry.sampleActor) {
      entry.sampleActor = buildDefaultActorConfig(gameId, actor);
    }
  };

  const scanRoom = (room) => {
    const actors = room?.file?.data?.actors;
    if (!Array.isArray(actors)) return;
    actors.forEach((actor) => {
      if (actor) addActor(actor, room);
    });
  };

  if (rooms.length) rooms.forEach(scanRoom);
  else {
    const room = getCurrentRoom();
    if (room) scanRoom(room);
  }

  const list = Array.from(byId.values())
    .map(({ roomLabels, roomIds, ...creature }) => ({
      ...creature,
      name: getCreatureDisplayName(creature.gameId),
      mapCount: roomIds.size,
      roomIds: Array.from(roomIds),
      searchLabels: Array.from(roomLabels)
    }))
    .sort((a, b) => a.gameId - b.gameId);

  allRoomsCreaturesCache = { roomCount: rooms.length, list };
  return list;
}

function buildCreatureCatalogList(mapUsedList) {
  const byId = new Map(mapUsedList.map((creature) => [creature.gameId, creature]));
  const db = getCreatureDatabase();
  const monsters = db?.getAllMonstersWithPortraits?.() || [];

  for (const monster of monsters) {
    const gameId = monster?.gameId;
    if (!gameId || byId.has(gameId)) continue;
    byId.set(gameId, {
      gameId,
      name: monster.metadata?.name || getCreatureDisplayName(gameId),
      usageCount: 0,
      mapCount: 0,
      roomIds: [],
      searchLabels: [],
      sampleActor: buildDefaultActorConfig(gameId),
      onMaps: false
    });
  }

  return Array.from(byId.values()).sort((a, b) => {
    const nameCmp = a.name.localeCompare(b.name);
    return nameCmp !== 0 ? nameCmp : a.gameId - b.gameId;
  });
}

function filterCreatureList(creatures, includedMapIds = null, searchQuery = '') {
  let filtered = creatures;
  if (includedMapIds instanceof Set) {
    filtered = filtered.filter((creature) => {
      if (!creature.roomIds?.length) return true;
      return creature.roomIds.some((id) => includedMapIds.has(id));
    });
  }

  const query = String(searchQuery || '').trim().toLowerCase();
  if (!query) return filtered;

  return filtered.filter((creature) => {
    if (String(creature.gameId).includes(query)) return true;
    if (creature.name?.toLowerCase().includes(query)) return true;
    return creature.searchLabels?.some((label) => label.toLowerCase().includes(query));
  });
}

function buildCreatureListDisplay(filtered, grandTotal, visibleCount, mapFilterActive = false) {
  const shown = Math.min(visibleCount, filtered.length);
  return {
    items: filtered.slice(0, shown),
    shownCount: shown,
    total: filtered.length,
    capped: filtered.length > shown,
    hasFilter: mapFilterActive || !!String(editorState.creatureSearchQuery || '').trim(),
    grandTotal
  };
}

function cancelCreatureListRender() {
  creatureListLoadId += 1;
  creatureListLoadingMore = false;
  if (creatureListRenderRaf != null) {
    cancelAnimationFrame(creatureListRenderRaf);
    creatureListRenderRaf = null;
  }
  if (creatureListLoadMoreObserver) {
    creatureListLoadMoreObserver.disconnect();
    creatureListLoadMoreObserver = null;
    creatureListLoadMoreRoot = null;
  }
}

function cancelCreatureListWork() {
  cancelCreatureListRender();
  if (creatureListSearchTimer != null) {
    clearTimeout(creatureListSearchTimer);
    creatureListSearchTimer = null;
  }
}

function ensureCreatureListLoadMoreObserver() {
  const root = queryInspector('.me-creature-grid-body') || document.getElementById(BODY_ID);
  if (creatureListLoadMoreObserver && creatureListLoadMoreRoot === root) {
    return creatureListLoadMoreObserver;
  }
  if (creatureListLoadMoreObserver) {
    creatureListLoadMoreObserver.disconnect();
    creatureListLoadMoreObserver = null;
  }
  creatureListLoadMoreRoot = root;
  creatureListLoadMoreObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) loadMoreCreatureList();
    });
  }, { root, rootMargin: '200px' });
  return creatureListLoadMoreObserver;
}

function removeCreatureListSentinel(grid) {
  const sentinel = grid?.querySelector('.me-creature-load-sentinel');
  if (!sentinel) return;
  creatureListLoadMoreObserver?.unobserve(sentinel);
  sentinel.remove();
}

function updateCreatureListSentinel(grid, hasMore) {
  removeCreatureListSentinel(grid);
  if (!hasMore || !grid) return;
  const sentinel = document.createElement('div');
  sentinel.className = 'me-creature-load-sentinel';
  sentinel.setAttribute('aria-hidden', 'true');
  grid.appendChild(sentinel);
  ensureCreatureListLoadMoreObserver().observe(sentinel);
}

function showCreatureListSkeleton(grid) {
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

function createCreatureCard(creature) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'me-asset-card me-creature-card';
  card.title = t('mods.mapEditor.creatureUse', 'Use {name} (id {id})')
    .replace('{name}', creature.name)
    .replace('{id}', String(creature.gameId));

  const preview = document.createElement('div');
  preview.className = 'me-creature-preview';

  const img = document.createElement('img');
  img.className = 'me-creature-portrait';
  img.alt = creature.name;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = getCreaturePortraitUrl(creature.gameId);
  img.addEventListener('error', () => {
    preview.classList.add('me-creature-preview-fallback');
    preview.textContent = String(creature.gameId);
    img.remove();
  }, { once: true });
  preview.appendChild(img);
  card.appendChild(preview);

  const meta = document.createElement('div');
  meta.className = 'me-asset-meta';

  const nameLine = document.createElement('div');
  nameLine.className = 'me-creature-name';
  nameLine.textContent = creature.name;

  meta.append(nameLine);
  card.appendChild(meta);

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    applyCreatureToSelection(creature);
  });
  return card;
}

// Registry-driven custom-PNG sprites (window.CustomBattles.CUSTOM_SPRITES) — placed the
// same way as a normal creature, but with a customSpriteKey visual override baked in.
function getCustomSpriteRegistry() {
  return Array.isArray(window.CustomBattles?.CUSTOM_SPRITES) ? window.CustomBattles.CUSTOM_SPRITES : [];
}

function filterCustomSpriteList(searchQuery) {
  const all = getCustomSpriteRegistry();
  const query = String(searchQuery || '').trim().toLowerCase();
  if (!query) return all;
  return all.filter((def) => String(def?.name || def?.key || '').toLowerCase().includes(query));
}

function createCustomSpriteCard(spriteDef) {
  const displayName = spriteDef.name || spriteDef.key;
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'me-asset-card me-creature-card';
  card.title = t('mods.mapEditor.customSpriteUse', 'Use custom sprite {name}').replace('{name}', displayName);

  const preview = document.createElement('div');
  preview.className = 'me-creature-preview';

  const img = document.createElement('img');
  img.className = 'me-creature-portrait';
  img.alt = displayName;
  img.loading = 'lazy';
  img.decoding = 'async';
  const assetUrl = window.CustomBattles?.getCustomSpriteAssetUrl?.(spriteDef.portraitUrl || spriteDef.idleUrl);
  if (assetUrl) img.src = assetUrl;
  img.addEventListener('error', () => {
    preview.classList.add('me-creature-preview-fallback');
    preview.textContent = displayName;
    img.remove();
  }, { once: true });
  preview.appendChild(img);
  card.appendChild(preview);

  const meta = document.createElement('div');
  meta.className = 'me-asset-meta';

  const nameLine = document.createElement('div');
  nameLine.className = 'me-creature-name';
  nameLine.textContent = displayName;

  meta.append(nameLine);
  card.appendChild(meta);

  card.addEventListener('click', (e) => {
    e.stopPropagation();
    applyCustomSpriteToSelection(spriteDef);
  });
  return card;
}

async function applyCustomSpriteToSelection(spriteDef) {
  const displayName = spriteDef.name || spriteDef.key;
  const gameId = Number(spriteDef.baseGameId);
  if (!Number.isFinite(gameId)) {
    setStatusMessage(
      t('mods.mapEditor.customSpriteMissingBase', '"{name}" has no base creature configured (baseGameId) in the registry.')
        .replace('{name}', displayName),
      true
    );
    return;
  }
  const actorConfig = buildDefaultActorConfig(gameId);
  if (!actorConfig) return;
  actorConfig.customSpriteKey = spriteDef.key;
  actorConfig.nickname = spriteDef.nickname || displayName;
  actorConfig.level = Number(spriteDef.level) || 50;

  const tileIndex = editorState.selectedTileIndex;
  if (tileIndex != null) {
    const ok = setActorOnTile(tileIndex, actorConfig);
    const onBoard = ok && editorState.sandboxTestActive;
    setStatusMessage(
      ok
        ? onBoard
          ? t('mods.mapEditor.creaturePlaced', 'Placed {name} on tile {tile}.')
              .replace('{name}', displayName)
              .replace('{tile}', String(tileIndex))
          : t('mods.mapEditor.creaturePlacedDataOnly',
            'Saved {name} to map data on tile {tile} — open edit session to preview on board.')
              .replace('{name}', displayName)
              .replace('{tile}', String(tileIndex))
        : t('mods.mapEditor.creaturePlaceFailed', 'Could not place {name}.')
            .replace('{name}', displayName),
      !ok
    );
    refreshInspector();
    return;
  }

  const ok = await copyTextToClipboard(JSON.stringify(actorConfig, null, 2));
  setStatusMessage(
    ok
      ? t('mods.mapEditor.creatureCopied', 'Copied actor JSON for {name} — select a tile to place.')
          .replace('{name}', displayName)
      : t('mods.mapEditor.clipboardFail', 'Clipboard failed.'),
    !ok
  );
}

function appendCustomSpriteSection(grid, searchQuery) {
  grid.querySelectorAll('.me-custom-sprite-separator, .me-custom-sprite-card').forEach((el) => el.remove());
  const entries = filterCustomSpriteList(searchQuery);
  if (!entries.length) return;

  const separator = document.createElement('div');
  separator.className = 'me-custom-sprite-separator';
  separator.textContent = t('mods.mapEditor.customSpritesSeparator', 'Custom sprites');
  grid.appendChild(separator);

  entries.forEach((def) => {
    const card = createCustomSpriteCard(def);
    card.classList.add('me-custom-sprite-card');
    grid.appendChild(card);
  });
}

function appendCreatureCardFragment(grid, fragment) {
  const sentinel = grid.querySelector('.me-creature-load-sentinel');
  if (sentinel) grid.insertBefore(fragment, sentinel);
  else grid.appendChild(fragment);
}

function renderCreatureCardsChunked(grid, creatures, loadId, options = {}) {
  const { allRooms, room, display, append = false, onComplete } = options;
  grid.classList.remove('is-loading');
  if (!append) {
    grid.replaceChildren();
    delete grid.dataset.renderedCount;
  }

  if (!creatures.length && !append) {
    const empty = document.createElement('div');
    empty.className = 'me-muted me-asset-empty';
    empty.textContent = display?.hasFilter
      ? t('mods.mapEditor.creaturesNoMatch', 'No creatures match your search or map filter.')
      : allRooms.length || room
        ? t('mods.mapEditor.creaturesEmpty', 'No creatures found.')
        : t('mods.mapEditor.creaturesUnavailable', 'Open a map first, or wait for creature-database.js to load.');
    grid.appendChild(empty);
    onComplete?.();
    return;
  }

  if (!creatures.length) {
    onComplete?.();
    return;
  }

  let index = 0;
  const finish = () => {
    creatureListRenderRaf = null;
    onComplete?.();
  };

  const renderChunk = () => {
    if (loadId !== creatureListLoadId) return;

    const fragment = document.createDocumentFragment();
    const end = Math.min(index + ASSET_LIST_CHUNK_SIZE, creatures.length);
    for (; index < end; index += 1) {
      fragment.appendChild(createCreatureCard(creatures[index]));
    }
    appendCreatureCardFragment(grid, fragment);

    if (index < creatures.length) {
      creatureListRenderRaf = requestAnimationFrame(renderChunk);
    } else {
      finish();
    }
  };

  creatureListRenderRaf = requestAnimationFrame(renderChunk);
}

function updateCreatureListSummary(summary, display, allRooms, room, loading) {
  if (!summary) return;
  if (loading) {
    summary.textContent = t('mods.mapEditor.creaturesLoading', 'Loading creature index…');
    return;
  }

  const shown = display.shownCount ?? display.items.length;
  if (display.capped) {
    summary.textContent = display.hasFilter
      ? tReplace('mods.mapEditor.creaturesSummaryFiltered',
        { shown: String(shown), total: String(display.total) },
        'Showing {shown} of {total} matches — scroll for more')
      : tReplace('mods.mapEditor.creaturesSummaryCapped',
        { shown: String(shown), total: String(display.grandTotal) },
        'Showing {shown} of {total} creatures — scroll for more');
    return;
  }

  summary.textContent = tReplace('mods.mapEditor.creaturesSummaryCatalog',
    { count: String(display.total), mapUsed: String(display.grandTotal) },
    '{count} creatures ({mapUsed} used on maps)');
}

function loadMoreCreatureList() {
  if (creatureListLoadingMore || !creatureListFilteredCache) return;

  const grid = queryInspector('#map-editor-creature-grid');
  const summary = queryInspector('#map-editor-creature-summary');
  if (!grid || grid.classList.contains('is-loading')) return;

  const currentCount = Number(grid.dataset.renderedCount || 0);
  const { filtered, grandTotal, includedMapIds } = creatureListFilteredCache;
  if (currentCount >= filtered.length) {
    removeCreatureListSentinel(grid);
    return;
  }

  const nextCount = Math.min(currentCount + ASSET_LIST_PAGE_SIZE, filtered.length);
  const newItems = filtered.slice(currentCount, nextCount);
  if (!newItems.length) return;

  creatureListLoadingMore = true;
  const loadId = creatureListLoadId;
  const allRooms = getAllGameRooms();
  const room = getCurrentRoom();

  renderCreatureCardsChunked(grid, newItems, loadId, {
    allRooms,
    room,
    display: creatureListFilteredCache.display,
    append: true,
    onComplete: () => {
      if (loadId !== creatureListLoadId) return;
      creatureListLoadingMore = false;
      grid.dataset.renderedCount = String(nextCount);
      const display = buildCreatureListDisplay(
        filtered,
        grandTotal,
        nextCount,
        includedMapIds instanceof Set
      );
      updateCreatureListSummary(summary, display, allRooms, room, false);
      updateCreatureListSentinel(grid, nextCount < filtered.length);
    }
  });
}

function scheduleCreatureListRefresh() {
  editorState.creatureListStale = true;
  if (editorState.activeTab !== 'creatures') return;

  if (creatureListSearchTimer != null) {
    clearTimeout(creatureListSearchTimer);
    creatureListSearchTimer = null;
  }

  const grid = queryInspector('#map-editor-creature-grid');
  const summary = queryInspector('#map-editor-creature-summary');
  cancelCreatureListRender();
  if (grid) showCreatureListSkeleton(grid);
  if (summary) {
    updateCreatureListSummary(
      summary,
      { items: [], total: 0, capped: false, hasFilter: false, grandTotal: 0 },
      getAllGameRooms(),
      getCurrentRoom(),
      true
    );
  }

  creatureListSearchTimer = setTimeout(() => {
    creatureListSearchTimer = null;
    refreshCreatureList();
  }, ASSET_LIST_SEARCH_DEBOUNCE_MS);
}

async function applyCreatureToSelection(creature) {
  if (!creature?.gameId) return;
  const actorConfig = buildDefaultActorConfig(creature.gameId, creature.sampleActor);
  if (!actorConfig) return;

  const tileIndex = editorState.selectedTileIndex;
  if (tileIndex != null) {
    const ok = setActorOnTile(tileIndex, actorConfig);
    const onBoard = ok && editorState.sandboxTestActive;
    setStatusMessage(
      ok
        ? onBoard
          ? t('mods.mapEditor.creaturePlaced', 'Placed {name} on tile {tile}.')
              .replace('{name}', creature.name)
              .replace('{tile}', String(tileIndex))
          : t('mods.mapEditor.creaturePlacedDataOnly',
            'Saved {name} to map data on tile {tile} — open edit session to preview on board.')
              .replace('{name}', creature.name)
              .replace('{tile}', String(tileIndex))
        : t('mods.mapEditor.creaturePlaceFailed', 'Could not place {name}.')
            .replace('{name}', creature.name),
      !ok
    );
    refreshInspector();
    return;
  }

  const ok = await copyTextToClipboard(JSON.stringify(actorConfig, null, 2));
  setStatusMessage(
    ok
      ? t('mods.mapEditor.creatureCopied', 'Copied actor JSON for {name} — select a tile to place.')
          .replace('{name}', creature.name)
      : t('mods.mapEditor.clipboardFail', 'Clipboard failed.'),
    !ok
  );
}

function refreshCreatureList() {
  const grid = queryInspector('#map-editor-creature-grid');
  const summary = queryInspector('#map-editor-creature-summary');
  if (!grid) return;

  cancelCreatureListWork();
  const loadId = creatureListLoadId;
  const includedMapIds = getIncludedAssetMapIds();
  const allRooms = getAllGameRooms();
  const room = getCurrentRoom();
  const searchQuery = editorState.creatureSearchQuery;

  showCreatureListSkeleton(grid);
  updateCreatureListSummary(summary, { items: [], total: 0, capped: false, hasFilter: false, grandTotal: 0 }, allRooms, room, true);

  setTimeout(() => {
    if (loadId !== creatureListLoadId) return;

    allRoomsCreaturesCache = null;
    const mapUsed = collectMapUsedCreatures();
    const catalog = buildCreatureCatalogList(mapUsed);
    if (loadId !== creatureListLoadId) return;

    // Creatures are never filtered by the map-selection checkboxes — the catalog
    // already spans every monster in the game, and hiding creatures that don't
    // happen to appear on the selected maps is more confusing than useful. Only
    // the text search narrows this list.
    const filtered = filterCreatureList(catalog, null, searchQuery);
    creatureListFilteredCache = {
      filtered,
      grandTotal: catalog.length,
      includedMapIds,
      display: null
    };
    creatureListFilterKey = getCreatureListCacheKey();
    editorState.creatureListStale = false;
    creatureListLoadingMore = false;

    const display = buildCreatureListDisplay(
      filtered,
      catalog.length,
      ASSET_LIST_PAGE_SIZE,
      false
    );
    creatureListFilteredCache.display = display;
    updateCreatureListSummary(summary, display, allRooms, room, false);

    renderCreatureCardsChunked(grid, display.items, loadId, {
      allRooms,
      room,
      display,
      onComplete: () => {
        if (loadId !== creatureListLoadId) return;
        grid.dataset.renderedCount = String(display.items.length);
        updateCreatureListSentinel(grid, display.capped);
        appendCustomSpriteSection(grid, searchQuery);
        const body = queryInspector('.me-creature-grid-body');
        if (body) body.scrollTop = 0;
        editorState.creatureTabScrollTop = 0;
      }
    });
  }, 0);
}

function updateHitboxEditRow() {
  const section = queryInspector('#map-editor-hitbox-edit-section');
  const hint = queryInspector('#map-editor-hitbox-edit-hint');
  const blockedBtn = queryInspector('#map-editor-hitbox-blocked-btn');
  const walkableBtn = queryInspector('#map-editor-hitbox-walkable-btn');
  const tileIndex = editorState.selectedTileIndex;

  if (section) section.hidden = tileIndex == null;
  if (tileIndex == null) return;

  const value = getHitboxValue(tileIndex);
  const overridden = editorEdits.hitboxOverrides[tileIndex] === true
    || editorEdits.hitboxOverrides[tileIndex] === false;
  const valueLabel = value === true
    ? t('mods.mapEditor.hitboxBlocked', 'Blocked')
    : value === false
      ? t('mods.mapEditor.hitboxWalkable', 'Walkable')
      : t('mods.mapEditor.hitboxUnknown', 'Unknown');

  if (hint) {
    hint.textContent = overridden
      ? t('mods.mapEditor.hitboxEditOverridden', 'Current: {value} (edited).').replace('{value}', valueLabel)
      : t('mods.mapEditor.hitboxEditDefault', 'Current: {value} (from map).').replace('{value}', valueLabel);
  }

  blockedBtn?.classList.toggle('active', value === true);
  walkableBtn?.classList.toggle('active', value === false);
}

function updatePlacementEditRow() {
  const allowBtn = queryInspector('#map-editor-placement-allow-btn');
  const clearBtn = queryInspector('#map-editor-placement-clear-btn');
  const clearAllBtn = queryInspector('#map-editor-placement-clear-all-btn');
  const placementToggle = queryInspector('#map-editor-placement-toggle');
  const tileIndex = editorState.selectedTileIndex;
  const allowed = tileIndex != null && isTileAllowedForPlacement(tileIndex);
  const hasAny = getAllowedPlacementTiles().length > 0;

  if (placementToggle) placementToggle.checked = editorState.placementOverlay;
  if (allowBtn) {
    allowBtn.disabled = tileIndex == null;
    allowBtn.classList.toggle('active', allowed);
  }
  if (clearBtn) {
    clearBtn.disabled = tileIndex == null || !allowed;
  }
  if (clearAllBtn) {
    clearAllBtn.disabled = !hasAny;
  }
}

function updateTileResetButton() {
  const resetBtn = queryInspector('#map-editor-tile-reset-btn');
  const tileIndex = editorState.selectedTileIndex;
  if (!resetBtn) return;
  const visible = tileIndex != null;
  resetBtn.hidden = !visible;
  resetBtn.disabled = !visible || !tileHasPendingEdits(tileIndex);
}

// Shared state for sprite-row drag/drop. `kind` keeps the tile layer and the
// floor-below layer from accepting each other's drops.
let spriteRowDragContext = null;

function spriteRowDragKindMatches(tileIndex, kind) {
  return spriteRowDragContext
    && spriteRowDragContext.kind === kind
    && spriteRowDragContext.tileIndex === tileIndex;
}

function handleSpriteRowLayerDrop(event, row, spriteList, tileIndex, layerIndex, options = {}) {
  event.preventDefault();
  row.classList.remove('me-sprite-row-drop-target');
  const kind = options.kind || 'tile';
  if (!spriteRowDragKindMatches(tileIndex, kind)) return;
  const fromIndex = spriteRowDragContext.index;
  const toIndex = layerIndex;
  if (!Number.isFinite(fromIndex) || fromIndex === toIndex) return;
  const reorder = options.reorder || reorderTileSprites;
  if (reorder(tileIndex, fromIndex, toIndex)) refreshInspector();
}

function attachSpriteRowDropTarget(row, spriteList, tileIndex, layerIndex, options = {}) {
  if (tileIndex == null || layerIndex == null) return;
  const kind = options.kind || 'tile';

  row.addEventListener('dragover', (event) => {
    if (!spriteRowDragKindMatches(tileIndex, kind)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    row.classList.add('me-sprite-row-drop-target');
  });

  row.addEventListener('dragleave', (event) => {
    if (!row.contains(event.relatedTarget)) {
      row.classList.remove('me-sprite-row-drop-target');
    }
  });

  row.addEventListener('drop', (event) => {
    handleSpriteRowLayerDrop(event, row, spriteList, tileIndex, layerIndex, options);
  });
}

function attachSpriteRowDragDrop(row, spriteList, tileIndex, layerIndex, options = {}) {
  if (tileIndex == null || layerIndex == null) return;
  const kind = options.kind || 'tile';

  const dragHandle = document.createElement('span');
  dragHandle.className = 'me-sprite-drag-handle';
  dragHandle.textContent = '⋮⋮';
  dragHandle.title = t('mods.mapEditor.spriteLayerDrag', 'Drag to change layer order');
  dragHandle.setAttribute('aria-hidden', 'true');
  row.prepend(dragHandle);

  row.draggable = true;
  row.dataset.spriteLayerIndex = String(layerIndex);

  row.addEventListener('dragstart', (event) => {
    if (event.target.closest('.me-sprite-actions, button, input, select, textarea')) {
      event.preventDefault();
      return;
    }
    spriteRowDragContext = { kind, tileIndex, index: layerIndex };
    event.dataTransfer.setData('text/plain', String(layerIndex));
    event.dataTransfer.effectAllowed = 'move';
    row.classList.add('me-sprite-row-dragging');
  });

  row.addEventListener('dragend', () => {
    spriteRowDragContext = null;
    row.classList.remove('me-sprite-row-dragging');
    spriteList.querySelectorAll('.me-sprite-row-drop-target').forEach((el) => {
      el.classList.remove('me-sprite-row-drop-target');
    });
  });

  attachSpriteRowDropTarget(row, spriteList, tileIndex, layerIndex, options);
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
  const originalLayer = tileIndex == null ? null : getOriginalTileLayer(tileIndex);
  const configuredLayer = editorEdits.mapCleaned
    ? []
    : originalLayer;
  const floorBelowLayer = tileIndex == null || editorEdits.mapCleaned
    ? []
    : getFloorBelowSpriteLayerForTile(tileIndex);
  // getEditableFloorBelowSprites() already drops hidden native sprites on a cleaned map
  // while keeping editor-added ones (moved down from the main layer, or placed via
  // "Floor below → ＋ Add sprite"), so it's safe to call in both cases — the previous
  // `mapCleaned ? []` short-circuit was what hid added floor-below sprites entirely.
  const floorBelowDomSprites = tileIndex == null ? [] : getEditableFloorBelowSprites(tileIndex);

  updateHitboxEditRow();
  updatePlacementEditRow();
  updateWorkshopBattleRulesControls();
  updateTileResetButton();
  updateMapEditorSessionControls();

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
    } else {
      const hitbox = getHitboxValue(tileIndex);
      const hitboxLabel = hitbox === true
        ? 'blocked'
        : hitbox === false
          ? 'walkable'
          : 'unknown hitbox';
      parts.push(hitboxLabel);
      if (editorEdits.hitboxOverrides[tileIndex] === true || editorEdits.hitboxOverrides[tileIndex] === false) {
        parts.push(t('mods.mapEditor.hitboxEditedTag', 'hitbox edited'));
      }
      if (!editorEdits.mapCleaned) {
        const actor = getActorOnTile(tileIndex);
        if (actor) {
          const actorId = resolveCreatureGameId(actor);
          const actorName = getActorDisplayName(actor, actorId);
          const level = actor.level != null ? ` Lv.${actor.level}` : '';
          parts.push(`actor: ${actorName}${level}`);
        }
      }
    }
    if (tileIndex != null && !editorEdits.mapCleaned) {
      const tileElForSummary = getTileElement(tileIndex);
      const shownIds = tileElForSummary
        ? getEditableTileSprites(tileIndex, tileElForSummary)
            .filter((sprite) => !isSpriteHidden(sprite))
            .map((sprite) => getSpriteIdsFromElement(sprite)[0])
            .filter((id) => id != null)
        : [];
      if (shownIds.length) parts.push(`sprites: ${shownIds.join(', ')}`);
    }
    if (tileIndex != null && configuredLayer?.length) {
      const summary = configuredLayer.map((entry) => {
        if (!entry?.id) return '?';
        const hint = formatSpriteConfigHint(entry);
        return hint ? `${entry.id} (${hint})` : String(entry.id);
      }).join(', ');
      parts.push(`config: ${summary}`);
    } else if (tileIndex != null) {
      parts.push(editorEdits.mapCleaned ? 'config: (cleaned)' : 'config: (empty)');
    }
    if (tileIndex != null && floorBelowDomSprites.length) {
      const floorBelowSummary = floorBelowDomSprites.map((sprite) => {
        const id = getSpriteIdsFromElement(sprite)[0];
        return id != null ? String(id) : '?';
      }).join(', ');
      parts.push(`${t('mods.mapEditor.floorBelowTag', 'floor below')}: ${floorBelowSummary}`);
    } else if (tileIndex != null && floorBelowLayer.length) {
      const floorBelowSummary = floorBelowLayer.map((entry) => {
        if (!entry?.id) return '?';
        const hint = formatSpriteConfigHint(entry);
        return hint ? `${entry.id} (${hint})` : String(entry.id);
      }).join(', ');
      parts.push(`${t('mods.mapEditor.floorBelowTag', 'floor below')}: ${floorBelowSummary}`);
    }
    if (!tileIndex) {
      parts.push('Live edits only — Export for JSON.');
    }
    contextSecondary.textContent = parts.join(' · ');
  }

  if (spriteList) {
    spriteList.querySelectorAll('.me-sprite-preview').forEach((preview) => stopSpritePreviewHostSync(preview));
    spriteList.textContent = '';
    if (tileIndex != null) {
      dedupeAddedSpriteConfigsForTile(tileIndex);
      pruneDuplicateSpritesOnTile(tileIndex);
    }
    const tileEl = tileIndex == null ? null : getTileElement(tileIndex);
    const sprites = tileIndex == null ? [] : getEditableTileSprites(tileIndex, tileEl);
    if (tileEl && sprites.length) applyTileSpriteLayerOrder(tileIndex, sprites);
    refreshTilePreview(tilePreview, tileEl, sprites, configuredLayer, floorBelowDomSprites);
    if (tileIndex == null) {
      const empty = document.createElement('div');
      empty.className = 'me-muted me-sprite-empty';
      empty.textContent = t('mods.mapEditor.selectTile', 'Select a battlefield tile to edit sprites.');
      spriteList.appendChild(empty);
      return;
    }

    const actor = editorEdits.mapCleaned ? null : getActorOnTile(tileIndex);
    if (actor) {
      const actorId = resolveCreatureGameId(actor);
      const actorName = getActorDisplayName(actor, actorId);
      const level = actor.level != null ? ` · Lv.${actor.level}` : '';
      const canRemoveActor = editorState.sandboxTestActive
        && (editorPlacedVillains.has(tileIndex) || actorId != null);

      const actorRow = document.createElement('div');
      actorRow.className = 'me-sprite-row me-actor-row';

      const portrait = document.createElement('img');
      portrait.className = 'me-creature-portrait me-actor-portrait';
      portrait.alt = actorName;
      const actorPortraitUrl = getActorPortraitUrl(actor, actorId, !!actor.shiny);
      if (actorPortraitUrl) portrait.src = actorPortraitUrl;
      actorRow.appendChild(portrait);

      const meta = document.createElement('span');
      meta.className = 'me-sprite-meta';
      const nameSpan = document.createElement('span');
      nameSpan.className = 'me-sprite-id';
      nameSpan.textContent = `${actorName}${level}`;
      const tagSpan = document.createElement('span');
      tagSpan.className = 'me-sprite-added-tag';
      tagSpan.textContent = editorPlacedVillains.has(tileIndex)
        ? t('mods.mapEditor.placedCreatureTag', 'placed creature')
        : t('mods.mapEditor.mapActorTag', 'map actor');
      meta.append(nameSpan, tagSpan);
      if (editorAlliedTiles.has(tileIndex)) {
        const allyTag = document.createElement('span');
        allyTag.className = 'me-sprite-added-tag me-ally-tag';
        allyTag.textContent = t('mods.mapEditor.allyCreatureTag', 'ally');
        meta.appendChild(allyTag);
      }
      actorRow.appendChild(meta);

      const isEditingCreature = editorState.editingCreatureTileIndex === tileIndex;
      const actions = document.createElement('div');
      actions.className = 'me-sprite-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'me-btn me-btn-compact';
      editBtn.textContent = isEditingCreature
        ? t('mods.mapEditor.editing', 'Editing')
        : t('mods.mapEditor.edit', 'Edit');
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isEditingCreature) cancelCreatureEdit();
        else startCreatureEdit(tileIndex);
      });
      actions.appendChild(editBtn);

      if (canRemoveActor) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'me-btn me-btn-compact me-btn-danger';
        removeBtn.textContent = t('mods.mapEditor.removeCreature', 'Remove creature');
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const ok = clearActorOnTile(tileIndex);
          setStatusMessage(
            ok
              ? t('mods.mapEditor.removeCreatureOk', 'Creature removed from tile {tile}.')
                  .replace('{tile}', String(tileIndex))
              : t('mods.mapEditor.removeCreatureFail', 'Could not remove creature.'),
            !ok
          );
          refreshInspector();
        });
        actions.appendChild(removeBtn);
      }

      actorRow.appendChild(actions);
      spriteList.appendChild(actorRow);

      if (isEditingCreature) {
        spriteList.appendChild(createCreatureEditorPanel(tileIndex, actor));
      }
    }

    const appendSpriteRow = (sprite, index, configEntry, options = {}) => {
      const {
        configOnly = false,
        hidden = false,
        isAdded: isAddedOption,
        floorBelow = false,
        fbIndex = null
      } = options;
      const ids = sprite ? getSpriteIdsFromElement(sprite) : [];
      const isAdded = isAddedOption ?? (sprite ? isEditorAddedSprite(sprite) : false);
      const isFloorBelowAdded = floorBelow && fbIndex != null && isAdded;
      const isEditingFloorBelow = isFloorBelowAdded
        && editorState.editingSprite?.floorBelow === true
        && editorState.editingSprite?.tileIndex === tileIndex
        && editorState.editingSprite?.fbIndex === fbIndex;
      const row = document.createElement('div');
      row.className = 'me-sprite-row';
      if (hidden) row.classList.add('me-sprite-row-hidden');
      if (isAdded) row.classList.add('me-sprite-row-added');
      if (configOnly) row.classList.add('me-sprite-row-config-only');
      if (floorBelow) row.classList.add('me-sprite-row-floor-below');

      row.appendChild(createSpritePreviewBox(sprite, configEntry));

      const meta = document.createElement('span');
      meta.className = 'me-sprite-meta';

      const layerSpan = document.createElement('span');
      layerSpan.className = 'me-sprite-layer';
      if (floorBelow) {
        const fbDepth = isFloorBelowAdded
          ? clampFloorDepth(getAddedFloorBelowConfigs(tileIndex)?.[fbIndex]?.floor ?? 1)
          : 1;
        layerSpan.textContent = `↓${fbDepth}`;
        layerSpan.title = t('mods.mapEditor.floorLevelBelow', 'Floor -{n}').replace('{n}', String(fbDepth));
      } else {
        layerSpan.textContent = `#${index + 1}`;
      }

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
      if (floorBelow && (!isAdded || isFloorBelowAdded)) {
        const floorBelowSpan = document.createElement('span');
        floorBelowSpan.className = 'me-sprite-floor-below-tag';
        const fbTagDepth = isFloorBelowAdded
          ? clampFloorDepth(getAddedFloorBelowConfigs(tileIndex)?.[fbIndex]?.floor ?? 1)
          : 1;
        floorBelowSpan.textContent = `${t('mods.mapEditor.floorBelowTag', 'floor below')} -${fbTagDepth}`;
        meta.appendChild(floorBelowSpan);
      }

      row.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'me-sprite-actions';

      if (!configOnly && sprite && liveId != null && isAdded) {
        const isEditing = isFloorBelowAdded
          ? isEditingFloorBelow
          : (editorState.editingSprite?.tileIndex === tileIndex
            && !editorState.editingSprite?.floorBelow
            && editorState.editingSprite?.layerIndex === index);

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
          } else if (isFloorBelowAdded) {
            startFloorBelowSpriteEdit(tileIndex, liveId, fbIndex);
          } else {
            startSpriteEdit(tileIndex, liveId, index);
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
            const ok = isFloorBelowAdded
              ? removeAddedFloorBelowSprite(tileIndex, fbIndex)
              : removeAddedSprite(sprite, tileIndex);
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

      if (!configOnly && sprite) {
        if (isFloorBelowAdded) {
          attachSpriteRowDragDrop(row, spriteList, tileIndex, fbIndex, {
            kind: 'floor-below',
            reorder: reorderFloorBelowSprite
          });
        } else if (isAdded && !floorBelow) {
          attachSpriteRowDragDrop(row, spriteList, tileIndex, index);
        } else if (!isAdded) {
          attachSpriteRowDropTarget(row, spriteList, tileIndex, index);
        }
      }

      const showMainEditDrawer = !configOnly && sprite && liveId != null && isAdded
        && !isFloorBelowAdded
        && editorState.editingSprite?.tileIndex === tileIndex
        && !editorState.editingSprite?.floorBelow
        && editorState.editingSprite?.layerIndex === index;

      if (showMainEditDrawer) {
        const editRow = document.createElement('div');
        editRow.className = 'me-sprite-edit';

        const editConfig = configEntry
          || resolveAddedSpriteAtLayer(tileIndex, index)?.config
          || compactSpriteConfig(extractSpriteConfig(sprite));

        const offsetRow = document.createElement('div');
        offsetRow.className = 'me-sprite-offset-row';

        let offsetX = editConfig?.offsetX ?? 0;
        let offsetY = editConfig?.offsetY ?? 0;

        offsetRow.append(
          createCombinedSpriteOffsetStepper(offsetX, offsetY, (nextX, nextY) => {
            offsetX = nextX;
            offsetY = nextY;
            applyAddedSpriteEdit(tileIndex, index, {
              id: liveId,
              offsetX,
              offsetY
            }, { keepEditing: true });
          })
        );

        // Floor picker — main-layer sprite sits at "Floor 0"; choosing −1..−9 moves it
        // straight onto that floor-below level.
        const floorSelect = createFloorLevelSelect(0, (depth) => {
          if (depth <= 0) return;
          const ok = moveAddedSpriteToFloorBelow(tileIndex, index, depth);
          setStatusMessage(
            ok
              ? t('mods.mapEditor.moveToFloorBelowOk', 'Moved sprite to the floor-below layer.')
              : t('mods.mapEditor.moveToFloorBelowFail', 'Could not move sprite.'),
            !ok
          );
          refreshInspector();
        });
        floorSelect.classList.add('me-sprite-move-layer-btn');
        offsetRow.append(floorSelect);

        editRow.append(offsetRow);
        row.appendChild(editRow);
      }

      if (isEditingFloorBelow) {
        const editRow = document.createElement('div');
        editRow.className = 'me-sprite-edit';

        const editConfig = getAddedFloorBelowConfigs(tileIndex)?.[fbIndex]
          || configEntry
          || compactSpriteConfig(extractSpriteConfig(sprite));

        const offsetRow = document.createElement('div');
        offsetRow.className = 'me-sprite-offset-row';

        let offsetX = editConfig?.offsetX ?? 0;
        let offsetY = editConfig?.offsetY ?? 0;

        offsetRow.append(
          createCombinedSpriteOffsetStepper(offsetX, offsetY, (nextX, nextY) => {
            offsetX = nextX;
            offsetY = nextY;
            applyAddedFloorBelowSpriteEdit(tileIndex, fbIndex, {
              id: liveId,
              offsetX,
              offsetY
            }, { keepEditing: true });
          })
        );

        const fbConfigs = getAddedFloorBelowConfigs(tileIndex) || [];
        if (fbConfigs.length > 1) {
          const orderGroup = document.createElement('div');
          orderGroup.className = 'me-sprite-offset-group';
          const orderLabel = document.createElement('span');
          orderLabel.className = 'me-sprite-offset-value';
          orderLabel.textContent = t('mods.mapEditor.floorBelowOrder', 'Order');
          const upBtn = document.createElement('button');
          upBtn.type = 'button';
          upBtn.className = 'me-btn me-btn-compact';
          upBtn.textContent = '▲';
          upBtn.title = t('mods.mapEditor.floorBelowOrderUp', 'Render one step higher (over the sprite above it)');
          upBtn.disabled = fbIndex >= fbConfigs.length - 1;
          upBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (reorderFloorBelowSprite(tileIndex, fbIndex, fbIndex + 1)) refreshInspector();
          });
          const downBtn = document.createElement('button');
          downBtn.type = 'button';
          downBtn.className = 'me-btn me-btn-compact';
          downBtn.textContent = '▼';
          downBtn.title = t('mods.mapEditor.floorBelowOrderDown', 'Render one step lower (under the sprite below it)');
          downBtn.disabled = fbIndex <= 0;
          downBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (reorderFloorBelowSprite(tileIndex, fbIndex, fbIndex - 1)) refreshInspector();
          });
          orderGroup.append(downBtn, orderLabel, upBtn);
          offsetRow.append(orderGroup);
        }

        // Floor picker — current level is the config's depth (default −1). "Floor 0"
        // moves it back to the main layer; any other value re-levels it.
        const currentDepth = clampFloorDepth(editConfig?.floor ?? 1);
        const floorSelect = createFloorLevelSelect(currentDepth, (depth) => {
          let ok;
          if (depth <= 0) {
            ok = moveFloorBelowSpriteToMain(tileIndex, fbIndex);
            setStatusMessage(
              ok
                ? t('mods.mapEditor.moveToMainFloorOk', 'Moved sprite to the main layer.')
                : t('mods.mapEditor.moveToMainFloorFail', 'Could not move sprite.'),
              !ok
            );
          } else {
            ok = setFloorBelowSpriteDepth(tileIndex, fbIndex, depth);
            setStatusMessage(
              ok
                ? t('mods.mapEditor.floorLevelChanged', 'Sprite moved to floor -{n}.').replace('{n}', String(depth))
                : t('mods.mapEditor.moveToMainFloorFail', 'Could not move sprite.'),
              !ok
            );
          }
          refreshInspector();
        });
        floorSelect.classList.add('me-sprite-move-layer-btn');
        offsetRow.append(floorSelect);

        editRow.append(offsetRow);
        row.appendChild(editRow);
      }

      spriteList.appendChild(row);
    };

    const spriteRowEntries = sprites.map((sprite, index) => ({
      sprite,
      index,
      configEntry: configuredLayer?.[index] || null,
      hidden: isSpriteHidden(sprite),
      isAdded: isSpriteAddedOnTile(tileIndex, sprite, sprites)
    }));

    for (let i = spriteRowEntries.length - 1; i >= 0; i -= 1) {
      const entry = spriteRowEntries[i];
      appendSpriteRow(entry.sprite, entry.index, entry.configEntry, {
        hidden: entry.hidden,
        isAdded: entry.isAdded
      });
    }

    if (configuredLayer?.length > sprites.length && !editorEdits.mapCleaned) {
      for (let index = configuredLayer.length - 1; index >= sprites.length; index -= 1) {
        const configEntry = configuredLayer[index];
        if (!configEntry?.id) continue;
        appendSpriteRow(null, index, configEntry, { configOnly: true });
      }
    }

    if (floorBelowDomSprites.length || floorBelowLayer.length) {
      const separator = document.createElement('div');
      separator.className = 'me-sprite-list-separator';
      separator.textContent = t('mods.mapEditor.floorBelowSeparator', 'Floor below');
      spriteList.appendChild(separator);

      const usedFloorBelowConfig = new Set();
      // fbIndex MUST be the sprite's position in the addedFloorBelowConfigs array (that's
      // what Edit / Remove / reorder / the "Floor -N" label all key off). getEditor…()
      // returns the nodes in that array order; floorBelowDomSprites is z-sorted, so an
      // enumeration counter would mis-pair them once floors differ — look each one up.
      const editorFloorBelowNodes = getEditorFloorBelowNodesForTile(tileIndex);
      const floorBelowRowEntries = floorBelowDomSprites.map((sprite, index) => {
        const editorOwned = isEditorFloorBelowSpriteForTile(sprite, tileIndex);
        const fbIndex = editorOwned ? editorFloorBelowNodes.indexOf(sprite) : null;
        const configEntry = editorOwned
          ? (fbIndex >= 0 ? getAddedFloorBelowConfigs(tileIndex)?.[fbIndex] || null : null)
          : resolveFloorBelowConfigForSprite(sprite, floorBelowLayer, usedFloorBelowConfig);
        const sortZ = editorOwned && fbIndex >= 0
          ? editorFloorBelowZIndex(tileIndex, fbIndex, configEntry?.floor ?? 1)
          : (Number(sprite.style.zIndex) || 0);
        return { sprite, index, fbIndex, configEntry, hidden: isSpriteHidden(sprite), sortZ };
      });

      // Top of the list = renders on top: shallow floors above deep ones, and within a
      // floor the later ("▲ one step higher") sprites first.
      floorBelowRowEntries.sort((a, b) => b.sortZ - a.sortZ);

      for (const entry of floorBelowRowEntries) {
        appendSpriteRow(entry.sprite, entry.fbIndex ?? entry.index, entry.configEntry, {
          floorBelow: true,
          fbIndex: entry.fbIndex,
          hidden: entry.hidden
        });
      }

      if (!editorEdits.mapCleaned && !floorBelowDomSprites.length) {
        for (let index = floorBelowLayer.length - 1; index >= 0; index -= 1) {
          const configEntry = floorBelowLayer[index];
          if (!configEntry?.id) continue;
          appendSpriteRow(null, index, configEntry, { configOnly: true, floorBelow: true });
        }
      }
    }

    if (!sprites.length && !configuredLayer?.length && !actor
      && !floorBelowDomSprites.length && !floorBelowLayer.length) {
      const empty = document.createElement('div');
      empty.className = 'me-muted me-sprite-empty';
      empty.textContent = t('mods.mapEditor.noSprites', 'No sprites on this tile.');
      spriteList.appendChild(empty);
    }
  }
}

function refreshInspector() {
  if (!editorState.inspectorRoot) return;

  refreshEditTab();

  const hitboxToggle = queryInspector('#map-editor-hitbox-toggle');
  if (hitboxToggle) hitboxToggle.checked = editorState.hitboxOverlay;
  const placementToggle = queryInspector('#map-editor-placement-toggle');
  if (placementToggle) placementToggle.checked = editorState.placementOverlay;

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

  const mapPanel = document.createElement('div');
  mapPanel.className = 'me-tab-panel me-map-panel';
  mapPanel.dataset.tabPanel = 'map';

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

  const contextActions = document.createElement('div');
  contextActions.className = 'me-context-actions';

  const tileResetBtn = createPanelButton(
    t('mods.mapEditor.tileReset', 'Reset tile'),
    () => {
      const tileIndex = editorState.selectedTileIndex;
      if (tileIndex == null) return;
      const ok = resetTileEdits(tileIndex);
      setMapEditorFeedback(
        ok
          ? t('mods.mapEditor.tileResetOk', 'Tile {tile} reset to map default.')
              .replace('{tile}', String(tileIndex))
          : t('mods.mapEditor.tileResetFail', 'Nothing to reset on this tile.'),
        {
          isError: !ok,
          variant: ok ? 'success' : 'warning',
          toastMessage: ok
            ? t('mods.mapEditor.toastTileResetOk', 'Tile reset.')
            : t('mods.mapEditor.toastTileResetFail', 'Nothing to reset.')
        }
      );
    },
    'me-btn me-btn-compact me-btn-muted'
  );
  tileResetBtn.id = 'map-editor-tile-reset-btn';
  tileResetBtn.title = t(
    'mods.mapEditor.tileResetTooltip',
    'Restore hitbox, sprites, and creatures on this tile to map defaults'
  );
  tileResetBtn.hidden = true;
  contextActions.appendChild(tileResetBtn);
  contextLines.appendChild(contextActions);

  contextCard.appendChild(contextLines);
  mapPanel.appendChild(contextCard);

  const spriteList = document.createElement('div');
  spriteList.id = 'map-editor-sprite-list';
  spriteList.className = 'me-sprite-list';
  mapPanel.appendChild(spriteList);

  const hitboxEditSection = document.createElement('div');
  hitboxEditSection.id = 'map-editor-hitbox-edit-section';
  hitboxEditSection.className = 'me-section';

  const hitboxEditTitle = document.createElement('div');
  hitboxEditTitle.className = 'me-section-title';
  hitboxEditTitle.textContent = t('mods.mapEditor.hitboxTitle', 'Tile hitbox');
  hitboxEditSection.appendChild(hitboxEditTitle);

  const hitboxEditRow = document.createElement('div');
  hitboxEditRow.id = 'map-editor-hitbox-edit-row';
  hitboxEditRow.className = 'me-row';

  const hitboxBlockedBtn = createPanelButton(
    t('mods.mapEditor.hitboxBlocked', 'Blocked'),
    () => {
      if (editorState.selectedTileIndex == null) return;
      setHitboxValue(editorState.selectedTileIndex, true);
      setStatusMessage(t('mods.mapEditor.hitboxSetBlocked', 'Tile marked blocked.'));
    },
    'me-btn me-btn-compact'
  );
  hitboxBlockedBtn.id = 'map-editor-hitbox-blocked-btn';

  const hitboxWalkableBtn = createPanelButton(
    t('mods.mapEditor.hitboxWalkable', 'Walkable'),
    () => {
      if (editorState.selectedTileIndex == null) return;
      setHitboxValue(editorState.selectedTileIndex, false);
      setStatusMessage(t('mods.mapEditor.hitboxSetWalkable', 'Tile marked walkable.'));
    },
    'me-btn me-btn-compact'
  );
  hitboxWalkableBtn.id = 'map-editor-hitbox-walkable-btn';

  hitboxEditRow.append(hitboxBlockedBtn, hitboxWalkableBtn);
  hitboxEditSection.appendChild(hitboxEditRow);

  const hitboxEditHint = document.createElement('div');
  hitboxEditHint.id = 'map-editor-hitbox-edit-hint';
  hitboxEditHint.className = 'me-section-hint';
  hitboxEditSection.appendChild(hitboxEditHint);
  mapPanel.appendChild(hitboxEditSection);

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
  mapPanel.appendChild(overlayRow);

  const battleRulesSeparator = document.createElement('div');
  battleRulesSeparator.className = 'me-panel-separator';
  battleRulesSeparator.textContent = t('mods.mapEditor.battleRulesTitle', 'Battle rules');
  mapPanel.appendChild(battleRulesSeparator);

  const battleRulesSection = document.createElement('div');
  battleRulesSection.id = 'map-editor-battle-rules-section';
  battleRulesSection.className = 'me-section me-map-battle-rules-section';

  const battleRulesRow = document.createElement('div');
  battleRulesRow.className = 'me-row me-map-battle-rules-row';

  const allyLimitInput = document.createElement('input');
  allyLimitInput.type = 'number';
  allyLimitInput.id = 'map-editor-ally-limit';
  allyLimitInput.className = 'me-input me-creature-input-compact';
  allyLimitInput.min = '1';
  allyLimitInput.max = '20';
  allyLimitInput.placeholder = t('mods.mapEditor.allyLimit', 'Ally limit');
  allyLimitInput.addEventListener('input', (e) => {
    e.stopPropagation();
    const parsed = Number(allyLimitInput.value);
    editorBattleRules.allyLimit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    syncMapEditorTestBattleConfigFromRules();
    updateWorkshopBattleRulesControls();
  });
  battleRulesRow.appendChild(allyLimitInput);
  battleRulesSection.appendChild(battleRulesRow);

  const placementRow = document.createElement('div');
  placementRow.className = 'me-row me-map-battle-rules-row';

  const placementAllowBtn = createPanelButton(
    t('mods.mapEditor.placementAllow', 'Allow spawn'),
    () => {
      if (editorState.selectedTileIndex == null) return;
      setTileAllowedPlacement(editorState.selectedTileIndex, true);
      setStatusMessage(
        t('mods.mapEditor.placementTileAllowed', 'Tile {tile} allowed for ally placement.')
          .replace('{tile}', String(editorState.selectedTileIndex))
      );
    },
    'me-btn me-btn-compact'
  );
  placementAllowBtn.id = 'map-editor-placement-allow-btn';

  const placementClearBtn = createPanelButton(
    t('mods.mapEditor.placementClear', 'Clear spawn'),
    () => {
      if (editorState.selectedTileIndex == null) return;
      setTileAllowedPlacement(editorState.selectedTileIndex, false);
      setStatusMessage(
        t('mods.mapEditor.placementTileCleared', 'Tile {tile} removed from ally placement.')
          .replace('{tile}', String(editorState.selectedTileIndex))
      );
    },
    'me-btn me-btn-compact'
  );
  placementClearBtn.id = 'map-editor-placement-clear-btn';

  const placementClearAllBtn = createPanelButton(
    t('mods.mapEditor.placementClearAll', 'Clear all spawns'),
    () => {
      setAllowedPlacementTiles([]);
      setStatusMessage(t('mods.mapEditor.placementClearedAll', 'Ally placement tiles cleared (no restriction).'));
    },
    'me-btn me-btn-compact me-btn-muted'
  );
  placementClearAllBtn.id = 'map-editor-placement-clear-all-btn';

  placementRow.append(placementAllowBtn, placementClearBtn, placementClearAllBtn);
  battleRulesSection.appendChild(placementRow);

  const placementOverlayRow = document.createElement('label');
  placementOverlayRow.className = 'me-check-row';
  const placementOverlayCheckbox = document.createElement('input');
  placementOverlayCheckbox.type = 'checkbox';
  placementOverlayCheckbox.id = 'map-editor-placement-toggle';
  placementOverlayCheckbox.checked = editorState.placementOverlay;
  placementOverlayCheckbox.addEventListener('change', (e) => {
    e.stopPropagation();
    editorState.placementOverlay = placementOverlayCheckbox.checked;
    logMapEditor('placementOverlayToggle', { enabled: placementOverlayCheckbox.checked });
    if (placementOverlayCheckbox.checked) {
      updatePlacementOverlay();
    } else {
      removePlacementOverlay();
      setStatusMessage(t('mods.mapEditor.placementOverlayHidden', 'Ally placement overlay hidden.'));
    }
  });
  placementOverlayRow.append(
    placementOverlayCheckbox,
    document.createTextNode(
      t(
        'mods.mapEditor.placementOverlay',
        'Show ally spawn overlay (blue = allowed). Click tiles to toggle.'
      )
    )
  );
  battleRulesSection.appendChild(placementOverlayRow);

  const battleRulesHint = document.createElement('div');
  battleRulesHint.id = 'map-editor-battle-rules-hint';
  battleRulesHint.className = 'me-section-hint me-map-battle-rules-hint';
  battleRulesSection.appendChild(battleRulesHint);
  mapPanel.appendChild(battleRulesSection);

  const mapSection = document.createElement('div');
  mapSection.className = 'me-section';

  const mapTitle = document.createElement('div');
  mapTitle.className = 'me-section-title';
  mapTitle.textContent = t('mods.mapEditor.mapTitle', 'Map');
  mapSection.appendChild(mapTitle);

  const restoreMapRow = document.createElement('div');
  restoreMapRow.className = 'me-row';

  const restoreMapBtn = createPanelButton(
    t('mods.mapEditor.restoreMap', 'Restore map'),
    () => restoreMapFromGame(),
    'me-btn me-btn-wide'
  );
  restoreMapBtn.id = 'map-editor-restore-map-btn';
  restoreMapBtn.title = t('mods.mapEditor.restoreMapTooltip', 'Reload the current map from game data (discards live edits)');
  restoreMapRow.appendChild(restoreMapBtn);
  mapSection.appendChild(restoreMapRow);

  const restoreMapHint = document.createElement('div');
  restoreMapHint.className = 'me-muted me-section-hint';
  restoreMapHint.textContent = t(
    'mods.mapEditor.restoreMapHint',
    'Undoes your edits and reloads the map from game data. Closing the Map Editor also restores the original map.'
  );
  mapSection.appendChild(restoreMapHint);

  const cleanMapRow = document.createElement('div');
  cleanMapRow.className = 'me-row';

  const cleanMapBtn = createPanelButton(
    t('mods.mapEditor.cleanMap', 'Clean map'),
    () => cleanMapFromEditor(),
    'me-btn me-btn-wide me-btn-muted'
  );
  cleanMapBtn.id = 'map-editor-clean-map-btn';
  cleanMapBtn.title = t(
    'mods.mapEditor.cleanMapTooltip',
    'Hide all tile sprites, remove all creatures, and set every hitbox to walkable'
  );
  cleanMapRow.appendChild(cleanMapBtn);
  mapSection.appendChild(cleanMapRow);

  const cleanMapHint = document.createElement('div');
  cleanMapHint.className = 'me-muted me-section-hint';
  cleanMapHint.textContent = t(
    'mods.mapEditor.cleanMapHint',
    'Hides every sprite on the map, removes all creatures from the battlefield, and makes all tiles walkable. Use Restore map to undo everything.'
  );
  mapSection.appendChild(cleanMapHint);

  const hideNativeRow = document.createElement('div');
  hideNativeRow.className = 'me-row';
  const hideNativeBtn = createPanelButton(
    t('mods.mapEditor.hideNativeSprites', 'Hide map sprites'),
    () => toggleHideNativeMapSprites(),
    'me-btn me-btn-wide me-btn-muted'
  );
  hideNativeBtn.id = 'map-editor-hide-native-btn';
  hideNativeBtn.title = t(
    'mods.mapEditor.hideNativeSpritesTooltip',
    'Hide every original map sprite (tile layer and floor below) while keeping your custom sprites, hitboxes and creatures. Toggle to restore.'
  );
  hideNativeRow.appendChild(hideNativeBtn);
  mapSection.appendChild(hideNativeRow);

  const hideNativeHint = document.createElement('div');
  hideNativeHint.className = 'me-muted me-section-hint';
  hideNativeHint.textContent = t(
    'mods.mapEditor.hideNativeSpritesHint',
    'Visual only — leaves custom sprites, hitboxes and creatures alone. Handy for building a scene on a blank map. Toggle again (or Restore map) to bring the sprites back.'
  );
  mapSection.appendChild(hideNativeHint);
  mapPanel.appendChild(mapSection);

  const assetsPanel = document.createElement('div');
  assetsPanel.className = 'me-tab-panel';
  assetsPanel.dataset.tabPanel = 'assets';
  assetsPanel.hidden = true;

  const assetsHeader = document.createElement('div');
  assetsHeader.className = 'me-assets-header';

  const assetContextCard = document.createElement('div');
  assetContextCard.className = 'me-context-card';

  const assetContextLines = document.createElement('div');
  assetContextLines.className = 'me-context-lines';

  const assetSummary = document.createElement('div');
  assetSummary.id = 'map-editor-asset-summary';
  assetSummary.className = 'me-context-primary';
  assetContextLines.appendChild(assetSummary);

  const assetHint = document.createElement('div');
  assetHint.className = 'me-context-secondary';
  assetHint.textContent = t(
    'mods.mapEditor.assetHint',
    'Expand to filter by region or map. Click a sprite to add it to the selected tile.'
  );
  assetContextLines.appendChild(assetHint);

  assetContextCard.appendChild(assetContextLines);
  assetsHeader.appendChild(assetContextCard);

  const assetFilterSection = document.createElement('div');
  assetFilterSection.className = 'me-section me-asset-filter-section';

  const assetFilterFrame = document.createElement('div');
  assetFilterFrame.className = 'me-framed-block me-asset-filter-frame';

  const assetFilterToggle = document.createElement('button');
  assetFilterToggle.type = 'button';
  assetFilterToggle.className = 'me-section-title me-asset-filter-toggle';
  assetFilterToggle.setAttribute('aria-expanded', 'false');
  assetFilterToggle.setAttribute('aria-controls', 'map-editor-asset-map-filters');
  assetFilterToggle.textContent = t('mods.mapEditor.assetFilterTitle', 'Maps by region');
  assetFilterFrame.appendChild(assetFilterToggle);

  const assetMapFilters = document.createElement('div');
  assetMapFilters.id = 'map-editor-asset-map-filters';
  assetMapFilters.className = 'me-asset-region-filters';
  assetMapFilters.hidden = true;
  assetFilterToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCollapsible(assetMapFilters, assetFilterToggle, { expandedClass: 'is-expanded' });
  });
  assetFilterFrame.appendChild(assetMapFilters);
  assetFilterSection.appendChild(assetFilterFrame);
  assetsHeader.appendChild(assetFilterSection);
  assetsPanel.appendChild(assetsHeader);

  const assetGridBody = document.createElement('div');
  assetGridBody.className = 'me-asset-grid-body';

  const assetGrid = document.createElement('div');
  assetGrid.id = 'map-editor-asset-grid';
  assetGrid.className = 'me-asset-grid';
  assetGridBody.appendChild(assetGrid);

  assetsPanel.appendChild(assetGridBody);

  const creaturesPanel = document.createElement('div');
  creaturesPanel.className = 'me-tab-panel';
  creaturesPanel.dataset.tabPanel = 'creatures';
  creaturesPanel.hidden = true;

  const creaturesHeader = document.createElement('div');
  creaturesHeader.className = 'me-assets-header';

  const creatureContextCard = document.createElement('div');
  creatureContextCard.className = 'me-context-card';

  const creatureContextLines = document.createElement('div');
  creatureContextLines.className = 'me-context-lines';

  const creatureSummary = document.createElement('div');
  creatureSummary.id = 'map-editor-creature-summary';
  creatureSummary.className = 'me-context-primary';
  creatureContextLines.appendChild(creatureSummary);

  const creatureHint = document.createElement('div');
  creatureHint.className = 'me-context-secondary';
  creatureHint.textContent = t(
    'mods.mapEditor.creatureHint',
    'Map filter (Asset list tab) applies here. Click a creature to place it as a villain on the selected tile.'
  );
  creatureContextLines.appendChild(creatureHint);

  creatureContextCard.appendChild(creatureContextLines);
  creaturesHeader.appendChild(creatureContextCard);

  const creatureToolsRow = document.createElement('div');
  creatureToolsRow.className = 'me-row me-row-full';

  const creatureSearchInput = document.createElement('input');
  creatureSearchInput.type = 'search';
  creatureSearchInput.id = 'map-editor-creature-search';
  creatureSearchInput.className = 'me-input me-input-wide';
  creatureSearchInput.placeholder = t('mods.mapEditor.creatureSearch', 'Search by name or ID…');
  creatureSearchInput.value = editorState.creatureSearchQuery || '';
  creatureSearchInput.addEventListener('input', (e) => {
    e.stopPropagation();
    editorState.creatureSearchQuery = creatureSearchInput.value;
    scheduleCreatureListRefresh();
  });
  creatureToolsRow.appendChild(creatureSearchInput);
  creaturesHeader.appendChild(creatureToolsRow);
  creaturesPanel.appendChild(creaturesHeader);

  const creatureGridBody = document.createElement('div');
  creatureGridBody.className = 'me-creature-grid-body';

  const creatureGrid = document.createElement('div');
  creatureGrid.id = 'map-editor-creature-grid';
  creatureGrid.className = 'me-asset-grid';
  creatureGridBody.appendChild(creatureGrid);

  creaturesPanel.appendChild(creatureGridBody);

  const exportSection = document.createElement('div');
  exportSection.className = 'me-section';

  const exportTitle = document.createElement('div');
  exportTitle.className = 'me-section-title';
  exportTitle.textContent = t('mods.mapEditor.fileManagementTitle', 'File Management');
  exportSection.appendChild(exportTitle);

  const exportMapRow = document.createElement('div');
  exportMapRow.className = 'me-row';
  const exportMapBtn = createPanelButton(
    t('mods.mapEditor.exportMapJson', 'Export Map (JSON)'),
    async () => {
      const bundle = buildFullMapExport();
      if (!bundle) {
        setStatusMessage(t('mods.mapEditor.noRoom', 'No room loaded — open a map first.'), true);
        return;
      }
      const json = JSON.stringify(bundle, null, 2);
      const filename = `${bundle.roomId || 'map'}-${Date.now()}.json`;
      const downloaded = downloadJsonFile(filename, bundle);
      const copied = await copyTextToClipboard(json);
      setStatusMessage(
        downloaded || copied
          ? t(
            'mods.mapEditor.exportMapJsonOk',
            'Map exported — downloaded{copiedSuffix}. Others can Import it, or merge questExport into assets/quests/*.json.'
          ).replace('{copiedSuffix}', copied ? t('mods.mapEditor.exportMapJsonCopiedSuffix', ' and copied to clipboard') : '')
          : t('mods.mapEditor.exportMapJsonFail', 'Could not export map JSON.'),
        !downloaded && !copied
      );
      logMapEditor('exportMapJson', { downloaded, copied, roomId: bundle.roomId, hasQuestExport: !!bundle.questExport });
    },
    'me-btn me-btn-wide'
  );
  exportMapRow.appendChild(exportMapBtn);
  exportSection.appendChild(exportMapRow);

  const exportMapHint = document.createElement('div');
  exportMapHint.className = 'me-section-hint';
  exportMapHint.textContent = t(
    'mods.mapEditor.exportMapHint',
    'Downloads a full map JSON file and copies it to your clipboard. Others Import it below to load the exact same map; '
    + 'or, to ship it as real quest content, merge its questExport.rooms/questExport.battles into assets/quests/*.json '
    + '(see questExport._howto and questExport.customBattle._wireInQuests).'
  );
  exportSection.appendChild(exportMapHint);

  const importMapPanel = document.createElement('div');
  importMapPanel.className = 'me-import-map-panel';
  importMapPanel.style.display = 'none';

  const importMapTextarea = document.createElement('textarea');
  importMapTextarea.className = 'me-input me-input-wide me-textarea';
  importMapTextarea.placeholder = t('mods.mapEditor.importMapPlaceholder', 'Paste map JSON here…');
  importMapPanel.appendChild(importMapTextarea);

  const importMapActionsRow = document.createElement('div');
  importMapActionsRow.className = 'me-row';

  const importMapConfirmBtn = createPanelButton(
    t('mods.mapEditor.importMapConfirm', 'Import'),
    async () => {
      const text = importMapTextarea.value.trim();
      if (!text) {
        setStatusMessage(t('mods.mapEditor.importMapJsonInvalid', 'Could not read that — not valid JSON.'), true);
        return;
      }
      let bundle;
      try {
        bundle = JSON.parse(text);
      } catch (e) {
        setStatusMessage(t('mods.mapEditor.importMapJsonInvalid', 'Could not read that — not valid JSON.'), true);
        return;
      }
      const payload = resolveMapImportPayload(bundle);
      if (!payload) {
        setStatusMessage(
          t(
            'mods.mapEditor.importMapJsonWrongFormat',
            'That isn’t a map export Map Editor can import — paste the JSON from someone else’s "Export Map (JSON)".'
          ),
          true
        );
        return;
      }
      logMapEditor('importMapJson', { format: bundle.format, roomId: payload.roomId });
      importMapPanel.style.display = 'none';
      importMapTextarea.value = '';
      await loadDomSession(payload);
    },
    'me-btn'
  );

  const importMapCancelBtn = createPanelButton(
    t('mods.mapEditor.importMapCancel', 'Cancel'),
    () => {
      importMapPanel.style.display = 'none';
      importMapTextarea.value = '';
    },
    'me-btn me-btn-muted'
  );

  importMapActionsRow.append(importMapConfirmBtn, importMapCancelBtn);
  importMapPanel.appendChild(importMapActionsRow);

  const importMapRow = document.createElement('div');
  importMapRow.className = 'me-row';
  const importMapToggleBtn = createPanelButton(
    t('mods.mapEditor.importMapJson', 'Import Map (JSON)'),
    () => {
      const opening = importMapPanel.style.display === 'none';
      importMapPanel.style.display = opening ? 'flex' : 'none';
      if (opening) requestAnimationFrame(() => importMapTextarea.focus());
    },
    'me-btn me-btn-wide'
  );
  importMapRow.appendChild(importMapToggleBtn);
  exportSection.appendChild(importMapRow);

  const importMapHint = document.createElement('div');
  importMapHint.className = 'me-section-hint';
  importMapHint.textContent = t(
    'mods.mapEditor.importMapHint',
    'Paste a map JSON someone shared with you (from their "Export Map (JSON)" above) to load their exact map.'
  );
  exportSection.appendChild(importMapHint);
  exportSection.appendChild(importMapPanel);

  mapPanel.appendChild(exportSection);

  const workshopPanel = document.createElement('div');
  workshopPanel.className = 'me-tab-panel me-workshop-panel';
  workshopPanel.dataset.tabPanel = 'workshop';
  workshopPanel.hidden = true;

  const workshopBody = document.createElement('div');
  workshopBody.className = 'me-workshop-body';

  const localSection = document.createElement('div');
  localSection.className = 'me-section';

  const localTitle = document.createElement('div');
  localTitle.className = 'me-section-title';
  localTitle.textContent = t('mods.mapEditor.workshopMySaves', 'My saves');
  localSection.appendChild(localTitle);

  const localHint = document.createElement('div');
  localHint.className = 'me-section-hint';
  localHint.textContent = t(
    'mods.mapEditor.workshopMySavesHint',
    'Click a save to select it, then Load or Save. Double-click a save to load it.'
  );
  localSection.appendChild(localHint);

  const nameRow = document.createElement('div');
  nameRow.id = 'map-editor-save-name-row';
  nameRow.className = 'me-row';
  nameRow.style.display = 'none';

  const saveNameInput = document.createElement('input');
  saveNameInput.type = 'text';
  saveNameInput.id = 'map-editor-save-name';
  saveNameInput.className = 'me-input me-input-wide';
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
  localSection.appendChild(nameRow);

  const sessionRow = document.createElement('div');
  sessionRow.id = 'map-editor-session-row';
  sessionRow.className = 'me-row me-session-row';
  sessionRow.style.display = 'none';

  const saveBtn = createPanelButton(
    t('mods.mapEditor.save', 'Save'),
    () => saveMapSession(),
    'me-btn'
  );
  saveBtn.id = 'map-editor-save-btn';
  saveBtn.title = t('mods.mapEditor.saveTooltip', 'Save edits for this map');

  const loadBtn = createPanelButton(
    t('mods.mapEditor.load', 'Load'),
    () => loadSelectedLocalSave(),
    'me-btn'
  );
  loadBtn.id = 'map-editor-load-btn';
  loadBtn.style.display = 'none';

  const clearSaveBtn = document.createElement('button');
  clearSaveBtn.type = 'button';
  clearSaveBtn.className = 'me-btn me-btn-muted';
  clearSaveBtn.id = 'map-editor-clear-save-btn';
  clearSaveBtn.style.display = 'none';
  attachInlineConfirm(clearSaveBtn, {
    baseText: t('mods.mapEditor.clearSave', 'Clear save'),
    confirmText: () => (getSelectedLocalSaveEntry()
      ? t('mods.mapEditor.clearSaveConfirmInline', 'Confirm delete?')
      : t('mods.mapEditor.clearSaveConfirmAllInline', 'Confirm delete ALL?')),
    onConfirm: () => {
      const selectedEntry = getSelectedLocalSaveEntry();
      if (selectedEntry) {
        clearMapSession(selectedEntry.roomId, selectedEntry.save.id);
        setStatusMessage(
          tReplace(
            'mods.mapEditor.clearSaveNamedSuccess',
            { name: selectedEntry.save.name },
            'Deleted save "{name}".'
          )
        );
        return;
      }
      const room = getCurrentRoom();
      if (!room?.id) return;
      clearMapSession(room.id);
      setStatusMessage(t('mods.mapEditor.clearSaveSuccess', 'Cleared all saves for this map.'));
    }
  });

  sessionRow.append(saveBtn, loadBtn, clearSaveBtn);
  localSection.appendChild(sessionRow);

  const localList = document.createElement('div');
  localList.id = 'map-editor-workshop-local-list';
  localList.className = 'me-asset-grid me-workshop-grid me-workshop-local-grid';
  localList.hidden = true;
  localSection.appendChild(localList);

  const sessionHint = document.createElement('div');
  sessionHint.id = 'map-editor-session-hint';
  sessionHint.className = 'me-session-hint';
  localSection.appendChild(sessionHint);
  workshopBody.appendChild(localSection);

  const uploadSection = document.createElement('div');
  uploadSection.className = 'me-section';

  const uploadTitle = document.createElement('div');
  uploadTitle.className = 'me-section-title';
  uploadTitle.textContent = t('mods.mapEditor.workshopUploadTitle', 'Upload to workshop');
  uploadSection.appendChild(uploadTitle);

  const uploadHint = document.createElement('div');
  uploadHint.id = 'map-editor-workshop-upload-hint';
  uploadHint.className = 'me-section-hint';
  uploadSection.appendChild(uploadHint);

  const uploadTitleInput = document.createElement('input');
  uploadTitleInput.type = 'text';
  uploadTitleInput.id = 'map-editor-workshop-title';
  uploadTitleInput.className = 'me-input me-input-wide';
  uploadTitleInput.maxLength = WORKSHOP_TITLE_MAX_LENGTH;
  uploadTitleInput.placeholder = t('mods.mapEditor.workshopTitlePlaceholder', 'Map title…');
  uploadTitleInput.value = editorState.workshopUploadTitle || '';
  uploadTitleInput.addEventListener('input', (e) => {
    e.stopPropagation();
    editorState.workshopUploadTitle = uploadTitleInput.value;
  });
  uploadSection.appendChild(uploadTitleInput);

  const uploadDescriptionInput = document.createElement('textarea');
  uploadDescriptionInput.id = 'map-editor-workshop-description';
  uploadDescriptionInput.className = 'me-input me-workshop-description';
  uploadDescriptionInput.maxLength = WORKSHOP_DESCRIPTION_MAX_LENGTH;
  uploadDescriptionInput.rows = 2;
  uploadDescriptionInput.placeholder = t('mods.mapEditor.workshopDescriptionPlaceholder', 'Short description (optional)…');
  uploadDescriptionInput.value = editorState.workshopUploadDescription || '';
  uploadDescriptionInput.addEventListener('input', (e) => {
    e.stopPropagation();
    editorState.workshopUploadDescription = uploadDescriptionInput.value;
  });
  uploadSection.appendChild(uploadDescriptionInput);

  const uploadRow = document.createElement('div');
  uploadRow.className = 'me-row';
  const uploadBtn = createPanelButton(
    t('mods.mapEditor.workshopUpload', 'Upload map'),
    () => { void uploadMapToWorkshop(); },
    'me-btn me-btn-wide'
  );
  uploadBtn.id = 'map-editor-workshop-upload-btn';
  uploadRow.appendChild(uploadBtn);
  uploadSection.appendChild(uploadRow);

  const uploadRulesHint = document.createElement('div');
  uploadRulesHint.className = 'me-section-hint';
  uploadRulesHint.textContent = t(
    'mods.mapEditor.workshopUploadRulesHint',
    'Include at least one villain (map creatures or ones you placed in the editor). Max 3 workshop maps per player.'
  );
  uploadSection.appendChild(uploadRulesHint);
  workshopBody.appendChild(uploadSection);

  const catalogSection = document.createElement('div');
  catalogSection.className = 'me-section';

  const catalogHeader = document.createElement('div');
  catalogHeader.className = 'me-row me-workshop-catalog-header';

  const catalogTitle = document.createElement('div');
  catalogTitle.className = 'me-section-title';
  catalogTitle.textContent = t('mods.mapEditor.workshopCatalogTitle', 'Workshop maps');
  catalogHeader.appendChild(catalogTitle);

  const refreshBtn = createPanelButton(
    t('mods.mapEditor.workshopRefresh', 'Refresh'),
    () => { void fetchWorkshopCatalog(true); },
    'me-btn me-btn-compact'
  );
  catalogHeader.appendChild(refreshBtn);
  catalogSection.appendChild(catalogHeader);

  const catalogHint = document.createElement('div');
  catalogHint.className = 'me-section-hint';
  catalogHint.textContent = t(
    'mods.mapEditor.workshopCatalogHint',
    'Click a map to battle. Open its base map first if prompted.'
  );
  catalogSection.appendChild(catalogHint);

  const catalogGridBody = document.createElement('div');
  catalogGridBody.className = 'me-workshop-grid-body';

  const catalogList = document.createElement('div');
  catalogList.id = 'map-editor-workshop-catalog-list';
  catalogList.className = 'me-asset-grid me-workshop-grid';
  catalogGridBody.appendChild(catalogList);
  catalogSection.appendChild(catalogGridBody);
  workshopBody.appendChild(catalogSection);

  workshopPanel.appendChild(workshopBody);

  tabPanels.append(mapPanel, assetsPanel, creaturesPanel, workshopPanel);
  root.appendChild(tabPanels);

  const status = document.createElement('div');
  status.id = 'map-editor-status';
  status.className = 'me-status';
  root.appendChild(status);

  editorState.inspectorRoot = root;
  editorState.activeTab = PANEL_DEFAULTS.activeTab;
  switchInspectorTab(editorState.activeTab);
  refreshInspector();
  return root;
}

// =======================
// 11. Board listeners
// =======================

let battlefieldPickHandler = null;
let tileKeyboardNavHandler = null;

const TILE_KEYBOARD_NAV_DELTAS = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0]
};

function handleMapEditorTileKeyboardNav(event) {
  if (!editorState.open || editorState.selectedTileIndex == null) return;
  const delta = TILE_KEYBOARD_NAV_DELTAS[event.key];
  if (!delta) return;
  if (isMapEditorKeyboardInputTarget(event.target) || isMapEditorKeyboardInputTarget(document.activeElement)) {
    return;
  }

  const nextTileIndex = getTileIndexGridOffset(
    editorState.selectedTileIndex,
    delta[0],
    delta[1]
  );
  if (nextTileIndex == null) return;

  event.preventDefault();
  selectTile(nextTileIndex);
}

function attachMapEditorTileKeyboardNav() {
  if (tileKeyboardNavHandler) return;
  tileKeyboardNavHandler = handleMapEditorTileKeyboardNav;
  document.addEventListener('keydown', tileKeyboardNavHandler, true);
}

function detachMapEditorTileKeyboardNav() {
  if (!tileKeyboardNavHandler) return;
  document.removeEventListener('keydown', tileKeyboardNavHandler, true);
  tileKeyboardNavHandler = null;
}

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
        selectTile(tileIndex, { togglePlacement: true });
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
    selectTile(tileIndex, { togglePlacement: true });
  };
  document.addEventListener('pointerdown', battlefieldPickHandler, true);
  window.addEventListener('resize', scheduleTilePickRefresh);
}

function detachBattlefieldPickListener() {
  if (!battlefieldPickHandler) return;
  document.removeEventListener('pointerdown', battlefieldPickHandler, true);
  window.removeEventListener('resize', scheduleTilePickRefresh);
  battlefieldPickHandler = null;
}

function enableMapEditorBoardTools() {
  captureAllNativeSpritePlacements();
  document.body.classList.add('map-editor-board-active');
  enterMapEditorFloorLock();
  refreshTilePickOverlays();
  attachTilePickObserver();
  attachBattlefieldPickListener();
  attachMapEditorTileKeyboardNav();
  updateHitboxOverlay();
  updatePlacementOverlay();
}

function disableMapEditorBoardTools() {
  document.body.classList.remove('map-editor-board-active');
  if (!shouldKeepMapEditorFloorLocked()) exitMapEditorFloorLock();
  removeTilePickOverlays();
  applyBoardPiecePassThrough(false);
  detachBattlefieldPickListener();
  detachMapEditorTileKeyboardNav();
  detachTilePickObserver();
  removeHitboxOverlay();
  removePlacementOverlay();
}

function scheduleBoardToolsRefresh() {
  if (boardToolsRefreshTimer) clearTimeout(boardToolsRefreshTimer);
  boardToolsRefreshTimer = setTimeout(() => {
    boardToolsRefreshTimer = null;
    if (!editorState.open || scopeHandlingSuspended || editorState.sandboxTestActive) return;
    enableMapEditorBoardTools();
    if (editorState.selectedTileIndex != null) {
      markTileSelected(editorState.selectedTileIndex);
    }
  }, 150);
}

function handleBoardScopeChange() {
  if (scopeHandlingSuspended) return false;

  const roomKey = getBoardRoomKey();
  if (!roomKey) {
    if (editorState.sandboxTestActive && trackedBoardKey) return false;
    return false;
  }

  const previousKey = trackedBoardKey;
  if (previousKey === roomKey) return false;

  if (isWorkshopMapSessionActive() && roomKey !== mapEditorDomSessionRoomId) {
    returnToWorkshopMap(roomKey);
    return false;
  }

  const testRoomId = mapEditorTestNativeRoom?.id || mapEditorTestRoomSnapshot?.roomId;

  if (editorState.sandboxTestActive) {
    if (testRoomId && roomKey === testRoomId) {
      trackedBoardKey = roomKey;
      scheduleSandboxTestReapply(100);
      return false;
    }
    if (previousKey != null && previousKey !== roomKey) {
      stopMapEditorSandboxTest({
        reloadRoom: false,
        silent: true,
        skipSnapshotRestore: true,
        skipBoardRestore: true
      });
    }
  }

  editorState.selectedSaveId = null;
  editorState.selectedSaveRoomId = null;
  editorState.editingSprite = null;
  editorState.editingCreatureTileIndex = null;
  editorState.selectedTileIndex = null;
  clearTileSelection();
  removeTilePickOverlays();
  removeHitboxOverlay();

  if (editorState.open && previousKey != null) {
    logMapEditor('boardScopeChanged', { from: previousKey, to: roomKey });
    adoptEditorBoardScope(roomKey, previousKey);
    return true;
  }

  if (previousKey != null) {
    abandonEditorBoardScope();
    logMapEditor('boardScopeChanged', { from: previousKey, to: roomKey });
  }

  trackedBoardKey = roomKey;
  clearHitboxSnapshot();
  return previousKey != null;
}

function abandonEditorBoardScope() {
  // Actually revert injected/hidden/replaced sprites and hitboxes in the live DOM before
  // dropping tracking state — discardEphemeralEditorDomState()/resetEditorEditsTracking()
  // alone only clear the *tracking arrays*, leaving stray editor DOM edits from the old
  // room's tiles behind to mix with the newly loaded room's native sprites.
  purgeAllEditorDomEdits();
  clearMapEditorCaches();
  mapEditorTestRoomSnapshot = null;
  nativeSpritePlacementCache.clear();
  clearHitboxSnapshot();
  editorSessionChangeCount = 0;
  notifyMapEditorOpenChanged();
  logMapEditor('abandonEditorBoardScope');
}

function adoptEditorBoardScope(roomKey, previousKey) {
  scopeHandlingSuspended = true;
  if (previousKey && mapEditorTestRoomSnapshot?.roomId === previousKey) {
    applyEditorOpenSnapshotToLiveRefs(previousKey);
  }

  abandonEditorBoardScope();
  clearDomSessionInspectorState();
  trackedBoardKey = roomKey;

  scheduleReloadRoomTimer(() => {
    scopeHandlingSuspended = false;
    if (!editorState.open || getBoardRoomKey() !== roomKey) return;
    const room = getCurrentRoom();
    if (room?.id !== roomKey) return;
    snapshotRoomDataForTest(roomKey);
    captureBaseTilesSnapshot();
    captureAllNativeSpritePlacements();
    void ensureMapEditorEditSession({ skipInitialVillainSync: true });
    enableMapEditorBoardTools();
    refreshInspector();
    logMapEditor('boardScopeAdopted', { from: previousKey, to: roomKey });
  }, ROOM_RELOAD_SETTLE_MS);
}

function getBoardPlayMode() {
  try {
    return globalThis.state?.board?.getSnapshot?.()?.context?.mode || null;
  } catch (e) {
    return null;
  }
}

function setBoardPlayMode(mode) {
  if (!mode || !globalThis.state?.board?.send) return false;
  try {
    globalThis.state.board.send({ type: 'setPlayMode', mode });
    return true;
  } catch (e) {
    logMapEditor('setPlayModeFailed', { mode, error: String(e) });
    return false;
  }
}

function ensureMapEditorSandboxPlayMode() {
  if (getBoardPlayMode() === 'sandbox') return false;
  return setBoardPlayMode('sandbox');
}

function findPlayModeSelectorButton() {
  const menuButtons = document.querySelectorAll('button[aria-haspopup="menu"]');
  for (const btn of menuButtons) {
    if (btn.querySelector(
      'img[alt="Sandbox"], img[alt="Manual"], img[alt="Autoplay"], img[src*="pieces.png"], img[src*="autoplay.png"], img[src*="manual.png"]'
    )) {
      return btn;
    }
  }

  const modeImages = document.querySelectorAll(
    'button img[alt="Sandbox"], button img[alt="Manual"], button img[alt="Autoplay"]'
  );
  for (const img of modeImages) {
    const btn = img.closest('button');
    if (btn) return btn;
  }
  return null;
}

function getPlayModeLockIconHtml() {
  return '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" '
    + 'stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>'
    + '<path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
}

function ensurePlayModeLockOverlay(btn) {
  if (!btn) return null;
  let overlay = btn.querySelector(`.${PLAY_MODE_LOCK_OVERLAY_CLASS}`);
  if (!overlay) {
    overlay = document.createElement('span');
    overlay.className = PLAY_MODE_LOCK_OVERLAY_CLASS;
    overlay.innerHTML = getPlayModeLockIconHtml();
    btn.classList.add(PLAY_MODE_LOCKED_BTN_CLASS);
    if (!btn.dataset.mapEditorPrevPosition) {
      btn.dataset.mapEditorPrevPosition = btn.style.position || '';
    }
    if (getComputedStyle(btn).position === 'static') {
      btn.style.position = 'relative';
    }
    btn.appendChild(overlay);
  }
  return overlay;
}

function removePlayModeLockOverlay(btn) {
  if (!btn) return;
  btn.querySelector(`.${PLAY_MODE_LOCK_OVERLAY_CLASS}`)?.remove();
  btn.classList.remove(PLAY_MODE_LOCKED_BTN_CLASS);
  if ('mapEditorPrevPosition' in btn.dataset) {
    btn.style.position = btn.dataset.mapEditorPrevPosition;
    delete btn.dataset.mapEditorPrevPosition;
  }
}

function shouldKeepPlayModeLocked() {
  return playModeLockActive && editorState.open;
}

function clearPlayModeUnlockRetries() {
  playModeUnlockRetryTimers.forEach(clearTimeout);
  playModeUnlockRetryTimers = [];
}

function schedulePlayModeUnlockRetries() {
  clearPlayModeUnlockRetries();
  [0, 50, 150, 350, 700, 1200].forEach((delay) => {
    const id = setTimeout(() => {
      playModeUnlockRetryTimers = playModeUnlockRetryTimers.filter((timerId) => timerId !== id);
      if (shouldKeepPlayModeLocked()) return;
      unlockPlayModeSelector();
    }, delay);
    playModeUnlockRetryTimers.push(id);
  });
}

function lockPlayModeSelector() {
  if (!shouldKeepPlayModeLocked()) return false;
  const btn = findPlayModeSelectorButton();
  if (!btn) return false;

  const tooltip = t(
    'mods.mapEditor.playModeLockedTooltip',
    'Close the Map Editor to change game mode.'
  );

  if (!btn.hasAttribute(PLAY_MODE_LOCK_ATTR)) {
    btn.setAttribute(PLAY_MODE_LOCK_ATTR, '1');
    btn.dataset.mapEditorPrevDisabled = btn.disabled ? '1' : '0';
    btn.dataset.mapEditorPrevTitle = btn.getAttribute('title') || '';
    btn.dataset.mapEditorPrevPointerEvents = btn.style.pointerEvents || '';
    btn.dataset.mapEditorPrevOpacity = btn.style.opacity || '';
  }

  btn.disabled = true;
  btn.setAttribute('aria-disabled', 'true');
  btn.setAttribute('aria-label', tooltip);
  btn.title = tooltip;
  btn.style.pointerEvents = 'none';
  ensurePlayModeLockOverlay(btn);
  return true;
}

function unlockPlayModeSelectorOnButton(btn) {
  if (!btn) return false;
  if (btn.hasAttribute(MAP_SELECTOR_LOCK_ATTR)) {
    if (btn.hasAttribute(PLAY_MODE_LOCK_ATTR)) {
      btn.removeAttribute(PLAY_MODE_LOCK_ATTR);
      delete btn.dataset.mapEditorPrevDisabled;
      delete btn.dataset.mapEditorPrevTitle;
      delete btn.dataset.mapEditorPrevPointerEvents;
      delete btn.dataset.mapEditorPrevOpacity;
    }
    return false;
  }

  removePlayModeLockOverlay(btn);
  btn.removeAttribute('aria-label');

  if (btn.hasAttribute(PLAY_MODE_LOCK_ATTR)) {
    btn.disabled = btn.dataset.mapEditorPrevDisabled === '1';
    const prevTitle = btn.dataset.mapEditorPrevTitle;
    if (prevTitle) btn.title = prevTitle;
    else btn.removeAttribute('title');
    btn.style.pointerEvents = btn.dataset.mapEditorPrevPointerEvents || '';
    btn.style.opacity = btn.dataset.mapEditorPrevOpacity || '';
    btn.removeAttribute(PLAY_MODE_LOCK_ATTR);
    delete btn.dataset.mapEditorPrevDisabled;
    delete btn.dataset.mapEditorPrevTitle;
    delete btn.dataset.mapEditorPrevPointerEvents;
    delete btn.dataset.mapEditorPrevOpacity;
  } else {
    btn.disabled = false;
    btn.style.pointerEvents = '';
    btn.style.opacity = '';
  }

  btn.removeAttribute('aria-disabled');
  return true;
}

function unlockPlayModeSelector() {
  const lockedButtons = document.querySelectorAll(
    `button[${PLAY_MODE_LOCK_ATTR}="1"], button.${PLAY_MODE_LOCKED_BTN_CLASS}`
  );
  let unlocked = false;
  lockedButtons.forEach((btn) => {
    if (unlockPlayModeSelectorOnButton(btn)) unlocked = true;
  });

  if (!unlocked) {
    const fallback = findPlayModeSelectorButton();
    if (fallback?.classList.contains(PLAY_MODE_LOCKED_BTN_CLASS)
      || fallback?.hasAttribute(PLAY_MODE_LOCK_ATTR)) {
      unlocked = unlockPlayModeSelectorOnButton(fallback);
    }
  }
  return unlocked;
}

function attachPlayModeSelectorLockObserver() {
  if (playModeSelectorLockObserver) return;
  playModeSelectorLockObserver = new MutationObserver(() => {
    if (!shouldKeepPlayModeLocked()) return;
    lockPlayModeSelector();
  });
  playModeSelectorLockObserver.observe(document.body, { childList: true, subtree: true });
}

function detachPlayModeSelectorLockObserver() {
  if (!playModeSelectorLockObserver) return;
  playModeSelectorLockObserver.disconnect();
  playModeSelectorLockObserver = null;
}

function attachPlayModeEnforceListener() {
  if (playModeEnforceUnsubscribe || !globalThis.state?.board?.subscribe) return;
  playModeEnforceUnsubscribe = globalThis.state.board.subscribe(() => {
    if (!editorState.open || scopeHandlingSuspended) return;
    if (getBoardPlayMode() !== 'sandbox') {
      setBoardPlayMode('sandbox');
    }
  });
}

function detachPlayModeEnforceListener() {
  if (!playModeEnforceUnsubscribe) return;
  try { playModeEnforceUnsubscribe(); } catch (e) {}
  playModeEnforceUnsubscribe = null;
}

function enterMapEditorPlayModeLock() {
  clearPlayModeUnlockRetries();
  playModeLockActive = true;
  if (mapEditorSavedPlayMode == null) {
    mapEditorSavedPlayMode = getBoardPlayMode();
  }
  ensureMapEditorSandboxPlayMode();
  lockPlayModeSelector();
  attachPlayModeSelectorLockObserver();
  attachPlayModeEnforceListener();
  if (playModeLockDeferTimer) clearTimeout(playModeLockDeferTimer);
  playModeLockDeferTimer = setTimeout(() => {
    playModeLockDeferTimer = null;
    if (!shouldKeepPlayModeLocked()) return;
    ensureMapEditorSandboxPlayMode();
    lockPlayModeSelector();
  }, 150);
  logMapEditor('playModeLocked', { savedMode: mapEditorSavedPlayMode });
}

function exitMapEditorPlayModeLock() {
  playModeLockActive = false;
  if (playModeLockDeferTimer) {
    clearTimeout(playModeLockDeferTimer);
    playModeLockDeferTimer = null;
  }
  detachPlayModeSelectorLockObserver();
  detachPlayModeEnforceListener();
  unlockPlayModeSelector();

  // Stay in sandbox after closing Map Editor — do not restore prior mode (e.g. manual).
  mapEditorSavedPlayMode = null;
  ensureMapEditorSandboxPlayMode();
  logMapEditor('playModeUnlocked', { restoredMode: 'sandbox' });

  schedulePlayModeUnlockRetries();
}

function findMapSelectorButtons() {
  const buttons = [];
  const mapImg = document.querySelector(
    'button img[src*="/assets/icons/map.png"], button img[alt="Map"]'
  );
  const mapBtn = mapImg?.closest('button');
  if (mapBtn) buttons.push(mapBtn);
  else {
    for (const span of document.querySelectorAll('button span')) {
      const text = (span.textContent || '').trim();
      if (text !== 'Select map' && text !== 'Maps') continue;
      const btn = span.closest('button');
      if (btn) {
        buttons.push(btn);
        break;
      }
    }
  }

  const group = buttons[0]?.parentElement;
  if (group) {
    group.querySelectorAll(':scope > button').forEach((btn) => {
      if (!buttons.includes(btn)) buttons.push(btn);
    });
  }
  return buttons;
}

function shouldKeepMapSelectorLocked() {
  return mapSelectorLockActive && isWorkshopMapSessionActive();
}

function lockMapSelectorOnButton(btn) {
  if (!btn) return false;
  const tooltip = t(
    'mods.mapEditor.mapSelectorLockedTooltip',
    'Leave the workshop map before changing maps.'
  );
  if (!btn.hasAttribute(MAP_SELECTOR_LOCK_ATTR)) {
    btn.setAttribute(MAP_SELECTOR_LOCK_ATTR, '1');
    btn.dataset.mapEditorMapPrevDisabled = btn.disabled ? '1' : '0';
    btn.dataset.mapEditorMapPrevTitle = btn.getAttribute('title') || '';
    btn.dataset.mapEditorMapPrevPointerEvents = btn.style.pointerEvents || '';
  }
  btn.disabled = true;
  btn.setAttribute('aria-disabled', 'true');
  btn.setAttribute('aria-label', tooltip);
  btn.title = tooltip;
  btn.style.pointerEvents = 'none';
  ensurePlayModeLockOverlay(btn);
  return true;
}

function unlockMapSelectorOnButton(btn) {
  if (!btn?.hasAttribute(MAP_SELECTOR_LOCK_ATTR)) return false;
  const keepPlayModeLock = btn.hasAttribute(PLAY_MODE_LOCK_ATTR) && shouldKeepPlayModeLocked();
  if (!keepPlayModeLock) removePlayModeLockOverlay(btn);
  btn.disabled = btn.dataset.mapEditorMapPrevDisabled === '1';
  const prevTitle = btn.dataset.mapEditorMapPrevTitle;
  if (prevTitle) btn.title = prevTitle;
  else btn.removeAttribute('title');
  btn.style.pointerEvents = btn.dataset.mapEditorMapPrevPointerEvents || '';
  btn.removeAttribute(MAP_SELECTOR_LOCK_ATTR);
  delete btn.dataset.mapEditorMapPrevDisabled;
  delete btn.dataset.mapEditorMapPrevTitle;
  delete btn.dataset.mapEditorMapPrevPointerEvents;
  if (!keepPlayModeLock) {
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('aria-label');
  }
  return true;
}

function lockMapSelector() {
  mapSelectorLockActive = true;
  const buttons = findMapSelectorButtons();
  if (!buttons.length) return false;
  buttons.forEach(lockMapSelectorOnButton);
  return true;
}

function unlockMapSelector() {
  mapSelectorLockActive = false;
  document.querySelectorAll(`button[${MAP_SELECTOR_LOCK_ATTR}="1"]`).forEach(unlockMapSelectorOnButton);
  if (shouldKeepPlayModeLocked()) lockPlayModeSelector();
}

function attachMapSelectorLockObserver() {
  if (mapSelectorLockObserver) return;
  mapSelectorLockObserver = new MutationObserver(() => {
    if (!shouldKeepMapSelectorLocked()) return;
    lockMapSelector();
  });
  mapSelectorLockObserver.observe(document.body, { childList: true, subtree: true });
}

function detachMapSelectorLockObserver() {
  if (!mapSelectorLockObserver) return;
  mapSelectorLockObserver.disconnect();
  mapSelectorLockObserver = null;
}

function attachBoardListener() {
  if (boardUnsubscribe || !globalThis.state?.board?.subscribe) return;
  boardUnsubscribe = globalThis.state.board.subscribe(() => {
    const scopeChanged = handleBoardScopeChange();
    if (!scopeChanged && !scopeHandlingSuspended) {
      scheduleBoardConfigSanitize();
    }
    if (!editorState.open) return;
    if (!scopeHandlingSuspended) {
      if (scopeChanged) scheduleBoardToolsRefresh();
      else {
        enableMapEditorBoardTools();
        if (editorState.selectedTileIndex != null) {
          markTileSelected(editorState.selectedTileIndex);
        }
      }
      // Skip the full rebuild right after our own edit-triggered board write — it just
      // happened and already reflects the change; rebuilding here only steals focus/scroll
      // out from under whatever field the user is still typing in.
      if (Date.now() >= suppressBoardListenerRefreshUntil) {
        refreshInspector();
      }
    }
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
    body.map-editor-board-active [${MAP_EDITOR_FLOOR_UI_HIDDEN_ATTR}="1"],
    body.map-editor-board-active [data-maxfloorenabled] {
      display: none !important;
    }
    button.${PLAY_MODE_LOCKED_BTN_CLASS},
    button[${MAP_SELECTOR_LOCK_ATTR}="1"] {
      cursor: not-allowed !important;
      filter: grayscale(0.55);
      opacity: 0.72;
    }
    button.${PLAY_MODE_LOCKED_BTN_CLASS} .${PLAY_MODE_LOCK_OVERLAY_CLASS} {
      position: absolute;
      right: 1px;
      bottom: 1px;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      color: #E5C07B;
      background: rgba(20, 22, 28, 0.82);
      border: 1px solid rgba(229, 192, 123, 0.45);
      border-radius: 2px;
      padding: 1px;
      line-height: 0;
      z-index: 2;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
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
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
      margin: 0 var(--me-inset) var(--me-inset);
      padding: 8px;
      border: 4px solid transparent;
      border-image: var(--me-frame-4);
    }
    #${PANEL_ID} .me-inspector {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1 1 auto;
      min-height: 0;
      font-size: 12px;
      line-height: 1.35;
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
      flex: 1 1 auto;
      min-height: 0;
    }
    #${PANEL_ID} .me-tab-panel[data-tab-panel="map"] {
      overflow-y: auto;
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
    #${PANEL_ID} .me-input-full,
    #${PANEL_ID} .me-input-wide {
      flex: 1 1 auto;
      min-width: 0;
      width: auto;
      max-width: 100%;
      box-sizing: border-box;
    }
    #${PANEL_ID} .me-tab-panel[data-tab-panel="assets"],
    #${PANEL_ID} .me-tab-panel[data-tab-panel="creatures"],
    #${PANEL_ID} .me-tab-panel[data-tab-panel="workshop"] {
      flex: 1 1 auto;
      min-height: 0;
      gap: 6px;
      overflow: hidden;
    }
    #${PANEL_ID} .me-framed-block {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 6px 8px;
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background-color: rgba(0, 0, 0, 0.2);
      background-image: var(--me-bg);
    }
    #${PANEL_ID} .me-assets-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 0 0 auto;
      z-index: 2;
      background-image: var(--me-bg);
      background-color: var(--me-panel-bg);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.35);
    }
    #${PANEL_ID} .me-asset-filter-section {
      gap: 4px;
    }
    #${PANEL_ID} .me-asset-filter-frame {
      padding: 4px 6px 6px;
    }
    #${PANEL_ID} .me-section-title.me-asset-filter-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      width: 100%;
      padding: 0;
      border: none;
      background: transparent;
      cursor: pointer;
      text-align: left;
      user-select: none;
    }
    #${PANEL_ID} .me-asset-filter-toggle::before {
      content: '▸';
      color: var(--me-gold);
      font-size: 11px;
      line-height: 1;
    }
    #${PANEL_ID} .me-asset-filter-toggle.is-expanded::before {
      content: '▾';
    }
    #${PANEL_ID} .me-asset-grid-body,
    #${PANEL_ID} .me-creature-grid-body,
    #${PANEL_ID} .me-workshop-grid-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      padding-right: 2px;
    }
    #${PANEL_ID} .me-asset-region-filters[hidden] {
      display: none !important;
    }
    #${PANEL_ID} .me-asset-region-filters {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 2px 2px 4px;
    }
    #${PANEL_ID} .me-asset-region {
      margin: 0;
    }
    #${PANEL_ID} .me-asset-region-head {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 20px;
      padding: 2px 0;
    }
    #${PANEL_ID} .me-asset-region-toggle {
      flex: 0 0 auto;
      min-width: 22px;
      padding: 0 4px;
    }
    #${PANEL_ID} .me-asset-region-check {
      flex: 1 1 auto;
      font-weight: 700;
      font-size: 11px;
      line-height: 1.3;
      color: var(--me-text);
    }
    #${PANEL_ID} .me-asset-map-check {
      font-size: 11px;
      line-height: 1.3;
      color: #bbb;
    }
    #${PANEL_ID} .me-asset-map-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 2px 0 4px 14px;
      padding-left: 8px;
    }
    #${PANEL_ID} .me-asset-map-list[hidden] {
      display: none !important;
    }
    #${PANEL_ID} .me-asset-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(${ASSET_CARD_PREVIEW_SIZE + 16}px, 1fr));
      gap: 6px;
      max-height: none;
      overflow: visible;
      padding-right: 2px;
    }
    #${PANEL_ID} .me-asset-grid.is-loading {
      pointer-events: none;
    }
    #${PANEL_ID} .me-asset-skeleton {
      min-height: ${ASSET_CARD_PREVIEW_SIZE + 20}px;
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
      gap: 2px;
      padding: 4px 2px;
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background: rgba(0,0,0,0.25);
      color: var(--me-text);
      cursor: pointer;
      text-align: center;
    }
    #${PANEL_ID} .me-asset-card .me-sprite-preview {
      width: ${ASSET_CARD_PREVIEW_SIZE}px;
      height: ${ASSET_CARD_PREVIEW_SIZE}px;
    }
    #${PANEL_ID} .me-asset-card .me-sprite-preview > .sprite {
      transform: scale(${ASSET_CARD_PREVIEW_SIZE / SPRITE_PREVIEW_SIZE});
      transform-origin: bottom right;
      animation: none !important;
    }
    #${PANEL_ID} .me-asset-card .me-sprite-preview-host-sync > .sprite {
      animation: none !important;
    }
    #${PANEL_ID} .me-asset-card .me-sprite-preview .spritesheet,
    #${PANEL_ID} .me-asset-card .me-sprite-preview .viewport {
      animation-play-state: running !important;
    }
    #${PANEL_ID} .me-asset-card .me-sprite-preview-pending {
      min-height: ${ASSET_CARD_PREVIEW_SIZE}px;
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
    #${PANEL_ID} .me-asset-empty {
      grid-column: 1 / -1;
      padding: 8px 0;
    }
    #${PANEL_ID} .me-creature-load-sentinel {
      grid-column: 1 / -1;
      height: 1px;
      pointer-events: none;
    }
    #${PANEL_ID} .me-custom-sprite-separator {
      grid-column: 1 / -1;
      margin-top: 4px;
      padding-top: 6px;
      border-top: 1px solid rgba(255,255,255,0.15);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--me-gold);
    }
    #${PANEL_ID} .me-creature-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${ASSET_CARD_PREVIEW_SIZE}px;
      height: ${ASSET_CARD_PREVIEW_SIZE}px;
      overflow: hidden;
    }
    #${PANEL_ID} .me-creature-portrait {
      width: ${ASSET_CARD_PREVIEW_SIZE}px;
      height: ${ASSET_CARD_PREVIEW_SIZE}px;
      object-fit: contain;
      image-rendering: pixelated;
      pointer-events: none;
    }
    #${PANEL_ID} .me-creature-preview-fallback {
      font-size: 11px;
      font-weight: 700;
      color: #aaa;
    }
    #${PANEL_ID} .me-creature-name {
      font-size: 10px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--me-text);
      word-break: break-word;
    }
    #${PANEL_ID} .me-creature-show-all {
      flex: 0 0 auto;
      white-space: nowrap;
      font-size: 11px;
    }
    #${PANEL_ID} .me-options-panel,
    #${PANEL_ID} .me-map-panel {
      padding-top: 2px;
    }
    #${PANEL_ID} .me-map-battle-rules-hint {
      flex-shrink: 0;
      margin-bottom: 0;
    }
    #${PANEL_ID} .me-map-battle-rules-section {
      margin-top: 0;
    }
    #${PANEL_ID} .me-map-battle-rules-row {
      flex-shrink: 0;
      margin-bottom: 2px;
    }
    #${PANEL_ID} .me-map-battle-rules-row .me-input {
      width: 100%;
    }
    #${PANEL_ID} .me-btn-compact.active {
      color: var(--me-gold);
    }
    #${PANEL_ID} .me-context-card {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 8px;
      border: 4px solid transparent;
      border-image: var(--me-frame-4);
      background-color: rgba(0, 0, 0, 0.2);
      background-image: var(--me-bg);
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
    #${PANEL_ID} .me-context-actions {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      flex-wrap: wrap;
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
      overflow: hidden;
      image-rendering: pixelated;
    }
    #${PANEL_ID} .me-tile-preview-layer {
      position: absolute;
      right: 0;
      bottom: 0;
      width: ${SPRITE_PREVIEW_SIZE}px;
      height: ${SPRITE_PREVIEW_SIZE}px;
      overflow: hidden;
      pointer-events: none;
    }
    #${PANEL_ID} .me-tile-preview-stage .me-sprite-preview {
      position: absolute;
      right: 0;
      bottom: 0;
      border: 0;
      background: transparent;
      overflow: hidden;
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
    #${PANEL_ID} .me-sprite-preview-host-sync .viewport,
    #${PANEL_ID} .me-sprite-preview-host-sync img.spritesheet {
      width: auto;
      height: auto;
      max-width: none;
      max-height: none;
    }
    /* Do not size .spritesheet — game CSS steps background-position for frames. */
    #${PANEL_ID} .me-sprite-preview img.spritesheet,
    #${PANEL_ID} .me-tile-preview-layer img.spritesheet {
      image-rendering: pixelated;
      pointer-events: none;
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
    #${PANEL_ID} .me-sprite-list-separator,
    #${PANEL_ID} .me-panel-separator {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0 6px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgba(255, 224, 102, 0.85);
    }
    #${PANEL_ID} .me-sprite-list-separator::before,
    #${PANEL_ID} .me-sprite-list-separator::after,
    #${PANEL_ID} .me-panel-separator::before,
    #${PANEL_ID} .me-panel-separator::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(255, 224, 102, 0.28);
    }
    #${PANEL_ID} .me-sprite-row-floor-below {
      opacity: 0.92;
    }
    #${PANEL_ID} .me-sprite-floor-below-tag {
      font-size: 10px;
      color: rgba(255, 224, 102, 0.75);
    }
    #${PANEL_ID} .me-sprite-move-layer-btn {
      margin-left: auto;
    }
    #${PANEL_ID} .me-sprite-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      flex-wrap: wrap;
    }
    #${PANEL_ID} .me-sprite-drag-handle {
      flex: 0 0 auto;
      width: 14px;
      color: rgba(255, 224, 102, 0.65);
      font-size: 11px;
      line-height: 1;
      letter-spacing: -2px;
      cursor: grab;
      user-select: none;
      text-align: center;
    }
    #${PANEL_ID} .me-sprite-row-dragging {
      opacity: 0.55;
    }
    #${PANEL_ID} .me-sprite-row-drop-target {
      outline: 1px dashed var(--me-gold);
      outline-offset: 1px;
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
    #${PANEL_ID} .me-sprite-offset-row {
      display: flex;
      gap: 10px;
      flex: 1 1 100%;
      align-items: center;
      flex-wrap: wrap;
    }
    #${PANEL_ID} .me-sprite-offset-group {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    #${PANEL_ID} .me-floor-level-group.me-sprite-move-layer-btn {
      margin-left: auto;
    }
    #${PANEL_ID} .me-floor-level-select {
      width: auto;
      min-width: 0;
    }
    #${PANEL_ID} .me-sprite-offset-label {
      flex: 0 0 auto;
      min-width: 12px;
      font-size: 11px;
      color: var(--me-muted, #9ca3af);
    }
    #${PANEL_ID} .me-sprite-offset-value {
      min-width: 20px;
      text-align: center;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      color: var(--me-text, #e5e7eb);
    }
    #${PANEL_ID} .me-creature-edit {
      flex-direction: column;
      align-items: stretch;
      margin-bottom: 6px;
      padding-left: 0;
    }
    #${PANEL_ID} .me-creature-edit-hint {
      font-size: 10px;
      line-height: 1.35;
    }
    #${PANEL_ID} .me-creature-form-grid {
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 100%;
    }
    #${PANEL_ID} .me-creature-form-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    #${PANEL_ID} .me-creature-form-label {
      flex: 0 0 72px;
      font-size: 11px;
      color: #aaa;
    }
    #${PANEL_ID} .me-creature-input-compact {
      width: 88px;
      min-width: 0;
    }
    #${PANEL_ID} .me-creature-check-row {
      gap: 12px;
      padding: 2px 0;
    }
    #${PANEL_ID} .me-creature-section-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--me-gold);
      margin-top: 4px;
    }
    #${PANEL_ID} .me-creature-genes {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 0 2px;
    }
    #${PANEL_ID} .me-creature-gene-row {
      display: grid;
      grid-template-columns: 28px 1fr 24px;
      gap: 6px;
      align-items: center;
    }
    #${PANEL_ID} .me-creature-gene-label,
    #${PANEL_ID} .me-creature-gene-value {
      font-size: 11px;
      color: #ccc;
      text-align: center;
    }
    #${PANEL_ID} .me-creature-gene-slider {
      width: 100%;
      margin: 0;
    }
    #${PANEL_ID} .me-creature-stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 4px 8px;
      padding: 0 2px;
    }
    #${PANEL_ID} .me-creature-stat-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    #${PANEL_ID} .me-creature-stat-label {
      color: #aaa;
    }
    #${PANEL_ID} .me-creature-stat-value {
      color: #eee;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    #${PANEL_ID} .me-creature-equip-fields {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    #${PANEL_ID} .me-creature-equip-select {
      width: 100%;
      max-width: 100%;
      background: #fff;
      color: #111;
      border-image: none;
      border: 1px solid #bbb;
    }
    #${PANEL_ID} .me-creature-equip-select option {
      background: #fff;
      color: #111;
    }
    #${PANEL_ID} .me-creature-equip-select:disabled {
      background: #f0f0f0;
      color: #666;
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
    #${PANEL_ID} .me-ally-tag {
      color: #61AFEF;
      font-weight: 700;
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
      color: var(--me-text);
    }
    #${PANEL_ID} input[type="checkbox"] {
      width: 13px;
      height: 13px;
      margin: 0;
      flex-shrink: 0;
      accent-color: var(--me-gold);
      cursor: pointer;
    }
    #${PANEL_ID} .me-input {
      flex: 0 1 auto;
      width: 110px;
      min-width: 80px;
      padding: 4px 6px;
      border: 4px solid transparent;
      border-image: var(--me-frame-1);
      background: rgba(0,0,0,0.35);
      color: var(--me-text);
      font-size: 12px;
      box-sizing: border-box;
    }
    #${PANEL_ID} .me-input.me-input-wide,
    #${PANEL_ID} .me-input.me-input-full {
      flex: 1 1 100%;
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }
    #${PANEL_ID} .me-textarea {
      min-height: 140px;
      max-height: 320px;
      font-family: monospace;
      resize: vertical;
      white-space: pre;
    }
    #${PANEL_ID} .me-import-map-panel {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
    }
    #${PANEL_ID} .me-row-full {
      width: 100%;
    }
    #${PANEL_ID} .me-btn-wide {
      flex: 1 1 100%;
      text-align: center;
    }
    #${PANEL_ID} .me-btn-muted {
      opacity: 0.85;
    }
    #${PANEL_ID} .me-btn.me-btn-active {
      opacity: 1;
      border-color: var(--me-gold, #ffe066);
      color: var(--me-gold, #ffe066);
    }
    #${PANEL_ID} .me-session-hint {
      font-size: 11px;
      color: #888;
      margin-top: -2px;
      margin-bottom: 4px;
      line-height: 1.35;
    }
    #${PANEL_ID} .me-session-hint-selected {
      margin-top: 4px;
      margin-bottom: 6px;
      padding: 8px 10px;
      border: 4px solid transparent;
      border-image: var(--me-frame-4);
      background: rgba(0, 0, 0, 0.35);
      color: #ccc;
    }
    #${PANEL_ID} .me-session-selected-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #9a9a9a;
      margin-bottom: 4px;
    }
    #${PANEL_ID} .me-session-selected-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--me-gold);
      line-height: 1.2;
      word-break: break-word;
    }
    #${PANEL_ID} .me-session-selected-time {
      margin-top: 3px;
      font-size: 11px;
      color: #bdbdbd;
    }
    #${PANEL_ID} .me-session-hint-warning {
      padding: 6px 8px;
      border: 1px solid #6a4a1a;
      background: rgba(80, 50, 10, 0.35);
      color: #f0c878;
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
    #${PANEL_ID} .me-workshop-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 2px;
    }
    #${PANEL_ID} .me-workshop-group-title {
      font-size: 11px;
      font-weight: 600;
      color: #aaa;
      margin-top: 4px;
      margin-bottom: 2px;
      grid-column: 1 / -1;
    }
    #${PANEL_ID} .me-workshop-grid {
      grid-template-columns: repeat(auto-fill, minmax(${WORKSHOP_CARD_PREVIEW_SIZE + 12}px, 1fr));
      gap: 8px;
      max-height: none;
      overflow: visible;
    }
    #${PANEL_ID} .me-workshop-local-grid {
      max-height: 220px;
      overflow-y: auto;
      padding-right: 2px;
    }
    #${PANEL_ID} .me-workshop-card {
      position: relative;
      cursor: pointer;
    }
    #${PANEL_ID} .me-workshop-card:focus-visible {
      outline: 1px solid var(--me-gold);
      outline-offset: 1px;
    }
    #${PANEL_ID} .me-workshop-card-active {
      color: var(--me-gold);
    }
    #${PANEL_ID} .me-workshop-skeleton {
      min-height: ${WORKSHOP_CARD_PREVIEW_SIZE + 28}px;
    }
    #${PANEL_ID} .me-workshop-map-preview {
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${WORKSHOP_CARD_PREVIEW_SIZE}px;
      height: ${WORKSHOP_CARD_PREVIEW_SIZE}px;
      overflow: hidden;
    }
    #${PANEL_ID} .me-workshop-map-icon {
      width: ${WORKSHOP_CARD_PREVIEW_SIZE}px;
      height: ${WORKSHOP_CARD_PREVIEW_SIZE}px;
      object-fit: cover;
      image-rendering: pixelated;
      pointer-events: none;
    }
    #${PANEL_ID} .me-workshop-map-preview-fallback {
      font-size: 14px;
      font-weight: 700;
      color: #aaa;
    }
    #${PANEL_ID} .me-workshop-card-title {
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      color: var(--me-gold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }
    #${PANEL_ID} .me-workshop-card-sub {
      font-size: 10px;
      line-height: 1.25;
      color: #888;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      width: 100%;
    }
    #${PANEL_ID} .me-workshop-description {
      width: 100%;
      min-height: 48px;
      resize: vertical;
      font-family: inherit;
    }
    #${PANEL_ID} .me-workshop-checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #ccc;
      white-space: nowrap;
    }
    #${PANEL_ID} .me-workshop-catalog-header {
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    #${PANEL_ID} .me-workshop-catalog-header .me-section-title {
      margin-bottom: 0;
    }
    #${PANEL_ID} .me-workshop-grid-body .me-workshop-grid {
      max-height: 300px;
      overflow-y: auto;
    }
    #${PANEL_ID} .me-workshop-card-delete {
      position: absolute;
      top: 0;
      right: 0;
      z-index: 2;
      width: 22px;
      height: 22px;
      padding: 0;
      border: none;
      border-radius: 0;
      background: rgba(0, 0, 0, 0.65);
      color: #ccc;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
    }
    #${PANEL_ID} .me-workshop-card-delete:hover {
      color: #f88;
      background: rgba(40, 0, 0, 0.8);
    }
    #${PANEL_ID} .me-section-hint {
      font-size: 11px;
      color: #888;
      line-height: 1.35;
    }
    #${PANEL_ID} .me-status {
      flex-shrink: 0;
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
    savePanelLayout({
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
    savePanelLayout({
      left: parseInt(panelDragState.panel.style.left, 10) || 0,
      top: parseInt(panelDragState.panel.style.top, 10) || 0
    });
    panelDragState.reset();
    document.body.style.userSelect = '';
  };
  document.addEventListener('mousemove', panelDragMouseMoveHandler, { passive: true });
  document.addEventListener('mouseup', panelDragMouseUpHandler, { passive: true });
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
      newWidth = clamp(panelResizeState.startWidth + dx, minWidth, maxWidth);
    }
    if (panelResizeState.resizeDir.includes('w')) {
      const rightEdge = panelResizeState.startLeft + panelResizeState.startWidth;
      newWidth = clamp(panelResizeState.startWidth - dx, minWidth, maxWidth);
      newLeft = rightEdge - newWidth;
    }
    if (panelResizeState.resizeDir.includes('s')) {
      newHeight = clamp(panelResizeState.startHeight + dy, minHeight, maxHeight);
    }
    if (panelResizeState.resizeDir.includes('n')) {
      const bottomEdge = panelResizeState.startTop + panelResizeState.startHeight;
      newHeight = clamp(panelResizeState.startHeight - dy, minHeight, maxHeight);
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
      savePanelLayout({
        left: parseInt(panel.style.left, 10) || 0,
        top: parseInt(panel.style.top, 10) || 0,
        width: parseInt(panel.style.width, 10) || PANEL_DEFAULTS.width,
        height: parseInt(panel.style.height, 10) || PANEL_DEFAULTS.height
      });
    }
    document.body.style.userSelect = '';
    panelResizeState.reset();
  };
  document.addEventListener('mousemove', panelResizeMouseMoveHandler, { passive: true });
  document.addEventListener('mouseup', panelResizeMouseUpHandler, { passive: true });
  document.addEventListener('pointermove', panelResizeMouseMoveHandler, { passive: true });
  document.addEventListener('pointerup', panelResizeMouseUpHandler, { passive: true });
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
  const layout = loadPanelLayout();

  const panel = document.createElement('div');
  panel.id = PANEL_ID;
  panel.style.cssText = [
    `left:${layout.left}px`,
    `top:${layout.top}px`,
    `width:${clamp(layout.width, PANEL_LAYOUT.minWidth, PANEL_LAYOUT.maxWidth)}px`,
    `height:${clamp(layout.height, PANEL_LAYOUT.minHeight, PANEL_LAYOUT.maxHeight)}px`,
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

function notifyMapEditorOpenChanged() {
  if (typeof window === 'undefined') return;
  const open = editorState.open === true;
  try {
    window.dispatchEvent(new CustomEvent('mapEditorOpenChanged', { detail: { open } }));
  } catch (_) {
    // ignore
  }
}

function isMapEditorOpen() {
  // Sandbox test (custom map test-play) and a loaded workshop/local-save map DOM session
  // commonly run with the panel closed — callers like Quests.js's helper-suppression gate
  // need all of these treated as "open" since the board is showing edited/custom content.
  return editorState.open === true
    || editorState.sandboxTestActive === true
    || mapEditorDomSessionSource != null;
}

function openMapEditor() {
  logMapEditor('openPanel');
  resetMapEditorUiState();

  let panel = document.getElementById(PANEL_ID);
  if (!panel) {
    panel = createPanel();
    document.body.appendChild(panel);
  } else {
    const body = panel.querySelector(`#${BODY_ID}`);
    if (body && !editorState.inspectorRoot) {
      body.textContent = '';
      body.appendChild(buildInspectorContent());
    } else if (editorState.inspectorRoot) {
      switchInspectorTab(PANEL_DEFAULTS.activeTab);
      resetMapEditorAssetFilterUi();
      applyPanelLayoutToPanel(panel);
    }
  }
  // Always keep the viewport listener attached (idempotent) so a window resize
  // while the panel is closed is still corrected on the next open.
  attachPanelViewportListener();

  editorState.open = true;
  adoptTrackedBoardKey();
  const openRoom = getCurrentRoom();
  if (openRoom?.id) {
    snapshotRoomDataForTest(openRoom.id);
    captureBaseTilesSnapshot();
    captureAllNativeSpritePlacements();
  }
  panel.style.display = 'flex';
  // Clamp back into the viewport now that the panel is measurable — the stored
  // left/top may point off-screen if the window was resized while it was closed.
  updatePanelPosition();
  enableMapEditorBoardTools();
  enterMapEditorPlayModeLock();
  refreshInspector();
  notifyMapEditorOpenChanged();
  void ensureMapEditorEditSession();
}

function closeMapEditor() {
  logMapEditor('closePanel');
  if (!isWorkshopMapSessionActive()) removeMapEditorPersistentToast();
  flushCreatureEditIfOpen();
  if (editorState.sandboxTestActive) {
    refreshMapEditorEditSession({ refreshSnapshot: true, skipVillainBoardResync: true });
  }

  editorState.open = false;
  exitMapEditorPlayModeLock();
  if (!shouldKeepMapEditorFloorLocked()) exitMapEditorFloorLock();
  notifyMapEditorOpenChanged();

  try {
    autoSaveMapSessionOnClose();

  const panel = document.getElementById(PANEL_ID);
  if (panel) panel.style.display = 'none';

    clearReloadRoomTimers();
  cancelAssetListWork();
    stopAllSpritePreviewHostSync();
  cancelCreatureListWork();
  scopeHandlingSuspended = false;
  if (boardToolsRefreshTimer) {
    clearTimeout(boardToolsRefreshTimer);
    boardToolsRefreshTimer = null;
  }
  disableMapEditorBoardTools();
  detachPanelViewportListener();
    panelDragState.reset();
    panelResizeState.reset();
    document.body.style.userSelect = '';
  editorState.selectedTileIndex = null;
  editorState.editingSprite = null;
    editorState.editingCreatureTileIndex = null;
    clearTileSelection();

    if (trackedBoardKey == null) {
      trackedBoardKey = getBoardRoomKey();
    }
  } finally {
    schedulePlayModeUnlockRetries();
  }
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
    tooltip: t('mods.mapEditor.buttonTooltip', 'Edit maps, sprites, villains, and workshop battles'),
    modId: MOD_ID,
    primary: false,
    onClick: toggleMapEditor
  });
}

function cleanupMapEditor() {
  stopMapEditorSandboxTest({ silent: true, reloadRoom: false });
  if (editorState.open) closeMapEditor();
  else {
    editorState.open = false;
    exitMapEditorPlayModeLock();
    notifyMapEditorOpenChanged();
  }
  detachBoardListener();
  teardownPanelDragListeners();
  teardownPanelResizeListeners();
  detachPanelViewportListener();
  clearMapEditorCaches();
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
    toggleMapEditor,
    isOpen: isMapEditorOpen,
    buildWholeMapExport,
    buildUnifiedMapExport,
    buildQuestRoomExport,
    buildFullMapExport,
    buildNativeRoomExport,
    convertMapEditorV2ToNativeRoom,
    buildCustomBattleStubFromExport,
    ensureMapEditorEditSession,
    startMapEditorSandboxTest,
    stopMapEditorSandboxTest
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
  cleanup: cleanupMapEditor,
  buildWholeMapExport,
  buildUnifiedMapExport,
  buildQuestRoomExport,
  buildFullMapExport,
  buildNativeRoomExport,
  convertMapEditorV2ToNativeRoom,
  buildCustomBattleStubFromExport,
  ensureMapEditorEditSession,
  startMapEditorSandboxTest,
  stopMapEditorSandboxTest
};
