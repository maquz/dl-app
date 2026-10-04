const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');

css = css.replace(
  `grid-template-columns: repeat(2, 1fr);`,
  `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));`
);

fs.writeFileSync('frontend/src/styles.css', css);
console.log("Grid updated to auto-fit");
