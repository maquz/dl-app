const express = require("express");
const db = require("../db");
const adminAuth = require("../middleware/adminAuth");

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
function findNextAvailableCohort() {
  const cohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
  for (const c of cohorts) {
    const countRow = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE cohort_id = ?").get(c.id);
    const count = countRow ? countRow.count : 0;
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

// GET /api/cohorts/stats - Detailed cohort KPIs, capacity, and attendance (admin only)
router.get("/stats", adminAuth, (req, res) => {
  const cohorts = db.prepare("SELECT * FROM cohorts ORDER BY id ASC").all();
  const regCounts = db.prepare(`
    SELECT 
      cohort_id,
      COUNT(*) as allocated_count,
      SUM(CASE WHEN attendance_status = 'Attended' THEN 1 ELSE 0 END) as attended_count,
      SUM(CASE WHEN attendance_status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
      SUM(CASE WHEN attendance_status = 'Registered' OR attendance_status IS NULL THEN 1 ELSE 0 END) as pending_count
    FROM registrations
    WHERE cohort_id IS NOT NULL
    GROUP BY cohort_id
  `).all();

  const countsMap = {};
  for (const r of regCounts) {
    countsMap[r.cohort_id] = {
      allocated: r.allocated_count || 0,
      attended: r.attended_count || 0,
      absent: r.absent_count || 0,
      pending: r.pending_count || 0,
    };
  }

  // Unassigned registrations count
  const unassignedRow = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE cohort_id IS NULL").get();
  const unassignedCount = unassignedRow ? unassignedRow.count : 0;

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
