import { AdminShell } from "@/components/admin-shell";
import { ExamForm } from "@/components/admin-forms";
import { UjianPanel } from "@/components/ujian-panel";
import { formatJakarta } from "@/lib/format";
import { listAvailableCompetitions } from "@/server/competitions";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-digits text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}

export default async function UjianPage() {
  const user = await requirePageUser(["ADMIN"]);
  const [exams, packages] = await Promise.all([
    prisma.exam.findMany({
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { packages: true, attempts: true } } },
    }),
    prisma.questionPackage.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { _count: { select: { items: true } } },
    }),
  ]);

  let competitions: { id: number; name: string; jenjangGroups: ("SD" | "SMP" | "SMA")[] }[] = [];
  let competitionsError: string | null = null;
  try {
    competitions = await listAvailableCompetitions();
  } catch (error) {
    competitionsError = error instanceof Error ? error.message : "Gagal memuat daftar lomba.";
  }

  const published = exams.filter((exam) => exam.status === "PUBLISHED").length;
  const draft = exams.filter((exam) => exam.status === "DRAFT").length;
  const running = exams.filter((exam) => exam.phase === "RUNNING").length;

  return (
    <AdminShell name={user.name} current="/admin/ujian">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Jadwal & paket per jenjang</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Jadwal Ujian</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Buat ujian dari lomba OMBN, atur paket per jenjang, lalu juri memberi aba-aba mulai.
            </p>
          </div>
          <a
            href="#buat-ujian"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            Buat ujian
          </a>
        </header>

        <section aria-label="Ringkasan ujian" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total" value={exams.length} hint={`${running} sedang berjalan`} />
          <StatCard label="Terbit" value={published} hint="Siap / berjalan" />
          <StatCard label="Draf" value={draft} hint="Masih disiapkan" />
          <StatCard label="Paket" value={packages.length} hint="Template soal aktif" />
        </section>

        <UjianPanel
          exams={exams.map((exam) => ({
            id: exam.id,
            name: exam.name,
            examDateLabel: formatJakarta(exam.startsAt),
            durationMinutes: exam.durationMinutes,
            questionCount: exam._count.packages,
            sessionCount: exam._count.attempts,
            status: exam.status,
            phase: exam.phase,
          }))}
        />

        <section id="buat-ujian" className="scroll-mt-24">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Ujian baru</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Pilih lomba, lalu tetapkan paket soal per kelompok jenjang.</p>
          </div>
          <div className="max-w-2xl">
            <ExamForm
              competitions={competitions}
              competitionsError={competitionsError}
              packages={packages.map((pack) => ({
                id: pack.id,
                name: pack.name,
                itemCount: pack._count.items,
              }))}
            />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
