import Link from "next/link";
import { AdminShell, DataTable } from "@/components/admin-shell";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatJakarta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const user = await requirePageUser(["ADMIN"]);
  const sessions = await prisma.examSession.findMany({
    include: { exam: true, _count: { select: { participants: true, attempts: true } } },
    orderBy: { startsAt: "desc" },
    take: 12,
  });
  return (
    <AdminShell name={user.name} current="/admin">
      <h1 className="mb-4 text-lg font-semibold">Sesi</h1>
      <DataTable
        headers={["Ujian", "Sesi", "Mulai", "Peserta", "Pengerjaan"]}
        rows={sessions.map((session) => [
          session.exam.name,
          <Link key={session.id} href={`/admin/sesi/${session.id}`} className="text-brand">{session.name}</Link>,
          formatJakarta(session.startsAt),
          String(session._count.participants),
          String(session._count.attempts),
        ])}
      />
    </AdminShell>
  );
}
