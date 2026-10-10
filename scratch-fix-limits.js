const fs = require('fs');
let code = fs.readFileSync('backend/routes/assessments.js', 'utf8');

let count = 0;
code = code.replace(/supabase\.from\("assessment_submissions"\)\s*\.select\([^)]*\)/g, (match) => {
  count++;
  if (match.includes('.limit(')) return match;
  return match + '.limit(100000)';
});

fs.writeFileSync('backend/routes/assessments.js', code);
console.log("Added .limit(100000) to " + count + " places.");
