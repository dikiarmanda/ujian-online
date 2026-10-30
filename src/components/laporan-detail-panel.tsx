"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  attemptId: number;
};

export type LaporanItemRow = {
  code: string;
  question: string;
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
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const groupedItems = useMemo(() => {
    const grouped = new Map<string, { question: string; correct: number; total: number }>();
    for (const item of items) {
      const existing = grouped.get(item.code) ?? { question: item.question, correct: 0, total: 0 };
      grouped.set(item.code, {
        question: existing.question,
        correct: existing.correct + item.correct,
        total: existing.total + item.total,
      });
    }
    return Array.from(grouped.entries()).map(([code, data]) => ({
      code,
      question: data.question,
      correct: data.correct,
      total: data.total,
      percent: data.total > 0 ? Math.round((data.correct / data.total) * 1000) / 10 : 0,
    }));
  }, [items]);

  const filtered = useMemo(() => {
    if (status === "ALL") return rows;
    return rows.filter((row) => row.status === status);
  }, [rows, status]);

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
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Hasil peserta</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              {filtered.length}
              {filtered.length !== rows.length ? ` dari ${rows.length}` : ""} peserta
            </p>
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
              {rows.length === 0 ? "Tugaskan peserta ke sesi ini terlebih dahulu." : "Coba filter status lain."}
            </p>
          </div>
        ) : (
          <div>
          <PaginatedDataTable
            headers={["Peserta", "Status", "Otomatis", "Uraian", "Total", "Penilaian", "Pelanggaran"]}
            rows={filtered.map((row) => [
              <Link href={`/admin/laporan/peserta/${row.attemptId}`} className="block">
                <p className="font-semibold text-ink hover:text-brand">{row.name}</p>
                <p className="text-xs text-ink-muted">
                  <span className="font-digits">{row.identity}</span>
                  {row.groupName ? ` · ${row.groupName}` : ""}
                </p>
              </Link>,
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
            searchPlaceholder="Cari nama atau nomor"
          />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-line/80 bg-paper shadow-sm">
        <div className="p-5 pb-0 sm:p-6 sm:pb-0">
          <h2 className="text-lg font-semibold tracking-tight text-ink">Analisis soal otomatis</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Persentase jawaban benar untuk pilihan ganda dan jawaban singkat.</p>
        </div>

        {groupedItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong/60 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink">Belum ada data analisis</p>
            <p className="mt-1 text-xs text-ink-muted">Analisis muncul setelah ada soal otomatis dan peserta selesai mengerjakan.</p>
          </div>
        ) : (
          <PaginatedDataTable
            headers={["Soal", "Persentase", "Benar", "Total"]}
            rows={groupedItems.map((item) => [
              <span className="font-semibold text-ink">{item.question}</span>,
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-digits text-sm font-semibold tabular-nums text-ink">{item.percent}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-page">
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, item.percent))}%` }}
                  />
                </div>
              </div>,
              <span className="font-digits tabular-nums text-ink">{item.correct}</span>,
              <span className="font-digits tabular-nums text-ink">{item.total}</span>,
            ])}
            searchPlaceholder="Cari kode soal"
          />
        )}
      </section>
    </div>
  );
}
