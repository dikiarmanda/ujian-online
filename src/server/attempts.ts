import { Prisma } from "@/generated/prisma/client";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";
import { computeDeadline, type AnswerSnapshot } from "./exam-rules";
import { redis } from "./redis";
import { sanitizeRichText } from "./rich-text";

export type PublicOption = { id: number; label: string; body: string; imagePath: string | null };
export type PublicQuestion = {
  id: number;
  type: "MULTIPLE_CHOICE" | "ESSAY";
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
function packageKey(examId: number): string {
  return `exam:${examId}:questions`;
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

export async function flushAttempt(attemptId: number, force = false): Promise<void> {
  await withAttemptLock(attemptId, async () => {
    if (!force && (await redis.get(closedKey(attemptId)))) return;
    const attempt = await prisma.examAttempt.findUnique({
      where: { id: attemptId },
      include: { session: { include: { exam: { include: { questions: { include: { question: true } } } } } } },
    });
    if (!attempt) return;
    if (!force && attempt.status !== "IN_PROGRESS") return;
    const types = new Map(attempt.session.exam.questions.map((item) => [item.questionId, item.question.type]));
    for (let pass = 0; pass < 3; pass += 1) {
      const revision = await redis.get(revKey(attemptId));
      const stored = await readRedisAnswers(attemptId);
      const entries = Object.entries(stored);
      if (entries.length) {
        const rows = entries.map(([questionId, answer]) => {
          const id = Number(questionId);
          const type = types.get(id);
          const gradingState = type === "ESSAY" ? "PENDING" : "NOT_REQUIRED";
          return Prisma.sql`(${attemptId}, ${id}, ${answer.selectedOptionId}, ${answer.essayText}, ${answer.isDoubtful ? 1 : 0}, ${answer.answeredAt ? new Date(answer.answeredAt) : null}, UTC_TIMESTAMP(3), ${gradingState})`;
        });
        await prisma.$executeRaw`
          INSERT INTO attempt_answers
            (attemptId, questionId, selectedOptionId, essayText, isDoubtful, answeredAt, updatedAt, gradingState)
          VALUES ${Prisma.join(rows)}
          ON DUPLICATE KEY UPDATE
            selectedOptionId = VALUES(selectedOptionId),
            essayText = VALUES(essayText),
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

async function loadPackage(examId: number): Promise<PublicQuestion[]> {
  const cached = await redis.get(packageKey(examId));
  if (cached) return JSON.parse(cached) as PublicQuestion[];
  const rows = await prisma.examQuestion.findMany({
    where: { examId },
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
  await redis.set(packageKey(examId), JSON.stringify(pack), "EX", 60 * 60 * 6);
  return pack;
}

export async function attend(sessionId: number, userId: number, ipAddress: string, userAgent: string | null) {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: { participants: { where: { userId } } },
  });
  if (!session || session.participants.length === 0) throw new AppError("Anda tidak ditugaskan pada sesi ini.", 403);
  const now = new Date();
  if (now < session.attendanceOpensAt || now > session.endsAt) {
    throw new AppError("Absensi hanya dapat dilakukan pada rentang waktu sesi.", 409);
  }
  await prisma.attendance.upsert({
    where: { sessionId_userId: { sessionId, userId } },
    create: { sessionId, userId, ipAddress, userAgent },
    update: {},
  });
  await writeAudit({ userId, action: "ATTEND", entityType: "exam_session", entityId: sessionId, ipAddress });
}

export async function startAttempt(sessionId: number, userId: number, ipAddress?: string) {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: { include: { questions: { include: { question: { include: { options: true } } } } } },
      participants: { where: { userId } },
      attendances: { where: { userId } },
    },
  });
  if (!session || session.participants.length === 0) throw new AppError("Anda tidak ditugaskan pada sesi ini.", 403);
  if (session.exam.status !== "PUBLISHED") throw new AppError("Ujian ini belum dibuka.", 409);
  if (session.attendances.length === 0) throw new AppError("Absensi diperlukan sebelum mulai ujian.", 409);
  const now = new Date();
  if (now < session.startsAt) throw new AppError("Ujian belum dimulai.", 409);
  const existing = await prisma.examAttempt.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
  if (existing) {
    if (existing.status !== "IN_PROGRESS") throw new AppError("Ujian ini sudah dikirim.", 409);
    if (existing.deadlineAt <= now) {
      await finalizeAttempt(existing.id, "TIME_EXPIRED", userId, ipAddress);
      throw new AppError("Waktu ujian sudah habis. Jawaban tidak dapat diubah.", 409);
    }
    return existing.id;
  }
  if (now > session.endsAt) throw new AppError("Sesi ujian sudah selesai.", 409);
  if (session.exam.questions.length === 0) throw new AppError("Paket soal masih kosong.", 409);
  const questionOrder = session.exam.shuffleQuestions ? shuffle(session.exam.questions.map((item) => item.questionId)) : session.exam.questions.map((item) => item.questionId);
  const optionOrder: Record<string, number[]> = {};
  for (const item of session.exam.questions) {
    const ids = item.question.options.map((option) => option.id);
    optionOrder[String(item.questionId)] = session.exam.shuffleOptions ? shuffle(ids) : ids;
  }
  const deadlineAt = computeDeadline(now, session.exam.durationMinutes, session.endsAt, 0);
  const attempt = await prisma.examAttempt.create({
    data: {
      sessionId,
      userId,
      startedAt: now,
      deadlineAt,
      questionOrder,
      optionOrder,
      gradingStatus: "NOT_GRADED",
    },
  });
  await loadPackage(session.examId);
  await redis.hset(metaKey(attempt.id), "lastQuestionIndex", "0", "deadlineAt", deadlineAt.toISOString());
  await writeAudit({ userId, action: "START_ATTEMPT", entityType: "exam_attempt", entityId: attempt.id, ipAddress });
  return attempt.id;
}

export async function getAttemptState(attemptId: number, userId: number) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      session: { include: { exam: true } },
      answers: true,
    },
  });
  if (!attempt || attempt.userId !== userId) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (attempt.status === "IN_PROGRESS" && attempt.deadlineAt <= new Date()) {
    await finalizeAttempt(attemptId, "TIME_EXPIRED", userId);
    attempt.status = "TIME_EXPIRED";
  }
  const pack = await loadPackage(attempt.session.examId);
  const order = attempt.questionOrder as number[];
  const optionOrder = (attempt.optionOrder ?? {}) as Record<string, number[]>;
  const byId = new Map(pack.map((question) => [question.id, question]));
  const questions = order.map((id) => {
    const question = byId.get(id);
    if (!question) throw new AppError("Paket soal tidak lengkap.", 500);
    const optionIds = optionOrder[String(id)];
    const options = optionIds ? optionIds.map((optionId) => question.options.find((option) => option.id === optionId)).filter((option): option is PublicOption => Boolean(option)) : question.options;
    return { ...question, options };
  });
  const redisAnswers = await readRedisAnswers(attemptId);
  const answers: Record<number, StoredAnswer> = {};
  for (const row of attempt.answers) {
    answers[row.questionId] = {
      selectedOptionId: row.selectedOptionId,
      essayText: row.essayText,
      isDoubtful: row.isDoubtful,
      answeredAt: row.answeredAt?.toISOString() ?? null,
    };
  }
  Object.assign(answers, redisAnswers);
  const meta = await redis.hgetall(metaKey(attemptId));
  return {
    attemptId: attempt.id,
    examName: attempt.session.exam.name,
    sessionName: attempt.session.name,
    status: attempt.status,
    serverNow: new Date().toISOString(),
    deadlineAt: attempt.deadlineAt.toISOString(),
    lastQuestionIndex: Number(meta.lastQuestionIndex ?? attempt.lastQuestionIndex ?? 0),
    questions,
    answers,
  };
}

export async function saveAnswer(
  attemptId: number,
  userId: number,
  input: {
    questionId: number;
    selectedOptionId: number | null;
    essayText: string | null;
    isDoubtful: boolean;
    lastQuestionIndex: number;
  },
) {
  const attempt = await prisma.examAttempt.findFirst({
    where: { id: attemptId, userId },
    include: { session: { include: { exam: true } } },
  });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (attempt.status !== "IN_PROGRESS" || attempt.deadlineAt <= new Date() || (await redis.get(closedKey(attemptId)))) {
    if (attempt.status === "IN_PROGRESS") await finalizeAttempt(attemptId, "TIME_EXPIRED", userId);
    throw new AppError("Waktu ujian sudah habis. Jawaban tidak dapat diubah.", 409);
  }
  const order = attempt.questionOrder as number[];
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
  } else {
    input.selectedOptionId = null;
    input.essayText = (input.essayText ?? "").slice(0, 20000);
  }
  const payload: StoredAnswer = {
    selectedOptionId: input.selectedOptionId,
    essayText: input.essayText,
    isDoubtful: input.isDoubtful,
    answeredAt: new Date().toISOString(),
  };
  await redis.hset(answersKey(attemptId), String(input.questionId), JSON.stringify(payload));
  await redis.hset(metaKey(attemptId), "lastQuestionIndex", String(input.lastQuestionIndex));
  await redis.incr(revKey(attemptId));
  await enqueueFlush(attemptId);
}

export async function finalizeAttempt(attemptId: number, reason: "SUBMITTED" | "TIME_EXPIRED", userId?: number, ipAddress?: string) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: { session: { include: { exam: { include: { questions: true } } } } },
  });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (userId && attempt.userId !== userId) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  if (attempt.status !== "IN_PROGRESS") return;
  const actual = reason === "SUBMITTED" && attempt.deadlineAt <= new Date() ? "TIME_EXPIRED" : reason;
  await redis.set(closedKey(attemptId), "1", "EX", 60 * 60 * 24);
  await flushAttempt(attemptId, true);
  const order = attempt.questionOrder as number[];
  const essayQuestions = await prisma.question.findMany({
    where: { id: { in: order }, type: "ESSAY" },
  });
  for (const question of essayQuestions) {
    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: question.id } },
      create: { attemptId, questionId: question.id, essayText: "", gradingState: "PENDING" },
      update: {},
    });
  }
  const weights = new Map(
    attempt.session.exam.questions.map((item) => [
      item.questionId,
      { weight: Number(item.weight), wrongWeight: Number(item.wrongWeight) },
    ]),
  );
  const answers = await prisma.attemptAnswer.findMany({
    where: { attemptId },
    include: { selectedOption: true, question: true },
  });
  let mcScore = 0;
  let hasEssay = false;
  for (const answer of answers) {
    if (answer.question.type === "ESSAY") {
      hasEssay = true;
      continue;
    }
    const scoring = weights.get(answer.questionId) ?? { weight: 0, wrongWeight: 0 };
    const answered = answer.selectedOptionId != null;
    const correct = Boolean(answer.selectedOption?.isCorrect);
    const score = !answered ? 0 : correct ? scoring.weight : -scoring.wrongWeight;
    mcScore += score;
    await prisma.attemptAnswer.update({
      where: { id: answer.id },
      data: { isCorrect: answered ? correct : null, score: score.toFixed(2), gradingState: "NOT_REQUIRED" },
    });
  }
  if (essayQuestions.length) hasEssay = true;
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      status: actual,
      submittedAt: new Date(),
      mcScore: mcScore.toFixed(2),
      essayScore: hasEssay ? null : "0.00",
      totalScore: hasEssay ? null : mcScore.toFixed(2),
      gradingStatus: hasEssay ? "NOT_GRADED" : "COMPLETED",
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

export async function logViolation(attemptId: number, userId: number, input: { type: "FULLSCREEN_EXIT" | "TAB_SWITCH" | "WINDOW_BLUR" | "COPY_PASTE" | "RIGHT_CLICK"; questionNumber?: number }) {
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
    include: { session: { include: { exam: true } } },
  });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);
  const extraSeconds = attempt.extraSeconds + seconds;
  const deadlineAt = computeDeadline(attempt.startedAt, attempt.session.exam.durationMinutes, attempt.session.endsAt, extraSeconds);
  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      extraSeconds,
      deadlineAt,
      status: "IN_PROGRESS",
      submittedAt: null,
      mcScore: null,
      totalScore: null,
    },
  });
  await redis.del(closedKey(attemptId));
  await redis.hset(metaKey(attemptId), "deadlineAt", deadlineAt.toISOString());
  await writeAudit({
    userId: actorId,
    action: "ADD_TIME",
    entityType: "exam_attempt",
    entityId: attemptId,
    meta: { seconds },
    ipAddress,
  });
}
