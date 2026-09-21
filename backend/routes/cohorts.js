const express = require("express");
const db = require("../db");
const adminAuth = require("../middleware/adminAuth");
const { trainerOrAdminAuth } = require("../middleware/adminAuth");

const router = express.Router();

// Helper to match district & region directly to its official assigned cohort
function findCohortForDistrict(region, district) {
  if (!region || !district) return null;
  try {
    const cohortDistricts = require("../data/cohort_districts.json");
    const normReg = region.trim().toLowerCase();
    const normDist = district.trim().toLowerCase();
    for (const [cohortIdStr, info] of Object.entries(cohortDistricts)) {
      const match = info.districts.find(
        (d) => d.region.toLowerCase() === normReg && d.district.toLowerCase() === normDist
      );
      if (match) {
        return db.prepare("SELECT * FROM cohorts WHERE id = ?").get(Number(cohortIdStr));
      }
    }
  } catch (err) {
    console.error("Error matching district cohort:", err);
  }
  return null;
}

// Helper to calculate next available cohort based on capacities
async function findNextAvailableCohort() {
  const cohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
  const supabase = require("../supabase");
  
  let useSupabase = false;
  let counts = {};

  if (supabase) {
    try {
      const { data, error } = await supabase.from("registrations").select("cohort_id");
      if (data && !error) {
        useSupabase = true;
        for (const r of data) {
          if (r.cohort_id) counts[r.cohort_id] = (counts[r.cohort_id] || 0) + 1;
        }
      }
    } catch(e) {}
  }

  if (!useSupabase) {
    const regCounts = db.prepare("SELECT cohort_id, COUNT(*) as count FROM registrations WHERE cohort_id IS NOT NULL GROUP BY cohort_id").all();
    for (const r of regCounts) {
      counts[r.cohort_id] = r.count;
    }
  }

  for (const c of cohorts) {
    const count = counts[c.id] || 0;
    if (count < c.expected_participants) {
      return c;
    }
  }

  // If all filled, return last cohort as fallback
  return cohorts[cohorts.length - 1] || null;
}

// GET /api/cohorts - List all cohorts (public)
router.get("/", (req, res) => {
  const cohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
  res.json({ cohorts });
});

// GET /api/cohorts/district-map - Official district-to-cohort distribution map (public)
router.get("/district-map", (req, res) => {
  try {
    const cohortDistricts = require("../data/cohort_districts.json");
    res.json(cohortDistricts);
  } catch {
    res.json({});
  }
});

// GET /api/cohorts/stats - Real-time registration vs capacity stats
router.get("/stats", trainerOrAdminAuth, async (req, res) => {
  const cohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
  
  let cohortDistricts = {};
  try {
    cohortDistricts = require("../data/cohort_districts.json");
  } catch (e) {}

  const supabase = require("../supabase");
  let registrationsData = [];
  let unassignedCount = 0;
  let useSupabase = false;

  if (supabase) {
    try {
      const { data, error } = await supabase.from("registrations").select("cohort_id, attendance_status, region, district");
      if (data && !error) {
        useSupabase = true;
        registrationsData = data;
      }
    } catch (e) {
      console.error("Supabase cohort stats error:", e);
    }
  }

  if (!useSupabase) {
    registrationsData = db.prepare("SELECT cohort_id, attendance_status, region, district FROM registrations").all();
  }

  const countsMap = {};
  const districtStatsMap = {};

  // Initialize district stats for each cohort based on official mapping
  for (const c of cohorts) {
    countsMap[c.id] = { allocated: 0, attended: 0, absent: 0, pending: 0 };
    districtStatsMap[c.id] = {};
    
    if (cohortDistricts[c.id]) {
      for (const d of cohortDistricts[c.id].districts) {
        const key = `${d.region.trim().toLowerCase()}|${d.district.trim().toLowerCase()}`;
        districtStatsMap[c.id][key] = {
          region: d.region,
          district: d.district,
          expected: 3,
          registered: 0,
          attended: 0
        };
      }
    }
  }

  for (const r of registrationsData) {
    if (!r.cohort_id) {
      unassignedCount++;
      continue;
    }

    if (!countsMap[r.cohort_id]) {
      countsMap[r.cohort_id] = { allocated: 0, attended: 0, absent: 0, pending: 0 };
    }
    const cm = countsMap[r.cohort_id];
    cm.allocated++;
    if (r.attendance_status === 'Attended') cm.attended++;
    else if (r.attendance_status === 'Absent') cm.absent++;
    else cm.pending++;

    // Update district breakdown
    if (!districtStatsMap[r.cohort_id]) districtStatsMap[r.cohort_id] = {};
    const dMap = districtStatsMap[r.cohort_id];
    
    const regNorm = (r.region || "").trim().toLowerCase();
    const distNorm = (r.district || "").trim().toLowerCase();
    const key = `${regNorm}|${distNorm}`;
    
    if (!dMap[key]) {
       dMap[key] = {
         region: r.region || "Unknown",
         district: r.district || "Unknown",
         expected: 3, 
         registered: 0,
         attended: 0
       };
    }
    
    dMap[key].registered++;
    if (r.attendance_status === 'Attended') {
       dMap[key].attended++;
    }
  }

  let grandExpected = 0;
  let grandAllocated = 0;
  let grandAttended = 0;

  const enrichedCohorts = cohorts.map((c) => {
    const stats = countsMap[c.id] || { allocated: 0, attended: 0, absent: 0, pending: 0 };
    const allocated = stats.allocated;
    const attended = stats.attended;
    const expected = c.expected_participants;
    const remaining = Math.max(0, expected - allocated);
    const capacityPercent = expected > 0 ? Math.min(100, Math.round((allocated / expected) * 100)) : 0;
    const attendancePercent = allocated > 0 ? Math.round((attended / allocated) * 100) : 0;

    grandExpected += expected;
    grandAllocated += allocated;
    grandAttended += attended;

    const districtBreakdown = Object.values(districtStatsMap[c.id] || {}).map(d => ({
      ...d,
      remainingSeats: Math.max(0, d.expected - d.registered)
    })).sort((a, b) => a.district.localeCompare(b.district));

    return {
      id: c.id,
      name: c.name,
      arrivalDate: c.arrival_date,
      arrivalDateIso: c.arrival_date_iso,
      startDate: c.start_date,
      startDateIso: c.start_date_iso,
      endDate: c.end_date,
      endDateIso: c.end_date_iso,
      departureDate: c.departure_date,
      departureDateIso: c.departure_date_iso,
      expectedParticipants: expected,
      allocatedCount: allocated,
      remainingSlots: remaining,
      capacityPercent,
      attendedCount: attended,
      absentCount: stats.absent,
      pendingCount: stats.pending,
      attendancePercent,
      districtBreakdown
    };
  });

  res.json({
    summary: {
      totalCohorts: cohorts.length,
      grandExpected,
      grandAllocated,
      grandAttended,
      unassignedCount,
      overallCapacityPercent: grandExpected > 0 ? Math.round((grandAllocated / grandExpected) * 100) : 0,
      overallAttendancePercent: grandAllocated > 0 ? Math.round((grandAttended / grandAllocated) * 100) : 0,
    },
    cohorts: enrichedCohorts,
  });
});

// PATCH /api/cohorts/attendance/:id - Update attendance status (admin only)
router.patch("/attendance/:id", adminAuth, async (req, res) => {
  const id = req.params.id;
  const { status, notes } = req.body;

  const validStatuses = ["Registered", "Attended", "Absent", "Excused"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid attendance status. Must be Registered, Attended, Absent, or Excused." });
  }

  const attendedAt = status === "Attended" ? new Date().toISOString() : null;

  // Supabase sync
  const supabase = require("../supabase");
  if (supabase) {
    try {
      await supabase.from("registrations").update({
        attendance_status: status,
        checked_in_at: attendedAt,
        check_in_notes: notes ? notes.trim() : null
      }).eq("id", id);
    } catch (e) {
      console.error("Supabase attendance update error:", e.message);
    }
  }

  const info = db.prepare(`
    UPDATE registrations
    SET attendance_status = ?, attended_at = ?, check_in_notes = COALESCE(?, check_in_notes)
    WHERE id = ?
  `).run(status, attendedAt, notes ? notes.trim() : null, id);

  if (info.changes === 0) {
    return res.status(404).json({ error: "Registration not found." });
  }

  const updated = db.prepare(`
    SELECT r.*, c.name as cohort_name, c.arrival_date as cohort_arrival_date
    FROM registrations r
    LEFT JOIN cohorts c ON r.cohort_id = c.id
    WHERE r.id = ?
  `).get(id);

  res.json({
    message: `Attendance marked as "${status}".`,
    registration: updated,
  });
});

// PATCH /api/cohorts/allocate/:id - Allocate or reassign a nominee to a cohort (admin only)
router.patch("/allocate/:id", adminAuth, async (req, res) => {
  const id = req.params.id;
  const { cohortId } = req.body;

  let cohort = null;
  if (cohortId) {
    cohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(cohortId);
    if (!cohort) {
      return res.status(400).json({ error: "Invalid Cohort ID." });
    }
  }

  const arrivalDate = cohort ? cohort.arrival_date : null;

  // Supabase sync
  const supabase = require("../supabase");
  if (supabase) {
    try {
      await supabase.from("registrations").update({
        cohort_id: cohortId ? Number(cohortId) : null,
        arrival_date: arrivalDate
      }).eq("id", id);
    } catch (e) {
      console.error("Supabase allocation update error:", e.message);
    }
  }

  const info = db.prepare(`
    UPDATE registrations
    SET cohort_id = ?, arrival_date = ?
    WHERE id = ?
  `).run(cohortId || null, arrivalDate, id);

  if (info.changes === 0) {
    return res.status(404).json({ error: "Registration not found." });
  }

  const updated = db.prepare(`
    SELECT r.*, c.name as cohort_name, c.arrival_date as cohort_arrival_date
    FROM registrations r
    LEFT JOIN cohorts c ON r.cohort_id = c.id
    WHERE r.id = ?
  `).get(id);

  res.json({
    message: cohort ? `Allocated to ${cohort.name}.` : "Cohort unassigned.",
    cohortId: cohortId || null,
    cohort,
    arrivalDate,
    registration: updated,
  });
});

module.exports = router;
module.exports.findNextAvailableCohort = findNextAvailableCohort;
module.exports.findCohortForDistrict = findCohortForDistrict;
