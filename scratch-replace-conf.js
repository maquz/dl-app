const fs = require('fs');
let lines = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('<div className="officer-portal-wrapper">'));
const mainIdx = lines.findIndex(l => l.includes('<main className="officer-main-panel">'));

if (startIdx > -1 && mainIdx > -1) {
  const newHeader = `    <div className="glass-dashboard-wrapper">
      <div className="glass-dashboard-hero no-print">
        <div className="hero-content">
          <div className="hero-avatar">{initials}</div>
          <div className="hero-text">
            <h1 className="hero-greeting">Welcome back<br/><strong>{officerName}</strong></h1>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="hero-badge"
              style={{ background: "rgba(255, 255, 255, 0.2)", color: "white", border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer" }}
              onClick={handleSignOut}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="glass-metrics-grid no-print">
        <div className="glass-metric-card">
          <div className="metric-title">Cohort</div>
          <div className="metric-value">{nominee?.cohortName || (nominee?.cohortId ? \`Cohort \${nominee.cohortId}\` : "Cohort 1")}</div>
          <div className="metric-sub">{nominee?.arrivalDate || "Arrival TBD"}</div>
        </div>
        <div className="glass-metric-card">
          <div className="metric-title">District</div>
          <div className="metric-value">{nominee?.district || "National"}</div>
          <div className="metric-sub">{nominee?.region || "GES"}</div>
        </div>
        <div className="glass-metric-card">
          <div className="metric-title">Role</div>
          <div className="metric-value" style={{color: "#1e293b", fontSize: "1rem"}}>Nominated</div>
          <div className="metric-sub">District Trainer</div>
        </div>
      </div>

      <div className="glass-actions-label no-print">Dashboard Actions</div>
      <div className="glass-actions-grid no-print">
        <div className={\`glass-action-card \${activeTab === "pre-test" ? "active" : ""}\`} onClick={() => setActiveTab("pre-test")}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #f59e0b, #fbbf24)"}}>??</div>
          <div className="action-details">
            <h3>Pre-Training</h3>
            <p>{isPreLocked ? "Locked until 7:00 PM" : "Diagnostic Evaluation"}</p>
          </div>
        </div>
        
        <div className={\`glass-action-card \${activeTab === "post-test" ? "active" : ""}\`} onClick={() => setActiveTab("post-test")}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #3b82f6, #60a5fa)"}}>??</div>
          <div className="action-details">
            <h3>Post-Training</h3>
            <p>{isPostLocked ? "Locked until workshop end" : "Workshop Evaluation"}</p>
          </div>
        </div>

        <div className={\`glass-action-card \${activeTab === "slip" ? "active" : ""}\`} onClick={() => setActiveTab("slip")}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #10b981, #34d399)"}}>??</div>
          <div className="action-details">
            <h3>Nomination Slip</h3>
            <p>Official Registration</p>
          </div>
        </div>

        <div className={\`glass-action-card \${activeTab === "resources" ? "active" : ""}\`} onClick={() => setActiveTab("resources")}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #8b5cf6, #a78bfa)"}}>??</div>
          <div className="action-details">
            <h3>Resources</h3>
            <p>PDFs & Documents</p>
          </div>
        </div>
      </div>

      <main className="glass-main-panel">
        <div className="glass-content-card">`;
  
  lines.splice(startIdx, mainIdx - startIdx + 1, newHeader);
  
  // Now find the closing tags
  const closingMainIdx = lines.findIndex(l => l.includes('</main>'));
  if (closingMainIdx > -1) {
    const endStr = `        </div>
      </main>
    </div>`;
    // Original had `</main>` and `</div>` on next line
    lines.splice(closingMainIdx, 2, endStr);
  }
  
  fs.writeFileSync('frontend/src/pages/Confirmation.jsx', lines.join('\n'));
  console.log("Success updating Confirmation.jsx");
} else {
  console.log("Not found");
}
