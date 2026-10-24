"use client";

import { useEffect, useState } from "react";

export function NetworkQualityIndicator() {
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const measureLatency = async () => {
      const start = performance.now();
      try {
        await fetch("/api/health");
        const end = performance.now();
        setLatency(Math.round(end - start));
      } catch {
        setLatency(null);
      }
    };

    measureLatency();
    const interval = setInterval(measureLatency, 5000);
    return () => clearInterval(interval);
  }, []);

  const getLatencyLabel = (ms: number | null) => {
    if (ms === null) return { label: "—", className: "text-white/50" };
    if (ms < 100) return { label: "Bagus", className: "text-green-300" };
    if (ms < 300) return { label: "Sedang", className: "text-yellow-300" };
    return { label: "Kurang", className: "text-red-300" };
  };

  const latencyInfo = getLatencyLabel(latency);

  return (
    <div className="flex items-center gap-1 text-xs text-white/90">
      Kualitas jaringan:{" "}
      <span className={latencyInfo.className}>
        <b>{latencyInfo.label}</b>
      </span>
      {latency !== null && <span className="text-white/70">({latency}ms)</span>}
    </div>
  );
}
