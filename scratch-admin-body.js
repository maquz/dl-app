const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const target = `  const [genderFilter, setGenderFilter] = useState("");
  const [exporting, setExporting] = useState("");`;

const replacement = `  const [genderFilter, setGenderFilter] = useState("");
  const [exporting, setExporting] = useState("");

  // Allow sticky sidebar by removing overflow-x: hidden from body only on admin dashboard
  useEffect(() => {
    document.documentElement.classList.add("admin-html");
    document.body.classList.add("admin-body");
    return () => {
      document.documentElement.classList.remove("admin-html");
      document.body.classList.remove("admin-body");
    };
  }, []);`;

if(code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
  console.log("Added useEffect to AdminDashboard.jsx");
} else {
  console.log("Target not found");
}
