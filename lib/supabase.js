import "server-only";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith("http") &&
  supabaseKey &&
  supabaseKey.length > 20
);

if (!isSupabaseConfigured) {
  console.warn(
    "[the-store] AVISO: SUPABASE_URL ou chaves do Supabase não configuradas. Operando com fallback local resiliente."
  );
}

// Cliente Supabase resiliente (nunca crasheia o carregamento do módulo se as variáveis estiverem ausentes)
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : "https://placeholder-project.supabase.co",
  isSupabaseConfigured ? supabaseKey : "placeholder-anon-key",
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

