const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

code = code.replace(
  /\{diagnosticData\.participation\.regions\.map\(r => \([\s\S]*?<td key=\{r\} style=\{\{ textAlign: "center", color: "#64748b" \}\}>\{opt\.regionBreakdown\[r\]\}%<\/td>[\s\S]*?\)\)\}/,
  `{diagnosticData.participation.regions.map(r => {
                                        const val = opt.regionBreakdown[r];
                                        return (
                                          <td key={r} style={{ textAlign: "center", color: "#64748b" }}>
                                            {val === "-" ? "-" : \`\${val}%\`}
                                          </td>
                                        );
                                      })}`
);

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("AdminDashboard updated.");
