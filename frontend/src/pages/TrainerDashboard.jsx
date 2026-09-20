import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  fetchCohortStats,
  fetchRegistrations,
  updateAttendance,
  fetchAssessments,
  fetchAssessmentDetails,
  createAssessment,
  updateAssessment,
  toggleAssessment,
  fetchAssessmentSubmissions,
  getAssessmentPptxReportUrl,
  fetchAssessmentOverviewStats,
  fetchNationalTrainers,
  updateNationalTrainer,
} from "../api";

export default function TrainerDashboard() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("trainer_token") || sessionStorage.getItem("admin_token");
  const [trainerProfile, setTrainerProfile] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("trainer_profile") || "null");
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState("oversight"); // 'oversight' | 'assessments' | 'analytics' | 'team'
  const [successMsg, setSuccessMsg] = useState("");
  const [error, setError] = useState("");

  // Profile Edit Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    placeOfWork: "",
    scheduleRole: "Teacher",
    contactNumber: "",
    email: "",
    password: "",
  });

  // Cohorts & Participants Oversight State
  const [cohortStats, setCohortStats] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [cohortFilter, setCohortFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Assessments State
  const [assessmentsList, setAssessmentsList] = useState([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [overviewStats, setOverviewStats] = useState(null);

  // Submissions Modal State
  const [viewingSubmissionsId, setViewingSubmissionsId] = useState(null);
  const [submissionsData, setSubmissionsData] = useState({ summary: {}, submissions: [] });
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // Question / Assessment Builder Modal
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderForm, setBuilderForm] = useState({
    title: "",
    type: "Pre-Test",
    description: "",
    timeLimitMinutes: 20,
    questions: [
      {
        questionText: "",
        questionType: "multiple_choice",
        options: ["", "", "", ""],
        correctAnswer: "",
        points: 2,
      },
    ],
  });
  const [builderSaving, setBuilderSaving] = useState(false);

  // National Trainers list
  const [trainersList, setTrainersList] = useState([]);

  useEffect(() => {
    if (!token) {
      navigate("/trainer/login", { replace: true });
      return;
    }
    loadDashboardData();
  }, [token, navigate]);

  async function loadDashboardData() {
    loadCohortData();
    loadParticipants();
    loadAssessmentsData();
    loadOverviewStats();
    loadTrainers();
  }

  async function loadCohortData() {
    try {
      const data = await fetchCohortStats(token);
      setCohortStats(data);
    } catch {}
  }

  async function loadParticipants() {
    setParticipantsLoading(true);
    try {
      const filters = {};
      if (cohortFilter) filters.cohort_id = cohortFilter;
      if (attendanceFilter) filters.attendance_status = attendanceFilter;
      if (searchQuery.trim()) filters.q = searchQuery.trim();

      const res = await fetchRegistrations(token, filters);
      setParticipants(res.registrations || []);
    } catch (err) {
      setError("Failed to load participants.");
    } finally {
      setParticipantsLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadParticipants();
    }
  }, [cohortFilter, attendanceFilter, searchQuery]);

  async function loadAssessmentsData() {
    setAssessmentsLoading(true);
    try {
      const data = await fetchAssessments();
      setAssessmentsList(data.assessments || []);
    } catch {}
    finally {
      setAssessmentsLoading(false);
    }
  }

  async function loadOverviewStats() {
    try {
      const stats = await fetchAssessmentOverviewStats();
      setOverviewStats(stats);
    } catch {}
  }

  async function loadTrainers() {
    try {
      const data = await fetchNationalTrainers();
      setTrainersList(data.trainers || []);
    } catch {}
  }

  async function handleQuickCheckIn(id, currentStatus, officerName) {
    const nextStatus = currentStatus === "Attended" ? "Registered" : "Attended";
    try {
      await updateAttendance(token, id, nextStatus);
      setParticipants((prev) =>
        prev.map((p) => (p.id === id ? { ...p, attendance_status: nextStatus } : p))
      );
      loadCohortData();
      setSuccessMsg(
        nextStatus === "Attended"
          ? `✓ Marked ${officerName} as Attended.`
          : `Attendance for ${officerName} set to Registered.`
      );
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch {
      alert("Failed to update check-in status.");
    }
  }

  async function handleToggleActive(id) {
    try {
      const res = await toggleAssessment(token, id);
      setAssessmentsList((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: res.isActive } : a))
      );
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch {
      alert("Failed to toggle assessment status.");
    }
  }

  async function handleViewSubmissions(assessmentId) {
    setViewingSubmissionsId(assessmentId);
    setSubmissionsLoading(true);
    try {
      const data = await fetchAssessmentSubmissions(token, assessmentId);
      setSubmissionsData(data);
    } catch {
      alert("Failed to load submissions.");
    } finally {
      setSubmissionsLoading(false);
    }
  }

  // Question Builder Handlers
  function handleOpenCreateAssessment() {
    setEditingAssessment(null);
    setBuilderForm({
      title: "",
      type: "Pre-Test",
      description: "",
      timeLimitMinutes: 20,
      questions: [
        {
          questionText: "",
          questionType: "multiple_choice",
          options: ["", "", "", ""],
          correctAnswer: "",
          points: 2,
        },
      ],
    });
    setIsBuilderOpen(true);
  }

  async function handleOpenEditAssessment(a) {
    try {
      const full = await fetchAssessmentDetails(token, a.id);
      setEditingAssessment(full.assessment);
      setBuilderForm({
        title: full.assessment.title,
        type: full.assessment.type,
        description: full.assessment.description || "",
        timeLimitMinutes: full.assessment.time_limit_minutes || 20,
        questions: full.assessment.questions?.length > 0
          ? full.assessment.questions
          : [{ questionText: "", questionType: "multiple_choice", options: ["", "", "", ""], correctAnswer: "", points: 2 }],
      });
      setIsBuilderOpen(true);
    } catch {
      alert("Failed to load assessment details for editing.");
    }
  }

  function handleAddQuestion() {
    setBuilderForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          questionText: "",
          questionType: "multiple_choice",
          options: ["", "", "", ""],
          correctAnswer: "",
          points: 2,
        },
      ],
    }));
  }

  function handleRemoveQuestion(idx) {
    setBuilderForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((_, i) => i !== idx),
    }));
  }

  function handleUpdateQuestion(idx, field, value) {
    setBuilderForm((prev) => {
      const qs = [...prev.questions];
      qs[idx] = { ...qs[idx], [field]: value };
      return { ...prev, questions: qs };
    });
  }

  function handleUpdateOption(qIdx, optIdx, val) {
    setBuilderForm((prev) => {
      const qs = [...prev.questions];
      const opts = [...qs[qIdx].options];
      opts[optIdx] = val;
      qs[qIdx] = { ...qs[qIdx], options: opts };
      return { ...prev, questions: qs };
    });
  }

  async function handleSaveAssessment(e) {
    e.preventDefault();
    if (!builderForm.title.trim()) {
      alert("Please enter assessment title.");
      return;
    }

    setBuilderSaving(true);
    try {
      if (editingAssessment) {
        await updateAssessment(token, editingAssessment.id, builderForm);
        setSuccessMsg("Assessment updated successfully.");
      } else {
        await createAssessment(token, builderForm);
        setSuccessMsg("New assessment created successfully.");
      }
      setTimeout(() => setSuccessMsg(""), 4000);
      setIsBuilderOpen(false);
      loadAssessmentsData();
    } catch (err) {
      alert(err.message || "Failed to save assessment.");
    } finally {
      setBuilderSaving(false);
    }
  }

  function handleOpenEditProfile() {
    setProfileForm({
      name: trainerProfile?.name || "",
      placeOfWork: trainerProfile?.placeOfWork || trainerProfile?.place_of_work || "",
      scheduleRole: trainerProfile?.scheduleRole || trainerProfile?.schedule_role || "Teacher",
      contactNumber: trainerProfile?.contactNumber || trainerProfile?.contact_number || "",
      email: trainerProfile?.email || "",
      password: "",
    });
    setIsProfileModalOpen(true);
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    if (!profileForm.name.trim()) {
      alert("Please enter full name.");
      return;
    }
    if (!profileForm.contactNumber.trim()) {
      alert("Please enter contact phone number.");
      return;
    }

    setProfileSaving(true);
    try {
      const res = await updateNationalTrainer(token, trainerProfile.id, profileForm);
      const updated = {
        ...trainerProfile,
        name: res.trainer.name,
        placeOfWork: res.trainer.place_of_work,
        scheduleRole: res.trainer.schedule_role,
        contactNumber: res.trainer.contact_number,
        email: res.trainer.email,
        status: res.trainer.status,
      };
      setTrainerProfile(updated);
      sessionStorage.setItem("trainer_profile", JSON.stringify(updated));
      setSuccessMsg("Your facilitator profile details have been updated successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
      setIsProfileModalOpen(false);
      loadTrainers();
    } catch (err) {
      alert(err.message || "Failed to update profile details.");
    } finally {
      setProfileSaving(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("trainer_token");
    sessionStorage.removeItem("trainer_profile");
    sessionStorage.removeItem("admin_token");
    navigate("/trainer/login");
  }

  return (
    <div className="page-wide">
      {successMsg && (
        <div className="banner banner-success" style={{ marginBottom: "1rem" }}>
          ✓ {successMsg}
        </div>
      )}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-brand-row">
            <span className="admin-status-badge" style={{ background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }}>
              National Master Trainer
            </span>
            <p className="form-eyebrow">Ghana Education Service · GALOP AF2 Facilitator Command Center</p>
          </div>
          <h1>{trainerProfile?.name || "National Facilitator"} Dashboard</h1>
          <p className="admin-session-info">
            Designation: <strong>{trainerProfile?.scheduleRole || "Facilitator"}</strong> · Station:{" "}
            <strong>{trainerProfile?.placeOfWork || "National"}</strong> ({trainerProfile?.contactNumber})
          </p>
        </div>
        <div className="dashboard-header-actions" style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenEditProfile}
            style={{ background: "#0f766e", borderColor: "#0f766e", display: "flex", alignItems: "center", gap: "0.4rem" }}
          >
            ✏️ Edit My Details
          </button>
          <Link to="/assessments" className="btn-secondary" target="_blank">
            Open Candidate Portal ↗
          </Link>
          <button className="btn-secondary" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="dashboard-view-tabs" role="tablist">
        <button
          type="button"
          className={`dash-tab ${activeTab === "oversight" ? "active" : ""}`}
          onClick={() => setActiveTab("oversight")}
        >
          👥 Participant Oversight & Check-In ({participants.length})
        </button>
        <button
          type="button"
          className={`dash-tab ${activeTab === "assessments" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("assessments");
            loadAssessmentsData();
          }}
        >
          📝 Pre-Test & Post-Test Management ({assessmentsList.length})
        </button>
        <button
          type="button"
          className={`dash-tab ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("analytics");
            loadOverviewStats();
          }}
        >
          📊 Learning Gain & Assessment Analytics
        </button>
        <button
          type="button"
          className={`dash-tab ${activeTab === "team" ? "active" : ""}`}
          onClick={() => setActiveTab("team")}
        >
          🛡️ National Facilitators Directory ({trainersList.length})
        </button>
      </div>

      {successMsg && <div className="banner banner-success">{successMsg}</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {/* TAB 1: PARTICIPANT OVERSIGHT */}
      {activeTab === "oversight" && (
        <div className="trainer-oversight-view">
          {/* Cohort Summary Bar */}
          <div className="analytics-grid" style={{ marginBottom: "1.25rem" }}>
            <div className="kpi-card">
              <span className="kpi-label">Total Allocated</span>
              <span className="kpi-val text-navy">{cohortStats?.summary?.grandAllocated || participants.length}</span>
              <span className="kpi-hint">Across all 6 cohorts</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Total Attended</span>
              <span className="kpi-val text-green" style={{ color: "#16a34a" }}>
                {cohortStats?.summary?.grandAttended || participants.filter((p) => p.attendance_status === "Attended").length}
              </span>
              <span className="kpi-hint">Checked in at venue</span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Attendance Rate</span>
              <span className="kpi-val text-orange">
                {cohortStats?.summary?.overallAttendancePercent || 0}%
              </span>
              <span className="kpi-hint">Real-time check-in</span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="toolbar">
            <div className="toolbar-inputs">
              <input
                type="search"
                placeholder="Search nominee name, phone, institution, district…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <select value={cohortFilter} onChange={(e) => setCohortFilter(e.target.value)}>
                <option value="">All Cohorts (1–6)</option>
                <option value="1">Cohort 1 (Sun 20/09 - Ashanti)</option>
                <option value="2">Cohort 2 (Wed 23/09 - Eastern/NE/Savannah)</option>
                <option value="3">Cohort 3 (Sun 27/09 - Ahafo/Central/Northern)</option>
                <option value="4">Cohort 4 (Wed 30/09 - Bono/Bono East/Eastern/Volta)</option>
                <option value="5">Cohort 5 (Sun 04/10 - GA/Oti/Upper East)</option>
                <option value="6">Cohort 6 (Wed 07/10 - GA/Upper West/Western/WN)</option>
              </select>
              <select value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)}>
                <option value="">All Attendance</option>
                <option value="Registered">Registered (Pending)</option>
                <option value="Attended">Attended (Checked In)</option>
                <option value="Absent">Absent</option>
              </select>
            </div>
          </div>

          {/* Data Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref Code</th>
                  <th>Officer Name</th>
                  <th>Contact</th>
                  <th>Region & District</th>
                  <th>Institution</th>
                  <th>Role</th>
                  <th>Cohort & Arrival</th>
                  <th>Check-In Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {!participantsLoading && participants.length === 0 && (
                  <tr>
                    <td colSpan={9} className="empty-row">No participants found matching criteria.</td>
                  </tr>
                )}
                {participants.map((p) => (
                  <tr key={p.id}>
                    <td><span className="ref-tag">{p.referenceCode || `DL-${p.id}`}</span></td>
                    <td>
                      <strong>{p.officer_name}</strong>
                      {p.email && <div className="table-officer-email">{p.email}</div>}
                    </td>
                    <td>{p.phone_number}</td>
                    <td>{p.district}, {p.region}</td>
                    <td>{p.institution_name}</td>
                    <td>
                      <span className="table-role-badge">
                        {p.roles?.length ? p.roles[0].replace("DL Master Trainer - ", "") : "Master Trainer"}
                      </span>
                    </td>
                    <td>
                      <div className="table-cohort-box">
                        <span className="cohort-badge-pill">{p.cohort_name || `Cohort ${p.cohort_id || '—'}`}</span>
                        <span className="cohort-date-sub">{p.arrival_date || "—"}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`attendance-status-pill status-${(p.attendance_status || "registered").toLowerCase()}`}>
                        {p.attendance_status === "Attended" ? "✓ Attended" : p.attendance_status || "Registered"}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`btn-checkin-toggle ${p.attendance_status === "Attended" ? "is-attended" : ""}`}
                        onClick={() => handleQuickCheckIn(p.id, p.attendance_status || "Registered", p.officer_name)}
                      >
                        {p.attendance_status === "Attended" ? "Undo" : "Check-in"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PRE-TEST & POST-TEST ASSESSMENT MANAGEMENT */}
      {activeTab === "assessments" && (
        <div className="trainer-assessments-view">
          <div className="cohort-view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2>Pre-Test & Post-Test Question Banks</h2>
              <p>Create, activate, and manage questions for participant diagnostic and summative evaluations.</p>
            </div>
            <button className="btn-primary" onClick={handleOpenCreateAssessment}>
              + Create Assessment
            </button>
          </div>

          <div className="assessments-grid" style={{ marginTop: "1.25rem" }}>
            {assessmentsList.map((a) => (
              <div key={a.id} className="assessment-card">
                <div className="assessment-card-header">
                  <span className={`test-type-badge type-${a.type.toLowerCase().replace(/[^a-z]/g, "")}`}>
                    {a.type}
                  </span>
                  <span className="test-time-badge">⏱️ {a.time_limit_minutes} mins</span>
                </div>

                <div className="assessment-card-body">
                  <h3 className="assessment-title">{a.title}</h3>
                  <p className="assessment-desc">{a.description}</p>

                  <div className="assessment-meta-stats">
                    <div className="a-meta-item">
                      <span className="a-meta-label">Questions</span>
                      <strong className="a-meta-val">{a.question_count || 0}</strong>
                    </div>
                    <div className="a-meta-item">
                      <span className="a-meta-label">Submissions</span>
                      <strong className="a-meta-val">{a.submission_count || 0}</strong>
                    </div>
                    <div className="a-meta-item">
                      <span className="a-meta-label">Avg. Score</span>
                      <strong className="a-meta-val text-navy">
                        {a.average_score ? `${Math.round(a.average_score)}%` : "—"}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="assessment-card-footer" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className={`btn-toggle-active ${a.is_active ? "is-open" : "is-closed"}`}
                    onClick={() => handleToggleActive(a.id)}
                  >
                    {a.is_active ? "🟢 Active (Open)" : "⚪ Inactive (Closed)"}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => handleViewSubmissions(a.id)}
                  >
                    View Scores ({a.submission_count || 0})
                  </button>
                  <a
                    href={getAssessmentPptxReportUrl(a.id, "")}
                    className="btn-secondary"
                    style={{ background: "#e0f2fe", color: "#0369a1", borderColor: "#bae6fd", textDecoration: "none" }}
                  >
                    PPTX Report
                  </a>
                  <button
                    type="button"
                    className="btn-link-edit"
                    onClick={() => handleOpenEditAssessment(a)}
                  >
                    Edit Questions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LEARNING GAIN & ANALYTICS */}
      {activeTab === "analytics" && (
        <div className="trainer-analytics-view">
          <div className="cohort-view-header">
            <h2>Differentiated Learning Impact & Learning Gain Analysis</h2>
            <p>Comparative analytics measuring participant score improvement from Pre-Test to Post-Test.</p>
          </div>

          <div className="analytics-grid" style={{ marginTop: "1.25rem" }}>
            <div className="kpi-card">
              <span className="kpi-label">Pre-Test Average Score</span>
              <span className="kpi-val text-navy">{overviewStats?.preTest?.avgScore || 0}%</span>
              <span className="kpi-hint">{overviewStats?.preTest?.count || 0} tests submitted</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Post-Test Average Score</span>
              <span className="kpi-val text-green" style={{ color: "#16a34a" }}>
                {overviewStats?.postTest?.avgScore || 0}%
              </span>
              <span className="kpi-hint">{overviewStats?.postTest?.count || 0} tests submitted</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Average Learning Gain</span>
              <span className="kpi-val text-orange">+{overviewStats?.learningGain || 0}%</span>
              <span className="kpi-hint">Knowledge improvement</span>
            </div>

            <div className="kpi-card">
              <span className="kpi-label">Total Evaluations Completed</span>
              <span className="kpi-val text-navy">{overviewStats?.totalSubmissions || 0}</span>
              <span className="kpi-hint">Pre & Post test attempts</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NATIONAL FACILITATORS DIRECTORY */}
      {activeTab === "team" && (
        <div className="trainer-team-view">
          <div className="cohort-view-header">
            <h2>National Master Trainers Directory (11 Facilitators)</h2>
            <p>Official facilitators appointed under the GALOP AF2 Project (Kumasi Workshop, 18 Sept – 10 Oct 2026).</p>
          </div>

          <div className="table-wrap" style={{ marginTop: "1.25rem" }}>
            <table>
              <thead>
                <tr>
                  <th>S/N</th>
                  <th>Facilitator Name</th>
                  <th>Place of Work</th>
                  <th>Schedule / Role</th>
                  <th>Contact Number</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trainersList.map((t, idx) => (
                  <tr key={t.id}>
                    <td><strong>{idx + 1}</strong></td>
                    <td><strong>{t.name}</strong></td>
                    <td>{t.place_of_work}</td>
                    <td><span className="table-role-badge">{t.schedule_role}</span></td>
                    <td><a href={`tel:${t.contact_number}`} className="phone-link">{t.contact_number}</a></td>
                    <td>{t.email}</td>
                    <td><span className="admin-status-pill status-active">Active</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBMISSIONS MODAL */}
      {viewingSubmissionsId && (
        <div className="modal-backdrop" role="dialog">
          <div className="modal-content" style={{ maxWidth: "800px" }}>
            <div className="modal-header">
              <h2>Assessment Submissions & Candidate Scores</h2>
              <button className="modal-close-btn" onClick={() => setViewingSubmissionsId(null)}>&times;</button>
            </div>

            <div className="analytics-grid" style={{ marginBottom: "1rem" }}>
              <div className="kpi-card">
                <span className="kpi-label">Submissions</span>
                <span className="kpi-val text-navy">{submissionsData.summary?.totalSubmissions || 0}</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Average Score</span>
                <span className="kpi-val text-green" style={{ color: "#16a34a" }}>
                  {submissionsData.summary?.averagePercentage || 0}%
                </span>
              </div>
            </div>

            <div className="table-wrap" style={{ maxHeight: "400px", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Candidate Name</th>
                    <th>Phone</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Result</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {!submissionsLoading && submissionsData.submissions?.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-row">No candidate submissions yet.</td>
                    </tr>
                  )}
                  {submissionsData.submissions?.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.officer_name}</strong></td>
                      <td>{s.phone_number}</td>
                      <td>{s.score} / {s.total_points}</td>
                      <td><strong>{s.percentage}%</strong></td>
                      <td>
                        <span className={`attendance-status-pill ${s.percentage >= 50 ? "status-attended" : "status-absent"}`}>
                          {s.percentage >= 50 ? "Passed" : "Needs Review"}
                        </span>
                      </td>
                      <td>
                        <span className="table-date">
                          {new Date(
                            s.submitted_at.includes("T") ? s.submitted_at : s.submitted_at.replace(" ", "T") + "Z"
                          ).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setViewingSubmissionsId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUESTION BUILDER MODAL */}
      {isBuilderOpen && (
        <div className="modal-backdrop" role="dialog">
          <div className="modal-content" style={{ maxWidth: "850px" }}>
            <div className="modal-header">
              <h2>{editingAssessment ? "Edit Assessment & Questions" : "Create New Assessment"}</h2>
              <button className="modal-close-btn" onClick={() => setIsBuilderOpen(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveAssessment}>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="b-title">Assessment Title *</label>
                  <input
                    id="b-title"
                    type="text"
                    placeholder="e.g. DL Workshop Pre-Training Assessment"
                    value={builderForm.title}
                    onChange={(e) => setBuilderForm({ ...builderForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="b-type">Assessment Type *</label>
                  <select
                    id="b-type"
                    value={builderForm.type}
                    onChange={(e) => setBuilderForm({ ...builderForm, type: e.target.value })}
                  >
                    <option value="Pre-Test">Pre-Test (Diagnostic)</option>
                    <option value="Post-Test">Post-Test (Summative)</option>
                    <option value="Quiz">Quick Quiz</option>
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="b-desc">Description / Instructions</label>
                  <input
                    id="b-desc"
                    type="text"
                    placeholder="Instructions for participants"
                    value={builderForm.description}
                    onChange={(e) => setBuilderForm({ ...builderForm, description: e.target.value })}
                  />
                </div>

                <div className="field">
                  <label htmlFor="b-time">Time Limit (Minutes)</label>
                  <input
                    id="b-time"
                    type="number"
                    min="5"
                    max="120"
                    value={builderForm.timeLimitMinutes}
                    onChange={(e) => setBuilderForm({ ...builderForm, timeLimitMinutes: e.target.value })}
                  />
                </div>
              </div>

              {/* Questions Section */}
              <div className="builder-questions-section" style={{ marginTop: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Questions ({builderForm.questions.length})</h3>
                  <button type="button" className="btn-secondary" onClick={handleAddQuestion} style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}>
                    + Add Question
                  </button>
                </div>

                {builderForm.questions.map((q, qIdx) => (
                  <div key={qIdx} className="builder-q-card" style={{ background: "#f8fafc", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                      <strong>Question #{qIdx + 1}</strong>
                      {builderForm.questions.length > 1 && (
                        <button
                          type="button"
                          className="btn-link-danger"
                          onClick={() => handleRemoveQuestion(qIdx)}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="field">
                      <label>Question Text *</label>
                      <input
                        type="text"
                        placeholder="Enter the question prompt..."
                        value={q.questionText}
                        onChange={(e) => handleUpdateQuestion(qIdx, "questionText", e.target.value)}
                        required
                      />
                    </div>

                    <div className="field-row">
                      <div className="field">
                        <label>Question Type</label>
                        <select
                          value={q.questionType}
                          onChange={(e) => {
                            const newType = e.target.value;
                            handleUpdateQuestion(qIdx, "questionType", newType);
                            if (newType === "true_false") {
                              handleUpdateQuestion(qIdx, "options", ["True", "False"]);
                            } else {
                              handleUpdateQuestion(qIdx, "options", ["", "", "", ""]);
                            }
                          }}
                        >
                          <option value="multiple_choice">Multiple Choice</option>
                          <option value="true_false">True / False</option>
                        </select>
                      </div>

                      <div className="field">
                        <label>Points</label>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={q.points || 1}
                          onChange={(e) => handleUpdateQuestion(qIdx, "points", Number(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="field" style={{ marginTop: "0.5rem" }}>
                      <label>Answer Choices</label>
                      {q.options?.map((opt, optIdx) => (
                        <div key={optIdx} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.35rem" }}>
                          <input
                            type="radio"
                            name={`correct_${qIdx}`}
                            checked={q.correctAnswer === opt && opt !== ""}
                            onChange={() => handleUpdateQuestion(qIdx, "correctAnswer", opt)}
                            title="Select as Correct Answer"
                          />
                          <input
                            type="text"
                            placeholder={`Choice ${optIdx + 1}`}
                            value={opt}
                            onChange={(e) => {
                              handleUpdateOption(qIdx, optIdx, e.target.value);
                              if (q.correctAnswer === opt) {
                                handleUpdateQuestion(qIdx, "correctAnswer", e.target.value);
                              }
                            }}
                            required
                          />
                        </div>
                      ))}
                      <span className="field-hint">Click the radio button next to the choice to mark it as the correct answer.</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsBuilderOpen(false)} disabled={builderSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={builderSaving}>
                  {builderSaving ? "Saving..." : "Save Assessment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FACILITATOR DETAILS MODAL */}
      {isProfileModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => !profileSaving && setIsProfileModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: "560px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Facilitator Details</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsProfileModalOpen(false)}
                disabled={profileSaving}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Facilitator Full Name <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  placeholder="e.g. Dr. Victor King Anyanful"
                  style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #cbd5e1", borderRadius: "8px" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Place of Work / Station <span style={{ color: "red" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.placeOfWork}
                  onChange={(e) => setProfileForm({ ...profileForm, placeOfWork: e.target.value })}
                  placeholder="e.g. Ola College of Education"
                  style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #cbd5e1", borderRadius: "8px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
                    Schedule Role <span style={{ color: "red" }}>*</span>
                  </label>
                  <select
                    value={profileForm.scheduleRole}
                    onChange={(e) => setProfileForm({ ...profileForm, scheduleRole: e.target.value })}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}
                  >
                    <option value="Teacher">Teacher</option>
                    <option value="M&S">M&S</option>
                    <option value="STEM Coordinator">STEM Coordinator</option>
                    <option value="SISO">SISO</option>
                    <option value="Basic Schools Coordinator">Basic Schools Coordinator</option>
                    <option value="IT Coordinator">IT Coordinator</option>
                    <option value="Lecturer">Lecturer</option>
                    <option value="Facilitator">Facilitator</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
                    Account Status
                  </label>
                  <input
                    type="text"
                    disabled
                    value={trainerProfile?.status || "Active"}
                    style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc", color: "#64748b" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div className="form-group">
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
                    Contact Phone Number <span style={{ color: "red" }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={profileForm.contactNumber}
                    onChange={(e) => setProfileForm({ ...profileForm, contactNumber: e.target.value })}
                    placeholder="e.g. 026-962-4632"
                    style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #cbd5e1", borderRadius: "8px" }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
                    Official Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    placeholder="e.g. victor.anyanful@ges.gov.gh"
                    style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #cbd5e1", borderRadius: "8px" }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>
                  Reset Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  placeholder="••••••••"
                  style={{ width: "100%", padding: "0.65rem 0.85rem", border: "1.5px solid #cbd5e1", borderRadius: "8px" }}
                />
              </div>

              <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", borderTop: "1px solid #e2e8f0", paddingTop: "1rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsProfileModalOpen(false)}
                  disabled={profileSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={profileSaving}
                  style={{ background: "#0f172a", borderColor: "#0f172a" }}
                >
                  {profileSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
