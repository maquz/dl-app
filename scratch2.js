const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const replacement = `// POST /api/registrations/stub/generate-all - admin only
router.post("/stub/generate-all", adminAuth, async (req, res) => {
  const { cohortId } = req.body;
  if (!cohortId) return res.status(400).json({ error: "cohortId required." });

  try {
    const { fetchCohortDistrictMap } = require("./cohorts"); // we'll fetch from DB
    // actually let's just get the districts mapped to this cohort directly
    const districts = db.prepare("SELECT region, district FROM cohort_districts WHERE cohort_id = ?").all(cohortId);
    if (!districts || districts.length === 0) {
      return res.status(404).json({ error: "No districts found for this cohort." });
    }

    let generatedCount = 0;
    const rolesJSON = JSON.stringify(["DL District Trainer - IT Person (DL Dashboard)"]);

    for (const d of districts) {
      const exists = db.prepare("SELECT id FROM registrations WHERE district = ? AND cohort_id = ? AND roles LIKE '%IT Person%'").get(d.district, cohortId);
      if (!exists) {
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
      }
    }
    res.json({ success: true, generatedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate missing IT persons." });
  }
});

// POST /api/registrations/stub - create a placeholder registration for tablet tracking (admin only)
router.post("/stub", adminAuth, async (req, res) => {`;

code = code.replace(`// POST /api/registrations/stub - create a placeholder registration for tablet tracking (admin only)
router.post("/stub", adminAuth, async (req, res) => {`, replacement);

fs.writeFileSync('backend/routes/registrations.js', code);
console.log('DONE');
