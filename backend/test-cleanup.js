require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: stubs } = await supabase.from("registrations").select("id, district, cohort_id, tablet_imei, tablet_serial, officer_name, phone_number").eq("officer_name", "Pending Registration").like("phone_number", "STUB-%");
  console.log("Stubs found:", stubs);
  
  if (stubs && stubs.length > 0) {
    for (const stub of stubs) {
      const { data: realUsers } = await supabase.from("registrations").select("id, officer_name, roles, district, cohort_id, tablet_imei, tablet_serial").eq("district", stub.district).eq("cohort_id", stub.cohort_id).neq("id", stub.id);
      console.log("Real users for district", stub.district, ":", realUsers);
    }
  }
}
run();
