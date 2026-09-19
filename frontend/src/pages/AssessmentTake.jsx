import { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { fetchAssessmentForTest, submitAssessment } from "../api";

export default function AssessmentTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [lockInfo, setLockInfo] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Participant info
  const [nomineeProfile, setNomineeProfile] = useState(null);
  const [officerName, setOfficerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Auto-fill from navigation state, recent nominee session, or local profile
  useEffect(() => {
    try {
      const nomineeFromState = location.state?.nominee;
      const savedNominee = JSON.parse(sessionStorage.getItem("recent_nominee") || "null");
      const savedProfile = JSON.parse(localStorage.getItem("officer_profile") || "{}");

      const candidate = nomineeFromState || savedNominee || savedProfile;
      if (candidate) {
        setNomineeProfile(candidate);
        const name = candidate.fullName || candidate.officerName || candidate.name || "";
        const phone = candidate.phoneNumber || candidate.phone || "";
        if (name) setOfficerName(name);
        if (phone) setPhoneNumber(phone);
      }
    } catch {}
  }, [location.state]);

  const isAdmin = Boolean(
    sessionStorage.getItem("admin_token") ||
    sessionStorage.getItem("admin_password") ||
    sessionStorage.getItem("trainer_token") ||
    location.search.includes("bypass=true") ||
    location.search.includes("preview=true")
  );

  useEffect(() => {
    const candidateCohortId = nomineeProfile?.cohortId || 1;
    const params = { candidateCohortId };
    if (isAdmin) {
      params.bypass = "true";
    }

    fetchAssessmentForTest(id, params)
      .then((data) => {
        if (data.isLocked && !isAdmin) {
          setIsLocked(true);
          setLockInfo(data.lockInfo);
          setAssessment(data.assessment);
        } else {
          setIsLocked(false);
          setAssessment(data.assessment);
          setQuestions(data.questions || []);
        }
      })
      .catch((err) => setError(err.message || "Unable to load test."))
      .finally(() => setLoading(false));
  }, [id, nomineeProfile?.cohortId, isAdmin]);

  function handleAnswer(questionId, option) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!officerName.trim()) {
      alert("Please enter your full name.");
      return;
    }
    if (!phoneNumber.trim()) {
      alert("Please enter your phone number.");
      return;
    }

    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      if (!window.confirm(`You have answered ${answeredCount} of ${questions.length} questions. Submit anyway?`)) {
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await submitAssessment(id, {
        officerName: officerName.trim(),
        phoneNumber: phoneNumber.trim(),
        cohortId: nomineeProfile?.cohortId || 1,
        answers,
        questionIds: questions.map(q => q.id),
      });
      setResult(res);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      alert(err.message || "Failed to submit assessment.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-narrow">
        <div className="banner banner-info" style={{ textAlign: "center", padding: "2rem" }}>
          Loading assessment details…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-narrow">
        <div className="banner banner-error">{error}</div>
        <Link to="/confirmation" className="btn-secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
          ← Back to Nominated Officer Portal
        </Link>
      </div>
    );
  }

  // Locked Screen
  if (isLocked) {
    return (
      <div className="page-narrow">
        <div className="form-card result-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔒</div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--navy-900)", marginBottom: "0.5rem" }}>
            Assessment Is Currently Locked
          </h1>
          <p style={{ color: "#475569", fontSize: "1rem", maxWidth: "560px", margin: "0 auto 1.5rem", lineHeight: 1.6 }}>
            {lockInfo?.statusText || "This assessment is not yet available."}
          </p>

          <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "12px", padding: "1.25rem", maxWidth: "500px", margin: "0 auto 2rem", textAlign: "left" }}>
            <h4 style={{ margin: "0 0 0.75rem", color: "var(--navy-900)", fontSize: "0.95rem" }}>
              Assessment Schedule & Parameters
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", fontSize: "0.88rem" }}>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.78rem" }}>Assessment Title</span>
                <strong style={{ color: "#0f172a" }}>{assessment?.title || "DL Pre-Training Test"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.78rem" }}>Assigned Cohort</span>
                <strong style={{ color: "#0f172a" }}>{nomineeProfile?.cohortName || (nomineeProfile?.cohortId ? `Cohort ${nomineeProfile.cohortId}` : "Cohort 1")}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.78rem" }}>Unlock Date</span>
                <strong style={{ color: "#0f172a" }}>{lockInfo?.unlockDateFormatted || "Date of Arrival"}</strong>
              </div>
              <div>
                <span style={{ color: "#64748b", display: "block", fontSize: "0.78rem" }}>Unlock Time</span>
                <strong style={{ color: "#16a34a" }}>{lockInfo?.unlockTime || "7:00 PM"} (19:00)</strong>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            {isAdmin && (
              <button
                type="button"
                className="btn-primary"
                style={{ background: "#0284c7", borderColor: "#0284c7" }}
                onClick={() => {
                  fetchAssessmentForTest(id, { bypass: "true" }).then((data) => {
                    setIsLocked(false);
                    setAssessment(data.assessment);
                    setQuestions(data.questions || []);
                  });
                }}
              >
                🔓 Admin Instant Preview & Take Test
              </button>
            )}
            <Link to="/confirmation" className="btn-secondary">
              ← Return to District Trainer Portal
            </Link>
            <button type="button" className="btn-secondary" onClick={() => window.location.reload()}>
              🔄 Refresh Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Result View
  if (result) {
    return (
      <div className="page-narrow">
        <div className="form-card result-card">
          <div className="result-header">
            <span className="result-icon">{result.passed ? "🎉" : "📋"}</span>
            <h1>Assessment Completed!</h1>
            <p className="result-officer">Candidate: <strong>{officerName}</strong> ({phoneNumber})</p>
          </div>

          <div className="result-score-box">
            <div className="score-main">
              <span className="score-num">{result.percentage}%</span>
              <span className="score-label">Final Score: {result.score} / {result.totalPoints} points</span>
            </div>
            <span className={`result-pill ${result.passed ? "status-attended" : "status-absent"}`}>
              {result.passed ? "✓ Passed / Competency Demonstrated" : "Needs Review"}
            </span>
          </div>

          <div className="result-breakdown">
            <h3>Detailed Question Review</h3>
            {result.breakdown?.map((item, idx) => (
              <div key={item.questionId} className={`review-item ${item.isCorrect ? "correct" : "incorrect"}`}>
                <div className="review-q-header">
                  <span className="q-num">Q{idx + 1}</span>
                  <span className="q-status">{item.isCorrect ? "✓ Correct (+" + item.pointsAwarded + " pts)" : "✗ Incorrect (0 pts)"}</span>
                </div>
                <p className="review-q-text">{item.questionText}</p>
                <div className="review-answers">
                  <div className="ans-line">
                    <span className="ans-tag">Your Answer:</span>
                    <span className={`ans-val ${item.isCorrect ? "val-correct" : "val-incorrect"}`}>
                      {item.userAnswer || "Not answered"}
                    </span>
                  </div>
                  {!item.isCorrect && (
                    <div className="ans-line">
                      <span className="ans-tag">Correct Answer:</span>
                      <span className="ans-val val-correct">{item.correctAnswer}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="result-actions" style={{ display: "flex", gap: "0.85rem", flexWrap: "wrap", justifyContent: "center", marginTop: "1.5rem" }}>
            <Link to="/confirmation" className="btn-secondary">
              📋 Return to District Trainer Portal
            </Link>
            <Link to="/assessments" className="btn-primary">
              📝 Tests & Evaluations Hub →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow">
      <div className="form-card test-paper-card">
        <div className="test-header">
          <div className="test-header-left">
            <span className="test-type-pill">{assessment?.type}</span>
            <h1>{assessment?.title}</h1>
            <p className="test-desc">{assessment?.description}</p>
          </div>
          <div className="test-header-right">
            <div className="test-timer-box">
              <span className="timer-label">Time Limit</span>
              <span className="timer-val">{assessment?.timeLimitMinutes} min</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="test-form">
          {/* Candidate Identification */}
          <div className="candidate-info-box">
            <h3>Participant Information</h3>
            <div className="field-row">
              <div className="field">
                <label htmlFor="officerName">Full Name of Officer *</label>
                <input
                  id="officerName"
                  type="text"
                  placeholder="e.g. Charlotte Nyarko"
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="phoneNumber">Registered Phone Number *</label>
                <input
                  id="phoneNumber"
                  type="tel"
                  placeholder="e.g. 024-498-9910"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Question List */}
          <div className="questions-container">
            <h3>Assessment Questions ({questions.length} Items · {assessment?.totalPoints} Total Points)</h3>

            {questions.map((q, idx) => (
              <div key={q.id} className="test-question-card">
                <div className="question-header">
                  <div className="question-header-left">
                    <span className="question-number">Question {idx + 1}</span>
                    <span className="question-total-hint">of {questions.length}</span>
                  </div>
                  <span className="question-points-badge">{q.points} {q.points === 1 ? "point" : "points"}</span>
                </div>
                <div className="question-text">{q.questionText}</div>

                <div className="options-list">
                  {q.options?.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    const isSelected = answers[q.id] === opt;
                    return (
                      <label
                        key={opt}
                        className={`option-label ${isSelected ? "selected" : ""}`}
                      >
                        <div className="option-select-indicator">
                          <input
                            type="radio"
                            name={`q_${q.id}`}
                            value={opt}
                            checked={isSelected}
                            onChange={() => handleAnswer(q.id, opt)}
                            className="option-radio-input"
                          />
                          <span className="option-letter-badge">{letter}</span>
                        </div>
                        <span className="option-text-content">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="test-submit-bar">
            <span className="answered-status">
              Answered <strong>{Object.keys(answers).length}</strong> of <strong>{questions.length}</strong> questions
            </span>
            <button type="submit" className="btn-primary btn-submit-test" disabled={submitting}>
              {submitting ? "Grading & Submitting…" : "Submit Assessment →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
