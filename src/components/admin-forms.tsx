"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const SummernoteEditor = dynamic(() => import("./summernote-editor"), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-muted">Memuat editor…</p>,
});

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-alert">{error}</p>;
}

export function SyncButton() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
        onClick={() => {
          setError(null);
          setPending(true);
          void api<{ successCount: number; failedCount: number }>("/api/admin/sinkron", { body: {} })
            .then(() => window.location.reload())
            .catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : "Sinkronisasi gagal.");
              setPending(false);
            });
        }}>
        <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M4.5 12a7.5 7.5 0 0 1 12.7-5.4M19.5 12a7.5 7.5 0 0 1-12.7 5.4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M17 3.5v4h4M7 20.5v-4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {pending ? "Menyinkronkan…" : "Sinkron peserta"}
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function ResetSessionButton({ userId }: { userId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
        onClick={() => {
          setPending(true);
          setDone(false);
          void api(`/api/admin/users/${userId}/revoke-session`, { body: {} })
            .then(() => {
              setError(null);
              setDone(true);
            })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal mereset sesi."))
            .finally(() => setPending(false));
        }}>
        {pending ? "Mereset…" : done ? "Sesi direset" : "Reset sesi"}
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function CategoryForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        void api("/api/admin/kategori", { body: { name: form.get("name"), description: form.get("description") || undefined } })
          .then(() => window.location.reload())
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Gagal menyimpan kategori.");
            setPending(false);
          });
      }}>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Nama kategori
        <input name="name" required placeholder="Mis. Matematika · Aljabar" className="rounded-xl border border-line px-3 py-2.5 font-normal" />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Deskripsi <span className="font-normal text-ink-muted">(opsional)</span>
        <input name="description" placeholder="Catatan singkat kategori" className="rounded-xl border border-line px-3 py-2.5 font-normal" />
      </label>
      <ErrorText error={error} />
      <button
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
        type="submit"
        disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan kategori"}
      </button>
    </form>
  );
}

type OptionDraft = { label: string; body: string; isCorrect: boolean };

export function DeleteQuestionButton({ questionId }: { questionId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col items-stretch gap-1 sm:items-end">
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-alert/30 px-4 text-sm font-semibold text-alert transition hover:bg-alert/5 disabled:opacity-60"
        onClick={() => {
          if (!window.confirm("Hapus soal ini? Tindakan tidak dapat dibatalkan. Soal yang sudah dipakai ujian harus dinonaktifkan saja.")) return;
          setPending(true);
          setError(null);
          void api("/api/admin/hapus-soal", { body: { id: questionId } })
            .then(() => {
              window.location.href = "/admin/soal";
            })
            .catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : "Gagal menghapus soal.");
              setPending(false);
            });
        }}>
        {pending ? "Menghapus…" : "Hapus soal"}
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function QuestionForm({
  categories,
  initial,
}: {
  categories: { id: number; name: string }[];
  initial?: {
    id: number;
    code: string;
    categoryId: number;
    type: "MULTIPLE_CHOICE" | "ESSAY";
    body: string;
    defaultWeight: number;
    isActive: boolean;
    options: OptionDraft[];
    answerKey: string;
    rubric: string;
  };
}) {
  const [type, setType] = useState<"MULTIPLE_CHOICE" | "ESSAY">(initial?.type ?? "MULTIPLE_CHOICE");
  const [options, setOptions] = useState<OptionDraft[]>(
    initial?.options?.length
      ? initial.options
      : [
          { label: "A", body: "", isCorrect: true },
          { label: "B", body: "", isCorrect: false },
        ],
  );
  const [bodyHtml, setBodyHtml] = useState(initial?.body ?? "");
  const [answerKeyHtml, setAnswerKeyHtml] = useState(initial?.answerKey ?? "");
  const [rubricHtml, setRubricHtml] = useState(initial?.rubric ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const editing = Boolean(initial?.id);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!stripHtml(bodyHtml)) {
          setError("Teks soal tidak boleh kosong.");
          return;
        }
        if (type === "MULTIPLE_CHOICE") {
          const emptyOption = options.find((option) => !stripHtml(option.body));
          if (emptyOption) {
            setError(`Jawaban ${emptyOption.label} masih kosong.`);
            return;
          }
          if (!options.some((option) => option.isCorrect)) {
            setError("Pilih satu opsi sebagai kunci jawaban.");
            return;
          }
        }
        const form = new FormData(event.currentTarget);
        const payload = {
          id: initial?.id,
          code: String(form.get("code") ?? ""),
          categoryId: Number(form.get("categoryId")),
          type,
          body: bodyHtml,
          defaultWeight: Number(form.get("defaultWeight") || 1),
          isActive: form.get("isActive") === "on",
          options,
          answerKey: answerKeyHtml,
          rubric: rubricHtml,
        };
        setPending(true);
        setError(null);
        void api<{ id: number }>("/api/admin/soal", { body: payload })
          .then(() => {
            window.location.href = "/admin/soal";
          })
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Gagal menyimpan soal.");
            setPending(false);
          });
      }}>
      <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight text-ink">Identitas soal</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Kode, kategori, jenis, dan status pemakaian.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
            Kode
            <input
              name="code"
              required
              defaultValue={initial?.code}
              placeholder="Mis. MTK-001"
              className="rounded-xl border border-line px-3 py-2.5 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Kategori
            <select
              name="categoryId"
              required
              defaultValue={initial?.categoryId}
              disabled={categories.length === 0}
              className="rounded-xl border border-line px-3 py-2.5 font-normal disabled:opacity-60">
              {categories.length === 0 ? <option value="">Belum ada kategori</option> : null}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Bobot
            <input
              name="defaultWeight"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={initial?.defaultWeight ?? 1}
              className="rounded-xl border border-line px-3 py-2.5 font-normal"
            />
          </label>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">Jenis soal</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "MULTIPLE_CHOICE" as const, label: "Pilihan ganda", hint: "Dinilai otomatis" },
                { id: "ESSAY" as const, label: "Uraian", hint: "Dinilai petugas" },
              ] as const
            ).map((item) => {
              const active = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  className={`rounded-xl border px-4 py-2.5 text-left transition ${
                    active ? "border-brand bg-brand-soft text-brand" : "border-line bg-page/50 text-ink-muted hover:border-brand/40 hover:text-ink"
                  }`}>
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className={`block text-xs ${active ? "text-brand/80" : "text-ink-muted"}`}>{item.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2.5 rounded-xl bg-page/80 px-3 py-3 text-sm text-ink">
          <input name="isActive" type="checkbox" defaultChecked={initial?.isActive ?? true} className="size-4 accent-[var(--color-brand)]" />
          Soal aktif dan bisa dipakai di paket ujian
        </label>
      </section>

      <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight text-ink">Isi soal</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Mendukung format teks, tabel, dan gambar.</p>
        </div>
        <SummernoteEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Tulis soal di sini…" height={220} />
      </section>

      {type === "MULTIPLE_CHOICE" ? (
        <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-ink">Opsi jawaban</h2>
              <p className="mt-0.5 text-sm text-ink-muted">Tandai satu opsi sebagai kunci. Minimal dua opsi.</p>
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-sm font-semibold text-brand transition hover:border-brand hover:bg-brand-soft"
              onClick={() => setOptions([...options, { label: String.fromCharCode(65 + options.length), body: "", isCorrect: false }])}>
              + Tambah opsi
            </button>
          </div>
          <div className="flex flex-col gap-3">
            {options.map((option, index) => (
              <div
                key={`${option.label}-${index}`}
                className={`rounded-xl border p-4 transition ${
                  option.isCorrect ? "border-brand/35 bg-brand-soft/30" : "border-line/80 bg-paper"
                }`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <input
                    aria-label={`Label opsi ${index + 1}`}
                    value={option.label}
                    onChange={(event) => {
                      const next = [...options];
                      next[index] = { ...option, label: event.target.value };
                      setOptions(next);
                    }}
                    className="w-16 rounded-lg border border-line px-2 py-2 text-center text-sm font-semibold"
                  />
                  <label className="inline-flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-sm font-semibold text-ink">
                    <input
                      type="radio"
                      name="kunci"
                      checked={option.isCorrect}
                      className="accent-[var(--color-brand)]"
                      onChange={() => setOptions(options.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })))}
                    />
                    Kunci
                  </label>
                  {options.length > 2 ? (
                    <button
                      type="button"
                      className="ml-auto text-sm font-semibold text-alert hover:underline"
                      onClick={() => setOptions(options.filter((_, itemIndex) => itemIndex !== index))}>
                      Hapus
                    </button>
                  ) : null}
                </div>
                <SummernoteEditor
                  value={option.body}
                  placeholder={`Tulis jawaban ${option.label}…`}
                  height={110}
                  onChange={(html) => {
                    const next = [...options];
                    next[index] = { ...option, body: html };
                    setOptions(next);
                  }}
                />
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight text-ink">Pedoman penilaian</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Dipakai petugas saat menilai jawaban uraian.</p>
          </div>
          <div className="grid gap-5">
            <div>
              <span className="mb-2 block text-sm font-semibold text-ink">Pedoman jawaban</span>
              <SummernoteEditor value={answerKeyHtml} onChange={setAnswerKeyHtml} placeholder="Tulis pedoman jawaban…" height={150} />
            </div>
            <div>
              <span className="mb-2 block text-sm font-semibold text-ink">Rubrik skor</span>
              <SummernoteEditor value={rubricHtml} onChange={setRubricHtml} placeholder="Tulis rubrik penilaian…" height={150} />
            </div>
          </div>
        </section>
      )}

      <div className="sticky bottom-3 z-10 rounded-xl border border-line/80 bg-paper/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <ErrorText error={error} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <a href="/admin/soal" className="text-sm font-semibold text-ink-muted transition hover:text-brand">
            Batal ke daftar soal
          </a>
          <button
            type="submit"
            disabled={pending || categories.length === 0}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
            {pending ? "Menyimpan…" : editing ? "Simpan perubahan" : "Simpan soal"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function ImportForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
        if (!file) return;
        setPending(true);
        setError(null);
        setMessage(null);
        void file
          .text()
          .then((csv) =>
            api<{ success: number; errors: string[] }>("/api/admin/impor", { body: { csv } }).then((result) => {
              setMessage(`Tersimpan ${result.success} soal.${result.errors.length ? ` ${result.errors.length} baris gagal.` : ""}`);
              if (result.errors.length) setError(result.errors.slice(0, 3).join(" "));
            }),
          )
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Impor gagal."))
          .finally(() => setPending(false));
      }}>
      <p className="rounded-xl bg-page/80 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
        Kolom CSV: <span className="font-digits text-ink">kode, kategori, jenis, teks, bobot, opsi_a–d, kunci, pedoman, rubrik</span>.
        Jenis diisi <span className="font-semibold text-ink">pg</span> atau <span className="font-semibold text-ink">uraian</span>.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Berkas CSV
        <input
          name="file"
          type="file"
          accept=".csv,text/csv"
          required
          className="rounded-xl border border-dashed border-line-strong/70 bg-page/40 px-3 py-3 font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand"
        />
      </label>
      {message ? <p className="text-sm text-ink">{message}</p> : null}
      <ErrorText error={error} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-line bg-paper px-5 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-60">
        {pending ? "Mengimpor…" : "Impor CSV"}
      </button>
    </form>
  );
}

export function ExamForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-5 rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        void api<{ id: number }>("/api/admin/ujian", {
          body: {
            name: form.get("name"),
            examDate: form.get("examDate"),
            durationMinutes: Number(form.get("durationMinutes")),
            shuffleQuestions: form.get("shuffleQuestions") === "on",
            shuffleOptions: form.get("shuffleOptions") === "on",
            status: form.get("status"),
          },
        })
          .then((result) => {
            window.location.href = `/admin/ujian/${result.id}`;
          })
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Gagal menyimpan ujian.");
            setPending(false);
          });
      }}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="exam-name" className="text-sm font-semibold text-ink">
          Nama ujian
        </label>
        <p className="text-xs text-ink-muted">Contoh: Ujian Tengah Semester Matematika</p>
        <input id="exam-name" name="name" required className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="exam-date" className="text-sm font-semibold text-ink">
            Tanggal ujian
          </label>
          <p className="text-xs text-ink-muted">Tanggal pelaksanaan resmi ujian</p>
          <input
            id="exam-date"
            name="examDate"
            type="date"
            required
            className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="exam-duration" className="text-sm font-semibold text-ink">
            Durasi pengerjaan
          </label>
          <p className="text-xs text-ink-muted">Dalam menit, dihitung sejak peserta mulai</p>
          <input
            id="exam-duration"
            name="durationMinutes"
            type="number"
            min={1}
            defaultValue={60}
            required
            className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="exam-status" className="text-sm font-semibold text-ink">
          Status awal
        </label>
        <p className="text-xs text-ink-muted">
          Draf: masih disiapkan. Terbit: siap dijadwalkan. Arsip: tidak dipakai lagi.
        </p>
        <select
          id="exam-status"
          name="status"
          defaultValue="DRAFT"
          className="rounded-xl border border-line px-3 py-2.5 text-sm font-normal">
          <option value="DRAFT">Draf</option>
          <option value="PUBLISHED">Terbit</option>
          <option value="ARCHIVED">Arsip</option>
        </select>
      </div>

      <fieldset className="rounded-xl border border-line/80 bg-page/60 p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Pengacakan</legend>
        <p className="mb-3 text-xs text-ink-muted">Opsional. Berlaku per peserta saat mengerjakan.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" name="shuffleQuestions" className="mt-0.5 size-4 accent-[var(--color-brand)]" />
            <span>
              <span className="font-semibold">Acak urutan soal</span>
              <span className="mt-0.5 block text-xs font-normal text-ink-muted">Tiap peserta mendapat urutan soal berbeda</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input type="checkbox" name="shuffleOptions" className="mt-0.5 size-4 accent-[var(--color-brand)]" />
            <span>
              <span className="font-semibold">Acak urutan opsi</span>
              <span className="mt-0.5 block text-xs font-normal text-ink-muted">Pilihan A–D diacak per peserta</span>
            </span>
          </label>
        </div>
      </fieldset>

      <ErrorText error={error} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
        {pending ? "Menyimpan…" : "Buat ujian"}
      </button>
    </form>
  );
}

export function PackageForm({
  examId,
  questions,
  selected,
}: {
  examId: number;
  questions: { id: number; code: string; defaultWeight: string; type?: string; categoryName?: string }[];
  selected: number[];
}) {
  const [picked, setPicked] = useState<number[]>(selected);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const deferred = query.trim().toLowerCase();
  const filtered = questions.filter((question) => {
    if (!deferred) return true;
    const haystack = [question.code, question.categoryName ?? "", question.type ?? ""].join(" ").toLowerCase();
    return haystack.includes(deferred);
  });
  const dirty =
    picked.length !== selected.length || picked.some((id) => !selected.includes(id)) || selected.some((id) => !picked.includes(id));

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const items = picked.map((questionId) => {
          const question = questions.find((item) => item.id === questionId);
          return { questionId, weight: Number(question?.defaultWeight ?? 1) };
        });
        setPending(true);
        setError(null);
        void api("/api/admin/paket", { body: { examId, items } })
          .then(() => window.location.reload())
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Gagal menyimpan paket.");
            setPending(false);
          });
      }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ink-muted">
          <span className="font-digits font-semibold text-ink tabular-nums">{picked.length}</span> soal dipilih
          {dirty ? <span className="text-mark-ink"> · ada perubahan belum disimpan</span> : null}
        </p>
        <label className="relative block w-full sm:max-w-xs">
          <span className="sr-only">Cari soal</span>
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kode atau kategori"
            className="w-full rounded-xl border border-line bg-page/60 py-2.5 pr-3 pl-9 text-sm font-normal placeholder:text-ink-muted focus:border-brand focus:bg-paper"
          />
        </label>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong/60 px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink">Bank soal masih kosong</p>
          <p className="mt-1 text-xs text-ink-muted">Tambah soal dulu sebelum menyusun paket.</p>
          <a href="/admin/soal/baru" className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">
            Tambah soal
          </a>
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl bg-page/80 px-4 py-6 text-center text-sm text-ink-muted">Tidak ada soal yang cocok.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-line/70 overflow-auto rounded-xl border border-line/80">
          {filtered.map((question) => {
            const checked = picked.includes(question.id);
            const typeLabel = question.type === "ESSAY" ? "Uraian" : question.type === "MULTIPLE_CHOICE" ? "PG" : null;
            return (
              <li key={question.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-brand-soft/30 ${
                    checked ? "bg-brand-soft/40" : "bg-paper"
                  }`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    className="size-4 accent-[var(--color-brand)]"
                    onChange={(event) => {
                      setPicked(event.target.checked ? [...picked, question.id] : picked.filter((id) => id !== question.id));
                    }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-ink">{question.code}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {[typeLabel, question.categoryName, `bobot ${question.defaultWeight}`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50">
          {pending ? "Menyimpan…" : "Simpan paket"}
        </button>
        {dirty ? (
          <button
            type="button"
            className="text-sm font-semibold text-ink-muted hover:text-ink"
            onClick={() => setPicked(selected)}>
            Batalkan perubahan
          </button>
        ) : null}
      </div>
      <ErrorText error={error} />
    </form>
  );
}

export function SessionForm({ examId }: { examId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        setPending(true);
        setError(null);
        void api("/api/admin/sesi", {
          body: {
            examId,
            name: form.get("name"),
            startsAt: form.get("startsAt"),
            endsAt: form.get("endsAt"),
            attendanceOpensAt: form.get("attendanceOpensAt"),
            capacity: form.get("capacity") ? Number(form.get("capacity")) : null,
          },
        })
          .then(() => window.location.reload())
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Gagal membuat sesi.");
            setPending(false);
          });
      }}>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Nama sesi
        <input
          name="name"
          required
          placeholder="Mis. Sesi pagi / Gelombang 1"
          className="rounded-xl border border-line px-3 py-2.5 font-normal"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
          Absensi dibuka
          <input name="attendanceOpensAt" type="datetime-local" required className="rounded-xl border border-line px-3 py-2.5 font-normal" />
          <span className="font-normal text-xs text-ink-muted">Peserta bisa absen mulai waktu ini.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Mulai ujian
          <input name="startsAt" type="datetime-local" required className="rounded-xl border border-line px-3 py-2.5 font-normal" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Selesai ujian
          <input name="endsAt" type="datetime-local" required className="rounded-xl border border-line px-3 py-2.5 font-normal" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Kuota peserta
        <input
          name="capacity"
          type="number"
          min={1}
          placeholder="Kosongkan jika tanpa batas"
          className="rounded-xl border border-line px-3 py-2.5 font-normal"
        />
      </label>
      <ErrorText error={error} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
        {pending ? "Menyimpan…" : "Tambah sesi"}
      </button>
    </form>
  );
}

export function AssignForm({ sessionId, users }: { sessionId: number; users: { id: number; name: string; identity: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void api("/api/admin/peserta", { body: { sessionId, userId: Number(form.get("userId")) } })
          .then(() => window.location.reload())
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Penugasan ditolak."));
      }}>
      <select name="userId" className="rounded-sm border border-line-strong px-3 py-2 text-sm">
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.identity})
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md bg-brand font-semibold hover:brightness-110 px-3 py-2 text-sm text-white">
        Tugaskan
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export function RemoveParticipantButton({ sessionId, userId }: { sessionId: number; userId: number }) {
  return (
    <button
      type="button"
      className="text-sm text-alert"
      onClick={() => {
        void api("/api/admin/peserta", { body: { sessionId, userId, remove: true } }).then(() => window.location.reload());
      }}>
      Hapus
    </button>
  );
}

export function ExtraTimeForm({ attemptId }: { attemptId: number }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void api("/api/admin/waktu", { body: { attemptId, minutes: Number(form.get("minutes")) } })
          .then(() => window.location.reload())
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal menambah waktu."));
      }}>
      <input name="minutes" type="number" min={1} max={180} defaultValue={10} className="w-20 rounded-sm border border-line-strong px-2 py-1" />
      <button type="submit" className="text-sm text-brand">
        Tambah menit
      </button>
      <ErrorText error={error} />
    </form>
  );
}
