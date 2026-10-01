const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8').split('\n');
const start = lines.findIndex((l, i) => i > 2500 && l.includes('activeTab === "distribution"'));
console.log(lines.slice(start, start + 50).join('\n'));
