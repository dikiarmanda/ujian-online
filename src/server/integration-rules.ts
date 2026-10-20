export type ResultCursor = { updatedAt: Date; id: number };

export function encodeCursor(updatedAt: Date, id: number): string {
  return Buffer.from(JSON.stringify({ u: updatedAt.toISOString(), i: id })).toString("base64url");
}

export function decodeCursor(value: string): ResultCursor {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    throw new Error("Kursor tidak valid.");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Kursor tidak valid.");
  const record = parsed as { u?: unknown; i?: unknown };
  const updatedAt = typeof record.u === "string" ? new Date(record.u) : new Date(NaN);
  if (typeof record.i !== "number" || !Number.isInteger(record.i) || Number.isNaN(updatedAt.getTime())) {
    throw new Error("Kursor tidak valid.");
  }
  return { updatedAt, id: record.i };
}

export function parseLimit(value: string | null): number {
  if (value == null || value === "") return 100;
  if (!/^\d+$/.test(value)) throw new Error("Batas baris tidak valid.");
  const limit = Number(value);
  if (limit < 1 || limit > 500) throw new Error("Batas baris paling banyak 500.");
  return limit;
}

export function parseIncludeNonFinal(value: string | null): boolean {
  if (value == null || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error("Parameter includeNonFinal tidak valid.");
}

export function isFinalGrading(status: string): boolean {
  return status === "COMPLETED";
}

export function retryAfterUntil(now: Date, endsAt: Date | null): number | null {
  if (!endsAt) return null;
  const remaining = endsAt.getTime() - now.getTime();
  if (remaining < 0) return null;
  return Math.max(1, Math.ceil(remaining / 1000));
}

export function scoreNumber(value: { toString(): string } | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value.toString());
  if (Number.isNaN(parsed)) return null;
  return Math.round(parsed * 100) / 100;
}

export type ResultSource = {
  examId: number;
  status: string;
  mcScore: { toString(): string } | number | null;
  essayScore: { toString(): string } | number | null;
  totalScore: { toString(): string } | number | null;
  gradingStatus: string;
  submittedAt: Date | null;
  violationCount: number;
  attended: boolean;
  nisn: string;
  name: string;
  groupName: string | null;
  jenjang?: string | null;
};

export function toResultRow(source: ResultSource) {
  return {
    identity: source.nisn,
    name: source.name,
    group: source.groupName,
    examId: source.examId,
    jenjang: source.jenjang ?? null,
    attended: source.attended,
    attemptStatus: source.status,
    mcScore: scoreNumber(source.mcScore),
    essayScore: scoreNumber(source.essayScore),
    totalScore: scoreNumber(source.totalScore),
    gradingStatus: source.gradingStatus,
    isFinal: isFinalGrading(source.gradingStatus),
    submittedAt: source.submittedAt?.toISOString() ?? null,
    violationCount: source.violationCount,
  };
}
