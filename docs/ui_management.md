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
  text: 'Click Me',          // Button text
  modId: 'my-mod',           // ID of your mod (for grouping)
  primary: false,            // Whether this is a primary button (green)
  icon: null,                // Optional icon character (e.g. '⚙️')
  tooltip: 'Click to use',   // Optional tooltip text
  position: null,            // Optional position index in the button container
  onClick: (e) => {          // Click handler
    // Button clicked
  }
});
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
  ]
});
```

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
4. Always provide tooltips for icon-only buttons
5. Always clean up your UI elements if your mod is disabled or removed
6. Keep configuration panels simple and focused
7. Use the standard Apply/Cancel pattern for configuration panels
8. Update button text and styling to reflect the current state

## Troubleshooting

- If your buttons don't appear, check the console for errors
- If buttons overlap, you might be creating them manually instead of using the API
- If config panels don't open, make sure you're using the correct panel ID
- If UI elements remain after your mod is disabled, add cleanup code

# UI Management API

The UI Management API provides a standardized way for mods to create and manage UI elements in the game. This ensures a consistent user experience across different mods and simplifies UI implementation for mod developers.

## API Methods

### Button Management

```javascript
// Add a button to the UI
BestiaryModAPI.ui.addButton(options)
```

Parameters:
- `options` (Object) - Configuration options for the button
  - `id` (String) - Unique identifier for the button
  - `text` (String) - Button text
  - `position` (String) - Position on screen ('top-right', 'bottom-left', etc.)
  - `onClick` (Function) - Callback function when button is clicked
  - `style` (Object, optional) - Custom CSS styles
  - `icon` (String, optional) - Icon class or URL
  - `tooltip` (String, optional) - Tooltip text
  - `group` (String, optional) - Group buttons together in a dropdown

```javascript
// Remove a button from the UI
BestiaryModAPI.ui.removeButton(id)
```

Parameters:
- `id` (String) - ID of the button to remove

### Modal Management

```javascript
// Show a modal dialog
BestiaryModAPI.ui.showModal(options)
```

Parameters:
- `options` (Object) - Configuration options for the modal
  - `title` (String) - Modal title
  - `content` (String|HTMLElement) - Modal content
  - `buttons` (Array, optional) - Array of button objects
    - `text` (String) - Button text
    - `primary` (Boolean, optional) - Is this the primary button
    - `onClick` (Function, optional) - Button click handler
  - `closeOnClickOutside` (Boolean, optional) - Close when clicking outside
  - `width` (String, optional) - Modal width (e.g., '500px')
  - `height` (String, optional) - Modal height (e.g., '300px')

### Configuration Panel

```javascript
// Create a configuration panel for the mod
BestiaryModAPI.ui.createConfigPanel(options)
```

Parameters:
- `options` (Object) - Configuration options for the panel
  - `id` (String) - Unique identifier for the panel
  - `title` (String) - Panel title
  - `fields` (Array) - Array of configuration field objects
    - `id` (String) - Field identifier
    - `type` (String) - Field type ('checkbox', 'select', 'text', 'color', 'slider')
    - `label` (String) - Field label
    - `value` (Any) - Current value
    - `options` (Array, optional) - Options for select fields
    - `min` (Number, optional) - Minimum value for sliders
    - `max` (Number, optional) - Maximum value for sliders
    - `step` (Number, optional) - Step value for sliders
    - `onChange` (Function, optional) - Change handler
  - `onSave` (Function) - Callback when settings are saved
  - `onCancel` (Function, optional) - Callback when cancelled

```javascript
// Open a configuration panel
BestiaryModAPI.ui.openConfigPanel(id)
```

Parameters:
- `id` (String) - ID of the panel to open

```javascript
// Close a configuration panel
BestiaryModAPI.ui.closeConfigPanel(id)
```

Parameters:
- `id` (String) - ID of the panel to close

### Notification System

```javascript
// Show a notification
BestiaryModAPI.ui.notify(options)
```

Parameters:
- `options` (Object) - Configuration options for the notification
  - `message` (String) - Notification message
  - `type` (String, optional) - Type of notification ('info', 'success', 'warning', 'error')
  - `duration` (Number, optional) - Duration in ms before auto-hide
  - `position` (String, optional) - Screen position ('top-right', 'bottom-left', etc.)

## Usage Example

```javascript
// Add a button to toggle a feature
BestiaryModAPI.ui.addButton({
  id: 'my-mod-toggle',
  text: 'Toggle Feature',
  position: 'top-right',
  onClick: () => toggleFeature(),
  tooltip: 'Enable or disable my awesome feature'
});

// Create a configuration panel
BestiaryModAPI.ui.createConfigPanel({
  id: 'my-mod-config',
  title: 'My Mod Settings',
  fields: [
    {
      id: 'enabled',
      type: 'checkbox',
      label: 'Enable Feature',
      value: true
    },
    {
      id: 'color',
      type: 'color',
      label: 'Feature Color',
      value: '#ff0000'
    },
    {
      id: 'speed',
      type: 'slider',
      label: 'Animation Speed',
      value: 50,
      min: 0,
      max: 100,
      step: 1
    }
  ],
  onSave: (values) => {
    // Save the configuration
    localStorage.setItem('my-mod-config', JSON.stringify(values));
    // Apply changes
    applyConfiguration(values);
  }
});

// Open the configuration panel when needed
function openSettings() {
  BestiaryModAPI.ui.openConfigPanel('my-mod-config');
}

// Show a notification
BestiaryModAPI.ui.notify({
  message: 'Settings saved successfully!',
  type: 'success',
  duration: 3000
});
```

## Best Practices

1. Use unique IDs for your UI elements by prefixing them with your mod name to avoid conflicts.
2. Clean up all UI elements when your mod is disabled using `removeButton` and other cleanup methods.
3. Use consistent positions for UI elements to provide a clean interface.
4. Use the notification system for temporary messages rather than alerts.
5. Store user configuration using the API's built-in storage or localStorage.
6. Respect user preferences for UI placement and styling.
7. Keep UI interactions simple and intuitive. 