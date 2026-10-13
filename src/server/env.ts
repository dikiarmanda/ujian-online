import { assertAuthDriver } from "./exam-rules";

export type AppEnv = {
  nodeEnv: string;
  authDriver: "mock" | "remote";
  databaseUrl: string;
  ombnDatabaseUrl: string;
  dikdasmenDatabaseUrl: string;
  redisUrl: string;
  poolSize: number;
  originBaseUrl: string;
  originApiKey: string;
  gradingLockSeconds: number;
  loginMaxFailures: number;
  loginLockSeconds: number;
  readonlyDatabaseUrl: string;
  integrationBlockDuringExam: boolean;
};

function positiveInt(name: string, value: string | undefined, fallback: number): number {
  const parsed = Number(value || fallback);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} harus bilangan bulat positif.`);
  }
  return parsed;
}

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
    ombnDatabaseUrl: required("OMBN_DATABASE_URL", source.OMBN_DATABASE_URL),
    dikdasmenDatabaseUrl: required("DIKDASMEN_DATABASE_URL", source.DIKDASMEN_DATABASE_URL),
    redisUrl: required("REDIS_URL", source.REDIS_URL),
    poolSize,
    originBaseUrl,
    originApiKey,
    gradingLockSeconds: Number(source.GRADING_LOCK_SECONDS || 900),
    loginMaxFailures: positiveInt("LOGIN_MAX_FAILURES", source.LOGIN_MAX_FAILURES, 5),
    loginLockSeconds: positiveInt("LOGIN_LOCK_SECONDS", source.LOGIN_LOCK_SECONDS, 300),
    readonlyDatabaseUrl: required("DATABASE_READONLY_URL", source.DATABASE_READONLY_URL),
    integrationBlockDuringExam: source.INTEGRATION_BLOCK_DURING_EXAM !== "false",
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
