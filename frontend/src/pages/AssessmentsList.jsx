import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchAssessments } from "../api";

export default function AssessmentsList() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const recentNominee = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("recent_nominee") || localStorage.getItem("officer_profile") || "null");
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    fetchAssessments()
      .then((data) => setAssessments(data.assessments || []))
      .catch((err) => setError(err.message || "Failed to load assessments."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-wide">
      <div className="portal-page-header">
        <div>
          <span className="admin-status-badge" style={{ background: "#dbeafe", color: "#1e40af", borderColor: "#bfdbfe" }}>
            Participant Assessment Portal
          </span>
          <p className="form-eyebrow">Ghana Education Service · DL Master Trainer Workshop</p>
          <h1>Pre-Test & Post-Test Assessments</h1>
          <p className="section-desc">
            All registered Master Trainers are required to complete the Pre-Test before training commences and the Post-Test upon workshop completion.
          </p>
        </div>
        <div>
          <Link to="/trainer/login" className="btn-secondary">
            Facilitator Login →
          </Link>
        </div>
      </div>

      {recentNominee && (recentNominee.fullName || recentNominee.officerName) && (
        <div
          className="banner banner-info"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginBottom: "1.5rem",
            background: "#eff6ff",
            borderColor: "#bfdbfe",
            color: "#1e3a8a",
            padding: "1rem 1.25rem",
            borderRadius: "8px"
          }}
        >
          <div>
            <strong>👋 Welcome, {recentNominee.fullName || recentNominee.officerName}!</strong>
            {recentNominee.cohort && <span> · Cohort {recentNominee.cohort}</span>}
            {recentNominee.district && <span> ({recentNominee.district})</span>}
            <div style={{ fontSize: "0.88rem", marginTop: "2px", opacity: 0.9 }}>
              Please take the active Pre-Training Assessment below before your cohort workshop begins.
            </div>
          </div>
          <Link to="/confirmation" className="btn-secondary" style={{ padding: "0.4rem 0.85rem", fontSize: "0.85rem" }}>
            📋 View Registration Slip
          </Link>
        </div>
      )}

      {error && <div className="banner banner-error">{error}</div>}

      {loading && <div className="banner banner-info">Loading active assessments…</div>}

      <div className="assessments-grid">
        {!loading && assessments.length === 0 && (
          <div className="empty-row" style={{ gridColumn: "1 / -1", background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            No assessments currently active. Please check back when your facilitator opens the test.
          </div>
        )}

        {assessments.map((a) => (
          <div key={a.id} className="assessment-card">
            <div className="assessment-card-header">
              <span className={`test-type-badge type-${a.type.toLowerCase().replace(/[^a-z]/g, "")}`}>
                {a.type}
              </span>
              <span className="test-time-badge">⏱️ {a.time_limit_minutes} mins</span>
            </div>

            <div className="assessment-card-body">
              <h3 className="assessment-title">{a.title}</h3>
              <p className="assessment-desc">{a.description || "Official Differentiated Learning evaluation."}</p>

              <div className="assessment-meta-stats">
                <div className="a-meta-item">
                  <span className="a-meta-label">Questions</span>
                  <strong className="a-meta-val">{a.question_count || 0} Items</strong>
                </div>
                <div className="a-meta-item">
                  <span className="a-meta-label">Completed</span>
                  <strong className="a-meta-val">{a.submission_count || 0} Submissions</strong>
                </div>
                <div className="a-meta-item">
                  <span className="a-meta-label">Status</span>
                  <strong className="a-meta-val" style={{ color: a.is_active ? "#16a34a" : "#dc2626" }}>
                    {a.is_active ? "● Open Now" : "○ Closed"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="assessment-card-footer">
              <button
                type="button"
                className="btn-primary btn-take-test"
                disabled={!a.is_active}
                onClick={() => navigate(`/assessment/${a.id}`)}
              >
                {a.is_active ? "Start Assessment →" : "Assessment Closed"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
