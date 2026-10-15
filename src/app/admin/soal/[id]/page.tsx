import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { DeleteQuestionButton, QuestionForm } from "@/components/admin-forms";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function SoalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isFinite(questionId)) notFound();

  const [question, categories, usedInExams] = await Promise.all([
    prisma.question.findUnique({
      where: { id: questionId },
      include: {
        category: true,
        options: { orderBy: { sortOrder: "asc" } },
        essayKey: true,
      },
    }),
    prisma.questionCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.examQuestion.count({ where: { questionId } }),
  ]);
  if (!question) notFound();

  return (
    <AdminShell name={user.name} current="/admin/soal">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          <Link href="/admin/soal" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H7M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Kembali ke bank soal
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                    question.type === "ESSAY" ? "bg-mark text-mark-ink" : "bg-brand-soft text-brand"
                  }`}>
                  {question.type === "ESSAY" ? "Uraian" : "Pilihan ganda"}
                </span>
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                    question.isActive ? "bg-brand-soft text-brand" : "bg-page text-ink-muted"
                  }`}>
                  {question.isActive ? "Aktif" : "Nonaktif"}
                </span>
                {usedInExams > 0 ? (
                  <span className="inline-flex rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">
                    Dipakai di {usedInExams} ujian
                  </span>
                ) : (
                  <span className="inline-flex rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Belum dipakai ujian</span>
                )}
              </div>
              <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-ink">{question.code}</h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                {question.category.name} · bobot {question.defaultWeight.toString()} · diperbarui {formatJakarta(question.updatedAt)}
              </p>
            </div>
            {usedInExams === 0 ? <DeleteQuestionButton questionId={question.id} /> : null}
          </div>

          {usedInExams > 0 ? (
            <p className="rounded-xl border border-mark-edge/25 bg-mark/40 px-4 py-3 text-sm text-mark-ink">
              Soal ini sudah masuk paket ujian. Hapus tidak tersedia — nonaktifkan saja bila tidak ingin dipakai lagi.
            </p>
          ) : null}
        </header>

        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong/60 bg-paper px-4 py-6 text-sm text-ink-muted">
            Belum ada kategori.{" "}
            <Link href="/admin/soal#kategori" className="font-semibold text-brand hover:underline">
              Buat kategori dulu
            </Link>{" "}
            sebelum menyimpan perubahan.
          </p>
        ) : null}

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
      </div>
    </AdminShell>
  );
}
