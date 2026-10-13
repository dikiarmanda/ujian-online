import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";
import { createMariaDbAdapter } from "./mariadb-adapter";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const config = env();
  return new PrismaClient({
    adapter: createMariaDbAdapter(config.databaseUrl, config.poolSize),
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
