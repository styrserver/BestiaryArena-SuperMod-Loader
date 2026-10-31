# Bestiary Arena Mod Loader - Game State API Documentation

This document provides a comprehensive reference for accessing and modifying the game state in Bestiary Arena through the Mod Loader. The Game State API is exposed through `globalThis.state` and follows the XState state machine pattern.

> **Credits**: The Game State API implementation and documentation were developed with significant contributions from [Mathias Bynens](https://github.com/mathiasbynens) and [Alexandre Seleghim](https://github.com/xandjiji), the creator of Bestiary Arena.

## Overview

Bestiary Arena exposes its client state to the DOM via `globalThis.state`, allowing advanced customization, automation, and tooling. Each component of the state is managed by a state machine for predictable and event-driven architecture.

## State Structure

The main access point is `globalThis.state`, which contains these major components:

```javascript
globalThis.state = {
  board: {
    /* Board state and controls */
  },
  clientConfig: {
    /* Client-side behavior config (filters, autoplay delay, etc.) */
  },
  daily: {
    /* Daily challenge state */
  },
  gameTimer: {
    /* Game timing controls */
  },
  menu: {
    /* Menu state */
  },
  player: {
    /* Player data and inventory */
  },
  raids: {
    /* Live raid events */
  },
  utils: {
    /* Utility functions and constants */
  },
};
```

Each component (except `utils`) follows a similar structure with these methods/properties:

- `getSnapshot()` - Returns the current state
- `getInitialSnapshot()` - Returns the initial state
- `get()` - Shorthand equivalent of `getSnapshot()` (e.g. `globalThis.state.player.get().context`)
- `select(selectorFn, compareFn?)` - Returns a derived, subscribable observable for one slice of the context (see [Tracking Menu State Changes](#tracking-menu-state-changes) below; not menu-specific, available on every component)
- `on(eventName, callback)` - Subscribe to state events
- `send(action)` - Send actions to modify state (legacy form — see [Updating State: `send` vs. `trigger`](#updating-state-send-vs-trigger))
- `trigger` - Proxy object exposing the same actions as callable methods, e.g. `trigger.setState({ fn })` (current/preferred form — see below)
- `subscribe(callback)` - Subscribe to state changes
- `inspect(callback)` - Monitor all state transitions and events
- `sessionId` - The actor's XState session identifier

## Context Objects

Each state component has a context object that contains the actual state data. These can be accessed using `getSnapshot().context`.

### Board Context

The board context contains information about the current game board, selected maps, and game mode.

```javascript
const boardContext = globalThis.state.board.getSnapshot().context;
```

Key properties include:
- `boardConfig` - Array of pieces on the board
- `openMapPicker` - Boolean indicating if the map picker is open
- `gameStarted` - Boolean indicating if the game has started
- `sandboxSeed` - Seed for randomization in sandbox mode
- `mode` - Game mode (sandbox, manual, autoplay)
- `selectedMap` - Information about the currently selected map

### Daily Context

The daily context contains information about daily challenges and features.

```javascript
const dailyContext = globalThis.state.daily.getSnapshot().context;
```

Key properties include:
```javascript
{
  "loaded": true,
  "boostedMap": {
    "roomId": "molse",    // ID of the boosted map
    "equipId": 7,         // Boosted equipment ID
    "equipStat": "ap"     // Boosted stat type
  },
  "yasir": {              // Special merchant
    "location": "carlin", // Current location
    "diceCost": 5183      // Cost in dice
  },
  "msUntilNextEpochDay": 12750651,  // Milliseconds until daily reset
  "willUpdateAt": 1745884800000     // Timestamp of next update
}
```

### GameTimer Context

The gameTimer context tracks the game progress and results.

```javascript
const timerContext = globalThis.state.gameTimer.getSnapshot().context;
```

Key properties include:
```javascript
{
  "currentTick": 1440,     // Current game tick
  "state": "defeat",       // Game state (initial, victory, defeat)
  "readableGrade": "F",    // Performance grade (S+, A, B, C, D, F)
  "rankPoints": 0          // Points earned for rankings
}
```

### Menu Context

The menu context manages UI state for menus and navigation.

```javascript
const menuContext = globalThis.state.menu.getSnapshot().context;
```

Key properties include:
```javascript
{
  "mode": false,          // Active mode
  "inventory": {
    "selectedItem": false // Currently selected inventory item
  },
  "store": {
    "selectedCategory": "upgrades",  // Selected store category
    "selectedItem": "containerSlot", // Selected item
    "mobileNav": "category"          // Mobile navigation state
  },
  "trophyRoom": {
    "selectedRegion": null, // Selected region in trophy room
    "category": null        // Selected category
  },
  "questIconSrc": "quest.png", // Quest icon source
  "questBlip": false           // Quest notification indicator
}
```

#### Tracking Menu State Changes

You can use `select()` to subscribe to specific parts of the menu state:

```javascript
// select a piece of the state
const menuState = globalThis.state.menu.select((state) => state.mode);

// react to menu mode changes
menuState.subscribe((mode) => {
  console.log(mode);
});
```

### Player Context

The player context contains comprehensive player data including inventory, monsters, equipment, and progress.

```javascript
const playerContext = globalThis.state.player.getSnapshot().context;
```

Key properties include:
```javascript
{
  "id": 1,                       // Player ID
  "version": 159,                // Data version
  "name": "playerName",          // Player name
  "outfitId": 1457,              // Current outfit ID
  "head": 94,                    // Head appearance
  "body": 0,                     // Body appearance
  "legs": 0,                     // Legs appearance
  "feet": 114,                   // Feet appearance
  "outfits": [12, 129],          // Available outfits
  "flags": 1056702426,           // Player flags
  "loyaltyPoints": 9250,         // Loyalty points
  "exp": 150,                    // Experience
  "gold": 450,                   // Gold currency
  "coin": 100,                   // Premium currency
  "dust": 59,                    // Dust currency
  "staminaWillBeFullAt": 1745887162173, // Timestamp when stamina will be full
  "battleWillBeReadyAt": 1745873835589, // Timestamp when battle will be ready
  
  // Room completion data
  "rooms": {
    "kof": {                     // Room ID
      "rank": 4,                 // Player's rank
      "count": 184,              // Completion count
      "ticks": 131               // Best completion time
    }
    // Other rooms...
  },
  
  // Quest information
  "questLog": {
    "task": {
      "rank": 238,               // Quest rank
      "ready": false,            // Is quest ready
      "gameId": 4,               // Quest game ID
      "points": 1,               // Quest points
      "resetAt": 1745865031058,  // Quest reset timestamp
      "killCount": 17            // Required kills
    },
    "seashell": {
      "streak": 58,              // Streak count
      "readyAt": 1745923169408   // Ready timestamp
    },
    "tutorial": {
      "step": 18,                // Tutorial step
      "ready": false,            // Is tutorial ready
      "monstersKilled": 0        // Monsters killed in tutorial
    }
  },
  
  // Player's monsters
  "monsters": [
    {
      "ad": 20,                  // Attack damage
      "ap": 20,                  // Ability power
      "hp": 20,                  // Health points
      "id": "6kAyyQEY",          // Unique ID
      "exp": 11214750,           // Experience
      "tier": 4,                 // Monster tier
      "armor": 20,               // Armor value
      "gameId": 4,               // Game ID (monster type)
      "locked": true,            // Is locked (protected)
      "equipId": "VOb5wixj",     // Equipped item ID
      "createdAt": 1731944856501, // Creation timestamp
      "magicResist": 20          // Magic resistance
    }
    // More monsters...
  ],
  
  // Player's equipment
  "equips": [
    {
      "id": "X7PmpV0i",          // Unique ID
      "stat": "ad",              // Stat bonus type (ad, ap, hp)
      "tier": 4,                 // Equipment tier
      "gameId": 3                // Game ID (equipment type)
    }
    // More equipment...
  ],
  
  // Inventory items
  "inventory": {
    "stamina1": 14,              // Stamina potions tier 1
    "stamina2": 13,              // Stamina potions tier 2
    "equipChest": 0,             // Equipment chests
    "outfitBag1": 67,            // Outfit bags
    "insightStone1": 0,          // Insight stones tier 1
    // More inventory items...
  },
  
  // Saved board configurations
  "boardConfigs": {
    "kof": [                     // Room ID
      {
        "equipId": "ZgZ_kioY",   // Equipment ID
        "monsterId": "Si99h-vf", // Monster ID
        "tileIndex": 38          // Board position
      }
      // More configurations...
    ]
    // More rooms...
  }
}
```

## Board Management

The board component controls the game board, map selection, and gameplay mode.

### Accessing Board State

```javascript
// Get current board state
const boardState = globalThis.state.board.getSnapshot();
console.log(boardState.context);
```

### Setting Game Mode

```javascript
// Set game to sandbox mode
globalThis.state.board.send({ type: "setPlayMode", mode: "sandbox" });

// Set game to autoplay mode
globalThis.state.board.send({ type: "setPlayMode", mode: "autoplay" });

// Set game to manual mode
globalThis.state.board.send({ type: "setPlayMode", mode: "manual" });
```

### Selecting Maps

```javascript
// Select a specific map using its ID
globalThis.state.board.send({
  type: "selectRoomById",
  roomId: globalThis.state.utils.ROOM_ID.abbane,
});
```

### Custom Board Setup

```javascript
// Set up monsters on specific tiles
globalThis.state.board.send({
  type: "autoSetupBoard",
  setup: [
    {
      monsterId: monsterId, // From player.monsters
      equipId: equipId, // From player.equips
      tileIndex: tileIndex, // Tile position (0-based)
    },
  ],
});
```

### Setting Custom Seeds

```javascript
// Set a custom seed for sandbox mode
globalThis.state.board.send({
  type: "setState",
  fn: (prev) => ({ ...prev, customSandboxSeed: -1 }),
});
```

## Player State

The player component contains inventory, monsters, equipment, and other player data.

### Accessing Player Data

```javascript
// Get player state
const playerState = globalThis.state.player.getSnapshot();
const { monsters, equips } = playerState.context;
```

#### Getting Quest Reset Time

You can find out when a new hunting task will be available:

```javascript
const getTaskResetAt = () => {
  const task = globalThis.state.player.get().context.questLog.task;
  if (!task) return null;
  return task.resetAt;
};

getTaskResetAt() // returns null or a timestamp
```

### Modifying Equipment

```javascript
// Change equipment stats without mutation
const equips = globalThis.state.player.getSnapshot().context.equips;
const nextEquips = equips.map((equip) =>
  equip.id === targetEquipId ? { ...equip, stat: "ap", tier: 5 } : equip
);

globalThis.state.player.send({
  type: "setState",
  fn: (prev) => ({ ...prev, equips: nextEquips }),
});
```

### Modifying Monsters

```javascript
// Change monster stats without mutation
const monsters = globalThis.state.player.getSnapshot().context.monsters;
const nextMonsters = monsters.map((monster) =>
  monster.id === targetMonsterId
    ? {
        ...monster,
        hp: 20,
        ad: 20,
        ap: 20,
        armor: 20,
        magicResist: 20,
      }
    : monster
);

globalThis.state.player.send({
  type: "setState",
  fn: (prev) => ({ ...prev, monsters: nextMonsters }),
});
```

### Subscribing to Player State Changes

You can subscribe to player state changes to react to updates:

```javascript
globalThis.state.player.subscribe((playerState) => {
  // react to player state changes
  console.log(playerState);
});
```

## Season and Game Version

```javascript
globalThis.state.CURRENT_SEASON; // 2 (number)
globalThis.state.GAME_VERSION;   // '3' (string)
```

Both sit directly on `globalThis.state` (not `state.utils`).

`Mod_Settings.js` (`getGameSeasonAndVersion()`) includes both in the Firebase best-runs upload metadata as `gameSeason` / `gameVersion`.

## Game Utilities

The utils component provides helper functions and game data.

### Room Data

```javascript
// Access room IDs and names
const roomIds = globalThis.state.utils.ROOM_ID;
const roomNames = globalThis.state.utils.ROOM_NAME;

console.log(roomIds.rkswrs); // "rkswrs"
console.log(roomNames.rkswrs); // "Sewers"

// Access all room data
const rooms = globalThis.state.utils.ROOMS;

// Access all region data
const regions = globalThis.state.utils.REGIONS;

// Get initial board setup for a specific room
const abbaneSetup = globalThis.state.utils.getBoardMonstersFromRoomId('abbane');
// Returns an array of board entities:
[
    {
        "type": "file",        // Source type (from file vs custom)
        "key": "D_9b",         // Unique identifier
        "tileIndex": 85,       // Position on the board
        "villain": true,       // Enemy (true) or ally (false)
        "gameId": 1,           // Monster type ID
        "direction": "west",   // Facing direction
        "level": 10,           // Monster level
        "tier": 0,             // Monster tier
        "equip": null          // Equipment (null if none)
    }
    // More monsters may be included
]
```

#### `getBoardMonstersFromRoomId` takes one argument only — it is floor-blind

The function's real signature is `getBoardMonstersFromRoomId(roomId)`. There is **no second
argument** — no `floor`, no `boosted`, no options object of any kind. Passing one (e.g.
`getBoardMonstersFromRoomId(roomId, { floor: 10, boosted: false })`) is silently ignored; the
call still resolves the same way as `getBoardMonstersFromRoomId(roomId)` alone.

For ordinary single-floor rooms this is fine — the room's `file.data.actors` is the only layout
that exists. But for **multi-floor quest rooms** (`room.type === 'multi'`, e.g. *The Behemoth
Quest* and *The Annihilator Quest*, id `edanni`), each floor has its own actor layout in
`room.floorFiles[floorIndex].data.actors`, and `getBoardMonstersFromRoomId` has no way to select
one — it silently falls back to **floor 0's** layout regardless of which floor is actually
current. This was confirmed live against room `edanni` on floor 10: the call kept returning
floor 0's monsters (gameId `11/11/15/5/11/11`) instead of floor 10's real ones (raw
`floorFiles[10].data.actors` has id `40/40/41/41/40/40`).

**Preferred: use the shared helper.**
`window.mapsDatabase.getBoardMonstersForFloor(roomId, floorIndex)` (in `database/maps-database.js`)
implements the pattern below. `mods/Super_Mods/Awaken_Tracker.js` uses it (Paladin only exists on
`edcow` floors 11–15, so the floor-0 getter never saw it).

**Underlying pattern for any room that might be multi-floor:**

```javascript
function getBoardMonstersForFloor(roomId, floorIndex) {
  const room = globalThis.state.utils.ROOMS?.find(r => r?.id === roomId);

  if (room?.type === 'multi') {
    const rawActors = room.floorFiles?.[floorIndex]?.data?.actors;
    if (!Array.isArray(rawActors)) return [];
    return rawActors
      .map((actor, tileIndex) => actor && ({
        type: 'file',
        key: `multi-floor-enemy-${tileIndex}`,
        tileIndex,
        villain: true,
        gameId: actor.id,
        direction: actor.direction,
        level: actor.level,
        equip: actor.equip ?? null,
        shiny: actor.shiny ?? false,
      }))
      .filter(Boolean); // rawActors is dense-with-null; skip empty tiles
  }

  return globalThis.state.utils.getBoardMonstersFromRoomId(roomId) || [];
}

// Current floor comes from board context, not from any argument to the getter:
const floorIndex = globalThis.state.board.getSnapshot()?.context?.floor ?? 0;
getBoardMonstersForFloor('edanni', floorIndex);
```

`globalThis.state.utils.ROOMS` filtered to `r.type === 'multi'` gives every room that needs this
treatment (also exposed as `database/maps-database.js`'s `getMultiFloorRoomIds()`, a live scan
rather than a hardcoded list). This pattern is already implemented independently in
`content/ba-sandbox-utils.mjs` (`$replay`'s `configureBoard`), `mods/Official_Mods/Setup_Manager.js`
(`getEnemyTeamConfigForRoom`), and `mods/Super_Mods/Cyclopedia.js` — reuse one of those rather than
re-deriving it.

**When the floor-blindness does and doesn't matter:** it matters whenever a caller needs the
floor's actual board — correct levels/tiers/positions to place custom pieces or replay a fight
(the three call sites above). It also matters for "which floors does creature X exist on":
rosters are *not* identical across floors (Paladin only exists on `edcow` floors 11–15).
`mods/Super_Mods/Better_Tasker.js` therefore scans every floor via
`mapsDatabase.getBoardMonstersForFloor` (`findFloorsForCreatureInMultiFloorRoom`,
`getMultiFloorRoomsWithCreature`, `resolveRoomTarget`) to list a creature's rooms, restrict its
floor dropdown, and pick the floor to navigate to.

For the plain question "is creature X on any map at all" there is a shared, floor-aware scan:
`mapsDatabase.getBoardMonsterGameIds({ includeRaids, includeDrops })` returns a cached
`Set<gameId>` over every room's `file.data.actors` and every `floorFiles[].data.actors`. Both
flags default to `false` (Better Tasker: taskable creatures only — no raids/events, no
drop-only creatures); `Autoseller.js` passes both `true`. `includeDrops` adds `extraMonsterDrops`
(creatures never placed on a board, e.g. the Demon on Orshabaal Raid). It returns an empty set
while room data isn't loaded yet — treat that as "unknown", not "no creature".

### Experience and Level Calculations

The game provides utility functions for calculating experience points and levels:

```javascript
// Calculate experience points needed for a specific level
const expForLevel5 = globalThis.state.utils.expAtLevel(5);
console.log(expForLevel5); // 11250

// Calculate level based on experience points
const levelForExp = globalThis.state.utils.expToCurrentLevel(440425);
console.log(levelForExp); // 25
```

#### Experience After Battle Formula

Below is the experience after battle formula provided by [Xandjiji](https://github.com/xandjiji):

```javascript
const xpValue = defeatedLevelSum * 562.5
const rngMultiplier = (rollD20() - 10) / 100

const expDrop = Math.round(xpValue * (1 + rngMultiplier))
```

#### Level Formula

Below is the level formula in TypeScript provided by [Xandjiji](https://github.com/xandjiji):

```typescript
export const ENEMY_XP_DROP_PER_LVL = 56.25; // arbitrary
const XP_RATE = 10; // higher = faster xp rate
export const ROOM_XP_DROP_PER_LEVEL = ENEMY_XP_DROP_PER_LVL * XP_RATE;

const getLevelSteepness = (level: number) =>
  0.00970941 * Math.pow(1.14111, level) + 1;

export const expAtLevel = (level: number) => {
  const steepness = level * getLevelSteepness(level);

  const xpRequired = (level - 1) * ROOM_XP_DROP_PER_LEVEL;

  const result = Math.round(steepness * xpRequired);
  return result - (result % 250);
};
```

### Player Flags

The game uses a bitwise flag system for tracking player abilities and achievements:

```javascript
// Get player flags
const playerFlags = globalThis.state.player.getSnapshot().context.flags;

// Create Flags object for easier access
const flags = new globalThis.state.utils.Flags(playerFlags);

// Check if specific flags are set
console.log(flags.isSet("sandbox")); // true or false
console.log(flags.isSet("autoplay")); // true or false

// Access flag values
const autoplayFlagValue = globalThis.state.utils.Flags.getFlagValue("autoplay");
console.log(autoplayFlagValue); // 65536

// Example flag values:
const flagDictionary = {
    "banned": 0,
    "premium": 1,
    "alt": 2,
    "storeBestiaryContainer": 3,
    "monsterTier": 4,
    "taskBestiaryContainer": 5,
    "tutorialBestiaryContainer": 6,
    "rookgaardDlc": 7,
    "sandbox": 8,
    "carlinDlc": 9,
    "boostedMap": 10,
    "yasir": 11,
    "yasirBestiaryContainer": 12,
    "monsterSqueezer": 13,
    "forge": 14,
    "autosetup": 15,
    "autoplay": 16,
    "genie": 17,
    "achievSeashell": 18,
    "achievCreature95": 19,
    // ... and more
};
```

Room and region data structures are detailed below:

```javascript
// Room structure example
const roomExample = {
  "id": "rkswrs",               // Unique room identifier
  "file": {
    "name": "rookgaard-sewers", // File name
    "data": {
      "tiles": [                // Map tiles information
        [
          {
            "id": 353,
            "cropX": 1,
            "cropY": 0,
            "bank": 140
          },
          {
            "id": 3994
          }
        ]
      ],
      "floorBelowTiles": [],    // Lower level tiles
      "actors": [               // NPCs and enemies
        {
          "id": 1,              // Monster ID
          "direction": "west",  // Facing direction
          "level": 10           // Level
        },
        null
      ],
      "hitboxes": [             // Collision information
        true, true, false, true // etc.
      ],
      "blocked": []             // Blocked positions
    }
  },
  "difficulty": 1,              // Room difficulty (1-5)
  "maxTeamSize": 1,             // Maximum player team size
  "staminaCost": 3              // Stamina cost to play
};

// Multi-floor quest room example (e.g. The Annihilator Quest, id "edanni").
// type: 'multi' rooms have NO top-level maxTeamSize/staminaCost — those vary per floor
// instead. Reading room.maxTeamSize directly (the single-floor pattern above) silently
// returns undefined for these; several bugs shipped from exactly that (see
// mods/Official_Mods/Setup_Manager.js getMaxTeamSize()). The current floor is
// globalThis.state.board.getSnapshot().context.floor (0-indexed) — index into floorRules
// (and floorFiles) with it.
const multiFloorRoomExample = {
  "id": "edanni",
  "isUnlocked": true,
  "type": "multi",
  "difficulty": 3,
  "floorFiles": [                    // One entry per floor, board layout only
    { "name": "edanni1", "data": { "tiles": [/* ... */], "actors": [/* ... */] } }
    // ...16 floors total for The Annihilator Quest (indices 0-15)
  ],
  "floorRules": [                    // Parallel array — per-floor battle rules
    { "maxTeamSize": 4, "staminaCost": 12, "setupKey": "edanni" },  // floors 0-14
    // ...
    { "maxTeamSize": 6, "staminaCost": 18, "setupKey": "edanni2" }  // floor 15 (index 15)
    // A rule may also carry "extraMonsterDrops": [{ "gameId": 123, ... }] — see
    // "extraMonsterDrops" under "Monster Drop System" below (e.g. edcow floors 11-15).
  ]
};

// Region structure example
const regionExample = {
  "id": "rook",                // Region identifier
  "minimapOffset": "-330px -1230px", // Position on minimap
  "rooms": [                   // Rooms in this region (same structure as above)
    {
      "id": "rkswrs",
      "file": {
        "name": "rookgaard-sewers",
        "data": {} // Same structure as above
      },
      "difficulty": 1,
      "maxTeamSize": 1,
      "staminaCost": 3
    }
  ]
};
```

### Monster Data

```javascript
// Get monster data by ID
const rat = globalThis.state.utils.getMonster(1);
console.log(rat.metadata.name); // "Rat"
console.log(rat.metadata.baseStats); // HP, AD, AP, etc.
```

### Equipment Data

```javascript
// Get equipment data by ID
const boots = globalThis.state.utils.getEquipment(1);
console.log(boots.metadata.name); // "Boots of Haste"

// Render equipment effect tooltips with tier-scaled values (T1–T5)
const host = document.createElement('div');
const component = window.equipmentDatabase.mountEquipmentEffectComponent(
  host,
  boots.metadata.EffectComponent,
  4 // player's equipment tier — effect numbers scale with tier (T5 = max)
);
// component.unmount() when done

// Tier stat bonuses (forge tiers Grey → Yellow) live on equipment-database.js:
// window.equipmentDatabase.EQUIPMENT_TIER_STAT_BONUSES
```

#### Equipment forge tiers (T1–T5)

Player inventory equipment uses **numeric** `tier` values `1`–`5` (Grey → Yellow). `player.context.equips[].tier` never exceeds `5`.

- `window.equipmentDatabase.clampEquipmentTier()` clamps to `1`–`5`.
- `mountEquipmentEffectComponent()` and `createUIComponent(root, EffectComponent, { tier })` expect a number in that range for forge tiers.
- **Do not pass `tier: 6`** — the game's effect scaler only knows forge tiers and will render `NaN` for cooldowns and similar values.

#### Awaken Cyclops upgrade (in-battle “T6” preview)

This is **not** a sixth forge tier. When an **awakened Cyclops** upgrades an adjacent ally's equipment during a fight, the game shows a special rarity frame and adjusted effect numbers.

| Surface | Value |
| --- | --- |
| Portrait `data-rarity` | `AWAKEN-CYCLOPS-TIER` |
| Effect tooltip `createUIComponent` props | `{ tier: 'AWAKEN-CYCLOPS-TIER' }` |
| Player `equips[].tier` | Still `1`–`5` (unchanged in inventory) |

Example ([Amazon Armor](https://bestiaryarena.wiki.gg/wiki/Amazon_Armor)): forge T5 cooldown **9s**; with Awaken Cyclops upgrade **8s**.

```javascript
// Portrait rarity (after createItemPortrait with tier: 5)
portrait.querySelector('[data-rarity]').setAttribute('data-rarity', 'AWAKEN-CYCLOPS-TIER');

// Effect tooltip for Cyclops-upgraded values
const createUIComponent = globalThis.state?.utils?.createUIComponent;
const component = createUIComponent(
  host,
  boots.metadata.EffectComponent,
  { tier: 'AWAKEN-CYCLOPS-TIER' }
);
if (component?.mount) component.mount();
```

**Cyclopedia (Arsenal tab):** Equipment details include a **T1–T6** selector above the portrait. T1–T5 use numeric forge tiers (default **T5**). **T6** previews the Awaken Cyclops upgrade (rarity + effect props above). The selected tier persists until the Cyclopedia modal closes, then resets to T5.

If `{ tier: 'AWAKEN-CYCLOPS-TIER' }` fails to render, Cyclopedia retries `{ tier: 5, awakenCyclops: true }`, then `{ tier: 5, cyclopsUpgrade: true }`, then plain T5 as a last resort.

### Monster Drop System

Below is the internal monster drop logic provided by [Xandjiji](https://github.com/xandjiji). It handles normal drops, shiny rolls, and sealed monster drops based on floor depth:

```typescript
function tryForMonsterDrop({
  roomId,
  floor,
  isBoosted,
  isRaid,
}: {
  roomId: string;
  floor: number;
  isBoosted: boolean;
  isRaid: boolean;
}) {
  const monsterDropPool = getMonsterDropPool(roomId);
  if (!monsterDropPool.length) return;

  const shiny = rollForShinyMonster(isRaid ? "raidDrop" : "normalDrop", floor);

  if (floor < BASE_RED_FLOORS || shiny) {
    const m = rollForMonsterDrop(monsterDropPool, isBoosted);
    if (shiny) mutateShiny(m);
    return m;
  }

  return rollForSealedMonsterDrop({
    monsterDropPool,
    floor,
    boostedOrRaid: isBoosted || isRaid,
  });
}
```

**Related internal functions:**
- `getMonsterDropPool(roomId)` — returns the list of possible monster drops for a room
- `rollForShinyMonster(type, floor)` — rolls for a shiny based on drop type and floor
- `rollForMonsterDrop(pool, isBoosted)` — picks a monster from the pool and rolls its genes (see below)
- `mutateShiny(monster)` — converts a monster into its shiny variant
- `rollForSealedMonsterDrop({ monsterDropPool, floor, boostedOrRaid })` — rolls a sealed monster drop on higher floors
- `BASE_RED_FLOORS` — floor threshold where sealed drops replace normal drops

#### `extraMonsterDrops` — drop-only creatures on a room

A room in `globalThis.state.utils.ROOMS` may carry `extraMonsterDrops: { gameId: number, allowNonSealedOnRedFloors?: boolean }[]`
— monsters that can drop from the room even though they are not placed on its board. **Entries are
objects, not bare ids** (verified in console 2026-10-27), so match with `.some(d => d.gameId === id)`,
never `.includes(id)`. Multi-floor rooms put it on each floor instead:
`room.floorRules[floor].extraMonsterDrops`.

```javascript
const room = globalThis.state.utils.ROOMS.find(r => r.id === 'edorsha'); // Orshabaal Raid
room.extraMonsterDrops; // [{ gameId: 132 }]  (Demon)
```

Known uses (console-verified 2026-10-27): Kings' Lab (`klab`) → Dwarf Geomancer (56); Orshabaal Raid
(`edorsha`) → Demon (132); `edsta` → The Pale Count (121) + Vampire Bride (122); `edcow` floors
11–15 (`floorRules`) → Paladin (123, `allowNonSealedOnRedFloors: true`).

- Entry fields:

  | Field | Type | Meaning |
  |---|---|---|
  | `gameId` | `number` | Monster that can drop. Always present. |
  | `allowNonSealedOnRedFloors` | `boolean?` | Only seen on `edcow` floors 11–15 (Paladin). Absent elsewhere (treat as `false`). **Inferred, not read from source:** past `BASE_RED_FLOORS` the native roll switches to `rollForSealedMonsterDrop`; this flag presumably lets the creature still drop as a normal (non-sealed) monster there. |

  `getMonsterDropPool` is server-side, so the flag's exact effect is unverified. Check it against real
  drops before relying on it.
- The game validates each entry at load: it must be a known monster and must **not** be in the
  non-playable set (`state.utils` has no export for it), otherwise it throws
  `Non-playable extra monster drop`.
- Orshabaal Raid's board actors (Orshabaal, Rostein, Shooter, Healer) are all non-playable, so the
  Demon is the only creature that can drop there.
- The drop pool is presumably the room's playable actors plus `extraMonsterDrops`. `getMonsterDropPool`
  itself is not in the client chunks (server-side), so that combination is inferred, not read.
- Anything that asks "can this creature come from a map?" by scanning `room.file.data.actors` /
  `room.floorFiles[].data.actors` alone will miss these creatures. Autoseller's
  `mapsDatabase.getBoardMonsterGameIds({ includeDrops: true })` (used by Autoseller) adds `extraMonsterDrops` for this reason.

#### `rollForMonsterDrop` source (game code, TypeScript, pasted 2026-09-29)

Reference copy of the native gene-roll for a normal (non-sealed) monster drop. Useful for
drop-odds calculators, simulators, and sanity-checking "is this gene spread plausible".

```ts
export function rollForMonsterDrop(
  monsterDropPool: { id: number; level: number }[],
  boosted: boolean,
): DBMonster {
  const rng = new RNG();
  const monsterDrop = rng.sampleFrom(monsterDropPool);

  let hp = 1;
  let ad = 1;
  let ap = 1;
  let armor = 1;
  let magicResist = 1;

  if (boosted) {
    hp = rng.dice.d20();
    ad = rng.dice.d20();
    ap = rng.dice.d20();
    armor = rng.dice.d20();
    magicResist = rng.dice.d20();
  } else {
    [hp, ad, ap, armor, magicResist] = rng.shuffle([
      rng.dice.advantageRoll(rng.dice.d20, monsterDrop.level >= 30 ? 0 : -1),
      rng.dice.advantageRoll(rng.dice.d20, monsterDrop.level >= 35 ? 0 : -1),
      rng.dice.advantageRoll(rng.dice.d20, monsterDrop.level >= 40 ? 0 : -1),
      rng.dice.advantageRoll(rng.dice.d20, monsterDrop.level >= 45 ? 0 : -1),
      rng.dice.advantageRoll(rng.dice.d20, monsterDrop.level >= 50 ? 0 : -1),
    ]);
  }

  return {
    id: generateMonsterId(),
    gameId: monsterDrop.id,
    exp: LEVEL_TO_XP_TABLE[10],
    createdAt: Date.now(),
    hp, ad, ap, armor, magicResist,
  };
}
```

**Takeaways:**
- The monster is picked **uniformly** from the pool (`sampleFrom`) — no per-monster weighting here.
- **Boosted**: each of the 5 genes is a plain, independent `d20` (1–20). No level scaling at all.
- **Non-boosted**: five rolls, each `advantageRoll(d20, mod)`, where `mod` is `-1` (disadvantage) until
  the *pool entry's* `level` reaches that roll's threshold (30/35/40/45/50), then `0` (plain d20).
  The five rolled values are then **shuffled** across `hp/ad/ap/armor/magicResist`, so the
  thresholds don't map to specific stats — they only decide how many of the five rolls are
  disadvantaged. A level-50+ pool entry therefore rolls the same as a boosted one.
- Drops always start at `LEVEL_TO_XP_TABLE[10]` exp (level 10).
- Not covered here: `rollForShinyMonster`, `mutateShiny`, and `rollForSealedMonsterDrop`
  (floors ≥ `BASE_RED_FLOORS`) — those are separate code paths.
- `advantageRoll`'s exact semantics weren't in the paste; `-1` is assumed to mean "roll twice, keep
  the lower". Verify against the game's `RNG` source before relying on exact probabilities.

### Updating State: `send` vs. `trigger`

This doc's own examples above use two different call shapes for the same kind of update:

```javascript
// Form 1 — send() with a "setState" action (used in the Board/Player examples above)
globalThis.state.board.send({ type: "setState", fn: (prev) => ({ ...prev, floor: 10 }) });

// Form 2 — trigger.setState() (used in the Client Configuration examples below)
globalThis.state.board.trigger.setState({ fn: (prev) => ({ ...prev, floor: 10 }) });
```

Both exist on every state component. **`trigger.setState({ fn })` is the current, actively-used
form** — it's what the mod codebase itself uses almost everywhere state is written (`Raid_Hunter.js`,
`Better_Setups.js`, `Outfiter.js`, `Map_Editor.js`, `Board_Analyzer.js`, `Bestiary_Automator.js`,
`Autoseller.js`, `content/custom-battles.js`, `content/ba-sandbox-utils.mjs`, etc.). `send({ type:
"setState", fn })` still works and is kept as a defensive fallback in a few call sites for when
`trigger` isn't present, following the pattern used in `Map_Editor.js` and `custom-battles.js`:

```javascript
if (globalThis.state.board.trigger?.setState) {
  globalThis.state.board.trigger.setState({ fn });
} else if (globalThis.state.board.send) {
  globalThis.state.board.send({ type: "setState", fn });
}
```

**When writing new code, prefer `trigger.setState({ fn })`.** The `send({ type: "setState", ... })`
examples elsewhere in this doc remain valid (both forms are live in the current game build), but new
call sites in this codebase consistently use `trigger`.

## Public Highscores API (Trophy Room)

`game.getFullTrophyRoomData` returns every room's #1 tick, rank and floor record, plus the global top-20 boards, in **one public GET** (no login needed, ~43 KB). It returns the same records as the logged-in `game.getTickHighscores` + `game.getRoomsHighscores` pair (verified identical for all 100 rooms, 2026-09-23), so prefer it for new code. All bundled mods (Better Highscores, Highscore Improvements, Cyclopedia, Guilds, Mod Settings run-upload validation) now use it; only `game.getTickLeaderboards` (per-room top lists) is still fetched separately.

In mods, fetch it through the shared helper rather than calling `fetch` yourself:

```javascript
const { highscores, leaderboards } = await window.BestiaryModAPI.util.fetchTrophyRoomData();

highscores.tick.rkswrs;   // #1 speedrun on Sewers
highscores.rank.rkswrs;   // #1 rank-points run
highscores.floor.rkswrs;  // #1 floor run
leaderboards.floor;       // global top 20 by total floors
```

`util.fetchTrophyRoomData()` (in `content/client.js`) always fetches fresh, but has a **2-second cooldown** shared by every mod: calls made within 2 s of the last request (or while it's in flight) get that request's result. The cooldown runs from when the last request finished. This way several mods reacting to the same map change or battle end cost one request. The game's rate limit is shared across its whole API (e.g. Guilds' profile bursts), so on a `429` the helper waits `Retry-After` (default 1 s, max 5 s) and retries once. If a fetch still fails, it returns the **last successful payload** instead of rejecting; it only rejects if nothing has loaded yet. Don't add a longer cache on top for one-off reads: consumers are expected to get the latest records. The exception is a **bulk operation that also spends the server's budget of 30 requests per 10 s** (e.g. Guilds' panel load, which sends up to 28 profile requests per 10 s). Take one snapshot for the whole operation and send it through the same rate limiter. Guilds' `getRoomsHighscoresCached()` does this (30 s snapshot via `withProfileRateLimit`); re-fetching every 2 s there caused profile 429s and 10 s back-offs.

If you call the endpoint directly: it's a plain GET (`/api/trpc/game.getFullTrophyRoomData`), **not** the `?batch=1&input=…` form, so the payload is `json.result.data.json` (no `[0]`).

Every entry also carries the holder's `userId`, `userName` and outfit (`outfitId`, `head`, `body`, `legs`, `feet`):

| Path | Keyed by | Extra fields |
|------|----------|--------------|
| `highscores.tick[roomCode]` | room code | `ticks` |
| `highscores.rank[roomCode]` | room code | `rank` (points), `ticks` |
| `highscores.floor[roomCode]` | room code | `floor`, `ticks` (the old `getRoomsHighscores` could also say `floorTicks`) |
| `leaderboards.tick[]` | top 20, sorted | `ticks` (sum over rooms) |
| `leaderboards.rank[]` | top 20, sorted | `points`, `ticks` |
| `leaderboards.floor[]` | top 20, sorted | `floors` (sum), `ticks` |

## Game tRPC API (chunk review, 2026-10-31)

Found by downloading every chunk in the build manifest (`/_next/static/<buildId>/_buildManifest.js`)
plus the home-page chunks, and searching the minified source for `<router>.<procedure>.useMutation /
useQuery / mutate`. Re-verify after a game update. Before this review, `docs/` documented only
`game.getFullTrophyRoomData` (see `game_state_api.md` → Public Highscores API); every other
procedure below was undocumented.

**Do not call these from a mod unless a mod already does.** They are the game's own server API. Many
spend gold, dust, coins or stamina, and the server is the authority. The mod-side request budget
(25 `/api/` calls per 10 s across all mods, see `docs/mod_development_guide.md`) applies.

### Transport

- Endpoint `POST /api/trpc/<router>.<procedure>`; reads are `GET` with `?batch=1&input=<json>`.
- Batched body shape, as used by `Autoscroller.js` / `Autoseller.js`: `{ "0": { "json": <input> } }`.
  The response is `[{ result: { data: { json: ... } } }]`.
- Plain `GET /api/trpc/game.getFullTrophyRoomData` is unbatched: payload is `json.result.data.json`.
- Two client objects exist in the bundle: a React hook client (`x.S.<router>.<proc>.useMutation`) and
  a vanilla client (`ea.ID.` / `ea.iX.<router>.<proc>.mutate()`).
- The only non-tRPC route is `GET /api/player-count`.

### Routers and procedure counts

| Router | Procedures | Notes |
| --- | --- | --- |
| `game` | 16 | battle start/skip/log, selling, locking, equipping, leaderboards, player/daily/raid snapshots |
| `inventory` | 31 | every consumable and rune, daycare, forge, nicknames |
| `quest` | 32 | hunting tasks, Halloween (`hwQuest*`), achievement rewards, DLC expansions |
| `store` | 42 | every `buy*`, plus Yasir stock/exchange |
| `account` | 7 | outfit, coins, gift codes, level reward, Pix payments |
| `admin` | 42 | server-gated; **never call** |
| `serverSide` | 1+ | `serverSide.profilePageData` (used by `Guilds.js`) |

`game.hideMonster` is also called by a mod (`/api/trpc/game.hideMonster`) but is not in the chunks'
React hooks.

### `game` router

| Procedure | Kind | What the client does |
| --- | --- | --- |
| `getFullPlayerData` | mutation | Called once at `/game` page load and cached (`ef`); fills `state.player` |
| `getLatestDailyData` | mutation | Boosted map, Yasir stock, `msUntilNextEpochDay`, `willUpdateAt`; refetched by a timer set to `msUntilNextEpochDay` |
| `getLatestRaids` | mutation | Raid list; refetched on the same kind of timer, gated on the `raids` flag in `flagsB` |
| `gameServer` | mutation | **Starts a battle.** Server returns `serverResults`. Retried while `attempt < 2`, never when the error message contains `"Raid is over"` |
| `logMatch` | mutation | Mismatch telemetry, see below |
| `skipBattle` | mutation | Skips a pending/manual battle; response `{ nextStaminaWillBeFullAt, staminaExcessMsDiff }` |
| `sellMonster` / `multisellMonster` | mutation | Single id / array of ids (`Autoseller.js` posts `{ "0": { json: id } }`) |
| `equipToDust` / `equipsToDust` | mutation | Disenchant one / many equipment ids |
| `lockMonster` | mutation | `{ locked, monsterId }` |
| `setMonsterEquip` | mutation | `{ monsterId }` plus the equipment change |
| `getRoomsHighscores`, `getTickLeaderboards`, `getRankLeaderboards`, `getFloorLeaderboards` | query | Leaderboard views |

#### Server-authoritative battle flow

The client simulates the battle, but the server decides the result:

1. Start: `game.gameServer` returns `serverResults`, stored in the game-store context
   (`setState({ serverResults, gameStarted: true, enableFreeSkip: serverResults.enableSkip, openRewards: false })`).
2. `serverResults` carries `seed`, `next.staminaWillBeFullAt`, `next.staminaExcessMsDiff`,
   `next.battleWillBeReadyAt`, and `rewardScreen` (`victory`, `roomId`, `floor`, `gameTicks`,
   `rankPoints`, `readableGrade`; reward items not itemised here). The player store gets the `next.*` values
   immediately (`staminaWillBeFullAt`, `staminaExcessMs += staminaExcessMsDiff`, `battleWillBeReadyAt`).
3. The client replays the battle with that `seed`. On a winning rewardScreen with a `boardConfig`
   it also saves `boardConfigs[roomKey(roomId, floor)]` locally.
4. `onGameEnd`: if the local winner (`nonVillains` vs `villains`) disagrees with
   `rewardScreen.victory` (and the client is not in the sandbox), the client sends
   `game.logMatch` with a JSON **string**:

```js
{ type: "mismatch", userId, userName, userAgent /* + " / brave" */, timestamp,
  clientResult,            // "nonVillains" | "villains"
  ticks,                   // world.tickEngine.getCurrentTick()
  roomId,
  comp: { seed, setup /* non-villain gameMonsterData */, floor } }
```

   A mod that forces a seed or edits the board will make the client disagree with the server and
   will **send this report with the user's id, name and user agent**. Sandbox mode (`Q`) returns
   from `onGameEnd` before the comparison, so it never reports (verified). That sandbox also skips
   `gameServer` is inferred, not confirmed. Keep custom/sandbox battles out of the real result path.
5. If the server says a new game version exists, the client shows "A new update is available,
   please refresh" with a `?v=<gameVersion>` link (the same `gameVersion` as `state.utils`).
6. Power-saving mode (`powerSaving.mode` `on`/`turningOn`) records `gameStartedAt` and
   `gameWillEndAt = now + ticksToMs(gameTicks) + 2000` so the UI can sleep through the replay.

### `inventory` router (31)

`input` is what the client sends (only where the call site was readable).

| Group | Procedures (input) |
| --- | --- |
| Chests/bags | `equipChest`, `outfitBag`, `hunterOutfitBag`, `surpriseCube`, `summonScroll` (rarity) |
| Fusion | `fuseSummonScrolls { rarity }`, `fuseDiceManipulators { rarity }`, `forgeEquips { equipA, equipB }` |
| Stamina | `staminaPotion { rarity, amount }`, `staminaRefill` |
| Monster upgrade | `monsterStatRune { rune, monsterId }`, `insightStone { rarity, monsterId }`, `upgradeMonsterTier`, `monsterSoup`, `equipSoup`, `monsterSqueezer`, `diceManipulator` |
| Runes | `useBlankRune`, `useConversionRune { rune, equipId }`, `useDowngradeEquipRune { equipId }`, `useRecycleRune (list)`, `useRecycleMonsterRune (monster ids)`, `useShinyTransferRune { shinyId, recipientId }`, `useAvariceRune`, `useGenie`, `useDoctor` |
| Daycare | `addToDaycare { slotId, monsterId }`, `removeFromDaycare { slotId }`, `levelUpAtDaycare { slotId }` |
| Names | `nicknameMonster { monsterId, nickname? }` (omit `nickname` to remove it), `nicknameChange` |

### `quest` router (32)

- Hunting tasks: `setNewHuntingTask`, `finishHuntingTask`, `removeHuntingTask`,
  `refreshHuntingTaskCooldown`, `huntingTaskStore`.
- Halloween event: `hwQuestA` … `hwQuestL`, `hwQuestAll`, `hwTokens`, `hwCashoutBank`,
  `getHwStoreAchievementReward`. The "full bestiary" variants (`fullBestiary: t >= a`) are the ones
  gated on the player's collection size.
- Achievement rewards: `getBestiaryContainerFromAchievement`,
  `getBestiaryContainerFromAllMapsAchievement`, `getAnnihilatorAchievementReward`,
  `getBlackKnightReward`, `getAmazonReward`.
- DLC/expansion claims: `getKazExpansion`, `getOrcFortressExpansion`.
- Others: `tutorial`, `seashell`, `plantEat { monsterIds }`, `plantRedeem`.

### `store` router (42)

All `buy*` mutations. Currency is chosen by input where a product has two prices:
`buyBestiaryContainerSlots { currency: "coin" | "gold" }`. The gold / Beast Coin grouping below
comes from the price icon next to each button (`goldpile.png` vs `beastcoin.png`); a few
(`buyExtraStaminaPoints`, `buyGoldenOutfit`, DLC packs) were not checked individually. Products:

- **Gold:** `buyAutosetup`, `buyBoostedMap`, `buyDaycareSlot`, `buyDoctor`, `buyFloors`, `buyForge`,
  `buyGenie`, `buyGoto`, `buyMonsterSoup`, `buyMonsterSqueezer`, `buyNicknameChange`,
  `buyNicknameMonster`, `buyNpcTask`, `buyRaids`, `buySandbox`, `buyYasir`, `buyExtraStaminaPoints`,
  `buyAnkDlc`, `buyCarlinDlc`, `buyRookgaardDlc`, `buyVillainDlc`, `buyMountainFortress`,
  `buyMountainFortressB`, `buyGoldenOutfit`.
- **Beast Coin:** `buyPremium`, `buyEquipChest`, `buyOutfitBag1`, `buyOutfitBag1Bundle`,
  `buyStamina5`, `buySummonScroll5`, `buySurpriseCube5`, `buyDiceManipulator5`, `buyGazerBundle`,
  `buyStarterBundle`, `buyBestiaryContainerSlots`, `buyDoctor` (alt price).
- **Event:** `buyHalloween`, `buyHalloweenPass`.
- **Yasir (daily NPC):** `yasirDailyStock { amount, location }` (`"libertyBay"` | `"carlin"`),
  `yasirDustExchange { amount, location }`, `buyRecycleRuneYasir { amount }`.
- Pure UI redirects: `buyPlant`, `buyStaminaRefiller` just open the store to the `autoplay` item.

Flag names in the product gating (`s.floors`, `s.forge`, `s.raids`, `s.yasir`, `s.boostedMap`,
`s.monsterSqueezer`, `s.doctor`, `s.sandbox`…) are the same bit-flag set as `flagsB`
(see Player Flags above).

### `account` router (7)

`changeOutfit { outfitId, alt, mountId }` (outfit objects may also carry `head/body/legs/feet`
colors), `getPlayerCoins`, `getCoinHistory { pageIndex, pageSize }`, `redeemPlayerLevelReward`,
`useGiftCode`, `createPix` / `pollPixStatus { pixPaymentId }` (Brazilian Pix payments).

### `admin` router (42): listed, not for use

Gift codes (`create/list/deleteGiftCode`), raids (`create/list/deleteRaid`), highscore moderation
(`insert/list/promote/reset/hardDeleteHighscore`), player edits (`setPlayerGold/Dust/Flag`,
`managePlayerCoins/Inventory`, `edit/deletePlayerMonster`, `togglePlayerMonsterLock`,
`downgradePlayerFloors/Ranks`, `resetPlayerTicks`, `resetAccount`, `changeNickname`,
`swapDiscordAccounts`, `toggleBanPlayer`, `setTestAccount`), data views (`getUserByName`,
`getUserStats`, `listUsers`, `listGameLogs`, `listPurchaseLogs`, `getPlayerBestiary`,
`getPlayerInventory`, `getPlayerGoldDust`, `getPlayerCoinHistory`, `generateCsv`), revenue
(`getMtdRevenue`, `getRevenueStatsByTag`), and global ops (`nukeRoomData`, `resetHalloweenEvent`,
`takeCurrentSeasonSnapshot`). The `/admin` page and these procedures are server-gated. Nothing in
the loader should call them.

### Still not covered

- `game.gameServer` **input** shape: the mutate call site is built through a wrapper that this
  review did not resolve.
- Exact `serverResults.rewardScreen` field list beyond the names above.
- Server-side validation rules (the chunks hold only the client).
- `serverSide.*` procedures other than `profilePageData`.

## Mod Databases (`database/*`)

Scripts in `database/` run before game mods and expose `window.*` globals (static game data and lookup helpers) so mods do not hardcode creature, equipment or map lists.

- `creatureDatabase`, `equipmentDatabase` and `playerEquipmentDatabase` poll `state.utils` and start as a **placeholder object**; real data is merged into that same object later. Caching the global early is safe, but arrays are empty and lookups return `null` / `[]` until init finishes. Never reassign these globals; mutate in place (see `.claude/CLAUDE.md`).
- `mapsDatabase` and `inventoryDatabase` are ready at load. `mapsDatabase` getters scan `state.utils.ROOMS` live and may return empty results while room data loads, so call them at use time and prefer them over the static snapshots (`ALL_MAPS`, ...).
- Use optional chaining (`window.creatureDatabase?.findMonsterByName?.(n)`) and handle empty results.
- `window.FirebaseAdminsAPI` is documented in [chat_documentation.md](chat_documentation.md#firebase-admins-api).

### `window.creatureDatabase`

Source: `database/creature-database.js`.

Data:

- `ALL_CREATURES` — every creature (built from `state.utils`).
- `UNOBTAINABLE_CREATURES`, `NON_AWAKENABLE_CREATURES`, `NON_SCROLL_CREATURES`, `EVENT_CREATURES`
- `CYCLOPEDIA_EXTRA_CREATURES`, `CYCLOPEDIA_HIDDEN_CREATURES`, `SHINY_ALIAS_CREATURES`, `BOSS_ALIAS_CREATURES` (display-only room bosses, e.g. Hemorrhage = nicknamed Clot; see "Villain / room-script creature mechanics" below)
- `ALL_GAZER_GAME_IDS`, `MYSTIC_GAZER_GAME_ID`
- `getMapMonsterBaseStats(name, speciesBaseStats)` (map-only creature stats computed from the species `baseStats`; see "Map creature stats" below), `getCreatureCombatData(gameId)` (ability constants snapshot; see "Per-creature ability constants"), `MONSTER_STAT_DISPLAY_CONFIG`

Lookups:

- `findMonsterByGameId(gameId)` → `{ gameId, ...monster }` or `null`.
- `findMonsterByName(name)` → same shape; case-insensitive; resolves shiny alias display names.
- `getMonsterNameMap()` → cached lowercase name → `{ monster, gameId, index }`.
- `getAllMonstersWithPortraits()`, `getMonsterPortraitUrl(...)`, `getMonsterPortraitUrls(...)`

Classification predicates (take a creature name unless stated):

- `isEventCreatureName`, `isNonScrollCreatureName`, `isGazerCreatureName`,
  `isCreatureAwakenableName`, `isShinyProgressCreatureName`, `isGazerMonster(monster)`

Display / picker helpers:

- `resolveCreatureDisplay(name)`, `creatureHasShinyVariant(name)`,
  `filterMonstersForCreatureDisplay(...)`, `monsterMatchesCreatureDisplay(...)`,
  `getDisplayNameForOwnedMonster(monster)`, `buildOldOutfitsCss(...)`
- Name lists: `getCyclopediaCreatureNames()`, `getCreaturePickerNames()`,
  `getAutoscrollAutosellerCreaturePickerNames()`, `getGazerCreatureNames()`,
  `getShinyProgressCreatureNames()`

**Used by**

- `Autoseller` (`findMonsterByGameId`, `EVENT_CREATURES`)
- `Awaken_Tracker` (`ALL_CREATURES`, `NON_AWAKENABLE_CREATURES`, `UNOBTAINABLE_CREATURES`, finders)
- `Better_Tasker` (finders)
- Also `Autoscroller`, `Better_Analytics`, `Better_Teleporter`, `Cyclopedia`, `Depot_Manager`, `Hunt_Analyzer`, `Manual_Runner`, `Mod_Settings`, `Challenges`, `Map_Editor`, `Quests`, `content/event-competition.js`

#### Villain / room-script creature mechanics

Findings from the native game chunks (`https://bestiaryarena.com/_next/static/chunks/*.js`).
Nothing in the game keys off a creature's `nickname`; a creature behaves differently because of
its **villain flag** plus a **per-room script variable**. Re-verify against the live chunks after
a game update.

World defaults (`979-*.js`):
`_customRoomVariables = { halloweenSlimeMaxSpawn: 0, halloweenPaleCountAbilityDurationMs: null }`.
Floor numbers below are the Cyclopedia / in-game 0-15 indices. Room scripts are keyed by the **room file name** (`setupGameMap` runs `scripts[file.name]`), and a
room's `floorFiles` picks the file per floor. Scripts set the variables at world creation; creature
code reads them only when `actor.villany.wasSpawnVillain` is true, so a player-owned copy is
unaffected. Player-facing text for each script lives in `mapsDatabase.ROOM_SCRIPT_NOTES` (keyed by
script name); `mapsDatabase.getRoomScriptNotes(room)` groups a room's floors by their live
`floorFiles[i].name`, so floor ranges are never hardcoded. The Cyclopedia map stats panel and a
boss alias's "Special ability" column (`BOSS_ALIAS_CREATURES[].roomScript`) both read from it. To
document a new script, add one `ROOM_SCRIPT_NOTES` entry (plus a `roomScript` on a boss alias if it
has a nicknamed creature).

| Room (floors) | Script | Effect |
| --- | --- | --- |
| `crhw` Halloween Mansion (6-10) | `crhw2` | `halloweenSlimeMaxSpawn = 9`; on game start every villain gets `setAwaken(true)` |
| `crhw` (11-15) | `crhw3` | `halloweenPaleCountAbilityDurationMs = maxDurationTicks` in ms (Pale Count bats last the whole fight, end on his death) |
| `vcage` (0-5) | `vcage1` | villain Witches (`witch-perma-frog`): frog spell hits a fixed 18-tile set instead of a 5x5 diamond around the target, recast cooldown halved, AP -50% |
| `vcage` (6-10) | `vcage2` | same as `vcage1` |
| `vcage` (11-15) | `vcage3` | same `witch-perma-frog` behaviour, AP -80%; other villains AD -40% |
| `vmama` (0-5 / 6-15) | `vmama1` / `vmama2` | villain spiders awakened, raised to at least 1002 max HP |
| `edanni` (0) | `edanni1` | villains tagged `regular-spider-annihi`: ability cooldowns staggered evenly (`baseCooldown / n * i`) |
| `edanni` (6) | `edanni7` | villains tagged `minotaur-mage-annihi` get an extra "closest enemy, range 999" target selection |
| `edanni` (11 / 12 / 13) | `edanni12` / `13` / `14` | flat villain stat cuts: MR -30/-50/-25, armor -50/-50/-25, and AD -10 / AP -55 / AP -40 |
| `edvamp` (6-10) | `edvamp2` | villains tagged `vampire-bride-bloody-crypt` get `vampire-bride-spawn-heart-at-pool`: heart spawns on tile 111/112 if free |

These are all 13 room scripts in the game's main bundles (only the chunks the home page loads were
checked; lazily loaded chunks could hold more). Every script has a `ROOM_SCRIPT_NOTES` entry.

The note text is hand-written (the scripts are minified code), so drift is checked two ways, both
using `mapsDatabase.extractRoomScripts` / `diffRoomScripts` and the `ROOM_SCRIPT_FINGERPRINTS`
block in `maps-database.js`. They report `NEW` (script with no note), `CHANGED` (a script's
numeric/string literals differ from the fingerprint stored when its note was reviewed) and
`REMOVED`:

- **Manual:** `node tools/check-room-scripts.mjs` downloads the game's chunks. Exit code 1 means
  review the flagged scripts, fix `ROOM_SCRIPT_NOTES`, then run it with `--update` to rewrite the
  fingerprint block; exit code 2 means the download or the extraction pattern failed (never read as
  OK).
- **Automatic, Firebase admins only:** `Mod_Settings.js` (`runAdminRoomScriptCheck`) runs the same
  check about 20 s after load, at most once per 24 h (`localStorage` key
  `ba-room-script-check-last`, stamped only after a completed check), and reports drift to the
  popup Error Log as source "Room script check". For each new set of problems (signature kept in
  `ba-room-script-check-reported`, so unchanged drift is not re-alerted daily) it also shows a toast
  and auto-downloads `room-script-report-<date>.txt` (`mapsDatabase.buildRoomScriptReport`), written
  as a self-contained task to paste to Claude: TASK, STEPS (which files to edit, the check/`--update`
  commands, patch notes), NOTE STYLE, PROBLEMS with an ADD / REWRITE / DELETE action each, one
  section per script (room usage, current note, fingerprints, the numbers and strings in the live
  source, the minified source) and all existing notes as a style reference. If the browser blocks the download, the toast points to
  the Error Log instead. Non-admins never run it or make the requests.

**Clot / Hemorrhage.** Hemorrhage is a Clot (`gameId` 127) placed by room `crhw`
(Halloween Mansion floors 6-10) as `{ id: 127, level: 125, nickname: "Hemorrhage" }`. Clone cap
(`o$` component, `skill.src: "summonslime"`):

```js
cap = MAX_SPAWN_COUNT + 1 + (owner.awaken ? AWAKEN_EXTRA_SPAWN : 0);  // 2 + 1 (+1)
if (owner.villany.wasSpawnVillain) cap += world._customRoomVariables.halloweenSlimeMaxSpawn;
if (original.hp.isAlive + original.spawnList.length >= cap) return;   // else spawnSlime()
```

Player-owned or ordinary-room Clot: 3 (4 awakened). Villain Clot in a `crhw2` room: 12 (13
awakened). Constants: `MAX_SPAWN_COUNT 2`, `AWAKEN_EXTRA_SPAWN 1`, `STARTING_HP 5`,
`BASE_COOLDOWN_MS 12000`, `CDR_PER_AP 80`. When the cap variable is `> 0`, each clone gets a random
T5 HP equipment piece instead of copying the mother's; clones killed under a villain mother bump
`world.killedClot`; an awakened mother's death promotes a living clone.

**Loader representation.** `BOSS_ALIAS_CREATURES` (`{ displayName, gameId: 127, baseSpecies:
'Clot', bossOnly: true }`) gives Hemorrhage its own Cyclopedia / picker entry.
`resolveCreatureDisplay()` reports `bossOnly: true`; boss entries never match owned monsters, have
no shiny variant, and count as event creatures. Cyclopedia shows Clot's species stats; the room's
level 125 and the cap rules are not modelled.

#### Map creature stats

An actor's stats are `scaledBaseStats[stat] = scaleStat({ stat: baseStats[stat], level, geneValue: genes[stat] })` (actor constructor, chunk 509; `state.utils.scaleStat`). Fitted constants: `ceil(stat*0.2 + stat*0.8*(level/50 + gene/20)/2)`. No map-only creature has stored stats: Map-only means a name in `UNOBTAINABLE_CREATURES`; there is no stored level list. The level is read at runtime from the highest-level room actor of that species (`getMapMonsterRoomLevel()`; no board, no scaling), and `getMapMonsterBaseStats()` scales the species `baseStats` at max genes (20) with no equipment, which is what Cyclopedia and the Lua export show.

Genes and equipment are not read because room actors only carry them optionally and the room data is not in the chunks (it only exists at runtime). A room can give its own copy different numbers, so these are not always what a creature has in a fight. Checked 2026-10-31 against the old stored totals: seven matched exactly (Old Giant Spider, Willi Wasp, Dead Tree, Earth/Magma Crystal, Morguthis, Grynch Clan Mastermind). The old totals that differed, now replaced by the formula, were: Rahemos (fits genes of about 24 on every stat), Regeneration Tank (HP exactly 2x), the four Tibian Legends (about 1.86x on every stat, so not equipment alone), and Cobra Statue, Dharalion, Energy Crystal, Obelisk, Omruc and Monster Cauldron (unexplained or partly gear). Multi-floor quest rooms also scale monsters +20% per floor.

#### Awakened ability availability

The Cyclopedia awaken button is data-driven (`isCreatureAwakenableName` in `creature-database.js`). A creature's ability is `skill.TooltipContent`, either `() => ...` (takes no props, so no awakened text) or `t => ...` (reads `awaken`). The button shows when the tooltip takes props, so Orshabaal and Monster Cauldron (and therefore Tentugly) have none. A boss alias is judged by its base species (`findMonsterByName` resolves it by `gameId`), so Hemorrhage follows Clot, whose tooltip also takes no props. Gazers, `EVENT_CREATURES` (non-alias) and `NON_AWAKENABLE_CREATURES` are still excluded by name: they have awaken-aware tooltips, but the loader treats them as not awakenable, and the game chunks hold no rule for it.

#### Other hidden game mechanics (chunk review, 2026-10-31)

Found by downloading every chunk in the build manifest (`/_next/static/<buildId>/_buildManifest.js`,
59 files including lazy page chunks) and searching the minified source. Re-verify after a game
update. Nothing here is read by a mod yet unless stated.

**Hidden pages.** The manifest lists these Next.js pages besides `/` and `/game`:

| Page | What it is | Loader use |
| --- | --- | --- |
| `/abilities` | "Abilities viewer" | Ability script data is already used for the Units / ability-CD previews |
| `/recolor` | "Color palette editor" with image import (drop zone, color filter) | none |
| `/seasons` | Season / rank-badge info page ("Awakening system", "Phoenix Evoker", "Challenger") | referenced by `Cyclopedia.js`, `Mod_Settings.js` |
| `/admin` | Server-gated admin tools (gift codes, create raid, highscore management, test accounts, revenue stats) | only the admin check in `Mod_Settings.js` / `firebase-admins.js`; do not call its endpoints |
| `/background`, `/iframe`, `/iframe-obs-2`, `/iframe-obs-3`, `/iframe-obs-4`, `/promo-chest`, `/promo-scroll` | embed, stream-overlay and promo pages | none |

The only non-tRPC `/api/` route found in the chunks is `/api/player-count`. The full tRPC procedure inventory (170 procedures) and the server-authoritative battle flow are in
"Game tRPC API" below.

**World state flags.** The world constructor (`979-*.js`) initializes, besides
`_customRoomVariables`:

```js
this.roomId = "";
this.killedGummy = 0;
this.killedClot = 0;
this.tentuglyTransformed = false;
this.wcEventWin = false;
this.grynchBAllyGoblinAchievement = false;
this.calculateExtraRankPoints = () => 0;
this.gameEndCondition = { villains: [], nonVillains: [] };
```

| Flag | Set by |
| --- | --- |
| `killedGummy` | `++` when a summoned Gummy dies |
| `killedClot` | `++` when a villain Clot clone dies (`o$` skill, see Hemorrhage above) or a villain `o3` Clot dies |
| `tentuglyTransformed` | `true` when Tentugly casts its transform |
| `grynchBAllyGoblinAchievement` | `true` when Grynch's mind control hits an actor on the other side from Grynch |
| `wcEventWin` | `true` when the World Cup event ends with the villain score at 0 |
| `calculateExtraRankPoints` | Replaced by one creature type to return the count of living spawn-villains carrying its misc tag; the result is added to the win's rank points |

No client code reads the five counters/booleans, so they are most likely checked server-side as
achievement conditions. This is inferred from the source, not confirmed in the live game. The
achievements UI exists (`trophyRoom` category `achievements`, text "Requires achievement").
`calculateExtraRankPoints` is read by the end-of-game handler, which sends
`rankPoints` and `readableGrade` in the `setState` victory/defeat event.

**World Cup event room.** `isEvent()` is true when `world.roomId` equals one fixed room id. In it
a scoreboard counts villain vs non-villain points, `buffTeam` is applied to the scoring side, and
the game ends with a "Red wins!" / "Green wins!" text on tile 82. Creatures tagged
`immuneToWcEventMindControl` ignore the event's mind control.

**Creature tags.** Set with `tags.add("...")` in the creature constructors. Counts are uses in
the bundle. None are referenced by the loader.

| Tag | Uses | Meaning (from context) |
| --- | --- | --- |
| `cantChangeVillany` | 34 | `villany.canChangeVillany` is false, so `villany.setVillain` cannot flip the creature to the other side |
| `shamanCantRevive` | 23 | verified: an Orc Shaman's revive on a kill skips a killed actor with this tag |
| `disableSkullHelmet` | 22 | verified: the Skull Helmet health-pool passive is disabled on the owner |
| `ghostCantRevive` | 17 | not verified: no `tags.has("ghostCantRevive")` reader found in the chunks; probably the ghost-revive equivalent of `shamanCantRevive` |
| `noImpactAnalyser` | 15 | not verified: summons such as Gummy carry it |
| `monsterCauldronShouldNotRevive` | 7 | verified: Tentugly's transform skips actors with this tag (no HP drain, no revive) |
| `noXPDrop` | 3 | gives no XP |
| `immuneToWcEventMindControl` | 3 | see World Cup event room |
| `playerMonster` | 2 | marks player-owned monsters; used to count living player creatures for rank points |
| `grynchObstacle`, `grynchBarrel`, `grynchGoblinGumslinger` | 1 each | Grynch encounter objects |
| `hitByWaterElementalBall`, `regenerationTank`, `obelisk`, `hasPaladinArmor`, `witch`, `witchHat`, `vampSlippers`, `wasp` | 1 each | per-creature bookkeeping |

**Tentugly floor effects.** When Tentugly transforms it creates four floor entities named
`tentuglyFloorA` to `tentuglyFloorD` on tiles 125, 126, 140 and 141. Their effect is not modelled
by the loader.

Transform (from the `ll` class in the game chunk): every enemy without the
`monsterCauldronShouldNotRevive` tag is, in turn, either dropped to 1 HP with true damage (only
when `world.floor > 0`) or, if dead, revived with 1 HP. It then summons tentacles around tile 129.
Tentugly is not a species: the game builds a Monster Cauldron (`gameId` 83, class `la` metadata)
and renames it to "Tentugly" at transform. The loader therefore lists it as a `BOSS_ALIAS_CREATURES`
entry (`baseSpecies: 'Monster Cauldron'`), so Cyclopedia shows the Cauldron's stats and abilities,
and its Special ability text comes from `CREATURE_ABILITY_NOTES` in `database/creature-database.js`.
Tentugly is no longer in `CYCLOPEDIA_HIDDEN_CREATURES`.

**Room-script check coverage gap.** `tools/check-room-scripts.mjs` (`loadChunks()`) scans only
chunk URLs found in the HTML of `/`. The build manifest lists more, including the large
`pages/game` and numbered chunks. The 13-script count above may be a lower bound. To widen the
scan, also read `_buildManifest.js` and rerun the tool.

#### Combat engine rules (chunk review, 2026-10-31)

Read from `509-*.js` (actor, HP, cooldown, movement, stun, modifier classes), `979-*.js` (world,
tick engine) and the shared constants module (`88057`, in `_app-*.js`). Minified names in
parentheses. Re-verify after a game update. Per-creature numbers are in
`CREATURE_COMBAT_DATA` in `database/creature-database.js` (see "Per-creature ability constants" below).

**Time.** 1 tick = 62.5 ms (`Qb`, 16 ticks/s). `ms -> ticks = round(0.016 * ms)` (`HX`),
`ticks -> ms = round(62.5 * ticks)` (`aD`). A battle ends in a draw at `maxDurationTicks = 1440`
(`V7`, 90 s). Win check (`getWinner`, run every tick): players win if every villain is dead (checked
first, so a simultaneous wipe is a player win); villains win if every player unit is dead **or**
`tick >= maxDurationTicks`. So timing out is a loss, not a separate draw result. The world also has
`serverPlay()`, which loops `_advanceTick()` until a winner exists and returns
`{ villainsWon, ticks, draw, crash }` (an exception counts as a villain win with `crash: true`).
That is the same engine running headless, which is how the server reproduces a battle from its
seed. Each tick the world pops scheduled actions,
dispatches queued events, then calls `notifyTick` on every entity. If the timer runs late, the tick
engine replays the missed ticks (`floor(lag / interval)`) before scheduling the next one, so
results do not depend on frame rate. The RNG is `xoroshiro128plus(seed)`; helpers are `dice.d6/d10/d20`,
`advantageRoll`, `shuffle`, `sampleFrom`.

**Grid.** The world is 15 x 11 (`YO`); the playable area is 10 x 10 starting at x=2, y=0 (`t0`).
Neighbours are 8-directional. Range distance is Chebyshev (`max(|dx|, |dy|)`). Pathfinding is A*
with cost 1 for cardinal and sqrt 2 for diagonal steps and a Manhattan heuristic. A path counts as
found once the goal is within the wanted range.

**Tier enum** (`Vf`): `STARS_0..STARS_4` = 0-4, `SEALED_5` = 5, `AWAKEN_6` = 6. Level caps by tier:
30 / 35 / 40 / 45 / 50 / 50 / 99. Genes range 1-20 per stat. Max level is 99. `hundo` = total
genes >= 100 **and** tier `AWAKEN_6` **and** level >= 99.

**Stat scaling** (`sn`), with `maxLevel = 50` even for levels above 50:

```js
scaled = ceil(stat * 0.2 + stat * 0.8 * (level / 50 + gene / 20) / 2)
```

So a level-99, gene-20 monster scales to about 1.99x the base stat. `speed` and `attackDelayTicks`
are **not** scaled. A villain's `floorGeneMultiplier = genes.ap / 20`.

**Stat modifiers** (`14973`, used by `ad`, `ap`, `attackDelay`, `armor`, `magicResist`, `speed`,
`lifesteal`). Flat and percentage modifiers are kept separately:

```js
value = round(flat) + round(flat) * percent        // then clamped to min / max
percent = r2(1 - prod(1 - p for p > 0)) - r2(1 - prod(1 - |p| for p < 0))   // r2 = round to 2 dp
```

Positive and negative percentages each combine multiplicatively (diminishing returns), then are
subtracted. A percentage below -1 throws. Min values: `ad` 0, `ap` 0, `armor` 0, `magicResist` 0,
**`attackDelay` 3 ticks (187.5 ms)**. Default attack delay is `mL = 2000 ms` (32 ticks) when a
creature's metadata sets none. Because armor and MR are floored at 0, negative resist never
amplifies damage.

**Damage** (`HP.calculateAppliedDamage`):

```js
if (type !== "trueDamage") dmg *= 100 / (100 + (type === "physical" ? armor : magicResist));
dmg = max(floor(dmg), 0)              // 0 damage is a no-op; HP floors at 0
```

Damage types are `physical`, `magic`, `trueDamage`. Each armor/MR point is worth `1/(1+x/100)`, so 100
armor halves physical damage. Healing is `floor(abs(points))`, capped at `max - hp`, and runs
through the before-healing hooks. Lifesteal is `lifesteal.currentValue / 100`.

**Damage hooks.** `addOnBeforeApplyingDamage({ fn, priority })` handlers run highest priority first and
each can rewrite the damage. The named priorities (`l` table) show the exact order the game resolves
effects in:

| Priority | Names |
| --- | --- |
| 100 | `RAHEMOS_PEACE`, `VLADRUKH_DMG_CAP` |
| 90 | `GOLDEN_ARMOR_ZHONYA` |
| 62 / 61 | `BEHEMOTH_DMG_REDUCTION` / `AMAZON_ARMOR_BLOCK` |
| 60 | `BAT_INVULNERABILITY`, `DODGE` |
| 50 | `NIGHTSTALKER_INVULNERABILITY`, `GRYNCH_REFLECT_IMMUNITY`, `GRYNCH_BARREL_AOE`, `WILLI_WASP`, `ECTOPLASMIC_SHIELD`, `YETI_AUTO_ATTACK_SNOW`, `GREEN_DJINN_JAR`, `GHOST_AWAKEN_CHANNEL` |
| 10 | `AMAZON_HELMET_REDUCTION` |
| 5 | `CORYM_VANGUARD_PASSIVE`, `DWARF_GUARD_PASSIVE`, `DEMON_ARMOR_REDUCTION` |
| -99 | `ORC_BERSERKER_AWAKEN_IMMORTALITY` |
| -100 / -101 | `AMULET_OF_LOSS` / `DEMON_NON_FATAL` |

Before-healing hooks have one named priority: `50_REDUCE_HEAL`. Dodge runs before every other
50-or-lower effect, and Amulet of Loss runs after everything else, so it sees the final damage.
Kill credit (`participation`) lasts 8000 ms (128 ticks) after the last damaging hit.

**Cooldowns** (`40159`). A cooldown counts down by 1 per tick and can only be refreshed to a
higher value (`addNonStackingCooldown`). `setBaseCooldown(n)` keeps the same fraction of the cooldown
remaining. Every actor has `cooldown.autoAttack`, whose base follows `attackDelay`. The ability
cooldown is a separate `abilityCooldown`. Creatures built on the common pattern (seen in the Orc
Leader-style classes; not checked for all 135) rebuild its base on every cooldown-reduction update
as `max(COOLDOWN_MS_in_ticks * percentageBasis + flatTicks, MIN_COOLDOWN_TICKS)`. That is how
equipment CDR and `CDR_PER_AP` apply.

**Walking** (`61256`). Step time depends on the speed stat `s`:

```js
e = s > -261.29 ? max(floor(857.36 * ln(s / 2 + 261.29) - 4794.51), 1) : 1;
stepMs = floor(100000 / e);            // walk cooldown = round(0.016 * stepMs) ticks
```

Example (computed from the formula): speed 100 -> 787 ms per step, about 1.27 steps/s. A diagonal step doubles the walk
cooldown. Wander cooldown is `walk cooldown * 2`. Idle wandering picks a random cardinal neighbour.
`Map_Editor.js` already has this formula (`nativeWalkCooldownTicksFromSpeed`).

**Targeting and the attack loop.** Each tick a living, non-stunned actor runs its `onTick`: with
a target, it attacks if the auto-attack cooldown is ready and the target is in range, otherwise it
walks toward it; with no target it asks `targetSelection.tryFindTarget()`, and if that finds
nothing and it can wander, it wanders. Default selection (`findByDistance`, criteria
`"closest"`) takes enemies that are alive, **not invisible**, and reachable by path within range,
sorted by **Euclidean** distance (nearest first). `"farthest"` takes the last. `findByHPPercent`
(`"lowest"` / `"highest"`) sorts by HP fraction, then distance. Target selectors can be stacked with
priorities (`ELVISH_BOW` 10, `CYC_DRONE_JUMP_TARGET` 1, `ANNI_MINO_MAGE` 1, `DEFAULT` 0).
While mind-controlled, an actor runs the mind-control effect's `onTick` instead of its own.

**Stun** (`40589`). A non-stacking cooldown: a new stun only matters if it is longer than what is
left. A stunned actor skips `onTick` entirely, but its cooldowns and passives keep ticking
(`notifyTick` still runs). `setIgnoreStun(fn)` registers immunities; an ignored stun fires
`onStunIgnored` instead.

**Other actor status components.** `invisibility` (counted stack; enemy targeting skips invisible
actors), `silenced` (counted), `cantBeDisplaced` (stack), `mindControl` (immunity list; an actor
cannot control itself), `setAwaken` / `setTempAwakenModifier` (stacked temporary awaken, so effects
can wake a unit for part of a fight). The actor event list shows which status effects exist:
`onSlow`, `onPoison`, `onBuff`, `onDebuff`, `onDisarmed`, `onHealReduction`, `onDisplaced`.

**Per-creature ability constants.** The chunk holds 135 creature metadata entries (119 have a
`gameId`; the rest are summons such as Larva or Bat), plus event variants written as
`{...Base, queryTags:[..., "event"], skill:{...}}` (Clot = Slime, Reindeer = Deer B, Dwarf
Merrymancer, Gummy Raider). A variant inherits its base's numbers and overrides those its own
tooltip reads; its id comes from its own `name` or the first creature name its tooltip prints.
The snapshot has 126 creatures. Still missing: Chubby / Spiky / Psychic / Sturdy / Mystic Gazer and
Football Elemental (their metadata is not in either shape the tool reads). For each, the numbers its ability tooltip
reads (cooldowns, durations, damage bases, AP ratios, caps) are stored in the `CREATURE_COMBAT_DATA`
snapshot in `database/creature-database.js`, keyed by `gameId`. Only plain numbers are kept (nested
tables such as `EXORI_CD_MS`, fractions and references are skipped). `*_TICKS` constants are stored
in ms under a `*_MS` name. `ad: null` means the 2000 ms default attack delay. Ranges the tooltip
does not print (`rangeComponent.range`) are not included. A second `Minotaur Archer` entry differs
from the first; only the first is kept.

- Read it with `creatureDatabase.getCreatureCombatData(gameId)` ->
  `{ name, attackDelayMs, constants }` or `null`.
- The Cyclopedia creature page uses it for a title-bar toggle button (same style as the shiny / old
  sprites buttons, green when on) beside the creature name, which swaps the stat bars for the combat
  numbers (the choice is kept across creatures; the button is not shown when the snapshot has no
  entry). The numbers are grouped into Basics / Ability / Timing / Awakened sections, and all times
  show in seconds by default (a Seconds/Ticks button in the Basics heading switches; state is
  `cyclopediaState.combatTimeUnit`, also used by the hover text). The stat bars also get
  hover text: armor / magic resist show the share of damage taken, speed shows ticks per step, and
  Attack Damage shows attack delay and DPS (damage per second). Those use the live
  `metadata.baseStats` (including `attackDelayTicks`), not the snapshot.
- The ability constants are **not** exposed by the game API, only by the chunk. After a game update
  run `node tools/check-creature-combat.mjs` (exit 1 on `NEW` / `CHANGED` / `REMOVED`, exit 2 on a
  download or parsing failure) and `--update` to rewrite the block. Unlike the room-script check,
  it has no automatic admin run in `Mod_Settings.js`.

**Reading the stats in a mod.** The stat half is available at runtime:
`state.utils.getMonster(id).metadata.baseStats` (includes `speed` and `attackDelayTicks`).

### `window.equipmentDatabase`

Source: `database/equipment-database.js`.

Data:

- `ALL_EQUIPMENT` — every equipment item (`{ gameId, ...item }`).
- `EQUIPMENT_BY_STAT` — `{ ad, ap, hp, armor, magicResist }`. Catalog items carry no fixed stat
  (stat lives on owned equips), so these are normally empty.
- `HARDCODED_BOOSTED_MAP` — equipment name → comma-separated map display names where it can be
  boosted. Used by `Better_Boosted_Maps`.
- `EVENT_EQUIPMENT`
- `EQUIPMENT_TIER_STAT_BONUSES`, `EQUIPMENT_TIER_COLOR_BY_NUMBER`, `DEFAULT_EQUIPMENT_EFFECT_TIER`

Functions: `getAllEquipment()` (raw uncached scan), `getEquipmentNameMap()` (cached lowercase name →
`{ gameId, item }`), `isEventEquipmentName(name)`, `getBisProgressEquipmentNames()`,
`getEquipmentCdrPercentByGameIdMap()`, `getEquipmentCooldownReductionPercent(...)`,
`clampEquipmentTier(tier)` (1–5), `getEquipmentTierColorLabel(...)`,
`mountEquipmentEffectComponent(...)` (see [game_state_api.md](game_state_api.md)).

**Used by**

- `Better_Boosted_Maps` (`HARDCODED_BOOSTED_MAP`, `ALL_EQUIPMENT`)
- `Autoseller` (`ALL_EQUIPMENT`)
- Also `Better_Analytics`, `Better_Exaltation_Chest`, `Better_Forge`, `Cyclopedia`, `Mod_Settings`, `Map_Editor`

### `window.playerEquipmentDatabase`

Source: `database/playereq-database.js`.

- `EQUIPMENT_BY_SLOT` — equipment grouped by slot. Placeholder has the slot keys with empty arrays.
  Reuses `equipmentDatabase.getAllEquipment`. Read by `Guilds.js`.

**Used by**

- `Guilds` (`EQUIPMENT_BY_SLOT`)

### `window.mapsDatabase`

Source: `database/maps-database.js`.

Static snapshots (built at load; prefer the getters): `ALL_MAPS`, `RAID_MAPS`, `NON_RAID_MAPS`,
`MAPS_BY_DIFFICULTY` (`{1,2,3}`), `MAP_EXPANSIONS`, `DIFFICULTY_LABELS`, `EVENT_TO_ROOM_MAPPING`,
`MAP_ORDER_UNKNOWN`.

Rooms and filters:

- `getAllMaps()`, `getMapById(id)`, `getMapIdByDisplayName(name)` → id or `null`
- `getMapsByDifficulty(d)`, `getMapsByMaxTeamSize(n)`, `getMapsByStaminaCost(n)`
- `getRaidMaps()`, `getNonRaidMaps()`, `isRaid(mapId)`, `isMapRaidComprehensive(mapId)`,
  `isDynamicEventMap(mapId)`, `getMapType(mapId)` → `'raid' | 'event' | false`
- `getDifficultyLabel(d)`

Board monsters (see [game_state_api.md](game_state_api.md) for the floor rules):

- `getMultiFloorRoomIds()` → `string[]`, live scan of `state.utils.ROOMS`.
- `getBoardMonstersForFloor(roomId, floorIndex = 0)` → board pieces (`villain: true`, `gameId`, `level`, ...).
- `getFloorCreatureGameIds(roomId, floorIndex = 0)` → `Set<number>`: board villains on that floor plus
  its drop-only creatures (`getExtraMonsterDropGameIds(roomId, floorIndex)`), deduplicated.
- `getBoardMonsterGameIds({ includeRaids = false, includeDrops = false })` → `Set<number>`; empty
  while room data is not loaded. `includeDrops` adds `extraMonsterDrops`.
- `getExtraMonsterDropGameIds(roomOrId, floorIndex?)` → `number[]` of drop-only creatures (may
  contain duplicates across floors). With `floorIndex`, the room's own drops plus that floor's
  `floorRules[floorIndex]`; without it, the room's own drops plus every floor's.
- `getExtraMonsterDropFloors(roomOrId, gameId)` → `null` when the room itself lists the creature
  (every floor), else the 0-based `floorRules` indices that list it (`[]` = does not drop here).

Regions and ordering:

- `getRegionsInOrder()`, `getRegionDisplayName(regionId)`, `getRegionDisplayNameFromRegion(region)`
- `getRegionRune(...)`, `getExpansionMapIds(...)`, `getExpansionNameForMapId(mapId)`,
  `getExpansionForRegion(...)`
- `getCanonicalTableRowOrder()`, `buildMapOrderIndex()`, `getMapOrderIndex(mapId)`,
  `compareMapsByGameOrder(a, b)`

**Used by**

- `Autoseller` (`getBoardMonsterGameIds`, `getExtraMonsterDropGameIds`)
- `Awaken_Tracker` (`isRaid`, `getFloorCreatureGameIds`, `getExtraMonsterDropGameIds`, `getBoardMonstersForFloor`)
- `Better_Tasker` (`getBoardMonsterGameIds`, `getBoardMonstersForFloor`, `getMultiFloorRoomIds`, `getMapById`)
- `Raid_Hunter` (`getRegionDisplayName*`, `EVENT_TO_ROOM_MAPPING`)
- `Better_Boosted_Maps` (`getRegionDisplayName*`)
- Also `Battle_Helper`, `Better_Setups`, `Better_Teleporter`, `Cyclopedia`, `Hunt_Analyzer`, `Mod_Settings`, `RunTracker`, `Stamina_Optimizer`, `Challenges`, `Map_Editor`, `Highscore_Improvements`, `Usage_List`

### `window.inventoryDatabase`

Source: `database/inventory-database.js`.

Data tables: `tooltips`, `categories`, `variants`, `staticItems`, `upgradeableItems`, `rarityText`,
`rarityGameText`, `rarityColors`, `itemKeyGroups`, `itemKeyAliases`, `gameDisplayNames`,
`nameAliases`, `tierLabels`, `miniIcons`, `customStyles`, `gazerVariants`, `runeKeysOrder`,
`runeNonSacrificableKeys`.

Functions: `resolveItemKey(...)`, `findItemKey(...)`, `findItemKeyByIcon(...)`,
`getInventoryItemCount(...)`, `getRuneType(...)`, `getRuneTypes()`, `getRecyclableRuneTypes()`.

`window.inventoryTooltips` is kept for backward compatibility (same data as `tooltips`).

**Used by**

- `Autoscroller`, `Better_Rune_Recycler`, `Cyclopedia`, `Depot_Manager`, `Hunt_Analyzer`, `Bestiary_Automator`

## Utility Functions

This document describes the utility functions available through the Mod Loader API for working with Bestiary Arena game data. The utility was made by [Mathias Bynens](https://github.com/mathiasbynens).

### Overview

The utility functions provide a standardized way to:
- Convert between region/map/monster/equipment names and IDs
- Manipulate game state (force seeds, configure boards)
- Serialize and replay board configurations

### Accessing the Utility Functions

The utility functions are available through the `BestiaryModAPI.utility` object:

```javascript
// Example: Serializing the current board
const boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
console.log('Current board data:', boardData);

// Example: Replaying a board configuration
window.BestiaryModAPI.utility.replay(boardConfig);
```

To ensure the utility functions are available before using them, you can wait for the `utility-api-ready` event:

```javascript
document.addEventListener('utility-api-ready', () => {
  console.log('Utility API is ready');
  
  // Now you can safely use the utility functions
  const maps = window.BestiaryModAPI.utility.maps;
  // ...
});
```

### Available Functions

#### `serializeBoard()`

Serializes the current board state into a JSON string that can be used with `replay()` or `configureBoard()`.

**Returns:** A JSON string representing the board configuration.

```javascript
// Get the board as a JavaScript object
const boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
```

#### `replay(config)`

Replays a board configuration, optionally with a specific seed.

**Parameters:**
- `config`: An object containing:
  - `region`: The region name (e.g., 'Rookgaard')
  - `map`: The map name (e.g., 'Goblin Camp')
  - `board`: An array of piece configurations
  - `seed` (optional): A specific seed to use for the replay

```javascript
window.BestiaryModAPI.utility.replay({
  region: 'Rookgaard',
  map: 'Goblin Camp',
  seed: 12345,
  board: [
    {
      tile: 7,
      monster: {
        name: 'troll',
        hp: 10,
        ad: 5,
        ap: 0,
        armor: 2,
        magicResist: 0,
        level: 5  // Monster level (will be converted to experience)
      },
      equipment: {
        name: 'axe',
        stat: 'ad',
        tier: 2
      }
    }
    // ... more pieces
  ]
});
```

#### `configureBoard(config)`

Sets up the board based on a given configuration. Similar to `replay()` but without forcing a seed.

**Parameters:**
- `config`: The board configuration object (same as for `replay()`)

#### `forceSeed(seed)`

Forces the game to use a specific seed for random number generation.

**Parameters:**
- `seed`: The numeric seed to use

#### `removeSeed()`

Removes a previously forced seed, allowing the game to use random seeds again.

#### Level and Experience Functions

These utility functions are available through the game state utility:

```javascript
// Calculate experience points needed for a specific level
const expForLevel5 = globalThis.state.utils.expAtLevel(5);
console.log(expForLevel5); // 11250

// Calculate level based on experience points
const levelForExp = globalThis.state.utils.expToCurrentLevel(440425);
console.log(levelForExp); // 25
```

**Note:** When serializing or configuring the board, monster levels are automatically converted to the appropriate experience points.

### Available Maps

The utility functions also provide access to various mapping objects through `BestiaryModAPI.utility.maps`:

#### Region Maps
- `regionNamesToIds`: Maps region names to their internal IDs
- `regionIdsToNames`: Maps region IDs to their display names

#### Map Maps
- `mapNamesToIds`: Maps map names to their internal IDs
- `mapIdsToNames`: Maps map IDs to their display names

#### Monster Maps
- `monsterNamesToGameIds`: Maps monster names to their game IDs
- `monsterGameIdsToNames`: Maps monster game IDs to their names

#### Equipment Maps
- `equipmentNamesToGameIds`: Maps equipment names to their game IDs
- `equipmentGameIdsToNames`: Maps equipment game IDs to their names

### Example Usage

Here's a complete example of using the utility functions in a mod:

```javascript
// Wait for the utility API to be ready
document.addEventListener('utility-api-ready', () => {
  console.log('Utility API is ready');
  
  // Get the equipment ID for a sword
  const swordId = window.BestiaryModAPI.utility.maps.equipmentNamesToGameIds.get('sword');
  console.log('Sword ID:', swordId);
  
  // Serialize the current board
  const boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
  console.log('Current board:', boardData);
  
  // Save the board data to be replayed later
  localStorage.setItem('saved_board', JSON.stringify(boardData));
  
  // Create a replay function
  const replaySavedBoard = () => {
    const savedBoard = JSON.parse(localStorage.getItem('saved_board'));
    if (savedBoard) {
      window.BestiaryModAPI.utility.replay(savedBoard);
    }
  };
  
  // Add a button to replay the saved board
  api.ui.addButton({
    id: 'replay-button',
    text: 'Replay Saved Board',
    onClick: replaySavedBoard
  });
});
``` 

## Events and Listeners

The game uses XState under the hood, providing a powerful event system for monitoring and interacting with game state.

### Basic Event Subscription

```javascript
// Listen for board state changes
globalThis.state.board.on("before-game-start", (event) => {
  console.log("Game about to start:", event);
  // Custom code here
});
```

### Inspecting State Transitions

```javascript
// Monitor all state transitions (useful for debugging)
globalThis.state.board.inspect(console.log);

// Sample output of events:
/*
{
  actorRef: {sessionId: 'wrcv0mf', ...},
  event: {type: 'autoSetupBoard', setup: Array(1)},
  rootId: "wrcv0mf",
  sourceRef: undefined,
  type: "@xstate.event"
}
*/
```

### Common Event Types

The game uses several standard action types:

- `@xstate.init` - Initialization event when a state machine starts
- `setState` - Updates state context properties
- `setPlayMode` - Changes game mode (sandbox, autoplay, manual)
- `autoSetupBoard` - Places game pieces on the board
- `selectRoomById` - Selects a specific map/room

### Subscription to Game State

```javascript
// Subscribe to all state changes
const subscription = globalThis.state.board.subscribe((state) => {
  console.log("Board state changed:", state);
});

// Unsubscribe when finished
subscription.unsubscribe();
```

### Checking State Machine Status

```javascript
// Get current state information including active state
const snapshot = globalThis.state.board.getSnapshot();
console.log(snapshot.status); // 'active' or other status

// Get context data (contains most game state)
console.log(snapshot.context);
```

### Listening for New Raids

The raids component allows you to listen for new raid events:

```javascript
// Listen for new raids
const unsubscribe = globalThis.state.raids.on("newRaid", (e) => {
  // Will execute every time a new raid appears
  console.log("new raid", e.raid);
});

// Unsubscribe when finished
unsubscribe();
```

## Client Configuration

The clientConfig component allows you to customize various client-side behaviors and filters.

### Customizing Dragon Plant Monster Filter

You can customize which monsters are automatically sold when using the Dragon Plant feature:

```javascript
// Set a custom monster filter
globalThis.state.clientConfig.trigger.setState({
  fn: (prev) => ({
    ...prev,
    plantMonsterFilter: (monster) => {
      // If you want to sell the creature, return TRUE
      // If you want to keep it, return FALSE

      if (monster.totalGenes < 95) return true;
      if (monster.metadata.name === "Orc Spearman") return true;

      return false;
    },
  }),
});

// Remove any custom filter (use default behavior)
globalThis.state.clientConfig.trigger.setState({
  fn: (prev) => ({ ...prev, plantMonsterFilter: undefined }),
});

The `monster` argument commonly includes:

```javascript
{
  id, gameId, createdAt, exp, tier, shiny, hundo, locked, hidden, level,
  genes: { hp, ad, ap, armor, magicResist },
  totalGenes, rarityLevel, isExpCapped,
  metadata: {
    name, roles, queryTags, lookType, spriteId, corpseId,
    portraitTranslate, bloodColor, baseStats, skill
  }
}
```

To always keep Sealed creatures (tier 5):

```javascript
globalThis.state.clientConfig.trigger.setState({
  fn: (prev) => ({
    ...prev,
    plantMonsterFilter: (monster) => {
      // Keep Sealed creatures
      if (monster.tier === 5) return false;

      // Sell/devour everything else
      return true;
    },
  }),
});
```

### Customizing Autoplay Delay

You can customize the delay between autoplay actions:

```javascript
// Set autoplay delay to 0ms (instant)
globalThis.state.clientConfig.trigger.setState({
  fn: (prev) => ({
    ...prev,
    autoplayDelayMs: 0
  }),
});
```
```

## Advanced Use Cases

### Forcing a Specific Seed

```javascript
// Force a specific seed for testing or replay
globalThis.state.board.send({
  type: "setState",
  fn: (prev) => ({ ...prev, customSandboxSeed: -876305199 }),
});
```

### Custom Board Setup

```javascript
// Place custom entities on the board
globalThis.state.board.send({
  type: "setState",
  fn: (prev) => ({
    ...prev,
    boardConfig: [
      {
        type: "custom",
        nickname: null,
        equip: { stat: "ap", tier: 2, gameId: 8 },
        gameId: 9,
        tier: 3,
        genes: {
          hp: 1,
          magicResist: 1,
          ad: 1,
          ap: 1,
          armor: 1,
        },
        villain: true,
        key: "unique-arbitrary-key",
        level: 15,
        direction: "west",
        tileIndex: 40,
      },
      {
        type: "custom",
        nickname: "Custom Nickname",
        equip: { stat: "hp", tier: 2, gameId: 4 },
        gameId: 8,
        tier: 3,
        genes: {
          hp: 1,
          magicResist: 1,
          ad: 1,
          ap: 1,
          armor: 1,
        },
        villain: false,
        key: "unique-arbitrary-key-2",
        level: 999,
        direction: "east",
        tileIndex: 23,
      },
    ],
  }),
});
```

### Listening for Game Events

```javascript
// Listen for new game events and access the world object
globalThis.state.board.on('newGame', (event) => {
    console.log('New game started with seed:', event.world.RNG.seed);
    console.log('World object:', event.world);
});
```

You can also listen to game events and subscribe to world events:

```javascript
const listener = globalThis.state.board.on("newGame", (game) => {
  console.log(game.world); // this is the game object

  game.world.grid.onActorDeath.subscribe((event) => {
    console.log(`Actor died: ${event.killedActor.name}`);
  });

  game.world.onGameEnd.once(() => {
    listener.unsubscribe(); // unsubscribe
  });
});
```

The board also emits specific events for game start and end:

```javascript
// Listen for game start event
globalThis.state.board.on('emitNewGame', (event) => {
    console.log('Game started:', event);
    // Handle game start logic
});

// Listen for game end event
globalThis.state.board.on('emitEndGame', (event) => {
    console.log('Game ended:', event);
    // Handle game end logic
});
```

### Monitoring Game Timer

```javascript
// Track game ticks and results
globalThis.state.gameTimer.subscribe((data) => {
  const { currentTick, state, readableGrade, rankPoints } = data.context;
  console.log(`Current tick: ${currentTick}`);
  
  if (state !== 'initial') {
    console.log(`Game ended with grade: ${readableGrade}`);
    console.log(`Rank points: ${rankPoints}`);
  }
});
```

## Limitations and Considerations

- **State Mutations**: Always use the proper state update patterns (creating new objects rather than mutating existing ones) to ensure state updates work correctly.
- **Timing**: State updates may not be immediate due to the asynchronous nature of state machines.
- **Browser Compatibility**: Some advanced techniques may not work in all browsers.
- **Game Updates**: The state structure and API may change with game updates.
- **Performance**: Be cautious with extensive state monitoring which can impact performance.
- **Sandbox Mode**: Most state modifications only work properly in sandbox mode to prevent cheating in normal gameplay.
- **XState Version 3**: The game has been upgraded to use XState v3, which may introduce breaking changes in the API. If your mods stop working, check for compatibility issues.

## Integration with Client API

The Game State API works seamlessly with the [Client API](client_api.md). While the Client API provides high-level functions for common tasks, the Game State API gives you direct access to the underlying state for more advanced operations.

```javascript
// Example of using both APIs together
function setupCustomBoard() {
  // Use Client API to show a loading modal
  api.showModal({
    title: 'Loading',
    content: 'Setting up custom board...'
  });
  
  try {
    // Use Game State API for direct state manipulation
    globalThis.state.board.send({ type: "setPlayMode", mode: "sandbox" });
    
    // More state manipulation...
    
    // Use Client API again to notify completion
    api.showModal({
      title: 'Success',
      content: 'Custom board setup complete!',
      buttons: [{ text: 'OK', primary: true }]
    });
  } catch (error) {
    console.error('Error setting up board:', error);
  }
}
``` 