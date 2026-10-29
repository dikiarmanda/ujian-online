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
      // Formula LaTeX disimpan sebagai span.math-latex[data-latex].
      span: ["style", "class", "contenteditable", "data-latex", "data-display"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedClasses: {
      span: ["math-latex"],
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
        const isLocalUpload = src.startsWith("/uploads/") && !src.includes("..");
        const isDummyImage = src.startsWith("https://dummyimage.com/");
        const safe = isLocalUpload || isDummyImage;
        if (!safe) return { tagName: "span", attribs: {} };
        const keep: Record<string, string> = { src, alt: attribs.alt ?? "" };
        for (const key of ["title", "width", "height", "style"] as const) {
          if (attribs[key]) keep[key] = attribs[key];
        }
        const result: { tagName: string; attribs: Record<string, string> } = { tagName: "img", attribs: keep };
        return result;
      },
      span: (_tagName, attribs) => {
        const classes = (attribs.class ?? "").split(/\s+/).filter(Boolean);
        if (classes.includes("math-latex") && attribs["data-latex"]) {
          return {
            tagName: "span",
            attribs: {
              class: "math-latex",
              contenteditable: "false",
              "data-latex": attribs["data-latex"],
              "data-display": attribs["data-display"] === "1" ? "1" : "0",
            },
          };
        }
        const keep: Record<string, string> = {};
        if (attribs.style) keep.style = attribs.style;
        return { tagName: "span", attribs: keep };
      },
    },
  });
}

export function assertUploadPath(path: string | null | undefined): string | null {
  if (!path) return null;
  // Allow local upload paths and dummyimage.com URLs for imported questions
  const isLocalUpload = path.startsWith("/uploads/") && !path.includes("..");
  const isDummyImage = path.startsWith("https://dummyimage.com/");
  if (!isLocalUpload && !isDummyImage) {
    throw new Error("Berkas gambar tidak valid.");
  }
  return path;
}
