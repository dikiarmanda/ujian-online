"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await api<{ redirect: string }>("/api/auth/login", {
        body: { identity: form.get("identity"), password: form.get("password") },
      });
      window.location.href = result.redirect;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Layanan masuk sedang tidak dapat dihubungi. Coba lagi dalam beberapa saat.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Identitas
        <input name="identity" autoComplete="username" required className="font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Kata sandi
        <input name="password" type="password" autoComplete="current-password" required className="font-normal" />
      </label>
      {error ? <p className="rounded-sm bg-mark px-3 py-2 text-sm text-alert">{error}</p> : null}
      <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-brand font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Memeriksa identitas" : "Masuk"}
      </button>
    </form>
  );
}
