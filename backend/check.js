const db = require('./db.js');
const rows = db.prepare("SELECT id, officer_name, district, cohort_id, roles FROM registrations WHERE roles LIKE '%IT Person%' AND officer_name = 'Pending Registration'").all();
console.log("Pending Trackers:", rows);

const real = db.prepare("SELECT id, officer_name, district, cohort_id, roles FROM registrations WHERE roles LIKE '%IT Person%' AND officer_name != 'Pending Registration'").all();
console.log("Real IT Persons:", real.filter(r => r.district === 'Akuapem North' || r.district === 'Kwahu East'));
