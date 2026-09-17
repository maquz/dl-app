const crypto = require("crypto");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "ges-dl-portal-secret-key-2026";

function generateAdminToken(admin) {
  const payload = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    status: admin.status,
    iat: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  if (signature !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    return payload;
  } catch {
    return null;
  }
}

function adminAuth(req, res, next) {
  let token = req.header("x-admin-token") || req.header("x-admin-password") || "";
  const authHeader = req.header("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  const expectedMaster = process.env.ADMIN_PASSWORD || "change-me-please";

  // 1. Check master password
  if (token && token === expectedMaster) {
    req.admin = { id: 1, name: "National Super Administrator", email: "admin@ges.gov.gh", role: "Super Admin", status: "Active" };
    return next();
  }

  // 2. Check signed token
  if (token && token.includes(".")) {
    const payload = verifyAdminToken(token);
    if (payload && payload.id) {
      const admin = db.prepare("SELECT id, name, email, phone_number, role, status FROM admins WHERE id = ?").get(payload.id);
      if (admin && admin.status === "Active") {
        req.admin = admin;
        return next();
      }
    }
  }

  // 3. Check admin ID header
  const adminId = req.header("x-admin-id");
  if (adminId) {
    const admin = db.prepare("SELECT id, name, email, phone_number, role, status FROM admins WHERE id = ?").get(adminId);
    if (admin && admin.status === "Active") {
      req.admin = admin;
      return next();
    }
  }

  // 4. Fallback: check if token matches an active admin email
  if (token) {
    const admin = db.prepare("SELECT id, name, email, phone_number, role, status FROM admins WHERE LOWER(email) = LOWER(?)").get(token.trim());
    if (admin && admin.status === "Active") {
      req.admin = admin;
      return next();
    }
  }

  return res.status(401).json({ error: "Unauthorized. Admin credentials required." });
}

function generateTrainerToken(trainer) {
  const payload = {
    trainerId: trainer.id,
    name: trainer.name,
    email: trainer.email,
    contactNumber: trainer.contact_number,
    role: "National Master Trainer",
    status: trainer.status,
    iat: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function trainerOrAdminAuth(req, res, next) {
  let token = req.header("x-admin-token") || req.header("x-admin-password") || req.header("x-trainer-token") || "";
  const authHeader = req.header("authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  const expectedMaster = process.env.ADMIN_PASSWORD || "change-me-please";
  if (token && token === expectedMaster) {
    req.admin = { id: 1, name: "National Super Administrator", email: "admin@ges.gov.gh", role: "Super Admin", status: "Active" };
    return next();
  }

  if (token && token.includes(".")) {
    const payload = verifyAdminToken(token);
    if (payload) {
      if (payload.id) {
        const admin = db.prepare("SELECT id, name, email, phone_number, role, status FROM admins WHERE id = ?").get(payload.id);
        if (admin && admin.status === "Active") {
          req.admin = admin;
          return next();
        }
      }
      if (payload.trainerId) {
        const trainer = db.prepare("SELECT id, name, place_of_work, schedule_role, contact_number, email, status FROM national_trainers WHERE id = ?").get(payload.trainerId);
        if (trainer && trainer.status === "Active") {
          req.trainer = trainer;
          req.userRole = "National Master Trainer";
          return next();
        }
      }
    }
  }

  // Fallback: check admin token
  adminAuth(req, res, (err) => {
    if (!err && req.admin) {
      return next();
    }
    return res.status(401).json({ error: "Unauthorized. Facilitator or Administrator access required." });
  });
}

module.exports = adminAuth;
module.exports.generateAdminToken = generateAdminToken;
module.exports.verifyAdminToken = verifyAdminToken;
module.exports.generateTrainerToken = generateTrainerToken;
module.exports.trainerOrAdminAuth = trainerOrAdminAuth;

