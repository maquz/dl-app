const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const target = `                        title="Creates tracking rows for expected IT persons before they register"
                      >
                        ? Generate Trackers
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => handleExportDistributionWord(itPersonsList)} title="Download Distribution List (Word)">`;

const replace = `                        title="Creates tracking rows for expected IT persons before they register"
                      >
                        ? Generate Trackers
                      </button>
                    )}
                    {cohortFilter && (
                      <button 
                        className="btn-secondary" 
                        onClick={async () => {
                          try {
                            const res = await fetch("/api/registrations/stub/cleanup", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "x-admin-password": password }
                            });
                            const data = await res.json();
                            if (res.ok) {
                              if (data.deleted > 0) alert(\`Cleaned up \${data.deleted} duplicated tracking rows!\`);
                              else alert("No duplicates found!");
                              loadRegistrations(false);
                            }
                          } catch (err) {}
                        }}
                        title="Clean up duplicate tracking rows"
                      >
                        ?? Cleanup Duplicates
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => handleExportDistributionWord(itPersonsList)} title="Download Distribution List (Word)">`;

if (code.includes(target)) {
  code = code.replace(target, replace);
  console.log("REPLACED CLEANUP BUTTON 2");
} else {
  console.log("NOT FOUND CLEANUP BUTTON 2");
}

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
