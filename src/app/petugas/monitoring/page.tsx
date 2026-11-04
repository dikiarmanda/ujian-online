import { PetugasShell } from "@/components/petugas-shell";
import { PaginatedDataTable } from "@/components/data-table";
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

  if (!sessionUser?.externalId) {
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

export default async function MonitoringPage() {
  const user = await requirePageUser(["GRADER"]);
  const aksesLomba = await getAksesLomba(user.userId);

  const attempts = await prisma.examAttempt.findMany({
    where: {
      status: "IN_PROGRESS",
      ...(aksesLomba.length > 0 ? { exam: { competitionId: { in: aksesLomba } } } : {}),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          identity: true,
          groupName: true,
        },
      },
      exam: {
        select: {
          name: true,
          startsAt: true,
          durationMinutes: true,
          competitionId: true,
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  const now = new Date();

  const rows = attempts.map((attempt) => {
    const timeElapsed = attempt.startedAt
      ? Math.floor((now.getTime() - attempt.startedAt.getTime()) / 1000 / 60)
      : 0;
    const timeRemaining = attempt.exam.durationMinutes - timeElapsed;

    return {
      userId: attempt.user.id,
      name: attempt.user.name,
      identity: attempt.user.identity,
      groupName: attempt.user.groupName,
      examName: attempt.exam.name,
      startedAt: attempt.startedAt,
      timeElapsed,
      timeRemaining: Math.max(0, timeRemaining),
      attemptId: attempt.id,
    };
  });

  return (
    <PetugasShell name={user.name} current="/petugas/monitoring">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Monitoring Peserta</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {rows.length} peserta sedang mengerjakan ujian
          </p>
        </header>

        <section className="rounded-xl border border-line/80 bg-paper shadow-sm">
          <PaginatedDataTable
            headers={["Nama", "Identitas", "Kelompok", "Ujian", "Mulai", "Waktu Terpakai", "Sisa Waktu"]}
            rows={rows.map((row) => [
              <span className="font-semibold text-ink">{row.name}</span>,
              <span className="text-sm text-ink">{row.identity}</span>,
              <span className="text-sm text-ink-muted">{row.groupName ?? "—"}</span>,
              <span className="text-sm text-ink">{row.examName}</span>,
              <span className="text-xs text-ink-muted">{row.startedAt ? formatJakarta(row.startedAt) : "—"}</span>,
              <span className="text-sm font-digits text-ink tabular-nums">{row.timeElapsed} menit</span>,
              <span className={`text-sm font-digits tabular-nums ${row.timeRemaining <= 5 ? "text-mark" : "text-ink"}`}>
                {row.timeRemaining} menit
              </span>,
            ])}
            searchPlaceholder="Cari nama atau identitas"
          />
        </section>
      </div>
    </PetugasShell>
  );
}
