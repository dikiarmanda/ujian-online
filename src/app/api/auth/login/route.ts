import { loginUser } from "@/server/auth/service";
import { assertMutationOrigin, json, requestIp, withErrors } from "@/server/http";
import { sessionCookie } from "@/server/session";
import { homeForRole } from "@/server/exam-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return withErrors(async () => {
    assertMutationOrigin(req);
    const payload: unknown = await req.json().catch(() => null);
    console.log("[LOGIN] Attempt from IP:", requestIp(req), "Payload:", payload);
    const result = await loginUser(payload, requestIp(req));
    console.log("[LOGIN] Success - User:", result.name, "Role:", result.role, "IP:", requestIp(req));
    return json(
      { ok: true, redirect: homeForRole(result.role), name: result.name },
      200,
      { "set-cookie": sessionCookie(result.sid) },
    );
  });
}
