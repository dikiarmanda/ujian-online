import { redis } from "@/server/redis";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const pattern = url.searchParams.get("pattern") || "*";

  const keys = await redis.keys(pattern);
  return json({ keys });
}
