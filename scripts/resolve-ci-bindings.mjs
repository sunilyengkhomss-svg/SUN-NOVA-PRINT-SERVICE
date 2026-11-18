import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const DB_NAME = (process.env.D1_DATABASE_NAME || "sun-nova-db").trim();
const BUCKET_NAME = (process.env.R2_BUCKET_NAME || "sun-nova-media").trim();

function runWrangler(args, opts = {}) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: rootDir,
    encoding: "utf8",
    stdio: opts.inherit ? "inherit" : ["pipe", "pipe", "pipe"],
    shell: process.platform === "win32",
  });
}

function appendGithubEnv(vars) {
  const envFile = process.env.GITHUB_ENV;
  if (!envFile) return;
  const lines = Object.entries(vars)
    .filter(([, val]) => Boolean(val))
    .map(([k, v]) => `${k}=${String(v).replace(/[\r\n]/g, "")}`);
  if (lines.length > 0) {
    fs.appendFileSync(envFile, `${lines.join("\n")}\n`, "utf8");
  }
}

function resolveOrCreateD1(dryRun) {
  const presetId = (process.env.D1_DATABASE_ID || process.env.CF_D1_DATABASE_ID || "").trim();
  if (presetId && /^[a-zA-Z0-9-]{8,}$/.test(presetId)) {
    console.log(`[cf-ci] Using provided D1_DATABASE_ID for "${DB_NAME}".`);
    return presetId;
  }

  if (dryRun) {
    console.log(`[cf-ci] Dry run — would resolve or create D1 database "${DB_NAME}".`);
    return "dry-run-d1-uuid";
  }

  const listRaw = runWrangler(["d1", "list", "--json"]);
  const list = JSON.parse(listRaw);
  let match = Array.isArray(list) ? list.find((d) => d.name === DB_NAME) : null;

  if (!match) {
    console.log(`[cf-ci] Creating D1 database "${DB_NAME}"...`);
    runWrangler(["d1", "create", DB_NAME], { inherit: true });
    const refreshed = JSON.parse(runWrangler(["d1", "list", "--json"]));
    match = Array.isArray(refreshed) ? refreshed.find((d) => d.name === DB_NAME) : null;
  }

  if (!match?.uuid) {
    throw new Error(`Unable to resolve UUID for D1 database "${DB_NAME}".`);
  }

  console.log(`[cf-ci] Resolved D1 "${DB_NAME}" (${match.uuid}).`);
  return match.uuid;
}

function isNonFatalR2Error(msg) {
  return /10042|enable R2|onboarding|not enabled|9109|10000|403|unauthorized|authentication error|permission/i.test(
    msg
  );
}

function resolveOrCreateR2(dryRun) {
  if (dryRun) {
    console.log(`[cf-ci] Dry run — would resolve or create R2 bucket "${BUCKET_NAME}".`);
    return BUCKET_NAME;
  }

  try {
    const out = runWrangler(["r2", "bucket", "list"]);
    if (out.includes(BUCKET_NAME)) {
      console.log(`[cf-ci] Resolved R2 bucket "${BUCKET_NAME}".`);
      return BUCKET_NAME;
    }
  } catch (err) {
    const msg = String(err?.stderr || err?.message || err);
    if (isNonFatalR2Error(msg)) {
      console.warn(
        `[cf-ci] Warning: R2 unavailable or token lacks R2 scope (${BUCKET_NAME} skipped; Worker will use D1 blob fallback until R2 is enabled/permitted).`
      );
      return "";
    }
  }

  console.log(`[cf-ci] Creating R2 bucket "${BUCKET_NAME}"...`);
  try {
    runWrangler(["r2", "bucket", "create", BUCKET_NAME], { inherit: true });
    return BUCKET_NAME;
  } catch (err) {
    const msg = String(err?.stderr || err?.message || err);
    if (msg.includes("already exists") || msg.includes("10004")) {
      return BUCKET_NAME;
    }
    if (isNonFatalR2Error(msg)) {
      console.warn(
        `[cf-ci] Warning: R2 unavailable or token lacks R2 scope (${BUCKET_NAME} skipped; Worker will use D1 blob fallback until R2 is enabled/permitted).`
      );
      return "";
    }
    throw err;
  }
}

function syncWranglerNow(dbId, bucketName, dryRun) {
  if (dryRun) {
    console.log(
      `[cf-ci] Dry run — would inject D1 (${DB_NAME})${bucketName ? ` & R2 (${bucketName})` : ""} into wrangler.jsonc before applying migrations.`
    );
    return;
  }

  execFileSync("node", ["scripts/sync-wrangler-bindings.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      D1_DATABASE_ID: dbId,
      D1_DATABASE_NAME: DB_NAME,
      R2_BUCKET_NAME: bucketName || "",
    },
    stdio: "inherit",
  });
}

function applyRemoteMigrations(dryRun) {
  if (dryRun) {
    console.log(`[cf-ci] Dry run — would apply remote D1 migrations to "${DB_NAME}".`);
    return;
  }
  console.log(`[cf-ci] Applying remote D1 migrations to "${DB_NAME}"...`);
  runWrangler(["d1", "migrations", "apply", DB_NAME, "--remote"], { inherit: true });
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipMigrations = process.argv.includes("--skip-migrations");

  if (!dryRun && (!process.env.CLOUDFLARE_API_TOKEN || !process.env.CLOUDFLARE_ACCOUNT_ID)) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required for non-interactive CI resolution."
    );
  }

  const dbId = resolveOrCreateD1(dryRun);
  const bucketName = resolveOrCreateR2(dryRun);

  // Must inject D1 binding into wrangler.jsonc BEFORE running `wrangler d1 migrations apply --remote`
  syncWranglerNow(dbId, bucketName, dryRun);

  if (!skipMigrations) {
    applyRemoteMigrations(dryRun);
  }

  appendGithubEnv({
    D1_DATABASE_ID: dbId,
    D1_DATABASE_NAME: DB_NAME,
    R2_BUCKET_NAME: bucketName,
    R2_STATUS: bucketName ? `bound (${bucketName})` : "d1-blob-fallback",
  });

  console.log(
    `[cf-ci] Exported CI bindings: D1=${DB_NAME}, R2=${bucketName || "fallback-only"}${
      process.env.GITHUB_ENV ? " (written to GITHUB_ENV)" : ""
    }.`
  );
}

try {
  main();
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`[cf-ci] ERROR: ${msg}`);
  if (/auth|token|permission|401|403|unable to authenticate/i.test(msg)) {
    console.error(
      "[cf-ci] Hint: Ensure CLOUDFLARE_API_TOKEN includes Account permissions: Workers Scripts (Edit), D1 (Edit), Workers R2 Storage (Edit), Account Settings (Read)."
    );
  }
  process.exit(1);
}
