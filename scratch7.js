const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `// POST /api/registrations/stub - create a placeholder registration for tablet tracking (admin only)`;

const replace = `// POST /api/registrations/stub/cleanup - admin only
router.post("/stub/cleanup", adminAuth, async (req, res) => {
  try {
    let count = 0;
    if (supabase) {
      // Get all stubs
      const { data: stubs } = await supabase.from("registrations").select("id, district, cohort_id").eq("officer_name", "Pending Registration").like("phone_number", "STUB-%");
      if (stubs) {
        for (const stub of stubs) {
          // Check if real IT person exists for this district
          const { data: realUsers } = await supabase.from("registrations").select("id, roles").eq("district", stub.district).eq("cohort_id", stub.cohort_id).neq("id", stub.id);
          if (realUsers && realUsers.length > 0) {
            const hasRealIt = realUsers.some(r => {
              try {
                const rolesArr = typeof r.roles === 'string' ? JSON.parse(r.roles) : r.roles;
                return (rolesArr || []).some(role => String(role).toLowerCase().includes('it person'));
              } catch(e) { return false; }
            });
            if (hasRealIt) {
              await supabase.from("registrations").delete().eq("id", stub.id);
              db.prepare("DELETE FROM registrations WHERE id = ?").run(stub.id);
              count++;
            }
          }
        }
      }
    }
    res.json({ success: true, deleted: count });
  } catch (err) {
    res.status(500).json({ error: "Cleanup failed" });
  }
});

// POST /api/registrations/stub - create a placeholder registration for tablet tracking (admin only)`;

if (code.includes(target)) {
  code = code.replace(target, replace);
  console.log("REPLACED CLEANUP");
}

fs.writeFileSync('backend/routes/registrations.js', code);
