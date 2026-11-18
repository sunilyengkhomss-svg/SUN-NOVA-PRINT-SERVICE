# SUN-NOVA PRINT SERVICE — Backend & Cloudflare Workers Deployment Guide

This application uses **React + TypeScript + Vite** for the frontend and a **Cloudflare Workers (`npx wrangler deploy`) + Cloudflare D1 (SQLite) + Cloudflare R2** backend. In local development (`npm run dev`), `server.ts` runs local adapters (`node:sqlite` in `.local-backend/sunnova.db` and local disk R2 emulation in `.local-backend/r2/`).

- **Official Support Email:** `sopport.sunnovaprintservice@gmail.com`

---

## Step-by-Step: Fix Cloudflare Workers Dashboard `Deploy command` (`dist` → `npx wrangler deploy`)

If your Cloudflare Workers build passed `npm run build` and failed in ~2 seconds during **Deploying**, follow these exact steps:

1. Open the **Cloudflare Dashboard** → **Compute (Workers & Pages)** → **Workers & Pages**.
2. Click **`sun-nova-print-service`**.
3. Open the **Settings** tab → **Build** (or **Builds & Deployments**).
4. Click **Edit** next to **Build configuration**.
5. Verify **Build command** is `npm run build` and **Root directory** is `/`.
6. Change **Deploy command** from `dist` to:
   ```bash
   npx wrangler deploy
   ```
   *(Never enter `dist` here—Cloudflare Workers executes this field as a shell command and already reads `./dist` from `wrangler.jsonc`.)*
7. Click **Save**, then open **Deployments** and click **Retry deployment** (or push a new commit to `main`).

---

## Automated GitHub Actions Deploy (Recommended for Zero-Click D1 & R2 Sync)

This repository includes `.github/workflows/deploy.yml`, which automatically resolves/creates `sun-nova-db` (D1) and `sun-nova-media` (R2), applies `migrations/0001_init.sql` remotely, validates the build, syncs runtime secrets, and deploys via `npx wrangler deploy` on every push to `main`.

1. In your GitHub repository → **Settings → Secrets and variables → Actions → Secrets**, add:
   - `CLOUDFLARE_API_TOKEN` *(Cloudflare API Token with Workers Scripts, D1, and R2 Edit permissions)*
   - `CLOUDFLARE_ACCOUNT_ID` *(your Cloudflare Account ID)*
   - Optional runtime secrets pushed securely into Worker Secrets: `ADMIN_SETUP_TOKEN`, `RESEND_API_KEY`, `GEMINI_API_KEY`
2. Optional **Repository Variables** (`Settings → Secrets and variables → Actions → Variables`):
   - `VITE_SITE_URL`, `VITE_BASE_URL`, `EMAIL_FROM`, `D1_DATABASE_NAME`, `R2_BUCKET_NAME`, `BUNDLE_ORT_WASM`

---

## Build Variables vs. Worker Runtime Secrets

Cloudflare **Build variables** are only available during `npm run build`—they are **not** passed into your live Worker's `env` at runtime.

1. **Build Variables** *(Workers → Settings → Build → Build variables)*:
   - `VITE_SITE_URL` — optional canonical website URL (kept flexible across custom domains)
   - `VITE_BASE_URL` — optional base path (defaults to `/`)
   - `D1_DATABASE_ID` — your Cloudflare D1 UUID (injected into `wrangler.jsonc` before `npx wrangler deploy`)
   - `R2_BUCKET_NAME` — optional R2 bucket name (e.g. `sun-nova-media`)
   - `BUNDLE_ORT_WASM` — optional (`true` bundles the 22.81 MiB ONNX WASM file locally; **default is excluded** so background removal loads cleanly from CDN for fast ~10 MB deploys)

2. **Worker Runtime Secrets** *(Workers → Settings → Variables and Secrets, or `npm run cf:sync-secrets`)*:
   - `ADMIN_SETUP_TOKEN` — protects initial Super Admin registration and recovery at `/admin`
   - `RESEND_API_KEY` & `EMAIL_FROM` — sends password reset and customer reply emails
   - `GEMINI_API_KEY` — enables Ask AI Agent, OCR extractor, and Resume AI writer

> `wrangler.jsonc` sets `"keep_vars": true`, so `npx wrangler deploy` preserves all Dashboard-configured runtime variables and secrets.

---

## Validation, Secret Sync & CLI Commands

- **`npm run cf:setup`**: One-command local setup creating `sun-nova-db` (D1) & `sun-nova-media` (R2), running remote migrations, and writing bindings to `wrangler.jsonc`.
- **`npm run cf:ci-resolve`**: Non-interactive CI helper to look up/create D1 & R2 and apply remote migrations.
- **`npm run cf:validate`**: Validates `wrangler.jsonc`, bundles `src/worker.ts` (zero Node.js built-ins), and enforces Cloudflare's **25 MiB** per-asset cap.
- **`npm run cf:sync-secrets`**: Pushes runtime secrets securely via `npx wrangler secret bulk`.
- **`npm run cf:deploy`**: Runs binding sync, `cf:validate`, and `npx wrangler deploy`.
