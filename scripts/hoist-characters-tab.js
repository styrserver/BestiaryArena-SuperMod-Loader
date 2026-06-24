const fs = require('fs');
const path = require('path');

const cyclopediaPath = path.join(__dirname, '..', 'mods', 'Super_Mods', 'Cyclopedia.js');
let lines = fs.readFileSync(cyclopediaPath, 'utf8').split(/\r?\n/);

if (lines.some((l, i) => i < 14000 && l.includes('// 10f. Characters Tab Implementation'))) {
  console.error('Already hoisted');
  process.exit(1);
}

const innerStartIdx = lines.findIndex(
  (l, i) => i >= 13390 && l.includes('function createCharactersTabColumns(col1, rightCol)')
);
if (innerStartIdx < 0) {
  console.error('Could not find characters block start');
  process.exit(1);
}

let innerEndIdx = -1;
for (let i = innerStartIdx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '}' && lines.slice(i + 1, i + 6).some((l) => l.includes('// Create equipment tab via factory'))) {
    innerEndIdx = i;
    break;
  }
}
if (innerEndIdx < 0) {
  console.error('Could not find characters block end');
  process.exit(1);
}

const block = lines.slice(innerStartIdx, innerEndIdx + 1);
const deindented = block.map((line) => (line.startsWith('    ') ? line.slice(4) : line));

const header = [
  '',
  '// =======================',
  '// 10f. Characters Tab Implementation',
  '// =======================',
  ''
];

const inventoryEndIdx = lines.findIndex((l, i) => {
  if (i < 13200 || i > 13300 || l !== '}') return false;
  const window = lines.slice(Math.max(0, i - 8), i);
  return window.some((w) => w.includes('_cleanupSubscription')) && lines[i - 1]?.trim() === 'return d;';
});
if (inventoryEndIdx < 0) {
  console.error('Could not find inventory tab end');
  process.exit(1);
}

const insertAfter = inventoryEndIdx + 1;
const helperCommentIdx = lines.findIndex((l) => l === '// Helper functions for creating Characters tab components');

const newLines = [
  ...lines.slice(0, insertAfter),
  ...header,
  ...deindented,
  '',
  ...lines
    .slice(insertAfter, innerStartIdx)
    .filter((l) => l !== '// Helper functions for creating Characters tab components'),
  ...lines.slice(innerEndIdx + 1)
];
fs.writeFileSync(cyclopediaPath, newLines.join('\n'));
console.log('Hoisted Characters tab:', deindented.length, 'lines');
console.log('Removed inner block lines', innerStartIdx + 1, '-', innerEndIdx + 1);
console.log('Inserted at line', insertAfter + 1);
