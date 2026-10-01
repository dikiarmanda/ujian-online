import { createHash, randomBytes } from "node:crypto";
import type { AppRole } from "./exam-rules";
import { redis } from "./redis";

const TTL_SECONDS = 60 * 60 * 12;

export type SessionRecord = {
  userId: number;
  role: AppRole;
  identity: string;
  name: string;
};

function sessionKey(sid: string): string {
  return `session:${sid}`;
}

function userKey(userId: number): string {
  return `user:${userId}:sid`;
}

export async function createSession(record: SessionRecord): Promise<string> {
  const previous = await redis.get(userKey(record.userId));
  if (previous) await redis.del(sessionKey(previous));
  const sid = randomBytes(32).toString("hex");
  await redis.set(sessionKey(sid), JSON.stringify(record), "EX", TTL_SECONDS);
  await redis.set(userKey(record.userId), sid, "EX", TTL_SECONDS);
  return sid;
}

export async function readSession(sid: string): Promise<SessionRecord | null> {
  const raw = await redis.get(sessionKey(sid));
  if (!raw) return null;
  const parsed = JSON.parse(raw) as SessionRecord;
  const current = await redis.get(userKey(parsed.userId));
  if (current !== sid) {
    await redis.del(sessionKey(sid));
    return null;
  }
  return parsed;
}

export async function destroySession(sid: string): Promise<void> {
  const record = await readSession(sid);
  await redis.del(sessionKey(sid));
  if (record) {
    const current = await redis.get(userKey(record.userId));
    if (current === sid) await redis.del(userKey(record.userId));
  }
}

export async function resetUserSession(userId: number): Promise<void> {
  const sid = await redis.get(userKey(userId));
  if (sid) await redis.del(sessionKey(sid));
  await redis.del(userKey(userId));
}

export function sessionCookie(sid: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `sid=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${TTL_SECONDS}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return "local";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}
