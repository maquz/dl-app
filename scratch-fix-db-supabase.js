const db = require('./backend/db');
let supabase = null;
try { supabase = require('./backend/supabase'); } catch(e) {}

async function fixCohorts() {
  if (!supabase) {
    console.log("Supabase not configured!");
    return;
  }
  
  const cohorts = db.prepare('SELECT * FROM cohorts ORDER BY id ASC').all();
  const cohortsMap = {};
  cohorts.forEach(c => cohortsMap[c.id] = c);

  try {
    const { data: allRegs, error } = await supabase.from('registrations').select('id, officer_name, cohort_id, submitted_at').not('submitted_at', 'is', null);
    if (error) {
      console.error(error);
      return;
    }
    
    let updatedCount = 0;
    for (const reg of allRegs) {
      if (!reg.cohort_id) continue;
      const submitDate = reg.submitted_at.split('T')[0];
      const assigned = cohortsMap[reg.cohort_id];
      if (assigned && assigned.departure_date_iso < submitDate) {
        // Find the cohort that was active on the submit date
        let active = cohorts.find(c => submitDate >= c.arrival_date_iso && submitDate <= c.departure_date_iso);
        if (!active) {
          active = cohorts.find(c => c.arrival_date_iso >= submitDate);
        }
        if (active && active.id !== reg.cohort_id) {
          console.log(`Updating ${reg.officer_name} from Cohort ${reg.cohort_id} to Cohort ${active.id} (submitDate: ${submitDate})`);
          await supabase.from('registrations').update({ cohort_id: active.id, arrival_date: active.arrival_date }).eq('id', reg.id);
          updatedCount++;
        }
      }
    }
    console.log(`Fixed ${updatedCount} old registrations on Supabase.`);
  } catch(e) {
    console.error(e);
  }
}
fixCohorts();
