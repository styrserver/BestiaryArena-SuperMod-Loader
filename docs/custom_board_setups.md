# Bestiary Arena Mod Loader - Custom Board Setup Examples

This document provides examples of how to use the new features introduced in the recent update to the Bestiary Arena Mod Loader, including custom board entity placement, accessing room data, and listening for game events.

## Accessing Room and Region Data

The game now exposes complete room and region data through the utils object:

```javascript
// Access all room data
const rooms = globalThis.state.utils.ROOMS;
console.log('All rooms:', rooms);

// Access all region data
const regions = globalThis.state.utils.REGIONS;
console.log('All regions:', regions);

// Get room IDs and names (still available)
const roomIds = globalThis.state.utils.ROOM_ID;
const roomNames = globalThis.state.utils.ROOM_NAME;
```

### Room Data Structure

The `ROOMS` array contains objects with the following structure:

```javascript
// Example of a room structure
const roomExample = {
  "id": "rkswrs",                // Unique room identifier
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
        ],
        // More tiles...
      ],
      "floorBelowTiles": [],    // Lower level tiles
      "actors": [               // NPCs and enemies
        {
          "id": 1,
          "direction": "west",
          "level": 10
        },
        null,
        // More actors...
      ],
      "hitboxes": [             // Collision information
        true, true, false, true, // ...etc
      ],
      "blocked": []             // Blocked positions
    }
  },
  "difficulty": 1,             // Room difficulty (1-5)
  "maxTeamSize": 1,            // Maximum player team size
  "staminaCost": 3             // Stamina cost to play
};
```

### Region Data Structure

The `REGIONS` array contains objects with the following structure:

```javascript
// Example of a region structure
const regionExample = {
  "id": "rook",                // Region identifier
  "minimapOffset": "-330px -1230px", // Position on minimap
  "rooms": [                   // Rooms in this region
    {
      "id": "rkswrs",
      "file": {
        "name": "rookgaard-sewers",
        "data": {} // Same structure as above
      },
      "difficulty": 1,
      "maxTeamSize": 1,
      "staminaCost": 3
    },
    // More rooms...
  ]
};
```

## Getting Board Setup from Room ID

You can now get the initial board setup for any room using the new utility function:

```javascript
// Get the board setup for a specific room
const abbaneSetup = globalThis.state.utils.getBoardMonstersFromRoomId('abbane');
console.log('Abbane board setup:', abbaneSetup);

// The output format looks like this (example for "rkswrs"):
const sewersSetup = globalThis.state.utils.getBoardMonstersFromRoomId('rkswrs');
// Returns:
[
    {
        "type": "file",        // Source type (vs "custom" for custom entities)
        "key": "D_9b",         // Unique identifier
        "tileIndex": 85,       // Position on the board
        "villain": true,       // Whether it's an enemy (true) or ally (false)
        "gameId": 1,           // Monster type ID
        "direction": "west",   // Facing direction
        "level": 10,           // Monster level
        "tier": 0,             // Monster tier
        "equip": null          // Equipment (null if none)
    }
    // More monsters may be included
]

// Apply this setup to the current board
globalThis.state.board.send({
  type: "setState",
  fn: (prev) => ({
    ...prev,
    boardConfig: globalThis.state.utils.getBoardMonstersFromRoomId('abbane'),
  }),
});
```

This is useful for creating mods that let players practice specific rooms or for creating custom scenarios based on existing rooms.

## Custom Board Entity Placement

The new update allows you to place custom entities on the board with full control over their properties:

```javascript
// Place custom entities on the board
globalThis.state.board.send({
  type: "setState",
  fn: (prev) => ({
    ...prev,
    boardConfig: [
      {
        type: "custom", // This is the key that enables custom entity placement
        nickname: "Super Monster", // Custom name (optional)
        equip: { 
          stat: "ap", // Stat type: "ap", "ad", or "hp"
          tier: 2,    // Equipment tier (1-5)
          gameId: 8   // Equipment type ID
        },
        gameId: 9,    // Monster type ID
        tier: 3,      // Monster tier (1-5)
        genes: {      // Stat modifiers
          hp: 1,
          magicResist: 1,
          ad: 1,
          ap: 1,
          armor: 1,
        },
        villain: true, // Enemy or ally
        key: "unique-key-1", // Must be unique
        level: 15,    // Monster level (experience is calculated automatically)
        direction: "west", // Facing direction ("north", "east", "south", "west")
        tileIndex: 40, // Board position (0-63 for standard 8x8 boards)
      },
      // You can add multiple entities
      {
        type: "custom",
        nickname: "Custom Friend",
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
        villain: false, // Friendly unit
        key: "unique-key-2",
        level: 500,    // Very high level monster
        direction: "east",
        tileIndex: 23,
      },
    ],
  }),
});
```

When setting up custom entities, you can specify the monster's level directly using the `level` property. The game will automatically calculate the appropriate experience points for that level using `globalThis.state.utils.expAtLevel(level)`. This is useful for creating specific training scenarios or challenges with precise level requirements.

This opens up many possibilities for custom scenarios, challenges, and training setups.

## Listening for Game Events

You can now listen for new game events and access the current world object:

```javascript
// Listen for new game events
globalThis.state.board.on('newGame', (event) => {
    // Access the game seed
    console.log('New game started with seed:', event.world.RNG.seed);
    
    // Access the entire world object
    console.log('World object:', event.world);
    
    // You can use this to analyze the game state
    // or modify it as needed
});
```

This is useful for mods that need to track game progress, analyze the game state, or make modifications at the start of a new game.

## Complete Example: Custom Room Creator

Here's a complete example of a mod that creates custom room setups:

```javascript
// Custom Room Creator Mod
console.log('Custom Room Creator initializing...');

// Configuration
const defaultConfig = {
  customRooms: {
    myRoom1: {
      name: "Boss Rush",
      entities: [
        {
          type: "custom",
          nickname: "Boss 1",
          equip: { stat: "ap", tier: 4, gameId: 8 },
          gameId: 9,
          tier: 5,
          genes: { hp: 2, magicResist: 2, ad: 2, ap: 2, armor: 2 },
          villain: true,
          key: "boss-1",
          level: 50,
          direction: "south",
          tileIndex: 10,
        },
        {
          type: "custom",
          nickname: "Boss 2",
          equip: { stat: "ad", tier: 4, gameId: 3 },
          gameId: 12,
          tier: 5,
          genes: { hp: 2, magicResist: 2, ad: 2, ap: 2, armor: 2 },
          villain: true,
          key: "boss-2",
          level: 50,
          direction: "south",
          tileIndex: 13,
        }
      ]
    }
  }
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Create UI button
api.ui.addButton({
  id: 'custom-room-creator-button',
  text: 'Custom Rooms',
  tooltip: 'Load custom room setups',
  onClick: showCustomRoomList
});

function showCustomRoomList() {
  const content = document.createElement('div');
  
  // Create a scrollable container
  const scrollContainer = api.ui.components.createScrollContainer({
    height: 300,
    padding: true
  });
  
  // Add custom rooms to the container
  Object.entries(config.customRooms).forEach(([roomId, room]) => {
    const roomItem = document.createElement('div');
    roomItem.className = 'custom-room-item';
    roomItem.style.cssText = 'padding: 10px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.2); cursor: pointer;';
    roomItem.innerHTML = `<h3>${room.name}</h3><p>Entities: ${room.entities.length}</p>`;
    
    roomItem.addEventListener('click', () => {
      loadCustomRoom(roomId);
      api.ui.hideAllConfigPanels();
    });
    
    scrollContainer.addContent(roomItem);
  });
  
  content.appendChild(scrollContainer.element);
  
  // Create the modal
  api.ui.components.createModal({
    title: 'Custom Rooms',
    content: content,
    buttons: [
      {
        text: 'Close',
        primary: true
      }
    ]
  });
}

function loadCustomRoom(roomId) {
  const room = config.customRooms[roomId];
  
  if (!room) {
    console.error(`Room ${roomId} not found`);
    return;
  }
  
  // Set sandbox mode
  globalThis.state.board.send({ type: "setPlayMode", mode: "sandbox" });
  
  // Set custom board configuration
  globalThis.state.board.send({
    type: "setState",
    fn: (prev) => ({
      ...prev,
      boardConfig: room.entities
    }),
  });
  
  // Show a confirmation
  api.showModal({
    title: 'Room Loaded',
    content: `${room.name} has been loaded!`,
    buttons: [{ text: 'OK', primary: true }]
  });
}

// Subscribe to new game events for analytics
globalThis.state.board.on('newGame', (event) => {
  console.log(`Custom room started with seed: ${event.world.RNG.seed}`);
});

// Export functionality
context.exports = {
  loadRoom: loadCustomRoom,
  addCustomRoom: (roomId, name, entities) => {
    config.customRooms[roomId] = {
      name: name,
      entities: entities
    };
    
    // Save to configuration
    api.service.updateScriptConfig(context.hash, config);
    
    return config.customRooms[roomId];
  }
};
```

## Compatibility Note

The game has been upgraded to use XState v3, which may introduce breaking changes in the API. If your mods stop working after an update, you may need to adjust to the new XState version.

For more information on the Game State API, see the [Game State API Documentation](../game_state_api.md). 