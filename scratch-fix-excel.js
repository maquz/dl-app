const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const target = `    XLSX.writeFile(wb, "Tablet_Distribution_List.xlsx");
  }.xlsx\`);
  }`;
const replacement = `    XLSX.writeFile(wb, "Tablet_Distribution_List.xlsx");
  }`;

if (code.includes(target)) {
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code.replace(target, replacement));
  console.log("Success");
} else {
  console.log("Not found, let's look for the real string...");
  const snippet = code.substring(code.indexOf('XLSX.writeFile(wb'), code.indexOf('XLSX.writeFile(wb') + 150);
  console.log("Snippet:", snippet);
}
