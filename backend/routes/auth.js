const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const supabase = require("../supabase");

const router = express.Router();
const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Look up a registration in Supabase by email or phone (fallback for Vercel/cloud)
async function findSupabaseRegistration(identifier) {
  if (!supabase) return null;
  try {
    const ident = (identifier || "").trim();
    if (ident.includes("@")) {
      const { data } = await supabase.from("registrations").select("*").ilike("email", ident).maybeSingle();
      return data || null;
    }
    // Try exact phone match
    const { data: byPhone } = await supabase.from("registrations").select("*").eq("phone_number", ident).maybeSingle();
    if (byPhone) return byPhone;
    // Try name
    const { data: byName } = await supabase.from("registrations").select("*").ilike("officer_name", `%${ident}%`).maybeSingle();
    return byName || null;
  } catch (e) {
    console.error("Supabase registration lookup error:", e.message);
    return null;
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === originalHash;
}

// POST /api/auth/signup - Officer Registration
router.post("/signup", (req, res) => {
  const { officerName, phoneNumber, email, staffId, password } = req.body;
  const errors = {};

  if (!officerName || !officerName.trim()) {
    errors.officerName = "Full Name of Officer is required.";
  }

  if (!phoneNumber || !PHONE_REGEX.test(phoneNumber.trim())) {
    errors.phoneNumber = "Valid phone number required (e.g. 024-498-9910).";
  }

  if (!email || !EMAIL_REGEX.test(email.trim())) {
    errors.email = "Valid email address is required.";
  }

  if (!password || password.trim().length < 4) {
    errors.password = "Password must be at least 4 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  // Check if officer already registered with phone number or email
  const existing = db.prepare(`
    SELECT id FROM officers 
    WHERE phone_number = ? 
       OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?))
  `).get(phoneNumber.trim(), email.trim());

  if (existing) {
    const regRow = db.prepare(`
      SELECT * FROM registrations 
      WHERE phone_number = ? 
         OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?))
    `).get(phoneNumber.trim(), email.trim());

    let nominee = null;
    let hasRegistered = false;
    if (regRow) {
      const cohort = regRow.cohort_id ? db.prepare("SELECT * FROM cohorts WHERE id = ?").get(regRow.cohort_id) : null;
      const regCode = (regRow.region || "GES").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
      nominee = {
        id: regRow.id,
        referenceCode: `DL-2026-${regCode}-${String(regRow.id).padStart(4, "0")}`,
        officerName: regRow.officer_name,
        sex: regRow.sex,
        phoneNumber: regRow.phone_number,
        email: regRow.email,
        region: regRow.region,
        district: regRow.district,
        institutionName: regRow.institution_name,
        roles: JSON.parse(regRow.roles || "[]"),
        cohortId: regRow.cohort_id,
        cohortName: cohort ? cohort.name : (regRow.cohort_id ? `Cohort ${regRow.cohort_id}` : "Cohort 1"),
        arrivalDate: regRow.arrival_date || (cohort ? cohort.arrival_date : "Sunday, 20/09/2026"),
        startDate: cohort ? cohort.start_date : "Monday, 21/09/2026",
        endDate: cohort ? cohort.end_date : "Tuesday, 22/09/2026",
        departureDate: cohort ? cohort.departure_date : "Wednesday, 23/09/2026",
        attendanceStatus: regRow.attendance_status || "Registered",
        submittedAt: regRow.submitted_at,
      };
      hasRegistered = true;
    }

    return res.status(409).json({
      error: `An officer account with this phone number or email already exists. Please sign in instead.`,
      hasRegistered,
      nominee,
    });
  }

  const passwordHash = hashPassword(password.trim());
  const stmt = db.prepare(`
    INSERT INTO officers (officer_name, phone_number, email, staff_id, password_hash)
    VALUES (?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    officerName.trim(),
    phoneNumber.trim(),
    email.trim(),
    staffId ? staffId.trim() : null,
    passwordHash
  );

  const officer = {
    id: info.lastInsertRowid,
    officerName: officerName.trim(),
    phoneNumber: phoneNumber.trim(),
    email: email.trim(),
    staffId: staffId ? staffId.trim() : null,
  };

  // Check if this officer already has a completed nomination registration
  const regRow = db.prepare(`
    SELECT * FROM registrations 
    WHERE phone_number = ? 
       OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?))
  `).get(officer.phoneNumber, officer.email || "");

  let nominee = null;
  let hasRegistered = false;
  if (regRow) {
    const cohort = regRow.cohort_id ? db.prepare("SELECT * FROM cohorts WHERE id = ?").get(regRow.cohort_id) : null;
    const regCode = (regRow.region || "GES").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    nominee = {
      id: regRow.id,
      referenceCode: `DL-2026-${regCode}-${String(regRow.id).padStart(4, "0")}`,
      officerName: regRow.officer_name,
      sex: regRow.sex,
      phoneNumber: regRow.phone_number,
      email: regRow.email,
      region: regRow.region,
      district: regRow.district,
      institutionName: regRow.institution_name,
      roles: JSON.parse(regRow.roles || "[]"),
      cohortId: regRow.cohort_id,
      cohortName: cohort ? cohort.name : (regRow.cohort_id ? `Cohort ${regRow.cohort_id}` : "Cohort 1"),
      arrivalDate: regRow.arrival_date || (cohort ? cohort.arrival_date : "Sunday, 20/09/2026"),
      startDate: cohort ? cohort.start_date : "Monday, 21/09/2026",
      endDate: cohort ? cohort.end_date : "Tuesday, 22/09/2026",
      departureDate: cohort ? cohort.departure_date : "Wednesday, 23/09/2026",
      attendanceStatus: regRow.attendance_status || "Registered",
      submittedAt: regRow.submitted_at,
    };
    hasRegistered = true;
  }

  return res.status(201).json({
    message: "Officer account created successfully.",
    officer,
    hasRegistered,
    nominee,
  });
});

// POST /api/auth/login - Officer Sign In
router.post("/login", async (req, res) => {
  const { identifier, email, phoneNumber, password } = req.body;
  const loginIdentifier = (identifier || email || phoneNumber || "").trim();
  const errors = {};

  if (!loginIdentifier) {
    errors.identifier = "Email address is required.";
  }
  if (!password || !password.trim()) {
    errors.password = "Password is required.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  let row = db.prepare(`
    SELECT * FROM officers 
    WHERE LOWER(email) = LOWER(?) 
       OR phone_number = ? 
       OR LOWER(staff_id) = LOWER(?)
       OR LOWER(officer_name) = LOWER(?)
  `).get(loginIdentifier, loginIdentifier, loginIdentifier, loginIdentifier);

  let officer = null;

  if (row) {
    if (!verifyPassword(password.trim(), row.password_hash)) {
      return res.status(401).json({
        error: "Invalid email or password. Please verify your credentials.",
      });
    }
    officer = {
      id: row.id,
      officerName: row.officer_name,
      phoneNumber: row.phone_number,
      email: row.email,
      staffId: row.staff_id,
    };
  } else {
    // Check local SQLite registrations first
    let reg = db.prepare(`
      SELECT * FROM registrations 
      WHERE LOWER(email) = LOWER(?) 
         OR phone_number = ? 
         OR LOWER(officer_name) = LOWER(?)
    `).get(loginIdentifier, loginIdentifier, loginIdentifier);

    // Fallback: check Supabase (needed on Vercel where SQLite is ephemeral)
    if (!reg) {
      reg = await findSupabaseRegistration(loginIdentifier);
    }

    if (reg) {
      // Auto-create their officer login account with this password
      const passwordHash = hashPassword(password.trim());
      let newOfficerId;
      try {
        const info = db.prepare(`
          INSERT INTO officers (officer_name, phone_number, email, password_hash)
          VALUES (?, ?, ?, ?)
        `).run(reg.officer_name, reg.phone_number, reg.email, passwordHash);
        newOfficerId = Number(info.lastInsertRowid);
      } catch (e) {
        // May fail on Vercel if DB is read-only or another error; that's OK
        newOfficerId = reg.id || 0;
      }

      officer = {
        id: newOfficerId,
        officerName: reg.officer_name,
        phoneNumber: reg.phone_number,
        email: reg.email,
      };
    } else {
      return res.status(401).json({
        error: "Invalid email or password. Please verify your credentials.",
      });
    }
  }

  // Check if this officer already has a completed nomination registration (SQLite first, then Supabase)
  let regRow = db.prepare(`
    SELECT * FROM registrations 
    WHERE phone_number = ? 
       OR (email IS NOT NULL AND email != '' AND LOWER(email) = LOWER(?))
  `).get(officer.phoneNumber, officer.email || "");

  if (!regRow) {
    regRow = await findSupabaseRegistration(officer.email || officer.phoneNumber);
  }


  let nominee = null;
  let hasRegistered = false;
  if (regRow) {
    const cohort = regRow.cohort_id ? db.prepare("SELECT * FROM cohorts WHERE id = ?").get(regRow.cohort_id) : null;
    const regCode = (regRow.region || "GES").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
    nominee = {
      id: regRow.id,
      referenceCode: `DL-2026-${regCode}-${String(regRow.id).padStart(4, "0")}`,
      officerName: regRow.officer_name,
      sex: regRow.sex,
      phoneNumber: regRow.phone_number,
      email: regRow.email,
      region: regRow.region,
      district: regRow.district,
      institutionName: regRow.institution_name,
      roles: JSON.parse(regRow.roles || "[]"),
      cohortId: regRow.cohort_id,
      cohortName: cohort ? cohort.name : (regRow.cohort_id ? `Cohort ${regRow.cohort_id}` : "Cohort 1"),
      arrivalDate: regRow.arrival_date || (cohort ? cohort.arrival_date : "Sunday, 20/09/2026"),
      startDate: cohort ? cohort.start_date : "Monday, 21/09/2026",
      endDate: cohort ? cohort.end_date : "Tuesday, 22/09/2026",
      departureDate: cohort ? cohort.departure_date : "Wednesday, 23/09/2026",
      attendanceStatus: regRow.attendance_status || "Registered",
      submittedAt: regRow.submitted_at,
    };
    hasRegistered = true;
  }

  return res.json({
    message: "Login successful.",
    officer,
    hasRegistered,
    nominee,
  });
});

// Helper to find an account across trainers, officers, admins, and registrations
function findAccountByQuery(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return null;

  const digits = q.replace(/\D/g, "");
  const emailPrefix = q.includes("@") ? q.split("@")[0] : q;
  const prefixStem = emailPrefix.length > 5 ? emailPrefix.slice(0, 6) : emailPrefix;

  // 1. National Facilitators / Trainers
  let trainer = db.prepare(`
    SELECT id, name, email, place_of_work, schedule_role, contact_number, password_hash
    FROM national_trainers
    WHERE LOWER(email) = ? OR contact_number = ?
  `).get(q, q);

  if (!trainer && digits.length >= 7) {
    trainer = db.prepare(`
      SELECT id, name, email, place_of_work, schedule_role, contact_number, password_hash
      FROM national_trainers
      WHERE replace(replace(contact_number, '-', ''), ' ', '') LIKE ?
    `).get(`%${digits}%`);
  }

  if (!trainer && prefixStem) {
    trainer = db.prepare(`
      SELECT id, name, email, place_of_work, schedule_role, contact_number, password_hash
      FROM national_trainers
      WHERE LOWER(email) LIKE ? OR LOWER(name) LIKE ?
    `).get(`%${prefixStem}%`, `%${prefixStem}%`);
  }

  if (trainer) {
    return {
      type: "trainer",
      id: trainer.id,
      name: trainer.name,
      email: trainer.email,
      phone: trainer.contact_number,
      role: `National Master Trainer (${trainer.schedule_role || "Facilitator"})`,
      loginUrl: "/trainer/login",
      loginIdentifier: trainer.contact_number,
      defaultPassword: trainer.contact_number.replace(/\D/g, ""),
    };
  }

  // 2. Officers / Nominees Accounts
  let officer = db.prepare(`
    SELECT id, officer_name, phone_number, email, staff_id, password_hash
    FROM officers
    WHERE LOWER(email) = ? OR phone_number = ?
  `).get(q, q);

  if (!officer && digits.length >= 7) {
    officer = db.prepare(`
      SELECT id, officer_name, phone_number, email, staff_id, password_hash
      FROM officers
      WHERE replace(replace(phone_number, '-', ''), ' ', '') LIKE ?
    `).get(`%${digits}%`);
  }

  if (!officer && prefixStem) {
    officer = db.prepare(`
      SELECT id, officer_name, phone_number, email, staff_id, password_hash
      FROM officers
      WHERE LOWER(email) LIKE ? OR LOWER(officer_name) LIKE ?
    `).get(`%${prefixStem}%`, `%${prefixStem}%`);
  }

  if (officer) {
    return {
      type: "officer",
      id: officer.id,
      name: officer.officer_name,
      email: officer.email,
      phone: officer.phone_number,
      role: "Nominated DL District Trainer",
      loginUrl: "/officer/login",
      loginIdentifier: officer.email || officer.phone_number,
      defaultPassword: officer.phone_number.replace(/\D/g, ""),
    };
  }

  // 3. Registrations (Nominees who filled the form)
  let reg = db.prepare(`
    SELECT id, officer_name, phone_number, email, region, district, institution_name
    FROM registrations
    WHERE LOWER(email) = ? OR phone_number = ?
  `).get(q, q);

  if (!reg && digits.length >= 7) {
    reg = db.prepare(`
      SELECT id, officer_name, phone_number, email, region, district, institution_name
      FROM registrations
      WHERE replace(replace(phone_number, '-', ''), ' ', '') LIKE ?
    `).get(`%${digits}%`);
  }

  if (reg) {
    return {
      type: "registration",
      id: reg.id,
      name: reg.officer_name,
      email: reg.email || `${reg.phone_number.replace(/\D/g, "")}@ges.gov.gh`,
      phone: reg.phone_number,
      role: `Nominated Officer (${reg.district}, ${reg.region})`,
      loginUrl: "/officer/login",
      loginIdentifier: reg.email || reg.phone_number,
      defaultPassword: reg.phone_number.replace(/\D/g, ""),
    };
  }

  // 4. Admins
  let admin = db.prepare(`
    SELECT id, name, email, phone_number, role, password_hash
    FROM admins
    WHERE LOWER(email) = ? OR phone_number = ?
  `).get(q, q);

  if (admin) {
    return {
      type: "admin",
      id: admin.id,
      name: admin.name,
      email: admin.email,
      phone: admin.phone_number,
      role: admin.role || "Administrator",
      loginUrl: "/admin",
      loginIdentifier: admin.email,
      defaultPassword: "change-me-please",
    };
  }

  return null;
}

// POST /api/auth/forgot-password - Instant Browser Password Recovery
router.post("/forgot-password", async (req, res) => {
  const { email, identifier } = req.body;
  const lookupQuery = (identifier || email || "").trim();

  if (!lookupQuery) {
    return res.status(400).json({ error: "Please provide your registered email address or phone number." });
  }

  let account = findAccountByQuery(lookupQuery);

  // Fallback: check Supabase registrations (needed on Vercel)
  if (!account) {
    const supReg = await findSupabaseRegistration(lookupQuery);
    if (supReg) {
      account = {
        type: "registration",
        id: supReg.id,
        name: supReg.officer_name,
        email: supReg.email || `${supReg.phone_number.replace(/\D/g, "")}@ges.gov.gh`,
        phone: supReg.phone_number,
        role: `Nominated Officer (${supReg.district}, ${supReg.region})`,
        loginUrl: "/officer/login",
        loginIdentifier: supReg.email || supReg.phone_number,
        defaultPassword: supReg.phone_number.replace(/\D/g, ""),
      };
    }
  }

  if (!account) {
    return res.status(404).json({
      error: `No registered account found matching "${lookupQuery}". Please check your email/phone number or contact your Secretariat.`,
    });
  }

  // Set / confirm a clean instant password displayed right in the browser
  const displayPassword = account.defaultPassword || "DL-2026-Pass";
  const newHash = hashPassword(displayPassword);

  if (account.type === "trainer") {
    db.prepare("UPDATE national_trainers SET password_hash = ? WHERE id = ?").run(newHash, account.id);
  } else if (account.type === "officer") {
    db.prepare("UPDATE officers SET password_hash = ? WHERE id = ?").run(newHash, account.id);
  } else if (account.type === "admin") {
    db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(newHash, account.id);
  } else if (account.type === "registration") {
    // Ensure officer account exists locally
    try {
      const existingOff = db.prepare("SELECT id FROM officers WHERE phone_number = ?").get(account.phone);
      if (existingOff) {
        db.prepare("UPDATE officers SET password_hash = ? WHERE id = ?").run(newHash, existingOff.id);
      } else {
        db.prepare(`
          INSERT INTO officers (officer_name, phone_number, email, password_hash)
          VALUES (?, ?, ?, ?)
        `).run(account.name, account.phone, account.email, newHash);
      }
    } catch (e) {
      // Ignore SQLite errors on Vercel read-only fs; password is still shown
    }
  }

  return res.json({
    success: true,
    message: "Password retrieved successfully.",
    account: {
      name: account.name,
      email: account.email,
      phone: account.phone,
      role: account.role,
      loginIdentifier: account.loginIdentifier,
      loginUrl: account.loginUrl,
      password: displayPassword,
    },
  });
});

// POST /api/auth/reset-password - Set New Custom Password directly in browser
router.post("/reset-password", (req, res) => {
  const { email, identifier, newPassword } = req.body;
  const lookupQuery = (identifier || email || "").trim();
  const errors = {};

  if (!lookupQuery) errors.identifier = "Email or phone number is required.";
  if (!newPassword || newPassword.trim().length < 4) {
    errors.newPassword = "New password must be at least 4 characters.";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const account = findAccountByQuery(lookupQuery);
  if (!account) {
    return res.status(404).json({ error: "No account found to reset password." });
  }

  const newHash = hashPassword(newPassword.trim());

  if (account.type === "trainer") {
    db.prepare("UPDATE national_trainers SET password_hash = ? WHERE id = ?").run(newHash, account.id);
  } else if (account.type === "officer") {
    db.prepare("UPDATE officers SET password_hash = ? WHERE id = ?").run(newHash, account.id);
  } else if (account.type === "admin") {
    db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(newHash, account.id);
  } else if (account.type === "registration") {
    const existingOff = db.prepare("SELECT id FROM officers WHERE phone_number = ?").get(account.phone);
    if (existingOff) {
      db.prepare("UPDATE officers SET password_hash = ? WHERE id = ?").run(newHash, existingOff.id);
    } else {
      db.prepare(`
        INSERT INTO officers (officer_name, phone_number, email, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(account.name, account.phone, account.email, newHash);
    }
  }

  return res.json({
    success: true,
    message: "Password updated successfully! You can now sign in.",
    account: {
      name: account.name,
      email: account.email,
      phone: account.phone,
      role: account.role,
      loginIdentifier: account.loginIdentifier,
      loginUrl: account.loginUrl,
      password: newPassword.trim(),
    },
  });
});

module.exports = router;
