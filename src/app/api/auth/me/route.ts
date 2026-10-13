import { json, requireApiUser, withErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return withErrors(async () => {
    const user = await requireApiUser(req);
    return json({ id: user.userId, name: user.name, role: user.role });
  });
}
