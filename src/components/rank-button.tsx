"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export function RankButton({ examId, pendingGrading, phase }: { examId: number; pendingGrading: number; phase: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleCalculate = async () => {
    if (phase !== "ENDED") {
      const confirmed = window.confirm(
        "Ujian belum selesai. Peringkat mungkin berubah setelah ada peserta yang mengirim jawaban. Lanjutkan menghitung peringkat?"
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const result = await api<{ updated: number }>(`/api/admin/laporan/${examId}/rank`, { method: "POST" });
      setMessage(`${result.updated} peserta diberi peringkat`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      setMessage("Gagal menghitung peringkat");
    } finally {
      setLoading(false);
    }
  };

  if (pendingGrading > 0) {
    return (
      <button
        disabled
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-page px-4 text-sm font-semibold text-ink-muted opacity-50 cursor-not-allowed">
        Hitung Peringkat
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={handleCalculate}
        disabled={loading}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed">
        {loading ? "Menghitung..." : "Hitung Peringkat"}
      </button>
      {message && (
        <span className="absolute left-0 top-full mt-2 text-sm text-ink-muted whitespace-nowrap">
          {message}
        </span>
      )}
    </div>
  );
}
