"use client";

import { useEffect, useState } from "react";
import RichHtml from "@/components/rich-html";
import { api } from "@/lib/api";

type GradeView = {
  id: number;
  participantName: string;
  questionBody: string;
  essayText: string;
  answerKey: string;
  rubric: string;
  weight: number;
  score: number | null;
  lockExpiresAt: string;
};

export function GradeDesk({ answerId }: { answerId: number }) {
  const [view, setView] = useState<GradeView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    void api<GradeView>(`/api/petugas/jawaban/${answerId}`, { body: { intent: "klaim" } })
      .then((data) => {
        setView(data);
        setScore(data.score == null ? "" : String(data.score));
      })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Jawaban tidak dapat dibuka."));
  }, [answerId]);

  if (error) return <p className="text-alert">{error}</p>;
  if (!view) return <p>Membuka jawaban.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-md border border-line bg-paper p-5 shadow-paper">
        <p className="text-sm text-ink-muted">{view.participantName}</p>
        <RichHtml html={view.questionBody} className="mt-3 text-question" />
        <h2 className="mt-6 text-sm font-semibold">Jawaban peserta</h2>
        <p className="mt-2 border-l-4 border-brand bg-page p-4 whitespace-pre-wrap">{view.essayText || "Peserta tidak menulis jawaban."}</p>
      </section>
      <section className="rounded-md border border-line bg-paper p-5 shadow-paper">
        <p className="rounded-sm bg-mark px-3 py-2 text-sm text-mark-ink">Kunci Anda berlaku sampai {new Date(view.lockExpiresAt).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })}</p>
        <h2 className="mt-4 text-sm font-semibold">Pedoman</h2>
        <RichHtml html={view.answerKey} className="mt-2 text-sm" />
        {view.rubric ? (
          <>
            <h2 className="mt-4 text-sm font-semibold">Rubrik</h2>
            <RichHtml html={view.rubric} className="mt-2 text-sm" />
          </>
        ) : null}
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void api(`/api/petugas/jawaban/${answerId}`, { body: { intent: "nilai", score: Number(score), note } })
              .then(() => {
                window.location.href = "/petugas";
              })
              .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Nilai gagal disimpan."));
          }}>
          <label className="text-sm font-semibold">
            Skor, maksimal {view.weight}
            <input value={score} onChange={(event) => setScore(event.target.value)} type="number" min={0} max={view.weight} step="0.01" required className="mt-1 w-32 font-normal" />
          </label>
          <label className="text-sm font-semibold">
            Catatan
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 min-h-24 w-full font-normal" />
          </label>
          <button type="submit" className="w-fit min-h-11 rounded-md bg-brand px-4 font-semibold text-white hover:brightness-110">
            Simpan nilai
          </button>
        </form>
      </section>
    </div>
  );
}
