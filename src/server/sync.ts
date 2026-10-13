import { Prisma } from "@/generated/prisma/client";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";
import { ombn } from "./ombn-db";

export async function syncParticipants(triggeredById: number | null, ipAddress?: string) {
  const log = await prisma.syncLog.create({ data: { triggeredById } });
  let successCount = 0;
  let failedCount = 0;
  const failures: { externalId: string | null; identity: string | null; reason: string }[] = [];
  const seenNisn = new Set<string>();
  try {
    const rows = await ombn.lomba_peserta.findMany({
      select: {
        id: true,
        nomor_peserta: true,
        nama: true,
        nisn: true,
        nama_kelompok: true,
        schools: { select: { nama_sekolah: true } },
      },
    });
    for (const row of rows) {
      const identity = row.nomor_peserta?.trim() || "";
      const nisn = row.nisn?.trim() || "";
      const externalId = `ombn-peserta:${row.id.toString()}`;
      if (!identity || !row.nama?.trim() || !nisn) {
        failedCount += 1;
        failures.push({
          externalId,
          identity: identity || null,
          reason: "Nomor peserta, nama, atau NISN tidak lengkap.",
        });
        continue;
      }
      if (seenNisn.has(nisn)) {
        failedCount += 1;
        failures.push({ externalId, identity, reason: "NISN sudah dipakai peserta lain pada sinkron ini." });
        continue;
      }
      seenNisn.add(nisn);
      try {
        const owner = await prisma.user.findUnique({ where: { nisn } });
        if (owner && owner.externalId !== externalId) {
          throw new Error("NISN sudah dipakai pengguna lain.");
        }
        await prisma.user.upsert({
          where: { externalId },
          create: {
            externalId,
            identity,
            nisn,
            name: row.nama,
            role: "PARTICIPANT",
            groupName: row.nama_kelompok || row.schools.nama_sekolah || null,
            lastSyncedAt: new Date(),
          },
          update: {
            identity,
            nisn,
            name: row.nama,
            role: "PARTICIPANT",
            groupName: row.nama_kelompok || row.schools.nama_sekolah || null,
            isActive: true,
            lastSyncedAt: new Date(),
          },
        });
        successCount += 1;
      } catch (error) {
        failedCount += 1;
        failures.push({
          externalId,
          identity,
          reason: error instanceof Error ? error.message : "Gagal menyimpan peserta.",
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sinkronisasi terhenti.";
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), successCount, failedCount: failedCount + 1, message },
    });
    throw new AppError("Data peserta OMBN sedang tidak dapat dihubungi. Coba lagi dalam beberapa saat.", 503);
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
