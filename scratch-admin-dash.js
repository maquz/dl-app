const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const target = `{diagnosticData.participation.regions.map(r => (
                                        <td key={r} style={{ textAlign: "center", color: "#64748b" }}>{opt.regionBreakdown[r]}%</td>
                                      ))}`;

const replacement = `{diagnosticData.participation.regions.map(r => {
                                        const val = opt.regionBreakdown[r];
                                        return (
                                          <td key={r} style={{ textAlign: "center", color: "#64748b" }}>
                                            {val === "-" ? "-" : \`\${val}%\`}
                                          </td>
                                        );
                                      })}`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
  console.log("AdminDashboard updated.");
} else {
  console.log("Target not found.");
}
