import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Rute lama berbasis sesi; arahkan ke beranda peserta. */
export default async function SesiPesertaRedirect() {
  redirect("/peserta");
}
