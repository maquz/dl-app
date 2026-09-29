require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  // Update Gausu with the tablet details
  await supabase.from("registrations").update({
    tablet_imei: '357778647881226',
    tablet_serial: 'R8YL70KA0HW'
  }).eq("id", 264);

  // Delete the stub
  await supabase.from("registrations").delete().eq("id", 384);

  console.log("Merged successfully");
  process.exit(0);
}
run();
