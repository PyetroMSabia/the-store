import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("[Supabase] Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes no servidor.");
  }
}

export const supabase = createClient(supabaseUrl || "http://localhost:54321", supabaseKey || "anon-key-placeholder", {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
