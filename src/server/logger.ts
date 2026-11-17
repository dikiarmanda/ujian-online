import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Logger terstruktur JSON (stdout → ditangkap PM2).
 * Format meniru Pino: satu baris JSON per kejadian dengan field standar
 * (time, level, event, requestId, userId, role, ip, ujianId, msg).
 *
 * Pengganti Pino karena registry npm tidak bisa diakses; bila nanti Pino
 * tersedia, implementasi ini bisa ditukar tanpa mengubah call site
 * (logEvent/logChild tetap sama).
 */

export type LogLevel = "info" | "warn" | "error" | "debug";

export type LogFields = {
  requestId?: string;
  userId?: number | string | null;
  adminId?: number | string | null;
  role?: "peserta" | "admin" | "sistem" | string;
  ip?: string | null;
  ujianId?: number | string | null;
  sesiId?: number | string | null;
  msg?: string;
  [key: string]: unknown;
};

const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "token",
  "authorization",
  "cookie",
  "set-cookie",
  "secret",
  "api_key",
  "apikey",
  "access_token",
  "refresh_token",
  "sid",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, "");
  return [...SENSITIVE_KEYS].some((s) => normalized === s.replace(/[-_]/g, ""));
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => redactValue(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? "[REDACTED]" : redactValue(val, depth + 1);
    }
    return out;
  }
  return value;
}

type LogContext = {
  requestId: string;
  userId?: number | string | null;
  adminId?: number | string | null;
  role?: string;
  ip?: string | null;
  ujianId?: number | string | null;
  sesiId?: number | string | null;
};

const als = new AsyncLocalStorage<LogContext>();

/** Jalankan fn dengan konteks requestId baru (dipakai withErrors). */
export function runWithLogContext<T>(fn: () => Promise<T>): Promise<T> {
  return als.run({ requestId: randomUUID() }, fn);
}

/** Perbarui field konteks (userId/role/ip) setelah auth terbaca. */
export function setLogContext(patch: Partial<LogContext>): void {
  const ctx = als.getStore();
  if (ctx) Object.assign(ctx, patch);
}

/** Request id aktif untuk request ini (untuk header response, dsb). */
export function getLogRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

function contextDefaults(): LogContext {
  return als.getStore() ?? { requestId: randomUUID() };
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel =
  process.env.LOG_LEVEL === "debug" || process.env.LOG_LEVEL === "warn" || process.env.LOG_LEVEL === "error"
    ? process.env.LOG_LEVEL
    : "info";

function write(level: LogLevel, event: string, fields: LogFields): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
  const ctx = contextDefaults();
  const { requestId, userId, adminId, role, ip, ujianId, sesiId, msg, ...rest } = fields;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    event,
    requestId: requestId ?? ctx.requestId,
    ...(userId != null ? { userId } : ctx.userId != null ? { userId: ctx.userId } : {}),
    ...(adminId != null ? { adminId } : {}),
    ...(role ? { role } : ctx.role ? { role: ctx.role } : {}),
    ...(ip ? { ip } : ctx.ip ? { ip: ctx.ip } : {}),
    ...(ujianId != null ? { ujianId } : ctx.ujianId != null ? { ujianId: ctx.ujianId } : {}),
    ...(sesiId != null ? { sesiId } : {}),
    ...(msg ? { msg } : {}),
    ...(redactValue(rest) as Record<string, unknown>),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);
}

export function logEvent(event: string, fields: LogFields = {}): void {
  write("info", event, fields);
}

export function logWarn(event: string, fields: LogFields = {}): void {
  write("warn", event, fields);
}

export function logError(event: string, fields: LogFields = {}): void {
  write("error", event, fields);
}

/** Log error server standar: stack trace + konteks. */
export function logServerError(error: unknown, fields: LogFields = {}): void {
  const err = error instanceof Error ? error : new Error(String(error));
  write("error", "error_server", {
    ...fields,
    msg: err.message,
    errorName: err.name,
    stack: err.stack,
  });
}
