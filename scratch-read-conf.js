const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('<div className="officer-portal-wrapper">'));
console.log("Start line:", start);
