const fs = require('fs');
let lines = fs.readFileSync('frontend/src/pages/TrainerDashboard.jsx', 'utf8').split('\n');
const subModalIdx = lines.findIndex(l => l.includes('{/* SUBMISSIONS MODAL */}'));

if (subModalIdx > -1) {
  lines.splice(subModalIdx, 0, '        </div>\n      </main>');
  fs.writeFileSync('frontend/src/pages/TrainerDashboard.jsx', lines.join('\n'));
  console.log("Success updating TrainerDashboard.jsx end");
} else {
  console.log("Not found");
}
