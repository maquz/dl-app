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
import SampleSchoolRegister from "./pages/SampleSchoolRegister.jsx";
import SampleSchoolPortal from "./pages/SampleSchoolPortal.jsx";

function Shell({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = location.pathname.startsWith("/admin");
  const isTrainer = location.pathname.startsWith("/trainer");
  const isAssessment = location.pathname.startsWith("/assessment");
  const isRegister = location.pathname === "/register";
  const isAuth = location.pathname === "/" || location.pathname === "/signup";
  const isSchools = location.pathname.startsWith("/schools") || location.pathname.startsWith("/sample-schools");
  const isSampleSchoolAssessment = location.pathname === "/assessment/4" || location.pathname === "/assessment/5";
  const isSampleSchoolTrack = isSchools || isSampleSchoolAssessment || (officer?.programType === "sample_school");

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
    const wasSchool = officer?.programType === "sample_school";
    localStorage.removeItem("officer_profile");
    sessionStorage.removeItem("officer_profile");
    sessionStorage.removeItem("recent_nominee");
    setOfficer(null);
    navigate(wasSchool ? "/schools" : "/signup", { replace: true });
  }

  const brandTo = isSampleSchoolTrack
    ? (officer?.programType === "sample_school" ? "/schools/portal" : "/schools")
    : (officer?.referenceCode ? "/confirmation" : "/");

  const brandEyebrow = isSampleSchoolTrack ? "Ghana Education Service · GALOP AF2" : "Ghana Education Service";
  const brandTitle = isSampleSchoolTrack ? "DL · Sample Schools Portal" : "Differentiated Learning (DL) Nominations";

  return (
    <div className="shell">
      <header className="site-header">
        <Link
          to={brandTo}
          className="brand"
          aria-label="DL Nominations Home"
        >
          <img
            src="/dl-logo.jpg"
            alt="Differentiated Learning Logo"
            className="brand-logo"
          />
          <div>
            <p className="brand-eyebrow">{brandEyebrow}</p>
            <p className="brand-title">{brandTitle}</p>
          </div>
        </Link>

        <nav aria-label="Main Navigation">
          {isSampleSchoolTrack ? (
            /* Dedicated Sample Schools Navigation: Hides all other portals */
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
              <Link
                to={officer?.programType === "sample_school" ? "/schools/portal" : "/schools"}
                className="active"
                style={{ fontWeight: 700 }}
              >
                Sample Schools Portal
              </Link>
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
                    {officer.officerName?.split(" ")[0] || officer.fullName?.split(" ")[0] || "Participant"}
                    {officer.designation ? ` (${officer.designation})` : ""}
                  </span>
                  <button
                    type="button"
                    className="btn-nav-signout"
                    onClick={handleOfficerSignOut}
                    title="Sign out of sample schools portal"
                  >
                    (Sign out)
                  </button>
                </span>
              ) : (
                <Link
                  to="/signup"
                  style={{
                    fontSize: "0.78rem",
                    color: "rgba(255, 255, 255, 0.7)",
                    textDecoration: "none",
                    marginLeft: "0.25rem",
                    padding: "0.2rem 0.55rem",
                    borderRadius: "4px",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    transition: "all 0.15s ease",
                  }}
                  title="Return to National Master Trainers Portal"
                >
                  Exit to Main Portal →
                </Link>
              )}
            </div>
          ) : (
            /* General Navigation for Master Trainers & Admins */
            officer ? (
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
                  {officer.designation ? ` (${officer.designation})` : ""}
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
                  Nominee Portal
                </Link>
                <Link to="/schools" className={isSchools ? "active" : ""}>
                  Sample Schools
                </Link>
                <Link to="/trainer/login" className={isTrainer ? "active" : ""}>
                  Facilitator Portal
                </Link>
                <Link to="/admin" className={isAdmin ? "active" : ""}>
                  Admin
                </Link>
              </>
            )
          )}
        </nav>
      </header>
      <main id="main-content">{children}</main>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-col">
            <div className="site-footer-brand">
              <img src="/dl-logo.jpg" alt="GES DL Logo" />
              <h3>DL NOMINATIONS</h3>
            </div>
            <p>Facilitating the Differentiated Learning (DL) Programme for GALOP AF2 across the Republic of Ghana.</p>
          </div>
          
          <div className="site-footer-col">
            <div className="site-footer-heading">TECHNICAL CONTACT</div>
            <div className="site-footer-subheading">LEAD DEVELOPER</div>
            <div className="site-footer-val">Mark Anibrika</div>
            
            <div className="site-footer-subheading">PHONE / WHATSAPP</div>
            <div className="site-footer-val">+233 24 459 7593</div>
          </div>
          
          <div className="site-footer-col">
            <div className="site-footer-heading">ORGANIZATION</div>
            <p>Ghana Education Service (GES)</p>
            <p>Ministry of Education, Republic of Ghana</p>
            <p style={{ fontStyle: "italic", marginTop: "0.5rem", color: "#94a3b8" }}>"Quality Education for All"</p>
          </div>
        </div>
        
        <div className="site-footer-bottom">
          <div>&copy; {new Date().getFullYear()} Ghana Education Service. All rights reserved.</div>
          <div className="site-footer-bottom-links">
            <a href="#">Privacy Policy</a>
            <span>|</span>
            <a href="#">Terms of Use</a>
            <span>|</span>
            <span>Design by Mark Anibrika</span>
          </div>
        </div>
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
        <Route path="/schools" element={<SampleSchoolRegister />} />
        <Route path="/schools/register" element={<SampleSchoolRegister />} />
        <Route path="/sample-schools" element={<SampleSchoolRegister />} />
        <Route path="/schools/portal" element={<SampleSchoolPortal />} />
        <Route path="/sample-schools/portal" element={<SampleSchoolPortal />} />
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
