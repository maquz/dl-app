const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

code = code.replace(/alert\("Native sharing is not[^"]+"\);?/g, '');
code = code.replace(/alert\("Your browser\/device blocked the native share window\. Downloading the file instead\."\);?/g, '');

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success removed alerts 2");
