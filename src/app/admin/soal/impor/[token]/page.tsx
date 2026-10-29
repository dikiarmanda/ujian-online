import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ImportPreview } from "@/components/import-preview";
import { requirePageUser } from "@/server/current-user";
import { readQuestionImport } from "@/server/questions";

export const dynamic = "force-dynamic";

export default async function ImportPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) notFound();
  const rows = await readQuestionImport(token, user.userId);

  return (
    <AdminShell name={user.name} current="/admin/soal">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <header>
          <Link href="/admin/soal" className="inline-flex w-fit text-sm font-semibold text-brand hover:underline">
            Kembali ke bank soal
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Pratinjau impor soal</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Soal yang tidak valid tidak bisa disimpan. Centang soal valid, lalu simpan ke bank soal.
          </p>
        </header>
        {rows ? (
          <ImportPreview token={token} rows={rows} />
        ) : (
          <section className="rounded-xl border border-dashed border-line-strong/60 bg-paper px-6 py-12 text-center">
            <p className="text-base font-semibold text-ink">Pratinjau tidak ditemukan</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">Berkas impor sudah kedaluwarsa atau sudah disimpan. Unggah ulang dari bank soal.</p>
          </section>
        )}
      </div>
    </AdminShell>
  );
}
