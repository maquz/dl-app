import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { officerSignUp, officerLogin, requestPasswordReset, confirmPasswordReset, fetchMyNomination } from "../api.js";

const PHONE_REGEX = /^\d{3}-\d{3}-\d{4}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatPhoneAsTyped(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)].filter(Boolean);
  return parts.join("-");
}

export default function OfficerAuth() {
  const navigate = useNavigate();
  // modes: 'login' | 'register' | 'forgot'
  const [viewMode, setViewMode] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [successNotice, setSuccessNotice] = useState("");
  const [recoveredAccount, setRecoveredAccount] = useState(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [showCustomPassForm, setShowCustomPassForm] = useState(false);
  const [errors, setErrors] = useState({});

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register form
  const [registerForm, setRegisterForm] = useState({
    officerName: "",
    email: "",
    phoneNumber: "",
    password: "",
  });


  // Auto-redirect if officer has already registered
  useEffect(() => {
    try {
      const saved = localStorage.getItem("officer_profile") || sessionStorage.getItem("officer_profile");
      const recentNominee = sessionStorage.getItem("recent_nominee");
      if (recentNominee) {
        const nom = JSON.parse(recentNominee);
        if (nom && nom.referenceCode) {
          navigate("/confirmation", { replace: true, state: { nominee: nom, activeTab: "pre-test" } });
          return;
        }
      }
      if (saved) {
        const profile = JSON.parse(saved);
        const phone = profile.phoneNumber || profile.phone;
        const email = profile.email;
        if (phone || email) {
          fetchMyNomination({ phone, email }).then((res) => {
            if (res.hasRegistered && res.nominee) {
              sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
              navigate("/confirmation", { replace: true, state: { nominee: res.nominee, activeTab: "pre-test" } });
            }
          }).catch(() => {});
        }
      }
    } catch {}
  }, [navigate]);

  // Recovery form
  const [recoveryQuery, setRecoveryQuery] = useState("");
  const [customNewPass, setCustomNewPass] = useState("");
  const [customConfirmPass, setCustomConfirmPass] = useState("");

  function validate() {
    const e = {};
    if (viewMode === "login") {
      if (!loginEmail.trim()) {
        e.email = "Please enter your email address or phone number.";
      }
      if (!loginPassword.trim()) {
        e.password = "Please enter your password.";
      }
    } else if (viewMode === "register") {
      if (!registerForm.officerName.trim()) {
        e.officerName = "Full Name of Officer is required.";
      }
      if (!registerForm.email.trim()) {
        e.email = "Email address is required.";
      } else if (!EMAIL_REGEX.test(registerForm.email.trim())) {
        e.email = "Please enter a valid email address.";
      }
      if (!PHONE_REGEX.test(registerForm.phoneNumber)) {
        e.phoneNumber = "Phone format must be 000-000-0000 (e.g. 024-498-9910).";
      }
      if (!registerForm.password || registerForm.password.length < 4) {
        e.password = "Password must be at least 4 characters.";
      }
    } else if (viewMode === "forgot") {
      if (!recoveryQuery.trim()) {
        e.recoveryQuery = "Please enter your registered email address or phone number.";
      }
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setServerError("");
    setSuccessNotice("");
    const validationErrors = validate();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setSubmitting(true);
    try {
      if (viewMode === "login") {
        const res = await officerLogin({
          identifier: loginEmail,
          password: loginPassword,
        });
        const profile = res.nominee ? { ...res.officer, ...res.nominee } : res.officer;
        if (rememberMe) {
          localStorage.setItem("officer_profile", JSON.stringify(profile));
        } else {
          sessionStorage.setItem("officer_profile", JSON.stringify(profile));
        }

        if (res.hasRegistered && res.nominee) {
          sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
          navigate("/confirmation", {
            replace: true,
            state: { nominee: res.nominee, activeTab: "pre-test" },
          });
        } else {
          navigate("/register", {
            replace: true,
            state: {
              officerName: res.officer.officerName,
              phoneNumber: res.officer.phoneNumber,
              email: res.officer.email,
            },
          });
        }
      } else if (viewMode === "register") {
        const res = await officerSignUp(registerForm);
        const profile = res.nominee ? { ...res.officer, ...res.nominee } : res.officer;
        if (rememberMe) {
          localStorage.setItem("officer_profile", JSON.stringify(profile));
        } else {
          sessionStorage.setItem("officer_profile", JSON.stringify(profile));
        }

        if (res.hasRegistered && res.nominee) {
          sessionStorage.setItem("recent_nominee", JSON.stringify(res.nominee));
          navigate("/confirmation", {
            replace: true,
            state: { nominee: res.nominee, activeTab: "pre-test" },
          });
        } else {
          navigate("/register", {
            replace: true,
            state: {
              officerName: res.officer.officerName,
              phoneNumber: res.officer.phoneNumber,
              email: res.officer.email,
            },
          });
        }
      } else if (viewMode === "forgot") {
        const res = await requestPasswordReset({ identifier: recoveryQuery.trim() });
        setRecoveredAccount(res.account);
        setSuccessNotice("Password retrieved and displayed below!");
      }
    } catch (err) {
      if (err.body?.hasRegistered && err.body?.nominee) {
        sessionStorage.setItem("recent_nominee", JSON.stringify(err.body.nominee));
        localStorage.setItem("officer_profile", JSON.stringify(err.body.nominee));
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
        setServerError("Operation failed. Please verify your details and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSetCustomPassword(e) {
    e.preventDefault();
    setServerError("");
    setSuccessNotice("");

    if (!customNewPass || customNewPass.length < 4) {
      setServerError("New password must be at least 4 characters.");
      return;
    }
    if (customNewPass !== customConfirmPass) {
      setServerError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await confirmPasswordReset({
        identifier: recoveryQuery.trim() || recoveredAccount?.loginIdentifier,
        newPassword: customNewPass.trim(),
      });
      setRecoveredAccount(res.account);
      setSuccessNotice("New custom password saved successfully!");
      setShowCustomPassForm(false);
    } catch (err) {
      setServerError(err.body?.error || err.message || "Failed to update custom password.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCopyPassword() {
    if (recoveredAccount?.password) {
      navigator.clipboard.writeText(recoveredAccount.password);
      setCopiedPass(true);
      setTimeout(() => setCopiedPass(false), 2000);
    }
  }

  function handleProceedToLogin() {
    if (!recoveredAccount) return;
    if (recoveredAccount.loginUrl === "/trainer/login") {
      navigate("/trainer/login");
    } else {
      setLoginEmail(recoveredAccount.loginIdentifier || recoveredAccount.email || recoveredAccount.phone);
      setLoginPassword(recoveredAccount.password);
      setViewMode("login");
      setRecoveredAccount(null);
      setSuccessNotice("Credentials pre-filled. Click Login to proceed.");
    }
  }

  function switchToForgotPassword() {
    setRecoveryQuery(loginEmail || "");
    setRecoveredAccount(null);
    setServerError("");
    setSuccessNotice("");
    setErrors({});
    setShowCustomPassForm(false);
    setViewMode("forgot");
  }

  function switchToLogin() {
    setServerError("");
    setSuccessNotice("");
    setErrors({});
    setRecoveredAccount(null);
    setViewMode("login");
  }

  function switchToRegister() {
    setServerError("");
    setSuccessNotice("");
    setErrors({});
    setRecoveredAccount(null);
    setViewMode("register");
  }

  return (
    <div className="auth-page-container">
      <div className="auth-card-modern">
        {/* Brand Logo Header with DL Logo only */}
        <div className="auth-header-brand">
          <img src="/dl-logo.jpg" alt="Differentiated Learning Logo" className="auth-dl-logo-main" />
        </div>

        {/* Title & Eyebrow Subheading */}
        <div className="auth-heading-group">
          <h1 className="auth-main-title">
            {viewMode === "login" && "Welcome Back"}
            {viewMode === "register" && "Create Account"}
            {viewMode === "forgot" && "Retrieve Password"}
          </h1>
          <p className="auth-eyebrow-subtitle">
            {viewMode === "login" && "LOGIN TO ACCESS YOUR GES DL NOMINATION PORTAL"}
            {viewMode === "register" && "REGISTER TO START YOUR DL DISTRICT TRAINER NOMINATION"}
            {viewMode === "forgot" && "ENTER YOUR REGISTERED EMAIL OR PHONE NUMBER TO VIEW YOUR PASSWORD"}
          </p>
        </div>

        {serverError && (
          <div className="banner banner-error auth-alert" role="alert">
            {serverError}
          </div>
        )}

        {successNotice && (
          <div className="banner banner-success auth-alert" role="alert">
            {successNotice}
          </div>
        )}

        {/* VIEW 3: FORGOT / DISPLAY PASSWORD IN BROWSER */}
        {viewMode === "forgot" && (
          <div>
            {!recoveredAccount ? (
              <form onSubmit={handleSubmit} noValidate className="auth-form-modern">
                <div className="form-group-modern">
                  <label htmlFor="rec-query" className="label-modern">
                    Registered Email Address or Phone Number
                  </label>
                  <div className={"input-wrapper-modern " + (errors.recoveryQuery ? "input-has-error" : "")}>
                    <input
                      id="rec-query"
                      type="text"
                      className="input-field-modern"
                      placeholder="e.g. 020-881-3144 or kwaku.mensah@ges.gov.gh"
                      value={recoveryQuery}
                      onChange={(e) => setRecoveryQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {errors.recoveryQuery && <p className="field-error-modern">{errors.recoveryQuery}</p>}
                  <span className="field-hint" style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "4px" }}>
                    Your password will be verified and displayed immediately on your screen.
                  </span>
                </div>

                <button type="submit" className="btn-modern-primary" disabled={submitting}>
                  {submitting ? "Retrieving credentials…" : "Show Password in Browser →"}
                </button>
              </form>
            ) : (
              <div className="recovered-creds-card">
                <div className="creds-badge-top">✓ Account Verified</div>
                <h3 className="creds-name">{recoveredAccount.name}</h3>
                <p className="creds-role">{recoveredAccount.role}</p>

                <div className="creds-display-box">
                  <div className="creds-field">
                    <span className="creds-label">Login Identifier:</span>
                    <span className="creds-val">{recoveredAccount.loginIdentifier}</span>
                  </div>
                  {recoveredAccount.email && (
                    <div className="creds-field">
                      <span className="creds-label">Email:</span>
                      <span className="creds-val">{recoveredAccount.email}</span>
                    </div>
                  )}
                  {recoveredAccount.phone && (
                    <div className="creds-field">
                      <span className="creds-label">Phone:</span>
                      <span className="creds-val">{recoveredAccount.phone}</span>
                    </div>
                  )}
                  <div className="creds-field password-highlight">
                    <span className="creds-label">Your Password:</span>
                    <div className="creds-pass-row">
                      <span className="creds-pass-text">{recoveredAccount.password}</span>
                      <button
                        type="button"
                        className="btn-copy-pass"
                        onClick={handleCopyPassword}
                      >
                        {copiedPass ? "✓ Copied!" : "📋 Copy Password"}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="creds-actions">
                  <button
                    type="button"
                    className="btn-modern-primary"
                    onClick={handleProceedToLogin}
                  >
                    Sign In with This Password Now →
                  </button>

                  <button
                    type="button"
                    className="creds-custom-toggle"
                    onClick={() => setShowCustomPassForm(!showCustomPassForm)}
                  >
                    {showCustomPassForm ? "▲ Hide Custom Password Form" : "▼ Change to a Different Custom Password"}
                  </button>
                </div>

                {showCustomPassForm && (
                  <form onSubmit={handleSetCustomPassword} style={{ marginTop: "1rem", borderTop: "1px dashed #cbd5e1", paddingTop: "1rem" }}>
                    <div className="form-group-modern" style={{ marginBottom: "0.75rem" }}>
                      <label htmlFor="custom-new" className="label-modern" style={{ fontSize: "0.85rem" }}>
                        New Custom Password
                      </label>
                      <input
                        id="custom-new"
                        type="text"
                        className="input-field-modern"
                        placeholder="Enter new password (min 4 chars)"
                        value={customNewPass}
                        onChange={(e) => setCustomNewPass(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group-modern" style={{ marginBottom: "0.75rem" }}>
                      <label htmlFor="custom-confirm" className="label-modern" style={{ fontSize: "0.85rem" }}>
                        Confirm New Password
                      </label>
                      <input
                        id="custom-confirm"
                        type="text"
                        className="input-field-modern"
                        placeholder="Repeat new password"
                        value={customConfirmPass}
                        onChange={(e) => setCustomConfirmPass(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-secondary" style={{ width: "100%", padding: "0.6rem" }} disabled={submitting}>
                      {submitting ? "Saving…" : "Save New Password"}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 1: LOGIN */}
        {viewMode === "login" && (
          <form onSubmit={handleSubmit} noValidate className="auth-form-modern">
            <div className="form-group-modern">
              <label htmlFor="login-email" className="label-modern">
                Email or Phone Number
              </label>
              <div className={"input-wrapper-modern " + (errors.email ? "input-has-error" : "")}>
                <input
                  id="login-email"
                  type="text"
                  className="input-field-modern"
                  placeholder="e.g. 024-498-9910 or kwaku.mensah@ges.gov.gh"
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: null }));
                  }}
                  autoComplete="username"
                />
              </div>
              {errors.email && <p className="field-error-modern">{errors.email}</p>}
            </div>

            <div className="form-group-modern">
              <label htmlFor="login-password" className="label-modern">
                Password
              </label>
              <div className={"input-wrapper-modern " + (errors.password ? "input-has-error" : "")}>
                <input
                  id="login-password"
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

            <div className="auth-options-row">
              <label className="remember-me-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="remember-text">Remember me</span>
              </label>
              <button
                type="button"
                className="btn-forgot-password"
                onClick={switchToForgotPassword}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="btn-modern-primary" disabled={submitting}>
              {submitting ? "Signing in…" : "Login"}
            </button>
          </form>
        )}

        {/* VIEW 2: REGISTER */}
        {viewMode === "register" && (
          <form onSubmit={handleSubmit} noValidate className="auth-form-modern">
            <div className="form-group-modern">
              <label htmlFor="reg-name" className="label-modern">
                Full Name of Officer
              </label>
              <div className={"input-wrapper-modern " + (errors.officerName ? "input-has-error" : "")}>
                <input
                  id="reg-name"
                  type="text"
                  className="input-field-modern"
                  placeholder="e.g. Samuel Kofi Mensah"
                  value={registerForm.officerName}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, officerName: e.target.value })
                  }
                  autoComplete="name"
                />
              </div>
              {errors.officerName && <p className="field-error-modern">{errors.officerName}</p>}
            </div>

            <div className="form-group-modern">
              <label htmlFor="reg-email" className="label-modern">
                Email Address
              </label>
              <div className={"input-wrapper-modern " + (errors.email ? "input-has-error" : "")}>
                <input
                  id="reg-email"
                  type="email"
                  className="input-field-modern"
                  placeholder="e.g. officer@ges.gov.gh"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  autoComplete="email"
                />
              </div>
              {errors.email && <p className="field-error-modern">{errors.email}</p>}
            </div>

            <div className="form-group-modern">
              <label htmlFor="reg-phone" className="label-modern">
                Phone Number
              </label>
              <div className={"input-wrapper-modern " + (errors.phoneNumber ? "input-has-error" : "")}>
                <input
                  id="reg-phone"
                  type="tel"
                  className="input-field-modern"
                  placeholder="024-498-9910"
                  value={registerForm.phoneNumber}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      phoneNumber: formatPhoneAsTyped(e.target.value),
                    })
                  }
                  autoComplete="tel"
                />
              </div>
              {errors.phoneNumber && <p className="field-error-modern">{errors.phoneNumber}</p>}
            </div>

            <div className="form-group-modern">
              <label htmlFor="reg-password" className="label-modern">
                Password
              </label>
              <div className={"input-wrapper-modern " + (errors.password ? "input-has-error" : "")}>
                <input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  className="input-field-modern"
                  placeholder="••••••••"
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, password: e.target.value })
                  }
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁" : "👁‍🗨"}
                </button>
              </div>
              {errors.password && <p className="field-error-modern">{errors.password}</p>}
            </div>

            <div className="auth-options-row">
              <label className="remember-me-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="remember-text">Remember me</span>
              </label>
            </div>

            <button type="submit" className="btn-modern-primary" disabled={submitting}>
              {submitting ? "Creating profile…" : "Create Account & Proceed"}
            </button>
          </form>
        )}

        {/* Footer Navigation */}
        <div className="auth-footer-links">
          {viewMode === "login" && (
            <p className="account-switch-text">
              Don't have an account?{" "}
              <button type="button" className="btn-link-highlight" onClick={switchToRegister}>
                Register now
              </button>
            </p>
          )}

          {viewMode === "register" && (
            <p className="account-switch-text">
              Already have an account?{" "}
              <button type="button" className="btn-link-highlight" onClick={switchToLogin}>
                Login here
              </button>
            </p>
          )}

          {viewMode === "forgot" && (
            <p className="account-switch-text">
              Remembered your password?{" "}
              <button type="button" className="btn-link-highlight" onClick={switchToLogin}>
                Back to Login
              </button>
            </p>
          )}

          <Link to="/" className="back-portal-link">
            ← Back to Portal Home
          </Link>
        </div>
      </div>
    </div>
  );
}
