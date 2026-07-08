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
- OT Mods load after Super Mods
- User scripts load after all file-based mods

### 4. **User-Generated Scripts Integration**
User scripts stored in localStorage are automatically integrated:

- Automatic loading of user-generated scripts from localStorage
- Integrated with existing mod loading sequence
- Proper state management for user scripts

## Loading Order

### Page injection (content script → page context)

`injector.js` loads page scripts in this order:

1. **`content/extension-url.js`** — encodes extension URLs and maps logical mod paths (e.g. `Official Mods/`) to on-disk paths
2. **`content/platform.js`** — sets `window.BestiaryPlatform` (desktop strict vs mobile relaxed loader)
3. **`content/client.js`** — `BestiaryModAPI`, UI components
4. **`content/mod-coordination.mjs`** — loaded as `text/javascript` (IIFE, not `type="module"`)
5. **`content/custom-battles.js`**
6. **`content/event-competition.js`**
7. **`content/local_mods.js`** — mod discovery, batch execution, completion signal

`utility_injector.js` (at `document_idle`) also loads `ba-sandbox-utils.mjs` (same IIFE / non-module rule) and may inject `custom-battles.js` and `event-competition.js` again.

### Mod execution

The system follows this exact order:

1. **Core page scripts** (above) before bundled mods run
2. **Active Scripts** (remote/URL-based mods)
3. **Local Mods** (in order):
   - **Database scripts** (`database/*`)
   - **Official Mods**
   - **Super Mods**
   - **OT Mods**
   - **User-Generated Scripts** (from localStorage)

### Desktop vs mobile (relaxed loader)

On **desktop**, the loader uses the strict path: direct page fetch of extension URLs when possible, hydration/game-state checks, and auto-refresh on hard load failures (up to 3 times).

On **mobile WebExtensions** (e.g. Orion iOS), `content/platform.js` enables a **relaxed** path automatically (or when page extension fetch fails):

- Content-script fetch via injector bridge first, then page fetch, then background `getModContent`
- Skip bulk HEAD probes; trust bundled registry lists
- Shorter page-ready waits; hydration/game-state issues are logged but not fatal
- No auto-refresh loop on loader warnings

**Override (testing):** in the game tab console, `sessionStorage.setItem('ba-relaxed-loader', '1')` then reload (use `'0'` or remove the key to restore strict behavior).

See also [`content/platform.js`](../content/platform.js) and [`content/local_mods.js`](../content/local_mods.js). For Orion/WebKit platform constraints and extension URL encoding, see [Orion iOS Compatibility](orion_ios_compatibility.md).

## Error Log (popup Debug)

Since **4.2.10**, the extension popup includes an **Error Log** under the **Debug** collapsible section (below **Extras**) for debugging without DevTools (especially on mobile WebExtensions such as Orion iOS).

### Debug section order

**Debug Mode** → **Error Log**

### What is captured

- `console.error` from the game page, content script (`injector.js`), and background script
- Uncaught errors and unhandled promise rejections
- Mod batch load failures and loader-level completion errors
- Background `getModContent` fetch failures (includes failed resource URL in detail)

### What is not captured

- `console.warn` — not stored or shown (avoids noisy fallback warnings during startup)
- `console.log` — use **Debug Mode** in the Debug section instead

### Persistence and UI

- Stored in `chrome.storage.local` under key `ba-loader-errors` (ring buffer, last **200** entries)
- Survives page reloads until you tap **Clear**
- Prepends a sticky **Device / Browser** header (extension version, browser, platform, device type, language, URL, user-agent, timestamp) that survives **Clear** and is included when copying; uses live page context when a bestiaryarena.com tab is active
- Expanding the **Debug** section auto-refreshes the panel (no separate Refresh button since **4.3.1**)
- **Copy** copies the visible log text to the clipboard

### Reporting from page-context code

Mods and loader scripts can emit structured entries:

```javascript
window.BestiaryLoaderErrorLog?.report('My Mod', 'Short message', 'Optional detail');
```

Entries are sent to the content script via `postMessage` and merged into the same storage.

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