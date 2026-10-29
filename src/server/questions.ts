import { randomBytes } from "node:crypto";
import { z } from "zod";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";
import { assertSingleCorrectOption } from "./exam-rules";
import { inspectImportTable, parseImportSource, type ImportPreviewRow, type StoredImportItem } from "./import-rows";
import { redis } from "./redis";
import { assertUploadPath, sanitizeRichText } from "./rich-text";

const optionSchema = z.object({
  label: z.string().trim().min(1).max(5),
  body: z.string().trim().min(1),
  imagePath: z.string().nullable().optional(),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  categoryId: z.number().int().positive(),
  type: z.enum(["MULTIPLE_CHOICE", "ESSAY", "SHORT_ANSWER"]),
  body: z.string().trim().min(1),
  imagePath: z.string().nullable().optional(),
  defaultWeight: z.number().positive().max(1000),
  defaultWrongWeight: z.preprocess(
    (value) => Math.abs(Number(value ?? 1)),
    z.number().min(0).max(1000),
  ),
  isActive: z.boolean().default(true),
  options: z.array(optionSchema).default([]),
  answerKey: z.string().optional(),
  rubric: z.string().optional(),
  shortAnswerKey: z.string().max(500).optional(),
});

function questionCodeFor(type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER", id: number): string {
  const prefix = type === "ESSAY" ? "UR" : type === "SHORT_ANSWER" ? "JS" : "PG";
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

function validateQuestion(input: z.infer<typeof questionSchema>) {
  if (input.type === "MULTIPLE_CHOICE") {
    assertSingleCorrectOption(input.options.filter((option) => option.isCorrect).length, input.options.length);
    const labels = new Set(input.options.map((option) => option.label.toUpperCase()));
    if (labels.size !== input.options.length) throw new AppError("Label opsi tidak boleh kembar.", 400);
  } else if (input.type === "ESSAY") {
    if (!input.answerKey?.trim()) {
      throw new AppError("Uraian membutuhkan pedoman jawaban.", 400);
    }
  } else if (input.type === "SHORT_ANSWER") {
    const key = input.shortAnswerKey?.trim() ?? "";
    if (!key) {
      throw new AppError("Jawaban singkat membutuhkan satu kunci jawaban.", 400);
    }
    if (key.length > 500) {
      throw new AppError("Kunci jawaban singkat maksimal 500 karakter.", 400);
    }
  }
}

export async function createQuestion(input: unknown, actorId: number, ipAddress?: string) {
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Soal tidak valid.", 400);
  try {
    validateQuestion(parsed.data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error instanceof Error ? error.message : "Soal tidak valid.", 400);
  }
  const data = parsed.data;
  try {
    const question = await prisma.$transaction(async (tx) => {
      const created = await tx.question.create({
        data: {
          code: `TMP-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`,
          categoryId: data.categoryId,
          type: data.type,
          body: sanitizeRichText(data.body),
          imagePath: assertUploadPath(data.imagePath),
          defaultWeight: data.defaultWeight.toFixed(2),
          defaultWrongWeight: data.defaultWrongWeight.toFixed(2),
          isActive: data.isActive,
          createdById: actorId,
          options:
            data.type === "MULTIPLE_CHOICE"
              ? {
                  create: data.options.map((option, index) => ({
                    label: option.label.toUpperCase(),
                    body: sanitizeRichText(option.body),
                    imagePath: assertUploadPath(option.imagePath),
                    isCorrect: option.isCorrect,
                    sortOrder: index,
                  })),
                }
              : undefined,
          essayKey:
            data.type === "ESSAY"
              ? {
                  create: {
                    answerKey: sanitizeRichText(data.answerKey!.trim()),
                    rubric: data.rubric?.trim() ? sanitizeRichText(data.rubric.trim()) : null,
                  },
                }
              : undefined,
          shortAnswerKey:
            data.type === "SHORT_ANSWER"
              ? {
                  create: {
                    answerKey: data.shortAnswerKey!.trim().toLowerCase(),
                  },
                }
              : undefined,
        },
      });
      return tx.question.update({
        where: { id: created.id },
        data: { code: questionCodeFor(data.type, created.id) },
      });
    });
    await writeAudit({
      userId: actorId,
      action: "CREATE_QUESTION",
      entityType: "question",
      entityId: question.id,
      ipAddress,
    });
    return question;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Berkas")) throw new AppError(error.message, 400);
    throw new AppError("Kategori tidak ditemukan atau soal gagal disimpan.", 409);
  }
}

export async function updateQuestion(id: number, input: unknown, actorId: number, ipAddress?: string) {
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) throw new AppError("Soal tidak ditemukan.", 404);
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Soal tidak valid.", 400);
  try {
    validateQuestion(parsed.data);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(error instanceof Error ? error.message : "Soal tidak valid.", 400);
  }
  const data = parsed.data;
  await prisma.$transaction(async (tx) => {
    await tx.answerOption.deleteMany({ where: { questionId: id } });
    await tx.essayKey.deleteMany({ where: { questionId: id } });
    await tx.shortAnswerKey.deleteMany({ where: { questionId: id } });
    await tx.question.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        type: data.type,
        body: sanitizeRichText(data.body),
        imagePath: assertUploadPath(data.imagePath),
        defaultWeight: data.defaultWeight.toFixed(2),
        defaultWrongWeight: data.defaultWrongWeight.toFixed(2),
        isActive: data.isActive,
        options:
          data.type === "MULTIPLE_CHOICE"
            ? {
                create: data.options.map((option, index) => ({
                  label: option.label.toUpperCase(),
                  body: sanitizeRichText(option.body),
                  imagePath: assertUploadPath(option.imagePath),
                  isCorrect: option.isCorrect,
                  sortOrder: index,
                })),
              }
            : undefined,
        essayKey:
          data.type === "ESSAY"
            ? {
                create: {
                  answerKey: sanitizeRichText(data.answerKey!.trim()),
                  rubric: data.rubric?.trim() ? sanitizeRichText(data.rubric.trim()) : null,
                },
              }
            : undefined,
        shortAnswerKey:
          data.type === "SHORT_ANSWER"
            ? {
                create: {
                  answerKey: data.shortAnswerKey!.trim().toLowerCase(),
                },
              }
            : undefined,
      },
    });
  });
  await writeAudit({ userId: actorId, action: "UPDATE_QUESTION", entityType: "question", entityId: id, ipAddress });
}

export async function deleteQuestion(id: number, actorId: number, ipAddress?: string) {
  const used = await prisma.examPackageQuestion.count({ where: { questionId: id } });
  if (used) throw new AppError("Soal sudah dipakai ujian. Nonaktifkan soal ini.", 409);
  await prisma.question.update({ where: { id }, data: { deletedAt: new Date() } });
  await writeAudit({ userId: actorId, action: "DELETE_QUESTION", entityType: "question", entityId: id, ipAddress });
}

export async function toggleQuestionStatus(id: number, actorId: number, ipAddress?: string) {
  const question = await prisma.question.findUnique({ where: { id }, select: { isActive: true } });
  if (!question) throw new AppError("Soal tidak ditemukan.", 404);
  const newStatus = !question.isActive;
  await prisma.question.update({ where: { id }, data: { isActive: newStatus } });
  await writeAudit({
    userId: actorId,
    action: newStatus ? "ACTIVATE_QUESTION" : "DEACTIVATE_QUESTION",
    entityType: "question",
    entityId: id,
    ipAddress,
  });
  return newStatus;
}

const categorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional(),
});

export async function createCategory(input: unknown, actorId: number) {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Kategori tidak valid.", 400);
  try {
    const category = await prisma.questionCategory.create({
      data: { name: parsed.data.name, description: parsed.data.description || null },
    });
    await writeAudit({
      userId: actorId,
      action: "CREATE_CATEGORY",
      entityType: "question_category",
      entityId: category.id,
    });
    return category;
  } catch {
    throw new AppError("Nama kategori sudah dipakai.", 409);
  }
}

const IMPORT_TTL_SECONDS = 60 * 30;

function importKey(userId: number, token: string): string {
  return `import:soal:${userId}:${token}`;
}

export type { ImportPreviewRow } from "./import-rows";

function publicImportRow(item: StoredImportItem): ImportPreviewRow {
  const { payload: _payload, ...row } = item;
  return row;
}

export async function stageQuestionImport(data: string, userId: number): Promise<{ token: string; valid: number; invalid: number }> {
  const items = inspectImportTable(parseImportSource(data));
  const token = randomBytes(16).toString("hex");
  await redis.set(importKey(userId, token), JSON.stringify(items), "EX", IMPORT_TTL_SECONDS);
  return {
    token,
    valid: items.filter((item) => item.valid).length,
    invalid: items.filter((item) => !item.valid).length,
  };
}

export async function readQuestionImport(token: string, userId: number): Promise<ImportPreviewRow[] | null> {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;
  const raw = await redis.get(importKey(userId, token));
  if (!raw) return null;
  const items = JSON.parse(raw) as StoredImportItem[];
  return items.map(publicImportRow);
}

export async function commitQuestionImport(
  token: string,
  selectedRows: number[],
  actorId: number,
  ipAddress?: string,
): Promise<{ success: number; errors: string[] }> {
  if (!/^[a-f0-9]{32}$/.test(token)) throw new AppError("Pratinjau impor tidak ditemukan.", 404);
  const key = importKey(actorId, token);
  const raw = await redis.get(key);
  if (!raw) throw new AppError("Pratinjau impor sudah tidak berlaku. Unggah berkas lagi.", 404);
  const items = JSON.parse(raw) as StoredImportItem[];
  const picked = new Set(selectedRows);
  const chosen = items.filter((item) => item.valid && item.payload && picked.has(item.row));
  if (chosen.length === 0) throw new AppError("Pilih minimal satu soal yang valid.", 400);
  await redis.del(key);

  const packageCache = new Map<string, { id: number; nextOrder: number }>();
  let success = 0;
  const errors: string[] = [];
  for (const item of chosen) {
    const payload = item.payload;
    if (!payload) continue;
    try {
      const category = await prisma.questionCategory.upsert({
        where: { name: payload.categoryName },
        create: { name: payload.categoryName },
        update: {},
      });
      const question = await createQuestion(
        {
          categoryId: category.id,
          type: payload.type,
          body: payload.body,
          imagePath: payload.imagePath,
          defaultWeight: payload.defaultWeight,
          defaultWrongWeight: payload.defaultWrongWeight,
          isActive: true,
          options: payload.options,
          answerKey: payload.answerKey,
          rubric: payload.rubric,
          shortAnswerKey: payload.shortAnswerKey,
        },
        actorId,
        ipAddress,
      );
      if (payload.packageName) {
        let pack = packageCache.get(payload.packageName);
        if (!pack) {
          const existing = await prisma.questionPackage.upsert({
            where: { name: payload.packageName },
            create: { name: payload.packageName, createdById: actorId, isActive: true },
            update: {},
            include: { _count: { select: { items: true } } },
          });
          pack = { id: existing.id, nextOrder: existing._count.items + 1 };
          packageCache.set(payload.packageName, pack);
        }
        await prisma.questionPackageItem.create({
          data: {
            packageId: pack.id,
            questionId: question.id,
            sortOrder: pack.nextOrder,
            weight: payload.defaultWeight.toFixed(2),
            wrongWeight: payload.defaultWrongWeight.toFixed(2),
          },
        });
        pack.nextOrder += 1;
      }
      success += 1;
    } catch (error) {
      errors.push(`Baris ${item.row}: ${error instanceof Error ? error.message : "gagal disimpan"}`);
    }
  }
  return { success, errors };
}

