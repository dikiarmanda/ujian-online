import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAuthDriver,
  assertSingleCorrectOption,
  computeDeadline,
  countAnswerStats,
  mapOmbnAdminRole,
  mapOriginRole,
  shortAnswersMatch,
} from "./exam-rules";

test("login tidak bergantung pada AUTH_DRIVER", () => {
  assert.doesNotThrow(() => assertAuthDriver("production", "mock"));
  assert.doesNotThrow(() => assertAuthDriver("production", "remote"));
});

test("role admin OMBN dipetakan", () => {
  assert.equal(mapOmbnAdminRole("SUPERADMIN"), "ADMIN");
  assert.equal(mapOmbnAdminRole("ADMIN"), "ADMIN");
  assert.equal(mapOmbnAdminRole("JURI"), "GRADER");
  assert.equal(mapOmbnAdminRole("LAIN"), null);
});

test("role sistem asal dipetakan", () => {
  assert.equal(mapOriginRole("peserta"), "PARTICIPANT");
  assert.equal(mapOriginRole("admin"), "ADMIN");
  assert.equal(mapOriginRole("petugas"), "GRADER");
});

test("batas waktu memakai durasi dan jam selesai sesi", () => {
  const started = new Date("2026-10-01T01:00:00.000Z");
  const ends = new Date("2026-10-01T02:00:00.000Z");
  const capped = computeDeadline(started, 120, ends, 0);
  assert.equal(capped.toISOString(), ends.toISOString());
  const extended = computeDeadline(started, 30, ends, 600);
  assert.equal(extended.getTime(), started.getTime() + 30 * 60_000 + 600_000);
});

test("pilihan ganda menolak kunci ganda", () => {
  assert.throws(() => assertSingleCorrectOption(2, 4));
  assert.throws(() => assertSingleCorrectOption(1, 3));
  assert.doesNotThrow(() => assertSingleCorrectOption(1, 4));
  assert.doesNotThrow(() => assertSingleCorrectOption(1, 5));
});

test("ringkasan jawaban memisahkan ragu-ragu", () => {
  const stats = countAnswerStats([1, 2, 3, 4], {
    1: { selectedOptionId: 9, essayText: null, shortAnswerText: null, isDoubtful: false },
    2: { selectedOptionId: null, essayText: "isi", shortAnswerText: null, isDoubtful: true },
    4: { selectedOptionId: null, essayText: null, shortAnswerText: "jakarta", isDoubtful: false },
  });
  assert.deepEqual(stats, { answered: 2, unanswered: 1, doubtful: 1 });
});

test("jawaban singkat cocok setelah diubah ke huruf kecil", () => {
  assert.equal(shortAnswersMatch("Jakarta", "jakarta"), true);
  assert.equal(shortAnswersMatch("  JAKARTA ", "Jakarta"), true);
  assert.equal(shortAnswersMatch("bandung", "jakarta"), false);
  assert.equal(shortAnswersMatch("  ", "jakarta"), false);
  assert.equal(shortAnswersMatch(null, "jakarta"), false);
});
