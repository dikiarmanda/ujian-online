"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { ResetSessionButton } from "@/components/admin-forms";

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
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    if (!deferred) return users;
    return users.filter((user) => {
      const haystack = [user.name, user.identity, user.groupName ?? "", user.nisn ?? ""].join(" ").toLowerCase();
      return haystack.includes(deferred);
    });
  }, [deferred, users]);

  return (
    <section className="overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">Daftar peserta</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Menampilkan {filtered.length}
            {filtered.length !== users.length ? ` dari ${users.length}` : ""} akun
          </p>
        </div>
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Cari peserta</span>
          <svg
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari nama, nomor, atau kelompok"
            className="w-full rounded-xl border border-line bg-page/60 py-2.5 pr-3 pl-9 text-sm font-normal text-ink placeholder:text-ink-muted focus:border-brand focus:bg-paper"
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-base font-semibold text-ink">{users.length === 0 ? "Belum ada peserta" : "Tidak ada yang cocok"}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
            {users.length === 0
              ? "Jalankan sinkronisasi untuk menarik data peserta dari OMBN."
              : "Coba kata kunci lain, atau kosongkan pencarian."}
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line/70 md:hidden">
            {filtered.map((user) => (
              <li key={user.id} className="flex flex-col gap-3 px-4 py-4">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-xs font-semibold text-brand">
                    {initials(user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-ink">{user.name}</p>
                      {!user.isActive ? (
                        <span className="rounded-md bg-page px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted">Nonaktif</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 font-digits text-sm text-ink-muted">{user.identity}</p>
                    <p className="mt-1 text-xs text-ink-muted">{user.groupName || "Tanpa kelompok"}</p>
                    {user.nisn ? <p className="mt-0.5 text-xs text-ink-muted">NISN {user.nisn}</p> : null}
                  </div>
                </div>
                <div className="flex justify-end">
                  <ResetSessionButton userId={user.id} />
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-page/80 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  <th className="px-5 py-3.5">Peserta</th>
                  <th className="px-4 py-3.5">Identitas</th>
                  <th className="px-4 py-3.5">Kelompok</th>
                  <th className="px-4 py-3.5">NISN</th>
                  <th className="px-5 py-3.5 text-right">Sesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {filtered.map((user) => (
                  <tr key={user.id} className="transition-colors hover:bg-brand-soft/25">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-[11px] font-semibold text-brand">
                          {initials(user.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{user.name}</p>
                          {!user.isActive ? <p className="text-xs text-ink-muted">Nonaktif</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-digits text-ink tabular-nums">{user.identity}</span>
                    </td>
                    <td className="px-4 py-3.5 text-ink-muted">{user.groupName || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-digits text-ink-muted tabular-nums">{user.nisn || "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <ResetSessionButton userId={user.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
