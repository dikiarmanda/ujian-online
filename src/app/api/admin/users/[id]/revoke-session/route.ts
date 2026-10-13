import { revokeUserSession } from "@/server/auth/service";
import { AppError } from "@/server/errors";
import { json, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const actor = await requireApiUser(req, ["ADMIN"]);
    const { id } = await ctx.params;
    const userId = Number(id);
    if (!Number.isInteger(userId) || userId < 1) {
      throw new AppError("Pengguna tidak ditemukan.", 404);
    }
    await revokeUserSession(actor.userId, userId, requestIp(req));
    return json({ ok: true });
  });
}
