const { createClient } = require("@supabase/supabase-js");

// Primary: environment variables (set in Vercel Dashboard / local .env)
// Fallback: hardcoded project credentials (anon key is safe for public use —
//   all data access is controlled by Supabase Row-Level Security policies)
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://riuqfrklbzkqagafafhn.supabase.co";

const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdXFmcmtsYnprcWFnYWZhZmhuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk2MjMxMjcsImV4cCI6MjEwNTE5OTEyN30.tfF-QjcQQnpXh8Ueri2nzieGzt9TmDa2HmVpA8Q_j5w";

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("http")) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
    console.log("✓ Supabase client initialized:", SUPABASE_URL.split(".")[0].replace("https://", ""));
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err.message);
  }
}

module.exports = supabase;
