const db = require('./db.js');
const rows = db.prepare("SELECT id, officer_name, district, cohort_id, roles FROM registrations LIMIT 10").all();
console.log("Registrations:", rows);
