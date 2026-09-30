const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const targetEdit = `if (!PHONE_REGEX.test(editValues.phoneNumber)) errs.phoneNumber = "Phone format must be 000-000-0000.";`;

const replaceEdit = `if (!PHONE_REGEX.test(editValues.phoneNumber)) {
      errs.phoneNumber = "Phone format must be 000-000-0000.";
    } else if (editValues.phoneNumber.replace(/\\D/g, "").startsWith("233")) {
      errs.phoneNumber = "Use local 10-digit number (starts with 0, not 233).";
    }`;

code = code.replace(targetEdit, replaceEdit);

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
console.log("Success Admin Dashboard val");
