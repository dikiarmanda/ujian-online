import assert from "node:assert/strict";
import test from "node:test";
import { assertJenjangPackagesComplete, parseCompetitionJenjang } from "@/lib/jenjang";
import { computeDeadline } from "./exam-rules";

test("expiresAt = min(startedAt + durasi, exam.endsAt)", () => {
  const startedAt = new Date("2026-10-18T01:00:00.000Z");
  const endsAt = new Date("2026-10-18T02:00:00.000Z");
  // 90 menit akan melewati endsAt → capped
  const capped = computeDeadline(startedAt, 90, endsAt, 0);
  assert.equal(capped.toISOString(), "2026-10-18T02:00:00.000Z");
  // 30 menit di bawah endsAt
  const full = computeDeadline(startedAt, 30, endsAt, 0);
  assert.equal(full.toISOString(), "2026-10-18T01:30:00.000Z");
  // extra seconds setelah cap
  const extra = computeDeadline(startedAt, 90, endsAt, 60);
  assert.equal(extra.toISOString(), "2026-10-18T02:01:00.000Z");
});

test("validasi publish gagal bila ada jenjang tanpa paket", () => {
  assert.throws(() => assertJenjangPackagesComplete(["SD", "SMP"], ["SD"]));
  assert.doesNotThrow(() => assertJenjangPackagesComplete(["SD", "SMP"], ["SD", "SMP"]));
});

test("parse jenjang untuk publish", () => {
  const groups = parseCompetitionJenjang('["SD","MI","SMA"]');
  assert.deepEqual(groups, ["SD", "SMA"]);
  assert.throws(() => assertJenjangPackagesComplete(groups, ["SD"]));
});
