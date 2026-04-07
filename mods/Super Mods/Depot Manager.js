// =======================
// Depot Manager — Super Mod (creature favorites; options live in Mod Settings → Depot Manager tab)
// =======================
'use strict';

console.log('[Depot Manager] initializing...');

// =======================
// 1. Configuration & Constants
// =======================

/** Legacy Mod Settings keys (creature favorites lived under Mod Settings before Depot Manager) */
const LEGACY_BETTER_UI_CONFIG_KEY = 'better-ui-config';
const LEGACY_FAVORITES_DATA_KEY = 'better-ui-favorites';

const DEPOT_CONFIG_KEY = 'depot-manager-config';
/** Canonical storage for favorite creatures after migration (was better-ui-favorites) */
const FAVORITES_STORAGE_KEY = 'depot-manager-favorites';

/** One-time: copy enableFavorites / favoriteSymbol from better-ui-config into depot-manager-config */
const LEGACY_MOD_SETTINGS_MIGRATION_KEY = 'depot-manager-legacy-mod-settings-v2';
/** One-time: copy JSON blob from better-ui-favorites into depot-manager-favorites */
const FAVORITES_DATA_MIGRATION_FLAG = 'depot-manager-favorites-data-migrated-v1';

const defaultDepotConfig = {
  enableFavorites: false,
  favoriteSymbol: 'heart',
  /** Always on: creature/equipment depot behavior is not user-toggleable anymore. */
  enableCreatureDepot: true
};

/** Ordered unique monster ids currently placed in the depot row (bottom of monster grid) */
const DEPOT_CREATURE_IDS_KEY = 'depot-manager-depot-creature-ids';
const DEPOT_CREATURE_META_KEY = 'depot-manager-depot-creature-meta-v1';
const DEPOT_EQUIPMENT_IDS_KEY = 'depot-manager-depot-equipment-ids-v1';

const depotCreatureState = {
  /** @type {string[]} */
  ids: [],
  /** @type {Map<string, { name?: string, gameId?: number|null, shiny?: boolean, exp?: number|null }>} */
  metaById: new Map()
};

const depotEquipmentState = {
  /** @type {string[]} */
  ids: []
};

let lastDepotLayoutCreatureRefreshAt = 0;

const GAME_CONSTANTS = {
  MAX_STAT_VALUE: 20,
  MAX_LEVEL: 50,
  MAX_TIER: 4
};

const SELECTORS = {
  CREATURE_IMG: 'img[alt="creature"]'
};

/** Set on the grid cell `div.flex` when user sends a creature to depot — layout uses this id (menu path) instead of re-guessing from DOM order. */
const DATA_DEPOT_SLOT_ID = 'data-depot-creature-id';
const DATA_DEPOT_HIDDEN = 'data-depot-hidden';
const DATA_DEPOT_EQUIPMENT_HIDDEN = 'data-depot-equipment-hidden';

const TIMEOUT_DELAYS = {
  MENU_CLOSE: 10,
  SUBMENU_HIDE: 100,
  TAB_REAPPLY: 100,
  FAVORITES_INIT: 500,
  /** Coalesced layout after external DOM changes (observer / favorites refresh). */
  CONTAINER_DEBOUNCE: 450,
  /** User explicitly moved a creature; apply soon after. */
  DEPOT_USER_ACTION: 80
};

const EXP_TABLE = [
  [5, 11250], [6, 17000], [7, 24000], [8, 32250], [9, 41750], [10, 52250],
  [11, 64250], [12, 77750], [13, 92250], [14, 108500], [15, 126250], [16, 145750],
  [17, 167000], [18, 190000], [19, 215250], [20, 242750], [21, 272750], [22, 305750],
  [23, 342000], [24, 382000], [25, 426250], [26, 475250], [27, 530000], [28, 591500],
  [29, 660500], [30, 738500], [31, 827000], [32, 928000], [33, 1043500], [34, 1176000],
  [35, 1329000], [36, 1505750], [37, 1710500], [38, 1948750], [39, 2226500], [40, 2550500],
  [41, 2929500], [42, 3373500], [43, 3894000], [44, 4504750], [45, 5222500], [46, 6066000],
  [47, 7058000], [48, 8225000], [49, 9598500], [50, 11214750]
];

const FAVORITE_SYMBOLS = {
  heart: { name: 'Heart', icon: '❤️' },
  hp: { name: 'HP', icon: 'https://bestiaryarena.com/assets/icons/heal.png' },
  attackdamage: { name: 'AD', icon: 'https://bestiaryarena.com/assets/icons/attackdamage.png' },
  abilitypower: { name: 'AP', icon: 'https://bestiaryarena.com/assets/icons/abilitypower.png' },
  attackspeed: { name: 'APS', icon: 'https://bestiaryarena.com/assets/icons/attackspeed.png' },
  armor: { name: 'ARM', icon: 'https://bestiaryarena.com/assets/icons/armor.png' },
  magicresist: { name: 'MR', icon: 'https://bestiaryarena.com/assets/icons/magicresist.png' },
  speed: { name: 'SPD', icon: 'https://bestiaryarena.com/assets/icons/speed.png' },
  shinystar: { name: 'Shiny', icon: 'https://bestiaryarena.com/assets/icons/shiny-star.png' },
  none: { name: '(none)', icon: null, isNone: true }
};

const favoritesState = {
  creatures: new Map(),
  buttonListeners: new WeakMap(),
  lastOptimizedUpdate: 0,
  lastLoggedResult: null
};

const activeTimeouts = new Set();
const depotObservers = { contextMenu: null, monsterGrid: null, arsenalGrid: null, tabButtons: null, inventory: null };
let depotInventoryRefreshInterval = null;
let depotInventoryDebounceTimeout = null;
let depotArsenalObserveTarget = null;
let lastArsenalDiagnosisAt = 0;

/** Prevents MutationObserver feedback while we reorder the grid (appendChild triggers subtree mutations). */
let depotLayoutApplying = false;
/** @type {Element | null} */
let depotMonsterGridObserveTarget = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let depotLayoutPendingTimeout = null;

let depotConfig;
let currentRightClickedCreature = null;
let currentRightClickedEquipment = null;
let depotInitialized = false;
let depotTabClickListener = null;
let tabReapplyDebounceTimeout = null;
let lastTabReapplyScheduleAt = 0;
let lastArsenalObserverStateKey = '';
let lastArsenalNoButtonsLogAt = 0;
let lastAssignSummaryKey = '';
let lastRemoveSummaryKey = '';
const recentManualEquipmentDepotRemovals = new Map();
const fallbackConsumedDepotEquipmentIds = new Set();
let lastDepotEquipmentIdsHash = '';
let lastArsenalButtonsForFallback = 0;

const t = (key) => api.i18n.t(key);

// =======================
// 2. Logging & Debug
// =======================

function depotDebug(...args) {
  if (typeof window !== 'undefined' && window.BESTIARY_DEBUG === true) {
    console.log('[Depot Manager]', ...args);
  }
}

// =======================
// 3. Migration & Storage
// =======================

function readLegacyBetterUiConfig() {
  try {
    const legacy = localStorage.getItem(LEGACY_BETTER_UI_CONFIG_KEY);
    if (!legacy) return null;
    return JSON.parse(legacy);
  } catch (e) {
    return null;
  }
}

/**
 * Copy Mod Settings favorite options into depot-manager-config when they exist in better-ui-config.
 * Runs once per browser (migration flag), then legacy keys can remain until Mod Settings saves without them.
 */
function migrateLegacyModSettingsIntoDepotConfig() {
  if (localStorage.getItem(LEGACY_MOD_SETTINGS_MIGRATION_KEY)) return;
  try {
    const parsed = readLegacyBetterUiConfig();
    if (parsed) {
      let changed = false;
      if (typeof parsed.enableFavorites === 'boolean' && depotConfig.enableFavorites !== parsed.enableFavorites) {
        depotConfig.enableFavorites = parsed.enableFavorites;
        changed = true;
      }
      if (typeof parsed.favoriteSymbol === 'string' && parsed.favoriteSymbol && depotConfig.favoriteSymbol !== parsed.favoriteSymbol) {
        depotConfig.favoriteSymbol = parsed.favoriteSymbol;
        changed = true;
      }
      if (changed) saveDepotConfig();
    }
    localStorage.setItem(LEGACY_MOD_SETTINGS_MIGRATION_KEY, '1');
  } catch (e) {
    console.warn('[Depot Manager] Legacy Mod Settings config migration:', e);
    try {
      localStorage.setItem(LEGACY_MOD_SETTINGS_MIGRATION_KEY, '1');
    } catch (e2) { /* ignore */ }
  }
}

/**
 * Copy favorite creature map from better-ui-favorites to depot-manager-favorites if the new key is empty.
 */
function migrateLegacyFavoritesDataBlob() {
  if (localStorage.getItem(FAVORITES_DATA_MIGRATION_FLAG)) return;
  try {
    const legacy = localStorage.getItem(LEGACY_FAVORITES_DATA_KEY);
    const next = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (legacy && !next) {
      localStorage.setItem(FAVORITES_STORAGE_KEY, legacy);
      console.log('[Depot Manager] Copied favorite creature data from better-ui-favorites → depot-manager-favorites');
    } else if (legacy && next) {
      try {
        const d = JSON.parse(next);
        const l = JSON.parse(legacy);
        if (Object.keys(d).length === 0 && Object.keys(l).length > 0) {
          localStorage.setItem(FAVORITES_STORAGE_KEY, legacy);
          console.log('[Depot Manager] Filled depot-manager-favorites from better-ui-favorites (was empty)');
        }
      } catch (e) { /* ignore */ }
    }
    localStorage.setItem(FAVORITES_DATA_MIGRATION_FLAG, '1');
  } catch (e) {
    console.warn('[Depot Manager] Legacy favorites data migration:', e);
    try {
      localStorage.setItem(FAVORITES_DATA_MIGRATION_FLAG, '1');
    } catch (e2) { /* ignore */ }
  }
}

function loadDepotConfig() {
  try {
    const raw = localStorage.getItem(DEPOT_CONFIG_KEY);
    if (raw) {
      depotConfig = Object.assign({}, defaultDepotConfig, JSON.parse(raw));
    } else {
      // No depot file yet: seed from Mod Settings (better-ui-config) when those fields exist
      const parsed = readLegacyBetterUiConfig();
      depotConfig = Object.assign({}, defaultDepotConfig);
      if (parsed) {
        if (typeof parsed.enableFavorites === 'boolean') {
          depotConfig.enableFavorites = parsed.enableFavorites;
        }
        if (typeof parsed.favoriteSymbol === 'string' && parsed.favoriteSymbol) {
          depotConfig.favoriteSymbol = parsed.favoriteSymbol;
        }
      }
      saveDepotConfig();
    }

    // Depot is always ON now; keep any stored value overridden.
    depotConfig.enableCreatureDepot = true;
    // If depot file already existed: still copy any favorite fields from old config once (legacy wins for that pass)
    migrateLegacyModSettingsIntoDepotConfig();
  } catch (error) {
    console.error('[Depot Manager] Error loading config:', error);
    depotConfig = Object.assign({}, defaultDepotConfig);
  }
}

function saveDepotConfig() {
  try {
    localStorage.setItem(DEPOT_CONFIG_KEY, JSON.stringify(depotConfig));
    if (typeof window !== 'undefined') {
      window.depotManagerConfig = depotConfig;
    }
  } catch (error) {
    console.error('[Depot Manager] Error saving config:', error);
  }
}

function loadDepotCreatureIds() {
  try {
    const raw = localStorage.getItem(DEPOT_CREATURE_IDS_KEY);
    if (!raw) {
      depotCreatureState.ids = [];
      return;
    }
    const parsed = JSON.parse(raw);
    depotCreatureState.ids = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (e) {
    depotCreatureState.ids = [];
  }
  updateDepotInventoryButtonCount();
}

function loadDepotCreatureMeta() {
  try {
    const raw = localStorage.getItem(DEPOT_CREATURE_META_KEY);
    if (!raw) {
      depotCreatureState.metaById = new Map();
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      depotCreatureState.metaById = new Map();
      return;
    }
    depotCreatureState.metaById = new Map(
      Object.entries(parsed).map(([id, meta]) => [String(id), meta || {}])
    );
  } catch (e) {
    console.error('[Depot Manager] Error loading depot creature meta:', e);
    depotCreatureState.metaById = new Map();
  }
}

function saveDepotCreatureIds() {
  try {
    localStorage.setItem(DEPOT_CREATURE_IDS_KEY, JSON.stringify(depotCreatureState.ids));
  } catch (e) {
    console.error('[Depot Manager] Error saving depot creature ids:', e);
  }
}

function loadDepotEquipmentIds() {
  try {
    const raw = localStorage.getItem(DEPOT_EQUIPMENT_IDS_KEY);
    if (!raw) {
      depotEquipmentState.ids = [];
      return;
    }
    const parsed = JSON.parse(raw);
    depotEquipmentState.ids = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (e) {
    depotEquipmentState.ids = [];
  }
}

function saveDepotEquipmentIds() {
  try {
    localStorage.setItem(DEPOT_EQUIPMENT_IDS_KEY, JSON.stringify(depotEquipmentState.ids));
  } catch (e) {
    console.error('[Depot Manager] Error saving depot equipment ids:', e);
  }
}

function removeOneDepotEquipmentId(id) {
  const sid = String(id);
  const idx = depotEquipmentState.ids.indexOf(sid);
  if (idx >= 0) depotEquipmentState.ids.splice(idx, 1);
}

function saveDepotCreatureMeta() {
  try {
    localStorage.setItem(
      DEPOT_CREATURE_META_KEY,
      JSON.stringify(Object.fromEntries(depotCreatureState.metaById))
    );
  } catch (e) {
    console.error('[Depot Manager] Error saving depot creature meta:', e);
  }
}

function upsertDepotCreatureMeta(uniqueId, partialMeta) {
  const sid = String(uniqueId || '').trim();
  if (!sid || !partialMeta || typeof partialMeta !== 'object') return;
  const prev = depotCreatureState.metaById.get(sid) || {};
  const next = {
    name: partialMeta.name ?? prev.name,
    gameId: partialMeta.gameId ?? prev.gameId ?? null,
    shiny: typeof partialMeta.shiny === 'boolean' ? partialMeta.shiny : !!prev.shiny,
    exp: Number.isFinite(partialMeta.exp) ? partialMeta.exp : (prev.exp ?? null),
    hp: Number.isFinite(partialMeta.hp) ? partialMeta.hp : Number(prev.hp || 0),
    ad: Number.isFinite(partialMeta.ad) ? partialMeta.ad : Number(prev.ad || 0),
    ap: Number.isFinite(partialMeta.ap) ? partialMeta.ap : Number(prev.ap || 0),
    armor: Number.isFinite(partialMeta.armor) ? partialMeta.armor : Number(prev.armor || 0),
    magicResist: Number.isFinite(partialMeta.magicResist) ? partialMeta.magicResist : Number(prev.magicResist || 0),
    tier: Number.isFinite(partialMeta.tier) ? partialMeta.tier : (Number.isFinite(prev.tier) ? prev.tier : null)
  };
  depotCreatureState.metaById.set(sid, next);
}

function removeOneDepotId(id) {
  const idx = depotCreatureState.ids.indexOf(id);
  if (idx >= 0) depotCreatureState.ids.splice(idx, 1);
}

function getDepotIdCounts() {
  const counts = new Map();
  for (const id of depotCreatureState.ids) {
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  return counts;
}

function getDepotChestAssetUrl() {
  const assetPath = '/assets/depot/Depot_Chest.gif';
  const base = typeof window !== 'undefined' && window.BESTIARY_EXTENSION_BASE_URL;
  if (base) {
    const normalizedBase = base.endsWith('/') ? base : `${base}/`;
    const path = assetPath.startsWith('/') ? assetPath.slice(1) : assetPath;
    return normalizedBase + path;
  }
  try {
    const runtimeApi = window.browserAPI || window.chrome || window.browser || api;
    if (runtimeApi?.runtime?.getURL) return runtimeApi.runtime.getURL(assetPath);
  } catch (e) { /* ignore */ }
  return assetPath;
}

function getInventoryContainerElement() {
  return document.querySelector('.container-inventory-4');
}

function getInventoryAnchorButton() {
  const container = getInventoryContainerElement();
  if (!container) return null;
  const bestiaryButton = Array.from(container.querySelectorAll('button')).find((btn) =>
    btn.querySelector('.sprite.item.id-10327, img[alt="10327"]')
  );
  if (bestiaryButton) return bestiaryButton;
  const allButtons = Array.from(container.querySelectorAll('button.focus-style-visible.active\\:opacity-70')).filter(
    (btn) => !btn.classList.contains('depot-manager-inventory-button')
  );
  if (allButtons.length === 0) return null;
  const summonBtn = allButtons.find((button) => {
    const img = button.querySelector('img');
    return Boolean(img?.src && img.src.includes('summonscroll'));
  });
  return summonBtn || allButtons[0];
}

function updateDepotInventoryButtonCount() {
  const countEl = document.querySelector('.depot-manager-item-count');
  if (!countEl) return;
  // Counter intentionally hidden; keep hook for potential future re-enable.
  countEl.textContent = '';
}

function getDepotCreatureRows() {
  const monsters = getPlayerMonsters();
  const byId = new Map(monsters.map((m) => [String(m.id), m]));
  const byGameId = new Map();
  monsters.forEach((m) => {
    if (m?.gameId == null || byGameId.has(String(m.gameId))) return;
    byGameId.set(String(m.gameId), m);
  });
  return depotCreatureState.ids.map((id) => {
    const sid = String(id);
    const monster = byId.get(sid) || null;
    const savedMeta = depotCreatureState.metaById.get(sid) || null;
    const gameId = monster?.gameId ?? savedMeta?.gameId ?? null;
    const shiny = typeof monster?.shiny === 'boolean' ? monster.shiny : !!savedMeta?.shiny;
    const portrait = gameId != null ? `/assets/portraits/${gameId}${shiny ? '-shiny' : ''}.png` : '';
    const exp = monster?.exp ?? savedMeta?.exp ?? null;
    const level = exp != null ? getLevelFromExp(exp || 0) : null;
    let resolvedName = monster?.metadata?.name || savedMeta?.name || '';
    if (!resolvedName && gameId != null) {
      const monsterByGameId = byGameId.get(String(gameId)) || null;
      resolvedName = monsterByGameId?.metadata?.name || '';
    }
    if (!resolvedName && gameId != null) {
      try {
        resolvedName = globalThis.state?.utils?.getMonster?.(Number(gameId))?.metadata?.name || '';
      } catch (e) { /* ignore */ }
    }
    const name = resolvedName || `Unknown (${sid})`;
    const hp = monster?.hp ?? savedMeta?.hp ?? 0;
    const ad = monster?.ad ?? savedMeta?.ad ?? 0;
    const ap = monster?.ap ?? savedMeta?.ap ?? 0;
    const armor = monster?.armor ?? savedMeta?.armor ?? 0;
    const magicResist = monster?.magicResist ?? savedMeta?.magicResist ?? 0;
    const genesTotal = hp + ad + ap + armor + magicResist;
    let rarity = 1;
    if (genesTotal >= 80) rarity = 5;
    else if (genesTotal >= 70) rarity = 4;
    else if (genesTotal >= 60) rarity = 3;
    else if (genesTotal >= 50) rarity = 2;
    const tier = monster?.tier ?? savedMeta?.tier ?? null;
    return { id: sid, name, portrait, shiny, level, gameId, hp, ad, ap, armor, magicResist, genesTotal, rarity, tier };
  });
}

function getPlayerEquipmentRows(options = {}) {
  const { sort = true } = options;
  try {
    const playerSnapshot = globalThis.state?.player?.getSnapshot();
    const equips = playerSnapshot?.context?.equips || [];
    if (!Array.isArray(equips) || equips.length === 0) return [];
    const rows = equips
      .filter((equip) => equip && equip.gameId)
      .map((equip, index) => {
        let equipData = null;
        try {
          equipData = globalThis.state?.utils?.getEquipment(equip.gameId) || null;
        } catch (e) { /* ignore */ }
        const name = equipData?.metadata?.name || `Equipment ${equip.gameId}`;
        const spriteId = equipData?.metadata?.spriteId || null;
        return {
          id: String(equip.id || `equip_${index}`),
          gameId: equip.gameId,
          name,
          spriteId,
          stat: String(equip.stat || 'unknown'),
          tier: Number(equip.tier || 1)
        };
      });
    if (sort) {
      rows.sort((a, b) => {
        if (a.tier !== b.tier) return b.tier - a.tier;
        const nameCmp = a.name.localeCompare(b.name);
        if (nameCmp !== 0) return nameCmp;
        return a.stat.localeCompare(b.stat);
      });
    }
    return rows;
  } catch (error) {
    console.error('[Depot Manager] Error loading equipment rows:', error);
    return [];
  }
}

function parseEquipmentMenuMeta(menuElem) {
  const firstItem = menuElem?.querySelector('.dropdown-menu-item');
  const txt = (firstItem?.textContent || '').trim();
  if (!txt || !/\(Tier:\s*\d+\)/i.test(txt)) return null;
  const m = txt.match(/^(.*?)\s*\(Tier:\s*(\d+)\)/i);
  if (!m) return null;
  return { name: String(m[1] || '').trim(), tier: Number.parseInt(m[2], 10) || 1 };
}

function resolveEquipmentIdForContextMenu(menuElem) {
  const target = currentRightClickedEquipment?.target || null;
  const button = target?.closest?.('button') || null;
  const directId =
    button?.getAttribute?.('data-equipment-id') ||
    button?.getAttribute?.('data-item-id') ||
    button?.getAttribute?.('data-id') ||
    target?.getAttribute?.('data-equipment-id') ||
    null;
  if (directId) {
    const sid = String(directId);
    if (button) button.setAttribute('data-equipment-id', sid);
    return sid;
  }

  const meta = parseEquipmentMenuMeta(menuElem);
  if (!meta) return null;
  const all = getPlayerEquipmentRows();
  const byNameTier = all.filter((e) => e.name === meta.name && Number(e.tier || 1) === Number(meta.tier || 1));
  if (byNameTier.length === 0) return null;
  const notYetStored = byNameTier.find((e) => !depotEquipmentState.ids.includes(String(e.id)));
  const sid = String((notYetStored || byNameTier[0]).id);
  if (button) button.setAttribute('data-equipment-id', sid);
  return sid;
}

function getLiveEquipmentIdFromRightClickTarget() {
  const target = currentRightClickedEquipment?.target || null;
  if (!target) return null;
  const direct =
    target.closest?.('button[data-equipment-id]') ||
    target.closest?.('div.flex[data-state]')?.querySelector?.('button[data-equipment-id]') ||
    null;
  const sid = direct?.getAttribute?.('data-equipment-id') || null;
  return sid ? String(sid) : null;
}

function removeClickedEquipmentSlotFromDom() {
  const target = currentRightClickedEquipment?.target || null;
  if (!target) return false;
  const stateSlot = target.closest?.('div.flex[data-state]');
  if (stateSlot && stateSlot.querySelector('button')) {
    stateSlot.setAttribute(DATA_DEPOT_EQUIPMENT_HIDDEN, 'true');
    stateSlot.style.setProperty('display', 'none', 'important');
    return true;
  }
  const button = target.closest?.('button');
  if (button && !button.closest('[role="dialog"]')) {
    button.setAttribute(DATA_DEPOT_EQUIPMENT_HIDDEN, 'true');
    button.style.setProperty('display', 'none', 'important');
    return true;
  }
  return false;
}

function applyEquipmentDepotLayout() {
  if (document.querySelector('[role="dialog"], [data-radix-dialog-content]')) return;
  if (depotArsenalObserveTarget === document.body) return;
  const buttons = getArsenalGridButtons();
  if (buttons.length === 0) return;
  const depotIds = depotEquipmentState.ids.map(String);
  const shouldHideAny = depotIds.length > 0;
  const idCounts = new Map();
  for (const sid of depotIds) idCounts.set(sid, (idCounts.get(sid) || 0) + 1);

  let hiddenCount = 0;
  // Non-destructive mode: never remove/reinsert React-owned nodes; only hide/show.
  for (const btn of buttons) {
    const slot = btn.closest('div.flex[data-state]') || btn;
    slot.removeAttribute(DATA_DEPOT_EQUIPMENT_HIDDEN);
    slot.style.removeProperty('display');
    if (!shouldHideAny) continue;
    const sid = String(btn.getAttribute('data-equipment-id') || '');
    if (!sid) continue;
    const remainingById = idCounts.get(sid) || 0;
    if (remainingById <= 0) continue;
    idCounts.set(sid, remainingById - 1);
    slot.setAttribute(DATA_DEPOT_EQUIPMENT_HIDDEN, 'true');
    slot.style.setProperty('display', 'none', 'important');
    hiddenCount += 1;
  }
  const stillPending = Array.from(idCounts.values()).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
  const removeKey = `${buttons.length}|${hiddenCount}|${stillPending}|${idCounts.size}`;
  if (hiddenCount > 0 || removeKey !== lastRemoveSummaryKey) {
    depotDebug('arsenal remove', {
      buttons: buttons.length,
      removed: hiddenCount,
      pending: stillPending,
      ids: idCounts.size
    });
    lastRemoveSummaryKey = removeKey;
  }
}

function resolveArsenalDomRefs() {
  const isInsideDialog = (node) => !!node?.closest?.('[role="dialog"], [data-radix-dialog-content]');
  const directScroll =
    document.getElementById('equip-scroll') ||
    document.querySelector('[id*="equip"][id*="scroll"]') ||
    document.querySelector('[id*="arsenal"][id*="scroll"]');
  if (directScroll && !isInsideDialog(directScroll)) {
    const viewport = directScroll.querySelector('[data-radix-scroll-area-viewport]');
    const grid = viewport?.querySelector('div.flex.flex-wrap') || null;
    return { equipScroll: directScroll, viewport: viewport || null, grid };
  }

  const viewports = Array.from(document.querySelectorAll('[data-radix-scroll-area-viewport]'));
  let best = null;
  for (const viewport of viewports) {
    if (isInsideDialog(viewport)) continue;
    const grid = viewport.querySelector('div.flex.flex-wrap');
    if (!grid) continue;
    const equipmentButtonCount = grid.querySelectorAll('button .sprite.item, button img[alt="stat type"]').length;
    if (!best || equipmentButtonCount > best.equipmentButtonCount) {
      best = {
        equipScroll: viewport.closest('[id*="scroll"]') || viewport.parentElement || viewport,
        viewport,
        grid,
        equipmentButtonCount
      };
    }
  }
  if (!best || best.equipmentButtonCount <= 0) return { equipScroll: null, viewport: null, grid: null };
  return { equipScroll: best.equipScroll, viewport: best.viewport, grid: best.grid };
}

function getArsenalGridButtons() {
  const refs = resolveArsenalDomRefs();
  if (!refs.grid) return [];
  return Array.from(refs.grid.querySelectorAll(':scope button')).filter((btn) => {
    if (btn.closest?.('[role="dialog"], [data-radix-dialog-content]')) return false;
    return !!(btn.querySelector('.sprite.item') || btn.querySelector('img[alt="stat type"]'));
  });
}

function createArsenalEquipmentButtonFromRow(row) {
  let button = null;
  if (row?.spriteId && typeof api?.ui?.components?.createItemPortrait === 'function') {
    try {
      const portrait = api.ui.components.createItemPortrait({
        itemId: row.spriteId,
        stat: row.stat,
        tier: row.tier
      });
      if (portrait instanceof HTMLElement) {
        if (portrait.tagName === 'BUTTON') {
          button = portrait;
        } else {
          button = document.createElement('button');
          button.className = 'focus-style-visible active:opacity-70';
          button.appendChild(portrait);
        }
      }
    } catch (e) { /* ignore */ }
  }
  if (!button) {
    button = document.createElement('button');
    button.className = 'focus-style-visible active:opacity-70';
    const fallback = document.createElement('div');
    fallback.className = 'container-slot surface-darker';
    fallback.style.cssText = 'width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ddd;';
    fallback.textContent = String(row?.tier || 1);
    button.appendChild(fallback);
  }
  button.setAttribute('data-equipment-id', String(row.id));
  button.setAttribute('data-tier', String(row.tier || 1));
  button.setAttribute('data-stat', String(row.stat || 'unknown'));
  button.setAttribute('data-equipment', String(row.name || ''));
  if (!button.getAttribute('title')) {
    button.title = `${row.name} | ${String(row.stat || '').toUpperCase()} | T${row.tier}`;
  }
  return button;
}

function compareArsenalEquipmentSort(a, b) {
  const tierA = Number(a?.tier || 1);
  const tierB = Number(b?.tier || 1);
  if (tierA !== tierB) return tierB - tierA;
  const nameA = String(a?.name || '');
  const nameB = String(b?.name || '');
  const nameCmp = nameA.localeCompare(nameB);
  if (nameCmp !== 0) return nameCmp;
  const statA = normalizeEquipmentStat(a?.stat || '');
  const statB = normalizeEquipmentStat(b?.stat || '');
  const statOrder = {
    attackdamage: 0,
    abilitypower: 1,
    heal: 2
  };
  const rankA = Object.prototype.hasOwnProperty.call(statOrder, statA) ? statOrder[statA] : 999;
  const rankB = Object.prototype.hasOwnProperty.call(statOrder, statB) ? statOrder[statB] : 999;
  if (rankA !== rankB) return rankA - rankB;
  return statA.localeCompare(statB);
}

function getArsenalSortRowFromButton(button) {
  if (!button) return null;
  const title = String(button.getAttribute('title') || '');
  const titleName = title.includes('|') ? title.split('|')[0].trim() : '';
  return {
    tier: Number(getButtonTier(button) || 1),
    name: String(button.getAttribute('data-equipment') || titleName || ''),
    stat: normalizeEquipmentStat(button.getAttribute('data-stat') || getButtonStat(button) || '')
  };
}

function restoreDepotEquipmentToArsenalDom(row) {
  if (!row?.id) return false;
  // Non-destructive mode: unhide will be handled by applyEquipmentDepotLayout.
  applyEquipmentDepotLayout();
  return true;
}

function normalizeEquipmentStat(statRaw) {
  const s = String(statRaw || '').toLowerCase().trim();
  const map = {
    hp: 'heal',
    heal: 'heal',
    ad: 'attackdamage',
    attackdamage: 'attackdamage',
    ap: 'abilitypower',
    abilitypower: 'abilitypower',
    arm: 'armor',
    armor: 'armor',
    mr: 'magicresist',
    magicresist: 'magicresist',
    aps: 'attackspeed',
    attackspeed: 'attackspeed',
    spd: 'speed',
    speed: 'speed'
  };
  return map[s] || s;
}

function getButtonSpriteId(button) {
  const sprite = button?.querySelector('.sprite.item');
  if (!sprite) return '';
  for (const cls of Array.from(sprite.classList)) {
    const m = /^id-(\d+)$/.exec(cls);
    if (m) return m[1];
  }
  return '';
}

function getButtonTier(button) {
  const directTierRaw = button?.getAttribute?.('data-tier') || '';
  const directTier = Number.parseInt(directTierRaw, 10);
  if (Number.isFinite(directTier) && directTier > 0) return directTier;

  const rarityRaw = button?.querySelector('.has-rarity')?.getAttribute('data-rarity') || '';
  const rarityTier = Number.parseInt(rarityRaw, 10);
  if (Number.isFinite(rarityTier) && rarityTier > 0) return rarityTier;

  const buttonRarityRaw = button?.getAttribute?.('data-rarity') || '';
  const buttonRarityTier = Number.parseInt(buttonRarityRaw, 10);
  if (Number.isFinite(buttonRarityTier) && buttonRarityTier > 0) return buttonRarityTier;

  return 1;
}

function getButtonStat(button) {
  const src = button?.querySelector('img[alt="stat type"]')?.getAttribute('src') || '';
  const filename = src.split('/').pop() || '';
  const key = filename.replace('.png', '').trim().toLowerCase();
  return normalizeEquipmentStat(key);
}

function getEquipmentSignatureFromRow(row) {
  const spriteId = String(row?.spriteId || '');
  const tier = Number(row?.tier || 1);
  const stat = normalizeEquipmentStat(row?.stat || 'unknown');
  return `${spriteId}|${tier}|${stat}`;
}

function getEquipmentSignatureFromButton(button) {
  if (!button) return '';
  const spriteId = getButtonSpriteId(button);
  const tier = Number(getButtonTier(button) || 1);
  const stat = getButtonStat(button);
  return `${spriteId}|${tier}|${stat}`;
}

function pruneRecentManualEquipmentDepotRemovals(now = Date.now()) {
  for (const [signature, payload] of recentManualEquipmentDepotRemovals.entries()) {
    if (!payload || payload.expiresAt <= now || payload.count <= 0) {
      recentManualEquipmentDepotRemovals.delete(signature);
    }
  }
}

function getTopSignatureEntries(countsMap, limit = 5) {
  return Array.from(countsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([signature, count]) => ({ signature, count }));
}

function logArsenalDiagnosisSnapshot(reason = 'unknown') {
  if (!(typeof window !== 'undefined' && window.BESTIARY_DEBUG === true)) return;
  const now = Date.now();
  if (now - lastArsenalDiagnosisAt < 1200) return;
  lastArsenalDiagnosisAt = now;

  const buttons = getArsenalGridButtons();
  if (buttons.length === 0) return;
  const equipmentRows = getPlayerEquipmentRows({ sort: false });
  const byId = new Map(equipmentRows.map((row) => [String(row.id), row]));

  const expected = new Map();
  for (const id of depotEquipmentState.ids) {
    const row = byId.get(String(id));
    if (!row) continue;
    const signature = getEquipmentSignatureFromRow(row);
    expected.set(signature, (expected.get(signature) || 0) + 1);
  }

  const visible = new Map();
  for (const btn of buttons) {
    const signature = `${getButtonSpriteId(btn)}|${Number(getButtonTier(btn) || 1)}|${getButtonStat(btn)}`;
    visible.set(signature, (visible.get(signature) || 0) + 1);
  }

  const diff = new Map();
  for (const [sig, count] of expected) {
    diff.set(sig, (diff.get(sig) || 0) + count);
  }
  for (const [sig, count] of visible) {
    diff.set(sig, (diff.get(sig) || 0) - count);
  }
  const topDiff = Array.from(diff.entries())
    .filter(([, delta]) => delta !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([signature, delta]) => ({ signature, delta }));

  depotDebug('arsenal snapshot', {
    reason,
    depotEquipmentIds: depotEquipmentState.ids.length,
    buttons: buttons.length,
    expectedTop5: getTopSignatureEntries(expected, 5),
    visibleTop5: getTopSignatureEntries(visible, 5),
    diffTop5: topDiff
  });
}

function assignEquipmentIdsToArsenalButtons() {
  const buttons = getArsenalGridButtons();
  if (buttons.length === 0) return;
  // IMPORTANT: keep raw state order here; sorted order can mismatch arsenal DOM after tab remount.
  const equipmentRows = getPlayerEquipmentRows({ sort: false });
  if (equipmentRows.length === 0) {
    return;
  }

  const exactBuckets = new Map();
  const looseBuckets = new Map();
  const isInDepot = new Set(depotEquipmentState.ids.map(String));
  const sortedRows = equipmentRows
    .slice()
    .sort((a, b) => {
      const aInDepot = isInDepot.has(String(a.id));
      const bInDepot = isInDepot.has(String(b.id));
      if (aInDepot !== bInDepot) return aInDepot ? 1 : -1; // prioritize non-depot ids
      return 0;
    });
  for (const row of sortedRows) {
    const spriteId = String(row.spriteId || '');
    const stat = normalizeEquipmentStat(row.stat || 'unknown');
    const tier = Number(row.tier || 1);
    const exactKey = `${spriteId}|${stat}|${tier}`;
    const looseKey = `${spriteId}|${stat}`;
    if (!exactBuckets.has(exactKey)) exactBuckets.set(exactKey, []);
    if (!looseBuckets.has(looseKey)) looseBuckets.set(looseKey, []);
    exactBuckets.get(exactKey).push(row);
    looseBuckets.get(looseKey).push(row);
  }

  let matchedCount = 0;
  let unmatchedCount = 0;
  for (const btn of buttons) {
    const spriteId = getButtonSpriteId(btn);
    const stat = getButtonStat(btn);
    const tier = getButtonTier(btn) || 1;
    const exactKey = `${spriteId}|${stat}|${tier}`;
    const looseKey = `${spriteId}|${stat}`;
    let row = null;
    const exact = exactBuckets.get(exactKey);
    if (exact && exact.length > 0) row = exact.shift();
    if (!row) {
      const loose = looseBuckets.get(looseKey);
      if (loose && loose.length > 0) row = loose.shift();
    }
    if (!row) {
      unmatchedCount += 1;
      continue;
    }

    btn.setAttribute('data-equipment-id', String(row.id));
    btn.setAttribute('data-tier', String(row.tier || tier || 1));
    btn.setAttribute('data-stat', String(row.stat || stat || 'unknown'));
    btn.setAttribute('data-equipment', String(row.name || ''));
    matchedCount += 1;
  }
  const assignKey = `${buttons.length}|${equipmentRows.length}|${matchedCount}|${unmatchedCount}`;
  if (assignKey !== lastAssignSummaryKey) {
    depotDebug('arsenal assign', {
      buttons: buttons.length,
      rows: equipmentRows.length,
      matched: matchedCount,
      unmatched: unmatchedCount
    });
    lastAssignSummaryKey = assignKey;
  }
}

function attachArsenalObservation() {
  if (!depotObservers.arsenalGrid) return;
  depotObservers.arsenalGrid.disconnect();
  const refs = resolveArsenalDomRefs();
  if (refs.equipScroll) {
    if (refs.grid) {
      depotArsenalObserveTarget = refs.grid;
      depotObservers.arsenalGrid.observe(refs.grid, { childList: true, subtree: true });
      depotDebug('arsenal observe:grid', { children: refs.grid.childElementCount });
      return;
    }
    depotArsenalObserveTarget = refs.equipScroll;
    depotObservers.arsenalGrid.observe(refs.equipScroll, { childList: true, subtree: true });
    depotDebug('arsenal observe:scroll');
    return;
  }
  depotArsenalObserveTarget = null;
  depotDebug('arsenal observe:none');
}

function startArsenalGridObserver() {
  if (depotObservers.arsenalGrid) return;
  const run = () => {
    if (!depotConfig?.enableCreatureDepot) return;
    if (document.querySelector('[role="dialog"], [data-radix-dialog-content]')) return;
    const buttons = getArsenalGridButtons();
    const target = depotArsenalObserveTarget === document.body
      ? 'body'
      : (depotArsenalObserveTarget?.id || depotArsenalObserveTarget?.className || 'unknown');
    if (!depotArsenalObserveTarget || buttons.length === 0) return;
    const now = Date.now();
    const runStateKey = `${target}|${buttons.length}|${depotEquipmentState.ids.length}`;
    const shouldLogNoButtonsHeartbeat = buttons.length === 0 && (now - lastArsenalNoButtonsLogAt > 4000);
    if (runStateKey !== lastArsenalObserverStateKey || shouldLogNoButtonsHeartbeat) {
      depotDebug('arsenal tick', {
        target,
        buttons: buttons.length,
        depot: depotEquipmentState.ids.length
      });
      lastArsenalObserverStateKey = runStateKey;
      if (buttons.length === 0) lastArsenalNoButtonsLogAt = now;
    }
    assignEquipmentIdsToArsenalButtons();
    logArsenalDiagnosisSnapshot('arsenal-observer-before-remove');
    applyEquipmentDepotLayout();
  };
  depotObservers.arsenalGrid = createThrottledObserver(run, 120);
  attachArsenalObservation();
  run();
}

function stopArsenalGridObserver() {
  if (depotObservers.arsenalGrid) {
    depotObservers.arsenalGrid.disconnect();
    depotObservers.arsenalGrid = null;
  }
  depotArsenalObserveTarget = null;
}

// =======================
// 4. Depot Modal UI
// =======================

const DEPOT_CREATURE_SEARCH_TOOLTIP = `Search Syntaxes:
• Stat search: /HP 20, /AD >15, /AP <=10, /ARM >=5, /MR <8
• Any stat: /20 (any stat equals 20), />15 (any stat > 15)
• Count stats: /3x20, />3x20, /<2x>15
• Exact match: "Spider"
• Combined: dragon AND /HP >15, /AD 20 OR /AP 20
• Operators: AND, OR (case insensitive)`;

const DEPOT_EQUIPMENT_SEARCH_TOOLTIP = `Search Syntaxes (Better Forge style):
• Name contains text (case-insensitive)
• Examples: helmet, amulet, blue robe
• Tier filtering uses the tier button on the right`;

function createDepotTooltipStatRow(label, value, maxValue, barColor = 'rgb(96, 192, 96)') {
  const statRow = document.createElement('div');
  statRow.setAttribute('data-transparent', 'false');
  statRow.className = 'pixel-font-16 whitespace-nowrap text-whiteRegular';

  const topRow = document.createElement('div');
  topRow.className = 'flex justify-between';

  const labelSpan = document.createElement('span');
  labelSpan.textContent = label;
  topRow.appendChild(labelSpan);

  const valueSpan = document.createElement('span');
  valueSpan.className = 'text-right text-whiteExp';
  valueSpan.style.width = '3ch';
  valueSpan.textContent = String(value);
  topRow.appendChild(valueSpan);

  statRow.appendChild(topRow);

  const barRow = document.createElement('div');
  barRow.className = 'relative';
  const barOuter = document.createElement('div');
  barOuter.className = 'frame-pressed-1 relative h-1 w-full overflow-hidden border border-solid border-black bg-black gene-stats-bar-filled';
  const barFillWrap = document.createElement('div');
  barFillWrap.className = 'absolute left-0 top-0 flex h-full w-full';
  const barFill = document.createElement('div');
  barFill.className = 'h-full shrink-0';
  const percentage = Math.min(100, Math.max(0, (Number(value || 0) / Number(maxValue || 20)) * 100));
  barFill.style.width = `${percentage}%`;
  barFill.style.background = barColor;
  barFillWrap.appendChild(barFill);
  barOuter.appendChild(barFillWrap);
  barRow.appendChild(barOuter);
  statRow.appendChild(barRow);
  return statRow;
}

function attachDepotCreatureStatTooltip(targetEl, row) {
  if (!targetEl || !row) return;
  let tooltipEl = null;
  let showTimeout = null;

  const buildTooltip = () => {
    const tooltip = document.createElement('div');
    tooltip.className = 'depot-manager-monster-tooltip';
    tooltip.style.cssText = 'position:fixed;display:none;z-index:10000;pointer-events:none;';

    const content = document.createElement('div');
    content.className = 'frame-pressed-1 surface-dark flex shrink-0 flex-col gap-1.5 px-2 py-1 pb-2';

    content.appendChild(createDepotTooltipStatRow('Hitpoints', Number(row.hp || 0), 20));
    content.appendChild(createDepotTooltipStatRow('Attack', Number(row.ad || 0), 20));
    content.appendChild(createDepotTooltipStatRow('Ability Power', Number(row.ap || 0), 20));
    content.appendChild(createDepotTooltipStatRow('Armor', Number(row.armor || 0), 20));
    content.appendChild(createDepotTooltipStatRow('Magic Resist', Number(row.magicResist || 0), 20));

    tooltip.appendChild(content);
    document.body.appendChild(tooltip);
    return tooltip;
  };

  const updatePosition = () => {
    if (!tooltipEl) return;
    const rect = targetEl.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    let left = rect.right + 10;
    let top = rect.top;
    if (left + tipRect.width > window.innerWidth) left = rect.left - tipRect.width - 10;
    if (top + tipRect.height > window.innerHeight) top = window.innerHeight - tipRect.height - 10;
    if (top < 10) top = 10;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  };

  const show = () => {
    if (showTimeout) clearTimeout(showTimeout);
    showTimeout = setTimeout(() => {
      if (!tooltipEl) tooltipEl = buildTooltip();
      tooltipEl.style.display = 'block';
      updatePosition();
    }, 220);
  };

  const hide = () => {
    if (showTimeout) {
      clearTimeout(showTimeout);
      showTimeout = null;
    }
    if (tooltipEl) {
      tooltipEl.remove();
      tooltipEl = null;
    }
  };

  targetEl.addEventListener('mouseenter', show);
  targetEl.addEventListener('mouseleave', hide);
  targetEl.addEventListener('mousemove', updatePosition);
  // Ensure tooltip never sticks when clicking/removing the creature tile.
  targetEl.addEventListener('pointerdown', hide, true);
  targetEl.addEventListener('click', hide, true);
}

function createDepotModalColumnFrame(titleText) {
  const frame = document.createElement('div');
  frame.style.cssText = 'flex:0 0 230px;width:230px;min-width:230px;max-width:230px;display:flex;flex-direction:column;min-height:220px;background:url("https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png") repeat;border:4px solid transparent;border-image:url("https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png") 6 fill stretch;border-radius:6px;overflow:hidden;';
  const titleEl = document.createElement('h2');
  titleEl.className = 'widget-top widget-top-text pixel-font-16';
  titleEl.style.cssText = 'margin:0;padding:2px 8px;height:24px;min-height:24px;max-height:24px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fff;box-sizing:border-box;';
  const p = document.createElement('p');
  p.className = 'pixel-font-16';
  p.style.cssText = 'margin:0;padding:0;text-align:center;color:#fff;font-size:16px;line-height:16px;font-weight:400;letter-spacing:0;white-space:nowrap;';
  p.textContent = titleText;
  titleEl.appendChild(p);
  frame.appendChild(titleEl);
  return frame;
}

function createDepotModalSearchWrap() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;padding:4px 6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:3px;margin:4px auto 4px 4px;width:90%;box-sizing:border-box;';
  return wrap;
}

function createDepotModalGridArea(uiConfig) {
  const area = document.createElement('div');
  area.style.cssText = `flex:1 1 0;min-height:0;overflow-y:auto;padding:5px ${uiConfig.GRID_PAD_RIGHT}px 5px ${uiConfig.GRID_PAD_LEFT}px;background:rgba(40,40,40,0.96);display:grid;grid-template-columns:repeat(${uiConfig.COLUMNS},${uiConfig.CELL}px);grid-auto-rows:${uiConfig.CELL}px;gap:${uiConfig.GRID_GAP}px;justify-content:start;`;
  return area;
}

function compareDepotStatValue(statValue, operator, targetValue) {
  switch (operator) {
    case '>': return statValue > targetValue;
    case '<': return statValue < targetValue;
    case '>=': return statValue >= targetValue;
    case '<=': return statValue <= targetValue;
    case '=':
    default: return statValue === targetValue;
  }
}

function extractDepotQuotedString(condition) {
  if ((condition.startsWith('"') && condition.endsWith('"')) || (condition.startsWith('\'') && condition.endsWith('\''))) {
    return { isExact: true, value: condition.slice(1, -1).toLowerCase() };
  }
  return { isExact: false, value: condition.toLowerCase() };
}

function matchesDepotStatsSearch(row, searchTerm) {
  const pattern = searchTerm.substring(1).trim();
  const comparisonMatch = pattern.match(/^(HP|AD|AP|ARM|MR)\s*(>=|<=|>|<|=)?\s*(\d+)$/i);
  if (comparisonMatch) {
    const [, statName, operator = '=', value] = comparisonMatch;
    const mapped = statName.toUpperCase() === 'ARM'
      ? 'armor'
      : statName.toUpperCase() === 'MR'
        ? 'magicResist'
        : statName.toLowerCase();
    return compareDepotStatValue(Number(row[mapped] || 0), operator, Number.parseInt(value, 10));
  }
  const anyStatMatch = pattern.match(/^(\d+)$/);
  if (anyStatMatch) {
    const target = Number.parseInt(anyStatMatch[1], 10);
    return ['hp', 'ad', 'ap', 'armor', 'magicResist'].some((key) => Number(row[key] || 0) === target);
  }
  const anyStatComparisonMatch = pattern.match(/^(>=|<=|>|<)\s*(\d+)$/);
  if (anyStatComparisonMatch) {
    const [, op, value] = anyStatComparisonMatch;
    const target = Number.parseInt(value, 10);
    return ['hp', 'ad', 'ap', 'armor', 'magicResist'].some((key) => compareDepotStatValue(Number(row[key] || 0), op, target));
  }
  const countStatMatch = pattern.match(/^(>=|<=|>|<|=)?\s*(\d+)x(>=|<=|>|<|=)?\s*(\d+)$/);
  if (countStatMatch) {
    const [, countOp = '=', count, statOp = '=', value] = countStatMatch;
    const targetCount = Number.parseInt(count, 10);
    const targetValue = Number.parseInt(value, 10);
    let matchingStats = 0;
    ['hp', 'ad', 'ap', 'armor', 'magicResist'].forEach((key) => {
      if (compareDepotStatValue(Number(row[key] || 0), statOp, targetValue)) matchingStats++;
    });
    return compareDepotStatValue(matchingStats, countOp, targetCount);
  }
  return false;
}

function matchesDepotSearchExpression(row, expression) {
  const normalized = (expression || '').trim().toLowerCase();
  if (!normalized) return true;
  if (normalized.includes(' or')) {
    return normalized.split(/\s+or\s*/).some((part) => matchesDepotSearchExpression(row, part));
  }
  if (normalized.includes(' and')) {
    return normalized.split(/\s+and\s*/).every((part) => matchesDepotSearchExpression(row, part));
  }
  if (normalized.startsWith('/')) {
    return matchesDepotStatsSearch(row, normalized);
  }
  const name = String(row.name || '').toLowerCase();
  const { isExact, value } = extractDepotQuotedString(normalized);
  return isExact ? name === value : name.includes(value);
}

function showDepotModal() {
  // Match Dice Roller flow: close existing modal(s) via ESC before opening.
  for (let i = 0; i < 2; i++) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, which: 27, bubbles: true }));
  }
  setTimeout(() => {
    const DEPOT_UI = {
      COLUMNS: 6,
      CELL: 34,
      GRID_GAP: 0,
      GRID_PAD_LEFT: 5,
      GRID_PAD_RIGHT: 12,
      MODAL_WIDTH: 510,
      MODAL_HEIGHT: 420
    };
    const content = document.createElement('div');
    content.style.cssText = 'width:100%;height:320px;min-height:320px;display:flex;flex-direction:column;gap:8px;';
    const columnsWrap = document.createElement('div');
    columnsWrap.style.cssText = 'flex:1 1 auto;display:flex;gap:8px;min-height:220px;';
    content.appendChild(columnsWrap);

    const creatureFrame = createDepotModalColumnFrame('Depot Creatures');
    const equipmentFrame = createDepotModalColumnFrame('Depot Equipments');
    columnsWrap.appendChild(creatureFrame);
    columnsWrap.appendChild(equipmentFrame);

    const creatureSearchWrap = createDepotModalSearchWrap();
    const creatureSearch = document.createElement('input');
    creatureSearch.type = 'text';
    creatureSearch.placeholder = 'Search creatures...';
    creatureSearch.title = DEPOT_CREATURE_SEARCH_TOOLTIP;
    creatureSearch.style.cssText = 'background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:3px 6px;border-radius:2px;font-size:12px;width:100%;font-family:inherit;outline:none;box-sizing:border-box;';
    creatureSearchWrap.appendChild(creatureSearch);
    creatureFrame.appendChild(creatureSearchWrap);
    const creatureArea = createDepotModalGridArea(DEPOT_UI);
    creatureFrame.appendChild(creatureArea);

    const equipmentSearchWrap = createDepotModalSearchWrap();
    const equipmentSearch = document.createElement('input');
    equipmentSearch.type = 'text';
    equipmentSearch.placeholder = 'Search equipment...';
    equipmentSearch.title = DEPOT_EQUIPMENT_SEARCH_TOOLTIP;
    equipmentSearch.style.cssText = 'background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:3px 6px;border-radius:2px;font-size:12px;flex:1;font-family:inherit;outline:none;box-sizing:border-box;';
    const equipmentFilterBtn = document.createElement('button');
    equipmentFilterBtn.textContent = 'All';
    equipmentFilterBtn.style.cssText = 'background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);padding:3px 8px;border-radius:2px;font-size:12px;cursor:pointer;font-family:inherit;outline:none;white-space:nowrap;min-width:50px;margin-left:4px;';
    equipmentSearchWrap.appendChild(equipmentSearch);
    equipmentSearchWrap.appendChild(equipmentFilterBtn);
    equipmentFrame.appendChild(equipmentSearchWrap);
    const equipmentArea = createDepotModalGridArea(DEPOT_UI);
    equipmentFrame.appendChild(equipmentArea);


    function createDepotCreatureButton(row) {
      const btn = document.createElement('button');
      btn.className = 'focus-style-visible active:opacity-70';
      btn.style.cssText = 'width:34px;height:34px;min-width:34px;min-height:34px;max-width:34px;max-height:34px;display:flex;align-items:center;justify-content:center;padding:0;margin:0;border:none;background:none;cursor:pointer;';
      btn.setAttribute('data-depot-id', row.id);
      const slot = document.createElement('div');
      slot.className = 'container-slot surface-darker relative flex items-center justify-center overflow-hidden';
      // Use fuller tile footprint to reduce perceived gap between creature cells.
      slot.style.cssText = 'width:34px;height:34px;min-width:34px;min-height:34px;max-width:34px;max-height:34px;';
      const rarityLayer = document.createElement('div');
      rarityLayer.setAttribute('role', 'none');
      rarityLayer.className = 'has-rarity absolute inset-0 z-1 opacity-80';
      rarityLayer.setAttribute('data-rarity', String(row.rarity || 1));
      slot.appendChild(rarityLayer);
      if (row.tier) {
        const starImg = document.createElement('img');
        starImg.alt = 'star tier';
        starImg.src = `/assets/icons/star-tier-${row.tier}.png`;
        starImg.className = 'tier-stars pixelated absolute right-0 top-0 z-2 opacity-75';
        slot.appendChild(starImg);
      }
      if (row.level != null) {
        const levelDiv = document.createElement('div');
        levelDiv.className = 'creature-level-badge';
        levelDiv.style.cssText = 'position:absolute;bottom:2px;left:2px;z-index:3;font-size:16px;color:#fff;text-shadow:0 1px 2px #000,0 0 2px #000;letter-spacing:0.5px;';
        levelDiv.textContent = String(row.level);
        slot.appendChild(levelDiv);
      }
      const img = document.createElement('img');
      img.className = 'pixelated ml-auto';
      img.width = 34;
      img.height = 34;
      img.alt = 'creature';
      img.src = row.portrait || getDepotChestAssetUrl();
      img.style.cssText = 'width:34px;height:34px;min-width:34px;min-height:34px;max-width:34px;max-height:34px;object-fit:contain;';
      slot.appendChild(img);
      btn.appendChild(slot);
      attachDepotCreatureStatTooltip(btn, row);
      btn.addEventListener('click', () => {
        removeOneDepotId(row.id);
        if (!depotCreatureState.ids.includes(String(row.id))) {
          depotCreatureState.metaById.delete(String(row.id));
          saveDepotCreatureMeta();
        }
        saveDepotCreatureIds();
        applyDepotLayout();
        updateDepotInventoryButtonCount();
        renderCreatureRows();
      });
      return btn;
    }

    function renderCreatureRows() {
      const term = (creatureSearch.value || '').trim();
      const rows = getDepotCreatureRows()
        .filter((r) => matchesDepotSearchExpression(r, term))
        .sort((a, b) => {
          const nameCompare = String(a.name || '').localeCompare(String(b.name || ''));
          if (nameCompare !== 0) return nameCompare;
          const levelA = Number(a.level || 0);
          const levelB = Number(b.level || 0);
          if (levelA !== levelB) return levelB - levelA;
          const genesA = Number(a.genesTotal || 0);
          const genesB = Number(b.genesTotal || 0);
          if (genesA !== genesB) return genesB - genesA;
          const gameIdCompare = String(a.gameId ?? '').localeCompare(String(b.gameId ?? ''));
          if (gameIdCompare !== 0) return gameIdCompare;
          return String(a.id || '').localeCompare(String(b.id || ''));
        });
      creatureArea.innerHTML = '';
      if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#bbb;text-align:center;padding:16px;grid-column:span 6;';
        empty.textContent = 'No creatures found.';
        creatureArea.appendChild(empty);
        return;
      }
      rows.forEach((row) => creatureArea.appendChild(createDepotCreatureButton(row)));
    }

    function createEquipmentButton(row) {
      const btn = document.createElement('button');
      btn.className = 'focus-style-visible active:opacity-70';
      btn.setAttribute('data-equipment-id', row.id);
      btn.style.cssText = 'width:34px;height:34px;min-width:34px;min-height:34px;max-width:34px;max-height:34px;display:flex;align-items:center;justify-content:center;padding:0;margin:0;border:none;background:none;cursor:pointer;';
      if (row.spriteId && typeof api?.ui?.components?.createItemPortrait === 'function') {
        try {
          const portrait = api.ui.components.createItemPortrait({
            itemId: row.spriteId,
            stat: row.stat,
            tier: row.tier
          });
          if (portrait) btn.appendChild(portrait);
        } catch (e) { /* ignore */ }
      }
      if (!btn.firstChild) {
        const fallback = document.createElement('div');
        fallback.className = 'container-slot surface-darker';
        fallback.style.cssText = 'width:34px;height:34px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#ddd;';
        fallback.textContent = String(row.tier || 1);
        btn.appendChild(fallback);
      }
      btn.title = `${row.name} | ${String(row.stat || '').toUpperCase()} | T${row.tier}`;
      return btn;
    }

    let equipmentFilterIdx = 0;
    const equipmentFilterOptions = ['All', 'Grey', 'Green', 'Blue', 'Purple', 'Yellow'];

    function matchesEquipmentTier(row, label) {
      if (!label || label.toLowerCase() === 'all') return true;
      const tier = Number(row.tier || 1);
      const map = { grey: 1, green: 2, blue: 3, purple: 4, yellow: 5 };
      return tier === (map[label.toLowerCase()] || tier);
    }

    function renderEquipmentRows() {
      const term = (equipmentSearch.value || '').trim().toLowerCase();
      const filterLabel = equipmentFilterOptions[equipmentFilterIdx] || 'All';
      const allEquipment = getPlayerEquipmentRows();
      const byId = new Map(allEquipment.map((e) => [String(e.id), e]));
      const rows = depotEquipmentState.ids
        .map((id) => byId.get(String(id)))
        .filter(Boolean)
        .filter((r) => (!term || r.name.toLowerCase().includes(term)) && matchesEquipmentTier(r, filterLabel))
        .sort((a, b) => {
          if (a.tier !== b.tier) return b.tier - a.tier;
          if (a.name !== b.name) return a.name.localeCompare(b.name);
          return a.stat.localeCompare(b.stat);
        });
      equipmentArea.innerHTML = '';
      if (rows.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:#bbb;text-align:center;padding:16px;grid-column:span 6;';
        empty.textContent = 'No depot equipment found.';
        equipmentArea.appendChild(empty);
        return;
      }
      rows.forEach((row) => {
        const btn = createEquipmentButton(row);
        btn.addEventListener('click', () => {
          removeOneDepotEquipmentId(row.id);
          saveDepotEquipmentIds();
          renderEquipmentRows();
          const restored = restoreDepotEquipmentToArsenalDom(row);
          if (restored) {
            assignEquipmentIdsToArsenalButtons();
          }
          scheduleTimeout(handleTabSwitchReapply, TIMEOUT_DELAYS.TAB_REAPPLY);
        });
        equipmentArea.appendChild(btn);
      });
    }

    creatureSearch.addEventListener('input', renderCreatureRows);
    equipmentSearch.addEventListener('input', renderEquipmentRows);
    equipmentFilterBtn.addEventListener('click', () => {
      equipmentFilterIdx = (equipmentFilterIdx + 1) % equipmentFilterOptions.length;
      equipmentFilterBtn.textContent = equipmentFilterOptions[equipmentFilterIdx];
      renderEquipmentRows();
    });

    renderCreatureRows();
    renderEquipmentRows();
    api.ui.components.createModal({
      title: 'Depot',
      width: DEPOT_UI.MODAL_WIDTH,
      height: DEPOT_UI.MODAL_HEIGHT,
      content,
      buttons: [{ text: 'Close', primary: true }]
    });
  }, 50);
}

function addDepotInventoryButton() {
  const existing = document.querySelector('.depot-manager-inventory-button');
  if (existing) {
    updateDepotInventoryButtonCount();
    return true;
  }
  const anchor = getInventoryAnchorButton();
  if (!anchor) return false;
  const inventoryBorderStyle = window.betterUIConfig?.inventoryBorderStyle || 'Original';
  const borderDiv = window.getInventoryBorderStyle ? window.getInventoryBorderStyle(inventoryBorderStyle) : '';
  const button = document.createElement('button');
  button.className = 'focus-style-visible active:opacity-70 depot-manager-inventory-button';
  button.innerHTML = `<div data-hoverable="true" data-highlighted="false" data-disabled="false" class="container-slot surface-darker data-[disabled=true]:dithered data-[highlighted=true]:unset-border-image data-[hoverable=true]:hover:unset-border-image"><div class="relative grid h-full place-items-center">${borderDiv}<img alt="depot chest" class="pixelated" width="32" height="32" src="${getDepotChestAssetUrl()}"></div></div>`;
  button.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showDepotModal();
  });
  anchor.insertAdjacentElement('afterend', button);
  updateDepotInventoryButtonCount();
  return true;
}

function startDepotInventoryObserver() {
  if (depotObservers.inventory) return;
  const run = () => {
    if (depotInventoryDebounceTimeout) {
      clearTimeout(depotInventoryDebounceTimeout);
      activeTimeouts.delete(depotInventoryDebounceTimeout);
    }
    depotInventoryDebounceTimeout = scheduleTimeout(() => {
      addDepotInventoryButton();
      depotInventoryDebounceTimeout = null;
    }, 80);
  };
  const shouldRunForNode = (node) => {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    return Boolean(
      node.classList?.contains('container-inventory-4') ||
      node.querySelector?.('.container-inventory-4') ||
      node.querySelector?.('button.focus-style-visible') ||
      node.matches?.('[role="tab"]')
    );
  };
  depotObservers.inventory = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (
          target?.getAttribute?.('role') === 'tab' &&
          mutation.attributeName === 'aria-selected' &&
          target.getAttribute('aria-selected') === 'true'
        ) {
          run();
          return;
        }
      }
      for (const node of mutation.addedNodes) {
        if (shouldRunForNode(node)) {
          run();
          return;
        }
      }
    }
  });
  depotObservers.inventory.observe(document.body, { childList: true, subtree: true });
  run();
  depotInventoryRefreshInterval = setInterval(() => addDepotInventoryButton(), 1000);
}

function stopDepotInventoryObserver() {
  if (depotObservers.inventory) {
    depotObservers.inventory.disconnect();
    depotObservers.inventory = null;
  }
  if (depotInventoryDebounceTimeout) {
    clearTimeout(depotInventoryDebounceTimeout);
    activeTimeouts.delete(depotInventoryDebounceTimeout);
    depotInventoryDebounceTimeout = null;
  }
  if (depotInventoryRefreshInterval) {
    clearInterval(depotInventoryRefreshInterval);
    depotInventoryRefreshInterval = null;
  }
  document.querySelectorAll('.depot-manager-inventory-button').forEach((el) => el.remove());
}

// =======================
// 5. Creature Depot Grid Layout
// =======================

function resetDepotCreatureIds() {
  depotCreatureState.ids = [];
  depotCreatureState.metaById.clear();
  depotEquipmentState.ids = [];
  saveDepotCreatureIds();
  saveDepotCreatureMeta();
  saveDepotEquipmentIds();
  const grid = getMonsterGridFlexContainer();
  if (grid) {
    grid.querySelectorAll(`[${DATA_DEPOT_SLOT_ID}]`).forEach((slot) => slot.removeAttribute(DATA_DEPOT_SLOT_ID));
    grid.querySelectorAll(`div.flex[${DATA_DEPOT_HIDDEN}]`).forEach((slot) => {
      slot.removeAttribute(DATA_DEPOT_HIDDEN);
      slot.style.removeProperty('display');
    });
    grid.querySelectorAll('[data-depot-separator]').forEach((el) => el.remove());
  }
  applyDepotLayout();
  updateDepotInventoryButtonCount();
}

function getMonsterGridFlexContainer() {
  const scroll = document.getElementById('monster-scroll');
  if (!scroll) return null;
  const viewport = scroll.querySelector('[data-radix-scroll-area-viewport]');
  if (!viewport) return null;
  return viewport.querySelector('div.flex.flex-wrap') || null;
}

/** Remove inline flex `order` we set for depot vs main (e.g. when toggling depot off). */
function clearDepotVisualOrderOnGridSlots(grid) {
  if (!grid) return;
  grid.querySelectorAll('div.flex').forEach((el) => {
    if (el.querySelector('img[alt="creature"]')) el.style.removeProperty('order');
  });
  grid.querySelectorAll('[data-depot-separator]').forEach((el) => el.style.removeProperty('order'));
}

/**
 * With `flex-wrap: wrap-reverse`, flex lines stack from the bottom of the container upward, so
 * appending depot nodes last in DOM puts them on the *first* visual row (top). Use explicit
 * `order` so main inventory stays above and depot stays at the bottom regardless of wrap mode.
 */
function applyDepotVisualOrderToSlots(grid, mainSlots, sep, orderedDepotSlots) {
  if (!grid) return;
  const wrap = getComputedStyle(grid).flexWrap;
  const reverse = wrap === 'wrap-reverse';
  const mainOrder = reverse ? '2' : '0';
  const sepOrder = '1';
  const depotOrder = reverse ? '0' : '2';
  mainSlots.forEach((s) => s.style.setProperty('order', mainOrder));
  orderedDepotSlots.forEach((s) => s.style.setProperty('order', depotOrder));
  if (sep) sep.style.setProperty('order', sepOrder);
}

function isInMonsterInventoryGrid(imgEl) {
  return Boolean(imgEl && imgEl.closest('#monster-scroll'));
}

/** Grid cell wrapper: direct child of the flex-wrap inventory grid (not inner flex wrappers). */
function getMonsterInventorySlotFromImg(creatureImg) {
  if (!creatureImg) return null;
  const scroll = document.getElementById('monster-scroll');
  const grid = getMonsterGridFlexContainer();
  if (!scroll || !grid || !scroll.contains(creatureImg)) return null;
  let el = creatureImg.parentElement;
  while (el && el !== scroll) {
    if (el.parentElement === grid && el.matches('div.flex')) return el;
    el = el.parentElement;
  }
  return null;
}

function setDepotSlotTagFromImg(creatureImg, uniqueIdOrNull) {
  const slot = getMonsterInventorySlotFromImg(creatureImg);
  if (!slot) return;
  if (uniqueIdOrNull == null || uniqueIdOrNull === '') {
    slot.removeAttribute(DATA_DEPOT_SLOT_ID);
  } else {
    slot.setAttribute(DATA_DEPOT_SLOT_ID, String(uniqueIdOrNull));
  }
}

function pauseMonsterGridObserverForLayout() {
  if (depotObservers.monsterGrid) {
    depotObservers.monsterGrid.disconnect();
  }
}

function attachMonsterGridObservation() {
  if (!depotObservers.monsterGrid) return;
  depotObservers.monsterGrid.disconnect();
  const grid = getMonsterGridFlexContainer();
  if (grid) {
    depotMonsterGridObserveTarget = grid;
    depotObservers.monsterGrid.observe(grid, { childList: true });
    return;
  }
  const scroll = document.getElementById('monster-scroll');
  if (scroll) {
    depotMonsterGridObserveTarget = scroll;
    depotObservers.monsterGrid.observe(scroll, { childList: true, subtree: true });
  }
}

function resumeMonsterGridObserverAfterLayout() {
  if (!depotConfig.enableCreatureDepot) return;
  attachMonsterGridObservation();
}

function applyDepotLayout() {
  if (!depotConfig.enableCreatureDepot) {
    const grid = getMonsterGridFlexContainer();
    if (grid) {
      grid.querySelectorAll('[data-depot-separator]').forEach((el) => el.remove());
      grid.querySelectorAll(`div.flex[${DATA_DEPOT_HIDDEN}]`).forEach((slot) => {
        slot.removeAttribute(DATA_DEPOT_HIDDEN);
        slot.style.removeProperty('display');
      });
    }
    return;
  }

  depotLayoutApplying = true;
  pauseMonsterGridObserverForLayout();

  try {
    const grid = getMonsterGridFlexContainer();
    if (!grid) {
      return;
    }

    const slotElements = Array.from(grid.children).filter(
      (el) => el.matches('div.flex') && el.querySelector('img[alt="creature"]')
    );
    // Reset visibility first; we re-hide selected slots below.
    slotElements.forEach((slot) => {
      slot.removeAttribute(DATA_DEPOT_HIDDEN);
      slot.style.removeProperty('display');
    });

    const gridImgs = slotElements
      .map((slot) => slot.querySelector('img[alt="creature"]'))
      .filter((img) => Boolean(img && isInMonsterInventoryGrid(img)));
    const creatureIdMap = buildCreatureImgToUniqueIdMap(gridImgs);
    const slotIdPairs = [];
    for (const slot of slotElements) {
      const img = slot.querySelector('img[alt="creature"]');
      if (!img || !isInMonsterInventoryGrid(img)) continue;
      let uid = slot.getAttribute(DATA_DEPOT_SLOT_ID);
      if (uid) uid = String(uid).trim();
      if (!uid) {
        let info = creatureIdMap.get(img);
        if (!info) {
          info = getCreatureUniqueId(img, null);
        }
        uid = info?.uniqueId != null ? String(info.uniqueId) : null;
      }
      if (uid) slotIdPairs.push({ slot, id: uid });
    }

    const desiredCountsForTags = getDepotIdCounts();
    for (const slot of slotElements) {
      const tagged = slot.getAttribute(DATA_DEPOT_SLOT_ID);
      if (!tagged) continue;
      const tid = String(tagged).trim();
      const remaining = desiredCountsForTags.get(tid) || 0;
      if (remaining <= 0) {
        slot.removeAttribute(DATA_DEPOT_SLOT_ID);
      } else {
        desiredCountsForTags.set(tid, remaining - 1);
      }
    }

    // Important: do NOT auto-prune persisted depot ids during layout.
    // React/radix remounts and duplicate creatures can change slot->id guessing between renders.
    depotDebug('applyDepotLayout: preserve persisted depot ids', {
      slotCount: slotElements.length,
      mappedCount: slotIdPairs.length,
      depotIds: [...depotCreatureState.ids]
    });

    const remainingToHide = getDepotIdCounts();
    let hiddenSlots = 0;
    for (const { slot, id } of slotIdPairs) {
      const remaining = remainingToHide.get(id) || 0;
      if (remaining <= 0) continue;
      slot.setAttribute(DATA_DEPOT_HIDDEN, 'true');
      slot.style.setProperty('display', 'none', 'important');
      hiddenSlots += 1;
      remainingToHide.set(id, remaining - 1);
    }

    // In hidden-mode depot, no visual separator/row is rendered.
    grid.querySelectorAll('[data-depot-separator]').forEach((el) => el.remove());
    depotDebug('applyDepotLayout done', {
      hiddenSlots,
      depotIds: [...depotCreatureState.ids]
    });
  } finally {
    depotLayoutApplying = false;
    scheduleTimeout(() => resumeMonsterGridObserverAfterLayout(), 0);
  }
}

function scheduleApplyDepotLayout(delay = TIMEOUT_DELAYS.CONTAINER_DEBOUNCE) {
  if (depotLayoutPendingTimeout !== null) {
    clearTimeout(depotLayoutPendingTimeout);
    activeTimeouts.delete(depotLayoutPendingTimeout);
  }
  depotLayoutPendingTimeout = setTimeout(() => {
    depotLayoutPendingTimeout = null;
    applyDepotLayout();
  }, delay);
  activeTimeouts.add(depotLayoutPendingTimeout);
}

function startMonsterGridObserver() {
  if (depotObservers.monsterGrid) return;

  const run = () => {
    if (!depotConfig.enableCreatureDepot || depotLayoutApplying) return;
    scheduleApplyDepotLayout();
  };

  depotObservers.monsterGrid = createThrottledObserver(run, 500);
  attachMonsterGridObservation();
}

function stopMonsterGridObserver() {
  if (depotObservers.monsterGrid) {
    depotObservers.monsterGrid.disconnect();
    depotObservers.monsterGrid = null;
  }
  depotMonsterGridObserveTarget = null;
}

// =======================
// 6. Context Menu Injection
// =======================

/**
 * Add/remove depot menu items (separate from favorites).
 * @returns {boolean}
 */
function validateDepotContextMenu(menuElem) {
  if (!depotConfig.enableCreatureDepot) return false;
  if (isScrollLocked()) return false;
  if (menuElem.hasAttribute('data-depot-processed')) return false;

  const creatureName = getCreatureNameFromMenu(menuElem);
  if (!creatureName) return false;

  const menuText = menuElem.textContent || '';
  if (/\(Tier: \d+\)/.test(menuText)) return false;
  if (menuText.toLowerCase().includes('my account') || menuText.toLowerCase().includes('logout')) return false;
  if (menuText.toLowerCase().includes('game mode') || menuText.toLowerCase().includes('manual')) return false;
  return true;
}

function injectDepotMenuItems(menuElem) {
  if (!validateDepotContextMenu(menuElem)) {
    // Expected when right-clicking equipment: keep creature debug output clean.
    if (parseEquipmentMenuMeta(menuElem)) return false;
    depotDebug('injectDepotMenuItems: validate failed', {
      enableCreatureDepot: depotConfig.enableCreatureDepot,
      scrollLocked: isScrollLocked(),
      alreadyProcessed: menuElem.hasAttribute('data-depot-processed'),
      creatureName: getCreatureNameFromMenu(menuElem)
    });
    return false;
  }
  if (!currentRightClickedCreature?.creatureImg || !isInMonsterInventoryGrid(currentRightClickedCreature.creatureImg)) {
    depotDebug('injectDepotMenuItems: no inventory creature context', {
      hasImg: !!currentRightClickedCreature?.creatureImg,
      inGrid: currentRightClickedCreature?.creatureImg
        ? isInMonsterInventoryGrid(currentRightClickedCreature.creatureImg)
        : false
    });
    return false;
  }

  const rightClickedImg = currentRightClickedCreature?.creatureImg || null;
  const creatureData = identifyCreatureFromMenu(menuElem);
  const uniqueId = getResolvedUniqueIdForCreatureImg(rightClickedImg) || creatureData?.uniqueId || null;
  if (!uniqueId) {
    depotDebug('injectDepotMenuItems: failed to resolve uniqueId', {
      fromMenu: creatureData?.uniqueId || null,
      hasRightClickedImg: !!rightClickedImg
    });
    return false;
  }

  menuElem.setAttribute('data-depot-processed', 'true');

  const sid = String(uniqueId);
  const clickedSlot = getMonsterInventorySlotFromImg(rightClickedImg);
  const inDepot = Boolean(
    clickedSlot &&
    String(clickedSlot.getAttribute(DATA_DEPOT_SLOT_ID) || '').trim() === sid
  );

  const depotLabel = inDepot ? t('mods.depot.sendToBestiary') : t('mods.depot.sendToDepot');
  let depotActionHandled = false;
  function runDepotMenuAction(e) {
    if (depotActionHandled) return;
    depotActionHandled = true;
    e.preventDefault();
    e.stopPropagation();
    const imgEl = currentRightClickedCreature?.creatureImg;
    const liveSid = getResolvedUniqueIdForCreatureImg(imgEl) || sid;
    const liveSlot = getMonsterInventorySlotFromImg(imgEl);
    const liveInDepot = Boolean(
      liveSlot &&
      String(liveSlot.getAttribute(DATA_DEPOT_SLOT_ID) || '').trim() === liveSid
    );
    if (liveInDepot) {
      removeOneDepotId(liveSid);
      if (!depotCreatureState.ids.includes(String(liveSid))) {
        depotCreatureState.metaById.delete(String(liveSid));
      }
      setDepotSlotTagFromImg(imgEl, null);
    } else {
      depotCreatureState.ids.push(liveSid);
      const monsters = getPlayerMonsters();
      const matchedMonster = monsters.find((m) => String(m.id) === String(liveSid)) || null;
      upsertDepotCreatureMeta(liveSid, {
        name: matchedMonster?.metadata?.name || creatureData?.creatureName || null,
        gameId: matchedMonster?.gameId ?? null,
        shiny: !!matchedMonster?.shiny,
        exp: matchedMonster?.exp ?? null,
        hp: matchedMonster?.hp ?? 0,
        ad: matchedMonster?.ad ?? 0,
        ap: matchedMonster?.ap ?? 0,
        armor: matchedMonster?.armor ?? 0,
        magicResist: matchedMonster?.magicResist ?? 0,
        tier: matchedMonster?.tier ?? null
      });
      setDepotSlotTagFromImg(imgEl, liveSid);
    }
    saveDepotCreatureIds();
    saveDepotCreatureMeta();
    updateDepotInventoryButtonCount();
    depotDebug('depot menu action', {
      sid: liveSid,
      inDepot: liveInDepot,
      idsAfter: [...depotCreatureState.ids],
      totalDepotIds: depotCreatureState.ids.length
    });
    console.info('[Depot Manager] Send to depot:', liveInDepot ? 'moved to bestiary' : 'hidden from grid', { creatureId: liveSid });
    currentRightClickedCreature = null;
    applyDepotLayout();
    // Avoid duplicate hide passes for duplicates in hidden-mode depot.
    scheduleApplyDepotLayout(TIMEOUT_DELAYS.DEPOT_USER_ACTION * 2);
    scheduleTimeout(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })
      );
    }, TIMEOUT_DELAYS.MENU_CLOSE);
  }
  const item = createDepotContextActionMenuItem(depotLabel, runDepotMenuAction);
  item.setAttribute('data-depot-menu-item', 'true');

  moveDepotMenuItemToBottom(menuElem, item);
  depotDebug('injectDepotMenuItems: row added', { sid, inDepot, label: item.textContent });
  return true;
}

function moveDepotMenuItemToBottom(menuElem, knownDepotItem = null) {
  if (!menuElem) return;
  const depotItem = knownDepotItem || menuElem.querySelector('[data-depot-menu-item="true"]');
  if (!depotItem) return;
  if (menuElem.lastElementChild !== depotItem) {
    menuElem.appendChild(depotItem);
  }
}

function createDepotContextActionMenuItem(labelText, onClick) {
  const item = document.createElement('div');
  item.className =
    'focus-style dropdown-menu-item flex cursor-default select-none items-center gap-2 outline-none data-[state=open]:bg-whiteDarkest data-[state=open]:text-whiteBrightest';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('data-orientation', 'vertical');
  item.setAttribute('data-radix-collection-item', '');
  item.style.cssText = 'color:white;background:transparent;padding:0 8px;height:20px;min-height:20px;max-height:20px;border:none;font-family:inherit;font-size:16px;font-weight:400;line-height:1;display:flex;align-items:center;';
  item.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package" aria-hidden="true"><path d="M21 8v8a1 1 0 0 1-.5.87l-7 4a1 1 0 0 1-1 0l-7-4A1 1 0 0 1 5 16V8"></path><path d="m3.3 7 8.2 4.73a1 1 0 0 0 1 0L20.7 7"></path><path d="M12 22V12"></path><path d="M5 5.5 12 2l7 3.5"></path></svg>${labelText}`;
  item.addEventListener('mouseenter', () => {
    item.style.background = 'rgba(255, 255, 255, 0.15)';
  });
  item.addEventListener('mouseleave', () => {
    item.style.background = 'transparent';
  });
  item.addEventListener('click', onClick, { capture: true });
  return item;
}

function validateEquipmentDepotContextMenu(menuElem) {
  if (!depotConfig.enableCreatureDepot) return false;
  if (!menuElem || menuElem.hasAttribute('data-depot-equipment-processed')) return false;
  const meta = parseEquipmentMenuMeta(menuElem);
  return Boolean(meta?.name);
}

function injectEquipmentDepotMenuItems(menuElem) {
  if (!validateEquipmentDepotContextMenu(menuElem)) return false;
  assignEquipmentIdsToArsenalButtons();
  const equipmentId = getLiveEquipmentIdFromRightClickTarget() || resolveEquipmentIdForContextMenu(menuElem);
  if (!equipmentId) return false;
  menuElem.setAttribute('data-depot-equipment-processed', 'true');
  const inDepot = depotEquipmentState.ids.includes(String(equipmentId));
  const label = inDepot ? t('mods.depot.sendToBestiary') : t('mods.depot.sendToDepot');
  const item = createDepotContextActionMenuItem(label, (e) => {
    e.preventDefault();
    e.stopPropagation();
    assignEquipmentIdsToArsenalButtons();
    const sid = String(getLiveEquipmentIdFromRightClickTarget() || equipmentId);
    const wasInDepot = depotEquipmentState.ids.includes(sid);
    const clickedButton = currentRightClickedEquipment?.target?.closest?.('button') || null;
    const clickedSignature = getEquipmentSignatureFromButton(clickedButton);
    if (wasInDepot) {
      removeOneDepotEquipmentId(sid);
      // Creature-like immediate restore: if Arsenal is open, reinsert now.
      const byId = new Map(getPlayerEquipmentRows({ sort: false }).map((r) => [String(r.id), r]));
      const row = byId.get(sid) || null;
      if (row && restoreDepotEquipmentToArsenalDom(row)) {
        assignEquipmentIdsToArsenalButtons();
      }
    } else {
      depotEquipmentState.ids.push(sid);
      removeClickedEquipmentSlotFromDom();
      if (clickedSignature) {
        const prev = recentManualEquipmentDepotRemovals.get(clickedSignature) || { count: 0, expiresAt: 0 };
        recentManualEquipmentDepotRemovals.set(clickedSignature, {
          count: Number(prev.count || 0) + 1,
          expiresAt: Date.now() + 1800
        });
      }
    }
    saveDepotEquipmentIds();
    // For "send to depot", avoid immediate global reapply in the same click because
    // duplicate signatures can remove an extra slot; observer/tab reapply will reconcile.
    if (wasInDepot) applyEquipmentDepotLayout();
    depotDebug('equipment depot menu action', {
      equipmentId: sid,
      inDepotBefore: wasInDepot,
      totalDepotEquipmentIds: depotEquipmentState.ids.length
    });
    console.info('[Depot Manager] Equipment depot:', wasInDepot ? 'moved to arsenal' : 'removed from arsenal DOM', { equipmentId: sid });
    scheduleTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }, TIMEOUT_DELAYS.MENU_CLOSE);
  });
  moveDepotMenuItemToBottom(menuElem, item);
  depotDebug('injectEquipmentDepotMenuItems: row added', { equipmentId, inDepot, label });
  return true;
}

// =======================
// 7. Shared Utilities
// =======================

/** Called when Mod Settings (or other UI) writes depot-manager-config */
function reloadDepotConfigFromStorage() {
  try {
    const raw = localStorage.getItem(DEPOT_CONFIG_KEY);
    depotConfig = Object.assign({}, defaultDepotConfig, raw ? JSON.parse(raw) : {});
    depotConfig.enableCreatureDepot = true;
    window.depotManagerConfig = depotConfig;
    if (depotConfig.enableFavorites) {
      scheduleTimeout(() => updateFavoriteHearts(), TIMEOUT_DELAYS.FAVORITES_INIT);
    } else {
      removeFavoriteHearts();
    }
    startMonsterGridObserver();
    startArsenalGridObserver();
    scheduleApplyDepotLayout();
    addDepotInventoryButton();
  } catch (e) {
    console.error('[Depot Manager] reloadDepotConfigFromStorage:', e);
  }
}

function scheduleTimeout(callback, delay) {
  const timeoutId = setTimeout(callback, delay);
  activeTimeouts.add(timeoutId);
  return timeoutId;
}

function createThrottledObserver(processCallback, throttleDelay = 50) {
  let lastProcessTime = 0;
  let pendingTimer = null;
  let pendingMutations = [];

  return new MutationObserver((mutations) => {
    const now = Date.now();
    pendingMutations.push(...mutations);

    if (now - lastProcessTime >= throttleDelay) {
      const mutationsToProcess = [...pendingMutations];
      pendingMutations = [];
      processCallback(mutationsToProcess);
      lastProcessTime = now;
    } else {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        activeTimeouts.delete(pendingTimer);
      }
      pendingTimer = scheduleTimeout(() => {
        const mutationsToProcess = [...pendingMutations];
        pendingMutations = [];
        processCallback(mutationsToProcess);
        lastProcessTime = Date.now();
        activeTimeouts.delete(pendingTimer);
        pendingTimer = null;
      }, throttleDelay - (now - lastProcessTime));
    }
  });
}

function getLevelFromExp(exp) {
  if (typeof exp !== 'number' || exp < EXP_TABLE[0][1]) return 1;
  for (let i = EXP_TABLE.length - 1; i >= 0; i--) {
    if (exp >= EXP_TABLE[i][1]) return EXP_TABLE[i][0];
  }
  return 1;
}

function isScrollLocked() {
  const raw = document.body.getAttribute('data-scroll-locked');
  if (raw == null || raw === '') return false;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n >= 2;
}

function isBlockedByAnalysisMods() {
  return window.ModCoordination?.isModActive('Board Analyzer') ||
    window.ModCoordination?.isModActive('Autoscroller');
}

function getCreatureGameId(imgElement) {
  const match = imgElement.src.match(/\/(\d+)(?:-shiny)?\.png$/);
  return match ? parseInt(match[1], 10) : null;
}

function getPlayerMonsters() {
  return globalThis.state?.player?.getSnapshot()?.context?.monsters || [];
}

function getVisibleCreatures() {
  return document.querySelectorAll(SELECTORS.CREATURE_IMG);
}

// =======================
// 8. Favorites
// =======================

function loadFavorites() {
  try {
    let saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!saved) {
      const legacy = localStorage.getItem(LEGACY_FAVORITES_DATA_KEY);
      if (legacy) {
        try {
          localStorage.setItem(FAVORITES_STORAGE_KEY, legacy);
          saved = legacy;
          console.log('[Depot Manager] Loaded favorite creatures from legacy better-ui-favorites into depot-manager-favorites');
        } catch (e) {
          saved = legacy;
        }
      }
    }
    if (saved) {
      const data = JSON.parse(saved);
      favoritesState.creatures = new Map(Object.entries(data));
    }
  } catch (error) {
    console.error('[Depot Manager] Error loading favorites:', error);
    favoritesState.creatures = new Map();
  }
}

function saveFavorites() {
  try {
    const data = Object.fromEntries(favoritesState.creatures);
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[Depot Manager] Error saving favorites:', error);
  }
}

async function lockCreatureAPI(uniqueId) {
  const requestBody = {
    '0': {
      json: {
        locked: true,
        monsterId: uniqueId
      }
    }
  };
  const response = await fetch('https://bestiaryarena.com/api/trpc/game.lockMonster?batch=1', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Game-Version': '1'
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return await response.json();
}

function updateLocalCreatureLock(uniqueId) {
  try {
    globalThis.state.player.send({
      type: 'setState',
      fn: (prev) => {
        const monsters = (prev.monsters || []).map(m =>
          m.id === uniqueId ? { ...m, locked: true } : m
        );
        return { ...prev, monsters };
      }
    });
    scheduleTimeout(() => {
      const contextMenu = document.querySelector('[role="menu"][data-state="open"]');
      if (contextMenu) {
        document.body.click();
      }
    }, TIMEOUT_DELAYS.MENU_CLOSE);
  } catch (e) {
    console.error('[Depot Manager] Failed to update state:', e);
    try {
      const monsters = getPlayerMonsters();
      const creature = monsters.find(m => m.id === uniqueId);
      if (creature) creature.locked = true;
    } catch (fallbackError) {
      console.error('[Depot Manager] Fallback also failed:', fallbackError);
    }
  }
}

async function toggleFavorite(uniqueId, symbolKey = 'heart') {
  if (favoritesState.creatures.has(uniqueId)) {
    favoritesState.creatures.set(uniqueId, symbolKey);
  } else {
    favoritesState.creatures.set(uniqueId, symbolKey);
    try {
      await lockCreatureAPI(uniqueId);
      updateLocalCreatureLock(uniqueId);
    } catch (error) {
      console.error('[Depot Manager] Failed to lock creature:', error);
      favoritesState.creatures.delete(uniqueId);
    }
  }
  saveFavorites();
  updateFavoriteHearts(uniqueId);
}

function getFirstCreatureMenuItem(menuElem) {
  const group = menuElem.querySelector('div[role="group"]');
  if (group) {
    const inGroup = group.querySelector('.dropdown-menu-item');
    if (inGroup) return inGroup;
  }
  return menuElem.querySelector('.dropdown-menu-item');
}

function getCreatureNameFromMenu(menuElem) {
  const firstItem = getFirstCreatureMenuItem(menuElem);
  if (!firstItem) return null;
  const text = firstItem.textContent;
  const monsterMatch = text.match(/^(.*?)\s*\(\d+%\)/);
  if (monsterMatch) return monsterMatch[1].trim();
  const equipmentMatch = text.match(/^(.*?)\s*\(Tier: \d+\)/);
  if (equipmentMatch) return equipmentMatch[1].trim();
  return null;
}

function validateContextMenu(menuElem) {
  if (!depotConfig.enableFavorites) return false;
  if (isScrollLocked()) return false;
  if (menuElem.hasAttribute('data-favorite-processed')) return false;

  const creatureName = getCreatureNameFromMenu(menuElem);
  if (!creatureName) return false;

  const menuText = menuElem.textContent || '';
  if (/\(Tier: \d+\)/.test(menuText)) return false;
  if (menuText.toLowerCase().includes('my account') || menuText.toLowerCase().includes('logout')) return false;
  if (menuText.toLowerCase().includes('game mode') || menuText.toLowerCase().includes('manual')) return false;
  return true;
}

function identifyCreatureFromMenu(menuElem) {
  let contextMenuPercentage = null;
  const firstItem = getFirstCreatureMenuItem(menuElem);
  if (firstItem) {
    const text = firstItem.textContent;
    const percentageMatch = text.match(/\((\d+)%\)/);
    if (percentageMatch) contextMenuPercentage = parseInt(percentageMatch[1], 10);
  }

  if (!currentRightClickedCreature?.creatureImg) return null;

  const creatureInfo = getCreatureUniqueId(currentRightClickedCreature.creatureImg, contextMenuPercentage);
  if (!creatureInfo) return null;

  const monsters = getPlayerMonsters();
  const creature = monsters.find(m => m.id === creatureInfo.uniqueId);

  return {
    gameId: creatureInfo.gameId,
    uniqueId: creatureInfo.uniqueId,
    creatureIndex: creatureInfo.index,
    isLocked: creature?.locked || false
  };
}

function createFavoriteMainMenuItem() {
  const item = document.createElement('div');
  item.className = 'focus-style dropdown-menu-item flex cursor-default select-none items-center gap-2 outline-none data-[state=open]:bg-whiteDarkest data-[state=open]:text-whiteBrightest';
  item.setAttribute('role', 'menuitem');
  item.setAttribute('aria-haspopup', 'menu');
  item.setAttribute('aria-expanded', 'false');
  item.setAttribute('aria-controls', 'favorite-submenu');
  item.setAttribute('data-state', 'closed');
  item.setAttribute('tabindex', '-1');
  item.setAttribute('data-orientation', 'vertical');
  item.setAttribute('data-radix-collection-item', '');
  return item;
}

function createFavoriteSubmenu(uniqueId, currentSymbol) {
  const submenu = document.createElement('div');
  submenu.id = 'favorite-submenu';
  submenu.className = 'pixel-font-16 frame-3 surface-regular z-modals min-w-[7rem] overflow-hidden py-1 text-whiteHighlight shadow-md';
  submenu.setAttribute('role', 'menu');
  submenu.setAttribute('aria-orientation', 'vertical');
  submenu.setAttribute('data-state', 'closed');
  submenu.setAttribute('data-radix-menu-content', '');
  submenu.style.cssText = 'position: absolute; left: 100%; top: 0; display: none; z-index: 1000; min-width: 120px;';

  const isFavorite = uniqueId ? favoritesState.creatures.has(uniqueId) : false;

  Object.entries(FAVORITE_SYMBOLS).forEach(([symbolKey, symbol]) => {
    const symbolItem = document.createElement('div');
    symbolItem.className = 'dropdown-menu-item relative flex cursor-default select-none items-center gap-1 outline-none';
    symbolItem.setAttribute('role', 'menuitem');
    symbolItem.setAttribute('tabindex', '-1');
    symbolItem.setAttribute('data-orientation', 'vertical');
    symbolItem.setAttribute('data-radix-collection-item', '');
    symbolItem.style.cssText = 'color: white; background: transparent; padding: 4px 8px; font-size: 14px; font-weight: 400; line-height: 1.2;';

    symbolItem.addEventListener('mouseenter', () => { symbolItem.style.background = 'rgba(255, 255, 255, 0.15)'; });
    symbolItem.addEventListener('mouseleave', () => { symbolItem.style.background = 'transparent'; });

    const isCurrentSymbol = isFavorite && currentSymbol === symbolKey;
    let iconElement = '';
    if (!symbol.isNone) {
      iconElement = symbolKey === 'heart'
        ? `<span style="font-size: 14px; line-height: 1;">${symbol.icon}</span>`
        : `<img src="${symbol.icon}" width="14" height="14" style="image-rendering: pixelated;" alt="${symbol.name}">`;
    }

    symbolItem.innerHTML = `${iconElement}${symbol.name}${isCurrentSymbol ? ' ✓' : ''}`;

    symbolItem.addEventListener('click', (e) => {
      e.stopPropagation();
      if (uniqueId) {
        if (symbol.isNone) {
          favoritesState.creatures.delete(uniqueId);
          saveFavorites();
          updateFavoriteHearts(uniqueId);
        } else {
          toggleFavorite(uniqueId, symbolKey);
        }
      }
      currentRightClickedCreature = null;
      scheduleTimeout(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
      }, TIMEOUT_DELAYS.MENU_CLOSE);
    });

    submenu.appendChild(symbolItem);
  });

  return submenu;
}

function attachSubmenuHandlers(mainItem, submenu) {
  mainItem.addEventListener('mouseenter', () => {
    mainItem.style.background = 'rgba(255, 255, 255, 0.15)';
    mainItem.setAttribute('data-state', 'open');
    mainItem.setAttribute('aria-expanded', 'true');
    submenu.setAttribute('data-state', 'open');
    submenu.style.display = 'block';
  });

  mainItem.addEventListener('mouseleave', () => {
    mainItem.style.background = 'transparent';
    scheduleTimeout(() => {
      if (!submenu.matches(':hover') && !mainItem.matches(':hover')) {
        mainItem.setAttribute('data-state', 'closed');
        mainItem.setAttribute('aria-expanded', 'false');
        submenu.setAttribute('data-state', 'closed');
        submenu.style.display = 'none';
      }
    }, TIMEOUT_DELAYS.SUBMENU_HIDE);
  });

  submenu.addEventListener('mouseenter', () => {
    submenu.style.display = 'block';
    submenu.setAttribute('data-state', 'open');
  });

  submenu.addEventListener('mouseleave', () => {
    submenu.style.display = 'none';
    submenu.setAttribute('data-state', 'closed');
    mainItem.setAttribute('data-state', 'closed');
    mainItem.setAttribute('aria-expanded', 'false');
  });
}

function injectFavoriteButton(menuElem) {
  if (!validateContextMenu(menuElem)) return false;
  menuElem.setAttribute('data-favorite-processed', 'true');

  const creatureData = identifyCreatureFromMenu(menuElem);
  const uniqueId = creatureData?.uniqueId || null;
  const currentSymbol = uniqueId ? favoritesState.creatures.get(uniqueId) : null;

  const favoriteMainItem = createFavoriteMainMenuItem();
  const submenu = createFavoriteSubmenu(uniqueId, currentSymbol);

  attachSubmenuHandlers(favoriteMainItem, submenu);

  favoriteMainItem.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>${t('mods.betterUI.favoriteMenuLabel')}<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right ml-auto" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

  favoriteMainItem.addEventListener('click', (e) => {
    e.stopPropagation();
    if (uniqueId) toggleFavorite(uniqueId, 'heart');
    currentRightClickedCreature = null;
    scheduleTimeout(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }, TIMEOUT_DELAYS.MENU_CLOSE);
  });

  favoriteMainItem.appendChild(submenu);
  menuElem.appendChild(favoriteMainItem);
  moveDepotMenuItemToBottom(menuElem);
  return true;
}

function removeFavoriteHearts() {
  document.querySelectorAll('.favorite-heart').forEach(heart => heart.remove());
}

function updateFavoriteHearts(targetUniqueId = null) {
  if (isBlockedByAnalysisMods()) return;

  if (!depotConfig.enableFavorites) {
    removeFavoriteHearts();
    return;
  }

  if (isScrollLocked()) return;

  const allCreatures = Array.from(getVisibleCreatures());
  const creatures = allCreatures.filter(imgEl => {
    const isInAnalyzer = imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="damage"]') ||
      imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="healing"]');
    const isInAutoplaySession = imgEl.closest('div[data-autosetup]') ||
      imgEl.closest('#autoseller-session-widget') ||
      imgEl.closest('#drop-widget-bottom-element');
    return !isInAnalyzer && !isInAutoplaySession;
  });

  if (creatures.length === 0) return;

  const monsters = getPlayerMonsters();

  if (targetUniqueId) {
    updateSingleFavoriteHeart(targetUniqueId, creatures, monsters);
    favoritesState.lastOptimizedUpdate = Date.now();
    return;
  }

  removeFavoriteHearts();
  const resolvedCreatures = resolveCreaturesSequentially(creatures, monsters);

  let heartsAdded = 0;
  let creaturesChecked = 0;

  resolvedCreatures.forEach(({ imgEl, uniqueId }) => {
    creaturesChecked++;
    if (favoritesState.creatures.has(uniqueId)) {
      const symbolKey = favoritesState.creatures.get(uniqueId) || 'heart';
      const symbol = FAVORITE_SYMBOLS[symbolKey] || FAVORITE_SYMBOLS.heart;
      const heart = createFavoriteHeartElement(symbolKey, symbol);
      imgEl.parentElement.appendChild(heart);
      heartsAdded++;
    }
  });

  if (heartsAdded > 0) {
    const currentResult = `${creaturesChecked}-${heartsAdded}`;
    if (favoritesState.lastLoggedResult !== currentResult) {
      favoritesState.lastLoggedResult = currentResult;
    }
  }
}

function updateSingleFavoriteHeart(targetUniqueId, allCreatures, monsters) {
  const creatures = allCreatures.filter(imgEl => {
    const isInAnalyzer = imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="damage"]') ||
      imgEl.closest('div[data-state="open"]')?.querySelector('img[alt="healing"]');
    const isInAutoplaySession = imgEl.closest('div[data-autosetup]') ||
      imgEl.closest('#autoseller-session-widget') ||
      imgEl.closest('#drop-widget-bottom-element');
    return !isInAnalyzer && !isInAutoplaySession;
  });

  const resolvedCreatures = resolveCreaturesSequentially(creatures, monsters);
  for (let idx = 0; idx < resolvedCreatures.length; idx++) {
    const { imgEl, uniqueId } = resolvedCreatures[idx];
    if (uniqueId === targetUniqueId) {
      const container = imgEl.parentElement;
      const existingHeart = container.querySelector('.favorite-heart');
      if (existingHeart) existingHeart.remove();
      if (favoritesState.creatures.has(uniqueId)) {
        const symbolKey = favoritesState.creatures.get(uniqueId) || 'heart';
        const symbol = FAVORITE_SYMBOLS[symbolKey] || FAVORITE_SYMBOLS.heart;
        container.appendChild(createFavoriteHeartElement(symbolKey, symbol));
      }
      return;
    }
  }
}

function createFavoriteHeartElement(symbolKey, symbol) {
  const heart = document.createElement('div');
  heart.className = 'favorite-heart pixelated';
  heart.style.cssText = 'position: absolute; bottom: 1px; right: 0; z-index: 3; width: 16px; height: 16px; pointer-events: none;';
  if (symbolKey === 'heart') {
    heart.innerHTML = symbol.icon;
    heart.style.fontSize = '16px';
    heart.style.display = 'flex';
    heart.style.alignItems = 'center';
    heart.style.justifyContent = 'center';
    heart.style.lineHeight = '1';
  } else {
    heart.innerHTML = `<img src="${symbol.icon}" width="16" height="16" style="image-rendering: pixelated;" alt="${symbol.name}">`;
  }
  return heart;
}

function matchCreatureBySequentialIndex(imgEl, monsters) {
  const gameId = getCreatureGameId(imgEl);
  if (!gameId) return null;

  const button = imgEl.closest('button');
  const levelSpan = button?.querySelector('span[translate="no"]');
  const displayedLevel = levelSpan ? parseInt(levelSpan.textContent, 10) : null;

  const indexKey = `${gameId}-${displayedLevel || 'unknown'}`;

  if (!matchCreatureBySequentialIndex.indexMap) {
    matchCreatureBySequentialIndex.indexMap = new Map();
  }
  if (!matchCreatureBySequentialIndex.indexMap.has(indexKey)) {
    matchCreatureBySequentialIndex.indexMap.set(indexKey, 0);
  }

  const currentIndex = matchCreatureBySequentialIndex.indexMap.get(indexKey);
  const matchingMonsters = getSortedMonstersByGameId(monsters, gameId);

  let candidateMonsters = matchingMonsters;
  if (displayedLevel && matchingMonsters.length > 1) {
    const sameLevelMonsters = matchingMonsters.filter(m => getLevelFromExp(m.exp || 0) === displayedLevel);
    if (sameLevelMonsters.length > 0) candidateMonsters = sameLevelMonsters;
  }

  const identifiedMonster = candidateMonsters[currentIndex] || matchingMonsters[currentIndex];
  matchCreatureBySequentialIndex.indexMap.set(indexKey, currentIndex + 1);
  return identifiedMonster;
}

function resetCreatureMatchingIndex() {
  if (matchCreatureBySequentialIndex.indexMap) {
    matchCreatureBySequentialIndex.indexMap.clear();
  }
}

/**
 * Shared duplicate-safe resolver used by both favorites and depot.
 */
function resolveCreaturesSequentially(creatures, monsters) {
  const resolved = [];
  if (!Array.isArray(creatures) || creatures.length === 0) return resolved;
  resetCreatureMatchingIndex();
  for (const imgEl of creatures) {
    const identifiedMonster = matchCreatureBySequentialIndex(imgEl, monsters);
    if (!identifiedMonster?.id) continue;
    resolved.push({
      imgEl,
      uniqueId: identifiedMonster.id,
      gameId: identifiedMonster.gameId,
      identifiedMonster
    });
  }
  return resolved;
}

function getResolvedUniqueIdForCreatureImg(creatureImg) {
  if (!creatureImg || !isInMonsterInventoryGrid(creatureImg)) return null;
  const grid = getMonsterGridFlexContainer();
  if (grid) {
    const gridImgs = Array.from(grid.children)
      .filter((el) => el.matches('div.flex') && el.querySelector('img[alt="creature"]'))
      .map((slot) => slot.querySelector('img[alt="creature"]'))
      .filter((img) => Boolean(img && isInMonsterInventoryGrid(img)));
    const resolved = resolveCreaturesSequentially(gridImgs, getPlayerMonsters());
    const match = resolved.find((r) => r.imgEl === creatureImg);
    if (match?.uniqueId != null) return String(match.uniqueId);
  }
  const fallback = getCreatureUniqueId(creatureImg, null)?.uniqueId;
  return fallback != null ? String(fallback) : null;
}

function sortMonstersByVisualOrder(monsters) {
  return monsters.slice().sort((a, b) => {
    if (b.exp !== a.exp) return b.exp - a.exp;
    if (a.metadata?.name && b.metadata?.name) {
      const nameCompare = a.metadata.name.localeCompare(b.metadata.name);
      if (nameCompare !== 0) return nameCompare;
    }
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

function getSortedMonstersByGameId(monsters, gameId) {
  return sortMonstersByVisualOrder(monsters.filter(m => m.gameId === gameId));
}

function matchMonsterByPercentage(matchingMonsters, percentage, displayedLevel) {
  const monstersWithPercentage = matchingMonsters.filter(m => {
    const statSum = (m.hp || 0) + (m.ad || 0) + (m.ap || 0) + (m.armor || 0) + (m.magicResist || 0);
    return statSum === percentage;
  });
  if (monstersWithPercentage.length === 0) return null;
  if (monstersWithPercentage.length === 1) return monstersWithPercentage[0];
  if (displayedLevel) {
    const levelMatch = monstersWithPercentage.find(m => getLevelFromExp(m.exp || 0) === displayedLevel);
    if (levelMatch) return levelMatch;
  }
  return monstersWithPercentage[0];
}

function matchMonsterByLevelAndVisuals(matchingMonsters, displayedLevel, isShiny, hasStars) {
  if (!displayedLevel) return null;
  const levelMatches = matchingMonsters.filter(m => getLevelFromExp(m.exp) === displayedLevel);
  if (levelMatches.length === 0) return null;
  if (levelMatches.length === 1) return levelMatches[0];
  return levelMatches.find(m => {
    if (isShiny && !m.shiny) return false;
    if (!isShiny && m.shiny) return false;
    if (hasStars && !m.tier) return false;
    if (!hasStars && m.tier) return false;
    return true;
  }) || null;
}

function getCreatureUniqueId(creatureImg, contextMenuPercentage = null) {
  if (!creatureImg) return null;
  const gameId = getCreatureGameId(creatureImg);
  if (!gameId) return null;

  const monsters = getPlayerMonsters();
  const matchingMonsters = getSortedMonstersByGameId(monsters, gameId);

  const allVisibleCreatures = Array.from(document.querySelectorAll('img[alt="creature"]')).filter(img => {
    const isInContextMenu = img.closest('[role="menu"]');
    const isInModal = img.closest('[role="dialog"]');
    return !isInContextMenu && !isInModal;
  });

  const gameIdIndexMap = new Map();

  for (let i = 0; i < allVisibleCreatures.length; i++) {
    const currentImg = allVisibleCreatures[i];
    const currentGameId = getCreatureGameId(currentImg);
    if (!currentGameId) continue;

    if (!gameIdIndexMap.has(currentGameId)) {
      gameIdIndexMap.set(currentGameId, 0);
    }
    const currentIndex = gameIdIndexMap.get(currentGameId);

    if (currentImg === creatureImg) {
      const button = currentImg.closest('button');
      const levelSpan = button.querySelector('span[translate="no"]');
      const displayedLevel = levelSpan ? parseInt(levelSpan.textContent, 10) : null;

      let identifiedMonster = matchingMonsters[currentIndex];
      let matchedByPercentage = false;

      if (contextMenuPercentage !== null) {
        const monster = matchMonsterByPercentage(matchingMonsters, contextMenuPercentage, displayedLevel);
        if (monster) {
          identifiedMonster = monster;
          matchedByPercentage = true;
        }
      }

      if (!matchedByPercentage && displayedLevel) {
        const isShiny = currentImg.src.includes('-shiny');
        const hasStars = button.querySelector('.tier-stars') !== null;
        const bestMatch = matchMonsterByLevelAndVisuals(matchingMonsters, displayedLevel, isShiny, hasStars);
        if (bestMatch) identifiedMonster = bestMatch;
      }

      return {
        uniqueId: identifiedMonster?.id,
        gameId: currentGameId,
        index: currentIndex
      };
    }

    gameIdIndexMap.set(currentGameId, currentIndex + 1);
  }

  return null;
}

/**
 * One pass over all visible creature imgs → unique ids (same rules as getCreatureUniqueId without context menu %).
 * Used by depot layout; avoids O(slots × allCreatures) work per apply.
 * @returns {WeakMap<HTMLImageElement, { uniqueId: unknown, gameId: number, index: number }>}
 */
function buildCreatureImgToUniqueIdMap(creatureImgs = null) {
  const map = new WeakMap();
  const monsters = getPlayerMonsters();
  const allVisibleCreatures = Array.isArray(creatureImgs)
    ? creatureImgs
    : Array.from(document.querySelectorAll('img[alt="creature"]')).filter((img) => {
      const isInContextMenu = img.closest('[role="menu"]');
      const isInModal = img.closest('[role="dialog"]');
      return !isInContextMenu && !isInModal;
    });

  const resolvedCreatures = resolveCreaturesSequentially(allVisibleCreatures, monsters);
  for (let i = 0; i < resolvedCreatures.length; i++) {
    const { imgEl, uniqueId, gameId } = resolvedCreatures[i];
    map.set(imgEl, { uniqueId, gameId, index: i });
  }
  return map;
}

// =======================
// 9. Observers & Reapply
// =======================

function startContextMenuObserver() {
  if (depotObservers.contextMenu) return;

  /** Radix often opens menus via attribute updates, not new nodes — retry after contextmenu. */
  function tryInjectOpenMenus() {
    assignEquipmentIdsToArsenalButtons();
    applyEquipmentDepotLayout();
    document.querySelectorAll('[role="menu"][data-state="open"]').forEach((menu) => {
      injectDepotMenuItems(menu);
      injectEquipmentDepotMenuItems(menu);
      injectFavoriteButton(menu);
    });
  }

  function handleCreatureRightClick(event) {
    const creatureImg = event.target.closest('button')?.querySelector('img[alt="creature"]');
    if (creatureImg) {
      currentRightClickedCreature = { creatureImg };
      [0, 16, 50, 100, 200].forEach((d) => scheduleTimeout(tryInjectOpenMenus, d));
    }
  }

  function handleAnyRightClick(event) {
    const target = event.target;
    if (target && target instanceof Element) {
      currentRightClickedEquipment = { target };
    }
  }

  function addRightClickListeners() {
    document.querySelectorAll('button[data-picked]').forEach(button => {
      if (!favoritesState.buttonListeners.has(button)) {
        button.addEventListener('contextmenu', handleCreatureRightClick);
        favoritesState.buttonListeners.set(button, handleCreatureRightClick);
      }
    });
  }

  const processMenuMutations = (mutations) => {
    addRightClickListeners();
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1) continue;
        const isMenu = node.getAttribute?.('role') === 'menu';
        const hasMenu = node.querySelector?.('[role="menu"]');
        const isDropdown = node.classList?.contains('dropdown-content') || node.querySelector?.('.dropdown-content');
        const menu = isMenu ? node : hasMenu;
        if (menu) {
          scheduleTimeout(() => injectFavoriteButton(menu), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => injectDepotMenuItems(menu), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => injectEquipmentDepotMenuItems(menu), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => assignEquipmentIdsToArsenalButtons(), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => applyEquipmentDepotLayout(), TIMEOUT_DELAYS.MENU_CLOSE);
        } else if (isDropdown || node.querySelector?.('.dropdown-menu-item')) {
          scheduleTimeout(() => injectFavoriteButton(node), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => injectDepotMenuItems(node), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => injectEquipmentDepotMenuItems(node), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => assignEquipmentIdsToArsenalButtons(), TIMEOUT_DELAYS.MENU_CLOSE);
          scheduleTimeout(() => applyEquipmentDepotLayout(), TIMEOUT_DELAYS.MENU_CLOSE);
        }
      }
    }
  };

  depotObservers.contextMenu = createThrottledObserver(processMenuMutations, 50);
  depotObservers.contextMenu.observe(document.body, { childList: true, subtree: true });
  depotObservers.contextMenuAnyRightClick = handleAnyRightClick;
  document.addEventListener('contextmenu', handleAnyRightClick, true);
  addRightClickListeners();
}

function stopContextMenuObserver() {
  if (depotObservers.contextMenu) {
    depotObservers.contextMenu.disconnect();
    depotObservers.contextMenu = null;
  }
  document.querySelectorAll('button[data-picked]').forEach(button => {
    const listener = favoritesState.buttonListeners.get(button);
    if (listener) {
      button.removeEventListener('contextmenu', listener);
      favoritesState.buttonListeners.delete(button);
    }
  });
  if (depotObservers.contextMenuAnyRightClick) {
    document.removeEventListener('contextmenu', depotObservers.contextMenuAnyRightClick, true);
    depotObservers.contextMenuAnyRightClick = null;
  }
}

function handleTabSwitchReapply() {
  // Keep depot/favorites in sync with persisted storage after tab-driven rerenders.
  depotDebug('handleTabSwitchReapply: start');
  attachArsenalObservation();
  loadDepotCreatureIds();
  loadDepotEquipmentIds();
  depotDebug('handleTabSwitchReapply: loaded storage', {
    depotCreatureIds: depotCreatureState.ids.length,
    depotEquipmentIds: depotEquipmentState.ids.length
  });
  assignEquipmentIdsToArsenalButtons();
  logArsenalDiagnosisSnapshot('tab-reapply-immediate-before-remove');
  applyEquipmentDepotLayout();
  notifyFavoriteGridRefresh('tab');
  // Tab content is often remounted in phases; run several passes to restore depot moves.
  [0, 120, 320, 700, 1300].forEach((delay) => {
    scheduleTimeout(() => {
      attachArsenalObservation();
      loadDepotCreatureIds();
      loadDepotEquipmentIds();
      depotDebug('handleTabSwitchReapply: delayed pass', {
        delay,
        depotCreatureIds: depotCreatureState.ids.length,
        depotEquipmentIds: depotEquipmentState.ids.length
      });
      assignEquipmentIdsToArsenalButtons();
      logArsenalDiagnosisSnapshot(`tab-reapply-delay-${delay}-before-remove`);
      applyEquipmentDepotLayout();
      if (getMonsterGridFlexContainer()) applyDepotLayout();
    }, delay);
  });
}

function scheduleTabSwitchReapply(trigger, tabInfo = null) {
  const now = Date.now();
  if (now - lastTabReapplyScheduleAt < 140) {
    depotDebug('tab reapply: deduped trigger', { trigger, tabInfo });
    return;
  }
  lastTabReapplyScheduleAt = now;
  if (tabReapplyDebounceTimeout !== null) {
    clearTimeout(tabReapplyDebounceTimeout);
    activeTimeouts.delete(tabReapplyDebounceTimeout);
    tabReapplyDebounceTimeout = null;
  }
  tabReapplyDebounceTimeout = scheduleTimeout(() => {
    tabReapplyDebounceTimeout = null;
    handleTabSwitchReapply();
  }, TIMEOUT_DELAYS.TAB_REAPPLY);
}

function startTabButtonObserver() {
  if (depotObservers.tabButtons) return;

  const processTabMutations = (mutations) => {
    for (const mutation of mutations) {
      if (
        mutation.type === 'attributes' &&
        mutation.attributeName === 'aria-selected' &&
        mutation.target?.getAttribute?.('role') === 'tab' &&
        mutation.target.getAttribute('aria-selected') === 'true'
      ) {
        depotDebug('tab observer: tab selected', {
          tabId: mutation.target?.id || null,
          tabLabel: (mutation.target?.textContent || '').trim()
        });
        scheduleTabSwitchReapply('observer', {
          tabId: mutation.target?.id || null,
          tabLabel: (mutation.target?.textContent || '').trim()
        });
        return;
      }
    }
  };

  depotObservers.tabButtons = createThrottledObserver(processTabMutations, 50);
  depotObservers.tabButtons.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-selected'],
    subtree: true
  });

  // Fallback for direct tab clicks (mouse/touch).
  depotTabClickListener = (event) => {
    const tab = event.target?.closest?.('[role="tab"]');
    if (!tab) return;
    depotDebug('tab click listener: tab clicked', {
      tabId: tab.id || null,
      tabLabel: (tab.textContent || '').trim()
    });
    scheduleTabSwitchReapply('click', {
      tabId: tab.id || null,
      tabLabel: (tab.textContent || '').trim()
    });
  };
  document.addEventListener('click', depotTabClickListener, true);
}

function stopTabButtonObserver() {
  if (depotObservers.tabButtons) {
    depotObservers.tabButtons.disconnect();
    depotObservers.tabButtons = null;
  }
  if (depotTabClickListener) {
    document.removeEventListener('click', depotTabClickListener, true);
    depotTabClickListener = null;
  }
}

function notifyFavoriteGridRefresh(kind) {
  if (depotConfig.enableCreatureDepot && !isBlockedByAnalysisMods()) {
    if (kind === 'creature') {
      const timeSince = Date.now() - lastDepotLayoutCreatureRefreshAt;
      if (timeSince > 400) {
        lastDepotLayoutCreatureRefreshAt = Date.now();
        scheduleApplyDepotLayout();
      }
    } else {
      scheduleApplyDepotLayout();
    }
  }

  if (!depotConfig.enableFavorites) return;
  if (isBlockedByAnalysisMods()) return;

  if (kind === 'creature') {
    const timeSinceOptimizedUpdate = Date.now() - favoritesState.lastOptimizedUpdate;
    if (timeSinceOptimizedUpdate <= 500) {
      return;
    }
    updateFavoriteHearts();
    return;
  }

  if (kind === 'tab') {
    scheduleTimeout(() => updateFavoriteHearts(), TIMEOUT_DELAYS.TAB_REAPPLY);
    return;
  }

  updateFavoriteHearts();
}

// =======================
// 10. Lifecycle & Exports
// =======================

function initDepotManager() {
  if (depotInitialized) return;
  depotInitialized = true;
  loadDepotConfig();
  migrateLegacyFavoritesDataBlob();
  loadFavorites();
  loadDepotCreatureIds();
  loadDepotCreatureMeta();
  loadDepotEquipmentIds();
  assignEquipmentIdsToArsenalButtons();
  applyEquipmentDepotLayout();
  window.depotManagerConfig = depotConfig;

  startContextMenuObserver();
  startTabButtonObserver();
  startDepotInventoryObserver();
  startArsenalGridObserver();
  if (depotConfig.enableCreatureDepot) {
    startMonsterGridObserver();
    scheduleTimeout(() => applyDepotLayout(), TIMEOUT_DELAYS.FAVORITES_INIT);
  }

  window.depotManager = {
    notifyFavoriteGridRefresh,
    isFavoritesEnabled: () => depotConfig.enableFavorites,
    reloadDepotConfigFromStorage,
    applyDepotLayout,
    resetDepotCreatureIds,
    showDepotModal
  };

  if (depotConfig.enableFavorites) {
    scheduleTimeout(() => updateFavoriteHearts(), TIMEOUT_DELAYS.FAVORITES_INIT);
  }
}

function cleanupDepotManager() {
  depotInitialized = false;
  if (tabReapplyDebounceTimeout !== null) {
    clearTimeout(tabReapplyDebounceTimeout);
    activeTimeouts.delete(tabReapplyDebounceTimeout);
    tabReapplyDebounceTimeout = null;
  }
  if (depotLayoutPendingTimeout !== null) {
    clearTimeout(depotLayoutPendingTimeout);
    activeTimeouts.delete(depotLayoutPendingTimeout);
    depotLayoutPendingTimeout = null;
  }
  stopContextMenuObserver();
  stopTabButtonObserver();
  stopDepotInventoryObserver();
  stopArsenalGridObserver();
  stopMonsterGridObserver();
  removeFavoriteHearts();
  activeTimeouts.forEach(id => {
    try {
      clearTimeout(id);
    } catch (e) { /* ignore */ }
  });
  activeTimeouts.clear();
  favoritesState.creatures.clear();
  favoritesState.lastOptimizedUpdate = 0;
  if (window.depotManager) delete window.depotManager;
  if (window.depotManagerConfig) delete window.depotManagerConfig;
}

initDepotManager();

exports = {
  init: function() {
    try {
      initDepotManager();
      return true;
    } catch (error) {
      console.error('[Depot Manager] init error:', error);
      return false;
    }
  },
  cleanup: function() {
    try {
      cleanupDepotManager();
      return true;
    } catch (error) {
      console.error('[Depot Manager] cleanup error:', error);
      return false;
    }
  }
};
