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
      let query = supabase.from("assessment_submissions").select("*").eq("assessment_id", assessmentId);
      if (cohortId) {
        query = query.eq("cohort_id", cohortId);
      }
      const { data } = await query;
      if (data) submissions = data;

      if (submissions.length > 0) {
         let rQuery = supabase.from("registrations").select("phone_number, region, district, sex");
         if (cohortId) rQuery = rQuery.eq("cohort_id", cohortId);
         const { data: regData } = await rQuery;
         if (regData) {
           const regMap = {};
           regData.forEach(r => regMap[r.phone_number] = r);
           submissions.forEach(s => {
              if (s.phone_number && regMap[s.phone_number]) {
                s.region = regMap[s.phone_number].region;
                s.district = regMap[s.phone_number].district;
                s.sex = regMap[s.phone_number].sex;
              }
           });
         }
      }
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

  const cohortName = assessment.cohorts?.name || assessment.cohort_name || (cohortId ? `Cohort ${cohortId}` : "All Cohorts");

  // Calculate Overview Stats
  const totalRespondents = submissions.length;
  let male = 0;
  let female = 0;
  const regionCounts = {};
  
  submissions.forEach(sub => {
    let sex = (sub.registrations?.sex || sub.sex || "").toLowerCase();
    if (sex === "male") male++;
    else if (sex === "female") female++;
    
    let region = sub.registrations?.region || sub.region || "Unknown";
    regionCounts[region] = (regionCounts[region] || 0) + 1;
  });

  const malePct = totalRespondents ? ((male / totalRespondents) * 100).toFixed(1) : 0;
  const femalePct = totalRespondents ? ((female / totalRespondents) * 100).toFixed(1) : 0;

  // Initialize Presentation
  let pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9";
  pres.defineSlideMaster({
    title: "MASTER_SLIDE",
    bkgd: "FFFFFF",
    objects: [
      { text: { text: "Ghana Education\nService (GES)", options: { x: "85%", y: "86%", w: 1.5, h: 0.5, fontSize: 8, color: "333333" } } },
      { rect: { x: 0, y: "97%", w: "100%", h: "3%", fill: { color: "F39200" } } }, // Bottom orange bar
      { rect: { x: 0, y: "98.5%", w: "100%", h: "1.5%", fill: { color: "006B3F" } } } // Bottom green bar
    ]
  });

  // Slide 1: Title
  let slide1 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide1.addText("DIFFERENTIATED LEARNING (DL)\nFOCAL PERSONS REFRESHER\nTRAINING", {
    x: 1, y: 1.5, w: 8, h: 2, align: "center", fontSize: 44, bold: true, color: "000000", valign: "middle"
  });
  slide1.addText(cohortName.toUpperCase(), {
    x: 1, y: 3.8, w: 8, h: 0.8, align: "center", fontSize: 50, bold: true, color: "000000", valign: "middle"
  });
  slide1.addShape(pres.ShapeType.rect, { x: 2, y: 4.8, w: 6, h: 1.2, fill: { color: "99C2E1" }, line: { color: "005BBB", width: 4 } });
  slide1.addText(assessment.title, {
    x: 2, y: 4.8, w: 6, h: 1.2, align: "center", fontSize: 36, bold: true, color: "C00000", valign: "middle"
  });

  // Slide 2: Overview
  let slide2 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide2.addText("Overview", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 40, bold: true, align: "center", valign: "top" });
  
  slide2.addText(`• Training covered ${Object.keys(regionCounts).length} regions.\n• Total Number of Respondents: ${totalRespondents}\n• Male: ${male} (${malePct}%), Female: ${female} (${femalePct}%)`, {
    x: 0.5, y: 1.2, w: 9, h: 1.5, fontSize: 20, bullet: true, valign: "top"
  });

  // Simple horizontal bar chart for regions
  let chartData = [];
  Object.keys(regionCounts).forEach(r => {
    chartData.push({ name: r, labels: [r], values: [regionCounts[r]] });
  });

  if (chartData.length > 0) {
    slide2.addChart(pres.ChartType.bar, chartData, {
      x: 1, y: 2.8, w: 8, h: 4,
      barDir: "bar",
      showValue: true,
      showLegend: false,
      title: `Total number of Respondent per Region for ${cohortName}`,
      titleFontSize: 20,
      titleColor: "103060",
      catAxisLabelFontSize: 16,
      valAxisHidden: true,
      valAxisMajorGridlines: false
    });
  }

  // Slide 3: Objective
  let slide3 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide3.addText("Objective of the Training for DL Focal Persons:", { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 32, bold: true, underline: true, valign: "top" });
  slide3.addText("To empower Differentiated Learning Focal Persons (DLFP) with the essential knowledge, concepts, and skills necessary to champion and effectively implement DL initiatives across districts in Ghana.", {
    x: 0.5, y: 1.2, w: 9, h: 1.5, fontSize: 24, bullet: true, bold: true, valign: "top"
  });
  slide3.addText("The evaluation itself", { x: 0.5, y: 3.0, w: 9, h: 0.6, fontSize: 32, bold: true, underline: true, valign: "top" });
  slide3.addText("From the analysis of the data, it is clear some participants got the answers wrong for some of the questions, which were on the high side.", {
    x: 0.5, y: 3.7, w: 9, h: 1.5, fontSize: 24, bold: true, valign: "top"
  });
  
  // Slide 4: Tips
  let slide4 = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slide4.addText("Tips to read the slides:", { x: 0.5, y: 0.5, w: 9, h: 0.6, fontSize: 32, bold: true, underline: true, valign: "top" });
  slide4.addText("• Analysis of the results for each question of the survey, desegregated per region.\n• The results for each question are presented on 2 slide\n• For each question, before presenting the results per region, one slide presents the overall results and recommendations .\n• Some district did not submitted the assessment; therefore, they do not show in the analysis (-).", {
    x: 0.5, y: 1.2, w: 9, h: 3.5, fontSize: 22, bullet: true, valign: "top"
  });

  // Calculate Region Stats per question
  let uniqueRegions = Object.keys(regionCounts).sort();
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
      let r = sub.registrations?.region || sub.region || "Unknown";
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

    let majorityPct = totalRespondents ? ((mostSelectedCount / totalRespondents) * 100).toFixed(2) : 0;
    
    let optLetter = "a";
    let optIndex = opts.indexOf(mostSelectedOpt);
    if (optIndex >= 0) {
      optLetter = String.fromCharCode(97 + optIndex); // a, b, c, d
    }

    let takeawayText = majorityPct >= 50 ? "Majority" : "Less than half";
    
    if (takeawayText === "Less than half") {
        criticalAreas.push(`• ${q.question_text}`);
    }
    
    // Slide A: Key Takeaway
    let slideA = pres.addSlide({ masterName: "MASTER_SLIDE" });
    slideA.addText("DL Focal Persons Pre-Training Assessment", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 32, bold: true, align: "center", valign: "top" });
    slideA.addText(`${qNum}. ${q.question_text}`, { x: 0.5, y: 0.9, w: 9, h: 1.0, fontSize: 20, italic: true, bold: true, align: "center", valign: "top" });
    
    slideA.addText("Key takeaways:", { x: 0.5, y: 2.2, w: 9, h: 0.6, fontSize: 36, bold: true, valign: "top" });
    
    let takeawayFormatting = [
      { text: `${takeawayText} (${majorityPct}%) `, options: { color: takeawayText === "Majority" ? "00B050" : "FF0000", italic: true } },
      { text: `of total the respondents across the ${uniqueRegions.length} participating regions selected option `, options: { color: "000000", italic: true } },
      { text: `(${optLetter}) ${mostSelectedOpt || "N/A"}`, options: { color: "000000", italic: true, bold: true } },
      { text: `, which indicates that ${takeawayText === "Majority" ? "most" : "less than half"} of the participants understand this concept.`, options: { color: "000000", italic: true } }
    ];
    
    slideA.addText(takeawayFormatting, { x: 0.5, y: 2.8, w: 9, h: 2, fontSize: 24, valign: "top" });

    // Slide B: Table
    let slideB = pres.addSlide({ masterName: "MASTER_SLIDE" });
    slideB.addText("DL Focal Persons Pre-Training Assessment", { x: 0.5, y: 0.3, w: 9, h: 0.6, fontSize: 32, bold: true, align: "center", valign: "top" });
    slideB.addText(`${qNum}. ${q.question_text}`, { x: 0.5, y: 0.9, w: 9, h: 1.0, fontSize: 20, italic: true, bold: true, align: "center", valign: "top" });

    
    // Build table array
    let tableData = [];
    
    // Header row
    let headerRow = [
      { text: `Q${qNum}`, options: { bold: true, fill: "FFC000", valign: "middle", align: "left", w: 3 } }
    ];
    uniqueRegions.forEach(r => {
      headerRow.push({ text: r, options: { bold: true, fill: "FFC000", valign: "middle", align: "center", w: 1 } });
    });
    tableData.push(headerRow);
    
    // Data rows
    opts.forEach((opt, oIdx) => {
      let isCorrect = (String(opt).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase());
      let rowFill = isCorrect ? "00FF00" : "FFFFFF";
      
      let letter = String.fromCharCode(97 + oIdx);
      let row = [
        { text: `${letter}. ${opt}`, options: { bold: true, fill: rowFill, align: "left" } }
      ];
      
      uniqueRegions.forEach(r => {
        let rTotal = regionCounts[r] || 0;
        let rOptCount = regionAnswerCounts[r][opt] || 0;
        let pctStr = rTotal > 0 ? Math.round((rOptCount / rTotal) * 100) + "%" : "-";
        row.push({ text: pctStr, options: { bold: true, fill: rowFill, align: "center" } });
      });
      tableData.push(row);
    });

    slideB.addTable(tableData, {
      x: 0.5, y: 1.5, w: 9,
      border: { pt: 1, color: "000000" },
      fontSize: 14
    });

  });
  
  // Slide N-1: Critical Areas for Review
  let slideReview = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slideReview.addText("Critical Areas for Review", { x: 0.5, y: 0.5, w: 9, fontSize: 36, bold: true, align: "center" });
  slideReview.addText("From the analysis of data it is clear most participants do not understand following questions hence facilitators must do well to explain further:", {
    x: 0.5, y: 1.5, w: 9, fontSize: 20, italic: true, bold: true
  });
  
  if (criticalAreas.length > 0) {
      slideReview.addText(criticalAreas.join("\n"), { x: 0.5, y: 2.5, w: 9, fontSize: 18, color: "FF0000" });
  } else {
      slideReview.addText("None! Great job by all participants.", { x: 0.5, y: 2.5, w: 9, fontSize: 22, color: "00B050" });
  }
  
  // Slide N: Thank You
  let slideThanks = pres.addSlide({ masterName: "MASTER_SLIDE" });
  slideThanks.addText("Thank You", { x: 0.5, y: 2.5, w: 9, fontSize: 80, bold: true, align: "center", color: "000000" });

  const buffer = await pres.write("nodebuffer");
  return buffer;
}

module.exports = {
  generateAssessmentReportPptx
};
