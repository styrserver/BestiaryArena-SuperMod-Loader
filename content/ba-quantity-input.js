/**
 * ba-quantity-input.js — Bestiary Arena SuperMod Loader
 *
 * Shared quantity box for shop-style mods (Better Yasir, Better Hy'genie, Better Tasker hunting-mark shop).
 * Loaded in the page (MAIN) world by injector.js right after ba-toast.js, before any mod runs.
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
