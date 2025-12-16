console.log('[equipment-database.js] Loading equipment database...');

// Function to dynamically fetch all equipment
function getAllEquipment() {
  const equipment = [];
  for (let i = 1; i < 1000; i++) {
    try {
      // Check game state is available
      if (!globalThis.state?.utils?.getEquipment) {
        console.warn('[equipment-database.js] state.utils.getEquipment not available yet');
        break;
      }
      const item = globalThis.state.utils.getEquipment(i);
      if (item?.metadata?.name) {
        equipment.push({ gameId: i, ...item });
      }
    } catch (e) { break; }
  }
  return equipment;
}

// Function to build equipment lists from dynamic data
function buildEquipmentDatabase() {
  const allEquipment = getAllEquipment();
  
  // If no equipment was loaded, return empty database
  if (allEquipment.length === 0) {
    console.warn('[equipment-database.js] No equipment loaded, returning empty database');
    return {
      ALL_EQUIPMENT: [],
      EQUIPMENT_BY_STAT: {
        ad: [],
        ap: [],
        hp: [],
        armor: [],
        magicResist: []
      }
    };
  }
  
  // Extract just the names and sort alphabetically
  const allEquipmentNames = allEquipment
    .map(e => e.metadata.name)
    .sort((a, b) => a.localeCompare(b));
  
  // Group equipment by stat type for easier filtering
  const equipmentByStat = {
    ad: allEquipment.filter(e => e.stat === 'ad').map(e => e.metadata.name),
    ap: allEquipment.filter(e => e.stat === 'ap').map(e => e.metadata.name),
    hp: allEquipment.filter(e => e.stat === 'hp').map(e => e.metadata.name),
    armor: allEquipment.filter(e => e.stat === 'armor').map(e => e.metadata.name),
    magicResist: allEquipment.filter(e => e.stat === 'magicResist').map(e => e.metadata.name)
  };
  
  return {
    ALL_EQUIPMENT: allEquipmentNames,
    EQUIPMENT_BY_STAT: equipmentByStat
  };
}

// Build the database dynamically
const equipmentDatabase = buildEquipmentDatabase();

// Export for use in other mods
// Use multiple fallbacks to ensure the database is available globally
const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow) {
  globalWindow.equipmentDatabase = equipmentDatabase;
  console.log(`[equipment-database.js] Loaded ${equipmentDatabase.ALL_EQUIPMENT.length} equipment items dynamically (cached for all mods)`);
  console.log('[equipment-database.js] ALL_EQUIPMENT length:', equipmentDatabase.ALL_EQUIPMENT?.length);
  console.log('[equipment-database.js] Equipment by stat:', Object.keys(equipmentDatabase.EQUIPMENT_BY_STAT).map(stat => `${stat}: ${equipmentDatabase.EQUIPMENT_BY_STAT[stat].length}`).join(', '));
}
if (typeof module !== 'undefined') {
  module.exports = equipmentDatabase;
}

