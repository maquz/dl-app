const { createClient } = require("@supabase/supabase-js");
const db = require("./db");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  console.log("=== SQLITE COUNTS ===");
  const tables = [
    "cohorts",
    "sample_schools",
    "national_trainers",
    "admins",
    "officers",
    "registrations",
    "assessments",
    "assessment_questions",
    "assessment_submissions",
    "password_resets"
  ];

  for (const t of tables) {
    try {
      const row = db.prepare(`SELECT COUNT(*) as count FROM ${t}`).get();
      console.log(`SQLite ${t}: ${row.count}`);
    } catch (e) {
      console.log(`SQLite ${t}: ERROR ${e.message}`);
    }
  }

  console.log("\n=== SUPABASE COUNTS ===");
  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true });
      if (error) {
        console.log(`Supabase ${t}: ERROR ${error.message}`);
      } else {
        console.log(`Supabase ${t}: ${count}`);
      }
    } catch (e) {
      console.log(`Supabase ${t}: ERROR ${e.message}`);
    }
  }
}

run();
