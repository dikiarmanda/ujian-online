import Link from "next/link";
import { AppBar } from "@/components/chrome";

const links = [
  { href: "/admin", label: "Ringkas" },
  { href: "/admin/peserta", label: "Peserta" },
  { href: "/admin/soal", label: "Bank soal" },
  { href: "/admin/ujian", label: "Ujian" },
  { href: "/admin/laporan", label: "Laporan" },
  { href: "/admin/klien", label: "Klien API" },
];

export function AdminShell({ name, current, children }: { name: string; current: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-page">
      <AppBar title="Ruang admin" name={name} />
      <div className="grid md:grid-cols-[220px_1fr]">
        <nav className="border-b border-line bg-paper md:min-h-[calc(100vh-61px)] md:border-r md:border-b-0">
          <ul className="flex gap-2 overflow-auto p-3 md:flex-col">
            {links.map((link) => {
              const active = current === link.href;
              return (
                <li key={link.href}>
                  <Link href={link.href} className={`block rounded-md px-3 py-2 text-sm ${active ? "bg-brand-soft font-semibold text-brand" : "text-ink-muted hover:bg-page hover:text-ink"}`}>
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <main className="p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function DataTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-auto rounded-md border border-line bg-paper shadow-paper">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-page text-left text-ink-muted">
            {headers.map((header) => (
              <th key={header} className="px-3 font-semibold">
                <span className="flex h-10 items-center">{header}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-line last:border-0 hover:bg-brand-soft/40">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3">
                  <span className="flex min-h-10 items-center">{cell}</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
