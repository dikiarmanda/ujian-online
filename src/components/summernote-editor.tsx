"use client";

import { useEffect, useRef, useState } from "react";
import { patchJqueryCompat } from "@/lib/jquery-compat";
import { buildMathSpanHtml, hydrateMathInElement, normalizeMathHtml, renderLatex } from "@/lib/math-latex";

type SummernoteEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  height?: number;
};

/**
 * Wrapper Summernote (lite, tanpa Bootstrap) untuk Next.js App Router.
 * - Dimuat dinamis (client-only) agar aman dari SSR.
 * - Mendukung unggah gambar ke /api/admin/unggah lalu disisipkan sebagai /uploads/...
 * - Tombol formula LaTeX (KaTeX) untuk soal matematika.
 */
export default function SummernoteEditor({ value, onChange, placeholder, height = 180 }: SummernoteEditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const readyRef = useRef(false);
  const lastValueRef = useRef(value);
  const insertFormulaRef = useRef<((latex: string, displayMode: boolean) => void) | null>(null);

  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaLatex, setFormulaLatex] = useState("");
  const [formulaDisplay, setFormulaDisplay] = useState(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let $el: { summernote: (arg?: unknown, arg2?: unknown) => unknown } | null = null;
    let cancelled = false;

    (async () => {
      const jqueryMod = await import("jquery");
      const $ = patchJqueryCompat((jqueryMod.default ?? jqueryMod) as unknown as JQueryStatic);
      const win = window as Window & { jQuery?: JQueryStatic; $?: JQueryStatic };
      win.jQuery = $;
      win.$ = $;
      await import("summernote/dist/summernote-lite.min.js");
      try {
        await import("summernote/dist/lang/summernote-id-ID.min.js");
      } catch {
        /* bahasa Inggris sebagai fallback */
      }
      if (cancelled || !divRef.current) return;
      const jq = $ as unknown as (el: HTMLElement) => {
        summernote: (opts?: unknown, arg?: unknown) => unknown;
      };
      $el = jq(divRef.current);

      // Tombol kustom summernote-lite wajib punya container, kalau tidak
      // TooltipUI crash: Cannot read properties of undefined (reading 'top').
      const FormulaButton = (context: { options?: { container?: unknown } }) => {
        const ui = ($ as unknown as { summernote: { ui: { button: (opts: unknown) => { render: () => HTMLElement } } } }).summernote.ui;
        return ui
          .button({
            contents: '<span style="font-family:serif;font-weight:700">Σ</span>',
            tooltip: "Formula LaTeX",
            container: context?.options?.container ?? "body",
            click: () => {
              setFormulaLatex("");
              setFormulaDisplay(false);
              setFormulaOpen(true);
            },
          })
          .render();
      };

      insertFormulaRef.current = (latex: string, displayMode: boolean) => {
        if (!$el) return;
        const html = buildMathSpanHtml(latex, displayMode);
        if (!html) return;
        ($el as unknown as { summernote: (a: string, b?: string) => void }).summernote("focus");
        ($el as unknown as { summernote: (a: string, b?: string) => void }).summernote("pasteHTML", html);
      };

      ($el as unknown as { summernote: (opts: unknown) => void }).summernote({
        lang: "id-ID",
        placeholder: placeholder ?? "Tulis di sini…",
        height,
        container: "body",
        toolbar: [
          ["style", ["style"]],
          ["font", ["bold", "italic", "underline", "clear"]],
          ["fontname", ["fontname"]],
          ["color", ["color"]],
          ["para", ["ul", "ol", "paragraph"]],
          ["table", ["table"]],
          ["insert", ["link", "picture", "formula"]],
          ["view", ["fullscreen", "codeview", "help"]],
        ],
        buttons: {
          formula: FormulaButton,
        },
        callbacks: {
          onChange: (contents: string) => {
            const normalized = normalizeMathHtml(contents);
            lastValueRef.current = normalized;
            onChangeRef.current(normalized);
          },
          onInit: () => {
            if (divRef.current) hydrateMathInElement(divRef.current);
          },
          onImageUpload: async (files: File[]) => {
            for (const file of files ?? []) {
              const form = new FormData();
              form.append("file", file);
              try {
                // Header wajib untuk assertMutationOrigin di requireApiUser.
                // Jangan set Content-Type: browser mengisi boundary multipart sendiri.
                const res = await fetch("/api/admin/unggah", {
                  method: "POST",
                  headers: { "x-ujian-request": "1" },
                  body: form,
                });
                const data = (await res.json()) as { path?: string; error?: string };
                if (!res.ok || !data.path) {
                  window.alert(data.error || "Unggah gambar ditolak.");
                  continue;
                }
                if ($el) {
                  ($el as unknown as { summernote: (a: string, b: string) => void }).summernote("insertImage", data.path);
                }
              } catch {
                window.alert("Unggah gambar gagal. Coba lagi.");
              }
            }
          },
        },
      });
      ($el as unknown as { summernote: (a: string, b: string) => void }).summernote("code", value || "");
      lastValueRef.current = value || "";
      if (divRef.current) hydrateMathInElement(divRef.current);
      readyRef.current = true;
    })();

    return () => {
      cancelled = true;
      insertFormulaRef.current = null;
      try {
        ($el as unknown as { summernote: (a: string) => void } | null)?.summernote("destroy");
      } catch {
        /* abaikan saat unmount */
      }
      readyRef.current = false;
    };
    // Inisialisasi sekali per mount; perubahan value ditangani effect di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sinkronkan value dari luar (mis. saat data awal dimuat / ganti soal)
  // tanpa mengganggu fokus mengetik.
  useEffect(() => {
    if (!readyRef.current || !divRef.current) return;
    if (value === lastValueRef.current) return;
    lastValueRef.current = value;
    try {
      const jq = (window as unknown as Record<string, unknown>).jQuery as unknown as
        | ((el: HTMLElement) => { summernote: (a: string, b?: string) => string })
        | undefined;
      if (!jq) return;
      const current = jq(divRef.current).summernote("code") as unknown as string;
      if (current !== (value || "")) {
        jq(divRef.current).summernote("code", value || "");
        hydrateMathInElement(divRef.current);
      }
    } catch {
      /* abaikan */
    }
  }, [value]);

  const previewHtml = formulaLatex.trim()
    ? renderLatex(formulaLatex.trim(), formulaDisplay)
    : '<span class="text-ink-muted">Pratinjau muncul di sini…</span>';

  return (
    <>
      <div ref={divRef} className="bg-paper" />
      {formulaOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Sisipkan formula LaTeX"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFormulaOpen(false);
          }}>
          <div className="w-full max-w-lg rounded-md border border-line bg-paper p-5 shadow-paper">
            <h2 className="text-base font-semibold text-ink">Formula LaTeX</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Contoh: <code className="font-mono text-xs">{"\\frac{a}{b}"}</code>,{" "}
              <code className="font-mono text-xs">{"x^{2}+y^{2}=z^{2}"}</code>,{" "}
              <code className="font-mono text-xs">{"\\sqrt{2}"}</code>
            </p>
            <textarea
              className="mt-3 min-h-28 w-full rounded-md border border-line px-3 py-2 font-mono text-sm"
              value={formulaLatex}
              onChange={(event) => setFormulaLatex(event.target.value)}
              placeholder="Masukkan kode LaTeX…"
              autoFocus
            />
            <label className="mt-3 flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={formulaDisplay} onChange={(event) => setFormulaDisplay(event.target.checked)} />
              Tampilkan sebagai blok (display mode)
            </label>
            <div
              className="mt-3 min-h-16 overflow-x-auto rounded-md border border-line bg-page px-3 py-4 text-center"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="min-h-10 rounded-md border border-line-strong px-4" onClick={() => setFormulaOpen(false)}>
                Batal
              </button>
              <button
                type="button"
                className="min-h-10 rounded-md bg-brand px-4 text-white disabled:opacity-40"
                disabled={!formulaLatex.trim()}
                onClick={() => {
                  insertFormulaRef.current?.(formulaLatex, formulaDisplay);
                  setFormulaOpen(false);
                }}>
                Sisipkan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
