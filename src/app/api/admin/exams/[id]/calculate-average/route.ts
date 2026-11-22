import { calculateExamAverage } from "@/server/exams";
import { json, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["ADMIN", "GRADER"]);
    const { id } = await ctx.params;
    const examId = Number(id);
    const result = await calculateExamAverage(examId, user.userId, requestIp(req));
    return json({ examId, averageScore: result.averageScore, participantCount: result.participantCount });
  });
}
