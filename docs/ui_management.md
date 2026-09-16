# Bestiary Arena Mod Loader - UI Management API

This document describes how to use the UI Management API provided by the Bestiary Arena Mod Loader. This API provides a standardized way to create and manage UI elements like buttons and configuration panels for your mods.

## Why Use the UI Management API?

1. **Consistent UI**: All mods use the same styling and positioning for UI elements
2. **Automatic Layout**: Buttons are automatically organized in a consistent location
3. **Conflict Prevention**: Prevents overlapping UI elements from different mods
4. **Easy Implementation**: Simple API calls instead of manual DOM manipulation
5. **Better User Experience**: Users get a more cohesive interface

## Available APIs

The UI Management API is available via `api.ui` in your mod's context.

### Button Management

#### Adding a Button

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

#### Mod bar button labels (text and icons)

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

#### Updating a Button

```javascript
api.ui.updateButton('my-mod-button', {
  text: 'New Text',          // New button text
  primary: true,             // Update primary state
  tooltip: 'New tooltip'     // New tooltip
});
```

#### Removing a Button

```javascript
api.ui.removeButton('my-mod-button');
```

### Configuration Panel Management

#### Creating a Configuration Panel

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

#### Toggling a Configuration Panel

```javascript
api.ui.toggleConfigPanel('my-mod-config');
```

#### Hiding All Configuration Panels

```javascript
api.ui.hideAllConfigPanels();
```

#### Removing a Configuration Panel

```javascript
api.ui.removeConfigPanel('my-mod-config');
```

## Example: Complete Mod with UI Management

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

## Best Practices

1. Always use unique IDs for your UI elements, preferably prefixed with your mod ID
2. Group related buttons together by using a consistent `modId`
3. Use primary styling (green) only for the main action button
4. Always provide both `text` and `icon` on mod bar buttons so text and icon display modes work
5. Always provide tooltips on mod bar buttons (used on hover and as a text fallback)
6. Always clean up your UI elements if your mod is disabled or removed
7. Keep configuration panels simple and focused
8. Use the standard Apply/Cancel pattern for configuration panels
9. Update button text through `api.ui.updateButton`, not direct `textContent` changes

## Troubleshooting

- If your buttons don't appear, check the console for errors
- If buttons overlap, you might be creating them manually instead of using the API
- If config panels don't open, make sure you're using the correct panel ID
- If UI elements remain after your mod is disabled, add cleanup code