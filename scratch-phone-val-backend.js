const fs = require('fs');
let code = fs.readFileSync('backend/routes/registrations.js', 'utf8');

const targetBack = `  if (!body.phoneNumber || !PHONE_REGEX.test(body.phoneNumber)) {
    errors.phoneNumber = "Phone number must be in the format 000-000-0000 (e.g. 024-498-9910).";
  }`;

const replaceBack = `  if (!body.phoneNumber || !PHONE_REGEX.test(body.phoneNumber)) {
    errors.phoneNumber = "Phone number must be in the format 000-000-0000 (e.g. 024-498-9910).";
  } else {
    const digits = body.phoneNumber.replace(/\\D/g, "");
    if (digits.startsWith("233")) {
      errors.phoneNumber = "Please enter your local 10-digit number starting with 0 (do not use the 233 country code).";
    }
  }`;

if (code.includes(targetBack)) {
  code = code.replace(targetBack, replaceBack);
  fs.writeFileSync('backend/routes/registrations.js', code);
  console.log("Success backend");
} else {
  console.log("Not found in backend");
}
