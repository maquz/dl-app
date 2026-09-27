const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const start = code.indexOf('function handleExportDistributionExcel');
const end = code.indexOf('}', code.indexOf('XLSX.writeFile', start)) + 1;

const oldFunc = code.substring(start, end);

const newFunc = `function handleExportDistributionExcel(itPersonsList) {
    const listRows = [...itPersonsList].sort((a, b) => (a.district || "").localeCompare(b.district || ""));
    const wsData = [
      ["S/N", "REGION", "DISTRICT", "SERIAL NO.", "IMEI NO."]
    ];
    listRows.forEach((r, i) => {
      wsData.push([
        i + 1,
        r.region || "",
        r.district || "",
        r.tablet_serial || "",
        r.tablet_imei || ""
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws["!cols"] = [
      { wch: 8 },  
      { wch: 20 }, 
      { wch: 25 }, 
      { wch: 25 }, 
      { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tablet Distribution");
    XLSX.writeFile(wb, "Tablet_Distribution_List.xlsx");
  }`;

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code.replace(oldFunc, newFunc));
console.log("Success2");
