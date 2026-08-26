/*
================================================================================
Console — open DevTools on Bestiary Arena (loader injected), then paste:

dumpCreatureWikiLua();
dumpCreatureWikiLua({ download: false, copy: true });
dumpCreatureWikiLua({ filename: 'creatures.lua' });
dumpCreatureLuaTable({ wikiPage: true });

================================================================================
Maintainer workflow
================================================================================
1. Reload extension + game; confirm "[creature-lua-export.js] Loading..." in console.
2. Run dumpCreatureWikiLua(); downloads creature-wiki-YYYY-MM-DD.lua — paste into the wiki page.
3. Live stats (hitpoints, attack, ability_power, armor, magic_resist, movement_speed,
   is_poisonous, roles) come from getMonster + creature-database HARDCODED_MAP_MONSTER_STATS.
   Obtainable creatures export maxed lvl 50 and lvl 99 via scaleStat as "50 (99)" when they differ.
   Gazers and unobtainable creatures use fixed base stats (no level scaling).
4. Wiki-only fields (attack_speed, scales_ad, scales_ap, Picture_Creature, Albino Gazer stats)
   live in WIKI_CREATURE_EXTRA_FIELDS below — update when wiki rules change.
5. Section lists follow creature-database.js (ALL_CREATURES, EVENT_CREATURES,
   UNOBTAINABLE_CREATURES, gazer species + Albino Gazer).

Sync map (edit the matching source when rules change):
  EVENT_CREATURES              ↔  database/creature-database.js
  UNOBTAINABLE_CREATURES       ↔  database/creature-database.js (+ WIKI_EXTRA_UNOBTAINABLE)
  HARDCODED_MAP_MONSTER_STATS  ↔  database/creature-database.js (Cyclopedia map bosses)
  WIKI_CREATURE_EXTRA_FIELDS   ↔  wiki creature stats module (attack_speed / scales / specials)
================================================================================
*/

/**
 * Console-oriented helpers to emit Lua-style creature stat rows for the wiki module.
 *
 * Usage:
 * - `dumpCreatureLuaTable()` — one line per creature.
 * - `dumpCreatureWikiLua()` — full wiki `return { ... }` block with section comments and aligned keys;
 *   downloads a .lua file by default (`{ copy: true }` or `{ download: false }` to override).
 */

console.log('[creature-lua-export.js] Loading creature Lua export helpers...');

/** Wiki keys that differ from in-game metadata.name. */
const WIKI_CREATURE_KEY_ALIASES = {
  'Monster Cauldron': 'Monster Cauldron (creature)'
};

/** Unobtainable wiki rows not listed in creature-database UNOBTAINABLE_CREATURES. */
const WIKI_EXTRA_UNOBTAINABLE = [
  'Barrel',
  'Beer Barrel',
  'Larva',
  'Orc Warrior',
  'Scarab',
  'Snowman',
  'Squidgy Slime',
  'Stone Golem',
  'Troll-Trained Salamander',
  'War Wolf'
];

/**
 * Wiki-only fields and stat overrides (attack_speed, scales, specials).
 * Live base stats still come from getMonster unless `stats` is set here.
 */
const WIKI_CREATURE_EXTRA_FIELDS = {
  'Albino Gazer': {
    stats: { hp: 84, ad: 0, ap: 0, armor: 0, magicResist: 17, speed: 105 },
    attack_speed: 0.5,
    scales_ad: 'auto',
    scales_ap: ''
  },
  'Amazon': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Banshee': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Barrel': { attack_speed: 0.5 },
  'Bear': { attack_speed: 0.5, scales_ad: 'spell', scales_ap: 'spell' },
  'Beer Barrel': { attack_speed: 0.5 },
  'Black Knight': { attack_speed: 2 },
  'Bog Raider': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Bug': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: '' },
  'Chubby Gazer': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Corym Charlatan': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Corym Skirmisher': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Corym Vanguard': { attack_speed: 0.25, scales_ad: 'both', scales_ap: 'spell' },
  'Cyclops': { attack_speed: 0.2, scales_ad: 'auto', scales_ap: 'spell' },
  'Dead Tree': { attack_speed: 0.5 },
  'Deer': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Demon Skeleton': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Dharalion': { attack_speed: 0.33 },
  'Dragon': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Dragon Lord': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Druid': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Dwarf': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Dwarf Geomancer': { attack_speed: 0.5, scales_ad: 'both', scales_ap: 'spell' },
  'Dwarf Guard': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: '' },
  'Dwarf Merrymancer': { attack_speed: 0.5, scales_ad: 'both', scales_ap: 'spell' },
  'Dwarf Soldier': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Earth Crystal': { attack_speed: 0.5 },
  'Elf': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Elf Arcanist': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'auto' },
  'Elf Scout': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Energy Crystal': { attack_speed: 0.5 },
  'Fire Devil': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Fire Elemental': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Firestarter': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Frost Troll': { attack_speed: 0.25, scales_ad: 'auto', scales_ap: 'spell' },
  'Ghost': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Ghoul': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Giant Spider': { attack_speed: 0.25, scales_ad: 'auto', scales_ap: '' },
  'Goblin': { attack_speed: 1, scales_ad: 'auto', scales_ap: '' },
  'Goblin Assassin': { attack_speed: 1, scales_ad: 'auto', scales_ap: '' },
  'Goblin Gumslinger': { attack_speed: 1, scales_ad: 'auto', scales_ap: '' },
  'Goblin Saboteur': { attack_speed: 1, scales_ad: 'auto', scales_ap: '' },
  'Goblin Scavenger': { attack_speed: 1, scales_ad: 'auto', scales_ap: 'spell' },
  'Grynch Clan Commander': { attack_speed: 0.5 },
  'Grynch Clan Mastermind': { attack_speed: 0.5 },
  'Gummy Raider': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Knight': { attack_speed: 0.15, scales_ad: 'auto', scales_ap: 'spell' },
  'Lavahole': { attack_speed: 0.5 },
  'Larva': {
    stats: { hp: 324, ad: 0, ap: 0, armor: 15, magicResist: 11, speed: 45 },
    attack_speed: 0.5
  },
  'Magma Crystal': { attack_speed: 0.5 },
  'Minotaur': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Minotaur Archer': { attack_speed: 0.25, scales_ad: 'auto', scales_ap: '' },
  'Minotaur Guard': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Minotaur Mage': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Monk': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Monster Cauldron (creature)': { attack_speed: 0.5 },
  'Mummy': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Mystic Gazer': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Nightstalker': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Old Giant Spider': { attack_speed: 0.25 },
  'Orc': { attack_speed: 0.5 },
  'Orc Berserker': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: '' },
  'Orc Leader': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Orc Rider': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Orc Shaman': { attack_speed: 0.5, scales_ad: 'both', scales_ap: 'spell' },
  'Orc Spearman': { attack_speed: 0.5, scales_ad: 'both', scales_ap: '' },
  'Orc Warlord': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'both' },
  'Orc Warrior': { attack_speed: 0.5 },
  'Poison Spider': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Polar Bear': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Psychic Gazer': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Rat': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Regeneration Tank': { attack_speed: 0.5 },
  'Reindeer': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Rorc': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Rotworm': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Scorpion': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Scarab': {
    stats: { hp: 2400, ad: 0, ap: 0, armor: 48, magicResist: 30, speed: 45 },
    attack_speed: 0.5
  },
  'Sheep': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Skeleton': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Slime': { attack_speed: 0.25, scales_ad: 'auto', scales_ap: 'spell' },
  'Snake': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Snowman': { attack_speed: 0.5 },
  'Spider': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Spiky Gazer': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Squidgy Slime': { attack_speed: 0.25, scales_ad: 'auto', scales_ap: 'spell' },
  'Stalker': { attack_speed: 0.5, scales_ad: 'both', scales_ap: 'spell' },
  'Stone Golem': { attack_speed: 0.33 },
  'Sturdy Gazer': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Swamp Troll': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Sweaty Cyclops': { attack_speed: 0.25 },
  'Tentugly': { attack_speed: 0.5, Picture_Creature: "Tentugly's_Head.gif" },
  'The Percht Queen': { attack_speed: 0.5 },
  'Tortoise': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: '' },
  'Troll': { attack_speed: 0.33, scales_ad: 'both', scales_ap: 'both' },
  'Troll-Trained Salamander': { attack_speed: 0.5 },
  'Unionized Goblin': { attack_speed: 1, scales_ad: 'auto', scales_ap: 'spell' },
  'Valkyrie': { attack_speed: 0.29, scales_ad: 'auto', scales_ap: 'spell' },
  'War Wolf': { attack_speed: 0.5 },
  'Warlock': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Wasp': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Water Elemental': { attack_speed: 0.33, scales_ad: 'auto', scales_ap: 'spell' },
  'Willi Wasp': { attack_speed: 0.5 },
  'Winter Wolf': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Witch': { attack_speed: 0.5, scales_ad: '', scales_ap: 'spell' },
  'Wolf': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Wyvern': { attack_speed: 0.5, scales_ad: 'auto', scales_ap: 'spell' },
  'Yeti': { attack_speed: 0.2, scales_ad: 'auto', scales_ap: 'spell' }
};

const WIKI_HEADER_COMMENTS = `-- CENTRAL DATABASE FOR CREATURE STATS
-- =============================================================================
-- HOW TO EDIT:
-- 1. Find the creature name (alphabetical order).
-- 2. Change the value (e.g., hitpoints = 500).
-- 3. IMPORTANT: Every line MUST end with a comma ( , ).
-- 4. To add a new creature, copy the "NEW ENTRY TEMPLATE" below.
-- =============================================================================

-- NEW ENTRY TEMPLATE:
-- ["Name"] = { title1 = "Name", roles = { "Role" }, hitpoints = "500 (1200)", attack = 0, ability_power = 0, armor = 0, magic_resist = 0, attack_speed = 0.50, movement_speed = 0, is_poisonous = false, scales_ad = "auto", scales_ap = "spell" },
`;

const MAXED_GENE_VALUE = 20;

function getCreatureDb() {
  try {
    return (globalThis.window || window)?.creatureDatabase || null;
  } catch (_) {
    return null;
  }
}

function luaEscape(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function luaStringLiteral(value) {
  if (value == null) return '""';
  return `"${luaEscape(value)}"`;
}

function formatLuaNumber(value, { attackSpeed = false, unobtainable = false } = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  if (attackSpeed) {
    if (value === 1) return '1.0';
    if (value === 2) return '2.00';
    if (value === 0.5 && !unobtainable) return '0.50';
    if (Number.isInteger(value)) return `${value}.0`;
    const fixed = value.toFixed(2);
    return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  }
  return String(Math.round(value));
}

function formatLuaStatValue(value, options = {}) {
  if (typeof value === 'string') return luaStringLiteral(value);
  return formatLuaNumber(value, options);
}

function scaleCreatureStat(baseValue, level, geneValue = MAXED_GENE_VALUE) {
  const scaleStat = globalThis.state?.utils?.scaleStat;
  if (typeof scaleStat !== 'function' || typeof baseValue !== 'number' || !Number.isFinite(baseValue)) {
    return null;
  }
  try {
    const scaled = Number(scaleStat({ stat: baseValue, level, geneValue, awaken: false }));
    return Number.isFinite(scaled) ? Math.round(scaled) : null;
  } catch (_) {
    return null;
  }
}

function formatDualMaxedStat(lvl50, lvl99) {
  const rounded50 = Math.round(lvl50);
  const rounded99 = Math.round(lvl99);
  if (rounded50 === rounded99) return rounded50;
  return `${rounded50} (${rounded99})`;
}

function formatMaxedLevelStat(baseValue, canScale) {
  const fallback = Math.round(baseValue ?? 0);
  if (!canScale) return fallback;

  const lvl50 = scaleCreatureStat(baseValue, 50);
  const lvl99 = scaleCreatureStat(baseValue, 99);
  if (lvl50 == null || lvl99 == null) return fallback;
  return formatDualMaxedStat(lvl50, lvl99);
}

/** Pad \`["Name"]\` so \`=\` lines up for wiki-style tables. */
function formatCreatureLuaKey(name, targetBracketEndCol = 31) {
  const key = `["${luaEscape(name)}"]`;
  const spaces = Math.max(1, targetBracketEndCol - key.length);
  return `${key}${' '.repeat(spaces)}=`;
}

function normalizeRoleLabel(role) {
  if (typeof role === 'object' && role !== null && role.name != null) {
    return String(role.name).trim();
  }
  return String(role ?? '').trim();
}

function normalizeRoleName(role) {
  return normalizeRoleLabel(role).toLowerCase();
}

function normalizeCreatureRoles(monster) {
  const raw = monster?.metadata?.roles;
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const seen = new Set();
  const out = [];
  list.forEach((role) => {
    const label = normalizeRoleLabel(role);
    if (!label) return;
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(label);
  });
  return out.sort((a, b) => a.localeCompare(b));
}

function creatureHasPoisonousRole(monster) {
  return normalizeCreatureRoles(monster).some((role) => normalizeRoleName(role) === 'poisonous');
}

function formatLuaStringArray(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return `{ ${items.map((item) => luaStringLiteral(item)).join(', ')} }`;
}

function getWikiKeyForCreatureName(creatureName) {
  return WIKI_CREATURE_KEY_ALIASES[creatureName] || creatureName;
}

function getGameNameForWikiKey(wikiKey) {
  for (const [gameName, key] of Object.entries(WIKI_CREATURE_KEY_ALIASES)) {
    if (key === wikiKey) return gameName;
  }
  return wikiKey;
}

function getHardcodedMapStats(creatureName) {
  const db = getCreatureDb();
  const table = db?.HARDCODED_MAP_MONSTER_STATS || {};
  const entry = table[String(creatureName ?? '').toLowerCase()];
  return entry?.baseStats || null;
}

function readAttackSpeedFromMonster(monster) {
  const meta = monster?.metadata || {};
  const base = meta.baseStats || {};
  const candidates = [
    meta.attackSpeed,
    meta.attack_speed,
    base.attackSpeed,
    base.attack_speed,
    meta.skill?.attackSpeed,
    meta.skill?.attack_speed
  ];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

function resolveCreatureStats(creatureName, section) {
  const wikiKey = getWikiKeyForCreatureName(creatureName);
  const lookupName = getGameNameForWikiKey(wikiKey);
  const extras = WIKI_CREATURE_EXTRA_FIELDS[wikiKey] || WIKI_CREATURE_EXTRA_FIELDS[lookupName] || {};

  const db = getCreatureDb();
  let monster = null;
  if (db?.findMonsterByName) {
    monster = db.findMonsterByName(lookupName);
  }
  if (!monster) {
    try {
      const utils = globalThis.state?.utils;
      if (utils?.getMonster) {
        for (let i = 1; i < 1000; i++) {
          const candidate = utils.getMonster(i);
          if (candidate?.metadata?.name?.toLowerCase() === lookupName.toLowerCase()) {
            monster = { gameId: i, ...candidate };
            break;
          }
        }
      }
    } catch (_) {}
  }

  const hardcoded = getHardcodedMapStats(lookupName);
  const baseFromMonster = monster?.metadata?.baseStats || {};
  const mergedBase = {
    hp: 0,
    ad: 0,
    ap: 0,
    armor: 0,
    magicResist: 0,
    speed: 0,
    ...baseFromMonster,
    ...(hardcoded || {}),
    ...(extras.stats || {})
  };

  const attackSpeed =
    readAttackSpeedFromMonster(monster) ??
    extras.attack_speed ??
    (section === 'unobtainable' ? 0.5 : 0.5);

  const roles = Array.isArray(extras.roles) ? extras.roles : normalizeCreatureRoles(monster);
  const canScaleStats = section !== 'unobtainable' && section !== 'gazers';

  return {
    wikiKey,
    title1: wikiKey,
    roles,
    hitpoints: formatMaxedLevelStat(mergedBase.hp ?? 0, canScaleStats),
    attack: formatMaxedLevelStat(mergedBase.ad ?? 0, canScaleStats),
    ability_power: formatMaxedLevelStat(mergedBase.ap ?? 0, canScaleStats),
    armor: formatMaxedLevelStat(mergedBase.armor ?? 0, canScaleStats),
    magic_resist: formatMaxedLevelStat(mergedBase.magicResist ?? 0, canScaleStats),
    attack_speed: attackSpeed,
    movement_speed: mergedBase.speed ?? 0,
    is_poisonous: creatureHasPoisonousRole(monster),
    scales_ad: extras.scales_ad ?? (section === 'unobtainable' ? null : 'auto'),
    scales_ap: extras.scales_ap ?? (section === 'unobtainable' ? null : 'spell'),
    is_event: section === 'event' ? true : null,
    is_unobtainable: section === 'unobtainable' ? true : null,
    Picture_Creature: extras.Picture_Creature ?? null
  };
}

function buildCreatureLuaFieldParts(fields, section) {
  const unobtainable = section === 'unobtainable';
  const parts = [`title1 = ${luaStringLiteral(fields.title1)}`];

  const rolesLua = formatLuaStringArray(fields.roles);
  if (rolesLua) {
    parts.push(`roles = ${rolesLua}`);
  }

  parts.push(
    `hitpoints = ${formatLuaStatValue(fields.hitpoints)}`,
    `attack = ${formatLuaStatValue(fields.attack)}`
  );

  if (!unobtainable || fields.ability_power) {
    parts.push(`ability_power = ${formatLuaStatValue(fields.ability_power)}`);
  }

  parts.push(
    `armor = ${formatLuaStatValue(fields.armor)}`,
    `magic_resist = ${formatLuaStatValue(fields.magic_resist)}`,
    `attack_speed = ${formatLuaNumber(fields.attack_speed, { attackSpeed: true, unobtainable })}`,
    `movement_speed = ${formatLuaNumber(fields.movement_speed)}`
  );

  if (!unobtainable) {
    parts.push(`is_poisonous = ${fields.is_poisonous ? 'true' : 'false'}`);
    if (fields.scales_ad != null) {
      parts.push(`scales_ad = ${luaStringLiteral(fields.scales_ad)}`);
    }
    if (fields.scales_ap != null) {
      parts.push(`scales_ap = ${luaStringLiteral(fields.scales_ap)}`);
    }
  }

  if (fields.is_event) {
    parts.push('is_event = true');
  }
  if (fields.is_unobtainable) {
    parts.push('is_unobtainable = true');
  }
  if (fields.Picture_Creature) {
    parts.push(`Picture_Creature = ${luaStringLiteral(fields.Picture_Creature)}`);
  }

  return parts;
}

function formatCreatureLuaRow(name, fields, keyColumn, wikiPage) {
  const lhs = wikiPage
    ? formatCreatureLuaKey(name, keyColumn)
    : `["${luaEscape(name)}"]            =`;
  const section = fields.is_unobtainable ? 'unobtainable' : fields.is_event ? 'event' : 'regular';
  const parts = buildCreatureLuaFieldParts(fields, section);
  return `${lhs} { ${parts.join(', ')} },`;
}

function getGazerExportNames(db) {
  const names = new Set();
  const monsters = db?.getAllMonstersWithPortraits?.() || [];
  monsters.forEach((monster) => {
    const name = monster?.metadata?.name;
    if (name && db?.isGazerCreatureName?.(name)) {
      names.add(name);
    }
  });
  (db?.CYCLOPEDIA_EXTRA_CREATURES || []).forEach((name) => {
    if (db?.isGazerCreatureName?.(name)) names.add(name);
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

function getCreatureExportSections() {
  const db = getCreatureDb();
  const eventSet = new Set(db?.EVENT_CREATURES || []);
  const unobtainableSet = new Set([
    ...(db?.UNOBTAINABLE_CREATURES || []),
    ...WIKI_EXTRA_UNOBTAINABLE
  ]);
  const gazerSet = new Set(getGazerExportNames(db));

  const regular = (db?.ALL_CREATURES || [])
    .filter((name) => !eventSet.has(name) && !gazerSet.has(name))
    .sort((a, b) => a.localeCompare(b));

  const event = [...eventSet].sort((a, b) => a.localeCompare(b));
  const unobtainable = [...unobtainableSet]
    .map((name) => getWikiKeyForCreatureName(name))
    .sort((a, b) => a.localeCompare(b));
  const gazers = [...gazerSet].sort((a, b) => a.localeCompare(b));

  return { regular, event, unobtainable, gazers };
}

function buildWikiLuaDocument(sectionBlocks) {
  const body = sectionBlocks
    .map(({ title, lines }) => {
      const header = `    -- =========================================================\n    -- ${title}\n    -- =========================================================`;
      return `${header}\n${lines.map((line) => `    ${line}`).join('\n')}`;
    })
    .join('\n\n');

  return `${WIKI_HEADER_COMMENTS}
return {

${body}

}`;
}

function getDefaultWikiLuaFilename() {
  return `creature-wiki-${new Date().toISOString().slice(0, 10)}.lua`;
}

function downloadTextAsFile(text, filename = getDefaultWikiLuaFilename()) {
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    console.log(`[creature-lua-export.js] Downloaded ${filename}`);
    return true;
  } catch (err) {
    console.warn('[creature-lua-export.js] Download failed:', err);
    return false;
  }
}

function copyTextToClipboard(text) {
  try {
    if (navigator.clipboard?.writeText) {
      return navigator.clipboard.writeText(text).then(
        () => {
          console.log('[creature-lua-export.js] Copied to clipboard.');
          return true;
        },
        (err) => {
          console.warn('[creature-lua-export.js] Clipboard copy failed:', err);
          return false;
        }
      );
    }
  } catch (err) {
    console.warn('[creature-lua-export.js] Clipboard copy failed:', err);
  }
  return Promise.resolve(false);
}

function buildCreatureLuaLines(names, section, keyColumn, wikiPage) {
  return names.map((creatureName) => {
    const fields = resolveCreatureStats(creatureName, section);
    return formatCreatureLuaRow(fields.wikiKey, fields, keyColumn, wikiPage);
  });
}

/**
 * Build Lua assignment lines for all creatures (live stats + wiki extras).
 * @param {{
 *   copy?: boolean,
 *   download?: boolean,
 *   filename?: string,
 *   wikiPage?: boolean,
 *   keyColumn?: number
 * }} options
 * @returns {string}
 */
function dumpCreatureLuaTable(options = {}) {
  const wikiPage = options.wikiPage === true;
  const shouldDownload = wikiPage && options.download !== false;
  const shouldCopy = wikiPage ? options.copy === true : options.copy !== false;

  const sections = getCreatureExportSections();
  const allNames = [
    ...sections.regular,
    ...sections.event,
    ...sections.unobtainable,
    ...sections.gazers
  ];

  let keyColumn = typeof options.keyColumn === 'number' ? options.keyColumn : null;
  if (wikiPage && keyColumn == null) {
    keyColumn = 31;
    for (const name of allNames) {
      const wikiKey = getWikiKeyForCreatureName(name);
      keyColumn = Math.max(keyColumn, `["${luaEscape(wikiKey)}"]`.length + 1);
    }
  }
  if (keyColumn == null) {
    keyColumn = 31;
  }

  const sectionDefs = [
    { title: 'REGULAR CREATURES', names: sections.regular, section: 'regular' },
    { title: 'EVENT CREATURES', names: sections.event, section: 'event' },
    { title: 'UNOBTAINABLE CREATURES', names: sections.unobtainable, section: 'unobtainable' },
    { title: 'GAZERS CREATURES', names: sections.gazers, section: 'gazers' }
  ];

  const sectionBlocks = sectionDefs.map(({ title, names, section }) => ({
    title,
    lines: buildCreatureLuaLines(names, section, keyColumn, wikiPage)
  }));

  const text = wikiPage
    ? buildWikiLuaDocument(sectionBlocks)
    : sectionBlocks.flatMap((block) => block.lines).join('\n');

  console.log(text);
  if (shouldDownload) {
    downloadTextAsFile(text, options.filename || getDefaultWikiLuaFilename());
  }
  if (shouldCopy) {
    void copyTextToClipboard(text);
  }
  return text;
}

/** Wiki-ready `return { ... }` export; downloads a .lua file by default. */
function dumpCreatureWikiLua(options = {}) {
  return dumpCreatureLuaTable({ ...options, wikiPage: true });
}

const globalWindow = globalThis.window || window;
if (globalWindow) {
  globalWindow.dumpCreatureLuaTable = dumpCreatureLuaTable;
  globalWindow.dumpCreatureWikiLua = dumpCreatureWikiLua;
  globalWindow.getCreatureExportSections = getCreatureExportSections;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    dumpCreatureLuaTable,
    dumpCreatureWikiLua,
    getCreatureExportSections,
    resolveCreatureStats,
    scaleCreatureStat,
    formatMaxedLevelStat,
    formatDualMaxedStat,
    formatLuaStatValue,
    normalizeCreatureRoles,
    formatCreatureLuaRow,
    buildWikiLuaDocument,
    copyTextToClipboard,
    downloadTextAsFile,
    getDefaultWikiLuaFilename,
    WIKI_CREATURE_EXTRA_FIELDS,
    WIKI_CREATURE_KEY_ALIASES,
    WIKI_EXTRA_UNOBTAINABLE
  };
}
