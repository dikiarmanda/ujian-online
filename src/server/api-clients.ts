import { z } from "zod";
import { createApiKeyMaterial } from "./api-keys";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";

const clientSchema = z.object({
  name: z.string().trim().min(1, "Isi nama klien.").max(150),
  description: z.string().trim().max(500).optional(),
  allExams: z.boolean().default(false),
  examIds: z.array(z.number().int().positive()).default([]),
  allowedIps: z.array(z.string().trim().min(1).max(45)).default([]),
  rateLimitPerMinute: z.number().int().min(1).max(6000).default(60),
});

const keySchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export async function createApiClient(actorId: number, input: unknown, ipAddress: string) {
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Data klien tidak valid.", 422);
  const examIds = [...new Set(parsed.data.examIds)];
  if (!parsed.data.allExams && examIds.length) {
    const found = await prisma.exam.count({ where: { id: { in: examIds } } });
    if (found !== examIds.length) throw new AppError("Salah satu ujian tidak ditemukan.", 422);
  }
  const client = await prisma.apiClient.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      allExams: parsed.data.allExams,
      allowedIps: parsed.data.allowedIps,
      rateLimitPerMinute: parsed.data.rateLimitPerMinute,
      createdById: actorId,
      exams: parsed.data.allExams ? undefined : { create: examIds.map((examId) => ({ examId })) },
    },
  });
  await writeAudit({
    userId: actorId,
    action: "CREATE_API_CLIENT",
    entityType: "api_client",
    entityId: client.id,
    ipAddress,
  });
  return client;
}

export async function revokeApiClient(actorId: number, clientId: number, ipAddress: string) {
  const existing = await prisma.apiClient.findUnique({ where: { id: clientId } });
  if (!existing) throw new AppError("Klien tidak ditemukan.", 404);
  await prisma.apiClient.update({
    where: { id: clientId },
    data: { status: "REVOKED", revokedAt: new Date() },
  });
  await writeAudit({
    userId: actorId,
    action: "REVOKE_API_CLIENT",
    entityType: "api_client",
    entityId: clientId,
    ipAddress,
  });
}

export async function createClientKey(actorId: number, clientId: number, input: unknown, ipAddress: string) {
  const client = await prisma.apiClient.findUnique({ where: { id: clientId } });
  if (!client || client.status !== "ACTIVE") throw new AppError("Klien tidak ditemukan.", 404);
  const parsed = keySchema.safeParse(input ?? {});
  if (!parsed.success) throw new AppError("Tanggal kedaluwarsa tidak valid.", 422);
  const active = await prisma.apiKey.count({
    where: {
      clientId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });
  if (active >= 2) throw new AppError("Klien ini sudah memiliki dua kunci aktif.", 422);
  const material = createApiKeyMaterial();
  const key = await prisma.apiKey.create({
    data: {
      clientId,
      prefix: material.prefix,
      keyHash: material.keyHash,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });
  await writeAudit({
    userId: actorId,
    action: "CREATE_API_KEY",
    entityType: "api_key",
    entityId: key.id,
    meta: { clientId, prefix: material.prefix },
    ipAddress,
  });
  return { id: key.id, prefix: key.prefix, key: material.token, expiresAt: key.expiresAt?.toISOString() ?? null };
}

export async function revokeClientKey(actorId: number, clientId: number, keyId: number, ipAddress: string) {
  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.clientId !== clientId) throw new AppError("Kunci tidak ditemukan.", 404);
  await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  await writeAudit({
    userId: actorId,
    action: "REVOKE_API_KEY",
    entityType: "api_key",
    entityId: keyId,
    ipAddress,
  });
}
