import "dotenv/config";
import { prisma } from "../src/server/db";
import { parseExamDate } from "../src/server/exam-rules";

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
  const peserta = await prisma.user.upsert({
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
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const examDate = parseExamDate(today);
  let exam = await prisma.exam.findFirst({ where: { name: "Ujian Contoh", examDate } });
  if (!exam) {
    exam = await prisma.exam.create({
      data: {
        name: "Ujian Contoh",
        examDate,
        durationMinutes: 60,
        shuffleQuestions: false,
        shuffleOptions: false,
        status: "PUBLISHED",
        createdById: admin.id,
        questions: {
          create: [
            { questionId: pg.id, sortOrder: 1, weight: "2.00" },
            { questionId: essay.id, sortOrder: 2, weight: "5.00" },
          ],
        },
      },
    });
  }
  const startsAt = new Date(Date.now() - 5 * 60_000);
  const endsAt = new Date(Date.now() + 3 * 60 * 60_000);
  const attendanceOpensAt = new Date(Date.now() - 30 * 60_000);
  let session = await prisma.examSession.findFirst({ where: { examId: exam.id, name: "Sesi pagi" } });
  if (!session) {
    session = await prisma.examSession.create({
      data: { examId: exam.id, name: "Sesi pagi", startsAt, endsAt, attendanceOpensAt, capacity: 100 },
    });
  }
  const beban = await prisma.user.upsert({
    where: { externalId: "mock:beban" },
    create: { externalId: "mock:beban", identity: "beban", name: "Peserta Beban", role: "PARTICIPANT" },
    update: { identity: "beban", name: "Peserta Beban" },
  });
  await prisma.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId: beban.id } },
    create: { sessionId: session.id, userId: beban.id, examDate },
    update: {},
  });
  await prisma.sessionParticipant.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId: peserta.id } },
    create: { sessionId: session.id, userId: peserta.id, examDate },
    update: {},
  });
  console.log("Data contoh siap. Masuk sebagai admin, petugas, atau peserta. Kata sandi apa saja.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
