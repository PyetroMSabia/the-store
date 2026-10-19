import fs from "fs";
import { createClient } from "@supabase/supabase-js";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";

// Carrega .env.local se existir
if (fs.existsSync(".env.local")) {
  const content = fs.readFileSync(".env.local", "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      const v = trimmed.slice(eqIdx + 1).trim();
      process.env[k] = v;
    }
  }
}


const adminEmail = (process.env.ADMIN_EMAIL || "thestore@gmail.com").trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || "TheStore2026@";
const adminName = process.env.ADMIN_NAME?.trim() || "Curador The Store";

// Gera hash scrypt
const PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEYLEN = 64;
const salt = crypto.randomBytes(16);
const key = crypto.scryptSync(String(adminPassword).normalize("NFKC"), salt, KEYLEN, PARAMS);
const hash = "scrypt$" + PARAMS.N + "$" + PARAMS.r + "$" + PARAMS.p + "$" + salt.toString("base64") + "$" + key.toString("base64");

async function main() {
  console.log("[the-store] Sincronizando novo administrador:", adminEmail);

  // 1. SQLite Local
  const dbPaths = [
    "data/the-store.db",
    (process.env.TEMP || "C:/Users/pyetr/AppData/Local/Temp") + "/the-store.db",
    "/tmp/the-store.db"
  ];

  for (const p of dbPaths) {
    if (fs.existsSync(p)) {
      try {
        const db = new DatabaseSync(p);
        const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(adminEmail);
        if (existing) {
          db.prepare("UPDATE users SET password_hash = ?, role = 'ADMIN', name = ? WHERE id = ?").run(hash, adminName, existing.id);
          console.log(`[the-store] Admin atualizado com sucesso no SQLite (${p})`);
        } else {
          db.prepare("INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, 'ADMIN')").run(
            "admin-master",
            adminName,
            adminEmail,
            hash
          );
          console.log(`[the-store] Admin inserido com sucesso no SQLite (${p})`);
        }
        db.prepare("DELETE FROM users WHERE email = 'admin@thestore.local'").run();
        console.log(`[the-store] Conta antiga admin@thestore.local removida do SQLite (${p})`);
      } catch (err) {
        console.warn(`[the-store] Aviso no SQLite (${p}):`, err.message);
      }
    }
  }

  // 2. Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: existingUser, error: checkErr } = await supabase
        .from("users")
        .select("id, email, role")
        .ilike("email", adminEmail)
        .maybeSingle();

      if (existingUser) {
        const { error: updErr } = await supabase
          .from("users")
          .update({ password_hash: hash, role: "ADMIN", name: adminName })
          .eq("id", existingUser.id);
        if (updErr) console.warn("[the-store] Erro ao atualizar no Supabase:", updErr.message);
        else console.log("[the-store] Admin atualizado com sucesso no Supabase!");
      } else {
        const { error: insErr } = await supabase
          .from("users")
          .upsert({
            id: "admin-master",
            name: adminName,
            email: adminEmail,
            password_hash: hash,
            role: "ADMIN",
          }, { onConflict: "email" });
        if (insErr) console.warn("[the-store] Erro ao inserir no Supabase:", insErr.message);
        else console.log("[the-store] Admin inserido com sucesso no Supabase!");
      }

      // Remove a conta antiga do Supabase
      const { error: delErr } = await supabase
        .from("users")
        .delete()
        .eq("email", "admin@thestore.local");
      if (delErr) console.warn("[the-store] Aviso ao remover conta antiga no Supabase:", delErr.message);
      else console.log("[the-store] Conta antiga admin@thestore.local removida do Supabase!");
    } catch (supaErr) {
      console.warn("[the-store] Erro ao conectar com o Supabase:", supaErr.message);
    }
  }
}

main().then(() => console.log("[the-store] Processo de sincronização concluído com sucesso.")).catch(console.error);
