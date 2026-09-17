const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("\n❌ Error: SUPABASE_URL and SUPABASE_KEY / SUPABASE_SERVICE_ROLE_KEY are required.");
  console.error("Please add your Supabase credentials to backend/.env:");
  console.error("  SUPABASE_URL=https://your-project.supabase.co");
  console.error("  SUPABASE_KEY=your-supabase-service-role-or-anon-key\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false }
});

async function syncAll() {
  console.log("==================================================================");
  console.log("🚀 STARTING SYNCHRONIZATION TO SUPABASE");
  console.log("Target URL: " + SUPABASE_URL);
  console.log("==================================================================\n");

  try {
    // 1. Sync Cohorts
    console.log("1️⃣ Syncing Cohorts...");
    const cohortsData = require("../data/cohorts.json");
    for (const c of cohortsData) {
      const { error } = await supabase.from("cohorts").upsert({
        id: c.id,
        name: c.name,
        start_date: c.startDate,
        end_date: c.endDate,
        arrival_date: c.arrivalDate,
        departure_date: c.departureDate,
        max_capacity: c.expectedParticipants || 150,
        start_date_iso: c.startDateIso,
        end_date_iso: c.endDateIso,
        arrival_date_iso: c.arrivalDateIso,
        departure_date_iso: c.departureDateIso
      }, { onConflict: "id" });
      if (error) console.error("   ⚠️ Cohort " + c.name + " sync error:", error.message);
    }
    console.log("   ✓ Synced " + cohortsData.length + " Cohorts successfully.");

    // 2. Sync National Master Trainers
    console.log("\n2️⃣ Syncing National Master Trainers...");
    const trainersData = require("../data/national_trainers.json");
    const crypto = require("crypto");
    for (let i = 0; i < trainersData.length; i++) {
      const t = trainersData[i];
      const rawPass = t.contactNumber.replace(/\D/g, "") || "trainer2026";
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(rawPass, salt, 64).toString("hex");
      const passwordHash = salt + ":" + hash;

      const { error } = await supabase.from("national_trainers").upsert({
        id: i + 1,
        name: t.name,
        place_of_work: t.placeOfWork,
        schedule_role: t.scheduleRole || "Teacher",
        contact_number: t.contactNumber,
        email: t.email,
        status: "Active",
        password_hash: passwordHash
      }, { onConflict: "id" });
      if (error) console.error("   ⚠️ Trainer " + t.name + " sync error:", error.message);
    }
    console.log("   ✓ Synced " + trainersData.length + " National Trainers successfully.");

    // 3. Sync Default Super Admin
    console.log("\n3️⃣ Syncing Super Admin...");
    const adminPass = process.env.ADMIN_PASSWORD || "admin1234";
    const adminSalt = crypto.randomBytes(16).toString("hex");
    const adminHash = crypto.scryptSync(adminPass, adminSalt, 64).toString("hex");
    const adminPasswordHash = adminSalt + ":" + adminHash;

    const { error: adminErr } = await supabase.from("admins").upsert({
      id: 1,
      name: "National DL Administrator",
      email: "admin@ges.gov.gh",
      phone_number: "024-000-0000",
      role: "Super Admin",
      status: "Active",
      password_hash: adminPasswordHash
    }, { onConflict: "email" });
    if (adminErr) console.error("   ⚠️ Admin sync error:", adminErr.message);
    else console.log("   ✓ Synced Super Admin (admin@ges.gov.gh).");

    // 4. Sync Sample Assessments & Questions
    console.log("\n4️⃣ Syncing Assessments & Questions...");
    const sampleAssessments = require("../data/sample_assessments.json");
    for (let idx = 0; idx < sampleAssessments.length; idx++) {
      const a = sampleAssessments[idx];
      const aId = idx + 1;
      const { error: aErr } = await supabase.from("assessments").upsert({
        id: aId,
        title: a.title,
        type: a.type,
        description: a.description,
        time_limit_minutes: a.timeLimitMinutes || 20,
        is_active: a.isActive !== undefined ? a.isActive : 1,
        unlock_time: "19:00",
        unlock_date_type: "arrival_date",
        lock_mode: "scheduled"
      }, { onConflict: "id" });
      if (aErr) console.error("   ⚠️ Assessment " + a.title + " error:", aErr.message);

      // Delete existing questions for clean upsert
      await supabase.from("assessment_questions").delete().eq("assessment_id", aId);

      let qOrder = 1;
      for (const q of a.questions) {
        await supabase.from("assessment_questions").insert({
          assessment_id: aId,
          question_text: q.questionText,
          question_type: q.questionType || "multiple_choice",
          options_json: q.options,
          correct_answer: q.correctAnswer,
          points: q.points || 1,
          sort_order: qOrder++
        });
      }
    }
    console.log("   ✓ Synced " + sampleAssessments.length + " Assessments & Questions.");

    // 5. Sync Registrations from SQLite if exists
    console.log("\n5️⃣ Checking and Syncing Local Registrations from SQLite...");
    try {
      const db = require("../db");
      const rows = db.prepare("SELECT * FROM registrations").all();
      if (rows && rows.length > 0) {
        console.log("   Found " + rows.length + " local registrations to sync.");
        for (const r of rows) {
          let rolesParsed = [];
          try {
            rolesParsed = typeof r.roles === "string" ? JSON.parse(r.roles) : r.roles;
          } catch(e) {
            rolesParsed = [r.roles];
          }
          await supabase.from("registrations").upsert({
            id: r.id,
            officer_name: r.officer_name,
            sex: r.sex,
            phone_number: r.phone_number,
            email: r.email,
            region: r.region,
            district: r.district,
            institution_name: r.institution_name,
            roles: rolesParsed,
            cohort_id: r.cohort_id || null,
            arrival_date: r.arrival_date || null,
            attendance_status: r.attendance_status || "Registered",
            check_in_notes: r.check_in_notes || null
          }, { onConflict: "id" });
        }
        console.log("   ✓ Synced " + rows.length + " Registrations to Supabase.");
      } else {
        console.log("   No registrations found in local SQLite db (table is ready).");
      }
    } catch(err) {
      console.log("   (Local SQLite check skipped: " + err.message + ")");
    }

    console.log("\n==================================================================");
    console.log("✅ SYNCHRONIZATION COMPLETE!");
    console.log("Your Supabase database is now fully populated and synchronized.");
    console.log("==================================================================\n");

  } catch (error) {
    console.error("\n❌ Synchronization encountered an error:", error);
  }
}

syncAll();
