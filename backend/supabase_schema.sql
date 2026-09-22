-- ==============================================================================
-- GHANA EDUCATION SERVICE (GES) - DIFFERENTIATED LEARNING (DL) PROGRAMME
-- SUPABASE POSTGRESQL SCHEMA INITIALIZATION & MIGRATION SCRIPT
-- ==============================================================================

-- 1. COHORTS TABLE
CREATE TABLE IF NOT EXISTS cohorts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  arrival_date TEXT NOT NULL,
  departure_date TEXT NOT NULL,
  max_capacity INTEGER NOT NULL DEFAULT 150,
  start_date_iso TEXT,
  end_date_iso TEXT,
  arrival_date_iso TEXT,
  departure_date_iso TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. NATIONAL MASTER TRAINERS (FACILITATORS)
CREATE TABLE IF NOT EXISTS national_trainers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  place_of_work TEXT,
  schedule_role TEXT NOT NULL DEFAULT 'Teacher',
  contact_number TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. SYSTEM ADMINISTRATORS
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone_number TEXT,
  role TEXT NOT NULL DEFAULT 'Admin' CHECK (role IN ('Super Admin', 'Admin', 'Reviewer')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. NOMINATED OFFICERS AUTH ACCOUNTS
CREATE TABLE IF NOT EXISTS officers (
  id SERIAL PRIMARY KEY,
  officer_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  email TEXT,
  staff_id TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. NOMINEE REGISTRATIONS
CREATE TABLE IF NOT EXISTS registrations (
  id SERIAL PRIMARY KEY,
  officer_name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  phone_number TEXT NOT NULL,
  email TEXT,
  region TEXT NOT NULL,
  district TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  roles JSONB NOT NULL DEFAULT '[]'::jsonb,
  cohort_id INTEGER REFERENCES cohorts(id) ON DELETE SET NULL,
  arrival_date TEXT,
  attendance_status TEXT NOT NULL DEFAULT 'Registered' CHECK (attendance_status IN ('Registered', 'Attended', 'Absent', 'Excused')),
  check_in_notes TEXT,
  tablet_imei TEXT,
  checked_in_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ASSESSMENTS (PRE-TEST, POST-TEST, QUIZZES)
CREATE TABLE IF NOT EXISTS assessments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Pre-Test', 'Post-Test', 'Quiz')),
  description TEXT,
  time_limit_minutes INTEGER NOT NULL DEFAULT 20,
  is_active INTEGER NOT NULL DEFAULT 1,
  cohort_id INTEGER REFERENCES cohorts(id) ON DELETE SET NULL,
  created_by_trainer_id INTEGER REFERENCES national_trainers(id) ON DELETE SET NULL,
  unlock_time TEXT NOT NULL DEFAULT '19:00',
  unlock_date_type TEXT NOT NULL DEFAULT 'arrival_date',
  custom_unlock_datetime TEXT,
  custom_close_datetime TEXT,
  lock_mode TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ASSESSMENT QUESTIONS
CREATE TABLE IF NOT EXISTS assessment_questions (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false')),
  options_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_answer TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 1
);

-- 8. ASSESSMENT SUBMISSIONS & RESULTS
CREATE TABLE IF NOT EXISTS assessment_submissions (
  id SERIAL PRIMARY KEY,
  assessment_id INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  officer_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  cohort_id INTEGER REFERENCES cohorts(id) ON DELETE SET NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_points INTEGER NOT NULL DEFAULT 0,
  percentage NUMERIC(5, 2) NOT NULL DEFAULT 0,
  answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  breakdown_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES FOR HIGH PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(phone_number);
CREATE INDEX IF NOT EXISTS idx_registrations_email ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_registrations_cohort ON registrations(cohort_id);
CREATE INDEX IF NOT EXISTS idx_assessment_questions_assessment_id ON assessment_questions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_submissions_assessment_id ON assessment_submissions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_officers_phone ON officers(phone_number);
