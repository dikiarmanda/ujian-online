import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { LaporanDetailPanel } from "@/components/laporan-detail-panel";
import { PaginatedDataTable } from "@/components/data-table";
import { formatJakarta } from "@/lib/format";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
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

function getSessionState(startsAt: Date, now: Date) {
  if (now >= startsAt) return { label: "Berlangsung", className: "bg-brand-soft text-brand" };
  return { label: "Mendatang", className: "bg-page text-ink-muted" };
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
  const state = getSessionState(report.startsAt, now);
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
            <FontAwesomeIcon icon={Icon.ArrowLeft} className="size-3.5" />
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
                Fase {report.phase} · {formatJakarta(report.startsAt)}
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
            label="Belum Dinilai"
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
            attemptId: row.attemptId,
          }))}
          items={report.items}
        />

        {report.violations.length > 0 ? (
          <section className="rounded-xl border border-mark-edge/25 bg-paper shadow-sm">
            <div className="pb-0 p-5 sm:p-6 sm:pb-0">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Catatan pelanggaran</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{report.violations.length} kejadian tercatat selama sesi.</p>
            </div>
            <PaginatedDataTable
              headers={["Nama", "Jenis", "Soal", "Waktu"]}
              rows={report.violations.map((item) => [
                <span className="font-semibold text-ink">{item.name}</span>,
                <span className="text-sm text-ink">{item.type}</span>,
                <span className="text-sm text-ink-muted">{item.questionNumber != null ? `#${item.questionNumber}` : "—"}</span>,
                <span className="text-xs text-ink-muted">{formatJakarta(item.occurredAt)}</span>,
              ])}
              searchPlaceholder="Cari nama atau jenis"
            />
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
