import Link from "next/link";
import { headers } from "next/headers";
import os from "os";
import { AppBar, AppFooter, StatusChip } from "@/components/chrome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
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
        <AppBar title="Ujian" name={user.name} role={user.role} />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/60 bg-paper p-12 text-center">
            <FontAwesomeIcon icon={Icon.InfoCircle} className="mb-4 size-16 text-ink-muted" />
            <h3 className="text-lg font-semibold text-ink">Data Lomba Tidak Ditemukan</h3>
            <p className="mt-2 max-w-sm text-sm text-ink-muted">Competition peserta tidak ditemukan pada sesi login. Silakan masuk ulang atau hubungi panitia.</p>
          </div>
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
      <AppBar title="Ujian" name={user.name} role={user.role} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Selamat datang, {user.name}!</h1>
          <p className="mt-2 text-sm text-ink-muted">Berikut adalah informasi lomba dan status ujian Anda.</p>
        </div>

        {/* Data Peserta Card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-line/80 bg-white shadow-sm">
          <div className="border-b border-line/70 bg-gradient-to-r from-brand-soft to-brand-soft/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-brand text-white">
                <FontAwesomeIcon icon={Icon.User} className="size-5" />
              </div>
              <h2 className="text-lg font-semibold text-ink">Data Peserta</h2>
            </div>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <div className="rounded-xl bg-page/50 p-4">
              <p className="mb-1 text-xs font-semibold text-ink-muted uppercase tracking-wider">Nama</p>
              <p className="font-semibold text-ink">{user.name}</p>
            </div>
            <div className="rounded-xl bg-page/50 p-4">
              <p className="mb-1 text-xs font-semibold text-ink-muted uppercase tracking-wider">Nomor Peserta</p>
              <p className="font-digits font-semibold text-ink">{user.identity}</p>
            </div>
            <div className="rounded-xl bg-page/50 p-4">
              <p className="mb-1 text-xs font-semibold text-ink-muted uppercase tracking-wider">Jenjang</p>
              <span className="inline-flex rounded-lg bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">{user.jenjangGroup || "—"}</span>
            </div>
          </div>
        </div>

        {/* Data Lomba Card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-line/80 bg-white shadow-sm">
          <div className="border-b border-line/70 bg-gradient-to-r from-mark to-mark/50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-mark text-mark-ink">
                <FontAwesomeIcon icon={Icon.GraduationCap} className="size-5" />
              </div>
              <h2 className="text-lg font-semibold text-ink">Data Lomba</h2>
            </div>
          </div>
          <div className="p-6">
            {competitionError ? (
              <div className="flex items-center gap-3 rounded-xl bg-alert/10 p-4">
                <FontAwesomeIcon icon={Icon.ExclamationCircle} className="size-5 shrink-0 text-alert" />
                <p className="text-sm text-alert">{competitionError}</p>
              </div>
            ) : competition ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-page/50 p-4">
                  <p className="mb-1 text-xs font-semibold text-ink-muted uppercase tracking-wider">Nama Lomba</p>
                  <p className="font-semibold text-ink">{competition.name}</p>
                </div>
                <div className="rounded-xl bg-page/50 p-4">
                  <p className="mb-1 text-xs font-semibold text-ink-muted uppercase tracking-wider">Jenjang Lomba</p>
                  <div className="flex flex-wrap gap-2">
                    {competition.jenjangGroups.map((group) => (
                      <span key={group} className="inline-flex rounded-lg bg-page px-3 py-1 text-sm font-semibold text-ink">
                        {group}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <FontAwesomeIcon icon={Icon.Refresh} className="size-4 animate-spin" />
                <p>Memuat data lomba...</p>
              </div>
            )}
          </div>
        </div>

        {/* Status Ujian Card */}
        <div className="mb-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">Status Ujian</h2>
          {!exam ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong/60 bg-page/40 p-12 text-center">
              <FontAwesomeIcon icon={Icon.Calendar} className="mb-4 size-16 text-ink-muted" />
              <h3 className="text-lg font-semibold text-ink">Belum Ada Ujian</h3>
              <p className="mt-2 max-w-sm text-sm text-ink-muted">Ujian untuk lomba Anda belum tersedia. Silakan cek kembali nanti.</p>
            </div>
          ) : exam.status !== "PUBLISHED" ? (
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full bg-page">
                  <FontAwesomeIcon icon={Icon.Clock} className="size-6 text-ink-muted" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-ink">{exam.name}</h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    Status: <span className="font-semibold">{exam.status === "DRAFT" ? "Draf" : exam.status === "ARCHIVED" ? "Arsip" : exam.status}</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line/80 bg-white shadow-sm">
              <div className="border-b border-line/70 bg-gradient-to-r from-brand to-brand/80 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-full bg-white text-brand">
                      <FontAwesomeIcon icon={Icon.CheckCircle} className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{exam.name}</h3>
                      <p className="text-xs text-white/80">
                        {formatJakarta(exam.startsAt)} · {exam.durationMinutes} menit
                      </p>
                    </div>
                  </div>
                  <StatusChip label={status} tone={tone} />
                </div>
              </div>
              <div className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={Icon.Clock} className="size-4 text-ink-muted" />
                      <span className="text-ink-muted">Jadwal:</span>
                      <span className="font-semibold text-ink">{formatJakarta(exam.startsAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FontAwesomeIcon icon={Icon.Hourglass} className="size-4 text-ink-muted" />
                      <span className="text-ink-muted">Durasi:</span>
                      <span className="font-digits font-semibold text-ink">{exam.durationMinutes} menit</span>
                    </div>
                  </div>
                  {attempt?.attendedAt ? (
                    <Link href={`/peserta/ujian/${exam.id}`} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-sm transition ${status === "Selesai" ? "bg-gray-300 text-ink-muted cursor-not-allowed pointer-events-none" : "bg-brand text-white hover:brightness-110 hover:shadow-md"}`} aria-disabled={status === "Selesai"} tabIndex={status === "Selesai" ? -1 : 0}>
                      <FontAwesomeIcon icon={Icon.ArrowRight} className="size-5" />
                      Lanjut ke Ujian
                    </Link>
                  ) : (
                    <Link href={`/peserta/ujian/${exam.id}`} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold shadow-sm transition ${status === "Selesai" ? "bg-gray-300 text-ink-muted cursor-not-allowed pointer-events-none" : "bg-brand text-white hover:brightness-110 hover:shadow-md"}`} aria-disabled={status === "Selesai"} tabIndex={status === "Selesai" ? -1 : 0}>
                      <FontAwesomeIcon icon={Icon.Home} className="size-5" />
                      Masuk Waiting Room
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <AppFooter host={hostname} user={`${user.name} (${user.identity})`} ip={ip} />
    </div>
  );
}
