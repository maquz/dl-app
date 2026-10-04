const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8').split('\n');
const end = lines.findIndex((l, i) => i > 129 && l.includes('</main>'));
console.log("End line:", end);
