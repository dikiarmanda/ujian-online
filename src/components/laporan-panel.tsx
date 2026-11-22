"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";

export type LaporanSessionRow = {
  id: number;
  examName: string;
  sessionName: string;
  jenjangGroups: string;
  startsAt: Date;
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
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [startDate, setStartDate] = useState("");

  const filtered = useMemo(() => {
    return sessions.filter((session) => {
      if (status !== "ALL" && session.status !== status) return false;
      console.log(session.startsAt, startDate);
      if (startDate) {
        const sessionDate = new Date(session.startsAt);
        sessionDate.setHours(0, 0, 0, 0);
        const filterStart = new Date(startDate);
        filterStart.setHours(0, 0, 0, 0);
        if (sessionDate.getTime() !== filterStart.getTime()) return false;
      }

      return true;
    });
  }, [sessions, status, startDate]);

  const filters: { id: StatusFilter; label: string }[] = [
    { id: "ALL", label: "Semua" },
    { id: "live", label: "Berlangsung" },
    { id: "upcoming", label: "Mendatang" },
    { id: "done", label: "Selesai" },
  ];

  const headers = ["Status", "Ujian & sesi", "Jadwal", "Kehadiran", "Pengerjaan", "Aksi"];

  const rows = useMemo(() => {
    return filtered.map((session) => {
      const meta = statusMeta[session.status];
      const pct = attendancePct(session);
      return [
        <span key={`status-${session.id}`} className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${meta.className}`}>
          {meta.label}
        </span>,
        <div key={`name-${session.id}`} className="min-w-0">
          <Link href={`/admin/laporan/${session.id}`} className="font-semibold text-ink hover:text-brand block truncate">
            {session.examName} {session.jenjangGroups ? `(${JSON.parse(session.jenjangGroups).join(", ")})` : ""}
          </Link>
          <span className="block text-xs text-ink-muted truncate">{session.sessionName}</span>
        </div>,
        <div key={`schedule-${session.id}`}>
          <span className="text-ink">{session.startsAtLabel}</span>
          <span className="block text-xs text-ink-muted">{session.durationMinutes} menit</span>
        </div>,
        <div key={`attendance-${session.id}`}>
          <span className="font-digits font-semibold tabular-nums text-ink">
            {session.attendanceCount}/{session.participantCount}
          </span>
          <span className="block text-xs text-ink-muted">{pct}% hadir</span>
        </div>,
        <div key={`attempts-${session.id}`}>
          <span className="font-digits font-semibold tabular-nums text-ink">{session.attemptCount}</span>
          <span className="block text-xs text-ink-muted">mulai mengerjakan</span>
        </div>,
        <div key={`actions-${session.id}`} className="flex items-center gap-2">
          <a
            href={`/api/admin/laporan/${session.id}/excel`}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
            Excel
          </a>
          {/* <a
            href={`/api/admin/laporan/${session.id}/pdf`}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
            PDF
          </a> */}
          <Link
            href={`/admin/laporan/${session.id}`}
            className="rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand transition hover:bg-brand hover:text-white">
            Detail
          </Link>
        </div>,
      ];
    });
  }, [filtered]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line/80 bg-paper shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 pt-4 sm:px-5">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-ink">Sesi laporan</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {filtered.length} sesi
            {filtered.length !== sessions.length ? ` dari ${sessions.length}` : ""}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end px-4 sm:px-5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Tanggal Ujian
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-xl border border-line px-3 py-2.5 font-normal"
          />
        </label>
        {(startDate) && (
          <button
            type="button"
            onClick={() => {
              setStartDate("");
            }}
            className="mb-0.5 rounded-lg border border-line px-3 py-2.5 text-sm font-semibold text-ink-muted hover:border-brand hover:text-brand">
            <FontAwesomeIcon icon={Icon.Xmark} className="size-4 mr-2" />
            Reset filter tanggal
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong/60 bg-page/40 px-6 py-14 text-center">
          <p className="text-base font-semibold text-ink">Belum ada sesi</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-muted">
            Buat ujian dan sesi dulu. Laporan kehadiran serta nilai akan muncul di sini.
          </p>
          <Link
            href="/admin/ujian"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110">
            Ke daftar ujian
          </Link>
        </div>
      ) : (
        <DataTable
          headers={headers}
          rows={rows}
          searchPlaceholder="Cari ujian atau sesi"
        />
      )}
    </section>
  );
}
