import { loginUser } from "@/server/auth/service";
import { assertMutationOrigin, json, requestIp, withErrors } from "@/server/http";
import { homeForRole } from "@/server/exam-rules";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_TTL_SECONDS = 60 * 60 * 3;

export async function POST(req: Request) {
  return withErrors(async () => {
    assertMutationOrigin(req);
    const payload: unknown = await req.json().catch(() => null);
    console.log("[LOGIN] Attempt from IP:", requestIp(req), "Payload:", payload);
    const result = await loginUser(payload, requestIp(req));
    console.log("[LOGIN] Success - User:", result.name, "Role:", result.role, "IP:", requestIp(req));

    const useSecure = process.env.COOKIE_SECURE === "true" || (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");

    const response = NextResponse.json(
      { ok: true, redirect: homeForRole(result.role), name: result.name },
      { status: 200 }
    );

    response.cookies.set("sid", result.sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: useSecure,
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  });
}
