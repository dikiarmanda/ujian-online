import Link from "next/link";
import { AdminShell, DataTable } from "@/components/admin-shell";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatJakarta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LaporanIndexPage() {
  const user = await requirePageUser(["ADMIN"]);
  const sessions = await prisma.examSession.findMany({ include: { exam: true }, orderBy: { startsAt: "desc" } });
  return (
    <AdminShell name={user.name} current="/admin/laporan">
      <h1 className="mb-4 text-lg font-semibold">Laporan</h1>
      <DataTable
        headers={["Ujian", "Sesi", "Mulai"]}
        rows={sessions.map((session) => [
          session.exam.name,
          <Link key={session.id} href={`/admin/laporan/${session.id}`} className="text-brand">{session.name}</Link>,
          formatJakarta(session.startsAt),
        ])}
      />
    </AdminShell>
  );
}
