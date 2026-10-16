import { z } from "zod";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";
import { formatExamDate, parseExamDate, parseJakartaDateTime } from "./exam-rules";
import { applyPackageToExam } from "./packages";
import { isUniqueConflict } from "./sync";

const examBaseSchema = z.object({
  name: z.string().trim().min(1).max(200),
  examDate: z.string(),
  durationMinutes: z.number().int().positive().max(600),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("DRAFT"),
});

const createExamSchema = examBaseSchema.extend({
  packageId: z.number().int().positive(),
});

export async function createExam(input: unknown, actorId: number, ipAddress?: string) {
  const parsed = createExamSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Ujian tidak valid.", 400);
  let examDate: Date;
  try {
    examDate = parseExamDate(parsed.data.examDate);
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : "Tanggal tidak valid.", 400);
  }
  const { packageId, ...examFields } = parsed.data;
  const exam = await prisma.exam.create({
    data: { ...examFields, examDate, createdById: actorId },
  });
  try {
    await applyPackageToExam(exam.id, packageId);
  } catch (error) {
    await prisma.exam.delete({ where: { id: exam.id } }).catch(() => undefined);
    throw error;
  }
  await writeAudit({ userId: actorId, action: "CREATE_EXAM", entityType: "exam", entityId: exam.id, ipAddress });
  return exam;
}

export async function assignExamPackage(examId: number, packageId: number, actorId: number, ipAddress?: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError("Ujian tidak ditemukan.", 404);
  await applyPackageToExam(examId, packageId);
  await writeAudit({
    userId: actorId,
    action: "SET_PACKAGE",
    entityType: "exam",
    entityId: examId,
    meta: { packageId },
    ipAddress,
  });
}

export async function updateExam(id: number, input: unknown, actorId: number, ipAddress?: string) {
  const parsed = examBaseSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Ujian tidak valid.", 400);
  const examDate = parseExamDate(parsed.data.examDate);
  const existing = await prisma.exam.findUnique({ where: { id } });
  if (!existing) throw new AppError("Ujian tidak ditemukan.", 404);
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({ where: { id }, data: { ...parsed.data, examDate } });
    if (formatExamDate(existing.examDate) !== formatExamDate(examDate)) {
      const participants = await tx.sessionParticipant.findMany({
        where: { session: { examId: id } },
        select: { id: true },
      });
      for (const participant of participants) {
        await tx.sessionParticipant.update({ where: { id: participant.id }, data: { examDate } });
      }
    }
  });
  await writeAudit({ userId: actorId, action: "UPDATE_EXAM", entityType: "exam", entityId: id, ipAddress });
}

const sessionSchema = z.object({
  examId: z.number().int().positive(),
  name: z.string().trim().min(1).max(100),
  startsAt: z.string(),
  endsAt: z.string(),
  attendanceOpensAt: z.string(),
  capacity: z.number().int().positive().nullable().optional(),
});

export async function createSession(input: unknown, actorId: number, ipAddress?: string) {
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Sesi tidak valid.", 400);
  const startsAt = parseJakartaDateTime(parsed.data.startsAt);
  const endsAt = parseJakartaDateTime(parsed.data.endsAt);
  const attendanceOpensAt = parseJakartaDateTime(parsed.data.attendanceOpensAt);
  if (!(attendanceOpensAt < startsAt && startsAt < endsAt)) {
    throw new AppError("Urutan waktu harus absensi, lalu mulai, lalu selesai.", 400);
  }
  const session = await prisma.examSession.create({
    data: {
      examId: parsed.data.examId,
      name: parsed.data.name,
      startsAt,
      endsAt,
      attendanceOpensAt,
      capacity: parsed.data.capacity ?? null,
    },
  });
  await writeAudit({ userId: actorId, action: "CREATE_SESSION", entityType: "exam_session", entityId: session.id, ipAddress });
  return session;
}

export async function assignParticipant(sessionId: number, userId: number, actorId: number, ipAddress?: string) {
  const session = await prisma.examSession.findUnique({ where: { id: sessionId }, include: { exam: true } });
  if (!session) throw new AppError("Sesi tidak ditemukan.", 404);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "PARTICIPANT" || !user.isActive) {
    throw new AppError("Peserta tidak ditemukan.", 404);
  }
  if (session.capacity) {
    const count = await prisma.sessionParticipant.count({ where: { sessionId } });
    if (count >= session.capacity) throw new AppError("Kuota sesi sudah penuh.", 409);
  }
  try {
    await prisma.sessionParticipant.create({
      data: { sessionId, userId, examDate: session.exam.examDate },
    });
  } catch (error) {
    if (isUniqueConflict(error)) {
      throw new AppError("Peserta ini sudah memiliki ujian pada tanggal yang sama.", 409);
    }
    throw error;
  }
  await writeAudit({
    userId: actorId,
    action: "ASSIGN_PARTICIPANT",
    entityType: "exam_session",
    entityId: sessionId,
    meta: { userId },
    ipAddress,
  });
}

export async function removeParticipant(sessionId: number, userId: number, actorId: number, ipAddress?: string) {
  const attempt = await prisma.examAttempt.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
  if (attempt) throw new AppError("Peserta sudah memulai ujian, penugasan tidak dapat dihapus.", 409);
  await prisma.sessionParticipant.delete({ where: { sessionId_userId: { sessionId, userId } } });
  await prisma.attendance.deleteMany({ where: { sessionId, userId } });
  await writeAudit({
    userId: actorId,
    action: "REMOVE_PARTICIPANT",
    entityType: "exam_session",
    entityId: sessionId,
    meta: { userId },
    ipAddress,
  });
}
