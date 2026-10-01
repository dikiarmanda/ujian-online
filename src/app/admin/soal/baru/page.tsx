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
      <h1 className="mb-4 text-lg font-semibold">Soal baru</h1>
      {categories.length === 0 ? <p className="mb-4 text-sm">Buat kategori dahulu dari halaman bank soal.</p> : null}
      <QuestionForm categories={categories} />
    </AdminShell>
  );
}
