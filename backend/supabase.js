const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = 
  process.env.SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL;

const SUPABASE_KEY = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.SUPABASE_KEY || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.startsWith("http")) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err.message);
  }
}

module.exports = supabase;
