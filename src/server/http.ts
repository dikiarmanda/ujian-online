import { type ZodType } from "zod";
import { AppError, isRedisUnavailable, RedisDownError } from "./errors";
import type { AppRole } from "./exam-rules";
import { clientIp, readCookie, readSession, type SessionRecord } from "./session";

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export async function withErrors(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    if (isRedisUnavailable(error)) {
      return json({ error: new RedisDownError().message }, 503);
    }
    console.error(error);
    return json({ error: "Terjadi kesalahan di server. Coba lagi." }, 500);
  }
}

export function assertMutationOrigin(req: Request): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return;
  if (req.headers.get("x-ujian-request") !== "1") {
    throw new AppError("Permintaan ditolak.", 403);
  }
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) throw new AppError("Permintaan ditolak.", 403);
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("Permintaan ditolak.", 403);
  }
  if (originHost !== host) throw new AppError("Permintaan ditolak.", 403);
}

export async function requireApiUser(req: Request, roles?: AppRole[]): Promise<SessionRecord> {
  assertMutationOrigin(req);
  const sid = readCookie(req, "sid");
  if (!sid) throw new AppError("Sesi tidak ditemukan. Masuk kembali.", 401);
  const session = await readSession(sid);
  if (!session) throw new AppError("Sesi berakhir. Masuk kembali.", 401);
  if (roles && !roles.includes(session.role)) {
    throw new AppError("Anda tidak memiliki akses ke tindakan ini.", 403);
  }
  return session;
}

export async function readBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const payload: unknown = await req.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Data tidak valid.", 400);
  }
  return parsed.data;
}

export function requestIp(req: Request): string {
  return clientIp(req);
}
