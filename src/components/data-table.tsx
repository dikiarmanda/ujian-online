"use client";

import { useState } from "react";

export function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-auto rounded-xl border border-line/80 bg-paper shadow-sm">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-page/80 text-left text-ink-muted">
            {headers.map((header) => (
              <th key={header} className="px-3 font-semibold">
                <span className="flex h-11 items-center">{header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line/70 last:border-0 hover:bg-brand-soft/40">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3">
                  <span className="flex min-h-11 items-center">{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PaginatedDataTable({ headers, rows, itemsPerPage = 20 }: { headers: string[]; rows: React.ReactNode[][]; itemsPerPage?: number }) {
  const totalPages = Math.ceil(rows.length / itemsPerPage);
  const [currentPage, setCurrentPage] = useState(1);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentRows = rows.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-auto rounded-xl border border-line/80 bg-paper shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-page/80 text-left text-ink-muted">
              {headers.map((header) => (
                <th key={header} className="px-3 font-semibold">
                  <span className="flex h-11 items-center">{header}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentRows.map((row, index) => (
              <tr key={startIndex + index} className="border-b border-line/70 last:border-0 hover:bg-brand-soft/40">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3">
                    <span className="flex min-h-11 items-center">{cell}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-2">
          <p className="text-sm text-ink-muted">
            Menampilkan {startIndex + 1}-{Math.min(endIndex, rows.length)} dari {rows.length} peserta
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:text-ink-muted disabled:opacity-50 hover:border-brand hover:text-brand disabled:hover:border-line disabled:hover:text-ink">
              ← Sebelumnya
            </button>
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === "number" && setCurrentPage(page)}
                disabled={page === "..."}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  page === currentPage
                    ? "bg-brand text-white"
                    : "border border-line text-ink hover:border-brand hover:text-brand"
                } ${page === "..." ? "cursor-default border-transparent text-ink-muted hover:border-transparent hover:text-ink-muted" : ""}`}>
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:text-ink-muted disabled:opacity-50 hover:border-brand hover:text-brand disabled:hover:border-line disabled:hover:text-ink">
              Selanjutnya →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
