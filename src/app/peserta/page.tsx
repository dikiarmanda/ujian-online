import Link from "next/link";
import { headers } from "next/headers";
import os from "os";
import { AppBar, AppFooter, StatusChip } from "@/components/chrome";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatJakarta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PesertaHome() {
  const user = await requirePageUser(["PARTICIPANT"]);
  const headerList = await headers();
  const hostname = os.hostname();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "127.0.0.1";

  if (!user.competitionId) {
    return (
      <div className="flex min-h-screen flex-col bg-page">
        <AppBar title="Ujian Anda" name={user.name} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <p className="rounded-md border border-line bg-paper p-6 text-sm text-ink-muted shadow-paper">
            Competition peserta tidak ditemukan pada sesi login. Masuk ulang atau hubungi panitia.
          </p>
        </main>
        <AppFooter host={hostname} user={`${user.name} (${user.identity})`} ip={ip} />
      </div>
    );
  }

  const exam = await prisma.exam.findUnique({
    where: { competitionId: user.competitionId },
    include: {
      attempts: { where: { userId: user.userId }, take: 1 },
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AppBar title="Ujian Anda" name={user.name} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <p className="mb-6 text-ink-muted">Pilih ujian yang terhubung dengan lomba Anda.</p>
        <ul className="flex flex-col gap-3">
          {!exam || exam.status !== "PUBLISHED" ? (
            <li className="rounded-md border border-line bg-paper p-6 text-sm text-ink-muted shadow-paper">Belum ada ujian aktif untuk lomba Anda.</li>
          ) : (
            (() => {
              const attempt = exam.attempts[0];
              let status = "Belum absen";
              let tone: "idle" | "live" | "done" | "warn" = "warn";
              if (attempt?.attendedAt) {
                status = "Sudah absen";
                tone = "idle";
              }
              if (attempt?.status === "IN_PROGRESS" && attempt.startedAt) {
                status = "Mengerjakan";
                tone = "live";
              }
              if (attempt && attempt.status !== "IN_PROGRESS") {
                status = "Selesai";
                tone = "done";
              }
              return (
                <li>
                  <Link
                    href={`/peserta/ujian/${exam.id}`}
                    className="flex items-center justify-between gap-4 rounded-md border border-line bg-paper p-4 shadow-paper hover:border-brand">
                    <span>
                      <span className="block font-semibold">{exam.name}</span>
                      <span className="mt-1 block text-sm text-ink-muted">
                        {formatJakarta(exam.startsAt)} · {exam.durationMinutes} menit
                      </span>
                    </span>
                    <StatusChip label={status} tone={tone} />
                  </Link>
                </li>
              );
            })()
          )}
        </ul>
      </main>
      <AppFooter host={hostname} user={`${user.name} (${user.identity})`} ip={ip} />
    </div>
  );
}
