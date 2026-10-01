import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell, DataTable } from "@/components/admin-shell";
import { PackageForm, SessionForm } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatJakarta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function UjianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { id } = await params;
  const exam = await prisma.exam.findUnique({
    where: { id: Number(id) },
    include: { questions: true, sessions: { orderBy: { startsAt: "asc" } } },
  });
  if (!exam) notFound();
  const questions = await prisma.question.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: { id: true, code: true, defaultWeight: true },
  });
  return (
    <AdminShell name={user.name} current="/admin/ujian">
      <h1 className="mb-2 text-lg font-semibold">{exam.name}</h1>
      <p className="mb-6 text-sm text-ink-muted">{exam.durationMinutes} menit · {exam.status}</p>
      <h2 className="mb-3 font-semibold">Paket soal</h2>
      <PackageForm
        examId={exam.id}
        questions={questions.map((question) => ({ ...question, defaultWeight: question.defaultWeight.toString() }))}
        selected={exam.questions.map((item) => item.questionId)}
      />
      <h2 className="mt-8 mb-3 font-semibold">Sesi</h2>
      <DataTable
        headers={["Nama", "Mulai", "Selesai"]}
        rows={exam.sessions.map((session) => [
          <Link key={session.id} href={`/admin/sesi/${session.id}`} className="text-brand">{session.name}</Link>,
          formatJakarta(session.startsAt),
          formatJakarta(session.endsAt),
        ])}
      />
      <div className="mt-4">
        <SessionForm examId={exam.id} />
      </div>
    </AdminShell>
  );
}
