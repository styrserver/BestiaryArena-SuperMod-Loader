# Orion iOS WebExtension Compatibility

Technical reference for AI agents, maintainers, and automated auditing of mobile WebExtension behavior on Orion for iOS.

Related docs:

- [Mod Loading System](mod_loading_optimizations.md) — loader architecture, relaxed mobile path, Error Log
- [Mod Development Guide](mod_development_guide.md) — mod author notes for mobile WebExtensions

---

## 1. Executive summary and core platform constraints

Orion for iOS executes extensions inside Apple's native WebKit engine via specialized instances of `WKWebView`. Instead of interpreting extension source packages directly through standard V8 or SpiderMonkey pipelines, Orion abstracts the WebExtensions runtime layer and maps it onto native WebKit equivalents.

Because of this translation layer and the restrictions imposed by the iOS application sandbox, extensions behave differently than they do on desktop Chrome or Firefox runtimes.

**Core architecture rules for AI auditing:**

- **Engine foundations** — All extensions run inside a WebKit execution environment. Chromium/Blink-specific or Gecko-specific V8 optimization tricks, non-standard JavaScript features, or experimental Chromium APIs will cause execution faults.
- **Manifest versioning parity** — Orion supports both Manifest V2 (MV2) and Manifest V3 (MV3). Google's MV2 sunset timeline does not apply to Orion; MV2 extensions continue to run when they adhere to the boundaries in this document.
- **Aggressive thread lifecycle** — Unlike desktop browsers where a background page can remain resident indefinitely, iOS aggressively manages memory and thermal states. Persistent background scripts or pages are highly susceptible to suspension.

---

## 2. `manifest.json` root key support matrix

When evaluating a `manifest.json` file, cross-examine root keys against the rules below. Flag unexpected behaviors, unsupported states, or critical warnings.

| Key | Status | Notes |
|-----|--------|-------|
| `manifest_version` (MV2 / MV3) | Full support | Accepts integer values 2 or 3. The browser routes API calls dynamically depending on the version specified. |
| `background` (MV2 / MV3) | Partial support | Supports scripts, persistent pages (MV2), or service workers (MV3). **AI audit:** If an extension relies on long-running timers or active WebSocket connections in the background, flag as a risk. The background thread can be terminated within 10–30 seconds of browser inactivity or app minimization. |
| `content_scripts` (MV2 / MV3) | Full support | Injected through WebKit User Scripts (`WKUserScript`). Injection points (`document_start`, `document_end`, `document_idle`) are maintained. Isolated execution contexts operate like desktop. |
| `browser_action` / `action` (MV2 / MV3) | Partial support | Does not render as a desktop toolbar icon. Maps to the native omnibar overflow extension menu. `default_popup` opens a native iOS sliding modal sheet. |
| `permissions` (MV2 / MV3) | Partial support | Internal capabilities (`storage`, `cookies`, `alarms`) pass natively. Host permissions (e.g. `https://*.example.com/*`) require user-granted site-access via interactive runtime sheets (Apple Privacy framework). |
| `declarative_net_request` (MV3) | Full support | JSON rules compile into a native WebKit Content Blocker list (`WKContentRuleList`), not frame-by-frame JavaScript evaluation. |
| `native_messaging` (MV2 / MV3) | **Unsupported** | **Critical failure.** iOS sandboxing prohibits launching external binaries or loopback socket communication with local applications. |
| `options_page` / `options_ui` (MV2 / MV3) | Partial support | Renders in an application preference subframe. Flag fixed desktop layout elements — they break responsive mobile views. |

---

## 3. WebExtensions API namespace reference

If your agent encounters APIs listed as Partial or Unsupported, flag or refactor those execution paths.

| API | Status | Behavior / limitations |
|-----|--------|------------------------|
| `chrome.alarms` / `browser.alarms` | Full support | Fires reliably while Orion is the active foreground app. **Warning:** Alarms batch or defer when the device sleeps or Orion is backgrounded. Do not use for microsecond-precision timing. |
| `chrome.bookmarks` | Full support | Links into Orion's local SQLite bookmark store. Changes reflect in the native UI and can sync via iCloud when enabled. |
| `chrome.contextMenus` | Partial support | Maps to native long-press action sheets. Deeply nested sub-menus are flattened into a single list. |
| `chrome.cookies` | Full support | Hooks into `WKHTTPCookieStore` for the active profile. |
| `chrome.extension` | Full support | Standard utilities work. `getURL()` generates secure local URLs (`orion-extension://…`, `safari-web-extension://…`, etc.). `inIncognitoContext` evaluates privacy state correctly. |
| `chrome.identity` | **Unsupported** | OAuth redirects and frame-interception auth fail. Fall back to manual API token entry in the UI. |
| `chrome.idle` | Partial support | Tied to device state, not mouse/keyboard. Switches to idle when the screen turns off, the phone locks, or the app is minimized. |
| `chrome.notifications` | Partial support | Does not use APNS. Drawn as in-browser toasts or custom layout layers. |
| `chrome.runtime` | Full support | `sendMessage`, `onMessage`, `connect`, `onConnect` between content scripts, popups, and service workers are robust. Preferred internal data pipeline. |
| `chrome.storage` | Full support | `storage.local` and `storage.sync` implemented. `storage.sync` uses `NSUbiquitousKeyValueStore` for cross-device sync via Apple ID. |
| `chrome.tabs` | Partial support | `query()`, `create()`, `update()`, `remove()` work. Desktop-only window params (`width`, `height`, `left`, `top`, `focused`, `pinned`) are dropped safely. |
| `chrome.webNavigation` | Full support | Hooks (`onBeforeNavigate`, `onCommitted`, `onCompleted`) fire with WebKit main-frame transitions. |
| `chrome.webRequest` | Partial / **critical** | Observational hooks work. **Do not use blocking hooks.** `webRequestBlocking` causes bottlenecks or failures because WebKit processes requests via `NSURLSession`. Prefer `declarativeNetRequest`. |

---

## 4. Engineering guardrails and optimization patterns

When producing or correcting code for Orion iOS, apply these baselines.

### Stateless background architecture

Background contexts can be killed within 10–30 seconds after focus shifts. Use a stateless pattern:

**Bad practice — in-memory cache lost on suspension:**

```javascript
let cachedUserData = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_DATA') {
    sendResponse(cachedUserData);
  }
});
```

**Good practice — recover from storage:**

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_DATA') {
    chrome.storage.local.get(['cachedUserData'], (result) => {
      sendResponse(result.cachedUserData || null);
    });
    return true; // keep the message channel open for async response
  }
});
```

### Platform detection

Branch between desktop and Orion when needed (this extension also uses broader mobile detection in `content/platform.js`):

```javascript
const isOrionPlatform =
  typeof Orion !== 'undefined' || navigator.userAgent.includes('Orion');

if (isOrionPlatform) {
  // mobile-safe, non-blocking async strategies
}
```

### Responsive CSS and safe-area insets

Mobile popups must respect hardware insets (Dynamic Island, home indicator):

```css
body {
  width: 100%;
  max-width: 480px;
  min-width: 320px;
  box-sizing: border-box;
  margin: 0;
  padding-top: env(safe-area-inset-top, 10px);
  padding-bottom: env(safe-area-inset-bottom, 10px);
  padding-left: env(safe-area-inset-left, 10px);
  padding-right: env(safe-area-inset-right, 10px);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
```

---

## 5. Extension resource loading (Bestiary Arena Mod Loader)

These rules apply to this extension and other WebKit-based mobile WebExtensions. Implementation lives in [`content/extension-url.js`](../content/extension-url.js).

### URL encoding (critical)

- Bundled mod paths contain spaces in **logical IDs** (e.g. `Official Mods/Turbo Mode.js`).
- On disk, folders use underscores (`Official_Mods/`) and **filenames with spaces use underscores** (`Turbo_Mode.js`). Loaders map logical → filesystem before `runtime.getURL()`.
- Pass **unencoded** logical paths **to** `runtime.getURL()` only after mapping to the filesystem path (no spaces in the path passed to `getURL` on iOS).
- **Encode each path segment** in the resulting URL **before** `fetch()` or `script.src` when the URL still contains special characters (WebKit rejects unencoded spaces with `Load failed`).
- Use the URL API for normalization; do not hardcode `orion-extension://` or `safari-web-extension://` prefixes.

### web_accessible_resources (critical)

- The manifest wildcard `mods/*` matches **only files directly in `mods/`**, not nested folders (same as upstream’s flat `mods/Bestiary_Automator.js` layout).
- On disk, bundled mods live in `Official_Mods/`, `Super_Mods/`, and `OT_Mods/` (underscores). The popup/registry use logical names with spaces (`Official Mods/`). Manifest entries must use the **filesystem** folder names, e.g. `mods/Official_Mods/*`.
- Loaders must map logical mod IDs to filesystem paths before `runtime.getURL()` / fetch; do not rename logical IDs in storage.

### Page context vs content script

- Scripts injected via `<script src>` run in **page context** and do not have `chrome.*` API access.
- Use content-script bridges (`runtime.sendMessage`, `postMessage`) or `postMessage` `modBaseUrl` with encoded path joining for page-side fetches.

### Script injection

- Do not use `type="module"` for bundled `.mjs` files unless they use `import`/`export`.
- `ba-sandbox-utils.mjs` and `mod-coordination.mjs` are IIFEs; load as `text/javascript` on all platforms.

### Loader fallbacks

- On mobile, the **content script** fetches bundled mod text first (via the injector bridge), then page fetch, then background `getModContent`. See [Orion iOS Compatibility](orion_ios_compatibility.md#loader-fallbacks).
- Both page and background fetch require encoded extension URLs on WebKit; failures in one often indicate the same encoding issue in the other.

### Diagnostics

- Script `onerror` `Event` objects serialize as `{"isTrusted":true}`; log the script URL instead.
- Extension URL prefixes vary by browser; use `new URL(url)` rather than string prefix checks.
- Use the popup **Debug → Error Log** when DevTools is unavailable on device.
