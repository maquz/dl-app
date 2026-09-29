require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data } = await supabase.from("registrations").select("id, officer_name, tablet_imei, tablet_serial").eq("id", 366);
  console.log(data);
  process.exit(0);
}
run();
