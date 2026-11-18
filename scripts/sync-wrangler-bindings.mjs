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

  if (!hasD1Env && !hasR2Env) {
    return;
  }

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

  if (hasR2Env || hasD1Env) {
    const targetBucket = r2Name || "sun-nova-media";
    const existingR2 = Array.isArray(config.r2_buckets) ? config.r2_buckets[0] : null;
    if (
      r2Name &&
      (!existingR2 ||
        existingR2.bucket_name !== targetBucket ||
        existingR2.binding !== "MEDIA_BUCKET")
    ) {
      config.r2_buckets = [
        {
          binding: "MEDIA_BUCKET",
          bucket_name: targetBucket,
        },
      ];
      changed = true;
    }
  }

  if (config.keep_vars !== true) {
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
}

main();
