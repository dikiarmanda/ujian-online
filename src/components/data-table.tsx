"use client";

import { useMemo, useState, type ReactNode } from "react";

const DEFAULT_PAGE_SIZES = [10, 25, 50, 100];

export type DataTableProps = {
  headers: string[];
  rows: ReactNode[][];
  itemsPerPage?: number;
  pageSizeOptions?: number[];
  searchable?: boolean;
  searchPlaceholder?: string;
};

function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(" ");
  if (typeof node === "object" && "props" in node) {
    return nodeText((node as { props?: { children?: ReactNode } }).props?.children);
  }
  return "";
}

function pageNumbers(currentPage: number, totalPages: number) {
  const pages: (number | string)[] = [];
  const maxVisible = 5;

  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }

  if (currentPage <= 3) {
    for (let i = 1; i <= 4; i++) pages.push(i);
    pages.push("...", totalPages);
  } else if (currentPage >= totalPages - 2) {
    pages.push(1, "...");
    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1, "...");
    for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
    pages.push("...", totalPages);
  }

  return pages;
}

export function DataTable({
  headers,
  rows,
  itemsPerPage = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  searchable = true,
  searchPlaceholder = "Cari...",
}: DataTableProps) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(itemsPerPage);
  const [page, setPage] = useState(1);
  const [pageSizeSource, setPageSizeSource] = useState(itemsPerPage);

  if (itemsPerPage !== pageSizeSource) {
    setPageSizeSource(itemsPerPage);
    setPageSize(itemsPerPage);
    setPage(1);
  }

  const sizes = useMemo(() => {
    const values = new Set(pageSizeOptions);
    values.add(pageSize);
    return [...values].sort((a, b) => a - b);
  }, [pageSize, pageSizeOptions]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!searchable || !needle) return rows;
    return rows.filter((row) => nodeText(row).toLowerCase().includes(needle));
  }, [query, rows, searchable]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1);
  const currentPage = filtered.length === 0 ? 1 : Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const currentRows = filtered.slice(startIndex, startIndex + pageSize);
  const from = filtered.length === 0 ? 0 : startIndex + 1;
  const to = Math.min(startIndex + pageSize, filtered.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Tampilkan
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm font-medium text-ink">
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          baris
        </label>

        {searchable ? (
          <label className="relative block w-full sm:max-w-xs">
            <span className="sr-only">Cari</span>
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
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-line bg-page/60 py-2.5 pr-3 pl-9 text-sm font-normal text-ink placeholder:text-ink-muted focus:border-brand focus:bg-paper"
            />
          </label>
        ) : null}
      </div>

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
            {currentRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-3 py-10 text-center text-sm text-ink-muted">
                  {rows.length === 0 ? "Belum ada data" : "Tidak ada yang cocok"}
                </td>
              </tr>
            ) : (
              currentRows.map((row, index) => (
                <tr key={startIndex + index} className="border-b border-line/70 last:border-0 hover:bg-brand-soft/40">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3">
                      <span className="flex min-h-11 items-center">{cell}</span>
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          Menampilkan {from}–{to} dari {filtered.length}
          {filtered.length !== rows.length ? ` (total ${rows.length})` : ""}
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:text-ink-muted disabled:opacity-50 hover:border-brand hover:text-brand disabled:hover:border-line disabled:hover:text-ink">
              ← Sebelumnya
            </button>
            {pageNumbers(currentPage, totalPages).map((item, index) => (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() => typeof item === "number" && setPage(item)}
                disabled={item === "..."}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                  item === currentPage
                    ? "bg-brand text-white"
                    : "border border-line text-ink hover:border-brand hover:text-brand"
                } ${item === "..." ? "cursor-default border-transparent text-ink-muted hover:border-transparent hover:text-ink-muted" : ""}`}>
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:text-ink-muted disabled:opacity-50 hover:border-brand hover:text-brand disabled:hover:border-line disabled:hover:text-ink">
              Selanjutnya →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PaginatedDataTable(props: DataTableProps) {
  return <DataTable {...props} />;
}
