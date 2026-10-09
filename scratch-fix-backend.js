const fs = require('fs');
let code = fs.readFileSync('backend/routes/nationalTrainers.js', 'utf8');

// 1. Fix insert logic
const insertTarget = `  let insertedId = null;

  if (supabase) {
    try {
      const { data, error } = await supabase.from("national_trainers").insert([{
        name: name.trim(),
        place_of_work: placeOfWork ? placeOfWork.trim() : "",
        schedule_role: scheduleRole.trim(),
        contact_number: cleanPhone,
        email: email ? email.trim() : null,
        password_hash: passwordHash,
        status
      }]).select().single();`;

const insertReplacement = `  let insertedId = null;

  if (supabase) {
    try {
      // Manually calculate next ID to bypass broken auto-increment sequences
      const { data: maxData } = await supabase.from("national_trainers").select("id").order("id", { ascending: false }).limit(1);
      const nextId = maxData && maxData.length > 0 ? maxData[0].id + 1 : 1;

      const { data, error } = await supabase.from("national_trainers").insert([{
        id: nextId,
        name: name.trim(),
        place_of_work: placeOfWork ? placeOfWork.trim() : "",
        schedule_role: scheduleRole.trim(),
        contact_number: cleanPhone,
        email: email ? email.trim() : null,
        password_hash: passwordHash,
        status
      }]).select().single();`;

if (code.includes(insertTarget)) {
  code = code.replace(insertTarget, insertReplacement);
  console.log("Insert logic updated.");
}

// 2. Add /recover endpoint right before module.exports
const recoverEndpoint = `

// POST /api/national-trainers/recover - Public password recovery for trainers
router.post("/recover", async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ error: "Contact number or email is required." });

  const cleanId = identifier.trim();
  const digitsOnly = cleanId.replace(/\\D/g, "");

  let orQuery = \`email.ilike.\${cleanId},contact_number.eq.\${cleanId}\`;
  if (digitsOnly) orQuery += \`,contact_number.ilike.%\${digitsOnly}%\`;

  let trainer = null;
  const supabase = require("../supabase");
  const db = require("../db");

  if (supabase) {
    try {
      const { data } = await supabase.from("national_trainers").select("*").or(orQuery).maybeSingle();
      if (data) trainer = data;
    } catch (e) {}
  }
  if (!trainer) {
    trainer = db.prepare(\`SELECT * FROM national_trainers WHERE LOWER(email) = LOWER(?) OR contact_number = ? OR REPLACE(contact_number, '-', '') = ?\`).get(cleanId, cleanId, digitsOnly);
  }

  if (!trainer) {
    return res.status(404).json({ error: "No National Master Trainer found with this contact/email." });
  }

  const defaultPass = trainer.contact_number.replace(/\\D/g, "") || "trainer2026";
  const { hashPassword } = require("../utils/auth");
  const newHash = hashPassword(defaultPass);

  if (supabase) {
    await supabase.from("national_trainers").update({ password_hash: newHash }).eq("id", trainer.id);
  }
  db.prepare("UPDATE national_trainers SET password_hash = ? WHERE id = ?").run(newHash, trainer.id);

  res.json({ success: true, message: "Your password has been successfully reset to your contact number (digits only)." });
});

module.exports = router;`;

code = code.replace(/module\.exports = router;\s*$/, recoverEndpoint);

fs.writeFileSync('backend/routes/nationalTrainers.js', code);
console.log("Backend fixes applied.");
