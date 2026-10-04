const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');

css = css.replace(
  `.glass-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  max-width: 1000px;
  margin: -3rem auto 2rem auto;
  padding: 0 1rem;
  position: relative;
  z-index: 10;
}`,
  `.glass-metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  max-width: 1000px;
  margin: -3.5rem auto 2rem auto;
  padding: 0 1.25rem;
  position: relative;
  z-index: 10;
}`
);

fs.writeFileSync('frontend/src/styles.css', css);
console.log("Grid updated to 2 columns");
