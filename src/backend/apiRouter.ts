import {
  detectUploadFileType,
  generateId,
  generateSecureToken,
  hashPassword,
  isValidEmail,
  isValidHexColor,
  normalizeExtension,
  sanitizeEmail,
  sanitizeFilename,
  sha256Hex,
  verifyPassword,
} from "./crypto";
import { AppWorkerEnv, D1Database, R2Bucket } from "./d1Types";
import { resolveStorageBindings } from "./cloudflareStorage";
import { DEFAULT_WEBSITE_SETTINGS, ensureSeeded, readWebsiteSettings } from "./seed";
import {
  ActivityLogRecord,
  AdminOverviewPayload,
  AdminRole,
  AdminUser,
  BackgroundPresetRecord,
  ContactMessageRecord,
  MediaFileRecord,
  MediaVisibility,
  OutfitCategory,
  OutfitTemplateRecord,
  PortfolioItemRecord,
  QuoteRequestRecord,
  QuoteStatus,
  SamplePortraitRecord,
  ServiceRecord,
  WebsiteSettings,
} from "../types/cms";

const SESSION_COOKIE_NAME = "sn_admin_session";
const OUTFIT_CATEGORIES: OutfitCategory[] = [
  "Student",
  "Officer",
  "Men",
  "Women",
  "Formal",
  "Custom",
];
const QUOTE_STATUSES: QuoteStatus[] = [
  "New",
  "Pending",
  "Contacted",
  "Quoted",
  "Completed",
  "Cancelled",
];

function json(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "local"
  );
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) map[k] = decodeURIComponent(v);
  }
  return map;
}

function buildSessionCookie(token: string, maxAgeSeconds: number, isHttps: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

function buildClearSessionCookie(isHttps: boolean): string {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

async function checkRateLimit(
  SUN: D1Database,
  rateKey: string,
  maxHits: number,
  windowSeconds: number
): Promise<boolean> {
  const db = SUN;
  const nowSec = Math.floor(Date.now() / 1000);
  const existing = await db
    .prepare("SELECT hits, window_start FROM rate_limits WHERE rate_key = ?")
    .bind(rateKey)
    .first<{ hits: number; window_start: number }>();

  if (!existing || nowSec - Number(existing.window_start) >= windowSeconds) {
    await db
      .prepare(
        "INSERT OR REPLACE INTO rate_limits (rate_key, hits, window_start) VALUES (?, 1, ?)"
      )
      .bind(rateKey, nowSec)
      .run();
    return true;
  }

  if (Number(existing.hits) >= maxHits) {
    return false;
  }

  await db
    .prepare("UPDATE rate_limits SET hits = hits + 1 WHERE rate_key = ?")
    .bind(rateKey)
    .run();
  return true;
}

async function logActivity(
  SUN: D1Database,
  admin: Pick<AdminUser, "id" | "email"> | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: string
): Promise<void> {
  const db = SUN;
  await db
    .prepare(
      `INSERT INTO activity_logs (id, admin_id, admin_email, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      generateId(),
      admin?.id || null,
      admin?.email || null,
      action,
      entityType,
      entityId,
      details || null,
      new Date().toISOString()
    )
    .run();
}

function verifyCsrf(request: Request, url: URL): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) {
    return false;
  }
  const csrfHeader = request.headers.get("X-Requested-With");
  return csrfHeader === "SunNovaAdmin";
}

async function authenticateAdmin(request: Request, db: D1Database): Promise<AdminUser | null> {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;

  const tokenHash = await sha256Hex(rawToken);
  const nowIso = new Date().toISOString();

  const row = await db
    .prepare(
      `SELECT a.id, a.name, a.email, a.role, a.status, a.last_login_at, a.created_at, a.updated_at, s.expires_at
       FROM admin_sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?`
    )
    .bind(tokenHash)
    .first<AdminUser & { expires_at: string }>();

  if (!row || row.status !== "active" || row.expires_at <= nowIso) {
    if (row) {
      await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
    }
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function storeUploadedFile(opts: {
  file: File;
  SUN?: D1Database;
  db?: D1Database;
  bucket: R2Bucket;
  category: string;
  visibility: MediaVisibility;
  adminId: string | null;
  settings: WebsiteSettings;
  customName?: string;
  allowAnyUploadOverride?: boolean;
}): Promise<MediaFileRecord> {
  const db = opts.SUN || opts.db;
  if (!db) throw new Error("Database connection required");
  const buf = new Uint8Array(await opts.file.arrayBuffer());
  const detected = detectUploadFileType(buf, opts.file.type, opts.file.name, {
    allowAnyUpload: opts.allowAnyUploadOverride ?? opts.settings.allowAnyUpload,
    allowedUploadExtensions: opts.settings.allowedUploadExtensions,
  });
  if (!detected.valid) {
    throw new Error(
      detected.error ||
        `Unsupported or invalid file "${opts.file.name}". Update allowed extensions in Media Upload Rules.`
    );
  }

  const limitMb = detected.isPdf
    ? opts.settings.maxPdfUploadMb
    : detected.isImage
    ? opts.settings.maxImageUploadMb
    : opts.settings.maxCustomUploadMb || 25;
  const maxBytes = limitMb * 1024 * 1024;
  if (buf.byteLength > maxBytes) {
    throw new Error(
      `"${opts.file.name}" exceeds the ${limitMb} MB upload limit.`
    );
  }

  const id = generateId();
  const displayFilename = opts.customName?.trim()
    ? opts.customName.trim().slice(0, 140)
    : opts.file.name;
  const safeBase = sanitizeFilename(displayFilename).replace(/\.[^.]+$/, "");
  const safeExt = detected.ext || "bin";
  const uniqueName = `${Date.now()}-${id.slice(0, 8)}-${safeBase}.${safeExt}`;
  const prefix = opts.visibility === "private" ? "private" : "public";
  const safeCategory =
    opts.category
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 40) || "general";
  const r2Key = `${prefix}/${safeCategory}/${uniqueName}`;
  const publicUrl =
    opts.visibility === "public"
      ? `/api/media/public/${encodeURIComponent(r2Key)}`
      : null;

  await opts.bucket.put(r2Key, buf, {
    httpMetadata: {
      contentType: detected.mime,
      cacheControl:
        opts.visibility === "public"
          ? "public, max-age=31536000, immutable"
          : "private, no-store",
    },
    customMetadata: {
      originalName: opts.file.name,
      category: safeCategory,
    },
  });

  const now = new Date().toISOString();
  const record: MediaFileRecord = {
    id,
    r2_key: r2Key,
    filename: displayFilename,
    original_name: opts.file.name,
    mime_type: detected.mime,
    file_size: buf.byteLength,
    category: safeCategory,
    visibility: opts.visibility,
    public_url: publicUrl,
    uploaded_by: opts.adminId,
    created_at: now,
    updated_at: now,
  };

  await db
    .prepare(
      `INSERT INTO media_files
       (id, r2_key, filename, original_name, mime_type, file_size, category, visibility, public_url, uploaded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      record.id,
      record.r2_key,
      record.filename,
      record.original_name,
      record.mime_type,
      record.file_size,
      record.category,
      record.visibility,
      record.public_url,
      record.uploaded_by,
      record.created_at,
      record.updated_at
    )
    .run();

  return record;
}

async function safeJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function handleApiRequest(
  request: Request,
  env: AppWorkerEnv
): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname;
  const isHttps =
    url.protocol === "https:" ||
    request.headers.get("X-Forwarded-Proto") === "https";

  if (!path.startsWith("/api/")) {
    return null;
  }

  // Health endpoint (checks live D1, R2, and fallback storage mode)
  if (path === "/api/health" && request.method === "GET") {
    const { storageStatus } = resolveStorageBindings(env);
    return json({
      ok: true,
      dbConfigured: storageStatus.d1Bound,
      r2Configured: storageStatus.r2Bound,
      geminiConfigured: storageStatus.geminiConfigured,
      storageStatus,
    });
  }

  // Public media streaming from R2 / D1-blob / memory storage (strictly public/ prefix only)
  if (path.startsWith("/api/media/public/") && request.method === "GET") {
    const { db, bucket } = resolveStorageBindings(env);
    await ensureSeeded(db);
    const rawKey = decodeURIComponent(path.slice("/api/media/public/".length));
    if (!rawKey.startsWith("public/") || rawKey.includes("..")) {
      return json({ error: "Forbidden asset path." }, 403);
    }
    const mediaRow = await db
      .prepare("SELECT visibility, mime_type FROM media_files WHERE r2_key = ?")
      .bind(rawKey)
      .first<{ visibility: string; mime_type: string }>();
    if (!mediaRow || mediaRow.visibility !== "public") {
      return json({ error: "Asset not found or not public." }, 404);
    }
    const obj = await bucket.get(rawKey);
    if (!obj) {
      return json({ error: "Object not found in storage." }, 404);
    }
    const headers = new Headers();
    const contentType =
      obj.httpMetadata?.contentType || mediaRow.mime_type || "application/octet-stream";
    headers.set("Content-Type", contentType);
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("X-Content-Type-Options", "nosniff");
    if (contentType.includes("svg") || contentType.includes("xml") || contentType.includes("html")) {
      headers.set("Content-Security-Policy", "sandbox");
    }
    if (url.searchParams.get("download") === "1") {
      headers.set(
        "Content-Disposition",
        `attachment; filename="${sanitizeFilename(rawKey.split("/").pop() || "asset")}"`
      );
    }
    return new Response(obj.body, { status: 200, headers });
  }

  const { db, bucket, storageStatus } = resolveStorageBindings(env);

  try {
    await ensureSeeded(db);

    // =========================================================================
    // PUBLIC ROUTES
    // =========================================================================
    if (path === "/api/public/settings" && request.method === "GET") {
      const settings = await readWebsiteSettings(db);
      return json({ settings });
    }

    if (path === "/api/public/bootstrap" && request.method === "GET") {
      const [settings, outfitsRes, bgsRes, portraitsRes, servicesRes, portfolioRes] =
        await Promise.all([
          readWebsiteSettings(db),
          db
            .prepare(
              "SELECT * FROM outfit_templates WHERE is_published = 1 ORDER BY display_order ASC, created_at ASC"
            )
            .all<OutfitTemplateRecord>(),
          db
            .prepare(
              "SELECT * FROM background_presets WHERE is_published = 1 ORDER BY display_order ASC, created_at ASC"
            )
            .all<BackgroundPresetRecord>(),
          db
            .prepare(
              "SELECT * FROM sample_portraits WHERE is_published = 1 ORDER BY display_order ASC, created_at DESC"
            )
            .all<SamplePortraitRecord>(),
          db
            .prepare(
              "SELECT * FROM services WHERE is_published = 1 ORDER BY display_order ASC, created_at ASC"
            )
            .all<ServiceRecord>(),
          db
            .prepare(
              "SELECT * FROM portfolio_items WHERE is_published = 1 ORDER BY display_order ASC, created_at DESC"
            )
            .all<PortfolioItemRecord>(),
        ]);

      return json({
        settings,
        outfits: outfitsRes.results,
        backgrounds: bgsRes.results,
        portraits: portraitsRes.results,
        services: servicesRes.results,
        portfolio: portfolioRes.results,
      });
    }

    if (path === "/api/public/quotes" && request.method === "POST") {
      const ip = getClientIp(request);
      if (!(await checkRateLimit(db, `pub_quote:${ip}`, 15, 900))) {
        return json(
          { error: "Too many quote submissions. Please wait a few minutes and try again." },
          429
        );
      }

      const contentType = request.headers.get("Content-Type") || "";
      let customerName = "";
      let customerEmail = "";
      let phoneNumber = "";
      let serviceType = "";
      let quantity = "1";
      let paperSize = "Standard";
      let material = "";
      let colorMode = "Full Color (CMYK)";
      let description = "";
      let attachmentMediaId: string | null = null;
      let attachmentName: string | null = null;

      if (contentType.includes("multipart/form-data")) {
        const fd = await request.formData();
        customerName = String(fd.get("customerName") || "").trim();
        customerEmail = sanitizeEmail(String(fd.get("customerEmail") || ""));
        phoneNumber = String(fd.get("phoneNumber") || "").trim().slice(0, 40);
        serviceType = String(fd.get("serviceType") || "").trim();
        quantity = String(fd.get("quantity") || "1").trim();
        paperSize = String(fd.get("paperSize") || "Standard").trim();
        material = String(fd.get("material") || "").trim();
        colorMode = String(fd.get("colorMode") || "Full Color (CMYK)").trim();
        description = String(fd.get("description") || "").trim().slice(0, 3000);
        const maybeFile = fd.get("attachment");
        if (maybeFile instanceof File && maybeFile.size > 0) {
          const settings = await readWebsiteSettings(db);
          const stored = await storeUploadedFile({
            file: maybeFile,
            db,
            bucket,
            category: "quote_attachment",
            visibility: "private", // Sensitive customer artwork kept private in R2
            adminId: null,
            settings,
          });
          attachmentMediaId = stored.id;
          attachmentName = stored.filename;
        }
      } else {
        const body = await safeJson<Record<string, unknown>>(request);
        if (!body) return json({ error: "Invalid request payload." }, 400);
        customerName = String(body.customerName || "").trim();
        customerEmail = sanitizeEmail(String(body.customerEmail || ""));
        phoneNumber = String(body.phoneNumber || "").trim().slice(0, 40);
        serviceType = String(body.serviceType || "").trim();
        quantity = String(body.quantity || "1").trim();
        paperSize = String(body.paperSize || "Standard").trim();
        material = String(body.material || "").trim();
        colorMode = String(body.colorMode || "Full Color (CMYK)").trim();
        description = String(body.description || "").trim().slice(0, 3000);
      }

      if (!customerName || !isValidEmail(customerEmail) || !serviceType) {
        return json(
          { error: "Customer Name, valid Email, and Service Type are required." },
          400
        );
      }

      const id = generateId();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO quote_requests
           (id, customer_name, customer_email, phone_number, service_type, quantity, paper_size, material, color_mode, description, attachment_media_id, attachment_name, status, internal_notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', '', ?, ?)`
        )
        .bind(
          id,
          customerName.slice(0, 120),
          customerEmail,
          phoneNumber || null,
          serviceType.slice(0, 120),
          quantity.slice(0, 40),
          paperSize.slice(0, 100),
          material.slice(0, 120) || null,
          colorMode.slice(0, 60) || null,
          description || null,
          attachmentMediaId,
          attachmentName,
          now,
          now
        )
        .run();

      return json({ ok: true, quoteId: id }, 201);
    }

    if (path === "/api/public/contact" && request.method === "POST") {
      const ip = getClientIp(request);
      if (!(await checkRateLimit(db, `pub_contact:${ip}`, 15, 900))) {
        return json(
          { error: "Too many messages sent. Please try again in a few minutes." },
          429
        );
      }

      const body = await safeJson<{
        customerName?: string;
        customerEmail?: string;
        phoneNumber?: string;
        subject?: string;
        message?: string;
      }>(request);
      if (!body) return json({ error: "Invalid JSON payload." }, 400);

      const name = String(body.customerName || "").trim();
      const email = sanitizeEmail(String(body.customerEmail || ""));
      const phone = String(body.phoneNumber || "").trim().slice(0, 40);
      const subject = String(body.subject || "Studio Project Inquiry").trim();
      const message = String(body.message || "").trim();

      if (!name || !isValidEmail(email) || !message) {
        return json(
          { error: "Name, valid email address, and message are required." },
          400
        );
      }

      const id = generateId();
      const now = new Date().toISOString();
      await db
        .prepare(
          `INSERT INTO contact_messages
           (id, customer_name, customer_email, phone_number, subject, message, is_read, reply_note, replied_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, '', NULL, ?, ?)`
        )
        .bind(
          id,
          name.slice(0, 120),
          email,
          phone || null,
          subject.slice(0, 200),
          message.slice(0, 5000),
          now,
          now
        )
        .run();

      return json({ ok: true, messageId: id }, 201);
    }

    // =========================================================================
    // ADMIN AUTHENTICATION & BOOTSTRAP
    // =========================================================================
    if (path === "/api/admin/bootstrap-status" && request.method === "GET") {
      const [row, sessionAdmin] = await Promise.all([
        db.prepare("SELECT COUNT(*) as cnt FROM admins").first<{ cnt: number }>(),
        authenticateAdmin(request, db),
      ]);
      return json({
        needsSetup: !row || Number(row.cnt) === 0,
        setupTokenRequired: Boolean(env.ADMIN_SETUP_TOKEN),
        admin: sessionAdmin,
        storageStatus,
      });
    }

    if (path === "/api/admin/setup" && request.method === "POST") {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) {
        return json({ error: "Origin mismatch." }, 403);
      }

      const existing = await db
        .prepare("SELECT COUNT(*) as cnt FROM admins")
        .first<{ cnt: number }>();
      if (existing && Number(existing.cnt) > 0) {
        return json(
          { error: "Administrator setup is already complete. Please sign in." },
          403
        );
      }

      const body = await safeJson<{
        name?: string;
        email?: string;
        password?: string;
        setupToken?: string;
      }>(request);
      if (!body) return json({ error: "Invalid JSON payload." }, 400);

      if (env.ADMIN_SETUP_TOKEN && body.setupToken !== env.ADMIN_SETUP_TOKEN) {
        return json({ error: "Invalid ADMIN_SETUP_TOKEN." }, 403);
      }

      const name = String(body.name || "").trim();
      const email = sanitizeEmail(String(body.email || ""));
      const password = String(body.password || "");
      if (!name || !isValidEmail(email) || password.length < 8) {
        return json(
          { error: "Provide a valid name, email, and password (at least 8 characters)." },
          400
        );
      }

      const id = generateId();
      const now = new Date().toISOString();
      const passwordHash = await hashPassword(password);

      await db
        .prepare(
          `INSERT INTO admins (id, name, email, password_hash, role, status, last_login_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'super_admin', 'active', ?, ?, ?)`
        )
        .bind(id, name.slice(0, 100), email, passwordHash, now, now, now)
        .run();

      const rawToken = generateSecureToken(32);
      const tokenHash = await sha256Hex(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      await db
        .prepare(
          `INSERT INTO admin_sessions (id, admin_id, token_hash, ip_address, user_agent, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId(),
          id,
          tokenHash,
          getClientIp(request),
          (request.headers.get("User-Agent") || "").slice(0, 200),
          expiresAt,
          now
        )
        .run();

      await logActivity(
        db,
        { id, email },
        "Initial Super Admin Created",
        "admin",
        id,
        `Super Admin account initialized for ${email}`
      );

      return json(
        {
          admin: {
            id,
            name: name.slice(0, 100),
            email,
            role: "super_admin",
            status: "active",
            last_login_at: now,
            created_at: now,
            updated_at: now,
          },
        },
        201,
        {
          "Set-Cookie": buildSessionCookie(rawToken, 30 * 24 * 3600, isHttps),
        }
      );
    }

    if (path === "/api/admin/login" && request.method === "POST") {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) {
        return json({ error: "Origin mismatch." }, 403);
      }

      const ip = getClientIp(request);
      if (!(await checkRateLimit(db, `admin_login:${ip}`, 15, 900))) {
        return json(
          { error: "Too many login attempts. Please wait 15 minutes before retrying." },
          429
        );
      }

      const body = await safeJson<{
        email?: string;
        password?: string;
        remember?: boolean;
      }>(request);
      if (!body) return json({ error: "Invalid JSON payload." }, 400);

      const email = sanitizeEmail(String(body.email || ""));
      const password = String(body.password || "");
      if (!isValidEmail(email) || !password) {
        return json({ error: "Email and password are required." }, 400);
      }

      const adminRow = await db
        .prepare("SELECT * FROM admins WHERE email = ?")
        .bind(email)
        .first<AdminUser & { password_hash: string }>();

      if (!adminRow || adminRow.status !== "active") {
        return json({ error: "Invalid email or password." }, 401);
      }

      const validPw = await verifyPassword(password, adminRow.password_hash);
      if (!validPw) {
        return json({ error: "Invalid email or password." }, 401);
      }

      const now = new Date().toISOString();
      const remember = Boolean(body.remember);
      const maxAgeSeconds = remember ? 30 * 24 * 3600 : 12 * 3600;
      const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000).toISOString();
      const rawToken = generateSecureToken(32);
      const tokenHash = await sha256Hex(rawToken);

      await db
        .prepare(
          `INSERT INTO admin_sessions (id, admin_id, token_hash, ip_address, user_agent, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          generateId(),
          adminRow.id,
          tokenHash,
          ip,
          (request.headers.get("User-Agent") || "").slice(0, 200),
          expiresAt,
          now
        )
        .run();

      await db
        .prepare("UPDATE admins SET last_login_at = ?, updated_at = ? WHERE id = ?")
        .bind(now, now, adminRow.id)
        .run();

      await logActivity(
        db,
        { id: adminRow.id, email: adminRow.email },
        "Admin Login",
        "admin",
        adminRow.id,
        `Signed in (${remember ? "30d session" : "12h session"})`
      );

      return json(
        {
          admin: {
            id: adminRow.id,
            name: adminRow.name,
            email: adminRow.email,
            role: adminRow.role,
            status: adminRow.status,
            last_login_at: now,
            created_at: adminRow.created_at,
            updated_at: now,
          },
        },
        200,
        {
          "Set-Cookie": buildSessionCookie(rawToken, maxAgeSeconds, isHttps),
        }
      );
    }

    if (path === "/api/admin/logout" && request.method === "POST") {
      const cookies = parseCookies(request.headers.get("Cookie"));
      const rawToken = cookies[SESSION_COOKIE_NAME];
      if (rawToken) {
        const tokenHash = await sha256Hex(rawToken);
        await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
      }
      return json(
        { ok: true },
        200,
        { "Set-Cookie": buildClearSessionCookie(isHttps) }
      );
    }

    if (path === "/api/admin/forgot-password" && request.method === "POST") {
      const ip = getClientIp(request);
      if (!(await checkRateLimit(db, `admin_forgot:${ip}`, 5, 900))) {
        return json({ error: "Please wait before requesting another reset." }, 429);
      }

      const body = await safeJson<{ email?: string }>(request);
      const email = sanitizeEmail(String(body?.email || ""));
      if (!isValidEmail(email)) {
        return json({ error: "Enter a valid administrator email address." }, 400);
      }

      const adminRow = await db
        .prepare("SELECT id, email, name FROM admins WHERE email = ? AND status = 'active'")
        .bind(email)
        .first<{ id: string; email: string; name: string }>();

      if (adminRow) {
        const resetToken = generateSecureToken(24);
        const resetHash = await sha256Hex(resetToken);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await db
          .prepare(
            "UPDATE admins SET reset_token_hash = ?, reset_token_expires_at = ?, updated_at = ? WHERE id = ?"
          )
          .bind(resetHash, expiresAt, new Date().toISOString(), adminRow.id)
          .run();

        if (env.RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM || "SUN-NOVA PRINT SERVICE <onboarding@resend.dev>",
              to: [adminRow.email],
              subject: "SUN-NOVA Admin Password Reset Token",
              text: `Hello ${adminRow.name},\n\nYour password reset code (valid for 30 minutes):\n${resetToken}\n`,
            }),
          }).catch(() => undefined);
          return json({
            ok: true,
            emailDispatched: true,
            message:
              "If this administrator email is registered, a password reset code has been sent via email.",
          });
        }
      }

      return json({
        ok: true,
        emailDispatched: false,
        message: env.RESEND_API_KEY
          ? "If this administrator email is registered, a reset code has been sent."
          : "Reset request recorded. Because RESEND_API_KEY is not configured, complete password reset using your server ADMIN_SETUP_TOKEN or via Wrangler D1 recovery.",
      });
    }

    if (path === "/api/admin/reset-password" && request.method === "POST") {
      const ip = getClientIp(request);
      if (!(await checkRateLimit(db, `admin_reset:${ip}`, 10, 900))) {
        return json({ error: "Too many reset attempts. Try again later." }, 429);
      }

      const body = await safeJson<{
        email?: string;
        token?: string;
        newPassword?: string;
      }>(request);
      const email = sanitizeEmail(String(body?.email || ""));
      const token = String(body?.token || "").trim();
      const newPassword = String(body?.newPassword || "");

      if (!isValidEmail(email) || !token || newPassword.length < 8) {
        return json(
          { error: "Valid email, recovery token, and new password (8+ chars) are required." },
          400
        );
      }

      const adminRow = await db
        .prepare("SELECT id, reset_token_hash, reset_token_expires_at FROM admins WHERE email = ?")
        .bind(email)
        .first<{
          id: string;
          reset_token_hash: string | null;
          reset_token_expires_at: string | null;
        }>();

      if (!adminRow) {
        return json({ error: "Invalid email or recovery token." }, 403);
      }

      const tokenHash = await sha256Hex(token);
      const matchesResetToken =
        adminRow.reset_token_hash &&
        adminRow.reset_token_expires_at &&
        adminRow.reset_token_expires_at > new Date().toISOString() &&
        adminRow.reset_token_hash === tokenHash;
      const matchesSetupToken = Boolean(
        env.ADMIN_SETUP_TOKEN && token === env.ADMIN_SETUP_TOKEN
      );

      if (!matchesResetToken && !matchesSetupToken) {
        return json({ error: "Invalid or expired recovery token." }, 403);
      }

      const newHash = await hashPassword(newPassword);
      const now = new Date().toISOString();
      await db
        .prepare(
          "UPDATE admins SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = ? WHERE id = ?"
        )
        .bind(newHash, now, adminRow.id)
        .run();
      await db.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").bind(adminRow.id).run();
      await logActivity(
        db,
        { id: adminRow.id, email },
        "Admin Password Reset",
        "admin",
        adminRow.id,
        "Password reset completed and active sessions revoked"
      );

      return json({ ok: true, message: "Password updated. You can now sign in." });
    }

    // =========================================================================
    // PROTECTED ADMIN ROUTES
    // =========================================================================
    if (!path.startsWith("/api/admin/")) {
      return null;
    }

    const admin = await authenticateAdmin(request, db);
    if (!admin) {
      return json({ error: "Unauthorized. Please sign in as an administrator." }, 401);
    }

    if (!verifyCsrf(request, url)) {
      return json({ error: "CSRF validation failed." }, 403);
    }

    if (path === "/api/admin/me" && request.method === "GET") {
      return json({ admin });
    }

    // Overview
    if (path === "/api/admin/overview" && request.method === "GET") {
      const [
        imgCnt,
        fileCnt,
        outfitCnt,
        bgCnt,
        portraitCnt,
        pfCnt,
        srvCnt,
        quoteCnt,
        msgTotalCnt,
        msgUnreadCnt,
        quoteStatusRes,
        recentUploadsRes,
        recentActivityRes,
      ] = await Promise.all([
        db
          .prepare("SELECT COUNT(*) as cnt FROM media_files WHERE mime_type LIKE 'image/%'")
          .first<{ cnt: number }>(),
        db
          .prepare("SELECT COUNT(*) as cnt FROM media_files WHERE mime_type NOT LIKE 'image/%'")
          .first<{ cnt: number }>(),
        db.prepare("SELECT COUNT(*) as cnt FROM outfit_templates").first<{ cnt: number }>(),
        db.prepare("SELECT COUNT(*) as cnt FROM background_presets").first<{ cnt: number }>(),
        db.prepare("SELECT COUNT(*) as cnt FROM sample_portraits").first<{ cnt: number }>(),
        db.prepare("SELECT COUNT(*) as cnt FROM portfolio_items").first<{ cnt: number }>(),
        db.prepare("SELECT COUNT(*) as cnt FROM services").first<{ cnt: number }>(),
        db.prepare("SELECT COUNT(*) as cnt FROM quote_requests").first<{ cnt: number }>(),
        db.prepare("SELECT COUNT(*) as cnt FROM contact_messages").first<{ cnt: number }>(),
        db
          .prepare("SELECT COUNT(*) as cnt FROM contact_messages WHERE is_read = 0")
          .first<{ cnt: number }>(),
        db
          .prepare("SELECT status, COUNT(*) as count FROM quote_requests GROUP BY status")
          .all<{ status: string; count: number }>(),
        db
          .prepare("SELECT * FROM media_files ORDER BY created_at DESC LIMIT 6")
          .all<MediaFileRecord>(),
        db
          .prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10")
          .all<ActivityLogRecord>(),
      ]);

      const payload: AdminOverviewPayload = {
        counts: {
          totalImages: Number(imgCnt?.cnt || 0),
          totalFiles: Number(fileCnt?.cnt || 0),
          totalOutfits: Number(outfitCnt?.cnt || 0),
          totalBackgrounds: Number(bgCnt?.cnt || 0),
          totalPortraits: Number(portraitCnt?.cnt || 0),
          totalPortfolio: Number(pfCnt?.cnt || 0),
          totalServices: Number(srvCnt?.cnt || 0),
          totalQuotes: Number(quoteCnt?.cnt || 0),
          unreadMessages: Number(msgUnreadCnt?.cnt || 0),
          totalMessages: Number(msgTotalCnt?.cnt || 0),
        },
        quotesByStatus: quoteStatusRes.results,
        recentUploads: recentUploadsRes.results,
        recentActivity: recentActivityRes.results,
        storageStatus,
      };
      return json(payload);
    }

    // =========================================================================
    // MEDIA MANAGER
    // =========================================================================
    if (path === "/api/admin/media" && request.method === "GET") {
      const rows = await db
        .prepare("SELECT * FROM media_files ORDER BY created_at DESC")
        .all<MediaFileRecord>();
      return json({ files: rows.results });
    }

    if (path === "/api/admin/media/upload" && request.method === "POST") {
      const settings = await readWebsiteSettings(db);
      const fd = await request.formData();
      const category =
        String(fd.get("category") || "general")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, "_")
          .slice(0, 40) || "general";
      const visibility: MediaVisibility =
        fd.get("visibility") === "private" ? "private" : "public";
      const customFilename = String(fd.get("customFilename") || "").trim();
      const files = fd.getAll("files").filter((f): f is File => f instanceof File);
      const single = fd.get("file");
      if (single instanceof File && files.length === 0) files.push(single);

      if (files.length === 0) {
        return json({ error: "No valid files selected for upload." }, 400);
      }

      const uploaded: MediaFileRecord[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const rec = await storeUploadedFile({
          file,
          db,
          bucket,
          category,
          visibility,
          adminId: admin.id,
          settings,
          customName:
            files.length === 1 && customFilename
              ? customFilename
              : undefined,
        });
        uploaded.push(rec);
      }

      await logActivity(
        db,
        admin,
        `Uploaded ${uploaded.length} file(s)`,
        "media",
        uploaded[0]?.id || null,
        uploaded.map((u) => u.filename).join(", ")
      );

      return json({ files: uploaded }, 201);
    }

    if (path === "/api/admin/media/bulk-delete" && request.method === "POST") {
      const body = await safeJson<{ ids?: string[]; force?: boolean }>(request);
      const ids = Array.isArray(body?.ids)
        ? Array.from(new Set(body.ids.map((v) => String(v || "").trim()).filter(Boolean))).slice(
            0,
            200
          )
        : [];
      if (ids.length === 0) {
        return json({ error: "Select at least one file to remove." }, 400);
      }
      const force = body?.force !== false;
      const now = new Date().toISOString();
      let deletedCount = 0;
      const removedNames: string[] = [];

      for (const id of ids) {
        const existing = await db
          .prepare("SELECT * FROM media_files WHERE id = ?")
          .bind(id)
          .first<MediaFileRecord>();
        if (!existing) continue;

        if (force) {
          await Promise.all([
            db
              .prepare("UPDATE outfit_templates SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("UPDATE background_presets SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("DELETE FROM sample_portraits WHERE media_id = ?")
              .bind(id)
              .run(),
            db
              .prepare("UPDATE services SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("UPDATE portfolio_items SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("UPDATE quote_requests SET attachment_media_id = NULL, updated_at = ? WHERE attachment_media_id = ?")
              .bind(now, id)
              .run(),
          ]);
        }

        await bucket.delete(existing.r2_key).catch(() => undefined);
        await db.prepare("DELETE FROM media_files WHERE id = ?").bind(id).run();
        deletedCount += 1;
        removedNames.push(existing.filename);
      }

      if (deletedCount > 0) {
        await logActivity(
          db,
          admin,
          `Bulk Removed ${deletedCount} File(s)`,
          "media",
          null,
          removedNames.slice(0, 10).join(", ")
        );
      }

      return json({ ok: true, deletedCount });
    }

    const mediaFileMatch = path.match(/^\/api\/admin\/media\/([^/]+)\/file$/);
    if (mediaFileMatch && request.method === "GET") {
      const id = decodeURIComponent(mediaFileMatch[1]);
      const row = await db
        .prepare("SELECT * FROM media_files WHERE id = ?")
        .bind(id)
        .first<MediaFileRecord>();
      if (!row) return json({ error: "Media file not found." }, 404);
      const obj = await bucket.get(row.r2_key);
      if (!obj) return json({ error: "Object missing from storage." }, 404);
      const headers = new Headers();
      headers.set("Content-Type", row.mime_type || "application/octet-stream");
      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      if (
        row.mime_type.includes("svg") ||
        row.mime_type.includes("xml") ||
        row.mime_type.includes("html")
      ) {
        headers.set("Content-Security-Policy", "sandbox");
      }
      const isDownload = url.searchParams.get("download") === "1";
      headers.set(
        "Content-Disposition",
        `${isDownload ? "attachment" : "inline"}; filename="${sanitizeFilename(row.filename)}"`
      );
      return new Response(obj.body, { status: 200, headers });
    }

    const mediaReplaceMatch = path.match(/^\/api\/admin\/media\/([^/]+)\/replace$/);
    if (mediaReplaceMatch && request.method === "POST") {
      const id = decodeURIComponent(mediaReplaceMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM media_files WHERE id = ?")
        .bind(id)
        .first<MediaFileRecord>();
      if (!existing) return json({ error: "Media record not found." }, 404);

      const settings = await readWebsiteSettings(db);
      const fd = await request.formData();
      const file = fd.get("file");
      if (!(file instanceof File) || file.size === 0) {
        return json({ error: "Replacement file is required." }, 400);
      }

      const buf = new Uint8Array(await file.arrayBuffer());
      const detected = detectUploadFileType(buf, file.type, file.name, {
        allowAnyUpload: settings.allowAnyUpload,
        allowedUploadExtensions: settings.allowedUploadExtensions,
      });
      if (!detected.valid) {
        return json(
          { error: detected.error || "Unsupported replacement file format." },
          400
        );
      }

      const limitMb = detected.isPdf
        ? settings.maxPdfUploadMb
        : detected.isImage
        ? settings.maxImageUploadMb
        : settings.maxCustomUploadMb || 25;
      const maxBytes = limitMb * 1024 * 1024;
      if (buf.byteLength > maxBytes) {
        return json(
          { error: `Replacement file exceeds configured ${limitMb} MB upload size limit.` },
          413
        );
      }

      const safeBase = sanitizeFilename(file.name).replace(/\.[^.]+$/, "");
      const prefix = existing.visibility === "private" ? "private" : "public";
      const newKey = `${prefix}/${existing.category}/${Date.now()}-${id.slice(0, 8)}-${safeBase}.${detected.ext}`;
      const newPublicUrl =
        existing.visibility === "public"
          ? `/api/media/public/${encodeURIComponent(newKey)}`
          : null;

      await bucket.put(newKey, buf, {
        httpMetadata: {
          contentType: detected.mime,
          cacheControl:
            existing.visibility === "public"
              ? "public, max-age=31536000, immutable"
              : "private, no-store",
        },
      });
      await bucket.delete(existing.r2_key).catch(() => undefined);

      const now = new Date().toISOString();
      await db
        .prepare(
          `UPDATE media_files
           SET r2_key = ?, filename = ?, original_name = ?, mime_type = ?, file_size = ?, public_url = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          newKey,
          file.name,
          file.name,
          detected.mime,
          buf.byteLength,
          newPublicUrl,
          now,
          id
        )
        .run();

      if (newPublicUrl) {
        await Promise.all([
          db
            .prepare("UPDATE outfit_templates SET image_url = ?, updated_at = ? WHERE media_id = ?")
            .bind(newPublicUrl, now, id)
            .run(),
          db
            .prepare("UPDATE background_presets SET image_url = ?, updated_at = ? WHERE media_id = ?")
            .bind(newPublicUrl, now, id)
            .run(),
          db
            .prepare("UPDATE sample_portraits SET image_url = ?, updated_at = ? WHERE media_id = ?")
            .bind(newPublicUrl, now, id)
            .run(),
          db
            .prepare("UPDATE services SET image_url = ?, updated_at = ? WHERE media_id = ?")
            .bind(newPublicUrl, now, id)
            .run(),
          db
            .prepare("UPDATE portfolio_items SET image_url = ?, updated_at = ? WHERE media_id = ?")
            .bind(newPublicUrl, now, id)
            .run(),
        ]);
      }

      const updated = await db
        .prepare("SELECT * FROM media_files WHERE id = ?")
        .bind(id)
        .first<MediaFileRecord>();
      await logActivity(db, admin, "Replaced Media File", "media", id, file.name);
      return json({ file: updated });
    }

    const mediaIdMatch = path.match(/^\/api\/admin\/media\/([^/]+)$/);
    if (mediaIdMatch) {
      const id = decodeURIComponent(mediaIdMatch[1]);
      if (request.method === "PUT") {
        const body = await safeJson<{
          filename?: string;
          category?: string;
        }>(request);
        const existing = await db
          .prepare("SELECT * FROM media_files WHERE id = ?")
          .bind(id)
          .first<MediaFileRecord>();
        if (!existing) return json({ error: "Media file not found." }, 404);

        const nextName = body?.filename?.trim()
          ? body.filename.trim().slice(0, 140)
          : existing.filename;
        const nextCat = body?.category?.trim()
          ? body.category.trim().slice(0, 40)
          : existing.category;
        const now = new Date().toISOString();

        await db
          .prepare(
            "UPDATE media_files SET filename = ?, category = ?, updated_at = ? WHERE id = ?"
          )
          .bind(nextName, nextCat, now, id)
          .run();

        const updated = await db
          .prepare("SELECT * FROM media_files WHERE id = ?")
          .bind(id)
          .first<MediaFileRecord>();
        await logActivity(db, admin, "Updated Media Metadata", "media", id, nextName);
        return json({ file: updated });
      }

      if (request.method === "DELETE") {
        const existing = await db
          .prepare("SELECT * FROM media_files WHERE id = ?")
          .bind(id)
          .first<MediaFileRecord>();
        if (!existing) return json({ error: "Media file not found." }, 404);

        const force = url.searchParams.get("force") === "true";
        const refTables = [
          "outfit_templates",
          "background_presets",
          "sample_portraits",
          "services",
          "portfolio_items",
        ];
        let totalRefs = 0;
        for (const tbl of refTables) {
          const r = await db
            .prepare(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE media_id = ?`)
            .bind(id)
            .first<{ cnt: number }>();
          totalRefs += Number(r?.cnt || 0);
        }
        const quoteRef = await db
          .prepare("SELECT COUNT(*) as cnt FROM quote_requests WHERE attachment_media_id = ?")
          .bind(id)
          .first<{ cnt: number }>();
        totalRefs += Number(quoteRef?.cnt || 0);

        if (totalRefs > 0 && !force) {
          return json(
            {
              error: `This file is referenced by ${totalRefs} published or active item(s). Confirm force delete to detach references and remove the file.`,
              requiresForce: true,
              references: totalRefs,
            },
            409
          );
        }

        const now = new Date().toISOString();
        if (totalRefs > 0) {
          await Promise.all([
            db
              .prepare("UPDATE outfit_templates SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("UPDATE background_presets SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("DELETE FROM sample_portraits WHERE media_id = ?")
              .bind(id)
              .run(),
            db
              .prepare("UPDATE services SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("UPDATE portfolio_items SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?")
              .bind(now, id)
              .run(),
            db
              .prepare("UPDATE quote_requests SET attachment_media_id = NULL, updated_at = ? WHERE attachment_media_id = ?")
              .bind(now, id)
              .run(),
          ]);
        }

        await bucket.delete(existing.r2_key).catch(() => undefined);
        await db.prepare("DELETE FROM media_files WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Media File", "media", id, existing.filename);
        return json({ ok: true });
      }
    }

    // =========================================================================
    // OUTFIT TEMPLATES MANAGER
    // =========================================================================
    if (path === "/api/admin/outfits") {
      if (request.method === "GET") {
        const res = await db
          .prepare("SELECT * FROM outfit_templates ORDER BY display_order ASC, created_at ASC")
          .all<OutfitTemplateRecord>();
        return json({ outfits: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson<{
          name?: string;
          category?: OutfitCategory;
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const name = String(body?.name || "").trim();
        const category = body?.category || "Custom";
        if (!name || !OUTFIT_CATEGORIES.includes(category)) {
          return json({ error: "Valid outfit name and category are required." }, 400);
        }
        let imageUrl = body?.imageUrl?.trim() || null;
        const mediaId = body?.mediaId || null;
        if (mediaId && !imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          imageUrl = mf?.public_url || null;
        }
        const id = generateId();
        const slug = `custom-${id.slice(0, 8)}`;
        const now = new Date().toISOString();
        const order = Number(body?.displayOrder ?? 100);
        const isPub = body?.isPublished === false ? 0 : 1;

        await db
          .prepare(
            `INSERT INTO outfit_templates
             (id, slug, name, category, builtin_style_id, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, slug, name.slice(0, 100), category, mediaId, imageUrl, order, isPub, now, now)
          .run();

        const created = await db
          .prepare("SELECT * FROM outfit_templates WHERE id = ?")
          .bind(id)
          .first<OutfitTemplateRecord>();
        await logActivity(db, admin, "Created Outfit Template", "outfit", id, name);
        return json({ outfit: created }, 201);
      }
    }

    const outfitIdMatch = path.match(/^\/api\/admin\/outfits\/([^/]+)$/);
    if (outfitIdMatch) {
      const id = decodeURIComponent(outfitIdMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM outfit_templates WHERE id = ?")
        .bind(id)
        .first<OutfitTemplateRecord>();
      if (!existing) return json({ error: "Outfit template not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{
          name?: string;
          category?: OutfitCategory;
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const name = body?.name?.trim() ? body.name.trim().slice(0, 100) : existing.name;
        const category =
          body?.category && OUTFIT_CATEGORIES.includes(body.category)
            ? body.category
            : existing.category;
        let mediaId = body?.mediaId !== undefined ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== undefined ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const order =
          body?.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order;
        const isPub =
          body?.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published;
        const now = new Date().toISOString();

        await db
          .prepare(
            `UPDATE outfit_templates
             SET name = ?, category = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(name, category, mediaId || null, imageUrl || null, order, isPub, now, id)
          .run();

        const updated = await db
          .prepare("SELECT * FROM outfit_templates WHERE id = ?")
          .bind(id)
          .first<OutfitTemplateRecord>();
        await logActivity(db, admin, "Updated Outfit Template", "outfit", id, name);
        return json({ outfit: updated });
      }

      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM outfit_templates WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Outfit Template", "outfit", id, existing.name);
        return json({ ok: true });
      }
    }

    // =========================================================================
    // BACKGROUND PRESETS MANAGER
    // =========================================================================
    if (path === "/api/admin/backgrounds") {
      if (request.method === "GET") {
        const res = await db
          .prepare("SELECT * FROM background_presets ORDER BY display_order ASC, created_at ASC")
          .all<BackgroundPresetRecord>();
        return json({ backgrounds: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson<{
          name?: string;
          presetType?: "color" | "image";
          hexColor?: string;
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const name = String(body?.name || "").trim();
        const presetType = body?.presetType === "image" ? "image" : "color";
        if (!name) return json({ error: "Background name is required." }, 400);

        let hexColor = body?.hexColor?.trim() || "#FFFFFF";
        if (presetType === "color" && !isValidHexColor(hexColor)) {
          return json({ error: "Color must be a valid #RRGGBB hex value." }, 400);
        }
        let imageUrl = body?.imageUrl?.trim() || null;
        const mediaId = body?.mediaId || null;
        if (mediaId && !imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          imageUrl = mf?.public_url || null;
        }
        if (presetType === "image" && !imageUrl) {
          return json({ error: "Background image URL or media upload is required." }, 400);
        }

        const id = generateId();
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO background_presets
             (id, name, preset_type, hex_color, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            name.slice(0, 80),
            presetType,
            presetType === "color" ? hexColor.toUpperCase() : null,
            mediaId,
            imageUrl,
            Number(body?.displayOrder ?? 50),
            body?.isPublished === false ? 0 : 1,
            now,
            now
          )
          .run();

        const created = await db
          .prepare("SELECT * FROM background_presets WHERE id = ?")
          .bind(id)
          .first<BackgroundPresetRecord>();
        await logActivity(db, admin, "Created Background Preset", "background", id, name);
        return json({ background: created }, 201);
      }
    }

    const bgIdMatch = path.match(/^\/api\/admin\/backgrounds\/([^/]+)$/);
    if (bgIdMatch) {
      const id = decodeURIComponent(bgIdMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM background_presets WHERE id = ?")
        .bind(id)
        .first<BackgroundPresetRecord>();
      if (!existing) return json({ error: "Background preset not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{
          name?: string;
          presetType?: "color" | "image";
          hexColor?: string | null;
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);

        const name = body?.name?.trim() ? body.name.trim().slice(0, 80) : existing.name;
        const presetType =
          body?.presetType === "image" || body?.presetType === "color"
            ? body.presetType
            : existing.preset_type;
        const hexColor =
          body?.hexColor !== undefined ? body.hexColor : existing.hex_color;
        if (presetType === "color" && (!hexColor || !isValidHexColor(hexColor))) {
          return json({ error: "Valid #RRGGBB hex color required." }, 400);
        }
        const mediaId = body?.mediaId !== undefined ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== undefined ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = new Date().toISOString();

        await db
          .prepare(
            `UPDATE background_presets
             SET name = ?, preset_type = ?, hex_color = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            name,
            presetType,
            hexColor ? hexColor.toUpperCase() : null,
            mediaId || null,
            imageUrl || null,
            body?.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order,
            body?.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
            now,
            id
          )
          .run();

        const updated = await db
          .prepare("SELECT * FROM background_presets WHERE id = ?")
          .bind(id)
          .first<BackgroundPresetRecord>();
        await logActivity(db, admin, "Updated Background Preset", "background", id, name);
        return json({ background: updated });
      }

      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM background_presets WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Background Preset", "background", id, existing.name);
        return json({ ok: true });
      }
    }

    // =========================================================================
    // SAMPLE PORTRAITS MANAGER
    // =========================================================================
    if (path === "/api/admin/portraits") {
      if (request.method === "GET") {
        const res = await db
          .prepare("SELECT * FROM sample_portraits ORDER BY display_order ASC, created_at DESC")
          .all<SamplePortraitRecord>();
        return json({ portraits: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson<{
          title?: string;
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const title = String(body?.title || "").trim();
        let imageUrl = body?.imageUrl?.trim() || "";
        const mediaId = body?.mediaId || null;
        if (mediaId && !imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          imageUrl = mf?.public_url || "";
        }
        if (!title || !imageUrl) {
          return json({ error: "Portrait title and image are required." }, 400);
        }
        const id = generateId();
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO sample_portraits
             (id, title, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            title.slice(0, 100),
            mediaId,
            imageUrl,
            Number(body?.displayOrder ?? 10),
            body?.isPublished === false ? 0 : 1,
            now,
            now
          )
          .run();

        const created = await db
          .prepare("SELECT * FROM sample_portraits WHERE id = ?")
          .bind(id)
          .first<SamplePortraitRecord>();
        await logActivity(db, admin, "Added Sample Portrait", "portrait", id, title);
        return json({ portrait: created }, 201);
      }
    }

    const portraitIdMatch = path.match(/^\/api\/admin\/portraits\/([^/]+)$/);
    if (portraitIdMatch) {
      const id = decodeURIComponent(portraitIdMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM sample_portraits WHERE id = ?")
        .bind(id)
        .first<SamplePortraitRecord>();
      if (!existing) return json({ error: "Sample portrait not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{
          title?: string;
          mediaId?: string | null;
          imageUrl?: string;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const title = body?.title?.trim() ? body.title.trim().slice(0, 100) : existing.title;
        const mediaId = body?.mediaId !== undefined ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== undefined ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = new Date().toISOString();
        await db
          .prepare(
            `UPDATE sample_portraits
             SET title = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            title,
            mediaId || null,
            imageUrl,
            body?.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order,
            body?.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
            now,
            id
          )
          .run();

        const updated = await db
          .prepare("SELECT * FROM sample_portraits WHERE id = ?")
          .bind(id)
          .first<SamplePortraitRecord>();
        await logActivity(db, admin, "Updated Sample Portrait", "portrait", id, title);
        return json({ portrait: updated });
      }

      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM sample_portraits WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Sample Portrait", "portrait", id, existing.title);
        return json({ ok: true });
      }
    }

    // =========================================================================
    // WEBSITE SETTINGS CMS
    // =========================================================================
    if (path === "/api/admin/settings") {
      if (request.method === "GET") {
        const settings = await readWebsiteSettings(db);
        return json({ settings });
      }
      if (request.method === "PUT") {
        const body = await safeJson<Partial<WebsiteSettings>>(request);
        if (!body) return json({ error: "Invalid settings payload." }, 400);
        const current = await readWebsiteSettings(db);
        const merged: WebsiteSettings = {
          ...DEFAULT_WEBSITE_SETTINGS,
          ...current,
          ...body,
          maxImageUploadMb: Math.min(
            50,
            Math.max(1, Number(body.maxImageUploadMb ?? current.maxImageUploadMb) || 10)
          ),
          maxPdfUploadMb: Math.min(
            100,
            Math.max(1, Number(body.maxPdfUploadMb ?? current.maxPdfUploadMb) || 20)
          ),
          maxCustomUploadMb: Math.min(
            100,
            Math.max(1, Number(body.maxCustomUploadMb ?? current.maxCustomUploadMb) || 25)
          ),
          allowAnyUpload:
            typeof body.allowAnyUpload === "boolean"
              ? body.allowAnyUpload
              : current.allowAnyUpload,
          allowedUploadExtensions: Array.isArray(body.allowedUploadExtensions)
            ? Array.from(
                new Set(
                  body.allowedUploadExtensions
                    .map((ext) => normalizeExtension(String(ext || "")))
                    .filter(Boolean)
                )
              ).slice(0, 60)
            : current.allowedUploadExtensions,
          uploadCategories: Array.isArray(body.uploadCategories)
            ? Array.from(
                new Set(
                  body.uploadCategories
                    .map((c) =>
                      String(c || "")
                        .trim()
                        .toLowerCase()
                        .replace(/[^a-z0-9_-]/g, "_")
                        .slice(0, 40)
                    )
                    .filter(Boolean)
                )
              ).slice(0, 30)
            : current.uploadCategories,
        };
        const now = new Date().toISOString();
        await db
          .prepare(
            "INSERT OR REPLACE INTO website_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)"
          )
          .bind("site_cms", JSON.stringify(merged), now)
          .run();
        await logActivity(db, admin, "Updated Website CMS Settings", "settings", "site_cms");
        return json({ settings: merged });
      }
    }

    // =========================================================================
    // SERVICES CMS
    // =========================================================================
    if (path === "/api/admin/services") {
      if (request.method === "GET") {
        const res = await db
          .prepare("SELECT * FROM services ORDER BY display_order ASC, created_at ASC")
          .all<ServiceRecord>();
        return json({ services: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson<{
          name?: string;
          description?: string;
          category?: string;
          studioMode?: ServiceRecord["studio_mode"];
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const name = String(body?.name || "").trim();
        const description = String(body?.description || "").trim();
        if (!name || !description) {
          return json({ error: "Service name and description are required." }, 400);
        }
        const mediaId = body?.mediaId || null;
        let imageUrl = body?.imageUrl?.trim() || null;
        if (mediaId && !imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          imageUrl = mf?.public_url || null;
        }
        const id = generateId();
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO services
             (id, name, description, category, studio_mode, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            name.slice(0, 100),
            description.slice(0, 500),
            String(body?.category || "Commercial Printing").trim().slice(0, 60),
            body?.studioMode || null,
            mediaId,
            imageUrl,
            Number(body?.displayOrder ?? 20),
            body?.isPublished === false ? 0 : 1,
            now,
            now
          )
          .run();

        const created = await db
          .prepare("SELECT * FROM services WHERE id = ?")
          .bind(id)
          .first<ServiceRecord>();
        await logActivity(db, admin, "Created Service", "service", id, name);
        return json({ service: created }, 201);
      }
    }

    const serviceIdMatch = path.match(/^\/api\/admin\/services\/([^/]+)$/);
    if (serviceIdMatch) {
      const id = decodeURIComponent(serviceIdMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM services WHERE id = ?")
        .bind(id)
        .first<ServiceRecord>();
      if (!existing) return json({ error: "Service not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{
          name?: string;
          description?: string;
          category?: string;
          studioMode?: ServiceRecord["studio_mode"];
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const mediaId = body?.mediaId !== undefined ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== undefined ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = new Date().toISOString();
        await db
          .prepare(
            `UPDATE services
             SET name = ?, description = ?, category = ?, studio_mode = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            body?.name?.trim() ? body.name.trim().slice(0, 100) : existing.name,
            body?.description?.trim() ? body.description.trim().slice(0, 500) : existing.description,
            body?.category?.trim() ? body.category.trim().slice(0, 60) : existing.category,
            body?.studioMode !== undefined ? body.studioMode : existing.studio_mode,
            mediaId || null,
            imageUrl || null,
            body?.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order,
            body?.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
            now,
            id
          )
          .run();

        const updated = await db
          .prepare("SELECT * FROM services WHERE id = ?")
          .bind(id)
          .first<ServiceRecord>();
        await logActivity(db, admin, "Updated Service", "service", id, updated?.name || existing.name);
        return json({ service: updated });
      }

      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM services WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Service", "service", id, existing.name);
        return json({ ok: true });
      }
    }

    // =========================================================================
    // PORTFOLIO CMS
    // =========================================================================
    if (path === "/api/admin/portfolio") {
      if (request.method === "GET") {
        const res = await db
          .prepare("SELECT * FROM portfolio_items ORDER BY display_order ASC, created_at DESC")
          .all<PortfolioItemRecord>();
        return json({ portfolio: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson<{
          title?: string;
          subtitle?: string;
          category?: string;
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const title = String(body?.title || "").trim();
        const subtitle = String(body?.subtitle || "").trim();
        const category = String(body?.category || "Branding").trim();
        if (!title) return json({ error: "Project title is required." }, 400);

        const mediaId = body?.mediaId || null;
        let imageUrl = body?.imageUrl?.trim() || null;
        if (mediaId && !imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          imageUrl = mf?.public_url || null;
        }
        const id = generateId();
        const now = new Date().toISOString();
        await db
          .prepare(
            `INSERT INTO portfolio_items
             (id, title, subtitle, category, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            id,
            title.slice(0, 120),
            subtitle.slice(0, 300),
            category.slice(0, 60),
            mediaId,
            imageUrl,
            Number(body?.displayOrder ?? 20),
            body?.isPublished === false ? 0 : 1,
            now,
            now
          )
          .run();

        const created = await db
          .prepare("SELECT * FROM portfolio_items WHERE id = ?")
          .bind(id)
          .first<PortfolioItemRecord>();
        await logActivity(db, admin, "Created Portfolio Project", "portfolio", id, title);
        return json({ item: created }, 201);
      }
    }

    const portfolioIdMatch = path.match(/^\/api\/admin\/portfolio\/([^/]+)$/);
    if (portfolioIdMatch) {
      const id = decodeURIComponent(portfolioIdMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM portfolio_items WHERE id = ?")
        .bind(id)
        .first<PortfolioItemRecord>();
      if (!existing) return json({ error: "Portfolio item not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{
          title?: string;
          subtitle?: string;
          category?: string;
          mediaId?: string | null;
          imageUrl?: string | null;
          displayOrder?: number;
          isPublished?: boolean;
        }>(request);
        const mediaId = body?.mediaId !== undefined ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== undefined ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db
            .prepare("SELECT public_url FROM media_files WHERE id = ?")
            .bind(mediaId)
            .first<{ public_url: string | null }>();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = new Date().toISOString();
        await db
          .prepare(
            `UPDATE portfolio_items
             SET title = ?, subtitle = ?, category = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(
            body?.title?.trim() ? body.title.trim().slice(0, 120) : existing.title,
            body?.subtitle !== undefined ? body.subtitle.trim().slice(0, 300) : existing.subtitle,
            body?.category?.trim() ? body.category.trim().slice(0, 60) : existing.category,
            mediaId || null,
            imageUrl || null,
            body?.displayOrder !== undefined ? Number(body.displayOrder) : existing.display_order,
            body?.isPublished !== undefined ? (body.isPublished ? 1 : 0) : existing.is_published,
            now,
            id
          )
          .run();

        const updated = await db
          .prepare("SELECT * FROM portfolio_items WHERE id = ?")
          .bind(id)
          .first<PortfolioItemRecord>();
        await logActivity(
          db,
          admin,
          "Updated Portfolio Project",
          "portfolio",
          id,
          updated?.title || existing.title
        );
        return json({ item: updated });
      }

      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM portfolio_items WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Portfolio Project", "portfolio", id, existing.title);
        return json({ ok: true });
      }
    }

    // =========================================================================
    // QUOTE REQUESTS CRM
    // =========================================================================
    if (path === "/api/admin/quotes" && request.method === "GET") {
      const res = await db
        .prepare("SELECT * FROM quote_requests ORDER BY created_at DESC")
        .all<QuoteRequestRecord>();
      return json({ quotes: res.results });
    }

    const quoteIdMatch = path.match(/^\/api\/admin\/quotes\/([^/]+)$/);
    if (quoteIdMatch) {
      const id = decodeURIComponent(quoteIdMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM quote_requests WHERE id = ?")
        .bind(id)
        .first<QuoteRequestRecord>();
      if (!existing) return json({ error: "Quote request not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{
          status?: QuoteStatus;
          internalNotes?: string;
        }>(request);
        const nextStatus =
          body?.status && QUOTE_STATUSES.includes(body.status)
            ? body.status
            : existing.status;
        const nextNotes =
          body?.internalNotes !== undefined
            ? String(body.internalNotes).slice(0, 4000)
            : existing.internal_notes;
        const now = new Date().toISOString();
        await db
          .prepare(
            "UPDATE quote_requests SET status = ?, internal_notes = ?, updated_at = ? WHERE id = ?"
          )
          .bind(nextStatus, nextNotes, now, id)
          .run();
        const updated = await db
          .prepare("SELECT * FROM quote_requests WHERE id = ?")
          .bind(id)
          .first<QuoteRequestRecord>();
        await logActivity(
          db,
          admin,
          `Updated Quote Status -> ${nextStatus}`,
          "quote",
          id,
          existing.customer_name
        );
        return json({ quote: updated });
      }

      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM quote_requests WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Quote Request", "quote", id, existing.customer_name);
        return json({ ok: true });
      }
    }

    // =========================================================================
    // CONTACT MESSAGES (MAIL DESK)
    // =========================================================================
    if (path === "/api/admin/messages" && request.method === "GET") {
      const res = await db
        .prepare("SELECT * FROM contact_messages ORDER BY created_at DESC")
        .all<ContactMessageRecord>();
      return json({
        messages: res.results,
        emailProviderConfigured: Boolean(env.RESEND_API_KEY),
      });
    }

    const msgReplyMatch = path.match(/^\/api\/admin\/messages\/([^/]+)\/reply$/);
    if (msgReplyMatch && request.method === "POST") {
      const id = decodeURIComponent(msgReplyMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM contact_messages WHERE id = ?")
        .bind(id)
        .first<ContactMessageRecord>();
      if (!existing) return json({ error: "Message not found." }, 404);

      const body = await safeJson<{ subject?: string; replyText?: string }>(request);
      const replyText = String(body?.replyText || "").trim();
      const subject = String(body?.subject || `Re: ${existing.subject}`).trim();
      if (!replyText) {
        return json({ error: "Reply message cannot be empty." }, 400);
      }

      const now = new Date().toISOString();
      if (env.RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM || "SUN-NOVA PRINT SERVICE <onboarding@resend.dev>",
            to: [existing.customer_email],
            subject,
            text: replyText,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text();
          return json(
            {
              sent: false,
              configured: true,
              error: `Email provider error: ${errBody.slice(0, 200)}`,
            },
            502
          );
        }

        await db
          .prepare(
            "UPDATE contact_messages SET is_read = 1, reply_note = ?, replied_at = ?, updated_at = ? WHERE id = ?"
          )
          .bind(replyText.slice(0, 4000), now, now, id)
          .run();

        await logActivity(
          db,
          admin,
          "Sent Email Reply",
          "message",
          id,
          `To: ${existing.customer_email}`
        );

        return json({
          sent: true,
          configured: true,
          message: "Email reply sent via configured mail provider.",
        });
      }

      // Honest fallback: no email API key configured — do not claim email was sent!
      await db
        .prepare(
          "UPDATE contact_messages SET is_read = 1, reply_note = ?, updated_at = ? WHERE id = ?"
        )
        .bind(`[Draft saved — send via mail client]\n${replyText.slice(0, 3800)}`, now, id)
        .run();

      await logActivity(
        db,
        admin,
        "Saved Reply Draft (No Email Provider)",
        "message",
        id,
        `Draft prepared for ${existing.customer_email}`
      );

      return json({
        sent: false,
        configured: false,
        message:
          "No transactional email provider (RESEND_API_KEY) is configured on the server. Draft saved cleanly—click Open Mail Client to send the actual email.",
      });
    }

    const msgIdMatch = path.match(/^\/api\/admin\/messages\/([^/]+)$/);
    if (msgIdMatch) {
      const id = decodeURIComponent(msgIdMatch[1]);
      const existing = await db
        .prepare("SELECT * FROM contact_messages WHERE id = ?")
        .bind(id)
        .first<ContactMessageRecord>();
      if (!existing) return json({ error: "Message not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{ isRead?: boolean }>(request);
        const isRead = body?.isRead ? 1 : 0;
        const now = new Date().toISOString();
        await db
          .prepare("UPDATE contact_messages SET is_read = ?, updated_at = ? WHERE id = ?")
          .bind(isRead, now, id)
          .run();
        const updated = await db
          .prepare("SELECT * FROM contact_messages WHERE id = ?")
          .bind(id)
          .first<ContactMessageRecord>();
        return json({ message: updated });
      }

      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM contact_messages WHERE id = ?").bind(id).run();
        await logActivity(
          db,
          admin,
          "Deleted Contact Message",
          "message",
          id,
          existing.customer_email
        );
        return json({ ok: true });
      }
    }

    // =========================================================================
    // ADMIN USERS & AUDIT ACTIVITY
    // =========================================================================
    if (path === "/api/admin/users") {
      if (request.method === "GET") {
        const res = await db
          .prepare(
            "SELECT id, name, email, role, status, last_login_at, created_at, updated_at FROM admins ORDER BY created_at ASC"
          )
          .all<AdminUser>();
        return json({ users: res.results });
      }

      if (request.method === "POST") {
        if (admin.role !== "super_admin") {
          return json(
            { error: "Only Super Admin can create administrator accounts." },
            403
          );
        }
        const body = await safeJson<{
          name?: string;
          email?: string;
          password?: string;
          role?: AdminRole;
        }>(request);
        const name = String(body?.name || "").trim();
        const email = sanitizeEmail(String(body?.email || ""));
        const password = String(body?.password || "");
        const role: AdminRole =
          body?.role === "super_admin" ||
          body?.role === "admin" ||
          body?.role === "content_manager"
            ? body.role
            : "content_manager";

        if (!name || !isValidEmail(email) || password.length < 8) {
          return json(
            { error: "Name, valid email, and password (min 8 chars) are required." },
            400
          );
        }

        const dup = await db
          .prepare("SELECT id FROM admins WHERE email = ?")
          .bind(email)
          .first<{ id: string }>();
        if (dup) {
          return json({ error: "An administrator with that email already exists." }, 409);
        }

        const id = generateId();
        const now = new Date().toISOString();
        const pwHash = await hashPassword(password);
        await db
          .prepare(
            `INSERT INTO admins (id, name, email, password_hash, role, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
          )
          .bind(id, name.slice(0, 100), email, pwHash, role, now, now)
          .run();

        const created = await db
          .prepare(
            "SELECT id, name, email, role, status, last_login_at, created_at, updated_at FROM admins WHERE id = ?"
          )
          .bind(id)
          .first<AdminUser>();
        await logActivity(
          db,
          admin,
          `Created ${role} Account`,
          "admin",
          id,
          email
        );
        return json({ user: created }, 201);
      }
    }

    const userIdMatch = path.match(/^\/api\/admin\/users\/([^/]+)$/);
    if (userIdMatch) {
      const id = decodeURIComponent(userIdMatch[1]);
      const target = await db
        .prepare("SELECT * FROM admins WHERE id = ?")
        .bind(id)
        .first<AdminUser & { password_hash: string }>();
      if (!target) return json({ error: "Administrator not found." }, 404);

      if (request.method === "PUT") {
        const body = await safeJson<{
          name?: string;
          role?: AdminRole;
          status?: "active" | "disabled";
          currentPassword?: string;
          newPassword?: string;
        }>(request);

        const isSelf = target.id === admin.id;
        if (!isSelf && admin.role !== "super_admin") {
          return json(
            { error: "Only Super Admin can modify other administrator accounts." },
            403
          );
        }

        const now = new Date().toISOString();
        if (body?.newPassword) {
          if (body.newPassword.length < 8) {
            return json({ error: "New password must be at least 8 characters." }, 400);
          }
          if (isSelf) {
            if (!body.currentPassword) {
              return json({ error: "Current password is required." }, 400);
            }
            const ok = await verifyPassword(body.currentPassword, target.password_hash);
            if (!ok) return json({ error: "Current password is incorrect." }, 403);
          }
          const nextHash = await hashPassword(body.newPassword);
          await db
            .prepare("UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?")
            .bind(nextHash, now, id)
            .run();
          await logActivity(db, admin, "Changed Admin Password", "admin", id, target.email);
        }

        const nextName = body?.name?.trim() ? body.name.trim().slice(0, 100) : target.name;
        const nextRole =
          admin.role === "super_admin" &&
          (body?.role === "super_admin" ||
            body?.role === "admin" ||
            body?.role === "content_manager")
            ? body.role
            : target.role;
        const nextStatus =
          admin.role === "super_admin" &&
          !isSelf &&
          (body?.status === "active" || body?.status === "disabled")
            ? body.status
            : target.status;

        await db
          .prepare(
            "UPDATE admins SET name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?"
          )
          .bind(nextName, nextRole, nextStatus, now, id)
          .run();

        if (nextStatus === "disabled") {
          await db.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").bind(id).run();
        }

        const updated = await db
          .prepare(
            "SELECT id, name, email, role, status, last_login_at, created_at, updated_at FROM admins WHERE id = ?"
          )
          .bind(id)
          .first<AdminUser>();
        await logActivity(db, admin, "Updated Admin Account", "admin", id, `${target.email} (${nextRole})`);
        return json({ user: updated });
      }

      if (request.method === "DELETE") {
        if (admin.role !== "super_admin") {
          return json(
            { error: "Only Super Admin can delete administrator accounts." },
            403
          );
        }
        if (target.id === admin.id) {
          return json({ error: "You cannot delete your own active session account." }, 400);
        }
        await db.prepare("DELETE FROM admins WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Admin Account", "admin", id, target.email);
        return json({ ok: true });
      }
    }

    if (path === "/api/admin/activity" && request.method === "GET") {
      const res = await db
        .prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100")
        .all();
      return json({ logs: res.results });
    }

    return json({ error: "API endpoint not found." }, 404);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("API Router Error:", err);
    return json({ error: message }, 500);
  }
}
