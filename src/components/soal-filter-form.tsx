"use client";

import { useEffect, useRef } from "react";
import { patchJqueryCompat } from "@/lib/jquery-compat";
import "select2/dist/css/select2.min.css";

type Option = { value: string; label: string };

type SoalFilterFormProps = {
  kode?: string;
  paket?: string;
  kategori?: string;
  jenis?: string;
  packages: Option[];
  categories: Option[];
};

type JQuerySelect2 = JQuery & {
  select2: (opts?: object | string) => JQuery;
};

function bindSelect2(jq: JQueryStatic, factory: unknown): void {
  if (typeof (jq.fn as { select2?: unknown }).select2 === "function") return;
  if (typeof factory === "function") {
    // CJS: module.exports = function (root, jQuery) { factory(jQuery); }
    (factory as (root: Window, jQuery: JQueryStatic) => void)(window, jq);
  }
}

export function SoalFilterForm({ kode, paket, kategori, jenis, packages, categories }: SoalFilterFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    void (async () => {
      const jqueryMod = await import("jquery");
      const $ = patchJqueryCompat((jqueryMod.default ?? jqueryMod) as unknown as JQueryStatic);
      const win = window as Window & { jQuery?: JQueryStatic; $?: JQueryStatic };
      win.jQuery = $;
      win.$ = $;

      // @ts-expect-error select2 full build belum punya deklarasi modul
      const select2Mod = await import("select2/dist/js/select2.full.min.js");
      bindSelect2($, (select2Mod as { default?: unknown }).default ?? select2Mod);

      if (typeof ($.fn as { select2?: unknown }).select2 !== "function") {
        const fallback = await import("select2");
        bindSelect2($, (fallback as { default?: unknown }).default ?? fallback);
      }

      if (cancelled || !formRef.current) return;
      if (typeof ($.fn as { select2?: unknown }).select2 !== "function") {
        console.error("Select2 gagal terpasang ke jQuery.");
        return;
      }

      const selects = formRef.current.querySelectorAll<HTMLSelectElement>("select.js-select2");
      selects.forEach((el) => {
        const $el = $(el) as unknown as JQuerySelect2;
        $el.select2({
          width: "100%",
          allowClear: true,
          placeholder: el.dataset.placeholder || "Pilih…",
          language: {
            noResults: () => "Tidak ada hasil",
            searching: () => "Mencari…",
          },
        });
        cleanups.push(() => {
          try {
            if ($el.data("select2")) $el.select2("destroy");
          } catch {
            /* sudah di-unmount */
          }
        });
      });
    })();

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  return (
    <form ref={formRef} method="get" className="soal-filter-form mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <label className="relative block">
        <span className="sr-only">Kode soal</span>
        <svg
          className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-ink-muted"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
          <path d="m16 16 3.5 3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          name="kode"
          defaultValue={kode}
          placeholder="Cari kode soal"
          className="w-full rounded-xl border border-line bg-page/60 py-2.5 pr-3 pl-9 text-sm font-normal placeholder:text-ink-muted focus:border-brand focus:bg-paper"
        />
      </label>

      <select
        name="paket"
        defaultValue={paket ?? ""}
        className="js-select2"
        data-placeholder="Semua paket"
        aria-label="Paket soal">
        <option value="" />
        {packages.map((pack) => (
          <option key={pack.value} value={pack.value}>
            {pack.label}
          </option>
        ))}
      </select>

      <select
        name="kategori"
        defaultValue={kategori ?? ""}
        className="js-select2"
        data-placeholder="Semua kategori"
        aria-label="Kategori">
        <option value="" />
        {categories.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>

      <select
        name="jenis"
        defaultValue={jenis ?? ""}
        className="js-select2"
        data-placeholder="Semua jenis"
        aria-label="Jenis soal">
        <option value="" />
        <option value="pg">Pilihan ganda</option>
        <option value="uraian">Uraian</option>
      </select>

      <button
        type="submit"
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand">
        Cari
      </button>
    </form>
  );
}
