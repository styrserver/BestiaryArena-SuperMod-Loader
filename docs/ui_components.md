# Bestiary Arena Mod Loader - UI Components

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