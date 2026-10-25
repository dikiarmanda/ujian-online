import { notFound } from "next/navigation";
import { ExamRoom } from "@/components/exam-room";
import { WaitingRoom } from "@/components/waiting-room";
import { getAttemptState } from "@/server/attempts";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function UjianPesertaPage({ params }: { params: Promise<{ examId: string }> }) {
  const user = await requirePageUser(["PARTICIPANT"]);
  const { examId: raw } = await params;
  const examId = Number(raw);
  if (!Number.isFinite(examId)) notFound();

  const exam = await prisma.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.status !== "PUBLISHED") notFound();
  if (user.competitionId && exam.competitionId !== user.competitionId) notFound();

  const attempt = await prisma.examAttempt.findUnique({
    where: { examId_userId: { examId, userId: user.userId } },
  });

  if (attempt?.startedAt && attempt.status === "IN_PROGRESS") {
    const state = await getAttemptState(attempt.id, user.userId);
    return (
      <ExamRoom
        initial={{
          attemptId: state.attemptId,
          examName: state.examName,
          sessionName: "",
          deadlineAt: state.expiresAt,
          serverNow: state.serverNow,
          lastQuestionIndex: state.lastQuestionIndex,
          questions: state.questions,
          answers: state.answers,
        }}
      />
    );
  }

  if (attempt && attempt.status !== "IN_PROGRESS") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4">
        <div className="flex flex-col items-center gap-4">
          <p className="rounded-md border border-line bg-paper p-6 text-sm shadow-paper">Ujian sudah selesai dikirim.</p>
          <a href="/peserta" className="inline-block rounded-md bg-brand px-5 py-2 text-sm font-semibold text-white shadow hover:bg-brand-dark transition">
            Kembali ke halaman awal
          </a>
        </div>
      </main>
    );
  }

  const now = new Date();
  return <WaitingRoom examId={exam.id} examName={exam.name} startsAt={exam.startsAt.toISOString()} serverNow={now.toISOString()} attended={Boolean(attempt?.attendedAt)} canAttend={now >= exam.attendanceOpensAt && exam.phase !== "ENDED"} initialPhase={exam.phase} />;
}
