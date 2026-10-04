const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8');

const newUsers = `<div className="action-icon" style={{background: "linear-gradient(135deg, #10b981, #34d399)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          </div>`;

const newPre = `<div className="action-icon" style={{background: "linear-gradient(135deg, #f59e0b, #fbbf24)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>`;

const newChart = `<div className="action-icon" style={{background: "linear-gradient(135deg, #3b82f6, #60a5fa)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          </div>`;

const newShield = `<div className="action-icon" style={{background: "linear-gradient(135deg, #ef4444, #f87171)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          </div>`;

const newRes = `<div className="action-icon" style={{background: "linear-gradient(135deg, #8b5cf6, #a78bfa)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>`;

code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #10b981, #34d399\)"\}\}>.*?<\/div>/s, newUsers);
code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #f59e0b, #fbbf24\)"\}\}>.*?<\/div>/s, newPre);
code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #3b82f6, #60a5fa\)"\}\}>.*?<\/div>/s, newChart);
code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #ef4444, #f87171\)"\}\}>.*?<\/div>/s, newShield);
code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #8b5cf6, #a78bfa\)"\}\}>.*?<\/div>/s, newRes);

fs.writeFileSync('frontend/src/pages/TrainerDashboard.jsx', code);
console.log("Trainer icons fixed");
