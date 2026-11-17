import { writeAudit } from "@/server/audit";
import { logEvent } from "@/server/logger";
import { assertMutationOrigin, requestIp, withErrors } from "@/server/http";
import { destroySession, readCookie, readSession } from "@/server/session";
import { NextResponse } from "next/server";

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
        logEvent("logout", {
          userId: session.userId,
          role: session.role === "PARTICIPANT" ? "peserta" : "admin",
          ip: requestIp(req),
        });
      }
    }

    const useSecure = process.env.COOKIE_SECURE === "true" || (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");

    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set("sid", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecure,
      path: "/",
      maxAge: 0,
    });

    return response;
  });
}
