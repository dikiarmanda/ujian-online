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

    // Apply max-h 50% to all img tags within the HTML
    const images = el.querySelectorAll("img");
    images.forEach((img) => {
      img.style.setProperty("max-width", "75%", "important");
      const src = img.getAttribute("src") ?? "";
      if (src.startsWith("/uploads/") && !src.includes("..")) {
        img.setAttribute("src", `/api/media${src}`);
      }
    });
  }, [html, as]);

  if (as === "span") {
    return <span ref={spanRef} className={className} />;
  }
  return <div ref={divRef} className={className} />;
}
