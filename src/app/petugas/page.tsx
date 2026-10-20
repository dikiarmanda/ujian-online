import Link from "next/link";
import { AppBar } from "@/components/chrome";
import { requirePageUser } from "@/server/current-user";
import { listGradingQueue } from "@/server/grading";

export const dynamic = "force-dynamic";

export default async function PetugasHome() {
  const user = await requirePageUser(["GRADER"]);
  const rows = await listGradingQueue(user.userId);
  return (
    <div className="min-h-screen bg-page">
      <AppBar title="Penilaian uraian" name={user.name} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Jawaban menunggu</h1>
            <p className="mt-1 text-sm text-ink-muted">Buka satu jawaban untuk menguncinya. Petugas lain tidak dapat menilai jawaban yang sama.</p>
          </div>
          <Link href="/petugas/ujian" className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink hover:border-brand">
            Kontrol ujian
          </Link>
        </div>
        <ul className="overflow-hidden rounded-md border border-line bg-paper shadow-paper">
          {rows.length === 0 ? <li className="px-4 py-8 text-sm text-ink-muted">Tidak ada jawaban yang bisa dinilai.</li> : null}
          {rows.map((row) => (
            <li key={row.id} className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-4 text-sm last:border-0">
              <span>
                <span className="font-semibold">{row.attempt.user.name}</span>
                <span className="mt-0.5 block text-ink-muted">
                  {row.attempt.exam.name} · {row.question.code}
                  {row.gradingState === "LOCKED" && row.lockedById === user.userId ? " · kunci Anda" : ""}
                </span>
              </span>
              <Link href={`/petugas/jawaban/${row.id}`} className="rounded-md bg-brand px-3 py-2 font-semibold text-white hover:brightness-110">
                Buka
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
