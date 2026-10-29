import { AppError } from "./errors";
import * as XLSX from "xlsx";

export type ImportPreviewRow = {
  row: number;
  valid: boolean;
  error: string | null;
  paket: string;
  kategori: string;
  jenis: string;
  teks: string;
  bobot: string;
  bobotSalah: string;
  kunci: string;
  adaGambar: boolean;
};

export type ImportPayload = {
  categoryName: string;
  type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER";
  body: string;
  imagePath: string | null;
  defaultWeight: number;
  defaultWrongWeight: number;
  options: { label: string; body: string; isCorrect: boolean }[];
  answerKey: string;
  rubric: string;
  shortAnswerKey: string;
  packageName: string;
};

export type StoredImportItem = ImportPreviewRow & { payload: ImportPayload | null };

const IMPORT_ROW_LIMIT = 5000;

function previewText(value: string, max = 140): string {
  const plain = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}…`;
}

function typeLabel(type: ImportPayload["type"]): string {
  if (type === "ESSAY") return "Uraian";
  if (type === "SHORT_ANSWER") return "Jawaban singkat";
  return "Pilihan ganda";
}

function parseJenis(raw: string): ImportPayload["type"] | null {
  const value = raw.trim().toLowerCase();
  if (value === "pg" || value === "pilihan ganda") return "MULTIPLE_CHOICE";
  if (value === "uraian") return "ESSAY";
  if (value === "jawaban singkat" || value === "singkat") return "SHORT_ANSWER";
  return null;
}

function readNumber(raw: string, label: string, fallback: number): number {
  const text = raw.trim();
  const value = text === "" ? fallback : Number(text);
  if (!Number.isFinite(value)) throw new Error(`${label} harus berupa angka.`);
  return value;
}

function inspectDataRow(rowNumber: number, cells: unknown[], index: (name: string) => number): StoredImportItem | null {
  const read = (name: string) => {
    const at = index(name);
    if (at < 0 || at >= cells.length || cells[at] == null) return "";
    return String(cells[at]).trim();
  };
  const paket = read("paket");
  const kategori = read("kategori");
  const jenisRaw = read("jenis");
  const teks = read("teks");
  const bobotRaw = read("bobot");
  const bobotSalahRaw = read("bobot_salah");
  const kunciRaw = read("kunci");
  const kunciSingkat = read("kunci_jawaban_singkat");
  const pedoman = read("pedoman");
  const rubrik = read("rubrik");
  const adaGambarRaw = read("ada_gambar").toLowerCase();
  const optionBodies = ["a", "b", "c", "d", "e"].map((label) => read(`opsi_${label}`));
  const blank = [paket, kategori, jenisRaw, teks, bobotRaw, bobotSalahRaw, kunciRaw, kunciSingkat, pedoman, rubrik, adaGambarRaw, ...optionBodies].every(
    (value) => value === "",
  );
  if (blank) return null;

  const adaGambar = adaGambarRaw === "1" || adaGambarRaw === "true";
  const base = {
    row: rowNumber,
    paket,
    kategori,
    jenis: jenisRaw || "—",
    teks: previewText(teks) || "—",
    bobot: bobotRaw || "1",
    bobotSalah: bobotSalahRaw || "1",
    kunci: kunciRaw || kunciSingkat || previewText(pedoman, 80) || "—",
    adaGambar,
  };

  try {
    if (!kategori) throw new Error("Kategori wajib diisi.");
    if (!teks) throw new Error("Teks soal wajib diisi.");
    const type = parseJenis(jenisRaw);
    if (!type) throw new Error("Jenis diisi pg, uraian, atau jawaban singkat.");
    const defaultWeight = readNumber(bobotRaw, "Bobot benar", 1);
    if (defaultWeight <= 0) throw new Error("Bobot benar harus lebih dari 0.");
    if (defaultWeight > 1000) throw new Error("Bobot benar maksimal 1000.");
    const wrongRaw = readNumber(bobotSalahRaw, "Bobot salah", 1);
    const defaultWrongWeight = Math.abs(wrongRaw);
    if (defaultWrongWeight > 1000) throw new Error("Bobot salah maksimal 1000.");

    const options = ["a", "b", "c", "d", "e"]
      .map((label, optionIndex) => ({
        label: label.toUpperCase(),
        body: optionBodies[optionIndex],
        isCorrect: kunciRaw.toUpperCase() === label.toUpperCase(),
      }))
      .filter((option) => option.body);
    let kunci = "—";
    if (type === "MULTIPLE_CHOICE") {
      const key = kunciRaw.toUpperCase();
      if (!key) throw new Error("Pilihan ganda wajib mengisi kolom kunci.");
      if (!["A", "B", "C", "D", "E"].includes(key)) throw new Error("Kunci pilihan ganda harus A, B, C, D, atau E.");
      if (!optionBodies["ABCDE".indexOf(key)]) throw new Error(`Opsi ${key} kosong, tetapi dipakai sebagai kunci.`);
      if (options.length < 4) throw new Error("Pilihan ganda membutuhkan minimal 4 opsi.");
      const correctCount = options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) throw new Error("Pilihan ganda harus memiliki tepat satu kunci jawaban.");
      kunci = key;
    } else if (type === "SHORT_ANSWER") {
      if (!kunciSingkat) throw new Error("Jawaban singkat membutuhkan satu kunci jawaban.");
      if (kunciSingkat.length > 500) throw new Error("Kunci jawaban singkat maksimal 500 karakter.");
      kunci = kunciSingkat;
    } else if (!pedoman) {
      throw new Error("Uraian membutuhkan pedoman jawaban.");
    } else {
      kunci = previewText(pedoman, 80);
    }

    const body = adaGambar ? `<p>[GAMBAR] ${teks}</p>` : teks;
    const imagePath = adaGambar ? "https://dummyimage.com/600x400/cccccc/666666&text=Placeholder+Image" : null;
    return {
      ...base,
      jenis: typeLabel(type),
      bobot: defaultWeight.toString(),
      bobotSalah: defaultWrongWeight.toString(),
      kunci,
      valid: true,
      error: null,
      payload: {
        categoryName: kategori,
        type,
        body,
        imagePath,
        defaultWeight,
        defaultWrongWeight,
        options: type === "MULTIPLE_CHOICE" ? options : [],
        answerKey: pedoman,
        rubric: rubrik,
        shortAnswerKey: kunciSingkat,
        packageName: paket,
      },
    };
  } catch (error) {
    return {
      ...base,
      valid: false,
      error: error instanceof Error ? error.message : "Soal tidak valid.",
      payload: null,
    };
  }
}

export function inspectImportTable(rows: unknown[][]): StoredImportItem[] {
  if (rows.length < 2) throw new AppError("Berkas tidak berisi data soal.", 400);
  const header = rows[0].map((cell) => String(cell ?? "").trim().toLowerCase());
  const index = (name: string) => header.indexOf(name);
  for (const name of ["kategori", "jenis", "teks", "bobot"]) {
    if (index(name) < 0) throw new AppError(`Kolom ${name} wajib ada.`, 400);
  }
  const items: StoredImportItem[] = [];
  for (let row = 1; row < rows.length; row += 1) {
    if (items.length >= IMPORT_ROW_LIMIT) {
      throw new AppError(`Berkas terlalu besar. Maksimal ${IMPORT_ROW_LIMIT} soal sekali impor.`, 400);
    }
    const item = inspectDataRow(row + 1, rows[row] ?? [], index);
    if (item) items.push(item);
  }
  if (items.length === 0) throw new AppError("Berkas tidak berisi data soal.", 400);
  return items;
}

function splitCsv(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseExcelFile(data: string): string[][] {
  const workbook = XLSX.read(data, { type: "binary" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];
}

export function parseImportSource(data: string): unknown[][] {
  try {
    const rows = parseExcelFile(data);
    if (rows.length > 0) return rows;
  } catch {
    // Bukan berkas Excel. Lanjut baca sebagai CSV.
  }
  const lines = data.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  return lines.map((line) => splitCsv(line));
}
