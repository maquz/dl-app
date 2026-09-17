const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const adminAuth = require("../middleware/adminAuth");
const { generateAdminToken } = require("../middleware/adminAuth");

const router = express.Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE || "GES-DL-2026";

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

// POST /api/admin/login - Authenticate Administrator
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const expectedMaster = process.env.ADMIN_PASSWORD || "change-me-please";

  // Check master password bypass if provided
  if (password === expectedMaster) {
    const superAdmin = {
      id: 1,
      name: "National Super Administrator",
      email: email || "admin@ges.gov.gh",
      role: "Super Admin",
      status: "Active",
    };
    const token = generateAdminToken(superAdmin);
    return res.json({
      success: true,
      token,
      admin: superAdmin,
    });
  }

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const admin = db.prepare("SELECT * FROM admins WHERE LOWER(email) = LOWER(?)").get(email.trim());
  if (!admin) {
    return res.status(401).json({ error: "No administrator found with this email." });
  }

  if (admin.status !== "Active") {
    return res.status(403).json({ error: "Your administrator account has been disabled. Please contact the Super Admin." });
  }

  if (!verifyPassword(password.trim(), admin.password_hash)) {
    return res.status(401).json({ error: "Incorrect administrator password." });
  }

  const adminData = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phoneNumber: admin.phone_number,
    role: admin.role,
    status: admin.status,
  };

  const token = generateAdminToken(adminData);

  return res.json({
    success: true,
    token,
    admin: adminData,
  });
});

// POST /api/admin/register - Public self-registration disabled (Admins must be created by logged-in Administrators)
router.post("/register", (req, res) => {
  return res.status(403).json({
    error: "Public self-registration is disabled. New administrators must be added directly by a logged-in System Administrator.",
  });
});

// GET /api/admin/users - List all Admins (adminAuth required)
router.get("/users", adminAuth, (req, res) => {
  const admins = db.prepare("SELECT id, name, email, phone_number, role, status, created_at FROM admins ORDER BY created_at DESC").all();
  return res.json({ admins });
});

// POST /api/admin/users - Super Admin creates a new Admin directly
router.post("/users", adminAuth, (req, res) => {
  const { name, email, phoneNumber, role, password } = req.body;
  const errors = {};

  if (!name || !name.trim()) errors.name = "Full name is required.";
  if (!email || !EMAIL_REGEX.test(email.trim())) errors.email = "Valid email is required.";
  if (!password || password.trim().length < 6) errors.password = "Password must be at least 6 characters.";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  const existing = db.prepare("SELECT id FROM admins WHERE LOWER(email) = LOWER(?)").get(email.trim());
  if (existing) {
    return res.status(409).json({ error: "An administrator with this email already exists." });
  }

  const assignedRole = ["Super Admin", "Admin", "Reviewer"].includes(role) ? role : "Admin";
  const passwordHash = hashPassword(password.trim());

  const stmt = db.prepare(`
    INSERT INTO admins (name, email, phone_number, role, status, password_hash)
    VALUES (?, ?, ?, ?, 'Active', ?)
  `);

  const info = stmt.run(name.trim(), email.trim(), phoneNumber ? phoneNumber.trim() : null, assignedRole, passwordHash);

  return res.status(201).json({
    message: "Admin created successfully.",
    admin: {
      id: info.lastInsertRowid,
      name: name.trim(),
      email: email.trim(),
      phoneNumber: phoneNumber ? phoneNumber.trim() : null,
      role: assignedRole,
      status: "Active",
      created_at: new Date().toISOString(),
    },
  });
});

// PUT /api/admin/users/:id - Super Admin updates an Admin's Role or Status
router.put("/users/:id", adminAuth, (req, res) => {
  const id = req.params.id;
  const { name, email, phoneNumber, role, status, password } = req.body;

  const current = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);
  if (!current) {
    return res.status(404).json({ error: "Admin not found." });
  }

  const newName = name ? name.trim() : current.name;
  const newEmail = email ? email.trim() : current.email;
  const newPhone = phoneNumber !== undefined ? phoneNumber.trim() : current.phone_number;
  const newRole = ["Super Admin", "Admin", "Reviewer"].includes(role) ? role : current.role;
  const newStatus = ["Active", "Disabled"].includes(status) ? status : current.status;
  const newPasswordHash = password && password.trim().length >= 6 ? hashPassword(password.trim()) : current.password_hash;

  db.prepare(`
    UPDATE admins
    SET name = ?, email = ?, phone_number = ?, role = ?, status = ?, password_hash = ?
    WHERE id = ?
  `).run(newName, newEmail, newPhone, newRole, newStatus, newPasswordHash, id);

  return res.json({
    message: "Admin updated successfully.",
    admin: {
      id: Number(id),
      name: newName,
      email: newEmail,
      phoneNumber: newPhone,
      role: newRole,
      status: newStatus,
    },
  });
});

// DELETE /api/admin/users/:id - Super Admin deletes an Admin
router.delete("/users/:id", adminAuth, (req, res) => {
  const id = req.params.id;
  
  // Guard: ensure at least one Super Admin remains
  const superAdminCount = db.prepare("SELECT COUNT(*) as count FROM admins WHERE role = 'Super Admin'").get();
  const target = db.prepare("SELECT * FROM admins WHERE id = ?").get(id);

  if (!target) {
    return res.status(404).json({ error: "Admin not found." });
  }

  if (target.role === "Super Admin" && superAdminCount.count <= 1) {
    return res.status(400).json({ error: "Cannot delete the only remaining Super Administrator." });
  }

  db.prepare("DELETE FROM admins WHERE id = ?").run(id);
  return res.json({ message: "Administrator deleted successfully." });
});

module.exports = router;
