# SUN-NOVA PRINT SERVICE — Backend & Cloudflare Deployment Guide

This application uses **React + TypeScript + Vite** for the frontend and a **Cloudflare Workers / Pages Functions + Cloudflare D1 (SQLite) + Cloudflare R2** backend. In local development (`npm run dev`), `server.ts` runs local adapters (`node:sqlite` in `.local-backend/sunnova.db` and local disk R2 emulation in `.local-backend/r2/`) so every admin feature works locally with zero external setup.

Official Website: `https://sun-nova-print-service.pages.dev/`  
Official Support Email: `sopport.sunnovaprintservice@gmail.com`

---

## 1. Create Cloudflare D1 Database & Apply Schema Migrations

1. Authenticate Wrangler CLI:
   ```bash
   npx wrangler login
   ```

2. Create the Cloudflare D1 database:
   ```bash
   npx wrangler d1 create sun-nova-db
   ```

3. Copy the returned `database_id` into `wrangler.jsonc` under `d1_databases[0].database_id`:
   ```jsonc
   "d1_databases": [
     {
       "binding": "DB",
       "database_name": "sun-nova-db",
       "database_id": "<YOUR_D1_DATABASE_ID>",
       "migrations_dir": "migrations"
     }
   ]
   ```

4. Apply the database schema migration (`migrations/0001_init.sql`):
   ```bash
   npx wrangler d1 migrations apply sun-nova-db --remote
   ```

---

## 2. Create Cloudflare R2 Object Storage Bucket

1. Create the R2 bucket matching `wrangler.jsonc`:
   ```bash
   npx wrangler r2 bucket create sun-nova-media
   ```

2. Confirm `wrangler.jsonc` includes:
   ```jsonc
   "r2_buckets": [
     {
       "binding": "MEDIA_BUCKET",
       "bucket_name": "sun-nova-media"
     }
   ]
   ```

> **Storage Security Design:**
> - **Public Website Assets** (CMS banners, outfits, backgrounds, sample portraits, services, portfolio images) are stored under `public/...` and served via `/api/media/public/<key>` with long-lived immutable cache headers.
> - **Private Files** (customer quote artwork attachments and private studio archives) are stored under `private/...`, return `403 Forbidden` on public media endpoints, and can **only** be streamed through the authenticated admin endpoint `/api/admin/media/:id/file`.

---

## 3. Configure Secrets (Environment Variables)

Set required secrets in **Cloudflare Workers & Pages → Settings → Variables and Secrets** (or via CLI for Workers):

```bash
# Optional AI Assistant / OCR / Resume Writer key
npx wrangler secret put GEMINI_API_KEY

# Optional initial setup token to protect the very first Super Admin registration at /admin
npx wrangler secret put ADMIN_SETUP_TOKEN

# Optional Resend API key for automated password resets & customer email replies
npx wrangler secret put RESEND_API_KEY
```

And configure plain environment variables if using Resend:
- `EMAIL_FROM`: `SUN-NOVA PRINT SERVICE <no-reply@yourdomain.com>`

> Note: Never store secret keys inside `.env` committed to Git or inside `VITE_*` browser variables.

---

## 4. Deploy to Cloudflare

### Option A: Cloudflare Workers (Full-Stack Assets + API via `wrangler.jsonc`)
```bash
npm install
npm run build
npx wrangler deploy
```

### Option B: Cloudflare Pages (Git Integration / Direct Upload)
1. **Build command**: `npm run build`
2. **Build output directory**: `dist`
3. Bind **D1 Database** (`DB` → `sun-nova-db`) and **R2 Bucket** (`MEDIA_BUCKET` → `sun-nova-media`) in **Pages → Settings → Functions / Bindings** (both Production and Preview environments).
4. Both `functions/api/[[path]].ts` (Pages Functions) and `src/worker.ts` (Workers) share the exact same `handleApiRequest` router.

---

## 5. First-Time Super Admin Setup (`/admin`)

No hardcoded plaintext admin password exists in the codebase.

1. Visit `https://sun-nova-print-service.pages.dev/admin`.
2. When no admin exists in D1 yet, the portal displays **Initial Super Admin Setup**.
3. Enter your **Full Name**, **Admin Email** (`sopport.sunnovaprintservice@gmail.com` or your chosen owner email), **Strong Password** (minimum 8 characters), and your `ADMIN_SETUP_TOKEN` (if configured).
4. Submit to provision the `super_admin` account and automatically sign into the Admin Dashboard.
5. Subsequent logins use `/admin` with PBKDF2-SHA256 verification and `HttpOnly` secure session cookies.
