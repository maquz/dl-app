const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');
console.log("Includes Search IT Persons:", code.includes("Search IT Persons"));
