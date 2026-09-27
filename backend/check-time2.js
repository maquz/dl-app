require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data } = await supabase.from("registrations").select("id, officer_name, phone_number, district, cohort_id, roles").in("id", [381, 394]);
  console.log(data);
  process.exit(0);
}
run();
