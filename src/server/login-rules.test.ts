import assert from "node:assert/strict";
import test from "node:test";
import { passwordsMatch } from "./login-rules";

test("password peserta cocok hanya bila string sama dan tidak kosong", () => {
  assert.equal(passwordsMatch("rahasia", "rahasia"), true);
  assert.equal(passwordsMatch("rahasia", "salah"), false);
  assert.equal(passwordsMatch("", "rahasia"), false);
  assert.equal(passwordsMatch("rahasia", ""), false);
});
