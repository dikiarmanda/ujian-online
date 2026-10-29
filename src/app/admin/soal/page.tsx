import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { CategoryForm, ImportForm } from "@/components/admin-forms";
import { SoalFilterForm } from "@/components/soal-filter-form";
import { SoalDataTable } from "@/components/soal-data-table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
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

function TypeBadge({ type }: { type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER" }) {
  if (type === "ESSAY") {
    return <span className="inline-flex rounded-md bg-mark px-2 py-1 text-xs font-semibold text-mark-ink">Uraian</span>;
  }
  if (type === "SHORT_ANSWER") {
    return <span className="inline-flex rounded-md border border-line bg-page px-2 py-1 text-xs font-semibold text-ink">Jawaban singkat</span>;
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
  searchParams: Promise<{ kategori?: string; jenis?: string; kode?: string; paket?: string; gambar?: string }>;
}) {
  const user = await requirePageUser(["ADMIN"]);
  const query = await searchParams;
  const categoryId = query.kategori ? Number(query.kategori) : undefined;
  const packageId = query.paket ? Number(query.paket) : undefined;
  const typeFilter =
    query.jenis === "pg" ? "MULTIPLE_CHOICE" : query.jenis === "singkat" ? "SHORT_ANSWER" : query.jenis === "uraian" ? "ESSAY" : undefined;
  const imageFilter = query.gambar === "ya" ? { not: null } : query.gambar === "tidak" ? null : undefined;

  const [questions, categories, packages, totalCount, activeCount, mcCount, shortCount, essayCount] = await Promise.all([
    prisma.question.findMany({
      where: {
        categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
        type: typeFilter,
        code: query.kode ? { contains: query.kode } : undefined,
        packageItems: Number.isFinite(packageId) ? { some: { packageId } } : undefined,
        imagePath: imageFilter,
        deletedAt: null,
      },
      include: { category: true },
      orderBy: { isActive: "desc" },
      take: 300,
    }),
    prisma.questionCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.questionPackage.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.question.count({ where: { deletedAt: null } }),
    prisma.question.count({ where: { isActive: true, deletedAt: null } }),
    prisma.question.count({ where: { type: "MULTIPLE_CHOICE", deletedAt: null } }),
    prisma.question.count({ where: { type: "SHORT_ANSWER", deletedAt: null } }),
    prisma.question.count({ where: { type: "ESSAY", deletedAt: null } }),
  ]);

  // Convert Decimal objects to plain numbers for client component
  const serializedQuestions = questions.map((q) => ({
    ...q,
    defaultWeight: Number(q.defaultWeight),
    defaultWrongWeight: Number(q.defaultWrongWeight),
  }));

  const hasFilter = Boolean(query.kode || query.kategori || query.jenis || query.paket || query.gambar);

  return (
    <AdminShell name={user.name} current="/admin/soal">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Konten ujian</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Bank soal</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Kelola soal pilihan ganda, jawaban singkat, dan uraian, atur kategori, atau impor dari Excel/CSV.
            </p>
          </div>
          <Link
            href="/admin/soal/baru"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            Soal baru
          </Link>
        </header>

        <section aria-label="Ringkasan bank soal" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Total" value={totalCount} hint={`${activeCount} aktif`} />
          <StatCard label="Pilihan ganda" value={mcCount} hint="Dinilai otomatis" />
          <StatCard label="Jawaban singkat" value={shortCount} hint="Satu kunci, huruf kecil" />
          <StatCard label="Uraian" value={essayCount} hint="Perlu penilaian petugas" />
          <StatCard label="Kategori" value={categories.length} hint="Pengelompokan soal" />
        </section>

        <section className="overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm">
          <div className="border-b border-line/70 px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-ink">Daftar soal</h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  Menampilkan {serializedQuestions.length}
                  {hasFilter ? " hasil filter" : totalCount > serializedQuestions.length ? ` dari ${totalCount}` : ""} soal
                </p>
              </div>
              {hasFilter ? (
                <Link href="/admin/soal" className="text-sm font-semibold text-brand hover:underline">
                  Hapus filter
                </Link>
              ) : null}
            </div>

            <SoalFilterForm
              paket={query.paket}
              kategori={query.kategori}
              jenis={query.jenis}
              gambar={query.gambar}
              packages={packages.map((pack) => ({ value: String(pack.id), label: pack.name }))}
              categories={categories.map((category) => ({ value: String(category.id), label: category.name }))}
            />
          </div>

          {serializedQuestions.length === 0 ? (
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
            <SoalDataTable questions={serializedQuestions} />
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
                <FontAwesomeIcon icon={Icon.Download} className="size-4" />
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
