import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { syncWorkerSecrets } from "./sync-worker-secrets.mjs";
import { validateWranglerProject } from "./validate-wrangler.mjs";

const rootDir = process.cwd();

async function main() {
  const rawArgs = process.argv.slice(2);
  const shouldBuild = rawArgs.includes("--build") || !fs.existsSync(path.join(rootDir, "dist", "index.html"));
  const shouldSyncSecrets =
    rawArgs.includes("--sync-secrets") || process.env.SYNC_SECRETS_ON_DEPLOY === "true";

  const wranglerForwardArgs = rawArgs.filter(
    (arg) => arg !== "--build" && arg !== "--sync-secrets"
  );

  if (shouldBuild) {
    console.log("[cf-deploy] Building frontend & syncing Wrangler bindings...");
    execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
  } else {
    execSync("node scripts/sync-wrangler-bindings.mjs", { cwd: rootDir, stdio: "inherit" });
  }

  await validateWranglerProject({ rootDir, requireDist: true, bundleWorker: true });

  if (shouldSyncSecrets) {
    syncWorkerSecrets({ rootDir, dryRun: wranglerForwardArgs.includes("--dry-run"), strict: false });
  }

  console.log("[cf-deploy] Deploying Cloudflare Worker via `npx wrangler deploy`...");
  const deployRes = spawnSync("npx", ["wrangler", "deploy", ...wranglerForwardArgs], {
    cwd: rootDir,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  process.exit(deployRes.status ?? 1);
}

main().catch((err) => {
  console.error(`[cf-deploy] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
