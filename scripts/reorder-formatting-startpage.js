const fs = require('fs');
const path = require('path');

const cyclopediaPath = path.join(__dirname, '..', 'mods', 'Super_Mods/Cyclopedia.js');
let lines = fs.readFileSync(cyclopediaPath, 'utf8').split(/\r?\n/);

function lineIndex(pred, from = 0) {
  const i = lines.findIndex((l, idx) => idx >= from && pred(l));
  if (i < 0) throw new Error('Line not found');
  return i;
}

function spliceBlock(start, endExclusive) {
  const block = lines.slice(start, endExclusive);
  lines.splice(start, endExclusive - start);
  return block;
}

const profileStart = lineIndex((l) => l.startsWith('function renderCyclopediaProfileLoadingHtml()'));
const profileEnd = lineIndex((l) => l.startsWith('// Maps Tab DOM Optimization'));

const debounceStart = lineIndex((l) => l.startsWith('function debounce(func, wait)'));
const domCacheStart = lineIndex((l) => l.startsWith('const DOMCache = {'));

const formatUtilsStart = lineIndex((l) => l.startsWith('const FormatUtils = {'));
const currencyUiStart = lineIndex((l) => l.startsWith('const CURRENCY_UI_SELECTORS'));

const startPageStart = lineIndex((l) => l.startsWith('function createStartPageManager()'));
const startPageEnd = lineIndex((l) => l.startsWith('function isBodyScrollLocked()'));

const startPageBlock = spliceBlock(startPageStart, startPageEnd);
const formatUtilsBlock = spliceBlock(formatUtilsStart, currencyUiStart);
const midBlock = spliceBlock(debounceStart, domCacheStart);
const profileBlock = spliceBlock(profileStart, profileEnd);

const gameDataOpen = lineIndex((l) => l.startsWith('const GAME_DATA = {'));
let gdClose = gameDataOpen;
while (gdClose < lines.length && lines[gdClose].trim() !== '};') gdClose++;
gdClose++;

const formattingInsert = [
  '',
  '// =======================',
  '// 2. Formatting & Small UI Helpers',
  '// =======================',
  '',
  ...profileBlock,
  '',
  ...midBlock,
  '',
  ...formatUtilsBlock,
  ''
];
lines.splice(gdClose, 0, ...formattingInsert);

for (const [from, to] of [
  ['// 4. Creature & Equipment Resolution', '// 5. Creature & Equipment Resolution'],
  ['// 3. Lifecycle Managers', '// 4. Lifecycle Managers'],
  ['// 2. Global State & Configuration', '// 3. Global State & Configuration']
]) {
  const i = lines.indexOf(from);
  if (i >= 0) lines[i] = to;
}

const sec9 = lineIndex((l) => l.includes('// 9. Shared Render Components'));
lines.splice(sec9, 0, '', ...startPageBlock, '');

fs.writeFileSync(cyclopediaPath, lines.join('\n'));
console.log('OK — formatting:', formattingInsert.length, 'lines; start page:', startPageBlock.length, 'lines');
