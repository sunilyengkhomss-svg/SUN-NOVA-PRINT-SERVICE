# SUN-NOVA PRINT SERVICE — Backend & Cloudflare Deployment Guide

This application uses **React + TypeScript + Vite** for the frontend and a **Cloudflare Pages Functions / Cloudflare Workers + Cloudflare D1 (SQLite) + Cloudflare R2** backend. In local development (`npm run dev`), `server.ts` runs local adapters (`node:sqlite` in `.local-backend/sunnova.db` and local disk R2 emulation in `.local-backend/r2/`).

- **Official Website:** `https://sun-nova-print-service.pages.dev/`
- **Official Support Email:** `sopport.sunnovaprintservice@gmail.com`

---

## Automatic Zero-503 Resilience (Even Before Bindings Are Added)

If `DB` (D1) or `MEDIA_BUCKET` (R2) are not bound yet after a fresh Cloudflare deployment, the API router (`src/backend/apiRouter.ts` + `src/backend/cloudflareStorage.ts`) automatically keeps the website and `/admin` online without `503` errors:

1. **`DB` + `MEDIA_BUCKET` bound (`mode: "d1+r2"`):** Full persistent production mode — auto-creates missing schema tables on cold start (`ensureSchemaTables`) and stores uploaded files in R2.
2. **`DB` bound, `MEDIA_BUCKET` unbound (`mode: "d1+d1blob"`):** Stores metadata and uploaded assets (up to `1.5 MB` per file) directly in D1 `media_blobs` until you bind R2.
3. **Neither bound (`mode: "memory-fallback"`):** Runs an isolate-scoped in-memory D1/R2 fallback so the homepage, studio tools, and `/admin` diagnostics dashboard work immediately, while displaying binding setup instructions in **Admin Overview → Cloudflare Bindings & Storage Status**. *(Note: memory fallback data resets on isolate cold restart — always bind D1 + R2 for permanent production persistence.)*

---

## Option A (Recommended): Cloudflare Pages with Functions

1. **Create Cloudflare Pages Project** connected to GitHub (`sunilyengkhomss-svg/SUN-NOVA-PRINT-SERVICE`):
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Functions in `functions/api/*` (`[[path]].ts`, `chat.ts`, `ocr.ts`, `resume-assist.ts`) deploy automatically alongside `dist/`.
2. **Create D1 Database & R2 Bucket** (either in Cloudflare Dashboard or CLI):
   ```bash
   npx wrangler login
   npx wrangler d1 create sun-nova-db
   npx wrangler r2 bucket create sun-nova-media
   npx wrangler d1 migrations apply sun-nova-db --remote
   ```
   *(Note: even if you skip manual migration, `ensureSchemaTables` auto-creates all tables on first request.)*
3. **Attach Bindings in Cloudflare Pages Dashboard** (**Settings → Functions → Bindings**, for **Production** and **Preview**):
   - **D1 Database Binding:** Variable name = `DB`, Database = `sun-nova-db`
   - **R2 Bucket Binding:** Variable name = `MEDIA_BUCKET`, Bucket = `sun-nova-media`
4. **Add Environment Variables / Secrets** (**Settings → Environment variables**):
   - `GEMINI_API_KEY` *(optional — enables Ask AI Agent, OCR extractor, and Resume AI writer)*
   - `ADMIN_SETUP_TOKEN` *(optional — protects first-time Super Admin registration at `/admin`)*
   - `RESEND_API_KEY` & `EMAIL_FROM` *(optional — sends password reset & customer reply emails)*
5. **Redeploy** once after saving bindings so Pages Functions pick up `DB` and `MEDIA_BUCKET`.

---

## Option B: Cloudflare Workers (`wrangler.jsonc`)

Your `wrangler.jsonc` targets worker name `sun-nova-print-service` (`main: "src/worker.ts"`, static assets from `./dist` with SPA fallback).

1. **Deploy command** (matches Cloudflare Workers Builds):
   ```bash
   npm run build && npx wrangler deploy
   ```
   *(or `npm run deploy:worker`)*
2. **Attach Bindings (`DB` & `MEDIA_BUCKET`):**
   - Either attach them directly in **Cloudflare Dashboard → Workers & Pages → sun-nova-print-service → Settings → Bindings** (recommended when using Git auto-builds with `wrangler.jsonc` unchanged), **OR**
   - Uncomment `"d1_databases"` and `"r2_buckets"` in `wrangler.jsonc` and paste your real `database_id` from `npx wrangler d1 create sun-nova-db`.
3. **Set Secrets via Wrangler CLI:**
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   npx wrangler secret put ADMIN_SETUP_TOKEN
   npx wrangler secret put RESEND_API_KEY
   ```

---

## Storage Security Architecture

- **Public Website Assets** (`public/...`): CMS banners, outfits, backgrounds, sample portraits, services, and portfolio images are streamed via `/api/media/public/<key>` with long-lived immutable cache headers and `X-Content-Type-Options: nosniff`.
- **Private Files** (`private/...`): Customer quote attachments and private studio archives return `403 Forbidden` on public routes and can only be streamed via authenticated `/api/admin/media/:id/file`.

---

## First-Time Super Admin Setup (`/admin`)

No hardcoded plaintext admin password exists in the codebase.

1. Visit `/admin` on your deployed site (`https://sun-nova-print-service.pages.dev/admin`).
2. Check **Cloudflare Bindings & Storage Status** after login on Dashboard Overview to verify `DB` and `MEDIA_BUCKET` both show **Bound**.
3. Enter your **Full Name**, **Admin Email** (`sopport.sunnovaprintservice@gmail.com` or your chosen owner email), and a **Strong Password** (minimum 8 characters) to provision `super_admin`.
