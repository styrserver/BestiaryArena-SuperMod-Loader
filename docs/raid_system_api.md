# Bestiary Arena Mod Loader - Raid System API Documentation

This document provides comprehensive information about the raid system in Bestiary Arena, including available states, events, actions, and monitoring techniques discovered through console testing.

> **Credits**: This documentation was created through extensive testing and analysis of the game's raid system using the Game State API.

## Overview

The raid system in Bestiary Arena is managed through `globalThis.state.raids` and follows the XState state machine pattern. It handles periodic fetching of raid data from the server and provides events for monitoring raid availability.

## Raid State Structure

### Accessing Raid State

```javascript
// Get current raid state
const raidState = globalThis.state.raids.getSnapshot();
console.log(raidState.context);
```

### Raid Context Properties

The raid context contains the following properties:

```javascript
{
  "list": [],                    // Array of current raids (empty when no raids available)
  "msUntilNextUpdate": 843876,  // Milliseconds until next raid check
  "willUpdateAt": 1757666700172, // Timestamp of next update
  "type": "setData"             // Current state type
}
```

#### Property Details

- **`list`**: Array containing active raids. Each raid object contains raid-specific data
- **`msUntilNextUpdate`**: Countdown timer showing milliseconds until the next server check for raids
- **`willUpdateAt`**: Unix timestamp indicating when the next update will occur
- **`type`**: Current state machine state (typically "setData")

## Raid Events

### Available Events

The raid system supports the following events:

#### 1. `newRaid` Event
**Primary event for detecting new raids**

```javascript
const unsubscribe = globalThis.state.raids.on("newRaid", (e) => {
  console.log("New raid detected:", e.raid);
  // Handle new raid logic here
});

// Clean up when done
unsubscribe();
```

#### 2. `setData` Event
**Triggered when raid data is updated**

```javascript
const unsubscribe = globalThis.state.raids.on("setData", (e) => {
  console.log("Raid data updated:", e);
});
```

#### 3. XState Internal Events
- `@xstate.init` - State machine initialization
- `@xstate.actor` - Actor events
- `@xstate.snapshot` - State snapshot events

### Event Monitoring

```javascript
// Monitor all raid events
const unsubscribe = globalThis.state.raids.inspect((event) => {
  console.log("Raid event:", {
    type: event.type,
    eventType: event.event?.type,
    hasData: !!event.event?.data,
    hasRaid: !!event.event?.raid
  });
});
```

## Raid Actions

### Available Actions

The raid state machine accepts the following actions:

#### 1. `refreshRaid`
**Force refresh of raid data**

```javascript
// Basic refresh
globalThis.state.raids.send({ type: 'refreshRaid' });

// Refresh with options
globalThis.state.raids.send({ 
  type: 'refreshRaid', 
  force: true 
});
```

#### 2. `checkRaid`
**Check for new raids**

```javascript
globalThis.state.raids.send({ 
  type: 'checkRaid',
  timestamp: Date.now()
});
```

#### 3. `loadRaid`
**Load raid data**

```javascript
globalThis.state.raids.send({ 
  type: 'loadRaid',
  source: 'manual'
});
```

#### 4. `updateRaid`
**Update raid information**

```javascript
globalThis.state.raids.send({ 
  type: 'updateRaid',
  data: { refresh: true }
});
```

#### 5. `startRaid`
**Start a specific raid**

```javascript
globalThis.state.raids.send({ 
  type: 'startRaid',
  raidId: 'raid-id-here'
});
```

#### 6. `endRaid`
**End a specific raid**

```javascript
globalThis.state.raids.send({ 
  type: 'endRaid',
  raidId: 'raid-id-here'
});
```

## Monitoring Techniques

### 1. Raid List Monitoring

```javascript
// Monitor for changes in the raid list
let lastRaidList = [];
const raidListMonitor = globalThis.state.raids.subscribe((state) => {
  const currentList = state.context.list || [];
  if (JSON.stringify(currentList) !== JSON.stringify(lastRaidList)) {
    console.log("Raid list changed:", {
      previous: lastRaidList,
      current: currentList,
      changeType: currentList.length > lastRaidList.length ? "ADDED" : "REMOVED"
    });
    lastRaidList = [...currentList];
  }
});
```

### 2. Periodic State Checking

```javascript
// Check raid state every 30 seconds
const raidStateChecker = setInterval(() => {
  const raidState = globalThis.state.raids.getSnapshot();
  console.log("Raid state:", {
    listLength: raidState.context.list.length,
    msUntilUpdate: raidState.context.msUntilNextUpdate,
    type: raidState.context.type
  });
}, 30000);
```

### 3. Network Request Monitoring

```javascript
// Monitor fetch requests for raid-related data
const originalFetch = window.fetch;
window.fetch = function(...args) {
  const url = args[0];
  if (typeof url === 'string' && (url.includes('raid') || url.includes('event'))) {
    console.log('Raid-related fetch request:', url, args[1]);
  }
  return originalFetch.apply(this, args);
};
```

### 4. DOM Monitoring

```javascript
// Monitor for raid-related DOM elements
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === 1) { // Element node
        const element = node;
        if (element.className?.includes('raid') || element.id?.includes('raid') || 
            element.className?.includes('event') || element.id?.includes('event')) {
          console.log('New raid/event element added:', element);
        }
      }
    });
  });
});

observer.observe(document.body, { childList: true, subtree: true });
```

## Complete Monitoring Setup

### Full Raid Monitoring System

```javascript
// Complete setup for monitoring all raid activity
function setupRaidMonitoring() {
  // Clean up existing monitors
  if (window.raidStateChecker) clearInterval(window.raidStateChecker);
  if (window.raidUnsubscribe) window.raidUnsubscribe();
  if (window.raidListWatcher) window.raidListWatcher.unsubscribe();
  if (window.raidListMonitor) window.raidListMonitor.unsubscribe();
  if (window.allRaidEvents) window.allRaidEvents.unsubscribe();
  if (window.observer) window.observer.disconnect();

  // 1. Monitor raid list changes
  window.raidListWatcher = globalThis.state.raids.subscribe((state) => {
    if (state.context.list && state.context.list.length > 0) {
      console.log("=== RAID LIST UPDATED ===");
      console.log("Raid list:", state.context.list);
      console.log("Full context:", state.context);
    }
  });

  // 2. Monitor newRaid events
  window.raidUnsubscribe = globalThis.state.raids.on("newRaid", (e) => {
    console.log("=== NEW RAID EVENT TRIGGERED ===");
    console.log("Event object:", e);
    console.log("Event type:", e.type);
    console.log("Event data:", e.raid);
    console.log("Current raid list:", globalThis.state.raids.getSnapshot().context.list);
  });

  // 3. Monitor all raid events
  window.allRaidEvents = globalThis.state.raids.inspect((event) => {
    console.log(`[${new Date().toLocaleTimeString()}] Raid event:`, {
      type: event.type,
      eventType: event.event?.type,
      hasData: !!event.event?.data,
      hasRaid: !!event.event?.raid
    });
  });

  // 4. Monitor raid list changes specifically
  window.lastRaidList = [];
  window.raidListMonitor = globalThis.state.raids.subscribe((state) => {
    const currentList = state.context.list || [];
    if (JSON.stringify(currentList) !== JSON.stringify(window.lastRaidList)) {
      console.log("=== RAID LIST CHANGED ===");
      console.log("Previous list:", window.lastRaidList);
      console.log("New list:", currentList);
      console.log("Change type:", currentList.length > window.lastRaidList.length ? "ADDED" : "REMOVED");
      window.lastRaidList = [...currentList];
    }
  });

  // 5. Periodic state checking
  window.raidStateChecker = setInterval(() => {
    const raidState = globalThis.state.raids.getSnapshot();
    console.log(`[${new Date().toLocaleTimeString()}] Raid state:`, {
      listLength: raidState.context.list.length,
      msUntilUpdate: raidState.context.msUntilNextUpdate,
      type: raidState.context.type
    });
  }, 30000);

  // 6. Network monitoring
  if (!window.originalFetch) {
    window.originalFetch = window.fetch;
    window.fetch = function(...args) {
      const url = args[0];
      if (typeof url === 'string' && (url.includes('raid') || url.includes('event'))) {
        console.log('Raid-related fetch request:', url, args[1]);
      }
      return window.originalFetch.apply(this, args);
    };
  }

  // 7. DOM monitoring
  window.observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const element = node;
          if (element.className?.includes('raid') || element.id?.includes('raid') || 
              element.className?.includes('event') || element.id?.includes('event')) {
            console.log('New raid/event element added:', element);
          }
        }
      });
    });
  });
  window.observer.observe(document.body, { childList: true, subtree: true });

  console.log("Complete raid monitoring system activated");
}

// Clean up function
function cleanupRaidMonitoring() {
  if (window.raidStateChecker) clearInterval(window.raidStateChecker);
  if (window.raidUnsubscribe) window.raidUnsubscribe();
  if (window.raidListWatcher) window.raidListWatcher.unsubscribe();
  if (window.raidListMonitor) window.raidListMonitor.unsubscribe();
  if (window.allRaidEvents) window.allRaidEvents.unsubscribe();
  if (window.observer) window.observer.disconnect();
  
  // Restore original fetch
  if (window.originalFetch) {
    window.fetch = window.originalFetch;
    delete window.originalFetch;
  }
  
  console.log("Raid monitoring system cleaned up");
}
```

## Usage Examples

### Basic Raid Detection

```javascript
// Simple raid detection
const unsubscribe = globalThis.state.raids.on("newRaid", (e) => {
  console.log("New raid detected:", e.raid);
  // Your raid handling logic here
});
```

### Advanced Raid Monitoring

```javascript
// Set up complete monitoring
setupRaidMonitoring();

// Check current state
const currentState = globalThis.state.raids.getSnapshot();
console.log("Current raids:", currentState.context.list);

// Force refresh
globalThis.state.raids.send({ type: 'refreshRaid' });
```

### Integration with Mod Development

```javascript
// Example integration in a mod
function initRaidMod() {
  // Set up raid monitoring
  const raidUnsubscribe = globalThis.state.raids.on("newRaid", (e) => {
    console.log("Raid detected in mod:", e.raid);
    // Handle raid in your mod
    handleRaid(e.raid);
  });

  // Return cleanup function
  return () => {
    raidUnsubscribe();
  };
}
```

## Troubleshooting

### Common Issues

1. **No raids appearing**: Check the `msUntilNextUpdate` timer - raids are fetched periodically
2. **Events not firing**: Ensure the state machine is active and properly initialized
3. **Memory leaks**: Always clean up event listeners and intervals

### Debug Commands

```javascript
// Check raid state
console.log("Raid state:", globalThis.state.raids.getSnapshot());

// Check available methods
console.log("Raid methods:", Object.getOwnPropertyNames(globalThis.state.raids));

// Monitor all events
globalThis.state.raids.inspect(console.log);
```

## Integration with Existing Mods

This raid system can be integrated with existing mods like the Raid Hunter mod by:

1. Using the `newRaid` event for detection
2. Monitoring the `list` array for current raids
3. Using the available actions for raid management
4. Implementing proper cleanup in mod lifecycle

## Notes

- Raids are fetched periodically from the server (typically every 15-20 minutes)
- The `newRaid` event is the primary way to detect new raids
- All actions are accepted by the state machine but may only work when raids are available
- The system follows XState patterns for predictable state management
- Network monitoring can help identify when raid data is being fetched

## Related Documentation

- [Game State API](game_state_api.md) - General state management
- [Mod Development Guide](mod_development_guide.md) - Mod development patterns
- [Client API](client_api.md) - High-level API functions
