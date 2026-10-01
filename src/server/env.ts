import { assertAuthDriver } from "./exam-rules";

export type AppEnv = {
  nodeEnv: string;
  authDriver: "mock" | "remote";
  databaseUrl: string;
  redisUrl: string;
  poolSize: number;
  originBaseUrl: string;
  originApiKey: string;
  gradingLockSeconds: number;
};

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Variabel lingkungan ${name} wajib diisi.`);
  }
  return value;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const nodeEnv = source.NODE_ENV || "development";
  const authDriver = source.AUTH_DRIVER || "mock";
  if (authDriver !== "mock" && authDriver !== "remote") {
    throw new Error("AUTH_DRIVER harus mock atau remote.");
  }
  if (source.NEXT_PHASE !== "phase-production-build") {
    assertAuthDriver(nodeEnv, authDriver);
  }
  const poolSize = Number(source.DATABASE_POOL_SIZE || 5);
  if (!Number.isInteger(poolSize) || poolSize < 1) {
    throw new Error("DATABASE_POOL_SIZE harus bilangan bulat positif.");
  }
  const originBaseUrl = source.ORIGIN_API_BASE_URL || "";
  const originApiKey = source.ORIGIN_API_KEY || "";
  if (authDriver === "remote" && source.NEXT_PHASE !== "phase-production-build") {
    required("ORIGIN_API_BASE_URL", originBaseUrl);
    required("ORIGIN_API_KEY", originApiKey);
  }
  return {
    nodeEnv,
    authDriver,
    databaseUrl: required("DATABASE_URL", source.DATABASE_URL),
    redisUrl: required("REDIS_URL", source.REDIS_URL),
    poolSize,
    originBaseUrl,
    originApiKey,
    gradingLockSeconds: Number(source.GRADING_LOCK_SECONDS || 900),
  };
}

let cached: AppEnv | null = null;

export function env(): AppEnv {
  if (!cached) cached = readEnv();
  return cached;
}

export function assertRuntimeEnv(): void {
  env();
}
