import { integrationJson, readExamId, resultForIdentity, withIntegration } from "@/server/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ examId: string; identity: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return withIntegration(req, async (actor) => {
    const { examId, identity } = await ctx.params;
    return integrationJson(await resultForIdentity(actor, readExamId(examId), identity, new URL(req.url)));
  });
}
