const express = require("express");
const XLSX = require("xlsx");
const db = require("../db");
const supabase = require("../supabase");
const adminAuth = require("../middleware/adminAuth");
const { findNextAvailableCohort, findCohortForDistrict } = require("./cohorts");

const router = express.Router();

const VALID_ROLES = [
  "DL District Trainer - Numeracy (Math)",
  "DL District Trainer - Literacy (English)",
  "DL District Trainer - IT Person (DL Dashboard)",
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
  let rolesParsed = [];
  try {
    rolesParsed = typeof row.roles === "string" ? JSON.parse(row.roles || "[]") : (row.roles || []);
  } catch(e) {
    rolesParsed = [row.roles];
  }

  let cohort = null;
  if (row.cohort_id) {
    try {
      cohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(row.cohort_id);
    } catch(e) {}
  }

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
    roles: rolesParsed,
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

// GET /api/registrations/meta/regions - List all regions and districts
router.get("/meta/regions", (req, res) => {
  try {
    const districts = require("../data/districts.json");
    res.json(districts);
  } catch (err) {
    res.status(500).json({ error: "Failed to load regions metadata." });
  }
});

// GET /api/registrations/my-nomination - Check if an officer is already registered
router.get("/my-nomination", async (req, res) => {
  const phone = (req.query.phone || req.query.phoneNumber || "").trim();
  const email = (req.query.email || "").trim();
  const name = (req.query.name || req.query.officerName || "").trim();

  if (!phone && !email && !name) {
    return res.json({ hasRegistered: false, nominee: null });
  }

  // 1. Try Supabase
  if (supabase) {
    try {
      let q = supabase.from("registrations").select("*");
      if (phone) q = q.eq("phone_number", phone);
      else if (email) q = q.ilike("email", email);
      const { data, error } = await q.maybeSingle();
      if (!error && data) {
        return res.json({ hasRegistered: true, nominee: formatNomineeRecord(data) });
      }
    } catch(err) {
      console.error("Supabase my-nomination check error:", err.message);
    }
  }

  // 2. Fallback to local SQLite
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
router.post("/", async (req, res) => {
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

  // 1. Duplicate check via Supabase if connected
  if (supabase) {
    try {
      const { data: existPhone } = await supabase
        .from("registrations")
        .select("*")
        .eq("phone_number", phoneNumber.trim())
        .maybeSingle();

      if (existPhone) {
        const nominee = formatNomineeRecord(existPhone);
        return res.status(409).json({
          error: `A nomination registration with phone "${phoneNumber}" already exists for ${existPhone.officer_name}.`,
          existingReference: generateRefCode(existPhone.id, existPhone.region),
          hasRegistered: true,
          nominee,
        });
      }

      if (formattedEmail) {
        const { data: existEmail } = await supabase
          .from("registrations")
          .select("*")
          .ilike("email", formattedEmail)
          .maybeSingle();

        if (existEmail) {
          const nominee = formatNomineeRecord(existEmail);
          return res.status(409).json({
            error: `A nomination registration with email "${formattedEmail}" already exists for ${existEmail.officer_name}.`,
            existingReference: generateRefCode(existEmail.id, existEmail.region),
            hasRegistered: true,
            nominee,
          });
        }
      }
    } catch (e) {
      console.error("Supabase duplicate check error:", e.message);
    }
  }

  // Duplicate check on SQLite
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
    allocatedCohort = await findNextAvailableCohort();
  }

  const assignedCohortId = allocatedCohort ? allocatedCohort.id : null;
  const arrivalDate = allocatedCohort ? allocatedCohort.arrival_date : null;

  // Insert to local SQLite
  const submittedAtIso = new Date().toISOString();
  
  const stmt = db.prepare(`
    INSERT INTO registrations
      (officer_name, sex, phone_number, email, region, district, institution_name, roles, cohort_id, arrival_date, attendance_status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Attended', ?)
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
    arrivalDate,
    submittedAtIso
  );

  let insertedId = Number(info.lastInsertRowid);

  // Insert / Sync to Supabase if connected
  // IMPORTANT: Always use explicit id (max+1) because the Supabase sequence
  // is out of sync and auto-increment would generate duplicate key errors.
  if (supabase) {
    try {
      const insertPayload = {
        officer_name: officerName.trim(),
        sex,
        phone_number: phoneNumber.trim(),
        email: formattedEmail,
        region: region.trim(),
        district: district.trim(),
        institution_name: institutionName.trim(),
        roles,
        cohort_id: assignedCohortId,
        arrival_date: arrivalDate,
        attendance_status: "Attended",
        submitted_at: submittedAtIso
      };

      // Always get the current max id to use explicit id (bypasses broken sequence)
      const { data: maxRow } = await supabase
        .from("registrations")
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .single();
      const nextId = maxRow ? maxRow.id + 1 : 100;

      const { data: supaRow, error: supaErr } = await supabase
        .from("registrations")
        .insert({ ...insertPayload, id: nextId })
        .select()
        .single();

      if (supaErr) {
        console.error("Supabase insert error:", supaErr.code, supaErr.message, supaErr.details);
        // Last resort: try without explicit id
        const { data: fallbackRow, error: fbErr } = await supabase
          .from("registrations")
          .insert(insertPayload)
          .select()
          .single();
        if (!fbErr && fallbackRow) {
          insertedId = fallbackRow.id;
          console.log("Supabase insert OK (fallback), id:", insertedId);
        } else {
          console.error("Supabase fallback insert also failed:", fbErr?.message);
        }
      } else if (supaRow) {
        insertedId = supaRow.id;
        console.log("Supabase insert OK, id:", insertedId);
      }
    } catch(err) {
      console.error("Supabase insert exception:", err.message);
    }
  }

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
router.get("/stats", adminAuth, async (req, res) => {
  let allRows = [];

  if (supabase) {
    try {
      const { data, error } = await supabase.from("registrations").select("*");
      if (!error && data && data.length > 0) {
        allRows = data;
      }
    } catch(e) {}
  }

  if (allRows.length === 0) {
    allRows = db.prepare("SELECT * FROM registrations").all();
  }

  const total = allRows.length;
  let maleCount = 0;
  let femaleCount = 0;
  let attendedCount = 0;
  const roleCounts = {
    "DL District Trainer - Numeracy (Math)": 0,
    "DL District Trainer - Literacy (English)": 0,
    "DL District Trainer - IT Person (DL Dashboard)": 0,
  };
  const regionCounts = {};

  for (const row of allRows) {
    if (row.sex === "Male") maleCount++;
    if (row.sex === "Female") femaleCount++;
    if (row.attendance_status === "Attended") attendedCount++;

    let roles = [];
    try {
      roles = typeof row.roles === "string" ? JSON.parse(row.roles || "[]") : (row.roles || []);
    } catch(e) {
      roles = [row.roles];
    }

    for (const r of roles) {
      const normalized = r.replace("Master Trainer", "District Trainer");
      if (roleCounts[normalized] !== undefined) {
        roleCounts[normalized]++;
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
router.get("/", adminAuth, async (req, res) => {
  const { q, region, district, role, cohort_id, attendance_status } = req.query;

  // 1. Try Supabase
  if (supabase) {
    try {
      let query = supabase.from("registrations").select("*, cohorts(name, arrival_date, start_date, end_date, departure_date, max_capacity)").order("submitted_at", { ascending: false });

      if (region) query = query.eq("region", region);
      if (district) query = query.eq("district", district);
      if (cohort_id) query = query.eq("cohort_id", Number(cohort_id));
      if (attendance_status) query = query.eq("attendance_status", attendance_status);
      if (q) {
        query = query.or(`officer_name.ilike.%${q}%,phone_number.ilike.%${q}%,email.ilike.%${q}%,institution_name.ilike.%${q}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        let formatted = data.map((r) => {
          let rolesParsed = [];
          try {
            rolesParsed = typeof r.roles === "string" ? JSON.parse(r.roles || "[]") : (r.roles || []);
          } catch(e) {
            rolesParsed = [r.roles];
          }
          return {
            ...r,
            referenceCode: generateRefCode(r.id, r.region),
            roles: rolesParsed,
            cohort_name: r.cohorts ? r.cohorts.name : (r.cohort_id ? `Cohort ${r.cohort_id}` : null),
            cohort_arrival_date: r.cohorts ? r.cohorts.arrival_date : r.arrival_date,
            cohort_start_date: r.cohorts ? r.cohorts.start_date : null,
            cohort_end_date: r.cohorts ? r.cohorts.end_date : null,
            cohort_departure_date: r.cohorts ? r.cohorts.departure_date : null,
            cohort_capacity: r.cohorts ? r.cohorts.max_capacity : 150,
          };
        });

        if (role) {
          formatted = formatted.filter((r) => {
            return r.roles.some(rl => rl.includes(role) || rl.replace("Master Trainer", "District Trainer").includes(role));
          });
        }

        return res.json({ count: formatted.length, registrations: formatted });
      }
    } catch(err) {
      console.error("Supabase GET registrations error:", err.message);
    }
  }

  // 2. Fallback to local SQLite
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

  rows = rows.map((r) => {
    let rolesParsed = [];
    try {
      rolesParsed = typeof r.roles === "string" ? JSON.parse(r.roles || "[]") : (r.roles || []);
    } catch(e) {
      rolesParsed = [r.roles];
    }
    return {
      ...r,
      referenceCode: generateRefCode(r.id, r.region),
      roles: rolesParsed,
    };
  });

  if (role) {
    rows = rows.filter((r) => r.roles.some(rl => rl.includes(role) || rl.replace("Master Trainer", "District Trainer").includes(role)));
  }

  res.json({ count: rows.length, registrations: rows });
});

// PUT /api/registrations/:id - update a registration (admin only)
router.put("/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);
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

  const formattedEmail = email && email.trim() ? email.trim() : null;
  const status = attendanceStatus || "Registered";

  let arrivalDate = null;
  if (cohortId) {
    try {
      const c = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(cohortId);
      if (c) arrivalDate = c.arrival_date;
    } catch (e) {}
  }

  // Update Supabase if available
  if (supabase) {
    try {
      await supabase.from("registrations").update({
        officer_name: officerName.trim(),
        sex,
        phone_number: phoneNumber.trim(),
        email: formattedEmail,
        region: region.trim(),
        district: district.trim(),
        institution_name: institutionName.trim(),
        roles,
        cohort_id: cohortId ? Number(cohortId) : null,
        arrival_date: arrivalDate,
        attendance_status: status,
        check_in_notes: checkInNotes || null
      }).eq("id", id);
    } catch(err) {
      console.error("Supabase update error:", err.message);
    }
  }

  // Update local SQLite
  const stmt = db.prepare(`
    UPDATE registrations
    SET officer_name = ?, sex = ?, phone_number = ?, email = ?,
        region = ?, district = ?, institution_name = ?, roles = ?,
        cohort_id = ?, arrival_date = ?, attendance_status = ?, check_in_notes = ?
    WHERE id = ?
  `);

  stmt.run(
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
    status,
    checkInNotes || null,
    id
  );

  const updated = db.prepare("SELECT * FROM registrations WHERE id = ?").get(id);
  res.json({ message: "Registration updated successfully.", nominee: formatNomineeRecord(updated) });
});

// DELETE /api/registrations/:id - delete a registration (admin only)
router.delete("/:id", adminAuth, async (req, res) => {
  const id = Number(req.params.id);

  if (supabase) {
    try {
      await supabase.from("registrations").delete().eq("id", id);
    } catch(err) {
      console.error("Supabase delete error:", err.message);
    }
  }

  db.prepare("DELETE FROM registrations WHERE id = ?").run(id);
  res.json({ message: "Registration deleted successfully." });
});

// GET /api/registrations/export/csv - export all registrations as CSV
router.get("/export/csv", adminAuth, async (req, res) => {
  let rows = [];
  if (supabase) {
    try {
      const { data } = await supabase.from("registrations").select("*, cohorts(name)").order("id", { ascending: true });
      if (data && data.length > 0) {
        rows = data.map(r => ({
          ...r,
          cohort_name: r.cohorts ? r.cohorts.name : (r.cohort_id ? `Cohort ${r.cohort_id}` : "")
        }));
      }
    } catch(e) {}
  }

  if (rows.length === 0) {
    rows = db.prepare(`
      SELECT r.*, c.name as cohort_name
      FROM registrations r
      LEFT JOIN cohorts c ON r.cohort_id = c.id
      ORDER BY r.id ASC
    `).all();
  }

  const exportData = rows.map((r) => {
    let rolesParsed = [];
    try {
      rolesParsed = typeof r.roles === "string" ? JSON.parse(r.roles || "[]") : (r.roles || []);
    } catch(e) {
      rolesParsed = [r.roles];
    }
    return {
      "Ref Code": generateRefCode(r.id, r.region),
      "Officer Name": r.officer_name,
      "Sex": r.sex,
      "Phone Number": r.phone_number,
      "Email Address": r.email || "",
      "Region": r.region,
      "District": r.district,
      "Institution / School": r.institution_name,
      "Nominated Role(s)": rolesParsed.join("; "),
      "Assigned Cohort": r.cohort_name || (r.cohort_id ? `Cohort ${r.cohort_id}` : "Unassigned"),
      "Arrival Date": r.arrival_date || "",
      "Attendance Status": r.attendance_status || "Registered",
      "Check-in Notes": r.check_in_notes || "",
      "Submitted At": r.submitted_at,
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const csv = XLSX.utils.sheet_to_csv(ws);

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="dl_master_trainer_registrations.csv"');
  res.send(csv);
});

// GET /api/registrations/export/xlsx - export all registrations as Excel
router.get("/export/xlsx", adminAuth, async (req, res) => {
  let rows = [];
  if (supabase) {
    try {
      const { data } = await supabase.from("registrations").select("*, cohorts(name)").order("id", { ascending: true });
      if (data && data.length > 0) {
        rows = data.map(r => ({
          ...r,
          cohort_name: r.cohorts ? r.cohorts.name : (r.cohort_id ? `Cohort ${r.cohort_id}` : "")
        }));
      }
    } catch(e) {}
  }

  if (rows.length === 0) {
    rows = db.prepare(`
      SELECT r.*, c.name as cohort_name
      FROM registrations r
      LEFT JOIN cohorts c ON r.cohort_id = c.id
      ORDER BY r.id ASC
    `).all();
  }

  const exportData = rows.map((r) => {
    let rolesParsed = [];
    try {
      rolesParsed = typeof r.roles === "string" ? JSON.parse(r.roles || "[]") : (r.roles || []);
    } catch(e) {
      rolesParsed = [r.roles];
    }
    return {
      "Ref Code": generateRefCode(r.id, r.region),
      "Officer Name": r.officer_name,
      "Sex": r.sex,
      "Phone Number": r.phone_number,
      "Email Address": r.email || "",
      "Region": r.region,
      "District": r.district,
      "Institution / School": r.institution_name,
      "Nominated Role(s)": rolesParsed.join("; "),
      "Assigned Cohort": r.cohort_name || (r.cohort_id ? `Cohort ${r.cohort_id}` : "Unassigned"),
      "Arrival Date": r.arrival_date || "",
      "Attendance Status": r.attendance_status || "Registered",
      "Check-in Notes": r.check_in_notes || "",
      "Submitted At": r.submitted_at,
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  XLSX.utils.book_append_sheet(wb, ws, "Registrations");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="dl_master_trainer_registrations.xlsx"');
  res.send(buffer);
});

module.exports = router;
