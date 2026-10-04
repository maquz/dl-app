const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');
css = css.replace('border: 2px solid #10b981;', 'border: 2px solid #3b82f6;');
css = css.replace('box-shadow: 0 12px 30px rgba(16, 185, 129, 0.15);', 'box-shadow: 0 12px 30px rgba(59, 130, 246, 0.15);');
fs.writeFileSync('frontend/src/styles.css', css);
console.log("Active colors fixed");
