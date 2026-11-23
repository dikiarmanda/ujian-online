import { prisma } from "@/server/db";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const attemptId = Number(id);

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      examId: true,
      userId: true,
      status: true,
      startedAt: true,
      expiresAt: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      extraSeconds: true,
    },
  });

  if (!attempt) {
    return json({ attempt: null, auditLogs: [] });
  }

  const exam = await prisma.exam.findUnique({
    where: { id: attempt.examId },
    select: {
      id: true,
      name: true,
      durationMinutes: true,
      phase: true,
      startedAt: true,
    },
  });

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "exam_attempt",
      entityId: String(attemptId),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      userId: true,
      action: true,
      entityType: true,
      entityId: true,
      ipAddress: true,
      createdAt: true,
      meta: true,
    },
  });

  return json({
    attempt,
    exam,
    auditLogs,
  });
}
