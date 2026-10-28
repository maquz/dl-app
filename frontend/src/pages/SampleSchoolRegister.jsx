import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { fetchSampleSchools, fetchSampleSchoolHierarchy, registerSampleSchool, fetchMyNomination } from "../api";

function formatPhoneAsTyped(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return parts.join("-");
}

export default function SampleSchoolRegister() {
  const navigate = useNavigate();

  // Data states
  const [hierarchy, setHierarchy] = useState({ regions: [], districtsByRegion: {} });
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  // Form states
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [officerName, setOfficerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [sex, setSex] = useState("");
  const [designation, setDesignation] = useState("Teacher"); // strictly 'Headteacher' | 'Teacher'

  // Submission & validation states
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

  // Login / Returning user popup
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Check if already signed in
  useEffect(() => {
    try {
      const saved = localStorage.getItem("officer_profile") || sessionStorage.getItem("recent_nominee");
      if (saved) {
        const nom = JSON.parse(saved);
        if (nom && nom.programType === "sample_school") {
          navigate("/schools/portal", { replace: true, state: { nominee: nom } });
        }
      }
    } catch {}
  }, [navigate]);

  // Load regions & districts
  useEffect(() => {
    fetchSampleSchoolHierarchy()
      .then((data) => setHierarchy(data))
      .catch((err) => console.error("Error loading hierarchy:", err));
  }, []);

  // When district changes, load matching schools
  useEffect(() => {
    if (selectedDistrict) {
      setLoadingSchools(true);
      fetchSampleSchools({ district: selectedDistrict })
        .then((data) => {
          setSchools(data.schools || []);
          setSelectedSchoolId("");
        })
        .catch((err) => console.error("Error loading schools:", err))
        .finally(() => setLoadingSchools(false));
    } else {
      setSchools([]);
      setSelectedSchoolId("");
    }
  }, [selectedDistrict]);

  // Selected school object
  const selectedSchool = useMemo(() => {
    return schools.find((s) => String(s.id) === String(selectedSchoolId)) || null;
  }, [schools, selectedSchoolId]);

  function handleRegionChange(r) {
    setSelectedRegion(r);
    setSelectedDistrict("");
    setSelectedSchoolId("");
  }

  function handleDistrictChange(d) {
    setSelectedDistrict(d);
    setSelectedSchoolId("");
  }

  function validate() {
    const e = {};
    if (!selectedRegion) e.region = "Please select your Region.";
    if (!selectedDistrict) e.district = "Please select your District.";
    if (!selectedSchoolId) e.school = "Please select your School from the list.";
    if (!officerName.trim()) e.officerName = "Please provide your Full Name.";
    if (!sex) e.sex = "Please select your Sex.";
    if (!["Headteacher", "Teacher"].includes(designation)) {
      e.designation = "Designation must be strictly Headteacher or Teacher.";
    }
    if (!phoneNumber || !/^\d{3}-\d{3}-\d{4}$/.test(phoneNumber)) {
      e.phoneNumber = "Phone number must be a valid 10-digit number (e.g. 024-498-9910).";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError("");

    try {
      const payload = {
        officerName: officerName.trim(),
        sex,
        phoneNumber,
        designation,
        schoolId: Number(selectedSchoolId),
        emisCode: selectedSchool?.emis_code,
      };

      const res = await registerSampleSchool(payload);
      const nominee = res.nominee;

      sessionStorage.setItem("recent_nominee", JSON.stringify(nominee));
      localStorage.setItem("officer_profile", JSON.stringify(nominee));

      navigate("/schools/portal", {
        replace: true,
        state: { nominee, welcomeNotice: res.message || "Registration completed successfully!" },
      });
    } catch (err) {
      setServerError(err.message || "Registration failed. Please check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoginSubmit() {
    if (!loginPhone || !/^\d{3}-\d{3}-\d{4}$/.test(loginPhone)) {
      setLoginError("Please enter your 10-digit registered phone number (e.g. 024-498-9910).");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetchMyNomination({ phone: loginPhone });
      if (res.hasRegistered && res.nominee) {
        sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
        localStorage.setItem("officer_profile", JSON.stringify(res.nominee));

        if (res.nominee.programType === "sample_school") {
          navigate("/schools/portal", { replace: true, state: { nominee: res.nominee } });
        } else {
          navigate("/confirmation", { replace: true, state: { nominee: res.nominee } });
        }
      } else {
        setLoginError("No registered record found for this phone number. Please fill out the registration form below.");
      }
    } catch (err) {
      setLoginError(err.message || "Failed to verify registration. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  }

  return (
    <div className="registration-container" style={{ maxWidth: "840px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* Login Modal */}
      {showLoginModal && (
        <div className="auth-overlay-backdrop" style={{
          position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.7)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem"
        }}>
          <div className="form-card" style={{ maxWidth: "440px", width: "100%", padding: "2rem", margin: 0, textAlign: "center" }}>
            <h2 style={{ fontSize: "1.4rem", color: "#0f172a", marginBottom: "0.5rem", fontWeight: 800 }}>
              Access Sample Schools Portal
            </h2>
            <p style={{ color: "#475569", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
              Enter your registered phone number to access your pre/post assessments and workshop slip.
            </p>

            {loginError && (
              <div className="banner banner-error" style={{ marginBottom: "1rem", textAlign: "left", fontSize: "0.85rem", padding: "0.75rem" }}>
                {loginError}
              </div>
            )}

            <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
              <label htmlFor="loginPhoneInput" style={{ display: "block", marginBottom: "0.4rem", fontWeight: 600, fontSize: "0.88rem", color: "#334155" }}>
                Phone Number
              </label>
              <input
                id="loginPhoneInput"
                type="tel"
                placeholder="e.g. 024-498-9910"
                value={loginPhone}
                onChange={(e) => setLoginPhone(formatPhoneAsTyped(e.target.value))}
                onKeyDown={(e) => e.key === "Enter" ? handleLoginSubmit() : null}
                style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => { setShowLoginModal(false); setLoginError(""); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 1 }}
                onClick={handleLoginSubmit}
                disabled={loginLoading}
              >
                {loginLoading ? "Verifying..." : "Verify & Access"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div className="form-card" style={{ borderTop: "5px solid #005BBB", marginBottom: "1.5rem", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <span style={{
              display: "inline-block", background: "#e0f2fe", color: "#0369a1", padding: "0.3rem 0.8rem",
              borderRadius: "20px", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.5rem"
            }}>
              GALOP AF2 · Selected Sample Schools
            </span>
            <h1 style={{ fontSize: "1.75rem", color: "#0f172a", margin: "0 0 0.5rem 0", fontWeight: 800 }}>
              Sample Schools Workshop Registration
            </h1>
            <p style={{ color: "#475569", margin: 0, fontSize: "0.95rem", lineHeight: 1.5 }}>
              Two-Day Workshop on DL Midterm Assessment & Weekly Lesson Checkpoint for Teachers and Headteachers of the 210 selected sample public primary schools.
            </p>
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowLoginModal(true)}
            style={{ fontSize: "0.88rem", padding: "0.5rem 1rem", alignSelf: "flex-start" }}
          >
            Already Registered? Sign In ↗
          </button>
        </div>

        <div style={{
          display: "flex", gap: "1.5rem", flexWrap: "wrap", background: "#f8fafc",
          border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1rem", marginTop: "1rem"
        }}>
          <div>
            <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Dates</span>
            <strong style={{ fontSize: "0.9rem", color: "#1e293b" }}>Tuesday, 27th Oct – Thursday, 29th Oct, 2026</strong>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Coverage</span>
            <strong style={{ fontSize: "0.9rem", color: "#1e293b" }}>210 Schools across 12 Sample Districts</strong>
          </div>
          <div>
            <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: 600 }}>Designations</span>
            <strong style={{ fontSize: "0.9rem", color: "#005BBB" }}>Headteacher &amp; Teacher</strong>
          </div>
        </div>
      </div>

      {serverError && (
        <div className="banner banner-error" style={{ marginBottom: "1.5rem" }}>
          {serverError}
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="form-card" style={{ padding: "2rem" }}>
        <h2 style={{ fontSize: "1.25rem", color: "#0f172a", marginBottom: "1.25rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", fontWeight: 700 }}>
          1. School Selection &amp; Verification
        </h2>

        {/* Region */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label htmlFor="regionSelect" style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
            Select Region <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            id="regionSelect"
            value={selectedRegion}
            onChange={(e) => handleRegionChange(e.target.value)}
            style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
          >
            <option value="">-- Choose Region --</option>
            {hierarchy.regions.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {errors.region && <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>{errors.region}</p>}
        </div>

        {/* District */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label htmlFor="districtSelect" style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
            Select District <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            id="districtSelect"
            value={selectedDistrict}
            onChange={(e) => handleDistrictChange(e.target.value)}
            disabled={!selectedRegion}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "8px",
              border: "1px solid #cbd5e1", fontSize: "0.95rem",
              background: !selectedRegion ? "#f8fafc" : "#ffffff"
            }}
          >
            <option value="">-- Choose District --</option>
            {(hierarchy.districtsByRegion[selectedRegion] || []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          {errors.district && <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>{errors.district}</p>}
        </div>

        {/* School Name */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="schoolSelect" style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
            Select Your School <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <select
            id="schoolSelect"
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
            disabled={!selectedDistrict || loadingSchools}
            style={{
              width: "100%", padding: "0.75rem", borderRadius: "8px",
              border: "1px solid #cbd5e1", fontSize: "0.95rem",
              background: (!selectedDistrict || loadingSchools) ? "#f8fafc" : "#ffffff"
            }}
          >
            <option value="">
              {loadingSchools ? "Loading schools in district..." : "-- Choose School from 210 Sample Schools --"}
            </option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.school_name} (EMIS: {s.emis_code})
              </option>
            ))}
          </select>
          {errors.school && <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>{errors.school}</p>}
        </div>

        {/* Auto-Attached School Details Banner */}
        {selectedSchool && (
          <div style={{
            background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "10px",
            padding: "1.25rem", marginBottom: "1.75rem"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.2rem" }}>🏫</span>
              <strong style={{ color: "#166534", fontSize: "1rem" }}>{selectedSchool.school_name}</strong>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem", marginTop: "0.75rem" }}>
              <div style={{ background: "#ffffff", padding: "0.6rem 0.8rem", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                <span style={{ fontSize: "0.72rem", color: "#166534", display: "block", textTransform: "uppercase", fontWeight: 700 }}>EMIS Code (Auto-Attached)</span>
                <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#15803d", letterSpacing: "1px" }}>{selectedSchool.emis_code}</span>
              </div>

              <div style={{ background: "#ffffff", padding: "0.6rem 0.8rem", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                <span style={{ fontSize: "0.72rem", color: "#166534", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Study Group</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0369a1" }}>{selectedSchool.group_name}</span>
              </div>
            </div>

            <p style={{ margin: "0.75rem 0 0 0", fontSize: "0.82rem", color: "#166534", fontStyle: "italic" }}>
              ✓ Treatment: {selectedSchool.treatment}
            </p>
          </div>
        )}

        <h2 style={{ fontSize: "1.25rem", color: "#0f172a", marginBottom: "1.25rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", fontWeight: 700 }}>
          2. Participant Information
        </h2>

        {/* Designation: Strictly Headteacher or Teacher */}
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
            Designation <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            {["Headteacher", "Teacher"].map((des) => (
              <label
                key={des}
                style={{
                  flex: "1 1 180px",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.85rem 1.25rem",
                  borderRadius: "8px",
                  border: designation === des ? "2px solid #005BBB" : "1px solid #cbd5e1",
                  background: designation === des ? "#eff6ff" : "#ffffff",
                  cursor: "pointer",
                  fontWeight: designation === des ? 700 : 500,
                  color: designation === des ? "#1e40af" : "#334155",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="radio"
                  name="designationRadio"
                  value={des}
                  checked={designation === des}
                  onChange={() => setDesignation(des)}
                  style={{ width: "18px", height: "18px", accentColor: "#005BBB" }}
                />
                <span>{des === "Headteacher" ? "👨‍💼 Headteacher" : "👩‍🏫 Teacher"}</span>
              </label>
            ))}
          </div>
          {errors.designation && <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>{errors.designation}</p>}
        </div>

        {/* Full Name */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label htmlFor="nameInput" style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
            Full Name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="nameInput"
            type="text"
            placeholder="e.g. Samuel Kofi Mensah"
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
            style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
          />
          {errors.officerName && <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>{errors.officerName}</p>}
        </div>

        {/* Phone Number */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label htmlFor="phoneInput" style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
            Phone Number <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            id="phoneInput"
            type="tel"
            placeholder="024-498-9910"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(formatPhoneAsTyped(e.target.value))}
            style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
          />
          <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Format: 10 digits (e.g. 024-498-9910). Used to access your assessment portal.</span>
          {errors.phoneNumber && <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>{errors.phoneNumber}</p>}
        </div>

        {/* Sex */}
        <div style={{ marginBottom: "1.75rem" }}>
          <label style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
            Sex <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            {["Male", "Female"].map((s) => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.95rem" }}>
                <input
                  type="radio"
                  name="sexRadio"
                  value={s}
                  checked={sex === s}
                  onChange={() => setSex(s)}
                  style={{ width: "18px", height: "18px", accentColor: "#005BBB" }}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
          {errors.sex && <p style={{ color: "#ef4444", fontSize: "0.82rem", margin: "0.3rem 0 0 0" }}>{errors.sex}</p>}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn-primary"
          style={{ width: "100%", padding: "0.9rem", fontSize: "1.05rem", fontWeight: 700 }}
          disabled={submitting}
        >
          {submitting ? "Registering & Preparing Portal..." : "Complete Registration & Access Portal →"}
        </button>
      </form>
    </div>
  );
}
