const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const targetState = '  const [query, setQuery] = useState("");';
const replaceState = '  const [query, setQuery] = useState("");\n  const [itQuery, setItQuery] = useState("");';
code = code.replace(targetState, replaceState);

const targetMemo = `  const itPersonsList = useMemo(() => {
    return displayRows
      .filter(r => (r.roles || []).some(role => role.toLowerCase().includes("it person")))
      .sort((a, b) => (a.district || "").localeCompare(b.district || ""));
  }, [displayRows]);`;

const replaceMemo = `  const itPersonsList = useMemo(() => {
    let list = displayRows.filter(r => (r.roles || []).some(role => role.toLowerCase().includes("it person")));
    if (itQuery.trim()) {
      const q = itQuery.toLowerCase();
      list = list.filter(r => 
        (r.officer_name || "").toLowerCase().includes(q) ||
        (r.district || "").toLowerCase().includes(q) ||
        (r.phone_number || "").toLowerCase().includes(q) ||
        (r.tablet_imei || "").toLowerCase().includes(q) ||
        (r.tablet_serial || "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => (a.district || "").localeCompare(b.district || ""));
  }, [displayRows, itQuery]);`;

if (code.includes(targetMemo)) {
  code = code.replace(targetMemo, replaceMemo);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
  console.log("Success replacing state and memo");
} else {
  console.log("Memo target not found");
}
