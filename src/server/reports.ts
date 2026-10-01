import { prisma } from "./db";
import { AppError } from "./errors";

export async function sessionReport(sessionId: number) {
  const session = await prisma.examSession.findUnique({
    where: { id: sessionId },
    include: {
      exam: { include: { questions: { include: { question: true }, orderBy: { sortOrder: "asc" } } } },
      participants: { include: { user: true } },
      attendances: true,
      attempts: {
        include: {
          user: true,
          answers: { include: { question: true } },
          violations: true,
        },
      },
    },
  });
  if (!session) throw new AppError("Sesi tidak ditemukan.", 404);
  const attended = new Set(session.attendances.map((row) => row.userId));
  const attemptByUser = new Map(session.attempts.map((attempt) => [attempt.userId, attempt]));
  const rows = session.participants.map((participant) => {
    const attempt = attemptByUser.get(participant.userId);
    let status = "Belum absen";
    if (attended.has(participant.userId)) status = "Sudah absen";
    if (attempt?.status === "IN_PROGRESS") status = "Mengerjakan";
    if (attempt && attempt.status !== "IN_PROGRESS") status = "Selesai";
    return {
      userId: participant.userId,
      name: participant.user.name,
      identity: participant.user.identity,
      groupName: participant.user.groupName,
      status,
      mcScore: attempt?.mcScore?.toString() ?? "",
      essayScore: attempt?.essayScore?.toString() ?? "",
      totalScore: attempt?.totalScore?.toString() ?? "",
      gradingStatus: attempt?.gradingStatus ?? "",
      violations: attempt?.violations.length ?? 0,
      attemptId: attempt?.id ?? null,
    };
  });
  const mcQuestions = session.exam.questions.filter((item) => item.question.type === "MULTIPLE_CHOICE");
  const finished = session.attempts.filter((attempt) => attempt.status !== "IN_PROGRESS");
  const items = mcQuestions.map((item) => {
    let correct = 0;
    for (const attempt of finished) {
      const answer = attempt.answers.find((row) => row.questionId === item.questionId);
      if (answer?.isCorrect) correct += 1;
    }
    const percent = finished.length ? Math.round((correct / finished.length) * 1000) / 10 : 0;
    return { code: item.question.code, questionId: item.questionId, correct, total: finished.length, percent };
  });
  const violations = session.attempts.flatMap((attempt) =>
    attempt.violations.map((violation) => ({
      name: attempt.user.name,
      type: violation.type,
      occurredAt: violation.occurredAt.toISOString(),
      questionNumber: violation.questionNumber,
    })),
  );
  return {
    sessionName: session.name,
    examName: session.exam.name,
    rows,
    items,
    violations,
    attendance: {
      assigned: session.participants.length,
      attended: session.participants.filter((participant) => attended.has(participant.userId)).length,
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

export function reportWorkbook(report: Awaited<ReturnType<typeof sessionReport>>): string {
  const nilai = sheet(
    "Nilai",
    ["Nama", "Identitas", "Kelompok", "Status", "Skor pilihan ganda", "Skor uraian", "Total", "Penilaian"],
    report.rows.map((row) => [
      row.name,
      row.identity,
      row.groupName ?? "",
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
    ["Kode", "Benar", "Peserta selesai", "Persen"],
    report.items.map((row) => [row.code, String(row.correct), String(row.total), String(row.percent)]),
  );
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${nilai}${absensi}${pelanggaran}${butir}
</Workbook>`;
}

export async function reportPdf(report: Awaited<ReturnType<typeof sessionReport>>): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;
  const doc = new PDFDocument({ margin: 48 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });
  doc.fontSize(16).text(`${report.examName} — ${report.sessionName}`);
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Hadir ${report.attendance.attended} dari ${report.attendance.assigned} peserta.`);
  doc.moveDown();
  for (const row of report.rows) {
    doc.text(`${row.name} (${row.identity}) ${row.status} total ${row.totalScore || "-"} pelanggaran ${row.violations}`);
  }
  doc.moveDown();
  doc.text("Persentase benar per soal");
  for (const item of report.items) {
    doc.text(`${item.code}: ${item.percent}% (${item.correct}/${item.total})`);
  }
  doc.end();
  return done;
}
