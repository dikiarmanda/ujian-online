import sanitizeHtml from "sanitize-html";

export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    // Tag yang dihasilkan Summernote (teks, heading, tabel, kutipan, tautan, gambar).
    allowedTags: [
      "p",
      "div",
      "span",
      "br",
      "hr",
      "b",
      "strong",
      "i",
      "em",
      "u",
      "s",
      "strike",
      "del",
      "sub",
      "sup",
      "h1",
      "h2",
      "h3",
      "h4",
      "blockquote",
      "pre",
      "code",
      "ul",
      "ol",
      "li",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "a",
      "img",
    ],
    allowedAttributes: {
      a: ["href", "title", "target"],
      img: ["src", "alt", "title", "width", "height", "style"],
      table: ["style", "border", "cellpadding", "cellspacing"],
      th: ["style", "colspan", "rowspan"],
      td: ["style", "colspan", "rowspan"],
      p: ["style"],
      div: ["style"],
      span: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedStyles: {
      "*": {
        color: [/^.*$/],
        "background-color": [/^.*$/],
        "text-align": [/^.*$/],
        "font-size": [/^.*$/],
        "font-family": [/^.*$/],
      },
    },
    disallowedTagsMode: "discard",
    transformTags: {
      img: (_tagName, attribs) => {
        const src = attribs.src ?? "";
        const safe = src.startsWith("/uploads/") && !src.includes("..");
        if (!safe) return { tagName: "span", attribs: {} };
        const keep: Record<string, string> = { src, alt: attribs.alt ?? "" };
        for (const key of ["title", "width", "height", "style"] as const) {
          if (attribs[key]) keep[key] = attribs[key];
        }
        const result: { tagName: string; attribs: Record<string, string> } = { tagName: "img", attribs: keep };
        return result;
      },
    },
  });
}

export function assertUploadPath(path: string | null | undefined): string | null {
  if (!path) return null;
  if (!path.startsWith("/uploads/") || path.includes("..")) {
    throw new Error("Berkas gambar tidak valid.");
  }
  return path;
}
