import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { D1Database, D1PreparedStatement, R2Bucket, R2ObjectBody, R2PutOptions } from "./d1Types";

const require = createRequire(import.meta.url);

interface SqliteStatementLike {
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
}

interface SqliteDbLike {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatementLike;
}

class LocalD1Statement implements D1PreparedStatement {
  private readonly db: SqliteDbLike;
  private readonly sql: string;
  private readonly params: unknown[];

  constructor(db: SqliteDbLike, sql: string, params: unknown[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }

  bind(...values: unknown[]): D1PreparedStatement {
    return new LocalD1Statement(this.db, this.sql, values);
  }

  async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
    const stmt = this.db.prepare(this.sql);
    const row = stmt.get(...this.params);
    if (!row) return null;
    if (colName) {
      return (row[colName] as T) ?? null;
    }
    return row as T;
  }

  async run<T = Record<string, unknown>>(): Promise<{
    success: boolean;
    meta?: Record<string, unknown>;
    results?: T[];
  }> {
    const stmt = this.db.prepare(this.sql);
    const res = stmt.run(...this.params);
    return {
      success: true,
      meta: {
        changes: Number(res.changes),
        last_row_id: Number(res.lastInsertRowid),
      },
    };
  }

  async all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta?: Record<string, unknown>;
  }> {
    const stmt = this.db.prepare(this.sql);
    const rows = stmt.all(...this.params);
    return {
      results: rows as T[],
      success: true,
      meta: {},
    };
  }
}

class LocalD1Database implements D1Database {
  private readonly db: SqliteDbLike;

  constructor(db: SqliteDbLike) {
    this.db = db;
  }

  prepare(query: string): D1PreparedStatement {
    return new LocalD1Statement(this.db, query);
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
    this.db.exec(query);
    return { count: 1, duration: Date.now() - t0 };
  }
}

class LocalR2Bucket implements R2Bucket {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    fs.mkdirSync(this.rootDir, { recursive: true });
  }

  private resolveKeyPath(key: string): string {
    const safeRel = key.replace(/^\/+/, "").replace(/\.\./g, "_");
    return path.resolve(this.rootDir, safeRel);
  }

  async get(key: string): Promise<R2ObjectBody | null> {
    const filePath = this.resolveKeyPath(key);
    const metaPath = `${filePath}.meta.json`;
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    let httpMetadata: R2PutOptions["httpMetadata"] = undefined;
    if (fs.existsSync(metaPath)) {
      try {
        httpMetadata = JSON.parse(fs.readFileSync(metaPath, "utf8")) as R2PutOptions["httpMetadata"];
      } catch {
        // ignore bad meta
      }
    }
    const uint8 = new Uint8Array(buf);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(uint8);
        controller.close();
      },
    });
    return {
      body: stream,
      async arrayBuffer() {
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      },
      httpMetadata,
      size: buf.byteLength,
    };
  }

  async put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions
  ): Promise<unknown> {
    const filePath = this.resolveKeyPath(key);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    let nodeBuf: Buffer;
    if (typeof value === "string") {
      nodeBuf = Buffer.from(value, "utf8");
    } else if (value instanceof ArrayBuffer) {
      nodeBuf = Buffer.from(value);
    } else if (ArrayBuffer.isView(value)) {
      nodeBuf = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    } else if (value instanceof Blob) {
      nodeBuf = Buffer.from(await value.arrayBuffer());
    } else {
      const resp = new Response(value);
      nodeBuf = Buffer.from(await resp.arrayBuffer());
    }

    fs.writeFileSync(filePath, nodeBuf);
    if (options?.httpMetadata) {
      fs.writeFileSync(`${filePath}.meta.json`, JSON.stringify(options.httpMetadata), "utf8");
    }
    return { key, size: nodeBuf.byteLength };
  }

  async delete(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const k of list) {
      const filePath = this.resolveKeyPath(k);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      const metaPath = `${filePath}.meta.json`;
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    }
  }
}

let cachedLocalAdapters: { db: D1Database; bucket: R2Bucket } | null = null;

export function getLocalAdapters(workspaceDir: string): { db: D1Database; bucket: R2Bucket } {
  if (cachedLocalAdapters) return cachedLocalAdapters;

  const dataDir = path.join(workspaceDir, ".local-backend");
  const dbPath = path.join(dataDir, "sunnova.db");
  const r2Dir = path.join(dataDir, "r2");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(r2Dir, { recursive: true });

  const { DatabaseSync } = require("node:sqlite") as {
    DatabaseSync: new (filePath: string) => SqliteDbLike;
  };
  const sqlite = new DatabaseSync(dbPath);
  const migrationPath = path.join(workspaceDir, "migrations", "0001_init.sql");
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, "utf8");
    sqlite.exec(sql);
  }

  cachedLocalAdapters = {
    db: new LocalD1Database(sqlite),
    bucket: new LocalR2Bucket(r2Dir),
  };
  return cachedLocalAdapters;
}
