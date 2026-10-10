const fs = require('fs');
let code = fs.readFileSync('backend/routes/assessments.js', 'utf8');

const targetStr = `    let districtsData = {};
    try { districtsData = require("../data/districts.json"); } catch(e) {}
    const officialRegions = Object.keys(districtsData).length > 0 ? Object.keys(districtsData).sort() : Object.keys(regionCounts).filter(r => r && r.trim().toLowerCase() !== 'unknown').sort();
    
    // Fallback if none (for mock testing)
    const uniqueRegions = officialRegions.length > 0 ? officialRegions : ["Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra", "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta", "Western", "Western North"];`;

const replacementStr = `    let officialRegions = [];
    try {
      const cohortDistricts = require("../data/cohort_districts.json");
      if (cohortId && cohortDistricts[cohortId]) {
        const cohortRegs = new Set();
        cohortDistricts[cohortId].districts.forEach(d => cohortRegs.add(d.region));
        officialRegions = Array.from(cohortRegs).sort();
      } else {
        const districtsData = require("../data/districts.json");
        officialRegions = Object.keys(districtsData).length > 0 ? Object.keys(districtsData).sort() : Object.keys(regionCounts).filter(r => r && r.trim().toLowerCase() !== 'unknown').sort();
      }
    } catch(e) {}
    
    const uniqueRegions = officialRegions.length > 0 ? officialRegions : Object.keys(regionCounts).filter(r => r && r.trim().toLowerCase() !== 'unknown').sort();`;

if (code.includes('const officialRegions = Object.keys(districtsData).length > 0')) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('backend/routes/assessments.js', code);
  console.log("Regions logic updated.");
} else {
  console.log("Target string not found.");
}
