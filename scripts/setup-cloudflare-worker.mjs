import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const wranglerPath = path.join(rootDir, "wrangler.jsonc");
const DB_NAME = process.env.D1_DATABASE_NAME || "sun-nova-db";
const BUCKET_NAME = process.env.R2_BUCKET_NAME || "sun-nova-media";

function run(cmd) {
  return execSync(cmd, { cwd: rootDir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
}

function stripJsonComments(raw) {
  return raw
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([}\]])/g, "$1");
}

function ensureD1Database() {
  console.log(`\n1. Checking Cloudflare D1 database "${DB_NAME}"...`);
  let dbList = [];
  try {
    const out = run("npx wrangler d1 list --json");
    dbList = JSON.parse(out);
  } catch (err) {
    console.error("Failed to run `npx wrangler d1 list`. Ensure you ran `npx wrangler login` first.");
    throw err;
  }

  let match = dbList.find((d) => d.name === DB_NAME);
  if (!match) {
    console.log(`   Creating D1 database "${DB_NAME}"...`);
    run(`npx wrangler d1 create ${DB_NAME}`);
    const refreshed = JSON.parse(run("npx wrangler d1 list --json"));
    match = refreshed.find((d) => d.name === DB_NAME);
  }

  if (!match?.uuid) {
    throw new Error(`Could not resolve UUID for D1 database "${DB_NAME}".`);
  }
  console.log(`   Using D1 "${DB_NAME}" (${match.uuid})`);
  return match.uuid;
}

function ensureR2Bucket() {
  console.log(`\n2. Checking Cloudflare R2 bucket "${BUCKET_NAME}"...`);
  try {
    const out = run("npx wrangler r2 bucket list");
    if (!out.includes(BUCKET_NAME)) {
      console.log(`   Creating R2 bucket "${BUCKET_NAME}"...`);
      run(`npx wrangler r2 bucket create ${BUCKET_NAME}`);
    }
  } catch {
    console.log(`   Creating R2 bucket "${BUCKET_NAME}"...`);
    try {
      run(`npx wrangler r2 bucket create ${BUCKET_NAME}`);
    } catch (err) {
      const msg = String(err?.stderr || err?.message || err);
      if (!msg.includes("already exists")) {
        throw err;
      }
    }
  }
  console.log(`   Using R2 bucket "${BUCKET_NAME}"`);
}

function updateWranglerConfig(dbId) {
  console.log("\n3. Updating wrangler.jsonc with persistent DB & MEDIA_BUCKET bindings...");
  const raw = fs.readFileSync(wranglerPath, "utf8");
  const config = JSON.parse(stripJsonComments(raw));
  config.keep_vars = true;
  config.observability = config.observability || { enabled: true };
  config.d1_databases = [
    {
      binding: "DB",
      database_name: DB_NAME,
      database_id: dbId,
      migrations_dir: "migrations",
    },
  ];
  config.r2_buckets = [
    {
      binding: "MEDIA_BUCKET",
      bucket_name: BUCKET_NAME,
    },
  ];
  fs.writeFileSync(wranglerPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log("   Saved wrangler.jsonc cleanly.");
}

function applyMigrations() {
  console.log(`\n4. Applying remote D1 schema migrations to "${DB_NAME}"...`);
  execSync(`npx wrangler d1 migrations apply ${DB_NAME} --remote`, {
    cwd: rootDir,
    stdio: "inherit",
  });
}

function main() {
  const dbId = ensureD1Database();
  ensureR2Bucket();
  updateWranglerConfig(dbId);
  applyMigrations();
  console.log(
    "\nSetup complete! Commit wrangler.jsonc and run `npm run deploy:worker` (or push to GitHub for Workers Builds)."
  );
}

main();
