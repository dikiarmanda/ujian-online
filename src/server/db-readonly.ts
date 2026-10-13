import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";
import { createMariaDbAdapter } from "./mariadb-adapter";

const globalForReadonly = globalThis as unknown as { prismaReadonly?: PrismaClient };

function createClient(): PrismaClient {
  const config = env();
  return new PrismaClient({
    adapter: createMariaDbAdapter(config.readonlyDatabaseUrl, config.poolSize),
  });
}

export const prismaReadonly = globalForReadonly.prismaReadonly ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForReadonly.prismaReadonly = prismaReadonly;
}
