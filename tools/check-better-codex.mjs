#!/usr/bin/env node
/**
 * Read-only drift check of what mods/Super_Mods/Better_Codex.js looks for inside the game's code: the
 * markers it picks webpack modules by, the trade API procedures it calls, and the element ids, props and
 * classes it finds the game's windows with. A change there breaks a feature without any error.
 *
 *   MARKER    a gameModule() marker no game chunk contains any more
 *   STRING    a name or class the mod relies on that no game chunk contains any more
 *   UNLISTED  a gameModule('...') literal in the mod that this tool does not check
 *
 * Presence only: it cannot tell that a name still means the same. Test in game after drift.
 *
 * Usage:
 *   node tools/check-better-codex.mjs
 *
 * Exit code: 0 OK, 1 drift, 2 network or parse failure.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadChunks } from './lib.mjs';

// Keep in step with the mod; the group markers there are built as `${first}:{name:{en:`.
const MARKERS = [
  'Unknown codex availability', 'Unknown codex card source',
  'Rift Warrior":{id:', 'Widow Queen":{id:', 'Raccoon Backpack":{spriteId:', 'Astronis:{x:',
  'warrior:{name:{en:', 'arachnid:{name:{en:', 'minotaur:{name:{en:', 'classic:{name:{en:',
  'Hand of the Inquisition":{x:', 'Festive Snowman":{x:', 'Monster [".concat(', 'ankrahmun:{name:{en:',
  '["Runs: ",', '"tooltip.open"', 'source:"outlined_text"', 'locale:"en",isEn:!0,translate:',
  'openGotoRoom:!1,mapPickerForm:'
];
const STRINGS = [
  'findSpares', 'acceptOffer', 'removeOffer', 'afterTradeId', 'lastTradeId', 'sparesPlayerMisses',
  'loadingPartnerId', 'codex-search', 'data-entry-key', 'codexData',
  'frame-pressed-1 surface-dark relative min-h-0', 'widget-top-text',
  'category:{en:"Outfit",pt:"', 'category:{en:"Mount",pt:"', 'category:{en:"Creature",pt:"', 'category:{en:"Equipment",pt:"', 'category:{en:"Map",pt:"', 'category:{en:"Backpack",pt:"'
];

try {
  const code = (await loadChunks()).join('\n');
  const source = readFileSync(join(ROOT, 'mods/Super_Mods/Better_Codex.js'), 'utf8');

  const problems = [
    ...MARKERS.filter((marker) => !code.includes(marker)).map((marker) => `MARKER    ${marker}`),
    ...STRINGS.filter((text) => !code.includes(text)).map((text) => `STRING    ${text}`),
    ...[...source.matchAll(/gameModule\('([^']+)'\)/g)].map((m) => m[1])
      .filter((marker) => !MARKERS.includes(marker)).map((marker) => `UNLISTED  ${marker}`)
  ];

  if (problems.length) {
    console.log([...new Set(problems)].join('\n'));
    console.log(`DRIFT: ${new Set(problems).size} thing(s) Better Codex relies on were not found.`);
    process.exit(1);
  }
  console.log(`OK: all ${MARKERS.length} module markers and ${STRINGS.length} names Better Codex relies on are in the game.`);
} catch (error) {
  console.error(`FAILED: ${error.message}`);
  process.exit(2);
}
