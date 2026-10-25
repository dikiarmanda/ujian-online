"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";

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
            <FontAwesomeIcon icon={showPassword ? Icon.EyeSlash : Icon.Eye} className="size-5" />
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
