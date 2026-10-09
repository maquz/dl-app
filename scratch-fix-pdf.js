const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

const targetStr = `      const canvas = await html2canvas(slip, { scale: 2, useCORS: true });
      slip.style.backgroundColor = originalBg;
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);`;

const replacementStr = `      const canvas = await html2canvas(slip, { 
        scale: 2, 
        useCORS: true,
        windowWidth: 800,
        onclone: (clonedDoc) => {
          const clonedSlip = clonedDoc.getElementById("printable-slip");
          if (clonedSlip) {
            clonedSlip.style.width = "800px";
            clonedSlip.style.maxWidth = "800px";
            clonedSlip.style.margin = "0";
            clonedSlip.style.padding = "2rem"; // Ensure good padding for the PDF
          }
        }
      });
      slip.style.backgroundColor = originalBg;
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      
      // Center the image horizontally and give a small top margin
      const marginX = (pageWidth - imgWidth) / 2;
      const marginY = 10;
      
      pdf.addImage(imgData, "PNG", marginX, marginY, imgWidth, imgHeight);`;

if (code.includes('const pdfWidth = pdf.internal.pageSize.getWidth();')) {
  code = code.replace(targetStr, replacementStr);
  fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code);
  console.log("PDF logic updated.");
} else {
  console.log("Target string not found.");
}
