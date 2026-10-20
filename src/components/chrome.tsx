"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink transition hover:border-brand hover:text-brand"
      onClick={() => {
        void api("/api/auth/logout", { body: {} }).then(() => {
          window.location.href = "/login";
        });
      }}>
      Keluar
    </button>
  );
}

export function AppBar({ title, name, role }: { title: string; name?: string; role?: string }) {
  const [currentTime, setCurrentTime] = useState("");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    // Update clock every second
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}:${seconds}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Measure latency for participants
    if (role !== "PARTICIPANT") return;

    const measureLatency = async () => {
      const start = performance.now();
      try {
        await fetch("/api/health");
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch {
        setLatency(null);
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 5000); // Measure every 5 seconds
    return () => clearInterval(interval);
  }, [role]);

  const getLatencyLabel = (ms: number | null) => {
    if (ms === null) return { label: "—", className: "text-ink-muted" };
    if (ms < 100) return { label: "Bagus", className: "text-brand" };
    if (ms < 300) return { label: "Sedang", className: "text-ink" };
    return { label: "Kurang", className: "text-alert" };
  };

  const latencyInfo = getLatencyLabel(latency);

  return (
    <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="h-1 bg-brand" />
      <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/brand/logo-dikdas.png" alt="Logo Majelis Dikdasmen dan PNF PP Muhammadiyah" className="h-9 w-auto" />
          <div className="min-w-0">
            <p className="truncate text-xs text-ink-muted">Majelis Dikdasmen dan PNF PP Muhammadiyah</p>
            <p className="truncate font-semibold leading-tight">{title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="font-digits text-xs font-semibold text-ink">{currentTime} WIB</span>
            {role === "PARTICIPANT" && (
              <span className="text-[10px] text-ink-muted">
                Ping: <span className={latencyInfo.className}>{latencyInfo.label}</span>
                {latency !== null ? ` (${latency}ms)` : ""}
              </span>
            )}
          </div>
          {name ? (
            <>
              <span className="hidden max-w-48 truncate rounded-full bg-page px-3 py-1.5 text-sm text-ink-muted sm:inline">{name}</span>
              <LogoutButton />
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function StatusChip({ label, tone }: { label: string; tone: "idle" | "live" | "done" | "warn" }) {
  const toneClass = {
    idle: "bg-page text-ink-muted",
    live: "bg-brand-soft text-brand",
    done: "bg-brand text-white",
    warn: "bg-mark text-mark-ink",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold ${toneClass}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

export function SubmittedNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <section className="w-full max-w-md rounded-md border border-line bg-paper p-8 text-center shadow-paper">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-brand text-xl text-white" aria-hidden="true">
          ✓
        </div>
        <h1 className="text-lg font-semibold">Jawaban sudah terkirim</h1>
        <p className="mt-2 text-ink-muted">Ujian telah terkirim. Hasil tidak ditampilkan pada halaman ini.</p>
        <a href="/peserta" className="mt-6 inline-flex min-h-11 items-center rounded-md border border-line-strong px-4 text-sm font-semibold hover:border-brand hover:text-brand">
          Kembali ke daftar ujian
        </a>
      </section>
    </main>
  );
}

export function AppFooter({
  host,
  user,
  ip,
}: {
  host: string;
  user: string;
  ip: string;
}) {
  return (
    <footer className="mt-auto w-full border-t border-line bg-paper py-3 text-xs text-ink-muted">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
        <span>© Majelis Dikdasmen dan PNF PP Muhammadiyah</span>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <span>
            Host: <span className="font-medium text-ink">{host}</span>
          </span>
          <span>
            User: <span className="font-medium text-ink">{user}</span>
          </span>
          <span>
            IP: <span className="font-medium text-ink">{ip}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
