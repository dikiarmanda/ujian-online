import { z } from "zod";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { env } from "./env";
import { AppError } from "./errors";

async function refreshAttemptScore(attemptId: number) {
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    include: { question: true },
  });
  const essays = answers.filter((answer) => answer.question.type === "ESSAY");
  const graded = essays.filter((answer) => answer.gradingState === "GRADED");
  const essayScore = graded.reduce((sum, answer) => sum + Number(answer.score ?? 0), 0);
  const attempt = await prisma.examAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) return;
  const allGraded = essays.length > 0 && graded.length === essays.length;
  const gradingStatus = essays.length === 0 || allGraded ? "COMPLETED" : graded.length ? "PARTIAL" : "NOT_GRADED";
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      essayScore: essayScore.toFixed(2),
      gradingStatus,
      totalScore: allGraded || essays.length === 0 ? (Number(attempt.mcScore ?? 0) + essayScore).toFixed(2) : null,
    },
  });
}

export async function claimAnswer(answerId: number, graderId: number) {
  const lockSeconds = env().gradingLockSeconds;
  const changed = await prisma.$executeRaw`
    UPDATE attempt_answers
       SET gradingState = 'LOCKED', lockedById = ${graderId}, lockedAt = UTC_TIMESTAMP(3)
     WHERE id = ${answerId}
       AND (
         gradingState = 'PENDING'
         OR (gradingState = 'LOCKED' AND lockedById = ${graderId})
         OR (gradingState = 'LOCKED' AND lockedAt < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ${lockSeconds} SECOND))
       )
  `;
  if (Number(changed) === 0) {
    const existing = await prisma.attemptAnswer.findUnique({ where: { id: answerId } });
    if (existing?.gradingState === "GRADED") throw new AppError("Jawaban ini sudah dinilai.", 409);
    throw new AppError("Jawaban ini sedang dinilai petugas lain.", 409);
  }
  return graderView(answerId, graderId);
}

export async function graderView(answerId: number, graderId: number) {
  const answer = await prisma.attemptAnswer.findUnique({
    where: { id: answerId },
    include: {
      question: { include: { essayKey: true } },
      attempt: { include: { user: true, session: { include: { exam: { include: { questions: true } } } } } },
    },
  });
  if (!answer || answer.question.type !== "ESSAY") throw new AppError("Jawaban uraian tidak ditemukan.", 404);
  if (answer.lockedById !== graderId || answer.gradingState === "GRADED") {
    if (answer.gradingState !== "GRADED") throw new AppError("Jawaban ini sedang dinilai petugas lain.", 409);
  }
  if (answer.gradingState === "GRADED" && answer.gradedById !== graderId) {
    throw new AppError("Jawaban ini sudah dinilai.", 409);
  }
  const weight = answer.attempt.session.exam.questions.find((item) => item.questionId === answer.questionId);
  const lockedAt = answer.lockedAt ?? new Date();
  return {
    id: answer.id,
    participantName: answer.attempt.user.name,
    questionBody: answer.question.body,
    essayText: answer.essayText ?? "",
    answerKey: answer.question.essayKey?.answerKey ?? "",
    rubric: answer.question.essayKey?.rubric ?? "",
    weight: weight ? Number(weight.weight) : Number(answer.question.defaultWeight),
    score: answer.score == null ? null : Number(answer.score),
    gradingState: answer.gradingState,
    lockExpiresAt: new Date(lockedAt.getTime() + env().gradingLockSeconds * 1000).toISOString(),
  };
}

const gradeSchema = z.object({
  score: z.number().min(0),
  note: z.string().max(2000).optional(),
});

export async function gradeAnswer(answerId: number, graderId: number, input: unknown, ipAddress?: string) {
  const parsed = gradeSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Nilai tidak valid.", 400);
  const view = await graderView(answerId, graderId);
  if (parsed.data.score > view.weight) {
    throw new AppError("Nilai tidak boleh melebihi bobot soal.", 400);
  }
  const updated = await prisma.attemptAnswer.updateMany({
    where: { id: answerId, lockedById: graderId, gradingState: "LOCKED" },
    data: {
      score: parsed.data.score.toFixed(2),
      gradingNote: parsed.data.note?.trim() || null,
      gradingState: "GRADED",
      gradedById: graderId,
      gradedAt: new Date(),
      lockedById: null,
      lockedAt: null,
    },
  });
  if (updated.count === 0) throw new AppError("Kunci penilaian sudah berpindah. Buka jawaban lagi.", 409);
  const answer = await prisma.attemptAnswer.findUnique({ where: { id: answerId } });
  if (answer) await refreshAttemptScore(answer.attemptId);
  await writeAudit({
    userId: graderId,
    action: "GRADE",
    entityType: "attempt_answer",
    entityId: answerId,
    meta: { score: parsed.data.score },
    ipAddress,
  });
}

export async function releaseLock(answerId: number, actorId: number, graderId?: number, ipAddress?: string) {
  const answer = await prisma.attemptAnswer.findUnique({ where: { id: answerId } });
  if (!answer) throw new AppError("Jawaban tidak ditemukan.", 404);
  if (answer.gradingState === "GRADED") throw new AppError("Nilai sudah final dan tidak dapat dipindahkan.", 409);
  if (graderId) {
    const grader = await prisma.user.findFirst({ where: { id: graderId, role: "GRADER", isActive: true } });
    if (!grader) throw new AppError("Petugas penilai tidak ditemukan.", 404);
    await prisma.attemptAnswer.update({
      where: { id: answerId },
      data: { gradingState: "LOCKED", lockedById: graderId, lockedAt: new Date() },
    });
  } else {
    await prisma.attemptAnswer.update({
      where: { id: answerId },
      data: { gradingState: "PENDING", lockedById: null, lockedAt: null },
    });
  }
  await writeAudit({
    userId: actorId,
    action: graderId ? "REASSIGN_GRADE" : "RELEASE_LOCK",
    entityType: "attempt_answer",
    entityId: answerId,
    meta: { graderId: graderId ?? null },
    ipAddress,
  });
}

export async function listGradingQueue(graderId: number) {
  const lockSeconds = env().gradingLockSeconds;
  const cutoff = new Date(Date.now() - lockSeconds * 1000);
  return prisma.attemptAnswer.findMany({
    where: {
      question: { type: "ESSAY" },
      attempt: { status: { in: ["SUBMITTED", "TIME_EXPIRED"] } },
      OR: [{ gradingState: "PENDING" }, { gradingState: "LOCKED", lockedById: graderId }, { gradingState: "LOCKED", lockedAt: { lt: cutoff } }],
    },
    include: {
      question: { select: { code: true, body: true } },
      attempt: { include: { user: { select: { name: true } }, session: { include: { exam: { select: { name: true } } } } } },
    },
    orderBy: { id: "asc" },
    take: 100,
  });
}
