import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppFooter } from "@/components/chrome";
import { LoginForm } from "@/components/login-form";
import { NetworkQualityIndicator } from "@/components/network-quality";
import { getCurrentUser } from "@/server/current-user";
import { homeForRole } from "@/server/exam-rules";
import { checkRedisConnection } from "@/server/redis";
import os from "os";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeForRole(user.role));

  const headerList = await headers();
  const hostname = os.hostname();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "127.0.0.1";
  const redisConnected = await checkRedisConnection();

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <main className="grid flex-1 lg:grid-cols-[minmax(280px,0.9fr)_1.1fr]">
        <section className="flex flex-col justify-between bg-brand px-8 py-10 text-white">
          <img src="/brand/logo-dikdas-w.png" alt="Logo Majelis Dikdasmen dan PNF PP Muhammadiyah" className="h-auto w-32" />
          <div>
            <p className="text-sm text-white/80">Ujian online</p>
            <h1 className="mt-2 max-w-sm text-xl font-semibold leading-snug">Majelis Dikdasmen dan PNF PP Muhammadiyah</h1>
          </div>
          {redisConnected && <p className="text-xs text-white/75">Siapkan nomor peserta untuk masuk.</p>}
        </section>
        <section className="flex items-center justify-center px-6 py-12">
          <div className="absolute right-6 top-6 rounded-md bg-brand p-2">
            <NetworkQualityIndicator />
          </div>
          <div className="w-full max-w-md rounded-md border border-line bg-paper p-8 shadow-paper">
            <h2 className="text-lg font-semibold">Masuk</h2>
            <p className="mt-1 text-sm text-ink-muted">Nomor peserta atau email.</p>
            <LoginForm />
          </div>
        </section>
      </main>
      <AppFooter host={hostname} user="belum masuk" ip={ip} />
    </div>
  );
}
