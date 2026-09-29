const fs = require('fs');
let code = fs.readFileSync('frontend/src/styles.css', 'utf8');

const target = `@media print {
  @page {
    margin: 0.5cm;
  }
  body {
    background: #ffffff !important;
    font-size: 11pt !important;
  }`;

const replacement = `@media print {
  @page {
    size: A4 portrait;
    margin: 1cm;
  }
  body {
    background: #ffffff !important;
    font-size: 10pt !important;
    color: #000 !important;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .slip-grid {
    display: grid !important;
    grid-template-columns: 1fr 1fr !important;
    gap: 0.5rem 1rem !important;
    text-align: left !important;
  }
  .slip-field, .slip-brand, .slip-title, .slip-meta {
    text-align: left !important;
  }
  .slip-brand {
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
  }`;

if (code.includes(target)) {
  fs.writeFileSync('frontend/src/styles.css', code.replace(target, replacement));
  console.log("Success updating print css again");
} else {
  console.log("Target not found");
}
