const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

code = code.replace(/alert\("Native sharing is not fully supported by your browser\/device\. The file has been downloaded instead\."\);/g, '');

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success removed alerts");
