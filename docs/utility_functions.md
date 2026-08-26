# Bestiary Arena Utility Functions

This document describes the utility functions available through the Mod Loader API for working with Bestiary Arena game data. The utility was made by [Mathias Bynens](https://github.com/mathiasbynens).

## Overview

The utility functions provide a standardized way to:
- Convert between region/map/monster/equipment names and IDs
- Manipulate game state (force seeds, configure boards)
- Serialize and replay board configurations

## Accessing the Utility Functions

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

## Available Functions

### `serializeBoard()`

Serializes the current board state into a JSON string that can be used with `replay()` or `configureBoard()`.

**Returns:** A JSON string representing the board configuration.

```javascript
// Get the board as a JavaScript object
const boardData = JSON.parse(window.BestiaryModAPI.utility.serializeBoard());
```

### `replay(config)`

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

### `configureBoard(config)`

Sets up the board based on a given configuration. Similar to `replay()` but without forcing a seed.

**Parameters:**
- `config`: The board configuration object (same as for `replay()`)

### `forceSeed(seed)`

Forces the game to use a specific seed for random number generation.

**Parameters:**
- `seed`: The numeric seed to use

### `removeSeed()`

Removes a previously forced seed, allowing the game to use random seeds again.

### Level and Experience Functions

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

## Available Maps

The utility functions also provide access to various mapping objects through `BestiaryModAPI.utility.maps`:

### Region Maps
- `regionNamesToIds`: Maps region names to their internal IDs
- `regionIdsToNames`: Maps region IDs to their display names

### Map Maps
- `mapNamesToIds`: Maps map names to their internal IDs
- `mapIdsToNames`: Maps map IDs to their display names

### Monster Maps
- `monsterNamesToGameIds`: Maps monster names to their game IDs
- `monsterGameIdsToNames`: Maps monster game IDs to their names

### Equipment Maps
- `equipmentNamesToGameIds`: Maps equipment names to their game IDs
- `equipmentGameIdsToNames`: Maps equipment game IDs to their names

## Example Usage

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