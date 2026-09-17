#!/usr/bin/env node
/**
 * seed-supabase.js - Syncs local SQLite registrations to Supabase cloud database
 * Run: node scripts/seed-supabase.js
 */

const path = require("path");
const fs = require("fs");

// Load .env from backend/
const envPath = path.join(__dirname, "../backend/.env");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

// Fallback credentials
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = "https://riuqfrklbzkqagafafhn.supabase.co";
}
if (!process.env.SUPABASE_KEY) {
  process.env.SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXFmcmtsYnprcWFnYWZhZmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjMxMjcsImV4cCI6MjEwNTE5OTEyN30.tfF-QjcQQnpXh8Ueri2nzieGzt9TmDa2HmVpA8Q_j5w";
}

const supabase = require("../backend/supabase");
const db = require("../backend/db");

async function main() {
  if (!supabase) { console.error("Supabase not connected."); process.exit(1); }

  const { data: existing } = await supabase.from("registrations").select("phone_number");
  const existingPhones = new Set((existing || []).map((r) => r.phone_number));
  console.log("Supabase already has:", existingPhones.size, "registrations");

  const localRows = db.prepare("SELECT * FROM registrations ORDER BY id ASC").all();
  console.log("Local SQLite has:", localRows.length, "registrations");

  const toInsert = localRows.filter((r) => !existingPhones.has(r.phone_number));
  console.log("New records to push:", toInsert.length);

  let inserted = 0, failed = 0;
  for (const r of toInsert) {
    let roles = [];
    try { roles = typeof r.roles === "string" ? JSON.parse(r.roles || "[]") : r.roles || []; } catch(e) { roles = [r.roles]; }
    const { error } = await supabase.from("registrations").insert({
      officer_name: r.officer_name, sex: r.sex, phone_number: r.phone_number,
      email: r.email || null, region: r.region, district: r.district,
      institution_name: r.institution_name, roles, cohort_id: r.cohort_id || null,
      arrival_date: r.arrival_date || null, attendance_status: r.attendance_status || "Registered",
      check_in_notes: r.check_in_notes || null,
    });
    if (error) { console.warn("FAILED:", r.officer_name, error.message); failed++; }
    else { console.log("  OK:", r.officer_name, r.phone_number); inserted++; }
  }

  const { count } = await supabase.from("registrations").select("*", { count: "exact", head: true });
  console.log("\nDone. Inserted:", inserted, " Failed:", failed, " Total in Supabase:", count);
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
