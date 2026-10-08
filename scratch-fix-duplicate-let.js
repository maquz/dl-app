const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

code = code.replace(
  `  const assignedCohortId = allocatedCohort ? allocatedCohort.id : null;
  const arrivalDate = allocatedCohort ? allocatedCohort.arrival_date : null;

  const submittedAtIso = new Date().toISOString();`,
  `  const assignedCohortId = allocatedCohort ? allocatedCohort.id : null;
  const arrivalDate = allocatedCohort ? allocatedCohort.arrival_date : null;
`
);

fs.writeFileSync('backend/routes/registrations.js', code);
console.log("Duplicate submittedAtIso fixed.");
