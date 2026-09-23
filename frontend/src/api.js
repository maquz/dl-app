const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "/api" : "http://localhost:4000/api");

async function handle(res) {
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const error = new Error(body?.error || "Request failed");
    error.status = res.status;
    error.body = body;
    throw error;
  }
  return body;
}

export async function officerSignUp(payload) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function officerLogin(payload) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function requestPasswordReset(identifier) {
  const payload = typeof identifier === "object" ? identifier : { identifier, email: identifier };
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function confirmPasswordReset(payload) {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function fetchRegions() {
  const res = await fetch(`${API_URL}/registrations/meta/regions`);
  return handle(res);
}

export async function fetchMyNomination(params = {}) {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/registrations/my-nomination?${query}`);
  return handle(res);
}

export async function submitRegistration(payload) {
  const res = await fetch(`${API_URL}/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function adminLogin(credentials) {
  // Can be a string (password) or object ({ email, password })
  const body = typeof credentials === "string" ? { password: credentials } : credentials;
  const res = await fetch(`${API_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle(res);
}

export async function adminRegister(payload) {
  const res = await fetch(`${API_URL}/admin/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

function getAdminAuthHeaders(authHeader) {
  const token = authHeader || sessionStorage.getItem("admin_token") || sessionStorage.getItem("admin_password") || "";
  return {
    "x-admin-password": token,
    "x-admin-token": token,
    "Authorization": `Bearer ${token}`,
  };
}

export async function fetchAdminUsers(authHeader) {
  const res = await fetch(`${API_URL}/admin/users`, {
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function createAdminUser(authHeader, payload) {
  const res = await fetch(`${API_URL}/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function updateAdminUser(authHeader, id, payload) {
  const res = await fetch(`${API_URL}/admin/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function deleteAdminUser(authHeader, id) {
  const res = await fetch(`${API_URL}/admin/users/${id}`, {
    method: "DELETE",
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function fetchRegistrations(password, filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_URL}/registrations?${params.toString()}`, {
    headers: { ...getAdminAuthHeaders(password) },
  });
  return handle(res);
}

export async function fetchStats(password) {
  const res = await fetch(`${API_URL}/registrations/stats`, {
    headers: { ...getAdminAuthHeaders(password) },
  });
  return handle(res);
}

export async function updateRegistration(password, id, payload) {
  const res = await fetch(`${API_URL}/registrations/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(password),
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function updateRegistrationImei(authHeader, id, data) {
  // data can be { tablet_imei, tablet_serial }
  const res = await fetch(`${API_URL}/registrations/${id}/imei`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify(data),
  });
  return handle(res);
}

export async function deleteRegistration(password, id) {
  const res = await fetch(`${API_URL}/registrations/${id}`, {
    method: "DELETE",
    headers: { ...getAdminAuthHeaders(password) },
  });
  return handle(res);
}

export async function fetchCohorts() {
  const res = await fetch(`${API_URL}/cohorts`);
  return handle(res);
}

export async function fetchCohortDistrictMap() {
  const res = await fetch(`${API_URL}/cohorts/district-map`);
  return handle(res);
}

export async function fetchCohortStats(authHeader) {
  const res = await fetch(`${API_URL}/cohorts/stats`, {
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function updateAttendance(authHeader, id, status, notes = "") {
  const res = await fetch(`${API_URL}/cohorts/attendance/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify({ status, notes }),
  });
  return handle(res);
}

export async function allocateCohort(authHeader, id, cohortId) {
  const res = await fetch(`${API_URL}/cohorts/allocate/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify({ cohortId }),
  });
  return handle(res);
}

export function exportUrl(format) {
  return `${API_URL}/registrations/export/${format}`;
}

export async function downloadExport(password, format) {
  const res = await fetch(exportUrl(format), {
    headers: { ...getAdminAuthHeaders(password) },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dl_master_trainer_registrations.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// ---------------------------------------------------
// National Master Trainers API
// ---------------------------------------------------
export async function fetchNationalTrainers() {
  const res = await fetch(`${API_URL}/national-trainers`);
  return handle(res);
}

export async function createNationalTrainer(authHeader, payload) {
  const res = await fetch(`${API_URL}/national-trainers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function updateNationalTrainer(authHeader, id, payload) {
  const res = await fetch(`${API_URL}/national-trainers/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function deleteNationalTrainer(authHeader, id) {
  const res = await fetch(`${API_URL}/national-trainers/${id}`, {
    method: "DELETE",
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function resetTrainerPassword(authHeader, id, password = "") {
  const res = await fetch(`${API_URL}/national-trainers/${id}/reset-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify({ password }),
  });
  return handle(res);
}

export async function trainerLogin(credentials) {
  const res = await fetch(`${API_URL}/national-trainers/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  return handle(res);
}

export async function fetchTrainerProfile(token) {
  const res = await fetch(`${API_URL}/national-trainers/me`, {
    headers: { ...getAdminAuthHeaders(token) },
  });
  return handle(res);
}

// ---------------------------------------------------
// Assessments (Pre-Test & Post-Test) API
// ---------------------------------------------------
export async function fetchAssessments() {
  const res = await fetch(`${API_URL}/assessments`);
  return handle(res);
}

export async function fetchAssessmentOverviewStats(cohortId = "") {
  const url = cohortId ? `${API_URL}/assessments/stats/overview?cohort_id=${cohortId}` : `${API_URL}/assessments/stats/overview`;
  const res = await fetch(url);
  return handle(res);
}

export async function fetchAssessmentDefaulters(authHeader, cohortId = "", type = "") {
  let url = `${API_URL}/assessments/defaulters?`;
  if (cohortId) url += `cohort_id=${encodeURIComponent(cohortId)}&`;
  if (type) url += `type=${encodeURIComponent(type)}`;
  const res = await fetch(url, {
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function fetchAssessmentForTest(id, params = {}) {
  const token = sessionStorage.getItem("admin_token") || sessionStorage.getItem("admin_password") || sessionStorage.getItem("trainer_token") || "";
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/assessments/${id}/take${query ? `?${query}` : ""}`, {
    headers: { ...getAdminAuthHeaders(token) },
  });
  return handle(res);
}

export async function fetchAssessmentDetails(authHeader, id) {
  const res = await fetch(`${API_URL}/assessments/${id}`, {
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function createAssessment(authHeader, payload) {
  const res = await fetch(`${API_URL}/assessments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function updateAssessment(authHeader, id, payload) {
  const res = await fetch(`${API_URL}/assessments/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function toggleAssessment(authHeader, id) {
  const res = await fetch(`${API_URL}/assessments/${id}/toggle`, {
    method: "PATCH",
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function submitAssessment(id, payload) {
  const res = await fetch(`${API_URL}/assessments/${id}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle(res);
}

export async function fetchAssessmentSubmissions(authHeader, id, filters = {}) {
  const params = new URLSearchParams(filters);
  const res = await fetch(`${API_URL}/assessments/${id}/submissions?${params.toString()}`, {
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function fetchAllSubmissions(authHeader) {
  const res = await fetch(`${API_URL}/assessments/submissions/all`, {
    headers: { ...getAdminAuthHeaders(authHeader) },
  });
  return handle(res);
}

export async function bulkImportAssessmentQuestions(authHeader, id, questions, mode = "replace") {
  const res = await fetch(`${API_URL}/assessments/${id}/questions/bulk`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminAuthHeaders(authHeader),
    },
    body: JSON.stringify({ questions, mode }),
  });
  return handle(res);
}

export async function fetchMySubmissions(phone, registrationId) {
  let query = `?phone=${encodeURIComponent(phone || "")}`;
  if (registrationId) query += `&registrationId=${registrationId}`;
  const res = await fetch(`${API_URL}/assessments/my-submissions${query}`);
  return handle(res);
}

export function downloadAssessmentTemplateUrl(type = "pre-test", format = "xlsx") {
  return `${API_URL}/assessments/template/download?type=${type}&format=${format}`;
}

export function getAssessmentPptxReportUrl(id, cohortId = "") {
  return `${API_URL}/assessments/${id}/report/pptx${cohortId ? `?cohort_id=${cohortId}` : ""}`;
}

export async function parseDocxQuestions(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_URL}/assessments/template/parse-docx`, {
    method: "POST",
    body: formData,
    // No Content-Type header — browser sets multipart boundary automatically
  });
  return handle(res);
}

export async function fetchResources() {
  const res = await fetch(`${API_URL}/resources`);
  return handle(res);
}
