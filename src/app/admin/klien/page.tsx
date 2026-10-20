import { CreateClientForm, CreateKeyButton, RevokeClientButton, RevokeKeyButton } from "@/components/api-client-forms";
import { AdminShell } from "@/components/admin-shell";
import { formatJakarta } from "@/lib/format";
import { requirePageUser } from "@/server/current-user";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

function ipList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export default async function ApiClientPage() {
  const user = await requirePageUser(["ADMIN"]);
  const [clients, exams] = await Promise.all([
    prisma.apiClient.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        exams: { include: { exam: { select: { name: true } } } },
        keys: { orderBy: { createdAt: "desc" } },
        accessLogs: { orderBy: { createdAt: "desc" }, take: 8 },
      },
    }),
    prisma.exam.findMany({ orderBy: { startsAt: "desc" }, select: { id: true, name: true } }),
  ]);
  return (
    <AdminShell name={user.name} current="/admin/klien">
      <h1 className="mb-6 text-lg font-semibold">Klien API</h1>
      <CreateClientForm exams={exams} />
      <div className="mt-8 flex flex-col gap-4">
        {clients.map((client) => (
          <article key={client.id} className="rounded-md border border-line bg-paper p-4 text-sm shadow-paper">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{client.name}</h2>
                <p className="text-ink-muted">
                  {client.status === "ACTIVE" ? "Aktif" : "Dicabut"} · {client.rateLimitPerMinute} permintaan/menit
                  {client.allExams ? " · semua ujian" : ""}
                </p>
                {client.description ? <p className="mt-1">{client.description}</p> : null}
                <p className="mt-1 text-ink-muted">
                  Ujian: {client.allExams ? "semua" : client.exams.map((item) => item.exam.name).join(", ") || "belum dipilih"}
                </p>
                <p className="text-ink-muted">IP: {ipList(client.allowedIps).join(", ") || "semua"}</p>
              </div>
              {client.status === "ACTIVE" ? <RevokeClientButton clientId={client.id} /> : null}
            </div>
            <h3 className="mt-4 font-semibold">Kunci</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {client.keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-mono">{key.prefix}…</span>
                    {key.revokedAt ? " · dicabut" : ""}
                    {key.expiresAt ? ` · kedaluwarsa ${formatJakarta(key.expiresAt)}` : ""}
                    {key.lastUsedAt ? ` · terakhir ${formatJakarta(key.lastUsedAt)}` : ""}
                  </span>
                  {key.revokedAt ? null : <RevokeKeyButton clientId={client.id} keyId={key.id} />}
                </li>
              ))}
            </ul>
            {client.status === "ACTIVE" ? (
              <div className="mt-2">
                <CreateKeyButton clientId={client.id} />
              </div>
            ) : null}
            <h3 className="mt-4 font-semibold">Log akses terakhir</h3>
            {client.accessLogs.length ? (
              <ul className="mt-2 text-ink-muted">
                {client.accessLogs.map((log) => (
                  <li key={log.id}>
                    {formatJakarta(log.createdAt)} · {log.method} {log.path} · {log.statusCode} · {log.durationMs} ms
                    {log.ipAddress ? ` · ${log.ipAddress}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-ink-muted">Belum ada akses.</p>
            )}
          </article>
        ))}
      </div>
    </AdminShell>
  );
}
