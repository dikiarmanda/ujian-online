import Link from "next/link";
import { headers } from "next/headers";
import os from "os";
import { AppBar, AppFooter, StatusChip } from "@/components/chrome";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatJakarta } from "@/lib/format";
import { getCompetitionById } from "@/server/competitions";

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

  let competition = null;
  let competitionError = null;
  try {
    competition = await getCompetitionById(user.competitionId);
  } catch (error) {
    competitionError = error instanceof Error ? error.message : "Gagal memuat data lomba.";
  }

  const exam = await prisma.exam.findUnique({
    where: { competitionId: user.competitionId },
    include: {
      attempts: { where: { userId: user.userId }, take: 1 },
    },
  });

  const attempt = exam?.attempts[0];
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

  const isExamValid = exam && exam.status === "PUBLISHED";

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AppBar title="Ujian Anda" name={user.name} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="mb-8 rounded-xl border border-line/80 bg-paper p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">Data Peserta</h2>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-muted">Nama</span>
              <span className="font-semibold text-ink">{user.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Nomor Peserta</span>
              <span className="font-digits font-semibold text-ink">{user.identity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-muted">Jenjang</span>
              <span className="font-semibold text-ink">{user.jenjangGroup || "—"}</span>
            </div>
          </div>
        </div>

        <div className="mb-8 rounded-xl border border-line/80 bg-paper p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">Data Lomba</h2>
          {competitionError ? (
            <p className="text-sm text-alert">{competitionError}</p>
          ) : competition ? (
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Nama Lomba</span>
                <span className="font-semibold text-ink">{competition.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">ID Lomba</span>
                <span className="font-digits font-semibold text-ink">#{competition.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Jenjang Lomba</span>
                <span className="font-semibold text-ink">{competition.jenjangGroups.join(", ") || "—"}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Memuat data lomba...</p>
          )}
        </div>

        <div className="mb-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">Status Ujian</h2>
          {!exam ? (
            <p className="rounded-md border border-line bg-paper p-6 text-sm text-ink-muted shadow-paper">
              Belum ada ujian untuk lomba Anda.
            </p>
          ) : exam.status !== "PUBLISHED" ? (
            <p className="rounded-md border border-line bg-paper p-6 text-sm text-ink-muted shadow-paper">
              Ujian belum aktif. Status: {exam.status === "DRAFT" ? "Draf" : exam.status === "ARCHIVED" ? "Arsip" : exam.status}
            </p>
          ) : (
            <div className="rounded-md border border-line bg-paper p-6 shadow-paper">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <span className="block font-semibold text-ink">{exam.name}</span>
                  <span className="mt-1 block text-sm text-ink-muted">
                    {formatJakarta(exam.startsAt)} · {exam.durationMinutes} menit
                  </span>
                </div>
                <StatusChip label={status} tone={tone} />
              </div>
              {attempt?.attendedAt ? (
                <Link
                  href={`/peserta/ujian/${exam.id}`}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                  Lanjut ke Ujian
                </Link>
              ) : (
                <Link
                  href={`/peserta/ujian/${exam.id}`}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                  Masuk Waiting Room
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
      <AppFooter host={hostname} user={`${user.name} (${user.identity})`} ip={ip} />
    </div>
  );
}
