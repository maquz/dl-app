const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const targetStr = `  // Late Arrival Check: If the assigned cohort is already in the past, push them to the current active cohort
  if (allocatedCohort) {
    const today = new Date().toISOString().split('T')[0];
    // If the cohort's departure date is strictly in the past
    if (allocatedCohort.departure_date_iso < today) {
      const allCohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
      // Find the cohort currently in session
      let activeCohort = allCohorts.find(c => today >= c.arrival_date_iso && today <= c.departure_date_iso);
      if (!activeCohort) {
        // If currently between cohorts, get the next upcoming one
        activeCohort = allCohorts.find(c => c.arrival_date_iso >= today);
      }
      if (activeCohort) {
        allocatedCohort = activeCohort;
      }
    }
  }`;

const replacementStr = `  // Hard Override for Cohort 6 registrations starting from 7/10/2026
  const submittedAtIso = new Date().toISOString();
  if (submittedAtIso >= "2026-10-07T00:00:00.000Z") {
    allocatedCohort = db.prepare("SELECT * FROM cohorts WHERE id = 6").get() || allocatedCohort;
  } else {
    // Late Arrival Check: If the assigned cohort is already in the past, push them to the current active cohort
    if (allocatedCohort) {
      const today = submittedAtIso.split('T')[0];
      // If the cohort's departure date is strictly in the past
      if (allocatedCohort.departure_date_iso < today) {
        const allCohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
        // Find the cohort currently in session
        let activeCohort = allCohorts.find(c => today >= c.arrival_date_iso && today <= c.departure_date_iso);
        if (!activeCohort) {
          // If currently between cohorts, get the next upcoming one
          activeCohort = allCohorts.find(c => c.arrival_date_iso >= today);
        }
        if (activeCohort) {
          allocatedCohort = activeCohort;
        }
      }
    }
  }`;

if (code.includes('allocatedCohort.departure_date_iso < today')) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('backend/routes/registrations.js', code);
  console.log("Registration override for Cohort 6 applied.");
} else {
  console.log("Could not find Late Arrival Check logic to replace.");
}
