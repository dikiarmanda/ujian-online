import { z } from "zod";
import { attend, startAttempt } from "@/server/attempts";
import { json, readBody, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["PARTICIPANT"]);
    const { action } = await ctx.params;
    const ip = requestIp(req);
    if (action === "absen") {
      const body = await readBody(req, z.object({ sessionId: z.number().int().positive() }));
      await attend(body.sessionId, user.userId, ip, req.headers.get("user-agent"));
      return json({ ok: true });
    }
    if (action === "mulai") {
      const body = await readBody(req, z.object({ sessionId: z.number().int().positive() }));
      const attemptId = await startAttempt(body.sessionId, user.userId, ip);
      return json({ attemptId });
    }
    return json({ error: "Tindakan tidak dikenal." }, 404);
  });
}

export async function GET(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["PARTICIPANT"]);
    const { action } = await ctx.params;
    if (action !== "waktu") return json({ error: "Tindakan tidak dikenal." }, 404);
    const sessionId = Number(new URL(req.url).searchParams.get("attemptId"));
    const { prisma } = await import("@/server/db");
    const attempt = await prisma.examAttempt.findFirst({ where: { id: sessionId, userId: user.userId } });
    if (!attempt) return json({ error: "Pengerjaan tidak ditemukan." }, 404);
    return json({ serverNow: new Date().toISOString(), deadlineAt: attempt.deadlineAt.toISOString(), status: attempt.status });
  });
}
