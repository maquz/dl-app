const fs = require('fs');
let apiCode = fs.readFileSync('frontend/src/api.js', 'utf8');

const apiAdd = `
export async function recoverTrainerPassword(identifier) {
  return await fetchAPI("/national-trainers/recover", {
    method: "POST",
    body: JSON.stringify({ identifier })
  });
}
`;
if (!apiCode.includes("recoverTrainerPassword")) {
  apiCode += apiAdd;
  fs.writeFileSync('frontend/src/api.js', apiCode);
  console.log("api.js updated.");
}

let loginCode = fs.readFileSync('frontend/src/pages/TrainerLogin.jsx', 'utf8');
if (!loginCode.includes("recoverTrainerPassword")) {
  loginCode = loginCode.replace('import { trainerLogin } from "../api";', 'import { trainerLogin, recoverTrainerPassword } from "../api";');
  
  const recoveryState = `
  const [loading, setLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
`;
  loginCode = loginCode.replace('const [loading, setLoading] = useState(false);', recoveryState);

  const recoveryHandler = `
  async function handleRecovery(e) {
    e.preventDefault();
    setError("");
    setRecoveryMessage("");
    if (!identifier.trim()) {
      setErrors({ identifier: "Please enter your email or contact number to recover password." });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const res = await recoverTrainerPassword(identifier.trim());
      setRecoveryMessage(res.message);
    } catch (err) {
      setError(err.message || "Failed to recover password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {`;
  loginCode = loginCode.replace('async function handleSubmit(e) {', recoveryHandler);

  const formJsxTarget = `<button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "0.85rem", fontSize: "1.05rem", marginTop: "1rem" }}>
            {loading ? "Signing In..." : "Sign In to Facilitator Dashboard"}
          </button>`;
          
  const formJsxReplacement = `<button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "0.85rem", fontSize: "1.05rem", marginTop: "1rem" }}>
            {loading ? "Please wait..." : (recoveryMode ? "Reset Password" : "Sign In to Facilitator Dashboard")}
          </button>
          
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button 
              type="button" 
              onClick={() => { setRecoveryMode(!recoveryMode); setError(""); setRecoveryMessage(""); setErrors({}); }} 
              style={{ background: "none", border: "none", color: "#b45309", textDecoration: "underline", cursor: "pointer", fontSize: "0.9rem" }}>
              {recoveryMode ? "Back to Sign In" : "Forgot Password?"}
            </button>
          </div>`;
          
  loginCode = loginCode.replace(formJsxTarget, formJsxReplacement);
  
  // also handle the form onSubmit pointing to handleSubmit or handleRecovery
  const formTagTarget = `<form onSubmit={handleSubmit} className="auth-form">`;
  const formTagReplacement = `<form onSubmit={recoveryMode ? handleRecovery : handleSubmit} className="auth-form">`;
  loginCode = loginCode.replace(formTagTarget, formTagReplacement);
  
  // hide password field in recovery mode
  const passwordFieldTarget = `<div className="form-group">
            <label>Password <span className="text-danger">*</span></label>`;
  const passwordFieldReplacement = `{recoveryMessage && (
            <div className="alert alert-success" style={{ backgroundColor: "#dcfce7", color: "#166534", padding: "1rem", borderRadius: "8px", marginBottom: "1rem", fontSize: "0.9rem" }}>
              {recoveryMessage}
            </div>
          )}
          {!recoveryMode && (
          <div className="form-group">
            <label>Password <span className="text-danger">*</span></label>`;
            
  loginCode = loginCode.replace(passwordFieldTarget, passwordFieldReplacement);
  
  const endPasswordFieldTarget = `</button>
            </div>
            {errors.password && <div className="error-text">{errors.password}</div>}
          </div>`;
  const endPasswordFieldReplacement = `</button>
            </div>
            {errors.password && <div className="error-text">{errors.password}</div>}
          </div>
          )}`;
  loginCode = loginCode.replace(endPasswordFieldTarget, endPasswordFieldReplacement);
  
  fs.writeFileSync('frontend/src/pages/TrainerLogin.jsx', loginCode);
  console.log("TrainerLogin updated with recovery feature.");
} else {
  console.log("TrainerLogin already has recovery.");
}

