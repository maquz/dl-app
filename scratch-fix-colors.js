const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');
css = css.replace('background: linear-gradient(135deg, #10b981 0%, #059669 100%); /* Greenish gradient matching image */', 'background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);');
fs.writeFileSync('frontend/src/styles.css', css);
console.log("Colors fixed");
