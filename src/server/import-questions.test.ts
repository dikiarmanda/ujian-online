import assert from "node:assert/strict";
import test from "node:test";
import { inspectImportTable } from "./import-rows";

const header = ["paket", "kategori", "jenis", "teks", "bobot", "bobot_salah", "opsi_a", "opsi_b", "opsi_c", "opsi_d", "opsi_e", "kunci", "kunci_jawaban_singkat", "pedoman", "rubrik", "ada_gambar"];

test("impor menandai soal valid dan tidak valid", () => {
  const items = inspectImportTable([
    header,
    ["Paket A", "Matematika", "pg", "2 + 2?", "1", "-1", "3", "4", "5", "6", "", "B", "", "", "", "0"],
    ["Paket A", "Matematika", "pg", "Tanpa kunci", "1", "1", "3", "4", "5", "6", "", "", "", "", "", ""],
    ["", "IPA", "uraian", "Jelaskan fotosintesis.", "2", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "IPS", "jawaban singkat", "Ibu kota Indonesia?", "1", "1", "", "", "", "", "", "", "jakarta", "", "", ""],
    ["", "", "pg", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ]);

  assert.equal(items.length, 5);
  assert.equal(items[0]?.valid, true);
  assert.equal(items[0]?.kunci, "B");
  assert.equal(items[0]?.bobotSalah, "1");
  assert.equal(items[1]?.valid, false);
  assert.match(items[1]?.error ?? "", /kunci/);
  assert.equal(items[2]?.valid, false);
  assert.match(items[2]?.error ?? "", /pedoman/);
  assert.equal(items[3]?.valid, true);
  assert.equal(items[3]?.jenis, "Jawaban singkat");
  assert.equal(items[4]?.valid, false);
  assert.match(items[4]?.error ?? "", /Kategori/);
});

test("baris kosong tidak ikut pratinjau", () => {
  const items = inspectImportTable([
    header,
    ["", "IPA", "jawaban singkat", "Planet terdekat?", "1", "0", "", "", "", "", "", "", "merkurius", "", "", ""],
    Array(header.length).fill(""),
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.row, 2);
});
