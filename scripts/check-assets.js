const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') results = results.concat(walk(full));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      results.push(full);
    }
  });
  return results;
}

const files = walk('./src');
const regex = /require\(['"]([^'"]+)['"]\)/g;
let missing = [];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const raw = match[1];
    if (raw.startsWith('@/assets/')) {
      const resolved = path.resolve('.', raw.replace('@/', ''));
      if (!fs.existsSync(resolved)) {
        missing.push({ file: f, asset: raw, resolved });
      }
    } else if (raw.startsWith('../') || raw.startsWith('./')) {
      const resolved = path.resolve(path.dirname(f), raw);
      if (!fs.existsSync(resolved) && !fs.existsSync(resolved + '.png') && !fs.existsSync(resolved + '.jpg') && !fs.existsSync(resolved + '.js') && !fs.existsSync(resolved + '.ts')) {
        missing.push({ file: f, asset: raw, resolved });
      }
    }
  }
});

console.log('Missing assets count:', missing.length);
if (missing.length) console.log(JSON.stringify(missing, null, 2));
