const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');
const endLines = lines.slice(-200);
console.log(endLines.join('\n'));
