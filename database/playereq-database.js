console.log('[playereq-database.js] Loading equipment database...');

// Function to dynamically fetch all equipment
function getAllEquipment() {
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

// Function to determine equipment slot type from equipment data
function getEquipmentSlotType(equipment) {
  // First, check if metadata has a slot property
  if (equipment?.metadata?.slot) {
    return equipment.metadata.slot.toLowerCase();
  }
  
  // Explicit gameId mappings for specific equipment
  const gameId = equipment?.gameId;
  if (gameId === 10327 || gameId === 21445) {
    return 'bag';
  }
  
  // If not, try to determine from equipment name patterns
  const name = equipment?.metadata?.name?.toLowerCase() || '';
  
  // Specific equipment mappings (check exact names first)
  const specificMappings = {
    'bear skin': 'armor',
    'bloody edge': 'weapon',
    'cranial basher': 'weapon',
    'epee': 'weapon',
    'glass of goo': 'ammo',
    'ice rapier': 'weapon',
    'ratana': 'weapon',
    'white skull': 'ammo'
  };
  
  if (specificMappings[name]) {
    return specificMappings[name];
  }
  
  // Slot detection patterns (order matters - more specific first)
  if (name.includes('helmet') || name.includes('hat') || name.includes('cap')) {
    return 'helmet';
  }
  if (name.includes('shield') || name.includes('buckler')) {
    return 'shield';
  }
  if (name.includes('weapon') || name.includes('sword') || name.includes('axe') || 
      name.includes('mace') || name.includes('wand') || name.includes('staff') ||
      name.includes('bow') || name.includes('crossbow') || name.includes('dagger') ||
      name.includes('spear') || name.includes('club') || name.includes('hammer') ||
      name.includes('chain') || name.includes('bolter') || name.includes('rod') ||
      name.includes('rapier') || name.includes('edge') || name.includes('basher')) {
    return 'weapon';
  }
  if (name.includes('amulet') || name.includes('necklace') || name.includes('pendant')) {
    return 'amulet';
  }
  if (name.includes('ring')) {
    return 'ring';
  }
  if (name.includes('armor') || name.includes('plate') || name.includes('mail') ||
      name.includes('robe') || name.includes('vest') || name.includes('skin')) {
    return 'armor';
  }
  if (name.includes('legs') || name.includes('leggings') || name.includes('pants') ||
      name.includes('trousers')) {
    return 'legs';
  }
  if (name.includes('boots') || name.includes('shoes') || name.includes('footwear')) {
    return 'boots';
  }
  if (name.includes('bag') || name.includes('backpack') || name.includes('pack')) {
    return 'bag';
  }
  if (name.includes('ammo') || name.includes('arrow') || name.includes('bolt') ||
      name.includes('quiver') || name.includes('goo') || name.includes('skull')) {
    return 'ammo';
  }
  
  // Default: unknown slot
  return 'unknown';
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

// Build the database dynamically
const playerEquipmentDatabase = buildEquipmentDatabase();

// Export for use in other mods
// Use multiple fallbacks to ensure the database is available globally
const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow) {
  globalWindow.playerEquipmentDatabase = playerEquipmentDatabase;
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
