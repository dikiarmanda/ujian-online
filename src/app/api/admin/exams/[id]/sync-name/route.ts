import { syncExamNameFromCompetition } from "@/server/competitions";
import { writeAudit } from "@/server/audit";
import { json, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["ADMIN"]);
    const { id } = await ctx.params;
    const examId = Number(id);
    const name = await syncExamNameFromCompetition(examId);
    await writeAudit({
      userId: user.userId,
      action: "SYNC_EXAM_NAME",
      entityType: "exam",
      entityId: examId,
      ipAddress: requestIp(req),
      meta: { name },
    });
    return json({ name });
  });
}
