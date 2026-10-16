"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <form method="post" action="#" onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Username
        <input name="identity" autoComplete="username" required className="font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Kata sandi
        <span className="relative block font-normal">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full pr-11 font-normal"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-ink-muted hover:text-ink"
          >
            {showPassword ? (
              <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 10.5 7.5a11 11 0 01-1.7 3.3M6.1 6.1A11 11 0 001.5 12.5C2.7 16.9 7 20 12 20a9.8 9.8 0 005.1-1.4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg className="size-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M2 12.5C3.2 8.1 7.5 5 12.5 5S21.8 8.1 23 12.5C21.8 16.9 17.5 20 12.5 20S3.2 16.9 2 12.5z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <circle cx="12.5" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            )}
          </button>
        </span>
      </label>
      {error ? <p className="rounded-sm bg-mark px-3 py-2 text-sm text-alert">{error}</p> : null}
      <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-brand font-semibold text-white hover:brightness-110 disabled:opacity-60">
        {pending ? "Memeriksa identitas" : "Masuk"}
      </button>
    </form>
  );
}
