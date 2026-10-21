import assert from "node:assert/strict";
import test from "node:test";
import { assertJenjangPackagesComplete, parseCompetitionJenjang } from "@/lib/jenjang";
import { computeDeadline } from "./exam-rules";

test("expiresAt = startedAt + durasi (tanpa endsAt)", () => {
  const startedAt = new Date("2026-10-18T01:00:00.000Z");
  // 90 menit
  const full = computeDeadline(startedAt, 90, null, 0);
  assert.equal(full.toISOString(), "2026-10-18T02:30:00.000Z");
  // 30 menit
  const short = computeDeadline(startedAt, 30, null, 0);
  assert.equal(short.toISOString(), "2026-10-18T01:30:00.000Z");
  // extra seconds
  const extra = computeDeadline(startedAt, 90, null, 60);
  assert.equal(extra.toISOString(), "2026-10-18T02:31:00.000Z");
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
