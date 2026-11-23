import { redis } from "@/server/redis";
import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json();
  const { examId, userId } = body;

  if (!examId || !userId) {
    return json({ error: "Missing examId or userId" }, 400);
  }

  const key = `attempt:${examId}:${userId}`;
  const result = await redis.del(key);

  return json({ success: true, deleted: result, key });
}
