import { integrationJson, listIntegrationExams, withIntegration } from "@/server/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withIntegration(req, async (actor) => integrationJson(await listIntegrationExams(actor, new URL(req.url))));
}
