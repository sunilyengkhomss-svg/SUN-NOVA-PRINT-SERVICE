var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// functions/api/chat.ts
var SYSTEM_INSTRUCTION = `You are the official studio assistant for SUN-NOVA PRINT SERVICE, a 300 PPI browser-based passport photo maker, formal outfit studio, Aadhaar/PAN/Voter ID/DL Xerox sheet builder, PDF/Text converter, and Professional Resume Maker.

Key capabilities of SUN-NOVA PRINT SERVICE:
1. Passport & Exam Photo Presets (300 PPI with JFIF metadata): 1.2\xD71.5 in (360\xD7450 px), India Passport 35\xD745 mm (413\xD7531 px), Passport Seva 630\xD7810 px, US Visa/OCI 2\xD72 in, PAN 25\xD735 mm, Custom Inch Size.
2. Print Sheet Layout & Multi-Photo Queue: 4\xD76, 5\xD77, 6\xD78, A5, A4 (2480\xD73508 px), uniform 0\u20135 mm gap, A4 1-Line (6 Different Photos), Undo & Redo controls.
3. Passport Dress Generator: Student, Officer, Men, Women, and Formal outfits with Size/X/Y adjustment.
4. Outline & Border Customization: Solid/Dashed/Dotted styles, 0\u201316 px width, Flush or Outer Cut Offset, custom color.
5. Aadhaar, PAN, Voter ID & DL Xerox Sheet: Front/Back via Upload, Camera, or Upload One & Crop Both, Side-by-Side / Up-Down / 2\xD72 Grid / Front Only, Custom mm size, B&W Xerox polish.
6. PDF, XML & Text Converters: Photo to PDF, PDF to Photo (150\u2013300 DPI), Text to Image, Image to Text (OCR), and XML Converter (XML <-> JSON, CSV, Formatted/Minified XML, Plain Text).
7. Professional Resume Maker: Presets for Business, Teacher, Finance, IT, Healthcare, Sales, Student, and Custom roles with 4 templates, Undo/Redo, and 300 PPI PDF/JPG/PNG export.
8. Contact Policy: NEVER display or invent any phone number. All customer queries go strictly via Email.

Respond concisely, clearly, and practically in short paragraphs or bullet points.`;
async function onRequestPost(context) {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "AI assistant is not configured yet. Add GEMINI_API_KEY in Cloudflare Pages > Settings > Environment variables."
      },
      { status: 500 }
    );
  }
  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  const validTurns = (Array.isArray(body.messages) ? body.messages : []).filter(
    (m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim().length > 0
  ).slice(-12);
  if (validTurns.length === 0 || validTurns[validTurns.length - 1].role !== "user") {
    return Response.json({ error: "Please enter a question to ask." }, { status: 400 });
  }
  const fullInstruction = body.studioContext ? `${SYSTEM_INSTRUCTION}

Current User Studio State:
${body.studioContext}` : SYSTEM_INSTRUCTION;
  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastErrMsg = "Failed to get AI response.";
  for (const modelName of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
            "User-Agent": "aistudio-build"
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: fullInstruction }] },
            contents: validTurns.map((m) => ({
              role: m.role,
              parts: [{ text: m.text }]
            }))
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        lastErrMsg = data?.error?.message || `HTTP ${res.status}`;
        continue;
      }
      const reply = (data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "").trim();
      if (reply) {
        return Response.json({ reply });
      }
    } catch (err) {
      lastErrMsg = err instanceof Error ? err.message : String(err);
    }
  }
  return Response.json({ error: lastErrMsg }, { status: 503 });
}
__name(onRequestPost, "onRequestPost");

// functions/api/ocr.ts
async function onRequestPost2(context) {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "OCR service is not configured yet. Add GEMINI_API_KEY in Cloudflare Pages > Settings > Environment variables."
      },
      { status: 500 }
    );
  }
  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  if (!body.imageBase64 || typeof body.imageBase64 !== "string") {
    return Response.json({ error: "Please upload an image first." }, { status: 400 });
  }
  const safeMime = typeof body.mimeType === "string" && body.mimeType.startsWith("image/") ? body.mimeType : "image/jpeg";
  const modeInstruction = body.mode === "paragraph" ? "Extract all text from this image as clean, readable paragraphs. Fix obvious OCR line breaks without changing wording." : body.mode === "id_card" ? "Extract all visible text, numbers, names, dates, and addresses from this document or ID card cleanly as labeled key-value lines." : body.mode === "table" ? "Extract all text and tabular rows from this image cleanly, preserving columns separated by ' | ' or Markdown table formatting." : "Transcribe all text visible in this image accurately, preserving line breaks and reading order. Return only the extracted text without commentary.";
  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastErrMsg = "Failed to extract text.";
  for (const modelName of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
            "User-Agent": "aistudio-build"
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: safeMime,
                      data: body.imageBase64
                    }
                  },
                  { text: modeInstruction }
                ]
              }
            ]
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        lastErrMsg = data?.error?.message || `HTTP ${res.status}`;
        continue;
      }
      const text = (data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "").trim();
      return Response.json({
        text: text || "No readable text detected in this image."
      });
    } catch (err) {
      lastErrMsg = err instanceof Error ? err.message : String(err);
    }
  }
  return Response.json({ error: lastErrMsg }, { status: 503 });
}
__name(onRequestPost2, "onRequestPost");

// functions/api/resume-assist.ts
async function onRequestPost3(context) {
  const apiKey = context.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error: "AI Resume helper is not configured yet. Add GEMINI_API_KEY in Cloudflare Pages > Settings > Environment variables."
      },
      { status: 500 }
    );
  }
  let body;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload." }, { status: 400 });
  }
  const prompt = body.task === "suggest_bullets" ? `Write 3 concise, high-impact resume bullet points (each starting with "\u2022 ") for a "${body.role || body.jobTitle || "Professional"}"${body.organization ? ` at "${body.organization}"` : ""}. Keep them realistic, action-oriented, and ready to paste into a resume. Do not include headings or explanations.${body.currentText ? `

Existing notes/draft:
${body.currentText}` : ""}` : `Polish and strengthen this resume professional summary for a "${body.jobTitle || "Professional"}" into 2\u20133 crisp, ATS-friendly sentences in third/implied first person without pronouns. Return only the polished summary text.${body.currentText ? `

Draft:
${body.currentText}` : ""}`;
  const modelsToTry = ["gemini-4-hydrogen", "gemini-3.1-flash-lite"];
  let lastErrMsg = "Failed to generate suggestion.";
  for (const modelName of modelsToTry) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
            "User-Agent": "aistudio-build"
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }]
          })
        }
      );
      const data = await res.json();
      if (!res.ok) {
        lastErrMsg = data?.error?.message || `HTTP ${res.status}`;
        continue;
      }
      const text = (data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "").trim();
      if (text) {
        return Response.json({ text });
      }
    } catch (err) {
      lastErrMsg = err instanceof Error ? err.message : String(err);
    }
  }
  return Response.json({ error: lastErrMsg }, { status: 503 });
}
__name(onRequestPost3, "onRequestPost");

// src/backend/crypto.ts
var PBKDF2_ITERATIONS = 1e5;
function toBase64Url(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(toBase64Url, "toBase64Url");
function fromBase64Url(str) {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(fromBase64Url, "fromBase64Url");
function generateId() {
  return crypto.randomUUID();
}
__name(generateId, "generateId");
function generateSecureToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}
__name(generateSecureToken, "generateSecureToken");
async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    keyMaterial,
    256
  );
  const hashBytes = new Uint8Array(derivedBits);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hashBytes)}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, storedHash) {
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1e4 || iterations > 5e5) {
    return false;
  }
  const salt = fromBase64Url(parts[2]);
  const expected = fromBase64Url(parts[3]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    keyMaterial,
    expected.length * 8
  );
  const actual = new Uint8Array(derivedBits);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual[i] ^ expected[i];
  }
  return diff === 0;
}
__name(verifyPassword, "verifyPassword");
function sanitizeFilename(name) {
  const base = name.split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 120) || "upload";
}
__name(sanitizeFilename, "sanitizeFilename");
var BLOCKED_DANGEROUS_EXTENSIONS = /* @__PURE__ */ new Set([
  "exe",
  "msi",
  "bat",
  "cmd",
  "sh",
  "ps1",
  "vbs",
  "vbe",
  "js",
  "jse",
  "wsf",
  "wsh",
  "scr",
  "dll",
  "sys",
  "com",
  "pif",
  "cpl",
  "hta",
  "jar",
  "php",
  "phtml",
  "jsp",
  "asp",
  "aspx",
  "cgi"
]);
var SAFE_EXTENSION_MIME_MAP = {
  jpg: { mime: "image/jpeg", isImage: true },
  jpeg: { mime: "image/jpeg", isImage: true },
  png: { mime: "image/png", isImage: true },
  webp: { mime: "image/webp", isImage: true },
  gif: { mime: "image/gif", isImage: true },
  bmp: { mime: "image/bmp", isImage: true },
  tiff: { mime: "image/tiff", isImage: true },
  tif: { mime: "image/tiff", isImage: true },
  avif: { mime: "image/avif", isImage: true },
  ico: { mime: "image/x-icon", isImage: true },
  svg: { mime: "image/svg+xml", isImage: true, isText: true },
  pdf: { mime: "application/pdf" },
  xml: { mime: "application/xml", isText: true },
  xsd: { mime: "application/xml", isText: true },
  xsl: { mime: "application/xml", isText: true },
  xslt: { mime: "application/xml", isText: true },
  json: { mime: "application/json", isText: true },
  csv: { mime: "text/csv", isText: true },
  tsv: { mime: "text/tab-separated-values", isText: true },
  txt: { mime: "text/plain", isText: true },
  md: { mime: "text/markdown", isText: true },
  log: { mime: "text/plain", isText: true },
  yaml: { mime: "text/yaml", isText: true },
  yml: { mime: "text/yaml", isText: true },
  doc: { mime: "application/msword" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xls: { mime: "application/vnd.ms-excel" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  ppt: { mime: "application/vnd.ms-powerpoint" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  rtf: { mime: "application/rtf" },
  zip: { mime: "application/zip" },
  rar: { mime: "application/vnd.rar" },
  "7z": { mime: "application/x-7z-compressed" },
  eps: { mime: "application/postscript" },
  ai: { mime: "application/postscript" },
  psd: { mime: "image/vnd.adobe.photoshop" },
  mp3: { mime: "audio/mpeg" },
  wav: { mime: "audio/wav" },
  mp4: { mime: "video/mp4" }
};
function normalizeExtension(ext) {
  return ext.trim().toLowerCase().replace(/^\.+/, "").replace(/[^a-z0-9]/g, "");
}
__name(normalizeExtension, "normalizeExtension");
function getFileExtension(filename) {
  const clean = filename.trim().split(/[/\\]/).pop() || "";
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === clean.length - 1) return "";
  return normalizeExtension(clean.slice(dotIdx + 1));
}
__name(getFileExtension, "getFileExtension");
function sniffMagicFileType(bytes) {
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) {
    return { mime: "image/png", ext: "png", isImage: true, isPdf: false };
  }
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    return { mime: "image/jpeg", ext: "jpg", isImage: true, isPdf: false };
  }
  if (bytes.length >= 6 && bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 56) {
    return { mime: "image/gif", ext: "gif", isImage: true, isPdf: false };
  }
  if (bytes.length >= 12 && bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 && bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80) {
    return { mime: "image/webp", ext: "webp", isImage: true, isPdf: false };
  }
  if (bytes.length >= 5 && bytes[0] === 37 && bytes[1] === 80 && bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45) {
    return { mime: "application/pdf", ext: "pdf", isImage: false, isPdf: true };
  }
  return null;
}
__name(sniffMagicFileType, "sniffMagicFileType");
function detectUploadFileType(bytes, declaredMime, filename, policy) {
  const fileExt = getFileExtension(filename);
  if (fileExt && BLOCKED_DANGEROUS_EXTENSIONS.has(fileExt)) {
    return {
      valid: false,
      mime: "application/octet-stream",
      ext: fileExt,
      isImage: false,
      isPdf: false,
      isText: false,
      error: `Executable/script extension ".${fileExt}" is blocked for security.`
    };
  }
  if (bytes.length >= 2 && bytes[0] === 77 && bytes[1] === 90 || bytes.length >= 4 && bytes[0] === 127 && bytes[1] === 69 && bytes[2] === 76 && bytes[3] === 70) {
    return {
      valid: false,
      mime: "application/octet-stream",
      ext: fileExt || "bin",
      isImage: false,
      isPdf: false,
      isText: false,
      error: "Executable binary payloads are blocked for security."
    };
  }
  const magic = sniffMagicFileType(bytes);
  const allowAny = policy?.allowAnyUpload !== false;
  const allowList = new Set(
    (policy?.allowedUploadExtensions || ["jpg", "jpeg", "png", "webp", "pdf"]).map(normalizeExtension).filter(Boolean)
  );
  const checkAllowed = /* @__PURE__ */ __name((extToCheck) => {
    if (allowAny) return true;
    if (extToCheck === "jpeg" && (allowList.has("jpg") || allowList.has("jpeg"))) return true;
    if (extToCheck === "jpg" && (allowList.has("jpg") || allowList.has("jpeg"))) return true;
    return allowList.has(extToCheck);
  }, "checkAllowed");
  if (magic) {
    if (!checkAllowed(magic.ext)) {
      return {
        valid: false,
        mime: magic.mime,
        ext: magic.ext,
        isImage: magic.isImage,
        isPdf: magic.isPdf,
        isText: false,
        error: `Extension ".${magic.ext}" is not enabled in the site's allowed upload list.`
      };
    }
    return {
      valid: true,
      mime: magic.mime,
      ext: magic.ext,
      isImage: magic.isImage,
      isPdf: magic.isPdf,
      isText: false
    };
  }
  const trimmedHead = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 512))).trimStart();
  let resolvedExt = fileExt;
  if (!resolvedExt) {
    if (declaredMime.includes("xml") || trimmedHead.startsWith("<?xml")) {
      resolvedExt = "xml";
    } else if (declaredMime.includes("json")) {
      resolvedExt = "json";
    } else if (declaredMime.includes("csv")) {
      resolvedExt = "csv";
    } else if (declaredMime.startsWith("text/")) {
      resolvedExt = "txt";
    } else {
      resolvedExt = "bin";
    }
  }
  if (!checkAllowed(resolvedExt)) {
    return {
      valid: false,
      mime: declaredMime || "application/octet-stream",
      ext: resolvedExt,
      isImage: false,
      isPdf: false,
      isText: false,
      error: `Extension ".${resolvedExt}" is not enabled in the site's customizable upload rules.`
    };
  }
  if (resolvedExt === "html" || resolvedExt === "htm") {
    return {
      valid: true,
      mime: "text/plain",
      ext: resolvedExt,
      isImage: false,
      isPdf: false,
      isText: true
    };
  }
  const mapped = SAFE_EXTENSION_MIME_MAP[resolvedExt];
  if (mapped) {
    return {
      valid: true,
      mime: mapped.mime,
      ext: resolvedExt,
      isImage: Boolean(mapped.isImage),
      isPdf: resolvedExt === "pdf",
      isText: Boolean(mapped.isText)
    };
  }
  const safeDeclared = declaredMime && !declaredMime.includes("html") && !declaredMime.includes("javascript") && !declaredMime.includes("x-msdownload") ? declaredMime.split(";")[0].trim() : "application/octet-stream";
  return {
    valid: true,
    mime: safeDeclared || "application/octet-stream",
    ext: resolvedExt,
    isImage: safeDeclared.startsWith("image/"),
    isPdf: false,
    isText: safeDeclared.startsWith("text/") || safeDeclared.includes("xml") || safeDeclared.includes("json")
  };
}
__name(detectUploadFileType, "detectUploadFileType");
function isValidHexColor(val) {
  return /^#[0-9A-Fa-f]{6}$/.test(val.trim());
}
__name(isValidHexColor, "isValidHexColor");
function sanitizeEmail(email) {
  return email.trim().toLowerCase().slice(0, 160);
}
__name(sanitizeEmail, "sanitizeEmail");
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
__name(isValidEmail, "isValidEmail");

// src/backend/cloudflareStorage.ts
var SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    reset_token_hash TEXT,
    reset_token_expires_at TEXT,
    last_login_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id)`,
  `CREATE TABLE IF NOT EXISTS media_files (
    id TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL UNIQUE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'image',
    visibility TEXT NOT NULL DEFAULT 'public',
    public_url TEXT,
    uploaded_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS media_blobs (
    r2_key TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    cache_control TEXT,
    data_base64 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS outfit_templates (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    builtin_style_id TEXT,
    media_id TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS background_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    preset_type TEXT NOT NULL DEFAULT 'color',
    hex_color TEXT,
    media_id TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sample_portraits (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    media_id TEXT,
    image_url TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS website_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Commercial Printing',
    studio_mode TEXT,
    media_id TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS portfolio_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    category TEXT NOT NULL,
    media_id TEXT,
    image_url TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS quote_requests (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    phone_number TEXT,
    service_type TEXT NOT NULL,
    quantity TEXT NOT NULL,
    paper_size TEXT NOT NULL,
    material TEXT,
    color_mode TEXT,
    description TEXT,
    attachment_media_id TEXT,
    attachment_name TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    internal_notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    phone_number TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    reply_note TEXT DEFAULT '',
    replied_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT,
    admin_email TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS rate_limits (
    rate_key TEXT PRIMARY KEY,
    hits INTEGER NOT NULL DEFAULT 1,
    window_start INTEGER NOT NULL
  )`
];
var initializedDbs = /* @__PURE__ */ new WeakSet();
async function ensureSchemaTables(db) {
  if (initializedDbs.has(db)) return;
  try {
    const [settingsRow] = await Promise.all([
      db.prepare("SELECT setting_key FROM website_settings LIMIT 1").first(),
      db.prepare("SELECT r2_key FROM media_blobs LIMIT 1").first()
    ]);
    if (settingsRow) {
      initializedDbs.add(db);
      return;
    }
  } catch {
  }
  try {
    await db.batch(SCHEMA_STATEMENTS.map((sql) => db.prepare(sql)));
  } catch {
    for (const sql of SCHEMA_STATEMENTS) {
      await db.prepare(sql).run();
    }
  }
  initializedDbs.add(db);
}
__name(ensureSchemaTables, "ensureSchemaTables");
function uint8ToBase64(bytes) {
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
__name(uint8ToBase64, "uint8ToBase64");
function base64ToUint8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(base64ToUint8, "base64ToUint8");
async function toUint8Array(value) {
  if (typeof value === "string") {
    return new TextEncoder().encode(value);
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (value instanceof Blob) {
    return new Uint8Array(await value.arrayBuffer());
  }
  return new Uint8Array(await new Response(value).arrayBuffer());
}
__name(toUint8Array, "toUint8Array");
var D1BlobR2Bucket = class {
  static {
    __name(this, "D1BlobR2Bucket");
  }
  constructor(db) {
    this.db = db;
  }
  async get(key) {
    await ensureSchemaTables(this.db);
    const row = await this.db.prepare("SELECT content_type, cache_control, data_base64, size_bytes FROM media_blobs WHERE r2_key = ?").bind(key).first();
    if (!row) return null;
    const bytes = base64ToUint8(row.data_base64);
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    });
    return {
      body: stream,
      async arrayBuffer() {
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        return copy.buffer;
      },
      httpMetadata: {
        contentType: row.content_type,
        cacheControl: row.cache_control || void 0
      },
      size: Number(row.size_bytes) || bytes.byteLength
    };
  }
  async put(key, value, options) {
    await ensureSchemaTables(this.db);
    const bytes = await toUint8Array(value);
    if (bytes.byteLength > 1.5 * 1024 * 1024) {
      throw new Error(
        "Cloudflare R2 (MEDIA_BUCKET) is not bound yet. Bind MEDIA_BUCKET for files over 1.5 MB, or upload a smaller file."
      );
    }
    const b64 = uint8ToBase64(bytes);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await this.db.prepare(
      `INSERT OR REPLACE INTO media_blobs (r2_key, content_type, cache_control, data_base64, size_bytes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      key,
      options?.httpMetadata?.contentType || "application/octet-stream",
      options?.httpMetadata?.cacheControl || null,
      b64,
      bytes.byteLength,
      now
    ).run();
    return { key, size: bytes.byteLength };
  }
  async delete(keys) {
    await ensureSchemaTables(this.db);
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      await this.db.prepare("DELETE FROM media_blobs WHERE r2_key = ?").bind(k).run();
    }
  }
};
var PRIMARY_KEY_BY_TABLE = {
  admins: "id",
  admin_sessions: "id",
  media_files: "id",
  media_blobs: "r2_key",
  outfit_templates: "id",
  background_presets: "id",
  sample_portraits: "id",
  website_settings: "setting_key",
  services: "id",
  portfolio_items: "id",
  quote_requests: "id",
  contact_messages: "id",
  activity_logs: "id",
  rate_limits: "rate_key"
};
function splitTopLevelCsv(input) {
  const parts = [];
  let current = "";
  let inSingleQuote = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "'" && input[i - 1] !== "\\") {
      inSingleQuote = !inSingleQuote;
      current += ch;
    } else if (ch === "," && !inSingleQuote) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}
__name(splitTopLevelCsv, "splitTopLevelCsv");
function parseValueToken(token, params, cursor) {
  const t = token.trim();
  if (t === "?") {
    const val = params[cursor.idx];
    cursor.idx += 1;
    return val === void 0 ? null : val;
  }
  if (/^NULL$/i.test(t)) return null;
  if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}
__name(parseValueToken, "parseValueToken");
function matchesWhere(row, whereClause, params, cursor) {
  if (!whereClause || !whereClause.trim()) return true;
  const conditions = whereClause.split(/\s+AND\s+/i).map((c) => c.trim()).filter(Boolean);
  for (const cond of conditions) {
    let m;
    if (m = cond.match(/^([a-zA-Z0-9_.]+)\s*=\s*(\?|'[^']*'|-?\d+|NULL)$/i)) {
      const col = m[1].split(".").pop();
      const expected = parseValueToken(m[2], params, cursor);
      if ((row[col] ?? null) !== expected) return false;
      continue;
    }
    if (m = cond.match(/^([a-zA-Z0-9_.]+)\s+IS\s+NOT\s+NULL$/i)) {
      const col = m[1].split(".").pop();
      if (row[col] === null || row[col] === void 0) return false;
      continue;
    }
    if (m = cond.match(/^([a-zA-Z0-9_.]+)\s+NOT\s+LIKE\s+'([^']*)'$/i)) {
      const col = m[1].split(".").pop();
      const pattern = new RegExp(`^${m[2].replace(/%/g, ".*")}$`, "i");
      if (pattern.test(String(row[col] ?? ""))) return false;
      continue;
    }
    if (m = cond.match(/^([a-zA-Z0-9_.]+)\s+LIKE\s+'([^']*)'$/i)) {
      const col = m[1].split(".").pop();
      const pattern = new RegExp(`^${m[2].replace(/%/g, ".*")}$`, "i");
      if (!pattern.test(String(row[col] ?? ""))) return false;
      continue;
    }
  }
  return true;
}
__name(matchesWhere, "matchesWhere");
function sortRows(rows, orderClause) {
  if (!orderClause || !orderClause.trim()) return rows;
  const specs = orderClause.split(",").map((s) => s.trim()).filter(Boolean).map((part) => {
    const [col, dir] = part.split(/\s+/);
    return { col: col.split(".").pop(), desc: /^DESC$/i.test(dir || "") };
  });
  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const av = a[s.col];
      const bv = b[s.col];
      if (av === bv) continue;
      if (av === null || av === void 0) return 1;
      if (bv === null || bv === void 0) return -1;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      if (cmp !== 0) return s.desc ? -cmp : cmp;
    }
    return 0;
  });
}
__name(sortRows, "sortRows");
var MemoryD1Statement = class _MemoryD1Statement {
  static {
    __name(this, "MemoryD1Statement");
  }
  constructor(tables, sql, params = []) {
    this.tables = tables;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.params = params;
  }
  bind(...values) {
    return new _MemoryD1Statement(this.tables, this.sql, values);
  }
  getTable(name) {
    let arr = this.tables.get(name);
    if (!arr) {
      arr = [];
      this.tables.set(name, arr);
    }
    return arr;
  }
  async run() {
    if (/^CREATE\s+(TABLE|INDEX)/i.test(this.sql)) {
      const m = this.sql.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)/i);
      if (m) this.getTable(m[1]);
      return { success: true, meta: { changes: 0 } };
    }
    const insMatch = this.sql.match(
      /^INSERT\s+(?:OR\s+(IGNORE|REPLACE)\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i
    );
    if (insMatch) {
      const mode = (insMatch[1] || "").toUpperCase();
      const table = insMatch[2];
      const cols = splitTopLevelCsv(insMatch[3]);
      const valTokens = splitTopLevelCsv(insMatch[4]);
      const cursor = { idx: 0 };
      const record = {};
      for (let i = 0; i < cols.length; i += 1) {
        record[cols[i]] = parseValueToken(valTokens[i] ?? "NULL", this.params, cursor);
      }
      const rows = this.getTable(table);
      const pk = PRIMARY_KEY_BY_TABLE[table] || "id";
      const existingIdx = rows.findIndex((r) => r[pk] !== void 0 && r[pk] === record[pk]);
      if (existingIdx !== -1) {
        if (mode === "IGNORE") {
          return { success: true, meta: { changes: 0 } };
        }
        if (mode === "REPLACE") {
          rows[existingIdx] = record;
          return { success: true, meta: { changes: 1 } };
        }
        rows[existingIdx] = record;
        return { success: true, meta: { changes: 1 } };
      }
      rows.push(record);
      return { success: true, meta: { changes: 1 } };
    }
    const updMatch = this.sql.match(
      /^UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i
    );
    if (updMatch) {
      const table = updMatch[1];
      const setPairs = splitTopLevelCsv(updMatch[2]);
      const whereClause = updMatch[3];
      const cursor = { idx: 0 };
      const assignments = [];
      for (const pair of setPairs) {
        const eqIdx = pair.indexOf("=");
        const col = pair.slice(0, eqIdx).trim();
        const rhs = pair.slice(eqIdx + 1).trim();
        if (new RegExp(`^${col}\\s*\\+\\s*1$`, "i").test(rhs)) {
          assignments.push({ col, kind: "inc" });
        } else {
          assignments.push({
            col,
            kind: "val",
            val: parseValueToken(rhs, this.params, cursor)
          });
        }
      }
      const rows = this.getTable(table);
      let changes = 0;
      const whereParamStart = cursor.idx;
      for (const r of rows) {
        const wCursor = { idx: whereParamStart };
        if (matchesWhere(r, whereClause, this.params, wCursor)) {
          for (const a of assignments) {
            if (a.kind === "inc") {
              r[a.col] = Number(r[a.col] || 0) + 1;
            } else {
              r[a.col] = a.val;
            }
          }
          changes += 1;
        }
      }
      return { success: true, meta: { changes } };
    }
    const delMatch = this.sql.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
    if (delMatch) {
      const table = delMatch[1];
      const whereClause = delMatch[2];
      const rows = this.getTable(table);
      const kept = [];
      let removed = 0;
      for (const r of rows) {
        const cursor = { idx: 0 };
        if (matchesWhere(r, whereClause, this.params, cursor)) {
          removed += 1;
        } else {
          kept.push(r);
        }
      }
      this.tables.set(table, kept);
      return { success: true, meta: { changes: removed } };
    }
    return { success: true, meta: { changes: 0 } };
  }
  async all() {
    if (/FROM\s+admin_sessions\s+s\s+INNER\s+JOIN\s+admins\s+a/i.test(this.sql)) {
      const sessions = this.getTable("admin_sessions");
      const admins = this.getTable("admins");
      const tokenHash = this.params[0];
      const matched = [];
      for (const s of sessions) {
        if (s.token_hash !== tokenHash) continue;
        const a = admins.find((adm) => adm.id === s.admin_id);
        if (a) {
          matched.push({
            id: a.id,
            name: a.name,
            email: a.email,
            role: a.role,
            status: a.status,
            last_login_at: a.last_login_at ?? null,
            created_at: a.created_at,
            updated_at: a.updated_at,
            expires_at: s.expires_at
          });
        }
      }
      return { results: matched, success: true, meta: {} };
    }
    const cntMatch = this.sql.match(
      /^SELECT\s+COUNT\(\*\)\s+as\s+([a-zA-Z0-9_]+)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i
    );
    if (cntMatch) {
      const alias = cntMatch[1];
      const table = cntMatch[2];
      const whereClause = cntMatch[3];
      const rows = this.getTable(table).filter(
        (r) => matchesWhere(r, whereClause, this.params, { idx: 0 })
      );
      return { results: [{ [alias]: rows.length }], success: true, meta: {} };
    }
    const grpMatch = this.sql.match(
      /^SELECT\s+status,\s*COUNT\(\*\)\s+as\s+count\s+FROM\s+([a-zA-Z0-9_]+)\s+GROUP\s+BY\s+status$/i
    );
    if (grpMatch) {
      const rows = this.getTable(grpMatch[1]);
      const counts = /* @__PURE__ */ new Map();
      for (const r of rows) {
        const st = String(r.status || "New");
        counts.set(st, (counts.get(st) || 0) + 1);
      }
      const out = Array.from(counts.entries()).map(([status, count]) => ({
        status,
        count
      }));
      return { results: out, success: true, meta: {} };
    }
    const selMatch = this.sql.match(
      /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i
    );
    if (selMatch) {
      const selectCols = selMatch[1].trim();
      const table = selMatch[2];
      const whereClause = selMatch[3];
      const orderClause = selMatch[4];
      const limit = selMatch[5] ? Number(selMatch[5]) : null;
      let rows = this.getTable(table).filter(
        (r) => matchesWhere(r, whereClause, this.params, { idx: 0 })
      );
      rows = sortRows(rows, orderClause);
      if (limit !== null) rows = rows.slice(0, limit);
      if (selectCols === "*") {
        return {
          results: rows.map((r) => ({ ...r })),
          success: true,
          meta: {}
        };
      }
      const cols = splitTopLevelCsv(selectCols);
      const projected = rows.map((r) => {
        const obj = {};
        for (const c of cols) {
          const key = c.split(".").pop();
          obj[key] = r[key] ?? null;
        }
        return obj;
      });
      return { results: projected, success: true, meta: {} };
    }
    return { results: [], success: true, meta: {} };
  }
  async first(colName) {
    const res = await this.all();
    const row = res.results[0];
    if (!row) return null;
    if (colName) return row[colName] ?? null;
    return row;
  }
};
var MemoryD1Database = class {
  constructor() {
    this.tables = /* @__PURE__ */ new Map();
  }
  static {
    __name(this, "MemoryD1Database");
  }
  prepare(query) {
    return new MemoryD1Statement(this.tables, query);
  }
  async batch(statements) {
    const out = [];
    for (const s of statements) {
      out.push(await s.run());
    }
    return out;
  }
  async exec(query) {
    const t0 = Date.now();
    const parts = query.split(";").map((s) => s.trim()).filter(Boolean);
    for (const p of parts) {
      await this.prepare(p).run();
    }
    return { count: parts.length, duration: Date.now() - t0 };
  }
};
var MemoryR2Bucket = class {
  constructor() {
    this.store = /* @__PURE__ */ new Map();
  }
  static {
    __name(this, "MemoryR2Bucket");
  }
  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    const bytes = entry.bytes;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    });
    return {
      body: stream,
      async arrayBuffer() {
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        return copy.buffer;
      },
      httpMetadata: entry.httpMetadata,
      size: bytes.byteLength
    };
  }
  async put(key, value, options) {
    const bytes = await toUint8Array(value);
    this.store.set(key, { bytes, httpMetadata: options?.httpMetadata });
    return { key, size: bytes.byteLength };
  }
  async delete(keys) {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      this.store.delete(k);
    }
  }
};
var sharedMemoryDb = null;
var sharedMemoryBucket = null;
function getMemoryFallbackDb() {
  if (!sharedMemoryDb) sharedMemoryDb = new MemoryD1Database();
  return sharedMemoryDb;
}
__name(getMemoryFallbackDb, "getMemoryFallbackDb");
function getMemoryFallbackBucket() {
  if (!sharedMemoryBucket) sharedMemoryBucket = new MemoryR2Bucket();
  return sharedMemoryBucket;
}
__name(getMemoryFallbackBucket, "getMemoryFallbackBucket");
function resolveStorageBindings(env) {
  const d1Bound = Boolean(env.DB);
  const r2Bound = Boolean(env.MEDIA_BUCKET);
  const geminiConfigured = Boolean(env.GEMINI_API_KEY);
  const setupTokenConfigured = Boolean(env.ADMIN_SETUP_TOKEN);
  const emailProviderConfigured = Boolean(env.RESEND_API_KEY);
  if (env.DB && env.MEDIA_BUCKET) {
    return {
      db: env.DB,
      bucket: env.MEDIA_BUCKET,
      storageStatus: {
        d1Bound: true,
        r2Bound: true,
        geminiConfigured,
        setupTokenConfigured,
        emailProviderConfigured,
        mode: "d1+r2",
        summary: "Cloudflare D1 (DB) and R2 (MEDIA_BUCKET) active."
      }
    };
  }
  if (env.DB && !env.MEDIA_BUCKET) {
    return {
      db: env.DB,
      bucket: new D1BlobR2Bucket(env.DB),
      storageStatus: {
        d1Bound: true,
        r2Bound: false,
        geminiConfigured,
        setupTokenConfigured,
        emailProviderConfigured,
        mode: "d1+d1blob",
        summary: "Cloudflare D1 (DB) bound; R2 (MEDIA_BUCKET) unbound \u2014 storing files in D1 blob fallback (max 1.5 MB/file)."
      }
    };
  }
  return {
    db: getMemoryFallbackDb(),
    bucket: env.MEDIA_BUCKET || getMemoryFallbackBucket(),
    storageStatus: {
      d1Bound: false,
      r2Bound,
      geminiConfigured,
      setupTokenConfigured,
      emailProviderConfigured,
      mode: "memory-fallback",
      summary: "Cloudflare D1 (DB) is not bound yet \u2014 running in temporary isolate fallback mode so the site stays online without 503 errors."
    }
  };
}
__name(resolveStorageBindings, "resolveStorageBindings");

// src/types/photo.ts
var BRAND_NAME = "SUN-NOVA PRINT SERVICE";
var OFFICIAL_SITE_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_SITE_URL || "";
var OFFICIAL_SUPPORT_EMAIL = "sopport.sunnovaprintservice@gmail.com";
var PHOTO_PRESETS = {
  inch_1_2x1_5: {
    id: "inch_1_2x1_5",
    label: "1.2 \xD7 1.5 inch (300 PPI \xB7 360\xD7450 px)",
    shortLabel: "1.2 \xD7 1.5 in",
    physicalLabel: "1.2 \xD7 1.5 in",
    w: 360,
    h: 450,
    printW: 360,
    printH: 450,
    aspect: 1.2 / 1.5
  },
  india_passport_print: {
    id: "india_passport_print",
    label: "India Passport / Visa (35\xD745 mm \xB7 413\xD7531 px)",
    shortLabel: "35 \xD7 45 mm",
    physicalLabel: "35 \xD7 45 mm",
    w: 413,
    h: 531,
    printW: 413,
    printH: 531,
    aspect: 35 / 45
  },
  india_passport_digital: {
    id: "india_passport_digital",
    label: "Passport Seva Digital (630\xD7810 px)",
    shortLabel: "630 \xD7 810 px",
    physicalLabel: "35 \xD7 45 mm print",
    w: 630,
    h: 810,
    printW: 413,
    printH: 531,
    aspect: 630 / 810
  },
  us_visa_oci: {
    id: "us_visa_oci",
    label: "US Visa / OCI Card (2\xD72 in \xB7 600\xD7600 px)",
    shortLabel: "2 \xD7 2 in",
    physicalLabel: "2 \xD7 2 in",
    w: 600,
    h: 600,
    printW: 600,
    printH: 600,
    aspect: 1
  },
  pan_card: {
    id: "pan_card",
    label: "PAN Card NSDL / UTIITSL (25\xD735 mm \xB7 295\xD7413 px)",
    shortLabel: "25 \xD7 35 mm",
    physicalLabel: "25 \xD7 35 mm",
    w: 295,
    h: 413,
    printW: 295,
    printH: 413,
    aspect: 25 / 35
  },
  custom_inch: {
    id: "custom_inch",
    label: "Custom Size (Inches @ 300 PPI)",
    shortLabel: "Custom Inch",
    physicalLabel: "Custom in",
    w: 360,
    h: 450,
    printW: 360,
    printH: 450,
    aspect: 1.2 / 1.5
  }
};
var BG_COLORS = [
  { name: "Pure White", hex: "#FFFFFF" },
  { name: "Light Blue", hex: "#DCE9F5" },
  { name: "Sky Blue", hex: "#CBE4F9" },
  { name: "Light Grey", hex: "#E5E7EB" }
];
var DRESS_PRESETS = [
  { id: "none", label: "Original Outfit", category: "None" },
  {
    id: "student_white_tie",
    label: "Student White Shirt & Tie",
    category: "Student"
  },
  {
    id: "student_navy_uniform",
    label: "Student Navy Blazer & Crest",
    category: "Student"
  },
  {
    id: "student_graduation",
    label: "Graduation Gown & Stole",
    category: "Student"
  },
  {
    id: "officer_khaki",
    label: "Police / Khaki Officer Uniform",
    category: "Officer"
  },
  {
    id: "officer_ias_suit",
    label: "IAS / Civil Officer Executive Suit",
    category: "Officer"
  },
  {
    id: "officer_defence_navy",
    label: "Defence / Navy White Ceremonial Coat",
    category: "Officer"
  },
  {
    id: "officer_doctor_coat",
    label: "Medical Officer / Doctor White Coat",
    category: "Officer"
  },
  { id: "black_suit_tie", label: "Executive Black Suit & Tie", category: "Men" },
  { id: "navy_blazer_white", label: "Navy Blazer & Blue Tie", category: "Men" },
  {
    id: "white_formal_shirt",
    label: "Crisp White Formal Shirt",
    category: "Formal"
  },
  {
    id: "womens_black_blazer",
    label: "Women's Tailored Black Blazer",
    category: "Women"
  },
  {
    id: "womens_navy_blazer",
    label: "Women's Tailored Navy Suit",
    category: "Women"
  },
  {
    id: "nehru_jacket",
    label: "Dark Bandhgala / Nehru Coat",
    category: "Formal"
  }
];

// src/backend/seed.ts
var DEFAULT_WEBSITE_SETTINGS = {
  brandName: BRAND_NAME,
  logoText: BRAND_NAME,
  logoImageUrl: "",
  heroEyebrow: `${BRAND_NAME} \xB7 Precision Digital Print Studio`,
  heroHeadlineTop: "BRING YOUR",
  heroHeadlineHighlight: "CREATIVITY",
  heroHeadlineBottom: "TO LIFE.",
  heroSubtitle: `Premium printing. Exceptional design. Unlimited creativity. Transform your ideas into stunning visual experiences with ${BRAND_NAME}.`,
  heroBgImageUrl: "",
  heroPrimaryCtaLabel: "Explore Our Services",
  heroPrimaryCtaHref: "#services",
  heroSecondaryCtaLabel: "Get a Free Quote",
  heroSecondaryCtaHref: "#quote",
  navLinks: [
    { label: "Home", href: "#home" },
    { label: "Services", href: "#services" },
    { label: "Studio", href: "#studio-workbench" },
    { label: "Portfolio", href: "#portfolio" },
    { label: "About Us", href: "#about" },
    { label: "Contact", href: "#contact" }
  ],
  aboutEyebrow: `05 \xB7 About ${BRAND_NAME}`,
  aboutHeadline: "Precision Meets Creativity.",
  aboutDescription: `At ${BRAND_NAME}, we transform creative ideas into high-quality printed experiences. From professional business materials to vibrant large-format prints, we combine creativity, precision, and modern printing technology to bring every vision to life.`,
  aboutImageUrl: "",
  contactEmail: OFFICIAL_SUPPORT_EMAIL,
  contactPhone: "",
  contactAddress: "Digital Pre-Press & Commercial Print Studio",
  socialLinks: [],
  maxImageUploadMb: 10,
  maxPdfUploadMb: 20,
  maxCustomUploadMb: 25,
  allowAnyUpload: true,
  allowedUploadExtensions: [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "svg",
    "pdf",
    "xml",
    "json",
    "csv",
    "txt",
    "md",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "zip"
  ],
  uploadCategories: [
    "image",
    "pdf",
    "xml",
    "document",
    "outfit",
    "background",
    "portrait",
    "service",
    "portfolio",
    "general"
  ]
};
var DEFAULT_SERVICES_SEED = [
  {
    id: "business-cards",
    name: "Business Card Printing",
    description: "Heavy matte, textured cotton, and metallic foil-accented cards built for executive first impressions.",
    category: "Stationery",
    studio_mode: null
  },
  {
    id: "banner-printing",
    name: "Banner Printing",
    description: "High-opacity weather-resistant event, storefront, and stage banners with razor-sharp typography.",
    category: "Large Format",
    studio_mode: null
  },
  {
    id: "flex-printing",
    name: "Flex Printing",
    description: "Durable outdoor frontlit and backlit flex signage engineered for long-range outdoor visibility.",
    category: "Large Format",
    studio_mode: null
  },
  {
    id: "poster-printing",
    name: "Poster Printing",
    description: "Gallery-grade satin and gloss promotional posters with rich saturated blacks and vivid highlights.",
    category: "Commercial Printing",
    studio_mode: null
  },
  {
    id: "flyer-printing",
    name: "Flyer Printing",
    description: "Crisp promotional handbills and campaign mailers on calibrated coated paper stocks.",
    category: "Marketing",
    studio_mode: null
  },
  {
    id: "brochure-printing",
    name: "Brochure Printing",
    description: "Bi-fold and tri-fold corporate brochures with clean scoring and color-consistent photography.",
    category: "Marketing",
    studio_mode: null
  },
  {
    id: "sticker-printing",
    name: "Sticker Printing",
    description: "Custom die-cut waterproof vinyl and holographic brand stickers for packaging and gear.",
    category: "Packaging",
    studio_mode: null
  },
  {
    id: "vinyl-printing",
    name: "Vinyl Printing",
    description: "Self-adhesive matte and clear architectural vinyl graphics for glass, walls, and vehicle wraps.",
    category: "Large Format",
    studio_mode: null
  },
  {
    id: "photo-printing",
    name: "Photo Printing",
    description: "True 300 PPI archival passport photos, studio portraits, and uniform-gap photo sheets.",
    category: "Photo Studio",
    studio_mode: "passport"
  },
  {
    id: "tshirt-printing",
    name: "T-Shirt Printing",
    description: "High-definition DTF and heat-transfer custom apparel printing built to withstand repeated washes.",
    category: "Apparel",
    studio_mode: null
  },
  {
    id: "invitation-cards",
    name: "Invitation Card Printing",
    description: "Bespoke ceremonial, corporate gala, and wedding invitations on heavyweight specialty stock.",
    category: "Stationery",
    studio_mode: null
  },
  {
    id: "custom-graphic-design",
    name: "Custom Graphic Design",
    description: "Print-ready artwork layout, pre-press color separation, and campaign visual composition.",
    category: "Creative Design",
    studio_mode: null
  },
  {
    id: "logo-design",
    name: "Logo Design",
    description: "Scalable vector brand identities engineered to stay crisp from micro business cards to billboards.",
    category: "Creative Design",
    studio_mode: null
  },
  {
    id: "id-card-printing",
    name: "ID Card Printing",
    description: "CR80 laminated employee badges, visitor passes, and Aadhaar/PAN smart sheet layouts.",
    category: "ID & Xerox",
    studio_mode: "xerox"
  },
  {
    id: "large-format-printing",
    name: "Large Format Printing",
    description: "Architectural boards, trade-show backdrops, and exhibition displays up to wide-format rolls.",
    category: "Large Format",
    studio_mode: null
  }
];
var DEFAULT_PORTFOLIO_SEED = [
  {
    id: "pf-1",
    title: "Monolith Foil Stationery Suite",
    category: "Business Cards",
    subtitle: "Cyan metallic edge foil on 400gsm obsidian cotton stock"
  },
  {
    id: "pf-2",
    title: "Futurism Wide-Format Exhibition",
    category: "Posters",
    subtitle: "Wide-gamut UV pigment output on matte exhibition film"
  },
  {
    id: "pf-3",
    title: "Aurora Structural Packaging & Apparel",
    category: "Packaging",
    subtitle: "Rigid matte gift box, die-cut decals, and DTF jersey print"
  },
  {
    id: "pf-4",
    title: "Spectra Industrial Vinyl Roll",
    category: "Banners",
    subtitle: "High-contrast storefront and backdrop flex installation"
  },
  {
    id: "pf-5",
    title: "Atelier Brand System & Swatch Calibration",
    category: "Branding",
    subtitle: "Vector identity system with full CMYK press specifications"
  },
  {
    id: "pf-6",
    title: "Cybernetic Die-Cut Sticker & Badge Kit",
    category: "Custom Printing",
    subtitle: "Holographic laminated vinyl decals & CR80 staff access badges"
  },
  {
    id: "pf-7",
    title: "Editorial Tri-Fold & Gala Invite System",
    category: "Graphic Design",
    subtitle: "Precision layout architecture & dark-ink spot varnishing"
  }
];
var seededDbs = /* @__PURE__ */ new WeakSet();
async function ensureSeeded(db) {
  if (seededDbs.has(db)) return;
  await ensureSchemaTables(db);
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const settingRow = await db.prepare("SELECT setting_key FROM website_settings WHERE setting_key = ?").bind("site_cms").first();
  if (!settingRow) {
    await db.prepare(
      "INSERT OR IGNORE INTO website_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)"
    ).bind("site_cms", JSON.stringify(DEFAULT_WEBSITE_SETTINGS), now).run();
  }
  const outfitCount = await db.prepare("SELECT COUNT(*) as cnt FROM outfit_templates").first();
  if (!outfitCount || Number(outfitCount.cnt) === 0) {
    const builtIns = DRESS_PRESETS.filter((d) => d.id !== "none" && d.category !== "None");
    for (let i = 0; i < builtIns.length; i += 1) {
      const item = builtIns[i];
      await db.prepare(
        `INSERT OR IGNORE INTO outfit_templates
           (id, slug, name, category, builtin_style_id, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
      ).bind(
        `outfit-${item.id}`,
        item.id,
        item.label,
        item.category,
        item.id,
        i + 1,
        now,
        now
      ).run();
    }
  }
  const bgCount = await db.prepare("SELECT COUNT(*) as cnt FROM background_presets").first();
  if (!bgCount || Number(bgCount.cnt) === 0) {
    for (let i = 0; i < BG_COLORS.length; i += 1) {
      const bg = BG_COLORS[i];
      await db.prepare(
        `INSERT OR IGNORE INTO background_presets
           (id, name, preset_type, hex_color, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, 'color', ?, NULL, NULL, ?, 1, ?, ?)`
      ).bind(`bg-${i + 1}`, bg.name, bg.hex, i + 1, now, now).run();
    }
  }
  const srvCount = await db.prepare("SELECT COUNT(*) as cnt FROM services").first();
  if (!srvCount || Number(srvCount.cnt) === 0) {
    for (let i = 0; i < DEFAULT_SERVICES_SEED.length; i += 1) {
      const s = DEFAULT_SERVICES_SEED[i];
      await db.prepare(
        `INSERT OR IGNORE INTO services
           (id, name, description, category, studio_mode, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
      ).bind(s.id, s.name, s.description, s.category, s.studio_mode, i + 1, now, now).run();
    }
  }
  const pfCount = await db.prepare("SELECT COUNT(*) as cnt FROM portfolio_items").first();
  if (!pfCount || Number(pfCount.cnt) === 0) {
    for (let i = 0; i < DEFAULT_PORTFOLIO_SEED.length; i += 1) {
      const p = DEFAULT_PORTFOLIO_SEED[i];
      await db.prepare(
        `INSERT OR IGNORE INTO portfolio_items
           (id, title, subtitle, category, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
      ).bind(p.id, p.title, p.subtitle, p.category, i + 1, now, now).run();
    }
  }
  seededDbs.add(db);
}
__name(ensureSeeded, "ensureSeeded");
async function readWebsiteSettings(db) {
  await ensureSeeded(db);
  const row = await db.prepare("SELECT setting_value FROM website_settings WHERE setting_key = ?").bind("site_cms").first();
  if (!row?.setting_value) return DEFAULT_WEBSITE_SETTINGS;
  try {
    const parsed = JSON.parse(row.setting_value);
    return {
      ...DEFAULT_WEBSITE_SETTINGS,
      ...parsed,
      navLinks: Array.isArray(parsed.navLinks) && parsed.navLinks.length > 0 ? parsed.navLinks : DEFAULT_WEBSITE_SETTINGS.navLinks,
      socialLinks: Array.isArray(parsed.socialLinks) ? parsed.socialLinks : [],
      allowAnyUpload: typeof parsed.allowAnyUpload === "boolean" ? parsed.allowAnyUpload : DEFAULT_WEBSITE_SETTINGS.allowAnyUpload,
      allowedUploadExtensions: Array.isArray(parsed.allowedUploadExtensions) && parsed.allowedUploadExtensions.length > 0 ? parsed.allowedUploadExtensions : DEFAULT_WEBSITE_SETTINGS.allowedUploadExtensions,
      maxCustomUploadMb: typeof parsed.maxCustomUploadMb === "number" && parsed.maxCustomUploadMb > 0 ? parsed.maxCustomUploadMb : DEFAULT_WEBSITE_SETTINGS.maxCustomUploadMb,
      uploadCategories: Array.isArray(parsed.uploadCategories) && parsed.uploadCategories.length > 0 ? parsed.uploadCategories : DEFAULT_WEBSITE_SETTINGS.uploadCategories
    };
  } catch {
    return DEFAULT_WEBSITE_SETTINGS;
  }
}
__name(readWebsiteSettings, "readWebsiteSettings");

// src/backend/apiRouter.ts
var SESSION_COOKIE_NAME = "sn_admin_session";
var OUTFIT_CATEGORIES = [
  "Student",
  "Officer",
  "Men",
  "Women",
  "Formal",
  "Custom"
];
var QUOTE_STATUSES = [
  "New",
  "Pending",
  "Contacted",
  "Quoted",
  "Completed",
  "Cancelled"
];
function json(data, status = 200, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...extraHeaders
    }
  });
}
__name(json, "json");
function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "local";
}
__name(getClientIp, "getClientIp");
function parseCookies(cookieHeader) {
  const map = {};
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
__name(parseCookies, "parseCookies");
function buildSessionCookie(token, maxAgeSeconds, isHttps) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}
__name(buildSessionCookie, "buildSessionCookie");
function buildClearSessionCookie(isHttps) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0"
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}
__name(buildClearSessionCookie, "buildClearSessionCookie");
async function checkRateLimit(db, rateKey, maxHits, windowSeconds) {
  const nowSec = Math.floor(Date.now() / 1e3);
  const existing = await db.prepare("SELECT hits, window_start FROM rate_limits WHERE rate_key = ?").bind(rateKey).first();
  if (!existing || nowSec - Number(existing.window_start) >= windowSeconds) {
    await db.prepare(
      "INSERT OR REPLACE INTO rate_limits (rate_key, hits, window_start) VALUES (?, 1, ?)"
    ).bind(rateKey, nowSec).run();
    return true;
  }
  if (Number(existing.hits) >= maxHits) {
    return false;
  }
  await db.prepare("UPDATE rate_limits SET hits = hits + 1 WHERE rate_key = ?").bind(rateKey).run();
  return true;
}
__name(checkRateLimit, "checkRateLimit");
async function logActivity(db, admin, action, entityType, entityId, details) {
  await db.prepare(
    `INSERT INTO activity_logs (id, admin_id, admin_email, action, entity_type, entity_id, details, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    generateId(),
    admin?.id || null,
    admin?.email || null,
    action,
    entityType,
    entityId,
    details || null,
    (/* @__PURE__ */ new Date()).toISOString()
  ).run();
}
__name(logActivity, "logActivity");
function verifyCsrf(request, url) {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) {
    return false;
  }
  const csrfHeader = request.headers.get("X-Requested-With");
  return csrfHeader === "SunNovaAdmin";
}
__name(verifyCsrf, "verifyCsrf");
async function authenticateAdmin(request, db) {
  const cookies = parseCookies(request.headers.get("Cookie"));
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(rawToken);
  const nowIso = (/* @__PURE__ */ new Date()).toISOString();
  const row = await db.prepare(
    `SELECT a.id, a.name, a.email, a.role, a.status, a.last_login_at, a.created_at, a.updated_at, s.expires_at
       FROM admin_sessions s
       INNER JOIN admins a ON a.id = s.admin_id
       WHERE s.token_hash = ?`
  ).bind(tokenHash).first();
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
    updated_at: row.updated_at
  };
}
__name(authenticateAdmin, "authenticateAdmin");
async function storeUploadedFile(opts) {
  const buf = new Uint8Array(await opts.file.arrayBuffer());
  const detected = detectUploadFileType(buf, opts.file.type, opts.file.name, {
    allowAnyUpload: opts.allowAnyUploadOverride ?? opts.settings.allowAnyUpload,
    allowedUploadExtensions: opts.settings.allowedUploadExtensions
  });
  if (!detected.valid) {
    throw new Error(
      detected.error || `Unsupported or invalid file "${opts.file.name}". Update allowed extensions in Media Upload Rules.`
    );
  }
  const limitMb = detected.isPdf ? opts.settings.maxPdfUploadMb : detected.isImage ? opts.settings.maxImageUploadMb : opts.settings.maxCustomUploadMb || 25;
  const maxBytes = limitMb * 1024 * 1024;
  if (buf.byteLength > maxBytes) {
    throw new Error(
      `"${opts.file.name}" exceeds the ${limitMb} MB upload limit.`
    );
  }
  const id = generateId();
  const displayFilename = opts.customName?.trim() ? opts.customName.trim().slice(0, 140) : opts.file.name;
  const safeBase = sanitizeFilename(displayFilename).replace(/\.[^.]+$/, "");
  const safeExt = detected.ext || "bin";
  const uniqueName = `${Date.now()}-${id.slice(0, 8)}-${safeBase}.${safeExt}`;
  const prefix = opts.visibility === "private" ? "private" : "public";
  const safeCategory = opts.category.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 40) || "general";
  const r2Key = `${prefix}/${safeCategory}/${uniqueName}`;
  const publicUrl = opts.visibility === "public" ? `/api/media/public/${encodeURIComponent(r2Key)}` : null;
  await opts.bucket.put(r2Key, buf, {
    httpMetadata: {
      contentType: detected.mime,
      cacheControl: opts.visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store"
    },
    customMetadata: {
      originalName: opts.file.name,
      category: safeCategory
    }
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const record = {
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
    updated_at: now
  };
  await opts.db.prepare(
    `INSERT INTO media_files
       (id, r2_key, filename, original_name, mime_type, file_size, category, visibility, public_url, uploaded_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
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
  ).run();
  return record;
}
__name(storeUploadedFile, "storeUploadedFile");
async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(safeJson, "safeJson");
async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const isHttps = url.protocol === "https:" || request.headers.get("X-Forwarded-Proto") === "https";
  if (!path.startsWith("/api/")) {
    return null;
  }
  if (path === "/api/health" && request.method === "GET") {
    const { storageStatus: storageStatus2 } = resolveStorageBindings(env);
    return json({
      ok: true,
      dbConfigured: storageStatus2.d1Bound,
      r2Configured: storageStatus2.r2Bound,
      geminiConfigured: storageStatus2.geminiConfigured,
      storageStatus: storageStatus2
    });
  }
  if (path.startsWith("/api/media/public/") && request.method === "GET") {
    const { db: db2, bucket: bucket2 } = resolveStorageBindings(env);
    await ensureSeeded(db2);
    const rawKey = decodeURIComponent(path.slice("/api/media/public/".length));
    if (!rawKey.startsWith("public/") || rawKey.includes("..")) {
      return json({ error: "Forbidden asset path." }, 403);
    }
    const mediaRow = await db2.prepare("SELECT visibility, mime_type FROM media_files WHERE r2_key = ?").bind(rawKey).first();
    if (!mediaRow || mediaRow.visibility !== "public") {
      return json({ error: "Asset not found or not public." }, 404);
    }
    const obj = await bucket2.get(rawKey);
    if (!obj) {
      return json({ error: "Object not found in storage." }, 404);
    }
    const headers = new Headers();
    const contentType = obj.httpMetadata?.contentType || mediaRow.mime_type || "application/octet-stream";
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
    if (path === "/api/public/settings" && request.method === "GET") {
      const settings = await readWebsiteSettings(db);
      return json({ settings });
    }
    if (path === "/api/public/bootstrap" && request.method === "GET") {
      const [settings, outfitsRes, bgsRes, portraitsRes, servicesRes, portfolioRes] = await Promise.all([
        readWebsiteSettings(db),
        db.prepare(
          "SELECT * FROM outfit_templates WHERE is_published = 1 ORDER BY display_order ASC, created_at ASC"
        ).all(),
        db.prepare(
          "SELECT * FROM background_presets WHERE is_published = 1 ORDER BY display_order ASC, created_at ASC"
        ).all(),
        db.prepare(
          "SELECT * FROM sample_portraits WHERE is_published = 1 ORDER BY display_order ASC, created_at DESC"
        ).all(),
        db.prepare(
          "SELECT * FROM services WHERE is_published = 1 ORDER BY display_order ASC, created_at ASC"
        ).all(),
        db.prepare(
          "SELECT * FROM portfolio_items WHERE is_published = 1 ORDER BY display_order ASC, created_at DESC"
        ).all()
      ]);
      return json({
        settings,
        outfits: outfitsRes.results,
        backgrounds: bgsRes.results,
        portraits: portraitsRes.results,
        services: servicesRes.results,
        portfolio: portfolioRes.results
      });
    }
    if (path === "/api/public/quotes" && request.method === "POST") {
      const ip = getClientIp(request);
      if (!await checkRateLimit(db, `pub_quote:${ip}`, 15, 900)) {
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
      let attachmentMediaId = null;
      let attachmentName = null;
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
        description = String(fd.get("description") || "").trim().slice(0, 3e3);
        const maybeFile = fd.get("attachment");
        if (maybeFile instanceof File && maybeFile.size > 0) {
          const settings = await readWebsiteSettings(db);
          const stored = await storeUploadedFile({
            file: maybeFile,
            db,
            bucket,
            category: "quote_attachment",
            visibility: "private",
            // Sensitive customer artwork kept private in R2
            adminId: null,
            settings
          });
          attachmentMediaId = stored.id;
          attachmentName = stored.filename;
        }
      } else {
        const body = await safeJson(request);
        if (!body) return json({ error: "Invalid request payload." }, 400);
        customerName = String(body.customerName || "").trim();
        customerEmail = sanitizeEmail(String(body.customerEmail || ""));
        phoneNumber = String(body.phoneNumber || "").trim().slice(0, 40);
        serviceType = String(body.serviceType || "").trim();
        quantity = String(body.quantity || "1").trim();
        paperSize = String(body.paperSize || "Standard").trim();
        material = String(body.material || "").trim();
        colorMode = String(body.colorMode || "Full Color (CMYK)").trim();
        description = String(body.description || "").trim().slice(0, 3e3);
      }
      if (!customerName || !isValidEmail(customerEmail) || !serviceType) {
        return json(
          { error: "Customer Name, valid Email, and Service Type are required." },
          400
        );
      }
      const id = generateId();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.prepare(
        `INSERT INTO quote_requests
           (id, customer_name, customer_email, phone_number, service_type, quantity, paper_size, material, color_mode, description, attachment_media_id, attachment_name, status, internal_notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', '', ?, ?)`
      ).bind(
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
      ).run();
      return json({ ok: true, quoteId: id }, 201);
    }
    if (path === "/api/public/contact" && request.method === "POST") {
      const ip = getClientIp(request);
      if (!await checkRateLimit(db, `pub_contact:${ip}`, 15, 900)) {
        return json(
          { error: "Too many messages sent. Please try again in a few minutes." },
          429
        );
      }
      const body = await safeJson(request);
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
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.prepare(
        `INSERT INTO contact_messages
           (id, customer_name, customer_email, phone_number, subject, message, is_read, reply_note, replied_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, '', NULL, ?, ?)`
      ).bind(
        id,
        name.slice(0, 120),
        email,
        phone || null,
        subject.slice(0, 200),
        message.slice(0, 5e3),
        now,
        now
      ).run();
      return json({ ok: true, messageId: id }, 201);
    }
    if (path === "/api/admin/bootstrap-status" && request.method === "GET") {
      const [row, sessionAdmin] = await Promise.all([
        db.prepare("SELECT COUNT(*) as cnt FROM admins").first(),
        authenticateAdmin(request, db)
      ]);
      return json({
        needsSetup: !row || Number(row.cnt) === 0,
        setupTokenRequired: Boolean(env.ADMIN_SETUP_TOKEN),
        admin: sessionAdmin,
        storageStatus
      });
    }
    if (path === "/api/admin/setup" && request.method === "POST") {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) {
        return json({ error: "Origin mismatch." }, 403);
      }
      const existing = await db.prepare("SELECT COUNT(*) as cnt FROM admins").first();
      if (existing && Number(existing.cnt) > 0) {
        return json(
          { error: "Administrator setup is already complete. Please sign in." },
          403
        );
      }
      const body = await safeJson(request);
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
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const passwordHash = await hashPassword(password);
      await db.prepare(
        `INSERT INTO admins (id, name, email, password_hash, role, status, last_login_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'super_admin', 'active', ?, ?, ?)`
      ).bind(id, name.slice(0, 100), email, passwordHash, now, now, now).run();
      const rawToken = generateSecureToken(32);
      const tokenHash = await sha256Hex(rawToken);
      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1e3).toISOString();
      await db.prepare(
        `INSERT INTO admin_sessions (id, admin_id, token_hash, ip_address, user_agent, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        id,
        tokenHash,
        getClientIp(request),
        (request.headers.get("User-Agent") || "").slice(0, 200),
        expiresAt,
        now
      ).run();
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
            updated_at: now
          }
        },
        201,
        {
          "Set-Cookie": buildSessionCookie(rawToken, 30 * 24 * 3600, isHttps)
        }
      );
    }
    if (path === "/api/admin/login" && request.method === "POST") {
      const origin = request.headers.get("Origin");
      if (origin && origin !== url.origin) {
        return json({ error: "Origin mismatch." }, 403);
      }
      const ip = getClientIp(request);
      if (!await checkRateLimit(db, `admin_login:${ip}`, 15, 900)) {
        return json(
          { error: "Too many login attempts. Please wait 15 minutes before retrying." },
          429
        );
      }
      const body = await safeJson(request);
      if (!body) return json({ error: "Invalid JSON payload." }, 400);
      const email = sanitizeEmail(String(body.email || ""));
      const password = String(body.password || "");
      if (!isValidEmail(email) || !password) {
        return json({ error: "Email and password are required." }, 400);
      }
      const adminRow = await db.prepare("SELECT * FROM admins WHERE email = ?").bind(email).first();
      if (!adminRow || adminRow.status !== "active") {
        return json({ error: "Invalid email or password." }, 401);
      }
      const validPw = await verifyPassword(password, adminRow.password_hash);
      if (!validPw) {
        return json({ error: "Invalid email or password." }, 401);
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const remember = Boolean(body.remember);
      const maxAgeSeconds = remember ? 30 * 24 * 3600 : 12 * 3600;
      const expiresAt = new Date(Date.now() + maxAgeSeconds * 1e3).toISOString();
      const rawToken = generateSecureToken(32);
      const tokenHash = await sha256Hex(rawToken);
      await db.prepare(
        `INSERT INTO admin_sessions (id, admin_id, token_hash, ip_address, user_agent, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        adminRow.id,
        tokenHash,
        ip,
        (request.headers.get("User-Agent") || "").slice(0, 200),
        expiresAt,
        now
      ).run();
      await db.prepare("UPDATE admins SET last_login_at = ?, updated_at = ? WHERE id = ?").bind(now, now, adminRow.id).run();
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
            updated_at: now
          }
        },
        200,
        {
          "Set-Cookie": buildSessionCookie(rawToken, maxAgeSeconds, isHttps)
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
      if (!await checkRateLimit(db, `admin_forgot:${ip}`, 5, 900)) {
        return json({ error: "Please wait before requesting another reset." }, 429);
      }
      const body = await safeJson(request);
      const email = sanitizeEmail(String(body?.email || ""));
      if (!isValidEmail(email)) {
        return json({ error: "Enter a valid administrator email address." }, 400);
      }
      const adminRow = await db.prepare("SELECT id, email, name FROM admins WHERE email = ? AND status = 'active'").bind(email).first();
      if (adminRow) {
        const resetToken = generateSecureToken(24);
        const resetHash = await sha256Hex(resetToken);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1e3).toISOString();
        await db.prepare(
          "UPDATE admins SET reset_token_hash = ?, reset_token_expires_at = ?, updated_at = ? WHERE id = ?"
        ).bind(resetHash, expiresAt, (/* @__PURE__ */ new Date()).toISOString(), adminRow.id).run();
        if (env.RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${env.RESEND_API_KEY}`
            },
            body: JSON.stringify({
              from: env.EMAIL_FROM || "SUN-NOVA PRINT SERVICE <onboarding@resend.dev>",
              to: [adminRow.email],
              subject: "SUN-NOVA Admin Password Reset Token",
              text: `Hello ${adminRow.name},

Your password reset code (valid for 30 minutes):
${resetToken}
`
            })
          }).catch(() => void 0);
          return json({
            ok: true,
            emailDispatched: true,
            message: "If this administrator email is registered, a password reset code has been sent via email."
          });
        }
      }
      return json({
        ok: true,
        emailDispatched: false,
        message: env.RESEND_API_KEY ? "If this administrator email is registered, a reset code has been sent." : "Reset request recorded. Because RESEND_API_KEY is not configured, complete password reset using your server ADMIN_SETUP_TOKEN or via Wrangler D1 recovery."
      });
    }
    if (path === "/api/admin/reset-password" && request.method === "POST") {
      const ip = getClientIp(request);
      if (!await checkRateLimit(db, `admin_reset:${ip}`, 10, 900)) {
        return json({ error: "Too many reset attempts. Try again later." }, 429);
      }
      const body = await safeJson(request);
      const email = sanitizeEmail(String(body?.email || ""));
      const token = String(body?.token || "").trim();
      const newPassword = String(body?.newPassword || "");
      if (!isValidEmail(email) || !token || newPassword.length < 8) {
        return json(
          { error: "Valid email, recovery token, and new password (8+ chars) are required." },
          400
        );
      }
      const adminRow = await db.prepare("SELECT id, reset_token_hash, reset_token_expires_at FROM admins WHERE email = ?").bind(email).first();
      if (!adminRow) {
        return json({ error: "Invalid email or recovery token." }, 403);
      }
      const tokenHash = await sha256Hex(token);
      const matchesResetToken = adminRow.reset_token_hash && adminRow.reset_token_expires_at && adminRow.reset_token_expires_at > (/* @__PURE__ */ new Date()).toISOString() && adminRow.reset_token_hash === tokenHash;
      const matchesSetupToken = Boolean(
        env.ADMIN_SETUP_TOKEN && token === env.ADMIN_SETUP_TOKEN
      );
      if (!matchesResetToken && !matchesSetupToken) {
        return json({ error: "Invalid or expired recovery token." }, 403);
      }
      const newHash = await hashPassword(newPassword);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.prepare(
        "UPDATE admins SET password_hash = ?, reset_token_hash = NULL, reset_token_expires_at = NULL, updated_at = ? WHERE id = ?"
      ).bind(newHash, now, adminRow.id).run();
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
        recentActivityRes
      ] = await Promise.all([
        db.prepare("SELECT COUNT(*) as cnt FROM media_files WHERE mime_type LIKE 'image/%'").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM media_files WHERE mime_type NOT LIKE 'image/%'").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM outfit_templates").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM background_presets").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM sample_portraits").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM portfolio_items").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM services").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM quote_requests").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM contact_messages").first(),
        db.prepare("SELECT COUNT(*) as cnt FROM contact_messages WHERE is_read = 0").first(),
        db.prepare("SELECT status, COUNT(*) as count FROM quote_requests GROUP BY status").all(),
        db.prepare("SELECT * FROM media_files ORDER BY created_at DESC LIMIT 6").all(),
        db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 10").all()
      ]);
      const payload = {
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
          totalMessages: Number(msgTotalCnt?.cnt || 0)
        },
        quotesByStatus: quoteStatusRes.results,
        recentUploads: recentUploadsRes.results,
        recentActivity: recentActivityRes.results,
        storageStatus
      };
      return json(payload);
    }
    if (path === "/api/admin/media" && request.method === "GET") {
      const rows = await db.prepare("SELECT * FROM media_files ORDER BY created_at DESC").all();
      return json({ files: rows.results });
    }
    if (path === "/api/admin/media/upload" && request.method === "POST") {
      const settings = await readWebsiteSettings(db);
      const fd = await request.formData();
      const category = String(fd.get("category") || "general").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 40) || "general";
      const visibility = fd.get("visibility") === "private" ? "private" : "public";
      const customFilename = String(fd.get("customFilename") || "").trim();
      const files = fd.getAll("files").filter((f) => f instanceof File);
      const single = fd.get("file");
      if (single instanceof File && files.length === 0) files.push(single);
      if (files.length === 0) {
        return json({ error: "No valid files selected for upload." }, 400);
      }
      const uploaded = [];
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
          customName: files.length === 1 && customFilename ? customFilename : void 0
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
      const body = await safeJson(request);
      const ids = Array.isArray(body?.ids) ? Array.from(new Set(body.ids.map((v) => String(v || "").trim()).filter(Boolean))).slice(
        0,
        200
      ) : [];
      if (ids.length === 0) {
        return json({ error: "Select at least one file to remove." }, 400);
      }
      const force = body?.force !== false;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      let deletedCount = 0;
      const removedNames = [];
      for (const id of ids) {
        const existing = await db.prepare("SELECT * FROM media_files WHERE id = ?").bind(id).first();
        if (!existing) continue;
        if (force) {
          await Promise.all([
            db.prepare("UPDATE outfit_templates SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("UPDATE background_presets SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("DELETE FROM sample_portraits WHERE media_id = ?").bind(id).run(),
            db.prepare("UPDATE services SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("UPDATE portfolio_items SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("UPDATE quote_requests SET attachment_media_id = NULL, updated_at = ? WHERE attachment_media_id = ?").bind(now, id).run()
          ]);
        }
        await bucket.delete(existing.r2_key).catch(() => void 0);
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
      const row = await db.prepare("SELECT * FROM media_files WHERE id = ?").bind(id).first();
      if (!row) return json({ error: "Media file not found." }, 404);
      const obj = await bucket.get(row.r2_key);
      if (!obj) return json({ error: "Object missing from storage." }, 404);
      const headers = new Headers();
      headers.set("Content-Type", row.mime_type || "application/octet-stream");
      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      if (row.mime_type.includes("svg") || row.mime_type.includes("xml") || row.mime_type.includes("html")) {
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
      const existing = await db.prepare("SELECT * FROM media_files WHERE id = ?").bind(id).first();
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
        allowedUploadExtensions: settings.allowedUploadExtensions
      });
      if (!detected.valid) {
        return json(
          { error: detected.error || "Unsupported replacement file format." },
          400
        );
      }
      const limitMb = detected.isPdf ? settings.maxPdfUploadMb : detected.isImage ? settings.maxImageUploadMb : settings.maxCustomUploadMb || 25;
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
      const newPublicUrl = existing.visibility === "public" ? `/api/media/public/${encodeURIComponent(newKey)}` : null;
      await bucket.put(newKey, buf, {
        httpMetadata: {
          contentType: detected.mime,
          cacheControl: existing.visibility === "public" ? "public, max-age=31536000, immutable" : "private, no-store"
        }
      });
      await bucket.delete(existing.r2_key).catch(() => void 0);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      await db.prepare(
        `UPDATE media_files
           SET r2_key = ?, filename = ?, original_name = ?, mime_type = ?, file_size = ?, public_url = ?, updated_at = ?
           WHERE id = ?`
      ).bind(
        newKey,
        file.name,
        file.name,
        detected.mime,
        buf.byteLength,
        newPublicUrl,
        now,
        id
      ).run();
      if (newPublicUrl) {
        await Promise.all([
          db.prepare("UPDATE outfit_templates SET image_url = ?, updated_at = ? WHERE media_id = ?").bind(newPublicUrl, now, id).run(),
          db.prepare("UPDATE background_presets SET image_url = ?, updated_at = ? WHERE media_id = ?").bind(newPublicUrl, now, id).run(),
          db.prepare("UPDATE sample_portraits SET image_url = ?, updated_at = ? WHERE media_id = ?").bind(newPublicUrl, now, id).run(),
          db.prepare("UPDATE services SET image_url = ?, updated_at = ? WHERE media_id = ?").bind(newPublicUrl, now, id).run(),
          db.prepare("UPDATE portfolio_items SET image_url = ?, updated_at = ? WHERE media_id = ?").bind(newPublicUrl, now, id).run()
        ]);
      }
      const updated = await db.prepare("SELECT * FROM media_files WHERE id = ?").bind(id).first();
      await logActivity(db, admin, "Replaced Media File", "media", id, file.name);
      return json({ file: updated });
    }
    const mediaIdMatch = path.match(/^\/api\/admin\/media\/([^/]+)$/);
    if (mediaIdMatch) {
      const id = decodeURIComponent(mediaIdMatch[1]);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const existing = await db.prepare("SELECT * FROM media_files WHERE id = ?").bind(id).first();
        if (!existing) return json({ error: "Media file not found." }, 404);
        const nextName = body?.filename?.trim() ? body.filename.trim().slice(0, 140) : existing.filename;
        const nextCat = body?.category?.trim() ? body.category.trim().slice(0, 40) : existing.category;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          "UPDATE media_files SET filename = ?, category = ?, updated_at = ? WHERE id = ?"
        ).bind(nextName, nextCat, now, id).run();
        const updated = await db.prepare("SELECT * FROM media_files WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Updated Media Metadata", "media", id, nextName);
        return json({ file: updated });
      }
      if (request.method === "DELETE") {
        const existing = await db.prepare("SELECT * FROM media_files WHERE id = ?").bind(id).first();
        if (!existing) return json({ error: "Media file not found." }, 404);
        const force = url.searchParams.get("force") === "true";
        const refTables = [
          "outfit_templates",
          "background_presets",
          "sample_portraits",
          "services",
          "portfolio_items"
        ];
        let totalRefs = 0;
        for (const tbl of refTables) {
          const r = await db.prepare(`SELECT COUNT(*) as cnt FROM ${tbl} WHERE media_id = ?`).bind(id).first();
          totalRefs += Number(r?.cnt || 0);
        }
        const quoteRef = await db.prepare("SELECT COUNT(*) as cnt FROM quote_requests WHERE attachment_media_id = ?").bind(id).first();
        totalRefs += Number(quoteRef?.cnt || 0);
        if (totalRefs > 0 && !force) {
          return json(
            {
              error: `This file is referenced by ${totalRefs} published or active item(s). Confirm force delete to detach references and remove the file.`,
              requiresForce: true,
              references: totalRefs
            },
            409
          );
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        if (totalRefs > 0) {
          await Promise.all([
            db.prepare("UPDATE outfit_templates SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("UPDATE background_presets SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("DELETE FROM sample_portraits WHERE media_id = ?").bind(id).run(),
            db.prepare("UPDATE services SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("UPDATE portfolio_items SET media_id = NULL, image_url = NULL, updated_at = ? WHERE media_id = ?").bind(now, id).run(),
            db.prepare("UPDATE quote_requests SET attachment_media_id = NULL, updated_at = ? WHERE attachment_media_id = ?").bind(now, id).run()
          ]);
        }
        await bucket.delete(existing.r2_key).catch(() => void 0);
        await db.prepare("DELETE FROM media_files WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Media File", "media", id, existing.filename);
        return json({ ok: true });
      }
    }
    if (path === "/api/admin/outfits") {
      if (request.method === "GET") {
        const res = await db.prepare("SELECT * FROM outfit_templates ORDER BY display_order ASC, created_at ASC").all();
        return json({ outfits: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson(request);
        const name = String(body?.name || "").trim();
        const category = body?.category || "Custom";
        if (!name || !OUTFIT_CATEGORIES.includes(category)) {
          return json({ error: "Valid outfit name and category are required." }, 400);
        }
        let imageUrl = body?.imageUrl?.trim() || null;
        const mediaId = body?.mediaId || null;
        if (mediaId && !imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          imageUrl = mf?.public_url || null;
        }
        const id = generateId();
        const slug = `custom-${id.slice(0, 8)}`;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const order = Number(body?.displayOrder ?? 100);
        const isPub = body?.isPublished === false ? 0 : 1;
        await db.prepare(
          `INSERT INTO outfit_templates
             (id, slug, name, category, builtin_style_id, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`
        ).bind(id, slug, name.slice(0, 100), category, mediaId, imageUrl, order, isPub, now, now).run();
        const created = await db.prepare("SELECT * FROM outfit_templates WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Created Outfit Template", "outfit", id, name);
        return json({ outfit: created }, 201);
      }
    }
    const outfitIdMatch = path.match(/^\/api\/admin\/outfits\/([^/]+)$/);
    if (outfitIdMatch) {
      const id = decodeURIComponent(outfitIdMatch[1]);
      const existing = await db.prepare("SELECT * FROM outfit_templates WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Outfit template not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const name = body?.name?.trim() ? body.name.trim().slice(0, 100) : existing.name;
        const category = body?.category && OUTFIT_CATEGORIES.includes(body.category) ? body.category : existing.category;
        let mediaId = body?.mediaId !== void 0 ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== void 0 ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const order = body?.displayOrder !== void 0 ? Number(body.displayOrder) : existing.display_order;
        const isPub = body?.isPublished !== void 0 ? body.isPublished ? 1 : 0 : existing.is_published;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `UPDATE outfit_templates
             SET name = ?, category = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
        ).bind(name, category, mediaId || null, imageUrl || null, order, isPub, now, id).run();
        const updated = await db.prepare("SELECT * FROM outfit_templates WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Updated Outfit Template", "outfit", id, name);
        return json({ outfit: updated });
      }
      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM outfit_templates WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Outfit Template", "outfit", id, existing.name);
        return json({ ok: true });
      }
    }
    if (path === "/api/admin/backgrounds") {
      if (request.method === "GET") {
        const res = await db.prepare("SELECT * FROM background_presets ORDER BY display_order ASC, created_at ASC").all();
        return json({ backgrounds: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson(request);
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
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          imageUrl = mf?.public_url || null;
        }
        if (presetType === "image" && !imageUrl) {
          return json({ error: "Background image URL or media upload is required." }, 400);
        }
        const id = generateId();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `INSERT INTO background_presets
             (id, name, preset_type, hex_color, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
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
        ).run();
        const created = await db.prepare("SELECT * FROM background_presets WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Created Background Preset", "background", id, name);
        return json({ background: created }, 201);
      }
    }
    const bgIdMatch = path.match(/^\/api\/admin\/backgrounds\/([^/]+)$/);
    if (bgIdMatch) {
      const id = decodeURIComponent(bgIdMatch[1]);
      const existing = await db.prepare("SELECT * FROM background_presets WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Background preset not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const name = body?.name?.trim() ? body.name.trim().slice(0, 80) : existing.name;
        const presetType = body?.presetType === "image" || body?.presetType === "color" ? body.presetType : existing.preset_type;
        const hexColor = body?.hexColor !== void 0 ? body.hexColor : existing.hex_color;
        if (presetType === "color" && (!hexColor || !isValidHexColor(hexColor))) {
          return json({ error: "Valid #RRGGBB hex color required." }, 400);
        }
        const mediaId = body?.mediaId !== void 0 ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== void 0 ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `UPDATE background_presets
             SET name = ?, preset_type = ?, hex_color = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
          name,
          presetType,
          hexColor ? hexColor.toUpperCase() : null,
          mediaId || null,
          imageUrl || null,
          body?.displayOrder !== void 0 ? Number(body.displayOrder) : existing.display_order,
          body?.isPublished !== void 0 ? body.isPublished ? 1 : 0 : existing.is_published,
          now,
          id
        ).run();
        const updated = await db.prepare("SELECT * FROM background_presets WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Updated Background Preset", "background", id, name);
        return json({ background: updated });
      }
      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM background_presets WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Background Preset", "background", id, existing.name);
        return json({ ok: true });
      }
    }
    if (path === "/api/admin/portraits") {
      if (request.method === "GET") {
        const res = await db.prepare("SELECT * FROM sample_portraits ORDER BY display_order ASC, created_at DESC").all();
        return json({ portraits: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson(request);
        const title = String(body?.title || "").trim();
        let imageUrl = body?.imageUrl?.trim() || "";
        const mediaId = body?.mediaId || null;
        if (mediaId && !imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          imageUrl = mf?.public_url || "";
        }
        if (!title || !imageUrl) {
          return json({ error: "Portrait title and image are required." }, 400);
        }
        const id = generateId();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `INSERT INTO sample_portraits
             (id, title, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          title.slice(0, 100),
          mediaId,
          imageUrl,
          Number(body?.displayOrder ?? 10),
          body?.isPublished === false ? 0 : 1,
          now,
          now
        ).run();
        const created = await db.prepare("SELECT * FROM sample_portraits WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Added Sample Portrait", "portrait", id, title);
        return json({ portrait: created }, 201);
      }
    }
    const portraitIdMatch = path.match(/^\/api\/admin\/portraits\/([^/]+)$/);
    if (portraitIdMatch) {
      const id = decodeURIComponent(portraitIdMatch[1]);
      const existing = await db.prepare("SELECT * FROM sample_portraits WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Sample portrait not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const title = body?.title?.trim() ? body.title.trim().slice(0, 100) : existing.title;
        const mediaId = body?.mediaId !== void 0 ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== void 0 ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `UPDATE sample_portraits
             SET title = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
          title,
          mediaId || null,
          imageUrl,
          body?.displayOrder !== void 0 ? Number(body.displayOrder) : existing.display_order,
          body?.isPublished !== void 0 ? body.isPublished ? 1 : 0 : existing.is_published,
          now,
          id
        ).run();
        const updated = await db.prepare("SELECT * FROM sample_portraits WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Updated Sample Portrait", "portrait", id, title);
        return json({ portrait: updated });
      }
      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM sample_portraits WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Sample Portrait", "portrait", id, existing.title);
        return json({ ok: true });
      }
    }
    if (path === "/api/admin/settings") {
      if (request.method === "GET") {
        const settings = await readWebsiteSettings(db);
        return json({ settings });
      }
      if (request.method === "PUT") {
        const body = await safeJson(request);
        if (!body) return json({ error: "Invalid settings payload." }, 400);
        const current = await readWebsiteSettings(db);
        const merged = {
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
          allowAnyUpload: typeof body.allowAnyUpload === "boolean" ? body.allowAnyUpload : current.allowAnyUpload,
          allowedUploadExtensions: Array.isArray(body.allowedUploadExtensions) ? Array.from(
            new Set(
              body.allowedUploadExtensions.map((ext) => normalizeExtension(String(ext || ""))).filter(Boolean)
            )
          ).slice(0, 60) : current.allowedUploadExtensions,
          uploadCategories: Array.isArray(body.uploadCategories) ? Array.from(
            new Set(
              body.uploadCategories.map(
                (c) => String(c || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 40)
              ).filter(Boolean)
            )
          ).slice(0, 30) : current.uploadCategories
        };
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          "INSERT OR REPLACE INTO website_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)"
        ).bind("site_cms", JSON.stringify(merged), now).run();
        await logActivity(db, admin, "Updated Website CMS Settings", "settings", "site_cms");
        return json({ settings: merged });
      }
    }
    if (path === "/api/admin/services") {
      if (request.method === "GET") {
        const res = await db.prepare("SELECT * FROM services ORDER BY display_order ASC, created_at ASC").all();
        return json({ services: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson(request);
        const name = String(body?.name || "").trim();
        const description = String(body?.description || "").trim();
        if (!name || !description) {
          return json({ error: "Service name and description are required." }, 400);
        }
        const mediaId = body?.mediaId || null;
        let imageUrl = body?.imageUrl?.trim() || null;
        if (mediaId && !imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          imageUrl = mf?.public_url || null;
        }
        const id = generateId();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `INSERT INTO services
             (id, name, description, category, studio_mode, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
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
        ).run();
        const created = await db.prepare("SELECT * FROM services WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Created Service", "service", id, name);
        return json({ service: created }, 201);
      }
    }
    const serviceIdMatch = path.match(/^\/api\/admin\/services\/([^/]+)$/);
    if (serviceIdMatch) {
      const id = decodeURIComponent(serviceIdMatch[1]);
      const existing = await db.prepare("SELECT * FROM services WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Service not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const mediaId = body?.mediaId !== void 0 ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== void 0 ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `UPDATE services
             SET name = ?, description = ?, category = ?, studio_mode = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
          body?.name?.trim() ? body.name.trim().slice(0, 100) : existing.name,
          body?.description?.trim() ? body.description.trim().slice(0, 500) : existing.description,
          body?.category?.trim() ? body.category.trim().slice(0, 60) : existing.category,
          body?.studioMode !== void 0 ? body.studioMode : existing.studio_mode,
          mediaId || null,
          imageUrl || null,
          body?.displayOrder !== void 0 ? Number(body.displayOrder) : existing.display_order,
          body?.isPublished !== void 0 ? body.isPublished ? 1 : 0 : existing.is_published,
          now,
          id
        ).run();
        const updated = await db.prepare("SELECT * FROM services WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Updated Service", "service", id, updated?.name || existing.name);
        return json({ service: updated });
      }
      if (request.method === "DELETE") {
        await db.prepare("DELETE FROM services WHERE id = ?").bind(id).run();
        await logActivity(db, admin, "Deleted Service", "service", id, existing.name);
        return json({ ok: true });
      }
    }
    if (path === "/api/admin/portfolio") {
      if (request.method === "GET") {
        const res = await db.prepare("SELECT * FROM portfolio_items ORDER BY display_order ASC, created_at DESC").all();
        return json({ portfolio: res.results });
      }
      if (request.method === "POST") {
        const body = await safeJson(request);
        const title = String(body?.title || "").trim();
        const subtitle = String(body?.subtitle || "").trim();
        const category = String(body?.category || "Branding").trim();
        if (!title) return json({ error: "Project title is required." }, 400);
        const mediaId = body?.mediaId || null;
        let imageUrl = body?.imageUrl?.trim() || null;
        if (mediaId && !imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          imageUrl = mf?.public_url || null;
        }
        const id = generateId();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `INSERT INTO portfolio_items
             (id, title, subtitle, category, media_id, image_url, display_order, is_published, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
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
        ).run();
        const created = await db.prepare("SELECT * FROM portfolio_items WHERE id = ?").bind(id).first();
        await logActivity(db, admin, "Created Portfolio Project", "portfolio", id, title);
        return json({ item: created }, 201);
      }
    }
    const portfolioIdMatch = path.match(/^\/api\/admin\/portfolio\/([^/]+)$/);
    if (portfolioIdMatch) {
      const id = decodeURIComponent(portfolioIdMatch[1]);
      const existing = await db.prepare("SELECT * FROM portfolio_items WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Portfolio item not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const mediaId = body?.mediaId !== void 0 ? body.mediaId : existing.media_id;
        let imageUrl = body?.imageUrl !== void 0 ? body.imageUrl : existing.image_url;
        if (mediaId && !body?.imageUrl) {
          const mf = await db.prepare("SELECT public_url FROM media_files WHERE id = ?").bind(mediaId).first();
          if (mf?.public_url) imageUrl = mf.public_url;
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          `UPDATE portfolio_items
             SET title = ?, subtitle = ?, category = ?, media_id = ?, image_url = ?, display_order = ?, is_published = ?, updated_at = ?
             WHERE id = ?`
        ).bind(
          body?.title?.trim() ? body.title.trim().slice(0, 120) : existing.title,
          body?.subtitle !== void 0 ? body.subtitle.trim().slice(0, 300) : existing.subtitle,
          body?.category?.trim() ? body.category.trim().slice(0, 60) : existing.category,
          mediaId || null,
          imageUrl || null,
          body?.displayOrder !== void 0 ? Number(body.displayOrder) : existing.display_order,
          body?.isPublished !== void 0 ? body.isPublished ? 1 : 0 : existing.is_published,
          now,
          id
        ).run();
        const updated = await db.prepare("SELECT * FROM portfolio_items WHERE id = ?").bind(id).first();
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
    if (path === "/api/admin/quotes" && request.method === "GET") {
      const res = await db.prepare("SELECT * FROM quote_requests ORDER BY created_at DESC").all();
      return json({ quotes: res.results });
    }
    const quoteIdMatch = path.match(/^\/api\/admin\/quotes\/([^/]+)$/);
    if (quoteIdMatch) {
      const id = decodeURIComponent(quoteIdMatch[1]);
      const existing = await db.prepare("SELECT * FROM quote_requests WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Quote request not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const nextStatus = body?.status && QUOTE_STATUSES.includes(body.status) ? body.status : existing.status;
        const nextNotes = body?.internalNotes !== void 0 ? String(body.internalNotes).slice(0, 4e3) : existing.internal_notes;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare(
          "UPDATE quote_requests SET status = ?, internal_notes = ?, updated_at = ? WHERE id = ?"
        ).bind(nextStatus, nextNotes, now, id).run();
        const updated = await db.prepare("SELECT * FROM quote_requests WHERE id = ?").bind(id).first();
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
    if (path === "/api/admin/messages" && request.method === "GET") {
      const res = await db.prepare("SELECT * FROM contact_messages ORDER BY created_at DESC").all();
      return json({
        messages: res.results,
        emailProviderConfigured: Boolean(env.RESEND_API_KEY)
      });
    }
    const msgReplyMatch = path.match(/^\/api\/admin\/messages\/([^/]+)\/reply$/);
    if (msgReplyMatch && request.method === "POST") {
      const id = decodeURIComponent(msgReplyMatch[1]);
      const existing = await db.prepare("SELECT * FROM contact_messages WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Message not found." }, 404);
      const body = await safeJson(request);
      const replyText = String(body?.replyText || "").trim();
      const subject = String(body?.subject || `Re: ${existing.subject}`).trim();
      if (!replyText) {
        return json({ error: "Reply message cannot be empty." }, 400);
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (env.RESEND_API_KEY) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: env.EMAIL_FROM || "SUN-NOVA PRINT SERVICE <onboarding@resend.dev>",
            to: [existing.customer_email],
            subject,
            text: replyText
          })
        });
        if (!res.ok) {
          const errBody = await res.text();
          return json(
            {
              sent: false,
              configured: true,
              error: `Email provider error: ${errBody.slice(0, 200)}`
            },
            502
          );
        }
        await db.prepare(
          "UPDATE contact_messages SET is_read = 1, reply_note = ?, replied_at = ?, updated_at = ? WHERE id = ?"
        ).bind(replyText.slice(0, 4e3), now, now, id).run();
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
          message: "Email reply sent via configured mail provider."
        });
      }
      await db.prepare(
        "UPDATE contact_messages SET is_read = 1, reply_note = ?, updated_at = ? WHERE id = ?"
      ).bind(`[Draft saved \u2014 send via mail client]
${replyText.slice(0, 3800)}`, now, id).run();
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
        message: "No transactional email provider (RESEND_API_KEY) is configured on the server. Draft saved cleanly\u2014click Open Mail Client to send the actual email."
      });
    }
    const msgIdMatch = path.match(/^\/api\/admin\/messages\/([^/]+)$/);
    if (msgIdMatch) {
      const id = decodeURIComponent(msgIdMatch[1]);
      const existing = await db.prepare("SELECT * FROM contact_messages WHERE id = ?").bind(id).first();
      if (!existing) return json({ error: "Message not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const isRead = body?.isRead ? 1 : 0;
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await db.prepare("UPDATE contact_messages SET is_read = ?, updated_at = ? WHERE id = ?").bind(isRead, now, id).run();
        const updated = await db.prepare("SELECT * FROM contact_messages WHERE id = ?").bind(id).first();
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
    if (path === "/api/admin/users") {
      if (request.method === "GET") {
        const res = await db.prepare(
          "SELECT id, name, email, role, status, last_login_at, created_at, updated_at FROM admins ORDER BY created_at ASC"
        ).all();
        return json({ users: res.results });
      }
      if (request.method === "POST") {
        if (admin.role !== "super_admin") {
          return json(
            { error: "Only Super Admin can create administrator accounts." },
            403
          );
        }
        const body = await safeJson(request);
        const name = String(body?.name || "").trim();
        const email = sanitizeEmail(String(body?.email || ""));
        const password = String(body?.password || "");
        const role = body?.role === "super_admin" || body?.role === "admin" || body?.role === "content_manager" ? body.role : "content_manager";
        if (!name || !isValidEmail(email) || password.length < 8) {
          return json(
            { error: "Name, valid email, and password (min 8 chars) are required." },
            400
          );
        }
        const dup = await db.prepare("SELECT id FROM admins WHERE email = ?").bind(email).first();
        if (dup) {
          return json({ error: "An administrator with that email already exists." }, 409);
        }
        const id = generateId();
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const pwHash = await hashPassword(password);
        await db.prepare(
          `INSERT INTO admins (id, name, email, password_hash, role, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
        ).bind(id, name.slice(0, 100), email, pwHash, role, now, now).run();
        const created = await db.prepare(
          "SELECT id, name, email, role, status, last_login_at, created_at, updated_at FROM admins WHERE id = ?"
        ).bind(id).first();
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
      const target = await db.prepare("SELECT * FROM admins WHERE id = ?").bind(id).first();
      if (!target) return json({ error: "Administrator not found." }, 404);
      if (request.method === "PUT") {
        const body = await safeJson(request);
        const isSelf = target.id === admin.id;
        if (!isSelf && admin.role !== "super_admin") {
          return json(
            { error: "Only Super Admin can modify other administrator accounts." },
            403
          );
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
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
          await db.prepare("UPDATE admins SET password_hash = ?, updated_at = ? WHERE id = ?").bind(nextHash, now, id).run();
          await logActivity(db, admin, "Changed Admin Password", "admin", id, target.email);
        }
        const nextName = body?.name?.trim() ? body.name.trim().slice(0, 100) : target.name;
        const nextRole = admin.role === "super_admin" && (body?.role === "super_admin" || body?.role === "admin" || body?.role === "content_manager") ? body.role : target.role;
        const nextStatus = admin.role === "super_admin" && !isSelf && (body?.status === "active" || body?.status === "disabled") ? body.status : target.status;
        await db.prepare(
          "UPDATE admins SET name = ?, role = ?, status = ?, updated_at = ? WHERE id = ?"
        ).bind(nextName, nextRole, nextStatus, now, id).run();
        if (nextStatus === "disabled") {
          await db.prepare("DELETE FROM admin_sessions WHERE admin_id = ?").bind(id).run();
        }
        const updated = await db.prepare(
          "SELECT id, name, email, role, status, last_login_at, created_at, updated_at FROM admins WHERE id = ?"
        ).bind(id).first();
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
      const res = await db.prepare("SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100").all();
      return json({ logs: res.results });
    }
    return json({ error: "API endpoint not found." }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error.";
    console.error("API Router Error:", err);
    return json({ error: message }, 500);
  }
}
__name(handleApiRequest, "handleApiRequest");

// src/worker.ts
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/") && request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
          "Access-Control-Max-Age": "86400"
        }
      });
    }
    if (request.method === "POST") {
      if (url.pathname === "/api/chat") {
        return onRequestPost({ request, env });
      }
      if (url.pathname === "/api/ocr") {
        return onRequestPost2({ request, env });
      }
      if (url.pathname === "/api/resume-assist") {
        return onRequestPost3({ request, env });
      }
    }
    if (url.pathname.startsWith("/api/")) {
      const apiRes = await handleApiRequest(request, env);
      if (apiRes) {
        if (url.pathname === "/api/health") {
          const { storageStatus } = resolveStorageBindings(env);
          const headers = new Headers(apiRes.headers);
          headers.set("X-SunNova-Storage-Mode", storageStatus.mode);
          return new Response(apiRes.body, {
            status: apiRes.status,
            statusText: apiRes.statusText,
            headers
          });
        }
        return apiRes;
      }
      return Response.json(
        { error: "Unsupported API route or HTTP method." },
        { status: 404 }
      );
    }
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Not Found", { status: 404 });
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-jeXOev/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-jeXOev/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
