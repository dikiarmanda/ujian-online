import "dotenv/config";
import { prisma } from "../src/server/db";
import { applyPackageSnapshot } from "../src/server/packages";
import { writeExamState } from "../src/server/exam-state";

async function main() {
  const admin = await prisma.user.upsert({
    where: { externalId: "mock:admin" },
    create: { externalId: "mock:admin", identity: "admin", name: "Admin Contoh", role: "ADMIN" },
    update: { role: "ADMIN", name: "Admin Contoh", identity: "admin" },
  });
  await prisma.user.upsert({
    where: { externalId: "mock:petugas" },
    create: { externalId: "mock:petugas", identity: "petugas", name: "Petugas Contoh", role: "GRADER" },
    update: { role: "GRADER", name: "Petugas Contoh", identity: "petugas" },
  });
  await prisma.user.upsert({
    where: { externalId: "mock:peserta" },
    create: {
      externalId: "mock:peserta",
      identity: "peserta",
      name: "Peserta Contoh",
      role: "PARTICIPANT",
      groupName: "Kelas 9A",
    },
    update: { name: "Peserta Contoh", identity: "peserta", groupName: "Kelas 9A" },
  });
  await prisma.user.upsert({
    where: { externalId: "mock:beban" },
    create: { externalId: "mock:beban", identity: "beban", name: "Peserta Beban", role: "PARTICIPANT" },
    update: { identity: "beban", name: "Peserta Beban" },
  });

  const category = await prisma.questionCategory.upsert({
    where: { name: "Umum" },
    create: { name: "Umum", description: "Soal contoh" },
    update: {},
  });
  const pg = await prisma.question.upsert({
    where: { code: "PG-01" },
    create: {
      code: "PG-01",
      categoryId: category.id,
      type: "MULTIPLE_CHOICE",
      body: "Ibu kota Indonesia adalah...",
      defaultWeight: "2.00",
      createdById: admin.id,
      options: {
        create: [
          { label: "A", body: "Bandung", isCorrect: false, sortOrder: 0 },
          { label: "B", body: "Jakarta", isCorrect: true, sortOrder: 1 },
          { label: "C", body: "Surabaya", isCorrect: false, sortOrder: 2 },
          { label: "D", body: "Medan", isCorrect: false, sortOrder: 3 },
        ],
      },
    },
    update: {},
  });
  const essay = await prisma.question.upsert({
    where: { code: "UR-01" },
    create: {
      code: "UR-01",
      categoryId: category.id,
      type: "ESSAY",
      body: "Jelaskan mengapa membaca soal sampai selesai itu penting.",
      defaultWeight: "5.00",
      createdById: admin.id,
      essayKey: {
        create: {
          answerKey: "Jawaban menyebut pemahaman perintah soal sebelum menulis.",
          rubric: "0 belum menjawab, 3 sebagian, 5 lengkap.",
        },
      },
    },
    update: {},
  });

  let pack = await prisma.questionPackage.findFirst({ where: { name: "Paket Contoh" } });
  if (!pack) {
    pack = await prisma.questionPackage.create({
      data: {
        name: "Paket Contoh",
        description: "Paket seed",
        createdById: admin.id,
        items: {
          create: [
            { questionId: pg.id, sortOrder: 1, weight: "2.00", wrongWeight: "0.00" },
            { questionId: essay.id, sortOrder: 2, weight: "5.00", wrongWeight: "0.00" },
          ],
        },
      },
    });
  }

  const startsAt = new Date(Date.now() + 30 * 60_000);
  const attendanceOpensAt = new Date(Date.now() - 30 * 60_000);

  let exam = await prisma.exam.findUnique({ where: { competitionId: 1 } });
  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        name: "Ujian Contoh",
        competitionId: 1,
        attendanceOpensAt,
        startsAt,
        durationMinutes: 60,
        shuffleQuestions: false,
        shuffleOptions: false,
        status: "PUBLISHED",
        phase: "NOT_STARTED",
        createdById: admin.id,
      },
    });
    for (const jenjang of ["SD", "SMP", "SMA"] as const) {
      const examPack = await prisma.examPackage.create({
        data: { examId: exam.id, jenjang, packageId: pack.id },
      });
      await prisma.$transaction(async (tx) => {
        await applyPackageSnapshot(tx, examPack.id, pack!.id);
      });
    }
  }

  await writeExamState(exam.id, {
    phase: exam.phase,
    startedAt: exam.startedAt?.toISOString() ?? null,
  });

  console.log("Data contoh siap. Masuk sebagai admin, petugas, atau peserta. Kata sandi apa saja (AUTH_DRIVER=mock).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
