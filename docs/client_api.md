# Bestiary Arena Mod Loader - Client API Documentation

This document provides a comprehensive reference for the Client API provided by the Bestiary Arena Mod Loader. The Client API enables mods to interact with the game, manipulate UI elements, and access game state.

## Overview

The Client API is exposed through the `api` object available in the mod context. All API methods and properties are accessible through this object.

```javascript
// Example of accessing the API
const api = context.api;
api.showModal({ title: 'Hello', content: 'World' });
```

## Core Features

### Modal Dialogs

```javascript
// Show a modal dialog
api.showModal({
  title: 'Modal Title',
  content: 'Modal content text or HTML element',
  buttons: [
    {
      text: 'OK',
      primary: true,
      onClick: (e) => console.log('OK clicked'),
      closeOnClick: true // Default: true
    },
    {
      text: 'Cancel',
      primary: false
    }
  ]
});
```

The modal will automatically use the game's styling if UI Components are loaded, or fall back to a basic styled version if not.

### DOM Manipulation

```javascript
// Query elements in the game's DOM
const element = api.queryGame('.game-element');

// Click elements in the game's DOM
api.clickGame('#game-button');
```

### Game Display Helpers

```javascript
// Show a grid overlay on the game
api.showGrid({
  rows: 10,           // Number of rows
  cols: 10,           // Number of columns
  color: 'rgba(255, 0, 0, 0.3)', // Grid color
  thickness: 1        // Line thickness
});

// Hide the grid overlay
api.hideGrid();

// Skip animations to speed up the game
api.skipAnimations(true);  // Enable animation skipping
api.skipAnimations(false); // Disable animation skipping
```

### Entity Rendering

```javascript
// Render a game entity (if the game's render function is available)
const entityElement = api.renderEntity('monster', {
  id: 21,
  level: 50,
  tier: 3
});
```

## Service API

The Service API provides methods for interacting with the mod loader system.

```javascript
// Register a script with the mod loader
api.service.registerScript('scriptHash', 'Script Name', {
  enabled: true,
  options: { /* custom options */ }
});

// Get all active scripts
api.service.getActiveScripts().then(scripts => {
  console.log('Active scripts:', scripts);
});

// Toggle a script's enabled state
api.service.toggleScript('scriptHash', true);

// Update a script's configuration
api.service.updateScriptConfig('scriptHash', {
  enabled: true,
  options: { /* updated options */ }
});

// Remove a script
api.service.removeScript('scriptHash');
```

## UI API

The UI API provides methods for creating and managing UI elements — buttons and configuration panels.

```javascript
// Access UI management through api.ui
const button = api.ui.addButton({
  id: 'my-button',
  text: 'Click Me',
  icon: '⚙️',
  modId: 'my-mod',
  onClick: (e) => console.log('Button clicked')
});
```

For the full reference (all options, config panel management, mod bar text/icon display modes), see [UI Management API Documentation](ui_management.md).

## UI Components API

The UI Components API provides access to game-styled UI components. 

```javascript
// Access UI components through api.ui.components
const modal = api.ui.components.createModal({
  title: 'Modal Title',
  width: 600,
  height: 400,
  content: contentDiv,
  buttons: [{ text: 'OK', primary: true }]
});
// For multi-column / tabbed bodies, apply the responsive layout helper immediately
// (see Mod Development Guide — Responsive modals). Numeric height modals flex-fill
// the shell automatically; the helper re-clamps on resize.
```

For detailed documentation on UI Components, see [UI Components Documentation](ui_components.md).

## Internationalization

The API includes internationalization support:

```javascript
// Translate a key to the current locale
const translatedText = api.i18n.t('key.to.translate');

// Get the current locale
const currentLocale = api.i18n.getLocale();

// Get supported locales
const supportedLocales = api.i18n.getSupportedLocales();
```

## Utility API

```javascript
// Safely tear down a game-state subscription regardless of its shape.
// globalThis.state.X.subscribe() returns { unsubscribe }, but
// X.select(fn).subscribe() and world emitters return a bare function.
const sub = globalThis.state.board.subscribe(onChange);
// ...later, in cleanup():
api.util.unsubscribe(sub); // null-safe; returns true if it tore something down
```

## Hook API

The Hook API allows intercepting and modifying game methods:

```javascript
// Hook into a method
api.hook.method(targetObject, 'methodName', ({ args, callOriginal, originalMethod, thisValue }) => {
  console.log('Method called with arguments:', args);
  
  // Modify arguments if needed
  args[0] = 'modified value';
  
  // Call the original method with modified args
  return callOriginal();
});

// Remove a hook
api.hook.unhook(targetObject, 'methodName');
```

## Game State Access

The game state is accessible through `globalThis.state`:

```javascript
// Access the player state
const playerState = globalThis.state.player.getSnapshot().context;
console.log('Player monsters:', playerState.monsters);

// Access the board state
const boardState = globalThis.state.board.getSnapshot().context;
console.log('Current board:', boardState.boardConfig);

// Access utilities
const rooms = globalThis.state.utils.ROOMS;
const regions = globalThis.state.utils.REGIONS;
const roomSetup = globalThis.state.utils.getBoardMonstersFromRoomId('abbane');

// Listen for new game events
globalThis.state.board.on('newGame', (event) => {
  console.log('Game seed:', event.world.RNG.seed);
});

// Subscribe to state changes
const sub = globalThis.state.board.subscribe((state) => {
  console.log('Board state changed:', state);
});

// Unsubscribe when no longer needed. globalThis.state.X.subscribe() returns
// { unsubscribe }, but X.select(fn).subscribe() and world emitters return a
// bare function — api.util.unsubscribe() handles both shapes safely.
api.util.unsubscribe(sub);
```

> **Note**: The game has been upgraded to use XState v3, which may have breaking changes compared to earlier versions. If your mods stop working after an update, check for compatibility issues with the new XState version.

## Best Practices

1. **Error Handling**: Always use try/catch blocks around API calls to handle potential errors gracefully.

2. **Resource Cleanup**: Expose an idempotent `exports.cleanup()` — the loader runs it when your mod is disabled and before every soft reload. Unsubscribe from state subscriptions (via `api.util.unsubscribe`), clear intervals, disconnect observers, remove document/window listeners, close modals and menus, and reset any `window.__yourModLoaded` guard. See `mod_development_guide.md` → "Best Practices → Cleanup & memory leaks".

3. **Configuration Persistence**: Use `api.service.updateScriptConfig()` to save mod settings between sessions.

4. **UI Consistency**: Use the UI Components API to ensure your mod's UI matches the game's style.

5. **Respect Game State**: Avoid making changes that could break the game or interfere with other mods.

## Example

Here's a complete example of a mod using the Client API:

```javascript
// My Awesome Mod
console.log('Initializing My Awesome Mod');

// Configuration with defaults
const defaultConfig = {
  enabled: false,
  intensity: 5
};

// Initialize with saved config or defaults
const config = Object.assign({}, defaultConfig, context.config);

// Create UI button
try {
  api.ui.addButton({
    id: 'my-mod-button',
    text: config.enabled ? 'Disable' : 'Enable',
    icon: '⚙️',
    tooltip: 'Toggle my awesome mod',
    primary: config.enabled,
    onClick: toggleMod
  });
} catch (error) {
  console.error('Error creating button:', error);
}

// Main functionality
function toggleMod() {
  try {
    config.enabled = !config.enabled;
    
    // Update button appearance
    api.ui.updateButton('my-mod-button', {
      text: config.enabled ? 'Disable' : 'Enable',
      primary: config.enabled
    });
    
    // Save configuration
    api.service.updateScriptConfig(context.hash, config);
    
    // Show feedback
    api.showModal({
      title: 'My Awesome Mod',
      content: `Mod is now ${config.enabled ? 'enabled' : 'disabled'}`,
      buttons: [{ text: 'OK', primary: true }]
    });
  } catch (error) {
    console.error('Error toggling mod:', error);
  }
}

// Export functionality
context.exports = {
  toggle: toggleMod,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
  }
};
```

For more detailed information on the game state API, see the [Game State API Documentation](game_state_api.md).
