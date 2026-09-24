import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import html2canvas from "html2canvas";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  fetchRegistrations,
  fetchRegions,
  deleteRegistration,
  updateRegistration,
  updateRegistrationImei,
  downloadExport,
  fetchStats,
  fetchAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  fetchCohorts,
  fetchCohortStats,
  updateAttendance,
  allocateCohort,
  fetchNationalTrainers,
  createNationalTrainer,
  updateNationalTrainer,
  deleteNationalTrainer,
  resetTrainerPassword,
  fetchAssessments,
  fetchAssessmentOverviewStats,
  fetchAssessmentDefaulters,
  fetchAssessmentDetails,
  createAssessment,
  updateAssessment,
  toggleAssessment,
  fetchAssessmentSubmissions,
  bulkImportAssessmentQuestions,
  downloadAssessmentTemplateUrl,
  getAssessmentPptxReportUrl,
  parseDocxQuestions,
} from "../api.js";
import { ROLE_OPTIONS } from "../components/RoleCheckboxGroup.jsx";
import CameraScanner from "../components/CameraScanner";

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatPhoneAsTyped(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "").slice(0, 10);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return parts.join("-");
}

async function handlePdfAction(action, title, subtitle, head, body, filename) {
  try {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    if (subtitle) {
      doc.setFontSize(10);
      doc.text(subtitle, 40, 55);
    }
    doc.autoTable({
      startY: subtitle ? 70 : 55,
      head: head,
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [15, 23, 42] },
      margin: { top: 70 },
      showHead: 'everyPage'
    });
    if (action === 'download') {
      doc.save(filename);
    } else if (action === 'print') {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
    } else if (action === 'share') {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], filename, { type: "application/pdf" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title, files: [file] });
      } else {
        doc.save(filename);
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    alert("PDF Error: " + (err.message || "Unknown error"));
    if (action === 'share') {
      try {
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        doc.autoTable({ head, body });
        doc.save(filename);
      } catch(e) {
        alert("Fallback save failed: " + e.message);
      }
    }
  }
}

async function handleHtmlPdfAction(action, elementId, filename) {
  let pdf = null;
  try {
    const el = document.getElementById(elementId);
    if (!el) return;
    const canvas = await html2canvas(el, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    // Calculate A4 size in px (approx 595 x 842 at 72dpi, let's just use image dimensions for a 1-page long pdf)
    pdf = new jsPDF({
      orientation: canvas.width > canvas.height ? "landscape" : "portrait",
      unit: "px",
      format: [canvas.width, canvas.height]
    });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
    if (action === 'download') {
      pdf.save(filename);
    } else if (action === 'print') {
      pdf.autoPrint();
      window.open(pdf.output('bloburl'), '_blank');
    } else if (action === 'share') {
      const pdfBlob = pdf.output('blob');
      const file = new File([pdfBlob], filename, { type: "application/pdf" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: filename, files: [file] });
      } else {
        pdf.save(filename);
      }
    }
  } catch (err) {
    console.error("Error exporting HTML to PDF:", err);
    if (err.name === "AbortError") return;
    if (action === 'share' && pdf) {
      pdf.save(filename);
    }
  }
}

function ExportActionButtons({ onAction }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button className="btn-secondary" onClick={() => onAction('print')} style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem", height: "auto" }}>
         🖨️ Print
      </button>
      <button className="btn-secondary" onClick={() => onAction('download')} style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem", height: "auto" }}>
         ⬇️ PDF
      </button>
      <button className="btn-primary" onClick={() => onAction('share')} style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem", height: "auto" }}>
         📤 Share
      </button>
    </div>
  );
}

function usePagination(data, itemsPerPage = 20) {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil((data?.length || 0) / itemsPerPage);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const currentData = useMemo(() => {
    const begin = (currentPage - 1) * itemsPerPage;
    const end = begin + itemsPerPage;
    return (data || []).slice(begin, end);
  }, [data, currentPage, itemsPerPage]);

  return { currentPage, setCurrentPage, totalPages, currentData };
}

function PaginationControls({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem", borderTop: "1px solid #e2e8f0", backgroundColor: "#f8fafc", borderRadius: "0 0 8px 8px" }}>
      <button 
        className="btn-secondary" 
        disabled={currentPage === 1} 
        onClick={() => onPageChange(currentPage - 1)}
        style={{ padding: "0.25rem 0.75rem" }}
      >
        Previous
      </button>
      <span style={{ fontSize: "0.9rem", color: "#64748b" }}>
        Page {currentPage} of {totalPages}
      </span>
      <button 
        className="btn-secondary" 
        disabled={currentPage === totalPages} 
        onClick={() => onPageChange(currentPage + 1)}
        style={{ padding: "0.25rem 0.75rem" }}
      >
        Next
      </button>
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const password = sessionStorage.getItem("admin_token") || sessionStorage.getItem("admin_password");

  let currentAdmin = null;
  try {
    currentAdmin = JSON.parse(sessionStorage.getItem("admin_profile") || "null");
  } catch {}

  // Active navigation tab: 'registrations' | 'cohorts' | 'national-trainers' | 'assessments' | 'admins'
  const [activeTab, setActiveTab] = useState("registrations");
  const [regions, setRegions] = useState({});
  const [cohortsList, setCohortsList] = useState([]);
  const [cohortStatsData, setCohortStatsData] = useState(null);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters for registrations
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [districtFilter, setDistrictFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [cohortFilter, setCohortFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("");
  const [exporting, setExporting] = useState("");

  // Nominee Edit Modal State
  const [editingItem, setEditingItem] = useState(null);
  const [editValues, setEditValues] = useState({
    officerName: "",
    sex: "Male",
    phoneNumber: "",
    email: "",
    region: "",
    district: "",
    institutionName: "",
    roles: [],
    cohortId: "",
    attendanceStatus: "Registered",
    checkInNotes: "",
  });
  const [editErrors, setEditErrors] = useState({});
  const [editSaving, setEditSaving] = useState(false);

  // Admin Management State
  const [adminList, setAdminList] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    role: "Admin",
    status: "Active",
    password: "",
  });
  const [adminFormErrors, setAdminFormErrors] = useState({});
  const [adminFormSaving, setAdminFormSaving] = useState(false);

  // National Master Trainers Management State
  const [trainersList, setTrainersList] = useState([]);
  const [trainersLoading, setTrainersLoading] = useState(false);
  const [trainerQuery, setTrainerQuery] = useState("");
  const [trainerRoleFilter, setTrainerRoleFilter] = useState("");
  const [trainerModalOpen, setTrainerModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState(null);
  const [trainerForm, setTrainerForm] = useState({
    name: "",
    placeOfWork: "",
    scheduleRole: "Teacher",
    contactNumber: "",
    email: "",
    status: "Active",
    password: "",
  });
  const [trainerFormErrors, setTrainerFormErrors] = useState({});
  const [trainerFormSaving, setTrainerFormSaving] = useState(false);

  // Assessments Management State
  const [assessmentsList, setAssessmentsList] = useState([]);
  const [assessmentStats, setAssessmentStats] = useState(null);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [defaultersData, setDefaultersData] = useState([]);
  const [defaultersType, setDefaultersType] = useState("");
  const [showDefaultersModal, setShowDefaultersModal] = useState(false);

  // Tablet Distribution State
  const [scanImeiFor, setScanImeiFor] = useState(null);
  const [scannedImei, setScannedImei] = useState("");
  const [scanSerialFor, setScanSerialFor] = useState(null);
  const [scannedSerial, setScannedSerial] = useState("");
  const [cameraScanData, setCameraScanData] = useState(null);

  // Question Builder Modal State
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);
  const [builderForm, setBuilderForm] = useState({
    title: "",
    type: "Pre-Test",
    description: "",
    timeLimitMinutes: 20,
    cohortId: "",
    unlockTime: "19:00",
    unlockDateType: "arrival_date",
    customUnlockDatetime: "",
    customCloseDatetime: "",
    lockMode: "scheduled",
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


  // Bulk Upload Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTargetAssessment, setBulkTargetAssessment] = useState(null);
  const [bulkQuestions, setBulkQuestions] = useState([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkImportMode, setBulkImportMode] = useState("replace"); // 'replace' | 'append'
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState("");

  // Submissions Modal State
  const [viewingSubmissionsId, setViewingSubmissionsId] = useState(null);
  const [submissionsData, setSubmissionsData] = useState({ summary: {}, submissions: [] });
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  
  const displayRows = useMemo(() => {
    if (!genderFilter) return rows;
    return rows.filter(r => {
       const s = (r.sex || "").toLowerCase();
       const g = genderFilter.toLowerCase();
       return s.startsWith(g) || s === g;
    });
  }, [rows, genderFilter]);

  const itPersonsList = useMemo(() => {
    return displayRows
      .filter(r => (r.roles || []).some(role => role.toLowerCase().includes("it person")))
      .sort((a, b) => (a.district || "").localeCompare(b.district || ""));
  }, [displayRows]);
  
  const { currentPage: regPage, setCurrentPage: setRegPage, totalPages: regTotalPages, currentData: currentRows } = usePagination(displayRows, 20);
  const { currentPage: defaultersPage, setCurrentPage: setDefaultersPage, totalPages: defaultersTotalPages, currentData: currentDefaulters } = usePagination(defaultersData, 10);
  const { currentPage: subsPage, setCurrentPage: setSubsPage, totalPages: subsTotalPages, currentData: currentSubs } = usePagination(submissionsData?.submissions || [], 15);
  
  // District Stats Modal State
  const [viewingDistrictStatsId, setViewingDistrictStatsId] = useState(null);

  // Diagnostics State
  const [selectedDiagnosticAssessment, setSelectedDiagnosticAssessment] = useState("");
  const [diagnosticData, setDiagnosticData] = useState(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);

  useEffect(() => {
    if (selectedDiagnosticAssessment && activeTab === "reports") {
      setDiagnosticLoading(true);
      fetch(`/api/assessments/${selectedDiagnosticAssessment}/diagnostics?cohort_id=${cohortFilter || ""}`, {
        headers: { "x-admin-password": password }
      })
      .then(res => res.json())
      .then(data => setDiagnosticData(data))
      .catch(e => console.error(e))
      .finally(() => setDiagnosticLoading(false));
    }
  }, [selectedDiagnosticAssessment, cohortFilter, activeTab, password]);

  useEffect(() => {
    if (!password) navigate("/admin");
  }, [password, navigate]);

  const loadStats = useCallback(async (isBackground = false) => {
    try {
      const s = await fetchStats(password);
      setStats(s);
    } catch {}
  }, [password]);

  const loadCohortStatsData = useCallback(async (isBackground = false) => {
    if (!isBackground) setCohortsLoading(true);
    try {
      const data = await fetchCohortStats(password);
      setCohortStatsData(data);
    } catch {
    } finally {
      if (!isBackground) setCohortsLoading(false);
    }
  }, [password]);

  const loadRegistrations = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setLoading(true);
      setError("");
    }
    try {
      const filters = {};
      if (query) filters.q = query;
      if (regionFilter) filters.region = regionFilter;
      if (districtFilter) filters.district = districtFilter;
      if (roleFilter) filters.role = roleFilter;
      if (cohortFilter) filters.cohort_id = cohortFilter;
      if (attendanceFilter) filters.attendance_status = attendanceFilter;
      const data = await fetchRegistrations(password, filters);
      setRows(data.registrations);
    } catch (err) {
      if (err.status === 401) {
        sessionStorage.removeItem("admin_token");
        sessionStorage.removeItem("admin_password");
        sessionStorage.removeItem("admin_profile");
        navigate("/admin");
      } else if (!isBackground) {
        setError("Could not load registrations.");
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [password, query, regionFilter, districtFilter, roleFilter, cohortFilter, attendanceFilter, navigate]);

  const loadAdmins = useCallback(async () => {
    setAdminLoading(true);
    try {
      const data = await fetchAdminUsers(password);
      setAdminList(data.admins || []);
    } catch {
    } finally {
      setAdminLoading(false);
    }
  }, [password]);

  const loadTrainers = useCallback(async () => {
    setTrainersLoading(true);
    try {
      const data = await fetchNationalTrainers();
      setTrainersList(data.trainers || []);
    } catch {
    } finally {
      setTrainersLoading(false);
    }
  }, []);

  const loadAssessmentsData = useCallback(async () => {
    setAssessmentsLoading(true);
    try {
      const [aData, sData, dData] = await Promise.all([
        fetchAssessments(),
        fetchAssessmentOverviewStats(cohortFilter),
        fetchAssessmentDefaulters(password, cohortFilter, defaultersType),
      ]);
      setAssessmentsList(aData.assessments || []);
      setAssessmentStats(sData);
      setDefaultersData(dData.defaulters || []);
    } catch {
    } finally {
      setAssessmentsLoading(false);
    }
  }, [cohortFilter, password, defaultersType]);

  useEffect(() => {
    fetchRegions().then(setRegions).catch(() => {});
    fetchCohorts().then((data) => setCohortsList(data.cohorts || [])).catch(() => {});
    loadStats();
    loadCohortStatsData();
    loadAdmins();
    loadTrainers();
    loadAssessmentsData();
  }, [loadStats, loadCohortStatsData, loadAdmins, loadTrainers, loadAssessmentsData]);

  useEffect(() => {
    const t = setTimeout(() => loadRegistrations(false), 250);
    return () => clearTimeout(t);
  }, [loadRegistrations]);

  // Live Sync Polling
  useEffect(() => {
    const interval = setInterval(() => {
      // Refresh key data quietly in the background every 15 seconds
      loadRegistrations(true);
      loadStats(true);
      loadCohortStatsData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [loadRegistrations, loadStats, loadCohortStatsData]);

  // ---------------------------------------------------
  // Nominee Actions
  // ---------------------------------------------------
  async function handleDelete(id, name) {
    if (!window.confirm(`Remove the registration for "${name}"? This cannot be undone.`)) return;
    try {
      await deleteRegistration(password, id);
      setRows((r) => r.filter((row) => row.id !== id));
      loadStats();
      loadCohortStatsData();
      setSuccessMsg(`Deleted registration for ${name}.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch {
      alert("Could not delete this registration. Please try again.");
    }
  }

  async function handleQuickCheckIn(id, currentStatus, officerName) {
    const nextStatus = currentStatus === "Attended" ? "Registered" : "Attended";
    try {
      await updateAttendance(password, id, nextStatus);
      setRows((prev) =>
        prev.map((row) =>
          row.id === id
            ? {
                ...row,
                attendance_status: nextStatus,
                attended_at: nextStatus === "Attended" ? new Date().toISOString() : null,
              }
            : row
        )
      );
      loadStats();
      loadCohortStatsData();
      setSuccessMsg(
        nextStatus === "Attended"
          ? `✓ Marked ${officerName} as Attended (Checked In).`
          : `Reset attendance status for ${officerName} to Registered.`
      );
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch {
      alert("Failed to update attendance status.");
    }
  }

  function handleOpenEdit(item) {
    setEditingItem(item);
    setEditValues({
      officerName: item.officer_name,
      sex: item.sex,
      phoneNumber: item.phone_number,
      email: item.email || "",
      region: item.region,
      district: item.district,
      institutionName: item.institution_name,
      roles: [...item.roles],
      cohortId: item.cohort_id ? String(item.cohort_id) : "",
      attendanceStatus: item.attendance_status || "Registered",
      checkInNotes: item.check_in_notes || "",
    });
    setEditErrors({});
  }

  function handleCloseEdit() {
    setEditingItem(null);
    setEditErrors({});
  }

  function handleSelectEditRole(role) {
    setEditValues((v) => ({ ...v, roles: [role] }));
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    const errs = {};
    if (!editValues.officerName.trim()) errs.officerName = "Officer name is required.";
    if (!editValues.sex) errs.sex = "Sex is required.";
    if (!PHONE_REGEX.test(editValues.phoneNumber)) errs.phoneNumber = "Phone format must be 000-000-0000.";
    if (editValues.email && editValues.email.trim() && !EMAIL_REGEX.test(editValues.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }
    if (!editValues.region) errs.region = "Region is required.";
    if (!editValues.district) errs.district = "District is required.";
    if (!editValues.institutionName.trim()) errs.institutionName = "Institution name is required.";
    if (editValues.roles.length === 0) errs.roles = "Select at least one role.";

    if (Object.keys(errs).length > 0) {
      setEditErrors(errs);
      return;
    }

    setEditSaving(true);
    setEditErrors({});
    try {
      const res = await updateRegistration(password, editingItem.id, editValues);
      setRows((prev) =>
        prev.map((row) => (row.id === editingItem.id ? { ...row, ...res.nominee } : row))
      );
      loadStats();
      loadCohortStatsData();
      setSuccessMsg(`Successfully updated details for ${editValues.officerName}.`);
      setTimeout(() => setSuccessMsg(""), 4000);
      handleCloseEdit();
    } catch (err) {
      if (err.body?.errors) {
        setEditErrors(err.body.errors);
      } else if (err.body?.error) {
        setEditErrors({ general: err.body.error });
      } else {
        setEditErrors({ general: "Failed to update registration." });
      }
    } finally {
      setEditSaving(false);
    }
  }

  // ---------------------------------------------------
  // National Master Trainers Actions
  // ---------------------------------------------------
  function handleOpenAddTrainer() {
    setEditingTrainer(null);
    setTrainerForm({
      name: "",
      placeOfWork: "",
      scheduleRole: "Teacher",
      contactNumber: "",
      email: "",
      status: "Active",
      password: "",
    });
    setTrainerFormErrors({});
    setTrainerModalOpen(true);
  }

  function handleOpenEditTrainer(trainer) {
    setEditingTrainer(trainer);
    setTrainerForm({
      name: trainer.name,
      placeOfWork: trainer.place_of_work || "",
      scheduleRole: trainer.schedule_role || "Teacher",
      contactNumber: trainer.contact_number || "",
      email: trainer.email || "",
      status: trainer.status || "Active",
      password: "",
    });
    setTrainerFormErrors({});
    setTrainerModalOpen(true);
  }

  function handleCloseTrainerModal() {
    setTrainerModalOpen(false);
    setEditingTrainer(null);
    setTrainerFormErrors({});
  }

  async function handleSaveTrainer(e) {
    e.preventDefault();
    const errs = {};
    if (!trainerForm.name.trim()) errs.name = "Full name is required.";
    if (!trainerForm.placeOfWork.trim()) errs.placeOfWork = "Place of work / station is required.";
    if (!trainerForm.contactNumber.trim()) errs.contactNumber = "Contact phone number is required.";
    if (trainerForm.email && !EMAIL_REGEX.test(trainerForm.email.trim())) {
      errs.email = "Please enter a valid email address.";
    }

    if (Object.keys(errs).length > 0) {
      setTrainerFormErrors(errs);
      return;
    }

    setTrainerFormSaving(true);
    try {
      if (editingTrainer) {
        const res = await updateNationalTrainer(password, editingTrainer.id, trainerForm);
        setTrainersList((prev) =>
          prev.map((t) => (t.id === editingTrainer.id ? { ...t, ...res.trainer } : t))
        );
        setSuccessMsg(`National Master Trainer "${res.trainer.name}" updated successfully.`);
      } else {
        const res = await createNationalTrainer(password, trainerForm);
        setTrainersList((prev) => [...prev, res.trainer]);
        setSuccessMsg(`National Master Trainer "${res.trainer.name}" added successfully.`);
      }
      setTimeout(() => setSuccessMsg(""), 4000);
      handleCloseTrainerModal();
    } catch (err) {
      setTrainerFormErrors({ general: err.message || "Failed to save facilitator." });
    } finally {
      setTrainerFormSaving(false);
    }
  }

  async function handleDeleteTrainer(trainer) {
    if (!window.confirm(`Remove facilitator "${trainer.name}" from the National Master Trainers roster?`)) return;
    try {
      await deleteNationalTrainer(password, trainer.id);
      setTrainersList((prev) => prev.filter((t) => t.id !== trainer.id));
      setSuccessMsg(`Facilitator ${trainer.name} removed from roster.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to remove facilitator.");
    }
  }

  async function handleResetTrainerPass(trainer) {
    const digits = trainer.contact_number.replace(/\D/g, "");
    if (!window.confirm(`Reset login password for ${trainer.name} to their phone number (${digits})?`)) return;
    try {
      const res = await resetTrainerPassword(password, trainer.id, digits);
      setSuccessMsg(res.message || `Password for ${trainer.name} reset to ${digits}.`);
      setTimeout(() => setSuccessMsg(""), 5000);
    } catch (err) {
      alert(err.message || "Failed to reset password.");
    }
  }

  // ---------------------------------------------------
  // Assessment & Question Builder Actions
  // ---------------------------------------------------
  async function handleToggleAssessment(a) {
    try {
      const res = await toggleAssessment(password, a.id);
      setAssessmentsList((prev) =>
        prev.map((item) => (item.id === a.id ? { ...item, is_active: res.isActive } : item))
      );
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(""), 3500);
    } catch (err) {
      alert(err.message || "Failed to toggle assessment status.");
    }
  }

  function handleOpenCreateAssessment() {
    setEditingAssessment(null);
    setBuilderForm({
      title: "",
      type: "Pre-Test",
      description: "",
      timeLimitMinutes: 20,
      cohortId: "",
      unlockTime: "19:00",
      unlockDateType: "arrival_date",
      customUnlockDatetime: "",
      customCloseDatetime: "",
      lockMode: "scheduled",
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
      const full = await fetchAssessmentDetails(password, a.id);
      setEditingAssessment(full.assessment);
      setBuilderForm({
        title: full.assessment.title,
        type: full.assessment.type,
        description: full.assessment.description || "",
        timeLimitMinutes: full.assessment.time_limit_minutes || 20,
        cohortId: full.assessment.cohort_id ? String(full.assessment.cohort_id) : "",
        unlockTime: full.assessment.unlock_time || "19:00",
        unlockDateType: full.assessment.unlock_date_type || "arrival_date",
        customUnlockDatetime: full.assessment.custom_unlock_datetime || "",
        customCloseDatetime: full.assessment.custom_close_datetime || "",
        lockMode: full.assessment.lock_mode || "scheduled",
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
        await updateAssessment(password, editingAssessment.id, builderForm);
        setSuccessMsg(`Assessment "${builderForm.title}" updated successfully.`);
      } else {
        await createAssessment(password, builderForm);
        setSuccessMsg(`New assessment "${builderForm.title}" created successfully.`);
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


  function parseQuestionsFromExcelData(data) {
    const workbook = XLSX.read(data, { type: "binary" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    const parsed = [];
    for (const row of rows) {
      const text = (
        row["Question Prompt"] ||
        row["question_prompt"] ||
        row["Question Text"] ||
        row["question_text"] ||
        row["Question"] ||
        row["question"] ||
        row["Prompt"] ||
        row["prompt"] ||
        ""
      ).toString().trim();

      if (!text) continue;

      let qType = (row["Question Type"] || row["question_type"] || row["Type"] || row["type"] || "multiple_choice").toString().toLowerCase();
      if (qType.includes("true") || qType.includes("false") || qType.includes("tf") || qType.includes("t/f")) {
        qType = "true_false";
      } else {
        qType = "multiple_choice";
      }

      let options = [];
      if (qType === "true_false") {
        options = ["True", "False"];
      } else {
        const optA = (row["Option A"] || row["option_a"] || row["Option 1"] || row["A"] || row["a"] || "").toString().trim();
        const optB = (row["Option B"] || row["option_b"] || row["Option 2"] || row["B"] || row["b"] || "").toString().trim();
        const optC = (row["Option C"] || row["option_c"] || row["Option 3"] || row["C"] || row["c"] || "").toString().trim();
        const optD = (row["Option D"] || row["option_d"] || row["Option 4"] || row["D"] || row["d"] || "").toString().trim();
        options = [optA, optB, optC, optD].filter(Boolean);
        if (options.length === 0) {
          options = ["Option A", "Option B", "Option C", "Option D"];
        }
      }

      let rawAns = (
        row["Correct Answer"] ||
        row["correct_answer"] ||
        row["Answer"] ||
        row["answer"] ||
        row["Correct"] ||
        row["correct"] ||
        ""
      ).toString().trim();

      let correctAnswer = rawAns;
      const upper = rawAns.toUpperCase();
      if (["A", "B", "C", "D"].includes(upper)) {
        const idx = upper.charCodeAt(0) - 65;
        if (options[idx]) {
          correctAnswer = options[idx];
        }
      } else if (qType === "true_false") {
        if (upper === "T" || upper.includes("TRUE")) correctAnswer = "True";
        if (upper === "F" || upper.includes("FALSE")) correctAnswer = "False";
      }

      const points = Number(row["Points"] || row["points"] || row["Score"] || row["score"] || 2) || 2;

      parsed.push({
        questionText: text,
        questionType: qType,
        options,
        correctAnswer: correctAnswer || (options[0] || "True"),
        points,
      });
    }

    return parsed;
  }

  function handleOpenBulkUpload(assessment) {
    setBulkTargetAssessment(assessment);
    setBulkQuestions([]);
    setBulkFileName("");
    setBulkError("");
    setBulkImportMode("replace");
    setIsBulkModalOpen(true);
  }

  function handleOpenBulkPreTest() {
    const pre = assessmentsList.find(a => a.type === "Pre-Test" || a.id === 1) || {
      id: 1,
      title: "DL Workshop Pre-Training Assessment",
      type: "Pre-Test",
    };
    handleOpenBulkUpload(pre);
  }

  function handleOpenBulkPostTest() {
    const post = assessmentsList.find(a => a.type === "Post-Test" || a.id === 2) || {
      id: 2,
      title: "DL Workshop Post-Training Evaluation",
      type: "Post-Test",
    };
    handleOpenBulkUpload(post);
  }

  async function handleBulkFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkFileName(file.name);
    setBulkError("");
    setBulkQuestions([]);

    // Word document — send to backend for parsing
    if (file.name.toLowerCase().endsWith(".docx")) {
      try {
        setBulkError("Parsing Word document…");
        const result = await parseDocxQuestions(file);
        if (result.questions && result.questions.length > 0) {
          setBulkQuestions(result.questions);
          setBulkError("");
        } else {
          setBulkError("No valid question rows found in Word document. Please ensure you used the official Word template and filled in the table correctly.");
        }
      } catch (err) {
        setBulkError((err.body?.error || err.message || "Failed to parse Word document.") + " Try the Excel (.xlsx) template instead.");
      }
      return;
    }

    // Excel / CSV — parse client-side with XLSX
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const parsed = parseQuestionsFromExcelData(data);
        if (parsed.length === 0) {
          setBulkError("No valid question rows found in file. Please ensure columns include 'Question Prompt', 'Option A', 'Option B', and 'Correct Answer'.");
          setBulkQuestions([]);
        } else {
          setBulkQuestions(parsed);
        }
      } catch (err) {
        setBulkError("Failed to parse file: " + (err.message || "Invalid format."));
        setBulkQuestions([]);
      }
    };
    reader.readAsBinaryString(file);
  }

  function handleBuilderFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const parsed = parseQuestionsFromExcelData(data);
        if (parsed.length > 0) {
          if (window.confirm(`Parsed ${parsed.length} questions from ${file.name}. Replace current questions in builder?`)) {
            setBuilderForm((prev) => ({
              ...prev,
              questions: parsed,
            }));
          } else {
            setBuilderForm((prev) => ({
              ...prev,
              questions: [...prev.questions, ...parsed],
            }));
          }
          setSuccessMsg(`Loaded ${parsed.length} questions into builder from ${file.name}.`);
          setTimeout(() => setSuccessMsg(""), 4000);
        } else {
          alert("No questions could be parsed from this file.");
        }
      } catch (err) {
        alert("Error parsing file: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  }

  async function handleConfirmBulkUpload() {
    if (!bulkTargetAssessment || bulkQuestions.length === 0) return;

    setBulkSaving(true);
    setBulkError("");
    try {
      const res = await bulkImportAssessmentQuestions(
        password,
        bulkTargetAssessment.id,
        bulkQuestions,
        bulkImportMode
      );
      setSuccessMsg(res.message || `Successfully imported ${bulkQuestions.length} questions!`);
      setTimeout(() => setSuccessMsg(""), 5000);
      setIsBulkModalOpen(false);
      loadAssessmentsData();
    } catch (err) {
      setBulkError(err.message || "Failed to import questions.");
    } finally {
      setBulkSaving(false);
    }
  }

  async function handleViewSubmissions(assessmentId) {
    setViewingSubmissionsId(assessmentId);
    setSubmissionsLoading(true);
    try {
      const data = await fetchAssessmentSubmissions(password, assessmentId);
      setSubmissionsData(data);
    } catch {
      alert("Failed to load submissions.");
    } finally {
      setSubmissionsLoading(false);
    }
  }

  async function handleViewAllSubmissions() {
    setViewingSubmissionsId("ALL");
    setSubmissionsLoading(true);
    try {
      const { fetchAllSubmissions } = await import("../api.js");
      const data = await fetchAllSubmissions(password);
      setSubmissionsData(data);
    } catch {
      alert("Failed to load all submissions.");
    } finally {
      setSubmissionsLoading(false);
    }
  }

  // ---------------------------------------------------
  // Admin Management Actions
  // ---------------------------------------------------
  function handleOpenAddAdmin() {
    setEditingAdmin(null);
    setAdminForm({
      name: "",
      email: "",
      phoneNumber: "",
      role: "Admin",
      status: "Active",
      password: "",
    });
    setAdminFormErrors({});
    setAdminModalOpen(true);
  }

  function handleOpenEditAdmin(admin) {
    setEditingAdmin(admin);
    setAdminForm({
      name: admin.name,
      email: admin.email,
      phoneNumber: admin.phone_number || "",
      role: admin.role,
      status: admin.status,
      password: "",
    });
    setAdminFormErrors({});
    setAdminModalOpen(true);
  }

  function handleCloseAdminModal() {
    setAdminModalOpen(false);
    setEditingAdmin(null);
    setAdminFormErrors({});
  }

  async function handleSaveAdmin(e) {
    e.preventDefault();
    const errs = {};
    if (!adminForm.name.trim()) errs.name = "Full name is required.";
    if (!adminForm.email.trim() || !EMAIL_REGEX.test(adminForm.email.trim())) {
      errs.email = "Valid email is required.";
    }
    if (!editingAdmin && (!adminForm.password || adminForm.password.length < 6)) {
      errs.password = "Initial password must be at least 6 characters.";
    }
    if (editingAdmin && adminForm.password && adminForm.password.length < 6) {
      errs.password = "Password must be at least 6 characters.";
    }

    if (Object.keys(errs).length > 0) {
      setAdminFormErrors(errs);
      return;
    }

    setAdminFormSaving(true);
    try {
      if (editingAdmin) {
        const res = await updateAdminUser(password, editingAdmin.id, adminForm);
        setAdminList((prev) =>
          prev.map((a) => (a.id === editingAdmin.id ? { ...a, ...res.admin } : a))
        );
        setSuccessMsg(`Administrator ${res.admin.name} updated successfully.`);
      } else {
        const res = await createAdminUser(password, adminForm);
        setAdminList((prev) => [res.admin, ...prev]);
        setSuccessMsg(`Administrator ${res.admin.name} created successfully.`);
      }
      setTimeout(() => setSuccessMsg(""), 4000);
      handleCloseAdminModal();
    } catch (err) {
      if (err.body?.errors) {
        setAdminFormErrors(err.body.errors);
      } else if (err.body?.error) {
        setAdminFormErrors({ general: err.body.error });
      } else {
        setAdminFormErrors({ general: "Failed to save administrator." });
      }
    } finally {
      setAdminFormSaving(false);
    }
  }

  async function handleDeleteAdmin(admin) {
    if (!window.confirm(`Permanently remove administrator "${admin.name}" (${admin.email})?`)) return;
    try {
      await deleteAdminUser(password, admin.id);
      setAdminList((prev) => prev.filter((a) => a.id !== admin.id));
      setSuccessMsg(`Administrator ${admin.name} deleted.`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      alert(err.message || "Failed to delete administrator.");
    }
  }

  async function handleExport(format) {
    setExporting(format);
    try {
      await downloadExport(password, format);
    } catch {
      alert("Export failed. Please try again.");
    } finally {
      setExporting("");
    }
  }

  // ---- Export Signed List (Word Format) ----
  function handleExportSignedList() {
    const listRows = [...rows].sort((a, b) => (a.district || "").localeCompare(b.district || ""));
    const date = new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "long", year: "numeric" });
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Attendance Signed List</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }</style></head><body>";
    const footer = "</body></html>";
    let html = `<h2 style='text-align:center;'>Nominee Attendance Signed List</h2>`;
    html += `<p style='text-align:center;'>Generated on ${date} &bull; Total: ${listRows.length} nominee(s)</p>`;
    html += "<table>";
    html += "<tr><th>S/N</th><th>Name</th><th>District</th><th>Institution</th><th>Phone No</th><th>Signature</th></tr>";
    
    listRows.forEach((r, i) => {
      html += `<tr>
        <td>${i + 1}</td>
        <td><strong>${r.officer_name}</strong></td>
        <td>${r.district || ""}</td>
        <td>${r.institution_name || ""}</td>
        <td>${r.phone_number || ""}</td>
        <td style='width:150px;'></td>
      </tr>`;
    });
    html += "</table>";
    
    const sourceHTML = header + html + footer;
    const blob = new Blob(['\ufeff', sourceHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Signed_List_${date.replace(/ /g, "_")}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ---- Export Signed List (Excel Format) ----
  function handleExportSignedListExcel() {
    const listRows = [...rows].sort((a, b) => (a.district || "").localeCompare(b.district || ""));
    const date = new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "long", year: "numeric" });
    
    const wsData = [
      ["S/N", "Name", "District", "Institution", "Phone No", "Signature"]
    ];
    
    listRows.forEach((r, i) => {
      wsData.push([
        i + 1,
        r.officer_name || "",
        r.district || "",
        r.institution_name || "",
        r.phone_number || "",
        "" 
      ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws["!cols"] = [
      { wch: 5 },  
      { wch: 35 }, 
      { wch: 25 }, 
      { wch: 35 }, 
      { wch: 15 }, 
      { wch: 25 }, 
    ];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Signed List");
    
    XLSX.writeFile(wb, `Signed_List_${date.replace(/ /g, "_")}.xlsx`);
  }

  function handleExportDistributionWord(itPersonsList) {
    const listRows = [...itPersonsList].sort((a, b) => (a.district || "").localeCompare(b.district || ""));
    const date = new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "long", year: "numeric" });
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Tablet Distribution List</title><style>table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid black; padding: 8px; text-align: left; } th { background-color: #f2f2f2; }</style></head><body>";
    const footer = "</body></html>";
    let html = `<h2 style='text-align:center;'>Tablet Distribution List (IT Persons)</h2>`;
    html += `<p style='text-align:center;'>Generated on ${date} &bull; Total: ${listRows.length} IT Person(s)</p>`;
    html += "<table>";
    html += "<tr><th>S/N</th><th>Name</th><th>Role</th><th>District</th><th>Phone No</th><th>Assigned IMEI</th><th>Serial No</th></tr>";
    
    listRows.forEach((r, i) => {
      const roleStr = r.roles ? r.roles.filter(role => role.toLowerCase().includes("it person")).join(", ") : "";
      html += `<tr>
        <td>${i + 1}</td>
        <td><strong>${r.officer_name}</strong></td>
        <td>${roleStr}</td>
        <td>${r.district || ""}</td>
        <td>${r.phone_number || ""}</td>
        <td style='font-family: monospace;'>${r.tablet_imei || "Not Assigned"}</td>
        <td style='font-family: monospace;'>${r.tablet_serial || "Not Assigned"}</td>
      </tr>`;
    });
    html += "</table>";
    const blob = new Blob(['\ufeff', header + html + footer], {
      type: "application/msword;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Tablet_Distribution_List.doc";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleExportDistributionExcel(itPersonsList) {
    const listRows = [...itPersonsList].sort((a, b) => (a.district || "").localeCompare(b.district || ""));
    const date = new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "long", year: "numeric" });
    const wsData = [
      ["S/N", "Name", "Role", "District", "Phone No", "Assigned IMEI", "Serial No"]
    ];
    listRows.forEach((r, i) => {
      const roleStr = r.roles ? r.roles.filter(role => role.toLowerCase().includes("it person")).join(", ") : "";
      wsData.push([
        i + 1,
        r.officer_name || "",
        roleStr,
        r.district || "",
        r.phone_number || "",
        r.tablet_imei || "Not Assigned",
        r.tablet_serial || "Not Assigned"
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    ws["!cols"] = [
      { wch: 5 },  
      { wch: 35 }, 
      { wch: 45 }, 
      { wch: 25 }, 
      { wch: 15 }, 
      { wch: 25 }, 
      { wch: 25 }, 
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tablet Distribution");
    XLSX.writeFile(wb, `Tablet_Distribution_${date.replace(/ /g, "_")}.xlsx`);
  }

  // ---- Print current filtered nominees table ----
  function handlePrint() {
    const printRows = rows;
    const date = new Date().toLocaleDateString("en-GH", { day: "2-digit", month: "long", year: "numeric" });
    const tableRows = printRows.map((r) => `
      <tr>
        <td>${r.referenceCode || `DL-${r.id}`}</td>
        <td><strong>${r.officer_name}</strong><br/><small>${r.email || ""}</small></td>
        <td>${r.sex}</td>
        <td>${r.phone_number}</td>
        <td>${r.region}<br/><small>${r.district}</small></td>
        <td>${r.institution_name}</td>
        <td>${(r.roles || []).map(role => role.replace("DL Master Trainer - ", "").replace("DL District Trainer - ", "")).join(", ")}</td>
        <td>${r.cohort_name || (r.cohort_id ? "Cohort " + r.cohort_id : "—")}</td>
        <td>${r.attendance_status || "Registered"}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><title>DL Nominees List – ${date}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 20px; }
        h2 { font-size: 15px; margin: 0 0 2px; }
        .sub { color: #666; font-size: 11px; margin: 0 0 12px; }
        table { border-collapse: collapse; width: 100%; }
        th { background: #1a2e4a; color: #fff; padding: 6px 8px; text-align: left; font-size: 10px; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
        tr:nth-child(even) td { background: #f9f9f9; }
        small { color: #666; }
        .footer { margin-top: 16px; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 8px; }
      </style></head><body>
      <h2>Ghana Education Service — Differentiated Learning Programme</h2>
      <p class="sub">AF2 Nominee Registration List · Printed on ${date} · Total: ${printRows.length} nominee(s)</p>
      <table>
        <thead><tr>
          <th>Ref Code</th><th>Officer Name</th><th>Sex</th><th>Phone</th>
          <th>Region / District</th><th>Institution</th><th>Role</th><th>Cohort</th><th>Status</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer">Generated from GES DL Nomination Portal · Confidential</div>
      </body></html>`;
    const win = window.open("", "_blank", "width=1000,height=700");
    if (!win) { alert("Please allow pop-ups to print."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  }

  // ---- Share modal state ----


  async function handleOpenShare() {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      
      const title = "GES DL Programme - Nominee Registrations";
      const filterText = `Filters: Region=${regionFilter || "All"}, District=${districtFilter || "All"}, Cohort=${cohortFilter || "All"}, Attendance=${attendanceFilter || "All"}`;
      
      doc.setFontSize(16);
      doc.text(title, 40, 40);
      doc.setFontSize(10);
      doc.text(filterText, 40, 55);

      const tableData = rows.map(r => [
        r.officer_name,
        r.sex,
        formatPhoneAsTyped(r.phone_number),
        `${r.region} / ${r.district}`,
        r.institution_name,
        r.schedule_role,
        r.cohort_id ? `Cohort ${r.cohort_id}` : "Pending",
        r.attendance_status
      ]);

      doc.autoTable({
        startY: 70,
        head: [["Officer Name", "Sex", "Phone", "Region / District", "Institution", "Role", "Cohort", "Status"]],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] }, // var(--navy-900)
        margin: { top: 70 },
        showHead: 'everyPage' // This ensures the heading is on each page produced
      });

      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], "DL_Nominees_Report.pdf", { type: "application/pdf" });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "GES DL Nominees Report",
          text: "Here is the latest DL Nominees report.",
          files: [file]
        });
      } else {
        // Fallback: download the file
        doc.save("DL_Nominees_Report.pdf");
      }
    } catch (err) {
      console.error("Error sharing PDF:", err);
      if (err.name === "AbortError") return;
      try {
        const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
        const title = "GES DL Programme - Nominee Registrations";
        const filterText = `Filters: Region=${regionFilter || "All"}, District=${districtFilter || "All"}, Cohort=${cohortFilter || "All"}, Attendance=${attendanceFilter || "All"}`;
        
        doc.setFontSize(16);
        doc.text(title, 40, 40);
        doc.setFontSize(10);
        doc.text(filterText, 40, 55);

        const tableData = rows.map(r => [
          r.officer_name,
          r.sex,
          formatPhoneAsTyped(r.phone_number),
          `${r.region} / ${r.district}`,
          r.institution_name,
          r.schedule_role,
          r.cohort_id ? `Cohort ${r.cohort_id}` : "Pending",
          r.attendance_status
        ]);

        doc.autoTable({
          startY: 70,
          head: [["Officer Name", "Sex", "Phone", "Region / District", "Institution", "Role", "Cohort", "Status"]],
          body: tableData,
          theme: 'striped',
          headStyles: { fillColor: [15, 23, 42] },
          margin: { top: 70 },
          showHead: 'everyPage'
        });
        
        doc.save("DL_Nominees_Report.pdf");
      } catch (fallbackErr) {
        console.error("Fallback download also failed:", fallbackErr);
      }
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("admin_token");
    sessionStorage.removeItem("admin_password");
    sessionStorage.removeItem("admin_profile");
    navigate("/admin");
  }

  const regionNames = useMemo(() => Object.keys(regions), [regions]);
  const filterDistricts = useMemo(() => (regionFilter ? regions[regionFilter] || [] : []), [regionFilter, regions]);
  const editDistricts = useMemo(() => (editValues.region ? regions[editValues.region] || [] : []), [editValues.region, regions]);

  // Analytics calculation strictly bound to current filtered rows
  const totalCount = rows.length;
  const maleCount = rows.filter((r) => r.sex === "Male").length;
  const femaleCount = rows.filter((r) => r.sex === "Female").length;
  const attendedCount = rows.filter((r) => r.attendance_status === "Attended").length;
  const pendingCount = Math.max(0, totalCount - attendedCount);

  // Filtered trainers list
  const filteredTrainers = useMemo(() => {
    return trainersList.filter((t) => {
      const matchesQuery =
        !trainerQuery ||
        t.name.toLowerCase().includes(trainerQuery.toLowerCase()) ||
        (t.email && t.email.toLowerCase().includes(trainerQuery.toLowerCase())) ||
        (t.place_of_work && t.place_of_work.toLowerCase().includes(trainerQuery.toLowerCase())) ||
        t.contact_number.includes(trainerQuery);

      const matchesRole = !trainerRoleFilter || t.schedule_role === trainerRoleFilter;
      return matchesQuery && matchesRole;
    });
  }, [trainersList, trainerQuery, trainerRoleFilter]);

  const handleAssignDeviceData = async (id, field, rawValue) => {
    let value = rawValue.trim();
    if (field === 'serial') {
      value = value.toUpperCase();
    }
    
    if (value) {
      if (field === 'imei') {
        if (!/^\d{15}$/.test(value)) {
          alert("Invalid IMEI format. It should be exactly 15 digits.\n\nPlease make sure you are scanning the bottom barcode.");
          return false;
        }
      } else if (field === 'serial') {
        if (!/^[A-Z0-9]{11}$/i.test(value)) {
          alert("Invalid Serial Number format. Samsung tablet serials are exactly 11 alphanumeric characters (e.g., R8YL...).\n\nPlease ensure you are scanning the middle barcode (S/N), not the top UPC code.");
          return false;
        }
      }

      const dupUser = rows.find(r => r.id !== id && (
        (field === 'imei' && r.tablet_imei === value) || 
        (field === 'serial' && r.tablet_serial === value)
      ));

      if (dupUser) {
        const confirmReplace = window.confirm(`This ${field === 'imei' ? 'IMEI' : 'Serial No'} is already assigned to ${dupUser.officer_name || 'another user'} (${dupUser.district || 'Unknown District'}).\n\nDo you want to reassign it to this officer?`);
        if (!confirmReplace) return false;
        
        // Remove from dup user locally
        setRows(prev => prev.map(row => {
          if (row.id === dupUser.id) {
            return { ...row, [field === 'imei' ? 'tablet_imei' : 'tablet_serial']: null };
          }
          return row;
        }));
      }
    }

    try {
      const payload = field === 'imei' ? { tablet_imei: value || null } : { tablet_serial: value || null };
      await updateRegistrationImei(password, id, payload);
      setRows(prev => prev.map(row => row.id === id ? { ...row, ...payload } : row));
      return true;
    } catch (err) {
      alert(`Failed to assign ${field === 'imei' ? 'IMEI' : 'Serial No'}: ` + err.message);
      return false;
    }
  };

  const isSuperAdmin = !currentAdmin || currentAdmin.role === "Super Admin";

  return (
    <div className="page-wide">
      {/* Top Header */}
      <div className="dashboard-header">
        <div>
          <div className="dashboard-brand-row">
            <span className="admin-status-badge">
              {currentAdmin?.role || "Super Admin"}
            </span>
            <p className="form-eyebrow">Ghana Education Service · GALOP AF2 National Portal</p>
          </div>
          <h1>Differentiated Learning Dashboard</h1>
          {currentAdmin && (
            <p className="admin-session-info">
              Logged in as <strong>{currentAdmin.name}</strong> ({currentAdmin.email})
            </p>
          )}
        </div>
        <div className="dashboard-header-actions">
          <button className="btn-secondary" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="banner banner-success" role="alert">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      {/* Main Two-Column Admin Layout with Left Sidebar */}
      <div className="admin-layout">
        {/* Left-Side Navigation Sidebar */}
        <aside className="admin-sidebar" aria-label="Admin Navigation Menu">
          <div className="admin-sidebar-header">
            <div className="admin-sidebar-brand">
              <span className="admin-sidebar-title">Management Menu</span>
              <span className="admin-sidebar-badge">DL Portal</span>
            </div>
            <p className="admin-sidebar-user">
              {currentAdmin?.name || "Administrator"}
            </p>
          </div>

          <div className="admin-nav-group">
            <div className="admin-nav-group-label">Core Operations</div>
            <nav className="admin-sidebar-nav">
              <button
                type="button"
                className={`admin-nav-item ${activeTab === "registrations" ? "active" : ""}`}
                onClick={() => setActiveTab("registrations")}
              >
                <div className="admin-nav-item-left">
                  <span className="admin-nav-item-icon">📋</span>
                  <div className="admin-nav-item-text">
                    <span>Nominees List</span>
                    <span className="admin-nav-item-sub">Tracking & Check-In</span>
                  </div>
                </div>
                <span className="admin-nav-item-badge">{totalCount}</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item ${activeTab === "cohorts" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("cohorts");
                  loadCohortStatsData();
                }}
              >
                <div className="admin-nav-item-left">
                  <span className="admin-nav-item-icon">📅</span>
                  <div className="admin-nav-item-text">
                    <span>Cohort Schedules</span>
                    <span className="admin-nav-item-sub">Arrival & Attendance</span>
                  </div>
                </div>
                <span className="admin-nav-item-badge">6 Cohorts</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item ${activeTab === "national-trainers" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("national-trainers");
                  loadTrainers();
                }}
              >
                <div className="admin-nav-item-left">
                  <span className="admin-nav-item-icon">👨‍🏫</span>
                  <div className="admin-nav-item-text">
                    <span>Master Trainers</span>
                    <span className="admin-nav-item-sub">National Facilitators</span>
                  </div>
                </div>
                <span className="admin-nav-item-badge">{trainersList.length}</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item ${activeTab === "assessments" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("assessments");
                  loadAssessmentsData();
                }}
              >
                <div className="admin-nav-item-left">
                  <span className="admin-nav-item-icon">📝</span>
                  <div className="admin-nav-item-text">
                    <span>Questions & Tests</span>
                    <span className="admin-nav-item-sub">Builder & Evaluations</span>
                  </div>
                </div>
                <span className="admin-nav-item-badge">{assessmentsList.length}</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item ${activeTab === "reports" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("reports");
                  loadAssessmentsData();
                }}
              >
                <div className="admin-nav-item-left">
                  <span className="admin-nav-item-icon">📈</span>
                  <div className="admin-nav-item-text">
                    <span>Reports & Analytics</span>
                    <span className="admin-nav-item-sub">Charts and Metrics</span>
                  </div>
                </div>
              </button>

              <button
                type="button"
                className={`admin-nav-item ${activeTab === "distribution" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("distribution");
                }}
              >
                <div className="admin-nav-item-left">
                  <span className="admin-nav-item-icon">📱</span>
                  <div className="admin-nav-item-text">
                    <span>Tablet Distribution</span>
                    <span className="admin-nav-item-sub">Assign Devices</span>
                  </div>
                </div>
              </button>
            </nav>
          </div>

          {isSuperAdmin && (
            <div className="admin-nav-group">
              <div className="admin-nav-group-label">Access & Security</div>
              <nav className="admin-sidebar-nav">
                <button
                  type="button"
                  className={`admin-nav-item ${activeTab === "admins" ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab("admins");
                    loadAdmins();
                  }}
                >
                  <div className="admin-nav-item-left">
                    <span className="admin-nav-item-icon">🛡️</span>
                    <div className="admin-nav-item-text">
                      <span>System Admins</span>
                      <span className="admin-nav-item-sub">Roles & Permissions</span>
                    </div>
                  </div>
                  <span className="admin-nav-item-badge">{adminList.length}</span>
                </button>
              </nav>
            </div>
          )}

          <div className="admin-sidebar-footer">
            <div className="admin-quick-links-title">Public & Portal Portals</div>
            <Link to="/" className="admin-quick-link" target="_blank" rel="noreferrer">
              🌐 Candidate Registration ↗
            </Link>
            <Link to="/assessments" className="admin-quick-link" target="_blank" rel="noreferrer">
              📝 Assessments Portal ↗
            </Link>

            <button type="button" className="btn-secondary btn-sidebar-signout" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="admin-main-content">
          {/* VIEW 1: NOMINEE REGISTRATIONS */}
          {activeTab === "registrations" && (
            <>
              {/* Analytics KPI Cards */}
              <div className="analytics-grid">
                <div 
                  className="kpi-card" 
                  style={{ cursor: "pointer", transition: "transform 0.2s" }}
                  onClick={() => {
                    setRegionFilter("");
                    setDistrictFilter("");
                    setRoleFilter("");
                    setCohortFilter("");
                    setAttendanceFilter("");
                    setQuery("");
                    setGenderFilter("");
                  }}
                  title="Click to clear all filters"
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <span className="kpi-label">Total Nominees</span>
                  <span className="kpi-val text-navy">{totalCount}</span>
                  <span className="kpi-hint">Registered across Ghana</span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">
                    Gender Breakdown
                    {genderFilter && (
                      <button onClick={(e) => { e.stopPropagation(); setGenderFilter(""); }} style={{ marginLeft: "8px", fontSize: "0.75rem", padding: "2px 6px", borderRadius: "12px", border: "1px solid #cbd5e1", background: "#f8fafc", cursor: "pointer" }}>
                        Clear Filter
                      </button>
                    )}
                  </span>
                  <div className="kpi-split">
                    <span 
                      className="split-item" 
                      style={{ cursor: "pointer", padding: "4px", borderRadius: "4px", backgroundColor: genderFilter === "Male" ? "#e0f2fe" : "transparent" }}
                      onClick={() => setGenderFilter("Male")}
                      title="Filter by Male"
                    >
                      <strong>{maleCount}</strong> Male {totalCount > 0 && `(${Math.round((maleCount / totalCount) * 100)}%)`}
                    </span>
                    <span 
                      className="split-item" 
                      style={{ cursor: "pointer", padding: "4px", borderRadius: "4px", backgroundColor: genderFilter === "Female" ? "#fce7f3" : "transparent" }}
                      onClick={() => setGenderFilter("Female")}
                      title="Filter by Female"
                    >
                      <strong>{femaleCount}</strong> Female {totalCount > 0 && `(${Math.round((femaleCount / totalCount) * 100)}%)`}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill progress-male"
                      style={{ width: `${totalCount > 0 ? (maleCount / totalCount) * 100 : 50}%` }}
                    ></div>
                  </div>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">Overall Attendance</span>
                  <div className="kpi-split">
                    <span 
                      className="split-item" 
                      style={{ cursor: "pointer", padding: "4px", borderRadius: "4px", backgroundColor: attendanceFilter === "Attended" ? "#dcfce7" : "transparent" }}
                      onClick={() => setAttendanceFilter(prev => prev === "Attended" ? "" : "Attended")}
                      title="Filter by Attended"
                    >
                      <strong>{attendedCount}</strong> Attended
                    </span>
                    <span 
                      className="split-item" 
                      style={{ cursor: "pointer", padding: "4px", borderRadius: "4px", backgroundColor: attendanceFilter === "Registered" ? "#fef3c7" : "transparent" }}
                      onClick={() => setAttendanceFilter(prev => prev === "Registered" ? "" : "Registered")}
                      title="Filter by Pending"
                    >
                      <strong>{pendingCount}</strong> Pending
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill progress-green"
                      style={{
                        width: `${totalCount > 0 ? (attendedCount / totalCount) * 100 : 0}%`,
                        backgroundColor: "#16a34a",
                      }}
                    ></div>
                  </div>
                </div>

                <div 
                  className="kpi-card" 
                  style={{ cursor: "pointer", transition: "transform 0.2s" }}
                  onClick={() => document.querySelector(".toolbar")?.scrollIntoView({ behavior: "smooth" })}
                  title="Scroll to table"
                  onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}
                >
                  <span className="kpi-label">Filtered Results</span>
                  <span className="kpi-val text-orange">{displayRows.length}</span>
                  <span className="kpi-hint">{loading ? "Updating..." : "Matching current filters"}</span>
                </div>
              </div>

              {/* Filter and Export Toolbar */}
              <div className="toolbar">
                <div className="toolbar-inputs">
                  <input
                    type="search"
                    placeholder="Search name, phone, email, institution, cohort…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search registrations"
                    className="search-input"
                  />
                  <select
                    value={cohortFilter}
                    onChange={(e) => setCohortFilter(e.target.value)}
                    aria-label="Filter by cohort"
                  >
                    <option value="">All Cohorts (1–6)</option>
                    {cohortsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.arrival_date ? c.arrival_date.split(",")[1]?.trim() : ""})
                      </option>
                    ))}
                  </select>
                  <select
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value)}
                    aria-label="Filter by attendance"
                  >
                    <option value="">All Attendance</option>
                    <option value="Registered">Registered (Pending)</option>
                    <option value="Attended">Attended (Checked In)</option>
                    <option value="Absent">Absent</option>
                    <option value="Excused">Excused</option>
                  </select>
                  <select
                    value={regionFilter}
                    onChange={(e) => {
                      setRegionFilter(e.target.value);
                      setDistrictFilter("");
                    }}
                    aria-label="Filter by region"
                  >
                    <option value="">All Regions ({regionNames.length})</option>
                    {regionNames.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <select
                    value={districtFilter}
                    onChange={(e) => setDistrictFilter(e.target.value)}
                    disabled={!regionFilter}
                    aria-label="Filter by district"
                  >
                    <option value="">{regionFilter ? "All Districts in Region" : "Select Region First"}</option>
                    {filterDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role">
                    <option value="">All Nominated Roles</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r.replace("DL Master Trainer - ", "")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="toolbar-exports">
                  <button className="btn-secondary" onClick={() => handleExport("csv")} disabled={exporting === "csv"}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {exporting === "csv" ? "Exporting…" : "CSV"}
                  </button>
                  <button className="btn-secondary" onClick={() => handleExport("xlsx")} disabled={exporting === "xlsx"}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    {exporting === "xlsx" ? "Exporting…" : "Excel (.xlsx)"}
                  </button>
                  <button className="btn-secondary" onClick={handlePrint} title="Print nominees list">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    Print
                  </button>
                  <button className="btn-secondary" onClick={handleExportSignedList} title="Download signed attendance list (Word)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    Signed List (Word)
                  </button>
                  <button className="btn-secondary" onClick={handleExportSignedListExcel} title="Download signed attendance list (Excel)">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Signed List (Excel)
                  </button>
                  <button className="btn-primary" onClick={handleOpenShare} title="Share nominees data">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                      <circle cx="18" cy="5" r="3"></circle>
                      <circle cx="6" cy="12" r="3"></circle>
                      <circle cx="18" cy="19" r="3"></circle>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                    </svg>
                    Share
                  </button>
                </div>
              </div>

              {/* Registrations Data Table */}
              <div className="table-wrap">
                <table>
                  <caption className="sr-only">List of submitted DL Master Trainer nominee registrations</caption>
                  <thead>
                    <tr>
                      <th scope="col">Ref Code</th>
                      <th scope="col">Officer Name</th>
                      <th scope="col">Sex</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Region & District</th>
                      <th scope="col">Institution</th>
                      <th scope="col">Nominated Role</th>
                      <th scope="col">Cohort & Arrival</th>
                      <th scope="col">Attendance</th>
                      <th scope="col">Submitted</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && rows.length === 0 && (
                      <tr>
                        <td colSpan={11} className="empty-row">
                          No registrations found matching the search and filter criteria.
                        </td>
                      </tr>
                    )}
                    {currentRows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <span className="ref-tag">{r.reference_code || `DL-${r.id}`}</span>
                        </td>
                        <td>
                          <strong>{r.officer_name}</strong>
                          {r.email && (
                            <div className="table-officer-email">
                              <a href={`mailto:${r.email}`} className="email-link" title={r.email}>
                                {r.email}
                              </a>
                            </div>
                          )}
                        </td>
                        <td>{r.sex}</td>
                        <td>
                          <a href={`tel:${r.phone_number}`} className="phone-link">
                            {r.phone_number}
                          </a>
                        </td>
                        <td>
                          <div className="table-location">
                            <span className="location-reg">{r.region}</span>
                            <span className="location-dist">{r.district}</span>
                          </div>
                        </td>
                        <td>{r.institution_name}</td>
                        <td>
                          <div className="table-roles">
                            {r.roles.map((role) => (
                              <span key={role} className="table-role-badge">
                                {role.replace("DL Master Trainer - ", "")}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="table-cohort-box">
                            <span className="cohort-badge-pill">
                              {r.cohort_name || (r.cohort_id ? `Cohort ${r.cohort_id}` : "Unassigned")}
                            </span>
                            <span className="cohort-date-sub">
                              {r.arrival_date || r.cohort_arrival_date ? `Arr: ${(r.arrival_date || r.cohort_arrival_date).split(",")[1]?.trim() || (r.arrival_date || r.cohort_arrival_date)}` : "No date"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className="table-attendance-box">
                            <span className={`attendance-status-pill status-${(r.attendance_status || "registered").toLowerCase()}`}>
                              {r.attendance_status === "Attended" ? "✓ Attended" : r.attendance_status || "Registered"}
                            </span>
                            <button
                              type="button"
                              className={`btn-checkin-toggle ${r.attendance_status === "Attended" ? "is-attended" : ""}`}
                              onClick={() => handleQuickCheckIn(r.id, r.attendance_status || "Registered", r.officer_name)}
                              title={r.attendance_status === "Attended" ? "Click to reset to Registered" : "Click to mark as Attended"}
                            >
                              {r.attendance_status === "Attended" ? "Undo" : "Check-in"}
                            </button>
                          </div>
                        </td>
                        <td>
                          <span className="table-date" title={r.submitted_at}>
                            {new Date(
                              r.submitted_at.includes("T") ? r.submitted_at : r.submitted_at.replace(" ", "T") + "Z"
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-link-edit" onClick={() => handleOpenEdit(r)}>
                              Edit
                            </button>
                            <button className="btn-link-danger" onClick={() => handleDelete(r.id, r.officer_name)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <PaginationControls currentPage={regPage} totalPages={regTotalPages} onPageChange={setRegPage} />
              </div>
            </>
          )}

          {/* VIEW 2: COHORT SCHEDULES & ATTENDANCE MANAGEMENT */}
          {activeTab === "cohorts" && (
            <div className="cohorts-management-view">
              <div className="cohorts-header-banner">
                <div>
                  <h2>Training Cohorts Schedule & Participant Allocation</h2>
                  <p className="cohorts-header-sub">
                    Official 6-cohort training cycle (Sept 20 – Oct 10, 2026) · Total Expected Capacity: <strong>783 Nominees</strong>
                  </p>
                </div>
                <div className="cohorts-header-stats">
                  <div className="c-stat-pill">
                    <span className="c-stat-label">Total Allocated:</span>
                    <span className="c-stat-val font-bold text-navy">
                      {cohortStatsData?.summary?.grandAllocated || 0} / 783
                    </span>
                    <span className="c-stat-sub">({cohortStatsData?.summary?.overallCapacityPercent || 0}% Filled)</span>
                  </div>
                  <div className="c-stat-pill">
                    <span className="c-stat-label">Total Attended:</span>
                    <span className="c-stat-val font-bold text-green" style={{ color: "#16a34a" }}>
                      {cohortStatsData?.summary?.grandAttended || 0}
                    </span>
                    <span className="c-stat-sub">({cohortStatsData?.summary?.overallAttendancePercent || 0}% Attended)</span>
                  </div>
                </div>
              </div>

              {cohortsLoading && (
                <div className="banner banner-info">Loading cohort data…</div>
              )}

              <div className="cohort-cards-grid">
                {(cohortStatsData?.cohorts || []).map((c) => (
                  <div key={c.id} className="cohort-card">
                    <div className="cohort-card-top">
                      <div className="cohort-card-title-group">
                        <span className="cohort-number-tag">COHORT {c.id}</span>
                        <h3 className="cohort-card-title">{c.name}</h3>
                      </div>
                      <div className="cohort-target-badge">
                        <span className="cohort-target-num">{c.expectedParticipants}</span>
                        <span className="cohort-target-label">Seats Quota</span>
                      </div>
                    </div>

                    <div className="cohort-card-body">
                      <div className="cohort-dates-timeline">
                        <div className="timeline-step">
                          <span className="step-icon">🛬</span>
                          <div className="step-body">
                            <span className="step-title">Arrival Date</span>
                            <span className="step-date highlight">{c.arrivalDate}</span>
                          </div>
                        </div>

                        <div className="timeline-step">
                          <span className="step-icon">📚</span>
                          <div className="step-body">
                            <span className="step-title">Workshop Training</span>
                            <span className="step-date">{c.startDate} – {c.endDate}</span>
                          </div>
                        </div>

                        <div className="timeline-step">
                          <span className="step-icon">🛫</span>
                          <div className="step-body">
                            <span className="step-title">Departure Date</span>
                            <span className="step-date">{c.departureDate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="cohort-card-metrics">
                        {/* Capacity Metric */}
                        <div className="cohort-metric-row">
                          <div className="metric-header">
                            <span className="metric-header-title">Registration Capacity</span>
                            <strong className="metric-header-val">{c.allocatedCount} / {c.expectedParticipants} ({c.capacityPercent}%)</strong>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${c.capacityPercent}%`,
                                backgroundColor: c.capacityPercent >= 100 ? "#ef4444" : "#1e3a8a",
                              }}
                            ></div>
                          </div>
                          <span className="metric-sub">
                            {c.remainingSlots > 0 ? `${c.remainingSlots} seats remaining` : "Full capacity reached"}
                          </span>
                        </div>

                        {/* Attendance Metric */}
                        <div className="cohort-metric-row">
                          <div className="metric-header">
                            <span className="metric-header-title">Attendance / Check-In</span>
                            <strong className="metric-header-val text-green" style={{ color: "#16a34a" }}>
                              {c.attendedCount} Attended ({c.attendancePercent}%)
                            </strong>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{
                                width: `${c.attendancePercent}%`,
                                backgroundColor: "#16a34a",
                              }}
                            ></div>
                          </div>
                          <span className="metric-sub">
                            {c.pendingCount} pending check-in · {c.absentCount} absent
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="cohort-card-footer" style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                      <button
                        type="button"
                        className="btn-secondary cohort-filter-btn"
                        onClick={() => {
                          setCohortFilter(String(c.id));
                          setActiveTab("registrations");
                        }}
                      >
                        View Registrations ({c.allocatedCount}) →
                      </button>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setViewingDistrictStatsId(c.id)}
                        style={{ fontSize: "0.9rem", color: "var(--navy-600)", padding: "0.5rem", border: "1px solid #e2e8f0", borderRadius: "8px", textDecoration: "none", backgroundColor: "#f8fafc" }}
                      >
                        View District Breakdown
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VIEW 3: NATIONAL MASTER TRAINERS MANAGEMENT */}
          {activeTab === "national-trainers" && (
            <div className="national-trainers-admin-view">
              <div className="trainers-mgmt-header">
                <div>
                  <h2>National Master Trainers (Facilitators)</h2>
                  <p>
                    Manage the official 11 National Facilitators who oversee DL workshops, track registered nominees, and administer assessments.
                  </p>
                </div>
                <div className="portal-page-actions">
                  <button className="btn-primary" onClick={handleOpenAddTrainer}>
                    + Add Master Trainer
                  </button>
                </div>
              </div>

              {/* KPI summary */}
              <div className="analytics-grid" style={{ marginBottom: "1.25rem" }}>
                <div className="kpi-card">
                  <span className="kpi-label">Active Facilitators</span>
                  <span className="kpi-val text-navy">{trainersList.length}</span>
                  <span className="kpi-hint">National Workshop Trainers</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Specialist Roles</span>
                  <div className="role-stat-list" style={{ marginTop: "0.25rem" }}>
                    <div className="role-stat-item">
                      <span className="badge-dot badge-orange"></span>
                      <span>Teachers: {trainersList.filter((t) => t.schedule_role === "Teacher").length}</span>
                    </div>
                    <div className="role-stat-item">
                      <span className="badge-dot badge-blue"></span>
                      <span>Coordinators & SISOs: {trainersList.filter((t) => t.schedule_role !== "Teacher").length}</span>
                    </div>
                  </div>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Default Access Password</span>
                  <span className="kpi-val text-orange" style={{ fontSize: "1.25rem" }}>trainer2026</span>
                  <span className="kpi-hint">Or facilitator 10-digit phone</span>
                </div>
              </div>

              {/* Filter Toolbar */}
              <div className="toolbar">
                <div className="toolbar-inputs">
                  <input
                    type="search"
                    placeholder="Search facilitator name, station, contact, email…"
                    value={trainerQuery}
                    onChange={(e) => setTrainerQuery(e.target.value)}
                    aria-label="Search master trainers"
                  />
                  <select
                    value={trainerRoleFilter}
                    onChange={(e) => setTrainerRoleFilter(e.target.value)}
                    aria-label="Filter by schedule role"
                  >
                    <option value="">All Schedule Roles</option>
                    <option value="Teacher">Teacher</option>
                    <option value="M&S">M&S (Monitoring & Supervision)</option>
                    <option value="STEM Coordinator">STEM Coordinator</option>
                    <option value="SISO">SISO</option>
                    <option value="Basic Schools Coordinator">Basic Schools Coordinator</option>
                    <option value="IT Coordinator">IT Coordinator</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>
              </div>

              {/* Master Trainers Table */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Facilitator Name</th>
                      <th scope="col">Place of Work / Station</th>
                      <th scope="col">Schedule Role</th>
                      <th scope="col">Contact Phone</th>
                      <th scope="col">Official Email</th>
                      <th scope="col">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trainersLoading && (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          Loading National Master Trainers…
                        </td>
                      </tr>
                    )}
                    {!trainersLoading && filteredTrainers.length === 0 && (
                      <tr>
                        <td colSpan={8} className="empty-row">
                          No trainers matching your search.
                        </td>
                      </tr>
                    )}
                    {filteredTrainers.map((t, idx) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{idx + 1}</strong>
                        </td>
                        <td>
                          <strong>{t.name}</strong>
                        </td>
                        <td>{t.place_of_work || "—"}</td>
                        <td>
                          <span className="table-role-badge">
                            {t.schedule_role}
                          </span>
                        </td>
                        <td>
                          <a href={`tel:${t.contact_number}`} className="phone-link font-bold">
                            {t.contact_number}
                          </a>
                        </td>
                        <td>
                          {t.email ? (
                            <a href={`mailto:${t.email}`} className="email-link">
                              {t.email}
                            </a>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <span className={`admin-status-pill status-${(t.status || "active").toLowerCase()}`}>
                            {t.status || "Active"}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-link-action edit" onClick={() => handleOpenEditTrainer(t)}>
                              Edit
                            </button>
                            <button className="btn-link-action reset" onClick={() => handleResetTrainerPass(t)} title="Reset Password">
                              Reset Pwd
                            </button>
                            <button className="btn-link-action delete" onClick={() => handleDeleteTrainer(t)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 4: ASSESSMENTS & QUESTIONS BUILDER MANAGEMENT */}
          {activeTab === "assessments" && (
            <div className="assessments-admin-view">
              <div className="trainers-mgmt-header">
                <div>
                  <h2>Assessments & Questions Builder Hub</h2>
                  <p>
                    Create and customize Pre-Test and Post-Test questions, set answer rubrics, and inspect participant submissions and performance.
                  </p>
                </div>
                <div className="portal-page-actions" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button type="button" className="btn-secondary" onClick={handleOpenBulkPreTest} style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a", fontWeight: 600 }}>
                    📥 Bulk Upload Pre-Test
                  </button>
                  <button type="button" className="btn-secondary" onClick={handleOpenBulkPostTest} style={{ background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0", fontWeight: 600 }}>
                    📥 Bulk Upload Post-Test
                  </button>
                  <button className="btn-primary" onClick={handleOpenCreateAssessment}>
                    + Create Assessment
                  </button>
                  <Link to="/assessments" className="btn-secondary" target="_blank" rel="noreferrer">
                    Public Portal ↗
                  </Link>
                </div>
              </div>

              <div className="toolbar" style={{ marginBottom: "1.5rem", padding: "1rem", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div className="toolbar-inputs" style={{ display: "flex", gap: "1rem" }}>
                  <select
                    value={cohortFilter}
                    onChange={(e) => setCohortFilter(e.target.value)}
                    aria-label="Filter by cohort"
                    style={{ flex: 1 }}
                  >
                    <option value="">All Cohorts (1–6)</option>
                    {cohortsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.arrival_date ? c.arrival_date.split(",")[1]?.trim() : ""})
                      </option>
                    ))}
                  </select>
                  <select
                    value={defaultersType}
                    onChange={(e) => setDefaultersType(e.target.value)}
                    aria-label="Filter missing tests by type"
                    style={{ flex: 1 }}
                  >
                    <option value="">Missing Any Test (Pre or Post)</option>
                    <option value="Pre-Test">Missing Pre-Test</option>
                    <option value="Post-Test">Missing Post-Test</option>
                  </select>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="analytics-grid" style={{ marginBottom: "1.5rem" }}>
                <div 
                  className="kpi-card" 
                  onClick={handleViewAllSubmissions} 
                  style={{ cursor: "pointer", transition: "transform 0.15s ease", border: "1px solid #e2e8f0" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)"; }}
                  title="Click to view all test submissions"
                >
                  <span className="kpi-label">Total Submissions</span>
                  <span className="kpi-val text-navy">{assessmentStats?.totalSubmissions || 0}</span>
                  <span className="kpi-hint">Completed participant tests</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Pre-Test Average</span>
                  <span className="kpi-val text-orange">{assessmentStats?.preTest?.avgScore || 0}%</span>
                  <span className="kpi-hint">Baseline diagnostic mastery</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Post-Test Average</span>
                  <span className="kpi-val text-navy" style={{ color: "#16a34a" }}>
                    {assessmentStats?.postTest?.avgScore || 0}%
                  </span>
                  <span className="kpi-hint">Post-training mastery</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">Average Learning Gain</span>
                  <span className="kpi-val text-navy">
                    +{assessmentStats?.learningGain || 0}%
                  </span>
                  <span className="kpi-hint">Knowledge gain improvement</span>
                </div>
                <div 
                  className="kpi-card"
                  onClick={() => setShowDefaultersModal(true)}
                  style={{ cursor: "pointer", transition: "transform 0.15s ease", border: "1px solid #fee2e2" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 10px 15px -3px rgba(0, 0, 0, 0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)"; }}
                  title="Click to view nominees who have not taken a test"
                >
                  <span className="kpi-label" style={{ color: "#b91c1c" }}>Pending Tests</span>
                  <span className="kpi-val" style={{ color: "#ef4444" }}>
                    {defaultersData.length}
                  </span>
                  <span className="kpi-hint">
                    {defaultersType ? `Attendees missing ${defaultersType} submission` : "Attendees missing test submission"}
                  </span>
                </div>
              </div>

              {/* Assessments List Table */}
              <div className="table-wrap">
                <table className="assessments-admin-table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: "25%" }}>Assessment Title</th>
                      <th scope="col" style={{ width: "10%" }}>Type</th>
                      <th scope="col" style={{ width: "24%" }}>Schedule & Access Lock</th>
                      <th scope="col" style={{ width: "8%" }}>Time</th>
                      <th scope="col" style={{ width: "9%" }}>Questions</th>
                      <th scope="col" style={{ width: "9%" }}>Submissions</th>
                      <th scope="col" style={{ width: "8%" }}>Avg Score</th>
                      <th scope="col" style={{ width: "7%" }}>Status</th>
                      <th scope="col" style={{ width: "14%", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessmentsLoading && (
                      <tr>
                        <td colSpan={9} className="empty-row">
                          Loading assessments…
                        </td>
                      </tr>
                    )}
                    {!assessmentsLoading && assessmentsList.length === 0 && (
                      <tr>
                        <td colSpan={9} className="empty-row">
                          No assessments configured yet. Click "+ Create New Assessment" to start.
                        </td>
                      </tr>
                    )}
                    {assessmentsList.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <div className="assessment-cell-title">
                            <span className="assessment-main-name">{a.title}</span>
                            {a.description && (
                              <span className="assessment-short-desc" title={a.description}>
                                {a.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`assessment-type-pill type-${a.type.toLowerCase().replace(/\s+/g, "-")}`}>
                            {a.type}
                          </span>
                        </td>
                        <td>
                          <div className="schedule-lock-cell">
                            {a.lock_mode === "open_now" && (
                              <span className="schedule-lock-badge badge-open">
                                🔓 Open Now (Unlocked)
                              </span>
                            )}
                            {a.lock_mode === "force_locked" && (
                              <span className="schedule-lock-badge badge-locked">
                                🔒 Force Locked
                              </span>
                            )}
                            {(!a.lock_mode || a.lock_mode === "scheduled") && (
                              <span className="schedule-lock-badge badge-scheduled">
                                🔒 Arrival Date @ {a.unlock_time || "19:00"} (7:00 PM)
                              </span>
                            )}
                            {a.lockInfo?.statusText && (
                              <span className="schedule-lock-subtitle">
                                {a.lockInfo.statusText}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <strong>{a.time_limit_minutes}</strong> mins
                        </td>
                        <td>
                          <strong>{a.question_count || 0}</strong> Qs
                        </td>
                        <td>
                          <strong>{a.submission_count || 0}</strong> done
                        </td>
                        <td>
                          {a.average_score ? (
                            <strong style={{ color: "#0f172a" }}>{Math.round(a.average_score)}%</strong>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={`btn-toggle-active ${a.is_active ? "active" : "inactive"}`}
                            onClick={() => handleToggleAssessment(a)}
                            title="Click to toggle availability"
                          >
                            {a.is_active ? "● Active" : "○ Inactive"}
                          </button>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="action-buttons" style={{ justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              className="btn-link-action edit"
                              onClick={() => handleOpenEditAssessment(a)}
                              title="Edit questions, date/time schedule & access"
                            >
                              Edit / Schedule
                            </button>
                            <button
                              type="button"
                              className="btn-link-action"
                              style={{ color: "#d97706", fontWeight: 600 }}
                              onClick={() => handleOpenBulkUpload(a)}
                              title="Bulk import questions from Excel or CSV"
                            >
                              Bulk Upload
                            </button>
                            <button
                              type="button"
                              className="btn-link-action reset"
                              onClick={() => handleViewSubmissions(a.id)}
                              title="View participant results & scores"
                            >
                              Results
                            </button>
                            <button
                              type="button"
                              className="btn-link-action"
                              style={{ color: "#0ea5e9", fontWeight: 600, textDecoration: "none" }}
                              title="Download PowerPoint presentation report"
                              onClick={() => {
                                if (!cohortFilter) {
                                  alert("Please select a specific Cohort from the global filter dropdown at the top of the page to generate a precise 20-question PPTX report for that cohort.");
                                  return;
                                }
                                window.location.href = getAssessmentPptxReportUrl(a.id, cohortFilter);
                              }}
                            >
                              PPTX Report
                            </button>
                            <Link to={`/assessment/${a.id}?bypass=true`} className="btn-link-action" target="_blank" rel="noreferrer" title="Preview candidate test">
                              Preview ↗
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW X: REPORTS & ANALYTICS */}
          {activeTab === "reports" && (
            <div className="reports-section">
              <div className="dashboard-header">
                <div>
                  <h2 className="dashboard-title">Performance Analytics</h2>
                  <p className="dashboard-subtitle">Visualize test performance and learning gains.</p>
                </div>
                <button className="btn-secondary" onClick={loadAssessmentsData}>
                  ↻ Refresh Data
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                
                {/* Metrics Group */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <div className="admin-card" style={{ padding: "1.25rem", borderLeft: "4px solid #3b82f6" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "0.25rem" }}>TOTAL ASSESSMENTS TAKEN</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f172a" }}>{assessmentStats.totalSubmissions || 0}</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Across filtered regions/cohorts</div>
                  </div>
                  <div className="admin-card" style={{ padding: "1.25rem", borderLeft: "4px solid #f59e0b" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "0.25rem" }}>PRE-TEST AVERAGE</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#F39200" }}>{assessmentStats.preTest?.avgScore || 0}%</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Baseline diagnostics</div>
                  </div>
                  <div className="admin-card" style={{ padding: "1.25rem", borderLeft: "4px solid #10b981" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "0.25rem" }}>POST-TEST AVERAGE</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#00B050" }}>{assessmentStats.postTest?.avgScore || 0}%</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Post-training mastery</div>
                  </div>
                  <div className="admin-card" style={{ padding: "1.25rem", borderLeft: "4px solid #0f172a" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginBottom: "0.25rem" }}>OVERALL LEARNING GAIN</div>
                    <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#0f172a" }}>+{assessmentStats.learningGain || 0}%</div>
                    <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Knowledge improvement</div>
                  </div>
                </div>

                {/* Pie Charts Group */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
                  
                  {/* Gender Pie Chart */}
                  <div className="admin-card" style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#475569", marginBottom: "1rem", textTransform: "uppercase" }}>Gender Breakdown</div>
                    <div style={{
                      width: "100px", height: "100px", borderRadius: "50%",
                      background: totalCount > 0 
                        ? `conic-gradient(#3b82f6 0% ${(maleCount/totalCount)*100}%, #f472b6 ${(maleCount/totalCount)*100}% 100%)`
                        : "#e2e8f0",
                      marginBottom: "1rem",
                      boxShadow: "inset 0 0 0 10px rgba(255,255,255,0.2)"
                    }}></div>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><span style={{ width: "10px", height: "10px", backgroundColor: "#3b82f6", borderRadius: "2px" }}></span> Male ({totalCount > 0 ? Math.round((maleCount/totalCount)*100) : 0}%)</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><span style={{ width: "10px", height: "10px", backgroundColor: "#f472b6", borderRadius: "2px" }}></span> Female ({totalCount > 0 ? Math.round((femaleCount/totalCount)*100) : 0}%)</div>
                    </div>
                  </div>

                  {/* Attendance Pie Chart */}
                  <div className="admin-card" style={{ padding: "1.25rem", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "700", color: "#475569", marginBottom: "1rem", textTransform: "uppercase" }}>Overall Attendance</div>
                    <div style={{
                      width: "100px", height: "100px", borderRadius: "50%",
                      background: totalCount > 0
                        ? `conic-gradient(#10b981 0% ${(attendedCount/totalCount)*100}%, #fde047 ${(attendedCount/totalCount)*100}% 100%)`
                        : "#e2e8f0",
                      marginBottom: "1rem",
                      boxShadow: "inset 0 0 0 10px rgba(255,255,255,0.2)"
                    }}></div>
                    <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#64748b", fontWeight: "600" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><span style={{ width: "10px", height: "10px", backgroundColor: "#10b981", borderRadius: "2px" }}></span> Attended ({totalCount > 0 ? Math.round((attendedCount/totalCount)*100) : 0}%)</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><span style={{ width: "10px", height: "10px", backgroundColor: "#fde047", borderRadius: "2px" }}></span> Pending ({totalCount > 0 ? Math.round((pendingCount/totalCount)*100) : 0}%)</div>
                    </div>
                  </div>
                  
                </div>

              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "2rem", marginTop: "2rem" }}>
                {/* Chart 1: Pre-Test vs Post-Test Comparison */}
                <div className="admin-card" style={{ padding: "2rem" }}>
                  <h3 style={{ marginBottom: "2rem", fontSize: "1.1rem", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>Pre-Test vs Post-Test Performance</h3>
                  
                  <div style={{ display: "flex", alignItems: "flex-end", height: "250px", gap: "3rem", paddingBottom: "1rem", borderBottom: "2px solid #cbd5e1", marginTop: "2rem" }}>
                    
                    {/* Pre-Test Bar */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem", color: "#F39200" }}>
                        {assessmentStats.preTest?.avgScore || 0}%
                      </div>
                      <div style={{ 
                        width: "100%", 
                        maxWidth: "120px", 
                        height: `${Math.max(2, assessmentStats.preTest?.avgScore || 0)}%`, 
                        backgroundColor: "#F39200", 
                        borderRadius: "8px 8px 0 0",
                        transition: "height 1s ease" 
                      }}></div>
                      <div style={{ marginTop: "1rem", fontWeight: 600, color: "#475569", textAlign: "center" }}>Pre-Test Avg</div>
                    </div>

                    {/* Post-Test Bar */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem", color: "#00B050" }}>
                        {assessmentStats.postTest?.avgScore || 0}%
                      </div>
                      <div style={{ 
                        width: "100%", 
                        maxWidth: "120px", 
                        height: `${Math.max(2, assessmentStats.postTest?.avgScore || 0)}%`, 
                        backgroundColor: "#00B050", 
                        borderRadius: "8px 8px 0 0",
                        transition: "height 1s ease" 
                      }}></div>
                      <div style={{ marginTop: "1rem", fontWeight: 600, color: "#475569", textAlign: "center" }}>Post-Test Avg</div>
                    </div>

                  </div>
                </div>

                {/* Chart 2: Submissions by Assessment */}
                <div className="admin-card" style={{ padding: "2rem" }}>
                  <h3 style={{ marginBottom: "2rem", fontSize: "1.1rem", color: "#1e293b", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>Submissions per Assessment</h3>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", maxHeight: "300px", overflowY: "auto", paddingRight: "0.5rem" }}>
                    {assessmentsList.filter(a => a.submission_count > 0).length === 0 && (
                      <p style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", marginTop: "2rem" }}>No submissions recorded yet.</p>
                    )}
                    {assessmentsList.filter(a => a.submission_count > 0).map(a => {
                      const maxSubs = Math.max(...assessmentsList.map(x => x.submission_count));
                      const pct = maxSubs > 0 ? (a.submission_count / maxSubs) * 100 : 0;
                      return (
                        <div key={a.id} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>
                            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80%" }}>{a.title}</span>
                            <span>{a.submission_count} ({Math.round(a.average_score || 0)}% avg)</span>
                          </div>
                          <div style={{ width: "100%", height: "12px", backgroundColor: "#f1f5f9", borderRadius: "6px", overflow: "hidden" }}>
                            <div style={{ 
                              height: "100%", 
                              width: `${pct}%`, 
                              backgroundColor: a.type === "Pre-Test" ? "#F39200" : (a.type === "Post-Test" ? "#00B050" : "#3b82f6"),
                              borderRadius: "6px"
                            }}></div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* DETAILED DIAGNOSTICS SECTION */}
              <div className="admin-card" style={{ padding: "2rem", marginTop: "2rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1.2rem", color: "#1e293b", margin: 0 }}>Deep-Dive Diagnostic Reports</h3>
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <select 
                      value={selectedDiagnosticAssessment}
                      onChange={(e) => setSelectedDiagnosticAssessment(e.target.value)}
                      style={{ padding: "0.5rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="">-- Select an Assessment to Analyze --</option>
                      {assessmentsList.map(a => (
                        <option key={a.id} value={a.id}>{a.title} ({a.type})</option>
                      ))}
                    </select>
                    {selectedDiagnosticAssessment && (
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <ExportActionButtons onAction={(act) => handleHtmlPdfAction(act, "diagnostic-report-container", "Diagnostic_Report.pdf")} />
                        <button 
                          className="btn-secondary"
                          onClick={() => window.open(`/api/assessments/${selectedDiagnosticAssessment}/export/xlsx?cohort_id=${cohortFilter || ""}`, '_blank')}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: "4px" }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                          Export Excel
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {diagnosticLoading ? (
                  <p style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Loading diagnostics...</p>
                ) : !selectedDiagnosticAssessment ? (
                  <p style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>Select an assessment above to view detailed participation, mastery, and regional analytics.</p>
                ) : diagnosticData && !diagnosticData.error ? (
                  <div id="diagnostic-report-container" style={{ display: "flex", flexDirection: "column", gap: "2rem", padding: "1rem", backgroundColor: "#fff" }}>
                    
                    {/* 1. Participation / Coverage */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "1.5rem", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                      <h4 style={{ fontSize: "1.1rem", color: "#334155", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>👥</span> Participation & Coverage
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
                        <div style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Total Respondents</div>
                          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>{diagnosticData.participation.totalRespondents}</div>
                        </div>
                        <div style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Gender Breakdown</div>
                          <div style={{ fontSize: "1rem", fontWeight: 600, color: "#1e293b", marginTop: "0.2rem" }}>
                            Male: {diagnosticData.participation.male} ({diagnosticData.participation.malePct}%)<br/>
                            Female: {diagnosticData.participation.female} ({diagnosticData.participation.femalePct}%)
                          </div>
                        </div>
                        <div style={{ backgroundColor: "#fff", padding: "1rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          <div style={{ fontSize: "0.85rem", color: "#64748b", textTransform: "uppercase", fontWeight: 600 }}>Regions Covered</div>
                          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>{diagnosticData.participation.regionsCovered}</div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Aggregate / Diagnostic */}
                    <div style={{ backgroundColor: "#fff0f2", padding: "1.5rem", borderRadius: "12px", border: "1px solid #fecdd3" }}>
                      <h4 style={{ fontSize: "1.1rem", color: "#9f1239", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>⚠️</span> Critical Areas for Review
                      </h4>
                      <p style={{ fontSize: "0.9rem", color: "#be123c", marginBottom: "1rem" }}>
                        Less than 50% of respondents answered these questions correctly. Facilitators must follow up on these concepts:
                      </p>
                      {diagnosticData.aggregate.criticalAreas.length === 0 ? (
                        <div style={{ padding: "1rem", backgroundColor: "#fff", borderRadius: "8px", color: "#16a34a", fontWeight: 600 }}>
                          ✓ No critical areas identified. Majority understood all key concepts!
                        </div>
                      ) : (
                        <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          {diagnosticData.aggregate.criticalAreas.map((area, i) => (
                            <li key={i} style={{ padding: "0.75rem 1rem", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #fecdd3", color: "#881337", fontWeight: 500, fontSize: "0.95rem" }}>
                              {area}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* 2 & 3. Question-Level & Regional */}
                    <div>
                      <h4 style={{ fontSize: "1.1rem", color: "#334155", marginBottom: "1rem", borderBottom: "2px solid #e2e8f0", paddingBottom: "0.5rem" }}>
                        Question-by-Question Mastery & Regional Breakdown
                      </h4>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {diagnosticData.questionLevel.map(q => (
                          <div key={q.questionId} style={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
                            <div style={{ padding: "1rem 1.5rem", backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                              <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" }}>Q{q.questionNumber}. {q.text}</div>
                              <div style={{ fontSize: "0.9rem", color: q.takeawayText === "Majority" ? "#16a34a" : "#ef4444", fontWeight: 500 }}>
                                Key Takeaway: {q.takeawayText} ({q.majorityPct}%) selected the most common option.
                              </div>
                            </div>
                            <div style={{ padding: "0", overflowX: "auto" }}>
                              <table className="admin-table" style={{ margin: 0, border: "none" }}>
                                <thead>
                                  <tr>
                                    <th style={{ backgroundColor: "#fff" }}>Option</th>
                                    <th style={{ backgroundColor: "#fff", textAlign: "center" }}>Overall %</th>
                                    {diagnosticData.participation.regions.map(r => (
                                      <th key={r} style={{ backgroundColor: "#fff", textAlign: "center" }}>{r}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {q.optionsBreakdown.map((opt, i) => (
                                    <tr key={i} style={{ backgroundColor: opt.isCorrect ? "#f0fdf4" : "transparent" }}>
                                      <td style={{ fontWeight: opt.isCorrect ? 600 : 400, color: opt.isCorrect ? "#16a34a" : "inherit" }}>
                                        {opt.isCorrect && "✓ "}{opt.option}
                                      </td>
                                      <td style={{ textAlign: "center", fontWeight: 600 }}>{opt.percentage}%</td>
                                      {diagnosticData.participation.regions.map(r => (
                                        <td key={r} style={{ textAlign: "center", color: "#64748b" }}>{opt.regionBreakdown[r]}%</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ) : (
                  <p style={{ color: "#ef4444", textAlign: "center", padding: "2rem" }}>Failed to load diagnostics.</p>
                )}
              </div>

            </div>
          )}

          {/* VIEW: TABLET DISTRIBUTION */}
          {activeTab === "distribution" && (
              <div className="tablet-distribution-section" style={{ padding: "2rem", background: "#fff", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
                {cameraScanData && (
                  <CameraScanner 
                    title={`Scan ${cameraScanData.field === 'imei' ? 'IMEI' : 'Serial No'} Barcode`}
                    expectedPattern={cameraScanData.field === 'imei' ? /^\d{15}$/ : /^[A-Z0-9]{11}$/i}
                    onClose={() => setCameraScanData(null)}
                    onScanSuccess={async (decodedText) => {
                      const success = await handleAssignDeviceData(cameraScanData.id, cameraScanData.field, decodedText);
                      if (success) {
                        setCameraScanData(null);
                      }
                      return success;
                    }}
                  />
                )}
                <div className="trainers-mgmt-header" style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <h2 style={{ fontSize: "1.5rem", color: "#1e293b", margin: "0 0 0.5rem 0" }}>Tablet Distribution (IT Persons)</h2>
                    <p style={{ color: "#64748b", margin: 0 }}>Assign and track mobile tablets distributed to IT personnel by scanning their IMEI.</p>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {cohortFilter && (
                      <button 
                        className="btn-primary" 
                        onClick={async () => {
                          if (!confirm("Generate placeholder tracking rows for all expected districts in this cohort that haven't registered an IT Person yet?")) return;
                          try {
                            const res = await fetch("/api/registrations/stub/generate-all", {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "x-admin-password": password },
                              body: JSON.stringify({ cohortId: cohortFilter })
                            });
                            const data = await res.json();
                            if (res.ok) {
                              alert(`Generated ${data.generatedCount} missing IT person trackers.`);
                              loadRegistrations(false);
                            } else {
                              alert("Error: " + data.error);
                            }
                          } catch (err) {
                            alert("Failed to generate trackers: " + err.message);
                          }
                        }}
                        title="Creates tracking rows for expected IT persons before they register"
                      >
                        ➕ Generate Trackers
                      </button>
                    )}
                    <button className="btn-secondary" onClick={() => handleExportDistributionWord(itPersonsList)} title="Download Distribution List (Word)">
                      📄 Export Word
                    </button>
                    <button className="btn-secondary" onClick={() => handleExportDistributionExcel(itPersonsList)} title="Download Distribution List (Excel)">
                      📊 Export Excel
                    </button>
                  </div>
                </div>
                
                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Officer Name</th>
                        <th>Nominated Role</th>
                        <th>District</th>
                        <th>Phone Number</th>
                        <th>Assigned IMEI</th>
                        <th>Serial No</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itPersonsList.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="empty-row" style={{ textAlign: "center", padding: "2rem" }}>No IT persons found for current filters.</td>
                        </tr>
                      ) : (
                        itPersonsList.map((r, idx) => (
                          <tr key={r.id}>
                            <td>{idx + 1}</td>
                            <td><strong>{r.officer_name}</strong></td>
                            <td><span style={{fontSize: "0.85rem", color: "#475569"}}>{(r.roles || []).filter(role => role.toLowerCase().includes("it person")).join(", ")}</span></td>
                            <td>{r.district}</td>
                            <td>{r.phone_number}</td>
                          <td>
                            {scanImeiFor === r.id ? (
                              <form onSubmit={async (e) => {
                                e.preventDefault();
                                const success = await handleAssignDeviceData(r.id, 'imei', scannedImei);
                                if (success) {
                                  setScanImeiFor(null);
                                  setScannedImei("");
                                }
                              }}>
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Scan IMEI..."
                                  value={scannedImei}
                                  onChange={e => setScannedImei(e.target.value)}
                                  onBlur={(e) => {
                                    if(e.relatedTarget && e.relatedTarget.tagName === 'BUTTON') return;
                                    setScanImeiFor(null);
                                    setScannedImei("");
                                  }}
                                  style={{ padding: "0.5rem", width: "160px", border: "2px solid #3b82f6", borderRadius: "6px", outline: "none", fontSize: "1rem" }}
                                />
                              </form>
                            ) : (
                              <span 
                                onClick={() => {
                                  setScanImeiFor(r.id);
                                  setScannedImei(r.tablet_imei || "");
                                }}
                                style={{ 
                                  fontFamily: "monospace", 
                                  fontSize: "1rem", 
                                  color: r.tablet_imei ? "#16a34a" : "#94a3b8", 
                                  fontWeight: r.tablet_imei ? 600 : 400,
                                  cursor: "pointer",
                                  borderBottom: r.tablet_imei ? "1px dashed #16a34a" : "1px dashed #94a3b8"
                                }}
                                title="Click to edit"
                              >
                                {r.tablet_imei || "Not Assigned"}
                              </span>
                            )}
                          </td>
                          <td>
                            {scanSerialFor === r.id ? (
                              <form onSubmit={async (e) => {
                                e.preventDefault();
                                const success = await handleAssignDeviceData(r.id, 'serial', scannedSerial);
                                if (success) {
                                  setScanSerialFor(null);
                                  setScannedSerial("");
                                }
                              }}>
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Scan Serial No..."
                                  value={scannedSerial}
                                  onChange={e => setScannedSerial(e.target.value)}
                                  onBlur={(e) => {
                                    if(e.relatedTarget && e.relatedTarget.tagName === 'BUTTON') return;
                                    setScanSerialFor(null);
                                    setScannedSerial("");
                                  }}
                                  style={{ padding: "0.5rem", width: "160px", border: "2px solid #3b82f6", borderRadius: "6px", outline: "none", fontSize: "1rem" }}
                                />
                              </form>
                            ) : (
                              <span 
                                onClick={() => {
                                  setScanSerialFor(r.id);
                                  setScannedSerial(r.tablet_serial || "");
                                }}
                                style={{ 
                                  fontFamily: "monospace", 
                                  fontSize: "1rem", 
                                  color: r.tablet_serial ? "#16a34a" : "#94a3b8", 
                                  fontWeight: r.tablet_serial ? 600 : 400,
                                  cursor: "pointer",
                                  borderBottom: r.tablet_serial ? "1px dashed #16a34a" : "1px dashed #94a3b8"
                                }}
                                title="Click to edit"
                              >
                                {r.tablet_serial || "Not Assigned"}
                              </span>
                            )}
                          </td>
                          <td style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", maxWidth: "250px" }}>
                            {scanImeiFor !== r.id && scanSerialFor !== r.id && (
                              <>
                                <button 
                                  className="btn-primary"
                                  onClick={() => setCameraScanData({ id: r.id, field: 'imei' })}
                                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}
                                  title="Scan IMEI"
                                >
                                  📷 IMEI
                                </button>
                                <button 
                                  className="btn-primary"
                                  onClick={() => setCameraScanData({ id: r.id, field: 'serial' })}
                                  style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem", background: "#4f46e5", borderColor: "#4f46e5" }}
                                  title="Scan Serial No."
                                >
                                  📷 S/N
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW 5: ADMIN MANAGEMENT (SUPER ADMIN) */}
          {activeTab === "admins" && (
            <div className="admin-management-section">
              <div className="admin-mgmt-header">
                <div>
                  <h2>System Administrators</h2>
                  <p className="admin-mgmt-sub">Manage platform access, roles, and administrative permissions.</p>
                </div>
                <button className="btn-primary" onClick={handleOpenAddAdmin}>
                  + Add New Administrator
                </button>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Administrator Name</th>
                      <th scope="col">Email Address</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                      <th scope="col">Created Date</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLoading && (
                      <tr>
                        <td colSpan={7} className="empty-row">
                          Loading administrators…
                        </td>
                      </tr>
                    )}
                    {!adminLoading && adminList.length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty-row">
                          No additional administrators created yet.
                        </td>
                      </tr>
                    )}
                    {adminList.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.name}</strong>
                        </td>
                        <td>{a.email}</td>
                        <td>{a.phone_number || "—"}</td>
                        <td>
                          <span className={`admin-role-badge role-${a.role.toLowerCase().replace(/\s+/g, "-")}`}>
                            {a.role}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-status-pill status-${a.status.toLowerCase()}`}>
                            {a.status}
                          </span>
                        </td>
                        <td>
                          <span className="table-date">
                            {new Date(
                              a.created_at.includes("T") ? a.created_at : a.created_at.replace(" ", "T") + "Z"
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </td>
                        <td>
                          <div className="action-buttons">
                            <button className="btn-link-edit" onClick={() => handleOpenEditAdmin(a)}>
                              Edit
                            </button>
                            <button className="btn-link-danger" onClick={() => handleDeleteAdmin(a)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* QUESTION & ASSESSMENT BUILDER MODAL */}
      {isBuilderOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="builder-title">
          <div className="modal-content" style={{ maxWidth: "860px" }}>
            <div className="modal-header">
              <h2 id="builder-title">
                {editingAssessment ? `Edit Questions: ${editingAssessment.title}` : "Create New Assessment"}
              </h2>
              <button className="modal-close-btn" onClick={() => setIsBuilderOpen(false)} aria-label="Close builder modal">
                &times;
              </button>
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
                    <option value="Pre-Test">Pre-Test (Diagnostic Assessment)</option>
                    <option value="Post-Test">Post-Test (Summative Assessment)</option>
                    <option value="Quiz">Module Quiz</option>
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="b-desc">Description / Instructions</label>
                  <input
                    id="b-desc"
                    type="text"
                    placeholder="Instructions for participants..."
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
                    max="180"
                    value={builderForm.timeLimitMinutes}
                    onChange={(e) => setBuilderForm({ ...builderForm, timeLimitMinutes: e.target.value })}
                  />
                </div>
              </div>

              {/* DATE & TIME SCHEDULE CONTROLS */}
              <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "1.1rem", marginTop: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "1.1rem" }}>⏰</span>
                  <strong style={{ color: "var(--navy-900)", fontSize: "0.98rem" }}>
                    Candidate Access & Date/Time Lock Settings
                  </strong>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="b-lock-mode">Lock & Access Mode</label>
                    <select
                      id="b-lock-mode"
                      value={builderForm.lockMode}
                      onChange={(e) => setBuilderForm({ ...builderForm, lockMode: e.target.value })}
                    >
                      <option value="scheduled">Scheduled Lock (Unlock at Arrival Date & 7:00 PM)</option>
                      <option value="open_now">Force Unlocked (Open immediately for everyone)</option>
                      <option value="force_locked">Force Locked (Inaccessible to all candidates)</option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="b-unlock-date-type">Unlock Date Rule</label>
                    <select
                      id="b-unlock-date-type"
                      value={builderForm.unlockDateType}
                      onChange={(e) => setBuilderForm({ ...builderForm, unlockDateType: e.target.value })}
                    >
                      <option value="arrival_date">Cohort Arrival Date (e.g. Sunday, 20/09/2026)</option>
                      <option value="start_date">Cohort Workshop Start Date (e.g. Monday, 21/09/2026)</option>
                      <option value="custom">Custom Date & Time</option>
                    </select>
                  </div>
                </div>

                <div className="field-row">
                  <div className="field">
                    <label htmlFor="b-unlock-time">
                      Default Unlock Time (24h Format)
                    </label>
                    <input
                      id="b-unlock-time"
                      type="text"
                      placeholder="19:00 (7:00 PM)"
                      value={builderForm.unlockTime}
                      onChange={(e) => setBuilderForm({ ...builderForm, unlockTime: e.target.value })}
                    />
                    <span className="field-hint" style={{ fontSize: "0.75rem", color: "#64748b" }}>
                      Set to 19:00 for 7:00 PM evening unlock
                    </span>
                  </div>

                  {builderForm.unlockDateType === "custom" && (
                    <div className="field">
                      <label htmlFor="b-custom-unlock">Custom Unlock Date & Time</label>
                      <input
                        id="b-custom-unlock"
                        type="datetime-local"
                        value={builderForm.customUnlockDatetime}
                        onChange={(e) => setBuilderForm({ ...builderForm, customUnlockDatetime: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Questions Section */}
              <div className="builder-questions-section" style={{ marginTop: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
                  <h3 style={{ margin: 0, fontSize: "1.15rem", color: "var(--navy-900)" }}>
                    Assessment Questions ({builderForm.questions.length})
                  </h3>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      type="file"
                      id="builder-file-input"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleBuilderFileUpload}
                      style={{ display: "none" }}
                    />
                    <label
                      htmlFor="builder-file-input"
                      className="btn-secondary"
                      style={{ fontSize: "0.82rem", padding: "0.35rem 0.75rem", cursor: "pointer", background: "#f8fafc", borderColor: "#cbd5e1" }}
                      title="Upload Excel or CSV file containing questions"
                    >
                      📤 Bulk Import (.xlsx / .csv)
                    </label>
                    <a
                      href={downloadAssessmentTemplateUrl(builderForm.type === "Post-Test" ? "post-test" : "pre-test")}
                      className="btn-secondary"
                      style={{ fontSize: "0.82rem", padding: "0.35rem 0.75rem", textDecoration: "none", background: "#fffbeb", borderColor: "#fde68a", color: "#92400e" }}
                      title="Download sample question template"
                    >
                      📥 Sample Template
                    </a>
                    <button type="button" className="btn-primary" onClick={handleAddQuestion} style={{ fontSize: "0.82rem", padding: "0.35rem 0.75rem" }}>
                      + Add Question
                    </button>
                  </div>
                </div>

                {builderForm.questions.map((q, qIdx) => (
                  <div key={qIdx} className="builder-q-card">
                    <div className="builder-q-header">
                      <strong style={{ color: "var(--navy-900)", fontSize: "0.95rem" }}>Question #{qIdx + 1}</strong>
                      {builderForm.questions.length > 1 && (
                        <button
                          type="button"
                          className="btn-link-danger"
                          onClick={() => handleRemoveQuestion(qIdx)}
                        >
                          Remove Question
                        </button>
                      )}
                    </div>

                    <div className="field">
                      <label>Question Prompt / Text *</label>
                      <input
                        type="text"
                        placeholder="Enter the question prompt here..."
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
                          max="20"
                          value={q.points || 1}
                          onChange={(e) => handleUpdateQuestion(qIdx, "points", Number(e.target.value))}
                        />
                      </div>
                    </div>

                    {/* Options list */}
                    <div className="field" style={{ marginTop: "0.5rem" }}>
                      <label style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>Answer Choices</span>
                        <span className="field-hint" style={{ fontWeight: "normal" }}>Select the radio button next to the correct answer</span>
                      </label>
                      {q.options?.map((opt, optIdx) => (
                        <div key={optIdx} style={{ display: "flex", gap: "0.65rem", alignItems: "center", marginBottom: "0.45rem" }}>
                          <input
                            type="radio"
                            name={`adm_correct_${qIdx}`}
                            checked={q.correctAnswer === opt && opt !== ""}
                            onChange={() => handleUpdateQuestion(qIdx, "correctAnswer", opt)}
                            title="Mark as correct answer"
                            style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--navy-900)" }}
                          />
                          <input
                            type="text"
                            placeholder={`Choice ${optIdx + 1} (e.g. Option ${String.fromCharCode(65 + optIdx)})`}
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
                    </div>
                  </div>
                ))}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsBuilderOpen(false)} disabled={builderSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={builderSaving}>
                  {builderSaving ? "Saving..." : editingAssessment ? "Save Changes" : "Create Assessment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBMISSIONS RESULTS DRILLDOWN MODAL */}
      {viewingSubmissionsId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="subs-modal-title">
          <div className="modal-content" style={{ maxWidth: "950px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <h2 id="subs-modal-title" style={{ margin: 0 }}>
                  {viewingSubmissionsId === "ALL" ? "All Submitted Tests (Global)" : "Assessment Candidate Submissions"}
                </h2>
                {!submissionsLoading && submissionsData?.submissions && (
                  <ExportActionButtons onAction={(act) => handlePdfAction(
                    act, 
                    viewingSubmissionsId === "ALL" ? "All Submitted Tests (Global)" : "Assessment Candidate Submissions", 
                    viewingSubmissionsId !== "ALL" ? `Total: ${submissionsData.summary?.totalSubmissions || 0} | Avg: ${submissionsData.summary?.averagePercentage || 0}%` : "",
                    viewingSubmissionsId === "ALL" 
                      ? [["Assessment", "Candidate", "Phone", "Score", "Percentage", "Result", "Submitted At"]]
                      : [["Candidate Name", "Phone Number", "Score", "Percentage", "Result", "Submitted At"]],
                    (submissionsData.submissions || []).map(s => viewingSubmissionsId === "ALL" ? [
                      s.assessment_title || "Unknown Test", s.officer_name || "Unknown", s.phone_number || "-", `${s.score || 0}/${s.total_points || 0}`, `${s.percentage || 0}%`, (s.percentage || 0) >= 50 ? "Passed" : "Needs Review", (s.submitted_at || "").split("T")[0]
                    ] : [
                      s.officer_name || "Unknown", s.phone_number || "-", `${s.score || 0}/${s.total_points || 0}`, `${s.percentage || 0}%`, (s.percentage || 0) >= 50 ? "Passed" : "Needs Review", (s.submitted_at || "").split("T")[0]
                    ]),
                    "Submitted_Tests.pdf"
                  )} />
                )}
              </div>
              <button className="modal-close-btn" onClick={() => setViewingSubmissionsId(null)} aria-label="Close submissions modal">
                &times;
              </button>
            </div>

            {submissionsLoading ? (
              <div className="banner banner-info">Loading submissions…</div>
            ) : (
              <>
                {viewingSubmissionsId !== "ALL" && (
                  <div className="analytics-grid" style={{ marginBottom: "1.25rem" }}>
                    <div className="kpi-card">
                      <span className="kpi-label">Submissions</span>
                      <span className="kpi-val text-navy">{submissionsData.summary?.totalSubmissions || 0}</span>
                    </div>
                    <div className="kpi-card">
                      <span className="kpi-label">Average Score</span>
                      <span className="kpi-val text-navy">{submissionsData.summary?.averagePercentage || 0}%</span>
                    </div>
                    <div className="kpi-card">
                      <span className="kpi-label">Pass Threshold</span>
                      <span className="kpi-val text-orange">50%</span>
                    </div>
                  </div>
                )}

                <div className="table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        {viewingSubmissionsId === "ALL" && <th scope="col">Assessment</th>}
                        <th scope="col">Candidate Name</th>
                        <th scope="col">Phone Number</th>
                        <th scope="col">Score</th>
                        <th scope="col">Percentage</th>
                        <th scope="col">Result</th>
                        <th scope="col">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissionsData.submissions?.length === 0 && (
                        <tr>
                          <td colSpan={viewingSubmissionsId === "ALL" ? 7 : 6} className="empty-row">
                            No submissions recorded{viewingSubmissionsId !== "ALL" ? " for this assessment" : ""} yet.
                          </td>
                        </tr>
                      )}
                      {currentSubs.map((s) => (
                        <tr key={s.id}>
                          {viewingSubmissionsId === "ALL" && (
                            <td className="text-sm">
                              <strong>{s.assessment_type}</strong>
                              <br/>
                              <span className="text-muted">{s.assessment_title}</span>
                            </td>
                          )}
                          <td>
                            <strong>{s.officer_name || "Unknown"}</strong>
                          </td>
                          <td>{formatPhoneAsTyped(s.phone_number) || "—"}</td>
                          <td><strong>{s.score}</strong> / {s.total_points}</td>
                          <td>
                            <span className={`attendance-status-pill status-${s.percentage >= 50 ? "excused" : "absent"}`}>
                              {s.percentage}%
                            </span>
                          </td>
                          <td>
                            {s.percentage >= 50 ? (
                              <span className="text-sm text-green">Passed</span>
                            ) : (
                              <span className="text-sm text-orange">Needs Review</span>
                            )}
                          </td>
                          <td>
                            <span className="table-date text-sm text-muted">
                              {new Date(
                                s.submitted_at.includes("T") ? s.submitted_at : s.submitted_at.replace(" ", "T") + "Z"
                              ).toLocaleString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PaginationControls currentPage={subsPage} totalPages={subsTotalPages} onPageChange={setSubsPage} />
                </div>
              </>
            )}

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setViewingSubmissionsId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* BULK UPLOAD QUESTIONS MODAL */}
      {isBulkModalOpen && bulkTargetAssessment && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="bulk-modal-title">
          <div className="modal-content" style={{ maxWidth: "880px" }}>
            <div className="modal-header">
              <div>
                <h2 id="bulk-modal-title" style={{ margin: 0, fontSize: "1.35rem" }}>
                  Bulk Upload Assessment Questions
                </h2>
                <p className="text-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.86rem" }}>
                  Target: <strong>{bulkTargetAssessment.title}</strong> ({bulkTargetAssessment.type})
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => setIsBulkModalOpen(false)} aria-label="Close bulk upload modal">
                &times;
              </button>
            </div>

            {bulkError && (
              <div className="banner banner-error" style={{ marginBottom: "1rem" }} role="alert">
                {bulkError}
              </div>
            )}

            {/* Template Download Banner */}
            <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <strong style={{ fontSize: "0.92rem", color: "var(--navy-900)", display: "block" }}>
                  Need the Excel Format?
                </strong>
                <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                  Download our pre-structured template containing question prompts, option choices, and answer keys.
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <a
                  href={downloadAssessmentTemplateUrl("pre-test")}
                  className="btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", textDecoration: "none", background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}
                >
                  📥 Pre-Test Template (.xlsx)
                </a>
                <a
                  href={downloadAssessmentTemplateUrl("post-test")}
                  className="btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", textDecoration: "none", background: "#dcfce7", color: "#166534", borderColor: "#bbf7d0" }}
                >
                  📥 Post-Test Template (.xlsx)
                </a>
                <a
                  href={downloadAssessmentTemplateUrl("pre-test", "docx")}
                  className="btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", textDecoration: "none", background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
                >
                  📄 Pre-Test Template (.docx)
                </a>
                <a
                  href={downloadAssessmentTemplateUrl("post-test", "docx")}
                  className="btn-secondary"
                  style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem", textDecoration: "none", background: "#f5f3ff", color: "#6d28d9", borderColor: "#ddd6fe" }}
                >
                  📄 Post-Test Template (.docx)
                </a>
              </div>
            </div>

            {/* File Dropzone / Selector */}
            <div style={{ border: "2px dashed #cbd5e1", borderRadius: "12px", padding: "1.75rem 1.25rem", textAlign: "center", background: "#fcfdfe", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📁</div>
              <h3 style={{ margin: "0 0 0.35rem", fontSize: "1.1rem", color: "var(--navy-900)" }}>
                {bulkFileName ? `Selected File: ${bulkFileName}` : "Choose or Drag & Drop Excel, CSV or Word file"}
              </h3>
              <p style={{ margin: "0 0 1rem", fontSize: "0.84rem", color: "#64748b" }}>
                Supports .xlsx, .xls, .csv, and .docx (Word) files with question table headers
              </p>

              <input
                type="file"
                id="bulk-upload-file"
                accept=".xlsx,.xls,.csv,.docx"
                onChange={handleBulkFileChange}
                style={{ display: "none" }}
              />
              <label
                htmlFor="bulk-upload-file"
                className="btn-primary"
                style={{ cursor: "pointer", display: "inline-block", padding: "0.55rem 1.4rem", fontSize: "0.92rem" }}
              >
                {bulkFileName ? "Choose Different File 🔄" : "Browse & Upload File 📂"}
              </label>
            </div>

            {/* Import Mode Options */}
            <div style={{ marginBottom: "1.25rem", display: "flex", gap: "1.5rem", alignItems: "center", background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: "8px" }}>
              <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--navy-900)" }}>Import Action:</span>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="bulkMode"
                  value="replace"
                  checked={bulkImportMode === "replace"}
                  onChange={() => setBulkImportMode("replace")}
                />
                <strong>Replace</strong> all existing questions in assessment
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="bulkMode"
                  value="append"
                  checked={bulkImportMode === "append"}
                  onChange={() => setBulkImportMode("append")}
                />
                <strong>Append</strong> to current questions
              </label>
            </div>

            {/* Parsed Questions Preview */}
            {bulkQuestions.length > 0 && (
              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem", color: "#166534" }}>
                    ✓ Successfully Parsed {bulkQuestions.length} Questions
                  </h4>
                  <span style={{ fontSize: "0.82rem", color: "#64748b" }}>
                    Total Points: {bulkQuestions.reduce((acc, q) => acc + (q.points || 0), 0)} pts
                  </span>
                </div>

                <div style={{ maxHeight: "240px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <table style={{ width: "100%", fontSize: "0.82rem", minWidth: "600px" }}>
                    <thead>
                      <tr>
                        <th style={{ width: "8%" }}>#</th>
                        <th style={{ width: "45%" }}>Question Prompt</th>
                        <th style={{ width: "18%" }}>Type</th>
                        <th style={{ width: "20%" }}>Correct Answer</th>
                        <th style={{ width: "9%" }}>Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkQuestions.map((q, idx) => (
                        <tr key={idx}>
                          <td><strong>{idx + 1}</strong></td>
                          <td>
                            <strong>{q.questionText}</strong>
                            <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "0.15rem" }}>
                              Options: {q.options?.join(" | ")}
                            </div>
                          </td>
                          <td>
                            <span className="badge-pill" style={{ background: "#f1f5f9", padding: "0.15rem 0.4rem", borderRadius: "4px" }}>
                              {q.questionType === "true_false" ? "True / False" : "Multiple Choice"}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: "#16a34a", fontWeight: 700 }}>
                              ✓ {q.correctAnswer}
                            </span>
                          </td>
                          <td><strong>{q.points}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsBulkModalOpen(false)}
                disabled={bulkSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmBulkUpload}
                disabled={bulkSaving || bulkQuestions.length === 0}
                style={{ minWidth: "180px" }}
              >
                {bulkSaving ? "Importing…" : `Import ${bulkQuestions.length} Questions →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Nominee Registration Modal */}
      {editingItem && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="edit-modal-title">Edit Nominee Registration</h2>
              <button className="modal-close-btn" onClick={handleCloseEdit} aria-label="Close modal">
                &times;
              </button>
            </div>

            {editErrors.general && (
              <div className="banner banner-error" role="alert">
                {editErrors.general}
              </div>
            )}

            <form onSubmit={handleSaveEdit}>
              <div className="field">
                <label htmlFor="edit-name">Name of Officer *</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editValues.officerName}
                  onChange={(e) => setEditValues({ ...editValues, officerName: e.target.value })}
                />
                {editErrors.officerName && <p className="field-error">{editErrors.officerName}</p>}
              </div>

              <div className="field">
                <label htmlFor="edit-email">Email Address</label>
                <input
                  id="edit-email"
                  type="email"
                  placeholder="officer@ges.gov.gh"
                  value={editValues.email || ""}
                  onChange={(e) => setEditValues({ ...editValues, email: e.target.value })}
                />
                {editErrors.email && <p className="field-error">{editErrors.email}</p>}
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="edit-sex">Sex *</label>
                  <select
                    id="edit-sex"
                    value={editValues.sex}
                    onChange={(e) => setEditValues({ ...editValues, sex: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="edit-phone">Phone Number *</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={editValues.phoneNumber}
                    onChange={(e) =>
                      setEditValues({ ...editValues, phoneNumber: formatPhoneAsTyped(e.target.value) })
                    }
                  />
                  {editErrors.phoneNumber && <p className="field-error">{editErrors.phoneNumber}</p>}
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="edit-region">Region *</label>
                  <select
                    id="edit-region"
                    value={editValues.region}
                    onChange={(e) => {
                      setEditValues({
                        ...editValues,
                        region: e.target.value,
                        district: "",
                      });
                    }}
                  >
                    <option value="">Select Region</option>
                    {regionNames.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  {editErrors.region && <p className="field-error">{editErrors.region}</p>}
                </div>

                <div className="field">
                  <label htmlFor="edit-district">District *</label>
                  <select
                    id="edit-district"
                    value={editValues.district}
                    onChange={(e) => setEditValues({ ...editValues, district: e.target.value })}
                    disabled={!editValues.region}
                  >
                    <option value="">Select District</option>
                    {editDistricts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {editErrors.district && <p className="field-error">{editErrors.district}</p>}
                </div>
              </div>

              <div className="field">
                <label htmlFor="edit-institution">Place of Work / Institution *</label>
                <input
                  id="edit-institution"
                  type="text"
                  value={editValues.institutionName}
                  onChange={(e) => setEditValues({ ...editValues, institutionName: e.target.value })}
                />
                {editErrors.institutionName && <p className="field-error">{editErrors.institutionName}</p>}
              </div>

              <div className="field">
                <label>Nominated Role (Select one) *</label>
                <div className="edit-roles-list">
                  {ROLE_OPTIONS.map((role) => (
                    <label key={role} className="radio-option">
                      <input
                        type="radio"
                        name="editNominatedRole"
                        value={role}
                        checked={editValues.roles.includes(role)}
                        onChange={() => handleSelectEditRole(role)}
                      />
                      <span>{role}</span>
                    </label>
                  ))}
                </div>
                {editErrors.roles && <p className="field-error">{editErrors.roles}</p>}
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="edit-cohort">Assigned Cohort</label>
                  <select
                    id="edit-cohort"
                    value={editValues.cohortId || ""}
                    onChange={(e) => setEditValues({ ...editValues, cohortId: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {cohortsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.arrival_date ? c.arrival_date.split(",")[1]?.trim() : ""})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="edit-attendance">Attendance Status</label>
                  <select
                    id="edit-attendance"
                    value={editValues.attendanceStatus || "Registered"}
                    onChange={(e) => setEditValues({ ...editValues, attendanceStatus: e.target.value })}
                  >
                    <option value="Registered">Registered (Pending)</option>
                    <option value="Attended">Attended (Checked In)</option>
                    <option value="Absent">Absent</option>
                    <option value="Excused">Excused</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label htmlFor="edit-notes">Check-in / Administrative Notes</label>
                <input
                  id="edit-notes"
                  type="text"
                  placeholder="e.g. Arrived on time with verification slip, room assigned #12"
                  value={editValues.checkInNotes || ""}
                  onChange={(e) => setEditValues({ ...editValues, checkInNotes: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseEdit} disabled={editSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={editSaving}>
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit National Master Trainer Modal */}
      {trainerModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trainer-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="trainer-modal-title">
                {editingTrainer ? "Edit Facilitator Details" : "Add National Master Trainer"}
              </h2>
              <button className="modal-close-btn" onClick={handleCloseTrainerModal} aria-label="Close modal">
                &times;
              </button>
            </div>

            {trainerFormErrors.general && (
              <div className="banner banner-error" role="alert">
                {trainerFormErrors.general}
              </div>
            )}

            <form onSubmit={handleSaveTrainer}>
              <div className="field">
                <label htmlFor="tr-name">Facilitator Full Name *</label>
                <input
                  id="tr-name"
                  type="text"
                  placeholder="e.g. Charlotte Asare Nyarko"
                  value={trainerForm.name}
                  onChange={(e) => setTrainerForm({ ...trainerForm, name: e.target.value })}
                />
                {trainerFormErrors.name && <p className="field-error">{trainerFormErrors.name}</p>}
              </div>

              <div className="field">
                <label htmlFor="tr-station">Place of Work / Station *</label>
                <input
                  id="tr-station"
                  type="text"
                  placeholder="e.g. Adentan Education Office, Adentan"
                  value={trainerForm.placeOfWork}
                  onChange={(e) => setTrainerForm({ ...trainerForm, placeOfWork: e.target.value })}
                />
                {trainerFormErrors.placeOfWork && <p className="field-error">{trainerFormErrors.placeOfWork}</p>}
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="tr-role">Schedule Role *</label>
                  <select
                    id="tr-role"
                    value={trainerForm.scheduleRole}
                    onChange={(e) => setTrainerForm({ ...trainerForm, scheduleRole: e.target.value })}
                  >
                    <option value="Teacher">Teacher</option>
                    <option value="M&S">M&S (Monitoring & Supervision)</option>
                    <option value="STEM Coordinator">STEM Coordinator</option>
                    <option value="SISO">SISO</option>
                    <option value="Basic Schools Coordinator">Basic Schools Coordinator</option>
                    <option value="IT Coordinator">IT Coordinator</option>
                    <option value="Lecturer">Lecturer</option>
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="tr-status">Account Status</label>
                  <select
                    id="tr-status"
                    value={trainerForm.status}
                    onChange={(e) => setTrainerForm({ ...trainerForm, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Disabled">Disabled</option>
                  </select>
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="tr-phone">Contact Phone Number *</label>
                  <input
                    id="tr-phone"
                    type="tel"
                    placeholder="020-860-7530"
                    value={trainerForm.contactNumber}
                    onChange={(e) =>
                      setTrainerForm({ ...trainerForm, contactNumber: formatPhoneAsTyped(e.target.value) })
                    }
                  />
                  {trainerFormErrors.contactNumber && <p className="field-error">{trainerFormErrors.contactNumber}</p>}
                </div>

                <div className="field">
                  <label htmlFor="tr-email">Official Email</label>
                  <input
                    id="tr-email"
                    type="email"
                    placeholder="facilitator@ges.gov.gh"
                    value={trainerForm.email}
                    onChange={(e) => setTrainerForm({ ...trainerForm, email: e.target.value })}
                  />
                  {trainerFormErrors.email && <p className="field-error">{trainerFormErrors.email}</p>}
                </div>
              </div>

              <div className="field">
                <label htmlFor="tr-pass">
                  {editingTrainer ? "Reset Password (leave blank to keep current)" : "Initial Password (default: phone number)"}
                </label>
                <input
                  id="tr-pass"
                  type="password"
                  placeholder={editingTrainer ? "••••••••" : "Leave blank to use phone number or 'trainer2026'"}
                  value={trainerForm.password}
                  onChange={(e) => setTrainerForm({ ...trainerForm, password: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseTrainerModal} disabled={trainerFormSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={trainerFormSaving}>
                  {trainerFormSaving ? "Saving..." : editingTrainer ? "Save Changes" : "Add Facilitator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit Administrator Modal */}
      {adminModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <div className="modal-content">
            <div className="modal-header">
              <h2 id="admin-modal-title">
                {editingAdmin ? "Edit Administrator Details" : "Create New Administrator"}
              </h2>
              <button className="modal-close-btn" onClick={handleCloseAdminModal} aria-label="Close modal">
                &times;
              </button>
            </div>

            {adminFormErrors.general && (
              <div className="banner banner-error" role="alert">
                {adminFormErrors.general}
              </div>
            )}

            <form onSubmit={handleSaveAdmin}>
              <div className="field">
                <label htmlFor="adm-name">Full Name *</label>
                <input
                  id="adm-name"
                  type="text"
                  placeholder="e.g. Kwabena Darko"
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                />
                {adminFormErrors.name && <p className="field-error">{adminFormErrors.name}</p>}
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="adm-email">Official Email *</label>
                  <input
                    id="adm-email"
                    type="email"
                    placeholder="k.darko@ges.gov.gh"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  />
                  {adminFormErrors.email && <p className="field-error">{adminFormErrors.email}</p>}
                </div>
                <div className="field">
                  <label htmlFor="adm-phone">Phone Number</label>
                  <input
                    id="adm-phone"
                    type="tel"
                    placeholder="024-498-9910"
                    value={adminForm.phoneNumber}
                    onChange={(e) =>
                      setAdminForm({ ...adminForm, phoneNumber: formatPhoneAsTyped(e.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="field-row">
                <div className="field">
                  <label htmlFor="adm-role">Administrative Role *</label>
                  <select
                    id="adm-role"
                    value={adminForm.role}
                    onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}
                  >
                    <option value="Admin">Admin (Full Management)</option>
                    <option value="Super Admin">Super Admin (Can Manage Admins)</option>
                    <option value="Reviewer">Reviewer (Read & Export Only)</option>
                  </select>
                </div>

                {editingAdmin && (
                  <div className="field">
                    <label htmlFor="adm-status">Account Status *</label>
                    <select
                      id="adm-status"
                      value={adminForm.status}
                      onChange={(e) => setAdminForm({ ...adminForm, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Disabled">Disabled</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="field">
                <label htmlFor="adm-pass">
                  {editingAdmin ? "Reset Password (leave empty to keep current)" : "Initial Password *"}
                </label>
                <input
                  id="adm-pass"
                  type="password"
                  placeholder={editingAdmin ? "••••••••" : "At least 6 characters"}
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                />
                {adminFormErrors.password && <p className="field-error">{adminFormErrors.password}</p>}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={handleCloseAdminModal} disabled={adminFormSaving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={adminFormSaving}>
                  {adminFormSaving ? "Saving..." : editingAdmin ? "Save Changes" : "Create Administrator"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* District Breakdown Modal */}
      {viewingDistrictStatsId && (
        <div className="modal-backdrop" onClick={() => setViewingDistrictStatsId(null)}>
          <div className="modal-content" style={{ maxWidth: "800px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>District Breakdown — {cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.name}</h3>
              <button className="btn-close" onClick={() => setViewingDistrictStatsId(null)} aria-label="Close modal">✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: "60vh", overflowY: "auto" }}>
              <div style={{ marginBottom: "1rem", fontWeight: "bold", color: "var(--navy-900)" }}>
                Total Districts: {cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.districtBreakdown?.length || 0}
              </div>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>District</th>
                    <th>Region</th>
                    <th>Expected</th>
                    <th>Registered</th>
                    <th>Attended</th>
                    <th>Remaining Seats</th>
                  </tr>
                </thead>
                <tbody>
                  {cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.districtBreakdown?.map((d, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{d.district}</td>
                      <td>{d.region}</td>
                      <td>{d.expected}</td>
                      <td>
                        <span style={{ color: d.registered === 0 ? "#ef4444" : "inherit" }}>
                          {d.registered}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: d.attended === d.expected ? "#16a34a" : "inherit" }}>
                          {d.attended}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          fontWeight: 600, 
                          color: d.remainingSeats > 0 ? "#ef4444" : "#16a34a",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: d.remainingSeats > 0 ? "#fef2f2" : "#f0fdf4"
                        }}>
                          {d.remainingSeats > 0 ? `${d.remainingSeats} Seats` : "Filled"}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.districtBreakdown || cohortStatsData?.cohorts?.find(c => c.id === viewingDistrictStatsId)?.districtBreakdown?.length === 0) && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                        No district data available for this cohort.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}



      {/* Defaulters Modal */}
      {showDefaultersModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "800px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                <h2 style={{ margin: 0 }}>Pending {defaultersType || "Test"} Submissions</h2>
                <ExportActionButtons onAction={(act) => handlePdfAction(
                  act, 
                  `Pending ${defaultersType || "Test"} Submissions`, 
                  `Total: ${defaultersData.length} nominees attended but have not submitted ${defaultersType ? 'their ' + defaultersType : 'any test'}.`,
                  [["Officer Name", "Phone", "Region", "District", "Cohort"]],
                  defaultersData.map(d => [d.officer_name, d.phone_number, d.region, d.district, d.cohort_name || (d.cohort_id ? `Cohort ${d.cohort_id}` : "—")]),
                  `Pending_Tests_${defaultersType || "All"}.pdf`
                )} />
              </div>
              <button className="close-btn" onClick={() => setShowDefaultersModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: "1rem", color: "#475569" }}>
                The following {defaultersData.length} nominees have been marked as "Attended" but have not submitted {defaultersType ? `their ${defaultersType}` : 'any test'}.
              </p>
              {defaultersData.length > 0 ? (
                <div className="table-wrap" style={{ maxHeight: "400px", overflowY: "auto" }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Officer Name</th>
                        <th>Phone</th>
                        <th>Region</th>
                        <th>District</th>
                        <th>Cohort</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentDefaulters.map((d, i) => (
                        <tr key={i}>
                          <td>{d.officer_name}</td>
                          <td>{d.phone_number}</td>
                          <td>{d.region}</td>
                          <td>{d.district}</td>
                          <td>{d.cohort_name || (d.cohort_id ? `Cohort ${d.cohort_id}` : "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <PaginationControls currentPage={defaultersPage} totalPages={defaultersTotalPages} onPageChange={setDefaultersPage} />
                </div>
              ) : (
                <p>No pending tests found. All attendees have submitted.</p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowDefaultersModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
