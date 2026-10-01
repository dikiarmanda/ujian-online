import { z } from "zod";
import { finalizeAttempt, getAttemptState, logViolation, saveAnswer } from "@/server/attempts";
import { hitRateLimit } from "@/server/rate-limit";
import { json, readBody, requestIp, requireApiUser, withErrors } from "@/server/http";

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
          isDoubtful: z.boolean(),
          lastQuestionIndex: z.number().int().min(0),
        }),
      );
      await saveAnswer(attemptId, user.userId, body);
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
    return json({ error: "Tindakan tidak dikenal." }, 404);
  });
}
