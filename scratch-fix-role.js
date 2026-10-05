const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

// The line currently says:
// <div style={{ marginBottom: "2px" }}><strong>Role:</strong> Nominated District Trainer</div>

code = code.replace(
  /<div style=\{\{ marginBottom: "2px" \}\}><strong>Role:<\/strong> Nominated District Trainer<\/div>/,
  `<div style={{ marginBottom: "2px" }}><strong>Role:</strong> {Array.isArray(nominee?.roles) && nominee.roles.length > 0 ? nominee.roles.join(", ") : "Nominated Trainer"}</div>`
);

fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code);
console.log("Confirmation.jsx role updated.");
