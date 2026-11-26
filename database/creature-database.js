console.log('[creature-database.js] Loading creature database...');

/**
 * Gazer species: only Mystic Gazer has a shiny portrait; shiny displays as Albino Gazer in Cyclopedia.
 * The ids come from the live monster registry (every monster named "*gazer*"; see populateGazerIds)
 * and are filled in place, so references taken before the registry was ready stay valid.
 */
const MYSTIC_GAZER_NAME = 'mystic gazer';
let MYSTIC_GAZER_GAME_ID = null;
const GAZER_GAME_IDS_WITHOUT_SHINY = new Set();
const ALL_GAZER_GAME_IDS = new Set();
const SHINY_ALIAS_CREATURES = [
  {
    displayName: 'Albino Gazer',
    gameId: null, // set to the Mystic Gazer id by populateGazerIds

    baseSpecies: 'Mystic Gazer',
    shinyOnly: true
  }
];
/**
 * Named room bosses that are a native species under a `nickname`, but play by different rules
 * (see docs/game_state_api.md, "Villain / room-script creature mechanics"). Display-only: no player can own one, so they never match an
 * inventory monster, have no shiny, and count as event creatures (no awaken / scroll / shiny).
 */
const BOSS_ALIAS_CREATURES = [
  {
    displayName: 'Hemorrhage',
    gameId: 127,
    baseSpecies: 'Clot',
    bossOnly: true,
    // The native Clot tooltip still says "Up to 2 clones"; the real rule is the room script's
    // (text lives in mapsDatabase.ROOM_SCRIPT_NOTES, shared with the map stats panel).
    roomScript: 'crhw2'
  },
  {
    // Not a species: the game builds a Monster Cauldron (gameId 83) and renames it at transform.
    displayName: 'Tentugly',
    gameId: 83,
    baseSpecies: 'Monster Cauldron',
    bossOnly: true,
    // Placed on maps as the plain Monster Cauldron actor (no nickname): locations match by id.
    transformedForm: true
  }
];
/**
 * Special-ability text for species / boss aliases whose behaviour the game's own tooltip does not
 * cover. Keys are lowercase display names. Shown in the Cyclopedia "Special ability" panel
 * (docs/game_state_api.md, "Other hidden game mechanics").
 */
const CREATURE_ABILITY_NOTES = {
  tentugly: 'When Tentugly transforms, every enemy is brought down to 1 HP one after another (not on floor 0), and fallen enemies are revived with 1 HP. Enemies from the Monster Cauldron are not affected.\nThe transform also creates four special floor tiles and summons tentacles.'
};

/**
 * Snapshot of each creature's ability constants, read from the game's minified creature bundle
 * (the numbers its ability tooltip prints). Keyed by gameId: `n` internal name, `ad` base
 * auto-attack delay in ms (null = engine default), `c` constants (`*_MS` values are milliseconds).
 * Only plain numbers are kept; nested tables and fractions are skipped. Not readable at runtime,
 * so regenerate with `node tools/check-creature-combat.mjs --update` after a game update
 * (docs/game_state_api.md, "Combat engine rules").
 */
// BEGIN CREATURE_COMBAT_DATA
const CREATURE_COMBAT_DATA = {
  1: {"n":"Rat","ad":null,"c":{"ATTACK_NORMAL":10,"ATTACKED":5},"v":{"ATTACK_ENRAGED":{"AWAKEN":10,"NO_AWAKEN":5}}},
  2: {"n":"Minotaur","ad":3000,"c":{"BASE_DMG":2,"AP_RATIO":0.5,"STUN_MS":2000,"COOLDOWN_MS":9000,"INITIAL_COOLDOWN_MS":3000,"AWAKEN_HEAL_PER_HIT_INNER":15,"AWAKEN_HEAL_PER_HIT_OUTER":5,"AWAKEN_CDR_MS_PER_HIT_INNER":500,"AWAKEN_CDR_MS_PER_HIT_OUTER":100,"MIN_COOLDOWN_MS":4000},"cb":"cooldown"},
  3: {"n":"Minotaur Mage","ad":null,"c":{"MAX_HP_EFFECT":1000,"CDR_PER_AP":180,"AWAKEN_SPLASH_DAMAGE":5,"BASE_COOLDOWN_MS":24000,"MIN_COOLDOWN_MS":5000},"r":99,"rc":true,"aa":false,"cb":"cooldown"},
  4: {"n":"Orc Spearman","ad":null,"c":{"SPEAR_DAMAGE_MULTIPLIER":2,"AWAKEN_LIFESTEAL":0.15,"AWAKEN_LIFESTEAL_DURATION_MS":3000,"COOLDOWN_MS":10000,"COOLDOWN_REDUCTION_PERCENT":0.5,"MIN_COOLDOWN_MS":4000},"r":3,"rc":true,"cb":"cooldown"},
  5: {"n":"Sheep","ad":null,"c":{"HEAL_BASE":15,"HEAL_AP_RATIO":0.6,"DEATH_HEAL_BASE_PERCENT":0.2,"DEATH_HEAL_PERCENT_PER_AP":0.01,"COOLDOWN_MS":3000,"MIN_COOLDOWN_MS":1000,"AWAKEN_HP_PERCENT_REVIVE":0.25},"aa":false,"cb":"cooldown"},
  6: {"n":"Wasp","ad":null,"c":{},"aa":false},
  7: {"n":"Skeleton","ad":null,"c":{"REVIVE_COOLDOWN_MS":32000,"CDR_MS_PER_AP":400,"AWAKEN_AD_PER_REVIVE":4,"MIN_COOLDOWN_MS":4000},"cb":"cooldown","cv":1},
  8: {"n":"Tortoise","ad":null,"c":{}},
  9: {"n":"Bear","ad":null,"c":{"COOLDOWN_MS":7500,"HEAL_BASE":5,"AD_RATIO":2,"STUN_MS":2000,"HEAL_AP_RATIO":0.15,"HEAL_TICK_FREQUENCY_MS":1250},"cb":"cooldown","cv":1},
  10: {"n":"Rotworm","ad":3000,"c":{}},
  11: {"n":"Spider","ad":3000,"c":{"BASE_DMG":10,"DMG_AP_RATIO":0.2,"BASE_DURATION":500,"COOLDOWN_MS":10000,"DURATION_AP_RATIO":50,"AWAKEN_FLAT_ARMOR":100,"MIN_COOLDOWN_MS":7000},"r":4,"rc":false,"cb":"cooldown"},
  12: {"n":"Goblin","ad":1000,"c":{"FLAT_BONUS_AD_PER_LEVEL":3,"AWAKEN_ATTACK_SPEED_PER_LEVEL":0.01,"INITIAL_DISTANCE_LEVEL":1},"r":4,"rc":true},
  13: {"n":"Wolf","ad":null,"c":{"BASE_EXECUTE_PERCENT":0.1,"CDR_MS":2000,"BUFF_FLAT_AP_PER_LUPINE":3,"BUFF_DURATION_MS":3000,"COOLDOWN_MS":10000,"CDR_TICKS":2000,"MIN_COOLDOWN_MS":3000},"cb":"cooldown"},
  14: {"n":"Troll","ad":3000,"c":{"SPAWN_COUNT":3,"AD_PER_USER_AP":0.1,"HP_PER_USER_AP":1,"AWAKEN_FLAT_STAT_BUFF":2,"COOLDOWN_MS":14000,"MIN_COOLDOWN_MS":5000},"s":[{"n":"Troll-Trained Salamander","st":{"hp":60,"ad":5,"ap":0,"armor":16,"magicResist":20,"speed":75}}],"cb":"cooldown"},
  15: {"n":"Poison Spider","ad":null,"c":{"TIMES":3,"DAMAGE_BASE":5,"DAMAGE_AP_RATIO":0.4,"AWAKEN_SPELL_VAMP_PERCENT":0.15,"COOLDOWN_MS":5000,"FLURRY_TICKS_INTERVAL":3,"MIN_COOLDOWN_MS":2500},"cb":"mana"},
  16: {"n":"Snake","ad":null,"c":{"BASE_DMG":10,"DMG_AP_RATIO":0.7,"STUN_BASE_DURATION_MS":3000,"STUN_DURATION_AP_RATIO":30,"FLAT_ARMOR":200,"AWAKEN_AP_DEBUFF_PERCENT":-1,"AWAKEN_AD_DEBUFF_PERCENT":-1,"COOLDOWN_MS":8000,"MAX_STUN_MS":6000,"MIN_COOLDOWN_MS":4000},"cb":"cooldown"},
  17: {"n":"Bug","ad":3000,"c":{}},
  18: {"n":"Slime","ad":4000,"c":{"STARTING_HP":5,"MAX_SPAWN_COUNT":2,"CDR_PER_AP":80,"AWAKEN_EXTRA_SPAWN":1,"BASE_COOLDOWN_MS":12000,"MIN_COOLDOWN_MS":2000}},
  19: {"n":"Ghoul","ad":3000,"c":{"AP_PERCENT_DAMAGE":0.2,"HP_PERCENT_HEAL_PER_TARGET":0.02,"CD_MS":2000,"MIN_COOLDOWN_MS":1000}},
  20: {"n":"Fire Devil","ad":null,"c":{"BASE_DMG":3,"DMG_AP_RATIO":0.7,"COOLDOWN_MS":3000,"AWAKEN_GREAT_FIREBALL_EVERY":3,"MIN_COOLDOWN_MS":1500},"r":2,"rc":true,"aa":false,"cb":"mana"},
  21: {"n":"Demon Skeleton","ad":null,"c":{"RECHARGE_MS":3000,"ATTACK_DAMAGE_BUFF":15,"LIFESTEAL_BASE":0.5,"ATTACK_DELAY_BUFF":-0.3,"HP_PERCENTAGE_DECAY_PER_TICK":0.1,"HP_DECAY_TICK_MS":1000,"LIFESTEAL_AP_RATIO":0.5},"cb":"hpLow","cv":1},
  22: {"n":"Ghost","ad":null,"c":{"CHARGE_TIME_MS":3000,"REVIVE_BASE_HP_PERCENT":0.5,"REVIVE_HP_PERCENT_AP_RATIO":0.5},"aa":false,"cb":"cooldown","cv":1},
  23: {"n":"Scorpion","ad":3000,"c":{"POISON_TICK_BASE_DMG":1,"POISON_TICK_AP_RATIO":0.15,"POISON_TICK_FREQUENCY_MS":1500,"POISON_BOOM_BASE_DMG":15,"POISON_BOOM_AP_RATIO":0.2,"POISON_DURATION_MS":12000}},
  24: {"n":"Monk","ad":null,"c":{"BONUS_FLAT_ARMOR":70,"BONUS_FLAT_MAGIC_RESIST":70,"HEAL_BASE":6,"HEAL_AP_RATIO":0.5,"EXPLOSION_DMG_PERCENT_BASE":0.4,"AWAKEN_HEAL_PERCENT":0.25,"COOLDOWN_MS":5000,"CHANNEL_DURATION_MS":6000,"TICK_FREQUENCY_MS":1500,"EXPLOSION_DMG_PERCENT_PER_AP":0.00125,"MIN_COOLDOWN_MS":1000},"cb":"mana"},
  25: {"n":"Banshee","ad":3000,"c":{"DMG_BASE":10,"DMG_AP_RATIO":0.7,"FLEE_HP_PERCENT":0.4,"HEAL_BASE":15,"HEAL_AP_RATIO":0.5,"AWAKEN_HEAL_REDUCTION_PERCENT":0.8,"AWAKEN_MAGIC_RESIST_REDUCTION_FLAT":-15,"AWAKEN_HEAL_REDUCTION_MS":2500,"COOLDOWN_MS":6000,"MIN_COOLDOWN_MS":2000},"cb":"mana"},
  26: {"n":"Dragon Lord","ad":3000,"c":{"STEP_DMG_BASE":3,"STEP_DMG_AP_RATIO":0.3,"AWAKEN_MOVE_SPEED_BUFF":30,"COOLDOWN_MS":5000,"AWAKEN_MOVE_SPEED_DURATION_MS":2000,"MIN_COOLDOWN_MS":500},"r":99,"rc":false,"cb":"mana"},
  27: {"n":"Stalker","ad":null,"c":{"INVISIBLE_DURATION_MS":6000,"FLAT_SPEED_BUFF":30,"FLAT_HEAL":3,"AP_RATIO_HEAL":0.15,"COOLDOWN_MS":7000,"AP_RATIO_SPEED_BUFF":0.5,"HEAL_FREQUENCY_MS":800,"MIN_COOLDOWN_MS":3000},"cb":"mana"},
  28: {"n":"Mummy","ad":3000,"c":{"DURATION_MS":4000,"SLOW_PERCENT":0.5,"STEP_BASE_DAMAGE_PERCENT":0.05,"COOLDOWN_MS":2000,"BASE_DAMAGE":0,"DAMAGE_AP_RATIO":0.15,"STEP_AP_RATIO_PERCENT":0.001},"cb":"cooldown"},
  29: {"n":"Druid","ad":null,"c":{"HEAL_BASE":2,"HEAL_AP_RATIO":0.2,"AP_BASE":20,"AP_PER_AP":0.5,"BUFF_DURATION_MS":6000,"COOLDOWN_MS":4000,"AWAKEN_SPELL_FACTOR":0.5,"MIN_COOLDOWN_MS":1000},"aa":false,"cb":"cooldown"},
  30: {"n":"Fire Elemental","ad":null,"c":{"BASE_DMG":20,"DMG_AP_RATIO":1.3,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":1500},"r":99,"rc":true,"aa":false,"cb":"mana"},
  31: {"n":"Frost Troll","ad":4000,"c":{"SNOWBALL_DAMAGE_BASE":15,"SNOWBALL_DAMAGE_AP_RATIO":0.7,"SNOWMAN_DURABILITY":3,"AWAKEN_ATTACK_DELAY_DEBUFF_PERCENT":0.1,"AWAKEN_ATTACK_SPEED_DEBUFF_MS":3000,"COOLDOWN_MS":7000,"MIN_COOLDOWN_MS":1500},"s":[{"n":"Snowman","st":{"hp":999,"ad":0,"ap":0,"armor":999,"magicResist":999,"speed":0}}],"am":"snowball","cb":"mana"},
  32: {"n":"Winter Wolf","ad":null,"c":{"DAMAGE_BASE":15,"DAMAGE_AP_RATIO":0.5,"ATTACK_DELAY_DEBUFF_PERCENT":0.15,"ATTACK_SPEED_DEBUFF_MS":3000,"CDR_MS":2000,"PROC_EVERY_BITES":3,"COOLDOWN_MS":10000,"STUN_MS":1000,"CDR_TICKS":2000,"MIN_COOLDOWN_MS":3000},"cb":"cooldown"},
  33: {"n":"Water Elemental","ad":3000,"c":{"MAX_BOUNCES":5,"DMG_BASE":5,"DMG_RATIO":0.6,"FLAT_MR_BUFF":15,"BUFF_DURATION_MS":4000,"HEAL_BASE":8,"HEAL_RATIO":0.4,"COOLDOWN_MS":7000,"AWAKEN_BONUS_BOUNCES":1,"MIN_COOLDOWN_MS":2500},"r":99,"rc":false,"cb":"cooldown"},
  34: {"n":"Minotaur Archer","ad":5000,"c":{"BOLT_COUNT":1,"AMMO_DMG":4,"MAX_AMMO":6},"r":4,"rc":true,"am":"bolt"},
  35: {"n":"Minotaur Guard","ad":3000,"c":{"TAUNT_BASE_DURATION_MS":5000,"HEAL_BASE_PER_UNIT":5,"HEAL_PER_AP_PER_UNIT":0.6,"REFLECT_BASE_DMG":6,"REFLECT_DMG_PER_AP":0.3,"AWAKEN_ATTACK_SPEED_PERCENT":0.4,"AWAKEN_AD_DEBUFF_FLAT":-15,"AWAKEN_DEBUFF_DURATION_MS":2000,"COOLDOWN_MS":7000,"MIN_COOLDOWN_MS":2000},"cb":"cooldown"},
  36: {"n":"Wyvern","ad":null,"c":{"DMG_BASE":5,"DMG_AP_RATIO":0.2,"HEAL_BASE":10,"HEAL_AP_RATIO":0.2,"AWAKEN_FLEE_STUN_MS":1000,"COOLDOWN_BASE_MS":3000,"PUSH_TARGET_SPEED":255,"FLEE_HP_PERCENT":0.3,"MIN_COOLDOWN_MS":2000},"cb":"mana"},
  37: {"n":"Deer","ad":null,"c":{"ATTACK_DELAY_PERCENT_BUFF_BASE":-0.25,"MAX_BUFF":-0.8,"BUFF_DURATION":3500,"AWAKEN_RANGE":3,"RANGE":2,"ATTACK_DELAY_PERCENT_BUFF_PER_AP":-0.0025},"aa":false},
  38: {"n":"Polar Bear","ad":null,"c":{"SLOW_PERCENT":-0.4,"DAMAGE_BASE":17,"DAMAGE_AP_RATIO":3,"CHARGE_MS":4500,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":1000},"aa":false,"cb":"cooldown"},
  39: {"n":"Elf","ad":null,"c":{"WALL_DURATION_MS":6000,"COOLDOWN_MS_REDUCTION_PER_AP":60,"COOLDOWN_BASE_MS":16000,"MIN_COOLDOWN_MS":7000},"r":3,"rc":true,"am":"arrow","cb":"cooldown"},
  40: {"n":"Elf Scout","ad":null,"c":{"SLOW_BASE_PERCENT":0.05,"AD_PER_DISTANCE":6,"SLOW_PERCENT_PER_AP":0.003,"SLOW_DURATION_MS":2500},"am":"iceArrow"},
  41: {"n":"Elf Arcanist","ad":3000,"c":{"BUFF_FLAT_AD":20,"BUFF_FLAT_AP":30,"BUFF_DURATION_MS":10000,"AWAKEN_ELVEN_ATTACK_DELAY_BUFF":-0.3,"CHANNEL_DURATION_MS":3500,"AUTO_ATTACK_DAMAGE_PER_AP":0.5},"aa":false},
  42: {"n":"Orc Berserker","ad":3000,"c":{"MIN_HP_PERCENT_TRIGGER":0.1,"BONUS_ATTACK_DELAY":-0.8,"LIFESTEAL":3,"BONUS_MOVE_SPEED":40,"COOLDOWN_MS":9000}},
  43: {"n":"Orc Leader","ad":null,"c":{"DEBUFF_ARMOR_BASE":2,"DEBUFF_ARMOR_PER_AP":0.1,"MOVE_SPEED_BUFF":40,"HEAL_PERCENT":0.25,"TAUNT_DURATION_MS":6000,"AWAKEN_MISSING_HP_HEAL_PERCENT":0.25,"COOLDOWN_MS":8500,"MIN_COOLDOWN_MS":2500},"r":99,"rc":false,"cb":"cooldown"},
  44: {"n":"Orc Shaman","ad":null,"c":{"AUTO_ATTACK_DMG_BASE":2,"AUTO_ATTACK_DMG_PER_AP":0.8,"CHANNEL_MS":3500,"ZOMBIE_HP_PERCENT_DMG_TICK_BASE":0.12,"ZOMBIE_HP_PERCENT_DMG_TICK_PER_AP":-0.0005,"ZOMBIE_TICKER_FREQUENCY_MS":1000},"r":3,"rc":true,"aa":false,"cb":"abilityPower"},
  45: {"n":"Orc Rider","ad":null,"c":{"BASE_WOLF_COUNT":2,"WOLF_BASE_HP":70,"WOLF_HP_PER_AP":3,"AWAKEN_EXTRA_WOLF_COUNT":1},"s":[{"n":"War Wolf","st":{"hp":0,"ad":0,"ap":0,"armor":23,"magicResist":16,"speed":145}}]},
  46: {"n":"Orc Warlord","ad":null,"c":{"MAX_STACKS":30,"BUFF_DURATION_MS":6000,"LIFESTEAL_BASE":0.1,"MAGIC_DAMAGE_AUTO_BASE":5,"MAGIC_DAMAGE_AUTO_AP_RATIO":0.1,"AWAKEN_INITIAL_STACKS":25,"LIFESTEAL_PER_AP":0.0025}},
  47: {"n":"Goblin Scavenger","ad":1000,"c":{"ARMOR_BASE":30,"ARMOR_PER_AP":1,"MAX_HIT_DURABILITY":10,"COOLDOWN_MS":5000,"PROC_EVERY_ATTACKS":3,"MIN_COOLDOWN_MS":1500},"cb":"cooldown"},
  48: {"n":"Goblin Assassin","ad":1000,"c":{"STEROID_SPEED_FLAT_BONUS":60,"STEROID_DURATION_MS":3000,"TARGET_MIN_CURRENT_HP_PERCENT_EXECUTE":0.2,"COOLDOWN_MS":5000,"AWAKEN_DODGE_DURATION_MS":3000}},
  49: {"n":"Firestarter","ad":null,"c":{"FIRE_BASE_DMG":3,"FIRE_DMG_PER_AP":0.4,"FIRE_DURATION_MS":6000,"AWAKEN_EFFECT_DURATION_MS":5000,"AWAKEN_SPEED_BONUS":50},"r":3,"rc":true,"am":"fireArrow"},
  50: {"n":"Cyclops","ad":5000,"c":{"DMG_BASE":16,"DMG_AP_RATIO":0.4}},
  51: {"n":"Warlock","ad":null,"c":{"HEAL_BASE":10,"HEAL_PER_AP":0.5,"MISSILE_DAMAGE_PER_AP":1.25,"AOE_DAMAGE_BASE":5,"AOE_DAMAGE_PER_AP":0.3,"AWAKEN_AP_PERCENT":0.3,"COOLDOWN_MS":6000,"ATTACK_SPELL_CD_MS":3500,"MIN_COOLDOWN_MS":2500,"MIN_ATTACK_CD_MS":1500},"r":99,"rc":true,"s":[{"n":"Stone Golem","st":{"hp":130,"ad":16,"ap":0,"armor":150,"magicResist":12,"speed":90}}],"aa":false,"cb":"cooldown"},
  52: {"n":"Knight","ad":4000,"c":{"EXORI_BASE_DAMAGE":2,"EXORI_DMG_PER_AP":0.4,"BASE_HEAL":20,"MAX_HP_PERCENT_HEAL":0.08},"cb":"cooldown","v":{"EXORI_CD_MS":{"NONE":8000,"CLUB":8000,"SWORD":8000,"AXE":3000},"MIN_EXORI_CD_MS":{"NONE":5000,"CLUB":7000,"SWORD":5000,"AXE":1500}}},
  53: {"n":"Dwarf","ad":null,"c":{"BARREL_CHARGE_MS":3000,"BASE_DAMAGE":25,"DMG_AP_RATIO":1.5,"FLEE_SPEED_BOOST":30,"CAST_RANGE":2},"s":[{"n":"Barrel","st":{"hp":50,"ad":0,"ap":0,"armor":90,"magicResist":90,"speed":90}}],"aa":false},
  54: {"n":"Dwarf Soldier","ad":null,"c":{},"r":2,"rc":true},
  55: {"n":"Dwarf Guard","ad":3000,"c":{"MELEE_DAMAGE_MODIFIER":0.5,"HEAL_HP_PERCENT":0.08,"STUN_MS_PER_DISTANCE":1000,"HEAL_TICK_FREQUENCY_MS":2000,"AWAKEN_RANGE_LIMIT":1}},
  56: {"n":"Dwarf Geomancer","ad":null,"c":{"STONE_BASE_DMG":10,"STONE_DMG_PER_AD":0.5,"BASE_HEAL":15,"HEAL_PER_AP":1,"STONE_RECHARGE_MS":8000,"STONE_CLEANUP_DELAY_MS":2000,"STONE_TOSS_MS":1000},"aa":false,"cb":"abilityPower"},
  57: {"n":"Energy Crystal","ad":null,"c":{"COOLDOWN_MS":3000,"MAX_DWARFS":5,"MIN_COOLDOWN_MS":1500},"s":[{"n":"Dwarf Henchman","st":{"hp":10,"ad":10,"ap":0,"armor":5,"magicResist":10,"speed":105}}],"aa":false,"cb":"cooldown"},
  58: {"n":"Magma Crystal","ad":null,"c":{"COOLDOWN_MS":10000,"DAMAGE_HP_PERCENT":0.5,"MIN_COOLDOWN_MS":3000},"r":99,"rc":false,"aa":false,"cb":"cooldown"},
  59: {"n":"Earth Crystal","ad":null,"c":{"COOLDOWN_MS":3000,"HEAL_BASE":100,"MIN_COOLDOWN_MS":1000},"aa":false,"cb":"cooldown"},
  60: {"n":"Rorc","ad":4000,"c":{"FLEE_SPEED_BONUS":100,"STUN_MS":1500,"LIFESTEAL_BASE":0.6,"AWAKEN_AOE_DMG_PERCENT":0.1,"LIFESTEAL_PER_AP":0.0025}},
  61: {"n":"Nightstalker","ad":null,"c":{"EXECUTE_PERCENT_BASE":0.1,"SPELLVAMP":0.6,"COOLDOWN_MS":7000,"INITIAL_COOLDOWN_MS":2000,"AWAKEN_POST_BLINK_INVULNERABILITY_MS":750,"EXECUTE_PERCENT_PER_AP":0.0025,"MIN_COOLDOWN_MS":2500},"cb":"cooldown"},
  62: {"n":"Bog Raider","ad":null,"c":{"HP_FLAT_COST":25,"DAMAGE_BASE":20,"DAMAGE_AP_RATIO":1,"HP_PERCENT_HEAL":0.25,"AWAKEN_ARMOR_PER_MISSING_HP_PERCENT":1,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":2000},"cb":"cooldown"},
  63: {"n":"Orc","ad":null,"c":{"EQUIP_AD":40}},
  64: {"n":"Sweaty Cyclops","ad":4000,"c":{"HEAL_HP_PERCENT_BASE":0.02,"HEAL_TICKER_FREQUENCY_MS":1000,"COOLDOWN_MS":1000,"MAX_COUNTER":3,"HEAL_HP_PERCENT_PER_AP":0.008}},
  65: {"n":"Dragon","ad":null,"c":{"DMG_BASE":15,"DMG_PER_AP":1,"STAT_REDUCTION_BASE_PERCENT":-0.15,"DEBUFF_DURATION_MS":5000,"COOLDOWN_MS":8000,"MIN_COOLDOWN_MS":1500,"DEBUFF_RANGE":2,"STAT_REDUCTION_AP_RATIO_PERCENT":-0.003},"r":99,"rc":false,"ic":2000,"cb":"cooldown"},
  66: {"n":"Witch","ad":null,"c":{"DAMAGE_BASE":15,"DAMAGE_PER_AP":1.2,"DEBUFF_DURATION_MS":4000,"ATTACK_DELAY_PERCENT_BASE":0.4,"COOLDOWN_MS":8000,"ATTACK_DELAY_PERCENT_PER_AP":0.005,"DEBUFF_RANGE_LIMIT":1,"MIN_COOLDOWN_MS":5500},"r":99,"rc":true,"ic":2000,"aa":false,"cb":"cooldown"},
  67: {"n":"Old Giant Spider","ad":4000,"c":{"COCOON_BASE_DAMAGE":10,"COCOON_DAMAGE_PER_AP":2,"COCOON_STUN_MS":3000,"COCOON_ARMOR_BUFF":100,"COCOON_ARMOR_MS":5000,"ATTACK_DELAY_BUFF_PERCENT":-0.3,"COCOON_COOLDOWN_MS":8000,"MIN_COCOON_COOLDOWN_MS":2000,"ALLY_MAGIC_DAMAGE_TO_HEAL_PERCENT":1},"r":99,"rc":false,"cb":"cooldown"},
  68: {"n":"Amazon","ad":3000,"c":{"MAX_HP_PERCENT_BASE":0.01,"AWAKEN_HEAL_REDUCTION_PERCENT":0.25,"COOLDOWN_MS":3500,"AWAKEN_EFFECT_DURATION_MS":5000,"AWAKEN_BLEED_TICK_FREQUENCY_MS":1000,"AWAKEN_BLEED_DMG_PER_TICK":6,"MAX_KNIVES":2,"LIFESTEAL_BASE":0.8,"MAX_HP_PERCENT_PER_AP":0.001,"MIN_COOLDOWN_MS":500},"r":4,"rc":true,"am":"throwingKnife","cb":"cooldown"},
  69: {"n":"Valkyrie","ad":3500,"c":{"BASE_LIFESTEAL":0.1,"AWAKEN_MALE_DAMAGE_BONUS":0.05,"COOLDOWN_MS":3000,"LIFESTEAL_PER_AP":0.0025,"MIN_COOLDOWN_MS":1500},"r":3,"rc":false,"am":"spear","cb":"cooldown"},
  70: {"n":"Lavahole","ad":null,"c":{"HP_PERCENT":0.35,"CHARGE_MS":1500,"COOLDOWN_MS":2000},"aa":false,"cb":"cooldown"},
  71: {"n":"Corym Charlatan","ad":null,"c":{"SNATCH_BASE_DMG":20,"SNATCH_DMG_PER_AP":2,"HEAL_BASE":20,"HEAL_PER_AP":1,"COOLDOWN_MS":9000,"MIN_COOLDOWN_MS":1000},"cb":"cooldown"},
  72: {"n":"Corym Skirmisher","ad":null,"c":{"INVI_ON_HIT_ARMOR_REDUCTION":-3,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":3000,"INVI_DURATION_MS":5000,"ARMOR_REDUCTION_DURATION_MS":3000,"MIN_COOLDOWN_MS":1000},"cb":"cooldown"},
  73: {"n":"Corym Vanguard","ad":4000,"c":{"BURST_AD_FLAT":1,"BURST_AD_RATIO":0.5,"IGNORED_MAX_DAMAGE":22,"IGNORE_DMG_HEAL_BASE":5,"BURST_STACKS":20,"AWAKEN_IGNORED_MIN_DAMAGE":140,"IGNORE_DMG_HEAL_PER_AP":0.1}},
  74: {"n":"Black Knight","ad":500,"c":{"SPEAR_DMG_MULTIPLIER":5,"HP_MOUNT_THRESHOLD":0.25,"MOVEMENT_SPEED_BUFF":180},"am":"royalSpear"},
  75: {"n":"Dead Tree","ad":null,"c":{},"aa":false,"cb":"cooldown"},
  76: {"n":"Giant Spider","ad":4000,"c":{"BASE_LIFESTEAL":0.5,"AWAKEN_EGG_HATCH_COOLDOWN_MS":12000,"COOLDOWN_MS":18000,"VMAMA_AWAKEN_EGG_HATCH_COOLDOWN_MS":6000,"MIN_COOLDOWN_MS":6000},"ic":1000,"s":[{"n":"Spider Egg","st":{"hp":160,"ad":0,"ap":0,"armor":20,"magicResist":30,"speed":90}}],"cb":"cooldown"},
  77: {"n":"Swamp Troll","ad":3000,"c":{"SPAWN_COUNT":2,"SLUG_LIFESTEAL":1,"AWAKEN_EXTRA_SPAWN_COUNT":1,"COOLDOWN_MS":14000,"MIN_COOLDOWN_MS":5000},"ic":2000,"s":[{"n":"Slug","st":{"hp":60,"ad":5,"ap":0,"armor":16,"magicResist":20,"speed":75}}],"cb":"cooldown"},
  78: {"n":"Willi Wasp","ad":null,"c":{}},
  79: {"n":"Dharalion","ad":3000,"c":{"BUFF_FLAT_AP":30,"BUFF_FLAT_AD":20,"HEAL_PER_AP":4,"CHANNEL_DURATION_MS":3500,"TICK_FREQUENCY_MS":1500,"AUTO_ATTACK_DAMAGE_PER_AP":5},"r":4,"rc":true,"aa":false},
  80: {"n":"Yeti","ad":5000,"c":{"SLOW_PERCENT":0.25,"SNOW_DMG_BASE":2,"SNOW_DMG_PER_AP":0.1,"SNOW_HEAL_BASE":5,"SNOW_HEAL_PER_AP":0.05,"DURATION_MS":6000,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":5000,"SLOW_DURATION_MS":2000,"RANGE":2,"MIN_COOLDOWN_MS":2000},"cb":"cooldown"},
  81: {"n":"Regeneration Tank","ad":null,"c":{"COOLDOWN_MS":3000,"MIN_COOLDOWN_MS":1500,"HP_FLAT_COST":25,"DAMAGE_BASE":20,"DAMAGE_AP_RATIO":1,"HP_PERCENT_HEAL":0.25},"aa":false,"cb":"cooldown"},
  82: {"n":"Gummy Raider","ad":null,"c":{"HP_FLAT_COST":25,"DAMAGE_BASE":20,"DAMAGE_AP_RATIO":1,"HP_PERCENT_HEAL":0.25,"AWAKEN_ARMOR_PER_MISSING_HP_PERCENT":1,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":2000}},
  83: {"n":"Monster Cauldron","ad":null,"c":{},"r":99,"rc":true,"am":"energyBeam","cb":"cooldown"},
  84: {"n":"Grynch Clan Commander","ad":null,"c":{"COOLDOWN_MS":12000,"MIN_COOLDOWN_MS":4000},"ic":1000,"cb":"cooldown"},
  85: {"n":"Goblin Gumslinger","ad":1000,"c":{"FLAT_BONUS_AD_PER_LEVEL":3,"AWAKEN_ATTACK_SPEED_PER_LEVEL":0.01,"INITIAL_DISTANCE_LEVEL":1},"r":4,"rc":true},
  86: {"n":"Goblin Saboteur","ad":1000,"c":{"STEROID_SPEED_FLAT_BONUS":60,"STEROID_DURATION_MS":3000,"TARGET_MIN_CURRENT_HP_PERCENT_EXECUTE":0.2,"COOLDOWN_MS":5000,"AWAKEN_DODGE_DURATION_MS":3000}},
  87: {"n":"Unionized Goblin","ad":1000,"c":{"ARMOR_BASE":30,"ARMOR_PER_AP":1,"MAX_HIT_DURABILITY":10,"COOLDOWN_MS":5000,"PROC_EVERY_ATTACKS":3,"MIN_COOLDOWN_MS":1500}},
  88: {"n":"Reindeer","ad":null,"c":{"ATTACK_DELAY_PERCENT_BUFF_BASE":-0.25,"MAX_BUFF":-0.8,"BUFF_DURATION":3500,"AWAKEN_RANGE":3,"RANGE":2,"ATTACK_DELAY_PERCENT_BUFF_PER_AP":-0.0025}},
  89: {"n":"Dwarf Merrymancer","ad":null,"c":{"STONE_BASE_DMG":10,"STONE_DMG_PER_AD":0.5,"BASE_HEAL":15,"HEAL_PER_AP":1,"STONE_RECHARGE_MS":8000,"STONE_CLEANUP_DELAY_MS":2000,"STONE_TOSS_MS":1000}},
  90: {"n":"The Percht Queen","ad":null,"c":{"SPAWN_LEVEL_PER_FLOOR":1,"CD_MULTIPLIER_PER_SPAWN":0.2,"MAX_CD_MS":6000,"CDR_MS_PER_FLOOR":250,"MIN_CD_MS":2000},"aa":false,"cb":"cooldown"},
  91: {"n":"Grynch Clan Mastermind","ad":null,"c":{"DEBUFF_RANGE_LIMIT":1,"BASE_COOLDOWN_MS":2000,"CDR_PER_FLOOR_MS":50,"MIN_COOLDOWN_MS":700,"GOBLIN_HP_DAMAGE_PERCENT":0.9},"aa":false,"cb":"attackSpeed"},
  92: {"n":"Beer Barrel","ad":null,"c":{"OBSTACLE_TRUE_DAMAGE":40,"EXPLOSION_TRUE_DMG":300},"aa":false},
  98: {"n":"Green Djinn","ad":3000,"c":{"JAR_BASE_DURATION_MS":1000,"COOLDOWN_MS":8000,"JAR_DURATION_MS_PER_AP":40,"AUTO_ATTACK_DAMAGE_PER_AP":0.5,"MIN_COOLDOWN_MS":2500},"r":5,"rc":true,"aa":false,"cb":"cooldown"},
  99: {"n":"Ancient Scarab","ad":3000,"c":{"REVIVE_BASE_HP":25,"REVEIVE_HP_PER_AP":2},"s":[{"n":"Larva","st":{"hp":180,"ad":0,"ap":0,"armor":8,"magicResist":6,"speed":45}},{"n":"Scarab","st":{"hp":800,"ad":0,"ap":0,"armor":16,"magicResist":10,"speed":45}}]},
  100: {"n":"Obelisk","ad":null,"c":{"BASE_AP":50,"AP_PER_FLOOR":5},"aa":false},
  101: {"n":"Thalas","ad":null,"c":{"BASE_DAMAGE":10,"DAMAGE_PER_AP":0.7,"AWAKEN_COOLDOWN_MS":3000,"COOLDOWN_MS":9000,"INITIAL_COOLDOWN_MS":4000,"BRIEF_STUN_MS":500,"MIN_COOLDOWN_MS":4000},"cb":"cooldown"},
  102: {"n":"Cobra Statue","ad":null,"c":{"HEAL_PER_AP":2,"COOLDOWN_MS":8000,"MIN_COOLDOWN_MS":500},"r":6,"rc":true,"am":"poisonSting","cb":"cooldown"},
  103: {"n":"Nomad","ad":3000,"c":{"TAUNT_DURATION_MS":5000,"FLAT_TAUNT_AP_BUFF":40,"FLAT_TAUNT_AD_BUFF":15,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":3000},"cb":"cooldown"},
  104: {"n":"Blue Djinn","ad":null,"c":{"DMG_BASE":15,"DMG_PER_AP":0.7,"SILENCE_DURATION_MS":3500,"COOLDOWN_MS":7000,"MIN_COOLDOWN_MS":2000},"cb":"cooldown"},
  105: {"n":"Bonelord","ad":null,"c":{"BASE_HEAL_PER_UNIT":10,"HEAL_PER_AP_PER_UNIT":0.2,"COOLDOWN_MS":11000,"INITIAL_COOLDOWN_MS":6000,"MIN_COOLDOWN_MS":6000},"aa":false,"cb":"cooldown"},
  106: {"n":"Omruc","ad":1000,"c":{"COOLDOWN_MS":10000,"INVI_DURATION_MS":7500,"MIN_COOLDOWN_MS":9000},"r":4,"rc":true,"ic":2000,"am":"arrow","cb":"cooldown"},
  107: {"n":"Morguthis","ad":null,"c":{}},
  108: {"n":"Rahemos","ad":null,"c":{"COOLDOWN_MS":3000,"CENTER_TILE_IDX":82},"v":{"WC_BUFFS":{"WIN_AP_FLAT_BUFF":20,"WIN_AD_FLAT_BUFF":10,"WIN_HP_FLAT_BUFF":200},"BUFFS":{"WIN_AP_FLAT_BUFF":90,"WIN_AD_FLAT_BUFF":40,"WIN_HP_FLAT_BUFF":600}}},
  109: {"n":"Football Elemental","ad":3000,"c":{"MAX_BOUNCES":5,"DMG_BASE":5,"DMG_RATIO":0.6,"FLAT_MR_BUFF":15,"BUFF_DURATION_MS":4000,"HEAL_BASE":8,"HEAL_RATIO":0.4,"COOLDOWN_MS":7000,"AWAKEN_BONUS_BOUNCES":1,"MIN_COOLDOWN_MS":2500},"r":99,"rc":false},
  110: {"n":"Werefox","ad":3000,"c":{"HEAL_BASE":1,"HEAL_PER_AP":0.05,"COOLDOWN_MS":9000,"EFFECT_DURATION_MS":3500,"ATTACK_DELAY_PERCENT":-0.6,"SPEED_BUFF":160,"SPLASH_DAMAGE_FACTOR":0.5,"MIN_COOLDOWN_MS":2500},"r":4,"rc":true,"ic":5000,"s":[{"n":"Werefox Statue","st":{"hp":280,"ad":0,"ap":0,"armor":300,"magicResist":300,"speed":90},"aa":false}],"am":"royalStar","cb":"cooldown"},
  111: {"n":"Hunter","ad":null,"c":{"TRAP_DAMAGE_BASE":10,"TRAP_DAMAGE_PER_AP":1,"TRAP_DURATION_MS":3500,"TRAP_BONUS_SPEED":40,"TRAP_BONUS_RANGE":4,"AWAKEN_HP_PERCENT":0.08,"TRAP_SETUP_MS":200,"COOLDOWN_MS":9000,"MIN_COOLDOWN_MS":2500},"r":3,"rc":true,"am":"arrow","cb":"cooldown"},
  112: {"n":"Cyclops Drone","ad":5000,"c":{"DMG_BASE":10,"DMG_AP_RATIO":0.6,"AWAKEN_MIN_ENEMIES_HIT":3,"BRIEF_STUN_MS":500,"BOUNCE_MS":1000,"COOLDOWN_MS":7000,"AWAKEN_COOLDOWN_REDUCTION_PERCENT":0.5,"PUSH_TARGET_SPEED":1360,"SHAKE_MS":125,"MIN_COOLDOWN_MS":3000},"cb":"cooldown"},
  113: {"n":"Behemoth","ad":4000,"c":{"SPIKE_BASE_DMG":10,"SPIKE_DAMAGE_PER_AD":0.5,"ARENA_FADE_OUT_MS":300,"COOLDOWN_MS":11000,"INITIAL_COOLDOWN_MS":4500,"ARENA_DURATION_MS":5000,"MIN_COOLDOWN_MS":7000,"AWAKEN_DAMAGE_REDUCTION":0.5},"r":99,"rc":false,"am":"boulder","cb":"cooldown"},
  114: {"n":"Cyclops Smith","ad":4000,"c":{"MAX_BOUNCES":4,"DMG_BASE":1,"DMG_AD_RATIO":1,"HEAL_PER_AP":0.2,"HEAL_BASE":10,"COOLDOWN_MS":5000,"MIN_COOLDOWN_MS":2000},"cb":"cooldown"},
  115: {"n":"Cake Drake","ad":null,"c":{"DMG_BASE":10,"DMG_PER_AP":0.5,"STAT_REDUCTION_BASE_PERCENT":-0.35,"DEBUFF_DURATION_MS":1500,"COOLDOWN_MS":1450,"MIN_COOLDOWN_MS":1000,"DMG_MULTIPLIER_A":1,"DMG_MULTIPLIER_B":1,"DEBUFF_RANGE":99,"STAT_REDUCTION_AP_RATIO_PERCENT":-0.003},"aa":false,"cb":"cooldown"},
  116: {"n":"Hero","ad":null,"c":{"IGNORED_ARMOR_PER_STACK":10,"LIFESTEAL_PER_STACK":0.15,"LAST_ALIVE_LIFESTEAL_PERCENT":0.3,"LIFESTEAL_BASE":0.1,"LIFESTEAL_MAX":1},"r":2,"rc":true,"am":"arrow","cb":"cooldown"},
  117: {"n":"Astronis","ad":null,"c":{"ATTACK_DELAY_MS":3000,"COOLDOWN_MS":1500,"FLAT_ATTACK_BONUS":20,"ICE_RAPIER_MULTIPLIER":2}},
  118: {"n":"Setzer Gambler","ad":null,"c":{"DMG_BASE":20,"DMG_PER_AP":2,"COOLDOWN_MS":4000,"RANGE":7,"MIN_COOLDOWN_MS":2000},"aa":false,"cb":"cooldown"},
  119: {"n":"Ti","ad":null,"c":{},"r":7,"rc":true,"am":"burstArrow"},
  120: {"n":"Mateusz Dragon Wielki","ad":null,"c":{"HEAL_BASE":10,"HEAL_PER_AP":3,"COOLDOWN_MS":6500,"MIN_COOLDOWN_MS":2500},"aa":false,"cb":"cooldown"},
  121: {"n":"The Pale Count","ad":null,"c":{"BAT_PARENT_AD_PERCENT":0.1,"BAT_LIFESTEAL_PERCENT":0.1,"BAT_LIFESTEAL_PER_AP":0.01,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":6000,"DURATION_MS":7000,"TILES_SPAWNED_PERCENT":0.4,"MIN_COOLDOWN_MS":6000},"s":[{"n":"Bat","st":{"hp":140,"ad":0,"ap":0,"armor":16,"magicResist":23,"speed":190}}],"cb":"cooldown"},
  122: {"n":"Vampire Bride","ad":null,"c":{"HEART_BASE_DMG":0,"HEART_DMG_PER_AD":1,"SPELLVAMP_BASE_PERCENT":2.5,"COOLDOWN_MS":3000,"CHARGE_MS":800,"SPELLVAMP_PER_AP":0.0015,"MIN_COOLDOWN_MS":1000},"s":[{"n":"Bride's Heart","st":{"hp":0,"ad":0,"ap":0,"armor":0,"magicResist":0,"speed":190}}],"cb":"cooldown"},
  123: {"n":"Paladin","ad":null,"c":{"PASS_THROUGH_BASE":5,"PASS_THROUGH_AP_RATIO":0.15,"ARMOR_PER_ENEMY":6},"r":2,"rc":true,"am":"assassinStar"},
  124: {"n":"Dark Apprentice","ad":null,"c":{"COOLDOWN_MS":3000,"MIN_COOLDOWN_MS":1500,"DMG_BASE":5,"DMG_PER_AP":0.6,"AWAKEN_DMG_INCREMENT":0.2}},
  125: {"n":"Dark Magician","ad":null,"c":{"AWAKEN_DMG_INCREMENT":0.2,"DMG_BASE":5,"DMG_PER_AP":0.6,"COOLDOWN_MS":3000,"MIN_COOLDOWN_MS":1500}},
  126: {"n":"Vladrukh","ad":null,"c":{"DAMAGE_CAP":5,"COOLDOWN_MS":9000,"INITIAL_COOLDOWN_MS":4000,"BRIEF_STUN_MS":500,"MIN_COOLDOWN_MS":5000},"cb":"cooldown"},
  127: {"n":"Clot","ad":4000,"c":{"STARTING_HP":5,"MAX_SPAWN_COUNT":2,"CDR_PER_AP":80,"AWAKEN_EXTRA_SPAWN":1,"BASE_COOLDOWN_MS":12000,"MIN_COOLDOWN_MS":2000}},
  128: {"n":"Orshabaal","ad":3000,"c":{"COOLDOWN_MS":4500,"BASE_DMG":20,"DMG_AP_RATIO":1.2,"MIN_COOLDOWN_MS":1000},"r":99,"rc":false,"ic":1000,"cb":"cooldown"},
  129: {"n":"Rostein","ad":null,"c":{}},
  130: {"n":"Shooter","ad":null,"c":{"SD_BASE_DMG":40,"SD_DMG_AP_RATIO":0.6,"AUTO_ATTACK_RANGE":9},"am":"bolt","cb":"cooldown"},
  131: {"n":"Healer","ad":null,"c":{"HEAL_BASE":90,"HEAL_AP_RATIO":0.8},"aa":false,"cb":"cooldown"},
  132: {"n":"Demon","ad":null,"c":{"BASE_DMG":15,"DMG_AP_RATIO":0.5,"FIREBALL_BASE_DMG":5,"FIREBALL_DMG_AP_RATIO":0.3,"FIREBALL_COOLDOWN_MS":5000,"COOLDOWN_MS":4000,"CONVERT_BRAIN_DURATION_MS":2000,"RANGE":8,"FIREBALL_RANGE":4,"MIN_COOLDOWN_MS":1500,"CONVERT_BRAIN_FADE_OUT_MS":300},"ic":1000,"cb":"cooldown"}
};
// END CREATURE_COMBAT_DATA

// Numbers the game keeps in unnamed minified variables or lowercase-key objects (Wasp `nh/np/nm`, Bug `eo`, Tortoise `ns`),
// so tools/check-creature-combat.mjs cannot extract them. Hand-written, same UPPER_SNAKE naming and units (ms) as the
// snapshot. Shown in the Cyclopedia only: the Map Editor's constant overrides cannot change them, so it never lists them.
// Re-read them from the game after an update (see docs/creature_combat_snapshot.md).
const CREATURE_COMBAT_EXTRA = {
  1: { TRANSFORMED_ATTACK_DAMAGE: 7, TRANSFORMED_LIFESTEAL: 0.25, TRANSFORMED_ATTACK_SPEED: 0.3 },
  49: { FIRE_STAGE_DURATION_MS: 2000 },
  62: { MUCUS_DURATION_MS: 10000 },
  70: { FIRE_DURATION_MS: 1000 },
  6: { POISON_DAMAGE_BASE: 1, POISON_DAMAGE_PER_AP: 0.35, POISON_TICK_FREQUENCY_MS: 4000, POISON_DURATION_MS: 24000, AWAKEN_SPEED_BUFF: 25 },
  8: { FLAT_ARMOR: 30, BONUS_ARMOR_PERCENT: 0.3, AWAKEN_HP_PER_STACK: 40 },
  17: { STACK_1_LIFESTEAL: 0.2, STACK_2_ATTACK_SPEED: 0.5, STACK_3_ATTACK_DAMAGE: 15, STACK_4_MAGIC_RESIST: 20, STACK_5_SPEED: 25 }
};

// Ability scenes (Cyclopedia: hover the ability icon). Generated by tools/check-ability-scenes.mjs; never edit by hand.
// FALLBACK frame size and playback of the effect sheets the scenes draw (getEffectSheet reads the page's own stylesheet first).
// Generated by tools/check-ability-scenes.mjs --update (see tools/effect-sheets.mjs for the format); never edit by hand.
// BEGIN EFFECT_SHEET_DATA
const EFFECT_SHEET_DATA = {
  1: {"w":32,"h":32,"n":6,"ms":600,"from":0,"to":6,"steps":6},
  2: {"w":32,"h":32,"n":12,"ms":1280,"keys":[[0,0],[8,1],[16,2],[23,3],[31,4],[39,5],[47,6],[55,7],[63,8],[70,9],[78,10],[88,11],[99,11]]},
  3: {"w":32,"h":32,"n":8,"ms":400,"from":0,"to":8,"steps":8},
  4: {"w":32,"h":32,"n":9,"ms":610,"keys":[[0,0],[11,1],[23,2],[36,3],[49,4],[61,5],[70,6],[80,7],[90,8],[99,8]]},
  5: {"w":32,"h":32,"n":13,"ms":700,"keys":[[0,0],[7,1],[14,2],[21,3],[29,4],[36,5],[50,6],[57,7],[64,8],[71,9],[79,10],[86,11],[93,12],[99,12]]},
  7: {"w":64,"h":64,"n":14,"ms":820,"keys":[[0,0],[5,1],[12,2],[20,3],[27,4],[34,5],[41,6],[49,7],[56,8],[63,9],[71,10],[78,11],[85,12],[93,13],[99,13]]},
  8: {"w":32,"h":32,"n":8,"ms":640,"from":0,"to":8,"steps":8},
  9: {"w":32,"h":32,"n":8,"ms":600,"from":0,"to":8,"steps":8},
  10: {"w":32,"h":32,"n":8,"ms":800,"from":0,"to":8,"steps":8},
  12: {"w":32,"h":32,"n":17,"ms":680,"from":0,"to":17,"steps":17},
  13: {"w":32,"h":32,"n":22,"ms":880,"from":0,"to":22,"steps":22},
  14: {"w":32,"h":32,"n":22,"ms":880,"from":0,"to":22,"steps":22},
  15: {"w":32,"h":32,"n":22,"ms":880,"from":0,"to":22,"steps":22},
  16: {"w":64,"h":64,"n":9,"ms":900,"from":0,"to":9,"steps":9},
  17: {"w":32,"h":32,"n":6,"ms":600,"from":0,"to":6,"steps":6},
  18: {"w":32,"h":32,"n":11,"ms":890,"keys":[[0,0],[7,1],[13,2],[21,3],[29,4],[39,5],[51,6],[63,7],[74,8],[85,9],[93,10],[99,10]]},
  19: {"w":32,"h":32,"n":11,"ms":1100,"from":0,"to":11,"steps":11},
  20: {"w":32,"h":32,"n":11,"ms":1100,"from":0,"to":11,"steps":11},
  21: {"w":32,"h":32,"n":12,"ms":600,"from":0,"to":12,"steps":12},
  22: {"w":32,"h":32,"n":11,"ms":1100,"from":0,"to":11,"steps":11},
  24: {"w":32,"h":32,"n":11,"ms":1100,"from":0,"to":11,"steps":11},
  25: {"w":32,"h":32,"n":11,"ms":1100,"from":0,"to":11,"steps":11},
  27: {"w":32,"h":32,"n":12,"ms":1200,"from":0,"to":12,"steps":12},
  32: {"w":32,"h":32,"n":14,"ms":560,"from":0,"to":14,"steps":14},
  35: {"w":32,"h":32,"n":11,"ms":660,"from":0,"to":11,"steps":11},
  36: {"w":32,"h":32,"n":16,"ms":1600,"from":0,"to":16,"steps":16},
  39: {"w":64,"h":32,"n":6,"ms":600,"from":0,"to":6,"steps":6},
  40: {"w":32,"h":64,"n":7,"ms":700,"from":0,"to":7,"steps":7},
  41: {"w":64,"h":64,"sw":128,"n":34,"ms":1700,"from":0,"to":34,"steps":17},
  42: {"w":64,"h":64,"n":17,"ms":680,"from":0,"to":17,"steps":17},
  44: {"w":64,"h":64,"n":12,"ms":1000,"keys":[[0,0],[5,1],[10,2],[15,3],[20,4],[30,5],[40,6],[50,7],[60,8],[70,9],[80,10],[90,11],[99,11]]},
  45: {"w":64,"h":64,"sw":128,"n":38,"ms":1000,"keys":[[0,0],[10,2],[15,4],[20,6],[25,8],[30,10],[35,12],[40,14],[45,16],[50,18],[55,20],[60,22],[65,24],[70,26],[75,28],[80,30],[85,32],[90,34],[95,36],[99,36]]},
  47: {"w":32,"h":64,"n":8,"ms":800,"from":0,"to":8,"steps":8},
  48: {"w":32,"h":32,"n":17,"ms":680,"from":0,"to":17,"steps":17},
  50: {"w":64,"h":64,"n":25,"ms":1000,"from":0,"to":25,"steps":25},
  53: {"w":64,"h":64,"sw":128,"n":44,"ms":1200,"keys":[[0,0],[4,2],[8,4],[13,6],[17,8],[21,10],[25,12],[29,14],[33,16],[38,18],[42,20],[46,22],[58,24],[63,26],[67,28],[71,30],[75,32],[79,34],[83,36],[87,38],[92,40],[96,42],[99,42]]},
  54: {"w":64,"h":64,"n":9,"ms":900,"from":0,"to":9,"steps":9},
  55: {"w":64,"h":64,"n":14,"ms":1400,"from":0,"to":14,"steps":14},
  56: {"w":64,"h":64,"n":8,"ms":820,"keys":[[0,0],[10,1],[22,2],[34,3],[48,4],[62,5],[76,6],[88,7],[99,7]]},
  57: {"w":32,"h":32,"n":14,"ms":1400,"from":0,"to":14,"steps":14},
  63: {"w":64,"h":32,"n":12,"ms":1500,"keys":[[0,0],[27,1],[33,2],[40,3],[47,4],[53,5],[60,6],[67,7],[73,8],[80,9],[87,10],[93,11],[99,11]]},
  66: {"w":32,"h":32,"n":24,"ms":2500,"keys":[[0,0],[4,1],[8,2],[12,3],[16,4],[20,5],[24,6],[28,7],[32,8],[38,9],[42,10],[46,11],[50,12],[54,13],[58,14],[62,15],[66,16],[70,17],[76,18],[80,19],[84,20],[88,21],[92,22],[96,23],[99,23]]},
  67: {"w":64,"h":64,"n":21,"ms":2100,"from":0,"to":21,"steps":21},
  69: {"w":64,"h":64,"n":16,"ms":1490,"keys":[[0,0],[7,1],[13,2],[20,3],[27,4],[34,5],[40,6],[48,7],[56,8],[62,9],[69,10],[75,11],[81,12],[87,13],[92,14],[96,15],[99,15]]},
  158: {"w":64,"h":64,"n":7,"ms":700,"from":0,"to":7,"steps":7},
  168: {"w":32,"h":32,"n":7,"ms":700,"from":0,"to":7,"steps":7},
  170: {"w":32,"h":32,"n":7,"ms":700,"from":0,"to":7,"steps":7},
  171: {"w":64,"h":64,"n":12,"ms":2200,"keys":[[0,0],[50,1],[55,2],[59,3],[64,4],[68,5],[73,6],[77,7],[82,8],[86,9],[91,10],[95,11],[99,11]]},
  181: {"w":32,"h":32,"n":6,"ms":480,"from":0,"to":6,"steps":6},
  182: {"w":32,"h":32,"n":22,"ms":1540,"from":0,"to":22,"steps":22},
  193: {"w":64,"h":64,"n":11,"ms":1100,"from":0,"to":11,"steps":11},
  196: {"w":32,"h":32,"n":10,"ms":1040,"keys":[[0,0],[7,1],[13,2],[20,3],[27,4],[37,5],[49,6],[62,7],[74,8],[87,9],[99,9]]},
  202: {"w":32,"h":32,"n":6,"ms":600,"from":0,"to":6,"steps":6},
  206: {"w":64,"h":64,"n":15,"ms":1500,"from":0,"to":15,"steps":15},
  210: {"w":64,"h":32,"n":12,"ms":900,"keys":[[0,0],[6,1],[11,2],[17,3],[22,4],[44,5],[67,6],[72,7],[78,8],[83,9],[89,10],[94,11],[99,11]]},
  213: {"w":32,"h":64,"n":9,"ms":900,"from":0,"to":9,"steps":9},
  214: {"w":32,"h":64,"n":7,"ms":700,"from":0,"to":7,"steps":7},
  215: {"w":64,"h":64,"n":7,"ms":560,"keys":[[0,0],[10,1],[20,2],[30,3],[40,4],[50,5],[60,6],[99,6]]},
  216: {"w":64,"h":64,"n":6,"ms":500,"keys":[[0,0],[20,1],[40,2],[60,3],[80,4],[90,5],[99,5]]},
  217: {"w":64,"h":64,"n":10,"ms":270,"keys":[[0,0],[4,1],[7,2],[11,3],[15,4],[19,5],[22,6],[26,7],[63,8],[81,9],[99,9]]},
  220: {"w":32,"h":32,"n":8,"ms":950,"keys":[[0,0],[11,1],[21,2],[32,3],[42,4],[53,5],[63,6],[89,7],[99,7]]},
  221: {"w":64,"h":64,"n":16,"ms":950,"keys":[[0,0],[11,1],[21,2],[32,3],[42,4],[53,5],[63,6],[89,7],[99,15]]},
  222: {"w":32,"h":32,"n":11,"ms":770,"from":0,"to":11,"steps":11},
  223: {"w":32,"h":32,"n":11,"ms":770,"from":0,"to":11,"steps":11},
  225: {"w":32,"h":32,"n":11,"ms":770,"from":0,"to":11,"steps":11},
  226: {"w":32,"h":32,"n":11,"ms":770,"from":0,"to":11,"steps":11},
  230: {"w":64,"h":64,"n":4,"ms":1350,"keys":[[0,0],[4,1],[7,2],[11,3],[99,3]]},
  231: {"w":64,"h":64,"n":4,"ms":560,"keys":[[0,0],[4,1],[7,2],[11,3],[99,3]]},
  232: {"w":64,"h":64,"n":14,"ms":1640,"keys":[[0,0],[5,1],[10,2],[15,3],[20,4],[24,5],[29,6],[34,7],[39,8],[44,9],[49,10],[54,11],[59,12],[63,13],[99,13]]},
  241: {"w":64,"h":64,"n":9,"ms":900,"from":0,"to":9,"steps":9},
  242: {"w":32,"h":64,"n":12,"ms":600,"from":6,"to":12,"steps":6},
  243: {"w":64,"h":64,"n":6,"ms":600,"from":0,"to":6,"steps":6},
  244: {"w":64,"h":64,"n":11,"ms":900,"keys":[[0,0],[6,1],[11,2],[17,3],[22,4],[33,5],[44,6],[56,7],[67,8],[78,9],[89,10],[99,10]]},
  245: {"w":32,"h":32,"n":7,"ms":700,"from":0,"to":7,"steps":7},
  246: {"w":64,"h":64,"n":12,"ms":1200,"from":0,"to":12,"steps":12},
  249: {"w":32,"h":32,"n":7,"ms":700,"from":0,"to":7,"steps":7},
  260: {"w":64,"h":64,"n":10,"ms":500,"from":0,"to":10,"steps":10},
  262: {"w":32,"h":32,"n":12,"ms":1200,"from":0,"to":12,"steps":12},
  263: {"w":32,"h":32,"n":9,"ms":900,"from":0,"to":9,"steps":9},
  265: {"w":32,"h":32,"n":14,"ms":1400,"from":0,"to":14,"steps":14},
  268: {"w":64,"h":64,"n":4,"ms":400,"from":0,"to":4,"steps":4},
  276: {"w":64,"h":64,"n":8,"ms":800,"from":0,"to":8,"steps":8},
  282: {"w":32,"h":32,"n":8,"ms":720,"keys":[[0,0],[10,1],[19,2],[29,3],[39,4],[49,5],[58,6],[86,7],[99,7]]},
  287: {"w":32,"h":32,"n":11,"ms":700,"keys":[[0,0],[9,1],[17,2],[26,3],[34,4],[43,5],[57,6],[66,7],[74,8],[83,9],[91,10],[99,10]]},
  294: {"w":64,"h":64,"n":7,"ms":1200,"keys":[[0,0],[17,1],[25,2],[67,3],[75,4],[83,5],[92,6],[99,6]]},
  295: {"w":64,"h":64,"n":14,"ms":1400,"from":0,"to":14,"steps":14},
  297: {"w":64,"h":64,"n":19,"ms":2400,"keys":[[0,0],[4,1],[8,2],[13,3],[17,4],[21,5],[25,6],[29,7],[33,8],[38,9],[42,10],[46,11],[50,12],[71,13],[75,14],[83,15],[88,16],[92,17],[96,18],[99,18]]}
};
// END EFFECT_SHEET_DATA

// BEGIN ABILITY_SCENE_DATA
const ABILITY_SCENE_DATA = {
  1: {"n":"Rat","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"magicSparkle","id":32,"f":14,"w":"self"},{"n":"magicPoof","id":241,"f":9,"w":"self"},{"n":"scratch","id":215,"f":7}]}},
  2: {"n":"Minotaur","sc":{"m":[{"a":"self","rows":["OXXXO","XXXXX","XX+XX","XXXXX","OXXXO"]}],"mi":[],"fx":[{"n":"groundshaker","id":35,"f":11},{"n":"cooldownRefresh","id":232,"f":14,"w":"self"}]}},
  3: {"n":"Minotaur Mage","sc":{"m":[{"a":"target","rows":["XXXXX","XXXXX","XX+XX","XXXXX","XXXXX"]}],"mi":[{"n":"energy","id":36}],"fx":[{"n":"storm","id":41,"f":17},{"n":"fallingCommet","id":243,"f":6}]}},
  5: {"n":"Sheep","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"holyMissile","id":31}],"fx":[{"n":"heart","id":36,"f":16,"w":"self"},{"n":"fallingCommet","id":243,"f":6},{"n":"holySparks","id":181,"f":6}]}},
  6: {"n":"Wasp","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"earthPoof","id":21,"f":12},{"n":"earth","id":9,"f":8}]}},
  7: {"n":"Skeleton","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"blackBlood","id":202,"f":6},{"n":"phantom","id":66,"f":24,"w":"self"}]}},
  9: {"n":"Bear","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"poof","id":3,"f":8}],"t":["sleep"]}},
  10: {"n":"Rotworm","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"rot","id":39}],"fx":[]}},
  11: {"n":"Spider","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"earthBite","id":47,"f":16}]}},
  12: {"n":"Goblin","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"raiseStat","id":260,"f":10},{"n":"raiseStat","id":260,"f":10,"w":"self"}]}},
  13: {"n":"Wolf","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"drown","id":2,"f":12,"w":"self"},{"n":"raiseStat","id":260,"f":10},{"n":"bite","id":214,"f":14}]}},
  14: {"n":"Troll","sc":{"m":[{"a":"self","rows":["XXXXX","XXXXX","XX+XX","XXXXX","XXXXX"]}],"mi":[],"fx":[{"n":"teleportBlue","id":226,"f":11},{"n":"heal","id":13,"f":22,"w":"self"}]}},
  15: {"n":"Poison Spider","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"voidSpark","id":221,"f":16},{"n":"paralize","id":14,"f":22,"w":"self"}]}},
  16: {"n":"Snake","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"energy","id":12,"f":17},{"n":"smoke","id":242,"f":24},{"n":"blackBlood","id":202,"f":6}]}},
  17: {"n":"Bug","sc":{"m":[{"a":"target","rows":["XXX","X+X","XXX"]},{"a":"target","rows":["OXXXO","XOOOX","XO+OX","XOOOX","OXXXO"]}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"fire","id":16,"f":9}]}},
  20: {"n":"Fire Devil","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"largeFireExplosion","id":7,"f":14,"b":1},{"n":"fire","id":16,"f":9}]}},
  21: {"n":"Demon Skeleton","sc":{"m":[{"a":"self","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"teleportRed","id":223,"f":11,"w":"self"}]}},
  22: {"n":"Ghost","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"holyArrow","id":38}],"fx":[{"n":"poof","id":3,"f":8,"w":"self"},{"n":"spiritLeaving","id":206,"f":15,"w":"self"},{"n":"holyAttack","id":50,"f":25},{"n":"holyAttack","id":50,"f":25,"w":"self"}]}},
  23: {"n":"Scorpion","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"earth","id":9,"f":8},{"n":"earthPoof","id":21,"f":12}]}},
  24: {"n":"Monk","sc":{"m":[{"a":"self","rows":["XXXXX","XXXXX","XX+XX","XXXXX","XXXXX"]}],"mi":[{"n":"holyArrow","id":38}],"fx":[{"n":"holyExory","id":40,"f":14}]}},
  25: {"n":"Banshee","sc":{"m":[{"a":"self","rows":["XXX","X+X","XXX"]},{"a":"self","rows":["OXXXO","XOOOX","XO+OX","XOOOX","OXXXO"]}],"mi":[],"fx":[{"n":"musicNotesGreen","id":19,"f":11,"w":"self"}]}},
  26: {"n":"Dragon Lord","sc":{"m":[{"a":"target","rows":["OXXXO","XXXXX","XX+XX","XXXXX","OXXXO"]}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"fire","id":16,"f":9}]}},
  27: {"n":"Stalker","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"poof","id":3,"f":8,"w":"self"},{"n":"chip","id":4,"f":9}]}},
  28: {"n":"Mummy","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"blackBlood","id":202,"f":6,"w":"self"},{"n":"suddenDeath","id":18,"f":11},{"n":"bloodyHands","id":63,"f":6}]}},
  29: {"n":"Druid","sc":{"m":[{"a":"self","rows":["OOXXXOO","OXXXXXO","XXXXXXX","XXX+XXX","XXXXXXX","OXXXXXO","OOXXXOO"]}],"mi":[],"fx":[{"n":"slowYellowHeal","id":182,"f":22},{"n":"heal","id":13,"f":22}]}},
  30: {"n":"Fire Elemental","sc":{"m":[{"a":"target","rows":["OXO","X+X","OXO"]}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"largeFireExplosion","id":7,"f":14,"b":1},{"n":"fire","id":16,"f":9}]}},
  31: {"n":"Frost Troll","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"snowball","id":13}],"fx":[]}},
  32: {"n":"Winter Wolf","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"drown","id":2,"f":12,"w":"self"},{"n":"iceCrystal","id":53,"f":22}]}},
  33: {"n":"Water Elemental","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"splash","id":54,"f":9}]}},
  34: {"n":"Minotaur Archer","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"bolt","id":2},{"n":"infernalBolt","id":16}],"fx":[]}},
  35: {"n":"Minotaur Guard","sc":{"m":[{"a":"self","rows":["XXX","X+X","XXX"]}],"mi":[],"fx":[{"n":"taunt","id":249,"f":7}]}},
  36: {"n":"Wyvern","sc":{"m":[{"a":"self","rows":["OOOXOOO","OOXXXOO","OXXXXXO","XXX+XXX","OXXXXXO","OOXXXOO","OOOXOOO"]}],"mi":[],"fx":[{"n":"magicSparkle","id":32,"f":14},{"n":"musicNotesGreen","id":19,"f":11,"w":"self"},{"n":"musicNotesBlue","id":24,"f":11},{"n":"musicNotesRed","id":20,"f":11}]}},
  38: {"n":"Polar Bear","sc":{"m":[{"a":"self","rows":["XXXXX","XXXXX","XX+XX","XXXXX","XXXXX"]}],"mi":[],"fx":[{"n":"ice","id":44,"f":12}]}},
  39: {"n":"Elf","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"arrow","id":3}],"fx":[{"n":"raiseStat","id":260,"f":10},{"n":"poof","id":3,"f":8},{"n":"tauntYellow","id":220,"f":8,"w":"self"}],"t":["walls"]}},
  40: {"n":"Elf Scout","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"iceArrow","id":35}],"fx":[{"n":"icicleFall","id":42,"f":17}]}},
  41: {"n":"Elf Arcanist","sc":{"m":[{"a":"target","rows":["OXO","X+X","OXO"]}],"mi":[{"n":"sd","id":32},{"n":"smallSd","id":11}],"fx":[{"n":"blackSmoke","id":158,"f":7},{"n":"bats","id":67,"f":21},{"n":"curse","id":39,"f":3}]}},
  43: {"n":"Orc Leader","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"throwingKnife","id":9}],"fx":[]}},
  44: {"n":"Orc Shaman","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"holyMissile","id":31},{"n":"energyBeam","id":5}],"fx":[]}},
  45: {"n":"Orc Rider","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"musicNotesWhite","id":25,"f":11,"w":"self"},{"n":"fangBite","id":217,"f":10}]}},
  46: {"n":"Orc Warlord","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"raiseStat","id":260,"f":10}]}},
  47: {"n":"Goblin Scavenger","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"raiseStat","id":260,"f":10},{"n":"poof","id":3,"f":8,"w":"self"},{"n":"dodge","id":231,"f":4,"w":"self"}]}},
  48: {"n":"Goblin Assassin","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"magicPoof","id":241,"f":9,"w":"self"},{"n":"chip","id":4,"f":9},{"n":"dodge","id":231,"f":4},{"n":"raiseStat","id":260,"f":10}]}},
  49: {"n":"Firestarter","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"fireArrow","id":34}],"fx":[{"n":"yellowSmoke","id":168,"f":7},{"n":"fire","id":16,"f":9},{"n":"raiseStat","id":260,"f":10,"w":"self"},{"n":"tauntYellow","id":220,"f":8}]}},
  50: {"n":"Cyclops","sc":{"m":[{"a":"self","rows":["XXX","X+X","XXX"]},{"a":"self","rows":["OXXXO","XOOOX","XO+OX","XOOOX","OXXXO"]}],"mi":[],"fx":[{"n":"groundshaker","id":35,"f":11},{"n":"poof","id":3,"f":8},{"n":"phoenixFire","id":295,"f":14}]}},
  51: {"n":"Warlock","sc":{"m":[{"a":"self","rows":["XXXXX","XXXXX","XX+XX","XXXXX","XXXXX"]},{"a":"target","rows":["XXX","X+X","XXX"]}],"mi":[{"n":"energy","id":36},{"n":"fire","id":4},{"n":"energyBeam","id":5}],"fx":[{"n":"energy","id":12,"f":17},{"n":"largeFireExplosion","id":7,"f":14,"b":1},{"n":"greyTeleport","id":225,"f":11},{"n":"fallingStones","id":45,"f":19},{"n":"poof","id":3,"f":8,"w":"self"}]}},
  52: {"n":"Knight","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"groundshaker","id":35,"f":11},{"n":"exori","id":10,"f":8}]}},
  53: {"n":"Dwarf","sc":{"m":[{"a":"self","rows":["+"],"g":1}],"mi":[],"fx":[],"t":["barrel"]}},
  54: {"n":"Dwarf Soldier","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"piercingBolt","id":24}],"fx":[{"n":"groundshaker","id":35,"f":11}]}},
  55: {"n":"Dwarf Guard","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"exoriHurAxe","id":26}],"fx":[{"n":"magicSparkle","id":32,"f":14}]}},
  56: {"n":"Dwarf Geomancer","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"poof","id":3,"f":8}],"t":["perimeter"]}},
  57: {"n":"Energy Crystal","sc":{"m":[{"a":"self","rows":["XXX","X+X","XXX"]},{"a":"self","rows":["XXXXX","XOOOX","XO+OX","XOOOX","XXXXX"]}],"mi":[],"fx":[{"n":"poof","id":3,"f":8},{"n":"heal","id":13,"f":22,"w":"self"},{"n":"teleportBlue","id":226,"f":11}]}},
  58: {"n":"Magma Crystal","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"avatarPoof","id":244,"f":11,"w":"self"},{"n":"largeFireExplosion","id":7,"f":14,"b":1}]}},
  59: {"n":"Earth Crystal","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"greenFireworks","id":196,"f":10}]}},
  60: {"n":"Rorc","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"raiseStat","id":260,"f":10,"w":"self"},{"n":"groundshaker","id":35,"f":11}]}},
  61: {"n":"Nightstalker","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"poof","id":3,"f":8},{"n":"moe","id":5,"f":13},{"n":"poof","id":3,"f":8,"w":"self"},{"n":"cooldownRefresh","id":232,"f":14,"w":"self"},{"n":"paralize","id":14,"f":22,"w":"self"}]}},
  62: {"n":"Bog Raider","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"poisonSting","id":15}],"fx":[{"n":"nasty","id":17,"f":6,"w":"self"}]}},
  63: {"n":"Orc","sc":{"m":[{"a":"self","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"raiseStat","id":260,"f":10,"w":"self"}]}},
  66: {"n":"Witch","sc":{"m":[{"a":"target","rows":["OXXXO","XXXXX","XX+XX","XXXXX","OXXXO"]}],"mi":[{"n":"energyBeam","id":5}],"fx":[{"n":"magicPoof","id":241,"f":9},{"n":"teleportBlue","id":226,"f":11}]}},
  68: {"n":"Amazon","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"throwingKnife","id":9}],"fx":[{"n":"megaBleed","id":268,"f":4}]}},
  69: {"n":"Valkyrie","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"spear","id":1}],"fx":[]}},
  70: {"n":"Lavahole","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"blackSmoke","id":158,"f":7,"w":"self"},{"n":"smoke","id":242,"f":24,"w":"self"},{"n":"fire","id":16,"f":9}]}},
  71: {"n":"Corym Charlatan","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"smoothSlap","id":213,"f":18}]}},
  72: {"n":"Corym Skirmisher","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"rot","id":39}],"fx":[{"n":"magicPoof","id":241,"f":9},{"n":"poof","id":3,"f":8},{"n":"scratchWhite","id":282,"f":8}]}},
  73: {"n":"Corym Vanguard","sc":{"m":[{"a":"self","rows":["+"],"g":1}],"mi":[],"fx":[]}},
  74: {"n":"Black Knight","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"royalSpear","id":21}],"fx":[{"n":"gaffirSmoke","id":262,"f":12}]}},
  76: {"n":"Giant Spider","sc":{"m":[{"a":"self","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"whiteGibs","id":276,"f":8,"w":"self"},{"n":"whiteConfetti","id":263,"f":9,"w":"self"},{"n":"teleportPurple","id":222,"f":11,"w":"self"}]}},
  77: {"n":"Swamp Troll","sc":{"m":[{"a":"self","rows":["XXXXX","XXXXX","XX+XX","XXXXX","XXXXX"]}],"mi":[],"fx":[{"n":"earthPoof","id":21,"f":12},{"n":"heal","id":13,"f":22,"w":"self"}]}},
  79: {"n":"Dharalion","sc":{"m":[{"a":"target","rows":["XXX","X+X","XXX"]}],"mi":[{"n":"sd","id":32},{"n":"smallSd","id":11}],"fx":[{"n":"blackSmoke","id":158,"f":7},{"n":"bats","id":67,"f":21},{"n":"curse","id":39,"f":3}]}},
  81: {"n":"Regeneration Tank","sc":{"m":[{"a":"self","rows":["XXX","X+X","XXX"]},{"a":"self","rows":["XXXXX","XOOOX","XO+OX","XOOOX","XXXXX"]}],"mi":[],"fx":[{"n":"poof","id":3,"f":8},{"n":"heal","id":13,"f":22,"w":"self"},{"n":"teleportBlue","id":226,"f":11}]}},
  82: {"n":"Gummy Raider","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"poisonSting","id":15}],"fx":[{"n":"nasty","id":17,"f":6,"w":"self"}]}},
  83: {"n":"Monster Cauldron","sc":{"m":[{"a":"target","rows":["XXX","X+X","XXX"]}],"mi":[{"n":"pinkBall","id":62},{"n":"sd","id":32},{"n":"energyBeam","id":5}],"fx":[{"n":"avatarPoof","id":244,"f":11},{"n":"avatarPoof","id":244,"f":11,"w":"self"},{"n":"purpleSmoke","id":170,"f":7},{"n":"bigWhiteGlow","id":171,"f":12},{"n":"teleportPurple","id":222,"f":11},{"n":"purpleEnergy","id":48,"f":17}]}},
  85: {"n":"Goblin Gumslinger","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"raiseStat","id":260,"f":10},{"n":"raiseStat","id":260,"f":10,"w":"self"}]}},
  86: {"n":"Goblin Saboteur","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"magicPoof","id":241,"f":9,"w":"self"},{"n":"chip","id":4,"f":9},{"n":"dodge","id":231,"f":4},{"n":"raiseStat","id":260,"f":10}]}},
  87: {"n":"Unionized Goblin","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"raiseStat","id":260,"f":10},{"n":"poof","id":3,"f":8,"w":"self"},{"n":"dodge","id":231,"f":4,"w":"self"}]}},
  89: {"n":"Dwarf Merrymancer","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"poof","id":3,"f":8}],"t":["perimeter"]}},
  90: {"n":"The Percht Queen","sc":{"m":[{"a":"self","rows":["XXXXXXX","XXX+XXX","XXXXXXX","XXXXXXX"]}],"mi":[],"fx":[{"n":"teleportBlue","id":226,"f":11},{"n":"poof","id":3,"f":8}]}},
  91: {"n":"Grynch Clan Mastermind","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"smallSd","id":11}],"fx":[{"n":"raiseStat","id":260,"f":10}]}},
  92: {"n":"Beer Barrel","sc":{"m":[{"a":"self","rows":["OOXXXOOOOO","OXXXXXOOOO","XXXXXXXOOO","XXXXXXXOOO","XXXXXXXXOO","XXXXXXXXXO","XXX+XXXXXX","XXXXXXXXXO","XXXXXXXXOO","XXXXXXXOOO","XXXXXXXOOO","OXXXXXOOOO","OOXXXOOOOO"]}],"mi":[],"fx":[{"n":"largeFireExplosion","id":7,"f":14,"b":1}]}},
  98: {"n":"Green Djinn","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"energy","id":36}],"fx":[{"n":"magicSparkle","id":32,"f":14},{"n":"magicPoof","id":241,"f":9},{"n":"energy","id":12,"f":17}]}},
  99: {"n":"Ancient Scarab","sc":{"m":[{"a":"self","rows":["XXXXXXX","XXXXXXX","XXXXXXX","XXX+XXX","XXXXXXX","XXXXXXX","XXXXXXX"]}],"mi":[],"fx":[{"n":"slash","id":216,"f":6},{"n":"poof","id":3,"f":8},{"n":"musicNotesGreen","id":19,"f":11,"w":"self"}],"t":["push"]}},
  100: {"n":"Obelisk","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"fire","id":16,"f":9},{"n":"largeFireExplosion","id":7,"f":14,"b":1}]}},
  101: {"n":"Thalas","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"poof","id":3,"f":8}]}},
  102: {"n":"Cobra Statue","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"poisonSting","id":15}],"fx":[{"n":"cooldownRefresh","id":232,"f":14}]}},
  103: {"n":"Nomad","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"ice","id":37}],"fx":[{"n":"diceRoll","id":27,"f":12}]}},
  104: {"n":"Blue Djinn","sc":{"m":[{"a":"self","rows":["OXXXO","XXXXX","XX+XX","XXXXX","OXXXO"]}],"mi":[],"fx":[{"n":"moeExoriBlue","id":287,"f":11,"w":"self"}]}},
  105: {"n":"Bonelord","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"bookMagicFast","id":297,"f":19,"w":"self"},{"n":"cooldownRefresh","id":232,"f":14}]}},
  106: {"n":"Omruc","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"arrow","id":3},{"n":"poisonArrow","id":6}],"fx":[{"n":"magicPoof","id":241,"f":9},{"n":"magicPoof","id":241,"f":9,"w":"self"}]}},
  107: {"n":"Morguthis","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"teleportRed","id":223,"f":11}]}},
  108: {"n":"Rahemos","sc":{"m":[{"a":"target","rows":["XXX","X+X","XXX"]}],"mi":[],"fx":[{"n":"musicNotesYellow","id":22,"f":11},{"n":"greenFireworks","id":196,"f":10},{"n":"poof","id":3,"f":8}]}},
  109: {"n":"Football Elemental","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"splash","id":54,"f":9}]}},
  110: {"n":"Werefox","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"royalStar","id":59}],"fx":[{"n":"haste","id":15,"f":22},{"n":"haste","id":15,"f":22,"w":"self"},{"n":"magicPoof","id":241,"f":9}]}},
  111: {"n":"Hunter","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"arrow","id":3}],"fx":[{"n":"musicNotesYellow","id":22,"f":11,"w":"self"},{"n":"poof","id":3,"f":8},{"n":"raiseStat","id":260,"f":10,"w":"self"}]}},
  112: {"n":"Cyclops Drone","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"groundshaker","id":35,"f":11,"w":"self"},{"n":"poof","id":3,"f":8}]}},
  113: {"n":"Behemoth","sc":{"m":[{"a":"self","rows":["XXXXX","XOOOX","XO+OX","XOOOX","XXXXX"]}],"mi":[{"n":"boulder","id":12}],"fx":[{"n":"smoke","id":242,"f":24}],"t":["arena"]}},
  114: {"n":"Cyclops Smith","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"exoriHurClub","id":27}],"fx":[]}},
  116: {"n":"Hero","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"arrow","id":3}],"fx":[{"n":"raiseStat","id":260,"f":10,"w":"self"}]}},
  118: {"n":"Setzer Gambler","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"sd","id":32}],"fx":[{"n":"suddenDeath","id":18,"f":11}]}},
  119: {"n":"Ti","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"burstArrow","id":7}],"fx":[{"n":"smoothSlap","id":213,"f":18},{"n":"moe","id":5,"f":13}]}},
  120: {"n":"Mateusz Dragon Wielki","sc":{"m":[{"a":"self","rows":["OOXXXOO","OXXXXXO","XXXXXXX","XXX+XXX","XXXXXXX","OXXXXXO","OOXXXOO"]}],"mi":[],"fx":[{"n":"heal","id":13,"f":22}]}},
  121: {"n":"The Pale Count","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"musicNotesRed","id":20,"f":11,"w":"self"},{"n":"poof","id":3,"f":8}]}},
  122: {"n":"Vampire Bride","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"bite","id":214,"f":14},{"n":"circlingHearts","id":265,"f":14,"w":"self"}]}},
  123: {"n":"Paladin","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"assassinStar","id":19}],"fx":[]}},
  126: {"n":"Vladrukh","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[],"fx":[{"n":"bats","id":67,"f":21,"w":"self"},{"n":"pinchingHand","id":210,"f":6},{"n":"bats","id":67,"f":21}]}},
  128: {"n":"Orshabaal","sc":{"m":[{"a":"target","rows":["OOOOOXOOOOO","OOOXXXXXOOO","OOXXXXXXXOO","OXXXXXXXXXO","OXXXXXXXXXO","XXXXX+XXXXX","OXXXXXXXXXO","OXXXXXXXXXO","OOXXXXXXXOO","OOOXXXXXOOO","OOOOOXOOOOO"]}],"mi":[{"n":"fire","id":4}],"fx":[{"n":"largeFireExplosion","id":7,"f":14,"b":1},{"n":"fire","id":16,"f":9}]}},
  130: {"n":"Shooter","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"bolt","id":2},{"n":"sd","id":32}],"fx":[]}},
  131: {"n":"Healer","sc":{"m":[{"a":"target","rows":["+"],"g":1}],"mi":[{"n":"energyBeam","id":5}],"fx":[]}},
  132: {"n":"Demon","sc":{"m":[{"a":"target","rows":["OOXXXOO","OXXXXXO","XXXXXXX","XXX+XXX","XXXXXXX","OXXXXXO","OOXXXOO"]}],"mi":[],"fx":[]}}
};
// END ABILITY_SCENE_DATA

/** Every missile flies for the same 225ms in the game (its `xr` constant); the Cyclopedia scenes time their hits from it (Cyclopedia.js reads it as its flight time). */
const SCENE_MISSILE_MS = 225;
// Shared pieces of the hand-written scenes (one place for an id or a frame count): the villain Ti and its `burstArrow` shot, and
// effects several creatures use (`haste`: the game's effect for any heal; `moe`: Ti's burst).
const SCENE_VILLAIN_TI = { id: 119, shot: { n: 'burstArrow', id: 7 } };
// The firefly item's own frame schedule (item 6490: 20 frames over 5.35s, [percent, frame]): from the game's stylesheet.
const SCENE_FIREFLY_KEYS = [[0, 0], [47, 1], [50, 2], [52, 3], [55, 4], [58, 5], [61, 6], [64, 7], [66, 8], [69, 9], [72, 10], [75, 11], [78, 12], [80, 13], [83, 14], [86, 15], [89, 16], [92, 17], [94, 18], [97, 19]];
// Floating damage / heal numbers in a scene's `numbers` (the Cyclopedia draws them in the game's style with the word 'dmg' / 'heal'):
// sceneDmg(at, on, how, crit): `how` is a damage type ('physical' | 'magic' | 'true') or a palette colour ('fire', 'earth', ...);
// sceneHeal(at, on, crit). `at`: ms, 'land' (+ '+375') = when the hit lands, 'hit' = when a charge arrives. `on`: 'target' | 'self' | [dCol, dRow].
// `how` is a damage type ('physical' | 'magic' | 'true') or a palette colour: a coloured number is magic damage (fire, earth, holy...) except the
// colours the game uses for silent true damage (the Ghoul's drain, the Demon Skeleton's curse); `dtype` is what the stat icon shows.
const SCENE_TRUE_DAMAGE_COLORS = ['stamina-medium', 'awaken'];
const sceneDmg = (at, on = 'target', how = 'physical', crit = false, dtype = null) => ({ at, kind: 'damage', on,
  dtype: dtype || (['physical', 'magic', 'true'].includes(how) ? how : SCENE_TRUE_DAMAGE_COLORS.includes(how) ? 'true' : 'magic'),
  ...(['physical', 'magic', 'true'].includes(how) ? { type: how } : { color: how }), ...(crit ? { crit: true } : {}) });
// Stuns: add `stuns: [{ at, ms, on?, shake? }]` to a scene: the game's yellow stun bar over the stunned creature while the stun lasts (and the target shaking unless `shake: false`).
// Stunners (from the Cyclopedia search): Bear (done), Cake Drake, Dwarf Guard, Knight, Minotaur, Old Giant Spider, Rorc, Snake (done), Spider (done), Winter Wolf (done), Wyvern.
// Taunts, as the game draws them (read from Minotaur Guard's class and the target component): `setTauntedBy` always fires the target's `onTaunt`, which pops the
// exclamation-mark icon over it (`sceneTaunt(at, on)`: a `statusIcons` entry); the taunted unit keeps the taunter's chip (`bigsnowball`, `exeta`...) for the taunt's
// length and turns to face the taunter 250ms (4 ticks) later. An area taunt (Minotaur Guard) also publishes the `taunt` effect (249: a red ring, 7 frames, 0.7s)
// on every tile it reaches, one tile per tick in scan order (`sceneTauntRings(at, tiles)`: its `fx` entries; `tiles` offsets from the target tile). Taunters:
// Frost Troll (its Snowman: icon only), Firestarter, Minotaur Guard, Orc Leader, Spider, Werefox, Willi Wasp.
const sceneTaunt = (at, on = 'target') => ({ at, icon: 'taunt', on });
const SCENE_TAUNT_EFFECT_ID = 249;
const sceneTauntRings = (at, tiles) => tiles.map(([dx, dy], i) => ({ n: 'taunt', id: SCENE_TAUNT_EFFECT_ID, f: 7, tiles: [[dx, dy]], at: at + i * 62.5 }));
const sceneHeal = (at, on = 'target', crit = false) => ({ at, kind: 'heal', on, ...(crit ? { crit: true } : {}) });
// The tiles ([dCol, dRow] from the origin) a mask hits, without the origin itself: an area spelled out for an effect's `tiles`.
const sceneArea = (rows) => {
  const cy = rows.findIndex((r) => r.includes('+'));
  const cx = rows[cy].indexOf('+');
  return rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === 'X' ? [[x - cx, y - cy]] : [])));
};
// The 3x3 ring around the origin: the area of every "all creatures next to it" ability.
const SCENE_RING = ['XXX', 'X+X', 'XXX'];
// The game's style filter on a poisoned creature (Wasp, Scorpion).
const SCENE_POISON_FILTER = 'grayscale(1) sepia(1) saturate(5) hue-rotate(65deg)';
const SCENE_FX = {
  haste: { n: 'haste', id: 15, f: 22 }, moe: { n: 'moe', id: 5, f: 13 }, raiseStat: { n: 'raiseStat', id: 260, f: 10 },
  heal: { n: 'heal', id: 13, f: 22 }, poof: { n: 'poof', id: 3, f: 8 }, magicPoof: { n: 'magicPoof', id: 241, f: 9 }, teleportBlue: { n: 'teleportBlue', id: 226, f: 11 },
  // the ones the scenes use over and over
  bleed: { n: 'bleed', id: 1, f: 6 }, fire: { n: 'fire', id: 16, f: 9 }, largeFireExplosion: { n: 'largeFireExplosion', id: 7, f: 14 }, groundshaker: { n: 'groundshaker', id: 35, f: 11 }, energy: { n: 'energy', id: 12, f: 17 }, magicSparkle: { n: 'magicSparkle', id: 32, f: 14 }, musicNotesRed: { n: 'musicNotesRed', id: 20, f: 11 }, charging: { n: 'charging', id: 245, f: 7 }, glowingCircle: { n: 'glowingCircle', id: 193, f: 11 }, holyCircle: { n: 'holyCircle', id: 246, f: 12 }, bats: { n: 'bats', id: 67, f: 21 }
};
// Bar colours the scenes share: the ability cooldown / mana blue and the ability power purple.
const SCENE_BAR = { cool: '#6699ff', ap: '#c084fc' };
// One game tick in ms, and a creature's walking step at a speed stat in ms.
const SCENE_TICK_MS = 62.5;
// The villain Ti's speed stat (the game's Ti: 100): the scenes are built when the file loads, before the game's data is readable, so a speed that depends on it is written here.
const SCENE_TI_SPEED = 100;
const walkStepMs = (speed) => walkStepTicks(speed) * SCENE_TICK_MS;
// The caster alone on its own tile (the base of every self-anchored scene; a fresh object each time).
const sceneSelf = () => ({ m: [{ a: 'self', rows: ['+'] }], mi: [] });
// The target tile alone, for a scene that spells everything out in effects (a fresh object each time).
// The caster alone on a board `half` tiles out from the middle (7 x 7 is half 3), with no blood: the base of most hand-written scenes.
const sceneBoard = (half) => ({ ...sceneSelf(), gridHalf: half, noBlood: 1 });
// The spider's webs (items spiderWebCenter / spiderWeb0-3) on the target's tile and the four beside it, there from `at` for `ms`.
const sceneWebs = (at, ms) => [[12747, 0, 0], [12749, 0, -1], [12751, -1, 0], [12755, 1, 0], [12753, 0, 1]].map(([id, dx, dy]) => ({ kind: 'timed', anchor: 'target', id, dx, dy, at, ms }));
const sceneTarget = () => ({ m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [] });
// A villain Ti standing at [dx, dy] (the scenes' default enemy) facing a direction; `extra` adds mate options (walk, shake, hop...).
const sceneTiMate = (dx, dy, facing, extra) => ({ id: SCENE_VILLAIN_TI.id, dx, dy, facing, ...extra });
// An invisible creature is drawn as a looping `heal` effect (880ms a loop): `count` loops from `at` on `where` ({ w: 'self' } or { tiles: [[dx, dy]] }).
const sceneInvisibleLoops = (at, count, where = { w: 'self' }) => Array.from({ length: count }, (_, i) => ({ ...SCENE_FX.heal, ...where, at: at + i * 880 }));


// Hand-written scenes for creatures whose ability code tools/check-ability-scenes.mjs cannot read (abilities
// implemented in shared components, pulses on neighbouring tiles, buffs...). Same row shape as ABILITY_SCENE_DATA
// ({ n, sc: { m, mi, fx } }); an entry here wins over the extracted row. The tool never rewrites this block; it lists
// creatures with neither as TODO. Mask rows: '+' origin tile, 'X' hit, 'O' not; a: 'target' | 'self'.
// Banshee's screech as one scene part, above 40% HP: red notes on her and the two waves, she keeps fighting. (At 40% HP or less she also heals, plays green notes and flees: `part(label, true)` still
// builds that, but it is not shown.) `awaken` adds the heal-reduction debuff on the enemies hit. She casts the moment the ability is ready, the first time at the start of the battle.
const BANSHEE_INNER = SCENE_RING;
const BANSHEE_OUTER = ['OXXXO', 'XOOOX', 'XO+OX', 'XOOOX', 'OXXXO'];
function sceneBansheeParts(awaken) {
  const part = (label, low) => ({
    l: label,
    // the red area tiles light as each wave HITS (3 and 8 ticks after the cast), not at the start: spelled out as `flashes` (the masks would light them at the loop start, before the cast)
    ...sceneSelf(), gridHalf: 2,
    flashes: [{ at: 687.5, ms: 800, tiles: sceneArea(BANSHEE_INNER) }, { at: 1000, ms: 800, tiles: sceneArea(BANSHEE_OUTER) }],
    mates: [sceneTiMate(1, 0, 'west'), sceneTiMate(2, 0, 'west')],
    // fleeing (the game walks her away in the same tick as the cast, from every living enemy)
    ...(low ? { casterFlee: { at: 500, from: [[1, 0], [2, 0]] } } : {}),
    numbers: [...(low ? [sceneHeal(500, 'self', true)] : []), sceneDmg(690, [1, 0], 'magic', true), sceneDmg(1000, [2, 0], 'magic', true)],
    ...(awaken ? {
      statusIcons: [{ at: 690, icon: 'heal-reduction', on: [1, 0] }, { at: 1000, icon: 'heal-reduction', on: [2, 0] }],
      passives: [{ src: 'heal-reduction', windows: [[690, 3500]] }]
    } : {}),
    fx: [
      low ? { n: 'musicNotesGreen', id: 19, f: 11, w: 'self', at: 500 } : { ...SCENE_FX.musicNotesRed, w: 'self', at: 500 },
      { ...SCENE_FX.musicNotesRed, tiles: sceneArea(BANSHEE_INNER), at: 687 },
      { ...SCENE_FX.musicNotesRed, tiles: sceneArea(BANSHEE_OUTER), at: 1000 },
      { ...SCENE_FX.bleed, to: [1, 0], at: 690 }, { ...SCENE_FX.bleed, to: [2, 0], at: 1000 }
    ]
  });
  return [part(null, false)];
}

// Dragon Lord's fire fields (`fireFieldFull`, item 2118: 64px frames, 5 of them, 0.6s a loop) on the target tile and every tile of the 5x5 mask from `at` ms.
const DRAGON_LORD_MASK = ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO'];
const sceneFireFields = (at) => [[0, 0], ...sceneArea(DRAGON_LORD_MASK)].map(([dx, dy]) => ({ kind: 'loop', id: 2118, f: 5, loopMs: 600, w: 2, h: 2, anchor: 'target', dx, dy, at, ground: true }));
// Druid's awakened spell (Exura Gran Mas Res): the 7x7 diamond around it.
const DRUID_AWAKEN_MASK = ['OOXXXOO', 'OXXXXXO', 'XXXXXXX', 'XXX+XXX', 'XXXXXXX', 'OXXXXXO', 'OOXXXOO'];
// Water Elemental: the orb (`pinkBall`) hits the target, then bounces up to 4 times (5 hits; awakened one more) to a random living creature beside the one it
// hit, enemy or ally: an enemy takes a crit of magic damage (5 + 0.6 AP, `drowning` colour, blood) and -15 magic resist for 4s (the `splash` chip), an ally is healed
// (8 + 0.4 AP, a crit) and gets +15. Each hop has the game's own durations (160, 130, 140, 150, 175ms). The last hop ends in a `splash` (opacity 80%) on the creature hit.
// The chain here: tree -> Ti (west of it) -> the ally Astronis (below that Ti) -> a second Ti (east of the ally) -> the tree again (and, awakened, the first Ti).
function sceneWaterElemental(awaken) {
  const hits = [[0, 0], [-1, 0], [-1, 1], [0, 1], [0, 0], ...(awaken ? [[-1, 0]] : [])];
  const ally = (h) => h[0] === -1 && h[1] === 1;
  // Each hop's own duration: `nf = [160, 130, 140, 150, 175]` by bounce, the missile plays over that (animationDuration), the hit comes that many ticks later (HX: 3, 2, 2, 2, 3 ticks).
  const flight = [160, 130, 140, 150, 175, 175];
  const ticks = [187.5, 125, 125, 125, 187.5, 187.5];
  const T = 500;
  const start = (i) => T + ticks.slice(0, i).reduce((x, y) => x + y, 0); // hop i leaves
  const at = (i) => start(i) + ticks[i]; // hop i lands
  const on = (h) => (h[0] === 0 && h[1] === 0 ? 'target' : { target: h });
  const last = hits.length - 1;
  return {
    numbers: hits.map((h, i) => (ally(h) ? sceneHeal(at(i), on(h), true) : sceneDmg(at(i), on(h), 'drowning', true))),
    ...sceneTarget(), castRange: 3, noBlood: 1,
    mates: [sceneTiMate(-1, 0, 'east', { anchor: 'target' }), { anchor: 'target', dx: -1, dy: 1, facing: 'east' }, sceneTiMate(0, 1, 'north', { anchor: 'target' })],
    flights: hits.map((h, i) => ({ shot: { n: 'pinkBall', id: 62 }, from: i ? hits[i - 1] : [3, 3], to: h, at: start(i), ms: flight[i] })),
    passives: [{ src: 'splash', windows: [[at(0), at(last) + 4000]] }],
    fx: [...hits.map((h, i) => [h, i]).filter(([h]) => !ally(h)).map(([h, i]) => ({ ...SCENE_FX.bleed, tiles: [h], at: at(i) })),
      ...hits.map((h, i) => [h, i]).filter(([h]) => ally(h)).map(([h, i]) => ({ ...SCENE_FX.haste, tiles: [h], at: at(i) })),
      { n: 'splash', id: 54, f: 9, tiles: [hits[last]], at: at(last), opacity: 0.8 }]
  };
}

// Minotaur Archer (current class): Ti shoots the Archer `bolts` times (each hit stocks a bolt: the chip counts up), then the Archer attacks: a crit bolt and one
// `infernalBolt` per stocked bolt, 62.5ms apart, each 4 physical damage in the `fire` colour. Awakened (6 bolts) the attack follows the last hit at once.
function sceneMinotaurArcher(awaken) {
  const bolts = awaken ? 6 : 3;
  const gap = awaken ? 300 : 500; // between Ti's shots
  const land = (i) => 500 + gap * i + SCENE_MISSILE_MS; // Ti's i-th arrow lands
  const attackAt = land(bolts - 1) + (awaken ? 100 : 400);
  const infernal = Array.from({ length: bolts }, (_, k) => attackAt + 62.5 * k);
  return {
    numbers: [...Array.from({ length: bolts }, (_, i) => sceneDmg(land(i), 'self', 'fire')), sceneDmg('land', 'target', 'physical', true),
      ...infernal.map((at) => sceneDmg(at + SCENE_MISSILE_MS, 'target', 'fire', false, 'physical'))],
    castRange: 3, lead: attackAt, m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [{ n: 'bolt', id: 2 }],
    attacker: { ...SCENE_VILLAIN_TI, dx: 3, dy: 0, aim: [3, 3], at: 500 },
    flights: [...Array.from({ length: bolts - 1 }, (_, i) => ({ shot: SCENE_VILLAIN_TI.shot, from: [3, 0], to: [3, 3], at: 500 + gap * (i + 1) })),
      ...infernal.map((at) => ({ shot: { n: 'infernalBolt', id: 16 }, from: [3, 3], to: [0, 0], at }))],
    passives: [{ src: 'sharpshooter', windows: [[0, null]], counts: [{ at: 0, n: 0 }, ...Array.from({ length: bolts }, (_, i) => ({ at: land(i), n: i + 1 })), { at: attackAt + 62.5 * bolts, n: 0 }] }],
    fx: [...Array.from({ length: bolts }, (_, i) => ({ ...SCENE_FX.moe, to: [0, 0], at: land(i) })), ...[attackAt + SCENE_MISSILE_MS, ...infernal.map((at) => at + SCENE_MISSILE_MS)].map((at) => ({ ...SCENE_FX.bleed, tiles: [[0, 0]], at }))]
  };
}

// Minotaur Guard's taunt (the 3x3 around it, as in its class code): the `taunt` ring (249) on each of the 8 tiles one tick apart (row by row), every enemy on them is
// taunted (the exclamation icon, the `exeta` chip for 5s, it turns to face the Guard 250ms later), and the Guard heals 5 + 0.6 AP per enemy hit (a crit) 3 ticks after the last
// tile. An enemy that auto-attacks it takes 6 + 0.3 AP of reflected magic damage 2 ticks later. Awakened, each taunted enemy also gets +40% attack speed and -15 attack
// damage for 2s (the `minotaur-guard-buff` chip). Three villain Ti stand beside it; the west one then shoots it.
const MINOTAUR_GUARD_MASK = SCENE_RING;
function sceneMinotaurGuard(awaken) {
  const tiles = sceneArea(MINOTAUR_GUARD_MASK);
  const T = 500; // the taunt starts
  const tauntAt = (tile) => T + 62.5 * tiles.findIndex(([x, y]) => x === tile[0] && y === tile[1]);
  const enemies = [[-1, 0], [1, 0], [0, 1]];
  return {
    numbers: [sceneHeal(T + 62.5 * (tiles.length + 3), 'self', true), sceneDmg(2210, 'self', 'fire'), sceneDmg(2335, [-1, 0], 'magic')],
    ...sceneSelf(), gridHalf: 2, flashes: [{ at: T, tiles: sceneArea(MINOTAUR_GUARD_MASK) }], // the area lights with the taunt, not at the loop start
    attacker: { ...SCENE_VILLAIN_TI, dx: -1, dy: 0, aim: [0, 0], at: 2210 - SCENE_MISSILE_MS },
    mates: [sceneTiMate(1, 0, 'west'), sceneTiMate(0, 1, 'north')],
    statusIcons: enemies.map((e) => sceneTaunt(tauntAt(e), e)),
    passives: [{ src: 'exeta', windows: [[T, T + 5000]] }, ...(awaken ? [{ src: 'minotaur-guard-buff', windows: [[T + 250, T + 2250]] }] : [])],
    fx: [...sceneTauntRings(T, tiles), { ...SCENE_FX.moe, to: [0, 0], at: 2210 }, { ...SCENE_FX.haste, w: 'self', at: T + 62.5 * (tiles.length + 3) }]
  };
}

// Wyvern's screech (the fleeing case, which shows everything): `musicNotesBlue` (30% opacity) on the 7x7 diamond around it, `musicNotesGreen` and a heal of 10 + 0.2 AP on it,
// and every enemy in the area takes 5 + 0.2 AP of magic damage with `magicSparkle` and is pushed one tile away (it is sped up to 255 for the push). Below 30% HP it flees, the
// step away coming in the same tick. Awakened, while fleeing the screech also stuns the enemies beside it for 1s (`musicNotesRed` on its 8 neighbours). One Ti beside the Wyvern and one
// further out are pushed.
const WYVERN_MASK = ['OOOXOOO', 'OOXXXOO', 'OXXXXXO', 'XXX+XXX', 'OXXXXXO', 'OOXXXOO', 'OOOXOOO'];
function sceneWyvern(awaken) {
  const T = 500;
  const push = (dx, dy, step) => ({ id: 119, dx, dy, facing: dx < 0 ? 'east' : 'west', walk: { at: T, steps: [step], speed: 255, onEnter: { fx: { ...SCENE_FX.magicSparkle }, number: 'magic', tiles: [[dx + step[0], dy + step[1]]] } } });
  return {
    numbers: [sceneHeal(T, 'self')], ...sceneSelf(), gridHalf: 3, flashes: [{ at: T, tiles: sceneArea(WYVERN_MASK) }], // the area lights with the screech, not at the loop start
    mates: [push(-1, 0, [-1, 0]), push(2, 1, [1, 0])], casterFlee: { at: T, from: [[-1, 0], [2, 1]] },
    ...(awaken ? { stuns: [{ at: T + 312, ms: 1000, on: [-2, 0], shake: false }] } : {}),
    fx: [{ n: 'musicNotesBlue', id: 24, f: 11, tiles: sceneArea(WYVERN_MASK), at: T, opacity: 0.3 }, { n: 'musicNotesGreen', id: 19, f: 11, w: 'self', at: T },
      ...(awaken ? sceneArea(SCENE_RING).map((t) => ({ ...SCENE_FX.musicNotesRed, tiles: [t], at: T })) : [])]
  };
}

// Deer's lamp (a passive aura, `UtevoLux`): allies within 2 tiles (3 awakened) get -25% (-0.25% per AP, so -40% at 60 AP, capped at -80%) attack delay, i.e. faster attacks: a
// `greenWhirlpool` aura (item 36744, half opacity, fading in over 1s) on each and the `attackspeedbuff` chip (3.5s, refreshed while they stay in the light). The lamp is a
// yellow `holy` glow (60 alpha) 80 x range game px across. Three allies: 1 and 2 tiles out are lit; the one 3 tiles out only when awakened.
function sceneDeer(awaken) {
  const T = 0; // the lamp is already lit when the preview starts
  const aura = (dx) => ({ kind: 'aura', id: 36744, f: 15, loopMs: 1500, dx, dy: 0, at: T, fadeMs: 1000, op: 0.5 });
  return {
    m: [{ a: 'self', rows: ['+'], g: 1 }], mi: [], fx: [], gridHalf: awaken ? 4 : 3, holdMs: 6000,
    // a slider that follows the loop: Ability Power 60 to 220 (4s, after a 1s rest on 60), with the bonus it gives (25% + 0.25% per AP, capped at 80%); 220 AP is the AP the cap needs. It then holds 1s.
    apSlider: { from: 60, to: 220, step: 10, base: 25, perAp: 0.25, cap: 80, at: 1000, ms: 4000 }, // rests 1s on 60 AP first // awakened the board is a tile wider each way, so the lit 7x7 has an unlit edge // a passive with nothing happening: the loop is held long enough to see the lamp and the auras
    // the area the lamp reaches, lit like an AoE's tiles (range counts in whole squares around the Deer): 5x5, 7x7 awakened
    flashes: [{ at: T, ms: 4000, kind: 'buff', tiles: sceneArea(awaken ? DEER_AWAKEN_MASK : DEER_MASK) }],
    overlays: [{ kind: 'glow', range: awaken ? 3 : 2, color: '#ffff0060', at: T }, aura(-1), aura(2), ...(awaken ? [aura(3)] : [])],
    mates: [{ dx: -1, dy: 0 }, { dx: 2, dy: 0 }, { dx: 3, dy: 0 }],
    passives: [{ src: 'attackspeedbuff', windows: [[T, null]] }]
  };
}

const DEER_MASK = ['XXXXX', 'XXXXX', 'XX+XX', 'XXXXX', 'XXXXX'];
const DEER_AWAKEN_MASK = ['XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXX+XXX', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX'];
// Polar Bear (the avalanche; range 2 around itself): when the ability is ready it CHARGES for 4.5s (a bar fills): a snow circle (a 160px / 5 tile ring, green border and a faint
// white fill; the `charging` effect floats in it) around it, every enemy within 2 tiles is slowed 40% (the slow icon, the `nunu` chip), and `icicleFall` effects play backwards on
// scattered tiles in three waves (at 0, 1.125s and 1.625s, 2.5s / 2s / 1.5s long plus 0 to 0.75s of random delay, 50% opacity). At 4.375s it booms: `ice` on every enemy in the 5x5
// around it and a crit of magic `ice` damage (17 + 3 AP at a full charge), and at 4.5s the icicles fall forward over the 5x5 minus its corners (0.6s). If the charge is interrupted
// (a stun, a taunt, a push) it booms at once for the charged share; awakened it starts the battle ready. Two villain Ti stand in the circle.
const POLAR_ICICLES = [
  [0, 2500, ['OOOXO', 'XOOOO', 'OO+OX', 'OXOOO', 'OOOXO']],
  [1125, 2000, ['OXOOO', 'OOXXO', 'XX+OX', 'OXOXX', 'OOXOO']],
  [1625, 1500, ['OXXXO', 'OXXXX', 'OX+XX', 'XOXXX', 'OXOXO']]
];
const POLAR_BOOM_MASK = ['XXXXX', 'XXXXX', 'XX+XX', 'XXXXX', 'XXXXX']; // the avalanche's damage area (and the slow's range: 2 squares)
const POLAR_FALL_MASK = ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO']; // the icicles of the last fall: the 5x5 minus its corners
function scenePolarBear() {
  const T = 500;
  const delay = (i) => (i * 211) % 750; // the game's random 0 to 750ms per tile
  let n = 0;
  const waves = POLAR_ICICLES.flatMap(([start, ms, rows]) => sceneArea(rows).map((tile) => { const d = delay(n++); return { n: 'icicleFall', id: 42, f: 12, tiles: [tile], at: T + start + d, ms: ms + d, reverse: true, opacity: 0.5 }; }));
  const enemies = [[-2, 0], [1, -1]];
  return {
    numbers: enemies.map((e) => sceneDmg(T + 4375, e, 'ice', true)), ...sceneSelf(), gridHalf: 2, flashes: [{ at: T, ms: 4375, tiles: sceneArea(YETI_MASK) }, { at: T + 4375, ms: 800, tiles: sceneArea(POLAR_BOOM_MASK) }], // the boom hits the whole 5x5, corners too: lit when it booms
    mates: enemies.map(([dx, dy]) => ({ id: 119, dx, dy, facing: dx < 0 ? 'east' : 'south' })),
    statusIcons: enemies.map((e) => ({ at: T, icon: 'slow', on: e })),
    bars: [{ at: T, ms: 4500, on: 'self', color: '#c084fc' }],
    overlays: [{ kind: 'circle', tiles: 5, border: 'rgba(96,192,96,0.7)', fill: 'rgba(255,255,255,0.2)', at: T, until: T + 4375 }],
    passives: [{ src: 'nunu', windows: [[T, T + 4500]] }], holdMs: T + 5600,
    fx: [{ ...SCENE_FX.charging, w: 'self', at: T, ms: 2700, opacity: 0.8 }, { ...SCENE_FX.charging, w: 'self', at: T + 2700, ms: 2700, opacity: 0.8 }, ...waves, // `charging` loops every 2.7s
      ...enemies.map((e) => ({ n: 'ice', id: 44, f: 12, tiles: [e], at: T + 4375 })),
      ...sceneArea(POLAR_FALL_MASK).map((tile) => ({ n: 'icicleFall', id: 42, f: 12, tiles: [tile], at: T + 4500, ms: 600, opacity: 0.5 }))]
  };
}

// Elf's Wild Growth (the game's class): at the start of the battle (cooldown 16s, minus 60ms per AP, at least 7s) it casts `tauntYellow` (600ms) on itself and drops a rune
// (the `wildGrowth` item, 64px, 60% opacity) on each free tile around every enemy, one tile per tick: each fades in over 300ms while it falls in (`translateFromTopElastic`),
// a `poof` (20% opacity) follows 5 ticks later; the tiles are blocked for 6s, which roots the enemy, and the runes are then removed at once (no fade-out here). The Elf shoots arrows (range 3);
// awakened its arrows are crits of TRUE damage at an enemy trapped in the runes (all its neighbours blocked). While alive it gives its ranged allies +1 range (`raiseStat`, a
// pulse, the `distance` chip). The runes' fall is compressed to the game's real 6s here; the ally in the scene is a ranged Minotaur Archer.
const ELF_RUNE_TILES = sceneArea(SCENE_RING);
const ELF_ENEMIES = [[0, 0], [-3, 2]]; // the target dummy (a villain Ti) and a second villain Ti: the runes go round EVERY enemy, each enemy's ring one tile per tick from the same moment
function sceneElf(awaken) {
  const T = 500;
  const shot = 2000; // the Elf shoots once the runes are down
  const runes = ELF_ENEMIES.flatMap(([ex, ey]) => ELF_RUNE_TILES.map(([dx, dy], i) => ({ tile: [ex + dx, ey + dy], i })));
  return {
    numbers: [awaken ? sceneDmg('land', 'target', 'true', true) : sceneDmg('land')], castRange: 3, gridHalf: 4, lead: shot, ...(awaken ? { noBlood: 1, autoAttackAs: { type: 'true', crit: true, noBlood: true } } : {}), // awakened every arrow at a trapped enemy is a true crit
    m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [{ n: 'arrow', id: 3 }],
    mates: [sceneTiMate(-3, 2, 'east', { anchor: 'target' }), { id: 34, anchor: 'target', dx: 3, dy: -2, facing: 'west', pulse: [T] }], // the Elf's ranged ally: a Minotaur Archer (Ti is only ever a villain)
    passives: [{ src: 'distance', windows: [[T, null]], counts: [{ at: T, n: '+1' }] }],
    overlays: runes.map(({ tile: [dx, dy], i }) => ({ kind: 'rune', anchor: 'target', id: 2130, dx, dy, at: T + 62.5 * i, ms: 6000 - 62.5 * i })), // every rune goes at the same moment: the cast schedules ONE removal, 6s after it
    holdMs: T + 6000 + 600,
    fx: [{ n: 'tauntYellow', id: 220, f: 8, w: 'self', at: T, ms: 600 }, { ...SCENE_FX.raiseStat, tiles: [[3, -2]], at: T },
      ...runes.map(({ tile, i }) => ({ ...SCENE_FX.poof, tiles: [tile], at: T + 62.5 * (i + 5), opacity: 0.2 }))]
  };
}

// Elf Scout (range 7, it targets the FARTHEST enemy): its attack IS the ability: three `iceArrow` missiles (70% opacity) a tick apart, `icicleFall` on the target (1.2s, 50% opacity) a
// tick after, the target slowed 5% + 0.3% per AP for 2.5s (the slow icon, the `icearrowslow` chip), and the hit is physical damage with +6 attack damage per square of distance
// beyond the first (a crit from 6 squares on, the target flinches from 4 and is thrown back from 6: `flinch` / `superImpact`, 250ms; the board is only 7x7 here, so none of those
// distance effects show). It shoots at its attack delay of 2s. Awakened, every allied elf's auto attack slows its target too (the chip `iciclebow` on them): an allied Elf shoots first
// and its arrow slows the tree, then the Scout.
function sceneElfScout(awaken) {
  const from = [3, 3];
  const flightMs = SCENE_MISSILE_MS;
  const shots = awaken ? [1500] : [500, 2500];
  const slowAt = awaken ? 500 + flightMs : shots[0] + flightMs; // the first slowing hit
  const hits = shots.map((t) => t + flightMs);
  return {
    numbers: [...hits.map((at) => sceneDmg(at)), ...(awaken ? [sceneDmg(500 + flightMs)] : [])],
    castRange: 3, ...sceneTarget(),
    statusIcons: [{ at: slowAt, icon: 'slow' }],
    passives: [{ src: 'icearrowslow', windows: [[slowAt, hits[hits.length - 1] + 2500]] }],
    mates: awaken ? [{ id: 39, anchor: 'target', dx: 3, dy: -2, facing: 'west' }] : [],
    flights: [...shots.flatMap((t) => [0, 62.5, 125].map((d) => ({ shot: { n: 'iceArrow', id: 35 }, from, to: [0, 0], at: t + d }))),
      ...(awaken ? [{ shot: { n: 'arrow', id: 3 }, from: [3, -2], to: [0, 0], at: 500 }] : [])],
    fx: [...hits.flatMap((at) => [{ n: 'icicleFall', id: 42, f: 17, tiles: [[0, 0]], at: at + 62.5, ms: 1200, opacity: 0.5 }, { ...SCENE_FX.bleed, tiles: [[0, 0]], at }]),
      ...(awaken ? [{ ...SCENE_FX.bleed, tiles: [[0, 0]], at: 725 }] : [])]
  };
}

// Elf Arcanist (the dark ritual): at the start of the battle it picks its CLOSEST ally and channels for 3.5s facing north: the ally is stunned (the stun bar), turns grey, four
// `ritualCandles` (item 43702, 64px, 4 frames per 0.4s) fade in on the free tiles around it and fade out again 350ms before the end, a `ritualBookstand` (item 43705) floats down
// above the Arcanist and rises away at the end, the `glowingCircle` loops on it and its channel bar (energy purple) fills. Then it sacrifices the ally: an `sd` missile, 6666
// true damage (dark red `hpBlack`, a crit; it kills), `blackSmoke` on it and its corpse; every living ally of the Arcanist (itself included) gets `bats`, the `greenWhirlpool`
// aura (item 36744, grey and dark, 80% opacity, fading in over 1s), a grey tint for 10s and the `deathbuff` chip: +30 ability power and +20 attack damage for 10s (awakened:
// allied elves also get +30% attack speed, no extra visual). Here the ally it sacrifices is the one beside it and an Elf stands further away.
function sceneElfArcanist() {
  const T = 500;
  const RITUAL = 3500;
  const CAST = T + RITUAL;
  const victim = [-2, 0];
  const buffed = [2, 1];
  const candles = [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ kind: 'fade', id: 43702, f: 4, loopMs: 400, w: 2, h: 2, dx: victim[0] + dx, dy: victim[1] + dy, at: T, fadeMs: 300, outAt: CAST - 350, outMs: 300 }));
  const whirlpool = ([dx, dy]) => ({ kind: 'aura', id: 36744, f: 15, loopMs: 1500, dx, dy, at: CAST, fadeMs: 1000, op: 0.8, filter: 'grayscale(1) brightness(0.5)' });
  return {
    numbers: [sceneDmg(CAST, victim, 'hpBlack', true, 'true')], ...sceneSelf(), noDummy: true, gridHalf: 3, casterFacing: 'north',
    mates: [
      { dx: victim[0], dy: victim[1], dies: { at: CAST }, tint: { at: T, until: CAST, filter: 'grayscale(0.9)', ramp: 355 } },
      { id: 39, dx: buffed[0], dy: buffed[1], tint: { at: CAST, filter: 'grayscale(0.9)', ramp: 1000 } }
    ],
    casterFilter: [[0, 'grayscale(0)'], [CAST, 'grayscale(0)'], [CAST + 1000, 'grayscale(0.9)']],
    stuns: [{ at: T, ms: RITUAL, on: victim, shake: false }],
    bars: [{ at: T, ms: RITUAL, on: 'self', color: '#cc33ff' }],
    overlays: [...candles, { kind: 'float', id: 43705, f: 4, loopMs: 400, w: 2, h: 2, dx: 0, dy: -1, at: T, ms: RITUAL }, whirlpool([0, 0]), whirlpool(buffed)],
    flights: [{ shot: { n: 'sd', id: 32 }, from: [0, 0], to: victim, at: CAST }],
    passives: [{ src: 'deathbuff', windows: [[CAST, null]] }], holdMs: CAST + 3000,
    fx: [...[0, 1100, 2200].map((d) => ({ ...SCENE_FX.glowingCircle, w: 'self', at: T + d })),
      { n: 'blackSmoke', id: 158, f: 7, tiles: [victim], at: CAST }, { ...SCENE_FX.bats, w: 'self', at: CAST }, { ...SCENE_FX.bats, tiles: [buffed], at: CAST }]
  };
}

// Orc Berserker (undying rage): a resource bar above it (the `undyingrage` counter) fills as its HP drops, yellow (`hpHalf`), then orange (`fire`) from half, then red
// (`hpCriticallyLow`) when it is full, at 10% HP (the HP bar above it drains with each hit, so the rage bar fills while HP falls; the lifesteal refills HP). Full, it ENRAGES: it pulses (brightness 200%, 300ms twice), `smoke` puffs up and to the left of it, the chip lights up, and it gets
// +80% attack speed, +40 speed and 300% lifesteal, and attacks its own allies (crit physical hits, each healing it back as a crit heal). Once its HP is full again it calms down
// (`raiseStat` played backwards, the chip and the bar gone); not awakened that happens once. Here a villain Ti shoots it three times, then it hits the ally beside it.
function sceneOrcBerserker() {
  const hits = [1000, 2500, 4000];
  const attacks = [4600, 5200, 5800]; // 3000ms attack delay with 80% bonus attack speed: every 600ms
  const CALM = attacks[attacks.length - 1];
  const ally = [1, 0];
  return {
    numbers: [...hits.map((at) => sceneDmg(at, 'self', 'fire')), ...attacks.map((at) => sceneDmg(at, ally, 'physical', true)), ...attacks.map((at) => sceneHeal(at, 'self', true))],
    ...sceneSelf(), mates: [{ dx: ally[0], dy: ally[1], facing: 'west' }],
    attacker: { ...SCENE_VILLAIN_TI, dx: 0, dy: 2, aim: [0, 0], at: hits[0] - SCENE_MISSILE_MS },
    flights: hits.slice(1).map((at) => ({ shot: SCENE_VILLAIN_TI.shot, from: [0, 2], to: [0, 0], at: at - SCENE_MISSILE_MS })),
    bars: [{ at: 0, until: CALM + 1200, on: 'self', levels: [[0, 1, '#00c000'], [hits[0], 0.67, '#60c060'], [hits[1], 0.33, '#c0c000'], [hits[2], 0.08, '#ff0000'], [attacks[0], 0.38, '#c0c000'], [attacks[1], 0.68, '#60c060'], [attacks[2], 1, '#00c000']] }, // the HP bar
      { at: 0, until: CALM, on: 'self', y: 5, levels: [[0, 0, '#c0c000'], [hits[0], 0.33, '#c0c000'], [hits[1], 0.72, '#ff9900'], [hits[2], 1, '#ff0000']] }],
    casterFilter: [[0, 'brightness(1)'], [hits[2], 'brightness(1)'], [hits[2] + 150, 'brightness(2)'], [hits[2] + 300, 'brightness(1)'], [hits[2] + 450, 'brightness(2)'], [hits[2] + 600, 'brightness(1)']],
    passives: [{ src: 'undyingrage', windows: [[hits[2], CALM]] }], holdMs: CALM + 1200,
    fx: [...hits.map((at) => ({ ...SCENE_FX.moe, to: [0, 0], at })),
      { n: 'smoke', id: 242, f: 12, w: 'self', at: hits[2], tx: -0.8, ty: -0.4 },
      ...attacks.map((at) => ({ ...SCENE_FX.bleed, tiles: [ally], at })),
      { ...SCENE_FX.raiseStat, w: 'self', at: CALM, ms: 750, reverse: true }]
  };
}

// Orc Leader (the throwing knife; range 99, shown from 3): a `throwingKnife` flies at its target (a crit of physical damage and -(2 + 0.1 AP) armor on it, 6s), the game's knife
// picture (/assets/misc/orcleaderknife.png) pops above the target (slides in 200ms with a brightness pulse, bobs, slides away 350ms before the 6s end) and every ally of the Leader
// is TAUNTED to attack that target (the exclamation icon over it) with +40 speed; the Leader heals 25% of the physical damage its allies deal to the target (silent: no number).
// Here an Elf ally takes the taunt and shoots the target at its 2s attack delay. Awakened: if the knife ends early (the target died) the Leader heals 25% of its missing HP (silent too).
function sceneOrcLeader() {
  const T = 500;
  const KNIFE_MS = 6000;
  const ally = [-3, 0]; // from the target
  const shots = [1000, 3000, 5000]; // the ally's arrows (the Elf's default 2000ms attack delay), from the taunt on
  const arrow = { n: 'arrow', id: 3 };
  return {
    numbers: [sceneDmg('land', 'target', 'physical', true), ...shots.map((at) => sceneDmg(at + SCENE_MISSILE_MS, 'target', 'physical'))],
    castRange: 3, lead: T, m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [{ n: 'throwingKnife', id: 9 }],
    attacker: { id: 39, shot: arrow, dx: ally[0], dy: ally[1], aim: [0, 0], at: shots[0] },
    flights: shots.slice(1).map((at) => ({ shot: arrow, from: ally, to: [0, 0], at })),
    // the caster stands 3 tiles out on the diagonal of the target: the ally's offset from the caster is ally - [3, 3]
    statusIcons: [sceneTaunt(T, [ally[0] - 3, ally[1] - 3])],
    overlays: [{ kind: 'float', src: 'misc/orcleaderknife.png', anchor: 'target', dx: 0, dy: -1, w: 1, h: 1, at: T, inMs: 200, ms: KNIFE_MS - 350, bobDelay: 300, pulse: true }],
    holdMs: KNIFE_MS + 300,
    fx: shots.map((at) => ({ ...SCENE_FX.bleed, tiles: [[0, 0]], at: at + SCENE_MISSILE_MS }))
  };
}

// Orc Shaman (the shamanic ritual; range 3): as soon as an enemy dies it turns to the corpse and channels for 3.5s: it pulses (brightness, 700ms, six times), the `charging`
// effect and the `holyCircle` loop on it (hue-rotated: purple), its channel bar (ability power purple) fills, and a dust cloud (item `dustcloud`, 1.6s fade-in, then the red
// `electricDustcloudRed`) and a cloud above it (`clouds`, sliding in over 1s) gather on the corpse. Then a `holyMissile` (hue-rotated) flies to it, the dust fades (400ms) with an
// `avatarPoof`, and the enemy is REVIVED as an ally, black dust (`blackDust`) around it; it loses 12% (- 0.05% per AP) of its max HP every second as silent true damage (dark red).
// Awakened it may cast again once the revived creature dies. Here an Elf ally kills a villain Ti and the Shaman revives it.
function sceneOrcShaman() {
  const HIT = 700; // Ti dies
  const CHANNEL = 3500;
  const CAST = HIT + CHANNEL;
  const corpse = [-2, 0];
  const dust = (id, at, fadeMs, outAt, ease = 'ease-out') => ({ kind: 'fade', id, f: 24, loopMs: 2400, w: 2, h: 2, dx: corpse[0], dy: corpse[1], at, fadeMs, ease, outAt, outMs: 400, outEase: 'ease-out' });
  const every = (from, step, until, make) => { const out = []; for (let t = from; t < until; t += step) out.push(make(t)); return out; };
  return {
    numbers: [1000, 2000].map((d) => sceneDmg(CAST + d, corpse, 'hpBlack', false, 'true')),
    ...sceneSelf(), casterFacing: 'west', gridHalf: 3,
    attacker: { id: 39, shot: { n: 'arrow', id: 3 }, dx: -2, dy: -2, aim: corpse, at: HIT - SCENE_MISSILE_MS },
    mates: [{ id: 119, dx: corpse[0], dy: corpse[1], dies: { at: HIT, until: CAST } }],
    flights: [{ shot: { n: 'holyMissile', id: 31, filter: 'hue-rotate(300deg)' }, from: [0, 0], to: corpse, at: CAST }],
    bars: [{ at: HIT, ms: CHANNEL, on: 'self', color: '#c084fc' }],
    casterFilter: [[0, 'brightness(1)'], [HIT, 'brightness(1)'], ...[0, 1, 2, 3, 4, 5].flatMap((k) => [[HIT + k * 700 + 350, 'brightness(2)'], [HIT + k * 700 + 700, 'brightness(1)']])],
    overlays: [
      { ...dust(33007, HIT, 1600, HIT + 1600), outMs: 1 }, // the white cloud until the animation ends, then the red one replaces it at once
      { ...dust(33005, HIT + 1600, 1, CAST), ease: 'linear' },
      { kind: 'fade', id: 48471, f: 1, loopMs: 1000, w: 2, h: 2, dx: corpse[0], dy: corpse[1] - 1, at: HIT, fadeMs: 1000, ease: 'ease-out', drift: { from: [50, -50], to: [10, -20] }, outAt: CAST, outMs: 400, outEase: 'ease-out' }
    ],
    holdMs: CAST + 2600,
    fx: [...every(HIT, 700, CAST, (at) => ({ ...SCENE_FX.charging, w: 'self', at, filter: 'hue-rotate(300deg)' })),
      ...every(HIT, 1200, CAST, (at) => ({ ...SCENE_FX.holyCircle, w: 'self', at, filter: 'hue-rotate(270deg)' })),
      { n: 'avatarPoof', id: 244, f: 11, to: [corpse[0], corpse[1] - 1], at: CAST },
      ...every(CAST, 1490, CAST + 2600, (at) => ({ n: 'blackDust', id: 69, f: 16, tiles: [corpse], at, ty: -0.25 }))]
  };
}

// Orc Rider (war wolves; melee): once the battle is two ticks old it summons 2 War Wolves (awakened 3) on the first free tiles around it: `musicNotesWhite` on the Rider and, two ticks
// after each wolf appears, `teleportBlue` on it. The wolves (outfit 3, speed 145) share the Rider's bite: every attack is a physical hit with `fangBite` on the target (shifted 35% / 25%),
// and a wolf only attacks 2 ticks after the last attack of the pack (so the bites come 125ms apart). The wolves cannot be revived. Which tiles the game picks first is read from its
// neighbour order, not shown here: the wolves stand on free tiles next to the target.
function sceneOrcRider(awaken) {
  const T = 500;
  const wolves = [{ dx: -1, dy: -1, facing: 'south' }, { dx: 0, dy: -1, facing: 'west' }, ...(awaken ? [{ dx: 0, dy: 1, facing: 'west' }] : [])];
  const volleys = [1000, 3000];
  const bites = volleys.flatMap((v) => [v, ...wolves.map((_, i) => v + 125 * (i + 1))]);
  return {
    numbers: bites.map((at) => sceneDmg(at, 'target', 'physical')),
    ...sceneTarget(), noBlood: 1,
    mates: wolves.map((w) => ({ outfit: 3, dx: w.dx, dy: w.dy, facing: w.facing, at: T })),
    holdMs: volleys[volleys.length - 1] + 125 * wolves.length + 900,
    fx: [{ n: 'musicNotesWhite', id: 25, f: 11, w: 'self', at: T },
      ...wolves.map((w) => ({ ...SCENE_FX.teleportBlue, to: [w.dx, w.dy], at: T + 125 })),
      ...bites.flatMap((at) => [{ n: 'fangBite', id: 217, f: 10, tiles: [[0, 0]], at, tx: 0.35, ty: 0.25 }, { ...SCENE_FX.bleed, tiles: [[0, 0]], at }])]
  };
}

// Orc Warlord (war drum): every auto-attack of any creature adds a stack of rage (a fire-orange bar above it, 30 stacks); at 30 it ROARS: the stacks reset, it shouts "Orc buta bana!
// Ranat Ulderek!" (orange, 3s, shaking into place), three war-cry rings (as wide as the board, ally green) spread from it 0, 125 and 187.5ms apart, and `drown` (hue-rotated) plays on
// it for 800ms. A second later every ally with an attack (itself included) pulses (brightness, 500ms delay), gets `raiseStat` (hue-rotate 185) and the `wardrum` chip for 6s: its
// auto-attacks heal it for 10% (+0.25% per AP) of the damage and deal 5 (+0.1 AP) extra magic damage 3 ticks later. Awakened it starts with 25 stacks. Here the bar starts at 29/30,
// an ally Elf's arrow at a villain Ti is the 30th attack, and the Elf's next arrow shows the buff (its lifesteal heal and the extra magic damage).
function sceneOrcWarlord() {
  const ATTACK = 700; // the Elf shoots: stack 30
  const ROAR = 775; // the Warlord's next tick
  const BUFF = ROAR + 1000; // 800ms of `drown` + 3 ticks
  const SHOT2 = 2700;
  const elf = [-3, -1];
  const ti = [3, -1];
  const arrow = { n: 'arrow', id: 3 };
  const land2 = SHOT2 + SCENE_MISSILE_MS;
  return {
    numbers: [sceneDmg(ATTACK + SCENE_MISSILE_MS, ti, 'physical'), sceneDmg(land2, ti, 'physical'), sceneDmg(land2 + 187.5, ti, 'magic'), sceneHeal(land2, elf)],
    ...sceneSelf(), gridHalf: 3,
    attacker: { id: 39, shot: arrow, dx: elf[0], dy: elf[1], aim: ti, at: ATTACK },
    flights: [{ shot: arrow, from: elf, to: ti, at: SHOT2 }],
    mates: [sceneTiMate(ti[0], ti[1], 'west')],
    bars: [{ at: 0, until: land2 + 1200, on: 'self', levels: [[0, 29 / 30, '#ff9900'], [ATTACK, 1, '#ff9900'], [ROAR, 0, '#ff9900']] }],
    casterFilter: [[0, 'brightness(1)'], [BUFF + 500, 'brightness(1)'], [BUFF + 650, 'brightness(2)'], [BUFF + 800, 'brightness(1)'], [BUFF + 950, 'brightness(2)'], [BUFF + 1100, 'brightness(1)']],
    overlays: [{ kind: 'say', text: 'Orc buta bana! Ranat Ulderek!', dx: 0, dy: 0, at: ROAR, ms: 3000 },
      ...[0, 125, 187.5].map((d) => ({ kind: 'roar', dx: 0, dy: 0, at: ROAR + d }))],
    passives: [{ src: 'wardrum', windows: [[BUFF, null]] }], holdMs: land2 + 1500,
    fx: [{ n: 'drown', id: 2, f: 12, w: 'self', at: ROAR, ms: 800, filter: 'hue-rotate(260deg)' },
      { ...SCENE_FX.raiseStat, w: 'self', at: BUFF, filter: 'hue-rotate(185deg)' }, { ...SCENE_FX.raiseStat, tiles: [elf], at: BUFF, filter: 'hue-rotate(185deg)' },
      { ...SCENE_FX.bleed, tiles: [ti], at: ATTACK + SCENE_MISSILE_MS }, { ...SCENE_FX.bleed, tiles: [ti], at: land2 }]
  };
}

// Goblin Scavenger (the damaged helmet): at the start of the battle it puts on a shield: the `damagedhelmet` item drops onto it (600ms, fading out from 200ms, 50% opacity), a grey bar of
// 10 hits (`MAX_HIT_DURABILITY`) shows above it and it gets +30 armor (+1 per AP); every hit it takes costs one. Two ticks into the battle every melee ally with an attack (itself included;
// not the War Wolves or ranged creatures) gets `raiseStat` and a counter: every 3rd attack is DOUBLE, the second hit following 3 ticks (187.5ms) after the first. Awakened it dodges the
// next enemy auto-attack while its double attack is ready (a blue glow, `dodge`). Here it attacks a dummy every second (1000ms) and a villain Ti shoots it once at 2.5s (the shield loses 1 hit;
// awakened the glow rises after the 2nd attack and the arrow is dodged). The counter's three pips are not drawn.
function sceneGoblinScavenger(awaken) {
  const T = 500; // the helmet drops
  const attacks = [1000, 2000, 3000];
  const double = attacks[2] + 187.5;
  const tiHit = 2500;
  const dodge = '#97c9db';
  const glow = (a) => `drop-shadow(0 0 3px rgba(151,201,219,${a}))`;
  return {
    numbers: [...attacks.map((at) => sceneDmg(at, 'target', 'physical')), sceneDmg(double, 'target', 'physical'), ...(awaken ? [] : [sceneDmg(tiHit, 'self', 'fire')])],
    ...sceneTarget(), noBlood: 1,
    attacker: { ...SCENE_VILLAIN_TI, dx: 2, dy: -1, aim: [1, 0], at: tiHit - SCENE_MISSILE_MS }, // inside the 5 x 5 board (the caster stands one tile east of the target)
    bars: [{ at: T, until: double + 1200, on: 'self', levels: [[T, 1, '#999999'], ...(awaken ? [] : [[tiHit, 0.9, '#999999']])] }],
    overlays: [{ kind: 'drop', id: 5924, f: 1, loopMs: 1000, dx: 0, dy: 0, at: T, ms: 600, fadeDelay: 200, op: 0.5 }],
    ...(awaken ? { casterFilter: [[0, glow(0)], [attacks[1], glow(0)], [attacks[1] + 400, glow(1)], [tiHit, glow(1)], [tiHit + 400, glow(0)]] } : {}),
    passives: [{ src: 'damagedhelmet', windows: [[T, null]] }], holdMs: double + 1000,
    fx: [{ ...SCENE_FX.raiseStat, w: 'self', at: T + 125 },
      ...[...attacks, double].map((at) => ({ ...SCENE_FX.bleed, tiles: [[0, 0]], at })),
      ...(awaken ? [{ n: 'dodge', id: 231, f: 4, w: 'self', at: tiHit }] : [{ ...SCENE_FX.moe, w: 'self', at: tiHit }])]
  };
}

// Goblin Assassin (the execute): the moment it finds a target it turns INVISIBLE and hasted (+60 speed) for 3s: `magicPoof` on it, a draining invisibility bar (blue-grey) and the
// `invisibility` chip; while invisible the game draws a looping `heal` effect instead of the creature (as with the Stalker) and enemies cannot target it. Its auto-attacks hit a target
// at 20% HP or less with an EXECUTE: `chip` and `fatal` on the target and true damage equal to its current HP (dark red, a crit); the target dies. Here a villain Ti takes a plain hit
// (1s), then the execute (2s). Awakened the execute also gives every allied goblin (itself) `raiseStat` and a 3s `dodge` chip: the next enemy auto-attack is dodged (a second villain Ti
// shoots once the Assassin is visible again).
function sceneGoblinAssassin(awaken) {
  const T = 500;
  const INVISIBLE = 3000;
  const hit = 1000;
  const execute = 2000;
  const tiShot = T + INVISIBLE + 300 + SCENE_MISSILE_MS; // after it is visible again
  return {
    numbers: [sceneDmg(hit, 'target', 'physical'), sceneDmg(execute, 'target', 'death', true, 'true')],
    ...sceneTarget(), noBlood: 1, noDummy: true,
    mates: [{ id: 119, dx: -1, dy: 0, dies: { at: execute } }],
    transform: { at: T, until: T + INVISIBLE, fade: 200 },
    stuns: [{ at: T, ms: INVISIBLE, on: 'self', shake: false, color: '#97c9db' }],
    ...(awaken ? { attacker: { ...SCENE_VILLAIN_TI, dx: 2, dy: -1, aim: [1, 0], at: tiShot - SCENE_MISSILE_MS } } : {}),
    passives: [{ src: 'invisibility', windows: [[T, T + INVISIBLE]] }, ...(awaken ? [{ src: 'dodge', windows: [[execute, tiShot]] }] : [])],
    holdMs: (awaken ? tiShot : T + INVISIBLE) + 1200,
    fx: [{ ...SCENE_FX.magicPoof, w: 'self', at: T },
      ...sceneInvisibleLoops(T, 4),
      { ...SCENE_FX.bleed, tiles: [[0, 0]], at: hit }, // `tiles` count from the target tile (Ti); `to` counts from the caster
      { n: 'chip', id: 4, f: 9, b: 1, to: [-1, 0], at: execute }, { n: 'fatal', id: 230, f: 4, to: [-1, 0], at: execute, tx: 0.125 },
      ...(awaken ? [{ ...SCENE_FX.raiseStat, w: 'self', at: execute }, { n: 'dodge', id: 231, f: 4, w: 'self', at: tiShot }] : [])]
  };
}

// Firestarter (the fire trail; range 3): wherever it walks it leaves FIRE: 70% into each step a yellow fire field (item 2131, 64px, 5 frames per 0.6s) and `yellowSmoke` (70% opacity,
// shifted 25% up and left) appear on the tile it moved to; after 2s the field is the medium one (2132), after 4s the small one (2133), and it is gone after 6s. An enemy that steps onto
// a fire tile burns: the `fire` effect (60% opacity) and a crit of magic `fire` damage (3 + 0.4 AP). Awakened, two ticks into the battle it gets +50 speed for 5s (`raiseStat`, the
// `sandals` chip) and TAUNTS the enemies next to it (`tauntYellow`). Here it walks a ring of eight tiles (the speed 115 of its class times the walk) and a villain Ti chases it two steps
// behind, stepping onto every fire field it left (the game's villain Ti is a little slower, so it falls behind). Once the ring is done it stands and shoots Ti with its normal attack (a
// `fireArrow`, the `fire` effect on the target, physical damage in the `fire` colour) every 2s: the generic normal-attack system only handles a standing caster with a standing target, so the
// two shots are placed by hand on the tile Ti has reached then (its speed taken as 100).
function sceneFirestarter(awaken) {
  const T = 500;
  const bonus = awaken ? 50 : 0;
  const stepMs = walkStepMs(115 + bonus);
  const ring = [[1, 0], [1, 0], [0, 1], [0, 1], [-1, 0], [-1, 0], [0, -1], [0, -1]]; // back to where it started
  let [x, y] = [0, 0];
  const fires = ring.map(([dx, dy], i) => { x += dx; y += dy; return { tile: [x, y], at: T + i * stepMs + 0.7 * stepMs }; });
  const stages = ({ tile, at }) => [[2131, 600, 0, 2000], [2132, 500, 2000, 4000], [2133, 500, 4000, 5950]]
    .map(([id, loopMs, from, until]) => ({ kind: 'loop', id, f: 5, loopMs, w: 2, h: 2, dx: tile[0], dy: tile[1], at: at + from, until: at + until, ground: true }));
  // Ti starts beside the start tile (taunted when awakened) and follows the same tiles two steps behind (the start tile itself holds no fire yet).
  const chase = [[1, 0], ...ring.slice(0, 6)];
  const chaseAt = T + 2 * stepMs;
  const tiStepMs = walkStepMs(100);
  const tiAt = (t) => { // the tile Ti stands on at time t: it starts at [-1, 0] and takes the steps of `chase`
    let [tx, ty] = [-1, 0];
    chase.forEach(([dx, dy], i) => { if (t >= chaseAt + (i + 1) * tiStepMs) { tx += dx; ty += dy; } });
    return [tx, ty];
  };
  const shots = [T + ring.length * stepMs + 300, T + ring.length * stepMs + 2300].map((at) => ({ at, to: tiAt(at) }));
  const arrow = { n: 'fireArrow', id: 34 };
  return {
    ...sceneSelf(), gridHalf: 3, casterFlee: { at: T, steps: ring, speedBonus: bonus },
    mates: [{ id: 119, dx: -1, dy: 0, facing: 'east', walk: { at: chaseAt, steps: chase, onEnter: { fx: { ...SCENE_FX.fire, opacity: 0.6 }, number: 'fire', critSteps: 99, tiles: fires.slice(0, 7).map((f) => f.tile) } } }],
    overlays: fires.flatMap(stages),
    ...(awaken ? { statusIcons: [sceneTaunt(T, [-1, 0])], passives: [{ src: 'sandals', windows: [[T, T + 5000]] }] } : {}),
    numbers: shots.map((a) => sceneDmg(a.at, { target: a.to }, 'fire', false, 'physical')),
    flights: shots.map((a) => ({ shot: arrow, from: [0, 0], to: a.to, at: a.at })),
    holdMs: Math.round(Math.max(chaseAt + 7 * stepMs * 1.25, shots[1].at) + 1500),
    fx: [...fires.map((f) => ({ n: 'yellowSmoke', id: 168, f: 7, tiles: [f.tile], at: f.at, tx: -0.25, ty: -0.25, opacity: 0.7 })),
      ...shots.map((a) => ({ ...SCENE_FX.fire, tiles: [a.to], at: a.at, opacity: 0.6 })),
      ...(awaken ? [{ ...SCENE_FX.raiseStat, w: 'self', at: T }, { n: 'tauntYellow', id: 220, f: 8, tiles: [[-1, 0]], at: T }] : [])]
  };
}

// Cyclops (the ground shaker): every time it MOVES it stomps where it arrives: `poof` on its new tile, then (3 ticks later) a wave over the 8 tiles around it and (8 ticks after the stomp)
// a second wave over the ring of 12 tiles two out, each tile with `groundshaker`. Every creature on a wave tile takes a crit of magic damage (16 + 0.4 AP), once per stomp, ENEMY OR
// ALLY. The stomp comes (movingAnimationTicks + 1) / 4.8 + 2 ticks after the step starts; its speed is 55 (a slow walker). Awakened it starts the battle by forging: an anvil drops on a free
// tile beside it (400ms...), `poof` two ticks later and `phoenixFire` at 8 ticks, and 28 ticks (1.75s) in the adjacent ally's equipment gains one tier (the chip) while the ally pulses; the
// Cyclops does nothing meanwhile (it stays facing the anvil). Here it takes one step east and the stomp hits a villain Ti next to its new tile, the ally below it (friendly fire) and a second Ti
// in the outer ring.
function sceneCyclops(awaken) {
  const SPEED = 55;
  const FORGE = awaken ? 1750 : 0; // the Cyclops is busy until then
  const T = 500 + (awaken ? FORGE + 300 : 0); // the step starts
  const stompAt = T + ((walkStepTicks(SPEED) + 1) / 4.8 + 2) * 62.5;
  const inner = [stompAt + 3 * 62.5, sceneArea(SCENE_RING)];
  const outer = [stompAt + 8 * 62.5, sceneArea(['OXXXO', 'XOOOX', 'XO+OX', 'XOOOX', 'OXXXO'])];
  const centre = [1, 0];
  const wave = ([when, tiles]) => tiles.map(([dx, dy]) => ({ ...SCENE_FX.groundshaker, tiles: [[centre[0] + dx, centre[1] + dy]], at: when }));
  const ti1 = [2, 0];
  const ally = [0, 1];
  const ti2 = [1, 2];
  const anvil = [-1, 1];
  return {
    numbers: [sceneDmg(inner[0], ti1, 'magic', true), sceneDmg(inner[0], ally, 'magic', true), sceneDmg(outer[0], ti2, 'magic', true)],
    ...sceneSelf(), gridHalf: 3, casterFlee: { at: T, steps: [[1, 0]] },
    mates: [{ dx: ally[0], dy: ally[1], ...(awaken ? { pulse: [500 + FORGE] } : {}) }, sceneTiMate(ti1[0], ti1[1], 'west'), sceneTiMate(ti2[0], ti2[1], 'north')],
    ...(awaken ? { casterFacing: 'south', overlays: [{ kind: 'fall', id: 3458, f: 1, loopMs: 1000, dx: anvil[0], dy: anvil[1], at: 500, ms: 2300 }],
      passives: [{ right: true, windows: [[0, null]], equip: { spriteId: 3057, stat: 'hp', tiers: [{ tier: 3, from: 0, until: 500 + FORGE }, { tier: 4, from: 500 + FORGE, until: null }] } }] } : {}),
    flashes: [inner, outer].map(([when, tiles]) => ({ at: when, ms: 500, tiles: tiles.map(([dx, dy]) => [centre[0] + dx, centre[1] + dy]) })), // the area tiles, lit as the waves hit
    holdMs: Math.round(outer[0] + 1500),
    fx: [{ ...SCENE_FX.poof, tiles: [centre], at: stompAt }, ...wave(inner), ...wave(outer),
      ...(awaken ? [{ ...SCENE_FX.poof, tiles: [anvil], at: 500 + 125 }, { n: 'phoenixFire', id: 295, f: 14, tiles: [anvil], at: 500 + 500 }] : [])]
  };
}

// Warlock (the stone golem; range 99, shown from 3): the moment the battle starts (its ability is ready two ticks in) it summons a Stone Golem on a random free tile within 2 of it: an
// `energyBeam` flies to the tile, `greyTeleport` and `fallingStones` play there, the Warlock heals (10 + 0.5 AP, a crit) and turns INVISIBLE (the game draws the looping `heal` effect
// instead of it, as with the Stalker) until the golem dies. The golem (outfit 67, speed 90, armor 150, 130 HP) walks to the Warlock's target and attacks it every 3s (physical). The
// Warlock keeps casting while invisible, 3.5s after the summon and then alternating: an `energy` missile (a crit of magic `energy` damage, 1.25 AP, `energy` on the target) and a fire
// bomb on the 3x3 around the target (`fire` missile, `largeFireExplosion`, 5 + 0.3 AP). Here the summon and the first two spells (the energy missile, then the fire bomb) are shown. Awakened: +30% ability power
// (the `warlock-hat` chip).
function sceneWarlock(awaken) {
  const T = 500;
  const SPELL = T + 3500;
  const BOMB = SPELL + 3500; // the spells alternate every 3.5s
  const bombTiles = [[0, 0], ...sceneArea(SCENE_RING)];
  const golem = [2, 2]; // from the target; the Warlock stands at [3, 3]
  const golemStep = walkStepMs(90);
  const attack = 1000 + 2 * golemStep;
  return {
    numbers: [sceneHeal(T, 'self', true), sceneDmg(SPELL, 'target', 'energy', true, 'magic'), sceneDmg(BOMB, 'target', 'fire', true, 'magic'), ...[0, 3000, 6000].map((d) => sceneDmg(attack + d, 'target', 'energy', false, 'magic'))],
    castRange: 3, ...sceneTarget(), noBlood: 1, transform: { at: T },
    mates: [{ outfit: 67, anchor: 'target', dx: golem[0], dy: golem[1], facing: 'west', at: T, walk: { at: 1000, speed: 90, steps: [[-1, 0], [0, -1]] } }],
    flights: [{ shot: { n: 'energyBeam', id: 5 }, from: [3, 3], to: golem, at: T }, { shot: { n: 'energy', id: 36 }, from: [3, 3], to: [0, 0], at: SPELL }, { shot: { n: 'fire', id: 4 }, from: [3, 3], to: [0, 0], at: BOMB }],
    flashes: [{ at: BOMB, ms: 700, tiles: bombTiles }],
    ...(awaken ? { passives: [{ src: 'warlock-hat', windows: [[0, null]] }] } : {}),
    holdMs: BOMB + 1500,
    fx: [{ n: 'greyTeleport', id: 225, f: 11, tiles: [golem], at: T }, { n: 'fallingStones', id: 45, f: 19, tiles: [golem], at: T },
      ...sceneInvisibleLoops(T, 9),
      { ...SCENE_FX.energy, tiles: [[0, 0]], at: SPELL },
      ...bombTiles.map((tile) => ({ ...SCENE_FX.largeFireExplosion, b: 1, tiles: [tile], at: BOMB }))]
  };
}

// Knight (Exori): when an enemy is next to it (an axe: any time) it casts Exori: `exori` (`groundshaker` with an axe) on the 8 tiles around it (the 7x7 diamond with an axe, every 3s instead of
// 8s) and every enemy there takes magic damage (2 + 0.4 AP, the grey `zombie` colour). With a Cranial Basher or a Fire Axe the equipment itself BONKS each creature hit by Exori (a weapon lifts above
// it and tilts: `ekBonk`); every NORMAL attack bonks with the first equipped item too, except with an axe. A Giant Sword resets Exori and the attack cooldown after a kill it took part in; a Cranial
// Basher STUNS every creature its attacks hit, Exori included (3s, the stun bar and `magicSparkle`) and the Knight itself (5s at tier 5), and each stun heals it 20 + 8% of its max HP (a crit heal).
// One loop shows each weapon in turn, its equipment chip from 1s before the cast: Giant Sword: the Knight's first normal attack (a crit, the sword
// bonks) KILLS a Ti, which resets Exori AND the attack cooldown to 3 ticks, so Exori and a second normal attack (the sword bonks again) follow 187.5ms later instead of 8s / 4s later; then Cranial Basher and Fire Axe, whose Exori bonks each creature hit. Four villain Ti stand
// around it, the ones outside the area are not hit, and the dead one stays dead. The attack delay (4s) is shortened to fit.
const KNIGHT_AXE = ['OOXXXOO', 'OXXXXXO', 'XXXXXXX', 'XXX+XXX', 'XXXXXXX', 'OXXXXXO', 'OOXXXOO'];
function sceneKnight() {
  const INNER = SCENE_RING;
  const enemies = [[1, 0], [0, 1], [3, 0], [2, 2]];
  const killed = [1, 0]; // the Giant Sword's first attack kills this Ti
  const BLOCK = 3200;
  const BASHER_LEN = 5500; // the Basher block lasts the Knight's own 5s stun (tier 5) and a beat more
  const SHOW = 1000; // the weapon's chip shows this long before the cast
  const firstAt = 1000; // the first normal attack
  const first = firstAt + 187.5; // 3 ticks after the kill: the reset Exori
  const attack2 = first + 62.5; // and the reset normal attack (the same tick in the game; a tick later here so the numbers do not stack)
  const target2 = [0, 1]; // the Ti left next to the Knight
  const blocks = [
    { at: first, rows: INNER, weapon: 3281, bonk: false, effect: { n: 'exori', id: 10, f: 8 } }, // Giant Sword
    { at: first + BLOCK, rows: INNER, weapon: 7415, bonk: true, effect: { n: 'exori', id: 10, f: 8 } }, // Cranial Basher
    { at: first + BLOCK + BASHER_LEN, rows: KNIGHT_AXE, weapon: 3320, bonk: true, effect: { ...SCENE_FX.groundshaker } } // Fire Axe
  ];
  // The Knight's Exori cooldown bar, which the game always shows above it (it fills over the cooldown: 8s, 3s with the axe, full = ready). The Giant Sword block starts with it EMPTY (on cooldown);
  // the kill resets it: it fills in 3 ticks, then the reset Exori empties it again and the 8s fill starts. The other weapon blocks start ready.
  const COOL = SCENE_BAR.cool;
  const jump = (ms, from, to) => [[ms, from, COOL], [ms + 1, to, COOL]];
  const cooldownBar = [[0, 0, COOL], [firstAt, 0, COOL], [first, 1, COOL], ...jump(first, 1, 0),
    [blocks[1].at - 400, (BLOCK - 400) / 8000, COOL], ...jump(blocks[1].at - 399, (BLOCK - 400) / 8000, 1), ...jump(blocks[1].at - 1, 1, 0),
    [blocks[2].at - 400, (BASHER_LEN - 400) / 8000, COOL], ...jump(blocks[2].at - 399, (BASHER_LEN - 400) / 8000, 1), ...jump(blocks[2].at - 1, 1, 0), [blocks[2].at + 3000, 1, COOL]]
    .filter((k, i, all) => i === 0 || k[0] >= all[i - 1][0]);
  const inside = (rows) => { const area = sceneArea(rows).map((t) => t.join(',')); return enemies.filter((e) => area.includes(e.join(',')) && e.join(',') !== killed.join(',')); };
  return {
    ...sceneSelf(), gridHalf: 3,
    mates: enemies.map(([dx, dy]) => ({ id: 119, dx, dy, facing: 'west', ...(dx === killed[0] && dy === killed[1] ? { dies: { at: firstAt } } : {}) })),
    numbers: [sceneDmg(firstAt, killed, 'physical', true), sceneDmg(attack2, target2, 'physical', true), ...blocks.flatMap((b) => inside(b.rows).map(([dx, dy]) => sceneDmg(b.at, [dx, dy], 'zombie', false, 'magic'))),
      ...inside(blocks[1].rows).map(() => sceneHeal(blocks[1].at, 'self', true))],
    flashes: blocks.map((b) => ({ at: b.at, ms: 700, tiles: sceneArea(b.rows) })),
    overlays: [{ kind: 'bonk', id: blocks[0].weapon, dx: killed[0], dy: killed[1] - 1, at: firstAt }, { kind: 'bonk', id: blocks[0].weapon, dx: target2[0], dy: target2[1] - 1, at: attack2 },
      ...blocks.filter((b) => b.bonk).flatMap((b) => inside(b.rows).map(([dx, dy]) => ({ kind: 'bonk', id: b.weapon, dx, dy: dy - 1, at: b.at })))],
    passives: blocks.map((b, i) => { const end = (blocks[i + 1] ? blocks[i + 1].at : b.at + BLOCK) - SHOW; return { windows: [[b.at - SHOW, end]], equip: { spriteId: b.weapon, stat: 'ad', tiers: [{ tier: 5, from: b.at - SHOW, until: end }] } }; }),
    // the Cranial Basher: each creature its Exori hits is stunned for 3s (the stun bar, `magicSparkle` three times) and the Knight is stunned too (5s at tier 5), healing
    // 20 + 8% of its max HP for every stun
    noCooldownBar: true,
    bars: [{ at: 0, until: blocks[2].at + 3000 + 800, on: 'self', y: -2, smooth: true, levels: cooldownBar }],
    stuns: [...inside(blocks[1].rows).map(([dx, dy]) => ({ at: blocks[1].at, ms: 3000, on: [dx, dy], shake: false })), { at: blocks[1].at, ms: 5000, on: 'self', shake: false, y: -6 }],
    holdMs: blocks[2].at + 2000,
    fx: [...blocks.map((b) => ({ ...b.effect, tiles: sceneArea(b.rows), at: b.at })), { ...SCENE_FX.bleed, tiles: [killed], at: firstAt }, { ...SCENE_FX.bleed, tiles: [target2], at: attack2 },
      ...inside(blocks[1].rows).flatMap(([dx, dy]) => [0, 1000, 2000].map((d) => ({ ...SCENE_FX.magicSparkle, tiles: [[dx, dy]], at: blocks[1].at + d, ms: 1000 }))),
      ...[0, 1000, 2000, 3000, 4000].map((d) => ({ ...SCENE_FX.magicSparkle, w: 'self', at: blocks[1].at + d, ms: 1000 }))]
  };
}

// Dwarf (barrel of beer; cast range 2): when its target is within 2 it puts a BARREL on a free tile next to the target (and next to itself), gets +30 speed and runs away from it. The barrel
// (item `explodingBarrel`: 64px, 4 frames per 0.2s) fades in over 500ms while it drops in (`translateFromTopElasticSoft`, 600ms), a draining bar (the cooldown colour, 3s) counts it down and it
// EXPLODES after 3s: a blue `splash` (hue-rotate 170) on it, `soup` (hue-rotate 325) on the 3x3 around it, a crit of magic damage (25 + AP, the `stamina-low` colour) to every enemy there. Awakened
// the Dwarf stays at a safe distance of the barrel instead of running away. Here the target is a dead tree with a villain Ti beside it; the barrel stands between the Dwarf and the tree.
function sceneDwarf(awaken) {
  const T = 500;
  const E = T + 3000; // the explosion
  const barrel = [1, 1]; // from the target; the Dwarf casts from [2, 2]
  const area = [[0, 0], ...sceneArea(SCENE_RING)].map(([dx, dy]) => [barrel[0] + dx, barrel[1] + dy]);
  const ti = [2, 0];
  return {
    numbers: [sceneDmg(E, 'target', 'stamina-low', true, 'magic'), sceneDmg(E, { target: ti }, 'stamina-low', true, 'magic')],
    castRange: 2, gridHalf: 4, ...sceneTarget(), noBlood: 1, // the board is wide enough for the Dwarf (it casts from a corner) to run two tiles away
    mates: [sceneTiMate(ti[0], ti[1], 'west', { anchor: 'target' })],
    ...(awaken ? {} : { casterFlee: { at: T, from: [[barrel[0] - 2, barrel[1] - 2]], speedBonus: 30 } }),
    overlays: [{ kind: 'rune', id: 23486, f: 4, loopMs: 200, w: 2, h: 2, anchor: 'target', dx: barrel[0], dy: barrel[1], at: T, ms: E - T, op: 1, fadeMs: 500, dropMs: 600, drop: 'soft' }],
    stuns: [{ at: T, ms: E - T, on: [barrel[0] - 2, barrel[1] - 2], shake: false, color: '#6699ff' }],
    flashes: [{ at: E, ms: 700, tiles: area }],
    holdMs: E + 1200,
    fx: [{ n: 'splash', id: 54, f: 9, tiles: [barrel], at: E, filter: 'hue-rotate(170deg)' }, ...area.map((tile) => ({ n: 'soup', id: 8, f: 8, tiles: [tile], at: E, filter: 'hue-rotate(325deg)' }))]
  };
}

// Dwarf Soldier (the piercing bolts; range 2, awakened 3): its attack IS the ability. It fires three `piercingBolt`s (160ms each): one at the target and one at each of the two tiles next to
// the target on the shooter's side (for a diagonal shot the tile beside it along each axis), and `groundshaker` shakes those tiles 3 ticks later. The target takes its full attack damage, every
// other enemy on the tiles hit (and in the cone back toward the shooter) half of it, physical, no crits. Here two villain Ti stand on the two flank tiles. It attacks every 2s.
function sceneDwarfSoldier(awaken) {
  const R = awaken ? 3 : 2; // the shooter's distance (its range)
  const attacks = [500, 2500];
  const flank = [[1, 0], [0, 1]];
  const tiles = [[0, 0], ...flank];
  return {
    numbers: attacks.flatMap((at) => tiles.map((t) => sceneDmg(at, t[0] === 0 && t[1] === 0 ? 'target' : { target: t }, 'physical'))),
    castRange: R, ...sceneTarget(), noBlood: 1,
    mates: [sceneTiMate(1, 0, 'east', { anchor: 'target' }), sceneTiMate(0, 1, 'south', { anchor: 'target' })],
    flights: attacks.flatMap((at) => tiles.map((to) => ({ shot: { n: 'piercingBolt', id: 24 }, from: [R, R], to, at, ms: 160 }))),
    flashes: attacks.map((at) => ({ at, ms: 500, tiles })),
    holdMs: attacks[1] + 1000,
    fx: attacks.flatMap((at) => [...tiles.map((tile) => ({ ...SCENE_FX.groundshaker, tiles: [tile], at: at + 187.5 })), ...tiles.map((tile) => ({ ...SCENE_FX.bleed, tiles: [tile], at }))])
  };
}

// Dwarf Guard (the stunning axe): it picks the FARTHEST enemy and, the moment it has it, throws an axe (`exoriHurAxe`) that STUNS it for 1s per tile of distance (3 tiles: 3s, the stun bar), with
// `magicSparkle` once per second on the target (and a 250ms shake), and attacks it at once (physical damage). It takes half damage from physical hits dealt from next to it (nothing to draw) and
// regenerates 8% of its missing HP every 2s (the `dwarfregen` chip: nothing to heal while it is unhurt). Awakened the FIRST creature it stuns also gets its range cut to 1: the game's
// `xmasrangedebuff` icon floats above it for 2s (a pulse, then it rises away). Here it stands 3 tiles from its target.
function sceneDwarfGuard(awaken) {
  const T = 500;
  const STUN = 3000; // 1000ms per tile of distance
  return {
    numbers: [sceneDmg(T, 'target', 'physical')],
    castRange: 3, ...sceneTarget(), noBlood: 1,
    flights: [{ shot: { n: 'exoriHurAxe', id: 26 }, from: [3, 3], to: [0, 0], at: T }],
    stuns: [{ at: T, ms: STUN }],
    ...(awaken ? { overlays: [{ kind: 'float', src: 'spells/xmasrangedebuff.png', anchor: 'target', dx: 0, dy: -1, w: 1, h: 1, at: T, inMs: 200, ms: 1750, bobDelay: 300, pulse: true }] } : {}),
    passives: [{ src: 'dwarfregen', windows: [[0, null]] }],
    holdMs: T + STUN + 500,
    fx: [...[0, 1000, 2000].map((d) => ({ ...SCENE_FX.magicSparkle, tiles: [[0, 0]], at: T + d, ms: 1000 })), { ...SCENE_FX.bleed, tiles: [[0, 0]], at: T }]
  };
}

// Dwarf Geomancer (stone shower): it flees from the enemies while casting a stone toss every second (the cooldown bar, ability power purple, fills over it). Each cast works out the CONVEX HULL
// of the free tiles (only its corner tiles: the game scans them with a cross product and drops collinear ones) and puts a stone (items `stone1`..`stone5`, fading in over 300ms while they drop
// in elastically, 500ms) on each hull tile, one per tick; the tiles become obstacles, so the next cast takes the next hull in, until no free tile is left. Every enemy next to a stone as it lands takes
// 10 + 0.5 AD physical damage (the `stamina-low` colour; `fallingStones` on it once per cast). With no hull left the ability recharges (8s, the mana-coloured bar) and 2s later the stones fade out
// (700ms) and the Geomancer heals itself (15 + 1 AP, a crit). Awakened the stones also cancel an enemy's invisibility: here the villain Ti starts INVISIBLE (the game draws the looping `heal`
// effect instead of it); the first stone next to it makes it `poof` and it fades back in. Here a 7x7 board, a villain Ti on its left side; the Geomancer does not run (the stones leave it no room).
function sceneDwarfGeomancer(awaken) {
  const N = 7;
  const TICK = SCENE_TICK_MS;
  const CAST = 1000; // STONE_TOSS_MS
  const AP = SCENE_BAR.ap;
  const MANA = SCENE_BAR.cool;
  const centre = [3, 3];
  const ti = [1, 3];
  const blocked = new Set([centre.join(','), ti.join(',')]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hullOf = (pts) => { // the strict convex hull (collinear tiles dropped), clockwise from the top left
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const half = (list) => { const h = []; list.forEach((q) => { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }); h.pop(); return h; };
    return [...half(p), ...half([...p].reverse())].sort((a, b) => Math.atan2(a[0] - 3, 3 - a[1]) - Math.atan2(b[0] - 3, 3 - b[1]));
  };
  const casts = [];
  let t = 500;
  for (;;) {
    const free = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!blocked.has(x + ',' + y)) free.push([x, y]);
    if (free.length < 2) break;
    const hull = hullOf(free);
    hull.forEach((q) => blocked.add(q.join(',')));
    casts.push({ at: t, tiles: hull });
    t += CAST;
  }
  const empty = t; // the cast that finds no hull: it recharges
  const cleanup = empty + 2000;
  const off = ([x, y]) => [x - centre[0], y - centre[1]];
  const near = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;
  const stoneIds = [1772, 1843, 1845, 1846, 1844];
  let n = 0;
  const stones = casts.flatMap((c) => c.tiles.map((q, k) => ({ tile: q, at: c.at + (k + 1) * TICK, cast: c.at })));
  const hits = stones.filter((st) => near(st.tile, ti));
  const levels = [[0, 1, AP], ...casts.flatMap((c) => [[c.at, 1, AP], [c.at + 1, 0, AP], [c.at + CAST, 1, AP]]), [empty, 1, AP], [empty + 1, 0, MANA], [cleanup + 1700, Math.min(1, (cleanup + 1700 - empty) / 8000), MANA]];
  return {
    numbers: [...hits.map((h) => sceneDmg(h.at, off(ti), 'stamina-low', false, 'physical')), sceneHeal(cleanup, 'self', true)],
    ...sceneBoard(3), noCooldownBar: true,
    mates: [{ id: 119, dx: off(ti)[0], dy: off(ti)[1], facing: 'east', ...(awaken ? { at: hits[0].at } : {}) }], // awakened: invisible until the first stone
    bars: [{ at: 0, until: cleanup + 1700, on: 'self', y: -2, smooth: true, levels: levels.filter((k, i, all) => i === 0 || k[0] >= all[i - 1][0]) }],
    overlays: stones.map((st) => ({ kind: 'rune', id: stoneIds[n++ % stoneIds.length], f: 1, w: 1, h: 1, dx: off(st.tile)[0], dy: off(st.tile)[1], at: st.at, ms: cleanup - st.at, op: 1, outMs: 700 })),
    holdMs: cleanup + 1700,
    flashes: stones.map((st) => ({ at: st.at, ms: 400, tiles: sceneArea(SCENE_RING).map(([x, y]) => [off(st.tile)[0] + x, off(st.tile)[1] + y]).filter(([x, y]) => Math.abs(x) <= 3 && Math.abs(y) <= 3) })), // the tiles next to each stone as it lands
    fx: [...casts.map((c) => hits.find((h) => h.cast === c.at)).filter(Boolean).map((h) => ({ n: 'fallingStones', id: 45, f: 19, tiles: [off(ti)], at: h.at })), { ...SCENE_FX.heal, w: 'self', at: cleanup },
      ...(awaken ? [...Array.from({ length: Math.ceil(hits[0].at / 880) }, (_, i) => ({ ...SCENE_FX.heal, tiles: [off(ti)], at: i * 880 })).filter((e) => e.at < hits[0].at), { ...SCENE_FX.poof, tiles: [off(ti)], at: hits[0].at }] : [])]
  };
}

// Energy Crystal (it cannot be moved): every 3s (the cooldown bar fills over it) it summons a Dwarf Henchman (outfit 500006: 10 HP, speed 105, melee, an attack a second for 10 physical) on a free
// tile of the 3x3 around it, else of the 5x5 ring, as long as fewer than 5 are alive: `heal` on the crystal and `teleportBlue` on the spawn tile. The Henchmen go for the closest enemy. When the
// crystal is destroyed it charges the Earth Crystal and the Magma Crystal (their armor and magic resist drop: nothing to draw here). Here a villain Ti stands two tiles east of the crystal and two
// Henchmen join one after the other (3s apart), hitting it every second.
function sceneEnergyCrystal() {
  const T = 500;
  const EVERY = 3000;
  const ti = [2, 0];
  const spawns = [{ at: T, tile: [1, 0] }, { at: T + EVERY, tile: [1, 1] }];
  const end = T + EVERY + 3000;
  const attacks = spawns.flatMap((sp) => { const out = []; for (let t = sp.at + 1000; t <= end - 500; t += 1000) out.push(t); return out; });
  const COOL = SCENE_BAR.cool;
  return {
    numbers: attacks.map((at) => sceneDmg(at, ti, 'physical')),
    ...sceneBoard(3), noCooldownBar: true,
    mates: [sceneTiMate(ti[0], ti[1], 'west'), ...spawns.map((sp) => ({ outfit: 500006, dx: sp.tile[0], dy: sp.tile[1], facing: 'east', at: sp.at }))],
    bars: [{ at: 0, until: end + 500, on: 'self', y: -2, smooth: true, levels: [[0, 1, COOL], [T, 1, COOL], [T + 1, 0, COOL], [T + EVERY, 1, COOL], [T + EVERY + 1, 0, COOL], [end + 500, Math.min(1, (end + 500 - T - EVERY) / EVERY), COOL]] }],
    holdMs: end + 500,
    fx: [...spawns.flatMap((sp) => [{ ...SCENE_FX.heal, w: 'self', at: sp.at }, { ...SCENE_FX.teleportBlue, tiles: [sp.tile], at: sp.at }]),
      ...attacks.map((at) => ({ ...SCENE_FX.bleed, tiles: [ti], at }))]
  };
}

// Magma Crystal (it cannot be moved; every 10s, the cooldown bar fills over it): `avatarPoof` on the crystal, then 14 ticks (875ms) later it fires at EVERY visible creature on the board, enemy or
// ally, in order of angle around it, one per tick: a `fire` missile, the crystal flinches (100ms) and the creature takes 50% of its CURRENT HP as true damage (a crit, the `fire` colour; silent)
// with a `largeFireExplosion` on it. Here two villain Ti and an ally stand around it.
function sceneMagmaCrystal() {
  const T = 500;
  const WAIT = 14 * 62.5;
  const targets = [[3, 0], [0, 2], [-2, -2]]; // east, south, north-west: the order of the sweep
  const strikes = targets.map((tile, k) => ({ tile, at: T + WAIT + (k + 1) * 62.5 }));
  return {
    numbers: strikes.map((st) => sceneDmg(st.at, st.tile, 'fire', true, 'true')),
    ...sceneBoard(3),
    mates: [sceneTiMate(3, 0, 'west'), { dx: 0, dy: 2, facing: 'north' }, sceneTiMate(-2, -2, 'south')],
    flights: strikes.map((st) => ({ shot: { n: 'fire', id: 4 }, from: [0, 0], to: st.tile, at: st.at })),
    holdMs: strikes[strikes.length - 1].at + 1500,
    fx: [{ n: 'avatarPoof', id: 244, f: 11, w: 'self', at: T }, ...strikes.map((st) => ({ ...SCENE_FX.largeFireExplosion, b: 1, tiles: [st.tile], at: st.at }))]
  };
}

// Rorc (hit and run): a state machine. It CHASES its target at its own speed (150) until it is next to it, and its attack (every 4s: the ability IS the attack cooldown) is a crit of physical damage (silent), which STUNS
// the target for 1.5s (`groundshaker` on it, the stun bar) and heals Rorc (60% lifesteal + 0.25% per AP of the damage, a crit heal above 50). Right after the hit it FLEES from every enemy at +100 speed until the attack is ready
// again (`raiseStat` hue-rotated 305 and a 500ms brightness pulse), then picks the next target and chases it. Awakened the hit also splashes 10% of its damage on every creature next to the target (`groundshaker` at half
// opacity on the 8 tiles), which counts for the lifesteal. Here Rorc starts three tiles east of a villain Ti, runs two tiles to it, hits it and runs back two tiles.
function sceneRorc(awaken) {
  const T = 500;
  const START = [3, 0]; // Rorc starts three tiles east of the middle, where the target stands
  const SPEED = 150;
  const run = walkStepMs(SPEED);
  const hit = T + 2 * run; // it arrives next to the target and attacks
  const ring = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  const ti = [0, 1]; // beside the target (awakened: hit by the splash)
  const at = [1, 0]; // where Rorc stands when it hits (from the middle)
  return {
    numbers: [sceneDmg(hit, { target: [0, 0] }, 'physical', true), sceneHeal(hit, 'self', true), ...(awaken ? [sceneDmg(hit, { target: ti }, 'physical')] : [])],
    ...sceneSelf(), noBlood: 1, gridHalf: 4, casterOffset: START, baseSpeed: SPEED, cooldownCastAt: hit, casterFacing: 'west',
    casterFlee: { at: T, steps: [[-1, 0, 0], [-1, 0, 0], [1, 0, 100], [1, 0, 100]] },
    casterFilter: [[0, 'brightness(1)'], [hit, 'brightness(1)'], [hit + 250, 'brightness(2)'], [hit + 500, 'brightness(1)']],
    stuns: [{ at: hit, ms: 1500, on: [-START[0], -START[1]] }],
    mates: [sceneTiMate(0, 0, 'east', { anchor: 'target' }), ...(awaken ? [sceneTiMate(ti[0], ti[1], 'north', { anchor: 'target' })] : [])],
    holdMs: hit + 2400,
    ...(awaken ? { flashes: [{ at: hit, tiles: ring }] } : {}), // the awakened splash area
    fx: [{ ...SCENE_FX.groundshaker, tiles: [[0, 0]], at: hit }, { ...SCENE_FX.raiseStat, tiles: [at], at: hit, filter: 'hue-rotate(305deg)' }, { ...SCENE_FX.bleed, tiles: [[0, 0]], at: hit },
      ...(awaken ? ring.map((tile) => ({ ...SCENE_FX.groundshaker, tiles: [tile], at: hit, opacity: 0.5 })) : [])]
  };
}

// Willi Wasp (the decoy): it TAUNTS every enemy (each one's taunt icon) so they all go for it, and runs away from them at speed 220, trying to keep them busy. A glow (a round, yellow `boosted`
// radial light, zooming in over 300ms) sits on it. While it is alive every OTHER Wasp on the battlefield is INVINCIBLE (the `wasphoney` chip, an earth-coloured bar: it takes no damage). Here two villain Ti
// are taunted at the start, a Wasp ally stands near and Willi runs.
function sceneWilliWasp() {
  const T = 500;
  const enemies = [[2, 0], [-2, 1]];
  return {
    ...sceneBoard(3),
    casterFlee: { at: T + 500, steps: [[0, 1], [0, 1], [1, 0], [1, 0]] }, // away from both Ti, south and then east: an explicit path so it never runs through the Wasp ally standing north of it
    mates: [...enemies.map(([dx, dy]) => ({ id: 119, dx, dy, facing: dx > 0 ? 'west' : 'east' })), { id: 6, dx: 0, dy: -2, facing: 'south' }],
    statusIcons: enemies.map((e, i) => sceneTaunt(T + i * 62.5, e)),
    overlays: [{ kind: 'glow', range: 0.45, color: '#f8c810', at: T - 300 }],
    passives: [{ src: 'wasphoney', windows: [[0, null]] }],
    holdMs: T + 2500,
    fx: []
  };
}

// Corym Charlatan (the snatcher): it goes for enemies that carry equipment. Its attack hits as usual and, when it has room for one (no equipment, or awakened), SNATCHES the target's first piece: it
// shouts "Yoink!", `smoothSlap` hits the target for a crit of magic damage (20 + 2 AP) and the equipment moves to the Charlatan (here the chip appears on it). Holding one, its Exori-like cooldown
// (9s; the preview runs it at half length, 4.5s) turns into a draining bar (ability power purple); when it runs out it EATS the equipment: a squash (`yum`), "Yummy!" and a crit heal of 20 + 1 AP, and the bar starts over (the cooldown
// colour, filling). Awakened it can hold equipment AND go on snatching: it never eats it, and every time the cooldown is ready its next hit takes another piece (the bar empties again and refills). Here a villain Ti
// with an item is the target; awakened a SECOND villain Ti with an item (a creature carries one piece) stands beside the Charlatan and it takes that one when the cooldown is up.
function sceneCorymCharlatan(awaken) {
  const T = 500;
  const CD = 4500; // the preview runs the 9s cooldown at half length (the real one is 9s)
  const EAT = T + CD;
  const AP = SCENE_BAR.ap;
  const COOL = SCENE_BAR.cool;
  const ITEM = 3057;
  const SECOND = T + 62.5 + CD; // awakened: the cooldown is up again, the next hit snatches the second item
  const ITEM2 = 3049;
  const SECOND_TI = [1, -1]; // from the target tile: the tile north of the Charlatan (which stands east of the first Ti)
  const end = awaken ? SECOND + 1800 : EAT + 1800;
  return {
    numbers: [sceneDmg(T, 'target', 'physical'), sceneDmg(T + 62.5, 'target', 'magic', true), ...(awaken ? [sceneDmg(SECOND - 62.5, { target: SECOND_TI }, 'physical'), sceneDmg(SECOND, { target: SECOND_TI }, 'magic', true)] : [sceneHeal(EAT, 'self', true)])],
    ...sceneTarget(), noBlood: 1, noDummy: true, noCooldownBar: true,
    mates: [sceneTiMate(0, 0, 'east', { anchor: 'target' }), ...(awaken ? [sceneTiMate(SECOND_TI[0], SECOND_TI[1], 'south', { anchor: 'target' })] : [])],
    overlays: [{ kind: 'say', text: 'Yoink!', dx: 0, dy: 0, at: T + 62.5, ms: 1500, size: 12 }, ...(awaken ? [{ kind: 'say', text: 'Yoink!', dx: 0, dy: 0, at: SECOND, ms: 1500, size: 12 }] : [{ kind: 'say', text: 'Yummy!', dx: 0, dy: 0, at: EAT + 1000, ms: 1500, size: 12 }])],
    passives: [{ right: true, windows: [[T + 62.5, awaken ? null : EAT + 300]], equip: { spriteId: ITEM, stat: 'hp', tiers: [{ tier: 5, from: T + 62.5, until: awaken ? null : EAT + 300 }] } },
      ...(awaken ? [{ right: true, windows: [[SECOND, null]], equip: { spriteId: ITEM2, stat: 'hp', tiers: [{ tier: 5, from: SECOND, until: null }] } }] : [])],
    // The ability is ready at the start, so like every ability the loop starts with 1s of cooldown left (the scene moves 0.5s later as a whole: 1.06s to the snatch) and the bar fills to ready as it snatches. The
    // snatch starts the 9s cooldown (equipping it): holding the item the bar DRAINS (ability power purple) until it eats; awakened it never eats, the bar is the normal cooldown, filling, and the next snatch waits for it.
    bars: [{ at: 0, until: end, on: 'self', y: -2, smooth: true, levels: awaken
      ? [[0, 1 - 1062.5 / CD, COOL], [T + 62.5, 1, COOL], [T + 63.5, 0, COOL], [SECOND, 1, COOL], [SECOND + 1, 0, COOL], [end, Math.min(1, (end - SECOND) / CD), COOL]]
      : [[0, 1 - 1062.5 / CD, COOL], [T + 62.5, 1, COOL], [T + 63.5, 1, AP], [EAT, 0, AP], [EAT + 1, 0, COOL], [end, Math.min(1, (end - EAT) / CD), COOL]] }],
    holdMs: end,
    fx: [{ n: 'smoothSlap', id: 213, f: 18, tiles: [[0, 0]], at: T + 62.5 }, { ...SCENE_FX.bleed, tiles: [[0, 0]], at: T },
      ...(awaken ? [{ n: 'smoothSlap', id: 213, f: 18, tiles: [SECOND_TI], at: SECOND }, { ...SCENE_FX.bleed, tiles: [SECOND_TI], at: SECOND - 62.5 }] : [])]
  };
}

// The Percht Queen (the event boss; it cannot be moved): its cooldown bar starts EMPTY (the first cast waits the whole cooldown: 6s minus 0.25s per floor, at least 2s) and when it is ready it summons
// 1 creature (2 from floor 6, 3 from floor 11) on random free tiles around it, each picked at random from the Frost Troll, the Yeti, the Winter Wolf and the Polar Bear and holding a tier-5 weapon or
// armor (the first three): `teleportBlue` on each tile. The summons are shown fading in as they land and `poof` when they die. After a cast the cooldown is 20% longer per summon still alive.
// Here floor 12: a 3s cooldown and three summons (a Frost Troll, a Yeti and a Winter Wolf).
function scenePerchtQueen() {
  const WAIT = 3000; // 6000 - 12 * 250
  const T = WAIT;
  const summons = [{ id: 31, tile: [-2, -1] }, { id: 80, tile: [2, 1] }, { id: 32, tile: [1, -2] }];
  const next = Math.round(WAIT * (1 + 0.2 * summons.length));
  const end = T + 2200;
  const COOL = SCENE_BAR.cool;
  return {
    ...sceneBoard(3), noCooldownBar: true,
    mates: summons.map((sm) => ({ id: sm.id, dx: sm.tile[0], dy: sm.tile[1], facing: 'south', at: T })),
    bars: [{ at: 0, until: end, on: 'self', y: -2, smooth: true, levels: [[0, 0, COOL], [T, 1, COOL], [T + 1, 0, COOL], [end, (end - T) / next, COOL]] }],
    holdMs: end,
    fx: summons.map((sm) => ({ ...SCENE_FX.teleportBlue, tiles: [sm.tile], at: T }))
  };
}

// Old Giant Spider (the cocoon; range 99 so it casts from afar): it wraps its target in a cocoon every 8s (the cooldown bar): the target takes a crit of magic `earth` damage (10 + 2 AP),
// is STUNNED for 3s (the stun bar), gets +100 armor for 5s and webs (the Spider's `spiderWebCenter` / `spiderWeb0-3` items, fading out at the end of the 5s) cover its tile and the four beside it.
// Every spider ally has +30% attack speed (a red glow, not drawn) and the Old Giant Spider heals from the magic damage its spider allies deal. Here it stands 3 tiles from the target.
function sceneOldGiantSpider() {
  const T = 500;
  const LAND = T + 210; // the earth missile's flight from three tiles out (the Spider's web lands at 710)
  const WEB = 5000;
  return {
    numbers: [sceneDmg('land', 'target', 'earth', true, 'magic')],
    // the web is thrown first: an `earthSpell` missile, then `earthSpinningRoots` on the target, which goes grey over the 5s (`spiderGrayscale`: 10% in, 10% out) as the webs lie on its tile and the four beside it
    castRange: 3, m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [{ n: 'earthSpell', id: 30 }], lead: T, cooldownCastAt: T,
    dummyTint: { at: LAND, until: LAND + WEB, filter: 'grayscale(1)', ramp: WEB / 10 }, stuns: [{ at: LAND, ms: 3000, shake: false }], passives: [{ src: 'spidervictim', windows: [[LAND, LAND + WEB]] }], // the cocoon's chip: stunned and +100 armor
    overlays: sceneWebs(LAND, WEB),
    holdMs: LAND + WEB + 200,
    fx: [{ n: 'earthSpinningRoots', id: 55, f: 14, b: 1 }]
  };
}

// Corym Vanguard (the squeak): its counter goes up with HITS, not with time. Every hit it would take for 22 damage or less (before mitigation it is the damage after armor / resist; awakened also any hit of
// 140 or more) is IGNORED: it does nothing, the Vanguard heals 5 + 0.1 AP a tick later (silent) and the endurance counter (the `minoshield` bar over it, green, and its chip) goes up one. At 20 it SQUEAKS at once
// (the next tick: "Squeeeeeeak!", `corymVanguardFx`), resets the counter and, two ticks later, hits every creature next to it (and its target) for 1 + 0.5 AD physical. Here a villain Ti beside it has already landed 18
// ignored hits (the counter starts at 18/20); its next two arrows are ignored (19, 20) and the squeak follows the second. The `corymVanguardFx` effect has no sheet of its own in the game's stylesheet, so it is not drawn.
function sceneCorymVanguard() {
  const T = 500;
  const SHOTS = [T, T + 1500]; // the Ti's arrows (its attack delay): each one is an ignored hit
  const land = SHOTS.map((at) => at + SCENE_MISSILE_MS);
  const burst = land[1] + SCENE_TICK_MS; // the next tick after the 20th stack
  const GREEN = '#60c060';
  const ti = [1, 0];
  return {
    numbers: [sceneDmg(burst + 2 * SCENE_TICK_MS, ti, 'physical')],
    // an ignored hit shows NO number (0 damage) but the game still plays a `poof` on the Vanguard (the effect for a 0 physical hit) and its `hp.bleed` leaves blood on the floor
    bleeds: land.map((at) => ({ at, on: 'self' })),
    ...sceneBoard(2), noCooldownBar: true, noAutoAttack: true,
    mates: [sceneTiMate(ti[0], ti[1], 'west')],
    flights: SHOTS.map((at) => ({ shot: SCENE_VILLAIN_TI.shot, from: ti, to: [0, 0], at })),
    bars: [{ at: 0, until: burst + 1800, on: 'self', y: 0, levels: [[0, 18 / 20, GREEN], [land[0], 19 / 20, GREEN], [land[1], 1, GREEN], [burst, 0, GREEN]] }],
    passives: [{ src: 'minoshield', counts: [{ at: 0, n: 18 }, { at: land[0], n: 19 }, { at: land[1], n: 20 }, { at: burst, n: 0 }] }],
    overlays: [{ kind: 'say', text: 'Squeeeeeeak!', dx: 0, dy: 0, at: burst, ms: 1500, size: 16, color: '#ffffff' }],
    holdMs: burst + 1800,
    flashes: [{ at: burst + 2 * SCENE_TICK_MS, tiles: sceneArea(SCENE_RING) }], // the burst area
    fx: land.map((at) => ({ ...SCENE_FX.poof, w: 'self', at }))
  };
}

// Grynch Clan Commander (the muster): 1s into the battle, then every 12s (the cooldown bar: it starts empty), it summons Goblin Gumslingers (level 5, the event variant) on every free tile of the
// two rows two tiles above and below the middle of the board (9 tiles each), one per tick from the top left: `teleportPurple` on each tile (5% of them `teleportBlue` and shiny). It also pins its own
// side's other creatures in place after two ticks (their speed is capped: nothing to draw). Here the two rows of nine appear one after the other (18 summons).
function sceneGrynchCommander() {
  const T = 1000;
  const TICK = SCENE_TICK_MS;
  const tiles = [];
  [-2, 2].forEach((dy) => { for (let dx = -4; dx <= 4; dx++) tiles.push([dx, dy]); });
  const COOL = SCENE_BAR.cool;
  const end = T + tiles.length * TICK + 2500;
  return {
    ...sceneBoard(4), noCooldownBar: true,
    mates: tiles.map((tile, i) => ({ id: 85, dx: tile[0], dy: tile[1], facing: 'south', at: T + (i + 1) * TICK })),
    bars: [{ at: 0, until: end, on: 'self', y: -2, smooth: true, levels: [[0, 0, COOL], [T, 1, COOL], [T + 1, 0, COOL], [end, (end - T) / 12000, COOL]] }],
    holdMs: end,
    fx: tiles.map((tile, i) => ({ n: 'teleportPurple', id: 222, f: 11, tiles: [tile], at: T + (i + 1) * TICK }))
  };
}

// Bonelord (the book of refresh; it flees from enemies): it only casts when an ally that wears the Bonelord's helmet has an ability on cooldown (cooldown 11s, 6s at first). It then reads (`bookMagicFast`
// on it, twice the size, a dark shadow), every ally with the helmet gets its running cooldown REFRESHED (`cooldownRefresh` on it: awakened also its equipment's) and the Bonelord heals 10 + 0.2 AP per
// refreshed ally (a crit). Here two such allies (their cooldown bars fill, then jump to full at the refresh) and a villain Ti far off that it runs away from.
function sceneBonelord() {
  const T = 500;
  const allies = [[2, 0], [-2, 1]];
  const COOL = SCENE_BAR.cool;
  const end = T + 2500;
  return {
    numbers: [sceneHeal(T, 'self', true)],
    ...sceneBoard(3), cooldownCastAt: T,
    casterFlee: { at: T, from: [[0, -3]] },
    mates: [...allies.map(([dx, dy]) => ({ dx, dy, facing: 'south' })), sceneTiMate(0, -3, 'south')],
    bars: allies.map((tile) => ({ at: 0, until: end, on: tile, y: -2, smooth: true, levels: [[0, 0.2, COOL], [T, 0.45, COOL], [T + 1, 1, COOL], [end, 1, COOL]] })),
    holdMs: end,
    fx: [{ n: 'bookMagicFast', id: 297, f: 19, w: 'self', at: T, filter: 'drop-shadow(0 0 5px #00000090)', z: 2 }, ...allies.map((tile) => ({ n: 'cooldownRefresh', id: 232, f: 14, tiles: [tile], at: T }))]
  };
}

// Dharalion (the mass sacrifice; range 4): the Elf Arcanist's ritual taken to the extreme. When it can cast it channels for 3.5s facing north (the `energy` channel bar, the floating book, the
// `glowingCircle`): ALL its allies are STUNNED meanwhile (their stun bars, grey, candles around each). Then every one of them is sacrificed (an `sd` missile and 6666 true damage, dark red, `blackSmoke`)
// and Dharalion alone gets the buff: `bats`, a grey tint with a crimson glow, the `redWhirlpool` aura and the `deathbuff` chip, healing 4 per AP every 1.5s (silent). Here two allies are sacrificed.
function sceneDharalion() {
  const T = 500;
  const RITUAL = 3500;
  const CAST = T + RITUAL;
  const victims = [[-2, 0], [2, 1]];
  const candles = victims.flatMap(([vx, vy]) => [[0, -1], [0, 1], [-1, 0], [1, 0]].map(([dx, dy]) => ({ kind: 'fade', id: 43702, f: 4, loopMs: 400, w: 2, h: 2, dx: vx + dx, dy: vy + dy, at: T, fadeMs: 300, outAt: CAST - 350, outMs: 300 })));
  return {
    numbers: victims.map((v) => sceneDmg(CAST, v, 'hpBlack', true, 'true')), ...sceneSelf(), noDummy: true, gridHalf: 3, casterFacing: 'north',
    mates: victims.map(([dx, dy]) => ({ dx, dy, dies: { at: CAST }, tint: { at: T, until: CAST, filter: 'grayscale(0.9)', ramp: 355 } })),
    casterFilter: [[0, 'grayscale(0)'], [CAST, 'grayscale(0)'], [CAST + 400, 'grayscale(0.9) drop-shadow(0 0 5px #dc143c)']],
    stuns: victims.map((v) => ({ at: T, ms: RITUAL, on: v, shake: false })),
    bars: [{ at: T, ms: RITUAL, on: 'self', color: '#cc33ff' }],
    overlays: [...candles, { kind: 'float', id: 43705, f: 4, loopMs: 400, w: 2, h: 2, dx: 0, dy: -1, at: T, ms: RITUAL },
      { kind: 'aura', id: 23483, f: 15, loopMs: 1500, dx: 0, dy: 0, at: CAST, fadeMs: 1000, op: 0.8, filter: 'grayscale(1) brightness(0.5)' }],
    flights: victims.map((v) => ({ shot: { n: 'sd', id: 32 }, from: [0, 0], to: v, at: CAST })),
    passives: [{ src: 'deathbuff', windows: [[CAST, null]] }], holdMs: CAST + 3000,
    fx: [...[0, 1100, 2200].map((d) => ({ ...SCENE_FX.glowingCircle, w: 'self', at: T + d })),
      ...victims.map((v) => ({ n: 'blackSmoke', id: 158, f: 7, tiles: [v], at: CAST })), { ...SCENE_FX.bats, w: 'self', at: CAST }]
  };
}

// Thalas (the hook; every 9s, the first after 4s): it hooks its FARTHEST enemy (one that cannot be displaced is skipped) and PULLS it to the free tile next to itself: the target is moved there at a speed of 165 (the
// game's `walkTo`; the hook ADDS a flat 165 to the target's own speed: it brings its speed modifiers up to 165, so a Ti of speed 100 is pulled at 265), drawn over the others (z-index 999) while six grey `thalasArrow`s (the `thalas-missile` sheet, 60% opacity) follow its path from where it stood to the landing tile, each a tick quicker than the
// last, and a HAND (`thalasHandRight` / `thalasHandDown`: 15 frames, played once over the pull and the stun, fading in over 100ms and out over the last 300ms) reaches from the landing tile. When it lands the target takes a crit
// of magic damage (10 + 0.7 AP, silent); if it was 4 or more tiles away (and does not ignore stuns) it is also STUNNED for the whole pull plus 500ms, and lands with a `poof`, a hop (`bounceJump`, 500ms) and a shake
// (`shaking`, 100ms). Thalas cannot move meanwhile. Awakened the cooldown is only 3s when the target is already next to it. The pull is ONE `walkTo` jump: the target glides the whole way in a single step's time (about 0.3s at speed 265), so it is nearly instant. Here a villain Ti 4 tiles east is pulled across three tiles.
function sceneThalas() {
  const T = 500;
  const speed = SCENE_TI_SPEED + 165; // the target's own speed plus the hook's flat 165 (a function that runs at load cannot read the game's data)
  const stepMs = walkStepMs(speed);
  const pull = stepMs; // `walkTo` is ONE jump to the landing tile: a single step's glide, however far
  const arrive = T + pull;
  const STUN = 500;
  return {
    numbers: [sceneDmg(arrive, [1, 0], 'magic', true)],
    ...sceneBoard(4), cooldownCastAt: T, casterFacing: 'east',
    mates: [{ id: 119, dx: 4, dy: 0, facing: 'west', walk: { at: T, speed, steps: [[-3, 0]] }, hop: { at: arrive, ms: 500, shakeMs: 100 } }],
    flights: Array.from({ length: 6 }, (_, i) => ({ shot: { n: 'thalasArrow', id: 50001, src: 'misc/thalas-missile.png', filter: 'grayscale(1) opacity(0.6)' }, from: [4, 0], to: [1, 0], at: T, ms: pull - i * SCENE_TICK_MS })),
    overlays: [{ kind: 'fade', id: 999979, f: 15, loopMs: pull + STUN, w: 1, h: 2, dx: 1, dy: 0, at: T, fadeMs: 100, outAt: arrive + STUN - 300, outMs: 300, ease: 'linear' }],
    stuns: [{ at: T, ms: pull + STUN, on: [4, 0], shake: false }],
    holdMs: arrive + STUN + 1200,
    fx: [{ ...SCENE_FX.poof, tiles: [[1, 0]], at: arrive }]
  };
}

// Ancient Scarab (the eternal beetle): its attack is a CRIT that also DISPLACES the target one tile (a 300ms `slash` and a `poof` on it; the displaced creature is sped up for the move). When it
// DIES a Larva (outfit 82, speed 45: a step takes 2.1s) appears on the farthest free tile and crawls to the corpse; beside it, it CHARGES for 2s (the `glowingCircle` loops on the Larva, the `charging`
// star over the corpse, a bar over the Larva) and then REVIVES the Scarab: `holyAttack` on it and a crit heal of 25 + 2 AP. If the Larva is killed, stunned, pushed or silenced first it fails (`poof`).
// Awakened the one that comes is a full Scarab (outfit 83, 800 HP) instead of the Larva. Here the Scarab pushes a villain Ti, is shot dead by a second one and is brought back.
function sceneAncientScarab(awaken) {
  const T = 500;
  const LARVA_STEP = walkStepMs(45);
  const DEATH = 2500;
  const larvaFrom = [-1, -3];
  const larvaSteps = [[0, 1], [0, 1]];
  const arrive = DEATH + larvaSteps.length * LARVA_STEP;
  const REVIVE = arrive + 2000;
  const COOL = SCENE_BAR.cool;
  const end = REVIVE + 1500;
  return {
    numbers: [sceneDmg(T, [1, 0], 'physical', true), sceneDmg(DEATH, 'self', 'fire'), sceneHeal(REVIVE, 'self', true)],
    ...sceneBoard(3), casterFacing: 'east',
    attacker: { ...SCENE_VILLAIN_TI, dx: 0, dy: 3, aim: [0, 0], at: DEATH - SCENE_MISSILE_MS },
    mates: [{ id: 119, dx: 1, dy: 0, facing: 'west', walk: { at: T, speed: 250, steps: [[1, 0]] } },
      { outfit: awaken ? 83 : 82, dx: larvaFrom[0], dy: larvaFrom[1], facing: 'south', at: DEATH, walk: { at: DEATH, speed: 45, steps: larvaSteps } }],
    transform: { at: DEATH, until: REVIVE, fade: 200, corpse: 4185 },
    bars: [{ at: arrive, ms: 2000, on: [larvaFrom[0] + larvaSteps.reduce((x, st) => x + st[0], 0), larvaFrom[1] + larvaSteps.reduce((y, st) => y + st[1], 0)], color: COOL, fill: true }],
    holdMs: end,
    fx: [{ n: 'slash', id: 216, f: 6, tiles: [[1, 0]], at: T, ms: 300 }, { ...SCENE_FX.poof, tiles: [[1, 0]], at: T }, { ...SCENE_FX.moe, w: 'self', at: DEATH },
      { n: 'musicNotesGreen', id: 19, f: 11, w: 'self', at: DEATH },
      ...[0, 1100].map((d) => ({ ...SCENE_FX.glowingCircle, tiles: [[-1, -1]], at: arrive + d })), { ...SCENE_FX.charging, w: 'self', at: arrive, ms: 700 }, { ...SCENE_FX.charging, w: 'self', at: arrive + 700, ms: 700 }, { ...SCENE_FX.charging, w: 'self', at: arrive + 1400, ms: 700 },
      { n: 'holyAttack', id: 50, f: 25, w: 'self', at: REVIVE }]
  };
}

// Vladrukh (the conversion; it takes at most 5 damage from a hit; the first cast after 4s, then every 9s): it picks the CLOSEST enemy that can change sides, `bats` on itself and a `pinchingHand` (a red
// shadow) on the target, which it stuns for 8 ticks (500ms, forced). Then the target is CONVERTED to its side: it shakes (a 150ms hard shake), `bats` play on it and it becomes an ally (the
// cooldown starts and every enemy forgets its target). Awakened the converted creature is also made INVISIBLE (the looping `heal` effect instead of it). Here a villain Ti beside it is converted.
function sceneVladrukh(awaken) {
  const T = 500;
  const SWAP = T + 500;
  const ti = [2, 0];
  return {
    ...sceneBoard(3), cooldownCastAt: SWAP, casterFacing: 'east',
    mates: [{ id: 119, dx: ti[0], dy: ti[1], facing: 'west', dies: { at: SWAP, corpse: false } }, ...(awaken ? [] : [{ dx: ti[0], dy: ti[1], facing: 'west', at: SWAP }])],
    stuns: [{ at: T, ms: 500, on: ti, shake: false }],
    holdMs: SWAP + 2500,
    fx: [{ ...SCENE_FX.bats, w: 'self', at: T }, { n: 'pinchingHand', id: 210, f: 6, tiles: [ti], at: T, filter: 'drop-shadow(4px 4px 5px red)' }, { ...SCENE_FX.bats, tiles: [ti], at: SWAP },
      ...(awaken ? sceneInvisibleLoops(SWAP, 3, { tiles: [ti] }) : [])]
  };
}

// Cyclops Drone (the seismic jump; every 7s, 5s attack delay): it picks its FARTHEST enemy and jumps to the free tile next to it that has the most enemies around (a squash, a 1s bounce at +300
// speed; when that tile is its own it bounces on the spot), and halfway (500ms) lands with `groundshaker` (twice the size): every enemy around it, and its target, takes a crit of magic damage (10 + 0.6 AP, silent),
// is STUNNED (500ms and the trip) and PUSHED straight away from it at speed 1360 until something blocks it (`poof` where it stops; one pushed 3 or more tiles hops instead of shaking). Awakened, hitting 3 or more
// enemies HALVES the cooldown (the pushed creatures shake where they stop, `--shake` 4 for 125ms, a push of 3 or more tiles hops instead; it is set to half its length: the bar refills over 3.5s instead of 7s; `cooldownScale`). Here the Drone starts two tiles east of the middle of a compact 9x9 board, jumps to the middle and pushes three villain Ti two tiles.
function sceneCyclopsDrone(awaken) {
  const T = 500;
  const LAND = T + 500;
  const pushStep = walkStepMs(1360);
  const START = [2, 0]; // the Drone starts two tiles east of the middle (tile 84) and jumps to the middle, next to the Ti
  const ti = [[-1, 0], [-1, -1], [-1, 1]]; // from the middle of the board
  const dirs = [[-1, 0], [-1, -1], [-1, 1]];
  const arrive = LAND + 2 * pushStep;
  return {
    numbers: ti.map((tile) => sceneDmg(LAND, { target: tile }, 'magic', true)),
    ...sceneSelf(), gridHalf: 4, casterOffset: START, noBlood: 1, cooldownCastAt: LAND, ...(awaken ? { cooldownScale: 0.5 } : {}),
    casterFlee: { at: T, steps: [[-1, 0], [-1, 0]], speedBonus: 300 }, casterJump: { at: T }, // it falls onto the new tile (the game's squash-factor animation, 1s)
    mates: ti.map(([dx, dy], i) => ({ id: 119, anchor: 'target', dx, dy, facing: 'east', walk: { at: LAND, speed: 1360, steps: [dirs[i], dirs[i]] }, shake: { at: arrive, factor: 4, ms: 125 } })),
    stuns: ti.map(([dx, dy], i) => ({ at: arrive, ms: 600, on: [dx + 2 * dirs[i][0] - START[0], dy + 2 * dirs[i][1] - START[1]], shake: false })),
    // every enemy on the 8 tiles around the landing tile is hit (and pushed): the area lights with the landing
    flashes: [{ at: LAND, ms: 800, tiles: sceneArea(SCENE_RING) }],
    holdMs: arrive + 2500,
    fx: [{ ...SCENE_FX.groundshaker, tiles: [[0, 0]], at: LAND, z: 2, tx: 0.25, ty: 0.25 }, ...ti.map(([dx, dy], i) => ({ ...SCENE_FX.poof, tiles: [[dx + 2 * dirs[i][0], dy + 2 * dirs[i][1]]], at: arrive }))]
  };
}

// Omruc (lights out; range 4, every 10s, the first after 2s): it makes EVERYONE on the board invisible for 7.5s (`magicPoof` on each, the `omruc` chip): the game draws the looping `heal` effect
// instead of each creature, and a black layer (40%) fades over the whole board (400ms in and out). Its attacks come in pairs: a physical `arrow` then a magic `poisonArrow`.
// Here Omruc, an ally and a villain Ti all vanish.
function sceneOmruc() {
  const T = 500;
  const LONG = 7500;
  const others = [[2, 0], [-2, 1]];
  const heals = (tile) => Array.from({ length: Math.ceil(LONG / 880) }, (_, i) => ({ ...SCENE_FX.heal, ...(tile ? { tiles: [tile] } : { w: 'self' }), at: T + i * 880 })).filter((e) => e.at < T + LONG);
  return {
    ...sceneBoard(3), cooldownCastAt: T, transform: { at: T, until: T + LONG, fade: 200 },
    mates: [{ dx: others[0][0], dy: others[0][1], facing: 'west', dies: { at: T, until: T + LONG, corpse: false } }, { id: 119, dx: others[1][0], dy: others[1][1], facing: 'east', dies: { at: T, until: T + LONG, corpse: false } }],
    overlays: [{ kind: 'dark', dx: 0, dy: 0, at: T, until: T + LONG }],
    passives: [{ src: 'omruc', windows: [[T, T + LONG]] }],
    holdMs: T + LONG + 1000,
    fx: [{ ...SCENE_FX.magicPoof, w: 'self', at: T }, ...others.map((tile) => ({ ...SCENE_FX.magicPoof, tiles: [tile], at: T })), ...heals(null), ...others.flatMap((tile) => heals(tile))]
  };
}

// Giant Spider (the egg; 50% lifesteal): 1s into the battle (the cooldown bar fills first) it lays a SPIDER EGG on the free tile next to it that is best placed against the enemies (`teleportPurple` on it,
// the `spiderEgg` item fading in over 100ms); laying it takes the ability (and its cooldown bar) away. When the egg is DESTROYED it hatches two ticks later into another Giant Spider on the same
// tile (`whiteGibs` and `whiteConfetti`). Awakened the egg also hatches by itself after 12s (nothing drawn). Here a villain Ti shoots the egg and the new Spider appears.
function sceneGiantSpider() {
  const LAY = 1000;
  const eggTile = [-1, 0];
  const KILL = 3000;
  const HATCH = KILL + 125;
  const COOL = SCENE_BAR.cool;
  return {
    numbers: [sceneDmg(KILL, eggTile, 'fire')],
    ...sceneBoard(3), noCooldownBar: true,
    attacker: { ...SCENE_VILLAIN_TI, dx: -3, dy: 0, aim: eggTile, at: KILL - SCENE_MISSILE_MS },
    mates: [{ id: 76, dx: eggTile[0], dy: eggTile[1], facing: 'east', at: HATCH }],
    bars: [{ at: 0, until: LAY, on: 'self', y: -2, smooth: true, levels: [[0, 0, COOL], [LAY, 1, COOL]] }],
    overlays: [{ kind: 'fade', id: 181, f: 8, loopMs: 1000, w: 1, h: 1, dx: eggTile[0], dy: eggTile[1], at: LAY, fadeMs: 100, ease: 'ease-out', outAt: KILL, outMs: 1 }],
    holdMs: HATCH + 1500,
    fx: [{ n: 'teleportPurple', id: 222, f: 11, tiles: [eggTile], at: LAY + 62.5 }, { ...SCENE_FX.moe, tiles: [eggTile], at: KILL },
      { n: 'whiteGibs', id: 276, f: 10, tiles: [eggTile], at: HATCH }, { n: 'whiteConfetti', id: 263, f: 10, tiles: [eggTile], at: HATCH }]
  };
}

// Monster Cauldron (the event cauldron; it cannot be moved): it waits until the Regeneration Tank dies. Then a `pinkBall` flies from the Tank to the enemy that wears the vampire slippers, `purpleEnergy` plays on it and a
// second `pinkBall` flies from it to the Cauldron, which TRANSFORMS two flights later: a double-size `avatarPoof` with a black shadow (it becomes the Tentugly head, which this scene does not draw), a `pinkBall` flies to the
// tentacle tile and a tentacle (item 35122) appears there with its own `avatarPoof`. Then every enemy is struck in turn, two ticks apart from 14 ticks in: an `sd` missile and true damage that leaves it with 1 HP (a crit, the
// `abilityPower` colour; silent), the target shakes (`superImpact`, 250ms) and `purpleSmoke` plays on it; fallen enemies are revived with 1 HP and `bigWhiteGlow` (not drawn). Finally a helper appears next to the tentacle
// with `teleportPurple`. From then on the Cauldron shoots `energyBeam`s at the closest enemy (range 99; magic crits), which the preview leaves out. Here the three villain Ti are struck (one wears the slippers) and one helper arrives.
function sceneMonsterCauldron() {
  const T0 = 500;
  const tank = [-3, -3];
  const slippers = [1, -2]; // the enemy wearing the vampire slippers
  const T = T0 + 2 * SCENE_MISSILE_MS; // the transformation, two flights after the Tank dies
  const tentacle = [3, 3];
  const targets = [[-2, 0], slippers, [2, 1]];
  const strikes = targets.map((tile, k) => ({ tile, at: T + 14 * 62.5 + k * 125 }));
  const helperAt = strikes[strikes.length - 1].at + 700;
  return {
    numbers: strikes.map((st) => sceneDmg(st.at + SCENE_MISSILE_MS, st.tile, 'abilityPower', true, 'true')),
    ...sceneBoard(3), noAutoAttack: true, noCooldownBar: true,
    mates: [{ id: 81, dx: tank[0], dy: tank[1], dies: { at: T0, corpse: false } },
      ...targets.map(([dx, dy], k) => ({ id: 119, dx, dy, facing: 'south', shake: { at: strikes[k].at + SCENE_MISSILE_MS, factor: 1, ms: 250 } })),
      { item: 35122, dx: tentacle[0], dy: tentacle[1], at: T + 500 }, { dx: -3, dy: 3, facing: 'east', at: helperAt }],
    flights: [{ shot: { n: 'pinkBall', id: 62 }, from: tank, to: slippers, at: T0 }, { shot: { n: 'pinkBall', id: 62 }, from: slippers, to: [0, 0], at: T0 + SCENE_MISSILE_MS },
      { shot: { n: 'pinkBall', id: 62 }, from: [0, 0], to: tentacle, at: T }, ...strikes.map((st) => ({ shot: { n: 'sd', id: 32 }, from: [0, 0], to: st.tile, at: st.at }))],
    holdMs: helperAt + 1500,
    fx: [{ n: 'purpleEnergy', id: 48, f: 17, tiles: [slippers], at: T0 + SCENE_MISSILE_MS }, { n: 'avatarPoof', id: 244, f: 11, w: 'self', at: T, z: 2, filter: 'drop-shadow(0 0 10px #000)' }, { n: 'avatarPoof', id: 244, f: 11, tiles: [tentacle], at: T + 500, filter: 'drop-shadow(0 0 10px #000)' },
      ...strikes.map((st) => ({ n: 'purpleSmoke', id: 170, f: 12, tiles: [st.tile], at: st.at + SCENE_MISSILE_MS })), { n: 'teleportPurple', id: 222, f: 11, tiles: [[-3, 3]], at: helperAt }]
  };
}

// The Pale Count (the blood moon; the first cast after 6s, then every 8s): `musicNotesRed` on it, a red haze fades over the whole board (400ms in and out) for 7s, every enemy forgets its target and bats
// (Bats: 140 HP, speed 190, `teleportRed` two ticks in) fill 40% of the free tiles at random; the bats' bites are TRUE damage (their attack + 10% of the Count's) and heal the Count (10% + 1% per AP of it).
// A draining bar (red) counts the 7s with the `bloodmoon` chip; when it ends every bat `poof`s away and the cooldown bar refills. The game spawns ceil(40% of the board's FREE tiles) bats (about 60 on a full
// board); here 40% of the free tiles of the 7x7 preview board (47 free: 19 bats), on tiles picked at random (a fixed shuffle, so the loop is the same every time), and a villain Ti.
function scenePaleCount() {
  const T = 500;
  const DUR = 7000;
  const ti = [-2, 0];
  const free = [];
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if ((x || y) && !(x === ti[0] && y === ti[1])) free.push([x, y]);
  let seed = 7; // a fixed pseudo-random shuffle
  for (let i = free.length - 1; i > 0; i--) { seed = (seed * 1103515245 + 12345) % 2147483648; const j = seed % (i + 1); [free[i], free[j]] = [free[j], free[i]]; }
  const batTiles = free.slice(0, Math.ceil(free.length * 0.4));
  const hits = [T + 1500, T + 2500, T + 3500];
  const RED = '#ff0000';
  const COOL = SCENE_BAR.cool;
  const end = T + DUR + 1500;
  return {
    numbers: hits.map((at) => sceneDmg(at, ti, 'true', false, 'true')),
    ...sceneBoard(3), noCooldownBar: true,
    mates: [sceneTiMate(ti[0], ti[1], 'east'), ...batTiles.map(([dx, dy]) => ({ outfit: 122, dx, dy, facing: 'south', at: T, dies: { at: T + DUR, corpse: false } }))],
    bars: [{ at: 0, until: end, on: 'self', y: -2, smooth: true, levels: [[0, 1, COOL], [T, 1, COOL], [T + 1, 1, RED], [T + DUR, 0, RED], [T + DUR + 1, 0, COOL], [end, (end - T - DUR) / 8000, COOL]] }],
    overlays: [{ kind: 'haze', image: 'filters/palehaze.svg', dx: 0, dy: 0, at: T, until: T + DUR }],
    passives: [{ src: 'bloodmoon', windows: [[T, T + DUR]] }],
    holdMs: end,
    fx: [{ ...SCENE_FX.musicNotesRed, w: 'self', at: T }, ...batTiles.flatMap((tile) => [{ n: 'teleportRed', id: 223, f: 11, tiles: [tile], at: T + 125 }, { ...SCENE_FX.poof, tiles: [tile], at: T + DUR }]),
      ...hits.map((at) => ({ ...SCENE_FX.bleed, tiles: [ti], at }))]
  };
}

// Vampire Bride (the heart): at the start it summons its HEART (a rotten heart that floats, speed 190, and RUNS from the Bride: each step it takes the free tile that keeps it farthest from her, and it is only caught when it is
// cornered) and the Bride (speed 110) CHASES it. Whenever its cooldown (3s) is done and the heart is next to it, it BITES it: `bite` on the heart (which stands still while she charges), a 100ms flinch and a crit of magic damage
// (1 x its AD, silent) that it keeps; a draining bar (ability power purple, 800ms) is the charge; then `circlingHearts` and it heals itself for that damage x (250% + 0.15% per AP) as a crit (silent), the cooldown starts and the
// chase goes on. Awakened its attacks hurt (magic). The chase and the bites here are simulated tick by tick with those rules on a 7 x 7 board (the first bite after the preview's 1s start), two bites long.
function sceneVampireBride() {
  const CHARGE = 800;
  const COOLDOWN = 3000;
  const AP = SCENE_BAR.ap;
  const COOL = SCENE_BAR.cool;
  const START = 300;
  const FIRST_READY = 1000; // the preview starts every cooldown with 1s left
  const BITES = 2;
  const R = 3; // the board is 7 x 7
  const heartStart = [2, 0];
  const stepH = walkStepMs(190);
  const stepB = walkStepMs(110);
  const inBoard = ([x, y]) => Math.abs(x) <= R && Math.abs(y) <= R;
  const dist = ([ax, ay], [bx, by]) => Math.hypot(ax - bx, ay - by);
  const next = (pos, [dx, dy]) => [pos[0] + dx, pos[1] + dy];
  let heart = heartStart.slice(), bride = [0, 0];
  let hNext = START, bNext = START, frozenUntil = 0, readyAt = FIRST_READY;
  const heartSteps = [], brideSteps = [], bites = [];
  let lastH = null, lastB = null;
  const record = (list, last, t, step, stepMs) => list.push([step[0], step[1], list.length ? Math.max(0, t - (last + stepMs)) : t - START]);
  for (let t = START; t < 20000 && bites.length < BITES; t += SCENE_TICK_MS) {
    const adjacent = Math.max(Math.abs(heart[0] - bride[0]), Math.abs(heart[1] - bride[1])) <= 1;
    if (adjacent && t >= readyAt && t >= frozenUntil) { // the bite
      bites.push({ at: t, heart: heart.slice(), bride: bride.slice() });
      frozenUntil = t + CHARGE; readyAt = t + CHARGE + COOLDOWN; hNext = Math.max(hNext, frozenUntil); bNext = Math.max(bNext, frozenUntil);
      continue;
    }
    if (t < frozenUntil) continue;
    if (t >= hNext) { // the heart steps to the free tile farthest from the Bride (it stays when every tile is no better: cornered)
      const options = [[1, 0], [0, 1], [-1, 0], [0, -1]].map((d) => next(heart, d)).filter((q) => inBoard(q) && (q[0] !== bride[0] || q[1] !== bride[1]));
      const best = options.sort((q1, q2) => dist(q2, bride) - dist(q1, bride))[0];
      if (best && dist(best, bride) > dist(heart, bride)) {
        record(heartSteps, lastH, t, [best[0] - heart[0], best[1] - heart[1]], stepH); lastH = t; heart = best; hNext = t + stepH;
      } else hNext = t + SCENE_TICK_MS;
    }
    if (t >= bNext && !adjacent) { // the Bride steps toward the heart along its longer axis
      const dx = heart[0] - bride[0], dy = heart[1] - bride[1];
      const step = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)];
      record(brideSteps, lastB, t, step, stepB); lastB = t; bride = next(bride, step); bNext = t + stepB;
    }
  }
  const end = bites[bites.length - 1].at + CHARGE + 1500;
  const levels = [[0, 2 / 3, COOL], [FIRST_READY, 1, COOL]];
  bites.forEach((b, i) => { levels.push([b.at, 1, COOL], [b.at + 1, 1, AP], [b.at + CHARGE, 0, AP], [b.at + CHARGE + 1, 0, COOL], [Math.min(b.at + CHARGE + COOLDOWN, bites[i + 1]?.at ?? end), Math.min(1, (Math.min(b.at + CHARGE + COOLDOWN, bites[i + 1]?.at ?? end) - b.at - CHARGE) / COOLDOWN), COOL]); });
  return {
    numbers: bites.flatMap((b) => [sceneDmg(b.at, heartStart, 'abilityPower', true, 'magic'), sceneHeal(b.at + CHARGE, 'self', true)]),
    ...sceneSelf(), gridHalf: R, noBlood: 1, noCooldownBar: true, cooldownCastAt: bites[0].at, casterFlee: { at: START + (brideSteps[0]?.[2] || 0), steps: brideSteps.map(([dx, dy, w], i) => [dx, dy, undefined, i ? w : 0]) },
    mates: [{ item: 31589, dx: heartStart[0], dy: heartStart[1], facing: 'east', walk: { at: START, steps: heartSteps, speed: 190 }, tint: { at: 0, filter: 'drop-shadow(0 0 5px #ffffff)' } }],
    bars: [{ at: 0, until: end, on: 'self', y: -2, smooth: true, levels }],
    holdMs: end,
    fx: bites.flatMap((b) => [{ n: 'bite', id: 214, f: 7, tiles: [b.heart], at: b.at }, { n: 'circlingHearts', id: 265, f: 12, tiles: [b.bride], at: b.at + CHARGE }])
  };
}

// Nomad (the lute; its song reaches the whole board; every 8s, the first after 4s): it picks an enemy that can fight and sets it against ANOTHER enemy: that one is TAUNTED to attack the other
// (the taunt icon), gets +40 AP and +15 AD for 5s (the `nomad-lute` chip, a crimson glow), two `ice` missiles (hue-rotated) fly from Nomad and from the enchanted one to the new target and
// `musicNotesRed` plays on it; Nomad attacks the same target. Awakened the two also swap their first piece of equipment (`diceRoll` on each). Here a villain Ti is turned on a second Ti.
function sceneNomad(awaken) {
  const T = 500;
  const a = [3, -1]; // the enchanted enemy
  const b = [-2, 2]; // the one it is set against
  return {
    ...sceneBoard(3), cooldownCastAt: T,
    mates: [{ id: 119, dx: a[0], dy: a[1], facing: 'west', tint: { at: T, until: T + 5000, filter: 'drop-shadow(0 0 5px #dc143c)' } }, sceneTiMate(b[0], b[1], 'east')],
    flights: [{ shot: { n: 'ice', id: 37, filter: 'hue-rotate(160deg)' }, from: [0, 0], to: b, at: T }, { shot: { n: 'ice', id: 37, filter: 'hue-rotate(160deg)' }, from: a, to: b, at: T }],
    statusIcons: [sceneTaunt(T, a)],
    holdMs: T + 1800,
    fx: [{ ...SCENE_FX.musicNotesRed, tiles: [a], at: T, filter: 'drop-shadow(0 0 5px #000000)' }, ...(awaken ? [a, b].map((tile) => ({ n: 'diceRoll', id: 27, f: 12, tiles: [tile], at: T })) : [])]
  };
}

// Bog Raider (the goo; every 4s, it needs a creature next to it): it pays 25 HP (true damage, silent), `nasty` plays on it (twice the size, half opacity), every enemy next to it (and its target) takes magic
// `earth` damage (20 + 1 AP, a crit from 10 AP) and a `poisonSting` (50ms) flies to the tile BEHIND each one (or to the creature when that tile is blocked). A mucus plug (item `mucusPlug`, green pool,
// it fades in over 200ms, wobbles, lasts 10s) appears on one of those tiles and the Raider WALKS to it and eats it: +25% of its max HP. Awakened it also gets armor for every 1% of HP it is missing
// (the `gooshell` chip: nothing to draw). Here two villain Ti stand next to it and it goes for the plug. The Gummy Raider is its event variant (its class is the same, with the `gummyshell` skill): the plug is a
// Chocolate Bar (item 6574) instead of the mucus plug (16102).
function sceneBogRaider(plugId = 16102) {
  const T = 500;
  const ti = [[0, -1], [1, -1]];
  const behind = [[0, -2], [2, -2]];
  const plug = behind[1];
  const path = [[1, 0], [1, 0], [0, -1], [0, -1]];
  const stepMs = walkStepMs(85);
  const walkAt = T + 1000;
  const arrive = walkAt + path.length * stepMs;
  return {
    numbers: [...ti.map((t) => sceneDmg(T, t, 'earth', false, 'magic')), sceneHeal(arrive, 'self')],
    ...sceneBoard(3), casterFlee: { at: walkAt, steps: path },
    // every enemy on one of the 8 tiles around it is hit: the area lights with the spell
    flashes: [{ at: T, ms: 800, tiles: sceneArea(SCENE_RING) }],
    mates: ti.map(([dx, dy]) => (sceneTiMate(dx, dy, 'south'))),
    flights: behind.map((to) => ({ shot: { n: 'poisonSting', id: 15 }, from: [0, 0], to, at: T, ms: 50 })),
    overlays: [{ kind: 'fade', id: plugId, f: 1, loopMs: 1000, w: 1, h: 1, dx: plug[0], dy: plug[1], at: T + 250, fadeMs: 200, ease: 'ease-in', outAt: arrive, outMs: 1 }],
    holdMs: arrive + 1200,
    fx: [{ n: 'nasty', id: 17, f: 6, w: 'self', at: T, z: 2, tx: 0.125, ty: 0.125, opacity: 0.5 }]
  };
}

// Swamp Troll (slugs): its ability starts on a 2s cooldown, then (every 14s) it summons Slugs (outfit 407; 2, 3 awakened) on free tiles, up to that many alive at once: `earthPoof` on
// each tile and `heal` once on the Troll. The Slugs bite (physical 5, `nasty`) and heal themselves from what they deal; the cooldown bar fills over the 14s. Here the Slugs appear around it.
function sceneSwampTroll(awaken) {
  const T = 2000;
  const tiles = [[-2, -1], [2, 1], [0, 2], ...(awaken ? [[-1, -2]] : [])].slice(0, awaken ? 3 : 2);
  return {
    ...sceneBoard(3), cooldownCastAt: T,
    mates: tiles.map(([dx, dy]) => ({ outfit: 407, dx, dy, at: T })),
    holdMs: T + 2500,
    fx: [...tiles.map((tile) => ({ n: 'earthPoof', id: 21, f: 12, tiles: [tile], at: T })), { ...SCENE_FX.heal, w: 'self', at: T }]
  };
}

// Regeneration Tank (an item; it does not move): every 3s (the cooldown bar fills over it) it summons a Gummy Raider (a Bog Raider variant, stats from the floor) on a free tile next to it, or two tiles
// away when none is free, up to the floor + 3 alive at once: `teleportBlue` on the tile and `heal` on the Tank. Here two Gummy Raiders appear, one per cast.
function sceneRegenerationTank() {
  const T = 500;
  const CD = 3000;
  const spawns = [[1, 0], [-1, 1]];
  return {
    ...sceneBoard(2), cooldownCastAt: T,
    mates: spawns.map(([dx, dy], i) => ({ id: 82, dx, dy, at: T + i * CD })),
    holdMs: T + CD + 1500,
    fx: spawns.flatMap(([dx, dy], i) => [{ ...SCENE_FX.teleportBlue, tiles: [[dx, dy]], at: T + i * CD }, { ...SCENE_FX.heal, w: 'self', at: T + i * CD }])
  };
}

// Morguthis (the mirror): when the battle starts it copies every enemy fighter onto the tile opposite it (same creature, genes, level, tier, equipment slot item), on its own side: `teleportRed`
// (70% opacity) on each copy, which is drawn in grayscale. Here a villain Ti is mirrored across the board.
function sceneMorguthis() {
  const T = 500;
  const ti = [2, -1];
  return {
    ...sceneBoard(3), noCooldownBar: true, noAutoAttack: true,
    mates: [sceneTiMate(ti[0], ti[1], 'west'), { id: 119, dx: -ti[0], dy: ti[1], facing: 'east', at: T, tint: { at: 0, filter: 'grayscale(1)' } }],
    holdMs: T + 2500,
    fx: [{ n: 'teleportRed', id: 223, f: 11, tiles: [[-ti[0], ti[1]]], at: T, opacity: 0.7 }]
  };
}

// Green Djinn (the jar; every 8s, when an ally is next to it): `magicSparkle` on its 8 neighbouring tiles; every ally there gets `magicPoof` and is replaced by a JAR (item djinnJar) for 1s + 40ms per AP
// (3.4s at 60 AP; a repeat cast only refreshes it) and can neither attack nor move (a jar takes no damage from auto attacks); the `jar` chip counts it, and when it ends another `magicPoof` frees the ally.
// Awakened the jarred ally can still move. Its normal attack (range 5, every 3s) is an `energy` missile of MAGIC damage (AD + AP + 0.5): a villain Ti stands in range and is hit twice. Here an ally next to the Djinn is jarred and freed.
function sceneGreenDjinn(awaken) {
  const T = 500;
  const DUR = 3400;
  const ally = [1, 0];
  const enemy = [3, 0];
  const attacks = [1700, 4700];
  const around = sceneArea(SCENE_RING);
  return {
    ...sceneBoard(3), cooldownCastAt: T,
    numbers: attacks.map((at) => sceneDmg(at, enemy, 'energy', false, 'magic')),
    flights: attacks.map((at) => ({ shot: { n: 'energy', id: 36 }, from: [0, 0], to: enemy, at })),
    mates: [{ dx: ally[0], dy: ally[1], facing: 'west', dies: { at: T, until: T + DUR, corpse: false } }, sceneTiMate(enemy[0], enemy[1], 'west')],
    overlays: [{ kind: 'fade', id: 21936, f: 1, loopMs: 1000, w: 1, h: 1, dx: ally[0], dy: ally[1], at: T, fadeMs: 1, outAt: T + DUR, outMs: 1 }],
    passives: [{ src: 'jar', windows: [[T, T + DUR]] }],
    holdMs: T + DUR + 1200,
    fx: [...attacks.map((at) => ({ ...SCENE_FX.energy, tiles: [enemy], at })), ...around.map((tile) => ({ ...SCENE_FX.magicSparkle, tiles: [tile], at: T })), { ...SCENE_FX.magicPoof, tiles: [ally], at: T }, { ...SCENE_FX.magicPoof, tiles: [ally], at: T + DUR }]
  };
}

// Cobra Statue (it never moves; range 6, venom stings): it is Thalas's companion. At the start it listens to Thalas: when Thalas hooks a target the statue is TAUNTED to that target; when Thalas
// dies the statue dies too; when Thalas kills its hooked target Thalas's cooldown resets (`cooldownRefresh`). Every 8s it heals Thalas for 2 per AP (a heal on Thalas). Its own attack is a
// `poisonSting` of magic `earth` damage. Here Thalas stands beside the statue, takes the heal, and a villain Ti is stung.
function sceneCobraStatue() {
  const T = 500;
  const thalas = [-2, 0];
  return {
    numbers: [sceneHeal(T, thalas, false)],
    ...sceneBoard(3), cooldownCastAt: T,
    mates: [{ id: 101, dx: thalas[0], dy: thalas[1], facing: 'east' }, sceneTiMate(3, 0, 'west')],
    holdMs: T + 2500,
    fx: [{ ...SCENE_FX.heal, tiles: [thalas], at: T }]
  };
}

// Cyclops Smith (the hammer; every 5s, on an enemy within 4 tiles): it throws a club (`exoriHurClub`, one tick, 62.5ms, per hop) that hits the target (1 + 1 x AD physical) and heals the Smith (10 + 0.2 AP),
// then bounces to a random enemy beside the one it hit that has not been hit yet, 4 hits in all. A kill cuts the cooldown to 4 ticks. Awakened it keeps bouncing while a fresh enemy is beside the last
// one. Here four villain Ti stand in a chain (a fifth when awakened).
function sceneCyclopsSmith(awaken) {
  const T = 500;
  const HOP = 62.5;
  const chain = [[1, 0], [2, 0], [2, 1], [1, 1], ...(awaken ? [[0, 1]] : [])];
  return {
    numbers: chain.flatMap((tile, i) => [sceneDmg(T + HOP * (i + 1), tile, 'physical'), sceneHeal(T + HOP * (i + 1), 'self')]),
    ...sceneBoard(3), cooldownCastAt: T, casterFacing: 'east',
    mates: chain.map(([dx, dy]) => (sceneTiMate(dx, dy, 'west'))),
    flights: chain.map((to, i) => ({ shot: { n: 'exoriHurClub', id: 27 }, from: i ? chain[i - 1] : [0, 0], to, at: T + HOP * i, ms: HOP })),
    holdMs: T + 2500
  };
}

// Hero (the heroic deed): it shoots arrows (range 2) that ignore 10 armor per stack, and heals 10% of the damage + 15% per stack (30% more when it is the last of its side alive, awakened; at most 100%).
// Every enemy it helped kill gives a stack (a blue-shifted `raiseStat` and a pulse on it, the `heroicdeed` bar counts them). Here it shoots a villain Ti dead and gets its first stack.
function sceneHero() {
  const T = 500;
  const hits = [T + SCENE_MISSILE_MS, T + SCENE_MISSILE_MS + 1500];
  const ti = [2, 0];
  const kill = hits[1];
  return {
    numbers: [...hits.map((at) => sceneDmg(at, ti, 'physical')), ...hits.map((at) => sceneHeal(at, 'self'))],
    ...sceneBoard(3), noCooldownBar: true, noAutoAttack: true, casterFacing: 'east',
    mates: [{ id: 119, dx: ti[0], dy: ti[1], facing: 'west', dies: { at: kill } }],
    flights: hits.map((at) => ({ shot: { n: 'arrow', id: 3 }, from: [0, 0], to: ti, at: at - SCENE_MISSILE_MS })),
    passives: [{ src: 'heroicdeed', counts: [{ at: 0, n: 0 }, { at: kill + 400, n: 1 }] }],
    holdMs: kill + 2400,
    fx: [{ ...SCENE_FX.raiseStat, w: 'self', at: kill + 400, filter: 'hue-rotate(195deg)' }]
  };
}

// Valkyrie (the spear; every 3s the next attack is the SPEAR, a gold glow on her while it is ready, range 3): it hurls the spear (a gold-glowing `spear`) for a normal hit and heals 10% + 0.25% per AP of it;
// the target flinches and every ranged ally who is free attacks it twice at once (their damage x 2), and she heals for that share of their hits as a crit. Awakened it hits males 5% harder (nothing to draw).
// Here a ranged ally stands behind her.
function sceneValkyrie() {
  const T = 500;
  const ti = [3, 0];
  const ally = [-1, 1];
  const land = T + SCENE_MISSILE_MS;
  const second = land + 187.5;
  return {
    numbers: [sceneDmg(land, ti, 'physical'), sceneHeal(land, 'self'), sceneDmg(second, ti, 'physical'), sceneDmg(second + 62.5, ti, 'physical'), sceneHeal(second + 62.5, 'self', true)],
    ...sceneBoard(3), cooldownCastAt: T, noAutoAttack: true, casterFacing: 'east',
    mates: [sceneTiMate(ti[0], ti[1], 'west'), { dx: ally[0], dy: ally[1], facing: 'east' }],
    flights: [{ shot: { n: 'spear', id: 1, filter: 'drop-shadow(0 0 5px #f8c810)' }, from: [0, 0], to: ti, at: T },
      ...[second, second + 62.5].map((at) => ({ shot: { n: 'arrow', id: 3 }, from: ally, to: ti, at: at - SCENE_MISSILE_MS }))],
    holdMs: second + 2200
  };
}

// Hunter (the trap; every 9s, range 3): it stops for 200ms to set a trap on its own tile (`poof`) and walks on. The first enemy to step on it takes a crit of magic damage (10 + 1 AP, the ability power colour),
// is ROOTED for 3.5s (a draining stun bar, a black-glow crosshair over it, the `hunter-trap` chip) and the trap (`/assets/misc/trap-spritesheet.png`) snaps shut under it, and the Hunter gets +40 speed for as long (`raiseStat`), is drawn to it and shoots it from up to 4 tiles
// farther. Awakened, below 8% HP, every spent trap re-arms. Here a villain Ti walks onto the trap and is shot.
function sceneHunter() {
  const T = 500;
  const stepMs = walkStepMs(100);
  const SET = T + 200;
  const walkIn = SET + 500;
  const arrive = walkIn + 3 * stepMs;
  const ROOT = 3500;
  const hit = arrive + SCENE_MISSILE_MS;
  const stun = '#ffc107';
  return {
    numbers: [sceneDmg(arrive, [0, 0], 'abilityPower', true, 'magic'), sceneDmg(hit, [0, 0], 'physical')],
    ...sceneBoard(4), cooldownCastAt: T, noAutoAttack: true, casterFlee: { at: SET, steps: [[-1, 0], [-1, 0]] },
    mates: [{ id: 119, dx: 3, dy: 0, facing: 'west', walk: { at: walkIn, speed: 100, steps: [[-1, 0], [-1, 0], [-1, 0]] } }],
    flights: [{ shot: { n: 'arrow', id: 3 }, from: [-2, 0], to: [0, 0], at: arrive }],
    overlays: [{ kind: 'trap', dx: 0, dy: 0, at: SET, closeAt: arrive }, { kind: 'fade', id: 52793, f: 1, loopMs: 1000, w: 1, h: 1, dx: 0, dy: 0, at: arrive, fadeMs: 300, outAt: arrive + ROOT, outMs: 1 }],
    bars: [{ at: arrive, until: arrive + ROOT, on: [0, 0], y: -2, smooth: true, levels: [[arrive, 1, stun], [arrive + ROOT, 0, stun]] }],
    passives: [{ src: 'hunter-trap', windows: [[arrive, arrive + ROOT]] }],
    holdMs: arrive + 2500,
    fx: [{ ...SCENE_FX.poof, w: 'self', at: T }, { ...SCENE_FX.raiseStat, w: 'self', at: arrive }]
  };
}

// Nightstalker (the blink; the first after 2s, then every 7s): it picks the enemy with the lowest HP% that has a free tile beside it and BLINKS there (+300 speed, a 600ms squash), then attacks it at once: a physical
// hit and a magic EXECUTE (10% + 0.25% per AP of the target's MISSING HP, the ability power colour, a crit at 50% HP or less; it flinches); `poof` on the target and on the Nightstalker. Awakened it is invulnerable
// (grayscale, the `nightmareboots` chip) for the blink and 750ms more. Here a villain Ti stands three tiles away, hurt.
function sceneNightstalker(awaken) {
  const T = 500;
  const stepMs = walkStepMs(420);
  const steps = [[1, 0], [1, 0], [0, 1]];
  const land = T + steps.length * stepMs;
  const ti = [3, 1];
  return {
    numbers: [sceneDmg(land, ti, 'physical'), sceneDmg(land, ti, 'abilityPower', true, 'magic')],
    ...sceneBoard(3), cooldownCastAt: T, noAutoAttack: true, baseSpeed: 120,
    casterFlee: { at: T, steps, speedBonus: 300 }, casterJump: { at: T, kind: 'squash' }, // the blink: the game's `squash` animation, 600ms ease-in, plays on it as it moves (+300 speed): it vanishes and drops in beside the target
    mates: [sceneTiMate(ti[0], ti[1], 'west')],
    passives: awaken ? [{ src: 'nightmareboots', windows: [[T, land + 750]] }] : [],
    holdMs: land + 2200,
    fx: [{ ...SCENE_FX.poof, tiles: [ti], at: land }, { ...SCENE_FX.poof, tiles: [[2, 1]], at: land }]
  };
}

// Corym Skirmisher (the shadow; the first cast after 3s, then every 8s): it turns itself AND its ally invisible for 5s (`magicPoof` on each, a `rot` flies to the ally; the game draws a looping `heal` effect in place of an
// invisible creature; a draining bar and the `cancelinvisibility` chip count it). An invisible Skirmisher's attacks `scratchWhite` the target and lower its ARMOR by 3 (6 awakened) per hit for 3s (the `scratch` chip counts
// it); a hit on an invisible one cancels it (`poof`). Here an ally and the Skirmisher vanish and it scratches a villain Ti next to it twice (it is a melee creature).
function sceneCorymSkirmisher(awaken) {
  const T = 500;
  const INVI = 5000;
  const ally = [-2, 1];
  const ti = [1, 0]; // a melee attacker: the enemy is next to it
  const hits = [T + 1500, T + 3500];
  const per = awaken ? 6 : 3;
  return {
    numbers: hits.map((at) => sceneDmg(at, ti, 'physical')),
    ...sceneBoard(3), cooldownCastAt: T, noAutoAttack: true, casterFacing: 'east',
    transform: { at: T, until: T + INVI, fade: 200 },
    mates: [{ dx: ally[0], dy: ally[1], facing: 'east', dies: { at: T, until: T + INVI, corpse: false } }, sceneTiMate(ti[0], ti[1], 'west')],
    flights: [{ shot: { n: 'rot', id: 39 }, from: [0, 0], to: ally, at: T }],
    stuns: [{ at: T, ms: INVI, on: 'self', shake: false, color: '#97c9db' }],
    passives: [{ src: 'cancelinvisibility', windows: [[T, T + INVI]] }, { src: 'scratch', counts: [{ at: 0, n: 0 }, { at: hits[0], n: -per }, { at: hits[1], n: -2 * per }, { at: hits[0] + 3000, n: -per }, { at: hits[1] + 3000, n: 0 }] }],
    holdMs: T + INVI + 1200,
    fx: [{ ...SCENE_FX.magicPoof, w: 'self', at: T }, { ...SCENE_FX.magicPoof, tiles: [ally], at: T },
      ...sceneInvisibleLoops(T, 6), ...sceneInvisibleLoops(T, 6, { tiles: [ally] }),
      ...hits.map((at) => ({ n: 'scratchWhite', id: 282, f: 8, tiles: [ti], at }))]
  };
}

// Black Knight (the quest knight, speed 160, attack delay 0.5s; it taunts every enemy that targets someone else every 2s): its room has FOUR dead trees, one in each corner, and it works through them. With no spear it runs to the
// nearest tree that is ready and hits it (`bonk`: the knight axe flies up, the tree flinches, no damage; the tree is then not ready for 7s) and gets a SPEAR (the `royalspear` bar counts them). With a spear its next attack is a
// ranged one (range 99): a `royalSpear` flies at the lowest-HP enemy for 5x its AD, a crit, and takes a spear. Then it runs to the next tree. Here it makes the round of the four trees, throwing a spear after each, at a villain Ti.
function sceneBlackKnight() {
  const T = 500;
  const stepMs = walkStepMs(160);
  const LEG = 4; // steps from tree to tree (it stands diagonally next to each)
  const DELAY = 500; // its attack delay: it throws half a second after the bonk, then runs on
  const trees = [[3, -3], [-3, -3], [-3, 3], [3, 3]]; // counter-clockwise: top right, top left, bottom left, bottom right
  const stands = [[2, -2], [-2, -2], [-2, 2], [2, 2]];
  const ti = [3, 0];
  const legs = [[[1, 0], [1, 0], [0, -1], [0, -1]], [[-1, 0], [-1, 0], [-1, 0], [-1, 0]], [[0, 1], [0, 1], [0, 1], [0, 1]], [[1, 0], [1, 0], [1, 0], [1, 0]]];
  const steps = legs.flatMap((leg, i) => leg.map(([dx, dy], j) => (i && !j ? [dx, dy, undefined, DELAY] : [dx, dy])));
  const arrive = trees.map((_, i) => T + (i + 1) * LEG * stepMs + i * DELAY);
  const throws = arrive.map((at) => at + DELAY);
  const land = throws.map((at) => at + SCENE_MISSILE_MS);
  return {
    numbers: land.map((at) => sceneDmg(at, ti, 'physical', true, 'physical')),
    ...sceneBoard(4), noCooldownBar: true, noAutoAttack: true, casterFacing: 'east', casterFlee: { at: T, steps },
    mates: [...trees.map(([dx, dy]) => ({ id: 75, dx, dy })), sceneTiMate(ti[0], ti[1], 'west')],
    statusIcons: [sceneTaunt(T + 100, ti)],
    overlays: trees.map(([dx, dy], i) => ({ kind: 'bonk', id: 3318, dx, dy: dy - 1, at: arrive[i] })),
    flights: stands.map((from, i) => ({ shot: { n: 'royalSpear', id: 21 }, from, to: ti, at: throws[i] })),
    passives: [{ src: 'royalspear', counts: [{ at: 0, n: 0 }, ...arrive.flatMap((at, i) => [{ at, n: 1 }, { at: throws[i], n: 0 }])] }],
    holdMs: land[3] + 1800
  };
}

// Mateusz Dragon Wielki (the healer; every 6.5s): `heal` plays on every tile of the diamond around him (the 7x7 with its corners cut) and every ally in it, himself too, is healed for 10 + 3 AP, a crit.
// He does not fight. Here two allies stand in the diamond.
function sceneMateusz() {
  const T = 500;
  const mask = ['OOXXXOO', 'OXXXXXO', 'XXXXXXX', 'XXX+XXX', 'XXXXXXX', 'OXXXXXO', 'OOXXXOO'];
  const allies = [[2, 1], [-3, 0]];
  return {
    numbers: [sceneHeal(T, 'self', true), ...allies.map((a) => sceneHeal(T, a, true))],
    ...sceneBoard(3), cooldownCastAt: T, noAutoAttack: true,
    mates: allies.map(([dx, dy]) => ({ dx, dy })),
    holdMs: T + 2400,
    fx: [...sceneArea(mask).map((tile) => ({ ...SCENE_FX.heal, tiles: [tile], at: T })), { ...SCENE_FX.heal, w: 'self', at: T }]
  };
}

// Paladin (the pass-through star; range 2): its `assassinStar` hits the target for its AD (physical) and every OTHER enemy standing in the straight line between them (cardinal lines only) for 5 + 0.15 AP of magic
// damage, a tick apart per tile; a second star (grayscale, half opacity) follows one tick behind on such a line. It steps to the tile that lines up the most enemies. Awakened it gains 6 armor for every enemy next to it
// (the `mastermindshield` chip counts them). Here a villain Ti stands in the line, one behind it is the target, and (awakened) a third beside the Paladin.
function scenePaladin(awaken) {
  const T = 500;
  const first = [1, 0];
  const target = [2, 0];
  const land = T + SCENE_MISSILE_MS;
  return {
    numbers: [sceneDmg(land, first, 'abilityPower', false, 'magic'), sceneDmg(land + 62.5, target, 'physical')],
    ...sceneBoard(3), noCooldownBar: true, noAutoAttack: true, casterFacing: 'east',
    mates: [sceneTiMate(first[0], first[1], 'west'), sceneTiMate(target[0], target[1], 'west'), ...(awaken ? [sceneTiMate(0, 1, 'north')] : [])],
    flights: [{ shot: { n: 'assassinStar', id: 19 }, from: [0, 0], to: target, at: T },
      { shot: { n: 'assassinStar', id: 19, filter: 'grayscale(1) opacity(0.5)' }, from: [0, 0], to: target, at: T + 62.5 }],
    passives: awaken ? [{ src: 'mastermindshield', counts: [{ at: 0, n: 18 }] }] : [],
    flashes: [{ at: land, tiles: [first, target] }], // the line the star passes through
    holdMs: land + 2200
  };
}

// Cake Drake (an item; it spits the fireball by accident, every 1.45s, and it ignores stuns when awakened; it is always awakened): a `fire` missile flies to the target's tile and the fire then spreads over the WHOLE board
// in rings (every free tile around the last ring, diagonals too), a ring every 2 ticks (125ms), each ring a 600ms `fire` on all its tiles. Every enemy in a ring takes 10 + 0.5 AP of magic fire damage, and all of them
// lose 35% (+0.3% per AP, at most 100%) attack damage and ability power for 1.5s (the `soulfire` chip). Here a villain Ti is hit first and another in the fourth ring; the preview board is 7x7.
function sceneCakeDrake() {
  const T = 1000; // the missile; it must stay later than cooldownCastAt, which must stay above 0
  const RING = 125;
  const target = [2, 1];
  const far = [-1, -2];
  const ring = (t) => Math.max(Math.abs(t[0] - target[0]), Math.abs(t[1] - target[1]));
  const tiles = [];
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x || y) tiles.push([x, y]);
  tiles.push([0, 0]);
  const at = (t) => T + RING * (ring(t) + 1);
  const hits = [target, far];
  return {
    numbers: hits.map((t) => sceneDmg(at(t), t, 'fire', false, 'magic')),
    ...sceneBoard(3), cooldownCastAt: T - 8 * 62.5, casterFacing: 'east', // the game restarts the cooldown 8 ticks before the missile
    mates: hits.map(([dx, dy]) => (sceneTiMate(dx, dy, 'west'))),
    flights: [{ shot: { n: 'fire', id: 4 }, from: [0, 0], to: target, at: T }],
    passives: [{ src: 'soulfire', windows: [[at(target), at(far) + 1500]] }], // the two debuffs overlap: one window
    holdMs: T + RING * 6 + 2000,
    fx: tiles.map((t) => ({ ...SCENE_FX.fire, tiles: [t], at: at(t), ms: 600 }))
  };
}

// Clot (the slime; every 12s, less 80ms per AP): it CLONES itself onto a free tile beside it: `teleportBlue` on the tile and `heal` on the Clot; the Squidgy Clot has the same stats but 5 HP and the same gear, and
// fights on; up to 2 clones at a time (3 awakened). If the main Clot dies a clone takes its place (`slimeParticlesGreen`, a pulse). Here two clones appear (the second after a wait shortened for the preview).
function sceneClot() {
  const T = 500;
  const second = T + 3500; // the real wait is 12s less 80ms per AP (about 7s here); the preview shortens it so the loop is not mostly still
  const spawns = [[1, 0], [-1, 1]];
  return {
    ...sceneBoard(2), cooldownCastAt: T, noAutoAttack: true,
    mates: spawns.map(([dx, dy], i) => ({ id: 127, dx, dy, at: i ? second : T })),
    holdMs: second + 1800,
    fx: spawns.flatMap(([dx, dy], i) => [{ ...SCENE_FX.teleportBlue, tiles: [[dx, dy]], at: i ? second : T }, { ...SCENE_FX.heal, w: 'self', at: i ? second : T }])
  };
}

// Amazon (the vicious knives; range 4; the ability is ready from the start, so the FIRST throw is the special one): while the ability is ready its next knife is thrown with a crimson glow
// (`drop-shadow(0 0 5px #dc143c)`), starts the cooldown (3.5s; the bar is full until that throw, empty at it, then fills) and sticks a vicious knife in the target (the `vicious-knife` counter, up to 2),
// besides its normal physical hit. A normal throw (cooldown running) or a special one at 2 knives PULLS the knives: magic damage of 1% of the target's max HP + 0.1% per AP per knife (a crit with 2),
// `megaBleed`, a knife that spins away (`chippingKnife`, crimson glow, the energy colour with 2 knives), and the Amazon heals 80% of the physical damage. The target dying pulls them too. Awakened the pull
// also makes the target BLEED for 5s (`amazon-bleed`: 6 true damage a second, `megaBleed` each tick) and heal 25% less. The attack delay (3s) is shorter than the cooldown, so knives only stack with
// cooldown reduction: here a 20% cut (2.8s) so three special throws in a row stack two knives and pull both. The Amazon stands in the corner, four tiles from the target (its range) in the middle.
function sceneAmazon(awaken) {
  const T = 500;
  const DELAY = 3000;
  const CD = 2800;
  const from = [4, 4]; // the Amazon's corner, relative to the target in the middle
  const throws = [T, T + DELAY, T + 2 * DELAY];
  const land = throws.map((at) => at + SCENE_MISSILE_MS);
  const pull = land[2];
  const COOL = SCENE_BAR.cool;
  const ticks = awaken ? [1, 2, 3, 4, 5].map((i) => pull + i * 1000) : [];
  const end = awaken ? pull + 5500 : pull + 1800;
  const glow = { filter: 'drop-shadow(0 0 5px #dc143c)' };
  return {
    numbers: [...land.map((at) => sceneDmg(at, 'target', 'physical')), sceneDmg(pull, 'target', 'abilityPower', true, 'magic'), sceneHeal(pull, 'self'), ...ticks.map((at) => sceneDmg(at, 'target', 'hpBlack', false, 'true'))],
    ...sceneTarget(), castRange: 4, gridHalf: 4, noBlood: 1, noAutoAttack: true, noCooldownBar: true,
    bars: [{ at: 0, until: end, on: 'self', y: -2, smooth: true, levels: [[0, 1, COOL], ...throws.flatMap((at) => [[at, 1, COOL], [at + 1, 0, COOL], [at + CD, 1, COOL]])].filter((k, i, all) => i === 0 || k[0] >= all[i - 1][0]) }],
    flights: throws.map((at) => ({ shot: { n: 'throwingKnife', id: 9, ...glow }, from, to: [0, 0], at })),
    overlays: [{ kind: 'chipKnife', anchor: 'target', dx: 0, dy: 0, at: pull, strong: true }],
    passives: [{ src: 'vicious-knife', counts: [{ at: 0, n: 0 }, { at: land[0], n: 1 }, { at: land[1], n: 2 }, { at: pull, n: 0 }] }, ...(awaken ? [{ src: 'amazon-bleed', windows: [[pull, pull + 5000]] }] : [])],
    holdMs: end,
    fx: [...land.map((at) => ({ ...SCENE_FX.bleed, tiles: [[0, 0]], at })), // the blood of each normal hit (the scene places its own: `noBlood`)
      { n: 'megaBleed', id: 268, f: 4, tiles: [[0, 0]], at: pull }, ...ticks.map((at) => ({ n: 'megaBleed', id: 268, f: 4, tiles: [[0, 0]], at }))]
  };
}

// Blue Djinn (the blue boom; every 7s, the first at the start; the ability is ready, so it casts at once): it plays `moeExoriBlue` on itself (a 32px burst, 700ms, 90% opacity, a white glow) that HOLDS its size for the
// first 57% and then scales up to 5x over the rest (`blueDjinnScale`: 1 -> 5), while a round aura 5 tiles across (an ally green border, a mana-blue radial fill, no zoom, a 150ms fade) shows for 700ms. 6 ticks (375ms)
// after the cast every enemy in the 5x5 (corners cut) takes a crit of magic damage (15 + 0.7 AP, the mana colour: a pool of blood) and is SILENCED for 3.5s (the `blueboom` chip; the little silence icon the game pops over it is not drawn); an
// awakened Djinn cannot be silenced itself. Here two villain Ti stand in the area.
const BLUE_DJINN_MASK = ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO'];
function sceneBlueDjinn() {
  const T = 500;
  const hit = T + 375;
  const enemies = [[1, 0], [-2, 1]];
  return {
    numbers: enemies.map((e) => ({ at: hit, kind: 'damage', on: e, type: 'magic', dtype: 'magic', color: '#6699ff', crit: true })),
    ...sceneSelf(), gridHalf: 3, cooldownCastAt: T, noAutoAttack: true, noBlood: 1,
    mates: enemies.map(([dx, dy]) => ({ id: 119, dx, dy, facing: dx > 0 ? 'west' : 'east' })),
    flashes: [{ at: hit, ms: 800, tiles: sceneArea(BLUE_DJINN_MASK) }],
    overlays: [{ kind: 'circle', still: true, tiles: 5, border: 'rgba(96,192,96,0.7)', fill: 'radial-gradient(circle at center, #6699ff40 0%, #6699ff40 25%, transparent 70%)', at: T, until: T + 700 }],
    passives: [{ src: 'blueboom', windows: [[hit, hit + 3500]] }],
    holdMs: hit + 2200,
    fx: [{ n: 'moeExoriBlue', id: 287, f: 11, w: 'self', at: T, grow: { at: 0.57, to: 5 }, filter: 'drop-shadow(0 0 5px #ffffff70)', opacity: 0.9 }, ...enemies.map((e) => ({ ...SCENE_FX.bleed, tiles: [e], at: hit }))]
  };
}

// Demon (two abilities, both shown in one scene, in sequence): first the ENERGY BEAM, then the GREAT FIREBALL.
// Energy beam (every 4s, the first after 1s; range 8, only along a row or a column): a straight line of 8 tiles (the game's line mask `sr`, north / east / south / west only: never diagonal); there is no missile: an effect
// plays on every tile of the line at once (`oldEnergyFx`, which has no sheet of its own, so the `energy` sheet stands in) and every enemy on it takes a crit of magic damage (15 + 0.5 AP, the energy colour, silent) at
// the same tick; one it would kill is left at 1 HP and CONVERTED to the Demon's side (a brain over it for 2s).
// Great fireball (every 5s, range 4): a `fire` missile flies to the target, `oldBurn` on it, and every enemy in the 7x7 area around it (its corners cut) and the target take magic fire damage (5 + 0.3 AP; awakened it
// also never kills: it leaves 1 HP) and `oldFireFx` (70% opacity) plays on every tile of the area (`fire` stands in: the old ones have no sheet). The Demon stands at the west end of the board, the Ti on its row.
const DEMON_FIREBALL_MASK = ['OOXXXOO', 'OXXXXXO', 'XXXXXXX', 'XXX+XXX', 'XXXXXXX', 'OXXXXXO', 'OOXXXOO'];
function sceneDemon() {
  const BEAM = 500;
  const BALL = BEAM + 2500; // the fireball is cast a moment after the beam (its own cooldown)
  const land = BALL + SCENE_MISSILE_MS;
  const ti = [[-1, 0], [2, 0]]; // from the middle of the board (the Demon stands at [-4, 0])
  const area = sceneArea(DEMON_FIREBALL_MASK).map(([dx, dy]) => [dx - 1, dy]); // around the target, the first Ti
  return {
    ...sceneSelf(), gridHalf: 5, casterOffset: [-4, 0], casterFacing: 'east', cooldownCastAt: BEAM, noBlood: 1,
    numbers: [...ti.map((on) => ({ at: BEAM, kind: 'damage', on: { target: on }, type: 'magic', dtype: 'magic', color: '#cc33ff', crit: true })), ...ti.map((on) => ({ at: land, kind: 'damage', on: { target: on }, type: 'magic', dtype: 'magic', color: '#ff9900' }))],
    mates: ti.map(([dx, dy]) => (sceneTiMate(dx, dy, 'west', { anchor: 'target' }))),
    flights: [{ shot: { n: 'fire', id: 4 }, from: [-4, 0], to: [-1, 0], at: BALL }],
    // the beam's 8 tiles light with it, then the fireball's area
    flashes: [{ at: BEAM, ms: 800, tiles: Array.from({ length: 8 }, (_, i) => [-3 + i, 0]) }, { at: land, ms: 800, tiles: area }],
    holdMs: land + 2200,
    fx: [...Array.from({ length: 8 }, (_, i) => ({ ...SCENE_FX.energy, tiles: [[-3 + i, 0]], at: BEAM })), { ...SCENE_FX.fire, tiles: [[-1, 0]], at: land }, ...area.map((tile) => ({ ...SCENE_FX.fire, tiles: [tile], at: land, opacity: 0.7 }))]
  };
}

// Dragon (the fireball; every 8s, the first after 2s; any range): a `fire` missile flies to the target and the fireball component burns it: the TARGET tile at once (15 + 1 AP magic fire damage, a crit and its first
// piece of equipment burnt away), then the 3x3 ring around it 2 ticks (125ms) later for 2/3 of that and the 5x5 outer ring (corners cut) 2 ticks after that for 1/3; each tile plays `fire` (600ms). Every creature within 2
// tiles of the target also gets `soulfire` for 5s (-15% attack damage and ability power, -0.3% more per AP). AWAKENED the fireball engulfs the ENTIRE BATTLEFIELD: a flood fill from the target tile spreading one ring (8 neighbours,
// 2 ticks apart) at a time over every free tile of the board, the target tile 75 and each of the next rings 2/3, then 1/3 for all the rest. Here the Dragon stands in the bottom right corner of a 9x9 board, a villain Ti
// is the target, another is next to it and (awakened) a third is far away, in the fourth ring.
function sceneDragon(awaken) {
  const T = 500;
  const land = T + SCENE_MISSILE_MS;
  const RING = 125;
  const rings = awaken ? 8 : 2; // the rings that burn (rings 0..)
  const targets = [[0, 0], [1, 1], ...(awaken ? [[-3, 2]] : [])];
  const ringOf = (t) => Math.max(Math.abs(t[0]), Math.abs(t[1]));
  const tiles = [];
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    const r = ringOf([x, y]);
    if (r > rings) continue;
    if (!awaken && r === 2 && Math.abs(x) + Math.abs(y) === 4 && Math.abs(x) === 2) continue; // the outer ring's corners are cut
    tiles.push([x, y]);
  }
  const at = (t) => land + (awaken ? (ringOf(t) + 1) * RING : ringOf(t) * RING);
  const dmg = (t) => ringOf(t) === 0 ? 75 : ringOf(t) === 1 ? 50 : 25; // for the colour only: the numbers are words
  const near = targets.filter((t) => ringOf(t) <= 2);
  return {
    numbers: targets.map((t) => ({ at: at(t), kind: 'damage', on: { target: t }, type: 'magic', dtype: 'magic', color: '#ff9900', ...(ringOf(t) === 0 ? { crit: true } : {}) })),
    m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [{ n: 'fire', id: 4 }], gridHalf: 4, lead: T, noBlood: 1, ...(awaken ? { fullBoard: true } : {}),
    // the hit area lights ring by ring as each layer burns (the target tile, then the 3x3 ring, then the outer ring; awakened every ring out to the edge of the board)
    flashes: [...new Set(tiles.map(at))].sort((x, y) => x - y).map((time) => ({ at: time, ms: 1100, tiles: tiles.filter((t) => at(t) === time) })),
    mates: targets.map(([dx, dy]) => (sceneTiMate(dx, dy, 'east', { anchor: 'target' }))),
    passives: [{ src: 'soulfire', windows: near.map((t) => [at(t), at(t) + 5000]).slice(0, 1) }],
    holdMs: land + (awaken ? (rings + 1) * RING : 2 * RING) + 2200,
    fx: tiles.map((t) => ({ ...SCENE_FX.fire, tiles: [t], at: at(t), ms: 600 }))
  };
}

// Goblin Gumslinger (distance fighting; range 4): it throws a CANDY CANE (`candyCane`, the event variant of the Goblin's `smallStone`) at its target with every attack for its attack damage (physical). Each throw adds a
// stone to the counter over it (the `earth` green bar): at the Nth throw (round(4 x 1.2^level): 5 at level 1, 6 at level 2, ...) it LEVELS UP: +3 attack damage, a pulse and `raiseStat` on it, the counter empties and
// the `distancelevel` chip goes up one. Awakened every level up also gives all allied goblins +1% attack speed (the `frontsweep` chip). Here it throws five candy canes (a second apart) and levels up on the fifth. The
// base class (the Goblin's) holds the attack, so the data parser could not read it.
function sceneGoblinGumslinger(awaken) {
  const T = 500;
  const GAP = 1000;
  const throwsAt = Array.from({ length: 5 }, (_, i) => T + i * GAP);
  const land = throwsAt.map((at) => at + SCENE_MISSILE_MS);
  const from = [4, 4]; // the Gumslinger's corner, 4 tiles from the target in the middle
  const EARTH = '#00ff00';
  return {
    numbers: land.map((at) => sceneDmg(at, 'target', 'physical')),
    ...sceneTarget(), castRange: 4, noAutoAttack: true, noCooldownBar: true,
    flights: throwsAt.map((at) => ({ shot: { n: 'candyCane', id: 61 }, from, to: [0, 0], at })),
    bars: [{ at: 0, until: land[4] + 1500, on: 'self', y: -2, levels: [[0, 0, EARTH], ...land.slice(0, 4).map((at, i) => [at, (i + 1) / 5, EARTH]), [land[4], 0, EARTH]] }],
    passives: [{ src: 'distancelevel', counts: [{ at: 0, n: 1 }, { at: land[4], n: 2 }] }, ...(awaken ? [{ src: 'frontsweep', windows: [[land[4], null]], counts: [{ at: land[4], n: '1%' }] }] : [])],
    holdMs: land[4] + 1800,
    fx: [{ ...SCENE_FX.raiseStat, w: 'self', at: land[4] }]
  };
}

// Werefox (the fox coin; every 9s, the first after 5s; range 4): it summons a Werefox STATUE on its own tile (`magicPoof`; the statue, item 37812, drops in with `bouncyFall`, 300ms) and goes INVISIBLE for 3.5s with 60% faster
// attacks and +160 speed. The statue TAUNTS every enemy next to it (the taunt icon and the `exeta` chip) and shows a draining stun-coloured bar; it has no attack of its own. The Werefox treats the statue as its target: each
// attack at it is turned into a splash, a `royalStar` to every enemy next to the statue for its attack damage (physical) divided among them (split in two per extra enemy: full damage for one) and it heals (1 + 0.05 AP) per
// enemy hit. Casting again while the statue stands only refreshes it. When the time runs out the statue goes with a `magicPoof` at half opacity. Awakened its allies (lupines) go invisible too. Here the Werefox walks three tiles west while invisible and a villain Ti stands next to the statue.
function sceneWerefox(awaken) {
  const T = 500;
  const EFF = 3500;
  const ti = [1, 0];
  const ally = [-2, 1];
  // Invisible and +160 speed, the Werefox walks off the statue's tile to where it can shoot (range 4): three tiles west. An invisible creature is drawn as looping `heal` effects, which cannot follow it, so one plays on each tile it crosses.
  const stepMs = walkStepMs(105 + 160);
  const go = T + 100;
  const arrive = go + 3 * stepMs;
  const away = [-3, 0];
  const hits = [0, 1, 2].map((i) => arrive - 100 + i * 1100 + SCENE_MISSILE_MS);
  const trail = [[0, 0], [-1, 0], [-2, 0]].map((tile, i) => ({ ...SCENE_FX.heal, tiles: [tile], at: i === 0 ? T : go + i * stepMs, ms: i === 0 ? go + stepMs - T : stepMs }));
  return {
    numbers: [...hits.map((at) => sceneDmg(at, ti, 'physical')), ...hits.map((at) => sceneHeal(at, away))],
    ...sceneBoard(3), cooldownCastAt: T, noAutoAttack: true, casterFacing: 'east',
    casterFlee: { at: go, steps: [[-1, 0, 160], [-1, 0, 160], [-1, 0, 160]], restFacing: 'east' }, // it walks to the new tile at +160 speed, ends facing its target (the Ti, east) and stays there when the statue is gone
    casterInvisible: { at: T, until: T + EFF },
    mates: [{ item: 37812, dx: 0, dy: 0, at: T, bouncyFall: true, dies: { at: T + EFF, corpse: false } }, sceneTiMate(ti[0], ti[1], 'west'),
      ...(awaken ? [{ id: 13, dx: ally[0], dy: ally[1], facing: 'east', dies: { at: T, until: T + EFF, corpse: false } }] : [])],
    flights: hits.map((at) => ({ shot: { n: 'royalStar', id: 59 }, from: away, to: ti, at: at - SCENE_MISSILE_MS })),
    statusIcons: [sceneTaunt(T + 125, ti)],
    stuns: [{ at: T, ms: EFF, on: [0, 0], shake: false }],
    passives: [{ src: 'foxcoin', windows: [[T, T + EFF]] }, { src: 'exeta', windows: [[T + 125, T + EFF]] }],
    holdMs: T + EFF + 1200,
    flashes: hits.map((at) => ({ at, ms: 500, tiles: sceneArea(SCENE_RING) })), // shooting the statue splashes every enemy next to it
    fx: [{ ...SCENE_FX.magicPoof, tiles: [[0, 0]], at: T }, { ...SCENE_FX.magicPoof, tiles: [[0, 0]], at: T + EFF, opacity: 0.5 },
      ...trail, ...[0, 1, 2, 3].map((i) => ({ ...SCENE_FX.heal, tiles: [away], at: arrive + i * 880 })),
      ...(awaken ? [{ ...SCENE_FX.magicPoof, tiles: [ally], at: T }, ...sceneInvisibleLoops(T, 4, { tiles: [ally] })] : [])]
  };
}

// Yeti (the snowstorm; cooldown 8s, the first after 5s): it starts a SNOWSTORM that lasts 6s (the ability bar is replaced by an ice-coloured one that drains over the 6s; the cooldown restarts when it ends): a snow circle (a
// 160px / 5 tile ring with the ally colour and a white radial fill, with three layers of snow particles spinning inside it like a whirlwind) around it. At once and then every second (16 ticks), every enemy within 2 tiles (and its target) is SLOWED 25% for 2s (the slow icon, the \`snowstorm\` chip), takes
// magic ice damage of 2 + 0.1 AP (silent, no particle effect) and the Yeti heals (5 + 0.05 AP) for each of them, a crit above two. Awakened, auto-attacks that do not come from a Yeti deal no damage to anything in the snow (not drawn). Two villain Ti stand in the circle.
const YETI_MASK = ['XXXXX', 'XXXXX', 'XX+XX', 'XXXXX', 'XXXXX']; // within 2 tiles of the Yeti (and the Polar Bear's snow circle)
function sceneYeti() {
  const T = 500;
  const STORM = 6000;
  const ticks = [0, 1, 2, 3, 4, 5].map((i) => T + i * 1000);
  const enemies = [[-2, 0], [1, 1]];
  const ICE = '#66ccff';
  const COOL = SCENE_BAR.cool;
  const end = T + STORM + 1500;
  return {
    numbers: [...ticks.flatMap((at) => enemies.map((e) => sceneDmg(at, e, 'ice', false, 'magic'))), ...ticks.map((at) => sceneHeal(at, 'self'))],
    ...sceneBoard(2), noCooldownBar: true, cooldownCastAt: T,
    mates: enemies.map(([dx, dy]) => ({ id: 119, dx, dy, facing: dx < 0 ? 'east' : 'north' })),
    statusIcons: enemies.map((e) => ({ at: T, icon: 'slow', on: e })),
    bars: [{ at: 0, until: end, on: 'self', y: -2, smooth: true, levels: [[0, 1, COOL], [T, 1, COOL], [T + 1, 1, ICE], [T + STORM, 0, ICE], [T + STORM + 1, 0, COOL], [end, (end - T - STORM) / 8000, COOL]] }],
    // the snow hits every enemy within 2 tiles each second for as long as the storm lasts: the area stays lit for all of it (no blinking)
    flashes: [{ at: T, ms: STORM, tiles: sceneArea(YETI_MASK) }],
    overlays: [{ kind: 'circle', tiles: 5, border: 'rgba(96,192,96,0.7)', fill: 'radial-gradient(circle at center, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.38) 25%, transparent 70%)', whirl: true, at: T, until: T + STORM }],
    passives: [{ src: 'snowstorm', windows: [[T, T + STORM + 2000]] }],
    holdMs: end
  };
}

// Beer Barrel (the Grynch artifact, 10 HP, no attack): it only does something when it is DESTROYED: a \`largeFireExplosion\` plays on every tile of a big area around it (the 10 x 13 mask below, 3 tiles west of the barrel
// and 6 east, 6 north and 6 south) and every creature in it takes 300 TRUE damage (a fire-coloured crit, silent). The barrel itself takes only 20% of area damage. Here a villain Ti shoots it dead (it leaves its
// barrel corpse, item 3140) and two creatures standing in the area are hit.
const BEER_BARREL_MASK = ['OOXXXOOOOO', 'OXXXXXOOOO', 'XXXXXXXOOO', 'XXXXXXXOOO', 'XXXXXXXXOO', 'XXXXXXXXXO', 'XXX+XXXXXX', 'XXXXXXXXXO', 'XXXXXXXXOO', 'XXXXXXXOOO', 'XXXXXXXOOO', 'OXXXXXOOOO', 'OOXXXOOOOO'];
function sceneBeerBarrel() {
  const HIT = 1000;
  const BOOM = HIT + 60;
  const area = [[0, 0], ...sceneArea(BEER_BARREL_MASK)].filter(([x, y]) => Math.abs(x) <= 4 && Math.abs(y) <= 4); // what shows on the 9 x 9 board
  const victims = [[3, -2], [-2, 3], [-2, 0]]; // every creature in the area is hurt: two bystanders and the shooter itself (the attacker Ti, two tiles west)
  return {
    numbers: [sceneDmg(HIT, 'self', 'physical'), ...victims.map((v) => sceneDmg(BOOM, v, 'fire', true, 'true'))],
    m: [{ a: 'self', rows: ['+'] }], mi: [], noAutoAttack: true, noCooldownBar: true, gridHalf: 4, fullBoard: true, // the board is 9 x 9: the blast (10 x 13) is cut at its edge
    bleeds: [{ at: BOOM, on: [-2, 0], crit: true }], // every creature it hurts bleeds, the shooter too
    flashes: [{ at: BOOM, ms: 1800, tiles: area }],
    attacker: { ...SCENE_VILLAIN_TI, dx: -2, dy: 0, at: HIT - SCENE_MISSILE_MS },
    mates: victims.slice(0, 2).map(([dx, dy]) => ({ dx, dy, facing: 'west' })),
    transform: { at: BOOM, corpse: 3140 },
    holdMs: BOOM + 1800,
    fx: [{ ...SCENE_FX.largeFireExplosion, tiles: area, at: BOOM }]
  };
}

// Earth Crystal (it cannot be moved; it NEVER attacks and has no damage): every 3s it HEALS every crystal that is hurt (itself too): `greenFireworks` on each and a crit heal of 100 (silent, no particle). The crystals
// are the Energy, Magma and Earth Crystals. Here the Earth Crystal heals itself and two hurt crystals.
function sceneEarthCrystal() {
  const T = 500;
  const others = [[2, 0], [0, 2]];
  return {
    numbers: [sceneHeal(T, 'self', true), ...others.map((o) => sceneHeal(T, o, true))],
    ...sceneBoard(3), cooldownCastAt: T, noAutoAttack: true,
    mates: [{ id: 57, dx: others[0][0], dy: others[0][1] }, { id: 58, dx: others[1][0], dy: others[1][1] }],
    holdMs: T + 2000,
    fx: [[0, 0], ...others].map((tile) => ({ n: 'greenFireworks', id: 196, f: 10, tiles: [tile], at: T }))
  };
}

// Lavahole (it cannot be moved; speed 0; cooldown 2s): it picks its closest enemy and CHARGES for 1.5s: `blackSmoke` on it, a red bar fills, it shakes and heats, and the target's tile is MARKED (the `squareFocus` frame
// and the `arrowFocus` arrow over it). Then `smoke` plays on it, a `fire` missile flies to the marked tile and everything standing there (its target; its own side only when it is the target) takes 35% of its MAX HP as true damage, a crit
// in `fire` colour (silent), with `fire` on it. Here a villain Ti stands three tiles east and one south of the Lavahole.
function sceneLavahole() {
  const T = 500;
  const CHARGE = 1500;
  const ti = [3, 1];
  const land = T + CHARGE + SCENE_MISSILE_MS;
  return {
    numbers: [sceneDmg(land, ti, 'fire', true, 'true')],
    ...sceneBoard(3), noAutoAttack: true, noCooldownBar: true, cooldownCastAt: T + CHARGE,
    mates: [sceneTiMate(ti[0], ti[1], 'west')],
    bars: [{ at: T, ms: CHARGE, on: 'self', color: '#e03030' }],
    flights: [{ shot: { n: 'fire', id: 4 }, from: [0, 0], to: ti, at: T + CHARGE }],
    holdMs: land + 1500,
    fx: [{ n: 'blackSmoke', id: 158, f: 7, w: 'self', at: T, tx: -0.25, ty: -0.25 }, { n: 'squareFocus', id: 57, f: 14, tiles: [ti], at: T, ms: CHARGE }, { n: 'arrowFocus', id: 56, f: 8, tiles: [ti], at: T, ms: CHARGE },
      { n: 'smoke', id: 242, f: 24, w: 'self', at: T + CHARGE, tx: -0.5, ty: -0.25 }, { ...SCENE_FX.fire, tiles: [ti], at: land }]
  };
}

// Orshabaal (the fireball; range 99): the same 11 x 11 diamond as the game's, on a board one tile smaller each side than the mask would make it (11 x 11 instead of 13 x 13): the caster stands four tiles out, and the
// explosion is spelled out in effect tiles on a full board, so the rim of the diamond sits on the edge of the board.
const ORSHABAAL_MASK = ['OOOOOXOOOOO', 'OOOXXXXXOOO', 'OOXXXXXXXOO', 'OXXXXXXXXXO', 'OXXXXXXXXXO', 'XXXXX+XXXXX', 'OXXXXXXXXXO', 'OXXXXXXXXXO', 'OOXXXXXXXOO', 'OOOXXXXXOOO', 'OOOOOXOOOOO'];
function sceneOrshabaal() {
  const T = 500;
  const land = T + 4 * 120;
  const area = [[0, 0], ...sceneArea(ORSHABAAL_MASK)];
  return {
    numbers: [sceneDmg(land, 'target', 'fire', false, 'magic')],
    ...sceneTarget(), castRange: 4, gridHalf: 5, fullBoard: true, lead: T,
    flights: [{ shot: { n: 'fire', id: 4 }, from: [4, 4], to: [0, 0], at: T }],
    flashes: [{ at: land, ms: 1100, tiles: area }],
    holdMs: land + 1800,
    fx: [{ ...SCENE_FX.largeFireExplosion, tiles: area, at: land }, { ...SCENE_FX.fire, tiles: [[0, 0]], at: land }]
  };
}

// Sweaty Cyclops (the fire axe; speed 55): a FIRE AXE (item 3320) lies on a tile near it (it fades in over 600ms and drops in with a bounce). The Cyclops walks next to it and HAMMERS it: once a second (the cooldown) the axe
// jumps (`superImpact`, 250ms) with a `chip` on it and the `smith` counter over the Cyclops goes up one, to 3. At 3, six ticks later, the axe is handed on: the closest ally with no equipment gets it (the axe fades out and in over
// 700ms, the ally pulses twice and the axe drops onto it, half opacity, fading out); with no such ally the Cyclops takes it itself. The holder's attack damage goes up (a tier-5 equipment) and the Cyclops then fights; it
// always regenerates 2% + 0.8% per AP of its max HP every second (silent), the `greathealthpotion` chip. Here an ally Ti gets the axe.
function sceneSweatyCyclops() {
  const T = 500;
  const stepMs = walkStepMs(55);
  const axe = [3, 0];
  const steps = [[1, 0], [1, 0]]; // two tiles, to stand next to the axe
  const arrive = T + steps.length * stepMs;
  const hammers = [0, 1, 2].map((i) => arrive + i * 1000);
  const give = hammers[2] + 6 * SCENE_TICK_MS;
  const ally = [0, 2];
  return {
    ...sceneBoard(3), noAutoAttack: true, noCooldownBar: true, casterFacing: 'east', casterFlee: { at: T, steps },
    mates: [{ id: 119, dx: ally[0], dy: ally[1], facing: 'north', pulse: [give, give + 300] }],
    overlays: [{ kind: 'fade', id: 3320, f: 1, loopMs: 1000, w: 1, h: 1, dx: axe[0], dy: axe[1], at: 0, fadeMs: 600, outAt: give, outMs: 300 },
      { kind: 'drop', id: 3320, dx: ally[0], dy: ally[1], at: give + 300, ms: 1000, fadeDelay: 200, fadeMs: 800, op: 0.5 }],
    passives: [{ src: 'greathealthpotion', windows: [[0, null]] }, { src: 'smith', counts: [{ at: 0, n: 0 }, ...hammers.map((at, i) => ({ at, n: i + 1 })), { at: give, n: 0 }] }],
    holdMs: give + 1800,
    fx: hammers.map((at) => ({ n: 'chip', id: 4, f: 8, tiles: [axe], at }))
  };
}

// Ti (the thief; cooldown 1s): every second, if it is not on cooldown, it looks at the tiles around it and its own for an enemy that wears equipment: it says "ss?" (the speech bubble), `smoothSlap` plays on that enemy, the
// piece is TAKEN off it (its first one) and a copy goes on Ti (the chip appears on it), and the cooldown starts. Its attacks (a `burstArrow`, range 7, magic fire damage with a `moe` on the target and the tiles around it) and its
// slow walk east are not drawn here. Here an enemy with an amulet stands next to Ti.
function sceneTi() {
  const T = 500;
  const victim = [1, 0];
  const ITEM = 3057;
  return {
    ...sceneBoard(2), noAutoAttack: true, cooldownCastAt: T, casterFacing: 'east',
    mates: [{ dx: victim[0], dy: victim[1], facing: 'west' }],
    overlays: [{ kind: 'say', text: 'ss?', dx: 0, dy: 0, at: T, ms: 1500, size: 12 }],
    passives: [{ right: true, windows: [[T, null]], equip: { spriteId: ITEM, stat: 'hp', tiers: [{ tier: 5, from: T, until: null }] } }],
    holdMs: T + 2400,
    fx: [{ n: 'smoothSlap', id: 213, f: 18, tiles: [victim], at: T }]
  };
}

// Witch: the frogs turn back this long after the spell lands (DEBUFF_DURATION_MS).
const WITCH_FROG_UNTIL = `land+${CREATURE_COMBAT_DATA[66]?.c?.DEBUFF_DURATION_MS ?? 4000}`;
// BEGIN ABILITY_SCENE_OVERRIDES
const ABILITY_SCENE_OVERRIDES = {
  // Monk: the normal meditation blast hits only the tiles around it (`position.tile.neighbors`); awakened, the 5x5 (see ABILITY_SCENE_AWAKENED).
  // Monk: meditates for 6s (CHANNEL_DURATION_MS 6000) facing south: it floats and glows (`monkMeditating`), the `holyCircle` aura loops on it (1.2s a loop),
  // +70 armour and magic resist (the `levitate` chip) and a heal every 1.5s (`haste`), while the damage it takes is counted (the `holyburst`
  // chip). Here a villain Ti beside it shoots it twice. When the meditation ends it blasts the enemies around it (`holyArrow` flies to each,
  // `holyExory` on it) for that damage x 40% (+ 0.125% per AP) as silent holy magic (yellow, a crit). It starts 500ms into the loop.
  24: { n: 'Monk', sc: { numbers: [sceneDmg(1640, 'self', 'fire'), sceneDmg(3640, 'self', 'fire'), sceneHeal(2000, 'self'), sceneHeal(3500, 'self'), sceneHeal(5000, 'self'), sceneHeal(6500, 'self'), sceneDmg(6640, [1, 0], 'holy', true)],
    ...sceneSelf(), gridHalf: 2, flashes: [{ at: 6640, tiles: sceneArea(SCENE_RING) }], casterFacing: 'south', meditate: { from: 500, until: 6500 }, // the blast area lights when it blasts
    attacker: { ...SCENE_VILLAIN_TI, dx: 1, dy: 0, aim: [0, 0], at: 1640 - SCENE_MISSILE_MS },
    passives: [{ src: 'levitate', windows: [[500, 6500]] }, { src: 'holyburst', windows: [[500, 6500]] }],
    flights: [{ shot: SCENE_VILLAIN_TI.shot, from: [1, 0], to: [0, 0], at: 3640 - SCENE_MISSILE_MS }, { shot: { n: 'holyArrow', id: 38 }, from: [0, 0], to: [1, 0], at: 6640 - SCENE_MISSILE_MS }],
    fx: [
      { ...SCENE_FX.holyCircle, w: 'self', at: 500 }, { ...SCENE_FX.holyCircle, w: 'self', at: 1700 }, { ...SCENE_FX.holyCircle, w: 'self', at: 2900 },
      { ...SCENE_FX.holyCircle, w: 'self', at: 4100 }, { ...SCENE_FX.holyCircle, w: 'self', at: 5300 },
      { ...SCENE_FX.moe, w: 'self', at: 1640 }, { ...SCENE_FX.moe, w: 'self', at: 3640 },
      { ...SCENE_FX.haste, w: 'self', at: 2000 }, { ...SCENE_FX.haste, w: 'self', at: 3500 }, { ...SCENE_FX.haste, w: 'self', at: 5000 }, { ...SCENE_FX.haste, w: 'self', at: 6500 },
      { n: 'holyExory', id: 40, f: 14, to: [1, 0], at: 6640 }
    ] } },  // Druid: every 4s it casts Ultimate Healing on the most wounded ally (else itself): a heal of 2 + 0.2 AP (silent: `slowYellowHeal` on the ally and the
  // heal number), and +20 (+0.5 per AP) ability power for 6s (the `ultimatehealing` chip). It always flees from enemies: the step away comes in the same tick as the
  // cast. Here the ally Astronis (up left) is healed and a villain Ti stands to the right, so the Druid runs west. Awakened: see ABILITY_SCENE_AWAKENED.
  29: { n: 'Druid', sc: { numbers: [sceneHeal(500, [-2, -2])], m: [{ a: 'self', rows: ['+'], g: 1 }], mi: [],
    mates: [{ dx: -2, dy: -2 }, sceneTiMate(2, 0, 'west')], casterFlee: { at: 500, from: [[2, 0]] },
    passives: [{ src: 'ultimatehealing', windows: [[500, 6500]] }],
    fx: [{ n: 'slowYellowHeal', id: 182, f: 22, to: [-2, -2], at: 500 }] } },
  // Fire Devil (range 2, always keeps its distance): a `fire` missile; at the target a big `largeFireExplosion` + `fire` burn, then an explosion
  // on EVERY tile of the area (all at 70% opacity: the game's style). Magic damage in `fire` colour (the hit also bleeds). The game picks the area
  // mask through a variable (5x5, or 7x7 on every 3rd awakened cast), so the parser cannot read it.
  20: { n: 'Fire Devil', sc: { numbers: [sceneDmg('land', 'target', 'fire')], lead: 300, m: [{ a: 'target', rows: ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO'] }], mi: [{ n: 'fire', id: 4 }], fx: [{ ...SCENE_FX.largeFireExplosion, b: 1, opacity: 0.7 }, { ...SCENE_FX.fire, b: 1, sz: 1 }, { ...SCENE_FX.largeFireExplosion, opacity: 0.7 }] } },
  // Dwarf Soldier: the auto attack sprays 3 piercing bolts, at the target and the two tiles beside it (the ones on the
  // caster's side: left and below for the preview's lower-left caster). `to` = bolt landing offset, `sim` = fired together.
  // The Pale Count: see scenePaleCount.
  121: { n: 'The Pale Count', sc: scenePaleCount() },
  // Vampire Bride: see sceneVampireBride.
  122: { n: 'Vampire Bride', sc: sceneVampireBride() },
  // Nomad: see sceneNomad.
  103: { n: 'Nomad', sc: sceneNomad(false) },
  // Giant Spider: see sceneGiantSpider.
  76: { n: 'Giant Spider', sc: sceneGiantSpider() },
  // Monster Cauldron: see sceneMonsterCauldron.
  83: { n: 'Monster Cauldron', sc: sceneMonsterCauldron() },
  // Cyclops Drone: see sceneCyclopsDrone.
  112: { n: 'Cyclops Drone', sc: sceneCyclopsDrone(false) },
  // Omruc: see sceneOmruc.
  106: { n: 'Omruc', sc: sceneOmruc() },
  // Ancient Scarab: see sceneAncientScarab.
  99: { n: 'Ancient Scarab', sc: sceneAncientScarab() },
  // Vladrukh: see sceneVladrukh.
  126: { n: 'Vladrukh', sc: sceneVladrukh(false) },
  // Dharalion: see sceneDharalion.
  79: { n: 'Dharalion', sc: sceneDharalion() },
  // Thalas: see sceneThalas.
  101: { n: 'Thalas', sc: sceneThalas() },
  // Grynch Clan Commander: see sceneGrynchCommander.
  84: { n: 'Grynch Clan Commander', sc: sceneGrynchCommander() },
  // Bonelord: see sceneBonelord.
  105: { n: 'Bonelord', sc: sceneBonelord() },
  // Old Giant Spider: see sceneOldGiantSpider.
  67: { n: 'Old Giant Spider', sc: sceneOldGiantSpider() },
  // Corym Vanguard: see sceneCorymVanguard.
  73: { n: 'Corym Vanguard', sc: sceneCorymVanguard() },
  // The Percht Queen: see scenePerchtQueen.
  90: { n: 'The Percht Queen', sc: scenePerchtQueen() },
  // Corym Charlatan: see sceneCorymCharlatan.
  71: { n: 'Corym Charlatan', sc: sceneCorymCharlatan(false) },
  // Rorc: see sceneRorc.
  60: { n: 'Rorc', sc: sceneRorc(false) },
  // Magma Crystal: see sceneMagmaCrystal.
  58: { n: 'Magma Crystal', sc: sceneMagmaCrystal() },
  // Energy Crystal: see sceneEnergyCrystal.
  57: { n: 'Energy Crystal', sc: sceneEnergyCrystal() },
  // Dwarf Geomancer: see sceneDwarfGeomancer.
  56: { n: 'Dwarf Geomancer', sc: sceneDwarfGeomancer(false) },
  // Dwarf Guard: see sceneDwarfGuard.
  55: { n: 'Dwarf Guard', sc: sceneDwarfGuard(false) },
  // Dwarf Soldier: see sceneDwarfSoldier.
  54: { n: 'Dwarf Soldier', sc: sceneDwarfSoldier(false) },
  // Skeleton: the ability is the revive (a self ability: caster-centred, no target or dummy). It dies, then comes back after
  // a delay: `phantom` on itself and the game's `fadeIn 3000ms` (the creature fades in over 3s). `transform` without an outfit = gone from `at` to `until`, then fades in over `fade` ms.
  7: { n: 'Skeleton', sc: { numbers: [sceneDmg(640, 'self', 'fire')], m: [{ a: 'self', rows: SCENE_RING }], mi: [], lead: 520,
    // A villain Ti (game id 119, ranged) two tiles east shoots it: `burstArrow` flies in (the game's Ti attack) and bursts
    // with `moe` on the target tile and its 8 neighbours (silent magic damage: no blood). `attacker`: the shooter.
    attacker: { ...SCENE_VILLAIN_TI, dx: 2, dy: 0, at: 640 - SCENE_MISSILE_MS },
    // Dead from the hit, the corpse lies until the revive: `phantom` on itself and the game's `fadeIn 3000ms`.
    transform: { at: 700, until: 2600, fade: 3000, corpse: 4285 }, fx: [
    { ...SCENE_FX.moe },
    { n: 'phantom', id: 66, f: 24, w: 'self', at: 2600 }
  ] } },
  // Minotaur: the stomp hits only the 8 neighbouring tiles (`tile.neighbors`); awakened adds the outer ring of the diamond
  // (see ABILITY_SCENE_AWAKENED) plus a self-heal and cooldown refresh.
  2: { n: 'Minotaur', sc: { m: [{ a: 'self', rows: SCENE_RING }], mi: [], fx: [{ ...SCENE_FX.groundshaker }] } },
  // Minotaur Mage: an energy missile at one random enemy, a comet falls on it; awakened adds a 5x5 storm splash around it.
  3: { n: 'Minotaur Mage', sc: { numbers: [sceneDmg('land', 'target', 'true')], noBlood: 1, m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [{ n: 'energy', id: 36 }], fx: [{ n: 'fallingCommet', id: 243, f: 6 }] } },
  // Sheep: heals the adjacent ally it follows: a `heart` on the Sheep and `haste` (the game's effect for any heal) on the
  // ally (the Astronis dummy: `allyTarget`, and no blood: `noBlood`). The comet / missile / sparks of the old row belong to its on-death heal and awakened
  // revive, which happen only once at its death: not drawn.
  5: { n: 'Sheep', sc: { numbers: [sceneHeal(300)], noBlood: 1, allyTarget: 1, m: [{ a: 'target', rows: ['+'] }], mi: [], fx: [
    { n: 'heart', id: 36, f: 16, w: 'self', at: 300 },
    { ...SCENE_FX.haste, b: 1, at: 300 }
  ] } },
  // Scorpion: its auto attack (a physical hit, so blood) poisons the target for 12s: a magic tick every 1.5s (`earth` on it, silent, the game's
  // green poison filter, the `envenom` chip). If a poisoned enemy dies it bursts as a poison bomb: `earthPoof` (zoomed 2x, half opacity) on it, a
  // critical magic hit on the enemies next to it, which get poisoned too. Here the target (a villain Ti) dies of the poison and a villain Ti beside it is hit.
  23: { n: 'Scorpion', sc: { statusIcons: [{ at: 500, icon: 'poison' }], numbers: [sceneDmg('land'), sceneDmg(2000, 'target', 'earth'), sceneDmg(3500, 'target', 'earth'), sceneDmg(5000, [-1, -1], 'earth', true)],
    ...sceneTarget(), lead: 500,
    flashes: [{ at: 5000, tiles: sceneArea(SCENE_RING) }], // the poison boom: every creature next to the dead target
    dummyTint: { at: 500, filter: SCENE_POISON_FILTER }, dummyHidden: { from: 5000, until: 99999 },
    mates: [{ id: 119, dx: -1, dy: -1, tint: { at: 5000, filter: SCENE_POISON_FILTER } }],
    passives: [{ src: 'envenom', windows: [[500, 5000]] }],
    fx: [
      { n: 'earth', id: 9, f: 8, b: 1, at: 2000 },
      { n: 'earth', id: 9, f: 8, b: 1, at: 3500 },
      { n: 'earthPoof', id: 21, f: 12, b: 1, at: 5000, z: 2, tx: 0.25, ty: 0.25, opacity: 0.5 }
    ] } },
  // Dragon Lord: every 5s a fire bomb on its target: a `fire` missile, the target and the enemies in the 5x5 around it burn (magic `fire` damage, the
  // `fire` effect, blood) and every tile of the area gets a fire field (item 2118) that stays to the end of the battle; an enemy that steps on one burns
  // again. Here a villain Ti walks across the field (the burn comes the moment it enters a tile). Awakened: creatures on a fire field get
  // +30 speed (the `firewalkerboots` chip and the `pulse` style).
  26: { n: 'Dragon Lord', sc: { numbers: [sceneDmg('land', 'target', 'fire')], lead: 300,
    m: [{ a: 'target', rows: DRAGON_LORD_MASK }], mi: [{ n: 'fire', id: 4 }],
    // After the bomb, a villain Ti walks across the field along the row above the target (tile 64 to 70) and burns on every field tile it enters (`onEnter`).
    mates: [
      { id: 119, anchor: 'target', dx: -3, dy: -1, facing: 'east', walk: { at: 1000, steps: [[1, 0], [1, 0], [1, 0], [1, 0], [1, 0], [1, 0]], onEnter: { fx: { ...SCENE_FX.fire }, number: 'fire', tiles: [[0, 0], ...sceneArea(DRAGON_LORD_MASK)] } } }
    ],
    overlays: sceneFireFields(500),
    fx: [{ ...SCENE_FX.fire, b: 1 }] } },
  // Stalker: every 7s it turns invisible for 6s (`poof` on it; while invisible the game draws the looping `heal` effect (13) in place of the creature, and it
  // shows again at once (the game fades it in over 200ms; the scene does not)), +30 speed (+1 per 2 AP: nothing to draw) and a heal of 3 + 0.15 AP every 800ms (7 ticks; the `utanigranhur` chip, `haste`).
  // Its auto attacks while invisible are crits of true damage (white, silent) with the `chip` effect on the target; it attacks every 2s, starting the moment
  // it casts. Awakened it only picks the weakest enemy (nothing to draw).
  27: { n: 'Stalker', sc: { numbers: [sceneDmg(500, 'target', 'true', true), sceneDmg(2500, 'target', 'true', true), sceneDmg(4500, 'target', 'true', true),
      ...[1300, 2100, 2900, 3700, 4500, 5300, 6100].map((at) => sceneHeal(at, 'self'))],
    ...sceneTarget(), noBlood: 1, transform: { at: 500, until: 6500 },
    passives: [{ src: 'utanigranhur', windows: [[500, 6500]] }],
    fx: [
      { ...SCENE_FX.poof, w: 'self', at: 500 },
      ...[500, 1380, 2260, 3140, 4020, 4900, 5780].map((at) => ({ ...SCENE_FX.heal, w: 'self', at })),
      ...[500, 2500, 4500].map((at) => ({ n: 'chip', id: 4, f: 9, b: 1, at })),
      ...[1300, 2100, 2900, 3700, 4500, 5300, 6100].map((at) => ({ ...SCENE_FX.haste, w: 'self', at }))
    ] } },
  // Mummy: its auto attack (a physical hit, silent: no blood) curses the target for 4s: `mummyGrayscale` (the target turns half grey), `bloodyHands` on it,
  // the slow icon, the `slowmud` chip, -50% speed (so it walks half as fast) and, every time it MOVES, magic damage of 5% (+0.1% per AP) of its current HP
  // (dark red, `hpBlack`; a crit while it is at 50% or more) with `suddenDeath` on it. Here the target is a villain Ti (the tree cannot move) that runs from the
  // Mummy; the first two steps are crits. Awakened: every 2s everyone alive takes true damage (0.15 AP, grey `zombie`) in order of distance, nearest first
  // (one per tick), and `blackBlood` (zoomed 2x, half opacity) bursts on the Mummy.
  28: { n: 'Mummy', sc: { numbers: [sceneDmg(500)], statusIcons: [{ at: 500, icon: 'slow' }],
    ...sceneTarget(), noBlood: 1, noDummy: true, gridHalf: 3, // a 7x7 grid: Ti runs 3 tiles west
    passives: [{ src: 'slowmud', windows: [[500, 4500]] }],
    mates: [{ id: 119, anchor: 'target', dx: 0, dy: 0, facing: 'east', tint: { at: 500, filter: 'grayscale(0.5)' },
      walk: { at: 700, steps: [[-1, 0], [-1, 0], [-1, 0]], speedScale: 0.5,
        onEnter: { fx: { n: 'suddenDeath', id: 18, f: 11 }, number: 'hpBlack', critSteps: 2, tiles: [[-1, 0], [-2, 0], [-3, 0]] } } }],
    fx: [{ n: 'bloodyHands', id: 63, f: 12, b: 1, at: 500, tx: 0.172, ty: -0.125, filter: 'hue-rotate(60deg) brightness(2)' }] } },
  // Fire Elemental (range 99, a ranged creature): every 4s a `fire` missile at a random enemy: a big `largeFireExplosion` (70% opacity) and `fire` on it, a crit of
  // magic `fire` damage (20 + 1.3 AP), and the explosion on the four tiles beside it (a plus) where the enemies standing there take half (no crit). Here a villain Ti
  // stands next to the target. Awakened it only goes for the enemy its team targets most (nothing to draw).
  30: { n: 'Fire Elemental', sc: { numbers: [sceneDmg('land', 'target', 'fire', true), sceneDmg('land', { target: [-1, 0] }, 'fire')], lead: 300, castRange: 3,
    m: [{ a: 'target', rows: ['OXO', 'X+X', 'OXO'] }], mi: [{ n: 'fire', id: 4 }],
    mates: [sceneTiMate(-1, 0, 'east', { anchor: 'target' })],
    fx: [{ ...SCENE_FX.largeFireExplosion, b: 1, opacity: 0.7 }, { ...SCENE_FX.fire, b: 1 }, { ...SCENE_FX.largeFireExplosion, opacity: 0.7 }] } },
  // Frost Troll (range 2): every 7s a `snowball` at its target: a crit of magic `ice` damage (15 + 0.7 AP; blood) and a Snowman (summon, 3 hits to destroy) on a free tile
  // beside the target, which TAUNTS the target (the `bigsnowball` chip: it attacks the Snowman). The target here is a villain Ti (the tree would not attack); it shoots
  // the Snowman three times and the Snowman is gone. Awakened: a unit that hits the Snowman gets -10% attack speed for 3s (the debuff icon, `snowFalling`, the
  // `snowman-debuff` chip).
  31: { n: 'Frost Troll', sc: { numbers: [sceneDmg('land', 'target', 'ice', true)], castRange: 2, lead: 300, noDummy: true,
    m: [{ a: 'target', rows: ['+'], g: 1 }], mi: [{ n: 'snowball', id: 13 }],
    attacker: { ...SCENE_VILLAIN_TI, dx: 0, dy: 0, aim: [0, -1], at: 1700 - SCENE_MISSILE_MS, // Ti looks at the Frost Troll, at the Snowman while it is taunted, and at the Frost Troll again once the Snowman is gone
      aims: [{ until: 650, at: 'caster' }, { from: 650, until: 3700, at: [0, -1] }, { from: 3700, at: 'caster' }] },
    mates: [{ outfit: 1159, anchor: 'target', dx: 0, dy: -1, at: 650, bouncyFall: true, dies: { at: 3700, corpse: false } }],
    flights: [{ shot: SCENE_VILLAIN_TI.shot, from: [0, 0], to: [0, -1], at: 2700 - SCENE_MISSILE_MS }, { shot: SCENE_VILLAIN_TI.shot, from: [0, 0], to: [0, -1], at: 3700 - SCENE_MISSILE_MS }],
    passives: [{ src: 'bigsnowball', windows: [[650, 3700]] }], statusIcons: [sceneTaunt(775)], // the Snowman taunts Ti two ticks after it lands (`onTaunt`)
    fx: [{ ...SCENE_FX.poof, tiles: [[0, -1]], at: 775 }, ...[1700, 2700, 3700].map((at) => ({ ...SCENE_FX.moe, tiles: [[0, -1]], at }))] } },
  // Water Elemental: see sceneWaterElemental.
  33: { n: 'Water Elemental', sc: sceneWaterElemental(false) },
  // Minotaur Archer (range 4, a ranged creature; the CURRENT class: the game's code still holds an old attack-speed version too): the passive `sharpshooter` stocks +1 bolt
  // (an ammo counter, up to 6, the chip's number) every time it takes damage; its next attack is a crit of physical damage plus one `infernalBolt` per bolt stocked, a tick
  // apart, each 4 physical damage (`fire` colour), which empties the ammo. Awakened, reaching 6 bolts resets its auto-attack cooldown at once. Here a villain Ti shoots it
  // 3 times (6 awakened: the attack follows at once) and it discharges.
  34: { n: 'Minotaur Archer', sc: sceneMinotaurArcher(false) },
  // Minotaur Guard: see sceneMinotaurGuard.
  35: { n: 'Minotaur Guard', sc: sceneMinotaurGuard(false) },
  // Witch (range 99): the extracted scene with the caster three tiles out, so the board is 7 x 7 instead of 9 x 9 or more.
  66: { n: 'Witch', sc: { m: [{ a: 'target', rows: ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO'] }], mi: [{ n: 'energyBeam', id: 5 }], castRange: 3,
    // `teleportBlue` covers every tile of the area as the spell lands; `magicPoof` plays on each frog when it turns back (DEBUFF_DURATION_MS later).
    fx: [{ ...SCENE_FX.teleportBlue }, ...[[0, 0], [1, 0], [-1, 1]].map((tile) => ({ ...SCENE_FX.magicPoof, tiles: [tile], at: WITCH_FROG_UNTIL }))],
    // The hit is MAGIC damage (DAMAGE_BASE + DAMAGE_PER_AP, always a crit): the Witch has no attack damage and no auto-attack, so no physical number.
    numbers: [sceneDmg('land', 'target', 'magic', true), sceneDmg('land', { target: [1, 0] }, 'magic', true), sceneDmg('land', { target: [-1, 1] }, 'magic', true)],
    // The spell turns every enemy in the area into a green frog (the game's outfit 500007) for DEBUFF_DURATION_MS, from the moment it lands: the target and two villain Ti beside it.
    dummyForm: { outfit: 500007, at: 'land', until: WITCH_FROG_UNTIL },
    mates: [[1, 0, 'west'], [-1, 1, 'east']].map(([dx, dy, facing]) => sceneTiMate(dx, dy, facing, { anchor: 'target', form: { outfit: 500007, at: 'land', until: WITCH_FROG_UNTIL } })) } },
  // Werefox: see sceneWerefox.
  110: { n: 'Werefox', sc: sceneWerefox(false) },
  // Wyvern: see sceneWyvern.
  36: { n: 'Wyvern', sc: sceneWyvern(false) },
  // Polar Bear: see scenePolarBear.
  38: { n: 'Polar Bear', sc: scenePolarBear() },
  // Elf: see sceneElf.
  39: { n: 'Elf', sc: sceneElf(false) },
  // Elf Scout: see sceneElfScout.
  40: { n: 'Elf Scout', sc: sceneElfScout(false) },
  // Orc Leader: see sceneOrcLeader.
  43: { n: 'Orc Leader', sc: sceneOrcLeader() },
  // Orc Shaman: see sceneOrcShaman.
  44: { n: 'Orc Shaman', sc: sceneOrcShaman() },
  // Wasp: the sting is a silent physical hit (`noEmitParticles`: no blood, `noBlood`) that puffs `earthPoof` on the target and
  // poisons it; the poison then ticks every 4s (magic, also silent) with `earth` on the target. Awakened (permanent poison,
  // +25 speed) looks the same. Times in ms: the hit, then the first poison tick 4s later. `dummyTint`: the game's green poison
  // filter on the target from the sting on (it lasts 24s, or forever awakened: the whole loop). Then it flees (`casterFlee`): no target is left.
  6: { n: 'Wasp', sc: { casterFlee: { at: 1000 }, statusIcons: [{ at: 500, icon: 'poison' }], numbers: [sceneDmg(500), sceneDmg(4500, 'target', 'earth')], noBlood: 1, dummyTint: { at: 500, filter: SCENE_POISON_FILTER }, m: [{ a: 'target', rows: ['+'] }], mi: [], fx: [
    { n: 'earthPoof', id: 21, f: 12, b: 1, at: 500 },
    { n: 'earth', id: 9, f: 8, b: 1, at: 4500 }
  ] } },
  // Rotworm: a passive. Whenever any unit dies a `rot` missile flies from it TO the Rotworm, which gains a rot stack (bonus
  // attack damage, armour and magic resist) and heals (a heal plays `haste` on the healer). Here a villain Ti shoots the
  // Rotworm's ally dead (`burstArrow`, `moe` on it); the rot flies from the corpse to the Rotworm in the middle.
  10: { n: 'Rotworm', sc: { numbers: [sceneDmg(640, [-2, 0], 'fire'), sceneHeal(925, 'self')], m: [{ a: 'self', rows: ['+'] }], mi: [],
    attacker: { ...SCENE_VILLAIN_TI, dx: -2, dy: -2, aim: [-2, 0], at: 640 - SCENE_MISSILE_MS },
    mates: [{ dx: -2, dy: 0, dies: { at: 700 } }],
    // The rot stack chip (`pileoftrash`): +1 stack when the rot reaches it.
    passives: [{ src: 'pileoftrash', windows: [[925, null]], counts: [{ at: 925, n: 1 }] }],
    flights: [{ shot: { n: 'rot', id: 39 }, from: [-2, 0], to: [0, 0], at: 700 }],
    fx: [
      { ...SCENE_FX.moe, to: [-2, 0], at: 640 },
      { ...SCENE_FX.haste, w: 'self', at: 925 }
    ] } },
  // Spider: casts a web at the farthest enemy within 4 tiles (shown from 3): an `earthSpell` missile, `earthSpinningRoots` on
  // the target, which turns grey (`spiderGrayscale`: 90% grayscale for the stun) and takes magic damage (so blood), and webs
  // (items spiderWebCenter / spiderWeb0-3, `fadeOutAtEnd` over the stun, 500ms + 50ms per ability power = 3500ms) on its tile and
  // the 4 around it; those 4 take half damage. Awakened (armour, taunted allies with double attack) has no visual here.
  11: { n: 'Spider', sc: { numbers: [sceneDmg('land', 'target', 'earth', true)], castRange: 3, lead: 500, m: [{ a: 'target', rows: ['OXO', 'X+X', 'OXO'] }], mi: [{ n: 'earthSpell', id: 30 }],
    fx: [{ n: 'earthSpinningRoots', id: 55, f: 14, b: 1 }],
    dummyTint: { at: 710, filter: 'grayscale(0.9)' }, stuns: [{ at: 710, ms: 3500, shake: false }], // the web stuns for 3.5s (bar only)
    overlays: sceneWebs(710, 3500) } },
  // Goblin: throws `smallStone` at its target (physical, so blood on it); every so many throws its distance fighting levels up:
  // `raiseStat` on itself (and a 2-blink pulse, not drawn) for +3 attack damage. Range 4 (shown from 3). Awakened: each level
  // up also gives every allied goblin attack speed, with `raiseStat` on them too (see ABILITY_SCENE_AWAKENED).
  12: { n: 'Goblin', sc: { numbers: [sceneDmg('land'), sceneDmg(2210)], castRange: 3, lead: 500, m: [{ a: 'target', rows: ['+'] }], mi: [{ n: 'smallStone', id: 10 }],
    flights: [{ shot: { n: 'smallStone', id: 10 }, from: [3, 3], to: [0, 0], at: 2210 - SCENE_MISSILE_MS }],
    // The passive chip (`distancelevel`): the level, 1 -> 2 at the level up.
    passives: [{ src: 'distancelevel', counts: [{ at: 0, n: 1 }, { at: 2300, n: 2 }] }],
    fx: [
      { ...SCENE_FX.bleed, b: 1, land: 1 },
      { ...SCENE_FX.bleed, b: 1, at: 2210 },
      { ...SCENE_FX.raiseStat, w: 'self', at: 2300 }
    ] } },
  // Wolf: its attacks cut the ability's cooldown; when ready, the next attack is a bite: magic damage of the target's missing HP
  // (`bite` on the target, which flinches, and blood). Awakened, the cast also howls (`drown`, zoom 3, hue-rotated) and gives every
  // allied lupine AP (`raiseStat` hue-rotated) for 3s, with the `lupine-ap` chip counting the lupines (see ABILITY_SCENE_AWAKENED).
  13: { n: 'Wolf', sc: { numbers: [sceneDmg(500, 'target', 'magic', true)], lead: 380, m: [{ a: 'target', rows: ['+'] }], mi: [], flinch: { at: 500 }, fx: [{ n: 'bite', id: 214, f: 14, b: 1 }] } },
  // Winter Wolf: when the ability is ready its next attack is a bite: a crit of magic damage (15 + 0.5 AP; blood), `iceCrystal` on the target, which is stunned for 1s
  // (it shakes) and gets -15% attack speed for 3s (the `winterwolfbite` chip). Plain attacks cut the bite's cooldown by 2s. Awakened: see ABILITY_SCENE_AWAKENED.
  32: { n: 'Winter Wolf', sc: { numbers: [sceneDmg(500, 'target', 'magic', true)], lead: 380, m: [{ a: 'target', rows: ['+'] }], mi: [],
    // the 1s stun (STUN_TICKS 16): the game's yellow stun bar above the target's head, draining, and the target shakes (`shaking`, 100ms)
    stuns: [{ at: 500, ms: 1000 }],
    passives: [{ src: 'winterwolfbite', windows: [[500, 3500]] }], fx: [{ n: 'iceCrystal', id: 53, f: 22, b: 1 }] } },
  // Poison Spider: when the ability is ready the next attack is a flurry: `voidSpark` on the target, which flinches, then 3 magic bites
  // (the 2nd and 3rd 187ms and 375ms later). The bites are silent (`noEmitParticles`): no blood, only damage numbers. Awakened it heals
  // 15% of every magic damage dealt, with `paralize` on itself each time (see ABILITY_SCENE_AWAKENED).
  15: { n: 'Poison Spider', sc: { numbers: [sceneDmg(500, 'target', 'earth', true), sceneDmg(687, 'target', 'earth', true), sceneDmg(875, 'target', 'earth', true)], noBlood: 1, m: [{ a: 'target', rows: ['+'] }], mi: [], flinch: { at: 500 }, fx: [{ n: 'voidSpark', id: 221, f: 16, b: 1, at: 500 }] } },
  // Snake: a petrifying ray down the line it faces (the Snake on 83 looks west: tiles 82, 81, 80, 79): `energy` on each tile one tick
  // after the other. An enemy hit (the tree) is stunned (3s + 0.3s per AP = 4.8s), takes silent magic damage (no blood, `noBlood`),
  // gets `smoke` and is turned into a knight statue (item 2059 falls in, `bouncyFall`); each EMPTY tile of the ray gets a statue too.
  // At the end the statues fade out and `blackBlood` (half opacity) plays where the target was. Awakened also zeroes the target's AD and
  // AP while petrified: no visual.
  16: { n: 'Snake', sc: { numbers: [sceneDmg(500, 'target', 'zombie', true)], noBlood: 1, m: [{ a: 'target', rows: ['+'] }], mi: [], dummyHidden: { from: 500, until: 5300 }, stuns: [{ at: 500, ms: 4800, shake: false }], // petrified for 4.8s (bar only)
    overlays: [
      { kind: 'fall', anchor: 'target', id: 2061, at: 500, ms: 4800 }, // the target's statue faces east, toward the Snake (the game's `knightStatue_<direction>`)
      { kind: 'fall', id: 2059, dx: -2, at: 562, ms: 4738 },
      { kind: 'fall', id: 2059, dx: -3, at: 625, ms: 4675 }
    ],
    fx: [
      { ...SCENE_FX.energy, to: [-1, 0], at: 500 },
      { ...SCENE_FX.energy, to: [-2, 0], at: 562 },
      { ...SCENE_FX.energy, to: [-3, 0], at: 625 },
      { n: 'smoke', id: 242, f: 24, b: 1, at: 500 },
      { n: 'blackBlood', id: 202, f: 6, b: 1, at: 5300, opacity: 0.5 }
    ] } },
  // Slime: clones itself: a Squidgy Slime (the same sprite, 5 HP) appears on a free tile next to it with `teleportBlue`, and `heal` plays
  // on the Slime; up to 2 clones (the cooldown is 12s minus 0.08s per AP: 7.2s at 60 AP, shown shorter). Awakened: one more clone, and if
  // the main Slime dies a clone takes over (a `poisonSting` flies from the dead Slime to it): see ABILITY_SCENE_AWAKENED.
  18: { n: 'Slime', sc: { m: [{ a: 'self', rows: ['+'] }], mi: [],
    mates: [{ id: 18, dx: -1, dy: -1, at: 500 }, { id: 18, dx: 1, dy: 1, at: 1500 }],
    fx: [
      { ...SCENE_FX.teleportBlue, to: [-1, -1], at: 500 },
      { ...SCENE_FX.heal, w: 'self', at: 500 },
      { ...SCENE_FX.teleportBlue, to: [1, 1], at: 1500 },
      { ...SCENE_FX.heal, w: 'self', at: 1500 }
    ] } },
  // Ghoul: a pulse aura every 2s: the Ghoul and every enemy on or around it take true damage (silent: no blood), the Ghoul heals 2% max HP
  // per enemy. The game draws a yellow ripple (a radial gradient, 52px, expanding to x2 and fading over 1s: `animate-ping`) at each pulse and
  // keeps four fireflies (item `firefly`, 5.35s loop, two mirrored, delays 0 / 2.7s / 1.35s / 4.05s) around it once it has pulsed. A villain
  // Ti stands next to it as the enemy in range. Awakened the drain persists after the Ghoul dies (ABILITY_SCENE_AWAKENED).
  19: { n: 'Ghoul', sc: { numbers: [sceneDmg(500, [1, 0], 'stamina-medium'), sceneDmg(500, 'self', 'stamina-medium'), sceneHeal(500, 'self'), sceneDmg(2500, [1, 0], 'stamina-medium'), sceneDmg(2500, 'self', 'stamina-medium'), sceneHeal(2500, 'self')], m: [{ a: 'self', rows: ['+'] }], mi: [],
    // every pulse hits the Ghoul and the 8 tiles around it: the area lights with each one
    flashes: [500, 2500].map((at) => ({ at, ms: 800, tiles: sceneArea(SCENE_RING) })),
    mates: [{ id: 119, dx: 1, dy: 0 }],
    overlays: [
      { kind: 'ping', size: 52, color: '#f0f000cc', at: [500, 2500], ms: 1000 },
      { kind: 'loop', id: 6490, f: 20, loopMs: 5350, keys: SCENE_FIREFLY_KEYS, at: 500, delay: 0 },
      { kind: 'loop', id: 6490, f: 20, loopMs: 5350, keys: SCENE_FIREFLY_KEYS, at: 500, delay: 2700 },
      { kind: 'loop', id: 6490, f: 20, loopMs: 5350, keys: SCENE_FIREFLY_KEYS, at: 500, delay: 1350, mirror: true },
      { kind: 'loop', id: 6490, f: 20, loopMs: 5350, keys: SCENE_FIREFLY_KEYS, at: 500, delay: 4050, mirror: true }
    ] } },
  // Demon Skeleton: when it dies it channels for 3s, then revives with a fiendish curse: `teleportRed` on it, a red whirlpool aura (item
  // 23483, 15 frames per 1.5s, 50% opacity) under it for as long as the curse lasts, +15 AD / lifesteal / +30% attack speed (no visual), and every
  // 1s it takes 10% of its max HP as silent true damage (the `undyingrage` chip counts the ticks). Here a villain Ti kills it (like the Skeleton),
  // then the channel, the revive and two curse ticks. Awakened: the curse takes 10% of its CURRENT HP, shown in the `awaken` colour, and
  // the sprite glows (`drop-shadow 5px awaken`).
  21: { n: 'Demon Skeleton', sc: { numbers: [sceneDmg(640, 'self', 'fire'), sceneDmg(4700, 'self', 'true'), sceneDmg(5700, 'self', 'true')],
    m: [{ a: 'self', rows: SCENE_RING }], mi: [], lead: 520,
    attacker: { ...SCENE_VILLAIN_TI, dx: 2, dy: 0, at: 640 - SCENE_MISSILE_MS },
    transform: { at: 700, until: 3700, fade: 200, corpse: 3990 },
    overlays: [{ kind: 'aura', id: 23483, f: 15, loopMs: 1500, at: 3700, fadeMs: 200, op: 0.5 }],
    passives: [{ src: 'undyingrage', windows: [[3700, null]], counts: [{ at: 4700, n: 1 }, { at: 5700, n: 2 }] }],
    fx: [{ ...SCENE_FX.moe }, { n: 'teleportRed', id: 223, f: 11, w: 'self', at: 3700 }] } },
  8: { n: 'Tortoise', sc: { numbers: [sceneDmg(1940, 'self', 'fire'), sceneDmg(1940, [1, 0], 'fire'), sceneHeal(2200, [1, 0])], m: [{ a: 'self', rows: SCENE_RING }], mi: [], lead: 1820,
    // The Turtle Shell: Tortoise already wears it (the green whirlpool aura, item 36744, 15 frames per 1500ms, is on from the
    // start; the spawn drop is not part of the loop). When the holder dies it detaches (aura gone) and the nearest living ally
    // gets the shell: the shell item (5899) drops in from the tile above over 600ms (`translateFromAbove`) and fades out
    // (`fadeOut 400ms 200ms`, half opacity), the aura fades in over 1000ms, and a full heal (`haste`). A villain Ti (`attacker`, as in
    // Skeleton) shoots Tortoise dead (`transform`: no revive, corpse 6072); `mates`: the ally (the shared ally dummy, Astronis) beside it.
    attacker: { ...SCENE_VILLAIN_TI, dx: -2, dy: 0, at: 1940 - SCENE_MISSILE_MS },
    mates: [{ dx: 1, dy: 0 }],
    // The shell's chip (`turtleshell`) is on its holder until it dies.
    passives: [{ src: 'turtleshell', windows: [[0, 2000]] }],
    transform: { at: 2000, corpse: 6072 },
    fx: [
      { ...SCENE_FX.moe },
      { ...SCENE_FX.haste, to: [1, 0], at: 2200 }
    ],
    overlays: [
      { kind: 'aura', id: 36744, f: 15, loopMs: 1500, held: true, op: 0.5, until: 2000 },
      { kind: 'aura', id: 36744, f: 15, loopMs: 1500, dx: 1, at: 2200, fadeMs: 1000, op: 0.5 },
      { kind: 'drop', id: 5899, dx: 1, at: 2200, ms: 600, fadeDelay: 200, fadeMs: 400, op: 0.5 }
    ] } },
  // Ghoul: pulse on its own tile and the neighbours (`tile.neighbors` + own tile).
  // Blue Djinn: see sceneBlueDjinn.
  104: { n: 'Blue Djinn', sc: sceneBlueDjinn() },
  // Banshee: the screech spreads over the 3x3 area, then the outer ring; the music notes play on every hit tile (the
  // extracted row put them on the caster only).
  // Banshee: every 6s a screech. A wave hits the enemies in the 3x3 around her 3 ticks (187ms) after the cast and one hits the ring two tiles out 8 ticks
  // (500ms) after it (each tile plays `musicNotesRed`, a critical magic hit, so blood); a unit is hit by the first wave that reaches it. At 40% HP or less
  // she flees and the screech also heals her (a crit heal, `musicNotesGreen` instead of the red notes on her): the scene shows that case. Awakened, a hit enemy heals 80% less
  // and has -15 magic resist for 2.5s (the heal-reduction icon pops over it, the `heal-reduction` chip). A villain Ti stands in each ring.
  25: { n: 'Banshee', sc: { p: sceneBansheeParts(false) } },
  // Dragon: see sceneDragon (awakened: the fireball engulfs the whole board).
  65: { n: 'Dragon', sc: sceneDragon(false) },
  // Demon: both abilities in one scene, in sequence: the energy beam, then the great fireball (see sceneDemon).
  132: { n: 'Demon', sc: sceneDemon() },
  // Single-target hits (read from the ability text; no area).
  // Orc Spearman: throws the Enchanted Spear (missile 18); the spear item (7367, 5 animated frames, 500ms) drops at once on the
  // tile around the target farthest from the thrower (`dropSpear`) and lies there through the 10s cooldown until he picks it
  // up or it ends. `ground`: a ground item, offset (dx, dy) from the target tile (here up-left, away from the bottom-right caster);
  // `pickupAt` = when it is picked up (it is gone until the next throw). `lead` = the throw starts this many ms into the loop.
  4: { n: 'Orc Spearman', sc: { numbers: [sceneDmg('land', 'target', 'physical', true)], m: [{ a: 'target', rows: ['+'] }], mi: [{ n: 'enchantedSpear', id: 18 }], fx: [], lead: 500, ground: { id: 7367, f: 5, ms: 500, dx: -1, dy: -1, pickupAt: 0 } } },
  117: { n: 'Astronis', sc: { m: [{ a: 'target', rows: ['+'] }], mi: [], fx: [] } },
  // Orshabaal: see sceneOrshabaal.
  128: { n: 'Orshabaal', sc: sceneOrshabaal() },
  // Lavahole: see sceneLavahole.
  70: { n: 'Lavahole', sc: sceneLavahole() },
  // Earth Crystal: see sceneEarthCrystal.
  59: { n: 'Earth Crystal', sc: sceneEarthCrystal() },
  // Beer Barrel: see sceneBeerBarrel.
  92: { n: 'Beer Barrel', sc: sceneBeerBarrel() },
  // Yeti: see sceneYeti.
  80: { n: 'Yeti', sc: sceneYeti() },
  // Dark Apprentice / Dark Magician: electric missile, then energy on every tile of the path to the target
  // (`line`: the scene draws the straight run of tiles from caster to target; the mask only sizes the grid).
  124: {
    n: 'Dark Apprentice',
    sc: {
      m: [{ a: 'target', line: 1, rows: ['OOOOO', 'OOOOO', 'OO+OO', 'OOOOO', 'OOOOO'] }],
      mi: [{ n: 'energyMissileB', id: 73 }],
      fx: [{ ...SCENE_FX.energy }]
    }
  },
  125: {
    n: 'Dark Magician',
    sc: {
      m: [{ a: 'target', line: 1, rows: ['OOOOO', 'OOOOO', 'OO+OO', 'OOOOO', 'OOOOO'] }],
      mi: [{ n: 'energyMissileB', id: 73 }],
      fx: [{ ...SCENE_FX.energy }]
    }
  },
  // Passives, buffs, auras and summons: nothing lands on a target, so a scene on the creature itself.
  // Deer: see sceneDeer.
  37: { n: 'Deer', sc: sceneDeer(false) },
  // Amazon: see sceneAmazon.
  68: { n: 'Amazon', sc: sceneAmazon(false) },
  // Paladin, Cake Drake, Clot: see their functions.
  123: { n: 'Paladin', sc: scenePaladin(false) },
  115: { n: 'Cake Drake', sc: sceneCakeDrake() },
  127: { n: 'Clot', sc: sceneClot() },
  // Goblin Gumslinger: see sceneGoblinGumslinger.
  85: { n: 'Goblin Gumslinger', sc: sceneGoblinGumslinger(false) },
  // Nightstalker, Corym Skirmisher, Black Knight, Mateusz: see their functions.
  61: { n: 'Nightstalker', sc: sceneNightstalker(false) },
  72: { n: 'Corym Skirmisher', sc: sceneCorymSkirmisher(false) },
  74: { n: 'Black Knight', sc: sceneBlackKnight() },
  120: { n: 'Mateusz Dragon Wielki', sc: sceneMateusz() },
  // Cyclops Smith, Hero, Valkyrie, Hunter: see their functions.
  114: { n: 'Cyclops Smith', sc: sceneCyclopsSmith(false) },
  116: { n: 'Hero', sc: sceneHero() },
  69: { n: 'Valkyrie', sc: sceneValkyrie() },
  111: { n: 'Hunter', sc: sceneHunter() },
  // Green Djinn: see sceneGreenDjinn.
  98: { n: 'Green Djinn', sc: sceneGreenDjinn(false) },
  // Cobra Statue: see sceneCobraStatue.
  102: { n: 'Cobra Statue', sc: sceneCobraStatue() },
  // Football Elemental: the Water Elemental's ball (it bounces to any creature on the board).
  109: { n: 'Football Elemental', sc: sceneWaterElemental(false) },
  // Regeneration Tank: see sceneRegenerationTank.
  81: { n: 'Regeneration Tank', sc: sceneRegenerationTank() },
  // Morguthis: see sceneMorguthis.
  107: { n: 'Morguthis', sc: sceneMorguthis() },
  // Reindeer: the Deer's class with other stats, so the same lamp.
  88: { n: 'Reindeer', sc: sceneDeer(false) },
  // Orc Berserker: see sceneOrcBerserker.
  42: { n: 'Orc Berserker', sc: sceneOrcBerserker() },
  // Ti: see sceneTi.
  119: { n: 'Ti', sc: sceneTi() },
  // Sweaty Cyclops: see sceneSweatyCyclops.
  64: { n: 'Sweaty Cyclops', sc: sceneSweatyCyclops() },
  75: { n: 'Dead Tree', sc: { ...sceneSelf(), fx: [] } },
  78: { n: 'Willi Wasp', sc: sceneWilliWasp() },
  // Bog Raider / Gummy Raider: pays HP, then hits the 8 neighbouring tiles (`tile.neighbors`; the centre '+' is
  // drawn as hit too, it is only the origin) and plays "nasty" on itself.
  62: { n: 'Bog Raider', sc: sceneBogRaider() },
  82: { n: 'Gummy Raider', sc: sceneBogRaider(6574) },
  // No scene on purpose: nothing a small grid shows correctly.
  // Bug: a passive. For every other vermin alive it gains stats (I lifesteal, II attack speed, III attack damage, IV magic resist,
  // V speed) and its sprite glows (`bugStage<n>`, 900ms per stage: 1 -> 1.5, 1 -> 1.75, then from 3 vermin pulsing: 1.5 <-> 3, 1.5 <-> 5,
  // and a faster 1.5 <-> 5); at 3 vermin it also grows (`adjustedGrow`, x2) with `magicSparkle`. Here five vermin (Spider, Wasp,
  // Poison Spider, Snake, Scorpion) show up one every 900ms; the `vermin` chip counts them. Awakened, dead vermin count too: no visual.
  17: { n: 'Bug', sc: { m: [{ a: 'self', rows: ['+'] }], mi: [],
    mates: [
      { id: 11, dx: -2, dy: -1, at: 500 }, { id: 6, dx: 2, dy: -1, at: 1400 }, { id: 15, dx: -2, dy: 1, at: 2300 },
      { id: 16, dx: 2, dy: 1, at: 3200 }, { id: 23, dx: 0, dy: 2, at: 4100 }
    ],
    passives: [{ src: 'vermin', counts: [{ at: 500, n: 1 }, { at: 1400, n: 2 }, { at: 2300, n: 3 }, { at: 3200, n: 4 }, { at: 4100, n: 5 }] }],
    casterGrow: { at: 2300, scale: 2 },
    casterFilter: [
      [0, 'brightness(1)'], [500, 'brightness(1)'], [1400, 'brightness(1.5)'],            // stage 1
      [1400, 'brightness(1)'], [2300, 'brightness(1.75)'],                                 // stage 2
      [2300, 'brightness(1.5)'], [3200, 'brightness(3)'],                                  // stage 3 (pulses 1.5 <-> 3)
      [3200, 'brightness(1.5)'], [4100, 'brightness(5)'],                                  // stage 4 (1.5 <-> 5)
      ...Array.from({ length: 6 }, (_, i) => [4100 + i * 450, `brightness(${i % 2 === 0 ? 1.5 : 5})`])   // stage 5 (faster)
    ],
    fx: [{ ...SCENE_FX.magicSparkle, w: 'self', at: 2300 }] } },
  // Extracted scenes that contradict the ability text (checked against the game's tooltips): summons, channels, buffs
  // and board-wide or path effects have no area a small grid shows correctly.
  // Troll: summons 3 Troll-Trained Salamanders (outfit 529) on free tiles within 2 tiles of it: `teleportBlue` on each spawn tile and
  // `heal` on the Troll (once, on the first). Awakened (see ABILITY_SCENE_AWAKENED) every summon also gives the summoner and the summon
  // +2 AP and +2 AD.
  14: { n: 'Troll', sc: { m: [{ a: 'self', rows: ['+'] }], mi: [],
    mates: [{ outfit: 529, dx: -2, dy: -1, at: 500 }, { outfit: 529, dx: 2, dy: 1, at: 500 }, { outfit: 529, dx: 0, dy: 2, at: 500 }],
    fx: [
      { ...SCENE_FX.teleportBlue, to: [-2, -1], at: 500 },
      { ...SCENE_FX.teleportBlue, to: [2, 1], at: 500 },
      { ...SCENE_FX.teleportBlue, to: [0, 2], at: 500 },
      { ...SCENE_FX.heal, w: 'self', at: 500 }
    ] } },
  // Swamp Troll: see sceneSwampTroll.
  77: { n: 'Swamp Troll', sc: sceneSwampTroll(false) },
  // Goblin Assassin: see sceneGoblinAssassin.
  48: { n: 'Goblin Assassin', sc: sceneGoblinAssassin(false) },
  // Goblin Saboteur: the event variant of the Goblin Assassin (its class extends it with the same ability), so the same scene.
  86: { n: 'Goblin Saboteur', sc: sceneGoblinAssassin(false) },
  // Goblin Scavenger: see sceneGoblinScavenger.
  47: { n: 'Goblin Scavenger', sc: sceneGoblinScavenger(false) },
  // Unionized Goblin: the event variant of the Goblin Scavenger (its class extends it, the same constants and ability), so the same scene.
  87: { n: 'Unionized Goblin', sc: sceneGoblinScavenger(false) },
  // Orc Warlord: see sceneOrcWarlord.
  46: { n: 'Orc Warlord', sc: sceneOrcWarlord() },
  // Orc Rider: see sceneOrcRider.
  45: { n: 'Orc Rider', sc: sceneOrcRider(false) },
  // Elf Arcanist: see sceneElfArcanist.
  41: { n: 'Elf Arcanist', sc: sceneElfArcanist() },
  // Dwarf: see sceneDwarf.
  53: { n: 'Dwarf', sc: sceneDwarf(false) },
  // Knight: see sceneKnight.
  52: { n: 'Knight', sc: sceneKnight() },
  // Warlock: see sceneWarlock.
  51: { n: 'Warlock', sc: sceneWarlock(false) },
  // Cyclops: see sceneCyclops.
  50: { n: 'Cyclops', sc: sceneCyclops(false) },
  // Firestarter: see sceneFirestarter.
  49: { n: 'Firestarter', sc: sceneFirestarter(false) },
  // Ghost: whenever an ally dies it channels for 3s (the `glowingCircle` loops on it, `CHARGE_TIME_MS` 3000), facing the ally, then sacrifices
  // itself (true damage to its max HP, a crit; `spiritLeaving`, its corpse 4094) to revive the ally with a heal (`holyAttack` on the ally;
  // 50% of its max HP + 0.5% per AP). Here a villain Ti kills the ally (Astronis), as with Rotworm. Awakened: see ABILITY_SCENE_AWAKENED.
  22: { n: 'Ghost', sc: { numbers: [sceneDmg(640, [-2, 0], 'fire'), sceneDmg(3700, 'self', 'true', true), sceneHeal(3700, [-2, 0], true)],
    ...sceneSelf(), casterFacing: 'west',
    attacker: { ...SCENE_VILLAIN_TI, dx: -2, dy: -2, aim: [-2, 0], at: 640 - SCENE_MISSILE_MS },
    mates: [{ dx: -2, dy: 0, dies: { at: 700, until: 3700 } }],
    transform: { at: 3700, corpse: 4094 },
    fx: [
      { ...SCENE_FX.moe, to: [-2, 0], at: 640 },
      { ...SCENE_FX.glowingCircle, w: 'self', at: 700 }, { ...SCENE_FX.glowingCircle, w: 'self', at: 1800 }, { ...SCENE_FX.glowingCircle, w: 'self', at: 2900 },
      { n: 'spiritLeaving', id: 206, f: 15, w: 'self', at: 3700 },
      { n: 'holyAttack', id: 50, f: 25, to: [-2, 0], at: 3700 }
    ] } },
  108: null, // Rahemos: a quote and a best-of-N match rule (the parser would pick up another creature's class)
  129: null, // Rostein: a quote only
  // Rat: fury stacks; at 100 it transforms into Cave Rat (outfit 56: grows, magicSparkle on itself), hits with enraged
  // scratches (`scratch` on the target), then turns back (magicPoof on itself). `transform`: outfit id, and `at` / `until` (ms)
  // = the Cave Rat's time on screen; fx `at` = start time (ms). Hits follow the attack delay: Rat 2000ms, Cave Rat -30% =
  // 1400ms apart (the first enraged hit comes one delay after the transforming attack).
  1: { n: 'Rat', sc: { numbers: [sceneDmg(2000, 'target', 'physical', true), sceneDmg(3400, 'target', 'physical', true)], ...sceneTarget(), transform: { outfit: 56, at: 600, until: 4400 },
    // The fury passive chip (`fierceberserk`): +10 per attack to 100 (it transforms), then -15 per second and +5 per enraged hit. The
    // real Cave Rat lasts about 9s until the fury is gone; the preview cuts that short, so the last value is the revert.
    passives: [{ src: 'fierceberserk', counts: [{ at: 0, n: 90 }, { at: 600, n: 100 }, { at: 1600, n: 85 }, { at: 2000, n: 90 }, { at: 2600, n: 75 }, { at: 3400, n: 80 }, { at: 3600, n: 65 }, { at: 4400, n: 0 }] }],
    fx: [
    { ...SCENE_FX.magicSparkle, w: 'self', at: 600 },
    { n: 'scratch', id: 215, f: 7, at: 2000 },
    { ...SCENE_FX.bleed, b: 1, at: 2000 },
    { n: 'scratch', id: 215, f: 7, at: 3400 },
    { ...SCENE_FX.bleed, b: 1, at: 3400 },
    { ...SCENE_FX.magicPoof, w: 'self', at: 4400 }
  ] } }
};
// END ABILITY_SCENE_OVERRIDES
const DEFAULT_ATTACK_DELAY_MS = 2000;
// The game's missile ids by name (its `ea` table): what a creature's regular attack fires (CREATURE_COMBAT_DATA `am`).
const MISSILE_IDS = { spear: 1, bolt: 2, arrow: 3, fire: 4, energyBeam: 5, poisonArrow: 6, burstArrow: 7, throwingKnife: 9, smallStone: 10, smallSd: 11, boulder: 12, snowball: 13, powerBolt: 14,
  poisonSting: 15, infernalBolt: 16, enchantedSpear: 18, assassinStar: 19, royalSpear: 21, piercingBolt: 24, exoriHurAxe: 26, exoriHurClub: 27, earthSpell: 30, holyMissile: 31, sd: 32,
  energyArrow: 33, fireArrow: 34, iceArrow: 35, energy: 36, ice: 37, holyArrow: 38, rot: 39, particle: 41, cake: 42, royalStar: 59, candyCane: 61, pinkBall: 62, energyMissileB: 73 };
// Creatures whose scene already IS their regular attack (the ability rides on or replaces the auto attack: a sting, a bite, a spear, a poisoned hit...): no extra plain attacks there.
const SCENE_NO_AUTO_ATTACK = new Set([1, 4, 6, 9, 12, 13, 15, 16, 17, 23, 27, 28, 31, 32, 34, 40, 43, 45, 47, 54, 55, 60, 62, 67, 73, 112]);
// Creatures whose scene draws its own bars or whose class only shows the cooldown bar in some states: no automatic cooldown bar (see `cooldownBarOf`).
const SCENE_NO_COOLDOWN_BAR = new Set([38, 44, 47, 51, 52]); // 38 Polar Bear and 44 Orc Shaman draw the charge as their own bar
/** The cooldown bar the game shows above a creature (the class's `renderCooldownBars`): { color, hideWhenReady } or null; the Cyclopedia fills it over the scene part's `cooldownMs` from its cast. */
function cooldownBarOf(id) {
  const d = CREATURE_COMBAT_DATA[Number(id)];
  return d?.cb && !SCENE_NO_COOLDOWN_BAR.has(Number(id)) ? { color: d.cb, hideWhenReady: !!d.cv } : null;
}
// The previews play the normal attacks 100% faster than the real attack delay (delay / 2, rounded to the nearest 100 ms, never under 500 ms) to keep the loops lively. Only the GENERIC attacks (`autoAttackOf`) use it;
// the explicit hit times of the hand-built scenes (a Knight's stun, the Amazon's 3s throws) are the real ones.
const SCENE_ATTACK_SPEEDUP = 2;
const SCENE_MIN_ATTACK_MS = 500;
/** A creature's regular attack for the Cyclopedia scenes: { delayMs, missile } (missile null = melee or a shared helper), or null when it has none. */
function autoAttackOf(id) {
  const d = CREATURE_COMBAT_DATA[Number(id)];
  if (!d || d.aa === false || SCENE_NO_AUTO_ATTACK.has(Number(id))) return null;
  const missile = d.am && MISSILE_IDS[d.am] ? { n: d.am, id: MISSILE_IDS[d.am] } : null;
  // An attack that scales with AP (Warlock's missile, Green Djinn's auto attack) is a magic hit, not the usual physical one.
  const type = Object.keys(d.c || {}).some((k) => /^(?:AUTO_ATTACK|MISSILE)w*PER_AP$/.test(k)) ? 'magic' : 'physical';
  return { delayMs: Math.max(SCENE_MIN_ATTACK_MS, Math.round((d.ad ?? DEFAULT_ATTACK_DELAY_MS) / SCENE_ATTACK_SPEEDUP / 100) * 100), missile, ranged: !!d.rc, type };
}

// Live ability scenes: the page-start hook (content/ba-combat.js) parses the game's own creature module and id tables,
// so a game update needs no snapshot refresh. Effect frame counts are not in the code: taken from the snapshot, else
// measured from the sheet once (an effect is left out until its sheet has loaded). The snapshot stays the fallback.
const sceneEffectFrames = new Map(); // effect sheet id -> frame count (0 = sheet unusable)
Object.values(ABILITY_SCENE_DATA).forEach((r) => (r.sc.fx || []).forEach((x) => sceneEffectFrames.set(x.id, x.f)));
let sceneSourceLogged = false;

function measureSceneEffectFrames(sheet) {
  if (sceneEffectFrames.has(sheet) || typeof Image === 'undefined') return;
  sceneEffectFrames.set(sheet, 0);
  const img = new Image();
  img.onload = () => {
    // Frames are squares as wide as the sheet, stacked vertically.
    sceneEffectFrames.set(sheet, Math.max(1, Math.round(img.naturalHeight / img.naturalWidth)));
    console.log('[CreatureDB][ability-scene] measured effect sheet', { sheet, frames: sceneEffectFrames.get(sheet) });
  };
  img.onerror = () => console.warn('[CreatureDB][ability-scene] effect sheet not loadable', sheet);
  img.src = `/assets/EFFECT/${sheet}.png`;
}

/** { n, c, row } for a creature from the live game data, or null (hook missing / game not loaded / no scene). */
function getLiveAbilityScene(id) {
  let scenes = null;
  try {
    scenes = globalThis.BestiaryCombatOverrides?.getLiveScenes?.() || null;
  } catch (error) {
    console.error('[CreatureDB][ability-scene] live scene read failed', error);
  }
  if (!sceneSourceLogged) {
    sceneSourceLogged = !!scenes || document.readyState === 'complete';
    if (sceneSourceLogged) console.log('[CreatureDB][ability-scene] source', scenes ? 'live game data' : 'snapshot', scenes?.unknown?.length ? { unknown: scenes.unknown } : '');
  }
  const entry = scenes?.entries[id];
  if (!entry) return null;
  if (!entry.row) return { n: entry.n, c: entry.c, r: entry.r, rc: entry.rc, row: null };
  const fx = [];
  for (const x of entry.row.fx) {
    const f = sceneEffectFrames.get(x.id);
    if (f == null) measureSceneEffectFrames(x.id);
    if (f > 0) fx.push({ ...x, f });
  }
  // A missile the table names but whose sheet does not exist (old / unused ones) is left out, as the tool does.
  const mi = entry.row.mi.filter((x) => {
    if (!sceneMissileSheets.has(x.id)) probeSceneMissileSheet(x.id);
    return sceneMissileSheets.get(x.id) === true;
  });
  return { n: entry.n, c: entry.c, r: entry.r, rc: entry.rc, row: { m: entry.row.m, mi, fx, ...(entry.row.t ? { t: entry.row.t } : {}) } };
}

const sceneMissileSheets = new Map(); // missile sheet id -> true (loads) | false (unknown yet / missing)
Object.values(ABILITY_SCENE_DATA).forEach((r) => (r.sc.mi || []).forEach((x) => sceneMissileSheets.set(x.id, true)));

function probeSceneMissileSheet(sheet) {
  sceneMissileSheets.set(sheet, false);
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => sceneMissileSheets.set(sheet, true);
  img.onerror = () => console.warn('[CreatureDB][ability-scene] missile sheet not loadable', sheet);
  img.src = `/assets/MISSILE/${sheet}.png`;
}

/**
 * Ability scene hints for the Cyclopedia: { name, parts: [{ label?, masks, missiles, effects, cooldownMs }] } or null.
 * One part per ability (a row with several abilities lists them under `p`, each with its own cooldown constant `cd`);
 * masks: [{ a: 'target'|'self', rows, line?, g? }], missiles: [{ n, id }], effects: [{ n, id, f, b?, w? }].
 * `cooldownMs` is the ability's real cooldown from the combat snapshot (null when unknown), used to time the scene.
 * A hand-written override wins over the extracted row.
 */
// Scene templates for mechanics the parser tags (`sc.t`, content/ba-combat.js): the game has no area to draw for them, so
// a template replaces the extracted scene. `push`: the attack displaces its target one tile (Ancient Scarab, Wyvern:
// `displaceTarget` = slash + poof on the target); `sleep`: sleeps and heals, wakes, walks to its enemy and hits it
// (Bear). Both are drawn against a dummy (the villain Ti, id 119; same as CYCLOPEDIA_SCENE_DUMMY_ID in Cyclopedia.js) by the Cyclopedia's push grid.
const SCENE_TEMPLATE_DUMMY_ID = 119; // the villain Ti, the enemy the push / charge / arena scenes act on
const SCENE_TEMPLATE_FX = { haste: { id: 15, f: 22 }, bleed: { id: 1, f: 6 }, slash: { id: 216, f: 6 }, poof: { id: 3, f: 8 }, heal: { id: 13, f: 22 }, smoke: { id: 242, f: 24 }, floorSpike: { id: 294, f: 7 }, tauntYellow: { id: 220, f: 8 }, splash: { id: 54, f: 9 }, soup: { id: 8, f: 8 }, fallingStones: { id: 45, f: 8 } }; // used when the live id table is unavailable
function sceneTemplateFx(name, w) {
  const liveId = globalThis.BestiaryCombatOverrides?.getLiveScenes?.()?.effectIds?.[name];
  const id = liveId ?? SCENE_TEMPLATE_FX[name].id;
  const f = sceneEffectFrames.get(id) ?? SCENE_TEMPLATE_FX[name].f;
  if (sceneEffectFrames.get(id) == null) measureSceneEffectFrames(id);
  return { n: name, id, f, ...(w ? { w } : {}) };
}
const ABILITY_SCENE_TEMPLATES = {
  // perimeter: stones (item sprites stone1..stone5) drop one per tick on the board rim, hit the enemies beside them, then fade and heal the creature (Dwarf Geomancer).
  // Dwarf Merrymancer (89) is the same ability with presents (`merrymancerPresentsA..G`) that only fade in, and its own hit effect (no sheet).
  perimeter: (c, r, gameId) => {
    const alt = Number(gameId) === 89;
    const names = alt ? ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((x) => 'merrymancerPresents' + x) : ['stone1', 'stone2', 'stone3', 'stone4', 'stone5'];
    return { l: alt ? 'Presents' : 'Stone shower', push: { dummyId: SCENE_TEMPLATE_DUMMY_ID, mode: 'perimeter', cleanupMs: c.STONE_CLEANUP_DELAY_MS, alt, stoneIds: names.map((n) => globalThis.BestiaryCombatOverrides?.findSpriteId?.(n) ?? null) }, m: [], mi: [], fx: [...(alt ? [] : [sceneTemplateFx('fallingStones')]), sceneTemplateFx('heal', 'self')] };
  },
  // barrel: the creature drops a barrel (item sprite `explodingBarrel`) next to its target and runs; the barrel explodes after BARREL_CHARGE_MS (Dwarf).
  barrel: (c) => ({ l: 'Barrel of beer', push: { dummyId: SCENE_TEMPLATE_DUMMY_ID, mode: 'barrel', chargeMs: c.BARREL_CHARGE_MS, fleeSpeedBoost: c.FLEE_SPEED_BOOST, barrelSpriteId: globalThis.BestiaryCombatOverrides?.findSpriteId?.('explodingBarrel') ?? null }, m: [], mi: [], fx: [sceneTemplateFx('splash'), sceneTemplateFx('soup')] }),
  // walls: runes (item sprite `wildGrowth`) drop on the free tiles around the enemy and root it for WALL_DURATION_MS (Elf).
  walls: (c, r) => ({ l: 'Wild Growth', push: { dummyId: SCENE_TEMPLATE_DUMMY_ID, mode: 'walls', wallMs: c.WALL_DURATION_MS, range: r, wallSpriteId: globalThis.BestiaryCombatOverrides?.findSpriteId?.('wildGrowth') ?? null }, m: [], mi: [], fx: [sceneTemplateFx('tauntYellow', 'self'), sceneTemplateFx('poof')] }),
  // arena: a wall of spikes (item sprite `spikesA`) on the ring two tiles out and floor spikes (effect `floorSpike`) on the 3x3, for ARENA_DURATION_MS (Behemoth).
  arena: (c) => ({ l: 'Arena', push: { dummyId: SCENE_TEMPLATE_DUMMY_ID, mode: 'arena', arenaMs: c.ARENA_DURATION_MS, wallSpriteId: globalThis.BestiaryCombatOverrides?.findSpriteId?.('spikesA') ?? 388 }, m: [], mi: [], fx: [sceneTemplateFx('smoke'), sceneTemplateFx('floorSpike')] }),
  push: () => ({ l: 'Push', push: { dummyId: SCENE_TEMPLATE_DUMMY_ID, pushes: 2 }, m: [], mi: [], fx: [sceneTemplateFx('slash'), sceneTemplateFx('poof')] }),
  // Bear: hibernates in its sleeping costume (item `sleepingBear`: 64 x 32 px frames, 16 of them per 8s) for the whole cooldown (7.5s, the bar fills as it sleeps) healing every 1.25s (`haste`),
  // wakes, charges, and hits the dummy (`poof` + blood) before hibernating again. Awakened (`sc.awaken`) a stun is ignored while it sleeps and wakes it at once (the 'activate'; a stun bar flashes over it for 250ms as the stun lands): it heals the ticks
  // it missed as one crit and charges. See the charge branch of the push grid.
  sleep: (c, r, id, sc) => {
    const tick = c.HEAL_TICK_FREQUENCY_MS ?? 1250;
    const total = Math.round((c.COOLDOWN_MS ?? 7500) / tick); // heal ticks of a full hibernation
    // Like every ability the loop starts with 1s of cooldown left: the Bear has already slept for all but the last second (its heal ticks keep their rhythm: the last one lands as it wakes).
    const sleptMs = (c.COOLDOWN_MS ?? 7500) - 1000;
    const healAt = Array.from({ length: total }, (_, i) => (i + 1) * tick - sleptMs).filter((at) => at > 0);
    const wake = sc?.awaken ? 600 : healAt[healAt.length - 1] ?? 1000; // awakened: a stun wakes it at once (the tick it would still have healed comes as one crit)
    const ticks = healAt.filter((at) => at <= wake).map((at) => sceneHeal(at, 'self'));
    const missed = sc?.awaken ? total - (total - healAt.length) - ticks.length : 0;
    return { l: 'Charge', stuns: [{ at: 'hit', ms: c.STUN_MS ?? 2000 }, ...(sc?.awaken ? [{ at: wake - 250, ms: 250, on: 'self', shake: false }] : [])], passives: [{ src: 'sleeping', windows: 'asleep' }], numbers: [sceneDmg('hit', 'target', 'physical', true), ...ticks, ...(missed > 0 ? [sceneHeal(wake, 'self', true)] : [])], push: { dummyId: SCENE_TEMPLATE_DUMMY_ID, mode: 'charge', healAt: ticks.map((t) => t.at), sleepStartFill: 1 - 1000 / (c.COOLDOWN_MS ?? 7500), ...(sc?.awaken ? { activate: { at: wake } } : { wakeMs: wake }), costume: { id: globalThis.BestiaryCombatOverrides?.findSpriteId?.('sleepingBear') ?? 7175, f: 16, loopMs: 8000, w: 2 } }, m: [], mi: [], fx: [sceneTemplateFx('haste', 'self'), sceneTemplateFx('poof'), sceneTemplateFx('bleed')] };
  }
};

/**
 * Scenes that look different when the creature is awakened (the Cyclopedia's Ability "awakened" toggle), written by hand
 * where the awakened code changes the SHAPE of the ability (area, projectiles, effects), not just numbers. Used instead of
 * the normal scene when `getAbilityScene(id, true)`. Numbers-only awakenings need nothing here.
 */
const ABILITY_SCENE_AWAKENED = {
  // Bear: awakened, a stun is ignored while it hibernates and wakes it at once (see the `sleep` template).
  9: { n: 'Bear', sc: { ...sceneTarget(), fx: [{ ...SCENE_FX.poof }], t: ['sleep'], awaken: true } },
  // Elf Scout: awakened, allied elves' auto attacks slow too (see sceneElfScout).
  40: { n: 'Elf Scout', sc: sceneElfScout(true) },
  // Elf: awakened, its arrows are true-damage crits against an enemy trapped in the runes (see sceneElf).
  39: { n: 'Elf', sc: sceneElf(true) },
  45: { n: 'Orc Rider', sc: sceneOrcRider(true) }, // a third wolf
  47: { n: 'Goblin Scavenger', sc: sceneGoblinScavenger(true) },
  87: { n: 'Unionized Goblin', sc: sceneGoblinScavenger(true) },
  48: { n: 'Goblin Assassin', sc: sceneGoblinAssassin(true) },
  86: { n: 'Goblin Saboteur', sc: sceneGoblinAssassin(true) },
  49: { n: 'Firestarter', sc: sceneFirestarter(true) },
  50: { n: 'Cyclops', sc: sceneCyclops(true) },
  51: { n: 'Warlock', sc: sceneWarlock(true) },
  60: { n: 'Rorc', sc: sceneRorc(true) },
  71: { n: 'Corym Charlatan', sc: sceneCorymCharlatan(true) },
  126: { n: 'Vladrukh', sc: sceneVladrukh(true) },
  99: { n: 'Ancient Scarab', sc: sceneAncientScarab(true) },
  103: { n: 'Nomad', sc: sceneNomad(true) },
  53: { n: 'Dwarf', sc: sceneDwarf(true) },
  54: { n: 'Dwarf Soldier', sc: sceneDwarfSoldier(true) }, // range 3
  55: { n: 'Dwarf Guard', sc: sceneDwarfGuard(true) },
  56: { n: 'Dwarf Geomancer', sc: sceneDwarfGeomancer(true) },
  // Deer: awakened, the lamp reaches 3 tiles (the ally 3 tiles out is lit too).
  37: { n: 'Deer', sc: sceneDeer(true) },
  88: { n: 'Reindeer', sc: sceneDeer(true) },
  114: { n: 'Cyclops Smith', sc: sceneCyclopsSmith(true) },
  61: { n: 'Nightstalker', sc: sceneNightstalker(true) },
  112: { n: 'Cyclops Drone', sc: sceneCyclopsDrone(true) },
  123: { n: 'Paladin', sc: scenePaladin(true) },
  68: { n: 'Amazon', sc: sceneAmazon(true) },
  85: { n: 'Goblin Gumslinger', sc: sceneGoblinGumslinger(true) },
  110: { n: 'Werefox', sc: sceneWerefox(true) },
  65: { n: 'Dragon', sc: sceneDragon(true) },
  72: { n: 'Corym Skirmisher', sc: sceneCorymSkirmisher(true) },
  98: { n: 'Green Djinn', sc: sceneGreenDjinn(true) },
  109: { n: 'Football Elemental', sc: sceneWaterElemental(true) },
  77: { n: 'Swamp Troll', sc: sceneSwampTroll(true) },
  // Wyvern: awakened, fleeing it also stuns the enemies beside it for 1s (see sceneWyvern).
  36: { n: 'Wyvern', sc: sceneWyvern(true) },
  // Minotaur Guard: awakened, the taunted enemies get +40% attack speed and -15 attack damage for 2s (the chip).
  35: { n: 'Minotaur Guard', sc: sceneMinotaurGuard(true) },
  // Minotaur Archer: awakened, 6 bolts reset its attack cooldown (see sceneMinotaurArcher).
  34: { n: 'Minotaur Archer', sc: sceneMinotaurArcher(true) },
  // Water Elemental: awakened, the orb bounces one more time.
  33: { n: 'Water Elemental', sc: sceneWaterElemental(true) },
  // Winter Wolf: awakened, after every third bite it howls (`drown`, zoom 3, hue-rotated) and every allied lupine glows ice blue and stuns on its next auto attack: the
  // Wolf below the tree (97, facing north) glows, then its attack stuns the target too (`iceCrystal`, the target shakes).
  32: { n: 'Winter Wolf', sc: { ...ABILITY_SCENE_OVERRIDES[32].sc,
    mates: [{ id: 13, dx: -1, dy: 1, facing: 'north', tint: { at: 500, until: 1600, filter: 'drop-shadow(0 0 5px #99ffff)' } }], statusIcons: [{ at: 500, icon: 'buff', on: [-1, 1] }], // the buff icon on the Wolf; the glow ends at its stunning attack
    numbers: [...ABILITY_SCENE_OVERRIDES[32].sc.numbers, sceneDmg(1600, 'target', 'physical')],
    stuns: [...ABILITY_SCENE_OVERRIDES[32].sc.stuns, { at: 1600, ms: 1000 }], // the Wolf's stunning attack stuns the target again
    fx: [...ABILITY_SCENE_OVERRIDES[32].sc.fx, { n: 'drown', id: 2, f: 12, w: 'self', at: 500, z: 3, tx: 0.32, ty: 0.32, filter: 'hue-rotate(325deg)' }, { n: 'iceCrystal', id: 53, f: 22, b: 1, at: 1600 }] } },
  // Frost Troll: awakened, whoever hits the Snowman is debuffed (-10% attack speed, 3s): the debuff icon and `snowFalling` on the Ti at its first hit, and the chip.
  31: { n: 'Frost Troll', sc: { ...ABILITY_SCENE_OVERRIDES[31].sc,
    statusIcons: [...ABILITY_SCENE_OVERRIDES[31].sc.statusIcons, { at: 1700, icon: 'debuff' }],
    passives: [...ABILITY_SCENE_OVERRIDES[31].sc.passives, { src: 'snowman-debuff', windows: [[1700, 4700]] }],
    fx: [...ABILITY_SCENE_OVERRIDES[31].sc.fx, { n: 'snowFalling', id: 263, f: 10, b: 1, at: 1700 }] } },
  // Mummy: awakened, a pulse every 2s (see the normal entry): the Mummy takes its own pulse first, then the Ti wherever it stands.
  28: { n: 'Mummy', sc: { ...ABILITY_SCENE_OVERRIDES[28].sc,
    numbers: [...ABILITY_SCENE_OVERRIDES[28].sc.numbers, sceneDmg(2062, 'self', 'zombie', false, 'true'), sceneDmg(4062, 'self', 'zombie', false, 'true')],
    mates: ABILITY_SCENE_OVERRIDES[28].sc.mates.map((m) => ({ ...m, walk: { ...m.walk, onPulse: { times: [2000, 4000], number: 'zombie', dtype: 'true', delayMs: 125 } } })),
    fx: [...ABILITY_SCENE_OVERRIDES[28].sc.fx, ...[2000, 4000].map((at) => ({ n: 'blackBlood', id: 202, f: 6, w: 'self', at, z: 2, tx: 0.2, ty: 0.2, opacity: 0.5 }))] } },
  // Dragon Lord: awakened, creatures on a fire field get +30 speed: Ti pulses when it steps onto the field, and the chip shows.
  26: { n: 'Dragon Lord', sc: { ...ABILITY_SCENE_OVERRIDES[26].sc,
    // Ti pulses when it steps onto the field and walks the rest of the way faster (+30 speed, AWAKEN_MOVE_SPEED_BUFF; the buff counts from its next step)
    mates: ABILITY_SCENE_OVERRIDES[26].sc.mates.map((m) => ({ ...m, walk: { ...m.walk, onEnter: { ...(m.walk.onEnter || {}), tiles: [[0, 0], ...sceneArea(DRAGON_LORD_MASK)], pulse: true, speedBonus: 30 } } })),
    passives: [{ src: 'firewalkerboots', windows: [[1000, null]] }] } },
  // Banshee: awakened, the screech also leaves the enemies it hits with 80% less healing and -15 magic resist for 2.5s.
  25: { n: 'Banshee', sc: { p: sceneBansheeParts(true) } },
  // Ghost: awakened, the revived ally carries Ghost's spirit (the `justiceSeeker` floating above it, glowing, and the `ghostrevive` chip) and
  // when it kills an enemy Ghost comes back (4.5s: the ally has just reached Ti; a `holyArrow` flies from the kill to it, `holyAttack`, 10 HP). Here the ally kills the villain Ti.
  22: { n: 'Ghost', sc: { ...ABILITY_SCENE_OVERRIDES[22].sc,
    numbers: [...ABILITY_SCENE_OVERRIDES[22].sc.numbers, sceneHeal(4750, 'self', true)],
    mates: [{ ...ABILITY_SCENE_OVERRIDES[22].sc.mates[0], walk: { at: 3900, steps: [[0, -1]] } }], // the (melee) ally walks up to Ti and kills it
    attacker: { ...ABILITY_SCENE_OVERRIDES[22].sc.attacker, dies: { at: 4500 } },
    targetBorders: [{ tile: [-2, -2], from: 3900, until: 4500 }], // the ally's target while it walks up to Ti and hits it
    transform: { at: 3700, until: 4750, corpse: 4094 },
    // the seeker floats above the ally: first above its tile, then (it has walked a step north) above that one
    overlays: [{ kind: 'loop', id: 7390, f: 1, loopMs: 1000, at: 3700, until: 4400, dx: -2, dy: -1, op: 0.7, filter: 'drop-shadow(0 0 5px #fd8740)' },
      { kind: 'loop', id: 7390, f: 1, loopMs: 1000, at: 4400, until: 4600, dx: -2, dy: -2, op: 0.7, filter: 'drop-shadow(0 0 5px #fd8740)' }],
    passives: [{ src: 'ghostrevive', windows: [[3700, 4600]] }],
    flights: [{ shot: { n: 'holyArrow', id: 38 }, from: [-2, -2], to: [0, 0], at: 4750 - SCENE_MISSILE_MS }],
    fx: [...ABILITY_SCENE_OVERRIDES[22].sc.fx, { ...SCENE_FX.moe, to: [-2, -2], at: 4500 }, { n: 'holyAttack', id: 50, f: 25, w: 'self', at: 4750 }] } },
  // Scorpion: awakened, a poisoned creature's equipment drops to tier 1 (the game's `setEquipStats(tier: 1)` on every piece when the poison lands):
  // an equipment chip, drawn like the Equipment tab does (Amulet of Loss, sprite 3057), is tier 5 until the first poison lands and tier 1 after.
  // The tree has no gear, so this is only a stand-in.
  23: { n: 'Scorpion', sc: { ...ABILITY_SCENE_OVERRIDES[23].sc,
    statusIcons: [{ at: 500, icon: 'debuff', up: 24 }, { at: 500, icon: 'poison' }], // the gear debuff first (stacked over the poison icon), then the poison
    passives: [...ABILITY_SCENE_OVERRIDES[23].sc.passives,
      { right: true, windows: [[0, 5000]], equip: { spriteId: 3057, stat: 'hp', tiers: [{ tier: 5, from: 0, until: 500 }, { tier: 1, from: 500, until: 5000 }] } }] } },
  // Wasp: awakened it is +25 speed, so it flees faster.
  6: { n: 'Wasp', sc: { ...ABILITY_SCENE_OVERRIDES[6].sc, casterFlee: { ...ABILITY_SCENE_OVERRIDES[6].sc.casterFlee, speedBonus: 25 } } },
  // Demon Skeleton: awakened, the curse deals 10% of its CURRENT HP (the numbers in the `awaken` colour) and its sprite glows.
  21: { n: 'Demon Skeleton', sc: { ...ABILITY_SCENE_OVERRIDES[21].sc,
    numbers: [sceneDmg(640, 'self', 'fire'), sceneDmg(4700, 'self', 'awaken'), sceneDmg(5700, 'self', 'awaken')],
    casterFilter: [[0, 'drop-shadow(0 0 0px rgba(253,135,64,0))'], [3700, 'drop-shadow(0 0 0px rgba(253,135,64,0))'], [4100, 'drop-shadow(0 0 5px #fd8740)']] } },
  // Ghoul: awakened, the drain persists after the Ghoul is dead: the villain Ti kills it, and the pulse (the ripple, and the fireflies) goes
  // on from its corpse (corpse 4034). A dead Ghoul still drains the enemy but takes no damage and heals nothing (`hp.isAlive` gates both).
  19: { n: 'Ghoul', sc: { ...ABILITY_SCENE_OVERRIDES[19].sc, numbers: [sceneDmg(3140, 'self', 'fire'), sceneDmg(500, [1, 0], 'stamina-medium'), sceneDmg(500, 'self', 'stamina-medium'), sceneHeal(500, 'self'), sceneDmg(2500, [1, 0], 'stamina-medium'), sceneDmg(2500, 'self', 'stamina-medium'), sceneHeal(2500, 'self'), sceneDmg(4500, [1, 0], 'stamina-medium')],
    flashes: [500, 2500, 4500].map((at) => ({ at, ms: 800, tiles: sceneArea(SCENE_RING) })), // the pulse goes on from the corpse
    attacker: { ...SCENE_VILLAIN_TI, dx: -2, dy: 2, at: 3140 - SCENE_MISSILE_MS },
    transform: { at: 3200, corpse: 4034 },
    overlays: [{ ...ABILITY_SCENE_OVERRIDES[19].sc.overlays[0], at: [500, 2500, 4500] }, ...ABILITY_SCENE_OVERRIDES[19].sc.overlays.slice(1)],
    fx: [{ ...SCENE_FX.moe, to: [0, 0], at: 3140 }] } },
  // Slime: awakened, a third clone (limit +1), then the villain Ti kills the main Slime: its clone takes over (`poisonSting` flies from the
  // dead Slime to it).
  18: { n: 'Slime', sc: { ...ABILITY_SCENE_OVERRIDES[18].sc, numbers: [sceneDmg(3440, 'self', 'fire')],
    mates: [...ABILITY_SCENE_OVERRIDES[18].sc.mates, { id: 18, dx: 1, dy: -1, at: 2500 }],
    attacker: { ...SCENE_VILLAIN_TI, dx: -2, dy: 2, at: 3440 - SCENE_MISSILE_MS },
    transform: { at: 3450 },
    flights: [{ shot: { n: 'poisonSting', id: 15 }, from: [0, 0], to: [-1, -1], at: 3450 }],
    fx: [
      ...ABILITY_SCENE_OVERRIDES[18].sc.fx,
      { ...SCENE_FX.teleportBlue, to: [1, -1], at: 2500 },
      { ...SCENE_FX.heal, w: 'self', at: 2500 },
      { ...SCENE_FX.moe, to: [0, 0], at: 3440 }
    ] } },
  // Poison Spider: awakened, each of the 3 bites heals 15% of the magic damage it deals, with `paralize` on the Spider each time.
  15: { n: 'Poison Spider', sc: { ...ABILITY_SCENE_OVERRIDES[15].sc, numbers: [sceneDmg(500, 'target', 'earth', true), sceneDmg(687, 'target', 'earth', true), sceneDmg(875, 'target', 'earth', true), sceneHeal(500, 'self'), sceneHeal(687, 'self'), sceneHeal(875, 'self')], fx: [
    ...ABILITY_SCENE_OVERRIDES[15].sc.fx,
    { n: 'paralize', id: 14, f: 22, w: 'self', at: 500 },
    { n: 'paralize', id: 14, f: 22, w: 'self', at: 687 },
    { n: 'paralize', id: 14, f: 22, w: 'self', at: 875 }
  ] } },
  // Troll: awakened, every summon gives the summoner and the summon +2 AP and +2 AD: the Troll's chip (`convincerune`) counts +2 per
  // salamander, +6 after the three; each salamander gets +2 (not shown: only the selected creature's chips are).
  14: { n: 'Troll', sc: { ...ABILITY_SCENE_OVERRIDES[14].sc, passives: [{ src: 'convincerune', windows: [[500, null]], counts: [{ at: 500, n: '+6' }] }] } },
  // Wolf: awakened, after the bite the Wolf howls (`drown`, zoom 3 at translate 32%, hue-rotate 45deg) and every allied lupine gets
  // +3 AP per lupine present for 3s (`raiseStat`, hue-rotated, and the `lupine-ap` chip with the lupine count): a Winter Wolf
  // on the tile below the tree (97, facing north) is the second lupine.
  13: { n: 'Wolf', sc: { ...ABILITY_SCENE_OVERRIDES[13].sc, mates: [{ id: 32, dx: -1, dy: 1, facing: 'north' }], // tile 97: below the tree, looking up at it
    passives: [{ src: 'lupine-ap', windows: [[500, 3500]], counts: [{ at: 500, n: 2 }] }],
    fx: [
      ...ABILITY_SCENE_OVERRIDES[13].sc.fx,
      { n: 'drown', id: 2, f: 12, w: 'self', at: 500, z: 3, tx: 0.32, ty: 0.32, filter: 'hue-rotate(45deg)' },
      { ...SCENE_FX.raiseStat, w: 'self', at: 500, filter: 'hue-rotate(45deg)' },
      { ...SCENE_FX.raiseStat, to: [-1, 1], at: 500, filter: 'hue-rotate(45deg)' }
    ] } },
  // Orc Spearman: awakened, picking the spear up gives +15% lifesteal for 3s: its chip (`lifesteal-enchantspear`) is on from the
  // pickup (the loop starts right after it) for 3s.
  4: { n: 'Orc Spearman', sc: { ...ABILITY_SCENE_OVERRIDES[4].sc, passives: [{ src: 'lifesteal-enchantspear', windows: [[0, 3000]] }] } },
  // Skeleton: awakened, every revive gives all allied skeletons +4 attack damage: the chip (`skeleton`, '+4') appears on it
  // with the revive.
  7: { n: 'Skeleton', sc: { ...ABILITY_SCENE_OVERRIDES[7].sc, passives: [{ src: 'skeleton', windows: [[2600, null]], counts: [{ at: 2600, n: '+4' }] }] } },
  // Goblin: awakened, each distance level up also gives every ALLIED goblin attack speed and plays `raiseStat` on them: a Goblin Assassin
  // (game id 48, another goblin) stands next to it and gets the effect with it.
  12: { n: 'Goblin', sc: { ...ABILITY_SCENE_OVERRIDES[12].sc, mates: [{ id: 48, dx: -1, dy: 0 }],
    // ...and the awakened attack-speed buff chip (`frontsweep`, +1% per level) appears with the level up.
    passives: [...ABILITY_SCENE_OVERRIDES[12].sc.passives, { src: 'frontsweep', windows: [[2300, null]], counts: [{ at: 2300, n: '1%' }] }],
    fx: [...ABILITY_SCENE_OVERRIDES[12].sc.fx, { ...SCENE_FX.raiseStat, to: [-1, 0], at: 2300 }] } },
  // Rotworm: awakened, when it dies its rot stacks are transferred to the nearest ally (another `rot` missile, from the Rotworm to
  // that ally). Continues the normal scene: after the first rot reaches it, the villain Ti shoots the Rotworm itself (a second
  // `burstArrow` + `moe`); it dies (corpse 4005) and its stacks fly to a second ally two tiles east, which is healed (`haste`).
  10: { n: 'Rotworm', sc: { ...ABILITY_SCENE_OVERRIDES[10].sc, numbers: [sceneDmg(640, [-2, 0], 'fire'), sceneHeal(925, 'self'), sceneDmg(2140, 'self', 'fire'), sceneHeal(2375, [2, 0])],
    mates: [{ dx: -2, dy: 0, dies: { at: 700 } }, { dx: 2, dy: 0 }],
    passives: [{ src: 'pileoftrash', windows: [[925, 2150]], counts: [{ at: 925, n: 1 }] }], // gone with the Rotworm: its stacks go to the ally
    transform: { at: 2150, corpse: 4005 },
    // Ti re-targets the Rotworm once the ally is dead: the red target box is on it until it dies.
    targetBorders: [{ tile: [0, 0], from: 900, until: 2150 }],
    flights: [
      ...ABILITY_SCENE_OVERRIDES[10].sc.flights,
      { shot: SCENE_VILLAIN_TI.shot, from: [-2, -2], to: [0, 0], at: 2140 - SCENE_MISSILE_MS },
      { shot: { n: 'rot', id: 39 }, from: [0, 0], to: [2, 0], at: 2150 }
    ],
    fx: [
      ...ABILITY_SCENE_OVERRIDES[10].sc.fx,
      { ...SCENE_FX.moe, to: [0, 0], at: 2140 },
      { ...SCENE_FX.haste, to: [2, 0], at: 2375 }
    ] } },
  // Tortoise: awakened, each death of the shell holder adds a stack (+40 max HP each) and the holder grows: scale(1 + min(5% x
  // stacks, 25%)): the game gives 1.05 after the first death (hard to see), so the preview shows the 1.25 cap (5+ stacks).
  8: { n: 'Tortoise', sc: { ...ABILITY_SCENE_OVERRIDES[8].sc, mates: [{ dx: 1, dy: 0, grow: { at: 2200, scale: 1.25 } }] } },
  // Minotaur Mage: awakened, a 5x5 storm hits every enemy around the target (6 ticks after the missile).
  3: { n: 'Minotaur Mage', sc: { numbers: [sceneDmg('land', 'target', 'true'), sceneDmg('land+375', 'target', 'true')], noBlood: 1, m: [{ a: 'target', rows: ['XXXXX', 'XXXXX', 'XX+XX', 'XXXXX', 'XXXXX'] }], mi: [{ n: 'energy', id: 36 }], fx: [{ n: 'fallingCommet', id: 243, f: 6, b: 1 }, { n: 'storm', id: 41, f: 17, b: 1, z: 2, tx: 0.25, ty: 0.25 }] } },
  // Minotaur: awakened, the stomp hits the 3x3 ring, then the outer ring of the diamond; it heals itself and refreshes its cooldown.
  2: { n: 'Minotaur', sc: { m: [{ a: 'self', rows: SCENE_RING }, { a: 'self', rows: ['OXXXO', 'XOOOX', 'XO+OX', 'XOOOX', 'OXXXO'] }], mi: [], fx: [{ ...SCENE_FX.groundshaker }, { n: 'cooldownRefresh', id: 232, f: 14, w: 'self', tx: 0.25, at: 310 }] } },
  // Monk: awakened, the blast radius grows to 5x5 (r2).
  // Monk: awakened, the meditation cannot be interrupted (a stun is ignored: nothing to show), the aura is the awakened one (`monk-aura-awaken`),
  // the blast is 5x5 (a second villain two tiles out is hit too) and Monk heals 25% of the damage it took (a crit heal on it).
  24: { n: 'Monk', sc: { ...ABILITY_SCENE_OVERRIDES[24].sc,
    numbers: [...ABILITY_SCENE_OVERRIDES[24].sc.numbers, sceneHeal(6640, 'self', true), sceneDmg(6640, [2, 0], 'holy', true)],
    ...sceneSelf(), gridHalf: 2, flashes: [{ at: 6640, tiles: sceneArea(['XXXXX', 'XXXXX', 'XX+XX', 'XXXXX', 'XXXXX']) }], // the awakened 5x5 blast lights when it blasts
    mates: [sceneTiMate(2, 0, 'west')],
    flights: [...ABILITY_SCENE_OVERRIDES[24].sc.flights, { shot: { n: 'holyArrow', id: 38 }, from: [0, 0], to: [2, 0], at: 6640 - SCENE_MISSILE_MS }],
    fx: [...ABILITY_SCENE_OVERRIDES[24].sc.fx.filter((e) => e.id !== 246),
      ...[500, 1700, 2900, 4100, 5300].map((at) => ({ n: 'holyCircleAwaken', id: 99002, src: 'misc/monk-aura-awaken.png', f: 12, w: 'self', at })),
      { n: 'holyExory', id: 40, f: 14, to: [2, 0], at: 6640 }] } },  // Druid: awakened, one 7x7 area heal (a `heal` effect on every tile) instead of a single-ally heal.
  // Druid: awakened, Exura Gran Mas Res: the `heal` effect on every tile of the 7x7 diamond around it, then `slowYellowHeal` on the tiles that hold an ally
  // (the Druid itself too), and each ally is healed and buffed at half strength. Three allies stand in it.
  29: { n: 'Druid', sc: { numbers: [sceneHeal(500, [-2, -2]), sceneHeal(500, [2, -2]), sceneHeal(500, [-2, 2]), sceneHeal(500, 'self')], ...sceneSelf(), gridHalf: 3, flashes: [{ at: 500, kind: 'buff', tiles: sceneArea(DRUID_AWAKEN_MASK) }], // a heal area: tinted green, not the damage orange; lit with the heal
    // three allies in the diamond; a villain Ti in the far corner, outside it (so it is not healed), is what the Druid flees from
    mates: [{ dx: -2, dy: -2 }, { dx: 2, dy: -2 }, { dx: -2, dy: 2 }, sceneTiMate(3, 3, 'west')], casterFlee: { at: 500, from: [[3, 3]] },
    passives: [{ src: 'ultimatehealing', windows: [[500, 6500]] }],
    fx: [{ ...SCENE_FX.heal, tiles: [[0, 0], ...sceneArea(DRUID_AWAKEN_MASK)], at: 500 },
      { n: 'slowYellowHeal', id: 182, f: 22, tiles: [[-2, -2], [2, -2], [-2, 2], [0, 0]], at: 500 }] } },
  // Fire Devil: every 3rd awakened cast is a Great Fireball over the 7x7 area (iB) instead of the 5x5.
  20: { n: 'Fire Devil', sc: { castRange: 2, gridHalf: 3, m: [{ a: 'target', rows: ['+'] }], mi: [],
    // The cooldown bar follows the casts: they are 2s apart, so the bar refills over 2s (`cooldownScale` 2/3 of the real 3s) and is ready exactly at each cast (`cooldownCasts`: the missile launches).
    cooldownScale: 2 / 3, cooldownCasts: [700, 2700, 4700].map((hit) => hit - SCENE_MISSILE_MS),
    // Three casts (shown 2s apart; the real cooldown is 3s): two fireballs over the 5x5 diamond, then the Great Fireball over the 7x7 one. Each
    // cast: a `fire` missile, a big explosion + a burn on the target, an explosion on every tile of the area (70% opacity), blood, and
    // a magic `fire` damage number. The `greatfireball` chip counts: blank, 1, 2 (glowing), blank again after the Great Fireball.
    flights: [700, 2700, 4700].map((hit) => hit - SCENE_MISSILE_MS).map((at) => ({ shot: { n: 'fire', id: 4 }, from: [2, 2], to: [0, 0], at })),
    passives: [{ src: 'greatfireball', counts: [{ at: 0, n: '' }, { at: 700, n: 1 }, { at: 2700, n: 2 }, { at: 4700, n: '' }] }],
    numbers: [700, 2700, 4700].map((at) => sceneDmg(at, 'target', 'fire')),
    flashes: [[700, ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO']], [2700, ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO']],
      [4700, ['OOXXXOO', 'OXXXXXO', 'XXXXXXX', 'XXX+XXX', 'XXXXXXX', 'OXXXXXO', 'OOXXXOO']]].map(([at, rows]) => ({ at, tiles: [[0, 0], ...sceneArea(rows)] })),
    fx: [[700, ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO']], [2700, ['OXXXO', 'XXXXX', 'XX+XX', 'XXXXX', 'OXXXO']],
      [4700, ['OOXXXOO', 'OXXXXXO', 'XXXXXXX', 'XXX+XXX', 'XXXXXXX', 'OXXXXXO', 'OOXXXOO']]].flatMap(([at, rows]) => [
      { ...SCENE_FX.largeFireExplosion, b: 1, opacity: 0.7, at },
      { ...SCENE_FX.fire, b: 1, at },
      { ...SCENE_FX.largeFireExplosion, tiles: sceneArea(rows), opacity: 0.7, at },
      { ...SCENE_FX.bleed, b: 1, at }
    ]) } },
};

const liveEffectSheets = new Map(); // id -> meta | null (read from the page's own stylesheet)

/** The page's CSSKeyframesRule called `name`, or null. */
function findCssKeyframes(name) {
  for (const sheet of Array.from(document.styleSheets)) {
    let rules;
    try { rules = sheet.cssRules; } catch (e) { continue; } // a cross-origin sheet cannot be read
    for (const rule of Array.from(rules || [])) if (rule.type === 7 && rule.name === name) return rule;
  }
  return null;
}

/**
 * Frame size and playback of effect sheet `id`, read from the game's own stylesheet in this page: an element with the
 * game's effect markup (`sprite effect id-N`) is given to the browser's CSS cascade, which resolves the frame size
 * (--width / --height / --sWidth / --sHeight) and the animation (name, duration, timing) exactly as the game would, and the
 * named @keyframes give the frame order. Same result format as EFFECT_SHEET_DATA (see tools/effect-sheets.mjs). Null when
 * the page has no such effect rule.
 */
function readLiveEffectSheet(id) {
  if (typeof document === 'undefined' || !document.body) return null;
  const host = document.createElement('div');
  host.className = `sprite effect relative id-${id}`;
  host.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;left:-9999px;top:-9999px;';
  const img = document.createElement('img');
  img.className = 'spritesheet';
  img.style.animationPlayState = 'paused'; // only its computed values are read
  host.appendChild(img);
  document.body.appendChild(host);
  try {
    const css = getComputedStyle(host);
    const px = (name) => parseFloat(css.getPropertyValue(name));
    const w = px('--width');
    const h = px('--height');
    const sw = px('--sWidth');
    const sh = px('--sHeight');
    if (![w, h, sw, sh].every((x) => x > 0)) return null;
    const out = { w, h, ...(sw !== w ? { sw } : {}), n: Math.round(sh / h) };
    const ics = getComputedStyle(img);
    const name = ics.animationName;
    if (!name || name === 'none') return out;
    const dur = ics.animationDuration.split(',')[0].trim();
    out.ms = Math.round(parseFloat(dur) * (dur.endsWith('ms') ? 1 : 1000));
    const timing = ics.animationTimingFunction.split(',')[0].trim();
    const frameOf = (value) => {
      const m = /calc\((-?[\d.]+)px/.exec(value);
      if (m) return Math.round(-parseFloat(m[1]) / h);
      const pc = /(-?[\d.]+)%/.exec(value);
      return pc ? (-parseFloat(pc[1]) / 100) * (sh / h) : null;
    };
    const points = [];
    const kf = findCssKeyframes(name);
    if (kf) {
      for (const rule of Array.from(kf.cssRules)) {
        const f = frameOf(rule.style.transform || '');
        if (f == null) continue;
        const key = rule.keyText === 'from' ? 0 : rule.keyText === 'to' ? 100 : parseFloat(rule.keyText);
        points.push([key, f]);
      }
    }
    // `step-end` computes to `steps(1)`: that is "hold each keyframe", not one step, so the keyframes below drive it.
    const stepsN = Number(/^steps\((\d+)/.exec(timing)?.[1]) > 1 ? /^steps\((\d+)/.exec(timing)[1] : null;
    if (stepsN) {
      // No own transform keyframes (the shared `disappearing-homogeneous-transition`): every frame once.
      if (!points.length || name === 'disappearing-homogeneous-transition') return { ...out, from: 0, to: out.n, steps: Number(stepsN) };
      return { ...out, from: points[0][1], to: points[points.length - 1][1], steps: Number(stepsN) };
    }
    const keys = points.filter(([key]) => key < 99.5);
    return keys.length ? { ...out, keys } : out;
  } finally {
    host.remove();
  }
}

/**
 * { w, h, n, ms, from?, to?, steps?, keys?, sw? } of effect sheet `id` as the game plays it: read live from the page's
 * stylesheet (nothing hardcoded; follows game updates), else the snapshot EFFECT_SHEET_DATA, else null.
 */
function getEffectSheet(id) {
  const key = Number(id);
  if (!liveEffectSheets.has(key)) {
    let live = null;
    try { live = readLiveEffectSheet(key); } catch (error) { console.warn('[CreatureDB] live effect sheet read failed', key, error); }
    liveEffectSheets.set(key, live);
    if (live) console.log('[CreatureDB][ability-scene] effect sheet read from the game stylesheet', { id: key, ...live });
  }
  return liveEffectSheets.get(key) || EFFECT_SHEET_DATA[key] || null;
}

/**
 * The game plays effect `bleed` (id 1) on any actor that takes ordinary damage (an HP change that is not true damage and is
 * not flagged `noEmitParticles`; see the actor component's damage-effect picker). Every scene with a target shows it on the
 * target (the dummy) when the hit lands; `noBlood: 1` in a scene row opts out (true damage, silent hits). `land` = starts at the landing.
 */
const SCENE_BLEED_FX = { ...SCENE_FX.bleed, b: 1, land: 1 };
/**
 * Optional scene-row options. They are written in the data under the same names the Cyclopedia reads, so they pass straight
 * through (what each does: see the Cyclopedia's scene code): transform (a form change or death / revive), ground (an item on
 * the ground), lead (ms before the attack starts), noBlood (no `bleed` on the target), allyTarget (an ally, not an enemy,
 * dummy), dummyTint (a status colour on the dummy), attacker (a shooter), overlays (items on the caster's tile), mates
 * (allies beside the caster), flights (free-flying projectiles), targetBorders (timed red target boxes: a shooter
 * re-targeting), passives (the game's passive chips under the scene: icon + a counter that changes over time; `windows` = when a chip is there), flinch (the target shakes when hit, `{ at }` ms), dummyHidden (the dummy is replaced for `{ from, until }` ms), casterGrow (`{ at, scale }`), casterFilter (the caster's css filter over time), numbers (floating damage / heal numbers: the game's, with a word: see the Cyclopedia), gridHalf (how many tiles around the centre the grid must reach, for a scene that draws its area with effect `tiles`), flashes (the hit area lit when an AoE lands: `{ at, tiles }`), stand (the caster holds the idle pose instead of the walk cycle)..
 */
const SCENE_OPTIONS = ['transform', 'ground', 'lead', 'noBlood', 'allyTarget', 'dummyTint', 'dummyForm', 'attacker', 'overlays', 'mates', 'flights', 'targetBorders', 'passives', 'flinch', 'dummyHidden', 'casterGrow', 'casterFilter', 'numbers', 'gridHalf', 'flashes', 'casterFlee', 'casterFacing', 'statusIcons', 'meditate', 'noDummy', 'stuns', 'holdMs', 'apSlider', 'bars', 'noAutoAttack', 'autoAttackAs', 'noCooldownBar', 'cooldownCastAt', 'bleeds', 'cooldownScale', 'casterOffset', 'casterJump', 'fullBoard', 'cooldownCasts', 'casterInvisible'];
const pickSceneOptions = (src) => Object.fromEntries(SCENE_OPTIONS.filter((key) => src[key] !== undefined).map((key) => [key, src[key]]));
// A plain hit on the target also shows the game's floating damage number (physical) when it lands, unless the scene lists its own `numbers`.
const SCENE_HIT_NUMBER = { at: 'land', kind: 'damage', type: 'physical', on: 'target' };
/** The default hit number follows what the ability scales with: magic when its damage constants scale with AP and not AD (Warlock, Dark Magician, Setzer), else the physical look. */
function sceneHitNumberFor(constants) {
  const damageKeys = Object.keys(constants || {}).filter((k) => /DMG|DAMAGE/.test(k) && !/HEAL|REDUC|DEBUFF|FREQ|DURATION|COOLDOWN|CD_|MULTIPLIER/.test(k));
  const scalesWithAp = damageKeys.some((k) => /PER_AP|AP_RATIO/.test(k));
  const scalesWithAd = damageKeys.some((k) => /PER_AD|AD_RATIO/.test(k));
  return scalesWithAp && !scalesWithAd ? { ...SCENE_HIT_NUMBER, type: 'magic', dtype: 'magic' } : SCENE_HIT_NUMBER;
}
const hasTargetHit = (p) => !p.push && !p.noBlood && (p.m || [])[0]?.a === 'target' && !(p.fx || []).some((e) => e.n === 'bleed');

/**
 * A mate that walks (`walk` { at, steps }) can have something happen each time a step takes it onto one of `walk.onEnter.tiles` (tile offsets from
 * the target): `fx` plays there and a damage `number` shows (`onEnter.number`: the colour), and with `pulse` it pulses at the first such step. The game
 * moves a creature onto the next tile the moment a step starts, so a step's effects come at its start; steps are `walkStepTicks` of the mate's speed apart.
 */
function withMateStepEffects(part) {
  if (!part.mates?.some((m) => m.walk?.onEnter && (Number.isFinite(m.baseSpeed) || m.walk.speed))) return part;
  const fx = [...(part.effects || [])]; // a part's effects are `effects` here (built from the scene's `fx`)
  const numbers = [...(part.numbers || [])];
  const mates = part.mates.map((m) => {
    const e = m.walk?.onEnter;
    if (!e || !(Number.isFinite(m.baseSpeed) || m.walk.speed)) return m;
    // The tiles the steps land on, and the first of them inside `tiles`.
    let [x, y] = [m.dx || 0, m.dy || 0];
    const start = [x, y];
    const dests = m.walk.steps.map(([dx, dy]) => [(x += dx), (y += dy)]);
    const inside = dests.map(([tx, ty]) => e.tiles.some(([ex, ey]) => ex === tx && ey === ty));
    const first = inside.indexOf(true);
    // `onEnter.speedBonus` (the awakened fire field's +30): once it steps onto the field the creature walks the following steps faster.
    const walk = e.speedBonus && first >= 0 ? { ...m.walk, speedBonusAfter: { step: first, bonus: e.speedBonus } } : m.walk;
    const scale = walk.speedScale ?? 1; // a slow (Mummy's x0.5)
    const starts = [];
    let at = walk.at;
    let hit = 0;
    walk.steps.forEach(([sdx, sdy], i) => {
      starts.push(at);
      const stepBonus = walk.speedBonusAfter && i > walk.speedBonusAfter.step ? walk.speedBonusAfter.bonus : 0;
      if (inside[i]) {
        // the effect rides with the creature as it glides onto the tile (`glide`)
        if (e.fx) fx.push({ ...e.fx, tiles: [dests[i]], at, glide: { dx: sdx, dy: sdy, ms: walkStepDurationMs(walk.speed ?? (m.baseSpeed + stepBonus) * scale) } });
        if (e.number) numbers.push(sceneDmg(at, { target: dests[i] }, e.number, hit++ < (e.critSteps || 0))); // `critSteps`: the first steps are crits (Mummy's curse, while HP >= 50%)
      }
      const bonus = walk.speedBonusAfter && i > walk.speedBonusAfter.step ? walk.speedBonusAfter.bonus : 0;
      at += walkStepTicks(walk.speed ?? (m.baseSpeed + bonus) * scale) * 62.5;
    });
    // `walk.onPulse` { times, number, dtype, delayMs }: something hits the mate wherever it is standing at each of `times` (Mummy's awakened pulse).
    const pulse = walk.onPulse;
    if (pulse) {
      pulse.times.forEach((t) => {
        let pos = start;
        starts.forEach((st, i) => { if (st <= t) pos = dests[i]; });
        numbers.push(sceneDmg(t + (pulse.delayMs || 0), { target: pos }, pulse.number, false, pulse.dtype));
      });
    }
    const pulses = e.pulse && first >= 0 ? [walk.at + walk.steps.slice(0, first).reduce((sum) => sum + walkStepMs(m.baseSpeed * scale), 0)] : null;
    return { ...m, walk, ...(pulses ? { pulse: pulses } : {}) };
  });
  return { ...part, effects: fx, numbers, mates };
}

function getAbilityScene(gameId, awakened = false) {
  const id = Number(gameId);
  const live = getLiveAbilityScene(id);
  // Order: the awakened variant (when asked for and written), hand-written override (null = no scene on purpose), then
  // the game's own data read live, then the snapshot.
  const row = (awakened && ABILITY_SCENE_AWAKENED[id])
    || (id in ABILITY_SCENE_OVERRIDES ? ABILITY_SCENE_OVERRIDES[id] : (live ? (live.row && { n: live.n, sc: live.row }) : ABILITY_SCENE_DATA[id]));
  if (!row) return null;
  const constants = { ...(CREATURE_COMBAT_DATA[id]?.c || {}), ...(live?.c || {}) };
  // Attack range in tiles for a ranged creature (the caster stands this far from the target); null otherwise.
  const ranged = live ? live.rc : CREATURE_COMBAT_DATA[id]?.rc;
  const range = Number.isFinite(row.sc.castRange) ? row.sc.castRange : ranged ? (live ? live.r : CREATURE_COMBAT_DATA[id]?.r) ?? null : null;
  const cooldownOf = (key) => {
    const ms = constants[key] ?? constants.COOLDOWN_MS ?? constants.BASE_COOLDOWN_MS;
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  };
  // A part with nothing to animate (no projectile, no effect, no hit tile: a pure stat passive, a lone caster) is
  // dropped; a creature left with no part has no scene.
  const animates = (p) => (p.mi || []).length > 0 || (p.fx || []).length > 0 || (p.overlays || []).length > 0 || (p.flights || []).length > 0 || (p.mates || []).length > 0 || (p.passives || []).length > 0
    || (p.m || []).some((mask) => (mask.rows || []).some((r) => r.includes('X')));
  // A tagged mechanic is drawn by its template (first tag with one), not by the extracted area.
  const tag = (row.sc.t || []).find((x) => ABILITY_SCENE_TEMPLATES[x]);
  // The creature's own speed stat (the game's monster data): the Cyclopedia times every walk in a scene from it (the game's step formula).
  const baseSpeed = getMonsterById(id)?.metadata?.baseStats?.speed;
  const parts = (row.sc.p || [tag ? ABILITY_SCENE_TEMPLATES[tag](constants, range, gameId, row.sc) : { m: row.sc.m, mi: row.sc.mi, fx: row.sc.fx, ...pickSceneOptions(row.sc) }])
    .filter(animates)
    .map((p) => ({ label: p.l || null, masks: p.m, missiles: p.mi, effects: hasTargetHit(p) ? [...(p.fx || []), SCENE_BLEED_FX] : p.fx, cooldownMs: cooldownOf(p.cd) && cooldownOf(p.cd) * (p.cooldownScale ?? 1), range, push: p.push || null, baseSpeed: Number.isFinite(baseSpeed) ? baseSpeed : null, bloodColor: getMonsterById(id)?.metadata?.bloodColor ?? null, autoAttack: p.noAutoAttack ? null : autoAttackOf(id), cooldownBar: p.noCooldownBar ? null : cooldownBarOf(id), ...(hasTargetHit(p) && p.numbers === undefined ? { numbers: [sceneHitNumberFor(constants)] } : {}), ...pickSceneOptions(p) }))
    // Mates (allies standing in the scene) that walk need their own speed.
    .map((p) => (p.mates ? { ...p, mates: p.mates.map((m) => { const sp = getMonsterById(m.id ?? 117)?.metadata?.baseStats?.speed; return Number.isFinite(sp) ? { ...m, baseSpeed: sp } : m; }) } : p))
    .map(withMateStepEffects);
  if (!parts.length) return null;
  return { name: row.n, parts };
}

function getCreatureCombatData(gameId) {
  const row = CREATURE_COMBAT_DATA[Number(gameId)];
  if (!row) return null;
  return { name: row.n, attackDelayMs: row.ad ?? DEFAULT_ATTACK_DELAY_MS, range: row.r ?? null, ranged: row.rc ?? null, initialCooldownMs: row.ic ?? null, summons: row.s ?? [], constants: row.c, variants: row.v ?? {} };
}

// Shared by Cyclopedia (read-only combat panel) and Map Editor (combat tuning defaults/reference).
// Engine ms -> ticks conversion (the game's `HX`); 1 tick = 62.5 ms.
function combatMsToTicks(ms) {
  return Math.round(0.016 * ms);
}

/** One walking step in ms at a speed stat (the game's `getStepDuration`): the glide to the next tile and one walk cycle last this long. */
function walkStepDurationMs(speed) {
  let e = 1;
  if (speed > -261.29) e = Math.max(Math.floor(857.36 * Math.log(speed / 2 + 261.29) - 4794.51), 1);
  return Math.floor(1e5 / e);
}

/** Ticks for one walking step at a speed stat (engine walk-cooldown formula): the time until the next step may start. */
function walkStepTicks(speed) {
  return combatMsToTicks(walkStepDurationMs(speed));
}

function formatCombatNumber(value, maxDecimals = 2) {
  return String(Number(value.toFixed(maxDecimals)));
}

const COMBAT_WORD_LABELS = {
  AP: 'AP', AD: 'AD', HP: 'HP', MR: 'MR', CDR: 'CDR', DMG: 'damage', MIN: 'min', MAX: 'max',
  PERCENT: '', PCT: '' // the value itself is shown with a % sign
};

/** Sentence-case text from constant-name words ("BASE", "DMG" -> "Base damage"). */
function formatCombatWords(words) {
  const text = words.map((w) => COMBAT_WORD_LABELS[w] ?? w.toLowerCase()).filter(Boolean).join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Whether a constant's value is a time in milliseconds. */
function isCombatTimeKey(key) {
  return /(?:^|_)(?:MS|TICKS)(?:_|$)|^CDR(?:_|$)/.test(key);
}

/**
 * A bare number, a time (via `formatTicks`), or a percentage (`*_PERCENT*`). Values are milliseconds
 * when the name has `MS` / `TICKS` in it or starts with `CDR` (the game prints those with its seconds
 * formatter). `exact` keeps fractions of a tick, for per-stat amounts such as "1.28 ticks per AP".
 */
function formatCombatAmount(key, value, formatTicks, exact = false) {
  if (isCombatTimeKey(key)) {
    return formatTicks(exact ? value * 0.016 : combatMsToTicks(value));
  }
  // ATTACK_SPEED constants are fractions the game prints as a percentage ("+1% attack speed").
  if (/PERCENT|LIFESTEAL|ATTACK_SPEED/.test(key) && Math.abs(value) <= 1) return `${formatCombatNumber(value * 100)}%`;
  return formatCombatNumber(value);
}

/** Which panel section a constant belongs to. */
function getCombatSection(key) {
  if (key.startsWith('AWAKEN_')) return 'Awakened';
  if (/COOLDOWN|CDR|RECHARGE|FREQUENCY|DELAY|DURATION|(?:^|_)CD(?:_|$)/.test(key)) return 'Timing';
  return 'Ability';
}

/**
 * Label and value for one ability constant. Scaling constants read as "Heal scaling: x 0.15 AP" or
 * "CDR scaling: 80 per AP" instead of the raw "HEAL_AP_RATIO" / "CDR_PER_AP".
 */
function describeCombatConstant(key, value, formatTicks) {
  let words = key.replace(/^AWAKEN_/, '').split('_').filter((w) => w && w !== 'MS');
  const ratio = /(?:^|_)(AP|AD)_RATIO$/.exec(key);
  const perStat = /_PER_(?:USER_)?(AP|AD)$/.exec(key);
  if (ratio) {
    words = words.slice(0, -2);
    return { key, label: `${formatCombatWords(words) || 'Damage'} scaling`.replace(/^ /, ''), value: `× ${formatCombatNumber(value)} ${ratio[1]}` };
  }
  if (perStat) {
    const end = key.includes('_PER_USER_') ? -3 : -2;
    words = words.slice(0, end);
    const sign = value > 0 ? '+' : '';
    return { key, label: `${formatCombatWords(words) || 'Bonus'} scaling`, value: `${sign}${formatCombatAmount(key, value, formatTicks, true)} per ${perStat[1]}` };
  }
  return { key, label: formatCombatWords(words), value: formatCombatAmount(key, value, formatTicks) };
}

/**
 * The owner's ability constants that set a summon's values (Troll's `HP_PER_USER_AP`, Orc Rider's
 * `WOLF_BASE_HP`, The Pale Count's `BAT_LIFESTEAL_PERCENT`), as [{ key, label, value }] formatted like the
 * owner's own rows. A constant belongs to the summon when one of its `_`-separated words is a word of the
 * summon's name (WOLF for "War Wolf", DWARF for "Dwarf Henchman"; plural S ignored) or marks the owner link
 * (`USER`, `PARENT`, `SPAWN`). The shared prefix is dropped from the label ("Base HP", "HP scaling").
 */
function describeSummonOwnerRows(gameId, summon, formatTicks) {
  const data = getCreatureCombatData(gameId);
  if (!data || !summon?.n) return [];
  const nameWords = new Set(summon.n.toUpperCase().split(/[^A-Z]+/).filter((w) => w.length >= 3).map((w) => w.replace(/S$/, '')));
  const linkWords = new Set(['USER', 'PARENT', 'SPAWN']);
  return Object.entries(data.constants).flatMap(([key, value]) => {
    if (!Number.isFinite(value)) return [];
    if (key.endsWith('_TICKS') && key.replace(/_TICKS$/, '_MS') in data.constants) return [];
    const words = key.replace(/^AWAKEN_/, '').split('_');
    if (!words.some((w) => nameWords.has(w.replace(/S$/, '')) || linkWords.has(w))) return [];
    const shown = words.filter((w) => !nameWords.has(w.replace(/S$/, '')) || words.length < 3).join('_');
    const row = describeCombatConstant(key.startsWith('AWAKEN_') ? `AWAKEN_${shown}` : shown, value, formatTicks);
    return [{ key, label: key.startsWith('AWAKEN_') ? `Awakened ${row.label.toLowerCase()}` : row.label, value: row.value }];
  });
}

/**
 * A creature's ability constants grouped as [['Ability'|'Timing'|'Awakened', [{key, label, value, native, isTime}]], ...],
 * empty groups dropped. `native` is the snapshot number (ms when `isTime`). Times are rendered by `formatTicks(ticks)`. Null when the snapshot has no entry.
 */
function describeCreatureCombatSections(gameId, formatTicks, withExtra = false) {
  const data = getCreatureCombatData(gameId);
  if (!data) return null;
  const sections = new Map([['Ability', []], ['Timing', []], ['Awakened', []]]);
  // `withExtra`: also the hand-written CREATURE_COMBAT_EXTRA rows (read-only; the Map Editor does not ask for them)
  // Values by variant (Knight's exori cooldown per weapon) are rows of their own: EXORI_CD_MS + AXE -> "Exori cd axe". Like the
  // extras they are shown read-only: the Map Editor's overrides cannot change them.
  const byVariant = Object.fromEntries(Object.entries(data.variants || {}).flatMap(([key, table]) => Object.entries(table).map(([variant, value]) => [`${key}_${variant}`, value])));
  const constants = withExtra ? { ...data.constants, ...byVariant, ...CREATURE_COMBAT_EXTRA[Number(gameId)] } : data.constants;
  Object.entries(constants).forEach(([key, value]) => {
    if (!Number.isFinite(value)) return;
    // Some constants exist as both FOO_MS and FOO_TICKS with the same duration; show it once.
    if (key.endsWith('_TICKS') && key.replace(/_TICKS$/, '_MS') in data.constants) return;
    sections.get(getCombatSection(key)).push({
      ...describeCombatConstant(key, value, formatTicks),
      native: value,
      isTime: isCombatTimeKey(key)
    });
  });
  return [...sections].filter(([, rows]) => rows.length);
}

/**
 * Snapshot-derived defaults for the Map Editor's combat-tuning fields, or null without a snapshot
 * entry. Ticks; each field is null when the creature has no matching constant. `range` is the
 * snapshot's inline `rangeComponent` range (`r`), else a bare `RANGE` / `AUTO_ATTACK_RANGE`: FIREBALL_RANGE, AWAKEN_RANGE etc. are not rangeComponent.baseRange.
 */
function getCreatureCombatTuningDefaults(gameId) {
  const data = getCreatureCombatData(gameId);
  if (!data) return null;
  const c = data.constants;
  const ticksOf = (...keys) => {
    const key = keys.find((k) => Number.isFinite(c[k]));
    return key ? combatMsToTicks(c[key]) : null;
  };
  const rangeKey = ['RANGE', 'AUTO_ATTACK_RANGE'].find((k) => Number.isFinite(c[k]) && c[k] >= 1);
  const inlineRange = Number.isFinite(data.range) && data.range >= 1 ? Math.floor(data.range) : null;
  return {
    abilityTicks: ticksOf('COOLDOWN_MS', 'BASE_COOLDOWN_MS'),
    minAbilityTicks: ticksOf('MIN_COOLDOWN_MS', 'MIN_CD_MS'),
    range: inlineRange ?? (rangeKey ? Math.floor(c[rangeKey]) : null)
  };
}

// Boss aliases are listed under Unobtainable (UNOBTAINABLE_CREATURES), not as extra Creatures.
const CYCLOPEDIA_EXTRA_CREATURES = SHINY_ALIAS_CREATURES.map((entry) => entry.displayName);

function findAliasByDisplayName(aliases, creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  if (!norm) return null;
  return aliases.find((entry) => entry.displayName.toLowerCase() === norm) ?? null;
}

function getShinyAliasByDisplayName(creatureName) {
  return findAliasByDisplayName(SHINY_ALIAS_CREATURES, creatureName);
}

function getBossAliasByDisplayName(creatureName) {
  return findAliasByDisplayName(BOSS_ALIAS_CREATURES, creatureName);
}

function aliasToDisplayQuery(alias, extras) {
  return {
    displayName: alias.displayName,
    gameId: alias.gameId,
    baseSpecies: alias.baseSpecies,
    forceShiny: false,
    shinyOnly: false,
    nonShinyOnly: false,
    ...extras
  };
}

function resolveCreatureDisplay(creatureName) {
  const boss = getBossAliasByDisplayName(creatureName);
  if (boss) {
    return aliasToDisplayQuery(boss, {
      bossOnly: true,
      transformedForm: boss.transformedForm === true,
      abilityNote: globalThis.mapsDatabase?.ROOM_SCRIPT_NOTES?.[boss.roomScript]
        ?? CREATURE_ABILITY_NOTES[boss.displayName.toLowerCase()] ?? null
    });
  }
  const alias = getShinyAliasByDisplayName(creatureName);
  if (alias) return aliasToDisplayQuery(alias, { forceShiny: true, shinyOnly: true });

  const monster = findMonsterByName(creatureName);
  const gameId = monster?.gameId ?? null;
  const speciesName = monster?.metadata?.name ?? String(creatureName ?? '').trim();

  return {
    displayName: speciesName,
    gameId,
    baseSpecies: speciesName,
    forceShiny: false,
    shinyOnly: false,
    // Mystic Gazer shiny copies are listed as Albino Gazer in Cyclopedia.
    nonShinyOnly: isMysticGazerId(gameId)
  };
}

/** Whether an owned monster belongs to a resolved display query (boss aliases are never owned). */
function queryMatchesMonster(query, monster) {
  if (query.gameId == null || query.bossOnly || !monster) return false;
  if (Number(monster.gameId) !== Number(query.gameId)) return false;
  if (query.shinyOnly) return monster.shiny === true;
  if (query.nonShinyOnly) return monster.shiny !== true;
  return true;
}

function filterMonstersForCreatureDisplay(creatureName, monsters) {
  if (!Array.isArray(monsters)) return [];
  const query = resolveCreatureDisplay(creatureName);
  return monsters.filter((m) => queryMatchesMonster(query, m));
}

function creatureHasShinyVariant(creatureName) {
  const resolved = resolveCreatureDisplay(creatureName);
  if (!resolved?.gameId) return true;
  if (resolved.shinyOnly || resolved.bossOnly) return false;
  if (GAZER_GAME_IDS_WITHOUT_SHINY.has(resolved.gameId)) return false;
  if (isMysticGazerId(resolved.gameId)) return false;
  return true;
}

function findGameOldOutfitsRule(rules) {
  for (const rule of rules) {
    if (rule.selectorText && rule.cssRules?.length && rule.cssText.includes('/old-outfits/')) return rule;
    if (!rule.selectorText && rule.cssRules) {
      const nested = findGameOldOutfitsRule(rule.cssRules);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * The game ships its old creature art (/assets/old-outfits/) as one nested CSS rule scoped
 * to an event scene (`#scene-board-… { .outfit.id-N … }`) mapping current outfit ids to the
 * old sheets plus their --size/--sWidth/--sHeight. Returns that rule flattened into plain
 * rules, each selector prefixed with `scopePrefix` (use a prefix with >= 2 class/pseudo-class
 * specificity so it outranks the game's `.spritesheet[data-shiny=true]` rules). Reading the
 * game's own stylesheet keeps the id → old-sheet map out of our code. Returns null when the
 * stylesheet isn't loaded yet. `excludeSelector` (optional) leaves everything inside matching
 * containers untouched. `outfitAttr` is added to every `.outfit` in the rules: by default it skips
 * sprites a mod tagged `data-ba-sprite="current"` (forced current art), and
 * `[data-ba-sprite="old"]` builds the rules that apply to forced-old sprites only.
 */
function buildOldOutfitsCss(scopePrefix, excludeSelector = '', outfitAttr = ':not([data-ba-sprite="current"])') {
  const exclude = excludeSelector ? `:not(${excludeSelector} *)` : '';
  const scopeOutfit = (selector) => selector.replace(/\.outfit\.id-/g, `.outfit${outfitAttr}.id-`);
  let rule = null;
  for (const sheet of document.styleSheets) {
    try {
      rule = findGameOldOutfitsRule(sheet.cssRules);
    } catch (_) { continue; /* cross-origin sheet */ }
    if (rule) break;
  }
  if (!rule) return null;
  // Flatten instead of re-serialising the parent so the result doesn't depend on how a
  // browser prints nested CSS (`& .outfit…` vs `.outfit…`).
  const rules = Array.from(rule.cssRules)
    .filter((r) => r.selectorText)
    .map((r) => `${scopePrefix} ${scopeOutfit(r.selectorText.replace(/^&\s*/, ''))}${exclude} { ${r.style.cssText} }`);
  // The game's own old-outfit rule gives these a smaller --size than their sheet's frame
  // size (Demon: 64px frames declared as 32px), which crops the sprite.
  for (const [outfitId, size] of Object.entries(OLD_OUTFIT_SIZE_FIXES)) {
    rules.push(`${scopePrefix} ${scopeOutfit(`.outfit.id-${outfitId}`)}${exclude} { --size: ${size}px; }`);
  }
  return rules.join('\n');
}

const OLD_OUTFIT_SIZE_FIXES = { 35: 64 };

/** Daily Seashell streak days that reward gazers (matches the in-game shell tooltip): the Albino Gazer on day 27, a random gazer on days 13 and 20. */
const GAZER_SEASHELL_REWARDS = {
  'albino gazer': [{ day: 27, rewardLabel: 'Albino Gazer' }],
  default: [
    { day: 13, rewardLabel: 'Random Gazer' },
    { day: 20, rewardLabel: 'Random Gazer' }
  ]
};
const getGazerSeashellRewards = (creatureName) =>
  GAZER_SEASHELL_REWARDS[String(creatureName || '').trim().toLowerCase()] || GAZER_SEASHELL_REWARDS.default;

/** Creatures hidden from Cyclopedia lists only (still in game data). */
const CYCLOPEDIA_HIDDEN_CREATURES = ['Dwarf Henchman'];

/**
 * Map-only creatures (the Unobtainable list) have no stored stats: the game scales a creature's
 * species `baseStats` with `state.utils.scaleStat({ stat, level, geneValue })` (actor constructor,
 * chunk 509: `scaledBaseStats`), and the Cyclopedia shows that at the level its room gives it, max
 * genes, no equipment. A room can set other genes or multipliers for its own copy; those are not modelled.
 */

/**
 * Highest level any room actor of this species has, read from the live room data, or null when the
 * rooms are not loaded or the species is on no board. Actors of one species can differ per room;
 * the highest is shown. `nameKey` is the lowercase species name.
 */
function getMapMonsterRoomLevel(nameKey) {
  const gameId = globalThis.BestiaryModAPI?.utility?.maps?.monsterNamesToGameIds?.get(nameKey);
  const fromDb = globalThis.mapsDatabase?.getAllMaps?.();
  const rooms = Array.isArray(fromDb) && fromDb.length > 0 ? fromDb : globalThis.state?.utils?.ROOMS;
  if (gameId == null || !rooms) return null;
  let best = null;
  const scan = (actors) => {
    if (!Array.isArray(actors)) return;
    for (const actor of actors) {
      const level = Number(actor?.level);
      if (actor?.id === gameId && Number.isFinite(level) && level > 0 && (best == null || level > best)) best = level;
    }
  };
  for (const room of Array.isArray(rooms) ? rooms : Object.values(rooms)) {
    scan(room?.file?.data?.actors);
    if (Array.isArray(room?.floorFiles)) room.floorFiles.forEach((floor) => scan(floor?.data?.actors));
  }
  return best;
}

const MAP_MONSTER_GENE_VALUE = 20;
const MAP_MONSTER_SCALED_STATS = ['hp', 'ad', 'ap', 'armor', 'magicResist'];

/**
 * Stats a map-only creature has at its map level (max genes, no equipment), or null when it has
 * none. Speed and attack delay are not scaled, so callers keep the species values for those.
 */
function getMapMonsterBaseStats(creatureName, speciesBaseStats) {
  const nameKey = String(creatureName ?? '').toLowerCase();
  const unobtainable = creatureDatabase?.UNOBTAINABLE_CREATURES ?? [];
  if (!unobtainable.some((name) => name.toLowerCase() === nameKey)) return null;
  const level = getMapMonsterRoomLevel(nameKey);
  const scaleStat = globalThis.state?.utils?.scaleStat;
  if (level == null || typeof scaleStat !== 'function' || !speciesBaseStats) return null;
  const stats = {};
  for (const stat of MAP_MONSTER_SCALED_STATS) {
    const base = speciesBaseStats[stat];
    if (typeof base !== 'number' || !Number.isFinite(base)) return null;
    stats[stat] = scaleStat({ stat: base, level, geneValue: MAP_MONSTER_GENE_VALUE });
  }
  return stats;
}

/** Stat bar display config for creature wiki templates. */
const MONSTER_STAT_DISPLAY_CONFIG = [
  { key: 'hp', label: 'Hitpoints', icon: '/assets/icons/heal.png', max: 1000, barColor: 'rgb(96, 192, 96)' },
  { key: 'ad', label: 'Attack Damage', icon: '/assets/icons/attackdamage.png', max: 110, barColor: 'rgb(255, 128, 96)' },
  { key: 'ap', label: 'Ability Power', icon: '/assets/icons/abilitypower.png', max: 90, barColor: 'rgb(128, 128, 255)' },
  { key: 'armor', label: 'Armor', icon: '/assets/icons/armor.png', max: 60, barColor: 'rgb(224, 224, 128)' },
  { key: 'magicResist', label: 'Magic Resist', icon: '/assets/icons/magicresist.png', max: 60, barColor: 'rgb(192, 128, 255)' },
  { key: 'speed', label: 'Speed', icon: '/assets/icons/speed.png', max: 200, barColor: 'rgb(255, 200, 100)' }
];

function getCyclopediaCreatureNames(obtainableCreatures) {
  const base = Array.isArray(obtainableCreatures) ? obtainableCreatures : [];
  const filtered = base.filter((name) => !CYCLOPEDIA_HIDDEN_CREATURES.includes(name));
  return [...new Set([...filtered, ...CYCLOPEDIA_EXTRA_CREATURES])].sort((a, b) => a.localeCompare(b));
}

/** Same list as Cyclopedia bestiary — use for creature pickers across mods. */
function getCreaturePickerNames(obtainableCreatures) {
  if (Array.isArray(obtainableCreatures)) {
    return getCyclopediaCreatureNames(obtainableCreatures);
  }
  return getCyclopediaCreatureNames(creatureDatabase?.ALL_CREATURES || []);
}

/** Seasonal / event creatures — no scroll / shiny. They can awaken; trackers only count them while the event is live. */
const EVENT_CREATURES = [
  'Clot',
  'Dwarf Merrymancer',
  'Football Elemental',
  'Goblin Gumslinger',
  'Goblin Saboteur',
  'Gummy Raider',
  'Reindeer',
  'Unionized Goblin'
];

function isEventCreatureName(creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  if (!norm) return false;
  if (getBossAliasByDisplayName(norm)) return true;
  return EVENT_CREATURES.some((name) => name.toLowerCase() === norm);
}

const LIVE_EVENT_CACHE_MS = 5000;
let liveEventCache = { at: 0, names: [] };

/**
 * EVENT_CREATURES that stand on a currently live event raid (any floor). Live = the game's
 * raid list holds a room that mapsDatabase.isDynamicEventMap classes as a seasonal event.
 * Cached for a few seconds: callers loop over many creatures.
 */
function getLiveEventCreatureNames() {
  const now = Date.now();
  if (now - liveEventCache.at < LIVE_EVENT_CACHE_MS) return liveEventCache.names;
  const names = new Set();
  try {
    const state = globalThis.state;
    const mapsDb = globalThis.mapsDatabase;
    const roomIds = (state?.raids?.getSnapshot?.()?.context?.list || [])
      .map((raid) => String(raid?.roomId || '').trim())
      .filter(Boolean);
    const eventIds = new Set();
    for (const name of EVENT_CREATURES) {
      const gameId = findMonsterByName(name)?.gameId;
      if (gameId != null) eventIds.add(Number(gameId));
    }
    for (const roomId of roomIds) {
      if (typeof mapsDb?.isDynamicEventMap !== 'function' || !mapsDb.isDynamicEventMap(roomId)) continue;
      for (const gameId of mapsDb.getRoomBoardGameIds?.(roomId) || []) {
        if (!eventIds.has(gameId)) continue;
        const name = state.utils?.getMonster?.(gameId)?.metadata?.name;
        if (name) names.add(name);
      }
    }
  } catch (_) { /* state not ready: treat as no live event */ }
  liveEventCache = { at: now, names: [...names] };
  return liveEventCache.names;
}

/** True when `creatureName` is an event creature whose event is live right now. */
function isEventCreatureLive(creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  return !!norm && getLiveEventCreatureNames().some((name) => name.toLowerCase() === norm);
}

/** Map-exclusive creatures — never drop from summon scrolls (Autoscroller hides them; Autoseller keeps them). */
const NON_SCROLL_CREATURES = ['Demon', 'Yeti'];

function isNonScrollCreatureName(creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  if (!norm) return false;
  return NON_SCROLL_CREATURES.some((name) => name.toLowerCase() === norm);
}

/** True for any gazer species or Albino Gazer (shiny Mystic). */
function isGazerCreatureName(creatureName) {
  const norm = String(creatureName ?? '').trim().toLowerCase();
  if (!norm) return false;
  if (norm.includes('gazer')) return true;
  const alias = getShinyAliasByDisplayName(creatureName);
  if (alias) return true;
  const monster = findMonsterByName(creatureName);
  return monster?.gameId != null && ALL_GAZER_GAME_IDS.has(Number(monster.gameId));
}

/**
 * Whether a creature's ability tooltip reads the `awaken` prop, i.e. has awakened text to show.
 * The game defines it as `TooltipContent: () => ...` (takes no props, nothing to toggle) or
 * `TooltipContent: t => ...` (awaken-aware). findMonsterByName resolves a boss alias to its base species, so a nickname is judged by the
 * species it labels. Returns null when the data is not available.
 */
function abilityTooltipTakesAwaken(creatureName) {
  const tooltip = findMonsterByName(creatureName)?.metadata?.skill?.TooltipContent;
  return typeof tooltip === 'function' ? tooltip.length > 0 : null;
}

/**
 * True when a creature has an awakened ability to show: not a gazer, not in NON_AWAKENABLE, and
 * its tooltip has awakened text. Event creatures qualify (viewing is not tied to a live event).
 * Boss aliases follow their base species.
 */
function isCreatureAwakenableName(creatureName) {
  if (!creatureName) return false;
  if (isGazerCreatureName(creatureName)) return false;
  const norm = String(creatureName).trim().toLowerCase();
  const blocked = creatureDatabase?.NON_AWAKENABLE_CREATURES;
  if (Array.isArray(blocked) && blocked.some((n) => String(n).toLowerCase() === norm)) return false;
  return abilityTooltipTakesAwaken(creatureName) !== false;
}

/** True when an owned monster is a gazer species (by gameId or display name). */
function isGazerMonster(monster) {
  if (!monster) return false;
  if (monster.gameId != null && ALL_GAZER_GAME_IDS.has(Number(monster.gameId))) return true;
  const ownedDisplay = getDisplayNameForOwnedMonster(monster);
  if (ownedDisplay && isGazerCreatureName(ownedDisplay)) return true;
  const species = monster?.metadata?.name
    ?? (monster.gameId != null ? findMonsterByGameId(monster.gameId)?.metadata?.name : null);
  return species ? isGazerCreatureName(species) : false;
}

/** All gazer species for Cyclopedia Inventory tab (incl. Albino Gazer). */
function getGazerCreatureNames(obtainableCreatures) {
  const names = new Set();
  const base = Array.isArray(obtainableCreatures)
    ? obtainableCreatures
    : (creatureDatabase?.ALL_CREATURES || []);
  base.forEach((name) => {
    if (isGazerCreatureName(name)) names.add(name);
  });
  CYCLOPEDIA_EXTRA_CREATURES.forEach((name) => {
    if (isGazerCreatureName(name)) names.add(name);
  });
  return [...names].sort((a, b) => a.localeCompare(b));
}

/** Creature pickers for Autoscroller / Autoseller (no gazers or event creatures). */
function getAutoscrollAutosellerCreaturePickerNames(obtainableCreatures) {
  return getCreaturePickerNames(obtainableCreatures).filter(
    (name) => !isGazerCreatureName(name) && !isEventCreatureName(name)
  );
}

/** Creatures that count toward shiny collection progress (no event/gazer species; must have a shiny variant). */
function getShinyProgressCreatureNames(obtainableCreatures) {
  const base = Array.isArray(obtainableCreatures)
    ? obtainableCreatures
    : (creatureDatabase?.ALL_CREATURES || []);
  return base.filter(
    (name) => !CYCLOPEDIA_HIDDEN_CREATURES.includes(name)
      && !isEventCreatureName(name)
      && !isGazerCreatureName(name)
      && creatureHasShinyVariant(name)
  );
}

function isShinyProgressCreatureName(creatureName) {
  if (!creatureName || CYCLOPEDIA_HIDDEN_CREATURES.includes(creatureName)) return false;
  if (isEventCreatureName(creatureName)) return false;
  if (isGazerCreatureName(creatureName)) return false;
  return creatureHasShinyVariant(creatureName);
}

/** Display name for an owned monster (shiny Mystic Gazer → Albino Gazer). */
function getDisplayNameForOwnedMonster(monster) {
  if (!monster || monster.gameId == null) return null;
  if (isMysticGazerId(monster.gameId)) {
    return monster.shiny === true ? 'Albino Gazer' : 'Mystic Gazer';
  }
  const data = findMonsterByGameId(monster.gameId);
  return data?.metadata?.name ?? null;
}

/** Whether an inventory monster belongs to a Cyclopedia/display creature name. */
function monsterMatchesCreatureDisplay(displayName, monster) {
  return queryMatchesMonster(resolveCreatureDisplay(displayName), monster);
}

const MONSTER_SCAN_MAX_ID = 1000;
// getMonster() can throw or return nothing on an id gap; tolerate this many before giving up.
const MONSTER_SCAN_MAX_GAP = 50;

let monsterScanCache = null;

/**
 * The one place that reads state.utils.getMonster. Returns [{ gameId, monster }] for every id,
 * cached once non-empty (an empty result means the registry is not ready and is never cached).
 */
function scanMonsters() {
  if (monsterScanCache) return monsterScanCache;
  const getMonster = (globalThis.state || window.state)?.utils?.getMonster;
  if (typeof getMonster !== 'function') return [];

  const found = [];
  let consecutiveFailures = 0;
  for (let i = 1; i < MONSTER_SCAN_MAX_ID && consecutiveFailures < MONSTER_SCAN_MAX_GAP; i++) {
    try {
      const monster = getMonster(i);
      if (monster?.metadata?.name) {
        consecutiveFailures = 0;
        found.push({ gameId: i, monster });
      } else {
        consecutiveFailures += 1;
      }
    } catch (e) { consecutiveFailures += 1; }
  }
  if (found.length > 0) monsterScanCache = found;
  return found;
}

// Creature database with shiny portrait support
function getAllMonsters() {
  return scanMonsters().map(({ gameId, monster }) => ({
    gameId,
    ...monster,
    portraits: {
      normal: `/assets/portraits/${gameId}.png`,
      shiny: `/assets/portraits/${gameId}-shiny.png`
    }
  }));
}

function buildCreatureDatabase() {
  try {
    const allMonsters = getAllMonsters();
    
    if (allMonsters.length === 0) {
      console.warn('[creature-database.js] No monsters loaded, returning empty database');
      return {
        ALL_CREATURES: [],
        UNOBTAINABLE_CREATURES: [],
        NON_AWAKENABLE_CREATURES: [],
        CYCLOPEDIA_EXTRA_CREATURES,
        getCyclopediaCreatureNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
        resolveCreatureDisplay,
        creatureHasShinyVariant,
        filterMonstersForCreatureDisplay,
        getCreaturePickerNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
        getAutoscrollAutosellerCreaturePickerNames: () => [],
        EVENT_CREATURES,
        isEventCreatureName,
        isEventCreatureLive,
        getLiveEventCreatureNames,
        isGazerCreatureName,
        isCreatureAwakenableName,
        isGazerMonster,
        getGazerCreatureNames: () => getGazerCreatureNames([]),
        getShinyProgressCreatureNames: () => [],
        isShinyProgressCreatureName,
        getDisplayNameForOwnedMonster,
        monsterMatchesCreatureDisplay
      };
    }
    
    const allCreatureNames = allMonsters.map(m => m.metadata.name);
    const hardcodedUnobtainable = ['Astronis', 'Black Knight', 'Beer Barrel', 'Cake Drake', 'Cobra Statue', 'Dharalion', 'Dead Tree', 'Dwarf Henchman', 'Earth Crystal', 'Energy Crystal', 'Grynch Clan Commander', 'Grynch Clan Mastermind', 'Healer', 'Lavahole', 'Magma Crystal', 'Mateusz Dragon Wielki', 'Morguthis', 'Monster Cauldron', 'Obelisk', 'Old Giant Spider', 'Omruc', 'Orc', 'Orshabaal', 'Rahemos', 'Regeneration Tank', 'Rostein', 'Setzer Gambler', 'Shooter', 'Sweaty Cyclops', 'Tentugly', 'Ti', 'Vladrukh', 'Willi Wasp', 'The Percht Queen'];
    const hardcodedNonAwakenable = [];

    const unobtainableFromMonsters = allMonsters
      .filter(m => hardcodedUnobtainable.includes(m.metadata.name))
      .map(m => m.metadata.name);
    
    const unobtainableCreatures = [...new Set([
      ...hardcodedUnobtainable,
      ...unobtainableFromMonsters,
      ...BOSS_ALIAS_CREATURES.map((entry) => entry.displayName)
    ])]
      .sort((a, b) => a.localeCompare(b));
    
    const nonAwakenableCreatures = [...new Set([
      ...hardcodedNonAwakenable,
      ...allMonsters
        .filter(m => m.metadata.name.toLowerCase().includes('gazer'))
        .map(m => m.metadata.name),
      ...CYCLOPEDIA_EXTRA_CREATURES
    ])].sort((a, b) => a.localeCompare(b));

    const obtainableCreatures = allCreatureNames
      .filter(name => !hardcodedUnobtainable.includes(name))
      .sort((a, b) => a.localeCompare(b));
    
    return {
      ALL_CREATURES: obtainableCreatures,
      UNOBTAINABLE_CREATURES: unobtainableCreatures,
      NON_AWAKENABLE_CREATURES: nonAwakenableCreatures,
      CYCLOPEDIA_EXTRA_CREATURES,
      MYSTIC_GAZER_GAME_ID,
      ALL_GAZER_GAME_IDS,
      GAZER_GAME_IDS_WITHOUT_SHINY,
      SHINY_ALIAS_CREATURES,
      BOSS_ALIAS_CREATURES,
      getCyclopediaCreatureNames: () => getCyclopediaCreatureNames(obtainableCreatures),
      getCreaturePickerNames: () => getCyclopediaCreatureNames(obtainableCreatures),
      getAutoscrollAutosellerCreaturePickerNames: () => getAutoscrollAutosellerCreaturePickerNames(obtainableCreatures),
      EVENT_CREATURES,
      isEventCreatureName,
      isEventCreatureLive,
      getLiveEventCreatureNames,
      isGazerCreatureName,
      isCreatureAwakenableName,
      isGazerMonster,
      getGazerCreatureNames: () => getGazerCreatureNames(obtainableCreatures),
      getShinyProgressCreatureNames: () => getShinyProgressCreatureNames(obtainableCreatures),
      isShinyProgressCreatureName,
      resolveCreatureDisplay,
      creatureHasShinyVariant,
      filterMonstersForCreatureDisplay,
      getDisplayNameForOwnedMonster,
      monsterMatchesCreatureDisplay
    };
  } catch (error) {
    console.error('[creature-database.js] Error building database:', error);
    return {
      ALL_CREATURES: [],
      UNOBTAINABLE_CREATURES: [],
      NON_AWAKENABLE_CREATURES: [],
      CYCLOPEDIA_EXTRA_CREATURES,
      getCyclopediaCreatureNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
      resolveCreatureDisplay,
      creatureHasShinyVariant,
      filterMonstersForCreatureDisplay,
      getCreaturePickerNames: () => [...CYCLOPEDIA_EXTRA_CREATURES],
      getAutoscrollAutosellerCreaturePickerNames: () => [],
      EVENT_CREATURES,
      isEventCreatureName,
      isEventCreatureLive,
      getLiveEventCreatureNames,
      isGazerCreatureName,
      isCreatureAwakenableName,
      isGazerMonster,
      getGazerCreatureNames: () => getGazerCreatureNames([]),
      getShinyProgressCreatureNames: () => [],
      isShinyProgressCreatureName,
      getDisplayNameForOwnedMonster,
      monsterMatchesCreatureDisplay
    };
  }
}

function getMonsterPortraitUrl(monsterId, isShiny = false) {
  return `/assets/portraits/${monsterId}${isShiny ? '-shiny' : ''}.png`;
}

function getMonsterPortraitUrls(monsterId) {
  return {
    normal: getMonsterPortraitUrl(monsterId, false),
    shiny: getMonsterPortraitUrl(monsterId, true)
  };
}

let monsterNameMapCache = null;
let monsterIdMapCache = null;

function ensureMonsterMaps() {
  if (monsterNameMapCache && monsterIdMapCache) return;
  const scanned = scanMonsters();
  // Not ready: callers get uncached empty maps (see getMonsterNameMap) so a later call can build.
  if (scanned.length === 0) return;
  const nameMap = new Map();
  const idMap = new Map();
  for (const { gameId, monster } of scanned) {
    const entry = { monster, gameId, index: gameId };
    nameMap.set(monster.metadata.name.toLowerCase(), entry);
    idMap.set(gameId, entry);
  }
  monsterNameMapCache = nameMap;
  monsterIdMapCache = idMap;
  populateGazerIds(scanned);
}

/** Whether a game id is Mystic Gazer's (false until the registry has been scanned). */
function isMysticGazerId(gameId) {
  return MYSTIC_GAZER_GAME_ID != null && gameId != null && Number(gameId) === MYSTIC_GAZER_GAME_ID;
}

/** Fills the gazer id sets from the scanned registry, mutating them in place. */
function populateGazerIds(scanned) {
  ALL_GAZER_GAME_IDS.clear();
  GAZER_GAME_IDS_WITHOUT_SHINY.clear();
  MYSTIC_GAZER_GAME_ID = null;
  for (const { gameId, monster } of scanned) {
    const name = String(monster?.metadata?.name ?? '').toLowerCase();
    if (!name.includes('gazer')) continue;
    ALL_GAZER_GAME_IDS.add(gameId);
    if (name === MYSTIC_GAZER_NAME) MYSTIC_GAZER_GAME_ID = gameId;
    else GAZER_GAME_IDS_WITHOUT_SHINY.add(gameId);
  }
  SHINY_ALIAS_CREATURES.forEach((alias) => { alias.gameId = MYSTIC_GAZER_GAME_ID; });
}

/** Cached lowercase name → { monster, gameId, index } for O(1) lookups. */
function getMonsterNameMap() {
  ensureMonsterMaps();
  return monsterNameMapCache || new Map();
}

/** Raw game monster for an id (no gameId merged in), or null. The single id accessor for mods. */
function getMonsterById(gameId) {
  ensureMonsterMaps();
  return monsterIdMapCache?.get(Number(gameId))?.monster ?? null;
}

function findMonsterByGameId(gameId) {
  ensureMonsterMaps();
  const entry = monsterIdMapCache?.get(Number(gameId));
  return entry ? { gameId: entry.gameId, ...entry.monster } : undefined;
}

function findMonsterByName(name) {
  const alias = getShinyAliasByDisplayName(name) ?? getBossAliasByDisplayName(name);
  if (alias) {
    return findMonsterByGameId(alias.gameId);
  }
  const entry = getMonsterNameMap().get(String(name).toLowerCase());
  return entry ? { gameId: entry.gameId, ...entry.monster } : undefined;
}

/** Ready once the game's monster registry answers; the database reads nothing else. */
function isMonsterRegistryReady() {
  try {
    const state = globalThis.state || window.state;
    return !!state?.utils?.getMonster?.(1)?.metadata?.name;
  } catch (error) {
    return false;
  }
}

// Fast phase (250ms x 20), then a slow phase (2s x 60) so a cold load never ends with a
// permanently empty database. The database is only built once the registry is ready (BAWait: content/ba-wait.js).
const waitForGameState = (callback) => globalThis.BAWait?.gameState(callback, {
  label: 'creature-database.js',
  ready: isMonsterRegistryReady,
  slowRetries: 60,
  buildAnyway: false
});

// Initialize database with lazy loading
let creatureDatabase = null;
let databaseInitialized = false;

function initializeDatabase() {
  if (databaseInitialized) return creatureDatabase;

  ensureMonsterMaps(); // fills the gazer id sets before the build reads them
  creatureDatabase = buildCreatureDatabase();
  
  creatureDatabase.getMonsterPortraitUrl = getMonsterPortraitUrl;
  creatureDatabase.getMonsterPortraitUrls = getMonsterPortraitUrls;
  creatureDatabase.findMonsterByGameId = findMonsterByGameId;
  creatureDatabase.findMonsterByName = findMonsterByName;
  creatureDatabase.getAllMonstersWithPortraits = getAllMonsters;
  creatureDatabase.getCyclopediaCreatureNames = creatureDatabase.getCyclopediaCreatureNames || (() => getCyclopediaCreatureNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.resolveCreatureDisplay = resolveCreatureDisplay;
  creatureDatabase.creatureHasShinyVariant = creatureHasShinyVariant;
  creatureDatabase.buildOldOutfitsCss = buildOldOutfitsCss;
  creatureDatabase.filterMonstersForCreatureDisplay = filterMonstersForCreatureDisplay;
  creatureDatabase.getCreaturePickerNames = creatureDatabase.getCreaturePickerNames || (() => getCyclopediaCreatureNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.getAutoscrollAutosellerCreaturePickerNames = creatureDatabase.getAutoscrollAutosellerCreaturePickerNames || (() => getAutoscrollAutosellerCreaturePickerNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.EVENT_CREATURES = EVENT_CREATURES;
  creatureDatabase.isEventCreatureName = isEventCreatureName;
  creatureDatabase.isEventCreatureLive = isEventCreatureLive;
  creatureDatabase.getLiveEventCreatureNames = getLiveEventCreatureNames;
  creatureDatabase.NON_SCROLL_CREATURES = NON_SCROLL_CREATURES;
  creatureDatabase.isNonScrollCreatureName = isNonScrollCreatureName;
  creatureDatabase.isGazerCreatureName = isGazerCreatureName;
  creatureDatabase.ALL_GAZER_GAME_IDS = ALL_GAZER_GAME_IDS;
  creatureDatabase.MYSTIC_GAZER_GAME_ID = MYSTIC_GAZER_GAME_ID;
  creatureDatabase.isCreatureAwakenableName = isCreatureAwakenableName;
  creatureDatabase.isGazerMonster = isGazerMonster;
  creatureDatabase.getGazerCreatureNames = creatureDatabase.getGazerCreatureNames || (() => getGazerCreatureNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.getShinyProgressCreatureNames = creatureDatabase.getShinyProgressCreatureNames || (() => getShinyProgressCreatureNames(creatureDatabase.ALL_CREATURES));
  creatureDatabase.isShinyProgressCreatureName = isShinyProgressCreatureName;
  creatureDatabase.getDisplayNameForOwnedMonster = getDisplayNameForOwnedMonster;
  creatureDatabase.monsterMatchesCreatureDisplay = monsterMatchesCreatureDisplay;
  creatureDatabase.CYCLOPEDIA_EXTRA_CREATURES = CYCLOPEDIA_EXTRA_CREATURES;
  creatureDatabase.CYCLOPEDIA_HIDDEN_CREATURES = CYCLOPEDIA_HIDDEN_CREATURES;
  creatureDatabase.getGazerSeashellRewards = getGazerSeashellRewards;
  creatureDatabase.getMapMonsterBaseStats = getMapMonsterBaseStats;
  creatureDatabase.getCreatureCombatData = getCreatureCombatData;
  creatureDatabase.getAbilityScene = getAbilityScene;
  creatureDatabase.getEffectSheet = getEffectSheet;
  creatureDatabase.describeCreatureCombatSections = describeCreatureCombatSections;
  creatureDatabase.describeSummonOwnerRows = describeSummonOwnerRows;
  creatureDatabase.getCreatureCombatTuningDefaults = getCreatureCombatTuningDefaults;
  creatureDatabase.walkStepTicks = walkStepTicks;
  creatureDatabase.SCENE_MISSILE_MS = SCENE_MISSILE_MS;
  creatureDatabase.walkStepDurationMs = walkStepDurationMs;
  creatureDatabase.MONSTER_STAT_DISPLAY_CONFIG = MONSTER_STAT_DISPLAY_CONFIG;
  creatureDatabase.getMonsterNameMap = getMonsterNameMap;
  creatureDatabase.getMonsterById = getMonsterById;
  
  databaseInitialized = true;
  return creatureDatabase;
}

const placeholderDatabase = {
  ALL_CREATURES: [],
  UNOBTAINABLE_CREATURES: [],
  NON_AWAKENABLE_CREATURES: [],
  CYCLOPEDIA_EXTRA_CREATURES,
  CYCLOPEDIA_HIDDEN_CREATURES,
  getMapMonsterBaseStats,
  getCreatureCombatData,
  getAbilityScene,
  getEffectSheet,
  describeCreatureCombatSections,
  describeSummonOwnerRows,
  getCreatureCombatTuningDefaults,
  walkStepTicks,
  walkStepDurationMs,
  SCENE_MISSILE_MS,
  MONSTER_STAT_DISPLAY_CONFIG,
  MYSTIC_GAZER_GAME_ID,
  SHINY_ALIAS_CREATURES,
  BOSS_ALIAS_CREATURES,
  getCyclopediaCreatureNames: () => getCyclopediaCreatureNames([]),
  getMonsterNameMap,
  getMonsterById,
  resolveCreatureDisplay,
  creatureHasShinyVariant,
  buildOldOutfitsCss,
  filterMonstersForCreatureDisplay,
  getCreaturePickerNames: () => getCyclopediaCreatureNames([]),
  getAutoscrollAutosellerCreaturePickerNames: () => [],
  EVENT_CREATURES,
  isEventCreatureName,
  isEventCreatureLive,
  getLiveEventCreatureNames,
  isGazerCreatureName,
  isCreatureAwakenableName,
  isGazerMonster,
  getGazerCreatureNames: () => getGazerCreatureNames([]),
  getShinyProgressCreatureNames: () => [],
  isShinyProgressCreatureName,
  getDisplayNameForOwnedMonster,
  monsterMatchesCreatureDisplay,
  CYCLOPEDIA_HIDDEN_CREATURES,
  getMapMonsterBaseStats,
  MONSTER_STAT_DISPLAY_CONFIG,
  getMonsterNameMap,
  getMonsterPortraitUrl: getMonsterPortraitUrl,
  getMonsterPortraitUrls: getMonsterPortraitUrls,
  findMonsterByGameId: function(gameId) {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.findMonsterByGameId ? creatureDatabase.findMonsterByGameId(gameId) : null;
    }
    if (!databaseInitialized) {
      return null;
    }
    return findMonsterByGameId(gameId);
  },
  findMonsterByName: function(name) {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.findMonsterByName ? creatureDatabase.findMonsterByName(name) : null;
    }
    if (!databaseInitialized) {
      return null;
    }
    return findMonsterByName(name);
  },
  getAllMonstersWithPortraits: function() {
    if (!databaseInitialized && creatureDatabase) {
      return creatureDatabase.getAllMonstersWithPortraits ? creatureDatabase.getAllMonstersWithPortraits() : [];
    }
    if (!databaseInitialized) {
      return [];
    }
    return getAllMonsters();
  }
};

const globalWindow = globalThis.window || window || (typeof window !== 'undefined' ? window : null);
if (globalWindow && !globalWindow.creatureDatabase) {
  globalWindow.creatureDatabase = placeholderDatabase;
}

waitForGameState(() => {
  initializeDatabase();
  
  if (globalWindow) {
    Object.assign(globalWindow.creatureDatabase, creatureDatabase);
    globalWindow.creatureDatabase.ALL_CREATURES = creatureDatabase.ALL_CREATURES;
    globalWindow.creatureDatabase.UNOBTAINABLE_CREATURES = creatureDatabase.UNOBTAINABLE_CREATURES;
    globalWindow.creatureDatabase.NON_AWAKENABLE_CREATURES = creatureDatabase.NON_AWAKENABLE_CREATURES;
    globalWindow.creatureDatabase.CYCLOPEDIA_EXTRA_CREATURES = creatureDatabase.CYCLOPEDIA_EXTRA_CREATURES;
    globalWindow.creatureDatabase.getCyclopediaCreatureNames = creatureDatabase.getCyclopediaCreatureNames;
    globalWindow.creatureDatabase.resolveCreatureDisplay = resolveCreatureDisplay;
    globalWindow.creatureDatabase.creatureHasShinyVariant = creatureHasShinyVariant;
    globalWindow.creatureDatabase.filterMonstersForCreatureDisplay = filterMonstersForCreatureDisplay;
    globalWindow.creatureDatabase.getCreaturePickerNames = creatureDatabase.getCreaturePickerNames;
    globalWindow.creatureDatabase.getAutoscrollAutosellerCreaturePickerNames = creatureDatabase.getAutoscrollAutosellerCreaturePickerNames;
    globalWindow.creatureDatabase.EVENT_CREATURES = EVENT_CREATURES;
    globalWindow.creatureDatabase.isEventCreatureName = isEventCreatureName;
    globalWindow.creatureDatabase.isEventCreatureLive = isEventCreatureLive;
    globalWindow.creatureDatabase.getLiveEventCreatureNames = getLiveEventCreatureNames;
    globalWindow.creatureDatabase.NON_SCROLL_CREATURES = NON_SCROLL_CREATURES;
    globalWindow.creatureDatabase.isNonScrollCreatureName = isNonScrollCreatureName;
    globalWindow.creatureDatabase.isGazerCreatureName = isGazerCreatureName;
    globalWindow.creatureDatabase.ALL_GAZER_GAME_IDS = ALL_GAZER_GAME_IDS;
    globalWindow.creatureDatabase.MYSTIC_GAZER_GAME_ID = MYSTIC_GAZER_GAME_ID;
    globalWindow.creatureDatabase.isCreatureAwakenableName = isCreatureAwakenableName;
    globalWindow.creatureDatabase.isGazerMonster = isGazerMonster;
    globalWindow.creatureDatabase.getGazerCreatureNames = creatureDatabase.getGazerCreatureNames;
    globalWindow.creatureDatabase.getShinyProgressCreatureNames = creatureDatabase.getShinyProgressCreatureNames;
    globalWindow.creatureDatabase.isShinyProgressCreatureName = isShinyProgressCreatureName;
    globalWindow.creatureDatabase.getDisplayNameForOwnedMonster = getDisplayNameForOwnedMonster;
    globalWindow.creatureDatabase.monsterMatchesCreatureDisplay = monsterMatchesCreatureDisplay;
    globalWindow.creatureDatabase.CYCLOPEDIA_HIDDEN_CREATURES = CYCLOPEDIA_HIDDEN_CREATURES;
    globalWindow.creatureDatabase.getGazerSeashellRewards = getGazerSeashellRewards;
    globalWindow.creatureDatabase.getMapMonsterBaseStats = getMapMonsterBaseStats;
    globalWindow.creatureDatabase.getCreatureCombatData = getCreatureCombatData;
    globalWindow.creatureDatabase.getAbilityScene = getAbilityScene;
    globalWindow.creatureDatabase.getEffectSheet = getEffectSheet;
    globalWindow.creatureDatabase.describeCreatureCombatSections = describeCreatureCombatSections;
    globalWindow.creatureDatabase.describeSummonOwnerRows = describeSummonOwnerRows;
    globalWindow.creatureDatabase.getCreatureCombatTuningDefaults = getCreatureCombatTuningDefaults;
    globalWindow.creatureDatabase.walkStepTicks = walkStepTicks;
    globalWindow.creatureDatabase.SCENE_MISSILE_MS = SCENE_MISSILE_MS;
    globalWindow.creatureDatabase.walkStepDurationMs = walkStepDurationMs;
    globalWindow.creatureDatabase.MONSTER_STAT_DISPLAY_CONFIG = MONSTER_STAT_DISPLAY_CONFIG;
    globalWindow.creatureDatabase.getMonsterNameMap = getMonsterNameMap;
    globalWindow.creatureDatabase.getMonsterById = getMonsterById;
    globalWindow.creatureDatabase.findMonsterByGameId = findMonsterByGameId;
    globalWindow.creatureDatabase.findMonsterByName = findMonsterByName;
    globalWindow.creatureDatabase.getAllMonstersWithPortraits = getAllMonsters;
    
    console.log(`[creature-database.js] Loaded ${creatureDatabase.ALL_CREATURES.length} creatures dynamically (cached for all mods)`);
    console.log('[creature-database.js] ALL_CREATURES length:', creatureDatabase.ALL_CREATURES?.length);
    console.log('[creature-database.js] UNOBTAINABLE_CREATURES length:', creatureDatabase.UNOBTAINABLE_CREATURES?.length);
    console.log('[creature-database.js] Portrait utilities added for shiny creature support');
  }
  if (typeof module !== 'undefined') {
    module.exports = creatureDatabase;
  }
});

