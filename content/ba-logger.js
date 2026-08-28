/**
 * ba-logger.js — Bestiary Arena SuperMod Loader
 *
 * The single global logging controller. Loaded FIRST in every execution context:
 *   - background (MV3 service worker via importScripts / MV2 background page script)
 *   - isolated content-script world (first entry in manifest content_scripts)
 *   - page / MAIN world            (first script injected by injector.js)
 *
 * It installs a console proxy per context whose verbosity is driven by a single
 * persisted log level (storage key `ba-log-level`), set from the popup:
 *
 *   silent(0)   nothing            (console.error still prints — see below)
 *   errors(1)   error              <- default
 *   warnings(2) error, warn
 *   info(3)     error, warn, log, info
 *   verbose(4)  everything (debug, trace, group*, table, dir, count, ...)
 *
 * Rules that never change with the level:
 *   - console.error ALWAYS prints, and ALWAYS lands in the Error Log with full
 *     detail (formatted Error stacks / objects) and a correct source attribution.
 *
 * Call-site attribution: the gated methods are installed as accessor properties
 * whose getter returns the *native* function (or a no-op) — the caller then
 * invokes it directly, so DevTools still shows the real file:line. Only
 * console.error / console.assert use a wrapper (needed for the Error Log side
 * effect); their DevTools line points here, but the recorded entry is attributed
 * correctly from the captured stack.
 *
 * The Error Log sink:
 *   - extension contexts call globalThis.__BA_recordLoaderError(entry), which the
 *     host (injector.js / background.js) wires to its append+flush pipeline.
 *     Entries emitted before the host wires it are buffered in
 *     globalThis.__BA_LOGGER_PENDING__ and drained by the host.
 *   - the page/MAIN world posts { from:'BA_LOADER_ERROR', entry } on window,
 *     which injector.js already listens for.
 */
(function installBestiaryLogger() {
  'use strict';

  if (globalThis.__BA_LOGGER_INSTALLED__) return;
  globalThis.__BA_LOGGER_INSTALLED__ = true;

  // --- context detection -----------------------------------------------------
  const HAS_WINDOW = typeof window !== 'undefined';
  const extApi =
    (typeof browser !== 'undefined' && browser && browser.storage && browser.storage.local) ? browser :
    (typeof chrome !== 'undefined' && chrome && chrome.storage && chrome.storage.local) ? chrome :
    null;
  const IS_EXTENSION_CTX = !!extApi;
  const IS_PAGE = !IS_EXTENSION_CTX && HAS_WINDOW; // MAIN world of the game page

  const STORAGE_KEY = 'ba-log-level';
  const LEGACY_DEBUG_KEY = 'bestiary-debug';

  const LEVELS = { silent: 0, errors: 1, warnings: 2, info: 3, verbose: 4 };
  const LEVEL_NAMES = Object.keys(LEVELS);
  const DEFAULT_LEVEL = LEVELS.errors;

  function parseLevel(value) {
    if (value == null || value === '') return null;
    const s = String(value).toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LEVELS, s)) return LEVELS[s];
    const n = Number(s);
    if (Number.isFinite(n)) return Math.max(0, Math.min(4, Math.round(n)));
    return null;
  }
  function levelName(n) {
    return LEVEL_NAMES.find((k) => LEVELS[k] === n) || 'errors';
  }

  let currentLevel = DEFAULT_LEVEL;

  // --- native console handles (also exposed for other loader files) ---------
  const nativeConsole = globalThis.__BA_NATIVE_CONSOLE__ || {};
  const CONSOLE_METHODS = [
    'log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'dirxml',
    'table', 'group', 'groupCollapsed', 'groupEnd', 'count', 'countReset',
    'time', 'timeEnd', 'timeLog', 'assert'
  ];
  for (const m of CONSOLE_METHODS) {
    if (typeof console[m] === 'function' && typeof nativeConsole[m] !== 'function') {
      nativeConsole[m] = console[m].bind(console);
    }
  }
  if (typeof nativeConsole.log !== 'function') {
    nativeConsole.log = (typeof console.log === 'function') ? console.log.bind(console) : function () {};
  }
  globalThis.__BA_NATIVE_CONSOLE__ = nativeConsole;

  const noop = function () {};

  // Minimum level at which each gated method prints.
  const MIN_LEVEL = {
    log: LEVELS.info,
    info: LEVELS.info,
    warn: LEVELS.warnings,
    debug: LEVELS.verbose,
    trace: LEVELS.verbose,
    dir: LEVELS.verbose,
    dirxml: LEVELS.verbose,
    table: LEVELS.verbose,
    group: LEVELS.verbose,
    groupCollapsed: LEVELS.verbose,
    groupEnd: LEVELS.verbose,
    count: LEVELS.verbose,
    countReset: LEVELS.verbose,
    time: LEVELS.verbose,
    timeEnd: LEVELS.verbose,
    timeLog: LEVELS.verbose
  };

  // --- formatting ----------------------------------------------------------
  function safeStringify(obj) {
    const seen = new WeakSet();
    try {
      return JSON.stringify(obj, (key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) return '[Circular]';
          seen.add(val);
        }
        if (typeof val === 'bigint') return String(val) + 'n';
        if (typeof val === 'function') return `[Function ${val.name || 'anonymous'}]`;
        return val;
      });
    } catch {
      try { return String(obj); } catch { return '[Unserializable]'; }
    }
  }

  function formatArg(arg) {
    if (arg instanceof Error) {
      return `${arg.name}: ${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
    }
    if (typeof ErrorEvent !== 'undefined' && arg instanceof ErrorEvent) {
      const s = arg.error instanceof Error ? `\n${arg.error.stack || ''}` : '';
      const loc = arg.filename ? ` (${arg.filename}:${arg.lineno}:${arg.colno})` : '';
      return `${arg.message || 'ErrorEvent'}${loc}${s}`;
    }
    if (typeof PromiseRejectionEvent !== 'undefined' && arg instanceof PromiseRejectionEvent) {
      const r = arg.reason;
      return r instanceof Error ? `${r.name}: ${r.message}\n${r.stack || ''}` : `Unhandled rejection: ${safeStringify(r)}`;
    }
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    if (typeof arg === 'object') return safeStringify(arg);
    return String(arg);
  }

  function formatLogArgs(args) {
    try {
      return Array.prototype.map.call(args, formatArg).join(' ');
    } catch {
      try { return String(args); } catch { return '[unformattable log args]'; }
    }
  }
  globalThis.__BA_formatLogArgs__ = formatLogArgs;

  // First stack frame that is not this file — used to attribute an entry.
  function callSite() {
    let stack = '';
    try { stack = new Error().stack || ''; } catch { /* ignore */ }
    const lines = stack.split('\n').slice(1);
    for (const line of lines) {
      if (line.indexOf('ba-logger.js') !== -1) continue;
      const m = line.match(/([^/\\() ]+\.(?:js|mjs)):(\d+)(?::(\d+))?/);
      if (m) return { source: `${m[1]}:${m[2]}`, stack };
      if (line.trim()) return { source: undefined, stack };
    }
    return { source: undefined, stack };
  }

  // --- Error Log sink ------------------------------------------------------
  function emitToSink(entry) {
    const full = {
      ts: entry.ts || Date.now(),
      level: entry.level || 'error',
      source: entry.source || 'logger',
      message: entry.message || '',
      detail: entry.detail || undefined
    };
    try {
      if (typeof globalThis.__BA_recordLoaderError === 'function') {
        globalThis.__BA_recordLoaderError(full);
        return;
      }
    } catch { /* fall through */ }
    if (IS_PAGE) {
      try {
        window.postMessage({ from: 'BA_LOADER_ERROR', entry: full }, '*');
        return;
      } catch { /* fall through */ }
    }
    (globalThis.__BA_LOGGER_PENDING__ = globalThis.__BA_LOGGER_PENDING__ || []).push(full);
  }

  function recordError(args, sourceHint) {
    let detail;
    for (const a of args) {
      if (a instanceof Error && a.stack) { detail = a.stack; break; }
    }
    const cs = callSite();
    if (!detail) detail = cs.stack || undefined;
    emitToSink({
      level: 'error',
      source: sourceHint || cs.source || 'console.error',
      message: formatLogArgs(args) || 'error',
      detail
    });
  }

  // --- console proxy (accessor-based, preserves call-site attribution) ----
  const overrides = Object.create(null);

  function defineConsoleProp(method, getter) {
    try {
      Object.defineProperty(console, method, {
        configurable: true,
        enumerable: true,
        get: getter,
        set(fn) {
          // A mod may install its own wrapper (e.g. RunTracker intercepts
          // console.log). Honour it. An attempt to "restore" the method to our
          // native/no-op handle just clears the override so gating resumes.
          if (typeof fn !== 'function' || fn === nativeConsole[method] || fn === noop) {
            delete overrides[method];
          } else {
            overrides[method] = fn;
          }
        }
      });
    } catch {
      // Some environments freeze console — fall back to a plain gate.
      try {
        console[method] = function (...a) {
          if (currentLevel >= (MIN_LEVEL[method] || 0)) nativeConsole[method].apply(console, a);
        };
      } catch { /* give up on this method */ }
    }
  }

  for (const method of Object.keys(MIN_LEVEL)) {
    if (typeof nativeConsole[method] !== 'function') continue;
    const min = MIN_LEVEL[method];
    defineConsoleProp(method, function () {
      if (overrides[method]) return overrides[method];
      return currentLevel >= min ? nativeConsole[method] : noop;
    });
  }

  // console.error — always prints, always recorded, never gated.
  const errorSink = function (...args) {
    try { nativeConsole.error.apply(console, args); } catch { /* ignore */ }
    try { recordError(args); } catch { /* never break console.error */ }
  };
  if (typeof nativeConsole.error === 'function') {
    defineConsoleProp('error', function () { return overrides.error || errorSink; });
  }

  // console.assert — failing assertions are treated as errors.
  const assertSink = function (condition, ...rest) {
    if (condition) return;
    try { nativeConsole.assert.call(console, condition, ...rest); } catch { /* ignore */ }
    try { recordError(rest.length ? rest : ['Assertion failed'], 'console.assert'); } catch { /* ignore */ }
  };
  if (typeof nativeConsole.assert === 'function') {
    defineConsoleProp('assert', function () { return overrides.assert || assertSink; });
  }

  // --- level state: read + live updates ---------------------------------
  function broadcastToPage(n) {
    // isolated world -> MAIN world (which has no extension APIs of its own)
    if (!IS_EXTENSION_CTX || !HAS_WINDOW) return;
    try {
      window.postMessage({ from: 'BESTIARY_EXTENSION', action: 'updateLogLevel', level: levelName(n) }, '*');
    } catch { /* ignore */ }
  }

  function applyLevel(n, opts) {
    if (n == null) return;
    const changed = n !== currentLevel;
    currentLevel = n;
    globalThis.__BA_LOG_LEVEL__ = levelName(n);
    if (HAS_WINDOW) {
      try { window.__BA_LOG_LEVEL__ = levelName(n); } catch { /* ignore */ }
      try { window.BESTIARY_DEBUG = n === LEVELS.verbose; } catch { /* ignore */ }
    }
    if (opts && opts.broadcast && changed) broadcastToPage(n);
  }

  // Synchronous seed from localStorage (available in both DOM worlds).
  if (HAS_WINDOW) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed = parseLevel(raw);
      if (parsed != null) {
        applyLevel(parsed);
      } else if (window.localStorage.getItem(LEGACY_DEBUG_KEY) === 'true') {
        applyLevel(LEVELS.verbose);
        try { window.localStorage.setItem(STORAGE_KEY, 'verbose'); } catch { /* ignore */ }
      }
    } catch { /* ignore */ }
  }

  // Authoritative source across contexts: extension storage.
  if (IS_EXTENSION_CTX) {
    try {
      extApi.storage.local.get([STORAGE_KEY, LEGACY_DEBUG_KEY], (res) => {
        if (!res) { broadcastToPage(currentLevel); return; }
        const parsed = parseLevel(res[STORAGE_KEY]);
        if (parsed != null) {
          applyLevel(parsed, { broadcast: true });
        } else if (res[LEGACY_DEBUG_KEY] === true || res[LEGACY_DEBUG_KEY] === 'true') {
          applyLevel(LEVELS.verbose, { broadcast: true });
          try { extApi.storage.local.set({ [STORAGE_KEY]: 'verbose' }); } catch { /* ignore */ }
        } else {
          broadcastToPage(currentLevel);
        }
      });
    } catch { /* ignore */ }

    try {
      extApi.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes || !changes[STORAGE_KEY]) return;
        const parsed = parseLevel(changes[STORAGE_KEY].newValue);
        if (parsed != null) applyLevel(parsed, { broadcast: true });
      });
    } catch { /* ignore */ }
  }

  // MAIN world receives level changes over the existing postMessage bridge.
  if (IS_PAGE) {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const d = event.data;
      if (!d || d.from !== 'BESTIARY_EXTENSION' || d.action !== 'updateLogLevel') return;
      const parsed = parseLevel(d.level);
      if (parsed != null) {
        applyLevel(parsed);
        try { window.localStorage.setItem(STORAGE_KEY, levelName(parsed)); } catch { /* ignore */ }
      }
    });
  }

  // --- uncaught errors: always recorded, with stack --------------------
  function reportErrorEvent(event) {
    try {
      const err = event && event.error;
      const location = event && event.filename
        ? `${event.filename}:${event.lineno}:${event.colno}` : undefined;
      const stack = err instanceof Error ? err.stack : undefined;
      emitToSink({
        level: 'error',
        source: 'uncaught',
        message: (event && event.message)
          || (err instanceof Error ? `${err.name}: ${err.message}` : 'Uncaught error'),
        detail: stack || location || undefined
      });
    } catch { /* ignore */ }
  }
  function reportRejectionEvent(event) {
    try {
      const reason = event && event.reason;
      emitToSink({
        level: 'error',
        source: 'unhandledrejection',
        message: reason instanceof Error ? `${reason.name}: ${reason.message}` : `Unhandled rejection: ${formatLogArgs([reason])}`,
        detail: reason instanceof Error ? reason.stack : undefined
      });
    } catch { /* ignore */ }
  }

  const errTarget = HAS_WINDOW ? window : (typeof self !== 'undefined' ? self : null);
  if (errTarget && !globalThis.__BA_LOGGER_ERROR_HOOKS__) {
    globalThis.__BA_LOGGER_ERROR_HOOKS__ = true;
    try { errTarget.addEventListener('error', reportErrorEvent); } catch { /* ignore */ }
    try { errTarget.addEventListener('unhandledrejection', reportRejectionEvent); } catch { /* ignore */ }
  }

  // --- public control surface ----------------------------------------
  globalThis.BestiaryLogger = {
    LEVELS,
    getLevel() { return levelName(currentLevel); },
    getLevelValue() { return currentLevel; },
    /** Set the level for THIS context only (does not persist). */
    setLevel(level) { applyLevel(parseLevel(level), { broadcast: true }); },
    isEnabled(kind) {
      if (kind === 'error') return true;
      const need = kind === 'warn' ? LEVELS.warnings
        : (kind === 'info' || kind === 'log') ? LEVELS.info
        : LEVELS.verbose;
      return currentLevel >= need;
    },
    native: nativeConsole,
    formatLogArgs,
    record(entry) { emitToSink(entry || {}); }
  };
})();
