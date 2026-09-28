const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `      if (formattedEmail) {
        const { data: existEmail } = await supabase
          .from("registrations")
          .select("*")
          .ilike("email", formattedEmail)
          .maybeSingle();

        if (existEmail) {
          const nominee = formatNomineeRecord(existEmail);
          return res.status(409).json({
            error: \`A nomination registration with email "\${formattedEmail}" already exists for \${existEmail.officer_name}.\`,
            existingReference: generateRefCode(existEmail.id, existEmail.region),
            hasRegistered: true,
            nominee,
          });
        }
      }`;

const replacement = `      if (formattedEmail) {
        const { data: existEmail } = await supabase
          .from("registrations")
          .select("*")
          .ilike("email", formattedEmail)
          .maybeSingle();

        if (existEmail) {
          const nominee = formatNomineeRecord(existEmail);
          return res.status(409).json({
            error: \`A nomination registration with email "\${formattedEmail}" already exists for \${existEmail.officer_name}.\`,
            existingReference: generateRefCode(existEmail.id, existEmail.region),
            hasRegistered: true,
            nominee,
          });
        }
      }

      // Check Name & District match
      const { data: existName } = await supabase
        .from("registrations")
        .select("*")
        .ilike("officer_name", officerName.trim())
        .eq("district", district.trim())
        .maybeSingle();

      if (existName) {
        const nominee = formatNomineeRecord(existName);
        return res.status(409).json({
          error: \`A nomination registration for "\${existName.officer_name}" already exists in \${district}.\`,
          existingReference: generateRefCode(existName.id, existName.region),
          hasRegistered: true,
          nominee,
        });
      }`;

if (code.includes(target)) {
  fs.writeFileSync('backend/routes/registrations.js', code.replace(target, replacement));
  console.log("Supabase check added successfully!");
} else {
  console.log("Supabase target not found!");
}
