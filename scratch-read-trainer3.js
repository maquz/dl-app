const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('/* TAB 5: RESOURCES */'));
console.log(lines.slice(start, start + 120).join('\n'));
