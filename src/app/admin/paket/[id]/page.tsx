import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { DeletePackageButton, QuestionPackageForm } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PaketEditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { id } = await params;
  const packageId = Number(id);
  if (!Number.isFinite(packageId)) notFound();

  const [pack, questions, usedInExams] = await Promise.all([
    prisma.questionPackage.findUnique({
      where: { id: packageId },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.question.findMany({
      where: { isActive: true },
      orderBy: { code: "asc" },
      select: {
        id: true,
        code: true,
        defaultWeight: true,
        defaultWrongWeight: true,
        type: true,
        category: { select: { name: true } },
      },
    }),
    prisma.exam.count({ where: { packageId } }),
  ]);
  if (!pack) notFound();

  // Sertakan soal yang sudah di paket meski nonaktif, agar masih terlihat saat edit.
  const inactiveInPackage = await prisma.question.findMany({
    where: {
      id: { in: pack.items.map((item) => item.questionId) },
      isActive: false,
    },
    select: {
      id: true,
      code: true,
      defaultWeight: true,
      defaultWrongWeight: true,
      type: true,
      category: { select: { name: true } },
    },
  });
  const questionMap = new Map(
    [...questions, ...inactiveInPackage].map((question) => [
      question.id,
      {
        id: question.id,
        code: question.code,
        defaultWeight: question.defaultWeight.toString(),
        defaultWrongWeight: question.defaultWrongWeight.toString(),
        type: question.type,
        categoryName: question.category.name,
      },
    ]),
  );

  return (
    <AdminShell name={user.name} current="/admin/paket">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          <Link href="/admin/paket" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H7M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Kembali ke paket soal
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                    pack.isActive ? "bg-brand-soft text-brand" : "bg-page text-ink-muted"
                  }`}>
                  {pack.isActive ? "Aktif" : "Nonaktif"}
                </span>
                {usedInExams > 0 ? (
                  <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">
                    Dipakai di {usedInExams} ujian
                  </span>
                ) : null}
              </div>
              <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight text-ink">{pack.name}</h1>
              <p className="mt-1.5 text-sm text-ink-muted">{pack.items.length} soal dalam paket</p>
            </div>
            {usedInExams === 0 ? <DeletePackageButton packageId={pack.id} /> : null}
          </div>

          {usedInExams > 0 ? (
            <p className="rounded-xl border border-mark-edge/25 bg-mark/40 px-4 py-3 text-sm text-mark-ink">
              Paket ini sudah dipakai ujian. Hapus tidak tersedia — nonaktifkan saja bila tidak ingin dipilih lagi.
              Perubahan isi paket tidak otomatis mengubah ujian yang sudah dibuat.
            </p>
          ) : null}
        </header>

        <QuestionPackageForm
          questions={[...questionMap.values()]}
          initial={{
            id: pack.id,
            name: pack.name,
            description: pack.description ?? "",
            isActive: pack.isActive,
            questionIds: pack.items.map((item) => item.questionId),
          }}
        />
      </div>
    </AdminShell>
  );
}
