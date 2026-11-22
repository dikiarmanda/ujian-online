"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Icon } from "@/lib/icons";

export function CalculateAverageButton({ examId, currentAverage }: { examId: number; currentAverage?: number | null }) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{ averageScore: number | null; participantCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCalculate = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/admin/exams/${examId}/calculate-average`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal menghitung rata-rata");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const displayAverage = result?.averageScore ?? currentAverage;

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleCalculate}
        disabled={isLoading}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed"
        title={displayAverage !== null ? `Rata-rata saat ini: ${displayAverage.toFixed(2)}` : "Hitung rata-rata nilai"}
      >
        <FontAwesomeIcon icon={isLoading ? Icon.Refresh : Icon.Calculator} className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
        {isLoading ? "Menghitung..." : displayAverage !== null ? displayAverage.toFixed(2) : "Rata-rata"}
      </button>

      {result && (
        <div className="rounded-xl border border-brand/30 bg-brand-soft/50 p-3">
          <p className="text-sm font-semibold text-brand">
            Rata-rata: {result.averageScore !== null ? result.averageScore.toFixed(2) : "—"}
          </p>
          <p className="text-xs text-brand/80">
            Dari {result.participantCount} peserta
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-alert/30 bg-alert/10 p-3">
          <p className="text-xs font-semibold text-alert">{error}</p>
        </div>
      )}
    </div>
  );
}
