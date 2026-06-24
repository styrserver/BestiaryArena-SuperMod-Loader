const fs = require('fs');
const path = require('path');

const cyclopediaPath = path.join(__dirname, '..', 'mods', 'Super_Mods', 'Cyclopedia.js');
const lines = fs.readFileSync(cyclopediaPath, 'utf8').split(/\r?\n/);

const blockStartIdx = lines.findIndex((l) => l.startsWith('function cyclopediaNormalizeSearchText(value)'));
const sec2Idx = lines.findIndex((l) => l.includes('// 2. Global State & Configuration'));
const sec7Idx = lines.findIndex((l) => l.includes('// 7. DOM/CSS Injection & Entry Points'));

if (blockStartIdx < 0 || sec2Idx < 0 || sec7Idx < 0 || blockStartIdx >= sec2Idx) {
  console.error('Markers not found', { blockStartIdx, sec2Idx, sec7Idx });
  process.exit(1);
}

// Block: search helpers (before header) + section header + CyclopediaHomeSearch IIFE
const headerIdx = lines.findIndex((l, i) => i >= blockStartIdx && i < sec2Idx && l.includes('// 6. Home Search'));
const iifeStartIdx = lines.findIndex((l, i) => i > headerIdx && l.startsWith('const CyclopediaHomeSearch = (() => {'));
let iifeEndIdx = -1;
for (let i = iifeStartIdx; i < sec2Idx; i++) {
  if (lines[i] === '})();') {
    iifeEndIdx = i;
    break;
  }
}

if (headerIdx < 0 || iifeStartIdx < 0 || iifeEndIdx < 0) {
  console.error('Home Search block markers missing', { headerIdx, iifeStartIdx, iifeEndIdx });
  process.exit(1);
}

const helpers = lines.slice(blockStartIdx, headerIdx).filter((l) => l.trim() !== '');
const header = [
  '',
  '// =======================',
  '// 6. Home Search',
  '// =======================',
  ''
];
const iife = lines.slice(iifeStartIdx, iifeEndIdx + 1);
const homeSearchBlock = [...header, ...helpers, '', ...iife, ''];

const withoutBlock = [
  ...lines.slice(0, blockStartIdx),
  ...lines.slice(sec2Idx)
];

const insertIdx = withoutBlock.findIndex((l) => l.includes('// 7. DOM/CSS Injection & Entry Points'));
if (insertIdx < 0) {
  console.error('Section 7 not found after removal');
  process.exit(1);
}

const result = [
  ...withoutBlock.slice(0, insertIdx),
  ...homeSearchBlock,
  ...withoutBlock.slice(insertIdx)
];

fs.writeFileSync(cyclopediaPath, result.join('\n'));
console.log('Moved Home Search block:', homeSearchBlock.length, 'lines before section 7');
