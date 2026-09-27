const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const target = `  function handleExportDistributionExcel(itPersonsList) {
    const listRows = [...itPersonsList].sort((a, b) => (a.district || "").localeCompare(b.district || ""));
    const date = new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "long", year: "numeric" });
    const wsData = [
      ["S/N", "Name", "Role", "District", "Phone No", "Assigned IMEI", "Serial No"]
    ];
    listRows.forEach((r, i) => {
      const roleStr = r.roles ? r.roles.filter(role => role.toLowerCase().includes("it person")).join(", ") : "";
      wsData.push([
        i + 1,
        r.officer_name || "",
        roleStr,
        r.district || "",
        r.phone_number || "",
        r.tablet_imei || "Not Assigned",
        r.tablet_serial || "Not Assigned"
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws["!cols"] = [
      { wch: 5 },  
      { wch: 35 }, 
      { wch: 45 }, 
      { wch: 25 }, 
      { wch: 15 }, 
      { wch: 25 }, 
      { wch: 25 }, 
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tablet Distribution");
    XLSX.writeFile(wb, "Tablet_Distribution_List.xlsx");
  }`;

const replacement = `  function handleExportDistributionExcel(itPersonsList) {
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
      { wch: 5 },  
      { wch: 20 }, 
      { wch: 25 }, 
      { wch: 25 }, 
      { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tablet Distribution");
    XLSX.writeFile(wb, "Tablet_Distribution_List.xlsx");
  }`;

if (code.includes(target)) {
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code.replace(target, replacement));
  console.log("Success");
} else {
  console.log("Target not found");
}
