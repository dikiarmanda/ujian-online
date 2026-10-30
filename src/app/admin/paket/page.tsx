import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { PaketTable } from "@/components/paket-table";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PaketPage() {
  const user = await requirePageUser(["ADMIN"]);
  const packages = await prisma.questionPackage.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, examPackages: true } } },
  });

  return (
    <AdminShell name={user.name} current="/admin/paket">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Konten ujian</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Paket soal</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Susun kumpulan soal sekali, lalu pilih paket saat membuat ujian.
            </p>
          </div>
          <Link
            href="/admin/paket/baru"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            Buat paket
          </Link>
        </header>

        {packages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong/60 bg-paper px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">Belum ada paket</p>
            <p className="mt-1 text-sm text-ink-muted">Buat paket dari bank soal sebelum menjadwalkan ujian.</p>
            <Link href="/admin/paket/baru" className="mt-4 inline-flex text-sm font-semibold text-brand hover:underline">
              Buat paket pertama
            </Link>
          </div>
        ) : (
          <section className="overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm">
            <div className="border-b border-line/70 px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold tracking-tight text-ink">Daftar paket</h2>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    Menampilkan <span className="font-digits tabular-nums">{packages.length}</span> paket
                  </p>
                </div>
              </div>
            </div>

            <PaketTable
              packages={packages.map((pack) => ({
                id: pack.id,
                name: pack.name,
                description: pack.description,
                isActive: pack.isActive,
                itemCount: pack._count.items,
                examCount: pack._count.examPackages,
              }))}
            />
          </section>
        )}
      </div>
    </AdminShell>
  );
}
