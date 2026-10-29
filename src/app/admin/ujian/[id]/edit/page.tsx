import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ExamForm } from "@/components/admin-forms";
import { listAvailableCompetitions } from "@/server/competitions";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function EditUjianPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) notFound();

  const exam = await prisma.exam.findUnique({
    where: { id: examId, deletedAt: null },
    include: {
      packages: {
        select: { jenjang: true, packageId: true },
      },
    },
  });
  if (!exam) notFound();

  // Hanya bisa edit jika belum berjalan
  if (exam.phase !== "NOT_STARTED") {
    return (
      <AdminShell name={user.name} current="/admin/ujian">
        <div className="mx-auto max-w-2xl py-8">
          <div className="rounded-xl border border-dashed border-alert/40 bg-mark px-6 py-8 text-center">
            <p className="text-lg font-semibold text-alert">Ujian tidak dapat diedit</p>
            <p className="mt-2 text-sm text-ink-muted">
              Ujian yang sudah berjalan atau selesai tidak dapat diubah. Buat ujian baru jika perlu.
            </p>
            <Link
              href={`/admin/ujian/${exam.id}`}
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
              Kembali ke detail ujian
            </Link>
          </div>
        </div>
      </AdminShell>
    );
  }

  const [packages, availableCompetitions] = await Promise.all([
    prisma.questionPackage.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true } } },
    }),
    listAvailableCompetitions().catch(() => []),
  ]);

  // Get competition from this exam for edit mode
  let currentCompetition = null;
  try {
    const { getCompetitionById } = await import("@/server/competitions");
    const comp = await getCompetitionById(exam.competitionId);
    currentCompetition = {
      ...comp,
      jenjangRaw: null,
    };
  } catch (error) {
    console.error("Gagal memuat lomba ujian ini:", error);
  }

  // Combine: available competitions + current competition (if not already in list)
  const competitions = [...availableCompetitions];
  if (currentCompetition && !competitions.some((c) => c.id === currentCompetition.id)) {
    competitions.push(currentCompetition);
  }

  // Map existing packages to packageMap
  const packageMap: Record<string, number> = {};
  for (const pack of exam.packages) {
    packageMap[pack.jenjang] = pack.packageId;
  }

  let competitionsError: string | null = null;
  if (competitions.length === 0) {
    competitionsError = "Gagal memuat daftar lomba.";
  }

  return (
    <AdminShell name={user.name} current="/admin/ujian">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          <Link href={`/admin/ujian/${exam.id}`} className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            Kembali ke detail ujian
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Edit ujian</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Ubah jadwal, paket soal, atau pengaturan ujian. Ujian yang sudah berjalan tidak dapat diedit.
            </p>
          </div>
        </header>

        <div className="max-w-2xl">
          <ExamForm
            examId={exam.id}
            initialData={{
              competitionId: exam.competitionId,
              attendanceOpensAt: exam.attendanceOpensAt.toISOString().slice(0, 16),
              startsAt: exam.startsAt.toISOString().slice(0, 16),
              durationMinutes: exam.durationMinutes,
              shuffleQuestions: exam.shuffleQuestions,
              shuffleOptions: exam.shuffleOptions,
              status: exam.status,
              packages: packageMap,
            }}
            competitions={competitions}
            competitionsError={competitionsError}
            packages={packages.map((pack) => ({
              id: pack.id,
              name: pack.name,
              itemCount: pack._count.items,
            }))}
          />
        </div>
      </div>
    </AdminShell>
  );
}
