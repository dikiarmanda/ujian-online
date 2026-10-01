import { writeAudit } from "@/server/audit";
import { assertMutationOrigin, json, requestIp, withErrors } from "@/server/http";
import { clearSessionCookie, destroySession, readCookie, readSession } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withErrors(async () => {
    assertMutationOrigin(req);
    const sid = readCookie(req, "sid");
    if (sid) {
      const session = await readSession(sid);
      await destroySession(sid);
      if (session) {
        await writeAudit({
          userId: session.userId,
          action: "LOGOUT",
          entityType: "user",
          entityId: session.userId,
          ipAddress: requestIp(req),
        });
      }
    }
    return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
  });
}
