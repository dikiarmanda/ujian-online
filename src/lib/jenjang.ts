/** Kelompok paket soal per jenjang. */
export type JenjangGroup = "SD" | "SMP" | "SMA" | "SMK";

const RAW_TO_GROUP: Record<string, JenjangGroup> = {
  SD: "SD",
  MI: "SD",
  SMP: "SMP",
  MTs: "SMP",
  SMA: "SMA",
  MA: "SMA",
  SMK: "SMK",
};

/**
 * Petakan jenjang pendaftaran/sekolah ke kelompok paket (SD/SMP/SMA/SMK).
 * Nilai di luar daftar menghasilkan error — tidak ada fallback diam-diam.
 */
export function mapJenjang(raw: string): JenjangGroup {
  const key = raw.trim();
  const group = RAW_TO_GROUP[key];
  if (!group) {
    throw new Error(`Jenjang "${raw}" tidak dikenali. Gunakan SD, MI, SMP, MTs, SMA, MA, atau SMK.`);
  }
  return group;
}

/**
 * Parse kolom jenjang competition (JSON string atau array).
 * Hasil: daftar kelompok unik yang wajib punya ExamPackage.
 */
export function parseCompetitionJenjang(value: unknown): JenjangGroup[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      throw new Error("Kolom jenjang lomba bukan JSON yang valid.");
    }
  }
  if (parsed == null) return [];
  if (!Array.isArray(parsed)) {
    throw new Error("Kolom jenjang lomba harus berupa array.");
  }
  if (parsed.length === 0) return [];
  const groups = new Set<JenjangGroup>();
  for (const item of parsed) {
    if (typeof item !== "string") {
      throw new Error("Setiap nilai jenjang harus berupa string.");
    }
    groups.add(mapJenjang(item));
  }
  const order: JenjangGroup[] = ["SD", "SMP", "SMA", "SMK"];
  return order.filter((g) => groups.has(g));
}

/** Validasi publish: setiap kelompok wajib punya paket. */
export function assertJenjangPackagesComplete(required: JenjangGroup[], have: string[]): void {
  const set = new Set(have);
  for (const group of required) {
    if (!set.has(group)) {
      throw new Error(`Tidak dapat menerbitkan: paket jenjang ${group} belum diatur.`);
    }
  }
}
