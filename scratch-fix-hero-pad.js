const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');
css = css.replace('padding: 3rem 1.5rem 5rem 1.5rem;', 'padding: 2.5rem 1.5rem 4.5rem 1.5rem;');
fs.writeFileSync('frontend/src/styles.css', css);
console.log("Hero padding fixed");
