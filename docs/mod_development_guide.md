# Bestiary Arena Mod Development Guide

This guide provides comprehensive documentation on creating mods for Bestiary Arena using the Mod Loader. It covers the API available to mods, how to create UIs that match the game's style, and best practices for mod development.

## Table of Contents

- [Bestiary Arena Mod Development Guide](#bestiary-arena-mod-development-guide)
  - [Table of Contents](#table-of-contents)
  - [Introduction](#introduction)
  - [Getting Started](#getting-started)
    - [Sharing a Mod as a Community Mod](#sharing-a-mod-as-a-community-mod)
    - [Adding a New Built-in Mod to the Extension](#adding-a-new-built-in-mod-to-the-extension)
    - [Logging & Error Log](#logging--error-log-popup-debug)
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
  - [Mod Coordination System](#mod-coordination-system)
    - [Overview](#overview)
    - [Registering Your Mod](#registering-your-mod)
    - [Updating Mod State](#updating-mod-state)
    - [Checking Other Mods](#checking-other-mods)
    - [Resource Control](#resource-control)
    - [Event Subscriptions](#event-subscriptions)
    - [Cleanup](#cleanup)
    - [Priority System](#priority-system)
  - [Loader Internals](#loader-internals)
  - [Examples](#examples)
    - [Simple Mod: Show Current Monster Count](#simple-mod-show-current-monster-count)
    - [Advanced Mod: Map Analysis Tool](#advanced-mod-map-analysis-tool)
  - [Further Resources](#further-resources)
    - [Quest mod data (`assets/quests`)](#quest-mod-data-assetsquests)

## Introduction

The Bestiary Arena Mod Loader allows you to create custom modifications for the game that can extend its functionality, add new features, or change the user experience. Mods are JavaScript files that run in the context of the game and have access to a powerful API that lets them interact with game state and UI.

**Note**: The Mod Loader routes all console output through one controller. Just use `console.log()` / `console.warn()` / `console.error()` directly — verbosity is the popup's **Debug → Log Level** control, no manual debug wrappers needed.

## Getting Started

To create a mod, you need to:

1. Create a JavaScript file
2. Add it to the extension through the popup interface, either as a local mod or via a Gist URL
3. Enable the mod in the Mod Loader settings

### Sharing a Mod as a Community Mod

Community mods are public GitHub Gists listed on the wiki [Scripts page](https://bestiaryarena.wiki.gg/wiki/Scripts). The popup's **Community** tab reads that page and installs a mod from its Gist in one click (installed disabled, so players switch it on themselves).

**Description.** The text shown under your mod's name comes from the **Gist description** field, the single line above the file editor when you create a Gist (or via **Edit** on an existing one). Keep it to one short sentence about what the mod does. If the Gist has no description, the popup uses the description from the wiki table, and if that is empty too it shows *"The author has not provided a description."* The description is saved with the mod when a player installs it, and refreshed when they update it.

**Updates.** Each edit to your Gist is a new revision. The popup compares the latest revision with the one a player installed and shows an **Update** button. Once a Gist has been revised, the list also shows an **Updated** date and revision number (`rev N`, the count of revisions, so several edits on one day can be told apart). Revisions have no name or message, so put a version in your script header if you want one visible. Players can also enable **Auto-update** per mod (off by default); it checks every 6 hours and when they press **Refresh**, and the new script is used on the next game page load. Only edit the Gist with changes you want everyone on Auto-update to receive.

**Checklist.**

1. Create a public Gist containing a single script file (the same format as the template below).
2. Fill in the Gist description.
3. Add a row to the wiki Scripts table with your Gist link, a description, the date and your profile link.

Community mods are not reviewed by the extension team, and players are warned in the popup that installing them is at their own risk.

### Adding a New Built-in Mod to the Extension

If you're developing a mod to be included with the extension (not a user-generated mod), register it in **four places**. The same checklist appears in the repository README under **Adding a mod that ships inside the extension** ([`README.md`](../README.md#adding-a-mod-that-ships-inside-the-extension)).

**1. `content/mod-registry.js`** — Add the filename to `DATABASE_MODS`, `OFFICIAL_MODS`, `SUPER_MODS`, or `OT_MODS` (see the file header for the full checklist).

Example for a Super Mod:

```javascript
export const SUPER_MODS = [
  'Autoseller.js',
  'Mod Settings.js',
  'Your New Mod.js',  // ← Add here
  // ...
];
```

**2. `background.js`** — In the `getModCounts` message handler, update the hardcoded `modCounts` object so `database`, `official`, `super`, and `ot` match the lengths in `mod-registry.js`. Chromium uses this fallback because the service worker cannot dynamically import the registry. Search for the comment *Keep these in sync with content/mod-registry.js*.

**3. `popup/popup.js`** — Update the static name arrays so the popup lists match `mod-registry.js` (search for *kept in sync with mod-registry.js*). Also add a short entry to `modDescriptions` and, if you use translated tooltips, `assets/locales/en-US.json` and `assets/locales/pt-BR.json` under `popup.modDescriptions`.

```javascript
const superModNames = [
  'Autoseller.js',
  'Mod Settings.js',
  'Your New Mod.js',  // ← Add here
  // ...
];
```

**4. `content/local_mods.js`** — Add the filename to the matching `FALLBACK_*` array (search for *Keep in sync with content/mod-registry.js*). This list is used when the page cannot dynamically import `mod-registry.js` (for example Orion iOS).

**After updating:** reload the extension in your browser (`chrome://extensions` → Reload). The popup reads bundled mods from extension storage; `background.js` merges any new registry entries into storage when you open the popup. If a mod still does not appear, refresh a Bestiary Arena tab once so the content script re-registers mods, or use the popup’s **Reset local mods** button and refresh the game tab.

**Why four places?**

- `mod-registry.js` is the source of truth for content scripts (ES modules).
- The popup cannot load those modules the same way, so it duplicates filenames for categorization and descriptions.
- `local_mods.js` embeds the same lists for environments where dynamic import fails.
- On Chrome, the background service worker cannot use `import()` for the registry in all code paths, so category totals use the hardcoded `modCounts` object until that limitation changes.

### Logging & Error Log (popup Debug)

Every `console.*` call in every context (page, content script, background) goes through
one controller, `content/ba-logger.js`. Just call `console.log()` / `console.warn()` /
`console.error()` directly — **do not** wrap them in `if (window.BESTIARY_DEBUG)` checks
or reassign `console.*` yourself.

Verbosity is the popup **Debug → Log Level** control (`silent` / `errors` / `warnings` /
`info` / `verbose`, default `errors`), applied live to open game tabs — no refresh:

- `console.log` / `console.info` print at `info` and above
- `console.warn` prints at `warnings` and above
- `console.error` **always** prints, at every level

Mods run with a `//# sourceURL` trailer, so DevTools shows `Mod_Name.js:123` for their
log lines (not `VM123:456`). `window.BESTIARY_DEBUG` still exists as a read-only
back-compat alias (`true` only when the level is `verbose`).

The popup **Error Log** works without DevTools (useful on mobile WebExtensions):

| Always recorded (any log level) | Not recorded |
|---------------------------------|--------------|
| `console.error` (with stack/detail) | `console.warn` / `console.log` / `console.info` |
| `console.assert` failures | |
| Uncaught errors + unhandled rejections | |
| Mod/loader load failures, background fetch failures | |

- Persists in extension storage (last 300 entries) until **Clear**
- Prepends a sticky Device / Browser header (survives **Clear**; included when copying)
- Expand **Debug** to auto-refresh; use **Copy** to share logs (e.g. from iOS)
- Report from mods: `window.BestiaryLoaderErrorLog?.report(source, message, detail)`
- Inspect the level at runtime: `globalThis.BestiaryLogger.getLevel()`

See [Loader Internals — Error Log](#error-log-popup-debug) for architecture details.

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
    icon: '🎯',
    tooltip: 'Click to activate my awesome mod',
    primary: false,
    onClick: activateMod
  });
} else {
  console.error('BestiaryModAPI not available');
}

// Mod bar buttons need both text and icon — see docs/ui_components.md#ui-management

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

A mod's body runs when the game page loads. The loader also calls `exports.cleanup()`:

- **on disable** — when the user toggles the mod off in the popup (the mod's record is
  then dropped, so re-enabling re-runs the body), and
- **before a soft reload** — the popup's "Reload" button tears every mod down and re-runs
  them without a page refresh.

So **every mod must export a `cleanup` function** (either `context.exports = { cleanup }` or a
bare `exports = { cleanup }` — both reach the loader) that undoes *everything* its body did:
every `addEventListener`, `setInterval`/`setTimeout`, `MutationObserver`, store
`.subscribe()`, injected DOM node, monkey-patch, and `window.*` global. `cleanup()` **must be
idempotent** (guard with `if (x) { … x = null }`) — a mod that also listens for its own
`updateLocalModState` message will get `cleanup()` called twice.

If your mod uses a module-load guard (`if (window.__myModLoaded) return`), **reset it in
`cleanup()`** (`delete window.__myModLoaded`) or a re-enable / soft reload silently no-ops.

See [Best Practices → Cleanup & memory leaks](#cleanup--memory-leaks) for the full checklist.

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
  // Log the error (also appears in popup Debug → Error Log)
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
  modId: context.hash,
  content: '<p>Configure your mod here</p>',
  // width: 350, height: 800 — optional desktop max (defaults shown)
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
```

#### `api.util.unsubscribe(sub)`

The game's stores are inconsistent about what `.subscribe()` returns:
`globalThis.state.{board,player,game,gameTimer,daily}.subscribe()` returns an
`{ unsubscribe }` **object**, while `state.X.select(fn).subscribe()` and the world event
emitters (`world.onGameEnd.subscribe`, `world.grid.onActor*.subscribe`) return a bare
**function**. A teardown that only handles one shape silently leaks the other. In your
`cleanup()`, always:

```javascript
const sub = globalThis.state.board.select(s => s.context.floor).subscribe(onFloor);
// …later, in cleanup():
api.util.unsubscribe(sub);   // handles both shapes, null-safe
```

#### `api.util.formatItemCount(count)`

Formats an item count exactly like the game's inventory badges: below 1000 as-is,
1000–9999 rounded to one decimal with a comma (`4561` → `4,6K`), 10000+ floored to whole
thousands (`11972` → `11K`). Use it for any badge that sits next to a native item count
instead of hand-rolling `toFixed`/`Math.floor` — the rounding differs by size, and
getting it wrong makes the mod's number disagree with the game's.

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

### Responsive modals

Since **4.3.2**, most bundled mods clamp modal size to the viewport on phones while keeping the desktop maximum unchanged. Use this pattern for custom `createModal` dialogs:

```javascript
const MODAL_CONFIG = {
  width: 600,
  height: 400,
  viewportPadding: 16,
  minWidth: 280,
  minHeight: 280
};

function getModalDimensions() {
  const pad = MODAL_CONFIG.viewportPadding * 2;
  return {
    width: Math.max(
      MODAL_CONFIG.minWidth,
      Math.min(MODAL_CONFIG.width, window.innerWidth - pad)
    ),
    height: Math.max(
      MODAL_CONFIG.minHeight,
      Math.min(MODAL_CONFIG.height, window.innerHeight - pad)
    )
  };
}
```

Open with clamped `width` / `height`, give the main content `flex: 1 1 auto; min-height: 0; overflow-y: auto`, and re-apply dimensions on `window` `resize` (remove the listener when the modal closes).

`createModal` with a numeric `height` flex-fills the inner wrapper and `.widget-bottom` automatically. For multi-column or tabbed layouts, use the **standard responsive helper** (same pattern as Challenges):

```javascript
function openModal(api, { title, width, height, content, buttons }) {
  const options = { title, content, buttons: buttons || [] };
  if (width != null) options.width = width;
  if (height != null) options.height = height;
  if (api?.ui?.components?.createModal) return api.ui.components.createModal(options);
  if (typeof api?.showModal === 'function') return api.showModal(options);
  return null;
}

function setupModalResponsiveLayout(modalRef, contentRoot) {
  const apply = () => applyModalLayout(modalRef, contentRoot, getModalDimensions());
  requestAnimationFrame(() => apply());
  const onResize = () => apply();
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}

// After building content:
const modalRef = openModal(api, {
  title: 'My Mod',
  width: dims.width,
  height: dims.height,
  content: wrapper,
  buttons: [{ text: 'Close', primary: true }]
});
const stopLayout = setupModalResponsiveLayout(modalRef, wrapper);
// Call stopLayout when the modal closes.
```

Call `setupModalResponsiveLayout` **immediately** after `createModal` — do not wrap it in `setTimeout`. Use `requestAnimationFrame` only inside the helper for the first paint. Reserve `setTimeout` for non-layout work (footer injection, observers).

For **settings panels**, prefer `api.ui.createConfigPanel()` — defaults to **350×800** max, viewport clamping, scroll, and resize cleanup are built in (see [UI Management](ui_components.md#configuration-panel-management)).

### Custom Modal Size Example

Pass explicit clamped `width` / `height`; the component applies `95vw` / `95vh` caps and flex-fills the body when `height` is numeric:

```javascript
const { width, height } = getModalDimensions();
const modal = api.ui.components.createModal({
  title: 'Custom Modal',
  width,
  height,
  content: contentDiv,
  buttons: [{ text: 'Close', primary: true }]
});
setupModalResponsiveLayout(modal, contentDiv);
```

**Deprecated** — do not use post-open `setTimeout` to force dialog size (causes a visible “opens small then expands” flash):

```javascript
// Legacy — not recommended
setTimeout(() => {
  const dialog = document.querySelector('div[role="dialog"][data-state="open"]')
  if (dialog) { /* manual width/height overrides */ }
}, 100)
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

// Region display names — do not hardcode region lists in mods
// Prefer maps-database (loaded before mods):
const regionLabel = globalThis.mapsDatabase.getRegionDisplayName(regionId);
const regionLabelFromObject = globalThis.mapsDatabase.getRegionDisplayNameFromRegion(region);
// Order follows the game client:
const regionsInOrder = globalThis.mapsDatabase.getRegionsInOrder();
// All database globals: see "Mod Databases" in game_state_api.md

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

// Interacting with Ascension floors
// Getting current selected floor (ranges from 0-15)
const currentFloor = globalThis.state.board.get().context.floor;

// Setting current floor
globalThis.state.board.trigger.setState({ fn: (prev) => ({ ...prev, floor: 10 }) });

// Subscribe to game state changes
const unsubscribe = globalThis.state.board.subscribe((state) => {
  console.log('Board state changed:', state);
});

// Unsubscribe when no longer needed
unsubscribe();
```

### Reading allies (creatures alive) at battle end

When a battle ends, the game may not pass `creaturesAlive` or `currentTeamSize` in the victory callback payload. To get the number of ally creatures still on the board at that moment, read the board state and count ally pieces (same logic as the Custom Battles system):

```javascript
function getCreaturesAliveFromBoardState() {
  try {
    const state = globalThis.state;
    if (!state?.board?.getSnapshot) return null;
    const ctx = state.board.getSnapshot().context;
    const boardConfig = ctx?.boardConfig;
    if (!Array.isArray(boardConfig)) return null;
    const isAlly = (piece) =>
      piece?.type === 'player' || (piece?.type === 'custom' && piece?.villain === false);
    return boardConfig.filter(isAlly).length;
  } catch (e) {
    return null;
  }
}
```

Use this when your victory/defeat handler needs to compute grade or score from how many allies survived. If the result is `null` or unavailable, fall back to assuming full survival (e.g. `creaturesAlive = currentTeamSize`). See the Challenges mod and `content/custom-battles.js` (`countPlayerAllyCreatures`) for reference.

For more details on the game state API, see the [Game State API Documentation](game_state_api.md).

### Community event competitions

`content/event-competition.js` exposes `window.EventCompetition`, a config-driven framework for Firebase-backed floor/rank leaderboards (join flow, modal UI, auto-submit on victory, raid timer). Better Highscores registers Tibia Ball League via a thin adapter; future timed events can call `EventCompetition.register(config, deps)` with their own `roomId`, Firebase paths, floor ranges, and `i18nPrefix`. The script is injected after `custom-battles.js` by `injector.js` (before `local_mods.js`), so it is available to all bundled mods. Wait for `window.EventCompetition` if your mod loads before the framework (same pattern as `window.CustomBattles` in Quests). When a known event room is live in `state.raids` but no adapter is registered (e.g. Better Highscores disabled), the framework shows a one-shot nudge toast telling the player to enable Better Highscores.

## Best Practices

### Performance

- Avoid unnecessary DOM operations
- Use event delegation where possible
- Use `setTimeout` and `requestAnimationFrame` for animations instead of loops

### Cleanup & memory leaks

`exports.cleanup()` runs on disable and before every soft reload (see [Lifecycle](#lifecycle)).
A 2026 audit found ~70 leak sites across the loader and mods; these are the rules that came
out of it:

- **`.subscribe()` return shape.** `globalThis.state.X.subscribe()` → `{ unsubscribe }`
  object; `X.select(fn).subscribe()` and world emitters → bare function. Use
  [`api.util.unsubscribe(sub)`](#apiutilunsubscribesub) — it handles both. A one-shape check
  silently leaks the other (this was ~⅓ of the audit's findings).
- **No inline-arrow `document`/`window` listeners** that outlive one interaction — you can't
  `removeEventListener` an anonymous function. Store a named handler in a module var and
  remove it in `cleanup()`.
- **Every `setInterval` handle** lives in a module var, cleared in `cleanup()`; guard each
  `setInterval` call site with `if (!handle)` so it can't double-set.
- **Debug-only** body-wide `MutationObserver`s / polls: gate behind
  `globalThis.BestiaryLogger?.getLevel?.() === 'verbose'` — don't arm them for every user.
- **Modal `cleanup()` must actually `.close()` the modal** (or call its layout-cleanup
  helper) — nulling the reference alone leaves the modal DOM, its `resize` listener, and any
  open sub-panel's document listeners in the page.
- **Open context menus / confirm-armed buttons**: close them in `cleanup()`
  (`openContextMenu?.closeMenu?.()`) — their ESC/click-capture document listeners are
  otherwise only removed by a click that may never come.
- **`window.fetch` patches**: name your wrapper and guard the restore with
  `if (window.fetch === myWrapper)` so disabling your mod doesn't clobber a mod that patched
  on top of you.
- **`cleanup()` must be idempotent** and must reset any `window.__myModLoaded` guard.

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
- **Use `console.log()` directly** - no need for debug wrappers since the popup controls all console output globally

### Compatibility

- Test your mod with different game versions
- Use the Mod Coordination System to prevent conflicts with other mods (see [Mod Coordination System](#mod-coordination-system))
- **Mobile WebExtensions (Orion iOS, etc.):** The loader injects [`content/platform.js`](../content/platform.js) before other page scripts. It exposes `window.BestiaryPlatform` (`prefersRelaxedLoader()`, `useStrictLoaderCompletion()`). Mod authors normally need no changes; bundled mods still run in the same order. To test the relaxed path on desktop: `sessionStorage.setItem('ba-relaxed-loader', '1')` and reload the game tab. See [Loader Internals](#desktop-vs-mobile-relaxed-loader) and [Orion iOS Compatibility](mobile.md).

## Mod Coordination System

The Mod Coordination System provides a centralized way for mods to communicate their active states, manage shared resources, and prevent conflicts. This system replaces the old `window.__modCoordination` approach with a more robust, event-driven architecture.

### Overview

The coordination system is available globally as `window.ModCoordination` and is loaded automatically before mods via `content/mod-coordination.mjs`. It provides:
- **Mod State Management**: Register mods and track their active/enabled states
- **Priority System**: Automatically handle conflicts based on mod priorities (0-255 range)
- **Resource Control**: Manage exclusive access to shared resources through ControlManager instances
- **Event System**: Subscribe to state changes instead of polling
- **Control Managers**: Pre-configured managers for common resources (questButton, autoplay, bestiaryAutomatorSettings)

### Registering Your Mod

Register your mod when it initializes:

```javascript
function initMyMod() {
    // Register with the coordination system
    if (window.ModCoordination) {
        window.ModCoordination.registerMod('My Mod Name', {
            priority: 50,  // Higher priority = runs first (0-255 range)
            metadata: {
                description: 'Description of what your mod does'
            }
        });
    }
    
    // ... rest of initialization
}
```

**Priority Guidelines:**
- **200**: System-level analysis tools (Board Analyzer)
- **150**: Manual automation (Manual Runner)
- **120**: Background automation (Autoscroller)
- **100**: Event-driven automation (Raid Hunter)
- **90**: Task automation (Better Tasker)
- **50**: General automation (Bestiary Automator)
- **10**: Farming automation (Better Boosted Maps)
- **5**: Optimization tools (Stamina Optimizer)
- **1**: Passive utilities (Autoseller)

### Updating Mod State

Update your mod's state when it becomes active or inactive:

```javascript
// When your mod starts an operation
if (window.ModCoordination) {
    window.ModCoordination.updateModState('My Mod Name', { active: true });
}

// When your mod finishes an operation
if (window.ModCoordination) {
    window.ModCoordination.updateModState('My Mod Name', { active: false });
}

// Update enabled state when user toggles the mod
if (window.ModCoordination) {
    window.ModCoordination.updateModState('My Mod Name', { enabled: true });
}
```

### Checking Other Mods

Check if other mods are active before performing operations:

```javascript
// Check if a specific mod is active
if (window.ModCoordination?.isModActive('Board Analyzer')) {
    console.log('Board Analyzer is running, skipping operation');
    return;
}

// Check if mod can run based on blocking mods
if (window.ModCoordination) {
    const canRun = window.ModCoordination.canModRun('My Mod Name', [
        'Board Analyzer',
        'Manual Runner'
    ]);
    if (!canRun) {
        console.log('Cannot run - blocked by higher priority mod');
        return;
    }
}
```

### Resource Control

Request and release control of shared resources. Resources are managed through ControlManager instances:

```javascript
// Get or create a control manager for a resource
if (window.ModCoordination) {
    const manager = window.ModCoordination.getControlManager('autoplay', {
        // Optional: custom properties for this manager
    });
}

// Request control before using the resource
if (window.ModCoordination) {
    // Request control (returns true if successful)
    if (!window.ModCoordination.requestControl('autoplay', 'My Mod Name')) {
        console.log('Failed to get autoplay control, another mod has it');
        return;
    }
    
    // Optional: Force takeover (use with caution)
    // window.ModCoordination.requestControl('autoplay', 'My Mod Name', { force: true });
    
    // Use the resource...
    startAutoplay();
}

// Release control when done
if (window.ModCoordination) {
    window.ModCoordination.releaseControl('autoplay', 'My Mod Name');
}

// Check if you have control
if (window.ModCoordination?.hasControl('autoplay', 'My Mod Name')) {
    console.log('I have control of autoplay');
}
```

**Default Control Managers:**
- `'questButton'` - Quest button control (QuestButtonManager)
- `'autoplay'` - Autoplay control (AutoplayManager)
- `'bestiaryAutomatorSettings'` - Bestiary Automator settings control

You can also create custom control managers for other resources.

### Event Subscriptions

Subscribe to state changes instead of polling:

```javascript
// Subscribe to mod registration events
if (window.ModCoordination) {
    const unsubscribeRegistered = window.ModCoordination.on('modRegistered', (data) => {
        console.log('Mod registered:', data.modName);
    });
    
    // Subscribe to mod enabled/disabled changes
    window.ModCoordination.on('modEnabledChanged', (data) => {
        if (data.modName === 'Manual Runner') {
            console.log('Manual Runner enabled:', data.enabled);
        }
    });
    
    // Subscribe to mod active/inactive changes
    window.ModCoordination.on('modActiveChanged', (data) => {
        if (data.modName === 'Manual Runner') {
            console.log('Manual Runner active:', data.active);
            if (data.active) {
                pauseMyMod();
            } else {
                checkAndResumeMyMod();
            }
        }
    });
    
    // Subscribe to priority changes
    window.ModCoordination.on('modPriorityChanged', (data) => {
        console.log(`Priority changed for ${data.modName}: ${data.oldPriority} → ${data.priority}`);
    });
    
    // Subscribe to control events
    window.ModCoordination.on('controlGranted', (data) => {
        console.log(`${data.modName} gained control of ${data.resourceName}`);
    });
    
    window.ModCoordination.on('controlReleased', (data) => {
        console.log(`${data.modName} released control of ${data.resourceName}`);
    });
    
    window.ModCoordination.on('controlTaken', (data) => {
        console.log(`${data.to} took control from ${data.from} for ${data.resourceName}`);
    });
    
    // Unsubscribe when done (optional)
    // unsubscribeRegistered();
}
```

### Additional Methods

The coordination system provides several utility methods:

```javascript
// Get mod state
const modState = window.ModCoordination?.getModState('My Mod Name');
if (modState) {
    console.log('Mod enabled:', modState.enabled);
    console.log('Mod active:', modState.active);
    console.log('Mod priority:', modState.priority);
}

// Check if mod is enabled
if (window.ModCoordination?.isModEnabled('My Mod Name')) {
    console.log('Mod is enabled');
}

// Check if mod is active
if (window.ModCoordination?.isModActive('My Mod Name')) {
    console.log('Mod is active');
}

// Get all registered mods (sorted by priority)
const allMods = window.ModCoordination?.getAllMods();
allMods.forEach(mod => {
    console.log(`${mod.name}: priority ${mod.priority}, enabled: ${mod.enabled}, active: ${mod.active}`);
});

// Get active mods sorted by priority
const activeMods = window.ModCoordination?.getActiveModsByPriority();
console.log('Active mods:', activeMods.map(m => m.name));

// Update mod priority
window.ModCoordination?.updateModPriority('My Mod Name', 100);

// Get coordination summary
const summary = window.ModCoordination?.getSummary();
console.log('Registered mods:', summary.registeredMods);
console.log('Active mods:', summary.activeMods);
console.log('Resources:', summary.resources);
```

### Cleanup

Properly unregister when your mod is disabled:

```javascript
function cleanup() {
    // ... other cleanup code ...
    
    // Release all resources first
    if (window.ModCoordination) {
        const modState = window.ModCoordination.getModState('My Mod Name');
        if (modState) {
            modState.resources.forEach(resource => {
                window.ModCoordination.releaseControl(resource, 'My Mod Name');
            });
        }
    }
    
    // Unregister from coordination system
    if (window.ModCoordination) {
        try {
            window.ModCoordination.unregisterMod('My Mod Name');
        } catch (error) {
            console.warn('Error unregistering from ModCoordination:', error);
        }
    }
}
```

### Priority System

The coordination system uses priorities to automatically resolve conflicts:
- Higher priority mods can block lower priority mods
- When checking `canModRun()`, mods with higher or equal priority will block execution
- Resource control requests respect priorities - higher priority mods can take control

**Best Practices:**
- Use event subscriptions instead of polling for better performance
- Always check if `window.ModCoordination` exists before using it
- Provide fallback behavior for backward compatibility with older mods
- Update your mod's state accurately to help other mods coordinate properly
- Release resource control promptly when done to avoid blocking other mods
- The game uses XState v3, which may have breaking changes compared to previous versions
- Ensure your mod works well with other mods
- Use feature detection instead of assuming availability
- Handle API changes gracefully by checking for the existence of methods before using them

### Logging Best Practices

- **Use `console.log()` directly** for all debug output — no `if (DEBUG)` wrappers, and never reassign `console.*` (the popup **Log Level** controls verbosity globally; a wrapper also breaks DevTools line attribution)
- **Keep logs informative**: Include context like mod name, function name, or relevant data
- **Use appropriate log levels**: `console.log()` for info, `console.warn()` for warnings, `console.error()` for errors — `console.error()` always prints and is always saved to the popup Error Log
- **Clean up sensitive data**: Don't log user credentials or sensitive game state information

## Loader Internals

How the extension loads and runs mods (for loader maintainers; mod authors can skip).

### Loader Overview
The mod loading system is optimized to eliminate duplicate executions, ensure proper loading order, and provide better dependency management. **User-generated scripts from localStorage are automatically loaded.**

### Current Architecture

#### 1. **Unified Execution Path**
The system uses a coordinated execution approach to prevent duplicate executions and race conditions:

- Content script handles all mod execution through `executeLocalMod()` and `executeModsInOrder()`
- Background script registers mods and can trigger execution via messages
- Content script manages execution state and prevents duplicates

#### 2. **Race Condition Prevention**
The system prevents multiple initialization triggers with:

- Initialization promise to prevent simultaneous initializations
- Proper sequencing with `isInitializing` flag
- Reset initialization promise on reload

#### 3. **Sequential Loading Order**
Mods execute in a specific order to ensure dependencies are resolved correctly:

- `executeModsInOrder()` function handles proper sequential execution
- Official Mods load before Super Mods
- OT Mods load after Super Mods
- User scripts load after all file-based mods

#### 4. **User-Generated Scripts Integration**
User scripts stored in localStorage are automatically integrated:

- Automatic loading of user-generated scripts from localStorage
- Integrated with existing mod loading sequence
- Proper state management for user scripts

### Loading Order

#### Page injection (content script → page context)

`injector.js` loads page scripts in this order:

1. **`content/extension-url.js`** — encodes extension URLs and maps logical mod paths (e.g. `Official Mods/`) to on-disk paths
2. **`content/platform.js`** — sets `window.BestiaryPlatform` (desktop strict vs mobile relaxed loader)
3. **`content/client.js`** — `BestiaryModAPI`, UI components
4. **`content/mod-coordination.mjs`** — loaded as `text/javascript` (IIFE, not `type="module"`)
5. **`content/custom-battles.js`**
6. **`content/event-competition.js`**
7. **`content/local_mods.js`** — mod discovery, batch execution, completion signal

`utility_injector.js` (at `document_idle`) loads `ba-sandbox-utils.mjs` (same IIFE / non-module rule). `custom-battles.js` and `event-competition.js` are injected once by `injector.js` to avoid double-loading.

#### Mod execution

The system follows this exact order:

1. **Core page scripts** (above) before bundled mods run
2. **Active Scripts** (remote/URL-based mods)
3. **Local Mods** (in order):
   - **Database scripts** (`database/*`)
   - **Official Mods**
   - **Super Mods**
   - **OT Mods**
   - **User-Generated Scripts** (from localStorage)

#### Desktop vs mobile (relaxed loader)

On **desktop**, the loader uses the strict path: direct page fetch of extension URLs when possible, hydration/game-state checks, and auto-refresh on hard load failures (up to 3 times).

On **mobile WebExtensions** (e.g. Orion iOS), `content/platform.js` enables a **relaxed** path automatically (or when page extension fetch fails):

- Content-script fetch via injector bridge first, then page fetch, then background `getModContent`
- Skip bulk HEAD probes; trust bundled registry lists
- Shorter page-ready waits; hydration/game-state issues are logged but not fatal
- No auto-refresh loop on loader warnings

**Override (testing):** in the game tab console, `sessionStorage.setItem('ba-relaxed-loader', '1')` then reload (use `'0'` or remove the key to restore strict behavior).

Background delivery uses a once-per-page-load guard (`registeredTabs`). That guard must reset on same-tab reload / `contentScriptReady` (see [Orion iOS Compatibility — Page refresh / re-delivery](mobile.md#page-refresh--re-delivery-critical)); otherwise a failed load can stick until the browser process restarts.

See also [`content/platform.js`](../content/platform.js) and [`content/local_mods.js`](../content/local_mods.js). For Orion/WebKit platform constraints and extension URL encoding, see [Orion iOS Compatibility](mobile.md).

### Request-rate overlay (Mod Settings → Advanced → Debug)

The game's API allows **30 requests per 10 s**, shared by the game and every mod. To see who spends that budget, turn on **Show FPS and API requests per 10s** (`showPerfOverlay`). It draws a draggable overlay (default top-left, position saved in `perfOverlayPos`).

- **FPS / Req n/30 / peak / 429×n.** Both counters fade green → red. `Req` is a sliding 10 s window; `peak` is the highest value since the option was turned on; `429×n` counts HTTP 429 responses.
- **Counting.** `window.fetch` is wrapped and every same-origin `/api/*` call is recorded (tRPC batches count once, as the server sees them). Other origins such as Firebase are not counted. Disabling the option restores `fetch` only if nothing wrapped it afterwards.
- **Details** (`perfOverlayAdvanced`) lists one row per mod and endpoint, e.g. `12× Autoseller game.sellMonster`, with All / MOD / NATIVE / OTHER filters (`perfOverlayFilter`). Hover a row for the full caller chain.
- **Classification** reads the stack above the wrapper: the nearest frame in `/bestiary-mod/<Mod>.js` is **MOD** (named after the file), one in `/_next/static/…` is **NATIVE** (shown as `game`), anything else is **OTHER**. Other mods' `fetch` patches with `wrapper`/`hook`/`patch`/`intercept` in their function name are skipped. Firefox/Orion stack formats parse the file and line, but not that skip rule.
- **Copy log.** When the window reaches 30 requests (or a 429 arrives), a snapshot is frozen (last 5 kept). The red **Copy log (n)** button copies them: totals by mod and by mod + endpoint, then a timeline with method, path, status, duration and caller.

### Error Log (popup Debug)

Since **4.2.10**, the extension popup includes an **Error Log** under the **Debug** collapsible section (below **Extras**) for debugging without DevTools (especially on mobile WebExtensions such as Orion iOS).

#### Debug section order

**Log Level** → **Error Log**

#### Log Level (global console controller)

`content/ba-logger.js` is loaded first in every context (background worker, isolated
content-script world, page/MAIN world) and installs one `console` proxy per context. Its
verbosity is a single setting (`storage.local` key `ba-log-level`) chosen in the popup:

| level      | console shows                                   |
|------------|-------------------------------------------------|
| `silent`   | nothing (`console.error` still prints)          |
| `errors`   | `error` only — **default**                      |
| `warnings` | `error`, `warn`                                 |
| `info`     | `error`, `warn`, `log`, `info`                  |
| `verbose`  | everything (`debug`, `trace`, `group*`, `table`, …) |

Changing the level applies live to open game tabs (via `storage.onChanged` in the isolated
world plus a `BESTIARY_EXTENSION`/`updateLogLevel` `postMessage` bridge to the MAIN world) —
no page refresh. The old on/off **Debug Mode** toggle is gone; an existing
`bestiary-debug === true` migrates to `verbose` on first popup open, and `bestiary-debug`
is still written (`true` iff `verbose`) as a read-only back-compat alias.

**Call-site attribution.** The gated methods are installed as accessor properties whose
getter returns the *native* function, so DevTools still shows the real `file:line`. Mods
run via `new Function` with a `//# sourceURL=<page-origin>/bestiary-mod/<Mod_Name>.js` trailer,
so their lines show as `<Mod_Name>.js:123` instead of `VM123:456`. The trailer **must** be an
absolute same-origin `https://` URL — WebKit (Orion/iOS) uses `sourceURL` as the script's real
resource URL and derives its fetch origin from it, so a scheme-less value put every mod in an
opaque origin and broke all cross-origin `fetch()` (Firebase sync) with `TypeError: Load failed`. Only `console.error` is a wrapper
(for the Error Log side effect) — its DevTools line points at `ba-logger.js`, but the stored
entry's `source` is recovered from the captured stack. Mods and loader files must **not**
wrap `console` themselves — any wrapper becomes the attributed frame for every later log.

#### What is captured

- **`console.error`** — always, regardless of level, with a formatted stack / object dump in `detail`
- `console.assert` failures (treated as errors)
- Uncaught errors and unhandled promise rejections (page, isolated world, background) — with stack
- Mod batch load failures and loader-level completion errors
- Background `getModContent` fetch failures (includes failed resource URL in detail)

#### What is not captured

- `console.warn` / `console.log` / `console.info` — printed per the **Log Level**, never stored

#### Persistence and UI

- Stored in `chrome.storage.local` under key `ba-loader-errors` (ring buffer, last **300** entries)
- Survives page reloads until you tap **Clear**
- Prepends a sticky **Device / Browser** header (extension version, browser, platform, device type, language, URL, user-agent, timestamp) that survives **Clear** and is included when copying; uses live page context when a bestiaryarena.com tab is active
- Expanding the **Debug** section auto-refreshes the panel (no separate Refresh button since **4.3.1**)
- **Copy** copies the visible log text to the clipboard

#### Reporting from page-context code

Mods and loader scripts can emit structured entries:

```javascript
window.BestiaryLoaderErrorLog?.report('My Mod', 'Short message', 'Optional detail');
```

Entries are sent to the content script via `postMessage` and merged into the same storage.

### Benefits

1. **Performance**: Eliminates duplicate executions and reduces overhead
2. **Reliability**: Proper error handling and state management
3. **Predictability**: Consistent loading order ensures dependencies are resolved correctly
4. **Maintainability**: Cleaner separation of concerns between background and content scripts
5. **User Experience**: Automatic loading of user-generated scripts

### Browser Compatibility & Limitations

#### Chrome Service Worker Restrictions

**Important**: Chrome service workers have strict limitations that affect the mod loading system:

- **Dynamic Imports**: Chrome service workers cannot use `import()` or `new Function()` (HTML spec restriction)
- **Firefox Support**: Firefox background scripts can use dynamic imports normally
- **Fallback Strategy**: Chrome uses hardcoded lists that must be kept in sync with `mod-registry.js`

#### Registry Loading Strategy

The system uses different approaches for each browser:

1. **Firefox**: Dynamically imports `mod-registry.js` to get `DEFAULT_ENABLED_MODS`
2. **Chrome**: Uses hardcoded fallback list in `loadDefaultEnabledMods()` function
3. **Error Handling**: Multiple fallback layers ensure the system works even if registry loading fails

#### Maintenance Requirements

When adding new mods to `DEFAULT_ENABLED_MODS`:

- **Firefox**: Automatically uses updated `mod-registry.js`
- **Chrome**: Must manually update hardcoded list in `background.js` `loadDefaultEnabledMods()` function
- **Documentation**: The limitation is clearly documented in the code for future maintainers

### User-Generated Scripts Support

The system automatically loads user-generated scripts stored in localStorage:

- **Storage**: Scripts are stored under the `manualMods` key in localStorage
- **Auto-loading**: User scripts are automatically loaded after Official and Super mods
- **Execution**: Scripts are executed in the order they were created
- **State Management**: Enabled/disabled state is preserved across sessions
- **Fallback**: Works with both browserAPI.storage and direct localStorage access

#### User Script Format
```javascript
{
  name: "My Custom Script",
  content: "// Your JavaScript code here",
  enabled: true
}
```

#### Integration Points
- User scripts are automatically detected during initialization
- They appear in the mod list with type `manual`
- Content is executed directly without file fetching
- State changes are preserved in localStorage 

## Examples

### Simple Mod: Show Current Monster Count

```javascript
// Monster Counter Mod
console.log('Monster Counter Mod initializing...');

// Create UI button
api.ui.addButton({
  id: 'monster-counter-button',
  text: 'Count',
  icon: '👾',
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

### Quest mod data (`assets/quests`)

The bundled **Quests** mod (`mods/OT_Mods/Quests.js`) loads copy, items, battles, placements, and tuning from JSON under `assets/quests/`. See **[assets/quests/README.md](../assets/quests/README.md)** — the single source of truth for that mod's data — for the file map, reward field conventions (`rewardCoins`, `{coins}` in dialogue, `rewardProductId`), what stays in JavaScript, the Board NPC / teleport-battle-quest patterns, item-lifecycle reconciliation, and the checklist for adding a mission.

- [Mobile](mobile.md) - WebKit/Orion platform constraints and extension resource loading
- [UI Components and Management](ui_components.md) - Game-styled components plus the `api.ui` button and config-panel API
- [Client API Documentation](client_api.md) - Complete reference for the game's Client API
- [Game State API Documentation](game_state_api.md) - Game state, mod databases, and utility functions (`serializeBoard`, `replay`, name/ID maps)
- [Custom Board Setups](custom_board_setups.md) - Board placement and game event examples
- [Raid System API](raid_system_api.md) - Raid state machine reference for automation mods
- [Firebase Best Runs API](firebase_runs_api.md) - Fetch and decrypt Mod Settings best-runs uploads
- [Fetch Best Runs (HTML tool)](fetch-best-runs.html) - Browser UI for fetching and decrypting uploaded runs
- [VIP List Chat](chat_documentation.md) - Private and All Chat via Firebase
- [Bestiary Arena Wiki](https://bestiaryarena.wiki.gg/) - Information about the game mechanics 