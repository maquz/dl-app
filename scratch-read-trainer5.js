const fs = require('fs');
const lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');
lines.forEach((l, i) => { if (l.includes('activeTab === "resources"')) console.log(i, l) });
