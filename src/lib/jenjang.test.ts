import assert from "node:assert/strict";
import test from "node:test";
import { mapJenjang, parseCompetitionJenjang } from "./jenjang";

test("pemetaan jenjang baku", () => {
  assert.equal(mapJenjang("SD"), "SD");
  assert.equal(mapJenjang("MI"), "SD");
  assert.equal(mapJenjang("SMP"), "SMP");
  assert.equal(mapJenjang("MTs"), "SMP");
  assert.equal(mapJenjang("SMA"), "SMA");
  assert.equal(mapJenjang("MA"), "SMA");
  assert.equal(mapJenjang("SMK"), "SMK");
  assert.throws(() => mapJenjang("TK"));
});

test("parse jenjang competition JSON", () => {
  assert.deepEqual(parseCompetitionJenjang('["SD","MI","SMP"]'), ["SD", "SMP"]);
  assert.deepEqual(parseCompetitionJenjang(["SMA", "MA", "SMK"]), ["SMA", "SMK"]);
  assert.deepEqual(parseCompetitionJenjang([]), []);
  assert.deepEqual(parseCompetitionJenjang(""), []);
  assert.deepEqual(parseCompetitionJenjang(null), []);
  assert.throws(() => parseCompetitionJenjang("{bukan-json"));
  assert.throws(() => parseCompetitionJenjang(["TK"]));
});
