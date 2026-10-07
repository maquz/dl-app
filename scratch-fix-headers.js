const fs = require('fs');

function fixFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  let changed = false;

  const target1 = '<th style={{ backgroundColor: "#fff" }}>Option</th>';
  const target2 = '<th style={{ backgroundColor: "#fff", textAlign: "center" }}>Overall %</th>';
  const target3 = '<th key={r} style={{ backgroundColor: "#fff", textAlign: "center" }}>{r}</th>';

  if (code.includes(target1)) {
    code = code.replace(target1, '<th style={{ backgroundColor: "#f8fafc", color: "#475569" }}>Option</th>');
    changed = true;
  }
  if (code.includes(target2)) {
    code = code.replace(target2, '<th style={{ backgroundColor: "#f8fafc", color: "#475569", textAlign: "center" }}>Overall %</th>');
    changed = true;
  }
  if (code.includes(target3)) {
    code = code.replace(target3, '<th key={r} style={{ backgroundColor: "#f8fafc", color: "#475569", textAlign: "center" }}>{r}</th>');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, code);
    console.log(file + " updated.");
  }
}

fixFile('frontend/src/pages/AdminDashboard.jsx');
try { fixFile('frontend/src/pages/TrainerDashboard.jsx'); } catch(e){}

