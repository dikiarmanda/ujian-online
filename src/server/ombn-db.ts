import { PrismaClient } from "@/generated/ombn/client";
import { env } from "./env";
import { createMariaDbAdapter } from "./mariadb-adapter";

const globalForOmbn = globalThis as unknown as { ombn?: PrismaClient };

function createClient(): PrismaClient {
  const config = env();
  return new PrismaClient({
    adapter: createMariaDbAdapter(config.ombnDatabaseUrl, config.poolSize),
  });
}

export const ombn = globalForOmbn.ombn ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForOmbn.ombn = ombn;
}
