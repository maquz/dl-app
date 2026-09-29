const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/Confirmation.jsx', 'utf8');

const target = `                  <div className="slip-field full-width">
                    <span className="slip-field-label">Registration Timestamp</span>`;

const hasItRole = `(nominee?.roles || []).some(r => String(r).toLowerCase().includes('it person'))`;

const replacement = `                  {${hasItRole} && (
                    <>
                      <div className="slip-field">
                        <span className="slip-field-label">Assigned Tablet IMEI</span>
                        <span className="slip-field-val" style={{fontFamily: 'monospace', fontWeight: 'bold'}}>{nominee?.tabletImei || "Pending Allocation"}</span>
                      </div>
                      <div className="slip-field">
                        <span className="slip-field-label">Assigned Tablet Serial</span>
                        <span className="slip-field-val" style={{fontFamily: 'monospace', fontWeight: 'bold'}}>{nominee?.tabletSerial || "Pending Allocation"}</span>
                      </div>
                    </>
                  )}

                  <div className="slip-field full-width">
                    <span className="slip-field-label">Registration Timestamp</span>`;

if (code.includes(target)) {
  fs.writeFileSync('frontend/src/pages/Confirmation.jsx', code.replace(target, replacement));
  console.log("Success");
} else {
  console.log("Not found");
}
