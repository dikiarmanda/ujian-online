import { z } from "zod";
import { writeAudit } from "../audit";
import { prisma } from "../db";
import { AppError } from "../errors";
import { mapOriginRole } from "../exam-rules";
import { hitRateLimit } from "../rate-limit";
import { createSession, resetUserSession } from "../session";
import { authProvider } from "./provider";

const loginSchema = z.object({
  identity: z.string().trim().min(1, "Isi identitas.").max(100),
  password: z.string().min(1, "Isi kata sandi.").max(200),
});

export async function loginUser(input: unknown, ipAddress: string) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message ?? "Data masuk tidak lengkap.", 400);
  }
  const identity = parsed.data.identity;
  await hitRateLimit(`rl:login:ip:${ipAddress}`, 20, 60);
  await hitRateLimit(`rl:login:id:${identity.toLowerCase()}`, 10, 60);

  const origin = await authProvider().login(identity, parsed.data.password);
  const role = mapOriginRole(origin.role);
  const user = await prisma.user.upsert({
    where: { externalId: origin.externalId },
    create: {
      externalId: origin.externalId,
      identity: origin.identity,
      name: origin.name,
      role,
      groupName: origin.groupName || null,
      lastSyncedAt: new Date(),
    },
    update: {
      identity: origin.identity,
      name: origin.name,
      role,
      groupName: origin.groupName || null,
      isActive: true,
    },
  });
  if (!user.isActive) {
    throw new AppError("Akun ini tidak aktif. Hubungi admin.", 403);
  }
  const sid = await createSession({
    userId: user.id,
    role: user.role,
    identity: user.identity,
    name: user.name,
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

export async function resetParticipantSession(actorId: number, userId: number, ipAddress: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "PARTICIPANT") {
    throw new AppError("Peserta tidak ditemukan.", 404);
  }
  await resetUserSession(user.id);
  await writeAudit({
    userId: actorId,
    action: "RESET_SESSION",
    entityType: "user",
    entityId: user.id,
    ipAddress,
  });
}
