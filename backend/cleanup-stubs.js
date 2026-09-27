require('dotenv').config();
const supabase = require('./supabase');
const db = require('./db');

async function run() {
  let deletedCount = 0;
  console.log("Cleaning up duplicate stubs...");

  try {
    const { data: stubs } = await supabase.from("registrations").select("id, district, cohort_id").eq("officer_name", "Pending Registration").like("phone_number", "STUB-%");
    
    if (stubs) {
      for (const stub of stubs) {
        // Check if there is a real IT Person for this district and cohort
        const { data: realUsers } = await supabase.from("registrations").select("id, roles").eq("district", stub.district).eq("cohort_id", stub.cohort_id).neq("id", stub.id);
        
        if (realUsers && realUsers.length > 0) {
          const hasRealItPerson = realUsers.some(r => {
            try {
              const rolesArr = typeof r.roles === 'string' ? JSON.parse(r.roles) : r.roles;
              return (rolesArr || []).some(role => String(role).toLowerCase().includes('it person'));
            } catch(e) { return false; }
          });

          if (hasRealItPerson) {
            console.log(`Deleting duplicate stub for ${stub.district} (Cohort ${stub.cohort_id})...`);
            await supabase.from("registrations").delete().eq("id", stub.id);
            try {
               db.prepare("DELETE FROM registrations WHERE id = ?").run(stub.id);
            } catch(e) {}
            deletedCount++;
          }
        }
      }
    }
    console.log(`Successfully deleted ${deletedCount} redundant stub(s).`);
  } catch (err) {
    console.error("Failed", err);
  }
  process.exit(0);
}
run();
