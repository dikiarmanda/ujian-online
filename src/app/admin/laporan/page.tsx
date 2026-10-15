import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { LaporanPanel } from "@/components/laporan-panel";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-digits text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}

function getSessionStatus(startsAt: Date, endsAt: Date, now: Date): "live" | "upcoming" | "done" {
  if (now >= startsAt && now <= endsAt) return "live";
  if (now < startsAt) return "upcoming";
  return "done";
}

export default async function LaporanIndexPage() {
  const user = await requirePageUser(["ADMIN"]);
  const now = new Date();

  const [sessions, submittedCount] = await Promise.all([
    prisma.examSession.findMany({
      include: {
        exam: { select: { name: true, durationMinutes: true } },
        _count: { select: { participants: true, attendances: true, attempts: true } },
      },
      orderBy: { startsAt: "desc" },
    }),
    prisma.examAttempt.count({ where: { status: { in: ["SUBMITTED", "TIME_EXPIRED"] } } }),
  ]);

  const live = sessions.filter((session) => getSessionStatus(session.startsAt, session.endsAt, now) === "live").length;
  const upcoming = sessions.filter((session) => getSessionStatus(session.startsAt, session.endsAt, now) === "upcoming").length;
  const done = sessions.filter((session) => getSessionStatus(session.startsAt, session.endsAt, now) === "done").length;

  return (
    <AdminShell name={user.name} current="/admin/laporan">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Hasil & unduhan</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Laporan</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Pantau kehadiran, nilai, dan unduh rekap Excel atau PDF per sesi ujian.
            </p>
          </div>
          <Link
            href="/admin/ujian"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper px-5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
            Kelola ujian
          </Link>
        </header>

        <section aria-label="Ringkasan laporan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total sesi" value={sessions.length} hint="Semua sesi terdaftar" />
          <StatCard label="Berlangsung" value={live} hint={live ? "Pantau kehadiran sekarang" : "Tidak ada sesi aktif"} />
          <StatCard label="Mendatang" value={upcoming} hint="Belum dimulai" />
          <StatCard label="Terkirim" value={submittedCount} hint={`${done} sesi sudah selesai`} />
        </section>

        <LaporanPanel
          sessions={sessions.map((session) => ({
            id: session.id,
            examName: session.exam.name,
            sessionName: session.name,
            startsAtLabel: formatJakarta(session.startsAt),
            endsAtLabel: formatJakarta(session.endsAt),
            durationMinutes: session.exam.durationMinutes,
            participantCount: session._count.participants,
            attendanceCount: session._count.attendances,
            attemptCount: session._count.attempts,
            status: getSessionStatus(session.startsAt, session.endsAt, now),
          }))}
        />
      </div>
    </AdminShell>
  );
}
