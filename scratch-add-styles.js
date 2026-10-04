const fs = require('fs');
let css = fs.readFileSync('frontend/src/styles.css', 'utf8');

const newStyles = `
/* --- GLASS UI REDESIGN --- */
.glass-dashboard-wrapper {
  background-color: #f4f9f7; /* soft light greenish/gray tint */
  min-height: 100vh;
  padding-bottom: 4rem;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.glass-dashboard-hero {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%); /* Greenish gradient matching image */
  color: white;
  padding: 3rem 1.5rem 5rem 1.5rem;
  border-bottom-left-radius: 32px;
  border-bottom-right-radius: 32px;
  position: relative;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
}

.hero-content {
  max-width: 1000px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.hero-avatar {
  width: 60px;
  height: 60px;
  background: rgba(255, 255, 255, 0.2);
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: white;
  backdrop-filter: blur(8px);
}

.hero-text {
  flex: 1;
}

.hero-greeting {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 400;
  opacity: 0.9;
  line-height: 1.3;
}

.hero-greeting strong {
  font-size: 1.6rem;
  font-weight: 700;
  opacity: 1;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-actions {
  display: flex;
  align-items: flex-start;
}

.hero-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.4rem 0.8rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  gap: 6px;
}

.glass-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 1rem;
  max-width: 1000px;
  margin: -3rem auto 2rem auto;
  padding: 0 1.5rem;
  position: relative;
  z-index: 10;
}

.glass-metric-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  padding: 1.25rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
}

.metric-title {
  font-size: 0.8rem;
  color: #64748b;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.metric-value {
  font-size: 1.2rem;
  color: #1e293b;
  font-weight: 800;
}

.metric-sub {
  font-size: 0.8rem;
  color: #8b5cf6; /* purple matching design */
  font-weight: 500;
}

.glass-actions-label {
  max-width: 1000px;
  margin: 0 auto 1rem auto;
  padding: 0 1.5rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
}

.glass-actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  max-width: 1000px;
  margin: 0 auto 2rem auto;
  padding: 0 1.5rem;
}

.glass-action-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
  cursor: pointer;
  transition: all 0.2s ease;
}

.glass-action-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
}

.glass-action-card.active {
  border: 2px solid #10b981;
  background: #ffffff;
  box-shadow: 0 12px 30px rgba(16, 185, 129, 0.15);
}

.action-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  color: white;
}

.action-details h3 {
  margin: 0 0 0.2rem 0;
  font-size: 1rem;
  color: #1e293b;
  font-weight: 700;
}

.action-details p {
  margin: 0;
  font-size: 0.8rem;
  color: #64748b;
}

.glass-main-panel {
  max-width: 1000px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.glass-content-card {
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(12px);
  border-radius: 24px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.05);
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.8);
  min-height: 400px;
}
`;

if (!css.includes('.glass-dashboard-wrapper')) {
  fs.writeFileSync('frontend/src/styles.css', css + newStyles);
  console.log("Styles appended.");
} else {
  console.log("Styles already exist.");
}
