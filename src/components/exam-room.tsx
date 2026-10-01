"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { SubmittedNotice } from "@/components/chrome";
import { api } from "@/lib/api";
import { countAnswerStats, type AnswerSnapshot } from "@/server/exam-rules";

export type ExamQuestion = {
  id: number;
  type: "MULTIPLE_CHOICE" | "ESSAY";
  body: string;
  imagePath: string | null;
  weight: string;
  options: { id: number; label: string; body: string; imagePath: string | null }[];
};

export type ExamInitial = {
  attemptId: number;
  examName: string;
  sessionName: string;
  serverNow: string;
  deadlineAt: string;
  lastQuestionIndex: number;
  questions: ExamQuestion[];
  answers: Record<number, AnswerSnapshot>;
};

type SaveState = "saving" | "saved" | "error";

type ExamStore = {
  index: number;
  answers: Record<number, AnswerSnapshot>;
  saveState: SaveState;
  setIndex: (index: number) => void;
  patchAnswer: (questionId: number, patch: Partial<AnswerSnapshot>) => void;
  setSaveState: (saveState: SaveState) => void;
};

function emptyAnswer(): AnswerSnapshot {
  return { selectedOptionId: null, essayText: "", isDoubtful: false };
}

export function ExamRoom({ initial }: { initial: ExamInitial }) {
  const useExam = useMemo(
    () =>
      create<ExamStore>((set) => ({
        index: Math.min(initial.lastQuestionIndex, Math.max(initial.questions.length - 1, 0)),
        answers: initial.answers,
        saveState: "saved",
        setIndex: (index) => set({ index }),
        patchAnswer: (questionId, patch) =>
          set((state) => ({
            answers: {
              ...state.answers,
              [questionId]: { ...emptyAnswer(), ...state.answers[questionId], ...patch },
            },
          })),
        setSaveState: (saveState) => set({ saveState }),
      })),
    [initial.answers, initial.lastQuestionIndex, initial.questions.length],
  );
  const index = useExam((state) => state.index);
  const answers = useExam((state) => state.answers);
  const saveState = useExam((state) => state.saveState);
  const [offset, setOffset] = useState(() => new Date(initial.serverNow).getTime() - Date.now());
  const [deadline, setDeadline] = useState(() => new Date(initial.deadlineAt).getTime());
  const [now, setNow] = useState(() => Date.now());
  const [drawer, setDrawer] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [announced, setAnnounced] = useState<"10" | "5" | null>(null);
  const expired = useRef(false);
  const question = initial.questions[index];
  const stats = countAnswerStats(
    initial.questions.map((item) => item.id),
    answers,
  );
  const remaining = Math.max(0, deadline - (now + offset));

  async function persist(questionId: number, nextIndex = index) {
    const answer = useExam.getState().answers[questionId] ?? emptyAnswer();
    useExam.getState().setSaveState("saving");
    try {
      await api(`/api/peserta/attempt/${initial.attemptId}/jawaban`, {
        body: {
          questionId,
          selectedOptionId: answer.selectedOptionId,
          essayText: answer.essayText,
          isDoubtful: answer.isDoubtful,
          lastQuestionIndex: nextIndex,
        },
      });
      useExam.getState().setSaveState("saved");
    } catch (error) {
      useExam.getState().setSaveState("error");
      const message = error instanceof Error ? error.message : "";
      if (message.includes("habis")) setDone(true);
    }
  }

  async function goTo(nextIndex: number) {
    if (!question) return;
    await persist(question.id, nextIndex);
    useExam.getState().setIndex(nextIndex);
    setDrawer(false);
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      const tick = Date.now();
      setNow(tick);
      const left = deadline - (tick + offset);
      if (left <= 5 * 60_000) setAnnounced("5");
      else if (left <= 10 * 60_000) setAnnounced((current) => current ?? "10");
    }, 1000);
    const poll = window.setInterval(() => {
      void api<{ serverNow: string; deadlineAt: string; status: string }>(`/api/peserta/attempt/${initial.attemptId}/waktu`, { method: "GET" })
        .then((data) => {
          setOffset(new Date(data.serverNow).getTime() - Date.now());
          setDeadline(new Date(data.deadlineAt).getTime());
          if (data.status !== "IN_PROGRESS") setDone(true);
        })
        .catch(() => undefined);
    }, 15000);
    return () => {
      window.clearInterval(timer);
      window.clearInterval(poll);
    };
  }, [deadline, initial.attemptId, offset]);

  const essayText = question?.type === "ESSAY" ? (answers[question.id]?.essayText ?? "") : "";
  useEffect(() => {
    if (!question || question.type !== "ESSAY") return;
    const questionId = question.id;
    const timer = window.setTimeout(() => {
      void persist(questionId);
    }, 2500);
    return () => window.clearTimeout(timer);
    // persist membaca jawaban terbaru dari Zustand, jadi tidak masuk dependensi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, essayText]);

  useEffect(() => {
    if (remaining !== 0 || expired.current) return;
    expired.current = true;
    void api(`/api/peserta/attempt/${initial.attemptId}/selesai`, { body: {} }).finally(() => setDone(true));
  }, [remaining, initial.attemptId]);

  useEffect(() => {
    const root = document.getElementById("lembar-ujian");
    function report(type: "FULLSCREEN_EXIT" | "TAB_SWITCH" | "WINDOW_BLUR" | "COPY_PASTE" | "RIGHT_CLICK", message: string) {
      setWarning(message);
      void api(`/api/peserta/attempt/${initial.attemptId}/pelanggaran`, {
        body: { type, questionNumber: index + 1 },
      }).catch(() => undefined);
    }
    function onFullscreen() {
      if (!document.fullscreenElement) {
        report("FULLSCREEN_EXIT", "Anda keluar dari layar penuh. Kembali ke layar penuh untuk melanjutkan. Kejadian ini dicatat.");
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        report("TAB_SWITCH", "Anda meninggalkan halaman ujian. Kejadian ini dicatat.");
      }
    }
    function onBlur() {
      report("WINDOW_BLUR", "Anda meninggalkan halaman ujian. Kejadian ini dicatat.");
    }
    function block(event: Event, type: "COPY_PASTE" | "RIGHT_CLICK") {
      if (!root?.contains(event.target as Node)) return;
      event.preventDefault();
      report(type, "Tindakan itu tidak tersedia pada lembar soal. Kejadian ini dicatat.");
    }
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    root?.addEventListener("copy", (event) => block(event, "COPY_PASTE"));
    root?.addEventListener("paste", (event) => block(event, "COPY_PASTE"));
    root?.addEventListener("contextmenu", (event) => block(event, "RIGHT_CLICK"));
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
    };
  }, [index, initial.attemptId]);

  if (done || !question) {
    return <SubmittedNotice />;
  }

  const clock = formatClock(remaining);
  const urgent = remaining <= 5 * 60_000;
  const warn = remaining <= 10 * 60_000;
  const answer = answers[question.id] ?? emptyAnswer();
  const saveLabel = saveState === "saving" ? "Menyimpan" : saveState === "error" ? "Jawaban belum tersimpan. Menghubungkan ulang, jangan tutup halaman ini." : "Tersimpan";

  const panel = (
    <aside className="flex h-full w-full flex-col gap-4 bg-paper p-5 lg:sticky lg:top-0 lg:h-screen lg:w-[320px] lg:border-l lg:border-line">
      <div className={`rounded-md px-3 py-3 ${urgent ? "bg-mark" : "bg-brand-soft"}`}>
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Sisa waktu</p>
        <p className={`font-digits text-2xl ${urgent ? "text-alert" : warn ? "text-mark-ink" : "text-brand"}`} aria-hidden="true">
          {clock}
        </p>
        <p className="sr-only" aria-live="polite">
          {announced === "5" ? "Sisa 5 menit" : announced === "10" ? "Sisa 10 menit" : ""}
        </p>
        {urgent ? <p className="text-sm text-alert">Sisa 5 menit</p> : warn ? <p className="text-sm text-mark-ink">Sisa 10 menit</p> : null}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {initial.questions.map((item, itemIndex) => {
          const state = answers[item.id];
          const filled = Boolean(state && (state.selectedOptionId != null || (state.essayText ?? "").trim()));
          const doubtful = Boolean(state?.isDoubtful);
          const current = itemIndex === index;
          return (
            <button key={item.id} type="button" aria-label={`Soal ${itemIndex + 1}${doubtful ? ", ragu-ragu" : filled ? ", terjawab" : ", belum dijawab"}`} onClick={() => void goTo(itemIndex)} className={`relative flex h-11 items-center justify-center rounded-md font-digits text-sm ${doubtful ? "border border-mark-edge bg-mark text-mark-ink" : filled ? "bg-brand text-white" : "border border-line-strong bg-paper"} ${current ? "ring-2 ring-brand ring-offset-2" : ""}`}>
              {itemIndex + 1}
              {filled && !doubtful ? <span className="absolute right-1 bottom-0 text-xs">✓</span> : null}
              {doubtful ? <span className="absolute top-0 right-1 text-xs">⚑</span> : null}
            </button>
          );
        })}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md bg-page px-2 py-2">
          <dt className="text-ink-muted">Terjawab</dt>
          <dd className="font-digits text-base font-semibold">{stats.answered}</dd>
        </div>
        <div className="rounded-md bg-page px-2 py-2">
          <dt className="text-ink-muted">Belum</dt>
          <dd className="font-digits text-base font-semibold">{stats.unanswered}</dd>
        </div>
        <div className="rounded-md bg-page px-2 py-2">
          <dt className="text-ink-muted">Ragu</dt>
          <dd className="font-digits text-base font-semibold">{stats.doubtful}</dd>
        </div>
      </dl>
      <button type="button" className="mt-auto min-h-11 rounded-md bg-brand px-4 font-semibold text-white hover:brightness-110" onClick={() => setConfirming(true)}>
        Kirim jawaban
      </button>
    </aside>
  );

  return (
    <div id="lembar-ujian" className="min-h-screen bg-page lg:grid lg:grid-cols-[1fr_320px]">
      <section className="px-4 py-5 lg:px-10">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{initial.examName}</p>
            <p className="text-sm text-ink-muted">{initial.sessionName}</p>
            <p className={`text-xs ${saveState === "error" ? "text-alert" : "text-ink-muted"}`}>{saveLabel}</p>
          </div>
          <div className="lg:hidden">
            <p className={`font-digits text-lg ${urgent ? "text-alert" : "text-brand"}`}>{clock}</p>
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => setDrawer(true)}>
              Daftar soal
            </button>
          </div>
        </header>
        <article
          className="max-w-[68ch] rounded-md border border-line bg-paper p-6 shadow-paper"
          onKeyDown={(event) => {
            if (event.target instanceof HTMLTextAreaElement) return;
            if (event.key === "ArrowRight" && index < initial.questions.length - 1) void goTo(index + 1);
            if (event.key === "ArrowLeft" && index > 0) void goTo(index - 1);
          }}>
          <h1 className="text-xs font-semibold tracking-wide text-brand uppercase">
            Soal {index + 1} dari {initial.questions.length}
          </h1>
          <div className="mt-3 text-question" dangerouslySetInnerHTML={{ __html: question.body }} />
          {question.imagePath ? <img src={question.imagePath} alt="" className="mt-4 max-h-80 rounded-sm" /> : null}
          {question.type === "MULTIPLE_CHOICE" ? (
            <div className="mt-6 flex flex-col gap-2" role="radiogroup" aria-label="Pilihan jawaban">
              {question.options.map((option) => {
                const selected = answer.selectedOptionId === option.id;
                return (
                  <label key={option.id} className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${selected ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong"}`}>
                    <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full font-digits text-sm ${selected ? "bg-brand text-white" : "bg-page text-ink-muted"}`}>{option.label}</span>
                    <input
                      type="radio"
                      name={`soal-${question.id}`}
                      className="sr-only"
                      checked={selected}
                      onChange={() => {
                        useExam.getState().patchAnswer(question.id, { selectedOptionId: option.id });
                        void persist(question.id);
                      }}
                    />
                    <span dangerouslySetInnerHTML={{ __html: option.body }} />
                  </label>
                );
              })}
            </div>
          ) : (
            <textarea className="mt-6 min-h-48 w-full text-base" value={answer.essayText ?? ""} onChange={(event) => useExam.getState().patchAnswer(question.id, { essayText: event.target.value })} />
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-md border border-line-strong px-4 disabled:opacity-40" disabled={index === 0} onClick={() => void goTo(index - 1)}>
              Sebelumnya
            </button>
            <button
              type="button"
              className={`min-h-11 rounded-md border px-4 ${answer.isDoubtful ? "border-mark-edge bg-mark text-mark-ink" : "border-line-strong"}`}
              onClick={() => {
                useExam.getState().patchAnswer(question.id, { isDoubtful: !answer.isDoubtful });
                void persist(question.id);
              }}>
              Tandai ragu-ragu
            </button>
            <button type="button" className="min-h-11 rounded-md bg-brand px-4 font-semibold text-white hover:brightness-110 disabled:opacity-40" disabled={index === initial.questions.length - 1} onClick={() => void goTo(index + 1)}>
              Berikutnya
            </button>
          </div>
        </article>
      </section>
      <div className="hidden lg:block">{panel}</div>
      {drawer ? (
        <div className="fixed inset-0 z-20 bg-ink/30 lg:hidden" onClick={() => setDrawer(false)}>
          <div className="absolute top-0 right-0 h-full w-[320px] shadow-overlay" onClick={(event) => event.stopPropagation()}>
            {panel}
          </div>
        </div>
      ) : null}
      {confirming ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/40 p-4">
          <div className="max-w-md rounded-md bg-paper p-6 shadow-overlay" role="dialog" aria-modal="true">
            <p>
              Anda masih memiliki {stats.unanswered} soal belum dijawab dan {stats.doubtful} soal ditandai ragu-ragu. Kirim jawaban sekarang?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="min-h-11 rounded-md bg-brand px-4 font-semibold text-white hover:brightness-110"
                onClick={() => {
                  void persist(question.id).then(() => api(`/api/peserta/attempt/${initial.attemptId}/selesai`, { body: {} }).then(() => setDone(true)));
                }}>
                Kirim jawaban
              </button>
              <button type="button" className="min-h-11 rounded-md border border-line-strong px-4" onClick={() => setConfirming(false)}>
                Kembali
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {warning ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4">
          <div className="max-w-md rounded-md bg-paper p-6 shadow-overlay" role="dialog" aria-modal="true">
            <p>{warning}</p>
            <button
              type="button"
              className="mt-4 min-h-11 rounded-md bg-brand px-4 font-semibold text-white hover:brightness-110"
              onClick={() => {
                setWarning(null);
                void document.documentElement.requestFullscreen?.().catch(() => undefined);
              }}>
              Kembali ke ujian
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}
