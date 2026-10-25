import Link from "next/link";
import { headers } from "next/headers";
import { AppBar, AppFooter } from "@/components/chrome";
import { DataTable } from "@/components/data-table";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";
import os from 'os';

const links = [
  {
    href: "/admin",
    label: "Ringkas",
    icon: <FontAwesomeIcon icon={Icon.Home} className="size-4" />,
  },
  {
    href: "/admin/peserta",
    label: "Peserta",
    icon: <FontAwesomeIcon icon={Icon.Users} className="size-4" />,
  },
  {
    href: "/admin/ujian",
    label: "Jadwal Ujian",
    icon: <FontAwesomeIcon icon={Icon.Calendar} className="size-4" />,
  },
  {
    href: "/admin/paket",
    label: "Paket soal",
    icon: <FontAwesomeIcon icon={Icon.Folder} className="size-4" />,
  },
  {
    href: "/admin/soal",
    label: "Bank soal",
    icon: <FontAwesomeIcon icon={Icon.File} className="size-4" />,
  },
  {
    href: "/admin/laporan",
    label: "Laporan",
    icon: <FontAwesomeIcon icon={Icon.Chart} className="size-4" />,
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
