const fs = require('fs');
let lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');

const startIdx = lines.findIndex(l => l.includes('<div className="page-wide">'));
const oversightIdx = lines.findIndex(l => l.includes('{/* TAB 1: PARTICIPANT OVERSIGHT */}'));

if (startIdx > -1 && oversightIdx > -1) {
  const newHeader = `    <div className="glass-dashboard-wrapper">
      {successMsg && (
        <div className="banner banner-success" style={{ margin: "1rem auto", maxWidth: "1200px" }}>
          ? {successMsg}
        </div>
      )}
      {error && (
        <div className="banner banner-error" style={{ margin: "1rem auto", maxWidth: "1200px" }}>
          {error}
        </div>
      )}
      <div className="glass-dashboard-hero no-print">
        <div className="hero-content" style={{maxWidth: "1200px"}}>
          <div className="hero-avatar">{trainerProfile?.name?.[0] || "N"}</div>
          <div className="hero-text">
            <h1 className="hero-greeting">National Facilitator<br/><strong>{trainerProfile?.name || "Master Trainer"}</strong></h1>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="hero-badge"
              style={{ background: "rgba(255, 255, 255, 0.2)", color: "white", border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer", marginRight: "0.5rem" }}
              onClick={handleOpenEditProfile}
            >
              ?? Edit
            </button>
            <button
              type="button"
              className="hero-badge"
              style={{ background: "rgba(255, 255, 255, 0.2)", color: "white", border: "1px solid rgba(255,255,255,0.4)", cursor: "pointer" }}
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="glass-metrics-grid no-print" style={{maxWidth: "1200px"}}>
        <div className="glass-metric-card">
          <div className="metric-title">Role</div>
          <div className="metric-value" style={{fontSize: "1rem"}}>{trainerProfile?.scheduleRole || "Facilitator"}</div>
        </div>
        <div className="glass-metric-card">
          <div className="metric-title">Station</div>
          <div className="metric-value" style={{fontSize: "1rem"}}>{trainerProfile?.placeOfWork || "National"}</div>
          <div className="metric-sub">{trainerProfile?.contactNumber}</div>
        </div>
        <div className="glass-metric-card">
          <div className="metric-title">Status</div>
          <div className="metric-value" style={{color: "#1e293b", fontSize: "1rem"}}>Active</div>
          <div className="metric-sub">Command Center</div>
        </div>
      </div>

      <div className="glass-actions-label no-print" style={{maxWidth: "1200px"}}>Dashboard Views</div>
      <div className="glass-actions-grid no-print" style={{maxWidth: "1200px"}}>
        <div className={\`glass-action-card \${activeTab === "oversight" ? "active" : ""}\`} onClick={() => setActiveTab("oversight")}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #10b981, #34d399)"}}>??</div>
          <div className="action-details">
            <h3>Participant Oversight</h3>
            <p>Check-In ({participants.length})</p>
          </div>
        </div>
        
        <div className={\`glass-action-card \${activeTab === "assessments" ? "active" : ""}\`} onClick={() => { setActiveTab("assessments"); loadAssessmentsData(); }}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #f59e0b, #fbbf24)"}}>??</div>
          <div className="action-details">
            <h3>Assessments</h3>
            <p>Management ({assessmentsList.length})</p>
          </div>
        </div>

        <div className={\`glass-action-card \${activeTab === "analytics" ? "active" : ""}\`} onClick={() => { setActiveTab("analytics"); loadOverviewStats(); }}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #3b82f6, #60a5fa)"}}>??</div>
          <div className="action-details">
            <h3>Analytics</h3>
            <p>Learning Gains</p>
          </div>
        </div>

        <div className={\`glass-action-card \${activeTab === "team" ? "active" : ""}\`} onClick={() => setActiveTab("team")}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #ef4444, #f87171)"}}>???</div>
          <div className="action-details">
            <h3>Team Directory</h3>
            <p>Facilitators ({trainersList.length})</p>
          </div>
        </div>

        <div className={\`glass-action-card \${activeTab === "resources" ? "active" : ""}\`} onClick={() => setActiveTab("resources")}>
          <div className="action-icon" style={{background: "linear-gradient(135deg, #8b5cf6, #a78bfa)"}}>??</div>
          <div className="action-details">
            <h3>Resources</h3>
            <p>Files ({resources.length})</p>
          </div>
        </div>
      </div>

      <main className="glass-main-panel" style={{maxWidth: "1200px"}}>
        <div className="glass-content-card">
`;
  
  // Replace up to the TAB 1 marker
  lines.splice(startIdx, oversightIdx - startIdx, newHeader);
  
  fs.writeFileSync('frontend/src/pages/TrainerDashboard.jsx', lines.join('\n'));
  console.log("Success updating TrainerDashboard.jsx");
} else {
  console.log("Not found");
}
