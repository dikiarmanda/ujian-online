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
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="w-fit rounded-md bg-brand font-semibold hover:brightness-110 px-4 py-2 text-white"
        onClick={() => {
          setError(null);
          void api<{ successCount: number; failedCount: number }>("/api/admin/sinkron", { body: {} })
            .then((result) => {
              setMessage(`Berhasil ${result.successCount}, gagal ${result.failedCount}.`);
              window.location.reload();
            })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Sinkronisasi gagal."));
        }}>
        Sinkron peserta
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
      <ErrorText error={error} />
    </div>
  );
}

export function ResetSessionButton({ userId }: { userId: number }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="text-sm text-brand"
        onClick={() => {
          void api(`/api/admin/users/${userId}/revoke-session`, { body: {} })
            .then(() => setError(null))
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal mereset sesi."));
        }}>
        Reset sesi
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function CategoryForm() {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void api("/api/admin/kategori", { body: { name: form.get("name"), description: form.get("description") } })
          .then(() => window.location.reload())
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal menyimpan kategori."));
      }}>
      <label className="text-sm">
        Kategori baru
        <input name="name" required className="mt-1 block rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <button className="rounded-sm border border-line-strong px-3 py-2 text-sm" type="submit">
        Simpan kategori
      </button>
      <ErrorText error={error} />
    </form>
  );
}

type OptionDraft = { label: string; body: string; isCorrect: boolean };

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

  return (
    <form
      className="flex max-w-3xl flex-col gap-4"
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
        void api<{ id: number }>("/api/admin/soal", { body: payload })
          .then(() => {
            window.location.href = "/admin/soal";
          })
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal menyimpan soal."));
      }}>
      <label className="text-sm">
        Kode
        <input name="code" required defaultValue={initial?.code} className="mt-1 block w-full rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <label className="text-sm">
        Kategori
        <select name="categoryId" defaultValue={initial?.categoryId} className="mt-1 block w-full rounded-sm border border-line-strong px-3 py-2">
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Jenis
        <select value={type} onChange={(event) => setType(event.target.value as "MULTIPLE_CHOICE" | "ESSAY")} className="mt-1 block w-full rounded-sm border border-line-strong px-3 py-2">
          <option value="MULTIPLE_CHOICE">Pilihan ganda</option>
          <option value="ESSAY">Uraian</option>
        </select>
      </label>
      <div className="text-sm">
        <span className="mb-1 block">Teks soal</span>
        <SummernoteEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Tulis soal di sini… (mendukung tabel, gambar, format teks)" height={200} />
      </div>
      <label className="text-sm">
        Bobot
        <input name="defaultWeight" type="number" min="0.01" step="0.01" defaultValue={initial?.defaultWeight ?? 1} className="mt-1 block w-32 rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked={initial?.isActive ?? true} />
        Aktif
      </label>
      {type === "MULTIPLE_CHOICE" ? (
        <div className="flex flex-col gap-3">
          <span className="text-sm font-semibold">Jawaban (Summernote)</span>
          {options.map((option, index) => (
            <div key={`${option.label}-${index}`} className="rounded-md border border-line bg-paper p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <input
                  aria-label={`Label opsi ${index + 1}`}
                  value={option.label}
                  onChange={(event) => {
                    const next = [...options];
                    next[index] = { ...option, label: event.target.value };
                    setOptions(next);
                  }}
                  className="w-16 rounded-sm border border-line-strong px-2 py-2"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" name="kunci" checked={option.isCorrect} onChange={() => setOptions(options.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === index })))} />
                  Kunci
                </label>
                {options.length > 2 ? (
                  <button
                    type="button"
                    className="ml-auto text-sm text-alert"
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
          <button type="button" className="w-fit text-sm text-brand" onClick={() => setOptions([...options, { label: String.fromCharCode(65 + options.length), body: "", isCorrect: false }])}>
            Tambah opsi
          </button>
        </div>
      ) : (
        <>
          <div className="text-sm">
            <span className="mb-1 block">Pedoman jawaban</span>
            <SummernoteEditor value={answerKeyHtml} onChange={setAnswerKeyHtml} placeholder="Tulis pedoman jawaban…" height={150} />
          </div>
          <div className="text-sm">
            <span className="mb-1 block">Rubrik</span>
            <SummernoteEditor value={rubricHtml} onChange={setRubricHtml} placeholder="Tulis rubrik penilaian…" height={150} />
          </div>
        </>
      )}
      <ErrorText error={error} />
      <button type="submit" className="w-fit rounded-md bg-brand font-semibold hover:brightness-110 px-4 py-2 text-white">
        Simpan soal
      </button>
    </form>
  );
}

export function ImportForm() {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const file = (event.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
        if (!file) return;
        void file.text().then((csv) =>
          api<{ success: number; errors: string[] }>("/api/admin/impor", { body: { csv } })
            .then((result) => setMessage(`Tersimpan ${result.success}. ${result.errors.join(" ")}`))
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Impor gagal.")),
        );
      }}>
      <p className="text-sm text-ink-muted">Kolom: kode, kategori, jenis, teks, bobot, opsi_a, opsi_b, opsi_c, opsi_d, kunci, pedoman, rubrik. Jenis diisi pg atau uraian.</p>
      <input name="file" type="file" accept=".csv,text/csv" required />
      <button type="submit" className="w-fit rounded-sm border border-line-strong px-3 py-2 text-sm">
        Impor
      </button>
      {message ? <p className="text-sm">{message}</p> : null}
      <ErrorText error={error} />
    </form>
  );
}

export function ExamForm() {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid max-w-xl gap-3 rounded-md border border-line bg-paper p-5 shadow-paper"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
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
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal menyimpan ujian."));
      }}>
      <input name="name" required placeholder="Nama ujian" className="rounded-sm border border-line-strong px-3 py-2" />
      <input name="examDate" type="date" required className="rounded-sm border border-line-strong px-3 py-2" />
      <input name="durationMinutes" type="number" min={1} defaultValue={60} required className="rounded-sm border border-line-strong px-3 py-2" />
      <label className="text-sm">
        <input type="checkbox" name="shuffleQuestions" /> Acak urutan soal
      </label>
      <label className="text-sm">
        <input type="checkbox" name="shuffleOptions" /> Acak urutan opsi
      </label>
      <select name="status" className="rounded-sm border border-line-strong px-3 py-2">
        <option value="DRAFT">Draf</option>
        <option value="PUBLISHED">Terbit</option>
        <option value="ARCHIVED">Arsip</option>
      </select>
      <ErrorText error={error} />
      <button type="submit" className="w-fit rounded-md bg-brand font-semibold hover:brightness-110 px-4 py-2 text-white">
        Buat ujian
      </button>
    </form>
  );
}

export function PackageForm({ examId, questions, selected }: { examId: number; questions: { id: number; code: string; defaultWeight: string }[]; selected: number[] }) {
  const [picked, setPicked] = useState<number[]>(selected);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const items = picked.map((questionId) => {
          const question = questions.find((item) => item.id === questionId);
          return { questionId, weight: Number(question?.defaultWeight ?? 1) };
        });
        void api("/api/admin/paket", { body: { examId, items } })
          .then(() => window.location.reload())
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal menyimpan paket."));
      }}>
      {questions.map((question) => (
        <label key={question.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={picked.includes(question.id)}
            onChange={(event) => {
              setPicked(event.target.checked ? [...picked, question.id] : picked.filter((id) => id !== question.id));
            }}
          />
          {question.code} · bobot {question.defaultWeight}
        </label>
      ))}
      <ErrorText error={error} />
      <button type="submit" className="w-fit rounded-md bg-brand font-semibold hover:brightness-110 px-4 py-2 text-white">
        Simpan paket
      </button>
    </form>
  );
}

export function SessionForm({ examId }: { examId: number }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid max-w-xl gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
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
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal membuat sesi."));
      }}>
      <input name="name" required placeholder="Nama sesi" className="rounded-sm border border-line-strong px-3 py-2" />
      <label className="text-sm">
        Absensi dibuka
        <input name="attendanceOpensAt" type="datetime-local" required className="mt-1 block rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <label className="text-sm">
        Mulai
        <input name="startsAt" type="datetime-local" required className="mt-1 block rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <label className="text-sm">
        Selesai
        <input name="endsAt" type="datetime-local" required className="mt-1 block rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <input name="capacity" type="number" min={1} placeholder="Kuota, kosongkan jika tanpa batas" className="rounded-sm border border-line-strong px-3 py-2" />
      <ErrorText error={error} />
      <button type="submit" className="w-fit rounded-sm border border-line-strong px-3 py-2">
        Tambah sesi
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
