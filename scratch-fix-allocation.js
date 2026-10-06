const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const targetStr = `  // Determine cohort allocation based on official GES district schedule
  let allocatedCohort = null;
  if (cohortId) {
    allocatedCohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(cohortId);
  }
  if (!allocatedCohort) {
    allocatedCohort = findCohortForDistrict(region, district);
  }
  if (!allocatedCohort) {
    allocatedCohort = await findNextAvailableCohort();
  }`;

const replacementStr = `  // Determine cohort allocation based on official GES district schedule
  let allocatedCohort = null;
  if (cohortId) {
    allocatedCohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(cohortId);
  }
  if (!allocatedCohort) {
    allocatedCohort = findCohortForDistrict(region, district);
  }

  // Late Arrival Check: If the assigned cohort is already in the past, push them to the current active cohort
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
  }

  if (!allocatedCohort) {
    allocatedCohort = await findNextAvailableCohort();
  }`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('backend/routes/registrations.js', code);
  console.log("Registration cohort allocation logic updated successfully.");
} else {
  console.error("Target string not found in registrations.js. Maybe it was already modified?");
}
