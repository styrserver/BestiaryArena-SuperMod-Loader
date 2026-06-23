const fs = require('fs');
const path = require('path');

const cyclopediaPath = path.join(__dirname, '..', 'mods', 'Super_Mods', 'Cyclopedia.js');
let lines = fs.readFileSync(cyclopediaPath, 'utf8').split(/\r?\n/);

if (lines.some((l) => l.includes('// 9. Shared Render Components'))) {
  console.error('Section 9 already present');
  process.exit(1);
}

const blockStartIdx = lines.findIndex(
  (l, i) => i > 16600 && l.startsWith('function renderMonsterStats(monsterData)')
);
if (blockStartIdx < 0) {
  console.error('renderMonsterStats not found');
  process.exit(1);
}

const blockEndIdx = lines.findIndex(
  (l, i) => i > blockStartIdx && l === 'const cyclopediaEventHandlers = [];'
);
if (blockEndIdx < 0) {
  console.error('Block end marker not found');
  process.exit(1);
}

const insertIdx = lines.findIndex((l) => l.includes('// 10b. Maps Tab Implementation'));
if (insertIdx < 0) {
  console.error('10b section not found');
  process.exit(1);
}

const block = lines.slice(blockStartIdx, blockEndIdx);
const header = [
  '',
  '// =======================',
  '// 9. Shared Render Components',
  '// =======================',
  ''
];

const withoutBlock = [
  ...lines.slice(0, blockStartIdx),
  ...lines.slice(blockEndIdx)
];

// Re-find insert index after removal
const insertIdx2 = withoutBlock.findIndex((l) => l.includes('// 10b. Maps Tab Implementation'));

const layoutSectionIdx = withoutBlock.findIndex((l) => l.includes('// 10. Modal & Template Rendering'));
if (layoutSectionIdx >= 0) {
  withoutBlock[layoutSectionIdx] = '// 8. Layout Utilities & Modal Shell';
}

const result = [
  ...withoutBlock.slice(0, insertIdx2),
  ...header,
  ...block,
  '',
  ...withoutBlock.slice(insertIdx2)
];

fs.writeFileSync(cyclopediaPath, result.join('\n'));
console.log('Moved', block.length, 'lines to section 9 (before 10b)');
console.log('Removed from after openCyclopediaModal at line', blockStartIdx + 1);
