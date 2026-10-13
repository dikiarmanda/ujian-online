import { PrismaMariaDb } from "@prisma/adapter-mariadb";

export function createMariaDbAdapter(databaseUrl: string, poolSize: number) {
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: poolSize,
    charset: "utf8mb4",
    allowPublicKeyRetrieval: true,
  });
}
