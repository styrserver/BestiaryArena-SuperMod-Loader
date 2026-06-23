const fs = require('fs');
const path = require('path');

const cyclopediaPath = path.join(__dirname, '..', 'mods', 'Super_Mods', 'Cyclopedia.js');
const lines = fs.readFileSync(cyclopediaPath, 'utf8').split(/\r?\n/);

const initStartIdx = lines.findIndex((l) => l === 'const cyclopediaEventHandlers = [];');
let openEndIdx = initStartIdx - 1;
while (openEndIdx > 0 && lines[openEndIdx].trim() === '') openEndIdx--;
const teardownStartIdx = lines.findIndex((l) => l === '// --- Modal teardown ---');
const exportsSectionIdx = lines.findIndex((l) => l.includes('// 12. Exports & Lifecycle Management'));

if ([openEndIdx, initStartIdx, teardownStartIdx, exportsSectionIdx].some((i) => i < 0)) {
  console.error('Markers not found', { openEndIdx, initStartIdx, teardownStartIdx, exportsSectionIdx });
  process.exit(1);
}

const initBlock = lines.slice(initStartIdx, teardownStartIdx);
const teardownBlock = lines.slice(teardownStartIdx, exportsSectionIdx);

const result = [
  ...lines.slice(0, openEndIdx + 1),
  '',
  ...teardownBlock,
  '',
  ...lines.slice(openEndIdx + 1, initStartIdx),
  ...initBlock,
  ...lines.slice(exportsSectionIdx)
];

fs.writeFileSync(cyclopediaPath, result.join('\n'));
console.log('Grouped modal teardown after openCyclopediaModal; init block before exports');
