"use client";

import Link from "next/link";
import { DataTable } from "@/components/data-table";

export type PaketData = {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  itemCount: number;
  examCount: number;
};

export function PaketTable({ packages }: { packages: PaketData[] }) {
  const headers = ["Nama paket", "Deskripsi", "Jumlah soal", "Ujian", "Status", "Aksi"];

  const rows = packages.map((pack) => [
    <Link href={`/admin/paket/${String(pack.id)}`} className="font-semibold text-ink hover:text-brand">
      {pack.name}
    </Link>,
    <span className="text-ink-muted line-clamp-2 max-w-xs">{pack.description || "—"}</span>,
    <span className="font-digits tabular-nums text-ink">{pack.itemCount}</span>,
    <span className="font-digits tabular-nums text-ink">{pack.examCount}</span>,
    pack.isActive ? (
      <span className="inline-flex rounded-md bg-brand-soft px-2 py-1 text-xs font-semibold text-brand">Aktif</span>
    ) : (
      <span className="inline-flex rounded-md bg-page px-2 py-1 text-xs font-semibold text-ink-muted">Nonaktif</span>
    ),
    <Link
      href={`/admin/paket/${String(pack.id)}`}
      className="inline-flex rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink transition hover:border-brand hover:text-brand">
      Edit
    </Link>,
  ]);

  return <DataTable headers={headers} rows={rows} itemsPerPage={10} searchPlaceholder="Cari paket..." />;
}
