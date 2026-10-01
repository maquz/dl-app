const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const targetSupa = `        const { data: stubData } = await supabase.from("registrations").select("id").eq("district", district.trim()).eq("cohort_id", assignedCohortId).eq("officer_name", "Pending Registration");`;
const replaceSupa = `        const { data: stubData } = await supabase.from("registrations").select("id").eq("district", district.trim()).eq("officer_name", "Pending Registration");`;

const targetLocal = `      const stub = db.prepare("SELECT id FROM registrations WHERE district = ? AND cohort_id = ? AND officer_name = 'Pending Registration'").get(district.trim(), assignedCohortId);`;
const replaceLocal = `      const stub = db.prepare("SELECT id FROM registrations WHERE district = ? AND officer_name = 'Pending Registration'").get(district.trim());`;

if (code.includes(targetSupa) && code.includes(targetLocal)) {
  code = code.replace(targetSupa, replaceSupa).replace(targetLocal, replaceLocal);
  fs.writeFileSync('backend/routes/registrations.js', code);
  console.log("Success relaxing registration stub merge");
} else {
  console.log("Not found");
}
