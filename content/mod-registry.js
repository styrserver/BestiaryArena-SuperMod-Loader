/**
 * Centralized Mod Registry
 * Single source of truth for all mods in the system
 * 
 * IMPORTANT: When adding a new mod, you MUST update the following files:
 * 
 * 1. THIS FILE (content/mod-registry.js) - Add to appropriate array below
 * 2. background.js - Update hardcoded counts in getModCounts (Chrome limitation)
 * 3. dashboard/dashboard.js - Add to the static list (search for "kept in sync with mod-registry.js")
 * 4. popup/popup.js - Add to the static list (search for "kept in sync with mod-registry.js")
 * 
 * Why 4 places? 
 * - This file is used by content scripts (supports ES6 modules)
 * - Background script in Firefox can import, but Chrome service workers CANNOT (HTML spec restriction)
 * - Dashboard and popup cannot load ES6 modules due to browser security restrictions
 * 
 * To add a new Super Mod named "My New Mod.js":
 * 1. Add 'My New Mod.js' to SUPER_MODS array below
 * 2. Update super count in background.js getModCounts handler (increment by 1)
 * 3. Add 'My New Mod.js' to superModNames array in dashboard/dashboard.js (2 locations)
 * 4. Add 'My New Mod.js' to superModNames array in popup/popup.js
 */

// Database mods - core functionality mods that load first
export const DATABASE_MODS = [
  'Welcome.js',
  'inventory-database.js',
  'creature-database.js',
  'equipment-database.js'
];

// Official mods - included with the extension
export const OFFICIAL_MODS = [
  'Bestiary_Automator.js',
  'Board Analyzer.js',
  'Custom_Display.js',
  'Hero_Editor.js',
  'Highscore_Improvements.js',
  'Item_tier_list.js',
  'Monster_tier_list.js',
  'Setup_Manager.js',
  'Team_Copier.js',
  'Tick_Tracker.js',
  'Turbo Mode.js'
];

// Super mods - enhanced/advanced mods
export const SUPER_MODS = [
  'Autoseller.js',
  'Autoscroller.js',
  'Better Analytics.js',
  'Better Boosted Maps.js',
  'Better Cauldron.js',
  'Better Exaltation Chest.js',
  'Better Forge.js',
  'Better Highscores.js',
  'Better Hy\'genie.js',
  'Better Setups.js',
  'Better Tasker.js',
  'Better UI.js',
  'Better Yasir.js',
  'Board Advisor.js',
  'Configurator.js',
  'Cyclopedia.js',
  'Dice_Roller.js',
  'Hunt Analyzer.js',
  'Outfiter.js',
  'Playercount.js',
  'Raid_Hunter.js',
  'RunTracker.js'
];

// Mods that are enabled by default for new users
export const DEFAULT_ENABLED_MODS = [
  'database/Welcome.js',
  'database/inventory-database.js',
  'database/creature-database.js',
  'database/equipment-database.js',
  'Official Mods/Bestiary_Automator.js',
  'Official Mods/Board Analyzer.js',
  'Official Mods/Custom_Display.js',
  'Official Mods/Hero_Editor.js',
  'Official Mods/Highscore_Improvements.js',
  'Official Mods/Item_tier_list.js',
  'Official Mods/Monster_tier_list.js',
  'Official Mods/Setup_Manager.js',
  'Official Mods/Team_Copier.js',
  'Official Mods/Tick_Tracker.js',
  'Official Mods/Turbo Mode.js',
  // Hidden Super Mods - enabled by default since users can't toggle them in popup
  'Super Mods/RunTracker.js',
  'Super Mods/Outfiter.js',
  'Super Mods/Playercount.js'
  // All other Super Mods are disabled by default - users must manually enable them
];

// Mods that should be hidden from the UI (utility/system mods)
export const HIDDEN_MODS = [
  'Welcome.js',
  'inventory-database.js',
  'creature-database.js',
  'equipment-database.js',
  'RunTracker.js',
  'Outfiter.js',
  'Playercount.js'
];

/**
 * Get all mods organized by category with full paths
 * @returns {Object} Object with database, official, and super arrays
 */
export function getAllModsByCategory() {
  return {
    database: DATABASE_MODS.map(name => `database/${name}`),
    official: OFFICIAL_MODS.map(name => `Official Mods/${name}`),
    super: SUPER_MODS.map(name => `Super Mods/${name}`)
  };
}

/**
 * Get all mods as a flat array with full paths
 * @returns {Array<string>} Array of all mod paths
 */
export function getAllMods() {
  const categories = getAllModsByCategory();
  return [...categories.database, ...categories.official, ...categories.super];
}

/**
 * Get mod counts by category
 * @returns {Object} Object with counts for each category
 */
export function getModCounts() {
  return {
    database: DATABASE_MODS.length,
    official: OFFICIAL_MODS.length,
    super: SUPER_MODS.length,
    total: DATABASE_MODS.length + OFFICIAL_MODS.length + SUPER_MODS.length
  };
}

/**
 * Check if a mod should be enabled by default
 * @param {string} modPath - Full path to the mod (e.g., "Super Mods/Better UI.js")
 * @returns {boolean} True if mod should be enabled by default
 */
export function isDefaultEnabled(modPath) {
  return DEFAULT_ENABLED_MODS.includes(modPath);
}

/**
 * Check if a mod should be hidden from UI
 * @param {string} modName - Name of the mod file (e.g., "Welcome.js")
 * @returns {boolean} True if mod should be hidden
 */
export function isHiddenMod(modName) {
  return HIDDEN_MODS.includes(modName);
}

/**
 * Get category for a mod based on its path
 * @param {string} modPath - Full path to the mod
 * @returns {string} Category name ('database', 'official', 'super', or 'user')
 */
export function getModCategory(modPath) {
  if (modPath.startsWith('database/')) return 'database';
  if (modPath.startsWith('Official Mods/')) return 'official';
  if (modPath.startsWith('Super Mods/')) return 'super';
  if (modPath.startsWith('User Mods/')) return 'user';
  return 'unknown';
}

/**
 * Get display name for a mod (removes .js and path, replaces underscores)
 * @param {string} modPath - Full path to the mod
 * @returns {string} Display name
 */
export function getModDisplayName(modPath) {
  const fileName = modPath.split('/').pop();
  return fileName.replace('.js', '').replace(/_/g, ' ');
}

// For CommonJS compatibility (used in content scripts)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DATABASE_MODS,
    OFFICIAL_MODS,
    SUPER_MODS,
    DEFAULT_ENABLED_MODS,
    HIDDEN_MODS,
    getAllModsByCategory,
    getAllMods,
    getModCounts,
    isDefaultEnabled,
    isHiddenMod,
    getModCategory,
    getModDisplayName
  };
}

