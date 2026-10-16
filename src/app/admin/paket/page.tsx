import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PaketPage() {
  const user = await requirePageUser(["ADMIN"]);
  const packages = await prisma.questionPackage.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, exams: true } } },
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
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {packages.map((pack) => (
              <li key={pack.id}>
                <Link
                  href={`/admin/paket/${pack.id}`}
                  className="block h-full rounded-xl border border-line/80 bg-paper p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                        pack.isActive ? "bg-brand-soft text-brand" : "bg-page text-ink-muted"
                      }`}>
                      {pack.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                    {pack._count.exams > 0 ? (
                      <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">
                        {pack._count.exams} ujian
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-semibold text-ink">{pack.name}</p>
                  {pack.description ? <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{pack.description}</p> : null}
                  <p className="mt-3 text-xs text-ink-muted">
                    <span className="font-digits font-semibold text-ink tabular-nums">{pack._count.items}</span> soal
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
