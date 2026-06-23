const fs = require('fs');
const path = require('path');

const cyclopediaPath = path.join(__dirname, '..', 'mods', 'Super_Mods', 'Cyclopedia.js');
let lines = fs.readFileSync(cyclopediaPath, 'utf8').split(/\r?\n/);

if (lines.some((l, i) => i < 13000 && l.includes('// 10e. Inventory Tab Implementation'))) {
  console.error('Already hoisted');
  process.exit(1);
}

const innerStartIdx = lines.findIndex(
  (l, i) => i >= 15990 && l.includes('function createInventoryTabPage(selectedCreature')
);
let innerEndIdx = -1;
for (let i = innerStartIdx + 1; i < lines.length; i++) {
  if (lines[i].trim() === '}' && lines.slice(i + 1, i + 5).some((l) => l.includes('// Create equipment tab via factory'))) {
    innerEndIdx = i;
    break;
  }
}

if (innerStartIdx < 0 || innerEndIdx < 0) {
  console.error('Could not find inner block', innerStartIdx, innerEndIdx);
  process.exit(1);
}

const block = lines.slice(innerStartIdx, innerEndIdx + 1);
const deindented = block.map((line) => (line.startsWith('    ') ? line.slice(4) : line));
deindented[0] =
  'function createInventoryTabPage(selectedCreature, selectedEquipment, selectedInventory, setSelectedCreature, setSelectedEquipment, setSelectedInventory, updateRightCol, pendingGazerSelection = null) {';

const header = [
  '',
  '// =======================',
  '// 10e. Inventory Tab Implementation',
  '// =======================',
  ''
];

const insertAt = lines.findIndex((l) => l === '}' && lines[lines.indexOf(l) - 1]?.includes('updateRightCol();'));
// More reliable: find line after Arsenal tab "return d;"
const arsenalEndIdx = lines.findIndex(
  (l, i) => i > 12000 && i < 12500 && l === '  return d;' && lines[i - 1]?.includes('updateRightCol()')
);
if (arsenalEndIdx < 0) {
  console.error('Could not find Arsenal tab end');
  process.exit(1);
}
const insertAfter = arsenalEndIdx + 1; // after closing brace of createEquipmentTabPage

const newLines = [
  ...lines.slice(0, insertAfter),
  ...header,
  ...deindented,
  '',
  ...lines.slice(insertAfter, innerStartIdx),
  ...lines.slice(innerEndIdx + 1)
];

const factoryOld =
  '() => createInventoryTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}),';
const factoryNew =
  '() => createInventoryTabPage(selectedCreature, selectedEquipment, selectedInventory, v => { selectedCreature = v; }, v => { selectedEquipment = v; }, v => { selectedInventory = v; }, () => {}, pendingGazerSelection),';

const content = newLines.join('\n');
if (!content.includes(factoryOld)) {
  console.error('Factory line not found');
  process.exit(1);
}

fs.writeFileSync(cyclopediaPath, content.replace(factoryOld, factoryNew));
console.log('Hoisted createInventoryTabPage:', deindented.length, 'lines');
console.log('Removed inner block lines', innerStartIdx + 1, '-', innerEndIdx + 1);
console.log('Inserted at line', insertAfter + 1);
