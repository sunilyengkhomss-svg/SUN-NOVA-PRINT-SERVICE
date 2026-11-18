import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const wranglerPath = path.join(rootDir, "wrangler.jsonc");

function stripJsonComments(raw) {
  let out = "";
  let inString = false;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    const next = raw[i + 1];

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
        out += ch;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inString) {
      out += ch;
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }

    if (ch === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    out += ch;
  }

  return out.replace(/,\s*([}\]])/g, "$1");
}

function isValidResourceId(val) {
  const trimmed = (val || "").trim();
  if (!trimmed) return false;
  if (trimmed.includes("<") || trimmed.includes("REPLACE_WITH")) return false;
  return /^[a-zA-Z0-9-]{8,}$/.test(trimmed);
}

function auditBuildEnvironment(config) {
  const hasD1 = Array.isArray(config.d1_databases) && config.d1_databases.length > 0;
  const hasR2 = Array.isArray(config.r2_buckets) && config.r2_buckets.length > 0;

  if (!hasD1 || !hasR2) {
    console.log(
      `[wrangler-sync] Notice: ${[
        !hasD1 ? "D1 (DB)" : null,
        !hasR2 ? "R2 (MEDIA_BUCKET)" : null,
      ]
        .filter(Boolean)
        .join(" & ")} not bound in wrangler.jsonc yet (fallback mode stays active; set D1_DATABASE_ID / R2_BUCKET_NAME in Build Variables or run npm run cf:setup).`
    );
  }

  const runtimeSecretNames = ["RESEND_API_KEY", "ADMIN_SETUP_TOKEN", "GEMINI_API_KEY"].filter(
    (key) => {
      const val = (process.env[key] || "").trim();
      return Boolean(val) && val !== "MY_GEMINI_API_KEY";
    }
  );
  if (runtimeSecretNames.length > 0 && process.env.CF_PAGES !== "1") {
    console.log(
      `[wrangler-sync] Reminder: Detected ${runtimeSecretNames.join(
        ", "
      )} in build env. Cloudflare Workers Build Variables are build-time only—also add them under Workers -> Settings -> Variables and Secrets (or run npm run cf:sync-secrets).`
    );
  }

  const base = (process.env.VITE_BASE_URL || "").trim();
  if (base && base !== "/" && !base.startsWith("/") && !/^https?:\/\//i.test(base)) {
    console.log(`[wrangler-sync] Normalized VITE_BASE_URL "${base}" -> "/${base.replace(/\/+$/, "")}/".`);
  }
}

function main() {
  if (!fs.existsSync(wranglerPath)) return;

  const d1Id = (process.env.D1_DATABASE_ID || process.env.CF_D1_DATABASE_ID || "").trim();
  const d1Name = (
    process.env.D1_DATABASE_NAME ||
    process.env.CF_D1_DATABASE_NAME ||
    "sun-nova-db"
  ).trim();
  const r2Name = (
    process.env.R2_BUCKET_NAME ||
    process.env.CF_R2_BUCKET_NAME ||
    ""
  ).trim();

  const hasD1Env = isValidResourceId(d1Id);
  const hasR2Env = Boolean(r2Name);

  const raw = fs.readFileSync(wranglerPath, "utf8");
  const config = JSON.parse(stripJsonComments(raw));
  let changed = false;

  if (hasD1Env) {
    const existing = Array.isArray(config.d1_databases) ? config.d1_databases[0] : null;
    if (
      !existing ||
      existing.database_id !== d1Id ||
      existing.database_name !== d1Name ||
      existing.binding !== "DB"
    ) {
      config.d1_databases = [
        {
          binding: "DB",
          database_name: d1Name,
          database_id: d1Id,
          migrations_dir: "migrations",
        },
      ];
      changed = true;
    }
  }

  if (hasR2Env) {
    const existingR2 = Array.isArray(config.r2_buckets) ? config.r2_buckets[0] : null;
    if (!existingR2 || existingR2.bucket_name !== r2Name || existingR2.binding !== "MEDIA_BUCKET") {
      config.r2_buckets = [
        {
          binding: "MEDIA_BUCKET",
          bucket_name: r2Name,
        },
      ];
      changed = true;
    }
  }

  if ((hasD1Env || hasR2Env) && config.keep_vars !== true) {
    config.keep_vars = true;
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(wranglerPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
    console.log(
      `[wrangler-sync] Updated wrangler.jsonc bindings from environment (${[
        hasD1Env ? `DB=${d1Name}` : null,
        hasR2Env ? `MEDIA_BUCKET=${r2Name}` : null,
      ]
        .filter(Boolean)
        .join(", ")}).`
    );
  }

  auditBuildEnvironment(config);
}

main();
