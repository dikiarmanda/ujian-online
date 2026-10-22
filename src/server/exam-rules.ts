export type OriginRole = "peserta" | "admin" | "petugas";
export type AppRole = "PARTICIPANT" | "ADMIN" | "GRADER";

export function assertAuthDriver(_nodeEnv: string | undefined, _driver: string | undefined): void {
  // Login peserta dan admin dicek langsung ke database OMBN.
}

export function mapOmbnAdminRole(role: string): AppRole | null {
  if (role === "SUPERADMIN" || role === "ADMIN") return "ADMIN";
  if (role === "JURI") return "GRADER";
  return null;
}

export function mapOriginRole(role: string): AppRole {
  if (role === "admin") return "ADMIN";
  if (role === "petugas") return "GRADER";
  if (role === "peserta") return "PARTICIPANT";
  throw new Error("Role dari sistem asal tidak dikenali.");
}

export function homeForRole(role: AppRole): string {
  if (role === "ADMIN") return "/admin";
  if (role === "GRADER") return "/petugas";
  return "/peserta";
}

export function computeDeadline(
  startedAt: Date,
  durationMinutes: number,
  sessionEndsAt: Date,
  extraSeconds: number,
): Date {
  const byDuration = startedAt.getTime() + durationMinutes * 60_000;
  const base = Math.min(byDuration, sessionEndsAt.getTime());
  return new Date(base + extraSeconds * 1000);
}

export function parseExamDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value) && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Tanggal ujian tidak valid.");
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatExamDate(value: Date): string {
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const date = new Date(value);
  const day = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

export function parseJakartaDateTime(value: string): Date {
  // datetime-local input menghasilkan format: YYYY-MM-DDTHH:mm
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Waktu tidak valid.");
  }
  // Parse sebagai WIB (UTC+7)
  return new Date(`${value}:00+07:00`);
}

export type AnswerSnapshot = {
  selectedOptionId: number | null;
  essayText: string | null;
  isDoubtful: boolean;
};

export function countAnswerStats(
  questionIds: number[],
  answers: Record<number, AnswerSnapshot | undefined>,
): { answered: number; unanswered: number; doubtful: number } {
  let answered = 0;
  let doubtful = 0;
  for (const id of questionIds) {
    const answer = answers[id];
    const filled = Boolean(answer && (answer.selectedOptionId != null || (answer.essayText ?? "").trim()));
    if (answer?.isDoubtful) doubtful += 1;
    else if (filled) answered += 1;
  }
  return {
    answered,
    doubtful,
    unanswered: questionIds.length - answered - doubtful,
  };
}

export function assertSingleCorrectOption(correctCount: number, optionCount: number): void {
  if (optionCount < 4) {
    throw new Error("Pilihan ganda membutuhkan minimal 4 opsi.");
  }
  if (correctCount !== 1) {
    throw new Error("Pilihan ganda harus memiliki tepat satu kunci jawaban.");
  }
}
