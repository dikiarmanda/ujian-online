"use client";

import { useEffect, useRef } from "react";
import { hydrateMathInElement } from "@/lib/math-latex";

type RichHtmlProps = {
  html: string;
  className?: string;
  as?: "div" | "span";
};

/** Menampilkan HTML soal/pilihan sekaligus merender LaTeX (KaTeX). */
export default function RichHtml({ html, className, as = "div" }: RichHtmlProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = as === "span" ? spanRef.current : divRef.current;
    if (!el) return;
    el.innerHTML = html || "";
    hydrateMathInElement(el);
  }, [html, as]);

  if (as === "span") {
    return <span ref={spanRef} className={className} />;
  }
  return <div ref={divRef} className={className} />;
}
