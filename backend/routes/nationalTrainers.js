const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const adminAuth = require("../middleware/adminAuth");
const { generateTrainerToken, trainerOrAdminAuth } = adminAuth;

const router = express.Router();

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return hash === originalHash;
}

// GET /api/national-trainers - List all 11 Facilitators (public)
router.get("/", (req, res) => {
  const trainers = db.prepare(`
    SELECT id, name, place_of_work, schedule_role, contact_number, email, status, created_at
    FROM national_trainers
    ORDER BY id ASC
  `).all();
  res.json({ count: trainers.length, trainers });
});

// POST /api/national-trainers/login - Facilitator Authentication
router.post("/login", (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return res.status(400).json({ error: "Contact number / Email and password are required." });
  }

  const cleanId = identifier.trim();
  const digitsOnly = cleanId.replace(/\D/g, "");

  const trainer = db.prepare(`
    SELECT * FROM national_trainers 
    WHERE LOWER(email) = LOWER(?)
       OR contact_number = ?
       OR replace(contact_number, '-', '') = ?
  `).get(cleanId, cleanId, digitsOnly);

  if (!trainer) {
    return res.status(401).json({ error: "No National Master Trainer found with this contact/email." });
  }

  if (trainer.status !== "Active") {
    return res.status(403).json({ error: "Account disabled. Please contact the DL Secretariat." });
  }

  // Master password fallback or individual password check
  const masterPass = process.env.ADMIN_PASSWORD || "change-me-please";
  const isMatch =
    password === masterPass ||
    password === "trainer2026" ||
    (digitsOnly && password === digitsOnly) ||
    password === trainer.contact_number ||
    (digitsOnly && password === trainer.contact_number.replace(/\D/g, "")) ||
    verifyPassword(password.trim(), trainer.password_hash);

  if (!isMatch) {
    return res.status(401).json({ error: "Incorrect password. Default password is your phone number or 'trainer2026'." });
  }

  const token = generateTrainerToken(trainer);
  res.json({
    success: true,
    token,
    trainer: {
      id: trainer.id,
      name: trainer.name,
      placeOfWork: trainer.place_of_work,
      scheduleRole: trainer.schedule_role,
      contactNumber: trainer.contact_number,
      email: trainer.email,
      role: "National Master Trainer",
      status: trainer.status,
    },
  });
});

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// GET /api/national-trainers/me - Profile info
router.get("/me", trainerOrAdminAuth, (req, res) => {
  if (req.trainer) {
    return res.json({ role: "National Master Trainer", trainer: req.trainer });
  }
  if (req.admin) {
    return res.json({ role: req.admin.role, admin: req.admin });
  }
  res.status(401).json({ error: "Unauthorized" });
});

// POST /api/national-trainers - Add National Master Trainer (Admin)
router.post("/", adminAuth, (req, res) => {
  const name = req.body.name || req.body.officer_name;
  const placeOfWork = req.body.placeOfWork || req.body.place_of_work;
  const scheduleRole = req.body.scheduleRole || req.body.schedule_role || "Facilitator";
  const contactNumber = req.body.contactNumber || req.body.contact_number;
  const email = req.body.email;
  const status = req.body.status || "Active";
  const password = req.body.password;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Trainer full name is required." });
  }
  if (!contactNumber || !contactNumber.trim()) {
    return res.status(400).json({ error: "Contact phone number is required." });
  }

  const cleanPhone = contactNumber.trim();
  const digitsOnly = cleanPhone.replace(/\D/g, "");
  const plainPass = password && password.trim() ? password.trim() : (digitsOnly || "trainer2026");
  const passwordHash = hashPassword(plainPass);

  try {
    const info = db.prepare(`
      INSERT INTO national_trainers (name, place_of_work, schedule_role, contact_number, email, password_hash, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      name.trim(),
      placeOfWork ? placeOfWork.trim() : "",
      scheduleRole.trim(),
      cleanPhone,
      email ? email.trim() : null,
      passwordHash,
      status
    );

    const newTrainer = db.prepare("SELECT id, name, place_of_work, schedule_role, contact_number, email, status, created_at FROM national_trainers WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json({ message: "National Master Trainer added successfully.", trainer: newTrainer });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "A facilitator with this email or contact number already exists." });
    }
    res.status(500).json({ error: "Failed to add National Master Trainer." });
  }
});

// PUT /api/national-trainers/:id - Update National Master Trainer (Admin or Trainer Self-Service)
router.put("/:id", trainerOrAdminAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (req.trainer && Number(req.trainer.id) !== id) {
    return res.status(403).json({ error: "You can only edit your own facilitator profile." });
  }

  const name = req.body.name || req.body.officer_name;
  const placeOfWork = req.body.placeOfWork || req.body.place_of_work;
  const scheduleRole = req.body.scheduleRole || req.body.schedule_role;
  const contactNumber = req.body.contactNumber || req.body.contact_number;
  const email = req.body.email;
  const status = req.body.status || "Active";
  const password = req.body.password;

  const existing = db.prepare("SELECT * FROM national_trainers WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "National Master Trainer not found." });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Trainer full name is required." });
  }
  if (!contactNumber || !contactNumber.trim()) {
    return res.status(400).json({ error: "Contact phone number is required." });
  }

  let passHash = existing.password_hash;
  if (password && password.trim().length >= 6) {
    passHash = hashPassword(password.trim());
  }

  // Supabase sync
  const supabase = require("../supabase");
  if (supabase) {
    try {
      const supaUpdate = {
        name: name.trim(),
        place_of_work: placeOfWork ? placeOfWork.trim() : "",
        schedule_role: scheduleRole ? scheduleRole.trim() : existing.schedule_role,
        contact_number: contactNumber.trim(),
        email: email ? email.trim() : null,
        status: req.admin ? status : existing.status,
      };
      if (password && password.trim().length >= 6) {
        supaUpdate.password_hash = passHash;
      }
      await supabase.from("national_trainers").update(supaUpdate).eq("id", id);
    } catch (e) {
      console.error("Supabase trainer update error:", e.message);
    }
  }

  try {
    db.prepare(`
      UPDATE national_trainers
      SET name = ?, place_of_work = ?, schedule_role = ?, contact_number = ?, email = ?, password_hash = ?, status = ?
      WHERE id = ?
    `).run(
      name.trim(),
      placeOfWork ? placeOfWork.trim() : "",
      scheduleRole ? scheduleRole.trim() : existing.schedule_role,
      contactNumber.trim(),
      email ? email.trim() : null,
      passHash,
      req.admin ? status : existing.status,
      id
    );

    const updated = db.prepare("SELECT id, name, place_of_work, schedule_role, contact_number, email, status, created_at FROM national_trainers WHERE id = ?").get(id);
    res.json({ message: "Facilitator details updated successfully.", trainer: updated });
  } catch (err) {
    if (err.message && err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Email or contact number conflicts with another facilitator." });
    }
    res.status(500).json({ error: "Failed to update National Master Trainer." });
  }
});

// DELETE /api/national-trainers/:id - Remove National Master Trainer (Admin)
router.delete("/:id", adminAuth, (req, res) => {
  const id = req.params.id;
  const existing = db.prepare("SELECT id, name FROM national_trainers WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "National Master Trainer not found." });
  }

  db.prepare("DELETE FROM national_trainers WHERE id = ?").run(id);
  res.json({ message: `National Master Trainer ${existing.name} removed successfully.` });
});

// POST /api/national-trainers/:id/reset-password - Reset Trainer Password (Admin)
router.post("/:id/reset-password", adminAuth, (req, res) => {
  const id = req.params.id;
  const trainer = db.prepare("SELECT * FROM national_trainers WHERE id = ?").get(id);
  if (!trainer) {
    return res.status(404).json({ error: "Trainer not found." });
  }

  const digits = trainer.contact_number.replace(/\D/g, "");
  const defaultPass = req.body.password || digits || "trainer2026";
  const passHash = hashPassword(defaultPass);

  db.prepare("UPDATE national_trainers SET password_hash = ? WHERE id = ?").run(passHash, id);
  res.json({ message: `Password for ${trainer.name} reset to: ${defaultPass}` });
});

module.exports = router;

