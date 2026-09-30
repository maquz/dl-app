const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/RegistrationForm.jsx', 'utf8');

const targetVal = `    if (!PHONE_REGEX.test(values.phoneNumber)) {
      e.phoneNumber = "Phone number must look like 024-498-9910 (10 digits with hyphens).";
    }`;

const replaceVal = `    if (!PHONE_REGEX.test(values.phoneNumber)) {
      e.phoneNumber = "Phone number must look like 024-498-9910 (10 digits with hyphens).";
    } else {
      const rawDigits = values.phoneNumber.replace(/\\D/g, "");
      if (rawDigits.startsWith("233")) {
        e.phoneNumber = "Please enter your local 10-digit number starting with 0 (do not use the 233 country code).";
      }
    }`;

const targetAuth = `    if (!PHONE_REGEX.test(authPopupPhone)) {
      setAuthPopupError("Please enter a valid phone number (e.g. 024-498-9910).");
      return;
    }`;

const replaceAuth = `    if (!PHONE_REGEX.test(authPopupPhone)) {
      setAuthPopupError("Please enter a valid phone number (e.g. 024-498-9910).");
      return;
    }
    if (authPopupPhone.replace(/\\D/g, "").startsWith("233")) {
      setAuthPopupError("Please enter your local 10-digit number starting with 0 (do not use the 233 country code).");
      return;
    }`;

if (code.includes(targetVal)) {
  code = code.replace(targetVal, replaceVal);
  if (code.includes(targetAuth)) {
    code = code.replace(targetAuth, replaceAuth);
  } else {
    console.log("targetAuth not found, but updated targetVal");
  }
  fs.writeFileSync('frontend/src/pages/RegistrationForm.jsx', code);
  console.log("Success frontend");
} else {
  console.log("Not found targetVal in frontend");
}
