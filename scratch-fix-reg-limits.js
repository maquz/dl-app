const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

let count = 0;
code = code.replace(/supabase\.from\("registrations"\)\s*\.select\([^)]*\)/g, (match) => {
  count++;
  if (match.includes('.limit(')) return match;
  return match + '.limit(100000)';
});

fs.writeFileSync('backend/routes/registrations.js', code);
console.log("Added .limit(100000) to " + count + " places in registrations.js.");
