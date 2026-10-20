import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { StatusChip } from "@/components/chrome";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

type SessionTone = "idle" | "live" | "done";

function getExamPhaseState(phase: string, startsAt: Date, endsAt: Date, now: Date): { label: string; tone: SessionTone } {
  if (phase === "RUNNING") return { label: "Berlangsung", tone: "live" };
  if (phase === "ENDED" || now > endsAt) return { label: "Selesai", tone: "done" };
  return { label: "Mendatang", tone: "idle" };
}

function IconPulse({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 12h3.2l2.1-5.5L12.5 18l2.8-6H21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 4.5h6M8 3.5h8a1 1 0 0 1 1 1V6a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect x="5" y="6.5" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 18.5c.7-2.6 2.8-4 5.5-4s4.8 1.4 5.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M15.2 14.2c1.5.4 2.7 1.4 3.3 3.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h12M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-28" aria-label={label}>
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-digits font-semibold text-ink tabular-nums">{clamped}%</span>
        <span className="text-ink-muted">{label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-page">
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  hint,
  icon,
  emphasize,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col justify-between rounded-xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        emphasize
          ? "border-brand/25 bg-brand-soft/70 shadow-sm hover:border-brand/40"
          : "border-line/80 bg-paper shadow-sm hover:border-brand/30 hover:bg-white"
      }`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
        <span
          className={`flex size-9 items-center justify-center rounded-lg transition-colors ${
            emphasize ? "bg-brand text-white" : "bg-page text-brand group-hover:bg-brand-soft"
          }`}>
          {icon}
        </span>
      </div>
      <div className="mt-5">
        <p className="font-digits text-3xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
        <p className="mt-1.5 text-sm leading-snug text-ink-muted group-hover:text-ink">{hint}</p>
      </div>
    </Link>
  );
}

export default async function AdminHome() {
  const user = await requirePageUser(["ADMIN"]);
  const now = new Date();
  const firstName = user.name.trim().split(/\s+/)[0] || user.name;

  const [
    totalExams,
    publishedExams,
    totalSessions,
    activeSessions,
    upcomingSessions,
    totalParticipants,
    totalAttempts,
    completedAttempts,
    pendingGrading,
    sessions,
  ] = await Promise.all([
    prisma.exam.count(),
    prisma.exam.count({ where: { status: "PUBLISHED" } }),
    prisma.exam.count(),
    prisma.exam.count({ where: { phase: "RUNNING" } }),
    prisma.exam.count({ where: { phase: "NOT_STARTED", startsAt: { gt: now } } }),
    prisma.user.count({ where: { role: "PARTICIPANT" } }),
    prisma.examAttempt.count(),
    prisma.examAttempt.count({ where: { status: { in: ["SUBMITTED", "TIME_EXPIRED"] } } }),
    prisma.attemptAnswer.count({ where: { gradingState: "PENDING" } }),
    prisma.exam.findMany({
      include: {
        _count: { select: { attempts: true, packages: true } },
      },
      orderBy: [{ startsAt: "desc" }],
      take: 8,
    }),
  ]);

  const liveSessions = sessions.filter((session) => session.phase === "RUNNING");
  const nextSessions = sessions
    .filter((session) => session.phase === "NOT_STARTED" && session.startsAt > now)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, 2);
  const attentionItems = [
    activeSessions > 0
      ? { href: "/admin/ujian", title: `${activeSessions} ujian sedang berlangsung`, detail: "Pantau kehadiran dan pengerjaan peserta." }
      : null,
    pendingGrading > 0
      ? {
          href: "/admin/laporan",
          title: `${pendingGrading} jawaban uraian menunggu nilai`,
          detail: "Serahkan ke petugas penilai atau cek laporan ujian.",
        }
      : null,
    upcomingSessions > 0 && activeSessions === 0
      ? {
          href: "/admin/ujian",
          title: `${upcomingSessions} ujian mendatang`,
          detail: nextSessions[0]
            ? `Berikutnya: ${nextSessions[0].name} · ${formatJakarta(nextSessions[0].startsAt)}`
            : "Siapkan paket soal sebelum dimulai.",
        }
      : null,
  ].filter(Boolean) as { href: string; title: string; detail: string }[];

  const modules = [
    { href: "/admin/soal", title: "Bank soal", detail: "Pilihan ganda, uraian, dan kunci." },
    { href: "/admin/ujian", title: "Jadwal ujian", detail: "Tanggal, sesi, dan paket soal." },
    { href: "/admin/peserta", title: "Peserta", detail: "Sinkron data dan penugasan sesi." },
    { href: "/admin/laporan", title: "Laporan", detail: "Nilai, Excel, dan PDF." },
  ];

  return (
    <AdminShell name={user.name} current="/admin">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Selamat datang, {firstName}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Ringkas ruang ujian</h1>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-muted">
              Pantau sesi, kehadiran, dan tugas penilaian dari satu tempat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/admin/ujian"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
              Buat ujian
            </Link>
            <Link
              href="/admin/soal/baru"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
              Tambah soal
            </Link>
            <Link
              href="/admin/peserta"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-transparent px-4 text-sm font-semibold text-ink-muted transition hover:bg-paper hover:text-brand">
              Sinkron peserta
            </Link>
          </div>
        </header>

        <section aria-label="Angka ringkas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            href="/admin/ujian"
            label="Sesi aktif"
            value={activeSessions}
            hint={upcomingSessions ? `${upcomingSessions} mendatang` : "Tidak ada jadwal berikutnya"}
            icon={<IconPulse className="size-5" />}
            emphasize={activeSessions > 0}
          />
          <StatCard
            href="/admin/ujian"
            label="Ujian"
            value={totalExams}
            hint={`${publishedExams} diterbitkan · ${totalSessions} sesi`}
            icon={<IconClipboard className="size-5" />}
          />
          <StatCard
            href="/admin/peserta"
            label="Peserta"
            value={totalParticipants}
            hint="Akun peserta terdaftar"
            icon={<IconUsers className="size-5" />}
          />
          <StatCard
            href="/admin/laporan"
            label="Pengerjaan"
            value={totalAttempts}
            hint={`${completedAttempts} sudah dikirim${pendingGrading ? ` · ${pendingGrading} menunggu` : ""}`}
            icon={<IconCheck className="size-5" />}
            emphasize={pendingGrading > 0}
          />
        </section>

        {attentionItems.length > 0 ? (
          <section aria-label="Perlu perhatian" className="overflow-hidden rounded-xl border border-mark-edge/25 bg-mark/40 shadow-sm">
            <div className="border-b border-mark-edge/15 px-5 py-3">
              <h2 className="text-sm font-semibold text-mark-ink">Perlu perhatian</h2>
            </div>
            <ul className="divide-y divide-mark-edge/15">
              {attentionItems.map((item) => (
                <li key={item.title}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-mark/60">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">{item.detail}</p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-mark-ink">
                      Buka
                      <IconArrow className="size-3.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {liveSessions.length > 0 ? (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Sedang berlangsung</h2>
              <p className="mt-0.5 text-sm text-ink-muted">Sesi aktif sekarang — buka untuk memantau kehadiran.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {liveSessions.map((session) => {
                const attendancePct =
                  session._count.attempts > 0
                    ? Math.round((session._count.packages / session._count.attempts) * 100)
                    : 0;
                return (
                  <Link
                    key={session.id}
                    href={`/admin/ujian/${session.id}`}
                    className="rounded-xl border border-brand/20 bg-paper p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <StatusChip label="Berlangsung" tone="live" />
                        <p className="mt-2.5 truncate font-semibold text-ink">{session.name}</p>
                        <p className="text-sm text-ink-muted">{session.name}</p>
                      </div>
                      <p className="shrink-0 text-xs text-ink-muted">sampai {formatJakarta(session.endsAt)}</p>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <ProgressBar value={attendancePct} label="hadir" />
                      <div>
                        <p className="font-digits text-sm font-semibold text-ink tabular-nums">
                          {session._count.attempts}
                          <span className="font-ui text-xs font-normal text-ink-muted"> / {session._count.attempts}</span>
                        </p>
                        <p className="text-xs text-ink-muted">sudah mulai mengerjakan</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Sesi terkini</h2>
              <p className="mt-0.5 text-sm text-ink-muted">Delapan sesi terakhir, dari yang paling baru.</p>
            </div>
            <Link href="/admin/ujian" className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline">
              Semua ujian
              <IconArrow className="size-3.5" />
            </Link>
          </div>

          {sessions.length === 0 ? (
            <div className="relative overflow-hidden rounded-2xl border border-line/80 bg-paper px-6 py-12 text-center shadow-sm sm:px-10">
              <div
                className="pointer-events-none absolute inset-0 opacity-70"
                style={{
                  background:
                    "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--color-brand) 14%, transparent), transparent 70%)",
                }}
                aria-hidden="true"
              />
              <div className="relative mx-auto flex max-w-md flex-col items-center">
                <span className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <IconClipboard className="size-7" />
                </span>
                <p className="text-lg font-semibold text-ink">Belum ada sesi ujian</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Mulai dengan membuat ujian, lalu atur jadwal sesi dan tugaskan peserta. Ringkasan kehadiran akan muncul di sini.
                </p>
                <ol className="mt-6 w-full space-y-2 text-left text-sm text-ink-muted">
                  {["Buat ujian & paket soal", "Jadwalkan sesi", "Tugaskan peserta"].map((step, i) => (
                    <li key={step} className="flex items-center gap-3 rounded-lg bg-page/80 px-3 py-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
                <Link
                  href="/admin/ujian"
                  className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                  Mulai dari ujian pertama
                </Link>
              </div>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3 md:hidden">
                {sessions.map((session) => {
                  const state = getExamPhaseState(session.phase, session.startsAt, session.endsAt, now);
                  const attendancePct =
                    session._count.attempts > 0
                      ? Math.round((session._count.packages / session._count.attempts) * 100)
                      : 0;
                  return (
                    <li key={session.id} className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <StatusChip label={state.label} tone={state.tone} />
                        <span className="text-xs text-ink-muted">{session.durationMinutes} mnt</span>
                      </div>
                      <Link href={`/admin/ujian/${session.id}`} className="mt-2 block font-semibold text-ink hover:text-brand">
                        {session.name}
                      </Link>
                      <p className="text-sm text-ink-muted">{session.name}</p>
                      <p className="mt-2 text-xs text-ink-muted">{formatJakarta(session.startsAt)}</p>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <ProgressBar value={attendancePct} label={`${session._count.packages}/${session._count.attempts} hadir`} />
                        <div className="flex gap-3">
                          <Link href={`/admin/ujian/${session.id}`} className="text-xs font-semibold text-brand">
                            Kelola
                          </Link>
                          <Link href={`/admin/laporan/${session.id}`} className="text-xs font-semibold text-ink-muted hover:text-brand">
                            Laporan
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="hidden overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-page/80 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Ujian & sesi</th>
                      <th className="px-4 py-3.5">Jadwal</th>
                      <th className="px-4 py-3.5">Kehadiran</th>
                      <th className="px-4 py-3.5">Pengerjaan</th>
                      <th className="px-4 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {sessions.map((session) => {
                      const state = getExamPhaseState(session.phase, session.startsAt, session.endsAt, now);
                      const attendancePct =
                        session._count.attempts > 0
                          ? Math.round((session._count.packages / session._count.attempts) * 100)
                          : 0;
                      return (
                        <tr key={session.id} className="transition-colors hover:bg-brand-soft/25">
                          <td className="px-4 py-3.5">
                            <StatusChip label={state.label} tone={state.tone} />
                          </td>
                          <td className="px-4 py-3.5">
                            <Link href={`/admin/ujian/${session.id}`} className="font-semibold text-ink hover:text-brand">
                              {session.name}
                            </Link>
                            <span className="block text-xs text-ink-muted">{session.name}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-ink">{formatJakarta(session.startsAt)}</span>
                            <span className="block text-xs text-ink-muted">{session.durationMinutes} menit</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <ProgressBar
                              value={attendancePct}
                              label={`${session._count.packages}/${session._count.attempts}`}
                            />
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-digits font-semibold text-ink tabular-nums">{session._count.attempts}</span>
                            <span className="block text-xs text-ink-muted">mulai mengerjakan</span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/admin/ujian/${session.id}`}
                                className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                                Kelola
                              </Link>
                              <Link
                                href={`/admin/laporan/${session.id}`}
                                className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white">
                                Laporan
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Lanjut ke modul</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Pintasan ke pekerjaan harian admin.</p>
          <nav className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {modules.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex flex-col rounded-xl border border-line/80 bg-paper p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink group-hover:text-brand">{item.title}</p>
                  <IconArrow className="size-3.5 text-ink-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-brand" />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{item.detail}</p>
              </Link>
            ))}
          </nav>
        </section>
      </div>
    </AdminShell>
  );
}
