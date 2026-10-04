const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('activeTab === "slip" &&'));
console.log(lines.slice(start, start + 50).join('\n'));
