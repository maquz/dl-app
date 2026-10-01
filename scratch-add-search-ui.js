const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const targetUI = `                </div>
                
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>S/N</th>`;

const replaceUI = `                </div>
                
                <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <input
                    type="search"
                    placeholder="Search IT Persons by name, district, phone, or IMEI..."
                    value={itQuery}
                    onChange={(e) => setItQuery(e.target.value)}
                    className="search-input"
                    style={{ maxWidth: "400px", width: "100%" }}
                  />
                </div>
                
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>S/N</th>`;

const searchStart = code.indexOf('                <div className="table-wrap">\n                  <table className="admin-table">\n                    <thead>\n                      <tr>\n                        <th>S/N</th>');
if (searchStart > -1) {
  // Let's just use string replace since it's unique enough.
  code = code.replace('                </div>\n                \n                <div className="table-wrap">\n                  <table className="admin-table">\n                    <thead>\n                      <tr>\n                        <th>S/N</th>', replaceUI);
  fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
  console.log("Success replacing UI");
} else {
  console.log("UI target not found");
}

