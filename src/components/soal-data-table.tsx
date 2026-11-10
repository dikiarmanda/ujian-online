"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table";

type Question = {
  id: number;
  category: { name: string };
  type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER";
  body: string;
  defaultWeight: { toString: () => string };
  defaultWrongWeight: { toString: () => string };
  isActive: boolean;
  packageItems: { packageId: number; packageName: string }[];
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

async function bulkToggleStatus(ids: number[], activate: boolean) {
  const res = await fetch("/api/admin/bulk-toggle-soal", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ujian-request": "1" },
    body: JSON.stringify({ ids, activate }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Gagal mengubah status soal");
  }
}

async function bulkDelete(ids: number[]) {
  const res = await fetch("/api/admin/bulk-hapus-soal", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ujian-request": "1" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Gagal menghapus soal");
  }
}

export function SoalDataTable({ questions }: { questions: Question[] }) {
  const [localQuestions, setLocalQuestions] = useState(questions);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil(localQuestions.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentQuestions = localQuestions.slice(startIndex, endIndex);

  const allSelectedOnPage = currentQuestions.length > 0 && currentQuestions.every((q) => selectedIds.has(q.id));
  const hasSelection = selectedIds.size > 0;

  const handleSelectAllOnPage = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentQuestions.forEach((q) => next.add(q.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentQuestions.forEach((q) => next.delete(q.id));
        return next;
      });
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleBulkActivate = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkLoading(true);
    try {
      await bulkToggleStatus(Array.from(selectedIds), true);
      setLocalQuestions((prev) => prev.map((q) => (selectedIds.has(q.id) ? { ...q, isActive: true } : q)));
      setSelectedIds(new Set());
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal mengaktifkan soal");
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} soal yang dipilih?`)) return;
    setIsBulkLoading(true);
    try {
      await bulkDelete(Array.from(selectedIds));
      setLocalQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
    } catch (error) {
      alert(error instanceof Error ? error.message : "Gagal menghapus soal");
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center pt-4 gap-2">
        <label className="flex items-center gap-2 px-4 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={allSelectedOnPage}
            onChange={(e) => handleSelectAllOnPage(e.target.checked)}
            className="size-4 rounded border-line text-brand focus:ring-brand"
          />
          Pilih semua di halaman ini
        </label>
        {hasSelection && (
          <div className="flex items-center gap-2 rounded-lg bg-brand-soft/50 px-4 py-2">
            <span className="text-sm font-semibold text-ink">{selectedIds.size} soal dipilih</span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkActivate}
                disabled={isBulkLoading}
                className="inline-flex rounded-lg border border-line bg-page px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-50">
                Aktifkan
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isBulkLoading}
                className="inline-flex rounded-lg border border-mark-edge bg-mark/30 px-3 py-1.5 text-xs font-semibold text-mark-ink transition hover:bg-mark/50 disabled:opacity-50">
                Hapus
              </button>
            </div>
          </div>
        )}
      </div>
      <DataTable
        headers={["", "Kategori", "Jenis", "Soal", "Bobot", "Paket", "Status", "Aksi"]}
        rows={localQuestions.map((question) => [
          <input
            key={`select-${question.id}`}
            type="checkbox"
            checked={selectedIds.has(question.id)}
            onChange={(e) => handleSelectOne(question.id, e.target.checked)}
            className="size-4 rounded border-line text-brand focus:ring-brand"
          />,
          <span className="text-ink-muted">{question.category.name}</span>,
          <TypeBadge type={question.type} />,
          <a href={`/admin/soal/${question.id}`} className="font-semibold text-ink hover:text-brand" title={previewText(question.body, 100)}>
            {previewText(question.body, 50)}
          </a>,
          <span className="font-digits tabular-nums text-ink">{weightLabel(question.defaultWeight, question.defaultWrongWeight)}</span>,
          <span
            className="inline-flex rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand"
            title={question.packageItems.length > 0 ? question.packageItems.map((p) => p.packageName).join(", ") : "Tidak ada paket"}>
            {question.packageItems.length}
          </span>,
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
          </div>,
        ])}
        itemsPerPage={pageSize}
        pageSizeOptions={[10, 25, 50, 100]}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
