import {
  AppWorkerEnv,
  D1Database,
  D1PreparedStatement,
  R2Bucket,
  R2ObjectBody,
  R2PutOptions,
} from "./d1Types";

export interface StorageStatusInfo {
  d1Bound: boolean;
  r2Bound: boolean;
  geminiConfigured: boolean;
  setupTokenConfigured: boolean;
  emailProviderConfigured: boolean;
  mode: "d1+r2" | "d1+d1blob" | "memory-fallback";
  summary: string;
}

const SCHEMA_STATEMENTS: string[] = [
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
  )`,
];

const initializedDbs = new WeakSet<D1Database>();

export async function ensureSchemaTables(db: D1Database): Promise<void> {
  if (initializedDbs.has(db)) return;
  try {
    // Fast probe: if core tables + media_blobs already exist and are populated, skip DDL batch
    const [settingsRow] = await Promise.all([
      db.prepare("SELECT setting_key FROM website_settings LIMIT 1").first(),
      db.prepare("SELECT r2_key FROM media_blobs LIMIT 1").first(),
    ]);
    if (settingsRow) {
      initializedDbs.add(db);
      return;
    }
  } catch {
    // One or more tables are missing; proceed to batch creation
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

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function toUint8Array(
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob
): Promise<Uint8Array> {
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

/**
 * D1-backed R2 compatibility adapter when Cloudflare R2 (MEDIA_BUCKET) is not yet bound.
 * Persists uploaded assets cleanly inside D1 `media_blobs` up to 1.5 MB per file.
 */
class D1BlobR2Bucket implements R2Bucket {
  private readonly db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    await ensureSchemaTables(this.db);
    const row = await this.db
      .prepare("SELECT content_type, cache_control, data_base64, size_bytes FROM media_blobs WHERE r2_key = ?")
      .bind(key)
      .first<{
        content_type: string;
        cache_control: string | null;
        data_base64: string;
        size_bytes: number;
      }>();
    if (!row) return null;
    const bytes = base64ToUint8(row.data_base64);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
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
        cacheControl: row.cache_control || undefined,
      },
      size: Number(row.size_bytes) || bytes.byteLength,
    };
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions
  ): Promise<unknown> {
    await ensureSchemaTables(this.db);
    const bytes = await toUint8Array(value);
    if (bytes.byteLength > 1.5 * 1024 * 1024) {
      throw new Error(
        "Cloudflare R2 (MEDIA_BUCKET) is not bound yet. Bind MEDIA_BUCKET for files over 1.5 MB, or upload a smaller file."
      );
    }
    const b64 = uint8ToBase64(bytes);
    const now = new Date().toISOString();
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO media_blobs (r2_key, content_type, cache_control, data_base64, size_bytes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        key,
        options?.httpMetadata?.contentType || "application/octet-stream",
        options?.httpMetadata?.cacheControl || null,
        b64,
        bytes.byteLength,
        now
      )
      .run();
    return { key, size: bytes.byteLength };
  }

  async delete(keys: string | string[]): Promise<void> {
    await ensureSchemaTables(this.db);
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      await this.db.prepare("DELETE FROM media_blobs WHERE r2_key = ?").bind(k).run();
    }
  }
}

type RowRecord = Record<string, unknown>;

const PRIMARY_KEY_BY_TABLE: Record<string, string> = {
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
  rate_limits: "rate_key",
};

function splitTopLevelCsv(input: string): string[] {
  const parts: string[] = [];
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

function parseValueToken(
  token: string,
  params: unknown[],
  cursor: { idx: number }
): unknown {
  const t = token.trim();
  if (t === "?") {
    const val = params[cursor.idx];
    cursor.idx += 1;
    return val === undefined ? null : val;
  }
  if (/^NULL$/i.test(t)) return null;
  if (/^'.*'$/.test(t)) return t.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}

function matchesWhere(
  row: RowRecord,
  whereClause: string | undefined,
  params: unknown[],
  cursor: { idx: number }
): boolean {
  if (!whereClause || !whereClause.trim()) return true;
  const conditions = whereClause
    .split(/\s+AND\s+/i)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const cond of conditions) {
    let m: RegExpMatchArray | null;
    if ((m = cond.match(/^([a-zA-Z0-9_.]+)\s*=\s*(\?|'[^']*'|-?\d+|NULL)$/i))) {
      const col = m[1].split(".").pop()!;
      const expected = parseValueToken(m[2], params, cursor);
      if ((row[col] ?? null) !== expected) return false;
      continue;
    }
    if ((m = cond.match(/^([a-zA-Z0-9_.]+)\s+IS\s+NOT\s+NULL$/i))) {
      const col = m[1].split(".").pop()!;
      if (row[col] === null || row[col] === undefined) return false;
      continue;
    }
    if ((m = cond.match(/^([a-zA-Z0-9_.]+)\s+NOT\s+LIKE\s+'([^']*)'$/i))) {
      const col = m[1].split(".").pop()!;
      const pattern = new RegExp(`^${m[2].replace(/%/g, ".*")}$`, "i");
      if (pattern.test(String(row[col] ?? ""))) return false;
      continue;
    }
    if ((m = cond.match(/^([a-zA-Z0-9_.]+)\s+LIKE\s+'([^']*)'$/i))) {
      const col = m[1].split(".").pop()!;
      const pattern = new RegExp(`^${m[2].replace(/%/g, ".*")}$`, "i");
      if (!pattern.test(String(row[col] ?? ""))) return false;
      continue;
    }
  }
  return true;
}

function sortRows(rows: RowRecord[], orderClause: string | undefined): RowRecord[] {
  if (!orderClause || !orderClause.trim()) return rows;
  const specs = orderClause
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const [col, dir] = part.split(/\s+/);
      return { col: col.split(".").pop()!, desc: /^DESC$/i.test(dir || "") };
    });

  return [...rows].sort((a, b) => {
    for (const s of specs) {
      const av = a[s.col];
      const bv = b[s.col];
      if (av === bv) continue;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
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

class MemoryD1Statement implements D1PreparedStatement {
  private readonly tables: Map<string, RowRecord[]>;
  private readonly sql: string;
  private readonly params: unknown[];

  constructor(tables: Map<string, RowRecord[]>, sql: string, params: unknown[] = []) {
    this.tables = tables;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.params = params;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new MemoryD1Statement(this.tables, this.sql, values);
  }

  private getTable(name: string): RowRecord[] {
    let arr = this.tables.get(name);
    if (!arr) {
      arr = [];
      this.tables.set(name, arr);
    }
    return arr;
  }

  async run<T = Record<string, unknown>>(): Promise<{
    success: boolean;
    meta?: Record<string, unknown>;
    results?: T[];
  }> {
    if (/^CREATE\s+(TABLE|INDEX)/i.test(this.sql)) {
      const m = this.sql.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_]+)/i);
      if (m) this.getTable(m[1]);
      return { success: true, meta: { changes: 0 } };
    }

    // INSERT
    const insMatch = this.sql.match(
      /^INSERT\s+(?:OR\s+(IGNORE|REPLACE)\s+)?INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i
    );
    if (insMatch) {
      const mode = (insMatch[1] || "").toUpperCase();
      const table = insMatch[2];
      const cols = splitTopLevelCsv(insMatch[3]);
      const valTokens = splitTopLevelCsv(insMatch[4]);
      const cursor = { idx: 0 };
      const record: RowRecord = {};
      for (let i = 0; i < cols.length; i += 1) {
        record[cols[i]] = parseValueToken(valTokens[i] ?? "NULL", this.params, cursor);
      }

      const rows = this.getTable(table);
      const pk = PRIMARY_KEY_BY_TABLE[table] || "id";
      const existingIdx = rows.findIndex((r) => r[pk] !== undefined && r[pk] === record[pk]);
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

    // UPDATE
    const updMatch = this.sql.match(
      /^UPDATE\s+([a-zA-Z0-9_]+)\s+SET\s+(.+?)(?:\s+WHERE\s+(.+))?$/i
    );
    if (updMatch) {
      const table = updMatch[1];
      const setPairs = splitTopLevelCsv(updMatch[2]);
      const whereClause = updMatch[3];
      const cursor = { idx: 0 };
      const assignments: Array<{ col: string; kind: "val" | "inc"; val?: unknown }> = [];
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
            val: parseValueToken(rhs, this.params, cursor),
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

    // DELETE
    const delMatch = this.sql.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i);
    if (delMatch) {
      const table = delMatch[1];
      const whereClause = delMatch[2];
      const rows = this.getTable(table);
      const kept: RowRecord[] = [];
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

  async all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta?: Record<string, unknown>;
  }> {
    // Handle admin_sessions INNER JOIN admins query
    if (/FROM\s+admin_sessions\s+s\s+INNER\s+JOIN\s+admins\s+a/i.test(this.sql)) {
      const sessions = this.getTable("admin_sessions");
      const admins = this.getTable("admins");
      const tokenHash = this.params[0];
      const matched: RowRecord[] = [];
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
            expires_at: s.expires_at,
          });
        }
      }
      return { results: matched as T[], success: true, meta: {} };
    }

    // COUNT(*)
    const cntMatch = this.sql.match(
      /^SELECT\s+COUNT\(\*\)\s+as\s+([a-zA-Z0-9_]+)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+))?$/i
    );
    if (cntMatch) {
      const alias = cntMatch[1];
      const table = cntMatch[2];
      const whereClause = cntMatch[3];
      const rows = this.getTable(table).filter((r) =>
        matchesWhere(r, whereClause, this.params, { idx: 0 })
      );
      return { results: [{ [alias]: rows.length } as T], success: true, meta: {} };
    }

    // GROUP BY status
    const grpMatch = this.sql.match(
      /^SELECT\s+status,\s*COUNT\(\*\)\s+as\s+count\s+FROM\s+([a-zA-Z0-9_]+)\s+GROUP\s+BY\s+status$/i
    );
    if (grpMatch) {
      const rows = this.getTable(grpMatch[1]);
      const counts = new Map<string, number>();
      for (const r of rows) {
        const st = String(r.status || "New");
        counts.set(st, (counts.get(st) || 0) + 1);
      }
      const out = Array.from(counts.entries()).map(([status, count]) => ({
        status,
        count,
      }));
      return { results: out as T[], success: true, meta: {} };
    }

    // Generic SELECT
    const selMatch = this.sql.match(
      /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i
    );
    if (selMatch) {
      const selectCols = selMatch[1].trim();
      const table = selMatch[2];
      const whereClause = selMatch[3];
      const orderClause = selMatch[4];
      const limit = selMatch[5] ? Number(selMatch[5]) : null;

      let rows = this.getTable(table).filter((r) =>
        matchesWhere(r, whereClause, this.params, { idx: 0 })
      );
      rows = sortRows(rows, orderClause);
      if (limit !== null) rows = rows.slice(0, limit);

      if (selectCols === "*") {
        return {
          results: rows.map((r) => ({ ...r })) as T[],
          success: true,
          meta: {},
        };
      }

      const cols = splitTopLevelCsv(selectCols);
      const projected = rows.map((r) => {
        const obj: RowRecord = {};
        for (const c of cols) {
          const key = c.split(".").pop()!;
          obj[key] = r[key] ?? null;
        }
        return obj;
      });
      return { results: projected as T[], success: true, meta: {} };
    }

    return { results: [], success: true, meta: {} };
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const res = await this.all<RowRecord>();
    const row = res.results[0];
    if (!row) return null;
    if (colName) return (row[colName] as T) ?? null;
    return row as T;
  }
}

class MemoryD1Database implements D1Database {
  private readonly tables = new Map<string, RowRecord[]>();

  prepare(query: string): D1PreparedStatement {
    return new MemoryD1Statement(this.tables, query);
  }

  async batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]> {
    const out: T[] = [];
    for (const s of statements) {
      out.push((await s.run()) as T);
    }
    return out;
  }

  async exec(query: string): Promise<{ count: number; duration: number }> {
    const t0 = Date.now();
    const parts = query
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const p of parts) {
      await this.prepare(p).run();
    }
    return { count: parts.length, duration: Date.now() - t0 };
  }
}

class MemoryR2Bucket implements R2Bucket {
  private readonly store = new Map<
    string,
    { bytes: Uint8Array; httpMetadata?: R2PutOptions["httpMetadata"] }
  >();

  async get(key: string): Promise<R2ObjectBody | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    const bytes = entry.bytes;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return {
      body: stream,
      async arrayBuffer() {
        const copy = new Uint8Array(bytes.byteLength);
        copy.set(bytes);
        return copy.buffer;
      },
      httpMetadata: entry.httpMetadata,
      size: bytes.byteLength,
    };
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions
  ): Promise<unknown> {
    const bytes = await toUint8Array(value);
    this.store.set(key, { bytes, httpMetadata: options?.httpMetadata });
    return { key, size: bytes.byteLength };
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      this.store.delete(k);
    }
  }
}

// Isolate-scoped singleton fallback so requests inside a worker isolate share temporary state
let sharedMemoryDb: MemoryD1Database | null = null;
let sharedMemoryBucket: MemoryR2Bucket | null = null;

function getMemoryFallbackDb(): D1Database {
  if (!sharedMemoryDb) sharedMemoryDb = new MemoryD1Database();
  return sharedMemoryDb;
}

function getMemoryFallbackBucket(): R2Bucket {
  if (!sharedMemoryBucket) sharedMemoryBucket = new MemoryR2Bucket();
  return sharedMemoryBucket;
}

export function resolveStorageBindings(env: AppWorkerEnv): {
  db: D1Database;
  bucket: R2Bucket;
  storageStatus: StorageStatusInfo;
} {
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
        summary: "Cloudflare D1 (DB) and R2 (MEDIA_BUCKET) active.",
      },
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
        summary:
          "Cloudflare D1 (DB) bound; R2 (MEDIA_BUCKET) unbound — storing files in D1 blob fallback (max 1.5 MB/file).",
      },
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
      summary:
        "Cloudflare D1 (DB) is not bound yet — running in temporary isolate fallback mode so the site stays online without 503 errors.",
    },
  };
}
