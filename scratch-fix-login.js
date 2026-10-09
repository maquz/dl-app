const fs = require('fs');
let code = fs.readFileSync('backend/routes/nationalTrainers.js', 'utf8');

const targetStr = 'const { data } = await supabase.from("national_trainers").select("*").or(`email.ilike.${cleanId},contact_number.eq.${cleanId},contact_number.ilike.%${digitsOnly}%`).maybeSingle();';

const repStr = `let orQuery = \`email.ilike.\${cleanId},contact_number.eq.\${cleanId}\`;
      if (digitsOnly) orQuery += \`,contact_number.ilike.%\${digitsOnly}%\`;
      const { data } = await supabase.from("national_trainers").select("*").or(orQuery).maybeSingle();`;

if (code.includes(targetStr)) {
  code = code.replace(targetStr, repStr);
  fs.writeFileSync('backend/routes/nationalTrainers.js', code);
  console.log("Login query fixed.");
} else {
  console.log("Target string not found in nationalTrainers.js.");
}
