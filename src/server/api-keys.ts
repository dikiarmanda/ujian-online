import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const PREFIX_LENGTH = 20;

export function createApiKeyMaterial(): { token: string; prefix: string; keyHash: string } {
  const token = `uj_live_${randomBytes(32).toString("base64url")}`;
  const prefix = token.slice(0, PREFIX_LENGTH);
  const keyHash = createHash("sha256").update(token).digest("hex");
  return { token, prefix, keyHash };
}

export function keyPrefix(token: string): string | null {
  if (!token.startsWith("uj_live_") || token.length <= PREFIX_LENGTH) return null;
  return token.slice(0, PREFIX_LENGTH);
}

export function keyHashesMatch(storedHex: string, token: string): boolean {
  const actual = createHash("sha256").update(token).digest();
  const expected = Buffer.from(storedHex, "hex");
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
