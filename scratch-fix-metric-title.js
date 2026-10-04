const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');

css = css.replace(
  `.metric-title {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}`,
  `.metric-title {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 500;
}`
);

fs.writeFileSync('frontend/src/styles.css', css);
console.log("Metric title uppercase removed");
