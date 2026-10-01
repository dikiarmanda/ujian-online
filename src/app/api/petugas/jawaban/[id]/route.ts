import { claimAnswer, gradeAnswer, graderView } from "@/server/grading";
import { json, requestIp, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["GRADER", "ADMIN"]);
    const { id } = await ctx.params;
    return json(await graderView(Number(id), user.userId));
  });
}

export async function POST(req: Request, ctx: Ctx) {
  return withErrors(async () => {
    const user = await requireApiUser(req, ["GRADER"]);
    const { id } = await ctx.params;
    const body = (await req.json()) as { intent?: string };
    if (body.intent === "klaim") return json(await claimAnswer(Number(id), user.userId));
    if (body.intent === "nilai") {
      return json(await gradeAnswer(Number(id), user.userId, body, requestIp(req)).then(() => ({ ok: true })));
    }
    return json({ error: "Tindakan tidak dikenal." }, 404);
  });
}
