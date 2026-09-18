require("dotenv").config();
const express = require("express");
const cors = require("cors");

const registrationsRouter = require("./routes/registrations");
const adminRouter = require("./routes/admin");
const authRouter = require("./routes/auth");
const cohortsRouter = require("./routes/cohorts");
const nationalTrainersRouter = require("./routes/nationalTrainers");
const assessmentsRouter = require("./routes/assessments");

const app = express();
const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

app.get("/api/health", async (req, res) => {
  const supabase = require("./supabase");
  const BUILD_VERSION = "2026-09-18-v5";  // bump to force Vercel redeploy
  let supabaseStatus = "not configured";
  let supabaseCount = null;
  if (supabase) {
    try {
      const { count, error } = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true });
      if (!error) {
        supabaseStatus = "connected";
        supabaseCount = count;
      } else {
        supabaseStatus = "error: " + error.message;
      }
    } catch (e) {
      supabaseStatus = "error: " + e.message;
    }
  }
  res.json({
    status: "ok",
    service: "DL Master Trainers Registration API",
    build: BUILD_VERSION,
    supabase: supabaseStatus,
    supabaseRegistrations: supabaseCount,
    env: process.env.VERCEL ? "vercel" : "local",
  });
});

app.use("/api/auth", authRouter);
app.use("/api/registrations", registrationsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/cohorts", cohortsRouter);
app.use("/api/national-trainers", nationalTrainersRouter);
app.use("/api/assessments", assessmentsRouter);

// Basic 404 + error handling
app.use((req, res) => res.status(404).json({ error: "Not found" }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`DL Master Trainers API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
