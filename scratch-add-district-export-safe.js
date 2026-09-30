const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const exportMethod = `

export async function handleExportDistrictBreakdownExternal(action, cohortStatsData, viewingDistrictStatsId) {
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
      const ws = window.XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Breakdown");
      window.XLSX.writeFile(wb, \`\${filename}.xlsx\`);
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
      const doc = new window.jspdf.jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
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
`;

const searchJSX = `<div style={{ marginBottom: "1rem", fontWeight: "bold", color: "var(--navy-900)" }}>
                Total Districts: {cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.districtBreakdown?.length || 0}
              </div>`;

const replaceJSX = `<div style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontWeight: "bold", color: "var(--navy-900)" }}>
                  Total Districts: {cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.districtBreakdown?.length || 0}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button className="btn-secondary" onClick={() => handleExportDistrictBreakdownExternal('print', cohortStatsData, viewingDistrictStatsId)} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"></path></svg>
                    Print
                  </button>
                  <button className="btn-secondary" onClick={() => handleExportDistrictBreakdownExternal('excel', cohortStatsData, viewingDistrictStatsId)} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="8" y1="13" x2="16" y2="13"></line><line x1="8" y1="17" x2="16" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Excel
                  </button>
                  <button className="btn-secondary" onClick={() => handleExportDistrictBreakdownExternal('word', cohortStatsData, viewingDistrictStatsId)} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Word
                  </button>
                  <button className="btn-primary" onClick={() => handleExportDistrictBreakdownExternal('share', cohortStatsData, viewingDistrictStatsId)} style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem", display: 'inline-flex', alignItems: 'center' }}>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{marginRight: '0.25rem'}}><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                    Share
                  </button>
                </div>
              </div>`;

if (code.includes(searchJSX)) {
  code = code.replace(searchJSX, replaceJSX);
  code += exportMethod;
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
  console.log("Success safely updating!");
} else {
  console.log("JSX target not found!");
}

