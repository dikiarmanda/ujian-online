import { getExamStateForParticipant } from "@/server/attempts";
import { json, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["PARTICIPANT"]);
    const { id } = await ctx.params;
    const examId = Number(id);
    if (!Number.isFinite(examId) || examId < 1) return json({ error: "Ujian tidak ditemukan." }, 404);
    return json(await getExamStateForParticipant(examId, user.userId));
  });
}
