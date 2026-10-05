const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

// 1. Imports
if (!code.includes('import jsPDF from')) {
  code = code.replace(
    'import { fetchAssessments, fetchResources } from "../api";',
    `import { fetchAssessments, fetchResources } from "../api";\nimport jsPDF from "jspdf";\nimport html2canvas from "html2canvas";`
  );
}

// 2. handleSharePDF function
if (!code.includes('async function handleSharePDF')) {
  const printFunc = `  function handlePrint() {
    window.print();
  }`;
  
  const shareFunc = `
  async function handleSharePDF() {
    const slip = document.getElementById("printable-slip");
    if (!slip) return;
    try {
      // Temporarily ensure slip has white background for clean PDF
      const originalBg = slip.style.backgroundColor;
      slip.style.backgroundColor = "#ffffff";
      
      const canvas = await html2canvas(slip, { scale: 2, useCORS: true });
      slip.style.backgroundColor = originalBg;
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      
      const pdfBlob = pdf.output("blob");
      const file = new File([pdfBlob], "DL_Nomination_Slip.pdf", { type: "application/pdf" });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: "DL Nomination Slip",
            text: "Here is my DL Training Registration Slip."
          });
        } catch (shareErr) {
          // If user cancels or it fails, fallback silently
          if (shareErr.name !== "AbortError") {
            pdf.save("DL_Nomination_Slip.pdf");
          }
        }
      } else {
        // Fallback for desktops/browsers that don't support file sharing
        pdf.save("DL_Nomination_Slip.pdf");
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      // Fallback
      window.print();
    }
  }`;

  code = code.replace(printFunc, printFunc + shareFunc);
}

// 3. Share button
const shareBtn = `                <button type="button" className="btn-primary" onClick={handleSharePDF} style={{ background: "#25d366", borderColor: "#25d366", color: "white" }}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: "6px", verticalAlign: "text-bottom" }}
                  >
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                  Share Slip (PDF)
                </button>`;

const printBtnRegex = /(<button type="button" className="btn-primary" onClick=\{handlePrint\}>[\s\S]*?Print \/ Save Registration Slip\s*<\/button>)/;
if (!code.includes('Share Slip (PDF)')) {
  code = code.replace(printBtnRegex, `$1\n${shareBtn}`);
}

fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code);
console.log("Confirmation.jsx updated with Share feature.");
