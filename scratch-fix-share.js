const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

// We'll just replace instances of `alert("PDF Error: " + (err.message || "Unknown error"));`
// with `console.warn("Share failed:", err); alert("Native sharing is not fully supported on your browser/device. The file has been downloaded instead.");`

code = code.replace(/alert\("PDF Error: " \+ \(err\.message \|\| "Unknown error"\)\);/g, `console.warn("Share failed:", err);\n    alert("Native sharing is not fully supported by your browser/device. The file has been downloaded instead.");`);

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success fixing share");
