const db = require('./backend/db');
let supabase = null;
try { supabase = require('./backend/supabase'); } catch(e) {}

async function fixCohort6() {
  if (!supabase) {
    console.log("Supabase not configured!");
    return;
  }
  
  const cohort6 = db.prepare('SELECT * FROM cohorts WHERE id = 6').get();
  if (!cohort6) {
    console.log("Cohort 6 not found in DB!");
    return;
  }

  try {
    const { data: allRegs, error } = await supabase.from('registrations')
      .select('id, officer_name, cohort_id, submitted_at')
      .gte('submitted_at', '2026-10-07T00:00:00.000Z');
      
    if (error) {
      console.error(error);
      return;
    }
    
    let updatedCount = 0;
    for (const reg of allRegs) {
      if (reg.cohort_id !== 6) {
        console.log(`Updating ${reg.officer_name} from Cohort ${reg.cohort_id} to Cohort 6 (submitDate: ${reg.submitted_at})`);
        await supabase.from('registrations').update({ cohort_id: 6, arrival_date: cohort6.arrival_date }).eq('id', reg.id);
        
        // Also update local DB for consistency
        db.prepare('UPDATE registrations SET cohort_id = 6, arrival_date = ? WHERE id = ?').run(cohort6.arrival_date, reg.id);
        
        updatedCount++;
      }
    }
    console.log(`Migrated ${updatedCount} recent registrations to Cohort 6 on Supabase.`);
  } catch(e) {
    console.error(e);
  }
}
fixCohort6();
