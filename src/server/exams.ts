import { z } from "zod";
import { assertJenjangPackagesComplete, parseCompetitionJenjang, type JenjangGroup } from "@/lib/jenjang";
import { writeAudit } from "./audit";
import { getCompetitionById, invalidateCompetitionCache } from "./competitions";
import { prisma } from "./db";
import { AppError } from "./errors";
import { parseExamDate, parseJakartaDateTime } from "./exam-rules";
import { writeExamState } from "./exam-state";
import { applyPackageSnapshot, prefetchExamPackages } from "./packages";

const packageByJenjangSchema = z.record(z.string(), z.number().int().positive());

const createExamSchema = z.object({
  competitionId: z.number().int().positive(),
  attendanceOpensAt: z.string(),
  startsAt: z.string(),
  durationMinutes: z.number().int().positive().max(600),
  shuffleQuestions: z.boolean().default(true),
  shuffleOptions: z.boolean().default(true),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
  packages: packageByJenjangSchema,
});

const updateExamSchema = z.object({
  attendanceOpensAt: z.string().optional(),
  startsAt: z.string().optional(),
  durationMinutes: z.number().int().positive().max(600).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  packages: packageByJenjangSchema.optional(),
});

function parseSchedule(input: { attendanceOpensAt: string; startsAt: string }) {
  const attendanceOpensAt = parseJakartaDateTime(input.attendanceOpensAt);
  const startsAt = parseJakartaDateTime(input.startsAt);
  if (!(attendanceOpensAt < startsAt)) {
    throw new AppError("Waktu absensi harus sebelum jadwal mulai.", 400);
  }
  return { attendanceOpensAt, startsAt };
}

const GROUPS: JenjangGroup[] = ["SD", "SMP", "SMA", "SMK"];

function normalizePackages(
  packages: Record<string, number>,
  requiredGroups: JenjangGroup[],
): { jenjang: JenjangGroup; packageId: number }[] {
  const rows: { jenjang: JenjangGroup; packageId: number }[] = [];
  const seen = new Set<JenjangGroup>();
  for (const [raw, packageId] of Object.entries(packages)) {
    if (!GROUPS.includes(raw as JenjangGroup)) {
      throw new AppError(`Kelompok paket harus SD, SMP, SMA, atau SMK (diterima: "${raw}").`, 400);
    }
    const group = raw as JenjangGroup;
    if (seen.has(group)) throw new AppError(`Kelompok ${group} diduplikasi.`, 400);
    seen.add(group);
    rows.push({ jenjang: group, packageId });
  }
  for (const group of requiredGroups) {
    if (!seen.has(group)) {
      throw new AppError(`Paket soal untuk jenjang ${group} wajib diisi.`, 400);
    }
  }
  return rows;
}

async function assertPackagesExist(packageIds: number[]) {
  const unique = [...new Set(packageIds)];
  const found = await prisma.questionPackage.findMany({
    where: { id: { in: unique }, isActive: true },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new AppError("Ada paket soal yang tidak ditemukan atau tidak aktif.", 404);
  }
}

async function assertCanPublish(examId: number, requiredGroups: JenjangGroup[]) {
  const packs = await prisma.examPackage.findMany({ where: { examId }, select: { jenjang: true } });
  if (packs.length === 0) {
    throw new AppError("Tidak dapat menerbitkan: belum ada paket soal per jenjang.", 400);
  }
  try {
    assertJenjangPackagesComplete(
      requiredGroups,
      packs.map((p) => p.jenjang),
    );
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "Paket jenjang belum lengkap.", 400);
  }
}

export async function createExam(input: unknown, actorId: number, ipAddress?: string) {
  const parsed = createExamSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Ujian tidak valid.", 400);

  const competition = await getCompetitionById(parsed.data.competitionId);
  const schedule = parseSchedule(parsed.data);
  const requiredGroups =
    competition.jenjangGroups.length > 0
      ? competition.jenjangGroups
      : (Object.keys(parsed.data.packages) as JenjangGroup[]);
  const packageRows = normalizePackages(parsed.data.packages, requiredGroups);
  await assertPackagesExist(packageRows.map((row) => row.packageId));

  if (parsed.data.status === "PUBLISHED") {
    for (const group of requiredGroups.length ? requiredGroups : packageRows.map((r) => r.jenjang)) {
      if (!packageRows.some((row) => row.jenjang === group)) {
        throw new AppError(`Tidak dapat menerbitkan: paket jenjang ${group} belum diatur.`, 400);
      }
    }
  }

  try {
    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          name: competition.name,
          competitionId: competition.id,
          attendanceOpensAt: schedule.attendanceOpensAt,
          startsAt: schedule.startsAt,
          durationMinutes: parsed.data.durationMinutes,
          shuffleQuestions: parsed.data.shuffleQuestions,
          shuffleOptions: parsed.data.shuffleOptions,
          status: parsed.data.status,
          createdById: actorId,
        },
      });
      for (const row of packageRows) {
        const pack = await tx.examPackage.create({
          data: { examId: created.id, jenjang: row.jenjang, packageId: row.packageId },
        });
        await applyPackageSnapshot(tx, pack.id, row.packageId);
      }
      return created;
    });
    await invalidateCompetitionCache();
    await writeExamState(exam.id, {
      phase: exam.phase,
      startedAt: null,
    });
    await writeAudit({ userId: actorId, action: "CREATE_EXAM", entityType: "exam", entityId: exam.id, ipAddress });
    return exam;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error(error);
    throw new AppError("Gagal membuat ujian. Tidak ada data setengah jadi yang tersimpan.", 500);
  }
}

export async function updateExam(id: number, input: unknown, actorId: number, ipAddress?: string) {
  const parsed = updateExamSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Ujian tidak valid.", 400);
  const existing = await prisma.exam.findUnique({
    where: { id },
    include: { packages: true },
  });
  if (!existing) throw new AppError("Ujian tidak ditemukan.", 404);
  if (existing.phase === "RUNNING" || existing.phase === "ENDED") {
    throw new AppError("Ujian yang sedang/sudah berjalan tidak dapat diubah jadwalnya.", 409);
  }

  let schedule = {
    attendanceOpensAt: existing.attendanceOpensAt,
    startsAt: existing.startsAt,
  };
  if (parsed.data.attendanceOpensAt || parsed.data.startsAt) {
    schedule = parseSchedule({
      attendanceOpensAt: parsed.data.attendanceOpensAt ?? formatJakartaInput(existing.attendanceOpensAt),
      startsAt: parsed.data.startsAt ?? formatJakartaInput(existing.startsAt),
    });
  }

  let requiredGroups: JenjangGroup[] = existing.packages.map((p) => p.jenjang as JenjangGroup);
  try {
    const competition = await getCompetitionById(existing.competitionId);
    if (competition.jenjangGroups.length) requiredGroups = competition.jenjangGroups;
  } catch {
    // OMBN down: pakai kelompok yang sudah tersimpan
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.packages) {
      const packageRows = normalizePackages(parsed.data.packages, requiredGroups);
      await assertPackagesExist(packageRows.map((row) => row.packageId));
      await tx.examPackageQuestion.deleteMany({
        where: { examPackage: { examId: id } },
      });
      await tx.examPackage.deleteMany({ where: { examId: id } });
      for (const row of packageRows) {
        const pack = await tx.examPackage.create({
          data: { examId: id, jenjang: row.jenjang, packageId: row.packageId },
        });
        await applyPackageSnapshot(tx, pack.id, row.packageId);
      }
    }

    const nextStatus = parsed.data.status ?? existing.status;
    if (nextStatus === "PUBLISHED") {
      await assertCanPublish(id, requiredGroups);
    }

    await tx.exam.update({
      where: { id },
      data: {
        attendanceOpensAt: schedule.attendanceOpensAt,
        startsAt: schedule.startsAt,
        durationMinutes: parsed.data.durationMinutes ?? existing.durationMinutes,
        shuffleQuestions: parsed.data.shuffleQuestions ?? existing.shuffleQuestions,
        shuffleOptions: parsed.data.shuffleOptions ?? existing.shuffleOptions,
        status: nextStatus,
      },
    });
  });

  await writeExamState(id, {
    phase: existing.phase,
    startedAt: existing.startedAt?.toISOString() ?? null,
  });
  await writeAudit({ userId: actorId, action: "UPDATE_EXAM", entityType: "exam", entityId: id, ipAddress });
}

function formatJakartaInput(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export async function startExam(examId: number, actorId: number, ipAddress?: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { packages: true },
  });
  if (!exam) throw new AppError("Ujian tidak ditemukan.", 404);
  if (exam.status !== "PUBLISHED") throw new AppError("Hanya ujian terbit yang dapat dimulai.", 409);

  if (exam.phase === "RUNNING") {
    return exam; // idempotent
  }
  if (exam.phase !== "NOT_STARTED") {
    throw new AppError("Ujian tidak dalam kondisi siap mulai.", 409);
  }

  const now = new Date();
  const updated = await prisma.exam.update({
    where: { id: examId },
    data: { phase: "RUNNING", startedAt: now, startedById: actorId },
  });
  await writeExamState(examId, {
    phase: "RUNNING",
    startedAt: now.toISOString(),
  });
  await prefetchExamPackages(examId);
  await writeAudit({
    userId: actorId,
    action: "START_EXAM",
    entityType: "exam",
    entityId: examId,
    ipAddress,
  });
  return updated;
}

export async function endExam(examId: number, actorId: number, ipAddress?: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError("Ujian tidak ditemukan.", 404);
  if (exam.status !== "PUBLISHED") throw new AppError("Hanya ujian terbit yang dapat diakhiri.", 409);
  if (exam.phase !== "RUNNING") throw new AppError("Ujian tidak sedang berjalan.", 409);

  const now = new Date();
  const updated = await prisma.exam.update({
    where: { id: examId },
    data: { phase: "ENDED", endedAt: now, endedById: actorId },
  });
  await writeExamState(examId, {
    phase: "ENDED",
    startedAt: exam.startedAt?.toISOString() ?? null,
  });

  const { finalizeAttempt } = await import("./attempts");
  const openAttempts = await prisma.examAttempt.findMany({
    where: { examId, status: "IN_PROGRESS", submittedAt: null },
    select: { id: true },
  });
  for (const attempt of openAttempts) {
    await finalizeAttempt(attempt.id, "TIME_EXPIRED").catch((error) => {
      console.error("Gagal menutup attempt", attempt.id, error);
    });
  }

  await writeAudit({
    userId: actorId,
    action: "END_EXAM",
    entityType: "exam",
    entityId: examId,
    ipAddress,
  });
  return updated;
}

export async function getExamParticipantCounts(examId: number) {
  const attempts = await prisma.examAttempt.findMany({
    where: { examId },
    select: { attendedAt: true, startedAt: true, submittedAt: true, status: true },
  });
  let attended = 0;
  let waiting = 0;
  let working = 0;
  let finished = 0;
  for (const row of attempts) {
    if (row.attendedAt) attended += 1;
    if (row.attendedAt && !row.startedAt) waiting += 1;
    if (row.startedAt && row.status === "IN_PROGRESS" && !row.submittedAt) working += 1;
    if (row.status !== "IN_PROGRESS" || row.submittedAt) finished += 1;
  }
  return { attended, waiting, working, finished };
}

export { assertJenjangPackagesComplete as validatePublishPackages, parseCompetitionJenjang };
