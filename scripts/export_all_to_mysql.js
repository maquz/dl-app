const fs = require("fs");
const path = require("path");
const bcrypt = require("../backend/node_modules/bcryptjs");
const { createClient } = require("../backend/node_modules/@supabase/supabase-js");

require("dotenv").config({ path: path.join(__dirname, "../backend/.env") });
process.env.DB_PATH = path.join(__dirname, "../backend/data/registrations.db");
const db = require("../backend/db");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const outputFile = path.join(__dirname, "../cpanel_deployment/database.sql");

function escapeSql(val) {
  if (val === null || val === undefined) return "NULL";
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  if (typeof val === "object") {
    val = JSON.stringify(val);
  }
  const str = String(val)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\0/g, "\\0")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\x1a/g, "\\Z");
  return `'${str}'`;
}

async function fetchAllSupabaseRows(table) {
  let allRows = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + step - 1);

    if (error) {
      console.error(`Error fetching from Supabase table ${table}:`, error.message);
      break;
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      if (data.length < step) {
        hasMore = false;
      } else {
        from += step;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

async function main() {
  console.log("Starting MySQL export...");
  const sqlLines = [];

  sqlLines.push("-- ============================================================================");
  sqlLines.push("-- GHANA EDUCATION SERVICE (GES) - DIFFERENTIATED LEARNING (DL) PROGRAMME");
  sqlLines.push("-- 100% SELF-HOSTED cPANEL MySQL DATABASE DUMP");
  sqlLines.push(`-- Generated: ${new Date().toISOString()}`);
  sqlLines.push("-- Host: codecasticgh.com (cPanel LAMP Stack)");
  sqlLines.push("-- ============================================================================\n");
  sqlLines.push("SET NAMES utf8mb4;");
  sqlLines.push("SET FOREIGN_KEY_CHECKS = 0;\n");

  // --------------------------------------------------------------------------
  // 1. COHORTS
  // --------------------------------------------------------------------------
  console.log("Exporting cohorts...");
  sqlLines.push("-- Table: cohorts");
  sqlLines.push("DROP TABLE IF EXISTS `cohorts`;");
  sqlLines.push(`CREATE TABLE \`cohorts\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(100) NOT NULL,
  \`start_date\` VARCHAR(100) NOT NULL,
  \`end_date\` VARCHAR(100) NOT NULL,
  \`arrival_date\` VARCHAR(100) NOT NULL,
  \`departure_date\` VARCHAR(100) NOT NULL,
  \`expected_participants\` INT NOT NULL DEFAULT 150,
  \`max_capacity\` INT NOT NULL DEFAULT 150,
  \`start_date_iso\` VARCHAR(50) DEFAULT NULL,
  \`end_date_iso\` VARCHAR(50) DEFAULT NULL,
  \`arrival_date_iso\` VARCHAR(50) DEFAULT NULL,
  \`departure_date_iso\` VARCHAR(50) DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  let cohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
  if (cohorts.length > 0) {
    sqlLines.push("INSERT INTO `cohorts` (`id`, `name`, `start_date`, `end_date`, `arrival_date`, `departure_date`, `expected_participants`, `max_capacity`, `start_date_iso`, `end_date_iso`, `arrival_date_iso`, `departure_date_iso`) VALUES");
    const valRows = cohorts.map(c => 
      `(${c.id}, ${escapeSql(c.name)}, ${escapeSql(c.start_date)}, ${escapeSql(c.end_date)}, ${escapeSql(c.arrival_date)}, ${escapeSql(c.departure_date)}, ${c.expected_participants || 150}, ${c.expected_participants || 150}, ${escapeSql(c.start_date_iso)}, ${escapeSql(c.end_date_iso)}, ${escapeSql(c.arrival_date_iso)}, ${escapeSql(c.departure_date_iso)})`
    );
    sqlLines.push(valRows.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 2. SAMPLE SCHOOLS (210 schools)
  // --------------------------------------------------------------------------
  console.log("Exporting sample_schools...");
  sqlLines.push("-- Table: sample_schools");
  sqlLines.push("DROP TABLE IF EXISTS `sample_schools`;");
  sqlLines.push(`CREATE TABLE \`sample_schools\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`school_number\` INT NOT NULL,
  \`school_name\` VARCHAR(255) NOT NULL,
  \`emis_code\` VARCHAR(50) NOT NULL,
  \`region\` VARCHAR(100) NOT NULL,
  \`district\` VARCHAR(150) NOT NULL,
  \`group_id\` VARCHAR(50) NOT NULL,
  \`group_name\` VARCHAR(150) NOT NULL,
  \`treatment\` TEXT NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_sample_schools_emis\` (\`emis_code\`),
  KEY \`idx_sample_schools_group\` (\`group_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  let schools = db.prepare("SELECT * FROM sample_schools ORDER BY id ASC").all();
  if (schools.length > 0) {
    sqlLines.push("INSERT INTO `sample_schools` (`id`, `school_number`, `school_name`, `emis_code`, `region`, `district`, `group_id`, `group_name`, `treatment`) VALUES");
    const valRows = schools.map(s => 
      `(${s.id}, ${s.school_number}, ${escapeSql(s.school_name)}, ${escapeSql(s.emis_code)}, ${escapeSql(s.region)}, ${escapeSql(s.district)}, ${escapeSql(s.group_id)}, ${escapeSql(s.group_name)}, ${escapeSql(s.treatment)})`
    );
    sqlLines.push(valRows.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 3. NATIONAL MASTER TRAINERS
  // --------------------------------------------------------------------------
  console.log("Exporting national_trainers...");
  sqlLines.push("-- Table: national_trainers");
  sqlLines.push("DROP TABLE IF EXISTS `national_trainers`;");
  sqlLines.push(`CREATE TABLE \`national_trainers\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(150) NOT NULL,
  \`place_of_work\` VARCHAR(255) DEFAULT NULL,
  \`schedule_role\` VARCHAR(100) NOT NULL DEFAULT 'Teacher',
  \`contact_number\` VARCHAR(50) NOT NULL,
  \`email\` VARCHAR(150) DEFAULT NULL,
  \`status\` ENUM('Active', 'Disabled') NOT NULL DEFAULT 'Active',
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_trainers_contact\` (\`contact_number\`),
  KEY \`idx_trainers_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  let trainers = db.prepare("SELECT * FROM national_trainers ORDER BY id ASC").all();
  if (trainers.length > 0) {
    sqlLines.push("INSERT INTO `national_trainers` (`id`, `name`, `place_of_work`, `schedule_role`, `contact_number`, `email`, `status`, `password_hash`) VALUES");
    const valRows = trainers.map(t => {
      // Generate bcrypt hash for seamless PHP password_verify()
      const rawContact = (t.contact_number || "").replace(/\D/g, "") || "trainer2026";
      const bcryptHash = bcrypt.hashSync(rawContact, 10);
      return `(${t.id}, ${escapeSql(t.name)}, ${escapeSql(t.place_of_work)}, ${escapeSql(t.schedule_role)}, ${escapeSql(t.contact_number)}, ${escapeSql(t.email)}, ${escapeSql(t.status)}, ${escapeSql(bcryptHash)})`;
    });
    sqlLines.push(valRows.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 4. SYSTEM ADMINISTRATORS
  // --------------------------------------------------------------------------
  console.log("Exporting admins...");
  sqlLines.push("-- Table: admins");
  sqlLines.push("DROP TABLE IF EXISTS `admins`;");
  sqlLines.push(`CREATE TABLE \`admins\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`name\` VARCHAR(150) NOT NULL,
  \`email\` VARCHAR(150) NOT NULL UNIQUE,
  \`phone_number\` VARCHAR(50) DEFAULT NULL,
  \`role\` VARCHAR(50) NOT NULL DEFAULT 'Admin',
  \`status\` ENUM('Active', 'Disabled') NOT NULL DEFAULT 'Active',
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uniq_admin_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  const supaAdmins = await fetchAllSupabaseRows("admins");
  let sqliteAdmins = [];
  try {
    sqliteAdmins = db.prepare("SELECT * FROM admins ORDER BY id ASC").all();
  } catch(e) {}

  const adminMap = new Map();
  supaAdmins.forEach(a => adminMap.set(a.email.toLowerCase(), a));
  sqliteAdmins.forEach(a => {
    if (!adminMap.has(a.email.toLowerCase())) {
      adminMap.set(a.email.toLowerCase(), a);
    }
  });

  const admins = Array.from(adminMap.values());
  if (admins.length > 0) {
    const adminBcrypt = bcrypt.hashSync("change-me-please", 10);
    sqlLines.push("INSERT INTO `admins` (`id`, `name`, `email`, `phone_number`, `role`, `status`, `password_hash`) VALUES");
    const valRows = admins.map((a, idx) => 
      `(${idx + 1}, ${escapeSql(a.name)}, ${escapeSql(a.email)}, ${escapeSql(a.phone_number)}, ${escapeSql(a.role || 'Admin')}, ${escapeSql(a.status || 'Active')}, ${escapeSql(adminBcrypt)})`
    );
    sqlLines.push(valRows.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 5. NOMINATED OFFICERS AUTH ACCOUNTS
  // --------------------------------------------------------------------------
  console.log("Exporting officers...");
  sqlLines.push("-- Table: officers");
  sqlLines.push("DROP TABLE IF EXISTS `officers`;");
  sqlLines.push(`CREATE TABLE \`officers\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`officer_name\` VARCHAR(150) NOT NULL,
  \`phone_number\` VARCHAR(50) NOT NULL UNIQUE,
  \`email\` VARCHAR(150) DEFAULT NULL,
  \`staff_id\` VARCHAR(50) DEFAULT NULL,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_officers_phone\` (\`phone_number\`),
  KEY \`idx_officers_email\` (\`email\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  let officers = db.prepare("SELECT * FROM officers ORDER BY id ASC").all();
  if (officers.length > 0) {
    sqlLines.push("INSERT INTO `officers` (`id`, `officer_name`, `phone_number`, `email`, `staff_id`, `password_hash`) VALUES");
    const valRows = officers.map(o => {
      const cleanPhone = (o.phone_number || "").replace(/\D/g, "") || "officer2026";
      const officerBcrypt = bcrypt.hashSync(cleanPhone, 10);
      return `(${o.id}, ${escapeSql(o.officer_name)}, ${escapeSql(o.phone_number)}, ${escapeSql(o.email)}, ${escapeSql(o.staff_id)}, ${escapeSql(officerBcrypt)})`;
    });
    sqlLines.push(valRows.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 6. PASSWORD RESETS
  // --------------------------------------------------------------------------
  console.log("Exporting password_resets...");
  sqlLines.push("-- Table: password_resets");
  sqlLines.push("DROP TABLE IF EXISTS `password_resets`;");
  sqlLines.push(`CREATE TABLE \`password_resets\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`email\` VARCHAR(150) NOT NULL,
  \`code\` VARCHAR(20) NOT NULL,
  \`expires_at\` VARCHAR(50) NOT NULL,
  \`used\` TINYINT(1) NOT NULL DEFAULT 0,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_resets_email\` (\`email\`),
  KEY \`idx_resets_code\` (\`code\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  let resets = db.prepare("SELECT * FROM password_resets ORDER BY id ASC").all();
  if (resets.length > 0) {
    sqlLines.push("INSERT INTO `password_resets` (`id`, `email`, `code`, `expires_at`, `used`) VALUES");
    const valRows = resets.map(r => 
      `(${r.id}, ${escapeSql(r.email)}, ${escapeSql(r.code)}, ${escapeSql(r.expires_at)}, ${r.used})`
    );
    sqlLines.push(valRows.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 7. REGISTRATIONS (1,340+ rows)
  // --------------------------------------------------------------------------
  console.log("Fetching registrations from Supabase (paginated)...");
  const supaRegs = await fetchAllSupabaseRows("registrations");
  console.log(`Fetched ${supaRegs.length} registrations from Supabase.`);

  // Merge SQLite registrations if there are IDs not in Supabase
  const sqliteRegs = db.prepare("SELECT * FROM registrations").all();
  const regMap = new Map();

  supaRegs.forEach(r => {
    regMap.set(r.id, r);
  });

  sqliteRegs.forEach(r => {
    if (!regMap.has(r.id)) {
      regMap.set(r.id, r);
    }
  });

  const mergedRegs = Array.from(regMap.values()).sort((a, b) => a.id - b.id);
  console.log(`Total merged registrations: ${mergedRegs.length}`);

  sqlLines.push("-- Table: registrations");
  sqlLines.push("DROP TABLE IF EXISTS `registrations`;");
  sqlLines.push(`CREATE TABLE \`registrations\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`officer_name\` VARCHAR(150) NOT NULL,
  \`sex\` ENUM('Male', 'Female') NOT NULL,
  \`phone_number\` VARCHAR(50) NOT NULL,
  \`email\` VARCHAR(150) DEFAULT NULL,
  \`region\` VARCHAR(100) NOT NULL,
  \`district\` VARCHAR(150) NOT NULL,
  \`institution_name\` VARCHAR(255) NOT NULL,
  \`roles\` TEXT NOT NULL,
  \`cohort_id\` INT DEFAULT NULL,
  \`arrival_date\` VARCHAR(100) DEFAULT NULL,
  \`attendance_status\` ENUM('Registered', 'Attended', 'Absent', 'Excused') NOT NULL DEFAULT 'Registered',
  \`check_in_notes\` TEXT DEFAULT NULL,
  \`tablet_imei\` VARCHAR(50) DEFAULT NULL,
  \`tablet_serial\` VARCHAR(50) DEFAULT NULL,
  \`program_type\` VARCHAR(50) DEFAULT 'master_trainer',
  \`school_name\` VARCHAR(255) DEFAULT NULL,
  \`emis_code\` VARCHAR(50) DEFAULT NULL,
  \`study_group\` VARCHAR(50) DEFAULT NULL,
  \`designation\` VARCHAR(50) DEFAULT NULL,
  \`sample_school_id\` INT DEFAULT NULL,
  \`checked_in_at\` VARCHAR(50) DEFAULT NULL,
  \`submitted_at\` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_reg_phone\` (\`phone_number\`),
  KEY \`idx_reg_email\` (\`email\`),
  KEY \`idx_reg_cohort\` (\`cohort_id\`),
  KEY \`idx_reg_program\` (\`program_type\`),
  KEY \`idx_reg_emis\` (\`emis_code\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  // Insert registrations in chunks of 200
  const chunkSize = 200;
  for (let i = 0; i < mergedRegs.length; i += chunkSize) {
    const chunk = mergedRegs.slice(i, i + chunkSize);
    sqlLines.push("INSERT INTO `registrations` (`id`, `officer_name`, `sex`, `phone_number`, `email`, `region`, `district`, `institution_name`, `roles`, `cohort_id`, `arrival_date`, `attendance_status`, `check_in_notes`, `tablet_imei`, `tablet_serial`, `program_type`, `school_name`, `emis_code`, `study_group`, `designation`, `sample_school_id`, `checked_in_at`, `submitted_at`) VALUES");
    
    const rowsSql = chunk.map(r => {
      let programType = r.program_type || "master_trainer";
      let schoolName = r.school_name || null;
      let emisCode = r.emis_code || null;
      let studyGroup = r.study_group || null;
      let designation = r.designation || null;
      let sampleSchoolId = r.sample_school_id || null;

      // Extract sample school metadata if stored in check_in_notes JSON
      if (r.check_in_notes && typeof r.check_in_notes === "string" && r.check_in_notes.startsWith("{")) {
        try {
          const notesObj = JSON.parse(r.check_in_notes);
          if (notesObj.program_type) programType = notesObj.program_type;
          if (notesObj.school_name) schoolName = notesObj.school_name;
          if (notesObj.emis_code) emisCode = notesObj.emis_code;
          if (notesObj.study_group) studyGroup = notesObj.study_group;
          if (notesObj.designation) designation = notesObj.designation;
        } catch (e) {}
      }

      const rolesVal = typeof r.roles === "object" ? JSON.stringify(r.roles) : String(r.roles || "[]");
      const checkedInAt = r.checked_in_at || r.attended_at || null;
      const submittedAt = r.submitted_at || new Date().toISOString();

      return `(${r.id}, ${escapeSql(r.officer_name)}, ${escapeSql(r.sex || 'Male')}, ${escapeSql(r.phone_number)}, ${escapeSql(r.email)}, ${escapeSql(r.region)}, ${escapeSql(r.district)}, ${escapeSql(r.institution_name)}, ${escapeSql(rolesVal)}, ${r.cohort_id || 'NULL'}, ${escapeSql(r.arrival_date)}, ${escapeSql(r.attendance_status || 'Registered')}, ${escapeSql(r.check_in_notes)}, ${escapeSql(r.tablet_imei)}, ${escapeSql(r.tablet_serial)}, ${escapeSql(programType)}, ${escapeSql(schoolName)}, ${escapeSql(emisCode)}, ${escapeSql(studyGroup)}, ${escapeSql(designation)}, ${sampleSchoolId || 'NULL'}, ${escapeSql(checkedInAt)}, ${escapeSql(submittedAt)})`;
    });

    sqlLines.push(rowsSql.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 8. ASSESSMENTS (5 assessments)
  // --------------------------------------------------------------------------
  console.log("Exporting assessments...");
  sqlLines.push("-- Table: assessments");
  sqlLines.push("DROP TABLE IF EXISTS `assessments`;");
  sqlLines.push(`CREATE TABLE \`assessments\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`title\` VARCHAR(255) NOT NULL,
  \`type\` ENUM('Pre-Test', 'Post-Test', 'Quiz') NOT NULL,
  \`description\` TEXT DEFAULT NULL,
  \`time_limit_minutes\` INT NOT NULL DEFAULT 20,
  \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
  \`cohort_id\` INT DEFAULT NULL,
  \`created_by_trainer_id\` INT DEFAULT NULL,
  \`unlock_time\` VARCHAR(20) NOT NULL DEFAULT '19:00',
  \`unlock_date_type\` VARCHAR(50) NOT NULL DEFAULT 'arrival_date',
  \`custom_unlock_datetime\` VARCHAR(50) DEFAULT NULL,
  \`custom_close_datetime\` VARCHAR(50) DEFAULT NULL,
  \`lock_mode\` VARCHAR(50) NOT NULL DEFAULT 'scheduled',
  \`target_program\` VARCHAR(50) NOT NULL DEFAULT 'master_trainer',
  \`study_group\` VARCHAR(50) NOT NULL DEFAULT 'all',
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  const assessmentsData = [
    {
      id: 1,
      title: "DL Workshop Pre-Training Assessment",
      type: "Pre-Test",
      description: "Diagnostic assessment to gauge participant baseline knowledge of Differentiated Learning principles, pedagogical grouping, and formative assessment prior to the workshop.",
      time_limit_minutes: 25,
      is_active: 1,
      cohort_id: null,
      created_by_trainer_id: null,
      unlock_time: "19:00",
      unlock_date_type: "arrival_date",
      custom_unlock_datetime: null,
      custom_close_datetime: null,
      lock_mode: "open_now",
      target_program: "master_trainer",
      study_group: "all"
    },
    {
      id: 2,
      title: "DL Workshop Post-Training Evaluation",
      type: "Post-Test",
      description: "Summative assessment to measure participant knowledge gains, mastery of DL methodologies, and readiness to cascade training to teachers in their respective districts.",
      time_limit_minutes: 25,
      is_active: 1,
      cohort_id: null,
      created_by_trainer_id: null,
      unlock_time: "16:00",
      unlock_date_type: "arrival_date",
      custom_unlock_datetime: null,
      custom_close_datetime: null,
      lock_mode: "scheduled",
      target_program: "master_trainer",
      study_group: "all"
    },
    {
      id: 3,
      title: "Facilitator Custom Quiz: Microlearning & Gamification",
      type: "Quiz",
      description: "Facilitator assessment on microlearning and student engagement.",
      time_limit_minutes: 15,
      is_active: 1,
      cohort_id: null,
      created_by_trainer_id: 1,
      unlock_time: "14:00",
      unlock_date_type: "arrival_date",
      custom_unlock_datetime: null,
      custom_close_datetime: null,
      lock_mode: "open_now",
      target_program: "master_trainer",
      study_group: "all"
    },
    {
      id: 4,
      title: "GALOP AF2 Sample Schools: Pre-Training Assessment",
      type: "Pre-Test",
      description: "Baseline Diagnostic Assessment for Teachers and Headteachers of the 210 selected sample schools on DL Midterm Assessment & Weekly Lesson Checkpoint.",
      time_limit_minutes: 20,
      is_active: 1,
      cohort_id: null,
      created_by_trainer_id: null,
      unlock_time: "09:00",
      unlock_date_type: "arrival_date",
      custom_unlock_datetime: null,
      custom_close_datetime: null,
      lock_mode: "open_now",
      target_program: "sample_school",
      study_group: "all"
    },
    {
      id: 5,
      title: "GALOP AF2 Sample Schools: Post-Training Assessment",
      type: "Post-Test",
      description: "Final Evaluation Assessment for Teachers and Headteachers of the 210 selected sample schools on DL Midterm Assessment & Weekly Lesson Checkpoint.",
      time_limit_minutes: 20,
      is_active: 1,
      cohort_id: null,
      created_by_trainer_id: null,
      unlock_time: "12:00",
      unlock_date_type: "end_date",
      custom_unlock_datetime: null,
      custom_close_datetime: null,
      lock_mode: "open_now",
      target_program: "sample_school",
      study_group: "all"
    }
  ];

  sqlLines.push("INSERT INTO `assessments` (`id`, `title`, `type`, `description`, `time_limit_minutes`, `is_active`, `cohort_id`, `created_by_trainer_id`, `unlock_time`, `unlock_date_type`, `custom_unlock_datetime`, `custom_close_datetime`, `lock_mode`, `target_program`, `study_group`) VALUES");
  const aRows = assessmentsData.map(a => 
    `(${a.id}, ${escapeSql(a.title)}, ${escapeSql(a.type)}, ${escapeSql(a.description)}, ${a.time_limit_minutes}, ${a.is_active}, ${a.cohort_id || 'NULL'}, ${a.created_by_trainer_id || 'NULL'}, ${escapeSql(a.unlock_time)}, ${escapeSql(a.unlock_date_type)}, ${escapeSql(a.custom_unlock_datetime)}, ${escapeSql(a.custom_close_datetime)}, ${escapeSql(a.lock_mode)}, ${escapeSql(a.target_program)}, ${escapeSql(a.study_group)})`
  );
  sqlLines.push(aRows.join(",\n") + ";\n");

  // --------------------------------------------------------------------------
  // 9. ASSESSMENT QUESTIONS (138 questions)
  // --------------------------------------------------------------------------
  console.log("Fetching assessment questions from Supabase and SQLite...");
  const supaQuestions = await fetchAllSupabaseRows("assessment_questions");
  console.log(`Fetched ${supaQuestions.length} questions from Supabase.`);

  const sqliteQuestions = db.prepare("SELECT * FROM assessment_questions").all();
  console.log(`Fetched ${sqliteQuestions.length} questions from SQLite.`);

  // Merge questions (use unique key: assessment_id + question_text)
  const qMap = new Map();
  let maxId = 0;
  supaQuestions.forEach(q => {
    if (q.id && q.id > maxId) maxId = q.id;
  });
  let nextQId = maxId + 1;

  // Supabase questions first
  supaQuestions.forEach(q => {
    const key = `${q.assessment_id}:${q.question_text.trim()}`;
    qMap.set(key, {
      id: q.id || nextQId++,
      assessment_id: q.assessment_id,
      question_text: q.question_text,
      question_type: q.question_type || "multiple_choice",
      options_json: typeof q.options_json === "object" ? JSON.stringify(q.options_json) : (q.options_json || "[]"),
      correct_answer: q.correct_answer,
      points: q.points || 1,
      sort_order: q.sort_order || 1
    });
  });

  // Add SQLite questions that are not already present
  sqliteQuestions.forEach(q => {
    const key = `${q.assessment_id}:${q.question_text.trim()}`;
    if (!qMap.has(key)) {
      qMap.set(key, {
        id: nextQId++,
        assessment_id: q.assessment_id,
        question_text: q.question_text,
        question_type: q.question_type || "multiple_choice",
        options_json: typeof q.options_json === "object" ? JSON.stringify(q.options_json) : (q.options_json || "[]"),
        correct_answer: q.correct_answer,
        points: q.points || 1,
        sort_order: q.sort_order || 1
      });
    }
  });

  const mergedQuestions = Array.from(qMap.values());
  console.log(`Total merged questions: ${mergedQuestions.length}`);

  sqlLines.push("-- Table: assessment_questions");
  sqlLines.push("DROP TABLE IF EXISTS `assessment_questions`;");
  sqlLines.push(`CREATE TABLE \`assessment_questions\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`assessment_id\` INT NOT NULL,
  \`question_text\` TEXT NOT NULL,
  \`question_type\` VARCHAR(50) NOT NULL DEFAULT 'multiple_choice',
  \`options_json\` LONGTEXT NOT NULL,
  \`correct_answer\` VARCHAR(255) NOT NULL,
  \`points\` INT NOT NULL DEFAULT 1,
  \`sort_order\` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (\`id\`),
  KEY \`idx_q_assessment_id\` (\`assessment_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  for (let i = 0; i < mergedQuestions.length; i += chunkSize) {
    const chunk = mergedQuestions.slice(i, i + chunkSize);
    sqlLines.push("INSERT INTO `assessment_questions` (`id`, `assessment_id`, `question_text`, `question_type`, `options_json`, `correct_answer`, `points`, `sort_order`) VALUES");
    const qRows = chunk.map((q, idx) => 
      `(${q.id || (i + idx + 1)}, ${q.assessment_id}, ${escapeSql(q.question_text)}, ${escapeSql(q.question_type)}, ${escapeSql(q.options_json)}, ${escapeSql(q.correct_answer)}, ${q.points || 1}, ${q.sort_order || 1})`
    );
    sqlLines.push(qRows.join(",\n") + ";\n");
  }

  // --------------------------------------------------------------------------
  // 10. ASSESSMENT SUBMISSIONS
  // --------------------------------------------------------------------------
  console.log("Exporting assessment_submissions...");
  sqlLines.push("-- Table: assessment_submissions");
  sqlLines.push("DROP TABLE IF EXISTS `assessment_submissions`;");
  sqlLines.push(`CREATE TABLE \`assessment_submissions\` (
  \`id\` INT NOT NULL AUTO_INCREMENT,
  \`assessment_id\` INT NOT NULL,
  \`registration_id\` INT DEFAULT NULL,
  \`officer_name\` VARCHAR(150) NOT NULL,
  \`phone_number\` VARCHAR(50) NOT NULL,
  \`cohort_id\` INT DEFAULT NULL,
  \`score\` INT NOT NULL DEFAULT 0,
  \`total_points\` INT NOT NULL DEFAULT 0,
  \`percentage\` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  \`answers_json\` LONGTEXT NOT NULL,
  \`breakdown_json\` LONGTEXT DEFAULT NULL,
  \`program_type\` VARCHAR(50) DEFAULT 'master_trainer',
  \`emis_code\` VARCHAR(50) DEFAULT NULL,
  \`study_group\` VARCHAR(50) DEFAULT NULL,
  \`submitted_at\` VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`idx_sub_assessment_id\` (\`assessment_id\`),
  KEY \`idx_sub_phone\` (\`phone_number\`),
  KEY \`idx_sub_cohort\` (\`cohort_id\`),
  KEY \`idx_sub_program\` (\`program_type\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n`);

  let submissions = db.prepare("SELECT * FROM assessment_submissions ORDER BY id ASC").all();
  if (submissions.length > 0) {
    sqlLines.push("INSERT INTO `assessment_submissions` (`id`, `assessment_id`, `registration_id`, `officer_name`, `phone_number`, `cohort_id`, `score`, `total_points`, `percentage`, `answers_json`, `breakdown_json`, `program_type`, `emis_code`, `study_group`, `submitted_at`) VALUES");
    const sRows = submissions.map(s => 
      `(${s.id}, ${s.assessment_id}, ${s.registration_id || 'NULL'}, ${escapeSql(s.officer_name)}, ${escapeSql(s.phone_number)}, ${s.cohort_id || 'NULL'}, ${s.score}, ${s.total_points}, ${s.percentage}, ${escapeSql(s.answers_json)}, ${escapeSql(s.breakdown_json || '[]')}, ${escapeSql(s.program_type || 'master_trainer')}, ${escapeSql(s.emis_code)}, ${escapeSql(s.study_group)}, ${escapeSql(s.submitted_at)})`
    );
    sqlLines.push(sRows.join(",\n") + ";\n");
  }

  sqlLines.push("SET FOREIGN_KEY_CHECKS = 1;");

  fs.writeFileSync(outputFile, sqlLines.join("\n"), "utf8");
  const stats = fs.statSync(outputFile);
  console.log(`\n SUCCESS! Wrote ${stats.size} bytes to ${outputFile}`);
}

main().catch(err => {
  console.error("FATAL ERROR during MySQL export:", err);
  process.exit(1);
});
