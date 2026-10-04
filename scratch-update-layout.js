const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');

// Fix hero shadow
css = css.replace('box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);', 'box-shadow: 0 4px 15px rgba(15, 23, 42, 0.2);');

// Fix metrics grid to match Image 2 (3 columns, tight gap)
css = css.replace(
  /\.glass-metrics-grid \{[\s\S]*?\}/,
  `.glass-metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  max-width: 1000px;
  margin: -3rem auto 2rem auto;
  padding: 0 1rem;
  position: relative;
  z-index: 10;
}`
);

// Fix metric card padding and font sizes to fit 3 in a row
css = css.replace(
  /\.glass-metric-card \{[\s\S]*?\}/,
  `.glass-metric-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  padding: 1rem 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
}`
);

css = css.replace(
  /\.metric-title \{[\s\S]*?\}/,
  `.metric-title {
  font-size: 0.7rem;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}`
);

css = css.replace(
  /\.metric-value \{[\s\S]*?\}/,
  `.metric-value {
  font-size: 1.1rem;
  color: #1e293b;
  font-weight: 800;
  line-height: 1.2;
}`
);

css = css.replace(
  /\.metric-sub \{[\s\S]*?\}/,
  `.metric-sub {
  font-size: 0.75rem;
  color: #8b5cf6;
  font-weight: 500;
}`
);

// Fix Actions Grid to force 2 columns on mobile if possible, but stack if really narrow, or just use 2 columns
css = css.replace(
  /\.glass-actions-grid \{[\s\S]*?\}/,
  `.glass-actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
  max-width: 1000px;
  margin: 0 auto 2rem auto;
  padding: 0 1rem;
}`
);

// Fix action card layout to be vertical like in the reference image
css = css.replace(
  /\.glass-action-card \{[\s\S]*?\}/,
  `.glass-action-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
}`
);

// Add custom SVG icon wrapper sizes
css = css.replace(
  /\.action-icon \{[\s\S]*?\}/,
  `.action-icon {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  color: white;
  margin-bottom: 0.25rem;
}`
);

fs.writeFileSync('frontend/src/styles.css', css);
console.log("CSS Layout Updated");
