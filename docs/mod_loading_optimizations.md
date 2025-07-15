# Mod Loading Optimizations

## Overview
The mod loading system has been optimized to eliminate duplicate executions, improve loading order, and provide better dependency management. **User-generated scripts from localStorage are now automatically loaded.**

## Issues Fixed

### 1. **Dual Execution Paths**
**Problem**: Mods were being executed through two different paths:
- `local_mods.js` (showing "already executed, skipping")
- `injector.js` (showing "Executing local mod:")

**Solution**: 
- Eliminated duplicate execution from background script
- Content script now handles all mod execution
- Background script only registers mods, doesn't execute them

### 2. **Race Conditions**
**Problem**: Multiple initialization triggers causing inconsistent loading order

**Solution**:
- Added initialization promise to prevent multiple simultaneous initializations
- Proper sequencing with `isInitializing` flag
- Reset initialization promise on reload

### 3. **Improper Loading Order**
**Problem**: Super Mods were executing before Official Mods despite code listing Official Mods first

**Solution**:
- Implemented `executeModsInOrder()` function for proper sequential execution
- Ensures Official Mods load before Super Mods
- Better error handling and reporting

### 4. **Redundant Execution Requests**
**Problem**: Many mods were being requested multiple times

**Solution**:
- Enhanced deduplication logic
- Better tracking of executed mods
- Improved state management

### 5. **Missing User-Generated Scripts Support**
**Problem**: User scripts in localStorage were not automatically loaded

**Solution**:
- Added automatic loading of user-generated scripts from localStorage
- Integrated with existing mod loading sequence
- Proper state management for user scripts

## Key Optimizations

### 1. **Sequential Execution**
```javascript
// New: Batch execution function
async function executeModsInOrder(mods, forceExecution = false) {
  const results = [];
  for (const mod of mods) {
    if (mod.enabled || forceExecution) {
      try {
        const result = await executeLocalMod(mod.name, forceExecution);
        results.push({ mod: mod.name, success: !!result, result });
      } catch (error) {
        console.error(`Failed to execute mod ${mod.name}:`, error);
        results.push({ mod: mod.name, success: false, error: error.message });
      }
    }
  }
  return results;
}
```

### 2. **Initialization Promise**
```javascript
// New: Prevents multiple simultaneous initializations
let isInitializing = false;
let initializationPromise = null;

async function initLocalMods() {
  if (isInitializing) {
    return initializationPromise;
  }
  
  if (initializationPromise) {
    return initializationPromise;
  }
  
  isInitializing = true;
  initializationPromise = (async () => {
    // ... initialization logic
  })();
  
  return initializationPromise;
}
```

### 3. **Enhanced Error Handling**
```javascript
// New: Better error handling and return values
async function executeLocalMod(modName, forceExecution = false) {
  if (executedMods[modName] && !forceExecution) {
    return executedMods[modName]; // Return existing result
  }
  
  // ... execution logic with proper error handling
  return executedMods[modName]; // Return execution result
}
```

### 4. **Eliminated Background Script Execution**
```javascript
// Old: Background script executed mods individually
localMods.filter(mod => mod.enabled).forEach(mod => {
  browserAPI.tabs.sendMessage(tabId, {
    action: 'executeLocalMod',
    name: mod.name
  });
});

// New: Only register mods, let content script handle execution
browserAPI.tabs.sendMessage(tabId, {
  action: 'registerLocalMods',
  mods: localMods
});
```

### 5. **User-Generated Scripts Integration**
```javascript
// New: Automatic loading of user scripts from localStorage
async function getManualMods() {
  return new Promise(resolve => {
    if (!window.browserAPI || !window.browserAPI.storage || !window.browserAPI.storage.local) {
      // Fallback to localStorage if browserAPI not available
      try {
        const stored = localStorage.getItem(MANUAL_MODS_KEY);
        resolve(stored ? JSON.parse(stored) : []);
      } catch (e) {
        console.warn('Error reading manual mods from localStorage:', e);
        resolve([]);
      }
      return;
    }
    
    window.browserAPI.storage.local.get([MANUAL_MODS_KEY], result => {
      resolve(result[MANUAL_MODS_KEY] || []);
    });
  });
}
```

## Expected Results

### Before Optimization:
```
Starting script injection sequence...
Received request to execute local mod: Official Mods/Setup_Manager.js (force: false)
Local mod Official Mods/Setup_Manager.js was already executed, skipping
Injector received message from extension: 
Object { action: "executeLocalMod", name: "Super Mods/Hunt Analyzer.js" }
Executing local mod: Super Mods/Hunt Analyzer.js
// ... many duplicate execution attempts
```

### After Optimization:
```
Starting script injection sequence...
Local mods initialized: [14 mods]
Found 2 user-generated scripts in localStorage
Found 16 total mods (14 file-based, 2 user-generated)
Auto-executing 16 newly enabled mods in order
Executing 16 mods in order...
Executing local mod: Official Mods/Bestiary_Automator.js
Executing local mod: Official Mods/Board Analyzer.js
// ... proper sequential execution
Executing local mod: User Mods/My Custom Script.js
Using stored content for user-generated mod: User Mods/My Custom Script.js
Batch execution completed. Results: [16 successful executions]
```

## Benefits

1. **Performance**: Eliminates duplicate executions and reduces overhead
2. **Reliability**: Proper error handling and state management
3. **Predictability**: Consistent loading order (Official Mods → Super Mods → User Scripts)
4. **Maintainability**: Cleaner code structure and better separation of concerns
5. **Debugging**: Better logging and error reporting
6. **User Experience**: Automatic loading of user-generated scripts

## Loading Order

The optimized system now follows this exact order:

1. **Core Scripts**:
   - `content/client.js`
   - `content/local_mods.js`
   - `content/ba-sandbox-utils.mjs`

2. **Active Scripts** (remote/URL-based mods)

3. **Local Mods** (in order):
   - **Official Mods** (1-11)
   - **Super Mods** (12-14)
   - **User-Generated Scripts** (from localStorage)

This ensures dependencies are properly resolved and mods load in the intended sequence.

## User-Generated Scripts Support

The system now automatically loads user-generated scripts stored in localStorage:

- **Storage**: Scripts are stored under the `manualMods` key in localStorage
- **Auto-loading**: User scripts are automatically loaded after Official and Super mods
- **Execution**: Scripts are executed in the order they were created
- **State Management**: Enabled/disabled state is preserved across sessions
- **Fallback**: Works with both browserAPI.storage and direct localStorage access

### User Script Format
```javascript
{
  name: "My Custom Script",
  content: "// Your JavaScript code here",
  enabled: true
}
```

### Integration Points
- User scripts are automatically detected during initialization
- They appear in the mod list with type `manual`
- Content is executed directly without file fetching
- State changes are preserved in localStorage 