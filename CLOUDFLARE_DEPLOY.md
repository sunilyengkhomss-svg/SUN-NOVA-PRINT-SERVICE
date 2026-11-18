# SUN-NOVA PRINT SERVICE — Backend & Cloudflare Workers Deployment Guide

This application uses **React + TypeScript + Vite** for the frontend and a **Cloudflare Workers (`npx wrangler deploy`) + Cloudflare D1 (SQLite) + Cloudflare R2** backend. In local development (`npm run dev`), `server.ts` runs local adapters (`node:sqlite` in `.local-backend/sunnova.db` and local disk R2 emulation in `.local-backend/r2/`).

- **Official Support Email:** `sopport.sunnovaprintservice@gmail.com`

---

## Why `npx wrangler deploy` Can Drop Dashboard Bindings (And How This Project Fixes It)

Cloudflare Workers Builds executes:
- **Build command:** `npm run build`
- **Deploy command:** `npx wrangler deploy`

Because Wrangler treats `wrangler.jsonc` as the **single source of truth**, any D1/R2 binding added only in the Cloudflare Dashboard UI is removed on the next Git push unless it is present in `wrangler.jsonc` at deploy time.

This repository solves that in three ways:
1. **`keep_vars: true` in `wrangler.jsonc`:** Prevents `npx wrangler deploy` from wiping Dashboard-configured environment variables (`GEMINI_API_KEY`, `VITE_SITE_URL`, `RESEND_API_KEY`, etc.).
2. **Pre-build Binding Sync (`npm run build`):** Automatically injects `d1_databases` (`DB`) and `r2_buckets` (`MEDIA_BUCKET`) into `wrangler.jsonc` right before `npx wrangler deploy` whenever you set `D1_DATABASE_ID` (and optional `R2_BUCKET_NAME`) in **Cloudflare Build Variables**.
3. **Zero-503 Storage Resilience:** Even before D1/R2 are attached, `/api/*` falls back cleanly (`d1+d1blob` or `memory-fallback`) and auto-creates all 14 tables atomically on first request (`ensureSchemaTables`).

---

## Option A (Recommended): Cloudflare Workers (`npx wrangler deploy`)

### Method 1 — One-Command CLI Setup (Permanent `wrangler.jsonc` Bindings)
Run once from your machine:
```bash
npx wrangler login
npm run cf:setup
```
This creates `sun-nova-db` (D1) and `sun-nova-media` (R2), applies `migrations/0001_init.sql` remotely, and writes real `"d1_databases"` and `"r2_buckets"` blocks into `wrangler.jsonc`. Commit and push `wrangler.jsonc`—every future Workers Build automatically keeps `DB` and `MEDIA_BUCKET` bound.

### Method 2 — Cloudflare Dashboard Build Variables (No Code Edits)
1. Create your D1 database (`sun-nova-db`) and R2 bucket (`sun-nova-media`) in the Cloudflare Dashboard (or via `npx wrangler d1 create sun-nova-db` and `npx wrangler r2 bucket create sun-nova-media`).
2. Copy your D1 **Database ID (UUID)**.
3. In **Cloudflare Dashboard → Workers & Pages → `sun-nova-print-service` → Settings → Builds & Deployments → Build variables**, add:
   - `D1_DATABASE_ID` = `<your-d1-database-uuid>`
   - `R2_BUCKET_NAME` = `sun-nova-media` *(optional, defaults to `sun-nova-media`)*
   - `D1_DATABASE_NAME` = `sun-nova-db` *(optional, defaults to `sun-nova-db`)*
4. Trigger a redeploy. During `npm run build`, `scripts/sync-wrangler-bindings.mjs` injects `DB` and `MEDIA_BUCKET` into `wrangler.jsonc` right before `npx wrangler deploy` executes.

### Runtime Secrets (Optional)
Configure in **Workers & Pages → Settings → Variables and Secrets** (or `npx wrangler secret put`):
- `GEMINI_API_KEY` — enables Ask AI Agent, OCR extractor, and Resume AI writer
- `ADMIN_SETUP_TOKEN` — protects initial Super Admin registration at `/admin`
- `RESEND_API_KEY` & `EMAIL_FROM` — sends password reset and customer reply emails
- `VITE_SITE_URL` — optional canonical website URL (kept flexible across custom domains)

---

## Option B: Cloudflare Pages with Functions

1. **Build command:** `npm run build`
2. **Build output directory:** `dist`
3. Bind **D1 Database** (`DB` → `sun-nova-db`) and **R2 Bucket** (`MEDIA_BUCKET` → `sun-nova-media`) in **Pages → Settings → Functions → Bindings** (Production and Preview), then redeploy.

---

## First-Time Super Admin Setup (`/admin`)

No hardcoded plaintext admin password exists in the codebase.

1. Visit `/admin` on your deployed site.
2. Confirm **D1 Database (`DB`)** and **R2 Bucket (`MEDIA_BUCKET`)** both show **Bound** in the status panel.
3. Enter your **Full Name**, **Admin Email** (`sopport.sunnovaprintservice@gmail.com` or your chosen owner email), and a **Strong Password** (minimum 8 characters) to provision `super_admin`.
