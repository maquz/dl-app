const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('<div className="officer-portal-wrapper">'));
const end = lines.findIndex((l, i) => i > start && l.includes('</main>')) + 2;
console.log(lines.slice(start, start + 30).join('\n'));
