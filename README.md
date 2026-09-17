# DL Master Trainer Nominee Registration — Web App

A full-stack conversion of the Ghana Education Service **"Registration Form for
Nominees (2026) – DL Master Trainers (AF2)"** PDF/Kobo form into a web application,
with a public registration form and a password-protected admin dashboard.

```
dl-app/
├── backend/     Node.js + Express API, SQLite database
├── frontend/    React (Vite) single-page app
└── README.md    (this file)
```

## 1. What was extracted from the source form

| PDF field | Web app field | Notes |
|---|---|---|
| Name of Officer | Text input, required | |
| Sex | Radio: Male / Female, required | |
| Phone Number | Text input, required | Validated to `000-000-0000` format, auto-formatted as you type |
| Region | Dropdown, required | 16 Ghana regions |
| District | Dependent dropdown, required | Enabled only after a region is picked |
| Place of Work (institution) | Text input, required | |
| Nominated role(s) | Checkboxes, required (≥1) | Numeracy / Literacy / IT Person — implemented as multi-select since the source wording ("roles... have you been nominated for") allows more than one |

**Important data note:** the source PDF only rendered the district list for the
**Ashanti** region (a cascading dropdown in the original Kobo form only shows
options for whichever region is currently selected, so the other 15 regions'
districts weren't visible in the exported PDF). `backend/data/districts.json`
contains the real Ashanti district list and empty arrays for the other regions.
If a user selects a region with no data yet, the form automatically falls back
to a free-text district field so nobody is blocked from registering — but you
should fill in the remaining regions in `districts.json` from the authoritative
GES/Kobo source before relying on this in production.

## 2. Architecture & design choices

- **Backend: Node.js + Express + SQLite (via `better-sqlite3`).** SQLite was
  chosen over MongoDB so the whole app runs with zero external services — just
  `npm install && npm start`. The schema, queries, and validation all live in
  a handful of files (`db.js`, `routes/registrations.js`) so swapping in
  MongoDB or Postgres later only touches those two files.
- **Frontend: React + Vite + react-router-dom**, no UI framework dependency,
  hand-written CSS using design tokens (`src/styles.css`) for a small,
  auditable bundle and full control over accessibility.
- **Validation happens twice:** in the browser (instant feedback, matching
  error messages under each field) and again on the server (`routes/registrations.js`),
  so the API can't be corrupted by a client that skips or bypasses the form.
- **Admin auth is a single shared password** stored in the server's `.env`
  and sent via a request header — intentionally simple for a small internal
  tool with one or a few admins. If more than a handful of people need admin
  access, replace `middleware/adminAuth.js` with real accounts + hashed
  passwords + sessions or JWTs.
- **Accessibility:** every input has a associated `<label>`, grouped controls
  use `<fieldset>`/`<legend>`, errors are announced via `role="alert"`,
  focus moves to the first invalid field on failed submit, focus rings are
  visible (`:focus-visible`), and color contrast follows WCAG AA on the
  navy/gold/paper palette.
- **Responsive:** the form and dashboard both collapse to a single column
  below 560–700px; the admin table scrolls horizontally on small screens
  rather than breaking layout.

## 3. Running locally

### Prerequisites
- Node.js 18+ and npm

### Backend

```bash
cd backend
cp .env.example .env      # edit ADMIN_PASSWORD before real use
npm install
npm start                 # or: npm run dev
```

The API starts on `http://localhost:4000` (configurable via `PORT` in `.env`)
and creates `backend/data/registrations.db` automatically on first run —
no database server to install.

### Frontend

In a separate terminal:

```bash
cd frontend
cp .env.example .env      # VITE_API_URL should point at the backend above
npm install
npm run dev
```

Visit `http://localhost:5173`. The registration form is at `/`, and the
admin dashboard is at `/admin` (login) → `/admin/dashboard`.

The default admin password (until you change `.env`) is `change-me-please`.

## 4. Using the admin dashboard

- **Search** by officer name, phone number, or institution (debounced,
  updates as you type).
- **Filter** by region or nominated role.
- **Export** the currently-loaded list to CSV or Excel (`.xlsx`) via the
  buttons in the toolbar — these hit `GET /api/registrations/export/csv`
  and `/export/xlsx` on the backend.
- **Delete** a registration with the row's "Delete" link (asks for
  confirmation first).

## 5. API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | none | Liveness check |
| GET | `/api/registrations/meta/regions` | none | Region → district reference data |
| POST | `/api/registrations` | none | Submit a new registration |
| GET | `/api/registrations?q=&region=&district=&role=` | admin | List/search/filter |
| DELETE | `/api/registrations/:id` | admin | Remove a registration |
| GET | `/api/registrations/export/csv` | admin | Download CSV |
| GET | `/api/registrations/export/xlsx` | admin | Download Excel |
| POST | `/api/admin/login` | none | Verify the admin password |

Admin-only routes require an `x-admin-password` request header matching
`ADMIN_PASSWORD` in the backend's `.env`.

## 6. Deployment

The frontend (static React build) and backend (stateful Node API + SQLite
file) deploy differently — Vercel/Netlify are built for static/serverless
frontends and don't keep a writable SQLite file around between requests, so
split the deployment:

### Frontend → Vercel or Netlify

```bash
cd frontend
npm run build        # outputs to frontend/dist
```

- **Vercel:** `vercel --prod` from the `frontend` folder, or import the repo
  in the Vercel dashboard with build command `npm run build` and output
  directory `dist`.
- **Netlify:** drag-and-drop the `dist` folder in the Netlify dashboard, or
  connect the repo with build command `npm run build` and publish directory
  `dist`.
- Set the environment variable `VITE_API_URL` in the platform's dashboard to
  your deployed backend's URL (e.g. `https://your-api.onrender.com/api`).

### Backend → a Node-friendly host (Render, Railway, Fly.io, a VPS, etc.)

Vercel/Netlify functions are stateless and don't provide persistent disk, so
SQLite (which writes to a local file) needs a host that keeps a container or
VM alive:

1. Push the `backend` folder to your host of choice (Render and Railway both
   support "deploy from Git" with a `npm install && npm start` build).
2. Set environment variables from `.env.example` in the host's dashboard:
   `PORT` (often auto-set by the platform), `DB_PATH`, `ADMIN_PASSWORD`,
   `CORS_ORIGIN` (your frontend's deployed URL).
3. Make sure the platform gives you a **persistent disk/volume** mounted at
   the path you set for `DB_PATH` — otherwise the SQLite file is wiped on
   every redeploy. Render and Railway both offer this as an add-on.
4. If you'd rather not manage a disk at all, swap SQLite for a managed
   database:
   - **MongoDB Atlas** (free tier) — replace `db.js` and the queries in
     `routes/registrations.js` with a Mongoose/`mongodb` driver equivalent.
   - **Postgres** (e.g. Supabase, Neon, Render Postgres) — same idea, using
     `pg` or an ORM like Prisma.
   The route handlers and validation logic don't need to change either way.

### Connecting to a different database later

Everything that touches the database lives in `backend/db.js` (connection +
schema) and `backend/routes/registrations.js` (queries). To move to MongoDB:
1. Replace `db.js` with a Mongoose connection + schema.
2. Replace the `db.prepare(...).run/.all(...)` calls in the routes with the
   equivalent MongoDB queries — the request/response shapes (JSON in, JSON
   out) don't need to change, so the frontend needs no changes at all.

## 7. Project structure

```
backend/
├── data/districts.json     Region → district reference data
├── middleware/adminAuth.js Shared-password admin guard
├── routes/
│   ├── admin.js             POST /api/admin/login
│   └── registrations.js     CRUD + search/filter + CSV/XLSX export
├── db.js                    SQLite connection + schema
├── server.js                Express app entry point
└── .env.example

frontend/
├── src/
│   ├── components/
│   │   ├── FormField.jsx           Label + input + error wrapper
│   │   ├── RegionDistrictSelect.jsx Dependent region/district dropdowns
│   │   └── RoleCheckboxGroup.jsx    Multi-select role checkboxes
│   ├── pages/
│   │   ├── RegistrationForm.jsx    Public form (route: /)
│   │   ├── Confirmation.jsx        Post-submit page (route: /confirmation)
│   │   ├── AdminLogin.jsx          Admin password gate (route: /admin)
│   │   └── AdminDashboard.jsx      Search/filter/export table (route: /admin/dashboard)
│   ├── api.js                      Fetch wrapper for the backend API
│   ├── App.jsx                     Routing + page shell
│   ├── main.jsx                    React entry point
│   └── styles.css                  Design tokens + all styling
└── .env.example
```
