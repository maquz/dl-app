const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const targetStr = `{diagnosticData.participation.regions.map(r => (
                                        <td key={r} style={{ textAlign: "center", color: "#64748b" }}>{opt.regionBreakdown[r]}%</td>
                                      ))}`;

const repStr = `{diagnosticData.participation.regions.map(r => (
                                        <td key={r} style={{ textAlign: "center", color: "#64748b" }}>
                                          {opt.regionBreakdown[r] === "-" ? "-" : \`\${opt.regionBreakdown[r]}%\`}
                                        </td>
                                      ))}`;

code = code.replace(targetStr, repStr);
fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Safe update done.");
