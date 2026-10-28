const express = require("express");
const db = require("../db");
const supabase = require("../supabase");

const router = express.Router();

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const VALID_DESIGNATIONS = ["Headteacher", "Teacher"];

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
    sql += " AND LOWER(group_id) = LOWER(?)";
    params.push(group_id.trim());
  }
  if (search) {
    sql += " AND (LOWER(school_name) LIKE LOWER(?) OR emis_code LIKE ?)";
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  sql += " ORDER BY region ASC, district ASC, school_name ASC";

  const schools = db.prepare(sql).all(...params);
  res.json({ count: schools.length, schools });
});

// GET /api/sample-schools/hierarchy - Distinct regions and cascading districts
router.get("/hierarchy", (req, res) => {
  const rows = db.prepare("SELECT DISTINCT region, district FROM sample_schools ORDER BY region ASC, district ASC").all();

  const regionsSet = new Set();
  const districtsByRegion = {};

  rows.forEach((r) => {
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

  // Find school record
  let school = null;
  if (schoolId) {
    school = db.prepare("SELECT * FROM sample_schools WHERE id = ?").get(schoolId);
  }
  if (!school && emisCode) {
    school = db.prepare("SELECT * FROM sample_schools WHERE emis_code = ?").get(String(emisCode).trim());
  }

  if (!school) {
    errors.schoolId = "Please select a valid school from the 210 sample schools list.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const cleanPhone = String(phoneNumber).trim();
  const digits = cleanPhone.replace(/\D/g, "");

  // Check if participant already registered under sample_schools
  const existingLocal = db.prepare(`
    SELECT * FROM registrations 
    WHERE program_type = 'sample_school' AND (
      phone_number = ? OR REPLACE(REPLACE(phone_number, '-', ''), ' ', '') = ?
    )
  `).get(cleanPhone, digits);

  if (existingLocal) {
    const regCode = (existingLocal.region || "SCH").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    return res.status(200).json({
      message: "You are already registered for the Sample Schools Workshop.",
      alreadyRegistered: true,
      nominee: {
        id: existingLocal.id,
        referenceCode: `DL-SCH-2026-${regCode}-${String(existingLocal.id).padStart(4, "0")}`,
        officerName: existingLocal.officer_name,
        sex: existingLocal.sex,
        phoneNumber: existingLocal.phone_number,
        email: existingLocal.email,
        region: existingLocal.region,
        district: existingLocal.district,
        institutionName: existingLocal.school_name || existingLocal.institution_name,
        schoolName: existingLocal.school_name || existingLocal.institution_name,
        emisCode: existingLocal.emis_code,
        studyGroup: existingLocal.study_group,
        designation: existingLocal.designation || designation,
        roles: [existingLocal.designation || designation],
        programType: "sample_school",
        submittedAt: existingLocal.submitted_at,
      },
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

  // Insert into SQLite
  let insertedId = null;
  try {
    const stmt = db.prepare(`
      INSERT INTO registrations (
        officer_name, sex, phone_number, email, region, district, institution_name,
        roles, program_type, school_name, emis_code, study_group, designation, sample_school_id, check_in_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
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
      checkInNotesStr
    );
    insertedId = info.lastInsertRowid;
  } catch (err) {
    console.error("Local SQLite sample school registration error:", err);
    return res.status(500).json({ error: "Failed to save registration locally." });
  }

  // Sync to Supabase
  if (supabase) {
    try {
      await supabase.from("registrations").insert({
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
      });
    } catch (supaErr) {
      console.warn("Supabase sample school registration sync error:", supaErr.message);
    }
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
    submittedAt: new Date().toISOString(),
  };

  res.status(201).json({
    message: "Registration successful! Welcome to the GALOP AF2 Sample Schools Workshop.",
    nominee,
  });
});

// GET /api/sample-schools/stats - Summary statistics for Admin/Trainer dashboard
router.get("/stats", (req, res) => {
  const totalSchools = 210;

  const regs = db.prepare(`
    SELECT * FROM registrations 
    WHERE program_type = 'sample_school'
  `).all();

  const totalRegistered = regs.length;
  let headteachers = 0;
  let teachers = 0;
  const byGroup = { "Group 1": 0, "Group 2": 0, "Group 3": 0 };
  const byRegion = {};
  const schoolsRepresented = new Set();

  regs.forEach((r) => {
    let des = r.designation;
    if (!des && r.check_in_notes && r.check_in_notes.startsWith("{")) {
      try { des = JSON.parse(r.check_in_notes).designation; } catch(e) {}
    }
    if (des === "Headteacher") headteachers++;
    else teachers++;

    let grp = r.study_group;
    if (!grp && r.check_in_notes && r.check_in_notes.startsWith("{")) {
      try { grp = JSON.parse(r.check_in_notes).study_group; } catch(e) {}
    }
    if (grp && byGroup[grp] !== undefined) byGroup[grp]++;

    if (r.region) {
      byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    }

    let emis = r.emis_code;
    if (!emis && r.check_in_notes && r.check_in_notes.startsWith("{")) {
      try { emis = JSON.parse(r.check_in_notes).emis_code; } catch(e) {}
    }
    if (emis) schoolsRepresented.add(emis);
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
  });
});

router.get("/participants", (req, res) => {
  const { region, district, group_id, designation, search } = req.query;
  let sql = `
    SELECT r.*, s.school_name as official_school_name, s.group_id as official_group_id, s.group_name, s.treatment
    FROM registrations r
    LEFT JOIN sample_schools s ON r.sample_school_id = s.id OR r.emis_code = s.emis_code
    WHERE r.program_type = 'sample_school'
  `;
  const params = [];
  if (region) {
    sql += " AND LOWER(r.region) = LOWER(?)";
    params.push(region.trim());
  }
  if (district) {
    sql += " AND LOWER(r.district) = LOWER(?)";
    params.push(district.trim());
  }
  if (group_id) {
    sql += " AND (LOWER(r.study_group) = LOWER(?) OR LOWER(s.group_id) = LOWER(?))";
    params.push(group_id.trim(), group_id.trim());
  }
  if (designation) {
    sql += " AND LOWER(r.designation) = LOWER(?)";
    params.push(designation.trim());
  }
  if (search) {
    sql += " AND (LOWER(r.officer_name) LIKE LOWER(?) OR r.phone_number LIKE ? OR r.school_name LIKE ? OR r.emis_code LIKE ?)";
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }
  sql += " ORDER BY r.submitted_at DESC";
  const rows = db.prepare(sql).all(...params);
  res.json({
    count: rows.length,
    participants: rows.map(r => {
      let role = r.designation;
      if (!role && r.roles) {
        try { role = JSON.parse(r.roles)[0]; } catch(e) { role = r.roles; }
      }
      return {
        id: r.id,
        referenceCode: `DL-SCH-2026-${(r.region || 'SCH').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase()}-${String(r.id).padStart(4, '0')}`,
        officerName: r.officer_name,
        sex: r.sex,
        phoneNumber: r.phone_number,
        email: r.email,
        region: r.region,
        district: r.district,
        schoolName: r.official_school_name || r.school_name || r.institution_name,
        emisCode: r.emis_code,
        studyGroup: r.official_group_id || r.study_group || 'Group 1',
        groupName: r.group_name,
        treatment: r.treatment,
        designation: role || 'Teacher',
        attendanceStatus: r.attendance_status || 'Registered',
        submittedAt: r.submitted_at,
      };
    })
  });
});

module.exports = router;
