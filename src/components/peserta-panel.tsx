"use client";

import { useMemo } from "react";
import { ResetSessionButton } from "@/components/admin-forms";
import { PaginatedDataTable } from "@/components/data-table";

export type PesertaRow = {
  id: number;
  name: string;
  identity: string;
  groupName: string | null;
  nisn: string | null;
  isActive: boolean;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function PesertaPanel({ users }: { users: PesertaRow[] }) {
  const headers = ["Peserta", "Identitas", "Kelompok", "NISN", "Sesi"];

  const rows = useMemo(() => {
    return users.map((user) => [
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[11px] font-semibold text-brand">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{user.name}</p>
          {!user.isActive ? <p className="text-xs text-ink-muted">Nonaktif</p> : null}
        </div>
      </div>,
      <span className="font-digits text-ink tabular-nums">{user.identity}</span>,
      user.groupName || "—",
      <span className="font-digits text-ink-muted tabular-nums">{user.nisn || "—"}</span>,
      <div className="flex justify-end">
        <ResetSessionButton userId={user.id} />
      </div>,
    ]);
  }, [users]);

  return (
    <section className="overflow-hidden rounded-xl border border-line/80 bg-paper p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-ink">Daftar peserta</h2>
        <p className="mt-0.5 text-sm text-ink-muted">{users.length} akun</p>
      </div>

      {users.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-base font-semibold text-ink">Belum ada peserta</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
            Jalankan sinkronisasi untuk menarik data peserta dari OMBN.
          </p>
        </div>
      ) : (
        <PaginatedDataTable headers={headers} rows={rows} searchPlaceholder="Cari nama, nomor, atau kelompok" />
      )}
    </section>
  );
}
