const db = require('./db.js');
console.log(db.prepare("SELECT count(*) FROM registrations").get());
console.log(db.prepare("SELECT id, officer_name, district, cohort_id, roles FROM registrations WHERE officer_name LIKE '%Pius%'").all());
