const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('/* TAB '));
console.log(lines.slice(start, start + 30).join('\n'));
