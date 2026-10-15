import { AdminShell } from "@/components/admin-shell";
import { SyncButton } from "@/components/admin-forms";
import { PesertaPanel } from "@/components/peserta-panel";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";
import { listSyncLogs } from "@/server/sync";

export const dynamic = "force-dynamic";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl border border-line/80 bg-paper p-4 shadow-sm">
      <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</p>
      <p className="mt-2 font-digits text-2xl font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}

export default async function PesertaAdminPage() {
  const user = await requirePageUser(["ADMIN"]);
  const [users, logs, totalCount, activeCount, groupRows] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PARTICIPANT" },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, identity: true, groupName: true, nisn: true, isActive: true },
    }),
    listSyncLogs(),
    prisma.user.count({ where: { role: "PARTICIPANT" } }),
    prisma.user.count({ where: { role: "PARTICIPANT", isActive: true } }),
    prisma.user.findMany({
      where: { role: "PARTICIPANT", groupName: { not: null } },
      select: { groupName: true },
      distinct: ["groupName"],
    }),
  ]);

  const lastLog = logs[0] ?? null;
  const lastSyncLabel = lastLog ? formatJakarta(lastLog.startedAt) : "Belum pernah";
  const lastSyncHint = lastLog
    ? lastLog.failedCount > 0
      ? `${lastLog.successCount} berhasil · ${lastLog.failedCount} gagal`
      : `${lastLog.successCount} berhasil disimpan`
    : "Jalankan sinkron untuk menarik data OMBN";

  return (
    <AdminShell name={user.name} current="/admin/peserta">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Manajemen akun</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Peserta</h1>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Sinkronkan data dari OMBN, cek daftar peserta, dan reset sesi login bila diperlukan.
            </p>
          </div>
          <SyncButton />
        </header>

        <section aria-label="Ringkasan peserta" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Total"
            value={totalCount}
            hint={totalCount > users.length ? `Daftar menampilkan ${users.length} teratas` : "Akun peserta terdaftar"}
          />
          <StatCard label="Aktif" value={activeCount} hint="Dapat masuk ke ruang ujian" />
          <StatCard label="Kelompok" value={groupRows.length} hint="Kelas atau sekolah unik" />
          <StatCard label="Sinkron terakhir" value={lastLog ? lastLog.successCount : "—"} hint={`${lastSyncLabel} · ${lastSyncHint}`} />
        </section>

        <PesertaPanel users={users} />

        <section className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">Riwayat sinkronisasi</h2>
            <p className="mt-0.5 text-sm text-ink-muted">20 proses terakhir, dari yang paling baru.</p>
          </div>

          {logs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong/60 bg-paper px-6 py-10 text-center shadow-sm">
              <p className="text-base font-semibold text-ink">Belum ada riwayat</p>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-ink-muted">
                Setelah Anda menjalankan sinkronisasi, ringkasan keberhasilan dan kegagalan akan muncul di sini.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {logs.map((log) => {
                const hasFailures = log.failedCount > 0 || log.failures.length > 0;
                return (
                  <li
                    key={log.id}
                    className={`rounded-xl border bg-paper p-4 shadow-sm sm:p-5 ${
                      hasFailures ? "border-mark-edge/30" : "border-line/80"
                    }`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
                              hasFailures ? "bg-mark text-mark-ink" : "bg-brand-soft text-brand"
                            }`}>
                            {hasFailures ? "Sebagian gagal" : "Berhasil"}
                          </span>
                          <p className="text-sm font-semibold text-ink">{formatJakarta(log.startedAt)}</p>
                        </div>
                        <p className="mt-1.5 text-sm text-ink-muted">
                          <span className="font-digits font-semibold text-ink tabular-nums">{log.successCount}</span> berhasil
                          {" · "}
                          <span className="font-digits font-semibold text-ink tabular-nums">{log.failedCount}</span> gagal
                          {log.triggeredBy ? ` · oleh ${log.triggeredBy.name}` : " · terjadwal"}
                        </p>
                        {log.message ? <p className="mt-1 text-sm text-ink-muted">{log.message}</p> : null}
                      </div>
                    </div>
                    {log.failures.length > 0 ? (
                      <ul className="mt-3 space-y-1.5 rounded-lg bg-page/80 px-3 py-2.5">
                        {log.failures.slice(0, 5).map((failure) => (
                          <li key={failure.id} className="text-xs leading-relaxed text-alert">
                            <span className="font-semibold">{failure.identity || failure.externalId || "tanpa identitas"}</span>
                            {": "}
                            {failure.reason}
                          </li>
                        ))}
                        {log.failures.length > 5 ? (
                          <li className="text-xs text-ink-muted">+{log.failures.length - 5} kegagalan lainnya</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
