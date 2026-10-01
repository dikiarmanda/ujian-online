import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAuthDriver,
  assertSingleCorrectOption,
  computeDeadline,
  countAnswerStats,
  mapOriginRole,
} from "./exam-rules";

test("production menolak driver mock", () => {
  assert.throws(() => assertAuthDriver("production", "mock"));
  assert.doesNotThrow(() => assertAuthDriver("production", "remote"));
  assert.doesNotThrow(() => assertAuthDriver("development", "mock"));
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
  assert.doesNotThrow(() => assertSingleCorrectOption(1, 4));
});

test("ringkasan jawaban memisahkan ragu-ragu", () => {
  const stats = countAnswerStats([1, 2, 3], {
    1: { selectedOptionId: 9, essayText: null, isDoubtful: false },
    2: { selectedOptionId: null, essayText: "isi", isDoubtful: true },
  });
  assert.deepEqual(stats, { answered: 1, unanswered: 1, doubtful: 1 });
});
