// =======================
// 0. Metadata
// =======================
(function() {
'use strict';

// =======================
// 1. Configuration & Constants
// =======================
const MOD_ID = 'battle-helper';
const BUTTON_ID = 'battle-helper-button';
const PROFILE_API_BASE = 'https://bestiaryarena.com/api/trpc/serverSide.profilePageData';

// Debug logging — always on; silence with `window.__BATTLE_HELPER_DEBUG = false` in the console.
const debugLog = (...args) => {
  if (typeof window !== 'undefined' && window.__BATTLE_HELPER_DEBUG === false) return;
  try {
    console.log('[Battle Helper]', ...args);
  } catch (_) { /* ignore */ }
};

const MODAL_CONFIG = {
  width: 920,
  height: 600,
  viewportPadding: 16,
  minWidth: 480,
  minHeight: 200
};
const BATTLE_HELPER_MODAL_ID = 'battle-helper-modal';
const BATTLE_HELPER_BUTTON_CLASS = {
  primary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-green active:frame-pressed-1-green surface-green gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  secondary: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1 active:frame-pressed-1 surface-regular gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  blue: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-blue active:frame-pressed-1-blue surface-blue gap-1 px-2 py-0.5 pb-[3px] pixel-font-14',
  danger: 'focus-style-visible flex items-center justify-center tracking-wide text-whiteRegular frame-1-red active:frame-pressed-1-red surface-red gap-1 px-2 py-0.5 pb-[3px] pixel-font-14'
};
const BATTLE_HELPER_BLUE_BUTTON_STYLE = [
  'width: 100%; cursor: pointer; color: rgb(255, 255, 255);',
  'background-image: url("https://bestiaryarena.com/_next/static/media/background-blue.7259c4ed.png"), url("https://bestiaryarena.com/_next/static/media/1-frame-blue.cf300a6a.png");',
  'background-size: auto, 100% 100%;',
  'background-position: left top, center center;',
  'background-repeat: repeat, no-repeat;'
].join(' ');

const BATTLE_HELPER_BUTTON_IMPORTED_CLASS = 'battle-helper-button-imported';
const BATTLE_HELPER_BUTTON_STYLE_ID = 'battle-helper-button-styles';
const BATTLE_HELPER_FIELD_HEIGHT_PX = 25;
const BATTLE_HELPER_OUTPUT_HEIGHT_PX = 170;
const BATTLE_HELPER_HELP_LIST_HEIGHT_PX = 210;
const BATTLE_HELPER_SCROLLBAR_GUTTER_PX = 12;
const BATTLE_HELPER_STATUS_COLORS = {
  success: '#6ee07a',
  error: '#f87171',
  progress: '#fbbf24'
};
const BATTLE_HELPER_FETCH_MIN_INTERVAL_MS = 400;
const BATTLE_HELPER_TOAST_STACK_OFFSET_PX = 46;
const BATTLE_HELPER_TOAST_TRANSITION = '230ms cubic-bezier(0.21, 1.02, 0.73, 1)';
const BATTLE_HELPER_TOAST_CONTAINER_ID = 'battle-helper-toast-container';
const BATTLE_HELPER_PROFILE_URL_BASE = 'https://bestiaryarena.com/profile/';

const FIREBASE_URL = 'https://vip-list-messages-default-rtdb.europe-west1.firebasedatabase.app';
const BATTLE_HELP_REQUESTS_PATH = `${FIREBASE_URL}/battle-help/requests`;
const BATTLE_HELP_REQUEST_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const BATTLE_HELP_MAX_OPEN_PER_USER = 3;
const BATTLE_HELP_MAX_REPLIES_PER_USER = 3;
const BATTLE_HELP_GOAL_TYPES = ['ticks', 'rank', 'floor'];
const BATTLE_HELP_MAX_TICKS = 9600;
const BATTLE_HELP_NOTE_MAX_LENGTH = 80;
const BATTLE_HELP_BUTTON_POLL_MS = 60000;

const DEFAULT_MONSTER_STAT = 1;
const DEFAULT_MONSTER_EXP = 0;
const DEFAULT_EQUIP_STAT = 'ad';
const VALID_EQUIP_STATS = new Set(['ad', 'ap', 'hp']);

const t = (key) => {
  if (typeof api !== 'undefined' && api.i18n?.t) {
    return api.i18n.t(key);
  }
  if (typeof context !== 'undefined' && context.api?.i18n?.t) {
    return context.api.i18n.t(key);
  }
  return key;
};

const tReplace = (key, replacements) => {
  let text = t(key);
  Object.entries(replacements).forEach(([placeholder, value]) => {
    text = text.replace(new RegExp(`\\{${placeholder}\\}`, 'g'), value);
  });
  return text;
};

function formatProfileDisplayName(name) {
  const raw = String(name || '').trim();
  return raw || t('mods.battleHelper.unknown');
}

function getProfileReplacedOutput() {
  return `${t('mods.battleHelper.output.profileReplaced')}\n${t('mods.battleHelper.output.dragDropHint')}`;
}

function getNoProfileFetchedOutput() {
  return `${t('mods.battleHelper.output.ready')}\n${t('mods.battleHelper.output.noProfileFetched')}`;
}

function getEnterUsernameFirstOutput() {
  return `${t('mods.battleHelper.output.enterUsernameFirst')}\n${t('mods.battleHelper.output.noProfileFetched')}`;
}

function getFetchFailedOutput(error) {
  return `${tReplace('mods.battleHelper.output.fetchFailed', {
    error: String(error?.message || error)
  })}\n${t('mods.battleHelper.output.noProfileFetched')}`;
}

// =======================
// 2. Utilities & Validation Helpers
// =======================
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUsername(value) {
  return String(value || '').trim();
}

function snapBattleHelperModalPx(value) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function getModalDimensions() {
  const pad = MODAL_CONFIG.viewportPadding * 2;
  const maxHeight = snapBattleHelperModalPx(Math.max(
    MODAL_CONFIG.minHeight,
    window.innerHeight - pad
  ));
  return {
    width: snapBattleHelperModalPx(Math.max(
      MODAL_CONFIG.minWidth,
      Math.min(MODAL_CONFIG.width, window.innerWidth - pad)
    )),
    height: snapBattleHelperModalPx(Math.min(MODAL_CONFIG.height, maxHeight)),
    maxHeight
  };
}

function isSandboxEnabled() {
  try {
    const playerCtx = globalThis.state?.player?.getSnapshot?.()?.context;
    if (!playerCtx) return false;
    const flags = new globalThis.state.utils.Flags(playerCtx.flags);
    return flags.isSet('sandbox');
  } catch (error) {
    console.warn('[Battle Helper] Could not check sandbox mode:', error);
    return false;
  }
}

function ensureSandboxPlayMode() {
  try {
    const board = globalThis.state?.board;
    if (!board?.send) return false;
    const currentMode = board.getSnapshot?.()?.context?.mode;
    if (currentMode === 'sandbox') return false;
    board.send({ type: 'setPlayMode', mode: 'sandbox' });
    return true;
  } catch (error) {
    console.warn('[Battle Helper] Could not set sandbox play mode:', error);
    return false;
  }
}

function buildProfileRequestUrl(username) {
  const input = encodeURIComponent(JSON.stringify({
    0: { json: username }
  }));
  return `${PROFILE_API_BASE}?batch=1&input=${input}`;
}

function normalizeEquips(rawEquips) {
  const equips = [];
  for (const equip of rawEquips) {
    if (typeof equip?.id !== 'string') continue;
    const gameId = parseFiniteNumber(equip.gameId, NaN);
    if (!Number.isFinite(gameId)) continue;
    const tier = clamp(parseFiniteNumber(equip.tier, 1), 1, 5);
    const stat = VALID_EQUIP_STATS.has(equip.stat) ? equip.stat : DEFAULT_EQUIP_STAT;
    equips.push({
      id: equip.id,
      gameId,
      stat,
      tier
    });
  }
  return equips;
}

function normalizeMonsters(rawMonsters, validEquipIds) {
  const monsters = [];

  for (const monster of rawMonsters) {
    if (typeof monster?.id !== 'string') continue;
    const gameId = parseFiniteNumber(monster.gameId, NaN);
    if (!Number.isFinite(gameId)) continue;

    const normalized = {
      id: monster.id,
      gameId,
      hp: parseFiniteNumber(monster.hp, DEFAULT_MONSTER_STAT),
      ad: parseFiniteNumber(monster.ad, DEFAULT_MONSTER_STAT),
      ap: parseFiniteNumber(monster.ap, DEFAULT_MONSTER_STAT),
      armor: parseFiniteNumber(monster.armor, DEFAULT_MONSTER_STAT),
      magicResist: parseFiniteNumber(monster.magicResist, DEFAULT_MONSTER_STAT),
      exp: parseFiniteNumber(monster.exp, DEFAULT_MONSTER_EXP),
      tier: parseFiniteNumber(monster.tier, 1),
      locked: Boolean(monster.locked),
      createdAt: parseFiniteNumber(monster.createdAt, Date.now())
    };

    if (typeof monster.equipId === 'string' && validEquipIds.has(monster.equipId)) {
      normalized.equipId = monster.equipId;
    }

    monsters.push(normalized);
  }

  return monsters;
}

function normalizeProfileArsenal(profile) {
  const equips = normalizeEquips(Array.isArray(profile?.equips) ? profile.equips : []);
  const equipIdSet = new Set(equips.map((equip) => equip.id));
  const monstersInput = Array.isArray(profile?.monsters) ? profile.monsters : [];
  const monsters = normalizeMonsters(monstersInput, equipIdSet);

  return {
    profileName: String(profile?.name || '').trim(),
    monsters,
    equips
  };
}

// =======================
// 2.5 Help Board — Firebase & replay helpers
// =======================
function getCurrentPlayerName() {
  try {
    const playerState = globalThis.state?.player?.getSnapshot?.()?.context;
    if (playerState?.name) return String(playerState.name).trim();
    if (window.gameState?.player?.name) return String(window.gameState.player.name).trim();
  } catch (_) { /* ignore */ }
  return '';
}

async function hashUsername(username) {
  const encoder = new TextEncoder();
  const data = encoder.encode(String(username || '').toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function createClientId() {
  return `bh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const BattleHelpFirebase = {
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
      console.warn(`[Battle Helper] ${errorContext}:`, error);
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

  async post(path, data, errorContext) {
    const response = await fetch(`${path}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await this.handleResponse(response, errorContext);
  },

  async patch(path, data, errorContext) {
    const response = await fetch(`${path}.json`, {
      method: 'PATCH',
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

function toMapKey(mapName) {
  return `map_${String(mapName || '').toLowerCase().replace(/\s+/g, '_')}`;
}

function getRoomDisplayName(roomId) {
  const id = String(roomId || '').trim();
  if (!id) return '';
  try {
    const roomNames = globalThis.state?.utils?.ROOM_NAME;
    if (roomNames && typeof roomNames === 'object' && roomNames[id]) {
      return String(roomNames[id]).trim();
    }
  } catch (_) { /* ignore */ }
  try {
    const room = globalThis.mapsDatabase?.getMapById?.(id);
    if (room?.name) return String(room.name).trim();
  } catch (_) { /* ignore */ }
  return id;
}

function getRoomRegionId(roomId, room = null) {
  if (room?.region != null && room.region !== '') return room.region;
  try {
    const regions = globalThis.state?.utils?.REGIONS;
    if (Array.isArray(regions)) {
      for (const region of regions) {
        if (!Array.isArray(region?.rooms)) continue;
        if (region.rooms.some((r) => r?.id === roomId)) return region.id;
      }
    }
  } catch (_) { /* ignore */ }
  return '';
}

function getMapThumbnailUrl(roomId) {
  const id = String(roomId || '').trim();
  if (!id) return '';
  return `/assets/room-thumbnails/${id}.png`;
}

function createMapThumbnailImg(roomId, sizePx = 18) {
  const img = document.createElement('img');
  img.src = getMapThumbnailUrl(roomId);
  img.alt = '';
  img.className = 'pixelated';
  img.draggable = false;
  const px = `${sizePx}px`;
  img.style.cssText = `width: ${px}; height: ${px}; object-fit: cover; flex-shrink: 0; image-rendering: pixelated;`;
  img.onerror = () => { img.style.visibility = 'hidden'; };
  return img;
}

function createMapIconPlaceholder(sizePx = 80) {
  const box = document.createElement('div');
  const boxPx = `${sizePx}px`;
  box.style.cssText = `width: ${boxPx}; height: ${boxPx}; background: rgba(68, 68, 68, 0.5); border: 1px solid #555; border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;`;

  const icon = document.createElement('img');
  icon.src = 'https://bestiaryarena.com/assets/icons/minotaurstatue.png';
  icon.alt = '';
  icon.className = 'pixelated';
  icon.draggable = false;
  const iconPx = `${Math.round(sizePx * 0.625)}px`;
  icon.style.cssText = `width: ${iconPx}; height: ${iconPx}; object-fit: contain; opacity: 0.7;`;
  box.appendChild(icon);

  return box;
}

function normalizeRoomList(rawMaps) {
  if (Array.isArray(rawMaps)) return rawMaps.filter((m) => m && m.id);
  if (rawMaps && typeof rawMaps === 'object') {
    return Object.values(rawMaps).filter((m) => m && typeof m === 'object' && m.id);
  }
  return [];
}

function getPlayerUnlockedRooms() {
  try {
    const rooms = globalThis.state?.player?.getSnapshot?.()?.context?.rooms;
    if (rooms && typeof rooms === 'object') return rooms;
  } catch (_) { /* ignore */ }
  return {};
}

function isPlayerRoomUnlocked(roomId) {
  const id = String(roomId || '').trim();
  if (!id) return false;
  const rooms = getPlayerUnlockedRooms();
  return Object.prototype.hasOwnProperty.call(rooms, id) && rooms[id] !== undefined;
}

function getHelpMapOptions() {
  let maps = [];
  try {
    maps = normalizeRoomList(globalThis.mapsDatabase?.getNonRaidMaps?.() || []);
  } catch (_) { /* ignore */ }
  if (maps.length === 0) {
    try {
      maps = normalizeRoomList(globalThis.state?.utils?.ROOMS || []);
      maps = maps.filter((m) => m && !m.raid);
    } catch (_) {
      maps = [];
    }
  }

  const compare = globalThis.mapsDatabase?.compareMapsByGameOrder?.bind(globalThis.mapsDatabase)
    || ((a, b) => String(a).localeCompare(String(b)));

  const options = maps
    .filter((m) => m && m.id && isPlayerRoomUnlocked(m.id))
    .map((m) => {
      const id = String(m.id);
      const name = getRoomDisplayName(id) || String(m.name || id).trim();
      const regionId = getRoomRegionId(id, m);
      let regionName = '';
      try {
        if (regionId !== '' && regionId != null && globalThis.mapsDatabase?.getRegionDisplayName) {
          regionName = globalThis.mapsDatabase.getRegionDisplayName(regionId) || '';
        }
      } catch (_) { /* ignore */ }
      return {
        id,
        name,
        regionId: regionId == null ? '' : String(regionId),
        regionName,
        mapKey: toMapKey(name),
        thumbnailUrl: getMapThumbnailUrl(id)
      };
    });

  options.sort((a, b) => {
    const byGame = compare(a.id, b.id);
    if (byGame !== 0) return byGame;
    return a.name.localeCompare(b.name);
  });
  return options;
}

function createMapPicker(mapOptions, initialMapKey = '') {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: row; gap: 4px; align-items: center; width: 100%; box-sizing: border-box;';

  const iconSlot = document.createElement('div');
  iconSlot.style.cssText = 'width: 50px; height: 50px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;';

  const select = createFieldSelect([
    { value: '', label: t('mods.battleHelper.help.mapPlaceholder') },
    ...mapOptions.map((m) => ({
      value: m.mapKey,
      label: m.regionName ? `${m.name} (${m.regionName})` : m.name
    }))
  ], initialMapKey);
  select.style.flex = '1 1 auto';
  select.style.minWidth = '0';

  function syncIcon() {
    iconSlot.textContent = '';
    const selected = mapOptions.find((m) => m.mapKey === select.value);
    if (!selected?.id) return;
    iconSlot.appendChild(createMapThumbnailImg(selected.id, 46));
  }

  select.addEventListener('change', syncIcon);
  syncIcon();

  wrap.appendChild(iconSlot);
  wrap.appendChild(select);
  wrap.getValue = () => select.value;
  wrap.setValue = (value) => {
    select.value = value || '';
    syncIcon();
  };
  wrap.selectElement = select;
  return wrap;
}

function getCurrentRoomId() {
  try {
    return globalThis.state?.board?.getSnapshot?.()?.context?.selectedMap?.selectedRoom?.id
      || globalThis.state?.selectedMap?.selectedRoom?.id
      || null;
  } catch (_) {
    return null;
  }
}

function getCurrentBoardFloor() {
  try {
    const floor = globalThis.state?.board?.getSnapshot?.()?.context?.floor;
    const value = Number(floor);
    return Number.isFinite(value) ? Math.trunc(value) : null;
  } catch (_) {
    return null;
  }
}

function navigateToRoomId(roomId) {
  const target = String(roomId || '').trim();
  if (!target) return false;
  try {
    const current = getCurrentRoomId();
    if (current && String(current) === target) return true;
    globalThis.state?.board?.send?.({
      type: 'selectRoomById',
      roomId: target
    });
    return true;
  } catch (error) {
    console.warn('[Battle Helper] navigateToRoomId:', error);
    return false;
  }
}

function setBoardFloor(floor) {
  const target = Math.trunc(Number(floor));
  if (!Number.isFinite(target)) return false;
  const clamped = Math.max(0, Math.min(15, target));
  try {
    globalThis.state?.board?.trigger?.setState?.({
      fn: (prev) => ({ ...prev, floor: clamped })
    });
    return true;
  } catch (error) {
    console.warn('[Battle Helper] setBoardFloor:', error);
    return false;
  }
}

function reloadCurrentMap() {
  const roomId = getCurrentRoomId();
  if (!roomId) return false;
  const floor = getCurrentBoardFloor();
  try {
    globalThis.state?.board?.send?.({
      type: 'selectRoomById',
      roomId: String(roomId)
    });
    if (floor !== null) {
      scheduleBattleHelperTimeout(() => setBoardFloor(floor), 80);
    }
    return true;
  } catch (error) {
    console.warn('[Battle Helper] reloadCurrentMap:', error);
    return false;
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Navigate to the request map; set floor from goal (floor target, else floor 0 for ticks/rank). */
async function navigateToHelpRequest(request) {
  const roomId = resolveRoomIdForRequest(request);
  if (!roomId) return false;

  const alreadyOnMap = (() => {
    const current = getCurrentRoomId();
    return !!(current && String(current) === String(roomId));
  })();

  const navigated = navigateToRoomId(roomId);
  if (!navigated) return false;

  // Wait for room change to settle before applying floor (same pattern as other mods).
  await sleepMs(alreadyOnMap ? 80 : 350);

  if (request?.goalType === 'floor' && request.goalValue != null) {
    const floor = Number(request.goalValue);
    if (Number.isFinite(floor) && floor >= 1 && floor <= 15) {
      setBoardFloor(floor);
      return true;
    }
  }

  // Ticks / rank (and invalid floor targets): always use floor 0
  setBoardFloor(0);
  return true;
}

function resolveRoomIdForRequest(request) {
  if (!request) return null;
  const stored = String(request.roomId || '').trim();
  if (stored) return stored;
  const options = getHelpMapOptions();
  const hit = options.find((m) =>
    (request.mapKey && m.mapKey === request.mapKey)
    || (request.mapName && m.name === request.mapName)
  );
  return hit?.id || null;
}

function getHelpMapContextForRequest(request) {
  const roomId = resolveRoomIdForRequest(request);
  const mapLabel = roomId
    ? (getRoomDisplayName(roomId) || request?.mapName || '')
    : String(request?.mapName || '');
  return { roomId, mapLabel };
}

function findMapOptionForCurrentRoom(mapOptions = getHelpMapOptions()) {
  const roomId = getCurrentRoomId();
  if (!roomId) return null;
  return mapOptions.find((m) => String(m.id) === String(roomId)) || null;
}

/** True when the player is on the map the help request is for. */
function isOnHelpRequestMap(request) {
  if (!request) return false;
  const expectedRoomId = resolveRoomIdForRequest(request);
  const currentRoomId = getCurrentRoomId();
  if (expectedRoomId && currentRoomId) {
    return String(currentRoomId) === String(expectedRoomId);
  }
  const current = findMapOptionForCurrentRoom();
  if (!current) return false;
  if (request.mapKey && current.mapKey) {
    return request.mapKey === current.mapKey;
  }
  if (request.mapName && current.name) {
    return request.mapName === current.name;
  }
  return false;
}

function isOnSessionHelpMap() {
  const expectedRoomId = String(sessionState.helpRoomId || '').trim();
  if (!expectedRoomId) return false;
  const currentRoomId = getCurrentRoomId();
  return !!(currentRoomId && String(currentRoomId) === expectedRoomId);
}

function resolveHelpRequestForPublishGate(requestId) {
  const id = String(requestId || '').trim();
  if (!id) return null;
  return helpBoardState.requests.find((r) => r.id === id) || null;
}

function canPublishHelpSetupForRequest(request) {
  return Boolean(request) && hasCreaturesOnBoard() && isOnHelpRequestMap(request);
}

function formatHelpGoalLabel(goalType, goalValue) {
  const typeLabel = t(`mods.battleHelper.help.goalTypes.${goalType}`) || goalType;
  if (goalValue != null && goalValue !== '' && Number.isFinite(Number(goalValue))) {
    if (goalType === 'rank') {
      return `S+${Number(goalValue)}`;
    }
    return `${typeLabel}: ${goalValue}`;
  }
  return typeLabel;
}

function getRoomMaxTeamSize(roomId) {
  try {
    const id = String(roomId || '').trim();
    if (!id || !globalThis.state?.utils?.ROOMS) return 5;
    const rooms = globalThis.state.utils.ROOMS;
    const roomData = rooms.find((room) =>
      room.id === id
      || room.id === Number(id)
      || String(room.id) === id
    );
    if (roomData && typeof roomData.maxTeamSize === 'number' && roomData.maxTeamSize > 0) {
      return roomData.maxTeamSize;
    }
  } catch (_) { /* ignore */ }
  return 5;
}

/** Max S+# for a map — same formula as Better Highscores: (2 * maxTeamSize) - 1. */
function getMapMaxSPlusRank(roomId) {
  const maxTeamSize = getRoomMaxTeamSize(roomId);
  return Math.max(1, (2 * maxTeamSize) - 1);
}

function getHelpGoalValueBounds(goalType, roomId) {
  if (goalType === 'floor') {
    return { min: 1, max: 15 };
  }
  if (goalType === 'rank') {
    return { min: 1, max: getMapMaxSPlusRank(roomId) };
  }
  // ticks: required ≥ 1, max speedrun timeout
  return { min: 1, max: BATTLE_HELP_MAX_TICKS };
}

function helpFormFieldError(field, message) {
  const error = new Error(message);
  error.helpField = field;
  return error;
}

function clampHelpGoalValue(goalType, goalValueRaw, roomId) {
  const raw = String(goalValueRaw ?? '').trim();
  if (!raw) return '';
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return raw;
  const { min, max } = getHelpGoalValueBounds(goalType, roomId);
  let value = Math.trunc(parsed);
  if (Number.isFinite(min)) value = Math.max(min, value);
  if (Number.isFinite(max)) value = Math.min(max, value);
  return String(value);
}

function validateHelpGoalValue(goalType, goalValueRaw, roomId) {
  const raw = String(goalValueRaw ?? '').trim();
  if (!raw) {
    throw helpFormFieldError('goalValue', t('mods.battleHelper.help.errors.goalValueRequired'));
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw helpFormFieldError('goalValue', t('mods.battleHelper.help.errors.goalValueInvalid'));
  }

  if (goalType === 'ticks') {
    if (value < 1 || value > BATTLE_HELP_MAX_TICKS) {
      throw helpFormFieldError('goalValue', tReplace('mods.battleHelper.help.errors.ticksRange', {
        max: String(BATTLE_HELP_MAX_TICKS)
      }));
    }
    return value;
  }

  if (goalType === 'floor') {
    if (value < 1 || value > 15) {
      throw helpFormFieldError('goalValue', t('mods.battleHelper.help.errors.floorRange'));
    }
    return value;
  }

  if (goalType === 'rank') {
    const maxRank = getMapMaxSPlusRank(roomId);
    if (value < 1 || value > maxRank) {
      throw helpFormFieldError('goalValue', tReplace('mods.battleHelper.help.errors.rankRange', {
        max: String(maxRank)
      }));
    }
    return value;
  }

  throw helpFormFieldError('goalType', t('mods.battleHelper.help.errors.goalRequired'));
}

function getHelpGoalValuePlaceholder(goalType, roomId) {
  if (goalType === 'rank') {
    const maxRank = getMapMaxSPlusRank(roomId);
    return tReplace('mods.battleHelper.help.goalValuePlaceholderRank', {
      max: String(maxRank)
    });
  }
  if (goalType === 'floor') {
    return t('mods.battleHelper.help.goalValuePlaceholderFloor');
  }
  return tReplace('mods.battleHelper.help.goalValuePlaceholderTicks', {
    max: String(BATTLE_HELP_MAX_TICKS)
  });
}

function sanitizeHelpNote(note) {
  return String(note || '').replace(/\s+/g, ' ').trim().slice(0, BATTLE_HELP_NOTE_MAX_LENGTH);
}

function validateHelpNote(noteRaw) {
  const raw = String(noteRaw ?? '');
  if (raw.length > BATTLE_HELP_NOTE_MAX_LENGTH) {
    throw helpFormFieldError('note', tReplace('mods.battleHelper.help.errors.noteTooLong', {
      max: String(BATTLE_HELP_NOTE_MAX_LENGTH)
    }));
  }
  return sanitizeHelpNote(raw);
}

function formatHelpAge(createdAt) {
  const ms = Date.now() - Number(createdAt || 0);
  if (!Number.isFinite(ms) || ms < 0) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return t('mods.battleHelper.help.ageJustNow');
  if (minutes < 60) return tReplace('mods.battleHelper.help.ageMinutes', { n: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return tReplace('mods.battleHelper.help.ageHours', { n: String(hours) });
  const days = Math.floor(hours / 24);
  return tReplace('mods.battleHelper.help.ageDays', { n: String(days) });
}

function getHelpRequestExpiresAt(request) {
  const createdAt = Number(request?.createdAt || 0);
  const ttlExpiry = Number.isFinite(createdAt) && createdAt > 0
    ? createdAt + BATTLE_HELP_REQUEST_TTL_MS
    : 0;
  const explicit = Number(request?.expiresAt || 0);
  if (Number.isFinite(explicit) && explicit > 0) {
    if (ttlExpiry > 0) return Math.min(explicit, ttlExpiry);
    return explicit;
  }
  return ttlExpiry;
}

function isHelpRequestOpen(request) {
  if (!request || request.status !== 'open') return false;
  const expiresAt = getHelpRequestExpiresAt(request);
  if (expiresAt > 0 && expiresAt < Date.now()) return false;
  return true;
}

function normalizeHelpRequest(id, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const goalType = BATTLE_HELP_GOAL_TYPES.includes(raw.goalType) ? raw.goalType : 'ticks';
  const goalRaw = raw.goalValue;
  const goalValue = goalRaw === null || goalRaw === undefined || goalRaw === ''
    ? null
    : Number(goalRaw);
  return {
    id,
    requesterName: String(raw.requesterName || '').trim(),
    requesterHash: String(raw.requesterHash || '').trim(),
    roomId: String(raw.roomId || '').trim(),
    mapKey: String(raw.mapKey || '').trim(),
    mapName: String(raw.mapName || '').trim(),
    regionName: String(raw.regionName || '').trim(),
    goalType,
    goalValue: Number.isFinite(goalValue) ? goalValue : null,
    note: sanitizeHelpNote(raw.note),
    createdAt: Number(raw.createdAt) || 0,
    expiresAt: Number(raw.expiresAt) || 0,
    status: raw.status === 'closed' ? 'closed' : 'open',
    replies: raw.replies && typeof raw.replies === 'object' ? raw.replies : {}
  };
}

function getHelpRepliesList(request) {
  if (!request?.replies || typeof request.replies !== 'object') return [];
  return Object.entries(request.replies)
    .map(([id, reply]) => ({
      id,
      helperName: String(reply?.helperName || '').trim(),
      replayLink: String(reply?.replayLink || '').trim(),
      note: sanitizeHelpNote(reply?.note),
      createdAt: Number(reply?.createdAt) || 0
    }))
    .filter((r) => r.replayLink)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function hasCurrentPlayerHelpedRequest(request) {
  const me = getCurrentPlayerName();
  if (!me) return false;
  const meLower = me.toLowerCase();
  return getHelpRepliesList(request).some(
    (reply) => reply.helperName.toLowerCase() === meLower
  );
}

/** Open requests the current player has not published a setup for (button badge). */
function countUnhelpedOpenRequests(requests) {
  if (!Array.isArray(requests)) return 0;
  return requests.filter((request) => !hasCurrentPlayerHelpedRequest(request)).length;
}

async function fetchHelpRequests() {
  const data = await BattleHelpFirebase.get(
    BATTLE_HELP_REQUESTS_PATH,
    'load help requests',
    {}
  );
  if (!data || typeof data !== 'object') return [];

  const requests = [];
  for (const [id, raw] of Object.entries(data)) {
    const normalized = normalizeHelpRequest(id, raw);
    if (!normalized) continue;
    if (!isHelpRequestOpen(normalized)) {
      // Closed or expired requests are deleted so Firebase does not keep growing.
      await deleteStaleHelpRequest(id);
      continue;
    }
    requests.push(normalized);
  }

  requests.sort((a, b) => b.createdAt - a.createdAt);
  return requests;
}

async function createHelpRequest({ mapName, mapKey, regionName, roomId, goalType, goalValue, note }) {
  const requesterName = getCurrentPlayerName();
  if (!requesterName) {
    throw new Error(t('mods.battleHelper.help.errors.playerNameRequired'));
  }
  if (!mapName || !mapKey) {
    throw new Error(t('mods.battleHelper.help.errors.mapRequired'));
  }
  if (!BATTLE_HELP_GOAL_TYPES.includes(goalType)) {
    throw new Error(t('mods.battleHelper.help.errors.goalRequired'));
  }

  const existing = await fetchHelpRequests();
  const myNameLower = requesterName.toLowerCase();
  const myOpen = existing.filter(
    (r) => r.requesterName.toLowerCase() === myNameLower
  );
  if (myOpen.length >= BATTLE_HELP_MAX_OPEN_PER_USER) {
    throw new Error(tReplace('mods.battleHelper.help.errors.tooManyOpen', {
      max: String(BATTLE_HELP_MAX_OPEN_PER_USER)
    }));
  }

  const resolvedRoomId = String(roomId || '').trim() || getCurrentRoomId() || '';
  const safeGoalValue = validateHelpGoalValue(goalType, goalValue, resolvedRoomId);

  const duplicate = myOpen.find((r) => {
    const sameMap = (resolvedRoomId && r.roomId && String(r.roomId) === resolvedRoomId)
      || (r.mapKey && r.mapKey === mapKey)
      || (r.mapName && r.mapName === mapName);
    return sameMap && r.goalType === goalType;
  });
  if (duplicate) {
    throw new Error(t('mods.battleHelper.help.errors.duplicateRequest'));
  }

  const now = Date.now();
  const requesterHash = await hashUsername(requesterName);
  const payload = {
    requesterName,
    requesterHash,
    roomId: resolvedRoomId,
    mapKey,
    mapName,
    regionName: regionName || '',
    goalType,
    goalValue: safeGoalValue,
    note: sanitizeHelpNote(note),
    createdAt: now,
    expiresAt: now + BATTLE_HELP_REQUEST_TTL_MS,
    status: 'open',
    replies: {}
  };

  const result = await BattleHelpFirebase.post(
    BATTLE_HELP_REQUESTS_PATH,
    payload,
    'create help request'
  );
  return result?.name || null;
}

async function closeHelpRequest(requestId) {
  if (!requestId) return;
  await BattleHelpFirebase.delete(
    `${BATTLE_HELP_REQUESTS_PATH}/${requestId}`,
    'delete help request'
  );
}

async function deleteStaleHelpRequest(requestId) {
  if (!requestId) return;
  try {
    await BattleHelpFirebase.delete(
      `${BATTLE_HELP_REQUESTS_PATH}/${requestId}`,
      'delete stale help request'
    );
  } catch (_) { /* ignore cleanup failures */ }
}

async function deleteHelpReply(requestId, replyId, helperName) {
  const me = getCurrentPlayerName();
  if (!me) {
    throw new Error(t('mods.battleHelper.help.errors.playerNameRequired'));
  }
  if (!requestId || !replyId) {
    throw new Error(t('mods.battleHelper.help.errors.selectRequestFirst'));
  }
  if (String(helperName || '').trim().toLowerCase() !== me.toLowerCase()) {
    throw new Error(t('mods.battleHelper.help.errors.onlyOwnReplyRemove'));
  }
  await BattleHelpFirebase.delete(
    `${BATTLE_HELP_REQUESTS_PATH}/${requestId}/replies/${replyId}`,
    'delete help reply'
  );
}

function hasCreaturesOnBoard() {
  try {
    const boardConfig = globalThis.state?.board?.getSnapshot?.()?.context?.boardConfig;
    if (!Array.isArray(boardConfig)) return false;
    return boardConfig.some((piece) =>
      piece?.type === 'player' || (piece?.type === 'custom' && piece?.villain === false)
    );
  } catch (_) {
    return false;
  }
}

function getBoardReplayString() {
  try {
    let boardJson = null;
    if (typeof window.$serializeBoard === 'function') {
      try { boardJson = JSON.parse(window.$serializeBoard()); } catch (_) { /* ignore */ }
    }
    if (!boardJson && window.BestiaryModAPI?.utility?.serializeBoard) {
      try {
        boardJson = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
      } catch (_) { /* ignore */ }
    }
    if (!boardJson?.board || !Array.isArray(boardJson.board) || boardJson.board.length === 0) {
      return '';
    }

    const replayData = {};
    if (boardJson.region) replayData.region = boardJson.region;
    replayData.map = boardJson.map || '';
    replayData.floor = boardJson.floor !== undefined && boardJson.floor !== null ? boardJson.floor : 0;
    replayData.board = boardJson.board;
    // Help replies intentionally omit seed so pasting loads the setup without locking a seed.
    return `$replay(${JSON.stringify(replayData)})`;
  } catch (error) {
    console.warn('[Battle Helper] getBoardReplayString:', error);
    return '';
  }
}

function parseReplayLinkJson(replayLink, { requireBoard = false } = {}) {
  const raw = String(replayLink || '').trim();
  if (!raw) return null;
  try {
    const match = raw.match(/^\$replay\((\{.*\})\)$/s);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    if (!data || typeof data !== 'object') return null;
    if (requireBoard && (!Array.isArray(data.board) || data.board.length === 0)) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function stripSeedFromReplayLink(replayLink) {
  const data = parseReplayLinkJson(replayLink);
  if (!data) return String(replayLink || '').trim();
  delete data.seed;
  return `$replay(${JSON.stringify(data)})`;
}

function parseReplayLinkToBoardData(replayLink) {
  const data = parseReplayLinkJson(replayLink, { requireBoard: true });
  if (!data) return null;
  delete data.seed;
  return data;
}

function applyHelpReplySetup(replayLink) {
  const boardData = parseReplayLinkToBoardData(replayLink);
  if (!boardData) return false;
  try {
    if (typeof window.$configureBoard === 'function') {
      return window.$configureBoard(boardData) !== false;
    }
    if (window.BestiaryModAPI?.utility?.configureBoard) {
      window.BestiaryModAPI.utility.configureBoard(boardData);
      return true;
    }
  } catch (error) {
    console.warn('[Battle Helper] applyHelpReplySetup:', error);
  }
  return false;
}

/** Stable replay fingerprint for duplicate detection (ignores seed / key order noise). */
function normalizeReplayForCompare(replayLink) {
  const data = parseReplayLinkJson(stripSeedFromReplayLink(replayLink));
  if (!data) return stripSeedFromReplayLink(replayLink);
  return `$replay(${JSON.stringify({
    region: data.region || undefined,
    map: String(data.map || ''),
    floor: data.floor !== undefined && data.floor !== null ? data.floor : 0,
    board: Array.isArray(data.board) ? data.board : []
  })})`;
}

async function fetchHelpRequestById(requestId) {
  const id = String(requestId || '').trim();
  if (!id) return null;
  const raw = await BattleHelpFirebase.get(
    `${BATTLE_HELP_REQUESTS_PATH}/${id}`,
    'load help request',
    null
  );
  if (!raw || typeof raw !== 'object') return null;
  return normalizeHelpRequest(id, raw);
}

function findDuplicateHelpReply(request, replayLink) {
  const fingerprint = normalizeReplayForCompare(replayLink);
  if (!fingerprint) return null;
  return getHelpRepliesList(request).find(
    (reply) => normalizeReplayForCompare(reply.replayLink) === fingerprint
  ) || null;
}

async function publishHelpReply(requestId, note = '') {
  const helperName = getCurrentPlayerName();
  if (!helperName) {
    throw new Error(t('mods.battleHelper.help.errors.playerNameRequired'));
  }
  if (!requestId) {
    throw new Error(t('mods.battleHelper.help.errors.selectRequestFirst'));
  }

  const replayLink = getBoardReplayString();
  if (!replayLink) {
    throw new Error(t('mods.battleHelper.help.errors.noBoardSetup'));
  }

  let request = await fetchHelpRequestById(requestId);
  if (!request) {
    request = helpBoardState.requests.find((r) => r.id === requestId) || null;
  }
  if (!request) {
    throw new Error(t('mods.battleHelper.help.errors.selectRequestFirst'));
  }

  if (!isOnHelpRequestMap(request)) {
    const { mapLabel } = getHelpMapContextForRequest(request);
    throw new Error(tReplace('mods.battleHelper.help.errors.wrongMap', {
      map: mapLabel || request.mapName || t('mods.battleHelper.unknown')
    }));
  }

  const duplicate = findDuplicateHelpReply(request, replayLink);
  if (duplicate) {
    throw new Error(t('mods.battleHelper.help.errors.duplicateSetup'));
  }

  const helperNameLower = helperName.toLowerCase();
  const myReplyCount = getHelpRepliesList(request).filter(
    (reply) => reply.helperName.toLowerCase() === helperNameLower
  ).length;
  if (myReplyCount >= BATTLE_HELP_MAX_REPLIES_PER_USER) {
    throw new Error(tReplace('mods.battleHelper.help.errors.tooManyReplies', {
      max: String(BATTLE_HELP_MAX_REPLIES_PER_USER)
    }));
  }

  const replyId = createClientId();
  const reply = {
    helperName,
    replayLink,
    note: sanitizeHelpNote(note),
    createdAt: Date.now()
  };

  await BattleHelpFirebase.put(
    `${BATTLE_HELP_REQUESTS_PATH}/${requestId}/replies/${replyId}`,
    reply,
    'publish help reply'
  );
  return reply;
}

// =======================
// 3. State & Session Backup
// =======================
const sessionState = {
  backup: null,
  lastProfileRaw: null,
  lastNormalized: null,
  lastUsername: '',
  replaced: false,
  helpMapName: '',
  helpRequestId: '',
  helpRoomId: ''
};
const helpBoardState = {
  selectedId: null,
  requests: [],
  openCount: 0
};
let activeBattleHelperModal = null;
let battleHelperModalLayoutCleanup = null;
let battleHelperPersistentToastHandle = null;
let battleHelperPublishToastHandle = null;
let battleHelperPublishToastBtn = null;
let battleHelperPublishToastResetTimer = null;
let battleHelperModalPublishBtn = null;
let battleHelperModalPublishBaseDisabled = true;
let battleHelperPublishBoardUnsub = null;
let battleHelpButtonPollTimer = null;
let helpRequestActivateSeq = 0;
let helpViewSetupSeq = 0;
let clearHelpSelectionRef = null;
const battleHelperPendingTimers = new Set();

function scheduleBattleHelperTimeout(fn, ms) {
  const id = setTimeout(() => {
    battleHelperPendingTimers.delete(id);
    fn();
  }, ms);
  battleHelperPendingTimers.add(id);
  return id;
}

function clearBattleHelperPendingTimers() {
  battleHelperPendingTimers.forEach((id) => clearTimeout(id));
  battleHelperPendingTimers.clear();
}

function abortHelpBoardInFlightOperations() {
  helpRequestActivateSeq += 1;
  helpViewSetupSeq += 1;
}

function removeBattleHelperToastContainer() {
  try {
    document.getElementById(BATTLE_HELPER_TOAST_CONTAINER_ID)?.remove();
  } catch (_) { /* ignore */ }
}

function syncPublishSetupButtons() {
  const hasCreatures = hasCreaturesOnBoard();
  const toastRequest = resolveHelpRequestForPublishGate(
    sessionState.helpRequestId || helpBoardState.selectedId
  );
  const toastOnMap = toastRequest
    ? isOnHelpRequestMap(toastRequest)
    : (sessionState.helpRequestId ? isOnSessionHelpMap() : false);
  const modalRequest = resolveHelpRequestForPublishGate(helpBoardState.selectedId);
  const modalAllowed = canPublishHelpSetupForRequest(modalRequest);

  if (battleHelperPublishToastBtn) {
    const busy = battleHelperPublishToastBtn.dataset.busy === '1';
    if (!busy) {
      battleHelperPublishToastBtn.disabled = !(hasCreatures && toastOnMap);
    }
  }
  if (battleHelperModalPublishBtn) {
    battleHelperModalPublishBtn.disabled = battleHelperModalPublishBaseDisabled || !modalAllowed;
  }
}

function startPublishSetupBoardWatch() {
  if (!battleHelperPublishBoardUnsub) {
    try {
      // board.subscribe() may return a bare function OR an { unsubscribe } object —
      // store whatever it returns (the old code discarded the { unsubscribe } case,
      // leaking the subscription).
      const unsub = globalThis.state?.board?.subscribe?.(() => {
        syncPublishSetupButtons();
      });
      if (typeof unsub === 'function' || (unsub && typeof unsub.unsubscribe === 'function')) {
        battleHelperPublishBoardUnsub = unsub;
      }
    } catch (error) {
      console.warn('[Battle Helper] board subscribe for publish gate:', error);
    }
  }
  syncPublishSetupButtons();
}

function stopPublishSetupBoardWatchIfIdle() {
  if (battleHelperPublishToastBtn || battleHelperModalPublishBtn) return;
  if (battleHelperPublishBoardUnsub) {
    try {
      if (typeof battleHelperPublishBoardUnsub === 'function') battleHelperPublishBoardUnsub();
      else if (typeof battleHelperPublishBoardUnsub.unsubscribe === 'function') battleHelperPublishBoardUnsub.unsubscribe();
    } catch (_) { /* ignore */ }
  }
  battleHelperPublishBoardUnsub = null;
}

function clearModalPublishSetupButton() {
  battleHelperModalPublishBtn = null;
  battleHelperModalPublishBaseDisabled = true;
  stopPublishSetupBoardWatchIfIdle();
}

function getPlayerContext() {
  const ctx = globalThis.state?.player?.getSnapshot?.()?.context;
  if (!ctx) {
    throw new Error(t('mods.battleHelper.errors.playerStateUnavailable'));
  }
  return ctx;
}

function makePlayerBackup() {
  const player = getPlayerContext();
  return {
    monsters: JSON.parse(JSON.stringify(Array.isArray(player.monsters) ? player.monsters : [])),
    equips: JSON.parse(JSON.stringify(Array.isArray(player.equips) ? player.equips : []))
  };
}

// =======================
// 4. API Layer
// =======================
let lastProfileFetchStartedAt = 0;
let profileFetchSlot = Promise.resolve();

let profileFetchSeq = 0;

function scheduleProfileFetch(task) {
  const fetchId = ++profileFetchSeq;
  const caller = (new Error().stack || '').split('\n').slice(2, 5).map((l) => l.trim()).join(' <- ');
  debugLog(`scheduleProfileFetch #${fetchId}: queued (caller: ${caller})`);
  const scheduled = profileFetchSlot.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, BATTLE_HELPER_FETCH_MIN_INTERVAL_MS - (now - lastProfileFetchStartedAt));
    if (waitMs > 0) {
      debugLog(`scheduleProfileFetch #${fetchId}: throttling ${waitMs}ms (min interval ${BATTLE_HELPER_FETCH_MIN_INTERVAL_MS}ms)`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
    lastProfileFetchStartedAt = Date.now();
    debugLog(`scheduleProfileFetch #${fetchId}: firing task`);
    return task(fetchId);
  });
  profileFetchSlot = scheduled.catch(() => {});
  return scheduled;
}

async function fetchProfileByUsername(username) {
  return scheduleProfileFetch(async (fetchId) => {
    const url = buildProfileRequestUrl(username);
    debugLog(`fetchProfileByUsername #${fetchId}: GET "${username}" ${url}`);
    const startedAt = Date.now();
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    debugLog(`fetchProfileByUsername #${fetchId}: HTTP ${response.status} in ${Date.now() - startedAt}ms`);
    if (!response.ok) {
      throw new Error(tReplace('mods.battleHelper.errors.profileRequestFailed', {
        status: String(response.status)
      }));
    }

    const payload = await response.json();
    const profile = payload?.[0]?.result?.data?.json ?? null;
    debugLog(`fetchProfileByUsername #${fetchId}: parsed`, profile
      ? { name: profile.name, monsters: profile.monsters?.length ?? 0, equips: profile.equips?.length ?? 0 }
      : null);
    if (!profile) {
      throw new Error(t('mods.battleHelper.errors.profileNotFound'));
    }
    return profile;
  });
}

// =======================
// 5. Transform Layer
// =======================
function validateNormalizedArsenal(normalized) {
  if (!Array.isArray(normalized.monsters) || normalized.monsters.length === 0) {
    throw new Error(t('mods.battleHelper.errors.noUsableCreatures'));
  }
  if (!Array.isArray(normalized.equips) || normalized.equips.length === 0) {
    throw new Error(t('mods.battleHelper.errors.noUsableEquipment'));
  }
}

// =======================
// 6. Apply/Restore State Actions
// =======================

/** True while another player's arsenal is loaded in place of the user's own. */
function isViewingForeignProfile() {
  return sessionState.replaced === true;
}

/** Let Depot Manager re-sync its grid layout once the original profile is back. */
function resumeDepotManagerAfterRestore() {
  try {
    if (typeof window !== 'undefined') {
      window.depotManager?.resumeAfterForeignProfile?.();
    }
  } catch (_) { /* ignore */ }
}

function applyArsenalReplacement(normalized, options = {}) {
  debugLog('applyArsenalReplacement:', {
    profileName: normalized.profileName,
    monsters: normalized.monsters?.length ?? 0,
    equips: normalized.equips?.length ?? 0,
    hadBackup: !!sessionState.backup,
    options
  });
  if (!sessionState.backup) {
    sessionState.backup = makePlayerBackup();
  }

  globalThis.state.player.send({
    type: 'setState',
    fn: (prev) => ({
      ...prev,
      monsters: normalized.monsters,
      equips: normalized.equips
    })
  });

  sessionState.lastNormalized = normalized;
  sessionState.replaced = true;
  sessionState.helpMapName = String(options.helpMapName || '').trim();
  sessionState.helpRequestId = String(options.helpRequestId || '').trim();
  sessionState.helpRoomId = String(options.helpRoomId || '').trim();
  syncBattleHelperButtonState();
  startBattleHelperViewingProfileToast(
    normalized.profileName,
    sessionState.lastUsername,
    { helpMapName: sessionState.helpMapName }
  );
  if (sessionState.helpRequestId && sessionState.helpMapName) {
    startBattleHelperPublishSetupToast();
  } else {
    stopBattleHelperPublishSetupToast();
  }
}

function restoreOriginalArsenal() {
  debugLog('restoreOriginalArsenal:', { hasBackup: !!sessionState.backup, replaced: sessionState.replaced });
  if (!sessionState.backup) {
    throw new Error(t('mods.battleHelper.errors.noBackupAvailable'));
  }

  globalThis.state.player.send({
    type: 'setState',
    fn: (prev) => ({
      ...prev,
      monsters: sessionState.backup.monsters,
      equips: sessionState.backup.equips
    })
  });

  sessionState.replaced = false;
  sessionState.helpMapName = '';
  sessionState.helpRequestId = '';
  sessionState.helpRoomId = '';
  resumeDepotManagerAfterRestore();
  abortHelpBoardInFlightOperations();
  if (typeof clearHelpSelectionRef === 'function') {
    clearHelpSelectionRef();
  }
  syncBattleHelperButtonState();
  stopBattleHelperViewingProfileToast();
  stopBattleHelperPublishSetupToast();
  showBattleHelperTransientToast(t('mods.battleHelper.toast.originalProfileRestored'));

  const roomId = getCurrentRoomId();
  if (roomId) {
    scheduleBattleHelperTimeout(() => reloadCurrentMap(), 150);
  }
}

// =======================
// 6.5 Toast
// =======================
function getBattleHelperToastContainer() {
  if (typeof document === 'undefined') return null;
  let container = document.getElementById(BATTLE_HELPER_TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = BATTLE_HELPER_TOAST_CONTAINER_ID;
    document.body.appendChild(container);
  }
  container.style.cssText = 'position: fixed; z-index: 10050; inset: 16px 16px 64px; pointer-events: none;';
  return container;
}

function updateBattleHelperToastPositions(container) {
  if (!container) return;
  const toasts = container.querySelectorAll('.battle-helper-toast-item');
  toasts.forEach((toast, index) => {
    toast.style.transform = `translateY(-${index * BATTLE_HELPER_TOAST_STACK_OFFSET_PX}px)`;
  });
}

function createBattleHelperToastFlexContainer(container, extraClass = '') {
  const stackOffset = container.querySelectorAll('.battle-helper-toast-item').length
    * BATTLE_HELPER_TOAST_STACK_OFFSET_PX;
  const flexContainer = document.createElement('div');
  flexContainer.className = `battle-helper-toast-item${extraClass ? ` ${extraClass}` : ''}`;
  flexContainer.style.cssText = `display: flex; position: absolute; transition: ${BATTLE_HELPER_TOAST_TRANSITION}; transform: translateY(-${stackOffset}px); bottom: 0px; left: 0px; right: 0px; justify-content: flex-end; pointer-events: none;`;
  return flexContainer;
}

function createBattleHelperToastChrome(options = {}) {
  const { role = 'status', interactive = false } = options;
  const toast = document.createElement('div');
  toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
  toast.setAttribute('role', role);
  if (interactive) {
    toast.style.pointerEvents = 'auto';
    toast.style.cursor = 'default';
  }
  const widgetTop = document.createElement('div');
  widgetTop.className = 'widget-top h-2.5';
  const widgetBottom = document.createElement('div');
  widgetBottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';
  toast.appendChild(widgetTop);
  toast.appendChild(widgetBottom);
  return { toast, widgetBottom };
}

function mountBattleHelperToast(flexContainer, container) {
  container.appendChild(flexContainer);
  updateBattleHelperToastPositions(container);
}

function showBattleHelperTransientToast(message, duration = 5000) {
  try {
    const container = getBattleHelperToastContainer();
    if (!container || !message) return;

    const flexContainer = createBattleHelperToastFlexContainer(container);
    const { toast, widgetBottom } = createBattleHelperToastChrome();

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.textContent = message;
    widgetBottom.appendChild(messageDiv);

    flexContainer.appendChild(toast);
    mountBattleHelperToast(flexContainer, container);

    scheduleBattleHelperTimeout(() => {
      if (flexContainer.parentNode) {
        flexContainer.parentNode.removeChild(flexContainer);
        updateBattleHelperToastPositions(container);
      }
    }, duration);
  } catch (error) {
    console.warn('[Battle Helper] showBattleHelperTransientToast:', error);
  }
}

function buildBattleHelperProfileUrl(username) {
  const slug = encodeURIComponent(normalizeUsername(username));
  return `${BATTLE_HELPER_PROFILE_URL_BASE}${slug}`;
}

/**
 * Clickable profile link → https://bestiaryarena.com/profile/{username}
 * @param {string} username
 * @param {{ text?: string, color?: string, cssText?: string, stopPropagation?: boolean }} [options]
 */
function createBattleHelperProfileLink(username, options = {}) {
  const displayName = formatProfileDisplayName(
    options.text != null ? options.text : username
  );
  const slug = normalizeUsername(username);
  if (!slug) {
    const span = document.createElement('span');
    span.textContent = displayName;
    if (options.color) span.style.color = options.color;
    return span;
  }

  const link = document.createElement('a');
  link.href = buildBattleHelperProfileUrl(slug);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = displayName;
  link.title = displayName;
  const color = options.color || '#ffe066';
  link.style.cssText = [
    `color: ${color}`,
    'text-decoration: underline',
    'pointer-events: auto',
    'cursor: pointer',
    options.cssText || ''
  ].filter(Boolean).join('; ');

  if (options.stopPropagation !== false) {
    link.addEventListener('click', (event) => {
      event.stopPropagation();
    });
  }
  return link;
}

/** Append locale string with `{name}` replaced by a profile link. */
function appendLocalizedTextWithProfileLink(parent, localeKey, username, options = {}) {
  const template = String(t(localeKey) || '');
  const parts = template.split('{name}');
  if (parts.length === 1) {
    parent.appendChild(document.createTextNode(template));
    parent.appendChild(createBattleHelperProfileLink(username, options));
    return;
  }
  parts.forEach((part, index) => {
    if (part) parent.appendChild(document.createTextNode(part));
    if (index < parts.length - 1) {
      parent.appendChild(createBattleHelperProfileLink(username, options));
    }
  });
}

function populateBattleHelperToastMessage(messageDiv, profileName, username, options = {}) {
  const displayName = formatProfileDisplayName(profileName || username);
  const profileSlug = normalizeUsername(username) || displayName;
  const helpMapName = String(options.helpMapName || '').trim();
  const isHelping = Boolean(helpMapName);

  messageDiv.textContent = '';

  const lead = document.createElement('span');
  lead.textContent = isHelping
    ? t('mods.battleHelper.toast.helpingLead')
    : t('mods.battleHelper.toast.viewingLead');

  const suffix = isHelping
    ? t('mods.battleHelper.toast.helpingNameSuffix')
    : t('mods.battleHelper.toast.viewingNameSuffix');
  const profileLink = createBattleHelperProfileLink(profileSlug, {
    text: `${displayName}${suffix}`,
    color: '#ffe066',
    stopPropagation: false
  });

  messageDiv.appendChild(lead);
  messageDiv.appendChild(profileLink);

  if (isHelping) {
    const mid = document.createElement('span');
    mid.textContent = t('mods.battleHelper.toast.helpingMid');
    messageDiv.appendChild(mid);

    const mapSpan = document.createElement('span');
    mapSpan.textContent = helpMapName;
    mapSpan.style.cssText = 'color: #ffe066;';
    messageDiv.appendChild(mapSpan);

    const helpingTail = t('mods.battleHelper.toast.helpingTail');
    if (helpingTail) {
      const tail = document.createElement('span');
      tail.textContent = helpingTail;
      messageDiv.appendChild(tail);
    }
    return;
  }

  const tailText = t('mods.battleHelper.toast.viewingTail');
  if (tailText) {
    const tail = document.createElement('span');
    tail.textContent = tailText;
    messageDiv.appendChild(tail);
  }
}

function removeBattleHelperPersistentToast() {
  if (battleHelperPersistentToastHandle?.remove) {
    battleHelperPersistentToastHandle.remove();
  }
  battleHelperPersistentToastHandle = null;
}

function showBattleHelperPersistentToast(profileName, username, options = {}) {
  try {
    const container = getBattleHelperToastContainer();
    if (!container) return null;

    removeBattleHelperPersistentToast();

    const flexContainer = createBattleHelperToastFlexContainer(container);
    const { toast, widgetBottom } = createBattleHelperToastChrome({ role: 'presentation', interactive: true });

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    populateBattleHelperToastMessage(messageDiv, profileName, username, options);

    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.className = `${BATTLE_HELPER_BUTTON_CLASS.blue} disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50`;
    restoreBtn.style.cssText = `${BATTLE_HELPER_BLUE_BUTTON_STYLE} width: auto; cursor: pointer; flex: 0 0 auto; pointer-events: auto;`;
    restoreBtn.textContent = t('mods.battleHelper.toast.restore');
    restoreBtn.title = t('mods.battleHelper.restoreOriginalProfile');
    restoreBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (restoreBtn.disabled) return;
      try {
        restoreOriginalArsenal();
      } catch (error) {
        showBattleHelperTransientToast(String(error?.message || error));
      }
    });

    widgetBottom.appendChild(messageDiv);
    widgetBottom.appendChild(restoreBtn);
    flexContainer.appendChild(toast);
    mountBattleHelperToast(flexContainer, container);

    const handle = {
      updateProfile(nextProfileName, nextUsername, nextOptions = {}) {
        populateBattleHelperToastMessage(messageDiv, nextProfileName, nextUsername, nextOptions);
      },
      remove() {
        if (flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateBattleHelperToastPositions(container);
        }
        if (battleHelperPersistentToastHandle === handle) {
          battleHelperPersistentToastHandle = null;
        }
      }
    };
    battleHelperPersistentToastHandle = handle;
    return handle;
  } catch (error) {
    console.warn('[Battle Helper] showBattleHelperPersistentToast:', error);
    return null;
  }
}

function startBattleHelperViewingProfileToast(profileName, username, options = {}) {
  if (battleHelperPersistentToastHandle?.updateProfile) {
    battleHelperPersistentToastHandle.updateProfile(profileName, username, options);
    return;
  }
  showBattleHelperPersistentToast(profileName, username, options);
}

function stopBattleHelperViewingProfileToast() {
  removeBattleHelperPersistentToast();
}

function removeBattleHelperPublishSetupToast() {
  if (battleHelperPublishToastResetTimer) {
    clearTimeout(battleHelperPublishToastResetTimer);
    battleHelperPendingTimers.delete(battleHelperPublishToastResetTimer);
    battleHelperPublishToastResetTimer = null;
  }
  if (battleHelperPublishToastHandle?.remove) {
    battleHelperPublishToastHandle.remove();
  }
  battleHelperPublishToastHandle = null;
  battleHelperPublishToastBtn = null;
  stopPublishSetupBoardWatchIfIdle();
}

function stopBattleHelperPublishSetupToast() {
  removeBattleHelperPublishSetupToast();
}

async function publishHelpSetupFromToast() {
  const requestId = sessionState.helpRequestId || helpBoardState.selectedId;
  if (!requestId) {
    throw new Error(t('mods.battleHelper.help.errors.selectRequestFirst'));
  }
  await publishHelpReply(requestId);
  helpBoardState.selectedId = requestId;
  openBattleHelperModal();
}

function showBattleHelperPublishSetupToast() {
  try {
    const container = getBattleHelperToastContainer();
    if (!container) return null;

    removeBattleHelperPublishSetupToast();

    const flexContainer = createBattleHelperToastFlexContainer(container, 'battle-helper-publish-toast');
    const { toast, widgetBottom } = createBattleHelperToastChrome({ role: 'presentation', interactive: true });

    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-left';
    messageDiv.style.flex = '1 1 auto';
    messageDiv.textContent = t('mods.battleHelper.toast.publishSetupHint');

    const publishBtn = document.createElement('button');
    publishBtn.type = 'button';
    publishBtn.className = `${BATTLE_HELPER_BUTTON_CLASS.primary} disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50`;
    publishBtn.style.cssText = 'cursor: pointer; flex: 0 0 auto; pointer-events: auto;';
    publishBtn.textContent = t('mods.battleHelper.toast.publishSetup');
    publishBtn.addEventListener('click', async () => {
      if (publishBtn.disabled || !hasCreaturesOnBoard()) return;
      const gateRequest = resolveHelpRequestForPublishGate(
        sessionState.helpRequestId || helpBoardState.selectedId
      );
      const onMap = gateRequest ? isOnHelpRequestMap(gateRequest) : isOnSessionHelpMap();
      if (!onMap) return;
      if (battleHelperPublishToastResetTimer) {
        clearTimeout(battleHelperPublishToastResetTimer);
        battleHelperPendingTimers.delete(battleHelperPublishToastResetTimer);
        battleHelperPublishToastResetTimer = null;
      }
      publishBtn.dataset.busy = '1';
      publishBtn.disabled = true;
      const previousLabel = publishBtn.textContent;
      publishBtn.textContent = t('mods.battleHelper.help.publishing');
      try {
        await publishHelpSetupFromToast();
        messageDiv.textContent = t('mods.battleHelper.help.published');
        publishBtn.textContent = t('mods.battleHelper.toast.publishSetupDone');
        battleHelperPublishToastResetTimer = scheduleBattleHelperTimeout(() => {
          battleHelperPublishToastResetTimer = null;
          if (!publishBtn.isConnected) return;
          messageDiv.textContent = t('mods.battleHelper.toast.publishSetupHint');
          publishBtn.textContent = t('mods.battleHelper.toast.publishSetup');
          publishBtn.dataset.busy = '';
          syncPublishSetupButtons();
        }, 5000);
      } catch (error) {
        messageDiv.textContent = String(error?.message || error);
        publishBtn.textContent = previousLabel;
        publishBtn.dataset.busy = '';
        syncPublishSetupButtons();
      }
    });

    battleHelperPublishToastBtn = publishBtn;
    startPublishSetupBoardWatch();

    widgetBottom.appendChild(messageDiv);
    widgetBottom.appendChild(publishBtn);
    flexContainer.appendChild(toast);
    mountBattleHelperToast(flexContainer, container);

    const handle = {
      remove() {
        if (flexContainer.parentNode) {
          flexContainer.parentNode.removeChild(flexContainer);
          updateBattleHelperToastPositions(container);
        }
        if (battleHelperPublishToastHandle === handle) {
          battleHelperPublishToastHandle = null;
        }
      }
    };
    battleHelperPublishToastHandle = handle;
    return handle;
  } catch (error) {
    console.warn('[Battle Helper] showBattleHelperPublishSetupToast:', error);
    return null;
  }
}

function startBattleHelperPublishSetupToast() {
  if (battleHelperPublishToastHandle) {
    updateBattleHelperToastPositions(getBattleHelperToastContainer());
    return;
  }
  showBattleHelperPublishSetupToast();
}

// =======================
// 7. UI Components
// =======================
function createActionButton(label, onClick, options = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  const variantClass = options.danger
    ? BATTLE_HELPER_BUTTON_CLASS.danger
    : (options.blue
      ? BATTLE_HELPER_BUTTON_CLASS.blue
      : (options.primary ? BATTLE_HELPER_BUTTON_CLASS.primary : BATTLE_HELPER_BUTTON_CLASS.secondary));
  button.className = `${variantClass} disabled:cursor-not-allowed disabled:text-whiteDark/60 disabled:grayscale-50`;
  button.style.cssText = options.blue
    ? BATTLE_HELPER_BLUE_BUTTON_STYLE
    : 'width: 100%; cursor: pointer;';
  const textSpan = document.createElement('span');
  textSpan.textContent = label;
  button.appendChild(textSpan);
  if (options.disabled) button.disabled = true;
  button.addEventListener('click', onClick);
  return button;
}

function createSectionLabel(title) {
  const label = document.createElement('div');
  label.className = 'pixel-font-12 text-whiteRegular mb-1 shrink-0';
  label.style.textAlign = 'center';
  label.style.width = '100%';
  label.textContent = title;
  return label;
}

function createSectionCard(options = {}) {
  const card = document.createElement('div');
  card.className = 'frame-1 surface-regular box-border flex flex-col gap-1 p-1 shrink-0';
  if (options.flex) {
    card.style.flex = '1 1 0';
    card.style.minWidth = '0';
  }
  if (options.fullWidth) {
    card.style.width = '100%';
  }
  return card;
}

function createUsernameInput(initialValue = '') {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'frame-pressed-1 surface-dark w-full p-1 text-whiteRegular pixel-font-16';
  input.placeholder = t('mods.battleHelper.usernamePlaceholder');
  input.value = initialValue;
  input.style.maxWidth = '100%';
  input.style.boxSizing = 'border-box';
  input.style.height = `${BATTLE_HELPER_FIELD_HEIGHT_PX}px`;
  input.style.maxHeight = `${BATTLE_HELPER_FIELD_HEIGHT_PX}px`;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  return input;
}

function applyBattleHelperScrollViewportGutter(scrollContainer) {
  if (!scrollContainer?.element) return;

  const viewport = scrollContainer.scrollView ||
    scrollContainer.element.querySelector('[data-radix-scroll-area-viewport]') ||
    scrollContainer.element.querySelector('.scroll-view');
  if (!viewport) return;

  viewport.setAttribute('data-radix-scroll-area-viewport', '');
  viewport.setAttribute('data-type', 'always');
  viewport.className = 'h-full w-[calc(100%-12px)] data-[type=\'auto\']:w-full';
  viewport.style.overflow = 'hidden scroll';

  const contentContainer = scrollContainer.contentContainer;
  if (contentContainer) {
    contentContainer.className = 'grid items-start gap-1 p-1';
    contentContainer.dataset.nopadding = 'false';
    contentContainer.style.gridTemplateRows = 'max-content';
    contentContainer.style.boxSizing = 'border-box';
  }

  const scrollbar = scrollContainer.element.querySelector('[data-orientation="vertical"]') ||
    Array.from(scrollContainer.element.children).find(
      child => child !== viewport && child.classList?.contains('frame-1')
    );
  if (scrollbar) {
    scrollbar.setAttribute('data-orientation', 'vertical');
    scrollbar.className = 'scrollbar-element frame-1 surface-dark flex touch-none select-none border-0 data-[orientation=\'horizontal\']:h-3 data-[orientation=\'vertical\']:h-full data-[orientation=\'vertical\']:w-3 data-[orientation=\'horizontal\']:flex-col';
    scrollbar.style.cssText = `position: absolute; top: 0px; right: 0px; bottom: 0px; width: ${BATTLE_HELPER_SCROLLBAR_GUTTER_PX}px;`;
  }
}

function createBattleHelperScrollContainer({ height = BATTLE_HELPER_OUTPUT_HEIGHT_PX, grow = false } = {}) {
  const scrollContainer = api.ui.components.createScrollContainer({
    height,
    padding: true,
    content: ''
  });
  // Status areas always sit at their full configured height (expanded to the bottom of
  // their slot) rather than shrinking to fit sparse content, so `refit` is a no-op kept
  // around for call-site compatibility.
  scrollContainer.refit = () => {};
  Object.assign(scrollContainer.element.style, grow
    ? {
        flex: '1 1 0',
        minHeight: `${height}px`,
        height: 'auto',
        maxHeight: 'none',
        position: 'relative',
        overflow: 'hidden',
        width: '100%'
      }
    : {
        flex: '0 0 auto',
        minHeight: '0',
        height: `${height}px`,
        maxHeight: `${height}px`,
        position: 'relative',
        overflow: 'hidden',
        width: '100%'
      });
  applyBattleHelperScrollViewportGutter(scrollContainer);
  return scrollContainer;
}

function styleBattleHelperFooterButtons(footer) {
  if (!footer) return;

  footer.style.cssText = `
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
  `;

  footer.querySelectorAll('button').forEach((button) => {
    const bg = button.style.backgroundColor?.toLowerCase();
    const isPrimary = bg === 'rgb(76, 175, 80)' || bg === '#4caf50';
    button.className = isPrimary
      ? BATTLE_HELPER_BUTTON_CLASS.primary
      : BATTLE_HELPER_BUTTON_CLASS.secondary;
    button.style.cssText = 'cursor: pointer;';
  });
}

/** Build output nodes with the profile name linked. */
function buildFetchedProfileOutputNodes(normalized, { includeSandboxNote = false } = {}) {
  const fragment = document.createDocumentFragment();
  const profileLine = document.createElement('span');
  appendLocalizedTextWithProfileLink(
    profileLine,
    'mods.battleHelper.output.profileLine',
    normalized.profileName || sessionState.lastUsername
  );
  fragment.appendChild(profileLine);
  fragment.appendChild(document.createTextNode('\n'));
  fragment.appendChild(document.createTextNode(tReplace('mods.battleHelper.output.creaturesLine', {
    count: String(normalized.monsters.length)
  })));
  fragment.appendChild(document.createTextNode('\n'));
  fragment.appendChild(document.createTextNode(tReplace('mods.battleHelper.output.equipmentLine', {
    count: String(normalized.equips.length)
  })));
  fragment.appendChild(document.createTextNode('\n\n'));
  fragment.appendChild(document.createTextNode(t('mods.battleHelper.output.canReplaceProfile')));
  if (includeSandboxNote) {
    fragment.appendChild(document.createTextNode('\n\n'));
    fragment.appendChild(document.createTextNode(t('mods.battleHelper.output.switchedToSandbox')));
  }
  return fragment;
}

function getInitialModalOutputContent() {
  if (sessionState.replaced) {
    return getProfileReplacedOutput();
  }
  if (sessionState.lastNormalized) {
    return buildFetchedProfileOutputNodes(sessionState.lastNormalized);
  }
  return getNoProfileFetchedOutput();
}

function createFieldSelect(optionsList, initialValue = '') {
  const select = document.createElement('select');
  select.className = 'frame-pressed-1 surface-dark w-full p-1 text-whiteRegular pixel-font-14';
  select.style.cssText = `height: ${BATTLE_HELPER_FIELD_HEIGHT_PX}px; max-height: ${BATTLE_HELPER_FIELD_HEIGHT_PX}px; box-sizing: border-box; max-width: 100%;`;
  optionsList.forEach(({ value, label }) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    if (value === initialValue) option.selected = true;
    select.appendChild(option);
  });
  return select;
}

function createCompactInput(placeholder = '', initialValue = '') {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'frame-pressed-1 surface-dark w-full p-1 text-whiteRegular pixel-font-14';
  input.placeholder = placeholder;
  input.value = initialValue;
  input.style.cssText = `height: ${BATTLE_HELPER_FIELD_HEIGHT_PX}px; max-height: ${BATTLE_HELPER_FIELD_HEIGHT_PX}px; box-sizing: border-box; max-width: 100%;`;
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  return input;
}

function wrapHelpFormField(controlEl) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display: flex; flex-direction: column; gap: 2px; width: 100%; box-sizing: border-box;';
  wrap.appendChild(controlEl);

  const errorEl = document.createElement('p');
  errorEl.className = 'pixel-font-12 m-0';
  errorEl.style.cssText = 'color: #f87171; display: none; line-height: 1.25; word-break: break-word;';
  wrap.appendChild(errorEl);

  const target = controlEl.selectElement || controlEl;
  wrap._errorEl = errorEl;
  wrap._controlEl = target;
  wrap._baseBorder = target.style.border || '';
  wrap._baseOutline = target.style.outline || '';
  wrap._baseColor = target.style.color || '';
  return wrap;
}

function clearHelpFormFieldError(fieldWrap) {
  if (!fieldWrap?._errorEl || !fieldWrap?._controlEl) return;
  fieldWrap._errorEl.textContent = '';
  fieldWrap._errorEl.style.display = 'none';
  fieldWrap._controlEl.style.border = fieldWrap._baseBorder;
  fieldWrap._controlEl.style.outline = fieldWrap._baseOutline;
  fieldWrap._controlEl.style.color = fieldWrap._baseColor;
  fieldWrap._controlEl.style.boxShadow = '';
}

function setHelpFormFieldError(fieldWrap, message) {
  if (!fieldWrap?._errorEl || !fieldWrap?._controlEl) return;
  fieldWrap._errorEl.textContent = message || '';
  fieldWrap._errorEl.style.display = message ? 'block' : 'none';
  if (message) {
    fieldWrap._controlEl.style.border = '1px solid #f87171';
    fieldWrap._controlEl.style.outline = '1px solid #f87171';
    fieldWrap._controlEl.style.color = '#f87171';
    fieldWrap._controlEl.style.boxShadow = '0 0 0 1px rgba(248, 113, 113, 0.35)';
  } else {
    clearHelpFormFieldError(fieldWrap);
  }
}

function buildImportPanel(onContentChange, shared) {
  const panel = document.createElement('div');
  panel.className = 'battle-helper-col battle-helper-col-profile';
  panel.style.cssText = 'display: flex; flex-direction: column; gap: 4px; flex: 6 1 0; width: 30%; min-width: 0; min-height: 0; height: 100%; box-sizing: border-box;';

  const profileCard = createSectionCard();
  const usernameInput = createUsernameInput(sessionState.lastUsername);
  profileCard.appendChild(usernameInput);
  shared.usernameInput = usernameInput;

  let replaceButton;
  let restoreButton;

  const logScroll = createBattleHelperScrollContainer({
    height: BATTLE_HELPER_HELP_LIST_HEIGHT_PX,
    grow: true
  });

  let lastOutputKey = null;
  let lastOutputEntry = null;
  let lastOutputCount = 1;

  function setOutput(content, type = null) {
    if (content == null || content === '') return;
    const key = `${type || ''} ${typeof content === 'string' ? content : (content.textContent || '')}`;

    if (lastOutputEntry && key === lastOutputKey) {
      lastOutputCount += 1;
      lastOutputEntry._badge.textContent = ` ×${lastOutputCount}`;
      logScroll.refit();
      requestAnimationFrame(() => {
        logScroll.scrollView.scrollTop = logScroll.scrollView.scrollHeight;
      });
      if (typeof onContentChange === 'function') {
        requestAnimationFrame(() => onContentChange());
      }
      return;
    }

    const entry = document.createElement('p');
    entry.className = 'pixel-font-14 text-whiteRegular m-0';
    entry.style.cssText = 'white-space: pre-wrap; line-height: 1.35; word-break: break-word;';
    const statusColor = BATTLE_HELPER_STATUS_COLORS[type];
    if (statusColor) {
      entry.style.color = statusColor;
    }
    if (typeof content === 'string') {
      entry.textContent = content;
    } else if (content instanceof Node) {
      entry.appendChild(content);
    }
    const badge = document.createElement('span');
    badge.style.cssText = 'opacity: 0.7; font-style: italic;';
    entry.appendChild(badge);
    entry._badge = badge;

    if (logScroll.contentContainer.childElementCount > 0) {
      const divider = document.createElement('div');
      divider.style.cssText = 'height: 1px; background: rgba(255,255,255,0.12); margin: 2px 0;';
      logScroll.addContent(divider);
    }
    logScroll.addContent(entry);
    logScroll.refit();
    requestAnimationFrame(() => {
      logScroll.scrollView.scrollTop = logScroll.scrollView.scrollHeight;
    });
    if (typeof onContentChange === 'function') {
      requestAnimationFrame(() => onContentChange());
    }

    lastOutputKey = key;
    lastOutputEntry = entry;
    lastOutputCount = 1;
  }
  shared.setOutput = setOutput;
  setOutput(getInitialModalOutputContent());

  function syncButtons() {
    replaceButton.disabled = !sessionState.lastNormalized;
    restoreButton.disabled = !sessionState.replaced;
  }
  shared.syncImportButtons = syncButtons;

  async function fetchAndOptionallyReplace(username, { replace = false, helpMapName = '', helpRequestId = '', helpRoomId = '', shouldAbort = null } = {}) {
    const normalizedName = normalizeUsername(username);
    debugLog('fetchAndOptionallyReplace:', { username: normalizedName, replace, helpMapName, helpRequestId, helpRoomId });
    if (!normalizedName) {
      setOutput(getEnterUsernameFirstOutput(), 'error');
      return false;
    }
    setOutput(tReplace('mods.battleHelper.output.fetchingProfile', { username: normalizedName }), 'progress');
    const profile = await fetchProfileByUsername(normalizedName);
    if (typeof shouldAbort === 'function' && shouldAbort()) {
      debugLog('fetchAndOptionallyReplace: aborted after fetch (stale seq)');
      return false;
    }
    sessionState.lastProfileRaw = profile;
    const normalized = normalizeProfileArsenal(profile);
    validateNormalizedArsenal(normalized);
    sessionState.lastNormalized = normalized;
    sessionState.lastUsername = normalizedName;
    usernameInput.value = normalizedName;

    const switchedToSandbox = ensureSandboxPlayMode();
    if (replace) {
      if (typeof shouldAbort === 'function' && shouldAbort()) return false;
      if (!isSandboxEnabled()) {
        throw new Error(t('mods.battleHelper.errors.sandboxRequired'));
      }
      applyArsenalReplacement(normalized, { helpMapName, helpRequestId, helpRoomId });
      setOutput(getProfileReplacedOutput(), 'success');
    } else {
      sessionState.helpMapName = '';
      sessionState.helpRequestId = '';
      sessionState.helpRoomId = '';
      stopBattleHelperPublishSetupToast();
      setOutput(buildFetchedProfileOutputNodes(normalized, { includeSandboxNote: switchedToSandbox }), 'success');
    }
    syncButtons();
    return true;
  }
  shared.fetchAndOptionallyReplace = fetchAndOptionallyReplace;

  const fetchButton = createActionButton(t('mods.battleHelper.fetchPlayer'), async () => {
    try {
      debugLog('[click] Fetch player button:', usernameInput.value);
      await fetchAndOptionallyReplace(usernameInput.value, { replace: false });
    } catch (error) {
      sessionState.lastProfileRaw = null;
      sessionState.lastNormalized = null;
      setOutput(getFetchFailedOutput(error), 'error');
      syncButtons();
    }
  });
  profileCard.appendChild(fetchButton);

  replaceButton = createActionButton(t('mods.battleHelper.replaceProfile'), () => {
    try {
      if (!isSandboxEnabled()) {
        throw new Error(t('mods.battleHelper.errors.sandboxRequired'));
      }
      if (!sessionState.lastNormalized) {
        throw new Error(t('mods.battleHelper.errors.fetchValidProfileFirst'));
      }
      applyArsenalReplacement(sessionState.lastNormalized, { helpMapName: '', helpRequestId: '', helpRoomId: '' });
      setOutput(getProfileReplacedOutput(), 'success');
      syncButtons();
    } catch (error) {
      setOutput(tReplace('mods.battleHelper.output.replaceFailed', {
        error: String(error?.message || error)
      }), 'error');
    }
  }, { disabled: true, primary: true });

  restoreButton = createActionButton(t('mods.battleHelper.restoreOriginalProfile'), () => {
    try {
      restoreOriginalArsenal();
      setOutput(t('mods.battleHelper.output.originalProfileRestored'), 'success');
      syncButtons();
    } catch (error) {
      setOutput(tReplace('mods.battleHelper.output.restoreFailed', {
        error: String(error?.message || error)
      }), 'error');
    }
  }, { disabled: true, blue: true });

  profileCard.appendChild(replaceButton);
  profileCard.appendChild(restoreButton);
  panel.appendChild(profileCard);

  const statusCard = createSectionCard({ flex: true });
  statusCard.appendChild(createSectionLabel(t('mods.battleHelper.statusLabel')));
  statusCard.appendChild(logScroll.element);
  panel.appendChild(statusCard);

  syncButtons();
  return panel;
}

function buildHelpBoardColumns(onContentChange, shared) {
  const askColumn = document.createElement('div');
  askColumn.className = 'battle-helper-col battle-helper-col-ask';
  askColumn.style.cssText = 'display: flex; flex-direction: column; gap: 4px; flex: 7 1 0; width: 35%; min-width: 0; min-height: 0; height: 100%; box-sizing: border-box;';

  const detailColumn = document.createElement('div');
  detailColumn.className = 'battle-helper-col battle-helper-col-selected';
  detailColumn.style.cssText = 'display: flex; flex-direction: column; gap: 4px; flex: 7 1 0; width: 35%; min-width: 0; min-height: 0; height: 100%; box-sizing: border-box;';

  function setHelpStatus(text, type = null) {
    if (typeof shared.setOutput === 'function') {
      shared.setOutput(text || '', type);
      return;
    }
    if (typeof onContentChange === 'function') {
      requestAnimationFrame(() => onContentChange());
    }
  }

  const formCard = createSectionCard();
  formCard.appendChild(createSectionLabel(t('mods.battleHelper.help.askTitle')));

  const mapOptions = getHelpMapOptions();
  const currentMapOption = findMapOptionForCurrentRoom(mapOptions);
  const mapPicker = createMapPicker(mapOptions, currentMapOption?.mapKey || '');

  const goalSelect = createFieldSelect(
    BATTLE_HELP_GOAL_TYPES.map((type) => ({
      value: type,
      label: t(`mods.battleHelper.help.goalTypes.${type}`)
    })),
    'ticks'
  );

  const goalValueInput = createCompactInput(t('mods.battleHelper.help.goalValuePlaceholderTicks'));
  goalValueInput.inputMode = 'numeric';
  goalValueInput.required = true;

  const noteInput = createCompactInput(
    tReplace('mods.battleHelper.help.notePlaceholder', {
      max: String(BATTLE_HELP_NOTE_MAX_LENGTH)
    })
  );
  noteInput.maxLength = BATTLE_HELP_NOTE_MAX_LENGTH;

  const mapField = wrapHelpFormField(mapPicker);
  const goalTypeField = wrapHelpFormField(goalSelect);
  const goalValueField = wrapHelpFormField(goalValueInput);
  const noteField = wrapHelpFormField(noteInput);

  const noteCounter = document.createElement('span');
  noteCounter.className = 'pixel-font-12 m-0';
  noteCounter.style.cssText = 'align-self: flex-end; color: rgba(255,255,255,0.55); line-height: 1.2;';
  noteField.insertBefore(noteCounter, noteField._errorEl);

  function getSelectedMapOption() {
    return mapOptions.find((m) => m.mapKey === mapPicker.getValue()) || null;
  }

  function clearAskFormFieldErrors() {
    clearHelpFormFieldError(mapField);
    clearHelpFormFieldError(goalTypeField);
    clearHelpFormFieldError(goalValueField);
    clearHelpFormFieldError(noteField);
  }

  function syncNoteLimit() {
    let value = String(noteInput.value || '');
    if (value.length > BATTLE_HELP_NOTE_MAX_LENGTH) {
      value = value.slice(0, BATTLE_HELP_NOTE_MAX_LENGTH);
      noteInput.value = value;
    }
    noteCounter.textContent = `${value.length}/${BATTLE_HELP_NOTE_MAX_LENGTH}`;
    noteCounter.style.color = value.length >= BATTLE_HELP_NOTE_MAX_LENGTH
      ? '#f87171'
      : 'rgba(255,255,255,0.55)';
    clearHelpFormFieldError(noteField);
  }
  noteInput.addEventListener('input', syncNoteLimit);
  noteInput.addEventListener('paste', () => {
    requestAnimationFrame(syncNoteLimit);
  });
  syncNoteLimit();

  function clampGoalValueField() {
    const selected = getSelectedMapOption();
    const clamped = clampHelpGoalValue(
      goalSelect.value,
      goalValueInput.value,
      selected?.id || ''
    );
    if (clamped !== '') {
      goalValueInput.value = clamped;
    }
  }

  function syncGoalValuePlaceholder() {
    const selected = getSelectedMapOption();
    goalValueInput.placeholder = getHelpGoalValuePlaceholder(
      goalSelect.value,
      selected?.id || ''
    );
    clampGoalValueField();
    clearHelpFormFieldError(goalValueField);
  }
  goalSelect.addEventListener('change', () => {
    clearHelpFormFieldError(goalTypeField);
    syncGoalValuePlaceholder();
  });
  mapPicker.selectElement.addEventListener('change', () => {
    clearHelpFormFieldError(mapField);
    syncGoalValuePlaceholder();
  });
  goalValueInput.addEventListener('blur', () => {
    clampGoalValueField();
  });
  goalValueInput.addEventListener('input', () => {
    clearHelpFormFieldError(goalValueField);
    // Keep digits only while typing; clamp on blur / goal-map change
    const cleaned = String(goalValueInput.value || '').replace(/[^\d]/g, '');
    if (cleaned !== goalValueInput.value) {
      goalValueInput.value = cleaned;
    }
  });
  syncGoalValuePlaceholder();

  formCard.appendChild(mapField);
  formCard.appendChild(goalTypeField);
  formCard.appendChild(goalValueField);
  formCard.appendChild(noteField);

  const postButton = createActionButton(t('mods.battleHelper.help.postRequest'), async () => {
    clearAskFormFieldErrors();
    try {
      const selected = getSelectedMapOption();
      if (!selected) {
        throw helpFormFieldError('map', t('mods.battleHelper.help.errors.mapRequired'));
      }
      clampGoalValueField();
      const goalValue = validateHelpGoalValue(
        goalSelect.value,
        goalValueInput.value,
        selected.id
      );
      syncNoteLimit();
      const note = validateHelpNote(noteInput.value);
      setHelpStatus(t('mods.battleHelper.help.posting'), 'progress');
      await createHelpRequest({
        mapName: selected.name,
        mapKey: selected.mapKey,
        regionName: selected.regionName,
        roomId: selected.id,
        goalType: goalSelect.value,
        goalValue,
        note
      });
      noteInput.value = '';
      syncNoteLimit();
      goalValueInput.value = '';
      clearAskFormFieldErrors();
      setHelpStatus(t('mods.battleHelper.help.posted'), 'success');
      await refreshList({ preserveStatus: true });
    } catch (error) {
      const message = String(error?.message || error);
      const field = error?.helpField;
      if (field === 'map') setHelpFormFieldError(mapField, message);
      else if (field === 'goalType') setHelpFormFieldError(goalTypeField, message);
      else if (field === 'goalValue') setHelpFormFieldError(goalValueField, message);
      else if (field === 'note') setHelpFormFieldError(noteField, message);
      setHelpStatus(message, 'error');
    }
  }, { primary: true });
  formCard.appendChild(postButton);
  askColumn.appendChild(formCard);

  const listCard = createSectionCard({ flex: true });
  const listHeader = document.createElement('div');
  listHeader.style.cssText = 'display: flex; flex-direction: row; gap: 4px; align-items: center; width: 100%;';
  const listLabel = createSectionLabel(t('mods.battleHelper.help.openRequests'));
  listLabel.style.flex = '1 1 auto';
  listLabel.style.marginBottom = '0';
  listHeader.appendChild(listLabel);

  function updateOpenRequestsTitle(count = null) {
    if (count == null || !Number.isFinite(Number(count))) {
      listLabel.textContent = t('mods.battleHelper.help.openRequests');
      return;
    }
    listLabel.textContent = tReplace('mods.battleHelper.help.loadedCount', {
      n: String(count)
    });
  }

  const refreshButton = document.createElement('button');
  refreshButton.type = 'button';
  refreshButton.className = BATTLE_HELPER_BUTTON_CLASS.secondary;
  refreshButton.style.cssText = 'cursor: pointer; flex: 0 0 auto;';
  refreshButton.textContent = t('mods.battleHelper.help.refresh');
  listHeader.appendChild(refreshButton);
  listCard.appendChild(listHeader);

  const listScroll = createBattleHelperScrollContainer({
    height: BATTLE_HELPER_HELP_LIST_HEIGHT_PX,
    grow: true
  });
  const listBody = document.createElement('div');
  listBody.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%;';
  listScroll.addContent(listBody);
  listCard.appendChild(listScroll.element);
  askColumn.appendChild(listCard);

  const detailCard = createSectionCard({ flex: true });
  detailCard.appendChild(createSectionLabel(t('mods.battleHelper.help.selectedTitle')));

  const detailHeader = document.createElement('div');
  detailHeader.style.cssText = 'display: flex; flex-direction: row; gap: 6px; align-items: center; width: 100%;';
  const detailIconSlot = document.createElement('div');
  detailIconSlot.style.cssText = 'width: 50px; height: 50px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center;';
  const detailText = document.createElement('p');
  detailText.className = 'pixel-font-14 text-whiteRegular m-0';
  detailText.style.cssText = 'flex: 1 1 auto; min-width: 0; line-height: 1.35; word-break: break-word; white-space: pre-wrap;';
  detailText.textContent = t('mods.battleHelper.help.noSelection');
  detailHeader.appendChild(detailIconSlot);
  detailHeader.appendChild(detailText);
  detailCard.appendChild(detailHeader);

  const detailActions = document.createElement('div');
  detailActions.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%;';

  let selectRequestSeq = 0;

  function selectHelpRequest(request) {
    if (!request) return;
    helpBoardState.selectedId = request.id;
    renderList();
  }

  async function replaceRequesterProfileForHelp(request, seq, seqRef, setStatus) {
    const { roomId, mapLabel } = getHelpMapContextForRequest(request);
    // Note: fetchAndOptionallyReplace() emits its own "fetching profile" status line;
    // don't duplicate it here or the log shows the same entry twice ("... ×2").
    debugLog('replaceRequesterProfileForHelp:', { requester: request.requesterName, roomId, mapLabel, seq });
    if (typeof shared.fetchAndOptionallyReplace === 'function') {
      await shared.fetchAndOptionallyReplace(request.requesterName, {
        replace: true,
        helpMapName: mapLabel,
        helpRequestId: request.id,
        helpRoomId: roomId || '',
        shouldAbort: () => seq !== seqRef
      });
    }
    return mapLabel;
  }

  async function activateHelpRequest(request) {
    if (!request) return;
    const seq = ++helpRequestActivateSeq;
    debugLog(`activateHelpRequest #${seq}:`, { id: request.id, requester: request.requesterName, map: request.mapName, roomId: request.roomId });
    selectRequestSeq = seq;
    helpBoardState.selectedId = request.id;
    renderList();

    const navigated = await navigateToHelpRequest(request);
    ensureSandboxPlayMode();

    const me = getCurrentPlayerName().toLowerCase();
    const isOwn = request.requesterName.toLowerCase() === me;

    if (isOwn) {
      if (seq !== helpRequestActivateSeq) return;
      const { mapLabel } = getHelpMapContextForRequest(request);
      setHelpStatus(
        navigated
          ? tReplace('mods.battleHelper.help.navigatedOwn', { map: mapLabel || request.mapName })
          : t('mods.battleHelper.help.errors.navigateFailed'),
        navigated ? 'success' : 'error'
      );
      return;
    }

    if (!navigated) {
      if (seq !== helpRequestActivateSeq) return;
      setHelpStatus(t('mods.battleHelper.help.errors.navigateFailed'), 'error');
      return;
    }

    try {
      const helpMapName = await replaceRequesterProfileForHelp(
        request,
        seq,
        helpRequestActivateSeq,
        setHelpStatus
      );
      if (seq !== helpRequestActivateSeq) return;
      setHelpStatus(tReplace('mods.battleHelper.help.profileLoadedOnMap', {
        name: request.requesterName,
        map: helpMapName
      }), 'success');
      if (!activeBattleHelperModal && !document.getElementById(BATTLE_HELPER_MODAL_ID)) {
        openBattleHelperModal();
      }
    } catch (error) {
      if (seq !== helpRequestActivateSeq) return;
      setHelpStatus(String(error?.message || error), 'error');
    }
  }

  async function activateViewHelpReplySetup(request, replayLink) {
    if (!request || !replayLink) return false;
    const seq = ++helpViewSetupSeq;

    ensureSandboxPlayMode();

    try {
      await replaceRequesterProfileForHelp(
        request,
        seq,
        helpViewSetupSeq,
        setHelpStatus
      );
      if (seq !== helpViewSetupSeq) return false;

      setHelpStatus(t('mods.battleHelper.help.applyingSetup'), 'progress');
      const ok = applyHelpReplySetup(replayLink);
      if (seq !== helpViewSetupSeq) return false;
      setHelpStatus(
        ok
          ? t('mods.battleHelper.help.setupApplied')
          : t('mods.battleHelper.help.setupApplyFailed'),
        ok ? 'success' : 'error'
      );
      return ok;
    } catch (error) {
      if (seq !== helpViewSetupSeq) return false;
      setHelpStatus(String(error?.message || error), 'error');
      return false;
    }
  }

  const loadProfileButton = createActionButton(t('mods.battleHelper.help.loadProfile'), async () => {
    debugLog('[click] Load profile button, selectedId:', helpBoardState.selectedId);
    const request = helpBoardState.requests.find((r) => r.id === helpBoardState.selectedId);
    if (!request) {
      setHelpStatus(t('mods.battleHelper.help.errors.selectRequestFirst'), 'error');
      return;
    }
    await activateHelpRequest(request);
  }, { primary: true });

  const publishButton = createActionButton(t('mods.battleHelper.help.publishSetup'), async () => {
    try {
      if (!helpBoardState.selectedId) {
        throw new Error(t('mods.battleHelper.help.errors.selectRequestFirst'));
      }
      setHelpStatus(t('mods.battleHelper.help.publishing'), 'progress');
      await publishHelpReply(helpBoardState.selectedId);
      setHelpStatus(t('mods.battleHelper.help.published'), 'success');
      await refreshList({ preserveStatus: true });
    } catch (error) {
      setHelpStatus(String(error?.message || error), 'error');
    }
  });

  const closeButton = createActionButton(t('mods.battleHelper.help.closeRequest'), async () => {
    const request = helpBoardState.requests.find((r) => r.id === helpBoardState.selectedId);
    const me = getCurrentPlayerName().toLowerCase();
    if (!request || request.requesterName.toLowerCase() !== me) {
      setHelpStatus(t('mods.battleHelper.help.errors.onlyOwnClose'), 'error');
      return;
    }
    try {
      await closeHelpRequest(request.id);
      helpBoardState.selectedId = null;
      setHelpStatus(t('mods.battleHelper.help.closed'), 'success');
      await refreshList({ preserveStatus: true });
    } catch (error) {
      setHelpStatus(String(error?.message || error), 'error');
    }
  }, { danger: true });

  detailActions.appendChild(loadProfileButton);
  detailActions.appendChild(publishButton);
  detailActions.appendChild(closeButton);
  detailCard.appendChild(detailActions);
  battleHelperModalPublishBtn = publishButton;
  startPublishSetupBoardWatch();

  const repliesScroll = createBattleHelperScrollContainer({ height: 160, grow: true });
  const repliesBody = document.createElement('div');
  repliesBody.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%;';
  repliesScroll.addContent(repliesBody);
  detailCard.appendChild(createSectionLabel(t('mods.battleHelper.help.repliesTitle')));
  detailCard.appendChild(repliesScroll.element);
  detailColumn.appendChild(detailCard);

  function renderReplies(request) {
    repliesBody.textContent = '';
    const replies = getHelpRepliesList(request);
    if (!replies.length) {
      const empty = document.createElement('p');
      empty.className = 'pixel-font-14 text-whiteRegular m-0 italic';
      empty.textContent = t('mods.battleHelper.help.noReplies');
      repliesBody.appendChild(empty);
      return;
    }
    replies.forEach((reply) => {
      const row = document.createElement('div');
      row.className = 'frame-pressed-1 surface-dark p-1';
      row.style.cssText = 'display: flex; flex-direction: row; gap: 4px; align-items: center; width: 100%; box-sizing: border-box;';

      const info = document.createElement('p');
      info.className = 'pixel-font-14 text-whiteRegular m-0';
      info.style.cssText = 'flex: 1 1 auto; min-width: 0; word-break: break-word;';

      const nameLink = createBattleHelperProfileLink(
        reply.helperName || '',
        { color: '#6ee07a' }
      );
      info.appendChild(nameLink);

      const ageText = formatHelpAge(reply.createdAt);
      if (ageText) {
        const ageSpan = document.createElement('span');
        ageSpan.textContent = ` · ${ageText}`;
        info.appendChild(ageSpan);
      }
      row.appendChild(info);

      const viewSetupBtn = document.createElement('button');
      viewSetupBtn.type = 'button';
      viewSetupBtn.className = BATTLE_HELPER_BUTTON_CLASS.secondary;
      viewSetupBtn.style.cssText = 'cursor: pointer; flex: 0 0 auto;';
      viewSetupBtn.textContent = t('mods.battleHelper.help.viewSetup');
      viewSetupBtn.addEventListener('click', async () => {
        if (viewSetupBtn.disabled) return;
        viewSetupBtn.disabled = true;
        try {
          await activateViewHelpReplySetup(request, reply.replayLink);
        } finally {
          viewSetupBtn.disabled = false;
        }
      });
      row.appendChild(viewSetupBtn);

      const me = getCurrentPlayerName().toLowerCase();
      const isOwnReply = me && reply.helperName.toLowerCase() === me;
      if (isOwnReply) {
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = BATTLE_HELPER_BUTTON_CLASS.secondary;
        removeBtn.style.cssText = 'cursor: pointer; flex: 0 0 auto;';
        removeBtn.textContent = t('mods.battleHelper.help.removeReply');
        removeBtn.addEventListener('click', async () => {
          if (removeBtn.disabled) return;
          removeBtn.disabled = true;
          try {
            setHelpStatus(t('mods.battleHelper.help.removingReply'), 'progress');
            await deleteHelpReply(request.id, reply.id, reply.helperName);
            setHelpStatus(t('mods.battleHelper.help.removedReply'), 'success');
            await refreshList({ preserveStatus: true });
          } catch (error) {
            setHelpStatus(String(error?.message || error), 'error');
            removeBtn.disabled = false;
          }
        });
        row.appendChild(removeBtn);
      }

      repliesBody.appendChild(row);
    });
  }

  function renderDetail() {
    const request = helpBoardState.requests.find((r) => r.id === helpBoardState.selectedId);
    if (!request) {
      detailIconSlot.textContent = '';
      detailIconSlot.appendChild(createMapIconPlaceholder(50));
      detailText.textContent = t('mods.battleHelper.help.noSelection');
      loadProfileButton.disabled = true;
      loadProfileButton.textContent = t('mods.battleHelper.help.loadProfile');
      battleHelperModalPublishBaseDisabled = true;
      syncPublishSetupButtons();
      closeButton.disabled = true;
      repliesBody.textContent = '';
      return;
    }

    const { roomId, mapLabel } = getHelpMapContextForRequest(request);
    detailIconSlot.textContent = '';
    if (roomId) {
      detailIconSlot.appendChild(createMapThumbnailImg(roomId, 50));
    } else {
      detailIconSlot.appendChild(createMapIconPlaceholder(50));
    }

    detailText.textContent = '';
    const requesterLine = document.createElement('span');
    appendLocalizedTextWithProfileLink(
      requesterLine,
      'mods.battleHelper.help.detailRequester',
      request.requesterName
    );
    detailText.appendChild(requesterLine);
    detailText.appendChild(document.createTextNode('\n'));
    detailText.appendChild(document.createTextNode(
      tReplace('mods.battleHelper.help.detailMap', { map: mapLabel })
    ));
    detailText.appendChild(document.createTextNode('\n'));
    detailText.appendChild(document.createTextNode(
      tReplace('mods.battleHelper.help.detailGoal', {
        goal: formatHelpGoalLabel(request.goalType, request.goalValue)
      })
    ));
    if (request.note) {
      detailText.appendChild(document.createTextNode('\n'));
      detailText.appendChild(document.createTextNode(
        tReplace('mods.battleHelper.help.detailNote', { note: request.note })
      ));
    }

    const me = getCurrentPlayerName().toLowerCase();
    const isOwn = request.requesterName.toLowerCase() === me;
    loadProfileButton.disabled = false;
    loadProfileButton.textContent = isOwn
      ? t('mods.battleHelper.help.openMap')
      : t('mods.battleHelper.help.loadProfile');
    battleHelperModalPublishBaseDisabled = isOwn;
    syncPublishSetupButtons();
    closeButton.disabled = !isOwn;
    renderReplies(request);
  }

  function renderList() {
    listBody.textContent = '';
    if (!helpBoardState.requests.length) {
      const empty = document.createElement('p');
      empty.className = 'pixel-font-14 text-whiteRegular m-0 italic';
      empty.textContent = t('mods.battleHelper.help.noOpenRequests');
      listBody.appendChild(empty);
      listScroll.refit();
      renderDetail();
      if (typeof onContentChange === 'function') {
        requestAnimationFrame(() => onContentChange());
      }
      return;
    }

    helpBoardState.requests.forEach((request) => {
      const row = document.createElement('div');
      row.setAttribute('role', 'button');
      row.tabIndex = 0;
      row.className = helpBoardState.selectedId === request.id
        ? 'frame-1-green surface-green p-1'
        : 'frame-1 surface-regular p-1';
      row.style.cssText = 'display: flex; flex-direction: row; gap: 6px; align-items: center; width: 100%; text-align: left; cursor: pointer; box-sizing: border-box;';

      const { roomId, mapLabel } = getHelpMapContextForRequest(request);
      if (roomId) {
        row.appendChild(createMapThumbnailImg(roomId, 22));
      }

      const textCol = document.createElement('div');
      textCol.style.cssText = 'flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 1px;';

      const title = document.createElement('div');
      title.className = 'pixel-font-14 text-whiteRegular';
      title.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      title.appendChild(createBattleHelperProfileLink(request.requesterName));
      title.appendChild(document.createTextNode(` — ${mapLabel}`));
      textCol.appendChild(title);

      const meta = document.createElement('div');
      meta.className = 'pixel-font-12 text-whiteRegular';
      meta.style.opacity = '0.85';
      const replyCount = getHelpRepliesList(request).length;
      meta.textContent = [
        formatHelpGoalLabel(request.goalType, request.goalValue),
        formatHelpAge(request.createdAt),
        tReplace('mods.battleHelper.help.replyCount', { n: String(replyCount) })
      ].filter(Boolean).join(' · ');
      textCol.appendChild(meta);
      row.appendChild(textCol);

      const selectRow = () => {
        selectHelpRequest(request);
      };
      row.addEventListener('click', selectRow);
      row.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectRow();
        }
      });
      listBody.appendChild(row);
    });

    listScroll.refit();
    renderDetail();
    if (typeof onContentChange === 'function') {
      requestAnimationFrame(() => onContentChange());
    }
  }

  async function refreshList({ preserveStatus = false } = {}) {
    updateOpenRequestsTitle();
    try {
      const requests = await fetchHelpRequests();
      helpBoardState.requests = requests;
      if (helpBoardState.selectedId && !requests.some((r) => r.id === helpBoardState.selectedId)) {
        helpBoardState.selectedId = null;
      }
      renderList();
      updateOpenRequestsTitle(requests.length);
      setHelpBoardOpenCount(countUnhelpedOpenRequests(requests));
      if (!preserveStatus) {
        setHelpStatus(tReplace('mods.battleHelper.help.loadedCount', {
          n: String(requests.length)
        }));
      }
    } catch (error) {
      updateOpenRequestsTitle();
      setHelpStatus(String(error?.message || error), 'error');
    }
  }

  refreshButton.addEventListener('click', () => { refreshList(); });
  renderDetail();

  function clearHelpSelection() {
    selectRequestSeq += 1;
    abortHelpBoardInFlightOperations();
    helpBoardState.selectedId = null;
    renderList();
  }
  clearHelpSelectionRef = clearHelpSelection;
  shared.clearHelpSelection = clearHelpSelection;

  return {
    askColumn,
    detailColumn,
    refreshList,
    clearHelpSelection
  };
}

function buildModalContent(onContentChange) {
  const root = document.createElement('div');
  root.className = 'battle-helper-modal-root flex min-h-0 flex-col';
  root.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%; flex: 1 1 0; min-height: 0; height: 100%; box-sizing: border-box;';

  const columns = document.createElement('div');
  columns.className = 'battle-helper-columns';
  columns.style.cssText = 'display: flex; flex-direction: row; gap: 8px; align-items: stretch; width: 100%; flex: 1 1 0; min-height: 0; box-sizing: border-box;';

  const shared = {};
  const profileColumn = buildImportPanel(onContentChange, shared);
  const helpColumns = buildHelpBoardColumns(onContentChange, shared);

  columns.appendChild(profileColumn);
  columns.appendChild(helpColumns.askColumn);
  columns.appendChild(helpColumns.detailColumn);
  root.appendChild(columns);

  if (typeof helpColumns.refreshList === 'function') {
    helpColumns.refreshList();
  }
  return root;
}


// =======================
// 8. Mod Button State
// =======================
function injectBattleHelperButtonStyles() {
  if (document.getElementById(BATTLE_HELPER_BUTTON_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = BATTLE_HELPER_BUTTON_STYLE_ID;
  style.textContent = `
    @keyframes battle-helper-imported-colors {
      0%, 100% {
        color: #ff9f43;
        text-shadow: 0 0 8px rgba(255, 159, 67, 0.85);
      }
      33% {
        color: #54a0ff;
        text-shadow: 0 0 8px rgba(84, 160, 255, 0.85);
      }
      66% {
        color: #c678dd;
        text-shadow: 0 0 8px rgba(198, 120, 221, 0.85);
      }
    }
    #${BUTTON_ID}.${BATTLE_HELPER_BUTTON_IMPORTED_CLASS} {
      animation: battle-helper-imported-colors 2.4s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
}

function setHelpBoardOpenCount(count) {
  const next = Math.max(0, Number(count) || 0);
  if (helpBoardState.openCount === next) {
    syncBattleHelperButtonState();
    return;
  }
  helpBoardState.openCount = next;
  syncBattleHelperButtonState();
}

async function refreshHelpBoardOpenCount() {
  try {
    const requests = await fetchHelpRequests();
    helpBoardState.requests = Array.isArray(requests) ? requests : helpBoardState.requests;
    setHelpBoardOpenCount(countUnhelpedOpenRequests(requests));
  } catch (error) {
    console.warn('[Battle Helper] refreshHelpBoardOpenCount:', error);
  }
}

function startHelpBoardButtonPolling() {
  if (battleHelpButtonPollTimer) return;
  refreshHelpBoardOpenCount();
  battleHelpButtonPollTimer = setInterval(() => {
    refreshHelpBoardOpenCount();
  }, BATTLE_HELP_BUTTON_POLL_MS);
}

function stopHelpBoardButtonPolling() {
  if (!battleHelpButtonPollTimer) return;
  clearInterval(battleHelpButtonPollTimer);
  battleHelpButtonPollTimer = null;
}

function getBattleHelperButtonLabel() {
  const count = Math.max(0, Number(helpBoardState.openCount) || 0);
  if (count > 0) {
    return tReplace('mods.battleHelper.titleWithCount', { n: String(count) });
  }
  return t('mods.battleHelper.title');
}

function syncBattleHelperButtonState() {
  const button = document.getElementById(BUTTON_ID);
  if (!button) return;

  injectBattleHelperButtonStyles();

  const label = getBattleHelperButtonLabel();
  const tooltip = sessionState.replaced
    ? t('mods.battleHelper.importedTooltip')
    : t('mods.battleHelper.defaultTooltip');

  if (typeof api !== 'undefined' && api?.ui?.updateButton) {
    api.ui.updateButton(BUTTON_ID, { text: label, tooltip });
  } else {
    button.title = tooltip;
    const textSpan = button.querySelector('span:last-child') || button;
    if (textSpan) textSpan.textContent = label;
  }

  if (sessionState.replaced) {
    button.classList.add(BATTLE_HELPER_BUTTON_IMPORTED_CLASS);
  } else {
    button.classList.remove(BATTLE_HELPER_BUTTON_IMPORTED_CLASS);
  }
}

// =======================
// 9. Modal Orchestration
// =======================
function getBattleHelperDialog(modalRef) {
  if (modalRef?.element) return modalRef.element;
  if (modalRef instanceof HTMLElement) return modalRef;
  return document.querySelector('div[role="dialog"][data-state="open"]');
}

function clearBattleHelperModalLayoutCleanup() {
  if (battleHelperModalLayoutCleanup) {
    battleHelperModalLayoutCleanup();
    battleHelperModalLayoutCleanup = null;
  }
}

function clearBattleHelperModalCleanup() {
  abortHelpBoardInFlightOperations();
  clearBattleHelperModalLayoutCleanup();
  clearModalPublishSetupButton();
}

function attachBattleHelperModalCloseCleanup(modalRef) {
  if (!modalRef) return;
  const runCleanup = () => clearBattleHelperModalCleanup();

  if (typeof modalRef.onClose === 'function') {
    modalRef.onClose(runCleanup);
  }

  const originalClose = modalRef.close?.bind(modalRef);
  if (originalClose) {
    modalRef.close = () => {
      runCleanup();
      originalClose();
    };
  }
}

function applyBattleHelperModalNaturalLayout(contentRoot) {
  if (!contentRoot) return;
  Object.assign(contentRoot.style, {
    flex: '0 0 auto',
    minHeight: '0',
    height: 'auto',
    maxHeight: 'none',
    width: '100%',
    minWidth: '0',
    maxWidth: '100%',
    boxSizing: 'border-box',
    overflowX: 'hidden',
    overflowY: 'visible',
    display: 'flex',
    flexDirection: 'column'
  });
}

function applyBattleHelperModalCompactLayout(rootWrapper, contentContainer, contentRoot) {
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: 'auto',
      display: 'flex',
      flexDirection: 'column',
      flex: '0 0 auto',
      minHeight: '0',
      gap: '0'
    });
  }
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '0 0 auto',
      minHeight: '0',
      marginTop: '-1px',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column'
    });
  }
  applyBattleHelperModalNaturalLayout(contentRoot);
}

function applyBattleHelperModalScrollLayout(rootWrapper, contentContainer, contentRoot) {
  if (rootWrapper) {
    Object.assign(rootWrapper.style, {
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      minHeight: '0',
      gap: '0'
    });
  }
  if (contentContainer) {
    Object.assign(contentContainer.style, {
      flex: '1 1 auto',
      minHeight: '0',
      marginTop: '-1px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    });
  }
  if (contentRoot) {
    Object.assign(contentRoot.style, {
      flex: '1 1 0',
      minHeight: '0',
      overflowX: 'hidden',
      overflowY: 'auto',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    });
  }
}

function measureBattleHelperModalNaturalHeight(dialog, contentRoot) {
  const rootWrapper = dialog.querySelector(':scope > div');
  if (rootWrapper?.offsetHeight > 0) {
    return rootWrapper.offsetHeight;
  }

  if (!contentRoot) return dialog.scrollHeight;

  const title = dialog.querySelector('.widget-top');
  const widgetBottom = dialog.querySelector('.widget-bottom');
  const separator = widgetBottom?.querySelector('.separator');
  const footer = widgetBottom?.querySelector('.flex.justify-end.gap-2');

  let chrome = 0;
  if (title) chrome += title.offsetHeight;
  if (separator) chrome += separator.offsetHeight;
  if (footer) chrome += footer.offsetHeight;
  if (widgetBottom) {
    const style = window.getComputedStyle(widgetBottom);
    chrome += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    chrome += parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  }

  return chrome + contentRoot.scrollHeight;
}

function stabilizeBattleHelperModalRendering(dialog) {
  if (!dialog) return;
  dialog.classList.remove('w-full', 'max-w-[300px]');
  dialog.style.transform = 'translate(-50%, -50%) scale(1)';
  dialog.style.willChange = 'auto';
}

function applyBattleHelperModalLayout(modalRef, contentRoot, dimensions) {
  const dialog = getBattleHelperDialog(modalRef);
  if (!dialog) return;

  const { width, height, maxHeight } = dimensions;
  const snappedWidth = snapBattleHelperModalPx(width);
  const snappedHeight = snapBattleHelperModalPx(height);
  const rootWrapper = dialog.querySelector(':scope > div');
  const contentContainer = dialog.querySelector('.widget-bottom');

  dialog.style.width = `${snappedWidth}px`;
  dialog.style.minWidth = '0';
  dialog.style.maxWidth = `${snappedWidth}px`;
  dialog.style.boxSizing = 'border-box';
  dialog.id = BATTLE_HELPER_MODAL_ID;
  stabilizeBattleHelperModalRendering(dialog);

  const widgetTop = dialog.querySelector('.widget-top');
  if (widgetTop) {
    widgetTop.style.margin = '0';
    const titleText = widgetTop.querySelector('p');
    if (titleText) titleText.style.margin = '0';
  }

  dialog.style.height = `${snappedHeight}px`;
  dialog.style.minHeight = `${snappedHeight}px`;
  dialog.style.maxHeight = `${maxHeight}px`;

  applyBattleHelperModalScrollLayout(rootWrapper, contentContainer, contentRoot);
  styleBattleHelperFooterButtons(dialog.querySelector('.flex.justify-end.gap-2'));
}

function setupBattleHelperModalResponsiveLayout(modalRef, contentRoot) {
  clearBattleHelperModalLayoutCleanup();
  activeBattleHelperModal = modalRef;
  const apply = () => applyBattleHelperModalLayout(modalRef, contentRoot, getModalDimensions());
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  battleHelperModalLayoutCleanup = () => {
    window.removeEventListener('resize', onResize);
    if (activeBattleHelperModal === modalRef) {
      activeBattleHelperModal = null;
    }
  };
}

function openBattleHelperModal() {
  try {
    if (activeBattleHelperModal?.close) {
      activeBattleHelperModal.close();
    }
  } catch (_) { /* ignore */ }
  clearBattleHelperModalCleanup();
  let modalRef;
  const refitLayout = () => {
    if (modalRef) {
      applyBattleHelperModalLayout(modalRef, content, getModalDimensions());
    }
  };
  const content = buildModalContent(refitLayout);
  const dims = getModalDimensions();
  modalRef = api.ui.components.createModal({
    title: t('mods.battleHelper.title'),
    width: dims.width,
    content,
    buttons: [{
      text: t('mods.battleHelper.close'),
      primary: true,
      onClick: () => clearBattleHelperModalCleanup()
    }]
  });
  setupBattleHelperModalResponsiveLayout(modalRef, content);
  attachBattleHelperModalCloseCleanup(modalRef);
}

// =======================
// 10. Entry Point, Exports, Cleanup
// =======================
api.ui.addButton({
  id: BUTTON_ID,
  modId: MOD_ID,
  text: t('mods.battleHelper.title'),
  icon: '🧬',
  tooltip: t('mods.battleHelper.defaultTooltip'),
  primary: false,
  onClick: openBattleHelperModal
});
requestAnimationFrame(() => syncBattleHelperButtonState());
startHelpBoardButtonPolling();

function hideButton() {
  const button = document.getElementById(BUTTON_ID);
  if (button) button.style.display = 'none';
}

function showButton() {
  const button = document.getElementById(BUTTON_ID);
  if (button) button.style.display = '';
}

context.exports = {
  open: openBattleHelperModal,
  hideButton,
  showButton,
  isViewingForeignProfile,
  cleanup: () => {
    abortHelpBoardInFlightOperations();
    clearBattleHelperPendingTimers();
    const wasViewingForeignProfile = sessionState.replaced === true;
    sessionState.lastProfileRaw = null;
    sessionState.lastNormalized = null;
    sessionState.lastUsername = '';
    sessionState.replaced = false;
    sessionState.backup = null;
    sessionState.helpMapName = '';
    sessionState.helpRequestId = '';
    sessionState.helpRoomId = '';
    helpBoardState.selectedId = null;
    helpBoardState.requests = [];
    helpBoardState.openCount = 0;
    clearHelpSelectionRef = null;
    stopHelpBoardButtonPolling();
    stopBattleHelperViewingProfileToast();
    stopBattleHelperPublishSetupToast();
    removeBattleHelperToastContainer();
    clearBattleHelperModalCleanup();
    if (battleHelperPublishBoardUnsub) {
      try {
        if (typeof battleHelperPublishBoardUnsub === 'function') battleHelperPublishBoardUnsub();
        else if (typeof battleHelperPublishBoardUnsub.unsubscribe === 'function') battleHelperPublishBoardUnsub.unsubscribe();
      } catch (_) { /* ignore */ }
    }
    battleHelperPublishBoardUnsub = null;
    battleHelperPublishToastBtn = null;
    battleHelperModalPublishBtn = null;
    battleHelperModalPublishBaseDisabled = true;
    syncBattleHelperButtonState();
    if (typeof window !== 'undefined' && window.battleHelper) {
      delete window.battleHelper;
    }
    if (wasViewingForeignProfile) resumeDepotManagerAfterRestore();
  }
};

if (typeof window !== 'undefined') {
  window.battleHelper = {
    open: openBattleHelperModal,
    hideButton,
    showButton,
    isViewingForeignProfile
  };
}

console.log('[Battle Helper] initialized');
})();
