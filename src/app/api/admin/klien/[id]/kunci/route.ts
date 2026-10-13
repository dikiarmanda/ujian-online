import { createClientKey } from "@/server/api-clients";
import { AppError } from "@/server/errors";
import { json, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["ADMIN"]);
    const { id } = await ctx.params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId) || clientId < 1) throw new AppError("Klien tidak ditemukan.", 404);
    const created = await createClientKey(user.userId, clientId, await req.json().catch(() => ({})), requestIp(req));
    return json(created);
  });
}
