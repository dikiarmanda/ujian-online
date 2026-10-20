"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import { Indonesian } from "flatpickr/dist/l10n/id.js";
import type { Instance } from "flatpickr/dist/types/instance";
import "flatpickr/dist/flatpickr.min.css";

type DateTimePickerProps = {
  name: string;
  mode?: "date" | "datetime";
  id?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
};

/**
 * Input tanggal/jam berbasis Flatpickr.
 * Nilai tersimpan sesuai backend: tanggal `YYYY-MM-DD`, waktu `YYYY-MM-DDTHH:mm` (WIB).
 */
export function DateTimePicker({
  name,
  mode = "date",
  id,
  required,
  defaultValue,
  placeholder,
  className = "w-full rounded-xl border border-line px-3 py-2.5 text-sm font-normal",
}: DateTimePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const instanceRef = useRef<Instance | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const isDatetime = mode === "datetime";
    instanceRef.current = flatpickr(el, {
      locale: Indonesian,
      enableTime: isDatetime,
      time_24hr: true,
      allowInput: false,
      disableMobile: true,
      dateFormat: isDatetime ? "j F Y, H:i" : "j F Y",
      defaultDate: defaultValue || undefined,
      appendTo: el.parentElement || undefined,
    });

    return () => {
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
    // Sengaja hanya mode: props lain dipakai saat inisialisasi pertama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, defaultValue]);

  return (
    <input
      ref={inputRef}
      id={id}
      name={name}
      required={required}
      defaultValue={defaultValue}
      className={className}
      placeholder={placeholder}
      autoComplete="off"
    />
  );
}
