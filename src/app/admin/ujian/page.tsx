import Link from "next/link";
import { AdminShell, DataTable } from "@/components/admin-shell";
import { ExamForm } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatExamDate } from "@/server/exam-rules";

export const dynamic = "force-dynamic";

export default async function UjianPage() {
  const user = await requirePageUser(["ADMIN"]);
  const exams = await prisma.exam.findMany({ orderBy: { examDate: "desc" }, include: { _count: { select: { sessions: true, questions: true } } } });
  return (
    <AdminShell name={user.name} current="/admin/ujian">
      <h1 className="mb-4 text-lg font-semibold">Ujian</h1>
      <DataTable
        headers={["Nama", "Tanggal", "Durasi", "Soal", "Sesi", "Status"]}
        rows={exams.map((exam) => [
          <Link key={exam.id} href={`/admin/ujian/${exam.id}`} className="text-brand">{exam.name}</Link>,
          formatExamDate(exam.examDate),
          `${exam.durationMinutes} menit`,
          String(exam._count.questions),
          String(exam._count.sessions),
          exam.status === "PUBLISHED" ? "Terbit" : exam.status === "ARCHIVED" ? "Arsip" : "Draf",
        ])}
      />
      <h2 className="mt-8 mb-3 font-semibold">Ujian baru</h2>
      <ExamForm />
    </AdminShell>
  );
}
