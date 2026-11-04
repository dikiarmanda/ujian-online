import Link from "next/link";
import { PetugasShell } from "@/components/petugas-shell";
import { requirePageUser } from "@/server/current-user";
import { listGradingQueue } from "@/server/grading";
import { prisma } from "@/server/db";
import { ombn } from "@/server/ombn-db";

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export const dynamic = "force-dynamic";

async function getAksesLomba(userId: number): Promise<number[]> {
  const sessionUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { externalId: true },
  });

  if (!sessionUser || !sessionUser.externalId) {
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

export default async function PetugasHome() {
  const user = await requirePageUser(["GRADER"]);
  const aksesLomba = await getAksesLomba(user.userId);
  const rows = await listGradingQueue(user.userId, aksesLomba);

  return (
    <PetugasShell name={user.name} current="/petugas">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Koreksi Jawaban</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {aksesLomba.length > 0
              ? `Akses ${aksesLomba.length} lomba. Buka satu jawaban untuk menguncinya. Petugas lain tidak dapat menilai jawaban yang sama.`
              : "Buka satu jawaban untuk menguncinya. Petugas lain tidak dapat menilai jawaban yang sama."}
          </p>
        </header>

        <section className="rounded-xl border border-line/80 bg-paper shadow-sm">
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-ink-muted">
              {aksesLomba.length > 0
                ? "Tidak ada jawaban yang bisa dinilai untuk lomba yang Anda akses."
                : "Tidak ada jawaban yang bisa dinilai."}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li key={row.id} className="flex min-h-14 items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{row.attempt.user.name}</span>
                    <span className="mt-0.5 block text-sm text-ink-muted">
                      {row.attempt.exam.name} · {truncateText(row.question.body.replace(/<[^>]*>/g, ''), 40)}
                      {row.gradingState === "LOCKED" && row.lockedById === user.userId ? (
                        <span className="ml-2 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">
                          kunci Anda
                        </span>
                      ) : ""}
                    </span>
                  </div>
                  <Link
                    href={`/petugas/jawaban/${row.id}`}
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
