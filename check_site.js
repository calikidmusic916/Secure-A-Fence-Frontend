const fs = require('fs');

const html = fs.readFileSync('public/index.html', 'utf8');
const js = fs.readFileSync('public/script.js', 'utf8');

// 1. Find all onclick references
const onclickRegex = /onclick="([^"]+)"/g;
let match;
const missing = [];

while ((match = onclickRegex.exec(html)) !== null) {
  const handler = match[1];
  const fnName = handler.split('(')[0].trim();
  if (!js.includes(fnName)) {
    missing.push({ fnName, handler });
  }
}

console.log('=== MISSING JS FUNCTIONS ===');
console.log(missing);

// 2. Find all element IDs referenced in JS
const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
const missingIds = [];
while ((match = idRegex.exec(js)) !== null) {
  const id = match[1];
  if (!html.includes(`id="${id}"`) && !html.includes(`id='${id}'`)) {
    missingIds.push(id);
  }
}

console.log('=== MISSING HTML IDs IN JS ===');
console.log([...new Set(missingIds)]);
