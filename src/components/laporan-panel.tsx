"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

export type LaporanSessionRow = {
  id: number;
  examName: string;
  sessionName: string;
  startsAtLabel: string;
  endsAtLabel: string;
  durationMinutes: number;
  participantCount: number;
  attendanceCount: number;
  attemptCount: number;
  status: "live" | "upcoming" | "done";
};

const statusMeta = {
  live: { label: "Berlangsung", className: "bg-brand-soft text-brand" },
  upcoming: { label: "Mendatang", className: "bg-page text-ink-muted" },
  done: { label: "Selesai", className: "bg-brand text-white" },
} as const;

type StatusFilter = "ALL" | LaporanSessionRow["status"];

function attendancePct(row: LaporanSessionRow) {
  if (row.participantCount <= 0) return 0;
  return Math.round((row.attendanceCount / row.participantCount) * 100);
}

export function LaporanPanel({ sessions }: { sessions: LaporanSessionRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      if (status !== "ALL" && session.status !== status) return false;
      if (!deferred) return true;
      const haystack = `${session.examName} ${session.sessionName} ${session.startsAtLabel}`.toLowerCase();
      return haystack.includes(deferred);
    });
  }, [deferred, sessions, status]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "ALL", label: "Semua" },
    { id: "live", label: "Berlangsung" },
    { id: "upcoming", label: "Mendatang" },
    { id: "done", label: "Selesai" },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Sesi laporan</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Menampilkan {filtered.length}
              {filtered.length !== sessions.length ? ` dari ${sessions.length}` : ""} sesi
            </p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Cari sesi</span>
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
              placeholder="Cari ujian atau sesi"
              className="w-full rounded-xl border border-line bg-page/60 py-2.5 pr-3 pl-9 text-sm font-normal text-ink placeholder:text-ink-muted focus:border-brand focus:bg-paper"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map((item) => {
            const active = status === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatus(item.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  active ? "bg-brand text-white" : "bg-page text-ink-muted hover:text-ink"
                }`}>
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-base font-semibold text-ink">{sessions.length === 0 ? "Belum ada sesi" : "Tidak ada yang cocok"}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
            {sessions.length === 0
              ? "Buat ujian dan sesi dulu. Laporan kehadiran serta nilai akan muncul di sini."
              : "Coba kata kunci atau filter status lain."}
          </p>
          {sessions.length === 0 ? (
            <Link
              href="/admin/ujian"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
              Ke daftar ujian
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line/70 md:hidden">
            {filtered.map((session) => {
              const meta = statusMeta[session.status];
              const pct = attendancePct(session);
              return (
                <li key={session.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>
                        {meta.label}
                      </span>
                      <p className="mt-2 truncate font-semibold text-ink">{session.examName}</p>
                      <p className="text-sm text-ink-muted">{session.sessionName}</p>
                      <p className="mt-1 text-xs text-ink-muted">{session.startsAtLabel}</p>
                      <p className="mt-2 text-xs text-ink-muted">
                        Hadir {session.attendanceCount}/{session.participantCount} ({pct}%) · {session.attemptCount} mulai
                      </p>
                    </div>
                    <Link
                      href={`/admin/laporan/${session.id}`}
                      className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand-soft">
                      Buka
                    </Link>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <a
                      href={`/api/admin/laporan/${session.id}/excel`}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-brand hover:text-brand">
                      Excel
                    </a>
                    <a
                      href={`/api/admin/laporan/${session.id}/pdf`}
                      className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:border-brand hover:text-brand">
                      PDF
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-page/80 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Ujian & sesi</th>
                  <th className="px-4 py-3.5">Jadwal</th>
                  <th className="px-4 py-3.5">Kehadiran</th>
                  <th className="px-4 py-3.5">Pengerjaan</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {filtered.map((session) => {
                  const meta = statusMeta[session.status];
                  const pct = attendancePct(session);
                  return (
                    <tr key={session.id} className="transition-colors hover:bg-brand-soft/25">
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link href={`/admin/laporan/${session.id}`} className="font-semibold text-ink hover:text-brand">
                          {session.examName}
                        </Link>
                        <span className="block text-xs text-ink-muted">{session.sessionName}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-ink">{session.startsAtLabel}</span>
                        <span className="block text-xs text-ink-muted">{session.durationMinutes} menit</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-digits font-semibold tabular-nums text-ink">
                          {session.attendanceCount}/{session.participantCount}
                        </span>
                        <span className="block text-xs text-ink-muted">{pct}% hadir</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-digits font-semibold tabular-nums text-ink">{session.attemptCount}</span>
                        <span className="block text-xs text-ink-muted">mulai mengerjakan</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a
                            href={`/api/admin/laporan/${session.id}/excel`}
                            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                            Excel
                          </a>
                          <a
                            href={`/api/admin/laporan/${session.id}/pdf`}
                            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                            PDF
                          </a>
                          <Link
                            href={`/admin/laporan/${session.id}`}
                            className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white">
                            Detail
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
