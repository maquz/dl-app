require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  // Move tablet to Mudasir
  await supabase.from("registrations").update({
    tablet_imei: '357778647881226',
    tablet_serial: 'R8YL70KA0HW'
  }).eq("id", 355);

  // Remove tablet from Gausu
  await supabase.from("registrations").update({
    tablet_imei: null,
    tablet_serial: null
  }).eq("id", 264);

  console.log("Fixed Kumbungu tablet assignment");
  process.exit(0);
}
run();
