import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell, DataTable } from "@/components/admin-shell";
import { AssignForm, ExtraTimeForm, RemoveParticipantButton } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function statusLabel(attended: boolean, attemptStatus?: string): string {
  if (attemptStatus === "IN_PROGRESS") return "Mengerjakan";
  if (attemptStatus === "SUBMITTED" || attemptStatus === "TIME_EXPIRED") return "Selesai";
  if (attended) return "Sudah absen";
  return "Belum absen";
}

export default async function SesiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requirePageUser(["ADMIN"]);
  const { id } = await params;
  const session = await prisma.examSession.findUnique({
    where: { id: Number(id) },
    include: {
      exam: true,
      participants: { include: { user: true } },
      attendances: true,
      attempts: { include: { violations: true, answers: { where: { gradingState: { in: ["PENDING", "LOCKED"] } } } } },
    },
  });
  if (!session) notFound();
  const attended = new Set(session.attendances.map((row) => row.userId));
  const attemptByUser = new Map(session.attempts.map((attempt) => [attempt.userId, attempt]));
  const candidates = await prisma.user.findMany({
    where: { role: "PARTICIPANT", isActive: true, id: { notIn: session.participants.map((row) => row.userId) } },
    orderBy: { name: "asc" },
    take: 200,
  });
  return (
    <AdminShell name={admin.name} current="/admin/ujian">
      <h1 className="text-lg font-semibold">{session.exam.name}</h1>
      <p className="mb-4 text-sm text-ink-muted">{session.name}</p>
      <AssignForm sessionId={session.id} users={candidates} />
      <div className="mt-4">
        <DataTable
          headers={["Peserta", "Status", "Pelanggaran", "Waktu", ""]}
          rows={session.participants.map((participant) => {
            const attempt = attemptByUser.get(participant.userId);
            return [
              participant.user.name,
              statusLabel(attended.has(participant.userId), attempt?.status),
              String(attempt?.violations.length ?? 0),
              attempt ? <ExtraTimeForm key={attempt.id} attemptId={attempt.id} /> : "-",
              <RemoveParticipantButton key={participant.userId} sessionId={session.id} userId={participant.userId} />,
            ];
          })}
        />
      </div>
      <p className="mt-4 text-sm">
        <Link className="text-brand" href={`/admin/laporan/${session.id}`}>Lihat laporan sesi ini</Link>
      </p>
    </AdminShell>
  );
}
