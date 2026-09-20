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
            state: { nominee: res.nominee, activeTab: "pre-test" },
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
    setAuthPopupError("");
    setAuthPopupLoading(true);
    try {
      const res = await fetchMyNomination({ phone: authPopupPhone });
      if (res.hasRegistered && res.nominee) {
        sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
        navigate("/confirmation", {
          replace: true,
          state: { nominee: res.nominee, activeTab: "pre-test" },
        });
      } else {
        setAuthPopupError("No registration found. Please register as a new nominee.");
        setTimeout(() => setShowAuthPopup(false), 2500);
      }
    } catch (err) {
      setAuthPopupError("No registration found. Please register as a new nominee.");
      setTimeout(() => setShowAuthPopup(false), 2500);
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
            state: { nominee: res.nominee, activeTab: "pre-test" },
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
      navigate("/confirmation", { state: { nominee: nomineeData } });
    } catch (err) {
      if (err.body?.hasRegistered && err.body?.nominee) {
        sessionStorage.setItem("recent_nominee", JSON.stringify(err.body.nominee));
        navigate("/confirmation", {
          replace: true,
          state: { nominee: err.body.nominee, activeTab: "pre-test" },
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
                <p style={{ color: "#475569", marginBottom: "2rem", lineHeight: 1.5 }}>
                  Are you already a registered nominee looking to access your dashboard and take tests?
                </p>
                <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                  <button type="button" className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAuthPopup(false)}>
                    No, I need to register
                  </button>
                  <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => setAuthPopupStep("login")}>
                    Yes, log me in
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: "1.5rem", color: "var(--navy-900)", marginBottom: "0.5rem", fontWeight: 800 }}>
                  Access Your Portal
                </h2>
                <p style={{ color: "#475569", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                  Enter your registered phone number to authenticate securely. No password needed.
                </p>
                {authPopupError && (
                  <div className="banner banner-error" style={{ marginBottom: "1rem", padding: "0.75rem", fontSize: "0.85rem" }}>
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
                  <button type="button" className="btn-secondary" onClick={() => setShowAuthPopup(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={handlePopupSubmit} disabled={authPopupLoading}>
                    {authPopupLoading ? "Verifying..." : "Verify & Access"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="form-card">
        <p className="form-eyebrow">Background Details of Nominees for DL District Trainers</p>
        <h1>Registration Form for Nominees (2026)</h1>
        <p className="form-lede">
          Use this form to register a nominee for the Differentiated Learning (DL) District Trainer programme, Ghana
          Education Service.
        </p>

        {serverError && (
          <p className="banner banner-error" role="alert">
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <FormField label="Name of Officer" htmlFor="officerName" required error={errors.officerName} hint="Provide the name of officer">
            <input
              id="officerName"
              type="text"
              value={values.officerName}
              onChange={(e) => set("officerName", e.target.value)}
              aria-invalid={!!errors.officerName}
              autoComplete="name"
            />
          </FormField>

          <fieldset className={`radio-group ${errors.sex ? "field-invalid" : ""}`}>
            <legend>
              Sex<span className="required-mark" aria-hidden="true"> *</span>
            </legend>
            <label className="radio-option">
              <input
                type="radio"
                name="sex"
                id="sex"
                value="Male"
                checked={values.sex === "Male"}
                onChange={(e) => set("sex", e.target.value)}
              />
              <span>Male</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="sex"
                value="Female"
                checked={values.sex === "Female"}
                onChange={(e) => set("sex", e.target.value)}
              />
              <span>Female</span>
            </label>
            {errors.sex && (
              <p className="field-error" role="alert">
                {errors.sex}
              </p>
            )}
          </fieldset>

          <FormField
            label="Phone Number"
            htmlFor="phoneNumber"
            required
            error={errors.phoneNumber}
            hint="Format: 000-000-0000. E.g. 0244989910 should be entered as 024-498-9910."
          >
            <input
              id="phoneNumber"
              type="tel"
              inputMode="numeric"
              placeholder="024-498-9910"
              value={values.phoneNumber}
              onChange={(e) => set("phoneNumber", formatPhoneAsTyped(e.target.value))}
              onBlur={handlePhoneBlur}
              aria-invalid={!!errors.phoneNumber}
              autoComplete="tel"
            />
          </FormField>

          <FormField
            label="Email Address"
            htmlFor="email"
            error={errors.email}
            hint="Official or primary email address (e.g. officer@ges.gov.gh)"
          >
            <input
              id="email"
              type="email"
              placeholder="officer@ges.gov.gh"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              onBlur={handleEmailBlur}
              aria-invalid={!!errors.email}
              autoComplete="email"
            />
          </FormField>

          <RegionDistrictSelect
            regions={regions}
            region={values.region}
            district={values.district}
            onRegionChange={(v) => set("region", v)}
            onDistrictChange={(v) => set("district", v)}
            regionError={errors.region}
            districtError={errors.district}
          />

          {matchedCohort && (
            <div className="matched-cohort-notice" role="status">
              <span className="notice-icon">📅</span>
              <div className="notice-body">
                <strong>Official GES Schedule for {values.district}:</strong>
                <span>
                  Allocated to <strong>{matchedCohort.name}</strong> · Arrival:{" "}
                  <strong>{matchedCohort.arrival_date || matchedCohort.arrivalDate}</strong>
                </span>
              </div>
            </div>
          )}

          <FormField
            label="Place of Work"
            htmlFor="institutionName"
            required
            error={errors.institutionName}
            hint="Full name of institution you work with (name of school/office)"
          >
            <input
              id="institutionName"
              type="text"
              value={values.institutionName}
              onChange={(e) => set("institutionName", e.target.value)}
              aria-invalid={!!errors.institutionName}
            />
          </FormField>

          <RoleCheckboxGroup value={values.roles} onChange={(v) => set("roles", v)} error={errors.roles} />

          <FormField
            label="Training Schedule & Arrival Cohort"
            htmlFor="cohortId"
            hint="Scheduled training cycles from Sept 20 to Oct 10, 2026. Select a preferred cohort or leave as Auto-Allocate."
          >
            <select
              id="cohortId"
              value={values.cohortId}
              onChange={(e) => set("cohortId", e.target.value)}
            >
              <option value="">⚡ Auto-Allocate to Next Open Cohort (Recommended)</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — Arrival: {c.arrival_date} | Training: {c.start_date.split(",")[1]} - {c.end_date.split(",")[1]} (Depart: {c.departure_date.split(",")[1]})
                </option>
              ))}
            </select>
          </FormField>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Submitting…" : "Submit registration"}
          </button>
        </form>
      </div>
    </div>
  );
}
