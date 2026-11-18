import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SECRET_KEYS = ["GEMINI_API_KEY", "ADMIN_SETUP_TOKEN", "RESEND_API_KEY", "EMAIL_FROM"];
const PLACEHOLDERS = new Set(["MY_GEMINI_API_KEY", "CHANGE_ME", "<YOUR_KEY>"]);

function parseDotEnv(rootDir) {
  const envPath = path.join(rootDir, ".env");
  const parsed = {};
  if (!fs.existsSync(envPath)) return parsed;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    parsed[key] = val;
  }
  return parsed;
}

export function collectRuntimeSecrets(rootDir = process.cwd(), env = process.env) {
  const dotEnv = parseDotEnv(rootDir);
  const secrets = {};

  for (const key of SECRET_KEYS) {
    const raw = (env[key] ?? dotEnv[key] ?? "").trim();
    if (!raw || PLACEHOLDERS.has(raw) || (raw.startsWith("<") && raw.endsWith(">"))) {
      continue;
    }
    secrets[key] = raw;
  }

  return secrets;
}

export function syncWorkerSecrets({
  rootDir = process.cwd(),
  dryRun = false,
  strict = false,
} = {}) {
  const secrets = collectRuntimeSecrets(rootDir);
  const keys = Object.keys(secrets);

  if (keys.length === 0) {
    console.log(
      "[cf-secrets] No non-empty runtime secrets found in env or .env (GEMINI_API_KEY, ADMIN_SETUP_TOKEN, RESEND_API_KEY, EMAIL_FROM)."
    );
    return { syncedKeys: [], skipped: true };
  }

  if (dryRun) {
    console.log(`[cf-secrets] Dry run — ready to push ${keys.length} secret(s): ${keys.join(", ")}.`);
    return { syncedKeys: keys, skipped: false, dryRun: true };
  }

  console.log(`[cf-secrets] Syncing ${keys.length} runtime secret(s) to Worker: ${keys.join(", ")}...`);
  const res = spawnSync("npx", ["wrangler", "secret", "bulk"], {
    cwd: rootDir,
    input: JSON.stringify(secrets),
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    shell: process.platform === "win32",
  });

  if (res.status !== 0) {
    const msg = `wrangler secret bulk exited with status ${res.status ?? 1}. Ensure CLOUDFLARE_API_TOKEN or \`npx wrangler login\` is active.`;
    if (strict) {
      throw new Error(msg);
    }
    console.warn(`[cf-secrets] Warning: ${msg}`);
    return { syncedKeys: [], skipped: false, failed: true };
  }

  return { syncedKeys: keys, skipped: false };
}

const isCli =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  const dryRun = process.argv.includes("--dry-run");
  const strict = !process.argv.includes("--warn-only");
  try {
    syncWorkerSecrets({ dryRun, strict });
  } catch (err) {
    console.error(`[cf-secrets] ERROR: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
