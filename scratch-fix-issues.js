const fs = require('fs');

// 1. Fix styles.css (Name wrapping, Slip Mobile layout)
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');

css = css.replace(
  /\.hero-greeting strong \{[\s\S]*?\}/,
  `.hero-greeting strong {
  font-size: 1.35rem;
  font-weight: 800;
  opacity: 1;
  display: block;
  white-space: normal;
  overflow: visible;
  line-height: 1.25;
}`
);

// Add mobile styles for the slip if not present
if (!css.includes('.slip-brand-mobile')) {
  css += `\n
@media (max-width: 600px) {
  .slip-brand {
    flex-direction: column;
    text-align: center;
  }
  .slip-ref-box {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }
  .nomination-slip {
    padding: 1rem;
  }
}
`;
}
fs.writeFileSync('frontend/src/styles.css', css);
console.log("styles.css updated.");


// 2. Fix Confirmation.jsx (Auto-scroll & Resources wrap)
let conf = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

// Inject handleTabClick before return
if (!conf.includes('const handleTabClick =')) {
  conf = conf.replace(
    'return (',
    `const handleTabClick = (tab) => {
    setActiveTab(tab);
    setTimeout(() => {
      document.getElementById('action-content-area')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  return (`
  );
  
  // Replace setActiveTab calls with handleTabClick in the glass-metrics-grid
  conf = conf.replace(/onClick=\{\(\) => setActiveTab\("pre-test"\)\}/g, `onClick={() => handleTabClick("pre-test")}`);
  conf = conf.replace(/onClick=\{\(\) => setActiveTab\("post-test"\)\}/g, `onClick={() => handleTabClick("post-test")}`);
  conf = conf.replace(/onClick=\{\(\) => setActiveTab\("slip"\)\}/g, `onClick={() => handleTabClick("slip")}`);
  conf = conf.replace(/onClick=\{\(\) => setActiveTab\("resources"\)\}/g, `onClick={() => handleTabClick("resources")}`);
}

// Add the anchor ID right above the view-panel conditional renders
conf = conf.replace(
  `<div className="glass-actions-label no-print" style={{ textAlign: "center", marginTop: "1rem", marginBottom: "1.5rem" }}>
        Portal Forms & Assessments
      </div>`,
  `<div id="action-content-area" className="glass-actions-label no-print" style={{ textAlign: "center", marginTop: "1rem", marginBottom: "1.5rem" }}>
        Portal Forms & Assessments
      </div>`
);

// Fix Resources flex overlap
conf = conf.replace(
  /<div key=\{file\.id\} style=\{\{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1\.25rem", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#fff", boxShadow: "0 1px 3px rgba\(0,0,0,0\.05\)" \}\}>/g,
  `<div key={file.id} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem", padding: "1rem", border: "1px solid #e2e8f0", borderRadius: "12px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>`
);

conf = conf.replace(
  /<div style=\{\{ display: "flex", alignItems: "center", gap: "1rem" \}\}>/g,
  `<div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: "1 1 200px", minWidth: 0 }}>`
);

conf = conf.replace(
  /<span style=\{\{ fontSize: "2rem" \}\}>??<\/span>/g,
  `<span style={{ fontSize: "2rem", flexShrink: 0 }}>??</span>`
);

conf = conf.replace(
  /<div>\s*<strong style=\{\{ fontSize: "1\.1rem", color: "#1e293b", display: "block", marginBottom: "0\.25rem" \}\}>/g,
  `<div style={{ minWidth: 0 }}>\n                                <strong style={{ fontSize: "1rem", color: "#1e293b", display: "block", marginBottom: "0.25rem", wordBreak: "break-word" }}>`
);

conf = conf.replace(
  /className="btn-primary" style=\{\{ padding: "0\.5rem 1rem", textDecoration: "none" \}\}/g,
  `className="btn-primary" style={{ padding: "0.5rem 1rem", textDecoration: "none", flexShrink: 0, textAlign: "center", minWidth: "100px" }}`
);

fs.writeFileSync('frontend/src/pages/Confirmation.jsx', conf);
console.log("Confirmation.jsx updated.");

