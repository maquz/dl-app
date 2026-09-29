const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `      if (existName) {
        const nominee = formatNomineeRecord(existName);
        return res.status(409).json({
          error: \`A nomination registration for "\${existName.officer_name}" already exists in \${district}.\`,
          existingReference: generateRefCode(existName.id, existName.region),
          hasRegistered: true,
          nominee,
        });
      }`;

const replacement = `      if (existName) {
        const nominee = formatNomineeRecord(existName);
        return res.status(409).json({
          error: \`A nomination registration for "\${existName.officer_name}" already exists in \${district}.\`,
          existingReference: generateRefCode(existName.id, existName.region),
          hasRegistered: true,
          nominee,
        });
      }

      // Check Role taken in this district
      // Ignore stubs ("Pending Registration") so IT Persons can still claim them
      const { data: districtUsers } = await supabase
        .from("registrations")
        .select("id, officer_name, roles")
        .eq("district", district.trim())
        .neq("officer_name", "Pending Registration");

      if (districtUsers) {
        for (const u of districtUsers) {
          let uRoles = [];
          try {
            uRoles = typeof u.roles === 'string' ? JSON.parse(u.roles) : (u.roles || []);
          } catch(e) {}
          
          for (const reqRole of roles) {
            if (uRoles.includes(reqRole)) {
               return res.status(409).json({
                 error: \`The role "\${reqRole}" has already been claimed by \${u.officer_name} for \${district.trim()}. Each role can only be registered once per district.\`
               });
            }
          }
        }
      }`;

if (code.includes(target)) {
  fs.writeFileSync('backend/routes/registrations.js', code.replace(target, replacement));
  console.log("Success adding role check");
} else {
  console.log("Target not found for role check");
}
