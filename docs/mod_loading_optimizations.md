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

`utility_injector.js` (at `document_idle`) loads `ba-sandbox-utils.mjs` (same IIFE / non-module rule). `custom-battles.js` and `event-competition.js` are injected once by `injector.js` to avoid double-loading.

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

Background delivery uses a once-per-page-load guard (`registeredTabs`). That guard must reset on same-tab reload / `contentScriptReady` (see [Orion iOS Compatibility — Page refresh / re-delivery](orion_ios_compatibility.md#page-refresh--re-delivery-critical)); otherwise a failed load can stick until the browser process restarts.

See also [`content/platform.js`](../content/platform.js) and [`content/local_mods.js`](../content/local_mods.js). For Orion/WebKit platform constraints and extension URL encoding, see [Orion iOS Compatibility](orion_ios_compatibility.md).

## Error Log (popup Debug)

Since **4.2.10**, the extension popup includes an **Error Log** under the **Debug** collapsible section (below **Extras**) for debugging without DevTools (especially on mobile WebExtensions such as Orion iOS).

### Debug section order

**Log Level** → **Error Log**

### Log Level (global console controller)

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
run via `new Function` with a `//# sourceURL=bestiary-mod/<Mod_Name>.js` trailer, so their
lines show as `<Mod_Name>.js:123` instead of `VM123:456`. Only `console.error` is a wrapper
(for the Error Log side effect) — its DevTools line points at `ba-logger.js`, but the stored
entry's `source` is recovered from the captured stack. Mods and loader files must **not**
wrap `console` themselves — any wrapper becomes the attributed frame for every later log.

### What is captured

- **`console.error`** — always, regardless of level, with a formatted stack / object dump in `detail`
- `console.assert` failures (treated as errors)
- Uncaught errors and unhandled promise rejections (page, isolated world, background) — with stack
- Mod batch load failures and loader-level completion errors
- Background `getModContent` fetch failures (includes failed resource URL in detail)

### What is not captured

- `console.warn` / `console.log` / `console.info` — printed per the **Log Level**, never stored

### Persistence and UI

- Stored in `chrome.storage.local` under key `ba-loader-errors` (ring buffer, last **300** entries)
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