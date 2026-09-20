import { useEffect, useState } from "react";
import { Routes, Route, Link, useLocation, useNavigate } from "react-router-dom";
import RegistrationForm from "./pages/RegistrationForm.jsx";
import Confirmation from "./pages/Confirmation.jsx";
import AdminLogin from "./pages/AdminLogin.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import TrainerLogin from "./pages/TrainerLogin.jsx";
import TrainerDashboard from "./pages/TrainerDashboard.jsx";
import AssessmentsList from "./pages/AssessmentsList.jsx";
import AssessmentTake from "./pages/AssessmentTake.jsx";

function Shell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");
  const isTrainer = location.pathname.startsWith("/trainer");
  const isAssessment = location.pathname.startsWith("/assessment");
  const isRegister = location.pathname === "/register";
  const isAuth = location.pathname === "/" || location.pathname === "/signup";

  const [officer, setOfficer] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("officer_profile") || sessionStorage.getItem("officer_profile");
      if (saved) {
        setOfficer(JSON.parse(saved));
      } else {
        setOfficer(null);
      }
    } catch {
      setOfficer(null);
    }
  }, [location.pathname]);

  function handleOfficerSignOut() {
    localStorage.removeItem("officer_profile");
    sessionStorage.removeItem("officer_profile");
    sessionStorage.removeItem("recent_nominee");
    setOfficer(null);
    navigate("/signup", { replace: true });
  }

  return (
    <div className="shell">
      <header className="site-header">
        <Link to={officer?.referenceCode ? "/confirmation" : "/"} className="brand" aria-label="DL Master Trainer Nominations Home">
          <img
            src="/dl-logo.jpg"
            alt="Differentiated Learning Logo"
            className="brand-logo"
          />
          <div>
            <p className="brand-eyebrow">Ghana Education Service</p>
            <p className="brand-title">Differentiated Learning (DL) Nominations</p>
          </div>
        </Link>

        <nav aria-label="Main Navigation">
          {officer ? (
            <span className="officer-nav-badge">
              <span
                className="officer-status-dot"
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  background: "#22c55e",
                  borderRadius: "50%",
                  marginRight: "6px",
                }}
              />
              <span className="officer-nav-name">
                {officer.officerName?.split(" ")[0] || officer.fullName?.split(" ")[0] || "Officer"}
              </span>
              <button
                type="button"
                className="btn-nav-signout"
                onClick={handleOfficerSignOut}
                title="Sign out of officer profile"
              >
                (Sign out)
              </button>
            </span>
          ) : (
            <>
              <Link to="/signup" className={isAuth ? "active" : ""}>
                Sign Up / Register
              </Link>
              <Link to="/trainer/login" className={isTrainer ? "active" : ""}>
                Facilitator Portal
              </Link>
              <Link to="/admin" className={isAdmin ? "active" : ""}>
                Admin
              </Link>
            </>
          )}
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <p>Differentiated Learning Programme · GALOP AF2 Nominee & Assessment Portal &copy; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route path="/" element={<RegistrationForm />} />
        <Route path="/signup" element={<RegistrationForm />} />
        <Route path="/register" element={<RegistrationForm />} />
        <Route path="/confirmation" element={<Confirmation />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/trainer/login" element={<TrainerLogin />} />
        <Route path="/trainer/dashboard" element={<TrainerDashboard />} />
        <Route path="/assessments" element={<AssessmentsList />} />
        <Route path="/assessment/:id" element={<AssessmentTake />} />
        <Route path="*" element={<p className="not-found">Page not found.</p>} />
      </Routes>
    </Shell>
  );
}
