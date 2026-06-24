const fs = require('fs');
const path = require('path');

const cyclopediaPath = path.join(__dirname, '..', 'mods', 'Super_Mods', 'Cyclopedia.js');
const lines = fs.readFileSync(cyclopediaPath, 'utf8').split(/\r?\n/);

const sec6Idx = lines.findIndex((l) => l.includes('// 6. Characters Tab Caching Utilities'));
const sec5bIdx = lines.findIndex((l) => l.includes('// 5b. Cyclopedia API'));
const sec7Idx = lines.findIndex((l) => l.includes('// 7. DOM/CSS Injection Helpers'));

if (sec6Idx < 0 || sec5bIdx < 0 || sec7Idx < 0 || sec6Idx >= sec5bIdx) {
  console.error('Section markers unexpected', { sec6Idx, sec5bIdx, sec7Idx });
  process.exit(1);
}

const sec6Block = lines.slice(sec6Idx, sec5bIdx);
const sec5bBlock = lines.slice(sec5bIdx, sec7Idx);

const sec6Renamed = sec6Block.map((l) =>
  l.includes('// 6. Characters Tab Caching Utilities') ? '// 5c. Characters Tab Caching Utilities' : l
);
const sec5bRenamed = sec5bBlock.map((l) =>
  l.includes('// 5b. Cyclopedia API') ? '// 5b. Cyclopedia API & MapsDataFetcher' : l
);

const result = [
  ...lines.slice(0, sec6Idx),
  ...sec5bRenamed,
  ...sec6Renamed,
  ...lines.slice(sec7Idx)
];

fs.writeFileSync(cyclopediaPath, result.join('\n'));
console.log('Swapped 5b before 5c (caching)');
