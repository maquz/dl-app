const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const anchor = '                    <button className="btn-secondary" onClick={() => handleExportDistributionExcel(itPersonsList)} title="Download Distribution List (Excel)">\r\n                      ?? Export Excel\r\n                    </button>\r\n                  </div>\r\n                </div>\r\n                \r\n                <div className="table-wrap">';

const replacement = `                    <button className="btn-secondary" onClick={() => handleExportDistributionExcel(itPersonsList)} title="Download Distribution List (Excel)">\r
                      ?? Export Excel\r
                    </button>\r
                  </div>\r
                </div>\r
                \r
                <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>\r
                  <input\r
                    type="search"\r
                    placeholder="Search IT Persons by name, district, phone, or IMEI..."\r
                    value={itQuery}\r
                    onChange={(e) => {\r
                      setItQuery(e.target.value);\r
                      setItPage(1);\r
                    }}\r
                    className="search-input"\r
                    style={{ maxWidth: "400px", width: "100%" }}\r
                  />\r
                </div>\r
                \r
                <div className="table-wrap">`;

// Using split/join to avoid exact CRLF matching issues in replace:
let lines = code.split('\n');
let foundIdx = -1;
for(let i=0; i<lines.length; i++) {
   if (lines[i].includes('handleExportDistributionExcel(itPersonsList)')) {
       if (lines[i+3].includes('</div>') && lines[i+6].includes('table-wrap')) {
           foundIdx = i;
           break;
       }
   }
}

if (foundIdx > -1) {
    const insertUI = `                
                <div style={{ marginBottom: "1rem", display: "flex", justifyContent: "flex-end" }}>
                  <input
                    type="search"
                    placeholder="Search IT Persons by name, district, phone, or IMEI..."
                    value={itQuery}
                    onChange={(e) => {
                      setItQuery(e.target.value);
                      setItPage(1);
                    }}
                    className="search-input"
                    style={{ maxWidth: "400px", width: "100%" }}
                  />
                </div>
`;
    lines.splice(foundIdx + 5, 0, insertUI);
    fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', lines.join('\n'));
    console.log("Success replacing UI 3");
} else {
    console.log("Target not found via lines loop");
}

