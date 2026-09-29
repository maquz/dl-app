const fs = require('fs');
let code = fs.readFileSync('frontend/src/styles.css', 'utf8');

const target = `@media print {
  body {
    background: #ffffff !important;
  }
  .site-header,
  .site-footer,
  .no-print,
  .confirmation-actions {
    display: none !important;
  }
  .page-narrow {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .form-card {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .nomination-slip {
    border: 1px solid #000000 !important;
    box-shadow: none !important;
    page-break-inside: avoid;
  }
}`;

const replacement = `@media print {
  @page {
    margin: 0.5cm;
  }
  body {
    background: #ffffff !important;
    font-size: 11pt !important;
  }
  .site-header,
  .site-footer,
  .no-print,
  .confirmation-actions {
    display: none !important;
  }
  .page-narrow {
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  .form-card {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
  }
  .nomination-slip {
    border: 1px solid #ddd !important;
    box-shadow: none !important;
    page-break-inside: avoid;
    padding: 1rem !important;
    margin: 0 !important;
  }
  .slip-grid {
    grid-template-columns: 1fr 1fr !important;
    gap: 0.5rem !important;
  }
  .slip-field {
    margin-bottom: 0.2rem !important;
  }
  .slip-field-label {
    font-size: 8pt !important;
  }
  .slip-field-val {
    font-size: 10pt !important;
  }
  .slip-footer {
    margin-top: 0.5rem !important;
    padding-top: 0.5rem !important;
  }
}`;

if (code.includes(target)) {
  fs.writeFileSync('frontend/src/styles.css', code.replace(target, replacement));
  console.log("Success updating print css");
} else {
  console.log("Target not found for print css");
}
