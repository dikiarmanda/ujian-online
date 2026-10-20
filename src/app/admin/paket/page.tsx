import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PaketPage() {
  const user = await requirePageUser(["ADMIN"]);
  const packages = await prisma.questionPackage.findMany({
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

            <ul className="divide-y divide-line/70 md:hidden">
              {packages.map((pack) => (
                <li key={pack.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                            pack.isActive ? "bg-brand-soft text-brand" : "bg-page text-ink-muted"
                          }`}>
                          {pack.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                        {pack._count.examPackages > 0 ? (
                          <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">
                            {pack._count.examPackages} ujian
                          </span>
                        ) : null}
                      </div>
                      <Link href={`/admin/paket/${pack.id}`} className="mt-2 block font-semibold text-ink hover:text-brand">
                        {pack.name}
                      </Link>
                      {pack.description ? <p className="mt-1 text-sm text-ink-muted line-clamp-2">{pack.description}</p> : null}
                      <p className="mt-1 font-digits text-xs text-ink-muted">
                        <span className="font-semibold text-ink tabular-nums">{pack._count.items}</span> soal
                      </p>
                    </div>
                    <Link
                      href={`/admin/paket/${pack.id}`}
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
                    <th className="px-5 py-3.5">Nama paket</th>
                    <th className="px-4 py-3.5">Deskripsi</th>
                    <th className="px-4 py-3.5">Jumlah soal</th>
                    <th className="px-4 py-3.5">Ujian</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/70">
                  {packages.map((pack) => (
                    <tr key={pack.id} className="transition-colors hover:bg-brand-soft/25">
                      <td className="px-5 py-3.5">
                        <Link href={`/admin/paket/${pack.id}`} className="font-semibold text-ink hover:text-brand">
                          {pack.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-ink-muted line-clamp-2 max-w-xs">{pack.description || "—"}</td>
                      <td className="px-4 py-3.5 font-digits tabular-nums text-ink">
                        {pack._count.items}
                      </td>
                      <td className="px-4 py-3.5 font-digits tabular-nums text-ink">
                        {pack._count.examPackages}
                      </td>
                      <td className="px-4 py-3.5">
                        {pack.isActive ? (
                          <span className="inline-flex rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">Aktif</span>
                        ) : (
                          <span className="inline-flex rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Nonaktif</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/paket/${pack.id}`}
                          className="inline-flex rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
