import Link from "next/link";
import { headers } from "next/headers";
import { AppBar, AppFooter, StatusChip } from "@/components/chrome";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { formatJakarta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PesertaHome() {
  const user = await requirePageUser(["PARTICIPANT"]);
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") || headerList.get("host") || "localhost";
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "127.0.0.1";
  const rows = await prisma.sessionParticipant.findMany({
    where: { userId: user.userId },
    include: {
      session: {
        include: {
          exam: true,
          attendances: { where: { userId: user.userId } },
          attempts: { where: { userId: user.userId } },
        },
      },
    },
    orderBy: { examDate: "desc" },
  });
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AppBar title="Ujian Anda" name={user.name} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <p className="mb-6 text-ink-muted">Pilih ujian yang ditugaskan. Status di kanan menunjukkan langkah Anda berikutnya.</p>
        <ul className="flex flex-col gap-3">
          {rows.length === 0 ? <li className="rounded-md border border-line bg-paper p-6 text-sm text-ink-muted shadow-paper">Belum ada ujian yang ditugaskan.</li> : null}
          {rows.map((row) => {
            const attempt = row.session.attempts[0];
            const attended = row.session.attendances.length > 0;
            let status = "Belum absen";
            let tone: "idle" | "live" | "done" | "warn" = "warn";
            if (attended) {
              status = "Sudah absen";
              tone = "idle";
            }
            if (attempt?.status === "IN_PROGRESS") {
              status = "Mengerjakan";
              tone = "live";
            }
            if (attempt && attempt.status !== "IN_PROGRESS") {
              status = "Selesai";
              tone = "done";
            }
            return (
              <li key={row.id}>
                <Link href={`/peserta/sesi/${row.sessionId}`} className="flex items-center justify-between gap-4 rounded-md border border-line bg-paper p-4 shadow-paper hover:border-brand">
                  <span>
                    <span className="block font-semibold">{row.session.exam.name}</span>
                    <span className="mt-1 block text-sm text-ink-muted">
                      {row.session.name} · {formatJakarta(row.session.startsAt)}
                    </span>
                  </span>
                  <StatusChip label={status} tone={tone} />
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
      <AppFooter host={host} user={`${user.name} (${user.identity})`} ip={ip} />
    </div>
  );
}
