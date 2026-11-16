"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { patchJqueryCompat } from "@/lib/jquery-compat";
import "select2/dist/css/select2.min.css";

type ExamOption = { id: number; label: string };

type JQuerySelect2 = JQuery & {
  select2: (opts?: object | string) => JQuery;
};

function bindSelect2(jq: JQueryStatic, factory: unknown): void {
  if (typeof (jq.fn as { select2?: unknown }).select2 === "function") return;
  if (typeof factory === "function") {
    (factory as (root: Window, jQuery: JQueryStatic) => void)(window, jq);
  }
}

export function MonitoringFilterForm({ exams, selectedId }: { exams: ExamOption[]; selectedId: number }) {
  const router = useRouter();
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

      const el = formRef.current.querySelector<HTMLSelectElement>("select.js-select2");
      if (!el) return;
      const $el = $(el) as unknown as JQuerySelect2;
      $el.select2({
        width: "100%",
        allowClear: false,
        placeholder: "Pilih jadwal ujian…",
        language: {
          noResults: () => "Tidak ada hasil",
          searching: () => "Mencari…",
        },
      });
      $el.on("change", () => {
        const value = String($el.val() ?? "");
        router.push(`/petugas/monitoring?ujian=${value}`);
      });
      cleanups.push(() => {
        try {
          if ($el.data("select2")) {
            $el.off("change");
            $el.select2("destroy");
          }
        } catch {
          /* sudah di-unmount */
        }
      });
    })();

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, [router]);

  return (
    <form ref={formRef} className="soal-filter-form">
      <label className="block max-w-md">
        <span className="sr-only">Pilih jadwal ujian</span>
        <select
          name="ujian"
          defaultValue={String(selectedId)}
          className="js-select2"
          data-placeholder="Pilih jadwal ujian…"
          aria-label="Pilih jadwal ujian">
          {exams.map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.label}
            </option>
          ))}
        </select>
      </label>
    </form>
  );
}
