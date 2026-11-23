import { redis } from "@/server/redis";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const { key } = body;

  if (!key) {
    return json({ error: "Missing 'key' parameter" }, 400);
  }

  const result = await redis.del(key);
  return json({ success: true, deleted: result });
}
