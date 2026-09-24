const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');

const targetLoop = `                      {itPersonsList.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="empty-row" style={{ textAlign: "center", padding: "2rem" }}>No IT persons found for current filters.</td>
                        </tr>
                      ) : (
                        itPersonsList.map((r, idx) => (
                          <tr key={r.id}>
                            <td>{idx + 1}</td>`;

const replaceLoop = `                      {currentItPersons.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="empty-row" style={{ textAlign: "center", padding: "2rem" }}>No IT persons found for current filters.</td>
                        </tr>
                      ) : (
                        currentItPersons.map((r, idx) => (
                          <tr key={r.id}>
                            <td>{(itPage - 1) * 20 + idx + 1}</td>`;

if (code.includes(targetLoop)) {
  code = code.replace(targetLoop, replaceLoop);
  console.log("REPLACED LOOP");
}

const targetTableEnd = `                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 5: ADMIN MANAGEMENT (SUPER ADMIN) */}`;

const replaceTableEnd = `                    )}
                  </tbody>
                </table>
              </div>
              {itTotalPages > 1 && (
                <div className="pagination">
                  <button disabled={itPage === 1} onClick={() => setItPage(itPage - 1)}>
                    &laquo; Prev
                  </button>
                  <span>
                    Page {itPage} of {itTotalPages}
                  </span>
                  <button disabled={itPage === itTotalPages} onClick={() => setItPage(itPage + 1)}>
                    Next &raquo;
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 5: ADMIN MANAGEMENT (SUPER ADMIN) */}`;

if (code.includes(targetTableEnd)) {
  code = code.replace(targetTableEnd, replaceTableEnd);
  console.log("REPLACED TABLE END");
}

fs.writeFileSync('frontend/src/pages/AdminDashboard.jsx', code);
