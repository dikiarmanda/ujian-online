import { AdminShell, DataTable } from "@/components/admin-shell";
import { ResetSessionButton, SyncButton } from "@/components/admin-forms";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { listSyncLogs } from "@/server/sync";
import { formatJakarta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PesertaAdminPage() {
  const user = await requirePageUser(["ADMIN"]);
  const [users, logs] = await Promise.all([prisma.user.findMany({ where: { role: "PARTICIPANT" }, orderBy: { name: "asc" }, take: 200 }), listSyncLogs()]);
  return (
    <AdminShell name={user.name} current="/admin/peserta">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Peserta</h1>
        <SyncButton />
      </div>
      <DataTable headers={["Nama", "Identitas", "Kelompok", "Sesi"]} rows={users.map((row) => [row.name, row.identity, row.groupName ?? "-", <ResetSessionButton key={row.id} userId={row.id} />])} />
      <h2 className="mt-8 mb-3 text-base font-semibold">Riwayat sinkronisasi</h2>
      <div className="flex flex-col gap-3">
        {logs.map((log) => (
          <article key={log.id} className="rounded-md border border-line bg-paper p-4 text-sm shadow-paper">
            <p>
              {formatJakarta(log.startedAt)} · berhasil {log.successCount} · gagal {log.failedCount}
              {log.triggeredBy ? ` · ${log.triggeredBy.name}` : ""}
            </p>
            {log.message ? <p className="text-ink-muted">{log.message}</p> : null}
            {log.failures.map((failure) => (
              <p key={failure.id} className="text-alert">
                {failure.identity || failure.externalId || "tanpa identitas"}: {failure.reason}
              </p>
            ))}
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
