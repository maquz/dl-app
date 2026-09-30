const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const methodReplacement = `  async function handleExportDistrictBreakdown(action) {
    const activeCohort = cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId);
    if (!activeCohort) return;
    const data = activeCohort.districtBreakdown || [];
    const cohortName = activeCohort.name;

    const title = \`District Breakdown - \${cohortName}\`;
    const filename = \`District_Breakdown_\${cohortName.replace(/\\s+/g, '_')}\`;

    if (action === 'excel') {
      const wsData = [
        ["DISTRICT", "REGION", "EXPECTED", "REGISTERED", "ATTENDED", "REMAINING SEATS"],
        ...data.map(d => [d.district, d.region, d.expected, d.registered, d.attended, d.remaining])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Breakdown");
      XLSX.writeFile(wb, \`\${filename}.xlsx\`);
      return;
    }

    if (action === 'word') {
      let html = \`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>\${title}</title></head><body>
      <h2>\${title}</h2>
      <table border="1" style="border-collapse: collapse; width: 100%; text-align: left;">
        <thead><tr><th>District</th><th>Region</th><th>Expected</th><th>Registered</th><th>Attended</th><th>Remaining Seats</th></tr></thead>
        <tbody>
          \${data.map(d => \`<tr><td>\${d.district}</td><td>\${d.region}</td><td>\${d.expected}</td><td>\${d.registered}</td><td>\${d.attended}</td><td>\${d.remaining}</td></tr>\`).join("")}
        </tbody>
      </table></body></html>\`;
      const blob = new Blob(['\\ufeff', html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = \`\${filename}.doc\`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // PDF for Print / Share
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      doc.setFontSize(16);
      doc.text(title, 40, 40);

      const tableData = data.map(d => [d.district, d.region, d.expected, d.registered, d.attended, d.remaining]);

      doc.autoTable({
        startY: 60,
        head: [["District", "Region", "Expected", "Registered", "Attended", "Remaining"]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }
      });

      if (action === 'print') {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
      } else if (action === 'share') {
        const pdfBlob = doc.output('blob');
        const file = new File([pdfBlob], \`\${filename}.pdf\`, { type: "application/pdf" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ title: title, files: [file] });
          } catch (e) {
            if (e.name !== "AbortError") {
              alert("Your browser/device blocked the native share window. Downloading the file instead.");
              doc.save(\`\${filename}.pdf\`);
            }
          }
        } else {
          doc.save(\`\${filename}.pdf\`);
          alert("Native sharing is not supported by your browser/device. The file has been downloaded instead.");
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      console.error(err);
      alert("Error generating file.");
    }
  }

  function handleLogout() {\`;

const searchStr = '  function handleLogout() {';
const searchIdx = code.indexOf(searchStr);
if (searchIdx !== -1) {
  code = code.substring(0, searchIdx) + methodReplacement + code.substring(searchIdx + searchStr.length);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
  console.log("Success with node replace for method!");
} else {
  console.log("Target not found for method!");
}
