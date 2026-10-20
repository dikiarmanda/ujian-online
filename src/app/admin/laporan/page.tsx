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

function getExamStatus(phase: string, startsAt: Date, endsAt: Date, now: Date): "live" | "upcoming" | "done" {
  if (phase === "RUNNING") return "live";
  if (phase === "ENDED" || now > endsAt) return "done";
  if (now < startsAt) return "upcoming";
  return "upcoming";
}

export default async function LaporanIndexPage() {
  const user = await requirePageUser(["ADMIN"]);
  const now = new Date();

  const [exams, submittedCount] = await Promise.all([
    prisma.exam.findMany({
      include: {
        _count: { select: { attempts: true } },
      },
      orderBy: { startsAt: "desc" },
    }),
    prisma.examAttempt.count({ where: { status: { in: ["SUBMITTED", "TIME_EXPIRED"] } } }),
  ]);

  const attendedCounts = await prisma.examAttempt.groupBy({
    by: ["examId"],
    where: { attendedAt: { not: null } },
    _count: { _all: true },
  });
  const attendedMap = new Map(attendedCounts.map((row) => [row.examId, row._count._all]));

  const live = exams.filter((exam) => getExamStatus(exam.phase, exam.startsAt, exam.endsAt, now) === "live").length;
  const upcoming = exams.filter((exam) => getExamStatus(exam.phase, exam.startsAt, exam.endsAt, now) === "upcoming").length;
  const done = exams.filter((exam) => getExamStatus(exam.phase, exam.startsAt, exam.endsAt, now) === "done").length;

  return (
    <AdminShell name={user.name} current="/admin/laporan">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Hasil & unduhan</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Laporan</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Pantau kehadiran, nilai, dan unduh rekap Excel atau PDF per ujian.
            </p>
          </div>
          <Link
            href="/admin/ujian"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper px-5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
            Kelola ujian
          </Link>
        </header>

        <section aria-label="Ringkasan laporan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total ujian" value={exams.length} hint="Semua ujian terdaftar" />
          <StatCard label="Berlangsung" value={live} hint={live ? "Pantau kehadiran sekarang" : "Tidak ada ujian aktif"} />
          <StatCard label="Mendatang" value={upcoming} hint="Belum dimulai" />
          <StatCard label="Terkirim" value={submittedCount} hint={`${done} ujian sudah selesai`} />
        </section>

        <LaporanPanel
          sessions={exams.map((exam) => ({
            id: exam.id,
            examName: exam.name,
            sessionName: exam.phase,
            startsAtLabel: formatJakarta(exam.startsAt),
            endsAtLabel: formatJakarta(exam.endsAt),
            durationMinutes: exam.durationMinutes,
            participantCount: exam._count.attempts,
            attendanceCount: attendedMap.get(exam.id) ?? 0,
            attemptCount: exam._count.attempts,
            status: getExamStatus(exam.phase, exam.startsAt, exam.endsAt, now),
          }))}
        />
      </div>
    </AdminShell>
  );
}
