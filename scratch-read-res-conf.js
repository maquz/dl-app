const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('activeTab === "resources" &&'));
console.log(lines.slice(start, start + 40).join('\n'));
