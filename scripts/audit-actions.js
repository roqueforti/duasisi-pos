const fs = require('fs');
const path = require('path');

function scanDir(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      files = files.concat(scanDir(full));
    } else if (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = scanDir('d:/PAL/duasisi-pos/next-app/components')
  .concat(scanDir('d:/PAL/duasisi-pos/next-app/lib'))
  .concat(scanDir('d:/PAL/duasisi-pos/next-app/app'));

const actionsFound = new Set();
const regex = /runBackend(?:Cached)?(?:<[^>]+>)?\(\s*['"]([^'"]+)['"]/g;

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    actionsFound.add(match[1]);
  }
}

// Check against api.ts switch cases
const apiContent = fs.readFileSync('d:/PAL/duasisi-pos/next-app/lib/api.ts', 'utf8');
const caseRegex = /case\s+['"]([^'"]+)['"]:/g;
const mappedCases = new Set();
let match;
while ((match = caseRegex.exec(apiContent)) !== null) {
  mappedCases.add(match[1]);
}

console.log('Total unique actions called in frontend:', actionsFound.size);
console.log('Total mapped actions in Supabase:', mappedCases.size);

const unmapped = [];
for (const act of actionsFound) {
  if (!mappedCases.has(act)) {
    unmapped.push(act);
  }
}

console.log('\nUnmapped actions:');
console.log(JSON.stringify(unmapped, null, 2));
