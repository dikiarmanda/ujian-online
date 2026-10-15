import { AdminShell } from "@/components/admin-shell";
import { ExamForm } from "@/components/admin-forms";
import { UjianPanel } from "@/components/ujian-panel";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatExamDate } from "@/server/exam-rules";

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
  const exams = await prisma.exam.findMany({
    orderBy: { examDate: "desc" },
    include: { _count: { select: { sessions: true, questions: true } } },
  });

  const published = exams.filter((exam) => exam.status === "PUBLISHED").length;
  const draft = exams.filter((exam) => exam.status === "DRAFT").length;
  const archived = exams.filter((exam) => exam.status === "ARCHIVED").length;
  const totalSessions = exams.reduce((sum, exam) => sum + exam._count.sessions, 0);

  return (
    <AdminShell name={user.name} current="/admin/ujian">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Jadwal & paket soal</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Jadwal Ujian</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Kelola ujian, atur paket soal, lalu buat sesi untuk peserta.
            </p>
          </div>
          <a
            href="#buat-ujian"
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            Buat ujian
          </a>
        </header>

        <section aria-label="Ringkasan ujian" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total" value={exams.length} hint={`${totalSessions} sesi terdaftar`} />
          <StatCard label="Terbit" value={published} hint="Siap dijadwalkan / berjalan" />
          <StatCard label="Draf" value={draft} hint="Masih disiapkan" />
          <StatCard label="Arsip" value={archived} hint="Tidak dipakai lagi" />
        </section>

        <UjianPanel
          exams={exams.map((exam) => ({
            id: exam.id,
            name: exam.name,
            examDateLabel: formatExamDate(exam.examDate),
            durationMinutes: exam.durationMinutes,
            questionCount: exam._count.questions,
            sessionCount: exam._count.sessions,
            status: exam.status,
          }))}
        />

        <section id="buat-ujian" className="scroll-mt-24">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-ink">Ujian baru</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Setelah dibuat, Anda bisa menyusun paket soal dan menambahkan sesi.
            </p>
          </div>
          <div className="max-w-2xl">
            <ExamForm />
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
