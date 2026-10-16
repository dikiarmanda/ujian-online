import { z } from "zod";
import { writeAudit } from "./audit";
import { prisma } from "./db";
import { AppError } from "./errors";

const itemSchema = z.object({
  questionId: z.number().int().positive(),
  weight: z.number().positive(),
  wrongWeight: z.number().min(0).default(0),
});

const packageSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
  items: z.array(itemSchema).min(1, "Paket harus berisi minimal satu soal."),
});

async function assertActiveQuestions(ids: number[]) {
  if (new Set(ids).size !== ids.length) {
    throw new AppError("Soal tidak boleh kembar dalam satu paket.", 400);
  }
  const questions = await prisma.question.findMany({ where: { id: { in: ids }, isActive: true } });
  if (questions.length !== ids.length) {
    throw new AppError("Ada soal yang tidak aktif atau tidak ditemukan.", 400);
  }
  return questions;
}

export async function createQuestionPackage(input: unknown, actorId: number, ipAddress?: string) {
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Paket tidak valid.", 400);
  await assertActiveQuestions(parsed.data.items.map((item) => item.questionId));
  try {
    const pack = await prisma.questionPackage.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description?.trim() || null,
        isActive: parsed.data.isActive,
        createdById: actorId,
        items: {
          create: parsed.data.items.map((item, index) => ({
            questionId: item.questionId,
            sortOrder: index + 1,
            weight: item.weight.toFixed(2),
            wrongWeight: item.wrongWeight.toFixed(2),
          })),
        },
      },
    });
    await writeAudit({
      userId: actorId,
      action: "CREATE_PACKAGE",
      entityType: "question_package",
      entityId: pack.id,
      ipAddress,
    });
    return pack;
  } catch {
    throw new AppError("Nama paket sudah dipakai.", 409);
  }
}

export async function updateQuestionPackage(id: number, input: unknown, actorId: number, ipAddress?: string) {
  const existing = await prisma.questionPackage.findUnique({ where: { id } });
  if (!existing) throw new AppError("Paket tidak ditemukan.", 404);
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Paket tidak valid.", 400);
  await assertActiveQuestions(parsed.data.items.map((item) => item.questionId));
  try {
    await prisma.$transaction(async (tx) => {
      await tx.questionPackageItem.deleteMany({ where: { packageId: id } });
      await tx.questionPackage.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description?.trim() || null,
          isActive: parsed.data.isActive,
          items: {
            create: parsed.data.items.map((item, index) => ({
              questionId: item.questionId,
              sortOrder: index + 1,
              weight: item.weight.toFixed(2),
              wrongWeight: item.wrongWeight.toFixed(2),
            })),
          },
        },
      });
    });
  } catch {
    throw new AppError("Nama paket sudah dipakai.", 409);
  }
  await writeAudit({
    userId: actorId,
    action: "UPDATE_PACKAGE",
    entityType: "question_package",
    entityId: id,
    ipAddress,
  });
}

export async function deleteQuestionPackage(id: number, actorId: number, ipAddress?: string) {
  const used = await prisma.exam.count({ where: { packageId: id } });
  if (used) {
    throw new AppError("Paket sudah dipakai ujian. Nonaktifkan saja bila tidak ingin dipakai lagi.", 409);
  }
  await prisma.questionPackage.delete({ where: { id } });
  await writeAudit({
    userId: actorId,
    action: "DELETE_PACKAGE",
    entityType: "question_package",
    entityId: id,
    ipAddress,
  });
}

/** Salin isi template paket ke exam_questions (snapshot bobot saat itu). */
export async function applyPackageToExam(examId: number, packageId: number) {
  const pack = await prisma.questionPackage.findUnique({
    where: { id: packageId },
    include: {
      items: { orderBy: { sortOrder: "asc" }, include: { question: { select: { isActive: true } } } },
    },
  });
  if (!pack || !pack.isActive) throw new AppError("Paket soal tidak ditemukan atau tidak aktif.", 404);
  if (pack.items.length === 0) throw new AppError("Paket soal masih kosong.", 400);
  if (pack.items.some((item) => !item.question.isActive)) {
    throw new AppError("Paket berisi soal yang sudah nonaktif. Perbarui paket dulu.", 409);
  }
  await prisma.$transaction(async (tx) => {
    await tx.examQuestion.deleteMany({ where: { examId } });
    await tx.examQuestion.createMany({
      data: pack.items.map((item) => ({
        examId,
        questionId: item.questionId,
        sortOrder: item.sortOrder,
        weight: item.weight.toFixed(2),
        wrongWeight: item.wrongWeight.toFixed(2),
      })),
    });
    await tx.exam.update({ where: { id: examId }, data: { packageId } });
  });
}
