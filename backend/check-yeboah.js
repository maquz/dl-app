require('dotenv').config();
const supabase = require('./supabase');

async function run() {
  const { data } = await supabase.from("registrations").select("id, officer_name, phone_number, email").ilike("officer_name", "%Yeboah Yaa Leticia%");
  console.log(data);
  process.exit(0);
}
run();
