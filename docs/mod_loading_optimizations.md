# Mod Loading System

## Overview
The mod loading system is optimized to eliminate duplicate executions, ensure proper loading order, and provide better dependency management. **User-generated scripts from localStorage are automatically loaded.**

## Current Architecture

### 1. **Unified Execution Path**
The system uses a coordinated execution approach to prevent duplicate executions and race conditions:

- Content script handles all mod execution through `executeLocalMod()` and `executeModsInOrder()`
- Background script registers mods and can trigger execution via messages
- Content script manages execution state and prevents duplicates

### 2. **Race Condition Prevention**
The system prevents multiple initialization triggers with:

- Initialization promise to prevent simultaneous initializations
- Proper sequencing with `isInitializing` flag
- Reset initialization promise on reload

### 3. **Sequential Loading Order**
Mods execute in a specific order to ensure dependencies are resolved correctly:

- `executeModsInOrder()` function handles proper sequential execution
- Official Mods load before Super Mods
- User scripts load after all file-based mods

### 4. **User-Generated Scripts Integration**
User scripts stored in localStorage are automatically integrated:

- Automatic loading of user-generated scripts from localStorage
- Integrated with existing mod loading sequence
- Proper state management for user scripts

## Loading Order

The system follows this exact order:

1. **Core Scripts**: `content/client.js`, `content/local_mods.js`, `content/ba-sandbox-utils.mjs`
2. **Active Scripts** (remote/URL-based mods)
3. **Local Mods** (in order):
   - **Official Mods** (1-11)
   - **Super Mods** (12-14)
   - **User-Generated Scripts** (from localStorage)

## Benefits

1. **Performance**: Eliminates duplicate executions and reduces overhead
2. **Reliability**: Proper error handling and state management
3. **Predictability**: Consistent loading order ensures dependencies are resolved correctly
4. **Maintainability**: Cleaner separation of concerns between background and content scripts
5. **User Experience**: Automatic loading of user-generated scripts

## Browser Compatibility & Limitations

### Chrome Service Worker Restrictions

**Important**: Chrome service workers have strict limitations that affect the mod loading system:

- **Dynamic Imports**: Chrome service workers cannot use `import()` or `new Function()` (HTML spec restriction)
- **Firefox Support**: Firefox background scripts can use dynamic imports normally
- **Fallback Strategy**: Chrome uses hardcoded lists that must be kept in sync with `mod-registry.js`

### Registry Loading Strategy

The system uses different approaches for each browser:

1. **Firefox**: Dynamically imports `mod-registry.js` to get `DEFAULT_ENABLED_MODS`
2. **Chrome**: Uses hardcoded fallback list in `loadDefaultEnabledMods()` function
3. **Error Handling**: Multiple fallback layers ensure the system works even if registry loading fails

### Maintenance Requirements

When adding new mods to `DEFAULT_ENABLED_MODS`:

- **Firefox**: Automatically uses updated `mod-registry.js`
- **Chrome**: Must manually update hardcoded list in `background.js` `loadDefaultEnabledMods()` function
- **Documentation**: The limitation is clearly documented in the code for future maintainers

## User-Generated Scripts Support

The system automatically loads user-generated scripts stored in localStorage:

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