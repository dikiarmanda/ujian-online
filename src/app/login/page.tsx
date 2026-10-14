import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/server/current-user";
import { homeForRole } from "@/server/exam-rules";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(280px,0.9fr)_1.1fr]">
      <section className="flex flex-col justify-between bg-brand px-8 py-10 text-white">
        <img src="/brand/logo-dikdas-w.png" alt="Logo Majelis Dikdasmen dan PNF PP Muhammadiyah" className="w-32 h-auto" />
        <div>
          <p className="text-sm text-white/80">Ujian online</p>
          <h1 className="mt-2 max-w-sm text-xl font-semibold leading-snug">Majelis Dikdasmen dan PNF PP Muhammadiyah</h1>
        </div>
        <p className="text-xs text-white/75">© Majelis Dikdasmen dan PNF PP Muhammadiyah</p>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-md border border-line bg-paper p-8 shadow-paper">
          <h2 className="text-lg font-semibold">Masuk</h2>
          <p className="mt-1 text-sm text-ink-muted">Nomor peserta atau email.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
