import { prisma } from "./db";
import { AppError } from "./errors";

export async function examReport(examId: number) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      packages: {
        include: { questions: { include: { question: true }, orderBy: { sortOrder: "asc" } } },
      },
      attempts: {
        include: {
          user: true,
          answers: { include: { question: true } },
          violations: true,
        },
      },
    },
  });
  if (!exam) throw new AppError("Ujian tidak ditemukan.", 404);

  const rows = exam.attempts.map((attempt) => {
    let status = "Belum absen";
    if (attempt.attendedAt) status = "Sudah absen";
    if (attempt.startedAt && attempt.status === "IN_PROGRESS") status = "Mengerjakan";
    if (attempt.status !== "IN_PROGRESS") status = "Selesai";
    return {
      userId: attempt.userId,
      name: attempt.user.name,
      identity: attempt.user.identity,
      groupName: attempt.user.groupName,
      jenjang: attempt.jenjang,
      status,
      mcScore: attempt.mcScore?.toString() ?? "",
      essayScore: attempt.essayScore?.toString() ?? "",
      totalScore: attempt.totalScore?.toString() ?? "",
      gradingStatus: attempt.gradingStatus ?? "",
      violations: attempt.violations.length,
      attemptId: attempt.id,
    };
  });

  const mcQuestions = exam.packages.flatMap((pack) =>
    pack.questions
      .filter((item) => item.question.type === "MULTIPLE_CHOICE")
      .map((item) => ({ ...item, jenjang: pack.jenjang })),
  );
  const finished = exam.attempts.filter((attempt) => attempt.status !== "IN_PROGRESS");
  const items = mcQuestions.map((item) => {
    let correct = 0;
    let total = 0;
    for (const attempt of finished) {
      if (attempt.jenjang !== item.jenjang) continue;
      total += 1;
      const answer = attempt.answers.find((row) => row.questionId === item.questionId);
      if (answer?.isCorrect) correct += 1;
    }
    const percent = total ? Math.round((correct / total) * 1000) / 10 : 0;
    return {
      code: item.question.code,
      questionId: item.questionId,
      jenjang: item.jenjang,
      correct,
      total,
      percent,
    };
  });
  const violations = exam.attempts.flatMap((attempt) =>
    attempt.violations.map((violation) => ({
      name: attempt.user.name,
      type: violation.type,
      occurredAt: violation.occurredAt.toISOString(),
      questionNumber: violation.questionNumber,
    })),
  );
  const attended = exam.attempts.filter((a) => a.attendedAt).length;
  return {
    examId: exam.id,
    examName: exam.name,
    startsAt: exam.startsAt,
    phase: exam.phase,
    durationMinutes: exam.durationMinutes,
    rows,
    items,
    violations,
    attendance: {
      assigned: exam.attempts.length,
      attended,
    },
  };
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function sheet(name: string, headers: string[], data: string[][]): string {
  const head = headers.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join("");
  const body = data
    .map((row) => `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${xmlEscape(cell)}</Data></Cell>`).join("")}</Row>`)
    .join("");
  return `<Worksheet ss:Name="${xmlEscape(name)}"><Table><Row>${head}</Row>${body}</Table></Worksheet>`;
}

export function reportWorkbook(report: Awaited<ReturnType<typeof examReport>>): string {
  const nilai = sheet(
    "Nilai",
    ["Nama", "Identitas", "Kelompok", "Jenjang", "Status", "Skor pilihan ganda", "Skor uraian", "Total", "Penilaian"],
    report.rows.map((row) => [
      row.name,
      row.identity,
      row.groupName ?? "",
      row.jenjang,
      row.status,
      row.mcScore,
      row.essayScore,
      row.totalScore,
      row.gradingStatus,
    ]),
  );
  const absensi = sheet(
    "Absensi",
    ["Nama", "Identitas", "Status"],
    report.rows.map((row) => [row.name, row.identity, row.status]),
  );
  const pelanggaran = sheet(
    "Pelanggaran",
    ["Nama", "Jenis", "Waktu", "Nomor soal"],
    report.violations.map((row) => [row.name, row.type, row.occurredAt, row.questionNumber == null ? "" : String(row.questionNumber)]),
  );
  const butir = sheet(
    "Butir",
    ["Jenjang", "Kode", "Benar", "Peserta selesai", "Persen"],
    report.items.map((row) => [row.jenjang, row.code, String(row.correct), String(row.total), String(row.percent)]),
  );
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${nilai}${absensi}${pelanggaran}${butir}
</Workbook>`;
}

export async function reportPdf(report: Awaited<ReturnType<typeof examReport>>): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.fontSize(16).text(report.examName);
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Hadir ${report.attendance.attended} dari ${report.attendance.assigned} peserta.`);
  doc.moveDown();
  for (const row of report.rows) {
    doc.text(`${row.name} (${row.identity}) ${row.status} total ${row.totalScore || "-"} pelanggaran ${row.violations}`);
  }
  doc.moveDown();
  doc.text("Persentase benar per soal");
  for (const item of report.items) {
    doc.text(`${item.jenjang} ${item.code}: ${item.percent}% (${item.correct}/${item.total})`);
  }
  doc.end();
  return done;
}

/** Alias lama untuk kompatibilitas sementara. */
export const sessionReport = examReport;
