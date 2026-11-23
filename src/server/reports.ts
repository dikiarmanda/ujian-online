import { prisma } from "./db";
import { AppError } from "./errors";
import { ombn } from "./ombn-db";

export async function examReport(examId: number) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      name: true,
      startsAt: true,
      phase: true,
      durationMinutes: true,
      averageScore: true,
      jenjangGroups: true,
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
      rank: attempt.rank,
    };
  }).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

  const mcQuestions = exam.packages.flatMap((pack) =>
    pack.questions
      .filter((item) => item.question.type === "MULTIPLE_CHOICE" || item.question.type === "SHORT_ANSWER")
      .map((item) => ({ ...item, jenjang: pack.jenjang })),
  );
  const finished = exam.attempts.filter((attempt) => attempt.status !== "IN_PROGRESS");
  const items = mcQuestions
    .map((item) => {
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
        question: item.question.body,
        questionId: item.questionId,
        jenjang: item.jenjang,
        correct,
        total,
        percent,
      };
    })
    .sort((a, b) => b.correct - a.correct);
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
    jenjangGroups: exam.jenjangGroups,
    startsAt: exam.startsAt,
    phase: exam.phase,
    durationMinutes: exam.durationMinutes,
    averageScore: exam.averageScore,
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
    ["Nama", "Identitas", "Kelompok", "Jenjang", "Status", "Skor otomatis", "Skor uraian", "Total", "Penilaian"],
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
  const fs = await import("fs");
  const path = await import("path");

  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  // Helper functions
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const stripHtml = (html: string) => {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").substring(0, 40);
  };

  const getViolationDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      WINDOW_BLUR: "Jendela browser tidak aktif",
      RIGHT_CLICK: "Klik kanan pada mouse",
      COPY_PASTE: "Copy/paste konten",
      TAB_SWITCH: "Pindah tab browser",
    };
    return descriptions[type] || type;
  };

  // Colors
  const colors = {
    primary: "#2563eb",
    primaryLight: "#dbeafe",
    secondary: "#7c3aed",
    secondaryLight: "#ede9fe",
    danger: "#dc2626",
    dangerLight: "#fee2e2",
    success: "#16a34a",
    successLight: "#dcfce7",
    warning: "#ea580c",
    warningLight: "#ffedd5",
    gray: "#6b7280",
    grayLight: "#f3f4f6",
    border: "#e5e7eb",
  };

  // Header with logo
  const logoPath = path.join(process.cwd(), "public", "brand", "logo-dikdas.png");
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 40, { width: 50 });
  }

  doc.fontSize(20).font("Helvetica-Bold").fillColor("#1f2937").text("LAPORAN HASIL UJIAN", 110, 45);
  doc.fontSize(14).font("Helvetica").fillColor("#4b5563").text(report.examName, 110, 70);

  // Blue separator line
  doc.moveTo(40, 105).lineTo(790, 105).lineWidth(3).strokeColor(colors.primary).stroke();

  // Info box
  const infoY = 120;
  doc.rect(40, infoY, 750, 40).fill(colors.grayLight).stroke(colors.border);
  doc.fontSize(9).font("Helvetica-Bold").fillColor(colors.gray);
  doc.text("Fase", 50, infoY + 12);
  doc.text("Tanggal", 200, infoY + 12);
  doc.text("Waktu", 350, infoY + 12);
  doc.text("Durasi", 500, infoY + 12);

  doc.font("Helvetica").fillColor("#1f2937");
  doc.text(report.phase || "-", 50, infoY + 26);
  doc.text(formatDate(report.startsAt), 200, infoY + 26);
  doc.text(formatTime(report.startsAt), 350, infoY + 26);
  doc.text(`${report.durationMinutes} menit`, 500, infoY + 26);

  // Statistics cards
  const statsY = 175;
  const cardWidth = 240;
  const cardGap = 15;

  // Card 1: Terdaftar
  doc.rect(40, statsY, cardWidth, 60).fill(colors.primaryLight).stroke(colors.primary).lineWidth(1);
  doc.fontSize(28).font("Helvetica-Bold").fillColor(colors.primary).text(String(report.attendance.assigned), 60, statsY + 20);
  doc.fontSize(10).font("Helvetica").fillColor(colors.gray).text("Peserta Terdaftar", 60, statsY + 45);

  // Card 2: Hadir
  doc.rect(40 + cardWidth + cardGap, statsY, cardWidth, 60).fill(colors.successLight).stroke(colors.success);
  doc.fontSize(28).font("Helvetica-Bold").fillColor(colors.success).text(String(report.attendance.attended), 40 + cardWidth + cardGap + 20, statsY + 20);
  doc.fontSize(10).font("Helvetica").fillColor(colors.gray).text("Hadir", 40 + cardWidth + cardGap + 20, statsY + 45);

  // Card 3: Tidak Hadir
  doc.rect(40 + (cardWidth + cardGap) * 2, statsY, cardWidth, 60).fill(colors.warningLight).stroke(colors.warning);
  const tidakHadir = report.attendance.assigned - report.attendance.attended;
  doc.fontSize(28).font("Helvetica-Bold").fillColor(colors.warning).text(String(tidakHadir), 40 + (cardWidth + cardGap) * 2 + 20, statsY + 20);
  doc.fontSize(10).font("Helvetica").fillColor(colors.gray).text("Tidak Hadir", 40 + (cardWidth + cardGap) * 2 + 20, statsY + 45);

  // Table header - Nilai Peserta
  const tableY = 255;
  const rowHeight = 22;
  const colWidths = [35, 160, 100, 70, 70, 50, 60, 50];
  const headers = ["No", "Nama", "Identitas", "Jenjang", "Status", "Nilai", "Pelang.", "Rank"];

  // Section title
  doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Hasil Ujian Peserta", 40, tableY - 15);

  // Table header background
  let x = 40;
  doc.rect(x, tableY, 750, rowHeight).fill(colors.primary);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 5, tableY + 6, { width: colWidths[i] - 10, align: "left" });
    x += colWidths[i];
  }

  // Table data
  doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
  let y = tableY + rowHeight;
  let rowNum = 0;
  let isFirstPage = true;

  for (const row of report.rows) {
    x = 40;
    const isEven = rowNum % 2 === 0;
    if (isEven) {
      doc.rect(x, y, 750, rowHeight).fill("#f9fafb");
    }

    const cells = [
      String(rowNum + 1),
      row.name,
      row.identity,
      row.jenjang,
      row.status,
      row.totalScore || "-",
      String(row.violations),
      row.rank ? `#${row.rank}` : "-",
    ];

    for (let i = 0; i < cells.length; i++) {
      doc.text(cells[i], x + 5, y + 6, { width: colWidths[i] - 10, align: i === 0 ? "center" : "left" });
      x += colWidths[i];
    }

    // Border
    doc.rect(40, y, 750, rowHeight).stroke(colors.border);
    y += rowHeight;
    rowNum++;

    // New page if needed
    if (y > 520) {
      doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
      isFirstPage = false;
      y = 60; // Start closer to top on continuation pages
      rowNum = 0;

      // Repeat header (no logo on continuation pages)
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Hasil Ujian Peserta (lanjutan)", 40, y - 15);
      x = 40;
      doc.rect(x, y, 750, rowHeight).fill(colors.primary);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x + 5, y + 6, { width: colWidths[i] - 10, align: "left" });
        x += colWidths[i];
      }
      doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
      y += rowHeight;
    }
  }

  // New page for question analysis
  doc.addPage({ margin: 40, size: "A4", layout: "landscape" });

  // Header logo
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 40, 40, { width: 50 });
  }
  doc.fontSize(20).font("Helvetica-Bold").fillColor("#1f2937").text("LAPORAN HASIL UJIAN", 110, 45);
  doc.fontSize(14).font("Helvetica").fillColor("#4b5563").text(report.examName, 110, 70);
  doc.moveTo(40, 105).lineTo(790, 105).lineWidth(3).strokeColor(colors.primary).stroke();

  // Question analysis table
  const questionTableY = 130;
  const questionColWidths = [35, 70, 70, 280, 50, 50, 50];
  const questionHeaders = ["No", "Jenjang", "Kode", "Soal", "Benar", "Total", "%"];

  doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Analisis Butir Soal", 40, questionTableY - 15);

  x = 40;
  doc.rect(x, questionTableY, 750, rowHeight).fill(colors.secondary);
  doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
  for (let i = 0; i < questionHeaders.length; i++) {
    doc.text(questionHeaders[i], x + 5, questionTableY + 6, { width: questionColWidths[i] - 10, align: "left" });
    x += questionColWidths[i];
  }

  doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
  y = questionTableY + rowHeight;
  rowNum = 0;
  let isFirstQuestionPage = true;

  for (const item of report.items) {
    x = 40;
    const isEven = rowNum % 2 === 0;
    if (isEven) {
      doc.rect(x, y, 750, rowHeight).fill("#f9fafb");
    }

    const questionText = stripHtml(item.question);
    const percentColor = item.percent >= 70 ? colors.success : item.percent >= 50 ? colors.warning : colors.danger;

    const cells = [
      String(rowNum + 1),
      item.jenjang,
      item.code,
      questionText,
      String(item.correct),
      String(item.total),
      `${item.percent}%`,
    ];

    for (let i = 0; i < cells.length; i++) {
      if (i === 6) {
        doc.fillColor(percentColor);
      }
      doc.text(cells[i], x + 5, y + 6, { width: questionColWidths[i] - 10, align: i === 0 ? "center" : "left" });
      if (i === 6) {
        doc.fillColor("#1f2937");
      }
      x += questionColWidths[i];
    }

    doc.rect(40, y, 750, rowHeight).stroke(colors.border);
    y += rowHeight;
    rowNum++;

    if (y > 520) {
      doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
      isFirstQuestionPage = false;
      y = 60; // Start closer to top on continuation pages
      rowNum = 0;

      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Analisis Butir Soal (lanjutan)", 40, y - 15);
      x = 40;
      doc.rect(x, y, 750, rowHeight).fill(colors.secondary);
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      for (let i = 0; i < questionHeaders.length; i++) {
        doc.text(questionHeaders[i], x + 5, y + 6, { width: questionColWidths[i] - 10, align: "left" });
        x += questionColWidths[i];
      }
      doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
      y += rowHeight;
    }
  }

  // Violations if any
  if (report.violations.length > 0) {
    doc.addPage({ margin: 40, size: "A4", layout: "landscape" });

    // Header logo
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 40, 40, { width: 50 });
    }
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#1f2937").text("LAPORAN HASIL UJIAN", 110, 45);
    doc.fontSize(14).font("Helvetica").fillColor("#4b5563").text(report.examName, 110, 70);
    doc.moveTo(40, 105).lineTo(790, 105).lineWidth(3).strokeColor(colors.primary).stroke();

    const violationTableY = 130;
    const violationColWidths = [35, 150, 180, 170, 55];
    const violationHeaders = ["No", "Nama", "Jenis Pelanggaran", "Waktu", "No. Soal"];

    doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Catatan Pelanggaran", 40, violationTableY - 15);

    x = 40;
    doc.rect(x, violationTableY, 750, rowHeight).fill(colors.danger);
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
    for (let i = 0; i < violationHeaders.length; i++) {
      doc.text(violationHeaders[i], x + 5, violationTableY + 6, { width: violationColWidths[i] - 10, align: "left" });
      x += violationColWidths[i];
    }

    doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
    y = violationTableY + rowHeight;
    rowNum = 0;
    let isFirstViolationPage = true;

    for (const violation of report.violations) {
      x = 40;
      const isEven = rowNum % 2 === 0;
      if (isEven) {
        doc.rect(x, y, 750, rowHeight).fill("#fef2f2");
      }

      const cells = [
        String(rowNum + 1),
        violation.name,
        getViolationDescription(violation.type),
        new Date(violation.occurredAt).toLocaleString("id-ID"),
        String(violation.questionNumber || "-"),
      ];

      for (let i = 0; i < cells.length; i++) {
        doc.text(cells[i], x + 5, y + 6, { width: violationColWidths[i] - 10, align: i === 0 ? "center" : "left" });
        x += violationColWidths[i];
      }

      doc.rect(40, y, 750, rowHeight).stroke(colors.border);
      y += rowHeight;
      rowNum++;

      if (y > 520) {
        doc.addPage({ margin: 40, size: "A4", layout: "landscape" });
        isFirstViolationPage = false;
        y = 60; // Start closer to top on continuation pages
        rowNum = 0;

        doc.fontSize(12).font("Helvetica-Bold").fillColor("#1f2937").text("Catatan Pelanggaran (lanjutan)", 40, y - 15);
        x = 40;
        doc.rect(x, y, 750, rowHeight).fill(colors.danger);
        doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
        for (let i = 0; i < violationHeaders.length; i++) {
          doc.text(violationHeaders[i], x + 5, y + 6, { width: violationColWidths[i] - 10, align: "left" });
          x += violationColWidths[i];
        }
        doc.font("Helvetica").fontSize(8).fillColor("#1f2937");
        y += rowHeight;
      }
    }
  }

  // Footer
  doc.fontSize(8).font("Helvetica").fillColor(colors.gray).text(
    `Laporan dibuat otomatis oleh Sistem Ujian Online • ${new Date().toLocaleString("id-ID")}`,
    40,
    560,
    { align: "center" }
  );

  doc.end();
  return done;
}

export async function attemptReport(attemptId: number) {
  const attempt = await prisma.examAttempt.findUnique({
    where: { id: attemptId },
    include: {
      user: true,
      exam: {
        include: {
          packages: {
            include: { questions: { include: { question: { include: { options: true, essayKey: true, shortAnswerKey: true } } }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      answers: {
        include: {
          question: { include: { options: true, essayKey: true, shortAnswerKey: true } },
          selectedOption: true,
        },
        orderBy: { questionId: "asc" },
      },
      violations: true,
    },
  });
  if (!attempt) throw new AppError("Pengerjaan tidak ditemukan.", 404);

  const pack = attempt.exam.packages.find((p) => p.jenjang === attempt.jenjang);
  if (!pack) throw new AppError("Paket soal tidak ditemukan.", 404);

  const questionMap = new Map(pack.questions.map((item) => [item.questionId, item]));
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  const answerDetails = pack.questions.map((item) => {
    const question = item.question;
    const answer = answerMap.get(item.questionId) ?? null;
    const weight = Number(item.weight);
    const isCorrect = answer?.isCorrect ?? null;
    const score = answer?.score ?? null;

    let answerText: string | null = null;
    let correctAnswer: string | null = null;

    if (question.type === "MULTIPLE_CHOICE") {
      answerText = answer?.selectedOption?.label ?? null;
      correctAnswer = question.options.find((o) => o.isCorrect)?.label ?? null;
    } else if (question.type === "SHORT_ANSWER") {
      answerText = answer?.shortAnswerText ?? null;
      correctAnswer = question.shortAnswerKey?.answerKey ?? null;
    } else if (question.type === "ESSAY") {
      answerText = answer?.essayText ?? null;
      correctAnswer = question.essayKey?.answerKey ?? null;
    }

    return {
      questionId: item.questionId,
      code: question.code,
      type: question.type,
      body: question.body,
      weight,
      isCorrect,
      score,
      answerText,
      correctAnswer,
      gradingNote: answer?.gradingNote ?? null,
    };
  });

  return {
    attemptId: attempt.id,
    examId: attempt.exam.id,
    examName: attempt.exam.name,
    phase: attempt.exam.phase,
    startsAt: attempt.exam.startsAt,
    durationMinutes: attempt.exam.durationMinutes,
    user: {
      id: attempt.user.id,
      name: attempt.user.name,
      identity: attempt.user.identity,
      groupName: attempt.user.groupName,
    },
    jenjang: attempt.jenjang,
    status: attempt.status,
    attendedAt: attempt.attendedAt,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    mcScore: attempt.mcScore,
    essayScore: attempt.essayScore,
    totalScore: attempt.totalScore,
    gradingStatus: attempt.gradingStatus,
    rank: attempt.rank,
    answers: answerDetails,
    violations: attempt.violations.map((v) => ({
      type: v.type,
      occurredAt: v.occurredAt.toISOString(),
      questionNumber: v.questionNumber,
    })),
  };
}

export async function calculateRanks(examId: number) {
  // Fetch all completed exam attempts with grading done
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId,
      gradingStatus: "COMPLETED",
      totalScore: { not: null },
      status: { in: ["SUBMITTED", "TIME_EXPIRED"] },
    },
    select: {
      id: true,
      totalScore: true,
      submittedAt: true,
      startedAt: true,
      exam: {
        select: {
          competitionLevel: true,
        },
      },
      user: {
        select: {
          externalId: true,
        },
      },
    },
    orderBy: [{ totalScore: "desc" }, { submittedAt: "asc" }],
  });

  // Get competition level from first attempt (all have same exam)
  // Sementara semua lomba dianggap nasional, jadi competitionLevel tidak digunakan
  // const competitionLevel = attempts[0]?.exam.competitionLevel;

  // Fetch school codes from OMBN for grouping
  // Extract external IDs to find corresponding participants in OMBN
  const externalIds = attempts.map((a) => a.user.externalId).filter(Boolean) as string[];
  const pesertaIds = externalIds.map((id) => id.replace("ombn-peserta:", "")).map(Number);

  // Get participant data from OMBN to find their school_id
  const pesertas = await ombn.lomba_peserta.findMany({
    where: { id: { in: pesertaIds.map(BigInt) } },
    select: { id: true, school_id: true },
  });

  // Get school data to retrieve kode_kabupaten and kode_provinsi
  const schoolIds = pesertas.map((p) => p.school_id);
  const schools = await ombn.schools.findMany({
    where: { id: { in: schoolIds } },
    select: { id: true, kode_kabupaten: true, kode_provinsi: true },
  });

  // Create maps for quick lookup
  const schoolMap = new Map(schools.map((s) => [s.id.toString(), { kode_kabupaten: s.kode_kabupaten, kode_provinsi: s.kode_provinsi }]));
  const pesertaMap = new Map(pesertas.map((p) => [p.id.toString(), p.school_id.toString()]));

  // Build attempts with region codes attached
  const attemptsWithRegion = attempts.map((attempt) => {
    const pesertaId = attempt.user.externalId?.replace("ombn-peserta:", "");
    const schoolId = pesertaId ? pesertaMap.get(pesertaId) : null;
    const school = schoolId ? schoolMap.get(schoolId) : null;
    return {
      ...attempt,
      kode_kabupaten: school?.kode_kabupaten,
      kode_provinsi: school?.kode_provinsi,
    };
  });

  // Group attempts based on competition level
  let groups: Map<string, typeof attemptsWithRegion>;
  // Sementara semua lomba dianggap nasional, jadi semua peserta dihitung dalam 1 grup
  // if (competitionLevel === "KABUPATEN") {
  //   groups = new Map();
  //   for (const attempt of attemptsWithRegion) {
  //     const key = attempt.kode_kabupaten || "UNKNOWN";
  //     if (!groups.has(key)) groups.set(key, []);
  //     groups.get(key)!.push(attempt);
  //   }
  // } else if (competitionLevel === "PROVINSI") {
  //   groups = new Map();
  //   for (const attempt of attemptsWithRegion) {
  //     const key = attempt.kode_provinsi || "UNKNOWN";
  //     if (!groups.has(key)) groups.set(key, []);
  //     groups.get(key)!.push(attempt);
  //   }
  // } else {
    // NASIONAL: single group - semua peserta dalam satu grup
    groups = new Map([["ALL", attemptsWithRegion]]);
  // }

  // Calculate ranks within each group
  for (const groupAttempts of groups.values()) {
    // Sort by: totalScore desc, duration asc, submittedAt asc
    // 1. Total score tertinggi duluan
    // 2. Jika score sama, durasi lebih pendek duluan (tie-breaker)
    // 3. Jika score dan durasi sama, submit lebih awal duluan
    groupAttempts.sort((a, b) => {
      const scoreDiff = Number(b.totalScore) - Number(a.totalScore);
      if (scoreDiff !== 0) return scoreDiff;

      const aDuration = a.startedAt && a.submittedAt
        ? Math.floor((a.submittedAt.getTime() - a.startedAt.getTime()) / 60000)
        : Infinity;
      const bDuration = b.startedAt && b.submittedAt
        ? Math.floor((b.submittedAt.getTime() - b.startedAt.getTime()) / 60000)
        : Infinity;
      if (aDuration !== bDuration) return aDuration - bDuration;

      return (a.submittedAt?.getTime() || 0) - (b.submittedAt?.getTime() || 0);
    });

    let rank = 1;
    for (let i = 0; i < groupAttempts.length; i++) {
      const attempt = groupAttempts[i];

      // Compare with previous attempt to determine if rank should change
      if (i > 0) {
        const prevAttempt = groupAttempts[i - 1];
        const prevDurationMinutes = prevAttempt.startedAt && prevAttempt.submittedAt
          ? Math.floor((prevAttempt.submittedAt.getTime() - prevAttempt.startedAt.getTime()) / 60000)
          : null;
        const currentDurationMinutes = attempt.startedAt && attempt.submittedAt
          ? Math.floor((attempt.submittedAt.getTime() - attempt.startedAt.getTime()) / 60000)
          : null;

        // Rank naik jika salah satu kriteria berbeda dengan attempt sebelumnya
        if (Number(attempt.totalScore) !== Number(prevAttempt.totalScore) ||
            currentDurationMinutes !== prevDurationMinutes ||
            attempt.submittedAt?.getTime() !== prevAttempt.submittedAt?.getTime()) {
          rank = i + 1;
        }
      }

      // Update rank di database
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { rank },
      });
    }
  }

  return { updated: attempts.length };
}

/** Alias lama untuk kompatibilitas sementara. */
export const sessionReport = examReport;
