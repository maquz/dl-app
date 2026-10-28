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

  // Phase state: 'verify' (default upfront check) | 'register' (if phone not found)
  const [step, setStep] = useState("verify");

  // Verification states
  const [verifyPhone, setVerifyPhone] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifyNotice, setVerifyNotice] = useState("");

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

  // Check if participant already has a saved session in local/session storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("officer_profile") || sessionStorage.getItem("recent_nominee");
      if (saved) {
        const nom = JSON.parse(saved);
        if (nom && nom.programType === "sample_school" && nom.referenceCode) {
          navigate("/schools/portal", { replace: true, state: { nominee: nom } });
        }
      }
    } catch {}
  }, [navigate]);

  // Load regions & districts hierarchy
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

  // Selected school object for automatic EMIS Code & Study Group attachment
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

  // Upfront Phone Verification: Checks if phone number is registered
  async function handleVerifyPhone(e) {
    if (e) e.preventDefault();
    const clean = verifyPhone.trim();
    const digits = clean.replace(/\D/g, "");
    if (digits.length !== 10) {
      setVerifyError("Please enter your 10-digit mobile number (e.g. 0244000000).");
      return;
    }

    setVerifying(true);
    setVerifyError("");
    setVerifyNotice("");

    try {
      const res = await fetchMyNomination({ phone: clean });
      if (res.hasRegistered && res.nominee) {
        // Participant is registered! Store session and navigate directly to their portal
        sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
        localStorage.setItem("officer_profile", JSON.stringify(res.nominee));

        if (res.nominee.programType === "sample_school") {
          navigate("/schools/portal", {
            replace: true,
            state: { nominee: res.nominee, welcomeNotice: `Welcome back, ${res.nominee.officerName}!` },
          });
        } else {
          navigate("/confirmation", {
            replace: true,
            state: { nominee: res.nominee },
          });
        }
      } else {
        // Not registered! Pre-fill phone number and transition to School Selection & Verification
        setPhoneNumber(clean);
        setStep("register");
        setVerifyNotice(`Phone number ${clean} is not yet registered. Please select your Region, District, and School below to complete your registration.`);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      setVerifyError(err.message || "Unable to verify phone number. Please check your internet connection and try again.");
    } finally {
      setVerifying(false);
    }
  }

  function validate() {
    const e = {};
    if (!selectedRegion) e.region = "Please select your Region.";
    if (!selectedDistrict) e.district = "Please select your District.";
    if (!selectedSchoolId) e.school = "Please select your School from the 210 sample schools list.";
    if (!officerName.trim()) e.officerName = "Please provide your Full Name.";
    if (!sex) e.sex = "Please select your Sex.";
    if (!["Headteacher", "Teacher"].includes(designation)) {
      e.designation = "Designation must be strictly Headteacher or Teacher.";
    }
    const pDigits = (phoneNumber || "").replace(/\D/g, "");
    if (pDigits.length !== 10) {
      e.phoneNumber = "Phone number must be a valid 10-digit number (e.g. 0244000000).";
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
        state: { nominee, welcomeNotice: res.message || "Registration completed successfully! Welcome to your Sample Schools portal." },
      });
    } catch (err) {
      setServerError(err.message || "Registration failed. Please check your network and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="registration-container" style={{ maxWidth: "840px", margin: "2rem auto", padding: "0 1rem" }}>
      {/* ============================================================== */}
      {/* STEP 1: UPFRONT PHONE NUMBER VERIFICATION                      */}
      {/* ============================================================== */}
      {step === "verify" && (
        <div className="form-card" style={{ borderTop: "5px solid #005BBB", padding: "2.5rem 2rem", marginBottom: "1.5rem" }}>
          <div style={{ textAlign: "center", maxWidth: "560px", margin: "0 auto" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📱</div>
            <span style={{
              display: "inline-block", background: "#e0f2fe", color: "#0369a1", padding: "0.3rem 0.85rem",
              borderRadius: "20px", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.75rem"
            }}>
              GALOP AF2 · Selected Sample Schools
            </span>
            <h1 style={{ fontSize: "1.75rem", color: "#0f172a", margin: "0 0 0.5rem 0", fontWeight: 800 }}>
              Participant Verification &amp; Access
            </h1>
            <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: 1.55, marginBottom: "1.75rem" }}>
              Please enter your 10-digit mobile phone number. If you are already registered, you will be taken directly to your test portal. If not yet registered, you will proceed to complete your school registration.
            </p>

            {verifyNotice && (
              <div className="banner banner-info" style={{ textAlign: "left", marginBottom: "1.25rem", fontSize: "0.88rem" }}>
                {verifyNotice}
              </div>
            )}

            {verifyError && (
              <div className="banner banner-error" style={{ textAlign: "left", marginBottom: "1.25rem", fontSize: "0.88rem" }}>
                {verifyError}
              </div>
            )}

            <form onSubmit={handleVerifyPhone} style={{ textAlign: "left", marginBottom: "1.75rem" }}>
              <label htmlFor="verifyPhoneInput" style={{ display: "block", marginBottom: "0.4rem", fontWeight: 700, color: "#1e293b", fontSize: "0.92rem" }}>
                Phone Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="verifyPhoneInput"
                type="tel"
                placeholder="e.g. 0244000000"
                value={verifyPhone}
                onChange={(e) => setVerifyPhone(formatPhoneAsTyped(e.target.value))}
                style={{
                  width: "100%", padding: "0.85rem 1rem", borderRadius: "8px",
                  border: "1.5px solid #cbd5e1", fontSize: "1.15rem", fontWeight: 700,
                  letterSpacing: "0.5px", color: "#0f172a", marginBottom: "0.35rem"
                }}
                autoFocus
              />
              <span style={{ fontSize: "0.78rem", color: "#64748b", display: "block", marginBottom: "1.25rem" }}>
                Format: 10 digits (e.g. 0244000000).
              </span>

              <button
                type="submit"
                className="btn-primary"
                disabled={verifying}
                style={{
                  width: "100%", padding: "0.9rem", fontSize: "1.05rem",
                  fontWeight: 700, borderRadius: "8px"
                }}
              >
                {verifying ? "Checking Registration Status…" : "Verify Phone Number & Continue →"}
              </button>
            </form>

            <div style={{
              display: "flex", gap: "1rem", flexWrap: "wrap", background: "#f8fafc",
              border: "1px solid #e2e8f0", borderRadius: "10px", padding: "1rem", textAlign: "left"
            }}>
              <div style={{ flex: "1 1 150px" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Workshop Dates</span>
                <strong style={{ fontSize: "0.88rem", color: "#1e293b" }}>27th Oct – 29th Oct, 2026</strong>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Target Coverage</span>
                <strong style={{ fontSize: "0.88rem", color: "#1e293b" }}>210 Selected Schools</strong>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <span style={{ fontSize: "0.72rem", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: 700 }}>Participant Roles</span>
                <strong style={{ fontSize: "0.88rem", color: "#005BBB" }}>Headteacher &amp; Teacher</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 2: REGISTRATION FORM (SHOWN IF PHONE IS NOT REGISTERED)  */}
      {/* ============================================================== */}
      {step === "register" && (
        <>
          {/* Active Verification Notice */}
          <div style={{
            background: "#eff6ff", border: "1.5px solid #bfdbfe", borderRadius: "12px",
            padding: "1.1rem 1.4rem", marginBottom: "1.5rem", display: "flex",
            justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem"
          }}>
            <div>
              <span style={{ fontWeight: 800, color: "#1e40af", display: "block", fontSize: "0.98rem" }}>
                📱 Verified Phone: {phoneNumber}
              </span>
              <span style={{ fontSize: "0.86rem", color: "#3b82f6" }}>
                This phone number is not registered yet. Please complete the form below to register your school.
              </span>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setStep("verify");
                setVerifyError("");
                setVerifyNotice("");
              }}
              style={{ fontSize: "0.85rem", padding: "0.45rem 0.9rem", background: "#ffffff", fontWeight: 700 }}
            >
              ← Change Phone Number
            </button>
          </div>

          {serverError && (
            <div className="banner banner-error" style={{ marginBottom: "1.5rem" }}>
              {serverError}
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="form-card" style={{ padding: "2rem", borderTop: "5px solid #005BBB" }}>
            <h2 style={{ fontSize: "1.3rem", color: "#0f172a", marginBottom: "1.25rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", fontWeight: 800 }}>
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

            {/* Auto-Attached School Details Card */}
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

            <h2 style={{ fontSize: "1.3rem", color: "#0f172a", marginBottom: "1.25rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem", fontWeight: 800 }}>
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

            {/* Phone Number (Verified) */}
            <div style={{ marginBottom: "1.25rem" }}>
              <label htmlFor="phoneInput" style={{ display: "block", fontWeight: 600, color: "#334155", marginBottom: "0.4rem", fontSize: "0.9rem" }}>
                Phone Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="phoneInput"
                type="tel"
                placeholder="0244000000"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(formatPhoneAsTyped(e.target.value))}
                style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "0.95rem" }}
              />
              <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Format: 10 digits (e.g. 0244000000).</span>
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
              style={{ width: "100%", padding: "0.95rem", fontSize: "1.05rem", fontWeight: 700, borderRadius: "8px" }}
              disabled={submitting}
            >
              {submitting ? "Registering & Preparing Portal..." : "Complete Registration & Access Portal →"}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
