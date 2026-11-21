/**
 * ba-toast.js — Bestiary Arena SuperMod Loader
 *
 * One shared toast stack for every mod, in the game's own toast markup
 * (widget-top / widget-bottom, pixel-font-16, same enter animation). Injected into the page
 * (MAIN) world by injector.js before local_mods.js, so mods can call it directly:
 *
 *   window.BAToast.show({ mod: 'Raid Hunter', message: 'Starting raid', type: 'info', icon: '…/raid.png' });
 *
 * - `mod`      (required) name shown first, so the player knows which mod spoke.
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
  var ACTION_BG = 'https://bestiaryarena.com/_next/static/media/background-red.21d3f4bd.png';
  var ACTION_FRAME = 'https://bestiaryarena.com/_next/static/media/4-frame.a58d0c39.png';
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
    if (opts.mod) {
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
