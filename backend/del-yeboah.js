require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data, error } = await supabase.from("registrations").delete().eq("id", 47);
  console.log("Deleted", error || "Success");
  process.exit(0);
}
run();
