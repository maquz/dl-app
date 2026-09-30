const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

code = code.replace(/if \(err\.name === "AbortError"\) return;/g, `if (err.name === "AbortError") return;\n      alert("Native sharing is not fully supported by your browser/device. The file has been downloaded instead.");`);

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success fixing share 2");
