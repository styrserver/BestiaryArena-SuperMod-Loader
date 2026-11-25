/**
 * ba-assets.js — Bestiary Arena SuperMod Loader
 *
 * `window.BAAssets.url('1-frame')` returns the game's own URL for one of its hashed media images
 * (`/_next/static/media/<name>.<hash>.png`). The hash changes whenever the game rebuilds that image, so a
 * hardcoded URL silently 404s after an update. The live URL is read from the game's stylesheets (the frames and
 * backgrounds are all `url(...)` values there); FALLBACK is only the last known hash, used when the stylesheet
 * has no rule for the image. tools/check-media-hashes.mjs keeps FALLBACK in step with the live game.
 *
 *   BAAssets.url('background-dark')   -> 'https://bestiaryarena.com/_next/static/media/background-dark.95edca67.png'
 *   BAAssets.css('1-frame')           -> 'url("https://…/1-frame.f1ab7b00.png")'
 *
 * Loaded in the page (MAIN) world by injector.js before ba-toast.js, so every mod can use it.
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
