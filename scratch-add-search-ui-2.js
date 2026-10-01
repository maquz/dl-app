const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const targetStr = `                  </div>
                </div>
                
                <div className="table-wrap">`;

const replaceStr = `                  </div>
                </div>
                
                <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <input
                    type="search"
                    placeholder="Search IT Persons by name, district, phone, or IMEI..."
                    value={itQuery}
                    onChange={(e) => {
                      setItQuery(e.target.value);
                      setItPage(1); // reset to page 1 on search
                    }}
                    className="search-input"
                    style={{ maxWidth: "400px", width: "100%" }}
                  />
                </div>
                
                <div className="table-wrap">`;

// Note: there might be multiple occurrences of this targetStr if I'm not careful. Let's make it more specific.
const specificTarget = `                    <button className="btn-secondary" onClick={() => handleExportDistributionExcel(itPersonsList)} title="Download Distribution List (Excel)">
                      ?? Export Excel
                    </button>
                  </div>
                </div>
                
                <div className="table-wrap">`;

const specificReplace = `                    <button className="btn-secondary" onClick={() => handleExportDistributionExcel(itPersonsList)} title="Download Distribution List (Excel)">
                      ?? Export Excel
                    </button>
                  </div>
                </div>
                
                <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <input
                    type="search"
                    placeholder="Search IT Persons by name, district, phone, or IMEI..."
                    value={itQuery}
                    onChange={(e) => {
                      setItQuery(e.target.value);
                      setItPage(1); // reset to page 1 on search
                    }}
                    className="search-input"
                    style={{ maxWidth: "400px", width: "100%" }}
                  />
                </div>
                
                <div className="table-wrap">`;

code = code.replace(specificTarget, specificReplace);
fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success replacing UI 2");
