import Link from "next/link";
import { AdminShell, DataTable } from "@/components/admin-shell";
import { CategoryForm, ImportForm } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function SoalPage({ searchParams }: { searchParams: Promise<{ kategori?: string; jenis?: string; kode?: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const query = await searchParams;
  const questions = await prisma.question.findMany({
    where: {
      categoryId: query.kategori ? Number(query.kategori) : undefined,
      type: query.jenis === "pg" ? "MULTIPLE_CHOICE" : query.jenis === "uraian" ? "ESSAY" : undefined,
      code: query.kode ? { contains: query.kode } : undefined,
    },
    include: { category: true },
    orderBy: { code: "asc" },
  });
  const categories = await prisma.questionCategory.findMany({ orderBy: { name: "asc" } });
  return (
    <AdminShell name={user.name} current="/admin/soal">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Bank soal</h1>
        <Link href="/admin/soal/baru" className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-110">
          Soal baru
        </Link>
      </div>
      <form className="mb-4 flex flex-wrap gap-2 text-sm" method="get">
        <input name="kode" defaultValue={query.kode} placeholder="Kode" className="rounded-sm border border-line-strong px-3 py-2" />
        <select name="kategori" defaultValue={query.kategori ?? ""} className="rounded-sm border border-line-strong px-3 py-2">
          <option value="">Semua kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="jenis" defaultValue={query.jenis ?? ""} className="rounded-sm border border-line-strong px-3 py-2">
          <option value="">Semua jenis</option>
          <option value="pg">Pilihan ganda</option>
          <option value="uraian">Uraian</option>
        </select>
        <button className="rounded-sm border border-line-strong px-3 py-2">Cari</button>
      </form>
      <DataTable
        headers={["Kode", "Kategori", "Jenis", "Bobot", "Status"]}
        rows={questions.map((question) => [
          <Link key={question.id} href={`/admin/soal/${question.id}`} className="text-brand">
            {question.code}
          </Link>,
          question.category.name,
          question.type === "ESSAY" ? "Uraian" : "Pilihan ganda",
          question.defaultWeight.toString(),
          question.isActive ? "Aktif" : "Nonaktif",
        ])}
      />
      <div className="mt-8 grid gap-6">
        <CategoryForm />
        <ImportForm />
      </div>
    </AdminShell>
  );
}
