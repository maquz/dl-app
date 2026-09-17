const path = require("path");
const fs = require("fs");

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_PATH = process.env.DB_PATH || (isServerless ? path.join("/tmp", "registrations.db") : path.join(__dirname, "data", "registrations.db"));

// Make sure the folder for the DB file exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
  } catch (e) {
    // Ignore if directory already exists
  }
}

let db;
try {
  const { DatabaseSync } = require("node:sqlite");
  db = new DatabaseSync(DB_PATH);
} catch (e) {
  try {
    const Database = require("better-sqlite3");
    db = new Database(DB_PATH);
    try { db.pragma("journal_mode = WAL"); } catch (_) {}
  } catch (err) {
    console.error("Failed to initialize SQLite database:", err);
    throw err;
  }
}

db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    officer_name TEXT NOT NULL,
    sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
    phone_number TEXT NOT NULL,
    email TEXT,
    region TEXT NOT NULL,
    district TEXT NOT NULL,
    institution_name TEXT NOT NULL,
    roles TEXT NOT NULL, -- JSON-encoded array of nominated roles
    submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS officers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    officer_name TEXT NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    email TEXT,
    staff_id TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    role TEXT NOT NULL DEFAULT 'Admin' CHECK (role IN ('Super Admin', 'Admin', 'Reviewer')),
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cohorts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    arrival_date TEXT NOT NULL,
    arrival_date_iso TEXT NOT NULL,
    start_date TEXT NOT NULL,
    start_date_iso TEXT NOT NULL,
    end_date TEXT NOT NULL,
    end_date_iso TEXT NOT NULL,
    departure_date TEXT NOT NULL,
    departure_date_iso TEXT NOT NULL,
    expected_participants INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS national_trainers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    place_of_work TEXT NOT NULL,
    schedule_role TEXT NOT NULL,
    contact_number TEXT NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assessments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('Pre-Test', 'Post-Test', 'Quiz')),
    description TEXT,
    time_limit_minutes INTEGER DEFAULT 20,
    is_active INTEGER NOT NULL DEFAULT 1,
    cohort_id INTEGER REFERENCES cohorts(id),
    created_by_trainer_id INTEGER REFERENCES national_trainers(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS assessment_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false')),
    options_json TEXT NOT NULL, -- JSON array of choices
    correct_answer TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS assessment_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id INTEGER NOT NULL REFERENCES assessments(id),
    registration_id INTEGER,
    officer_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    cohort_id INTEGER,
    score INTEGER NOT NULL,
    total_points INTEGER NOT NULL,
    percentage INTEGER NOT NULL,
    answers_json TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Safe column migrations for existing databases
const migrations = [
  "ALTER TABLE registrations ADD COLUMN email TEXT;",
  "ALTER TABLE registrations ADD COLUMN cohort_id INTEGER REFERENCES cohorts(id);",
  "ALTER TABLE registrations ADD COLUMN arrival_date TEXT;",
  "ALTER TABLE registrations ADD COLUMN attendance_status TEXT DEFAULT 'Registered';",
  "ALTER TABLE registrations ADD COLUMN attended_at TEXT;",
  "ALTER TABLE registrations ADD COLUMN check_in_notes TEXT;",
  "ALTER TABLE assessments ADD COLUMN unlock_time TEXT DEFAULT '19:00';",
  "ALTER TABLE assessments ADD COLUMN unlock_date_type TEXT DEFAULT 'arrival_date';",
  "ALTER TABLE assessments ADD COLUMN custom_unlock_datetime TEXT;",
  "ALTER TABLE assessments ADD COLUMN custom_close_datetime TEXT;",
  "ALTER TABLE assessments ADD COLUMN lock_mode TEXT DEFAULT 'scheduled';",
];

for (const sql of migrations) {
  try {
    db.exec(sql);
  } catch (e) {
    // Column might already exist
  }
}

// Seed default cohorts if empty
try {
  const cohortCount = db.prepare("SELECT COUNT(*) as count FROM cohorts").get();
  if (cohortCount && cohortCount.count === 0) {
    const cohortsData = require("./data/cohorts.json");
    const insertCohort = db.prepare(`
      INSERT INTO cohorts (id, name, arrival_date, arrival_date_iso, start_date, start_date_iso, end_date, end_date_iso, departure_date, departure_date_iso, expected_participants)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const c of cohortsData) {
      insertCohort.run(
        c.id,
        c.name,
        c.arrivalDate,
        c.arrivalDateIso,
        c.startDate,
        c.startDateIso,
        c.endDate,
        c.endDateIso,
        c.departureDate,
        c.departureDateIso,
        c.expectedParticipants
      );
    }
  }
} catch (err) {
  console.error("Error seeding cohorts:", err);
}

// Seed default Super Admin if none exists
const adminCount = db.prepare("SELECT COUNT(*) as count FROM admins").get();
if (adminCount && adminCount.count === 0) {
  const crypto = require("crypto");
  const defaultPass = process.env.ADMIN_PASSWORD || "change-me-please";
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(defaultPass, salt, 64).toString("hex");
  const passwordHash = `${salt}:${hash}`;

  db.prepare(`
    INSERT INTO admins (name, email, phone_number, role, status, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    "National DL Administrator",
    "admin@ges.gov.gh",
    "024-000-0000",
    "Super Admin",
    "Active",
    passwordHash
  );
}

// Seed National Master Trainers (11 Facilitators) if empty
try {
  const trainerCount = db.prepare("SELECT COUNT(*) as count FROM national_trainers").get();
  if (trainerCount && trainerCount.count === 0) {
    const crypto = require("crypto");
    const trainersData = require("./data/national_trainers.json");
    const insertTrainer = db.prepare(`
      INSERT INTO national_trainers (name, place_of_work, schedule_role, contact_number, email, password_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `);

    for (const t of trainersData) {
      // Default password is their contact number without hyphens or 'trainer2026'
      const rawPass = t.contactNumber.replace(/\D/g, "") || "trainer2026";
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(rawPass, salt, 64).toString("hex");
      const passwordHash = `${salt}:${hash}`;

      insertTrainer.run(
        t.name,
        t.placeOfWork,
        t.scheduleRole,
        t.contactNumber,
        t.email,
        passwordHash
      );
    }
    console.log("✓ Seeded 11 National Master Trainers.");
  }
} catch (err) {
  console.error("Error seeding national trainers:", err);
}

// Seed Sample Pre-Test and Post-Test Assessments if empty
try {
  const assessmentCount = db.prepare("SELECT COUNT(*) as count FROM assessments").get();
  if (assessmentCount && assessmentCount.count === 0) {
    const sampleData = require("./data/sample_assessments.json");
    const insertAssessment = db.prepare(`
      INSERT INTO assessments (title, type, description, time_limit_minutes, is_active)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_answer, points, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of sampleData) {
      const aInfo = insertAssessment.run(a.title, a.type, a.description, a.timeLimitMinutes, a.isActive);
      const aId = Number(aInfo.lastInsertRowid);
      let order = 1;
      for (const q of a.questions) {
        insertQuestion.run(
          aId,
          q.questionText,
          q.questionType,
          JSON.stringify(q.options),
          q.correctAnswer,
          q.points || 1,
          order++
        );
      }
    }
    console.log("✓ Seeded Sample Pre-Test & Post-Test Assessments.");
  }
} catch (err) {
  console.error("Error seeding sample assessments:", err);
}

// Seed Initial Registrations if empty
try {
  const regCount = db.prepare("SELECT COUNT(*) as count FROM registrations").get();
  if (regCount && regCount.count === 0) {
    const seedRegistrations = require("./data/seed_registrations.json");
    const insertReg = db.prepare(`
      INSERT INTO registrations (officer_name, sex, phone_number, email, region, district, institution_name, roles, cohort_id, arrival_date, attendance_status, check_in_notes, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of seedRegistrations) {
      insertReg.run(
        r.officerName,
        r.sex,
        r.phoneNumber,
        r.email || null,
        r.region,
        r.district,
        r.institutionName,
        JSON.stringify(r.roles),
        r.cohortId || null,
        r.arrivalDate || null,
        r.attendanceStatus || "Registered",
        r.checkInNotes || null,
        r.submittedAt || new Date().toISOString()
      );
    }
    console.log(`✓ Seeded ${seedRegistrations.length} Nominee Registrations.`);
  }
} catch (err) {
  console.error("Error seeding registrations:", err);
}

module.exports = db;

