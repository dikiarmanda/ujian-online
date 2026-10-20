import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Sesi dihapus; arahkan ke daftar ujian. */
export default async function SesiRedirectPage() {
  redirect("/admin/ujian");
}
