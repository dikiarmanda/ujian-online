import type { ExamPhase } from "@/generated/prisma/client";
import { prisma } from "./db";
import { redis } from "./redis";

export type ExamStateCache = {
  phase: ExamPhase;
  startedAt: string | null;
  endsAt: string;
};

function stateKey(examId: number): string {
  return `exam:state:${examId}`;
}

export function attemptExpiresKey(examId: number, userId: number): string {
  return `attempt:${examId}:${userId}`;
}

export async function writeExamState(examId: number, state: ExamStateCache): Promise<void> {
  await redis.set(stateKey(examId), JSON.stringify(state), "EX", 60 * 60 * 24);
}

export async function readExamState(examId: number): Promise<ExamStateCache | null> {
  const cached = await redis.get(stateKey(examId));
  if (cached) return JSON.parse(cached) as ExamStateCache;
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { phase: true, startedAt: true, endsAt: true },
  });
  if (!exam) return null;
  const state: ExamStateCache = {
    phase: exam.phase,
    startedAt: exam.startedAt?.toISOString() ?? null,
    endsAt: exam.endsAt.toISOString(),
  };
  await writeExamState(examId, state);
  return state;
}

export async function writeAttemptExpires(examId: number, userId: number, expiresAt: Date): Promise<void> {
  const ttl = Math.max(60, Math.ceil((expiresAt.getTime() - Date.now()) / 1000) + 3600);
  await redis.set(attemptExpiresKey(examId, userId), expiresAt.toISOString(), "EX", ttl);
}

export async function readAttemptExpires(examId: number, userId: number): Promise<Date | null> {
  const raw = await redis.get(attemptExpiresKey(examId, userId));
  if (!raw) return null;
  return new Date(raw);
}
