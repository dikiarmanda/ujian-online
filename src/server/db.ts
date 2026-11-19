import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";
import { createMariaDbAdapter } from "./mariadb-adapter";

/** Naikkan bila field schema berubah agar instance Prisma di hot-reload diganti. */
const PRISMA_CLIENT_KEY = "exam-many-per-competition-v1";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaClientKey?: string;
};

function createClient(): PrismaClient {
  const config = env();
  return new PrismaClient({
    adapter: createMariaDbAdapter(config.databaseUrl, config.poolSize),
  });
}

function getClient(): PrismaClient {
  if (globalForPrisma.prisma && globalForPrisma.prismaClientKey === PRISMA_CLIENT_KEY) {
    return globalForPrisma.prisma;
  }

  // Client lama (kunci berbeda, biasanya setelah hot-reload di dev): tutup poolnya
  globalForPrisma.prisma?.$disconnect().catch(() => {});

  const client = createClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaClientKey = PRISMA_CLIENT_KEY;
  return client;
}

export const prisma = getClient();