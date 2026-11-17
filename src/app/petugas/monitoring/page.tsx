import { PetugasShell } from "@/components/petugas-shell";
import { PaginatedDataTable } from "@/components/data-table";
import { MonitoringFilterForm } from "@/components/monitoring-filter";
import { formatJakarta } from "@/lib/format";
import { getAksesLomba } from "@/server/akses-lomba";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { getExamParticipantCounts, getOmbnPesertaCount } from "@/server/exams";

export const dynamic = "force-dynamic";

const attemptStatusMeta: Record<string, { label: string; className: string }> = {
  IN_PROGRESS: { label: "Mengerjakan", className: "bg-brand-soft text-brand" },
  SUBMITTED: { label: "Terkirim", className: "bg-page text-ink-muted" },
  TIME_EXPIRED: { label: "Waktu habis", className: "bg-mark text-mark-ink" },
};

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-digits text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}

const PHASE_LABEL: Record<string, string> = {
  NOT_STARTED: "Belum mulai",
  RUNNING: "Berjalan",
  ENDED: "Selesai",
};

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<{ ujian?: string }>;
}) {
  const user = await requirePageUser(["GRADER"]);
  const query = await searchParams;
  const aksesLomba = await getAksesLomba(user.userId);
  const aksesFilter = aksesLomba.length > 0 ? { competitionId: { in: aksesLomba } } : {};

  const exams = await prisma.exam.findMany({
    where: { deletedAt: null, ...aksesFilter },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, phase: true, startsAt: true, durationMinutes: true },
  });

  // Default: ujian yang sedang berjalan, fallback ke jadwal terbaru.
  const requested = Number(query.ujian);
  const selected =
    exams.find((exam) => exam.id === requested) ??
    exams.find((exam) => exam.phase === "RUNNING") ??
    exams[0] ??
    null;

  const attempts = selected
    ? await prisma.examAttempt.findMany({
        where: { examId: selected.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              identity: true,
              groupName: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
      })
    : [];

  const [counts, pesertaTerdaftar] = selected
    ? await Promise.all([getExamParticipantCounts(selected.id), getOmbnPesertaCount(selected.id)])
    : [{ attended: 0, waiting: 0, working: 0, finished: 0 }, 0];
  const now = new Date();

  const rows = attempts.map((attempt) => {
    const started = attempt.startedAt;
    const timeElapsed = started ? Math.floor((now.getTime() - started.getTime()) / 1000 / 60) : null;
    const timeRemaining = attempt.expiresAt ? Math.max(0, Math.ceil((attempt.expiresAt.getTime() - now.getTime()) / 1000 / 60)) : null;
    const waiting = Boolean(attempt.attendedAt && !started);
    const status = waiting ? { label: "Belum mulai", className: "bg-page text-ink-muted" } : attemptStatusMeta[attempt.status] ?? attemptStatusMeta.IN_PROGRESS;

    return {
      name: attempt.user.name,
      identity: attempt.user.identity,
      groupName: attempt.user.groupName,
      status,
      startedAt: started,
      timeElapsed,
      timeRemaining,
    };
  });

  return (
    <PetugasShell name={user.name} current="/petugas/monitoring">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Monitoring Peserta</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {selected
              ? `${selected.name} · ${PHASE_LABEL[selected.phase] ?? selected.phase} · ${formatJakarta(selected.startsAt)} · ${selected.durationMinutes} menit`
              : "Belum ada jadwal ujian terbit."}
          </p>
        </header>

        {exams.length > 0 ? (
          <MonitoringFilterForm
            selectedId={selected?.id ?? 0}
            exams={exams.map((exam) => ({
              id: exam.id,
              label: `${exam.name} — ${formatJakarta(exam.startsAt)} (${PHASE_LABEL[exam.phase] ?? exam.phase})`,
            }))}
          />
        ) : null}

        {selected ? (
          <section aria-label="Ringkasan peserta" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Peserta terdaftar" value={pesertaTerdaftar} hint="Total peserta mendaftar ujian ini" />
            <StatCard label="Absen" value={counts.attended} hint="Sudah konfirmasi kehadiran" />
            <StatCard label="Ruang tunggu" value={counts.waiting} hint="Absen, belum mulai soal" />
            <StatCard label="Mengerjakan" value={counts.working} hint="Timer peserta berjalan" />
            <StatCard label="Selesai" value={counts.finished} hint="Sudah kirim / waktu habis" />
          </section>
        ) : null}

        <section className="rounded-xl border border-line/80 bg-paper shadow-sm">
          <PaginatedDataTable
            headers={["Nama", "Identitas", "Kelompok", "Status", "Mulai", "Waktu Terpakai", "Sisa Waktu"]}
            rows={rows.map((row) => [
              <span key="name" className="font-semibold text-ink">{row.name}</span>,
              <span key="identity" className="text-sm text-ink">{row.identity}</span>,
              <span key="group" className="text-sm text-ink-muted">{row.groupName ?? "—"}</span>,
              <span key="status" className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${row.status.className}`}>{row.status.label}</span>,
              <span key="start" className="text-xs text-ink-muted">{row.startedAt ? formatJakarta(row.startedAt) : "—"}</span>,
              <span key="elapsed" className="text-sm font-digits text-ink tabular-nums">{row.timeElapsed != null ? `${row.timeElapsed} menit` : "—"}</span>,
              <span key="remaining" className={`text-sm font-digits tabular-nums ${row.timeRemaining != null && row.timeRemaining <= 5 ? "text-mark" : "text-ink"}`}>
                {row.timeRemaining != null ? `${row.timeRemaining} menit` : "—"}
              </span>,
            ])}
            searchPlaceholder="Cari nama atau identitas"
          />
        </section>
      </div>
    </PetugasShell>
  );
}
