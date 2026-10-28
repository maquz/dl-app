import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { fetchSampleSchoolAssessments, fetchMySubmissions } from "../api";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function SampleSchoolPortal() {
  const location = useLocation();
  const navigate = useNavigate();

  const [nominee, setNominee] = useState(() => {
    return (
      location.state?.nominee ||
      JSON.parse(sessionStorage.getItem("recent_nominee") || localStorage.getItem("officer_profile") || "null")
    );
  });

  const [activeTab, setActiveTab] = useState("pre-test"); // 'pre-test' | 'post-test' | 'slip'
  const [assessments, setAssessments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const officerName = nominee?.officerName || nominee?.fullName || "Participant";
  const designation = nominee?.designation || (nominee?.roles && nominee.roles[0]) || "Teacher";
  const schoolName = nominee?.schoolName || nominee?.institutionName || "Sample Primary School";
  const emisCode = nominee?.emisCode || "N/A";
  const studyGroup = nominee?.studyGroup || "Group 1";
  const treatment = nominee?.treatment || nominee?.groupName || "Standard DL Protocol";
  const district = nominee?.district || "Sample District";
  const region = nominee?.region || "Sample Region";
  const refCode = nominee?.referenceCode || `DL-SCH-2026-${String(nominee?.id || 1).padStart(4, "0")}`;

  const initials = officerName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DL";

  useEffect(() => {
    if (!nominee) {
      navigate("/schools", { replace: true });
      return;
    }

    Promise.all([
      fetchSampleSchoolAssessments().catch(() => ({ assessments: [] })),
      fetchMySubmissions(nominee.phoneNumber, nominee.id).catch(() => ({ submissions: [] })),
    ])
      .then(([aData, sData]) => {
        setAssessments(aData.assessments || []);
        setSubmissions(sData.submissions || []);
      })
      .catch((err) => console.error("Error loading portal data:", err))
      .finally(() => setLoading(false));
  }, [nominee, navigate]);

  const preTest = assessments.find((a) => a.type === "Pre-Test");
  const postTest = assessments.find((a) => a.type === "Post-Test");

  const preSub = submissions.find(
    (s) => s.type === "Pre-Test" || (preTest && s.assessment_id === preTest.id)
  );
  const postSub = submissions.find(
    (s) => String(s.type).toLowerCase() === "post-test" || (postTest && s.assessment_id === postTest.id)
  );

  const isPreLocked = preTest ? preTest.isLocked : false;
  const isPostLocked = postTest ? postTest.isLocked : true;

  async function handleDownloadPdf(shouldShare = false) {
    const slip = document.getElementById("printable-school-slip");
    if (!slip) return;

    try {
      const originalBg = slip.style.backgroundColor;
      slip.style.backgroundColor = "#ffffff";

      const canvas = await html2canvas(slip, {
        scale: 2,
        useCORS: true,
        windowWidth: 800,
        onclone: (clonedDoc) => {
          const clonedSlip = clonedDoc.getElementById("printable-school-slip");
          if (clonedSlip) {
            clonedSlip.style.width = "800px";
            clonedSlip.style.maxWidth = "800px";
            clonedSlip.style.margin = "0";
            clonedSlip.style.padding = "2rem";
          }
        },
      });

      slip.style.backgroundColor = originalBg;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      const marginX = (pageWidth - imgWidth) / 2;

      pdf.addImage(imgData, "PNG", marginX, 10, imgWidth, imgHeight);

      const fileName = `GALOP_Sample_School_Slip_${emisCode}.pdf`;

      if (shouldShare && navigator.canShare) {
        const blob = pdf.output("blob");
        const file = new File([blob], fileName, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Sample School Workshop Slip",
            text: `Registration slip for ${officerName} (${schoolName} - EMIS: ${emisCode})`,
          });
          return;
        }
      }

      pdf.save(fileName);
    } catch (err) {
      console.error("PDF generation error:", err);
      window.print();
    }
  }

  function handleSignOut() {
    localStorage.removeItem("officer_profile");
    sessionStorage.removeItem("recent_nominee");
    navigate("/schools", { replace: true });
  }

  function handlePreTrainingCardClick() {
    if (preSub) {
      setActiveTab("pre-test");
    } else {
      const targetId = preTest?.id || 4;
      navigate(`/assessment/${targetId}`, { state: { nominee } });
    }
  }

  function handlePostTrainingCardClick() {
    if (postSub) {
      setActiveTab("post-test");
    } else {
      const targetId = postTest?.id || 5;
      navigate(`/assessment/${targetId}`, { state: { nominee } });
    }
  }

  return (
    <div className="glass-dashboard-wrapper" style={{ maxWidth: "1000px", margin: "1.5rem auto", padding: "0 1rem" }}>
      {/* Hero Card */}
      <div className="glass-dashboard-hero no-print" style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
        borderRadius: "16px", padding: "1.75rem", color: "#ffffff", marginBottom: "1.5rem",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%", background: "#005BBB",
            color: "white", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", fontWeight: 800, border: "2px solid rgba(255, 255, 255, 0.3)"
          }}>
            {initials}
          </div>

          <div style={{ flex: 1, minWidth: "240px" }}>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.25rem" }}>
              <span style={{
                background: designation === "Headteacher" ? "#f59e0b" : "#10b981",
                color: "#ffffff", padding: "0.2rem 0.6rem", borderRadius: "12px",
                fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase"
              }}>
                {designation}
              </span>
              <span style={{
                background: "rgba(255, 255, 255, 0.15)", color: "#e2e8f0", padding: "0.2rem 0.6rem",
                borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600
              }}>
                {studyGroup}
              </span>
            </div>

            <h1 style={{ fontSize: "1.4rem", margin: "0 0 0.35rem 0", fontWeight: 800, color: "#ffffff" }}>
              {officerName}
            </h1>

            <div style={{ fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5 }}>
              <div>🏫 <strong>{schoolName}</strong> · EMIS: <span style={{ color: "#93c5fd", fontWeight: 700 }}>{emisCode}</span></div>
              <div>📍 {district}, {region} Region</div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            style={{
              background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#ffffff", padding: "0.45rem 0.9rem", borderRadius: "8px", fontSize: "0.82rem",
              cursor: "pointer", transition: "all 0.15s ease"
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Tabs / Clickable Quick Launch Cards */}
      <div className="glass-metrics-grid no-print" style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem", marginBottom: "1.5rem"
      }}>
        {/* Pre-Training Card */}
        <div
          onClick={handlePreTrainingCardClick}
          title={preSub ? "Click to view your submitted Pre-Test results" : "Click to launch Pre-Training Diagnostic Assessment immediately"}
          style={{
            background: "#ffffff", padding: "1.25rem 1rem", borderRadius: "12px", textAlign: "center",
            cursor: "pointer", border: activeTab === "pre-test" ? "2px solid #005BBB" : "1px solid #e2e8f0",
            boxShadow: activeTab === "pre-test" ? "0 4px 12px rgba(0, 91, 187, 0.15)" : "0 2px 4px rgba(0, 0, 0, 0.04)",
            transition: "all 0.15s ease",
            position: "relative"
          }}
        >
          <div style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>📝</div>
          <strong style={{ display: "block", color: "#0f172a", fontSize: "0.95rem" }}>Pre-Training</strong>
          <span style={{ fontSize: "0.75rem", color: preSub ? "#15803d" : "#0284c7", fontWeight: 700 }}>
            {preSub ? `Completed (${preSub.percentage}%) ✓` : "Diagnostic Assessment · Click to Begin 🚀"}
          </span>
        </div>

        {/* Post-Training Card */}
        <div
          onClick={handlePostTrainingCardClick}
          title={postSub ? "Click to view your submitted Post-Test results" : "Click to launch Post-Training Final Workshop Test immediately"}
          style={{
            background: "#ffffff", padding: "1.25rem 1rem", borderRadius: "12px", textAlign: "center",
            cursor: "pointer", border: activeTab === "post-test" ? "2px solid #005BBB" : "1px solid #e2e8f0",
            boxShadow: activeTab === "post-test" ? "0 4px 12px rgba(0, 91, 187, 0.15)" : "0 2px 4px rgba(0, 0, 0, 0.04)",
            transition: "all 0.15s ease",
            position: "relative"
          }}
        >
          <div style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>🎓</div>
          <strong style={{ display: "block", color: "#0f172a", fontSize: "0.95rem" }}>Post-Training</strong>
          <span style={{ fontSize: "0.75rem", color: postSub ? "#15803d" : "#d97706", fontWeight: 700 }}>
            {postSub ? `Completed (${postSub.percentage}%) ✓` : "Final Workshop Test · Click to Begin 🚀"}
          </span>
        </div>

        {/* Workshop Slip Card */}
        <div
          onClick={() => setActiveTab("slip")}
          title="Click to view and print your verified Workshop Slip"
          style={{
            background: "#ffffff", padding: "1.25rem 1rem", borderRadius: "12px", textAlign: "center",
            cursor: "pointer", border: activeTab === "slip" ? "2px solid #005BBB" : "1px solid #e2e8f0",
            boxShadow: activeTab === "slip" ? "0 4px 12px rgba(0, 91, 187, 0.15)" : "0 2px 4px rgba(0, 0, 0, 0.04)",
            transition: "all 0.15s ease"
          }}
        >
          <div style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>📜</div>
          <strong style={{ display: "block", color: "#0f172a", fontSize: "0.95rem" }}>Workshop Slip</strong>
          <span style={{ fontSize: "0.75rem", color: "#64748b" }}>Official Verified Record</span>
        </div>
      </div>

      {/* TAB CONTENT */}

      {/* 1. Pre-Training Tab */}
      {activeTab === "pre-test" && (
        <div className="form-card" style={{ padding: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <span style={{
                background: "#e0f2fe", color: "#0369a1", padding: "0.25rem 0.75rem",
                borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700
              }}>
                Baseline Evaluation
              </span>
              <h2 style={{ fontSize: "1.4rem", color: "#0f172a", margin: "0.5rem 0 0.25rem 0", fontWeight: 800 }}>
                Sample Schools Pre-Training Assessment
              </h2>
              <p style={{ color: "#475569", margin: 0, fontSize: "0.9rem" }}>
                Diagnostic test on DL Midterm Assessment and Weekly Lesson Checkpoint concepts.
              </p>
            </div>

            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px",
              padding: "0.6rem 1rem", textAlign: "center"
            }}>
              <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", display: "block" }}>Time Limit</span>
              <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>20 mins</strong>
            </div>
          </div>

          {preSub ? (
            <div style={{
              background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "12px",
              padding: "1.5rem", marginBottom: "1.5rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "#15803d" }}>
                  {preSub.percentage}%
                </div>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem", color: "#166534", fontWeight: 700 }}>
                    ✅ Pre-Test Completed Successfully
                  </h3>
                  <p style={{ margin: 0, color: "#15803d", fontSize: "0.9rem" }}>
                    <strong>Score:</strong> {preSub.score} / {preSub.total_points} points &nbsp;·&nbsp;
                    <strong>Date:</strong> {new Date(preSub.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div style={{ margin: "1.5rem 0" }}>
                <Link
                  to={`/assessment/${preTest?.id || 4}`}
                  state={{ nominee }}
                  className="btn-primary"
                  style={{
                    display: "inline-block", padding: "0.9rem 2rem", fontSize: "1.05rem",
                    fontWeight: 700, textDecoration: "none", borderRadius: "8px"
                  }}
                >
                  Take Pre-Training Assessment Now →
                </Link>
              </div>
            </>
          )}

          <div style={{
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px",
            padding: "1rem", fontSize: "0.85rem", color: "#475569", lineHeight: 1.6
          }}>
            <strong>📌 Instructions for Participants:</strong>
            <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0 }}>
              <li>Ensure you have a stable network connection before starting the assessment.</li>
              <li>Your submission will be auto-linked to your School (<strong>{schoolName}</strong>) and EMIS Code (<strong>{emisCode}</strong>).</li>
              <li>You may change your answers freely before clicking the final submit button.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 2. Post-Training Tab */}
      {activeTab === "post-test" && (
        <div className="form-card" style={{ padding: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <span style={{
                background: "#fef3c7", color: "#92400e", padding: "0.25rem 0.75rem",
                borderRadius: "12px", fontSize: "0.75rem", fontWeight: 700
              }}>
                Final Evaluation
              </span>
              <h2 style={{ fontSize: "1.4rem", color: "#0f172a", margin: "0.5rem 0 0.25rem 0", fontWeight: 800 }}>
                Sample Schools Post-Training Assessment
              </h2>
              <p style={{ color: "#475569", margin: 0, fontSize: "0.9rem" }}>
                Final mastery evaluation to be completed at the end of the workshop (Thursday, 29th October, 2026).
              </p>
            </div>

            <div style={{
              background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px",
              padding: "0.6rem 1rem", textAlign: "center"
            }}>
              <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase", display: "block" }}>Time Limit</span>
              <strong style={{ fontSize: "1.1rem", color: "#0f172a" }}>25 mins</strong>
            </div>
          </div>

          {postSub ? (
            <div style={{
              background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "12px",
              padding: "1.5rem", marginBottom: "1.5rem"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
                <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "#15803d" }}>
                  {postSub.percentage}%
                </div>
                <div>
                  <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1.1rem", color: "#166534", fontWeight: 700 }}>
                    🎓 Post-Test Completed
                  </h3>
                  <p style={{ margin: 0, color: "#15803d", fontSize: "0.9rem" }}>
                    <strong>Score:</strong> {postSub.score} / {postSub.total_points} points &nbsp;·&nbsp;
                    <strong>Date:</strong> {new Date(postSub.submitted_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ) : (
              <div style={{ margin: "1.5rem 0" }}>
                <Link
                  to={`/assessment/${postTest?.id || 5}`}
                  state={{ nominee }}
                  className="btn-primary"
                  style={{
                    display: "inline-block", padding: "0.9rem 2rem", fontSize: "1.05rem",
                    fontWeight: 700, textDecoration: "none", borderRadius: "8px",
                    background: "#059669", borderColor: "#059669"
                  }}
                >
                  Take Post-Training Assessment Now →
                </Link>
              </div>
          )}
        </div>
      )}

      {/* 3. Official Workshop Slip Tab */}
      {activeTab === "slip" && (
        <div>
          <div className="no-print" style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => handleDownloadPdf(false)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
            >
              📥 Download PDF Slip
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleDownloadPdf(true)}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "#25D366", color: "#ffffff", borderColor: "#22c55e" }}
            >
              📲 Share via WhatsApp / Email
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => window.print()}
            >
              🖨️ Print
            </button>
          </div>

          <div
            id="printable-school-slip"
            className="form-card"
            style={{
              padding: "2.5rem", background: "#ffffff", border: "2px solid #cbd5e1",
              borderRadius: "12px", maxWidth: "800px", margin: "0 auto"
            }}
          >
            {/* Slip Header */}
            <div style={{ textAlign: "center", borderBottom: "2px solid #005BBB", paddingBottom: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
                <img src="/dl-logo.jpg" alt="GES Logo" style={{ height: "60px", width: "auto" }} />
              </div>
              <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", margin: "0 0 0.25rem 0", textTransform: "uppercase" }}>
                Ghana Education Service (GES)
              </h2>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#005BBB", margin: "0 0 0.25rem 0" }}>
                GALOP AF2 · Sample Schools Workshop
              </h3>
              <p style={{ fontSize: "0.85rem", color: "#475569", margin: 0 }}>
                DL Midterm Assessment &amp; Weekly Lesson Checkpoint · Two-Day Non-Residential Workshop
              </p>
            </div>

            {/* Official Slip Badge */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              background: "#f8fafc", padding: "0.75rem 1.25rem", borderRadius: "8px",
              border: "1px solid #e2e8f0", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem"
            }}>
              <div>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Reference ID</span>
                <strong style={{ fontSize: "1.05rem", color: "#005BBB", display: "block" }}>{refCode}</strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Status</span>
                <strong style={{ fontSize: "0.95rem", color: "#16a34a", display: "block" }}>✓ Officially Registered</strong>
              </div>
            </div>

            {/* Slip Details Table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", width: "35%", fontWeight: 600 }}>Full Name</td>
                  <td style={{ padding: "0.6rem 0", color: "#0f172a", fontWeight: 700 }}>{officerName}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", fontWeight: 600 }}>Designation</td>
                  <td style={{ padding: "0.6rem 0", color: "#005BBB", fontWeight: 700 }}>{designation}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", fontWeight: 600 }}>Phone Number</td>
                  <td style={{ padding: "0.6rem 0", color: "#0f172a" }}>{nominee?.phoneNumber}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", fontWeight: 600 }}>School Name</td>
                  <td style={{ padding: "0.6rem 0", color: "#0f172a", fontWeight: 700 }}>{schoolName}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", fontWeight: 600 }}>EMIS Code</td>
                  <td style={{ padding: "0.6rem 0", color: "#15803d", fontWeight: 800 }}>{emisCode}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", fontWeight: 600 }}>Assigned Study Group</td>
                  <td style={{ padding: "0.6rem 0", color: "#0f172a", fontWeight: 700 }}>{studyGroup} ({treatment})</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", fontWeight: 600 }}>District &amp; Region</td>
                  <td style={{ padding: "0.6rem 0", color: "#0f172a" }}>{district}, {region} Region</td>
                </tr>
                <tr>
                  <td style={{ padding: "0.6rem 0", color: "#64748b", fontWeight: 600 }}>Workshop Schedule</td>
                  <td style={{ padding: "0.6rem 0", color: "#0f172a" }}>Tuesday, 27th Oct – Thursday, 29th Oct, 2026</td>
                </tr>
              </tbody>
            </table>

            {/* Slip Footer */}
            <div style={{
              borderTop: "1px solid #cbd5e1", paddingTop: "1rem", marginTop: "1rem",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              fontSize: "0.78rem", color: "#64748b"
            }}>
              <div>Ghana Education Service · GALOP AF2 Project</div>
              <div>Generated on {new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
