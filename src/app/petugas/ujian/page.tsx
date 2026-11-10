import Link from "next/link";
import { PetugasShell } from "@/components/petugas-shell";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { ombn } from "@/server/ombn-db";

export const dynamic = "force-dynamic";

async function getAksesLomba(userId: number): Promise<number[]> {
  const sessionUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { externalId: true },
  });

  if (!sessionUser) {
    return [];
  }

  if (!sessionUser.externalId) {
    return [];
  }

  const adminIdMatch = sessionUser.externalId.match(/ombn-admin:(\d+)/);
  if (!adminIdMatch) {
    return [];
  }

  try {
    const adminId = BigInt(adminIdMatch[1]);
    const admin = await ombn.admins.findUnique({
      where: { id: adminId },
      select: { akses_lomba: true },
    });

    if (!admin?.akses_lomba) {
      return [];
    }

    const parsed = Array.isArray(admin.akses_lomba) ? admin.akses_lomba : JSON.parse(JSON.stringify(admin.akses_lomba));
    return parsed.map((id: bigint | number | string) => {
      const num = typeof id === 'bigint' ? Number(id) : Number(id);
      return Number.isInteger(num) ? num : null;
    }).filter((id: number | null): id is number => id !== null);
  } catch (error) {
    console.error("Failed to get akses_lomba:", error);
    return [];
  }
}

export default async function PetugasUjianPage() {
  const user = await requirePageUser(["GRADER"]);
  const aksesLomba = await getAksesLomba(user.userId);

  const exams = await prisma.exam.findMany({
    where: {
      status: "PUBLISHED",
      deletedAt: null,
      ...(aksesLomba.length > 0 ? { competitionId: { in: aksesLomba } } : {}),
    },
    orderBy: { startsAt: "desc" },
    select: { id: true, name: true, phase: true, startsAt: true, durationMinutes: true },
  });

  return (
    <PetugasShell name={user.name} current="/petugas/ujian">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Kontrol Ujian</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {aksesLomba.length > 0
              ? `Menampilkan ujian dari ${aksesLomba.length} lomba yang Anda akses. Buka detail untuk memberi aba-aba MULAI atau SELESAI.`
              : "Buka detail untuk memberi aba-aba MULAI atau SELESAI."}
          </p>
        </header>

        <section className="rounded-xl border border-line/80 bg-paper shadow-sm">
          {exams.length === 0 ? (
            <div className="px-4 py-8 text-sm text-ink-muted">
              {aksesLomba.length > 0
                ? "Tidak ada ujian untuk lomba yang Anda akses."
                : "Belum ada ujian terbit."}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {exams.map((exam) => (
                <li key={exam.id} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{exam.name}</span>
                    <span className="mt-0.5 block text-sm text-ink-muted">
                      {exam.phase} · {formatJakarta(exam.startsAt)} · {exam.durationMinutes} menit
                    </span>
                  </div>
                  <Link
                    href={`/admin/ujian/${exam.id}`}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
                    Buka
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PetugasShell>
  );
}
