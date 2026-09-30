const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

code = code.replace(/}\n}\n$/, '}\n');

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Fixed bracket");
