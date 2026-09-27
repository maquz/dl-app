const fs = require('fs');
let code = fs.readFileSync('frontend/src/styles.css', 'utf8');

code = code.replace(/html,\r?\nbody \{\r?\n\s*margin: 0;\r?\n\s*padding: 0;\r?\n\s*overflow-x: hidden;\r?\n\s*width: 100%;\r?\n\}/g, 
`html,
body {
  margin: 0;
  padding: 0;
  overflow-x: clip;
  width: 100%;
}`);

fs.writeFileSync('frontend/src/styles.css', code);
console.log("Replaced HTML body css!");
