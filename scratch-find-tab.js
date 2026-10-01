const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('activeTab === "distribution"'));
console.log(lines.slice(start - 5, start + 30).join('\n'));
