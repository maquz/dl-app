const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

// We need to replace from `<div className="glass-dashboard-hero no-print">` 
// to `      <main className="glass-main-panel">`

const startIdx = code.indexOf('<div className="glass-dashboard-hero no-print">');
const endIdx = code.indexOf('<main className="glass-main-panel">');

if (startIdx > -1 && endIdx > -1) {
  const newHeader = `<div className="glass-dashboard-hero no-print">
        <div className="hero-content">
          <div className="hero-avatar" style={{ flexShrink: 0 }}>{initials}</div>
          <div className="hero-text">
            <h1 className="hero-greeting" style={{ marginBottom: "0.25rem" }}>Welcome back<br/><strong>{officerName}</strong></h1>
            <div className="hero-nominee-details" style={{ fontSize: "0.8rem", color: "#cbd5e1", lineHeight: "1.4" }}>
              <div style={{ marginBottom: "2px" }}><strong>Cohort:</strong> {nominee?.cohortName || (nominee?.cohortId ? \`Cohort \${nominee.cohortId}\` : "Cohort 1")}</div>
              <div style={{ marginBottom: "2px" }}><strong>District:</strong> {nominee?.district || "National"}</div>
              <div style={{ marginBottom: "2px" }}><strong>Role:</strong> Nominated District Trainer</div>
            </div>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="hero-badge"
              style={{ background: "rgba(255, 255, 255, 0.2)", color: "white", border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer" }}
              onClick={handleSignOut}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: "4px"}}>
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
        <div className={\`glass-metric-card \${activeTab === "pre-test" ? "active" : ""}\`} onClick={() => setActiveTab("pre-test")} style={{ cursor: "pointer", border: activeTab === "pre-test" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.8)", alignItems: "center", textAlign: "center", padding: "1.25rem 0.5rem" }}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #f59e0b, #fbbf24)", width: "48px", height: "48px", borderRadius: "14px", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: "white"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </div>
          <div className="metric-title" style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.85rem", textTransform: "none", letterSpacing: "normal" }}>Pre-Training</div>
          <div className="metric-sub" style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "2px" }}>Diagnostic</div>
        </div>

        <div className={\`glass-metric-card \${activeTab === "post-test" ? "active" : ""}\`} onClick={() => setActiveTab("post-test")} style={{ cursor: "pointer", border: activeTab === "post-test" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.8)", alignItems: "center", textAlign: "center", padding: "1.25rem 0.5rem" }}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #3b82f6, #60a5fa)", width: "48px", height: "48px", borderRadius: "14px", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: "white"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"></path><path d="M6 12v5c3 3 9 3 12 0v-5"></path></svg>
          </div>
          <div className="metric-title" style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.85rem", textTransform: "none", letterSpacing: "normal" }}>Post-Training</div>
          <div className="metric-sub" style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "2px" }}>Evaluation</div>
        </div>

        <div className={\`glass-metric-card \${activeTab === "slip" ? "active" : ""}\`} onClick={() => setActiveTab("slip")} style={{ cursor: "pointer", border: activeTab === "slip" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.8)", alignItems: "center", textAlign: "center", padding: "1.25rem 0.5rem" }}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #10b981, #34d399)", width: "48px", height: "48px", borderRadius: "14px", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: "white"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div className="metric-title" style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.85rem", textTransform: "none", letterSpacing: "normal" }}>Nomination Slip</div>
          <div className="metric-sub" style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "2px" }}>Registration</div>
        </div>

        <div className={\`glass-metric-card \${activeTab === "resources" ? "active" : ""}\`} onClick={() => setActiveTab("resources")} style={{ cursor: "pointer", border: activeTab === "resources" ? "2px solid #3b82f6" : "1px solid rgba(255, 255, 255, 0.8)", alignItems: "center", textAlign: "center", padding: "1.25rem 0.5rem" }}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #8b5cf6, #a78bfa)", width: "48px", height: "48px", borderRadius: "14px", marginBottom: "0.5rem", display: "flex", alignItems: "center", justifyContent: "center", color: "white"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
          </div>
          <div className="metric-title" style={{ color: "#1e293b", fontWeight: "700", fontSize: "0.85rem", textTransform: "none", letterSpacing: "normal" }}>Resources</div>
          <div className="metric-sub" style={{ color: "#64748b", fontSize: "0.7rem", marginTop: "2px" }}>Documents</div>
        </div>
      </div>

      <div className="glass-actions-label no-print" style={{ textAlign: "center", marginTop: "1rem", marginBottom: "1.5rem" }}>
        Portal Forms & Assessments
      </div>

      `;
  
  code = code.substring(0, startIdx) + newHeader + code.substring(endIdx);
  fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code);
  console.log("Confirmation.jsx refactored successfully.");
} else {
  console.log("Could not find replacement boundaries in Confirmation.jsx.");
}
