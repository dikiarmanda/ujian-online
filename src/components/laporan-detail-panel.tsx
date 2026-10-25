"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
import { PaginatedDataTable } from "@/components/data-table";

export type LaporanResultRow = {
  userId: number;
  name: string;
  identity: string;
  groupName: string | null;
  status: string;
  mcScore: string;
  essayScore: string;
  totalScore: string;
  gradingStatus: string;
  gradingLabel: string;
  violations: number;
};

export type LaporanItemRow = {
  code: string;
  correct: number;
  total: number;
  percent: number;
};

const statusClass: Record<string, string> = {
  Selesai: "bg-brand text-white",
  Mengerjakan: "bg-brand-soft text-brand",
  "Sudah absen": "bg-mark text-mark-ink",
  "Belum absen": "bg-page text-ink-muted",
};

const gradingClass: Record<string, string> = {
  COMPLETED: "bg-brand-soft text-brand",
  PARTIAL: "bg-mark text-mark-ink",
  NOT_GRADED: "bg-page text-ink-muted",
};

type StatusFilter = "ALL" | "Selesai" | "Mengerjakan" | "Sudah absen" | "Belum absen";

export function LaporanDetailPanel({ rows, items }: { rows: LaporanResultRow[]; items: LaporanItemRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (status !== "ALL" && row.status !== status) return false;
      if (!deferred) return true;
      const haystack = `${row.name} ${row.identity} ${row.groupName ?? ""}`.toLowerCase();
      return haystack.includes(deferred);
    });
  }, [deferred, rows, status]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "ALL", label: "Semua" },
    { id: "Selesai", label: "Selesai" },
    { id: "Mengerjakan", label: "Mengerjakan" },
    { id: "Sudah absen", label: "Sudah absen" },
    { id: "Belum absen", label: "Belum absen" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="overflow-hidden rounded-xl border border-line/80 bg-paper shadow-sm">
        <div className="flex flex-col gap-3 border-b border-line/70 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-ink">Hasil peserta</h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Menampilkan {filtered.length}
                {filtered.length !== rows.length ? ` dari ${rows.length}` : ""} peserta
              </p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Cari peserta</span>
              <FontAwesomeIcon icon={Icon.Search} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari nama atau nomor"
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
          <div className="px-6 py-12 text-center">
            <p className="text-base font-semibold text-ink">{rows.length === 0 ? "Belum ada peserta" : "Tidak ada yang cocok"}</p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
              {rows.length === 0 ? "Tugaskan peserta ke sesi ini terlebih dahulu." : "Coba kata kunci atau filter status lain."}
            </p>
          </div>
        ) : (
          <PaginatedDataTable
            headers={["Peserta", "Status", "PG", "Uraian", "Total", "Penilaian", "Pelanggaran"]}
            rows={filtered.map((row) => [
              <div>
                <p className="font-semibold text-ink">{row.name}</p>
                <p className="text-xs text-ink-muted">
                  <span className="font-digits">{row.identity}</span>
                  {row.groupName ? ` · ${row.groupName}` : ""}
                </p>
              </div>,
              <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${statusClass[row.status] ?? "bg-page text-ink-muted"}`}>
                {row.status}
              </span>,
              <span className="font-digits tabular-nums text-ink">{row.mcScore || "—"}</span>,
              <span className="font-digits tabular-nums text-ink">{row.essayScore || "—"}</span>,
              <span className="font-digits font-semibold tabular-nums text-ink">{row.totalScore || "—"}</span>,
              row.gradingStatus ? (
                <span
                  className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${
                    gradingClass[row.gradingStatus] ?? "bg-page text-ink-muted"
                  }`}>
                  {row.gradingLabel}
                </span>
              ) : (
                <span className="text-ink-muted">—</span>
              ),
              <div className="text-right">
                {row.violations > 0 ? (
                  <span className="font-digits font-semibold text-alert tabular-nums">{row.violations}</span>
                ) : (
                  <span className="text-ink-muted">0</span>
                )}
              </div>,
            ])}
            itemsPerPage={10}
          />
        )}
      </section>

      <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Analisis soal PG</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Persentase jawaban benar di antara peserta yang sudah selesai.</p>
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong/60 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink">Belum ada data analisis</p>
            <p className="mt-1 text-xs text-ink-muted">Analisis muncul setelah ada soal pilihan ganda dan peserta selesai mengerjakan.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item, index) => (
              <li key={`${item.code}-${index}`} className="rounded-xl border border-line/70 px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold text-ink">{item.code}</p>
                  <p className="font-digits text-sm font-semibold tabular-nums text-ink">{item.percent}%</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-page">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  <span className="font-digits font-semibold text-ink">{item.correct}</span> benar dari{" "}
                  <span className="font-digits font-semibold text-ink">{item.total}</span> peserta selesai
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
