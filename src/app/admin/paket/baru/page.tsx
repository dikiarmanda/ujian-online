import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { QuestionPackageForm } from "@/components/admin-forms";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PaketBaruPage() {
  const user = await requirePageUser(["ADMIN"]);
  const questions = await prisma.question.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      body: true,
      defaultWeight: true,
      defaultWrongWeight: true,
      type: true,
      category: { select: { name: true } },
    },
  });

  return (
    <AdminShell name={user.name} current="/admin/paket">
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          <Link href="/admin/paket" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <FontAwesomeIcon icon={Icon.ArrowLeft} className="size-3.5" />
            Kembali ke paket soal
          </Link>
          <div>
            <p className="text-sm text-ink-muted">Konten ujian</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Paket baru</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Beri nama paket, lalu centang soal yang masuk.
            </p>
          </div>
        </header>

        <QuestionPackageForm
          questions={questions.map((question) => ({
            id: question.id,
            code: question.code,
            body: question.body,
            defaultWeight: question.defaultWeight.toString(),
            defaultWrongWeight: question.defaultWrongWeight.toString(),
            type: question.type,
            categoryName: question.category.name,
          }))}
        />
      </div>
    </AdminShell>
  );
}
