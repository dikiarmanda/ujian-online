import { timingSafeEqual } from "node:crypto";

export function passwordsMatch(stored: string, given: string): boolean {
  if (!stored) return false;
  const left = Buffer.from(stored);
  const right = Buffer.from(given);
  if (left.length !== right.length) {
    timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return timingSafeEqual(left, right);
}
