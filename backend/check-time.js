require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data } = await supabase.from("registrations").select("id, officer_name, district, cohort_id, roles, created_at").in("id", [381, 394]);
  console.log(data);
  process.exit(0);
}
run();
