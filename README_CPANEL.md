# GHANA EDUCATION SERVICE (GES) — DIFFERENTIATED LEARNING (DL)
## 100% Self-Hosted cPanel Deployment Guide (codecasticgh.com)

This package contains the complete, production-ready system to host the **GES Differentiated Learning Portal** 100% inside your cPanel hosting account with **zero external cloud services** (no Supabase, no Vercel, no Render, no cloud buckets).

---

### Package Summary

| Component | Technology | cPanel Location | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend** | React SPA (Vite) | `public_html/` | Fast, mobile-responsive portal UI |
| **Backend API** | PHP 7.4 - 8.3+ (PDO) | `public_html/api/` | Authentication, registration, assessments, grading |
| **Database** | MySQL / MariaDB | cPanel MySQL | All 1,341 registrations, 210 sample schools, 148 questions |
| **Resources** | Server Files | `public_html/resources/` | All 47 curriculum workbooks, guides, readers, tools (~180 MB) |
| **Routing** | Apache / LiteSpeed | `public_html/.htaccess` | Directs `/api/*` to PHP and SPA routes to `index.html` |

---

### Step 1: Create MySQL Database & User in cPanel

1. Log into your cPanel dashboard (`https://codecasticgh.com:2083`).
2. Navigate to **Databases** &rarr; **MySQL® Database Wizard**.
3. **Create Database**: Enter a database name (e.g., `dl_app`). cPanel will prefix it with your account username, e.g., `codecastic_dl_app`. Click **Next Step**.
4. **Create Database User**: Enter a username (e.g., `dl_user`) and generate a secure password (e.g., `DL_ges_2026_SecurePass!`). Click **Create User**.
5. **Add Privileges**: Check the **ALL PRIVILEGES** checkbox and click **Make Changes**.
6. **Note down your credentials**:
   - **Database Name:** (e.g., `codecastic_dl_app`)
   - **Database User:** (e.g., `codecastic_dl_user`)
   - **Database Password:** (the password you set above)
   - **Database Host:** `localhost` (standard for cPanel)

---

### Step 2: Import the Database (`database.sql`)

1. In cPanel, go to **Databases** &rarr; **phpMyAdmin**.
2. Select your newly created database (`codecastic_dl_app`) from the left sidebar.
3. Click on the **Import** tab at the top.
4. Click **Choose File** and select `database.sql` (found inside the zip or package).
5. Ensure the character set is set to **utf-8** and format is **SQL**.
6. Click **Import** (or **Go**) at the bottom.
7. You should see a green success message confirming that all 10 tables were created and populated:
   - `cohorts` (6 cohorts)
   - `sample_schools` (210 sample schools)
   - `national_trainers` (11 facilitators)
   - `admins` (9 administrators)
   - `officers` (6 officer accounts)
   - `registrations` (1,341 verified registrations)
   - `assessments` (5 assessments including GALOP AF2 Sample Schools)
   - `assessment_questions` (148 shuffled questions)
   - `assessment_submissions` (test records)
   - `password_resets`

---

### Step 3: Upload Website Files to cPanel File Manager

1. In cPanel, open **Files** &rarr; **File Manager**.
2. Navigate into the **`public_html/`** directory (or your target subdomain directory).
3. Click **Upload** in the top toolbar.
4. Upload **`dl-app-cpanel-full.zip`** (129 MB).
5. Once uploaded, right-click `dl-app-cpanel-full.zip` and select **Extract** &rarr; Extract to `/public_html`.
6. Make sure the files are extracted directly into `public_html/`, such that:
   - `public_html/index.html` exists
   - `public_html/assets/` exists
   - `public_html/api/` exists
   - `public_html/resources/` exists
   - `public_html/.htaccess` exists
7. *(Optional)* Delete `dl-app-cpanel-full.zip` and `database.sql` from `public_html` to save disk space.

> **Tip:** If hidden files (like `.htaccess`) are not visible in cPanel File Manager, click **Settings** (top right of File Manager), check **Show Hidden Files (dotfiles)**, and click **Save**.

---

### Step 4: Configure Database Connection (`api/config.php`)

1. In cPanel File Manager, open the **`api/`** folder.
2. Right-click **`config.php`** and select **Edit**.
3. Update lines 15–18 with the MySQL credentials from Step 1:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'codecastic_dl_app');      // Your cPanel DB name
   define('DB_USER', 'codecastic_dl_user');     // Your cPanel DB user
   define('DB_PASS', 'YourActualPasswordHere'); // Your cPanel DB password
   ```
4. *(Optional)* Change the `ADMIN_MASTER_PASSWORD` on line 22 if desired.
5. Click **Save Changes**.

---

### Step 5: Test & Verify Everything

1. **Verify Backend Health & DB Connection:**
   Open in your browser:
   `https://codecasticgh.com/api/health`
   You should see:
   ```json
   {
     "status": "ok",
     "service": "GES DL Master Trainers & Sample Schools API (cPanel Self-Hosted)",
     "database": "connected",
     "registrationsCount": 1341,
     "serverEnvironment": "cPanel Apache/LiteSpeed + MySQL + PHP PDO",
     "cloudServices": "0% (100% Self-Hosted)"
   }
   ```

2. **Verify Frontend Application:**
   Open:
   `https://codecasticgh.com`
   The main portal loads instantly with full branding.

3. **Verify Resources Download:**
   Open:
   `https://codecasticgh.com/resources` (or click "Resources" tab in the portal).
   All 47 educational guides and workbooks will be listed and open immediately with zero loading lag.

4. **Verify Sample Schools Portal:**
   Navigate to:
   `https://codecasticgh.com/schools`
   - Select Region, District, and School (all 210 sample schools are available).
   - Enter a phone number (e.g. `024-485-0674`).
   - Access the diagnostic pre-test and post-test immediately.

5. **Verify System Admin Dashboard:**
   Navigate to:
   `https://codecasticgh.com/admin`
   - Email: `admin@ges.gov.gh`
   - Password: `change-me-please` (or `GES-DL-Admin-2026`)
   - Check all cards, registrations, real-time statistics, bulk check-in, and CSV/Excel exports.

---

### Administrator & Facilitator Default Passwords

- **Super Administrator:**
  - Email: `admin@ges.gov.gh`
  - Password: `change-me-please` or `GES-DL-Admin-2026`
- **National Master Trainers (Facilitators):**
  - Identifier: Facilitator contact number (e.g., `020-860-7530` or `0208607530`)
  - Password: Their 10-digit contact number or `trainer2026`
- **Participants:**
  - Verified by their 10-digit phone number (e.g., `024-498-9910` or `0244989910`).

---

### Adding New Resources / PDF Documents in the Future

Whenever you have new training materials, facilitators' guides, or audio/video files:
1. Open cPanel **File Manager** &rarr; navigate to `public_html/resources/`.
2. Choose a category folder (e.g., `Teacher Guides`, `Assessment Tools`, or create a new folder).
3. Upload the file.
4. The DL Portal will automatically discover and display the new file on the website without needing any database update or code changes!
