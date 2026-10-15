import { writeFileSync } from "node:fs";
import RedisMemoryServer from "redis-memory-server";

const Server = RedisMemoryServer.default || RedisMemoryServer;
const server = new Server({ instance: { port: 6379, ip: "127.0.0.1" } });
await server.start();
const host = await server.getHost();
const port = await server.getPort();
writeFileSync("/tmp/redis-mem.json", JSON.stringify({ host, port }));
console.log(`REDIS_URL=redis://${host}:${port}`);
setInterval(() => {}, 60_000);
