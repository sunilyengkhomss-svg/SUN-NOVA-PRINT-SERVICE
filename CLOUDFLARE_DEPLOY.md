# SUN-NOVA PRINT SERVICE — Backend & Cloudflare Workers Deployment Guide

This application uses **React + TypeScript + Vite** for the frontend and a **Cloudflare Workers (`npx wrangler deploy`) + Cloudflare D1 (SQLite) + Cloudflare R2** backend. In local development (`npm run dev`), `server.ts` runs local adapters (`node:sqlite` in `.local-backend/sunnova.db` and local disk R2 emulation in `.local-backend/r2/`).

- **Official Support Email:** `sopport.sunnovaprintservice@gmail.com`

---

## Option 1 (Primary): Automated GitHub Actions Deploy (Bypasses Dashboard `dist` Error)

This repository includes `.github/workflows/deploy.yml`, which handles everything automatically on every push to `main`:
- Typechecks (`npm run lint`) and builds a lightweight `~9.7 MB` SPA (pruning local ONNX WASM so background removal loads via CDN).
- Automatically resolves or creates `sun-nova-db` (D1) and `sun-nova-media` (R2).
- Applies remote D1 SQL migrations (`migrations/0001_init.sql`).
- Pushes Worker runtime secrets securely via `wrangler secret bulk`.
- Deploys cleanly via `npx wrangler deploy`.

### One-Time Setup (4 Steps)
1. **Disconnect Cloudflare's Failing Workers Build Trigger:**
   - Open **Cloudflare Dashboard → Compute (Workers & Pages) → Workers & Pages → `sun-nova-print-service`**.
   - Go to **Settings → Builds** and click **Disconnect** (under the connected Git repository). This stops Cloudflare from running the broken `Deploy command: dist` build on every commit.
2. **Create a Cloudflare API Token:**
   - Go to **My Profile → API Tokens → Create Token** (or **Create Custom Token**).
   - Grant **Account** permissions:
     - `Workers Scripts: Edit`
     - `D1: Edit`
     - `Workers R2 Storage: Edit`
     - `Account Settings: Read`
3. **Add GitHub Repository Secrets:**
   - In GitHub → **`sunilyengkhomss-svg/SUN-NOVA-PRINT-SERVICE` → Settings → Secrets and variables → Actions → Repository secrets**, add:
     - `CLOUDFLARE_API_TOKEN` *(required)*
     - `CLOUDFLARE_ACCOUNT_ID` *(required — found on your Cloudflare Workers & Pages overview sidebar)*
     - `ADMIN_SETUP_TOKEN` *(optional — protects initial `/admin` registration)*
     - `RESEND_API_KEY` *(optional — sends Admin Mail Desk replies & password reset emails)*
     - `GEMINI_API_KEY` *(optional — enables Ask AI Agent, OCR & Resume AI)*
   - Optional **Repository variables** (**Actions → Variables** tab): `VITE_SITE_URL`, `VITE_BASE_URL`, `EMAIL_FROM`, `D1_DATABASE_NAME`, `R2_BUCKET_NAME`, `BUNDLE_ORT_WASM`.
4. **Verify & View Live Deployments in GitHub Actions:**
   - Open your GitHub repo → **Actions** tab → **Deploy to Cloudflare Workers** (do not look at Cloudflare's old **Builds** tab once disconnected).
   - Each run prints a summary table showing D1 status, R2 status (`bound` or `d1-blob-fallback` if R2 is not enabled yet), and whether any legacy Cloudflare Workers Builds triggers remain attached.

---

## Option 2 (Alternative): Keep Cloudflare Workers Builds Enabled

If you prefer Cloudflare's built-in Git trigger instead of disconnecting it:
1. Open **Workers & Pages → `sun-nova-print-service` → Settings → Builds → Build configuration → Edit**.
2. Keep **Build command** as `npm run build` and **Root directory** as `/`.
3. Change **Deploy command** from `dist` to **`npx wrangler deploy`** and click **Save**.
4. Move `RESEND_API_KEY` and `ADMIN_SETUP_TOKEN` from **Build variables** into **Settings → Variables and Secrets**.
5. Optionally add `D1_DATABASE_ID` and `R2_BUCKET_NAME` under **Build variables**.

---

## CLI Validation & Management Scripts

- **`npm run cf:setup`**: One-command local setup creating `sun-nova-db` (D1) & `sun-nova-media` (R2), running remote migrations, and writing bindings to `wrangler.jsonc`.
- **`npm run cf:ci-resolve`**: Non-interactive CI helper to look up/create D1 & R2 (falling back cleanly to D1 blob storage if R2 is unavailable or unpermitted) and apply remote migrations.
- **`npm run cf:check-builds`** / **`npm run cf:disconnect-builds`**: Audits or attempts to disconnect legacy Cloudflare Workers Builds Git triggers using `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID`.
- **`npm run cf:validate`**: Validates `wrangler.jsonc`, bundles `src/worker.ts` (zero Node.js built-ins), and enforces Cloudflare's **25 MiB** per-asset cap.
- **`npm run cf:sync-secrets`**: Pushes runtime secrets securely via `npx wrangler secret bulk`.
- **`npm run cf:deploy`**: Runs binding sync, `cf:validate`, and `npx wrangler deploy`.
