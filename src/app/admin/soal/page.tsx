import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { CategoryForm, ImportForm } from "@/components/admin-forms";
import { SoalFilterForm } from "@/components/soal-filter-form";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-digits text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}

function TypeBadge({ type }: { type: "MULTIPLE_CHOICE" | "ESSAY" }) {
  if (type === "ESSAY") {
    return <span className="inline-flex rounded-md bg-mark px-2 py-1 text-xs font-semibold text-mark-ink">Uraian</span>;
  }
  return <span className="inline-flex rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">Pilihan ganda</span>;
}

function previewText(html: string, max = 20): string {
  const plain = html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain || "—";
  return `${plain.slice(0, max)}…`;
}

function weightLabel(benar: { toString(): string }, salah: { toString(): string }): string {
  const wrong = Number(salah);
  return wrong > 0 ? `${benar.toString()} / −${salah.toString()}` : `${benar.toString()} / 0`;
}

export default async function SoalPage({
  searchParams,
}: {
  searchParams: Promise<{ kategori?: string; jenis?: string; kode?: string; paket?: string }>;
}) {
  const user = await requirePageUser(["ADMIN"]);
  const query = await searchParams;
  const categoryId = query.kategori ? Number(query.kategori) : undefined;
  const packageId = query.paket ? Number(query.paket) : undefined;
  const typeFilter = query.jenis === "pg" ? "MULTIPLE_CHOICE" : query.jenis === "uraian" ? "ESSAY" : undefined;

  const [questions, categories, packages, totalCount, activeCount, mcCount, essayCount] = await Promise.all([
    prisma.question.findMany({
      where: {
        categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
        type: typeFilter,
        code: query.kode ? { contains: query.kode } : undefined,
        packageItems: Number.isFinite(packageId) ? { some: { packageId } } : undefined,
      },
      include: { category: true },
      orderBy: { code: "asc" },
      take: 300,
    }),
    prisma.questionCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.questionPackage.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.question.count(),
    prisma.question.count({ where: { isActive: true } }),
    prisma.question.count({ where: { type: "MULTIPLE_CHOICE" } }),
    prisma.question.count({ where: { type: "ESSAY" } }),
  ]);

  const hasFilter = Boolean(query.kode || query.kategori || query.jenis || query.paket);

  return (
    <AdminShell name={user.name} current="/admin/soal">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Konten ujian</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Bank soal</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Kelola soal pilihan ganda dan uraian, atur kategori, atau impor dari Excel/CSV.
            </p>
          </div>
          <Link
            href="/admin/soal/baru"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            Soal baru
          </Link>
        </header>

        <section aria-label="Ringkasan bank soal" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total" value={totalCount} hint={`${activeCount} aktif`} />
          <StatCard label="Pilihan ganda" value={mcCount} hint="Dinilai otomatis" />
          <StatCard label="Uraian" value={essayCount} hint="Perlu penilaian petugas" />
          <StatCard label="Kategori" value={categories.length} hint="Pengelompokan soal" />
        </section>

        <section className="overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm">
          <div className="border-b border-line/70 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-ink">Daftar soal</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Menampilkan {questions.length}
                  {hasFilter ? " hasil filter" : totalCount > questions.length ? ` dari ${totalCount}` : ""} soal
                </p>
              </div>
              {hasFilter ? (
                <Link href="/admin/soal" className="text-sm font-semibold text-brand hover:underline">
                  Hapus filter
                </Link>
              ) : null}
            </div>

            <SoalFilterForm
              kode={query.kode}
              paket={query.paket}
              kategori={query.kategori}
              jenis={query.jenis}
              packages={packages.map((pack) => ({ value: String(pack.id), label: pack.name }))}
              categories={categories.map((category) => ({ value: String(category.id), label: category.name }))}
            />
          </div>

          {questions.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-semibold text-ink">{hasFilter ? "Tidak ada yang cocok" : "Belum ada soal"}</p>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
                {hasFilter
                  ? "Coba ubah filter, atau hapus filter untuk melihat semua soal."
                  : "Buat soal baru atau impor dari Excel/CSV untuk mulai mengisi bank soal."}
              </p>
              {!hasFilter ? (
                <Link
                  href="/admin/soal/baru"
                  className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                  Buat soal pertama
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <ul className="divide-y divide-line/70 md:hidden">
                {questions.map((question) => (
                  <li key={question.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <TypeBadge type={question.type} />
                          {!question.isActive ? (
                            <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Nonaktif</span>
                          ) : null}
                        </div>
                        <Link href={`/admin/soal/${question.id}`} className="mt-2 block font-semibold text-ink hover:text-brand">
                          {previewText(question.body, 20)}
                        </Link>
                        <p className="mt-1 text-sm text-ink-muted">{question.category.name}</p>
                        <p className="mt-1 font-digits text-xs text-ink-muted">
                          Bobot {weightLabel(question.defaultWeight, question.defaultWrongWeight)}
                        </p>
                      </div>
                      <Link
                        href={`/admin/soal/${question.id}`}
                        className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand-soft">
                        Edit
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-page/80 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                      <th className="px-5 py-3.5">Kategori</th>
                      <th className="px-4 py-3.5">Jenis</th>
                      <th className="px-4 py-3.5">Soal</th>
                      <th className="px-4 py-3.5">Bobot</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-5 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/70">
                    {questions.map((question) => (
                      <tr key={question.id} className="transition-colors hover:bg-brand-soft/25">
                        <td className="px-5 py-3.5 text-ink-muted">{question.category.name}</td>
                        <td className="px-4 py-3.5">
                          <TypeBadge type={question.type} />
                        </td>
                        <td className="px-4 py-3.5">
                          <Link href={`/admin/soal/${question.id}`} className="font-semibold text-ink hover:text-brand" title={previewText(question.body, 100)}>
                            {previewText(question.body, 50)}
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 font-digits tabular-nums text-ink">
                          {weightLabel(question.defaultWeight, question.defaultWrongWeight)}
                        </td>
                        <td className="px-4 py-3.5">
                          {question.isActive ? (
                            <span className="inline-flex rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">Aktif</span>
                          ) : (
                            <span className="inline-flex rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Nonaktif</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/admin/soal/${question.id}`}
                            className="inline-flex rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                            Edit
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section id="kategori" className="scroll-mt-24 rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Kategori baru</h2>
              <p className="mt-0.5 text-sm text-ink-muted">Kelompokkan soal agar mudah dicari saat menyusun paket.</p>
            </div>
            <CategoryForm />
            {categories.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2 border-t border-line/70 pt-4">
                {categories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/admin/soal?kategori=${category.id}`}
                      className="inline-flex rounded-lg bg-page px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:bg-brand-soft hover:text-brand">
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <section id="impor" className="scroll-mt-24 rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-ink">Impor Excel/CSV</h2>
                <p className="mt-0.5 text-sm text-ink-muted">Unggah banyak soal sekaligus dari berkas Excel atau CSV.</p>
              </div>
              <a
                href="/templates/template-impor-soal.xlsx"
                download="template-impor-soal.xlsx"
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-page px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 4v10M8 10l4 4 4-4M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Unduh template
              </a>
            </div>
            <ImportForm />
          </section>
        </div>
      </div>
    </AdminShell>
  );
}
