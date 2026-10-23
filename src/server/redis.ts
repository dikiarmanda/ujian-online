import Redis from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function attachRedisHandlers(client: Redis): Redis {
  client.on("error", (error) => {
    console.error("[redis]", error.message);
  });
  return client;
}

function createRedis(): Redis {
  return attachRedisHandlers(
    new Redis(env().redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy(times) {
        return Math.min(times * 200, 2000);
      },
    }),
  );
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

export function createBullConnection(): Redis {
  return attachRedisHandlers(new Redis(env().redisUrl, { maxRetriesPerRequest: null }));
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    return false;
  }
}
