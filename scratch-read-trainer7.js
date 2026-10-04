const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('/* Build Assessment Modal */'));
console.log(lines.slice(start - 20, start + 5).join('\n'));
