import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import FormField from "../components/FormField.jsx";
import RoleCheckboxGroup from "../components/RoleCheckboxGroup.jsx";
import RegionDistrictSelect from "../components/RegionDistrictSelect.jsx";
import { fetchRegions, fetchCohorts, fetchCohortDistrictMap, submitRegistration, fetchMyNomination } from "../api.js";

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const initialState = {
  officerName: "",
  sex: "",
  phoneNumber: "",
  email: "",
  region: "",
  district: "",
  institutionName: "",
  roles: [],
  cohortId: "",
};

function formatPhoneAsTyped(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return parts.join("-");
}

export default function RegistrationForm() {
  const location = useLocation();
  const navigate = useNavigate();

  const [regions, setRegions] = useState({});
  const [cohorts, setCohorts] = useState([]);
  const [cohortDistrictMap, setCohortDistrictMap] = useState({});
  const [values, setValues] = useState(() => {
    // Check router state or local storage
    const stateProfile = location.state || {};
    let savedProfile = {};
    try {
      savedProfile = JSON.parse(localStorage.getItem("officer_profile") || "{}");
    } catch {}

    const officerName = stateProfile.officerName || savedProfile.officerName || "";
    const phoneNumber = stateProfile.phoneNumber || savedProfile.phoneNumber || "";
    const email = stateProfile.email || savedProfile.email || "";

    return {
      ...initialState,
      officerName,
      phoneNumber,
      email,
    };
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Popup state
  const [showAuthPopup, setShowAuthPopup] = useState(true);
  const [authPopupStep, setAuthPopupStep] = useState("ask");
  const [authPopupPhone, setAuthPopupPhone] = useState("");
  const [authPopupError, setAuthPopupError] = useState("");
  const [authPopupNotice, setAuthPopupNotice] = useState("");
  const [authPopupLoading, setAuthPopupLoading] = useState(false);
  useEffect(() => {
    let candidate = null;
    try {
      const savedProfile = localStorage.getItem("officer_profile") || sessionStorage.getItem("officer_profile");
      const recentNominee = sessionStorage.getItem("recent_nominee");
      if (recentNominee) {
        const nom = JSON.parse(recentNominee);
        if (nom && nom.referenceCode) {
          navigate("/confirmation", { replace: true, state: { nominee: nom, activeTab: "pre-test" } });
          return;
        }
      }
      if (savedProfile) {
        candidate = JSON.parse(savedProfile);
      } else if (location.state?.officerName) {
        candidate = location.state;
      }
    } catch {}

    const phone = candidate?.phoneNumber || candidate?.phone;
    const email = candidate?.email;
    if (phone || email) {
      fetchMyNomination({ phone, email })
        .then((res) => {
          if (res.hasRegistered && res.nominee) {
            sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
            navigate("/confirmation", {
              replace: true,
              state: { nominee: res.nominee, activeTab: "pre-test" },
            });
          } else {
            setCheckingExisting(false);
          }
        })
        .catch(() => {
          setCheckingExisting(false);
        });
    } else {
      setCheckingExisting(false);
    }
  }, [navigate, location.state]);

  useEffect(() => {
    fetchRegions()
      .then(setRegions)
      .catch(() => setServerError("Could not load the list of regions. Please refresh the page."));

    fetchCohorts()
      .then((data) => setCohorts(data.cohorts || []))
      .catch(() => {});

    fetchCohortDistrictMap()
      .then(setCohortDistrictMap)
      .catch(() => {});
  }, []);

  const matchedCohort = useMemo(() => {
    if (!values.region || !values.district || !cohortDistrictMap) return null;
    const normReg = values.region.toLowerCase().trim();
    const normDist = values.district.toLowerCase().trim();
    for (const [cId, info] of Object.entries(cohortDistrictMap)) {
      const found = info.districts?.some(
        (d) => d.region.toLowerCase() === normReg && d.district.toLowerCase() === normDist
      );
      if (found) {
        return cohorts.find((c) => String(c.id) === String(cId)) || {
          id: Number(cId),
          name: info.name,
          arrival_date: info.dates?.split("–")[0]?.trim() || info.dates,
        };
      }
    }
    return null;
  }, [values.region, values.district, cohortDistrictMap, cohorts]);

  function set(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
  }

  function validate() {
    const e = {};
    if (!values.officerName.trim()) e.officerName = "Please provide the name of the officer.";
    if (!values.sex) e.sex = "Please select a sex.";
    if (!PHONE_REGEX.test(values.phoneNumber)) {
      e.phoneNumber = "Phone number must look like 024-498-9910 (10 digits with hyphens).";
    } else {
      const rawDigits = values.phoneNumber.replace(/\D/g, "");
      if (rawDigits.startsWith("233")) {
        e.phoneNumber = "Please enter your local 10-digit number starting with 0 (do not use the 233 country code).";
      }
    }
    if (values.email && values.email.trim() && !EMAIL_REGEX.test(values.email.trim())) {
      e.email = "Please enter a valid email address (e.g. name@ges.gov.gh).";
    }
    if (!values.region) e.region = "Please select a region.";
    if (!values.district) e.district = "Please select or enter a district.";
    if (!values.institutionName.trim()) e.institutionName = "Please provide the name of your institution.";
    if (values.roles.length === 0) e.roles = "Please select at least one nominated role.";
    return e;
  }

  async function handlePhoneBlur() {
    if (PHONE_REGEX.test(values.phoneNumber)) {
      try {
        const res = await fetchMyNomination({ phone: values.phoneNumber });
        if (res.hasRegistered && res.nominee) {
          sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
          navigate("/confirmation", {
            replace: true,
            state: { nominee: res.nominee, activeTab: "pre-test", justLoggedIn: true },
          });
        }
      } catch (err) {}
    }
  }

  async function handlePopupSubmit() {
    if (!PHONE_REGEX.test(authPopupPhone)) {
      setAuthPopupError("Please enter a valid phone number (e.g. 024-498-9910).");
      return;
    }
    if (authPopupPhone.replace(/\D/g, "").startsWith("233")) {
      setAuthPopupError("Please enter your local 10-digit number starting with 0 (do not use the 233 country code).");
      return;
    }
    setAuthPopupError("");
    setAuthPopupLoading(true);
    try {
      const res = await fetchMyNomination({ phone: authPopupPhone });
      if (res.hasRegistered && res.nominee) {
        sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
        navigate("/confirmation", {
          replace: true,
          state: { nominee: res.nominee, activeTab: "pre-test", justLoggedIn: true },
        });
      } else {
        setAuthPopupError("No registration found with this phone number. Registration is closed. Please check your number or contact the DL Secretariat.");
      }
    } catch (err) {
      setAuthPopupError("No registration found with this phone number. Registration is closed. Please check your number or contact the DL Secretariat.");
    } finally {
      setAuthPopupLoading(false);
    }
  }

  async function handleEmailBlur() {
    if (values.email && EMAIL_REGEX.test(values.email.trim())) {
      try {
        const res = await fetchMyNomination({ email: values.email.trim() });
        if (res.hasRegistered && res.nominee) {
          sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
          navigate("/confirmation", {
            replace: true,
            state: { nominee: res.nominee, activeTab: "pre-test", justLoggedIn: true },
          });
        }
      } catch (err) {}
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const firstField = Object.keys(validationErrors)[0];
      document.getElementById(firstField)?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitRegistration(values);
      const nomineeData = res.nominee || {
        ...values,
        id: res.id,
        referenceCode: res.referenceCode,
        submittedAt: new Date().toISOString(),
      };
      sessionStorage.setItem("recent_nominee", JSON.stringify(nomineeData));
      if (!localStorage.getItem("officer_profile")) {
        sessionStorage.setItem("officer_profile", JSON.stringify(nomineeData));
      }
      navigate("/confirmation", { state: { nominee: nomineeData, justRegistered: true } });
    } catch (err) {
      if (err.body?.hasRegistered && err.body?.nominee) {
        sessionStorage.setItem("recent_nominee", JSON.stringify(err.body.nominee));
        navigate("/confirmation", {
          replace: true,
          state: { nominee: err.body.nominee, activeTab: "pre-test", justLoggedIn: true },
        });
        return;
      } else if (err.body?.errors) {
        setErrors(err.body.errors);
      } else if (err.body?.error) {
        setServerError(err.body.error);
      } else {
        setServerError("Something went wrong submitting the form. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingExisting) {
    return (
      <div className="page-narrow">
        <div className="form-card" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
          <div style={{ fontSize: "2.2rem", marginBottom: "0.85rem" }}>🔍</div>
          <h2 style={{ fontSize: "1.35rem", color: "var(--navy-900)", marginBottom: "0.5rem" }}>
            Checking Nomination Registration Status…
          </h2>
          <p className="text-muted" style={{ fontSize: "0.92rem", margin: 0 }}>
            Verifying records for <strong>{values.officerName || "Officer"}</strong>. Please wait a moment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow">
      {showAuthPopup && (
        <div style={{
          position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
          background: "rgba(15, 23, 42, 0.4)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "1rem"
        }}>
          <div style={{
            background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(16px)",
            borderRadius: "16px", padding: "2.5rem 2rem", width: "100%", maxWidth: "420px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)", border: "1px solid rgba(255, 255, 255, 0.4)",
            textAlign: "center"
          }}>
            {authPopupStep === "ask" ? (
              <>
                <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👋</div>
                <h2 style={{ fontSize: "1.5rem", color: "var(--navy-900)", marginBottom: "1rem", fontWeight: 800 }}>
                  Welcome to the Portal
                </h2>
                <p style={{ color: "#475569", marginBottom: "1.25rem", lineHeight: 1.5 }}>
                  Are you already a registered nominee looking to access your dashboard and take tests?
                </p>
                <div style={{
                  background: "#fef3c7",
                  border: "1px solid #fde68a",
                  borderRadius: "8px",
                  padding: "0.6rem 0.85rem",
                  marginBottom: "1.5rem",
                  fontSize: "0.82rem",
                  color: "#92400e",
                  fontWeight: 500
                }}>
                  🔒 Notice: Registration session is closed. All nominees must log in with their registered phone number.
                </div>
                <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setAuthPopupNotice("Registration session is closed. New registrations are no longer accepted. Please enter your registered phone number to verify and access your account.");
                      setAuthPopupStep("login");
                    }}
                  >
                    No, I need to register
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setAuthPopupNotice("");
                      setAuthPopupStep("login");
                    }}
                  >
                    Yes, log me in
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: "1.5rem", color: "var(--navy-900)", marginBottom: "0.5rem", fontWeight: 800 }}>
                  Access Your Portal
                </h2>
                <p style={{ color: "#475569", marginBottom: "1.25rem", fontSize: "0.9rem" }}>
                  Enter your registered phone number to authenticate securely. No password needed.
                </p>
                {authPopupNotice && (
                  <div style={{
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    padding: "0.75rem",
                    borderRadius: "8px",
                    marginBottom: "1rem",
                    fontSize: "0.85rem",
                    textAlign: "left",
                    lineHeight: 1.4
                  }}>
                    {authPopupNotice}
                  </div>
                )}
                {authPopupError && (
                  <div className="banner banner-error" style={{ marginBottom: "1rem", padding: "0.75rem", fontSize: "0.85rem", textAlign: "left" }}>
                    {authPopupError}
                  </div>
                )}
                <div style={{ textAlign: "left", marginBottom: "1.5rem" }}>
                  <label htmlFor="popupPhone" style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.85rem" }}>Phone Number</label>
                  <input
                    id="popupPhone"
                    type="tel"
                    placeholder="e.g. 024-498-9910"
                    value={authPopupPhone}
                    onChange={(e) => setAuthPopupPhone(formatPhoneAsTyped(e.target.value))}
                    onKeyDown={(e) => e.key === 'Enter' ? handlePopupSubmit() : null}
                    style={{ width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "1rem" }}
                    autoFocus
                  />
                </div>
                <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setAuthPopupError("");
                      setAuthPopupNotice("");
                      setAuthPopupStep("ask");
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={handlePopupSubmit}
                    disabled={authPopupLoading}
                  >
                    {authPopupLoading ? "Verifying..." : "Verify & Access"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="form-card" style={{ textAlign: "center", padding: "3rem 1.5rem" }}>
        <div style={{ fontSize: "3.2rem", marginBottom: "1rem" }}>🔒</div>
        <p className="form-eyebrow" style={{ color: "#b45309", fontWeight: 700 }}>Registration Session Closed</p>
        <h1 style={{ fontSize: "1.65rem", color: "var(--navy-900)", marginBottom: "0.75rem", fontWeight: 800 }}>
          DL District Trainer Programme (2026)
        </h1>
        <p className="text-muted" style={{ maxWidth: "480px", margin: "0 auto 1.5rem auto", lineHeight: 1.6, fontSize: "0.95rem" }}>
          The registration session for this programme is now closed. New registrations are no longer being accepted.
        </p>

        <div style={{
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "1.5rem",
          maxWidth: "440px",
          margin: "0 auto 2rem auto",
          textAlign: "left"
        }}>
          <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.35rem" }}>
            Already a nominated officer?
          </div>
          <div style={{ fontSize: "0.88rem", color: "#64748b", lineHeight: 1.5 }}>
            Access your dashboard, take pre/post assessments, and download your nomination slip by verifying your registered phone number.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ padding: "0.85rem 2rem", fontSize: "1rem", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          onClick={() => {
            setAuthPopupNotice("");
            setAuthPopupStep("login");
            setShowAuthPopup(true);
          }}
        >
          <span>Access Your Portal (Phone Verification)</span>
          <span>&rarr;</span>
        </button>
      </div>
    </div>
  );
}
