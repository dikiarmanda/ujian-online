import sanitizeHtml from "sanitize-html";

export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ["b", "strong", "i", "em", "p", "br", "ul", "ol", "li", "sub", "sup", "img"],
    allowedAttributes: { img: ["src", "alt"] },
    allowedSchemes: [],
    disallowedTagsMode: "discard",
    transformTags: {
      img: (_tagName, attribs) => {
        const src = attribs.src ?? "";
        const safe = src.startsWith("/uploads/") && !src.includes("..");
        const result: { tagName: string; attribs: Record<string, string> } = safe
          ? { tagName: "img", attribs: { src, alt: attribs.alt ?? "" } }
          : { tagName: "span", attribs: {} };
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
