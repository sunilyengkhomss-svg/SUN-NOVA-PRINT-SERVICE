export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(colName?: string): Promise<T | null>;
  run<T = Record<string, unknown>>(): Promise<{
    success: boolean;
    meta?: Record<string, unknown>;
    results?: T[];
  }>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
    meta?: Record<string, unknown>;
  }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface R2ObjectBody {
  body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  size: number;
  etag?: string;
}

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: R2PutOptions
  ): Promise<unknown>;
  delete(keys: string | string[]): Promise<void>;
}

export interface AppWorkerEnv {
  DB?: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  GEMINI_API_KEY?: string;
  ADMIN_SETUP_TOKEN?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}
