import { notFound } from "next/navigation";
import { AdminShell, DataTable } from "@/components/admin-shell";
import { requirePageUser } from "@/server/current-user";
import { sessionReport } from "@/server/reports";

export const dynamic = "force-dynamic";

const gradingLabel: Record<string, string> = {
  NOT_GRADED: "Belum dinilai",
  PARTIAL: "Sebagian",
  COMPLETED: "Selesai dinilai",
};

export default async function LaporanDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { sessionId } = await params;
  let report;
  try {
    report = await sessionReport(Number(sessionId));
  } catch {
    notFound();
  }
  return (
    <AdminShell name={user.name} current="/admin/laporan">
      <h1 className="text-lg font-semibold">{report.examName}</h1>
      <p className="mb-4 text-sm text-ink-muted">
        {report.sessionName}. Hadir {report.attendance.attended} dari {report.attendance.assigned}.
      </p>
      <p className="mb-4 flex gap-4 text-sm">
        <a className="text-brand" href={`/api/admin/laporan/${sessionId}/excel`}>Unduh Excel</a>
        <a className="text-brand" href={`/api/admin/laporan/${sessionId}/pdf`}>Unduh PDF</a>
      </p>
      <DataTable
        headers={["Nama", "Status", "Pilihan ganda", "Uraian", "Total", "Penilaian", "Pelanggaran"]}
        rows={report.rows.map((row) => [
          row.name,
          row.status,
          row.mcScore || "-",
          row.essayScore || "-",
          row.totalScore || "-",
          gradingLabel[row.gradingStatus] ?? "-",
          String(row.violations),
        ])}
      />
      <h2 className="mt-8 mb-3 font-semibold">Persentase benar</h2>
      <DataTable
        headers={["Kode", "Benar", "Peserta selesai", "Persen"]}
        rows={report.items.map((item) => [item.code, String(item.correct), String(item.total), `${item.percent}%`])}
      />
    </AdminShell>
  );
}
