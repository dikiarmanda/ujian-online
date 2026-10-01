import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { QuestionForm } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function SoalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id: Number(id) },
    include: { options: { orderBy: { sortOrder: "asc" } }, essayKey: true },
  });
  if (!question) notFound();
  const categories = await prisma.questionCategory.findMany({ orderBy: { name: "asc" } });
  return (
    <AdminShell name={user.name} current="/admin/soal">
      <h1 className="mb-4 text-lg font-semibold">Ubah soal</h1>
      <QuestionForm
        categories={categories}
        initial={{
          id: question.id,
          code: question.code,
          categoryId: question.categoryId,
          type: question.type,
          body: question.body,
          defaultWeight: Number(question.defaultWeight),
          isActive: question.isActive,
          options: question.options.map((option) => ({
            label: option.label,
            body: option.body,
            isCorrect: option.isCorrect,
          })),
          answerKey: question.essayKey?.answerKey ?? "",
          rubric: question.essayKey?.rubric ?? "",
        }}
      />
    </AdminShell>
  );
}
