const XLSX = require("xlsx");
const express = require("express");
const db = require("../db");
const { trainerOrAdminAuth } = require("../middleware/adminAuth");

const router = express.Router();

/**
 * Calculates whether an assessment is locked for a candidate based on:
 * - Admin lock mode (scheduled, unlocked, locked)
 * - Candidate cohort arrival date or custom datetime
 * - Scheduled unlock time (default: 19:00 / 7:00 PM)
 */
function getAssessmentLockStatus(assessment, candidateCohortId = 1) {
  if (!assessment) {
    return { isLocked: true, statusText: "Assessment Not Found", unlockDateTimeIso: null, unlockDateFormatted: "Closed", unlockTime: null };
  }

  // Force Unlocked mode
  if (assessment.lock_mode === "unlocked" || assessment.lock_mode === "open_now") {
    return {
      isLocked: false,
      lockMode: "unlocked",
      statusText: "Open for Taking",
      unlockDateTimeIso: null,
      unlockDateFormatted: "Open Now",
      unlockTime: "Immediate",
    };
  }

  // Force Locked mode or inactive
  if (assessment.lock_mode === "locked" || assessment.lock_mode === "force_locked" || assessment.is_active === 0) {
    return {
      isLocked: true,
      lockMode: "locked",
      statusText: "Locked by Administrator",
      unlockDateTimeIso: null,
      unlockDateFormatted: "Locked",
      unlockTime: null,
    };
  }

  // Scheduled mode:
  const unlockTime = assessment.unlock_time || "19:00"; // default 7:00 PM
  const timeFormatted = unlockTime === "19:00" ? "7:00 PM" : (unlockTime.length === 5 ? unlockTime : "7:00 PM");

  // Custom datetime
  if (assessment.unlock_date_type === "custom" && assessment.custom_unlock_datetime) {
    const customDt = new Date(assessment.custom_unlock_datetime);
    const now = new Date();
    const isLocked = now < customDt;
    return {
      isLocked,
      lockMode: "scheduled",
      statusText: isLocked ? `Locked until ${customDt.toLocaleDateString()} at ${customDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : "Open",
      unlockDateTimeIso: assessment.custom_unlock_datetime,
      unlockDateFormatted: customDt.toLocaleDateString(),
      unlockTime: customDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  }

  // Cohort-based schedule (Pre-Test = arrival date at 7:00 PM; Post-Test = end date at 7:00 PM)
  const cohort = db.prepare("SELECT * FROM cohorts WHERE id = ?").get(candidateCohortId || 1) ||
                 db.prepare("SELECT * FROM cohorts WHERE id = 1").get();

  let unlockDateIso = "2026-09-20";
  let unlockDateFormatted = "Sunday, 20/09/2026";

  if (assessment.type === "Post-Test" || assessment.unlock_date_type === "end_date" || assessment.unlock_date_type === "departure_date") {
    unlockDateIso = cohort ? (cohort.end_date_iso || cohort.departure_date_iso) : "2026-09-22";
    unlockDateFormatted = cohort ? (cohort.end_date || cohort.departure_date) : "Tuesday, 22/09/2026";
  } else {
    unlockDateIso = cohort ? cohort.arrival_date_iso : "2026-09-20";
    unlockDateFormatted = cohort ? cohort.arrival_date : "Sunday, 20/09/2026";
  }

  const unlockDateTimeIso = `${unlockDateIso}T${unlockTime.length === 5 ? unlockTime + ":00" : unlockTime}`;
  const unlockTimestamp = new Date(unlockDateTimeIso).getTime();
  const nowTimestamp = Date.now();

  const isLocked = nowTimestamp < unlockTimestamp;

  return {
    isLocked,
    lockMode: "scheduled",
    statusText: isLocked ? `Locked until ${unlockDateFormatted} at ${timeFormatted}` : "Open",
    unlockDateTimeIso,
    unlockDateFormatted,
    unlockTime: timeFormatted,
    cohortName: cohort ? cohort.name : `Cohort ${candidateCohortId || 1}`,
  };
}

// GET /api/assessments - List all assessments (public or facilitator)
router.get("/", (req, res) => {
  const cohortId = req.query.cohort_id || req.query.cohortId || 1;
  const assessments = db.prepare(`
    SELECT 
      a.*,
      c.name as cohort_name,
      t.name as trainer_name,
      (SELECT COUNT(*) FROM assessment_questions WHERE assessment_id = a.id) as question_count,
      (SELECT COUNT(*) FROM assessment_submissions WHERE assessment_id = a.id) as submission_count,
      (SELECT AVG(percentage) FROM assessment_submissions WHERE assessment_id = a.id) as average_score
    FROM assessments a
    LEFT JOIN cohorts c ON a.cohort_id = c.id
    LEFT JOIN national_trainers t ON a.created_by_trainer_id = t.id
    ORDER BY a.id ASC
  `).all();

  const enriched = assessments.map((a) => {
    const lockInfo = getAssessmentLockStatus(a, cohortId);
    return {
      ...a,
      unlock_time: a.unlock_time || "19:00",
      unlock_date_type: a.unlock_date_type || (a.type === "Post-Test" ? "end_date" : "arrival_date"),
      lock_mode: a.lock_mode || "scheduled",
      lockInfo,
      isLocked: lockInfo.isLocked,
    };
  });

  res.json({ assessments: enriched });
});


// Sample question datasets for templates
const SAMPLE_PRE_TEST_QUESTIONS = [
  {
    "Question Number": 1,
    "Question Prompt": "What is the primary objective of Differentiated Learning (DL) in basic education classrooms?",
    "Question Type": "multiple_choice",
    "Option A": "Teaching all learners at the exact same pace with uniform lectures",
    "Option B": "Tailoring instruction and activities to meet learners' individual needs and current learning levels",
    "Option C": "Administering separate term-end examinations to each child",
    "Option D": "Standardizing classroom seating without assessing abilities",
    "Correct Answer": "B",
    "Points": 2,
    "Explanation": "Differentiated Learning adapts content, process, and products to match learner readiness."
  },
  {
    "Question Number": 2,
    "Question Prompt": "In formative assessment, how should baseline diagnostic assessment data be utilized?",
    "Question Type": "multiple_choice",
    "Option A": "Grouping learners into tiered instructional bands based on demonstrated foundational skills",
    "Option B": "Ranking pupils from highest to lowest on report cards",
    "Option C": "Assigning permanent classroom grades",
    "Option D": "Excluding struggling pupils from numeracy activities",
    "Correct Answer": "A",
    "Points": 2,
    "Explanation": "Baseline diagnostics guide targeted grouping and differentiated learning plans."
  },
  {
    "Question Number": 3,
    "Question Prompt": "Which classroom grouping strategy is most aligned with effective Differentiated Learning?",
    "Question Type": "multiple_choice",
    "Option A": "Fixed permanent seating that never changes throughout the academic year",
    "Option B": "Flexible, dynamic grouping based on specific learning tasks and ongoing formative assessment",
    "Option C": "Sorting learners strictly by age rather than demonstrated competency",
    "Option D": "Alphabetical seating arrangements",
    "Correct Answer": "B",
    "Points": 2,
    "Explanation": "Flexible grouping allows movement as learners master competencies."
  },
  {
    "Question Number": 4,
    "Question Prompt": "True or False: Differentiated learning requires a teacher to prepare 40 separate lesson plans for a class of 40 pupils.",
    "Question Type": "true_false",
    "Option A": "True",
    "Option B": "False",
    "Option C": "",
    "Option D": "",
    "Correct Answer": "B",
    "Points": 2,
    "Explanation": "DL uses tiered tasks and scaffolding around a single core learning objective."
  },
  {
    "Question Number": 5,
    "Question Prompt": "What are the three core curricular elements that can be differentiated in a lesson plan?",
    "Question Type": "multiple_choice",
    "Option A": "Content, Process, and Product",
    "Option B": "Time, Classroom Venue, and Uniforms",
    "Option C": "School fees, Attendance, and Punctuality",
    "Option D": "Age, Height, and Gender",
    "Correct Answer": "A",
    "Points": 2,
    "Explanation": "Teachers can differentiate what pupils learn (Content), how they make sense of it (Process), and how they demonstrate mastery (Product)."
  }
];

const SAMPLE_POST_TEST_QUESTIONS = [
  {
    "Question Number": 1,
    "Question Prompt": "How should a District Trainer guide teachers to design tiered instructional activities in Numeracy?",
    "Question Type": "multiple_choice",
    "Option A": "Provide different difficulty tiers/scaffolds of the same core mathematical competency",
    "Option B": "Teach entirely unrelated math topics to different pupils simultaneously",
    "Option C": "Focus instruction exclusively on high-achieving pupils",
    "Option D": "Eliminate concrete manipulatives for struggling learners",
    "Correct Answer": "A",
    "Points": 2,
    "Explanation": "Tiering provides appropriate challenge while keeping all learners focused on the core concept."
  },
  {
    "Question Number": 2,
    "Question Prompt": "What role does continuous formative assessment play during Differentiated Learning implementation?",
    "Question Type": "multiple_choice",
    "Option A": "It provides real-time feedback allowing teachers to adjust pedagogy and bridge learning gaps immediately",
    "Option B": "It serves solely as an administrative record for terminal report cards",
    "Option C": "It replaces all classroom teaching time with exams",
    "Option D": "It is only required for high school examination preparation",
    "Correct Answer": "A",
    "Points": 2,
    "Explanation": "Formative assessment informs pedagogy and identifies when regrouping is required."
  },
  {
    "Question Number": 3,
    "Question Prompt": "When cascading DL training to school clusters and teachers, which adult-learning modality is most effective?",
    "Question Type": "multiple_choice",
    "Option A": "Monotone theoretical lectures without practical exercises",
    "Option B": "Interactive modeling, micro-teaching simulations, and peer rubric review",
    "Option C": "Silent reading of manual guidelines",
    "Option D": "Unsupervised individual study",
    "Correct Answer": "B",
    "Points": 2,
    "Explanation": "Hands-on micro-teaching simulations build practical facilitation skills."
  },
  {
    "Question Number": 4,
    "Question Prompt": "Which rapid formative check-for-understanding tool is recommended during early grade phonics instruction?",
    "Question Type": "multiple_choice",
    "Option A": "Exit tickets, show-me boards (mini whiteboards), and choral response checks",
    "Option B": "A three-hour end-of-term essay",
    "Option C": "Standardized regional ranking exams",
    "Option D": "Silent individual homework only",
    "Correct Answer": "A",
    "Points": 2,
    "Explanation": "Rapid formative checks give immediate visibility into individual phonemic awareness."
  },
  {
    "Question Number": 5,
    "Question Prompt": "What is the primary indicator of successful implementation of the GALOP AF2 Differentiated Learning rollout?",
    "Question Type": "multiple_choice",
    "Option A": "Measurable baseline-to-post learning gains and improved foundational literacy & numeracy in primary grades",
    "Option B": "The total number of physical printed documents distributed",
    "Option C": "Number of supervisory meetings held without classroom visits",
    "Option D": "Completion of administrative paperwork alone",
    "Correct Answer": "A",
    "Points": 2,
    "Explanation": "Success is measured by genuine pupil learning outcomes in literacy and numeracy."
  }
];

// GET /api/assessments/template/download - Download Excel/CSV sample templates
router.get("/template/download", (req, res) => {
  const type = (req.query.type || "pre-test").toLowerCase();
  const format = (req.query.format || "xlsx").toLowerCase();

  let data = SAMPLE_PRE_TEST_QUESTIONS;
  let filename = "DL_Pre_Test_Questions_Template";

  if (type === "post-test" || type === "post") {
    data = SAMPLE_POST_TEST_QUESTIONS;
    filename = "DL_Post_Test_Questions_Template";
  } else if (type === "blank") {
    data = [
      {
        "Question Number": 1,
        "Question Prompt": "Sample question text here...",
        "Question Type": "multiple_choice",
        "Option A": "Choice A text",
        "Option B": "Choice B text",
        "Option C": "Choice C text",
        "Option D": "Choice D text",
        "Correct Answer": "A",
        "Points": 2,
        "Explanation": "Rationale for correct answer"
      }
    ];
    filename = "DL_Assessment_Questions_Blank_Template";
  }

  const ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [
    { wch: 16 }, // Q Num
    { wch: 45 }, // Prompt
    { wch: 18 }, // Type
    { wch: 30 }, // Opt A
    { wch: 30 }, // Opt B
    { wch: 30 }, // Opt C
    { wch: 30 }, // Opt D
    { wch: 16 }, // Correct
    { wch: 10 }, // Points
    { wch: 35 }, // Explanation
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Assessment Questions");

  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}.csv"`);
    return res.send(csv);
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.xlsx"`);
  return res.send(buffer);
});

// POST /api/assessments/:id/questions/bulk - Bulk import questions for an assessment
router.post("/:id/questions/bulk", trainerOrAdminAuth, (req, res) => {
  const assessmentId = req.params.id;
  const { questions, mode = "replace" } = req.body; // mode: 'replace' | 'append'

  const assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessmentId);
  if (!assessment) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "No valid questions provided in bulk upload." });
  }

  if (mode === "replace") {
    db.prepare("DELETE FROM assessment_questions WHERE assessment_id = ?").run(assessmentId);
  }

  const maxOrderRow = db.prepare("SELECT MAX(sort_order) as maxOrder FROM assessment_questions WHERE assessment_id = ?").get(assessmentId);
  let startOrder = (maxOrderRow?.maxOrder || 0) + 1;

  const insertStmt = db.prepare(`
    INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_answer, points, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  for (const q of questions) {
    const text = (q.questionText || q.questionPrompt || q["Question Prompt"] || q.question || "").trim();
    if (!text) continue;

    let qType = (q.questionType || q["Question Type"] || "multiple_choice").toLowerCase();
    if (qType.includes("true") || qType.includes("false")) {
      qType = "true_false";
    } else {
      qType = "multiple_choice";
    }

    let opts = [];
    if (Array.isArray(q.options) && q.options.length > 0) {
      opts = q.options.map(o => String(o).trim()).filter(Boolean);
    } else {
      const optA = (q["Option A"] || q.optionA || q.a || "").trim();
      const optB = (q["Option B"] || q.optionB || q.b || "").trim();
      const optC = (q["Option C"] || q.optionC || q.c || "").trim();
      const optD = (q["Option D"] || q.optionD || q.d || "").trim();

      if (qType === "true_false") {
        opts = ["True", "False"];
      } else {
        opts = [optA, optB, optC, optD].filter(Boolean);
      }
    }

    if (opts.length === 0) {
      opts = qType === "true_false" ? ["True", "False"] : ["Option A", "Option B", "Option C", "Option D"];
    }

    let rawCorrect = String(q.correctAnswer || q["Correct Answer"] || q.correct || "").trim();
    let correctAnswer = rawCorrect;

    // If letter A, B, C, D is provided, resolve to the text value
    const upper = rawCorrect.toUpperCase();
    if (["A", "B", "C", "D"].includes(upper)) {
      const idx = upper.charCodeAt(0) - 65;
      if (opts[idx]) {
        correctAnswer = opts[idx];
      }
    } else if (qType === "true_false") {
      if (upper === "T" || upper.includes("TRUE")) correctAnswer = "True";
      if (upper === "F" || upper.includes("FALSE")) correctAnswer = "False";
    }

    const points = Number(q.points || q.Points || q.score || 2) || 2;

    insertStmt.run(
      assessmentId,
      text,
      qType,
      JSON.stringify(opts),
      correctAnswer,
      points,
      startOrder++
    );
    insertedCount++;
  }

  const updatedQuestions = db.prepare(`
    SELECT * FROM assessment_questions 
    WHERE assessment_id = ? 
    ORDER BY sort_order ASC, id ASC
  `).all(assessmentId);

  res.json({
    message: `Successfully imported ${insertedCount} questions into "${assessment.title}".`,
    insertedCount,
    totalQuestions: updatedQuestions.length,
    questions: updatedQuestions.map(q => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: JSON.parse(q.options_json || "[]"),
      correctAnswer: q.correct_answer,
      points: q.points,
      sortOrder: q.sort_order,
    })),
  });
});

// GET /api/assessments/stats/overview - High-level test analytics
router.get("/stats/overview", (req, res) => {
  const totalSubmissions = db.prepare("SELECT COUNT(*) as count FROM assessment_submissions").get()?.count || 0;
  const preTestStats = db.prepare(`
    SELECT 
      COUNT(*) as count, 
      AVG(percentage) as avg_score,
      MAX(percentage) as max_score,
      MIN(percentage) as min_score
    FROM assessment_submissions sub
    JOIN assessments a ON sub.assessment_id = a.id
    WHERE a.type = 'Pre-Test'
  `).get();

  const postTestStats = db.prepare(`
    SELECT 
      COUNT(*) as count, 
      AVG(percentage) as avg_score,
      MAX(percentage) as max_score,
      MIN(percentage) as min_score
    FROM assessment_submissions sub
    JOIN assessments a ON sub.assessment_id = a.id
    WHERE a.type = 'Post-Test'
  `).get();

  res.json({
    totalSubmissions,
    preTest: {
      count: preTestStats.count || 0,
      avgScore: Math.round(preTestStats.avg_score || 0),
      maxScore: Math.round(preTestStats.max_score || 0),
      minScore: Math.round(preTestStats.min_score || 0),
    },
    postTest: {
      count: postTestStats.count || 0,
      avgScore: Math.round(postTestStats.avg_score || 0),
      maxScore: Math.round(postTestStats.max_score || 0),
      minScore: Math.round(postTestStats.min_score || 0),
    },
    learningGain: Math.max(0, Math.round((postTestStats.avg_score || 0) - (preTestStats.avg_score || 0))),
  });
});

// GET /api/assessments/:id/take - Public / Participant test taking (Enforces Date/Time Lock!)
router.get("/:id/take", (req, res) => {
  const id = req.params.id;
  const cohortId = req.query.cohort_id || req.query.cohortId || 1;
  const bypass = req.query.bypass === "true"; // Admin test preview bypass

  const assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(id);
  if (!assessment) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  if (!assessment.is_active) {
    return res.status(403).json({ error: "This assessment is currently closed or inactive." });
  }

  const lockInfo = getAssessmentLockStatus(assessment, cohortId);

  // If locked and no admin bypass, return lock status and blocked info
  if (lockInfo.isLocked && !bypass) {
    return res.json({
      isLocked: true,
      lockInfo,
      message: `This assessment is locked and scheduled to open on ${lockInfo.unlockDateFormatted} at ${lockInfo.unlockTime}.`,
      assessment: {
        id: assessment.id,
        title: assessment.title,
        type: assessment.type,
        description: assessment.description,
        timeLimitMinutes: assessment.time_limit_minutes,
      },
      questions: [],
    });
  }

  const questions = db.prepare(`
    SELECT id, assessment_id, question_text, question_type, options_json, points, sort_order
    FROM assessment_questions
    WHERE assessment_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(id);

  const parsedQuestions = questions.map((q) => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    options: JSON.parse(q.options_json || "[]"),
    points: q.points,
  }));

  res.json({
    isLocked: false,
    lockInfo,
    assessment: {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      description: assessment.description,
      timeLimitMinutes: assessment.time_limit_minutes,
      questionCount: parsedQuestions.length,
      totalPoints: parsedQuestions.reduce((sum, q) => sum + q.points, 0),
    },
    questions: parsedQuestions,
  });
});

// GET /api/assessments/:id - Full details with answers (Facilitator / Admin)
router.get("/:id", trainerOrAdminAuth, (req, res) => {
  const id = req.params.id;
  const assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(id);
  if (!assessment) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  const questions = db.prepare(`
    SELECT * FROM assessment_questions
    WHERE assessment_id = ?
    ORDER BY sort_order ASC, id ASC
  `).all(id);

  const parsedQuestions = questions.map((q) => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    options: JSON.parse(q.options_json || "[]"),
    correctAnswer: q.correct_answer,
    points: q.points,
    sortOrder: q.sort_order,
  }));

  res.json({
    assessment: {
      ...assessment,
      unlock_time: assessment.unlock_time || "19:00",
      unlock_date_type: assessment.unlock_date_type || "arrival_date",
      lock_mode: assessment.lock_mode || "scheduled",
      questions: parsedQuestions,
    },
  });
});

// POST /api/assessments - Create new assessment (Facilitator / Admin)
router.post("/", trainerOrAdminAuth, (req, res) => {
  const { title, description, unlockTime, unlockDateType, customUnlockDatetime, customCloseDatetime, lockMode } = req.body;
  const type = req.body.type || req.body.assessment_type || req.body.assessmentType;
  const timeLimitMinutes = req.body.timeLimitMinutes || req.body.time_limit_minutes;
  const cohortId = req.body.cohortId || req.body.cohort_id || req.body.cohortNumber || req.body.cohort_number;
  const questions = req.body.questions || [];

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Assessment title is required." });
  }
  if (!type || !["Pre-Test", "Post-Test", "Quiz"].includes(type)) {
    return res.status(400).json({ error: "Valid assessment type required (Pre-Test, Post-Test, or Quiz)." });
  }

  const trainerId = req.trainer ? req.trainer.id : null;

  const aInfo = db.prepare(`
    INSERT INTO assessments (title, type, description, time_limit_minutes, is_active, cohort_id, created_by_trainer_id, unlock_time, unlock_date_type, custom_unlock_datetime, custom_close_datetime, lock_mode)
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    type,
    description ? description.trim() : null,
    timeLimitMinutes ? Number(timeLimitMinutes) : 20,
    cohortId ? Number(cohortId) : null,
    trainerId,
    unlockTime || "19:00",
    unlockDateType || (type === "Post-Test" ? "end_date" : "arrival_date"),
    customUnlockDatetime || null,
    customCloseDatetime || null,
    lockMode || "scheduled"
  );

  const aId = Number(aInfo.lastInsertRowid);

  if (Array.isArray(questions)) {
    const insertQ = db.prepare(`
      INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_answer, points, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    let order = 1;
    for (const q of questions) {
      const qText = q.questionText || q.question_text;
      const qType = q.questionType || q.question_type || "multiple_choice";
      const qOpts = q.options || q.options_json || [];
      const qAns = q.correctAnswer || q.correct_answer || "";
      const qPts = q.points !== undefined ? Number(q.points) : 1;

      if (qText && qText.trim()) {
        insertQ.run(
          aId,
          qText.trim(),
          qType,
          typeof qOpts === "string" ? qOpts : JSON.stringify(qOpts),
          qAns,
          qPts,
          order++
        );
      }
    }
  }

  res.status(201).json({
    message: "Assessment created successfully.",
    assessment: { id: aId, title: title.trim(), type },
    id: aId,
  });
});

// PUT /api/assessments/:id - Update assessment, questions, and date/time lock settings (Admin / Facilitator)
router.put("/:id", trainerOrAdminAuth, (req, res) => {
  const id = req.params.id;
  const {
    title,
    type,
    description,
    timeLimitMinutes,
    isActive,
    cohortId,
    unlockTime,
    unlockDateType,
    customUnlockDatetime,
    customCloseDatetime,
    lockMode,
    questions,
  } = req.body;

  const existing = db.prepare("SELECT * FROM assessments WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  db.prepare(`
    UPDATE assessments
    SET 
      title = ?, 
      type = ?, 
      description = ?, 
      time_limit_minutes = ?, 
      is_active = ?, 
      cohort_id = ?,
      unlock_time = ?,
      unlock_date_type = ?,
      custom_unlock_datetime = ?,
      custom_close_datetime = ?,
      lock_mode = ?
    WHERE id = ?
  `).run(
    title !== undefined ? title.trim() : existing.title,
    type !== undefined ? type : existing.type,
    description !== undefined ? (description ? description.trim() : null) : existing.description,
    timeLimitMinutes !== undefined ? Number(timeLimitMinutes) : existing.time_limit_minutes,
    isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
    cohortId !== undefined ? (cohortId ? Number(cohortId) : null) : existing.cohort_id,
    unlockTime !== undefined ? unlockTime : (existing.unlock_time || "19:00"),
    unlockDateType !== undefined ? unlockDateType : (existing.unlock_date_type || "arrival_date"),
    customUnlockDatetime !== undefined ? customUnlockDatetime : existing.custom_unlock_datetime,
    customCloseDatetime !== undefined ? customCloseDatetime : existing.custom_close_datetime,
    lockMode !== undefined ? lockMode : (existing.lock_mode || "scheduled"),
    id
  );

  if (Array.isArray(questions)) {
    // Delete existing questions and replace
    db.prepare("DELETE FROM assessment_questions WHERE assessment_id = ?").run(id);
    const insertQ = db.prepare(`
      INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_answer, points, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    let order = 1;
    for (const q of questions) {
      if (q.questionText && q.questionText.trim()) {
        insertQ.run(
          id,
          q.questionText.trim(),
          q.questionType || "multiple_choice",
          JSON.stringify(q.options || []),
          q.correctAnswer || "",
          q.points || 1,
          order++
        );
      }
    }
  }

  res.json({ message: "Assessment and scheduling updated successfully." });
});

// PATCH /api/assessments/:id/toggle - Toggle active status
router.patch("/:id/toggle", trainerOrAdminAuth, (req, res) => {
  const id = req.params.id;
  const a = db.prepare("SELECT id, is_active FROM assessments WHERE id = ?").get(id);
  if (!a) return res.status(404).json({ error: "Assessment not found." });

  const nextState = a.is_active ? 0 : 1;
  db.prepare("UPDATE assessments SET is_active = ? WHERE id = ?").run(nextState, id);
  res.json({ message: `Assessment ${nextState ? "activated" : "deactivated"}.`, isActive: nextState });
});

// POST /api/assessments/:id/submit - Submit participant answers & auto-grade
router.post("/:id/submit", (req, res) => {
  const assessmentId = req.params.id;
  const officerName = req.body.officerName || req.body.officer_name || req.body.candidateName || req.body.candidate_name;
  const phoneNumber = req.body.phoneNumber || req.body.phone_number || req.body.candidatePhone || req.body.candidate_phone;
  const registrationId = req.body.registrationId || req.body.registration_id;
  const cohortId = req.body.cohortId || req.body.cohort_id || req.body.cohortNumber || req.body.cohort_number || 1;
  const answers = req.body.answers || {};

  if (!officerName || !officerName.trim()) {
    return res.status(400).json({ error: "Participant name is required." });
  }
  if (!phoneNumber || !phoneNumber.trim()) {
    return res.status(400).json({ error: "Phone number is required." });
  }

  const assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessmentId);
  if (!assessment) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  // Enforce lock verification
  const lockInfo = getAssessmentLockStatus(assessment, cohortId);
  if (lockInfo.isLocked) {
    return res.status(403).json({
      error: `This assessment is locked and will be open on ${lockInfo.unlockDateFormatted} at ${lockInfo.unlockTime}.`,
      lockInfo,
    });
  }

  const questions = db.prepare("SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY sort_order ASC").all(assessmentId);

  let earnedScore = 0;
  let totalPoints = 0;
  const detailedBreakdown = [];

  for (const q of questions) {
    totalPoints += q.points;
    const userAnswer = answers ? answers[q.id] : null;
    const isCorrect = userAnswer && String(userAnswer).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
    const pointsAwarded = isCorrect ? q.points : 0;
    earnedScore += pointsAwarded;

    detailedBreakdown.push({
      questionId: q.id,
      questionText: q.question_text,
      userAnswer,
      correctAnswer: q.correct_answer,
      isCorrect,
      pointsAwarded,
      maxPoints: q.points,
    });
  }

  const percentage = totalPoints > 0 ? Math.round((earnedScore / totalPoints) * 100) : 0;

  const subInfo = db.prepare(`
    INSERT INTO assessment_submissions 
      (assessment_id, registration_id, officer_name, phone_number, cohort_id, score, total_points, percentage, answers_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    assessmentId,
    registrationId ? Number(registrationId) : null,
    officerName.trim(),
    phoneNumber.trim(),
    cohortId ? Number(cohortId) : null,
    earnedScore,
    totalPoints,
    percentage,
    JSON.stringify(answers || {})
  );

  res.status(201).json({
    message: "Assessment submitted and graded successfully.",
    submissionId: Number(subInfo.lastInsertRowid),
    score: earnedScore,
    totalPoints,
    percentage,
    passed: percentage >= 50,
    breakdown: detailedBreakdown,
  });
});

// GET /api/assessments/:id/submissions - View all submissions for an assessment (Facilitator / Admin)
router.get("/:id/submissions", trainerOrAdminAuth, (req, res) => {
  const id = req.params.id;
  const { cohort_id, q } = req.query;

  let sql = `
    SELECT sub.*, c.name as cohort_name
    FROM assessment_submissions sub
    LEFT JOIN cohorts c ON sub.cohort_id = c.id
    WHERE sub.assessment_id = ?
  `;
  const params = [id];

  if (cohort_id) {
    sql += " AND sub.cohort_id = ?";
    params.push(cohort_id);
  }

  if (q) {
    sql += " AND (sub.officer_name LIKE ? OR sub.phone_number LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like);
  }

  sql += " ORDER BY sub.submitted_at DESC";

  const rows = db.prepare(sql).all(...params);

  const avgRow = db.prepare(`
    SELECT AVG(percentage) as avg_percent, AVG(score) as avg_score, COUNT(*) as count
    FROM assessment_submissions WHERE assessment_id = ?
  `).get(id);

  res.json({
    count: rows.length,
    summary: {
      totalSubmissions: avgRow?.count || 0,
      averagePercentage: Math.round(avgRow?.avg_percent || 0),
      averageScore: Math.round((avgRow?.avg_score || 0) * 10) / 10,
    },
    submissions: rows,
  });
});

module.exports = router;
