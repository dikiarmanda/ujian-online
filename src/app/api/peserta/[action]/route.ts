import { z } from "zod";
import { attend, getExamStateForParticipant, startAttempt } from "@/server/attempts";
import { AppError } from "@/server/errors";
import { json, readBody, requestIp, requireApiUser, withErrors } from "@/server/http";

function getWIBDate(): Date {
  // Server sudah set TZ=Asia/Jakarta, jadi Date.now() sudah WIB
  return new Date();
}

function toWIBString(date: Date): string {
  // Simpan sebagai timestamp Unix untuk menghindari masalah timezone (untuk Redis)
  return String(date.getTime());
}

function toIsoString(date: Date): string {
  // Untuk response ke frontend, gunakan ISO string
  return date.toISOString();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string }> };

function requireJenjang(user: { jenjangGroup?: string | null }) {
  if (!user.jenjangGroup || !["SD", "SMP", "SMA", "SMK"].includes(user.jenjangGroup)) {
    throw new AppError("Jenjang peserta tidak tersedia pada sesi login. Masuk ulang.", 403);
  }
  return user.jenjangGroup as "SD" | "SMP" | "SMA" | "SMK";
}

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["PARTICIPANT"]);
    const { action } = await ctx.params;
    const ip = requestIp(req);
    const jenjang = requireJenjang(user);
    if (action === "absen") {
      const body = await readBody(req, z.object({ examId: z.number().int().positive() }));
      await attend(body.examId, user.userId, jenjang, ip, req.headers.get("user-agent"));
      return json({ ok: true });
    }
    if (action === "mulai") {
      const body = await readBody(req, z.object({ examId: z.number().int().positive() }));
      const attemptId = await startAttempt(body.examId, user.userId, jenjang, ip);
      return json({ attemptId });
    }
    return json({ error: "Tindakan tidak dikenal." }, 404);
  });
}

export async function GET(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["PARTICIPANT"]);
    const { action } = await ctx.params;
    if (action === "state") {
      const examId = Number(new URL(req.url).searchParams.get("examId"));
      if (!Number.isFinite(examId) || examId < 1) return json({ error: "examId wajib." }, 400);
      return json(await getExamStateForParticipant(examId, user.userId));
    }
    if (action !== "waktu") return json({ error: "Tindakan tidak dikenal." }, 404);
    const attemptId = Number(new URL(req.url).searchParams.get("attemptId"));
    const { prisma } = await import("@/server/db");
    const attempt = await prisma.examAttempt.findFirst({ where: { id: attemptId, userId: user.userId } });
    if (!attempt) return json({ error: "Pengerjaan tidak ditemukan." }, 404);
    return json({
      serverNow: toIsoString(getWIBDate()),
      serverTime: toIsoString(getWIBDate()),
      deadlineAt: attempt.expiresAt ? toIsoString(attempt.expiresAt) : null,
      expiresAt: attempt.expiresAt ? toIsoString(attempt.expiresAt) : null,
      status: attempt.status,
    });
  });
}
