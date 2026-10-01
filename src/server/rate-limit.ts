import { AppError } from "./errors";
import { redis } from "./redis";

export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  if (count > limit) {
    throw new AppError("Terlalu banyak percobaan. Tunggu sebentar lalu coba lagi.", 429);
  }
}
