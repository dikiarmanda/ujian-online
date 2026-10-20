import bcrypt from "bcrypt";
import { z } from "zod";
import { mapJenjang, type JenjangGroup } from "@/lib/jenjang";
import { writeAudit } from "../audit";
import { prisma } from "../db";
import { env } from "../env";
import { AppError, OriginDownError } from "../errors";
import { mapOmbnAdminRole, type AppRole } from "../exam-rules";
import { passwordsMatch } from "../login-rules";
import { ombn } from "../ombn-db";
import { redis } from "../redis";
import { createSession, resetUserSession } from "../session";
import { log } from "console";

const loginSchema = z.object({
  identity: z.string().trim().min(1, "Isi identitas.").max(100),
  password: z.string().min(1, "Isi kata sandi.").max(200),
});

const genericLoginError = () =>
  new AppError("Identitas atau kata sandi tidak cocok. Periksa lalu coba lagi.", 401);

type Account = {
  externalId: string;
  identity: string;
  name: string;
  role: AppRole;
  groupName: string | null;
  nisn: string | null;
  competitionId: number | null;
  jenjangGroup: JenjangGroup | null;
};

function failureKey(kind: "id" | "ip", value: string): string {
  return `login:fail:${kind}:${value}`;
}

function lockKey(kind: "id" | "ip", value: string): string {
  return `login:lock:${kind}:${value}`;
}

async function assertLoginAllowed(identity: string, ipAddress: string): Promise<void> {
  const locked = await redis.exists(lockKey("id", identity), lockKey("ip", ipAddress));
  if (locked) {
    throw new AppError("Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.", 429);
  }
}

async function recordLoginFailure(identity: string, ipAddress: string): Promise<void> {
  const config = env();
  for (const [kind, value] of [
    ["id", identity],
    ["ip", ipAddress],
  ] as const) {
    const key = failureKey(kind, value);
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, config.loginLockSeconds);
    if (count >= config.loginMaxFailures) {
      await redis.set(lockKey(kind, value), "1", "EX", config.loginLockSeconds);
      await redis.del(key);
    }
  }
}

async function clearLoginFailures(identity: string, ipAddress: string): Promise<void> {
  await redis.del(failureKey("id", identity), failureKey("ip", ipAddress));
}

async function findPeserta(identity: string, password: string): Promise<Account> {
  const row = await ombn.lomba_peserta.findUnique({
    where: { nomor_peserta: identity },
    select: {
      id: true,
      nomor_peserta: true,
      password: true,
      nama: true,
      nisn: true,
      nama_kelompok: true,
      competition_id: true,
      schools: { select: { nama_sekolah: true, tingkat: true } },
    },
  });
  if (!row?.nomor_peserta || !row.password || !passwordsMatch(row.password, password)) {
    throw genericLoginError();
  }
  if (!row.schools?.tingkat) {
    throw new AppError("Jenjang sekolah peserta tidak ditemukan. Hubungi panitia.", 403);
  }
  let jenjangGroup: JenjangGroup;
  try {
    jenjangGroup = mapJenjang(row.schools.tingkat);
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "Jenjang tidak valid.", 403);
  }
  return {
    externalId: `ombn-peserta:${row.id.toString()}`,
    identity: row.nomor_peserta,
    name: row.nama,
    role: "PARTICIPANT",
    groupName: row.nama_kelompok || row.schools.nama_sekolah || null,
    nisn: row.nisn?.trim() || null,
    competitionId: Number(row.competition_id),
    jenjangGroup,
  };
}

const DUMMY_PASSWORD_HASH = "$2b$10$1Q69Iil8ANk9qyR7Lpm8rOyPlFKhvhQMldijT3ebtaqXzjm.Uh./.";

async function findAdmin(identity: string, password: string): Promise<Account> {
  const row = await ombn.admins.findUnique({ where: { email: identity } });
  const role = row ? mapOmbnAdminRole(row.role) : null;
  const hash = row?.password_hash?.replace(/^\$2y\$/, "$2b$") || DUMMY_PASSWORD_HASH;
  let matched = false;
  try {
    matched = await bcrypt.compare(password, hash);
  } catch {
    matched = false;
  }
  console.log({
    found: !!row,
    status: row?.status,          // cek nilai persisnya
    rawRole: row?.role,
    mappedRole: role,
    hashPrefix: row?.password_hash?.slice(0, 7),
    hashLen: row?.password_hash?.length,
    hashHasWhitespace: row?.password_hash ? /\s/.test(row.password_hash) : null,
    matched,
  });
  if (!row || row.status !== "ACTIVE" || !role || !matched) throw genericLoginError();
  return {
    externalId: `ombn-admin:${row.id.toString()}`,
    identity: row.email,
    name: row.nama_lengkap,
    role,
    groupName: null,
    nisn: null,
    competitionId: null,
    jenjangGroup: null,
  };
}

async function saveProfile(account: Account) {
  let nisn: string | null | undefined = account.nisn;
  if (nisn) {
    const owner = await prisma.user.findUnique({ where: { nisn } });
    if (owner && owner.externalId !== account.externalId) nisn = undefined;
  }
  return prisma.user.upsert({
    where: { externalId: account.externalId },
    create: {
      externalId: account.externalId,
      identity: account.identity,
      name: account.name,
      role: account.role,
      groupName: account.groupName,
      nisn: nisn ?? null,
      lastSyncedAt: new Date(),
    },
    update: {
      identity: account.identity,
      name: account.name,
      role: account.role,
      groupName: account.groupName,
      ...(nisn !== undefined ? { nisn } : {}),
      isActive: true,
      lastSyncedAt: new Date(),
    },
  });
}

async function findMockAccount(identity: string): Promise<Account | null> {
  const key = identity.trim().toLowerCase();
  if (key === "admin") {
    return {
      externalId: "mock:admin",
      identity: "admin",
      name: "Admin Contoh",
      role: "ADMIN",
      groupName: null,
      nisn: null,
      competitionId: null,
      jenjangGroup: null,
    };
  }
  if (key === "petugas") {
    return {
      externalId: "mock:petugas",
      identity: "petugas",
      name: "Petugas Contoh",
      role: "GRADER",
      groupName: null,
      nisn: null,
      competitionId: null,
      jenjangGroup: null,
    };
  }
  if (key === "peserta" || key === "beban") {
    return {
      externalId: `mock:${key}`,
      identity: key,
      name: key === "beban" ? "Peserta Beban" : "Peserta Contoh",
      role: "PARTICIPANT",
      groupName: "Kelas 9A",
      nisn: null,
      competitionId: 1,
      jenjangGroup: "SMP",
    };
  }
  return null;
}

export async function loginUser(input: unknown, ipAddress: string) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Data masuk tidak lengkap.", 400);
  }
  const identity = parsed.data.identity;
  const password = parsed.data.password;
  await assertLoginAllowed(identity.toLowerCase(), ipAddress);
  let account: Account;
  try {
    // if (env().authDriver === "mock") {
    //   const mock = await findMockAccount(identity);
    //   if (!mock) throw genericLoginError();
    //   account = mock;
    // } else {
      account = identity.includes("@")
        ? await findAdmin(identity, password)
        : await findPeserta(identity, password);
    // }
  } catch (error) {
    if (error instanceof AppError && error.status === 401) {
      console.log("[LOGIN] Failed - Identity:", identity, "IP:", ipAddress, "Error:", error.message);
      await recordLoginFailure(identity.toLowerCase(), ipAddress);
      await writeAudit({
        action: "LOGIN_FAILED",
        entityType: "user",
        meta: { identity },
        ipAddress,
      });
      throw error;
    }
    if (error instanceof AppError) {
      console.log("[LOGIN] Error - Identity:", identity, "IP:", ipAddress, "Error:", error.message);
      throw error;
    }
    console.log("[LOGIN] Origin Down - Identity:", identity, "IP:", ipAddress);
    throw new OriginDownError();
  }
  await clearLoginFailures(identity.toLowerCase(), ipAddress);
  const user = await saveProfile(account);
  if (!user.isActive) throw new AppError("Akun ini tidak aktif. Hubungi admin.", 403);
  const sid = await createSession({
    userId: user.id,
    role: user.role,
    identity: user.identity,
    name: user.name,
    competitionId: account.competitionId,
    jenjangGroup: account.jenjangGroup,
  });
  await writeAudit({
    userId: user.id,
    action: "LOGIN",
    entityType: "user",
    entityId: user.id,
    ipAddress,
  });
  return { sid, role: user.role, name: user.name };
}

export async function revokeUserSession(actorId: number, userId: number, ipAddress: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("Pengguna tidak ditemukan.", 404);
  await resetUserSession(user.id);
  await writeAudit({
    userId: actorId,
    action: "REVOKE_SESSION",
    entityType: "user",
    entityId: user.id,
    ipAddress,
  });
}

export async function resetParticipantSession(actorId: number, userId: number, ipAddress: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "PARTICIPANT") {
    throw new AppError("Peserta tidak ditemukan.", 404);
  }
  await revokeUserSession(actorId, userId, ipAddress);
}
