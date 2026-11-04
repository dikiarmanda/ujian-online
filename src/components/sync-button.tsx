"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function SyncButton({ examId, hasRank }: { examId: number; hasRank: boolean }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const result = await api<{ successCount: number; failedCount: number }>(`/api/admin/sinkron-hasil-ujian`, {
        method: "POST",
        body: { examId },
      });
      setMessage(`${result.successCount} data berhasil disinkronkan${result.failedCount > 0 ? `, ${result.failedCount} gagal` : ""}`);
    } catch (error) {
      setMessage("Gagal sinkronisasi ke OMBN");
    } finally {
      setLoading(false);
    }
  };

  if (!hasRank) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={handleSync}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? "Menyinkronkan..." : "Sinkron ke OMBN"}
      </button>
      {message && (
        <span className="absolute left-0 top-full mt-2 text-sm text-ink-muted whitespace-nowrap">
          {message}
        </span>
      )}
    </div>
  );
}
