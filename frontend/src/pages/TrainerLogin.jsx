import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { trainerLogin } from "../api";

export default function TrainerLogin() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("trainer_token") && sessionStorage.getItem("trainer_profile")) {
      navigate("/trainer/dashboard");
    }
  }, [navigate]);

  function validate() {
    const e = {};
    if (!identifier.trim()) {
      e.identifier = "Please enter your email.";
    }
    if (!password.trim()) {
      e.password = "Password is required.";
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await trainerLogin({ identifier: identifier.trim(), password: password.trim() });
      sessionStorage.setItem("trainer_token", res.token);
      sessionStorage.setItem("trainer_profile", JSON.stringify(res.trainer));
      sessionStorage.setItem("admin_token", res.token); // Allow viewing shared admin cohort tracking
      navigate("/trainer/dashboard");
    } catch (err) {
      if (err.body?.errors) {
        setErrors(err.body.errors);
      } else if (err.body?.error) {
        setError(err.body.error);
      } else {
        setError(err.message || "Invalid credentials. Please verify your contact number and password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card-modern">
        {/* Brand Header with DL Logo */}
        <div className="auth-header-brand">
          <img src="/dl-logo.jpg" alt="Differentiated Learning Logo" className="auth-dl-logo-main" />
        </div>

        <div className="auth-heading-group">
          <h1 className="auth-main-title">National Master Trainer Sign In</h1>
          <p className="auth-eyebrow-subtitle">
            FACILITATOR PORTAL · GES DL NATIONAL TRAINERS
          </p>
        </div>

        {error && (
          <div className="banner banner-error auth-alert" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form-modern">
          <div className="form-group-modern">
            <label htmlFor="trainer-id" className="label-modern">
              Official Email *
            </label>
            <div className={"input-wrapper-modern " + (errors.identifier ? "input-has-error" : "")}>
              <input
                id="trainer-id"
                type="text"
                className="input-field-modern"
                placeholder="e.g. 020-860-7530 or charlotte.nyarko@ges.gov.gh"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: null }));
                }}
                autoComplete="username"
                autoFocus
              />
            </div>
            {errors.identifier && <p className="field-error-modern">{errors.identifier}</p>}
          </div>

          <div className="form-group-modern">
            <label htmlFor="trainer-pass" className="label-modern">
              Password *
            </label>
            <div className={"input-wrapper-modern " + (errors.password ? "input-has-error" : "")}>
              <input
                id="trainer-pass"
                type={showPassword ? "text" : "password"}
                className="input-field-modern"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: null }));
                }}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                )}
              </button>
            </div>
            {errors.password && <p className="field-error-modern">{errors.password}</p>}
          </div>

          <button type="submit" className="btn-modern-primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign In to Facilitator Dashboard"}
          </button>
        </form>

        <div className="auth-footer-note" style={{ marginTop: "1.25rem", textAlign: "center", fontSize: "0.82rem", color: "#64748b" }}>
          <span>🔒 Facilitator portal access only. Facilitator accounts and passwords are assigned and managed by DL National Secretariat.</span>
        </div>

        <div className="auth-bottom-links" style={{ marginTop: "1.25rem", display: "flex", justifyContent: "center", gap: "0.75rem", fontSize: "0.86rem" }}>
          <Link to="/" className="btn-link-highlight">
            ← Return to Nominee Portal
          </Link>
          <span style={{ color: "#cbd5e1" }}>•</span>
          <Link to="/admin" className="btn-link-highlight">
            Admin Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
