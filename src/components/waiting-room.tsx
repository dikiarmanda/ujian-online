"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function WaitingRoom({ sessionId, examName, sessionName, startsAt, serverNow, attended, canAttend }: { sessionId: number; examName: string; sessionName: string; startsAt: string; serverNow: string; attended: boolean; canAttend: boolean }) {
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  const [attending, setAttending] = useState(false);
  const [entering, setEntering] = useState(false);
  const [present, setPresent] = useState(attended);
  const startMs = new Date(startsAt).getTime();
  const open = now + offset >= startMs;
  const remain = Math.max(0, startMs - (now + offset));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(startsAt));
  const step = !present ? 1 : !open ? 2 : 3;

  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <section className="w-full max-w-lg rounded-md border border-line bg-paper p-8 shadow-paper">
        <img src="/brand/logo.svg" alt="" className="h-12 w-auto" />
        <p className="mt-6 text-xs font-semibold tracking-wide text-brand uppercase">Ruang tunggu</p>
        <h1 className="mt-1 text-xl font-semibold">{examName}</h1>
        <p className="text-sm text-ink-muted">{sessionName}</p>
        <p className="mt-6 text-sm">Ujian dimulai pukul {clock}. Tombol mulai aktif otomatis pada waktunya.</p>
        <p className="mt-3 font-digits text-3xl text-brand">{open ? "00:00:00" : formatRemain(remain)}</p>
        <ol className="mt-6 grid grid-cols-3 gap-2 text-xs">
          {["Absen", "Menunggu", "Mulai"].map((label, index) => {
            const active = step === index + 1;
            const done = step > index + 1;
            return (
              <li key={label} className={`rounded-md px-2 py-2 text-center ${active ? "bg-brand-soft font-semibold text-brand" : done ? "bg-brand text-white" : "bg-page text-ink-muted"}`}>
                {index + 1}. {label}
              </li>
            );
          })}
        </ol>
        {error ? <p className="mt-4 rounded-sm bg-mark px-3 py-2 text-sm text-alert">{error}</p> : null}
        <div className="mt-6 flex flex-wrap gap-2">
          {!present && canAttend ? (
            <button
              type="button"
              disabled={attending}
              className="min-h-11 rounded-md border border-line-strong px-4 font-semibold disabled:opacity-50"
              onClick={() => {
                setAttending(true);
                void api("/api/peserta/absen", { body: { sessionId } })
                  .then(() => setPresent(true))
                  .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Absensi gagal."))
                  .finally(() => setAttending(false));
              }}>
              {attending ? "Mencatat kehadiran" : "Konfirmasi kehadiran"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!open || !present || entering}
            className="min-h-11 rounded-md bg-brand px-4 font-semibold text-white hover:brightness-110 disabled:opacity-50"
            onClick={() => {
              setEntering(true);
              const wait = Math.floor(Math.random() * 5000);
              window.setTimeout(() => {
                void document.documentElement.requestFullscreen?.().catch(() => undefined);
                void api<{ attemptId: number }>("/api/peserta/mulai", { body: { sessionId } })
                  .then(() => {
                    window.location.reload();
                  })
                  .catch((cause: unknown) => {
                    setError(cause instanceof Error ? cause.message : "Ujian belum dapat dimulai.");
                    setEntering(false);
                  });
              }, wait);
            }}>
            {entering ? "Memasuki ujian" : "Mulai ujian"}
          </button>
        </div>
      </section>
    </main>
  );
}

function formatRemain(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
