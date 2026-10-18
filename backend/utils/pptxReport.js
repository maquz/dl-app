const PptxGenJS = require("pptxgenjs");
const db = require("../db");
const supabase = require("../supabase");

async function generateAssessmentReportPptx(assessmentId, cohortId) {
  let assessment = null;
  
  if (supabase) {
    try {
      const { data } = await supabase.from("assessments").select("*, cohorts(name)").eq("id", assessmentId).single();
      if (data) assessment = data;
    } catch(e) {}
  }
  
  if (!assessment) {
    assessment = db.prepare(`SELECT a.*, c.name as cohort_name FROM assessments a LEFT JOIN cohorts c ON a.cohort_id = c.id WHERE a.id = ?`).get(assessmentId);
  }
  
  if (!assessment) throw new Error("Assessment not found");

  // Fetch Questions
  let questions = [];
  if (supabase) {
    try {
      const { data } = await supabase.from("assessment_questions").select("*").eq("assessment_id", assessmentId).order("sort_order", { ascending: true });
      if (data && data.length > 0) questions = data;
    } catch(e) {}
  }
  
  if (questions.length === 0) {
    questions = db.prepare("SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY sort_order ASC").all(assessmentId);
  }

  const { getSeededCohortQuestions } = require("./questionShuffle");
  questions = getSeededCohortQuestions(questions, assessmentId, cohortId);

  // Fetch Submissions
  let submissions = [];
  if (supabase) {
    try {
      let query = supabase.from("assessment_submissions").select("*").limit(100000).eq("assessment_id", assessmentId);
      if (cohortId) {
        query = query.eq("cohort_id", cohortId);
      }
      const { data } = await query;
      if (data) submissions = data;
    } catch (e) {}
  }

  if (submissions.length === 0) {
    let sql = `
      SELECT s.*, r.region, r.sex 
      FROM assessment_submissions s 
      LEFT JOIN registrations r ON s.registration_id = r.id 
      WHERE s.assessment_id = ?`;
    const params = [assessmentId];
    if (cohortId) {
      sql += " AND s.cohort_id = ?";
      params.push(cohortId);
    }
    submissions = db.prepare(sql).all(...params);
  }

  // Build registration index across Supabase and SQLite for robust matching
  const regByExactPhone = new Map();
  const regByDigits = new Map();
  const regByLast9 = new Map();
  const regById = new Map();
  const regByName = new Map();

  function indexReg(r) {
    if (!r) return;
    if (r.id) regById.set(Number(r.id), r);
    if (r.phone_number) {
      const raw = String(r.phone_number).trim();
      regByExactPhone.set(raw, r);
      const digits = raw.replace(/\D/g, "");
      if (digits) {
        regByDigits.set(digits, r);
        if (digits.length >= 9) {
          regByLast9.set(digits.slice(-9), r);
        }
      }
    }
    if (r.officer_name) {
      regByName.set(String(r.officer_name).trim().toLowerCase(), r);
    }
  }

  if (supabase) {
    try {
      const { data: regData } = await supabase
        .from("registrations")
        .select("id, phone_number, officer_name, region, district, sex")
        .limit(100000);
      if (regData) regData.forEach(indexReg);
    } catch (e) {}
  }

  try {
    const localRegs = db.prepare("SELECT id, phone_number, officer_name, region, district, sex FROM registrations").all();
    localRegs.forEach(indexReg);
  } catch (e) {}

  submissions.forEach(s => {
    let matched = null;
    if (s.registration_id && regById.has(Number(s.registration_id))) {
      matched = regById.get(Number(s.registration_id));
    }
    if (!matched && s.phone_number) {
      const raw = String(s.phone_number).trim();
      if (regByExactPhone.has(raw)) matched = regByExactPhone.get(raw);
      const digits = raw.replace(/\D/g, "");
      if (!matched && digits) {
        if (regByDigits.has(digits)) matched = regByDigits.get(digits);
        else if (digits.length >= 9 && regByLast9.has(digits.slice(-9))) {
          matched = regByLast9.get(digits.slice(-9));
        }
      }
    }
    if (!matched && s.officer_name) {
      const normName = String(s.officer_name).trim().toLowerCase();
      if (regByName.has(normName)) matched = regByName.get(normName);
    }

    if (matched) {
      if (!s.region || s.region === "Unknown") s.region = matched.region;
      if (!s.district) s.district = matched.district;
      if (!s.sex) s.sex = matched.sex;
    }
  });

  const cohortName = assessment.cohorts?.name || assessment.cohort_name || (cohortId ? `Cohort ${cohortId}` : "All Cohorts");

  // Calculate Overview Stats
  const totalRespondents = submissions.length;
  let male = 0;
  let female = 0;
  let unspecified = 0;
  const regionCounts = {};
  
  submissions.forEach(sub => {
    let sex = (sub.registrations?.sex || sub.sex || "").trim().toLowerCase();
    if (sex === "male") male++;
    else if (sex === "female") female++;
    else unspecified++;
    
    let region = sub.registrations?.region || sub.region || "";
    if (region && region.trim().toLowerCase() !== "unknown") {
      regionCounts[region] = (regionCounts[region] || 0) + 1;
    }
  });

  const malePct = totalRespondents ? ((male / totalRespondents) * 100).toFixed(1) : 0;
  const femalePct = totalRespondents ? ((female / totalRespondents) * 100).toFixed(1) : 0;
  const unspecifiedPct = totalRespondents ? ((unspecified / totalRespondents) * 100).toFixed(1) : 0;

  // Determine official regions strictly for the selected cohort
  let officialRegions = [];
  try {
    const cohortDistricts = require("../data/cohort_districts.json");
    if (cohortId && cohortDistricts[cohortId]) {
      const cohortRegs = new Set();
      cohortDistricts[cohortId].districts.forEach(d => cohortRegs.add(d.region));
      officialRegions = Array.from(cohortRegs).sort();
    } else {
      const districtsData = require("../data/districts.json");
      officialRegions = Object.keys(districtsData).length > 0 
        ? Object.keys(districtsData).sort() 
        : Object.keys(regionCounts).sort();
    }
  } catch(e) {}

  const uniqueRegions = officialRegions.length > 0 
    ? officialRegions 
    : Object.keys(regionCounts).filter(r => r && r.toLowerCase() !== "unknown").sort();

  // Initialize Presentation
  let pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.defineSlideMaster({
    title: "MASTER_SLIDE",
    bkgd: "FFFFFF",
    objects: [
      { text: { text: "Ghana Education Service (GES)", options: { x: "75%", y: "90%", w: 2.2, h: 0.35, fontSize: 9, color: "64748B", align: "right" } } },
      { rect: { x: 0, y: "96.5%", w: "100%", h: "2.0%", fill: { color: "F39200" } } }, // Bottom orange bar
      { rect: { x: 0, y: "98.5%", w: "100%", h: "1.5%", fill: { color: "006B3F" } } }  // Bottom green bar
    ]
  });

  // Slide 1: Title
  let slide1 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide1.addText("DIFFERENTIATED LEARNING (DL)\nFOCAL PERSONS TRAINING", {
    x: 0.5, y: 1.0, w: 9, h: 1.8, align: "center", fontSize: 36, bold: true, color: "0F172A", valign: "middle"
  });
  slide1.addText(cohortName.toUpperCase(), {
    x: 0.5, y: 3.0, w: 9, h: 0.8, align: "center", fontSize: 44, bold: true, color: "005BBB", valign: "middle"
  });
  slide1.addShape(pres.ShapeType.rect, { x: 1.5, y: 4.0, w: 7, h: 1.0, fill: { color: "E0F2FE" }, line: { color: "005BBB", width: 2 } });
  slide1.addText(assessment.title, {
    x: 1.5, y: 4.0, w: 7, h: 1.0, align: "center", fontSize: 24, bold: true, color: "C00000", valign: "middle"
  });

  // Slide 2: Overview
  let slide2 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide2.addText("Overview", { x: 0.5, y: 0.25, w: 9, h: 0.5, fontSize: 32, bold: true, color: "0F172A", align: "center", valign: "top" });
  
  let genderSummary = `Male: ${male} (${malePct}%), Female: ${female} (${femalePct}%)`;
  if (unspecified > 0) {
    genderSummary += `, Not Specified: ${unspecified} (${unspecifiedPct}%)`;
  }

  const regionSummary = uniqueRegions.length === 1 
    ? `Training covered 1 region (${uniqueRegions[0]}).`
    : `Training covered ${uniqueRegions.length} regions.`;

  slide2.addText(`• ${regionSummary}\n• Total Number of Respondents: ${totalRespondents}\n• ${genderSummary}`, {
    x: 0.8, y: 0.85, w: 8.4, h: 1.1, fontSize: 16, bullet: true, color: "1E293B", valign: "top"
  });

  // Bar chart for regions (Single series so PptxGenJS charts categories properly)
  const chartLabels = uniqueRegions;
  const chartValues = uniqueRegions.map(r => regionCounts[r] || 0);

  const chartData = [
    {
      name: "Respondents",
      labels: chartLabels,
      values: chartValues
    }
  ];

  if (chartLabels.length > 0) {
    slide2.addChart(pres.ChartType.bar, chartData, {
      x: 0.8, y: 2.1, w: 8.4, h: 3.1,
      barDir: chartLabels.length > 4 ? "bar" : "col",
      showValue: true,
      showLegend: false,
      title: `Respondents per Region (${cohortName})`,
      titleFontSize: 14,
      titleColor: "103060",
      catAxisLabelFontSize: chartLabels.length > 8 ? 8 : 11,
      catAxisLabelColor: "333333",
      valAxisHidden: true,
      valAxisMajorGridlines: false,
      chartColors: ["005BBB"]
    });
  }

  // Slide 3: Objective
  let slide3 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide3.addText("Objective of the Training for DL Focal Persons:", { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 28, bold: true, color: "0F172A", underline: true, valign: "top" });
  slide3.addText("To empower Differentiated Learning Focal Persons (DLFP) with the essential knowledge, concepts, and skills necessary to champion and effectively implement DL initiatives across districts in Ghana.", {
    x: 0.5, y: 1.3, w: 9, h: 1.4, fontSize: 20, bullet: true, bold: true, color: "334155", valign: "top"
  });
  slide3.addText("The evaluation itself", { x: 0.5, y: 2.9, w: 9, h: 0.6, fontSize: 28, bold: true, color: "0F172A", underline: true, valign: "top" });
  slide3.addText("From the analysis of the data, it is clear some participants got the answers wrong for some of the questions, which were on the high side.", {
    x: 0.5, y: 3.6, w: 9, h: 1.2, fontSize: 20, bold: true, color: "334155", valign: "top"
  });
  
  // Slide 4: Tips
  let slide4 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide4.addText("Tips to read the slides:", { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 28, bold: true, color: "0F172A", underline: true, valign: "top" });
  slide4.addText("• Analysis of the results for each question of the survey, disaggregated per region.\n• The results for each question are presented on 2 slides.\n• For each question, before presenting the results per region, one slide presents the overall results and recommendations.\n• Districts that did not submit the assessment are represented as (-).", {
    x: 0.5, y: 1.3, w: 9, h: 3.2, fontSize: 18, bullet: true, color: "334155", valign: "top"
  });

  // Calculate Region Stats per question
  let criticalAreas = [];

  questions.forEach((q, idx) => {
    let qNum = idx + 1;
    let opts = [];
    try {
      opts = typeof q.options_json === "string" ? JSON.parse(q.options_json) : (q.options_json || []);
    } catch(e) {}

    // Tally answers
    let answerCounts = {};
    let regionAnswerCounts = {}; // { Region: { OptionText: Count } }
    
    uniqueRegions.forEach(r => regionAnswerCounts[r] = {});

    submissions.forEach(sub => {
      let r = sub.registrations?.region || sub.region || "";
      let ansObj = {};
      try { ansObj = typeof sub.answers_json === "string" ? JSON.parse(sub.answers_json) : (sub.answers_json || {}); } catch(e){}
      let chosenOpt = ansObj[q.id];
      if (chosenOpt) {
        answerCounts[chosenOpt] = (answerCounts[chosenOpt] || 0) + 1;
        if (regionAnswerCounts[r]) {
          regionAnswerCounts[r][chosenOpt] = (regionAnswerCounts[r][chosenOpt] || 0) + 1;
        }
      }
    });

    // Find the most selected option
    let mostSelectedOpt = null;
    let mostSelectedCount = 0;
    Object.keys(answerCounts).forEach(opt => {
      if (answerCounts[opt] > mostSelectedCount) {
        mostSelectedCount = answerCounts[opt];
        mostSelectedOpt = opt;
      }
    });

    const qTotalOverall = Object.values(answerCounts).reduce((acc, v) => acc + v, 0);
    const majorityPct = qTotalOverall ? ((mostSelectedCount / qTotalOverall) * 100).toFixed(2) : 0;
    
    let optLetter = "a";
    let optIndex = opts.indexOf(mostSelectedOpt);
    if (optIndex >= 0) {
      optLetter = String.fromCharCode(97 + optIndex); // a, b, c, d
    }

    let takeawayText = majorityPct >= 50 ? "Majority" : "Less than half";
    
    if (takeawayText === "Less than half") {
      criticalAreas.push(`• Q${qNum}: ${q.question_text}`);
    }
    
    // Slide A: Key Takeaway
    let slideA = pres.addSlide({ masterName: "MASTER_SLIDE" });
    slideA.addText(`${assessment.title} — ${cohortName}`, { x: 0.5, y: 0.25, w: 9, h: 0.45, fontSize: 20, bold: true, color: "005BBB", align: "center", valign: "top" });
    slideA.addText(`Q${qNum}. ${q.question_text}`, { x: 0.5, y: 0.75, w: 9, h: 1.1, fontSize: 18, italic: true, bold: true, align: "center", valign: "top" });
    
    slideA.addText("Key Takeaways:", { x: 0.8, y: 2.0, w: 8.4, h: 0.5, fontSize: 26, bold: true, color: "103060", valign: "top" });
    
    const takeawayFormatting = [
      { text: `${takeawayText} (${majorityPct}%) `, options: { color: takeawayText === "Majority" ? "00B050" : "FF0000", italic: true, bold: true } },
      { text: `of total respondents across ${uniqueRegions.length === 1 ? uniqueRegions[0] : `the ${uniqueRegions.length} participating regions`} selected option `, options: { color: "000000", italic: true } },
      { text: `(${optLetter}) ${mostSelectedOpt || "N/A"}`, options: { color: "000000", italic: true, bold: true } },
      { text: `, which indicates that ${takeawayText === "Majority" ? "most" : "less than half"} of the participants understand this concept.`, options: { color: "000000", italic: true } }
    ];
    
    slideA.addText(takeawayFormatting, { x: 0.8, y: 2.6, w: 8.4, h: 2.2, fontSize: 20, valign: "top" });

    // Slide B: Table
    let slideB = pres.addSlide({ masterName: "MASTER_SLIDE" });
    slideB.addText(`${assessment.title} — ${cohortName}`, { x: 0.5, y: 0.25, w: 9, h: 0.45, fontSize: 20, bold: true, color: "005BBB", align: "center", valign: "top" });
    slideB.addText(`Q${qNum}. ${q.question_text}`, { x: 0.5, y: 0.75, w: 9, h: 0.85, fontSize: 16, italic: true, bold: true, align: "center", valign: "top" });

    // Build table array
    let tableData = [];
    
    // Header row
    let headerRow = [
      { text: "Option", options: { bold: true, fill: "1E293B", color: "FFFFFF", valign: "middle", align: "left" } },
      { text: "Overall %", options: { bold: true, fill: "1E293B", color: "FFFFFF", valign: "middle", align: "center" } }
    ];
    uniqueRegions.forEach(r => {
      headerRow.push({ text: r, options: { bold: true, fill: "1E293B", color: "FFFFFF", valign: "middle", align: "center" } });
    });
    tableData.push(headerRow);
    
    // Total responses per region for this question to ensure accurate regional sums
    const qRegionTotals = {};
    uniqueRegions.forEach(r => {
      qRegionTotals[r] = Object.values(regionAnswerCounts[r] || {}).reduce((acc, v) => acc + v, 0);
    });

    // Data rows
    opts.forEach((opt, oIdx) => {
      let isCorrect = (String(opt).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase());
      let rowFill = isCorrect ? "DCFCE7" : (oIdx % 2 === 1 ? "F8FAFC" : "FFFFFF");
      let textCol = isCorrect ? "15803D" : "1E293B";
      
      let letter = String.fromCharCode(97 + oIdx);
      let optCount = answerCounts[opt] || 0;
      let overallPct = qTotalOverall > 0 ? ((optCount / qTotalOverall) * 100).toFixed(1) + "%" : "0.0%";

      let row = [
        { text: `${letter}. ${isCorrect ? "✓ " : ""}${opt}`, options: { bold: isCorrect, fill: rowFill, color: textCol, align: "left" } },
        { text: overallPct, options: { bold: isCorrect, fill: rowFill, color: textCol, align: "center" } }
      ];
      
      uniqueRegions.forEach(r => {
        let rTotal = qRegionTotals[r] || 0;
        let rOptCount = regionAnswerCounts[r]?.[opt] || 0;
        let pctStr = rTotal > 0 ? ((rOptCount / rTotal) * 100).toFixed(1) + "%" : "-";
        row.push({ text: pctStr, options: { bold: isCorrect, fill: rowFill, color: textCol, align: "center" } });
      });
      tableData.push(row);
    });

    // Dynamic column widths and font sizes
    let colW = [];
    let tblFontSize = 12;
    if (uniqueRegions.length === 1) {
      colW = [5.0, 2.0, 2.0];
      tblFontSize = 13;
    } else if (uniqueRegions.length <= 4) {
      const regionW = 3.6 / uniqueRegions.length;
      colW = [4.2, 1.2, ...uniqueRegions.map(() => regionW)];
      tblFontSize = 11;
    } else {
      const regionW = 5.2 / uniqueRegions.length;
      colW = [2.8, 1.0, ...uniqueRegions.map(() => regionW)];
      tblFontSize = uniqueRegions.length > 10 ? 8 : 9;
    }

    slideB.addTable(tableData, {
      x: 0.5, y: 1.7, w: 9.0, colW,
      border: { pt: 0.5, color: "CBD5E1" },
      fontSize: tblFontSize
    });
  });
  
  // Slide N-1: Critical Areas for Review
  let slideReview = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slideReview.addText("Critical Areas for Review", { x: 0.5, y: 0.5, w: 9, fontSize: 32, bold: true, color: "991B1B", align: "center" });
  slideReview.addText("From the analysis of data it is clear most participants do not understand following questions hence facilitators must do well to explain further:", {
    x: 0.8, y: 1.3, w: 8.4, fontSize: 18, italic: true, bold: true, color: "334155"
  });
  
  if (criticalAreas.length > 0) {
    slideReview.addText(criticalAreas.join("\n"), { x: 0.8, y: 2.2, w: 8.4, fontSize: 16, color: "DC2626", bold: true });
  } else {
    slideReview.addText("None! Great performance by all participants.", { x: 0.8, y: 2.2, w: 8.4, fontSize: 20, color: "16A34A", bold: true });
  }
  
  // Slide N: Thank You
  let slideThanks = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slideThanks.addText("Thank You", { x: 0.5, y: 2.2, w: 9, fontSize: 72, bold: true, align: "center", color: "005BBB" });

  const buffer = await pres.write("nodebuffer");
  return buffer;
}

module.exports = {
  generateAssessmentReportPptx
};
