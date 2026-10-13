import { PrismaClient } from "@/generated/sekolah/client";
import { env } from "./env";
import { createMariaDbAdapter } from "./mariadb-adapter";

const globalForSekolah = globalThis as unknown as { sekolah?: PrismaClient };

function createClient(): PrismaClient {
  const config = env();
  return new PrismaClient({
    adapter: createMariaDbAdapter(config.dikdasmenDatabaseUrl, config.poolSize),
  });
}

export const sekolah = globalForSekolah.sekolah ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForSekolah.sekolah = sekolah;
}
