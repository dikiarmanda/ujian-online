import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/current-user";
import { homeForRole } from "@/server/exam-rules";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  redirect(user ? homeForRole(user.role) : "/login");
}
