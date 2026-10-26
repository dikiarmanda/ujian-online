import type { Metadata } from "next";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";

export const metadata: Metadata = {
  title: "Halaman tidak ditemukan — Ujian Online",
};

export default function NotFound() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-6 py-12"
      style={{
        backgroundImage: "linear-gradient(to bottom, rgba(238,241,242,0.92), rgba(238,241,242,0.98)), url('/pattern-islamic.svg')",
        backgroundPosition: "center",
        backgroundRepeat: "repeat",
        backgroundSize: "70px",
      }}>
      <section className="w-full max-w-md rounded-md border border-line bg-paper p-8 text-center shadow-paper">
        <img src="/brand/logo-dikdas.png" alt="Logo Majelis Dikdasmen dan PNF PP Muhammadiyah" className="mx-auto h-12 w-auto" />
        <p className="mt-6 font-digits text-5xl font-semibold tracking-tight text-brand">404</p>
        <h1 className="mt-3 text-lg font-semibold">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-ink-muted">Alamat yang Anda buka tidak ada, atau halaman sudah dipindahkan.</p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110">
          <FontAwesomeIcon icon={Icon.Home} className="size-4" />
          Kembali ke beranda
        </Link>
      </section>
    </main>
  );
}
