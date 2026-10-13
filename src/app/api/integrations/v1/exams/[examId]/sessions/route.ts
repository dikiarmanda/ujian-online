import { integrationJson, listIntegrationSessions, readExamId, withIntegration } from "@/server/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ examId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return withIntegration(req, async (actor) => {
    const { examId } = await ctx.params;
    return integrationJson(await listIntegrationSessions(actor, readExamId(examId)));
  });
}
