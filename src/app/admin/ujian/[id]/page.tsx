import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { ExamControlButtons } from "@/components/admin-forms";
import { formatJakarta } from "@/lib/format";
import { getExamParticipantCounts } from "@/server/exams";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faPenToSquare } from "@fortawesome/free-solid-svg-icons";

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

export const dynamic = "force-dynamic";

const statusMeta = {
  DRAFT: { label: "Draf", className: "bg-page text-ink-muted" },
  PUBLISHED: { label: "Terbit", className: "bg-brand-soft text-brand" },
  ARCHIVED: { label: "Arsip", className: "bg-mark text-mark-ink" },
} as const;

const phaseMeta = {
  NOT_STARTED: { label: "Belum mulai", className: "bg-page text-ink-muted" },
  RUNNING: { label: "Berjalan", className: "bg-brand-soft text-brand" },
  ENDED: { label: "Selesai", className: "bg-brand text-white" },
} as const;

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
  const user = await requirePageUser(["ADMIN", "GRADER"]);
  const { id } = await params;
  const examId = Number(id);
  if (!Number.isFinite(examId)) notFound();

  const exam = await prisma.exam.findUnique({
    where: { id: examId, deletedAt: null },
    include: {
      packages: {
        include: {
          questionPackage: { select: { id: true, name: true } },
          questions: { include: { question: { select: { code: true, type: true, body: true } } }, orderBy: { sortOrder: "asc" } },
        },
        orderBy: { jenjang: "asc" },
      },
    },
  });
  if (!exam) notFound();
  console.log(exam.packages);
  const counts = await getExamParticipantCounts(exam.id);
  const status = statusMeta[exam.status];
  const phase = phaseMeta[exam.phase];

  return (
    <AdminShell name={user.name} current="/admin/ujian">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5">
          {user.role === "ADMIN" ? (
            <Link href="/admin/ujian" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
              Kembali ke daftar ujian
            </Link>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${phase.className}`}>{phase.label}</span>
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{exam.name}</h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                Competition #{exam.competitionId} · {exam.durationMinutes} menit · absensi {formatJakarta(exam.attendanceOpensAt)}
              </p>
              <p className="mt-1 text-sm text-ink-muted">Rencana {formatJakarta(exam.startsAt)}</p>
            </div>
            {user.role === "ADMIN" && exam.phase === "NOT_STARTED" ? (
              <Link href={`/admin/ujian/${exam.id}/edit`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
                Edit ujian
              </Link>
            ) : null}
          </div>
        </header>

        <section aria-label="Ringkasan peserta" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Absen" value={counts.attended} hint="Sudah konfirmasi kehadiran" />
          <StatCard label="Ruang tunggu" value={counts.waiting} hint="Absen, belum mulai soal" />
          <StatCard label="Mengerjakan" value={counts.working} hint="Timer peserta berjalan" />
          <StatCard label="Selesai" value={counts.finished} hint="Sudah kirim / waktu habis" />
        </section>

        <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Kontrol juri</h2>
          <p className="mt-0.5 text-sm text-ink-muted">MULAI membuka gerbang soal. SELESAI menutup semua pengerjaan terbuka.</p>
          <div className="mt-4">
            <ExamControlButtons examId={exam.id} phase={exam.phase} status={exam.status} />
          </div>
        </section>

        <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Paket per jenjang</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {exam.packages.map((pack) => (
              <li key={pack.id} className="rounded-xl border border-line/80 p-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-ink">
                    {pack.jenjang} · {pack.questionPackage.name}
                  </span>
                  <Link href={`/admin/paket/${pack.examId}`} className="inline-flex items-center rounded-lg border border-line bg-paper px-3 py-1.5 text-xs font-semibold text-brand hover:border-brand hover:text-brand transition">
                    <span className="inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faPenToSquare} className="text-[15px]" />
                      Edit
                    </span>
                  </Link>
                  <Link href={`/admin/paket/${pack.examId}/preview`} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-paper px-5 text-sm font-semibold text-ink shadow-sm transition hover:border-brand hover:text-brand">
                    <span className="inline-flex items-center gap-1">
                      <FontAwesomeIcon icon={faEye} className="text-[15px]" />
                      Preview
                    </span>
                  </Link>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{pack.questions.length} soal (snapshot)</p>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {pack.questions.slice(0, 3).map((item, index) => (
                    <li key={item.id} className="flex items-center gap-3 rounded-lg bg-page/80 px-3 py-2.5 text-sm">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">{index + 1}</span>
                      <span className="min-w-0">
                        <span className="font-semibold text-ink">{truncateText(item.question.body.replace(/<[^>]*>/g, ""), 20)}</span>
                        <span className="mt-0.5 block text-xs text-ink-muted">
                          {item.question.type === "ESSAY" ? "Uraian" : item.question.type === "SHORT_ANSWER" ? "Jawaban singkat" : "PG"} · benar {Number(item.weight)}
                          {item.question.type === "ESSAY" ? "" : ` · salah −${Number(item.wrongWeight)}`} · kosong 0
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
