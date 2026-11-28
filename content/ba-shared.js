/**
 * ba-shared.js — Bestiary Arena SuperMod Loader
 *
 * Small page (MAIN) world helpers shared by databases and mods: window.BAAssets, window.BAWait, window.BAToast and
 * window.BAQuantityInput, in that order (the later ones use BAAssets at load). Injected first by injector.js.
 */

/**
 * `window.BAAssets.url('1-frame')` returns the game's own URL for one of its hashed media images
 * (`/_next/static/media/<name>.<hash>.png`). The hash changes whenever the game rebuilds that image, so a
 * hardcoded URL silently 404s after an update. The live URL is read from the game's stylesheets (the frames and
 * backgrounds are all `url(...)` values there); FALLBACK is only the last known hash, used when the stylesheet
 * has no rule for the image. tools/check-media-hashes.mjs keeps FALLBACK in step with the live game.
 *
 *   BAAssets.url('background-dark')   -> 'https://bestiaryarena.com/_next/static/media/background-dark.<hash>.png'
 *   BAAssets.css('1-frame')           -> 'url("https://…/1-frame.<hash>.png")'
 */
(function () {
  if (window.BAAssets) return;

  // name -> `<name>.<hash>.<ext>`. Keep in step with the game: `node tools/check-media-hashes.mjs`.
  var FALLBACK = {
    '1-frame': '1-frame.f1ab7b00.png',
    '1-frame-pressed': '1-frame-pressed.e3fabbc5.png',
    '1-frame-blue': '1-frame-blue.cf300a6a.png',
    '1-frame-green': '1-frame-green.fe32d59c.png',
    '1-frame-red': '1-frame-red.946aade9.png',
    '3-frame': '3-frame.87c349c1.png',
    '4-frame': '4-frame.a58d0c39.png',
    '4-frame-top': '4-frame-top.b7a55115.png',
    'background-blue': 'background-blue.7259c4ed.png',
    'background-dark': 'background-dark.95edca67.png',
    'background-darker': 'background-darker.2679c837.png',
    'background-green': 'background-green.be515334.png',
    'background-red': 'background-red.21d3f4bd.png',
    'background-regular': 'background-regular.b0337118.png',
    'scrollbar-handle-vertical': 'scrollbar-handle-vertical.962972d4.png'
  };

  var BASE = 'https://bestiaryarena.com/_next/static/media/';
  var MEDIA_RE = /\/_next\/static\/media\/([a-z0-9-]+)\.[0-9a-f]{8}\.(png|webp)/g;
  var live = {};
  var scannedSheets = 0;

  /** Reads every `/_next/static/media/<name>.<hash>.<ext>` url the game's stylesheets mention. */
  function scan() {
    var sheets;
    try { sheets = document.styleSheets; } catch (e) { return; }
    if (!sheets || sheets.length === scannedSheets) return;
    scannedSheets = sheets.length;
    for (var i = 0; i < sheets.length; i++) {
      var rules;
      try { rules = sheets[i].cssRules; } catch (e) { continue; } // cross-origin sheet
      if (!rules) continue;
      for (var j = 0; j < rules.length; j++) {
        var text = rules[j].cssText;
        if (!text || text.indexOf('/_next/static/media/') < 0) continue;
        MEDIA_RE.lastIndex = 0;
        var m;
        while ((m = MEDIA_RE.exec(text))) live[m[1]] = m[0].slice('/_next/static/media/'.length);
      }
    }
  }

  function file(name) {
    if (!live[name]) scan();
    return live[name] || FALLBACK[name] || null;
  }

  window.BAAssets = {
    /** Absolute URL of a game media image, or '' when the name is unknown. */
    url: function (name) {
      var f = file(name);
      return f ? BASE + f : '';
    },
    /** `url("…")` ready for a CSS value. */
    css: function (name) {
      return 'url("' + window.BAAssets.url(name) + '")';
    },
    FALLBACK: FALLBACK
  };
})();

/**
 * `window.BAWait.gameState(callback, options)` runs `callback` once the game's state is ready. database/*.js read
 * `globalThis.state.utils.*` at load time, and on a slow or cold page load those accessors can still be undefined;
 * they build their cache from this callback (see the "Modules that read state.utils.* at load time must retry"
 * note in .claude/CLAUDE.md for what to do with the result).
 *
 *   BAWait.gameState(build, { label: 'x-database.js', ready: (state) => !!state?.utils?.getEquipment })
 *
 * Options:
 *   label        prefix of the console warnings
 *   ready        (state) => boolean; default: player, board and utils.getEquipment exist
 *   retries      fast checks, `interval` ms apart (default 20 x 250ms)
 *   slowRetries  extra checks `slowInterval` ms apart after the fast ones (default 0; 60 x 2000ms for a cold load)
 *   buildAnyway  true (default): after the last check run `callback` anyway; false: give up and leave the cache empty
 *
 */
(function () {
  if (window.BAWait) return;

  function defaultReady(state) {
    return !!(state && state.player && state.player.getSnapshot && state.board && state.board.getSnapshot &&
      state.utils && state.utils.getEquipment);
  }

  function gameState(callback, options) {
    var o = options || {};
    var label = o.label ? '[' + o.label + '] ' : '[BAWait] ';
    var ready = o.ready || defaultReady;
    var fast = o.retries == null ? 20 : o.retries;
    var slow = o.slowRetries || 0;
    var interval = o.interval || 250;
    var slowInterval = o.slowInterval || 2000;
    var buildAnyway = o.buildAnyway !== false;
    var attempt = 0;

    function check() {
      var ok = false;
      try {
        ok = !!ready(globalThis.state || window.state);
      } catch (error) {
        console.error(label + 'Error checking game state:', error);
      }
      if (ok) { callback(); return; }
      if (attempt < fast + slow) {
        var delay = attempt < fast ? interval : slowInterval;
        attempt++;
        setTimeout(check, delay);
      } else if (buildAnyway) {
        console.warn(label + 'Game state not ready after max retries, building anyway');
        callback();
      } else {
        console.warn(label + 'Game state never became ready; left empty');
      }
    }
    check();
  }

  window.BAWait = { gameState: gameState };
})();

/**
 * One shared toast stack for every mod, in the game's own toast markup
 * (widget-top / widget-bottom, pixel-font-16, same enter animation). Mods can call it directly:
 *
 *   window.BAToast.show({ mod: 'Raid Hunter', message: 'Starting raid', type: 'info', icon: '…/raid.png' });
 *
 * - `mod`      (required) name shown first, so the player knows which mod spoke.
 * - `hideName` true shows the message without the name (text spoken in-world). `mod` still drives muting.
 * - `message`  sentence-case fragment, ideally <= 60 chars, one whole translatable string.
 *               May also be a DOM Node for rich content (icons, coloured words); it is used as-is.
 * - `type`     'info' | 'success' | 'warning' | 'error' (colours the mod name with the game's own
 *               text-cooldown / text-valid / text-boosted / text-invalid classes, sets default duration).
 *               For coloured words inside a message use those same game classes (never text-success/text-error:
 *               they do not exist in the game CSS).
 * - `icon`     optional image URL shown before the name.
 * - `key`, `cooldown`  optional: the same mod+key shows at most once per `cooldown` ms (returns null when skipped).
 * - `action`   optional { label, onClick }: a red button inside the toast (clicking it does not dismiss).
 * - `onClick`  optional callback run when the toast is clicked (the toast is dismissed first).
 * - `interactive` true when the message node holds its own buttons/links (renders as a <div>).
 * - `dismissOnClick` default true; false makes a click-through status toast (use duration: 0 + update()).
 * - `duration` ms; 0 keeps the toast until dismissed through the returned handle.
 *   Clicking a toast dismisses it. Trailing '.' / '!' are stripped; a newline in the message starts a new line.
 *
 * Muting: the player can switch a mod's toasts off in Mod Settings > Toasts. That list lives in
 * localStorage 'ba-toast-muted' ({ ids, names }); show() drops non-error toasts whose `mod` is in `names` and
 * returns an inert handle, so callers never need a null check. Errors always show.
 *
 * Returns { remove(), update(message), relayout(), isOpen() }. Toasts from all mods share one stack, so they never
 * overlap. Call BAToast.clearMod(name) from a mod's cleanup() to drop its toasts and timers.
 */
(function () {
  'use strict';

  if (window.BAToast && window.BAToast.__version) return;

  var CONTAINER_ID = 'ba-toast-container';
  var GAP_PX = 6;
  var ACTION_BG = window.BAAssets.url('background-red');
  var ACTION_FRAME = window.BAAssets.url('4-frame');
  var MAX_VISIBLE = 6;
  // Game palette classes (not custom hex), so toasts match the native UI: blue / green / gold / red
  var NAME_CLASSES = { info: 'text-cooldown', success: 'text-valid', warning: 'text-boosted', error: 'text-invalid' };
  var DEFAULT_DURATION_MS = { info: 4000, success: 4000, warning: 6000, error: 7000 };

  var MUTE_KEY = 'ba-toast-muted';
  var MUTED_HANDLE = { remove: function () {}, relayout: function () {}, isOpen: function () { return false; }, update: function () {} };

  var entries = [];
  var lastShownAt = {};

  // Mod Settings > Toasts keeps the displayed mod names of the switched-off mods here
  function isMuted(mod, type) {
    if (!mod || type === 'error') return false;
    try {
      var raw = localStorage.getItem(MUTE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return !!(parsed && Array.isArray(parsed.names) && parsed.names.indexOf(mod) !== -1);
    } catch (error) {
      return false;
    }
  }

  // One style for everyone: no trailing '.' or '!' (a '?' or '…' stays)
  function normalizeMessage(value) {
    return value == null ? '' : String(value).trim().replace(/[.!]+$/, '');
  }

  function safely(callback, label) {
    try {
      callback();
    } catch (error) {
      console.error('[BAToast] ' + label + ' failed:', error);
    }
  }

  function getContainer() {
    var container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.style.cssText = 'position: fixed; z-index: 9999; inset: 16px 16px 64px; pointer-events: none;';
      document.body.appendChild(container);
    }
    return container;
  }

  // Oldest toast sits at the bottom, newer ones stack above it.
  function layout() {
    var offset = 0;
    entries.forEach(function (entry) {
      entry.item.style.transform = 'translateY(-' + offset + 'px)';
      offset += entry.item.offsetHeight + GAP_PX;
    });
  }

  function removeEntry(entry) {
    var index = entries.indexOf(entry);
    if (index === -1) return;
    entries.splice(index, 1);
    if (entry.timer) clearTimeout(entry.timer);
    if (entry.observer) entry.observer.disconnect();
    entry.closed = true;
    entry.item.remove();
    layout();
    if (!entries.length) {
      var container = document.getElementById(CONTAINER_ID);
      if (container) container.remove();
    }
  }

  function show(options) {
    var opts = options || {};
    var isNode = typeof Node !== 'undefined' && opts.message instanceof Node;
    var message = isNode ? opts.message : normalizeMessage(opts.message);
    if (!isNode && !message) return null;
    if (!opts.mod) console.warn('[BAToast] toast shown without a mod name:', message);
    var type = NAME_CLASSES[opts.type] ? opts.type : 'info';
    if (!document.body) return null;
    if (isMuted(opts.mod, type)) return MUTED_HANDLE;

    // Optional de-duplication: the same mod+key is shown at most once per `cooldown` ms
    if (opts.key && opts.cooldown > 0) {
      var dedupeKey = (opts.mod || '') + '|' + opts.key;
      var now = Date.now();
      if (lastShownAt[dedupeKey] && now - lastShownAt[dedupeKey] < opts.cooldown) return null;
      lastShownAt[dedupeKey] = now;
    }

    var container = getContainer();
    while (entries.length >= MAX_VISIBLE) {
      var evictable = entries.filter(function (entry) { return !entry.persistent; })[0] || entries[0];
      removeEntry(evictable);
    }

    var item = document.createElement('div');
    item.className = 'ba-toast-item';
    item.style.cssText = 'left: 0; right: 0; bottom: 0; display: flex; position: absolute; justify-content: flex-end; transition: 230ms cubic-bezier(0.21, 1.02, 0.73, 1);';

    var dismissOnClick = opts.dismissOnClick !== false;
    var action = opts.action && typeof opts.action.onClick === 'function' ? opts.action : null;
    var interactive = !!(opts.interactive || action);
    // A <button> parent swallows clicks on its children in some browsers: interactive toasts use a <div>
    var toast = document.createElement(interactive ? 'div' : 'button');
    toast.className = 'non-dismissable-dialogs shadow-lg animate-in fade-in zoom-in-95 slide-in-from-top lg:slide-in-from-bottom';
    // Click-through when it can neither be dismissed nor acted on (e.g. a persistent status line)
    toast.style.pointerEvents = dismissOnClick || interactive ? 'auto' : 'none';
    if (interactive) toast.style.cursor = 'default';
    else {
      toast.type = 'button';
      if (typeof opts.onClick === 'function') toast.style.cursor = 'pointer';
    }
    toast.setAttribute('role', type === 'error' || type === 'warning' ? 'alert' : 'status');

    var top = document.createElement('div');
    top.className = 'widget-top h-2.5';

    var bottom = document.createElement('div');
    bottom.className = 'widget-bottom pixel-font-16 flex items-center gap-2 px-2 py-1 text-whiteHighlight';

    if (opts.icon) {
      var icon = document.createElement('img');
      icon.alt = '';
      icon.src = opts.icon;
      icon.className = 'pixelated';
      icon.style.cssText = 'width: 16px; height: 16px; flex: 0 0 auto;';
      bottom.appendChild(icon);
    }

    var text = document.createElement('div');
    text.className = 'text-left';
    text.style.maxWidth = '380px';
    text.style.whiteSpace = 'pre-line';
    if (opts.mod && !opts.hideName) {
      var name = document.createElement('span');
      name.textContent = opts.mod + ':';
      name.className = NAME_CLASSES[type];
      name.style.marginRight = '6px';
      text.appendChild(name);
    }
    var body = document.createElement('span');
    if (isNode) body.appendChild(message);
    else body.textContent = message;
    text.appendChild(body);
    bottom.appendChild(text);

    if (action) {
      var actionBtn = document.createElement('span');
      actionBtn.setAttribute('role', 'button');
      actionBtn.tabIndex = 0;
      actionBtn.textContent = action.label || 'OK';
      actionBtn.style.cssText = 'flex: 0 0 auto; padding: 2px 10px; cursor: pointer; color: #fff;' +
        ' background: url("' + ACTION_BG + '") repeat #8a2d2d; border: 3px solid transparent;' +
        ' border-image: url("' + ACTION_FRAME + '") 4 fill stretch;';
      actionBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        safely(action.onClick, 'action');
      });
      actionBtn.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        e.stopPropagation();
        safely(action.onClick, 'action');
      });
      bottom.appendChild(actionBtn);
    }

    toast.appendChild(top);
    toast.appendChild(bottom);
    item.appendChild(toast);
    container.appendChild(item);

    var entry = { item: item, mod: opts.mod || '', timer: null, body: body, persistent: false, observer: null, closed: false };
    if (dismissOnClick) {
      toast.addEventListener('click', function (e) {
        // links inside a rich message keep their own click
        if (e.target && e.target.closest && e.target.closest('a[href]')) return;
        removeEntry(entry);
        if (typeof opts.onClick === 'function') safely(opts.onClick, 'onClick');
      });
    }
    entries.push(entry);
    layout();

    var duration = opts.duration == null ? DEFAULT_DURATION_MS[type] : opts.duration;
    entry.persistent = !(duration > 0);
    if (duration > 0) entry.timer = setTimeout(function () { removeEntry(entry); }, duration);

    // Content changes (updates, wrapping, late fonts) re-stack the toasts on their own
    if (typeof ResizeObserver !== 'undefined') {
      entry.observer = new ResizeObserver(layout);
      entry.observer.observe(item);
    }

    return {
      remove: function () { removeEntry(entry); },
      relayout: layout,
      isOpen: function () { return !entry.closed; },
      update: function (next) {
        if (entry.closed) return;
        if (typeof Node !== 'undefined' && next instanceof Node) entry.body.replaceChildren(next);
        else entry.body.textContent = normalizeMessage(next);
        layout();
      }
    };
  }

  function clearMod(mod) {
    entries.slice().forEach(function (entry) {
      if (entry.mod === mod) removeEntry(entry);
    });
  }

  function removeAll() {
    entries.slice().forEach(removeEntry);
  }

  window.BAToast = { __version: 3, show: show, clearMod: clearMod, removeAll: removeAll, isMuted: isMuted };
})();

/**
 * Shared quantity box for shop-style mods (Better Yasir, Better Hy'genie, Better Tasker hunting-mark shop).
 *
 *   const input = window.BAQuantityInput.create({ max: 12, min: 1, value: 1, className: 'my-mod-qty' });
 *
 * - Text box styled like the game's dark input; `className` is only an extra hook for the mod's own selectors.
 * - Typing is clamped to [min, max]; a non-number resets to min; leaving it empty resets to min on blur.
 *   The live limit is the input's `max` attribute, so a mod can raise/lower it later (`input.max = n`).
 * - `value: ''` starts empty (placeholder shows `min`).
 * Mods should not restyle the box from scratch; set layout (width, margin) from their own class.
 */
(function () {
  'use strict';
  if (window.BAQuantityInput) return;

  var STYLE_ID = 'ba-quantity-input-styles';
  var BASE_CLASS = 'ba-quantity-input';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.' + BASE_CLASS + ' {',
      '  width: 100%; max-width: 50px; height: 20px;',
      "  background-image: url('" + window.BAAssets.url('background-darker') + "');",
      '  background-size: auto; background-repeat: repeat; background-position: center;',
      "  border: none; color: white; font-family: 'Courier New', monospace; font-size: 12px;",
      '  text-align: center; padding: 2px; margin-bottom: 1px; border-radius: 2px;',
      '  display: block; position: relative;',
      '}',
      '.' + BASE_CLASS + '::before {',
      "  content: ''; position: absolute; top: -2px; left: -2px; right: -2px; bottom: -2px;",
      "  background-image: url('" + window.BAAssets.url('1-frame') + "');",
      '  background-size: 100% 100%; background-repeat: no-repeat; background-position: center;',
      '  z-index: -1; border-radius: 4px;',
      '}',
      '.' + BASE_CLASS + ':focus { outline: none; box-shadow: 0 0 0 2px rgba(106, 106, 106, 0.5); }',
      '.' + BASE_CLASS + '::-webkit-inner-spin-button,',
      '.' + BASE_CLASS + '::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function create(options) {
    var opts = options || {};
    var min = Number.isFinite(opts.min) ? opts.min : 1;
    var max = Number.isFinite(opts.max) ? opts.max : min;
    var value = opts.value === undefined ? min : opts.value;

    ensureStyles();
    var input = document.createElement('input');
    input.type = 'text';
    input.className = BASE_CLASS + (opts.className ? ' ' + opts.className : '');
    input.placeholder = String(min);
    input.value = String(value);
    input.max = String(max);

    input.addEventListener('input', function () {
      var text = this.value.trim();
      if (text === '') return; // allow clearing while typing
      var limit = parseInt(this.max, 10);
      if (!Number.isFinite(limit)) limit = max;
      var n = parseInt(text, 10);
      if (isNaN(n) || n < min) {
        this.value = String(min);
      } else if (n > limit) {
        this.value = String(limit);
      }
    });
    input.addEventListener('blur', function () {
      if (this.value.trim() === '') this.value = String(min);
    });
    return input;
  }

  window.BAQuantityInput = { create: create };
})();
