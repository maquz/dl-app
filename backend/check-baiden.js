require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data } = await supabase.from("registrations").select("id, officer_name, district, cohort_id, roles").ilike("officer_name", "%Baiden%");
  console.log(data);
  process.exit(0);
}
run();
