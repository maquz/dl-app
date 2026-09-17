const express = require("express");
const XLSX = require("xlsx");
const db = require("../db");
const adminAuth = require("../middleware/adminAuth");
const { findNextAvailableCohort, findCohortForDistrict } = require("./cohorts");

const router = express.Router();

const VALID_ROLES = [
  "DL Master Trainer - Numeracy (Math)",
  "DL Master Trainer - Literacy (English)",
  "DL Master Trainer - IT Person (DL Dashboard)",
];

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

function generateRefCode(id, region) {
  const regCode = (region || "GES").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return `DL-2026-${regCode}-${String(id).padStart(4, "0")}`;
}

function validateRegistration(body) {
  const errors = {};

  if (!body.officerName || !body.officerName.trim()) {
    errors.officerName = "Name of officer is required.";
  }

  if (!body.sex || !["Male", "Female"].includes(body.sex)) {
    errors.sex = "Please select a sex.";
  }

  if (!body.phoneNumber || !PHONE_REGEX.test(body.phoneNumber)) {
    errors.phoneNumber = "Phone number must be in the format 000-000-0000 (e.g. 024-498-9910).";
  }

  if (body.email && body.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!body.region || !body.region.trim()) {
    errors.region = "Please select a region.";
  }

  if (!body.district || !body.district.trim()) {
    errors.district = "Please select a district.";
  }

  if (!body.institutionName || !body.institutionName.trim()) {
    errors.institutionName = "Full name of institution is required.";
  }

  if (!Array.isArray(body.roles) || body.roles.length === 0) {
    errors.roles = "Please select at least one nominated role.";
  } else if (!body.roles.every((r) => VALID_ROLES.includes(r))) {
    errors.roles = "One or more selected roles are invalid.";
  }

  return errors;
}


function formatNomineeRecord(row) {
  if (!row) return null;
  const cohort = row.cohort_id ? db.prepare("SELECT * FROM cohorts WHERE id = ?").get(row.cohort_id) : null;
  const regCode = (row.region || "GES").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return {
    id: row.id,
    referenceCode: `DL-2026-${regCode}-${String(row.id).padStart(4, "0")}`,
    officerName: row.officer_name,
    sex: row.sex,
    phoneNumber: row.phone_number,
    email: row.email,
    region: row.region,
    district: row.district,
    institutionName: row.institution_name,
    roles: JSON.parse(row.roles || "[]"),
    cohortId: row.cohort_id,
    cohortName: cohort ? cohort.name : (row.cohort_id ? `Cohort ${row.cohort_id}` : "Cohort 1"),
    arrivalDate: row.arrival_date || (cohort ? cohort.arrival_date : "Sunday, 20/09/2026"),
    startDate: cohort ? cohort.start_date : "Monday, 21/09/2026",
    endDate: cohort ? cohort.end_date : "Tuesday, 22/09/2026",
    departureDate: cohort ? cohort.departure_date : "Wednesday, 23/09/2026",
    attendanceStatus: row.attendance_status || "Registered",
    submittedAt: row.submitted_at,
  };
}

// GET /api/registrations/my-nomination - Check if an officer is already registered
router.get("/my-nomination", (req, res) => {
  const phone = (req.query.phone || req.query.phoneNumber || "").trim();
  const email = (req.query.email || "").trim();
  const name = (req.query.name || req.query.officerName || "").trim();

  if (!phone && !email && !name) {
    return res.json({ hasRegistered: false, nominee: null });
  }

  let row = null;
  if (phone) {
    row = db.prepare("SELECT * FROM registrations WHERE phone_number = ?").get(phone);
  }
  if (!row && email) {
    row = db.prepare("SELECT * FROM registrations WHERE LOWER(email) = LOWER(?)").get(email);
  }
  if (!row && name && phone) {
    row = db.prepare("SELECT * FROM registrations WHERE LOWER(officer_name) = LOWER(?) AND phone_number = ?").get(name, phone);
  }

  if (row) {
    return res.json({ hasRegistered: true, nominee: formatNomineeRecord(row) });
  }

  return res.json({ hasRegistered: false, nominee: null });
});

// POST /api/registrations - submit a new registration (public)
router.post("/", (req, res) => {
  const errors = validateRegistration(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const {
    officerName,
    sex,
    phoneNumber,
    email,
    region,
    district,
    institutionName,
    roles,
    cohortId,
  } = req.body;

  const formattedEmail = email && email.trim() ? email.trim() : null;

  // Duplicate check on phone number or email
  let existing = db
    .prepare("SELECT * FROM registrations WHERE phone_number = ?")
    .get(phoneNumber.trim());

  if (!existing && formattedEmail) {
    existing = db
      .prepare("SELECT * FROM registrations WHERE LOWER(email) = LOWER(?)")
      .get(formattedEmail);
  }

  if (existing) {
    const nominee = formatNomineeRecord(existing);
    return res.status(409).json({
      error: `A nomination registration with phone "${phoneNumber}" already exists for ${existing.officer_name}.`,
      existingReference: generateRefCode(existing.id, existing.region),
      hasRegistered: true,
      nominee,
    });
  }

  // Determine cohort allocation based on official GES district schedule
  let allocatedCohort = null;
  if (cohortId) {
    allocatedCohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(cohortId);
  }
  if (!allocatedCohort) {
    allocatedCohort = findCohortForDistrict(region, district);
  }
  if (!allocatedCohort) {
    allocatedCohort = findNextAvailableCohort();
  }

  const assignedCohortId = allocatedCohort ? allocatedCohort.id : null;
  const arrivalDate = allocatedCohort ? allocatedCohort.arrival_date : null;

  const stmt = db.prepare(`
    INSERT INTO registrations
      (officer_name, sex, phone_number, email, region, district, institution_name, roles, cohort_id, arrival_date, attendance_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Registered')
  `);

  const info = stmt.run(
    officerName.trim(),
    sex,
    phoneNumber.trim(),
    formattedEmail,
    region.trim(),
    district.trim(),
    institutionName.trim(),
    JSON.stringify(roles),
    assignedCohortId,
    arrivalDate
  );

  const insertedId = Number(info.lastInsertRowid);
  const referenceCode = generateRefCode(insertedId, region);

  return res.status(201).json({
    id: insertedId,
    referenceCode,
    message: "Registration submitted successfully.",
    nominee: {
      id: insertedId,
      referenceCode,
      officerName: officerName.trim(),
      sex,
      phoneNumber: phoneNumber.trim(),
      email: formattedEmail,
      region: region.trim(),
      district: district.trim(),
      institutionName: institutionName.trim(),
      roles,
      cohortId: assignedCohortId,
      cohortName: allocatedCohort ? allocatedCohort.name : null,
      arrivalDate: allocatedCohort ? allocatedCohort.arrival_date : null,
      startDate: allocatedCohort ? allocatedCohort.start_date : null,
      endDate: allocatedCohort ? allocatedCohort.end_date : null,
      departureDate: allocatedCohort ? allocatedCohort.departure_date : null,
      attendanceStatus: "Registered",
      submittedAt: new Date().toISOString(),
    },
  });
});

// GET /api/registrations/stats - summary KPI and analytics (admin only)
router.get("/stats", adminAuth, (req, res) => {
  const allRows = db.prepare("SELECT * FROM registrations").all();

  const total = allRows.length;
  let maleCount = 0;
  let femaleCount = 0;
  let attendedCount = 0;
  const roleCounts = {
    "DL Master Trainer - Numeracy (Math)": 0,
    "DL Master Trainer - Literacy (English)": 0,
    "DL Master Trainer - IT Person (DL Dashboard)": 0,
  };
  const regionCounts = {};

  for (const row of allRows) {
    if (row.sex === "Male") maleCount++;
    if (row.sex === "Female") femaleCount++;
    if (row.attendance_status === "Attended") attendedCount++;

    const roles = JSON.parse(row.roles || "[]");
    for (const r of roles) {
      if (roleCounts[r] !== undefined) {
        roleCounts[r]++;
      }
    }

    if (row.region) {
      regionCounts[row.region] = (regionCounts[row.region] || 0) + 1;
    }
  }

  res.json({
    total,
    maleCount,
    femaleCount,
    attendedCount,
    roleCounts,
    regionCounts,
  });
});

// GET /api/registrations - list/search/filter (admin only)
router.get("/", adminAuth, (req, res) => {
  const { q, region, district, role, cohort_id, attendance_status } = req.query;

  let sql = `
    SELECT 
      r.*,
      c.name as cohort_name,
      c.arrival_date as cohort_arrival_date,
      c.start_date as cohort_start_date,
      c.end_date as cohort_end_date,
      c.departure_date as cohort_departure_date,
      c.expected_participants as cohort_capacity
    FROM registrations r
    LEFT JOIN cohorts c ON r.cohort_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    sql += " AND (r.officer_name LIKE ? OR r.phone_number LIKE ? OR r.email LIKE ? OR r.institution_name LIKE ? OR c.name LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }

  if (region) {
    sql += " AND r.region = ?";
    params.push(region);
  }

  if (district) {
    sql += " AND r.district = ?";
    params.push(district);
  }

  if (cohort_id) {
    sql += " AND r.cohort_id = ?";
    params.push(cohort_id);
  }

  if (attendance_status) {
    sql += " AND r.attendance_status = ?";
    params.push(attendance_status);
  }

  sql += " ORDER BY r.submitted_at DESC";

  let rows = db.prepare(sql).all(...params);

  rows = rows.map((r) => ({
    ...r,
    referenceCode: generateRefCode(r.id, r.region),
    roles: JSON.parse(r.roles),
  }));

  if (role) {
    rows = rows.filter((r) => r.roles.includes(role));
  }

  res.json({ count: rows.length, registrations: rows });
});

// PUT /api/registrations/:id - update a registration (admin only)
router.put("/:id", adminAuth, (req, res) => {
  const id = req.params.id;
  const errors = validateRegistration(req.body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const {
    officerName,
    sex,
    phoneNumber,
    email,
    region,
    district,
    institutionName,
    roles,
    cohortId,
    attendanceStatus,
    checkInNotes,
  } = req.body;

  // Check if duplicate with other record
  const existing = db
    .prepare("SELECT id FROM registrations WHERE phone_number = ? AND id != ?")
    .get(phoneNumber.trim(), id);

  if (existing) {
    return res.status(409).json({
      error: `Another registration already uses the phone number "${phoneNumber}".`,
    });
  }

  let cohort = null;
  if (cohortId) {
    cohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(cohortId);
  }

  const arrivalDate = cohort ? cohort.arrival_date : req.body.arrivalDate || null;
  const validStatus = ["Registered", "Attended", "Absent", "Excused"].includes(attendanceStatus)
    ? attendanceStatus
    : "Registered";
  const attendedAt = validStatus === "Attended" ? (req.body.attendedAt || new Date().toISOString()) : null;

  const formattedEmail = email && email.trim() ? email.trim() : null;

  const stmt = db.prepare(`
    UPDATE registrations
    SET 
      officer_name = ?, 
      sex = ?, 
      phone_number = ?, 
      email = ?, 
      region = ?, 
      district = ?, 
      institution_name = ?, 
      roles = ?,
      cohort_id = ?,
      arrival_date = ?,
      attendance_status = ?,
      attended_at = ?,
      check_in_notes = ?
    WHERE id = ?
  `);

  const info = stmt.run(
    officerName.trim(),
    sex,
    phoneNumber.trim(),
    formattedEmail,
    region.trim(),
    district.trim(),
    institutionName.trim(),
    JSON.stringify(roles),
    cohortId ? Number(cohortId) : null,
    arrivalDate,
    validStatus,
    attendedAt,
    checkInNotes ? checkInNotes.trim() : null,
    id
  );

  if (info.changes === 0) {
    return res.status(404).json({ error: "Registration not found." });
  }

  return res.json({
    message: "Registration updated successfully.",
    nominee: {
      id: Number(id),
      referenceCode: generateRefCode(id, region),
      officer_name: officerName.trim(),
      sex,
      phone_number: phoneNumber.trim(),
      email: formattedEmail,
      region: region.trim(),
      district: district.trim(),
      institution_name: institutionName.trim(),
      roles,
      cohort_id: cohortId ? Number(cohortId) : null,
      cohort_name: cohort ? cohort.name : null,
      arrival_date: arrivalDate,
      attendance_status: validStatus,
      attended_at: attendedAt,
      check_in_notes: checkInNotes || null,
    },
  });
});

// DELETE /api/registrations/:id - remove a registration (admin only)
router.delete("/:id", adminAuth, (req, res) => {
  const info = db.prepare("DELETE FROM registrations WHERE id = ?").run(req.params.id);
  if (info.changes === 0) {
    return res.status(404).json({ error: "Registration not found." });
  }
  res.json({ message: "Registration deleted." });
});

function getAllForExport() {
  const rows = db.prepare(`
    SELECT 
      r.*,
      c.name as cohort_name,
      c.arrival_date as cohort_arrival_date,
      c.start_date as cohort_start_date,
      c.end_date as cohort_end_date,
      c.departure_date as cohort_departure_date
    FROM registrations r
    LEFT JOIN cohorts c ON r.cohort_id = c.id
    ORDER BY r.submitted_at DESC
  `).all();

  return rows.map((r) => ({
    "Reference Code": generateRefCode(r.id, r.region),
    "Name of Officer": r.officer_name,
    "Email Address": r.email || "",
    Sex: r.sex,
    "Phone Number": r.phone_number,
    Region: r.region,
    District: r.district,
    "Institution / Place of Work": r.institution_name,
    "Nominated Roles": JSON.parse(r.roles).join("; "),
    "Assigned Cohort": r.cohort_name || "Unassigned",
    "Arrival Date": r.arrival_date || r.cohort_arrival_date || "",
    "Training Start Date": r.cohort_start_date || "",
    "Training End Date": r.cohort_end_date || "",
    "Departure Date": r.cohort_departure_date || "",
    "Attendance Status": r.attendance_status || "Registered",
    "Attended Date/Time": r.attended_at || "",
    "Submitted At": r.submitted_at,
  }));
}

// GET /api/registrations/export/csv (admin only)
router.get("/export/csv", adminAuth, (req, res) => {
  const data = getAllForExport();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=dl_master_trainer_registrations.csv");
  res.send(csv);
});

// GET /api/registrations/export/xlsx (admin only)
router.get("/export/xlsx", adminAuth, (req, res) => {
  const data = getAllForExport();
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Registrations");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=dl_master_trainer_registrations.xlsx");
  res.send(buffer);
});

// GET /api/registrations/meta/regions - list of valid regions + districts (public)
router.get("/meta/regions", (req, res) => {
  const districts = require("../data/districts.json");
  res.json(districts);
});

module.exports = router;

