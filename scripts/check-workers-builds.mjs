import fs from "node:fs";
import path from "node:path";
import { stripJsonComments } from "./validate-wrangler.mjs";

const rootDir = process.cwd();

function getWorkerName() {
  const wranglerPath = path.join(rootDir, "wrangler.jsonc");
  if (!fs.existsSync(wranglerPath)) return "sun-nova-print-service";
  try {
    const parsed = JSON.parse(stripJsonComments(fs.readFileSync(wranglerPath, "utf8")));
    return parsed?.name || "sun-nova-print-service";
  } catch {
    return "sun-nova-print-service";
  }
}

function readEnvValue(key) {
  const fromEnv = (process.env[key] || "").trim();
  if (fromEnv) return fromEnv;
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return "";
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    if (trimmed.slice(0, eqIdx).trim() !== key) continue;
    return trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return "";
}

async function cfRequest(token, url, method = "GET") {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { ok: res.ok, status: res.status, body };
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

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const disconnect = process.argv.includes("--disconnect");
  const warnOnly = process.argv.includes("--warn-only");
  const workerName = getWorkerName();
  const dashboardPath = `Cloudflare Dashboard -> Compute (Workers & Pages) -> ${workerName} -> Settings -> Builds -> Disconnect`;

  if (dryRun) {
    console.log(
      `[cf-builds] Dry run — would audit legacy Workers Builds triggers for "${workerName}"${
        disconnect ? " and disconnect active Git triggers if permitted" : ""
      }.`
    );
    appendGithubEnv({ LEGACY_CF_BUILDS_STATUS: "dry-run" });
    return;
  }

  const token = readEnvValue("CLOUDFLARE_API_TOKEN");
  const accountId = readEnvValue("CLOUDFLARE_ACCOUNT_ID");

  if (!token || !accountId) {
    const msg = `CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are not set. Disconnect legacy Git builds manually at: ${dashboardPath}`;
    if (warnOnly) {
      console.log(`[cf-builds] ${msg}`);
      appendGithubEnv({ LEGACY_CF_BUILDS_STATUS: "unknown (no credentials)" });
      return;
    }
    throw new Error(msg);
  }

  const candidatePaths = [
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      accountId
    )}/workers/scripts/${encodeURIComponent(workerName)}/builds/triggers`,
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
      accountId
    )}/builds/workers/${encodeURIComponent(workerName)}/triggers`,
  ];

  let res = null;
  let matchedBase = "";
  for (const url of candidatePaths) {
    const attempt = await cfRequest(token, url, "GET");
    res = attempt;
    if (attempt.ok) {
      matchedBase = url;
      break;
    }
    if (attempt.status !== 404) {
      break;
    }
  }

  if (!res || !res.ok) {
    const status = res?.status ?? 0;
    if (status === 401 || status === 403 || status === 404) {
      console.log(
        `[cf-builds] Workers Builds API unavailable for this token/worker (HTTP ${status}). To stop failing 'dist' builds on Cloudflare, click Disconnect at: ${dashboardPath}`
      );
      appendGithubEnv({
        LEGACY_CF_BUILDS_STATUS: `manual-disconnect-needed (HTTP ${status})`,
      });
      return;
    }
    const errMsg = `Cloudflare API returned HTTP ${status} while checking Workers Builds triggers.`;
    if (warnOnly) {
      console.warn(`[cf-builds] Warning: ${errMsg}`);
      appendGithubEnv({ LEGACY_CF_BUILDS_STATUS: "manual-disconnect-needed" });
      return;
    }
    throw new Error(errMsg);
  }

  const triggers = Array.isArray(res.body?.result) ? res.body.result : [];
  if (triggers.length === 0) {
    console.log(`[cf-builds] OK: No legacy Cloudflare Workers Builds Git triggers remain on "${workerName}".`);
    appendGithubEnv({ LEGACY_CF_BUILDS_STATUS: "disconnected" });
    return;
  }

  console.warn(
    `[cf-builds] Notice: Found ${triggers.length} active Cloudflare Workers Builds trigger(s) on "${workerName}".`
  );

  if (!disconnect) {
    console.warn(`[cf-builds] Run \`npm run cf:disconnect-builds\` or click Disconnect at: ${dashboardPath}`);
    appendGithubEnv({
      LEGACY_CF_BUILDS_STATUS: `active (${triggers.length} trigger(s) — disconnect in Cloudflare Settings -> Builds)`,
    });
    return;
  }

  let removed = 0;
  for (const trigger of triggers) {
    const triggerId = trigger?.trigger_uuid || trigger?.id;
    if (!triggerId) continue;
    const delUrls = [
      `${matchedBase}/${encodeURIComponent(triggerId)}`,
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        accountId
      )}/builds/triggers/${encodeURIComponent(triggerId)}`,
    ];
    let deleted = false;
    let lastStatus = 0;
    for (const delUrl of delUrls) {
      const delRes = await cfRequest(token, delUrl, "DELETE");
      lastStatus = delRes.status;
      if (delRes.ok) {
        deleted = true;
        break;
      }
    }
    if (deleted) {
      removed += 1;
      console.log(`[cf-builds] Disconnected legacy Workers Builds trigger ${triggerId}.`);
    } else {
      console.warn(
        `[cf-builds] Could not delete trigger ${triggerId} via API (HTTP ${lastStatus}). Disconnect manually at: ${dashboardPath}`
      );
    }
  }

  appendGithubEnv({
    LEGACY_CF_BUILDS_STATUS:
      removed === triggers.length
        ? "disconnected"
        : `active (${triggers.length - removed} remaining — disconnect in Dashboard)`,
  });
}

main().catch((err) => {
  console.error(`[cf-builds] ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
