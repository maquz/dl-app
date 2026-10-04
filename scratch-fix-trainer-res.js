const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8');

if (code.includes('activeTab === "resources"')) {
  // Inject handleTabClick if needed? Or just let it be. 
  // Let's inject auto-scroll for Trainer too
  if (!code.includes('const handleTabClick =')) {
    code = code.replace(
      'return (',
      `const handleTabClick = (tab) => {
      setActiveTab(tab);
      setTimeout(() => {
        document.getElementById('action-content-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    };

    return (`
    );
    
    // Replace setActiveTab calls in metric cards
    code = code.replace(/onClick=\{\(\) => setActiveTab\("participants"\)\}/g, `onClick={() => handleTabClick("participants")}`);
    code = code.replace(/onClick=\{\(\) => setActiveTab\("assessments"\)\}/g, `onClick={() => handleTabClick("assessments")}`);
    code = code.replace(/onClick=\{\(\) => setActiveTab\("analytics"\)\}/g, `onClick={() => handleTabClick("analytics")}`);
    code = code.replace(/onClick=\{\(\) => setActiveTab\("team"\)\}/g, `onClick={() => handleTabClick("team")}`);
    code = code.replace(/onClick=\{\(\) => setActiveTab\("resources"\)\}/g, `onClick={() => handleTabClick("resources")}`);
    
    // Add ID to actions label or main area
    code = code.replace(
      `<div className="glass-actions-label no-print"`,
      `<div id="action-content-area" className="glass-actions-label no-print"`
    );
  }

  // Fix Resources layout
  code = code.replace(
    /<div key=\{file\.id\} style=\{\{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1\.25rem", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#fff", boxShadow: "0 1px 3px rgba\(0,0,0,0\.05\)" \}\}>/g,
    `<div key={file.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>`
  );

  code = code.replace(
    /<div style=\{\{ display: "flex", alignItems: "center", gap: "1rem" \}\}>/g,
    `<div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "1 1 200px", minWidth: 0 }}>`
  );

  code = code.replace(
    /<div>\s*<strong style=\{\{ fontSize: "1\.1rem", color: "#1e293b", display: "block", marginBottom: "0\.25rem" \}\}>/g,
    `<div style={{ minWidth: 0 }}>\n                                <strong style={{ fontSize: "1rem", color: "#1e293b", display: "block", marginBottom: "0.25rem", wordBreak: "break-word" }}>`
  );

  code = code.replace(
    /className="btn-primary" style=\{\{ padding: "0\.5rem 1rem", textDecoration: "none" \}\}/g,
    `className="btn-primary" style={{ padding: "0.5rem 1rem", textDecoration: "none", flexShrink: 0, textAlign: "center", minWidth: "100px" }}`
  );
  
  fs.writeFileSync('frontend/src/pages/TrainerDashboard.jsx', code);
  console.log("TrainerDashboard.jsx updated.");
} else {
  console.log("No resources in TrainerDashboard.jsx");
}
