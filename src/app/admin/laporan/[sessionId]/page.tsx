import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LaporanDetailPanel } from "@/components/laporan-detail-panel";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { sessionReport } from "@/server/reports";

export const dynamic = "force-dynamic";

const gradingLabel: Record<string, string> = {
  NOT_GRADED: "Belum dinilai",
  PARTIAL: "Sebagian",
  COMPLETED: "Selesai dinilai",
};

function StatCard({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-digits text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}

function getSessionState(startsAt: Date, endsAt: Date, now: Date) {
  if (now >= startsAt && now <= endsAt) return { label: "Berlangsung", className: "bg-brand-soft text-brand" };
  if (now < startsAt) return { label: "Mendatang", className: "bg-page text-ink-muted" };
  return { label: "Selesai", className: "bg-brand text-white" };
}

export default async function LaporanDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { sessionId } = await params;
  const id = Number(sessionId);
  if (!Number.isFinite(id)) notFound();

  let report;
  try {
    report = await sessionReport(id);
  } catch {
    notFound();
  }

  const now = new Date();
  const state = getSessionState(report.startsAt, report.endsAt, now);
  const attendancePct =
    report.attendance.assigned > 0 ? Math.round((report.attendance.attended / report.attendance.assigned) * 100) : 0;
  const finished = report.rows.filter((row) => row.status === "Selesai").length;
  const inProgress = report.rows.filter((row) => row.status === "Mengerjakan").length;
  const pendingGrading = report.rows.filter((row) => row.gradingStatus === "NOT_GRADED" || row.gradingStatus === "PARTIAL").length;
  const totalViolations = report.rows.reduce((sum, row) => sum + row.violations, 0);

  return (
    <AdminShell name={user.name} current="/admin/laporan">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          <Link href="/admin/laporan" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H7M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Kembali ke daftar laporan
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${state.className}`}>{state.label}</span>
                <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">{report.durationMinutes} menit</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{report.examName}</h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                Fase {report.phase} · {formatJakarta(report.startsAt)} → {formatJakarta(report.endsAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/admin/ujian/${report.examId}`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
                Kelola ujian
              </Link>
              <a
                href={`/api/admin/laporan/${sessionId}/excel`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
                Unduh Excel
              </a>
              <a
                href={`/api/admin/laporan/${sessionId}/pdf`}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                Unduh PDF
              </a>
            </div>
          </div>
        </header>

        <section aria-label="Ringkasan ujian" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Kehadiran"
            value={`${report.attendance.attended}/${report.attendance.assigned}`}
            hint={`${attendancePct}% peserta hadir`}
          />
          <StatCard label="Selesai" value={finished} hint={inProgress ? `${inProgress} masih mengerjakan` : "Sudah mengirim jawaban"} />
          <StatCard
            label="Penilaian"
            value={pendingGrading}
            hint={pendingGrading ? "Menunggu nilai uraian" : "Tidak ada antrean penilaian"}
          />
          <StatCard
            label="Pelanggaran"
            value={totalViolations}
            hint={totalViolations ? "Perlu ditinjau" : "Tidak tercatat"}
          />
        </section>

        <LaporanDetailPanel
          rows={report.rows.map((row) => ({
            userId: row.userId,
            name: row.name,
            identity: row.identity,
            groupName: row.groupName,
            status: row.status,
            mcScore: row.mcScore,
            essayScore: row.essayScore,
            totalScore: row.totalScore,
            gradingStatus: row.gradingStatus,
            gradingLabel: gradingLabel[row.gradingStatus] ?? "—",
            violations: row.violations,
          }))}
          items={report.items}
        />

        {report.violations.length > 0 ? (
          <section className="rounded-xl border border-mark-edge/25 bg-paper p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Catatan pelanggaran</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{report.violations.length} kejadian tercatat selama sesi.</p>
            </div>
            <ul className="divide-y divide-line/70 overflow-hidden rounded-xl border border-line/80">
              {report.violations.slice(0, 20).map((item, index) => (
                <li key={`${item.name}-${item.occurredAt}-${index}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">
                      {item.type}
                      {item.questionNumber != null ? ` · soal #${item.questionNumber}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 text-xs text-ink-muted">{formatJakarta(item.occurredAt)}</p>
                </li>
              ))}
            </ul>
            {report.violations.length > 20 ? (
              <p className="mt-3 text-xs text-ink-muted">Menampilkan 20 teratas. Unduh Excel untuk data lengkap.</p>
            ) : null}
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
