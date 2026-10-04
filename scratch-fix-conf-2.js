const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

// 1. Fix the broken useState return
const brokenUseState = `  const [nominee, setNominee] = useState(() => {
    const handleTabClick = (tab) => {
    setActiveTab(tab);
    setTimeout(() => {
      document.getElementById('action-content-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (
      location.state?.nominee ||
      JSON.parse(sessionStorage.getItem("recent_nominee") || localStorage.getItem("officer_profile") || "null")
    );
  });`;

const fixedUseState = `  const [nominee, setNominee] = useState(() => {
    return (
      location.state?.nominee ||
      JSON.parse(sessionStorage.getItem("recent_nominee") || localStorage.getItem("officer_profile") || "null")
    );
  });`;

code = code.replace(brokenUseState, fixedUseState);

// 2. Insert handleTabClick before the main return
const mainReturnRegex = /\s*return \(\s*<div className="glass-dashboard-wrapper">/m;
const handleTabClickCode = `
  const handleTabClick = (tab) => {
    setActiveTab(tab);
    setTimeout(() => {
      document.getElementById('action-content-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

`;

code = code.replace(mainReturnRegex, (match) => handleTabClickCode + match);

// 3. Remove the Sign Out button from the hero, and adjust the layout back to 'old style' but neater
const heroContentOld = `<div className="hero-content">
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
        </div>`;

const heroContentNew = `<div className="hero-content" style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div className="hero-avatar" style={{ flexShrink: 0, width: "60px", height: "60px", fontSize: "1.5rem" }}>{initials}</div>
          <div className="hero-text" style={{ flex: 1, minWidth: 0 }}>
            <h1 className="hero-greeting" style={{ marginBottom: "0.25rem", lineHeight: "1.2" }}>
              <span style={{ fontSize: "1rem", color: "#94a3b8", display: "block" }}>Welcome back</span>
              <strong style={{ fontSize: "1.2rem", color: "white", fontWeight: "700", display: "block", overflowWrap: "break-word" }}>{officerName}</strong>
            </h1>
            <div className="hero-nominee-details" style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: "1.4", marginTop: "0.5rem" }}>
              <div style={{ marginBottom: "2px" }}><strong>Cohort:</strong> {nominee?.cohortName || (nominee?.cohortId ? \`Cohort \${nominee.cohortId}\` : "Cohort 1")}</div>
              <div style={{ marginBottom: "2px" }}><strong>District:</strong> {nominee?.district || "National"}</div>
              <div style={{ marginBottom: "2px" }}><strong>Role:</strong> Nominated District Trainer</div>
            </div>
          </div>
        </div>`;

code = code.replace(heroContentOld, heroContentNew);

fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code);
console.log("Confirmation.jsx fully repaired and updated.");
