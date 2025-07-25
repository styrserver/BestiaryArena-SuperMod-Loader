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
  utils: {
    /* Utility functions and constants */
  },
};
```

Each component (except `utils`) follows a similar structure with these methods:

- `getSnapshot()` - Returns the current state
- `getInitialSnapshot()` - Returns the initial state
- `on(eventName, callback)` - Subscribe to state events
- `send(action)` - Send actions to modify state
- `subscribe(callback)` - Subscribe to state changes
- `inspect(callback)` - Monitor all state transitions and events

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