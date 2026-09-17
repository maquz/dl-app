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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "DL Master Trainers Registration API" });
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

app.listen(PORT, () => {
  console.log(`DL Master Trainers API listening on http://localhost:${PORT}`);
});
