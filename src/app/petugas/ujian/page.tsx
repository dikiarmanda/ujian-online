import Link from "next/link";
import { AppBar } from "@/components/chrome";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function PetugasUjianPage() {
  const user = await requirePageUser(["GRADER", "ADMIN"]);
  const exams = await prisma.exam.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, phase: true, startsAt: true, durationMinutes: true },
  });

  return (
    <div className="min-h-screen bg-page">
      <AppBar title="Kontrol ujian" name={user.name} role={user.role} />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-lg font-semibold">Ujian terbit</h1>
        <p className="mb-6 text-sm text-ink-muted">Buka detail untuk memberi aba-aba MULAI atau SELESAI.</p>
        <ul className="overflow-hidden rounded-md border border-line bg-paper shadow-paper">
          {exams.length === 0 ? <li className="px-4 py-8 text-sm text-ink-muted">Belum ada ujian terbit.</li> : null}
          {exams.map((exam) => (
            <li key={exam.id} className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-4 text-sm last:border-0">
              <span>
                <span className="font-semibold">{exam.name}</span>
                <span className="mt-0.5 block text-ink-muted">
                  {exam.phase} · {formatJakarta(exam.startsAt)} · {exam.durationMinutes} menit
                </span>
              </span>
              <Link href={`/admin/ujian/${exam.id}`} className="rounded-md bg-brand px-3 py-2 font-semibold text-white hover:brightness-110">
                Buka
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
