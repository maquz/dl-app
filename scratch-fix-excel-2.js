const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

code = code.replace("  }.xlsx`);\r\n  }\r\n", "  }\r\n");
fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success");
