"use client";

import { useState } from "react";
import { api } from "@/lib/api";

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <p className="text-sm text-alert">{error}</p>;
}

export function CreateClientForm({ exams }: { exams: { id: number; name: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [allExams, setAllExams] = useState(false);
  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-line bg-paper p-4 shadow-paper"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const examIds = exams.filter((exam) => form.get(`exam-${exam.id}`) === "on").map((exam) => exam.id);
        const allowedIps = String(form.get("allowedIps") ?? "")
          .split(/[\s,]+/)
          .map((item) => item.trim())
          .filter(Boolean);
        setError(null);
        void api("/api/admin/klien", {
          body: {
            name: form.get("name"),
            description: form.get("description"),
            allExams,
            examIds,
            allowedIps,
            rateLimitPerMinute: Number(form.get("rateLimitPerMinute") || 60),
          },
        })
          .then(() => window.location.reload())
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal membuat klien."));
      }}>
      <h2 className="text-base font-semibold">Klien baru</h2>
      <label className="text-sm">
        Nama
        <input name="name" required className="mt-1 block w-full rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <label className="text-sm">
        Deskripsi
        <input name="description" className="mt-1 block w-full rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allExams} onChange={(event) => setAllExams(event.target.checked)} />
        Semua ujian
      </label>
      {allExams ? null : (
        <fieldset className="flex flex-col gap-1 text-sm">
          <legend>Ujian yang boleh dibaca</legend>
          {exams.map((exam) => (
            <label key={exam.id} className="flex items-center gap-2">
              <input type="checkbox" name={`exam-${exam.id}`} />
              {exam.name}
            </label>
          ))}
        </fieldset>
      )}
      <label className="text-sm">
        IP yang diizinkan, pisahkan dengan koma. Kosongkan bila semua IP boleh.
        <input name="allowedIps" className="mt-1 block w-full rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <label className="text-sm">
        Batas permintaan per menit
        <input name="rateLimitPerMinute" type="number" min={1} max={6000} defaultValue={60} className="mt-1 block w-32 rounded-sm border border-line-strong px-3 py-2" />
      </label>
      <button type="submit" className="w-fit rounded-md bg-brand px-4 py-2 font-semibold text-white hover:brightness-110">
        Buat klien
      </button>
      <ErrorText error={error} />
    </form>
  );
}

export function RevokeClientButton({ clientId }: { clientId: number }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="text-sm text-alert"
        onClick={() => {
          void api(`/api/admin/klien/${clientId}`, { body: {} })
            .then(() => window.location.reload())
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal mencabut klien."));
        }}>
        Cabut klien
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function CreateKeyButton({ clientId }: { clientId: number }) {
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  if (secret) {
    return (
      <div className="rounded-sm bg-mark px-3 py-2 text-sm">
        <p className="font-semibold text-mark-ink">Simpan kunci ini sekarang. Kunci tidak akan ditampilkan lagi.</p>
        <p className="mt-1 break-all font-mono">{secret}</p>
        <button type="button" className="mt-2 text-brand" onClick={() => window.location.reload()}>
          Selesai
        </button>
      </div>
    );
  }
  return (
    <div>
      <button
        type="button"
        className="text-sm text-brand"
        onClick={() => {
          setError(null);
          void api<{ key: string }>(`/api/admin/klien/${clientId}/kunci`, { body: {} })
            .then((result) => setSecret(result.key))
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal membuat kunci."));
        }}>
        Buat kunci
      </button>
      <ErrorText error={error} />
    </div>
  );
}

export function RevokeKeyButton({ clientId, keyId }: { clientId: number; keyId: number }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="text-sm text-alert"
        onClick={() => {
          void api(`/api/admin/klien/${clientId}/kunci/${keyId}`, { body: {} })
            .then(() => window.location.reload())
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Gagal mencabut kunci."));
        }}>
        Cabut kunci
      </button>
      <ErrorText error={error} />
    </div>
  );
}
