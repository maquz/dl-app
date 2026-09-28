const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `  if (!existing && formattedEmail) {
    existing = db
      .prepare("SELECT * FROM registrations WHERE LOWER(email) = LOWER(?)")
      .get(formattedEmail);
  }`;

const replacement = `  if (!existing && formattedEmail) {
    existing = db
      .prepare("SELECT * FROM registrations WHERE LOWER(email) = LOWER(?)")
      .get(formattedEmail);
  }

  if (!existing) {
    existing = db
      .prepare("SELECT * FROM registrations WHERE LOWER(officer_name) = LOWER(?) AND district = ?")
      .get(officerName.trim(), district.trim());
  }`;

if (code.includes(target)) {
  fs.writeFileSync('backend/routes/registrations.js', code.replace(target, replacement));
  console.log("SQLite check added successfully!");
} else {
  console.log("SQLite target not found!");
}
