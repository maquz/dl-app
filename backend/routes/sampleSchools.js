const express = require("express");
const db = require("../db");
const supabase = require("../supabase");
const sampleSchoolsData = require("../data/sample_schools.json");

const router = express.Router();

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const VALID_DESIGNATIONS = ["Headteacher", "Teacher"];

// Index 210 sample schools for instant O(1) in-memory lookups
const schoolsByEmis = {};
const schoolsById = {};
sampleSchoolsData.forEach((s) => {
  if (s.emis_code) schoolsByEmis[String(s.emis_code).trim()] = s;
  if (s.id) schoolsById[Number(s.id)] = s;
});

function isSampleSchoolRegistration(r) {
  if (!r) return false;
  if (r.program_type === "sample_school") return true;
  if (r.check_in_notes) {
    if (typeof r.check_in_notes === "string" && r.check_in_notes.includes("sample_school")) return true;
    if (typeof r.check_in_notes === "object" && r.check_in_notes.program_type === "sample_school") return true;
  }
  let rolesArr = [];
  if (Array.isArray(r.roles)) rolesArr = r.roles;
  else if (typeof r.roles === "string") {
    try { rolesArr = JSON.parse(r.roles); } catch (e) { rolesArr = [r.roles]; }
  }
  if (rolesArr.some((role) => role === "Headteacher" || role === "Teacher")) return true;
  if (r.designation === "Headteacher" || r.designation === "Teacher") return true;
  return false;
}

function parseSampleSchoolParticipant(r) {
  let notes = {};
  if (r.check_in_notes) {
    if (typeof r.check_in_notes === "object") notes = r.check_in_notes;
    else if (typeof r.check_in_notes === "string" && r.check_in_notes.startsWith("{")) {
      try { notes = JSON.parse(r.check_in_notes); } catch (e) {}
    }
  }

  let designation = r.designation || notes.designation;
  if (!designation && r.roles) {
    let rolesArr = Array.isArray(r.roles) ? r.roles : [];
    if (!rolesArr.length && typeof r.roles === "string") {
      try { rolesArr = JSON.parse(r.roles); } catch (e) { rolesArr = [r.roles]; }
    }
    if (rolesArr.includes("Headteacher")) designation = "Headteacher";
    else if (rolesArr.includes("Teacher")) designation = "Teacher";
  }
  if (!designation) designation = "Teacher";

  let emisCode = r.emis_code || notes.emis_code;
  if (!emisCode && r.institution_name) {
    const m = r.institution_name.match(/EMIS:\s*([0-9A-Za-z]+)/i);
    if (m) emisCode = m[1];
  }
  emisCode = emisCode ? String(emisCode).trim() : "";

  const school =
    (emisCode && schoolsByEmis[emisCode]) ||
    (r.sample_school_id && schoolsById[Number(r.sample_school_id)]) ||
    null;

  const studyGroup = (school && school.group_id) || r.study_group || notes.study_group || "Group 1";
  const groupName = (school && school.group_name) || notes.group_name || "";
  const treatment = (school && school.treatment) || notes.treatment || "";
  const schoolName =
    (school && school.school_name) ||
    r.school_name ||
    notes.school_name ||
    (r.institution_name ? r.institution_name.replace(/\s*\(EMIS:.*?\)/i, "").trim() : "");
  const region = r.region || (school && school.region) || "";
  const district = r.district || (school && school.district) || "";

  const regCode = (region || "SCH").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  const id = r.id || 1;

  return {
    id,
    referenceCode: `DL-SCH-2026-${regCode}-${String(id).padStart(4, "0")}`,
    officerName: r.officer_name,
    sex: r.sex || "Male",
    phoneNumber: r.phone_number,
    email: r.email || null,
    region,
    district,
    schoolName,
    emisCode: emisCode || (school && school.emis_code) || "",
    studyGroup,
    groupName,
    treatment,
    designation,
    attendanceStatus: r.attendance_status || "Registered",
    submittedAt: r.submitted_at || new Date().toISOString(),
  };
}

async function getAllSampleSchoolParticipants() {
  const mapByPhone = new Map();

  // 1. Fetch from Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase.from("registrations").select("*").limit(100000);
      if (!error && Array.isArray(data)) {
        for (const row of data) {
          if (isSampleSchoolRegistration(row)) {
            const p = parseSampleSchoolParticipant(row);
            const digits = (p.phoneNumber || "").replace(/\D/g, "");
            const key = digits || String(p.id);
            mapByPhone.set(key, p);

            // Sync into local SQLite cache
            try {
              db.prepare(`
                INSERT OR REPLACE INTO registrations (
                  id, officer_name, sex, phone_number, email, region, district, institution_name,
                  roles, program_type, school_name, emis_code, study_group, designation, sample_school_id, check_in_notes, submitted_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(
                p.id,
                p.officerName,
                p.sex,
                p.phoneNumber,
                p.email,
                p.region,
                p.district,
                p.schoolName,
                JSON.stringify([p.designation]),
                "sample_school",
                p.schoolName,
                p.emisCode,
                p.studyGroup,
                p.designation,
                null,
                JSON.stringify({
                  program_type: "sample_school",
                  school_name: p.schoolName,
                  emis_code: p.emisCode,
                  study_group: p.studyGroup,
                  group_name: p.groupName,
                  treatment: p.treatment,
                  designation: p.designation,
                }),
                p.submittedAt
              );
            } catch (syncErr) {
              // Ignore unique/sync errors
            }
          }
        }
      }
    } catch (supaErr) {
      console.warn("Supabase fetch sample schools participants error:", supaErr.message);
    }
  }

  // 2. Query local SQLite
  try {
    const localRows = db.prepare("SELECT * FROM registrations WHERE program_type = 'sample_school'").all();
    for (const row of localRows) {
      const p = parseSampleSchoolParticipant(row);
      const digits = (p.phoneNumber || "").replace(/\D/g, "");
      const key = digits || String(p.id);
      if (!mapByPhone.has(key)) {
        mapByPhone.set(key, p);
      }
    }
  } catch (dbErr) {
    console.warn("SQLite fetch sample schools participants error:", dbErr.message);
  }

  return Array.from(mapByPhone.values());
}

// GET /api/sample-schools - List sample schools with optional filters
router.get("/", (req, res) => {
  const { region, district, group_id, search } = req.query;

  let sql = "SELECT * FROM sample_schools WHERE 1=1";
  const params = [];

  if (region) {
    sql += " AND LOWER(region) = LOWER(?)";
    params.push(region.trim());
  }
  if (district) {
    sql += " AND LOWER(district) = LOWER(?)";
    params.push(district.trim());
  }
  if (group_id) {
    const groups = group_id.split(",").map((g) => g.trim().toLowerCase());
    const placeholders = groups.map(() => "LOWER(group_id) = ?").join(" OR ");
    sql += ` AND (${placeholders})`;
    params.push(...groups);
  }
  if (search) {
    sql += " AND (LOWER(school_name) LIKE LOWER(?) OR emis_code LIKE ?)";
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  sql += " ORDER BY region ASC, district ASC, school_name ASC";

  let schools = [];
  try {
    schools = db.prepare(sql).all(...params);
  } catch (e) {
    // Fallback to sampleSchoolsData
    schools = sampleSchoolsData.filter((s) => {
      if (region && s.region.toLowerCase() !== region.trim().toLowerCase()) return false;
      if (district && s.district.toLowerCase() !== district.trim().toLowerCase()) return false;
      if (group_id) {
        const groups = group_id.split(",").map((g) => g.trim().toLowerCase());
        if (!groups.includes(s.group_id.toLowerCase())) return false;
      }
      if (search) {
        const term = search.trim().toLowerCase();
        if (!s.school_name.toLowerCase().includes(term) && !s.emis_code.includes(term)) return false;
      }
      return true;
    });
  }

  res.json({ count: schools.length, schools });
});

// GET /api/sample-schools/hierarchy - Distinct regions and cascading districts
router.get("/hierarchy", (req, res) => {
  const regionsSet = new Set();
  const districtsByRegion = {};

  sampleSchoolsData.forEach((r) => {
    regionsSet.add(r.region);
    if (!districtsByRegion[r.region]) {
      districtsByRegion[r.region] = [];
    }
    if (!districtsByRegion[r.region].includes(r.district)) {
      districtsByRegion[r.region].push(r.district);
    }
  });

  res.json({
    regions: Array.from(regionsSet),
    districtsByRegion,
  });
});

// POST /api/sample-schools/register - Participant sign-up for 210 Sample Schools Workshop
router.post("/register", async (req, res) => {
  const {
    officerName,
    sex,
    phoneNumber,
    email,
    designation,
    schoolId,
    emisCode,
  } = req.body;

  const errors = {};

  if (!officerName || !officerName.trim()) {
    errors.officerName = "Full name of participant is required.";
  }

  if (!sex || !["Male", "Female"].includes(sex)) {
    errors.sex = "Please select sex (Male or Female).";
  }

  if (!phoneNumber || !PHONE_REGEX.test(phoneNumber)) {
    errors.phoneNumber = "Phone number must be in the format 000-000-0000 (e.g. 024-498-9910).";
  }

  if (!designation || !VALID_DESIGNATIONS.includes(designation)) {
    errors.designation = "Designation must be strictly either 'Headteacher' or 'Teacher'.";
  }

  // Find school record from memory or database
  let school = null;
  if (schoolId) {
    school = schoolsById[Number(schoolId)] || db.prepare("SELECT * FROM sample_schools WHERE id = ?").get(schoolId);
  }
  if (!school && emisCode) {
    school = schoolsByEmis[String(emisCode).trim()] || db.prepare("SELECT * FROM sample_schools WHERE emis_code = ?").get(String(emisCode).trim());
  }

  if (!school) {
    errors.schoolId = "Please select a valid school from the 210 sample schools list.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const cleanPhone = String(phoneNumber).trim();
  const digits = cleanPhone.replace(/\D/g, "");

  // Check if participant already registered
  const existingList = await getAllSampleSchoolParticipants();
  const existing = existingList.find((p) => {
    const pDigits = (p.phoneNumber || "").replace(/\D/g, "");
    return p.phoneNumber === cleanPhone || (digits && pDigits === digits);
  });

  if (existing) {
    return res.status(200).json({
      message: "You are already registered for the Sample Schools Workshop.",
      alreadyRegistered: true,
      nominee: existing,
    });
  }

  const checkInNotesObj = {
    program_type: "sample_school",
    school_name: school.school_name,
    emis_code: school.emis_code,
    study_group: school.group_id,
    group_name: school.group_name,
    treatment: school.treatment,
    designation,
  };
  const checkInNotesStr = JSON.stringify(checkInNotesObj);
  const rolesJson = JSON.stringify([designation]);
  const submittedAt = new Date().toISOString();

  // Explicit ID calculation to bypass broken Postgres sequence in Supabase
  let nextId = 801;
  if (supabase) {
    try {
      const { data: maxRow } = await supabase
        .from("registrations")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxRow && maxRow.id) {
        nextId = maxRow.id + 1;
      }
    } catch (e) {
      console.warn("Error getting Supabase max id:", e.message);
    }
  } else {
    try {
      const maxLocal = db.prepare("SELECT MAX(id) as maxId FROM registrations").get();
      if (maxLocal && maxLocal.maxId) nextId = maxLocal.maxId + 1;
    } catch (e) {}
  }

  let insertedId = nextId;

  // Insert into Supabase
  if (supabase) {
    try {
      const supaPayload = {
        id: nextId,
        officer_name: officerName.trim(),
        sex,
        phone_number: cleanPhone,
        email: email ? email.trim() : null,
        region: school.region,
        district: school.district,
        institution_name: `${school.school_name} (EMIS: ${school.emis_code})`,
        roles: [designation],
        attendance_status: "Registered",
        check_in_notes: checkInNotesStr,
        submitted_at: submittedAt,
      };

      const { data: supaRow, error: supaErr } = await supabase
        .from("registrations")
        .insert(supaPayload)
        .select()
        .maybeSingle();

      if (supaErr) {
        console.error("Supabase sample school registration sync error:", supaErr.message);
      } else if (supaRow && supaRow.id) {
        insertedId = supaRow.id;
      }
    } catch (supaErr) {
      console.warn("Supabase sample school registration sync exception:", supaErr.message);
    }
  }

  // Insert into SQLite
  try {
    db.prepare(`
      INSERT OR REPLACE INTO registrations (
        id, officer_name, sex, phone_number, email, region, district, institution_name,
        roles, program_type, school_name, emis_code, study_group, designation, sample_school_id, check_in_notes, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      insertedId,
      officerName.trim(),
      sex,
      cleanPhone,
      email ? email.trim() : null,
      school.region,
      school.district,
      school.school_name,
      rolesJson,
      "sample_school",
      school.school_name,
      school.emis_code,
      school.group_id,
      designation,
      school.id,
      checkInNotesStr,
      submittedAt
    );
  } catch (err) {
    console.error("Local SQLite sample school registration error:", err);
  }

  const regCode = (school.region || "SCH").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  const nominee = {
    id: insertedId,
    referenceCode: `DL-SCH-2026-${regCode}-${String(insertedId).padStart(4, "0")}`,
    officerName: officerName.trim(),
    sex,
    phoneNumber: cleanPhone,
    email: email ? email.trim() : null,
    region: school.region,
    district: school.district,
    institutionName: school.school_name,
    schoolName: school.school_name,
    emisCode: school.emis_code,
    studyGroup: school.group_id,
    groupName: school.group_name,
    treatment: school.treatment,
    designation,
    roles: [designation],
    programType: "sample_school",
    submittedAt,
  };

  res.status(201).json({
    message: "Registration successful! Welcome to the GALOP AF2 Sample Schools Workshop.",
    nominee,
  });
});

// GET /api/sample-schools/stats - Summary statistics for Admin/Trainer dashboard
router.get("/stats", async (req, res) => {
  const totalSchools = 210;
  const participants = await getAllSampleSchoolParticipants();

  const totalRegistered = participants.length;
  let headteachers = 0;
  let teachers = 0;
  const byGroup = { "Group 1": 0, "Group 2": 0, "Group 3": 0 };
  const byRegion = {};
  const schoolsRepresented = new Set();
  const schoolCounts = {};

  participants.forEach((p) => {
    if (p.designation === "Headteacher") headteachers++;
    else teachers++;

    if (p.studyGroup && byGroup[p.studyGroup] !== undefined) {
      byGroup[p.studyGroup]++;
    }

    if (p.region) {
      byRegion[p.region] = (byRegion[p.region] || 0) + 1;
    }

    if (p.emisCode) {
      schoolsRepresented.add(p.emisCode);
      schoolCounts[p.emisCode] = (schoolCounts[p.emisCode] || 0) + 1;
    }
  });

  res.json({
    totalSchools,
    totalRegistered,
    schoolsRepresented: schoolsRepresented.size,
    coveragePct: ((schoolsRepresented.size / totalSchools) * 100).toFixed(1),
    byDesignation: {
      headteachers,
      teachers,
    },
    byGroup,
    byRegion,
    schoolEmisList: Array.from(schoolsRepresented),
    schoolCounts,
  });
});

// GET /api/sample-schools/participants - List of registered participants
router.get("/participants", async (req, res) => {
  const { region, district, group_id, designation, search, emis } = req.query;
  let participants = await getAllSampleSchoolParticipants();

  if (region) {
    participants = participants.filter(
      (p) => (p.region || "").toLowerCase() === region.trim().toLowerCase()
    );
  }
  if (district) {
    participants = participants.filter(
      (p) => (p.district || "").toLowerCase() === district.trim().toLowerCase()
    );
  }
  if (group_id) {
    const groups = group_id.split(",").map((g) => g.trim().toLowerCase());
    participants = participants.filter((p) =>
      groups.includes((p.studyGroup || "").toLowerCase())
    );
  }
  if (designation) {
    participants = participants.filter(
      (p) => (p.designation || "").toLowerCase() === designation.trim().toLowerCase()
    );
  }
  if (emis) {
    participants = participants.filter(
      (p) => String(p.emisCode).trim() === String(emis).trim()
    );
  }
  if (search) {
    const term = search.trim().toLowerCase();
    participants = participants.filter(
      (p) =>
        (p.officerName || "").toLowerCase().includes(term) ||
        (p.phoneNumber || "").includes(term) ||
        (p.schoolName || "").toLowerCase().includes(term) ||
        (p.emisCode || "").includes(term)
    );
  }

  // Sort newest registrations first
  participants.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  res.json({
    count: participants.length,
    participants,
  });
});

module.exports = router;
