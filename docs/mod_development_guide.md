# Bestiary Arena Mod Development Guide

This guide provides comprehensive documentation on creating mods for Bestiary Arena using the Mod Loader. It covers the API available to mods, how to create UIs that match the game's style, and best practices for mod development.

## Table of Contents

- [Bestiary Arena Mod Development Guide](#bestiary-arena-mod-development-guide)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Getting Started](#getting-started)
    - [Basic Mod Template](#basic-mod-template)
  - [Mod Structure](#mod-structure)
    - [Context](#context)
    - [Lifecycle](#lifecycle)
  - [The API](#the-api)
    - [Core Features](#core-features)
    - [Error Handling](#error-handling)
    - [Service API](#service-api)
    - [UI API](#ui-api)
    - [UI Components API](#ui-components-api)
    - [Utility API](#utility-api)
  - [UI Components](#ui-components)
    - [Modal](#modal)
    - [Scroll Container](#scroll-container)
    - [Monster Portrait](#monster-portrait)
    - [Item Portrait](#item-portrait)
    - [Room List Item](#room-list-item)
    - [Navigation Breadcrumb](#navigation-breadcrumb)
  - [Game State](#game-state)
  - [Best Practices](#best-practices)
    - [Performance](#performance)
    - [User Experience](#user-experience)
    - [Code Quality](#code-quality)
    - [Compatibility](#compatibility)
  - [Examples](#examples)
    - [Simple Mod: Show Current Monster Count](#simple-mod-show-current-monster-count)
    - [Advanced Mod: Map Analysis Tool](#advanced-mod-map-analysis-tool)
  - [Further Resources](#further-resources)

## Introduction

The Bestiary Arena Mod Loader allows you to create custom modifications for the game that can extend its functionality, add new features, or change the user experience. Mods are JavaScript files that run in the context of the game and have access to a powerful API that lets them interact with game state and UI.

## Getting Started

To create a mod, you need to:

1. Create a JavaScript file
2. Add it to the extension through the popup interface, either as a local mod or via a Gist URL
3. Enable the mod in the Mod Loader settings

### Basic Mod Template

Here's a basic template to get started:

```javascript
// My Awesome Mod for Bestiary Arena
console.log('My Awesome Mod initializing...');

// Configuration
const defaultConfig = {
  enabled: false,
  someValue: 5
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Create a button
if (api) {
  api.ui.addButton({
    id: 'my-awesome-mod-button',
    text: 'My Mod',
    tooltip: 'Click to activate my awesome mod',
    primary: false,
    onClick: activateMod
  });
} else {
  console.error('BestiaryModAPI not available');
}

// Main mod functionality
function activateMod() {
  api.ui.components.createModal({
    title: 'My Awesome Mod',
    content: '<p>This mod is now active!</p>',
    buttons: [
      {
        text: 'OK',
        primary: true
      }
    ]
  });
}

// Export functionality (optional)
exports = {
  activate: activateMod,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  }
};
```

## Mod Structure

### Context

Each mod runs in a sandboxed context with the following objects available:

- `context` - Information about the mod itself
  - `hash` - The unique hash ID of the mod
  - `config` - The mod's saved configuration
  - `api` - The BestiaryModAPI object
- `exports` - An object that can expose functions to be called from outside the mod

### Lifecycle

A mod is loaded when the game page loads and remains active until the page is closed or refreshed. If you need to run cleanup code when the mod is disabled, you can implement that logic in the `exports` object.

## The API

The BestiaryModAPI provides access to game functionality and UI components. Here are the main sections:

### Core Features

```javascript
// Show a modal dialog
api.showModal({
  title: 'My Modal',
  content: 'Hello World',
  buttons: [
    {
      text: 'OK',
      primary: true,
      onClick: () => console.log('OK clicked')
    }
  ]
});

// Interface with the game's DOM
api.queryGame('.game-element'); // Find elements
api.clickGame('#some-button');  // Click on elements

// Display helpers
api.showGrid({ rows: 10, cols: 10 }); // Show grid overlay
api.hideGrid();                       // Hide grid overlay
api.skipAnimations(true);             // Speed up the game by skipping animations
```

### Error Handling

It's important to implement proper error handling in your mods. Here's the recommended pattern:

```javascript
try {
  // Your code that might fail
  const result = api.someMethod();
  
  // Process the result
} catch (error) {
  // Log the error
  console.error('Error in my mod:', error);
  
  // Show user-friendly error message
  api.ui.components.createModal({
    title: 'Error',
    content: '<p>Something went wrong. Please try again later.</p>',
    buttons: [{ text: 'OK', primary: true }]
  });
}
```

For asynchronous code, use try/catch with async/await:

```javascript
async function myAsyncFunction() {
  try {
    const data = await api.someAsyncMethod();
    return processData(data);
  } catch (error) {
    console.error('Async error:', error);
    
    // Show error to user
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to load data. Please try again.</p>',
      buttons: [{ text: 'OK', primary: true }]
    });
    
    return null;
  }
}
```

### Service API

The service API allows interaction with the mod loader itself:

```javascript
// Get a list of active scripts
api.service.getActiveScripts().then(scripts => {
  console.log('Active scripts:', scripts);
});

// Update the mod's configuration
api.service.updateScriptConfig(context.hash, {
  enabled: true,
  someValue: 10
});

// Toggle a script's enabled state
api.service.toggleScript('otherModHash', true);

// Get saved configuration
api.service.getScriptConfig(context.hash).then(config => {
  console.log('Current config:', config);
});
```

### UI API

The UI API allows creating and managing UI elements:

```javascript
// Add a button
const button = api.ui.addButton({
  id: 'my-button',
  text: 'Click Me',
  tooltip: 'A helpful tooltip',
  primary: false,
  onClick: () => console.log('Button clicked')
});

// Update a button
api.ui.updateButton('my-button', {
  text: 'New Text',
  primary: true
});

// Remove a button
api.ui.removeButton('my-button');

// Create a config panel
const panel = api.ui.createConfigPanel({
  id: 'my-config',
  title: 'Configuration',
  content: '<p>Configure your mod here</p>',
  buttons: [
    {
      text: 'Save',
      primary: true,
      onClick: () => console.log('Save clicked')
    }
  ]
});

// Show/hide config panel
api.ui.toggleConfigPanel('my-config');
api.ui.hideAllConfigPanels();
```

### UI Components API

The UI Components API provides access to pre-built UI components that match the game's style. All UI components follow a consistent styling approach to ensure UI consistency.

```javascript
// Create a modal with game-styled UI
const modal = api.ui.components.createModal({
  title: 'Game-styled Modal',
  width: 300,
  content: 'This looks just like the game!',
  buttons: [
    {
      text: 'OK',
      primary: true,
      onClick: (e, modal) => {
        // Button clicked, modal is a reference to the modal object
        console.log('OK clicked');
      }
    }
  ]
});

// Close the modal programmatically
modal.close();

// Create a scrollable container
const scrollContainer = api.ui.components.createScrollContainer({
  height: 300,
  padding: true,
  content: 'A lot of scrollable content here'
});

// Add content to scroll container
scrollContainer.addContent('<p>More content</p>');
scrollContainer.clearContent();
scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });

// Create a monster portrait
const monsterPortrait = api.ui.components.createMonsterPortrait({
  monsterId: 21, // Example monster ID
  level: 50,
  tier: 4,
  onClick: () => console.log('Monster clicked')
});

// Create a full monster display with stats
const fullMonster = api.ui.components.createFullMonster({
  monsterId: 21,
  tier: 3,
  starTier: 2,
  level: 50,
  size: 'small', // 'small', 'medium', or 'large'
  spriteId: 21    // Optional custom sprite ID
});

// Create an item portrait
const itemPortrait = api.ui.components.createItemPortrait({
  itemId: 3079, // Example item ID
  stat: 'ad',   // 'ad', 'ap', or 'hp'
  tier: 3,
  onClick: () => console.log('Item clicked')
});

// Create a room list item
const roomItem = api.ui.components.createRoomListItem({
  roomId: 'rkswrs',
  name: 'Sewers',
  rank: { grade: 'S+', points: 10 },
  personalTime: { display: '0:08', ticks: 130 },
  worldTime: { display: '0:08', ticks: 130 },
  onClick: () => console.log('Room clicked')
});

// Create navigation breadcrumb
const breadcrumb = api.ui.components.createNavBreadcrumb({
  paths: ['Home', 'Rookgaard', 'Sewers'],
  onBack: () => console.log('Back clicked')
});
```

### Utility API

The Utility API, made by [Mathias Bynens](https://github.com/mathiasbynens), provides standardized functions for working with game data and state, including functions to convert between IDs and names, and to manipulate board configurations:

```javascript
// Wait for the utility API to be ready
document.addEventListener('utility-api-ready', () => {
  console.log('Utility API is ready');
  
  // Serialize the current board
  const boardData = JSON.parse(api.utility.serializeBoard());
  console.log('Current board:', boardData);
  
  // Replay a board configuration
  api.utility.replay({
    region: 'Rookgaard',
    map: 'Goblin Camp',
    seed: 12345,
    board: [/* piece configurations */]
  });
  
  // Force a specific seed for the game
  api.utility.forceSeed(12345);
  
  // Remove a forced seed
  api.utility.removeSeed();
  
  // Access mapping objects
  const trollId = api.utility.maps.monsterNamesToGameIds.get('troll');
  console.log('Troll ID:', trollId);
});

### Hook API

The hook API allows you to intercept and modify game functionality:

```javascript
// Hook into a game method
api.hook.method(someObject, 'methodName', ({ args, callOriginal, originalMethod, thisValue }) => {
  console.log('Method called with args:', args);
  
  // Modify args if needed
  args[0] = 'modified value';
  
  // Call the original method with modified args
  return callOriginal();
});

// Remove a hook
api.hook.unhook(someObject, 'methodName');
```

## UI Components

The UI Components system provides a set of pre-built components that match the game's style. These components are designed to be easy to use and provide a consistent look and feel across all mods.

### Modal

The modal component creates a dialog that matches the game's modal style:

```javascript
const modal = api.ui.components.createModal({
  title: 'Modal Title',
  width: 300, // Optional, defaults to 300
  content: 'Modal content goes here', // Can be string or HTMLElement
  buttons: [
    {
      text: 'OK',
      primary: true,
      onClick: (e, modal) => {
        console.log('OK clicked');
      }
    },
    {
      text: 'Cancel',
      primary: false,
      onClick: (e, modal) => {
        console.log('Cancel clicked');
      }
    }
  ]
});

// Close the modal programmatically
modal.close();
```

### Scroll Container

The scroll container provides a scrollable area with a custom scrollbar that matches the game's style:

```javascript
const scrollContainer = api.ui.components.createScrollContainer({
  height: 300, // Height in pixels or 'auto'
  padding: true, // Whether to add padding
  content: 'Initial content' // String, HTMLElement, or array of either
});

// Add content to the container
scrollContainer.addContent('<p>More content</p>');
scrollContainer.addContent(someHtmlElement);

// Clear the container
scrollContainer.clear();
```

### Monster Portrait

The monster portrait component creates a portrait of a monster that matches the game's style:

```javascript
const monsterPortrait = api.ui.components.createMonsterPortrait({
  monsterId: 21, // The game ID of the monster
  level: 50, // The level to display
  tier: 4, // The tier (1-5) affects background color
  onClick: () => {
    console.log('Monster clicked');
  }
});
```

### Item Portrait

The item portrait component creates a portrait of an item that matches the game's style:

```javascript
const itemPortrait = api.ui.components.createItemPortrait({
  itemId: 3079, // The sprite ID of the item
  stat: 'ad', // The stat type: 'ad', 'ap', or 'hp'
  tier: 3, // The tier (1-5) affects background color
  onClick: () => {
    console.log('Item clicked');
  }
});
```

### Room List Item

The room list item component creates a list item for a room that matches the game's style:

```javascript
const roomItem = api.ui.components.createRoomListItem({
  roomId: 'rkswrs', // The ID of the room
  name: 'Sewers', // The name of the room
  rank: { // Optional rank information
    grade: 'S+',
    points: 10
  },
  personalTime: { // Optional personal record
    display: '0:08',
    ticks: 130
  },
  worldTime: { // Optional world record
    display: '0:08',
    ticks: 130
  },
  onClick: () => {
    console.log('Room clicked');
  }
});
```

### Navigation Breadcrumb

The navigation breadcrumb component creates a breadcrumb trail that matches the game's style:

```javascript
const breadcrumb = api.ui.components.createNavBreadcrumb({
  paths: ['Home', 'Rookgaard', 'Sewers'], // The path segments
  onBack: () => {
    console.log('Back button clicked');
  }
});
```

## Game State

The game exposes its state through `globalThis.state`, which provides access to various aspects of the game:

```javascript
// Get the current board state
const boardState = globalThis.state.board.getSnapshot().context;

// Get the player's data
const playerData = globalThis.state.player.getSnapshot().context;

// Get monster information
const rat = globalThis.state.utils.getMonster(1);

// Get equipment information
const boots = globalThis.state.utils.getEquipment(1);

// Access all rooms data
const rooms = globalThis.state.utils.ROOMS;

// Access all regions data
const regions = globalThis.state.utils.REGIONS;

// Get board configuration for a specific room
const roomSetup = globalThis.state.utils.getBoardMonstersFromRoomId('abbane');

// Listen for new game events
globalThis.state.board.on('newGame', (event) => {
  console.log('New game started with seed:', event.world.RNG.seed);
  // Access the world object
  console.log('World object:', event.world);
});

// Place custom entities on the board
globalThis.state.board.send({
  type: "setState",
  fn: (prev) => ({
    ...prev,
    boardConfig: [
      {
        type: "custom", // Use "custom" type for full control
        nickname: "My Monster",
        equip: { stat: "ap", tier: 2, gameId: 8 },
        gameId: 9, // Monster type
        tier: 3,
        genes: {
          hp: 1,
          magicResist: 1,
          ad: 1,
          ap: 1,
          armor: 1,
        },
        villain: true,
        key: "unique-key-1", // Unique identifier
        level: 15,
        direction: "west",
        tileIndex: 40, // Board position
      }
    ],
  }),
});

// Subscribe to game state changes
const unsubscribe = globalThis.state.board.subscribe((state) => {
  console.log('Board state changed:', state);
});

// Unsubscribe when no longer needed
unsubscribe();
```

For more details on the game state API, see the [Game State API Documentation](game_state_api.md).

## Best Practices

### Performance

- Avoid unnecessary DOM operations
- Use event delegation where possible
- Clean up event listeners and intervals when they're no longer needed
- Use `setTimeout` and `requestAnimationFrame` for animations instead of loops

### User Experience

- Match the game's style using the UI Components
- Position UI elements in a way that doesn't interfere with the game
- Provide clear feedback for user actions
- Make your mod's purpose and functionality clear

### Code Quality

- Use descriptive variable and function names
- Comment your code, especially complex parts
- Structure your code into logical sections
- Handle errors gracefully

### Compatibility

- Test your mod with different game versions
- The game uses XState v3, which may have breaking changes compared to previous versions
- Ensure your mod works well with other mods
- Use feature detection instead of assuming availability
- Handle API changes gracefully by checking for the existence of methods before using them

## Examples

### Simple Mod: Show Current Monster Count

```javascript
// Monster Counter Mod
console.log('Monster Counter Mod initializing...');

// Create UI button
api.ui.addButton({
  id: 'monster-counter-button',
  text: 'Count',
  tooltip: 'Show monster count',
  primary: false,
  onClick: showMonsterCount
});

function showMonsterCount() {
  const { monsters } = globalThis.state.player.getSnapshot().context;
  
  api.ui.components.createModal({
    title: 'Monster Count',
    content: `<p>You have ${monsters.length} monsters in your collection.</p>`,
    buttons: [
      {
        text: 'OK',
        primary: true
      }
    ]
  });
}

exports = {
  showCount: showMonsterCount
};
```

### Advanced Mod: Map Analysis Tool

```javascript
// Map Analysis Tool
console.log('Map Analysis Tool initializing...');

// Configuration
const config = Object.assign({}, {
  showOnLoad: false,
  colorTheme: 'dark'
}, context.config);

// Create UI button
api.ui.addButton({
  id: 'map-analysis-button',
  text: 'Maps',
  tooltip: 'Analyze map completion',
  primary: false,
  onClick: showMapAnalysis
});

function showMapAnalysis() {
  try {
    const { rooms } = globalThis.state.player.getSnapshot().context;
    const content = document.createElement('div');
    
    // Create a scrollable container for the maps
    const mapScroll = api.ui.components.createScrollContainer({
      height: 400,
      padding: true,
      content: ''
    });
    
    // Add map items to the scroll container
    Object.entries(rooms).forEach(([roomId, data]) => {
      try {
        // Get room name from utils if available
        let roomName = globalThis.state.utils.ROOM_NAME[roomId] || 'Unknown Room';
        
        // Create a room list item
        const roomItem = api.ui.components.createRoomListItem({
          roomId: roomId,
          name: roomName,
          rank: {
            grade: getRankGrade(data.rank),
            points: data.rank
          },
          personalTime: {
            display: formatTicks(data.ticks),
            ticks: data.ticks
          },
          onClick: () => showRoomDetails(roomId, roomName, data)
        });
        
        mapScroll.addContent(roomItem);
      } catch (e) {
        console.error(`Error processing room ${roomId}:`, e);
      }
    });
    
    content.appendChild(mapScroll.element);
    
    // Show the modal with map analysis
    api.ui.components.createModal({
      title: 'Map Analysis',
      width: 450,
      content: content,
      buttons: [
        {
          text: 'Close',
          primary: true
        }
      ]
    });
  } catch (error) {
    console.error('Error showing map analysis:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to analyze maps. Make sure you are in the game.</p>',
      buttons: [
        {
          text: 'OK',
          primary: true
        }
      ]
    });
  }
}

function showRoomDetails(roomId, roomName, data) {
  // Create content for room details
  const content = document.createElement('div');
  
  const stats = document.createElement('div');
  stats.innerHTML = `
    <p>Completion count: ${data.count}</p>
    <p>Best time: ${formatTicks(data.ticks)}</p>
    <p>Rank: ${getRankGrade(data.rank)} (${data.rank} points)</p>
  `;
  
  content.appendChild(stats);
  
  // Show the modal with room details
  api.ui.components.createModal({
    title: roomName,
    width: 350,
    content: content,
    buttons: [
      {
        text: 'Back',
        primary: false,
        onClick: () => showMapAnalysis(),
        closeOnClick: true
      },
      {
        text: 'Close',
        primary: true
      }
    ]
  });
}

// Helper function to format ticks as time
function formatTicks(ticks) {
  if (!ticks) return '0:00';
  
  const seconds = Math.floor(ticks / 60);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Helper function to get rank grade from points
function getRankGrade(points) {
  if (points >= 10) return 'S+';
  if (points >= 8) return 'S';
  if (points >= 6) return 'A';
  if (points >= 4) return 'B';
  if (points >= 2) return 'C';
  return 'D';
}

exports = {
  showAnalysis: showMapAnalysis,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  }
};
```

For more examples, check out the existing mods in the `mods` directory.

## Further Resources

- [UI Management API](ui_management.md) - Detailed documentation on the UI Management API
- [Game State API Documentation](game_state_api.md) - Detailed documentation on the Game State API
- [Utility Functions Documentation](utility_functions.md) - Documentation for the utility functions API
- [Bestiary Arena Wiki](https://bestiaryarena.fandom.com/) - Information about the game mechanics 