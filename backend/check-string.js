require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data } = await supabase.from("registrations").select("id, officer_name, district").eq("id", 394);
  console.log("District:", `"${data[0].district}"`);
  process.exit(0);
}
run();
