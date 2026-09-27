require('dotenv').config();
const db = require('./db');
const supabase = require('./supabase');
const cohortDistrictsMap = require('./data/cohort_districts.json');

async function run() {
  const cohortId = 3;
  const districts = cohortDistrictsMap[cohortId].districts;
  let generatedCount = 0;
  const rolesJSON = JSON.stringify(["DL District Trainer - IT Person (DL Dashboard)"]);

  for (const d of districts) {
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
      const stubPhone = `STUB-${cohortId}-${d.district.replace(/\s+/g, '')}`;
      let lastInsertRowid = Date.now() + Math.floor(Math.random() * 1000); // Mock ID just in case
      try {
         const result = db.prepare(`
          INSERT INTO registrations (
            officer_name, sex, phone_number, region, district, institution_name, roles, cohort_id, attendance_status
          ) VALUES (
            'Pending Registration', 'Male', ?, ?, ?, 'Pending', ?, ?, 'Registered'
          )
        `).run(stubPhone, d.region, d.district, rolesJSON, cohortId);
        lastInsertRowid = result.lastInsertRowid;
      } catch (e) { console.log(e); }

      if (supabase) {
        // Need to explicitly get max ID from supabase if we want to avoid sequence errors
        const { data: maxData } = await supabase.from("registrations").select("id").order("id", { ascending: false }).limit(1);
        const newId = maxData && maxData.length > 0 ? maxData[0].id + 1 + generatedCount : lastInsertRowid;
        
        const { error } = await supabase.from("registrations").insert([{
          id: newId,
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
        if (error) console.error("Supabase Error:", error);
        else console.log(`Created stub for ${d.district} (Cohort 3)`);
      }
      generatedCount++;
    }
  }
  console.log(`Successfully generated ${generatedCount} trackers for Cohort 3.`);
  process.exit(0);
}

run();
