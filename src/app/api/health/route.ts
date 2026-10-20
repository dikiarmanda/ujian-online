import { json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ ok: true, timestamp: new Date().toISOString() }, 200);
}
