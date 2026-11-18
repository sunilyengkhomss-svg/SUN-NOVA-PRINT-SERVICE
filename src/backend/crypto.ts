const PBKDF2_ITERATIONS = 100_000;

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function generateSecureToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPassword(password: string): Promise<string> {
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
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const hashBytes = new Uint8Array(derivedBits);
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hashBytes)}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 10_000 || iterations > 500_000) {
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
      salt: salt as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
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

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
  return cleaned.slice(0, 120) || "upload";
}

const BLOCKED_DANGEROUS_EXTENSIONS = new Set([
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
  "cgi",
]);

const SAFE_EXTENSION_MIME_MAP: Record<string, { mime: string; isImage?: boolean; isText?: boolean }> = {
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
  mp4: { mime: "video/mp4" },
};

export interface UploadTypePolicy {
  allowAnyUpload?: boolean;
  allowedUploadExtensions?: string[];
}

export interface DetectedUploadType {
  valid: boolean;
  mime: string;
  ext: string;
  isImage: boolean;
  isPdf: boolean;
  isText: boolean;
  error?: string;
}

export function normalizeExtension(ext: string): string {
  return ext.trim().toLowerCase().replace(/^\.+/, "").replace(/[^a-z0-9]/g, "");
}

function getFileExtension(filename: string): string {
  const clean = filename.trim().split(/[/\\]/).pop() || "";
  const dotIdx = clean.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === clean.length - 1) return "";
  return normalizeExtension(clean.slice(dotIdx + 1));
}

function sniffMagicFileType(
  bytes: Uint8Array
): { mime: string; ext: string; isImage: boolean; isPdf: boolean } | null {
  // PNG
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", ext: "png", isImage: true, isPdf: false };
  }
  // JPEG
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg", isImage: true, isPdf: false };
  }
  // GIF
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return { mime: "image/gif", ext: "gif", isImage: true, isPdf: false };
  }
  // WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp", isImage: true, isPdf: false };
  }
  // PDF
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return { mime: "application/pdf", ext: "pdf", isImage: false, isPdf: true };
  }
  return null;
}

export function detectUploadFileType(
  bytes: Uint8Array,
  declaredMime: string,
  filename: string,
  policy?: UploadTypePolicy
): DetectedUploadType {
  const fileExt = getFileExtension(filename);
  if (fileExt && BLOCKED_DANGEROUS_EXTENSIONS.has(fileExt)) {
    return {
      valid: false,
      mime: "application/octet-stream",
      ext: fileExt,
      isImage: false,
      isPdf: false,
      isText: false,
      error: `Executable/script extension ".${fileExt}" is blocked for security.`,
    };
  }

  // Block Windows PE (MZ) or ELF executables by header even if renamed
  if (
    (bytes.length >= 2 && bytes[0] === 0x4d && bytes[1] === 0x5a) ||
    (bytes.length >= 4 && bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46)
  ) {
    return {
      valid: false,
      mime: "application/octet-stream",
      ext: fileExt || "bin",
      isImage: false,
      isPdf: false,
      isText: false,
      error: "Executable binary payloads are blocked for security.",
    };
  }

  const magic = sniffMagicFileType(bytes);
  const allowAny = policy?.allowAnyUpload !== false;
  const allowList = new Set(
    (policy?.allowedUploadExtensions || ["jpg", "jpeg", "png", "webp", "pdf"])
      .map(normalizeExtension)
      .filter(Boolean)
  );

  const checkAllowed = (extToCheck: string): boolean => {
    if (allowAny) return true;
    if (extToCheck === "jpeg" && (allowList.has("jpg") || allowList.has("jpeg"))) return true;
    if (extToCheck === "jpg" && (allowList.has("jpg") || allowList.has("jpeg"))) return true;
    return allowList.has(extToCheck);
  };

  if (magic) {
    if (!checkAllowed(magic.ext)) {
      return {
        valid: false,
        mime: magic.mime,
        ext: magic.ext,
        isImage: magic.isImage,
        isPdf: magic.isPdf,
        isText: false,
        error: `Extension ".${magic.ext}" is not enabled in the site's allowed upload list.`,
      };
    }
    return {
      valid: true,
      mime: magic.mime,
      ext: magic.ext,
      isImage: magic.isImage,
      isPdf: magic.isPdf,
      isText: false,
    };
  }

  // Fallback for XML/text without extension or declared application/xml / text/xml
  const trimmedHead = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, Math.min(bytes.length, 512)))
    .trimStart();

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
      error: `Extension ".${resolvedExt}" is not enabled in the site's customizable upload rules.`,
    };
  }

  // Prevent stored HTML XSS execution by normalizing HTML uploads to safe plain text
  if (resolvedExt === "html" || resolvedExt === "htm") {
    return {
      valid: true,
      mime: "text/plain",
      ext: resolvedExt,
      isImage: false,
      isPdf: false,
      isText: true,
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
      isText: Boolean(mapped.isText),
    };
  }

  const safeDeclared =
    declaredMime &&
    !declaredMime.includes("html") &&
    !declaredMime.includes("javascript") &&
    !declaredMime.includes("x-msdownload")
      ? declaredMime.split(";")[0].trim()
      : "application/octet-stream";

  return {
    valid: true,
    mime: safeDeclared || "application/octet-stream",
    ext: resolvedExt,
    isImage: safeDeclared.startsWith("image/"),
    isPdf: false,
    isText: safeDeclared.startsWith("text/") || safeDeclared.includes("xml") || safeDeclared.includes("json"),
  };
}

export function detectAllowedFileType(
  bytes: Uint8Array,
  declaredMime: string,
  filename: string
): { valid: boolean; mime: string; ext: string; isImage: boolean; isPdf: boolean } {
  const res = detectUploadFileType(bytes, declaredMime, filename, {
    allowAnyUpload: false,
    allowedUploadExtensions: ["jpg", "jpeg", "png", "webp", "pdf"],
  });
  return {
    valid: res.valid,
    mime: res.mime,
    ext: res.ext,
    isImage: res.isImage,
    isPdf: res.isPdf,
  };
}

export function isValidHexColor(val: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(val.trim());
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 160);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
