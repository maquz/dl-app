const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8').split('\n');
const start = lines.findIndex((l, i) => i > 2500 && l.includes('itPersonsList.map'));
console.log(lines.slice(start - 20, start + 30).join('\n'));
