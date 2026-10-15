"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

export type UjianRow = {
  id: number;
  name: string;
  examDateLabel: string;
  durationMinutes: number;
  questionCount: number;
  sessionCount: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
};

type StatusFilter = "ALL" | UjianRow["status"];

const statusMeta: Record<
  UjianRow["status"],
  { label: string; className: string }
> = {
  DRAFT: { label: "Draf", className: "bg-page text-ink-muted" },
  PUBLISHED: { label: "Terbit", className: "bg-brand-soft text-brand" },
  ARCHIVED: { label: "Arsip", className: "bg-mark text-mark-ink" },
};

function StatusBadge({ status }: { status: UjianRow["status"] }) {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

export function UjianPanel({ exams }: { exams: UjianRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    return exams.filter((exam) => {
      if (status !== "ALL" && exam.status !== status) return false;
      if (!deferred) return true;
      return exam.name.toLowerCase().includes(deferred) || exam.examDateLabel.toLowerCase().includes(deferred);
    });
  }, [deferred, exams, status]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "ALL", label: "Semua" },
    { id: "PUBLISHED", label: "Terbit" },
    { id: "DRAFT", label: "Draf" },
    { id: "ARCHIVED", label: "Arsip" },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm">
      <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Daftar ujian</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              Menampilkan {filtered.length}
              {filtered.length !== exams.length ? ` dari ${exams.length}` : ""} ujian
            </p>
          </div>
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Cari ujian</span>
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
              placeholder="Cari nama atau tanggal"
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
          <p className="text-base font-semibold text-ink">{exams.length === 0 ? "Belum ada ujian" : "Tidak ada yang cocok"}</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
            {exams.length === 0
              ? "Buat ujian pertama di formulir di bawah, lalu atur paket soal dan sesi."
              : "Coba kata kunci atau filter status lain."}
          </p>
          {exams.length === 0 ? (
            <a
              href="#buat-ujian"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
              Buat ujian pertama
            </a>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line/70 md:hidden">
            {filtered.map((exam) => (
              <li key={exam.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <StatusBadge status={exam.status} />
                    <Link href={`/admin/ujian/${exam.id}`} className="mt-2 block truncate font-semibold text-ink hover:text-brand">
                      {exam.name}
                    </Link>
                    <p className="mt-1 text-sm text-ink-muted">{exam.examDateLabel}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {exam.durationMinutes} mnt · {exam.questionCount} soal · {exam.sessionCount} sesi
                    </p>
                  </div>
                  <Link
                    href={`/admin/ujian/${exam.id}`}
                    className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:border-brand hover:bg-brand-soft">
                    Kelola
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-page/80 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  <th className="px-5 py-3.5">Ujian</th>
                  <th className="px-4 py-3.5">Tanggal</th>
                  <th className="px-4 py-3.5">Durasi</th>
                  <th className="px-4 py-3.5">Soal</th>
                  <th className="px-4 py-3.5">Sesi</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {filtered.map((exam) => (
                  <tr key={exam.id} className="transition-colors hover:bg-brand-soft/25">
                    <td className="px-5 py-3.5">
                      <Link href={`/admin/ujian/${exam.id}`} className="font-semibold text-ink hover:text-brand">
                        {exam.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-ink">{exam.examDateLabel}</td>
                    <td className="px-4 py-3.5">
                      <span className="font-digits tabular-nums text-ink">{exam.durationMinutes}</span>
                      <span className="text-ink-muted"> mnt</span>
                    </td>
                    <td className="px-4 py-3.5 font-digits tabular-nums text-ink">{exam.questionCount}</td>
                    <td className="px-4 py-3.5 font-digits tabular-nums text-ink">{exam.sessionCount}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={exam.status} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/ujian/${exam.id}`}
                        className="inline-flex rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                        Kelola
                      </Link>
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
