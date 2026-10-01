import { Prisma } from "@/generated/prisma/client";
import { writeAudit } from "./audit";
import { authProvider } from "./auth/provider";
import { prisma } from "./db";
import { AppError } from "./errors";
import { mapOriginRole } from "./exam-rules";

export async function syncParticipants(triggeredById: number | null, ipAddress?: string) {
  const log = await prisma.syncLog.create({ data: { triggeredById } });
  let successCount = 0;
  let failedCount = 0;
  const failures: { externalId: string | null; identity: string | null; reason: string }[] = [];
  try {
    const provider = authProvider();
    for (let page = 1; page <= 50; page += 1) {
      const batch = await provider.listParticipants(page);
      for (const row of batch.items) {
        if (!row.externalId || !row.identity || !row.name) {
          failedCount += 1;
          failures.push({
            externalId: row.externalId || null,
            identity: row.identity || null,
            reason: "Data peserta tidak lengkap.",
          });
          continue;
        }
        try {
          const role = mapOriginRole(row.role);
          if (role !== "PARTICIPANT") {
            throw new Error("Sinkron peserta hanya menerima role peserta.");
          }
          const existing = await prisma.user.findUnique({ where: { externalId: row.externalId } });
          if (existing && existing.role !== "PARTICIPANT") {
            throw new Error("ID eksternal sudah dipakai akun bukan peserta.");
          }
          await prisma.user.upsert({
            where: { externalId: row.externalId },
            create: {
              externalId: row.externalId,
              identity: row.identity,
              name: row.name,
              role: "PARTICIPANT",
              groupName: row.groupName || null,
              lastSyncedAt: new Date(),
            },
            update: {
              identity: row.identity,
              name: row.name,
              groupName: row.groupName || null,
              isActive: true,
              lastSyncedAt: new Date(),
            },
          });
          successCount += 1;
        } catch (error) {
          failedCount += 1;
          failures.push({
            externalId: row.externalId,
            identity: row.identity,
            reason: error instanceof Error ? error.message : "Gagal menyimpan peserta.",
          });
        }
      }
      if (!batch.hasMore) break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi terhenti.";
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), successCount, failedCount: failedCount + 1, message },
    });
    throw new AppError(
      "Layanan data peserta sedang tidak dapat dihubungi. Coba lagi dalam beberapa saat.",
      503,
    );
  }

  if (failures.length) {
    await prisma.syncFailure.createMany({
      data: failures.map((failure) => ({ ...failure, syncLogId: log.id })),
    });
  }
  const updated = await prisma.syncLog.update({
    where: { id: log.id },
    data: {
      finishedAt: new Date(),
      successCount,
      failedCount,
      message: failedCount ? "Sebagian data gagal disimpan." : "Sinkronisasi selesai.",
    },
    include: { failures: true },
  });
  await writeAudit({
    userId: triggeredById,
    action: "SYNC",
    entityType: "sync_log",
    entityId: updated.id,
    meta: { successCount, failedCount },
    ipAddress,
  });
  return updated;
}

export async function listSyncLogs() {
  return prisma.syncLog.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { failures: true, triggeredBy: { select: { name: true } } },
  });
}

export function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
