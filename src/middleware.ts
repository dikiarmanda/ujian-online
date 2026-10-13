import { NextResponse, type NextRequest } from "next/server";

const SESSION_MAX_AGE = 60 * 60 * 12;

export function middleware(request: NextRequest) {
  const sid = request.cookies.get("sid")?.value;
  if (!sid) return NextResponse.next();
  const response = NextResponse.next();
  response.cookies.set("sid", sid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
};
