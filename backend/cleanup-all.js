require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  let count = 0;
  // Get all stubs
  const { data: stubs } = await supabase.from("registrations").select("id, district, cohort_id, tablet_imei, tablet_serial").eq("officer_name", "Pending Registration").like("phone_number", "STUB-%");
  if (stubs) {
    for (const stub of stubs) {
      // Check if real IT person exists for this district
      const { data: realUsers } = await supabase.from("registrations").select("id, roles, tablet_imei, tablet_serial").eq("district", stub.district).eq("cohort_id", stub.cohort_id).neq("id", stub.id);
      if (realUsers && realUsers.length > 0) {
        const realItPerson = realUsers.find(r => {
          try {
            const rolesArr = typeof r.roles === 'string' ? JSON.parse(r.roles) : r.roles;
            return (rolesArr || []).some(role => String(role).toLowerCase().includes('it person'));
          } catch(e) { return false; }
        });
        if (realItPerson) {
          // Merge tablet data if stub has it and real user doesn't
          if ((stub.tablet_imei || stub.tablet_serial) && !realItPerson.tablet_imei) {
            await supabase.from("registrations").update({
              tablet_imei: stub.tablet_imei,
              tablet_serial: stub.tablet_serial
            }).eq("id", realItPerson.id);
          }
          await supabase.from("registrations").delete().eq("id", stub.id);
          console.log("Cleaned up", stub.district);
          count++;
        }
      }
    }
  }
  console.log("Cleanup complete. Total merged and deleted: ", count);
  process.exit(0);
}
run();
