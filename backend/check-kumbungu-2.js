require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data } = await supabase.from("registrations").select("id, officer_name, district, roles, tablet_imei, tablet_serial").eq("district", "Kumbungu");
  console.log(data);
  process.exit(0);
}
run();
