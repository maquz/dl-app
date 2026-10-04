const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');
console.log(lines.slice(820).join('\n'));
