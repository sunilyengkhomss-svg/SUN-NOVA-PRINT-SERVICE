# SUN-NOVA PRINT SERVICE — Backend & Cloudflare Workers Deployment Guide

This application uses **React + TypeScript + Vite** for the frontend and a **Cloudflare Workers (`npx wrangler deploy`) + Cloudflare D1 (SQLite) + Cloudflare R2** backend. In local development (`npm run dev`), `server.ts` runs local adapters (`node:sqlite` in `.local-backend/sunnova.db` and local disk R2 emulation in `.local-backend/r2/`).

- **Official Support Email:** `sopport.sunnovaprintservice@gmail.com`

---

## Cloudflare Workers Builds Settings (Critical)

In **Cloudflare Dashboard → Workers & Pages → `sun-nova-print-service` → Settings → Builds & Deployments**:
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy` *(or `npm run cf:deploy`)*
- **Root directory:** `/`

> **Important:** Never put `dist` in **Deploy command**. Cloudflare Workers Builds executes that field as a shell command; `wrangler.jsonc` already tells Wrangler where `dist` lives via `"assets": { "directory": "./dist" }`.

---

## Build Variables vs. Worker Runtime Secrets

Cloudflare **Build variables** are only available while `npm run build` compiles Vite—they are **not** passed into your live Worker's `env` object at runtime.

1. **Build Variables** *(Build Settings → Build variables)*:
   - `VITE_SITE_URL` — optional canonical website URL (kept flexible across custom domains)
   - `VITE_BASE_URL` — optional base path (defaults to `/`)
   - `D1_DATABASE_ID` — your Cloudflare D1 UUID (injected into `wrangler.jsonc` before `npx wrangler deploy`)
   - `R2_BUCKET_NAME` — optional R2 bucket name (e.g. `sun-nova-media`)
   - `EXCLUDE_ORT_WASM` — optional (`true` strips the local **22.81 MiB** ONNX WASM file from `dist` so background removal loads via CDN; leave unset to keep it bundled under Cloudflare's 25 MiB per-asset limit)

2. **Worker Runtime Secrets** *(Workers → Settings → Variables and Secrets, or `npm run cf:sync-secrets`)*:
   - `ADMIN_SETUP_TOKEN` — protects initial Super Admin registration and recovery at `/admin`
   - `RESEND_API_KEY` & `EMAIL_FROM` — sends password reset and customer reply emails
   - `GEMINI_API_KEY` — enables Ask AI Agent, OCR extractor, and Resume AI writer

> `wrangler.jsonc` sets `"keep_vars": true`, so `npx wrangler deploy` preserves all Dashboard-configured runtime variables and secrets.

---

## Validation, Secret Sync & CLI Setup Commands

- **`npm run cf:setup`**: One-command local setup that creates `sun-nova-db` (D1) and `sun-nova-media` (R2), applies `migrations/0001_init.sql` (`--remote`), and persists bindings into `wrangler.jsonc`.
- **`npm run cf:validate`**: Validates `wrangler.jsonc`, bundles `src/worker.ts` to verify zero Node.js built-ins, and checks every file in `dist/` against Cloudflare's **25 MiB** per-asset limit.
- **`npm run cf:sync-secrets`**: Pushes non-empty runtime secrets (`GEMINI_API_KEY`, `ADMIN_SETUP_TOKEN`, `RESEND_API_KEY`, `EMAIL_FROM`) from your environment or `.env` securely via `npx wrangler secret bulk`.
- **`npm run cf:deploy`**: Runs binding sync, `cf:validate`, and `npx wrangler deploy`.

---

## First-Time Super Admin Setup (`/admin`)

No hardcoded plaintext admin password exists in the codebase.

1. Visit `/admin` on your deployed site.
2. Confirm **D1 Database (`DB`)** and **R2 Bucket (`MEDIA_BUCKET`)** show **Bound**, and check **Setup Guard (`ADMIN_SETUP_TOKEN`)** / **Mail Delivery (`RESEND_API_KEY`)** runtime status.
3. Enter your **Full Name**, **Admin Email** (`sopport.sunnovaprintservice@gmail.com` or your chosen owner email), and a **Strong Password** (minimum 8 characters) to provision `super_admin`.
