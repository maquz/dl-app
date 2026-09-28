const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `  if (existing) {
    const nominee = formatNomineeRecord(existing);
    return res.status(409).json({
      error: \`A nomination registration with phone "\${phoneNumber}" already exists for \${existing.officer_name}.\`,
      existingReference: generateRefCode(existing.id, existing.region),
      hasRegistered: true,
      nominee,
    });
  }`;

const replacement = `  if (existing) {
    const nominee = formatNomineeRecord(existing);
    return res.status(409).json({
      error: \`A nomination registration already exists for \${existing.officer_name}.\`,
      existingReference: generateRefCode(existing.id, existing.region),
      hasRegistered: true,
      nominee,
    });
  }`;

if (code.includes(target)) {
  fs.writeFileSync('backend/routes/registrations.js', code.replace(target, replacement));
  console.log("Message fixed!");
} else {
  console.log("Message target not found!");
}
