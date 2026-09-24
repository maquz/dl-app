const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const target = `  // Insert to local SQLite
  const submittedAtIso = new Date().toISOString();
  
  const stmt = db.prepare(\`
    INSERT INTO registrations
      (officer_name, sex, phone_number, email, region, district, institution_name, roles, cohort_id, arrival_date, attendance_status, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Attended', ?)
  \`);

  const info = stmt.run(
    officerName.trim(),
    sex,
    phoneNumber.trim(),
    formattedEmail,
    region.trim(),
    district.trim(),
    institutionName.trim(),
    JSON.stringify(roles),
    assignedCohortId,
    arrivalDate,
    submittedAtIso
  );

  let insertedId = Number(info.lastInsertRowid);`;

const replacement = `  const submittedAtIso = new Date().toISOString();
  let insertedId = null;
  const hasItRole = roles.some(r => (r || "").toLowerCase().includes("it person"));

  let stubId = null;
  if (hasItRole && assignedCohortId) {
    const stub = db.prepare("SELECT id FROM registrations WHERE district = ? AND cohort_id = ? AND officer_name = 'Pending Registration'").get(district.trim(), assignedCohortId);
    if (stub) stubId = stub.id;
  }

  if (stubId) {
    db.prepare(\`
      UPDATE registrations
      SET officer_name = ?, sex = ?, phone_number = ?, email = ?, institution_name = ?, roles = ?, arrival_date = ?, attendance_status = 'Attended', submitted_at = ?
      WHERE id = ?
    \`).run(officerName.trim(), sex, phoneNumber.trim(), formattedEmail, institutionName.trim(), JSON.stringify(roles), arrivalDate, submittedAtIso, stubId);
    insertedId = stubId;
  } else {
    const stmt = db.prepare(\`
      INSERT INTO registrations
        (officer_name, sex, phone_number, email, region, district, institution_name, roles, cohort_id, arrival_date, attendance_status, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Attended', ?)
    \`);
    const info = stmt.run(officerName.trim(), sex, phoneNumber.trim(), formattedEmail, region.trim(), district.trim(), institutionName.trim(), JSON.stringify(roles), assignedCohortId, arrivalDate, submittedAtIso);
    insertedId = Number(info.lastInsertRowid);
  }`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  console.log('TARGET 1 REPLACED');
} else {
  console.log('TARGET 1 NOT FOUND');
}

const target2 = `      const { data: supaRow, error: supaErr } = await supabase
        .from("registrations")
        .insert({ ...insertPayload, id: nextId })
        .select()
        .single();`;

const replacement2 = `      let supaRow = null;
      let supaErr = null;
      if (stubId) {
        const { data, error } = await supabase.from("registrations").update(insertPayload).eq("id", stubId).select().single();
        supaRow = data;
        supaErr = error;
      } else {
        const { data, error } = await supabase.from("registrations").insert({ ...insertPayload, id: nextId }).select().single();
        supaRow = data;
        supaErr = error;
      }`;

if (code.includes(target2)) {
  code = code.replace(target2, replacement2);
  console.log('TARGET 2 REPLACED');
} else {
  console.log('TARGET 2 NOT FOUND');
}

fs.writeFileSync('backend/routes/registrations.js', code);
console.log('DONE');
