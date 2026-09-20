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

  async function handleQuickAccess() {
    if (!PHONE_REGEX.test(values.phoneNumber)) {
      setServerError("Please enter a valid phone number (e.g. 024-498-9910) to access your portal.");
      return;
    }
    setServerError("");
    try {
      const res = await fetchMyNomination({ phone: values.phoneNumber });
      if (res.hasRegistered && res.nominee) {
        sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
        navigate("/confirmation", {
          replace: true,
          state: { nominee: res.nominee, activeTab: "pre-test" },
        });
      } else {
        setServerError("No registration found for this phone number. Please fill out the form below to register.");
      }
    } catch (err) {
      setServerError("No registration found for this phone number. Please fill out the form below to register.");
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
      <div className="form-card">
        <p className="form-eyebrow">Background Details of Nominees for DL District Trainers</p>
        <h1>Registration Form for Nominees (2026)</h1>
        <p className="form-lede">
          Use this form to register a nominee for the Differentiated Learning (DL) District Trainer programme, Ghana
          Education Service.
        </p>

        <div className="banner banner-info" style={{ marginBottom: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <strong style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>👋</span> Already registered?
          </strong>
          <span style={{ fontSize: "0.9rem", color: "#334155" }}>
            Enter your registered Phone Number below to instantly access your portal and take tests. No password required!
          </span>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              type="tel"
              placeholder="e.g. 024-498-9910"
              value={values.phoneNumber}
              onChange={(e) => set("phoneNumber", formatPhoneAsTyped(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' ? handleQuickAccess() : null}
              style={{ flex: 1, padding: "0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
            <button type="button" className="btn-secondary" onClick={handleQuickAccess}>
              Access Portal
            </button>
          </div>
        </div>

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
