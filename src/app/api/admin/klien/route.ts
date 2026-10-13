import { createApiClient } from "@/server/api-clients";
import { json, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["ADMIN"]);
    const client = await createApiClient(user.userId, await req.json().catch(() => null), requestIp(req));
    return json({ id: client.id });
  });
}
