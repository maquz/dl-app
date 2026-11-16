const fs = require("fs");
const path = require("path");

const sql = fs.readFileSync(path.join(__dirname, "../cpanel_deployment/database.sql"), "utf8");

const tables = [
  "cohorts",
  "sample_schools",
  "national_trainers",
  "admins",
  "officers",
  "password_resets",
  "registrations",
  "assessments",
  "assessment_questions",
  "assessment_submissions"
];

for (const t of tables) {
  const tableMarker = `-- Table: ${t}`;
  const startIdx = sql.indexOf(tableMarker);
  if (startIdx === -1) {
    console.log(`Table ${t}: NOT FOUND in SQL`);
    continue;
  }

  // Find next table or end
  const nextTableIdx = sql.indexOf("-- Table:", startIdx + tableMarker.length);
  const section = nextTableIdx === -1 ? sql.slice(startIdx) : sql.slice(startIdx, nextTableIdx);

  // Count rows in INSERT statements: lines starting with (
  const lines = section.split("\n");
  const seenIds = new Set();
  const dupes = [];
  let rowCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("(") && !trimmed.startsWith("(`")) {
      rowCount++;
      const m = trimmed.match(/^\((\d+)/);
      if (m) {
        const id = Number(m[1]);
        if (seenIds.has(id)) {
          dupes.push(id);
        }
        seenIds.add(id);
      }
    }
  }

  console.log(`Table ${t.padEnd(24)}: ${String(rowCount).padStart(5)} rows | ${String(seenIds.size).padStart(5)} unique IDs | Dupes: ${dupes.length}`);
  if (dupes.length > 0) {
    console.error(`  ERROR: Duplicates found:`, dupes.slice(0, 10));
  }
}

console.log("\nSQL Validation completed successfully.");
