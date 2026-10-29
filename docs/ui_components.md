# Bestiary Arena Mod Loader - UI Components and Management

This document provides detailed information about the UI components available in the Bestiary Arena Mod Loader. These components are designed to match the game's visual style and provide a consistent user experience across all mods.

## Accessing UI Components

UI components are available through the `api.ui.components` object in your mod:

```javascript
// Example: Creating a modal
api.ui.components.createModal({
  title: 'My Modal',
  content: 'Hello World',
  buttons: [{ text: 'OK', primary: true }]
});
```

## Available Components

### Modals

Modals are dialog windows that appear on top of the game interface.

#### `createModal(options)`

Creates a styled modal dialog.

**Parameters:**

- `options` (Object):
  - `title` (String): The title of the modal
  - `width` (Number|String, optional): Width in pixels or CSS value, default: 300
  - `height` (Number|String, optional): Height in pixels or CSS value, default: 'auto'
  - `content` (String|HTMLElement): The content to display
  - `buttons` (Array, optional): Array of button configurations
    - `text` (String): Button text
    - `primary` (Boolean, optional): Whether this is a primary button (green)
    - `onClick` (Function, optional): Click handler, receives (event, modalObj)
    - `closeOnClick` (Boolean, optional): Whether to close the modal when clicked, default: true

Modals also apply `max-width: 95vw` and `max-height: 95vh` so they stay on screen without extra code. When `height` is a number, `createModal` flex-fills the inner wrapper and `.widget-bottom` so content can use `height: 100%` / flex children. For larger custom modals, prefer a `MODAL_CONFIG` with `viewportPadding` / `minWidth` / `minHeight`, call `setupModalResponsiveLayout` immediately after open (`requestAnimationFrame` for first paint, `resize` listener until close — see [Mod Development Guide](mod_development_guide.md#responsive-modals)).

**Returns:**

- Object with:
  - `element` (HTMLElement): The modal DOM element
  - `close()` (Function): Method to close the modal

**Example:**

```javascript
const modal = api.ui.components.createModal({
  title: 'Important Information',
  width: 400,
  content: '<p>This is important information for the user.</p>',
  buttons: [
    {
      text: 'Proceed',
      primary: true,
      onClick: (e, modal) => {
        console.log('User clicked Proceed');
        // You can access the modal object to manipulate it
      }
    },
    {
      text: 'Cancel',
      primary: false
    }
  ]
});

// You can programmatically close the modal
setTimeout(() => modal.close(), 5000); // Close after 5 seconds
```

For mod **settings** dialogs, use `api.ui.createConfigPanel()` instead — shared **350×800** desktop max (configurable), viewport clamping, internal scroll, and resize handling are built in.

### Scrollable Containers

Scrollable containers provide a way to display content that exceeds the available space.

#### `createScrollContainer(options)`

Creates a styled scrollable container.

**Parameters:**

- `options` (Object):
  - `height` (Number|String): Height in pixels or CSS value, default: 264
  - `padding` (Boolean, optional): Whether to add padding, default: true
  - `content` (String|HTMLElement, optional): Initial content

**Returns:**

- Object with:
  - `element` (HTMLElement): The container DOM element
  - `addContent(content)` (Function): Method to add content
  - `clearContent()` (Function): Method to clear all content
  - `scrollTo(options)` (Function): Method to scroll to a position

**Example:**

```javascript
const scrollContainer = api.ui.components.createScrollContainer({
  height: 300,
  padding: true,
  content: '<p>Initial content</p>'
});

// Add more content
scrollContainer.addContent('<p>More content</p>');
scrollContainer.addContent(document.createElement('div'));

// Clear all content
scrollContainer.clearContent();

// Scroll to top
scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });

// Add the container to the DOM
document.body.appendChild(scrollContainer.element);
```

### Monster Portraits

Monster portraits display game monsters with proper styling.

#### `createMonsterPortrait(options)`

Creates a styled monster portrait.

**Parameters:**

- `options` (Object):
  - `monsterId` (Number): The monster ID
  - `level` (Number, optional): The monster level, default: 1
  - `tier` (Number, optional): The monster tier (1-5), default: 1
  - `onClick` (Function, optional): Click handler

**Returns:**

- HTMLElement: The monster portrait element

**Example:**

```javascript
const monsterPortrait = api.ui.components.createMonsterPortrait({
  monsterId: 21, // Rat
  level: 50,
  tier: 4,
  onClick: () => showMonsterDetails(21)
});

// Add the portrait to the DOM
document.body.appendChild(monsterPortrait);
```

#### `createFullMonster(options)`

Creates a full monster display with background, level, and stars.

**Parameters:**

- `options` (Object):
  - `monsterId` (Number): The monster ID
  - `tier` (Number): The monster tier (1-5)
  - `starTier` (Number, optional): The star level (0-3), default: 0
  - `level` (Number): The monster level
  - `size` (String, optional): Size ('small', 'medium', 'large'), default: 'medium'
  - `spriteId` (Number, optional): Custom sprite ID, defaults to monsterId

**Returns:**

- HTMLElement: The full monster element

**Example:**

```javascript
const fullMonster = api.ui.components.createFullMonster({
  monsterId: 21,
  tier: 3,
  starTier: 2,
  level: 50,
  size: 'medium'
});

// Add the monster to the DOM
document.body.appendChild(fullMonster);
```

### Item Portraits

Item portraits display game items with proper styling.

#### `createItemPortrait(options)`

Creates a styled item portrait.

**Parameters:**

- `options` (Object):
  - `itemId` (Number): The item sprite ID
  - `stat` (String, optional): The stat type ('ad', 'ap', 'hp'), default: 'ad'
  - `tier` (Number, optional): The item tier (1-5), default: 1
  - `onClick` (Function, optional): Click handler

**Returns:**

- HTMLElement: The item portrait element

**Example:**

```javascript
const itemPortrait = api.ui.components.createItemPortrait({
  itemId: 3079, // Example item ID
  stat: 'ap',
  tier: 3,
  onClick: () => showItemDetails(3079)
});

// Add the portrait to the DOM
document.body.appendChild(itemPortrait);
```

### Room List Items

Room list items display game rooms with proper styling.

#### `createRoomListItem(options)`

Creates a styled room list item.

**Parameters:**

- `options` (Object):
  - `roomId` (String): The room ID
  - `name` (String): The room name
  - `rank` (Object): The room rank information
    - `grade` (String): The rank letter grade (S+, A, B, etc.)
    - `points` (Number): The rank points
  - `personalTime` (Object): The player's best time
    - `display` (String): Display format (e.g., "0:08")
    - `ticks` (Number): Time in game ticks
  - `worldTime` (Object, optional): The world record time (same format as personalTime)
  - `onClick` (Function, optional): Click handler

**Returns:**

- HTMLElement: The room list item element

**Example:**

```javascript
const roomItem = api.ui.components.createRoomListItem({
  roomId: 'rkswrs',
  name: 'Sewers',
  rank: { grade: 'S+', points: 10 },
  personalTime: { display: '0:08', ticks: 130 },
  worldTime: { display: '0:07', ticks: 120 },
  onClick: () => showRoomDetails('rkswrs')
});

// Add the room item to the DOM
document.body.appendChild(roomItem);
```

### Navigation Breadcrumbs

Navigation breadcrumbs provide a way to show hierarchical navigation.

#### `createNavBreadcrumb(options)`

Creates a navigation breadcrumb component.

**Parameters:**

- `options` (Object):
  - `paths` (Array): Array of path names
  - `onBack` (Function, optional): Handler for back button click

**Returns:**

- HTMLElement: The navigation breadcrumb element

**Example:**

```javascript
const breadcrumb = api.ui.components.createNavBreadcrumb({
  paths: ['Home', 'Monsters', 'Rat'],
  onBack: () => navigateBack()
});

// Add the breadcrumb to the DOM
document.body.appendChild(breadcrumb);
```

## Best Practices

1. **Always use the component library** for UI elements to ensure consistency
2. **Handle errors gracefully** when working with UI components
3. **Adapt to different screen sizes** by using flexible widths
4. **Use primary buttons sparingly** (only for the main action)
5. **Clear up resources** when your mod is disabled
6. **Test thoroughly** to ensure UI works correctly across browsers

## Example: Complete UI Flow

Here's an example of a complete UI flow using multiple components:

```javascript
function showMonsterBrowser() {
  try {
    const mainContainer = document.createElement('div');
    
    // Add navigation breadcrumb
    const breadcrumb = api.ui.components.createNavBreadcrumb({
      paths: ['Home', 'Monsters'],
      onBack: () => console.log('Back to home')
    });
    mainContainer.appendChild(breadcrumb);
    
    // Create scrollable container for monster portraits
    const scrollContainer = api.ui.components.createScrollContainer({
      height: 400,
      padding: true
    });
    
    // Add monster portraits
    for (let i = 1; i <= 10; i++) {
      const monsterPortrait = api.ui.components.createMonsterPortrait({
        monsterId: i,
        level: i * 10,
        tier: Math.min(Math.ceil(i/2), 5),
        onClick: () => showMonsterDetails(i)
      });
      
      scrollContainer.addContent(monsterPortrait);
    }
    
    mainContainer.appendChild(scrollContainer.element);
    
    // Show the main modal
    api.ui.components.createModal({
      title: 'Monster Browser',
      width: 500,
      content: mainContainer,
      buttons: [{ text: 'Close', primary: true }]
    });
  } catch (error) {
    console.error('Error showing monster browser:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to load monster browser.</p>',
      buttons: [{ text: 'OK', primary: true }]
    });
  }
}

function showMonsterDetails(monsterId) {
  try {
    const monsterData = globalThis.state?.utils?.getMonster?.(monsterId);
    const name = monsterData?.metadata?.name || `Monster #${monsterId}`;
    
    const contentContainer = document.createElement('div');
    
    // Show the full monster portrait
    const fullMonster = api.ui.components.createFullMonster({
      monsterId: monsterId,
      tier: 3,
      starTier: 2,
      level: 50,
      size: 'medium'
    });
    
    const centeringWrapper = document.createElement('div');
    centeringWrapper.style.cssText = 'display: flex; justify-content: center; margin-bottom: 15px;';
    centeringWrapper.appendChild(fullMonster);
    contentContainer.appendChild(centeringWrapper);
    
    // Add monster stats
    const statsContainer = document.createElement('div');
    statsContainer.innerHTML = `
      <h3>Monster Statistics</h3>
      <p>Base HP: ${monsterData?.metadata?.baseStats?.hp || 'Unknown'}</p>
      <p>Base AD: ${monsterData?.metadata?.baseStats?.ad || 'Unknown'}</p>
      <p>Base AP: ${monsterData?.metadata?.baseStats?.ap || 'Unknown'}</p>
    `;
    contentContainer.appendChild(statsContainer);
    
    // Show the monster details modal
    api.ui.components.createModal({
      title: name,
      width: 350,
      content: contentContainer,
      buttons: [{ text: 'Close', primary: true }]
    });
  } catch (error) {
    console.error('Error showing monster details:', error);
    
    api.ui.components.createModal({
      title: 'Error',
      content: '<p>Failed to load monster details.</p>',
      buttons: [{ text: 'OK', primary: true }]
    });
  }
}
```

This documentation provides a comprehensive reference for all UI components in the Bestiary Arena Mod Loader. For more information on creating mods, see the [Mod Development Guide](mod_development_guide.md). 
## UI Management

This document describes how to use the UI Management API provided by the Bestiary Arena Mod Loader. This API provides a standardized way to create and manage UI elements like buttons and configuration panels for your mods.

### Why Use the UI Management API?

1. **Consistent UI**: All mods use the same styling and positioning for UI elements
2. **Automatic Layout**: Buttons are automatically organized in a consistent location
3. **Conflict Prevention**: Prevents overlapping UI elements from different mods
4. **Easy Implementation**: Simple API calls instead of manual DOM manipulation
5. **Better User Experience**: Users get a more cohesive interface

### Available APIs

The UI Management API is available via `api.ui` in your mod's context.

#### Button Management

##### Adding a Button

```javascript
const button = api.ui.addButton({
  id: 'my-mod-button',       // Unique ID for the button
  text: 'Click Me',          // Button text (required for text mode)
  modId: 'my-mod',           // ID of your mod (for grouping)
  primary: false,            // Whether this is a primary button (green)
  icon: '⚙️',                // Icon character (required for icon mode)
  tooltip: 'Click to use',   // Tooltip (also used as text fallback if text is omitted)
  position: null,            // Optional position index in the button container
  onClick: (e) => {          // Click handler
    // Button clicked
  }
});
```

##### Mod bar button labels (text and icons)

Mod buttons in the bottom-right mod bar support two display modes. Users choose between them in **Mod Settings → Interface → Mod bar button labels**:

- **Text** — shows each button's `text` value
- **Icons** — shows each button's `icon` value (or a built-in registry icon matched by button `id`)

**Always provide both `text` and `icon` when calling `addButton`.** If you only pass one, the other mode will look wrong (blank label, generic 🔧 icon, or tooltip text used as a fallback).

```javascript
api.ui.addButton({
  id: 'my-mod-button',
  text: t('mods.myMod.buttonText'),
  icon: '🎯',
  modId: 'my-mod',
  tooltip: t('mods.myMod.buttonTooltip'),
  onClick: openMyMod
});
```

Built-in mods should also add an entry for the button `id` in `MOD_BUTTON_ICON_REGISTRY` inside `content/client.js`, so icon mode stays consistent even when a mod omits `icon`.

When button text changes at runtime (for example enable/disable labels), update through the API instead of setting `button.textContent` directly:

```javascript
api.ui.updateButton('my-mod-button', {
  text: config.enabled ? 'Disable' : 'Enable',
  tooltip: 'Toggle my mod'
});
```

Direct DOM updates bypass the text/icon display mode and can leave cards blank in one mode.

To re-apply the user's display preference after bulk UI changes:

```javascript
api.ui.refreshModButtonLabels();
```

##### Updating a Button

```javascript
api.ui.updateButton('my-mod-button', {
  text: 'New Text',          // New button text
  primary: true,             // Update primary state
  tooltip: 'New tooltip'     // New tooltip
});
```

##### Removing a Button

```javascript
api.ui.removeButton('my-mod-button');
```

#### Configuration Panel Management

##### Creating a Configuration Panel

```javascript
const panel = api.ui.createConfigPanel({
  id: 'my-mod-config',         // Unique ID for the panel
  title: 'My Mod Settings',    // Panel title
  modId: 'my-mod',             // ID of your mod (for grouping)
  content: htmlElementOrString, // Content (HTML element, string, or function)
  buttons: [                   // Buttons at the bottom of the panel
    {
      text: 'Apply',
      primary: true,
      onClick: (e, panel) => {
        // Apply button clicked
        // panel is a reference to the config panel
      },
      closeOnClick: true       // Whether to close the panel when clicked
    },
    {
      text: 'Cancel',
      primary: false,
      onClick: null,           // Optional click handler
      closeOnClick: true       // Defaults to true
    }
  ],
  width: 350,                  // Optional desktop max width (default 350)
  height: 800,                 // Optional desktop max height (default 800)
  onOpen: () => {              // Optional callback when the panel opens
    // Refresh form fields from saved config
  }
});
```

On desktop the panel opens at up to **350×800** (or your `width`/`height` caps). On narrow viewports it clamps to the available screen with 16px padding (minimum 280×200). Tall content scrolls inside the panel; layout updates on window resize and cleans up when the panel closes.

Content can be:
- An HTML string
- An HTML Element
- A function that receives the panel element and can modify it

##### Toggling a Configuration Panel

```javascript
api.ui.toggleConfigPanel('my-mod-config');
```

##### Hiding All Configuration Panels

```javascript
api.ui.hideAllConfigPanels();
```

##### Removing a Configuration Panel

```javascript
api.ui.removeConfigPanel('my-mod-config');
```

### Example: Complete Mod with UI Management

Here's a complete example of a mod that uses the UI Management API:

```javascript
// Configuration
const defaultConfig = {
  enabled: false,
  intensity: 5
};

const config = Object.assign({}, defaultConfig, context.config);
const api = context.api;

// Constants
const MOD_ID = 'my-awesome-mod';
const BUTTON_ID = `${MOD_ID}-button`;
const CONFIG_BUTTON_ID = `${MOD_ID}-config-button`;
const CONFIG_PANEL_ID = `${MOD_ID}-config-panel`;

// Toggle main functionality
function toggleFeature() {
  config.enabled = !config.enabled;
  
  // Update button appearance
  api.ui.updateButton(BUTTON_ID, {
    text: config.enabled ? 'Disable Feature' : 'Enable Feature',
    primary: config.enabled
  });
  
  // Save configuration
  api.service.updateScriptConfig(context.hash, config);
  
  // Show feedback
  api.showModal({
    title: 'Feature Status',
    content: `Feature is now ${config.enabled ? 'enabled' : 'disabled'}!`,
    // Each button: { text, onClick, primary?, closeOnClick?, variant? }
    //   primary: true        → green background
    //   variant: 'danger'    → red game-asset button (frame-1-red / surface-red)
    buttons: [{ text: 'OK', primary: true }]
  });
}

// Create the configuration panel
function createConfigPanel() {
  // Create the content element
  const content = document.createElement('div');
  
  // Add an intensity slider
  const container = document.createElement('div');
  container.style.marginBottom = '10px';
  
  const label = document.createElement('label');
  label.htmlFor = 'intensity-input';
  label.textContent = 'Intensity: ';
  
  const input = document.createElement('input');
  input.type = 'range';
  input.id = 'intensity-input';
  input.min = '1';
  input.max = '10';
  input.value = config.intensity;
  input.style.width = '100%';
  
  container.appendChild(label);
  container.appendChild(input);
  content.appendChild(container);
  
  // Create the panel
  return api.ui.createConfigPanel({
    id: CONFIG_PANEL_ID,
    title: 'Feature Settings',
    modId: MOD_ID,
    content: content,
    buttons: [
      {
        text: 'Apply',
        primary: true,
        onClick: () => {
          // Update configuration
          config.intensity = parseInt(document.getElementById('intensity-input').value);
          api.service.updateScriptConfig(context.hash, config);
        }
      },
      { text: 'Cancel', primary: false }
    ]
  });
}

// Initialize the mod
function init() {
  console.log('My awesome mod initialized');
  
  // Add main feature button
  api.ui.addButton({
    id: BUTTON_ID,
    text: config.enabled ? 'Disable Feature' : 'Enable Feature',
    modId: MOD_ID,
    primary: config.enabled,
    onClick: toggleFeature
  });
  
  // Add configuration button
  api.ui.addButton({
    id: CONFIG_BUTTON_ID,
    icon: '⚙️',
    tooltip: 'Feature Settings',
    modId: MOD_ID,
    onClick: () => api.ui.toggleConfigPanel(CONFIG_PANEL_ID)
  });
  
  // Create config panel
  createConfigPanel();
}

// Start the mod
init();

// Export functionality
context.exports = {
  toggleFeature,
  updateConfig: (newConfig) => {
    Object.assign(config, newConfig);
    
    // Update UI as needed
    api.ui.updateButton(BUTTON_ID, {
      text: config.enabled ? 'Disable Feature' : 'Enable Feature',
      primary: config.enabled
    });
  }
};
```

### Best Practices

1. Always use unique IDs for your UI elements, preferably prefixed with your mod ID
2. Group related buttons together by using a consistent `modId`
3. Use primary styling (green) only for the main action button
4. Always provide both `text` and `icon` on mod bar buttons so text and icon display modes work
5. Always provide tooltips on mod bar buttons (used on hover and as a text fallback)
6. Always clean up your UI elements if your mod is disabled or removed
7. Keep configuration panels simple and focused
8. Use the standard Apply/Cancel pattern for configuration panels
9. Update button text through `api.ui.updateButton`, not direct `textContent` changes

### Troubleshooting

- If your buttons don't appear, check the console for errors
- If buttons overlap, you might be creating them manually instead of using the API
- If config panels don't open, make sure you're using the correct panel ID
- If UI elements remain after your mod is disabled, add cleanup code
