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
    const result = await loginUser(payload, requestIp(req));
    console.log("result", result);
    return json(
      { ok: true, redirect: homeForRole(result.role), name: result.name },
      200,
      { "set-cookie": sessionCookie(result.sid) },
    );
  });
}
