const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

const oldPre = '<div className="action-icon" style={{background: "linear-gradient(135deg, #f59e0b, #fbbf24)"}}>??</div>';
const newPre = `<div className="action-icon" style={{background: "linear-gradient(135deg, #f59e0b, #fbbf24)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>`;

const oldPost = '<div className="action-icon" style={{background: "linear-gradient(135deg, #3b82f6, #60a5fa)"}}>??</div>';
const newPost = `<div className="action-icon" style={{background: "linear-gradient(135deg, #3b82f6, #60a5fa)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
          </div>`;

const oldSlip = '<div className="action-icon" style={{background: "linear-gradient(135deg, #10b981, #34d399)"}}>??</div>';
const newSlip = `<div className="action-icon" style={{background: "linear-gradient(135deg, #10b981, #34d399)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>`;

const oldRes = '<div className="action-icon" style={{background: "linear-gradient(135deg, #8b5cf6, #a78bfa)"}}>??</div>';
const newRes = `<div className="action-icon" style={{background: "linear-gradient(135deg, #8b5cf6, #a78bfa)"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>`;

// Use simple replacement for emojis (since file might have saved weirdly, fallback to replace text entirely)
// Actually, I can just replace the block because it might contain broken encoding characters instead of the emoji.
// The easiest way is to use regex targeting the style backgrounds.

code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #f59e0b, #fbbf24\)"\}\}>.*?<\/div>/s, newPre);
code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #3b82f6, #60a5fa\)"\}\}>.*?<\/div>/s, newPost);
code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #10b981, #34d399\)"\}\}>.*?<\/div>/s, newSlip);
code = code.replace(/<div className="action-icon" style=\{\{background: "linear-gradient\(135deg, #8b5cf6, #a78bfa\)"\}\}>.*?<\/div>/s, newRes);

fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code);
console.log("Confirmation icons fixed");
