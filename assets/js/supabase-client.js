import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Replace these two placeholders with values from Supabase Dashboard > Settings > API.
// The publishable/anon key is safe for browser code only when RLS is enabled.
// Never put a service-role key, database password, or any other secret in this file.
export const SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL";
export const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_") &&
  !SUPABASE_PUBLISHABLE_KEY.includes("YOUR_");

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Add the project URL and publishable key to assets/js/supabase-client.js."
    );
  }

  return supabase;
}
