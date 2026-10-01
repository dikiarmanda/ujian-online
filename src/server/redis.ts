import Redis from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedis(): Redis {
  return new Redis(env().redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableReadyCheck: true,
  });
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export function createBullConnection(): Redis {
  return new Redis(env().redisUrl, { maxRetriesPerRequest: null });
}
