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
router.get("/", async (req, res) => {
  const cohortId = req.query.cohort_id || req.query.cohortId || 1;
  let assessments = [];
  
  const supabase = require("../supabase");
  let fromSupabase = false;

  if (supabase) {
    try {
      const { data } = await supabase.from("assessments").select(`
        *,
        cohorts ( name ),
        national_trainers ( name )
      `).order("id", { ascending: true });
      
      if (data && data.length > 0) {
        fromSupabase = true;
        // Fetch aggregates manually since Supabase JS doesn't do subqueries easily
        for (let i = 0; i < data.length; i++) {
          const a = data[i];
          a.cohort_name = a.cohorts ? a.cohorts.name : null;
          a.trainer_name = a.national_trainers ? a.national_trainers.name : null;
          
          const { count: qCount } = await supabase.from("assessment_questions").select("*", { count: "exact", head: true }).eq("assessment_id", a.id);
          a.question_count = qCount || 0;

          const { data: subs } = await supabase.from("assessment_submissions").select("percentage").eq("assessment_id", a.id);
          a.submission_count = subs ? subs.length : 0;
          if (a.submission_count > 0) {
            a.average_score = subs.reduce((sum, s) => sum + (s.percentage || 0), 0) / a.submission_count;
          } else {
            a.average_score = null;
          }
        }
        assessments = data;
      }
    } catch (e) {
      console.error("Supabase GET /assessments error:", e.message);
    }
  }

  if (!fromSupabase || assessments.length === 0) {
    assessments = db.prepare(`
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
  }

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

// GET /api/assessments/template/download - Download Excel/CSV/DOCX sample templates
router.get("/template/download", async (req, res) => {
  const type = (req.query.type || "pre-test").toLowerCase();
  const format = (req.query.format || "xlsx").toLowerCase();

  let data = SAMPLE_PRE_TEST_QUESTIONS;
  let filename = "DL_Pre_Test_Questions_Template";
  let assessmentLabel = "Pre-Training Assessment";

  if (type === "post-test" || type === "post") {
    data = SAMPLE_POST_TEST_QUESTIONS;
    filename = "DL_Post_Test_Questions_Template";
    assessmentLabel = "Post-Training Assessment";
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
    assessmentLabel = "Assessment (Blank)";
  }

  // ── Word (.docx) template ──────────────────────────────────────────────────
  if (format === "docx") {
    try {
      const {
        Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, HeadingLevel, BorderStyle, AlignmentType, WidthType,
        ShadingType
      } = require("docx");

      const HEADERS = [
        "Question Number", "Question Prompt", "Question Type",
        "Option A", "Option B", "Option C", "Option D",
        "Correct Answer", "Points", "Explanation"
      ];

      // Column widths in DXA (twips, 1440 per inch). Table ~9000 total.
      const COL_WIDTHS = [1100, 3200, 1400, 1800, 1800, 1800, 1800, 1300, 700, 2200];

      const headerShading = { fill: "1a2e4a", type: ShadingType.SOLID, color: "auto" };

      const makeHeaderCell = (text, width) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: headerShading,
        children: [new Paragraph({
          children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 17 })],
          alignment: AlignmentType.CENTER,
        })],
      });

      const makeDataCell = (text, width, shade = false) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: shade ? { fill: "f1f5f9", type: ShadingType.SOLID, color: "auto" } : undefined,
        children: [new Paragraph({
          children: [new TextRun({ text: String(text ?? ""), size: 16 })],
        })],
      });

      const tableRows = [
        // Header row
        new TableRow({
          tableHeader: true,
          children: HEADERS.map((h, i) => makeHeaderCell(h, COL_WIDTHS[i])),
        }),
        // Data rows
        ...data.map((row, idx) => new TableRow({
          children: HEADERS.map((h, i) => makeDataCell(row[h] ?? "", COL_WIDTHS[i], idx % 2 === 1)),
        })),
      ];

      const doc = new Document({
        sections: [{
          properties: { page: { size: { width: 19800, height: 12240 }, orientation: "landscape", margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
          children: [
            new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: "Ghana Education Service — Differentiated Learning Programme", color: "1a2e4a", size: 28, bold: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `AF2 DL Workshop ${assessmentLabel} — Bulk Upload Template`, color: "64748b", size: 22, italics: true })] }),
            new Paragraph({ children: [new TextRun({ text: "" })] }),
            new Paragraph({ children: [new TextRun({ text: "📋 Instructions:", bold: true, size: 20, color: "1e40af" })] }),
            new Paragraph({ children: [new TextRun({ text: "1. Do NOT edit, add, or remove column headers in row 1.", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "2. Question Type must be exactly: multiple_choice  or  true_false", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "3. Correct Answer: use A, B, C, or D (letter only) for multiple choice. Use True or False for true/false questions.", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "4. Points: enter a number (e.g. 2). Explanation is optional.", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "5. Save as .docx, then upload via the Bulk Upload panel in the Admin Dashboard.", size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: "" })] }),
            new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
            new Paragraph({ children: [new TextRun({ text: "" })] }),
            new Paragraph({ alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `Generated from GES DL Nomination Portal · Confidential · ${new Date().toLocaleDateString("en-GH")}`, size: 16, color: "94a3b8", italics: true })] }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}.docx"`);
      return res.send(buffer);
    } catch (err) {
      console.error("DOCX generation error:", err.message);
      return res.status(500).json({ error: "Failed to generate Word template: " + err.message });
    }
  }

  // ── Excel / CSV template ───────────────────────────────────────────────────
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

// POST /api/assessments/template/parse-docx - Parse an uploaded Word (.docx) file into questions
// Accepts multipart/form-data with field "file"
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/template/parse-docx", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded." });

  try {
    const mammoth = require("mammoth");
    // Extract raw text preserving newlines
    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
    const text = result.value;

    // Split into lines and try to find a table-like structure
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    // Find header row containing our known column names
    const EXPECTED_HEADERS = [
      "Question Number", "Question Prompt", "Question Type",
      "Option A", "Option B", "Option C", "Option D",
      "Correct Answer", "Points", "Explanation"
    ];

    let headerLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const matchCount = EXPECTED_HEADERS.filter(h => lines[i].includes(h)).length;
      if (matchCount >= 5) { headerLineIdx = i; break; }
    }

    // If we found the header, parse tab or cell-delimited rows after it
    if (headerLineIdx >= 0) {
      const headerLine = lines[headerLineIdx];
      // Detect delimiter (tabs from Word table export, or consecutive spaces)
      const isTabDelimited = headerLine.includes("\t");
      const delim = isTabDelimited ? "\t" : /\s{2,}/;

      const headers = isTabDelimited
        ? headerLine.split("\t").map(h => h.trim())
        : EXPECTED_HEADERS; // fall back to expected headers in order

      const questions = [];
      for (let i = headerLineIdx + 1; i < lines.length; i++) {
        const cells = isTabDelimited
          ? lines[i].split("\t").map(c => c.trim())
          : lines[i].split(/\t/).map(c => c.trim());

        if (cells.length < 6) continue; // skip short/empty lines
        const row = {};
        headers.forEach((h, idx) => { row[h] = cells[idx] || ""; });

        const questionText = (row["Question Prompt"] || "").trim();
        if (!questionText || questionText.toLowerCase().startsWith("sample question")) continue;

        let qType = (row["Question Type"] || "multiple_choice").toString().toLowerCase();
        if (qType.includes("true") || qType.includes("false") || qType.includes("tf")) {
          qType = "true_false";
        } else {
          qType = "multiple_choice";
        }

        let options = [];
        if (qType === "true_false") {
          options = ["True", "False"];
        } else {
          options = [row["Option A"], row["Option B"], row["Option C"], row["Option D"]].filter(Boolean);
          if (options.length === 0) options = ["Option A", "Option B", "Option C", "Option D"];
        }

        let rawAns = (row["Correct Answer"] || "A").toString().trim().toUpperCase();
        let correctAnswer = rawAns;
        if (["A","B","C","D"].includes(rawAns)) {
          const idx = rawAns.charCodeAt(0) - 65;
          if (options[idx]) correctAnswer = options[idx];
        } else if (qType === "true_false") {
          if (rawAns === "T" || rawAns.includes("TRUE")) correctAnswer = "True";
          if (rawAns === "F" || rawAns.includes("FALSE")) correctAnswer = "False";
        }

        const points = Number(row["Points"]) || 2;
        questions.push({ questionText, questionType: qType, options, correctAnswer, points });
      }

      if (questions.length > 0) {
        return res.json({ questions, parsed: questions.length });
      }
    }

    // Fallback: Word table not parsed into lines — ask user to use Excel
    return res.status(422).json({
      error: "Could not extract questions from this Word document. Please ensure the document uses the official template table format, or use the Excel (.xlsx) template instead.",
      hint: "The Word document should contain a table with headers: Question Prompt, Option A, Option B, Option C, Option D, Correct Answer, Points."
    });
  } catch (err) {
    console.error("DOCX parse error:", err.message);
    return res.status(500).json({ error: "Failed to parse Word document: " + err.message });
  }
});


// POST /api/assessments/:id/questions/bulk - Bulk import questions for an assessment
router.post("/:id/questions/bulk", trainerOrAdminAuth, async (req, res) => {
  const assessmentId = req.params.id;
  const { questions, mode = "replace" } = req.body; // mode: 'replace' | 'append'

  const supabase = require("../supabase");
  const assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessmentId);
  if (!assessment) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "No valid questions provided in bulk upload." });
  }

  if (mode === "replace") {
    db.prepare("DELETE FROM assessment_questions WHERE assessment_id = ?").run(assessmentId);
    if (supabase) {
      await supabase.from("assessment_questions").delete().eq("assessment_id", assessmentId);
    }
  }

  const maxOrderRow = db.prepare("SELECT MAX(sort_order) as maxOrder FROM assessment_questions WHERE assessment_id = ?").get(assessmentId);
  let startOrder = (maxOrderRow?.maxOrder || 0) + 1;

  const insertStmt = db.prepare(`
    INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_answer, points, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  let insertedCount = 0;
  const supabasePayloads = [];

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
    const optsJson = JSON.stringify(opts);

    insertStmt.run(
      assessmentId,
      text,
      qType,
      optsJson,
      correctAnswer,
      points,
      startOrder
    );

    supabasePayloads.push({
      assessment_id: assessmentId,
      question_text: text,
      question_type: qType,
      options_json: opts, // Pass raw array for Supabase jsonb
      correct_answer: correctAnswer,
      points: points,
      sort_order: startOrder
    });

    startOrder++;
    insertedCount++;
  }

  if (supabase && supabasePayloads.length > 0) {
    try {
      await supabase.from("assessment_questions").insert(supabasePayloads);
    } catch (err) {
      console.error("Supabase bulk questions upload error:", err.message);
    }
  }

  let updatedQuestions = [];
  if (supabase) {
    try {
      const { data } = await supabase.from("assessment_questions").select("*").eq("assessment_id", assessmentId).order("sort_order", { ascending: true });
      if (data && data.length > 0) updatedQuestions = data;
    } catch (e) {}
  }

  if (updatedQuestions.length === 0) {
    updatedQuestions = db.prepare(`
      SELECT * FROM assessment_questions 
      WHERE assessment_id = ? 
      ORDER BY sort_order ASC, id ASC
    `).all(assessmentId);
  }

  res.json({
    message: `Successfully imported ${insertedCount} questions into "${assessment.title}".`,
    insertedCount,
    totalQuestions: updatedQuestions.length,
    questions: updatedQuestions.map(q => {
      let parsedOpts = [];
      try {
        parsedOpts = typeof q.options_json === "string" ? JSON.parse(q.options_json || "[]") : (q.options_json || []);
      } catch(e) {}
      return {
        id: q.id,
        questionText: q.question_text,
        questionType: q.question_type,
        options: parsedOpts,
        correctAnswer: q.correct_answer,
        points: q.points,
        sortOrder: q.sort_order,
      };
    }),
  });
});

// GET /api/assessments/stats/overview - High-level test analytics
router.get("/stats/overview", async (req, res) => {
  let totalSubmissions = 0;
  let preTestStats = { count: 0, avgScore: 0, maxScore: 0, minScore: 0 };
  let postTestStats = { count: 0, avgScore: 0, maxScore: 0, minScore: 0 };

  const supabase = require("../supabase");
  let fromSupabase = false;

  if (supabase) {
    try {
      const { data: subs } = await supabase.from("assessment_submissions").select("percentage, assessments(type)");
      if (subs) {
        fromSupabase = true;
        totalSubmissions = subs.length;
        
        const preSubs = subs.filter(s => s.assessments && s.assessments.type === 'Pre-Test');
        if (preSubs.length > 0) {
          const preScores = preSubs.map(s => s.percentage || 0);
          preTestStats.count = preScores.length;
          preTestStats.avgScore = Math.round(preScores.reduce((a,b)=>a+b,0) / preScores.length);
          preTestStats.maxScore = Math.round(Math.max(...preScores));
          preTestStats.minScore = Math.round(Math.min(...preScores));
        }

        const postSubs = subs.filter(s => s.assessments && (s.assessments.type === 'Post-Test' || s.assessments.type === 'post-test'));
        if (postSubs.length > 0) {
          const postScores = postSubs.map(s => s.percentage || 0);
          postTestStats.count = postScores.length;
          postTestStats.avgScore = Math.round(postScores.reduce((a,b)=>a+b,0) / postScores.length);
          postTestStats.maxScore = Math.round(Math.max(...postScores));
          postTestStats.minScore = Math.round(Math.min(...postScores));
        }
      }
    } catch (e) {
      console.error("Supabase stats error:", e.message);
    }
  }

  if (!fromSupabase) {
    totalSubmissions = db.prepare("SELECT COUNT(*) as count FROM assessment_submissions").get()?.count || 0;
    
    const preDbStats = db.prepare(`
      SELECT 
        COUNT(*) as count, 
        AVG(percentage) as avg_score,
        MAX(percentage) as max_score,
        MIN(percentage) as min_score
      FROM assessment_submissions sub
      JOIN assessments a ON sub.assessment_id = a.id
      WHERE a.type = 'Pre-Test'
    `).get();

    const postDbStats = db.prepare(`
      SELECT 
        COUNT(*) as count, 
        AVG(percentage) as avg_score,
        MAX(percentage) as max_score,
        MIN(percentage) as min_score
      FROM assessment_submissions sub
      JOIN assessments a ON sub.assessment_id = a.id
      WHERE a.type = 'Post-Test'
    `).get();

    preTestStats = {
      count: preDbStats.count || 0,
      avgScore: Math.round(preDbStats.avg_score || 0),
      maxScore: Math.round(preDbStats.max_score || 0),
      minScore: Math.round(preDbStats.min_score || 0),
    };
    postTestStats = {
      count: postDbStats.count || 0,
      avgScore: Math.round(postDbStats.avg_score || 0),
      maxScore: Math.round(postDbStats.max_score || 0),
      minScore: Math.round(postDbStats.min_score || 0),
    };
  }

  res.json({
    totalSubmissions,
    preTest: preTestStats,
    postTest: postTestStats,
    learningGain: Math.max(0, postTestStats.avgScore - preTestStats.avgScore),
  });
});

// GET /api/assessments/:id/take - Public / Participant test taking (Enforces Date/Time Lock for participants, allows instant access for signed-in admins)
router.get("/:id/take", async (req, res) => {
  const id = req.params.id;
  const cohortId = req.query.cohort_id || req.query.cohortId || 1;
  const adminToken = req.headers["x-admin-token"] || req.headers["x-admin-password"] || req.headers["authorization"] || "";
  const trainerToken = req.headers["x-trainer-token"] || "";
  const bypass = req.query.bypass === "true" || req.query.preview === "true";

  const supabase = require("../supabase");
  let assessment = null;

  if (supabase) {
    try {
      const { data } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      if (data) assessment = data;
    } catch (e) {}
  }

  if (!assessment) {
    assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(id);
  }

  if (!assessment) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  if (!assessment.is_active && !bypass) {
    return res.status(403).json({ error: "This assessment is currently closed or inactive." });
  }

  const lockInfo = getAssessmentLockStatus(assessment, cohortId);

  // If locked and not an authenticated admin/facilitator, enforce lock
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

  let questions = [];
  if (supabase) {
    try {
      const { data } = await supabase.from("assessment_questions").select("*").eq("assessment_id", id).order("sort_order", { ascending: true });
      if (data && data.length > 0) questions = data;
    } catch (e) {}
  }

  if (questions.length === 0) {
    questions = db.prepare(`
      SELECT id, assessment_id, question_text, question_type, options_json, points, sort_order
      FROM assessment_questions
      WHERE assessment_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(id);
  }

  let parsedQuestions = questions.map((q) => {
    let opts = [];
    try {
      opts = typeof q.options_json === "string" ? JSON.parse(q.options_json || "[]") : (q.options_json || []);
    } catch (e) {
      opts = [q.options_json];
    }
    return {
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: opts,
      points: q.points || 2,
    };
  });

  const { getSeededCohortQuestions } = require("../utils/questionShuffle");
  parsedQuestions = getSeededCohortQuestions(parsedQuestions, id, cohortId);

  res.json({
    isLocked: false,
    isAdminBypass: Boolean(bypass),
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

// GET /api/assessments/my-submissions - Fetch a candidate's own submissions
router.get("/my-submissions", async (req, res) => {
  const phone = (req.query.phone || req.query.phoneNumber || "").trim();
  const name = (req.query.name || req.query.officerName || "").trim();
  const registrationId = req.query.registrationId || null;

  if (!phone && !registrationId) {
    return res.status(400).json({ error: "Phone number or Registration ID is required." });
  }

  const supabase = require("../supabase");
  let submissions = [];

  if (supabase) {
    try {
      let query = supabase.from("assessment_submissions").select("*, assessments(title, type)");
      if (phone) {
        query = query.eq("phone_number", phone);
      }
      const { data } = await query;
      if (data && data.length > 0) submissions = data;
    } catch(e) {}
  }

  if (submissions.length === 0) {
    if (registrationId) {
      submissions = db.prepare(`
        SELECT sub.*, a.title, a.type 
        FROM assessment_submissions sub
        LEFT JOIN assessments a ON sub.assessment_id = a.id
        WHERE sub.registration_id = ?
      `).all(registrationId);
    } else if (phone) {
      submissions = db.prepare(`
        SELECT sub.*, a.title, a.type 
        FROM assessment_submissions sub
        LEFT JOIN assessments a ON sub.assessment_id = a.id
        WHERE sub.phone_number = ?
      `).all(phone);
    }
  }

  res.json({ submissions });
});


// GET /api/assessments/:id - Full details with answers (Facilitator / Admin)
router.get("/:id", trainerOrAdminAuth, async (req, res) => {
  const id = req.params.id;
  const supabase = require("../supabase");
  let assessment = null;

  if (supabase) {
    try {
      const { data } = await supabase.from("assessments").select("*").eq("id", id).maybeSingle();
      if (data) assessment = data;
    } catch (e) {}
  }

  if (!assessment) {
    assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(id);
  }

  if (!assessment) {
    return res.status(404).json({ error: "Assessment not found." });
  }

  let questions = [];
  if (supabase) {
    try {
      const { data } = await supabase.from("assessment_questions").select("*").eq("assessment_id", id).order("sort_order", { ascending: true });
      if (data && data.length > 0) questions = data;
    } catch (e) {}
  }

  if (questions.length === 0) {
    questions = db.prepare(`
      SELECT * FROM assessment_questions
      WHERE assessment_id = ?
      ORDER BY sort_order ASC, id ASC
    `).all(id);
  }

  const parsedQuestions = questions.map((q) => {
    let opts = [];
    try {
      opts = typeof q.options_json === "string" ? JSON.parse(q.options_json || "[]") : (q.options_json || []);
    } catch (e) {
      opts = [q.options_json];
    }
    return {
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: opts,
      correctAnswer: q.correct_answer,
      points: q.points,
      sortOrder: q.sort_order,
    };
  });

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

  const supabase = require("../supabase");
  if (supabase) {
    supabase.from("assessments").insert({
      id: aId,
      title: title.trim(),
      type,
      description: description ? description.trim() : null,
      time_limit_minutes: timeLimitMinutes ? Number(timeLimitMinutes) : 20,
      is_active: 1,
      cohort_id: cohortId ? Number(cohortId) : null,
      created_by_trainer_id: trainerId,
      unlock_time: unlockTime || "19:00",
      unlock_date_type: unlockDateType || (type === "Post-Test" ? "end_date" : "arrival_date"),
      custom_unlock_datetime: customUnlockDatetime || null,
      custom_close_datetime: customCloseDatetime || null,
      lock_mode: lockMode || "scheduled"
    }).then(({ error }) => {
      if (error) console.error("Supabase assessment insert error:", error);
    });
  }

  if (Array.isArray(questions)) {
    const insertQ = db.prepare(`
      INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_answer, points, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    let order = 1;
    const supaQuestions = [];
    
    for (const q of questions) {
      const qText = q.questionText || q.question_text;
      const qType = q.questionType || q.question_type || "multiple_choice";
      const qOpts = q.options || q.options_json || [];
      const qAns = q.correctAnswer || q.correct_answer || "";
      const qPts = q.points !== undefined ? Number(q.points) : 1;

      if (qText && qText.trim()) {
        const parsedOpts = typeof qOpts === "string" ? JSON.parse(qOpts) : qOpts;
        insertQ.run(aId, qText.trim(), qType, JSON.stringify(parsedOpts), qAns, qPts, order);
        
        supaQuestions.push({
          assessment_id: aId,
          question_text: qText.trim(),
          question_type: qType,
          options_json: parsedOpts,
          correct_answer: qAns,
          points: qPts,
          sort_order: order
        });
        order++;
      }
    }
    
    if (supabase && supaQuestions.length > 0) {
      supabase.from("assessment_questions").insert(supaQuestions).then(({ error: insertErr }) => {
        if (insertErr) console.error("Supabase new questions insert error:", insertErr);
      });
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

  const updateValues = {
    title: title !== undefined ? title.trim() : existing.title,
    type: type !== undefined ? type : existing.type,
    description: description !== undefined ? (description ? description.trim() : null) : existing.description,
    time_limit_minutes: timeLimitMinutes !== undefined ? Number(timeLimitMinutes) : existing.time_limit_minutes,
    is_active: isActive !== undefined ? (isActive ? 1 : 0) : existing.is_active,
    cohort_id: cohortId !== undefined ? (cohortId ? Number(cohortId) : null) : existing.cohort_id,
    unlock_time: unlockTime !== undefined ? unlockTime : (existing.unlock_time || "19:00"),
    unlock_date_type: unlockDateType !== undefined ? unlockDateType : (existing.unlock_date_type || "arrival_date"),
    custom_unlock_datetime: customUnlockDatetime !== undefined ? customUnlockDatetime : existing.custom_unlock_datetime,
    custom_close_datetime: customCloseDatetime !== undefined ? customCloseDatetime : existing.custom_close_datetime,
    lock_mode: lockMode !== undefined ? lockMode : (existing.lock_mode || "scheduled"),
  };

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
    updateValues.title,
    updateValues.type,
    updateValues.description,
    updateValues.time_limit_minutes,
    updateValues.is_active,
    updateValues.cohort_id,
    updateValues.unlock_time,
    updateValues.unlock_date_type,
    updateValues.custom_unlock_datetime,
    updateValues.custom_close_datetime,
    updateValues.lock_mode,
    id
  );

  const supabase = require("../supabase");
  if (supabase) {
    supabase.from("assessments").update(updateValues).eq("id", id).then(({ error }) => {
      if (error) console.error("Supabase assessment update error:", error);
    });
  }

  if (Array.isArray(questions)) {
    // Delete existing questions and replace
    db.prepare("DELETE FROM assessment_questions WHERE assessment_id = ?").run(id);
    const insertQ = db.prepare(`
      INSERT INTO assessment_questions (assessment_id, question_text, question_type, options_json, correct_answer, points, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    let order = 1;
    const supaQuestions = [];
    
    for (const q of questions) {
      if (q.questionText && q.questionText.trim()) {
        const qText = q.questionText.trim();
        const qType = q.questionType || "multiple_choice";
        const qOpts = q.options || [];
        const qAns = q.correctAnswer || "";
        const qPts = q.points || 1;
        
        insertQ.run(id, qText, qType, JSON.stringify(qOpts), qAns, qPts, order);
        
        supaQuestions.push({
          assessment_id: id,
          question_text: qText,
          question_type: qType,
          options_json: qOpts, // Supabase jsonb array
          correct_answer: qAns,
          points: qPts,
          sort_order: order
        });
        order++;
      }
    }
    
    if (supabase && supaQuestions.length > 0) {
      supabase.from("assessment_questions").delete().eq("assessment_id", id).then(({ error }) => {
        if (!error) {
          supabase.from("assessment_questions").insert(supaQuestions).then(({ error: insertErr }) => {
            if (insertErr) console.error("Supabase questions update error:", insertErr);
          });
        }
      });
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
  
  const supabase = require("../supabase");
  if (supabase) {
    supabase.from("assessments").update({ is_active: nextState }).eq("id", id).then(({ error }) => {
      if (error) console.error("Supabase assessment toggle error:", error);
    });
  }
  
  res.json({ message: `Assessment ${nextState ? "activated" : "deactivated"}.`, isActive: nextState });
});

// GET /api/assessments/:id/report/pptx - Download PPTX report
router.get("/:id/report/pptx", async (req, res) => {
  const assessmentId = req.params.id;
  const cohortId = req.query.cohort_id || null;

  try {
    const { generateAssessmentReportPptx } = require("../utils/pptxReport");
    const buffer = await generateAssessmentReportPptx(assessmentId, cohortId);
    
    res.setHeader("Content-Disposition", `attachment; filename=Assessment_Report_${assessmentId}.pptx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    res.send(buffer);
  } catch (err) {
    console.error("PPTX Generation Error:", err);
    res.status(500).json({ error: "Failed to generate PowerPoint report." });
  }
});

// POST /api/assessments/:id/submit - Submit participant answers & auto-grade
router.post("/:id/submit", async (req, res) => {
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

  const supabase = require("../supabase");
  let assessment = null;

  if (supabase) {
    try {
      const { data } = await supabase.from("assessments").select("*").eq("id", assessmentId).maybeSingle();
      if (data) assessment = data;
    } catch (e) {}
  }

  if (!assessment) {
    assessment = db.prepare("SELECT * FROM assessments WHERE id = ?").get(assessmentId);
  }

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

  let questions = [];
  if (supabase) {
    try {
      const { data } = await supabase.from("assessment_questions").select("*").eq("assessment_id", assessmentId).order("sort_order", { ascending: true });
      if (data && data.length > 0) questions = data;
    } catch (e) {}
  }

  if (questions.length === 0) {
    questions = db.prepare("SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY sort_order ASC").all(assessmentId);
  }

  const submittedIds = req.body.questionIds;

  const { getSeededCohortQuestions } = require("../utils/questionShuffle");

  // Filter to only grade the exactly presented questions (for the 20-question reshuffle)
  if (Array.isArray(submittedIds) && submittedIds.length > 0) {
    const idsSet = new Set(submittedIds.map(Number));
    questions = questions.filter(q => idsSet.has(q.id));
  } else if (questions.length > 20) {
    // Fallback if legacy client didn't send IDs
    questions = getSeededCohortQuestions(questions, assessmentId, cohortId);
  }

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
  const answersJson = JSON.stringify(answers || {});
  const regIdParsed = registrationId ? Number(registrationId) : null;
  const cohortIdParsed = cohortId ? Number(cohortId) : null;
  const officerNameClean = officerName.trim();
  const phoneClean = phoneNumber.trim();
  let submissionId = null;

  try {
    const subInfo = db.prepare(`
      INSERT INTO assessment_submissions 
        (assessment_id, registration_id, officer_name, phone_number, cohort_id, score, total_points, percentage, answers_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(assessmentId, regIdParsed, officerNameClean, phoneClean, cohortIdParsed, earnedScore, totalPoints, percentage, answersJson);
    submissionId = Number(subInfo.lastInsertRowid);
  } catch (err) {
    console.error("SQLite submit error:", err);
  }

  if (supabase) {
    try {
      const { data, error } = await supabase.from("assessment_submissions").insert([{
        assessment_id: assessmentId,
        officer_name: officerNameClean,
        phone_number: phoneClean,
        cohort_id: cohortIdParsed,
        score: earnedScore,
        total_points: totalPoints,
        percentage,
        answers_json: answers || {},
      }]).select("id").single();
      
      if (error) {
        console.error("Supabase insert error details:", error);
      }
      if (data && data.id) submissionId = data.id;
    } catch (e) {
      console.error("Supabase submit error:", e.message);
    }
  }

  res.status(201).json({
    message: "Assessment submitted and graded successfully.",
    submissionId,
    score: earnedScore,
    totalPoints,
    percentage,
    passed: percentage >= 50,
    breakdown: detailedBreakdown,
  });
});

// GET /api/assessments/:id/submissions - View all submissions for an assessment (Facilitator / Admin)
router.get("/:id/submissions", trainerOrAdminAuth, async (req, res) => {
  const id = req.params.id;
  const { cohort_id, q } = req.query;

  const supabase = require("../supabase");
  let submissions = [];
  let summary = { totalSubmissions: 0, averagePercentage: 0, averageScore: 0 };
  let fromSupabase = false;

  if (supabase) {
    try {
      let query = supabase.from("assessment_submissions")
        .select("*, cohorts(name)")
        .eq("assessment_id", id)
        .order("submitted_at", { ascending: false });
        
      if (cohort_id) {
        query = query.eq("cohort_id", cohort_id);
      }
      
      // Supabase JS doesn't have a clean OR like across multiple text columns without string formats
      if (q) {
        query = query.or(`officer_name.ilike.%${q}%,phone_number.ilike.%${q}%`);
      }

      const { data, error } = await query;
      
      if (data) {
        fromSupabase = true;
        submissions = data.map(sub => ({
          ...sub,
          cohort_name: sub.cohorts ? sub.cohorts.name : null
        }));
        
        if (submissions.length > 0) {
          summary.totalSubmissions = submissions.length;
          const totalPct = submissions.reduce((sum, s) => sum + (s.percentage || 0), 0);
          const totalSc = submissions.reduce((sum, s) => sum + (s.score || 0), 0);
          summary.averagePercentage = Math.round(totalPct / submissions.length);
          summary.averageScore = Math.round((totalSc / submissions.length) * 10) / 10;
        }
      }
    } catch (e) {
      console.error("Supabase GET /submissions error:", e.message);
    }
  }

  if (!fromSupabase) {
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
    submissions = db.prepare(sql).all(...params);

    const avgRow = db.prepare(`
      SELECT AVG(percentage) as avg_percent, AVG(score) as avg_score, COUNT(*) as count
      FROM assessment_submissions WHERE assessment_id = ?
    `).get(id);

    summary = {
      totalSubmissions: avgRow?.count || 0,
      averagePercentage: Math.round(avgRow?.avg_percent || 0),
      averageScore: Math.round((avgRow?.avg_score || 0) * 10) / 10,
    };
  }

  res.json({
    count: submissions.length,
    summary,
    submissions,
  });
});

module.exports = router;
