const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const targetFunc = `      if (!exists) {
        const stubPhone = \`STUB-\${cohortId}-\${d.district.replace(/\\s+/g, '')}\`;
        const result = db.prepare(\`
          INSERT INTO registrations (
            officer_name, sex, phone_number, region, district, institution_name, roles, cohort_id, attendance_status
          ) VALUES (
            'Pending Registration', 'Male', ?, ?, ?, 'Pending', ?, ?, 'Registered'
          )
        \`).run(stubPhone, d.region, d.district, rolesJSON, cohortId);

        if (supabase) {
          await supabase.from("registrations").insert([{
            id: result.lastInsertRowid,
            officer_name: 'Pending Registration',
            sex: 'Male',
            phone_number: stubPhone,
            region: d.region,
            district: d.district,
            institution_name: 'Pending',
            roles: ["DL District Trainer - IT Person (DL Dashboard)"],
            cohort_id: cohortId,
            attendance_status: 'Registered'
          }]);
        }
        generatedCount++;
      }`;

const replaceFunc = `      if (!exists) {
        const stubPhone = \`STUB-\${cohortId}-\${d.district.replace(/\\s+/g, '')}\`;
        
        let insertId = null;
        if (supabase) {
          try {
            const { data: maxRow } = await supabase
              .from("registrations")
              .select("id")
              .order("id", { ascending: false })
              .limit(1)
              .single();
            insertId = maxRow ? maxRow.id + 1 : 100;
            
            const { error } = await supabase.from("registrations").insert([{
              id: insertId,
              officer_name: 'Pending Registration',
              sex: 'Male',
              phone_number: stubPhone,
              region: d.region,
              district: d.district,
              institution_name: 'Pending',
              roles: ["DL District Trainer - IT Person (DL Dashboard)"],
              cohort_id: cohortId,
              attendance_status: 'Registered'
            }]);
            
            if (error) {
               // Fallback if explicit id fails
               const { data: fbRow } = await supabase.from("registrations").insert([{
                  officer_name: 'Pending Registration',
                  sex: 'Male',
                  phone_number: stubPhone,
                  region: d.region,
                  district: d.district,
                  institution_name: 'Pending',
                  roles: ["DL District Trainer - IT Person (DL Dashboard)"],
                  cohort_id: cohortId,
                  attendance_status: 'Registered'
               }]).select().single();
               if (fbRow) insertId = fbRow.id;
            }
          } catch(e) {
            console.error(e);
          }
        }
        
        try {
          if (insertId) {
             db.prepare(\`
              INSERT INTO registrations (
                id, officer_name, sex, phone_number, region, district, institution_name, roles, cohort_id, attendance_status
              ) VALUES (
                ?, 'Pending Registration', 'Male', ?, ?, ?, 'Pending', ?, ?, 'Registered'
              )
            \`).run(insertId, stubPhone, d.region, d.district, rolesJSON, cohortId);
          } else {
             db.prepare(\`
              INSERT INTO registrations (
                officer_name, sex, phone_number, region, district, institution_name, roles, cohort_id, attendance_status
              ) VALUES (
                'Pending Registration', 'Male', ?, ?, ?, 'Pending', ?, ?, 'Registered'
              )
            \`).run(stubPhone, d.region, d.district, rolesJSON, cohortId);
          }
        } catch(err) {}
        
        generatedCount++;
      }`;

if (code.includes(targetFunc)) {
  code = code.replace(targetFunc, replaceFunc);
  fs.writeFileSync('backend/routes/registrations.js', code);
  console.log("Success replacing generate-all");
} else {
  console.log("Target not found");
}
