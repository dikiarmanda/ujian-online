import { revokeClientKey } from "@/server/api-clients";
import { AppError } from "@/server/errors";
import { json, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; keyId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["ADMIN"]);
    const { id, keyId } = await ctx.params;
    const clientId = Number(id);
    const key = Number(keyId);
    if (!Number.isInteger(clientId) || clientId < 1 || !Number.isInteger(key) || key < 1) {
      throw new AppError("Kunci tidak ditemukan.", 404);
    }
    await revokeClientKey(user.userId, clientId, key, requestIp(req));
    return json({ ok: true });
  });
}
