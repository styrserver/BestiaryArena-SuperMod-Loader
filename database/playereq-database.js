console.log('[playereq-database.js] Loading equipment database...');

// Function to dynamically fetch all equipment
//
// equipment-database.js (always loaded before this file — see background.js,
// content/mod-registry.js, content/local_mods.js, popup.js) does the identical
// state.utils.getEquipment(1..999) scan and exposes the raw, uncached function via
// window.equipmentDatabase.getAllEquipment. Reuse it instead of scanning twice; fall
// back to an independent scan below if that database isn't wired up (defensive —
// keeps this file correct even if load order/registration ever changes).
function getAllEquipment() {
  const sharedScan = window.equipmentDatabase?.getAllEquipment;
  if (typeof sharedScan === 'function' && sharedScan !== getAllEquipment) {
    try {
      const shared = sharedScan();
      if (Array.isArray(shared) && shared.length > 0) return shared;
    } catch (e) {
      console.warn('[playereq-database.js] Shared equipment scan failed, falling back to local scan', e);
    }
  }

  const equipment = [];
  for (let i = 1; i < 1000; i++) {
    try {
      // Use multiple fallbacks to access the game state
      const state = globalThis.state || window.state || (typeof state !== 'undefined' ? state : null);
      if (!state?.utils?.getEquipment) {
        console.warn('[playereq-database.js] state.utils.getEquipment not available yet');
        break;
      }
      const item = state.utils.getEquipment(i);
      if (item?.metadata?.name) {
        equipment.push({ gameId: i, ...item });
      }
    } catch (e) { break; }
  }
  return equipment;
}

/** Catalog getEquipment() entries have no fixed stat — owned equips carry .stat. */
function resolveEquipmentStatKey(item) {
  const raw = item?.metadata?.stat ?? item?.stat;
  if (raw == null || raw === '') return null;
  const s = String(raw).toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'ad' || s === 'attackdamage') return 'ad';
  if (s === 'ap' || s === 'abilitypower') return 'ap';
  if (s === 'hp' || s === 'health') return 'hp';
  if (s === 'armor') return 'armor';
  if (s === 'mr' || s === 'magicresist') return 'magicResist';
  return null;
}

// The game sorts every equipment piece into a Codex section through its metadata `group`; the slot follows from it.
// Weapons are split into several groups (melee kinds, distance, magic) and "other" is the Codex's Trinket section.
const EQUIPMENT_GROUP_TO_SLOT = {
  armor: 'armor',
  helmet: 'helmet',
  legs: 'legs',
  boots: 'boots',
  amulet: 'amulet',
  ring: 'ring',
  shield: 'shield',
  bag: 'bag',
  sword: 'weapon',
  axe: 'weapon',
  club: 'weapon',
  melee: 'weapon',
  distance: 'weapon',
  magic: 'weapon',
  other: 'ammo'
};
const unmappedEquipmentGroups = new Set();

// Slot type of an equipment entry, read from the game's own `group`; 'unknown' when the game gives none we know.
function getEquipmentSlotType(equipment) {
  const group = String(equipment?.metadata?.group ?? '').toLowerCase();
  const slot = EQUIPMENT_GROUP_TO_SLOT[group];
  if (!slot && !unmappedEquipmentGroups.has(group)) {
    unmappedEquipmentGroups.add(group);
    console.warn(`[playereq-database.js] No slot for equipment group "${group}" (${equipment?.metadata?.name})`);
  }
  return slot || 'unknown';
}

// Function to build equipment lists from dynamic data
function buildEquipmentDatabase() {
  const allEquipment = getAllEquipment();
  
  // If no equipment was loaded, return empty database
  if (allEquipment.length === 0) {
    console.warn('[playereq-database.js] No equipment loaded, returning empty database');
    return {
      ALL_EQUIPMENT: [],
      EQUIPMENT_BY_STAT: {
        ad: [],
        ap: [],
        hp: [],
        armor: [],
        magicResist: []
      },
      EQUIPMENT_BY_SLOT: {
        helmet: [],
        amulet: [],
        armor: [],
        weapon: [],
        shield: [],
        ring: [],
        boots: [],
        bag: [],
        legs: [],
        ammo: [],
        unknown: []
      }
    };
  }
  
  // Extract just the names and sort alphabetically
  const allEquipmentNames = allEquipment
    .map(e => e.metadata.name)
    .sort((a, b) => a.localeCompare(b));
  
  // Group equipment by stat type for easier filtering
  const equipmentByStat = {
    ad: [],
    ap: [],
    hp: [],
    armor: [],
    magicResist: []
  };
  for (const item of allEquipment) {
    const key = resolveEquipmentStatKey(item);
    if (key && equipmentByStat[key]) {
      equipmentByStat[key].push(item.metadata.name);
    }
  }
  
  // Group equipment by slot type
  const equipmentBySlot = {
    helmet: [],
    amulet: [],
    armor: [],
    weapon: [],
    shield: [],
    ring: [],
    boots: [],
    bag: [],
    legs: [],
    ammo: [],
    unknown: []
  };
  
  allEquipment.forEach(e => {
    const slotType = getEquipmentSlotType(e);
    if (equipmentBySlot[slotType]) {
      equipmentBySlot[slotType].push(e.metadata.name);
    } else {
      equipmentBySlot.unknown.push(e.metadata.name);
    }
  });
  
  // Sort each slot's equipment alphabetically
  Object.keys(equipmentBySlot).forEach(slot => {
    equipmentBySlot[slot].sort((a, b) => a.localeCompare(b));
  });
  
  return {
    ALL_EQUIPMENT: allEquipmentNames,
    EQUIPMENT_BY_STAT: equipmentByStat,
    EQUIPMENT_BY_SLOT: equipmentBySlot
  };
}

// Retry until game state is ready — a synchronous one-shot build here would silently
// produce a permanently empty database on a slow/cold page load (state.utils.getEquipment
// not ready yet), and unlike equipment-database.js/creature-database.js this database has
// no retry otherwise. Guilds.js reads window.playerEquipmentDatabase.EQUIPMENT_BY_SLOT
// directly, so an empty catalog here silently breaks its equip-slot filtering.
const waitForGameState = (callback) => globalThis.BAWait ? globalThis.BAWait.gameState(callback, {
  label: 'playereq-database.js',
  ready: (state) => !!(state?.player?.getSnapshot && state?.board?.getSnapshot && state?.utils?.getEquipment)
}) : setTimeout(callback, 0); // no loader (offline tools): build with whatever exists

const placeholderDatabase = {
  ALL_EQUIPMENT: [],
  EQUIPMENT_BY_STAT: { ad: [], ap: [], hp: [], armor: [], magicResist: [] },
  EQUIPMENT_BY_SLOT: {
    helmet: [], amulet: [], armor: [], weapon: [], shield: [], ring: [],
    boots: [], bag: [], legs: [], ammo: [], unknown: []
  }
};

// Export for use in other mods
// Use multiple fallbacks to ensure the database is available globally
const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow && !globalWindow.playerEquipmentDatabase) {
  // Placeholder assigned immediately (same object mutated below) so any consumer that
  // caches a reference to window.playerEquipmentDatabase early still sees the real data
  // once it's ready.
  globalWindow.playerEquipmentDatabase = placeholderDatabase;
}

waitForGameState(() => {
  const playerEquipmentDatabase = buildEquipmentDatabase();

  if (globalWindow) {
    Object.assign(globalWindow.playerEquipmentDatabase, playerEquipmentDatabase);
    console.log(`[playereq-database.js] Loaded ${playerEquipmentDatabase.ALL_EQUIPMENT.length} equipment items dynamically (cached for all mods)`);
    console.log('[playereq-database.js] ALL_EQUIPMENT length:', playerEquipmentDatabase.ALL_EQUIPMENT?.length);
    const byStatCounts = Object.keys(playerEquipmentDatabase.EQUIPMENT_BY_STAT).map(stat => `${stat}: ${playerEquipmentDatabase.EQUIPMENT_BY_STAT[stat].length}`).join(', ');
    const catalogStatTotal = Object.values(playerEquipmentDatabase.EQUIPMENT_BY_STAT).reduce((n, arr) => n + arr.length, 0);
    if (catalogStatTotal === 0) {
      console.log('[playereq-database.js] Equipment by stat: none on catalog (expected — stat is per owned instance)');
    } else {
      console.log('[playereq-database.js] Equipment by stat:', byStatCounts);
    }
    console.log('[playereq-database.js] Equipment by slot:', Object.keys(playerEquipmentDatabase.EQUIPMENT_BY_SLOT).map(slot => `${slot}: ${playerEquipmentDatabase.EQUIPMENT_BY_SLOT[slot].length}`).join(', '));
  }
  if (typeof module !== 'undefined') {
    module.exports = playerEquipmentDatabase;
  }
});
