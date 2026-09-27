const fs = require('fs');
let code = fs.readFileSync('frontend/src/styles.css', 'utf8');

code = code.replace(/padding: 3rem 2rem 1.5rem;/g, 'padding: 1.5rem 1rem 1rem;');
code = code.replace(/gap: 3rem;/g, 'gap: 1.5rem;');
code = code.replace(/width: 48px;\r?\n\s*height: 48px;/g, 'width: 36px;\n  height: 36px;');
code = code.replace(/font-size: 1\.15rem;/g, 'font-size: 1.05rem;');
code = code.replace(/margin-bottom: 1\.5rem;/g, 'margin-bottom: 0.75rem;');
code = code.replace(/font-size: 1rem;\r?\n\s*font-weight: 700;\r?\n\s*color: #ffffff;\r?\n\s*margin-bottom: 1\.5rem;/g, 'font-size: 0.95rem;\n  font-weight: 700;\n  color: #ffffff;\n  margin-bottom: 0.75rem;');
code = code.replace(/margin: 3rem auto 0;\r?\n\s*padding-top: 1\.5rem;/g, 'margin: 1.5rem auto 0;\n  padding-top: 1rem;');

fs.writeFileSync('frontend/src/styles.css', code);
console.log("Updated styles.css for footer!");
