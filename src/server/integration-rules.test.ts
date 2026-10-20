import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeCursor,
  encodeCursor,
  isFinalGrading,
  parseIncludeNonFinal,
  parseLimit,
  retryAfterUntil,
  toResultRow,
} from "./integration-rules";

test("kursor hasil stabil", () => {
  const updatedAt = new Date("2026-11-03T02:14:09.000Z");
  const cursor = encodeCursor(updatedAt, 91);
  assert.deepEqual(decodeCursor(cursor), { updatedAt, id: 91 });
  assert.throws(() => decodeCursor("bukan-kursor"));
});

test("batas baris dan nilai final", () => {
  assert.equal(parseLimit(null), 100);
  assert.equal(parseLimit("2"), 2);
  assert.throws(() => parseLimit("501"));
  assert.equal(parseIncludeNonFinal(null), false);
  assert.equal(parseIncludeNonFinal("true"), true);
  assert.equal(isFinalGrading("COMPLETED"), true);
  assert.equal(isFinalGrading("PARTIAL"), false);
});

test("sesi aktif menghasilkan Retry-After", () => {
  const now = new Date("2026-11-03T02:00:00.000Z");
  assert.equal(retryAfterUntil(now, new Date("2026-11-03T02:00:30.000Z")), 30);
  assert.equal(retryAfterUntil(now, new Date("2026-11-03T01:00:00.000Z")), null);
});

test("rekap tidak memakai id pengguna dan menandai nilai belum final", () => {
  const finalRow = toResultRow({
    examId: 31,
    status: "SUBMITTED",
    mcScore: "72.50",
    essayScore: "18.00",
    totalScore: "90.50",
    gradingStatus: "COMPLETED",
    submittedAt: new Date("2026-11-03T02:14:09.000Z"),
    violationCount: 1,
    attended: true,
    nisn: "2024001",
    name: "Nama Peserta",
    groupName: "Kelas X-A",
  });
  assert.equal(finalRow.identity, "2024001");
  assert.equal(finalRow.isFinal, true);
  assert.equal(finalRow.totalScore, 90.5);
  assert.equal("userId" in finalRow, false);
  const draft = toResultRow({ ...{
    examId: 31,
    status: "SUBMITTED",
    mcScore: 10,
    essayScore: null,
    totalScore: null,
    gradingStatus: "PARTIAL",
    submittedAt: null,
    violationCount: 0,
    attended: true,
    nisn: "2024001",
    name: "Nama Peserta",
    groupName: null,
  } });
  assert.equal(draft.isFinal, false);
});
