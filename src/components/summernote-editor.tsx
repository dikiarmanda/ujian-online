"use client";

import { useEffect, useRef } from "react";

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
 *   sehingga lolos sanitizeRichText di server.
 */
export default function SummernoteEditor({ value, onChange, placeholder, height = 180 }: SummernoteEditorProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const readyRef = useRef(false);
  const lastValueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let $el: { summernote: (arg?: unknown, arg2?: unknown) => unknown } | null = null;
    let cancelled = false;

    (async () => {
      const { default: $ } = await import("jquery");
      (window as unknown as Record<string, unknown>).jQuery = $;
      (window as unknown as Record<string, unknown>).$ = $;
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
      ($el as unknown as { summernote: (opts: unknown) => void }).summernote({
        lang: "id-ID",
        placeholder: placeholder ?? "Tulis di sini…",
        height,
        toolbar: [
          ["style", ["style"]],
          ["font", ["bold", "italic", "underline", "clear"]],
          ["fontname", ["fontname"]],
          ["color", ["color"]],
          ["para", ["ul", "ol", "paragraph"]],
          ["table", ["table"]],
          ["insert", ["link", "picture"]],
          ["view", ["fullscreen", "codeview", "help"]],
        ],
        callbacks: {
          onChange: (contents: string) => {
            lastValueRef.current = contents;
            onChangeRef.current(contents);
          },
          onImageUpload: async (files: File[]) => {
            for (const file of files ?? []) {
              const form = new FormData();
              form.append("file", file);
              try {
                const res = await fetch("/api/admin/unggah", { method: "POST", body: form });
                const data = (await res.json()) as { path?: string; error?: string };
                if (data.path && $el) {
                  ($el as unknown as { summernote: (a: string, b: string) => void }).summernote("insertImage", data.path);
                }
              } catch {
                /* abaikan, biarkan pengguna mencoba lagi */
              }
            }
          },
        },
      });
      ($el as unknown as { summernote: (a: string, b: string) => void }).summernote("code", value || "");
      lastValueRef.current = value || "";
      readyRef.current = true;
    })();

    return () => {
      cancelled = true;
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
      if (current !== (value || "")) jq(divRef.current).summernote("code", value || "");
    } catch {
      /* abaikan */
    }
  }, [value]);

  return <div ref={divRef} className="bg-paper" />;
}
