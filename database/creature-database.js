console.log('[creature-database.js] Loading creature database...');

/** Gazer species: only Mystic Gazer (97) has a shiny portrait; shiny displays as Albino Gazer in Cyclopedia. */
const MYSTIC_GAZER_GAME_ID = 97;
const GAZER_GAME_IDS_WITHOUT_SHINY = new Set([93, 94, 95, 96]);
const ALL_GAZER_GAME_IDS = new Set([93, 94, 95, 96, MYSTIC_GAZER_GAME_ID]);
const SHINY_ALIAS_CREATURES = [
  {
    displayName: 'Albino Gazer',
    gameId: MYSTIC_GAZER_GAME_ID,
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
  1: {"n":"Rat","ad":null,"c":{"ATTACK_NORMAL":10,"ATTACKED":5}},
  2: {"n":"Minotaur","ad":3000,"c":{"BASE_DMG":2,"AP_RATIO":0.5,"STUN_MS":2000,"COOLDOWN_MS":9000,"INITIAL_COOLDOWN_MS":3000,"AWAKEN_HEAL_PER_HIT_INNER":15,"AWAKEN_HEAL_PER_HIT_OUTER":5,"AWAKEN_CDR_MS_PER_HIT_INNER":500,"AWAKEN_CDR_MS_PER_HIT_OUTER":100,"MIN_COOLDOWN_MS":4000}},
  3: {"n":"Minotaur Mage","ad":null,"c":{"MAX_HP_EFFECT":1000,"CDR_PER_AP":180,"AWAKEN_SPLASH_DAMAGE":5,"BASE_COOLDOWN_MS":24000,"MIN_COOLDOWN_MS":5000}},
  4: {"n":"Orc Spearman","ad":null,"c":{"SPEAR_DAMAGE_MULTIPLIER":2,"AWAKEN_LIFESTEAL":0.15,"AWAKEN_LIFESTEAL_DURATION_MS":3000,"COOLDOWN_MS":10000,"COOLDOWN_REDUCTION_PERCENT":0.5,"MIN_COOLDOWN_MS":4000}},
  5: {"n":"Sheep","ad":null,"c":{"HEAL_BASE":15,"HEAL_AP_RATIO":0.6,"DEATH_HEAL_BASE_PERCENT":0.2,"DEATH_HEAL_PERCENT_PER_AP":0.01,"COOLDOWN_MS":3000,"MIN_COOLDOWN_MS":1000,"AWAKEN_HP_PERCENT_REVIVE":0.25}},
  6: {"n":"Wasp","ad":null,"c":{}},
  7: {"n":"Skeleton","ad":null,"c":{"REVIVE_COOLDOWN_MS":32000,"CDR_MS_PER_AP":400,"AWAKEN_AD_PER_REVIVE":4,"MIN_COOLDOWN_MS":4000}},
  8: {"n":"Tortoise","ad":null,"c":{}},
  9: {"n":"Bear","ad":null,"c":{"COOLDOWN_MS":7500,"HEAL_BASE":5,"AD_RATIO":2,"STUN_MS":2000,"HEAL_AP_RATIO":0.15,"HEAL_TICK_FREQUENCY_MS":1250}},
  10: {"n":"Rotworm","ad":null,"c":{}},
  11: {"n":"Spider","ad":3000,"c":{"BASE_DMG":10,"DMG_AP_RATIO":0.2,"BASE_DURATION":500,"COOLDOWN_MS":10000,"DURATION_AP_RATIO":50,"AWAKEN_FLAT_ARMOR":100,"MIN_COOLDOWN_MS":7000}},
  12: {"n":"Goblin","ad":null,"c":{"FLAT_BONUS_AD_PER_LEVEL":3,"AWAKEN_ATTACK_SPEED_PER_LEVEL":0.01,"INITIAL_DISTANCE_LEVEL":1}},
  13: {"n":"Wolf","ad":null,"c":{"BASE_EXECUTE_PERCENT":0.1,"CDR_MS":2000,"BUFF_FLAT_AP_PER_LUPINE":3,"BUFF_DURATION_MS":3000,"COOLDOWN_MS":10000,"CDR_TICKS":2000,"MIN_COOLDOWN_MS":3000}},
  14: {"n":"Troll","ad":3000,"c":{"SPAWN_COUNT":3,"AD_PER_USER_AP":0.1,"HP_PER_USER_AP":1,"AWAKEN_FLAT_STAT_BUFF":2,"COOLDOWN_MS":14000,"MIN_COOLDOWN_MS":5000}},
  15: {"n":"Poison Spider","ad":null,"c":{"TIMES":3,"DAMAGE_BASE":5,"DAMAGE_AP_RATIO":0.4,"AWAKEN_SPELL_VAMP_PERCENT":0.15,"COOLDOWN_MS":5000,"FLURRY_TICKS_INTERVAL":3,"MIN_COOLDOWN_MS":2500}},
  16: {"n":"Snake","ad":null,"c":{"BASE_DMG":10,"DMG_AP_RATIO":0.7,"STUN_BASE_DURATION_MS":3000,"STUN_DURATION_AP_RATIO":30,"FLAT_ARMOR":200,"AWAKEN_AP_DEBUFF_PERCENT":-1,"AWAKEN_AD_DEBUFF_PERCENT":-1,"COOLDOWN_MS":8000,"MAX_STUN_MS":6000,"MIN_COOLDOWN_MS":4000}},
  17: {"n":"Bug","ad":3000,"c":{}},
  18: {"n":"Slime","ad":4000,"c":{"STARTING_HP":5,"MAX_SPAWN_COUNT":2,"CDR_PER_AP":80,"AWAKEN_EXTRA_SPAWN":1,"BASE_COOLDOWN_MS":12000,"MIN_COOLDOWN_MS":2000}},
  19: {"n":"Ghoul","ad":3000,"c":{"AP_PERCENT_DAMAGE":0.2,"HP_PERCENT_HEAL_PER_TARGET":0.02,"CD_MS":2000,"MIN_COOLDOWN_MS":1000}},
  20: {"n":"Fire Devil","ad":null,"c":{"BASE_DMG":3,"DMG_AP_RATIO":0.7,"COOLDOWN_MS":3000,"AWAKEN_GREAT_FIREBALL_EVERY":3,"MIN_COOLDOWN_MS":1500}},
  21: {"n":"Demon Skeleton","ad":null,"c":{"RECHARGE_MS":3000,"ATTACK_DAMAGE_BUFF":15,"LIFESTEAL_BASE":0.5,"ATTACK_DELAY_BUFF":-0.3,"HP_PERCENTAGE_DECAY_PER_TICK":0.1,"HP_DECAY_TICK_MS":1000,"LIFESTEAL_AP_RATIO":0.5}},
  22: {"n":"Ghost","ad":null,"c":{"CHARGE_TIME_MS":3000,"REVIVE_BASE_HP_PERCENT":0.5,"REVIVE_HP_PERCENT_AP_RATIO":0.5}},
  23: {"n":"Scorpion","ad":3000,"c":{"POISON_TICK_BASE_DMG":1,"POISON_TICK_AP_RATIO":0.15,"POISON_TICK_FREQUENCY_MS":1500,"POISON_BOOM_BASE_DMG":15,"POISON_BOOM_AP_RATIO":0.2,"POISON_DURATION_MS":12000}},
  24: {"n":"Monk","ad":null,"c":{"BONUS_FLAT_ARMOR":70,"BONUS_FLAT_MAGIC_RESIST":70,"HEAL_BASE":6,"HEAL_AP_RATIO":0.5,"EXPLOSION_DMG_PERCENT_BASE":0.4,"AWAKEN_HEAL_PERCENT":0.25,"COOLDOWN_MS":5000,"CHANNEL_DURATION_MS":6000,"TICK_FREQUENCY_MS":1500,"EXPLOSION_DMG_PERCENT_PER_AP":0.00125,"MIN_COOLDOWN_MS":1000}},
  25: {"n":"Banshee","ad":3000,"c":{"DMG_BASE":10,"DMG_AP_RATIO":0.7,"FLEE_HP_PERCENT":0.4,"HEAL_BASE":15,"HEAL_AP_RATIO":0.5,"AWAKEN_HEAL_REDUCTION_PERCENT":0.8,"AWAKEN_MAGIC_RESIST_REDUCTION_FLAT":-15,"AWAKEN_HEAL_REDUCTION_MS":2500,"COOLDOWN_MS":6000,"MIN_COOLDOWN_MS":2000}},
  26: {"n":"Dragon Lord","ad":3000,"c":{"STEP_DMG_BASE":3,"STEP_DMG_AP_RATIO":0.3,"AWAKEN_MOVE_SPEED_BUFF":30,"COOLDOWN_MS":5000,"AWAKEN_MOVE_SPEED_DURATION_MS":2000,"MIN_COOLDOWN_MS":500}},
  27: {"n":"Stalker","ad":null,"c":{"INVISIBLE_DURATION_MS":6000,"FLAT_SPEED_BUFF":30,"FLAT_HEAL":3,"AP_RATIO_HEAL":0.15,"COOLDOWN_MS":7000,"AP_RATIO_SPEED_BUFF":0.5,"HEAL_FREQUENCY_MS":800,"MIN_COOLDOWN_MS":3000}},
  28: {"n":"Mummy","ad":3000,"c":{"DURATION_MS":4000,"SLOW_PERCENT":0.5,"STEP_BASE_DAMAGE_PERCENT":0.05,"COOLDOWN_MS":2000,"BASE_DAMAGE":0,"DAMAGE_AP_RATIO":0.15,"STEP_AP_RATIO_PERCENT":0.001}},
  29: {"n":"Druid","ad":null,"c":{"HEAL_BASE":2,"HEAL_AP_RATIO":0.2,"AP_BASE":20,"AP_PER_AP":0.5,"BUFF_DURATION_MS":6000,"COOLDOWN_MS":4000,"AWAKEN_SPELL_FACTOR":0.5,"MIN_COOLDOWN_MS":1000}},
  30: {"n":"Fire Elemental","ad":null,"c":{"BASE_DMG":20,"DMG_AP_RATIO":1.3,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":1500}},
  31: {"n":"Frost Troll","ad":4000,"c":{"SNOWBALL_DAMAGE_BASE":15,"SNOWBALL_DAMAGE_AP_RATIO":0.7,"SNOWMAN_DURABILITY":3,"AWAKEN_ATTACK_DELAY_DEBUFF_PERCENT":0.1,"AWAKEN_ATTACK_SPEED_DEBUFF_MS":3000,"COOLDOWN_MS":7000,"MIN_COOLDOWN_MS":1500}},
  32: {"n":"Winter Wolf","ad":null,"c":{"DAMAGE_BASE":15,"DAMAGE_AP_RATIO":0.5,"ATTACK_DELAY_DEBUFF_PERCENT":0.15,"ATTACK_SPEED_DEBUFF_MS":3000,"CDR_MS":2000,"PROC_EVERY_BITES":3,"COOLDOWN_MS":10000,"STUN_MS":1000,"CDR_TICKS":2000,"MIN_COOLDOWN_MS":3000}},
  33: {"n":"Water Elemental","ad":3000,"c":{"MAX_BOUNCES":5,"DMG_BASE":5,"DMG_RATIO":0.6,"FLAT_MR_BUFF":15,"BUFF_DURATION_MS":4000,"HEAL_BASE":8,"HEAL_RATIO":0.4,"COOLDOWN_MS":7000,"AWAKEN_BONUS_BOUNCES":1,"MIN_COOLDOWN_MS":2500}},
  34: {"n":"Minotaur Archer","ad":4000,"c":{"BONUS_ATTACK_DELAY_CAP":0.9,"AWAKEN_HP_THRESHOLD":0.25,"AWAKEN_LIFESTEAL":0.25}},
  35: {"n":"Minotaur Guard","ad":3000,"c":{"TAUNT_BASE_DURATION_MS":5000,"HEAL_BASE_PER_UNIT":5,"HEAL_PER_AP_PER_UNIT":0.6,"REFLECT_BASE_DMG":6,"REFLECT_DMG_PER_AP":0.3,"AWAKEN_ATTACK_SPEED_PERCENT":0.4,"AWAKEN_AD_DEBUFF_FLAT":-15,"AWAKEN_DEBUFF_DURATION_MS":2000,"COOLDOWN_MS":7000,"MIN_COOLDOWN_MS":2000}},
  36: {"n":"Wyvern","ad":null,"c":{"DMG_BASE":5,"DMG_AP_RATIO":0.2,"HEAL_BASE":10,"HEAL_AP_RATIO":0.2,"AWAKEN_FLEE_STUN_MS":1000,"COOLDOWN_BASE_MS":3000,"PUSH_TARGET_SPEED":255,"FLEE_HP_PERCENT":0.3,"MIN_COOLDOWN_MS":2000}},
  37: {"n":"Deer","ad":null,"c":{"ATTACK_DELAY_PERCENT_BUFF_BASE":-0.25,"MAX_BUFF":-0.8,"BUFF_DURATION":3500,"AWAKEN_RANGE":3,"RANGE":2,"ATTACK_DELAY_PERCENT_BUFF_PER_AP":-0.0025}},
  38: {"n":"Polar Bear","ad":null,"c":{"SLOW_PERCENT":-0.4,"DAMAGE_BASE":17,"DAMAGE_AP_RATIO":3,"CHARGE_MS":4500,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":1000}},
  39: {"n":"Elf","ad":null,"c":{}},
  40: {"n":"Elf Scout","ad":null,"c":{"SLOW_BASE_PERCENT":0.05,"AD_PER_DISTANCE":6,"SLOW_PERCENT_PER_AP":0.003,"SLOW_DURATION_MS":2500}},
  41: {"n":"Elf Arcanist","ad":3000,"c":{"BUFF_FLAT_AD":20,"BUFF_FLAT_AP":30,"BUFF_DURATION_MS":10000,"AWAKEN_ELVEN_ATTACK_DELAY_BUFF":-0.3,"AUTO_ATTACK_DAMAGE_PER_AP":0.5}},
  42: {"n":"Orc Berserker","ad":3000,"c":{"MIN_HP_PERCENT_TRIGGER":0.1,"BONUS_ATTACK_DELAY":-0.8,"LIFESTEAL":3,"BONUS_MOVE_SPEED":40,"COOLDOWN_MS":9000}},
  43: {"n":"Orc Leader","ad":null,"c":{"DEBUFF_ARMOR_BASE":2,"DEBUFF_ARMOR_PER_AP":0.1,"MOVE_SPEED_BUFF":40,"HEAL_PERCENT":0.25,"TAUNT_DURATION_MS":6000,"AWAKEN_MISSING_HP_HEAL_PERCENT":0.25,"COOLDOWN_MS":8500,"MIN_COOLDOWN_MS":2500}},
  44: {"n":"Orc Shaman","ad":null,"c":{"AUTO_ATTACK_DMG_BASE":2,"AUTO_ATTACK_DMG_PER_AP":0.8,"CHANNEL_MS":3500,"ZOMBIE_HP_PERCENT_DMG_TICK_BASE":0.12,"ZOMBIE_HP_PERCENT_DMG_TICK_PER_AP":-0.0005,"ZOMBIE_TICKER_FREQUENCY_MS":1000}},
  45: {"n":"Orc Rider","ad":null,"c":{"BASE_WOLF_COUNT":2,"WOLF_BASE_HP":70,"WOLF_HP_PER_AP":3,"AWAKEN_EXTRA_WOLF_COUNT":1}},
  46: {"n":"Orc Warlord","ad":null,"c":{"MAX_STACKS":30,"BUFF_DURATION_MS":6000,"LIFESTEAL_BASE":0.1,"MAGIC_DAMAGE_AUTO_BASE":5,"MAGIC_DAMAGE_AUTO_AP_RATIO":0.1,"AWAKEN_INITIAL_STACKS":25,"LIFESTEAL_PER_AP":0.0025}},
  47: {"n":"Goblin Scavenger","ad":1000,"c":{"ARMOR_BASE":30,"ARMOR_PER_AP":1,"MAX_HIT_DURABILITY":10,"COOLDOWN_MS":5000,"PROC_EVERY_ATTACKS":3,"MIN_COOLDOWN_MS":1500,"FLAT_BONUS_AD_PER_LEVEL":3,"AWAKEN_ATTACK_SPEED_PER_LEVEL":0.01,"STEROID_SPEED_FLAT_BONUS":60,"STEROID_DURATION_MS":3000,"TARGET_MIN_CURRENT_HP_PERCENT_EXECUTE":0.2}},
  48: {"n":"Goblin Assassin","ad":1000,"c":{"STEROID_SPEED_FLAT_BONUS":60,"STEROID_DURATION_MS":3000,"TARGET_MIN_CURRENT_HP_PERCENT_EXECUTE":0.2,"COOLDOWN_MS":5000,"AWAKEN_DODGE_DURATION_MS":3000}},
  49: {"n":"Firestarter","ad":null,"c":{"FIRE_BASE_DMG":3,"FIRE_DMG_PER_AP":0.4,"FIRE_DURATION_MS":6000,"AWAKEN_EFFECT_DURATION_MS":5000,"AWAKEN_SPEED_BONUS":50}},
  50: {"n":"Cyclops","ad":5000,"c":{"DMG_BASE":16,"DMG_AP_RATIO":0.4}},
  51: {"n":"Warlock","ad":null,"c":{"HEAL_BASE":10,"HEAL_PER_AP":0.5,"MISSILE_DAMAGE_PER_AP":1.25,"AOE_DAMAGE_BASE":5,"AOE_DAMAGE_PER_AP":0.3,"AWAKEN_AP_PERCENT":0.3,"COOLDOWN_MS":6000,"ATTACK_SPELL_CD_MS":3500,"MIN_COOLDOWN_MS":2500,"MIN_ATTACK_CD_MS":1500}},
  52: {"n":"Knight","ad":4000,"c":{"EXORI_BASE_DAMAGE":2,"EXORI_DMG_PER_AP":0.4,"BASE_HEAL":20,"MAX_HP_PERCENT_HEAL":0.08}},
  53: {"n":"Dwarf","ad":null,"c":{"BARREL_CHARGE_MS":3000,"BASE_DAMAGE":25,"DMG_AP_RATIO":1.5,"FLEE_SPEED_BOOST":30,"CAST_RANGE":2}},
  54: {"n":"Dwarf Soldier","ad":null,"c":{}},
  55: {"n":"Dwarf Guard","ad":3000,"c":{"MELEE_DAMAGE_MODIFIER":0.5,"HEAL_HP_PERCENT":0.08,"STUN_MS_PER_DISTANCE":1000,"HEAL_TICK_FREQUENCY_MS":2000,"AWAKEN_RANGE_LIMIT":1}},
  56: {"n":"Dwarf Geomancer","ad":null,"c":{"STONE_BASE_DMG":10,"STONE_DMG_PER_AD":0.5,"BASE_HEAL":15,"HEAL_PER_AP":1,"STONE_RECHARGE_MS":8000,"STONE_CLEANUP_DELAY_MS":2000,"STONE_TOSS_MS":1000}},
  57: {"n":"Energy Crystal","ad":null,"c":{"COOLDOWN_MS":3000,"MAX_DWARFS":5,"MIN_COOLDOWN_MS":1500}},
  58: {"n":"Magma Crystal","ad":null,"c":{"COOLDOWN_MS":10000,"DAMAGE_HP_PERCENT":0.5,"MIN_COOLDOWN_MS":3000}},
  59: {"n":"Earth Crystal","ad":null,"c":{"COOLDOWN_MS":3000,"HEAL_BASE":100,"MIN_COOLDOWN_MS":1000}},
  60: {"n":"Rorc","ad":4000,"c":{"FLEE_SPEED_BONUS":100,"STUN_MS":1500,"LIFESTEAL_BASE":0.6,"AWAKEN_AOE_DMG_PERCENT":0.1,"LIFESTEAL_PER_AP":0.0025}},
  61: {"n":"Nightstalker","ad":null,"c":{"EXECUTE_PERCENT_BASE":0.1,"SPELLVAMP":0.6,"COOLDOWN_MS":7000,"INITIAL_COOLDOWN_MS":2000,"AWAKEN_POST_BLINK_INVULNERABILITY_MS":750,"EXECUTE_PERCENT_PER_AP":0.0025,"MIN_COOLDOWN_MS":2500}},
  62: {"n":"Bog Raider","ad":null,"c":{"HP_FLAT_COST":25,"DAMAGE_BASE":20,"DAMAGE_AP_RATIO":1,"HP_PERCENT_HEAL":0.25,"AWAKEN_ARMOR_PER_MISSING_HP_PERCENT":1,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":2000}},
  63: {"n":"Orc","ad":null,"c":{"EQUIP_AD":40}},
  64: {"n":"Sweaty Cyclops","ad":4000,"c":{"HEAL_HP_PERCENT_BASE":0.02,"HEAL_TICKER_FREQUENCY_MS":1000,"COOLDOWN_MS":1000,"MAX_COUNTER":3,"HEAL_HP_PERCENT_PER_AP":0.008}},
  65: {"n":"Dragon","ad":null,"c":{"DMG_BASE":15,"DMG_PER_AP":1,"STAT_REDUCTION_BASE_PERCENT":-0.15,"DEBUFF_DURATION_MS":5000,"COOLDOWN_MS":8000,"MIN_COOLDOWN_MS":1500,"DEBUFF_RANGE":2,"STAT_REDUCTION_AP_RATIO_PERCENT":-0.003}},
  66: {"n":"Witch","ad":null,"c":{"DAMAGE_BASE":15,"DAMAGE_PER_AP":1.2,"DEBUFF_DURATION_MS":4000,"ATTACK_DELAY_PERCENT_BASE":0.4,"COOLDOWN_MS":8000,"ATTACK_DELAY_PERCENT_PER_AP":0.005,"DEBUFF_RANGE_LIMIT":1,"MIN_COOLDOWN_MS":5500}},
  67: {"n":"Old Giant Spider","ad":4000,"c":{"COCOON_BASE_DAMAGE":10,"COCOON_DAMAGE_PER_AP":2,"COCOON_STUN_MS":3000,"COCOON_ARMOR_BUFF":100,"COCOON_ARMOR_MS":5000,"ATTACK_DELAY_BUFF_PERCENT":-0.3,"COCOON_COOLDOWN_MS":8000,"MIN_COCOON_COOLDOWN_MS":2000,"ALLY_MAGIC_DAMAGE_TO_HEAL_PERCENT":1}},
  68: {"n":"Amazon","ad":3000,"c":{"MAX_HP_PERCENT_BASE":0.01,"AWAKEN_HEAL_REDUCTION_PERCENT":0.25,"COOLDOWN_MS":3500,"AWAKEN_EFFECT_DURATION_MS":5000,"AWAKEN_BLEED_TICK_FREQUENCY_MS":1000,"AWAKEN_BLEED_DMG_PER_TICK":6,"MAX_KNIVES":2,"LIFESTEAL_BASE":0.8,"MAX_HP_PERCENT_PER_AP":0.001,"MIN_COOLDOWN_MS":500}},
  69: {"n":"Valkyrie","ad":3500,"c":{"BASE_LIFESTEAL":0.1,"AWAKEN_MALE_DAMAGE_BONUS":0.05,"COOLDOWN_MS":3000,"LIFESTEAL_PER_AP":0.0025,"MIN_COOLDOWN_MS":1500}},
  70: {"n":"Lavahole","ad":null,"c":{"HP_PERCENT":0.35,"CHARGE_MS":1500,"COOLDOWN_MS":2000}},
  71: {"n":"Corym Charlatan","ad":null,"c":{"SNATCH_BASE_DMG":20,"SNATCH_DMG_PER_AP":2,"HEAL_BASE":20,"HEAL_PER_AP":1,"COOLDOWN_MS":9000,"MIN_COOLDOWN_MS":1000}},
  72: {"n":"Corym Skirmisher","ad":null,"c":{"INVI_ON_HIT_ARMOR_REDUCTION":-3,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":3000,"INVI_DURATION_MS":5000,"ARMOR_REDUCTION_DURATION_MS":3000,"MIN_COOLDOWN_MS":1000}},
  73: {"n":"Corym Vanguard","ad":4000,"c":{"BURST_AD_FLAT":1,"BURST_AD_RATIO":0.5,"IGNORED_MAX_DAMAGE":22,"IGNORE_DMG_HEAL_BASE":5,"BURST_STACKS":20,"AWAKEN_IGNORED_MIN_DAMAGE":140,"IGNORE_DMG_HEAL_PER_AP":0.1}},
  74: {"n":"Black Knight","ad":500,"c":{"SPEAR_DMG_MULTIPLIER":5,"HP_MOUNT_THRESHOLD":0.25,"MOVEMENT_SPEED_BUFF":180}},
  75: {"n":"Dead Tree","ad":null,"c":{}},
  76: {"n":"Giant Spider","ad":4000,"c":{"BASE_LIFESTEAL":0.5,"AWAKEN_EGG_HATCH_COOLDOWN_MS":12000,"COOLDOWN_MS":18000,"VMAMA_AWAKEN_EGG_HATCH_COOLDOWN_MS":6000,"MIN_COOLDOWN_MS":6000}},
  77: {"n":"Swamp Troll","ad":3000,"c":{"SPAWN_COUNT":2,"SLUG_LIFESTEAL":1,"AWAKEN_EXTRA_SPAWN_COUNT":1,"COOLDOWN_MS":14000,"MIN_COOLDOWN_MS":5000}},
  78: {"n":"Willi Wasp","ad":null,"c":{}},
  79: {"n":"Dharalion","ad":3000,"c":{"BUFF_FLAT_AP":30,"BUFF_FLAT_AD":20,"HEAL_PER_AP":4,"CHANNEL_DURATION_MS":3500,"TICK_FREQUENCY_MS":1500,"AUTO_ATTACK_DAMAGE_PER_AP":5}},
  80: {"n":"Yeti","ad":5000,"c":{"SLOW_PERCENT":0.25,"SNOW_DMG_BASE":2,"SNOW_DMG_PER_AP":0.1,"SNOW_HEAL_BASE":5,"SNOW_HEAL_PER_AP":0.05,"DURATION_MS":6000,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":5000,"SLOW_DURATION_MS":2000,"RANGE":2,"MIN_COOLDOWN_MS":2000}},
  81: {"n":"Regeneration Tank","ad":null,"c":{"COOLDOWN_MS":3000,"MIN_COOLDOWN_MS":1500,"HP_FLAT_COST":25,"DAMAGE_BASE":20,"DAMAGE_AP_RATIO":1,"HP_PERCENT_HEAL":0.25}},
  82: {"n":"Gummy Raider","ad":null,"c":{"HP_FLAT_COST":25,"DAMAGE_BASE":20,"DAMAGE_AP_RATIO":1,"HP_PERCENT_HEAL":0.25,"AWAKEN_ARMOR_PER_MISSING_HP_PERCENT":1,"COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":2000}},
  83: {"n":"Monster Cauldron","ad":null,"c":{}},
  84: {"n":"Grynch Clan Commander","ad":null,"c":{"COOLDOWN_MS":12000,"MIN_COOLDOWN_MS":4000}},
  85: {"n":"Goblin Gumslinger","ad":null,"c":{"FLAT_BONUS_AD_PER_LEVEL":3,"AWAKEN_ATTACK_SPEED_PER_LEVEL":0.01,"INITIAL_DISTANCE_LEVEL":1}},
  86: {"n":"Goblin Saboteur","ad":1000,"c":{"STEROID_SPEED_FLAT_BONUS":60,"STEROID_DURATION_MS":3000,"TARGET_MIN_CURRENT_HP_PERCENT_EXECUTE":0.2,"COOLDOWN_MS":5000,"AWAKEN_DODGE_DURATION_MS":3000}},
  87: {"n":"Unionized Goblin","ad":1000,"c":{"ARMOR_BASE":30,"ARMOR_PER_AP":1,"MAX_HIT_DURABILITY":10,"COOLDOWN_MS":5000,"PROC_EVERY_ATTACKS":3,"MIN_COOLDOWN_MS":1500,"FLAT_BONUS_AD_PER_LEVEL":3,"AWAKEN_ATTACK_SPEED_PER_LEVEL":0.01,"STEROID_SPEED_FLAT_BONUS":60,"STEROID_DURATION_MS":3000,"TARGET_MIN_CURRENT_HP_PERCENT_EXECUTE":0.2}},
  88: {"n":"Reindeer","ad":null,"c":{"ATTACK_DELAY_PERCENT_BUFF_BASE":-0.25,"MAX_BUFF":-0.8,"BUFF_DURATION":3500,"AWAKEN_RANGE":3,"RANGE":2,"ATTACK_DELAY_PERCENT_BUFF_PER_AP":-0.0025}},
  89: {"n":"Dwarf Merrymancer","ad":null,"c":{"STONE_BASE_DMG":10,"STONE_DMG_PER_AD":0.5,"BASE_HEAL":15,"HEAL_PER_AP":1,"STONE_RECHARGE_MS":8000,"STONE_CLEANUP_DELAY_MS":2000,"STONE_TOSS_MS":1000}},
  90: {"n":"The Percht Queen","ad":null,"c":{"SPAWN_LEVEL_PER_FLOOR":1,"CD_MULTIPLIER_PER_SPAWN":0.2,"MAX_CD_MS":6000,"CDR_MS_PER_FLOOR":250,"MIN_CD_MS":2000}},
  91: {"n":"Grynch Clan Mastermind","ad":null,"c":{"DEBUFF_RANGE_LIMIT":1,"BASE_COOLDOWN_MS":2000,"CDR_PER_FLOOR_MS":50,"MIN_COOLDOWN_MS":700,"GOBLIN_HP_DAMAGE_PERCENT":0.9}},
  92: {"n":"Beer Barrel","ad":null,"c":{"OBSTACLE_TRUE_DAMAGE":40,"EXPLOSION_TRUE_DMG":300}},
  98: {"n":"Green Djinn","ad":3000,"c":{"JAR_BASE_DURATION_MS":1000,"COOLDOWN_MS":8000,"JAR_DURATION_MS_PER_AP":40,"AUTO_ATTACK_DAMAGE_PER_AP":0.5,"MIN_COOLDOWN_MS":2500}},
  99: {"n":"Ancient Scarab","ad":3000,"c":{"REVIVE_BASE_HP":25,"REVEIVE_HP_PER_AP":2}},
  100: {"n":"Obelisk","ad":null,"c":{"BASE_AP":50,"AP_PER_FLOOR":5}},
  101: {"n":"Thalas","ad":null,"c":{"BASE_DAMAGE":10,"DAMAGE_PER_AP":0.7,"AWAKEN_COOLDOWN_MS":3000,"COOLDOWN_MS":9000,"INITIAL_COOLDOWN_MS":4000,"BRIEF_STUN_MS":500,"MIN_COOLDOWN_MS":4000}},
  102: {"n":"Cobra Statue","ad":null,"c":{"HEAL_PER_AP":2,"COOLDOWN_MS":8000,"MIN_COOLDOWN_MS":500}},
  103: {"n":"Nomad","ad":3000,"c":{"TAUNT_DURATION_MS":5000,"FLAT_TAUNT_AP_BUFF":40,"FLAT_TAUNT_AD_BUFF":15,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":4000,"MIN_COOLDOWN_MS":3000}},
  104: {"n":"Blue Djinn","ad":null,"c":{"DMG_BASE":15,"DMG_PER_AP":0.7,"SILENCE_DURATION_MS":3500,"COOLDOWN_MS":7000,"MIN_COOLDOWN_MS":2000}},
  105: {"n":"Bonelord","ad":null,"c":{"BASE_HEAL_PER_UNIT":10,"HEAL_PER_AP_PER_UNIT":0.2,"COOLDOWN_MS":11000,"INITIAL_COOLDOWN_MS":6000,"MIN_COOLDOWN_MS":6000}},
  106: {"n":"Omruc","ad":1000,"c":{"COOLDOWN_MS":10000,"INVI_DURATION_MS":7500,"MIN_COOLDOWN_MS":9000}},
  107: {"n":"Morguthis","ad":null,"c":{}},
  108: {"n":"Rahemos","ad":null,"c":{"COOLDOWN_MS":3000,"CENTER_TILE_IDX":82}},
  110: {"n":"Werefox","ad":3000,"c":{"HEAL_BASE":1,"HEAL_PER_AP":0.05,"COOLDOWN_MS":9000,"EFFECT_DURATION_MS":3500,"ATTACK_DELAY_PERCENT":-0.6,"SPEED_BUFF":160,"SPLASH_DAMAGE_FACTOR":0.5,"MIN_COOLDOWN_MS":2500}},
  111: {"n":"Hunter","ad":null,"c":{"TRAP_DAMAGE_BASE":10,"TRAP_DAMAGE_PER_AP":1,"TRAP_DURATION_MS":3500,"TRAP_BONUS_SPEED":40,"TRAP_BONUS_RANGE":4,"AWAKEN_HP_PERCENT":0.08,"TRAP_SETUP_MS":200,"COOLDOWN_MS":9000,"MIN_COOLDOWN_MS":2500}},
  112: {"n":"Cyclops Drone","ad":5000,"c":{"DMG_BASE":10,"DMG_AP_RATIO":0.6,"AWAKEN_MIN_ENEMIES_HIT":3,"BRIEF_STUN_MS":500,"BOUNCE_MS":1000,"COOLDOWN_MS":7000,"AWAKEN_COOLDOWN_REDUCTION_PERCENT":0.5,"PUSH_TARGET_SPEED":1360,"SHAKE_MS":125,"MIN_COOLDOWN_MS":3000}},
  113: {"n":"Behemoth","ad":4000,"c":{"SPIKE_BASE_DMG":10,"SPIKE_DAMAGE_PER_AD":0.5,"ARENA_FADE_OUT_MS":300,"COOLDOWN_MS":11000,"INITIAL_COOLDOWN_MS":4500,"ARENA_DURATION_MS":5000,"MIN_COOLDOWN_MS":7000,"AWAKEN_DAMAGE_REDUCTION":0.5}},
  114: {"n":"Cyclops Smith","ad":4000,"c":{"MAX_BOUNCES":4,"DMG_BASE":5,"DMG_AD_RATIO":1,"HEAL_PER_AP":0.2,"HEAL_BASE":10,"COOLDOWN_MS":5000,"MIN_COOLDOWN_MS":2000,"DMG_PER_AP":0.6,"AWAKEN_DMG_INCREMENT":0.2}},
  115: {"n":"Cake Drake","ad":null,"c":{"DMG_BASE":10,"DMG_PER_AP":0.5,"STAT_REDUCTION_BASE_PERCENT":-0.35,"DEBUFF_DURATION_MS":1500,"COOLDOWN_MS":1450,"MIN_COOLDOWN_MS":1000,"DMG_MULTIPLIER_A":1,"DMG_MULTIPLIER_B":1,"DEBUFF_RANGE":99,"STAT_REDUCTION_AP_RATIO_PERCENT":-0.003}},
  116: {"n":"Hero","ad":null,"c":{"IGNORED_ARMOR_PER_STACK":10,"LIFESTEAL_PER_STACK":0.15,"LAST_ALIVE_LIFESTEAL_PERCENT":0.3,"LIFESTEAL_BASE":0.1,"LIFESTEAL_MAX":1}},
  117: {"n":"Astronis","ad":null,"c":{"ATTACK_DELAY_MS":3000,"COOLDOWN_MS":1500,"FLAT_ATTACK_BONUS":20,"ICE_RAPIER_MULTIPLIER":2}},
  118: {"n":"Setzer Gambler","ad":null,"c":{"DMG_BASE":20,"DMG_PER_AP":2,"COOLDOWN_MS":4000,"RANGE":7,"MIN_COOLDOWN_MS":2000}},
  119: {"n":"Ti","ad":null,"c":{}},
  120: {"n":"Mateusz Dragon Wielki","ad":null,"c":{"HEAL_BASE":10,"HEAL_PER_AP":3,"COOLDOWN_MS":6500,"MIN_COOLDOWN_MS":2500}},
  121: {"n":"The Pale Count","ad":null,"c":{"BAT_PARENT_AD_PERCENT":0.1,"BAT_LIFESTEAL_PERCENT":0.1,"BAT_LIFESTEAL_PER_AP":0.01,"COOLDOWN_MS":8000,"INITIAL_COOLDOWN_MS":6000,"DURATION_MS":7000,"TILES_SPAWNED_PERCENT":0.4,"MIN_COOLDOWN_MS":6000}},
  122: {"n":"Vampire Bride","ad":null,"c":{"HEART_BASE_DMG":0,"HEART_DMG_PER_AD":1,"SPELLVAMP_BASE_PERCENT":2.5,"COOLDOWN_MS":3000,"CHARGE_MS":800,"SPELLVAMP_PER_AP":0.0015,"MIN_COOLDOWN_MS":1000}},
  123: {"n":"Paladin","ad":null,"c":{"PASS_THROUGH_BASE":5,"PASS_THROUGH_AP_RATIO":0.15,"ARMOR_PER_ENEMY":6}},
  124: {"n":"Dark Apprentice","ad":null,"c":{}},
  125: {"n":"Dark Magician","ad":null,"c":{"AWAKEN_DMG_INCREMENT":0.2,"DMG_BASE":5,"DMG_PER_AP":0.6,"COOLDOWN_MS":3000,"MIN_COOLDOWN_MS":1500}},
  126: {"n":"Vladrukh","ad":null,"c":{"DAMAGE_CAP":5,"COOLDOWN_MS":9000,"INITIAL_COOLDOWN_MS":4000,"BRIEF_STUN_MS":500,"MIN_COOLDOWN_MS":5000}},
  127: {"n":"Clot","ad":4000,"c":{"STARTING_HP":5,"MAX_SPAWN_COUNT":2,"CDR_PER_AP":80,"AWAKEN_EXTRA_SPAWN":1,"BASE_COOLDOWN_MS":12000,"MIN_COOLDOWN_MS":2000}},
  128: {"n":"Orshabaal","ad":3000,"c":{"COOLDOWN_MS":4500,"BASE_DMG":20,"DMG_AP_RATIO":1.2,"MIN_COOLDOWN_MS":1000}},
  129: {"n":"Rostein","ad":null,"c":{}},
  130: {"n":"Shooter","ad":null,"c":{"SD_BASE_DMG":40,"SD_DMG_AP_RATIO":0.6,"AUTO_ATTACK_RANGE":9}},
  131: {"n":"Healer","ad":null,"c":{"HEAL_BASE":90,"HEAL_AP_RATIO":0.8}},
  132: {"n":"Demon","ad":null,"c":{"BASE_DMG":15,"DMG_AP_RATIO":0.5,"FIREBALL_BASE_DMG":5,"FIREBALL_DMG_AP_RATIO":0.3,"FIREBALL_COOLDOWN_MS":5000,"COOLDOWN_MS":4000,"CONVERT_BRAIN_DURATION_MS":2000,"RANGE":8,"FIREBALL_RANGE":4,"MIN_COOLDOWN_MS":1500,"CONVERT_BRAIN_FADE_OUT_MS":300}}
};
// END CREATURE_COMBAT_DATA
const DEFAULT_ATTACK_DELAY_MS = 2000;

function getCreatureCombatData(gameId) {
  const row = CREATURE_COMBAT_DATA[Number(gameId)];
  if (!row) return null;
  return { name: row.n, attackDelayMs: row.ad ?? DEFAULT_ATTACK_DELAY_MS, constants: row.c };
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
    nonShinyOnly: gameId === MYSTIC_GAZER_GAME_ID
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
  if (resolved.gameId === MYSTIC_GAZER_GAME_ID) return false;
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
 * containers untouched.
 */
function buildOldOutfitsCss(scopePrefix, excludeSelector = '') {
  const exclude = excludeSelector ? `:not(${excludeSelector} *)` : '';
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
    .map((r) => `${scopePrefix} ${r.selectorText.replace(/^&\s*/, '')}${exclude} { ${r.style.cssText} }`);
  // The game's own old-outfit rule gives these a smaller --size than their sheet's frame
  // size (Demon: 64px frames declared as 32px), which crops the sprite.
  for (const [outfitId, size] of Object.entries(OLD_OUTFIT_SIZE_FIXES)) {
    rules.push(`${scopePrefix} .outfit.id-${outfitId}${exclude} { --size: ${size}px; }`);
  }
  return rules.join('\n');
}

const OLD_OUTFIT_SIZE_FIXES = { 35: 64 };

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

/** Seasonal / event creatures — cannot awaken (see NON_AWAKENABLE). */
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
 * True when a creature has an awakened ability to show: not a gazer, not an event creature, not
 * in NON_AWAKENABLE, and its tooltip has awakened text. Boss aliases follow their base species.
 */
function isCreatureAwakenableName(creatureName) {
  if (!creatureName) return false;
  if (isGazerCreatureName(creatureName)) return false;
  if (!getBossAliasByDisplayName(creatureName) && isEventCreatureName(creatureName)) return false;
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
  if (Number(monster.gameId) === MYSTIC_GAZER_GAME_ID) {
    return monster.shiny === true ? 'Albino Gazer' : 'Mystic Gazer';
  }
  const data = findMonsterByGameId(monster.gameId);
  return data?.metadata?.name ?? null;
}

/** Whether an inventory monster belongs to a Cyclopedia/display creature name. */
function monsterMatchesCreatureDisplay(displayName, monster) {
  return queryMatchesMonster(resolveCreatureDisplay(displayName), monster);
}

// Creature database with shiny portrait support
function getAllMonsters() {
  const monsters = [];
  // getMonster() can throw on an id gap; skip it instead of dropping every higher id.
  let consecutiveFailures = 0;
  for (let i = 1; i < 1000 && consecutiveFailures < 50; i++) {
    try {
      const state = globalThis.state || window.state || (typeof state !== 'undefined' ? state : null);
      if (!state?.utils?.getMonster) {
        console.warn('[creature-database.js] state.utils.getMonster not available yet');
        break;
      }
      const monster = state.utils.getMonster(i);
      consecutiveFailures = monster?.metadata?.name ? 0 : consecutiveFailures + 1;
      if (monster?.metadata?.name) {
        monsters.push({ 
          gameId: i, 
          ...monster,
          portraits: {
            normal: `/assets/portraits/${i}.png`,
            shiny: `/assets/portraits/${i}-shiny.png`
          }
        });
      }
    } catch (e) { consecutiveFailures += 1; }
  }
  return monsters;
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
    const hardcodedNonAwakenable = [...EVENT_CREATURES];
    
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

function findMonsterByGameId(gameId) {
  const id = Number(gameId);
  const map = getMonsterNameMap();
  for (const entry of map.values()) {
    const entryId = entry.gameId ?? entry.index;
    if (entryId === id && entry.monster) {
      return { gameId: entryId, ...entry.monster };
    }
  }
  return findMonsterByGameIdUncached(gameId);
}

function findMonsterByGameIdUncached(gameId) {
  const allMonsters = getAllMonsters();
  return allMonsters.find((monster) => monster.gameId === gameId);
}

let monsterNameMapCache = null;

/** Cached lowercase name → { monster, gameId, index } for O(1) lookups. */
function getMonsterNameMap() {
  if (monsterNameMapCache) return monsterNameMapCache;

  monsterNameMapCache = new Map();
  const state = globalThis.state || window.state;
  if (!state?.utils?.getMonster) return monsterNameMapCache;

  const maxSearchId = 1000;
  const maxConsecutiveFailures = 10;
  let maxId = 200;
  let consecutiveFailures = 0;

  try {
    for (let i = 1; i < maxSearchId; i++) {
      try {
        const monster = state.utils.getMonster(i);
        if (!monster?.metadata?.name) {
          if (++consecutiveFailures >= maxConsecutiveFailures) {
            maxId = Math.max(1, i - maxConsecutiveFailures);
            break;
          }
        } else {
          consecutiveFailures = 0;
          maxId = i;
        }
      } catch (error) {
        if (++consecutiveFailures >= maxConsecutiveFailures) {
          maxId = Math.max(1, i - maxConsecutiveFailures);
          break;
        }
      }
    }
  } catch (error) {
    console.warn('[creature-database.js] Error probing monster ids:', error);
  }

  for (let i = 1; i <= maxId; i++) {
    try {
      const monster = state.utils.getMonster(i);
      if (monster?.metadata?.name) {
        monsterNameMapCache.set(monster.metadata.name.toLowerCase(), { monster, gameId: i, index: i });
      }
    } catch (error) { /* skip */ }
  }

  return monsterNameMapCache;
}

function findMonsterByName(name) {
  const alias = getShinyAliasByDisplayName(name) ?? getBossAliasByDisplayName(name);
  if (alias) {
    return findMonsterByGameId(alias.gameId);
  }
  const entry = getMonsterNameMap().get(String(name).toLowerCase());
  if (entry?.monster) {
    return { gameId: entry.gameId ?? entry.index, ...entry.monster };
  }
  const allMonsters = getAllMonsters();
  return allMonsters.find((monster) =>
    monster.metadata?.name?.toLowerCase() === String(name).toLowerCase()
  );
}

function waitForGameState(callback, retries = 0, maxRetries = 20) {
  try {
    const state = globalThis.state || window.state;
    const hasPlayerState = state?.player?.getSnapshot;
    const hasBoardState = state?.board?.getSnapshot;
    const hasUtils = state?.utils?.getMonster;
    
    if (hasPlayerState && hasBoardState && hasUtils) {
      callback();
    } else if (retries < maxRetries) {
      setTimeout(() => waitForGameState(callback, retries + 1, maxRetries), 250);
    } else {
      console.warn('[creature-database.js] Game state not ready after max retries, building database anyway');
      callback();
    }
  } catch (error) {
    console.error('[creature-database.js] Error checking game state:', error);
    if (retries < maxRetries) {
      setTimeout(() => waitForGameState(callback, retries + 1, maxRetries), 250);
    } else {
      console.warn('[creature-database.js] Building database despite errors');
      callback();
    }
  }
}

// Initialize database with lazy loading
let creatureDatabase = null;
let databaseInitialized = false;

function initializeDatabase() {
  if (databaseInitialized) return creatureDatabase;
  
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
  creatureDatabase.getMapMonsterBaseStats = getMapMonsterBaseStats;
  creatureDatabase.getCreatureCombatData = getCreatureCombatData;
  creatureDatabase.MONSTER_STAT_DISPLAY_CONFIG = MONSTER_STAT_DISPLAY_CONFIG;
  creatureDatabase.getMonsterNameMap = getMonsterNameMap;
  
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
  MONSTER_STAT_DISPLAY_CONFIG,
  MYSTIC_GAZER_GAME_ID,
  SHINY_ALIAS_CREATURES,
  BOSS_ALIAS_CREATURES,
  getCyclopediaCreatureNames: () => getCyclopediaCreatureNames([]),
  getMonsterNameMap,
  resolveCreatureDisplay,
  creatureHasShinyVariant,
  buildOldOutfitsCss,
  filterMonstersForCreatureDisplay,
  getCreaturePickerNames: () => getCyclopediaCreatureNames([]),
  getAutoscrollAutosellerCreaturePickerNames: () => [],
  EVENT_CREATURES,
  isEventCreatureName,
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
    globalWindow.creatureDatabase.getMapMonsterBaseStats = getMapMonsterBaseStats;
    globalWindow.creatureDatabase.getCreatureCombatData = getCreatureCombatData;
    globalWindow.creatureDatabase.MONSTER_STAT_DISPLAY_CONFIG = MONSTER_STAT_DISPLAY_CONFIG;
    globalWindow.creatureDatabase.getMonsterNameMap = getMonsterNameMap;
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

