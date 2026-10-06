const db = require('./backend/db');
let supabase = null;
try { supabase = require('./backend/supabase'); } catch(e) {}

async function fixCohorts() {
  const cohorts = db.prepare('SELECT * FROM cohorts ORDER BY id ASC').all();
  const cohortsMap = {};
  cohorts.forEach(c => cohortsMap[c.id] = c);

  const allRegs = db.prepare('SELECT id, officer_name, cohort_id, submitted_at FROM registrations WHERE cohort_id IS NOT NULL AND submitted_at IS NOT NULL').all();
  
  let updatedCount = 0;
  for (const reg of allRegs) {
    const submitDate = reg.submitted_at.split('T')[0];
    const assigned = cohortsMap[reg.cohort_id];
    if (assigned && assigned.departure_date_iso < submitDate) {
      // Find the cohort that was active on the submit date
      let active = cohorts.find(c => submitDate >= c.arrival_date_iso && submitDate <= c.departure_date_iso);
      if (!active) {
        active = cohorts.find(c => c.arrival_date_iso >= submitDate);
      }
      if (active && active.id !== reg.cohort_id) {
        console.log(`Updating ${reg.officer_name} from Cohort ${reg.cohort_id} to Cohort ${active.id}`);
        db.prepare('UPDATE registrations SET cohort_id = ?, arrival_date = ? WHERE id = ?').run(active.id, active.arrival_date, reg.id);
        
        if (supabase) {
          try {
            await supabase.from('registrations').update({ cohort_id: active.id, arrival_date: active.arrival_date }).eq('id', reg.id);
          } catch(e) {}
        }
        updatedCount++;
      }
    }
  }
  console.log(`Fixed ${updatedCount} old registrations.`);
}
fixCohorts();
