import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchAssessments } from "../api";

export default function Confirmation() {
  const location = useLocation();
  const navigate = useNavigate();

  const [nominee, setNominee] = useState(() => {
    return (
      location.state?.nominee ||
      JSON.parse(sessionStorage.getItem("recent_nominee") || localStorage.getItem("officer_profile") || "null")
    );
  });

  // activeTab: 'pre-test' | 'post-test' | 'slip'
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "pre-test");
  const [assessments, setAssessments] = useState([]);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [mySubmissions, setMySubmissions] = useState([]);

  const officerName = nominee?.officerName || nominee?.fullName || location.state?.officerName || "Officer";
  const initials = officerName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DL";

  useEffect(() => {
    if (nominee) {
      sessionStorage.setItem("recent_nominee", JSON.stringify(nominee));
    }
  }, [nominee]);

  useEffect(() => {
    const cohortId = nominee?.cohortId || 1;
    Promise.all([
      fetchAssessments({ cohortId }),
      import("../api").then(api => api.fetchMySubmissions(nominee?.phoneNumber, nominee?.id).catch(() => ({ submissions: [] })))
    ])
      .then(([aData, sData]) => {
        setAssessments(aData.assessments || []);
        setMySubmissions(sData.submissions || []);
      })
      .catch((err) => {
        console.error("Failed to fetch dashboard data:", err);
      })
      .finally(() => {
        setLoadingAssessments(false);
      });
  }, [nominee?.cohortId, nominee?.phoneNumber, nominee?.id]);

  useEffect(() => {
    if (!nominee) {
      navigate("/signup", { replace: true });
    }
  }, [nominee, navigate]);

  function handlePrint() {
    window.print();
  }

  function handleSignOut() {
    localStorage.removeItem("officer_profile");
    sessionStorage.removeItem("officer_profile");
    sessionStorage.removeItem("recent_nominee");
    setNominee(null);
    navigate("/signup", { replace: true });
  }

  const preTest = assessments.find((a) => a.type === "Pre-Test" || a.id === 1);
  const postTest = assessments.find((a) => a.type === "Post-Test" || a.id === 2);

  const preTestSub = mySubmissions.find(s => s.type === "Pre-Test" || s.assessment_id === 1);
  const postTestSub = mySubmissions.find(s => String(s.type).toLowerCase() === "post-test" || s.assessment_id === 2);

  const isPreLocked = preTest ? preTest.isLocked : true;
  const preLockInfo = preTest?.lockInfo || {
    statusText: `Locked until ${nominee?.arrivalDate || "Sunday, 20/09/2026"} at 7:00 PM`,
    unlockDateFormatted: nominee?.arrivalDate || "Sunday, 20/09/2026",
    unlockTime: "7:00 PM",
  };

  const isPostLocked = postTest ? postTest.isLocked : true;
  const postLockInfo = postTest?.lockInfo || {
    statusText: `Locked until ${nominee?.endDate || "Tuesday, 22/09/2026"} at 7:00 PM`,
    unlockDateFormatted: nominee?.endDate || "Tuesday, 22/09/2026",
    unlockTime: "7:00 PM",
  };

  return (
    <div className="officer-portal-wrapper">
      {/* Top Welcome Bar */}
      <div className="officer-portal-top-bar no-print">
        <div className="officer-portal-top-left">
          <div className="officer-portal-avatar">{initials}</div>
          <div>
            <h1 className="officer-portal-greeting">Welcome, {officerName}</h1>
            <p className="officer-portal-sub">
              Nominated DL District Trainer · {nominee?.district || "National Workshop"} ({nominee?.region || "Ghana Education Service"})
            </p>
          </div>
        </div>

        <div className="portal-top-right-actions">
          <span className="admin-status-badge" style={{ background: "#dcfce7", color: "#15803d", borderColor: "#bbf7d0" }}>
            ● Registration Active
          </span>
        </div>
      </div>

      <div className="officer-dashboard-grid">
        {/* LEFT SIDEBAR MENU */}
        <aside className="officer-sidebar no-print">
          <div className="officer-sidebar-profile">
            <span className="officer-status-pill">✓ Nominated District Trainer</span>
            <h3 className="officer-sidebar-name">{officerName}</h3>
            <div className="officer-sidebar-meta">
              <span><strong>Cohort:</strong> {nominee?.cohortName || (nominee?.cohortId ? `Cohort ${nominee.cohortId}` : "Cohort 1 (Auto-Assigned)")}</span>
              <span><strong>Arrival:</strong> {nominee?.arrivalDate || "Sunday, 20/09/2026"}</span>
              <span><strong>District:</strong> {nominee?.district || "GES District"}</span>
            </div>
          </div>

          <div className="officer-menu-heading">Portal Assessments & Forms</div>
          <nav className="officer-nav-list" aria-label="Nominated Officer Menu">
            <button
              type="button"
              className={`officer-nav-btn ${activeTab === "pre-test" ? "active" : ""}`}
              onClick={() => setActiveTab("pre-test")}
            >
              <div className="officer-nav-btn-left">
                <span className="officer-nav-icon">{isPreLocked ? "🔒" : "📝"}</span>
                <div className="officer-nav-text">
                  <span className="officer-nav-title">Pre-Training Assessment</span>
                  <span className="officer-nav-sub">
                    {isPreLocked ? "Locked until 7:00 PM" : "Diagnostic Evaluation"}
                  </span>
                </div>
              </div>
              <span className={`officer-nav-badge ${isPreLocked ? "badge-locked" : "badge-open"}`} style={isPreLocked ? { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" } : {}}>
                {isPreLocked ? "🔒 Locked" : "Open"}
              </span>
            </button>

            <button
              type="button"
              className={`officer-nav-btn ${activeTab === "post-test" ? "active" : ""}`}
              onClick={() => setActiveTab("post-test")}
            >
              <div className="officer-nav-btn-left">
                <span className="officer-nav-icon">{isPostLocked ? "🔒" : "🎓"}</span>
                <div className="officer-nav-text">
                  <span className="officer-nav-title">Post-Training Assessment</span>
                  <span className="officer-nav-sub">
                    {isPostLocked ? "Locked until post-workshop" : "Workshop Evaluation"}
                  </span>
                </div>
              </div>
              <span className={`officer-nav-badge ${isPostLocked ? "badge-locked" : "badge-post"}`} style={isPostLocked ? { background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" } : {}}>
                {isPostLocked ? "🔒 Locked" : "Post-Test"}
              </span>
            </button>

            <button
              type="button"
              className={`officer-nav-btn ${activeTab === "slip" ? "active" : ""}`}
              onClick={() => setActiveTab("slip")}
            >
              <div className="officer-nav-btn-left">
                <span className="officer-nav-icon">📋</span>
                <div className="officer-nav-text">
                  <span className="officer-nav-title">Nomination Slip</span>
                  <span className="officer-nav-sub">Official Registration & Dates</span>
                </div>
              </div>
              <span className="officer-nav-badge badge-slip">Slip</span>
            </button>
          </nav>

          <div className="officer-sidebar-actions">
            <button type="button" className="btn-secondary btn-sidebar-print" onClick={handlePrint}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Print Registration Slip
            </button>
            <button
              type="button"
              className="btn-link-highlight"
              style={{ textAlign: "center", marginTop: "0.25rem", fontSize: "0.82rem", color: "#64748b" }}
              onClick={handleSignOut}
            >
              Sign out of portal
            </button>
          </div>
        </aside>

        {/* RIGHT MAIN CONTENT PANEL */}
        <main className="officer-main-panel">
          {/* TAB 1: PRE-TRAINING ASSESSMENT */}
          {activeTab === "pre-test" && (
            <div className="officer-assessment-hero">
              <div className="assessment-hero-header">
                <div className="assessment-hero-title-group">
                  <span className="test-type-pill" style={{ background: isPreLocked ? "#fee2e2" : "#dbeafe", color: isPreLocked ? "#991b1b" : "#1e40af" }}>
                    {isPreLocked ? "🔒 Scheduled Lock Active" : "Mandatory Diagnostic · Pre-Test"}
                  </span>
                  <h2>DL Pre-Training Assessment</h2>
                  <p>
                    All nominated District Trainers are required to take this diagnostic assessment upon reporting for the residential training in Kumasi.
                  </p>
                </div>
                <div className="test-timer-box">
                  <span className="timer-label">Time Limit</span>
                  <span className="timer-val">20 min</span>
                </div>
              </div>

              {/* Lock Notice Banner */}
              {isPreLocked && (
                <div className="banner" style={{ background: "#fffbeb", border: "1.5px solid #fde68a", color: "#92400e", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.4rem" }}>🔒</span>
                  <div>
                    <strong style={{ fontSize: "0.98rem", display: "block", marginBottom: "0.25rem", color: "#78350f" }}>
                      Assessment Currently Locked for Nominees
                    </strong>
                    <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5, color: "#92400e" }}>
                      This Pre-Training Assessment will automatically open for your cohort on <strong>{preLockInfo.unlockDateFormatted} at {preLockInfo.unlockTime} (7:00 PM)</strong>. Please report to the workshop venue and settle in before beginning.
                    </p>
                  </div>
                </div>
              )}

              <div className="assessment-specs-grid">
                <div className="spec-card">
                  <div className="spec-icon">⏱️</div>
                  <div className="spec-label">Duration</div>
                  <div className="spec-val">20 Minutes</div>
                </div>
                <div className="spec-card">
                  <div className="spec-icon">📝</div>
                  <div className="spec-label">Questions</div>
                  <div className="spec-val">Multiple Choice</div>
                </div>
                <div className="spec-card">
                  <div className="spec-icon">🎯</div>
                  <div className="spec-label">Objective</div>
                  <div className="spec-val">Baseline Diagnostic</div>
                </div>
                <div className="spec-card">
                  <div className="spec-icon">⚡</div>
                  <div className="spec-label">Schedule</div>
                  <div className="spec-val">{preLockInfo.unlockTime} Arrival Night</div>
                </div>
              </div>

              <div className="assessment-guidelines-box">
                <div className="guidelines-title">📌 Instructions for Nominated District Trainer</div>
                <ul className="guidelines-list">
                  <li>Your candidate profile (<strong>{officerName}</strong> · <strong>{nominee?.phoneNumber || "Registered Contact"}</strong>) will be auto-linked to your submission.</li>
                  <li>Answer each question carefully. You may change your choice before final submission.</li>
                  <li>Upon submission, your score and detailed answer breakdown will be presented immediately.</li>
                </ul>
              </div>

              {preTestSub ? (
                <div className="banner" style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", color: "#166534", borderRadius: "10px", padding: "1.5rem", marginBottom: "1.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem 0" }}>✅ Pre-Test Completed</h3>
                  <p style={{ margin: "0 0 1rem 0" }}>You have successfully submitted your Pre-Training Assessment.</p>
                  <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <div style={{ fontSize: "2rem", fontWeight: "700", color: "#15803d" }}>
                      {Math.round(preTestSub.percentage)}%
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#166534" }}>
                      <strong>Score:</strong> {preTestSub.score} / {preTestSub.total_points}
                      <br/>
                      <strong>Date:</strong> {new Date(preTestSub.submitted_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hero-action-row">
                  {isPreLocked ? (
                    <Link
                      to="/assessment/1"
                      state={{ nominee }}
                      className="btn-hero-take-test"
                      style={{ background: "#475569", borderColor: "#334155" }}
                    >
                      🔒 View Unlock Schedule & Details
                    </Link>
                  ) : (
                    <Link
                      to="/assessment/1"
                      state={{ nominee }}
                      className="btn-hero-take-test"
                    >
                      Take Pre-Training Assessment Now →
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveTab("slip")}
                  >
                    View My Registration Slip
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: POST-TRAINING ASSESSMENT */}
          {activeTab === "post-test" && (
            <div className="officer-assessment-hero">
              <div className="assessment-hero-header">
                <div className="assessment-hero-title-group">
                  <span className="test-type-pill" style={{ background: isPostLocked ? "#fee2e2" : "#fef3c7", color: isPostLocked ? "#991b1b" : "#92400e" }}>
                    {isPostLocked ? "🔒 Scheduled Lock Active" : "Final Workshop Evaluation · Post-Test"}
                  </span>
                  <h2>DL Post-Training Evaluation</h2>
                  <p>
                    Final mastery and competency assessment to be taken upon completion of your cohort workshop modules and practical sessions.
                  </p>
                </div>
                <div className="test-timer-box" style={{ background: "#fef3c7", borderColor: "#fde68a" }}>
                  <span className="timer-label" style={{ color: "#92400e" }}>Time Limit</span>
                  <span className="timer-val" style={{ color: "#78350f" }}>25 min</span>
                </div>
              </div>

              {/* Lock Notice Banner */}
              {isPostLocked && (
                <div className="banner" style={{ background: "#fffbeb", border: "1.5px solid #fde68a", color: "#92400e", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
                  <span style={{ fontSize: "1.4rem" }}>🔒</span>
                  <div>
                    <strong style={{ fontSize: "0.98rem", display: "block", marginBottom: "0.25rem", color: "#78350f" }}>
                      Post-Training Assessment Locked
                    </strong>
                    <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.5, color: "#92400e" }}>
                      This Post-Training Assessment will unlock on <strong>{postLockInfo.unlockDateFormatted} at {postLockInfo.unlockTime} (7:00 PM)</strong> after all classroom and breakout modules are completed.
                    </p>
                  </div>
                </div>
              )}

              <div className="assessment-specs-grid">
                <div className="spec-card">
                  <div className="spec-icon">⏱️</div>
                  <div className="spec-label">Duration</div>
                  <div className="spec-val">25 Minutes</div>
                </div>
                <div className="spec-card">
                  <div className="spec-icon">🎓</div>
                  <div className="spec-label">Type</div>
                  <div className="spec-val">Post-Workshop</div>
                </div>
                <div className="spec-card">
                  <div className="spec-icon">🏆</div>
                  <div className="spec-label">Pass Mark</div>
                  <div className="spec-val">70% Minimum</div>
                </div>
                <div className="spec-card">
                  <div className="spec-icon">📜</div>
                  <div className="spec-label">Outcome</div>
                  <div className="spec-val">GES District Certification</div>
                </div>
              </div>

              <div className="assessment-guidelines-box">
                <div className="guidelines-title">📌 Post-Test Requirements</div>
                <ul className="guidelines-list">
                  <li>Complete after participating in all interactive DL modules and micro-teaching breakout sessions.</li>
                  <li>Covers student profiling, tiered instructional activities, formative assessment rubrics, and inclusive classroom strategies.</li>
                  <li>Results are verified by your National Master Trainer facilitator.</li>
                </ul>
              </div>

              {postTestSub ? (
                <div className="banner" style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0", color: "#166534", borderRadius: "10px", padding: "1.5rem", marginBottom: "1.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem 0" }}>✅ Post-Test Completed</h3>
                  <p style={{ margin: "0 0 1rem 0" }}>You have successfully submitted your Post-Training Assessment.</p>
                  <div style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                    <div style={{ fontSize: "2rem", fontWeight: "700", color: "#15803d" }}>
                      {Math.round(postTestSub.percentage)}%
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#166534" }}>
                      <strong>Score:</strong> {postTestSub.score} / {postTestSub.total_points}
                      <br/>
                      <strong>Date:</strong> {new Date(postTestSub.submitted_at).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hero-action-row">
                  {isPostLocked ? (
                    <Link
                      to="/assessment/2"
                      state={{ nominee }}
                      className="btn-hero-take-test btn-hero-post-test"
                      style={{ background: "#475569", borderColor: "#334155" }}
                    >
                      🔒 View Unlock Schedule & Details
                    </Link>
                  ) : (
                    <Link
                      to="/assessment/2"
                      state={{ nominee }}
                      className="btn-hero-take-test btn-hero-post-test"
                    >
                      Take Post-Training Assessment Now →
                    </Link>
                  )}
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveTab("slip")}
                  >
                    View My Registration Slip
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: NOMINATION CONFIRMATION SLIP */}
          {activeTab === "slip" && (
            <div className="form-card confirmation-card" role="status" style={{ margin: 0 }}>
              <div className="confirmation-header no-print">
                <span className="confirmation-icon" aria-hidden="true">
                  <svg viewBox="0 0 52 52" width="48" height="48">
                    <circle cx="26" cy="26" r="24" fill="#dcfce7" stroke="#16a34a" strokeWidth="2.5" />
                    <path
                      d="M15 27 L22 34 L37 18"
                      fill="none"
                      stroke="#16a34a"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: 0 }}>Nomination Details & Schedule</h2>
                  <p className="confirmation-subtitle">
                    Official registration record in the GES Differentiated Learning database.
                  </p>
                </div>
              </div>

              {/* Printable Official Slip */}
              <div className="nomination-slip" id="printable-slip">
                <div className="slip-brand">
                  <img src="/dl-logo.jpg" alt="DL Logo" className="slip-logo" />
                  <div>
                    <p className="slip-eyebrow">Ghana Education Service</p>
                    <h2 className="slip-title">Differentiated Learning (DL) District Trainer Programme</h2>
                    <p className="slip-meta">AF2 Nominee Registration Confirmation (2026)</p>
                  </div>
                </div>

                <div className="slip-divider"></div>

                {nominee?.referenceCode && (
                  <div className="slip-ref-box">
                    <span className="ref-label">Official Reference Code:</span>
                    <span className="ref-code">{nominee.referenceCode}</span>
                  </div>
                )}

                <div className="slip-grid">
                  <div className="slip-field">
                    <span className="slip-field-label">Name of Officer</span>
                    <span className="slip-field-val font-bold">{nominee?.officerName || officerName || "—"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Sex</span>
                    <span className="slip-field-val">{nominee?.sex || "—"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Phone Number</span>
                    <span className="slip-field-val">{nominee?.phoneNumber || "—"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Email Address</span>
                    <span className="slip-field-val">{nominee?.email || "—"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Region</span>
                    <span className="slip-field-val">{nominee?.region || "—"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">District</span>
                    <span className="slip-field-val">{nominee?.district || "—"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Place of Work / Institution</span>
                    <span className="slip-field-val">{nominee?.institutionName || "—"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Assigned Training Cohort</span>
                    <span className="slip-field-val font-bold text-navy">
                      {nominee?.cohortName || (nominee?.cohortId ? `Cohort ${nominee.cohortId}` : "Cohort 1 (Auto-Assigned)")}
                    </span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Date of Arrival</span>
                    <span className="slip-field-val">{nominee?.arrivalDate || "Sunday, 20/09/2026"}</span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Training Workshop Dates</span>
                    <span className="slip-field-val">
                      {nominee?.startDate && nominee?.endDate ? `${nominee.startDate} – ${nominee.endDate}` : "Monday, 21/09/2026 – Tuesday, 22/09/2026"}
                    </span>
                  </div>

                  <div className="slip-field">
                    <span className="slip-field-label">Departure Date</span>
                    <span className="slip-field-val">{nominee?.departureDate || "Wednesday, 23/09/2026"}</span>
                  </div>

                  <div className="slip-field full-width">
                    <span className="slip-field-label">Nominated Role(s)</span>
                    <div className="slip-roles">
                      {Array.isArray(nominee?.roles) && nominee.roles.length > 0 ? (
                        nominee.roles.map((role) => (
                          <span key={role} className="role-badge">
                            {role}
                          </span>
                        ))
                      ) : (
                        <span className="slip-field-val">—</span>
                      )}
                    </div>
                  </div>

                  <div className="slip-field full-width">
                    <span className="slip-field-label">Registration Timestamp</span>
                    <span className="slip-field-val text-muted">
                      {nominee?.submittedAt ? new Date(nominee.submittedAt).toLocaleString() : new Date().toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="slip-footer">
                  <p>
                    Please keep this reference slip. The Ghana Education Service DL National / Regional Directorate will
                    communicate training schedules, reporting dates, and workshop venues via the phone number registered above.
                  </p>
                </div>
              </div>

              <div className="confirmation-actions no-print">
                <button type="button" className="btn-primary" onClick={handlePrint}>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: "6px", verticalAlign: "text-bottom" }}
                  >
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  Print / Save Registration Slip
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveTab("pre-test")}
                >
                  Go to Pre-Training Test →
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
