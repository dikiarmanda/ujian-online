import { parseCompetitionJenjang, type JenjangGroup } from "@/lib/jenjang";
import { AppError } from "./errors";
import { ombn } from "./ombn-db";
import { prisma } from "./db";
import { redis } from "./redis";

const LIST_CACHE_KEY = "admin:competitions:available";
const LIST_TTL = 60;

export type CompetitionOption = {
  id: number;
  name: string;
  jenjangGroups: JenjangGroup[];
  jenjangRaw: unknown;
};

async function loadCompetitionsFromOmbn(): Promise<CompetitionOption[]> {
  const rows = await ombn.competitions.findMany({
    select: { id: true, nama_lomba: true, jenjang: true },
    orderBy: { id: "desc" },
  });
  const used = await prisma.exam.findMany({ select: { competitionId: true } });
  const taken = new Set(used.map((row) => row.competitionId));
  const options: CompetitionOption[] = [];
  for (const row of rows) {
    const id = Number(row.id);
    if (taken.has(id)) continue;
    let jenjangGroups: JenjangGroup[];
    try {
      jenjangGroups = parseCompetitionJenjang(row.jenjang);
    } catch {
      jenjangGroups = [];
    }
    options.push({
      id,
      name: row.nama_lomba,
      jenjangGroups,
      jenjangRaw: row.jenjang,
    });
  }
  return options;
}

export async function listAvailableCompetitions(): Promise<CompetitionOption[]> {
  const cached = await redis.get(LIST_CACHE_KEY);
  if (cached) return JSON.parse(cached) as CompetitionOption[];
  try {
    const options = await loadCompetitionsFromOmbn();
    await redis.set(LIST_CACHE_KEY, JSON.stringify(options), "EX", LIST_TTL);
    return options;
  } catch (error) {
    console.error("Gagal membaca daftar lomba OMBN", error);
    throw new AppError("Database lomba (OMBN) tidak dapat dihubungi. Coba lagi nanti.", 503);
  }
}

export async function invalidateCompetitionCache(): Promise<void> {
  await redis.del(LIST_CACHE_KEY);
}

export async function getCompetitionById(id: number): Promise<{ id: number; name: string; jenjangGroups: JenjangGroup[] }> {
  try {
    const row = await ombn.competitions.findUnique({
      where: { id: BigInt(id) },
      select: { id: true, nama_lomba: true, jenjang: true },
    });
    if (!row) throw new AppError("Lomba tidak ditemukan di OMBN.", 404);
    return {
      id: Number(row.id),
      name: row.nama_lomba,
      jenjangGroups: parseCompetitionJenjang(row.jenjang),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error("Gagal membaca lomba OMBN", error);
    throw new AppError("Database lomba (OMBN) tidak dapat dihubungi. Coba lagi nanti.", 503);
  }
}

export async function syncExamNameFromCompetition(examId: number): Promise<string> {
  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam) throw new AppError("Ujian tidak ditemukan.", 404);
  const competition = await getCompetitionById(exam.competitionId);
  await prisma.exam.update({ where: { id: examId }, data: { name: competition.name } });
  return competition.name;
}
