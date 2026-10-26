"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { api } from "@/lib/api";
import { patchJqueryCompat } from "@/lib/jquery-compat";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
import "select2/dist/css/select2.min.css";

const SummernoteEditor = dynamic(() => import("./summernote-editor"), {
  ssr: false,
  loading: () => <p className="text-sm text-ink-muted">Memuat editor…</p>,
});

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function previewQuestionText(html: string, max = 50): string {
  const plain = stripHtml(html);
  if (plain.length <= max) return plain || "—";
  return `${plain.slice(0, max)}…`;
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
        <FontAwesomeIcon icon={Icon.Refresh} className="size-4" spin={pending} />
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
    type: "MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER";
    body: string;
    defaultWeight: number;
    defaultWrongWeight: number;
    isActive: boolean;
    options: OptionDraft[];
    answerKey: string;
    rubric: string;
    shortAnswerKey: string;
  };
}) {
  const [type, setType] = useState<"MULTIPLE_CHOICE" | "ESSAY" | "SHORT_ANSWER">(initial?.type ?? "MULTIPLE_CHOICE");
  const [options, setOptions] = useState<OptionDraft[]>(
    initial?.options?.length
      ? initial.options
      : [
          { label: "A", body: "", isCorrect: true },
          { label: "B", body: "", isCorrect: false },
          { label: "C", body: "", isCorrect: false },
          { label: "D", body: "", isCorrect: false },
          { label: "E", body: "", isCorrect: false },
        ],
  );
  const [bodyHtml, setBodyHtml] = useState(initial?.body ?? "");
  const [answerKeyHtml, setAnswerKeyHtml] = useState(initial?.answerKey ?? "");
  const [rubricHtml, setRubricHtml] = useState(initial?.rubric ?? "");
  const [shortAnswerKey, setShortAnswerKey] = useState(initial?.shortAnswerKey ?? "");
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
        let filledOptions = options;
        if (type === "MULTIPLE_CHOICE") {
          filledOptions = options.filter((option) => stripHtml(option.body));
          if (filledOptions.length < 4) {
            setError("Pilihan ganda wajib mengisi minimal 4 opsi.");
            return;
          }
          if (!filledOptions.some((option) => option.isCorrect)) {
            setError("Pilih satu opsi terisi sebagai kunci jawaban.");
            return;
          }
        } else if (type === "SHORT_ANSWER") {
          if (!shortAnswerKey.trim()) {
            setError("Jawaban singkat membutuhkan satu kunci jawaban.");
            return;
          }
        } else if (type === "ESSAY") {
          if (!stripHtml(answerKeyHtml)) {
            setError("Uraian membutuhkan pedoman jawaban.");
            return;
          }
        }
        const form = new FormData(event.currentTarget);
        const rawWrong = form.get("defaultWrongWeight");
        const parsedWrong = rawWrong === "" || rawWrong == null ? -1 : Number(rawWrong);
        const payload = {
          id: initial?.id,
          categoryId: Number(form.get("categoryId")),
          type,
          body: bodyHtml,
          defaultWeight: Number(form.get("defaultWeight") || 1),
          defaultWrongWeight: Math.abs(Number.isFinite(parsedWrong) ? parsedWrong : 1),
          isActive: form.get("isActive") === "on",
          options: filledOptions,
          answerKey: answerKeyHtml,
          rubric: rubricHtml,
          shortAnswerKey,
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
          <p className="mt-0.5 text-sm text-ink-muted">Kategori, jenis, dan status pemakaian. Kode dibuat otomatis oleh sistem.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {editing && initial?.code ? (
            <div className="sm:col-span-2">
              <p className="text-sm font-semibold text-ink">Kode</p>
              <p className="mt-1 rounded-xl border border-line bg-page/60 px-3 py-2.5 font-digits text-sm text-ink">
                {initial.code}
              </p>
              <p className="mt-1 text-xs font-normal text-ink-muted">Dibuat otomatis dan tidak dapat diubah.</p>
            </div>
          ) : null}
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
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
            Bobot benar
            <input
              name="defaultWeight"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={initial?.defaultWeight ?? 1}
              className="rounded-xl border border-line px-3 py-2.5 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Bobot salah
            <input
              name="defaultWrongWeight"
              type="number"
              step="0.01"
              defaultValue={initial ? -Number(initial.defaultWrongWeight) : -1}
              className="rounded-xl border border-line px-3 py-2.5 font-normal"
            />
          </label>
          <p className="text-xs font-normal text-ink-muted sm:col-span-2">
            Bobot salah memakai nilai negatif (default −1). Soal kosong tidak dikurangi.
          </p>
        </div>

        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold text-ink">Jenis soal</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "MULTIPLE_CHOICE" as const, label: "Pilihan ganda", hint: "Dinilai otomatis" },
                { id: "ESSAY" as const, label: "Uraian", hint: "Dinilai petugas" },
                { id: "SHORT_ANSWER" as const, label: "Jawaban singkat", hint: "Satu kunci, huruf kecil" },
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
              <p className="mt-0.5 text-sm text-ink-muted">Tandai satu opsi sebagai kunci. Wajib isi minimal 4 dari 5 opsi (A–E).</p>
            </div>
            {options.length < 5 ? (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-sm font-semibold text-brand transition hover:border-brand hover:bg-brand-soft"
                onClick={() => setOptions([...options, { label: String.fromCharCode(65 + options.length), body: "", isCorrect: false }])}>
                + Tambah opsi
              </button>
            ) : null}
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
                  {index >= 4 ? (
                    <span className="ml-auto text-xs font-normal text-ink-muted">Opsional</span>
                  ) : (
                    <span className="ml-auto text-xs font-normal text-ink-muted">Wajib</span>
                  )}
                  {options.length > 4 ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-alert hover:underline"
                      onClick={() => setOptions(options.filter((_, itemIndex) => itemIndex !== index))}>
                      Hapus
                    </button>
                  ) : null}
                </div>
                <SummernoteEditor
                  value={option.body}
                  placeholder={
                    index >= 4 ? `Jawaban ${option.label} (opsional)…` : `Tulis jawaban ${option.label}…`
                  }
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
      ) : type === "SHORT_ANSWER" ? (
        <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold tracking-tight text-ink">Kunci jawaban singkat</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Hanya satu kunci. Jawaban peserta dicocokkan setelah keduanya diubah ke huruf kecil.</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold text-ink">Kunci jawaban</label>
            <input
              type="text"
              maxLength={500}
              value={shortAnswerKey}
              onChange={(e) => setShortAnswerKey(e.target.value)}
              placeholder="Contoh: jakarta"
              className="w-full rounded-xl border border-line px-3 py-2.5 font-normal"
            />
            <p className="mt-1 text-xs text-ink-muted">Jakarta, JAKARTA, dan jakarta dianggap sama. Spasi di awal dan akhir diabaikan.</p>
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
          <Link href="/admin/soal" className="text-sm font-semibold text-ink-muted transition hover:text-brand">
            Batal ke daftar soal
          </Link>
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

        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target?.result as string;
          api<{ success: number; errors: string[] }>("/api/admin/impor", { body: { data } })
            .then((result) => {
              setMessage(`Tersimpan ${result.success} soal.${result.errors.length ? ` ${result.errors.length} baris gagal.` : ""}`);
              if (result.errors.length) setError(result.errors.slice(0, 3).join(" "));
            })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Impor gagal."))
            .finally(() => setPending(false));
        };
        reader.onerror = () => {
          setError("Gagal membaca berkas.");
          setPending(false);
        };

        if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
          reader.readAsBinaryString(file);
        } else {
          reader.readAsText(file);
        }
      }}>
      <p className="rounded-xl bg-page/80 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
        Kolom Excel/CSV:{" "}
        <span className="font-digits text-ink">
          paket, kategori, jenis, teks, bobot, bobot_salah, opsi_a–e, kunci, kunci_jawaban_singkat, pedoman, rubrik, ada_gambar
        </span>
        . Kolom <span className="font-digits text-ink">paket</span> menambahkan soal ke
        paket (dibuat otomatis bila belum ada). Jenis diisi <span className="font-semibold text-ink">pg</span>,{" "}
        <span className="font-semibold text-ink">uraian</span>, atau <span className="font-semibold text-ink">jawaban singkat</span>. PG wajib isi minimal 4 opsi. Jawaban singkat wajib satu kunci di kolom{" "}
        <span className="font-digits text-ink">kunci_jawaban_singkat</span>. Kolom{" "}
        <span className="font-digits text-ink">ada_gambar</span> diisi 1/true jika soal memiliki gambar.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
        Berkas Excel atau CSV
        <input
          name="file"
          type="file"
          accept=".xlsx,.xls,.csv,text/csv"
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
        {pending ? "Mengimpor…" : "Impor Excel/CSV"}
      </button>
    </form>
  );
}

type PackageOption = { id: number; name: string; itemCount: number };
type CompetitionOption = { id: number; name: string; jenjangGroups: ("SD" | "SMP" | "SMA" | "SMK")[] };

type JQuerySelect2 = JQuery & {
  select2: (opts?: object | string) => JQuery;
};

function bindSelect2(jq: JQueryStatic, factory: unknown): void {
  if (typeof (jq.fn as { select2?: unknown }).select2 === "function") return;
  if (typeof factory === "function") {
    (factory as (root: Window, jQuery: JQueryStatic) => void)(window, jq);
  }
}

export function ExamForm({
  packages,
  competitions,
  competitionsError,
  examId,
  initialData,
}: {
  packages: PackageOption[];
  competitions: CompetitionOption[];
  competitionsError?: string | null;
  examId?: number;
  initialData?: {
    competitionId: number;
    attendanceOpensAt: string;
    startsAt: string;
    durationMinutes: number;
    shuffleQuestions: boolean;
    shuffleOptions: boolean;
    status: string;
    packages: Record<string, number>;
  };
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [competitionId, setCompetitionId] = useState<number | "">(initialData?.competitionId ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const selected = competitions.find((row) => row.id === competitionId);
  const groups = selected?.jenjangGroups?.length ? selected.jenjangGroups : [];
  const isEdit = Boolean(examId);

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

        // Handle select2 change event
        $el.on("change", function () {
          if (el.name === "competitionId") {
            const value = (this as HTMLSelectElement).value;
            setCompetitionId(value ? Number(value) : "");
          }
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
      });
    })();

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
  }, []);

  // Update select2 value when competitionId changes
  useEffect(() => {
    if (!formRef.current) return;
    const select = formRef.current.querySelector<HTMLSelectElement>('select[name="competitionId"]');
    if (!select) return;

    // Need to wait for select2 to be initialized
    const interval = setInterval(() => {
      const $ = (window as any).$;
      if (!$ || !$(select).data("select2")) return;

      const $select = $(select) as JQuerySelect2;
      const currentValue = $select.val();
      const newValue = competitionId === "" ? "" : String(competitionId);

      if (currentValue !== newValue) {
        $select.val(newValue).trigger("change");
      }

      clearInterval(interval);
    }, 100);

    return () => clearInterval(interval);
  }, [competitionId]);

  // Extra: ensure select2 value is set after initialization in edit mode
  useEffect(() => {
    if (!isEdit || !initialData?.competitionId || !formRef.current) return;

    const timeout = setTimeout(() => {
      if (!formRef.current) return;
      const select = formRef.current.querySelector<HTMLSelectElement>('select[name="competitionId"]');
      if (!select) return;

      const $ = (window as any).$;
      if (!$ || !$(select).data("select2")) return;

      const $select = $(select) as JQuerySelect2;
      const currentValue = $select.val();
      const newValue = String(initialData.competitionId);

      if (currentValue !== newValue) {
        $select.val(newValue).trigger("change");
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [isEdit, initialData?.competitionId]);

  // Pre-select packages when editing
  useEffect(() => {
    if (!isEdit || !formRef.current || !initialData?.packages) return;

    const interval = setInterval(() => {
      const $ = (window as any).$;
      if (!$ || !formRef.current) return;

      let allSet = true;
      for (const [group, packageId] of Object.entries(initialData.packages)) {
        const select = formRef.current.querySelector<HTMLSelectElement>(`select[name="package_${group}"]`);
        if (!select || !$(select).data("select2")) {
          allSet = false;
          continue;
        }

        const $select = $(select) as JQuerySelect2;
        const currentValue = $select.val();
        const newValue = String(packageId);

        if (currentValue !== newValue) {
          $select.val(newValue).trigger("change");
        }
      }

      if (allSet) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isEdit, initialData?.packages]);

  return (
    <form
      ref={formRef}
      className="grid gap-5 rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const compId = Number(form.get("competitionId"));
        if (!compId && !isEdit) {
          setError("Pilih lomba dari daftar.");
          return;
        }
        if (groups.length === 0 && !isEdit) {
          setError("Lomba yang dipilih tidak memiliki jenjang.");
          return;
        }
        const packageMap: Record<string, number> = {};
        for (const group of groups) {
          const packageId = Number(form.get(`package_${group}`));
          if (!packageId) {
            setError(`Pilih paket soal untuk jenjang ${group}.`);
            return;
          }
          packageMap[group] = packageId;
        }
        setPending(true);
        setError(null);
        const payload = {
          id: examId,
          competitionId: compId,
          attendanceOpensAt: form.get("attendanceOpensAt"),
          startsAt: form.get("startsAt"),
          durationMinutes: Number(form.get("durationMinutes")),
          shuffleQuestions: form.get("shuffleQuestions") === "on",
          shuffleOptions: form.get("shuffleOptions") === "on",
          status: form.get("status"),
          packages: packageMap,
        };
        void api<{ id: number }>("/api/admin/ujian", {
          body: payload,
        })
          .then((result) => {
            window.location.href = `/admin/ujian/${result.id}`;
          })
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Gagal menyimpan ujian.");
            setPending(false);
          });
      }}>
      {competitionsError ? (
        <p className="rounded-xl border border-dashed border-alert/40 bg-mark px-4 py-3 text-sm text-alert">{competitionsError}</p>
      ) : null}

      {!isEdit ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="exam-competition" className="text-sm font-semibold text-ink">
            Lomba (OMBN)
          </label>
          <p className="text-xs text-ink-muted">Nama ujian diambil dari nama lomba. Satu lomba boleh punya beberapa ujian.</p>
          <select
            id="exam-competition"
            name="competitionId"
            required
            defaultValue={competitionId === "" ? "" : String(competitionId)}
            className="js-select2 rounded-xl border border-line px-3 py-2.5 text-sm font-normal"
            data-placeholder="Pilih lomba…">
            <option value="" disabled>
              Pilih lomba…
            </option>
            {competitions.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name} (#{row.id})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink sm:col-span-2">
          Absensi dibuka
          <input
            name="attendanceOpensAt"
            type="datetime-local"
            required
            defaultValue={initialData?.attendanceOpensAt}
            className="w-full rounded-xl border border-line px-3 py-2.5 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Jadwal mulai (rencana)
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={initialData?.startsAt}
            className="w-full rounded-xl border border-line px-3 py-2.5 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Durasi per peserta (menit)
          <input
            name="durationMinutes"
            type="number"
            min={1}
            defaultValue={initialData?.durationMinutes ?? 120}
            required
            className="rounded-xl border border-line px-3 py-2.5 font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
          Status awal
          <select name="status" defaultValue={initialData?.status ?? "DRAFT"} className="rounded-xl border border-line px-3 py-2.5 font-normal">
            <option value="DRAFT">Draf</option>
            <option value="PUBLISHED">Terbit</option>
            <option value="ARCHIVED">Arsip</option>
          </select>
        </label>
      </div>

      {groups.length > 0 ? (
        <div className="grid gap-4 rounded-xl border border-line/80 bg-page/60 p-4">
          <p className="text-sm font-semibold text-ink">Paket soal per jenjang</p>
          {groups.map((group) => (
            <label key={group} className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
              {group}
              <select
                name={`package_${group}`}
                required
                defaultValue={initialData?.packages[group] ?? ""}
                className="rounded-xl border border-line px-3 py-2.5 font-normal">
                <option value="" disabled>
                  Pilih paket…
                </option>
                {packages.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.name} ({pack.itemCount} soal)
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line-strong/60 bg-page/40 px-4 py-6 text-center">
          <p className="text-sm font-semibold text-ink">Pilih lomba dulu</p>
          <p className="mt-1 text-xs text-ink-muted">Daftar jenjang dan paket soal akan muncul setelah lomba dipilih.</p>
        </div>
      )}

      <fieldset className="rounded-xl border border-line/80 bg-page/60 p-4">
        <legend className="px-1 text-sm font-semibold text-ink">Pengacakan</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="shuffleQuestions"
              defaultChecked={isEdit ? initialData?.shuffleQuestions : true}
              className="mt-0.5 size-4 accent-[var(--color-brand)]"
            />
            <span className="font-semibold">Acak urutan soal</span>
          </label>
          <label className="flex items-start gap-2.5 text-sm text-ink">
            <input
              type="checkbox"
              name="shuffleOptions"
              defaultChecked={isEdit ? initialData?.shuffleOptions : true}
              className="mt-0.5 size-4 accent-[var(--color-brand)]"
            />
            <span className="font-semibold">Acak urutan opsi</span>
          </label>
        </div>
      </fieldset>

      <ErrorText error={error} />
      <button
        type="submit"
        disabled={pending || packages.length === 0 || (!competitionId && !isEdit) || (groups.length === 0 && !isEdit) || Boolean(competitionsError)}
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
        {pending ? "Menyimpan…" : isEdit ? "Simpan perubahan" : "Buat ujian"}
      </button>
    </form>
  );
}

type QuestionPick = {
  id: number;
  code: string;
  body: string;
  defaultWeight: string;
  defaultWrongWeight: string;
  type?: string;
  categoryName?: string;
};

export function ExamControlButtons({
  examId,
  phase,
  status,
}: {
  examId: number;
  phase: "NOT_STARTED" | "RUNNING" | "ENDED";
  status: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"start" | "end" | "sync" | null>(null);
  const canControl = status === "PUBLISHED";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canControl || phase !== "NOT_STARTED" || pending !== null}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
          onClick={() => {
            if (!window.confirm("Mulai ujian sekarang? Peserta di ruang tunggu akan diarahkan mengerjakan.")) return;
            setPending("start");
            setError(null);
            void api(`/api/admin/exams/${examId}/start`, { body: {} })
              .then(() => window.location.reload())
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "Gagal memulai ujian.");
                setPending(null);
              });
          }}>
          {pending === "start" ? "Memulai…" : "MULAI"}
        </button>
        <button
          type="button"
          disabled={!canControl || phase !== "RUNNING" || pending !== null}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-5 text-sm font-semibold text-ink transition hover:border-brand disabled:opacity-50"
          onClick={() => {
            if (!window.confirm("Akhiri ujian sekarang? Semua pengerjaan terbuka akan ditutup.")) return;
            setPending("end");
            setError(null);
            void api(`/api/admin/exams/${examId}/end`, { body: {} })
              .then(() => window.location.reload())
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "Gagal mengakhiri ujian.");
                setPending(null);
              });
          }}>
          {pending === "end" ? "Menutup…" : "SELESAI"}
        </button>
        <button
          type="button"
          disabled={pending !== null}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-5 text-sm font-semibold text-ink transition hover:border-brand disabled:opacity-50"
          onClick={() => {
            setPending("sync");
            setError(null);
            void api<{ name: string }>(`/api/admin/exams/${examId}/sync-name`, { body: {} })
              .then(() => window.location.reload())
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : "Gagal sinkron nama.");
                setPending(null);
              });
          }}>
          {pending === "sync" ? "Menyinkron…" : "Sinkron ulang nama"}
        </button>
      </div>
      <ErrorText error={error} />
    </div>
  );
}

export function QuestionPackageForm({
  questions,
  initial,
}: {
  questions: QuestionPick[];
  initial?: {
    id: number;
    name: string;
    description: string;
    isActive: boolean;
    questionIds: number[];
  };
}) {
  const [picked, setPicked] = useState<number[]>(initial?.questionIds ?? []);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const deferred = query.trim().toLowerCase();
  const filtered = questions.filter((question) => {
    if (!deferred) return true;
    const haystack = [question.code, stripHtml(question.body), question.categoryName ?? "", question.type ?? ""]
      .join(" ")
      .toLowerCase();
    return haystack.includes(deferred);
  });
  const editing = Boolean(initial?.id);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (picked.length < 1) {
          setError("Pilih minimal satu soal.");
          return;
        }
        const form = new FormData(event.currentTarget);
        const items = picked.map((questionId) => {
          const question = questions.find((item) => item.id === questionId);
          return {
            questionId,
            weight: Number(question?.defaultWeight ?? 1),
            wrongWeight: Number(question?.defaultWrongWeight ?? 0),
          };
        });
        setPending(true);
        setError(null);
        void api<{ id: number }>("/api/admin/paket-soal", {
          body: {
            id: initial?.id,
            name: String(form.get("name") ?? ""),
            description: String(form.get("description") ?? "") || null,
            isActive: form.get("isActive") === "on",
            items,
          },
        })
          .then(() => {
            window.location.href = "/admin/paket";
          })
          .catch((cause: unknown) => {
            setError(cause instanceof Error ? cause.message : "Gagal menyimpan paket.");
            setPending(false);
          });
      }}>
      <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold tracking-tight text-ink">Identitas paket</h2>
          <p className="mt-0.5 text-sm text-ink-muted">Nama paket dipakai saat memilih di form ujian.</p>
        </div>
        <div className="grid gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Nama paket
            <input
              name="name"
              required
              defaultValue={initial?.name}
              placeholder="Mis. Paket Matematika Kelas 9"
              className="rounded-xl border border-line px-3 py-2.5 font-normal"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
            Deskripsi <span className="font-normal text-ink-muted">(opsional)</span>
            <input
              name="description"
              defaultValue={initial?.description}
              maxLength={500}
              className="rounded-xl border border-line px-3 py-2.5 font-normal"
            />
          </label>
          <label className="flex items-center gap-2.5 rounded-xl bg-page/80 px-3 py-3 text-sm text-ink">
            <input name="isActive" type="checkbox" defaultChecked={initial?.isActive ?? true} className="size-4 accent-[var(--color-brand)]" />
            Paket aktif dan bisa dipilih di ujian
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-line/80 bg-paper p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-ink">Isi soal</h2>
            <p className="mt-0.5 text-sm text-ink-muted">
              <span className="font-digits font-semibold text-ink tabular-nums">{picked.length}</span> soal dipilih
            </p>
          </div>
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
              placeholder="Cari teks, kode, atau kategori"
              className="w-full rounded-xl border border-line bg-page/60 py-2.5 pr-3 pl-9 text-sm font-normal placeholder:text-ink-muted focus:border-brand focus:bg-paper"
            />
          </label>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line-strong/60 px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink">Bank soal masih kosong</p>
            <Link href="/admin/soal/baru" className="mt-3 inline-flex text-sm font-semibold text-brand hover:underline">
              Tambah soal
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl bg-page/80 px-4 py-6 text-center text-sm text-ink-muted">Tidak ada soal yang cocok.</p>
        ) : (
          <ul className="max-h-96 divide-y divide-line/70 overflow-auto rounded-xl border border-line/80">
            {filtered.map((question) => {
              const checked = picked.includes(question.id);
              const typeLabel =
                question.type === "ESSAY" ? "Uraian" : question.type === "SHORT_ANSWER" ? "Jawaban singkat" : question.type === "MULTIPLE_CHOICE" ? "Pilihan ganda" : null;
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
                      <span className="font-semibold text-ink">{previewQuestionText(question.body, 50)}</span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {[
                          typeLabel,
                          question.categoryName,
                          `benar ${question.defaultWeight}`,
                          Number(question.defaultWrongWeight) > 0 ? `salah −${question.defaultWrongWeight}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ErrorText error={error} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-60">
        {pending ? "Menyimpan…" : editing ? "Simpan perubahan" : "Buat paket"}
      </button>
    </form>
  );
}

export function DeletePackageButton({ packageId }: { packageId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        className="inline-flex min-h-10 items-center justify-center rounded-xl border border-alert/40 px-4 text-sm font-semibold text-alert transition hover:bg-alert/5 disabled:opacity-60"
        onClick={() => {
          if (!window.confirm("Hapus paket ini?")) return;
          setPending(true);
          setError(null);
          void api("/api/admin/hapus-paket-soal", { body: { id: packageId } })
            .then(() => {
              window.location.href = "/admin/paket";
            })
            .catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : "Gagal menghapus.");
              setPending(false);
            });
        }}>
        {pending ? "Menghapus…" : "Hapus paket"}
      </button>
      <ErrorText error={error} />
    </div>
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
