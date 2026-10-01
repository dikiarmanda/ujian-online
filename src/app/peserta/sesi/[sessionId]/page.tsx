import { notFound } from "next/navigation";
import { SubmittedNotice } from "@/components/chrome";
import { ExamRoom } from "@/components/exam-room";
import { WaitingRoom } from "@/components/waiting-room";
import { getAttemptState } from "@/server/attempts";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export default async function SesiPesertaPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requirePageUser(["PARTICIPANT"]);
  const { sessionId } = await params;
  const id = Number(sessionId);
  const session = await prisma.examSession.findUnique({
    where: { id },
    include: {
      exam: true,
      participants: { where: { userId: user.userId } },
      attendances: { where: { userId: user.userId } },
      attempts: { where: { userId: user.userId } },
    },
  });
  if (!session || session.participants.length === 0) notFound();
  const attempt = session.attempts[0];
  if (attempt && attempt.status !== "IN_PROGRESS") {
    return <SubmittedNotice />;
  }
  if (attempt?.status === "IN_PROGRESS") {
    const state = await getAttemptState(attempt.id, user.userId);
    if (state.status !== "IN_PROGRESS") {
      return <SubmittedNotice />;
    }
    return (
      <ExamRoom
        initial={{
          attemptId: state.attemptId,
          examName: state.examName,
          sessionName: state.sessionName,
          serverNow: state.serverNow,
          deadlineAt: state.deadlineAt,
          lastQuestionIndex: state.lastQuestionIndex,
          questions: state.questions,
          answers: Object.fromEntries(
            Object.entries(state.answers).map(([key, value]) => [
              key,
              {
                selectedOptionId: value.selectedOptionId,
                essayText: value.essayText,
                isDoubtful: value.isDoubtful,
              },
            ]),
          ),
        }}
      />
    );
  }
  const now = new Date();
  return <WaitingRoom sessionId={session.id} examName={session.exam.name} sessionName={session.name} startsAt={session.startsAt.toISOString()} serverNow={now.toISOString()} attended={session.attendances.length > 0} canAttend={now >= session.attendanceOpensAt && now <= session.endsAt} />;
}
