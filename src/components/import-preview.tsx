"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

export type ImportPreviewRow = {
  row: number;
  valid: boolean;
  error: string | null;
  paket: string;
  kategori: string;
  jenis: string;
  teks: string;
  bobot: string;
  bobotSalah: string;
  kunci: string;
  adaGambar: boolean;
};

export function ImportPreview({ token, rows }: { token: string; rows: ImportPreviewRow[] }) {
  const validRows = useMemo(() => rows.filter((row) => row.valid), [rows]);
  const [selected, setSelected] = useState<number[]>(() => validRows.map((row) => row.row));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const allChecked = validRows.length > 0 && validRows.every((row) => selected.includes(row.row));

  function toggle(row: number) {
    setSelected((current) => (current.includes(row) ? current.filter((item) => item !== row) : [...current, row]));
  }

  if (result) {
    return (
      <section className="rounded-xl border border-line/80 bg-paper p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">{result.success} soal tersimpan</h2>
        <p className="mt-2 text-sm text-ink-muted">Hanya baris yang dicentang dan lolos pemeriksaan yang masuk ke bank soal.</p>
        {result.errors.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {result.errors.map((item) => (
              <li key={item} className="rounded-lg bg-mark px-3 py-2 text-sm text-alert">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
        <Link href="/admin/soal" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:brightness-110">
          Kembali ke bank soal
        </Link>
      </section>
    );
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        void api<{ success: number; errors: string[] }>("/api/admin/impor-simpan", { body: { token, rows: selected } })
          .then((data) => setResult(data))
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Soal gagal disimpan."))
          .finally(() => setPending(false));
      }}>
      <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-ink">Hasil pemeriksaan</h2>
            <p className="mt-1 text-sm text-ink-muted">
              <span className="font-digits font-semibold text-ink">{validRows.length}</span> valid,{" "}
              <span className="font-digits font-semibold text-ink">{rows.length - validRows.length}</span> tidak valid. Centang soal yang ingin disimpan.
            </p>
          </div>
          {validRows.length > 0 ? (
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-brand)]"
                checked={allChecked}
                onChange={() => setSelected(allChecked ? [] : validRows.map((row) => row.row))}
              />
              Pilih semua yang valid
            </label>
          ) : null}
        </div>
      </section>

      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li
            key={row.row}
            className={`rounded-xl border bg-paper p-4 shadow-sm ${row.valid ? "border-line/80" : "border-alert/40"}`}>
            <div className="flex items-start gap-3">
              {row.valid ? (
                <input
                  type="checkbox"
                  className="mt-1 size-4 shrink-0 accent-[var(--color-brand)]"
                  checked={selected.includes(row.row)}
                  aria-label={`Simpan baris ${row.row}`}
                  onChange={() => toggle(row.row)}
                />
              ) : (
                <span className="mt-0.5 inline-flex shrink-0 rounded-md bg-mark px-2 py-1 text-xs font-semibold text-alert">Tidak valid</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-digits text-xs font-semibold text-ink-muted">Baris {row.row}</span>
                  <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${row.valid ? "bg-brand-soft text-brand" : "bg-page text-ink-muted"}`}>
                    {row.jenis}
                  </span>
                  {row.adaGambar ? <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Ada gambar</span> : null}
                  {row.paket ? <span className="rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">{row.paket}</span> : null}
                </div>
                <p className="mt-2 font-semibold text-ink">{row.teks}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {row.kategori || "Tanpa kategori"} · benar {row.bobot} · salah −{row.bobotSalah} · {row.kunci}
                </p>
                {row.error ? <p className="mt-2 text-sm font-semibold text-alert">{row.error}</p> : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {error ? <p className="rounded-lg bg-mark px-3 py-2 text-sm text-alert">{error}</p> : null}

      <div className="sticky bottom-3 flex flex-col gap-3 rounded-xl border border-line/80 bg-paper/95 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/soal" className="text-sm font-semibold text-ink-muted hover:text-brand">
          Batal
        </Link>
        <button
          type="submit"
          disabled={pending || selected.length === 0}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
          {pending ? "Menyimpan…" : `Simpan ${selected.length} soal`}
        </button>
      </div>
    </form>
  );
}
