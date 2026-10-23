"use client";

import { useState } from "react";
import RichHtml from "@/components/rich-html";

export type PackageQuestion = {
  id: number;
  type: "MULTIPLE_CHOICE" | "ESSAY";
  body: string;
  imagePath: string | null;
  weight: string;
  wrongWeight: string;
  code: string;
  options: { id: number; label: string; body: string; imagePath: string | null; isCorrect: boolean }[];
  essayKey?: string;
  essayRubric?: string;
};

export function PackagePreview({ questions }: { questions: PackageQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const question = questions[index];

  const panel = (
    <aside className="flex h-full w-full flex-col gap-4 bg-paper p-5 lg:sticky lg:top-0 lg:h-screen lg:w-[320px] lg:border-l lg:border-line">
      <div className="rounded-md bg-brand-soft px-3 py-3">
        <p className="text-xs font-semibold tracking-wide text-ink-muted uppercase">Total soal</p>
        <p className="font-digits text-2xl text-brand">{questions.length}</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {questions.map((item, itemIndex) => {
          const current = itemIndex === index;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Soal ${itemIndex + 1}`}
              onClick={() => setIndex(itemIndex)}
              className={`relative flex h-11 items-center justify-center rounded-md font-digits text-sm ${current ? "bg-brand text-white" : "border border-line-strong bg-paper"}`}>
              {itemIndex + 1}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-md bg-page px-2 py-2">
          <dt className="text-ink-muted">Pilihan Ganda</dt>
          <dd className="font-digits text-base font-semibold">{questions.filter((q) => q.type === "MULTIPLE_CHOICE").length}</dd>
        </div>
        <div className="rounded-md bg-page px-2 py-2">
          <dt className="text-ink-muted">Uraian</dt>
          <dd className="font-digits text-base font-semibold">{questions.filter((q) => q.type === "ESSAY").length}</dd>
        </div>
      </div>
    </aside>
  );

  if (!question) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page px-4">
        <p className="rounded-md border border-line bg-paper p-6 text-sm shadow-paper">Tidak ada soal dalam paket ini.</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-page lg:grid lg:grid-cols-[1fr_320px]">
      <section className="px-4 py-5 lg:px-10">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Preview Paket Soal</p>
            <p className="text-sm text-ink-muted">Kode: {question.code}</p>
          </div>
          <div className="lg:hidden">
            <button type="button" className="text-sm font-semibold text-brand" onClick={() => setDrawer(true)}>
              Daftar soal
            </button>
          </div>
        </header>
        <article className="max-w-[68ch] rounded-md border border-line bg-paper p-6 shadow-paper">
          <h1 className="text-xs font-semibold tracking-wide text-brand uppercase">
            Soal {index + 1} dari {questions.length}
          </h1>
          <RichHtml html={question.body} className="mt-3 text-question" />
          {question.imagePath ? <img src={question.imagePath} alt="" className="mt-4 max-h-80 rounded-sm" /> : null}
          {question.type === "MULTIPLE_CHOICE" ? (
            <div className="mt-6 flex flex-col gap-2">
              {question.options.map((option) => (
                <div
                  key={option.id}
                  className={`flex min-h-12 items-start gap-3 rounded-md border px-3 py-2 ${
                    option.isCorrect ? "border-brand bg-brand-soft" : "border-line"
                  }`}>
                  <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full font-digits text-sm ${option.isCorrect ? "bg-brand text-white" : "bg-page text-ink-muted"}`}>
                    {option.label}
                  </span>
                  <RichHtml as="span" html={option.body} />
                  {option.isCorrect && <span className="ml-auto text-xs font-semibold text-brand">✓ Kunci</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <p className="text-sm font-semibold text-ink-muted mb-2">Kunci Jawaban:</p>
              <div className="rounded-md border border-line bg-page p-4">
                <RichHtml html={question.essayKey || "Tidak ada kunci jawaban"} />
              </div>
              {question.essayRubric ? (
                <>
                  <p className="text-sm font-semibold text-ink-muted mb-2 mt-4">Rubrik Penilaian:</p>
                  <div className="rounded-md border border-line bg-page p-4">
                    <RichHtml html={question.essayRubric} />
                  </div>
                </>
              ) : null}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-md border border-line-strong px-4 disabled:opacity-40" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              Sebelumnya
            </button>
            <button type="button" className="min-h-11 rounded-md bg-brand px-4 font-semibold text-white hover:brightness-110 disabled:opacity-40" disabled={index === questions.length - 1} onClick={() => setIndex(index + 1)}>
              Berikutnya
            </button>
          </div>
          <div className="mt-4 rounded-md bg-page p-3 text-xs">
            <p className="font-semibold text-ink-muted">Bobot soal:</p>
            <p>Benar: {question.weight} poin</p>
            <p>Salah: {question.wrongWeight} poin</p>
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
    </div>
  );
}
