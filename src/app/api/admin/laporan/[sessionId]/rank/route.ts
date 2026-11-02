import { calculateRanks } from "@/server/reports";
import { writeAudit } from "@/server/audit";
import { json, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ sessionId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["ADMIN"]);
    const { sessionId } = await ctx.params;
    const result = await calculateRanks(Number(sessionId));
    await writeAudit({
      userId: user.userId,
      action: "CALCULATE_RANKS",
      entityType: "exam",
      entityId: Number(sessionId),
    });
    return json(result);
  });
}
