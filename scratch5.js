const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `    for (const d of districts) {
      const exists = db.prepare("SELECT id FROM registrations WHERE district = ? AND cohort_id = ? AND roles LIKE '%IT Person%'").get(d.district, cohortId);
      if (!exists) {`;

const replace = `    for (const d of districts) {
      let exists = false;
      if (supabase) {
        try {
          const { data } = await supabase.from("registrations").select("id, roles").eq("district", d.district).eq("cohort_id", cohortId);
          if (data && data.length > 0) {
            exists = data.some(r => {
              try {
                const rolesArr = typeof r.roles === 'string' ? JSON.parse(r.roles) : r.roles;
                return (rolesArr || []).some(role => String(role).toLowerCase().includes('it person'));
              } catch(e) { return false; }
            });
          }
        } catch(e) {}
      }
      if (!exists) {
        const localExists = db.prepare("SELECT id FROM registrations WHERE district = ? AND cohort_id = ? AND roles LIKE '%IT Person%'").get(d.district, cohortId);
        if (localExists) exists = true;
      }

      if (!exists) {`;

if (code.includes(target)) {
  code = code.replace(target, replace);
  console.log("REPLACED");
} else {
  console.log("NOT FOUND");
}

fs.writeFileSync('backend/routes/registrations.js', code);
