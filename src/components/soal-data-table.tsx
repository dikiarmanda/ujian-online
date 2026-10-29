"use client";

import { useState } from "react";
import { ToggleQuestionStatusButton } from "@/components/admin-forms";
import { PaginatedDataTable } from "@/components/data-table";

type Question = {
  id: number;
  category: { name: string };
  type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER";
  body: string;
  defaultWeight: { toString: () => string };
  defaultWrongWeight: { toString: () => string };
  isActive: boolean;
};

function TypeBadge({ type }: { type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER" }) {
  if (type === "ESSAY") return <span className="inline-flex rounded-md bg-mark px-2 py-1 text-xs font-semibold text-mark-ink">Uraian</span>;
  if (type === "SHORT_ANSWER") return <span className="inline-flex rounded-md border border-line bg-page px-2 py-1 text-xs font-semibold text-ink">Jawaban singkat</span>;
  return <span className="inline-flex rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">Pilihan ganda</span>;
}

function previewText(html: string, max = 20): string {
  const plain = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain || "—";
  return `${plain.slice(0, max)}…`;
}

function weightLabel(benar: { toString(): string }, salah: { toString(): string }): string {
  const wrong = Number(salah);
  return wrong > 0 ? `${benar.toString()} / −${salah.toString()}` : `${benar.toString()} / 0`;
}

export function SoalDataTable({ questions }: { questions: Question[] }) {
  const [localQuestions, setLocalQuestions] = useState(questions);

  return (
    <PaginatedDataTable
      headers={["Kategori", "Jenis", "Soal", "Bobot", "Status", "Aksi"]}
      rows={localQuestions.map((question) => [
        <span className="text-ink-muted">{question.category.name}</span>,
        <TypeBadge type={question.type} />,
        <a href={`/admin/soal/${question.id}`} className="font-semibold text-ink hover:text-brand" title={previewText(question.body, 100)}>
          {previewText(question.body, 50)}
        </a>,
        <span className="font-digits tabular-nums text-ink">{weightLabel(question.defaultWeight, question.defaultWrongWeight)}</span>,
        <span>
          {question.isActive ? (
            <span className="inline-flex rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">Aktif</span>
          ) : (
            <span className="inline-flex rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Nonaktif</span>
          )}
        </span>,
        <div className="flex gap-2">
          <a href={`/admin/soal/${question.id}`} className="inline-flex rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
            Edit
          </a>
          <ToggleQuestionStatusButton
            questionId={question.id}
            isActive={question.isActive}
            onToggle={(newStatus) => setLocalQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, isActive: newStatus } : q)))}
          />
        </div>,
      ])}
    />
  );
}
