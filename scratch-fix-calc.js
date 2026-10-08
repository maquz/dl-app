const fs = require('fs');
let code = fs.readFileSync('backend/routes/assessments.js', 'utf8');

const targetStr = `    const uniqueRegions = Object.keys(regionCounts).filter(r => r && r.trim().toLowerCase() !== 'unknown').sort();
    const criticalAreas = [];
    
    const questionLevel = questions.map((q, idx) => {
      let opts = [];
      try { opts = typeof q.options_json === "string" ? JSON.parse(q.options_json) : (q.options_json || []); } catch(e){}
      
      const answerCounts = {};
      const regionalCounts = {};
      uniqueRegions.forEach(r => regionalCounts[r] = {});

      submissions.forEach(sub => {
        const r = sub.registrations?.region || sub.region || "Unknown";
        let ansObj = {};
        try { ansObj = typeof sub.answers_json === "string" ? JSON.parse(sub.answers_json) : (sub.answers_json || {}); } catch(e){}
        const chosenOpt = ansObj[q.id];
        if (chosenOpt) {
          answerCounts[chosenOpt] = (answerCounts[chosenOpt] || 0) + 1;
          if (regionalCounts[r]) {
            regionalCounts[r][chosenOpt] = (regionalCounts[r][chosenOpt] || 0) + 1;
          }
        }
      });

      let mostSelectedOpt = null;
      let mostSelectedCount = 0;
      Object.keys(answerCounts).forEach(opt => {
        if (answerCounts[opt] > mostSelectedCount) {
          mostSelectedCount = answerCounts[opt];
          mostSelectedOpt = opt;
        }
      });

      const majorityPct = totalRespondents ? ((mostSelectedCount / totalRespondents) * 100).toFixed(2) : 0;
      const takeawayText = majorityPct >= 50 ? "Majority" : "Less than half";
      if (takeawayText === "Less than half") criticalAreas.push(\`Q\${idx + 1}: \${q.question_text}\`);

      const optionsBreakdown = opts.map(opt => {
        const count = answerCounts[opt] || 0;
        const pct = totalRespondents ? ((count / totalRespondents) * 100).toFixed(1) : 0;
        
        const regionBreakdown = {};
        uniqueRegions.forEach(r => {
           const rCount = regionalCounts[r][opt] || 0;
           const rTotal = regionCounts[r] || 1;
           regionBreakdown[r] = ((rCount / rTotal) * 100).toFixed(1);
        });

        return {
          option: opt,
          isCorrect: String(opt).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase(),
          count,
          percentage: pct,
          regionBreakdown
        };
      });`;

const replacementStr = `    let districtsData = {};
    try { districtsData = require("../data/districts.json"); } catch(e) {}
    const officialRegions = Object.keys(districtsData).length > 0 ? Object.keys(districtsData).sort() : Object.keys(regionCounts).filter(r => r && r.trim().toLowerCase() !== 'unknown').sort();
    
    // Fallback if none (for mock testing)
    const uniqueRegions = officialRegions.length > 0 ? officialRegions : ["Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra", "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"];
    const criticalAreas = [];
    
    const questionLevel = questions.map((q, idx) => {
      let opts = [];
      try { opts = typeof q.options_json === "string" ? JSON.parse(q.options_json) : (q.options_json || []); } catch(e){}
      
      const answerCounts = {};
      const regionalCounts = {};
      uniqueRegions.forEach(r => regionalCounts[r] = {});

      submissions.forEach(sub => {
        const r = sub.registrations?.region || sub.region || "Unknown";
        let ansObj = {};
        try { ansObj = typeof sub.answers_json === "string" ? JSON.parse(sub.answers_json) : (sub.answers_json || {}); } catch(e){}
        const chosenOpt = ansObj[q.id];
        if (chosenOpt) {
          answerCounts[chosenOpt] = (answerCounts[chosenOpt] || 0) + 1;
          if (regionalCounts[r]) {
            regionalCounts[r][chosenOpt] = (regionalCounts[r][chosenOpt] || 0) + 1;
          }
        }
      });

      // Calculate total answers strictly for this question to ensure exactly 100% sum
      const qTotalOverall = Object.values(answerCounts).reduce((acc, v) => acc + v, 0);
      const qRegionTotals = {};
      uniqueRegions.forEach(r => {
        qRegionTotals[r] = Object.values(regionalCounts[r]).reduce((acc, v) => acc + v, 0);
      });

      let mostSelectedOpt = null;
      let mostSelectedCount = 0;
      Object.keys(answerCounts).forEach(opt => {
        if (answerCounts[opt] > mostSelectedCount) {
          mostSelectedCount = answerCounts[opt];
          mostSelectedOpt = opt;
        }
      });

      const majorityPct = qTotalOverall ? ((mostSelectedCount / qTotalOverall) * 100).toFixed(2) : 0;
      const takeawayText = majorityPct >= 50 ? "Majority" : "Less than half";
      if (takeawayText === "Less than half") criticalAreas.push(\`Q\${idx + 1}: \${q.question_text}\`);

      const optionsBreakdown = opts.map(opt => {
        const count = answerCounts[opt] || 0;
        const pct = qTotalOverall ? ((count / qTotalOverall) * 100).toFixed(1) : "0.0";
        
        const regionBreakdown = {};
        uniqueRegions.forEach(r => {
           const rCount = regionalCounts[r][opt] || 0;
           const rTotal = qRegionTotals[r] || 0;
           if (rTotal === 0) {
             regionBreakdown[r] = "-";
           } else {
             regionBreakdown[r] = ((rCount / rTotal) * 100).toFixed(1);
           }
        });

        return {
          option: opt,
          isCorrect: String(opt).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase(),
          count,
          percentage: pct,
          regionBreakdown
        };
      });`;

if (code.includes('uniqueRegions.forEach(r => {') && code.includes('const rTotal = regionCounts[r] || 1;')) {
  // Using a more robust string replacement strategy since the block is large
  // Replacing just the `const uniqueRegions` to `const optionsBreakdown = opts.map` logic
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('backend/routes/assessments.js', code);
  console.log("Assessments API calculation updated successfully.");
} else {
  console.log("Target pattern not found.");
}
