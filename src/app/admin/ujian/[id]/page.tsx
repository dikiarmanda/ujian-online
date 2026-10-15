import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PackageForm, SessionForm } from "@/components/admin-forms";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatExamDate } from "@/server/exam-rules";

export const dynamic = "force-dynamic";

const statusMeta = {
  DRAFT: { label: "Draf", className: "bg-page text-ink-muted" },
  PUBLISHED: { label: "Terbit", className: "bg-brand-soft text-brand" },
  ARCHIVED: { label: "Arsip", className: "bg-mark text-mark-ink" },
} as const;

function getSessionState(startsAt: Date, endsAt: Date, now: Date) {
  if (now >= startsAt && now <= endsAt) return { label: "Berlangsung", className: "bg-brand-soft text-brand" };
  if (now < startsAt) return { label: "Mendatang", className: "bg-page text-ink-muted" };
  return { label: "Selesai", className: "bg-brand text-white" };
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-digits text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}

export default async function UjianDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser(["ADMIN"]);
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) notFound();

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: { include: { question: { select: { code: true, type: true } } }, orderBy: { sortOrder: "asc" } },
      sessions: {
        orderBy: { startsAt: "asc" },
        include: { _count: { select: { participants: true, attempts: true } } },
      },
    },
  });
  if (!exam) notFound();

  const questions = await prisma.question.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      defaultWeight: true,
      type: true,
      category: { select: { name: true } },
    },
  });

  const now = new Date();
  const status = statusMeta[exam.status];
  const totalWeight = exam.questions.reduce((sum, item) => sum + Number(item.weight), 0);
  const liveSessions = exam.sessions.filter((session) => now >= session.startsAt && now <= session.endsAt).length;
  const upcomingSessions = exam.sessions.filter((session) => session.startsAt > now).length;

  return (
    <AdminShell name={user.name} current="/admin/ujian">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          <Link href="/admin/ujian" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M19 12H7M11 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Kembali ke daftar ujian
          </Link>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${status.className}`}>
                  {status.label}
                </span>
                {exam.shuffleQuestions ? (
                  <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Acak soal</span>
                ) : null}
                {exam.shuffleOptions ? (
                  <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Acak opsi</span>
                ) : null}
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{exam.name}</h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                {formatExamDate(exam.examDate)} · {exam.durationMinutes} menit
              </p>
            </div>
            <a
              href="#tambah-sesi"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
              Tambah sesi
            </a>
          </div>
        </header>

        <section aria-label="Ringkasan ujian" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Soal" value={exam.questions.length} hint={`Total bobot ${totalWeight}`} />
          <StatCard label="Sesi" value={exam.sessions.length} hint={liveSessions ? `${liveSessions} berlangsung` : `${upcomingSessions} mendatang`} />
          <StatCard
            label="Peserta"
            value={exam.sessions.reduce((sum, session) => sum + session._count.participants, 0)}
            hint="Jumlah penugasan di semua sesi"
          />
          <StatCard
            label="Pengerjaan"
            value={exam.sessions.reduce((sum, session) => sum + session._count.attempts, 0)}
            hint="Sudah mulai mengerjakan"
          />
        </section>

        <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold tracking-tight text-ink">Paket soal</h2>
              <p className="mt-0.5 text-sm text-ink-muted">Pilih soal dari bank yang akan masuk ke ujian ini.</p>
            </div>
            <PackageForm
              examId={exam.id}
              questions={questions.map((question) => ({
                id: question.id,
                code: question.code,
                defaultWeight: question.defaultWeight.toString(),
                type: question.type,
                categoryName: question.category.name,
              }))}
              selected={exam.questions.map((item) => item.questionId)}
            />
          </section>

          <section className="flex flex-col gap-4">
            <div className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-ink">Sesi</h2>
                  <p className="mt-0.5 text-sm text-ink-muted">Jadwal pelaksanaan untuk peserta.</p>
                </div>
                <a href="#tambah-sesi" className="shrink-0 text-sm font-semibold text-brand hover:underline">
                  + Baru
                </a>
              </div>

              {exam.sessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line-strong/60 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-ink">Belum ada sesi</p>
                  <p className="mt-1 text-xs text-ink-muted">Buat sesi agar peserta bisa dijadwalkan masuk ujian.</p>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {exam.sessions.map((session) => {
                    const state = getSessionState(session.startsAt, session.endsAt, now);
                    return (
                      <li key={session.id}>
                        <Link
                          href={`/admin/sesi/${session.id}`}
                          className="block rounded-xl border border-line/80 p-4 transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${state.className}`}>
                                {state.label}
                              </span>
                              <p className="mt-2 truncate font-semibold text-ink">{session.name}</p>
                              <p className="mt-1 text-xs text-ink-muted">
                                {formatJakarta(session.startsAt)}
                                <span className="mx-1">→</span>
                                {formatJakarta(session.endsAt)}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-brand">Kelola</span>
                          </div>
                          <div className="mt-3 flex gap-4 text-xs text-ink-muted">
                            <span>
                              <span className="font-digits font-semibold text-ink tabular-nums">{session._count.participants}</span> peserta
                            </span>
                            <span>
                              <span className="font-digits font-semibold text-ink tabular-nums">{session._count.attempts}</span> pengerjaan
                            </span>
                            {session.capacity != null ? (
                              <span>
                                kuota <span className="font-digits font-semibold text-ink tabular-nums">{session.capacity}</span>
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div id="tambah-sesi" className="scroll-mt-24 rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold tracking-tight text-ink">Tambah sesi</h2>
                <p className="mt-0.5 text-sm text-ink-muted">Tentukan jendela absensi dan waktu pengerjaan.</p>
              </div>
              <SessionForm examId={exam.id} />
            </div>
          </section>
        </div>

        {exam.questions.length > 0 ? (
          <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-semibold tracking-tight text-ink">Soal di paket</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Urutan saat ini di paket ujian.</p>
            <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {exam.questions.map((item, index) => (
                <li key={item.id} className="flex items-center gap-3 rounded-lg bg-page/80 px-3 py-2.5 text-sm">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="font-semibold text-ink">{item.question.code}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {item.question.type === "ESSAY" ? "Uraian" : "PG"} · bobot {Number(item.weight)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </AdminShell>
  );
}
