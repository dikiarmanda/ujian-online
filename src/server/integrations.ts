import { Prisma, type ExamStatus } from "@/generated/prisma/client";
import { keyHashesMatch, keyPrefix } from "./api-keys";
import { prisma } from "./db";
import { prismaReadonly } from "./db-readonly";
import { env } from "./env";
import { AppError, IntegrationError } from "./errors";
import {
  decodeCursor,
  encodeCursor,
  isFinalGrading,
  parseIncludeNonFinal,
  parseLimit,
  toResultRow,
  type ResultCursor,
} from "./integration-rules";
import { redis } from "./redis";
import { clientIp } from "./session";

const EXAM_BLOCK_KEY = "integration:exam-block";
const DUMMY_KEY_HASH = "0".repeat(64);

export type ApiActor = {
  clientId: number;
  keyId: number;
  allExams: boolean;
  examIds: number[];
  rateLimitPerMinute: number;
  allowedIps: string[];
};

function readIps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function invalid(message: string): IntegrationError {
  return new IntegrationError("INVALID_PARAMETER", message, 422);
}

export function integrationJson(data: unknown, status = 200, retryAfter?: number): Response {
  const headers = new Headers({ "cache-control": "no-store" });
  if (retryAfter) headers.set("retry-after", String(retryAfter));
  return Response.json(data, { status, headers });
}

function integrationErrorResponse(error: IntegrationError): Response {
  return integrationJson(
    { error: { code: error.code, message: error.message } },
    error.status,
    error.retryAfter,
  );
}

function asIntegrationError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error;
  if (error instanceof AppError) {
    const code =
      error.status === 401
        ? "UNAUTHENTICATED"
        : error.status === 403
          ? "FORBIDDEN"
          : error.status === 404
            ? "NOT_FOUND"
            : error.status === 429
              ? "RATE_LIMITED"
              : error.status === 503
                ? "EXAM_IN_PROGRESS"
                : "INVALID_PARAMETER";
    return new IntegrationError(code, error.message, error.status === 400 ? 422 : error.status);
  }
  console.error(error);
  return new IntegrationError("SERVER_ERROR", "Terjadi kesalahan di server. Coba lagi.", 500);
}

function assertHttps(req: Request): void {
  if (env().nodeEnv !== "production") return;
  const forwarded = req.headers.get("x-forwarded-proto");
  const protocol = forwarded || new URL(req.url).protocol.replace(":", "");
  if (protocol !== "https") {
    throw new IntegrationError("FORBIDDEN", "HTTPS wajib.", 403);
  }
}

async function authenticate(req: Request): Promise<ApiActor> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const prefix = keyPrefix(token);
  const row = prefix
    ? await prisma.apiKey.findUnique({
        where: { prefix },
        include: { client: { include: { exams: { select: { examId: true } } } } },
      })
    : null;
  const matched = keyHashesMatch(row?.keyHash ?? DUMMY_KEY_HASH, token || "invalid");
  const expired = Boolean(row?.expiresAt && row.expiresAt.getTime() <= Date.now());
  if (!row || !matched || row.revokedAt || expired || row.client.status !== "ACTIVE" || row.client.revokedAt) {
    throw new IntegrationError("UNAUTHENTICATED", "API key hilang atau tidak valid.", 401);
  }
  return {
    clientId: row.clientId,
    keyId: row.id,
    allExams: row.client.allExams,
    examIds: row.client.exams.map((exam) => exam.examId),
    rateLimitPerMinute: row.client.rateLimitPerMinute,
    allowedIps: readIps(row.client.allowedIps),
  };
}

async function assertAllowedIp(actor: ApiActor, ipAddress: string): Promise<void> {
  if (actor.allowedIps.length && !actor.allowedIps.includes(ipAddress)) {
    throw new IntegrationError("FORBIDDEN", "Alamat IP tidak diizinkan.", 403);
  }
}

async function consumeLimit(key: string, limit: number): Promise<number | null> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  if (count <= limit) return null;
  const ttl = await redis.ttl(key);
  return ttl > 0 ? ttl : 60;
}

async function assertRateLimit(actor: ApiActor, ipAddress: string): Promise<void> {
  const clientWait = await consumeLimit(`rl:api:client:${actor.clientId}`, actor.rateLimitPerMinute);
  const ipWait = await consumeLimit(`rl:api:ip:${ipAddress}`, actor.rateLimitPerMinute);
  const retryAfter = Math.max(clientWait ?? 0, ipWait ?? 0);
  if (retryAfter > 0) {
    throw new IntegrationError("RATE_LIMITED", "Terlalu banyak permintaan.", 429, retryAfter);
  }
}

async function assertNoActiveExam(): Promise<void> {
  if (!env().integrationBlockDuringExam) return;
  const now = new Date();
  const cached = await redis.get(EXAM_BLOCK_KEY);
  if (cached != null) {
    const until = Number(cached);
    if (until && until > now.getTime()) {
      const retryAfter = Math.ceil((until - now.getTime()) / 1000);
      throw new IntegrationError(
        "EXAM_IN_PROGRESS",
        "Layanan tidak tersedia selama sesi ujian berlangsung.",
        503,
        retryAfter,
      );
    }
    if (!until) return;
  }
  const exam = await prismaReadonly.exam.findFirst({
    where: { phase: "RUNNING" },
    select: { id: true },
  });
  await redis.set(EXAM_BLOCK_KEY, exam ? String(Date.now() + 30 * 60 * 1000) : "0", "EX", 30);
  if (exam) {
    throw new IntegrationError(
      "EXAM_IN_PROGRESS",
      "Layanan tidak tersedia selama ujian berlangsung.",
      503,
      30 * 60,
    );
  }
}

async function recordAccess(req: Request, actor: ApiActor, statusCode: number, started: number): Promise<void> {
  const url = new URL(req.url);
  await prisma.apiAccessLog
    .create({
      data: {
        clientId: actor.clientId,
        keyId: actor.keyId,
        method: req.method,
        path: url.pathname.slice(0, 255),
        query: url.search ? url.search.slice(0, 500) : null,
        statusCode,
        durationMs: Date.now() - started,
        ipAddress: clientIp(req),
      },
    })
    .catch((error: unknown) => {
      console.error("Log akses API gagal", error);
    });
  await prisma.apiKey
    .update({ where: { id: actor.keyId }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);
}

export async function withIntegration(
  req: Request,
  run: (actor: ApiActor) => Promise<Response>,
): Promise<Response> {
  const started = Date.now();
  let actor: ApiActor | null = null;
  let status = 500;
  try {
    assertHttps(req);
    actor = await authenticate(req);
    const ipAddress = clientIp(req);
    await assertAllowedIp(actor, ipAddress);
    await assertRateLimit(actor, ipAddress);
    await assertNoActiveExam();
    const response = await run(actor);
    status = response.status;
    const headers = new Headers(response.headers);
    headers.set("cache-control", "no-store");
    return new Response(response.body, { status, headers });
  } catch (error) {
    const mapped = asIntegrationError(error);
    status = mapped.status;
    return integrationErrorResponse(mapped);
  } finally {
    if (actor) await recordAccess(req, actor, status, started);
  }
}

export async function assertExamAccess(actor: ApiActor, examId: number): Promise<void> {
  const exam = await prismaReadonly.exam.findUnique({ where: { id: examId }, select: { id: true } });
  if (!exam) throw new IntegrationError("NOT_FOUND", "Ujian tidak ditemukan.", 404);
  if (!actor.allExams && !actor.examIds.includes(examId)) {
    throw new IntegrationError("FORBIDDEN", "Klien tidak berhak atas ujian ini.", 403);
  }
}

export function readExamId(value: string): number {
  if (!/^\d+$/.test(value)) throw invalid("Ujian tidak ditemukan.");
  const examId = Number(value);
  if (!Number.isInteger(examId) || examId < 1) throw invalid("Ujian tidak ditemukan.");
  return examId;
}

function parseResultsQuery(url: URL): {
  updatedSince?: Date;
  cursor?: ResultCursor;
  limit: number;
  includeNonFinal: boolean;
} {
  try {
    const updatedRaw = url.searchParams.get("updatedSince");
    const cursorRaw = url.searchParams.get("cursor");
    let updatedSince: Date | undefined;
    if (updatedRaw) {
      updatedSince = new Date(updatedRaw);
      if (Number.isNaN(updatedSince.getTime())) throw new Error("updatedSince tidak valid.");
    }
    return {
      updatedSince,
      cursor: cursorRaw ? decodeCursor(cursorRaw) : undefined,
      limit: parseLimit(url.searchParams.get("limit")),
      includeNonFinal: parseIncludeNonFinal(url.searchParams.get("includeNonFinal")),
    };
  } catch (error) {
    throw invalid(error instanceof Error ? error.message : "Parameter tidak valid.");
  }
}

const attemptInclude = {
  user: { select: { nisn: true, name: true, groupName: true } },
  _count: { select: { violations: true } },
} satisfies Prisma.ExamAttemptInclude;

type AttemptRow = Prisma.ExamAttemptGetPayload<{ include: typeof attemptInclude }>;

function rowFromAttempt(attempt: AttemptRow) {
  return toResultRow({
    examId: attempt.examId,
    jenjang: attempt.jenjang,
    status: attempt.status,
    mcScore: attempt.mcScore,
    essayScore: attempt.essayScore,
    totalScore: attempt.totalScore,
    gradingStatus: attempt.gradingStatus,
    submittedAt: attempt.submittedAt,
    violationCount: attempt._count.violations,
    attended: Boolean(attempt.attendedAt),
    nisn: attempt.user.nisn ?? "",
    name: attempt.user.name,
    groupName: attempt.user.groupName,
  });
}

export async function listIntegrationExams(actor: ApiActor, url: URL) {
  const statusRaw = url.searchParams.get("status");
  const statuses: ExamStatus[] = ["DRAFT", "PUBLISHED", "ARCHIVED"];
  if (statusRaw && !statuses.includes(statusRaw as ExamStatus)) throw invalid("Status ujian tidak valid.");
  const exams = await prismaReadonly.exam.findMany({
    where: {
      ...(actor.allExams ? {} : { id: { in: actor.examIds } }),
      ...(statusRaw ? { status: statusRaw as ExamStatus } : {}),
    },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      startsAt: true,
      status: true,
      phase: true,
      durationMinutes: true,
      competitionId: true,
    },
  });
  return {
    data: exams.map((exam) => ({
      id: exam.id,
      name: exam.name,
      competitionId: exam.competitionId,
      startsAt: exam.startsAt.toISOString(),
      status: exam.status,
      phase: exam.phase,
      durationMinutes: exam.durationMinutes,
    })),
  };
}

/** Endpoint legacy: mengembalikan jadwal exam (bukan sesi). */
export async function listIntegrationSessions(actor: ApiActor, examId: number) {
  await assertExamAccess(actor, examId);
  const exam = await prismaReadonly.exam.findUnique({
    where: { id: examId },
    select: { id: true, name: true, startsAt: true, attendanceOpensAt: true, phase: true },
  });
  if (!exam) throw new IntegrationError("NOT_FOUND", "Ujian tidak ditemukan.", 404);
  return {
    data: [
      {
        id: exam.id,
        name: exam.name,
        startsAt: exam.startsAt.toISOString(),
        attendanceOpensAt: exam.attendanceOpensAt.toISOString(),
        phase: exam.phase,
      },
    ],
  };
}

export async function examSummary(actor: ApiActor, examId: number) {
  await assertExamAccess(actor, examId);
  const examFilter = { examId };
  const finished = { status: { in: ["SUBMITTED" as const, "TIME_EXPIRED" as const] } };
  const [participantCount, attendedCount, finishedCount, ungradedCount, scores] = await Promise.all([
    prismaReadonly.examAttempt.count({ where: examFilter }),
    prismaReadonly.examAttempt.count({ where: { ...examFilter, attendedAt: { not: null } } }),
    prismaReadonly.examAttempt.count({ where: { ...examFilter, ...finished } }),
    prismaReadonly.examAttempt.count({
      where: { ...examFilter, ...finished, gradingStatus: { not: "COMPLETED" } },
    }),
    prismaReadonly.examAttempt.aggregate({
      where: { ...examFilter, gradingStatus: "COMPLETED" },
      _avg: { totalScore: true },
      _min: { totalScore: true },
      _max: { totalScore: true },
    }),
  ]);
  return {
    participantCount,
    attendedCount,
    finishedCount,
    ungradedCount,
    average: scores._avg.totalScore == null ? null : Number(scores._avg.totalScore),
    minimum: scores._min.totalScore == null ? null : Number(scores._min.totalScore),
    maximum: scores._max.totalScore == null ? null : Number(scores._max.totalScore),
  };
}

function attemptFilters(examId: number, query: ReturnType<typeof parseResultsQuery>): Prisma.ExamAttemptWhereInput[] {
  const filters: Prisma.ExamAttemptWhereInput[] = [{ examId }, { user: { nisn: { not: null } } }];
  if (!query.includeNonFinal) filters.push({ gradingStatus: "COMPLETED" });
  if (query.updatedSince) filters.push({ updatedAt: { gte: query.updatedSince } });
  if (query.cursor) {
    filters.push({
      OR: [
        { updatedAt: { gt: query.cursor.updatedAt } },
        { updatedAt: query.cursor.updatedAt, id: { gt: query.cursor.id } },
      ],
    });
  }
  return filters;
}

export async function listResults(actor: ApiActor, examId: number, url: URL) {
  await assertExamAccess(actor, examId);
  const query = parseResultsQuery(url);
  const rows = await prismaReadonly.examAttempt.findMany({
    where: { AND: attemptFilters(examId, query) },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
    include: attemptInclude,
  });
  const page = rows.slice(0, query.limit).filter((row) => row.user.nisn);
  const last = page.at(-1);
  return {
    data: page.map((row) => rowFromAttempt(row)),
    page: {
      nextCursor: rows.length > query.limit && last ? encodeCursor(last.updatedAt, last.id) : null,
      limit: query.limit,
    },
  };
}

export async function resultForIdentity(actor: ApiActor, examId: number, identity: string, url: URL) {
  await assertExamAccess(actor, examId);
  let includeNonFinal = false;
  try {
    includeNonFinal = parseIncludeNonFinal(url.searchParams.get("includeNonFinal"));
  } catch (error) {
    throw invalid(error instanceof Error ? error.message : "Parameter tidak valid.");
  }
  const attempt = await prismaReadonly.examAttempt.findFirst({
    where: {
      examId,
      user: { nisn: identity },
      ...(includeNonFinal ? {} : { gradingStatus: "COMPLETED" }),
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: attemptInclude,
  });
  if (!attempt?.user.nisn || (!includeNonFinal && !isFinalGrading(attempt.gradingStatus))) {
    throw new IntegrationError("NOT_FOUND", "Peserta tidak ditemukan.", 404);
  }
  return { data: rowFromAttempt(attempt) };
}
