import Link from "next/link";
import { headers } from "next/headers";
import { AppBar, AppFooter } from "@/components/chrome";
import { DataTable } from "@/components/data-table";
import os from 'os';

const links = [
  {
    href: "/admin",
    label: "Ringkas",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/peserta",
    label: "Peserta",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 18.5c.7-2.6 2.8-4 5.5-4s4.8 1.4 5.5 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M15.2 14.2c1.5.4 2.7 1.4 3.3 3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/ujian",
    label: "Jadwal Ujian",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 3.5v3M16 3.5v3M4 10h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="m9 15 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/paket",
    label: "Paket soal",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7.5h16v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-11Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 7.5V5.8A1.8 1.8 0 0 1 9.8 4h4.4A1.8 1.8 0 0 1 16 5.8V7.5M8 12h8M8 15.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/soal",
    label: "Bank soal",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 4.5h8.5L19 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M15.5 4.5V8H19M9 12h6M9 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/laporan",
    label: "Laporan",
    icon: (
      <svg className="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19V9.5M10.5 19V5M16 19v-7M21 19H3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export async function AdminShell({
  name,
  current,
  children,
  identity,
}: {
  name: string;
  current: string;
  children: React.ReactNode;
  identity?: string;
}) {
  const headerList = await headers();
  const hostname = os.hostname();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "127.0.0.1";
  const footerUser = identity ? `${name} (${identity})` : name;

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <AppBar title="Ruang admin" name={name} role="ADMIN" />
      <div className="grid flex-1 md:grid-cols-[240px_1fr]">
        <nav className="border-b border-line/80 bg-paper md:sticky md:top-[61px] md:max-h-[calc(100vh-61px)] md:overflow-y-auto md:border-r md:border-b-0">
          <div className="flex h-full flex-col p-3 md:p-4">
            <p className="mb-2 hidden px-3 text-[10px] font-semibold tracking-[0.12em] text-ink-muted uppercase md:block">Menu</p>
            <ul className="flex gap-1.5 overflow-auto md:flex-col md:gap-1">
              {links.map((link) => {
                const active = current === link.href;
                return (
                  <li key={link.href} className="shrink-0">
                    <Link
                      href={link.href}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-brand-soft font-semibold text-brand shadow-sm ring-1 ring-brand/15"
                          : "text-ink-muted hover:bg-page hover:text-ink"
                      }`}>
                      <span className={active ? "text-brand" : "text-ink-muted"}>{link.icon}</span>
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>
        <main className="relative min-w-0 overflow-hidden p-4 md:p-8 lg:p-10">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-64 opacity-80"
            style={{
              background:
                "radial-gradient(ellipse 70% 80% at 80% 0%, color-mix(in srgb, var(--color-brand) 10%, transparent), transparent 70%)",
            }}
            aria-hidden="true"
          />
          <div className="relative">{children}</div>
        </main>
      </div>
      <AppFooter host={hostname} user={footerUser} ip={ip} />
    </div>
  );
}
