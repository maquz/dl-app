const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const replacementJSX = `            </div>
            <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              <div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontWeight: "bold", color: "var(--navy-900)" }}>
                  Total Districts: {cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.districtBreakdown?.length || 0}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button className="btn-secondary" onClick={() => handleExportDistrictBreakdown('print')} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"></path></svg>
                    Print
                  </button>
                  <button className="btn-secondary" onClick={() => handleExportDistrictBreakdown('excel')} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Excel
                  </button>
                  <button className="btn-secondary" onClick={() => handleExportDistrictBreakdown('word')} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Word
                  </button>
                  <button className="btn-primary" onClick={() => handleExportDistrictBreakdown('share')} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    Share
                  </button>
                </div>
              </div>`;

const searchJSX = code.substring(code.indexOf('</div>\n            <div className="modal-body"'), code.indexOf('              <table className="admin-table">'));

code = code.replace(searchJSX, replacementJSX + '\n');
fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success with node replace!");
