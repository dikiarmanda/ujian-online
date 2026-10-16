import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { resetParticipantSession } from "@/server/auth/service";
import { assignExamPackage, assignParticipant, createExam, createSession, removeParticipant, updateExam } from "@/server/exams";
import { releaseLock } from "@/server/grading";
import { json, readBody, requestIp, requireApiUser, withErrors } from "@/server/http";
import {
  createQuestionPackage,
  deleteQuestionPackage,
  updateQuestionPackage,
} from "@/server/packages";
import { createCategory, createQuestion, deleteQuestion, importQuestions, updateQuestion } from "@/server/questions";
import { syncParticipants } from "@/server/sync";
import { addExtraTime } from "@/server/attempts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ action: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["ADMIN"]);
    const { action } = await ctx.params;
    const ip = requestIp(req);
    if (action === "sinkron") {
      const log = await syncParticipants(user.userId, ip);
      return json({ id: log.id, successCount: log.successCount, failedCount: log.failedCount });
    }
    if (action === "sesi-login") {
      const body = await readBody(req, z.object({ userId: z.number().int().positive() }));
      await resetParticipantSession(user.userId, body.userId, ip);
      return json({ ok: true });
    }
    if (action === "kategori") {
      const category = await createCategory(await req.json(), user.userId);
      return json({ id: category.id });
    }
    if (action === "soal") {
      const body: { id?: number } = await req.json();
      if (body.id) {
        await updateQuestion(body.id, body, user.userId, ip);
        return json({ id: body.id });
      }
      const question = await createQuestion(body, user.userId, ip);
      return json({ id: question.id });
    }
    if (action === "hapus-soal") {
      const body = await readBody(req, z.object({ id: z.number().int().positive() }));
      await deleteQuestion(body.id, user.userId, ip);
      return json({ ok: true });
    }
    if (action === "impor") {
      const body = await readBody(req, z.object({ csv: z.string().min(1) }));
      return json(await importQuestions(body.csv, user.userId, ip));
    }
    if (action === "unggah") {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new Error("Berkas tidak ada.");
      if (!file.type.startsWith("image/") || file.size > 2_000_000) {
        return json({ error: "Unggah gambar maksimal 2 MB." }, 400);
      }
      const ext = path.extname(file.name).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) {
        return json({ error: "Jenis gambar tidak didukung." }, 400);
      }
      const name = `${randomBytes(16).toString("hex")}${ext}`;
      const dir = path.join(process.cwd(), "public", "uploads");
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
      return json({ path: `/uploads/${name}` });
    }
    if (action === "ujian") {
      const body: { id?: number } = await req.json();
      if (body.id) {
        await updateExam(body.id, body, user.userId, ip);
        return json({ id: body.id });
      }
      const exam = await createExam(body, user.userId, ip);
      return json({ id: exam.id });
    }
    if (action === "paket-soal") {
      const body: { id?: number } = await req.json();
      if (body.id) {
        await updateQuestionPackage(body.id, body, user.userId, ip);
        return json({ id: body.id });
      }
      const pack = await createQuestionPackage(body, user.userId, ip);
      return json({ id: pack.id });
    }
    if (action === "hapus-paket-soal") {
      const body = await readBody(req, z.object({ id: z.number().int().positive() }));
      await deleteQuestionPackage(body.id, user.userId, ip);
      return json({ ok: true });
    }
    if (action === "paket") {
      const body = await readBody(
        req,
        z.object({
          examId: z.number().int().positive(),
          packageId: z.number().int().positive(),
        }),
      );
      await assignExamPackage(body.examId, body.packageId, user.userId, ip);
      return json({ ok: true });
    }
    if (action === "sesi") {
      const session = await createSession(await req.json(), user.userId, ip);
      return json({ id: session.id });
    }
    if (action === "peserta") {
      const body = await readBody(
        req,
        z.object({
          sessionId: z.number().int().positive(),
          userId: z.number().int().positive(),
          remove: z.boolean().optional(),
        }),
      );
      if (body.remove) await removeParticipant(body.sessionId, body.userId, user.userId, ip);
      else await assignParticipant(body.sessionId, body.userId, user.userId, ip);
      return json({ ok: true });
    }
    if (action === "waktu") {
      const body = await readBody(
        req,
        z.object({ attemptId: z.number().int().positive(), minutes: z.number().int().positive().max(180) }),
      );
      await addExtraTime(body.attemptId, body.minutes * 60, user.userId, ip);
      return json({ ok: true });
    }
    if (action === "kunci") {
      const body = await readBody(
        req,
        z.object({ answerId: z.number().int().positive(), graderId: z.number().int().positive().optional() }),
      );
      await releaseLock(body.answerId, user.userId, body.graderId, ip);
      return json({ ok: true });
    }
    return json({ error: "Tindakan tidak dikenal." }, 404);
  });
}
