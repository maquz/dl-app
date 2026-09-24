const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `    const districts = db.prepare("SELECT region, district FROM cohort_districts WHERE cohort_id = ?").all(cohortId);
    if (!districts || districts.length === 0) {
      return res.status(404).json({ error: "No districts found for this cohort." });
    }`;

const replacement = `    let districts = [];
    try {
      const cohortDistrictsMap = require("../data/cohort_districts.json");
      if (cohortDistrictsMap[cohortId] && cohortDistrictsMap[cohortId].districts) {
        districts = cohortDistrictsMap[cohortId].districts;
      }
    } catch(e) {}
    
    if (districts.length === 0) {
      return res.status(404).json({ error: "No districts found for this cohort." });
    }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  console.log("Replaced!");
} else {
  console.log("NOT FOUND");
}

fs.writeFileSync('backend/routes/registrations.js', code);
