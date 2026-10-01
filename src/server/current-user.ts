import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AppRole } from "./exam-rules";
import { homeForRole } from "./exam-rules";
import { readSession, type SessionRecord } from "./session";

export async function getCurrentUser(): Promise<SessionRecord | null> {
  const jar = await cookies();
  const sid = jar.get("sid")?.value;
  if (!sid) return null;
  return readSession(sid);
}

export async function requirePageUser(roles?: AppRole[]): Promise<SessionRecord> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeForRole(user.role));
  return user;
}
