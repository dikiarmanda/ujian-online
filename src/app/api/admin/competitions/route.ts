import { listAvailableCompetitions } from "@/server/competitions";
import { json, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withErrors(async () => {
    await requireApiUser(req, ["ADMIN"]);
    const data = await listAvailableCompetitions();
    return json({ data });
  });
}
