import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { QuestionForm } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function SoalBaruPage() {
  const user = await requirePageUser(["ADMIN"]);
  const categories = await prisma.questionCategory.findMany({ orderBy: { name: "asc" } });
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
          <div>
            <p className="text-sm text-ink-muted">Konten ujian</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Soal baru</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Isi identitas, teks soal, lalu opsi jawaban atau pedoman penilaian.
            </p>
          </div>
        </header>

        {categories.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong/60 bg-paper px-4 py-6 text-sm text-ink-muted">
            Belum ada kategori.{" "}
            <Link href="/admin/soal#kategori" className="font-semibold text-brand hover:underline">
              Buat kategori dulu
            </Link>{" "}
            dari halaman bank soal.
          </p>
        ) : null}

        <QuestionForm categories={categories} />
      </div>
    </AdminShell>
  );
}
