import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PaginatedDataTable } from "@/components/data-table";
import RichHtml from "@/components/rich-html";
import { formatJakarta } from "@/lib/format";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
import { requirePageUser } from "@/server/current-user";
import { attemptReport } from "@/server/reports";

export const dynamic = "force-dynamic";

const typeLabel: Record<string, string> = {
  MULTIPLE_CHOICE: "Pilihan ganda",
  SHORT_ANSWER: "Jawaban singkat",
  ESSAY: "Uraian",
};

const statusClass: Record<string, string> = {
  "Belum absen": "bg-page text-ink-muted",
  "Sudah absen": "bg-mark text-mark-ink",
  Mengerjakan: "bg-brand-soft text-brand",
  Selesai: "bg-brand text-white",
};

const gradingClass: Record<string, string> = {
  NOT_GRADED: "bg-page text-ink-muted",
  PARTIAL: "bg-mark text-mark-ink",
  COMPLETED: "bg-brand-soft text-brand",
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

export default async function PesertaDetailPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { attemptId } = await params;
  const id = Number(attemptId);
  if (!Number.isFinite(id)) notFound();

  let report;
  try {
    report = await attemptReport(id);
  } catch {
    notFound();
  }

  return (
    <AdminShell name={user.name} current="/admin/laporan">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          <Link href={`/admin/laporan/${report.examId}`} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <FontAwesomeIcon icon={Icon.ArrowLeft} className="size-3.5" />
            Kembali ke laporan ujian
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-ink-muted">{report.examName}</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{report.user.name}</h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                <span className="font-digits">{report.user.identity}</span>
                {report.user.groupName ? ` · ${report.user.groupName}` : ""} · {report.jenjang}
              </p>
            </div>
            <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass[report.status] ?? "bg-page text-ink-muted"}`}>
              {report.status}
            </span>
          </div>
        </header>

        <section aria-label="Ringkasan peserta" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Skor otomatis" value={report.mcScore?.toString() ?? "—"} hint="Pilihan ganda & jawaban singkat" />
          <StatCard label="Skor uraian" value={report.essayScore?.toString() ?? "—"} hint="Nilai manual petugas" />
          <StatCard label="Total" value={report.totalScore?.toString() ?? "—"} hint="Skor akhir peserta" />
          <StatCard
            label="Penilaian"
            value={report.gradingStatus === "COMPLETED" ? "Selesai" : report.gradingStatus === "PARTIAL" ? "Sebagian" : "Belum"}
            hint="Status penilaian uraian"
          />
        </section>

        <section className="rounded-xl border border-line/80 bg-paper shadow-sm">
          <div className="border-b border-line/70 px-4 py-4 sm:px-5">
            <h2 className="text-base font-semibold tracking-tight text-ink">Detail jawaban</h2>
            <p className="mt-0.5 text-sm text-ink-muted">{report.answers.length} soal</p>
          </div>

          <PaginatedDataTable
            headers={["Soal", "Tipe", "Bobot", "Jawaban peserta", "Kunci", "Skor"]}
            rows={report.answers.map((answer) => [
              <div>
                <RichHtml html={answer.body} className="mt-1 text-sm text-ink-muted line-clamp-2" />
              </div>,
              <span className="text-sm text-ink-muted">{typeLabel[answer.type] ?? answer.type}</span>,
              <span className="font-digits tabular-nums text-ink">{answer.weight}</span>,
              <span className="text-sm text-ink-muted line-clamp-2 max-w-xs">{answer.answerText || "—"}</span>,
              <span className="text-sm text-ink-muted line-clamp-2 max-w-xs">{answer.correctAnswer || "—"}</span>,
              <div className="text-right">
                {answer.score != null ? (
                  <span className="font-digits font-semibold tabular-nums text-ink">{answer.score.toString()}</span>
                ) : (
                  <span className="text-ink-muted">—</span>
                )}
                {answer.gradingNote ? (
                  <p className="mt-1 text-xs text-ink-muted truncate">{answer.gradingNote}</p>
                ) : null}
              </div>,
            ])}
            searchPlaceholder="Cari kode soal"
          />
        </section>

        {report.violations.length > 0 ? (
          <section className="rounded-xl border border-mark-edge/25 bg-paper shadow-sm">
            <div className="border-b border-line/70 px-4 py-4 sm:px-5">
              <h2 className="text-base font-semibold tracking-tight text-ink">Pelanggaran</h2>
              <p className="mt-0.5 text-sm text-ink-muted">{report.violations.length} kejadian tercatat</p>
            </div>
            <PaginatedDataTable
              headers={["Jenis", "Soal", "Waktu"]}
              rows={report.violations.map((v) => [
                <span className="text-sm text-ink">{v.type}</span>,
                <span className="text-sm text-ink-muted">{v.questionNumber != null ? `#${v.questionNumber}` : "—"}</span>,
                <span className="text-xs text-ink-muted">{formatJakarta(v.occurredAt)}</span>,
              ])}
              searchPlaceholder="Cari jenis pelanggaran"
            />
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
