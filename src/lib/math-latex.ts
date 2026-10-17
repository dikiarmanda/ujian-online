import katex from "katex";
import renderMathInElement from "katex/contrib/auto-render";

export function renderLatex(latex: string, displayMode = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false,
      displayMode,
      strict: "ignore",
    });
  } catch {
    return latex;
  }
}

export function buildMathSpanHtml(latex: string, displayMode = false): string {
  const trimmed = latex.trim();
  if (!trimmed) return "";
  const rendered = renderLatex(trimmed, displayMode);
  const display = displayMode ? "1" : "0";
  const escaped = trimmed
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<span class="math-latex" contenteditable="false" data-latex="${escaped}" data-display="${display}">${rendered}</span>`;
}

/** Rapikan HTML editor: isi span.math-latex diganti teks LaTeX mentah (untuk disimpan). */
export function normalizeMathHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelectorAll("span.math-latex[data-latex]").forEach((el) => {
    const latex = el.getAttribute("data-latex") ?? "";
    const display = el.getAttribute("data-display") === "1" ? "1" : "0";
    el.setAttribute("class", "math-latex");
    el.setAttribute("contenteditable", "false");
    el.setAttribute("data-latex", latex);
    el.setAttribute("data-display", display);
    el.textContent = latex;
  });
  return doc.body.innerHTML;
}

/** Render ulang elemen `.math-latex` + delimiter `$…$` / `\(...\)` di dalam root. */
export function hydrateMathInElement(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("span.math-latex[data-latex]").forEach((el) => {
    const latex = el.getAttribute("data-latex") ?? "";
    const display = el.getAttribute("data-display") === "1";
    el.setAttribute("contenteditable", "false");
    el.innerHTML = renderLatex(latex, display);
  });

  renderMathInElement(root, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "$", right: "$", display: false },
      { left: "\\(", right: "\\)", display: false },
    ],
    throwOnError: false,
    strict: "ignore",
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option"],
    ignoredClasses: ["math-latex"],
  });
}
