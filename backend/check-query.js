require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const cohortId = 3;
  const d = { district: 'Ekumfi' };
  
  const { data } = await supabase.from("registrations").select("id, roles").eq("district", d.district).eq("cohort_id", cohortId);
  console.log("Returned data for Ekumfi:", data);
  
  if (data && data.length > 0) {
    const exists = data.some(r => {
      try {
        const rolesArr = typeof r.roles === 'string' ? JSON.parse(r.roles) : r.roles;
        return (rolesArr || []).some(role => String(role).toLowerCase().includes('it person'));
      } catch(e) { return false; }
    });
    console.log("Did some evaluation return true?", exists);
  }
  process.exit(0);
}
run();
