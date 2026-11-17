import { z } from "zod";
import { finalizeAttempt, getAttemptState, logViolation, saveAnswer } from "@/server/attempts";
import { writeAudit } from "@/server/audit";
import { logEvent, logWarn } from "@/server/logger";
import { hitRateLimit } from "@/server/rate-limit";
import { json, readBody, requestIp, requireApiUser, withErrors } from "@/server/http";
import { prisma } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; op: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["PARTICIPANT"]);
    const { id, op } = await ctx.params;
    const attemptId = Number(id);
    if (op === "state") return json(await getAttemptState(attemptId, user.userId));
    if (op === "waktu") {
      const state = await getAttemptState(attemptId, user.userId);
      return json({ serverNow: state.serverNow, deadlineAt: state.deadlineAt, status: state.status });
    }
    return json({ error: "Tindakan tidak dikenal." }, 404);
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["PARTICIPANT"]);
    const { id, op } = await ctx.params;
    const attemptId = Number(id);
    const ip = requestIp(req);
    if (op === "jawaban") {
      await hitRateLimit(`rl:save:${user.userId}`, 180, 60);
      await hitRateLimit(`rl:saveip:${ip}`, 240, 60);
      const body = await readBody(
        req,
        z.object({
          questionId: z.number().int().positive(),
          selectedOptionId: z.number().int().positive().nullable(),
          essayText: z.string().nullable(),
          shortAnswerText: z.string().max(500).nullable(),
          isDoubtful: z.boolean(),
          lastQuestionIndex: z.number().int().min(0),
        }),
      );
      try {
        await saveAnswer(attemptId, user.userId, body);
      } catch (error) {
        logWarn("jawaban_gagal_simpan", {
          userId: user.userId,
          role: "peserta",
          ip,
          sesiId: attemptId,
          msg: error instanceof Error ? error.message : "gagal menyimpan jawaban",
        });
        throw error;
      }
      return json({ ok: true, savedAt: new Date().toISOString() });
    }
    if (op === "selesai") {
      await finalizeAttempt(attemptId, "SUBMITTED", user.userId, ip);
      return json({ ok: true });
    }
    if (op === "pelanggaran") {
      const body = await readBody(
        req,
        z.object({
          type: z.enum(["FULLSCREEN_EXIT", "TAB_SWITCH", "WINDOW_BLUR", "COPY_PASTE", "RIGHT_CLICK"]),
          questionNumber: z.number().int().positive().optional(),
        }),
      );
      await logViolation(attemptId, user.userId, body);
      return json({ ok: true });
    }
    if (op === "kalkulator") {
      const attempt = await prisma.examAttempt.findUnique({
        where: { id: attemptId },
        include: { exam: true },
      });
      if (!attempt || attempt.userId !== user.userId) {
        return json({ error: "Pengerjaan tidak ditemukan." }, 404);
      }
      const body = await readBody(
        req,
        z.object({
          action: z.enum(["buka", "gunakan"]),
        }),
      );
      if (attempt.exam.calculatorMode === "TIDAK") {
        logWarn("kalkulator_ditolak", {
          userId: user.userId,
          ujianId: attempt.examId,
          sesiId: attemptId,
          ip,
          alasan: "mode kalkulator tidak diizinkan",
        });
        await writeAudit({
          userId: user.userId,
          action: "KALKULATOR_DITOLAK",
          entityType: "exam_attempt",
          entityId: String(attemptId),
          ipAddress: ip,
          meta: { examId: attempt.examId, mode: attempt.exam.calculatorMode },
        });
        return json({ error: "Kalkulator tidak diizinkan pada ujian ini." }, 403);
      }
      if (body.action === "buka") {
        logEvent("kalkulator_dibuka", {
          userId: user.userId,
          ujianId: attempt.examId,
          sesiId: attemptId,
          ip,
          mode: attempt.exam.calculatorMode,
        });
        await writeAudit({
          userId: user.userId,
          action: "KALKULATOR_DIBUKA",
          entityType: "exam_attempt",
          entityId: String(attemptId),
          ipAddress: ip,
          meta: { examId: attempt.examId, mode: attempt.exam.calculatorMode },
        });
      } else if (body.action === "gunakan") {
        logEvent("kalkulator_digunakan", {
          userId: user.userId,
          ujianId: attempt.examId,
          sesiId: attemptId,
          ip,
        });
        await writeAudit({
          userId: user.userId,
          action: "KALKULATOR_DIGUNAKAN",
          entityType: "exam_attempt",
          entityId: String(attemptId),
          ipAddress: ip,
          meta: { examId: attempt.examId },
        });
      }
      return json({ ok: true });
    }
    return json({ error: "Tindakan tidak dikenal." }, 404);
  });
}
