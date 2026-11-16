const { createClient } = require("@supabase/supabase-js");
const db = require("./db");
require("dotenv").config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkAssessments() {
  console.log("--- SQLite Assessments ---");
  const sqliteAssessments = db.prepare("SELECT id, title, type, target_program FROM assessments").all();
  console.log(sqliteAssessments);

  console.log("--- Supabase Assessments ---");
  const { data: supaAssessments } = await supabase.from("assessments").select("id, title, type, target_program");
  console.log(supaAssessments);

  console.log("--- SQLite Questions count by assessment_id ---");
  const sqliteQ = db.prepare("SELECT assessment_id, count(*) as count FROM assessment_questions GROUP BY assessment_id").all();
  console.log(sqliteQ);

  console.log("--- Supabase Questions count by assessment_id ---");
  const { data: supaQ } = await supabase.from("assessment_questions").select("assessment_id");
  const qCounts = {};
  if (supaQ) {
    supaQ.forEach(q => { qCounts[q.assessment_id] = (qCounts[q.assessment_id] || 0) + 1; });
  }
  console.log(qCounts);
}

checkAssessments();
