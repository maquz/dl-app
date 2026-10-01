const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const targetCleanup = `          const { data: realUsers } = await supabase.from("registrations").select("id, roles, tablet_imei, tablet_serial").eq("district", stub.district).eq("cohort_id", stub.cohort_id).neq("id", stub.id);`;

const replaceCleanup = `          // We remove cohort_id from the match condition because sometimes users register under the wrong cohort or it shifts.
          // Since there is only one IT person per district, district match is sufficient.
          const { data: realUsers } = await supabase.from("registrations").select("id, roles, tablet_imei, tablet_serial").eq("district", stub.district).neq("id", stub.id);`;

if (code.includes(targetCleanup)) {
  code = code.replace(targetCleanup, replaceCleanup);
  fs.writeFileSync('backend/routes/registrations.js', code);
  console.log("Success replacing cleanup");
} else {
  console.log("Cleanup target not found");
}
