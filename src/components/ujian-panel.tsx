"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
import { api } from "@/lib/api";

export type UjianRow = {
  id: number;
  name: string;
  examDateLabel: string;
  examDate: Date;
  competitionLevel: string;
  durationMinutes: number;
  questionCount: number;
  sessionCount: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  phase?: "NOT_STARTED" | "RUNNING" | "ENDED";
  jenjangGroups?: string[];
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
  const [startDate, setStartDate] = useState("");
  const [jenjang, setJenjang] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<UjianRow["status"] | "">("");
  const [bulkPhase, setBulkPhase] = useState<UjianRow["phase"] | "">("");
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const filtered = useMemo(() => {
    const result = exams.filter((exam) => {
      if (status !== "ALL" && exam.status !== status) return false;

      // Search query filter
      if (deferred && !exam.name.toLowerCase().includes(deferred) && !exam.examDateLabel.toLowerCase().includes(deferred)) {
        return false;
      }

      // Date filter
      if (startDate) {
        const [year, month, day] = startDate.split('-').map(Number);
        const filterDate = new Date(year, month - 1, day);
        filterDate.setHours(0, 0, 0, 0);
        const examDate = new Date(exam.examDate);
        examDate.setHours(0, 0, 0, 0);
        if (examDate.getTime() !== filterDate.getTime()) return false;
      }

      // Jenjang filter
      if (jenjang !== "ALL") {
        const hasJenjang = exam.jenjangGroups && exam.jenjangGroups.includes(jenjang);
        if (!hasJenjang) return false;
      }

      return true;
    });
    return result;
  }, [deferred, exams, status, startDate, jenjang]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "ALL", label: "Semua" },
    { id: "PUBLISHED", label: "Terbit" },
    { id: "DRAFT", label: "Draf" },
    { id: "ARCHIVED", label: "Arsip" },
  ];

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filtered.map(e => e.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return;
    setBulkPending(true);
    setBulkError(null);
    try {
      await api("/api/admin/bulk-ujian", {
        body: {
          ids: Array.from(selectedIds),
          status: bulkStatus || undefined,
          phase: bulkPhase || undefined,
        },
      });
      window.location.reload();
    } catch (error) {
      setBulkError(error instanceof Error ? error.message : "Gagal mengupdate ujian.");
      setBulkPending(false);
    }
  };

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
        <div className="flex justify-between">
          <div className="flex flex-wrap items-start gap-1.5">
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
          <div className="flex flex-wrap gap-3 sm:gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-muted">Tanggal Mulai</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink focus:border-brand focus:bg-paper"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-muted">Jenjang</label>
              <select
                value={jenjang}
                onChange={(e) => setJenjang(e.target.value)}
                className="rounded-lg border border-line bg-page/60 px-3 py-2 text-sm text-ink focus:border-brand focus:bg-paper">
                <option value="ALL">Semua</option>
                <option value="SD">SD</option>
                <option value="MI">MI</option>
                <option value="SMP">SMP</option>
                <option value="MTS">MTS</option>
                <option value="SMA">SMA</option>
                <option value="SMK">SMK</option>
                <option value="MA">MA</option>
              </select>
            </div>
          </div>
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
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-line/70 bg-brand-soft/30 px-4 py-3 sm:px-5">
              <span className="text-sm font-semibold text-ink">{selectedIds.size} ujian dipilih</span>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as UjianRow["status"] | "")}
                className="rounded-lg border border-line bg-page/60 px-3 py-1.5 text-sm text-ink focus:border-brand focus:bg-paper">
                <option value="">Ubah status...</option>
                <option value="DRAFT">Draf</option>
                <option value="PUBLISHED">Terbit</option>
                <option value="ARCHIVED">Arsip</option>
              </select>
              <select
                value={bulkPhase}
                onChange={(e) => setBulkPhase(e.target.value as UjianRow["phase"] | "")}
                className="rounded-lg border border-line bg-page/60 px-3 py-1.5 text-sm text-ink focus:border-brand focus:bg-paper">
                <option value="">Ubah phase...</option>
                <option value="NOT_STARTED">Belum mulai</option>
                <option value="RUNNING">Berjalan</option>
                <option value="ENDED">Selesai</option>
              </select>
              <button
                onClick={handleBulkUpdate}
                disabled={bulkPending || (!bulkStatus && !bulkPhase)}
                className="inline-flex min-h-[32px] items-center justify-center rounded-lg bg-brand px-3 text-xs font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
                {bulkPending ? "Memproses..." : "Terapkan"}
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="inline-flex min-h-[32px] items-center justify-center rounded-lg border border-line px-3 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                Batal
              </button>
              {bulkError && <p className="text-xs text-alert">{bulkError}</p>}
            </div>
          )}
          <DataTable
            headers={[
              <input
                key="checkbox"
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="size-4 accent-[var(--color-brand)]"
              />,
              "Ujian",
              "Tingkat",
              "Tanggal",
              "Durasi",
              "Soal",
              "Sesi",
              "Status",
              "Aksi",
            ]}
            rows={filtered.map((exam) => [
              <input
                key={`checkbox-${exam.id}`}
                type="checkbox"
                checked={selectedIds.has(exam.id)}
                onChange={(e) => handleSelectOne(exam.id, e.target.checked)}
                className="size-4 accent-[var(--color-brand)]"
              />,
              <Link href={`/admin/ujian/${exam.id}`} className="font-semibold text-ink hover:text-brand">
                {exam.name} {exam.jenjangGroups && exam.jenjangGroups.length > 0 ? `(${exam.jenjangGroups.join(", ")})` : ""}
              </Link>,
              <span className="text-ink">{exam.competitionLevel}</span>,
              <span className="text-ink">{exam.examDateLabel}</span>,
              <span className="font-digits tabular-nums text-ink">{exam.durationMinutes} menit</span>,
              <span className="font-digits tabular-nums text-ink">{exam.questionCount}</span>,
              <span className="font-digits tabular-nums text-ink">{exam.sessionCount}</span>,
              <StatusBadge status={exam.status} />,
              <div className="text-right">
                <Link
                  href={`/admin/ujian/${exam.id}`}
                  className="inline-flex rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
                  Kelola
                </Link>
              </div>,
            ])}
            pageSizeOptions={[10, 25, 50, 100]}
            searchable={false}
          />
        </>
      )}
    </section>
  );
}
