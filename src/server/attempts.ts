import { Prisma } from "@/generated/prisma/client";
import type { JenjangGroup } from "@/lib/jenjang";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";
import { computeDeadline, scoreObjectiveAnswer, type AnswerSnapshot } from "./exam-rules";
import { readAttemptExpires, readExamState, writeAttemptExpires } from "./exam-state";
import { packageCacheKey } from "./packages";
import { redis } from "./redis";
import { sanitizeRichText } from "./rich-text";

export type PublicOption = { id: number; label: string; body: string; imagePath: string | null };
export type PublicQuestion = {
  id: number;
  type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER";
  body: string;
  imagePath: string | null;
  weight: string;
  options: PublicOption[];
};

type StoredAnswer = AnswerSnapshot & { answeredAt: string | null };

function answersKey(attemptId: number): string {
  return `attempt:${attemptId}:answers`;
}
function metaKey(attemptId: number): string {
  return `attempt:${attemptId}:meta`;
}
function revKey(attemptId: number): string {
  return `attempt:${attemptId}:rev`;
}
function closedKey(attemptId: number): string {
  return `attempt:${attemptId}:closed`;
}
function lockKey(attemptId: number): string {
  return `attempt:${attemptId}:lock`;
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function withAttemptLock<T>(attemptId: number, fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 40; i += 1) {
    const locked = await redis.set(lockKey(attemptId), "1", "EX", 15, "NX");
    if (locked) {
      try {
        return await fn();
      } finally {
        await redis.del(lockKey(attemptId));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new AppError("Penyimpanan jawaban sedang sibuk. Coba lagi.", 503);
}

export async function readRedisAnswers(attemptId: number): Promise<Record<number, StoredAnswer>> {
  const raw = await redis.hgetall(answersKey(attemptId));
  const result: Record<number, StoredAnswer> = {};
  for (const [field, value] of Object.entries(raw)) {
    result[Number(field)] = JSON.parse(value) as StoredAnswer;
  }
  return result;
}

async function loadPackageQuestions(examPackageId: number): Promise<PublicQuestion[]> {
  const cached = await redis.get(packageCacheKey(examPackageId));
  if (cached) return JSON.parse(cached) as PublicQuestion[];
  const rows = await prisma.examPackageQuestion.findMany({
    where: { examPackageId },
    include: { question: { include: { options: { orderBy: { sortOrder: "asc" } } } } },
    orderBy: { sortOrder: "asc" },
  });
  const pack: PublicQuestion[] = rows.map((row) => ({
    id: row.questionId,
    type: row.question.type,
    body: sanitizeRichText(row.question.body),
    imagePath: row.question.imagePath,
    weight: row.weight.toString(),
    options: row.question.options.map((option) => ({
      id: option.id,
      label: option.label,
      body: sanitizeRichText(option.body),
      imagePath: option.imagePath,
    })),
  }));
  await redis.set(packageCacheKey(examPackageId), JSON.stringify(pack), "EX", 60 * 60 * 6);
  return pack;
}

async function resolveExamPackage(examId: number, jenjangGroup: JenjangGroup) {
  const pack = await prisma.examPackage.findUnique({
    where: { examId_jenjang: { examId, jenjang: jenjangGroup } },
    include: { questions: { include: { question: { include: { options: true } } }, orderBy: { sortOrder: "asc" } } },
  });
  if (!pack) {
    console.error(`ExamPackage tidak ditemukan examId=${examId} jenjang=${jenjangGroup}`);
    throw new AppError(`Paket soal untuk jenjang ${jenjangGroup} belum diatur pada ujian ini.`, 404);
  }
  if (pack.questions.length === 0) throw new AppError("Paket soal masih kosong.", 409);
  return pack;
}

export async function attend(
  examId: number,
  userId: number,
  jenjangGroup: JenjangGroup,
  ipAddress: string,
  userAgent: string | null,
) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.status !== "PUBLISHED") throw new AppError("Ujian tidak ditemukan.", 404);
  if (exam.phase === "ENDED") throw new AppError("Ujian sudah ditutup.", 409);
  const now = new Date();
  if (now < exam.attendanceOpensAt) throw new AppError("Absensi belum dibuka.", 409);

  const examPack = await resolveExamPackage(examId, jenjangGroup);
  await prisma.examAttempt.upsert({
    where: { examId_userId: { examId, userId } },
    create: {
      examId,
      userId,
      jenjang: jenjangGroup,
      packageId: examPack.packageId,
      attendedAt: now,
      status: "IN_PROGRESS",
      gradingStatus: "NOT_GRADED",
    },
    update: {
      attendedAt: now,
      jenjang: jenjangGroup,
      packageId: examPack.packageId,
    },
  });
  await writeAudit({ userId, action: "ATTEND", entityType: "exam", entityId: examId, ipAddress, meta: { userAgent } });
}

/** Peserta pertama kali mengambil soal: set startedAt/expiresAt atomik & idempoten. */
export async function startAttempt(examId: number, userId: number, jenjangGroup: JenjangGroup, ipAddress?: string) {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.status !== "PUBLISHED") throw new AppError("Ujian tidak ditemukan.", 404);

  const state = await readExamState(examId);
  if (!state || state.phase !== "RUNNING") {
    throw new AppError("Ujian belum dibuka oleh juri.", 403);
  }
  const now = new Date();

  const existing = await prisma.examAttempt.findUnique({ where: { examId_userId: { examId, userId } } });
  if (!existing?.attendedAt) throw new AppError("Absensi diperlukan sebelum mulai ujian.", 409);

  if (existing.startedAt && existing.expiresAt) {
    if (existing.status !== "IN_PROGRESS") throw new AppError("Ujian ini sudah dikirim.", 409);
    if (existing.expiresAt <= now) {
      await finalizeAttempt(existing.id, "TIME_EXPIRED", userId, ipAddress);
      throw new AppError("Waktu ujian sudah habis. Jawaban tidak dapat diubah.", 409);
    }
    await writeAttemptExpires(examId, userId, existing.expiresAt);
    return existing.id;
  }

  const examPack = await resolveExamPackage(examId, jenjangGroup);
  const questionIds = examPack.questions.map((item) => item.questionId);
  const questionOrder = exam.shuffleQuestions ? shuffle(questionIds) : questionIds;
  const optionOrder: Record<string, number[]> = {};
  for (const item of examPack.questions) {
    const ids = item.question.options.map((option) => option.id);
    optionOrder[String(item.questionId)] = exam.shuffleOptions ? shuffle(ids) : ids;
  }
  const expiresAt = computeDeadline(now, exam.durationMinutes, null, existing.extraSeconds);

  // Idempotent: only set startedAt if still null
  const updated = await prisma.examAttempt.updateMany({
    where: { id: existing.id, startedAt: null },
    data: {
      startedAt: now,
      expiresAt,
      jenjang: jenjangGroup,
      packageId: examPack.packageId,
      questionOrder,
      optionOrder,
    },
  });

  if (updated.count === 0) {
    const again = await prisma.examAttempt.findUnique({ where: { id: existing.id } });
    if (!again?.startedAt) throw new AppError("Gagal memulai pengerjaan.", 500);
    if (again.expiresAt) await writeAttemptExpires(examId, userId, again.expiresAt);
    return again.id;
  }

  await loadPackageQuestions(examPack.id);
  await writeAttemptExpires(examId, userId, expiresAt);
  await redis.hset(metaKey(existing.id), "lastQuestionIndex", "0", "expiresAt", expiresAt.toISOString());
  await writeAudit({ userId, action: "START_ATTEMPT", entityType: "exam_attempt", entityId: existing.id, ipAddress });
  return existing.id;
}

export async function getAttemptState(attemptId: number, userId: number) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: true,
      answers: true,
    },
  });
  if (!attempt || attempt.userId !== userId) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (!attempt.startedAt || !attempt.expiresAt) throw new AppError("Pengerjaan belum dimulai.", 409);

  const state = await readExamState(attempt.examId);
  if (state?.phase !== "RUNNING" && attempt.status === "IN_PROGRESS") {
    // Soft check: if ended, force finalize
    if (state?.phase === "ENDED") {
      await finalizeAttempt(attemptId, "TIME_EXPIRED", userId);
      attempt.status = "TIME_EXPIRED";
    }
  }
  if (attempt.status === "IN_PROGRESS" && attempt.expiresAt <= new Date()) {
    await finalizeAttempt(attemptId, "TIME_EXPIRED", userId);
    attempt.status = "TIME_EXPIRED";
  }

  const examPack = await prisma.examPackage.findUnique({
    where: { examId_jenjang: { examId: attempt.examId, jenjang: attempt.jenjang } },
  });
  if (!examPack) throw new AppError("Paket soal tidak ditemukan.", 404);

  const pack = await loadPackageQuestions(examPack.id);
  const order = (attempt.questionOrder as number[]) ?? [];
  const optionOrder = (attempt.optionOrder ?? {}) as Record<string, number[]>;
  const byId = new Map(pack.map((question) => [question.id, question]));
  const questions = order.map((id) => {
    const question = byId.get(id);
    if (!question) throw new AppError("Paket soal tidak lengkap.", 500);
    const optionIds = optionOrder[String(id)];
    const options = optionIds
      ? optionIds.map((optionId) => question.options.find((option) => option.id === optionId)).filter((option): option is PublicOption => Boolean(option))
      : question.options;
    return { ...question, options };
  });
  const redisAnswers = await readRedisAnswers(attemptId);
  const answers: Record<number, StoredAnswer> = {};
  for (const row of attempt.answers) {
    answers[row.questionId] = {
      selectedOptionId: row.selectedOptionId,
      essayText: row.essayText,
      shortAnswerText: row.shortAnswerText,
      isDoubtful: row.isDoubtful,
      answeredAt: row.answeredAt?.toISOString() ?? null,
    };
  }
  Object.assign(answers, redisAnswers);
  const meta = await redis.hgetall(metaKey(attemptId));
  return {
    attemptId: attempt.id,
    examName: attempt.exam.name,
    status: attempt.status,
    serverNow: new Date().toISOString(),
    serverTime: new Date().toISOString(),
    expiresAt: attempt.expiresAt.toISOString(),
    deadlineAt: attempt.expiresAt.toISOString(),
    lastQuestionIndex: Number(meta.lastQuestionIndex ?? attempt.lastQuestionIndex ?? 0),
    questions,
    answers,
  };
}

export async function flushAttempt(attemptId: number, force = false): Promise<void> {
  await withAttemptLock(attemptId, async () => {
    if (!force && (await redis.get(closedKey(attemptId)))) return;
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            packages: { include: { questions: { include: { question: true } } } },
          },
        },
      },
    });
    if (!attempt) return;
    if (!force && attempt.status !== "IN_PROGRESS") return;
    const pack = attempt.exam.packages.find((p) => p.jenjang === attempt.jenjang);
    const types = new Map((pack?.questions ?? []).map((item) => [item.questionId, item.question.type]));
    for (let pass = 0; pass < 3; pass += 1) {
      const revision = await redis.get(revKey(attemptId));
      const stored = await readRedisAnswers(attemptId);
      const entries = Object.entries(stored);
      if (entries.length) {
        const rows = entries.map(([questionId, answer]) => {
          const id = Number(questionId);
          const type = types.get(id);
          const gradingState = type === "ESSAY" ? "PENDING" : "NOT_REQUIRED";
          return Prisma.sql`(${attemptId}, ${id}, ${answer.selectedOptionId}, ${answer.essayText}, ${answer.shortAnswerText ?? null}, ${answer.isDoubtful ? 1 : 0}, ${answer.answeredAt ? new Date(answer.answeredAt) : null}, UTC_TIMESTAMP(3), ${gradingState})`;
        });
        await prisma.$executeRaw`
          INSERT INTO attempt_answers
            (attemptId, questionId, selectedOptionId, essayText, shortAnswerText, isDoubtful, answeredAt, updatedAt, gradingState)
          VALUES ${Prisma.join(rows)}
          ON DUPLICATE KEY UPDATE
            selectedOptionId = VALUES(selectedOptionId),
            essayText = VALUES(essayText),
            shortAnswerText = VALUES(shortAnswerText),
            isDoubtful = VALUES(isDoubtful),
            answeredAt = VALUES(answeredAt),
            updatedAt = UTC_TIMESTAMP(3)
        `;
      }
      const after = await redis.get(revKey(attemptId));
      if (revision === after) break;
    }
  });
}

export async function enqueueFlush(attemptId: number): Promise<void> {
  const { answerQueue } = await import("./queue");
  try {
    await answerQueue.add("flush", { attemptId }, { jobId: `flush-${attemptId}`, delay: 250, removeOnComplete: true, removeOnFail: 50 });
  } catch {
    // Job yang masih menunggu akan membaca revisi terbaru.
  }
}

async function assertCanAnswer(examId: number, userId: number, expiresAt: Date | null) {
  const state = await readExamState(examId);
  if (!state || state.phase !== "RUNNING") {
    throw new AppError("Ujian tidak sedang berjalan.", 403);
  }
  const now = new Date();
  const cachedExpires = (await readAttemptExpires(examId, userId)) ?? expiresAt;
  if (!cachedExpires || now > cachedExpires) {
    throw new AppError("Waktu ujian sudah habis. Jawaban tidak dapat diubah.", 403);
  }
}

export async function saveAnswer(
  attemptId: number,
  userId: number,
  input: {
    questionId: number;
    selectedOptionId: number | null;
    essayText: string | null;
    shortAnswerText: string | null;
    isDoubtful: boolean;
    lastQuestionIndex: number;
  },
) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { exam: true },
  });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (attempt.status !== "IN_PROGRESS" || (await redis.get(closedKey(attemptId)))) {
    throw new AppError("Waktu ujian sudah habis. Jawaban tidak dapat diubah.", 409);
  }
  try {
    await assertCanAnswer(attempt.examId, userId, attempt.expiresAt);
  } catch (error) {
    if (attempt.status === "IN_PROGRESS") await finalizeAttempt(attemptId, "TIME_EXPIRED", userId);
    throw error;
  }
  const order = (attempt.questionOrder as number[]) ?? [];
  if (!order.includes(input.questionId)) throw new AppError("Soal tidak termasuk paket ujian ini.", 400);
  const optionOrder = (attempt.optionOrder ?? {}) as Record<string, number[]>;
  const allowed = optionOrder[String(input.questionId)] ?? [];
  const question = await prisma.question.findUnique({ where: { id: input.questionId } });
  if (!question) throw new AppError("Soal tidak ditemukan.", 404);
  if (question.type === "MULTIPLE_CHOICE") {
    if (input.selectedOptionId != null && !allowed.includes(input.selectedOptionId)) {
      throw new AppError("Opsi jawaban tidak valid.", 400);
    }
    input.essayText = null;
    input.shortAnswerText = null;
  } else if (question.type === "SHORT_ANSWER") {
    input.selectedOptionId = null;
    input.essayText = null;
    input.shortAnswerText = (input.shortAnswerText ?? "").slice(0, 500);
  } else {
    input.selectedOptionId = null;
    input.essayText = (input.essayText ?? "").slice(0, 20000);
    input.shortAnswerText = null;
  }
  const payload: StoredAnswer = {
    selectedOptionId: input.selectedOptionId,
    essayText: input.essayText,
    shortAnswerText: input.shortAnswerText,
    isDoubtful: input.isDoubtful,
    answeredAt: new Date().toISOString(),
  };
  await redis.hset(answersKey(attemptId), String(input.questionId), JSON.stringify(payload));
  await redis.hset(metaKey(attemptId), "lastQuestionIndex", String(input.lastQuestionIndex));
  await redis.incr(revKey(attemptId));
  await enqueueFlush(attemptId);
}

export async function finalizeAttempt(
  attemptId: number,
  reason: "SUBMITTED" | "TIME_EXPIRED",
  userId?: number,
  ipAddress?: string,
) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      exam: {
        include: {
          packages: { include: { questions: true } },
        },
      },
    },
  });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (userId && attempt.userId !== userId) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (attempt.status !== "IN_PROGRESS") return;
  const expiresAt = attempt.expiresAt ?? new Date(0);
  const actual = reason === "SUBMITTED" && expiresAt <= new Date() ? "TIME_EXPIRED" : reason;
  await redis.set(closedKey(attemptId), "1", "EX", 60 * 60 * 24);
  await flushAttempt(attemptId, true);
  const order = (attempt.questionOrder as number[]) ?? [];
  const pack = attempt.exam.packages.find((p) => p.jenjang === attempt.jenjang);
  const weights = new Map(
    (pack?.questions ?? []).map((item) => [
      item.questionId,
      { weight: Number(item.weight), wrongWeight: Number(item.wrongWeight) },
    ]),
  );
  const questionIds = order.length ? order : [...weights.keys()];
  const questions = questionIds.length
    ? await prisma.question.findMany({
        where: { id: { in: questionIds } },
        include: { shortAnswerKey: true },
      })
    : [];
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    include: { selectedOption: true },
  });
  const answerByQuestion = new Map(answers.map((answer) => [answer.questionId, answer]));
  let mcScore = 0;
  let blankEssays = 0;
  let pendingEssays = 0;
  for (const questionId of questionIds) {
    const question = questionById.get(questionId);
    if (!question) continue;
    const answer = answerByQuestion.get(questionId);
    const scoring = weights.get(questionId) ?? {
      weight: Number(question.defaultWeight),
      wrongWeight: Number(question.defaultWrongWeight),
    };
    if (question.type === "ESSAY") {
      const text = (answer?.essayText ?? "").trim();
      if (text) {
        pendingEssays += 1;
        continue;
      }
      blankEssays += 1;
      await prisma.attemptAnswer.upsert({
        where: { attemptId_questionId: { attemptId, questionId } },
        create: {
          attemptId,
          questionId,
          essayText: "",
          score: "0.00",
          gradingState: "GRADED",
          gradedAt: new Date(),
        },
        update: {
          score: "0.00",
          gradingState: "GRADED",
          gradedAt: new Date(),
          lockedById: null,
          lockedAt: null,
        },
      });
      continue;
    }
    if (question.type !== "MULTIPLE_CHOICE" && question.type !== "SHORT_ANSWER") continue;
    const result = scoreObjectiveAnswer({
      type: question.type,
      selectedOptionId: answer?.selectedOptionId ?? null,
      optionIsCorrect: answer?.selectedOption?.isCorrect ?? null,
      shortAnswerText: answer?.shortAnswerText ?? null,
      answerKey: question.shortAnswerKey?.answerKey ?? null,
      weight: scoring.weight,
      wrongWeight: scoring.wrongWeight,
    });
    mcScore += result.score;
    const data = {
      isCorrect: result.isCorrect,
      score: result.score.toFixed(2),
      gradingState: "NOT_REQUIRED" as const,
    };
    if (answer) {
      await prisma.attemptAnswer.update({ where: { id: answer.id }, data });
    } else {
      await prisma.attemptAnswer.create({ data: { attemptId, questionId, ...data } });
    }
  }
  const essayCount = blankEssays + pendingEssays;
  const gradingStatus = essayCount === 0 || pendingEssays === 0 ? "COMPLETED" : blankEssays > 0 ? "PARTIAL" : "NOT_GRADED";
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: actual,
      submittedAt: new Date(),
      mcScore: mcScore.toFixed(2),
      essayScore: pendingEssays > 0 && blankEssays === 0 ? null : "0.00",
      totalScore: pendingEssays === 0 ? mcScore.toFixed(2) : null,
      gradingStatus,
      lastQuestionIndex: Number((await redis.hget(metaKey(attemptId), "lastQuestionIndex")) ?? 0),
    },
  });
  await writeAudit({
    userId: attempt.userId,
    action: actual === "TIME_EXPIRED" ? "TIME_EXPIRED" : "SUBMIT",
    entityType: "exam_attempt",
    entityId: attemptId,
    ipAddress,
  });
}

export async function logViolation(
  attemptId: number,
  userId: number,
  input: {
    type: "FULLSCREEN_EXIT" | "TAB_SWITCH" | "WINDOW_BLUR" | "COPY_PASTE" | "RIGHT_CLICK";
    questionNumber?: number;
  },
) {
  const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId, userId, status: "IN_PROGRESS" } });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  await prisma.violationLog.create({
    data: { attemptId, type: input.type, questionNumber: input.questionNumber ?? null },
  });
}

export async function addExtraTime(attemptId: number, seconds: number, actorId: number, ipAddress?: string) {
  if (seconds < 60 || seconds > 60 * 180) throw new AppError("Tambahan waktu di luar batas yang diizinkan.", 400);
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { exam: true },
  });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (!attempt.startedAt) throw new AppError("Peserta belum memulai ujian.", 409);
  const extraSeconds = attempt.extraSeconds + seconds;
  const expiresAt = computeDeadline(attempt.startedAt, attempt.exam.durationMinutes, null, extraSeconds);
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      extraSeconds,
      expiresAt,
      status: "IN_PROGRESS",
      submittedAt: null,
      mcScore: null,
      totalScore: null,
    },
  });
  await redis.del(closedKey(attemptId));
  await writeAttemptExpires(attempt.examId, attempt.userId, expiresAt);
  await redis.hset(metaKey(attemptId), "expiresAt", expiresAt.toISOString());
  await writeAudit({
    userId: actorId,
    action: "ADD_TIME",
    entityType: "exam_attempt",
    entityId: attemptId,
    meta: { seconds },
    ipAddress,
  });
}

export async function getExamStateForParticipant(examId: number, userId: number) {
  const state = await readExamState(examId);
  if (!state) throw new AppError("Ujian tidak ditemukan.", 404);
  const attempt = await prisma.examAttempt.findUnique({
    where: { examId_userId: { examId, userId } },
    select: { expiresAt: true, startedAt: true, attendedAt: true, status: true },
  });
  return {
    phase: state.phase,
    serverTime: new Date().toISOString(),
    expiresAt: attempt?.expiresAt?.toISOString() ?? null,
    attended: Boolean(attempt?.attendedAt),
    started: Boolean(attempt?.startedAt),
    status: attempt?.status ?? null,
  };
}
