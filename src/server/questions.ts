import { z } from "zod";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";
import { assertSingleCorrectOption } from "./exam-rules";
import { assertUploadPath, sanitizeRichText } from "./rich-text";

const optionSchema = z.object({
  label: z.string().trim().min(1).max(5),
  body: z.string().trim().min(1),
  imagePath: z.string().nullable().optional(),
  isCorrect: z.boolean(),
});

const questionSchema = z.object({
  categoryId: z.number().int().positive(),
  type: z.enum(["MULTIPLE_CHOICE", "ESSAY"]),
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
});

function questionCodeFor(type: "MULTIPLE_CHOICE" | "ESSAY", id: number): string {
  const prefix = type === "ESSAY" ? "UR" : "PG";
  return `${prefix}-${String(id).padStart(4, "0")}`;
}

function validateQuestion(input: z.infer<typeof questionSchema>) {
  if (input.type === "MULTIPLE_CHOICE") {
    assertSingleCorrectOption(input.options.filter((option) => option.isCorrect).length, input.options.length);
    const labels = new Set(input.options.map((option) => option.label.toUpperCase()));
    if (labels.size !== input.options.length) throw new AppError("Label opsi tidak boleh kembar.", 400);
  } else if (!input.answerKey?.trim()) {
    throw new AppError("Uraian membutuhkan pedoman jawaban.", 400);
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
      },
    });
  });
  await writeAudit({ userId: actorId, action: "UPDATE_QUESTION", entityType: "question", entityId: id, ipAddress });
}

export async function deleteQuestion(id: number, actorId: number, ipAddress?: string) {
  const used = await prisma.examQuestion.count({ where: { questionId: id } });
  if (used) throw new AppError("Soal sudah dipakai ujian. Nonaktifkan soal ini.", 409);
  await prisma.question.delete({ where: { id } });
  await writeAudit({ userId: actorId, action: "DELETE_QUESTION", entityType: "question", entityId: id, ipAddress });
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

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export async function importQuestions(csv: string, actorId: number, ipAddress?: string) {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new AppError("Berkas tidak berisi data soal.", 400);
  const header = splitCsv(lines[0]).map((cell) => cell.toLowerCase());
  const index = (name: string) => header.indexOf(name);
  const required = ["kategori", "jenis", "teks", "bobot"];
  for (const name of required) {
    if (index(name) < 0) throw new AppError(`Kolom ${name} wajib ada.`, 400);
  }
  const packageCache = new Map<string, { id: number; nextOrder: number }>();
  let success = 0;
  const errors: string[] = [];
  for (let row = 1; row < lines.length; row += 1) {
    const cells = splitCsv(lines[row]);
    const read = (name: string) => (index(name) < 0 ? "" : (cells[index(name)] ?? ""));
    try {
      const categoryName = read("kategori");
      const category = await prisma.questionCategory.upsert({
        where: { name: categoryName },
        create: { name: categoryName },
        update: {},
      });
      const type = read("jenis").toLowerCase() === "uraian" ? "ESSAY" : "MULTIPLE_CHOICE";
      const labels = ["a", "b", "c", "d", "e"];
      const options = labels
        .map((label) => ({ label: label.toUpperCase(), body: read(`opsi_${label}`), isCorrect: read("kunci").toUpperCase() === label.toUpperCase() }))
        .filter((option) => option.body);
      const weight = Number(read("bobot") || 1);
      const wrongWeight = Math.abs(read("bobot_salah") === "" ? 1 : Number(read("bobot_salah")));
      const question = await createQuestion(
        {
          categoryId: category.id,
          type,
          body: read("teks"),
          defaultWeight: weight,
          defaultWrongWeight: wrongWeight,
          isActive: true,
          options,
          answerKey: read("pedoman"),
          rubric: read("rubrik"),
        },
        actorId,
        ipAddress,
      );
      const packageName = read("paket").trim();
      if (packageName) {
        let pack = packageCache.get(packageName);
        if (!pack) {
          const existing = await prisma.questionPackage.upsert({
            where: { name: packageName },
            create: { name: packageName, createdById: actorId, isActive: true },
            update: {},
            include: { _count: { select: { items: true } } },
          });
          pack = { id: existing.id, nextOrder: existing._count.items + 1 };
          packageCache.set(packageName, pack);
        }
        await prisma.questionPackageItem.create({
          data: {
            packageId: pack.id,
            questionId: question.id,
            sortOrder: pack.nextOrder,
            weight: weight.toFixed(2),
            wrongWeight: wrongWeight.toFixed(2),
          },
        });
        pack.nextOrder += 1;
      }
      success += 1;
    } catch (error) {
      errors.push(`Baris ${row + 1}: ${error instanceof Error ? error.message : "gagal"}`);
    }
  }
  return { success, errors };
}
