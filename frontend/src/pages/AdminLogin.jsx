import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { adminLogin } from "../api.js";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState("");
  const [errors, setErrors] = useState({});

  // Login credentials
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("admin_password") || sessionStorage.getItem("admin_profile")) {
      navigate("/admin/dashboard");
    }
  }, [navigate]);

  function validate() {
    const e = {};
    if (!loginPassword.trim()) {
      e.password = "Password is required.";
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setLoading(true);
    try {
      const res = await adminLogin({
        email: loginEmail.trim(),
        password: loginPassword.trim(),
      });
      const token = res.token || loginPassword.trim();
      sessionStorage.setItem("admin_token", token);
      sessionStorage.setItem("admin_password", token);
      if (res.admin) {
        sessionStorage.setItem("admin_profile", JSON.stringify(res.admin));
      }
      navigate("/admin/dashboard");
    } catch (err) {
      if (err.body?.errors) {
        setErrors(err.body.errors);
      } else if (err.body?.error) {
        setServerError(err.body.error);
      } else {
        setServerError("Incorrect administrator email or password.");
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
          <h1 className="auth-main-title">Admin Sign In</h1>
          <p className="auth-eyebrow-subtitle">
            RESTRICTED ACCESS · GES DL MASTER TRAINERS
          </p>
        </div>

        {serverError && (
          <div className="banner banner-error auth-alert" role="alert">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="auth-form-modern">
          <div className="form-group-modern">
            <label htmlFor="admin-email" className="label-modern">
              Admin Email (or master password)
            </label>
            <div className="input-wrapper-modern">
              <input
                id="admin-email"
                type="email"
                className="input-field-modern"
                placeholder="e.g. admin@ges.gov.gh"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className="form-group-modern">
            <label htmlFor="admin-pass" className="label-modern">
              Password *
            </label>
            <div className={"input-wrapper-modern " + (errors.password ? "input-has-error" : "")}>
              <input
                id="admin-pass"
                type={showPassword ? "text" : "password"}
                className="input-field-modern"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
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
            {loading ? "Verifying…" : "Sign In to Dashboard"}
          </button>
        </form>

        <div className="auth-footer-note" style={{ marginTop: "1.25rem", textAlign: "center", fontSize: "0.82rem", color: "#64748b" }}>
          <span>🔒 Authorized personnel only. New administrator accounts are created and managed by logged-in System Administrators.</span>
        </div>

        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <details style={{ cursor: "pointer" }}>
            <summary style={{ fontSize: "0.83rem", color: "#64748b", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
              <span style={{ color: "#2563eb", fontWeight: 600 }}>🔑 Forgot your password?</span>
            </summary>
            <div style={{ marginTop: "0.75rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.9rem 1rem", textAlign: "left", fontSize: "0.82rem", color: "#475569" }}>
              <p style={{ margin: "0 0 0.5rem", fontWeight: 600, color: "#1e3a5f" }}>Recovery Options:</p>
              <p style={{ margin: "0 0 0.4rem" }}>
                <strong>Option 1 — Default Master Password:</strong><br />
                Enter your email above and use the password: <code style={{ background: "#e0f2fe", padding: "1px 5px", borderRadius: "3px", color: "#0369a1", fontWeight: 700 }}>change-me-please</code>
              </p>
              <p style={{ margin: "0 0 0.4rem" }}>
                <strong>Option 2 — Alternative Master Password:</strong><br />
                Try: <code style={{ background: "#f0fdf4", padding: "1px 5px", borderRadius: "3px", color: "#166534", fontWeight: 700 }}>GES-DL-Admin-2026</code>
              </p>
              <p style={{ margin: "0" }}>
                <strong>Option 3 — Contact Super Admin:</strong><br />
                Contact the GES DL Programme Secretariat to reset your account password.
              </p>
            </div>
          </details>
        </div>

        <div className="auth-footer-links" style={{ marginTop: "1rem" }}>
          <Link to="/" className="back-portal-link">
            ← Return to Nominee Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
