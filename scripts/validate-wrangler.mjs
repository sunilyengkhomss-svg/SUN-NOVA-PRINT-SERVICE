import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CLOUDFLARE_MAX_ASSET_BYTES = 25 * 1024 * 1024; // 25 MiB per static asset

export function stripJsonComments(raw) {
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

function walkFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

export async function validateWranglerProject({
  rootDir = process.cwd(),
  requireDist = true,
  bundleWorker = true,
} = {}) {
  const wranglerPath = path.join(rootDir, "wrangler.jsonc");
  if (!fs.existsSync(wranglerPath)) {
    throw new Error(`Missing wrangler.jsonc in ${rootDir}`);
  }

  let config;
  try {
    config = JSON.parse(stripJsonComments(fs.readFileSync(wranglerPath, "utf8")));
  } catch (err) {
    throw new Error(
      `Invalid wrangler.jsonc syntax: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!config.name || typeof config.name !== "string") {
    throw new Error("wrangler.jsonc must define a Worker `name`.");
  }
  if (!config.main || typeof config.main !== "string") {
    throw new Error("wrangler.jsonc must define `main` entrypoint (e.g. src/worker.ts).");
  }
  if (!config.compatibility_date) {
    throw new Error("wrangler.jsonc must define `compatibility_date`.");
  }
  if (config.keep_vars !== true) {
    throw new Error(
      "wrangler.jsonc must set `\"keep_vars\": true` so `npx wrangler deploy` preserves dashboard variables."
    );
  }

  const mainPath = path.resolve(rootDir, config.main);
  if (!fs.existsSync(mainPath)) {
    throw new Error(`Worker entrypoint not found: ${config.main}`);
  }

  const assetsDir = config.assets?.directory || "./dist";
  const resolvedAssetsDir = path.resolve(rootDir, assetsDir);
  if (requireDist) {
    if (!fs.existsSync(resolvedAssetsDir)) {
      throw new Error(
        `Assets directory "${assetsDir}" not found. Run \`npm run build\` before deploying.`
      );
    }
    const indexPath = path.join(resolvedAssetsDir, "index.html");
    if (!fs.existsSync(indexPath)) {
      throw new Error(`Missing ${assetsDir}/index.html. Run \`npm run build\` first.`);
    }

    const files = walkFiles(resolvedAssetsDir);
    const oversized = [];
    const largeFiles = [];
    for (const filePath of files) {
      const size = fs.statSync(filePath).size;
      const rel = path.relative(resolvedAssetsDir, filePath);
      if (size >= CLOUDFLARE_MAX_ASSET_BYTES) {
        oversized.push({ rel, size });
      } else if (size >= 5 * 1024 * 1024) {
        largeFiles.push({ rel, size });
      }
    }

    if (oversized.length > 0) {
      const details = oversized
        .map((f) => `${f.rel} (${(f.size / (1024 * 1024)).toFixed(2)} MiB)`)
        .join(", ");
      throw new Error(
        `Static asset(s) exceed Cloudflare Workers 25 MiB per-file cap: ${details}. Set EXCLUDE_ORT_WASM=true when building to use CDN fallback.`
      );
    }

    for (const f of largeFiles) {
      console.log(
        `[cf-validate] Large asset check OK: ${f.rel} = ${(f.size / (1024 * 1024)).toFixed(2)} MiB (< 25 MiB Cloudflare cap).`
      );
    }
  }

  if (bundleWorker) {
    const esbuild = await import("esbuild");
    const result = await esbuild.build({
      entryPoints: [mainPath],
      bundle: true,
      format: "esm",
      platform: "browser",
      write: false,
      logLevel: "silent",
    });
    const outBytes = result.outputFiles?.[0]?.contents?.byteLength || 0;
    console.log(
      `[cf-validate] Worker bundle check OK: ${config.main} (${(outBytes / 1024).toFixed(1)} kB ESM, zero Node built-ins).`
    );
  }

  return {
    config,
    d1Bound: Array.isArray(config.d1_databases) && config.d1_databases.length > 0,
    r2Bound: Array.isArray(config.r2_buckets) && config.r2_buckets.length > 0,
  };
}

const isCli =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isCli) {
  const skipDist = process.argv.includes("--no-dist");
  validateWranglerProject({ requireDist: !skipDist })
    .then((summary) => {
      console.log(
        `[cf-validate] Validated Worker "${summary.config.name}" (D1=${summary.d1Bound ? "configured" : "fallback"}, R2=${summary.r2Bound ? "configured" : "fallback"}).`
      );
    })
    .catch((err) => {
      console.error(`[cf-validate] ERROR: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    });
}
